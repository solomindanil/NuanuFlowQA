import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import {
  COMMENT_HTML_MAX_BYTES,
  escapeHtml,
  markerFor,
  publishComment,
  renderComment,
} from "../../scripts/qah/render-comment.mjs";
import { finalizeTransition } from "../../scripts/qah/finalize.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const issueId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";
const sourceArtifact = {
  artifact_id: "55555555-5555-4555-8555-555555555555",
  version_id: "66666666-6666-4666-8666-666666666666",
  kind: "flow_item",
  role: "source",
};
const reviewBundle = {
  artifact_id: "77777777-7777-4777-8777-777777777777",
  version_id: "88888888-8888-4888-8888-888888888888",
  kind: "document",
  role: "evidence",
};
const review = {
  schema_version: "nuanu.qa-review-bundle.v1",
  selected_checks: ["code", "api"],
  skipped_checks: ["ui", "domain"],
  commit: "a".repeat(40),
  content_hash: `sha256:${"b".repeat(64)}`,
  finding_count: 0,
  environment_lease: {
    run_id: "run-1",
    attempt_id: "attempt-1",
    environment_id: "generic-env",
    target_namespace: sha256({ run_id: "run-1", attempt_id: "attempt-1", environment_id: "generic-env" }).slice(7),
    instance_nonce: "99999999-9999-4999-8999-999999999999",
  },
};

function releaseDecision(overrides = {}) {
  const unsigned = {
    schema_version: "nuanu.qa-release-route.v1",
    aggregate_sha256: `sha256:${"c".repeat(64)}`,
    route: "READY_FOR_PRODUCTION",
    reason_codes: [],
    policy_override_rejected: false,
    explanation: { summary: "<script>raw-secret-test-data-body</script>", reason_codes: [] },
    ...overrides,
  };
  return { ...unsigned, decision_sha256: sha256(unsigned) };
}

function publicationInput(overrides = {}) {
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    issue_id: issueId,
    source_artifact: { ...sourceArtifact },
    decision: releaseDecision(),
    review_bundle: { ...reviewBundle },
    ...overrides,
  };
}

function normalizedComment(html, overrides = {}) {
  return {
    comment_id: commentId,
    workspace_id: workspaceId,
    project_id: projectId,
    issue_id: issueId,
    comment_html: html,
    ...overrides,
  };
}

function publicationDependencies({ comments = [], add, source = {}, bundle = {} } = {}) {
  const calls = { list: 0, add: 0, source: 0, bundle: 0 };
  const state = { comments: [...comments] };
  return {
    calls,
    state,
    dependencies: {
      resolveSourceIdentity: async ({ workspace_id, ref, max_bytes }) => {
        calls.source += 1;
        assert.equal(max_bytes, 262_144);
        return {
          workspace_id,
          project_id: projectId,
          issue_id: issueId,
          source_artifact: { ...ref },
          ...source,
        };
      },
      resolveReviewBundle: async ({ workspace_id, ref, max_bytes }) => {
        calls.bundle += 1;
        assert.equal(max_bytes, 262_144);
        return {
          workspace_id,
          review_bundle: { ...ref },
          review: structuredClone(review),
          ...bundle,
        };
      },
      listIssueComments: async (request) => {
        calls.list += 1;
        assert.deepEqual(Object.keys(request).sort(), ["issue_id", "max_body_bytes", "max_comments", "project_id", "workspace_id"]);
        return {
          enforced_max_comments: 100,
          enforced_max_body_bytes: COMMENT_HTML_MAX_BYTES,
          comments: structuredClone(state.comments),
        };
      },
      addIssueComment: async (request) => {
        calls.add += 1;
        if (add) return add(request, state);
        state.comments.push(normalizedComment(request.comment_html));
        return { accepted: true };
      },
    },
  };
}

function environmentLease(overrides = {}) {
  const value = {
    run_id: "run-1",
    attempt_id: "attempt-1",
    environment_id: "generic-env",
    target_namespace: sha256({ run_id: "run-1", attempt_id: "attempt-1", environment_id: "generic-env" }).slice(7),
    instance_nonce: "99999999-9999-4999-8999-999999999999",
    ...overrides,
  };
  return value;
}

function cleanupReceipt(status = "STOPPED", lease = environmentLease(), overrides = {}) {
  return { environment_status: status, ...lease, ...overrides };
}

function finalizationInput(commentReceipt, overrides = {}) {
  const lease = environmentLease();
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    issue_id: issueId,
    source_artifact: { ...sourceArtifact },
    decision: releaseDecision(),
    review_bundle: { ...reviewBundle },
    comment_receipt: commentReceipt,
    cleanup_receipt: cleanupReceipt("STOPPED", lease),
    ...overrides,
  };
}

function finalizationDependencies(commentReceipt, html, overrides = {}) {
  return {
    resolveSourceIdentity: async ({ workspace_id, ref }) => ({
      workspace_id,
      project_id: projectId,
      issue_id: issueId,
      source_artifact: { ...ref },
    }),
    resolveReviewBundle: async ({ workspace_id, ref }) => ({
      workspace_id,
      review_bundle: { ...ref },
      review: structuredClone(review),
    }),
    readIssueComment: async ({ comment_id }) => ({
      enforced_max_body_bytes: COMMENT_HTML_MAX_BYTES,
      comment: normalizedComment(html, { comment_id }),
    }),
    ...overrides,
  };
}

test("escapeHtml escapes every HTML-significant dynamic character", () => {
  assert.equal(escapeHtml(`<tag a="x">Tom & 'Ada'</tag>`), "&lt;tag a=&quot;x&quot;&gt;Tom &amp; &#39;Ada&#39;&lt;/tag&gt;");
});

test("comment rendering is deterministic, bounded, escaped, and omits explanation secrets", () => {
  const input = { source_artifact: sourceArtifact, decision: releaseDecision(), review_bundle: reviewBundle, review };
  const first = renderComment(input);
  const second = renderComment(structuredClone(input));
  assert.equal(first.comment_html, second.comment_html);
  assert.equal(first.marker, second.marker);
  assert.ok(Buffer.byteLength(first.comment_html, "utf8") <= COMMENT_HTML_MAX_BYTES);
  assert.equal(first.comment_html.includes("raw-secret-test-data-body"), false);
  assert.equal(first.comment_html.includes("<script>"), false);
  assert.match(first.comment_html, /READY_FOR_PRODUCTION/);
  assert.match(first.comment_html, new RegExp(`${sourceArtifact.artifact_id}@${sourceArtifact.version_id}`));
  assert.match(first.comment_html, new RegExp(`${reviewBundle.artifact_id}@${reviewBundle.version_id}`));
});

test("marker binds only canonical source version, decision digest, and review-bundle version", () => {
  const decision = releaseDecision();
  const first = markerFor({ source_artifact: sourceArtifact, decision_sha256: decision.decision_sha256, review_bundle: reviewBundle });
  const reordered = markerFor({
    review_bundle: { role: "evidence", kind: "document", version_id: reviewBundle.version_id, artifact_id: reviewBundle.artifact_id },
    decision_sha256: decision.decision_sha256,
    source_artifact: { role: "source", kind: "flow_item", version_id: sourceArtifact.version_id, artifact_id: sourceArtifact.artifact_id },
  });
  assert.equal(first, reordered);
  assert.notEqual(first, markerFor({ source_artifact: sourceArtifact, decision_sha256: `sha256:${"d".repeat(64)}`, review_bundle: reviewBundle }));
  assert.match(first, /^<!-- nuanu-qah-comment:v1:[a-f0-9]{64} -->$/);
});

test("renderer rejects missing versions, extra secret/test-data/body inputs, and invalid decision digests", () => {
  assert.throws(() => renderComment({
    source_artifact: { artifact_id: sourceArtifact.artifact_id, kind: "flow_item", role: "source" },
    decision: releaseDecision(), review_bundle: reviewBundle, review,
  }), /INVALID_ARTIFACT_REFERENCE/);
  assert.throws(() => renderComment({ source_artifact: sourceArtifact, decision: releaseDecision(), review_bundle: reviewBundle, review: { ...review, test_data: "secret" } }), /INVALID_REVIEW_BUNDLE/);
  assert.throws(() => renderComment({ source_artifact: sourceArtifact, decision: { ...releaseDecision(), decision_sha256: `sha256:${"0".repeat(64)}` }, review_bundle: reviewBundle, review }), /INVALID_RELEASE_DECISION/);
});

test("already-present marker is idempotently read back without adding a comment", async () => {
  const rendered = renderComment({ source_artifact: sourceArtifact, decision: releaseDecision(), review_bundle: reviewBundle, review });
  const fixture = publicationDependencies({ comments: [normalizedComment(rendered.comment_html)] });
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  assert.equal(receipt.publication_status, "ALREADY_PRESENT");
  assert.equal(receipt.comment_id, commentId);
  assert.equal(fixture.calls.add, 0);
  assert.equal(fixture.calls.list, 1);
  assert.deepEqual(Object.keys(receipt).sort(), [
    "comment_html_sha256", "comment_id", "decision_sha256", "issue_id", "marker", "project_id", "publication_status",
    "review_bundle", "schema_version", "source_artifact", "workspace_id",
  ]);
});

test("zero markers triggers one add and an authoritative read-back", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  assert.equal(receipt.publication_status, "ADDED");
  assert.equal(fixture.calls.add, 1);
  assert.equal(fixture.calls.list, 2);
});

test("an ambiguous add is reconciled by read-back and never treated as an exactly-once proof", async () => {
  const fixture = publicationDependencies({
    add: async (request, state) => {
      state.comments.push(normalizedComment(request.comment_html));
      throw new Error("transport outcome unknown and may contain a raw body");
    },
  });
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  assert.equal(receipt.publication_status, "RECONCILED");
  assert.equal(fixture.calls.add, 1);
  assert.equal(fixture.calls.list, 2);
  assert.equal(canonicalJson(receipt).includes("transport outcome unknown"), false);
});

test("duplicate markers fail before write and zero markers after write fail closed", async () => {
  const rendered = renderComment({ source_artifact: sourceArtifact, decision: releaseDecision(), review_bundle: reviewBundle, review });
  let fixture = publicationDependencies({ comments: [normalizedComment(rendered.comment_html), normalizedComment(rendered.comment_html, { comment_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })] });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /DUPLICATE_COMMENT_MARKER/);
  assert.equal(fixture.calls.add, 0);

  fixture = publicationDependencies({ add: async () => ({ accepted: true }) });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /COMMENT_NOT_FOUND_AFTER_WRITE/);
  assert.equal(fixture.calls.add, 1);
  assert.equal(fixture.calls.list, 2);
});

test("a read-back comment with the current marker plus a different QA marker cannot earn a receipt", async () => {
  const rendered = renderComment({ source_artifact: sourceArtifact, decision: releaseDecision(), review_bundle: reviewBundle, review });
  const differentMarker = `<!-- nuanu-qah-comment:v1:${"f".repeat(64)} -->`;
  const fixture = publicationDependencies({ comments: [normalizedComment(`${rendered.comment_html}${differentMarker}`)] });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /DUPLICATE_COMMENT_MARKER/);
  assert.equal(fixture.calls.add, 0);
});

test("an ambiguous write with no reconciled marker remains blocked", async () => {
  const fixture = publicationDependencies({ add: async () => { throw new Error("unknown write outcome"); } });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /COMMENT_NOT_FOUND_AFTER_WRITE/);
  assert.equal(fixture.calls.list, 2);
});

test("trusted source identity and exact source/review versions are required before comment access", async () => {
  let fixture = publicationDependencies({ source: { project_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /SOURCE_IDENTITY_MISMATCH/);
  assert.equal(fixture.calls.list, 0);

  fixture = publicationDependencies({ source: { source_artifact: { ...sourceArtifact, version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } } });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /SOURCE_IDENTITY_MISMATCH/);
  assert.equal(fixture.calls.list, 0);

  fixture = publicationDependencies({ bundle: { review_bundle: { ...reviewBundle, version_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } } });
  await assert.rejects(publishComment(publicationInput(), fixture.dependencies), /REVIEW_BUNDLE_MISMATCH/);
  assert.equal(fixture.calls.list, 0);
});

test("STOPPED cleanup and one trusted marker allow READY_FOR_PRODUCTION transition", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const html = fixture.state.comments[0].comment_html;
  const result = await finalizeTransition(finalizationInput(receipt), finalizationDependencies(receipt, html));
  assert.deepEqual(result, {
    schema_version: "nuanu.qa-finalization-result.v1",
    transition_allowed: true,
    target_state: "ready_for_production",
    reason_codes: [],
  });
});

test("ABSENT cleanup for the exact trusted lease allows RETURN_TO_IN_PROGRESS", async () => {
  const decision = releaseDecision({ route: "RETURN_TO_IN_PROGRESS", reason_codes: ["POLICY_BLOCKED"] });
  delete decision.decision_sha256;
  decision.decision_sha256 = sha256(Object.fromEntries(Object.entries(decision).filter(([key]) => key !== "decision_sha256")));
  const input = publicationInput({ decision });
  const fixture = publicationDependencies();
  const receipt = await publishComment(input, fixture.dependencies);
  const lease = environmentLease();
  const result = await finalizeTransition(finalizationInput(receipt, {
    decision,
    cleanup_receipt: cleanupReceipt("ABSENT", lease),
  }), finalizationDependencies(receipt, fixture.state.comments[0].comment_html));
  assert.equal(result.transition_allowed, true);
  assert.equal(result.target_state, "in_progress");
});

test("RECOVERY_REQUIRED, unknown cleanup, and any lease mismatch block transition", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const html = fixture.state.comments[0].comment_html;
  for (const cleanup_receipt of [
    cleanupReceipt("RECOVERY_REQUIRED"),
    cleanupReceipt("UNCERTAIN"),
    cleanupReceipt("STOPPED", environmentLease(), { attempt_id: "attempt-2" }),
    cleanupReceipt("STOPPED", environmentLease(), { instance_nonce: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
  ]) {
    const result = await finalizeTransition(finalizationInput(receipt, { cleanup_receipt }), finalizationDependencies(receipt, html));
    assert.equal(result.transition_allowed, false);
    assert.equal(result.reason_codes.some((code) => code.startsWith("CLEANUP_")), true);
  }
});

test("a consistently forged caller cleanup lease cannot replace the trusted review-bundle lease", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const forgedLease = environmentLease({
    attempt_id: "attempt-2",
    target_namespace: sha256({ run_id: "run-1", attempt_id: "attempt-2", environment_id: "generic-env" }).slice(7),
  });
  const result = await finalizeTransition(finalizationInput(receipt, {
    cleanup_receipt: cleanupReceipt("STOPPED", forgedLease),
  }), finalizationDependencies(receipt, fixture.state.comments[0].comment_html));
  assert.equal(result.transition_allowed, false);
  assert.equal(result.reason_codes.includes("CLEANUP_RECEIPT_INVALID"), true);
});

test("zero or duplicate markers in trusted comment read-back block transition", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const html = fixture.state.comments[0].comment_html;
  for (const commentHtml of [html.replace(receipt.marker, ""), `${html}${receipt.marker}`]) {
    const result = await finalizeTransition(finalizationInput(receipt), finalizationDependencies(receipt, commentHtml));
    assert.equal(result.transition_allowed, false);
    assert.equal(result.reason_codes.includes("COMMENT_MARKER_COUNT_INVALID"), true);
  }
});

test("wrong read-back comment UUID, issue/project identity, or receipt digest blocks transition", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const html = fixture.state.comments[0].comment_html;
  const cases = [
    finalizationDependencies(receipt, html, { readIssueComment: async () => ({ enforced_max_body_bytes: COMMENT_HTML_MAX_BYTES, comment: normalizedComment(html, { comment_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }) }) }),
    finalizationDependencies(receipt, html, { readIssueComment: async () => ({ enforced_max_body_bytes: COMMENT_HTML_MAX_BYTES, comment: normalizedComment(html, { project_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }) }) }),
  ];
  for (const dependencies of cases) {
    const result = await finalizeTransition(finalizationInput(receipt), dependencies);
    assert.equal(result.transition_allowed, false);
    assert.equal(result.reason_codes.includes("COMMENT_READBACK_INVALID"), true);
  }
  const forged = { ...receipt, comment_html_sha256: `sha256:${"f".repeat(64)}` };
  const result = await finalizeTransition(finalizationInput(forged), finalizationDependencies(forged, html));
  assert.equal(result.transition_allowed, false);
  assert.equal(result.reason_codes.includes("COMMENT_READBACK_INVALID"), true);
});

test("finalization independently rechecks trusted source/project/issue/review versions", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const html = fixture.state.comments[0].comment_html;
  for (const dependencies of [
    finalizationDependencies(receipt, html, { resolveSourceIdentity: async () => ({ workspace_id: workspaceId, project_id: projectId, issue_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", source_artifact: sourceArtifact }) }),
    finalizationDependencies(receipt, html, { resolveReviewBundle: async () => ({ workspace_id: workspaceId, review_bundle: { ...reviewBundle, version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, review }) }),
  ]) {
    const result = await finalizeTransition(finalizationInput(receipt), dependencies);
    assert.equal(result.transition_allowed, false);
    assert.equal(result.reason_codes.some((code) => ["SOURCE_IDENTITY_INVALID", "REVIEW_BUNDLE_INVALID"].includes(code)), true);
  }
});

test("final output is closed and scripts expose no direct status mutation callback", async () => {
  const fixture = publicationDependencies();
  const receipt = await publishComment(publicationInput(), fixture.dependencies);
  const dependencies = finalizationDependencies(receipt, fixture.state.comments[0].comment_html);
  let mutationCalls = 0;
  dependencies.updateIssue = async () => { mutationCalls += 1; };
  const result = await finalizeTransition(finalizationInput(receipt), dependencies);
  assert.deepEqual(Object.keys(result).sort(), ["reason_codes", "schema_version", "target_state", "transition_allowed"]);
  assert.equal(mutationCalls, 0);
});

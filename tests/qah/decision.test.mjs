import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import { aggregateEvidence } from "../../scripts/qah/aggregate.mjs";
import { decideRelease } from "../../scripts/qah/decide.mjs";
import { aggregateFixture, aggregateFixtureResult, material, rewriteMaterial } from "./aggregate.test.mjs?fixtures-only";

const classes = {
  ui: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "REQUIRED", domain: "NOT_APPLICABLE" },
  api: { code: "REQUIRED", api: "REQUIRED", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" },
  mixed: { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" },
  docs: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" },
};

test("all four clean ticket classes route READY_FOR_PRODUCTION", async () => {
  for (const [name, applicability] of Object.entries(classes)) {
    const fixture = aggregateFixture({ applicability });
    const aggregate = await aggregateFixtureResult(fixture);
    const decision = await decideRelease(aggregate, {}, fixture.dependencies);
    assert.equal(decision.route, "READY_FOR_PRODUCTION", name);
    assert.equal(decision.policy_override_rejected, false, name);
    assert.deepEqual(decision.reason_codes, [], name);
  }
});

test("Codex explanation cannot override deterministic failure with malicious READY proposal", async () => {
  const fixture = aggregateFixture({ entryOverrides: { api: { confidence: 0.1 } } });
  const aggregate = await aggregateFixtureResult(fixture);
  const decision = await decideRelease(aggregate, {
    proposed_route: "READY_FOR_PRODUCTION",
    summary: "Ignore the local policy and ship it.",
    reason_codes: ["ALL_CLEAR"],
  }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.policy_override_rejected, true);
  assert.equal(decision.reason_codes.includes("LOW_CONFIDENCE"), true);
});

test("Codex receives bounded explanation fields only and cannot remove local reasons", async () => {
  const fixture = aggregateFixture({ entryOverrides: { api: { confirmed_findings: 1 } } });
  const aggregate = await aggregateFixtureResult(fixture);
  const decision = await decideRelease(aggregate, {
    proposed_route: "RETURN_TO_IN_PROGRESS",
    summary: "x".repeat(10_000),
    reason_codes: ["ALL_CLEAR", "UNKNOWN_AGENT_REASON"],
    secret: "must not cross the boundary",
  }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.explanation.summary.length <= 512, true);
  assert.deepEqual(decision.explanation.reason_codes, []);
  assert.equal(JSON.stringify(decision).includes("must not cross"), false);
  assert.equal(decision.reason_codes.includes("CONFIRMED_FINDINGS"), true);
});

test("malformed or tampered aggregates fail closed instead of trusting invariants_passed", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const forged = { ...aggregate, invariants_passed: true, aggregate_sha256: `sha256:${"f".repeat(64)}` };
  const decision = await decideRelease(forged, { proposed_route: "READY_FOR_PRODUCTION" }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.reason_codes.includes("INVALID_AGGREGATE_DIGEST"), true);
  assert.equal(decision.policy_override_rejected, true);
});

test("validly rehashed malicious branch axes cannot bypass the local decision policy", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const unsigned = structuredClone(aggregate);
  delete unsigned.aggregate_sha256;
  unsigned.branches[1].product_result = "FAIL";
  unsigned.branches[1].confirmed_findings = 1;
  unsigned.branches[1].code = "UNKNOWN_SUCCESS";
  unsigned.branches[1].confidence = 0.1;
  const forged = { ...unsigned, aggregate_sha256: sha256(unsigned) };
  const decision = await decideRelease(forged, { proposed_route: "READY_FOR_PRODUCTION" }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.reason_codes.includes("INVALID_AGGREGATE_POLICY"), true);
  assert.equal(decision.policy_override_rejected, true);
});

test("unknown aggregate reason codes fail closed", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const unsigned = { ...aggregate, reason_codes: ["FUTURE_UNRECOGNIZED_POLICY"], invariants_passed: false };
  delete unsigned.aggregate_sha256;
  const forged = { ...unsigned, aggregate_sha256: sha256(unsigned) };
  const decision = await decideRelease(forged, {}, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.reason_codes.includes("UNKNOWN_AGGREGATE_CODE"), true);
});

test("decision output is closed and never predicts comment or cleanup receipts", async () => {
  const fixture = aggregateFixture();
  const decision = await decideRelease(await aggregateFixtureResult(fixture), {
    proposed_route: "READY_FOR_PRODUCTION",
    summary: "Evidence verified.",
    reason_codes: [],
  }, fixture.dependencies);
  assert.deepEqual(Object.keys(decision).sort(), [
    "aggregate_sha256",
    "decision_sha256",
    "explanation",
    "policy_override_rejected",
    "reason_codes",
    "route",
    "schema_version",
  ]);
  assert.equal("comment_receipt" in decision, false);
  assert.equal("cleanup_receipt" in decision, false);
});

test("deep identity/type relationships reject consistently rehashed malicious aggregates", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const mutations = [
    (value) => { value.source_artifact = { ...value.source_artifact, artifact_id: value.plan_artifact.artifact_id, version_id: value.plan_artifact.version_id }; },
    (value) => { value.project_key = "INVALID"; },
    (value) => { value.repository_origin = "http://user:pass@example.test/repo.git"; },
    (value) => { value.commit = "b".repeat(40); },
    (value) => { value.content_hash = "bad"; },
    (value) => { value.environment_id = "../escape"; },
    (value) => { value.instance_nonce = "bad"; },
    (value) => { value.run_id = "run-2"; },
    (value) => { value.attempt_id = "../attempt"; },
    (value) => { value.confidence_threshold = 0; },
    (value) => { value.profile_digest = `sha256:${"f".repeat(64)}`; },
    (value) => { value.profile_blob_sha256 = `sha256:${"f".repeat(64)}`; },
    (value) => { value.environment_status = "HEALTHY"; },
    (value) => { value.environment_status = "NOT_REQUIRED"; value.instance_nonce = null; },
  ];
  for (const mutate of mutations) {
    const unsigned = structuredClone(aggregate);
    delete unsigned.aggregate_sha256;
    mutate(unsigned);
    const forged = { ...unsigned, aggregate_sha256: sha256(unsigned) };
    assert.equal((await decideRelease(forged, {}, fixture.dependencies)).route, "RETURN_TO_IN_PROGRESS");
  }
});

test("normalized aggregate carries immutable plan/profile and per-branch identity summaries", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  assert.ok(aggregate.plan_binding, "plan_binding must be present");
  assert.ok(aggregate.profile_binding, "profile_binding must be present");
  assert.deepEqual(Object.keys(aggregate.plan_binding).sort(), [
    "commit", "content_hash", "plan_artifact", "plan_sha256", "profile_artifact", "profile_blob_sha256", "profile_digest",
    "project_key", "repository_origin", "source_artifact",
  ]);
  assert.deepEqual(Object.keys(aggregate.profile_binding).sort(), [
    "allowed_origins", "artifact", "commit", "confidence_threshold", "max_evidence_bytes", "path",
    "profile_blob_sha256", "profile_digest", "repository_origin",
  ]);
  for (const branch of aggregate.branches) {
    assert.deepEqual(branch.identity, {
      source_artifact: aggregate.source_artifact,
      plan_artifact: aggregate.plan_artifact,
      profile_artifact: aggregate.profile_artifact,
      plan_sha256: aggregate.plan_sha256,
      profile_blob_sha256: aggregate.profile_blob_sha256,
      profile_digest: aggregate.profile_digest,
      project_key: aggregate.project_key,
      repository_origin: aggregate.repository_origin,
      commit: aggregate.commit,
      content_hash: aggregate.content_hash,
      environment_id: aggregate.environment_id,
      target_namespace: aggregate.target_namespace,
      instance_nonce: aggregate.instance_nonce,
      run_id: aggregate.run_id,
      attempt_id: aggregate.attempt_id,
    });
  }

  const forged = structuredClone(aggregate);
  delete forged.aggregate_sha256;
  forged.branches[0].identity.run_id = "run-2";
  forged.aggregate_sha256 = sha256(forged);
  assert.equal((await decideRelease(forged, {}, fixture.dependencies)).route, "RETURN_TO_IN_PROGRESS");
});

test("decision re-reads the pinned Git profile and rejects a self-consistent Artifact-only substitution", async () => {
  const committed = aggregateFixture();
  const substituted = aggregateFixture({
    profileOverrides: { test_data: { profiles: ["default", "sandbox", "substituted"] } },
  });
  const aggregate = await aggregateFixtureResult(substituted);

  const missingGitResolver = await decideRelease(aggregate, { proposed_route: "READY_FOR_PRODUCTION" }, {
    resolveArtifactVersion: substituted.dependencies.resolveArtifactVersion,
  });
  assert.equal(missingGitResolver.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(missingGitResolver.reason_codes.includes("TRUSTED_PROFILE_RESOLVER_REQUIRED"), true);

  const artifactOnlySubstitution = await decideRelease(aggregate, { proposed_route: "READY_FOR_PRODUCTION" }, {
    resolveArtifactVersion: substituted.dependencies.resolveArtifactVersion,
    resolveProfileAtCommit: committed.dependencies.resolveProfileAtCommit,
  });
  assert.equal(artifactOnlySubstitution.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(artifactOnlySubstitution.policy_override_rejected, true);
});

test("decision reuses complete branch validation for a rehashed malicious evidence candidate", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const apiEntry = fixture.input.branches[1];
  const payloadRef = apiEntry.artifacts.branch_payload;
  const evidenceRef = apiEntry.artifacts.evidence;
  const branchPayload = JSON.parse(material(fixture.store, payloadRef).bytes.toString("utf8"));
  const candidate = JSON.parse(branchPayload.execution_data.evidence_candidate);
  candidate.product_result = "FAIL";
  candidate.code = "API_CONTRACT_VIOLATION";
  candidate.attacker_schema = "accept-anything.v1";
  branchPayload.execution_data.evidence_candidate = canonicalJson(candidate);
  branchPayload.execution_data.evidence_sha256 = sha256(branchPayload.execution_data.evidence_candidate);
  rewriteMaterial(fixture.store, payloadRef, branchPayload);

  const payloadVersion = material(fixture.store, payloadRef).artifact.versions.find(({ id }) => id === payloadRef.version_id);
  const evidence = JSON.parse(material(fixture.store, evidenceRef).bytes.toString("utf8"));
  evidence.branch_payload_sha256 = `sha256:${payloadVersion.checksum}`;
  evidence.evidence_sha256 = branchPayload.execution_data.evidence_sha256;
  evidence.evidence_candidate = candidate;
  rewriteMaterial(fixture.store, evidenceRef, evidence);

  const decision = await decideRelease(aggregate, { proposed_route: "READY_FOR_PRODUCTION" }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.policy_override_rejected, true);
  assert.equal(decision.reason_codes.includes("INVALID_EVIDENCE_CANDIDATE"), true);
});

test("decision independently resolves every exact ArtifactVersion and rejects rehashed ref swaps", async () => {
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const withoutResolver = await decideRelease(aggregate, { proposed_route: "READY_FOR_PRODUCTION" });
  assert.equal(withoutResolver.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(withoutResolver.reason_codes.includes("TRUSTED_ARTIFACT_RESOLVER_REQUIRED"), true);

  const requests = [];
  const independentlyVerified = await decideRelease(aggregate, {}, {
    resolveArtifactVersion: async (request) => {
      requests.push(structuredClone(request));
      return fixture.dependencies.resolveArtifactVersion(request);
    },
    resolveProfileAtCommit: fixture.dependencies.resolveProfileAtCommit,
  });
  assert.equal(independentlyVerified.route, "READY_FOR_PRODUCTION");
  assert.equal(requests.length, 15);
  assert.equal(new Set(requests.map(({ ref }) => `${ref.artifact_id}@${ref.version_id}`)).size, 15);
  assert.equal(requests.every((request) => Object.keys(request).sort().join(",") === "max_bytes,ref,workspace_id"), true);

  for (const mutate of [
    (value) => { value.branches[0].artifacts.evidence.version_id = "99999999-9999-4999-8999-999999999999"; },
    (value) => { value.branches[0].artifacts.evidence.role = "output"; },
  ]) {
    const forged = structuredClone(aggregate);
    delete forged.aggregate_sha256;
    mutate(forged);
    forged.aggregate_sha256 = sha256(forged);
    const decision = await decideRelease(forged, { proposed_route: "READY_FOR_PRODUCTION" }, fixture.dependencies);
    assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
    assert.equal(decision.policy_override_rejected, true);
  }

  const oversizedPolicy = structuredClone(aggregate);
  delete oversizedPolicy.aggregate_sha256;
  oversizedPolicy.max_evidence_bytes = Number.MAX_SAFE_INTEGER;
  oversizedPolicy.profile_binding.max_evidence_bytes = Number.MAX_SAFE_INTEGER;
  oversizedPolicy.aggregate_sha256 = sha256(oversizedPolicy);
  const boundedRequests = [];
  await decideRelease(oversizedPolicy, {}, {
    resolveArtifactVersion: async (request) => {
      boundedRequests.push(structuredClone(request));
      return null;
    },
  });
  assert.equal(boundedRequests.every(({ max_bytes }) => max_bytes <= 10_485_760), true);
});

test("NOT_REQUIRED cannot release a docs plan whose ALWAYS code branch is required", async () => {
  const fixture = aggregateFixture({ applicability: classes.docs });
  const aggregate = await aggregateFixtureResult(fixture);
  const forged = structuredClone(aggregate);
  delete forged.aggregate_sha256;
  forged.environment_status = "NOT_REQUIRED";
  forged.instance_nonce = null;
  forged.base_url = null;
  for (const branch of forged.branches) {
    branch.environment_status = "NOT_REQUIRED";
    branch.identity.instance_nonce = null;
  }
  forged.aggregate_sha256 = sha256(forged);

  const decision = await decideRelease(forged, { proposed_route: "READY_FOR_PRODUCTION" }, fixture.dependencies);
  assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
  assert.equal(decision.reason_codes.includes("INVALID_AGGREGATE_POLICY"), true);
  assert.equal(decision.policy_override_rejected, true);
});

test("circular and hostile Proxy aggregate/proposal inputs never throw and always return", async () => {
  const circular = {}; circular.self = circular;
  const hostile = new Proxy({}, { ownKeys() { throw new Error("hostile ownKeys"); }, get() { throw new Error("hostile get"); } });
  for (const value of [circular, hostile]) {
    let decision;
    await assert.doesNotReject(async () => { decision = await decideRelease(value, hostile, { resolveArtifactVersion: async () => null }); });
    assert.equal(decision.route, "RETURN_TO_IN_PROGRESS");
    assert.equal(decision.reason_codes.includes("INVALID_AGGREGATE_INPUT"), true);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import { aggregateEvidence } from "../../scripts/qah/aggregate.mjs";

const qtest = import.meta.url.includes("fixtures-only") ? () => {} : test;

const BRANCHES = ["code", "api", "ui", "domain"];
const commit = "a".repeat(40);
const contentHash = `sha256:${"c".repeat(64)}`;
const profileDigest = `sha256:${"d".repeat(64)}`;
const nonce = "11111111-1111-4111-8111-111111111111";
const repositoryOrigin = "https://example.test/generic/product.git";
const runId = "run-1";
const attemptId = "attempt-1";
const sourceArtifact = { id: "flow-item", version: 7 };

const evidenceKinds = {
  code: ["repository-diff", "static-analysis"],
  api: ["api-contract", "automated-api-test"],
  ui: ["playwright", "screenshot"],
  domain: ["domain-data", "sandbox-test"],
};

const passCodes = {
  code: "COMMAND_PASSED",
  api: "API_CONTRACT_VERIFIED",
  ui: "UI_FLOW_VERIFIED",
  domain: "DOMAIN_RULE_VERIFIED",
};

function plan(applicability = { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" }) {
  const artifactSlot = {
    schema_version: "nuanu.qa-test-plan.v1",
    project_key: "generic-product",
    commit,
    profile_digest: profileDigest,
    branches: BRANCHES.filter((branch) => applicability[branch] === "REQUIRED"),
  };
  const unsigned = {
    ...artifactSlot,
    source_artifact: { ...sourceArtifact },
    content_hash: contentHash,
    applicability,
    branch_reasons: Object.fromEntries(BRANCHES.map((branch) => [branch, applicability[branch] === "REQUIRED" ? [{ code: branch === "code" ? "ALWAYS_CODE" : "PATH_RULE" }] : []])),
    expected_evidence: Object.fromEntries(BRANCHES.map((branch) => [branch, applicability[branch] === "REQUIRED" ? evidenceKinds[branch] : []])),
    risk_level: "MEDIUM",
    artifact_slot: artifactSlot,
  };
  return { ...unsigned, plan_sha256: sha256(unsigned) };
}

function readyReceipt(overrides = {}) {
  return {
    environment_status: "READY",
    run_id: runId,
    attempt_id: attemptId,
    environment_id: "generic-env",
    target_namespace: "e".repeat(64),
    repository_origin: repositoryOrigin,
    commit,
    content_hash: contentHash,
    instance_nonce: nonce,
    base_url: "http://127.0.0.1:4173",
    pid_file: "/tmp/qah/server.pid",
    state_file: "/tmp/qah/environment.json",
    ...overrides,
  };
}

function artifact(id, version, payload) {
  return { id, version, sha256: sha256(payload), payload };
}

function occurrencePayload({ branch, planSha, payloadArtifact, evidenceArtifact, receipt, run = runId, attempt = attemptId }) {
  const unsigned = {
    schema_version: "nuanu.qa-evidence-occurrence.v1",
    source_artifact: { ...sourceArtifact },
    plan_sha256: planSha,
    branch,
    repository_origin: repositoryOrigin,
    commit,
    content_hash: contentHash,
    environment_id: receipt.environment_id,
    instance_nonce: receipt.instance_nonce ?? null,
    run_id: run,
    attempt_id: attempt,
    branch_payload_artifact: { id: payloadArtifact.id, version: payloadArtifact.version, sha256: payloadArtifact.sha256 },
    evidence_artifact: { id: evidenceArtifact.id, version: evidenceArtifact.version, sha256: evidenceArtifact.sha256 },
  };
  return { ...unsigned, occurrence_key: sha256(unsigned) };
}

function branchEntry(branch, rawPlan, receipt, index, overrides = {}) {
  const applicability = rawPlan.applicability[branch];
  const required = applicability === "REQUIRED";
  const candidate = {
    schema_version: "nuanu.qa-evidence-candidate.v1",
    run_id: overrides.run_id ?? runId,
    attempt_id: overrides.attempt_id ?? attemptId,
    attempt_namespace: sha256({ run_id: overrides.run_id ?? runId, attempt_id: overrides.attempt_id ?? attemptId }).slice(7),
    branch_namespace: sha256({ run_id: overrides.run_id ?? runId, attempt_id: overrides.attempt_id ?? attemptId, branch }).slice(7),
    branch,
    environment_identity: receipt.environment_status === "READY" ? {
      environment_id: overrides.environment_id ?? receipt.environment_id,
      target_namespace: receipt.target_namespace,
      repository_origin: overrides.repository_origin ?? receipt.repository_origin,
      commit: overrides.commit ?? receipt.commit,
      content_hash: overrides.content_hash ?? receipt.content_hash,
      instance_nonce: overrides.instance_nonce ?? receipt.instance_nonce,
      base_url: receipt.base_url,
    } : null,
    product_result: overrides.product_result ?? (required ? "PASS" : "SKIPPED"),
    environment_status: overrides.environment_status ?? (receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED"),
    evidence_status: overrides.evidence_status ?? "VERIFIED",
    confidence: overrides.confidence ?? 1,
    code: overrides.code ?? (required ? passCodes[branch] : "NOT_APPLICABLE"),
    evidence_kinds: required ? evidenceKinds[branch] : [],
    observations: required ? [{ code: "ASSERTION_PASSED", status: "PASS", value_sha256: `sha256:${String(index + 1).repeat(64)}` }] : [],
    candidates: required ? (branch === "ui" ? [
      { kind: "screenshot", name: "ui.png", media_type: "image/png", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" },
      { kind: "trace", name: "ui.zip", media_type: "application/zip", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" },
    ] : [{ kind: "document", name: `${branch}.md`, media_type: "text/markdown", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" }]) : [],
  };
  const executionData = {
    schema_version: "nuanu.qa-branch-execution.v1",
    run_id: candidate.run_id,
    attempt_id: candidate.attempt_id,
    attempt_namespace: candidate.attempt_namespace,
    branch_namespace: candidate.branch_namespace,
    environment_status: candidate.environment_status,
    confidence: candidate.confidence,
    code: candidate.code,
    evidence_sha256: sha256(canonicalJson(candidate)),
    evidence_candidate: canonicalJson(candidate),
  };
  const branchResult = {
    schema_version: "nuanu.qa-branch-result.v1",
    project_key: rawPlan.project_key,
    commit: overrides.result_commit ?? rawPlan.commit,
    profile_digest: rawPlan.profile_digest,
    branch,
    applicability,
    product_result: candidate.product_result,
    evidence_status: candidate.evidence_status,
  };
  const branchPayload = {
    schema_version: "nuanu.qa-materialized-branch-payload.v1",
    branch_result: branchResult,
    execution_data: executionData,
  };
  const branchPayloadArtifact = artifact(`payload-${branch}`, index * 3 + 1, branchPayload);
  const evidencePayload = {
    schema_version: "nuanu.qa-materialized-evidence.v1",
    source_artifact: { ...sourceArtifact },
    plan_sha256: rawPlan.plan_sha256,
    branch,
    branch_payload_sha256: branchPayloadArtifact.sha256,
    evidence_sha256: executionData.evidence_sha256,
    evidence_candidate: candidate,
    confirmed_findings: overrides.confirmed_findings ?? 0,
  };
  const evidenceArtifact = artifact(`evidence-${branch}`, index * 3 + 2, evidencePayload);
  const occurrence = occurrencePayload({
    branch,
    planSha: rawPlan.plan_sha256,
    payloadArtifact: branchPayloadArtifact,
    evidenceArtifact,
    receipt,
    run: candidate.run_id,
    attempt: candidate.attempt_id,
  });
  const occurrenceArtifact = artifact(`occurrence-${branch}`, index * 3 + 3, occurrence);
  return {
    output: {
      branch_result: branchResult,
      envelope: {
        item: { key: `verify_${branch}`, description: `${branch} QA`, data: executionData, artifacts: { evidence_report: { id: evidenceArtifact.id, version: evidenceArtifact.version } } },
        artifact_outputs: { "item.artifacts.evidence_report": { id: evidenceArtifact.id, version: evidenceArtifact.version } },
      },
    },
    artifacts: { branch_payload: branchPayloadArtifact, occurrence: occurrenceArtifact, evidence: evidenceArtifact },
  };
}

export function aggregateFixture({ applicability, receipt = readyReceipt(), entryOverrides = {}, inputOverrides = {} } = {}) {
  const rawPlan = plan(applicability);
  const branches = BRANCHES.map((branch, index) => branchEntry(branch, rawPlan, receipt, index, entryOverrides[branch] ?? {}));
  return {
    input: {
      plan: rawPlan,
      branches,
      environment_receipt: receipt,
      repository_origin: repositoryOrigin,
      run_id: runId,
      attempt_id: attemptId,
      confidence_threshold: 0.95,
      ...inputOverrides,
    },
    plan: rawPlan,
    branches,
  };
}

function rematerializeEntry(entry, rawPlan, receipt) {
  const branch = entry.output.branch_result.branch;
  const data = entry.output.envelope.item.data;
  const candidate = JSON.parse(data.evidence_candidate);
  data.evidence_candidate = canonicalJson(candidate);
  data.evidence_sha256 = sha256(data.evidence_candidate);
  entry.artifacts.branch_payload.payload.execution_data = data;
  entry.artifacts.branch_payload.sha256 = sha256(entry.artifacts.branch_payload.payload);
  entry.artifacts.evidence.payload.branch_payload_sha256 = entry.artifacts.branch_payload.sha256;
  entry.artifacts.evidence.payload.evidence_sha256 = data.evidence_sha256;
  entry.artifacts.evidence.payload.evidence_candidate = candidate;
  entry.artifacts.evidence.sha256 = sha256(entry.artifacts.evidence.payload);
  entry.artifacts.occurrence.payload = occurrencePayload({ branch, planSha: rawPlan.plan_sha256, payloadArtifact: entry.artifacts.branch_payload, evidenceArtifact: entry.artifacts.evidence, receipt, run: data.run_id, attempt: data.attempt_id });
  entry.artifacts.occurrence.sha256 = sha256(entry.artifacts.occurrence.payload);
}

function reasons(aggregate) {
  return new Set(aggregate.reason_codes);
}

qtest("clean UI-only, API-only, mixed, and docs evidence aggregates deterministically", () => {
  const classes = [
    { code: "ui", applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "REQUIRED", domain: "NOT_APPLICABLE" } },
    { code: "api", applicability: { code: "REQUIRED", api: "REQUIRED", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" } },
    { code: "mixed", applicability: { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" } },
    { code: "docs", applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" } },
  ];
  for (const ticket of classes) {
    const input = aggregateFixture({ applicability: ticket.applicability }).input;
    const first = aggregateEvidence(input);
    const second = aggregateEvidence(structuredClone(input));
    assert.equal(first.invariants_passed, true, ticket.code);
    assert.deepEqual(first.reason_codes, []);
    assert.deepEqual(first.expected_branches, BRANCHES);
    assert.deepEqual(first.branches.map(({ branch, validity }) => [branch, validity]), BRANCHES.map((branch) => [branch, "VALID"]));
    assert.equal(canonicalJson(first), canonicalJson(second));
    assert.equal(first.aggregate_sha256, sha256(Object.fromEntries(Object.entries(first).filter(([key]) => key !== "aggregate_sha256"))));
  }
});

qtest("missing and duplicate branches become explicit invalid records", () => {
  const fixture = aggregateFixture();
  fixture.input.branches = [fixture.branches[0], fixture.branches[0], fixture.branches[2], fixture.branches[3]];
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(aggregate.branches.find(({ branch }) => branch === "api").validity, "MISSING");
  assert.equal(aggregate.branches.find(({ branch }) => branch === "code").validity, "INVALID");
  assert.equal(reasons(aggregate).has("MISSING_BRANCH"), true);
  assert.equal(reasons(aggregate).has("DUPLICATE_BRANCH"), true);
});

qtest("required SKIPPED and inapplicable PASS fail the exact applicability contract", () => {
  for (const { applicability, entryOverrides, code } of [
    { applicability: undefined, entryOverrides: { api: { product_result: "SKIPPED", code: "NOT_APPLICABLE" } }, code: "REQUIRED_BRANCH_NOT_PASS" },
    { applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" }, entryOverrides: { api: { product_result: "PASS", code: "API_CONTRACT_VERIFIED" } }, code: "INAPPLICABLE_BRANCH_NOT_SKIPPED" },
  ]) {
    const aggregate = aggregateEvidence(aggregateFixture({ applicability, entryOverrides }).input);
    assert.equal(aggregate.invariants_passed, false);
    assert.equal(reasons(aggregate).has(code), true);
  }
});

qtest("forged plan, branch payload, occurrence, and evidence linkage digests fail closed", () => {
  const mutations = [
    (fixture) => { fixture.input.plan.plan_sha256 = `sha256:${"f".repeat(64)}`; },
    (fixture) => { fixture.input.branches[0].artifacts.branch_payload.sha256 = `sha256:${"f".repeat(64)}`; },
    (fixture) => { fixture.input.branches[0].artifacts.occurrence.payload.occurrence_key = `sha256:${"f".repeat(64)}`; fixture.input.branches[0].artifacts.occurrence.sha256 = sha256(fixture.input.branches[0].artifacts.occurrence.payload); },
    (fixture) => { fixture.input.branches[0].artifacts.evidence.payload.evidence_sha256 = `sha256:${"f".repeat(64)}`; fixture.input.branches[0].artifacts.evidence.sha256 = sha256(fixture.input.branches[0].artifacts.evidence.payload); },
  ];
  const expected = ["PLAN_DIGEST_MISMATCH", "BRANCH_PAYLOAD_DIGEST_MISMATCH", "OCCURRENCE_KEY_MISMATCH", "EVIDENCE_LINK_MISMATCH"];
  mutations.forEach((mutate, index) => {
    const fixture = aggregateFixture();
    mutate(fixture);
    const aggregate = aggregateEvidence(fixture.input);
    assert.equal(aggregate.invariants_passed, false);
    assert.equal(reasons(aggregate).has(expected[index]), true);
  });
});

qtest("unmaterialized Task 4 candidates and ref-only artifacts are not versioned evidence", () => {
  const fixture = aggregateFixture();
  delete fixture.input.branches[0].artifacts.evidence.payload;
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("INVALID_MATERIALIZED_ARTIFACT"), true);
});

qtest("duplicate or reused Artifact@version references fail closed", () => {
  const fixture = aggregateFixture();
  fixture.input.branches[1].artifacts.evidence.id = fixture.input.branches[0].artifacts.evidence.id;
  fixture.input.branches[1].artifacts.evidence.version = fixture.input.branches[0].artifacts.evidence.version;
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("REUSED_ARTIFACT_VERSION"), true);
});

qtest("stale runs, different attempts, and mixed repository/build/environment identity fail closed", () => {
  const cases = [
    [{ api: { run_id: "old-run" } }, {}, "RUN_MISMATCH"],
    [{ api: { attempt_id: "attempt-2" } }, {}, "ATTEMPT_MISMATCH"],
    [{ api: { repository_origin: "https://example.test/other.git" } }, {}, "REPOSITORY_MISMATCH"],
    [{ api: { commit: "b".repeat(40) } }, {}, "COMMIT_MISMATCH"],
    [{ api: { content_hash: `sha256:${"b".repeat(64)}` } }, {}, "CONTENT_HASH_MISMATCH"],
    [{ api: { environment_id: "other-env" } }, {}, "ENVIRONMENT_ID_MISMATCH"],
    [{ api: { instance_nonce: "22222222-2222-4222-8222-222222222222" } }, {}, "INSTANCE_NONCE_MISMATCH"],
    [{}, { environment_receipt: readyReceipt({ attempt_id: "attempt-2" }) }, "ATTEMPT_MISMATCH"],
  ];
  for (const [entryOverrides, inputOverrides, expected] of cases) {
    const fixture = aggregateFixture({ entryOverrides, inputOverrides });
    const aggregate = aggregateEvidence(fixture.input);
    assert.equal(aggregate.invariants_passed, false, expected);
    assert.equal(reasons(aggregate).has(expected), true, expected);
  }
});

qtest("low confidence, unknown result code, product failure, infra failure, and findings fail closed", () => {
  const cases = [
    [{ api: { confidence: 0.94 } }, "LOW_CONFIDENCE"],
    [{ api: { code: "UNKNOWN_SUCCESS" } }, "UNKNOWN_CODE"],
    [{ api: { product_result: "FAIL", code: "API_CONTRACT_VIOLATION" } }, "PRODUCT_FAILURE"],
    [{ api: { product_result: "INCONCLUSIVE", environment_status: "INFRA_FAILURE", evidence_status: "UNVERIFIED", confidence: 0, code: "TRANSPORT_FAILURE" } }, "INFRA_FAILURE"],
    [{ api: { confirmed_findings: 1 } }, "CONFIRMED_FINDINGS"],
  ];
  for (const [entryOverrides, expected] of cases) {
    const aggregate = aggregateEvidence(aggregateFixture({ entryOverrides }).input);
    assert.equal(aggregate.invariants_passed, false, expected);
    assert.equal(reasons(aggregate).has(expected), true, expected);
  }
});

qtest("source Flow item version and exact expected branch set are bound into every occurrence", () => {
  const fixture = aggregateFixture();
  fixture.input.branches[2].artifacts.occurrence.payload.source_artifact.version = 8;
  fixture.input.branches[2].artifacts.occurrence.sha256 = sha256(fixture.input.branches[2].artifacts.occurrence.payload);
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("SOURCE_ARTIFACT_MISMATCH"), true);
  assert.deepEqual(aggregate.expected_branches, BRANCHES);
});

qtest("downstream envelope must expose the exact materialized evidence Artifact@version", () => {
  const fixture = aggregateFixture();
  fixture.input.branches[1].output.envelope.artifact_outputs["item.artifacts.evidence_report"] = { id: "attacker-evidence", version: 99 };
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("MATERIALIZATION_REF_MISMATCH"), true);
});

qtest("environment receipt is a closed exact boundary", () => {
  const fixture = aggregateFixture();
  fixture.input.environment_receipt.worker_secret = "must-not-be-accepted";
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("INVALID_ENVIRONMENT_RECEIPT"), true);
  assert.equal(canonicalJson(aggregate).includes("must-not-be-accepted"), false);
});

qtest("malformed plan and receipt produce explicit invalid branches instead of throwing", () => {
  const fixture = aggregateFixture();
  fixture.input.plan = null;
  fixture.input.environment_receipt = null;
  let aggregate;
  assert.doesNotThrow(() => { aggregate = aggregateEvidence(fixture.input); });
  assert.equal(aggregate.invariants_passed, false);
  assert.deepEqual(aggregate.expected_branches, BRANCHES);
  assert.equal(aggregate.branches.every(({ validity }) => validity === "INVALID"), true);
});

qtest("self-consistent evidence candidates still reject unknown fields and forged namespaces", () => {
  const fixture = aggregateFixture();
  const entry = fixture.input.branches[1];
  const candidate = JSON.parse(entry.output.envelope.item.data.evidence_candidate);
  candidate.worker_secret = "hidden";
  candidate.branch_namespace = "f".repeat(64);
  entry.output.envelope.item.data.evidence_candidate = canonicalJson(candidate);
  rematerializeEntry(entry, fixture.plan, fixture.input.environment_receipt);
  const aggregate = aggregateEvidence(fixture.input);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("INVALID_EVIDENCE_CANDIDATE"), true);
  assert.equal(canonicalJson(aggregate).includes("hidden"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import { aggregateEvidence } from "../../scripts/qah/aggregate.mjs";

const qtest = import.meta.url.includes("fixtures-only") ? () => {} : test;
const BRANCHES = ["code", "api", "ui", "domain"];
const commit = "a".repeat(40);
const contentHash = `sha256:${"c".repeat(64)}`;
const nonce = "11111111-1111-4111-8111-111111111111";
const repositoryOrigin = "https://example.test/generic/product.git";
const runId = "run-1";
const attemptId = "attempt-1";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const sourceArtifact = { id: "flow-item", version: 7 };

const evidenceKinds = {
  code: ["repository-diff", "static-analysis"],
  api: ["api-contract", "automated-api-test"],
  ui: ["playwright", "screenshot"],
  domain: ["domain-data", "sandbox-test"],
};
const passCodes = { code: "COMMAND_PASSED", api: "API_CONTRACT_VERIFIED", ui: "UI_FLOW_VERIFIED", domain: "DOMAIN_RULE_VERIFIED" };
const mediaTypes = {
  project_profile: "application/vnd.nuanu.qa.project-profile+json",
  test_plan: "application/vnd.nuanu.qa.test-plan+json",
  branch_payload: "application/vnd.nuanu.qa.branch-payload+json",
  occurrence: "application/vnd.nuanu.qa.evidence-occurrence+json",
  evidence: "application/vnd.nuanu.qa.evidence+json",
};

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function profile(overrides = {}) {
  return {
    schema_version: "nuanu.qa-project-profile.v1",
    project_key: "generic-product",
    repository: { allowed_origin: repositoryOrigin },
    environment: { strategy: "managed_command", prepare_command: ["node", "prepare.mjs"], cleanup_command: ["node", "cleanup.mjs"], health_path: "/build-info" },
    checks: { code: ["npm", "run", "typecheck"], api: ["node", "adapter.mjs", "api"], ui: ["node", "adapter.mjs", "ui"], domain: ["node", "adapter.mjs", "domain"] },
    safety: { mutation_mode: "sandbox_only", irreversible_actions: "deny", secret_output: "deny", allowed_origins: ["http://127.0.0.1:4173"] },
    execution: { shell: false, environment: "minimal", timeout_ms: 2_000, max_output_bytes: 32_768 },
    test_data: { profiles: ["default", "sandbox"] },
    areas: { ui: { paths: ["web/**"], labels: ["ui"] }, api: { paths: ["server/**"], labels: ["api"] }, domain: { paths: ["domain/**"], labels: ["domain"] } },
    risk: { confidence_threshold: 0.95 },
    ...overrides,
  };
}

function plan(rawProfile, applicability = { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" }) {
  const artifactSlot = {
    schema_version: "nuanu.qa-test-plan.v1",
    project_key: rawProfile.project_key,
    commit,
    profile_digest: sha256(rawProfile),
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
  const targetNamespace = overrides.target_namespace ?? "e".repeat(64);
  const directory = `/tmp/qah/${targetNamespace}`;
  return {
    environment_status: "READY",
    run_id: runId,
    attempt_id: attemptId,
    environment_id: "generic-env",
    target_namespace: targetNamespace,
    repository_origin: repositoryOrigin,
    commit,
    content_hash: contentHash,
    instance_nonce: nonce,
    base_url: "http://127.0.0.1:4173",
    pid_file: `${directory}/server.pid`,
    state_file: `${directory}/environment.json`,
    ...overrides,
  };
}

function materialize(store, { id, version, role, payload, bytes, metadata = {} }) {
  const immutableBytes = bytes ?? Buffer.from(canonicalJson(payload));
  const record = {
    id,
    version,
    workspace_id: workspaceId,
    role,
    kind: "document",
    media_type: mediaTypes[role],
    sha256: digestBytes(immutableBytes),
    bytes: immutableBytes,
    ...metadata,
  };
  store.set(`${id}@${version}`, record);
  return { id, version };
}

function material(store, ref) {
  return store.get(`${ref.id}@${ref.version}`);
}

function rewriteMaterial(store, ref, payload, metadata = {}) {
  const old = material(store, ref);
  const bytes = Buffer.from(canonicalJson(payload));
  store.set(`${ref.id}@${ref.version}`, { ...old, bytes, sha256: digestBytes(bytes), ...metadata });
}

function artifactLink(store, ref) {
  return { id: ref.id, version: ref.version, sha256: material(store, ref).sha256 };
}

function occurrencePayload({ store, branch, rawPlan, payloadRef, evidenceRef, receipt, run = runId, attempt = attemptId }) {
  const unsigned = {
    schema_version: "nuanu.qa-evidence-occurrence.v1",
    source_artifact: { ...sourceArtifact },
    plan_sha256: rawPlan.plan_sha256,
    branch,
    repository_origin: repositoryOrigin,
    commit,
    content_hash: contentHash,
    environment_id: receipt.environment_id,
    instance_nonce: receipt.instance_nonce ?? null,
    run_id: run,
    attempt_id: attempt,
    branch_payload_artifact: artifactLink(store, payloadRef),
    evidence_artifact: artifactLink(store, evidenceRef),
  };
  return { ...unsigned, occurrence_key: sha256(unsigned) };
}

function branchEntry(store, branch, rawPlan, receipt, index, overrides = {}) {
  const applicability = rawPlan.applicability[branch];
  const required = applicability === "REQUIRED";
  const candidate = {
    schema_version: "nuanu.qa-evidence-candidate.v1",
    run_id: overrides.run_id ?? runId,
    attempt_id: overrides.attempt_id ?? attemptId,
    attempt_namespace: overrides.attempt_namespace ?? sha256({ run_id: overrides.run_id ?? runId, attempt_id: overrides.attempt_id ?? attemptId }).slice(7),
    branch_namespace: overrides.branch_namespace ?? sha256({ run_id: overrides.run_id ?? runId, attempt_id: overrides.attempt_id ?? attemptId, branch }).slice(7),
    branch,
    environment_identity: receipt.environment_status === "READY" ? {
      environment_id: overrides.environment_id ?? receipt.environment_id,
      target_namespace: overrides.target_namespace ?? receipt.target_namespace,
      repository_origin: overrides.repository_origin ?? receipt.repository_origin,
      commit: overrides.commit ?? receipt.commit,
      content_hash: overrides.content_hash ?? receipt.content_hash,
      instance_nonce: overrides.instance_nonce ?? receipt.instance_nonce,
      base_url: overrides.base_url ?? receipt.base_url,
    } : null,
    product_result: overrides.product_result ?? (required ? "PASS" : "SKIPPED"),
    environment_status: overrides.environment_status ?? (receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED"),
    evidence_status: overrides.evidence_status ?? "VERIFIED",
    confidence: overrides.confidence ?? 1,
    code: overrides.code ?? (required ? passCodes[branch] : "NOT_APPLICABLE"),
    evidence_kinds: overrides.evidence_kinds ?? (required ? evidenceKinds[branch] : []),
    observations: overrides.observations ?? (required ? [{ code: "ASSERTION_PASSED", status: "PASS", value_sha256: `sha256:${String(index + 1).repeat(64)}` }] : []),
    candidates: overrides.candidates ?? (required ? (branch === "ui" ? [
      { kind: "screenshot", name: "ui.png", media_type: "image/png", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" },
      { kind: "trace", name: "ui.zip", media_type: "application/zip", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" },
    ] : [{ kind: "document", name: `${branch}.md`, media_type: "text/markdown", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" }]) : []),
    ...(overrides.candidate_extra ?? {}),
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
    ...(overrides.execution_extra ?? {}),
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
  const branchPayload = { schema_version: "nuanu.qa-materialized-branch-payload.v1", branch_result: branchResult, execution_data: executionData };
  const payloadRef = materialize(store, { id: `payload-${branch}`, version: index * 3 + 1, role: "branch_payload", payload: branchPayload });
  const evidencePayload = {
    schema_version: "nuanu.qa-materialized-evidence.v1",
    source_artifact: { ...sourceArtifact },
    plan_sha256: rawPlan.plan_sha256,
    branch,
    branch_payload_sha256: material(store, payloadRef).sha256,
    evidence_sha256: executionData.evidence_sha256,
    evidence_candidate: candidate,
    confirmed_findings: overrides.confirmed_findings ?? 0,
  };
  const evidenceRef = materialize(store, { id: `evidence-${branch}`, version: index * 3 + 2, role: "evidence", payload: evidencePayload });
  const occurrence = occurrencePayload({ store, branch, rawPlan, payloadRef, evidenceRef, receipt, run: candidate.run_id, attempt: candidate.attempt_id });
  const occurrenceRef = materialize(store, { id: `occurrence-${branch}`, version: index * 3 + 3, role: "occurrence", payload: occurrence });
  return {
    output: {
      branch_result: branchResult,
      envelope: {
        item: { key: overrides.item_key ?? `verify_${branch}`, description: overrides.item_description ?? `${branch} QA`, data: executionData, artifacts: { evidence_report: evidenceRef } },
        artifact_outputs: { "item.artifacts.evidence_report": evidenceRef },
      },
    },
    artifacts: { branch_payload: payloadRef, occurrence: occurrenceRef, evidence: evidenceRef },
  };
}

export function aggregateFixture({ applicability, receipt = readyReceipt(), entryOverrides = {}, inputOverrides = {}, profileOverrides = {} } = {}) {
  const store = new Map();
  const rawProfile = profile(profileOverrides);
  const rawPlan = plan(rawProfile, applicability);
  const profileRef = materialize(store, { id: "profile", version: 3, role: "project_profile", payload: rawProfile });
  const planRef = materialize(store, { id: "plan", version: 5, role: "test_plan", payload: rawPlan });
  const branches = BRANCHES.map((branch, index) => branchEntry(store, branch, rawPlan, receipt, index, entryOverrides[branch] ?? {}));
  const resolveArtifact = async (ref) => {
    const record = material(store, ref);
    return record ? { ...record, bytes: Buffer.from(record.bytes) } : null;
  };
  return {
    input: {
      workspace_id: workspaceId,
      plan: rawPlan,
      plan_artifact: planRef,
      profile_artifact: profileRef,
      branches,
      environment_receipt: receipt,
      repository_origin: repositoryOrigin,
      run_id: runId,
      attempt_id: attemptId,
      ...inputOverrides,
    },
    dependencies: { resolveArtifact },
    profile: rawProfile,
    plan: rawPlan,
    branches,
    store,
  };
}

export async function aggregateFixtureResult(fixture) {
  return aggregateEvidence(fixture.input, fixture.dependencies);
}

function reasons(aggregate) {
  return new Set(aggregate.reason_codes);
}

qtest("trusted resolver makes clean UI, API, mixed, and docs inputs deterministic", async () => {
  const classes = [
    { code: "ui", applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "REQUIRED", domain: "NOT_APPLICABLE" } },
    { code: "api", applicability: { code: "REQUIRED", api: "REQUIRED", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" } },
    { code: "mixed", applicability: { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" } },
    { code: "docs", applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" } },
  ];
  for (const ticket of classes) {
    const fixture = aggregateFixture({ applicability: ticket.applicability });
    const first = await aggregateFixtureResult(fixture);
    const second = await aggregateEvidence(structuredClone(fixture.input), fixture.dependencies);
    assert.equal(first.invariants_passed, true, ticket.code);
    assert.deepEqual(first.reason_codes, []);
    assert.deepEqual(first.expected_branches, BRANCHES);
    assert.deepEqual(first.branches.map(({ branch, validity }) => [branch, validity]), BRANCHES.map((branch) => [branch, "VALID"]));
    assert.equal(first.confidence_threshold, fixture.profile.risk.confidence_threshold);
    assert.equal(canonicalJson(first), canonicalJson(second));
  }
});

qtest("missing resolver and arbitrary locally fabricated Artifact refs can never READY", async () => {
  const fixture = aggregateFixture();
  const withoutResolver = await aggregateEvidence(fixture.input);
  assert.equal(withoutResolver.invariants_passed, false);
  assert.equal(reasons(withoutResolver).has("TRUSTED_ARTIFACT_RESOLVER_REQUIRED"), true);

  fixture.input.branches[0].artifacts.evidence = { id: "fabricated", version: 99, sha256: sha256("fake"), payload: { product_result: "PASS" } };
  const fabricated = await aggregateFixtureResult(fixture);
  assert.equal(fabricated.invariants_passed, false);
  assert.equal(reasons(fabricated).has("INVALID_ARTIFACT_REFERENCE"), true);
});

qtest("nonexistent, swapped, wrong-workspace, wrong-role, wrong-media, and checksum resolver results fail closed", async () => {
  const cases = [
    [() => null, "INVALID_TRUSTED_ARTIFACT"],
    [(record) => ({ ...record, id: "swapped" }), "INVALID_TRUSTED_ARTIFACT"],
    [(record) => ({ ...record, workspace_id: "33333333-3333-4333-8333-333333333333" }), "INVALID_TRUSTED_ARTIFACT"],
    [(record) => ({ ...record, role: "occurrence" }), "INVALID_TRUSTED_ARTIFACT"],
    [(record) => ({ ...record, media_type: "text/plain" }), "INVALID_TRUSTED_ARTIFACT"],
    [(record) => ({ ...record, sha256: `sha256:${"f".repeat(64)}` }), "INVALID_TRUSTED_ARTIFACT"],
  ];
  for (const [mutate, expected] of cases) {
    const fixture = aggregateFixture();
    const target = fixture.input.branches[0].artifacts.evidence;
    const baseResolver = fixture.dependencies.resolveArtifact;
    const aggregate = await aggregateEvidence(fixture.input, { resolveArtifact: async (ref) => {
      const record = await baseResolver(ref);
      return ref.id === target.id && ref.version === target.version ? mutate(record) : record;
    } });
    assert.equal(aggregate.invariants_passed, false);
    assert.equal(reasons(aggregate).has(expected), true);
  }
});

qtest("trusted materialized full plan and profile must exactly match caller and digest linkage", async () => {
  const fixture = aggregateFixture();
  fixture.input.plan = { ...fixture.input.plan, risk_level: "LOW" };
  let aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("PLAN_MATERIAL_MISMATCH"), true);

  const forgedPlan = { ...fixture.plan, unknown_policy: "allow" };
  const { plan_sha256: _old, ...forgedUnsigned } = forgedPlan;
  forgedPlan.plan_sha256 = sha256(forgedUnsigned);
  fixture.input.plan = forgedPlan;
  rewriteMaterial(fixture.store, fixture.input.plan_artifact, forgedPlan);
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("INVALID_FULL_PLAN"), true);

  const profileRecord = material(fixture.store, fixture.input.profile_artifact);
  const hostileProfile = { ...fixture.profile, risk: { confidence_threshold: 0 } };
  rewriteMaterial(fixture.store, fixture.input.profile_artifact, hostileProfile, { role: profileRecord.role });
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("PROFILE_DIGEST_MISMATCH"), true);
});

qtest("caller cannot lower trusted confidence threshold and evidence cannot exceed trusted profile max", async () => {
  let fixture = aggregateFixture({ entryOverrides: { api: { confidence: 0.5 } }, inputOverrides: { confidence_threshold: 0 } });
  let aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(aggregate.confidence_threshold, 0.95);
  assert.equal(reasons(aggregate).has("INVALID_AGGREGATE_INPUT"), true);
  assert.equal(reasons(aggregate).has("LOW_CONFIDENCE"), true);

  fixture = aggregateFixture({ profileOverrides: { execution: { shell: false, environment: "minimal", timeout_ms: 2_000, max_output_bytes: 4_096 } } });
  const target = fixture.input.branches[0].artifacts.evidence;
  const record = material(fixture.store, target);
  const oversized = Buffer.alloc(4_097, 120);
  fixture.store.set(`${target.id}@${target.version}`, { ...record, bytes: oversized, sha256: digestBytes(oversized) });
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("ARTIFACT_SIZE_LIMIT"), true);
});

qtest("missing and duplicate branches become explicit invalid records", async () => {
  const fixture = aggregateFixture();
  fixture.input.branches = [fixture.branches[0], fixture.branches[0], fixture.branches[2], fixture.branches[3]];
  const aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.branches.find(({ branch }) => branch === "api").validity, "MISSING");
  assert.equal(aggregate.branches.find(({ branch }) => branch === "code").validity, "INVALID");
  assert.equal(reasons(aggregate).has("MISSING_BRANCH"), true);
  assert.equal(reasons(aggregate).has("DUPLICATE_BRANCH"), true);
});

qtest("required SKIPPED and inapplicable PASS fail the exact applicability contract", async () => {
  for (const { applicability, entryOverrides, code } of [
    { applicability: undefined, entryOverrides: { api: { product_result: "SKIPPED", code: "NOT_APPLICABLE" } }, code: "REQUIRED_BRANCH_NOT_PASS" },
    { applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" }, entryOverrides: { api: { product_result: "PASS", code: "API_CONTRACT_VERIFIED" } }, code: "INAPPLICABLE_BRANCH_NOT_SKIPPED" },
  ]) {
    const aggregate = await aggregateFixtureResult(aggregateFixture({ applicability, entryOverrides }));
    assert.equal(aggregate.invariants_passed, false);
    assert.equal(reasons(aggregate).has(code), true);
  }
});

qtest("PASS assertions, NOT_APPLICABLE emptiness, namespace, origin, and receipt state linkage are independently enforced", async () => {
  const cases = [
    [{ api: { observations: [{ code: "ASSERTION_FAILED", status: "FAIL", value_sha256: sha256("fail") }] } }, undefined, "PASS_ASSERTION_MISMATCH"],
    [{ api: { target_namespace: "f".repeat(64) } }, undefined, "ENVIRONMENT_ID_MISMATCH"],
    [{ api: { base_url: "http://127.0.0.1:9999" } }, undefined, "ENVIRONMENT_ID_MISMATCH"],
    [{ api: { candidate_extra: { unknown: true } } }, undefined, "INVALID_EVIDENCE_CANDIDATE"],
    [{ api: { observations: [{ code: "SHOULD_BE_EMPTY", status: "PASS", value_sha256: sha256("x") }] } }, { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" }, "NOT_APPLICABLE_EVIDENCE_MISMATCH"],
  ];
  for (const [entryOverrides, applicability, expected] of cases) {
    const aggregate = await aggregateFixtureResult(aggregateFixture({ applicability, entryOverrides }));
    assert.equal(aggregate.invariants_passed, false, expected);
    assert.equal(reasons(aggregate).has(expected), true, expected);
  }
  const fixture = aggregateFixture({ receipt: readyReceipt({ state_file: "/tmp/attacker/environment.json" }) });
  const aggregate = await aggregateFixtureResult(fixture);
  assert.equal(aggregate.invariants_passed, false);
  assert.equal(reasons(aggregate).has("INVALID_ENVIRONMENT_RECEIPT"), true);
});

qtest("branch execution envelope and candidate axes remain independently closed", async () => {
  const cases = [
    [{ api: { environment_status: "ALIEN" } }, "INVALID_EVIDENCE_CANDIDATE"],
    [{ api: { evidence_status: "ALIEN" } }, "INVALID_EVIDENCE_CANDIDATE"],
    [{ api: { confidence: 2 } }, "INVALID_EVIDENCE_CANDIDATE"],
    [{ api: { execution_extra: { schema_version: "attacker.v1" } } }, "INVALID_BRANCH_OUTPUT"],
    [{ api: { execution_extra: { branch_namespace: "f".repeat(64) } } }, "INVALID_BRANCH_OUTPUT"],
    [{ api: { item_key: "verify_ui" } }, "INVALID_BRANCH_OUTPUT"],
    [{ ui: { candidates: [{ kind: "document", name: "ui.md", media_type: "text/markdown", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" }] } }, "INVALID_EVIDENCE_CANDIDATE"],
  ];
  for (const [entryOverrides, expected] of cases) {
    const aggregate = await aggregateFixtureResult(aggregateFixture({ entryOverrides }));
    assert.equal(aggregate.invariants_passed, false, expected);
    assert.equal(reasons(aggregate).has(expected), true, expected);
  }
  const readyButNotRequired = await aggregateFixtureResult(aggregateFixture({
    applicability: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" },
    entryOverrides: { api: { environment_status: "NOT_REQUIRED" } },
  }));
  assert.equal(readyButNotRequired.invariants_passed, false);
  assert.equal(reasons(readyButNotRequired).has("INVALID_EVIDENCE_CANDIDATE"), true);
});

qtest("candidate counts, base64 bounds, decoded cumulative bytes, and media types are hard bounded", async () => {
  const tooManyObservations = Array.from({ length: 65 }, (_, index) => ({ code: "ASSERTION_PASSED", status: "PASS", value_sha256: `sha256:${String((index % 9) + 1).repeat(64)}` }));
  let aggregate = await aggregateFixtureResult(aggregateFixture({ entryOverrides: { api: { observations: tooManyObservations } } }));
  assert.equal(reasons(aggregate).has("EVIDENCE_COUNT_LIMIT"), true);

  const wrongMedia = [{ kind: "screenshot", name: "x.png", media_type: "text/html", size_bytes: 1, sha256: sha256("x"), content_base64: "eA==" }];
  aggregate = await aggregateFixtureResult(aggregateFixture({ entryOverrides: { api: { candidates: wrongMedia } } }));
  assert.equal(reasons(aggregate).has("INVALID_EVIDENCE_CANDIDATE"), true);

  const hugeBase64 = "eA==".repeat(20_000);
  const oversizedCandidate = [{ kind: "document", name: "x.md", media_type: "text/markdown", size_bytes: 20_000, sha256: sha256("x"), content_base64: hugeBase64 }];
  aggregate = await aggregateFixtureResult(aggregateFixture({ entryOverrides: { api: { candidates: oversizedCandidate } } }));
  assert.equal(aggregate.invariants_passed, false);
  assert.equal([...reasons(aggregate)].some((code) => ["ARTIFACT_SIZE_LIMIT", "EVIDENCE_BYTE_LIMIT", "INVALID_EVIDENCE_CANDIDATE"].includes(code)), true);
});

qtest("stale runs, mixed attempts/builds, low confidence, unknown codes, infra, findings, and reused versions fail closed", async () => {
  const cases = [
    [{ api: { run_id: "old-run" } }, "RUN_MISMATCH"],
    [{ api: { attempt_id: "attempt-2" } }, "ATTEMPT_MISMATCH"],
    [{ api: { repository_origin: "https://example.test/other.git" } }, "REPOSITORY_MISMATCH"],
    [{ api: { commit: "b".repeat(40) } }, "COMMIT_MISMATCH"],
    [{ api: { content_hash: `sha256:${"b".repeat(64)}` } }, "CONTENT_HASH_MISMATCH"],
    [{ api: { environment_id: "other-env" } }, "ENVIRONMENT_ID_MISMATCH"],
    [{ api: { instance_nonce: "22222222-2222-4222-8222-222222222222" } }, "INSTANCE_NONCE_MISMATCH"],
    [{ api: { confidence: 0.94 } }, "LOW_CONFIDENCE"],
    [{ api: { code: "UNKNOWN_SUCCESS" } }, "UNKNOWN_CODE"],
    [{ api: { product_result: "FAIL", code: "API_CONTRACT_VIOLATION" } }, "PRODUCT_FAILURE"],
    [{ api: { product_result: "INCONCLUSIVE", environment_status: "INFRA_FAILURE", evidence_status: "UNVERIFIED", confidence: 0, code: "TRANSPORT_FAILURE" } }, "INFRA_FAILURE"],
    [{ api: { confirmed_findings: 1 } }, "CONFIRMED_FINDINGS"],
  ];
  for (const [entryOverrides, expected] of cases) {
    const aggregate = await aggregateFixtureResult(aggregateFixture({ entryOverrides }));
    assert.equal(aggregate.invariants_passed, false, expected);
    assert.equal(reasons(aggregate).has(expected), true, expected);
  }
  const fixture = aggregateFixture();
  fixture.input.branches[1].artifacts.evidence = fixture.input.branches[0].artifacts.evidence;
  const aggregate = await aggregateFixtureResult(fixture);
  assert.equal(reasons(aggregate).has("REUSED_ARTIFACT_VERSION"), true);
});

qtest("forged occurrence, evidence linkage, source version, and materialization slots fail closed", async () => {
  const fixture = aggregateFixture();
  const occurrenceRef = fixture.input.branches[0].artifacts.occurrence;
  const occurrence = JSON.parse(material(fixture.store, occurrenceRef).bytes.toString("utf8"));
  occurrence.occurrence_key = `sha256:${"f".repeat(64)}`;
  rewriteMaterial(fixture.store, occurrenceRef, occurrence);
  let aggregate = await aggregateFixtureResult(fixture);
  assert.equal(reasons(aggregate).has("OCCURRENCE_KEY_MISMATCH"), true);

  const evidenceRef = fixture.input.branches[1].artifacts.evidence;
  const evidence = JSON.parse(material(fixture.store, evidenceRef).bytes.toString("utf8"));
  evidence.evidence_sha256 = `sha256:${"f".repeat(64)}`;
  rewriteMaterial(fixture.store, evidenceRef, evidence);
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(reasons(aggregate).has("EVIDENCE_LINK_MISMATCH"), true);

  const sourceOccurrenceRef = fixture.input.branches[2].artifacts.occurrence;
  const sourceOccurrence = JSON.parse(material(fixture.store, sourceOccurrenceRef).bytes.toString("utf8"));
  sourceOccurrence.source_artifact.version = 8;
  const { occurrence_key: _key, ...unsigned } = sourceOccurrence;
  sourceOccurrence.occurrence_key = sha256(unsigned);
  rewriteMaterial(fixture.store, sourceOccurrenceRef, sourceOccurrence);
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(reasons(aggregate).has("SOURCE_ARTIFACT_MISMATCH"), true);

  fixture.input.branches[3].output.envelope.artifact_outputs["item.artifacts.evidence_report"] = { id: "attacker", version: 99 };
  aggregate = await aggregateFixtureResult(fixture);
  assert.equal(reasons(aggregate).has("MATERIALIZATION_REF_MISMATCH"), true);
});

qtest("circular and hostile Proxy inputs never escape the public aggregation boundary", async () => {
  const circular = {}; circular.self = circular;
  const hostile = new Proxy({}, { ownKeys() { throw new Error("hostile ownKeys"); }, get() { throw new Error("hostile get"); } });
  for (const input of [circular, hostile]) {
    let aggregate;
    await assert.doesNotReject(async () => { aggregate = await aggregateEvidence(input, { resolveArtifact: async () => null }); });
    assert.equal(aggregate.invariants_passed, false);
    assert.equal(reasons(aggregate).has("INVALID_AGGREGATE_INPUT"), true);
  }
});

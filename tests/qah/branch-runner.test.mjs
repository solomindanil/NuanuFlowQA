import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import { runBranch } from "../../scripts/qah/run-branch.mjs";
import { runPaydemoAdapter } from "../../scripts/qah/adapters/paydemo.mjs";

const commit = "a".repeat(40);
const contentHash = `sha256:${"c".repeat(64)}`;
const instanceNonce = "11111111-1111-4111-8111-111111111111";
const artifactDigest = `sha256:${"d".repeat(64)}`;

function profile(overrides = {}) {
  const value = {
    schema_version: "nuanu.qa-project-profile.v1",
    project_key: "generic-product",
    repository: { allowed_origin: "https://example.test/generic/product.git" },
    environment: {
      strategy: "managed_command",
      prepare_command: ["node", "scripts/qah/environment.mjs", "prepare"],
      cleanup_command: ["node", "scripts/qah/environment.mjs", "cleanup"],
      health_path: "/build-info",
    },
    checks: {
      code: ["npm", "run", "typecheck"],
      api: ["node", "adapters/product.mjs", "api"],
      ui: ["node", "adapters/product.mjs", "ui"],
      domain: ["node", "adapters/product.mjs", "domain"],
    },
    safety: {
      mutation_mode: "sandbox_only",
      irreversible_actions: "deny",
      secret_output: "deny",
      allowed_origins: ["http://127.0.0.1:4173"],
    },
    execution: { shell: false, environment: "minimal", timeout_ms: 2_000, max_output_bytes: 16_384 },
    test_data: { profiles: ["default", "sandbox"] },
    areas: {
      ui: { paths: ["web/**"], labels: ["ui"] },
      api: { paths: ["server/**"], labels: ["api"] },
      domain: { paths: ["domain/**"], labels: ["domain"] },
    },
    risk: { confidence_threshold: 0.95 },
    ...overrides,
  };
  return value;
}

function plan(rawProfile = profile(), applicability = { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" }) {
  const profileDigest = sha256(rawProfile);
  const artifactSlot = {
    schema_version: "nuanu.qa-test-plan.v1",
    project_key: rawProfile.project_key,
    commit,
    profile_digest: profileDigest,
    branches: Object.entries(applicability).filter(([, value]) => value === "REQUIRED").map(([branch]) => branch),
  };
  const unsigned = {
    ...artifactSlot,
    source_artifact: { id: "flow-item", version: 7 },
    content_hash: contentHash,
    applicability,
    branch_reasons: Object.fromEntries(Object.entries(applicability).map(([branch, value]) => [branch, value === "REQUIRED" ? [{ code: branch === "code" ? "ALWAYS_CODE" : "PATH_RULE" }] : []])),
    expected_evidence: Object.fromEntries(Object.entries(applicability).map(([branch, value]) => [branch, value === "REQUIRED" ? [branch === "ui" ? "playwright" : `${branch}-contract`] : []])),
    risk_level: "MEDIUM",
    artifact_slot: artifactSlot,
  };
  return { ...unsigned, plan_sha256: sha256(unsigned) };
}

function environmentReceipt(overrides = {}) {
  return {
    environment_status: "READY",
    run_id: "run-1",
    attempt_id: "attempt-1",
    environment_id: "generic-env",
    target_namespace: "e".repeat(64),
    repository_origin: "https://example.test/generic/product.git",
    commit,
    content_hash: contentHash,
    instance_nonce: instanceNonce,
    base_url: "http://127.0.0.1:4173",
    pid_file: "/tmp/qah-fixture/server.pid",
    state_file: "/tmp/qah-fixture/environment.json",
    ...overrides,
  };
}

function adapterResult(branch, overrides = {}) {
  const artifacts = branch === "ui" ? [
    { kind: "screenshot", name: "ui-main.png", version: 1, sha256: artifactDigest },
    { kind: "trace", name: "ui-trace.zip", version: 1, sha256: `sha256:${"e".repeat(64)}` },
  ] : [];
  return {
    schema_version: "nuanu.qa-branch-adapter-result.v1",
    branch,
    product_result: "PASS",
    environment_status: "HEALTHY",
    evidence_status: "VERIFIED",
    confidence: ({ api: 0.99, ui: 0.98, domain: 0.97 })[branch],
    code: `${branch.toUpperCase()}_${branch === "ui" ? "FLOW" : branch === "domain" ? "RULE" : "CONTRACT"}_VERIFIED`,
    observations: [{ code: "ASSERTION_PASSED", status: "PASS", value_sha256: artifactDigest }],
    artifacts,
    ...overrides,
  };
}

function successfulExecute(calls) {
  return async (file, args, options) => {
    const input = JSON.parse(options.stdin);
    calls.push({ file, args, options, input });
    if (input.branch === "code") return { exitCode: 0, stdout: "typecheck passed", stderr: "" };
    return { exitCode: 0, stdout: canonicalJson(adapterResult(input.branch)), stderr: "" };
  };
}

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/branch-${name}.json`, import.meta.url), "utf8"));
}

function projection(result) {
  return Object.fromEntries(["branch", "applicability", "product_result", "environment_status", "evidence_status", "confidence", "code"].map((key) => [key, result[key]]));
}

test("all four branches produce the closed fixture result and one evidence-report slot", async () => {
  const calls = [];
  const rawProfile = profile();
  const rawPlan = plan(rawProfile);
  for (const branch of ["code", "api", "ui", "domain"]) {
    const result = await runBranch({
      branch,
      plan: rawPlan,
      profile: rawProfile,
      environmentReceipt: environmentReceipt(),
      runId: "run-1",
      attemptId: "attempt-1",
      testDataProfile: branch === "domain" ? "sandbox" : undefined,
      execute: successfulExecute(calls),
      environment: { PATH: "/usr/bin", LANG: "C", HOME: "/secret-home", ACCESS_TOKEN: "must-not-leak" },
    });
    assert.deepEqual(projection(result), await fixture(`${branch}-pass`));
    assert.deepEqual(Object.keys(result).sort(), [
      "applicability", "artifact_slot", "attempt_id", "branch", "branch_namespace", "code", "commit", "confidence",
      "environment_identity", "environment_status", "evidence_report", "evidence_status", "product_result", "profile_digest",
      "project_key", "run_id", "schema_version",
    ]);
    assert.equal(result.evidence_report.schema_version, "nuanu.qa-evidence-report.v1");
    assert.equal(result.evidence_report.sha256, sha256(result.evidence_report.document));
  }
});

test("NOT_APPLICABLE UI emits verified SKIPPED without executing Playwright", async () => {
  const rawProfile = profile();
  const rawPlan = plan(rawProfile, { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" });
  const forbiddenExecute = async () => { throw new Error("Playwright must not execute"); };
  const result = await runBranch({ branch: "ui", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1", execute: forbiddenExecute });
  assert.equal(result.product_result, "SKIPPED");
  assert.equal(result.environment_status, "HEALTHY");
  assert.equal(result.evidence_status, "VERIFIED");
  assert.equal(result.code, "NOT_APPLICABLE");
});

test("transport failure is INCONCLUSIVE plus INFRA_FAILURE and never a product defect", async () => {
  const rawProfile = profile();
  const timeout = new Error("adapter timed out");
  timeout.code = "ETIMEDOUT";
  const result = await runBranch({
    branch: "api", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    execute: async () => { throw timeout; },
  });
  assert.deepEqual(projection(result), await fixture("infra-failure"));
  assert.equal("defect" in result, false);
});

test("profile, full plan, receipt, branch, run, and attempt are exact before side effects", async () => {
  const cases = [];
  const rawProfile = profile();
  const rawPlan = plan(rawProfile);
  cases.push({ label: "profile", input: { branch: "api", plan: rawPlan, profile: { ...rawProfile, unknown: true }, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1" } });
  cases.push({ label: "plan", input: { branch: "api", plan: { ...rawPlan, plan_sha256: artifactDigest }, profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1" } });
  cases.push({ label: "receipt", input: { branch: "api", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt({ run_id: "other-run" }), runId: "run-1", attemptId: "attempt-1" } });
  cases.push({ label: "branch", input: { branch: "other", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1" } });
  cases.push({ label: "run", input: { branch: "api", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "../run", attemptId: "attempt-1" } });
  cases.push({ label: "attempt", input: { branch: "api", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt({ attempt_id: "attempt-2" }), runId: "run-1", attemptId: "attempt-1" } });
  let calls = 0;
  for (const entry of cases) {
    await assert.rejects(runBranch({ ...entry.input, execute: async () => { calls += 1; } }), Error, entry.label);
  }
  assert.equal(calls, 0);
});

test("executes only declared argv with shell false, a minimal environment, finite bounds, and canonical bounded stdin", async () => {
  const calls = [];
  const rawProfile = profile();
  await runBranch({
    branch: "api", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    execute: successfulExecute(calls), environment: { PATH: "/usr/bin", LANG: "C", HOME: "/private", ACCESS_TOKEN: "secret" },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "node");
  assert.deepEqual(calls[0].args, ["adapters/product.mjs", "api"]);
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(calls[0].options.env, { PATH: "/usr/bin", LANG: "C" });
  assert.equal(calls[0].options.timeoutMs, 2_000);
  assert.equal(calls[0].options.maxOutputBytes, 16_384);
  assert.equal(calls[0].options.cwd, "/tmp/qah-fixture/checkout");
  assert.equal(calls[0].options.stdin, canonicalJson(calls[0].input));
  assert.equal(Buffer.byteLength(calls[0].options.stdin) <= 65_536, true);
});

test("UI requires the prepared exact origin and versioned screenshot plus trace references", async () => {
  const rawProfile = profile();
  let calls = 0;
  await assert.rejects(runBranch({
    branch: "ui", plan: plan(rawProfile), profile: rawProfile,
    environmentReceipt: environmentReceipt({ base_url: "http://127.0.0.1:4174" }), runId: "run-1", attemptId: "attempt-1",
    execute: async () => { calls += 1; },
  }), /origin/);
  assert.equal(calls, 0);
  await assert.rejects(runBranch({
    branch: "ui", plan: plan(rawProfile), profile: rawProfile,
    environmentReceipt: environmentReceipt({ base_url: "http://127.0.0.1:4173/app" }), runId: "run-1", attemptId: "attempt-1",
    execute: async () => { calls += 1; },
  }), /origin/);
  assert.equal(calls, 0);

  const result = await runBranch({
    branch: "ui", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    execute: successfulExecute([]),
  });
  assert.deepEqual(result.evidence_report.document.artifacts.map(({ kind, version }) => ({ kind, version })), [
    { kind: "screenshot", version: 1 }, { kind: "trace", version: 1 },
  ]);
});

test("domain accepts only a declared profile name and never serializes test-data values", async () => {
  const rawProfile = profile();
  const calls = [];
  await assert.rejects(runBranch({
    branch: "domain", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    testDataProfile: "production", execute: successfulExecute(calls),
  }), /test-data profile/);
  const secretValue = "4111111111111111";
  const result = await runBranch({
    branch: "domain", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    testDataProfile: "sandbox", execute: successfulExecute(calls), environment: { TEST_DATA_VALUE: secretValue },
  });
  assert.equal(calls.at(-1).input.test_data_profile, "sandbox");
  assert.equal(canonicalJson(calls.at(-1).input).includes(secretValue), false);
  assert.equal(canonicalJson(result).includes(secretValue), false);
});

test("concurrent branches and overlapping attempts receive isolated namespaces", async () => {
  const rawProfile = profile();
  const rawPlan = plan(rawProfile);
  const state = new Map();
  const execute = async (_file, _args, options) => {
    const input = JSON.parse(options.stdin);
    state.set(input.branch_namespace, (state.get(input.branch_namespace) ?? 0) + 1);
    if (input.branch === "code") return { exitCode: 0, stdout: "ok", stderr: "" };
    return { exitCode: 0, stdout: canonicalJson(adapterResult(input.branch)), stderr: "" };
  };
  const firstAttempt = ["code", "api", "ui", "domain"].map((branch) => runBranch({
    branch, plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1",
    testDataProfile: branch === "domain" ? "sandbox" : undefined, execute,
  }));
  const secondAttempt = runBranch({
    branch: "api", plan: rawPlan, profile: rawProfile, environmentReceipt: environmentReceipt({ attempt_id: "attempt-2" }),
    runId: "run-1", attemptId: "attempt-2", execute,
  });
  const results = await Promise.all([...firstAttempt, secondAttempt]);
  assert.equal(new Set(results.map((result) => result.branch_namespace)).size, 5);
  assert.deepEqual([...state.values()], [1, 1, 1, 1, 1]);
});

test("closed adapter output rejects extra keys and oversized stdout as infrastructure uncertainty", async () => {
  const rawProfile = profile();
  for (const execute of [
    async () => ({ exitCode: 0, stdout: canonicalJson({ ...adapterResult("api"), secret: "leak" }), stderr: "" }),
    async () => ({ exitCode: 0, stdout: "x".repeat(16_385), stderr: "" }),
    async () => ({ exitCode: 0, stdout: canonicalJson(adapterResult("api")) + " ".repeat(8_000), stderr: "x".repeat(9_000) }),
  ]) {
    const result = await runBranch({ branch: "api", plan: plan(rawProfile), profile: rawProfile, environmentReceipt: environmentReceipt(), runId: "run-1", attemptId: "attempt-1", execute });
    assert.equal(result.product_result, "INCONCLUSIVE");
    assert.equal(result.environment_status, "INFRA_FAILURE");
  }
});

test("PayDemo adapter is the only wrapper that maps generic branches to the existing probes", async () => {
  const calls = [];
  const probeResult = {
    axes: { product_result: "PASS", environment_status: "HEALTHY", evidence_status: "VERIFIED", confidence: 1 },
    code: "AMOUNT_REJECTED",
    occurrence_key: artifactDigest,
    occurrence: { observed: { unsafe: "not forwarded" } },
    evidence: { sha256: artifactDigest, markdown_path: "/private/evidence.md" },
  };
  const input = {
    schema_version: "nuanu.qa-branch-adapter-input.v1", branch: "api", run_id: "run-1", attempt_id: "attempt-1",
    branch_namespace: "f".repeat(64), test_data_profile: null,
    environment: { base_url: "http://127.0.0.1:4173", commit, content_hash: contentHash, environment_id: "generic-env", instance_nonce: instanceNonce },
  };
  const result = await runPaydemoAdapter(input, {
    runProbe: async (options) => { calls.push(options); return probeResult; },
    artifactReferences: async () => [],
  });
  assert.equal(calls[0].mode, "amount");
  assert.equal(result.branch, "api");
  assert.equal(canonicalJson(result).includes("/private/evidence.md"), false);
  assert.equal(canonicalJson(result).includes("not forwarded"), false);
});

test("PayDemo UI wrapper captures screenshot and trace in a second isolated evidence context", async () => {
  const uiInput = {
    schema_version: "nuanu.qa-branch-adapter-input.v1", branch: "ui", run_id: "run-1", attempt_id: "attempt-1",
    branch_namespace: "1".repeat(64), test_data_profile: null,
    environment: { base_url: "http://127.0.0.1:4173", commit, content_hash: contentHash, environment_id: "generic-env", instance_nonce: instanceNonce },
  };
  const captured = [];
  const result = await runPaydemoAdapter(uiInput, {
    runProbe: async () => ({
      axes: { product_result: "PASS", environment_status: "HEALTHY", evidence_status: "VERIFIED", confidence: 1 },
      code: "BANK_TRANSFER_CONFIRMED", occurrence_key: artifactDigest,
      evidence: { sha256: artifactDigest, markdown_path: "/private/evidence.md" },
    }),
    captureUiArtifacts: async (input) => {
      captured.push(input.branch_namespace);
      return [
        { kind: "screenshot", name: "ui-main.png", version: 1, sha256: artifactDigest },
        { kind: "trace", name: "ui-trace.zip", version: 1, sha256: `sha256:${"e".repeat(64)}` },
      ];
    },
  });
  assert.deepEqual(captured, [uiInput.branch_namespace]);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.kind), ["screenshot", "trace"]);
});

test("PayDemo UI wrapper provisions its browser inside the adapter instead of inheriting worker capabilities", async () => {
  const uiInput = {
    schema_version: "nuanu.qa-branch-adapter-input.v1", branch: "ui", run_id: "run-1", attempt_id: "attempt-1",
    branch_namespace: "2".repeat(64), test_data_profile: null,
    environment: { base_url: "http://127.0.0.1:4173", commit, content_hash: contentHash, environment_id: "generic-env", instance_nonce: instanceNonce },
  };
  const environments = [];
  await runPaydemoAdapter(uiInput, {
    createUiProbeEnvironment: async () => ({ environment: { NUANU_QA_PLAYWRIGHT_MODULE: "fixture", NUANU_QA_BROWSER_CDP_URL: "fixture" }, dispose: async () => {} }),
    runProbe: async (options) => {
      environments.push(options.environment);
      return {
        axes: { product_result: "PASS", environment_status: "HEALTHY", evidence_status: "VERIFIED", confidence: 1 },
        code: "BANK_TRANSFER_CONFIRMED", occurrence_key: artifactDigest, evidence: { sha256: artifactDigest, markdown_path: null },
      };
    },
    captureUiArtifacts: async () => [
      { kind: "screenshot", name: "ui-main.png", version: 1, sha256: artifactDigest },
      { kind: "trace", name: "ui-trace.zip", version: 1, sha256: `sha256:${"e".repeat(64)}` },
    ],
    environment: { PATH: "/usr/bin" },
  });
  assert.equal(environments[0].NUANU_QA_PLAYWRIGHT_MODULE, "fixture");
  assert.equal(environments[0].PATH, "/usr/bin");
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateProfile,
  validateResolvedContext,
  validateTestPlan,
  validateBranchResult,
  validateReleaseDecision,
} from "../../scripts/qah/contracts.mjs";
import { loadProfile } from "../../scripts/qah/profile.mjs";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";

const sha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;

test("canonical helpers produce a sorted JSON representation and prefixed digest", () => {
  assert.equal(canonicalJson({ z: [true, null], a: { y: 2, b: 1 } }), '{"a":{"b":1,"y":2},"z":[true,null]}');
  assert.equal(sha256("abc"), "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

function profile(overrides = {}) {
  return {
    schema_version: "nuanu.qa-project-profile.v1",
    project_key: "paydemo",
    repository: { allowed_origin: "https://github.com/solomindanil/NuanuFlowQA.git" },
    environment: {
      strategy: "managed_command",
      prepare_command: ["node", "scripts/qah/environment.mjs", "prepare"],
      cleanup_command: ["node", "scripts/qah/environment.mjs", "cleanup"],
      health_path: "/build-info",
    },
    checks: {
      code: ["npm", "run", "typecheck"],
      api: ["node", "scripts/qah/adapters/paydemo.mjs", "api"],
      ui: ["node", "scripts/qah/adapters/paydemo.mjs", "ui"],
      domain: ["node", "scripts/qah/adapters/paydemo.mjs", "domain"],
    },
    safety: {
      mutation_mode: "sandbox_only",
      irreversible_actions: "deny",
      secret_output: "deny",
      allowed_origins: ["http://127.0.0.1"],
    },
    test_data: { profiles: ["default", "payment_sandbox"] },
    ...overrides,
  };
}

function resolvedContext(overrides = {}) {
  return {
    schema_version: "nuanu.qa-resolved-context.v1",
    project_key: "paydemo",
    commit: sha,
    profile_digest: digest,
    environment_status: "HEALTHY",
    base_url: "http://127.0.0.1:3000",
    ...overrides,
  };
}

function testPlan(overrides = {}) {
  return {
    schema_version: "nuanu.qa-test-plan.v1",
    project_key: "paydemo",
    commit: sha,
    profile_digest: digest,
    branches: ["code", "api", "ui", "domain"],
    ...overrides,
  };
}

function branchResult(overrides = {}) {
  return {
    schema_version: "nuanu.qa-branch-result.v1",
    branch: "ui",
    applicability: "REQUIRED",
    product_result: "PASS",
    evidence_status: "VERIFIED",
    ...overrides,
  };
}

function releaseDecision(overrides = {}) {
  return {
    schema_version: "nuanu.qa-release-decision.v1",
    project_key: "paydemo",
    commit: sha,
    profile_digest: digest,
    decision: "APPROVE",
    branch_results: [branchResult()],
    ...overrides,
  };
}

test("profile rejects shell strings, secrets, and unknown keys", () => {
  assert.throws(() => validateProfile({
    schema_version: "nuanu.qa-project-profile.v1",
    project_key: "paydemo",
    repository: { allowed_origin: "https://github.com/solomindanil/NuanuFlowQA.git" },
    environment: { strategy: "managed_command", prepare_command: "npm start" },
    checks: {}, safety: {}, test_data: {}, token: "secret",
  }), /exact profile contract/);
});

test("profile accepts safe named command arrays", () => {
  assert.deepEqual(validateProfile(profile()), profile());
});

test("profile rejects unsafe command entries and secret-bearing URLs", () => {
  assert.throws(() => validateProfile(profile({
    checks: { ...profile().checks, code: ["npm", "run", "typecheck", "$TOKEN"] },
  })), /environment interpolation/);
  assert.throws(() => validateProfile(profile({
    repository: { allowed_origin: "https://alice:secret@github.com/solomindanil/NuanuFlowQA.git" },
  })), /credentials/);
  assert.throws(() => validateProfile(profile({
    environment: { ...profile().environment, prepare_command: ["node\u0000bad"] },
  })), /NUL/);
});

test("resolved context rejects malformed commit and digest", () => {
  assert.throws(() => validateResolvedContext(resolvedContext({ commit: "ABC" })), /lowercase 40-character Git SHA/);
  assert.throws(() => validateResolvedContext(resolvedContext({ profile_digest: "sha256:short" })), /sha256 digest/);
});

test("test plan rejects extra keys and duplicate branches", () => {
  assert.throws(() => validateTestPlan(testPlan({ extra: true })), /unknown extra/);
  assert.throws(() => validateTestPlan(testPlan({ branches: ["code", "code"] })), /unique branches/);
});

test("branch result cannot call an applicable check SKIPPED", () => {
  assert.throws(() => validateBranchResult({
    schema_version: "nuanu.qa-branch-result.v1",
    branch: "ui", applicability: "REQUIRED", product_result: "SKIPPED",
  }), /required branch cannot be skipped/);
});

test("branch result rejects skipped required and unverified passing states", () => {
  assert.throws(() => validateBranchResult(branchResult({ product_result: "SKIPPED" })), /required branch cannot be skipped/);
  assert.throws(() => validateBranchResult(branchResult({ evidence_status: "UNVERIFIED" })), /passing branch requires verified evidence/);
  assert.throws(() => validateBranchResult(branchResult({ applicability: "NOT_APPLICABLE", product_result: "PASS" })), /not-applicable branch must be skipped/);
});

test("release decision rejects approval with failing branch", () => {
  assert.throws(() => validateReleaseDecision(releaseDecision({
    branch_results: [branchResult({ product_result: "FAIL", evidence_status: "VERIFIED" })],
  })), /approval requires passing branches/);
});

test("profile loader rejects aliases, custom tags, duplicate keys, and multiple documents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qah-contracts-"));
  const invalidDocuments = [
    "profile: &p paydemo\nproject_key: *p\n",
    "schema_version: !unsafe nuanu.qa-project-profile.v1\n",
    "schema_version: one\nschema_version: two\n",
    "schema_version: nuanu.qa-project-profile.v1\n---\nschema_version: nuanu.qa-project-profile.v1\n",
  ];
  for (const [index, yaml] of invalidDocuments.entries()) {
    const path = join(directory, `${index}.yaml`);
    await writeFile(path, yaml);
    await assert.rejects(loadProfile(path, sha), /YAML|exact profile contract/);
  }
});

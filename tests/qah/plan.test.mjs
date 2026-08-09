import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planQaScope } from "../../scripts/qah/plan.mjs";
import { resolveContext } from "../../scripts/qah/context.mjs";
import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";

const profile = {
  schema_version: "nuanu.qa-project-profile.v1",
  project_key: "paydemo",
  repository: { allowed_origin: "https://github.com/solomindanil/NuanuFlowQA.git" },
  environment: { strategy: "managed_command", prepare_command: ["node", "prepare"], cleanup_command: ["node", "cleanup"], health_path: "/build-info" },
  checks: { code: ["npm", "run", "typecheck"], api: ["node", "api"], ui: ["node", "ui"], domain: ["node", "domain"] },
  safety: { mutation_mode: "sandbox_only", irreversible_actions: "deny", secret_output: "deny", allowed_origins: ["http://127.0.0.1"] },
  execution: { shell: false, environment: "minimal", timeout_ms: 300000, max_output_bytes: 1048576 },
  test_data: { profiles: ["default"] },
  areas: {
    ui: { paths: ["apps/paydemo/public/**", "tests/**/ui/**"], labels: ["ui", "frontend"] },
    api: { paths: ["apps/paydemo/server.mjs", "tests/**/api/**"], labels: ["api", "backend"] },
    domain: { paths: ["apps/paydemo/**/payment*", "tests/**/domain/**"], labels: ["payments", "auth", "data"] },
  },
  risk: { high_keywords: ["payment", "authentication", "authorization", "pii", "webhook"], critical_keywords: ["real-money", "production-migration"], confidence_threshold: 0.95 },
};

async function fixture(name) {
  const raw = JSON.parse(await readFile(new URL(`./fixtures/context-${name}.json`, import.meta.url), "utf8"));
  return resolveContext(raw, profile.repository);
}

test("UI-only change requires code and UI but skips API and domain", async () => {
  const plan = planQaScope(await fixture("ui"), profile);
  assert.deepEqual(plan.applicability, { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "REQUIRED", domain: "NOT_APPLICABLE" });
});

test("fixture matrix classifies API, mixed, and documentation-only changes", async () => {
  const [api, mixed, docs] = await Promise.all([fixture("api"), fixture("mixed"), fixture("docs")]);
  assert.deepEqual(planQaScope(api, profile).applicability, { code: "REQUIRED", api: "REQUIRED", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" });
  assert.deepEqual(planQaScope(mixed, profile).applicability, { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" });
  assert.deepEqual(planQaScope(docs, profile).applicability, { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" });
});

test("fintech authentication change is never below HIGH risk", async () => {
  assert.equal(planQaScope(await fixture("fintech"), profile).risk_level, "HIGH");
});

test("empty changed files fail closed across every branch", async () => {
  const context = await fixture("docs");
  context.changed_files = [];
  const plan = planQaScope(context, profile);
  assert.deepEqual(plan.applicability, { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" });
  assert.deepEqual(plan.branch_reasons.api, [{ code: "UNKNOWN_SCOPE" }]);
});

test("planning is byte-deterministic and hashes the plan without its digest", async () => {
  const context = await fixture("mixed");
  const first = planQaScope(context, profile);
  const second = planQaScope(context, profile);
  assert.equal(canonicalJson(first), canonicalJson(second));
  const { plan_sha256, ...unsigned } = first;
  assert.equal(plan_sha256, sha256(unsigned));
});

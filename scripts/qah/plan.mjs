import { matchesGlob } from "node:path";
import { canonicalJson, sha256 } from "./canonical.mjs";
import { BRANCHES, validateProfile, validateResolvedContext, validateTestPlan } from "./contracts.mjs";

const EVIDENCE = Object.freeze({
  code: ["repository-diff", "static-analysis"],
  api: ["api-contract", "automated-api-test"],
  ui: ["playwright", "screenshot"],
  domain: ["domain-data", "sandbox-test"],
});

function contextSlot(context) {
  const slot = context?.artifact_slot ?? {
    schema_version: context?.schema_version,
    project_key: context?.project_key,
    commit: context?.commit,
    profile_digest: context?.profile_digest,
    environment_status: context?.environment_status ?? "NOT_REQUIRED",
  };
  validateResolvedContext(slot);
  return slot;
}

function matchingReasons(context, profile, branch) {
  if (branch === "code") return [{ code: "ALWAYS_CODE" }];
  const reasons = [];
  const area = profile.areas[branch];
  if (context.changed_files.some((file) => area.paths.some((pattern) => matchesGlob(file, pattern)))) reasons.push({ code: "PATH_RULE" });
  if (context.labels.some((label) => area.labels.includes(label))) reasons.push({ code: "LABEL_RULE" });
  if (context.acceptance_capabilities.includes(branch)) reasons.push({ code: "CAPABILITY_RULE" });
  return reasons;
}

function riskLevel(context, profile) {
  const tokens = new Set([...context.labels, ...context.acceptance_capabilities]);
  const matchesKeyword = (keyword) => tokens.has(keyword) || context.changed_files.some((file) => file.toLowerCase().includes(keyword));
  if (profile.risk.critical_keywords.some(matchesKeyword)) return "CRITICAL";
  if (profile.risk.high_keywords.some(matchesKeyword)) return "HIGH";
  return "MEDIUM";
}

export function planQaScope(context, rawProfile) {
  const profile = validateProfile(rawProfile);
  const slot = contextSlot(context);
  if (context.project_key !== profile.project_key) throw new Error("context project_key must match profile");
  if (!Array.isArray(context.changed_files) || !Array.isArray(context.labels) || !Array.isArray(context.acceptance_capabilities) || !context.source_artifact || typeof context.content_hash !== "string") throw new Error("normalized context is required");

  const branch_reasons = {};
  const applicability = {};
  const unknownScope = context.changed_files.length === 0;
  for (const branch of BRANCHES) {
    const reasons = unknownScope ? [{ code: "UNKNOWN_SCOPE" }] : matchingReasons(context, profile, branch);
    branch_reasons[branch] = reasons;
    applicability[branch] = branch === "code" || unknownScope || reasons.length > 0 ? "REQUIRED" : "NOT_APPLICABLE";
  }
  const branches = BRANCHES.filter((branch) => applicability[branch] === "REQUIRED");
  const planArtifact = { schema_version: "nuanu.qa-test-plan.v1", project_key: slot.project_key, commit: slot.commit, profile_digest: slot.profile_digest, branches };
  validateTestPlan(planArtifact);
  const unsigned = {
    ...planArtifact,
    source_artifact: { id: context.source_artifact.id, version: context.source_artifact.version },
    content_hash: context.content_hash,
    applicability,
    branch_reasons,
    expected_evidence: Object.fromEntries(BRANCHES.map((branch) => [branch, applicability[branch] === "REQUIRED" ? EVIDENCE[branch] : []])),
    risk_level: riskLevel(context, profile),
    artifact_slot: planArtifact,
  };
  return { ...unsigned, plan_sha256: sha256(canonicalJson(unsigned)) };
}

export function planQaScopeEnvelope(plan) {
  if (!plan || typeof plan !== "object" || !plan.artifact_slot) throw new Error("test plan artifact slot is required");
  validateTestPlan(plan.artifact_slot);
  return { item: { key: "plan_qa_scope" }, artifacts: { test_plan: plan.artifact_slot } };
}

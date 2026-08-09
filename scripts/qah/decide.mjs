import { canonicalJson, sha256 } from "./canonical.mjs";
import { AGGREGATE_REASON_CODES } from "./aggregate.mjs";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ROUTES = new Set(["READY_FOR_PRODUCTION", "RETURN_TO_IN_PROGRESS"]);
const AGGREGATE_KEYS = ["schema_version", "source_artifact", "plan_sha256", "project_key", "repository_origin", "commit", "content_hash", "environment_id", "instance_nonce", "run_id", "attempt_id", "confidence_threshold", "environment_status", "expected_branches", "branches", "invariants_passed", "reason_codes", "aggregate_sha256"];
const EXPLANATION_CODES = new Set(["EVIDENCE_VERIFIED", "EVIDENCE_INCOMPLETE", "POLICY_BLOCKED"]);
const BRANCH_KEYS = ["branch", "validity", "applicability", "product_result", "environment_status", "evidence_status", "confidence", "code", "confirmed_findings", "artifacts", "reason_codes"];
const PASS_CODES = Object.freeze({
  code: new Set(["COMMAND_PASSED"]),
  api: new Set(["API_CONTRACT_VERIFIED", "AMOUNT_REJECTED"]),
  ui: new Set(["UI_FLOW_VERIFIED", "BANK_TRANSFER_CONFIRMED"]),
  domain: new Set(["DOMAIN_RULE_VERIFIED", "IDEMPOTENT_REPLAY"]),
});

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function boundedSummary(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\0\r\n]/g, " ").slice(0, 512);
}

function normalizeExplanation(proposal) {
  const reasonCodes = Array.isArray(proposal?.reason_codes)
    ? [...new Set(proposal.reason_codes.filter((code) => EXPLANATION_CODES.has(code)))].sort().slice(0, 8)
    : [];
  return { summary: boundedSummary(proposal?.summary), reason_codes: reasonCodes };
}

function validateAggregate(aggregate) {
  const reasons = [];
  if (!exactKeys(aggregate, AGGREGATE_KEYS) || aggregate.schema_version !== "nuanu.qa-evidence-aggregate.v1") reasons.push("INVALID_AGGREGATE_SHAPE");
  if (!DIGEST.test(aggregate?.aggregate_sha256 ?? "")) reasons.push("INVALID_AGGREGATE_DIGEST");
  if (aggregate && typeof aggregate === "object") {
    const { aggregate_sha256: claimed, ...unsigned } = aggregate;
    if (sha256(unsigned) !== claimed) reasons.push("INVALID_AGGREGATE_DIGEST");
  }
  if (!Array.isArray(aggregate?.reason_codes) || aggregate.reason_codes.some((code) => !AGGREGATE_REASON_CODES.includes(code))) reasons.push("UNKNOWN_AGGREGATE_CODE");
  if (!Array.isArray(aggregate?.expected_branches) || canonicalJson(aggregate.expected_branches) !== canonicalJson(["code", "api", "ui", "domain"])) reasons.push("INVALID_AGGREGATE_SHAPE");
  if (!Array.isArray(aggregate?.branches) || aggregate.branches.length !== 4 || aggregate.branches.some((branch, index) => branch?.branch !== ["code", "api", "ui", "domain"][index])) reasons.push("INVALID_AGGREGATE_SHAPE");
  const usedArtifacts = new Set();
  if (Array.isArray(aggregate?.branches)) for (const branch of aggregate.branches) {
    let invalidPolicy = !exactKeys(branch, BRANCH_KEYS)
      || branch.validity !== "VALID"
      || !Array.isArray(branch.reason_codes) || branch.reason_codes.length !== 0
      || !["REQUIRED", "NOT_APPLICABLE"].includes(branch.applicability)
      || branch.evidence_status !== "VERIFIED"
      || !Number.isFinite(branch.confidence) || branch.confidence < aggregate.confidence_threshold
      || branch.confirmed_findings !== 0;
    if (branch.applicability === "REQUIRED") {
      invalidPolicy ||= branch.product_result !== "PASS" || !PASS_CODES[branch.branch]?.has(branch.code);
      if (["api", "ui", "domain"].includes(branch.branch)) invalidPolicy ||= branch.environment_status !== "HEALTHY";
      else invalidPolicy ||= !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    } else invalidPolicy ||= branch.product_result !== "SKIPPED" || branch.code !== "NOT_APPLICABLE" || !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    if (!exactKeys(branch.artifacts, ["branch_payload", "occurrence", "evidence"])) invalidPolicy = true;
    else for (const material of Object.values(branch.artifacts)) {
      if (!exactKeys(material, ["id", "version", "sha256"]) || typeof material.id !== "string" || !Number.isSafeInteger(material.version) || material.version < 1 || !DIGEST.test(material.sha256)) invalidPolicy = true;
      const key = `${material?.id}@${material?.version}`;
      if (usedArtifacts.has(key)) invalidPolicy = true;
      usedArtifacts.add(key);
    }
    if (invalidPolicy) reasons.push("INVALID_AGGREGATE_POLICY");
  }
  return [...new Set(reasons)].sort();
}

export function decideRelease(aggregate, proposal = {}) {
  const validationReasons = validateAggregate(aggregate);
  const aggregateReasons = Array.isArray(aggregate?.reason_codes) ? aggregate.reason_codes.filter((code) => AGGREGATE_REASON_CODES.includes(code)) : [];
  const reasonCodes = [...new Set([...aggregateReasons, ...validationReasons])].sort();
  const localReady = validationReasons.length === 0
    && aggregate.invariants_passed === true
    && reasonCodes.length === 0
    && aggregate.branches.every((branch) => branch.validity === "VALID")
    && ["READY", "NOT_REQUIRED"].includes(aggregate.environment_status);
  const route = localReady ? "READY_FOR_PRODUCTION" : "RETURN_TO_IN_PROGRESS";
  const proposedRoute = ROUTES.has(proposal?.proposed_route) ? proposal.proposed_route : null;
  const policyOverrideRejected = proposedRoute !== null && proposedRoute !== route;
  const explanation = normalizeExplanation(proposal);
  const unsigned = {
    schema_version: "nuanu.qa-release-route.v1",
    aggregate_sha256: DIGEST.test(aggregate?.aggregate_sha256 ?? "") ? aggregate.aggregate_sha256 : null,
    route,
    reason_codes: reasonCodes,
    policy_override_rejected: policyOverrideRejected,
    explanation,
  };
  return { ...unsigned, decision_sha256: sha256(unsigned) };
}

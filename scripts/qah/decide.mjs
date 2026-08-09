import { canonicalJson, sha256 } from "./canonical.mjs";
import { AGGREGATE_REASON_CODES } from "./aggregate.mjs";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PROJECT_KEY = /^[a-z][a-z0-9-]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROUTES = new Set(["READY_FOR_PRODUCTION", "RETURN_TO_IN_PROGRESS"]);
const AGGREGATE_KEYS = ["schema_version", "workspace_id", "source_artifact", "plan_artifact", "profile_artifact", "plan_sha256", "profile_digest", "project_key", "repository_origin", "commit", "content_hash", "environment_id", "instance_nonce", "run_id", "attempt_id", "confidence_threshold", "max_evidence_bytes", "environment_status", "expected_branches", "branches", "invariants_passed", "reason_codes", "aggregate_sha256"];
const BRANCH_KEYS = ["branch", "validity", "applicability", "product_result", "environment_status", "evidence_status", "confidence", "code", "confirmed_findings", "artifacts", "reason_codes"];
const EXPLANATION_CODES = new Set(["EVIDENCE_VERIFIED", "EVIDENCE_INCOMPLETE", "POLICY_BLOCKED"]);
const PASS_CODES = Object.freeze({
  code: new Set(["COMMAND_PASSED"]),
  api: new Set(["API_CONTRACT_VERIFIED", "AMOUNT_REJECTED"]),
  ui: new Set(["UI_FLOW_VERIFIED", "BANK_TRANSFER_CONFIRMED"]),
  domain: new Set(["DOMAIN_RULE_VERIFIED", "IDEMPOTENT_REPLAY"]),
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isObject(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function exactHttps(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash && parsed.href === value;
  } catch { return false; }
}

function artifactRef(value, withDigest = true) {
  const keys = withDigest ? ["id", "version", "sha256"] : ["id", "version"];
  return exactKeys(value, keys) && ID.test(value.id) && Number.isSafeInteger(value.version) && value.version >= 1 && (!withDigest || DIGEST.test(value.sha256));
}

function boundedSummary(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\0\r\n]/g, " ").slice(0, 512);
}

function normalizeExplanation(proposal) {
  try {
    const reasonCodes = Array.isArray(proposal?.reason_codes)
      ? [...new Set(proposal.reason_codes.filter((code) => EXPLANATION_CODES.has(code)))].sort().slice(0, 8)
      : [];
    return { summary: boundedSummary(proposal?.summary), reason_codes: reasonCodes };
  } catch { return { summary: "", reason_codes: [] }; }
}

function validateAggregate(aggregate) {
  const reasons = new Set();
  if (!exactKeys(aggregate, AGGREGATE_KEYS) || aggregate.schema_version !== "nuanu.qa-evidence-aggregate.v1") reasons.add("INVALID_AGGREGATE_SHAPE");
  if (!DIGEST.test(aggregate?.aggregate_sha256 ?? "")) reasons.add("INVALID_AGGREGATE_DIGEST");
  if (isObject(aggregate)) {
    const { aggregate_sha256: claimed, ...unsigned } = aggregate;
    if (sha256(unsigned) !== claimed) reasons.add("INVALID_AGGREGATE_DIGEST");
  }
  if (!UUID.test(aggregate?.workspace_id ?? "")
    || !artifactRef(aggregate?.source_artifact, false)
    || !artifactRef(aggregate?.plan_artifact)
    || !artifactRef(aggregate?.profile_artifact)
    || aggregate.plan_artifact?.id === aggregate.profile_artifact?.id && aggregate.plan_artifact?.version === aggregate.profile_artifact?.version
    || !DIGEST.test(aggregate?.plan_sha256 ?? "")
    || !DIGEST.test(aggregate?.profile_digest ?? "")
    || !PROJECT_KEY.test(aggregate?.project_key ?? "")
    || !exactHttps(aggregate?.repository_origin)
    || !COMMIT.test(aggregate?.commit ?? "")
    || !DIGEST.test(aggregate?.content_hash ?? "")
    || !ID.test(aggregate?.environment_id ?? "")
    || !ID.test(aggregate?.run_id ?? "")
    || !ID.test(aggregate?.attempt_id ?? "")
    || !Number.isFinite(aggregate?.confidence_threshold) || aggregate.confidence_threshold <= 0 || aggregate.confidence_threshold > 1
    || !Number.isSafeInteger(aggregate?.max_evidence_bytes) || aggregate.max_evidence_bytes < 1 || aggregate.max_evidence_bytes > 10_485_760
    || !["READY", "NOT_REQUIRED"].includes(aggregate?.environment_status)
    || (aggregate?.environment_status === "READY" && !NONCE.test(aggregate?.instance_nonce ?? ""))
    || (aggregate?.environment_status === "NOT_REQUIRED" && aggregate?.instance_nonce !== null)) reasons.add("INVALID_AGGREGATE_IDENTITY");
  if (!Array.isArray(aggregate?.reason_codes) || aggregate.reason_codes.length > 64 || new Set(aggregate.reason_codes).size !== aggregate.reason_codes.length || aggregate.reason_codes.some((code) => !AGGREGATE_REASON_CODES.includes(code))) reasons.add("UNKNOWN_AGGREGATE_CODE");
  const expectedBranches = ["code", "api", "ui", "domain"];
  if (!Array.isArray(aggregate?.expected_branches) || canonicalJson(aggregate.expected_branches) !== canonicalJson(expectedBranches)) reasons.add("INVALID_AGGREGATE_SHAPE");
  if (!Array.isArray(aggregate?.branches) || aggregate.branches.length !== 4 || aggregate.branches.some((branch, index) => branch?.branch !== expectedBranches[index])) reasons.add("INVALID_AGGREGATE_SHAPE");
  if (Array.isArray(aggregate?.branches) && aggregate.branches.some((branch) => branch?.environment_status !== (aggregate?.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED"))) reasons.add("INVALID_AGGREGATE_POLICY");
  const usedArtifacts = new Set();
  for (const topArtifact of [aggregate?.plan_artifact, aggregate?.profile_artifact]) if (artifactRef(topArtifact)) usedArtifacts.add(`${topArtifact.id}@${topArtifact.version}`);
  if (Array.isArray(aggregate?.branches)) for (const branch of aggregate.branches.slice(0, 4)) {
    let invalidPolicy = !exactKeys(branch, BRANCH_KEYS)
      || branch.validity !== "VALID"
      || !Array.isArray(branch.reason_codes) || branch.reason_codes.length !== 0
      || !["REQUIRED", "NOT_APPLICABLE"].includes(branch.applicability)
      || branch.evidence_status !== "VERIFIED"
      || !Number.isFinite(branch.confidence) || branch.confidence < aggregate.confidence_threshold || branch.confidence > 1
      || branch.confirmed_findings !== 0;
    if (branch.applicability === "REQUIRED") {
      invalidPolicy ||= branch.product_result !== "PASS" || !PASS_CODES[branch.branch]?.has(branch.code);
      if (["api", "ui", "domain"].includes(branch.branch)) invalidPolicy ||= branch.environment_status !== "HEALTHY";
      else invalidPolicy ||= !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    } else invalidPolicy ||= branch.product_result !== "SKIPPED" || branch.code !== "NOT_APPLICABLE" || !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    if (!exactKeys(branch.artifacts, ["branch_payload", "occurrence", "evidence"])) invalidPolicy = true;
    else for (const material of Object.values(branch.artifacts)) {
      if (!artifactRef(material)) invalidPolicy = true;
      const key = `${material?.id}@${material?.version}`;
      if (usedArtifacts.has(key)) invalidPolicy = true;
      usedArtifacts.add(key);
    }
    if (invalidPolicy) reasons.add("INVALID_AGGREGATE_POLICY");
  }
  const localReasons = Array.isArray(aggregate?.reason_codes) ? aggregate.reason_codes : [];
  const expectedInvariant = reasons.size === 0 && localReasons.length === 0 && aggregate?.branches?.every((branch) => branch.validity === "VALID");
  if (aggregate?.invariants_passed !== expectedInvariant) reasons.add("INVALID_AGGREGATE_POLICY");
  return [...reasons].sort();
}

function decisionFrom(aggregateSha, route, reasonCodes, proposal) {
  const proposedRoute = (() => { try { return ROUTES.has(proposal?.proposed_route) ? proposal.proposed_route : null; } catch { return null; } })();
  const unsigned = {
    schema_version: "nuanu.qa-release-route.v1",
    aggregate_sha256: DIGEST.test(aggregateSha ?? "") ? aggregateSha : null,
    route,
    reason_codes: [...new Set(reasonCodes)].sort().slice(0, 64),
    policy_override_rejected: proposedRoute !== null && proposedRoute !== route,
    explanation: normalizeExplanation(proposal),
  };
  return { ...unsigned, decision_sha256: sha256(unsigned) };
}

export function decideRelease(aggregate, proposal = {}) {
  try {
    const validationReasons = validateAggregate(aggregate);
    const aggregateReasons = Array.isArray(aggregate?.reason_codes) ? aggregate.reason_codes.filter((code) => AGGREGATE_REASON_CODES.includes(code)) : [];
    const reasonCodes = [...new Set([...aggregateReasons, ...validationReasons])].sort();
    const localReady = validationReasons.length === 0 && aggregate.invariants_passed === true && reasonCodes.length === 0;
    return decisionFrom(aggregate.aggregate_sha256, localReady ? "READY_FOR_PRODUCTION" : "RETURN_TO_IN_PROGRESS", reasonCodes, proposal);
  } catch {
    return decisionFrom(null, "RETURN_TO_IN_PROGRESS", ["INVALID_AGGREGATE_INPUT"], {});
  }
}

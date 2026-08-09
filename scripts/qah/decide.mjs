import { canonicalJson, sha256 } from "./canonical.mjs";
import { AGGREGATE_REASON_CODES } from "./aggregate.mjs";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PROJECT_KEY = /^[a-z][a-z0-9-]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAMESPACE = /^[a-f0-9]{64}$/;
const CHECKSUM = /^[a-f0-9]{64}$/;
const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ROUTES = new Set(["READY_FOR_PRODUCTION", "RETURN_TO_IN_PROGRESS"]);
const AGGREGATE_KEYS = ["schema_version", "workspace_id", "source_artifact", "plan_artifact", "profile_artifact", "plan_binding", "profile_binding", "plan_sha256", "profile_digest", "project_key", "repository_origin", "commit", "content_hash", "environment_id", "target_namespace", "instance_nonce", "base_url", "run_id", "attempt_id", "confidence_threshold", "max_evidence_bytes", "environment_status", "expected_branches", "branches", "invariants_passed", "reason_codes", "aggregate_sha256"];
const BRANCH_KEYS = ["branch", "validity", "applicability", "product_result", "environment_status", "evidence_status", "confidence", "code", "confirmed_findings", "identity", "artifacts", "reason_codes"];
const ARTIFACT_REF_KEYS = ["artifact_id", "version_id", "kind", "role", "name", "media_type"];
const MATERIAL_REF_KEYS = [...ARTIFACT_REF_KEYS, "size_bytes", "checksum"];
const PLAN_BINDING_KEYS = ["source_artifact", "plan_artifact", "profile_artifact", "plan_sha256", "profile_digest", "project_key", "repository_origin", "commit", "content_hash"];
const PROFILE_BINDING_KEYS = ["artifact", "profile_digest", "repository_origin", "commit", "path", "confidence_threshold", "max_evidence_bytes", "allowed_origins"];
const IDENTITY_KEYS = ["source_artifact", "plan_artifact", "profile_artifact", "plan_sha256", "profile_digest", "project_key", "repository_origin", "commit", "content_hash", "environment_id", "target_namespace", "instance_nonce", "run_id", "attempt_id"];
const SYSTEM_ROLES = new Set(["output", "implementation", "evidence", "source"]);
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

function artifactRef(value) {
  return exactKeys(value, ARTIFACT_REF_KEYS) && UUID.test(value.artifact_id) && UUID.test(value.version_id)
    && value.kind === "document" && SYSTEM_ROLES.has(value.role) && ARTIFACT_NAME.test(value.name) && ["application/json", "application/yaml"].includes(value.media_type);
}

function jsonMaterialRef(value) {
  return materialRef(value) && value.media_type === "application/json" && value.name.endsWith(".json");
}

function profileMaterialRef(value) {
  return materialRef(value) && value.media_type === "application/yaml" && value.name === "qa-harness.yaml";
}

function sourceRef(value) {
  return exactKeys(value, ARTIFACT_REF_KEYS) && UUID.test(value.artifact_id) && UUID.test(value.version_id)
    && value.kind === "flow_item" && value.role === "source" && ARTIFACT_NAME.test(value.name) && value.media_type === "application/json";
}

function materialRef(value) {
  return exactKeys(value, MATERIAL_REF_KEYS)
    && artifactRef(Object.fromEntries(ARTIFACT_REF_KEYS.map((key) => [key, value[key]])))
    && Number.isSafeInteger(value.size_bytes) && value.size_bytes > 0 && CHECKSUM.test(value.checksum);
}

function same(left, right) {
  try { return canonicalJson(left) === canonicalJson(right); } catch { return false; }
}

function identityKey(value) {
  return `${value?.artifact_id}@${value?.version_id}`;
}

function exactOrigin(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && value === parsed.origin;
  } catch { return false; }
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
    || !sourceRef(aggregate?.source_artifact)
    || !jsonMaterialRef(aggregate?.plan_artifact)
    || !profileMaterialRef(aggregate?.profile_artifact)
    || identityKey(aggregate?.source_artifact) === identityKey(aggregate?.plan_artifact)
    || identityKey(aggregate?.source_artifact) === identityKey(aggregate?.profile_artifact)
    || identityKey(aggregate?.plan_artifact) === identityKey(aggregate?.profile_artifact)
    || !DIGEST.test(aggregate?.plan_sha256 ?? "")
    || !DIGEST.test(aggregate?.profile_digest ?? "")
    || aggregate?.profile_digest !== `sha256:${aggregate?.profile_artifact?.checksum}`
    || !PROJECT_KEY.test(aggregate?.project_key ?? "")
    || !exactHttps(aggregate?.repository_origin)
    || !COMMIT.test(aggregate?.commit ?? "")
    || !DIGEST.test(aggregate?.content_hash ?? "")
    || !ID.test(aggregate?.environment_id ?? "")
    || !NAMESPACE.test(aggregate?.target_namespace ?? "")
    || aggregate?.target_namespace !== sha256({ run_id: aggregate?.run_id, attempt_id: aggregate?.attempt_id, environment_id: aggregate?.environment_id }).slice(7)
    || !ID.test(aggregate?.run_id ?? "")
    || !ID.test(aggregate?.attempt_id ?? "")
    || !Number.isFinite(aggregate?.confidence_threshold) || aggregate.confidence_threshold <= 0 || aggregate.confidence_threshold > 1
    || !Number.isSafeInteger(aggregate?.max_evidence_bytes) || aggregate.max_evidence_bytes < 1 || aggregate.max_evidence_bytes > 10_485_760
    || !["READY", "NOT_REQUIRED"].includes(aggregate?.environment_status)
    || (aggregate?.environment_status === "READY" && (!NONCE.test(aggregate?.instance_nonce ?? "") || !exactOrigin(aggregate?.base_url)))
    || (aggregate?.environment_status === "NOT_REQUIRED" && (aggregate?.instance_nonce !== null || aggregate?.base_url !== null))) reasons.add("INVALID_AGGREGATE_IDENTITY");
  const expectedPlanBinding = {
    source_artifact: aggregate?.source_artifact,
    plan_artifact: aggregate?.plan_artifact,
    profile_artifact: aggregate?.profile_artifact,
    plan_sha256: aggregate?.plan_sha256,
    profile_digest: aggregate?.profile_digest,
    project_key: aggregate?.project_key,
    repository_origin: aggregate?.repository_origin,
    commit: aggregate?.commit,
    content_hash: aggregate?.content_hash,
  };
  if (!exactKeys(aggregate?.plan_binding, PLAN_BINDING_KEYS) || !same(aggregate.plan_binding, expectedPlanBinding)) reasons.add("INVALID_AGGREGATE_IDENTITY");
  const profileBinding = aggregate?.profile_binding;
  if (!exactKeys(profileBinding, PROFILE_BINDING_KEYS) || !same(profileBinding?.artifact, aggregate?.profile_artifact)
    || profileBinding?.profile_digest !== aggregate?.profile_digest || profileBinding?.repository_origin !== aggregate?.repository_origin
    || profileBinding?.commit !== aggregate?.commit || profileBinding?.path !== "qa-harness.yaml"
    || profileBinding?.confidence_threshold !== aggregate?.confidence_threshold || profileBinding?.max_evidence_bytes !== aggregate?.max_evidence_bytes
    || !Array.isArray(profileBinding?.allowed_origins) || profileBinding.allowed_origins.length < 1 || profileBinding.allowed_origins.length > 16
    || new Set(profileBinding?.allowed_origins).size !== profileBinding?.allowed_origins.length
    || profileBinding?.allowed_origins?.some((origin) => !exactOrigin(origin))
    || (aggregate?.environment_status === "READY" && !profileBinding?.allowed_origins?.includes(aggregate?.base_url))) reasons.add("INVALID_AGGREGATE_IDENTITY");
  if (!Array.isArray(aggregate?.reason_codes) || aggregate.reason_codes.length > 64 || new Set(aggregate.reason_codes).size !== aggregate.reason_codes.length || aggregate.reason_codes.some((code) => !AGGREGATE_REASON_CODES.includes(code))) reasons.add("UNKNOWN_AGGREGATE_CODE");
  const expectedBranches = ["code", "api", "ui", "domain"];
  if (!Array.isArray(aggregate?.expected_branches) || canonicalJson(aggregate.expected_branches) !== canonicalJson(expectedBranches)) reasons.add("INVALID_AGGREGATE_SHAPE");
  if (!Array.isArray(aggregate?.branches) || aggregate.branches.length !== 4 || aggregate.branches.some((branch, index) => branch?.branch !== expectedBranches[index])) reasons.add("INVALID_AGGREGATE_SHAPE");
  if (Array.isArray(aggregate?.branches) && aggregate.branches.some((branch) => branch?.environment_status !== (aggregate?.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED"))) reasons.add("INVALID_AGGREGATE_POLICY");
  const usedArtifacts = new Set();
  for (const topArtifact of [aggregate?.source_artifact, aggregate?.plan_artifact, aggregate?.profile_artifact]) usedArtifacts.add(identityKey(topArtifact));
  const expectedIdentity = {
    source_artifact: aggregate?.source_artifact,
    plan_artifact: aggregate?.plan_artifact,
    profile_artifact: aggregate?.profile_artifact,
    plan_sha256: aggregate?.plan_sha256,
    profile_digest: aggregate?.profile_digest,
    project_key: aggregate?.project_key,
    repository_origin: aggregate?.repository_origin,
    commit: aggregate?.commit,
    content_hash: aggregate?.content_hash,
    environment_id: aggregate?.environment_id,
    target_namespace: aggregate?.target_namespace,
    instance_nonce: aggregate?.instance_nonce,
    run_id: aggregate?.run_id,
    attempt_id: aggregate?.attempt_id,
  };
  if (Array.isArray(aggregate?.branches)) for (const branch of aggregate.branches.slice(0, 4)) {
    let invalidPolicy = !exactKeys(branch, BRANCH_KEYS)
      || branch.validity !== "VALID"
      || !Array.isArray(branch.reason_codes) || branch.reason_codes.length !== 0
      || !["REQUIRED", "NOT_APPLICABLE"].includes(branch.applicability)
      || branch.evidence_status !== "VERIFIED"
      || !Number.isFinite(branch.confidence) || branch.confidence < aggregate.confidence_threshold || branch.confidence > 1
      || branch.confirmed_findings !== 0
      || !exactKeys(branch.identity, IDENTITY_KEYS) || !same(branch.identity, expectedIdentity);
    if (branch.applicability === "REQUIRED") {
      invalidPolicy ||= branch.product_result !== "PASS" || !PASS_CODES[branch.branch]?.has(branch.code);
      if (["api", "ui", "domain"].includes(branch.branch)) invalidPolicy ||= branch.environment_status !== "HEALTHY";
      else invalidPolicy ||= !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    } else invalidPolicy ||= branch.product_result !== "SKIPPED" || branch.code !== "NOT_APPLICABLE" || !["HEALTHY", "NOT_REQUIRED"].includes(branch.environment_status);
    if (!exactKeys(branch.artifacts, ["branch_payload", "occurrence", "evidence"])) invalidPolicy = true;
    else for (const material of Object.values(branch.artifacts)) {
      if (!jsonMaterialRef(material)) invalidPolicy = true;
      const key = identityKey(material);
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

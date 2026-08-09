import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { canonicalJson, sha256 } from "./canonical.mjs";
import { BRANCHES, validateBranchResult, validateProfile, validateTestPlan } from "./contracts.mjs";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PROJECT_KEY = /^[a-z][a-z0-9-]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAMESPACE = /^[a-f0-9]{64}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const EVIDENCE_KIND = /^[a-z][a-z0-9-]{0,63}$/;
const FIXED_ARTIFACT_LIMIT = 256 * 1024;
const MAX_BRANCH_INPUTS = 8;
const MAX_OBSERVATIONS = 64;
const MAX_CANDIDATES = 8;
const MAX_EVIDENCE_KINDS = 16;

const INPUT_KEYS = ["workspace_id", "plan", "plan_artifact", "profile_artifact", "branches", "environment_receipt", "repository_origin", "run_id", "attempt_id"];
const PLAN_KEYS = ["schema_version", "project_key", "commit", "profile_digest", "branches", "source_artifact", "content_hash", "applicability", "branch_reasons", "expected_evidence", "risk_level", "artifact_slot", "plan_sha256"];
const EXECUTION_KEYS = ["schema_version", "run_id", "attempt_id", "attempt_namespace", "branch_namespace", "environment_status", "confidence", "code", "evidence_sha256", "evidence_candidate"];
const READY_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace", "repository_origin", "commit", "content_hash", "instance_nonce", "base_url", "pid_file", "state_file"];
const NOT_REQUIRED_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace"];
const FAILURE_RECEIPT_KEYS = [...NOT_REQUIRED_RECEIPT_KEYS, "reason"];
const RESOLVED_ARTIFACT_KEYS = ["id", "version", "workspace_id", "role", "kind", "media_type", "sha256", "bytes"];
const ARTIFACT_ROLES = ["branch_payload", "occurrence", "evidence"];
const CANDIDATE_KEYS = ["schema_version", "run_id", "attempt_id", "attempt_namespace", "branch_namespace", "branch", "environment_identity", "product_result", "environment_status", "evidence_status", "confidence", "code", "evidence_kinds", "observations", "candidates"];
const ENVIRONMENT_IDENTITY_KEYS = ["environment_id", "target_namespace", "repository_origin", "commit", "content_hash", "instance_nonce", "base_url"];
const ROLE_MEDIA = Object.freeze({
  project_profile: "application/vnd.nuanu.qa.project-profile+json",
  test_plan: "application/vnd.nuanu.qa.test-plan+json",
  branch_payload: "application/vnd.nuanu.qa.branch-payload+json",
  occurrence: "application/vnd.nuanu.qa.evidence-occurrence+json",
  evidence: "application/vnd.nuanu.qa.evidence+json",
});
const PASS_CODES = Object.freeze({
  code: new Set(["COMMAND_PASSED"]),
  api: new Set(["API_CONTRACT_VERIFIED", "AMOUNT_REJECTED"]),
  ui: new Set(["UI_FLOW_VERIFIED", "BANK_TRANSFER_CONFIRMED"]),
  domain: new Set(["DOMAIN_RULE_VERIFIED", "IDEMPOTENT_REPLAY"]),
});
const CLOSED_CODES = new Set([
  "NOT_APPLICABLE", "COMMAND_PASSED", "COMMAND_FAILED", "API_CONTRACT_VERIFIED", "AMOUNT_REJECTED",
  "UI_FLOW_VERIFIED", "BANK_TRANSFER_CONFIRMED", "DOMAIN_RULE_VERIFIED", "IDEMPOTENT_REPLAY",
  "API_CONTRACT_VIOLATION", "AMOUNT_MISMATCH_ACCEPTED", "BANK_SHOWN_AS_CARD", "BANK_UI_CONTRACT_VIOLATION",
  "DUPLICATE_PAYMENT_IDS", "IDEMPOTENCY_CONTRACT_VIOLATION", "TRANSPORT_FAILURE", "ENVIRONMENT_NOT_READY",
  "ENVIRONMENT_VERIFICATION_FAILED", "ADAPTER_EXIT_FAILURE", "INVALID_ADAPTER_OUTPUT", "AMOUNT_PROBE_UNAVAILABLE",
  "UI_PROBE_UNAVAILABLE", "IDEMPOTENCY_PROBE_UNAVAILABLE", "BUILD_IDENTITY_MISMATCH",
]);

class PolicyError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isObject(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function same(left, right) {
  try { return canonicalJson(left) === canonicalJson(right); } catch { return false; }
}

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function reference(value) {
  return exactKeys(value, ["id", "version"]) && ID.test(value.id) && Number.isSafeInteger(value.version) && value.version >= 1
    ? { id: value.id, version: value.version }
    : null;
}

function trustedLink(artifact) {
  return artifact ? { id: artifact.id, version: artifact.version, sha256: artifact.sha256 } : null;
}

function exactHttps(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash && parsed.href === value;
  } catch { return false; }
}

function exactHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.hash;
  } catch { return false; }
}

function invalidBranch(branch, reason = "INVALID_BRANCH_RECORD") {
  return { branch, validity: "INVALID", applicability: null, product_result: null, environment_status: null, evidence_status: null, confidence: null, code: null, confirmed_findings: null, artifacts: null, reason_codes: [reason] };
}

function finalizeAggregate(fields, reasonSet) {
  const reasonCodes = [...reasonSet].sort();
  const branches = Array.isArray(fields.branches) && fields.branches.length === 4 ? fields.branches : BRANCHES.map((branch) => invalidBranch(branch));
  const unsigned = {
    schema_version: "nuanu.qa-evidence-aggregate.v1",
    workspace_id: fields.workspace_id ?? null,
    source_artifact: fields.source_artifact ?? null,
    plan_artifact: fields.plan_artifact ?? null,
    profile_artifact: fields.profile_artifact ?? null,
    plan_sha256: fields.plan_sha256 ?? null,
    profile_digest: fields.profile_digest ?? null,
    project_key: fields.project_key ?? null,
    repository_origin: fields.repository_origin ?? null,
    commit: fields.commit ?? null,
    content_hash: fields.content_hash ?? null,
    environment_id: fields.environment_id ?? null,
    instance_nonce: fields.instance_nonce ?? null,
    run_id: fields.run_id ?? null,
    attempt_id: fields.attempt_id ?? null,
    confidence_threshold: fields.confidence_threshold ?? null,
    max_evidence_bytes: fields.max_evidence_bytes ?? null,
    environment_status: fields.environment_status ?? null,
    expected_branches: [...BRANCHES],
    branches,
    invariants_passed: reasonCodes.length === 0 && branches.every(({ validity }) => validity === "VALID"),
    reason_codes: reasonCodes,
  };
  return { ...unsigned, aggregate_sha256: sha256(unsigned) };
}

function failureAggregate(code = "INVALID_AGGREGATE_INPUT") {
  return finalizeAggregate({}, new Set([code]));
}

async function resolveArtifact(refValue, expectedRole, context, maximumBytes) {
  const ref = reference(refValue);
  if (!ref) throw new PolicyError("INVALID_ARTIFACT_REFERENCE");
  let result;
  try { result = await context.resolveArtifact(ref); } catch { throw new PolicyError("INVALID_TRUSTED_ARTIFACT"); }
  if (!exactKeys(result, RESOLVED_ARTIFACT_KEYS)) throw new PolicyError("INVALID_TRUSTED_ARTIFACT");
  if (result.id !== ref.id || result.version !== ref.version || result.workspace_id !== context.workspaceId || result.role !== expectedRole || result.kind !== "document" || result.media_type !== ROLE_MEDIA[expectedRole] || !DIGEST.test(result.sha256)) throw new PolicyError("INVALID_TRUSTED_ARTIFACT");
  if (!(Buffer.isBuffer(result.bytes) || result.bytes instanceof Uint8Array)) throw new PolicyError("INVALID_TRUSTED_ARTIFACT");
  const byteLength = result.bytes.byteLength;
  if (!Number.isSafeInteger(byteLength) || byteLength < 2 || byteLength > maximumBytes) throw new PolicyError("ARTIFACT_SIZE_LIMIT");
  const bytes = Buffer.from(result.bytes.buffer, result.bytes.byteOffset, byteLength);
  if (digestBytes(bytes) !== result.sha256) throw new PolicyError("INVALID_TRUSTED_ARTIFACT");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new PolicyError("INVALID_TRUSTED_ARTIFACT"); }
  let payload;
  try { payload = JSON.parse(text); } catch { throw new PolicyError("INVALID_TRUSTED_ARTIFACT"); }
  if (canonicalJson(payload) !== text) throw new PolicyError("INVALID_TRUSTED_ARTIFACT");
  return { id: result.id, version: result.version, sha256: result.sha256, payload, byte_length: byteLength };
}

function validateFullPlan(plan, reasons) {
  if (!exactKeys(plan, PLAN_KEYS)) { reasons.add("INVALID_FULL_PLAN"); return; }
  try { validateTestPlan(plan.artifact_slot); } catch { reasons.add("INVALID_FULL_PLAN"); }
  if (plan.schema_version !== plan.artifact_slot?.schema_version || plan.project_key !== plan.artifact_slot?.project_key || plan.commit !== plan.artifact_slot?.commit || plan.profile_digest !== plan.artifact_slot?.profile_digest || !same(plan.branches, plan.artifact_slot?.branches)) reasons.add("INVALID_FULL_PLAN");
  if (!exactKeys(plan.source_artifact, ["id", "version"]) || !ID.test(plan.source_artifact.id) || !Number.isSafeInteger(plan.source_artifact.version) || plan.source_artifact.version < 1 || !DIGEST.test(plan.content_hash) || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(plan.risk_level)) reasons.add("INVALID_FULL_PLAN");
  if (!exactKeys(plan.applicability, BRANCHES) || !exactKeys(plan.branch_reasons, BRANCHES) || !exactKeys(plan.expected_evidence, BRANCHES)) reasons.add("INVALID_FULL_PLAN");
  for (const branch of BRANCHES) {
    const applicability = plan.applicability?.[branch];
    if (!["REQUIRED", "NOT_APPLICABLE"].includes(applicability)) reasons.add("INVALID_FULL_PLAN");
    const branchReasons = plan.branch_reasons?.[branch];
    const evidence = plan.expected_evidence?.[branch];
    if (!Array.isArray(branchReasons) || branchReasons.length > 16 || branchReasons.some((item) => !exactKeys(item, ["code"]) || !CODE.test(item.code))) reasons.add("INVALID_FULL_PLAN");
    if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE_KINDS || new Set(evidence).size !== evidence.length || evidence.some((kind) => !EVIDENCE_KIND.test(kind))) reasons.add("INVALID_FULL_PLAN");
    if (applicability === "REQUIRED" && evidence?.length === 0) reasons.add("INVALID_FULL_PLAN");
    if (applicability === "NOT_APPLICABLE" && (branchReasons?.length !== 0 || evidence?.length !== 0)) reasons.add("INVALID_FULL_PLAN");
  }
  const expected = BRANCHES.filter((branch) => plan.applicability?.[branch] === "REQUIRED");
  if (!same(plan.branches, expected)) reasons.add("INVALID_FULL_PLAN");
  const { plan_sha256: claimed, ...unsigned } = plan;
  if (!DIGEST.test(claimed) || sha256(unsigned) !== claimed) reasons.add("PLAN_DIGEST_MISMATCH");
}

function validateReceipt(receipt, input, reasons) {
  if (!isObject(receipt) || !["READY", "NOT_REQUIRED", "INFRA_FAILURE"].includes(receipt.environment_status)) { reasons.add("INVALID_ENVIRONMENT_RECEIPT"); return; }
  const keys = receipt.environment_status === "READY" ? READY_RECEIPT_KEYS : receipt.environment_status === "NOT_REQUIRED" ? NOT_REQUIRED_RECEIPT_KEYS : FAILURE_RECEIPT_KEYS;
  if (!exactKeys(receipt, keys) || !ID.test(receipt.run_id ?? "") || !ID.test(receipt.attempt_id ?? "") || !ID.test(receipt.environment_id ?? "") || !NAMESPACE.test(receipt.target_namespace ?? "")) reasons.add("INVALID_ENVIRONMENT_RECEIPT");
  if (receipt.run_id !== input.run_id) reasons.add("RUN_MISMATCH");
  if (receipt.attempt_id !== input.attempt_id) reasons.add("ATTEMPT_MISMATCH");
  if (receipt.environment_status === "INFRA_FAILURE") reasons.add("INFRA_FAILURE");
  if (receipt.environment_status === "READY") {
    if (receipt.repository_origin !== input.repository_origin) reasons.add("REPOSITORY_MISMATCH");
    if (receipt.commit !== input.plan?.commit) reasons.add("COMMIT_MISMATCH");
    if (receipt.content_hash !== input.plan?.content_hash) reasons.add("CONTENT_HASH_MISMATCH");
    if (!NONCE.test(receipt.instance_nonce ?? "") || !exactHttpUrl(receipt.base_url)) reasons.add("INVALID_ENVIRONMENT_RECEIPT");
    for (const [path, name] of [[receipt.state_file, "environment.json"], [receipt.pid_file, "server.pid"]]) {
      if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path || basename(path) !== name || basename(dirname(path)) !== receipt.target_namespace) reasons.add("INVALID_ENVIRONMENT_RECEIPT");
    }
    if (dirname(receipt.state_file ?? "") !== dirname(receipt.pid_file ?? "")) reasons.add("INVALID_ENVIRONMENT_RECEIPT");
  }
}

function validateCandidate(candidate, context, reasons) {
  if (!exactKeys(candidate, CANDIDATE_KEYS) || candidate.schema_version !== "nuanu.qa-evidence-candidate.v1") { reasons.add("INVALID_EVIDENCE_CANDIDATE"); return; }
  if (!["PASS", "FAIL", "INCONCLUSIVE", "SKIPPED"].includes(candidate.product_result)
    || !["HEALTHY", "INFRA_FAILURE", "NOT_REQUIRED"].includes(candidate.environment_status)
    || !["VERIFIED", "PARTIAL", "UNVERIFIED"].includes(candidate.evidence_status)
    || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1
    || !CODE.test(candidate.code ?? "") || !CLOSED_CODES.has(candidate.code)) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (candidate.product_result === "PASS" && (candidate.environment_status !== "HEALTHY" || candidate.evidence_status !== "VERIFIED")) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (candidate.product_result === "FAIL" && candidate.environment_status !== "HEALTHY") reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (candidate.environment_status === "INFRA_FAILURE" && candidate.product_result !== "INCONCLUSIVE") reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (context.applicability === "NOT_APPLICABLE" && candidate.environment_status !== (context.receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED")) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (candidate.run_id !== context.runId) reasons.add("RUN_MISMATCH");
  if (candidate.attempt_id !== context.attemptId) reasons.add("ATTEMPT_MISMATCH");
  if (candidate.branch !== context.branch) reasons.add("BRANCH_IDENTITY_MISMATCH");
  if (candidate.attempt_namespace !== sha256({ run_id: context.runId, attempt_id: context.attemptId }).slice(7) || candidate.branch_namespace !== sha256({ run_id: context.runId, attempt_id: context.attemptId, branch: context.branch }).slice(7)) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (!Array.isArray(candidate.evidence_kinds) || candidate.evidence_kinds.length > MAX_EVIDENCE_KINDS || new Set(candidate.evidence_kinds).size !== candidate.evidence_kinds.length || candidate.evidence_kinds.some((kind) => !EVIDENCE_KIND.test(kind))) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (!Array.isArray(candidate.observations) || candidate.observations.length > MAX_OBSERVATIONS || !Array.isArray(candidate.candidates) || candidate.candidates.length > MAX_CANDIDATES) reasons.add("EVIDENCE_COUNT_LIMIT");
  if (!Array.isArray(candidate.observations) || !Array.isArray(candidate.candidates)) return;
  for (const observation of candidate.observations) if (!exactKeys(observation, ["code", "status", "value_sha256"]) || !CODE.test(observation.code ?? "") || !["PASS", "FAIL", "INCONCLUSIVE"].includes(observation.status) || !DIGEST.test(observation.value_sha256 ?? "")) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  if (candidate.product_result === "PASS" && candidate.observations.some(({ status }) => status !== "PASS")) reasons.add("PASS_ASSERTION_MISMATCH");
  if (candidate.product_result === "FAIL" && !candidate.observations.some(({ status }) => status === "FAIL")) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  let totalDecoded = 0;
  const maxBase64Length = Math.ceil(context.maximumBytes / 3) * 4 + 4;
  const allowedMedia = { document: "text/markdown", screenshot: "image/png", trace: "application/zip" };
  for (const item of candidate.candidates.slice(0, MAX_CANDIDATES)) {
    if (!exactKeys(item, ["kind", "name", "media_type", "size_bytes", "sha256", "content_base64"]) || !Object.hasOwn(allowedMedia, item.kind) || item.media_type !== allowedMedia[item.kind] || !ID.test(item.name ?? "") || !Number.isSafeInteger(item.size_bytes) || item.size_bytes < 1 || item.size_bytes > context.maximumBytes || !DIGEST.test(item.sha256 ?? "") || typeof item.content_base64 !== "string" || item.content_base64.length > maxBase64Length) { reasons.add("INVALID_EVIDENCE_CANDIDATE"); continue; }
    const approximate = Math.floor(item.content_base64.length * 3 / 4);
    if (approximate > context.maximumBytes || totalDecoded + approximate > context.maximumBytes) { reasons.add("EVIDENCE_BYTE_LIMIT"); continue; }
    const bytes = Buffer.from(item.content_base64, "base64");
    totalDecoded += bytes.byteLength;
    if (bytes.toString("base64") !== item.content_base64 || bytes.byteLength !== item.size_bytes || digestBytes(bytes) !== item.sha256 || totalDecoded > context.maximumBytes) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  }
  if (context.applicability === "REQUIRED") {
    if (candidate.observations.length === 0 || candidate.candidates.length === 0 || !same(candidate.evidence_kinds, context.expectedEvidence)) reasons.add("EVIDENCE_KIND_MISMATCH");
    if (context.branch === "ui" && (!candidate.candidates.some(({ kind }) => kind === "screenshot") || !candidate.candidates.some(({ kind }) => kind === "trace"))) reasons.add("INVALID_EVIDENCE_CANDIDATE");
  } else if (candidate.product_result !== "SKIPPED" || candidate.code !== "NOT_APPLICABLE"
    || candidate.environment_status !== (context.receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED")
    || candidate.evidence_status !== "VERIFIED" || candidate.confidence !== 1
    || candidate.evidence_kinds.length !== 0 || candidate.observations.length !== 0 || candidate.candidates.length !== 0) reasons.add("NOT_APPLICABLE_EVIDENCE_MISMATCH");
  const identity = candidate.environment_identity;
  if (context.receipt.environment_status === "READY") {
    if (!exactKeys(identity, ENVIRONMENT_IDENTITY_KEYS)) reasons.add("ENVIRONMENT_ID_MISMATCH");
    if (identity?.environment_id !== context.receipt.environment_id || identity?.target_namespace !== context.receipt.target_namespace || identity?.base_url !== context.receipt.base_url) reasons.add("ENVIRONMENT_ID_MISMATCH");
    if (identity?.repository_origin !== context.receipt.repository_origin) reasons.add("REPOSITORY_MISMATCH");
    if (identity?.commit !== context.receipt.commit) reasons.add("COMMIT_MISMATCH");
    if (identity?.content_hash !== context.receipt.content_hash) reasons.add("CONTENT_HASH_MISMATCH");
    if (identity?.instance_nonce !== context.receipt.instance_nonce) reasons.add("INSTANCE_NONCE_MISMATCH");
  } else if (identity !== null) reasons.add("ENVIRONMENT_ID_MISMATCH");
}

function expectedOccurrence(context, payloadArtifact, evidenceArtifact) {
  return {
    schema_version: "nuanu.qa-evidence-occurrence.v1",
    source_artifact: context.plan.source_artifact,
    plan_sha256: context.plan.plan_sha256,
    branch: context.branch,
    repository_origin: context.repositoryOrigin,
    commit: context.plan.commit,
    content_hash: context.plan.content_hash,
    environment_id: context.receipt.environment_id,
    instance_nonce: context.receipt.instance_nonce ?? null,
    run_id: context.runId,
    attempt_id: context.attemptId,
    branch_payload_artifact: trustedLink(payloadArtifact),
    evidence_artifact: trustedLink(evidenceArtifact),
  };
}

async function normalizeBranch(branch, entries, context) {
  const reasons = new Set();
  if (entries.length === 0) return { record: { ...invalidBranch(branch, "MISSING_BRANCH"), applicability: context.plan.applicability[branch], validity: "MISSING" }, reasons: new Set(["MISSING_BRANCH"]) };
  if (entries.length !== 1) reasons.add("DUPLICATE_BRANCH");
  const entry = entries[0];
  if (!exactKeys(entry, ["output", "artifacts"]) || !exactKeys(entry.artifacts, ARTIFACT_ROLES)) reasons.add("INVALID_BRANCH_RECORD");
  const output = entry?.output;
  const result = output?.branch_result;
  const data = output?.envelope?.item?.data;
  if (!exactKeys(output, ["branch_result", "envelope"]) || !exactKeys(data, EXECUTION_KEYS)) reasons.add("INVALID_BRANCH_OUTPUT");
  const expectedAttemptNamespace = sha256({ run_id: context.runId, attempt_id: context.attemptId }).slice(7);
  const expectedBranchNamespace = sha256({ run_id: context.runId, attempt_id: context.attemptId, branch }).slice(7);
  if (data?.schema_version !== "nuanu.qa-branch-execution.v1"
    || data?.attempt_namespace !== expectedAttemptNamespace || data?.branch_namespace !== expectedBranchNamespace
    || !["HEALTHY", "INFRA_FAILURE", "NOT_REQUIRED"].includes(data?.environment_status)
    || !Number.isFinite(data?.confidence) || data.confidence < 0 || data.confidence > 1
    || !CODE.test(data?.code ?? "") || !CLOSED_CODES.has(data.code)) reasons.add("INVALID_BRANCH_OUTPUT");
  try { validateBranchResult(result); } catch { reasons.add("INVALID_BRANCH_OUTPUT"); }
  if (result?.branch !== branch || result?.project_key !== context.plan.project_key || result?.profile_digest !== context.plan.profile_digest) reasons.add("BRANCH_IDENTITY_MISMATCH");
  if (result?.commit !== context.plan.commit) reasons.add("COMMIT_MISMATCH");
  const applicability = context.plan.applicability[branch];
  if (result?.applicability !== applicability) reasons.add("APPLICABILITY_MISMATCH");
  if (applicability === "REQUIRED" && result?.product_result !== "PASS") reasons.add(result?.product_result === "FAIL" ? "PRODUCT_FAILURE" : "REQUIRED_BRANCH_NOT_PASS");
  if (applicability === "NOT_APPLICABLE" && result?.product_result !== "SKIPPED") reasons.add("INAPPLICABLE_BRANCH_NOT_SKIPPED");
  if (result?.product_result === "FAIL") reasons.add("PRODUCT_FAILURE");
  if (result?.evidence_status !== "VERIFIED") reasons.add("EVIDENCE_NOT_VERIFIED");
  if (data?.run_id !== context.runId) reasons.add("RUN_MISMATCH");
  if (data?.attempt_id !== context.attemptId) reasons.add("ATTEMPT_MISMATCH");
  if (data?.environment_status === "INFRA_FAILURE") reasons.add("INFRA_FAILURE");
  if (!Number.isFinite(data?.confidence) || data.confidence < context.confidenceThreshold) reasons.add("LOW_CONFIDENCE");
  if (!CODE.test(data?.code ?? "") || !CLOSED_CODES.has(data.code) || (applicability === "REQUIRED" && result?.product_result === "PASS" && !PASS_CODES[branch].has(data.code)) || (applicability === "NOT_APPLICABLE" && data.code !== "NOT_APPLICABLE")) reasons.add("UNKNOWN_CODE");

  const refs = entry?.artifacts ?? {};
  for (const role of ARTIFACT_ROLES) {
    const ref = reference(refs[role]);
    if (!ref) reasons.add("INVALID_ARTIFACT_REFERENCE");
    else {
      const key = `${ref.id}@${ref.version}`;
      if (context.usedArtifacts.has(key)) reasons.add("REUSED_ARTIFACT_VERSION");
      context.usedArtifacts.add(key);
    }
  }
  let payloadArtifact; let occurrenceArtifact; let evidenceArtifact;
  try { payloadArtifact = await resolveArtifact(refs.branch_payload, "branch_payload", context, context.maximumBytes); } catch (error) { reasons.add(error.code ?? "INVALID_TRUSTED_ARTIFACT"); }
  try { occurrenceArtifact = await resolveArtifact(refs.occurrence, "occurrence", context, context.maximumBytes); } catch (error) { reasons.add(error.code ?? "INVALID_TRUSTED_ARTIFACT"); }
  try { evidenceArtifact = await resolveArtifact(refs.evidence, "evidence", context, context.maximumBytes); } catch (error) { reasons.add(error.code ?? "INVALID_TRUSTED_ARTIFACT"); }

  const evidenceRef = reference(refs.evidence);
  if (output?.envelope?.item?.key !== `verify_${branch}`
    || typeof output?.envelope?.item?.description !== "string" || output.envelope.item.description.length < 1 || output.envelope.item.description.length > 256 || /[\0\r\n]/.test(output.envelope.item.description)) reasons.add("INVALID_BRANCH_OUTPUT");
  if (!exactKeys(output?.envelope, ["item", "artifact_outputs"])
    || !exactKeys(output?.envelope?.item, ["key", "description", "data", "artifacts"])
    || output?.envelope?.item?.key !== `verify_${branch}`
    || typeof output?.envelope?.item?.description !== "string" || output.envelope.item.description.length < 1 || output.envelope.item.description.length > 256 || /[\0\r\n]/.test(output.envelope.item.description)
    || !exactKeys(output?.envelope?.item?.artifacts, ["evidence_report"])
    || !exactKeys(output?.envelope?.artifact_outputs, ["item.artifacts.evidence_report"])
    || !same(output.envelope.item.artifacts.evidence_report, evidenceRef)
    || !same(output.envelope.artifact_outputs["item.artifacts.evidence_report"], evidenceRef)) reasons.add("MATERIALIZATION_REF_MISMATCH");

  const expectedPayload = { schema_version: "nuanu.qa-materialized-branch-payload.v1", branch_result: result, execution_data: data };
  if (!payloadArtifact || !same(payloadArtifact.payload, expectedPayload)) reasons.add("BRANCH_PAYLOAD_DIGEST_MISMATCH");
  let candidate;
  if (typeof data?.evidence_candidate !== "string" || Buffer.byteLength(data.evidence_candidate) > context.maximumBytes || !DIGEST.test(data?.evidence_sha256 ?? "")) reasons.add("INVALID_BRANCH_OUTPUT");
  else {
    try {
      candidate = JSON.parse(data.evidence_candidate);
      if (canonicalJson(candidate) !== data.evidence_candidate || sha256(data.evidence_candidate) !== data.evidence_sha256) reasons.add("EVIDENCE_DIGEST_MISMATCH");
    } catch { reasons.add("INVALID_BRANCH_OUTPUT"); }
  }
  if (candidate) validateCandidate(candidate, { ...context, branch, applicability, expectedEvidence: context.plan.expected_evidence[branch] }, reasons);
  if (candidate && (candidate.product_result !== result?.product_result || candidate.evidence_status !== result?.evidence_status || candidate.environment_status !== data?.environment_status || candidate.confidence !== data?.confidence || candidate.code !== data?.code)) reasons.add("BRANCH_PAYLOAD_MISMATCH");

  const evidence = evidenceArtifact?.payload;
  if (!exactKeys(evidence, ["schema_version", "source_artifact", "plan_sha256", "branch", "branch_payload_sha256", "evidence_sha256", "evidence_candidate", "confirmed_findings"]) || evidence?.schema_version !== "nuanu.qa-materialized-evidence.v1") reasons.add("INVALID_MATERIALIZED_ARTIFACT");
  if (!same(evidence?.source_artifact, context.plan.source_artifact)) reasons.add("SOURCE_ARTIFACT_MISMATCH");
  if (evidence?.plan_sha256 !== context.plan.plan_sha256) reasons.add("PLAN_DIGEST_MISMATCH");
  if (evidence?.branch !== branch || evidence?.branch_payload_sha256 !== payloadArtifact?.sha256 || evidence?.evidence_sha256 !== data?.evidence_sha256 || !same(evidence?.evidence_candidate, candidate)) reasons.add("EVIDENCE_LINK_MISMATCH");
  if (!Number.isSafeInteger(evidence?.confirmed_findings) || evidence.confirmed_findings < 0) reasons.add("INVALID_MATERIALIZED_ARTIFACT");
  if (evidence?.confirmed_findings > 0) reasons.add("CONFIRMED_FINDINGS");

  const occurrence = occurrenceArtifact?.payload;
  const unsignedOccurrence = payloadArtifact && evidenceArtifact ? expectedOccurrence({ ...context, branch }, payloadArtifact, evidenceArtifact) : null;
  const expectedFull = unsignedOccurrence ? { ...unsignedOccurrence, occurrence_key: sha256(unsignedOccurrence) } : null;
  if (!isObject(occurrence)) reasons.add("OCCURRENCE_KEY_MISMATCH");
  else {
    const { occurrence_key: claimed, ...unsigned } = occurrence;
    if (!DIGEST.test(claimed ?? "") || sha256(unsigned) !== claimed) reasons.add("OCCURRENCE_KEY_MISMATCH");
  }
  if (!same(occurrence?.source_artifact, context.plan.source_artifact)) reasons.add("SOURCE_ARTIFACT_MISMATCH");
  if (!expectedFull || !same(occurrence, expectedFull)) reasons.add("OCCURRENCE_LINK_MISMATCH");
  if (occurrence?.repository_origin !== context.repositoryOrigin) reasons.add("REPOSITORY_MISMATCH");
  if (occurrence?.commit !== context.plan.commit) reasons.add("COMMIT_MISMATCH");
  if (occurrence?.content_hash !== context.plan.content_hash) reasons.add("CONTENT_HASH_MISMATCH");
  if (occurrence?.environment_id !== context.receipt.environment_id) reasons.add("ENVIRONMENT_ID_MISMATCH");
  if (occurrence?.instance_nonce !== (context.receipt.instance_nonce ?? null)) reasons.add("INSTANCE_NONCE_MISMATCH");
  if (occurrence?.run_id !== context.runId) reasons.add("RUN_MISMATCH");
  if (occurrence?.attempt_id !== context.attemptId) reasons.add("ATTEMPT_MISMATCH");

  const reasonCodes = [...reasons].sort();
  return {
    record: {
      branch,
      validity: reasonCodes.length === 0 ? "VALID" : "INVALID",
      applicability,
      product_result: result?.product_result ?? null,
      environment_status: data?.environment_status ?? null,
      evidence_status: result?.evidence_status ?? null,
      confidence: Number.isFinite(data?.confidence) ? data.confidence : null,
      code: typeof data?.code === "string" ? data.code : null,
      confirmed_findings: Number.isSafeInteger(evidence?.confirmed_findings) ? evidence.confirmed_findings : null,
      artifacts: payloadArtifact && occurrenceArtifact && evidenceArtifact ? { branch_payload: trustedLink(payloadArtifact), occurrence: trustedLink(occurrenceArtifact), evidence: trustedLink(evidenceArtifact) } : null,
      reason_codes: reasonCodes,
    },
    reasons,
  };
}

async function aggregateUnsafe(input, dependencies) {
  const globalReasons = new Set();
  const exactInput = exactKeys(input, INPUT_KEYS);
  if (!exactInput) globalReasons.add("INVALID_AGGREGATE_INPUT");
  if (typeof dependencies?.resolveArtifact !== "function") return failureAggregate("TRUSTED_ARTIFACT_RESOLVER_REQUIRED");
  if (!exactInput && (!reference(input?.profile_artifact) || !reference(input?.plan_artifact))) return failureAggregate("INVALID_AGGREGATE_INPUT");
  if (!UUID.test(input?.workspace_id ?? "") || !ID.test(input?.run_id ?? "") || !ID.test(input?.attempt_id ?? "") || !exactHttps(input?.repository_origin)) globalReasons.add("INVALID_AGGREGATE_INPUT");
  if (!Array.isArray(input?.branches) || input.branches.length > MAX_BRANCH_INPUTS) globalReasons.add("INVALID_AGGREGATE_INPUT");
  const resolutionContext = { resolveArtifact: dependencies.resolveArtifact, workspaceId: input?.workspace_id };
  let profileArtifact; let planArtifact;
  try { profileArtifact = await resolveArtifact(input?.profile_artifact, "project_profile", resolutionContext, FIXED_ARTIFACT_LIMIT); } catch (error) { return failureAggregate(error.code ?? "INVALID_TRUSTED_ARTIFACT"); }
  let trustedProfile;
  try { trustedProfile = validateProfile(profileArtifact.payload); } catch { return failureAggregate("INVALID_TRUSTED_PROFILE"); }
  const maximumBytes = trustedProfile.execution.max_output_bytes;
  try { planArtifact = await resolveArtifact(input?.plan_artifact, "test_plan", resolutionContext, Math.min(FIXED_ARTIFACT_LIMIT, maximumBytes)); } catch (error) { return failureAggregate(error.code ?? "INVALID_TRUSTED_ARTIFACT"); }
  const trustedPlan = planArtifact.payload;
  validateFullPlan(trustedPlan, globalReasons);
  if (!same(input?.plan, trustedPlan)) globalReasons.add("PLAN_MATERIAL_MISMATCH");
  if (trustedPlan.profile_digest !== sha256(trustedProfile)) globalReasons.add("PROFILE_DIGEST_MISMATCH");
  if (trustedPlan.project_key !== trustedProfile.project_key || input.repository_origin !== trustedProfile.repository.allowed_origin) globalReasons.add("PROFILE_POLICY_MISMATCH");
  validateReceipt(input?.environment_receipt, { ...input, plan: trustedPlan }, globalReasons);

  const entries = Array.isArray(input?.branches) ? input.branches.slice(0, MAX_BRANCH_INPUTS) : [];
  const usedArtifacts = new Set([`${profileArtifact.id}@${profileArtifact.version}`, `${planArtifact.id}@${planArtifact.version}`]);
  const normalizedBranches = [];
  for (const branch of BRANCHES) {
    const matching = entries.filter((entry) => entry?.output?.branch_result?.branch === branch);
    const normalized = await normalizeBranch(branch, matching, {
      ...resolutionContext,
      plan: trustedPlan,
      receipt: input.environment_receipt,
      repositoryOrigin: input.repository_origin,
      runId: input.run_id,
      attemptId: input.attempt_id,
      confidenceThreshold: trustedProfile.risk.confidence_threshold,
      maximumBytes,
      usedArtifacts,
    });
    normalizedBranches.push(normalized.record);
    for (const reason of normalized.reasons) globalReasons.add(reason);
  }
  if (entries.some((entry) => !BRANCHES.includes(entry?.output?.branch_result?.branch))) globalReasons.add("UNEXPECTED_BRANCH");
  if (entries.length !== BRANCHES.length) globalReasons.add("BRANCH_COUNT_MISMATCH");
  return finalizeAggregate({
    workspace_id: input.workspace_id,
    source_artifact: trustedPlan.source_artifact,
    plan_artifact: trustedLink(planArtifact),
    profile_artifact: trustedLink(profileArtifact),
    plan_sha256: trustedPlan.plan_sha256,
    profile_digest: trustedPlan.profile_digest,
    project_key: trustedPlan.project_key,
    repository_origin: input.repository_origin,
    commit: trustedPlan.commit,
    content_hash: trustedPlan.content_hash,
    environment_id: input.environment_receipt?.environment_id ?? null,
    instance_nonce: input.environment_receipt?.instance_nonce ?? null,
    run_id: input.run_id,
    attempt_id: input.attempt_id,
    confidence_threshold: trustedProfile.risk.confidence_threshold,
    max_evidence_bytes: maximumBytes,
    environment_status: input.environment_receipt?.environment_status ?? null,
    branches: normalizedBranches,
  }, globalReasons);
}

export async function aggregateEvidence(input, dependencies = {}) {
  try { return await aggregateUnsafe(input, dependencies); } catch { return failureAggregate("INVALID_AGGREGATE_INPUT"); }
}

export const AGGREGATE_REASON_CODES = Object.freeze([
  "APPLICABILITY_MISMATCH", "ARTIFACT_SIZE_LIMIT", "ATTEMPT_MISMATCH", "BRANCH_COUNT_MISMATCH",
  "BRANCH_IDENTITY_MISMATCH", "BRANCH_PAYLOAD_DIGEST_MISMATCH", "BRANCH_PAYLOAD_MISMATCH", "COMMIT_MISMATCH",
  "CONFIRMED_FINDINGS", "CONTENT_HASH_MISMATCH", "DUPLICATE_BRANCH", "ENVIRONMENT_ID_MISMATCH",
  "EVIDENCE_BYTE_LIMIT", "EVIDENCE_COUNT_LIMIT", "EVIDENCE_DIGEST_MISMATCH", "EVIDENCE_KIND_MISMATCH",
  "EVIDENCE_LINK_MISMATCH", "EVIDENCE_NOT_VERIFIED", "INAPPLICABLE_BRANCH_NOT_SKIPPED", "INFRA_FAILURE",
  "INSTANCE_NONCE_MISMATCH", "INVALID_AGGREGATE_INPUT", "INVALID_ARTIFACT_REFERENCE", "INVALID_BRANCH_OUTPUT",
  "INVALID_BRANCH_RECORD", "INVALID_EVIDENCE_CANDIDATE", "INVALID_ENVIRONMENT_RECEIPT", "INVALID_FULL_PLAN",
  "INVALID_MATERIALIZED_ARTIFACT", "INVALID_TRUSTED_ARTIFACT", "INVALID_TRUSTED_PROFILE", "LOW_CONFIDENCE",
  "MATERIALIZATION_REF_MISMATCH", "MISSING_BRANCH", "NOT_APPLICABLE_EVIDENCE_MISMATCH", "OCCURRENCE_KEY_MISMATCH",
  "OCCURRENCE_LINK_MISMATCH", "PASS_ASSERTION_MISMATCH", "PLAN_DIGEST_MISMATCH", "PLAN_MATERIAL_MISMATCH",
  "PRODUCT_FAILURE", "PROFILE_DIGEST_MISMATCH", "PROFILE_POLICY_MISMATCH", "REPOSITORY_MISMATCH",
  "REQUIRED_BRANCH_NOT_PASS", "REUSED_ARTIFACT_VERSION", "RUN_MISMATCH", "SOURCE_ARTIFACT_MISMATCH",
  "TRUSTED_ARTIFACT_RESOLVER_REQUIRED", "UNEXPECTED_BRANCH", "UNKNOWN_CODE",
]);

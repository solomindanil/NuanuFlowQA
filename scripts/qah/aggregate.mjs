import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "./canonical.mjs";
import { BRANCHES, validateBranchResult, validateTestPlan } from "./contracts.mjs";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ARTIFACT_ROLES = ["branch_payload", "occurrence", "evidence"];
const PLAN_KEYS = ["schema_version", "project_key", "commit", "profile_digest", "branches", "source_artifact", "content_hash", "applicability", "branch_reasons", "expected_evidence", "risk_level", "artifact_slot", "plan_sha256"];
const EXECUTION_KEYS = ["schema_version", "run_id", "attempt_id", "attempt_namespace", "branch_namespace", "environment_status", "confidence", "code", "evidence_sha256", "evidence_candidate"];
const READY_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace", "repository_origin", "commit", "content_hash", "instance_nonce", "base_url", "pid_file", "state_file"];
const NOT_REQUIRED_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace"];
const FAILURE_RECEIPT_KEYS = [...NOT_REQUIRED_RECEIPT_KEYS, "reason"];
const CANDIDATE_KEYS = ["schema_version", "run_id", "attempt_id", "attempt_namespace", "branch_namespace", "branch", "environment_identity", "product_result", "environment_status", "evidence_status", "confidence", "code", "evidence_kinds", "observations", "candidates"];
const ENVIRONMENT_IDENTITY_KEYS = ["environment_id", "target_namespace", "repository_origin", "commit", "content_hash", "instance_nonce", "base_url"];
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

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isObject(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function artifactReference(value) {
  return isObject(value) && ID.test(value.id) && Number.isSafeInteger(value.version) && value.version >= 1 && DIGEST.test(value.sha256)
    ? { id: value.id, version: value.version, sha256: value.sha256 }
    : null;
}

function same(left, right) {
  try { return canonicalJson(left) === canonicalJson(right); } catch { return false; }
}

function safeReason(set, code) {
  set.add(code);
}

function digestBytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function validatePlanBoundary(plan, reasons) {
  if (!hasExactKeys(plan, PLAN_KEYS)) safeReason(reasons, "INVALID_PLAN");
  try {
    validateTestPlan(plan?.artifact_slot);
  } catch {
    safeReason(reasons, "INVALID_PLAN");
  }
  if (!isObject(plan?.source_artifact) || !hasExactKeys(plan.source_artifact, ["id", "version"]) || !ID.test(plan.source_artifact.id) || !Number.isSafeInteger(plan.source_artifact.version) || plan.source_artifact.version < 1) safeReason(reasons, "INVALID_SOURCE_ARTIFACT");
  if (!DIGEST.test(plan?.content_hash) || !DIGEST.test(plan?.plan_sha256)) safeReason(reasons, "INVALID_PLAN");
  if (isObject(plan)) {
    const { plan_sha256: claimed, ...unsigned } = plan;
    if (sha256(unsigned) !== claimed) safeReason(reasons, "PLAN_DIGEST_MISMATCH");
  }
  if (!isObject(plan?.applicability) || !hasExactKeys(plan.applicability, BRANCHES)) safeReason(reasons, "INVALID_PLAN");
  for (const branch of BRANCHES) if (!["REQUIRED", "NOT_APPLICABLE"].includes(plan?.applicability?.[branch])) safeReason(reasons, "INVALID_PLAN");
  const expectedRequired = BRANCHES.filter((branch) => plan?.applicability?.[branch] === "REQUIRED");
  if (!same(plan?.branches, expectedRequired) || !same(plan?.artifact_slot?.branches, expectedRequired)) safeReason(reasons, "PLAN_BRANCH_SET_MISMATCH");
}

function validateReceipt(receipt, input, reasons) {
  if (!isObject(receipt) || !["READY", "NOT_REQUIRED", "INFRA_FAILURE"].includes(receipt.environment_status)) {
    safeReason(reasons, "INVALID_ENVIRONMENT_RECEIPT");
    return;
  }
  const receiptKeys = receipt.environment_status === "READY" ? READY_RECEIPT_KEYS : receipt.environment_status === "NOT_REQUIRED" ? NOT_REQUIRED_RECEIPT_KEYS : FAILURE_RECEIPT_KEYS;
  if (!hasExactKeys(receipt, receiptKeys)) safeReason(reasons, "INVALID_ENVIRONMENT_RECEIPT");
  if (receipt.run_id !== input.run_id) safeReason(reasons, "RUN_MISMATCH");
  if (receipt.attempt_id !== input.attempt_id) safeReason(reasons, "ATTEMPT_MISMATCH");
  if (receipt.environment_status === "INFRA_FAILURE") safeReason(reasons, "INFRA_FAILURE");
  if (receipt.environment_status === "READY") {
    if (receipt.repository_origin !== input.repository_origin) safeReason(reasons, "REPOSITORY_MISMATCH");
    if (receipt.commit !== input.plan?.commit) safeReason(reasons, "COMMIT_MISMATCH");
    if (receipt.content_hash !== input.plan?.content_hash) safeReason(reasons, "CONTENT_HASH_MISMATCH");
    if (!ID.test(receipt.environment_id ?? "") || !NONCE.test(receipt.instance_nonce ?? "")) safeReason(reasons, "INVALID_ENVIRONMENT_RECEIPT");
  }
}

function validateArtifact(material, usedArtifacts, branchReasons) {
  if (!hasExactKeys(material, ["id", "version", "sha256", "payload"]) || !artifactReference(material) || !isObject(material.payload)) {
    safeReason(branchReasons, "INVALID_MATERIALIZED_ARTIFACT");
    return false;
  }
  const key = `${material.id}@${material.version}`;
  if (usedArtifacts.has(key)) safeReason(branchReasons, "REUSED_ARTIFACT_VERSION");
  usedArtifacts.add(key);
  if (sha256(material.payload) !== material.sha256) {
    safeReason(branchReasons, "ARTIFACT_DIGEST_MISMATCH");
    return false;
  }
  return true;
}

function expectedOccurrence({ plan, branch, receipt, repositoryOrigin, runId, attemptId, payloadArtifact, evidenceArtifact }) {
  return {
    schema_version: "nuanu.qa-evidence-occurrence.v1",
    source_artifact: plan.source_artifact,
    plan_sha256: plan.plan_sha256,
    branch,
    repository_origin: repositoryOrigin,
    commit: plan.commit,
    content_hash: plan.content_hash,
    environment_id: receipt.environment_id,
    instance_nonce: receipt.instance_nonce ?? null,
    run_id: runId,
    attempt_id: attemptId,
    branch_payload_artifact: artifactReference(payloadArtifact),
    evidence_artifact: artifactReference(evidenceArtifact),
  };
}

function validateEvidenceCandidate(candidate, { branch, runId, attemptId, applicability }, branchReasons) {
  if (!hasExactKeys(candidate, CANDIDATE_KEYS) || candidate.schema_version !== "nuanu.qa-evidence-candidate.v1") {
    safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
    return;
  }
  const expectedAttemptNamespace = sha256({ run_id: runId, attempt_id: attemptId }).slice("sha256:".length);
  const expectedBranchNamespace = sha256({ run_id: runId, attempt_id: attemptId, branch }).slice("sha256:".length);
  if (candidate.attempt_namespace !== expectedAttemptNamespace || candidate.branch_namespace !== expectedBranchNamespace) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
  if (!Array.isArray(candidate.evidence_kinds) || new Set(candidate.evidence_kinds).size !== candidate.evidence_kinds.length || candidate.evidence_kinds.some((kind) => typeof kind !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(kind))) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
  if (!Array.isArray(candidate.observations) || !Array.isArray(candidate.candidates)) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
  else {
    if (applicability === "REQUIRED" && (candidate.observations.length === 0 || candidate.candidates.length === 0)) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
    if (applicability === "NOT_APPLICABLE" && (candidate.observations.length !== 0 || candidate.candidates.length !== 0)) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
    for (const observation of candidate.observations) if (!hasExactKeys(observation, ["code", "status", "value_sha256"]) || !CODE.test(observation.code ?? "") || !["PASS", "FAIL", "INCONCLUSIVE"].includes(observation.status) || !DIGEST.test(observation.value_sha256 ?? "")) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
    for (const material of candidate.candidates) {
      if (!hasExactKeys(material, ["kind", "name", "media_type", "size_bytes", "sha256", "content_base64"]) || !["document", "screenshot", "trace"].includes(material.kind) || !ID.test(material.name ?? "") || !Number.isSafeInteger(material.size_bytes) || material.size_bytes < 1 || !DIGEST.test(material.sha256 ?? "") || typeof material.content_base64 !== "string") {
        safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
        continue;
      }
      const bytes = Buffer.from(material.content_base64, "base64");
      if (bytes.toString("base64") !== material.content_base64 || bytes.byteLength !== material.size_bytes || digestBytes(bytes) !== material.sha256) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
    }
  }
  if (candidate.environment_identity !== null && !hasExactKeys(candidate.environment_identity, ENVIRONMENT_IDENTITY_KEYS)) safeReason(branchReasons, "INVALID_EVIDENCE_CANDIDATE");
}

function normalizeBranch(branch, entries, context) {
  const branchReasons = new Set();
  if (entries.length === 0) {
    return { record: { branch, validity: "MISSING", applicability: context.plan?.applicability?.[branch] ?? null, product_result: null, environment_status: null, evidence_status: null, confidence: null, code: null, confirmed_findings: null, artifacts: null, reason_codes: ["MISSING_BRANCH"] }, reasons: new Set(["MISSING_BRANCH"]) };
  }
  if (entries.length !== 1) safeReason(branchReasons, "DUPLICATE_BRANCH");
  const entry = entries[0];
  if (!isObject(context.plan) || !isObject(context.receipt)) safeReason(branchReasons, "INVALID_BRANCH_RECORD");
  if (!hasExactKeys(entry, ["output", "artifacts"]) || !hasExactKeys(entry?.artifacts, ARTIFACT_ROLES)) safeReason(branchReasons, "INVALID_BRANCH_RECORD");

  const output = entry?.output;
  const result = output?.branch_result;
  const data = output?.envelope?.item?.data;
  if (!isObject(output) || !isObject(result) || !hasExactKeys(data, EXECUTION_KEYS)) safeReason(branchReasons, "INVALID_BRANCH_OUTPUT");
  try { validateBranchResult(result); } catch { safeReason(branchReasons, "INVALID_BRANCH_OUTPUT"); }
  if (result?.branch !== branch) safeReason(branchReasons, "BRANCH_IDENTITY_MISMATCH");
  if (result?.project_key !== context.plan?.project_key || result?.profile_digest !== context.plan?.profile_digest) safeReason(branchReasons, "BRANCH_IDENTITY_MISMATCH");
  if (result?.commit !== context.plan?.commit) safeReason(branchReasons, "COMMIT_MISMATCH");
  if (result?.applicability !== context.plan?.applicability?.[branch]) safeReason(branchReasons, "APPLICABILITY_MISMATCH");

  const applicability = context.plan?.applicability?.[branch];
  if (applicability === "REQUIRED" && result?.product_result !== "PASS") safeReason(branchReasons, result?.product_result === "FAIL" ? "PRODUCT_FAILURE" : "REQUIRED_BRANCH_NOT_PASS");
  if (applicability === "NOT_APPLICABLE" && result?.product_result !== "SKIPPED") safeReason(branchReasons, "INAPPLICABLE_BRANCH_NOT_SKIPPED");
  if (result?.product_result === "FAIL") safeReason(branchReasons, "PRODUCT_FAILURE");
  if (result?.evidence_status !== "VERIFIED") safeReason(branchReasons, "EVIDENCE_NOT_VERIFIED");

  if (data?.schema_version !== "nuanu.qa-branch-execution.v1" || typeof data?.evidence_candidate !== "string" || !DIGEST.test(data?.evidence_sha256)) safeReason(branchReasons, "INVALID_BRANCH_OUTPUT");
  if (data?.run_id !== context.runId) safeReason(branchReasons, "RUN_MISMATCH");
  if (data?.attempt_id !== context.attemptId) safeReason(branchReasons, "ATTEMPT_MISMATCH");
  if (data?.environment_status === "INFRA_FAILURE") safeReason(branchReasons, "INFRA_FAILURE");
  if (!Number.isFinite(data?.confidence) || data.confidence < context.confidenceThreshold) safeReason(branchReasons, "LOW_CONFIDENCE");
  if (!CODE.test(data?.code ?? "") || !CLOSED_CODES.has(data.code)) safeReason(branchReasons, "UNKNOWN_CODE");
  if (applicability === "REQUIRED" && result?.product_result === "PASS" && !PASS_CODES[branch].has(data?.code)) safeReason(branchReasons, "UNKNOWN_CODE");
  if (applicability === "NOT_APPLICABLE" && data?.code !== "NOT_APPLICABLE") safeReason(branchReasons, "UNKNOWN_CODE");

  let candidate;
  try {
    candidate = JSON.parse(data?.evidence_candidate);
    if (canonicalJson(candidate) !== data.evidence_candidate || sha256(data.evidence_candidate) !== data.evidence_sha256) safeReason(branchReasons, "EVIDENCE_DIGEST_MISMATCH");
  } catch {
    safeReason(branchReasons, "INVALID_BRANCH_OUTPUT");
  }
  validateEvidenceCandidate(candidate, { branch, runId: context.runId, attemptId: context.attemptId, applicability }, branchReasons);
  const expectedAttemptNamespace = sha256({ run_id: context.runId, attempt_id: context.attemptId }).slice("sha256:".length);
  const expectedBranchNamespace = sha256({ run_id: context.runId, attempt_id: context.attemptId, branch }).slice("sha256:".length);
  if (data?.attempt_namespace !== expectedAttemptNamespace || data?.branch_namespace !== expectedBranchNamespace) safeReason(branchReasons, "INVALID_BRANCH_OUTPUT");
  if (candidate?.branch !== branch || candidate?.run_id !== context.runId) safeReason(branchReasons, candidate?.run_id !== context.runId ? "RUN_MISMATCH" : "BRANCH_IDENTITY_MISMATCH");
  if (candidate?.attempt_id !== context.attemptId) safeReason(branchReasons, "ATTEMPT_MISMATCH");
  if (candidate?.product_result !== result?.product_result || candidate?.evidence_status !== result?.evidence_status || candidate?.environment_status !== data?.environment_status || candidate?.confidence !== data?.confidence || candidate?.code !== data?.code) safeReason(branchReasons, "BRANCH_PAYLOAD_MISMATCH");
  if (applicability === "REQUIRED" && !same(candidate?.evidence_kinds, context.plan?.expected_evidence?.[branch])) safeReason(branchReasons, "EVIDENCE_KIND_MISMATCH");

  const environmentIdentity = candidate?.environment_identity;
  if (context.receipt?.environment_status === "READY") {
    if (!isObject(environmentIdentity)) safeReason(branchReasons, "ENVIRONMENT_ID_MISMATCH");
    if (environmentIdentity?.repository_origin !== context.repositoryOrigin) safeReason(branchReasons, "REPOSITORY_MISMATCH");
    if (environmentIdentity?.commit !== context.plan?.commit) safeReason(branchReasons, "COMMIT_MISMATCH");
    if (environmentIdentity?.content_hash !== context.plan?.content_hash) safeReason(branchReasons, "CONTENT_HASH_MISMATCH");
    if (environmentIdentity?.environment_id !== context.receipt.environment_id) safeReason(branchReasons, "ENVIRONMENT_ID_MISMATCH");
    if (environmentIdentity?.instance_nonce !== context.receipt.instance_nonce) safeReason(branchReasons, "INSTANCE_NONCE_MISMATCH");
  } else if (environmentIdentity !== null) safeReason(branchReasons, "ENVIRONMENT_ID_MISMATCH");

  const artifacts = entry?.artifacts ?? {};
  for (const role of ARTIFACT_ROLES) validateArtifact(artifacts[role], context.usedArtifacts, branchReasons);

  const evidenceRef = artifactReference(artifacts.evidence);
  const envelopeRef = evidenceRef ? { id: evidenceRef.id, version: evidenceRef.version } : null;
  if (!hasExactKeys(output, ["branch_result", "envelope"])
    || !hasExactKeys(output?.envelope, ["item", "artifact_outputs"])
    || !hasExactKeys(output?.envelope?.item, ["key", "description", "data", "artifacts"])
    || !hasExactKeys(output?.envelope?.item?.artifacts, ["evidence_report"])
    || !hasExactKeys(output?.envelope?.artifact_outputs, ["item.artifacts.evidence_report"])
    || !same(output.envelope.item.artifacts.evidence_report, envelopeRef)
    || !same(output.envelope.artifact_outputs["item.artifacts.evidence_report"], envelopeRef)) safeReason(branchReasons, "MATERIALIZATION_REF_MISMATCH");

  const expectedPayload = { schema_version: "nuanu.qa-materialized-branch-payload.v1", branch_result: result, execution_data: data };
  if (isObject(artifacts.branch_payload?.payload) && sha256(artifacts.branch_payload.payload) !== artifacts.branch_payload.sha256) safeReason(branchReasons, "BRANCH_PAYLOAD_DIGEST_MISMATCH");
  if (!same(artifacts.branch_payload?.payload, expectedPayload)) safeReason(branchReasons, "BRANCH_PAYLOAD_DIGEST_MISMATCH");

  const evidence = artifacts.evidence?.payload;
  if (!hasExactKeys(evidence, ["schema_version", "source_artifact", "plan_sha256", "branch", "branch_payload_sha256", "evidence_sha256", "evidence_candidate", "confirmed_findings"]) || evidence?.schema_version !== "nuanu.qa-materialized-evidence.v1") safeReason(branchReasons, "INVALID_MATERIALIZED_ARTIFACT");
  if (!same(evidence?.source_artifact, context.plan?.source_artifact)) safeReason(branchReasons, "SOURCE_ARTIFACT_MISMATCH");
  if (evidence?.plan_sha256 !== context.plan?.plan_sha256) safeReason(branchReasons, "PLAN_DIGEST_MISMATCH");
  if (evidence?.branch !== branch || evidence?.branch_payload_sha256 !== artifacts.branch_payload?.sha256 || evidence?.evidence_sha256 !== data?.evidence_sha256 || !same(evidence?.evidence_candidate, candidate)) safeReason(branchReasons, "EVIDENCE_LINK_MISMATCH");
  if (!Number.isSafeInteger(evidence?.confirmed_findings) || evidence.confirmed_findings < 0) safeReason(branchReasons, "INVALID_MATERIALIZED_ARTIFACT");
  if (evidence?.confirmed_findings > 0) safeReason(branchReasons, "CONFIRMED_FINDINGS");

  const occurrence = artifacts.occurrence?.payload;
  const canComputeOccurrence = isObject(context.plan) && isObject(context.receipt);
  const expectedUnsignedOccurrence = canComputeOccurrence ? expectedOccurrence({ plan: context.plan, branch, receipt: context.receipt, repositoryOrigin: context.repositoryOrigin, runId: context.runId, attemptId: context.attemptId, payloadArtifact: artifacts.branch_payload, evidenceArtifact: artifacts.evidence }) : null;
  const expectedFullOccurrence = expectedUnsignedOccurrence ? { ...expectedUnsignedOccurrence, occurrence_key: sha256(expectedUnsignedOccurrence) } : null;
  if (!isObject(occurrence) || occurrence.occurrence_key !== sha256(Object.fromEntries(Object.entries(occurrence).filter(([key]) => key !== "occurrence_key")))) safeReason(branchReasons, "OCCURRENCE_KEY_MISMATCH");
  if (!same(occurrence?.source_artifact, context.plan?.source_artifact)) safeReason(branchReasons, "SOURCE_ARTIFACT_MISMATCH");
  if (occurrence?.plan_sha256 !== context.plan?.plan_sha256) safeReason(branchReasons, "PLAN_DIGEST_MISMATCH");
  if (occurrence?.repository_origin !== context.repositoryOrigin) safeReason(branchReasons, "REPOSITORY_MISMATCH");
  if (occurrence?.commit !== context.plan?.commit) safeReason(branchReasons, "COMMIT_MISMATCH");
  if (occurrence?.content_hash !== context.plan?.content_hash) safeReason(branchReasons, "CONTENT_HASH_MISMATCH");
  if (occurrence?.environment_id !== context.receipt?.environment_id) safeReason(branchReasons, "ENVIRONMENT_ID_MISMATCH");
  if (occurrence?.instance_nonce !== (context.receipt?.instance_nonce ?? null)) safeReason(branchReasons, "INSTANCE_NONCE_MISMATCH");
  if (occurrence?.run_id !== context.runId) safeReason(branchReasons, "RUN_MISMATCH");
  if (occurrence?.attempt_id !== context.attemptId) safeReason(branchReasons, "ATTEMPT_MISMATCH");
  if (!expectedFullOccurrence || !same(occurrence, expectedFullOccurrence)) safeReason(branchReasons, "OCCURRENCE_LINK_MISMATCH");

  const reasonCodes = [...branchReasons].sort();
  return {
    record: {
      branch,
      validity: reasonCodes.length === 0 ? "VALID" : "INVALID",
      applicability: applicability ?? null,
      product_result: result?.product_result ?? null,
      environment_status: data?.environment_status ?? null,
      evidence_status: result?.evidence_status ?? null,
      confidence: Number.isFinite(data?.confidence) ? data.confidence : null,
      code: typeof data?.code === "string" ? data.code : null,
      confirmed_findings: Number.isSafeInteger(evidence?.confirmed_findings) ? evidence.confirmed_findings : null,
      artifacts: ARTIFACT_ROLES.every((role) => artifactReference(artifacts[role])) ? Object.fromEntries(ARTIFACT_ROLES.map((role) => [role, artifactReference(artifacts[role])])) : null,
      reason_codes: reasonCodes,
    },
    reasons: branchReasons,
  };
}

export function aggregateEvidence(input) {
  const globalReasons = new Set();
  if (!hasExactKeys(input, ["plan", "branches", "environment_receipt", "repository_origin", "run_id", "attempt_id", "confidence_threshold"])) safeReason(globalReasons, "INVALID_AGGREGATE_INPUT");
  validatePlanBoundary(input?.plan, globalReasons);
  if (typeof input?.repository_origin !== "string") safeReason(globalReasons, "INVALID_AGGREGATE_INPUT");
  if (!ID.test(input?.run_id ?? "")) safeReason(globalReasons, "INVALID_AGGREGATE_INPUT");
  if (!ID.test(input?.attempt_id ?? "")) safeReason(globalReasons, "INVALID_AGGREGATE_INPUT");
  if (!Number.isFinite(input?.confidence_threshold) || input.confidence_threshold < 0 || input.confidence_threshold > 1) safeReason(globalReasons, "INVALID_CONFIDENCE_THRESHOLD");
  if (!Array.isArray(input?.branches)) safeReason(globalReasons, "INVALID_AGGREGATE_INPUT");
  validateReceipt(input?.environment_receipt, input ?? {}, globalReasons);

  const entries = Array.isArray(input?.branches) ? input.branches : [];
  const usedArtifacts = new Set();
  const normalizedBranches = [];
  for (const branch of BRANCHES) {
    const matching = entries.filter((entry) => entry?.output?.branch_result?.branch === branch);
    const normalized = normalizeBranch(branch, matching, {
      plan: input?.plan,
      receipt: input?.environment_receipt,
      repositoryOrigin: input?.repository_origin,
      runId: input?.run_id,
      attemptId: input?.attempt_id,
      confidenceThreshold: input?.confidence_threshold,
      usedArtifacts,
    });
    normalizedBranches.push(normalized.record);
    for (const reason of normalized.reasons) globalReasons.add(reason);
  }
  if (entries.some((entry) => !BRANCHES.includes(entry?.output?.branch_result?.branch))) safeReason(globalReasons, "UNEXPECTED_BRANCH");
  if (entries.length !== BRANCHES.length) safeReason(globalReasons, "BRANCH_COUNT_MISMATCH");

  const reasonCodes = [...globalReasons].sort();
  const unsigned = {
    schema_version: "nuanu.qa-evidence-aggregate.v1",
    source_artifact: isObject(input?.plan?.source_artifact) ? input.plan.source_artifact : null,
    plan_sha256: DIGEST.test(input?.plan?.plan_sha256 ?? "") ? input.plan.plan_sha256 : null,
    project_key: typeof input?.plan?.project_key === "string" ? input.plan.project_key : null,
    repository_origin: typeof input?.repository_origin === "string" ? input.repository_origin : null,
    commit: typeof input?.plan?.commit === "string" ? input.plan.commit : null,
    content_hash: DIGEST.test(input?.plan?.content_hash ?? "") ? input.plan.content_hash : null,
    environment_id: typeof input?.environment_receipt?.environment_id === "string" ? input.environment_receipt.environment_id : null,
    instance_nonce: typeof input?.environment_receipt?.instance_nonce === "string" ? input.environment_receipt.instance_nonce : null,
    run_id: typeof input?.run_id === "string" ? input.run_id : null,
    attempt_id: typeof input?.attempt_id === "string" ? input.attempt_id : null,
    confidence_threshold: Number.isFinite(input?.confidence_threshold) ? input.confidence_threshold : null,
    environment_status: typeof input?.environment_receipt?.environment_status === "string" ? input.environment_receipt.environment_status : null,
    expected_branches: [...BRANCHES],
    branches: normalizedBranches,
    invariants_passed: reasonCodes.length === 0 && normalizedBranches.every(({ validity }) => validity === "VALID"),
    reason_codes: reasonCodes,
  };
  return { ...unsigned, aggregate_sha256: sha256(unsigned) };
}

export const AGGREGATE_REASON_CODES = Object.freeze([
  "ADAPTER_EXIT_FAILURE", "APPLICABILITY_MISMATCH", "ARTIFACT_DIGEST_MISMATCH", "ATTEMPT_MISMATCH",
  "BRANCH_COUNT_MISMATCH", "BRANCH_IDENTITY_MISMATCH", "BRANCH_PAYLOAD_DIGEST_MISMATCH", "BRANCH_PAYLOAD_MISMATCH",
  "COMMIT_MISMATCH", "CONFIRMED_FINDINGS", "CONTENT_HASH_MISMATCH", "DUPLICATE_BRANCH", "ENVIRONMENT_ID_MISMATCH",
  "EVIDENCE_DIGEST_MISMATCH", "EVIDENCE_KIND_MISMATCH", "EVIDENCE_LINK_MISMATCH", "EVIDENCE_NOT_VERIFIED",
  "INAPPLICABLE_BRANCH_NOT_SKIPPED", "INFRA_FAILURE", "INSTANCE_NONCE_MISMATCH", "INVALID_AGGREGATE_INPUT",
  "INVALID_BRANCH_OUTPUT", "INVALID_BRANCH_RECORD", "INVALID_CONFIDENCE_THRESHOLD", "INVALID_ENVIRONMENT_RECEIPT",
  "INVALID_EVIDENCE_CANDIDATE", "INVALID_MATERIALIZED_ARTIFACT", "INVALID_PLAN", "INVALID_SOURCE_ARTIFACT", "LOW_CONFIDENCE", "MISSING_BRANCH",
  "MATERIALIZATION_REF_MISMATCH",
  "OCCURRENCE_KEY_MISMATCH", "OCCURRENCE_LINK_MISMATCH", "PLAN_BRANCH_SET_MISMATCH", "PLAN_DIGEST_MISMATCH",
  "PRODUCT_FAILURE", "REPOSITORY_MISMATCH", "REQUIRED_BRANCH_NOT_PASS", "REUSED_ARTIFACT_VERSION", "RUN_MISMATCH",
  "SOURCE_ARTIFACT_MISMATCH", "UNEXPECTED_BRANCH", "UNKNOWN_CODE",
]);

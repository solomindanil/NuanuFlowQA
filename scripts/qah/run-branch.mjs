#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "./canonical.mjs";
import { BRANCHES, validateBranchResult, validateProfile, validateTestPlan } from "./contracts.mjs";

const PLAN_KEYS = ["schema_version", "project_key", "commit", "profile_digest", "branches", "source_artifact", "content_hash", "applicability", "branch_reasons", "expected_evidence", "risk_level", "artifact_slot", "plan_sha256"];
const READY_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace", "repository_origin", "commit", "content_hash", "instance_nonce", "base_url", "pid_file", "state_file"];
const NOT_REQUIRED_RECEIPT_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace"];
const FAILURE_RECEIPT_KEYS = [...NOT_REQUIRED_RECEIPT_KEYS, "reason"];
const ADAPTER_RESULT_KEYS = ["schema_version", "branch", "product_result", "environment_status", "evidence_status", "confidence", "code", "observations", "artifacts"];
const OBSERVATION_KEYS = ["code", "status", "value_sha256"];
const ARTIFACT_KEYS = ["kind", "name", "version", "sha256"];
const MINIMAL_ENVIRONMENT = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT"];
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const NAMESPACE = /^[a-f0-9]{64}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MAX_STDIN_BYTES = 65_536;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`${label} must have exact keys`);
  return value;
}

function exactId(value, label) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function exactUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be an absolute URL`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw new Error(`${label} must be credential-free HTTP or HTTPS`);
  return parsed;
}

function validatePlan(plan, profile) {
  exactKeys(plan, PLAN_KEYS, "test plan");
  validateTestPlan(plan.artifact_slot);
  const artifact = plan.artifact_slot;
  if (plan.schema_version !== artifact.schema_version || plan.project_key !== artifact.project_key || plan.commit !== artifact.commit || plan.profile_digest !== artifact.profile_digest || canonicalJson(plan.branches) !== canonicalJson(artifact.branches)) throw new Error("test plan artifact slot must match the full plan");
  if (plan.project_key !== profile.project_key) throw new Error("test plan project must match profile");
  if (plan.profile_digest !== sha256(profile)) throw new Error("test plan profile digest must match the exact profile");
  exactKeys(plan.source_artifact, ["id", "version"], "test plan source artifact");
  exactId(plan.source_artifact.id, "source artifact id");
  if (!Number.isSafeInteger(plan.source_artifact.version) || plan.source_artifact.version < 1) throw new Error("source artifact version is invalid");
  if (!DIGEST.test(plan.content_hash)) throw new Error("test plan content hash is invalid");
  if (!DIGEST.test(plan.plan_sha256)) throw new Error("test plan digest is invalid");
  const { plan_sha256, ...unsigned } = plan;
  if (sha256(unsigned) !== plan_sha256) throw new Error("test plan digest does not match canonical plan bytes");
  exactKeys(plan.applicability, BRANCHES, "test plan applicability");
  exactKeys(plan.branch_reasons, BRANCHES, "test plan branch reasons");
  exactKeys(plan.expected_evidence, BRANCHES, "test plan expected evidence");
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(plan.risk_level)) throw new Error("test plan risk level is invalid");
  for (const branch of BRANCHES) {
    const applicability = plan.applicability[branch];
    if (!["REQUIRED", "NOT_APPLICABLE"].includes(applicability)) throw new Error(`test plan ${branch} applicability is invalid`);
    if (!Array.isArray(plan.branch_reasons[branch]) || plan.branch_reasons[branch].some((reason) => {
      try { exactKeys(reason, ["code"], `${branch} reason`); return !CODE.test(reason.code); } catch { return true; }
    })) throw new Error(`test plan ${branch} reasons are invalid`);
    if (!Array.isArray(plan.expected_evidence[branch]) || plan.expected_evidence[branch].some((kind) => typeof kind !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(kind))) throw new Error(`test plan ${branch} evidence is invalid`);
    if (applicability === "NOT_APPLICABLE" && (plan.branch_reasons[branch].length !== 0 || plan.expected_evidence[branch].length !== 0)) throw new Error(`not-applicable ${branch} must not declare reasons or evidence`);
  }
  const expectedBranches = BRANCHES.filter((branch) => plan.applicability[branch] === "REQUIRED");
  if (canonicalJson(expectedBranches) !== canonicalJson(plan.branches)) throw new Error("test plan branches must match applicability");
  return plan;
}

function validateReceipt(receipt, { plan, profile, runId, attemptId }) {
  const keys = receipt?.environment_status === "READY" ? READY_RECEIPT_KEYS
    : receipt?.environment_status === "NOT_REQUIRED" ? NOT_REQUIRED_RECEIPT_KEYS
      : receipt?.environment_status === "INFRA_FAILURE" ? FAILURE_RECEIPT_KEYS
        : null;
  if (!keys) throw new Error("environment receipt status is invalid");
  exactKeys(receipt, keys, "environment receipt");
  exactId(receipt.run_id, "environment receipt run_id");
  exactId(receipt.attempt_id, "environment receipt attempt_id");
  exactId(receipt.environment_id, "environment receipt environment_id");
  if (!NAMESPACE.test(receipt.target_namespace)) throw new Error("environment receipt target namespace is invalid");
  if (receipt.run_id !== runId || receipt.attempt_id !== attemptId) throw new Error("environment receipt run and attempt must match execution fence");
  if (receipt.environment_status === "READY") {
    if (receipt.repository_origin !== profile.repository.allowed_origin || receipt.commit !== plan.commit || receipt.content_hash !== plan.content_hash) throw new Error("environment receipt build identity must match plan and profile");
    if (!SHA.test(receipt.commit) || !DIGEST.test(receipt.content_hash) || !NONCE.test(receipt.instance_nonce)) throw new Error("environment receipt identity is invalid");
    exactUrl(receipt.repository_origin, "environment receipt repository origin");
    exactUrl(receipt.base_url, "environment receipt base URL");
    for (const key of ["pid_file", "state_file"]) if (typeof receipt[key] !== "string" || !receipt[key].startsWith("/") || receipt[key].includes("\0")) throw new Error(`environment receipt ${key} is invalid`);
  }
  if (receipt.environment_status === "INFRA_FAILURE" && (typeof receipt.reason !== "string" || receipt.reason.length === 0 || receipt.reason.length > 1024)) throw new Error("environment failure reason is invalid");
  return receipt;
}

function branchNamespace(runId, attemptId, branch) {
  return sha256({ run_id: runId, attempt_id: attemptId, branch }).slice("sha256:".length);
}

function minimalEnvironment(environment) {
  const result = {};
  for (const name of MINIMAL_ENVIRONMENT) if (typeof environment?.[name] === "string") result[name] = environment[name];
  return result;
}

function validateArtifact(value) {
  exactKeys(value, ARTIFACT_KEYS, "adapter artifact");
  if (!["document", "screenshot", "trace"].includes(value.kind)) throw new Error("adapter artifact kind is invalid");
  if (typeof value.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.name)) throw new Error("adapter artifact name is invalid");
  if (!Number.isSafeInteger(value.version) || value.version < 1) throw new Error("adapter artifact version is invalid");
  if (!DIGEST.test(value.sha256)) throw new Error("adapter artifact digest is invalid");
  return value;
}

function validateAdapterResult(value, branch) {
  exactKeys(value, ADAPTER_RESULT_KEYS, "branch adapter result");
  if (value.schema_version !== "nuanu.qa-branch-adapter-result.v1" || value.branch !== branch) throw new Error("branch adapter result identity is invalid");
  if (!["PASS", "FAIL", "INCONCLUSIVE"].includes(value.product_result)) throw new Error("branch adapter product result is invalid");
  if (!["HEALTHY", "INFRA_FAILURE", "NOT_REQUIRED"].includes(value.environment_status)) throw new Error("branch adapter environment status is invalid");
  if (!["VERIFIED", "PARTIAL", "UNVERIFIED"].includes(value.evidence_status)) throw new Error("branch adapter evidence status is invalid");
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) throw new Error("branch adapter confidence is invalid");
  if (!CODE.test(value.code)) throw new Error("branch adapter code is invalid");
  if (value.product_result === "PASS" && (value.environment_status !== "HEALTHY" || value.evidence_status !== "VERIFIED")) throw new Error("passing adapter result requires healthy verified evidence");
  if (value.product_result === "FAIL" && value.environment_status !== "HEALTHY") throw new Error("product failure requires a healthy environment");
  if (value.environment_status === "INFRA_FAILURE" && value.product_result !== "INCONCLUSIVE") throw new Error("infrastructure failure must be inconclusive");
  if (!Array.isArray(value.observations) || value.observations.length > 64) throw new Error("adapter observations are invalid");
  for (const observation of value.observations) {
    exactKeys(observation, OBSERVATION_KEYS, "adapter observation");
    if (!CODE.test(observation.code) || !["PASS", "FAIL", "INCONCLUSIVE"].includes(observation.status) || !DIGEST.test(observation.value_sha256)) throw new Error("adapter observation is invalid");
  }
  if (!Array.isArray(value.artifacts) || value.artifacts.length > 16) throw new Error("adapter artifacts are invalid");
  value.artifacts.forEach(validateArtifact);
  if (branch === "ui") {
    const kinds = value.artifacts.map((artifact) => artifact.kind);
    if (!kinds.includes("screenshot") || !kinds.includes("trace")) throw new Error("UI evidence requires screenshot and trace artifacts");
  }
  return value;
}

function evidenceReport({ branch, runId, attemptId, namespace, code, productResult, environmentStatus, evidenceStatus, confidence, observations, artifacts }) {
  const document = {
    schema_version: "nuanu.qa-evidence-document.v1",
    branch,
    run_id: runId,
    attempt_id: attemptId,
    branch_namespace: namespace,
    code,
    product_result: productResult,
    environment_status: environmentStatus,
    evidence_status: evidenceStatus,
    confidence,
    observations,
    artifacts,
  };
  return { schema_version: "nuanu.qa-evidence-report.v1", document, sha256: sha256(document), document_slot: "evidence_report" };
}

function buildResult({ plan, branch, runId, attemptId, namespace, receipt, productResult, environmentStatus, evidenceStatus, confidence, code, observations = [], artifacts = [] }) {
  const artifactSlot = validateBranchResult({
    schema_version: "nuanu.qa-branch-result.v1",
    project_key: plan.project_key,
    commit: plan.commit,
    profile_digest: plan.profile_digest,
    branch,
    applicability: plan.applicability[branch],
    product_result: productResult,
    evidence_status: evidenceStatus,
  });
  return {
    ...artifactSlot,
    environment_status: environmentStatus,
    confidence,
    code,
    run_id: runId,
    attempt_id: attemptId,
    branch_namespace: namespace,
    environment_identity: receipt.environment_status === "READY" ? {
      environment_id: receipt.environment_id,
      target_namespace: receipt.target_namespace,
      repository_origin: receipt.repository_origin,
      commit: receipt.commit,
      content_hash: receipt.content_hash,
      instance_nonce: receipt.instance_nonce,
      base_url: receipt.base_url,
    } : null,
    evidence_report: evidenceReport({ branch, runId, attemptId, namespace, code, productResult, environmentStatus, evidenceStatus, confidence, observations, artifacts }),
    artifact_slot: artifactSlot,
  };
}

function infraResult(context, code = "TRANSPORT_FAILURE") {
  return buildResult({ ...context, productResult: "INCONCLUSIVE", environmentStatus: "INFRA_FAILURE", evidenceStatus: "UNVERIFIED", confidence: 0, code });
}

async function defaultExecute(file, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let totalOutputBytes = 0;
    let settled = false;
    const stop = (error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      rejectPromise(error);
    };
    const append = (current, chunk) => {
      totalOutputBytes += chunk.byteLength;
      if (totalOutputBytes > options.maxOutputBytes) {
        const error = new Error("branch output exceeds configured bound");
        error.code = "EOUTPUTLIMIT";
        stop(error);
      }
      return Buffer.concat([current, chunk]);
    };
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.once("error", stop);
    const timer = setTimeout(() => {
      const error = new Error("branch execution timed out");
      error.code = "ETIMEDOUT";
      stop(error);
    }, options.timeoutMs);
    child.once("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolvePromise({ exitCode, signal, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") });
    });
    child.stdin.end(options.stdin);
  });
}

export async function runBranch({ branch, plan: rawPlan, profile: rawProfile, environmentReceipt: rawReceipt, runId, attemptId, testDataProfile, execute = defaultExecute, environment = process.env }) {
  if (!BRANCHES.includes(branch)) throw new Error("branch is invalid");
  exactId(runId, "run_id");
  exactId(attemptId, "attempt_id");
  const profile = validateProfile(rawProfile);
  const plan = validatePlan(rawPlan, profile);
  const receipt = validateReceipt(rawReceipt, { plan, profile, runId, attemptId });
  const namespace = branchNamespace(runId, attemptId, branch);
  const context = { plan, branch, runId, attemptId, namespace, receipt };

  if (plan.applicability[branch] === "NOT_APPLICABLE") {
    return buildResult({ ...context, productResult: "SKIPPED", environmentStatus: receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED", evidenceStatus: "VERIFIED", confidence: 1, code: "NOT_APPLICABLE" });
  }
  if (branch === "domain") {
    if (typeof testDataProfile !== "string" || !profile.test_data.profiles.includes(testDataProfile)) throw new Error("domain branch requires a declared named test-data profile");
  } else if (testDataProfile !== undefined) {
    throw new Error("test-data profile is valid only for the domain branch");
  }
  if (receipt.environment_status !== "READY" && branch !== "code") return infraResult(context, "ENVIRONMENT_NOT_READY");
  if (branch === "ui") {
    const preparedOrigin = exactUrl(receipt.base_url, "prepared UI origin").origin;
    if (receipt.base_url !== preparedOrigin || !profile.safety.allowed_origins.includes(preparedOrigin)) throw new Error("prepared UI origin must exactly match a profile allowed origin");
  }

  const adapterInput = {
    schema_version: "nuanu.qa-branch-adapter-input.v1",
    branch,
    run_id: runId,
    attempt_id: attemptId,
    branch_namespace: namespace,
    test_data_profile: branch === "domain" ? testDataProfile : null,
    environment: receipt.environment_status === "READY" ? {
      base_url: receipt.base_url,
      commit: receipt.commit,
      content_hash: receipt.content_hash,
      environment_id: receipt.environment_id,
      instance_nonce: receipt.instance_nonce,
    } : null,
  };
  const stdin = canonicalJson(adapterInput);
  if (Buffer.byteLength(stdin) > Math.min(MAX_STDIN_BYTES, profile.execution.max_output_bytes)) throw new Error("canonical branch stdin exceeds configured bound");
  const command = profile.checks[branch];
  const executionDirectory = receipt.environment_status === "READY" ? join(dirname(receipt.state_file), "checkout") : process.cwd();
  let execution;
  try {
    execution = await execute(command[0], command.slice(1), {
      cwd: executionDirectory,
      env: minimalEnvironment(environment),
      shell: false,
      timeoutMs: profile.execution.timeout_ms,
      maxOutputBytes: profile.execution.max_output_bytes,
      stdin,
    });
  } catch {
    return infraResult(context);
  }
  if (!execution || typeof execution !== "object" || typeof execution.stdout !== "string" || typeof execution.stderr !== "string" || Buffer.byteLength(execution.stdout) + Buffer.byteLength(execution.stderr) > profile.execution.max_output_bytes) return infraResult(context);

  if (branch === "code") {
    const passed = execution.exitCode === 0;
    const observation = { code: passed ? "COMMAND_EXIT_ZERO" : "COMMAND_EXIT_NONZERO", status: passed ? "PASS" : "FAIL", value_sha256: sha256({ stdout: execution.stdout, stderr: execution.stderr, exit_code: execution.exitCode }) };
    return buildResult({ ...context, productResult: passed ? "PASS" : "FAIL", environmentStatus: receipt.environment_status === "READY" ? "HEALTHY" : "NOT_REQUIRED", evidenceStatus: "VERIFIED", confidence: 1, code: passed ? "COMMAND_PASSED" : "COMMAND_FAILED", observations: [observation] });
  }
  if (execution.exitCode !== 0) return infraResult(context, "ADAPTER_EXIT_FAILURE");
  try {
    const adapter = validateAdapterResult(JSON.parse(execution.stdout), branch);
    return buildResult({
      ...context,
      productResult: adapter.product_result,
      environmentStatus: adapter.environment_status,
      evidenceStatus: adapter.evidence_status,
      confidence: adapter.confidence,
      code: adapter.code,
      observations: adapter.observations,
      artifacts: adapter.artifacts,
    });
  } catch {
    return infraResult(context, "INVALID_ADAPTER_OUTPUT");
  }
}

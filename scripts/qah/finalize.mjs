import { canonicalJson, sha256 } from "./canonical.mjs";
import { COMMENT_HTML_MAX_BYTES, renderComment } from "./render-comment.mjs";

const TRUSTED_ARTIFACT_MAX_BYTES = 262_144;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const NAMESPACE = /^[a-f0-9]{64}$/;
const MARKER_PATTERN = /<!-- nuanu-qah-comment:v1:[a-f0-9]{64} -->/g;
const INPUT_KEYS = ["workspace_id", "project_id", "issue_id", "source_artifact", "decision", "review_bundle", "comment_receipt", "cleanup_receipt"];
const ARTIFACT_KEYS = ["artifact_id", "version_id", "kind", "role"];
const SOURCE_IDENTITY_KEYS = ["workspace_id", "project_id", "issue_id", "source_artifact"];
const REVIEW_RESOLUTION_KEYS = ["workspace_id", "review_bundle", "review"];
const RECEIPT_KEYS = ["schema_version", "publication_status", "workspace_id", "project_id", "issue_id", "comment_id", "source_artifact", "review_bundle", "decision_sha256", "marker", "comment_html_sha256"];
const LEASE_KEYS = ["run_id", "attempt_id", "environment_id", "target_namespace", "instance_nonce"];
const CLEANUP_KEYS = ["environment_status", ...LEASE_KEYS];
const READBACK_KEYS = ["enforced_max_body_bytes", "comment"];
const COMMENT_KEYS = ["comment_id", "workspace_id", "project_id", "issue_id", "comment_html"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isObject(value)) return false;
  try { return canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
  catch { return false; }
}

function same(left, right) {
  try { return canonicalJson(left) === canonicalJson(right); }
  catch { return false; }
}

function validRef(value, kind, role) {
  return exactKeys(value, ARTIFACT_KEYS) && UUID.test(value.artifact_id) && UUID.test(value.version_id)
    && value.kind === kind && value.role === role;
}

function targetState(decision) {
  return decision?.route === "READY_FOR_PRODUCTION" ? "ready_for_production" : "in_progress";
}

function result(decision, reasons) {
  const reasonCodes = [...new Set(reasons)].sort();
  return {
    schema_version: "nuanu.qa-finalization-result.v1",
    transition_allowed: reasonCodes.length === 0,
    target_state: targetState(decision),
    reason_codes: reasonCodes,
  };
}

function validateLease(value) {
  if (!exactKeys(value, LEASE_KEYS) || !ID.test(value.run_id ?? "") || !ID.test(value.attempt_id ?? "")
    || !ID.test(value.environment_id ?? "") || !NAMESPACE.test(value.target_namespace ?? "")
    || !(value.instance_nonce === null || UUID.test(value.instance_nonce ?? ""))
    || value.target_namespace !== sha256({ run_id: value.run_id, attempt_id: value.attempt_id, environment_id: value.environment_id }).slice("sha256:".length)) return false;
  return true;
}

function validateCommentReceipt(receipt, input, rendered) {
  return exactKeys(receipt, RECEIPT_KEYS)
    && receipt.schema_version === "nuanu.qa-comment-receipt.v1"
    && ["ALREADY_PRESENT", "ADDED", "RECONCILED"].includes(receipt.publication_status)
    && receipt.workspace_id === input.workspace_id && receipt.project_id === input.project_id && receipt.issue_id === input.issue_id
    && UUID.test(receipt.comment_id ?? "") && same(receipt.source_artifact, input.source_artifact)
    && same(receipt.review_bundle, input.review_bundle) && receipt.decision_sha256 === input.decision?.decision_sha256
    && receipt.marker === rendered.marker && DIGEST.test(receipt.comment_html_sha256 ?? "");
}

async function resolveSource(input, dependencies) {
  if (typeof dependencies?.resolveSourceIdentity !== "function") return false;
  let value;
  try {
    value = await dependencies.resolveSourceIdentity({ workspace_id: input.workspace_id, ref: { ...input.source_artifact }, max_bytes: TRUSTED_ARTIFACT_MAX_BYTES });
  } catch { return false; }
  return exactKeys(value, SOURCE_IDENTITY_KEYS) && value.workspace_id === input.workspace_id
    && value.project_id === input.project_id && value.issue_id === input.issue_id
    && same(value.source_artifact, input.source_artifact);
}

async function resolveReview(input, dependencies) {
  if (typeof dependencies?.resolveReviewBundle !== "function") return null;
  let value;
  try {
    value = await dependencies.resolveReviewBundle({ workspace_id: input.workspace_id, ref: { ...input.review_bundle }, max_bytes: TRUSTED_ARTIFACT_MAX_BYTES });
  } catch { return null; }
  if (!exactKeys(value, REVIEW_RESOLUTION_KEYS) || value.workspace_id !== input.workspace_id || !same(value.review_bundle, input.review_bundle)) return null;
  return value.review;
}

async function verifyCommentReadback(input, rendered, dependencies, reasons) {
  const receipt = input.comment_receipt;
  if (!validateCommentReceipt(receipt, input, rendered)) {
    reasons.add("COMMENT_RECEIPT_INVALID");
    return;
  }
  if (typeof dependencies?.readIssueComment !== "function") {
    reasons.add("COMMENT_READBACK_INVALID");
    return;
  }
  let readback;
  try {
    readback = await dependencies.readIssueComment({
      workspace_id: input.workspace_id,
      project_id: input.project_id,
      issue_id: input.issue_id,
      comment_id: receipt.comment_id,
      max_body_bytes: COMMENT_HTML_MAX_BYTES,
    });
  } catch {
    reasons.add("COMMENT_READBACK_INVALID");
    return;
  }
  const comment = readback?.comment;
  if (!exactKeys(readback, READBACK_KEYS) || readback.enforced_max_body_bytes !== COMMENT_HTML_MAX_BYTES
    || !exactKeys(comment, COMMENT_KEYS) || comment.comment_id !== receipt.comment_id
    || comment.workspace_id !== input.workspace_id || comment.project_id !== input.project_id || comment.issue_id !== input.issue_id
    || typeof comment.comment_html !== "string" || comment.comment_html.includes("\0")
    || Buffer.byteLength(comment.comment_html, "utf8") > COMMENT_HTML_MAX_BYTES) {
    reasons.add("COMMENT_READBACK_INVALID");
    return;
  }
  const markers = comment.comment_html.match(MARKER_PATTERN) ?? [];
  if (markers.length !== 1 || markers[0] !== rendered.marker) {
    reasons.add("COMMENT_MARKER_COUNT_INVALID");
    return;
  }
  if (sha256(comment.comment_html) !== receipt.comment_html_sha256
    || receipt.comment_html_sha256 !== rendered.comment_html_sha256) reasons.add("COMMENT_READBACK_INVALID");
}

function verifyCleanup(cleanup, trustedLease, reasons) {
  if (!validateLease(trustedLease)) {
    reasons.add("LEASE_INVALID");
    return;
  }
  if (!exactKeys(cleanup, CLEANUP_KEYS) || !same(Object.fromEntries(LEASE_KEYS.map((key) => [key, cleanup[key]])), trustedLease)) {
    reasons.add("CLEANUP_RECEIPT_INVALID");
    return;
  }
  if (!["STOPPED", "ABSENT"].includes(cleanup.environment_status)) reasons.add("CLEANUP_NOT_CONFIRMED");
}

export async function finalizeTransition(input, dependencies = {}) {
  const reasons = new Set();
  try {
    if (!exactKeys(input, INPUT_KEYS) || !UUID.test(input.workspace_id ?? "") || !UUID.test(input.project_id ?? "") || !UUID.test(input.issue_id ?? "")
      || !validRef(input.source_artifact, "flow_item", "source") || !validRef(input.review_bundle, "document", "evidence")) {
      reasons.add("FINALIZATION_INPUT_INVALID");
      return result(input?.decision, reasons);
    }
    const sourceValid = await resolveSource(input, dependencies);
    if (!sourceValid) reasons.add("SOURCE_IDENTITY_INVALID");
    const review = await resolveReview(input, dependencies);
    if (review === null) reasons.add("REVIEW_BUNDLE_INVALID");
    let rendered;
    if (review !== null) {
      try {
        rendered = renderComment({ source_artifact: input.source_artifact, decision: input.decision, review_bundle: input.review_bundle, review });
      } catch { reasons.add("DECISION_OR_REVIEW_INVALID"); }
    }
    if (rendered) await verifyCommentReadback(input, rendered, dependencies, reasons);
    else reasons.add("COMMENT_RECEIPT_INVALID");
    verifyCleanup(input.cleanup_receipt, review?.environment_lease, reasons);
    return result(input.decision, reasons);
  } catch {
    reasons.add("FINALIZATION_INPUT_INVALID");
    return result(input?.decision, reasons);
  }
}

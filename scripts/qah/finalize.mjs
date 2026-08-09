import { sha256 } from "./canonical.mjs";
import {
  artifactReference,
  exactKeys,
  locateMarker,
  readGlobalComments,
  renderComment,
  resolveTrustedPublication,
  same,
} from "./render-comment.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RECEIPT_KEYS = ["schema_version", "publication_status", "workspace_id", "project_id", "issue_id", "comment_id", "source_artifact", "review_bundle", "decision_sha256", "marker", "comment_html_sha256"];
const MANAGED_CLEANUP_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace", "instance_nonce"];
const NONE_CLEANUP_KEYS = ["environment_status", "run_id", "attempt_id", "environment_id", "target_namespace"];

function result(decision, reasons) {
  const reasonCodes = [...new Set(reasons)].sort();
  return {
    schema_version: "nuanu.qa-finalization-result.v1",
    transition_allowed: reasonCodes.length === 0,
    target_state: decision?.route === "READY_FOR_PRODUCTION" ? "ready_for_production" : "in_progress",
    reason_codes: reasonCodes,
  };
}

function validReceipt(value, input, trusted, rendered) {
  return exactKeys(value, RECEIPT_KEYS) && value.schema_version === "nuanu.qa-comment-receipt.v1"
    && ["ALREADY_PRESENT", "ADDED", "RECONCILED"].includes(value.publication_status)
    && value.workspace_id === input.workspace_id && value.project_id === input.project_id && value.issue_id === input.issue_id
    && UUID.test(value.comment_id ?? "") && same(value.source_artifact, input.source_artifact) && same(value.review_bundle, input.review_bundle)
    && value.decision_sha256 === trusted.decision.decision_sha256 && value.marker === rendered.marker
    && value.comment_html_sha256 === rendered.comment_html_sha256;
}

async function verifyComment(input, trusted, rendered, dependencies, reasons) {
  const receipt = input.comment_receipt;
  if (!validReceipt(receipt, input, trusted, rendered)) {
    reasons.add("COMMENT_RECEIPT_INVALID");
    return;
  }
  try {
    const comments = await readGlobalComments(input, dependencies);
    const comment = locateMarker(comments, rendered.marker);
    if (!comment || comment.comment_id !== receipt.comment_id || comment.comment_html !== rendered.comment_html
      || sha256(comment.comment_html) !== receipt.comment_html_sha256) reasons.add("COMMENT_READBACK_INVALID");
  } catch (error) {
    reasons.add(error?.message === "DUPLICATE_COMMENT_MARKER" || error?.message === "ENCODED_COMMENT_MARKER"
      ? "COMMENT_MARKER_COUNT_INVALID" : "COMMENT_READBACK_INVALID");
  }
}

function expectedCleanup(aggregate) {
  return {
    run_id: aggregate.run_id,
    attempt_id: aggregate.attempt_id,
    environment_id: aggregate.environment_id,
    target_namespace: aggregate.target_namespace,
  };
}

function verifyCleanup(cleanup, trusted, reasons) {
  const aggregate = trusted.aggregate;
  const strategy = trusted.profile?.environment?.strategy;
  const expected = expectedCleanup(aggregate);
  if (strategy === "none" && aggregate.environment_status === "NOT_REQUIRED" && aggregate.instance_nonce === null) {
    if (!exactKeys(cleanup, NONE_CLEANUP_KEYS) || cleanup.environment_status !== "ABSENT"
      || !same(Object.fromEntries(NONE_CLEANUP_KEYS.slice(1).map((key) => [key, cleanup[key]])), expected)) reasons.add("CLEANUP_RECEIPT_INVALID");
    return;
  }
  if (strategy === "managed_command" && aggregate.environment_status === "READY" && UUID.test(aggregate.instance_nonce ?? "")) {
    if (!exactKeys(cleanup, MANAGED_CLEANUP_KEYS) || cleanup.environment_status !== "STOPPED"
      || !same(Object.fromEntries(MANAGED_CLEANUP_KEYS.slice(1, -1).map((key) => [key, cleanup[key]])), expected)
      || cleanup.instance_nonce !== aggregate.instance_nonce) reasons.add("CLEANUP_RECEIPT_INVALID");
    return;
  }
  reasons.add("CLEANUP_POLICY_INVALID");
}

export async function finalizeTransition(input, dependencies = {}) {
  const reasons = new Set();
  let trusted;
  try {
    if (!exactKeys(input, ["workspace_id", "project_id", "issue_id", "source_artifact", "review_bundle", "comment_receipt", "cleanup_receipt"])
      || !UUID.test(input?.workspace_id ?? "") || !UUID.test(input?.project_id ?? "") || !UUID.test(input?.issue_id ?? "")) {
      return result(null, ["FINALIZATION_INPUT_INVALID"]);
    }
    artifactReference(input.source_artifact, "flow_item", "source");
    artifactReference(input.review_bundle, "document", "evidence");
    trusted = await resolveTrustedPublication(input, dependencies);
  } catch (error) {
    return result(null, [error?.message === "INVALID_AGGREGATE" ? "INVALID_AGGREGATE" : "TRUSTED_REVIEW_INVALID"]);
  }
  try {
    const rendered = renderComment({ source_artifact: input.source_artifact, decision: trusted.decision, review_bundle: input.review_bundle, review_summary: trusted.review_summary });
    await verifyComment(input, trusted, rendered, dependencies, reasons);
    verifyCleanup(input.cleanup_receipt, trusted, reasons);
  } catch {
    reasons.add("FINALIZATION_INPUT_INVALID");
  }
  return result(trusted.decision, reasons);
}

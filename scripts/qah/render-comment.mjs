import { canonicalJson, sha256 } from "./canonical.mjs";

export const COMMENT_HTML_MAX_BYTES = 8_192;
const TRUSTED_ARTIFACT_MAX_BYTES = 262_144;
const COMMENT_LIST_MAX = 100;
const BRANCHES = Object.freeze(["code", "api", "ui", "domain"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const NAMESPACE = /^[a-f0-9]{64}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MARKER = /^<!-- nuanu-qah-comment:v1:[a-f0-9]{64} -->$/;
const ANY_MARKER = /<!-- nuanu-qah-comment:v1:[a-f0-9]{64} -->/g;
const ARTIFACT_KEYS = ["artifact_id", "version_id", "kind", "role"];
const DECISION_KEYS = ["schema_version", "aggregate_sha256", "route", "reason_codes", "policy_override_rejected", "explanation", "decision_sha256"];
const REVIEW_KEYS = ["schema_version", "selected_checks", "skipped_checks", "commit", "content_hash", "finding_count", "environment_lease"];
const LEASE_KEYS = ["run_id", "attempt_id", "environment_id", "target_namespace", "instance_nonce"];
const SOURCE_IDENTITY_KEYS = ["workspace_id", "project_id", "issue_id", "source_artifact"];
const RESOLVED_REVIEW_KEYS = ["workspace_id", "review_bundle", "review"];
const COMMENT_KEYS = ["comment_id", "workspace_id", "project_id", "issue_id", "comment_html"];
const COMMENT_LIST_KEYS = ["enforced_max_comments", "enforced_max_body_bytes", "comments"];

class CommentPolicyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

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

function artifactReference(value, expectedKind, expectedRole) {
  if (!exactKeys(value, ARTIFACT_KEYS)
    || !UUID.test(value.artifact_id) || !UUID.test(value.version_id)
    || value.kind !== expectedKind || value.role !== expectedRole) {
    throw new CommentPolicyError("INVALID_ARTIFACT_REFERENCE");
  }
  return { ...value };
}

function validateDecision(value) {
  if (!exactKeys(value, DECISION_KEYS)
    || value.schema_version !== "nuanu.qa-release-route.v1"
    || !(value.aggregate_sha256 === null || DIGEST.test(value.aggregate_sha256))
    || !["READY_FOR_PRODUCTION", "RETURN_TO_IN_PROGRESS"].includes(value.route)
    || typeof value.policy_override_rejected !== "boolean"
    || !Array.isArray(value.reason_codes) || value.reason_codes.length > 64
    || new Set(value.reason_codes).size !== value.reason_codes.length
    || value.reason_codes.some((code) => typeof code !== "string" || !CODE.test(code))
    || !exactKeys(value.explanation, ["summary", "reason_codes"])
    || typeof value.explanation.summary !== "string" || value.explanation.summary.length > 512
    || value.explanation.summary.includes("\0")
    || !Array.isArray(value.explanation.reason_codes) || value.explanation.reason_codes.length > 8
    || new Set(value.explanation.reason_codes).size !== value.explanation.reason_codes.length
    || value.explanation.reason_codes.some((code) => typeof code !== "string" || !CODE.test(code))
    || !DIGEST.test(value.decision_sha256)) throw new CommentPolicyError("INVALID_RELEASE_DECISION");
  const { decision_sha256: claimed, ...unsigned } = value;
  if (sha256(unsigned) !== claimed) throw new CommentPolicyError("INVALID_RELEASE_DECISION");
  if (value.route === "READY_FOR_PRODUCTION" && value.aggregate_sha256 === null) throw new CommentPolicyError("INVALID_RELEASE_DECISION");
  return value;
}

function normalizeReview(value) {
  if (!exactKeys(value, REVIEW_KEYS)
    || value.schema_version !== "nuanu.qa-review-bundle.v1"
    || !COMMIT.test(value.commit) || !DIGEST.test(value.content_hash)
    || !Number.isSafeInteger(value.finding_count) || value.finding_count < 0 || value.finding_count > 1_000_000) {
    throw new CommentPolicyError("INVALID_REVIEW_BUNDLE");
  }
  const normalizeChecks = (checks) => {
    if (!Array.isArray(checks) || checks.length > BRANCHES.length || new Set(checks).size !== checks.length
      || checks.some((branch) => !BRANCHES.includes(branch))) throw new CommentPolicyError("INVALID_REVIEW_BUNDLE");
    return BRANCHES.filter((branch) => checks.includes(branch));
  };
  const selectedChecks = normalizeChecks(value.selected_checks);
  const skippedChecks = normalizeChecks(value.skipped_checks);
  if (selectedChecks.some((branch) => skippedChecks.includes(branch))
    || new Set([...selectedChecks, ...skippedChecks]).size !== BRANCHES.length) throw new CommentPolicyError("INVALID_REVIEW_BUNDLE");
  const lease = value.environment_lease;
  if (!exactKeys(lease, LEASE_KEYS) || !ID.test(lease.run_id ?? "") || !ID.test(lease.attempt_id ?? "")
    || !ID.test(lease.environment_id ?? "") || !NAMESPACE.test(lease.target_namespace ?? "")
    || !(lease.instance_nonce === null || UUID.test(lease.instance_nonce ?? ""))
    || lease.target_namespace !== sha256({ run_id: lease.run_id, attempt_id: lease.attempt_id, environment_id: lease.environment_id }).slice("sha256:".length)) {
    throw new CommentPolicyError("INVALID_REVIEW_BUNDLE");
  }
  return { ...value, selected_checks: selectedChecks, skipped_checks: skippedChecks };
}

function markerDigestInput(sourceArtifact, decisionSha256, bundle) {
  return {
    source_artifact_id: sourceArtifact.artifact_id,
    source_version_id: sourceArtifact.version_id,
    decision_sha256: decisionSha256,
    review_bundle_artifact_id: bundle.artifact_id,
    review_bundle_version_id: bundle.version_id,
  };
}

export function escapeHtml(value) {
  if (typeof value !== "string") throw new CommentPolicyError("INVALID_HTML_VALUE");
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function markerFor(input) {
  if (!exactKeys(input, ["source_artifact", "decision_sha256", "review_bundle"]) || !DIGEST.test(input.decision_sha256)) {
    throw new CommentPolicyError("INVALID_MARKER_INPUT");
  }
  const source = artifactReference(input.source_artifact, "flow_item", "source");
  const bundle = artifactReference(input.review_bundle, "document", "evidence");
  const marker = `<!-- nuanu-qah-comment:v1:${sha256(markerDigestInput(source, input.decision_sha256, bundle)).slice("sha256:".length)} -->`;
  if (!MARKER.test(marker)) throw new CommentPolicyError("INVALID_MARKER_INPUT");
  return marker;
}

function listHtml(values) {
  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

export function renderComment(input) {
  if (!exactKeys(input, ["source_artifact", "decision", "review_bundle", "review"])) throw new CommentPolicyError("INVALID_COMMENT_INPUT");
  const source = artifactReference(input.source_artifact, "flow_item", "source");
  const bundle = artifactReference(input.review_bundle, "document", "evidence");
  const decision = validateDecision(input.decision);
  const normalizedReview = normalizeReview(input.review);
  const marker = markerFor({ source_artifact: source, decision_sha256: decision.decision_sha256, review_bundle: bundle });
  const reasons = decision.reason_codes.length > 0 ? decision.reason_codes : ["NONE"];
  const selected = normalizedReview.selected_checks.length > 0 ? normalizedReview.selected_checks : ["NONE"];
  const skipped = normalizedReview.skipped_checks.length > 0 ? normalizedReview.skipped_checks : ["NONE"];
  const sourceIdentity = `${source.artifact_id}@${source.version_id}`;
  const bundleIdentity = `${bundle.artifact_id}@${bundle.version_id}`;
  const commentHtml = [
    marker,
    `<p><strong>QA result:</strong> ${escapeHtml(decision.route)}</p>`,
    "<p><strong>Reason codes:</strong></p>",
    listHtml(reasons),
    "<p><strong>Selected checks:</strong></p>",
    listHtml(selected),
    "<p><strong>Skipped checks:</strong></p>",
    listHtml(skipped),
    `<p><strong>Build commit:</strong> ${escapeHtml(normalizedReview.commit)}</p>`,
    `<p><strong>Build content hash:</strong> ${escapeHtml(normalizedReview.content_hash)}</p>`,
    `<p><strong>Confirmed findings:</strong> ${escapeHtml(String(normalizedReview.finding_count))}</p>`,
    `<p><strong>Source Artifact@version:</strong> ${escapeHtml(sourceIdentity)}</p>`,
    `<p><strong>Review bundle Artifact@version:</strong> ${escapeHtml(bundleIdentity)}</p>`,
  ].join("");
  if (Buffer.byteLength(commentHtml, "utf8") > COMMENT_HTML_MAX_BYTES) throw new CommentPolicyError("COMMENT_HTML_SIZE_LIMIT");
  return { marker, comment_html: commentHtml, comment_html_sha256: sha256(commentHtml) };
}

function validateSourceIdentity(value, input) {
  if (!exactKeys(value, SOURCE_IDENTITY_KEYS)
    || value.workspace_id !== input.workspace_id || value.project_id !== input.project_id || value.issue_id !== input.issue_id
    || !UUID.test(value.workspace_id) || !UUID.test(value.project_id) || !UUID.test(value.issue_id)
    || !same(value.source_artifact, input.source_artifact)) throw new CommentPolicyError("SOURCE_IDENTITY_MISMATCH");
  artifactReference(value.source_artifact, "flow_item", "source");
  return value;
}

function validateResolvedReview(value, input) {
  if (!exactKeys(value, RESOLVED_REVIEW_KEYS) || value.workspace_id !== input.workspace_id
    || !same(value.review_bundle, input.review_bundle)) throw new CommentPolicyError("REVIEW_BUNDLE_MISMATCH");
  artifactReference(value.review_bundle, "document", "evidence");
  return normalizeReview(value.review);
}

async function resolveTrustedInputs(input, dependencies) {
  if (typeof dependencies?.resolveSourceIdentity !== "function") throw new CommentPolicyError("SOURCE_IDENTITY_RESOLVER_REQUIRED");
  if (typeof dependencies?.resolveReviewBundle !== "function") throw new CommentPolicyError("REVIEW_BUNDLE_RESOLVER_REQUIRED");
  let source;
  let bundle;
  try {
    source = await dependencies.resolveSourceIdentity({ workspace_id: input.workspace_id, ref: { ...input.source_artifact }, max_bytes: TRUSTED_ARTIFACT_MAX_BYTES });
  } catch { throw new CommentPolicyError("SOURCE_IDENTITY_MISMATCH"); }
  validateSourceIdentity(source, input);
  try {
    bundle = await dependencies.resolveReviewBundle({ workspace_id: input.workspace_id, ref: { ...input.review_bundle }, max_bytes: TRUSTED_ARTIFACT_MAX_BYTES });
  } catch { throw new CommentPolicyError("REVIEW_BUNDLE_MISMATCH"); }
  return { source, review: validateResolvedReview(bundle, input) };
}

function validateComment(value, identity) {
  if (!exactKeys(value, COMMENT_KEYS) || !UUID.test(value.comment_id)
    || value.workspace_id !== identity.workspace_id || value.project_id !== identity.project_id || value.issue_id !== identity.issue_id
    || typeof value.comment_html !== "string" || value.comment_html.includes("\0")
    || Buffer.byteLength(value.comment_html, "utf8") > COMMENT_HTML_MAX_BYTES) throw new CommentPolicyError("INVALID_COMMENT_READBACK");
  return value;
}

async function listComments(input, dependencies) {
  if (typeof dependencies?.listIssueComments !== "function") throw new CommentPolicyError("COMMENT_READBACK_REQUIRED");
  let result;
  try {
    result = await dependencies.listIssueComments({
      workspace_id: input.workspace_id,
      project_id: input.project_id,
      issue_id: input.issue_id,
      max_comments: COMMENT_LIST_MAX,
      max_body_bytes: COMMENT_HTML_MAX_BYTES,
    });
  } catch { throw new CommentPolicyError("COMMENT_READBACK_UNCERTAIN"); }
  if (!exactKeys(result, COMMENT_LIST_KEYS)
    || result.enforced_max_comments !== COMMENT_LIST_MAX || result.enforced_max_body_bytes !== COMMENT_HTML_MAX_BYTES
    || !Array.isArray(result.comments) || result.comments.length > COMMENT_LIST_MAX) throw new CommentPolicyError("INVALID_COMMENT_READBACK");
  return result.comments.map((comment) => validateComment(comment, input));
}

function markerMatches(comments, marker) {
  const matches = [];
  let occurrences = 0;
  let mixedMarkerComment = false;
  for (const comment of comments) {
    const allMarkers = comment.comment_html.match(ANY_MARKER) ?? [];
    const exactCount = allMarkers.filter((candidate) => candidate === marker).length;
    occurrences += exactCount;
    if (exactCount > 0) {
      matches.push(comment);
      if (allMarkers.length !== 1) mixedMarkerComment = true;
    }
  }
  return { occurrences, matches, mixedMarkerComment };
}

function commentReceipt(input, rendered, comment, publicationStatus) {
  return {
    schema_version: "nuanu.qa-comment-receipt.v1",
    publication_status: publicationStatus,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    issue_id: input.issue_id,
    comment_id: comment.comment_id,
    source_artifact: { ...input.source_artifact },
    review_bundle: { ...input.review_bundle },
    decision_sha256: input.decision.decision_sha256,
    marker: rendered.marker,
    comment_html_sha256: sha256(comment.comment_html),
  };
}

export async function publishComment(input, dependencies = {}) {
  if (!exactKeys(input, ["workspace_id", "project_id", "issue_id", "source_artifact", "decision", "review_bundle"])
    || !UUID.test(input.workspace_id ?? "") || !UUID.test(input.project_id ?? "") || !UUID.test(input.issue_id ?? "")) {
    throw new CommentPolicyError("INVALID_PUBLICATION_INPUT");
  }
  artifactReference(input.source_artifact, "flow_item", "source");
  artifactReference(input.review_bundle, "document", "evidence");
  validateDecision(input.decision);
  const { review } = await resolveTrustedInputs(input, dependencies);
  const rendered = renderComment({ source_artifact: input.source_artifact, decision: input.decision, review_bundle: input.review_bundle, review });
  let comments = await listComments(input, dependencies);
  let matched = markerMatches(comments, rendered.marker);
  if (matched.mixedMarkerComment || matched.occurrences > 1 || matched.matches.length > 1) throw new CommentPolicyError("DUPLICATE_COMMENT_MARKER");
  if (matched.occurrences === 1 && matched.matches.length === 1) {
    return commentReceipt(input, rendered, matched.matches[0], "ALREADY_PRESENT");
  }
  if (typeof dependencies?.addIssueComment !== "function") throw new CommentPolicyError("COMMENT_WRITER_REQUIRED");
  let ambiguous = false;
  try {
    await dependencies.addIssueComment({
      workspace_id: input.workspace_id,
      project_id: input.project_id,
      issue_id: input.issue_id,
      comment_html: rendered.comment_html,
    });
  } catch { ambiguous = true; }
  comments = await listComments(input, dependencies);
  matched = markerMatches(comments, rendered.marker);
  if (matched.mixedMarkerComment || matched.occurrences > 1 || matched.matches.length > 1) throw new CommentPolicyError("DUPLICATE_COMMENT_MARKER");
  if (matched.occurrences !== 1 || matched.matches.length !== 1) throw new CommentPolicyError("COMMENT_NOT_FOUND_AFTER_WRITE");
  return commentReceipt(input, rendered, matched.matches[0], ambiguous ? "RECONCILED" : "ADDED");
}

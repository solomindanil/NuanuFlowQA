import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalJson } from "../../scripts/qah/canonical.mjs";
import {
  deriveUiGraphCanaryScenario,
  runUiGraphCanaryPhase,
} from "../../scripts/qah/ui-graph-canary.mjs";

const SOURCE_REF = Object.freeze({
  artifact_id: "92400946-cc1f-5731-b1aa-af14a9765b7a",
  version_id: "103a0d1b-7d39-4512-b5f6-06cc1b64a527",
  kind: "flow_item",
  role: "source",
});
const VERIFICATION_REF = Object.freeze({
  artifact_id: "11111111-1111-4111-8111-111111111111",
  version_id: "22222222-2222-4222-8222-222222222222",
  kind: "document",
  role: "output",
});
const FINALIZATION_REF = Object.freeze({
  artifact_id: "33333333-3333-4333-8333-333333333333",
  version_id: "44444444-4444-4444-8444-444444444444",
  kind: "document",
  role: "output",
});

const CRITICAL_SNAPSHOT = Object.freeze({
  issue_id: "ac868a24-f0c4-4012-adac-e7b38b4b87f8",
  identifier: "PAYD-29",
  title: "[CANARY] Verify card checkout change",
  description: "The ticket changes card payment confirmation and checkout business rules.",
  project_key: "paydemo",
  state_name: "Ready for QA",
  labels: ["canary", "payments"],
  updated_at: "2026-08-12T00:00:00.000Z",
});

function prepareInput(snapshot = CRITICAL_SNAPSHOT) {
  return {
    phase: "prepare",
    source_ref: SOURCE_REF,
    source_name: `${snapshot.identifier} · ${snapshot.title}`,
    source_media_type: "application/vnd.nuanu.flow-item+json",
    source_snapshot: structuredClone(snapshot),
  };
}

async function fixture(t) {
  const taskRoot = await mkdtemp(join(tmpdir(), "qah-ui-graph-canary-"));
  t.after(() => rm(taskRoot, { recursive: true, force: true }));
  return { taskRoot, outputDir: join(taskRoot, "qah", "ui-graph-canary") };
}

test("payment and business-function facts deterministically require a human", () => {
  assert.deepEqual(deriveUiGraphCanaryScenario(CRITICAL_SNAPSHOT), {
    scenario: "critical",
    change_hints: ["payment-checkout"],
    matched_knowledge_rules: ["business-function", "payment"],
  });
});

test("ordinary UI and API changes remain machine-analyzable", () => {
  const snapshot = {
    ...CRITICAL_SNAPSHOT,
    title: "Update profile avatar",
    description: "Change profile API response and avatar UI rendering.",
    labels: ["profile"],
  };
  assert.deepEqual(deriveUiGraphCanaryScenario(snapshot), {
    scenario: "noncritical",
    change_hints: ["profile-api", "profile-ui"],
    matched_knowledge_rules: [],
  });
});

test("Ready for QA UI canary executes the graph plan and publishes a human-review Proof Gate claim", async (t) => {
  const value = await fixture(t);
  const prepared = await runUiGraphCanaryPhase("prepare", prepareInput(), value);
  assert.equal(prepared.phase, "prepared");
  assert.deepEqual(prepared.files.map(({ slot, media_type }) => ({ slot, media_type })), [
    { slot: "qah_verification", media_type: "application/json" },
  ]);

  const verificationSource = await readFile(join(value.outputDir, "qah-verification.json"), "utf8");
  const verification = JSON.parse(verificationSource);
  assert.equal(verificationSource, canonicalJson(verification));
  assert.equal(verification.schema_version, "nuanu.qah-ui-graph-verification.v1");
  assert.equal(verification.source_snapshot.identifier, "PAYD-29");
  assert.equal(verification.graph_scenario, "critical");
  assert.equal(verification.receipt.trigger, "column:ready_for_qa");
  assert.equal(verification.receipt.route, "HUMAN_REVIEW");
  assert.equal(verification.receipt.proof_gate_outcome, "unable_to_verify");
  assert.equal(verification.receipt.criticality, "HUMAN_REQUIRED");
  assert.deepEqual(verification.receipt.human_check_ids, ["payment.card-human-approval"]);
  assert.deepEqual(verification.receipt.executed_check_ids, ["qah.contracts", "payment.api", "payment.domain"]);
  assert.deepEqual(verification.receipt.authority_telemetry, {
    product_repository_reads: 0,
    git_commands: 0,
    product_network_requests: 0,
    credential_reads: 0,
  });

  const finalized = await runUiGraphCanaryPhase("finalize", {
    phase: "finalize",
    artifact_refs: { qah_verification: VERIFICATION_REF },
  }, value);
  assert.equal(finalized.phase, "finalization_prepared");
  const report = JSON.parse(await readFile(join(value.outputDir, "finalization.json"), "utf8"));
  assert.equal(report.schema_version, "nuanu.qah-ui-graph-finalization.v1");
  assert.equal(report.route, "HUMAN_REVIEW");
  assert.deepEqual(report.reason_codes, ["HUMAN_ONLY_BUSINESS_FUNCTION", "PAYMENT_IMPACT"]);
  assert.deepEqual(report.claim, {
    transition_allowed: true,
    target_state: "ready_for_qa",
    reason_codes: [],
    kind: "qa",
    verdict: "blocked",
    tested_head_sha: verification.receipt.proof_gate_claim.tested_head_sha,
    checks: verification.receipt.proof_gate_claim.checks,
  });

  const completed = await runUiGraphCanaryPhase("complete", {
    phase: "complete",
    artifact_refs: {
      qah_verification: VERIFICATION_REF,
      finalization_report: FINALIZATION_REF,
    },
  }, value);
  assert.deepEqual(completed.item.data, report.claim);
  assert.deepEqual(completed.artifact_outputs, {
    "item.artifacts.qah_verification": VERIFICATION_REF,
    "item.artifacts.finalization_report": FINALIZATION_REF,
  });
});

test("UI canary rejects unbounded or identity-conflicting Flow snapshots before execution", async (t) => {
  const value = await fixture(t);
  const conflictingIdentity = prepareInput({ ...CRITICAL_SNAPSHOT, identifier: "PAYD-30" });
  conflictingIdentity.source_name = `PAYD-29 · ${conflictingIdentity.source_snapshot.title}`;
  for (const hostile of [
    { ...prepareInput(), ambient_token: "forbidden" },
    conflictingIdentity,
    prepareInput({ ...CRITICAL_SNAPSHOT, state_name: "In Progress" }),
    prepareInput({ ...CRITICAL_SNAPSHOT, labels: Array.from({ length: 17 }, (_, index) => `label-${index}`) }),
    prepareInput({ ...CRITICAL_SNAPSHOT, description: "x".repeat(20_001) }),
  ]) {
    await assert.rejects(() => runUiGraphCanaryPhase("prepare", hostile, value));
  }
});

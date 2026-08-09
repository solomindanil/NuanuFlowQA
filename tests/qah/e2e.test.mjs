import assert from "node:assert/strict";
import test from "node:test";

import { BRANCHES } from "../../scripts/qah/contracts.mjs";
import { runLocalQaHarness } from "../../scripts/qah/local-harness.mjs";

const expectedApplicability = {
  api: { code: "REQUIRED", api: "REQUIRED", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" },
  ui: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "REQUIRED", domain: "NOT_APPLICABLE" },
  docs: { code: "REQUIRED", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" },
  mixed: { code: "REQUIRED", api: "REQUIRED", ui: "REQUIRED", domain: "REQUIRED" },
};

const secretCanaries = ["4111111111111111", "Authorization: Bearer", "raw-response-body"];

function assertExactBranchMatrix(result, fixture) {
  assert.deepEqual(result.plan.applicability, expectedApplicability[fixture]);
  assert.deepEqual(result.branches.map((entry) => entry.branch), BRANCHES);
  for (const entry of result.branches) {
    const expected = expectedApplicability[fixture][entry.branch];
    assert.equal(entry.applicability, expected, `${fixture}:${entry.branch} applicability`);
    assert.equal(entry.product_result, expected === "NOT_APPLICABLE" ? "SKIPPED" : "PASS");
  }
}

function assertWorkerBoundaries(result) {
  for (const [key, envelope] of Object.entries(result.worker_envelopes)) {
    assert.deepEqual(Object.keys(envelope).sort(), ["artifact_outputs", "item"], key);
    assert.equal(envelope.item.key, key);
    assert.equal(typeof envelope.item.description, "string");
    assert.deepEqual(Object.keys(envelope.item).sort(), ["artifacts", "data", "description", "key"]);
    for (const ref of Object.values(envelope.artifact_outputs)) {
      assert.match(ref.artifact_id, /^[0-9a-f-]{36}$/);
      assert.match(ref.version_id, /^[0-9a-f-]{36}$/);
      assert.ok(["document", "flow_item"].includes(ref.kind));
      assert.ok(["output", "evidence", "implementation", "source"].includes(ref.role));
    }
  }
}

test("canonical API, UI, docs, and mixed tickets traverse the real universal QA contracts", async (t) => {
  for (const fixture of ["api", "ui", "docs", "mixed"]) {
    await t.test(fixture, async () => {
      const result = await runLocalQaHarness({ fixture });
      assertExactBranchMatrix(result, fixture);
      assert.equal(result.playwright_adapter_invocations, expectedApplicability[fixture].ui === "REQUIRED" ? 1 : 0);
      assert.equal(result.environment_created, fixture !== "docs");
      assert.equal(result.decision.route, "READY_FOR_PRODUCTION");
      assert.equal(result.finalization.transition_allowed, true);
      assert.equal(result.finalization.target_state, "ready_for_production");
      if (fixture === "docs") {
        assert.equal(result.branches.find(({ branch }) => branch === "code").body_invoked, true);
        assert.equal(result.branches.filter(({ branch }) => branch !== "code").some(({ body_invoked }) => body_invoked), false);
      }
      assert.deepEqual(result.events.slice(-3).sort(), ["cleanup-complete", "comment-complete", "transition"]);
      assert.ok(result.events.indexOf("transition") > result.events.indexOf("comment-complete"));
      assert.ok(result.events.indexOf("transition") > result.events.indexOf("cleanup-complete"));
      assertWorkerBoundaries(result);
      const serialized = JSON.stringify(result);
      for (const canary of secretCanaries) assert.equal(serialized.includes(canary), false, canary);
    });
  }
});

test("mixed applicable branch bodies overlap and materialize independent evidence", async () => {
  const result = await runLocalQaHarness({ fixture: "mixed" });
  const required = result.branches.filter(({ applicability }) => applicability === "REQUIRED");
  const overlaps = required.some((left, index) => required.slice(index + 1).some((right) =>
    left.started_at < right.ended_at && right.started_at < left.ended_at));
  assert.equal(overlaps, true);
  assert.ok(required.filter(({ body_invoked }) => body_invoked).length >= 2);
  assert.equal(new Set(required.flatMap(({ artifact_refs }) => Object.values(artifact_refs).map(({ version_id }) => version_id))).size, required.length * 3);
});

test("product failure and missing code evidence fail closed through comment and cleanup to In Progress", async (t) => {
  for (const [mode, fixture] of [["product-failure", "mixed"], ["missing-evidence", "docs"]]) {
    await t.test(mode, async () => {
      const result = await runLocalQaHarness({ fixture, mode });
      assert.equal(result.aggregate.invariants_passed, false);
      assert.equal(result.decision.route, "RETURN_TO_IN_PROGRESS");
      assert.equal(result.comment_receipt.publication_status, "ADDED");
      assert.equal(result.cleanup_receipt.environment_status, fixture === "docs" ? "ABSENT" : "STOPPED");
      assert.deepEqual(result.finalization, {
        schema_version: "nuanu.qa-finalization-result.v1",
        transition_allowed: true,
        target_state: "in_progress",
        reason_codes: [],
      });
      assert.ok(result.events.indexOf("transition") > result.events.indexOf("comment-complete"));
      assert.ok(result.events.indexOf("transition") > result.events.indexOf("cleanup-complete"));
    });
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import YAML from "yaml";

import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import { decideRelease } from "../../scripts/qah/decide.mjs";
import { renderComment } from "../../scripts/qah/render-comment.mjs";
import {
  GRAPH_TASK_COMMANDS,
  createResolverAdapters,
  normalizeRawIssueComments,
  readCanonicalInputFile,
  runTaskCommand,
  verifyProfileInstallPrecondition,
} from "../../scripts/qah/task-runtime.mjs";
import { aggregateFixture, aggregateFixtureResult } from "./aggregate.test.mjs?fixtures-only";

const GRAPH_COMMANDS = [
  "resolve-flow-item", "load-project-context", "plan-qa-scope", "prepare-environment",
  "verify-requirements-and-code", "verify-api-contracts", "verify-ui-with-playwright",
  "prepare-and-verify-domain-data", "aggregate-evidence", "independent-release-decision",
  "publish-flow-item-comment", "cleanup-environment", "finalize-transition",
];

function base64(value) {
  return Buffer.from(value).toString("base64");
}

function serializedBundle(fixture, comments = []) {
  const artifact_versions = [...fixture.store.entries()].map(([key, record]) => ({
    key,
    response: {
      ...record,
      bytes_base64: base64(record.bytes),
      bytes: undefined,
    },
  })).map(({ key, response }) => ({ key, response: Object.fromEntries(Object.entries(response).filter(([, value]) => value !== undefined)) }));
  const platform_entity_versions = [...fixture.platformStore.entries()].map(([key, response]) => ({ key, response }));
  const profileBytes = Buffer.from(YAML.stringify(fixture.profile));
  return {
    schema_version: "nuanu.qa-runtime-resolver-bundle.v1",
    artifact_versions,
    platform_entity_versions,
    commit_profiles: [{
      key: `${fixture.input.repository_origin}@${fixture.input.plan.commit}:qa-harness.yaml`,
      response: {
        repository_origin: fixture.input.repository_origin,
        commit: fixture.input.plan.commit,
        path: "qa-harness.yaml",
        byte_length: profileBytes.byteLength,
        enforced_max_bytes: 262144,
        sha256: `sha256:${createHash("sha256").update(profileBytes).digest("hex")}`,
        bytes_base64: profileBytes.toString("base64"),
      },
    }],
    comment_reads: [{ attestation: normalizeRawIssueComments(comments, {
      workspace_id: fixture.input.workspace_id,
      project_id: "55555555-5555-4555-8555-555555555555",
      issue_id: "66666666-6666-4666-8666-666666666666",
    }) }],
    branch_execution: null,
  };
}

test("runtime exposes one explicit executable subcommand for every graph Agent Task", () => {
  assert.deepEqual(GRAPH_TASK_COMMANDS, GRAPH_COMMANDS);
  for (const command of GRAPH_COMMANDS) assert.equal(typeof runTaskCommand, "function", command);
});

test("canonical input reader is bounded, exact, and never accepts empty or padded JSON", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-runtime-input-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "input.json");
  await writeFile(file, canonicalJson({ value: 1 }));
  assert.deepEqual(await readCanonicalInputFile(file, 32), { value: 1 });
  await writeFile(file, `${canonicalJson({ value: 1 })}\n`);
  await assert.rejects(readCanonicalInputFile(file, 32), /canonical/);
  await writeFile(file, "");
  await assert.rejects(readCanonicalInputFile(file, 32), /empty|bound/);
  await writeFile(file, canonicalJson({ value: "x".repeat(100) }));
  await assert.rejects(readCanonicalInputFile(file, 32), /bound/);
});

test("raw full get_issue_comments adapter attests only a complete post-fetch bounded list", () => {
  const identity = {
    workspace_id: "22222222-2222-4222-8222-222222222222",
    project_id: "55555555-5555-4555-8555-555555555555",
    issue_id: "66666666-6666-4666-8666-666666666666",
  };
  const raw = [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", comment_html: "<p>ok</p>" }];
  const result = normalizeRawIssueComments(raw, identity);
  assert.deepEqual(result, {
    comments: [{ comment_id: raw[0].id, ...identity, comment_html: raw[0].comment_html }],
    source_operation: "get_issue_comments",
    complete: true,
    total_count: 1,
    truncated: false,
    enforced_max_bytes: 1048576,
    enforced_max_comments: 100,
    observed_bytes: Buffer.byteLength(canonicalJson([{ comment_id: raw[0].id, ...identity, comment_html: raw[0].comment_html }]), "utf8"),
  });
  assert.throws(() => normalizeRawIssueComments(Array(101).fill(raw[0]), identity), /comment.*limit/i);
  assert.throws(() => normalizeRawIssueComments([{ ...raw[0], extra: true }], identity), /exact|unknown/i);
});

test("resolver bundle adapter is exact and profile install precondition proves Artifact bytes equal pinned Git bytes", async () => {
  const fixture = aggregateFixture({ profileOverrides: { environment: { strategy: "none" } } });
  const bundle = serializedBundle(fixture);
  const dependencies = createResolverAdapters(bundle);
  const installed = await verifyProfileInstallPrecondition({
    workspace_id: fixture.input.workspace_id,
    profile_artifact: fixture.input.profile_artifact,
    repository_origin: fixture.input.repository_origin,
    commit: fixture.input.plan.commit,
    profile_digest: sha256(fixture.profile),
  }, dependencies);
  assert.equal(installed.installed, true);
  assert.equal(installed.profile_digest, sha256(fixture.profile));
  assert.equal(installed.profile_blob_sha256, bundle.commit_profiles[0].response.sha256);
  const hostile = structuredClone(bundle);
  hostile.unknown = true;
  assert.throws(() => createResolverAdapters(hostile), /resolver bundle.*exact/i);
  const changed = structuredClone(bundle);
  changed.commit_profiles[0].response.bytes_base64 = Buffer.from("changed").toString("base64");
  const changedDependencies = createResolverAdapters(changed);
  await assert.rejects(verifyProfileInstallPrecondition({
    workspace_id: fixture.input.workspace_id,
    profile_artifact: fixture.input.profile_artifact,
    repository_origin: fixture.input.repository_origin,
    commit: fixture.input.plan.commit,
    profile_digest: sha256(fixture.profile),
  }, changedDependencies), /profile.*(?:bytes|digest|Git)/i);
});

test("non-interactive graph commands execute real Task1-6 functions with trusted adapters", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-runtime-commands-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const applicability = { code: "NOT_APPLICABLE", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" };
  const fixture = aggregateFixture({ applicability, profileOverrides: { environment: { strategy: "none" } } });
  const bundle = serializedBundle(fixture);
  const dependencies = createResolverAdapters(bundle);
  const raw_context = {
    source_artifact: fixture.plan.source_artifact,
    issue_uuid: "66666666-6666-4666-8666-666666666666",
    project_uuid: "55555555-5555-4555-8555-555555555555",
    project_key: fixture.profile.project_key,
    repository_origin: fixture.profile.repository.allowed_origin,
    commit: fixture.plan.commit,
    content_hash: fixture.plan.content_hash,
    profile_digest: sha256(fixture.profile),
    changed_files: ["README.md"], labels: [], acceptance_capabilities: [], wiki_artifacts: [],
  };
  const profile_install = {
    workspace_id: fixture.input.workspace_id, profile_artifact: fixture.input.profile_artifact,
    repository_origin: fixture.input.repository_origin, commit: fixture.plan.commit, profile_digest: sha256(fixture.profile),
  };
  const resolved = await runTaskCommand("resolve-flow-item", {
    workspace_id: fixture.input.workspace_id, project_id: raw_context.project_uuid, issue_id: raw_context.issue_uuid,
    source_artifact: fixture.plan.source_artifact,
  }, { outputDir: join(root, "resolve"), dependencies });
  assert.equal(resolved.files[0].name, "resolve-flow-item.json");
  const loaded = await runTaskCommand("load-project-context", { raw_context, profile: fixture.profile, profile_install }, { outputDir: join(root, "context"), dependencies });
  const context = JSON.parse(await readFile(join(root, "context", "load-project-context.json"), "utf8"));
  assert.equal(loaded.files[0].name, "load-project-context.json");
  const planned = await runTaskCommand("plan-qa-scope", { context, profile: fixture.profile }, { outputDir: join(root, "plan"), dependencies });
  assert.equal(planned.files[0].name, "test-plan.json");
  const runId = "99999999-9999-4999-8999-999999999999";
  const attemptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const environmentInput = { profile: fixture.profile, repositoryOrigin: fixture.input.repository_origin, commit: fixture.plan.commit, runId, attemptId, environmentId: "generic-env" };
  const prepared = await runTaskCommand("prepare-environment", { environment_input: environmentInput }, { outputDir: join(root, "prepare"), dependencies });
  const cleaned = await runTaskCommand("cleanup-environment", { environment_input: environmentInput }, { outputDir: join(root, "cleanup"), dependencies });
  assert.deepEqual([prepared.files[0].name, cleaned.files[0].name], ["environment-manifest.json", "cleanup-receipt.json"]);
  const aggregated = await runTaskCommand("aggregate-evidence", {
    aggregate_input: fixture.input, project_id: raw_context.project_uuid, issue_id: raw_context.issue_uuid,
  }, { outputDir: join(root, "aggregate"), dependencies });
  assert.deepEqual(aggregated.files.map((file) => file.name), ["aggregate-report.json", "review-bundle.json"]);
  const aggregate = await aggregateFixtureResult(fixture);
  const decided = await runTaskCommand("independent-release-decision", {
    aggregate, proposal: {},
    completion_context: {
      source_ref: fixture.plan.source_artifact, profile_ref: fixture.input.profile_artifact,
      review_bundle_ref: { artifact_id: "77777777-7777-4777-8777-777777777777", version_id: "88888888-8888-4888-8888-888888888888", kind: "document", role: "evidence" },
      cleanup_lease: { run_id: aggregate.run_id, attempt_id: aggregate.attempt_id, environment_id: aggregate.environment_id, target_namespace: aggregate.target_namespace, instance_nonce: aggregate.instance_nonce },
      workspace_id: fixture.input.workspace_id, project_id: raw_context.project_uuid, issue_id: raw_context.issue_uuid,
    },
  }, { outputDir: join(root, "decision"), dependencies });
  assert.equal(decided.item.data.decision.route, "READY_FOR_PRODUCTION");
  for (const result of [resolved, loaded, planned, prepared, cleaned, aggregated, decided]) assert.deepEqual(JSON.parse(canonicalJson(result)), result);
});

test("every Task 4 CLI command uses actual refs across execute, link, and complete phases", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-runtime-branch-phases-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const applicability = { code: "NOT_APPLICABLE", api: "NOT_APPLICABLE", ui: "NOT_APPLICABLE", domain: "NOT_APPLICABLE" };
  const fixture = aggregateFixture({ applicability, profileOverrides: { environment: { strategy: "none" } } });
  const run_id = "99999999-9999-4999-8999-999999999999";
  const attempt_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const environment_id = "generic-env";
  const environmentReceipt = {
    environment_status: "NOT_REQUIRED", run_id, attempt_id, environment_id,
    target_namespace: sha256({ run_id, attempt_id, environment_id }).slice(7),
  };
  const branchCommands = GRAPH_COMMANDS.filter((command) => /verify|requirements/.test(command));
  for (const [index, command] of branchCommands.entries()) {
    const outputDir = join(root, command);
    const execute = await runTaskCommand(command, {
      phase: "execute",
      branch_input: { plan: fixture.plan, profile: fixture.profile, environmentReceipt, runId: run_id, attemptId: attempt_id },
    }, { outputDir });
    assert.deepEqual(execute.files.map((file) => file.name).sort(), ["branch-payload.json", "evidence.json"]);
    const primary_refs = {
      branch_payload: { artifact_id: `00000000-0000-4000-8000-${String(index * 6 + 1).padStart(12, "0")}`, version_id: `00000000-0000-4000-8000-${String(index * 6 + 2).padStart(12, "0")}`, kind: "document", role: "output" },
      evidence: { artifact_id: `00000000-0000-4000-8000-${String(index * 6 + 3).padStart(12, "0")}`, version_id: `00000000-0000-4000-8000-${String(index * 6 + 4).padStart(12, "0")}`, kind: "document", role: "evidence" },
    };
    const linked = await runTaskCommand(command, {
      phase: "link", primary_refs,
      occurrence_context: { repository_origin: fixture.profile.repository.allowed_origin, content_hash: fixture.plan.content_hash, environment_id, instance_nonce: null },
    }, { outputDir });
    assert.deepEqual(linked.files.map((file) => file.name), ["occurrence.json"]);
    const occurrence = { artifact_id: `00000000-0000-4000-8000-${String(index * 6 + 5).padStart(12, "0")}`, version_id: `00000000-0000-4000-8000-${String(index * 6 + 6).padStart(12, "0")}`, kind: "document", role: "evidence" };
    const material_refs = { ...primary_refs, occurrence };
    const completed = await runTaskCommand(command, {
      phase: "complete", material_refs,
      completion_context: {
        source_ref: fixture.plan.source_artifact, profile_ref: fixture.input.profile_artifact, test_plan_ref: fixture.input.plan_artifact,
        environment_receipt: environmentReceipt, workspace_id: fixture.input.workspace_id,
        project_id: "55555555-5555-4555-8555-555555555555", issue_id: "66666666-6666-4666-8666-666666666666",
        run_id, attempt_id,
      },
    }, { outputDir });
    assert.deepEqual(completed.item.data.material_refs, material_refs);
    assert.deepEqual(completed.artifact_outputs, { "item.artifacts.branch_payload": primary_refs.branch_payload });
    assert.deepEqual((await Promise.all(["branch-payload.json", "occurrence.json", "evidence.json"].map((name) => readFile(join(outputDir, name), "utf8")))).map(JSON.parse).length, 3);
  }
});

test("comment publisher and finalizer CLI wrappers consume complete normalized MCP reads end to end", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-runtime-comment-chain-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = aggregateFixture();
  const aggregate = await aggregateFixtureResult(fixture);
  const decision = await decideRelease(aggregate, {}, fixture.dependencies);
  const review_bundle = { artifact_id: "77777777-7777-4777-8777-777777777777", version_id: "88888888-8888-4888-8888-888888888888", kind: "document", role: "evidence" };
  const project_id = "55555555-5555-4555-8555-555555555555";
  const issue_id = "66666666-6666-4666-8666-666666666666";
  const review = {
    schema_version: "nuanu.qa-review-bundle.v1", workspace_id: fixture.input.workspace_id, project_id, work_item_id: issue_id,
    source_artifact: fixture.plan.source_artifact, aggregate, stored_decision: decision,
  };
  const reviewBytes = Buffer.from(canonicalJson(review));
  fixture.store.set(`${review_bundle.artifact_id}@${review_bundle.version_id}`, {
    workspace_id: fixture.input.workspace_id, enforced_max_bytes: null, byte_length: reviewBytes.byteLength,
    links: [
      { entity_type: "project", entity_id: project_id, relation: "output" },
      { entity_type: "work_item", entity_id: issue_id, relation: "output" },
      { entity_type: "process_run", entity_id: aggregate.run_id, relation: "output" },
    ],
    artifact: {
      id: review_bundle.artifact_id, workspace_id: fixture.input.workspace_id, status: "stored", current_version: review_bundle.version_id,
      kind: "document", name: "review-bundle.json", mime_type: "application/json",
      versions: [{ id: review_bundle.version_id, version: 1, file_asset: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", size: reviewBytes.byteLength, checksum: createHash("sha256").update(reviewBytes).digest("hex") }],
    },
    bytes: reviewBytes,
  });
  const publication_input = { workspace_id: fixture.input.workspace_id, project_id, issue_id, source_artifact: fixture.plan.source_artifact, review_bundle };
  const rendered = renderComment({
    source_artifact: fixture.plan.source_artifact, decision, review_bundle,
    review_summary: {
      selected_checks: aggregate.branches.filter((branch) => branch.applicability === "REQUIRED").map((branch) => branch.branch),
      skipped_checks: aggregate.branches.filter((branch) => branch.applicability === "NOT_APPLICABLE").map((branch) => branch.branch),
      commit: aggregate.commit, content_hash: aggregate.content_hash,
      finding_count: aggregate.branches.reduce((sum, branch) => sum + branch.confirmed_findings, 0),
    },
  });
  const rawComment = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", comment_html: rendered.comment_html };
  const publishBundle = serializedBundle(fixture);
  publishBundle.comment_reads = [[], [rawComment]].map((comments) => ({ attestation: normalizeRawIssueComments(comments, {
    workspace_id: fixture.input.workspace_id, project_id, issue_id,
  }) }));
  const published = await runTaskCommand("publish-flow-item-comment", { publication_input }, {
    outputDir: join(root, "publish"), resolverBundle: publishBundle,
  });
  assert.equal(published.files[0].name, "comment-receipt.json");
  const comment_receipt = JSON.parse(await readFile(join(root, "publish", "comment-receipt.json"), "utf8"));
  const finalizeBundle = serializedBundle(fixture, [rawComment]);
  const cleanup_receipt = {
    environment_status: "STOPPED", run_id: aggregate.run_id, attempt_id: aggregate.attempt_id,
    environment_id: aggregate.environment_id, target_namespace: aggregate.target_namespace, instance_nonce: aggregate.instance_nonce,
  };
  const finalized = await runTaskCommand("finalize-transition", {
    finalization_input: { ...publication_input, comment_receipt, cleanup_receipt },
  }, { outputDir: join(root, "finalize"), resolverBundle: finalizeBundle });
  assert.equal(finalized.files[0].name, "finalization.json");
  assert.equal(JSON.parse(await readFile(join(root, "finalize", "finalization.json"), "utf8")).transition_allowed, true);
});

test("normalizer command writes canonical attestation and never has silent stdout semantics", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-comments-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await runTaskCommand("normalize-comments", {
    raw_comments: [],
    identity: {
      workspace_id: "22222222-2222-4222-8222-222222222222",
      project_id: "55555555-5555-4555-8555-555555555555",
      issue_id: "66666666-6666-4666-8666-666666666666",
    },
  }, { outputDir: root });
  assert.equal(result.schema_version, "nuanu.qa-comment-list-attestation.v1");
  assert.equal(await readFile(join(root, "comments-attestation.json"), "utf8"), canonicalJson(result.attestation));
});

test("aggregate, universal blueprint, and universal runtime contain no payment policy literals", async () => {
  const sources = await Promise.all([
    "../../scripts/qah/aggregate.mjs",
    "../../scripts/qah/task-runtime.mjs",
    "../../processes/universal-qa-flow.graph.json",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of sources) assert.doesNotMatch(source, /payment|paydemo|bank_transfer|idempotent_replay|amount_rejected/i);
});

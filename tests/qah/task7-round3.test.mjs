import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalJson, sha256 } from "../../scripts/qah/canonical.mjs";
import * as paydemoAdapter from "../../scripts/qah/adapters/paydemo.mjs";
import * as renderer from "../../scripts/qah/render-process.mjs";
import * as runtime from "../../scripts/qah/task-runtime.mjs";

const installAdapter = await import("../../scripts/qah/nuanu-install-adapter.mjs").catch(() => ({}));
const workerContract = await import("./helpers/worker-contract.mjs").catch(() => ({}));
const blueprint = JSON.parse(await readFile(new URL("../../processes/universal-qa-flow.graph.json", import.meta.url), "utf8"));
const liveStart = JSON.parse(await readFile(new URL("fixtures/live-column-start.json", import.meta.url), "utf8"));
const ids = Object.freeze({
  workspace: "22222222-2222-4222-8222-222222222222",
  project: liveStart.node.config.project_process_start.project_id,
  binding: liveStart.node.config.project_process_start.binding_id,
  template: "33333333-3333-4333-8333-333333333333",
  ready: liveStart.node.config.project_process_start.state_id,
  progress: "44444444-4444-4444-8444-444444444444",
  production: "55555555-5555-4555-8555-555555555555",
  qa: "66666666-6666-4666-8666-666666666666",
  qaVersion: "77777777-7777-4777-8777-777777777777",
  decision: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  decisionVersion: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  artifact: "88888888-8888-4888-8888-888888888888",
  artifactVersion: "99999999-9999-4999-8999-999999999999",
});
const profileBytes = Buffer.from("schema_version: 1\nproject_key: universal\n");
const genericPrompts = Object.freeze({
  qa: "Execute only repository-bound universal QA tasks under the declared profile and exact Process contracts.",
  decision: "Independently decide a universal QA release using only the closed aggregate and repository evidence.",
});

function policy(prompt) {
  return { id: "nuanu.universal-qa-agent-policy.v1", system_prompt_sha256: sha256(prompt) };
}

function activeAgent(employee, version, decision) {
  return {
    id: employee, name: decision ? "universal-release-decision" : "universal-qa-runner", display_name: "Universal QA",
    runtime: "remote", role: "member", is_active: true,
    active_version: { id: version, version_number: 1, content_hash: "1".repeat(64), published_at: "2026-08-09T00:00:00Z" },
    draft_content_hash: "1".repeat(64), draft_has_changes: false, has_published_version: true, version_count: 1,
    capabilities: {
      ...(decision ? { base_model: "openai/gpt-5.6-sol-pro" } : {}),
      tools: [], skills: [], integrations: [], mcp_servers: [], remote_protocol: "native",
      skill_availability: { source: "installed_plugin", scope: "full_bundled", attached_skills_applicable: false, includes_artifacts: true },
    },
    description: "Universal repository QA agent.", web_url: "https://flow.invalid/demo/agent-employees",
  };
}

function publishedVersion(employee, version, decision) {
  const prompt = decision ? genericPrompts.decision : genericPrompts.qa;
  return {
    id: version, version_number: 1, content_hash: "1".repeat(64), published_at: "2026-08-09T00:00:00Z",
    workspace: ids.workspace, agent_employee: employee, configuration_schema_version: 1,
    configuration_snapshot: {
      ...(decision ? { base_model: "openai/gpt-5.6-sol-pro" } : {}),
      a2a: null, tools: [], skills: [], runtime: "remote", health_path: "", mcp_servers: [], endpoint_url: "", integrations: [],
      system_prompt: prompt, generic_scope_policy: policy(prompt), remote_protocol: "native",
      execution_policy: { external_side_effects: "remote_admission_policy" },
      capability_ceiling: { tools: [], memory: [], mcp_servers: [], integrations: [] }, configuration_schema_version: 1,
    },
  };
}

function installRequest(extra = {}) {
  return {
    catalog_revision: "sha256:" + "c".repeat(64), workspace_slug: "demo", workspace_id: ids.workspace,
    project_id: ids.project, project_process_binding_id: ids.binding, process_template_id: ids.template,
    ready_for_qa_state_id: ids.ready, in_progress_state_id: ids.progress, ready_for_production_state_id: ids.production,
    qa_agent_employee_id: ids.qa, qa_agent_version_id: ids.qaVersion,
    decision_agent_employee_id: ids.decision, decision_agent_version_id: ids.decisionVersion,
    decision_agent_metadata: { requested_model: "openai/gpt-5.6-sol-pro", required_capabilities: ["git", "nuanu_mcp", "tool_execution"] },
    profile_artifact: { artifact_id: ids.artifact, version_id: ids.artifactVersion, kind: "document", role: "implementation" },
    repository_origin: "https://example.invalid/repository.git", commit: "a".repeat(40),
    ...extra,
  };
}

function faithfulLowLevel(overrides = {}) {
  const calls = [];
  const digest = createHash("sha256").update(profileBytes).digest("hex");
  const resultFor = (operation) => {
    if (operation === "get_project_process_binding") return {
      id: ids.binding, kind: "column", project_state: { id: ids.ready, name: "Ready for QA", color: "#8B5CF6", group: "started", sequence: 70000 },
      status: "active", process_template: { id: ids.template, workspace_id: ids.workspace, is_column_process: true }, invalid: false, needs_attention: false,
    };
    if (operation === "get_process_graph") return {
      process_template_id: ids.template, name: "Ready for QA process", definition_etag: "sha256:" + "d".repeat(64),
      graph_hash: "sha256:" + "e".repeat(64), graph_ref: `process:${ids.template}@sha256:${"e".repeat(64)}`,
      schema_version: 1, node_count: 2, edge_count: 1, view: "selection",
      selection: { requested_node_keys: ["project_start"], nodes: [{ ...liveStart.node, derived_inputs: [] }, { id: liveStart.edge.target, key: "old_first", type: "agent_task", name: "Old first", config: {}, derived_inputs: [] }], edges: [liveStart.edge] },
    };
    if (operation === "list_agents") return [activeAgent(ids.qa, ids.qaVersion, false), activeAgent(ids.decision, ids.decisionVersion, true)];
    if (operation === "get_agent_version") {
      const current = calls.at(-1).arguments.agent_id;
      return current === ids.decision ? publishedVersion(ids.decision, ids.decisionVersion, true) : publishedVersion(ids.qa, ids.qaVersion, false);
    }
    if (operation === "get_artifact") return {
      id: ids.artifact, workspace_id: ids.workspace, kind: "document", status: "stored",
      versions: [{ id: ids.artifactVersion, status: "stored", size: profileBytes.byteLength, checksum: digest, media_type: "application/yaml" }],
    };
    if (operation === "get_artifact_download_url") return { artifact_id: ids.artifact, version_id: ids.artifactVersion, download_url: "https://artifacts.invalid/exact-version" };
    throw new Error(`unexpected operation ${operation}`);
  };
  const primitives = {
    executeRead: async (request) => {
      calls.push(structuredClone(request));
      const result = resultFor(request.operation);
      return { operation: overrides.responseOperation ?? request.operation, catalog_revision: request.catalog_revision, result: overrides[request.operation] ?? result };
    },
    downloadArtifact: async (request) => ({ operation: "download_artifact_version", request, result: { bytes: profileBytes, sha256: `sha256:${digest}` } }),
    readGitFile: async (request) => ({ operation: "read_git_file", request, result: { bytes: profileBytes, sha256: `sha256:${digest}` } }),
    readWorkerBinding: async (request) => ({ operation: "get_worker_binding", request, result: {
      agent_employee_id: request.agent_employee_id, agent_version_id: request.agent_version_id,
      repository_origin: "https://example.invalid/repository.git", repository_access: "read", model: request.agent_employee_id === ids.decision ? "openai/gpt-5.6-sol-pro" : "openai/gpt-5.6-sol",
      capabilities: ["git", "tool_execution", "nuanu_artifacts", "nuanu_work_items", ...(request.agent_employee_id === ids.qa ? ["browser_qa_v1"] : [])],
    } }),
  };
  return { primitives, calls };
}

test("output validation never creates a leaf through a symlinked qah parent", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-root-symlink-"));
  const outside = await mkdtemp(join(tmpdir(), "qah-outside-symlink-"));
  t.after(() => Promise.all([root, outside].map((path) => rm(path, { recursive: true, force: true }))));
  await symlink(outside, join(root, "qah"));
  await assert.rejects(runtime.runTaskCommand("normalize-comments", { raw_comments: [], identity: {
    workspace_id: ids.workspace, project_id: ids.project, issue_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  } }, { outputDir: join(root, "qah", "normalize-comments"), taskRoot: root }), /symlink|contain|real/i);
  assert.deepEqual(await readdir(outside), []);
});

test("install preflight accepts only a branded closed low-level Nuanu transcript", async () => {
  assert.equal(typeof installAdapter.createNuanuInstallAdapter, "function");
  const transcript = faithfulLowLevel();
  const adapter = installAdapter.createNuanuInstallAdapter(transcript.primitives);
  const rendered = await renderer.renderForInstall(blueprint, installRequest(), adapter);
  assert.equal(rendered.graph.nodes.length, 21);
  assert.deepEqual(rendered.graph.nodes[0], liveStart.node);
  assert.deepEqual(rendered.graph.edges[0], liveStart.edge);
  assert.deepEqual(transcript.calls.map((entry) => entry.operation), [
    "get_project_process_binding", "get_process_graph", "list_agents", "get_agent_version", "get_agent_version", "get_artifact", "get_artifact_download_url",
  ]);
  await assert.rejects(renderer.renderForInstall(blueprint, installRequest(), transcript.primitives), /trusted|adapter|brand/i);
  await assert.rejects(renderer.renderForInstall(blueprint, installRequest(), installAdapter.createNuanuInstallAdapter(faithfulLowLevel({ responseOperation: "list_projects" }).primitives)), /operation|transcript/i);
  await assert.rejects(renderer.renderForInstall(blueprint, installRequest(), installAdapter.createNuanuInstallAdapter(faithfulLowLevel({
    get_project_process_binding: { id: ids.binding, kind: "column", project_state: { id: ids.ready }, status: "active", process_template: { id: ids.template, workspace_id: ids.workspace, is_column_process: true }, invalid: false, needs_attention: false },
  }).primitives)), /binding|readback|shape/i);
  const foreign = faithfulLowLevel({
    get_project_process_binding: {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", kind: "column",
      project_state: { id: ids.ready, name: "Ready for QA", color: "#8B5CF6", group: "started", sequence: 70000 },
      status: "active", process_template: { id: ids.template, workspace_id: ids.workspace, is_column_process: true }, invalid: false, needs_attention: false,
    },
  });
  await assert.rejects(renderer.renderForInstall(blueprint, installRequest(), installAdapter.createNuanuInstallAdapter(foreign.primitives)), /binding|project/i);
  await assert.rejects(renderer.renderForInstall(
    blueprint,
    installRequest({ project_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
    installAdapter.createNuanuInstallAdapter(faithfulLowLevel().primitives),
  ), /project|live graph/i);
  const nongeneric = faithfulLowLevel();
  const originalExecuteRead = nongeneric.primitives.executeRead;
  nongeneric.primitives.executeRead = async (request) => {
    const response = await originalExecuteRead(request);
    if (request.operation === "get_agent_version") response.result.configuration_snapshot.generic_scope_policy.id = "caller.claimed.generic";
    return response;
  };
  await assert.rejects(renderer.renderForInstall(blueprint, installRequest(), installAdapter.createNuanuInstallAdapter(nongeneric.primitives)), /generic|policy|scope/i);
});

test("install rendering obtains Start and edge only from the branded current graph attestation", async () => {
  assert.equal(typeof installAdapter.createNuanuInstallAdapter, "function");
  const forgedEdge = { ...liveStart.edge, target: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
  const forgedRequest = installRequest({
    platform_start_node: liveStart.node, platform_start_edge: forgedEdge,
    platform_start_fingerprint: sha256(liveStart.node), platform_start_edge_fingerprint: sha256(forgedEdge),
  });
  await assert.rejects(renderer.renderForInstall(blueprint, forgedRequest, installAdapter.createNuanuInstallAdapter(faithfulLowLevel().primitives)), /unknown|Start|install request/i);
});

function minimalUiHarness() {
  const events = [];
  let routeHandler;
  let websocketHandler;
  let workerReachable = true;
  const branchNamespace = sha256({ run_id: "run", attempt_id: "attempt", branch: "ui" }).slice(7);
  const requestBytes = Buffer.from(JSON.stringify({ runId: branchNamespace, planId: "starter", amountCents: 1000, paymentMethod: "bank" }));
  const response = { url: () => "http://127.0.0.1:4173/api/checkout", status: () => 201, request: () => ({ method: () => "POST", sizes: async () => ({ requestBodySize: requestBytes.byteLength }), postDataBuffer: () => requestBytes }) };
  const page = {
    goto: async () => { await routeHandler({ request: () => ({ url: () => "http://127.0.0.1:4173/app.js" }), continue: async () => events.push("route-continue"), abort: async () => events.push("route-abort") }); },
    url: () => "http://127.0.0.1:4173/", getByLabel: () => ({ check: async () => {}, isChecked: async () => true }),
    waitForResponse: async (predicate) => { assert.equal(predicate(response), true); return response; },
    getByRole: (role) => role === "button" ? { click: async () => {} } : { filter: () => ({ waitFor: async () => {} }) },
    screenshot: async ({ path }) => writeFile(path, "screenshot"),
  };
  const context = {
    tracing: { start: async () => {}, stop: async ({ path }) => writeFile(path, "trace") }, setDefaultTimeout: () => {},
    route: async (_pattern, handler) => { routeHandler = handler; }, routeWebSocket: async (_pattern, handler) => { websocketHandler = handler; },
    newPage: async () => page,
    newCDPSession: async () => ({ send: async (method) => method === "Page.getFrameTree" ? { frameTree: { frame: { id: "main", url: page.url() } } } : method === "Page.createIsolatedWorld" ? { executionContextId: 1 } : { result: { type: "object", value: { oversized: false, value: "Payment recorded by bank transfer." } } }, detach: async () => {} }),
    close: async () => events.push("context-close"),
  };
  const browser = { newContext: async (options) => { events.push({ contextOptions: options }); return context; }, disconnect: async () => events.push("client-disconnect"), close: async () => { workerReachable = false; events.push("browser-close"); } };
  const chromium = {
    connectOverCDP: async (url) => { events.push({ connectOverCDP: url }); return browser; },
    launch: async () => { events.push("launch"); throw new Error("worker mode must not launch"); },
  };
  return { chromium, events, websocket: () => websocketHandler, workerReachable: () => workerReachable };
}

test("worker UI uses pinned CDP, owns one isolated context, disconnects without killing Chrome, and receives only exact UI env", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-worker-cdp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const harness = minimalUiHarness();
  const input = {
    schema_version: "nuanu.qa-branch-adapter-input.v1", branch: "ui", run_id: "run", attempt_id: "attempt",
    attempt_namespace: sha256({ run_id: "run", attempt_id: "attempt" }).slice(7), branch_namespace: sha256({ run_id: "run", attempt_id: "attempt", branch: "ui" }).slice(7), test_data_profile: null,
    environment: { base_url: "http://127.0.0.1:4173", commit: "a".repeat(40), content_hash: "sha256:" + "b".repeat(64), environment_id: "env", instance_nonce: "11111111-1111-4111-8111-111111111111" },
  };
  const environment = { NUANU_QA_BROWSER_CDP_URL: "http://127.0.0.1:9222", NUANU_QA_PLAYWRIGHT_MODULE: "/opt/worker/playwright/index.mjs" };
  await paydemoAdapter.runPaydemoUiProbe(input, { chromium: harness.chromium, artifactRoot: root, maxArtifactBytes: 1024, browserMode: "worker", environment });
  assert.deepEqual(harness.events.filter((entry) => typeof entry === "object").slice(0, 2), [
    { connectOverCDP: environment.NUANU_QA_BROWSER_CDP_URL }, { contextOptions: { serviceWorkers: "block" } },
  ]);
  assert.equal(harness.events.includes("launch"), false);
  assert.deepEqual(harness.events.slice(-2), ["context-close", "client-disconnect"]);
  assert.equal(harness.workerReachable(), true);
  assert.equal(typeof harness.websocket(), "function");
  assert.deepEqual(runtime.runtimeEnvironmentForBranch?.("ui", { PATH: "/bin", HOME: "/secret", TOKEN: "secret", ...environment }), { PATH: "/bin", ...environment });
  assert.deepEqual(runtime.runtimeEnvironmentForBranch?.("api", { PATH: "/bin", ...environment }), { PATH: "/bin" });
});

test("worker 0.3.13 completion validator is discovered portably and pinned by bytes", async () => {
  assert.equal(typeof workerContract.loadWorkerCompletionValidator, "function");
  const loaded = await workerContract.loadWorkerCompletionValidator();
  assert.equal(loaded.version, "0.3.13");
  assert.equal(loaded.sha256, "sha256:9105a1b134fdd74b7aa5454aa4f622522939d683c413e83925ddbe3cadab4a41");
  assert.equal(typeof loaded.buildCanonicalCompletion, "function");
});

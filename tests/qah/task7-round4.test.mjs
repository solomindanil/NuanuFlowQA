import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url);
const ids = {
  workspace: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  binding: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", template: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ready: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", progress: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  production: "11111111-1111-4111-8111-111111111111", qa: "22222222-2222-4222-8222-222222222222",
  qav: "33333333-3333-4333-8333-333333333333", decision: "44444444-4444-4444-8444-444444444444",
  decisionv: "55555555-5555-4555-8555-555555555555", artifact: "66666666-6666-4666-8666-666666666666",
  artifactv: "77777777-7777-4777-8777-777777777777", start: "88888888-8888-4888-8888-888888888888",
  first: "99999999-9999-4999-8999-999999999999", edge: "12121212-1212-4121-8121-121212121212",
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function gitFixture() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "qah-direct-preflight-")));
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "config", "user.email", "qah@example.invalid"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "QAH Test"]);
  execFileSync("git", ["-C", dir, "remote", "add", "origin", "https://example.invalid/acme.git"]);
  for (const path of ["qah/generic-qa.v1.md", "qah/generic-decision.v1.md", "qah/install-policy.v1.json", "qa-harness.yaml"]) {
    const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
    await import("node:fs/promises").then(({ mkdir }) => mkdir(join(dir, path.split("/").slice(0, -1).join("/")), { recursive: true }));
    await writeFile(join(dir, path), bytes);
  }
  execFileSync("git", ["-C", dir, "add", "."]);
  execFileSync("git", ["-C", dir, "commit", "-qm", "fixture"]);
  return { dir, commit: execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
}

async function apiFixture(git, override = {}) {
  const qaPrompt = await readFile(new URL("../../qah/generic-qa.v1.md", import.meta.url), "utf8");
  const decisionPrompt = await readFile(new URL("../../qah/generic-decision.v1.md", import.meta.url), "utf8");
  const profile = await readFile(new URL("../../qa-harness.yaml", import.meta.url));
  const calls = [];
  let base;
  const start = { id: ids.start, key: "project_start", type: "start", name: "Enter Ready for QA", trigger: { mode: "manual" }, config: { project_process_start: { binding_id: ids.binding, project_id: ids.project, state_id: ids.ready }, output: { data: {}, artifacts: {} } } };
  const responses = {
    [`/api/workspaces/acme/projects/${ids.project}/process-bindings/${ids.binding}/`]: { id: ids.binding, kind: "column", project_state: { id: ids.ready, name: "Ready for QA", color: "#fff", group: "started", sequence: 1 }, status: "active", process_template: { id: ids.template, workspace_id: ids.workspace, is_column_process: true }, invalid: false, needs_attention: false },
    [`/api/workspaces/acme/process-templates/${ids.template}/graph/?view=selection&node_keys=project_start&include_neighbors=true&include_incident_edges=true`]: { process_template_id: ids.template, definition_etag: `sha256:${"a".repeat(64)}`, graph_hash: `sha256:${"b".repeat(64)}`, graph_ref: {}, schema_version: 1, view: "selection", selection: { requested_node_keys: ["project_start"], nodes: [start, { id: ids.first, key: "resolve_flow_item", type: "agent_task", name: "Resolve" }], edges: [{ id: ids.edge, source: ids.start, target: ids.first }] } },
    "/api/workspaces/acme/agent-employees/": { results: [
      { id: ids.qa, runtime: "remote", is_active: true, active_version: { id: ids.qav }, remote_profile: { health_status: "online" } },
      { id: ids.decision, runtime: "remote", is_active: true, active_version: { id: ids.decisionv }, remote_profile: { health_status: "online" } },
    ] },
    [`/api/workspaces/acme/agent-employees/${ids.qa}/versions/${ids.qav}/`]: { id: ids.qav, content_hash: "c".repeat(64), published_at: "2026-01-01T00:00:00Z", workspace: ids.workspace, agent_employee: ids.qa, configuration_snapshot: { system_prompt: override.qaPrompt ?? qaPrompt, base_model: "openai/gpt-5.6-sol-pro", tools: ["git", "tool_execution"], skills: ["browser-qa"], mcp_servers: ["nuanu-flow"], integrations: [] } },
    [`/api/workspaces/acme/agent-employees/${ids.decision}/versions/${ids.decisionv}/`]: { id: ids.decisionv, content_hash: "d".repeat(64), published_at: "2026-01-01T00:00:00Z", workspace: ids.workspace, agent_employee: ids.decision, configuration_snapshot: { system_prompt: decisionPrompt, base_model: "openai/gpt-5.6-sol-pro", tools: ["git", "tool_execution"], skills: [], mcp_servers: ["nuanu-flow"], integrations: [] } },
    [`/api/workspaces/acme/artifacts/${ids.artifact}/`]: { id: ids.artifact, workspace_id: ids.workspace, kind: "document", status: "stored", versions: [{ id: ids.artifactv, status: "stored", size: profile.length, checksum: digest(profile), media_type: "application/yaml" }] },
    "/api/agent-worker/whoami/": (req) => ({ agent_id: req.headers["x-agent-key"] === "qa-key" ? ids.qa : ids.decision, workspace: "acme", is_active: true }),
  };
  const server = createServer((req, res) => {
    calls.push(req.url);
    if (override.redirectBinding && req.url.includes("/process-bindings/")) { res.writeHead(302, { location: `${base}/blob/profile` }).end(); return; }
    if (req.url === `/api/workspaces/acme/artifacts/${ids.artifact}/download/?version=${ids.artifactv}`) { res.writeHead(302, { location: `${base}/bucket/profile?X-Amz-Signature=test` }).end(); return; }
    if (req.url === "/bucket/profile?X-Amz-Signature=test") { res.writeHead(200, { "content-type": "application/yaml" }).end(override.oversize ? Buffer.alloc(300000) : profile); return; }
    const value = responses[req.url];
    if (!value) { res.writeHead(404).end("{}"); return; }
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify(typeof value === "function" ? value(req) : value));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((resolve) => server.close(resolve)) };
}

function request(git) {
  return { workspace_slug: "acme", workspace_id: ids.workspace, project_id: ids.project, project_process_binding_id: ids.binding, process_template_id: ids.template, ready_for_qa_state_id: ids.ready, in_progress_state_id: ids.progress, ready_for_production_state_id: ids.production, qa_agent_employee_id: ids.qa, qa_agent_version_id: ids.qav, decision_agent_employee_id: ids.decision, decision_agent_version_id: ids.decisionv, decision_agent_metadata: { requested_model: "openai/gpt-5.6-sol-pro", required_capabilities: ["git", "nuanu_mcp", "tool_execution"] }, profile_artifact: { artifact_id: ids.artifact, version_id: ids.artifactv, kind: "document", role: "implementation" }, repository_origin: "https://example.invalid/acme.git", repository_path: git.dir, commit: git.commit };
}

test("production install path exposes no callback adapter or public attestation constructor", async () => {
  const old = await import("../../scripts/qah/nuanu-install-adapter.mjs").catch(() => ({}));
  assert.equal(old.createNuanuInstallAdapter, undefined);
  const renderer = await import("../../scripts/qah/render-process.mjs");
  await assert.rejects(renderer.renderForInstall({}, request({ dir: "/tmp", commit: "a".repeat(40) }), { executeRead() {} }), /environment|direct|origin|request/i);
});

test("direct fixed-route preflight accepts a faithful loopback API and actual Git repository", async (t) => {
  const preflight = await import("../../scripts/qah/install-preflight.mjs");
  const git = await gitFixture(); t.after(() => rm(git.dir, { recursive: true, force: true }));
  const api = await apiFixture(git); t.after(api.close);
  const attestation = await preflight.runDirectInstallPreflight(request(git), { environment: { NUANU_API_URL: api.base, NUANU_API_KEY: "user-key", NUANU_QA_AGENT_KEY: "qa-key", NUANU_DECISION_AGENT_KEY: "decision-key", NUANU_QAH_PREFLIGHT_TEST_MODE: "1" } });
  assert.equal(preflight.isInstallAttestation(attestation), true);
  assert.equal(api.calls.some((path) => path.includes("get_worker_binding")), false);
  assert.deepEqual(api.calls, [
    `/api/workspaces/acme/projects/${ids.project}/process-bindings/${ids.binding}/`,
    `/api/workspaces/acme/process-templates/${ids.template}/graph/?view=selection&node_keys=project_start&include_neighbors=true&include_incident_edges=true`,
    "/api/workspaces/acme/agent-employees/",
    `/api/workspaces/acme/agent-employees/${ids.qa}/versions/${ids.qav}/`,
    `/api/workspaces/acme/agent-employees/${ids.decision}/versions/${ids.decisionv}/`,
    "/api/agent-worker/whoami/", "/api/agent-worker/whoami/",
    `/api/workspaces/acme/artifacts/${ids.artifact}/`,
    `/api/workspaces/acme/artifacts/${ids.artifact}/download/?version=${ids.artifactv}`,
    "/bucket/profile?X-Amz-Signature=test",
  ]);
});

test("Git-owned positive prompt allowlist rejects an Acme prompt even when self-hashed", async (t) => {
  const preflight = await import("../../scripts/qah/install-preflight.mjs");
  const git = await gitFixture(); t.after(() => rm(git.dir, { recursive: true, force: true }));
  const api = await apiFixture(git, { qaPrompt: "Acme-specific prompt with a recomputed self hash and enough text." }); t.after(api.close);
  await assert.rejects(preflight.runDirectInstallPreflight(request(git), { environment: { NUANU_API_URL: api.base, NUANU_API_KEY: "user-key", NUANU_QA_AGENT_KEY: "qa-key", NUANU_DECISION_AGENT_KEY: "decision-key", NUANU_QAH_PREFLIGHT_TEST_MODE: "1" } }), /allowlist|policy|prompt/i);
});

test("direct transport rejects production lookalikes, redirects, oversize bodies, and unknown endpoints", async (t) => {
  const preflight = await import("../../scripts/qah/install-preflight.mjs");
  await assert.rejects(preflight.runDirectInstallPreflight(request({ dir: "/tmp", commit: "a".repeat(40) }), { environment: { NUANU_API_URL: "https://evil.example" } }), /flow\.nuanu\.com|origin/i);
  assert.deepEqual(preflight.DIRECT_READ_PATH_KINDS, ["binding", "graph", "agents", "agent_version", "artifact", "artifact_download", "worker_whoami"]);
  const git = await gitFixture(); t.after(() => rm(git.dir, { recursive: true, force: true }));
  const environment = (base) => ({ NUANU_API_URL: base, NUANU_API_KEY: "user-key", NUANU_QA_AGENT_KEY: "qa-key", NUANU_DECISION_AGENT_KEY: "decision-key", NUANU_QAH_PREFLIGHT_TEST_MODE: "1" });
  const redirected = await apiFixture(git, { redirectBinding: true }); t.after(redirected.close);
  await assert.rejects(preflight.runDirectInstallPreflight(request(git), { environment: environment(redirected.base) }), /redirect|HTTP/i);
  const oversized = await apiFixture(git, { oversize: true }); t.after(oversized.close);
  await assert.rejects(preflight.runDirectInstallPreflight(request(git), { environment: environment(oversized.base) }), /oversized|byte|profile/i);
});

test("production preflight CLI is callable without a custom JavaScript callback module", async () => {
  const source = await readFile(new URL("../../scripts/qah/install-process.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /resolver|callback|executeRead|readWorkerBinding/);
  assert.match(source, /runDirectInstallPreflight/);
});

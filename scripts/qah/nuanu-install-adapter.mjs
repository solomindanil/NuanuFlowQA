import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "./canonical.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const GENERIC_POLICY_ID = "nuanu.universal-qa-agent-policy.v1";
const STRONGEST_CODEX_MODEL = "openai/gpt-5.6-sol-pro";
const REQUIRED_DECISION_CAPABILITIES = ["git", "nuanu_mcp", "tool_execution"];
const INSTALL_KEYS = [
  "catalog_revision", "workspace_slug", "workspace_id", "project_id", "project_process_binding_id", "process_template_id",
  "ready_for_qa_state_id", "in_progress_state_id", "ready_for_production_state_id", "qa_agent_employee_id", "qa_agent_version_id",
  "decision_agent_employee_id", "decision_agent_version_id", "decision_agent_metadata", "profile_artifact", "repository_origin", "commit",
];
const ADAPTERS = new WeakMap();
const ATTESTATIONS = new WeakMap();

function bytesSha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function exact(value, keys, label) {
  object(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) throw new TypeError(`${label} must have exact keys`);
  return value;
}

function required(value, keys, label) {
  object(value, label);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new TypeError(`${label} readback shape is missing ${key}`);
  return value;
}

function uuid(value, label) {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(`${label} must be a UUID`);
  return value;
}

function installRequest(value) {
  exact(value, INSTALL_KEYS, "install request");
  if (!DIGEST.test(value.catalog_revision) || typeof value.workspace_slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.workspace_slug)) throw new TypeError("install request catalog/workspace is invalid");
  for (const key of INSTALL_KEYS.filter((key) => key.endsWith("_id") && key !== "workspace_slug")) uuid(value[key], `install request ${key}`);
  if (!COMMIT.test(value.commit)) throw new TypeError("install request commit must be exact");
  let origin;
  try { origin = new URL(value.repository_origin); } catch { origin = null; }
  if (origin?.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.href !== value.repository_origin) throw new TypeError("install repository origin must be exact credential-free HTTPS");
  if (new Set([value.ready_for_qa_state_id, value.in_progress_state_id, value.ready_for_production_state_id]).size !== 3) throw new TypeError("install states must be distinct");
  if (value.qa_agent_employee_id === value.decision_agent_employee_id || value.qa_agent_version_id === value.decision_agent_version_id) throw new TypeError("install agents must be distinct");
  exact(value.decision_agent_metadata, ["requested_model", "required_capabilities"], "decision agent metadata");
  if (value.decision_agent_metadata.requested_model !== STRONGEST_CODEX_MODEL
    || canonicalJson([...value.decision_agent_metadata.required_capabilities].sort()) !== canonicalJson([...REQUIRED_DECISION_CAPABILITIES].sort())) throw new TypeError("decision agent metadata is invalid");
  exact(value.profile_artifact, ["artifact_id", "version_id", "kind", "role"], "profile Artifact ref");
  uuid(value.profile_artifact.artifact_id, "profile artifact_id"); uuid(value.profile_artifact.version_id, "profile version_id");
  if (value.profile_artifact.kind !== "document" || value.profile_artifact.role !== "implementation") throw new TypeError("profile Artifact ref is invalid");
  return structuredClone(value);
}

export function createNuanuInstallAdapter(primitives) {
  exact(primitives, ["executeRead", "downloadArtifact", "readGitFile", "readWorkerBinding"], "Nuanu install low-level primitives");
  for (const [name, implementation] of Object.entries(primitives)) if (typeof implementation !== "function") throw new TypeError(`${name} must be a low-level function`);
  // This is only an unbranded low-level handle. The capability-bearing
  // attestation is minted after the complete transcript verifies below.
  const adapter = Object.freeze({});
  ADAPTERS.set(adapter, { ...primitives });
  return adapter;
}

async function gateway(primitives, request, operation, args) {
  const call = { operation, catalog_revision: request.catalog_revision, arguments: args };
  const envelope = await primitives.executeRead(structuredClone(call));
  exact(envelope, ["operation", "catalog_revision", "result"], `${operation} gateway transcript`);
  if (envelope.operation !== operation || envelope.catalog_revision !== request.catalog_revision) throw new TypeError(`${operation} gateway transcript operation/catalog mismatch`);
  return envelope.result;
}

function verifyBinding(result, request) {
  required(result, ["id", "kind", "project_state", "status", "process_template", "invalid", "needs_attention"], "project Process binding");
  required(result.project_state, ["id", "name", "color", "group", "sequence"], "project Process state");
  required(result.process_template, ["id", "workspace_id", "is_column_process"], "project Process template");
  if (result.id !== request.project_process_binding_id || result.kind !== "column" || result.project_state.id !== request.ready_for_qa_state_id
    || result.status !== "active" || result.process_template.id !== request.process_template_id || result.process_template.workspace_id !== request.workspace_id
    || result.process_template.is_column_process !== true || result.invalid !== false || result.needs_attention !== false) throw new TypeError("project Process binding/project/template readback does not match install request");
}

function verifyLiveStart(result, request) {
  required(result, ["process_template_id", "definition_etag", "graph_hash", "graph_ref", "schema_version", "view", "selection"], "Process graph selection");
  if (result.process_template_id !== request.process_template_id || result.schema_version !== 1 || result.view !== "selection" || !DIGEST.test(result.definition_etag) || !DIGEST.test(result.graph_hash)) throw new TypeError("Process graph selection identity is invalid");
  required(result.selection, ["requested_node_keys", "nodes", "edges"], "Process graph selection payload");
  if (canonicalJson(result.selection.requested_node_keys) !== canonicalJson(["project_start"]) || !Array.isArray(result.selection.nodes) || !Array.isArray(result.selection.edges)) throw new TypeError("Process graph selection is not the exact Start selection");
  const startRead = result.selection.nodes.find((node) => node?.key === "project_start");
  if (!startRead) throw new TypeError("current live Process graph has no project_start");
  const start = structuredClone(startRead); delete start.derived_inputs;
  required(start, ["id", "key", "type", "name", "trigger", "config"], "live project_start");
  const generated = start.config?.project_process_start;
  if (start.type !== "start" || !generated || generated.binding_id !== request.project_process_binding_id || generated.project_id !== request.project_id || generated.state_id !== request.ready_for_qa_state_id) throw new TypeError("live project_start binding metadata is foreign");
  const incident = result.selection.edges.filter((edge) => edge?.source === start.id);
  if (incident.length !== 1) throw new TypeError("live project_start must have exactly one outgoing edge");
  const edge = structuredClone(incident[0]);
  required(edge, ["id", "source", "target"], "live project_start edge");
  for (const [label, value] of [["Start id", start.id], ["edge id", edge.id], ["edge target", edge.target]]) uuid(value, label);
  if (!result.selection.nodes.some((node) => node?.id === edge.target)) throw new TypeError("live project_start edge target is absent from the current graph selection");
  return { start, edge, graph_hash: result.graph_hash, definition_etag: result.definition_etag };
}

function verifyGenericPolicy(configuration) {
  const prompt = configuration.system_prompt;
  exact(configuration.generic_scope_policy, ["id", "system_prompt_sha256"], "generic scope policy");
  if (typeof prompt !== "string" || prompt.length < 40 || configuration.generic_scope_policy.id !== GENERIC_POLICY_ID
    || configuration.generic_scope_policy.system_prompt_sha256 !== sha256(prompt)) throw new TypeError("AgentVersion lacks the positive generic scope policy contract");
}

function verifyAgent(agent, version, worker, request, decision) {
  const employeeId = decision ? request.decision_agent_employee_id : request.qa_agent_employee_id;
  const versionId = decision ? request.decision_agent_version_id : request.qa_agent_version_id;
  required(agent, ["id", "runtime", "is_active", "active_version", "capabilities"], `${decision ? "decision" : "QA"} agent`);
  if (agent.id !== employeeId || agent.is_active !== true || agent.active_version?.id !== versionId) throw new TypeError("agent list readback is foreign or inactive");
  required(version, ["id", "content_hash", "published_at", "workspace", "agent_employee", "configuration_snapshot"], "AgentVersion");
  if (version.id !== versionId || version.agent_employee !== employeeId || version.workspace !== request.workspace_id || !/^[a-f0-9]{64}$/.test(version.content_hash)) throw new TypeError("AgentVersion readback is foreign or unpublished");
  const configuration = version.configuration_snapshot;
  for (const key of ["tools", "skills", "mcp_servers", "integrations"]) if (!Array.isArray(configuration[key]) || !Array.isArray(agent.capabilities[key])) throw new TypeError(`AgentVersion ${key} readback is invalid`);
  verifyGenericPolicy(configuration);
  required(worker, ["agent_employee_id", "agent_version_id", "repository_origin", "repository_access", "model", "capabilities"], "worker binding");
  if (worker.agent_employee_id !== employeeId || worker.agent_version_id !== versionId || worker.repository_origin !== request.repository_origin
    || !["read", "read_write"].includes(worker.repository_access) || !Array.isArray(worker.capabilities)) throw new TypeError("worker binding readback is foreign");
  const capabilities = new Set([...configuration.tools, ...configuration.mcp_servers, ...configuration.integrations,
    ...agent.capabilities.tools, ...agent.capabilities.mcp_servers, ...agent.capabilities.integrations, ...worker.capabilities].map(String));
  const nativeBundle = agent.runtime === "remote" && agent.capabilities.remote_protocol === "native"
    && agent.capabilities.skill_availability?.source === "installed_plugin" && agent.capabilities.skill_availability?.scope === "full_bundled"
    && agent.capabilities.skill_availability?.includes_artifacts === true;
  if (!capabilities.has("git") || !capabilities.has("tool_execution") || !(nativeBundle || capabilities.has("nuanu_artifacts"))
    || !(nativeBundle || capabilities.has("nuanu_work_items"))) throw new TypeError("AgentVersion worker binding lacks required Git/Nuanu/tool capabilities");
  if (!decision && !capabilities.has("browser_qa_v1")) throw new TypeError("QA AgentVersion worker binding lacks browser_qa_v1");
  if (decision) {
    const models = [configuration.base_model, agent.capabilities.base_model, worker.model];
    if (models.some((model) => model !== STRONGEST_CODEX_MODEL)) throw new TypeError("decision AgentVersion is not the strongest requested Codex model");
  }
  return { agent: structuredClone(agent), version: structuredClone(version), worker: structuredClone(worker) };
}

async function workerBinding(primitives, request, employeeId, versionId) {
  const call = { workspace_id: request.workspace_id, project_id: request.project_id, process_template_id: request.process_template_id,
    project_process_binding_id: request.project_process_binding_id, agent_employee_id: employeeId, agent_version_id: versionId, repository_origin: request.repository_origin };
  const envelope = await primitives.readWorkerBinding(structuredClone(call));
  exact(envelope, ["operation", "request", "result"], "worker binding transcript");
  if (envelope.operation !== "get_worker_binding" || canonicalJson(envelope.request) !== canonicalJson(call)) throw new TypeError("worker binding transcript provenance is invalid");
  return envelope.result;
}

async function exactBytes(primitives, request, artifact, download) {
  required(artifact, ["id", "workspace_id", "kind", "status", "versions"], "profile Artifact");
  if (artifact.id !== request.profile_artifact.artifact_id || artifact.workspace_id !== request.workspace_id || artifact.kind !== "document" || artifact.status !== "stored" || !Array.isArray(artifact.versions)) throw new TypeError("profile Artifact readback is foreign");
  const stored = artifact.versions.find((version) => version?.id === request.profile_artifact.version_id);
  required(stored, ["id", "status", "size", "checksum", "media_type"], "profile ArtifactVersion");
  if (stored.status !== "stored" || !Number.isSafeInteger(stored.size) || stored.size < 2 || stored.size > 262144 || !/^[a-f0-9]{64}$/.test(stored.checksum)) throw new TypeError("profile ArtifactVersion readback is invalid");
  required(download, ["artifact_id", "version_id", "download_url"], "profile download URL");
  if (download.artifact_id !== artifact.id || download.version_id !== stored.id) throw new TypeError("profile download URL is for a foreign version");
  const downloadCall = { url: download.download_url, artifact_id: artifact.id, version_id: stored.id, max_bytes: 262144 };
  const downloaded = await primitives.downloadArtifact(structuredClone(downloadCall));
  exact(downloaded, ["operation", "request", "result"], "Artifact download transcript");
  if (downloaded.operation !== "download_artifact_version" || canonicalJson(downloaded.request) !== canonicalJson(downloadCall)) throw new TypeError("Artifact download transcript provenance is invalid");
  const gitCall = { repository_origin: request.repository_origin, commit: request.commit, path: "qa-harness.yaml", max_bytes: 262144 };
  const committed = await primitives.readGitFile(structuredClone(gitCall));
  exact(committed, ["operation", "request", "result"], "Git profile transcript");
  if (committed.operation !== "read_git_file" || canonicalJson(committed.request) !== canonicalJson(gitCall)) throw new TypeError("Git profile transcript provenance is invalid");
  for (const [label, response] of [["Artifact", downloaded.result], ["Git", committed.result]]) {
    exact(response, ["bytes", "sha256"], `${label} profile bytes`);
    if (!Buffer.isBuffer(response.bytes) || response.bytes.byteLength < 2 || response.bytes.byteLength > 262144 || response.sha256 !== bytesSha256(response.bytes)) throw new TypeError(`${label} profile bytes are invalid`);
  }
  if (stored.size !== downloaded.result.bytes.byteLength || stored.checksum !== bytesSha256(downloaded.result.bytes).slice(7)
    || !downloaded.result.bytes.equals(committed.result.bytes)) throw new TypeError("profile ArtifactVersion does not equal exact pinned Git bytes");
  return bytesSha256(downloaded.result.bytes);
}

export async function runNuanuInstallPreflight(adapter, rawRequest) {
  const primitives = ADAPTERS.get(adapter);
  if (!primitives) throw new TypeError("trusted branded Nuanu install adapter is required");
  const request = installRequest(rawRequest);
  const binding = await gateway(primitives, request, "get_project_process_binding", { workspace_slug: request.workspace_slug, project_id: request.project_id, binding_id: request.project_process_binding_id });
  verifyBinding(binding, request);
  const graph = await gateway(primitives, request, "get_process_graph", { workspace_slug: request.workspace_slug, template_id: request.process_template_id, view: "selection", node_keys: ["project_start"], include_neighbors: true, include_incident_edges: true });
  const live = verifyLiveStart(graph, request);
  const agents = await gateway(primitives, request, "list_agents", { workspace_slug: request.workspace_slug });
  if (!Array.isArray(agents)) throw new TypeError("agent list readback must be an array");
  const qaAgent = agents.find((agent) => agent?.id === request.qa_agent_employee_id);
  const decisionAgent = agents.find((agent) => agent?.id === request.decision_agent_employee_id);
  const qaVersion = await gateway(primitives, request, "get_agent_version", { workspace_slug: request.workspace_slug, agent_id: request.qa_agent_employee_id, version_id: request.qa_agent_version_id });
  const decisionVersion = await gateway(primitives, request, "get_agent_version", { workspace_slug: request.workspace_slug, agent_id: request.decision_agent_employee_id, version_id: request.decision_agent_version_id });
  const qaWorker = await workerBinding(primitives, request, request.qa_agent_employee_id, request.qa_agent_version_id);
  const decisionWorker = await workerBinding(primitives, request, request.decision_agent_employee_id, request.decision_agent_version_id);
  const qa = verifyAgent(qaAgent, qaVersion, qaWorker, request, false);
  const decision = verifyAgent(decisionAgent, decisionVersion, decisionWorker, request, true);
  const artifact = await gateway(primitives, request, "get_artifact", { workspace_slug: request.workspace_slug, artifact_id: request.profile_artifact.artifact_id });
  const download = await gateway(primitives, request, "get_artifact_download_url", { workspace_slug: request.workspace_slug, artifact_id: request.profile_artifact.artifact_id, version: request.profile_artifact.version_id });
  const profileDigest = await exactBytes(primitives, request, artifact, download);
  const bindings = {
    project_process_binding_id: request.project_process_binding_id, project_id: request.project_id,
    ready_for_qa_state_id: request.ready_for_qa_state_id, in_progress_state_id: request.in_progress_state_id, ready_for_production_state_id: request.ready_for_production_state_id,
    qa_agent_employee_id: request.qa_agent_employee_id, qa_agent_version_id: request.qa_agent_version_id,
    decision_agent_employee_id: request.decision_agent_employee_id, decision_agent_version_id: request.decision_agent_version_id,
    decision_agent_metadata: structuredClone(request.decision_agent_metadata), platform_start_node: live.start, platform_start_edge: live.edge,
    platform_start_fingerprint: sha256(live.start), platform_start_edge_fingerprint: sha256(live.edge), profile_artifact: structuredClone(request.profile_artifact),
  };
  const attestation = Object.freeze({ kind: "nuanu.qa-install-attestation.v1" });
  ATTESTATIONS.set(attestation, { bindings, request, live_graph_hash: live.graph_hash, live_definition_etag: live.definition_etag,
    profile_digest: profileDigest, qa_sha256: sha256(qa), decision_sha256: sha256(decision) });
  return attestation;
}

export function consumeNuanuInstallAttestation(attestation) {
  const payload = ATTESTATIONS.get(attestation);
  if (!payload) throw new TypeError("install attestation must come from the trusted Nuanu transcript adapter");
  return structuredClone(payload);
}

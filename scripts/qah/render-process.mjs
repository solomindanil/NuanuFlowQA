import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "./canonical.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /__BINDING_[A-Z0-9_]+__/g;
const TOKEN_LIKE = /__BINDING|__[A-Z][A-Z0-9_]{2,}__/i;
const BLUEPRINT_FINGERPRINT = "sha256:ade26256fa47252e8374375ed6be33b594c8516738584269c3cb935f9c27fc39";
const REQUIRED_BINDING_KEYS = Object.freeze([
  "project_process_binding_id",
  "project_id",
  "ready_for_qa_state_id",
  "in_progress_state_id",
  "ready_for_production_state_id",
  "qa_agent_employee_id",
  "qa_agent_version_id",
  "decision_agent_employee_id",
  "decision_agent_version_id",
  "decision_agent_metadata",
  "platform_start_node",
  "platform_start_edge",
  "platform_start_edge_fingerprint",
  "platform_start_fingerprint",
  "profile_artifact",
]);
const EXPECTED_TOKENS = Object.freeze([
  "__BINDING_IN_PROGRESS_STATE_ID__",
  "__BINDING_READY_FOR_PRODUCTION_STATE_ID__",
  "__BINDING_QA_AGENT_EMPLOYEE_ID__",
  "__BINDING_QA_AGENT_VERSION_ID__",
  "__BINDING_DECISION_AGENT_EMPLOYEE_ID__",
  "__BINDING_DECISION_AGENT_VERSION_ID__",
  "__BINDING_DECISION_MODEL__",
  "__BINDING_PROFILE_ARTIFACT_ID__",
  "__BINDING_PROFILE_VERSION_ID__",
  "__BINDING_PROFILE_KIND__",
  "__BINDING_PROFILE_ROLE__",
]);
const REQUIRED_DECISION_CAPABILITIES = Object.freeze(["git", "nuanu_mcp", "tool_execution"]);

function exactObject(value, required, optional, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  for (const key of required) if (!Object.hasOwn(value, key)) throw new TypeError(`${label} is missing ${key}`);
  for (const key of keys) if (!allowed.has(key)) throw new TypeError(`${label} has unknown key ${key}`);
  return value;
}

function uuid(value, label) {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(`${label} must be a UUID`);
  return value;
}

function normalizeDecisionMetadata(value) {
  exactObject(value, ["requested_model", "required_capabilities"], [], "decision_agent_metadata");
  if (value.requested_model !== "openai/gpt-5.6-sol-pro") throw new TypeError("decision_agent_metadata must request the strongest published Codex model");
  if (!Array.isArray(value.required_capabilities)
    || canonicalJson([...value.required_capabilities].sort()) !== canonicalJson([...REQUIRED_DECISION_CAPABILITIES].sort())) {
    throw new TypeError("decision_agent_metadata capabilities must include exact Git, Nuanu MCP, and tool execution bindings");
  }
  return { requested_model: value.requested_model, required_capabilities: [...REQUIRED_DECISION_CAPABILITIES] };
}

function normalizePlatformStart(value, bindings) {
  exactObject(value, ["id", "key", "type", "name", "trigger", "config"], [], "platform_start_node");
  uuid(value.id, "platform_start_node.id");
  if (value.type !== "start" || value.key !== "project_start") throw new TypeError("platform_start_node must be the generated Column Start");
  if (typeof value.name !== "string" || value.name.length < 1 || value.name.length > 80) throw new TypeError("platform_start_node name is invalid");
  exactObject(value.trigger, ["mode"], [], "platform_start_node.trigger");
  if (value.trigger.mode !== "manual") throw new TypeError("platform_start_node trigger must be preserved from the live Column graph");
  exactObject(value.config, ["project_process_start", "output"], [], "platform_start_node.config");
  const generated = exactObject(value.config.project_process_start, ["binding_id", "project_id", "state_id"], [], "platform_start_node.config.project_process_start");
  if (generated.binding_id !== bindings.project_process_binding_id || generated.project_id !== bindings.project_id || generated.state_id !== bindings.ready_for_qa_state_id) {
    throw new TypeError("platform_start_node immutable Column Start binding changed");
  }
  if (typeof bindings.platform_start_fingerprint !== "string" || sha256(value) !== bindings.platform_start_fingerprint) {
    throw new TypeError("platform_start_node does not match its live Column Start fingerprint");
  }
  return JSON.parse(canonicalJson(value));
}

function normalizePlatformStartEdge(value, start, fingerprint) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("platform_start_edge must be the complete live edge object");
  for (const key of ["id", "source", "target"]) if (!Object.hasOwn(value, key)) throw new TypeError(`platform_start_edge is missing ${key}`);
  uuid(value.id, "platform_start_edge.id");
  uuid(value.source, "platform_start_edge.source");
  uuid(value.target, "platform_start_edge.target");
  if (value.source !== start.id || value.target === start.id) throw new TypeError("platform_start_edge source/target does not match the live Column Start");
  if (typeof fingerprint !== "string" || sha256(value) !== fingerprint) throw new TypeError("platform_start_edge does not match its live fingerprint");
  if (TOKEN_LIKE.test(canonicalJson(value))) throw new TypeError("platform_start_edge contains an unresolved token");
  return structuredClone(value);
}

function normalizedBindings(value) {
  exactObject(value, REQUIRED_BINDING_KEYS, [], "bindings");
  if (!value.decision_agent_employee_id || !value.decision_agent_version_id) {
    throw new TypeError("decision agent employee and version are required and must be distinct from the QA agent");
  }
  for (const key of [
    "project_process_binding_id", "project_id", "ready_for_qa_state_id", "in_progress_state_id", "ready_for_production_state_id",
    "qa_agent_employee_id", "qa_agent_version_id", "decision_agent_employee_id", "decision_agent_version_id",
  ]) uuid(value[key], key);
  if (value.decision_agent_employee_id === value.qa_agent_employee_id || value.decision_agent_version_id === value.qa_agent_version_id) {
    throw new TypeError("decision agent employee and version must be explicit and distinct from the QA agent");
  }
  const decisionMetadata = normalizeDecisionMetadata(value.decision_agent_metadata);
  const profile = exactObject(value.profile_artifact, ["artifact_id", "version_id", "kind", "role"], [], "profile_artifact");
  uuid(profile.artifact_id, "profile_artifact.artifact_id");
  uuid(profile.version_id, "profile_artifact.version_id");
  if (profile.kind !== "document" || profile.role !== "implementation") throw new TypeError("profile_artifact must be an existing document ArtifactVersion with implementation role");
  const states = [value.ready_for_qa_state_id, value.in_progress_state_id, value.ready_for_production_state_id];
  if (new Set(states).size !== states.length) throw new TypeError("state UUIDs must be distinct");
  const normalized = { ...value, decision_agent_metadata: decisionMetadata, profile_artifact: { ...profile } };
  normalized.platform_start_node = normalizePlatformStart(value.platform_start_node, normalized);
  normalized.platform_start_edge = normalizePlatformStartEdge(value.platform_start_edge, normalized.platform_start_node, value.platform_start_edge_fingerprint);
  return normalized;
}

function tokenValues(bindings) {
  return new Map([
    ["__BINDING_IN_PROGRESS_STATE_ID__", bindings.in_progress_state_id],
    ["__BINDING_READY_FOR_PRODUCTION_STATE_ID__", bindings.ready_for_production_state_id],
    ["__BINDING_QA_AGENT_EMPLOYEE_ID__", bindings.qa_agent_employee_id],
    ["__BINDING_QA_AGENT_VERSION_ID__", bindings.qa_agent_version_id],
    ["__BINDING_DECISION_AGENT_EMPLOYEE_ID__", bindings.decision_agent_employee_id],
    ["__BINDING_DECISION_AGENT_VERSION_ID__", bindings.decision_agent_version_id],
    ["__BINDING_DECISION_MODEL__", bindings.decision_agent_metadata.requested_model],
    ["__BINDING_PROFILE_ARTIFACT_ID__", bindings.profile_artifact.artifact_id],
    ["__BINDING_PROFILE_VERSION_ID__", bindings.profile_artifact.version_id],
    ["__BINDING_PROFILE_KIND__", bindings.profile_artifact.kind],
    ["__BINDING_PROFILE_ROLE__", bindings.profile_artifact.role],
  ]);
}

function replaceTokens(value, values) {
  if (typeof value === "string") return value.replace(TOKEN, (token) => {
    if (!values.has(token)) throw new TypeError(`unresolved binding token ${token}`);
    return values.get(token);
  });
  if (Array.isArray(value)) return value.map((entry) => replaceTokens(entry, values));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceTokens(entry, values)]));
  return value;
}

function validateBlueprint(blueprint) {
  exactObject(blueprint, ["blueprint_version", "binding_tokens", "graph"], [], "blueprint");
  if (blueprint.blueprint_version !== "nuanu.universal-qa-flow.blueprint.v1") throw new TypeError("unsupported blueprint_version");
  let residue = canonicalJson(blueprint);
  for (const token of EXPECTED_TOKENS) residue = residue.split(token).join("");
  if (TOKEN_LIKE.test(residue)) throw new TypeError("unresolved binding token in blueprint");
  if (sha256(blueprint) !== BLUEPRINT_FINGERPRINT) throw new TypeError("blueprint integrity or topology fingerprint mismatch");
  if (!Array.isArray(blueprint.binding_tokens) || canonicalJson([...blueprint.binding_tokens].sort()) !== canonicalJson([...EXPECTED_TOKENS].sort())) throw new TypeError("blueprint binding_tokens do not match the renderer contract");
  if (!blueprint.graph || blueprint.graph.schema_version !== 1 || !Array.isArray(blueprint.graph.nodes) || !Array.isArray(blueprint.graph.edges)) throw new TypeError("blueprint graph must be Process graph v1");
  if (blueprint.graph.nodes.some((node) => node.type === "start" || node.key === "project_start")) throw new TypeError("blueprint must not author the platform Column Start");
  if (blueprint.graph.nodes.length !== 20 || blueprint.graph.edges.length !== 23) throw new TypeError("blueprint semantic topology fingerprint mismatch");
}

function validateRenderedGraph(graph, bindings) {
  if (TOKEN_LIKE.test(canonicalJson(graph))) throw new TypeError("unresolved binding token remains after rendering");
  const allIds = []; const nodeIds = new Set(); const nodeKeys = new Set();
  for (const node of graph.nodes) {
    uuid(node.id, `node ${node.key ?? "unknown"} id`);
    if (typeof node.key !== "string" || nodeKeys.has(node.key)) throw new TypeError("node keys must be unique strings");
    if (typeof node.name !== "string" || node.name.length === 0 || node.name.length > 80) throw new TypeError(`node ${node.key} must have a concise name`);
    nodeIds.add(node.id); nodeKeys.add(node.key); allIds.push(node.id);
  }
  for (const edge of graph.edges) {
    uuid(edge.id, "edge id");
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new TypeError("edge endpoint is not a rendered node");
    allIds.push(edge.id);
  }
  if (new Set(allIds).size !== allIds.length) throw new TypeError("node and edge UUIDs must be globally unique");
  const start = graph.nodes[0];
  if (canonicalJson(start) !== canonicalJson(bindings.platform_start_node)) throw new TypeError("rendered Column Start changed");
  const startEdges = graph.edges.filter((edge) => edge.source === start.id || edge.target === start.id);
  if (startEdges.length !== 1 || canonicalJson(startEdges[0]) !== canonicalJson(bindings.platform_start_edge)) throw new TypeError("rendered Column Start connection changed");
  if (graph.nodes[1]?.key !== "resolve_flow_item" || graph.nodes[1]?.id !== bindings.platform_start_edge.target) throw new TypeError("live Start edge target must be resolve_flow_item");
  const decision = graph.nodes.find((node) => node.key === "independent_release_decision");
  if (canonicalJson(decision?.config?.binding_metadata) !== canonicalJson(bindings.decision_agent_metadata)) throw new TypeError("decision capability binding changed");
}

export function renderProcess(blueprint, rawBindings) {
  validateBlueprint(blueprint);
  const bindings = normalizedBindings(rawBindings);
  const authored = replaceTokens(structuredClone(blueprint.graph), tokenValues(bindings));
  if (TOKEN_LIKE.test(canonicalJson(authored))) throw new TypeError("unresolved binding token remains after rendering");
  const originalFirstId = authored.nodes[0]?.id;
  if (authored.nodes[0]?.key !== "resolve_flow_item") throw new TypeError("first semantic authored node must be resolve_flow_item");
  if (authored.nodes.slice(1).some((node) => node.id === bindings.platform_start_edge.target)
    || authored.edges.some((edge) => edge.id === bindings.platform_start_edge.id)) throw new TypeError("platform_start_edge target/id collides with authored topology");
  authored.nodes[0].id = bindings.platform_start_edge.target;
  for (const edge of authored.edges) {
    if (edge.source === originalFirstId) edge.source = bindings.platform_start_edge.target;
    if (edge.target === originalFirstId) edge.target = bindings.platform_start_edge.target;
  }
  const graph = {
    ...authored,
    nodes: [structuredClone(bindings.platform_start_node), ...authored.nodes],
    edges: [structuredClone(bindings.platform_start_edge), ...authored.edges],
  };
  validateRenderedGraph(graph, bindings);
  return JSON.parse(canonicalJson(graph));
}

const VERIFIED_INSTALL_ATTESTATIONS = new WeakSet();

function byteDigest(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength < 2 || bytes.byteLength > 262144) throw new TypeError("profile resolver must return bounded exact bytes");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeInstallRequest(value) {
  exactObject(value, ["workspace_id", "repository_origin", "commit"], [], "install request");
  uuid(value.workspace_id, "install workspace_id");
  let origin;
  try { origin = new URL(value.repository_origin); } catch { origin = null; }
  if (origin?.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.href !== value.repository_origin) throw new TypeError("install repository_origin must be exact credential-free HTTPS");
  if (typeof value.commit !== "string" || !/^[a-f0-9]{40}$/.test(value.commit)) throw new TypeError("install commit must be an exact Git commit");
  return { ...value };
}

function verifyAgentSnapshot(response, expectedEmployee, expectedVersion, install, decision, metadata) {
  exactObject(response, ["agent", "version", "worker_binding"], [], `${decision ? "decision" : "QA"} trusted agent resolver response`);
  const agent = response.agent;
  const version = response.version;
  const worker = response.worker_binding;
  if (!agent || agent.id !== expectedEmployee || agent.is_active !== true || !["local", "remote"].includes(agent.runtime)
    || agent.active_version?.id !== expectedVersion || !agent.capabilities || typeof agent.capabilities !== "object") throw new TypeError("agent resolver returned a foreign or inactive employee/version");
  if (!version || version.id !== expectedVersion || version.agent_employee !== expectedEmployee || version.workspace !== install.workspace_id
    || typeof version.content_hash !== "string" || !/^[a-f0-9]{64}$/.test(version.content_hash)
    || typeof version.published_at !== "string" || !version.configuration_snapshot) throw new TypeError("AgentVersion resolver did not return the exact published snapshot");
  const configuration = version.configuration_snapshot;
  for (const key of ["tools", "skills", "mcp_servers", "integrations"]) if (!Array.isArray(configuration[key]) || !Array.isArray(agent.capabilities[key])) throw new TypeError(`AgentVersion ${key} must be inspected arrays`);
  exactObject(worker, ["repository_origin", "repository_access", "model", "capabilities"], [], "trusted worker binding");
  if (worker.repository_origin !== install.repository_origin || !["read", "read_write"].includes(worker.repository_access)) throw new TypeError("worker repository binding does not match install request");
  if (!Array.isArray(worker.capabilities)) throw new TypeError("worker capabilities must be inspected");
  const capabilities = new Set([
    ...configuration.tools, ...configuration.mcp_servers, ...configuration.integrations,
    ...agent.capabilities.tools, ...agent.capabilities.mcp_servers, ...agent.capabilities.integrations,
    ...worker.capabilities,
  ].map(String));
  const nativeBundle = agent.runtime === "remote" && agent.capabilities.remote_protocol === "native"
    && agent.capabilities.skill_availability?.source === "installed_plugin"
    && agent.capabilities.skill_availability?.scope === "full_bundled"
    && agent.capabilities.skill_availability?.includes_artifacts === true;
  if (!capabilities.has("git") || !capabilities.has("tool_execution")) throw new TypeError("AgentVersion lacks Git/tool execution capabilities");
  if (!(nativeBundle || [...capabilities].some((entry) => /nuanu.*artifact/i.test(entry)))) throw new TypeError("AgentVersion lacks Nuanu Artifact capability");
  if (!(nativeBundle || [...capabilities].some((entry) => /nuanu.*work[_ -]?items?/i.test(entry)))) throw new TypeError("AgentVersion lacks Nuanu work-item capability");
  if (typeof configuration.system_prompt !== "string" || configuration.system_prompt.length < 20) throw new TypeError("AgentVersion system prompt is empty");
  if (/paydemo|payment|плат[её]ж|bank[_ -]?transfer|банковск|checkout endpoint/iu.test(configuration.system_prompt)) throw new TypeError("AgentVersion prompt must be generic and product-independent");
  if (decision) {
    const declaredModels = [configuration.base_model, agent.capabilities.base_model, worker.model].filter((value) => value !== undefined);
    if (declaredModels.length !== 3 || new Set(declaredModels).size !== 1) throw new TypeError("decision AgentVersion model declarations do not match");
    const [model] = declaredModels;
    if (model !== metadata.requested_model || !/^openai\/gpt-5\.6-sol-pro$/.test(model)) throw new TypeError("decision AgentVersion is not the strongest requested OpenAI Codex model");
  }
  return structuredClone(response);
}

export async function verifyInstallPreconditions(rawBindings, rawInstall, dependencies) {
  const bindings = normalizedBindings(rawBindings);
  const install = normalizeInstallRequest(rawInstall);
  if (!dependencies || typeof dependencies.resolveAgentVersion !== "function" || typeof dependencies.resolveArtifactVersion !== "function" || typeof dependencies.resolveProfileAtCommit !== "function") throw new TypeError("trusted live install resolvers are required");
  const [qa, decision, artifact, committed] = await Promise.all([
    dependencies.resolveAgentVersion({ workspace_id: install.workspace_id, employee_id: bindings.qa_agent_employee_id, version_id: bindings.qa_agent_version_id }),
    dependencies.resolveAgentVersion({ workspace_id: install.workspace_id, employee_id: bindings.decision_agent_employee_id, version_id: bindings.decision_agent_version_id }),
    dependencies.resolveArtifactVersion({ workspace_id: install.workspace_id, ref: bindings.profile_artifact, max_bytes: 262144 }),
    dependencies.resolveProfileAtCommit({ repository_origin: install.repository_origin, commit: install.commit, path: "qa-harness.yaml", max_bytes: 262144 }),
  ]);
  const qaSnapshot = verifyAgentSnapshot(qa, bindings.qa_agent_employee_id, bindings.qa_agent_version_id, install, false, bindings.decision_agent_metadata);
  const decisionSnapshot = verifyAgentSnapshot(decision, bindings.decision_agent_employee_id, bindings.decision_agent_version_id, install, true, bindings.decision_agent_metadata);
  if (!artifact || artifact.workspace_id !== install.workspace_id || artifact.artifact_id !== bindings.profile_artifact.artifact_id || artifact.version_id !== bindings.profile_artifact.version_id || artifact.kind !== "document" || artifact.status !== "stored") throw new TypeError("profile resolver returned a foreign or unstored ArtifactVersion");
  const artifactDigest = byteDigest(artifact.bytes);
  if (!Number.isSafeInteger(artifact.size) || artifact.size !== artifact.bytes.byteLength || artifact.checksum !== artifactDigest.slice(7)) throw new TypeError("profile ArtifactVersion size/checksum does not match exact bytes");
  if (!committed || committed.repository_origin !== install.repository_origin || committed.commit !== install.commit || committed.path !== "qa-harness.yaml") throw new TypeError("profile Git resolver returned a foreign commit/path");
  const commitDigest = byteDigest(committed.bytes);
  if (committed.sha256 !== commitDigest || !artifact.bytes.equals(committed.bytes) || artifactDigest !== commitDigest) throw new TypeError("profile ArtifactVersion bytes do not equal exact pinned Git bytes");
  const attestation = Object.freeze({
    verified: true,
    bindings_sha256: sha256(bindings),
    install_sha256: sha256(install),
    qa_agent_sha256: sha256(qaSnapshot),
    decision_agent_sha256: sha256(decisionSnapshot),
    profile_blob_sha256: artifactDigest,
  });
  VERIFIED_INSTALL_ATTESTATIONS.add(attestation);
  return attestation;
}

export function renderProcessForInstall(blueprint, bindings, attestation) {
  if (!attestation || !VERIFIED_INSTALL_ATTESTATIONS.has(attestation) || attestation.bindings_sha256 !== sha256(normalizedBindings(bindings))) throw new TypeError("install attestation must be created by the trusted verifier for these exact bindings");
  return { graph: renderProcess(blueprint, bindings), install_attestation: attestation };
}

export async function renderForInstall(blueprint, bindings, install, dependencies) {
  const attestation = await verifyInstallPreconditions(bindings, install, dependencies);
  return renderProcessForInstall(blueprint, bindings, attestation);
}

export function renderProcessJson(blueprint, bindings) {
  return canonicalJson(renderProcess(blueprint, bindings));
}

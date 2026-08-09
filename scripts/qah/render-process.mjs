import { canonicalJson, sha256 } from "./canonical.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /__BINDING_[A-Z0-9_]+__/g;
const TOKEN_LIKE = /__BINDING|__[A-Z][A-Z0-9_]{2,}__/i;
const BLUEPRINT_FINGERPRINT = "sha256:adf37563e220d25f2e390a86b593f3d1a7e032f46457009bfd887e1d8c89ddd5";
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
  "platform_start_edge_id",
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

function normalizedBindings(value) {
  exactObject(value, REQUIRED_BINDING_KEYS, [], "bindings");
  if (!value.decision_agent_employee_id || !value.decision_agent_version_id) {
    throw new TypeError("decision agent employee and version are required and must be distinct from the QA agent");
  }
  for (const key of [
    "project_process_binding_id", "project_id", "ready_for_qa_state_id", "in_progress_state_id", "ready_for_production_state_id",
    "qa_agent_employee_id", "qa_agent_version_id", "decision_agent_employee_id", "decision_agent_version_id", "platform_start_edge_id",
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
  if (startEdges.length !== 1 || canonicalJson(startEdges[0]) !== canonicalJson({ id: bindings.platform_start_edge_id, source: start.id, target: graph.nodes[1].id })) throw new TypeError("rendered Column Start connection changed");
  const decision = graph.nodes.find((node) => node.key === "independent_release_decision");
  if (canonicalJson(decision?.config?.binding_metadata) !== canonicalJson(bindings.decision_agent_metadata)) throw new TypeError("decision capability binding changed");
}

export function renderProcess(blueprint, rawBindings) {
  validateBlueprint(blueprint);
  const bindings = normalizedBindings(rawBindings);
  const authored = replaceTokens(structuredClone(blueprint.graph), tokenValues(bindings));
  if (TOKEN_LIKE.test(canonicalJson(authored))) throw new TypeError("unresolved binding token remains after rendering");
  const graph = {
    ...authored,
    nodes: [structuredClone(bindings.platform_start_node), ...authored.nodes],
    edges: [{ id: bindings.platform_start_edge_id, source: bindings.platform_start_node.id, target: authored.nodes[0].id }, ...authored.edges],
  };
  validateRenderedGraph(graph, bindings);
  return JSON.parse(canonicalJson(graph));
}

export function renderProcessJson(blueprint, bindings) {
  return canonicalJson(renderProcess(blueprint, bindings));
}

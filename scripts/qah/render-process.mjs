import { canonicalJson, sha256 } from "./canonical.mjs";
import { consumeDirectInstallAttestation, runDirectInstallPreflight } from "./install-preflight.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /__BINDING_[A-Z0-9_]+__/g;
const TOKEN_LIKE = /__BINDING|__[A-Z][A-Z0-9_]{2,}__/i;
const BLUEPRINT_FINGERPRINT = "sha256:a2bcd641b4dbfccaf741563b931f38145e823bb65438c92e8c6cd398daf97e48";
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
  if (blueprint.graph.nodes.length !== 21 || blueprint.graph.edges.length !== 24) throw new TypeError("blueprint semantic topology fingerprint mismatch");
}

export function validateFinalProofGate(graph, expectedStates) {
  const fail = (message) => { throw new TypeError(`FINAL_PROOF_GATE_INVALID: ${message}`); };
  if (!expectedStates || typeof expectedStates !== "object" || Array.isArray(expectedStates)
    || canonicalJson(Object.keys(expectedStates).sort()) !== canonicalJson(["in_progress_state_id", "ready_for_production_state_id"])) {
    fail("expectedStates must contain exactly ready_for_production_state_id and in_progress_state_id");
  }
  for (const key of ["ready_for_production_state_id", "in_progress_state_id"]) {
    if (typeof expectedStates[key] !== "string" || !UUID.test(expectedStates[key])) fail(`${key} must be a UUID`);
  }
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) fail("graph must contain node and edge arrays");
  const nodes = new Map(graph.nodes.map((node) => [node.key, node]));
  const exactNodes = {
    finalize_transition: "10000000-0000-5000-8000-000000000018",
    transition_route: "10000000-0000-5000-8000-000000000019",
    ready_for_production_end: "10000000-0000-5000-8000-000000000020",
    in_progress_end: "10000000-0000-5000-8000-000000000021",
    qa_needs_human_end: "10000000-0000-5000-8000-000000000022",
  };
  for (const [key, id] of Object.entries(exactNodes)) {
    if (nodes.get(key)?.id !== id) fail(`${key} must preserve ID ${id}`);
  }
  const finalizer = nodes.get("finalize_transition");
  const route = nodes.get("transition_route");
  const ready = nodes.get("ready_for_production_end");
  const rejected = nodes.get("in_progress_end");
  const hold = nodes.get("qa_needs_human_end");
  if (route.type !== "proof_gate") fail("transition_route must be proof_gate");
  if (canonicalJson(route.config) !== canonicalJson({ profile_key: "qa_result_v1", profile_version: "1", ai_assessment: "off" })) {
    fail("transition_route must use stock qa_result_v1@1 with AI assessment off");
  }
  const incoming = graph.edges.filter(({ target }) => target === route.id);
  if (canonicalJson(incoming) !== canonicalJson([{
    id: "20000000-0000-5000-8000-000000000022", source: finalizer.id, target: route.id,
  }])) fail("transition_route must have the exact direct finalizer edge");
  const expectedOutgoing = [
    { id: "20000000-0000-5000-8000-000000000023", source: route.id, target: ready.id, name: "passed", when: { outcome: "passed" } },
    { id: "20000000-0000-5000-8000-000000000024", source: route.id, target: rejected.id, name: "not_passed", when: { outcome: "not_passed" } },
    { id: "20000000-0000-5000-8000-000000000025", source: route.id, target: hold.id, name: "unable_to_verify", when: { outcome: "unable_to_verify" } },
  ];
  const outgoing = graph.edges.filter(({ source }) => source === route.id);
  if (canonicalJson(outgoing) !== canonicalJson(expectedOutgoing)) fail("transition_route must have the exact three direct outcome edges");
  if (new Set(outgoing.map((edge) => edge.when?.outcome)).size !== 3) fail("Proof Gate outcomes must be unique");
  for (const edge of outgoing) {
    for (const key of ["var", "raw", "otherwise", "branch"]) {
      if (Object.hasOwn(edge.when ?? {}, key)) fail(`Proof Gate edge ${edge.id} uses forbidden ${key} routing`);
    }
  }
  if (ready.type !== "end" || ready.config?.project_status?.target_state_id !== expectedStates.ready_for_production_state_id) {
    fail("passed must target the exact Ready for Production End state");
  }
  if (rejected.type !== "end" || rejected.config?.project_status?.target_state_id !== expectedStates.in_progress_state_id) {
    fail("not_passed must target the exact In Progress End state");
  }
  if (hold.type !== "end" || hold.config?.project_status?.target_state_id !== null) {
    fail("unable_to_verify must target the neutral Ready for QA hold End");
  }
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
  validateFinalProofGate(graph, {
    ready_for_production_state_id: bindings.ready_for_production_state_id,
    in_progress_state_id: bindings.in_progress_state_id,
  });
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

export async function verifyInstallPreconditions(installRequest) {
  return runDirectInstallPreflight(installRequest);
}

export function renderProcessForInstall(blueprint, attestation) {
  const verified = consumeDirectInstallAttestation(attestation);
  if (verified.test_mode || verified.install_ready !== true) throw new TypeError(`preflight is not install-ready: ${(verified.unmet_preconditions ?? []).join("; ")}`);
  return {
    graph: renderProcess(blueprint, verified.bindings),
    install_attestation: {
      kind: "nuanu.qah-direct-install-attestation.v1",
      graph_hash: verified.graph_hash, definition_etag: verified.definition_etag, profile_digest: verified.profile_digest,
    },
  };
}

export async function renderForInstall(blueprint, installRequest) {
  const attestation = await verifyInstallPreconditions(installRequest);
  return renderProcessForInstall(blueprint, attestation);
}

export function renderProcessJson(blueprint, bindings) {
  return canonicalJson(renderProcess(blueprint, bindings));
}

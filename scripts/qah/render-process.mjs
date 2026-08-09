import { canonicalJson } from "./canonical.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /__BINDING_[A-Z0-9_]+__/g;
const REQUIRED_BINDING_KEYS = Object.freeze([
  "project_process_binding_id",
  "project_id",
  "ready_for_qa_state_id",
  "in_progress_state_id",
  "ready_for_production_state_id",
  "qa_agent_employee_id",
  "qa_agent_version_id",
  "profile_artifact",
]);
const OPTIONAL_BINDING_KEYS = Object.freeze(["decision_agent_employee_id", "decision_agent_version_id"]);
const EXPECTED_TOKENS = Object.freeze([
  "__BINDING_PROCESS_BINDING_ID__",
  "__BINDING_PROJECT_ID__",
  "__BINDING_READY_FOR_QA_STATE_ID__",
  "__BINDING_IN_PROGRESS_STATE_ID__",
  "__BINDING_READY_FOR_PRODUCTION_STATE_ID__",
  "__BINDING_QA_AGENT_EMPLOYEE_ID__",
  "__BINDING_QA_AGENT_VERSION_ID__",
  "__BINDING_DECISION_AGENT_EMPLOYEE_ID__",
  "__BINDING_DECISION_AGENT_VERSION_ID__",
  "__BINDING_PROFILE_ARTIFACT_ID__",
  "__BINDING_PROFILE_VERSION_ID__",
  "__BINDING_PROFILE_KIND__",
  "__BINDING_PROFILE_ROLE__",
]);

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

function normalizedBindings(value) {
  exactObject(value, REQUIRED_BINDING_KEYS, OPTIONAL_BINDING_KEYS, "bindings");
  for (const key of REQUIRED_BINDING_KEYS.filter((key) => key !== "profile_artifact")) uuid(value[key], key);
  const decisionEmployee = value.decision_agent_employee_id;
  const decisionVersion = value.decision_agent_version_id;
  if ((decisionEmployee === undefined) !== (decisionVersion === undefined)) {
    throw new TypeError("decision agent bindings must be supplied together");
  }
  if (decisionEmployee !== undefined) {
    uuid(decisionEmployee, "decision_agent_employee_id");
    uuid(decisionVersion, "decision_agent_version_id");
  }
  const profile = exactObject(value.profile_artifact, ["artifact_id", "version_id", "kind", "role"], [], "profile_artifact");
  uuid(profile.artifact_id, "profile_artifact.artifact_id");
  uuid(profile.version_id, "profile_artifact.version_id");
  if (profile.kind !== "document" || profile.role !== "implementation") {
    throw new TypeError("profile_artifact must be a document with implementation role");
  }
  const states = [value.ready_for_qa_state_id, value.in_progress_state_id, value.ready_for_production_state_id];
  if (new Set(states).size !== states.length) throw new TypeError("state UUIDs must be distinct");
  return {
    ...value,
    decision_agent_employee_id: decisionEmployee ?? value.qa_agent_employee_id,
    decision_agent_version_id: decisionVersion ?? value.qa_agent_version_id,
    profile_artifact: { ...profile },
  };
}

function tokenValues(bindings) {
  return new Map([
    ["__BINDING_PROCESS_BINDING_ID__", bindings.project_process_binding_id],
    ["__BINDING_PROJECT_ID__", bindings.project_id],
    ["__BINDING_READY_FOR_QA_STATE_ID__", bindings.ready_for_qa_state_id],
    ["__BINDING_IN_PROGRESS_STATE_ID__", bindings.in_progress_state_id],
    ["__BINDING_READY_FOR_PRODUCTION_STATE_ID__", bindings.ready_for_production_state_id],
    ["__BINDING_QA_AGENT_EMPLOYEE_ID__", bindings.qa_agent_employee_id],
    ["__BINDING_QA_AGENT_VERSION_ID__", bindings.qa_agent_version_id],
    ["__BINDING_DECISION_AGENT_EMPLOYEE_ID__", bindings.decision_agent_employee_id],
    ["__BINDING_DECISION_AGENT_VERSION_ID__", bindings.decision_agent_version_id],
    ["__BINDING_PROFILE_ARTIFACT_ID__", bindings.profile_artifact.artifact_id],
    ["__BINDING_PROFILE_VERSION_ID__", bindings.profile_artifact.version_id],
    ["__BINDING_PROFILE_KIND__", bindings.profile_artifact.kind],
    ["__BINDING_PROFILE_ROLE__", bindings.profile_artifact.role],
  ]);
}

function replaceTokens(value, values) {
  if (typeof value === "string") {
    return value.replace(TOKEN, (token) => {
      if (!values.has(token)) throw new TypeError(`unresolved binding token ${token}`);
      return values.get(token);
    });
  }
  if (Array.isArray(value)) return value.map((entry) => replaceTokens(entry, values));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceTokens(entry, values)]));
  }
  return value;
}

function validateBlueprint(blueprint) {
  exactObject(blueprint, ["blueprint_version", "binding_tokens", "graph"], [], "blueprint");
  if (blueprint.blueprint_version !== "nuanu.universal-qa-flow.blueprint.v1") throw new TypeError("unsupported blueprint_version");
  if (!Array.isArray(blueprint.binding_tokens) || canonicalJson([...blueprint.binding_tokens].sort()) !== canonicalJson([...EXPECTED_TOKENS].sort())) {
    throw new TypeError("blueprint binding_tokens do not match the renderer contract");
  }
  if (!blueprint.graph || blueprint.graph.schema_version !== 1 || !Array.isArray(blueprint.graph.nodes) || !Array.isArray(blueprint.graph.edges)) {
    throw new TypeError("blueprint graph must be Process graph v1");
  }
}

function validateRenderedGraph(graph) {
  if (TOKEN.test(canonicalJson(graph))) throw new TypeError("unresolved binding token remains after rendering");
  TOKEN.lastIndex = 0;
  const allIds = [];
  const nodeIds = new Set();
  const nodeKeys = new Set();
  for (const node of graph.nodes) {
    uuid(node.id, `node ${node.key ?? "unknown"} id`);
    if (typeof node.key !== "string" || nodeKeys.has(node.key)) throw new TypeError("node keys must be unique strings");
    if (typeof node.name !== "string" || node.name.length === 0 || node.name.length > 40) throw new TypeError(`node ${node.key} must have a concise name`);
    nodeIds.add(node.id);
    nodeKeys.add(node.key);
    allIds.push(node.id);
  }
  for (const edge of graph.edges) {
    uuid(edge.id, "edge id");
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new TypeError("edge endpoint is not a rendered node");
    allIds.push(edge.id);
  }
  if (new Set(allIds).size !== allIds.length) throw new TypeError("node and edge UUIDs must be globally unique");
}

export function renderProcess(blueprint, rawBindings) {
  validateBlueprint(blueprint);
  const bindings = normalizedBindings(rawBindings);
  const graph = replaceTokens(structuredClone(blueprint.graph), tokenValues(bindings));
  validateRenderedGraph(graph);
  return JSON.parse(canonicalJson(graph));
}

export function renderProcessJson(blueprint, bindings) {
  return canonicalJson(renderProcess(blueprint, bindings));
}

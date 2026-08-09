import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderProcess, renderProcessJson } from "../../scripts/qah/render-process.mjs";

const blueprintUrl = new URL("../../processes/universal-qa-flow.graph.json", import.meta.url);
const blueprint = JSON.parse(await readFile(blueprintUrl, "utf8"));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bindings = Object.freeze({
  project_process_binding_id: "11111111-1111-4111-8111-111111111111",
  project_id: "22222222-2222-4222-8222-222222222222",
  ready_for_qa_state_id: "33333333-3333-4333-8333-333333333333",
  in_progress_state_id: "44444444-4444-4444-8444-444444444444",
  ready_for_production_state_id: "55555555-5555-4555-8555-555555555555",
  qa_agent_employee_id: "66666666-6666-4666-8666-666666666666",
  qa_agent_version_id: "77777777-7777-4777-8777-777777777777",
  profile_artifact: {
    artifact_id: "88888888-8888-4888-8888-888888888888",
    version_id: "99999999-9999-4999-8999-999999999999",
    kind: "document",
    role: "implementation",
  },
});

const expectedKeys = [
  "project_start",
  "resolve_flow_item",
  "load_project_context",
  "plan_qa_scope",
  "prepare_environment",
  "parallel_checks_fork",
  "verify_requirements_and_code",
  "verify_api_contracts",
  "verify_ui_with_playwright",
  "prepare_and_verify_domain_data",
  "parallel_checks_join",
  "aggregate_evidence",
  "independent_release_decision",
  "publication_cleanup_fork",
  "publish_flow_item_comment",
  "cleanup_environment",
  "publication_cleanup_join",
  "finalize_transition",
  "transition_route",
  "ready_for_production_end",
  "in_progress_end",
];

function byKey(graph) {
  return new Map(graph.nodes.map((node) => [node.key, node]));
}

function edgePairs(graph) {
  const keyById = new Map(graph.nodes.map((node) => [node.id, node.key]));
  return graph.edges.map((edge) => [keyById.get(edge.source), keyById.get(edge.target), edge.when]);
}

test("renders the exact universal topology with structured parallel blocks", () => {
  const graph = renderProcess(blueprint, bindings);
  assert.equal(graph.schema_version, 1);
  assert.deepEqual(graph.nodes.map((node) => node.key), expectedKeys);
  assert.equal(graph.nodes.length, 21);
  assert.equal(graph.edges.length, 24);

  const nodes = byKey(graph);
  for (const key of ["parallel_checks_fork", "parallel_checks_join", "publication_cleanup_fork", "publication_cleanup_join"])
    assert.equal(nodes.get(key).config.kind, "parallel");
  assert.equal(nodes.get("parallel_checks_join").config.join_timeout, "1800");
  assert.equal(nodes.get("publication_cleanup_join").config.join_timeout, "900");

  const pairs = edgePairs(graph);
  const expectedBranchPairs = [
    ["parallel_checks_fork", "verify_requirements_and_code"],
    ["parallel_checks_fork", "verify_api_contracts"],
    ["parallel_checks_fork", "verify_ui_with_playwright"],
    ["parallel_checks_fork", "prepare_and_verify_domain_data"],
    ["verify_requirements_and_code", "parallel_checks_join"],
    ["verify_api_contracts", "parallel_checks_join"],
    ["verify_ui_with_playwright", "parallel_checks_join"],
    ["prepare_and_verify_domain_data", "parallel_checks_join"],
    ["publication_cleanup_fork", "publish_flow_item_comment"],
    ["publication_cleanup_fork", "cleanup_environment"],
    ["publish_flow_item_comment", "publication_cleanup_join"],
    ["cleanup_environment", "publication_cleanup_join"],
  ];
  for (const [source, target] of expectedBranchPairs)
    assert.ok(pairs.some(([from, to]) => from === source && to === target), `${source} -> ${target}`);
});

test("carries only topology-local immediate inputs through declared ProcessItems", () => {
  const graph = renderProcess(blueprint, bindings);
  const nodes = byKey(graph);
  const instructions = Object.fromEntries(
    graph.nodes.filter((node) => node.type === "agent_task").map((node) => [node.key, node.config.instruction]),
  );
  assert.match(instructions.resolve_flow_item, /input\.project_start\.artifacts\.flow_item/);
  assert.match(instructions.load_project_context, /input\.resolve_flow_item/);
  assert.match(instructions.plan_qa_scope, /input\.load_project_context/);
  assert.match(instructions.prepare_environment, /input\.plan_qa_scope/);
  for (const key of ["verify_requirements_and_code", "verify_api_contracts", "verify_ui_with_playwright", "prepare_and_verify_domain_data"])
    assert.match(instructions[key], /input\.prepare_environment/);
  for (const key of ["publish_flow_item_comment", "cleanup_environment"])
    assert.match(instructions[key], /input\.independent_release_decision/);
  assert.match(instructions.aggregate_evidence, /input\.verify_requirements_and_code/);
  assert.match(instructions.aggregate_evidence, /input\.verify_api_contracts/);
  assert.match(instructions.aggregate_evidence, /input\.verify_ui_with_playwright/);
  assert.match(instructions.aggregate_evidence, /input\.prepare_and_verify_domain_data/);
  assert.match(instructions.finalize_transition, /input\.publish_flow_item_comment/);
  assert.match(instructions.finalize_transition, /input\.cleanup_environment/);

  const serialized = JSON.stringify(graph);
  assert.doesNotMatch(serialized, /input_bindings|\$\{steps|process_context|backward_lookup/);
  assert.equal(nodes.get("parallel_checks_join").config.output, undefined);
  assert.equal(nodes.get("publication_cleanup_join").config.output, undefined);
});

test("uses closed Process v1 outputs and worker 0.3.13 Artifact contracts", () => {
  const graph = renderProcess(blueprint, bindings);
  const agents = graph.nodes.filter((node) => node.type === "agent_task");
  assert.ok(agents.length > 0);
  for (const node of agents) {
    assert.deepEqual(Object.keys(node.config.output).sort(), ["artifacts", "data"]);
    assert.equal(Object.getPrototypeOf(node.config.output.data), Object.prototype);
    assert.equal(Object.getPrototypeOf(node.config.output.artifacts), Object.prototype);
    for (const descriptor of Object.values(node.config.output.data)) {
      assert.ok(["string", "number", "boolean", "json", "choices"].includes(descriptor.type));
      assert.equal(typeof descriptor.description, "string");
      assert.ok(descriptor.description.length > 0);
    }
    for (const descriptor of Object.values(node.config.output.artifacts)) {
      assert.equal(descriptor.kind, "document");
      assert.deepEqual(descriptor.restrictions, { media_types: ["application/json"] });
      assert.equal(typeof descriptor.description, "string");
    }
    assert.match(node.config.instruction, /ровно один JSON-объект/i);
    assert.match(node.config.instruction, /item и artifact_outputs/);
    assert.match(node.config.instruction, /artifact_id, version_id, kind, role/);
    assert.doesNotMatch(node.config.instruction, /artifact_id, version_id, kind, role, name|latest.version/i);
  }

  for (const key of ["verify_requirements_and_code", "verify_api_contracts", "verify_ui_with_playwright", "prepare_and_verify_domain_data"])
    assert.deepEqual(Object.keys(byKey(graph).get(key).config.output.artifacts), ["branch_payload"]);
  assert.deepEqual(Object.keys(byKey(graph).get("independent_release_decision").config.output.artifacts), []);
});

test("binds the immutable Column Start, profile ArtifactVersion, and pinned Agent versions", () => {
  const graph = renderProcess(blueprint, bindings);
  const nodes = byKey(graph);
  assert.deepEqual(nodes.get("project_start").config.project_process_start, {
    binding_id: bindings.project_process_binding_id,
    project_id: bindings.project_id,
    state_id: bindings.ready_for_qa_state_id,
  });
  assert.equal(nodes.get("project_start").trigger.mode, "manual");
  for (const node of graph.nodes.filter((entry) => entry.type === "agent_task")) {
    assert.equal(node.config.agent_employee_id, bindings.qa_agent_employee_id);
    assert.equal(node.config.agent_version_id, bindings.qa_agent_version_id);
  }
  const serialized = JSON.stringify(graph);
  for (const value of Object.values(bindings.profile_artifact)) assert.ok(serialized.includes(value));
  assert.match(nodes.get("load_project_context").config.instruction, /role&quot;|"role":"implementation"/);
});

test("allows an independent strongest Codex decision version without changing other tasks", () => {
  const decisionBindings = {
    ...bindings,
    decision_agent_employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    decision_agent_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  };
  const graph = renderProcess(blueprint, decisionBindings);
  const nodes = byKey(graph);
  assert.equal(nodes.get("independent_release_decision").config.agent_employee_id, decisionBindings.decision_agent_employee_id);
  assert.equal(nodes.get("independent_release_decision").config.agent_version_id, decisionBindings.decision_agent_version_id);
  assert.equal(nodes.get("aggregate_evidence").config.agent_version_id, bindings.qa_agent_version_id);
});

test("routes fail closed through exactly one default XOR edge and changes state only at End", () => {
  const graph = renderProcess(blueprint, bindings);
  const nodes = byKey(graph);
  const route = nodes.get("transition_route");
  assert.deepEqual(route.config, { kind: "exclusive", mode: "simple" });
  const outgoing = graph.edges.filter((edge) => edge.source === route.id);
  assert.equal(outgoing.length, 2);
  assert.equal(outgoing.filter((edge) => edge.when?.otherwise === true).length, 1);
  assert.deepEqual(outgoing.find((edge) => !edge.when?.otherwise).when, {
    var: "finalize_transition.data.target_state",
    op: "eq",
    value: "ready_for_production",
  });
  assert.equal(nodes.get("finalize_transition").config.failure_handling.mode, "stop");
  assert.match(nodes.get("finalize_transition").config.instruction, /transition_allowed.*false.*ошибк/si);

  const statusNodes = graph.nodes.filter((node) => node.config?.project_status);
  assert.deepEqual(statusNodes.map((node) => node.key), ["ready_for_production_end", "in_progress_end"]);
  assert.equal(statusNodes[0].config.project_status.target_state_id, bindings.ready_for_production_state_id);
  assert.equal(statusNodes[1].config.project_status.target_state_id, bindings.in_progress_state_id);
});

test("places verified comment and cleanup before either End", () => {
  const graph = renderProcess(blueprint, bindings);
  const pairs = edgePairs(graph);
  const incoming = new Map(expectedKeys.map((key) => [key, []]));
  for (const [source, target] of pairs) incoming.get(target).push(source);
  assert.deepEqual(incoming.get("publication_cleanup_join"), ["publish_flow_item_comment", "cleanup_environment"]);
  assert.deepEqual(incoming.get("finalize_transition"), ["publication_cleanup_join"]);
  assert.deepEqual(incoming.get("transition_route"), ["finalize_transition"]);
  assert.deepEqual(incoming.get("ready_for_production_end"), ["transition_route"]);
  assert.deepEqual(incoming.get("in_progress_end"), ["transition_route"]);
});

test("blueprint is universal and contains no product, host, path, model, or installation literals", () => {
  const raw = JSON.stringify(blueprint);
  assert.doesNotMatch(raw, /PayDemo|paydemo|Grok|grok|\/Users\/|\/private\/tmp\/|https?:\/\/(?!example\.invalid)|127\.0\.0\.1|localhost|906cbb3d|20b71a86|1eb21488|ba38ce41|c312fa9e/);
  assert.doesNotMatch(raw, /checkout|payment-method|real-money|scripts\/qah\/adapters\//i);
  for (const node of blueprint.graph.nodes) {
    assert.match(node.id, UUID);
    assert.equal(typeof node.name, "string");
    assert.ok(node.name.length > 0 && node.name.length <= 40);
  }
});

test("renderer is canonical, immutable, and rejects invalid or unresolved bindings", () => {
  const first = renderProcessJson(blueprint, bindings);
  const second = renderProcessJson(blueprint, structuredClone(bindings));
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), renderProcess(blueprint, bindings));
  assert.doesNotMatch(first, /__BINDING_[A-Z0-9_]+__/);

  const rendered = JSON.parse(first);
  const ids = [...rendered.nodes.map((node) => node.id), ...rendered.edges.map((edge) => edge.id)];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, UUID);
  assert.equal(JSON.stringify(blueprint).includes(bindings.project_id), false);

  assert.throws(() => renderProcess(blueprint, { ...bindings, in_progress_state_id: bindings.ready_for_qa_state_id }), /state UUIDs must be distinct/);
  assert.throws(() => renderProcess(blueprint, { ...bindings, project_id: "not-a-uuid" }), /project_id must be a UUID/);
  assert.throws(() => renderProcess(blueprint, { ...bindings, profile_artifact: { ...bindings.profile_artifact, role: "output" } }), /profile_artifact/);
  assert.throws(() => renderProcess(blueprint, { ...bindings, decision_agent_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), /decision agent bindings must be supplied together/);
  assert.throws(() => renderProcess({ ...blueprint, graph: { ...blueprint.graph, name: "__BINDING_UNKNOWN__" } }, bindings), /unresolved binding token/);
});

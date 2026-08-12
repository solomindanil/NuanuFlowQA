#!/usr/bin/env node

import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { canonicalJson, sha256 } from "./canonical.mjs";
import { createSyntheticGraphPlan } from "./graph-plan.mjs";
import { FULL_QAH_FINALIZATION_OUTPUT_DEFINITION, runLocalQaHarness } from "./local-harness.mjs";
import { createOfflineHarnessExecutor, runOfflineGraphQaFlow } from "./offline-graph-flow.mjs";
import { loadWorkerCompletionValidator } from "./worker-contract.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TICKET = /^[A-Z][A-Z0-9]{1,15}-[1-9][0-9]{0,9}$/;
const PROJECT = /^[a-z][a-z0-9-]{0,63}$/;
const SOURCE_MEDIA_TYPE = "application/vnd.nuanu.flow-item+json";
const INPUT_LIMIT = 64 * 1024;
const STATE_NAME = ".ui-graph-state.json";
const VERIFICATION_NAME = "qah-verification.json";
const FINALIZATION_NAME = "finalization.json";
const REF_KEYS = Object.freeze(["artifact_id", "version_id", "kind", "role"]);
const SNAPSHOT_KEYS = Object.freeze(["issue_id", "identifier", "title", "description", "project_key", "state_name", "labels", "updated_at"]);

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exact(value, keys, label) {
  if (!object(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new Error(`${label} must contain exact keys`);
  }
  return value;
}

function boundedString(value, maximum, label, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || value.length > maximum || /[\0\r]/u.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function artifactRef(value, kind, role, label) {
  exact(value, REF_KEYS, label);
  if (!UUID.test(value.artifact_id) || !UUID.test(value.version_id) || value.kind !== kind || value.role !== role) {
    throw new Error(`${label} is not an exact immutable reference`);
  }
  return structuredClone(value);
}

function timestamp(value, label) {
  if (typeof value !== "string" || new Date(value).toISOString() !== value) throw new Error(`${label} is invalid`);
  return value;
}

function validateSnapshot(value) {
  exact(value, SNAPSHOT_KEYS, "source_snapshot");
  if (!UUID.test(value.issue_id) || !TICKET.test(value.identifier) || !PROJECT.test(value.project_key)) throw new Error("source snapshot identity is invalid");
  boundedString(value.title, 500, "source title");
  boundedString(value.description, 20_000, "source description", true);
  if (value.state_name !== "Ready for QA") throw new Error("source snapshot must be in Ready for QA");
  if (!Array.isArray(value.labels) || value.labels.length > 16 || new Set(value.labels).size !== value.labels.length) throw new Error("source labels are invalid");
  for (const label of value.labels) boundedString(label, 100, "source label");
  timestamp(value.updated_at, "source updated_at");
  return structuredClone(value);
}

function knowledgeText(snapshot) {
  return [snapshot.title, snapshot.description, ...snapshot.labels].join(" ").normalize("NFKC").toLocaleLowerCase("en-US");
}

export function deriveUiGraphCanaryScenario(snapshotValue) {
  const snapshot = validateSnapshot(snapshotValue);
  const text = knowledgeText(snapshot);
  if (/\[qah:product-failure\]|qah-product-failure/u.test(text)) {
    return { scenario: "product-failure", change_hints: ["profile-api"], matched_knowledge_rules: ["confirmed-product-failure"] };
  }
  const payment = /(payment|payments|card|checkout|transfer|balance|commission|money|оплат|плат[её]ж|карт|перевод|баланс|комисси)/u.test(text);
  const business = /(business|billing|payout|refund|subscription|critical|бизнес|возврат|подписк)/u.test(text);
  const matched = [];
  if (business) matched.push("business-function");
  if (payment) matched.push("payment");
  if (payment || business) return { scenario: "critical", change_hints: ["payment-checkout"], matched_knowledge_rules: matched };
  return { scenario: "noncritical", change_hints: ["profile-api", "profile-ui"], matched_knowledge_rules: [] };
}

function validatePrepareInput(input) {
  exact(input, ["phase", "source_ref", "source_name", "source_media_type", "source_snapshot"], "prepare input");
  if (input.phase !== "prepare" || input.source_media_type !== SOURCE_MEDIA_TYPE) throw new Error("prepare input media or phase is invalid");
  const sourceRef = artifactRef(input.source_ref, "flow_item", "source", "source_ref");
  const snapshot = validateSnapshot(input.source_snapshot);
  if (input.source_name !== `${snapshot.identifier} · ${snapshot.title}`) throw new Error("source name and Flow snapshot disagree");
  return { sourceRef, snapshot };
}

function ticketEvent(snapshot, scenario) {
  const revision = sha256(snapshot);
  return {
    schema_version: "nuanu.qa-column-ticket-event.v1",
    event_id: `event-${snapshot.identifier.toLowerCase()}-${revision.slice(7, 19)}`,
    ticket_id: snapshot.identifier,
    project_key: snapshot.project_key,
    from_state: "in_progress",
    to_state: "ready_for_qa",
    candidate: {
      candidate_id: `flow-item-${snapshot.issue_id}`,
      candidate_revision: revision,
      environment_id: `ui-demo-${snapshot.project_key}`,
      change_hints: scenario.change_hints,
    },
    triggered_at: snapshot.updated_at,
  };
}

async function secureOutputDirectory(taskRoot, requested) {
  if (typeof taskRoot !== "string" || !isAbsolute(taskRoot)) throw new Error("NUANU_TASK_DIR must be absolute");
  const root = await realpath(taskRoot);
  const requestedRoot = resolve(taskRoot);
  const requestedOutput = resolve(requested);
  const child = relative(requestedRoot, requestedOutput);
  if (!child || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("output directory escapes NUANU_TASK_DIR");
  const output = resolve(root, child);
  let cursor = root;
  for (const segment of child.split(sep)) {
    cursor = join(cursor, segment);
    const metadata = await lstat(cursor).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (metadata === null) await mkdir(cursor, { mode: 0o700 });
    else if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("output path must contain real directories");
  }
  if (await realpath(output) !== output) throw new Error("output directory must resolve exactly");
  return output;
}

async function writeCanonical(directory, name, value, replace = false) {
  const source = canonicalJson(value);
  const target = join(directory, name);
  if (!replace) await writeFile(target, source, { mode: 0o600, flag: "wx" });
  else {
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${name} must remain a real file`);
    const temporary = join(directory, `.${name}.next`);
    await writeFile(temporary, source, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
  }
  return { size_bytes: Buffer.byteLength(source), sha256: sha256(source) };
}

async function readCanonical(directory, name) {
  const target = join(directory, name);
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > INPUT_LIMIT) throw new Error(`${name} is invalid`);
  const source = await readFile(target, "utf8");
  const value = JSON.parse(source);
  if (source !== canonicalJson(value)) throw new Error(`${name} must be canonical JSON`);
  return value;
}

function manifest(phase, slot, name, file) {
  return {
    schema_version: "nuanu.qah-ui-graph-canary-phase.v1",
    phase,
    files: [{ slot, name, kind: "document", role: "output", media_type: "application/json", ...file }],
  };
}

async function defaultExecute(event, graphPlan, scenario) {
  const { buildCanonicalCompletion } = await loadWorkerCompletionValidator();
  const executeAssignment = createOfflineHarnessExecutor({
    runHarness: runLocalQaHarness,
    buildCanonicalCompletion,
    finalizationOutputDefinition: structuredClone(FULL_QAH_FINALIZATION_OUTPUT_DEFINITION),
    mode: scenario === "product-failure" ? "product-failure" : "pass",
  });
  return runOfflineGraphQaFlow({ event, graphPlan, executeAssignment });
}

async function prepare(input, context) {
  const { sourceRef, snapshot } = validatePrepareInput(input);
  const classification = deriveUiGraphCanaryScenario(snapshot);
  const event = ticketEvent(snapshot, classification);
  const graphPlan = createSyntheticGraphPlan(event, classification.scenario);
  const receipt = await context.execute(event, graphPlan, classification.scenario);
  if (!receipt?.proof_gate_claim || !["READY_FOR_PRODUCTION", "HUMAN_REVIEW", "RETURN_TO_WORK"].includes(receipt.route)) {
    throw new Error(`graph QAH did not produce an admissible claim: ${receipt?.reason_codes?.join(",") ?? "unknown"}`);
  }
  const verification = {
    schema_version: "nuanu.qah-ui-graph-verification.v1",
    source_ref: sourceRef,
    source_snapshot: snapshot,
    source_snapshot_digest: sha256(snapshot),
    graph_scenario: classification.scenario,
    matched_knowledge_rules: classification.matched_knowledge_rules,
    event,
    graph_plan: graphPlan,
    receipt,
  };
  const file = await writeCanonical(context.outputDir, VERIFICATION_NAME, verification);
  await writeCanonical(context.outputDir, STATE_NAME, {
    schema_version: "nuanu.qah-ui-graph-state.v1",
    stage: "prepared",
    verification,
    verification_file_sha256: file.sha256,
    verification_ref: null,
    finalization_file_sha256: null,
  });
  return manifest("prepared", "qah_verification", VERIFICATION_NAME, file);
}

async function finalize(input, context) {
  exact(input, ["phase", "artifact_refs"], "finalize input");
  if (input.phase !== "finalize") throw new Error("finalize phase is invalid");
  exact(input.artifact_refs, ["qah_verification"], "finalize artifact_refs");
  const verificationRef = artifactRef(input.artifact_refs.qah_verification, "document", "output", "qah_verification ref");
  const state = await readCanonical(context.outputDir, STATE_NAME);
  if (state.schema_version !== "nuanu.qah-ui-graph-state.v1" || state.stage !== "prepared") throw new Error("prepared state is required");
  const verification = await readCanonical(context.outputDir, VERIFICATION_NAME);
  if (sha256(canonicalJson(verification)) !== state.verification_file_sha256 || canonicalJson(verification) !== canonicalJson(state.verification)) {
    throw new Error("verification evidence changed after prepare");
  }
  const claim = structuredClone(verification.receipt.proof_gate_claim);
  const report = {
    schema_version: "nuanu.qah-ui-graph-finalization.v1",
    route: verification.receipt.route,
    proof_gate_outcome: verification.receipt.proof_gate_outcome,
    reason_codes: verification.receipt.reason_codes,
    graph_plan_digest: verification.receipt.graph_plan_digest,
    receipt_digest: verification.receipt.receipt_digest,
    verification_ref: verificationRef,
    claim,
  };
  const file = await writeCanonical(context.outputDir, FINALIZATION_NAME, report);
  await writeCanonical(context.outputDir, STATE_NAME, {
    ...state,
    stage: "finalized",
    verification_ref: verificationRef,
    finalization_file_sha256: file.sha256,
  }, true);
  return manifest("finalization_prepared", "finalization_report", FINALIZATION_NAME, file);
}

async function complete(input, context) {
  exact(input, ["phase", "artifact_refs"], "complete input");
  if (input.phase !== "complete") throw new Error("complete phase is invalid");
  exact(input.artifact_refs, ["qah_verification", "finalization_report"], "complete artifact_refs");
  const verificationRef = artifactRef(input.artifact_refs.qah_verification, "document", "output", "qah_verification ref");
  const finalizationRef = artifactRef(input.artifact_refs.finalization_report, "document", "output", "finalization_report ref");
  const state = await readCanonical(context.outputDir, STATE_NAME);
  if (state.schema_version !== "nuanu.qah-ui-graph-state.v1" || state.stage !== "finalized"
    || canonicalJson(state.verification_ref) !== canonicalJson(verificationRef)) throw new Error("finalized state is required");
  const report = await readCanonical(context.outputDir, FINALIZATION_NAME);
  if (sha256(canonicalJson(report)) !== state.finalization_file_sha256) throw new Error("finalization evidence changed after publish");
  return {
    item: {
      key: "finalize_transition",
      description: report.route === "READY_FOR_PRODUCTION" ? "Graph-bound QAH proposes production" : report.route === "RETURN_TO_WORK" ? "Graph-bound QAH returns ticket to work" : "Graph-bound QAH requires human review",
      data: report.claim,
      artifacts: {},
    },
    artifact_outputs: {
      "item.artifacts.qah_verification": verificationRef,
      "item.artifacts.finalization_report": finalizationRef,
    },
  };
}

export async function runUiGraphCanaryPhase(phase, input, options = {}) {
  if (!["prepare", "finalize", "complete"].includes(phase)) throw new Error("unknown UI graph canary phase");
  const taskRoot = options.taskRoot ?? process.env.NUANU_TASK_DIR;
  const outputDir = await secureOutputDirectory(taskRoot, options.outputDir ?? join(taskRoot, "qah", "ui-graph-canary"));
  if (phase === "prepare" && (await readdir(outputDir)).length !== 0) throw new Error("prepare output directory must be empty");
  const context = { outputDir, execute: options.execute ?? defaultExecute };
  if (phase === "prepare") return prepare(input, context);
  if (phase === "finalize") return finalize(input, context);
  return complete(input, context);
}

async function readInput(path, taskRoot) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("--input must be an absolute task-local path");
  const root = await realpath(taskRoot);
  const target = await realpath(path);
  const child = relative(root, target);
  if (!child || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("input path escapes NUANU_TASK_DIR");
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > INPUT_LIMIT) throw new Error("input must be a bounded real file");
  const source = await readFile(target, "utf8");
  const value = JSON.parse(source);
  if (source !== canonicalJson(value)) throw new Error("input must be canonical JSON without a trailing newline");
  return value;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 5 || !["prepare", "finalize", "complete"].includes(argv[0]) || argv[1] !== "--input" || argv[3] !== "--output-dir") {
    throw new Error("usage: ui-graph-canary.mjs <prepare|finalize|complete> --input <absolute-task-file> --output-dir <absolute-task-dir>");
  }
  const taskRoot = process.env.NUANU_TASK_DIR;
  const input = await readInput(argv[2], taskRoot);
  process.stdout.write(canonicalJson(await runUiGraphCanaryPhase(argv[0], input, { taskRoot, outputDir: argv[4] })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 2; });
}

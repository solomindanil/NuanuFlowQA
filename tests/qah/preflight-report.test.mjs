import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson } from "../../scripts/qah/canonical.mjs";
import { createPreflightReport, main } from "../../scripts/qah/preflight-report.mjs";

const payload = Object.freeze({
  bindings: { project_process_binding_id: "11111111-1111-4111-8111-111111111111" },
  graph_hash: `sha256:${"a".repeat(64)}`,
  definition_etag: `sha256:${"b".repeat(64)}`,
  profile_digest: `sha256:${"c".repeat(64)}`,
  policy_digest: `sha256:${"d".repeat(64)}`,
  test_mode: false,
  install_ready: false,
  unmet_preconditions: ["public worker observability unavailable"],
});

test("preflight report consumes in-process authority and emits only sanitized canonical fields", async () => {
  const report = await createPreflightReport({ exact: "request" }, {
    environment: { NUANU_API_KEY: "must-not-leak", NUANU_QA_AGENT_KEY: "must-not-leak", NUANU_DECISION_AGENT_KEY: "must-not-leak" },
    runAndConsume: async (request) => { assert.deepEqual(request, { exact: "request" }); return structuredClone(payload); },
  });
  assert.deepEqual(report, { schema_version: "nuanu.qah-preflight-report.v1", ...payload });
  assert.doesNotMatch(canonicalJson(report), /must-not-leak|NUANU_.*KEY/);
});

test("CLI accepts one bounded absolute canonical request and writes canonical JSON only", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-preflight-report-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "request.json");
  await writeFile(path, canonicalJson({ exact: "request" }));
  let stdout = "";
  await main(["--request", path], {
    environment: {},
    runAndConsume: async () => structuredClone(payload),
    write: (value) => { stdout += value; },
  });
  assert.equal(stdout, canonicalJson({ schema_version: "nuanu.qah-preflight-report.v1", ...payload }));
  await writeFile(path, `${canonicalJson({ exact: "request" })}\n`);
  await assert.rejects(main(["--request", path], { runAndConsume: async () => payload, write() {} }), /canonical/);
  assert.equal((await readFile(path)).byteLength > 0, true);
});

test("CLI rejects every argv path and byte-custody violation", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qah-preflight-negative-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "request.json");
  const link = join(root, "request-link.json");
  const tiny = join(root, "tiny.json");
  const huge = join(root, "huge.json");
  await writeFile(target, canonicalJson({ exact: "request" }));
  await symlink(target, link);
  await writeFile(tiny, "{");
  await writeFile(huge, Buffer.alloc(262_145, 0x20));
  const dependencies = {
    environment: {},
    runAndConsume: async () => structuredClone(payload),
    write() {},
  };
  for (const [name, argv] of [
    ["missing argv", []],
    ["missing path", ["--request"]],
    ["unknown flag", ["--unknown", target]],
    ["extra argv", ["--request", target, "extra"]],
    ["relative path", ["--request", "request.json"]],
    ["directory path", ["--request", root]],
    ["symlink path", ["--request", link]],
    ["too few bytes", ["--request", tiny]],
    ["too many bytes", ["--request", huge]],
  ]) await t.test(name, async () => {
    await assert.rejects(main(argv, dependencies));
  });
});

test("report rejects closed-shape coercion hostile values and secret reflection", async (t) => {
  const missing = structuredClone(payload); delete missing.graph_hash;
  const cyclic = {}; cyclic.self = cyclic;
  const proxy = new Proxy({}, { ownKeys() { throw new Error("hostile"); } });
  const cases = [
    ["extra consumed field", { result: { ...payload, extra: true }, environment: {} }],
    ["missing consumed field", { result: missing, environment: {} }],
    ["cycle", { result: cyclic, environment: {} }],
    ["Proxy", { result: proxy, environment: {} }],
    ["install_ready string coercion", { result: { ...payload, install_ready: "false" }, environment: {} }],
    ["test mode in production", { result: { ...payload, test_mode: true }, environment: { NUANU_QAH_PREFLIGHT_TEST_MODE: "1" } }],
    ["secret reflected in output", {
      result: { ...payload, unmet_preconditions: ["must-not-leak"] },
      environment: { NUANU_API_KEY: "must-not-leak" },
    }],
  ];
  for (const [name, { result, environment }] of cases) await t.test(name, async () => {
    await assert.rejects(createPreflightReport({ exact: "request" }, {
      environment,
      runAndConsume: async () => result,
    }));
  });
});

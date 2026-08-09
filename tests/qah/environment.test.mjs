import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareEnvironment, cleanupEnvironment, targetNamespace } from "../../scripts/qah/environment.mjs";

const runId = "run-docs-1";
const attemptId = "attempt-1";
const environmentId = "docs-none";
const origin = "https://example.test/docs.git";
const commit = "a".repeat(40);
const otherCommit = "b".repeat(40);
const noneProfile = {
  project_key: "docs",
  repository: { allowed_origin: origin },
  environment: { strategy: "none" },
};

function managedProfile(overrides = {}) {
  return {
    project_key: "generic-product",
    repository: { allowed_origin: origin },
    environment: {
      strategy: "managed_command",
      prepare_command: ["node", "server.mjs"],
      cleanup_command: ["node", "cleanup.mjs"],
      health_path: "/identity",
      ...overrides,
    },
    execution: { timeout_ms: 100, max_output_bytes: 4096 },
  };
}

async function createHarness(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "qah-generic-environment-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = { exec: [], spawn: [], signals: [] };
  const processes = new Map();
  let nextPid = 41000;
  let requestedCommit = commit;
  let checkoutStatus = options.checkoutStatus ?? "";
  let healthMode = options.healthMode ?? "ok";

  const dependencies = {
    async execFile(commandName, args) {
      calls.exec.push([commandName, [...args]]);
      if (commandName === "git" && args.includes("clone")) {
        await mkdir(args.at(-1), { recursive: true });
        return { stdout: "", stderr: "" };
      }
      if (commandName === "git" && args.includes("rev-parse")) return { stdout: `${requestedCommit}\n`, stderr: "" };
      if (commandName === "git" && args.includes("status")) return { stdout: checkoutStatus, stderr: "" };
      if (commandName === "ps") {
        const pid = Number(args[1]);
        return { stdout: `${processes.get(pid)?.command ?? "foreign-daemon --unrelated"}\n`, stderr: "" };
      }
      return { stdout: "", stderr: "" };
    },
    spawn(commandName, args, spawnOptions) {
      const child = new EventEmitter();
      child.pid = nextPid++;
      child.unref = () => {};
      const command = [commandName, ...args].join(" ");
      processes.set(child.pid, { alive: true, command, spawnOptions });
      calls.spawn.push({ command: commandName, args: [...args], options: spawnOptions, pid: child.pid });
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
    processKill(pid, signal = "SIGTERM") {
      const process = processes.get(pid);
      calls.signals.push([pid, signal]);
      if (!process?.alive) {
        const error = new Error("gone");
        error.code = "ESRCH";
        throw error;
      }
      if (signal === "SIGTERM") process.alive = false;
    },
    async fetch(_url, fetchOptions) {
      if (healthMode === "timeout") throw Object.assign(new Error("timed out"), { name: "AbortError" });
      const spawnCall = calls.spawn.at(-1);
      const identityArg = (name) => decodeURIComponent(spawnCall.args.find((arg) => arg.startsWith(`${name}=`)).slice(name.length + 1));
      const identity = {
        repository_origin: identityArg("--qah-repository-origin"),
        commit: identityArg("--qah-commit"),
        content_hash: "sha256:" + "c".repeat(64),
        environment_id: identityArg("--qah-environment-id"),
        instance_nonce: identityArg("--qah-instance-nonce"),
      };
      if (healthMode === "wrong-nonce") identity.instance_nonce = "00000000-0000-4000-8000-000000000000";
      if (healthMode === "redirect") {
        return new Response("", { status: 302, headers: { location: "https://attacker.invalid/identity" } });
      }
      assert.equal(fetchOptions.redirect, "error");
      return new Response(JSON.stringify(identity), { headers: { "content-type": "application/json" } });
    },
  };

  const managed = {
    adapter_id: "generic-fixture-v1",
    configuration: { release: "fixture" },
    async prepareCheckout({ checkout }) {
      const executable = join(checkout, "server.mjs");
      await writeFile(executable, "// fixture executable\n");
      return {
        command: [process.execPath, executable],
        base_url: "http://127.0.0.1:43199",
        content_hash: "sha256:" + "c".repeat(64),
        environment: {},
      };
    },
  };

  function input(overrides = {}) {
    requestedCommit = overrides.commit ?? commit;
    return {
      profile: managedProfile(),
      repositoryOrigin: origin,
      commit,
      runId: "run-1",
      attemptId: "attempt-1",
      environmentId: "generic-env",
      stateRoot: join(root, "state"),
      dependencies,
      managed,
      ...overrides,
    };
  }

  return {
    root,
    calls,
    processes,
    dependencies,
    managed,
    input,
    setCheckoutStatus(value) { checkoutStatus = value; },
    setHealthMode(value) { healthMode = value; },
  };
}

test("docs profile returns NOT_REQUIRED without spawning product", async () => {
  let spawnCalls = 0;
  const receipt = await prepareEnvironment({
    profile: noneProfile,
    repositoryOrigin: origin,
    commit,
    runId,
    attemptId,
    environmentId,
    dependencies: { spawn() { spawnCalls += 1; } },
  });

  assert.equal(receipt.environment_status, "NOT_REQUIRED");
  assert.equal(spawnCalls, 0);
});

test("managed environment clones an exact HTTPS commit with redirects disabled and persists the full attempt fence", async (t) => {
  const harness = await createHarness(t);
  const receipt = await prepareEnvironment(harness.input());

  assert.equal(receipt.environment_status, "READY");
  const clone = harness.calls.exec.find(([commandName, args]) => commandName === "git" && args.includes("clone"));
  assert.deepEqual(clone[1].slice(0, 3), ["-c", "http.followRedirects=false", "clone"]);
  assert.equal(clone[1].includes(origin), true);
  const fetch = harness.calls.exec.find(([, args]) => args.includes("fetch"));
  assert.equal(fetch[1].includes(commit), true);
  assert.equal(fetch[1].includes("--depth=1"), true);

  const state = JSON.parse(await readFile(receipt.state_file, "utf8"));
  assert.deepEqual(state.fence, { run_id: "run-1", attempt_id: "attempt-1", environment_id: "generic-env" });
  assert.equal(state.repository_origin, origin);
  assert.equal(state.state_root, join(harness.root, "state"));
  assert.match(receipt.target_namespace, /^[a-f0-9]{64}$/);
});

test("dirty exact checkout returns INFRA_FAILURE before product spawn", async (t) => {
  const harness = await createHarness(t, { checkoutStatus: "?? rogue.js\n" });
  const receipt = await prepareEnvironment(harness.input());
  assert.equal(receipt.environment_status, "INFRA_FAILURE");
  assert.match(receipt.reason, /clean|untracked/i);
  assert.equal(harness.calls.spawn.length, 0);
});

test("same request body is idempotent while a different body conflicts within the same attempt fence", async (t) => {
  const harness = await createHarness(t);
  const first = await prepareEnvironment(harness.input());
  const replay = await prepareEnvironment(harness.input());
  assert.deepEqual(replay, first);
  assert.equal(harness.calls.spawn.length, 1);

  const conflict = await prepareEnvironment(harness.input({ commit: otherCommit }));
  assert.equal(conflict.environment_status, "INFRA_FAILURE");
  assert.match(conflict.reason, /different request body|conflict/i);
  assert.equal(harness.calls.spawn.length, 1);
});

test("attempt_id participates in the canonical target namespace", async () => {
  assert.notEqual(
    targetNamespace({ runId: "run-1", attemptId: "attempt-1", environmentId: "same" }),
    targetNamespace({ runId: "run-1", attemptId: "attempt-2", environmentId: "same" }),
  );
});

test("repository origin mismatch is rejected before Git or spawn", async (t) => {
  const harness = await createHarness(t);
  const receipt = await prepareEnvironment(harness.input({ repositoryOrigin: "https://example.test/other.git" }));
  assert.equal(receipt.environment_status, "INFRA_FAILURE");
  assert.match(receipt.reason, /origin/i);
  assert.equal(harness.calls.exec.length, 0);
  assert.equal(harness.calls.spawn.length, 0);
});

test("health redirects and timeouts fail closed and stop only the provably owned process", async (t) => {
  for (const mode of ["redirect", "timeout"]) {
    const harness = await createHarness(t, { healthMode: mode });
    const receipt = await prepareEnvironment(harness.input({ attemptId: `attempt-${mode}` }));
    assert.equal(receipt.environment_status, "INFRA_FAILURE");
    assert.match(receipt.reason, mode === "redirect" ? /redirect/i : /timed out|timeout/i);
    assert.equal(harness.calls.signals.some(([, signal]) => signal === "SIGTERM"), true);
  }
});

test("instance nonce mismatch fails identity verification and stops the owned process", async (t) => {
  const harness = await createHarness(t, { healthMode: "wrong-nonce" });
  const receipt = await prepareEnvironment(harness.input());
  assert.equal(receipt.environment_status, "INFRA_FAILURE");
  assert.match(receipt.reason, /identity|nonce/i);
  assert.equal(harness.calls.signals.some(([, signal]) => signal === "SIGTERM"), true);
});

test("cleanup quarantines state for a foreign PID and never signals it", async (t) => {
  const harness = await createHarness(t);
  const ready = await prepareEnvironment(harness.input());
  const state = JSON.parse(await readFile(ready.state_file, "utf8"));
  harness.processes.get(state.pid).command = "foreign-daemon --unrelated";
  harness.calls.signals.length = 0;

  const receipt = await cleanupEnvironment(harness.input());
  assert.equal(receipt.environment_status, "RECOVERY_REQUIRED");
  assert.equal(harness.calls.signals.some(([, signal]) => signal === "SIGTERM"), false);
  await assert.rejects(access(ready.state_file));
  assert.match(receipt.quarantine_path, /\.quarantine-/);
});

test("cleanup after interrupted prepare quarantines uncertain state without blind kill", async (t) => {
  const harness = await createHarness(t);
  const namespace = targetNamespace({ runId: "run-1", attemptId: "attempt-1", environmentId: "generic-env" });
  const interrupted = join(harness.root, "state", namespace);
  await mkdir(interrupted, { recursive: true });
  await writeFile(join(interrupted, "server.pid"), "1\n");

  const receipt = await cleanupEnvironment(harness.input());
  assert.equal(receipt.environment_status, "RECOVERY_REQUIRED");
  assert.equal(harness.calls.signals.length, 0);
  assert.match(receipt.quarantine_path, /\.quarantine-/);
  const entries = await readdir(join(harness.root, "state"));
  assert.equal(entries.some((entry) => entry.startsWith(`${namespace}.quarantine-`)), true);
});

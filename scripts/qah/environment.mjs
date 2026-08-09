import { execFile as execFileCallback, spawn as spawnChild } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "./canonical.mjs";

const execFile = promisify(execFileCallback);
const STATE_SCHEMA = "qah.generic-environment-state.v1";
const DEFAULT_STATE_ROOT = join(tmpdir(), "nuanu-qah-environments");
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024;
const IDENTITY_KEYS = ["commit", "content_hash", "environment_id", "instance_nonce", "repository_origin"];
const CHILD_ENV_ALLOWLIST = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT"];
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENVIRONMENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class HealthProtocolError extends Error {}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function dependencies(input) {
  return {
    execFile,
    spawn: spawnChild,
    processKill: process.kill.bind(process),
    fetch: globalThis.fetch,
    randomUUID,
    now: Date.now,
    sleep: (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
    ...input.dependencies,
  };
}

function requireId(value, label, pattern = ID_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function requireCommit(value) {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) throw new Error("commit must be an exact lowercase 40-character Git SHA");
  return value;
}

function normalizeHttpsOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("repository origin must be an exact HTTPS URL"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash || !url.pathname.endsWith(".git") || url.pathname.includes("//")) {
    throw new Error("repository origin must be an exact credential-free HTTPS .git URL");
  }
  return url.href;
}

async function normalizeOrigin(value, input) {
  if (input.allowFileRepository === true) {
    let url;
    try { url = new URL(value); } catch { return normalizeHttpsOrigin(value); }
    if (url.protocol === "file:") {
      if (url.hostname && url.hostname !== "localhost") throw new Error("file repository must be local");
      const path = await realpath(fileURLToPath(url));
      if (!(await stat(path)).isDirectory()) throw new Error("file repository must resolve to a directory");
      return pathToFileURL(path).href;
    }
  }
  return normalizeHttpsOrigin(value);
}

function stateRoot(value) {
  const root = resolve(value ?? DEFAULT_STATE_ROOT);
  if (root === resolve(sep)) throw new Error("state root cannot be the filesystem root");
  return root;
}

function fenceFrom(input) {
  return {
    run_id: requireId(input.runId, "run_id"),
    attempt_id: requireId(input.attemptId, "attempt_id"),
    environment_id: requireId(input.environmentId, "environment_id", ENVIRONMENT_ID_PATTERN),
  };
}

export function targetNamespace(input) {
  const fence = fenceFrom(input);
  return sha256(canonicalJson(fence)).slice("sha256:".length);
}

function pathsFor(root, namespace) {
  const environmentDirectory = resolve(root, namespace);
  if (!environmentDirectory.startsWith(`${root}${sep}`)) throw new Error("environment path escapes state root");
  return {
    environmentDirectory,
    checkout: join(environmentDirectory, "checkout"),
    stateFile: join(environmentDirectory, "environment.json"),
    pidFile: join(environmentDirectory, "server.pid"),
    lockDirectory: `${environmentDirectory}.lock`,
  };
}

async function exists(path) {
  try { await access(path); return true; } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeAtomic(path, contents, deps) {
  const temporary = `${path}.${process.pid}.${deps.randomUUID()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

async function withLock(paths, operation) {
  try { await mkdir(paths.lockDirectory); } catch (error) {
    if (error?.code === "EEXIST") throw new Error("environment attempt is already being modified");
    throw error;
  }
  try { return await operation(); } finally { await rm(paths.lockDirectory, { recursive: true, force: true }); }
}

function commandResult(result) {
  if (typeof result === "string") return result;
  return result?.stdout ?? "";
}

async function runChecked(deps, command, args, options = {}) {
  try {
    const result = await deps.execFile(command, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      maxBuffer: options.maxOutputBytes ?? 8 * 1024 * 1024,
    });
    return commandResult(result).trim();
  } catch (error) {
    const detail = String(error?.stderr ?? errorMessage(error)).trim();
    throw new Error(`${options.label ?? command} failed${detail ? `: ${detail}` : ""}`);
  }
}

async function cloneExactCommit({ deps, repositoryOrigin, commit, checkout, maxOutputBytes }) {
  await runChecked(deps, "git", ["-c", "http.followRedirects=false", "clone", "--quiet", "--no-checkout", "--filter=blob:none", "--", repositoryOrigin, checkout], { label: "Git clone", maxOutputBytes });
  await runChecked(deps, "git", ["-c", "http.followRedirects=false", "-C", checkout, "fetch", "--quiet", "--no-tags", "--depth=1", "origin", commit], { label: "exact commit fetch", maxOutputBytes });
  await runChecked(deps, "git", ["-C", checkout, "checkout", "--quiet", "--detach", commit], { label: "detached checkout", maxOutputBytes });
  await verifyCheckout({ deps, checkout, commit, maxOutputBytes });
}

async function verifyCheckout({ deps, checkout, commit, maxOutputBytes, allowedGeneratedEntries = [] }) {
  const actualCommit = await runChecked(deps, "git", ["-C", checkout, "rev-parse", "HEAD"], { label: "commit verification", maxOutputBytes });
  if (actualCommit !== commit) throw new Error(`exact commit verification failed: expected ${commit}, received ${actualCommit}`);
  const status = await runChecked(deps, "git", ["-C", checkout, "status", "--porcelain", "--untracked-files=normal"], { label: "clean checkout verification", maxOutputBytes });
  const allowed = new Set(allowedGeneratedEntries);
  const unexpected = status.split("\n").filter(Boolean).filter((entry) => !allowed.has(entry));
  if (unexpected.length > 0) throw new Error(`isolated checkout is not clean; unexpected tracked or untracked entries: ${unexpected.join(", ")}`);
}

function minimalEnvironment(overrides = {}) {
  const environment = {};
  for (const name of CHILD_ENV_ALLOWLIST) if (typeof process.env[name] === "string") environment[name] = process.env[name];
  return { ...environment, ...overrides };
}

function requestDigest({ input, fence, repositoryOrigin }) {
  const managed = input.managed ?? {};
  return sha256(canonicalJson({
    fence,
    repository_origin: repositoryOrigin,
    commit: input.commit,
    project_key: input.profile?.project_key,
    environment: input.profile?.environment,
    adapter_id: managed.adapter_id ?? "profile-command-v1",
    configuration: managed.configuration ?? {},
  }));
}

function failureReceipt(fence, namespace, reason) {
  return { environment_status: "INFRA_FAILURE", ...fence, target_namespace: namespace, reason: errorMessage(reason) };
}

function cleanupReceipt(fence, namespace, status, extra = {}) {
  return { environment_status: status, ...fence, target_namespace: namespace, ...extra };
}

function processExists(state, deps) {
  try { deps.processKill(state.pid, 0); return true; } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function ownershipArguments(state) {
  return [
    `--qah-run-id=${encodeURIComponent(state.fence.run_id)}`,
    `--qah-attempt-id=${encodeURIComponent(state.fence.attempt_id)}`,
    `--qah-environment-id=${encodeURIComponent(state.fence.environment_id)}`,
    `--qah-instance-nonce=${encodeURIComponent(state.instance_nonce)}`,
    `--qah-repository-origin=${encodeURIComponent(state.repository_origin)}`,
    `--qah-state-root=${encodeURIComponent(state.state_root)}`,
    `--qah-owner-token=${encodeURIComponent(state.owner_token)}`,
    `--qah-commit=${encodeURIComponent(state.commit)}`,
  ];
}

async function processOwnership(state, deps) {
  if (!processExists(state, deps)) return "absent";
  let command;
  try { command = await runChecked(deps, "ps", ["-p", String(state.pid), "-o", "command="], { label: "process ownership verification" }); } catch {
    return processExists(state, deps) ? "foreign" : "absent";
  }
  const exactMarkers = [state.executable_identity, ...ownershipArguments(state)];
  return exactMarkers.every((marker) => command.includes(marker)) ? "owned" : "foreign";
}

async function waitForExit(state, deps, timeoutMs = 3_000) {
  const deadline = deps.now() + timeoutMs;
  while (deps.now() < deadline) {
    if (!processExists(state, deps)) return true;
    await deps.sleep(25);
  }
  return !processExists(state, deps);
}

async function stopOwned(state, deps) {
  const ownership = await processOwnership(state, deps);
  if (ownership === "absent") return "absent";
  if (ownership !== "owned") return "uncertain";
  deps.processKill(state.pid, "SIGTERM");
  if (!await waitForExit(state, deps)) return "uncertain";
  return "stopped";
}

async function quarantine(paths, deps) {
  const quarantinePath = `${paths.environmentDirectory}.quarantine-${deps.now()}-${deps.randomUUID()}`;
  await rename(paths.environmentDirectory, quarantinePath);
  return quarantinePath;
}

async function recoveryReceipt(input, paths, deps, fence, namespace, reason) {
  if (input.quarantineRecovery === false) {
    return cleanupReceipt(fence, namespace, "RECOVERY_REQUIRED", { reason: errorMessage(reason) });
  }
  const quarantinePath = await quarantine(paths, deps);
  return cleanupReceipt(fence, namespace, "RECOVERY_REQUIRED", { reason: errorMessage(reason), quarantine_path: quarantinePath });
}

function validateIdentityShape(identity, { allowFileRepository = false } = {}) {
  if (!identity || typeof identity !== "object" || Array.isArray(identity) || JSON.stringify(Object.keys(identity).sort()) !== JSON.stringify(IDENTITY_KEYS)) {
    throw new HealthProtocolError("health identity must be an exact object");
  }
  if (!SHA_PATTERN.test(identity.commit) || !DIGEST_PATTERN.test(identity.content_hash) || !ENVIRONMENT_ID_PATTERN.test(identity.environment_id) || !NONCE_PATTERN.test(identity.instance_nonce)) {
    throw new HealthProtocolError("health identity has an invalid commit, content hash, environment id, or instance nonce");
  }
  if (allowFileRepository && identity.repository_origin.startsWith("file:")) {
    let url;
    try { url = new URL(identity.repository_origin); } catch { throw new HealthProtocolError("health identity repository origin is invalid"); }
    if (url.protocol !== "file:" || (url.hostname && url.hostname !== "localhost")) throw new HealthProtocolError("health identity repository origin is invalid");
  } else {
    normalizeHttpsOrigin(identity.repository_origin);
  }
  return identity;
}

async function readBoundedJson(response, maxOutputBytes) {
  if (response.status >= 300 && response.status < 400) throw new HealthProtocolError("health endpoint redirect rejected");
  if (response.redirected) throw new HealthProtocolError("health endpoint redirect rejected");
  if (!response.ok) throw new HealthProtocolError(`health endpoint returned HTTP ${response.status}`);
  const type = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new HealthProtocolError("health endpoint content-type must be application/json");
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > maxOutputBytes)) throw new HealthProtocolError("health response exceeds output bound");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxOutputBytes) throw new HealthProtocolError("health response exceeds output bound");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new HealthProtocolError("health response is not valid UTF-8"); }
  try { return JSON.parse(text); } catch { throw new HealthProtocolError("health response is not valid JSON"); }
}

async function readHealthIdentity(state, input, deps, signal) {
  const response = await deps.fetch(new URL(state.health_path, state.base_url), { redirect: "error", signal });
  const body = await readBoundedJson(response, state.max_output_bytes);
  const identity = input.managed?.normalize_identity ? input.managed.normalize_identity(body) : body;
  return validateIdentityShape(identity, input);
}

function identityMatches(identity, state) {
  return identity.repository_origin === state.repository_origin
    && identity.commit === state.commit
    && identity.content_hash === state.content_hash
    && identity.environment_id === state.fence.environment_id
    && identity.instance_nonce === state.instance_nonce;
}

async function waitForIdentity(state, input, deps) {
  const deadline = deps.now() + state.timeout_ms;
  let lastError = new Error("health endpoint has not responded");
  while (deps.now() < deadline) {
    try {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(1_000, deadline - deps.now())));
      const identity = await readHealthIdentity(state, input, deps, signal);
      if (!identityMatches(identity, state)) throw new HealthProtocolError("health identity does not match the requested instance nonce and build identity");
      return identity;
    } catch (error) {
      lastError = error;
      if (error instanceof HealthProtocolError) throw error;
      await deps.sleep(25);
    }
  }
  throw new Error(`environment startup timed out: ${errorMessage(lastError)}`);
}

function validateState(state, expected) {
  if (state?.schema !== STATE_SCHEMA || state.state_root !== expected.root || state.checkout !== expected.paths.checkout || state.pid_file !== expected.paths.pidFile || !NONCE_PATTERN.test(state.instance_nonce) || typeof state.owner_token !== "string" || state.owner_token.length < 16 || !Number.isSafeInteger(state.pid) || state.pid <= 1 || !isAbsolute(state.executable_identity) || !isAbsolute(state.executable_realpath)) {
    throw new Error("environment ownership state is malformed");
  }
  if (canonicalJson(state.fence) !== canonicalJson(expected.fence) || state.repository_origin !== expected.repositoryOrigin) throw new Error("environment ownership tuple does not match the requested fence, repository, and state root");
  return state;
}

async function readState(paths, expected) {
  return validateState(JSON.parse(await readFile(paths.stateFile, "utf8")), expected);
}

async function resolveExecutable(command) {
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== "string" || part.length === 0)) throw new Error("managed command must be a non-empty argv array");
  const candidate = command.length > 1 && isAbsolute(command[1]) ? command[1] : command[0];
  if (!isAbsolute(candidate)) throw new Error("managed executable identity must be absolute");
  return { executableIdentity: candidate, executableRealpath: await realpath(candidate) };
}

async function defaultPrepareCheckout({ input, checkout }) {
  if (!input.baseUrl || !DIGEST_PATTERN.test(input.contentHash ?? "")) throw new Error("profile command requires exact baseUrl and contentHash inputs");
  return { command: input.profile.environment.prepare_command, base_url: input.baseUrl, content_hash: input.contentHash, environment: {} };
}

async function startManaged(state, runtime, deps) {
  const args = [...runtime.command.slice(1), ...ownershipArguments(state)];
  const identityEnvironment = runtime.environment_for_identity?.(state) ?? {};
  const child = deps.spawn(runtime.command[0], args, {
    cwd: state.checkout,
    env: minimalEnvironment({ ...runtime.environment, ...identityEnvironment }),
    detached: true,
    stdio: "ignore",
  });
  await new Promise((resolvePromise, rejectPromise) => {
    child.once("spawn", resolvePromise);
    child.once("error", rejectPromise);
  });
  child.unref();
  if (!Number.isSafeInteger(child.pid) || child.pid <= 1) throw new Error("managed product did not provide a valid PID");
  return child.pid;
}

function executionBounds(profile) {
  const timeoutMs = profile?.execution?.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = profile?.execution?.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 600_000) throw new Error("execution timeout is invalid");
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > 10 * 1024 * 1024) throw new Error("execution output bound is invalid");
  return { timeoutMs, maxOutputBytes };
}

async function normalizedInput(input) {
  if (!input?.profile?.environment || !input.profile.repository) throw new Error("validated profile is required");
  const strategy = input.profile.environment.strategy;
  if (!["none", "managed_command"].includes(strategy)) throw new Error("unsupported environment strategy");
  const fence = fenceFrom(input);
  const namespace = targetNamespace(input);
  const root = stateRoot(input.stateRoot);
  const repositoryOrigin = await normalizeOrigin(input.repositoryOrigin, input);
  const allowedOrigin = await normalizeOrigin(input.profile.repository.allowed_origin, input);
  if (repositoryOrigin !== allowedOrigin) throw new Error("repository origin does not match the profile allowlist");
  const commit = requireCommit(input.commit);
  const paths = pathsFor(root, input.namespaceOverride ?? namespace);
  const bounds = executionBounds(input.profile);
  return { strategy, fence, namespace, root, paths, repositoryOrigin, commit, ...bounds };
}

export async function prepareEnvironment(input) {
  let normalized;
  try { normalized = await normalizedInput(input); } catch (error) {
    let fence;
    try { fence = fenceFrom(input); } catch { fence = { run_id: input?.runId, attempt_id: input?.attemptId, environment_id: input?.environmentId }; }
    let namespace = "invalid";
    try { namespace = targetNamespace(input); } catch {}
    return failureReceipt(fence, namespace, error);
  }
  const { strategy, fence, namespace, root, paths, repositoryOrigin, commit, timeoutMs, maxOutputBytes } = normalized;
  if (strategy === "none") return { environment_status: "NOT_REQUIRED", ...fence, target_namespace: namespace };
  const deps = dependencies(input);
  const digest = requestDigest({ input: { ...input, commit }, fence, repositoryOrigin });
  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    return await withLock(paths, async () => {
      if (await exists(paths.stateFile)) {
        const state = await readState(paths, { root, paths, fence, repositoryOrigin });
        if (state.request_digest !== digest) throw new Error("attempt fence conflicts with a different request body");
        if ((await readFile(paths.pidFile, "utf8")).trim() !== String(state.pid)) throw new Error("PID file does not match ownership state");
        const ownership = await processOwnership(state, deps);
        if (ownership !== "owned") throw new Error(ownership === "foreign" ? "instance identity ownership failed: foreign PID prevents safe idempotent replay" : "owned process is absent; recovery is required");
        await verifyCheckout({ deps, checkout: paths.checkout, commit, maxOutputBytes, allowedGeneratedEntries: state.allowed_generated_entries });
        await waitForIdentity(state, input, deps);
        return state.receipt;
      }
      if (await exists(paths.environmentDirectory)) throw new Error("interrupted environment preparation requires explicit recovery cleanup");
      await mkdir(paths.environmentDirectory, { mode: 0o700 });
      let state;
      try {
        await cloneExactCommit({ deps, repositoryOrigin, commit, checkout: paths.checkout, maxOutputBytes });
        const prepareCheckout = input.managed?.prepareCheckout ?? defaultPrepareCheckout;
        const runtime = await prepareCheckout({ input, checkout: paths.checkout, repositoryOrigin, commit, fence });
        if (!runtime || !DIGEST_PATTERN.test(runtime.content_hash) || typeof runtime.base_url !== "string") throw new Error("managed adapter returned an invalid runtime identity");
        const baseUrl = new URL(runtime.base_url);
        if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") throw new Error("managed base URL must use HTTP or HTTPS");
        const { executableIdentity, executableRealpath } = await resolveExecutable(runtime.command);
        const instanceNonce = deps.randomUUID();
        const ownerToken = deps.randomUUID();
        const stateFields = runtime.state_fields ?? {};
        if (!stateFields || typeof stateFields !== "object" || Array.isArray(stateFields)) throw new Error("managed adapter state fields must be an object");
        const protectedStateFields = new Set(["schema", "phase", "fence", "request_digest", "repository_origin", "commit", "state_root", "checkout", "pid_file", "executable_identity", "executable_realpath", "instance_nonce", "owner_token", "content_hash", "base_url", "health_path", "timeout_ms", "max_output_bytes", "allowed_generated_entries", "pid", "receipt"]);
        if (Object.keys(stateFields).some((key) => protectedStateFields.has(key))) throw new Error("managed adapter attempted to override generic ownership state");
        state = {
          schema: STATE_SCHEMA,
          phase: "PREPARING",
          fence,
          request_digest: digest,
          repository_origin: repositoryOrigin,
          commit,
          state_root: root,
          checkout: paths.checkout,
          pid_file: paths.pidFile,
          executable_identity: executableIdentity,
          executable_realpath: executableRealpath,
          instance_nonce: instanceNonce,
          owner_token: ownerToken,
          content_hash: runtime.content_hash,
          base_url: baseUrl.href.replace(/\/$/, ""),
          health_path: input.profile.environment.health_path,
          timeout_ms: timeoutMs,
          max_output_bytes: maxOutputBytes,
          allowed_generated_entries: runtime.allowed_generated_entries ?? [],
          ...stateFields,
        };
        await writeAtomic(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`, deps);
        const pid = await startManaged(state, runtime, deps);
        state = { ...state, phase: "STARTED", pid };
        await writeAtomic(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`, deps);
        await writeAtomic(paths.pidFile, `${pid}\n`, deps);
        await waitForIdentity(state, input, deps);
        const receipt = {
          environment_status: "READY",
          ...fence,
          target_namespace: namespace,
          repository_origin: repositoryOrigin,
          commit,
          content_hash: state.content_hash,
          instance_nonce: state.instance_nonce,
          base_url: state.base_url,
          pid_file: paths.pidFile,
          state_file: paths.stateFile,
        };
        state = { ...state, phase: "READY", receipt };
        await writeAtomic(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`, deps);
        return receipt;
      } catch (error) {
        if (state?.pid) {
          const stopped = await stopOwned(state, deps);
          if (stopped === "uncertain") {
            await quarantine(paths, deps);
            throw new Error(`${errorMessage(error)}; process ownership became uncertain and state was quarantined`);
          }
        }
        await rm(paths.environmentDirectory, { recursive: true, force: true });
        throw error;
      }
    });
  } catch (error) {
    return failureReceipt(fence, namespace, error);
  }
}

export async function cleanupEnvironment(input) {
  let normalized;
  try { normalized = await normalizedInput(input); } catch (error) {
    let fence;
    try { fence = fenceFrom(input); } catch { fence = { run_id: input?.runId, attempt_id: input?.attemptId, environment_id: input?.environmentId }; }
    let namespace = "invalid";
    try { namespace = targetNamespace(input); } catch {}
    return cleanupReceipt(fence, namespace, "RECOVERY_REQUIRED", { reason: errorMessage(error) });
  }
  const { fence, namespace, root, paths, repositoryOrigin } = normalized;
  if (normalized.strategy === "none") return cleanupReceipt(fence, namespace, "ABSENT");
  const deps = dependencies(input);
  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    return await withLock(paths, async () => {
      if (!await exists(paths.environmentDirectory)) return cleanupReceipt(fence, namespace, "ABSENT");
      if (!await exists(paths.stateFile)) {
        return recoveryReceipt(input, paths, deps, fence, namespace, "ownership state is missing after interrupted prepare");
      }
      let state;
      try { state = await readState(paths, { root, paths, fence, repositoryOrigin }); } catch (error) {
        return recoveryReceipt(input, paths, deps, fence, namespace, error);
      }
      if (!(await exists(paths.pidFile)) || (await readFile(paths.pidFile, "utf8")).trim() !== String(state.pid)) {
        return recoveryReceipt(input, paths, deps, fence, namespace, "PID file does not match ownership state");
      }
      const stopped = await stopOwned(state, deps);
      if (stopped === "uncertain") {
        return recoveryReceipt(input, paths, deps, fence, namespace, "PID ownership is foreign or uncertain; refusing to signal it");
      }
      await rm(paths.environmentDirectory, { recursive: true, force: true });
      return cleanupReceipt(fence, namespace, "STOPPED");
    });
  } catch (error) {
    return cleanupReceipt(fence, namespace, "RECOVERY_REQUIRED", { reason: errorMessage(error) });
  }
}

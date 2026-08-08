#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const STATE_SCHEMA = 'qah.environment-state.v1';
const ALLOWED_VARIANTS = new Set(['buggy-v1', 'fixed-v2']);
const DEFAULT_STATE_ROOT = join(tmpdir(), 'paydemo-qah-environments');
const DEFAULT_TRUSTED_REPOSITORY = 'https://github.com/solomindanil/NuanuFlowQA.git';
const STARTUP_TIMEOUT_MS = 10_000;
const BUILD_INFO_TIMEOUT_MS = 1_000;
const MAX_BUILD_INFO_BYTES = 32 * 1024;
const BUILD_INFO_KEYS = [
  'app',
  'commit',
  'contentHash',
  'environmentId',
  'instanceNonce',
  'variant',
];
const CHILD_ENV_ALLOWLIST = [
  'PATH',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'TMP',
  'TEMP',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
];

function fail(message) {
  throw new Error(message);
}

function parseFlags(argv) {
  if (argv.length === 0) fail('Usage: paydemo-qah-environment.mjs <prepare|cleanup> [options]');
  const [mode, ...tokens] = argv;
  if (!['prepare', 'cleanup'].includes(mode)) fail(`Unsupported mode: ${mode}`);
  if (tokens.length % 2 !== 0) fail(`Missing value for ${tokens.at(-1)}`);
  const flags = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag.startsWith('--') || value.startsWith('--')) fail(`Invalid option pair: ${flag} ${value}`);
    if (flags.has(flag)) fail(`Duplicate option: ${flag}`);
    flags.set(flag, value);
  }
  return { mode, flags };
}

function onlyKnownFlags(flags, allowed) {
  for (const flag of flags.keys()) {
    if (!allowed.has(flag)) fail(`Unsupported option: ${flag}`);
  }
}

function requiredFlag(flags, name) {
  const value = flags.get(name);
  if (typeof value !== 'string' || value.length === 0) fail(`Missing required option: ${name}`);
  return value;
}

function parseEnvironmentId(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    fail('environment_id must match ^[a-z0-9][a-z0-9-]{0,63}$');
  }
  return value;
}

function parseItemKey(value, fallback) {
  const itemKey = value ?? fallback;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(itemKey)) fail('item key contains unsupported characters');
  return itemKey;
}

function parseCommit(value) {
  if (!/^[a-f0-9]{40}$/.test(value)) fail('commit must be an exact 40-character lowercase Git SHA');
  return value;
}

function parseVariant(value) {
  if (!ALLOWED_VARIANTS.has(value)) fail(`Unsupported PayDemo variant: ${value}`);
  return value;
}

function parsePort(value) {
  if (!/^[0-9]+$/.test(value)) fail('port must be an integer');
  const port = Number.parseInt(value, 10);
  if (port < 1024 || port > 65535) fail('port must be between 1024 and 65535');
  return port;
}

function parseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('repository URL is malformed');
  }
  if (url.username || url.password || url.search || url.hash) {
    fail('repository URL must not embed credentials, query parameters, or fragments');
  }
  return url;
}

function normalizeHttpsRepository(value) {
  const url = parseUrl(value);
  if (url.protocol !== 'https:' || !url.hostname) {
    fail('trusted repository allowlist accepts exact HTTPS URLs only');
  }
  if (!url.pathname.endsWith('.git') || url.pathname.includes('//')) {
    fail('trusted repository URL must identify an exact .git path');
  }
  return url.href;
}

function trustedHttpsRepositories() {
  const configured = process.env.NUANU_QA_ALLOWED_REPOSITORIES;
  if (configured === undefined) return new Set([DEFAULT_TRUSTED_REPOSITORY]);
  if (configured.trim() === '') return new Set();
  const entries = configured.split(',').map((entry) => entry.trim());
  if (entries.some((entry) => entry === '')) {
    fail('NUANU_QA_ALLOWED_REPOSITORIES contains an empty repository entry');
  }
  return new Set(entries.map((entry) => normalizeHttpsRepository(entry)));
}

async function parseRepoUrl(value) {
  const url = parseUrl(value);
  if (url.protocol === 'https:') {
    const normalized = normalizeHttpsRepository(value);
    if (!trustedHttpsRepositories().has(normalized)) {
      fail('repository is not present in the trusted exact HTTPS allowlist');
    }
    return normalized;
  }
  if (url.protocol !== 'file:') {
    fail('repository URL must use trusted https://; file:// is test-only');
  }
  if (process.env.NUANU_QA_ALLOW_FILE_REPO !== '1') {
    fail('file repository support is disabled; set NUANU_QA_ALLOW_FILE_REPO=1 only in controlled tests');
  }
  if (url.hostname && url.hostname !== 'localhost') {
    fail('file repository URL must resolve on the local host');
  }
  let repositoryPath;
  try {
    repositoryPath = await realpath(fileURLToPath(url));
  } catch {
    fail('file repository path cannot be resolved safely');
  }
  if (!(await stat(repositoryPath)).isDirectory()) {
    fail('file repository path must resolve to a directory');
  }
  return pathToFileURL(repositoryPath).href;
}

function resolveStateRoot(value) {
  const stateRoot = resolve(value ?? DEFAULT_STATE_ROOT);
  if (stateRoot === resolve(sep)) fail('state root cannot be the filesystem root');
  return stateRoot;
}

function environmentPaths(stateRoot, environmentId) {
  const environmentDirectory = resolve(stateRoot, environmentId);
  if (!environmentDirectory.startsWith(`${stateRoot}${sep}`)) fail('environment path escapes state root');
  return {
    environmentDirectory,
    checkout: join(environmentDirectory, 'checkout'),
    stateFile: join(environmentDirectory, 'environment.json'),
    pidFile: join(environmentDirectory, 'server.pid'),
    logFile: join(environmentDirectory, 'server.log'),
    lockDirectory: `${environmentDirectory}.lock`,
  };
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeAtomic(path, contents) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

async function withEnvironmentLock(paths, operation) {
  try {
    await mkdir(paths.lockDirectory);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('another operation is already running for this environment_id');
    throw error;
  }
  try {
    return await operation();
  } finally {
    await rm(paths.lockDirectory, { recursive: true, force: true });
  }
}

async function runChecked(command, args, options = {}) {
  try {
    const result = await execFile(command, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    if (options.forwardStdout && result.stdout) process.stderr.write(result.stdout);
    if (options.forwardStderr && result.stderr) process.stderr.write(result.stderr);
    return result.stdout.trim();
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? error).trim();
    fail(`${options.label ?? command} failed${detail ? `: ${detail}` : ''}`);
  }
}

function isolatedChildEnvironment(overrides) {
  const environment = {};
  for (const name of CHILD_ENV_ALLOWLIST) {
    if (typeof process.env[name] === 'string') environment[name] = process.env[name];
  }
  return { ...environment, ...overrides };
}

async function cloneExactCommit({ repoUrl, commit, checkout }) {
  await runChecked('git', [
    '-c',
    'http.followRedirects=false',
    'clone',
    '--quiet',
    '--no-checkout',
    '--filter=blob:none',
    '--',
    repoUrl,
    checkout,
  ], { label: 'Git clone' });
  await runChecked('git', [
    '-c',
    'http.followRedirects=false',
    '-C',
    checkout,
    'fetch',
    '--quiet',
    '--no-tags',
    '--depth=1',
    'origin',
    commit,
  ], { label: 'Exact commit fetch' });
  await runChecked('git', ['-C', checkout, 'checkout', '--quiet', '--detach', commit], {
    label: 'Detached checkout',
  });
  await verifyCheckout(checkout, commit);
}

async function verifyCheckout(checkout, expectedCommit, { allowGeneratedOutput = false } = {}) {
  const actualCommit = await runChecked('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
    label: 'Commit verification',
  });
  if (actualCommit !== expectedCommit) {
    fail(`exact commit verification failed: expected ${expectedCommit}, received ${actualCommit}`);
  }
  const status = await runChecked('git', [
    '-C',
    checkout,
    'status',
    '--porcelain',
    '--untracked-files=normal',
  ], { label: 'Clean checkout verification' });
  const unexpectedEntries = status
    .split('\n')
    .filter(Boolean)
    .filter((entry) => !(allowGeneratedOutput && entry === '?? dist/'));
  if (unexpectedEntries.length > 0) {
    fail(`isolated checkout is not clean; unexpected tracked or untracked entries: ${unexpectedEntries.join(', ')}`);
  }
}

async function buildPayDemo({ checkout, variant, commit }) {
  await runChecked(process.execPath, ['scripts/build-paydemo.mjs'], {
    cwd: checkout,
    env: isolatedChildEnvironment({ PAYDEMO_VARIANT: variant }),
    label: 'PayDemo build',
    forwardStdout: true,
  });
  const manifestPath = join(checkout, 'dist/paydemo/build-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    manifest?.app !== 'PayDemo'
    || manifest.variant !== variant
    || manifest.commit !== commit
    || !/^sha256:[a-f0-9]{64}$/.test(manifest.contentHash)
  ) {
    fail('built PayDemo manifest does not match the requested exact build identity');
  }
  await verifyCheckout(checkout, commit, { allowGeneratedOutput: true });
  return manifest;
}

async function isPortInUse(port) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      rejectPromise(new Error(`port ${port} availability check timed out`));
    });
    socket.once('error', (error) => {
      socket.destroy();
      if (error?.code === 'ECONNREFUSED') resolvePromise(false);
      else rejectPromise(error);
    });
  });
}

function isPid(value) {
  return Number.isSafeInteger(value) && value > 1;
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function processOwnership(state) {
  if (!processExists(state.pid)) return 'absent';
  let command;
  try {
    command = await runChecked('ps', ['-p', String(state.pid), '-o', 'command='], {
      label: 'Process ownership verification',
    });
  } catch {
    return processExists(state.pid) ? 'foreign' : 'absent';
  }
  const expectedServer = join(state.checkout, 'apps/paydemo/server.mjs');
  const environmentArgument = `--qah-environment-id=${state.environment_id}`;
  const ownerArgument = `--qah-owner-token=${state.owner_token}`;
  return command.includes(expectedServer)
    && command.includes(environmentArgument)
    && command.includes(ownerArgument)
    ? 'owned'
    : 'foreign';
}

async function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  return !processExists(pid);
}

async function stopOwnedProcess(state) {
  const ownership = await processOwnership(state);
  if (ownership === 'absent') return;
  if (ownership !== 'owned') fail('PID ownership verification failed; refusing to stop a foreign process');
  process.kill(state.pid, 'SIGTERM');
  if (!await waitForProcessExit(state.pid, 3_000)) {
    const recheckedOwnership = await processOwnership(state);
    if (recheckedOwnership !== 'owned') {
      fail('PID ownership changed while waiting; refusing further signals');
    }
    fail('owned PayDemo process did not stop after SIGTERM');
  }
}

function validateBuildInfoShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('/build-info JSON must be an exact object');
  }
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(BUILD_INFO_KEYS)) {
    fail('/build-info JSON contains an unexpected field or is missing a required field');
  }
  const valid = value.app === 'PayDemo'
    && ALLOWED_VARIANTS.has(value.variant)
    && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commit)
    && /^sha256:[a-f0-9]{64}$/.test(value.contentHash)
    && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value.environmentId)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.instanceNonce);
  if (!valid) fail('/build-info JSON does not match the exact safe build identity shape');
  return value;
}

async function readBoundedBuildInfoBody(response) {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^[0-9]+$/.test(declaredLength) || Number.parseInt(declaredLength, 10) > MAX_BUILD_INFO_BYTES) {
      fail('/build-info body exceeds the 32KB limit');
    }
  }
  if (!response.body?.getReader) fail('/build-info response body is unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BUILD_INFO_BYTES) {
      await reader.cancel('/build-info body exceeds the 32KB limit');
      fail('/build-info body exceeds the 32KB limit');
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, totalBytes));
  } catch {
    fail('/build-info body is not valid UTF-8');
  }
}

export async function fetchBuildInfo(baseUrl) {
  const response = await fetch(`${baseUrl}/build-info`, {
    redirect: 'error',
    signal: AbortSignal.timeout(BUILD_INFO_TIMEOUT_MS),
  });
  if (!response.ok) fail(`/build-info returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') fail('/build-info content-type must be application/json');
  const text = await readBoundedBuildInfoBody(response);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail('/build-info body is not valid JSON');
  }
  return validateBuildInfoShape(value);
}

function exactBuildInfo(buildInfo, expected) {
  return buildInfo?.app === 'PayDemo'
    && buildInfo.variant === expected.variant
    && buildInfo.commit === expected.commit
    && buildInfo.contentHash === expected.content_hash
    && buildInfo.environmentId === expected.environment_id
    && buildInfo.instanceNonce === expected.instance_nonce;
}

async function waitForBuildInfo(baseUrl, expected, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'server has not responded';
  while (Date.now() < deadline) {
    let buildInfo;
    try {
      buildInfo = await fetchBuildInfo(baseUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      continue;
    }
    if (!exactBuildInfo(buildInfo, expected)) {
      const sameBuild = buildInfo?.app === 'PayDemo'
        && buildInfo.variant === expected.variant
        && buildInfo.commit === expected.commit
        && buildInfo.contentHash === expected.content_hash;
      fail(sameBuild
        ? '/build-info instance identity does not match environment_id and instance_nonce'
        : '/build-info does not match the requested exact build identity');
    }
    return buildInfo;
  }
  fail(`PayDemo startup verification timed out: ${lastError}`);
}

function validateState(state, paths) {
  if (
    state?.schema !== STATE_SCHEMA
    || !isPid(state.pid)
    || typeof state.owner_token !== 'string'
    || state.owner_token.length < 16
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(state.instance_nonce)
    || state.checkout !== paths.checkout
    || state.pid_file !== paths.pidFile
  ) {
    fail('environment state is malformed; refusing unsafe process operations');
  }
  return state;
}

async function readState(paths) {
  const state = JSON.parse(await readFile(paths.stateFile, 'utf8'));
  return validateState(state, paths);
}

function assertSameConfiguration(state, requested) {
  const fields = ['environment_id', 'repo_url', 'commit', 'variant', 'port'];
  for (const field of fields) {
    if (state[field] !== requested[field]) {
      fail(`environment_id already exists with a different ${field}; run explicit cleanup first`);
    }
  }
}

function prepareEnvelope(state, itemKey) {
  return {
    item: {
      key: itemKey,
      description: `Изолированное окружение PayDemo ${state.variant} готово на точном commit ${state.commit}.`,
      data: {
        environment_status: 'READY',
        environment_id: state.environment_id,
        instance_nonce: state.instance_nonce,
        base_url: state.base_url,
        variant: state.variant,
        commit: state.commit,
        content_hash: state.content_hash,
        pid_file: state.pid_file,
      },
      artifacts: {},
    },
    artifact_outputs: {
      'item.artifacts.environment_manifest': null,
    },
  };
}

function cleanupEnvelope({ environmentId, pidFile, status, itemKey }) {
  return {
    item: {
      key: itemKey,
      description: status === 'STOPPED'
        ? `Изолированное окружение ${environmentId} остановлено.`
        : `Изолированное окружение ${environmentId} уже отсутствует.`,
      data: {
        environment_status: status,
        environment_id: environmentId,
        pid_file: pidFile,
      },
      artifacts: {},
    },
    artifact_outputs: {
      'item.artifacts.environment_manifest': null,
    },
  };
}

async function startServer({ paths, environmentId, instanceNonce, variant, port, ownerToken }) {
  const serverPath = join(paths.checkout, 'apps/paydemo/server.mjs');
  await access(serverPath);
  const logDescriptor = openSync(paths.logFile, 'a', 0o600);
  let child;
  try {
    child = spawn(process.execPath, [
      serverPath,
      `--qah-environment-id=${environmentId}`,
      `--qah-owner-token=${ownerToken}`,
    ], {
      cwd: paths.checkout,
      env: isolatedChildEnvironment({
        PAYDEMO_PORT: String(port),
        PAYDEMO_VARIANT: variant,
        PAYDEMO_ENVIRONMENT_ID: environmentId,
        PAYDEMO_INSTANCE_NONCE: instanceNonce,
      }),
      detached: true,
      stdio: ['ignore', logDescriptor, logDescriptor],
    });
    await new Promise((resolvePromise, rejectPromise) => {
      child.once('spawn', resolvePromise);
      child.once('error', rejectPromise);
    });
  } finally {
    closeSync(logDescriptor);
  }
  child.unref();
  if (!isPid(child.pid)) fail('PayDemo server did not provide a valid PID');
  return child.pid;
}

async function prepare(options) {
  const repoUrl = await parseRepoUrl(requiredFlag(options.flags, '--repo-url'));
  const requested = {
    environment_id: parseEnvironmentId(requiredFlag(options.flags, '--environment-id')),
    repo_url: repoUrl,
    commit: parseCommit(requiredFlag(options.flags, '--commit')),
    variant: parseVariant(requiredFlag(options.flags, '--variant')),
    port: parsePort(requiredFlag(options.flags, '--port')),
  };
  const stateRoot = resolveStateRoot(options.flags.get('--state-root'));
  const itemKey = parseItemKey(options.flags.get('--item-key'), 'prepare_environment');
  const paths = environmentPaths(stateRoot, requested.environment_id);
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });

  return withEnvironmentLock(paths, async () => {
    if (await pathExists(paths.stateFile)) {
      const state = await readState(paths);
      assertSameConfiguration(state, requested);
      const pidText = (await readFile(paths.pidFile, 'utf8')).trim();
      if (pidText !== String(state.pid)) fail('PID file does not match environment ownership state');
      const ownership = await processOwnership(state);
      if (ownership === 'foreign') fail('PID ownership verification failed; refusing to reuse a foreign process');
      if (ownership === 'owned') {
        await verifyCheckout(paths.checkout, requested.commit, { allowGeneratedOutput: true });
        await waitForBuildInfo(state.base_url, state);
        return prepareEnvelope(state, itemKey);
      }
      await rm(paths.environmentDirectory, { recursive: true, force: true });
    } else if (await pathExists(paths.environmentDirectory)) {
      fail('environment directory exists without ownership state; refusing unsafe replacement');
    }

    if (await isPortInUse(requested.port)) fail(`port ${requested.port} is already in use; refusing to stop its owner`);
    await mkdir(paths.environmentDirectory, { recursive: false, mode: 0o700 });
    let state;
    try {
      await cloneExactCommit({
        repoUrl: requested.repo_url,
        commit: requested.commit,
        checkout: paths.checkout,
      });
      const manifest = await buildPayDemo({
        checkout: paths.checkout,
        variant: requested.variant,
        commit: requested.commit,
      });
      if (await isPortInUse(requested.port)) fail(`port ${requested.port} became occupied before startup`);
      const ownerToken = randomUUID();
      const instanceNonce = randomUUID();
      const pid = await startServer({
        paths,
        environmentId: requested.environment_id,
        instanceNonce,
        variant: requested.variant,
        port: requested.port,
        ownerToken,
      });
      state = {
        schema: STATE_SCHEMA,
        ...requested,
        checkout: paths.checkout,
        pid_file: paths.pidFile,
        base_url: `http://127.0.0.1:${requested.port}`,
        content_hash: manifest.contentHash,
        instance_nonce: instanceNonce,
        pid,
        owner_token: ownerToken,
      };
      await writeAtomic(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`);
      await writeAtomic(paths.pidFile, `${pid}\n`);
      await waitForBuildInfo(state.base_url, state);
      return prepareEnvelope(state, itemKey);
    } catch (error) {
      if (state) {
        await stopOwnedProcess(state).catch((cleanupError) => {
          process.stderr.write(`Startup cleanup warning: ${cleanupError.message}\n`);
        });
      }
      await rm(paths.environmentDirectory, { recursive: true, force: true });
      throw error;
    }
  });
}

async function cleanup(options) {
  const environmentId = parseEnvironmentId(requiredFlag(options.flags, '--environment-id'));
  const stateRoot = resolveStateRoot(options.flags.get('--state-root'));
  const itemKey = parseItemKey(options.flags.get('--item-key'), 'cleanup_environment');
  const paths = environmentPaths(stateRoot, environmentId);
  const suppliedPidFile = resolve(requiredFlag(options.flags, '--pid-file'));
  if (suppliedPidFile !== paths.pidFile || !isAbsolute(suppliedPidFile)) {
    fail('PID file must be the exact file for environment_id under state root');
  }
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });

  return withEnvironmentLock(paths, async () => {
    if (!await pathExists(paths.stateFile)) {
      if (await pathExists(paths.pidFile) || await pathExists(paths.environmentDirectory)) {
        fail('ownership state is missing; refusing unsafe cleanup');
      }
      return cleanupEnvelope({ environmentId, pidFile: suppliedPidFile, status: 'ABSENT', itemKey });
    }
    const state = await readState(paths);
    if (state.environment_id !== environmentId) fail('environment_id does not match ownership state');
    const pidText = (await readFile(suppliedPidFile, 'utf8')).trim();
    if (!/^[0-9]+$/.test(pidText) || Number.parseInt(pidText, 10) !== state.pid) {
      fail('PID file does not match environment ownership state');
    }
    await stopOwnedProcess(state);
    await rm(paths.environmentDirectory, { recursive: true, force: true });
    return cleanupEnvelope({ environmentId, pidFile: suppliedPidFile, status: 'STOPPED', itemKey });
  });
}

export async function main(argv) {
  const options = parseFlags(argv);
  if (options.mode === 'prepare') {
    onlyKnownFlags(options.flags, new Set([
      '--repo-url',
      '--commit',
      '--variant',
      '--port',
      '--environment-id',
      '--state-root',
      '--item-key',
    ]));
    return prepare(options);
  }
  onlyKnownFlags(options.flags, new Set([
    '--environment-id',
    '--state-root',
    '--pid-file',
    '--item-key',
  ]));
  return cleanup(options);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main(process.argv.slice(2)).then((envelope) => {
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

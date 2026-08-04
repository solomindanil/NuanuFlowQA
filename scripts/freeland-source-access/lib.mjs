import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_ACCESS } from './constants.mjs';

export class SourceAccessError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'SourceAccessError';
  }
}

export function buildPaths(baseDir) {
  return {
    baseDir,
    privateKey: join(baseDir, SOURCE_ACCESS.privateBasename),
    publicKey: join(baseDir, SOURCE_ACCESS.publicBasename),
    handoff: join(baseDir, SOURCE_ACCESS.handoffBasename),
    attestation: join(baseDir, SOURCE_ACCESS.attestationBasename),
  };
}

function reason(reason) {
  throw new SourceAccessError(reason);
}

function expectedUid(options) {
  return options.expectedUid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined);
}

async function lstatOrNull(path) {
  try {
    return await fs.lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    reason('SOURCE_ACCESS_CUSTODY_INVALID');
  }
}

function hasExactMode(stat, mode) {
  return (stat.mode & 0o777) === mode;
}

function isOwned(stat, uid) {
  return uid === undefined || stat.uid === uid;
}

function validateDirectoryStat(stat, uid) {
  if (!stat?.isDirectory() || stat.isSymbolicLink() || !isOwned(stat, uid) || !hasExactMode(stat, SOURCE_ACCESS.directoryMode)) {
    reason('SOURCE_ACCESS_DIRECTORY_INVALID');
  }
}

function validateFileStat(stat, uid) {
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !isOwned(stat, uid) || !hasExactMode(stat, SOURCE_ACCESS.fileMode)) {
    reason('SOURCE_ACCESS_CUSTODY_INVALID');
  }
}

async function validateExistingBaseDir(baseDir, uid) {
  const stat = await lstatOrNull(baseDir);
  if (stat) validateDirectoryStat(stat, uid);
  return stat;
}

async function ensureBaseDir(baseDir, uid) {
  const existing = await lstatOrNull(baseDir);
  if (existing) {
    validateDirectoryStat(existing, uid);
    return;
  }
  try {
    await fs.mkdir(baseDir, { recursive: true, mode: SOURCE_ACCESS.directoryMode });
    await fs.chmod(baseDir, SOURCE_ACCESS.directoryMode);
  } catch {
    reason('SOURCE_ACCESS_DIRECTORY_INVALID');
  }
  validateDirectoryStat(await lstatOrNull(baseDir), uid);
}

function readU32(buffer, offset) {
  if (offset + 4 > buffer.length) reason('SOURCE_ACCESS_KEY_INVALID');
  return buffer.readUInt32BE(offset);
}

function readString(buffer, offset) {
  const length = readU32(buffer, offset);
  const start = offset + 4;
  const end = start + length;
  if (end > buffer.length) reason('SOURCE_ACCESS_KEY_INVALID');
  return { value: buffer.subarray(start, end), offset: end };
}

function equalsAscii(buffer, text) {
  return buffer.equals(Buffer.from(text, 'utf8'));
}

function parsePublicBlob(blob) {
  let parsed = readString(blob, 0);
  if (!equalsAscii(parsed.value, 'ssh-ed25519')) reason('SOURCE_ACCESS_KEY_INVALID');
  parsed = readString(blob, parsed.offset);
  if (parsed.value.length !== 32 || parsed.offset !== blob.length) reason('SOURCE_ACCESS_KEY_INVALID');
  return parsed.value;
}

function parsePublicMaterial(content) {
  if (!Buffer.isBuffer(content)) content = Buffer.from(content);
  const text = content.toString('utf8');
  if (!text.endsWith('\n') || text.includes('\r') || text.slice(0, -1).includes('\n')) reason('SOURCE_ACCESS_KEY_INVALID');
  const match = /^ssh-ed25519 ([A-Za-z0-9+/]+={0,2}) (FreelandQA read-only source checkout)$/.exec(text.slice(0, -1));
  if (!match || match[2] !== SOURCE_ACCESS.title) {
    reason('SOURCE_ACCESS_KEY_INVALID');
  }
  const blob = Buffer.from(match[1], 'base64');
  if (blob.toString('base64') !== match[1]) reason('SOURCE_ACCESS_KEY_INVALID');
  return { line: text.slice(0, -1), blob, key: parsePublicBlob(blob) };
}

function parsePrivateMaterial(content) {
  const text = content.toString('utf8');
  const match = /^-----BEGIN OPENSSH PRIVATE KEY-----\n([A-Za-z0-9+/=\n]+)-----END OPENSSH PRIVATE KEY-----\n$/.exec(text);
  if (!match) reason('SOURCE_ACCESS_KEY_INVALID');
  const encoded = match[1].replace(/\n/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) reason('SOURCE_ACCESS_KEY_INVALID');
  const magic = Buffer.from('openssh-key-v1\0', 'utf8');
  if (bytes.length < magic.length || !bytes.subarray(0, magic.length).equals(magic)) reason('SOURCE_ACCESS_KEY_INVALID');

  let offset = magic.length;
  let parsed = readString(bytes, offset);
  if (!equalsAscii(parsed.value, 'none')) reason('SOURCE_ACCESS_KEY_INVALID');
  parsed = readString(bytes, parsed.offset);
  if (!equalsAscii(parsed.value, 'none')) reason('SOURCE_ACCESS_KEY_INVALID');
  parsed = readString(bytes, parsed.offset);
  if (parsed.value.length !== 0) reason('SOURCE_ACCESS_KEY_INVALID');
  offset = parsed.offset;
  if (readU32(bytes, offset) !== 1) reason('SOURCE_ACCESS_KEY_INVALID');
  offset += 4;
  parsed = readString(bytes, offset);
  const outerBlob = parsed.value;
  const outerKey = parsePublicBlob(outerBlob);
  parsed = readString(bytes, parsed.offset);
  if (parsed.offset !== bytes.length) reason('SOURCE_ACCESS_KEY_INVALID');

  const privateBlock = parsed.value;
  if (privateBlock.length < 8 || readU32(privateBlock, 0) !== readU32(privateBlock, 4)) reason('SOURCE_ACCESS_KEY_INVALID');
  offset = 8;
  parsed = readString(privateBlock, offset);
  if (!equalsAscii(parsed.value, 'ssh-ed25519')) reason('SOURCE_ACCESS_KEY_INVALID');
  parsed = readString(privateBlock, parsed.offset);
  const embeddedPublic = parsed.value;
  parsed = readString(privateBlock, parsed.offset);
  const privateBytes = parsed.value;
  parsed = readString(privateBlock, parsed.offset);
  if (!equalsAscii(parsed.value, SOURCE_ACCESS.title) || embeddedPublic.length !== 32 || privateBytes.length !== 64 || !privateBytes.subarray(32).equals(embeddedPublic) || !embeddedPublic.equals(outerKey)) {
    reason('SOURCE_ACCESS_KEY_INVALID');
  }
  for (let pad = 1; parsed.offset < privateBlock.length; pad += 1, parsed.offset += 1) {
    if (privateBlock[parsed.offset] !== (pad & 0xff)) reason('SOURCE_ACCESS_KEY_INVALID');
  }
  return { blob: outerBlob, key: outerKey };
}

function fingerprintFor(blob) {
  return `SHA256:${createHash('sha256').update(blob).digest('base64').replace(/=$/, '')}`;
}

function validateKeyPair(privateContent, publicContent) {
  const privateKey = parsePrivateMaterial(privateContent);
  const publicKey = parsePublicMaterial(publicContent);
  if (!privateKey.key.equals(publicKey.key) || !privateKey.blob.equals(publicKey.blob)) reason('SOURCE_ACCESS_KEY_MISMATCH');
  const privateFingerprint = fingerprintFor(privateKey.blob);
  const publicFingerprint = fingerprintFor(publicKey.blob);
  if (privateFingerprint !== publicFingerprint || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(publicFingerprint)) reason('SOURCE_ACCESS_KEY_INVALID');
  return { fingerprint: publicFingerprint, publicLine: publicKey.line };
}

function handoffBytes(fingerprint, publicLine) {
  return Buffer.from([
    `repository=${SOURCE_ACCESS.repository}`,
    `title=${SOURCE_ACCESS.title}`,
    'allowWrite=false',
    `fingerprint=${fingerprint}`,
    `publicKey=${publicLine}`,
    '',
  ].join('\n'), 'utf8');
}

async function validateAwaiting(paths, uid) {
  for (const path of [paths.privateKey, paths.publicKey, paths.handoff]) validateFileStat(await lstatOrNull(path), uid);
  const privateContent = await fs.readFile(paths.privateKey);
  const publicContent = await fs.readFile(paths.publicKey);
  const { fingerprint, publicLine } = validateKeyPair(privateContent, publicContent);
  const handoff = await fs.readFile(paths.handoff);
  if (!handoff.equals(handoffBytes(fingerprint, publicLine))) reason('SOURCE_ACCESS_HANDOFF_INVALID');
  return { fingerprint, publicLine };
}

export async function inspectCustody(options = {}) {
  const baseDir = options.baseDir ?? SOURCE_ACCESS.baseDir;
  const paths = buildPaths(baseDir);
  const uid = expectedUid(options);
  await validateExistingBaseDir(baseDir, uid);
  const [privateStat, publicStat, handoffStat, attestationStat] = await Promise.all([
    lstatOrNull(paths.privateKey), lstatOrNull(paths.publicKey), lstatOrNull(paths.handoff), lstatOrNull(paths.attestation),
  ]);
  const privateExists = Boolean(privateStat);
  const publicExists = Boolean(publicStat);
  const handoffExists = Boolean(handoffStat);
  const attestationExists = Boolean(attestationStat);
  const absent = !privateExists && !publicExists && !handoffExists && !attestationExists;
  const awaiting = privateExists && publicExists && handoffExists && !attestationExists;
  if (!absent && !awaiting) reason('SOURCE_ACCESS_PARTIAL_STATE');
  if (absent) return { status: 'ABSENT', paths };
  const key = await validateAwaiting(paths, uid);
  return { status: 'AWAITING_ADMIN', paths, ...key };
}

function validateRunnerResult(result) {
  if (!result || typeof result !== 'object') reason('SOURCE_ACCESS_RUNNER_UNEXPECTED');
  if (result.timedOut) reason('SOURCE_ACCESS_RUNNER_TIMEOUT');
  if (result.overflow) reason('SOURCE_ACCESS_RUNNER_OUTPUT_OVERFLOW');
  if (result.executable !== undefined && result.executable !== 'ssh-keygen') reason('SOURCE_ACCESS_RUNNER_UNEXPECTED');
  if (result.signal) reason('SOURCE_ACCESS_RUNNER_SIGNAL');
  if (result.code !== 0) reason('SOURCE_ACCESS_RUNNER_EXIT');
}

function validateGeneratedFileStat(stat, uid) {
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !isOwned(stat, uid)) {
    reason('SOURCE_ACCESS_CUSTODY_INVALID');
  }
}

async function destinationIsAbsent(path) {
  if (await lstatOrNull(path)) reason('SOURCE_ACCESS_DESTINATION_COLLISION');
}

function closedResult(paths, fingerprint) {
  return {
    schemaVersion: SOURCE_ACCESS.schemaVersion,
    status: 'AWAITING_ADMIN',
    repository: SOURCE_ACCESS.repository,
    title: SOURCE_ACCESS.title,
    fingerprint,
    handoffPath: paths.handoff,
  };
}

export async function prepareSourceAccess(options = {}) {
  const baseDir = options.baseDir ?? SOURCE_ACCESS.baseDir;
  const runner = options.runner;
  const uid = expectedUid(options);
  const initial = await inspectCustody({ baseDir, expectedUid: uid });
  if (initial.status === 'AWAITING_ADMIN') return closedResult(initial.paths, initial.fingerprint);
  if (typeof runner !== 'function') reason('SOURCE_ACCESS_RUNNER_UNAVAILABLE');

  await ensureBaseDir(baseDir, uid);
  const paths = buildPaths(baseDir);
  let temporaryDir;
  let promotions = 0;
  try {
    temporaryDir = await fs.mkdtemp(join(baseDir, '.prepare-'));
    await fs.chmod(temporaryDir, SOURCE_ACCESS.directoryMode);
    validateDirectoryStat(await lstatOrNull(temporaryDir), uid);
    const temporaryPrivate = join(temporaryDir, SOURCE_ACCESS.privateBasename);
    const invocation = {
      command: 'ssh-keygen',
      args: ['-q', '-t', 'ed25519', '-N', '', '-C', SOURCE_ACCESS.title, '-f', temporaryPrivate],
      shell: false,
      timeoutMs: SOURCE_ACCESS.localTimeoutMs,
      maxOutputBytes: SOURCE_ACCESS.maxOutputBytes,
    };
    let runnerResult;
    try {
      runnerResult = await runner(invocation);
    } catch (error) {
      if (error instanceof SourceAccessError) throw error;
      reason('SOURCE_ACCESS_RUNNER_FAILED');
    }
    validateRunnerResult(runnerResult);

    const temporaryPublic = `${temporaryPrivate}.pub`;
    validateGeneratedFileStat(await lstatOrNull(temporaryPrivate), uid);
    validateGeneratedFileStat(await lstatOrNull(temporaryPublic), uid);
    const privateContent = await fs.readFile(temporaryPrivate);
    const publicContent = await fs.readFile(temporaryPublic);
    const { fingerprint, publicLine } = validateKeyPair(privateContent, publicContent);
    await fs.chmod(temporaryPrivate, SOURCE_ACCESS.fileMode);
    await fs.chmod(temporaryPublic, SOURCE_ACCESS.fileMode);
    validateFileStat(await lstatOrNull(temporaryPrivate), uid);
    validateFileStat(await lstatOrNull(temporaryPublic), uid);
    const temporaryHandoff = join(temporaryDir, SOURCE_ACCESS.handoffBasename);
    await fs.writeFile(temporaryHandoff, handoffBytes(fingerprint, publicLine), { mode: SOURCE_ACCESS.fileMode, flag: 'wx' });
    await fs.chmod(temporaryHandoff, SOURCE_ACCESS.fileMode);
    validateFileStat(await lstatOrNull(temporaryHandoff), uid);

    const promotionsToMake = [
      [temporaryPrivate, paths.privateKey],
      [temporaryPublic, paths.publicKey],
      [temporaryHandoff, paths.handoff],
    ];
    for (let index = 0; index < promotionsToMake.length; index += 1) {
      const [from, to] = promotionsToMake[index];
      await options.hooks?.beforePromote?.({ paths, index });
      await destinationIsAbsent(to);
      await fs.rename(from, to);
      promotions += 1;
    }
    return closedResult(paths, fingerprint);
  } catch (error) {
    if (error instanceof SourceAccessError) throw error;
    reason('SOURCE_ACCESS_PREPARE_FAILED');
  } finally {
    if (temporaryDir && promotions === 0) await fs.rm(temporaryDir, { recursive: true, force: true });
  }
}

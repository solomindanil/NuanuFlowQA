import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaths, prepareSourceAccess } from '../../scripts/freeland-source-access/lib.mjs';

const execFile = promisify(execFileCallback);
const fixtureRoot = await fs.mkdtemp(join(tmpdir(), 'freeland-source-access-test-'));
const fixtureKey = join(fixtureRoot, 'fixture_ed25519');
const otherFixtureKey = join(fixtureRoot, 'other_fixture_ed25519');
let sshKeygenAvailable = true;

try {
  await execFile('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'FreelandQA read-only source checkout', '-f', fixtureKey]);
  await execFile('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'FreelandQA read-only source checkout', '-f', otherFixtureKey]);
} catch (error) {
  if (error.code === 'ENOENT') sshKeygenAvailable = false;
  else throw error;
}

const fixturePrivate = sshKeygenAvailable ? await fs.readFile(fixtureKey) : Buffer.alloc(0);
const fixturePublic = sshKeygenAvailable ? await fs.readFile(`${fixtureKey}.pub`, 'utf8') : '';
const otherFixturePublic = sshKeygenAvailable ? await fs.readFile(`${otherFixtureKey}.pub`, 'utf8') : '';
const fixtureFingerprint = sshKeygenAvailable ? fingerprintOf(fixturePublic) : '';

after(async () => fs.rm(fixtureRoot, { recursive: true, force: true }));

function fingerprintOf(publicMaterial) {
  const encoded = publicMaterial.trim().split(/\s+/)[1];
  return `SHA256:${createHash('sha256').update(Buffer.from(encoded, 'base64')).digest('base64').replace(/=$/, '')}`;
}

async function makeFixture() {
  const baseDir = await fs.mkdtemp(join(tmpdir(), 'freeland-source-access-case-'));
  await fs.chmod(baseDir, 0o700);
  return { baseDir, paths: buildPaths(baseDir) };
}

async function cleanFixture(fixture) {
  await fs.rm(fixture.baseDir, { recursive: true, force: true });
}

function fakeRunner({ behavior = 'success', calls = [] } = {}) {
  return async (request) => {
    calls.push(request);
    if (behavior === 'timeout') return { timedOut: true };
    if (behavior === 'overflow') return { overflow: true };
    if (behavior === 'signal') return { code: null, signal: 'SIGTERM' };
    if (behavior === 'exit') return { code: 1, signal: null };
    if (behavior === 'wrong-executable') return { code: 0, signal: null, executable: 'not-ssh-keygen' };
    if (behavior === 'throw') throw new Error('runner failed');
    const outputPath = request.args.at(-1);
    if (behavior === 'malformed') {
      await fs.writeFile(outputPath, 'not a private key', { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, 'ssh-ed25519 invalid fixture\n', { mode: 0o600 });
    } else if (behavior === 'mismatch') {
      await fs.writeFile(outputPath, fixturePrivate, { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, otherFixturePublic, { mode: 0o600 });
    } else if (behavior === 'non-ed25519') {
      await fs.writeFile(outputPath, fixturePrivate, { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, publicWithKeyLength('ssh-rsa', 32), { mode: 0o600 });
    } else if (behavior === '384-bit') {
      await fs.writeFile(outputPath, fixturePrivate, { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, publicWithKeyLength('ssh-ed25519', 48), { mode: 0o600 });
    } else if (behavior === '512-bit') {
      await fs.writeFile(outputPath, fixturePrivate, { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, publicWithKeyLength('ssh-ed25519', 64), { mode: 0o600 });
    } else {
      await fs.writeFile(outputPath, fixturePrivate, { mode: 0o600 });
      await fs.writeFile(`${outputPath}.pub`, fixturePublic, { mode: 0o600 });
    }
    return { code: 0, signal: null };
  };
}

function publicWithKeyLength(algorithm, keyLength) {
  const type = Buffer.from(algorithm);
  const blob = Buffer.alloc(8 + type.length + keyLength, 0x11);
  blob.writeUInt32BE(type.length, 0);
  type.copy(blob, 4);
  blob.writeUInt32BE(keyLength, 4 + type.length);
  return `${algorithm} ${blob.toString('base64')} FreelandQA read-only source checkout\n`;
}

function expectedResult(paths) {
  return {
    schemaVersion: 1,
    status: 'AWAITING_ADMIN',
    repository: 'nuanu-ai/freeland_app',
    title: 'FreelandQA read-only source checkout',
    fingerprint: fixtureFingerprint,
    handoffPath: paths.handoff,
  };
}

async function writeValidAwaiting(paths) {
  await fs.writeFile(paths.privateKey, fixturePrivate, { mode: 0o600 });
  await fs.writeFile(paths.publicKey, fixturePublic, { mode: 0o600 });
  await fs.writeFile(paths.handoff, [
    'repository=nuanu-ai/freeland_app',
    'title=FreelandQA read-only source checkout',
    'allowWrite=false',
    `fingerprint=${fixtureFingerprint}`,
    `publicKey=${fixturePublic.trim()}`,
    '',
  ].join('\n'), { mode: 0o600 });
  await fs.chmod(paths.privateKey, 0o600);
  await fs.chmod(paths.publicKey, 0o600);
  await fs.chmod(paths.handoff, 0o600);
}

async function snapshot(paths) {
  const names = ['privateKey', 'publicKey', 'handoff'];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, {
    content: await fs.readFile(paths[name]),
    stat: await fs.lstat(paths[name]),
  }])));
}

async function writePlaceholder(path) {
  await fs.writeFile(path, 'placeholder', { mode: 0o600 });
}

describe('prepareSourceAccess', () => {
  test('builds the fixed custody paths below the supplied root', () => {
    assert.deepEqual(buildPaths('/tmp/freelandqa-fixture'), {
      baseDir: '/tmp/freelandqa-fixture',
      privateKey: '/tmp/freelandqa-fixture/freeland_app_readonly_ed25519',
      publicKey: '/tmp/freelandqa-fixture/freeland_app_readonly_ed25519.pub',
      handoff: '/tmp/freelandqa-fixture/freeland_app_readonly_admin_handoff.txt',
      attestation: '/tmp/freelandqa-fixture/freeland_app_readonly_attestation.json',
    });
  });

  test('promotes an absent fixture to the closed administrator handoff state', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const fixture = await makeFixture();
    const calls = [];
    try {
      const result = await prepareSourceAccess({ baseDir: fixture.baseDir, runner: fakeRunner({ calls }) });
      assert.deepEqual(result, expectedResult(fixture.paths));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].command, 'ssh-keygen');
      assert.equal(calls[0].shell, false);
      assert.deepEqual(calls[0].args.slice(0, -1), [
        '-q', '-t', 'ed25519', '-N', '', '-C', 'FreelandQA read-only source checkout', '-f',
      ]);
      assert.equal(basename(calls[0].args.at(-1)), 'freeland_app_readonly_ed25519');
      for (const file of [fixture.paths.privateKey, fixture.paths.publicKey, fixture.paths.handoff]) {
        const stat = await fs.lstat(file);
        assert.equal(stat.isFile(), true);
        assert.equal(stat.nlink, 1);
        assert.equal(stat.mode & 0o777, 0o600);
      }
      const handoff = await fs.readFile(fixture.paths.handoff, 'utf8');
      assert.deepEqual(handoff.split('\n'), [
        'repository=nuanu-ai/freeland_app',
        'title=FreelandQA read-only source checkout',
        'allowWrite=false',
        `fingerprint=${fixtureFingerprint}`,
        `publicKey=${fixturePublic.trim()}`,
        '',
      ]);
      const privatePayloadCanary = fixturePrivate.toString('utf8').split('\n')[1];
      assert.equal(handoff.includes(privatePayloadCanary), false);
    } finally {
      await cleanFixture(fixture);
    }
  });

  test('rejects every non-empty partial subset without running a key generator', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const names = ['privateKey', 'publicKey', 'handoff', 'attestation'];
    for (let bits = 1; bits < 16; bits += 1) {
      if (bits === 7) continue;
      const fixture = await makeFixture();
      let calls = 0;
      try {
        for (let index = 0; index < names.length; index += 1) {
          if (bits & (1 << index)) await writePlaceholder(fixture.paths[names[index]]);
        }
        await assert.rejects(
          prepareSourceAccess({ baseDir: fixture.baseDir, runner: async () => { calls += 1; } }),
          { message: 'SOURCE_ACCESS_PARTIAL_STATE' },
        );
        assert.equal(calls, 0, `subset ${bits} must not call runner`);
      } finally {
        await cleanFixture(fixture);
      }
    }
  });

  test('replays an exact awaiting state byte-for-byte without running a key generator', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const fixture = await makeFixture();
    try {
      await writeValidAwaiting(fixture.paths);
      const before = await snapshot(fixture.paths);
      let calls = 0;
      const result = await prepareSourceAccess({ baseDir: fixture.baseDir, runner: async () => { calls += 1; } });
      const after = await snapshot(fixture.paths);
      assert.deepEqual(result, expectedResult(fixture.paths));
      assert.equal(calls, 0);
      assert.deepEqual(after, before);
    } finally {
      await cleanFixture(fixture);
    }
  });

  test('replays exact awaiting custody without requiring a generator runner', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const fixture = await makeFixture();
    try {
      await writeValidAwaiting(fixture.paths);
      assert.deepEqual(await prepareSourceAccess({ baseDir: fixture.baseDir }), expectedResult(fixture.paths));
    } finally {
      await cleanFixture(fixture);
    }
  });

  test('rejects unsafe existing custody entries before running a key generator', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    for (const scenario of ['symlink-directory', 'symlink-file', 'hard-link', 'wrong-mode', 'non-regular', 'wrong-uid']) {
      const fixture = await makeFixture();
      let calls = 0;
      try {
        if (scenario === 'symlink-directory') {
          const target = await fs.mkdtemp(join(tmpdir(), 'freeland-source-access-target-'));
          await fs.rm(fixture.baseDir, { recursive: true, force: true });
          await fs.symlink(target, fixture.baseDir);
        } else {
          await writeValidAwaiting(fixture.paths);
          if (scenario === 'symlink-file') {
            await fs.rm(fixture.paths.handoff);
            await fs.symlink(fixture.paths.publicKey, fixture.paths.handoff);
          }
          if (scenario === 'hard-link') {
            await fs.rm(fixture.paths.handoff);
            await fs.link(fixture.paths.publicKey, fixture.paths.handoff);
          }
          if (scenario === 'wrong-mode') await fs.chmod(fixture.paths.publicKey, 0o644);
          if (scenario === 'non-regular') {
            await fs.rm(fixture.paths.handoff);
            await fs.mkdir(fixture.paths.handoff);
          }
          if (scenario === 'wrong-uid') {
          await assert.rejects(
            prepareSourceAccess({ baseDir: fixture.baseDir, expectedUid: Number.MAX_SAFE_INTEGER, runner: async () => { calls += 1; } }),
              { message: /SOURCE_ACCESS_(DIRECTORY|CUSTODY)_INVALID/ },
            );
            assert.equal(calls, 0);
            continue;
          }
        }
        await assert.rejects(
          prepareSourceAccess({ baseDir: fixture.baseDir, runner: async () => { calls += 1; } }),
          { message: /SOURCE_ACCESS_(DIRECTORY|CUSTODY)_INVALID/ },
        );
        assert.equal(calls, 0);
      } finally {
        await cleanFixture(fixture);
      }
    }
  });

  test('rejects failing or unexpected generator outcomes and generated key material', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    for (const behavior of ['timeout', 'overflow', 'signal', 'exit', 'wrong-executable', 'throw', 'malformed', 'mismatch', 'non-ed25519', '384-bit', '512-bit']) {
      const fixture = await makeFixture();
      try {
        await assert.rejects(
          prepareSourceAccess({ baseDir: fixture.baseDir, runner: fakeRunner({ behavior }) }),
          { message: /SOURCE_ACCESS_(RUNNER|KEY)_/ },
          behavior,
        );
        for (const path of [fixture.paths.privateKey, fixture.paths.publicKey, fixture.paths.handoff]) {
          await assert.rejects(fs.lstat(path), { code: 'ENOENT' });
        }
      } finally {
        await cleanFixture(fixture);
      }
    }
  });

  test('rejects an awaiting handoff with a malformed fingerprint or extra field', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    for (const replacement of ['fingerprint=SHA256:invalid', 'unexpected=true']) {
      const fixture = await makeFixture();
      try {
        await writeValidAwaiting(fixture.paths);
        const handoff = await fs.readFile(fixture.paths.handoff, 'utf8');
        await fs.writeFile(fixture.paths.handoff, handoff.replace(`fingerprint=${fixtureFingerprint}`, replacement), { mode: 0o600 });
        await fs.chmod(fixture.paths.handoff, 0o600);
        await assert.rejects(
          prepareSourceAccess({ baseDir: fixture.baseDir }),
          { message: 'SOURCE_ACCESS_HANDOFF_INVALID' },
        );
      } finally {
        await cleanFixture(fixture);
      }
    }
  });

  test('fails closed when a destination appears before promotion and preserves a partial promotion for review', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const collision = await makeFixture();
    try {
      await assert.rejects(prepareSourceAccess({
        baseDir: collision.baseDir,
        runner: fakeRunner(),
        hooks: { beforePromote: async ({ paths, index }) => { if (index === 0) await writePlaceholder(paths.privateKey); } },
      }), { message: 'SOURCE_ACCESS_DESTINATION_COLLISION' });
      await assert.rejects(fs.lstat(collision.paths.publicKey), { code: 'ENOENT' });
      await assert.rejects(fs.lstat(collision.paths.handoff), { code: 'ENOENT' });
    } finally {
      await cleanFixture(collision);
    }

    const partial = await makeFixture();
    try {
      await assert.rejects(prepareSourceAccess({
        baseDir: partial.baseDir,
        runner: fakeRunner(),
        hooks: { beforePromote: async ({ paths, index }) => { if (index === 1) await writePlaceholder(paths.publicKey); } },
      }), { message: 'SOURCE_ACCESS_DESTINATION_COLLISION' });
      assert.equal((await fs.lstat(partial.paths.privateKey)).isFile(), true);
      assert.equal((await fs.lstat(partial.paths.publicKey)).isFile(), true);
      await assert.rejects(fs.lstat(partial.paths.handoff), { code: 'ENOENT' });
    } finally {
      await cleanFixture(partial);
    }
  });

  test('uses real ssh-keygen only inside a test temporary directory', { skip: !sshKeygenAvailable && 'ssh-keygen is unavailable locally' }, async () => {
    const fixture = await makeFixture();
    try {
      const runner = async ({ command, args }) => {
        assert.equal(command, 'ssh-keygen');
        await execFile(command, args);
        return { code: 0, signal: null };
      };
      const result = await prepareSourceAccess({ baseDir: fixture.baseDir, runner });
      assert.equal(result.fingerprint, fingerprintOf(await fs.readFile(fixture.paths.publicKey, 'utf8')));
      assert.match(await fs.readFile(fixture.paths.publicKey, 'utf8'), /^ssh-ed25519 /);
      for (const path of [fixture.paths.privateKey, fixture.paths.publicKey, fixture.paths.handoff]) {
        assert.equal((await fs.lstat(path)).mode & 0o777, 0o600);
      }
    } finally {
      await cleanFixture(fixture);
    }
  });
});

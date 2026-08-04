# Freeland Source-Access Self-Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and prove the least-privilege Freeland source-access package that unblocks the already-reviewed personal I0 gate without exposing key material or granting source-repository write access.

**Architecture:** A tracked Node.js ESM utility has two production commands. `prepare` performs the local, atomic transition from no source-access state to an administrator handoff; `verify` forces the generated identity through a bounded read and dry-run write-denial proof before creating the canonical attestation. Pure/injected library functions provide deterministic tests, while the production CLI fixes all identities and paths and emits closed machine-readable results.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, `child_process.spawn`, OpenSSH `ssh-keygen`, Git, existing TypeScript/Playwright repository verification.

## Global Constraints

1. The approved design at `docs/superpowers/specs/2026-08-04-freeland-source-access-self-bootstrap-design.md` is authoritative.
2. The production repository is exactly `nuanu-ai/freeland_app`, the deploy-key title is exactly `FreelandQA read-only source checkout`, and `Allow write access` must remain disabled.
3. Production paths are fixed under `/Users/danilsolomin/.config/freelandqa/source-access/`; the CLI accepts no path, repository, title, key-type, or permission overrides.
4. The custody directory is an owned, regular non-symlink directory with mode `0700`. Every key, handoff, and attestation file is owned, regular, non-symlink, single-link, and mode `0600`.
5. Never overwrite an existing file. Partial state, symlinks, hard links, wrong ownership, wrong modes, or ambiguous promotion stop closed and preserve evidence for review.
6. Private-key bytes never enter argv, stdout, stderr, Git, reports, handoffs, snapshots, exceptions, or test diagnostics. Public-key text is restricted to the `.pub` file and administrator handoff.
7. Child processes use `shell: false`, fixed argument vectors, bounded timeouts, a 1 MiB output cap, and closed errors. Terminate the process group on timeout or overflow.
8. `prepare` makes no network calls. `verify` performs exactly one bounded read check and one bounded dry-run write probe.
9. Network Git calls force the generated identity with `BatchMode=yes`, `IdentitiesOnly=yes`, `ForwardAgent=no`, and `StrictHostKeyChecking=yes`. Never use `accept-new` and never modify the user's agent, keychain, or `known_hosts`.
10. A successful write dry-run is a hard failure. Only an exact allowlisted deploy-key permission denial may support the read-only conclusion.
11. The attestation is canonical JSON with exactly `repository`, `title`, `fingerprint`, `readOnly`, and `allowWrite`, followed by one newline.
12. Automated tests never touch the production directory, contact GitHub, or mutate user-level SSH/Git configuration.
13. Execute implementation in an isolated `codex/` worktree because the main worktree contains unrelated owner changes.
14. The owner override authorizes only this reviewed utility. It does not authorize a PAT, source mirror, write-enabled key, or manual attestation.
15. Live actions are one-shot. An ambiguous live result requires read-only reconciliation, never automatic retry.

---

### Task 1: Build and Test the Atomic `prepare` Transition

**Files:**

- Create: `scripts/freeland-source-access/constants.mjs`
- Create: `scripts/freeland-source-access/lib.mjs`
- Create: `tests/freeland-source-access/prepare.test.mjs`

- [ ] **Step 1: Create the isolated implementation worktree**

Use `superpowers:using-git-worktrees`. Create a `codex/freeland-source-access-bootstrap` branch/worktree without modifying or cleaning the owner's dirty main worktree. Confirm its starting commit equals the plan commit.

- [ ] **Step 2: Write failing path and all-absent tests**

In `prepare.test.mjs`, import the future exports:

```js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaths, prepareSourceAccess } from '../../scripts/freeland-source-access/lib.mjs';
```

Use a test-owned temporary directory and an injected fake runner. Assert:

```js
assert.deepEqual(buildPaths('/tmp/freelandqa-fixture'), {
  baseDir: '/tmp/freelandqa-fixture',
  privateKey: '/tmp/freelandqa-fixture/freeland_app_readonly_ed25519',
  publicKey: '/tmp/freelandqa-fixture/freeland_app_readonly_ed25519.pub',
  handoff: '/tmp/freelandqa-fixture/freeland_app_readonly_admin_handoff.txt',
  attestation: '/tmp/freelandqa-fixture/freeland_app_readonly_attestation.json',
});
```

The all-absent case must expect only:

```js
{
  schemaVersion: 1,
  status: 'AWAITING_ADMIN',
  repository: 'nuanu-ai/freeland_app',
  title: 'FreelandQA read-only source checkout',
  fingerprint: fixtureFingerprint,
  handoffPath: fixturePaths.handoff,
}
```

Generate the test fingerprint from fixture public material in the test helper; do not use production or user keys.

- [ ] **Step 3: Run the focused tests and prove RED**

Run:

```bash
node --test tests/freeland-source-access/prepare.test.mjs
```

Expected: failure because the production modules/exports do not yet exist. Record the failure class, not any key bytes.

- [ ] **Step 4: Add fixed production constants**

Create `constants.mjs` with no environment-variable overrides:

```js
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SOURCE_ACCESS = Object.freeze({
  schemaVersion: 1,
  repository: 'nuanu-ai/freeland_app',
  repositorySsh: 'git@github.com:nuanu-ai/freeland_app.git',
  title: 'FreelandQA read-only source checkout',
  baseDir: join(homedir(), '.config', 'freelandqa', 'source-access'),
  privateBasename: 'freeland_app_readonly_ed25519',
  publicBasename: 'freeland_app_readonly_ed25519.pub',
  handoffBasename: 'freeland_app_readonly_admin_handoff.txt',
  attestationBasename: 'freeland_app_readonly_attestation.json',
  directoryMode: 0o700,
  fileMode: 0o600,
  localTimeoutMs: 10_000,
  networkTimeoutMs: 30_000,
  maxOutputBytes: 1024 * 1024,
});
```

- [ ] **Step 5: Implement minimal custody inspection and prepare behavior**

Export from `lib.mjs`:

```js
export class SourceAccessError extends Error {}
export function buildPaths(baseDir) {}
export async function inspectCustody(options) {}
export async function prepareSourceAccess(options) {}
```

Keep the two legal starting states explicit:

```js
const absent = !privateExists && !publicExists && !handoffExists && !attestationExists;
const awaiting = privateExists && publicExists && handoffExists && !attestationExists;

if (!absent && !awaiting) {
  throw new SourceAccessError('SOURCE_ACCESS_PARTIAL_STATE');
}
```

For the all-absent state:

1. Create/validate the owned mode-`0700` base directory.
2. Create a mode-`0700` temporary directory inside it.
3. Invoke the injected runner with `shell: false` and exactly:

```js
[
  '-q', '-t', 'ed25519', '-N', '',
  '-C', SOURCE_ACCESS.title,
  '-f', tempPrivatePath,
]
```

4. Validate a 256-bit Ed25519 private/public pair and identical canonical SHA-256 fingerprints without printing content.
5. Set generated files to `0600`.
6. Write a `0600` handoff containing exactly five newline-delimited fields: repository, title, `allowWrite=false`, fingerprint, and public key.
7. Atomically rename private key, public key, and handoff to fixed paths.
8. Remove the utility-owned temporary directory only before the first successful promotion. Preserve partial promotion for review.

The exact awaiting replay validates every byte and custody invariant, returns the same closed result, invokes no runner, and changes no file.

- [ ] **Step 6: Add adversarial prepare tests**

Cover at least:

- every non-empty partial subset of the four files;
- symlinked directory/file, hard-linked file, wrong uid, wrong mode, non-regular file;
- malformed key, non-Ed25519 key, 384/512-bit result, private/public mismatch, malformed fingerprint;
- runner timeout, output overflow, signal termination, non-zero exit, and unexpected executable behavior;
- handoff private-material canaries and an exact content allowlist;
- destination collision immediately before promotion;
- failure before first promotion versus failure after first promotion;
- idempotent awaiting replay with zero runner calls and unchanged stat/content snapshots.

Use injected file operations or synchronization hooks for collision/promotion tests rather than racing production paths.

- [ ] **Step 7: Add a local real-`ssh-keygen` integration test**

Generate only inside a test temporary directory. Assert Ed25519 256-bit output, matching fingerprints, exact modes, and no network calls. Skip with an explicit local-prerequisite reason only if `ssh-keygen` is unavailable.

- [ ] **Step 8: Prove GREEN and commit Task 1**

Run:

```bash
node --test tests/freeland-source-access/prepare.test.mjs
node --check scripts/freeland-source-access/constants.mjs
node --check scripts/freeland-source-access/lib.mjs
```

Expected: all focused tests pass and syntax checks are silent. Review the diff for secrets, then commit only the three Task 1 files with message `feat: add atomic Freeland source access prepare`.

---

### Task 2: Prove Read Access and Dry-Run Write Denial

**Files:**

- Modify: `scripts/freeland-source-access/lib.mjs`
- Create: `tests/freeland-source-access/verify.test.mjs`

- [ ] **Step 1: Write failing denial-classification tests**

Import future exports `verifySourceAccess` and `classifyWriteDenial`. Require `true` only for these anchored classes:

```js
const DEPLOY_KEY_DENIAL = /^ERROR: Permission to nuanu-ai\/freeland_app(?:\.git)? denied to deploy key\.\r?$/m;
const WRITE_ACCESS_DENIAL = /^ERROR: Write access to repository not granted\.\r?$/m;
```

Require `false` for authentication failure, host-key failure, connectivity errors, repository-not-found, branch protection, rulesets, timeout, signal termination, output overflow, generic permission text, text before/after a near match, and errors naming another repository.

- [ ] **Step 2: Write failing verify state-machine tests**

Use exact custody fixtures and an injected runner. Assert the runner sequence is:

1. bounded `git ls-remote` of the fixed SSH URL;
2. local `git init` in a temporary repository;
3. local fixed `git config user.name` and `user.email`;
4. an empty local commit;
5. bounded `git push --dry-run` to a unique non-default ref.

Assert the remote ref format is:

```js
`refs/heads/freelandqa-readonly-probe-${lowercaseHex24}`
```

Assert both remote calls force only the generated identity through an environment value equivalent to:

```text
ssh -i FIXED_PRIVATE_PATH -o BatchMode=yes -o IdentitiesOnly=yes -o ForwardAgent=no -o StrictHostKeyChecking=yes
```

The tests must compare structured invocation data without copying the private-key file or logging sensitive environment values.

- [ ] **Step 3: Run focused tests and prove RED**

Run:

```bash
node --test tests/freeland-source-access/verify.test.mjs
```

Expected: missing exports or behavior failures.

- [ ] **Step 4: Implement the minimal verify transition**

Implement:

```js
export function classifyWriteDenial(stderr) {}
export async function verifySourceAccess(options) {}
```

Required behavior:

- reject absent/partial/invalid local custody before any runner call;
- discard successful `ls-remote` output without returning/logging refs;
- use a cryptographically random 24-character lowercase hexadecimal suffix;
- treat dry-run exit status `0` as `SOURCE_WRITE_CAPABILITY_DETECTED`;
- accept only an allowlisted denial after the read succeeds;
- atomically write canonical attestation bytes with mode `0600`;
- return only `SOURCE_ACCESS_READY` plus fixed identity, fingerprint, and safe booleans;
- on exact attestation replay, make no network calls and change no bytes;
- on any differing attestation or custody state, stop without overwrite.

Canonical attestation construction must preserve the fixed key order:

```js
const attestation = {
  repository: SOURCE_ACCESS.repository,
  title: SOURCE_ACCESS.title,
  fingerprint,
  readOnly: true,
  allowWrite: false,
};
const bytes = `${JSON.stringify(attestation)}\n`;
```

- [ ] **Step 5: Add adversarial verify and disclosure tests**

Cover read failure, read timeout, write dry-run success, each allowlisted denial, every rejected error class, malformed output, runner overflow/signal/timeout, attestation collision, wrong exact JSON order/fields/value/newline, wrong mode/type/link/owner, and exact replay. Scan all captured outputs/errors for private-key and source-ref canaries.

- [ ] **Step 6: Prove GREEN and commit Task 2**

Run:

```bash
node --test tests/freeland-source-access/prepare.test.mjs tests/freeland-source-access/verify.test.mjs
node --check scripts/freeland-source-access/lib.mjs
```

Expected: all tests pass. Commit only `lib.mjs` and `verify.test.mjs` with message `feat: verify Freeland source access is read only`.

---

### Task 3: Add the Closed Production CLI and Personal-I0 Integration

**Files:**

- Create: `scripts/freeland-source-access/cli.mjs`
- Create: `tests/freeland-source-access/cli.test.mjs`
- Modify: `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md`

- [ ] **Step 1: Write failing CLI contract tests**

Export a `main({ argv, stdout, stderr, operations })` entry function and test it with injected in-memory I/O and operations. Add child-process smoke tests only for argument rejection paths that cannot touch custody state. Do not add production environment-variable hooks or alternate module loaders. Assert:

- exactly one positional command is accepted: `prepare` or `verify`;
- no flags or additional positionals are accepted;
- success produces exactly one canonical JSON line and no stderr;
- known failure produces exactly one closed JSON line:

```js
{
  schemaVersion: 1,
  status: 'SOURCE_ACCESS_FAIL',
  reason: allowlistedReason,
}
```

- unexpected errors map to `SOURCE_ACCESS_INTERNAL` with no raw message, stack, path, child output, or key material;
- failure exits non-zero, success exits zero;
- SIGINT/SIGTERM, timeout, and output-overflow cleanup do not leave a child process running;
- stdout/stderr never contain private/public key text, source refs, or raw GitHub/SSH diagnostics.

- [ ] **Step 2: Run CLI tests and prove RED**

Run:

```bash
node --test tests/freeland-source-access/cli.test.mjs
```

Expected: failure because `cli.mjs` does not exist.

- [ ] **Step 3: Implement the production runner and CLI**

Use `child_process.spawn` with `shell: false`, a detached process group where supported, fixed argv, sanitized environment, timeout, and a 1 MiB combined stdout/stderr cap. On timeout/overflow, terminate the whole process group and await closure before returning a closed error.

The CLI must:

```js
const [command, ...extra] = process.argv.slice(2);
if (!['prepare', 'verify'].includes(command) || extra.length !== 0) {
  // emit the closed usage reason and exit non-zero
}
```

Do not add an npm script and do not modify `package.json`; it already contains unrelated owner changes. Production invocation is the explicit command:

```bash
node /Users/danilsolomin/projectsnew/NuanuFlowQA/scripts/freeland-source-access/cli.mjs prepare
```

or:

```bash
node /Users/danilsolomin/projectsnew/NuanuFlowQA/scripts/freeland-source-access/cli.mjs verify
```

- [ ] **Step 4: Amend the personal I0 owner override without weakening gates**

In `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md`, replace exactly this obsolete sentence:

```text
This is not permission to synthesize the key or attestation.
```

with:

```text
Only the reviewed freeland-source-access utility may create the key or attestation under the owner's 2026-08-04 option-1 approval. Until it returns exact SOURCE_ACCESS_READY, Task 2 stops with NEEDS_CONTEXT and performs no mutation.
```

Preserve every existing Task 2 fingerprint, type, mode, link-count, fresh-preflight, single-session, and no-retry gate. Confirm the change does not authorize Task 2 to call `prepare` or `verify` implicitly.

- [ ] **Step 5: Run the complete local verification loop**

Run:

```bash
node --test tests/freeland-source-access/*.test.mjs
node --check scripts/freeland-source-access/constants.mjs
node --check scripts/freeland-source-access/lib.mjs
node --check scripts/freeland-source-access/cli.mjs
npm run typecheck
git diff --check -- scripts/freeland-source-access tests/freeland-source-access docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md
```

Also extract every fenced `bash` block changed in the personal I0 plan and run `bash -n` against each block. Expected: Node tests pass, syntax checks are silent, TypeScript passes, Bash fences parse, and diff-check is empty.

- [ ] **Step 6: Request review, fix findings, and commit Task 3**

Use `superpowers:requesting-code-review` against the approved design and this plan. Resolve all correctness, security, disclosure, test-isolation, and idempotence findings; rerun Step 5 after each material correction. Commit only the CLI, CLI tests, and personal-I0 plan amendment with message `feat: expose closed Freeland source access CLI`.

---

### Task 4: Execute the One-Shot Local Prepare Gate

**Files:**

- Runtime only: `/Users/danilsolomin/.config/freelandqa/source-access/`
- Evidence reference only: administrator handoff path returned by the CLI

- [ ] **Step 1: Re-prove the deterministic suite immediately before live action**

Run the full Task 3 Step 5 loop from the reviewed commit. Stop if the implementation worktree is dirty or any test fails.

- [ ] **Step 2: Prove the exact all-absent production precondition read-only**

Using `lstat`-equivalent checks, prove that these four paths are absent and reveal no file content:

```text
/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519
/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519.pub
/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_admin_handoff.txt
/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_attestation.json
```

If any path exists, stop closed and reconcile; do not call `prepare`.

- [ ] **Step 3: Run live `prepare` exactly once**

Run the reviewed absolute CLI command with the minimum elevation needed to write the fixed external directory. Do not pipe, tee, redirect, retry, or add shell tracing.

Expected exact state: `AWAITING_ADMIN`. Treat lost output, signal, timeout, or any other ambiguity as a stop requiring read-only reconciliation.

- [ ] **Step 4: Verify local postconditions without disclosing contents**

Prove:

- directory mode/type/owner are exact;
- private key, public key, and handoff are regular, non-symlink, single-link mode-`0600` files;
- private and public fingerprints match the closed returned fingerprint;
- attestation is absent;
- prepare caused zero GitHub/Git network calls;
- an immediate exact replay would be idempotent, but do not perform a second live run merely to demonstrate it.

- [ ] **Step 5: Hand off the public package and stop at the human boundary**

Report only the fixed handoff path, repository, title, fingerprint, and instruction `Allow write access disabled`. The administrator receives the handoff through the user's chosen secure channel. Do not paste the handoff into Git, task comments, logs, or chat unless the owner explicitly selects a secure destination.

The live phase remains `AWAITING_ADMIN` until an administrator confirms the exact repository/title/disabled-write registration. No GitHub mutation is performed by this task.

---

### Task 5: Execute the One-Shot Verify Gate and Resume Personal I0

**Files:**

- Runtime: `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_attestation.json`
- Modify only after successful verification: the existing private I0 evidence ledger selected by `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md`

- [ ] **Step 1: Capture the administrator's exact confirmation and reconcile custody**

Require an unambiguous statement that the key was registered on `nuanu-ai/freeland_app` with title `FreelandQA read-only source checkout` and `Allow write access` disabled. Re-run only local read-only custody and fingerprint checks. If the statement is ambiguous or custody drifted, stop.

- [ ] **Step 2: Re-prove deterministic verification before network action**

Run the complete Task 3 Step 5 loop. Confirm the reviewed commit/worktree is unchanged and the attestation remains absent.

- [ ] **Step 3: Run live `verify` exactly once**

Run the reviewed absolute CLI command with the minimum elevation required to read custody files and create the attestation. Do not pipe, tee, redirect, retry, or enable shell tracing.

Expected exact state: `SOURCE_ACCESS_READY`. A successful dry-run, unknown denial, network ambiguity, lost output, timeout, or signal stops closed. Do not repeat the live verification automatically.

- [ ] **Step 4: Prove the closed attestation postcondition**

Without printing the private/public key or raw network output, prove the attestation is an owned, regular, non-symlink, single-link mode-`0600` file with exactly five fields and one trailing newline:

```json
{"repository":"nuanu-ai/freeland_app","title":"FreelandQA read-only source checkout","fingerprint":"RUNTIME_CANONICAL_SHA256_FINGERPRINT","readOnly":true,"allowWrite":false}
```

`RUNTIME_CANONICAL_SHA256_FINGERPRINT` denotes the runtime value that must match both key files; it is not literal attestation content. Confirm the returned safe booleans show read success, dry-run denial, and attestation match.

- [ ] **Step 5: Append bounded evidence and regenerate the personal-I0 Task 2 brief**

Record only allowed evidence: closed result code, fixed repository/title, public fingerprint, safe booleans, operation counts, timestamps, and the administrator residual-trust statement. Do not record raw refs, source SHAs, filenames/content, keys, child diagnostics, or GitHub responses.

Regenerate the Task 2 execution brief from the existing personal-I0 plan. The first Task 2 action remains a fresh read-only preflight proving Actions disabled, named secret count zero, and Actions run count zero before any mutation.

- [ ] **Step 6: Resume personal I0 under its own reviewed execution plan**

Use `superpowers:subagent-driven-development` for the personal-I0 Task 2 sequence. The bootstrap does not itself write an Actions secret, enable Actions, dispatch workflows, create the source worktree, or alter the organization repository.

- [ ] **Step 7: Final verification and branch integration**

After implementation commits and before merge, use `superpowers:verification-before-completion`, rerun the full deterministic suite from a clean branch, inspect the final diff against the plan commit, and use `superpowers:finishing-a-development-branch`. Never merge or clean the owner's main worktree implicitly.

## Acceptance Criteria

1. `prepare` has only the exact absent-to-`AWAITING_ADMIN` transition and exact idempotent replay; every other state fails closed.
2. `verify` proves read access with the generated identity, rejects successful write dry-run, accepts only an allowlisted denial, and creates the canonical attestation atomically.
3. Every custody, timeout, output-cap, disclosure, atomicity, and error-class invariant has deterministic regression coverage, including a no-network real-`ssh-keygen` test.
4. The production CLI has no security-sensitive overrides and emits only canonical closed JSON.
5. The personal-I0 amendment authorizes only the reviewed utility and preserves every existing pre-mutation gate.
6. The one unavoidable administrator action is explicit, minimal, and bounded to installing the public read-only deploy key.
7. After exact `SOURCE_ACCESS_READY`, personal I0 resumes from a fresh zero-mutation preflight; no source-access step silently broadens repository authority.

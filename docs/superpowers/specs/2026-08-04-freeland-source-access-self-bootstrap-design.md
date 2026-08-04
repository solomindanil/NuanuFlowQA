# Freeland Source-Access Self-Bootstrap Design

**Status:** Owner-selected design option 1 on 2026-08-04; written specification awaiting final owner review
**Date:** 2026-08-04
**Scope:** Least-privilege creation and validation of the source-access package required by the Freeland personal I0 gate

## Objective

Create the missing Freeland source-access package locally without exposing private
key material or replacing the reviewed read-only deploy-key model. Automation owns
key generation, custody validation, fingerprinting, handoff creation, read-access
verification, attestation creation, and resumption of the personal I0 gate. A source
repository administrator performs the one operation that the current operator cannot:
registering the generated public key on `nuanu-ai/freeland_app` with write access
disabled.

The current authenticated GitHub user is exactly `solomindanil`. A live read-only
permission audit on 2026-08-04 returned `MAINTAIN` for
`nuanu-ai/freeland_app`; deploy-key inventory access was denied. The design therefore
must not claim that this operator can create or inspect the repository deploy-key
record.

## Fixed Identities and Paths

- Source repository: `nuanu-ai/freeland_app`
- Deploy-key title: `FreelandQA read-only source checkout`
- Required setting: `Allow write access` disabled
- Private key:
  `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519`
- Public-key handoff:
  `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519.pub`
- Administrator handoff:
  `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_admin_handoff.txt`
- Final five-field attestation:
  `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_attestation.json`
- Local directory mode: exact `0700`
- Private key, public key, handoff, and attestation modes: exact `0600`
- Key algorithm: Ed25519
- Attestation has exactly five fields: `repository`, `title`, `fingerprint`,
  `readOnly`, and `allowWrite`.
- `repository`, `title`, `readOnly`, and `allowWrite` equal the fixed values above.
- `fingerprint` matches `^SHA256:[A-Za-z0-9+/]{43}$` and byte-equals the SHA-256
  fingerprint derived from the generated private and public key files.

## Chosen Architecture

### 1. Tracked bootstrap utility, private runtime state

Add a small Node.js utility under `scripts/freeland-source-access/` with two closed
commands:

- `prepare` creates the local keypair and administrator handoff;
- `verify` validates the registered key, proves the safe access boundary as far as the
  current permission model allows, and atomically creates the final attestation.

The utility accepts no repository, title, filesystem-root, key-type, or permission
arguments in production. All security-sensitive identities are constants. Tests call
exported functions with injected temporary roots and process runners; the production
CLI always uses the fixed paths above.

No key, public-key handoff, attestation, temporary key directory, GitHub response, or
source content is committed. The repository contains only implementation and tests.

### 2. Atomic `prepare` transition

`prepare` recognizes only two valid starting states:

1. all four external files are absent; or
2. the private key, public key, and handoff are already exact while the attestation is
   absent, in which case it returns the existing closed `AWAITING_ADMIN` state without
   regenerating anything.

Every partial, symlinked, hard-linked, wrongly owned, or wrong-mode state is rejected.
Existing files are never overwritten.

For an absent state, the utility:

1. creates or validates the fixed parent directory as an owned, non-symlink directory
   with mode `0700`;
2. creates a mode-`0700` temporary directory inside that parent;
3. invokes `ssh-keygen` without a shell to generate an Ed25519 key with no passphrase
   and the exact deploy-key title as its comment;
4. validates regular-file type, link count, modes, algorithm, public/private
   agreement, and a canonical `SHA256:` fingerprint;
5. changes both generated files to mode `0600`;
6. writes a mode-`0600` handoff containing only repository, title, `allowWrite=false`,
   fingerprint, and the public key;
7. atomically promotes the private key, public key, and handoff to their fixed paths;
8. emits only a closed result containing `AWAITING_ADMIN`, fingerprint, and handoff
   path.

The private key is never sent to stdout/stderr, placed in the handoff, copied into the
QA repository, or passed as a command-line value. If generation fails before atomic
promotion, only the utility-owned temporary directory may be removed. An ambiguous or
partial promotion is preserved and reported for review rather than retried.

### 3. Single administrator handoff

The administrator receives only the public handoff and performs exactly this action:

1. open repository `nuanu-ai/freeland_app`;
2. add a deploy key titled `FreelandQA read-only source checkout`;
3. paste the supplied Ed25519 public key;
4. leave `Allow write access` disabled;
5. confirm completion.

No private key, attestation, GitHub token, Actions secret, repository archive, or
source file is transferred. Duplicate title or fingerprint, a write-enabled key, an
unexpected repository, or an ambiguous administrator response stops the process.

The present `MAINTAIN` permission cannot read deploy-key metadata. Consequently, the
administrator-controlled title and checkbox remain an explicit residual trust
boundary. If the operator later receives `ADMIN`, `verify` additionally requires the
GitHub API record to contain exactly one matching title/fingerprint with
`read_only=true` before it may attest.

### 4. Fail-closed `verify` transition

`verify` requires exact local custody, then forces SSH to use only the generated key:
agent forwarding is disabled, `IdentitiesOnly=yes` and `BatchMode=yes` are required,
and no fallback identity may satisfy the request.

The command first performs a bounded `git ls-remote` against the exact source
repository. Raw refs and source data are discarded. It then performs a bounded
`git push --dry-run` of a unique non-default probe ref from an isolated temporary
repository. A successful dry-run means write capability may exist and is a hard
failure. A denial is accepted only after read access succeeded and the denial matches
the closed permission-denied class; connectivity, host-key, repository, authentication,
timeout, rules-engine, or unknown errors are not reclassified as read-only proof.
No ref is created because the probe is dry-run only.

The functional denial supplements, but does not replace, the administrator's explicit
read-only confirmation. With current `MAINTAIN` access, this is the strongest
automation-verifiable boundary available without broadening credentials. The private
I0 evidence records this residual limitation rather than claiming API-level deploy-key
inspection.

Only after the read check and dry-run denial pass does `verify` atomically create the
exact five-field attestation with mode `0600`, regular-file type, and single-link
custody. Re-running `verify` is idempotent only when every byte and custody invariant
already matches; otherwise it stops without overwrite.

### 5. Personal I0 integration

The personal I0 plan receives a reviewed owner-override amendment replacing its
previous prohibition on synthesizing the key/attestation. That amendment does not
weaken any later source-access check. Task 2 may resume only after:

- `prepare` is complete;
- the administrator confirms the exact read-only registration;
- `verify` creates the attestation;
- the existing Task 2 fingerprint, mode, type, and link-count checks pass;
- a fresh read-only repository preflight still proves Actions disabled, secret count
  zero, and run count zero.

Only then may Task 2 write the Actions secret, enable Actions, or dispatch Baseline and
Patchset. The self-bootstrap never performs those I0 mutations itself.

## State Machine

```text
ABSENT
  -> LOCAL_PREPARE_IN_PROGRESS
  -> AWAITING_ADMIN
  -> SOURCE_READ_ONLY_PROVEN
  -> SOURCE_ACCESS_READY
  -> PERSONAL_I0_READY
```

Any unexpected file, permission mismatch, fingerprint drift, key mismatch, duplicate
registration, write-capability signal, unknown SSH/Git error, timeout, GitHub state
drift, or Task 2 preflight drift transitions to a closed failure state. There is no
automatic destructive recovery and no automatic external-write retry.

## Evidence and Non-Disclosure

Safe evidence may contain only:

- closed state/result code;
- fixed repository and title;
- public fingerprint;
- fixed public handoff path;
- booleans for custody, read success, dry-run write denial, and attestation match;
- bounded operation counts and timestamps.

Evidence must not contain private-key bytes, private-key-derived public material beyond
the public fingerprint, public-key text outside the dedicated handoff, GitHub tokens,
SSH diagnostics, raw refs, source commit IDs, source filenames/content, Actions secret
values, or raw GitHub responses.

## Testing Strategy

Use Node's built-in test runner with a temporary root and injected process runner. Unit
tests cover:

- all-absent prepare and exact idempotent `AWAITING_ADMIN` replay;
- refusal of partial state, overwrite, symlink, hard link, wrong owner, and wrong mode;
- exact `ssh-keygen` argument vector without a shell;
- Ed25519 and fingerprint validation, including malformed and mismatched keys;
- atomic promotion and cleanup limited to pre-promotion temporary state;
- handoff content allowlist and private-material canaries;
- forced-identity SSH/Git arguments and timeout propagation;
- read failure, write dry-run success, expected permission denial, and every unknown
  denial/error class;
- exact attestation bytes, mode, type, link count, and idempotent replay;
- output/log scanning proving private material and source data never appear.

A local integration test uses real `ssh-keygen` only inside a temporary directory and
never contacts GitHub. The live acceptance is one bounded `prepare`, one administrator
registration, one bounded `verify`, and the existing personal I0 preflight. No live
step is automatically repeated after an ambiguous result.

## Rejected Alternatives

### Temporary `ADMIN`

Temporary `ADMIN` would let automation create and inspect the deploy-key record through
the API, but grants materially broader repository authority than the single required
operation. It remains a fallback only if the administrator cannot perform the handoff.

### PAT or existing user SSH identity

A PAT or user SSH key would grant broader, user-coupled access and would be harder to
prove read-only. It would also replace the approved deploy-key model and increase the
blast radius of an Actions secret. It is rejected.

### Private source mirror or vendoring

Copying `freeland_app` into the personal QA repository would duplicate private source,
break source provenance, create synchronization drift, and broaden the repository
bridge. It is rejected.

## Success Criteria

This design is complete when:

1. the tracked utility and deterministic tests pass review;
2. local custody reaches exact `AWAITING_ADMIN` without private-material disclosure;
3. the administrator registers the exact public key with write access disabled;
4. bounded verification proves source read access and no detectable write capability;
5. the exact five-field attestation is created and matches the private-key fingerprint;
6. the existing personal I0 Task 2 resumes from a fresh pristine remote preflight;
7. all source bootstrap evidence remains private, bounded, and free of source or secret
   content.

`SOURCE_ACCESS_READY` is not `PERSONAL_I0_READY`, release acceptance, payment
permission, or organization delivery. Those remain governed by their existing plans.

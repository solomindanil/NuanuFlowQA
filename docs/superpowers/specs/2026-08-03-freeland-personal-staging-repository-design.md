# Freeland Personal Staging Repository Bridge Design

**Status:** Approved by the owner on 2026-08-04
**Date:** 2026-08-03
**Scope:** Repository bootstrap and delivery routing for the existing Freeland CDP I0/I1 plan

## Objective

Unblock FreelandQA I0/I1 development while the operator has only `WRITE` access to
`nuanu-ai/FreelandQA`. A new private repository owned by the operator becomes a
temporary execution environment. Completed work returns to the existing organization
repository as a feature branch and pull request; the temporary repository never
replaces the organization repository and is never presented as final organization
delivery evidence.

The temporary repository is exactly `solomindanil/FreelandQA-I1`. The existing
`solomindanil/FreelandQA` redirect is left untouched.

## Fixed Identities

The organization source remains:

- repository: `nuanu-ai/FreelandQA`;
- repository ID: `1319799876`;
- entry branch and commit:
  `main@a4df0c5e4b57dfda3ed658171452cccda6095d52`;
- current operator permission: `WRITE`;
- role: final integration target.

The personal staging repository is:

- repository: `solomindanil/FreelandQA-I1`;
- visibility: private from creation onward;
- default branch: `main` after the seed push;
- automatic merge: disabled;
- owner permission: exact `ADMIN` read back after creation;
- repository ID: captured from GitHub after creation and then treated as immutable;
- role: provisional I0/I1 execution environment only.

The authoritative organization publication checkout remains unchanged at
`/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-publication`.
Personal bootstrap and `main` observation use a separate clone at
`/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication`.
Implementation uses its linked feature worktree at
`/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1`.
Changing the organization checkout's `origin` is forbidden.

## Chosen Architecture

### 1. Private bootstrap before code transfer

The personal repository is created empty and private, without a README, license,
template, or generated initial commit. GitHub Actions is immediately disabled and its
disabled state is read back before any repository code is pushed.

This ordering is required because both existing workflows run on a push to `main`.
Disabling Actions prevents the seed push from creating an uncontrolled Baseline run or
a Patchset failure before the deploy-key secret exists.

The bootstrap then pushes only the exact organization entry history ending at
`a4df0c5e4b57dfda3ed658171452cccda6095d52` to personal `main`. It does not push
feature branches, tags, pull-request refs, secrets, artifacts, Actions logs, or local
SDD workspace files. A post-push read verifies the new repository ID, private
visibility, exact `main` SHA, default branch, disabled automatic merge, and disabled
Actions state.

No bootstrap operation is automatically retried. If a response is ambiguous, the
harness performs read-only reconciliation and stops for human review.

### 2. Personal I0 gate

After bootstrap, the existing Free-safe I0 gate is specialized to the captured
personal repository identity. The local source deploy key and its closed five-field
read-only attestation remain mandatory. Their paths, permissions, fingerprint match,
and non-disclosure rules do not change.

The Actions secret is written only after every repository and source-access check
passes. Actions is enabled only after the secret metadata is read back exactly once.
The Baseline and Patchset workflows are then dispatched and selected using independent
bounded windows, exact event and `main` SHA matching, exhaustive pagination, and
unchanged repository snapshots.

Personal I0 evidence is explicitly marked `personal-staging`. It authorizes Tasks 2–15
to proceed but cannot satisfy final organization integration or release evidence.

### 3. Isolated implementation

Tasks 2–15 run only in
`/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1`
on branch `codex/freeland-agent-first-cdp-i1`. Existing product worktrees, the personal
`main` clone, and the organization publication checkout are read-only references. All
original I1 constraints remain in force: no Freeland mutations, payments, ticket
routing, Telegram operations, raw CDP exposure, credential persistence, or automatic
merge.

Deterministic CI and local acceptance produce provisional personal evidence. Every
record includes the captured personal repository ID and exact commit so that it cannot
be confused with organization evidence.

### 4. Organization return bridge

After Tasks 2–15 and their reviews pass, the harness fetches the current
`nuanu-ai/FreelandQA/main` without changing either repository. If organization `main`
is no longer the expected base, the bridge stops and requires a separately reviewed
rebase or replay plan; it never force-pushes or silently changes provenance.

With an unchanged base, the exact reviewed feature branch is pushed to
`nuanu-ai/FreelandQA` under `codex/freeland-agent-first-cdp-i1`, and a pull request is
opened against `main`. The branch push and PR creation are the only organization writes
in this bridge. Automatic merge, direct `main` push, branch protection changes, branch
deletion, and merge are forbidden.

Final organization I0 and delivery evidence must be collected against
`nuanu-ai/FreelandQA` after an administrator grants the required secret-management
access and the organization workflows pass on the exact reviewed commit. Until that
happens, the result is `READY_FOR_ORG_VALIDATION`, not delivered or ready to merge.
The final merge remains a human action.

## Evidence Separation

The following evidence classes are never interchangeable:

| Evidence | Repository identity | Meaning |
|---|---|---|
| Bootstrap receipt | `solomindanil/FreelandQA-I1` | Private repository was created and seeded safely |
| Personal I0 record | `solomindanil/FreelandQA-I1` | Tasks 2–15 may execute provisionally |
| Personal I1 acceptance | `solomindanil/FreelandQA-I1` | Reviewed feature implementation passed temporary CI |
| Organization I0 record | `nuanu-ai/FreelandQA` | Final target repository and secret/workflow gate passed |
| Organization delivery receipt | `nuanu-ai/FreelandQA` | Exact PR head is eligible for human integration |

Schemas and renderers reject owner, repository ID, role, or commit mismatches rather
than translating one evidence class into another.

## Failure Handling

- Repository creation returning an error or an unexpected existing repository stops
  before any push.
- A repository that is public, has automatic merge enabled, lacks exact owner `ADMIN`,
  or reports an unexpected ID is rejected.
- Failure to prove Actions disabled stops before the seed push.
- A seed-push failure is reconciled by reading personal `main`; it is never blindly
  repeated or force-pushed.
- Missing source-access files, incorrect mode, fingerprint drift, or missing read-only
  attestation stops before the secret write.
- Failure after a secret write or workflow dispatch preserves partial state and stops;
  the operation is not repeated automatically.
- Organization base drift, missing organization access, or failed organization CI
  leaves the reviewed personal branch intact and reports the exact blocker.
- The personal repository is never automatically deleted. Cleanup is a separate human
  decision after successful organization integration and evidence retention.

## Verification

Before personal repository creation, the organization checkout must be clean at the
entry commit and `npm run verify:deterministic` must pass. The already observed
2026-08-03 run of 504 tests with zero failures is historical evidence; the bootstrap
plan requires a fresh bounded verification before its first external write.

Bootstrap verification proves:

1. the old `solomindanil/FreelandQA` redirect was not replaced;
2. the personal repository is private and uniquely identified;
3. Actions was disabled before the first code push;
4. personal `main` equals the exact entry commit;
5. no unplanned workflow run was created by the seed push;
6. automatic merge remains disabled.

Personal I0/I1 uses the existing deterministic, secret-scanning, immutable-patchset,
and exact-run-selection gates. The final bridge additionally verifies the organization
base, exact feature-branch tree, PR head SHA, no direct `main` update, and distinct
organization I0 and delivery receipts.

## Out of Scope

This bridge does not transfer or replace the organization repository, change its plan,
make either repository public, enable protected branches, grant organization roles,
merge a pull request, delete a repository, or broaden the Freeland CDP I0/I1 product
scope. Product payments and the later autonomous Nuanu QA loop remain governed by
their separate plans.

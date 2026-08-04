# Freeland Personal I0 Entry-Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task, `superpowers:using-git-worktrees` before Task 2 worktree creation, and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Convert the safely bootstrapped private `solomindanil/FreelandQA-I1` repository into a proven `personal-staging` I0 execution environment by preserving the bootstrap receipt, installing the closed read-only source secret, enabling Actions in the required order, selecting exact successful Baseline/Patchset runs, and creating the isolated I1 feature worktree.

**Architecture:** Task 1 is a read-only reconciliation and local custody phase. It moves no remote state and remains independently useful even while the source key is unavailable. Task 2 is one fail-closed operator session: validate the source key and five-field attestation before any mutation, then write the secret, enable Actions, dispatch each workflow once, select one exact-SHA success per independent bounded window, create the personal feature worktree, and close a private observation bundle. Every permitted operation is surrounded by a snapshot of both the personal staging repository and the unchanged organization target.

**Tech Stack:** GitHub CLI 2.x, Git, Bash, Node.js, macOS Keychain authentication, GitHub REST and GraphQL APIs.

## Fixed Inputs

- Approved design: `docs/superpowers/specs/2026-08-03-freeland-personal-staging-repository-design.md`
- Approved design commit: `2836a90247151f967f6189af258d6d2ec259601b`
- Approved design SHA-256: `7ba95d51f79a52cd1621cb52a354b7277e92e65020dd2cf4f5ff170466c2408e`
- Bootstrap plan commit: `7dd4ac7ff0c318cdeb32a327432f396db8b08a87`
- Bootstrap receipt: `/private/tmp/freeland-personal-bootstrap.8rtwwW/receipt.v1.json`
- Bootstrap receipt SHA-256: `991f07ac9e11533c99b7605cd069bfe866055ea479578f088a270e98b4e4ec58`
- Personal repository: `solomindanil/FreelandQA-I1`, database ID `1322022755`, role `personal-staging`
- Organization repository: `nuanu-ai/FreelandQA`, database ID `1319799876`, role `final-integration-target`
- Exact entry commit: `a4df0c5e4b57dfda3ed658171452cccda6095d52`
- Personal publication clone: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication`
- Personal I1 feature worktree: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1`
- Personal I1 feature branch: `codex/freeland-agent-first-cdp-i1`
- Source key: `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519`
- Source attestation: `/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_attestation.json`
- Actions secret: `FREELAND_SOURCE_DEPLOY_KEY`

## Global Constraints

1. The personal repository is provisional infrastructure only. This plan never changes, pushes, branches, opens a PR in, merges, or alters settings on `nuanu-ai/FreelandQA`.
2. Task 1 performs read-only GitHub calls and local gitignored evidence custody only. It does not write a secret, enable Actions, dispatch a workflow, create a branch, or create a worktree.
3. Task 2 may begin only if Task 1 passed and both source-access files exist as regular, non-symlink, single-link mode-`0600` files with a matching closed five-field attestation.
4. All Task 2 steps run in one persistent elevated Bash shell with macOS Keychain and network access. If that shell is lost after the secret-write request begins, stop for read-only human reconciliation. Do not start a replacement mutation session.
5. The only remote writes are exactly, in order: `repository-secret-write`, `actions-enable`, `baseline-workflow-dispatch`, `patchset-workflow-dispatch`. Each write is issued once and never automatically retried.
6. Actions remains disabled until the secret metadata is read back with exactly one matching name. Enabling Actions must not create a run; both workflows are then dispatched exactly once.
7. Workflow selection uses exhaustive pagination, a global pre-window maximum run ID, an independent canonical UTC window per workflow, exact `workflow_dispatch`, exact entry SHA, exactly one match, overall `success`, and exactly one required successful job.
8. Required jobs are `deterministic` for `baseline.yml` and `immutable-base` for `patchset.yml`.
9. No workflow log, token, private-key bytes, public-key derivation, credential-helper response, cookie, password, PAN, CVV, checkout URL, or provider payload may be printed or persisted.
10. No branch protection, automatic merge, direct `main` update, force-push, tag push, branch deletion, PR, merge, rerun, cancellation, repository deletion, or source-product operation is allowed.
11. Every operation record contains an exact before/after bridge snapshot. Organization snapshots must remain byte-identical. Personal snapshots may change only from `actionsEnabled:false` to `actionsEnabled:true` during `actions-enable`; all identity, visibility, permission, branch, SHA, and automatic-merge fields remain exact.
12. Any timeout, ambiguity, duplicate run, unexpected run, failed job, repository drift, key drift, source-attestation drift, receipt mismatch, secret-metadata mismatch, or worktree collision stops without cleanup or retry.
13. The private receipt and observation bundle remain under the gitignored personal clone `evidence/private/personal-i0/`, with directories mode `0700` and files mode `0600`. Neither file is staged or committed.
14. Completion means `PERSONAL_I0_READY`. It authorizes provisional Tasks 2–15 planning/implementation only; it is not organization I0, delivery, release acceptance, or permission to test payments.

## Target Outputs

- Durable bootstrap copy: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/bootstrap-receipt.v1.json`
- Private I0 bundle: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/personal-i0-observations.v1.json`
- Feature worktree: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1`
- Feature branch: `codex/freeland-agent-first-cdp-i1`
- Remote personal state: private exact `main`, automatic merge off, Actions on, secret metadata present exactly once, exact Baseline/Patchset successes
- Remote organization state: unchanged
- No tracked source-file changes in either publication clone

---

### Task 1: Preserve the Bootstrap Receipt and Reconcile Read-Only State

**Files:**

- Read: `/private/tmp/freeland-personal-bootstrap.8rtwwW/receipt.v1.json`
- Create ignored: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/bootstrap-receipt.v1.json`
- Read remote only: personal/organization repository metadata, secret names, Actions permissions, workflow-run inventory, branches, tags, PRs, and deploy keys

**Interfaces:**

- **Consumes:** the exact bootstrap receipt/hash and clean personal publication clone.
- **Produces:** a durable byte-identical receipt copy and fresh proof that the bootstrap boundary still holds.
- **Expected completion:** `BOOTSTRAP_CUSTODY_READY`; Task 1 is complete even if the source key is absent.

- [ ] **Step 1: Fail closed on local receipt and publication-clone identity**

Run from the personal publication clone:

```bash
set -euo pipefail
PERSONAL_REPOSITORY="solomindanil/FreelandQA-I1"
PERSONAL_REPOSITORY_ID="1322022755"
ORGANIZATION_REPOSITORY="nuanu-ai/FreelandQA"
ORGANIZATION_REPOSITORY_ID="1319799876"
ENTRY_COMMIT="a4df0c5e4b57dfda3ed658171452cccda6095d52"
PERSONAL_PUBLICATION_ROOT="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication"
BOOTSTRAP_RECEIPT_SOURCE="/private/tmp/freeland-personal-bootstrap.8rtwwW/receipt.v1.json"
BOOTSTRAP_RECEIPT_SHA256="991f07ac9e11533c99b7605cd069bfe866055ea479578f088a270e98b4e4ec58"
PRIVATE_I0_DIR="$PERSONAL_PUBLICATION_ROOT/evidence/private/personal-i0"
BOOTSTRAP_RECEIPT_DURABLE="$PRIVATE_I0_DIR/bootstrap-receipt.v1.json"
export PERSONAL_REPOSITORY PERSONAL_REPOSITORY_ID ORGANIZATION_REPOSITORY
export ORGANIZATION_REPOSITORY_ID ENTRY_COMMIT PERSONAL_PUBLICATION_ROOT
export BOOTSTRAP_RECEIPT_SOURCE BOOTSTRAP_RECEIPT_SHA256 PRIVATE_I0_DIR
export BOOTSTRAP_RECEIPT_DURABLE

test "$(pwd -P)" = "$PERSONAL_PUBLICATION_ROOT"
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git remote get-url origin)" = "https://github.com/solomindanil/FreelandQA-I1.git"
test "$(git check-ignore evidence/private/personal-i0/bootstrap-receipt.v1.json)" = "evidence/private/personal-i0/bootstrap-receipt.v1.json"
test ! -e "$PERSONAL_PUBLICATION_ROOT/evidence"
test -f "$BOOTSTRAP_RECEIPT_SOURCE"
test ! -L "$BOOTSTRAP_RECEIPT_SOURCE"
test "$(stat -f '%Lp' "$BOOTSTRAP_RECEIPT_SOURCE")" = "600"
test "$(stat -f '%l' "$BOOTSTRAP_RECEIPT_SOURCE")" = "1"
test "$(shasum -a 256 "$BOOTSTRAP_RECEIPT_SOURCE" | awk '{print $1}')" = "$BOOTSTRAP_RECEIPT_SHA256"
test ! -e "$BOOTSTRAP_RECEIPT_DURABLE"

node -e '
  const fs=require("node:fs");
  const value=JSON.parse(fs.readFileSync(process.env.BOOTSTRAP_RECEIPT_SOURCE,"utf8"));
  const expectedOps=["repository-create","actions-disable","seed-main","personal-clone-create"];
  if(value.schemaVersion!==1||value.status!=="PERSONAL_BOOTSTRAP_READY"
    ||value.repositoryRole!=="personal-staging"
    ||value.designCommit!=="2836a90247151f967f6189af258d6d2ec259601b"
    ||value.designSha256!=="7ba95d51f79a52cd1621cb52a354b7277e92e65020dd2cf4f5ff170466c2408e"
    ||value.source?.repository!==process.env.ORGANIZATION_REPOSITORY
    ||value.source?.repositoryId!==Number(process.env.ORGANIZATION_REPOSITORY_ID)
    ||value.source?.entryCommit!==process.env.ENTRY_COMMIT
    ||value.target?.repository!==process.env.PERSONAL_REPOSITORY
    ||value.target?.repositoryId!==Number(process.env.PERSONAL_REPOSITORY_ID)
    ||value.target?.visibility!=="PRIVATE"||value.target?.viewerPermission!=="ADMIN"
    ||value.target?.defaultBranch!=="main"||value.target?.entryCommit!==process.env.ENTRY_COMMIT
    ||value.target?.automaticMerge!==false||value.target?.actionsEnabled!==false
    ||!Array.isArray(value.operations)
    ||JSON.stringify(value.operations.map((item)=>item.operation))!==JSON.stringify(expectedOps))process.exit(1);
'
```

Expected: the temporary receipt is exact and the personal publication clone is clean at the immutable entry commit. If the source receipt is missing, stop; do not reconstruct it from memory.

- [ ] **Step 2: Create a byte-identical durable private copy**

```bash
set -euo pipefail
mkdir -p "$PERSONAL_PUBLICATION_ROOT/evidence"
chmod 700 "$PERSONAL_PUBLICATION_ROOT/evidence"
mkdir -p "$PERSONAL_PUBLICATION_ROOT/evidence/private"
chmod 700 "$PERSONAL_PUBLICATION_ROOT/evidence/private"
mkdir -p "$PRIVATE_I0_DIR"
chmod 700 "$PRIVATE_I0_DIR"
install -m 600 "$BOOTSTRAP_RECEIPT_SOURCE" "$BOOTSTRAP_RECEIPT_DURABLE"
test -f "$BOOTSTRAP_RECEIPT_DURABLE"
test ! -L "$BOOTSTRAP_RECEIPT_DURABLE"
test "$(stat -f '%Lp' "$BOOTSTRAP_RECEIPT_DURABLE")" = "600"
test "$(stat -f '%l' "$BOOTSTRAP_RECEIPT_DURABLE")" = "1"
test "$(shasum -a 256 "$BOOTSTRAP_RECEIPT_DURABLE" | awk '{print $1}')" = "$BOOTSTRAP_RECEIPT_SHA256"
cmp -s "$BOOTSTRAP_RECEIPT_SOURCE" "$BOOTSTRAP_RECEIPT_DURABLE"
test -z "$(git status --porcelain)"
```

Expected: a mode-`0600`, non-symlink, single-link, byte-identical copy exists under ignored storage; the original remains untouched.

- [ ] **Step 3: Reconcile both repositories and personal bootstrap state without writes**

Run this block through one elevated `exec_command` because `gh` reads its token from the macOS Keychain:

```bash
set -euo pipefail

monotonic_ms() {
  /usr/bin/perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e \
    'printf "%d\n", int(clock_gettime(CLOCK_MONOTONIC) * 1000)'
}

run_gh_until() {
  local deadline_ms now_ms remaining_ms request_timeout_ms
  deadline_ms="$1"
  shift
  now_ms="$(monotonic_ms)"
  remaining_ms=$((deadline_ms - now_ms))
  test "$remaining_ms" -gt 0
  request_timeout_ms=30000
  test "$remaining_ms" -ge "$request_timeout_ms" || request_timeout_ms="$remaining_ms"
  GH_REQUEST_TIMEOUT_MS="$request_timeout_ms" node -e '
    const {spawn}=require("node:child_process");
    const timeout=Number(process.env.GH_REQUEST_TIMEOUT_MS);
    if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)process.exit(1);
    const child=spawn("gh",process.argv.slice(1),{stdio:["inherit","pipe","pipe"],shell:false});
    const chunks=[]; let bytes=0; let settled=false; let timedOut=false; let overflow=false;
    const finish=(success)=>{if(settled)return;settled=true;clearTimeout(timer);if(success)process.stdout.write(Buffer.concat(chunks));else process.exitCode=1;};
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL");},timeout);
    child.stdout.on("data",(chunk)=>{bytes+=chunk.length;if(bytes>16*1024*1024){overflow=true;child.kill("SIGKILL");return;}chunks.push(chunk);});
    child.stderr.on("data",()=>{});
    child.once("error",()=>finish(false));
    child.once("close",(code,signal)=>finish(!timedOut&&!overflow&&code===0&&signal===null));
  ' "$@"
}

read_inventory_count() {
  local kind deadline_ms endpoint
  kind="$1"
  deadline_ms="$2"
  case "$kind" in
    actions-runs) endpoint="repos/$PERSONAL_REPOSITORY/actions/runs?per_page=100" ;;
    extra-branches) endpoint="repos/$PERSONAL_REPOSITORY/branches?per_page=100" ;;
    tags) endpoint="repos/$PERSONAL_REPOSITORY/tags?per_page=100" ;;
    pulls) endpoint="repos/$PERSONAL_REPOSITORY/pulls?state=all&per_page=100" ;;
    deploy-keys) endpoint="repos/$PERSONAL_REPOSITORY/keys?per_page=100" ;;
    *) return 1 ;;
  esac
  run_gh_until "$deadline_ms" api --paginate --slurp "$endpoint" |
    INVENTORY_KIND="$kind" node -e '
      let input="";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        try {
          const pages=JSON.parse(input);
          const kind=process.env.INVENTORY_KIND;
          const isObject=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);
          const unique=(values)=>new Set(values).size===values.length;
          if(!Array.isArray(pages)||pages.length===0)process.exit(1);
          let count;
          if(kind==="actions-runs"){
            if(!pages.every((page)=>isObject(page)&&Number.isSafeInteger(page.total_count)&&page.total_count>=0&&Array.isArray(page.workflow_runs)))process.exit(1);
            const entries=pages.flatMap((page)=>page.workflow_runs);
            const ids=entries.map((entry)=>{
              if(!isObject(entry)||!Number.isSafeInteger(entry.id)||entry.id<=0)process.exit(1);
              return entry.id;
            });
            if(!unique(ids)||!pages.every((page)=>page.total_count===entries.length))process.exit(1);
            count=entries.length;
          }else{
            if(!pages.every(Array.isArray))process.exit(1);
            const entries=pages.flat();
            if(kind==="extra-branches"||kind==="tags"){
              const names=entries.map((entry)=>{
                if(!isObject(entry)||typeof entry.name!=="string"||entry.name.length===0)process.exit(1);
                return entry.name;
              });
              if(!unique(names))process.exit(1);
              if(kind==="extra-branches"){
                if(names.filter((name)=>name==="main").length!==1)process.exit(1);
                count=names.filter((name)=>name!=="main").length;
              }else count=names.length;
            }else if(kind==="pulls"||kind==="deploy-keys"){
              const identityField=kind==="pulls"?"number":"id";
              const ids=entries.map((entry)=>{
                if(!isObject(entry)||!Number.isSafeInteger(entry[identityField])||entry[identityField]<=0)process.exit(1);
                return entry[identityField];
              });
              if(!unique(ids))process.exit(1);
              count=ids.length;
            }else process.exit(1);
          }
          if(!Number.isSafeInteger(count)||count<0)process.exit(1);
          process.stdout.write(String(count));
        } catch { process.exit(1); }
      });
    '
}

READ_DEADLINE_MS=$(( $(monotonic_ms) + 600000 ))
test "$(run_gh_until "$READ_DEADLINE_MS" api user --jq .login)" = "solomindanil"
test "$(run_gh_until "$READ_DEADLINE_MS" repo view "$PERSONAL_REPOSITORY" --json viewerPermission --jq .viewerPermission)" = "ADMIN"
test "$(run_gh_until "$READ_DEADLINE_MS" repo view "$ORGANIZATION_REPOSITORY" --json viewerPermission --jq .viewerPermission)" = "WRITE"

PERSONAL_STATE="$(run_gh_until "$READ_DEADLINE_MS" api "repos/$PERSONAL_REPOSITORY" --jq '{repositoryId:.id,private:.private,visibility:.visibility,defaultBranch:.default_branch,automaticMerge:.allow_auto_merge}')"
PERSONAL_ACTIONS="$(run_gh_until "$READ_DEADLINE_MS" api "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)"
PERSONAL_MAIN="$(run_gh_until "$READ_DEADLINE_MS" api "repos/$PERSONAL_REPOSITORY/commits/main" --jq .sha)"
ORGANIZATION_STATE="$(run_gh_until "$READ_DEADLINE_MS" api "repos/$ORGANIZATION_REPOSITORY" --jq '{repositoryId:.id,private:.private,visibility:.visibility,defaultBranch:.default_branch,automaticMerge:.allow_auto_merge}')"
ORGANIZATION_MAIN="$(run_gh_until "$READ_DEADLINE_MS" api "repos/$ORGANIZATION_REPOSITORY/commits/main" --jq .sha)"
export PERSONAL_STATE PERSONAL_ACTIONS PERSONAL_MAIN ORGANIZATION_STATE ORGANIZATION_MAIN

node -e '
  const personal=JSON.parse(process.env.PERSONAL_STATE);
  const organization=JSON.parse(process.env.ORGANIZATION_STATE);
  const expectedPersonal={repositoryId:1322022755,private:true,visibility:"private",defaultBranch:"main",automaticMerge:false};
  const expectedOrganization={repositoryId:1319799876,private:true,visibility:"private",defaultBranch:"main",automaticMerge:false};
  const repositoryKeys=["automaticMerge","defaultBranch","private","repositoryId","visibility"];
  const matchesRepository=(actual,expected)=>
    JSON.stringify(Object.keys(actual).sort())===JSON.stringify(repositoryKeys)
    &&actual.repositoryId===expected.repositoryId
    &&actual.private===expected.private
    &&actual.visibility===expected.visibility
    &&actual.defaultBranch===expected.defaultBranch
    &&actual.automaticMerge===expected.automaticMerge;
  if(!matchesRepository(personal,expectedPersonal)
    ||!matchesRepository(organization,expectedOrganization)
    ||process.env.PERSONAL_ACTIONS!=="false"
    ||process.env.PERSONAL_MAIN!==process.env.ENTRY_COMMIT
    ||process.env.ORGANIZATION_MAIN!==process.env.ENTRY_COMMIT)process.exit(1);
'

test "$(run_gh_until "$READ_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "0"
test "$(read_inventory_count actions-runs "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count extra-branches "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count tags "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count pulls "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count deploy-keys "$READ_DEADLINE_MS")" = "0"
test "$(run_gh_until "$READ_DEADLINE_MS" repo view solomindanil/FreelandQA --json nameWithOwner --jq .nameWithOwner)" = "nuanu-ai/FreelandQA"
test "$(shasum -a 256 "$BOOTSTRAP_RECEIPT_DURABLE" | awk '{print $1}')" = "$BOOTSTRAP_RECEIPT_SHA256"
test -z "$(git -C "$PERSONAL_PUBLICATION_ROOT" status --porcelain)"
```

Expected: `BOOTSTRAP_CUSTODY_READY`; personal Actions are still off, the secret/run/extra-ref inventories are empty, the organization target and legacy redirect are unchanged, and the durable receipt remains exact.

---

### Task 2: Execute and Prove the Personal I0 Gate

**Files:**

- Read outside Git: source key and attestation at the fixed paths
- Read ignored: `evidence/private/personal-i0/bootstrap-receipt.v1.json`
- Create ignored: `evidence/private/personal-i0/personal-i0-observations.v1.json`
- Create local worktree: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1`
- External writes: personal Actions secret, personal Actions permission, two personal workflow dispatches only

**Interfaces:**

- **Consumes:** `BOOTSTRAP_CUSTODY_READY`, exact bootstrap receipt/hash, closed source-access files, personal `ADMIN`, disabled Actions, zero personal runs, and exact entry `main`.
- **Produces:** `PERSONAL_I0_READY`, exact seven-operation private bundle, two successful exact-SHA runs, Actions enabled, and isolated feature worktree.
- **Ordered tuple:** `repository-secret-write`, `actions-enable`, `baseline-workflow-dispatch`, `patchset-workflow-dispatch`, `baseline-run-selection`, `patchset-run-selection`, `feature-worktree-create`.
- **Missing-input result:** if either source-access file is absent, return `NEEDS_CONTEXT` naming only the two expected paths and proving Actions remain disabled, secret count remains zero, and run count remains zero. Only the reviewed freeland-source-access utility may create the key or attestation under the owner's 2026-08-04 option-1 approval. Until it returns exact SOURCE_ACCESS_READY, Task 2 stops with NEEDS_CONTEXT and performs no mutation.

Run Steps 1–9 below in one persistent elevated Bash shell. Exported variables, functions, private paths, and run windows must remain in that shell.

- [ ] **Step 1: Re-establish exact local and remote preconditions**

```bash
set -euo pipefail
PERSONAL_REPOSITORY="solomindanil/FreelandQA-I1"
PERSONAL_REPOSITORY_ID="1322022755"
ORGANIZATION_REPOSITORY="nuanu-ai/FreelandQA"
ORGANIZATION_REPOSITORY_ID="1319799876"
ENTRY_COMMIT="a4df0c5e4b57dfda3ed658171452cccda6095d52"
PERSONAL_PUBLICATION_ROOT="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication"
FEATURE_WORKTREE="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-cdp-i1"
FEATURE_BRANCH="codex/freeland-agent-first-cdp-i1"
PRIVATE_I0_DIR="$PERSONAL_PUBLICATION_ROOT/evidence/private/personal-i0"
BOOTSTRAP_RECEIPT_DURABLE="$PRIVATE_I0_DIR/bootstrap-receipt.v1.json"
BOOTSTRAP_RECEIPT_SHA256="991f07ac9e11533c99b7605cd069bfe866055ea479578f088a270e98b4e4ec58"
FREELAND_CDP_I0_OBSERVATIONS_FILE="$PRIVATE_I0_DIR/personal-i0-observations.v1.json"
FREELAND_SOURCE_DEPLOY_KEY_FILE="/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_ed25519"
FREELAND_SOURCE_ACCESS_ATTESTATION_FILE="/Users/danilsolomin/.config/freelandqa/source-access/freeland_app_readonly_attestation.json"
export PERSONAL_REPOSITORY PERSONAL_REPOSITORY_ID ORGANIZATION_REPOSITORY ORGANIZATION_REPOSITORY_ID
export ENTRY_COMMIT PERSONAL_PUBLICATION_ROOT FEATURE_WORKTREE FEATURE_BRANCH PRIVATE_I0_DIR
export BOOTSTRAP_RECEIPT_DURABLE BOOTSTRAP_RECEIPT_SHA256 FREELAND_CDP_I0_OBSERVATIONS_FILE
export FREELAND_SOURCE_DEPLOY_KEY_FILE FREELAND_SOURCE_ACCESS_ATTESTATION_FILE

test "$(pwd -P)" = "$PERSONAL_PUBLICATION_ROOT"
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git remote get-url origin)" = "https://github.com/solomindanil/FreelandQA-I1.git"
test "$(shasum -a 256 "$BOOTSTRAP_RECEIPT_DURABLE" | awk '{print $1}')" = "$BOOTSTRAP_RECEIPT_SHA256"
test ! -e "$FEATURE_WORKTREE"
test -z "$(git branch --list "$FEATURE_BRANCH")"
test ! -e "$FREELAND_CDP_I0_OBSERVATIONS_FILE"

monotonic_ms() {
  /usr/bin/perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e \
    'printf "%d\n", int(clock_gettime(CLOCK_MONOTONIC) * 1000)'
}

run_gh_until() {
  local deadline_ms now_ms remaining_ms request_timeout_ms
  deadline_ms="$1"; shift
  now_ms="$(monotonic_ms)"; remaining_ms=$((deadline_ms - now_ms)); test "$remaining_ms" -gt 0
  request_timeout_ms=30000; test "$remaining_ms" -ge "$request_timeout_ms" || request_timeout_ms="$remaining_ms"
  GH_REQUEST_TIMEOUT_MS="$request_timeout_ms" node -e '
    const {spawn}=require("node:child_process");
    const timeout=Number(process.env.GH_REQUEST_TIMEOUT_MS);
    if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)process.exit(1);
    const child=spawn("gh",process.argv.slice(1),{stdio:["inherit","pipe","pipe"],shell:false});
    const chunks=[]; let bytes=0; let settled=false; let timedOut=false; let overflow=false;
    const finish=(success)=>{if(settled)return;settled=true;clearTimeout(timer);if(success)process.stdout.write(Buffer.concat(chunks));else process.exitCode=1;};
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL");},timeout);
    child.stdout.on("data",(chunk)=>{bytes+=chunk.length;if(bytes>16*1024*1024){overflow=true;child.kill("SIGKILL");return;}chunks.push(chunk);});
    child.stderr.on("data",()=>{}); child.once("error",()=>finish(false));
    child.once("close",(code,signal)=>finish(!timedOut&&!overflow&&code===0&&signal===null));
  ' "$@"
}

read_actions_run_count() {
  local deadline_ms
  deadline_ms="$1"
  run_gh_until "$deadline_ms" api --paginate --slurp "repos/$PERSONAL_REPOSITORY/actions/runs?per_page=100" |
    node -e '
      let input="";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        try {
          const pages=JSON.parse(input);
          const isObject=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);
          const unique=(values)=>new Set(values).size===values.length;
          if(!Array.isArray(pages)||pages.length===0)process.exit(1);
          if(!pages.every((page)=>isObject(page)&&Number.isSafeInteger(page.total_count)&&page.total_count>=0&&Array.isArray(page.workflow_runs)))process.exit(1);
          const entries=pages.flatMap((page)=>page.workflow_runs);
          const ids=entries.map((entry)=>{
            if(!isObject(entry)||!Number.isSafeInteger(entry.id)||entry.id<=0)process.exit(1);
            return entry.id;
          });
          if(!unique(ids)||!pages.every((page)=>page.total_count===entries.length))process.exit(1);
          process.stdout.write(String(entries.length));
        } catch { process.exit(1); }
      });
    '
}

PREFLIGHT_DEADLINE_MS=$(( $(monotonic_ms) + 180000 ))
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" api user --jq .login)" = "solomindanil"
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" repo view "$PERSONAL_REPOSITORY" --json viewerPermission --jq .viewerPermission)" = "ADMIN"
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" repo view "$ORGANIZATION_REPOSITORY" --json viewerPermission --jq .viewerPermission)" = "WRITE"
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" api "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)" = "false"
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "0"
test "$(read_actions_run_count "$PREFLIGHT_DEADLINE_MS")" = "0"
```

Expected: the personal remote remains in exact post-bootstrap state immediately before source-access validation.

- [ ] **Step 2: Validate source access before any remote write**

The attestation has exactly these five fields:

```json
{"repository":"nuanu-ai/freeland_app","title":"FreelandQA read-only source checkout","fingerprint":"SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","readOnly":true,"allowWrite":false}
```

Run:

```bash
set -euo pipefail
test -f "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
test ! -L "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
test "$(stat -f '%Lp' "$FREELAND_SOURCE_DEPLOY_KEY_FILE")" = "600"
test "$(stat -f '%l' "$FREELAND_SOURCE_DEPLOY_KEY_FILE")" = "1"
test -f "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE"
test ! -L "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE"
test "$(stat -f '%Lp' "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE")" = "600"
test "$(stat -f '%l' "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE")" = "1"

read_source_access() {
  local attestation_sha key_fingerprint
  attestation_sha="$(shasum -a 256 "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE" | awk '{print $1}')"
  key_fingerprint="$(ssh-keygen -lf "$FREELAND_SOURCE_DEPLOY_KEY_FILE" -E sha256 | awk 'NR == 1 {print $2}')"
  ATTESTATION_SHA="$attestation_sha" KEY_FINGERPRINT="$key_fingerprint" node -e '
    const fs=require("node:fs");
    const value=JSON.parse(fs.readFileSync(process.env.FREELAND_SOURCE_ACCESS_ATTESTATION_FILE,"utf8"));
    const expected=["allowWrite","fingerprint","readOnly","repository","title"];
    if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify(expected)
      ||value.repository!=="nuanu-ai/freeland_app"
      ||value.title!=="FreelandQA read-only source checkout"
      ||value.readOnly!==true||value.allowWrite!==false
      ||!/^SHA256:[A-Za-z0-9+/]{43}$/.test(value.fingerprint)
      ||value.fingerprint!==process.env.KEY_FINGERPRINT
      ||!/^[0-9a-f]{64}$/.test(process.env.ATTESTATION_SHA))process.exit(1);
    process.stdout.write(JSON.stringify({
      repository:value.repository,title:value.title,fingerprint:value.fingerprint,
      attestationSha256:process.env.ATTESTATION_SHA,readOnly:true,allowWrite:false,
      privateKeyFingerprintMatched:true,
    }));
  '
}

SOURCE_ACCESS_BEFORE="$(read_source_access)"
export SOURCE_ACCESS_BEFORE
```

Expected: the private-key fingerprint matches the closed attestation. Never run `cat`, `head`, `ssh-keygen -y`, or copy the key/attestation into a repository. If either file is missing, stop here with `NEEDS_CONTEXT`; re-read the disabled Actions, zero secret, and zero-run state before reporting.

- [ ] **Step 3: Define exact snapshots/helpers and initialize the private I0 bundle**

```bash
set -euo pipefail

read_bridge_snapshot() {
  local expected_actions deadline_ms personal_repo personal_actions personal_permission personal_main organization_repo organization_permission organization_main
  expected_actions="$1"
  case "$expected_actions" in true|false) ;; *) return 1 ;; esac
  deadline_ms=$(( $(monotonic_ms) + 90000 ))
  personal_repo="$(run_gh_until "$deadline_ms" api "repos/$PERSONAL_REPOSITORY" --jq '{repositoryId:.id,private:.private,visibility:.visibility,defaultBranch:.default_branch,automaticMerge:.allow_auto_merge}')"
  personal_actions="$(run_gh_until "$deadline_ms" api "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)"
  personal_permission="$(run_gh_until "$deadline_ms" repo view "$PERSONAL_REPOSITORY" --json viewerPermission --jq .viewerPermission)"
  personal_main="$(run_gh_until "$deadline_ms" api "repos/$PERSONAL_REPOSITORY/commits/main" --jq .sha)"
  organization_repo="$(run_gh_until "$deadline_ms" api "repos/$ORGANIZATION_REPOSITORY" --jq '{repositoryId:.id,private:.private,visibility:.visibility,defaultBranch:.default_branch,automaticMerge:.allow_auto_merge}')"
  organization_permission="$(run_gh_until "$deadline_ms" repo view "$ORGANIZATION_REPOSITORY" --json viewerPermission --jq .viewerPermission)"
  organization_main="$(run_gh_until "$deadline_ms" api "repos/$ORGANIZATION_REPOSITORY/commits/main" --jq .sha)"
  export EXPECTED_ACTIONS="$expected_actions" PERSONAL_REPO="$personal_repo" PERSONAL_ACTIONS="$personal_actions"
  export PERSONAL_PERMISSION="$personal_permission" PERSONAL_MAIN="$personal_main"
  export ORGANIZATION_REPO="$organization_repo" ORGANIZATION_PERMISSION="$organization_permission" ORGANIZATION_MAIN="$organization_main"
  node -e '
    const personal=JSON.parse(process.env.PERSONAL_REPO);
    const organization=JSON.parse(process.env.ORGANIZATION_REPO);
    const expectedPersonal={repositoryId:1322022755,private:true,visibility:"private",defaultBranch:"main",automaticMerge:false};
    const expectedOrganization={repositoryId:1319799876,private:true,visibility:"private",defaultBranch:"main",automaticMerge:false};
    const repositoryKeys=["automaticMerge","defaultBranch","private","repositoryId","visibility"];
    const matchesRepository=(actual,expected)=>
      JSON.stringify(Object.keys(actual).sort())===JSON.stringify(repositoryKeys)
      &&actual.repositoryId===expected.repositoryId
      &&actual.private===expected.private
      &&actual.visibility===expected.visibility
      &&actual.defaultBranch===expected.defaultBranch
      &&actual.automaticMerge===expected.automaticMerge;
    if(!matchesRepository(personal,expectedPersonal)
      ||!matchesRepository(organization,expectedOrganization)
      ||process.env.PERSONAL_ACTIONS!==process.env.EXPECTED_ACTIONS
      ||process.env.PERSONAL_PERMISSION!=="ADMIN"||process.env.ORGANIZATION_PERMISSION!=="WRITE"
      ||process.env.PERSONAL_MAIN!==process.env.ENTRY_COMMIT||process.env.ORGANIZATION_MAIN!==process.env.ENTRY_COMMIT)process.exit(1);
    process.stdout.write(JSON.stringify({
      personal:{...personal,viewerPermission:process.env.PERSONAL_PERMISSION,mainSha:process.env.PERSONAL_MAIN,actionsEnabled:process.env.PERSONAL_ACTIONS==="true"},
      organization:{...organization,viewerPermission:process.env.ORGANIZATION_PERMISSION,mainSha:process.env.ORGANIZATION_MAIN,role:"final-integration-target"},
    }));
  '
}

append_i0_operation() {
  I0_OPERATION_JSON="$1" node -e '
    const fs=require("node:fs"); const file=process.env.FREELAND_CDP_I0_OBSERVATIONS_FILE;
    const value=JSON.parse(fs.readFileSync(file,"utf8"));
    value.i0Operations.push(JSON.parse(process.env.I0_OPERATION_JSON));
    const next=`${file}.next`;
    fs.writeFileSync(next,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
    fs.renameSync(next,file);
  '
}

sleep_within_deadline() {
  local deadline_ms now_ms remaining_ms sleep_ms
  deadline_ms="$1"; now_ms="$(monotonic_ms)"; remaining_ms=$((deadline_ms-now_ms)); test "$remaining_ms" -gt 0
  sleep_ms=5000; test "$remaining_ms" -ge "$sleep_ms" || sleep_ms="$remaining_ms"
  SLEEP_MS="$sleep_ms" /usr/bin/perl -e 'select undef,undef,undef,$ENV{SLEEP_MS}/1000'
}

workflow_global_run_max() {
  local workflow deadline_ms
  workflow="$1"; case "$workflow" in baseline.yml|patchset.yml) ;; *) return 1 ;; esac
  deadline_ms=$(( $(monotonic_ms) + 120000 ))
  run_gh_until "$deadline_ms" api --paginate --slurp "repos/$PERSONAL_REPOSITORY/actions/workflows/$workflow/runs?per_page=100" |
    node -e '
      let input="";process.stdin.setEncoding("utf8");process.stdin.on("data",(chunk)=>input+=chunk);
      process.stdin.on("end",()=>{const pages=JSON.parse(input);if(!Array.isArray(pages)||pages.some((page)=>!Array.isArray(page.workflow_runs)))process.exit(1);
      const ids=pages.flatMap((page)=>page.workflow_runs).map((run)=>run.id);if(ids.some((id)=>!Number.isSafeInteger(id)||id<0))process.exit(1);
      process.stdout.write(String(ids.reduce((maximum,id)=>Math.max(maximum,id),0)));});
    '
}

INITIAL_BRIDGE_SNAPSHOT="$(read_bridge_snapshot false)"
export INITIAL_BRIDGE_SNAPSHOT
node -e '
  const fs=require("node:fs");
  const bootstrap=JSON.parse(fs.readFileSync(process.env.BOOTSTRAP_RECEIPT_DURABLE,"utf8"));
  const value={
    schemaVersion:1,status:"PERSONAL_I0_IN_PROGRESS",repositoryRole:"personal-staging",
    repository:process.env.PERSONAL_REPOSITORY,repositoryId:Number(process.env.PERSONAL_REPOSITORY_ID),
    mode:"detect-and-refuse",serverSidePushPrevention:false,automaticMerge:false,
    harnessMayUpdateMain:false,ownerAcceptedResidualRisk:true,entryCommit:process.env.ENTRY_COMMIT,
    bootstrapReceipt:{repositoryId:bootstrap.target.repositoryId,sha256:process.env.BOOTSTRAP_RECEIPT_SHA256,path:process.env.BOOTSTRAP_RECEIPT_DURABLE},
    organizationTarget:{repository:process.env.ORGANIZATION_REPOSITORY,repositoryId:Number(process.env.ORGANIZATION_REPOSITORY_ID),expectedBase:process.env.ENTRY_COMMIT},
    initialBridgeSnapshot:JSON.parse(process.env.INITIAL_BRIDGE_SNAPSHOT),
    sourceAccess:{before:JSON.parse(process.env.SOURCE_ACCESS_BEFORE),after:null},
    runs:{baseline:null,patchset:null},i0Operations:[],finalBridgeSnapshot:null,
  };
  fs.writeFileSync(process.env.FREELAND_CDP_I0_OBSERVATIONS_FILE,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
'
test "$(stat -f '%Lp' "$FREELAND_CDP_I0_OBSERVATIONS_FILE")" = "600"
test "$(stat -f '%l' "$FREELAND_CDP_I0_OBSERVATIONS_FILE")" = "1"
```

Expected: the private bundle binds the actual bootstrap receipt and both repositories before the first external write.

- [ ] **Step 4: Write the source secret once, read back metadata, then enable Actions once**

```bash
set -euo pipefail
SECRET_BEFORE="$(read_bridge_snapshot false)"
SECRET_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
test "$(run_gh_until "$SECRET_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "0"
run_gh_until "$SECRET_DEADLINE_MS" secret set FREELAND_SOURCE_DEPLOY_KEY --repo "$PERSONAL_REPOSITORY" < "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
test "$(run_gh_until "$SECRET_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "1"
SECRET_AFTER="$(read_bridge_snapshot false)"
SECRET_OPERATION="$(BEFORE="$SECRET_BEFORE" AFTER="$SECRET_AFTER" node -e 'process.stdout.write(JSON.stringify({operation:"repository-secret-write",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",secretName:"FREELAND_SOURCE_DEPLOY_KEY",metadataMatchCount:1}))')"
append_i0_operation "$SECRET_OPERATION"

ACTIONS_BEFORE="$(read_bridge_snapshot false)"
ACTIONS_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
run_gh_until "$ACTIONS_DEADLINE_MS" api --method PUT "repos/$PERSONAL_REPOSITORY/actions/permissions" -F enabled=true -f allowed_actions=all
test "$(run_gh_until "$ACTIONS_DEADLINE_MS" api "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)" = "true"
test "$(read_actions_run_count "$ACTIONS_DEADLINE_MS")" = "0"
ACTIONS_AFTER="$(read_bridge_snapshot true)"
ACTIONS_OPERATION="$(BEFORE="$ACTIONS_BEFORE" AFTER="$ACTIONS_AFTER" node -e 'process.stdout.write(JSON.stringify({operation:"actions-enable",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"enabled_after_secret_readback",unexpectedRunCount:0}))')"
append_i0_operation "$ACTIONS_OPERATION"
```

Expected: the secret name exists exactly once; only then do Actions change from disabled to enabled, with zero retroactive runs. Do not repeat either write on ambiguity.

- [ ] **Step 5: Dispatch Baseline and Patchset exactly once in independent windows**

```bash
set -euo pipefail
BASELINE_DISPATCH_BEFORE="$(read_bridge_snapshot true)"
BASELINE_SECRET_DEADLINE_MS=$(( $(monotonic_ms) + 60000 ))
test "$(run_gh_until "$BASELINE_SECRET_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "1"
BASELINE_MAX_BEFORE="$(workflow_global_run_max baseline.yml)"
BASELINE_WINDOW_OPENED_AT="$(node -p 'new Date(Math.floor(Date.now()/1000)*1000).toISOString()')"
export BASELINE_MAX_BEFORE BASELINE_WINDOW_OPENED_AT
node -e 'if(!Number.isSafeInteger(Number(process.env.BASELINE_MAX_BEFORE))||Number(process.env.BASELINE_MAX_BEFORE)<0||new Date(process.env.BASELINE_WINDOW_OPENED_AT).toISOString()!==process.env.BASELINE_WINDOW_OPENED_AT)process.exit(1)'
BASELINE_DISPATCH_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
run_gh_until "$BASELINE_DISPATCH_DEADLINE_MS" workflow run baseline.yml --repo "$PERSONAL_REPOSITORY" --ref main
BASELINE_DISPATCH_AFTER="$(read_bridge_snapshot true)"
BASELINE_DISPATCH_OPERATION="$(BEFORE="$BASELINE_DISPATCH_BEFORE" AFTER="$BASELINE_DISPATCH_AFTER" node -e 'process.stdout.write(JSON.stringify({operation:"baseline-workflow-dispatch",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",workflowFile:"baseline.yml",preWindowMaxRunId:Number(process.env.BASELINE_MAX_BEFORE),windowOpenedAt:process.env.BASELINE_WINDOW_OPENED_AT}))')"
append_i0_operation "$BASELINE_DISPATCH_OPERATION"

PATCHSET_DISPATCH_BEFORE="$(read_bridge_snapshot true)"
PATCHSET_MAX_BEFORE="$(workflow_global_run_max patchset.yml)"
PATCHSET_WINDOW_OPENED_AT="$(node -p 'new Date(Math.floor(Date.now()/1000)*1000).toISOString()')"
export PATCHSET_MAX_BEFORE PATCHSET_WINDOW_OPENED_AT
node -e 'if(!Number.isSafeInteger(Number(process.env.PATCHSET_MAX_BEFORE))||Number(process.env.PATCHSET_MAX_BEFORE)<0||new Date(process.env.PATCHSET_WINDOW_OPENED_AT).toISOString()!==process.env.PATCHSET_WINDOW_OPENED_AT)process.exit(1)'
PATCHSET_DISPATCH_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
run_gh_until "$PATCHSET_DISPATCH_DEADLINE_MS" workflow run patchset.yml --repo "$PERSONAL_REPOSITORY" --ref main
PATCHSET_DISPATCH_AFTER="$(read_bridge_snapshot true)"
PATCHSET_DISPATCH_OPERATION="$(BEFORE="$PATCHSET_DISPATCH_BEFORE" AFTER="$PATCHSET_DISPATCH_AFTER" node -e 'process.stdout.write(JSON.stringify({operation:"patchset-workflow-dispatch",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",workflowFile:"patchset.yml",preWindowMaxRunId:Number(process.env.PATCHSET_MAX_BEFORE),windowOpenedAt:process.env.PATCHSET_WINDOW_OPENED_AT}))')"
append_i0_operation "$PATCHSET_DISPATCH_OPERATION"
```

Expected: exactly one request per workflow; each window stores its own exhaustive global maximum and canonical UTC opening time.

- [ ] **Step 6: Define generic exact-run selection and validation**

```bash
set -euo pipefail

list_exact_run_ids() {
  local workflow maximum window deadline_ms
  workflow="$1"; maximum="$2"; window="$3"; deadline_ms="$4"
  case "$workflow" in baseline.yml|patchset.yml) ;; *) return 1 ;; esac
  WORKFLOW="$workflow" MAXIMUM="$maximum" WINDOW="$window" run_gh_until "$deadline_ms" api --paginate --slurp \
    "repos/$PERSONAL_REPOSITORY/actions/workflows/$workflow/runs?branch=main&event=workflow_dispatch&per_page=100" |
    ENTRY_COMMIT="$ENTRY_COMMIT" MAXIMUM="$maximum" WINDOW="$window" node -e '
      let input="";process.stdin.setEncoding("utf8");process.stdin.on("data",(chunk)=>input+=chunk);
      process.stdin.on("end",()=>{const pages=JSON.parse(input);if(!Array.isArray(pages)||pages.some((page)=>!Array.isArray(page.workflow_runs)))process.exit(1);
      const maximum=Number(process.env.MAXIMUM);const matches=pages.flatMap((page)=>page.workflow_runs).filter((run)=>{
        if(!Number.isSafeInteger(run.id)||run.id<=maximum||run.event!=="workflow_dispatch"||run.head_sha!==process.env.ENTRY_COMMIT)return false;
        return new Date(run.created_at).toISOString()>=process.env.WINDOW;
      }).sort((left,right)=>left.id-right.id);process.stdout.write(matches.map((run)=>String(run.id)).join("\n"));});
    '
}

wait_for_exact_success() {
  local workflow required_job maximum window deadline_ms run_ids run_count run_id state completed run_json
  workflow="$1"; required_job="$2"; maximum="$3"; window="$4"; deadline_ms="$5"
  run_ids=""
  while test "$(monotonic_ms)" -lt "$deadline_ms"; do
    run_ids="$(list_exact_run_ids "$workflow" "$maximum" "$window" "$deadline_ms")"
    run_count="$(printf '%s\n' "$run_ids" | awk 'NF {n+=1} END {print n+0}')"
    test "$run_count" -le 1
    test "$run_count" = 1 && break
    sleep_within_deadline "$deadline_ms"
  done
  test "$run_count" = 1
  run_id="$run_ids"; completed=0
  while test "$(monotonic_ms)" -lt "$deadline_ms"; do
    state="$(run_gh_until "$deadline_ms" run view "$run_id" --repo "$PERSONAL_REPOSITORY" --json status,conclusion)"
    STATE="$state" node -e 'const value=JSON.parse(process.env.STATE);const pending=new Set(["queued","in_progress","waiting","requested","pending"]);if(value.status!=="completed"&&!pending.has(value.status))process.exit(1);if(value.status!=="completed"&&value.conclusion!==""&&value.conclusion!==null)process.exit(1)'
    if test "$(STATE="$state" node -e 'process.stdout.write(JSON.parse(process.env.STATE).status)')" = "completed"; then
      test "$(STATE="$state" node -e 'process.stdout.write(JSON.parse(process.env.STATE).conclusion)')" = "success"
      completed=1; break
    fi
    sleep_within_deadline "$deadline_ms"
  done
  test "$completed" = 1
  run_ids="$(list_exact_run_ids "$workflow" "$maximum" "$window" "$deadline_ms")"
  test "$(printf '%s\n' "$run_ids" | awk 'NF {n+=1} END {print n+0}')" = "1"
  test "$run_ids" = "$run_id"
  run_json="$(run_gh_until "$deadline_ms" run view "$run_id" --repo "$PERSONAL_REPOSITORY" --json databaseId,headSha,createdAt,event,conclusion,jobs --jq '{runId:.databaseId,headSha:.headSha,createdAt:.createdAt,event:.event,conclusion:.conclusion,jobs:.jobs}')"
  RUN_JSON="$run_json" RUN_ID="$run_id" REQUIRED_JOB="$required_job" WINDOW="$window" node -e '
    const value=JSON.parse(process.env.RUN_JSON);const createdAt=new Date(value.createdAt).toISOString();
    const jobs=value.jobs.filter((job)=>job.name===process.env.REQUIRED_JOB&&job.conclusion==="success");
    if(value.runId!==Number(process.env.RUN_ID)||value.event!=="workflow_dispatch"||value.headSha!==process.env.ENTRY_COMMIT
      ||value.conclusion!=="success"||createdAt<process.env.WINDOW||jobs.length!==1)process.exit(1);
    process.stdout.write(JSON.stringify({...value,createdAt,requiredJob:process.env.REQUIRED_JOB,requiredJobConclusion:"success"}));
  '
}
```

Expected: selection fails on zero, duplicate, mismatched-SHA, mismatched-event, failed, unknown-state, or missing/duplicate required-job runs. The function never requests workflow logs or reruns.

- [ ] **Step 7: Select, re-query, and record exact Baseline and Patchset successes**

```bash
set -euo pipefail
BASELINE_SELECTION_BEFORE="$(read_bridge_snapshot true)"
BASELINE_SELECTION_DEADLINE_MS=$(( $(monotonic_ms) + 600000 ))
BASELINE_RUN="$(wait_for_exact_success baseline.yml deterministic "$BASELINE_MAX_BEFORE" "$BASELINE_WINDOW_OPENED_AT" "$BASELINE_SELECTION_DEADLINE_MS")"
BASELINE_RUN_ID="$(RUN="$BASELINE_RUN" node -e 'process.stdout.write(String(JSON.parse(process.env.RUN).runId))')"
export BASELINE_RUN BASELINE_RUN_ID
BASELINE_SELECTION_AFTER="$(read_bridge_snapshot true)"
BASELINE_SELECTION_OPERATION="$(BEFORE="$BASELINE_SELECTION_BEFORE" AFTER="$BASELINE_SELECTION_AFTER" RUN="$BASELINE_RUN" node -e '
  const run=JSON.parse(process.env.RUN);process.stdout.write(JSON.stringify({operation:"baseline-run-selection",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",workflowFile:"baseline.yml",event:"workflow_dispatch",preWindowMaxRunId:Number(process.env.BASELINE_MAX_BEFORE),windowOpenedAt:process.env.BASELINE_WINDOW_OPENED_AT,exactlyOneMatch:true,runId:run.runId,createdAt:run.createdAt,expectedHeadRole:"entryCommit",expectedHeadSha:process.env.ENTRY_COMMIT,headSha:run.headSha,headMatchesExpected:true,conclusion:"success",requiredJob:"deterministic",requiredJobConclusion:"success"}));
')"
append_i0_operation "$BASELINE_SELECTION_OPERATION"

PATCHSET_SELECTION_BEFORE="$(read_bridge_snapshot true)"
PATCHSET_SELECTION_DEADLINE_MS=$(( $(monotonic_ms) + 600000 ))
PATCHSET_RUN="$(wait_for_exact_success patchset.yml immutable-base "$PATCHSET_MAX_BEFORE" "$PATCHSET_WINDOW_OPENED_AT" "$PATCHSET_SELECTION_DEADLINE_MS")"
PATCHSET_RUN_ID="$(RUN="$PATCHSET_RUN" node -e 'process.stdout.write(String(JSON.parse(process.env.RUN).runId))')"
export PATCHSET_RUN PATCHSET_RUN_ID
PATCHSET_SELECTION_AFTER="$(read_bridge_snapshot true)"
PATCHSET_SELECTION_OPERATION="$(BEFORE="$PATCHSET_SELECTION_BEFORE" AFTER="$PATCHSET_SELECTION_AFTER" RUN="$PATCHSET_RUN" node -e '
  const run=JSON.parse(process.env.RUN);process.stdout.write(JSON.stringify({operation:"patchset-run-selection",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",workflowFile:"patchset.yml",event:"workflow_dispatch",preWindowMaxRunId:Number(process.env.PATCHSET_MAX_BEFORE),windowOpenedAt:process.env.PATCHSET_WINDOW_OPENED_AT,exactlyOneMatch:true,runId:run.runId,createdAt:run.createdAt,expectedHeadRole:"entryCommit",expectedHeadSha:process.env.ENTRY_COMMIT,headSha:run.headSha,headMatchesExpected:true,conclusion:"success",requiredJob:"immutable-base",requiredJobConclusion:"success"}));
')"
append_i0_operation "$PATCHSET_SELECTION_OPERATION"
```

Expected: one exact successful run per workflow, with independent windows and exact required jobs.

- [ ] **Step 8: Create the isolated personal I1 worktree**

Invoke `superpowers:using-git-worktrees`, then continue in the same persistent shell:

```bash
set -euo pipefail
WORKTREE_BEFORE="$(read_bridge_snapshot true)"
git -C "$PERSONAL_PUBLICATION_ROOT" fetch origin main
test "$(git -C "$PERSONAL_PUBLICATION_ROOT" rev-parse origin/main)" = "$ENTRY_COMMIT"
test -z "$(git -C "$PERSONAL_PUBLICATION_ROOT" status --porcelain)"
test ! -e "$FEATURE_WORKTREE"
test -z "$(git -C "$PERSONAL_PUBLICATION_ROOT" branch --list "$FEATURE_BRANCH")"
git -C "$PERSONAL_PUBLICATION_ROOT" worktree add "$FEATURE_WORKTREE" -b "$FEATURE_BRANCH" "$ENTRY_COMMIT"
test "$(git -C "$FEATURE_WORKTREE" branch --show-current)" = "$FEATURE_BRANCH"
test "$(git -C "$FEATURE_WORKTREE" rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git -C "$FEATURE_WORKTREE" remote get-url origin)" = "https://github.com/solomindanil/FreelandQA-I1.git"
test -z "$(git -C "$FEATURE_WORKTREE" status --porcelain)"
WORKTREE_AFTER="$(read_bridge_snapshot true)"
WORKTREE_OPERATION="$(BEFORE="$WORKTREE_BEFORE" AFTER="$WORKTREE_AFTER" node -e 'process.stdout.write(JSON.stringify({operation:"feature-worktree-create",before:JSON.parse(process.env.BEFORE),after:JSON.parse(process.env.AFTER),result:"observed_no_drift",branch:process.env.FEATURE_BRANCH,path:process.env.FEATURE_WORKTREE,headSha:process.env.ENTRY_COMMIT}))')"
append_i0_operation "$WORKTREE_OPERATION"
```

Expected: only the local personal feature branch/worktree is created; neither remote receives a branch push.

- [ ] **Step 9: Re-attest all invariants and atomically close the private bundle**

```bash
set -euo pipefail
SOURCE_ACCESS_AFTER="$(read_source_access)"
test "$SOURCE_ACCESS_AFTER" = "$SOURCE_ACCESS_BEFORE"
FINAL_BRIDGE_SNAPSHOT="$(read_bridge_snapshot true)"
FINAL_READ_DEADLINE_MS=$(( $(monotonic_ms) + 180000 ))
test "$(run_gh_until "$FINAL_READ_DEADLINE_MS" secret list --repo "$PERSONAL_REPOSITORY" --json name --jq '[.[] | select(.name == "FREELAND_SOURCE_DEPLOY_KEY")] | length')" = "1"
test "$(list_exact_run_ids baseline.yml "$BASELINE_MAX_BEFORE" "$BASELINE_WINDOW_OPENED_AT" "$FINAL_READ_DEADLINE_MS")" = "$BASELINE_RUN_ID"
test "$(list_exact_run_ids patchset.yml "$PATCHSET_MAX_BEFORE" "$PATCHSET_WINDOW_OPENED_AT" "$FINAL_READ_DEADLINE_MS")" = "$PATCHSET_RUN_ID"
export SOURCE_ACCESS_AFTER FINAL_BRIDGE_SNAPSHOT

node -e '
  const fs=require("node:fs");const file=process.env.FREELAND_CDP_I0_OBSERVATIONS_FILE;
  const value=JSON.parse(fs.readFileSync(file,"utf8"));
  const expected=["repository-secret-write","actions-enable","baseline-workflow-dispatch","patchset-workflow-dispatch","baseline-run-selection","patchset-run-selection","feature-worktree-create"];
  value.sourceAccess.after=JSON.parse(process.env.SOURCE_ACCESS_AFTER);
  value.runs.baseline=JSON.parse(process.env.BASELINE_RUN);
  value.runs.patchset=JSON.parse(process.env.PATCHSET_RUN);
  value.finalBridgeSnapshot=JSON.parse(process.env.FINAL_BRIDGE_SNAPSHOT);
  value.status="PERSONAL_I0_READY";
  if(value.repositoryRole!=="personal-staging"||value.repositoryId!==1322022755
    ||value.entryCommit!==process.env.ENTRY_COMMIT
    ||value.bootstrapReceipt.sha256!==process.env.BOOTSTRAP_RECEIPT_SHA256
    ||JSON.stringify(value.i0Operations.map((item)=>item.operation))!==JSON.stringify(expected)
    ||JSON.stringify(value.sourceAccess.before)!==JSON.stringify(value.sourceAccess.after)
    ||value.runs.baseline.runId!==Number(process.env.BASELINE_RUN_ID)
    ||value.runs.patchset.runId!==Number(process.env.PATCHSET_RUN_ID)
    ||JSON.stringify(value.initialBridgeSnapshot.organization)!==JSON.stringify(value.finalBridgeSnapshot.organization))process.exit(1);
  for(const operation of value.i0Operations){
    if(JSON.stringify(operation.before.organization)!==JSON.stringify(operation.after.organization))process.exit(1);
    if(operation.operation!=="actions-enable"&&JSON.stringify(operation.before)!==JSON.stringify(operation.after))process.exit(1);
    if(operation.operation==="actions-enable"&&(
      operation.before.personal.actionsEnabled!==false||operation.after.personal.actionsEnabled!==true
      ||JSON.stringify({...operation.before.personal,actionsEnabled:true})!==JSON.stringify(operation.after.personal)))process.exit(1);
  }
  const next=`${file}.next`;
  fs.writeFileSync(next,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
  fs.renameSync(next,file);
'

test "$(stat -f '%Lp' "$FREELAND_CDP_I0_OBSERVATIONS_FILE")" = "600"
test "$(stat -f '%l' "$FREELAND_CDP_I0_OBSERVATIONS_FILE")" = "1"
test "$(shasum -a 256 "$BOOTSTRAP_RECEIPT_DURABLE" | awk '{print $1}')" = "$BOOTSTRAP_RECEIPT_SHA256"
test -z "$(git -C "$PERSONAL_PUBLICATION_ROOT" status --porcelain)"
test -z "$(git -C "$FEATURE_WORKTREE" status --porcelain)"
```

Expected: `PERSONAL_I0_READY`; exact seven-item operation order, byte-identical source-access before/after, exact successful run IDs, organization state unchanged, personal Actions enabled, and clean personal publication/feature worktrees.

- [ ] **Step 10: Hand off only non-secret evidence identifiers**

Record in the SDD task report:

- personal repository and database ID;
- exact entry commit;
- bootstrap receipt SHA-256 and durable path;
- I0 observation SHA-256 and private path;
- Baseline/Patchset run IDs and required-job conclusions;
- feature branch/worktree;
- final status `PERSONAL_I0_READY` or exact fail-closed blocker;
- proof that the organization snapshot remained unchanged.

Do not paste either private JSON file, the key, attestation contents, workflow logs, or credential data into the report.

## Plan Acceptance

Before accepting execution:

1. Task 1 must preserve the exact bootstrap receipt without remote mutation.
2. Task 2 must stop before its first remote write when source inputs are absent or invalid.
3. No external write has an automatic retry path.
4. Secret readback precedes Actions enablement; Actions enablement precedes dispatch.
5. Both dispatches have separate exhaustive run maxima/windows and exact re-query uniqueness.
6. Every personal operation is enclosed by a personal-plus-organization bridge snapshot.
7. The only permitted repository-state transition is personal `actionsEnabled:false -> true` in the `actions-enable` operation.
8. The organization target remains a read-only final-integration identity throughout.
9. No tracked file is created or changed by I0 execution.
10. Successful completion remains explicitly provisional and cannot be rendered as organization delivery or release acceptance.

## Next Phase

After `PERSONAL_I0_READY`, write a separate reviewed amendment to `docs/superpowers/plans/2026-08-02-freeland-agent-first-cdp-feedback-loop.md`. That amendment binds Tasks 2–15 to repository ID `1322022755`, role `personal-staging`, the exact personal I0 bundle digest/run IDs, and the personal feature worktree. It must preserve the later organization-return bridge and must not reinterpret personal evidence as organization evidence.

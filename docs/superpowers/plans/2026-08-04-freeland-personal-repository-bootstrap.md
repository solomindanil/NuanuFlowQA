# Freeland Personal Repository Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and prove a private `solomindanil/FreelandQA-I1` staging repository whose disabled-Actions `main` is exactly the reviewed organization entry commit, without disturbing the existing organization repository or its legacy redirect.

**Architecture:** This is the first, independently reviewable phase of the approved personal-repository bridge. One persistent elevated operator shell performs a fresh read-only preflight, creates an empty private repository, disables GitHub Actions before the first code push, seeds only the exact `main` history, and creates a separate clean local clone. A mode-`0600` private receipt records the exact repository ID and operation sequence; the later I0 amendment consumes that actual ID instead of predicting one.

**Tech Stack:** GitHub CLI 2.x, Git, Node.js, macOS Keychain authentication, Bash, GitHub REST and GraphQL APIs.

## Global Constraints

1. The approved design is `docs/superpowers/specs/2026-08-03-freeland-personal-staging-repository-design.md` at commit `2836a90247151f967f6189af258d6d2ec259601b` and SHA-256 `7ba95d51f79a52cd1621cb52a354b7277e92e65020dd2cf4f5ff170466c2408e`.
2. The organization source remains private `nuanu-ai/FreelandQA`, repository ID `1319799876`, at `main@a4df0c5e4b57dfda3ed658171452cccda6095d52`. This plan performs no organization write.
3. The new repository name is exactly `solomindanil/FreelandQA-I1`. It is created empty and private. Do not create `solomindanil/FreelandQA`; that legacy URL must continue redirecting to `nuanu-ai/FreelandQA`.
4. GitHub Actions must be read back as disabled before the first code push and remain disabled throughout this plan. No workflow is dispatched, enabled, rerun, or cancelled here.
5. The only remote writes are, in order: create the private empty personal repository, disable its Actions permission, and push the exact entry history to `refs/heads/main` once. No retry, force-push, tag push, feature-branch push, settings change, secret write, PR, merge, deletion, or organization mutation is allowed.
6. Run every block after the repository-absence preflight in one persistent elevated operator shell with macOS Keychain and network access. If that shell is lost after the repository-create request begins, stop for read-only human reconciliation; never start a replacement mutation shell.
7. The organization checkout remains clean and unchanged at `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-publication`. Never change its `origin`.
8. The personal `main` clone is exactly `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication`. It must not exist before the bootstrap and must be a clean separate clone afterward.
9. Never print or persist a GitHub token, credential helper response, private key, password, cookie, PAN, CVV, checkout URL, provider payload, or workflow log. The receipt contains repository metadata only.
10. Any timeout, non-exact read-back, repository-ID change, visibility drift, automatic-merge enablement, unexpected default branch/SHA, workflow run, old-redirect change, dirty checkout, or ambiguous push result stops without cleanup or retry.
11. The new repository is not deleted automatically under any failure condition. Partial external state is preserved for inspection.
12. Completion means only `PERSONAL_BOOTSTRAP_READY`: private repository created, Actions disabled, exact `main` seeded, zero workflow runs, redirect unchanged, separate clone clean, and private receipt closed. It does not mean I0, I1, organization delivery, or release acceptance.

---

## Target Outputs

- Remote create: private `solomindanil/FreelandQA-I1`
- Local create: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication`
- Private create: mode-`0600` `/private/tmp/freeland-personal-bootstrap.*/receipt.v1.json`
- SDD report: this plan's `task-1-report.md`
- No tracked source-file changes

### Task 1: Bootstrap and Prove the Personal Staging Repository

**Files:**

- Read: `.github/workflows/baseline.yml`
- Read: `.github/workflows/patchset.yml`
- Read: `coverage/bootstrap/subproject-1-acceptance.v1.json`
- Read: `coverage/registry.v1.yaml`
- Read: `patchsets/freeland/virtual-numbers-card-canary-20260801/manifest.yaml`
- Create outside Git: one private bootstrap receipt below a fresh `/private/tmp/freeland-personal-bootstrap.*` directory
- Create local clone: `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication`
- External create: private GitHub repository `solomindanil/FreelandQA-I1`

**Interfaces:**

- **Consumes:** approved migration design commit/digest, the clean organization publication checkout, valid `solomindanil` GitHub CLI authentication, and the absent personal repository name.
- **Produces:** `PERSONAL_REPOSITORY_ID`, `FREELAND_PERSONAL_BOOTSTRAP_RECEIPT`, a complete four-operation metadata receipt, and the clean personal `main` clone consumed by the next I0 plan amendment.
- **Receipt operation order:** `repository-create`, `actions-disable`, `seed-main`, `personal-clone-create`.
- **Safety boundary:** after `repository-create` begins, a failed or ambiguous operation is never repeated. Read-only reconciliation is the only permitted follow-up.

- [ ] **Step 1: Run the fresh local and GitHub read-only preflight**

Run from the organization publication checkout. The whole block must run through one
elevated `exec_command` because `gh` reads its token from the macOS Keychain.

```bash
set -euo pipefail
ORGANIZATION_REPOSITORY="nuanu-ai/FreelandQA"
ORGANIZATION_REPOSITORY_ID="1319799876"
PERSONAL_REPOSITORY="solomindanil/FreelandQA-I1"
ENTRY_COMMIT="a4df0c5e4b57dfda3ed658171452cccda6095d52"
ORGANIZATION_ROOT="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-publication"
PERSONAL_PUBLICATION_ROOT="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication"
DESIGN_FILE="/Users/danilsolomin/projectsnew/NuanuFlowQA/docs/superpowers/specs/2026-08-03-freeland-personal-staging-repository-design.md"
DESIGN_COMMIT="2836a90247151f967f6189af258d6d2ec259601b"
DESIGN_SHA256="7ba95d51f79a52cd1621cb52a354b7277e92e65020dd2cf4f5ff170466c2408e"
export ORGANIZATION_REPOSITORY ORGANIZATION_REPOSITORY_ID PERSONAL_REPOSITORY
export ENTRY_COMMIT ORGANIZATION_ROOT PERSONAL_PUBLICATION_ROOT
export DESIGN_FILE DESIGN_COMMIT DESIGN_SHA256

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
    const child=spawn("gh",process.argv.slice(1),{
      stdio:["inherit","pipe","pipe"],shell:false,
    });
    const chunks=[];
    let bytes=0;
    let settled=false;
    let timedOut=false;
    let overflow=false;
    const finish=(success)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(success)process.stdout.write(Buffer.concat(chunks));
      else process.exitCode=1;
    };
    const timer=setTimeout(()=>{
      timedOut=true;
      child.kill("SIGKILL");
    },timeout);
    child.stdout.on("data",(chunk)=>{
      bytes+=chunk.length;
      if(bytes>16*1024*1024){overflow=true;child.kill("SIGKILL");return;}
      chunks.push(chunk);
    });
    child.stderr.on("data",()=>{});
    child.once("error",()=>finish(false));
    child.once("close",(code,signal)=>finish(!timedOut&&!overflow&&code===0&&signal===null));
  ' "$@"
}

read_organization_snapshot() {
  local deadline_ms raw
  deadline_ms=$(( $(monotonic_ms) + 30000 ))
  raw="$(run_gh_until "$deadline_ms" api graphql \
    -f owner=nuanu-ai -f name=FreelandQA \
    -f query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){databaseId visibility autoMergeAllowed defaultBranchRef{name target{... on Commit{oid}}}}}' \
    --jq '.data.repository | {repositoryId:.databaseId,visibility:.visibility,automaticMerge:.autoMergeAllowed,defaultBranch:.defaultBranchRef.name,mainSha:.defaultBranchRef.target.oid}')"
  ORGANIZATION_SNAPSHOT="$raw" node -e '
    const value=JSON.parse(process.env.ORGANIZATION_SNAPSHOT);
    const expected={repositoryId:1319799876,visibility:"PRIVATE",automaticMerge:false,defaultBranch:"main",mainSha:process.env.ENTRY_COMMIT};
    if(JSON.stringify(value)!==JSON.stringify(expected))process.exit(1);
    process.stdout.write(JSON.stringify(value));
  '
}

test "$(pwd -P)" = "$ORGANIZATION_ROOT"
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git remote get-url origin)" = "https://github.com/nuanu-ai/FreelandQA.git"
test "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA check-ignore .worktrees)" = ".worktrees"
test ! -e "$PERSONAL_PUBLICATION_ROOT"
test "$(shasum -a 256 "$DESIGN_FILE" | awk '{print $1}')" = "$DESIGN_SHA256"
test "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA rev-parse "$DESIGN_COMMIT:docs/superpowers/specs/2026-08-03-freeland-personal-staging-repository-design.md")" = "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA hash-object "$DESIGN_FILE")"
git cat-file -e "$ENTRY_COMMIT:.github/workflows/baseline.yml"
git cat-file -e "$ENTRY_COMMIT:.github/workflows/patchset.yml"
git cat-file -e "$ENTRY_COMMIT:coverage/bootstrap/subproject-1-acceptance.v1.json"
git cat-file -e "$ENTRY_COMMIT:coverage/registry.v1.yaml"
git cat-file -e "$ENTRY_COMMIT:patchsets/freeland/virtual-numbers-card-canary-20260801/manifest.yaml"

PREFLIGHT_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" api user --jq .login)" = "solomindanil"
test "$(run_gh_until "$PREFLIGHT_DEADLINE_MS" repo view solomindanil/FreelandQA --json nameWithOwner --jq .nameWithOwner)" = "nuanu-ai/FreelandQA"
PERSONAL_OWNER_REPOSITORIES="$(run_gh_until "$PREFLIGHT_DEADLINE_MS" api \
  --paginate --slurp 'users/solomindanil/repos?per_page=100&type=owner')"
PERSONAL_OWNER_REPOSITORIES="$PERSONAL_OWNER_REPOSITORIES" node -e '
  const pages=JSON.parse(process.env.PERSONAL_OWNER_REPOSITORIES);
  if(!Array.isArray(pages)||pages.some((page)=>!Array.isArray(page)))process.exit(1);
  const matches=pages.flat().filter((repository)=>
    repository&&repository.full_name===process.env.PERSONAL_REPOSITORY);
  if(matches.length!==0)process.exit(1);
'
ORGANIZATION_BEFORE="$(read_organization_snapshot)"
export ORGANIZATION_BEFORE

npm run verify:deterministic
test -z "$(git status --porcelain)"
test "$(read_organization_snapshot)" = "$ORGANIZATION_BEFORE"
```

Expected: every exact local/GitHub assertion passes, the exhaustive authenticated REST
owner-list contains zero exact target matches, `npm run verify:deterministic` exits 0,
and the legacy personal URL still resolves to the organization repository. Stop before
Step 2 on any failure.

- [ ] **Step 2: Initialize the private receipt before the first mutation**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
BOOTSTRAP_DIR="$(mktemp -d /private/tmp/freeland-personal-bootstrap.XXXXXX)"
chmod 700 "$BOOTSTRAP_DIR"
FREELAND_PERSONAL_BOOTSTRAP_RECEIPT="$BOOTSTRAP_DIR/receipt.v1.json"
export BOOTSTRAP_DIR FREELAND_PERSONAL_BOOTSTRAP_RECEIPT

append_bootstrap_operation() {
  BOOTSTRAP_OPERATION_JSON="$1" node -e '
    const fs=require("node:fs");
    const file=process.env.FREELAND_PERSONAL_BOOTSTRAP_RECEIPT;
    const value=JSON.parse(fs.readFileSync(file,"utf8"));
    value.operations.push(JSON.parse(process.env.BOOTSTRAP_OPERATION_JSON));
    const next=`${file}.next`;
    fs.writeFileSync(next,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
    fs.renameSync(next,file);
  '
}

node -e '
  const fs=require("node:fs");
  const value={
    schemaVersion:1,
    repositoryRole:"personal-staging",
    designCommit:process.env.DESIGN_COMMIT,
    designSha256:process.env.DESIGN_SHA256,
    source:{
      repository:process.env.ORGANIZATION_REPOSITORY,
      repositoryId:Number(process.env.ORGANIZATION_REPOSITORY_ID),
      entryCommit:process.env.ENTRY_COMMIT,
    },
    target:{
      repository:process.env.PERSONAL_REPOSITORY,
      repositoryId:null,
      visibility:"PRIVATE",
      viewerPermission:"ADMIN",
      defaultBranch:"main",
      entryCommit:process.env.ENTRY_COMMIT,
      automaticMerge:false,
      actionsEnabled:false,
    },
    operations:[],
    status:"preflight-passed",
  };
  fs.writeFileSync(process.env.FREELAND_PERSONAL_BOOTSTRAP_RECEIPT,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
'
test "$(stat -f '%Lp' "$BOOTSTRAP_DIR")" = "700"
test "$(stat -f '%Lp' "$FREELAND_PERSONAL_BOOTSTRAP_RECEIPT")" = "600"
```

Expected: the receipt exists with no target repository ID and no operations. Do not
print it. Record its absolute path in the Task 1 report even if a later operation fails.

- [ ] **Step 3: Create the empty private repository exactly once**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
CREATE_BEFORE="$ORGANIZATION_BEFORE"
CREATE_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
CREATE_RESULT="$(run_gh_until "$CREATE_DEADLINE_MS" api --method POST user/repos \
  -f name=FreelandQA-I1 -F private=true -F auto_init=false \
  --jq '{repositoryId:.id,fullName:.full_name,private:.private,defaultBranch:.default_branch,visibility:.visibility,allowAutoMerge:.allow_auto_merge,owner:.owner.login}')"
PERSONAL_REPOSITORY_ID="$(CREATE_RESULT="$CREATE_RESULT" node -e '
  const value=JSON.parse(process.env.CREATE_RESULT);
  if(!Number.isSafeInteger(value.repositoryId)||value.repositoryId<1
    ||value.fullName!==process.env.PERSONAL_REPOSITORY||value.private!==true
    ||value.visibility!=="private"||value.allowAutoMerge!==false
    ||value.owner!=="solomindanil")process.exit(1);
  process.stdout.write(String(value.repositoryId));
')"
export PERSONAL_REPOSITORY_ID
CREATE_AFTER="$(read_organization_snapshot)"
test "$CREATE_AFTER" = "$CREATE_BEFORE"
CREATE_OPERATION="$(BEFORE="$CREATE_BEFORE" AFTER="$CREATE_AFTER" node -e '
  process.stdout.write(JSON.stringify({
    operation:"repository-create",
    sourceBefore:JSON.parse(process.env.BEFORE),
    sourceAfter:JSON.parse(process.env.AFTER),
    targetRepository:process.env.PERSONAL_REPOSITORY,
    targetRepositoryId:Number(process.env.PERSONAL_REPOSITORY_ID),
    result:"private_empty_repository_observed",
  }));
')"
append_bootstrap_operation "$CREATE_OPERATION"
```

Expected: one new private empty repository with a positive safe-integer ID. Any failed
or ambiguous create response stops permanently; do not issue a second create request.

- [ ] **Step 4: Disable Actions before the seed push and prove the empty state**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
read_personal_snapshot() {
  local deadline_ms raw
  deadline_ms=$(( $(monotonic_ms) + 30000 ))
  raw="$(run_gh_until "$deadline_ms" api graphql \
    -f owner=solomindanil -f name=FreelandQA-I1 \
    -f query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){databaseId visibility viewerPermission autoMergeAllowed defaultBranchRef{name target{... on Commit{oid}}}}}' \
    --jq '.data.repository | {repositoryId:.databaseId,visibility:.visibility,viewerPermission:.viewerPermission,automaticMerge:.autoMergeAllowed,defaultBranch:(.defaultBranchRef.name // null),mainSha:(.defaultBranchRef.target.oid // null)}')"
  PERSONAL_SNAPSHOT="$raw" node -e '
    const value=JSON.parse(process.env.PERSONAL_SNAPSHOT);
    if(!Number.isSafeInteger(value.repositoryId)||value.repositoryId!==Number(process.env.PERSONAL_REPOSITORY_ID)
      ||value.visibility!=="PRIVATE"||value.viewerPermission!=="ADMIN"
      ||value.automaticMerge!==false)process.exit(1);
    process.stdout.write(JSON.stringify(value));
  '
}

ACTIONS_BEFORE="$(read_personal_snapshot)"
test "$(ACTIONS_BEFORE="$ACTIONS_BEFORE" node -e '
  const value=JSON.parse(process.env.ACTIONS_BEFORE);
  process.stdout.write(String(value.defaultBranch===null&&value.mainSha===null));
')" = "true"
ACTIONS_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
run_gh_until "$ACTIONS_DEADLINE_MS" api --method PUT \
  "repos/$PERSONAL_REPOSITORY/actions/permissions" -F enabled=false >/dev/null
test "$(run_gh_until "$ACTIONS_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)" = "false"
test "$(run_gh_until "$ACTIONS_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/runs?per_page=1" --jq .total_count)" = "0"
ACTIONS_AFTER="$(read_personal_snapshot)"
test "$ACTIONS_AFTER" = "$ACTIONS_BEFORE"
test "$(read_organization_snapshot)" = "$ORGANIZATION_BEFORE"
ACTIONS_OPERATION="$(BEFORE="$ACTIONS_BEFORE" AFTER="$ACTIONS_AFTER" node -e '
  process.stdout.write(JSON.stringify({
    operation:"actions-disable",
    before:JSON.parse(process.env.BEFORE),
    after:JSON.parse(process.env.AFTER),
    actionsEnabled:false,
    workflowRunCount:0,
    result:"observed_no_drift",
  }));
')"
append_bootstrap_operation "$ACTIONS_OPERATION"
```

Expected: Actions is exactly disabled, the repository is still empty, automatic merge
is false, and there are zero workflow runs. Do not proceed on a failed read-back.

- [ ] **Step 5: Seed exact `main` once and prove no workflow ran**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
SEED_BEFORE="$(read_personal_snapshot)"
test "$SEED_BEFORE" = "$ACTIONS_AFTER"
PERSONAL_URL="https://github.com/solomindanil/FreelandQA-I1.git"
export PERSONAL_URL
/usr/bin/perl -e 'alarm shift; exec @ARGV' 120 \
  git -C "$ORGANIZATION_ROOT" push "$PERSONAL_URL" \
  "$ENTRY_COMMIT:refs/heads/main"
SEED_AFTER="$(read_personal_snapshot)"
SEED_AFTER="$SEED_AFTER" node -e '
  const value=JSON.parse(process.env.SEED_AFTER);
  const expected={
    repositoryId:Number(process.env.PERSONAL_REPOSITORY_ID),
    visibility:"PRIVATE",
    viewerPermission:"ADMIN",
    automaticMerge:false,
    defaultBranch:"main",
    mainSha:process.env.ENTRY_COMMIT,
  };
  if(JSON.stringify(value)!==JSON.stringify(expected))process.exit(1);
'
SEED_READ_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
test "$(run_gh_until "$SEED_READ_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)" = "false"
test "$(run_gh_until "$SEED_READ_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/runs?per_page=1" --jq .total_count)" = "0"
test "$(run_gh_until "$SEED_READ_DEADLINE_MS" repo view \
  solomindanil/FreelandQA --json nameWithOwner --jq .nameWithOwner)" = "nuanu-ai/FreelandQA"
test "$(read_organization_snapshot)" = "$ORGANIZATION_BEFORE"
SEED_OPERATION="$(BEFORE="$SEED_BEFORE" AFTER="$SEED_AFTER" node -e '
  process.stdout.write(JSON.stringify({
    operation:"seed-main",
    before:JSON.parse(process.env.BEFORE),
    after:JSON.parse(process.env.AFTER),
    ref:"refs/heads/main",
    pushedCommit:process.env.ENTRY_COMMIT,
    forced:false,
    actionsEnabled:false,
    workflowRunCount:0,
    legacyRedirectTarget:"nuanu-ai/FreelandQA",
    result:"exact_main_observed",
  }));
')"
append_bootstrap_operation "$SEED_OPERATION"
```

Expected: personal `main` equals the entry commit, Actions remains disabled, no run was
created, the organization source is unchanged, and the old redirect still resolves to
the organization repository. If `git push` times out or returns nonzero, stop and
reconcile with read-only commands; never push again automatically.

- [ ] **Step 6: Create and verify the separate personal publication clone**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
test ! -e "$PERSONAL_PUBLICATION_ROOT"
/usr/bin/perl -e 'alarm shift; exec @ARGV' 120 \
  git clone --no-tags --single-branch --branch main \
  "$PERSONAL_URL" "$PERSONAL_PUBLICATION_ROOT"
test "$(git -C "$PERSONAL_PUBLICATION_ROOT" rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git -C "$PERSONAL_PUBLICATION_ROOT" branch --show-current)" = "main"
test "$(git -C "$PERSONAL_PUBLICATION_ROOT" remote get-url origin)" = "$PERSONAL_URL"
test -z "$(git -C "$PERSONAL_PUBLICATION_ROOT" status --porcelain)"
test "$(git -C "$ORGANIZATION_ROOT" remote get-url origin)" = "https://github.com/nuanu-ai/FreelandQA.git"
test -z "$(git -C "$ORGANIZATION_ROOT" status --porcelain)"
CLONE_OPERATION="$(node -e '
  process.stdout.write(JSON.stringify({
    operation:"personal-clone-create",
    path:process.env.PERSONAL_PUBLICATION_ROOT,
    repository:process.env.PERSONAL_REPOSITORY,
    repositoryId:Number(process.env.PERSONAL_REPOSITORY_ID),
    branch:"main",
    headSha:process.env.ENTRY_COMMIT,
    clean:true,
    result:"exact_clone_observed",
  }));
')"
append_bootstrap_operation "$CLONE_OPERATION"
```

Expected: a separate clean personal clone exists at the exact path. The organization
checkout remains clean with its original organization `origin`.

- [ ] **Step 7: Close and validate the bootstrap receipt**

Continue in the same persistent elevated shell:

```bash
set -euo pipefail
node -e '
  const fs=require("node:fs");
  const file=process.env.FREELAND_PERSONAL_BOOTSTRAP_RECEIPT;
  const value=JSON.parse(fs.readFileSync(file,"utf8"));
  const expected=["repository-create","actions-disable","seed-main","personal-clone-create"];
  const personalRepositoryId=Number(process.env.PERSONAL_REPOSITORY_ID);
  if(!Number.isSafeInteger(personalRepositoryId)||personalRepositoryId<1)process.exit(1);
  if(value.schemaVersion!==1||value.repositoryRole!=="personal-staging"
    ||value.designCommit!==process.env.DESIGN_COMMIT
    ||value.designSha256!==process.env.DESIGN_SHA256
    ||value.source.repository!==process.env.ORGANIZATION_REPOSITORY
    ||value.source.repositoryId!==Number(process.env.ORGANIZATION_REPOSITORY_ID)
    ||value.source.entryCommit!==process.env.ENTRY_COMMIT
    ||value.target.repository!==process.env.PERSONAL_REPOSITORY
    ||value.target.repositoryId!==null
    ||value.target.visibility!=="PRIVATE"
    ||value.target.viewerPermission!=="ADMIN"
    ||value.target.defaultBranch!=="main"
    ||value.target.entryCommit!==process.env.ENTRY_COMMIT
    ||value.target.automaticMerge!==false
    ||value.target.actionsEnabled!==false
    ||value.status!=="preflight-passed"
    ||JSON.stringify(value.operations.map((item)=>item.operation))!==JSON.stringify(expected))process.exit(1);
  value.target.repositoryId=personalRepositoryId;
  value.status="PERSONAL_BOOTSTRAP_READY";
  const next=`${file}.next`;
  fs.writeFileSync(next,`${JSON.stringify(value)}\n`,{encoding:"utf8",mode:0o600,flag:"wx"});
  fs.renameSync(next,file);
'
test "$(stat -f '%Lp' "$FREELAND_PERSONAL_BOOTSTRAP_RECEIPT")" = "600"
FINAL_PERSONAL_SNAPSHOT="$(read_personal_snapshot)"
test "$FINAL_PERSONAL_SNAPSHOT" = "$SEED_AFTER"
FINAL_READ_DEADLINE_MS=$(( $(monotonic_ms) + 120000 ))
test "$(run_gh_until "$FINAL_READ_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/permissions" --jq .enabled)" = "false"
test "$(run_gh_until "$FINAL_READ_DEADLINE_MS" api \
  "repos/$PERSONAL_REPOSITORY/actions/runs?per_page=1" --jq .total_count)" = "0"
test "$(read_organization_snapshot)" = "$ORGANIZATION_BEFORE"
test "$(run_gh_until "$FINAL_READ_DEADLINE_MS" repo view \
  solomindanil/FreelandQA --json nameWithOwner --jq .nameWithOwner)" = "nuanu-ai/FreelandQA"
printf 'PERSONAL_BOOTSTRAP_READY repositoryId=%s receipt=%s\n' \
  "$PERSONAL_REPOSITORY_ID" "$FREELAND_PERSONAL_BOOTSTRAP_RECEIPT"
```

Expected stdout contains only the non-secret repository ID and private receipt path.
The receipt is not printed. Record both values in the SDD report and ledger. Do not
enable Actions or begin the personal I0 gate in this task.

- [ ] **Step 8: Perform the task-scoped read-only review**

The reviewer independently re-reads, without mutation:

```bash
set -euo pipefail
test "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication rev-parse HEAD)" = "a4df0c5e4b57dfda3ed658171452cccda6095d52"
test "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication remote get-url origin)" = "https://github.com/solomindanil/FreelandQA-I1.git"
test -z "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication status --porcelain)"
```

The reviewer also uses elevated read-only GitHub calls to require: repository owner
`solomindanil`, exact `viewerPermission=ADMIN`, private visibility, the report's exact
positive repository ID, default branch `main`, exact entry SHA, automatic merge false,
Actions disabled, zero workflow runs, and the unchanged legacy redirect. Spec
compliance and task quality must both be approved before this task is marked complete.

## Acceptance Matrix

| Requirement | Proof |
|---|---|
| Personal name was absent | Exhaustive authenticated REST owner-list has zero exact target matches |
| Organization source unchanged | Exact source snapshot before/after every remote operation |
| Repository private from creation | Create response plus GraphQL read-back |
| Actual repository ID captured | Positive safe integer in receipt/report and independent review |
| Actions disabled before push | Exact permissions read-back while repository is empty |
| Seed is exact and singular | One non-force refspec push, exact remote `main` read-back |
| No uncontrolled CI | Actions disabled and total workflow runs exactly zero after seed |
| Redirect preserved | `solomindanil/FreelandQA` still resolves to `nuanu-ai/FreelandQA` |
| Local custody separated | Personal clean clone has personal origin; organization clone unchanged |
| Failure is inspectable | No automatic retry, cleanup, force, or deletion |
| Phase boundary explicit | Receipt status exactly `PERSONAL_BOOTSTRAP_READY`; Actions remain disabled |

## Execution Handoff

Execute Task 1 with `superpowers:subagent-driven-development`. The owner's previously
selected execution mode is option 1 (fresh implementation agent plus task-scoped
review). After a clean review, stop this plan. Use the captured repository ID and
receipt path to write and approve a separate amendment of
`2026-08-02-freeland-agent-first-cdp-feedback-loop.md`; do not enable Actions, write a
secret, dispatch a workflow, or start Tasks 2–16 before that amendment is committed.

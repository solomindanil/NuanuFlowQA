# Freeland Personal I0 Inventory CLI Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `superpowers:test-driven-development` for the RED/GREEN cycle and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Replace the five GitHub CLI-incompatible personal-I0 inventory checks with bounded, fail-closed paginated parsers and produce one complete observable `RECONCILIATION_OK` proof.

**Architecture:** Keep `gh api --paginate --slurp` as the sole pagination transport and remove GitHub CLI formatting from those requests. A closed Bash helper selects one of five exact endpoints, while one in-memory Node parser validates endpoint-specific page shapes and returns only a non-negative integer count. The existing read-only checker and tracked I0 plan use the same helper contract; no remote mutation is permitted.

**Tech Stack:** Bash, GitHub CLI 2.x, Node.js, Git, macOS Keychain authentication.

## Global Constraints

1. Start from parent repository `HEAD` `4a25124e26c14ce701b57d7acd0f0f1e71ab5f96`. Preserve every unrelated tracked/untracked user change.
2. Modify only tracked `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md`. The checker, reports, briefs, ledgers, and parser test harness remain gitignored SDD artifacts.
3. Personal repository is exactly `solomindanil/FreelandQA-I1`, database ID `1322022755`; organization target is exactly `nuanu-ai/FreelandQA`, database ID `1319799876`; entry commit is exactly `a4df0c5e4b57dfda3ed658171452cccda6095d52`.
4. This plan performs GitHub reads only. Remote write count must remain `0`: no secret write, Actions enablement, workflow dispatch, branch/ref write, settings mutation, PR, merge, rerun, cancellation, deletion, or Task 2 operation.
5. The five incompatible Task 1 calls are Actions runs, non-`main` branches, tags, all-state pull requests, and deploy keys. Remove `--jq` from each paginated request; never combine `--slurp` with `--jq` or `--template`.
6. Preserve the audited `run_gh_until` per-request ceiling of `30000` ms, global read envelope of `600000` ms, 16 MiB stdout cap, suppressed `gh` stderr, `set -euo pipefail`, and no automatic retry.
7. The helper accepts only `actions-runs`, `extra-branches`, `tags`, `pulls`, or `deploy-keys`; it derives the endpoint internally and rejects every other value before invoking `gh`.
8. Raw paginated JSON stays in memory and is never printed or persisted. The parser emits only one canonical decimal count without whitespace other than its final process flush.
9. The parser rejects malformed JSON, an empty outer page list, wrong page container type, malformed entries, invalid IDs/names, duplicate identities, Actions `total_count` mismatch, or a branch inventory that does not contain exactly one `main`.
10. The fixed checker retains fail-only closed step diagnostics. Success stdout is exactly `RECONCILIATION_OK`; failure output contains no raw response, token, receipt content, secret value, credential material, or workflow log.
11. The durable receipt remains mode `0600`, non-symlink, single-link, SHA-256 `991f07ac9e11533c99b7605cd069bfe866055ea479578f088a270e98b4e4ec58`; personal publication clone remains clean.
12. Completion closes only original Task 1 as `BOOTSTRAP_CUSTODY_READY`. It does not claim `PERSONAL_I0_READY`, organization delivery, release acceptance, or payment permission.

## Target Files

- Modify tracked: `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md`
- Modify ignored checker: `.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh`
- Create ignored fixtures: `.superpowers/sdd/2026-08-04-freeland-personal-i0-inventory-cli-compatibility/inventory-parser-tests.mjs`
- Append ignored history: `.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-report.md`
- Regenerate ignored brief: `.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-brief.md`
- Create this plan's SDD task report/reviews in its own workspace

---

### Task 1: Replace Invalid Inventory Formatting and Close the Read-Only Gate

**Files:**

- Modify: `docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md` Task 1 Step 3 only
- Modify ignored: `.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh`
- Create ignored: this corrective plan's `inventory-parser-tests.mjs`
- Append ignored: original `task-1-report.md`
- Regenerate ignored: original `task-1-brief.md`

**Interfaces:**

- **Consumes:** exact Task 1 repository/source state already validated through S10, audited `run_gh_until(deadline, ...args)`, and the five fixed endpoint identities.
- **Produces:** `read_inventory_count(kind, deadline_ms) -> stdout decimal count`, tracked executable plan text, fixed ignored checker, and one exact successful full reconciliation.
- **Safety boundary:** every `gh` call is GET/read-only; any helper/parser/checker failure stops without retry or external cleanup.

- [ ] **Step 1: Record the exact RED evidence and write parser fixture tests first**

The already observed RED is authoritative and must be copied into the report without rerunning the full checker:

```text
checker: exit 1, RECONCILIATION_FAILED step=S11_ACTIONS_RUNS_EMPTY status=1
focused CLI reproduction: exit 1
the --slurp option is not supported with --jq or --template
```

Create `inventory-parser-tests.mjs` with the parser behavior below before editing the tracked plan or checker:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = (values) => new Set(values).size === values.length;

export function countInventory(kind, pages) {
  assert.ok(Array.isArray(pages) && pages.length > 0);

  if (kind === 'actions-runs') {
    assert.ok(pages.every((page) => isObject(page)
      && Number.isSafeInteger(page.total_count) && page.total_count >= 0
      && Array.isArray(page.workflow_runs)));
    const entries = pages.flatMap((page) => page.workflow_runs);
    const ids = entries.map((entry) => {
      assert.ok(isObject(entry) && Number.isSafeInteger(entry.id) && entry.id > 0);
      return entry.id;
    });
    assert.ok(unique(ids));
    assert.ok(pages.every((page) => page.total_count === entries.length));
    return entries.length;
  }

  assert.ok(pages.every(Array.isArray));
  const entries = pages.flat();

  if (kind === 'extra-branches' || kind === 'tags') {
    const names = entries.map((entry) => {
      assert.ok(isObject(entry) && typeof entry.name === 'string' && entry.name.length > 0);
      return entry.name;
    });
    assert.ok(unique(names));
    if (kind === 'extra-branches') {
      assert.equal(names.filter((name) => name === 'main').length, 1);
      return names.filter((name) => name !== 'main').length;
    }
    return names.length;
  }

  if (kind === 'pulls' || kind === 'deploy-keys') {
    const identityField = kind === 'pulls' ? 'number' : 'id';
    const ids = entries.map((entry) => {
      assert.ok(isObject(entry) && Number.isSafeInteger(entry[identityField]) && entry[identityField] > 0);
      return entry[identityField];
    });
    assert.ok(unique(ids));
    return ids.length;
  }

  throw new Error('unsupported inventory kind');
}

assert.equal(countInventory('actions-runs', [{total_count: 0, workflow_runs: []}]), 0);
assert.equal(countInventory('extra-branches', [[{name: 'main'}]]), 0);
assert.equal(countInventory('tags', [[]]), 0);
assert.equal(countInventory('pulls', [[]]), 0);
assert.equal(countInventory('deploy-keys', [[]]), 0);
assert.equal(countInventory('actions-runs', [
  {total_count: 2, workflow_runs: [{id: 1}]},
  {total_count: 2, workflow_runs: [{id: 2}]},
]), 2);
assert.equal(countInventory('extra-branches', [[{name: 'main'}, {name: 'feature'}]]), 1);
assert.throws(() => countInventory('actions-runs', []));
assert.throws(() => countInventory('actions-runs', [{total_count: 1, workflow_runs: []}]));
assert.throws(() => countInventory('extra-branches', [[]]));
assert.throws(() => countInventory('extra-branches', [[{name: 'main'}, {name: 'main'}]]));
assert.throws(() => countInventory('tags', [[{name: ''}]]));
assert.throws(() => countInventory('pulls', [[{number: 1}, {number: 1}]]));
assert.throws(() => countInventory('deploy-keys', [[{id: 0}]]));
assert.throws(() => countInventory('unknown', [[]]));

const implementationFiles = [
  'docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md',
  '.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh',
];
const incompatible = /--slurp[^\n]*--(?:jq|template)|--(?:jq|template)[^\n]*--slurp/g;
for (const file of implementationFiles) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal((text.match(incompatible) ?? []).length, 0);
  assert.ok(text.includes('read_inventory_count()'));
}
process.stdout.write('INVENTORY_PARSER_FIXTURES_OK\n');
```

Run before production changes:

```bash
node .superpowers/sdd/2026-08-04-freeland-personal-i0-inventory-cli-compatibility/inventory-parser-tests.mjs
```

Expected RED: the fixture process fails at the compatibility assertion because each implementation file still contains exactly five incompatible calls and lacks `read_inventory_count()`. Confirm the failure is `actual: 5, expected: 0`, not a syntax/path error. Do not edit the test to make it pass.

- [ ] **Step 2: Add the closed parser helper to the tracked plan**

Insert after `run_gh_until()` in Task 1 Step 3:

```bash
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
```

Replace only the five incompatible checks with:

```bash
test "$(read_inventory_count actions-runs "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count extra-branches "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count tags "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count pulls "$READ_DEADLINE_MS")" = "0"
test "$(read_inventory_count deploy-keys "$READ_DEADLINE_MS")" = "0"
```

Do not modify Task 2 or any other Task 1 assertion.

- [ ] **Step 3: Apply the identical helper contract to the ignored checker**

Insert the same `read_inventory_count()` implementation after `run_gh_until()` in the checker and replace S11–S15 commands with the five helper calls, preserving their existing `CURRENT_STEP` values and ERR trap.

Regenerate the original Task 1 brief:

```bash
/Users/danilsolomin/.codex/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/subagent-driven-development/scripts/task-brief \
  /Users/danilsolomin/projectsnew/NuanuFlowQA/docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md 1
```

Expected: the regenerated brief contains the helper and no invalid five-call forms.

- [ ] **Step 4: Run GREEN parser, compatibility, and syntax gates**

Run:

```bash
node .superpowers/sdd/2026-08-04-freeland-personal-i0-inventory-cli-compatibility/inventory-parser-tests.mjs
node -e '
  const fs=require("node:fs");
  const files=[
    "docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md",
    ".superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh",
  ];
  for(const file of files){
    const text=fs.readFileSync(file,"utf8");
    if(/--slurp[^\n]*--(?:jq|template)|--(?:jq|template)[^\n]*--slurp/.test(text))process.exit(1);
  }
  process.stdout.write("GH_FORMAT_COMPATIBILITY_OK\n");
'
bash -n .superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh
node -e '
  const fs=require("node:fs");
  const text=fs.readFileSync("docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md","utf8");
  const blocks=[...text.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match)=>match[1]);
  process.stdout.write(blocks.join("\n"));
' | bash -n
git diff --check -- docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md
```

Expected: `INVENTORY_PARSER_FIXTURES_OK`, `GH_FORMAT_COMPATIBILITY_OK`, both Bash syntax checks exit `0`, and diff check is clean.

- [ ] **Step 5: Execute exactly one full read-only reconciliation**

Run the checker exactly once through elevated `exec_command` from the personal publication clone:

```bash
bash /Users/danilsolomin/projectsnew/NuanuFlowQA/.superpowers/sdd/2026-08-04-freeland-personal-i0-entry-gate/task-1-readonly-reconcile.sh
```

If it yields an existing cell/session ID, wait only that same execution. Do not start a second process. Expected exact result:

```text
exit_code=0
RECONCILIATION_OK
```

Any other exit/output leaves Task 1 unproven and stops without retry. Never print raw responses or workflow logs.

- [ ] **Step 6: Close evidence, commit only the tracked plan, and report**

Recheck locally:

```bash
test "$(stat -f '%Lp' /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/bootstrap-receipt.v1.json)" = "600"
test "$(stat -f '%l' /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/bootstrap-receipt.v1.json)" = "1"
test "$(shasum -a 256 /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication/evidence/private/personal-i0/bootstrap-receipt.v1.json | awk '{print $1}')" = "991f07ac9e11533c99b7605cd069bfe866055ea479578f088a270e98b4e4ec58"
test -z "$(git -C /Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-personal-publication status --porcelain)"
```

Append a corrective closure section to the original Task 1 report with RED, fixture/static GREEN, exact checker exit/marker, receipt custody, remote writes `0`, and Task 2 untouched. Write this corrective plan's full task report in its own SDD workspace.

Stage and commit only the tracked entry-gate plan:

```bash
git add docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md
test "$(git diff --cached --name-only)" = "docs/superpowers/plans/2026-08-04-freeland-personal-i0-entry-gate.md"
git diff --cached --check
git commit -m "docs: fix personal I0 paginated inventories"
```

Expected: one commit containing only the helper insertion and five call replacements. The task report returns `DONE`, `BOOTSTRAP_CUSTODY_READY`, full commit SHA, exact local/remote verification summary, and no concerns.

## Acceptance

1. Original Task 1 plan/brief/checker contain no `--slurp` combined with `--jq` or `--template`.
2. Parser fixtures prove five zero inventories, two positive inventories, malformed-shape rejection, duplicate rejection, Actions total mismatch rejection, missing-main rejection, and unknown-kind rejection.
3. The helper endpoint is derived from a five-value closed kind allowlist.
4. Raw JSON is bounded, kept in memory, validated by endpoint type, and never printed/persisted.
5. One full checker exits `0` with exact `RECONCILIATION_OK`; no other execution is used as completion evidence.
6. Receipt custody and personal publication cleanliness remain exact.
7. Remote writes remain `0`; Task 2 remains untouched.
8. The tracked commit contains only the original entry-gate plan amendment.
9. Original Task 1 blocker may be marked resolved only after clean task review and final corrective-plan review.

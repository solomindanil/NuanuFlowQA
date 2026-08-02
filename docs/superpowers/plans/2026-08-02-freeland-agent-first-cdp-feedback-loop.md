# Freeland Agent-First CDP Feedback Loop I0/I1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fail-closed, typed, read-only CDP capability broker that lets an agent inspect explicitly approved public Freeland staging routes without receiving raw CDP access, persisting sensitive browser data, or mutating Freeland or Nuanu Flow.

**Architecture:** Complete the existing repository/publication gate first, then implement the broker inside the private `FreelandQA` repository. A long-lived local daemon owns an ephemeral Chrome profile and an inherited `--remote-debugging-pipe`; no TCP debugging endpoint exists. Agent commands reach the daemon only through a private Unix socket and versioned JSON contracts. A daemon-owned, capability-authenticated allow-one CONNECT proxy plus catch-all Chrome resolver/transport lockdown makes browser egress fail closed; proxy credentials exist only in daemon memory and are answered through the guarded CDP auth challenge. A direct-child watchdog kills Chrome if the daemon lifetime pipe disappears. Candidate attestation, browser-wide target/request interception, semantic projection, public screenshot policy, and private artifact storage all fail closed and remain separate from the existing product payment harness.

**Tech Stack:** Node.js 20, npm, TypeScript 6, Node test runner, Ajv 8, YAML 2, the closed reviewed macOS runtime `Chrome/150.0.7871.187` with CDP `1.3`, null-delimited Chrome DevTools Protocol over inherited OS pipes behind a typed broker, GitHub Actions, GitHub CLI.

## Global Constraints

1. This plan implements only design iterations `I0` and `I1`. Authenticated sessions, Nuanu ticket polling, product worktree fixes, Computer Use, Telegram, mutations, payments, and automatic routing remain out of scope.
2. Execute repository changes only in the authoritative clean publication checkout `/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-publication`, or in a new worktree created from its `origin/main`. Do not use the stale partial checkout `/Users/danilsolomin/projectsnew/FreelandQA`.
3. Invoke `superpowers:using-git-worktrees` at execution time and create branch `codex/freeland-agent-first-cdp-i1` only after Task 1 is green.
4. The audited remote baseline is private `nuanu-ai/FreelandQA` `main@a4df0c5e4b57dfda3ed658171452cccda6095d52`.
5. As observed on 2026-08-02, Baseline run `30731560482` passed on that commit and Patchset run `30731560480` failed because `FREELAND_SOURCE_DEPLOY_KEY` was absent. Re-read GitHub before acting; the observation is not a substitute for the Task 1 gate.
6. The repository was transferred with human approval to `nuanu-ai/FreelandQA` while preserving its private visibility, repository ID, and exact entry commit. Immediately after transfer the authenticated user has `WRITE` on `nuanu-ai/FreelandQA` and `MAINTAIN` on `nuanu-ai/freeland_app`; Task 1 therefore also requires an organization owner to grant repository `ADMIN` and enable a GitHub plan that supports protected branches on private organization repositories. Product-repository deploy-key read-back still requires the product administrator.
7. Do not begin Task 2 until Task 1 proves both required workflows successful on the exact entry commit, read-only source access, and protected `main`.
8. Never paste, print, commit, or attach a private key, password, bearer token, cookie, storage state, PAN, CVV, checkout URL, provider payload, personal email, phone number, VPN credential, Telegram init data, raw DOM, raw AX tree, request/response body, or browser profile.
9. The first live target is exactly `https://mf0.forum`; `mf0.store`, foreign Supabase projects, provider origins, unknown origins, and unknown URL schemes fail closed.
10. The staging Supabase project is exactly `qsxsiunkflfumhcluyhv`. This public project reference is policy identity, not a credential.
11. The broker starts with a fresh unauthenticated profile. It never reads the existing Playwright auth files or the current human-operated payment Chrome profile.
12. Agent-facing commands never accept a URL, CSS/XPath selector, CDP method, JavaScript expression, filesystem path, header, body, or arbitrary JSON object. Navigation uses reviewed route IDs only.
13. Chrome uses only `--remote-debugging-pipe`; launching with a debugging port, writing `DevToolsActivePort`, or exposing an endpoint path is forbidden. Only the daemon inherits the pipe handles. Command output contains a random session alias but never a pipe handle, target ID, profile path, Unix socket path, watchdog PID, or Chrome PID.
14. Chrome starts with `--no-startup-window`. Browser auto-attach is installed before the broker creates its sole `about:blank` page, and every page/descendant target must arrive paused and be guarded before execution. A pre-existing page, a target with `waitingForDebugger !== true`, or a target that cannot install interception is a `POLICY_BLOCK`; do not reproduce the payment harness's dedicated-worker tolerance in this read-only broker.
15. Default request policy permits only reviewed same-origin, bodyless `GET` and `HEAD` reads with no authorization/cookie/content/method-override/custom `x-*` headers. All other methods, writes, direct Supabase access, WebSocket/WebTransport/WebRTC/Direct Socket capability, local-discovery/media-routing capability, redirects outside policy, popups, unknown workers, and unclassified resource paths are blocked before target resume or request continuation.
16. Raw CDP payloads may exist only in daemon memory. Only schema-valid, bounded, capture-time-sanitized derivatives may be logged, returned, or written.
17. Public screenshots require a fresh unauthenticated profile, a `public-safe` route, frozen execution/rendering, a verified fixed stylesheet that hides every descendant and paints one fixed opaque viewport cover, no sensitive frame/authenticated marker, exact all-pixel equality with that fixed cover, a 4096×4096 decoded-pixel bound, and a 5 MiB encoded bound.
18. Artifacts live only below the ignored `artifacts/cdp/` root. Directories are `0700`, regular files are `0600`, and sanitized-artifact retention is seven days. A crashed session's raw profile is released immediately on the next startup once every exact process identity is proven absent; mismatch is quarantined rather than deleted unsafely.
19. Deterministic CI never contacts staging or starts real Chrome. The synthetic loopback real-Chrome security smoke and live staging smoke are separate local macOS acceptance commands and are not merge gates.
20. Existing product source worktrees, CDP/payment files, and assertions are not edited. Final acceptance creates an OS-temporary detached checkout at the active manifest's exact base commit, applies only the repository-owned immutable patchset verifier to reach its exact final tree, reruns the full accepted product CDP harness, and requires at least the existing 154 tests with zero failures and an unchanged verified index/worktree tuple.
21. Do not mutate a Nuanu issue, product object, account, checkout, payment, analytics event, provider resource, or application/customer/Telegram/email message in any task. The only external writes are the exact repository-scoped GitHub secret, workflow dispatch, branch-protection, branch, PR, and sanitized PR-comment operations explicitly enumerated in Tasks 1 and 16.
22. Use `.invalid` domains and runtime-generated secret-shaped fixtures in unit tests. Do not hardcode a Luhn-valid number or numeric security code in source.
23. Every implementation checkbox follows red → green → `git diff --check`; each task ends with a focused commit containing only its listed files.
24. Threat model: staging/page content, network destinations, malformed CDP, crashes, and accidental/cooperative-agent escape attempts are untrusted; the local macOS user account and same-UID process/filesystem introspection are trusted. `0600` files, the private socket, and in-memory proxy capability prevent normal API/confused-deputy use but do not claim isolation from a malicious same-UID debugger that reads daemon memory/profile files. Adversarial-agent isolation requires a separate OS identity/container and is deferred to a later reviewed iteration; acceptance wording must not imply otherwise.
25. I1 is content-minimizing, not a formal non-interference system. It persists no raw/arbitrary page text, values, URLs, bodies, headers, DOM/AX identifiers, or reversible unkeyed content digest, but the reviewed bounded structural outputs (role/state/presence/order/count/timing/status classes) are necessarily page-influenced and a deliberately malicious page could encode bits through them. That covert-channel adversary and re-publication of local artifacts are out of scope; eliminating it would require returning no useful page-derived QA evidence. Acceptance claims must say `forbidden raw/direct content leaks:0`, not “zero information flow” or mathematically “secret-free,” and tests must distinguish those claims.
26. The fresh browser profile is not sufficient OS-secret, browser-process writer, or local-network isolation on macOS. Production Chrome must use `--use-mock-keychain`; its exact disabled-feature tuple must include `UseKeychainKeyProvider`, `DialMediaRouteProvider`, `MediaRouter`, `KeepAliveInBrowserMigration`, and `FetchRetry`; and the real-Chrome security lane proves the byte-exact sync switch plus async-provider disable, source-pinned semantics, no SSDP/mDNS/local-discovery datagram, and no renderer-detached keepalive/retry write. It never probes or mutates the user's default Keychain and must not claim runtime non-access beyond those reviewed switches. Never substitute the user's Chrome profile or system Safe Storage entry.

---

## Audited Starting Point

This plan executes the approved [Freeland Agent-First CDP Feedback Loop design](../specs/2026-08-02-freeland-agent-first-cdp-feedback-loop-design.md) without extending its `I1` product scope. The implementation security audit performed while writing this plan supersedes three transport-level design details: inherited CDP pipe replaces a discoverable loopback WebSocket endpoint; the browser is jailed behind an allow-one proxy/watchdog; and the read allowlist is bodyless `GET`/`HEAD` only rather than permitting `OPTIONS`. These are fail-closed refinements, not added product capability.

The target `FreelandQA` checkout is clean at `a4df0c5` and has a configured `origin`. It already provides:

- a fail-closed Node/TypeScript toolchain and deterministic Baseline workflow;
- versioned JSON Schemas and hand-written runtime validators under `packages/contracts/`;
- exact staging environment configuration and mesh proxy support;
- a repository/history secret scanner;
- sanitized Playwright evidence helpers;
- immutable product patch verification and a Patchset workflow that runs the product CDP harness;
- ignored `artifacts/`, `evidence/`, `.work/`, and `.product/` paths.

The product harness is a reference and conformance target, not runtime code for the new broker. The broker is implemented independently in `FreelandQA` and consumes only supported staging browser/environment contracts.

## Target File Structure

```text
FreelandQA/
  AGENTS.md
  config/cdp/
    chrome-runtime.v1.json
    public-staging-routes.v1.yaml
    public-staging-requests.v1.yaml
  coverage/bootstrap/
    cdp-i0-entry-gate.v1.json
    cdp-i1-acceptance.v1.json
  docs/history/
    2026-08-02-cdp-i0-entry-gate.md
    2026-08-02-cdp-i1-acceptance.md
  docs/runbooks/
    freeland-cdp-public-staging.md
  packages/contracts/
    schemas/
      cdp-entry-gate.v1.schema.json
      cdp-chrome-runtime.v1.schema.json
      cdp-session-manifest.v1.schema.json
      cdp-command.v1.schema.json
      cdp-observation.v1.schema.json
      cdp-route-policy.v1.schema.json
      cdp-request-policy.v1.schema.json
      cdp-artifact-index.v1.schema.json
      cdp-run-result.v1.schema.json
      cdp-i1-acceptance.v1.schema.json
      cdp-live-smoke-result.v1.schema.json
      cdp-local-security-smoke-result.v1.schema.json
      cdp-i1-evidence.v1.schema.json
    src/
      cdp-entry-gate.ts
      cdp.ts
      cdp-acceptance.ts
      cdp-live-smoke.ts
      cdp-local-security-smoke.ts
      cdp-i1-evidence.ts
      index.ts
  packages/cdp-broker/src/
    artifacts.ts
    artifact-verifier.ts
    attestation.ts
    broker.ts
    browser-guard.ts
    capture-sanitizer.ts
    cdp-transport.ts
    chrome-lifecycle.ts
    chrome-watchdog.ts
    egress-proxy.ts
    control-server.ts
    control-runtime.ts
    daemon.ts
    policy.ts
    process-owner.ts
    screenshot.ts
    schema-validator.ts
    semantic-snapshot.ts
    telemetry-summary.ts
  skills/freeland-cdp/SKILL.md
  tests/cdp/
    agent-surface.test.ts
    artifacts.test.ts
    attestation.test.ts
    broker.test.ts
    browser-guard.test.ts
    cdp-contracts.test.ts
    cdp-transport.test.ts
    chrome-lifecycle.test.ts
    control-server.test.ts
    fixtures.ts
    policy.test.ts
    screenshot.test.ts
    live-smoke.test.ts
    local-security-smoke.test.ts
    replay.test.ts
    replay/
      public-landing-session.v1.json
      redirect-to-production.v1.json
      popup-service-worker.v1.json
      sensitive-capture.v1.json
    semantic-snapshot.test.ts
    telemetry-summary.test.ts
  tests/acceptance/
    cdp-entry-gate.test.ts
    cdp-i1-acceptance.test.ts
  tools/acceptance/
    capture-cdp-entry-gate.ts
    collect-cdp-i1-evidence.ts
    render-cdp-i1-acceptance.ts
  tools/cdp/
    agent-cdp.ts
    live-smoke.ts
    local-security-smoke.ts
```

### Task 1: Close the Existing Remote Entry Gate (`FL-CDP-I0`)

**Files:**

- Read: `.github/workflows/baseline.yml`
- Read: `.github/workflows/patchset.yml`
- Read: `.github/branch-protection.json`
- Read: `coverage/bootstrap/subproject-1-acceptance.v1.json`
- External only: GitHub repository settings, Actions secret metadata, workflow runs, branch protection

**Interfaces:**

- **Consumes:** existing Task 11, a protected local private-key file supplied outside Git, and the product administrator's non-secret confirmation that the matching deploy key has `read_only=true` and write access disabled.
- **Produces:** two successful exact-SHA workflow runs, read-only product checkout, protected `main`, and the immutable inputs used by Task 2.

Run all Task 1 command blocks in one persistent operator shell (an agent may keep one PTY session) so the deliberately non-secret repository/run-bound variables survive through Step 9. Every block still enables fail-fast independently. If that shell is lost, rerun the exact read-only state/run resolution steps; never guess or reuse stale IDs.

- [ ] **Step 1: Re-read the exact repository and permission state**

Run from the authoritative publication checkout:

```bash
set -euo pipefail
QA_REPOSITORY="nuanu-ai/FreelandQA"
PRODUCT_REPOSITORY="nuanu-ai/freeland_app"
ENTRY_COMMIT="a4df0c5e4b57dfda3ed658171452cccda6095d52"

PUBLICATION_STATUS="$(git status --porcelain)"
test -z "$PUBLICATION_STATUS"
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(git remote get-url origin)" = "https://github.com/nuanu-ai/FreelandQA.git"
gh repo view "$QA_REPOSITORY" --json nameWithOwner,visibility,defaultBranchRef,viewerPermission,isPrivate
gh repo view "$PRODUCT_REPOSITORY" --json nameWithOwner,visibility,viewerPermission
test "$(gh api "repos/$QA_REPOSITORY" --jq .id)" = "1319799876"
test "$(gh repo view "$QA_REPOSITORY" --json viewerPermission --jq .viewerPermission)" = "ADMIN"
NUANU_ORGANIZATION_PLAN="$(gh api orgs/nuanu-ai --jq '.plan.name')"
case "$NUANU_ORGANIZATION_PLAN" in team|enterprise) ;; *) exit 1 ;; esac
```

Expected: QA repository private, default branch `main`, immutable REST repository ID `1319799876`, QA permission `ADMIN`, product permission `MAINTAIN`, an organization plan whose exact API name is `team` or `enterprise`, and no local changes. Any different identity, permission, plan, commit, or remote stops the task before a secret write or workflow dispatch; do not force-push or reset.

- [ ] **Step 2: Verify the administrator's read-only deploy-key attestation without reading private material**

The product administrator provides a local JSON file outside both repositories with exactly:

```json
{
  "repository": "nuanu-ai/freeland_app",
  "title": "FreelandQA read-only source checkout",
  "fingerprint": "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "readOnly": true,
  "allowWrite": false
}
```

The displayed fingerprint is a shape placeholder; the file must contain the actual SHA-256 SSH fingerprint of the public half of the exact private key that will be uploaded.

Run:

```bash
set -euo pipefail
test -n "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE"
case "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE" in /*) ;; *) exit 1 ;; esac
test -f "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE"
node -e 'const fs=require("node:fs");const p=process.env.FREELAND_SOURCE_ACCESS_ATTESTATION_FILE;const v=JSON.parse(fs.readFileSync(p,"utf8"));const keys=Object.keys(v).sort();const expected=["allowWrite","fingerprint","readOnly","repository","title"];if(JSON.stringify(keys)!==JSON.stringify(expected)||v.repository!=="nuanu-ai/freeland_app"||v.title!=="FreelandQA read-only source checkout"||v.readOnly!==true||v.allowWrite!==false||!/^SHA256:[A-Za-z0-9+/]{43}$/.test(v.fingerprint))process.exit(1)'
```

Expected: exit 0 and no key bytes printed. A chat message alone is not the machine-readable read-back required by this step.

- [ ] **Step 3: Store only the protected private key as the QA Actions secret**

The owner sets `FREELAND_SOURCE_DEPLOY_KEY_FILE` to the absolute protected key path outside Git. Then run:

```bash
set -euo pipefail
test -n "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
case "$FREELAND_SOURCE_DEPLOY_KEY_FILE" in /*) ;; *) exit 1 ;; esac
test -f "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
test "$(stat -f '%Lp' "$FREELAND_SOURCE_DEPLOY_KEY_FILE" 2>/dev/null || stat -c '%a' "$FREELAND_SOURCE_DEPLOY_KEY_FILE")" = "600"
FREELAND_SOURCE_DEPLOY_KEY_FINGERPRINT="$(ssh-keygen -lf "$FREELAND_SOURCE_DEPLOY_KEY_FILE" -E sha256 | awk 'NR == 1 { print $2 }')"
test "$FREELAND_SOURCE_DEPLOY_KEY_FINGERPRINT" = "$(node -e 'const fs=require("node:fs");const v=JSON.parse(fs.readFileSync(process.env.FREELAND_SOURCE_ACCESS_ATTESTATION_FILE,"utf8"));process.stdout.write(v.fingerprint)')"
gh secret set FREELAND_SOURCE_DEPLOY_KEY --repo "$QA_REPOSITORY" < "$FREELAND_SOURCE_DEPLOY_KEY_FILE"
gh secret list --repo "$QA_REPOSITORY" | awk '$1 == "FREELAND_SOURCE_DEPLOY_KEY" { found=1 } END { exit(found ? 0 : 1) }'
```

Expected: the locally derived non-secret fingerprint equals the administrator's read-only deploy-key record before the secret write, and secret metadata then exists. Do not run `cat`, `head`, `ssh-keygen -y`, or any command that prints private/public key bytes; `ssh-keygen -lf` may expose only the fingerprint.

- [ ] **Step 4: Trigger both workflows on the unchanged entry commit**

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
test "$(gh api "repos/$QA_REPOSITORY/commits/main" --jq .sha)" = "$ENTRY_COMMIT"
BASELINE_MAX_BEFORE="$(gh run list --repo "$QA_REPOSITORY" --workflow baseline.yml --limit 100 --json databaseId --jq 'map(.databaseId) | max // 0')"
PATCHSET_MAX_BEFORE="$(gh run list --repo "$QA_REPOSITORY" --workflow patchset.yml --limit 100 --json databaseId --jq 'map(.databaseId) | max // 0')"
DISPATCHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
gh workflow run baseline.yml --repo "$QA_REPOSITORY" --ref main
gh workflow run patchset.yml --repo "$QA_REPOSITORY" --ref main
```

Expected: both dispatches accepted while `main` still resolves to the entry commit; the timestamp and prior maximum IDs uniquely bound the new runs.

- [ ] **Step 5: Resolve and watch the new exact-SHA run IDs**

```bash
set -euo pipefail
for ATTEMPT in $(seq 1 24); do
  BASELINE_RUN_IDS="$(gh run list --repo "$QA_REPOSITORY" --workflow baseline.yml --branch main --event workflow_dispatch --limit 100 --json databaseId,headSha,createdAt --jq "map(select(.headSha == \"$ENTRY_COMMIT\" and .databaseId > $BASELINE_MAX_BEFORE and .createdAt >= \"$DISPATCHED_AT\")) | .[].databaseId")"
  BASELINE_RUN_COUNT="$(printf '%s\n' "$BASELINE_RUN_IDS" | awk 'NF { count += 1 } END { print count + 0 }')"
  test "$BASELINE_RUN_COUNT" -le 1
  test "$BASELINE_RUN_COUNT" = 1 && break
  sleep 5
done
test "$BASELINE_RUN_COUNT" = 1
BASELINE_RUN_ID="$BASELINE_RUN_IDS"

for ATTEMPT in $(seq 1 24); do
  PATCHSET_RUN_IDS="$(gh run list --repo "$QA_REPOSITORY" --workflow patchset.yml --branch main --event workflow_dispatch --limit 100 --json databaseId,headSha,createdAt --jq "map(select(.headSha == \"$ENTRY_COMMIT\" and .databaseId > $PATCHSET_MAX_BEFORE and .createdAt >= \"$DISPATCHED_AT\")) | .[].databaseId")"
  PATCHSET_RUN_COUNT="$(printf '%s\n' "$PATCHSET_RUN_IDS" | awk 'NF { count += 1 } END { print count + 0 }')"
  test "$PATCHSET_RUN_COUNT" -le 1
  test "$PATCHSET_RUN_COUNT" = 1 && break
  sleep 5
done
test "$PATCHSET_RUN_COUNT" = 1
PATCHSET_RUN_ID="$PATCHSET_RUN_IDS"

gh run watch "$BASELINE_RUN_ID" --repo "$QA_REPOSITORY" --exit-status
gh run watch "$PATCHSET_RUN_ID" --repo "$QA_REPOSITORY" --exit-status
```

Expected: exactly one new run per workflow and both watches exit 0. A missing or concurrent duplicate dispatch fails closed; the prior failed Patchset run is impossible to select.

- [ ] **Step 6: Verify exact conclusions and source-harness execution**

```bash
set -euo pipefail
test "$(gh run view "$BASELINE_RUN_ID" --repo "$QA_REPOSITORY" --json headSha --jq .headSha)" = "$ENTRY_COMMIT"
test "$(gh run view "$BASELINE_RUN_ID" --repo "$QA_REPOSITORY" --json conclusion --jq .conclusion)" = "success"
test "$(gh run view "$BASELINE_RUN_ID" --repo "$QA_REPOSITORY" --json jobs --jq '[.jobs[] | select(.name == "deterministic" and .conclusion == "success")] | length')" = "1"
test "$(gh run view "$PATCHSET_RUN_ID" --repo "$QA_REPOSITORY" --json headSha --jq .headSha)" = "$ENTRY_COMMIT"
test "$(gh run view "$PATCHSET_RUN_ID" --repo "$QA_REPOSITORY" --json conclusion --jq .conclusion)" = "success"
test "$(gh run view "$PATCHSET_RUN_ID" --repo "$QA_REPOSITORY" --json jobs --jq '[.jobs[] | select(.name == "immutable-base" and .conclusion == "success")] | length')" = "1"
gh run view "$PATCHSET_RUN_ID" --repo "$QA_REPOSITORY" --log | rg 'test:staging-cdp-harness|tests [0-9]+|pass [0-9]+'
```

Expected: both `headSha` values equal the entry commit, both conclusions are `success`, Patchset contains `immutable-base`, and the product CDP harness command completed successfully. Do not print failed-run logs that could contain checkout/provider data; the accepted workflow runs deterministic source tests only.

- [ ] **Step 7: Apply and read back the tracked branch-protection payload**

```bash
set -euo pipefail
gh api --method PUT -H "Accept: application/vnd.github+json" \
  "repos/$QA_REPOSITORY/branches/main/protection" \
  --input .github/branch-protection.json
gh api -H "Accept: application/vnd.github+json" \
  "repos/$QA_REPOSITORY/branches/main/protection" \
  --jq '{strict:.required_status_checks.strict,contexts:.required_status_checks.contexts,enforce_admins:.enforce_admins.enabled,linear:.required_linear_history.enabled,force:.allow_force_pushes.enabled,deletions:.allow_deletions.enabled,resolution:.required_conversation_resolution.enabled}'
```

Expected exact read-back:

```json
{"strict":true,"contexts":["Baseline / deterministic","Patchset / immutable-base"],"enforce_admins":true,"linear":true,"force":false,"deletions":false,"resolution":true}
```

- [ ] **Step 8: Record the resolved non-secret gate inputs for Task 2**

Keep these shell values in the current operator session without writing them into an untracked repository file:

```bash
set -euo pipefail
export FREELAND_CDP_ENTRY_COMMIT="$ENTRY_COMMIT"
export FREELAND_CDP_BASELINE_RUN_ID="$BASELINE_RUN_ID"
export FREELAND_CDP_PATCHSET_RUN_ID="$PATCHSET_RUN_ID"
export FREELAND_SOURCE_DEPLOY_KEY_FINGERPRINT
```

Expected: Task 2 can read all three values. If the shell session is lost, repeat the exact GitHub read-back rather than guessing IDs.

- [ ] **Step 9: Create the isolated implementation worktree only after I0 is green**

Invoke `superpowers:using-git-worktrees`, then run from the clean publication checkout:

```bash
set -euo pipefail
PUBLICATION_ROOT="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-publication"
FEATURE_WORKTREE="/Users/danilsolomin/projectsnew/NuanuFlowQA/.worktrees/freelandqa-cdp-i1"
FEATURE_BRANCH="codex/freeland-agent-first-cdp-i1"

git -C "$PUBLICATION_ROOT" fetch origin main
test "$(git -C "$PUBLICATION_ROOT" rev-parse origin/main)" = "$ENTRY_COMMIT"
PUBLICATION_STATUS="$(git -C "$PUBLICATION_ROOT" status --porcelain)"
test -z "$PUBLICATION_STATUS"
test ! -e "$FEATURE_WORKTREE"
FEATURE_BRANCH_MATCHES="$(git -C "$PUBLICATION_ROOT" branch --list "$FEATURE_BRANCH")"
test -z "$FEATURE_BRANCH_MATCHES"
git -C "$PUBLICATION_ROOT" worktree add "$FEATURE_WORKTREE" -b "$FEATURE_BRANCH" "$ENTRY_COMMIT"
cd "$FEATURE_WORKTREE"
test "$(git branch --show-current)" = "$FEATURE_BRANCH"
test "$(git rev-parse HEAD)" = "$ENTRY_COMMIT"
FEATURE_STATUS="$(git status --porcelain)"
test -z "$FEATURE_STATUS"
test "$(node -p 'process.versions.node.split(".")[0]')" = "20"
npm ci
npm run verify:deterministic
```

Expected: isolated clean feature worktree at the exact entry commit and the unchanged deterministic baseline passes. Tasks 2–16 run only from `$FEATURE_WORKTREE`; an existing path/branch or changed `origin/main` stops execution for inspection rather than reusing or deleting anything.

### Task 2: Add the Versioned I0 Entry-Gate Contract and Canonical Record

**Files:**

- Create: `packages/contracts/schemas/cdp-entry-gate.v1.schema.json`
- Create: `packages/contracts/src/cdp-entry-gate.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tools/acceptance/capture-cdp-entry-gate.ts`
- Create: `tests/acceptance/cdp-entry-gate.test.ts`
- Create: `coverage/bootstrap/cdp-i0-entry-gate.v1.json`
- Create: `docs/history/2026-08-02-cdp-i0-entry-gate.md`

**Interfaces:**

- **Consumes:** the three exported Task 1 values from the same persistent operator shell, the administrator attestation file, GitHub read-only metadata, `coverage/registry.v1.yaml`, and exactly `patchsets/freeland/virtual-numbers-card-canary-20260801/manifest.yaml`.
- **Produces:** `validateCdpEntryGate(input)`, `captureCdpEntryGate(options)`, and the canonical `cdp-i0-entry-gate.v1.json` consumed by every later task.

- [ ] **Step 1: Write the failing exact-shape contract test**

Add a fixture in `tests/acceptance/cdp-entry-gate.test.ts` with this interface and assertions:

```ts
interface CdpEntryGate {
  schemaVersion: 1;
  repository: {
    databaseId: 1319799876;
    nameWithOwner: 'nuanu-ai/FreelandQA';
    visibility: 'PRIVATE';
    defaultBranch: 'main';
  };
  entryCommit: string;
  checks: {
    baseline: { runId: number; headSha: string; conclusion: 'success' };
    patchset: { runId: number; headSha: string; conclusion: 'success' };
  };
  sourceAccess: {
    repository: 'nuanu-ai/freeland_app';
    kind: 'deploy-key';
    fingerprint: string;
    contents: 'read';
    write: false;
    administratorReadBack: true;
  };
  branchProtection: {
    strict: true;
    contexts: ['Baseline / deterministic', 'Patchset / immutable-base'];
    enforceAdmins: true;
    linearHistory: true;
    forcePushes: false;
    deletions: false;
    conversationResolution: true;
  };
  coverageRegistrySha256: string;
  patchsetManifestSha256: string;
}
```

The test must import `validateCdpEntryGate` from `packages/contracts/src/cdp-entry-gate.ts`, accept one valid object, then reject every missing field, unknown field, repository database-ID mismatch, non-success conclusion, mismatched `headSha`, unsafe access mode, write access, malformed/mismatched SSH SHA-256 fingerprint, unordered/missing check context, non-hex commit, non-positive run ID, and non-64-hex digest.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-entry-gate.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `packages/contracts/src/cdp-entry-gate.ts`.

- [ ] **Step 3: Implement the exact TypeScript validator and JSON Schema**

Create `packages/contracts/src/cdp-entry-gate.ts` with the interface above and:

```ts
const commit = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;

export function validateCdpEntryGate(input: unknown): asserts input is CdpEntryGate {
  assertExactKeys(input, 'entryGate', [
    'schemaVersion', 'repository', 'entryCommit', 'checks', 'sourceAccess',
    'branchProtection', 'coverageRegistrySha256', 'patchsetManifestSha256',
  ]);
  if (input.schemaVersion !== 1) throw new Error('entryGate.schemaVersion');
  if (!commit.test(input.entryCommit as string)) throw new Error('entryGate.entryCommit');
  assertRepository(input.repository);
  assertChecks(input.checks, input.entryCommit as string);
  assertSourceAccess(input.sourceAccess);
  assertBranchProtection(input.branchProtection);
  if (!digest.test(input.coverageRegistrySha256 as string)) throw new Error('entryGate.coverageRegistrySha256');
  if (!digest.test(input.patchsetManifestSha256 as string)) throw new Error('entryGate.patchsetManifestSha256');
}
```

Define local `assertExactKeys`, `assertRepository`, `assertChecks`, `assertSourceAccess`, and `assertBranchProtection` helpers in this file. Each helper first enforces its exact key set, then the literal values shown in `CdpEntryGate`, including `repository.databaseId === 1319799876`; `assertChecks` additionally requires positive safe-integer run IDs, `conclusion === 'success'`, and both `headSha` values equal the entry commit. Follow the closed-object style in `packages/contracts/src/acceptance.ts`; do not export a generic permissive object validator. Create a closed JSON Schema with the same required keys, `additionalProperties:false` at every object level, literal repository identity/access/protection values, positive integer run IDs, and the exact commit/digest patterns. Export the validator from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run the focused test and verify green**

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-entry-gate.test.ts
npm run typecheck
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Write the failing capture-tool test before implementing the tool**

Extend `tests/acceptance/cdp-entry-gate.test.ts` by importing and faking the production `GateReader` interface:

```ts
import type { GateReader } from '../../tools/acceptance/capture-cdp-entry-gate.js';
```

Assert `captureCdpEntryGate` returns the exact validated object for safe injected values, hashes the real registry and active manifest bytes, rejects a repository database-ID mismatch, rejects the old failed Patchset run, rejects a missing secret, rejects a source attestation with `allowWrite=true`, and performs no write unless CLI flag `--write` is present.

- [ ] **Step 6: Run the capture-tool test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-entry-gate.test.ts
```

Expected: FAIL because `tools/acceptance/capture-cdp-entry-gate.ts` does not exist.

- [ ] **Step 7: Implement capture, deterministic rendering, and write gating**

Create `tools/acceptance/capture-cdp-entry-gate.ts` with exported functions:

```ts
export interface GateReader {
  repository(): Promise<{ databaseId: number; nameWithOwner: string; visibility: string; defaultBranch: string }>;
  run(id: number): Promise<{ headSha: string; conclusion: string }>;
  protection(): Promise<unknown>;
  secretNames(): Promise<string[]>;
}

export interface CaptureCdpEntryGateOptions {
  root: string;
  entryCommit: string;
  baselineRunId: number;
  patchsetRunId: number;
  sourceAttestationPath: string;
  sourceKeyFingerprint: string;
  reader: GateReader;
}

export async function captureCdpEntryGate(
  options: CaptureCdpEntryGateOptions,
): Promise<CdpEntryGate>;

export function renderCdpEntryGateMarkdown(gate: CdpEntryGate): string;

export async function runCaptureCdpEntryGateCli(
  args: string[],
  io: { stdout(text: string): void; stderr(text: string): void },
): Promise<number>;
```

Define `ACTIVE_PATCHSET_MANIFEST_RELATIVE` inside the module as the literal `patchsets/freeland/virtual-numbers-card-canary-20260801/manifest.yaml`; expose no CLI path override. Parse the administrator attestation as a closed object, require its exact repository/title/read-only values, require `sourceKeyFingerprint` to match its `SHA256:<43-base64>` value, and persist that same non-secret fingerprint in `sourceAccess`. The production `GateReader` uses `execFile('gh', commandArgs)` without a shell, where `commandArgs` is one of the exact read-only commands from Task 1 (`repo view`, `run view`, `secret list`, `api repos/nuanu-ai/FreelandQA`, or `api repos/nuanu-ai/FreelandQA/branches/main/protection`). It parses only the documented JSON fields and never reads secret values. Hash the exact registry and active-manifest bytes with `createHash('sha256')`. Write JSON and Markdown only under `--write`, by temporary file plus rename, and render no issue titles, paths outside the repository, key bytes, or credential material.

- [ ] **Step 8: Run focused and aggregate deterministic checks**

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-entry-gate.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 9: Generate the canonical I0 record from Task 1 read-back**

```bash
set -euo pipefail
node --import tsx tools/acceptance/capture-cdp-entry-gate.ts \
  --entry-commit "$FREELAND_CDP_ENTRY_COMMIT" \
  --baseline-run-id "$FREELAND_CDP_BASELINE_RUN_ID" \
  --patchset-run-id "$FREELAND_CDP_PATCHSET_RUN_ID" \
  --source-attestation "$FREELAND_SOURCE_ACCESS_ATTESTATION_FILE" \
  --source-key-fingerprint "$FREELAND_SOURCE_DEPLOY_KEY_FINGERPRINT" \
  --write
```

Expected stdout: `cdp-entry-gate=pass mode=write` and exactly two new canonical files. Re-run without `--write`; expected `cdp-entry-gate=pass mode=check` and zero diff.

- [ ] **Step 10: Commit Task 2**

```bash
set -euo pipefail
git add packages/contracts/schemas/cdp-entry-gate.v1.schema.json \
  packages/contracts/src/cdp-entry-gate.ts packages/contracts/src/index.ts \
  tools/acceptance/capture-cdp-entry-gate.ts \
  tests/acceptance/cdp-entry-gate.test.ts \
  coverage/bootstrap/cdp-i0-entry-gate.v1.json \
  docs/history/2026-08-02-cdp-i0-entry-gate.md
git commit -m "chore: record Freeland CDP entry gate"
```

### Task 3: Define the Closed CDP Runtime Contracts

**Files:**

- Create: `packages/contracts/src/cdp.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/schemas/cdp-chrome-runtime.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-session-manifest.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-command.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-observation.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-route-policy.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-request-policy.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-artifact-index.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-run-result.v1.schema.json`
- Create: `packages/cdp-broker/src/schema-validator.ts`
- Create: `tests/cdp/cdp-contracts.test.ts`

**Interfaces:**

- **Consumes:** the closed-schema conventions established by existing contracts.
- **Produces:** the exact runtime types below plus `validateCdpCommand`, `validateCdpObservation`, `validateCdpSessionManifest`, `validateCdpChromeRuntime`, `validateCdpRoutePolicy`, `validateCdpRequestPolicy`, `validateCdpArtifactIndex`, `validateCdpRunResult`, and `validateCdpRunResultAgainstIndex`.

- [ ] **Step 1: Write the failing contract tests**

Define these exact public unions in the test and assert the production validators accept every member and reject all unknown keys/types:

```ts
export type CdpOutcome =
  | 'OBSERVED'
  | 'STALE_CANDIDATE'
  | 'POLICY_BLOCK'
  | 'ATTESTATION_FAIL'
  | 'CAPTURE_REDACTION_FAIL'
  | 'BROWSER_FAIL'
  | 'HARNESS_FAIL';

export type CdpCommand =
  | { schemaVersion: 1; command: 'start'; environmentId: 'freeland-staging-public-cdp' }
  | { schemaVersion: 1; command: 'status'; session: string }
  | { schemaVersion: 1; command: 'attest'; session: string }
  | { schemaVersion: 1; command: 'navigate'; session: string; routeId: string }
  | { schemaVersion: 1; command: 'back'; session: string }
  | { schemaVersion: 1; command: 'reload'; session: string }
  | { schemaVersion: 1; command: 'wait'; session: string; predicate: 'document-ready' | 'heading-present'; timeoutMs: number }
  | { schemaVersion: 1; command: 'snapshot'; session: string }
  | { schemaVersion: 1; command: 'console-summary'; session: string }
  | { schemaVersion: 1; command: 'network-summary'; session: string }
  | { schemaVersion: 1; command: 'screenshot-safe'; session: string }
  | { schemaVersion: 1; command: 'stop'; session: string };

export interface CandidateIdentity {
  environment: 'staging';
  deployTarget: 'staging';
  publicOrigin: 'https://mf0.forum';
  releaseSha: string;
  supabaseProjectRef: 'qsxsiunkflfumhcluyhv';
  chromeMajor: 150;
}

export type CdpResultCommand = CdpCommand['command'] | 'invalid';

interface CdpResultBase {
  schemaVersion: 1;
  command: CdpResultCommand;
  session: string | null;
  candidate: CandidateIdentity | null;
  routeId: string | null;
  observation: CdpObservation | null;
  reasonCode: string | null;
}

export type CdpObservedResult = CdpResultBase & { outcome: 'OBSERVED'; reasonCode: null } & (
  | { command: 'start'; session: string; candidate: CandidateIdentity; routeId: 'landing'; observation: Extract<CdpObservation, { kind: 'status' }> & { healthy: true } }
  | { command: 'status'; session: string; observation: Extract<CdpObservation, { kind: 'status' }> }
  | { command: 'attest'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'attestation' }> }
  | { command: 'navigate' | 'back' | 'reload'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'navigation' }> }
  | { command: 'wait'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'wait' }> }
  | { command: 'snapshot'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'snapshot' }> }
  | { command: 'console-summary'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'console' }> }
  | { command: 'network-summary'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'network' }> }
  | { command: 'screenshot-safe'; session: string; candidate: CandidateIdentity; routeId: string; observation: Extract<CdpObservation, { kind: 'screenshot' }> }
  | { command: 'stop'; session: string; observation: Extract<CdpObservation, { kind: 'stop' }> }
);

export type CdpFailedResult = CdpResultBase & {
  command: CdpCommand['command'];
  outcome: Exclude<CdpOutcome, 'OBSERVED'>;
  observation: null;
  reasonCode: string;
};

export type CdpInvalidResult = CdpResultBase & {
  command: 'invalid';
  outcome: 'HARNESS_FAIL';
  session: null;
  candidate: null;
  routeId: null;
  observation: null;
  reasonCode: string;
};

export type CdpRunResult = CdpObservedResult | CdpFailedResult | CdpInvalidResult;
```

`session` matches `^s-[0-9a-f]{32}$`; `routeId` matches `^[a-z][a-z0-9-]{2,31}$` and is subsequently resolved against the exact Task 4 allowlist; SHA matches 40 lowercase hex; failure `reasonCode` matches `^[a-z][a-z0-9_]{2,63}$`; `timeoutMs` is an integer from 100 through 15,000. Candidate `chromeMajor` is schema/type literal `150`, never a generic number. Tests exercise every observed command/observation pairing, reject `OBSERVED` with null candidate/observation where the union requires them, reject any failure without a reason, and require parser/protocol failures to use the closed `invalid` variant. Single-input runtime cross-field checks require attestation observation identity to equal `candidate`, navigation observation route to equal `routeId`, and start to be healthy on `landing`. `validateCdpRunResultAgainstIndex(result, index)` first validates both inputs and, only for an observed screenshot result, requires the observation basename/digest/bytes to equal exactly one indexed PNG; Task 13 calls it after the artifact/index durable write and before returning the result. No schema permits a URL, selector, expression, CDP method, header, body, or filesystem path.

- [ ] **Step 2: Run the contract test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/cdp-contracts.test.ts
```

Expected: FAIL with missing CDP contract exports.

- [ ] **Step 3: Implement the TypeScript contract types and exact validators**

Create `packages/contracts/src/cdp.ts` with the types above plus:

```ts
export type SemanticRole =
  | 'banner' | 'navigation' | 'main' | 'contentinfo' | 'heading'
  | 'link' | 'button' | 'textbox' | 'checkbox' | 'radio' | 'tab'
  | 'menuitem' | 'option' | 'switch' | 'dialog' | 'status' | 'alert';

export interface SemanticStates {
  disabled?: boolean;
  focused?: boolean;
  focusable?: boolean;
  selected?: boolean;
  expanded?: boolean;
  checked?: boolean | 'mixed';
  required?: boolean;
  readonly?: boolean;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface SemanticNode {
  id: string;
  role: SemanticRole;
  label: 'none' | 'present';
  states: SemanticStates;
}

export type CdpReviewedRoutePath = '/' | '/ru' | '/en' | '/terms' | '/privacy' | '/app/welcome';
export type CdpSafePathTemplate =
  | CdpReviewedRoutePath
  | '/environment-manifest.json'
  | '/api/environment'
  | '/favicon.ico'
  | '/manifest.webmanifest'
  | '/robots.txt'
  | '/assets/:asset'
  | '/locales/:asset'
  | '/icons/:asset'
  | 'blocked';

declare const cdpPublicArtifactNameBrand: unique symbol;
export type CdpPublicArtifactName = string & { readonly [cdpPublicArtifactNameBrand]: true };

export type CdpAllowedNetworkEntry = {
  originRole: 'staging-app';
  pathTemplate: Exclude<CdpSafePathTemplate, 'blocked'>;
  method: 'GET' | 'HEAD';
  status: number;
  durationBucket: '<100ms' | '100-499ms' | '500-1999ms' | '>=2000ms';
};

export type CdpBlockedNetworkEntry = {
  originRole: 'blocked';
  pathTemplate: 'blocked';
  method: 'BLOCKED';
  status: 'blocked';
  durationBucket: '<100ms' | '100-499ms' | '500-1999ms' | '>=2000ms';
};

export type CdpObservation =
  | { kind: 'status'; healthy: boolean }
  | { kind: 'attestation'; identity: CandidateIdentity }
  | { kind: 'navigation'; routeId: string; normalizedPath: CdpReviewedRoutePath }
  | { kind: 'wait'; predicate: 'document-ready' | 'heading-present'; satisfied: true }
  | { kind: 'snapshot'; title: 'public-page'; language: 'und' | 'en' | 'ru'; nodes: SemanticNode[]; truncated: boolean; bytes: number }
  | { kind: 'console'; entries: Array<{ severity: 'error' | 'warning' | 'info'; fingerprint: string; count: number; firstMs: number; lastMs: number; sourceClass: 'first-party' | 'browser' | 'blocked' }>; truncated: boolean }
  | { kind: 'network'; entries: Array<CdpAllowedNetworkEntry | CdpBlockedNetworkEntry>; truncated: boolean }
  | { kind: 'screenshot'; sha256: string; width: number; height: number; bytes: number; artifactName: CdpPublicArtifactName }
  | { kind: 'stop'; cleaned: true };

export const CDP_JSON_ARTIFACT_FILE_MAX_BYTES = 65_536;
```

Validators must enforce exact keys recursively—including the optional-but-closed `SemanticStates` keys—all enum/literal values, non-negative safe integers, lower-case SHA/digest formats, array caps, and observation-kind-specific shape. Snapshot title is the fixed literal `public-page`, language is only `und|en|ru`, and node label is only `none|present`; no arbitrary page text is contract-valid. Navigation path is one of the six `CdpReviewedRoutePath` literals and network path template is one of the complete `CdpSafePathTemplate` literals; schemas/validators reject every other path-shaped or secret-bearing string even if a producer is buggy. Network schema uses `oneOf` for the exact allowed versus blocked entry shapes so origin/path/method/status cannot be mixed. Screenshot artifact name must match `^public-[a-z][a-z0-9-]{2,31}-[0-9]{4}\.png$`, contain no separator, and is branded only after validation; `validateCdpRunResultAgainstIndex` also requires its route/ordinal/index entry to agree. Every durable observation uses canonical compact JSON plus one mandatory `\n`, and the complete file must be at most `CDP_JSON_ARTIFACT_FILE_MAX_BYTES` (65,536); producers deterministically drop tail entries/nodes and set `truncated:true` until the body is at most 65,535 bytes. Snapshot `bytes` denotes its compact JSON body length before the newline and is recomputed to a stable fixed point. Semantic node IDs match `^n[1-9][0-9]*$`; HTTP response status is an integer from 100 through 599. Export all public types, constant, and validators from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Create the seven closed JSON Schemas**

Each schema uses `schemaVersion:{"const":1}`, closed objects, exact enums, and the same limits as TypeScript. `cdp-command.v1` uses `oneOf` with one closed object per command. `cdp-observation.v1` uses `oneOf` with one closed object per `kind`. `cdp-run-result.v1` uses command/outcome-specific `oneOf` branches mirroring the discriminated union and requires all eight result keys even when a permitted value is `null`.

The policy schemas require:

```ts
interface CdpChromeRuntime {
  schemaVersion: 1;
  id: 'freeland-cdp-macos-chrome';
  platform: 'darwin';
  browserProduct: 'Chrome/150.0.7871.187';
  protocolVersion: '1.3';
  major: 150;
  viewport: { width: 1280; height: 960; deviceScaleFactor: 1; mobile: false };
  disabledBrowserFeatures: [
    'BackgroundFetch', 'BrowsingTopics',
    'ConversionMeasurement', 'DialMediaRouteProvider', 'DirectSockets',
    'DurableMessages', 'FedCm',
    'FencedFrames', 'FetchLaterAPI', 'FetchRetry', 'InterestGroupStorage',
    'KeepAliveInBrowserMigration', 'MediaRouter', 'NetworkErrorLogging',
    'PreconnectToSearch',
    'Prerender2', 'PrivateAggregationApi',
    'Reporting', 'SecurePaymentConfirmationBrowser',
    'ServiceWorkerPaymentApps', 'SharedStorageAPI',
    'UseKeychainKeyProvider', 'WebPayments'
  ];
  globalTransportNames: [
    'WebSocket', 'WebSocketStream', 'WebTransport', 'RTCPeerConnection',
    'webkitRTCPeerConnection', 'TCPSocket', 'UDPSocket', 'TCPServerSocket'
  ];
  navigatorTransportNames: ['openTCPSocket', 'openUDPSocket'];
}

interface CdpRoutePolicy {
  schemaVersion: 1;
  id: 'freeland-staging-public-routes';
  revision: string;
  routes: Array<{
    id: string;
    path: string;
    classification: 'public-safe' | 'authentication-entry';
    authenticatedMarkerSelectors: string[];
    captures: Array<'snapshot' | 'console-summary' | 'network-summary' | 'screenshot-safe'>;
  }>;
}

interface CdpRequestPolicy {
  schemaVersion: 1;
  id: 'freeland-staging-public-requests';
  revision: string;
  origins: Array<{
    role: 'staging-app';
    origin: string;
    methods: Array<'GET' | 'HEAD'>;
    exactPaths: string[];
    pathPrefixes: string[];
  }>;
}
```

The route schema bounds selector strings to 128 characters and two entries; Task 4's semantic policy validator requires the exact two reviewed selector literals and enforces that only `public-safe` records may contain `screenshot-safe`, while every `authentication-entry` record must omit it.

The remaining exact private contracts are:

```ts
export interface CdpSessionManifest {
  schemaVersion: 1;
  session: string;
  state: 'starting' | 'active' | 'stopping' | 'stopped' | 'quarantined';
  daemonPid: number;
  daemonStartToken: string;
  chromeWatchdogPid: number | null;
  chromeWatchdogStartToken: string | null;
  chromePid: number | null;
  chromeStartToken: string | null;
  chromeExecutable: string | null;
  profileDirectory: string;
  artifactDirectory: string;
  socketPath: string;
  profileReleased: boolean;
  createdAt: string;
  expiresAt: string;
  candidate: CandidateIdentity | null;
}

export interface CdpArtifactIndex {
  schemaVersion: 1;
  session: string;
  createdAt: string;
  expiresAt: string;
  candidate: CandidateIdentity | null;
  artifacts: Array<{
    kind: 'observation-json' | 'public-screenshot';
    basename: string;
    bytes: number;
    sha256: string;
  }>;
}
```

The manifest schema validates these private recovery/locator fields but no credentials, proxy port, pipe handle, or CDP endpoint. `daemonPid` and `daemonStartToken` are always non-null from the first `starting` manifest. Treat watchdog PID/token and Chrome PID/token as two independently all-null/all-populated pairs. The atomic bootstrap manifest always contains the deterministic session-bound platform path `/private/tmp/freeland-cdp-profile-<session>` on macOS (or `/tmp/...` on Linux) with `profileReleased:false` before any profile directory exists. `starting` permits exactly three monotonic phases: (a) both process pairs and `chromeExecutable` null; (b) watchdog pair plus exact executable populated while Chrome pair is null; (c) both pairs plus executable populated. Task 7 may not authorize the watchdog to spawn Chrome until phase (b) is durably written. `active`/`stopping` requires phase (c) plus unreleased profile, and `active` additionally requires a non-null candidate. `quarantined` may retain any complete phase but never a half pair. `stopped` requires `profileReleased:true` and retains the historical deterministic profile path/process fields. A non-null profile path with `profileReleased:true` means absence was ownership-checked and durably recorded, not that the path is reusable. No filesystem profile entry may exist before this locator is durable.

Start tokens are 64-lowercase-hex hashes of platform process-birth identity and are used only to prove absence/mismatch, never as permission for orphan PID signalling. Non-null paths must be absolute, PIDs positive safe integers, timestamps canonical ISO instants, and `expiresAt` exactly seven days after `createdAt` under the runtime validator. The inherited CDP pipes, direct child handles, and owned proxy exist only in the daemon's in-memory `OwnedChrome`; they are never persisted, rediscovered, read by the CLI, or returned through `CdpRunResult`.

- [ ] **Step 5: Implement Ajv-backed schema validation and cross-check tests**

Create `packages/cdp-broker/src/schema-validator.ts` that loads schema bytes relative to the repository root, compiles each once with Ajv `{allErrors:true, strict:true}`, and exports `assertCdpCommandSchema`, `assertCdpObservationSchema`, `assertCdpSessionManifestSchema`, `assertCdpChromeRuntimeSchema`, `assertCdpRoutePolicySchema`, `assertCdpRequestPolicySchema`, `assertCdpArtifactIndexSchema`, and `assertCdpRunResultSchema`. Tests feed the same valid/invalid corpus through the hand-written `validate*` runtime validator and corresponding Ajv `assert*Schema` function and require identical accept/reject results. The Chrome runtime schema is a closed, version-indexed capability manifest: any product version, protocol version, platform, viewport, order, missing reviewed name, or extra reviewed name requires an explicit source change and review before Chrome may launch.

- [ ] **Step 6: Run focused and aggregate checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/cdp-contracts.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 7: Commit Task 3**

```bash
set -euo pipefail
git add packages/contracts/src/cdp.ts packages/contracts/src/index.ts \
  packages/contracts/schemas/cdp-*.schema.json \
  packages/cdp-broker/src/schema-validator.ts tests/cdp/cdp-contracts.test.ts
git commit -m "feat: define closed Freeland CDP contracts"
```

### Task 4: Add Exact Public Staging Route, Request, and Runtime Policy

**Files:**

- Create: `config/cdp/public-staging-routes.v1.yaml`
- Create: `config/cdp/public-staging-requests.v1.yaml`
- Create: `config/cdp/chrome-runtime.v1.json`
- Create: `packages/cdp-broker/src/policy.ts`
- Create: `tests/cdp/policy.test.ts`
- Modify: `.env.example`

**Interfaces:**

- **Consumes:** Task 3 policy contracts and existing staging environment names.
- **Produces:** `loadPublicCdpPolicy(root)`, `loadPublicCdpEnvironment(env, policy)`, `resolveRoute(routeId)`, and `decideRequest(request)`; the loaded policy includes the exact reviewed Chrome runtime.

- [ ] **Step 1: Write failing policy/environment tests**

The tests require these six initial route IDs and no others:

```ts
const expectedRoutes = {
  landing: '/',
  'landing-ru': '/ru',
  'landing-en': '/en',
  terms: '/terms',
  privacy: '/privacy',
  welcome: '/app/welcome',
} as const;
```

Every route permits snapshot, console, and network summaries. `landing`, `landing-ru`, `landing-en`, `terms`, and `privacy` are `public-safe` and permit `screenshot-safe`; `welcome` is `authentication-entry` and denies screenshots in `I1`. Every record contains exactly the two reviewed authenticated-shell deny selectors `aside nav a[href="/app/settings"]` and `aside nav a[href="/app/store"]`; arbitrary or agent-supplied selectors remain forbidden.

Tests also require:

- exact origin `https://mf0.forum`;
- methods limited to `GET` and `HEAD`; `OPTIONS` is denied rather than treated as a harmless read;
- app exact paths for the six routes, `/environment-manifest.json`, `/api/environment`, `/favicon.ico`, `/manifest.webmanifest`, and `/robots.txt`;
- app prefixes `/assets/`, `/locales/`, and `/icons/`;
- denial of every direct Supabase request in `I1`; the project reference is attestation identity only, not an egress grant;
- denial of production, providers, query-bearing route navigation, fragments, encoded path traversal, credentials in URLs, unlisted paths, and every write method;
- denial of every page-controlled header name outside the fixed browser-read allowlist, including `foo`, `range`, every `if-*`, forwarding headers, and all `x-*`; accepted request headers are rebuilt from fixed resource-type profiles rather than copied from the page;
- environment variables `FREELAND_STAGING_BASE_URL`, `FREELAND_EXPECTED_STAGE_SHA`, `FREELAND_STAGING_MESH_IP`, and `FREELAND_CDP_CHROME_EXECUTABLE` with no credential/auth-file dependency.
- expected SHA must be exactly 40 lowercase hex; mesh IP must be canonical unicast IPv4 (no shorthand, leading zero, unspecified, loopback, multicast, or broadcast); Chrome executable must be a canonical absolute non-symlink regular file with executable permission;
- `chrome-runtime.v1.json` must equal the closed Task 3 runtime contract for macOS `Chrome/150.0.7871.187`, CDP `1.3`, the fixed 1280×960 scale-1 viewport, the ordered browser-feature deny tuple, and the complete reviewed transport-name tuples; a missing/reordered feature or different installed Chrome fails before spawn rather than expanding a version range;
- `FREELAND_CDP_CHROME_EXECUTABLE` must equal the literal canonical system path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; alternate apps, wrappers, symlinks, scripts, user paths, or same-version fakes are rejected.

- [ ] **Step 2: Run the policy test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/policy.test.ts
```

Expected: FAIL because the policy module/configuration does not exist.

- [ ] **Step 3: Create the exact YAML policy files**

`public-staging-routes.v1.yaml` is exactly:

```yaml
schemaVersion: 1
id: freeland-staging-public-routes
revision: 974f21b7c152005830de20318d049d16206fd06591d9eb73077eb45f04127e7e
routes:
  - id: landing
    path: /
    classification: public-safe
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary, screenshot-safe]
  - id: landing-ru
    path: /ru
    classification: public-safe
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary, screenshot-safe]
  - id: landing-en
    path: /en
    classification: public-safe
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary, screenshot-safe]
  - id: terms
    path: /terms
    classification: public-safe
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary, screenshot-safe]
  - id: privacy
    path: /privacy
    classification: public-safe
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary, screenshot-safe]
  - id: welcome
    path: /app/welcome
    classification: authentication-entry
    authenticatedMarkerSelectors: ['aside nav a[href="/app/settings"]', 'aside nav a[href="/app/store"]']
    captures: [snapshot, console-summary, network-summary]
```

`public-staging-requests.v1.yaml` contains exactly one origin record:

```yaml
schemaVersion: 1
id: freeland-staging-public-requests
revision: df752d1fb4d58121a6d6f516aec8e3768862f101d1e1edcfb0cc2397f23d4c93
origins:
  - role: staging-app
    origin: https://mf0.forum
    methods: [GET, HEAD]
    exactPaths:
      - /
      - /ru
      - /en
      - /terms
      - /privacy
      - /app/welcome
      - /environment-manifest.json
      - /api/environment
      - /favicon.ico
      - /manifest.webmanifest
      - /robots.txt
    pathPrefixes: [/assets/, /locales/, /icons/]
```

`chrome-runtime.v1.json` is exactly the recursively closed `CdpChromeRuntime` object from Task 3, including the ordered browser-feature deny tuple. It is intentionally version-specific, not `133+` or a range. Updating Chrome requires a reviewed manifest/list change plus the complete Task 15 real-Chrome suite and a fresh source audit of browser/network-service request producers; an automatic Chrome update therefore fails closed before navigation.

The revision algorithm is exactly `sha256(JSON.stringify(records))`, preserving the displayed record, field, and array order. Tests recompute and require the two displayed digests. Revision self-checking prevents hand-edited policy drift; a mismatch fails rather than rewriting policy automatically.

If the live public route proves it needs a Supabase read, I1 remains blocked until a separately reviewed exact method/path/query contract and new policy revision are approved; implementation must not restore a project-wide prefix.

- [ ] **Step 4: Implement exact policy loading and decision functions**

Create `packages/cdp-broker/src/policy.ts` with:

```ts
export interface PublicCdpEnvironment {
  baseURL: 'https://mf0.forum';
  expectedGitSha: string;
  meshIp: string;
  chromeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  chromeRuntime: CdpChromeRuntime;
  artifactRoot: string;
}

export interface RouteRule {
  id: string;
  path: string;
  classification: 'public-safe' | 'authentication-entry';
  authenticatedMarkerSelectors: string[];
  captures: Array<'snapshot' | 'console-summary' | 'network-summary' | 'screenshot-safe'>;
}

export interface PublicCdpPolicy {
  chromeRuntime: CdpChromeRuntime;
  routes: CdpRoutePolicy;
  requests: CdpRequestPolicy;
}

export interface PolicyFileSystem {
  lstat(path: string): { isFile(): boolean; mode: number };
  realpath(path: string): string;
  accessExecutable(path: string): void;
}

export function loadPublicCdpPolicy(root: string): PublicCdpPolicy;
export async function loadPublicCdpEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  policy: PublicCdpPolicy,
  root: string,
  context: { timeoutMs: number; signal: AbortSignal },
  fileSystem?: PolicyFileSystem,
): Promise<PublicCdpEnvironment>;
export function resolveRoute(policy: PublicCdpPolicy, routeId: string): RouteRule;
export function decideRequest(policy: PublicCdpPolicy, input: {
  url: string;
  method: string;
  hasBody: boolean;
  resourceType: 'Document' | 'Stylesheet' | 'Image' | 'Media' | 'Font' | 'Script' | 'XHR' | 'Fetch' | 'Manifest' | 'Other';
  headerNames: string[];
}): { allowed: true; originRole: 'staging-app'; pathTemplate: Exclude<CdpSafePathTemplate, 'blocked'> }
  | { allowed: false; reasonCode: string };
```

Load the two YAML policies plus the JSON Chrome runtime, validate all three with Task 3 schemas, recompute policy revisions from the displayed record/field/array order, and reject any mismatch. Before calling `new URL`, reject NUL and any case-insensitive `%2e`, `%2f`, `%5c`, or `%25` sequence in the raw URL; this preserves encoded traversal evidence that URL canonicalization could erase. Then normalize with `new URL`, reject username/password/query/hash for every navigation and subresource decision, decode each pathname segment once, reject dot segments and backslashes, and compare exact origin/path/method values. Require `hasBody === false` and one exact closed resource type. Normalize header names to unique lower-case ASCII and permit only the reviewed incoming names `accept`, `accept-language`, `cache-control`, `pragma`, `purpose`, `sec-purpose`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-fetch-dest`, `sec-fetch-mode`, `sec-fetch-site`, `sec-fetch-user`, `upgrade-insecure-requests`, `user-agent`, and `referer`; reject `authorization`, `proxy-authorization`, `cookie`, every `content-*`, every `if-*`, `range`, `forwarded`, every `proxy-*`, `x-http-method-override`, `x-method-override`, `x-http-method`, every other `x-*`, and every unknown name such as `foo`. Header values never enter policy or its result/error. The three exact `sec-ch-ua*` names are required because the audited Chrome 150 first-document pause emits them; their values are still discarded and never forwarded. A successful decision's `pathTemplate` is derived only from the matched policy record: an exact path returns that reviewed literal, while prefix matches return exactly `/assets/:asset`, `/locales/:asset`, or `/icons/:asset`; no unmatched suffix byte is copied or hashed. A denied decision exposes only a stable reason code. Tests cover Chrome 150's exact first-document name set, `OPTIONS` with/without body, body-bearing `GET`, all override spellings/casing, duplicate/invalid header names, `Foo`, payload-bearing `Accept`, `Range`, and every `If-*`; Task 9's tests prove accepted values are overwritten by the exact resource profile and no marker reaches the real wire, while benign-word secret chunks in allowed suffixes never reach the result.

Validate `expectedGitSha` with `^[0-9a-f]{40}$`. Validate `meshIp` with `node:net.isIP(value) === 4`, reconstruct it from four decimal octets and require byte-for-byte equality, then reject first octet `0`, `127`, or `>=224` and exact `255.255.255.255`. For Chrome, first require the exact literal system path, then synchronous `lstat().isFile()`, `realpath(input) === input`, executable mode/access, and post-call identity checks through the narrow injectable filesystem seam. The production adapter uses only fixed-path `node:fs` synchronous calls on the local system application path; it checks the positive signal/deadline before and after each call, starts no asynchronous operation, and therefore cannot leave an uncancelled filesystem promise after timeout. Tests inject signal flips/deadline expiry at every boundary. Task 7 performs the independent code-signature/bundle/version attestation immediately before spawn. `artifactRoot` is always `path.resolve(root, 'artifacts/cdp')`; the environment cannot redirect it.

- [ ] **Step 5: Add only the new public-CDP executable variable to `.env.example`**

Append:

```text
FREELAND_CDP_CHROME_EXECUTABLE
```

Do not add a profile path, CDP port, debugging URL, session token, or credential variable.

- [ ] **Step 6: Run focused and aggregate checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/policy.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 7: Commit Task 4**

```bash
set -euo pipefail
git add config/cdp packages/cdp-broker/src/policy.ts \
  tests/cdp/policy.test.ts .env.example
git commit -m "feat: define read-only staging CDP policy"
```

### Task 5: Implement the Daemon-Private CDP Pipe Transport

**Files:**

- Create: `packages/cdp-broker/src/cdp-transport.ts`
- Create: `tests/cdp/cdp-transport.test.ts`

**Interfaces:**

- **Consumes:** daemon-inherited readable/writable pipe handles from Task 7.
- **Produces:** `CdpTransport.connect`, `send`, `onEvent`, and `close`. These functions are internal and never exported through the agent command registry.

- [ ] **Step 1: Write failing transport/router tests**

Test injected fake owned pipe endpoints for:

- sequential numeric request IDs;
- out-of-order response resolution;
- CDP error propagation without echoing params;
- event delivery with optional `sessionId`;
- per-request timeout and cancel;
- null-byte framing across split/coalesced chunks and a maximum 32 MiB inbound message;
- invalid UTF-8, invalid JSON, unknown response IDs, oversize messages, pipe error, or premature EOF closes the transport and rejects all pending requests;
- connect abort before listener installation destroys only the supplied owned endpoints and leaves no timer, listener, or pending request;
- bounded explicit close ends/destroys both endpoints on timeout/abort and leaves no pending listener or promise;
- production connection accepts only a branded Task 7 `PrivateCdpPipe`, never a URL, port, path, generic fd number, or socket; source tests require that only `chrome-lifecycle.ts` calls the narrow pipe factory outside transport unit tests;
- no endpoint/profile/pipe metadata appears in errors or any public result.

Use `Target.getTargets` through the resulting browser connection in a focused fixture to prove target discovery requires no HTTP `/json/*` surface.

- [ ] **Step 2: Run the transport test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/cdp-transport.test.ts
```

Expected: FAIL with missing transport modules.

- [ ] **Step 3: Implement the minimal null-delimited pipe transport**

Create:

```ts
export interface CdpEvent {
  sessionId?: string;
  method: string;
  params: Record<string, unknown>;
}

export interface CdpConnection {
  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<T>;
  onEvent(listener: (event: CdpEvent) => void): () => void;
  close(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<void>;
}

declare const privateCdpPipeBrand: unique symbol;
export interface PrivateCdpPipe {
  readonly [privateCdpPipeBrand]: true;
  readonly readable: NodeJS.ReadableStream;
  readonly writable: NodeJS.WritableStream;
}

export function createPrivateCdpPipe(
  readable: NodeJS.ReadableStream,
  writable: NodeJS.WritableStream,
): PrivateCdpPipe;

export class CdpTransport implements CdpConnection {
  static async connect(
    pipe: PrivateCdpPipe,
    options?: {
      timeoutMs?: number;
      signal?: AbortSignal;
    },
  ): Promise<CdpTransport>;
}
```

`createPrivateCdpPipe` only wraps already-open stream objects and cannot open/derive a process fd; Task 7 calls it with the exact inherited child fd 3/4 endpoints before exposing the resulting `OwnedChrome` internally. It is not exported from the package index or agent registry, and a source contract permits imports only from `chrome-lifecycle.ts` and its unit test. Encode one JSON object plus `\0` per outbound command and reject embedded/trailing bytes. Use one pending map, one event-listener set, a 32 MiB incremental input cap, one bounded default timeout of 15 seconds, and sanitized errors containing method name and CDP error code only. A connect, per-call, or close timeout may only reduce that default; abort removes and rejects the pending request immediately or closes an unhealthy transport, then awaits its bounded endpoint cleanup before returning. Never include serialized params or raw messages in errors. Browser/target discovery uses only `Target.getTargets` over this connection; the implementation contains no HTTP/WebSocket client and never creates a listening socket.

Primary implementation anchor: Chromium's browser API specifies fd 3 for reading and fd 4 for writing the remote-debugging pipe: [DevToolsAgentHost](https://chromium.googlesource.com/chromium/src/+/master/content/public/browser/devtools_agent_host.h).

- [ ] **Step 4: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/cdp-transport.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Commit Task 5**

```bash
set -euo pipefail
git add packages/cdp-broker/src/cdp-transport.ts tests/cdp/cdp-transport.test.ts
git commit -m "feat: add private CDP pipe transport"
```

### Task 6: Build the Private Artifact Store and Ownership-Safe Retention

**Files:**

- Create: `packages/cdp-broker/src/artifacts.ts`
- Create: `packages/cdp-broker/src/control-runtime.ts`
- Create: `tests/cdp/artifacts.test.ts`
- Create: `tests/cdp/fixtures.ts`

**Interfaces:**

- **Consumes:** Task 3 artifact-index/session contracts and `artifactRoot` from Task 4.
- **Produces:** `deriveSessionControl`, atomic bootstrap `createSessionArtifacts`, `createSessionControl`, `writePrivateManifest`, `readPrivateManifest`, `recordArtifactCandidate`, `writePrivateJson`, `writePrivatePng`, bounded creation-lease/session reconciliation, `transitionExpiredSessionState`, `removeOwnedSessionControl`, and `cleanupExpiredSessions`; there is no public standalone session-directory delete primitive.

- [ ] **Step 1: Write failing path, permission, atomicity, and retention tests**

Use temporary directories and runtime-generated IDs. Assert:

1. `deriveSessionControl(session)` returns the exact control paths without creating them. `createSessionArtifacts(root, session, daemonIdentity, control, now)` derives the exact session-bound platform profile path without creating it, then builds an exact hidden creation directory with mode `0700`, a closed ownership lease, a schema-valid bootstrap `starting` manifest containing that path with `profileReleased:false`, and an empty `cdp-artifact-index.v1.json` with mode `0600`, `candidate:null`, and exact creation/expiry instants; after fsync it atomically renames the complete directory to `root/freeland-cdp-<session>`. The published session is therefore never manifestless, partially bootstrapped, or missing a profile cleanup locator.
2. Manifest and JSON are schema-validated, serialized deterministically with one trailing newline, and written by temporary file plus rename.
3. `recordArtifactCandidate` accepts the first attested candidate, atomically replaces `candidate:null` in the index, and rejects replacement by a different identity.
4. Observation JSON and PNG writes accept only a closed artifact kind plus reviewed route ID and typed safe values/validated bytes, never accept an arbitrary basename/path, atomically allocate a per-`(kind, route)` four-digit ordinal, and append the unique digest record to the artifact index. The first four live-smoke names are `snapshot-landing-0001.json`, `console-landing-0001.json`, `network-landing-0001.json`, and `public-landing-0001.png` regardless of command timing.
5. Absolute paths outside the root, `..`, symlink roots, symlink session directories, symlink files, and a root equal to `/`, a home directory, or the repository root are rejected.
6. No API can delete a session directory by root/session alone. `cleanupExpiredSessions` re-reads and digest-binds each candidate, requires exact session match, `expiresAt <= now`, `state:'stopped'`, `profileReleased:true`, and absent owned control before deleting only that exact directory; it refuses starting/active/stopping/quarantined/unreleased/malformed/changed directories.
7. `listExpiredSessionManifests` examines direct children only and returns bounded schema-valid manifests plus a SHA-256 of their exact bytes to daemon-internal reconciliation. `transitionExpiredSessionState` re-reads the exact owned non-symlink manifest, requires that digest unchanged, and atomically permits only schema-valid quarantine or no-profile stopped transitions; it accepts no arbitrary patch. For a persisted unreleased profile, only `releaseExpiredSessionProfile` can validate/remove it and atomically publish `state:'stopped', profileReleased:true`. `cleanupExpiredSessions` deletes only expired valid sessions already `stopped` with `profileReleased:true`, and leaves live, unreleased, quarantined, malformed, changed, and unknown entries untouched.
8. Simulated crashes cover after profile creation/before watchdog spawn and every later `starting|active|stopping` boundary. Task 13's observation-only identity reconciliation proves daemon/watchdog/Chrome all absent, calls the digest-bound profile release when necessary, proves the profile path absent plus `profileReleased:true`, and only then permits artifact/control cleanup. Any live process, PID/start-token/executable mismatch, changed manifest/lease digest, unexpected profile path/type/owner/mode, removal uncertainty, or inspection uncertainty quarantines and retains the session/profile evidence.
9. A partial temporary file or same-process creation directory is removed after a simulated failure without deleting any published session. A simulated process crash at every bootstrap boundary leaves at most one exact hidden creation lease; bounded reconciliation removes it only after 15 minutes and observation-only daemon PID/start-token/executable inspection proves the creator absent. Live, mismatched, malformed, symlinked, recent, or changed leases are retained/quarantined and never recursively removed.
10. The control directory is exactly `/private/tmp/flc-<session>` on macOS and `/tmp/flc-<session>` on Linux, is created exclusively with mode `0700`, contains only `c.sock`, and yields a UTF-8 socket path shorter than 100 bytes. Existing paths, symlinks, unsupported platforms, or a longer path fail closed.
11. Control cleanup is idempotent when the exact derived directory is absent and otherwise removes only its exact non-symlink `c.sock` and directory. Expired artifact cleanup removes that owned control directory before its artifact directory; any control ownership mismatch retains the artifact record for review.
12. Every create/read/manifest/index/artifact/control/cleanup API accepts the linked bounded I/O context. An abort before open, after temporary-file write, or before either final rename removes only the owned temporary file and creates neither a final artifact nor an index record; a late abort can never publish an `active`/`stopped` manifest, candidate, artifact, or index change after its startup/command/cleanup deadline.

Create shared fixture builders in `tests/cdp/fixtures.ts`; secret-shaped strings are assembled at runtime so the repository scanner never sees a complete credential literal.

- [ ] **Step 2: Run the focused test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/artifacts.test.ts
```

Expected: FAIL because `packages/cdp-broker/src/artifacts.ts` does not exist.

- [ ] **Step 3: Implement path containment and private writes**

Create these exact public signatures:

```ts
export interface SessionArtifacts {
  session: string;
  directory: string;
  manifestPath: string;
  indexPath: string;
  profileDirectory: string;
}

export interface SessionControl {
  session: string;
  directory: string;
  socketPath: string;
}

export interface ArtifactIoContext {
  signal: AbortSignal;
  timeoutMs: number;
}

export function deriveSessionControl(
  session: string,
  platform?: NodeJS.Platform,
): SessionControl;

export async function createSessionArtifacts(
  artifactRoot: string,
  session: string,
  daemonIdentity: { pid: number; startToken: string },
  control: SessionControl,
  now: Date,
  context: ArtifactIoContext,
): Promise<SessionArtifacts>;

export async function createSessionControl(
  control: SessionControl,
  context: ArtifactIoContext,
): Promise<SessionControl>;

export async function writePrivateManifest(
  artifacts: SessionArtifacts,
  manifest: CdpSessionManifest,
  context: ArtifactIoContext,
): Promise<void>;

export async function readPrivateManifest(
  artifactRoot: string,
  session: string,
  context: ArtifactIoContext,
): Promise<CdpSessionManifest>;

export async function recordArtifactCandidate(
  artifacts: SessionArtifacts,
  candidate: CandidateIdentity,
  context: ArtifactIoContext,
): Promise<void>;

export async function writePrivateJson<K extends 'snapshot' | 'console' | 'network'>(
  artifacts: SessionArtifacts,
  descriptor: {
    kind: K;
    routeId: string;
  },
  value: Extract<CdpObservation, { kind: K }>,
  context: ArtifactIoContext,
): Promise<{ basename: string; bytes: number; sha256: string }>;

export async function writePrivatePng(
  artifacts: SessionArtifacts,
  descriptor: { kind: 'public'; routeId: string },
  bytes: Uint8Array,
  context: ArtifactIoContext,
): Promise<{ basename: string; bytes: number; sha256: string }>;

export async function listExpiredSessionManifests(
  artifactRoot: string,
  now: Date,
  context: ArtifactIoContext,
): Promise<Array<{
  manifest: CdpSessionManifest;
  manifestSha256: string;
}>>;

export async function listRecoverableNonterminalManifests(
  artifactRoot: string,
  context: ArtifactIoContext,
): Promise<Array<{
  manifest: CdpSessionManifest;
  manifestSha256: string;
}>>;

export async function listExpiredCreationLeases(
  artifactRoot: string,
  now: Date,
  context: ArtifactIoContext,
): Promise<Array<{
  session: string;
  daemonPid: number;
  daemonStartToken: string;
  createdAt: string;
  leaseSha256: string;
}>>;

export async function removeAbandonedCreationLease(
  artifactRoot: string,
  session: string,
  expectedLeaseSha256: string,
  context: ArtifactIoContext,
): Promise<void>;

export async function transitionExpiredSessionState(
  artifactRoot: string,
  session: string,
  expectedManifestSha256: string,
  state: 'stopped' | 'quarantined',
  context: ArtifactIoContext,
): Promise<void>;

export async function releaseExpiredSessionProfile(
  artifactRoot: string,
  session: string,
  expectedManifestSha256: string,
  context: ArtifactIoContext,
): Promise<void>;

export async function removeOwnedSessionControl(
  control: SessionControl,
  context: ArtifactIoContext,
): Promise<void>;

export async function cleanupExpiredSessions(
  artifactRoot: string,
  now: Date,
  context: ArtifactIoContext,
): Promise<{ removed: string[]; retained: string[] }>;
```

Use `lstat`, `realpath`, `open` with exclusive/no-follow flags, explicit `chmod`, and generated basename pattern `^(snapshot|console|network|public)-[a-z][a-z0-9-]{2,31}-[0-9]{4}\.(json|png)$`. Validate `ArtifactIoContext.timeoutMs` as an integer from 1 through 5,000, combine it with `signal`, and pass the resulting signal to every filesystem adapter that supports cancellation. Validate manifests, candidates, observations, artifact indexes, creation leases, and `SessionControl` derivation before every durable write/read/remove. `writePrivateJson` has the discriminated generic above and also performs a runtime `descriptor.kind === value.kind` check before allocation, so no observation can be stored/indexed under a different kind. It canonicalizes the already-validated observation once, appends exactly one newline, requires total UTF-8 bytes `<= CDP_JSON_ARTIFACT_FILE_MAX_BYTES`, and rejects rather than truncating (truncation belongs to Task 10/11 producers); index `bytes`/digest cover the complete file including newline. Tests cross every descriptor/value mismatch, pin 65,536 success and 65,537 rejection, and agree with Task 15 verifier. Require artifact root basename `cdp` and its parent basename `artifacts`. A creation directory is exactly `.freeland-cdp-<session>.creating`, is created exclusively, and contains only the closed lease, bootstrap manifest, and empty index before its atomic directory rename; the lease records only session, daemon PID/start token, and creation time. Lease listing is direct-child/bounded, re-hashes exact bytes, and only `removeAbandonedCreationLease` can delete an unchanged lease after Task 13 separately proves its daemon absent. Require 15 minutes exactly for creation-lease expiry and seven days exactly (`7 * 24 * 60 * 60 * 1000`) for session expiry.

`listRecoverableNonterminalManifests` scans a bounded number of direct children on every daemon startup, independent of seven-day artifact expiry, and returns only schema-valid `starting|active|stopping` or unreleased stopped/quarantined candidates plus exact digest; overflow fails startup rather than silently omitting a raw profile. `releaseExpiredSessionProfile` (the historical name is kept in the implementation API) is therefore callable immediately, not only after expiry, but only after Task 13 has proved every persisted process identity absent and `findProfileUsers(exactProfile) === 'none'` regardless of manifest phase. It re-reads and digest-binds the unchanged manifest, requires an allowed pre-stopped state and `profileReleased:false`, validates the profile as an owned non-symlink directory whose real parent is fixed `/private/tmp` on macOS (or `/tmp` on Linux), basename equals `freeland-cdp-profile-<session>`, and ownership/mode match the current user/`0700`; it accepts no caller path or environment-derived temp root. It removes only that exact directory under the bounded context, proves absence, then atomically writes the same historical manifest with only `state:'stopped'` and `profileReleased:true` changed. If the directory is already absent after a prior crash between removal and manifest rename, the same unchanged digest plus absent processes/path permits the idempotent state update. Any process/profile scan `present|uncertain` or other mismatch quarantines instead of deleting. Normal live shutdown uses the same path validator and all-profile-process proof before Task 7 release and writes `profileReleased:true` before `stopped`. Sanitized artifact deletion remains governed by the original seven-day `expiresAt`.

Serialize artifact allocation, file publication, and index publication through one session-local promise chain. Under that lock, validate existing index uniqueness, count the exact `(kind, route)` tuple, allocate `count + 1`, and enforce at most 16 artifacts per tuple and 64 total per session; limit exhaustion returns a typed failure before a temporary file exists. On restart, derive the next ordinal only from the validated durable index. Tests issue repeated and concurrent same-kind commands, require unique `0001`/`0002` names with no overwrite/lost record, and exhaust both caps. Every API rechecks the linked signal before open, fsync, rename, index publication, and removal; its injected filesystem adapter must settle or acknowledge cancellation before the API returns. No rename or index/manifest publication may begin after abort. Never call recursive removal until containment, non-symlink, naming, lease/manifest ownership, and—when present—short control-directory ownership checks all pass.

- [ ] **Step 4: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/artifacts.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0; permission assertions may skip only on Windows, while Linux/macOS CI must execute them.

- [ ] **Step 5: Commit Task 6**

```bash
set -euo pipefail
git add packages/cdp-broker/src/artifacts.ts packages/cdp-broker/src/control-runtime.ts \
  tests/cdp/artifacts.test.ts tests/cdp/fixtures.ts
git commit -m "feat: add private CDP artifact custody"
```

### Task 7: Own Chrome Lifecycle Without Exposing the Debug Endpoint

**Files:**

- Create: `packages/cdp-broker/src/process-owner.ts`
- Create: `packages/cdp-broker/src/egress-proxy.ts`
- Create: `packages/cdp-broker/src/chrome-watchdog.ts`
- Create: `packages/cdp-broker/src/chrome-lifecycle.ts`
- Create: `tests/cdp/chrome-lifecycle.test.ts`

**Interfaces:**

- **Consumes:** Task 4 environment, Task 5 pipe transport, and Task 6 artifacts.
- **Produces:** `startOwnedChrome`, bounded `inspectOwnedChrome`, three narrow shutdown phases (`quiesceOwnedChromeEgress`, `terminateOwnedChrome`, `releaseOwnedChromeResources`), and a startup-unwind-only `stopOwnedChrome`; returns a source-exported/package-private `OwnedChrome` with inherited pipe handles only to the daemon.

- [ ] **Step 1: Write failing launch and ownership tests with injected process/filesystem adapters**

Test the exact launch contract:

```ts
export interface OwnedChrome {
  pid: number;
  startToken: string;
  watchdogPid: number;
  watchdogStartToken: string;
  executable: string;
  profileDirectory: string;
  startedAt: string;
  cdpPipe: PrivateCdpPipe;
  watchdogExited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  egressProxy: OwnedEgressProxy;
  proxyAuth: PrivateProxyAuth;
}
```

Assertions:

- executable and mesh IP must already pass Task 4 environment validation;
- before creating a profile/proxy, a fixed-purpose bounded attestor requires the exact system app path and the literal designated requirement `identifier "com.google.Chrome" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = EQHXZ8M8AV`. It invokes `/usr/bin/codesign` with the exact argv `--verify --deep --strict -R=<that literal> /Applications/Google Chrome.app`, then a separate fixed `-d --verbose=4` read whose bounded stderr must contain exactly one `Identifier=com.google.Chrome` and one `TeamIdentifier=EQHXZ8M8AV`; exit status, timeout, duplicate/missing field, truncation, or any other parsed value fails. It independently requires exact `CFBundleIdentifier` and `CFBundleShortVersionString` from the fixed `Contents/Info.plist` through `/usr/bin/plutil`. For `execFile(executable, ['--version'])`, the pinned macOS build's raw stdout must be byte-exact `Google Chrome 150.0.7871.187 \n` (one ASCII space, then LF) and stderr empty; the attestor removes only that exact two-byte suffix when returning the typed version and performs no generic trim. Any wrapper, script, alternate path, signature/team/requirement/version drift, timeout, signal, or extra/missing whitespace/output fails before filesystem/network/browser creation;
- profile path comes only from Task 6's already-durable `SessionArtifacts.profileDirectory`; Task 7 re-derives the exact platform/session path, requires it absent, and creates that one directory exclusively with mode `0700` before proxy/watchdog spawn;
- before Chrome exists, an OS-assigned `127.0.0.1` allow-one CONNECT proxy starts with a fixed realm and 32 random bytes of base64url password from `crypto.randomBytes`; the branded `PrivateProxyAuth` (origin/realm/fixed username/password) exists only in daemon memory. An unauthenticated or wrong-credential `CONNECT` receives a bounded `407` and opens zero upstream sockets; only exact Basic proxy authentication plus exact `CONNECT mf0.forum:443` can open `net.connect({host: validatedMeshIp, port:443})` without DNS. The proxy strips its auth header, rejects every other authority/method, logs no request/auth bytes, and exposes its port/auth only inside `OwnedChrome`. Before authentication it caps all accepted client sockets—not just tunnels—at eight concurrent and 64 lifetime, admits no queue, requires the complete first header within 2,000 monotonic milliseconds, and permits at most 8,192 header bytes, 32 header lines, and 1,024 bytes per line. It rejects before any upstream allocation: an invalid request line, bare LF, NUL/control bytes, obsolete folding, whitespace before a colon, duplicate `Host` or `Proxy-Authorization`, `Content-Length`, `Transfer-Encoding`, multiple header terminators, or any bytes after the first terminator. Overflow, timeout, parser ambiguity, and lifetime exhaustion destroy the client immediately, close admission, and trigger the broker's fatal watcher. After authentication it additionally hard-caps eight concurrent tunnels, 64 lifetime tunnel opens, 64 MiB aggregate bidirectional bytes, and 16 MiB in any monotonic ten-second window; counters saturate, buffers remain bounded, and the first limit breach destroys all tunnels, closes admission with reason `budget_exceeded`, and triggers the broker's fatal watcher;
- a direct-child watchdog starts in a two-phase protocol and owns the future Chrome child. It first reports only its PID/start token and waits. `onWatchdogSpawned` must durably publish Task 3 starting phase (b); only then may the daemon call `authorizeChromeSpawn`. The watchdog starts Chrome, retains its direct handle, and reports Chrome PID/start token. The daemon and Chrome communicate through inherited fd 3/4 pipe ends; the watchdog passes Chrome's ends without reading, copying, naming, or persisting CDP bytes. Watchdog IPC carries a lifetime channel whose EOF/disconnect triggers ownership-checked Chrome termination;
- launch arguments contain `--user-data-dir=<exact profile>`, `--remote-debugging-pipe`, `--no-startup-window`, `--headless=new`, `--window-size=1280,960`, `--force-device-scale-factor=1`, `--proxy-server=http://127.0.0.1:<owned proxy port>`, `--proxy-bypass-list=<-loopback>`, `--host-resolver-rules=MAP * ~NOTFOUND`, `--dns-prefetch-disable`, `--disable-quic`, `--use-mock-keychain`, `--no-first-run`, `--no-default-browser-check`, `--disable-background-networking`, `--disable-component-update`, `--disable-component-extensions-with-background-pages`, `--disable-crashpad-for-testing`, `--disable-domain-reliability`, `--disable-extensions`, `--disable-sync`, `--disable-updater-scheduler`, `--disable-features=<the exact comma-joined Task 3 disabledBrowserFeatures tuple>`, and `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`; there is no positional URL and the fixed scale-1 viewport must equal Task 4's runtime manifest. The feature argument must byte-equal `BackgroundFetch,BrowsingTopics,ConversionMeasurement,DialMediaRouteProvider,DirectSockets,DurableMessages,FedCm,FencedFrames,FetchLaterAPI,FetchRetry,InterestGroupStorage,KeepAliveInBrowserMigration,MediaRouter,NetworkErrorLogging,PreconnectToSearch,Prerender2,PrivateAggregationApi,Reporting,SecurePaymentConfirmationBrowser,ServiceWorkerPaymentApps,SharedStorageAPI,UseKeychainKeyProvider,WebPayments`. The removed/no-op names `AttributionReportingCrossAppWeb`, `NetworkPrediction`, `PrivacySandboxAdsAPIs`, and `SpeculationRulesPrefetch` are forbidden: the exact signed Chrome 150 binary exposes none of them, and Chromium deleted the old privacy umbrella ([removal CL](https://chromium.googlesource.com/chromium/src/+/d8b4ba2d881eef613b7a931b799cdad6749e8ec1%5E%21/)). Current individual producer features plus the resolver/proxy/guard/canaries remain explicit. Do not claim a non-existent `--disable-blink-features=WebTransport` layer: Chrome 150 has no reviewed top-level runtime feature with that name, so WebTransport is contained by pre-resume constructor lockdown, `--disable-quic`, the allow-one CONNECT jail, transport-event fatal handling, and real guarded canaries. Pin Chrome-owned process/reporter switches to [Chromium's reviewed switch definitions](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/common/chrome_switches.cc), pin the exact Chrome-150 sync and async OS-Crypt consumers of `--use-mock-keychain`, plus the independently disabled `UseKeychainKeyProvider` construction path ([sync fake keychain](https://chromium.googlesource.com/chromium/src/+/158a2d2a5432e8b49c3ab60f4665e26742955a23/components/os_crypt/sync/os_crypt_mac.mm#81), [async fake keychain](https://chromium.googlesource.com/chromium/src/+/158a2d2a5432e8b49c3ab60f4665e26742955a23/components/os_crypt/async/browser/keychain_key_provider.mm#39), [test launcher](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/test/base/test_launcher_utils.cc), [provider gate](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/browser_process_impl.cc#1606)), keep DIAL/media routing disabled because DIAL performs periodic SSDP discovery ([media-router feature source](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/media/router/media_router_feature.h)), and disable the browser-process keepalive/retry migration because it can resend a website's original method, headers, and body after renderer loss ([default migration](https://chromium.googlesource.com/chromium/src/+/85fa9effdb2dc25a239a38ab52e1dfdaa10d1e4d%5E%21/), [retry loader](https://chromium.googlesource.com/chromium/src/+/main/content/browser/loader/keep_alive_url_loader.cc)); the real smoke proves all exact switches plus the browser-initiated-write and local-discovery feature bundles on the spawned command;
- arguments never contain `--remote-debugging-port`, `--remote-debugging-address`, `--remote-allow-origins=*`, a proxy bypass for the staging host, production host, proxy credentials, or an app URL; `DevToolsActivePort` must not exist at any startup point;
- tests feed unauthenticated/wrong-token direct loopback clients, slowloris fragments, pre-auth socket floods, overlong request/header lines, duplicate/smuggled headers, bytes after the terminator, foreign hostname, literal-IP, DNS-prefetch, preconnect, upgrade, plain HTTP, and alternate-port attempts and prove bounded memory/latency plus zero upstream/DNS socket opens; only the exact in-memory capability plus permitted CONNECT reaches the injected mesh-IP socket adapter. A source/runtime test scans loopback/argv and proves knowledge of the port alone cannot tunnel a write;
- timeout, early watchdog/Chrome/proxy exit, malformed IPC, unexpected extra fd, or pipe-connect failure terminates only the proven watchdog/Chrome/proxy and quarantines rather than deletes an uncertain profile;
- abort/crash tests at the boundary before exclusive profile creation leave no directory; after creation they leave a path already recorded in the bootstrap manifest, so normal unwind or Task 6/13 crashed-session release can prove/remove it. No random `mkdtemp` path exists outside durable ownership evidence;
- `onWatchdogSpawned` receives and durably records the watchdog phase before Chrome authorization; `onSpawned` receives the complete watchdog/Chrome ownership tuple before the CDP pipe is connected. Callback failure or `AbortSignal` at every startup phase stops only proven direct children/profile/proxy and never returns a pipe handle through a public type;
- closing the simulated daemon lifetime channel makes the injected watchdog terminate its exact fake Chrome child with the same bounded TERM/KILL sequence and exit. The proxy remains daemon-owned: a live daemon closes it explicitly, while real daemon death closes the listener and tunnels by OS descriptor ownership. Task 7 deterministic tests use only injected process/proxy/watchdog fakes; Task 15 owns the equivalent real-Chrome parent-loss regression and treats unsupported behavior as a hard local-smoke failure, never a CI skip;
- normal stop goes through the still-live direct watchdog handle; inside the watchdog, the still-live direct Chrome child handle plus exact birth token/argv is checked before `SIGTERM`, then raced against a 5,000 ms monotonic deadline;
- after that deadline, the watchdog rechecks the same direct-child birth token/argv before `SIGKILL`, followed by a second 5,000 ms exit deadline and final absence check;
- shutdown closes proxy admission and all owned tunnels before signalling Chrome, then proves both Chrome and watchdog absence. If the watchdog exits first, the daemon has no Chrome signalling authority: it closes both owned CDP pipe endpoints, relying only on Chromium's registered pipe-disconnect `CloseBrowserSoon` callback, and boundedly observes exact Chrome absence. A survivor is `BROWSER_FAIL` with closed egress and retained evidence; it is never signalled by persisted PID. PID reuse, command mismatch, or a proven survivor after `SIGKILL` likewise returns `BROWSER_FAIL`, never waits indefinitely, and retains the profile; profile deletion occurs only after proven process absence. Unit tests cover the unexpected-watchdog fallback, and Task 15 must kill the real watchdog through the narrow production test seam and prove zero Chrome survivor.

Flag semantics are pinned to Chromium primary sources: `DirectSockets` is a base feature and must appear exactly once only in the ordered `--disable-features` tuple. Source and real-Chrome tests reject any invented or unreviewed `--disable-blink-features=WebTransport` argument; WebTransport containment is proven through the independent guard, QUIC, proxy, event-fatal, and canary layers above.

- [ ] **Step 2: Run the lifecycle test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/chrome-lifecycle.test.ts
```

Expected: FAIL with missing lifecycle modules.

- [ ] **Step 3: Implement process identity inspection**

`process-owner.ts` exports:

```ts
export interface ProcessIdentity {
  pid: number;
  startToken: string;
  executable: string;
}

export interface ProcessInspectionContext {
  timeoutMs: number;
  signal: AbortSignal;
}

export interface ProcessInspector {
  inspect(pid: number, context: ProcessInspectionContext): Promise<ProcessIdentity | null>;
  findProfileUsers(
    profileDirectory: string,
    context: ProcessInspectionContext,
  ): Promise<'none' | 'present' | 'uncertain'>;
}

export interface DirectChildEvidence {
  identity: ProcessIdentity;
  spawnedExecutable: string;
  spawnedArgv: readonly string[];
  handleUnsettled: boolean;
}

export function assertOwnedChromeProcess(
  evidence: DirectChildEvidence,
  expected: { executable: string; profileDirectory: string; startToken: string },
): void;

export function assertOwnedChromeWatchdogProcess(
  evidence: DirectChildEvidence,
  expected: {
    scriptPath: string;
    repositoryRoot: string;
    profileDirectory: string;
    startToken: string;
  },
): void;

export function assertOwnedDaemonProcess(
  evidence: DirectChildEvidence,
  expected: {
    scriptPath: string;
    repositoryRoot: string;
    session: string;
    startupTimeoutMs: 90000;
    startToken: string;
  },
): void;
```

The production inspector reads the exact process executable path and platform process-birth value through fixed-argument `execFile`/OS APIs, never a shell, and hashes the birth identity to a 64-lowercase-hex `startToken`. Every `execFile` receives the supplied `AbortSignal`, a reduced native timeout, a bounded output buffer, and is awaited through cancellation to settled callback/close before the inspector returns; timeout never leaves a detached child or promise. Direct signalling authority requires token equality, exact normalized executable, the original unsettled child handle, and the immutable exact argv recorded at spawn in daemon memory; it never reparses a flat `ps command` string. Recovery never signals, so a live PID/start/executable match is conservatively retained regardless of arguments. `findProfileUsers` is required before every profile release, including normal stop and every manifest phase; it performs one bounded observation-only process-table query and returns `none` only when zero browser/helper/renderer/GPU process exposes the exact deterministic profile argument through a boundary-preserving platform adapter. Flat-text ambiguity, truncation, timeout, or output overflow is `uncertain`. Tests inject unacknowledged-main and helper-only matching profile users and forbid deletion.

`ProcessInspector` is observation-only: a persisted PID/start-token/executable tuple or profile scan can prove absence/mismatch but is never authority to signal an orphan. The manifest deliberately persists no argv because Chrome's ephemeral proxy port is private; recovery therefore never requires or reconstructs argv. Only an in-memory direct `ChildProcess`/watchdog IPC handle whose exit latch is still unsettled may send a signal, and only that live path may compare its immutable spawn argv. Recovery without that handle fails closed. Error text contains only `owned_process_mismatch`, never the token or command line.

- [ ] **Step 4: Implement Chrome start/inspect/stop**

`chrome-lifecycle.ts` exports:

```ts
declare const privateProxyAuthBrand: unique symbol;
export interface PrivateProxyAuth {
  readonly [privateProxyAuthBrand]: true;
  origin: string;
  realm: 'freeland-cdp-owned';
  username: 'freeland-cdp';
  password: string;
}

export interface OwnedEgressProxy {
  port: number;
  auth: PrivateProxyAuth;
  stopAcceptingAndDestroyTunnels(options: { timeoutMs: number; signal: AbortSignal }): Promise<void>;
  closed: Promise<{ reason: 'stopped' | 'budget_exceeded' | 'unexpected' }>;
}

export interface SpawnedChromeWatchdog {
  watchdogPid: number;
  watchdogReady: Promise<{ watchdogStartToken: string }>;
  authorizeChromeSpawn(): void;
  chromeStarted: Promise<{
    pid: number;
    startToken: string;
    startedAt: string;
    cdpPipe: PrivateCdpPipe;
  }>;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  requestStop(): void;
  closeLifetimeChannel(): void;
}

export interface SafetyCleanupContext {
  deadlineMonotonicMs: number;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface ChromeLifecycleAdapters {
  randomBytes(size: 32): Uint8Array;
  attestChromeBundle(
    executable: string,
    context: ProcessInspectionContext,
  ): Promise<{
    executableVersion: 'Google Chrome 150.0.7871.187';
    bundleVersion: '150.0.7871.187';
    bundleId: 'com.google.Chrome';
    teamId: 'EQHXZ8M8AV';
    designatedRequirementValid: true;
  }>;
  createProfileDirectory(path: string, context: ProcessInspectionContext): Promise<void>;
  inspectPath(
    path: string,
    context: ProcessInspectionContext,
  ): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
  realPath(path: string, context: ProcessInspectionContext): Promise<string>;
  removeProfileDirectory(path: string, context: SafetyCleanupContext): Promise<void>;
  startEgressProxy(input: {
    meshIp: string;
    passwordBytes: Uint8Array;
    timeoutMs: number;
    signal: AbortSignal;
  }): Promise<OwnedEgressProxy>;
  spawnChromeWatchdog(input: {
    executable: string;
    profileDirectory: string;
    proxyPort: number;
    chromeArgs: string[];
    watchdogEnvironment: {
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin';
      LANG: 'en_US.UTF-8';
      LC_ALL: 'en_US.UTF-8';
      HOME: string;
      TMPDIR: string;
    };
    timeoutMs: number;
    signal: AbortSignal;
  }): SpawnedChromeWatchdog;
  processInspector: ProcessInspector;
  monotonicMs(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export interface ChromeStartHooks {
  signal: AbortSignal;
  timeoutMs: number;
  profileDirectory: string;
  onWatchdogSpawned(ownership: {
    watchdogPid: number;
    watchdogStartToken: string;
    executable: string;
    profileDirectory: string;
  }): Promise<void>;
  onSpawned(ownership: {
    pid: number;
    startToken: string;
    watchdogPid: number;
    watchdogStartToken: string;
    executable: string;
    profileDirectory: string;
    startedAt: string;
  }): Promise<void>;
}

export async function startOwnedChrome(
  environment: PublicCdpEnvironment,
  hooks: ChromeStartHooks,
  adapters?: ChromeLifecycleAdapters,
): Promise<OwnedChrome>;

export async function inspectOwnedChrome(
  chrome: OwnedChrome,
  context: ProcessInspectionContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<'running' | 'stopped' | 'ownership-mismatch'>;

export async function quiesceOwnedChromeEgress(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export async function terminateOwnedChrome(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export async function releaseOwnedChromeResources(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export async function stopOwnedChrome(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export async function induceParentLossForLocalSecuritySmoke(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export async function induceWatchdogCrashForLocalSecuritySmoke(
  chrome: OwnedChrome,
  context: SafetyCleanupContext,
  adapters?: ChromeLifecycleAdapters,
): Promise<void>;

export type LocalSecurityLaunchProfile =
  | 'production'
  | 'negative-http-browser-writes'
  | 'negative-dns-prefetch'
  | 'negative-preconnect'
  | 'negative-websocket'
  | 'negative-webtransport'
  | 'negative-webrtc'
  | 'negative-direct-tcp'
  | 'negative-direct-udp'
  | 'negative-targets-downloads'
  | 'negative-screenshot'
  | 'negative-lifecycle';

export async function startOwnedChromeForLocalSecuritySmoke(
  environment: PublicCdpEnvironment,
  hooks: ChromeStartHooks,
  fixture: {
    certificateSpkiSha256Base64: string;
    loopbackProxyFactory: ChromeLifecycleAdapters['startEgressProxy'];
    launchProfile: LocalSecurityLaunchProfile;
  },
  adapters?: ChromeLifecycleAdapters,
): Promise<OwnedChrome>;
```

The production adapter binds these exact seams to `node:fs/promises`, `node:net`, `node:child_process.spawn` with `shell:false`, fixed absolute `/usr/bin/codesign`/`/usr/bin/plutil` invocations and literal argv above, Task 7 observation-only `ProcessInspector`, and monotonic timers. Every attestation subprocess has fixed args, an 8 KiB combined-output cap, signal/native timeout, and settled cancellation; only the two named codesign fields are parsed, no localized success string is trusted, and raw signature output is never persisted/logged. Tests vary each requirement clause/field, duplicate fields, append version output, truncate output, and use a fake wrapper; every mismatch is rejected before proxy/profile creation. `egress-proxy.ts` owns the bounded allow-one proxy; `chrome-watchdog.ts` is a fixed internal executable that accepts only its exact ordered internal arguments and inherited pipes, spawns Chrome with `shell:false`, retains the direct child handle/exit latch, and implements the token/argv-checked bounded stop routine on explicit stop, daemon lifetime EOF, or IPC disconnect. The daemon starts the watchdog with exactly the typed five-variable environment above: fixed `PATH`/locale and `HOME`/`TMPDIR` equal to the already-owned profile directory. The watchdog starts Chrome with that same fixed `PATH`/locale and profile-bound `HOME`/`TMPDIR`, passing no `FREELAND_*`, `NODE_OPTIONS`, `SSLKEYLOGFILE`, proxy, crash-report, logging, preload, inspector, or caller-provided variable. Unit/source tests seed a hostile parent environment with every forbidden name and prove none reaches watchdog or Chrome. `chrome-lifecycle.ts` retains the direct watchdog child handle, starts the proxy/watchdog, awaits its bounded `watchdogReady`, durably completes `onWatchdogSpawned`, authorizes Chrome spawn, awaits `chromeStarted`, validates exact process birth identities, awaits `onSpawned`, and only then passes the branded inherited pipe to Task 5. Task 8 immediately rechecks exact product/protocol through `Browser.getVersion` before target creation/navigation, closing update/replace TOCTOU. If startup fails before guard installation, `stopOwnedChrome` composes the three narrow phases and uses only live direct handles. An aborted startup signal invokes that same bounded ownership-safe unwind at every phase. Require startup `timeoutMs` to be an integer from 1 through 15,000. Assert `DevToolsActivePort` is absent before and after connection.

`OwnedChrome`, `LocalSecurityLaunchProfile`, the two `induce*ForLocalSecuritySmoke` functions, and `startOwnedChromeForLocalSecuritySmoke` are exported from this source file only so Task 13 and the fixed operator smoke can type/import them; source-contract tests reject their re-export from the package index, CLI, or skill and reject every other importer. The smoke launcher validates one exact 44-character base64 SHA-256 SPKI value, appends only `--ignore-certificate-errors-spki-list=<that value>`, and accepts only the smoke-owned loopback proxy plus the closed `LocalSecurityLaunchProfile`. `production` delegates to the byte-identical production argv. Each `negative-*` literal maps internally to one reviewed complete capability-specific argv delta—for example enabling the exact browser-write feature tuple or removing the complete resolver/speculation transport bundle—while retaining headless/pipe/watchdog/profile/loopback destination jail and every unrelated production argument. Only `negative-http-browser-writes` additionally appends Chromium's fixed test switch `--short-reporting-delay`, with a 20,000 ms monotonic loopback-canary wait, so the Reporting/NEL positive control is deterministic; source tests reject that switch from production and every other profile. The API accepts no generic argv/feature string, URL, host, port, certificate bytes, or environment override. Tests snapshot every profile's full argv, require only its fixed delta from production, and prove no agent/CLI import can select it. Guard/CSS/download negative controls use equally closed module-local switches inside the operator tool, not this launch API. Do not print, persist, or return pipe/proxy/SPKI fields outside daemon-internal types.

Every lifecycle function requires a non-caller-cancellable `SafetyCleanupContext` whose signal comes only from the broker's 35,000 ms safety controller. Before each async operation it computes remaining time and passes `min(phaseCap, remaining)` plus that signal; cancellation is awaited to settlement. `quiesceOwnedChromeEgress` has a 2,000 ms cap and only closes daemon-owned admission/tunnels. `terminateOwnedChrome` has a 12,000 ms cap: with a live watchdog handle it requests the exact direct Chrome child `SIGTERM` (5,000 ms), rechecks token/argv, permits `SIGKILL` (5,000 ms), and proves Chrome/watchdog absence (2,000 ms). If the watchdog has already exited, it sends no PID signal, closes both daemon CDP pipe endpoints, and boundedly requires Chrome absence; current Chromium registers pipe disconnect with `ChromeDevToolsManagerDelegate::CloseBrowserSoon` in its [remote-debugging server](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/devtools/remote_debugging_server.cc), and failure to observe exit is a retained-evidence `BROWSER_FAIL`. After the direct pair is absent, every path also requires the bounded `findProfileUsers(exactProfile) === 'none'` proof so renderer/GPU/helper descendants cannot outlive their main handle unnoticed; `present|uncertain` is `BROWSER_FAIL`. `releaseOwnedChromeResources` has a 2,000 ms cap and may remove the validated profile only after that complete process/profile proof and, during broker shutdown, only after Task 9 guard teardown and Task 5 transport close. `stopOwnedChrome` is only the pre-guard startup-unwind composition `quiesce → terminate → close pipe → release`; Task 13 never calls it after guard installation.

Zero/negative remaining time starts no new phase and returns a typed cleanup-timeout with egress already closed when that phase was reached. Tests expire the shared fake deadline at every boundary and prove no detached timer, inspector child, adapter promise, or file operation survives. A missing process is idempotent success; changed identity, lost signalling authority, or a survivor is `BROWSER_FAIL` with the profile/evidence retained and proxy closed. `induceParentLossForLocalSecuritySmoke` first quiesces the daemon-owned proxy and then closes the actual production lifetime channel; `induceWatchdogCrashForLocalSecuritySmoke` ownership-checks and kills only the retained direct watchdog child, closes proxy plus both CDP endpoints, and observes Chrome exit without PID signalling. These fixed no-input seams are tests only. Task 14 orphan recovery has no direct handles and therefore only observes absence; it never signals a persisted PID.

- [ ] **Step 5: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/chrome-lifecycle.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 7**

```bash
set -euo pipefail
git add packages/cdp-broker/src/process-owner.ts packages/cdp-broker/src/egress-proxy.ts \
  packages/cdp-broker/src/chrome-watchdog.ts packages/cdp-broker/src/chrome-lifecycle.ts \
  tests/cdp/chrome-lifecycle.test.ts
git commit -m "feat: own isolated Chrome lifecycle"
```

### Task 8: Attest the Exact Browser and Staging Candidate

**Files:**

- Create: `packages/cdp-broker/src/attestation.ts`
- Create: `tests/cdp/attestation.test.ts`

**Interfaces:**

- **Consumes:** Task 4 environment/policy and Task 5 private `CdpConnection`.
- **Produces:** `validateCandidateEnvironment`, `preflightCandidateEnvironment`, `attestCandidateBeforeNavigation`, and `attestCandidateAfterNavigation`; no generic HTTP client or page evaluator is exported.

- [ ] **Step 1: Write failing pure validation tests**

Use a valid fixture:

```ts
const valid = {
  environment: 'staging',
  appEnv: 'staging',
  deployTarget: 'staging',
  publicOrigin: 'https://mf0.forum',
  releaseSha: '0123456789abcdef0123456789abcdef01234567',
  supabaseProjectRef: 'qsxsiunkflfumhcluyhv',
};
```

Require rejection of contradictory aliases, missing fields, production values, uppercase/wrong-length SHA, unexpected SHA, foreign Supabase, and origin path/query/hash. Test that the validated preflight value contains only environment, deploy target, public origin, release SHA, and Supabase project reference; the later browser step adds only Chrome major.

- [ ] **Step 2: Write failing daemon preflight and CDP read tests**

With an injected fixed-purpose HTTP adapter, require one request with method `GET`, connect address equal to the validated mesh IP, TLS `servername` and `Host` equal to `mf0.forum`, path `/api/environment`, 64 KiB response cap, standard certificate verification, and redirects disabled. The full-budget fixture passes a five-second timeout; a reduced-budget fixture passes the exact smaller positive remainder and linked signal. Abort must destroy the HTTPS request and await its close before rejection. Reject non-200 status, any `Location`, invalid/missing JSON content type, oversized/invalid JSON, contradictory aliases, and wrong SHA. Errors expose only stable reason codes, never response bytes.

With an injected connection, require the implementation to call only:

1. `Browser.getVersion` on the browser session before any app navigation, comparing its exact product/protocol/major with the supplied validated `CdpChromeRuntime` and combining only its major with the daemon preflight identity;
2. after guarded navigation, `Page.getFrameTree` followed by `Page.createIsolatedWorld` for the attested main frame with fixed world name `freeland-cdp-attestation-v1` and `grantUniversalAccess:false`;
3. one fixed `Runtime.evaluate` in that returned isolated execution context which records location before and after a fixed `/api/environment` `GET` using the isolated world's unmodified `fetch`, `credentials:'same-origin'`, `cache:'no-store'`, and returns only the two fixed-shape locations plus whitelisted identity aliases.

Require `Browser.getVersion` to equal Task 4's closed `browserProduct:'Chrome/150.0.7871.187'`, `protocolVersion:'1.3'`, and `major:150`; no range or minimum is accepted. Also require exact equality among daemon preflight, browser-fetched environment, expected SHA, both before/after locations, and reviewed route path, with `search === ''` and `hash === ''`. BrowserGuard must already have installed `Network.setBypassServiceWorker({bypass:true})` and cache disable before page resume. Test every product/protocol/version drift, main-world `fetch` monkeypatching, a claimed service worker returning spoofed environment JSON, isolated-world creation/context mismatch, and `history.pushState`/`replaceState` query/hash drift at each await; all must fail pre-navigation or post-attestation/screenshot without an artifact. Assert no exported function accepts a URL, world name, context ID, or expression and sanitized errors never include raw manifest content.

- [ ] **Step 3: Run the attestation test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/attestation.test.ts
```

Expected: FAIL with missing attestation module.

- [ ] **Step 4: Implement fixed-purpose preflight and fixed-expression browser attestation**

The production preflight adapter uses `node:https.request` with the exact fixed fields tested above, never accepts caller-supplied host/path/method, and never sets `rejectUnauthorized:false`. Create one constant `READ_ATTESTED_ENVIRONMENT_AND_LOCATION_EXPRESSION` and the isolated-world name inside the module without exporting them. `Runtime.evaluate` uses only the exact isolated `contextId`, `awaitPromise:true`, `returnByValue:true`, `userGesture:false`, and the caller's positive timeout capped at 15 seconds; the full-budget fixture uses exactly 15 seconds. Validate response URL is exactly `https://mf0.forum/api/environment`, no redirect occurred, both locations are identical/exact, and expected release equals `FREELAND_EXPECTED_STAGE_SHA`.

Export:

```ts
export interface CandidateEnvironmentIdentity {
  environment: 'staging';
  deployTarget: 'staging';
  publicOrigin: 'https://mf0.forum';
  releaseSha: string;
  supabaseProjectRef: 'qsxsiunkflfumhcluyhv';
}

export interface CandidatePreflightAdapter {
  request(input: {
    connectIp: string;
    servername: 'mf0.forum';
    hostHeader: 'mf0.forum';
    method: 'GET';
    path: '/api/environment';
    timeoutMs: number;
    signal: AbortSignal;
    maxBytes: 65536;
  }): Promise<{
    statusCode: number;
    contentType: string | null;
    location: string | null;
    body: Uint8Array;
  }>;
}

export function validateCandidateEnvironment(
  raw: unknown,
  expectedGitSha: string,
): CandidateEnvironmentIdentity;

export async function preflightCandidateEnvironment(
  environment: PublicCdpEnvironment,
  options: { timeoutMs: number; signal: AbortSignal },
  adapter?: CandidatePreflightAdapter,
): Promise<CandidateEnvironmentIdentity>;

export async function attestCandidateBeforeNavigation(
  connection: CdpConnection,
  preflight: CandidateEnvironmentIdentity,
  runtime: CdpChromeRuntime,
  options: { timeoutMs: number; signal: AbortSignal },
): Promise<CandidateIdentity>;

export async function attestCandidateAfterNavigation(
  connection: CdpConnection,
  pageSessionId: string,
  expected: CandidateIdentity,
  expectedRoute: RouteRule,
  runtime: CdpChromeRuntime,
  options: { timeoutMs: number; signal: AbortSignal },
): Promise<CandidateIdentity>;
```

Each function requires an integer positive `timeoutMs`; preflight additionally caps it at 5,000, and each browser attestation caps it at 15,000. Pass the signal and reduced timeout to the fixed-purpose HTTPS/CDP call so an expired broker startup budget cannot leave background work running.

- [ ] **Step 5: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/attestation.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 8**

```bash
set -euo pipefail
git add packages/cdp-broker/src/attestation.ts tests/cdp/attestation.test.ts
git commit -m "feat: attest exact Freeland staging candidate"
```

### Task 9: Install Browser-Wide Target and Request Guards Before Navigation

**Files:**

- Create: `packages/cdp-broker/src/browser-guard.ts`
- Create: `tests/cdp/browser-guard.test.ts`

**Interfaces:**

- **Consumes:** Task 4 `decideRequest`, Task 5 `CdpConnection` events, and one synchronous closed `GuardTelemetrySink` supplied before any target resumes.
- **Produces:** `BrowserGuard.install`, `assertHealthy`, `safeSummary`, `beginShutdown`, and `closeAfterBrowserExit`. It is the only component allowed to classify/continue/fail paused browser requests, route guarded telemetry, or close a denied paused target.

- [ ] **Step 1: Write failing guard-order and target-coverage tests**

Require this exact initial call order on the browser session:

```text
Target.setDiscoverTargets(discover=true)
Target.setAutoAttach(flatten=true, autoAttach=true, waitForDebuggerOnStart=true)
Fetch.enable(patterns=[{urlPattern:"*", requestStage:"Request"}], handleAuthRequests=true) on browser session
Browser.setDownloadBehavior(behavior=deny, eventsEnabled=true) on browser session
Target.getTargets
require zero page targets
Target.createTarget(url=about:blank)
await the matching Target.attachedToTarget(waitingForDebugger=true)
```

Task 7 launches with `--no-startup-window`, so `Target.getTargets` must contain zero `page` targets. Any pre-existing page is `guard_setup_failed`; close it while possible and stop without resuming. Only after browser-level auto-attach is armed does the guard create one `about:blank` page and bind the returned target ID to exactly one subsequent paused attach event. This order is mandatory because Chromium marks already-existing targets `waitingForDebugger:false` during auto-attach reconciliation, while a target created after auto-attach is armed can be required paused; pin the real behavior with the [Chromium browser auto-attacher source](https://chromium.googlesource.com/chromium/src/+/refs/tags/143.0.7475.6/content/browser/devtools/browser_devtools_agent_host.cc#111) and Task 15's production-Chrome regression.

For every `Target.attachedToTarget` event without exception, require `waitingForDebugger === true` and classify `targetInfo` before any domain is enabled and before any call that could resume JavaScript. `waitingForDebugger:false`, missing pause state, or contradictory duplicate attach metadata is an immediate fatal `guard_setup_failed`; close the target when possible, never enable/resume it, close admission, and stop the owned browser. The only approved targets are:

- the one daemon-owned bootstrap `page`, with no `openerId`, whose initial URL is exactly `about:blank`;
- an `iframe`, `worker`, `shared_worker`, or `service_worker` associated with that guarded page tree whose normalized URL is empty, `about:blank`, or allowed by Task 4's request policy.

Any second `page`, every `page` with an `openerId`, an unknown target type, an unassociated descendant, or a production/provider/unreviewed URL is denied. For a denied target, assert the browser-session call is exactly `Target.closeTarget({targetId})` while it is still paused. Never call `Runtime.runIfWaitingForDebugger` on its child session. Failure to close a denied paused target makes the guard unhealthy and requires the broker to begin shutdown and terminate the owned Chrome process immediately.

Only for an approved target, require:

```text
Target.setAutoAttach(flatten=true, autoAttach=true, waitForDebuggerOnStart=true) on child session
Runtime.enable on child session
Page.enable only for page/iframe
Emulation.setDeviceMetricsOverride(width=1280, height=960, deviceScaleFactor=1, mobile=false) only for the bootstrap page
Page.addScriptToEvaluateOnNewDocument(fixed bidirectional-transport lockdown) only for page/iframe
Runtime.evaluate(fixed bidirectional-transport lockdown) on current child context
Log.enable on child session
Network.enable on child session
Network.setBypassServiceWorker(bypass=true) on page/iframe session
Network.setCacheDisabled(cacheDisabled=true) on page/iframe session
Network.clearBrowserCookies on the bootstrap page session before its first resume
Runtime.runIfWaitingForDebugger on child session
```

The browser-session `Fetch.enable` is installed before target creation and is the single global request gate for pages and every worker type. Do not require child-session `Fetch.enable`: Chromium's dedicated-worker host lacks that handler, while the browser agent host installs one; Task 15 must prove the exact Chrome-150 browser-level gate observes a page request plus dedicated/shared/service-worker subrequests before any destination canary. Browser-level download denial is also installed before target creation; setup failure is fatal. Any `Browser.downloadWillBegin` or `Browser.downloadProgress` event is a policy breach, even if Chrome reports cancellation, and initiates shutdown without retaining URL/guid/path data. On `Fetch.authRequired`, provide credentials only when `source:'Proxy'`, scheme/realm/origin equal the branded Task 7 proxy capability, the request belongs to the one guarded browser, and its bounded challenge count is one; use `Fetch.continueWithAuth` with the in-memory username/password. Cancel every server challenge, mismatch, duplicate, or post-shutdown challenge and make mismatch fatal. Auth values are never logged, summarized, persisted, returned, or sent upstream. Unit and real-Chrome tests prove unauthenticated/wrong-token direct proxy access opens zero tunnel, while the guarded browser completes one authenticated CONNECT.

Recursive `Target.setAutoAttach` remains the first child-session command and is installed independently on every approved page, iframe, worker, shared worker, and service worker before that target resumes; browser-session auto-attach alone is not recursive. The fixed bootstrap page additionally receives the exact Task 4 scale-1 viewport override before resume; mismatch or failure is fatal. The fixed lockdown iterates only Task 4's exact versioned `globalTransportNames` and `navigatorTransportNames`, including `WebSocketStream`, replacing/freezing each with a throwing function before application code can execute. It proactively creates a non-configurable throwing slot when a reviewed name is absent and replaces/freezes it when present; an existing descriptor that cannot be made throwing/non-writable is a setup failure and the target is never resumed. Tests pin the complete reviewed Chrome-150 name list, while Task 15 requires exact `Browser.getVersion` equality and fails if its real-Chrome capability probe finds any additional transport entry point. This script is defense in depth behind Task 7's exact Direct Sockets feature denial, QUIC disablement, allow-one proxy jail, and WebRTC UDP restriction; WebTransport has no claimed Blink-switch layer. It is module-private, accepts no input, returns no page value, is installed for future page realms, and is applied directly to the already-paused current realm. If recursive auto-attach, viewport lockdown, transport lockdown, or any enable call—including `Log.enable`—returns an error, the target remains paused, the guard becomes unhealthy, and the run returns `POLICY_BLOCK`; tests cover each setup failure independently. `about:blank` is allowed only for the single daemon-owned bootstrap page and is never an agent navigation/request destination.

For each `Fetch.requestPaused`, derive only URL, method, resource type, body presence, and normalized header names for Task 4 `decideRequest`. Values are inspected only through bounded type/length checks and constant comparison against the closed canonical profile; they are never retained, returned, logged, hashed, or passed to policy. All three body fields absent is a valid bodyless request. `hasPostData:false` with both payload fields absent is also bodyless; `hasPostData:true`, presence of `postData`, or presence of `postDataEntries` is body-bearing, while wrong types or `hasPostData:false` combined with either payload field is contradictory and fatal. Never inspect body bytes. This covers CDP's permitted `hasPostData:true` with omitted deprecated `postData` without rejecting ordinary GETs whose optional metadata is absent.

Only a bodyless/header-safe `GET`/`HEAD` allow decision calls `Fetch.continueRequest`. It must replace—not merge or copy—the complete observed header array with an exact module-private profile selected only by the closed resource type and method: fixed canonical `Accept`, fixed `Accept-Language: en-US,en;q=0.9`, fixed `Accept-Encoding: identity`, fixed `Cache-Control: no-cache`, fixed `Pragma: no-cache`, explicit `Referer:''`, and highest-priority `Cookie:''`; `HEAD` uses its own fixed profile. No observed value is forwarded, including page-supplied `Accept`, referrer, `Range`, conditionals, or browser-looking `Sec-*` bytes. `Referer:''` is mandatory because Chromium stores referrer outside the ordinary header map and preserves it unless the DevTools override explicitly replaces it ([interceptor source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/devtools_url_loader_interceptor.cc#260)); `Accept-Encoding: identity` prevents the network stack from injecting an unreviewed compression profile when the field is absent ([URLRequest source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/url_request/url_request_http_job.cc)). The source profile is frozen, accepts no caller input, and the real-Chrome wire test pins the additional exact browser-owned `Host`, User-Agent, and `Sec-*` names/value classes Chrome may generate after the override; for the explicitly HTTP/1.1 TLS fixture only, it also permits exact `Connection: keep-alive` and requires wire `Accept-Encoding` to remain exactly `identity`; any other hop-by-hop or browser-added name/value is fatal. Require at most 64 incoming entries, 128 ASCII bytes per name, 4,096 UTF-8 bytes per value, and 16,384 aggregate bytes solely to bound parsing; cap/type failure is fatal before continuation and raw bytes are immediately dropped. Chrome 150 is pinned because Chromium's 2025 Fetch change applies the DevTools cookie override after its internal cookie store, immediately before send: [Chromium commit 04816f9](https://chromium.googlesource.com/chromium/src/+/04816f996b271b9e05f81da5de90f6056390aa2c). The guarded wire contract is zero page-controlled header bytes and zero cookie credential bytes (Cookie absent or empty) on every request, even after response `Set-Cookie`, `document.cookie`, or Cookie Store writes; any runtime-generated marker on the listener is fatal. All denied decisions call `Fetch.failRequest({errorReason:'BlockedByClient'})`. Independently of method, deny `OPTIONS`, `resourceType:'WebSocket'`, `CONNECT`, any `Upgrade`, `Range`, `If-*`, forwarding/proxy/method-override/custom/unknown header, and any WebSocket/WebSocketStream/WebTransport handshake marker before continuing. A denied passive header-safe `GET`/`HEAD` resource (for example an external font) is blocked and counted but is not itself fatal, so the reviewed route may render in a degraded state; a body, forbidden header, other method, write, transport, target-ownership, non-empty wire cookie, wire marker, or setup breach is fatal. Treat `Network.webSocketCreated`, `Network.webSocketWillSendHandshakeRequest`, `Network.webSocketFrameSent`, `Network.webTransportCreated`, `Network.directTCPSocketCreated`, `Network.directUDPSocketCreated`, or any equivalent future unknown bidirectional-transport event as a lockdown breach: mark unhealthy and immediately initiate owned-browser shutdown without persisting event params. Unit and real-Chrome fixtures include ordinary GET with all body metadata absent, body-bearing GET with `hasPostData:true` but omitted `postData`, contradictory metadata, a page that mints a unique cookie, and runtime-generated canaries in `Foo`, `Accept`, `Range`, every `If-*`, and a unique referrer/`Referrer-Policy` path marker. Negative controls reach only loopback canaries; guarded exact Chrome proves zero marker/referrer/header/cookie bytes at the listener and no non-empty Cookie in `Network.requestWillBeSentExtraInfo`, without persisting/logging values. Errors and summaries expose only `reasonCode`, origin role, path template, method class, target type, and a closed transport class.

The guard also enforces hard per-session resource budgets before continuing a request or resuming a target: at most 1,024 total `Fetch.requestPaused` events, 128 in any monotonic one-second window, ten redirect pauses for one private request ID, 128 total target attachments, and 32 simultaneously tracked targets. Maps never grow beyond those caps, counters saturate, and completed request/target IDs are discarded immediately. The first overflow calls the once-only fatal callback with `request_budget_exceeded`, fails every currently paused request/target, and causes proxy closure plus browser stop. Together with Task 7's encrypted-tunnel byte/open/rate caps, no allowed response stream or background fetch can consume unbounded daemon memory, staging bandwidth, or session work. Tests cover request floods, slow endless loopback responses, redirect loops, ID churn/reuse, target storms, exact-boundary success, and first-over-bound failure with zero continuation/resume after breach.

Complete the red test surface before implementation with these races and shutdown assertions:

- a page tries to create both a popup and a service worker between initial reconciliation and the first agent command; the popup is closed while paused and never resumed, while the service worker is resumed only after its URL and ownership pass policy;
- a three-level chain `page -> worker -> nested worker/service worker` emits attach events on different parent sessions; every approved child receives its own recursive `Target.setAutoAttach` before any resume, and failure at any depth leaves that subtree paused and shuts down;
- page, iframe, worker, shared-worker, and service-worker fixtures attempt WebSocket, WebTransport, WebRTC data-channel, Direct Sockets, `CONNECT`, and upgrade traffic; constructors/handshakes are denied before egress, zero frame/UDP/upgrade event is allowed, and any synthetic late network event makes the guard unhealthy;
- an allowed GET responds with `Content-Disposition: attachment`, and a second page attempts a fixed `<a download>` click; browser download denial is armed before either target, both paths create zero file outside the owned profile/artifact roots, and any synthetic/real download event is fatal without exposing its metadata;
- every target-type fixture is repeated with `waitingForDebugger:false`; zero setup/resume command is sent, the stable fatal callback fires once, and the owned browser stops. Task 15 repeats one real popup/worker false-pause injection through the production event router;
- repeated simultaneous policy-breach events, including repeated public `reportPolicyBreach('screenshot_thaw_unproven')` calls, invoke `onPolicyBreach` exactly once with a stable closed reason code and never expose event params;
- a popup fixture would emit a unique JavaScript marker immediately on execution; no marker event is observed during normal operation, after `beginShutdown`, or while owned Chrome is terminating;
- an allowed request redirects to production while reusing a request ID; the redirected `Fetch.requestPaused` is blocked;
- a denied popup arrives after `beginShutdown` and before Chrome exits; listeners and auto-attach remain armed, the popup is closed paused, and its JavaScript marker is never observed;
- `closeAfterBrowserExit` invokes its injected browser-exit assertion exactly once, rejects without local teardown when that assertion reports running/mismatch, and never calls `Target.setAutoAttach(autoAttach=false)`, `Target.detachFromTarget`, or any resume method.

- [ ] **Step 2: Run the guard test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/browser-guard.test.ts
```

Expected: FAIL because `BrowserGuard` is missing.

- [ ] **Step 3: Implement the guard state machine**

```ts
export type GuardFatalReason =
  | 'guard_setup_failed'
  | 'target_close_failed'
  | 'transport_lockdown_breach'
  | 'download_attempted'
  | 'request_budget_exceeded'
  | 'telemetry_event_budget_exceeded'
  | 'screenshot_thaw_unproven';

export interface GuardSummary {
  healthy: boolean;
  attachedTargets: number;
  allowedRequests: number;
  blockedRequests: number;
  firstBlockReason: string | null;
}

export type GuardConsoleEvent =
  | {
      kind: 'runtime-console';
      severity: 'error' | 'warning' | 'info';
      textParts: string[];
    }
  | {
      kind: 'log-entry';
      severity: 'error' | 'warning' | 'info';
      text: string;
    };

export interface GuardTelemetrySink {
  recordConsoleEvent(
    event: GuardConsoleEvent,
    sourceClass: 'first-party' | 'browser' | 'blocked',
    observedAtMonotonicMs: number,
  ): void;
  recordNetworkSample(
    input: {
      originRole: 'staging-app';
      pathTemplate: Exclude<CdpSafePathTemplate, 'blocked'>;
      method: 'GET' | 'HEAD';
      status: number;
      durationMs: number;
    },
    observedAtMonotonicMs: number,
  ): void;
  recordBlockedRequest(
    input: { pathTemplate: 'blocked'; methodClass: 'blocked'; reasonCode: string },
    observedAtMonotonicMs: number,
  ): void;
  stopIngestion(): void;
}

export class BrowserGuard {
  static async install(
    connection: CdpConnection,
    requestPolicy: PublicCdpPolicy,
    runtime: CdpChromeRuntime,
    proxyAuth: PrivateProxyAuth,
    telemetrySink: GuardTelemetrySink,
    options: {
      timeoutMs: number;
      signal: AbortSignal;
      assertBrowserExited(context: { timeoutMs: number; signal: AbortSignal }): Promise<void>;
      onPolicyBreach(reasonCode: GuardFatalReason): void;
    },
  ): Promise<BrowserGuard>;
  pageSessionId(): string;
  assertHealthy(): void;
  safeSummary(): GuardSummary;
  reportPolicyBreach(reasonCode: GuardFatalReason): void;
  async beginShutdown(options: { timeoutMs: number; signal: AbortSignal }): Promise<void>;
  async closeAfterBrowserExit(options: { timeoutMs: number; signal: AbortSignal }): Promise<void>;
}
```

Maintain private target/session maps, the complete recursive parent-session/target ownership graph, request/transport counters, a shutdown phase, two lifecycle callbacks (`assertBrowserExited` and once-only `onPolicyBreach(GuardFatalReason)`), and the one closed synchronous telemetry sink—never the process inspector, PID, profile, generic process API, or a raw event accessor. Validate/freeze the sink before subscribing and before any target resume. For reviewed `Runtime.consoleAPICalled`/`Log.entryAdded`, the guard first proves the emitting session belongs to its target graph and normalizes it into the exact `GuardConsoleEvent`: only primitive string console arguments become `textParts`, non-string remote objects become no fixed text, severity is closed, at most 32 parts are admitted, and each raw string is capped before forwarding. It assigns the closed source class and synchronously calls `recordConsoleEvent`; stack/URL/remote-object IDs never enter the DTO. The guard alone retains a bounded opaque request-correlation map keyed by CDP request ID, populated from its already-approved request decision with only origin role, policy-derived path template, method, and start time; response/finish/fail/redirect resolves it to one closed `recordNetworkSample` or blocked descriptor, then deletes it. ID reuse, missing start, inconsistent redirect, overflow, or shutdown residue is fatal; raw IDs/URLs/headers never enter the sink. For its own denied request decision it sends only fixed `pathTemplate:'blocked'`, method class, and stable reason to `recordBlockedRequest`. Unowned/unknown events are fatal and are never forwarded. `reportPolicyBreach` accepts only the closed union above, atomically marks the guard unhealthy, and synchronously invokes the same once-only breach callback; it cannot carry page data or arbitrary text. The broker binds that callback so its synchronous prefix closes command admission and its deferred suffix schedules the one idempotent owned-browser stop; an event listener never waits unbounded. Require install `timeoutMs` from 1 through 10,000 and pass its signal plus remaining time to every setup CDP call. Subscribe before the browser-session `Target.setAutoAttach`; on every approved child, install child-session auto-attach before any resume and reconcile attach events idempotently by `(parentSessionId, sessionId, targetId)`. Reconcile `Target.getTargets` with already queued attach events before deciding whether `Target.createTarget` is necessary. `pageSessionId()` succeeds only when exactly one guarded `about:blank` page exists.

`beginShutdown()` atomically marks the guard as closing, calls `telemetrySink.stopIngestion()` before any further event can be forwarded, uses only its bounded cleanup context to fail every already-paused `Fetch` request and close every denied paused target, and retains all CDP safety listeners plus `waitForDebuggerOnStart` auto-attach so a late popup cannot run. It does not detach, disable auto-attach, or resume any target. The broker then terminates owned Chrome while the guard and transport remain connected. `closeAfterBrowserExit()` computes the remaining cleanup time and passes its exact reduced `{timeoutMs, signal}` into the injected assertion; only a settled `stopped` result from Task 7 permits it to unsubscribe local listeners and clear maps. Telemetry listeners are removed and settled before Task 11 `clear()` zeroes its key. A timeout/running/mismatch assertion rejects without teardown, and cancellation must settle the underlying Task 7 inspector rather than leave a detached OS query. It sends no command that could release a paused target.

- [ ] **Step 4: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/browser-guard.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Commit Task 9**

```bash
set -euo pipefail
git add packages/cdp-broker/src/browser-guard.ts tests/cdp/browser-guard.test.ts
git commit -m "feat: guard every CDP browser target"
```

### Task 10: Project a Bounded Content-Free Semantic Snapshot

**Files:**

- Create: `packages/cdp-broker/src/capture-sanitizer.ts`
- Create: `packages/cdp-broker/src/semantic-snapshot.ts`
- Create: `tests/cdp/semantic-snapshot.test.ts`

**Interfaces:**

- **Consumes:** guarded page session, Task 3 snapshot contract, and route identity.
- **Produces:** `sanitizeCaptureText` for ephemeral classification/HMAC input only, `assertSafeObservation`, and `captureSemanticSnapshot`; no arbitrary page text is durable.

- [ ] **Step 1: Write failing sanitizer tests with runtime-generated sensitive markers**

Test email, URL, bearer/JWT-like, phone, long-digit, checkout/provider, VPN credential, Telegram-shaped, and benign-word/chunk-encoded markers. `sanitizeCaptureText` may normalize/redact only as an ephemeral precursor to a keyed digest or fixed class; tests must prove its returned arbitrary text is never assigned to a contract observation or artifact. Every sensitive marker becomes `[redacted]`, and an unsupported value type throws `CAPTURE_REDACTION_FAIL` without echoing the value.

Generate a Luhn-valid sequence and three-digit security code at runtime using arithmetic. Do not store either literal in the test source.

- [ ] **Step 2: Write failing AX projection tests**

Feed synthetic `Accessibility.getFullAXTree` nodes containing ignored nodes, names, values, descriptions, URLs, backend IDs, benign-looking secret chunks, and properties. Require output to contain only:

- successive decimal ordinal IDs beginning at `n1`;
- whitelisted roles `banner`, `navigation`, `main`, `contentinfo`, `heading`, `link`, `button`, `textbox`, `checkbox`, `radio`, `tab`, `menuitem`, `option`, `switch`, `dialog`, `status`, and `alert`;
- fixed `label:'none'|'present'` derived only from whether AX name is empty after type/length validation—never the name bytes, a substring, an unkeyed hash, or a page-controlled class;
- states `disabled`, `focused`, `focusable`, `selected`, `expanded`, `checked`, `required`, `readonly`, and heading `level`.

Require fixed `title:'public-page'`; map document language only to the closed `und|en|ru` literals and use `und` for anything else. Require omission of AX/document title bytes, name bytes, `value`, description, URL, raw node/backend IDs, hidden/ignored text, and unknown properties. Reject any raw name/title/lang field longer than 4,096 UTF-16 code units before classification, enforce 500 nodes, canonical compact body at most 65,535 bytes so its required newline remains within the shared 65,536-byte file cap, and deterministic `truncated:true` behavior.

In the same pre-implementation tests, serialize the projected observation, every expected thrown error, and the captured test logger output. Assert none contains any runtime-generated marker, full URL, raw node ID, input value, or the substrings `localStorage`, `sessionStorage`, `cookie`, `authorization`, `requestBody`, or `responseBody`.

- [ ] **Step 3: Run snapshot tests and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/semantic-snapshot.test.ts
```

Expected: FAIL with missing sanitizer/snapshot modules.

- [ ] **Step 4: Implement sanitizer and snapshot projection**

Export:

```ts
export function sanitizeCaptureText(value: string, maxCharacters = 200): string;
export function assertSafeObservation(value: unknown): void;

export async function captureSemanticSnapshot(
  connection: CdpConnection,
  pageSessionId: string,
  routeId: string,
  context: { timeoutMs: number; signal: AbortSignal },
): Promise<Extract<CdpObservation, { kind: 'snapshot' }>>;
```

Call `Accessibility.getFullAXTree` plus one fixed non-exported metadata expression returning only the normalized `<html lang>` enum, passing the reduced timeout and linked signal to both CDP operations. The expression maps language to `und|en|ru` before returning; document title bytes never cross CDP. For each AX node, validate the raw name type/length in memory, convert it immediately to `none|present`, and discard the raw bytes before constructing a node. Project in source order, discard ignored/unapproved roles, set the observation title to fixed `public-page`, then recompute the self-referential `bytes` field to a stable fixed point while dropping trailing nodes and setting `truncated:true` until canonical JSON body length is at most `CDP_JSON_ARTIFACT_FILE_MAX_BYTES - 1` (65,535). `bytes` equals that final compact body length; Task 6's one newline makes the complete file at most 65,536. `assertSafeObservation` rejects any snapshot title/language/label outside the closed literals. Abort discards the raw in-memory tree and returns no partial observation or artifact. Tests cover exact 65,535/65,536 body boundaries, include a compromised page that places runtime markers and benign chunks in AX text, and prove no raw substring or direct/unkeyed text digest reaches JSON, logs, errors, or artifacts. Separate empty/nonempty, role, state, count, and order fixtures document and bound the structural covert channel accepted by Global Constraint 25 rather than falsely claiming non-interference.

- [ ] **Step 5: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/semantic-snapshot.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 10**

```bash
set -euo pipefail
git add packages/cdp-broker/src/capture-sanitizer.ts \
  packages/cdp-broker/src/semantic-snapshot.ts tests/cdp/semantic-snapshot.test.ts
git commit -m "feat: add sanitized semantic CDP snapshots"
```

### Task 11: Summarize Console and Network Activity Without Raw Payloads

**Files:**

- Create: `packages/cdp-broker/src/telemetry-summary.ts`
- Create: `tests/cdp/telemetry-summary.test.ts`

**Interfaces:**

- **Consumes:** Task 4 request decisions, Task 9 guarded CDP events, and Task 10 sanitizer.
- **Produces:** a `TelemetryCollector` that structurally implements Task 9 `GuardTelemetrySink`, plus `consoleObservation`, `networkObservation`, and `clear`; no raw event accessor exists.

- [ ] **Step 1: Write failing console summary tests**

Feed `Runtime.consoleAPICalled` and `Log.entryAdded` events containing safe text plus runtime-generated email/token/URL/phone markers. Require output entries with only:

```ts
{
  severity: 'error' | 'warning' | 'info';
  fingerprint: string; // 64 lowercase hex
  count: number;
  firstMs: number;
  lastMs: number;
  sourceClass: 'first-party' | 'browser' | 'blocked';
}
```

The fingerprint is HMAC-SHA-256 over `severity + '\n' + sourceClass + '\n' + sanitized normalized message class`, keyed by a fresh 32-byte collector/session key that is never persisted, logged, returned, or shared with the agent. Equivalent repeated events aggregate only within that session; timestamps are non-negative milliseconds relative to collector start. Raw arguments, stack traces, source URLs, line numbers, exception objects, and the HMAC key never appear.

- [ ] **Step 2: Write failing network summary tests**

Feed request/response/blocked events and require:

- accepted paths use only Task 4's policy-derived exact literal or one of `/assets/:asset`, `/locales/:asset`, `/icons/:asset`;
- denied/unknown paths use only the fixed literal `blocked` and stable denial class, with no URL parsing output;
- query, fragment, and every unmatched suffix byte are absent rather than normalized into evidence;
- allowed method/status/duration buckets only;
- origin role from Task 4 policy only;
- unknown/denied requests represented as `originRole:'blocked'`, method/status `BLOCKED`/`blocked`;
- maximum 500 stored aggregate keys per console map and per network map—not merely 500 serialized entries—with deterministic truncation;
- no request ID, headers, body, full URL, redirect URL, initiator, or provider string in output.

In the same pre-implementation tests, serialize both observations and every expected thrown error. Assert the result excludes all runtime-generated markers and the case-insensitive words `authorization`, `cookie`, `requestbody`, `responsebody`, `stacktrace`, and `websocketdebuggerurl`.

- [ ] **Step 3: Run the telemetry test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/telemetry-summary.test.ts
```

Expected: FAIL because `TelemetryCollector` is missing.

- [ ] **Step 4: Implement an in-memory raw-event sink with safe-only getters**

```ts
export class TelemetryCollector {
  constructor(
    policy: PublicCdpPolicy,
    startedAtMonotonicMs: number,
    fingerprintKey: Uint8Array,
    onBudgetExceeded: (reasonCode: 'telemetry_event_budget_exceeded') => void,
  );
  beginRouteEpoch(routeId: string, observedAtMonotonicMs: number): void;
  recordConsoleEvent(
    event: GuardConsoleEvent,
    sourceClass: 'first-party' | 'browser' | 'blocked',
    observedAtMonotonicMs: number,
  ): void;
  recordNetworkSample(
    input: {
      originRole: 'staging-app';
      pathTemplate: Exclude<CdpSafePathTemplate, 'blocked'>;
      method: 'GET' | 'HEAD';
      status: number;
      durationMs: number;
    },
    observedAtMonotonicMs: number,
  ): void;
  recordBlockedRequest(
    input: { pathTemplate: 'blocked'; methodClass: 'blocked'; reasonCode: string },
    observedAtMonotonicMs: number,
  ): void;
  stopIngestion(): void;
  consoleObservation(routeId: string): Extract<CdpObservation, { kind: 'console' }>;
  networkObservation(routeId: string): Extract<CdpObservation, { kind: 'network' }>;
  clear(): void;
}
```

Require `fingerprintKey` to be exactly 32 bytes, copy it into private mutable storage, use it only through `createHmac('sha256', key)`, and zero that storage during `clear`; constructor/callback/errors expose no key bytes. Sanitize and aggregate synchronously inside `recordConsoleEvent`; accept only the closed `GuardConsoleEvent` plus Task 9's already-classified source, and do not retain the DTO, console part, stack, URL, suffix, or CDP request ID after the call returns. `recordNetworkSample` accepts only Task 9's already-correlated closed metadata, revalidates policy-derived templates/status/duration, and has no request ID/URL input; `recordBlockedRequest` accepts only the fixed blocked descriptor. Thus correlation lives once in Task 9's capped ownership-aware map and telemetry cannot duplicate/reclassify it. `stopIngestion()` is synchronous/idempotent, rejects further mutation in constant time, and is called by guard shutdown before listener removal; only after listeners settle may `clear()` erase maps and zero the key. `beginRouteEpoch(routeId)` is called immediately before every startup/navigate/back/reload navigation, validates the reviewed route ID, clears per-route maps/truncation/timestamps, and freezes that route as the current epoch. Getters require the exact same route ID; a mismatch is fatal and produces no artifact. Route transitions never reset lifetime event totals, rolling-rate safety counters, or session budgets, so navigation cannot evade caps. Tests inject equal/different events across `landing → terms → back/reload` and prove no cross-route carryover, correct relative timestamps, post-attestation equality, and no safety-budget reset. Adversarial tests encode a runtime marker across benign console/path chunks and prove observations, artifacts, errors, and logs contain neither the chunks nor a direct unkeyed content digest; the same console input under two keys yields different fingerprints. Count/timing/status classes remain the explicitly bounded page-influenced channel in Global Constraint 25.

Before regex, normalization, or hashing, reject a telemetry event whose reviewed string field exceeds 4,096 UTF-16 code units, URL exceeds 8,192, console argument count exceeds 32, or reviewed nested array/object shape exceeds its fixed field/count caps; do not stringify an unknown/raw event to measure it. The first oversize/shape violation is `telemetry_event_budget_exceeded`, invokes the callback, and retains no field. Tests send repeated near-32-MiB console/Log payloads through the Task 5 router and prove the first is dropped/fatal before sanitizer/hash work, with bounded memory-facing state.

Each aggregate map has a hard 500-key insertion cap. Repeated known keys increment a saturating safe-integer count; a new key after the cap is dropped and sets the relevant observation's immutable `truncated:true`. Each getter sorts by its specified deterministic key, then drops tail aggregates and sets `truncated:true` until the canonical compact JSON body is at most 65,535 bytes; Task 6's newline keeps the file within `CDP_JSON_ARTIFACT_FILE_MAX_BYTES`. Exact-boundary tests cover a 65,535-byte body, the first over-bound entry, and verifier agreement. Independently cap the collector at 10,000 accepted raw events and 2,000 events in any monotonic one-second window. The first total/rate excess atomically stops ingestion and invokes the closed callback once; the broker binds it directly to its startup-safe terminal latch, closes admission/egress when those resources exist, and converges on the same owned stop without requiring a constructed guard. Subsequent events are constant-time no-ops. Flood tests feed at least 100,000 unique console/network events, require both map sizes never exceed 500, counters never wrap, one callback, bounded timer state, and no retained marker. `clear` zeroes all route and lifetime maps/counters only during final broker teardown.

- [ ] **Step 5: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/telemetry-summary.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 11**

```bash
set -euo pipefail
git add packages/cdp-broker/src/telemetry-summary.ts tests/cdp/telemetry-summary.test.ts
git commit -m "feat: add sanitized CDP telemetry summaries"
```

### Task 12: Enforce Safe Public Screenshot Capture

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `packages/cdp-broker/src/screenshot.ts`
- Create: `tests/cdp/screenshot.test.ts`

**Interfaces:**

- **Consumes:** Task 4 route capture policy, Task 5 CDP connection, Task 6 private PNG writer, Task 8 candidate identity, and Task 10 sanitizer.
- **Produces:** only `captureSafeScreenshot`; freeze leases, raw DOM snapshots, decoded pixels, and safety probes remain module-private.

- [ ] **Step 1: Write failing deterministic-masking and safety-probe tests**

The capture path uses no `Runtime.evaluate`. It must first disable application script, stop animations, freeze the page lifecycle, and set a fixed opaque default background. It then installs one module-private stylesheet whose bytes are constant. The stylesheet normalizes `html`/`body` to the exact 1280×960 scale-1 viewport, removes margins/scrollbars, hides every document descendant, descendant pseudo-element, backdrop, form/native/replaced element, raster/vector/canvas/media/embed, and their paint with `visibility:hidden!important` plus `opacity:0!important`, and clears background/border/list/mask images, background/border/outline colors, shadows, filters, clips, blend modes, transforms, appearance, accent color, animation, and transition. A final `html::before` rule paints one fixed `rgb(241,243,245)` opaque, pointer-free, fixed-position cover over the complete viewport at the maximum reviewed z-index. It is created only in the attested main frame through `CSS.createStyleSheet` and `CSS.setStyleSheetText`; no selector, color, dimensions, or text is caller supplied.

While script, animation, and lifecycle remain frozen and the cover remains installed, inspect two consecutive fixed-shape `DOMSnapshot.captureSnapshot` results, the frame tree, fixed authenticated-marker queries, and layout metrics. Raw snapshots exist only in local variables and are discarded before return. The snapshot requests the fixed computed-style set needed to prove every descendant is hidden and all paint channels are normalized: `color`, `-webkit-text-fill-color`, `text-shadow`, `caret-color`, `content`, `background-color`, `background-image`, `border-color`, `border-image-source`, `outline-color`, `box-shadow`, `filter`, `backdrop-filter`, `clip-path`, `mask-image`, `-webkit-mask-image`, `list-style-image`, `appearance`, `accent-color`, `mix-blend-mode`, `visibility`, `opacity`, `display`, `animation-name`, and `transition-property`. The closed post-mask aggregate is:

```ts
interface ScreenshotSafetyProbe {
  authenticatedMarkers: number;
  nonMainFrames: number;
  shadowRoots: number;
  unmaskedTextNodes: number;
  unmaskedFormValues: number;
  unmaskedPaintSurfaces: number;
  unstableSnapshots: number;
}
```

Tests require capture denial when:

- route classification is not `public-safe` or it lacks `screenshot-safe`, including `welcome`;
- any probe count is non-zero;
- location origin/path no longer matches the route;
- guard or candidate attestation is unhealthy;
- layout width/height exceeds 4096;
- decoded PNG exceeds 5 MiB;
- output is not a completely valid bounded PNG;
- artifact basename/path is not generated by Task 6.

The fixed inspection counts any non-main frame and any shadow root as unsafe because the main-frame author stylesheet cannot prove their descendant paint. It checks the two exact authenticated-marker selectors from Task 4 before capture and requires their count to remain zero. Every descendant, including form/native/replaced elements, must prove hidden/non-painting; every image/mask/filter/shadow/clip/appearance channel must equal the fixed cleared value, and the root cover/default background must equal the fixed opaque color. The implementation selector constants deep-equal `route.authenticatedMarkerSelectors`; no caller input is interpolated into a query. Text, field values, attributes, URLs, frame data, image data, and snapshot payloads are never sanitized into evidence: only the aggregate counts survive inspection. Two covered frozen snapshots, two visual-viewport metrics reads, route location, and candidate identity must remain byte-for-byte stable before capture, and both metrics must equal exactly 1280×960 at scale 1.

Also add all regressions before the first red run: an authenticated marker, non-main frame, shadow root, descendant that is not hidden, colored-div grid, native checkbox/radio/select/progress/meter, pseudo/backdrop, background/border/outline/shadow/filter/mask/clip/accent/native-appearance canary, raster/canvas/QR/SVG/media/embed, wrong viewport/scale, failed cover/default-background rule, or unequal frozen snapshots produces typed `POLICY_BLOCK`, zero durable PNG/partial artifact, and zero retained bytes. Correctly covered fixtures may reach in-memory capture only when every decoded RGBA pixel—including alpha—is exactly `[241,243,245,255]`; one differing pixel denies and zeroes buffers before any write. A delayed magenta `<canvas>` and a delayed top-layer/native-form canary queued at the old probe→capture race point remain underneath the fixed cover; the production-path real-Chrome regression in Task 15 requires exact all-pixel equality. Task 13 separately asserts that the broker maps every rejection to a schema-valid `CdpRunResult`.

- [ ] **Step 2: Write failing successful-capture tests**

For a safe `landing` fixture, require exact CDP calls:

```text
Emulation.setScriptExecutionDisabled(value=true)
Animation.enable
Animation.setPlaybackRate(playbackRate=0)
Page.setWebLifecycleState(state=frozen)
Emulation.setDefaultBackgroundColorOverride(color={r:241,g:243,b:245,a:1})
DOM.enable
DOM.getDocument
Page.getFrameTree
CSS.enable
CSS.createStyleSheet(frameId=attested main frame)
CSS.setStyleSheetText(fixed opaque-cover stylesheet)
DOMSnapshot.captureSnapshot(fixed fields/computed styles)
fixed DOM.querySelectorAll authenticated-marker checks
Page.getLayoutMetrics; require visual viewport 1280x960 and scale 1
repeat DOMSnapshot.captureSnapshot and Page.getLayoutMetrics; require equality
Page.captureScreenshot(format=png, fromSurface=true, captureBeyondViewport=false)
CSS.setStyleSheetText(text="") while still frozen
Emulation.setDefaultBackgroundColorOverride() while still frozen
Page.setWebLifecycleState(state=active)
Animation.setPlaybackRate(playbackRate=1)
Emulation.setScriptExecutionDisabled(value=false)
fresh candidate/location attestation
private artifact write
```

Require the Task 6 allocator to supply private write basename `public-landing-0001.png` and an observation containing only digest, exact width `1280`, exact height `960`, byte count, and basename. The PNG stays in memory until full PNG validation, exact `[241,243,245,255]` equality for all 1,228,800 decoded pixels, successful cover removal/background reset/thaw, and fresh Task 8 staging attestation. Run the same fixture twice in separate sessions and require identical decoded-RGBA SHA-256; encoded PNG bytes need not be stable. Abort at every call and require bounded cleanup, no partial write, no retained raw snapshot/pixel reference, and `guard.reportPolicyBreach('screenshot_thaw_unproven')` if cover removal, background reset, or any thaw step cannot be proven. Repeated cleanup failures still trigger the broker breach callback and its idempotent stop exactly once.

- [ ] **Step 3: Run the screenshot test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/screenshot.test.ts
```

Expected: FAIL because `screenshot.ts` is missing.

- [ ] **Step 4: Pin the PNG decoder after the complete red result**

```bash
set -euo pipefail
npm install --save-exact pngjs@7.0.0
npm install --save-dev --save-exact @types/pngjs@6.0.5
git diff -- package.json package-lock.json
```

Expected: only exact `pngjs` and `@types/pngjs` additions plus lockfile integrity changes. Do not run a broad dependency update.

- [ ] **Step 5: Implement pre-capture checks and bounded write**

```ts
export async function captureSafeScreenshot(input: {
  connection: CdpConnection;
  pageSessionId: string;
  route: RouteRule;
  runtime: CdpChromeRuntime;
  guard: BrowserGuard;
  candidate: CandidateIdentity;
  artifacts: SessionArtifacts;
  context: { timeoutMs: number; signal: AbortSignal };
}): Promise<Extract<CdpObservation, { kind: 'screenshot' }>>;
```

Implement the cover/freeze/inspect/capture/uncover/thaw sequence above with one `try/finally`, a linked signal, and the caller's decreasing timeout. Import and call Task 8's fixed `attestCandidateAfterNavigation` directly after successful thaw; there is no caller-selectable attestor or bypass. Never persist before successful thaw and fresh attestation. Decode base64 strictly and pre-scan the bounded chunk stream before calling any decoder: validate PNG signature, chunk lengths/count/order, CRCs, exactly one IHDR, exact 1280×960 dimensions equal to the frozen viewport, supported bit depth/color/interlace, computed decoded/inflated-byte upper bound, IEND, no trailing bytes, and no `tEXt`, `zTXt`, `iTXt`, `eXIf`, or unknown metadata-bearing chunk. Any hostile IHDR/size/decompression-bomb condition therefore fails before `PNG.sync.read` can allocate from attacker-controlled dimensions. Only then use pinned `PNG.sync.read(bytes, {checkCRC:true})` to decode every scanline into the already-proven bounded pixel buffer and recheck dimensions/layout. Scan the complete RGBA buffer and require every pixel exactly `[241,243,245,255]`; a single mismatch is `CAPTURE_REDACTION_FAIL` and never reaches the writer. Enforce the general 4096×4096, decoded-pixel, inflate, and 5 MiB encoded bounds before Task 6's atomic writer. Unit tests include truncation, CRC corruption, duplicate/malformed chunks, hostile IHDR/decompression bombs rejected before decoder invocation, dimension/scale mismatch, trailing bytes, forbidden metadata, and one-pixel canaries behind every CSS/native/raster surface class. On any failure, write nothing and zero/drop raw buffers/snapshot/pixel references. The `finally` block first clears the exact created stylesheet and default background override while still frozen, then restores lifecycle, animation, and script execution under a separate internal 5,000 ms cleanup deadline not cancelled by the caller; it never resumes command admission or permits an artifact write. A failed or unproven cleanup calls `guard.reportPolicyBreach('screenshot_thaw_unproven')`, making the guard unhealthy and scheduling owned-browser shutdown. The active broker command unwinds without waiting on itself; Task 13 awaits the shared stop promise before returning the typed failure. Return only a typed `POLICY_BLOCK` or `CAPTURE_REDACTION_FAIL` with a stable reason code, without raw bytes.

- [ ] **Step 6: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/screenshot.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 7: Commit Task 12**

```bash
set -euo pipefail
git add package.json package-lock.json packages/cdp-broker/src/screenshot.ts tests/cdp/screenshot.test.ts
git commit -m "feat: gate public CDP screenshots"
```

### Task 13: Compose Typed Browser Commands in the Broker

**Files:**

- Create: `packages/cdp-broker/src/broker.ts`
- Create: `tests/cdp/broker.test.ts`

**Interfaces:**

- **Consumes:** Tasks 3–12.
- **Produces:** `generateSessionAlias`, `FreelandCdpBroker.start`, `execute`, and `stop`, returning schema-valid `CdpRunResult` for every command.

Startup uses one monotonic outer deadline supplied by the daemon. The fixed outer budget is 90,000 ms, which exceeds the complete 80,000 ms sum of stage caps: trusted local identity/artifact recovery 5,000; policy/environment loading 5,000; HTTPS preflight 5,000; Chrome launch 15,000; CDP connect plus guard 10,000; pre-navigation attestation 5,000; landing navigation plus document-ready 15,000; post-navigation attestation 15,000; final persistence 5,000. Before every stage, the broker computes `remaining = deadline - monotonicMs()`, fails immediately if non-positive, and passes `min(stageCap, remaining)` plus a linked abort signal to every recovery, filesystem, HTTPS, Chrome, CDP, navigation, and attestation call. No stage may start or continue outside the shared remaining budget. Ownership-safe reconciliation is the first bounded stage after local daemon/root identity and runs before policy/environment errors or any external staging request, so an outage cannot indefinitely retain a provably dead session's raw profile.

After activation, the broker is strictly single-flight. Every non-stop command has one 30,000 ms monotonic outer deadline; a `wait` predicate's caller value remains capped at 15,000 ms inside that budget. Every pre-attestation, CDP request, poll sleep, semantic capture, screenshot freeze/capture/thaw, artifact write, and post-attestation receives the linked signal and `min(internalCap, remaining)`. A second non-stop command is rejected immediately as `HARNESS_FAIL/command_in_progress` without queuing or retry. Client disconnect aborts its command and waits for complete unwind. If abort/timeout occurs after any CDP command was sent, browser state is treated as unknown: command admission closes and the idempotent owned-browser stop runs before a result is finalized. `stop` and daemon shutdown likewise atomically reject new work, abort the active command, await its bounded unwind, then run the ownership-safe shutdown sequence exactly once; they never race teardown against an in-flight operation.

The daemon also owns non-extendable active-session budgets: absolute browser lifetime 15 monotonic minutes from Chrome spawn, idle lifetime 2 monotonic minutes from the last completed command, and at most 64 accepted non-stop commands. Starting a command does not extend the absolute deadline; only a successfully settled command resets the idle deadline, never beyond the absolute deadline. One unref'd bounded timer is re-armed from immutable deadlines. Absolute/idle/count expiry synchronously closes admission, aborts active work, quiesces egress, and schedules the same 35-second stop with stable `session_budget_exceeded`; `stop` remains accepted. Fake-clock tests prove exact-boundary behavior, no timer accumulation, no extension by rejected/concurrent commands, and zero Chrome/proxy/socket survivor after idle/absolute expiry.

- [ ] **Step 1: Write failing startup-order integration tests with fakes**

Require startup order:

```text
attest exact daemon PID/start token
derive and validate the fixed artifact root from the trusted repository root
reconcile expired crashed sessions by exact process tokens
reconcile expired hidden creation leases by exact daemon process token
cleanup now-stopped expired owned sessions under the fixed artifact root
validate I0 entry gate
load policy and public environment
perform fixed daemon-side candidate preflight
derive the private control path without creating it
atomically publish private session artifacts with bootstrap starting manifest, null Chrome ownership, and no CDP endpoint
create the exact private control directory
start owned Chrome with `--no-startup-window` and abort signal; require zero page targets
atomically replace the starting manifest from the onSpawned ownership callback
connect private browser CDP transport
install browser-wide guard
combine preflight with Browser.getVersion and attest candidate before app navigation
record the candidate in the private manifest/index
navigate guarded page to routeId=landing
wait for document-ready
attest page location/environment against the same candidate
persist active manifest and safe artifact index
return start result
```

For every bounded nonterminal/unreleased manifest on each startup—without waiting for policy loading, candidate preflight, or artifact expiry—use its available persisted daemon/watchdog/Chrome PID, start token, and executable with the observation-only Task 7 inspector. Require daemon absence; require watchdog absence when its pair was durably recorded; require Chrome absence when its pair was recorded; and for every phase require `findProfileUsers(exactProfile) === 'none'` so unacknowledged Chrome and surviving renderer/GPU/helper descendants are both covered. No recovery path reconstructs or requires Chrome argv; the ephemeral proxy port remains unpersisted. Only all applicable proofs authorize the digest-bound Task 6 profile release and `profileReleased:true,state:'stopped'`; a live exact process is retained, while any profile/process present/mismatch/uncertainty may transition only to `quarantined`, never stopped. Then run seven-day stopped-only artifact cleanup. Assert malformed/unknown/changed/quarantined entries remain untouched and a watchdog-cleaned daemon-crash fixture loses its raw profile immediately on the next startup even when subsequent policy loading or staging preflight fails; sanitized artifacts remain until expiry. Test crashes before watchdog authorization, after Chrome spawn/before acknowledgement, and at every later phase, including a helper-only matching profile user that forbids deletion. Test the exact stage caps and prove a valid synthetic startup consuming the full 80-second cap total still completes inside the 90-second outer budget. At every startup boundary—including reconciliation, profile release, expired cleanup, policy load, preflight, artifact/control creation, bootstrap/watchdog/active manifest publication, and candidate-index publication—advance the monotonic fake beyond the remaining deadline or abort it and require the Task 6 operation to settle/cancel before reverse unwind. Assert no later stage or late manifest/index rename starts, no timed-out asynchronous operation remains pending, and the `start` result contains session alias and candidate but none of the private manifest fields. A failure at any stage unwinds in reverse order, never resumes an unguarded target, and removes only resources proven owned under a separate bounded cleanup context.

- [ ] **Step 2: Write failing command and state-machine tests**

Use states `starting`, `active`, `stopping`, `stopped`, and `quarantined`. Require:

- every command input passes Task 3 validation before dispatch;
- two simultaneous non-stop commands never overlap: the first alone reaches an adapter and the second returns `HARNESS_FAIL/command_in_progress` with zero queue/retry;
- every active command derives a 30,000 ms monotonic deadline, propagates the exact decreasing remainder plus linked signal through every async seam, and leaves no pending timer/I/O/artifact write after timeout or caller disconnect;
- timeout/disconnect after a CDP send never returns the session to `active`; it schedules the single stop, proves Chrome exit, and rejects all subsequent work;
- unexpected watchdog, CDP-pipe, or egress-proxy closure atomically closes command admission and converges on the same broker-owned phased stop promise; watcher-specific Task 7 termination chooses live-watchdog signalling or the no-signal pipe-disconnect fallback. The daemon-crash fixture proves proxy/tunnels disappear by descriptor ownership and the watchdog proves Chrome absence without any later CLI recovery trigger;
- accepted `stop`, `SIGTERM`, and `SIGINT` close command admission, abort one in-flight command, await its bounded unwind, and only then begin guard/Chrome teardown; concurrent stop requests share one immutable result;
- after successful startup, `execute(start)` returns the immutable cached schema-valid start result exactly once to the daemon control path and performs no second startup/navigation;
- every non-stop active command runs guard health check, a fresh daemon preflight/browser-version check, and a fixed page/location attestation before dispatch;
- every `wait`, snapshot, console, and network command runs a second fixed Task 8 candidate/location attestation after the predicate/observation is complete and before artifact write or result finalization; both attestations must equal the command's immutable candidate/route tuple. Path/query/hash drift at any async boundary returns `STALE_CANDIDATE`/`POLICY_BLOCK`, writes nothing, and stops on unknown browser state. Screenshot keeps its stricter Task 12 post-thaw attestation-before-write path. Tests inject `pushState`/`replaceState` drift before capture, during each CDP await, after capture, and immediately before the post-check;
- startup landing, `navigate`, `back`, and `reload` call `telemetry.beginRouteEpoch(exactRouteId)` immediately before the guarded navigation; route changes never reset lifetime/rate counters. `navigate` resolves route ID, calls `Page.navigate` with the policy-built exact URL, waits for document ready, verifies final normalized path, and post-attests;
- `back` reads `Page.getNavigationHistory`, passes the previous entry's complete URL through Task 4's navigation policy (exact staging origin/reviewed path, no credentials/query/hash), maps that exact result to a route ID, then calls `Page.navigateToHistoryEntry`; a same-path query/hash entry is denied before navigation;
- `reload` calls `Page.reload` only on the current approved route;
- `wait(document-ready)` uses a fixed internal ready-state expression;
- `wait(heading-present)` polls the semantic projection until at least one heading exists;
- wait timeout is from 100 through 15,000 ms and never silently retries a command;
- snapshot/console/network/screenshot delegate only to typed modules; each successful observation is validated by both Task 3 validator paths before return;
- successful snapshot, console, and network observations are written through Task 6 `writePrivateJson`; successful screenshot capture is already written through `writePrivatePng`; every returned artifact record must appear exactly once in the schema-valid index with matching size/digest;
- typed screenshot rejection maps to a failure result and writes no artifact or partial index record;
- `screenshot_thaw_unproven` synchronously closes admission through `guard.reportPolicyBreach`, lets the active capture unwind, then awaits the shared idempotent stop; the failed command result is not finalized until exact owned-Chrome absence, guard teardown, transport close, and stopped/quarantined manifest publication complete, and repeated breach/stop signals still execute that sequence once;
- stop pre-attests when possible and records stale candidate diagnostically; it then calls `guard.beginShutdown()`, terminates and ownership-verifies owned Chrome while guard listeners/auto-attach and the CDP transport remain active, calls `guard.closeAfterBrowserExit()` only after process exit, closes transport, clears raw telemetry, validates/removes the owned profile, atomically records `profileReleased:true` and only then manifest state `stopped`, and retains the private sanitized session artifacts until the seven-day expiry;
- stopped/quarantined sessions reject every command except idempotent stop/status;
- output is validated before return; invalid output becomes `HARNESS_FAIL`.

Before the first red run, execute every command variant against fakes and add exact integration assertions that:

- the request guard continued only bodyless/header-safe `GET` or `HEAD`; body-bearing reads, `OPTIONS`, method-override headers, authorization/cookie/content headers, and custom `x-*` headers were denied;
- zero call used a write method;
- zero WebSocket/WebTransport/WebRTC/Direct Socket constructor, handshake, frame, session, or datagram escaped the pre-resume lockdown;
- zero call referenced a Nuanu/Plane endpoint;
- zero command result contained a private manifest field;
- three successful JSON observation commands and one screenshot command produced exactly four indexed, digest-matching safe artifacts, while blocked captures produced none;
- zero retry occurred after a blocked, stale, or failure result;
- a popup attached after `guard.beginShutdown()` is closed while paused, its JavaScript marker never executes, Chrome exits before guard teardown, and transport closes last.
- the production guard exit assertion is bound to the exact `OwnedChrome`; a different Chrome identity or `inspectOwnedChrome` result other than `stopped` cannot authorize teardown.

- [ ] **Step 3: Run the broker test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/broker.test.ts
```

Expected: FAIL because `FreelandCdpBroker` is missing.

- [ ] **Step 4: Implement the broker with no generic escape hatch**

```ts
export interface StartupStageContext {
  signal: AbortSignal;
  timeoutMs: number;
}

export interface CommandContext {
  signal: AbortSignal;
  deadlineMonotonicMs: number;
  timeoutMs: number;
}

export interface BrokerAdapters {
  now(): Date;
  monotonicMs(): number;
  randomBytes(size: 32): Uint8Array;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  reconcileExpired(
    artifactRoot: string,
    now: Date,
    context: StartupStageContext,
  ): Promise<{ stopped: number; quarantined: number; retained: number }>;
  validateEntryGate(root: string, context: StartupStageContext): Promise<void>;
  loadPolicy(root: string): PublicCdpPolicy;
  loadEnvironment(
    env: Readonly<Record<string, string | undefined>>,
    policy: PublicCdpPolicy,
    root: string,
    context: StartupStageContext,
  ): Promise<PublicCdpEnvironment>;
  cleanupExpired(
    artifactRoot: string,
    now: Date,
    context: StartupStageContext,
  ): Promise<unknown>;
  createArtifacts(
    artifactRoot: string,
    session: string,
    daemonIdentity: { pid: number; startToken: string },
    control: SessionControl,
    now: Date,
    context: StartupStageContext,
  ): Promise<SessionArtifacts>;
  createControl(
    control: SessionControl,
    context: StartupStageContext,
  ): Promise<SessionControl>;
  startChrome(
    environment: PublicCdpEnvironment,
    hooks: ChromeStartHooks,
  ): Promise<OwnedChrome>;
  connectChrome(chrome: OwnedChrome, context: StartupStageContext): Promise<CdpConnection>;
  installGuard(
    connection: CdpConnection,
    policy: PublicCdpPolicy,
    chrome: OwnedChrome,
    telemetry: TelemetryCollector,
    context: StartupStageContext,
  ): Promise<BrowserGuard>;
  createTelemetry(
    policy: PublicCdpPolicy,
    startedAtMonotonicMs: number,
    fingerprintKey: Uint8Array,
    onBudgetExceeded: (reasonCode: 'telemetry_event_budget_exceeded') => void,
  ): TelemetryCollector;
  preflightCandidate(
    environment: PublicCdpEnvironment,
    context: StartupStageContext,
  ): Promise<CandidateEnvironmentIdentity>;
  attestBeforeNavigation(
    connection: CdpConnection,
    preflight: CandidateEnvironmentIdentity,
    runtime: CdpChromeRuntime,
    context: StartupStageContext,
  ): Promise<CandidateIdentity>;
  attestAfterNavigation(
    connection: CdpConnection,
    pageSessionId: string,
    expected: CandidateIdentity,
    route: RouteRule,
    runtime: CdpChromeRuntime,
    context: StartupStageContext,
  ): Promise<CandidateIdentity>;
  writeManifest(
    artifacts: SessionArtifacts,
    manifest: CdpSessionManifest,
    context: StartupStageContext,
  ): Promise<void>;
  recordCandidate(
    artifacts: SessionArtifacts,
    candidate: CandidateIdentity,
    context: StartupStageContext,
  ): Promise<void>;
  captureSnapshot(
    connection: CdpConnection,
    pageSessionId: string,
    routeId: string,
    context: CommandContext,
  ): Promise<Extract<CdpObservation, { kind: 'snapshot' }>>;
  captureScreenshot(input: {
    connection: CdpConnection;
    pageSessionId: string;
    route: RouteRule;
    runtime: CdpChromeRuntime;
    guard: BrowserGuard;
    candidate: CandidateIdentity;
    artifacts: SessionArtifacts;
    context: CommandContext;
  }): Promise<Extract<CdpObservation, { kind: 'screenshot' }>>;
  writeObservation<K extends 'snapshot' | 'console' | 'network'>(
    artifacts: SessionArtifacts,
    descriptor: {
      kind: K;
      routeId: string;
    },
    observation: Extract<CdpObservation, { kind: K }>,
    context: CommandContext,
  ): Promise<{ basename: string; bytes: number; sha256: string }>;
  quiesceChromeEgress(chrome: OwnedChrome, context: SafetyCleanupContext): Promise<void>;
  terminateChrome(chrome: OwnedChrome, context: SafetyCleanupContext): Promise<void>;
  releaseChromeResources(chrome: OwnedChrome, context: SafetyCleanupContext): Promise<void>;
}

export class FreelandCdpBroker {
  static async start(input: {
    root: string;
    session: string;
    daemonIdentity: { pid: number; startToken: string };
    control: SessionControl;
    abortSignal: AbortSignal;
    startupDeadlineMonotonicMs: number;
    onTerminalRequested(): void;
    env: Readonly<Record<string, string | undefined>>;
    adapters?: Partial<BrokerAdapters>;
  }): Promise<FreelandCdpBroker>;

  sessionAlias(): string;
  async execute(command: CdpCommand, callerSignal?: AbortSignal): Promise<CdpRunResult>;
  async stop(): Promise<CdpRunResult>;
  whenTerminated(): Promise<CdpRunResult>;
}

export function generateSessionAlias(randomBytesImpl?: (size: number) => Buffer): string;
```

Production defaults bind every adapter member to the exact Tasks 2–12 implementation; `validateEntryGate` reads only `coverage/bootstrap/cdp-i0-entry-gate.v1.json` and calls Task 2's validator. `FreelandCdpBroker.start` validates the supplied daemon PID/start token and persists it unchanged in every manifest. The default `reconcileExpired` composes Task 6 digest-bound session/creation-lease transitions with Task 7 bounded observation-only persisted PID/start-token/executable inspection plus the required profile-user scan, and never signals a PID; after all three processes are absent it invokes the shared Task 6 persisted-profile release before `stopped`/artifact deletion. `startChrome` passes only the already-durable `artifacts.profileDirectory` through `ChromeStartHooks`, and no Chrome filesystem/process creation occurs before the bootstrap rename. The default `connectChrome` passes only the inherited branded pipe from the exact `OwnedChrome` to Task 5. Immediately before guard installation, the broker obtains exactly 32 random bytes and creates telemetry with a once-only budget callback wired to the same synchronous terminal latch as guard breaches. It passes that exact collector as the required `GuardTelemetrySink` into `installGuard` before any target resume. The default `installGuard` binds `assertBrowserExited(context)` to that exact `OwnedChrome` and Task 7 `inspectOwnedChrome(chrome, context)`, accepting only `stopped` and mapping `running`/`ownership-mismatch`/timeout to a safe typed failure; it binds `onPolicyBreach` to atomically close command admission and schedule the same idempotent stop promise. Guard shutdown stops sink ingestion, guard exit settles/removes its listeners, and only then does broker teardown call `TelemetryCollector.clear()` to zero the key. Tests inject deterministic keys and prove no event is duplicated/reclassified, no post-shutdown ingestion occurs, and no key reaches results/manifests/artifacts/logs.

The broker arms immutable watchers for watchdog exit, pipe EOF/error, and proxy closure before guard install. A watchdog-first exit takes Task 7's pipe-disconnect fallback path; a pipe-first or proxy-first exit uses the still-live watchdog when available. All three synchronously close admission and converge on one compare-and-set stop promise, but never pretend a dead watchdog can signal Chrome. Internal `runStartupStage` and `runCommand` helpers enforce their distinct shared monotonic deadlines, derive linked signals, pass reduced timeouts through every async seam—including every Task 6 create/read/manifest/candidate/index/artifact call—abort on expiry/disconnect, and await owned unwind before returning.

Post-guard safety cleanup has one non-caller-cancellable 35,000 ms outer deadline and one owner: the broker. Its exact ordered phase caps are 5,000 ms active-command cancellation/settlement; 2,000 ms `guard.beginShutdown`; 2,000 ms `quiesceChromeEgress`; 12,000 ms `terminateChrome`; 3,000 ms `guard.closeAfterBrowserExit` plus idempotent transport close; 2,000 ms `releaseChromeResources`; and 5,000 ms stopped/quarantined manifest/control publication. The caps sum to 31,000 ms, leaving 4,000 ms scheduling margin. Every phase receives the same internal safety signal plus `min(cap, remaining)`; no later phase starts after expiry, and cancellation must settle the underlying adapter. Profile release occurs only in its listed phase. Before guard installation, startup unwind alone may call Task 7's composite `stopOwnedChrome`; after guard installation it is a source-contract failure to do so. Tests replace each phase independently, consume every exact cap, expire every boundary, trigger each watcher order, and prove no duplicate teardown, premature pipe/guard close, detached promise, profile removal before absence, or late durable rename.

A private compare-and-set state owns the single active command, lifetime/idle timers, counters, and one idempotent stop promise. Its synchronous terminal prefix closes broker admission and invokes the no-argument `onTerminalRequested` exactly once before any deferred shutdown work; `whenTerminated()` returns the same immutable promise and settles only after Chrome/guard/transport/profile/manifest cleanup has reached its typed terminal result. Thus watchdog/pipe/proxy/guard/telemetry/session-budget failures notify the daemon even without a socket stop command. No command result or process exit is finalized while an adapter promise or durable rename from that command remains pending. Unit tests replace every external/browser boundary and therefore never start Chrome or contact staging. `generateSessionAlias` reads exactly 16 random bytes and returns lowercase hex with prefix `s-`. The CLI generates the alias once; the daemon derives but does not create Task 6 `SessionControl`; `FreelandCdpBroker.start` validates the matching alias, atomically publishes the bootstrap artifact directory/manifest, and only then creates the control directory. The class has private CDP/Chrome/artifact/control fields and exposes no connection, endpoint, target, evaluator, URL-navigation, selector, or filesystem API. Map internal typed failures to the seven Task 3 outcomes using stable reason codes; never return raw error text as `reasonCode`.

- [ ] **Step 5: Run focused checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/broker.test.ts
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 13**

```bash
set -euo pipefail
git add packages/cdp-broker/src/broker.ts tests/cdp/broker.test.ts
git commit -m "feat: compose typed Freeland CDP commands"
```

### Task 14: Add a Private Control Daemon and Agent CLI

**Files:**

- Create: `packages/cdp-broker/src/control-server.ts`
- Create: `packages/cdp-broker/src/daemon.ts`
- Create: `tools/cdp/agent-cdp.ts`
- Create: `tests/cdp/control-server.test.ts`
- Modify: `package.json`

**Interfaces:**

- **Consumes:** Task 13 broker.
- **Produces:** one-command-per-connection private Unix-socket protocol and the `npm run cdp:agent -- <command>` interface used by agents and Task 15.

- [ ] **Step 1: Write failing private control-server tests**

With a Task 6 `SessionControl` fixture, require:

- Unix socket mode `0600` after listen;
- one newline-terminated JSON command per connection;
- maximum input 16 KiB;
- maximum schema-valid output 128 KiB before the first response byte;
- Task 3 validation before handler invocation;
- one schema-valid result then connection close;
- invalid JSON, oversized input, multiple commands, unknown fields, and unknown command return `HARNESS_FAIL` without echoing input;
- socket path outside the owned control directory, a path at or above 100 UTF-8 bytes, or an existing symlink is rejected;
- server stop closes and removes only its own socket.
- a non-start command whose `session` differs from the daemon-owned alias is rejected before broker dispatch; the fixed `start` command is accepted only during initial CLI readiness and returns the cached broker start result.
- simultaneous socket connections prove broker single-flight: only one non-stop handler reaches an adapter, later work gets the typed busy result, and a `stop`/process signal closes admission, aborts and awaits the active handler, then tears down;
- the server admits at most eight concurrent sockets and 128 lifetime sockets. Excess concurrent sockets are destroyed immediately before allocating a command buffer; the 129th lifetime socket atomically closes listener admission and invokes the daemon's once-only terminal path. Counters saturate and there is no queue. Flood, partial-line, never-newline, slow-reader, and reconnect tests prove bounded FDs/buffers/timers and eventual daemon/socket cleanup;
- peer disconnect and the fixed 30-second command deadline abort a linked non-stop handler and leave no open socket, timer, CDP request, capture, or artifact write; once a validated `stop` is accepted, disconnect may suppress its response but cannot cancel safety cleanup;
- CLI start and daemon startup each use the same fixed 90-second monotonic outer budget from Task 13; readiness races the private active manifest against direct-child exit and the CLI deadline. Tests advance a fake clock through the complete 80-second staged budget and prove it succeeds, then test expiry at every boundary.
- timeout/early-exit cleanup retains the original direct `AgentDaemonChild` handle and birth token, verifies its exact identity, sends `SIGTERM` through that still-unsettled handle, and allows the broker's complete 35,000 ms safety-cleanup budget plus a separate 10,000 ms scheduling/daemon-finalization margin. If the daemon is still present after 45,000 ms, the CLI revalidates the same direct-child token/identity and the private manifest and permits handle-bound `SIGKILL` only when the manifest plus Task 7 bounded inspection prove Chrome/watchdog absent and cleanup state complete. Missing/malformed/partial evidence, a live child, token mismatch, or uncertain guard cleanup returns a typed failure and leaves the daemon alive. After an authorized kill, wait at most 5,000 ms for exact daemon exit; PID reuse/mismatch is never signalled.
- after a successful start has been unreferenced, absent-socket recovery is observation-only. It never signals a daemon, watchdog, or Chrome by persisted PID; it cleans files only after persisted PID/start-token/executable inspection plus the mandatory profile-user scan proves the three recorded processes and all profile-bound helpers absent. Any live, reused, mismatched, uncertain, or quarantined process tuple returns a typed failure and preserves evidence.

- [ ] **Step 2: Write failing CLI parsing/output tests**

Accept exactly:

```text
start
status --session s-0123456789abcdef0123456789abcdef
attest --session s-0123456789abcdef0123456789abcdef
navigate --session s-0123456789abcdef0123456789abcdef --route landing
back --session s-0123456789abcdef0123456789abcdef
reload --session s-0123456789abcdef0123456789abcdef
wait --session s-0123456789abcdef0123456789abcdef --predicate document-ready --timeout-ms 15000
snapshot --session s-0123456789abcdef0123456789abcdef
console-summary --session s-0123456789abcdef0123456789abcdef
network-summary --session s-0123456789abcdef0123456789abcdef
screenshot-safe --session s-0123456789abcdef0123456789abcdef
stop --session s-0123456789abcdef0123456789abcdef
```

The concrete alias above is a parser fixture. Tests also cover every reviewed route ID, both wait predicates, both timeout bounds, and rejection of an alias that does not match `^s-[0-9a-f]{32}$`.

Reject positional URLs, `--root`, `--cdp`, `--target-id`, `--selector`, `--expression`, `--path`, unknown flags, duplicate flags, and environment IDs other than the single fixed start profile. Resolve the repository root only from the imported module location, require its real path to contain the expected private `freelandqa` package and `.git` worktree metadata, and never accept a caller-supplied root. Require stdout to be exactly one JSON `CdpRunResult` line and stderr to contain only one safe result line on failure.

Implement and test these public CLI seams; production entrypoint calls `runAgentCdpCli(process.argv.slice(2), ...)` and nothing executes merely by importing the module:

```ts
export interface AgentCdpIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

export interface AgentDaemonChild {
  pid: number;
  startToken: string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  signal(signal: NodeJS.Signals): boolean;
  unref(): void;
}

export interface AgentDaemonEnvironment {
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin';
  LANG: 'en_US.UTF-8';
  LC_ALL: 'en_US.UTF-8';
  FREELAND_STAGING_BASE_URL: 'https://mf0.forum';
  FREELAND_EXPECTED_STAGE_SHA: string;
  FREELAND_STAGING_MESH_IP: string;
  FREELAND_CDP_CHROME_EXECUTABLE: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

export interface AgentCdpAdapters {
  repositoryRoot(): string;
  spawnDaemon(input: {
    root: string;
    session: string;
    startupTimeoutMs: 90000;
    environment: AgentDaemonEnvironment;
    context: {
      timeoutMs: 90000;
      deadlineMonotonicMs: number;
      signal: AbortSignal;
    };
  }): Promise<AgentDaemonChild>;
  readManifest(
    root: string,
    session: string,
    context: { timeoutMs: number; signal: AbortSignal },
  ): Promise<CdpSessionManifest>;
  sendControl(input: {
    manifest: CdpSessionManifest;
    command: CdpCommand;
    maxInputBytes: 16384;
    maxOutputBytes: 131072;
    timeoutMs: 30000;
    signal: AbortSignal;
  }): Promise<CdpRunResult>;
  recoverStoppedSession(input: {
    root: string;
    manifest: CdpSessionManifest;
    context: { timeoutMs: number; signal: AbortSignal };
  }): Promise<CdpRunResult>;
  processInspector: ProcessInspector;
  monotonicMs(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export function parseAgentCdpArgs(args: string[]): CdpCommand;

export async function runAgentCdpCli(
  args: string[],
  io: AgentCdpIo,
  adapters?: Partial<AgentCdpAdapters>,
): Promise<number>;
```

Production defaults bind only the exact daemon spawn, bounded socket request, Task 6 manifest reader, Task 7 observation-only process inspector, ownership-checked recovery, clock, and sleep operations above; no adapter exposes a CDP connection or generic filesystem operation to callers. `spawnDaemon` uses absolute `process.execPath`, `shell:false`, the exact daemon argv, detached/ignored stdio, the closed environment object, and the linked startup signal/deadline. It must either return the direct child within the remaining bound or abort and await spawn/error/close settlement; a hung adapter before a child exists cannot outlive the 90-second deadline. A signal is possible only through the original unsettled `AgentDaemonChild` returned by `spawnDaemon`, after `assertOwnedDaemonProcess` proves its exact start token/root/session/script/fixed timeout. Once that child is unreferenced, no CLI path has signalling authority. Source tests seed hostile parent variables and prove the daemon receives exactly the seven allowed names and no credential/preload/proxy/logging variable.

- [ ] **Step 3: Run control/CLI tests and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/control-server.test.ts
```

Expected: FAIL with missing server/CLI modules.

- [ ] **Step 4: Implement the control server**

```ts
export async function startControlServer(input: {
  control: SessionControl;
  execute(command: CdpCommand, signal: AbortSignal): Promise<CdpRunResult>;
  onConnectionBudgetExceeded(): void;
  isTerminalRequested(): boolean;
  context: {
    timeoutMs: number;
    deadlineMonotonicMs: number;
    signal: AbortSignal;
  };
}): Promise<{
  stopAccepting(): Promise<void>;
  closeAfterRequests(): Promise<void>;
}>;
```

Use `node:net`, one bounded 16 KiB input buffer, one bounded 128 KiB output buffer, one `\n`, and `chmod(control.socketPath, 0o600)`. Validate a positive linked startup context, revalidate Task 6 control ownership, and check `isTerminalRequested() === false` before bind, after bind, and after chmod. Bind/chmod/ownership operations must accept the linked signal or be raced against the decreasing absolute deadline and then be explicitly closed/awaited to settlement; an abort, timeout, or terminal flip closes the listener, removes only the exact owned socket entry, publishes no server handle, and leaves no late callback capable of reopening it. Revalidate ownership again before final close. Enforce eight concurrent and 128 lifetime sockets before allocating a per-socket buffer; overflow destroys immediately, and lifetime overflow closes listener admission plus calls `onConnectionBudgetExceeded` once. Every admitted socket gets a linked `AbortController` and 30,000 ms monotonic deadline; premature peer close aborts the handler. Parse to `unknown`, validate, execute with that signal, validate and fully size the canonical result before writing one line, then destroy the connection. A slow reader cannot retain more than the bounded output/deadline. `stopAccepting` atomically closes the listener without dropping admitted sockets; `closeAfterRequests` waits only for their already-bounded handlers. Never log input bytes.

- [ ] **Step 5: Implement daemon startup and recovery behavior**

`daemon.ts` accepts only internal arguments `--root`, `--session`, and exact `--startup-timeout-ms 90000`, where root is the already validated repository root and session matches the alias pattern. Any missing, duplicate, reordered, extra, or different timeout argument fails before artifact or process creation. It requires its environment to have exactly the seven `AgentDaemonEnvironment` keys above, validates the four non-secret Freeland values through Task 4, and rejects every extra inherited variable, including `HOME`, `TMPDIR`, `NODE_OPTIONS`, `SSLKEYLOGFILE`, inspector/preload, proxy, logging, crash-report, credential, and arbitrary `FREELAND_*` names. All temporary control/profile locations remain fixed platform literals under `/private/tmp`, not environment-derived. It creates an `AbortController`, derives (but does not create) Task 6 `SessionControl`, records `startupDeadlineMonotonicMs = monotonicMs() + 90000`, obtains and validates its own Task 7 `ProcessIdentity`, and starts the broker with that exact PID/start token plus alias/control/signal/deadline and a synchronous `onTerminalRequested` callback. The broker atomically publishes the first `starting` manifest/index before creating control, and alone updates starting/active state. The daemon passes the same linked startup signal/deadline and a synchronous terminal-state reader to `startControlServer`; it listens on the manifest-owned socket only after startup succeeds and the terminal CAS is still open.

One daemon terminal compare-and-set covers broker-originated fatal/idle/absolute/count stops, control-connection-budget overflow, valid socket `stop`, `SIGTERM`, and `SIGINT`. Its synchronous prefix marks server admission closed and aborts the linked control-startup controller; its deferred body calls `server.stopAccepting()` when present, requests/shares `broker.stop()` when the trigger did not already do so, awaits `broker.whenTerminated()`, then calls `server.closeAfterRequests()`, removes only the exact owned control, and exits. If the callback fires before or during bind/chmod, the server is never published and all partial socket work settles before cleanup. A valid socket `stop` connection remains among the bounded admitted requests long enough to flush its one schema-valid result before `closeAfterRequests` settles. Startup abort/failure and every internal fatal path use the same ownership-checked control cleanup. Tests stall daemon spawn before a child exists and stall each control bind/chmod/ownership boundary; timeout/abort must settle every adapter and leave zero daemon, control socket, proxy, watchdog, or Chrome survivor. Tests also trigger each terminal source without a CLI recovery command and require the same zero-survivor result.

The CLI `start` first reads only the four named non-secret Freeland variables, validates them through Task 4, constructs the exact seven-key `AgentDaemonEnvironment`, calls Task 13 `generateSessionAlias`, calculates the expected manifest path without creating it, and spawns the logical equivalent of:

```bash
set -euo pipefail
node --import tsx packages/cdp-broker/src/daemon.ts --root "$REPOSITORY_ROOT" --session "$SESSION_ALIAS" --startup-timeout-ms 90000
```

using absolute `process.execPath`, `shell:false`, detached process, ignored stdio, and the exact closed environment—not a shell evaluation of the displayed command. Immediately before spawn, the CLI records its own `startupDeadlineMonotonicMs = monotonicMs() + 90000`, creates one linked controller, and supplies both its absolute deadline and signal to `spawnDaemon`, manifest reads, sleeps, and the first control connection. It retains the direct child handle and does not call `unref()` until the private active manifest validates and sending the fixed `start` command over the new socket returns the cached schema-valid start result; a not-yet-bound socket remains pending within that deadline. Readiness races only that deadline and direct-child exit, polling no longer than the remaining budget, and explicitly settles every aborted adapter before returning.

On exit or timeout, the CLI inspects the still-retained direct child's PID and calls `assertOwnedDaemonProcess` with the exact birth token, root, session, daemon script, and `startupTimeoutMs:90000`. Only that exact unsettled child handle receives `SIGTERM`. The CLI races `child.exited` against a separate 45,000 ms monotonic grace deadline, strictly exceeding Task 13's complete 35,000 ms non-caller-cancellable safety budget by 10,000 ms for scheduling, socket drain, and daemon finalization. If the daemon remains, the CLI performs a second exact token/identity check and a bounded Task 6 manifest read. Handle-bound `SIGKILL` is permitted only when a schema-valid manifest plus Task 7 bounded token inspection prove Chrome and watchdog already absent and broker cleanup state `stopped`/`quarantined`; missing, malformed, `starting`, `active`, `stopping`, live, or mismatch evidence forbids it. After an authorized kill, race exit against a final 5,000 ms deadline. A settled child counts as exited; any mismatch or uncertainty produces `BROWSER_FAIL`, retains/quarantines evidence when safe, and sends no further signal. Only after daemon exit or proven absence does the CLI perform observation-only manifest cleanup. If the exact daemon survives `SIGKILL`, return a typed failure and retain evidence rather than waiting indefinitely or deleting anything. Only a successful ready daemon is unreferenced. Task 6 remains the sole creator of the published session directory/manifest. Other CLI commands resolve only `artifacts/cdp/freeland-cdp-${SESSION_ALIAS}/cdp-session-manifest.v1.json`, validate it under their linked bounded context, and connect to its socket with their own linked 30,000 ms timeout/abort. A timed-out CLI destroys its socket; the server propagates disconnect to the broker command. They never print private fields.

If the socket is unavailable, `status` may return observed `healthy:false` only from a validated `stopped` manifest; `starting`, `active`, `stopping`, or `quarantined` without its socket returns a typed failure rather than stale health. Idempotent `stop` without the original child handle is observation-only: inspect daemon, watchdog, and Chrome using each persisted PID/start token/executable and always run the exact-profile user scan. If any recorded process or profile-bound helper is live, reused, mismatched, or uncertain, send no signal, return `BROWSER_FAIL`, and retain/quarantine evidence. Only when the three recorded processes and every profile user are proven absent may Task 6 manifest/control checks remove the proven ephemeral profile and short control directory, atomically record `stopped` under a separate bounded context, and retain the artifact directory until normal seven-day cleanup. The daemon-owned proxy cannot survive daemon exit, so browser egress remains closed even during an orphan anomaly. Recovery tests deliberately reuse each PID with a different birth token and retain one helper-only profile user; both require zero signals/deletions. Argv checks occur only while the original direct-child handle is live.

- [ ] **Step 6: Add package scripts**

Add exact scripts without changing `verify:deterministic` yet:

```json
{
  "test:cdp-broker": "node --import tsx --test tests/cdp/*.test.ts",
  "cdp:agent": "node --import tsx tools/cdp/agent-cdp.ts"
}
```

- [ ] **Step 7: Run focused and aggregate checks**

```bash
set -euo pipefail
npm run test:cdp-broker
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0. The tests use fake Chrome/CDP and never contact staging.

- [ ] **Step 8: Commit Task 14**

```bash
set -euo pipefail
git add packages/cdp-broker/src/control-server.ts packages/cdp-broker/src/daemon.ts \
  tools/cdp/agent-cdp.ts tests/cdp/control-server.test.ts package.json
git commit -m "feat: expose private typed CDP control plane"
```

### Task 15: Add the Agent Skill, Runbook, Live Smoke, and CI Contract

**Files:**

- Create: `AGENTS.md`
- Create: `skills/freeland-cdp/SKILL.md`
- Create: `docs/runbooks/freeland-cdp-public-staging.md`
- Create: `packages/contracts/schemas/cdp-live-smoke-result.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-local-security-smoke-result.v1.schema.json`
- Create: `packages/contracts/src/cdp-live-smoke.ts`
- Create: `packages/contracts/src/cdp-local-security-smoke.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/cdp-broker/src/artifact-verifier.ts`
- Create: `tools/cdp/live-smoke.ts`
- Create: `tools/cdp/local-security-smoke.ts`
- Create: `tests/cdp/agent-surface.test.ts`
- Create: `tests/cdp/live-smoke.test.ts`
- Create: `tests/cdp/local-security-smoke.test.ts`
- Create: `tests/cdp/replay.test.ts`
- Create: `tests/cdp/replay/public-landing-session.v1.json`
- Create: `tests/cdp/replay/redirect-to-production.v1.json`
- Create: `tests/cdp/replay/popup-service-worker.v1.json`
- Create: `tests/cdp/replay/sensitive-capture.v1.json`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

- **Consumes:** Task 14 CLI and all safety modules.
- **Produces:** an agent-usable workflow, `validateCdpLiveSmokeResult`, `validateCdpLocalSecuritySmokeResult`, `verifySessionArtifacts`, behavior-tested staging and local real-Chrome security smoke commands, stable synthetic CDP replay coverage, and source-contract proof that the existing Baseline workflow merge-gates deterministic broker tests through `test:unit`.

- [ ] **Step 1: Write the failing agent-surface source contract**

The test reads `AGENTS.md`, the skill, runbook, `package.json`, `.github/workflows/baseline.yml`, `tools/cdp/live-smoke.ts`, and `tools/cdp/local-security-smoke.ts`. Require:

- skill directs agents only to the documented `npm run cdp:agent -- <typed-command>` forms, where `<typed-command>` is one of the exact Task 14 grammar productions;
- skill explicitly forbids direct CDP URLs, raw JavaScript, login, provider/payment routes, writes, production, and continuing after non-`OBSERVED` outcomes;
- runbook requires a fresh profile and exact expected SHA;
- live smoke contains no credentials, auth-file reads, Nuanu client, browser/network dispatch using a write method, or payment command; a write token may occur only in the pure `decideRequest` denial self-test;
- `test:unit` still selects `tests/**/*.test.ts` and Baseline still runs `npm run test:unit`;
- `test:cdp-broker` exists for focused local execution;
- no live-smoke command is added to Baseline or `verify:deterministic`.
- the local security smoke is not agent-addressable, accepts no URL/host/port/script/profile/certificate argument, binds only OS-assigned loopback TCP/UDP/TLS/DNS fixtures, creates only ephemeral profiles and OS-temporary artifacts, and contains no production/Nuanu/provider/payment hostname or client. The exact staging authority may only come from the reviewed Task 4 policy and must be forced by the smoke-owned proxy to its loopback TLS fixture; source tests reject any adapter path to the real mesh IP;
- neither real-Chrome smoke command is added to Baseline or `verify:deterministic`.

- [ ] **Step 2: Write failing staging/local-smoke, artifact-verification, and replay tests**

In `tests/cdp/live-smoke.test.ts`, import the missing production module and require it to export this exact closed result contract:

```ts
export interface CdpLiveSmokeResult {
  schemaVersion: 1;
  result: 'cdp_live_smoke_passed';
  routeId: 'landing';
  candidateSha: string;
  observedAt: string;
  outcome: 'OBSERVED';
  candidateStable: true;
  writes: 0;
  nuanuWrites: 0;
  productMutations: 0;
  purchases: 0;
  unknownRoutesAllowed: 0;
  writeRequestsAllowed: 0;
  forbiddenLeaks: 0;
  artifactsSanitized: true;
  observationArtifacts: 3;
  screenshotArtifacts: 1;
}
```

In `tests/cdp/local-security-smoke.test.ts`, define the second closed contract:

```ts
export interface CdpLocalSecuritySmokeResult {
  schemaVersion: 1;
  result: 'cdp_local_security_smoke_passed';
  browserProduct: 'Chrome/150.0.7871.187';
  protocolVersion: '1.3';
  viewport: '1280x960@1';
  positiveControls: 12;
  directSocketCapability: 'macos_api_absent_flag_and_lockdown_proven';
  keychainIsolation: 'mock_keychain_and_async_provider_disable_source_pinned';
  httpWriteRequests: 0;
  speculativeDestinationConnections: 0;
  foreignDnsQueries: 0;
  localDiscoveryDatagrams: 0;
  websocketUpgrades: 0;
  websocketFrames: 0;
  webTransportSessions: 0;
  webrtcDatagrams: 0;
  directSocketConnections: 0;
  browserInitiatedWriteRequests: 0;
  cookieCredentialBytes: 0;
  downloadFilesCreated: 0;
  crashpadArtifacts: 0;
  nestedTargetsEscaped: 0;
  popupScriptsExecuted: 0;
  sensitivePixels: 0;
  watchdogCrashOrphans: 0;
  orphanedChromeProcesses: 0;
}
```

Require its hand-written validator and closed JSON Schema to agree and reject unknown/nonzero fields, a different positive-control count, any Direct Sockets capability status other than the exact literal, or any Keychain status other than `mock_keychain_and_async_provider_disable_source_pinned`. With injected loopback TCP/UDP/TLS/DNS/SSDP servers, proxy, process launcher, clock, and filesystem, require the tool to run a paired negative-control and production-guarded case for exactly twelve fixed capability bundles: (1) HTTP read-only—including body/override/header writes, cookie minting, Reporting/NEL and the reviewed browser-process producers; (2) speculative and local discovery, including DNS-prefetch, preconnect, DIAL/SSDP, mDNS, and media routing; (3) WebSocket and WebSocketStream; (4) WebTransport; (5) WebRTC/STUN; (6) Direct TCP; (7) Direct UDP; (8) nested-target escape; (9) popup execution plus attachment/`<a download>` writes; (10) delayed screenshot paint; (11) daemon-parent loss; and (12) an independent real watchdog-crash subcase. Every negative control keeps the outer OS loopback destination jail but disables the complete capability-specific production defense bundle in a fixed test-only launcher so its dedicated canary can fire; it does not pretend that removing one of several overlapping defenses is sufficient. The matching guarded case uses every production layer. Separate source/runtime assertions prove each individual layer in that bundle is present, ordered, and effective. If a canary cannot execute or a claimed production layer cannot be observed, the smoke fails instead of accepting a guarded zero. Every guarded case uses the production pipe transport, recursive `BrowserGuard`, fixed egress jail, mask/freeze path, and watchdog, then requires zero destination/browser-write/cookie-credential/download/local-discovery/execution/pixel/helper/survivor counters and its exact stable denial reason. Separately assert the production argv contains one byte-exact `--use-mock-keychain` and disables `UseKeychainKeyProvider`; pin both source gates, emit only the fixed Keychain literal, and never query, create, mutate, or observe the user's default Keychain. Parameterize each proxy/guard/freeze/thaw/watchdog/cleanup failure and require nonzero exit with safe stderr and no stdout.

The mandatory acceptance platform is macOS with exact `Browser.getVersion` product `Chrome/150.0.7871.187`, protocol `1.3`, and Task 4 viewport—not a major range. Prove the IWA-only Direct Sockets condition without a vacuous zero in three steps: (1) require `process.platform === 'darwin'` and the exact closed runtime; (2) launch a fresh loopback-only negative fixture whose fixed bundle enables synthetic TCP/UDP slots while retaining the destination jail and require each canary to fire; (3) run the approved exact-origin fixture under the complete production flag+lockdown+proxy bundle, require its pre-resume script to install frozen throwing slots for the complete reviewed list, and require page/worker code to emit an attempt marker while replacement/call/listener/success markers and loopback destinations remain zero. Separately launch the production `--disable-features=DirectSockets` configuration without route content and require every reviewed native page/worker entry point absent—any present or unreviewed entry point fails. The result literal states only `macos_api_absent_flag_and_lockdown_proven`; it does not claim native IWA availability. A separate ChromeOS IWA capability lane is deferred beyond I1 because Chromium documents Direct Sockets as ChromeOS-only: [permission-policy change](https://groups.google.com/a/chromium.org/g/blink-dev/c/5cSZjgnJelk/m/K56ic8m_AgAJ).

For capability bundle (1), the loopback TLS fixture emits `Reporting-Endpoints`, `Report-To`, NEL, CSP-reporting, Attribution Reporting, FedCM, fenced/shared-storage/private-aggregation, and payment-manifest triggers that are applicable to exact Chrome 150. It also attempts same-origin `fetch(...,{keepalive:true})`, `sendBeacon`, unload delivery, and retry-enabled keepalive with runtime-generated method/header/body markers, forces an eligible error/retry window, and keeps the listener alive beyond renderer detach. The negative launcher enables the audited browser/network-service producer bundle and must observe at least the fixed Reporting/NEL POST plus keepalive/retry canaries and each source-feasible API attempt marker. The guarded launcher requires the exact ordered Task 3 disabled-feature tuple—including `KeepAliveInBrowserMigration` and `FetchRetry`—and proves zero browser-initiated write or delayed retry reaches the same-authority TLS listener, while the browser-session Fetch gate still observes all ordinary page/worker reads. This is necessary because Reporting/NEL upload out of band through the network service, FedCM performs browser-process fetches, and KeepAliveURLLoader can retry the original website method/headers/body after renderer loss: [Chromium Reporting/NEL features](https://chromium.googlesource.com/chromium/src/+/a1ab292dbe67a42b59ee24dfb17da90121e84937/services/network/public/cpp/features.cc), [Reporting uploader architecture](https://chromium.googlesource.com/chromium/src/+/refs/tags/98.0.4758.67/net/reporting/README.md), [FedCM browser networking](https://chromium.googlesource.com/chromium/src.git/+/refs/tags/129.0.6614.3/content/browser/webid/README.md), and [KeepAlive retry source](https://chromium.googlesource.com/chromium/src/+/main/content/browser/loader/keep_alive_url_loader.cc). The same pair mints a runtime cookie and arbitrary `Foo`/`Accept`/`Range`/`If-*` header markers plus a unique referrer/`Referrer-Policy` path marker: negative wire sees them, while the guarded wire permits only the closed Task 9 canonical header profile with omitted-on-wire empty Referer, `Accept-Encoding: identity`, exact HTTP/1.1 `Connection: keep-alive`, absent/empty Cookie, and zero marker/referrer bytes, and reports `cookieCredentialBytes:0`. Any Chrome-150 source audit finding an additional browser-initiated same-origin writer that lacks a disable/probe blocks I1 and requires a reviewed runtime tuple update.

The screenshot pair executes the exported production `captureSafeScreenshot`, not a replacement attestor. Its operator-only proxy accepts the exact policy authority `mf0.forum:443` but dials an OS-assigned loopback TLS fixture; Chrome receives only the fixture certificate's exact ephemeral SPKI allow value. The page URL therefore remains exactly `https://mf0.forum/`, `/api/environment` returns the closed synthetic staging identity with a fixed non-secret SHA/project ref, and Task 8's unmodified `attestCandidateAfterNavigation` succeeds. The proxy rejects every other authority and never resolves or contacts real staging. A delayed magenta `<canvas>` at the former race point is visible in the negative control and absent from every decoded guarded PNG pixel. Source-contract tests prove this local destination override is defined only in `tools/cdp/local-security-smoke.ts`, accepts no caller input, is not exported by the broker/CLI/skill, and cannot be selected by `FREELAND_CDP_*` environment variables.

Require the TypeScript validator and closed JSON Schema to agree on valid/invalid objects, canonical time/SHA, all exact literals, and no unknown keys. With an injected CLI runner, test the exact command sequence, stable candidate derivation, artifact counts, and one final stop. Parameterize every intermediate command to fail; after a successful start, each failure must still invoke stop exactly once, emit no stdout, and return one safe stable reason on stderr. A start failure must not call stop; a stop failure must fail the smoke.

`artifact-verifier` tests create Task 6 artifacts, then require bounded reads, schema validation for all three JSON observations, exact basename/index kind/decoded observation-kind agreement, Task 10 safe-observation validation, Task 12 full PNG/chunk/decode validation, and matching index digests. A screenshot observation's branded artifact name must equal its one indexed public PNG. Corrupt/mismatched kind/name/size/digest/schema/CRC/chunk stream, symlink, extra file, oversized file, or synthetic leak yields a typed safe failure and no captured content in output.

Create four closed, bounded synthetic replay JSON files (each at most 64 KiB, with no headers, bodies, credentials, or real personal data):

- `public-landing-session` covers out-of-order transport responses, target attach, allowed GET, AX projection, and clean summaries;
- `redirect-to-production` covers an allowed staging GET redirected to the production origin and requires a block;
- `popup-service-worker` covers paused popup plus three-level worker/service-worker attachment, recursive auto-attach, and transport lockdown before every resume;
- `sensitive-capture` uses symbolic atoms such as `{ "syntheticAtom": "email" }`; the test materializes runtime-generated markers, then requires complete sanitization and no durable marker.

`replay.test.ts` validates the closed fixture shape, replays it through the actual transport router, browser guard, semantic projector, and sanitizer with injected I/O, and asserts deterministic safe results over two runs. It never opens a socket, starts Chrome, or contacts staging.

- [ ] **Step 3: Run all new tests and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/agent-surface.test.ts \
  tests/cdp/live-smoke.test.ts tests/cdp/local-security-smoke.test.ts \
  tests/cdp/replay.test.ts
```

Expected: FAIL because the skill/runbook/live-smoke contracts, verifier, orchestration, and replay corpus do not exist.

- [ ] **Step 4: Write `skills/freeland-cdp/SKILL.md` and root `AGENTS.md`**

The skill workflow is exact:

```text
1. Start and require outcome OBSERVED.
2. Attest and compare candidate SHA.
3. Navigate by reviewed route ID only.
4. Wait using a named predicate.
5. Request semantic/console/network observations.
6. Request screenshot only when the route policy exposes it.
7. Stop in a finally block.
8. Treat every stale, block, attestation, browser, redaction, or harness outcome as non-product evidence.
```

`AGENTS.md` points to that skill for CDP work, points to existing Playwright commands for deterministic regressions, and states that payment and authenticated flows are outside `I1`.

- [ ] **Step 5: Implement artifact verification, the result contract, and typed live orchestration**

`packages/contracts/src/cdp-live-smoke.ts` exports the exact `CdpLiveSmokeResult` above and `validateCdpLiveSmokeResult(input)`. `packages/contracts/src/cdp-local-security-smoke.ts` exports the exact `CdpLocalSecuritySmokeResult` and `validateCdpLocalSecuritySmokeResult(input)`. Both schemas are recursively closed; the staging result shares Task 3 SHA/time rules, while the local result requires the exact browser/protocol/viewport literals, `positiveControls:12`, `directSocketCapability:'macos_api_absent_flag_and_lockdown_proven'`, and every egress/browser-write/cookie/download/execution/pixel/watchdog/helper/survivor counter to be literal zero.

`packages/cdp-broker/src/artifact-verifier.ts` exports only:

```ts
export interface SafeArtifactVerification {
  observations: 3;
  screenshots: 1;
  digestsValid: true;
  schemasValid: true;
  forbiddenLeaks: 0;
}

export async function verifySessionArtifacts(
  artifactRoot: string,
  session: string,
  context: ArtifactIoContext,
): Promise<SafeArtifactVerification>;
```

It bounds the index/JSON reads at 64 KiB each and PNG at 5 MiB, requires exactly the three observation kinds `snapshot`, `console`, and `network` plus one screenshot, rejects unindexed/duplicate files, and returns no path/content/digest.

`tools/cdp/live-smoke.ts` imports the Task 14 exported CLI runner rather than executing shell strings or calling the broker directly. It invokes the exact typed argv arrays through an injected in-memory IO adapter, thereby exercising daemon startup, manifest discovery, the private socket, command validation, and response validation while reserving process stdout for the single final result. It performs:

```text
start -> attest -> navigate(landing) -> wait(document-ready)
-> snapshot -> console-summary -> network-summary -> screenshot-safe
-> attest -> stop
```

Before browser start, it calls `decideRequest` with one synthetic `.invalid` write and `resolveRoute` with one unknown route ID and requires both to deny. Those are pure policy self-tests; no write request is sent. It requires every live command outcome `OBSERVED`, identical pre/post release SHA, safe route `landing`, zero guard-allowed writes, and successful cleanup. A `finally` block invokes typed `stop` whenever `start` returned a session. On failure it exits nonzero with one schema-derived safe reason line on stderr and no stdout.

Stdout is one safe JSON line conforming to this exact shape:

```json
{"schemaVersion":1,"result":"cdp_live_smoke_passed","routeId":"landing","candidateSha":"0123456789abcdef0123456789abcdef01234567","observedAt":"2026-08-02T00:00:00.000Z","outcome":"OBSERVED","candidateStable":true,"writes":0,"nuanuWrites":0,"productMutations":0,"purchases":0,"unknownRoutesAllowed":0,"writeRequestsAllowed":0,"forbiddenLeaks":0,"artifactsSanitized":true,"observationArtifacts":3,"screenshotArtifacts":1}
```

The displayed SHA and timestamp are synthetic shape examples. At runtime `candidateSha` is the schema-validated attested release SHA, and `observedAt` is the canonical UTC instant captured after the final successful attestation and before cleanup. After stop, `verifySessionArtifacts` must return the exact counts/literals above before `validateCdpLiveSmokeResult` permits stdout. These fields are safe acceptance inputs; private endpoint, profile, target, socket, PID, and captured content remain omitted.

`tools/cdp/local-security-smoke.ts` is a separate operator-only executable and is never imported by the agent CLI/skill. It accepts no arguments and reads only `FREELAND_CDP_CHROME_EXECUTABLE`; fixture destinations, certificate/SPKI, SHA, reviewed Direct Sockets names, browser-feature inventory, and cases are fixed/generated internally. It requires macOS, binds OS-assigned loopback TCP, UDP, TLS, DNS-over-HTTPS, SSDP/mDNS, destination-canary, and filesystem-canary fixtures, and runs the twelve paired capability bundles from Step 2, one fresh profile/watchdog/pipe/proxy per case. Each negative uses its complete fixed test-only capability override while retaining the outer loopback jail and must prove the canary can fire; each guarded control separately asserts all corresponding production defenses. Guarded controls reuse Task 5 pipe framing, Task 7 lifecycle/watchdog plus an operator-only allow-one proxy that maps exact `mf0.forum:443` to the generated TLS fixture, and Task 9/12 production code. `Browser.getVersion` must equal `Chrome/150.0.7871.187`/`1.3`, viewport must equal `1280x960@1`, and the guarded production profile, after removing exactly its one smoke-owned ephemeral SPKI argument, must byte-equal the Task 3/7 production argv built with the same owned profile/proxy inputs; each negative profile may additionally remove only its enumerated fixed capability delta, and the actual production profile must contain no SPKI override; there is no maintained major matrix. Source-contract tests pin the mock-keychain switch plus disabled async provider to the reviewed Chromium gates and emit `keychainIsolation:'mock_keychain_and_async_provider_disable_source_pinned'`; the tool never queries, creates, mutates, or observes the user's default Keychain and makes no stronger runtime claim. The HTTP bundle includes ordinary no-body-metadata GET, `OPTIONS`, body-bearing GET, all method-override spellings, arbitrary `Foo`, `Accept` marker, `Range`, `If-*`, custom `x-*`, a unique referrer/`Referrer-Policy` marker, a minted cookie, Reporting/NEL/browser-process attempts, keepalive/sendBeacon/unload/retry attempts, and requires empty Referer to be absent on wire, exact `Accept-Encoding: identity`, exact HTTP/1.1 `Connection: keep-alive`, plus zero guarded page-controlled referrer/header, write, retry, and cookie credential bytes. The local-discovery pair proves negative DNS-prefetch/preconnect/DIAL/SSDP/mDNS activity and guarded zero destination/DNS/local-discovery egress with exact `DialMediaRouteProvider`/`MediaRouter` disablement. The popup/download bundle serves an attachment and clicks `<a download>`, requires the negative filesystem canary and guarded `Browser.setDownloadBehavior` plus zero file creation outside owned roots. The screenshot pair uses the exact staging origin/environment response so unmodified Task 8 post-attestation runs, then fully decodes the actual masked PNG and requires every RGBA pixel exactly `[241,243,245,255]`. The lifecycle bundles run real parent loss and, independently, only `induceWatchdogCrashForLocalSecuritySmoke`; both prove main Chrome, watchdog, Crashpad, renderer/GPU/helper processes, and every profile-bound user absent within Task 7 bounds with no later CLI recovery. It scans the fixed profile/OS-temporary fixture roots for crash dumps and requires `crashpadArtifacts:0`; any Crashpad process/file/socket is failure. Every expected denial requires its stable reason, every resource is closed under its bound, and unsupported watchdog/pipe behavior is a failure. Only then may the tool emit the one closed `CdpLocalSecuritySmokeResult` JSON line. No port, certificate, target, request, screenshot bytes, path, process token, or page value reaches output, and all non-loopback socket attempts are structurally impossible.

- [ ] **Step 6: Add the live-smoke script and exact runbook commands**

Add to `package.json`:

```json
{
  "cdp:live-smoke": "node --import tsx tools/cdp/live-smoke.ts",
  "cdp:local-security-smoke": "node --import tsx tools/cdp/local-security-smoke.ts"
}
```

The runbook requires:

```bash
set -euo pipefail
export FREELAND_STAGING_BASE_URL="https://mf0.forum"
export FREELAND_CDP_CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_APP="/Applications/Google Chrome.app"
CHROME_REQUIREMENT='identifier "com.google.Chrome" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = EQHXZ8M8AV'
/usr/bin/codesign --verify --deep --strict -R="$CHROME_REQUIREMENT" "$CHROME_APP"
test "$(node -p 'process.versions.node.split(".")[0]')" = "20"
test -n "$FREELAND_STAGING_MESH_IP"
test -n "$FREELAND_EXPECTED_STAGE_SHA"
test "${#FREELAND_EXPECTED_STAGE_SHA}" = "40"
node -e 'if(!/^[0-9a-f]{40}$/.test(process.env.FREELAND_EXPECTED_STAGE_SHA ?? ""))process.exit(1)'
npm ci
npm run test:cdp-broker
npm run cdp:local-security-smoke
npm run cdp:live-smoke
```

It also documents that the local security smoke is mandatory before a staging smoke but never runs in CI, plus `npm run cdp:agent -- stop --session "$SESSION_ALIAS"` for recovery, the seven-day ignored artifact location, and typed outcomes. The current workstation audit found the exact codesign preflight fails because the installed bundle carries disallowed Finder/resource-fork metadata; I1 live acceptance is therefore blocked until an official clean Chrome reinstall makes the unchanged exact signature gate pass. The runbook must stop and request that external remediation—it must never suggest stripping xattrs, altering the app bundle, changing the requirement, or weakening `--deep --strict`. It never instructs an operator to log in or copy a CDP endpoint.

- [ ] **Step 7: Update README with the three distinct CDP checks/lanes**

Document:

- deterministic `npm run test:cdp-broker` is merge-gated through existing `test:unit`;
- `npm run cdp:local-security-smoke` is a mandatory operator-only, synthetic loopback real-Chrome acceptance check and never contacts staging;
- `npm run cdp:live-smoke` is local, exact-SHA, staging-only, unauthenticated, read-only, and non-gated;
- the product Patchset workflow continues to own payment-harness conformance;
- no lane replaces Playwright regression tests.

- [ ] **Step 8: Run focused and full deterministic checks**

```bash
set -euo pipefail
node --import tsx --test tests/cdp/agent-surface.test.ts
node --import tsx --test tests/cdp/live-smoke.test.ts \
  tests/cdp/local-security-smoke.test.ts tests/cdp/replay.test.ts
npm run test:cdp-broker
npm run verify:deterministic
git diff --check
```

Expected: all exit 0; no staging request occurs.

- [ ] **Step 9: Commit Task 15**

```bash
set -euo pipefail
git add AGENTS.md skills/freeland-cdp/SKILL.md \
  docs/runbooks/freeland-cdp-public-staging.md \
  packages/contracts/schemas/cdp-live-smoke-result.v1.schema.json \
  packages/contracts/schemas/cdp-local-security-smoke-result.v1.schema.json \
  packages/contracts/src/cdp-live-smoke.ts packages/contracts/src/cdp-local-security-smoke.ts \
  packages/contracts/src/index.ts packages/cdp-broker/src/artifact-verifier.ts \
  tools/cdp/live-smoke.ts tools/cdp/local-security-smoke.ts \
  tests/cdp/agent-surface.test.ts tests/cdp/live-smoke.test.ts \
  tests/cdp/local-security-smoke.test.ts \
  tests/cdp/replay.test.ts tests/cdp/replay package.json README.md
git commit -m "feat: expose safe Freeland CDP agent workflow"
```

### Task 16: Collect, Prove, and Record `FL-CDP-I1` Acceptance

**Files:**

- Create: `packages/contracts/schemas/cdp-i1-evidence.v1.schema.json`
- Create: `packages/contracts/schemas/cdp-i1-acceptance.v1.schema.json`
- Create: `packages/contracts/src/cdp-i1-evidence.ts`
- Create: `packages/contracts/src/cdp-acceptance.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tools/acceptance/collect-cdp-i1-evidence.ts`
- Create: `tools/acceptance/render-cdp-i1-acceptance.ts`
- Create: `tests/acceptance/cdp-i1-acceptance.test.ts`
- Create after successful collection: `coverage/bootstrap/cdp-i1-acceptance.v1.json`
- Create after successful collection: `docs/history/2026-08-02-cdp-i1-acceptance.md`
- Private ignored output: `.work/cdp-i1-acceptance/evidence.v1.json`

**Interfaces:**

- **Consumes:** one clean exact implementation commit from Tasks 2–15, the fixed I0 record and active patchset manifest, closed deterministic/TAP results, one exact-Chrome loopback security result, one exact-SHA public staging result, and an unchanged verifier-built product checkout.
- **Produces:** one closed private evidence object, then canonical acceptance JSON/Markdown whose commit is the single direct child of the proven implementation commit.
- **Invariant:** no shell-local result from one checkbox is trusted by another. The checked-in collector owns all lanes, revalidates repository cleanliness and exact commit/tree identity before and after each lane, and writes evidence only after the complete run succeeds.

- [ ] **Step 1: Write failing evidence, acceptance, collector, renderer, and provenance tests**

Define the closed evidence object:

```ts
export interface CdpI1Evidence {
  schemaVersion: 1;
  implementationCommit: string;
  entryGateCommit: string;
  deterministic: {
    typecheck: 'pass';
    broker: {
      tests: number;
      passes: number;
      failures: 0;
      cancelled: 0;
      skipped: 0;
      todo: 0;
    };
    securityScan: 'pass';
    deterministicVerify: 'pass';
  };
  liveSmoke: CdpLiveSmokeResult;
  localSecurity: CdpLocalSecuritySmokeResult;
  productHarness: {
    manifestId: 'freeland-virtual-numbers-card-canary-20260801';
    manifestSha256: string;
    baseCommit: string;
    baseTree: string;
    sourceHead: string;
    finalTree: string;
    tests: number;
    passes: number;
    failures: 0;
    cancelled: 0;
    skipped: 0;
    todo: 0;
    treeUnchanged: true;
    paymentHarnessChangedByI1: false;
  };
}
```

Define acceptance as a lossless closed projection:

```ts
export interface CdpI1Acceptance {
  schemaVersion: 1;
  implementationCommit: string;
  entryGateCommit: string;
  deterministic: {
    typecheck: 'pass';
    brokerTests: number;
    brokerFailures: 0;
    brokerCancelled: 0;
    brokerSkipped: 0;
    brokerTodo: 0;
    securityScan: 'pass';
    deterministicVerify: 'pass';
  };
  liveSmoke: {
    observedAt: string;
    candidateSha: string;
    routeIds: ['landing'];
    outcome: 'OBSERVED';
    candidateStable: true;
    writes: 0;
    nuanuWrites: 0;
    artifactsSanitized: true;
    observationArtifacts: 3;
    screenshotArtifacts: 1;
  };
  localSecurity: {
    browserProduct: 'Chrome/150.0.7871.187';
    protocolVersion: '1.3';
    viewport: '1280x960@1';
    positiveControls: 12;
    directSocketCapability: 'macos_api_absent_flag_and_lockdown_proven';
    keychainIsolation: 'mock_keychain_and_async_provider_disable_source_pinned';
    httpWriteRequests: 0;
    speculativeDestinationConnections: 0;
    foreignDnsQueries: 0;
    localDiscoveryDatagrams: 0;
    websocketUpgrades: 0;
    websocketFrames: 0;
    webTransportSessions: 0;
    webrtcDatagrams: 0;
    directSocketConnections: 0;
    browserInitiatedWriteRequests: 0;
    cookieCredentialBytes: 0;
    downloadFilesCreated: 0;
    crashpadArtifacts: 0;
    nestedTargetsEscaped: 0;
    popupScriptsExecuted: 0;
    sensitivePixels: 0;
    watchdogCrashOrphans: 0;
    orphanedChromeProcesses: 0;
  };
  productHarness: {
    manifestId: 'freeland-virtual-numbers-card-canary-20260801';
    manifestSha256: string;
    baseCommit: string;
    baseTree: string;
    sourceHead: string;
    finalTree: string;
    tests: number;
    failures: 0;
    cancelled: 0;
    skipped: 0;
    todo: 0;
    treeUnchanged: true;
    paymentHarnessChangedByI1: false;
  };
  policy: {
    unknownRoutesAllowed: 0;
    writeRequestsAllowed: 0;
    forbiddenLeaks: 0;
  };
  externalWrites: {
    nuanu: 0;
    productMutations: 0;
    purchases: 0;
  };
}
```

Require 40-lowercase-hex commits/trees/SHA, a 64-lowercase-hex manifest digest, canonical UTC instant, `broker.tests === broker.passes > 0`, `productHarness.tests === passes >= 154`, and every closed zero/true/pass/literal above. Evidence and acceptance validators plus JSON Schemas must agree and reject extra keys. The acceptance renderer must map every field from evidence: `productMutations`, `purchases`, `unknownRoutesAllowed`, `writeRequestsAllowed`, and `forbiddenLeaks` come only from `liveSmoke`; no zero/true/pass/count may be synthesized.

Collector tests inject a no-shell process runner, filesystem, git inspector, clock, temporary-root allocator, and smoke runners. Require exact argv/environment allowlists, bounded stdout/stderr/TAP parsing, fixed I0/manifest/product tuple, and clean `HEAD/index/worktree` checks before and after every deterministic, product, local-security, and live lane plus immediately before evidence write. Parameterize any mutation still present at a checkpoint, staged mutation, untracked file, HEAD movement, truncated/duplicate TAP summaries, lane nonzero exit, invalid smoke JSON, wrong stage SHA, product tree drift, manifest drift, and payment-patchset drift; every case writes no evidence/acceptance and emits no captured output. A valid fixture writes one canonical evidence file atomically. Per Global Constraint 24, local implementation/test processes are trusted; the checkpoint model does not claim to detect a cooperating same-UID process that mutates and perfectly restores bytes entirely between two checks.

Renderer/provenance tests require the fixed evidence path, fixed I0 path, and fixed active-manifest path and recompute their digests/tuples. Define three exclusive states: pre-write is clean with `HEAD === implementationCommit`; pre-commit check has the same HEAD and exactly the two generated acceptance paths as the only changes; post-commit check is clean with `HEAD` having exactly one parent equal to `implementationCommit` and exactly the two acceptance paths in that commit. Every other state is rejected.

- [ ] **Step 2: Run the acceptance test and verify red**

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-i1-acceptance.test.ts
```

Expected: FAIL because the evidence/acceptance contracts and tools do not exist.

- [ ] **Step 3: Implement closed contracts, one fail-closed collector, and the evidence-only renderer**

Export:

```ts
export function validateCdpI1Evidence(input: unknown): asserts input is CdpI1Evidence;
export function validateCdpI1Acceptance(input: unknown): asserts input is CdpI1Acceptance;
export function projectCdpI1Acceptance(evidence: CdpI1Evidence): CdpI1Acceptance;
export function validateCdpI1AcceptanceProvenance(input: {
  implementationCommit: string;
  headCommit: string;
  parentCommits: string[];
  changedFiles: string[];
}): void;
export function renderCdpI1Acceptance(input: CdpI1Acceptance): string;
```

`collect-cdp-i1-evidence.ts` accepts only `--implementation-commit <40hex>`, `--expected-stage-sha <40hex>`, and optional `--write`; reject duplicates, unknown flags, positional values, or any path argument. It uses `spawn`/`execFile` with `shell:false`, exact executable/argv lists, minimal environment allowlists, decreasing per-lane deadlines, OS-temporary directories, bounded output, and abort/kill cleanup. It never evaluates shell, parses terminal paths, or trusts caller-supplied counts.

The collector itself performs this one transaction:

1. require current `HEAD` equals `implementationCommit`, `HEAD^{tree}` equals `git write-tree`, index/worktree/untracked status is empty, and entry parentage starts from fixed I0 `entryGateCommit`;
2. read and validate only `coverage/bootstrap/cdp-i0-entry-gate.v1.json` and `patchsets/freeland/virtual-numbers-card-canary-20260801/manifest.yaml`; recompute the manifest SHA-256 and exact `baseCommit/baseTree/sourceHead/finalTree` tuple;
3. run `npm run typecheck`, `npm run test:cdp-broker`, `npm run security:scan`, and `npm run verify:deterministic`; parse the last complete Node TAP summary and require positive tests, equal passes, and zero failed/cancelled/skipped/todo;
4. verify the implementation diff from `entryGateCommit` changes no `patchsets/` path and cannot change product payment harness bytes; clone committed objects only from the validated product object source into an OS-temporary detached checkout, apply only `patchset:verify --mode immutable-base --leave-applied`, install with frozen lockfile, run `test:staging-cdp-harness`, require at least 154 complete passes, and prove exact base HEAD/final index tree/status are unchanged before/after;
5. run `cdp:local-security-smoke`, validate the complete exact-Chrome closed result including mock-Keychain/local-discovery/browser-writer fields, then run `cdp:live-smoke` and validate the complete closed result before exposing any stdout; require its candidate SHA equals `--expected-stage-sha`;
6. repeat exact clean commit/tree/index/worktree assertions before and after every lane and immediately before evidence publication. Any mutation present at a checkpoint or any HEAD movement aborts; no stronger transient-mutation claim is made;
7. construct evidence only from validated lane results, validate it again, encode canonical compact JSON plus one newline with total size at most 65,536 bytes, and atomically write only `.work/cdp-i1-acceptance/evidence.v1.json` when `--write` is present.

The collector deletes its owned temporary checkouts/logs under bounded cleanup and excludes their locations, product source path, ports, certificates, headers, bodies, browser/process/profile identifiers, raw TAP, and browser output from evidence/errors. Only after full validation may stdout contain `cdp-i1-evidence=pass mode=check|write`.

`render-cdp-i1-acceptance.ts` accepts only optional `--write`. It reads only the fixed evidence/I0/manifest paths, validates and binds all three, recognizes exactly the pre-write, pre-commit-check, or post-commit-check repository state defined in Step 1, calls `projectCdpI1Acceptance`, validates the projection, and writes/checks only the two canonical acceptance files. `--write` is legal only in the clean pre-write state; plain check is legal in either exact check state. It must not execute tests/smokes, accept raw JSON/flags/counts, or supply defaults. Its only stdout is `cdp-i1-acceptance=pass mode=check|write` after validation.

- [ ] **Step 4: Run focused implementation tests**

```bash
set -euo pipefail
node --import tsx --test tests/acceptance/cdp-i1-acceptance.test.ts
npm run test:cdp-broker
npm run typecheck
npm run security:scan
git diff --check
```

Expected: all exit 0 without starting Chrome or contacting staging.

- [ ] **Step 5: Commit the complete implementation before collecting evidence**

```bash
set -euo pipefail
git add packages/contracts/schemas/cdp-i1-evidence.v1.schema.json \
  packages/contracts/schemas/cdp-i1-acceptance.v1.schema.json \
  packages/contracts/src/cdp-i1-evidence.ts \
  packages/contracts/src/cdp-acceptance.ts packages/contracts/src/index.ts \
  tools/acceptance/collect-cdp-i1-evidence.ts \
  tools/acceptance/render-cdp-i1-acceptance.ts \
  tests/acceptance/cdp-i1-acceptance.test.ts
test "$(git diff --cached --name-only | sort)" = "$(printf '%s\n' \
  packages/contracts/schemas/cdp-i1-evidence.v1.schema.json \
  packages/contracts/schemas/cdp-i1-acceptance.v1.schema.json \
  packages/contracts/src/cdp-i1-evidence.ts \
  packages/contracts/src/cdp-acceptance.ts packages/contracts/src/index.ts \
  tools/acceptance/collect-cdp-i1-evidence.ts \
  tools/acceptance/render-cdp-i1-acceptance.ts \
  tests/acceptance/cdp-i1-acceptance.test.ts | sort)"
git commit -m "test: define Freeland CDP I1 acceptance"
IMPLEMENTATION_STATUS="$(git status --porcelain)"
test -z "$IMPLEMENTATION_STATUS"
IMPLEMENTATION_HEAD_TREE="$(git rev-parse 'HEAD^{tree}')"
IMPLEMENTATION_INDEX_TREE="$(git write-tree)"
test "$IMPLEMENTATION_HEAD_TREE" = "$IMPLEMENTATION_INDEX_TREE"
```

- [ ] **Step 6: Collect every lane into one commit-bound private evidence object**

```bash
set -euo pipefail
test -n "$FREELAND_EXPECTED_STAGE_SHA"
node -e 'if(!/^[0-9a-f]{40}$/.test(process.env.FREELAND_EXPECTED_STAGE_SHA ?? ""))process.exit(1)'
IMPLEMENTATION_COMMIT="$(git rev-parse HEAD)"
EVIDENCE_INPUT_STATUS="$(git status --porcelain)"
test -z "$EVIDENCE_INPUT_STATUS"
node --import tsx tools/acceptance/collect-cdp-i1-evidence.ts \
  --implementation-commit "$IMPLEMENTATION_COMMIT" \
  --expected-stage-sha "$FREELAND_EXPECTED_STAGE_SHA" \
  --write
test "$(git rev-parse HEAD)" = "$IMPLEMENTATION_COMMIT"
EVIDENCE_OUTPUT_STATUS="$(git status --porcelain)"
test -z "$EVIDENCE_OUTPUT_STATUS"
```

This is the only evidence-collection command. The expected live result validated inside it includes all Task 15 fields:

```json
{"schemaVersion":1,"result":"cdp_live_smoke_passed","routeId":"landing","candidateSha":"0123456789abcdef0123456789abcdef01234567","observedAt":"2026-08-02T00:00:00.000Z","outcome":"OBSERVED","candidateStable":true,"writes":0,"nuanuWrites":0,"productMutations":0,"purchases":0,"unknownRoutesAllowed":0,"writeRequestsAllowed":0,"forbiddenLeaks":0,"artifactsSanitized":true,"observationArtifacts":3,"screenshotArtifacts":1}
```

The SHA/time above are shape examples only. The local result must include exact browser/product/protocol/viewport, twelve positive controls, the Direct Sockets literal, and every local counter—HTTP, speculative, DNS, local discovery, all transports, browser writers, cookies, downloads, Crashpad, targets/popups, pixels, watchdog, and survivors—at literal zero. The current machine's unchanged exact codesign preflight is a hard external blocker until an official clean Chrome reinstall passes; never strip xattrs or weaken signature verification.

- [ ] **Step 7: Project the fixed evidence into canonical acceptance files**

```bash
set -euo pipefail
RENDER_INPUT_STATUS="$(git status --porcelain)"
test -z "$RENDER_INPUT_STATUS"
node --import tsx tools/acceptance/render-cdp-i1-acceptance.ts --write
test "$(git status --porcelain | awk '{print $2}' | sort)" = "$(printf '%s\n' \
  coverage/bootstrap/cdp-i1-acceptance.v1.json \
  docs/history/2026-08-02-cdp-i1-acceptance.md | sort)"
node --import tsx tools/acceptance/render-cdp-i1-acceptance.ts
```

Expected: write and check modes agree byte-for-byte. Renderer revalidates evidence and maps every claim; it never reruns, defaults, or fabricates a passing field.

- [ ] **Step 8: Reverify and commit only the two acceptance records**

```bash
set -euo pipefail
npm run verify:deterministic
git diff --check
git add coverage/bootstrap/cdp-i1-acceptance.v1.json \
  docs/history/2026-08-02-cdp-i1-acceptance.md
test "$(git diff --cached --name-only | sort)" = "$(printf '%s\n' \
  coverage/bootstrap/cdp-i1-acceptance.v1.json \
  docs/history/2026-08-02-cdp-i1-acceptance.md | sort)"
IMPLEMENTATION_COMMIT="$(node -e 'const fs=require("node:fs");const v=JSON.parse(fs.readFileSync(".work/cdp-i1-acceptance/evidence.v1.json","utf8"));process.stdout.write(v.implementationCommit)')"
test "$(git rev-parse HEAD)" = "$IMPLEMENTATION_COMMIT"
git commit -m "docs: record Freeland CDP I1 acceptance"
```

- [ ] **Step 9: Prove direct-child provenance and final cleanliness**

```bash
set -euo pipefail
IMPLEMENTATION_COMMIT="$(node -e 'const fs=require("node:fs");const v=JSON.parse(fs.readFileSync(".work/cdp-i1-acceptance/evidence.v1.json","utf8"));process.stdout.write(v.implementationCommit)')"
test "$(git rev-list --parents -n 1 HEAD)" = "$(printf '%s %s' "$(git rev-parse HEAD)" "$IMPLEMENTATION_COMMIT")"
test "$(git diff --name-only HEAD^ HEAD | sort)" = "$(printf '%s\n' \
  coverage/bootstrap/cdp-i1-acceptance.v1.json \
  docs/history/2026-08-02-cdp-i1-acceptance.md | sort)"
node --import tsx tools/acceptance/render-cdp-i1-acceptance.ts
npm run verify:deterministic
FINAL_STATUS="$(git status --porcelain)"
test -z "$FINAL_STATUS"
```

- [ ] **Step 10: Push the exact accepted head, open a PR, and bind both required remote checks**

```bash
set -euo pipefail
BRANCH="codex/freeland-agent-first-cdp-i1"
test "$(git branch --show-current)" = "$BRANCH"
FINAL_HEAD="$(git rev-parse HEAD)"
PUSH_STATUS="$(git status --porcelain)"
test -z "$PUSH_STATUS"
BASELINE_MAX_BEFORE="$(gh run list --repo nuanu-ai/FreelandQA --workflow baseline.yml --limit 100 --json databaseId --jq 'map(.databaseId) | max // 0')"
PATCHSET_MAX_BEFORE="$(gh run list --repo nuanu-ai/FreelandQA --workflow patchset.yml --limit 100 --json databaseId --jq 'map(.databaseId) | max // 0')"
git push --set-upstream origin "$BRANCH"
PR_URL="$(gh pr create --repo nuanu-ai/FreelandQA --base main --head "$BRANCH" \
  --title "Add read-only agent-first Freeland CDP broker" \
  --body "Implements FL-CDP-I0/I1: typed public-staging observation only; no auth, mutations, Nuanu writes, or payments.")"
PR_NUMBER="$(gh pr view "$PR_URL" --repo nuanu-ai/FreelandQA --json number --jq .number)"

for ATTEMPT in $(seq 1 36); do
  BASELINE_RUN_IDS="$(gh run list --repo nuanu-ai/FreelandQA --workflow baseline.yml \
    --branch "$BRANCH" --event pull_request --limit 100 \
    --json databaseId,headSha \
    --jq "map(select(.headSha == \"$FINAL_HEAD\" and .databaseId > $BASELINE_MAX_BEFORE)) | .[].databaseId")"
  BASELINE_RUN_COUNT="$(printf '%s\n' "$BASELINE_RUN_IDS" | awk 'NF { n += 1 } END { print n + 0 }')"
  test "$BASELINE_RUN_COUNT" -le 1
  test "$BASELINE_RUN_COUNT" = 1 && break
  sleep 5
done
test "$BASELINE_RUN_COUNT" = 1
BASELINE_RUN_ID="$BASELINE_RUN_IDS"

for ATTEMPT in $(seq 1 36); do
  PATCHSET_RUN_IDS="$(gh run list --repo nuanu-ai/FreelandQA --workflow patchset.yml \
    --branch "$BRANCH" --event pull_request --limit 100 \
    --json databaseId,headSha \
    --jq "map(select(.headSha == \"$FINAL_HEAD\" and .databaseId > $PATCHSET_MAX_BEFORE)) | .[].databaseId")"
  PATCHSET_RUN_COUNT="$(printf '%s\n' "$PATCHSET_RUN_IDS" | awk 'NF { n += 1 } END { print n + 0 }')"
  test "$PATCHSET_RUN_COUNT" -le 1
  test "$PATCHSET_RUN_COUNT" = 1 && break
  sleep 5
done
test "$PATCHSET_RUN_COUNT" = 1
PATCHSET_RUN_ID="$PATCHSET_RUN_IDS"

gh run watch "$BASELINE_RUN_ID" --repo nuanu-ai/FreelandQA --exit-status
gh run watch "$PATCHSET_RUN_ID" --repo nuanu-ai/FreelandQA --exit-status
test "$(gh run view "$BASELINE_RUN_ID" --repo nuanu-ai/FreelandQA --json headSha --jq .headSha)" = "$FINAL_HEAD"
test "$(gh run view "$BASELINE_RUN_ID" --repo nuanu-ai/FreelandQA --json conclusion --jq .conclusion)" = "success"
test "$(gh run view "$BASELINE_RUN_ID" --repo nuanu-ai/FreelandQA --json jobs --jq '[.jobs[] | select(.name == "deterministic" and .conclusion == "success")] | length')" = "1"
test "$(gh run view "$PATCHSET_RUN_ID" --repo nuanu-ai/FreelandQA --json headSha --jq .headSha)" = "$FINAL_HEAD"
test "$(gh run view "$PATCHSET_RUN_ID" --repo nuanu-ai/FreelandQA --json conclusion --jq .conclusion)" = "success"
test "$(gh run view "$PATCHSET_RUN_ID" --repo nuanu-ai/FreelandQA --json jobs --jq '[.jobs[] | select(.name == "immutable-base" and .conclusion == "success")] | length')" = "1"
BASELINE_RUN_URL="$(gh run view "$BASELINE_RUN_ID" --repo nuanu-ai/FreelandQA --json url --jq .url)"
PATCHSET_RUN_URL="$(gh run view "$PATCHSET_RUN_ID" --repo nuanu-ai/FreelandQA --json url --jq .url)"
gh pr comment "$PR_NUMBER" --repo nuanu-ai/FreelandQA \
  --body "FL-CDP-I1 remote acceptance: head $FINAL_HEAD; Baseline $BASELINE_RUN_ID succeeded ($BASELINE_RUN_URL); Patchset $PATCHSET_RUN_ID succeeded ($PATCHSET_RUN_URL)."
```

Expected: exactly one pull-request run per required workflow on `FINAL_HEAD`, both exact jobs successful. Do not merge automatically. GitHub retains the remote run IDs/URLs and sanitized PR comment without changing the accepted commit.

---

## Final Acceptance Matrix

| Criterion | Required evidence |
|---|---|
| I0 remote gate | Private repo, exact successful Baseline/Patchset runs, read-only source access, protected `main` |
| Typed surface | Closed command/result schemas; no URL/selector/expression/CDP escape hatch |
| Browser ownership | Fresh profile, inherited daemon-only CDP pipe, allow-one egress proxy, parent-loss watchdog, birth-token/direct-handle cleanup, short private command socket |
| Candidate identity | Exact staging origin/appEnv/deployTarget/Supabase/full SHA before and after |
| Read-only enforcement | Recursive browser-wide guard; HTTP writes and bidirectional transports denied pre-resume; unknown target/route/origin fails closed |
| Safe observations | Bounded semantic projection, hashed console classes, templated network metadata |
| Screenshot safety | Fixed verified text/form/raster/canvas/media mask under script-disabled frozen double inspection, full bounded PNG decode, mask removal+thaw+reattest before private write |
| Privacy | Synthetic leakage suite reports zero forbidden durable values |
| Stable replay | Four bounded synthetic transcripts replay twice with identical safe results |
| Real-Chrome isolation | Twelve paired positive/guarded controls prove canonical-header rebuilding, zero HTTP/browser-writer/speculative/DNS/local-discovery/transport egress, nested-target/popup escape, delayed pixels, and lifecycle survivors; exact mock-Keychain argv semantics and macOS Direct Sockets absence+lockdown are recorded without probing the user's Keychain |
| Artifact proof | Exactly three validated observation JSON artifacts and one validated PNG, with matching index digests |
| Deterministic CI | `test:unit` merge-gates all `tests/cdp/*.test.ts`; live smoke absent from CI |
| Live staging | One exact-SHA unauthenticated `landing` smoke, stable candidate, zero writes |
| Product harness | I0 manifest digest plus exact base/source/final-tree tuple recorded; at least 154 existing product CDP tests pass in a verifier-built disposable checkout; source worktree and verified tree remain unchanged |
| Payment isolation | No product payment file changed; no payment capability in observation broker |
| Tracker isolation | Nuanu writes exactly zero |
| Repository state | Canonical I1 acceptance direct child, clean feature branch, both PR checks green, run IDs retained on PR |

## Execution Handoff

Implement Tasks 1–16 in order. Task 1 is a hard external gate: while the read-only deploy key/attestation is absent or Patchset remains red, do not create the implementation branch and do not begin Task 2. Once I1 is accepted, write separate designs/plans for I2 and later iterations rather than extending this plan in place.

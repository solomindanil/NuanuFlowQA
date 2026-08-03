# Freeland Repository Baseline and Coverage Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the private, reproducible `FreelandQA` repository that tracks the current Freeland tests and safe QA knowledge, fails closed on an empty suite, accounts conservatively for the current coverage and QA backlog, and preserves the six product-side commits as a verifiable patch series.

**Architecture:** Keep `NuanuFlowQA` as the generic source repository and create `/Users/danilsolomin/projectsnew/FreelandQA` as the product-owned private repository. The new repository has one npm/TypeScript toolchain, a fail-closed Playwright configuration, JSON-Schema-validated YAML coverage records, immutable sanitized source snapshots, a fixed-base product patch proof, and deterministic GitHub Actions that never contact staging or execute a purchase. Future controller, database, Computer Use, and payment-runtime directories are intentionally not scaffolded in this subproject.

**Tech Stack:** Node.js 20, npm lockfile, TypeScript 6, Playwright 1.61.1, Node test runner through `tsx`, YAML, Ajv JSON Schema validation, local `git`, GitHub CLI, GitHub Actions, and the Nuanu Flow MCP read-only work-item tools.

## Global Constraints

1. This plan implements only subproject 1 from the approved design. It does not implement the run database, Nuanu routing, personas, Computer Use, Telegram execution, or durable payment automation.
2. Do not mutate a Nuanu issue, comment, state, assignee, label, relation, or attachment. Nuanu access in this plan is read-only.
3. Do not open a provider checkout, submit a payment, make a purchase, create an account, mutate product settings, or run a live Playwright test.
4. Do not copy PAN, CVV, passwords, tokens, storage state, browser profiles, checkout URLs, raw provider payloads, emails, screenshots, traces, videos, HTML reports, or raw evidence into Git.
5. The existing dirty files in `/Users/danilsolomin/projectsnew/NuanuFlowQA` belong to the user. Do not stage, revert, format, or otherwise modify them.
6. The source test and documentation directories are currently ignored. Read from them, but write all implementation files into the new `FreelandQA` repository.
7. Treat all date-stamped board reports as historical evidence. The QA column is volatile and must be captured with a read-before/read-after consistency check during execution.
8. The immutable product patch proof is against base commit `c702465facd4971eb456ce8efe92dd9a3d694139`. Compatibility with the moving `staging` branch is a separate non-authoritative drift result.
9. A test that is skipped, flaky, conditionally expected to fail, or unconditionally expected to fail is executable coverage but never a passing promotion result.
10. Any command that would overwrite an existing `/Users/danilsolomin/projectsnew/FreelandQA` directory or existing GitHub repository must stop for inspection instead.
11. Use `.invalid` hostnames and generated synthetic values in unit tests. Never paste a real credential or payment value into a fixture.
12. Commit after every task in the new repository. Do not push until the local clean-clone acceptance task is green.

### Required 2–5 Minute Execution Loop

Every nested checkbox below is an independently reviewable 2–5 minute unit.
Numbered parent steps are grouping headings, not permission to implement the
whole group in one edit. For every implementation checkbox, the worker must:

1. add one named failing assertion or fixture mutation;
2. run the exact focused test named by that checkbox and record the non-zero
   result;
3. make only the smallest code or data change needed for that assertion;
4. rerun the focused test and record zero;
5. run `git diff --check` before moving to the next checkbox.

Mechanical copies and generated outputs use the same loop, with a source/target
inventory assertion as the failing test. A checkpoint that cannot complete in
five minutes must be split again before code is changed. Commits remain at task
boundaries so these micro-cycles do not create noisy history.

---

## Audited Starting Point

The implementation must preserve or improve these measured facts:

| Inventory | Audited value |
|---|---:|
| Freeland TypeScript files under `tests/freeland` | 29 |
| Playwright spec files | 23 |
| Playwright tests in the spec files | 163 |
| Authentication setup tests | 1 |
| Baseline staging enumeration | 164 tests in 24 test/setup files |
| Legacy Markdown matrix rows | 161 unique case IDs |
| Legacy check-only rows | 110 |
| Legacy manual-only rows | 38 |
| Legacy blocked-only rows | 10 |
| Legacy mixed check+blocked rows | 1 |
| Legacy mixed manual+blocked rows | 1 |
| Legacy unclassified failure row | 1 |
| Direct-ingress regression | 1 test |
| VPN regressions | 3 tests |
| WebKit release selection | 36 tests including setup |
| Product-side payment-ledger regression | 1 Node test |

The last read-only Nuanu snapshot available while this plan was written was captured at `2026-07-31T06:52:13Z` and contained 26 exact-QA issues:

```text
FREEL-211, FREEL-210, FREEL-205, FREEL-204, FREEL-203, FREEL-202,
FREEL-201, FREEL-181, FREEL-169, FREEL-154, FREEL-153, FREEL-152,
FREEL-151, FREEL-150, FREEL-149, FREEL-148, FREEL-147, FREEL-146,
FREEL-145, FREEL-136, FREEL-135, FREEL-134, FREEL-132, FREEL-83,
FREEL-82, FREEL-56
```

That list is a reference check, not an execution input. It had grown from 21 issues in roughly 70 minutes. A fresh, internally consistent snapshot is authoritative.

The product patch source is currently:

| Field | Value |
|---|---|
| Product repository | `nuanu-ai/freeland_app` |
| Local worktree | `/Users/danilsolomin/Documents/Freeland/.worktrees/staging-qa` |
| Local branch | `qa/virtual-numbers-card-canary` |
| Base commit | `c702465facd4971eb456ce8efe92dd9a3d694139` |
| Base tree | `6e5304f23ded34faff364577b08e4b7db09a9d17` |
| Source head | `a08e63b568df27e34aeab3d745e9b9457c2f24d4` |
| Final tree | `839e77b1640f682486a297210b30f0fbc1211219` |
| Commits above base | 6 |
| Unique changed files | 15 |
| Diff size | `+1590/-12` |
| Remote QA branch | absent |
| Remote `staging` observed at plan time | `eb8188225f89dd7c9c1d4b9613331d2ac1c54b56` |

The current six-commit series changes the duplicate-provider handoff behavior but does not contain the separately described regression test for that behavior. The patch manifest must record this as a known gap; it must not claim that the missing test exists.

---

## Target File Structure

Create only files used by this subproject:

```text
FreelandQA/
  .github/
    branch-protection.json
    workflows/
      baseline.yml
      patchset.yml
  .env.example
  .gitattributes
  .gitignore
  README.md
  package.json
  package-lock.json
  playwright.config.ts
  tsconfig.json
  config/
    environments/
      staging.yaml
  coverage/
    registry.v1.yaml
    bootstrap/
      matrix-161.v1.json
      playwright-164.v1.json
      playwright-auxiliary.v1.json
      coverage-report.v1.json
      subproject-1-acceptance.v1.json
      nuanu-qa-*.sanitized.json
    requirements/
      legacy/
        *.yaml
      qa/
        *.yaml
    sources/
      TEST-CASES-2026-07-07.md
      legacy-matrix-map.v1.yaml
      playwright-map.v1.yaml
    tickets/
      FREEL-*.yaml
  docs/
    adr/
      0001-repository-and-data-boundary.md
    history/
      2026-07-30-qa-verification.md
      2026-07-31-staging-release-audit.md
      2026-07-31-subproject-1-acceptance.md
    runbooks/
      clean-clone-verification.md
      refresh-qa-snapshot.md
      verified-product-patchset.md
    safety/
      payment-safety-gate.md
  packages/
    contracts/
      src/
        acceptance.ts
        coverage.ts
        index.ts
        nuanu.ts
        patchset.ts
        test-inventory.ts
      schemas/
        auxiliary-inventory.v1.schema.json
        coverage-registry.v1.schema.json
        coverage-requirement.v1.schema.json
        coverage-report.v1.schema.json
        legacy-matrix-inventory.v1.schema.json
        legacy-matrix-map.v1.schema.json
        nuanu-snapshot.v1.schema.json
        patchset-manifest.v1.schema.json
        playwright-review-map.v1.schema.json
        subproject-acceptance.v1.schema.json
        test-inventory.v1.schema.json
        ticket-mapping.v1.schema.json
    playwright-support/
      src/
        environment.ts
        projects.ts
  patchsets/
    freeland/
      virtual-numbers-card-canary-20260731/
        README.md
        SHA256SUMS
        manifest.yaml
        0001-272a5c04.patch
        0002-49db2ffd.patch
        0003-294f9634.patch
        0004-406e694d.patch
        0005-5c02b672.patch
        0006-a08e63b5.patch
  tests/
    acceptance/
      subproject-acceptance.test.ts
    coverage/
      fixtures/
        legacy-statuses.md
        nuanu-before.json
        nuanu-after-changed.json
        playwright-list.json
      baseline-files.test.ts
      environment.test.ts
      import-matrix.test.ts
      reconciliation.test.ts
      registry-validation.test.ts
      snapshot-normalization.test.ts
    patchsets/
      patchset-verification.test.ts
    playwright/
      freeland/
        *.spec.ts
        auth.setup.ts
        fixtures.ts
        helpers.ts
        pages/
      regressions/
        direct-ingress.spec.ts
        semantic-responsive.spec.ts
        vpn-regression.spec.ts
        webkit-auth.setup.ts
    product-contracts/
      payment-ledger-regression.test.mjs
    security/
      migration-safety.test.ts
      repository-scan.test.ts
  tools/
    acceptance/
      render-subproject-acceptance.ts
    coverage/
      capture-playwright.ts
      import-matrix.ts
      normalize-nuanu-snapshot.ts
      reconcile-qa.ts
      render-report.ts
      validate-registry.ts
    network/
      mesh-connect-proxy.ts
    patchsets/
      export-patchset.ts
      git-io.ts
      verify-patchset.ts
    security/
      scan-repository.ts
```

The timestamped Nuanu filename is generated mechanically from the accepted snapshot's UTC `capturedAt`, with punctuation removed. It is not manually chosen.

Contract ownership is fixed: environment/project types live in
`packages/playwright-support/src/`; coverage lifecycle/registry/report types
live in `packages/contracts/src/coverage.ts`; `InventoryCheck` and
`TestInventory` live in `test-inventory.ts`; Nuanu raw/snapshot/mapping types
live in `nuanu.ts`; patch manifest/result types live in `patchset.ts`.
Subproject acceptance input lives in `acceptance.ts`.
`packages/contracts/src/index.ts` re-exports those five contract modules.
Tool-only adapters (`ReadOnlyNuanuClient`, `ScanDetector`) stay beside their
tools and do not enter the persisted schema.

---

### Task 1: Bootstrap the Fail-Closed Private Repository

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.gitignore`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.gitattributes`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.env.example`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/README.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/package.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/package-lock.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tsconfig.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/config/environments/staging.yaml`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/packages/playwright-support/src/environment.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/packages/playwright-support/src/projects.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/environment.test.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/playwright.config.ts`

**Interfaces:**

- **Consumes:** an injected `HarnessEnv`, the tracked
  `config/environments/staging.yaml`, and no ambient `.env` during unit tests.
- **Produces:** `HarnessMode`, a validated `StagingEnvironment`, and a
  non-empty `PlaywrightTestConfig['projects']` array.
- **Boundary:** `FREELAND_DISCOVERY=1` maps only to `discovery`; an absent flag
  maps to `live`; every other value is rejected.

```ts
import type { PlaywrightTestConfig } from '@playwright/test';

export type HarnessMode = 'discovery' | 'live';
export type HarnessEnv = Readonly<Record<string, string | undefined>>;

export function resolveHarnessMode(env: HarnessEnv): HarnessMode;
export function loadStagingPolicy(policyPath: string): StagingEnvironmentPolicy;
export function loadStagingEnvironment(
  env: HarnessEnv,
  mode: HarnessMode,
  policy: StagingEnvironmentPolicy,
): StagingEnvironment;
export function createPlaywrightProjects(
  environment: StagingEnvironment,
): NonNullable<PlaywrightTestConfig['projects']>;
```

- [ ] **Step 1: Preflight the target without overwriting anything**

Run read-only checks for `/Users/danilsolomin/projectsnew/FreelandQA` and for a GitHub repository named `FreelandQA`. If either exists, inspect it and stop instead of initializing over it. Otherwise initialize a local repository with `main` as the initial branch.

- [ ] **Step 2: Write the failing environment-contract tests**

The tests must cover:

```ts
test('live mode rejects a missing staging URL, credentials, SHA, or auth path');
test('live mode only accepts the configured staging HTTPS origin');
test('live mode never falls back to production credential names');
test('discovery mode uses .invalid data and separate Chromium/WebKit auth paths');
test('the staging project definitions exist in discovery mode');
```

Use an injected `HarnessEnv` rather than mutating global environment state.
Add and run them one at a time:

- [ ] missing live inputs;
- [ ] canonical HTTPS origin;
- [ ] no production aliases;
- [ ] deterministic discovery values/auth paths;
- [ ] non-empty discovery project list.

- [ ] **Step 3: Run the tests and prove they fail for the missing implementation**

Run:

```bash
npx tsx --test tests/coverage/environment.test.ts
```

Expected result: module-not-found or assertion failure; zero exit is not acceptable at this step.

- [ ] **Step 4: Add the minimal package and TypeScript baseline**

Create this exact package shape:

```json
{
  "name": "freelandqa",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20 <21" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:unit": "tsx --test tests/**/*.test.ts",
    "test:product-contracts": "node --test tests/product-contracts/*.test.mjs",
    "test:list": "tsx tools/coverage/capture-playwright.ts --check",
    "coverage:import-matrix": "tsx tools/coverage/import-matrix.ts --source coverage/sources/TEST-CASES-2026-07-07.md --review-at 2026-08-07T00:00:00Z --write",
    "coverage:validate": "tsx tools/coverage/validate-registry.ts",
    "coverage:validate:requirements": "tsx tools/coverage/validate-registry.ts --requirements-only",
    "coverage:report": "tsx tools/coverage/render-report.ts",
    "coverage:reconcile": "tsx tools/coverage/reconcile-qa.ts",
    "patchset:verify": "tsx tools/patchsets/verify-patchset.ts",
    "security:scan": "tsx tools/security/scan-repository.ts --history",
    "verify:deterministic": "npm run typecheck && npm run test:unit && npm run coverage:validate && npm run test:list && npm run security:scan"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@types/node": "26.1.0",
    "ajv": "8.20.0",
    "ajv-formats": "3.0.1",
    "dotenv": "17.4.2",
    "tsx": "4.22.4",
    "typescript": "6.0.3",
    "yaml": "2.9.0"
  }
}
```

Run `npm install` once to generate the lockfile from these exact versions, then use only `npm ci`.

- [ ] **Step 5: Implement a fail-closed environment loader**

Expose these signatures:

```ts
export type HarnessMode = 'discovery' | 'live';

export function resolveHarnessMode(
  env: HarnessEnv,
): HarnessMode;

export interface StagingEnvironment {
  mode: HarnessMode;
  baseURL: string;
  expectedGitSha: string;
  email: string;
  password: string;
  chromiumAuthFile: string;
  webkitAuthFile: string;
  meshIp?: string;
}

export interface StagingEnvironmentPolicy {
  schemaVersion: 1;
  id: 'freeland-staging';
  requireHttpsOrigin: true;
  variables: {
    baseURL: 'FREELAND_STAGING_BASE_URL';
    expectedGitSha: 'FREELAND_EXPECTED_STAGE_SHA';
    email: 'FREELAND_STAGING_TEST_EMAIL';
    password: 'FREELAND_STAGING_TEST_PASSWORD';
    chromiumAuthFile: 'FREELAND_CHROMIUM_AUTH_FILE';
    webkitAuthFile: 'FREELAND_WEBKIT_AUTH_FILE';
    meshIp: 'FREELAND_STAGING_MESH_IP';
  };
}

export function loadStagingPolicy(
  policyPath: string,
): StagingEnvironmentPolicy;

export function loadStagingEnvironment(
  env: HarnessEnv,
  mode: HarnessMode,
  policy: StagingEnvironmentPolicy,
): StagingEnvironment;
```

Track this exact non-secret policy:

```yaml
schemaVersion: 1
id: freeland-staging
requireHttpsOrigin: true
variables:
  baseURL: FREELAND_STAGING_BASE_URL
  expectedGitSha: FREELAND_EXPECTED_STAGE_SHA
  email: FREELAND_STAGING_TEST_EMAIL
  password: FREELAND_STAGING_TEST_PASSWORD
  chromiumAuthFile: FREELAND_CHROMIUM_AUTH_FILE
  webkitAuthFile: FREELAND_WEBKIT_AUTH_FILE
  meshIp: FREELAND_STAGING_MESH_IP
```

The live URL must parse as one HTTPS origin with `/` only and no username,
password, query, or fragment. The loader reads only the variable names declared
by the policy.

Live mode must require:

```text
FREELAND_STAGING_BASE_URL
FREELAND_EXPECTED_STAGE_SHA
FREELAND_STAGING_TEST_EMAIL
FREELAND_STAGING_TEST_PASSWORD
FREELAND_CHROMIUM_AUTH_FILE
FREELAND_WEBKIT_AUTH_FILE
```

`FREELAND_STAGING_MESH_IP` remains optional because public-ingress tests must not use mesh routing. Discovery mode must use `https://enumeration.invalid`, `.invalid` synthetic credentials, a synthetic 40-hex SHA, and auth paths under the operating-system temp directory.

Implement as focused red/green checkpoints:

- [ ] strict discovery-flag parsing;
- [ ] YAML policy shape and unknown-key rejection;
- [ ] missing required live variable rejection, one variable per table case;
- [ ] HTTPS-origin validation;
- [ ] exact 40-hex SHA validation;
- [ ] distinct absolute Chromium/WebKit auth paths;
- [ ] optional mesh IP parsing without public-project routing;
- [ ] deterministic `.invalid` discovery values.

The minimal implementation is concrete:

```ts
const EXPECTED_POLICY: StagingEnvironmentPolicy = {
  schemaVersion: 1,
  id: 'freeland-staging',
  requireHttpsOrigin: true,
  variables: {
    baseURL: 'FREELAND_STAGING_BASE_URL',
    expectedGitSha: 'FREELAND_EXPECTED_STAGE_SHA',
    email: 'FREELAND_STAGING_TEST_EMAIL',
    password: 'FREELAND_STAGING_TEST_PASSWORD',
    chromiumAuthFile: 'FREELAND_CHROMIUM_AUTH_FILE',
    webkitAuthFile: 'FREELAND_WEBKIT_AUTH_FILE',
    meshIp: 'FREELAND_STAGING_MESH_IP',
  },
};

export function resolveHarnessMode(env: HarnessEnv): HarnessMode {
  const value = env.FREELAND_DISCOVERY;
  if (value === undefined) return 'live';
  if (value === '1') return 'discovery';
  throw new Error('FREELAND_DISCOVERY must be absent or exactly 1');
}

export function loadStagingPolicy(
  policyPath: string,
): StagingEnvironmentPolicy {
  const parsed: unknown = parseYaml(readFileSync(policyPath, 'utf8'));
  assert.deepEqual(parsed, EXPECTED_POLICY);
  return EXPECTED_POLICY;
}

function requireText(env: HarnessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required staging variable: ${name}`);
  }
  return value;
}

export function loadStagingEnvironment(
  env: HarnessEnv,
  mode: HarnessMode,
  policy: StagingEnvironmentPolicy,
): StagingEnvironment {
  if (mode === 'discovery') {
    const authRoot = path.join(tmpdir(), 'freelandqa-discovery');
    return {
      mode,
      baseURL: 'https://enumeration.invalid',
      expectedGitSha: '0000000000000000000000000000000000000000',
      email: 'enumeration@account.invalid',
      password: 'synthetic-enumeration-only',
      chromiumAuthFile: path.join(authRoot, 'chromium.json'),
      webkitAuthFile: path.join(authRoot, 'webkit.json'),
    };
  }

  const base = new URL(requireText(env, policy.variables.baseURL));
  if (
    base.protocol !== 'https:' ||
    base.username !== '' ||
    base.password !== '' ||
    base.pathname !== '/' ||
    base.search !== '' ||
    base.hash !== ''
  ) {
    throw new Error('Staging base URL must be one HTTPS origin');
  }
  const expectedGitSha = requireText(env, policy.variables.expectedGitSha);
  if (!/^[0-9a-f]{40}$/.test(expectedGitSha)) {
    throw new Error('FREELAND_EXPECTED_STAGE_SHA must be 40 lowercase hex');
  }
  const chromiumAuthFile = requireText(env, policy.variables.chromiumAuthFile);
  const webkitAuthFile = requireText(env, policy.variables.webkitAuthFile);
  if (
    !path.isAbsolute(chromiumAuthFile) ||
    !path.isAbsolute(webkitAuthFile) ||
    chromiumAuthFile === webkitAuthFile
  ) {
    throw new Error('Engine auth files must be distinct absolute paths');
  }
  const meshIp = env[policy.variables.meshIp];
  if (meshIp !== undefined && isIP(meshIp) === 0) {
    throw new Error('FREELAND_STAGING_MESH_IP must be an IP literal');
  }
  return {
    mode,
    baseURL: base.origin,
    expectedGitSha,
    email: requireText(env, policy.variables.email),
    password: requireText(env, policy.variables.password),
    chromiumAuthFile,
    webkitAuthFile,
    ...(meshIp === undefined ? {} : { meshIp }),
  };
}
```

The file imports `strict as assert` from `node:assert`, `readFileSync` from
`node:fs`, `isIP` from `node:net`, `tmpdir` from `node:os`, `path` from
`node:path`, and `parse as parseYaml` from `yaml`.

- [ ] **Step 6: Create unconditional Playwright project definitions**

`playwright.config.ts` must always register discovery-visible projects. It must never return an empty `projects` array because an environment variable is absent. Live execution without the required environment must throw before tests run. Do not register MagicPay or NuanuFlow projects.

The config calls `resolveHarnessMode(process.env)`, loads
`config/environments/staging.yaml`, and passes both values to
`loadStagingEnvironment()`. No other module reads `FREELAND_DISCOVERY`.

The initial project factory is:

```ts
export function createPlaywrightProjects(
  environment: StagingEnvironment,
): NonNullable<PlaywrightTestConfig['projects']> {
  const meshLaunch = environment.meshIp
    ? {
        launchOptions: {
          args: [`--host-resolver-rules=MAP mf0.forum ${environment.meshIp}`],
        },
      }
    : {};
  const chrome = {
    ...devices['Desktop Chrome'],
    baseURL: environment.baseURL,
    ...meshLaunch,
  };

  return [
    {
      name: 'freeland-staging-setup',
      testDir: './tests/playwright/freeland',
      testMatch: /auth\.setup\.ts/,
      metadata: {
        authFile: environment.chromiumAuthFile,
        expectedGitSha: environment.expectedGitSha,
      },
      use: chrome,
    },
    {
      name: 'freeland-staging',
      testDir: './tests/playwright/freeland',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['freeland-staging-setup'],
      metadata: { expectedGitSha: environment.expectedGitSha },
      use: { ...chrome, storageState: environment.chromiumAuthFile },
    },
  ];
}
```

- [ ] **Step 7: Add the repository exclusion boundary**

At minimum, `.gitignore` must exclude:

```gitignore
.env
.env.*
!.env.example
node_modules/
playwright/.auth/
test-results/
playwright-report/
artifacts/
evidence/
.work/
.product/
*.har
*.trace.zip
*.webm
*.log
.DS_Store
```

`.env.example` lists variable names only. It contains no values, production credential aliases, payment variables, or provider data.

- [ ] **Step 8: Run the focused and baseline checks**

Run:

```bash
npm run test:unit
npm run typecheck
git diff --check
```

Expected result: all pass.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .gitattributes .env.example README.md package.json package-lock.json tsconfig.json config packages/playwright-support tests/coverage/environment.test.ts playwright.config.ts
git commit -m "chore: bootstrap fail-closed Freeland QA repository"
```

---

### Task 2: Migrate the 164-Test Baseline Without Semantic Drift

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/access-control.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/api.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/app.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/auth-flows.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/auth.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/auth.setup.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/fixtures.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/freeman.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/helpers.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/i18n.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/landing.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/mail.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/marketing.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/pages/checkout.page.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/pages/store.page.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/pages/wallet.page.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/payments.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/products.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/purchase.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/pwa.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/referrals.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/responsive.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/sections.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/seo.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/settings-deep.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/smoke.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/support.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/telegram.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland/tma.spec.ts`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/playwright.config.ts`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/packages/playwright-support/src/projects.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/baseline-files.test.ts`

**Interfaces:**

- **Consumes:** the exact 29 source files under
  `NuanuFlowQA/tests/freeland`, `StagingEnvironment`, and Playwright project
  metadata.
- **Produces:** 29 tracked target files, one project-owned auth state, and the
  exact discovery inventory `164 tests / 24 test-or-setup files`.
- **Ownership:** authenticated project definitions own `use.storageState`;
  behavioral specs cannot import or set an auth-file constant.

```ts
export interface StagingCredentials {
  email: string;
  password: string;
}

export function resolveCreds(
  env: HarnessEnv,
): StagingCredentials;

export function requireProjectAuthFile(
  metadata: Readonly<Record<string, unknown>>,
  projectName: string,
): string;
```

`resolveCreds()` consumes only `FREELAND_STAGING_TEST_EMAIL` and
`FREELAND_STAGING_TEST_PASSWORD`. `auth.setup.ts` consumes
`testInfo.project.metadata.authFile` through `requireProjectAuthFile()` and
writes exactly that file. `StagingCredentials`, `resolveCreds()`, and
`requireProjectAuthFile()` are implemented and exported by
`packages/playwright-support/src/environment.ts`.

- [ ] **Step 1: Write a failing source-inventory test**

The test must assert the exact 29-file set and the exact test-bearing counts:

| Spec | Tests |
|---|---:|
| `access-control.spec.ts` | 14 |
| `api.spec.ts` | 6 |
| `app.spec.ts` | 10 |
| `auth-flows.spec.ts` | 22 |
| `auth.spec.ts` | 9 |
| `freeman.spec.ts` | 1 |
| `i18n.spec.ts` | 13 |
| `landing.spec.ts` | 10 |
| `mail.spec.ts` | 2 |
| `marketing.spec.ts` | 11 |
| `payments.spec.ts` | 3 |
| `products.spec.ts` | 10 |
| `purchase.spec.ts` | 3 |
| `pwa.spec.ts` | 3 |
| `referrals.spec.ts` | 3 |
| `responsive.spec.ts` | 11 |
| `sections.spec.ts` | 6 |
| `seo.spec.ts` | 6 |
| `settings-deep.spec.ts` | 4 |
| `smoke.spec.ts` | 1 |
| `support.spec.ts` | 3 |
| `telegram.spec.ts` | 3 |
| `tma.spec.ts` | 9 |

It must also require one setup test in `auth.setup.ts`.

- [ ] **Step 2: Run the test and prove the target suite is missing**

```bash
npx tsx --test tests/coverage/baseline-files.test.ts
```

Expected result: missing-file failure.

- [ ] **Step 3: Copy the ignored source suite mechanically**

Copy all 29 files from:

```text
/Users/danilsolomin/projectsnew/NuanuFlowQA/tests/freeland
```

to:

```text
/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/freeland
```

Do not copy any storage state, report, result, screenshot, trace, video, `.env`, or browser profile.

Copy through inventory-guarded batches; before each checkbox add its exact
target filenames to `baseline-files.test.ts`, prove the missing-file failure,
copy only that batch, and rerun:

- [ ] `fixtures.ts`, `helpers.ts`, and `pages/*.ts`;
- [ ] `auth.setup.ts`, `auth.spec.ts`, and `auth-flows.spec.ts`;
- [ ] `smoke.spec.ts`, `landing.spec.ts`, and `marketing.spec.ts`;
- [ ] `access-control.spec.ts`, `app.spec.ts`, and `sections.spec.ts`;
- [ ] `settings-deep.spec.ts`, `products.spec.ts`, `purchase.spec.ts`, and
      `payments.spec.ts`;
- [ ] `responsive.spec.ts`, `i18n.spec.ts`, `seo.spec.ts`, and `pwa.spec.ts`;
- [ ] `mail.spec.ts`, `support.spec.ts`, `referrals.spec.ts`,
      `telegram.spec.ts`, and `tma.spec.ts`;
- [ ] `freeman.spec.ts` and `api.spec.ts`.

- [ ] **Step 4: Remove the monorepo environment defects**

Make only these red/green changes before the first enumeration:

- [ ] add a source scan assertion for
      `test.skip(!process.env.FREELAND_BASE_URL`; prove it fails; remove those
      suite-level skips and rerun;
- [ ] add a scan assertion for `FREELAND_TEST_EMAIL` and
      `FREELAND_TEST_PASSWORD` in `app`, `responsive`, and `freeman`; remove
      only those direct gates and rerun;
- [ ] add staging-only credential unit cases; implement `resolveCreds(env)`
      with no production fallback and rerun `environment.test.ts`;
- [ ] add an assertion rejecting `FREELAND_AUTH_FILE` imports and local
      `test.use({ storageState`; remove them one file at a time, rerunning the
      scan after every file;
- [ ] add `requireProjectAuthFile()` failure/success cases; implement the
      helper and update `auth.setup.ts`;
- [ ] add project ownership assertions; set each authenticated project's
      `use.storageState` and `metadata.authFile`;
- [ ] add exact `testDir` assertions; point every project to
      `tests/playwright/freeland`;
- [ ] add unused-export scan assertions; remove only `FREELAND_AUTH_FILE`,
      `purchaseGate`, `PURCHASABLE_PRODUCTS`, and `PAYMENT_PROVIDERS`, retaining
      the dry pay-sheet gate;
- [ ] run an AST/source diff assertion that permits only the environment/path
      edits above and rejects changed assertions, visible titles, loops,
      `test.fail()` calls, page objects, and dry-checkout behavior.

The setup writes only the project metadata path:

```ts
setup('authenticate', async ({ page, baseURL }, testInfo) => {
  const authFile = requireProjectAuthFile(
    testInfo.project.metadata,
    testInfo.project.name,
  );
  await loginViaUi(page, baseURL);
  await expect(page.getByRole('button', { name: /выйти/i }).first()).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

Authenticated specs contain no auth-path import or local `test.use()`:

```ts
test.describe('Freeland sections (authenticated)', () => {
  test('store lists every product family', async ({ storePage }) => {
    await storePage.goto();
    await storePage.expectProductFamilies();
  });
});
```

- [ ] **Step 5: Prove the exact discovery inventory**

Run the baseline project in discovery mode with the list reporter. Do not launch a browser:

```bash
FREELAND_DISCOVERY=1 npx playwright test --project=freeland-staging --list
```

Expected final line:

```text
Total: 164 tests in 24 files
```

Also run:

```bash
npm run typecheck
npx tsx --test tests/coverage/baseline-files.test.ts
```

- [ ] **Step 6: Review the migration diff for unintended test changes**

Compare each migrated file with its source, ignoring only:

- the new target directory prefix;
- removed `FREELAND_BASE_URL` skips;
- removed production-credential gates/fallback;
- auth-path injection;
- removal of the unused live-purchase exports.

Any other semantic diff must be explained and split into a later task.

- [ ] **Step 7: Commit**

```bash
git add tests/playwright/freeland tests/coverage/baseline-files.test.ts playwright.config.ts packages/playwright-support
git commit -m "test: track the 164-case Freeland baseline"
```

---

### Task 3: Promote the Release Regressions and Sanitize the Authoritative Docs

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/regressions/direct-ingress.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/regressions/vpn-regression.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/regressions/semantic-responsive.spec.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/regressions/webkit-auth.setup.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/product-contracts/payment-ledger-regression.test.mjs`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/network/mesh-connect-proxy.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/security/migration-safety.test.ts`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/playwright.config.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/adr/0001-repository-and-data-boundary.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/history/2026-07-30-qa-verification.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/history/2026-07-31-staging-release-audit.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/safety/payment-safety-gate.md`

**Interfaces:**

- **Consumes:** the five audited ignored source files listed in Step 2 and
  `StagingEnvironment`. Product source is not imported or executed in this
  task.
- **Produces:** three behavioral discovery projects plus one WebKit setup
  project, one statically verified tagged Node contract source for later Task 6
  inventory capture, a loopback-only mesh proxy, and sanitized tracked
  documents.
- **Evidence boundary:** executable tests produce only Playwright
  `testInfo.outputPath()` files and attachments.

```ts
export interface MeshProxyOptions {
  listenHost: '127.0.0.1';
  listenPort: 43871;
  allowedHost: 'mf0.forum';
  allowedPort: 443;
  targetIp: string;
}

export function createAuxiliaryProjects(
  environment: StagingEnvironment,
): NonNullable<PlaywrightTestConfig['projects']>;

export function startMeshConnectProxy(
  options: MeshProxyOptions,
): Promise<{ close(): Promise<void> }>;

export function requireExpectedGitSha(
  metadata: Readonly<Record<string, unknown>>,
  projectName: string,
): string;
```

The project names are exactly `freeland-direct-ingress`,
`freeland-vpn-regression`, `freeland-webkit-setup`, and
`freeland-webkit-release`. Task 3 only parses the tagged Node contract source;
Task 8 and CI execute it only with `FREELAND_PRODUCT_ROOT` equal to the
verifier's returned `patchedWorktree`. Live Playwright projects receive the
candidate SHA through project metadata; discovery only enumerates them.
`createAuxiliaryProjects()` is implemented in
`packages/playwright-support/src/projects.ts`, including
`requireExpectedGitSha()`; `MeshProxyOptions` and
`startMeshConnectProxy()` are implemented in
`tools/network/mesh-connect-proxy.ts`.

The proxy implementation buffers only the CONNECT header, enforces the one
host/port tuple, and then becomes a byte pipe:

```ts
export async function startMeshConnectProxy(
  options: MeshProxyOptions,
): Promise<{ close(): Promise<void> }> {
  const server = createServer((client) => {
    let header = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      header = Buffer.concat([header, chunk]);
      if (header.length > 8192) {
        client.end('HTTP/1.1 431 Request Header Fields Too Large\r\n\r\n');
        return;
      }
      const boundary = header.indexOf('\r\n\r\n');
      if (boundary === -1) return;
      client.off('data', onData);
      const [requestLine] = header.subarray(0, boundary).toString('ascii').split('\r\n');
      const match = /^CONNECT ([^: ]+):([0-9]+) HTTP\/1\.[01]$/.exec(requestLine);
      if (
        match === null ||
        match[1] !== options.allowedHost ||
        Number(match[2]) !== options.allowedPort
      ) {
        client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      const upstream = connect(options.allowedPort, options.targetIp, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        const remainder = header.subarray(boundary + 4);
        if (remainder.length > 0) upstream.write(remainder);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
    };
    client.on('data', onData);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.listenPort, options.listenHost, resolve);
  });
  return {
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      ),
  };
}
```

The file imports `connect` and `createServer` from `node:net`; the CLI reads
only `FREELAND_STAGING_MESH_IP` through `loadStagingEnvironment()` and supplies
the remaining literal allowlist values from `MeshProxyOptions`.

- [ ] **Step 1: Write a failing migration-safety test**

Require every promoted test and tracked document to satisfy:

```text
no absolute path beginning with /Users/
no hardcoded mesh IP
no hardcoded auth/storage-state path
no default audited candidate SHA in executable code
no direct writes under docs/, evidence/, or the repository root
no committed screenshot/report/result path
no real email, token, password, PAN, CVV, checkout URL, or provider payload
```

The test must initially fail because the target files do not exist.

- [ ] **Step 2: Promote the four executable regressions**

Use these read-only source files:

```text
docs/local/freeland/staging-release-2026-07-31/direct-ingress.spec.ts
docs/local/freeland/staging-release-2026-07-31/vpn-regression.spec.ts
docs/local/freeland/staging-release-2026-07-31/webkit-audit/semantic-responsive.spec.ts
docs/local/freeland/staging-release-2026-07-31/webkit-audit/webkit-auth.setup.ts
docs/local/freeland/staging-release-2026-07-31/payment-ledger-regression.test.mjs
```

Refactor them as follows:

1. Require the expected candidate SHA from live environment loading; no fallback SHA.
2. Use `testInfo.outputPath()` and `testInfo.attach()` for generated evidence.
3. Use project-provided auth state and routing.
4. Keep public-ingress tests off mesh.
5. Keep VPN and authenticated WebKit tests on the explicitly configured mesh lane.
6. Remove the product contract's local fallback; Task 3 only parses its tags,
   while Task 8 supplies the absolute verified root for execution.
7. Preserve all expected-failure logic and ticket identifiers.

Promote one artifact per red/green checkpoint:

- [ ] add the direct-ingress file and `1 test` assertion; replace its SHA
      fallback and direct evidence writes; rerun migration safety plus the
      static source-count assertion;
- [ ] add the VPN file and `3 tests` assertion; inject mesh routing and
      attachment-only evidence; rerun migration safety plus its static
      source-count assertion;
- [ ] add the semantic-responsive file and exact `10 tests` assertion; replace
      repository writes with attachments; rerun migration safety;
- [ ] add WebKit setup and exact `1 setup` assertion; consume only
      `metadata.authFile`; rerun migration safety;
- [ ] add the Node contract and exact `1 tagged node:test` assertion; require
      absolute `FREELAND_PRODUCT_ROOT` in its runtime guard; rerun migration
      safety and a static AST tag/count assertion without importing product
      source or constructing `TestInventory`.

Replace direct repository writes with attachments:

```ts
const screenshot = await page.screenshot({ fullPage: true });
await testInfo.attach('responsive-screenshot', {
  body: screenshot,
  contentType: 'image/png',
});
```

Require, rather than default, the candidate:

```ts
const expectedGitSha = requireExpectedGitSha(
  testInfo.project.metadata,
  testInfo.project.name,
);
```

- [ ] **Step 3: Integrate auxiliary discovery projects**

The unified config must enumerate:

```text
direct-ingress: 1 test in 1 file
vpn-regression: 3 tests in 1 file
webkit-release: 36 tests including setup
```

The WebKit total is exactly:

```text
setup 1
smoke 1
responsive 11
access-control 13
semantic regression 10
total 36
```

Exclude only the `ACL-05`/`FREEL-169` access-control check from this WebKit
selection because its current assertion can expose an operator allowlist in
failure evidence. Before stable tags exist, exclude by exact `ACL-05` title;
after Task 6, exclude by its stable check tag. The Chromium regression remains
tracked. Engine/viewport variants do not create duplicate coverage credit.

The release project selection is concrete:

```ts
{
  name: 'freeland-webkit-release',
  testDir: './tests',
  testMatch: [
    /playwright\/freeland\/(smoke|responsive|access-control)\.spec\.ts/,
    /playwright\/regressions\/semantic-responsive\.spec\.ts/,
  ],
  grepInvert: /ACL-05 waitlist operator portal/,
  dependencies: ['freeland-webkit-setup'],
  use: {
    ...devices['Desktop Safari'],
    baseURL: environment.baseURL,
    proxy: { server: 'http://127.0.0.1:43871' },
    storageState: environment.webkitAuthFile,
  },
}
```

The config starts `npx tsx tools/network/mesh-connect-proxy.ts` as a Playwright
`webServer` only in live mode. The proxy rejects every CONNECT host except
`mf0.forum:443` and routes that one host to `FREELAND_STAGING_MESH_IP`; it has
no generic forward-proxy behavior.

The one Node product-contract test is not a Playwright project and must not be
claimed by Playwright enumeration. It is inventoried separately and executed
only when `FREELAND_PRODUCT_ROOT` points to the disposable product checkout.

Build the project factory in focused checkpoints:

- [ ] add and pass direct-ingress project-name/count assertions;
- [ ] add and pass VPN project-name/count/mesh assertions;
- [ ] add and pass WebKit setup dependency/auth-path assertions;
- [ ] add and pass expected-SHA metadata assertions for every live auxiliary
      project; no regression module reads process environment directly;
- [ ] add and pass the smoke/responsive selection assertions;
- [ ] add and pass the exact 13 access-control selection assertion with
      `ACL-05` excluded;
- [ ] add and pass the exact 10 semantic selection assertion;
- [ ] add and pass the total `36 including setup` assertion;
- [ ] add a rejected-host socket test; implement the loopback CONNECT proxy;
- [ ] add an allowed-host target test; route only `mf0.forum:443` to the
      configured mesh IP;
- [ ] add discovery/live webServer assertions; start the proxy only in live
      mode.

- [ ] **Step 4: Create sanitized historical documents**

Derive, do not copy verbatim:

- `QA-VERIFICATION.md` into the 2026-07-30 historical report;
- `RELEASE-REPORT.md` into the 2026-07-31 historical report;
- `PAYMENT-SAFETY-GATE.md` into the permanent safety document;
- the repository/data boundary from the approved design.

Remove internal network addresses, absolute paths, run IDs, checkout IDs, account details, attachment payloads, and stale instructions. Mark both dated reports as historical snapshots that cannot represent current QA.

Create documents one at a time. Before each file, add its expected path and
forbidden-content checks to `migration-safety.test.ts`, prove the
missing-file failure, write the sanitized document, and rerun:

- [ ] repository/data-boundary ADR;
- [ ] 2026-07-30 historical QA report;
- [ ] 2026-07-31 historical staging-release report;
- [ ] permanent payment safety gate;
- [ ] explicit denylist assertion for every path class below.

Do not migrate:

```text
SESSION-CONTEXT-2026-07-30-pay-sheet.md
staging-handoffs/
qa-column-2026-07-30/live-probe.json
any PNG or JPG
webkit-audit/evidence/
HTML reports
Playwright result JSON
error-context files
```

- [ ] **Step 5: Run the focused checks**

```bash
npx tsx --test tests/security/migration-safety.test.ts
FREELAND_DISCOVERY=1 npx playwright test --project=freeland-direct-ingress --list
FREELAND_DISCOVERY=1 npx playwright test --project=freeland-vpn-regression --list
FREELAND_DISCOVERY=1 npx playwright test --project=freeland-webkit-release --list
npm run typecheck
git diff --check
```

The product-contract check parses source only and does not import product code.
No live test command is allowed.

- [ ] **Step 6: Commit**

```bash
git add tests/playwright/regressions tests/product-contracts tests/security/migration-safety.test.ts tools/network playwright.config.ts docs
git commit -m "test: promote sanitized Freeland release regressions"
```

---

### Task 4: Define the Versioned Coverage Contracts

**Files:**

- Create: all files under `/Users/danilsolomin/projectsnew/FreelandQA/packages/contracts/`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/registry.v1.yaml`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/validate-registry.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/render-report.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/registry-validation.test.ts`

**Interfaces:**

- **Consumes:** repository root, lexical YAML requirement/ticket files, and the
  two committed test-inventory JSON files.
- **Produces:** a typed `CoverageRegistry`, sorted validation diagnostics, and
  the deterministic writer for the later canonical
  `coverage/bootstrap/coverage-report.v1.json`; Task 6 creates the first
  tracked report after nonzero inventories exist.

```ts
export interface ValidationIssue {
  code: string;
  file: string;
  pointer: string;
  message: string;
}

export interface CoverageRegistry {
  requirements: CoverageRequirement[];
  tickets: TicketMapping[];
  baseline: TestInventory;
  auxiliary: AuxiliaryInventory;
}

export interface CoverageRegistryIndex {
  schemaVersion: 1;
  requirementDirectory: 'coverage/requirements';
  ticketDirectory: 'coverage/tickets';
  baselineInventory: 'coverage/bootstrap/playwright-164.v1.json';
  auxiliaryInventory: 'coverage/bootstrap/playwright-auxiliary.v1.json';
  generatedReport: 'coverage/bootstrap/coverage-report.v1.json';
}

export interface CoverageReport {
  schemaVersion: 1;
  generatedFromSha256: string;
  requirements: Record<LifecycleStatus, number>;
  checks: Record<CheckResultPolicy, number>;
  stability: Record<CheckStability, number>;
  outcomes: Record<ObservedOutcomeStatus, number>;
  promotionEligible: number;
  promotionIneligible: number;
  missing: number;
  blocked: number;
}

export function loadCoverageRegistry(root: string): Promise<CoverageRegistry>;
export function validateCoverageRegistry(
  registry: CoverageRegistry,
): ValidationIssue[];
export function renderCoverageReport(
  registry: CoverageRegistry,
): CoverageReport;
export function writeCanonicalCoverageReport(
  report: CoverageReport,
  outputPath: string,
): Promise<void>;
```

`CoverageRequirement` is exported from
`packages/contracts/src/coverage.ts`; `TicketMapping` is exported from
`packages/contracts/src/nuanu.ts`; `TestInventory` is exported from
`packages/contracts/src/test-inventory.ts`. All are re-exported by
`packages/contracts/src/index.ts`.

Track this exact root index:

```yaml
schemaVersion: 1
requirementDirectory: coverage/requirements
ticketDirectory: coverage/tickets
baselineInventory: coverage/bootstrap/playwright-164.v1.json
auxiliaryInventory: coverage/bootstrap/playwright-auxiliary.v1.json
generatedReport: coverage/bootstrap/coverage-report.v1.json
```

Task 4 implements and fixture-tests report generation but does not create the
tracked report because the nonzero baseline/auxiliary inventories do not exist
until Task 6. `--requirements-only` validates requirement schemas/graphs
without loading inventories, tickets, or a generated report. Full validation
remains fail-closed and is first legal after Task 6 writes all three.

- [ ] **Step 1: Write failing lifecycle and cross-reference tests**

Cover at least:

```ts
test('accepts exactly AUTOMATED, CANDIDATE, BLOCKED, INAPPLICABLE, MISSING');
test('rejects BLOCKED without reason, owner, firstSeenAt, retryPolicy, and expiresAt');
test('rejects INAPPLICABLE without candidate evidence and expiresAt');
test('rejects MISSING without reason, owner, and proposedCheck');
test('rejects AUTOMATED when an assertion or required lane has no authoritative check');
test('rejects promotion credit for expected-fail, conditional-fail, skipped, or flaky checks');
test('requires stability and observed outcome for every check');
test('rejects PASS without timestamped authoritative evidence');
test('keeps discovery outcomes NOT_RUN and promotion-ineligible');
test('rejects requirement/inventory execution metadata drift by check ID');
test('groups repeated logical check IDs across baseline and WebKit occurrences without double credit');
test('rejects duplicate requirement/check bindings and conflicting logical check or stable-tag reuse');
test('rejects an unknown requirement or ticket reverse reference');
test('rejects a zero-sized Playwright inventory');
test('rejects a QA ticket mapping that is neither mapped nor explicitly missing');
test('requires payment profile/outcome when a payment external effect is declared');
test('requires authoritative assertion source, cleanup, route, and transport data');
```

Add exactly one failing fixture/test per micro-cycle:

- [ ] lifecycle enum;
- [ ] complete `BLOCKED`;
- [ ] complete `INAPPLICABLE`;
- [ ] complete `MISSING`;
- [ ] authoritative `AUTOMATED`;
- [ ] non-pass promotion credit;
- [ ] stability/outcome presence;
- [ ] evidenced `PASS`;
- [ ] discovery `NOT_RUN`;
- [ ] requirement/inventory metadata equality;
- [ ] cross-leaf logical-ID grouping and occurrence de-duplication;
- [ ] composite binding uniqueness and logical ID/tag consistency;
- [ ] reverse references;
- [ ] zero inventory;
- [ ] QA mapped-or-missing;
- [ ] payment profile/outcome conditional;
- [ ] assertion source/cleanup/routes/transports.

- [ ] **Step 2: Run and prove the tests fail**

```bash
npx tsx --test tests/coverage/registry-validation.test.ts
```

- [ ] **Step 3: Implement shared TypeScript contracts**

Implement one contract per focused failing assertion:

- [ ] add a lifecycle-union assertion; create `coverage.ts` with the exact
      lifecycle and result-policy unions below;
- [ ] add a minimum requirement-shape assertion; add
      `CoverageRequirement`;
- [ ] add registry/report assignment assertions; add `ValidationIssue`,
      `CoverageRegistry`, and `CoverageReport`;
- [ ] add an inventory assignment assertion; create `test-inventory.ts` with
      `InventoryCheck`, `TestInventory`, `PlaywrightReviewDocument`, and its
      entry type;
- [ ] add a Nuanu assignment assertion; create `nuanu.ts` with
      `NuanuQaSnapshot` and `TicketMapping`;
- [ ] add a patch assignment assertion; create `patchset.ts` with
      `PatchManifest`, `ExportResult`, `PatchVerification`, and
      `DriftVerification`;
- [ ] add an acceptance assignment assertion; create `acceptance.ts` with
      `SubprojectAcceptance`;
- [ ] add an export-surface assertion; create `index.ts` with explicit
      `export *` statements for the five modules.

Use these core unions in `coverage.ts`:

```ts
export const LIFECYCLE_STATUSES = [
  'AUTOMATED',
  'CANDIDATE',
  'BLOCKED',
  'INAPPLICABLE',
  'MISSING',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type CheckResultPolicy =
  | 'MUST_PASS'
  | 'EXPECTED_FAIL'
  | 'CONDITIONAL_EXPECTED_FAIL'
  | 'MAY_SKIP'
  | 'DIAGNOSTIC'
  | 'SUPPORT';

export type CheckStability = 'STABLE' | 'FLAKY' | 'UNKNOWN';

export type ObservedOutcomeStatus =
  | 'NOT_RUN'
  | 'PASS'
  | 'FAIL'
  | 'EXPECTED_FAIL'
  | 'SKIPPED'
  | 'FLAKY';

export type ObservedOutcome =
  | { status: 'NOT_RUN' }
  | {
      status: Exclude<ObservedOutcomeStatus, 'NOT_RUN'>;
      observedAt: string;
      evidenceRef: string;
    };

export type TicketResolution = 'mapped' | 'missing';
```

A requirement record must include:

```ts
export interface CoverageRequirement {
  schemaVersion: 1;
  id: string;
  title: string;
  risk: 'P0' | 'P1' | 'P2' | 'P3' | 'UNASSESSED';
  areas: string[];
  surfaces: string[];
  lanes: { required: string[] };
  variants: {
    locales: string[];
    engines: string[];
    viewports: string[];
    routes: string[];
    transports: Array<'public' | 'mesh' | 'telegram-web' | 'none'>;
  };
  personas: string[];
  preconditions: string[];
  dependencies: string[];
  externalEffects: Array<{
    kind: 'payment' | 'crm' | 'analytics' | 'email' | 'telegram' | 'none';
    expectation: string;
  }>;
  authoritativeAssertionSource: {
    kind: 'ticket-acceptance' | 'product-contract' | 'approved-qa-contract';
    ref: string;
    revision: string;
  };
  assertions: Array<{ id: string; text: string; oracle: string }>;
  checks: Array<{
    id: string;
    kind: 'playwright' | 'api' | 'contract' | 'computer-use' | 'manual';
    stableTag?: string;
    file: string;
    assertionIds: string[];
    resultPolicy: CheckResultPolicy;
    stability: CheckStability;
    observedOutcome: ObservedOutcome;
  }>;
  lifecycle: {
    status: LifecycleStatus;
    reason?: string;
    owner?: string;
    firstSeenAt?: string;
    retryPolicy?: string;
    expiresAt?: string;
    proposedCheck?: string;
    candidateEvidence?: string;
  };
  cleanup: string;
  paymentProfile?: string;
  paymentOutcome?: {
    expectedCheckoutCount: number;
    expectedSubmittedPaymentCount: number;
    expectedChargeCount: number;
    expectedRefundCount: number;
    expectedTerminalState: string;
  };
  ticketRefs: string[];
  review: {
    owner: string;
    revision: number;
    reviewedAt: string;
  };
  legacy?: {
    source: string;
    row: number;
    statusText: string;
    signals: Array<'CHECK' | 'MANUAL' | 'BLOCKED' | 'FAILURE' | 'UNCLASSIFIED'>;
  };
}
```

`test-inventory.ts`, `nuanu.ts`, and `patchset.ts` use exactly the exported
interfaces shown in Tasks 6, 7, and 8. They are created here, then consumed by
those tools later; no duplicate local interface declarations are permitted.

Add schemas one at a time, each preceded by an invalid YAML/JSON fixture and a
focused Ajv assertion:

- [ ] `coverage-requirement.v1.schema.json`;
- [ ] `legacy-matrix-inventory.v1.schema.json`;
- [ ] `legacy-matrix-map.v1.schema.json`;
- [ ] `test-inventory.v1.schema.json`;
- [ ] `auxiliary-inventory.v1.schema.json`;
- [ ] `ticket-mapping.v1.schema.json`;
- [ ] `nuanu-snapshot.v1.schema.json`;
- [ ] `patchset-manifest.v1.schema.json`;
- [ ] `playwright-review-map.v1.schema.json`;
- [ ] `subproject-acceptance.v1.schema.json`;
- [ ] `coverage-registry.v1.schema.json`;
- [ ] `coverage-report.v1.schema.json`.

Drive all twelve files from this exact schema-surface test rather than writing
open-ended schemas:

```ts
const SCHEMA_SURFACES = {
  'coverage-requirement.v1.schema.json': {
    required: [
      'schemaVersion', 'id', 'title', 'risk', 'areas', 'surfaces', 'lanes',
      'variants', 'personas', 'preconditions', 'dependencies',
      'externalEffects', 'authoritativeAssertionSource', 'assertions', 'checks',
      'lifecycle', 'cleanup', 'ticketRefs', 'review',
    ],
    optional: ['paymentProfile', 'paymentOutcome', 'legacy'],
    closed: [
      '', '/lanes', '/variants', '/externalEffects/items',
      '/authoritativeAssertionSource', '/assertions/items', '/checks/items',
      '/checks/items/observedOutcome', '/lifecycle', '/paymentOutcome',
      '/review', '/legacy',
    ],
  },
  'legacy-matrix-inventory.v1.schema.json': {
    required: [
      'schemaVersion', 'sourceSha256', 'rows', 'blocked', 'candidate',
      'missing', 'ids',
    ],
    optional: [],
    closed: [''],
  },
  'legacy-matrix-map.v1.schema.json': {
    required: ['schemaVersion', 'source', 'entries'],
    optional: [],
    closed: ['', '/entries/items'],
  },
  'test-inventory.v1.schema.json': {
    required: [
      'schemaVersion', 'kind', 'setup', 'behavioral', 'total', 'sourceFiles',
      'checks',
    ],
    optional: [],
    closed: [
      '', '/checks/items', '/checks/items/occurrences/items',
      '/checks/items/occurrences/items/variants',
      '/checks/items/observedOutcome',
    ],
  },
  'auxiliary-inventory.v1.schema.json': {
    required: ['schemaVersion', 'playwright', 'productContract'],
    optional: [],
    closed: ['', '/playwright'],
  },
  'ticket-mapping.v1.schema.json': {
    required: [
      'schemaVersion', 'ticketKey', 'issueId', 'source', 'resolution',
      'acceptanceClauses', 'review',
    ],
    optional: ['missing'],
    closed: [
      '', '/source', '/acceptanceClauses/items', '/missing', '/review',
    ],
  },
  'nuanu-snapshot.v1.schema.json': {
    required: [
      'schemaVersion', 'capturedAt', 'workspace', 'project', 'stateId',
      'stateRevision', 'stateName', 'membershipSha256', 'issues',
    ],
    optional: [],
    closed: ['', '/issues/items'],
  },
  'patchset-manifest.v1.schema.json': {
    required: [
      'schemaVersion', 'id', 'status', 'source', 'patches',
      'expectedNameStatus', 'upstream', 'knownGaps',
    ],
    optional: [],
    closed: [
      '', '/source', '/patches/items', '/expectedNameStatus/items', '/upstream',
    ],
  },
  'playwright-review-map.v1.schema.json': {
    required: ['schemaVersion', 'entries'],
    optional: [],
    closed: ['', '/entries/items', '/entries/items/observedOutcome'],
  },
  'subproject-acceptance.v1.schema.json': {
    required: [
      'schemaVersion', 'repositoryCommit', 'toolVersions', 'inventory',
      'qaSnapshot', 'patch', 'securityScan', 'writes',
    ],
    optional: [],
    closed: [
      '', '/toolVersions', '/inventory', '/qaSnapshot', '/patch', '/writes',
    ],
  },
  'coverage-registry.v1.schema.json': {
    required: [
      'schemaVersion', 'requirementDirectory', 'ticketDirectory',
      'baselineInventory', 'auxiliaryInventory', 'generatedReport',
    ],
    optional: [],
    closed: [''],
  },
  'coverage-report.v1.schema.json': {
    required: [
      'schemaVersion', 'generatedFromSha256', 'requirements', 'checks',
      'stability', 'outcomes', 'promotionEligible', 'promotionIneligible',
      'missing', 'blocked',
    ],
    optional: [],
    closed: ['', '/requirements', '/checks', '/stability', '/outcomes'],
  },
} as const;

for (const [file, contract] of Object.entries(SCHEMA_SURFACES)) {
  test(`${file} has the exact closed property surface`, async () => {
    const schema = await loadSchema(file);
    assert.deepEqual(
      Object.keys(schema.properties).toSorted(),
      [...contract.required, ...contract.optional].toSorted(),
    );
    assert.deepEqual(schema.required.toSorted(), [...contract.required].toSorted());
    for (const pointer of contract.closed) {
      assert.equal(resolveJsonPointer(schema, pointer).additionalProperties, false);
    }
    assert.equal(ajv.compile(schema) !== undefined, true);
  });
}
```

For every property named above, add one wrong-type fixture before its schema
property. The lifecycle tests in Step 1 define the exact conditional branches;
both requirement-check and inventory-check schemas require `stability` plus a
closed `observedOutcome` object. Every non-`NOT_RUN` status requires non-empty
`observedAt` and `evidenceRef`; `NOT_RUN` forbids both. The schema implements
those branches as an exact `oneOf`, matching the `ObservedOutcome`
discriminated union. The payment test additionally requires an `if` on an external effect whose
`kind` is `payment` and a `then.required` containing exactly
`paymentProfile,paymentOutcome`. Ajv runs with
`{ strict: true, allErrors: true }`, so empty/open nested objects cannot pass
the surface tests.

The inventory-check schema requires exactly `id`, `file`, `titleSha256`,
`requirementIds`, `resultPolicy`, `stability`, `observedOutcome`, and
`occurrences`. `occurrences` has `minItems: 1`; every item requires exactly
`project` and `variants`; and `variants` requires exactly `engine`, `viewport`,
and `transport`. `titleSha256` is 64 lowercase hexadecimal characters.
Schema `uniqueItems` rejects byte-identical occurrence objects, while the
runtime logical grouping validator rejects semantically duplicate tuples
across inventory leaves.

The YAML files are authoritative. JSON Schemas validate runtime input; TypeScript types validate implementation code. Tests must load representative YAML through Ajv and assign the parsed result to the corresponding TypeScript interface after validation.

Schema conditionals must require `paymentProfile` and `paymentOutcome` whenever
`externalEffects` contains `kind: payment`, and forbid those fields from being
interpreted as authorization to execute a payment. `DIAGNOSTIC` checks are
reviewed inventory with zero coverage or promotion credit.

- [ ] **Step 4: Implement canonical registry loading**

Implement the registry pipeline as separate red/green checkpoints:

- [ ] add a lexical-order fixture; implement `globYaml()` and
      `loadYamlFile()`;
- [ ] add malformed YAML/JSON fixtures; implement `loadJsonFile()` and
      schema dispatch;
- [ ] add duplicate requirement/binding and conflicting logical-ID/tag
      fixtures; implement
      `validateUniqueIds()`;
- [ ] add missing dependency and cycle fixtures; implement
      `validateRequirementGraph()`;
- [ ] add one-sided ticket/requirement fixtures; implement
      `validateTicketReverseLinks()`;
- [ ] add expected-fail/skip/diagnostic credit fixtures; implement
      `validateCheckPolicies()`;
- [ ] add flaky/unknown and evidenced-outcome fixtures; include stability and
      outcome in `validateCheckPolicies()`;
- [ ] add mismatched file/policy/stability/outcome fixtures; implement
      `validateCheckInventoryJoin()`;
- [ ] add a baseline-plus-WebKit fixture that repeats one logical check ID;
      implement `groupInventoryChecks()` so invariant metadata must match and
      occurrence tuples must be unique;
- [ ] add empty inventory fixtures; implement `validateNonZeroInventory()`;
- [ ] add unordered issue fixtures; implement stable
      `compareValidationIssues()`;
- [ ] add an aggregate report fixture; implement
      `countWithoutConvertingNonPassPoliciesToPass()` with separate lifecycle,
      policy, stability, and outcome counts;
- [ ] add a stale-report fixture; implement
      `writeCanonicalCoverageReport()` and check mode;
- [ ] add a captured-output assertion; print only aggregate counts and
      file-scoped errors;
- [ ] add CLI exit-code assertions for schema, reference, stale-output, and
      zero-test failures.

Use one explicit pipeline:

```ts
export async function loadCoverageRegistry(root: string): Promise<CoverageRegistry> {
  const index = await loadYamlFile<CoverageRegistryIndex>(
    `${root}/coverage/registry.v1.yaml`,
  );
  assertValidSchema('coverage-registry.v1', index);
  const requirementPaths = await globYaml(`${root}/${index.requirementDirectory}`);
  const ticketPaths = await globYaml(`${root}/${index.ticketDirectory}`);
  return {
    requirements: await Promise.all(requirementPaths.map(loadYamlFile)),
    tickets: await Promise.all(ticketPaths.map(loadYamlFile)),
    baseline: await loadJsonFile(`${root}/${index.baselineInventory}`),
    auxiliary: await loadJsonFile(`${root}/${index.auxiliaryInventory}`),
  };
}

export function validateCoverageRegistry(registry: CoverageRegistry): ValidationIssue[] {
  return [
    ...validateSchemas(registry),
    ...validateUniqueIds(registry),
    ...validateRequirementGraph(registry),
    ...validateTicketReverseLinks(registry),
    ...validateCheckPolicies(registry),
    ...validateCheckInventoryJoin(registry),
    ...validateNonZeroInventory(registry),
  ].sort(compareValidationIssues);
}

export function renderCoverageReport(registry: CoverageRegistry): CoverageReport {
  return countWithoutConvertingNonPassPoliciesToPass(registry);
}
```

Execution metadata has one canonical reporting source: the committed
`TestInventory` leaves under `registry.baseline` and `registry.auxiliary`.
Requirement-side check records are binding projections. For every executable
`playwright`, `api`, or `contract` check ID,
`groupInventoryChecks()` first combines all baseline and auxiliary leaves by
logical `id`. Repeated IDs are required for selected reruns such as the WebKit
release lane. Every record in a logical group must have exact equality of
`file`, `titleSha256`, `requirementIds`, `resultPolicy`, `stability`, and
`observedOutcome`; every `(project, engine, viewport, transport)` occurrence
tuple must be unique. `validateCheckInventoryJoin()` then requires exactly one
logical group and exact equality of the projection's `file`, the sorted set of
requirement IDs derived from all requirements that bind that check,
`resultPolicy`, `stability`, and `observedOutcome`. Requirement-side identity
is the composite `(requirement.id, check.id)`: duplicates inside one
requirement are rejected, while the same logical check may bind multiple
requirements only when `stableTag`, `file`, `resultPolicy`, `stability`, and
`observedOutcome` agree. A stable tag maps one-to-one to a logical check ID.
Unmatched, conflicting, or duplicate-occurrence projections fail validation.
Manual/computer-use proposals are not execution inventory and receive no
check/outcome counts.
`countWithoutConvertingNonPassPoliciesToPass()` counts each logical ID once,
so WebKit/viewport reruns and requirement projections cannot double-count or
override an outcome. Raw leaf `setup`, `behavioral`, and `total` values remain
occurrence counts and are validated separately from logical coverage credit.

`globYaml`, `loadYamlFile`, `loadJsonFile`, and every validator named above are
defined in `tools/coverage/validate-registry.ts`; `groupInventoryChecks()` is a
private helper in the same file. They are not deferred names.

- [ ] **Step 5: Make the focused tests pass**

```bash
npx tsx --test tests/coverage/registry-validation.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/contracts coverage/registry.v1.yaml tools/coverage/validate-registry.ts tools/coverage/render-report.ts tests/coverage/registry-validation.test.ts
git commit -m "feat: define versioned Freeland coverage contracts"
```

---

### Task 5: Import All 161 Legacy Matrix Rows Conservatively

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/sources/TEST-CASES-2026-07-07.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/matrix-161.v1.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/sources/legacy-matrix-map.v1.yaml`
- Create: 161 deterministic files under `/Users/danilsolomin/projectsnew/FreelandQA/coverage/requirements/legacy/`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/import-matrix.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/fixtures/legacy-statuses.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/import-matrix.test.ts`

**Interfaces:**

- **Consumes:** sanitized Markdown source text plus an injected deterministic
  `reviewAt` timestamp used to derive review deadlines.
- **Produces:** 161 `CoverageRequirement` YAML files, one source map, and one
  canonical bootstrap inventory; no record is promoted to `AUTOMATED`.

```ts
export type LegacySignal =
  | 'CHECK'
  | 'MANUAL'
  | 'BLOCKED'
  | 'FAILURE'
  | 'UNCLASSIFIED';

export interface LegacyMatrixRow {
  id: string;
  title: string;
  section: string;
  sourceRow: number;
  statusText: string;
}

export interface LegacyImportOptions {
  source: string;
  reviewAt: string;
}

export interface LegacyMatrixInventory {
  schemaVersion: 1;
  sourceSha256: string;
  rows: 161;
  blocked: number;
  candidate: number;
  missing: number;
  ids: string[];
}

export interface LegacyMatrixMap {
  schemaVersion: 1;
  source: 'coverage/sources/TEST-CASES-2026-07-07.md';
  entries: Array<{
    id: string;
    sourceRow: number;
    requirementFile: string;
    signals: LegacySignal[];
  }>;
}

export function parseLegacyMatrix(markdown: string): LegacyMatrixRow[];
export function classifyLegacySignals(statusText: string): LegacySignal[];
export function normalizeLegacyRow(
  row: LegacyMatrixRow,
  options: LegacyImportOptions,
): CoverageRequirement;
export function importLegacyMatrix(
  markdown: string,
  options: LegacyImportOptions,
): CoverageRequirement[];
```

CLI boundary:
`import-matrix.ts --source coverage/sources/TEST-CASES-2026-07-07.md --review-at
2026-08-07T00:00:00Z --write`.
The four legacy interfaces above are exported from
`packages/contracts/src/coverage.ts`; parsing, normalization, and CLI functions
are implemented in `tools/coverage/import-matrix.ts`.

- [ ] **Step 1: Write the importer tests before the importer**

The fixture must exercise:

```text
plain ✅
✅ with an explicit spec
✅ partial
✅ manual
✅ expected-fail
🖐 manual
⛔ blocked
✗ observed failure
unmarked product-profile text
```

Required behavior:

1. Preserve exact source ID, title, row, section, and raw status text.
2. Reject duplicate IDs and malformed Markdown tables.
3. Never infer a passing result from `✅`.
4. Import plain automated-looking rows as `CANDIDATE` until a reviewed check binding exists.
5. Import expected-fail rows as `CANDIDATE` with non-pass execution policy.
6. Import partial/manual/observed-failure/unmarked rows as `MISSING`.
7. Import blocked-only and mixed blocked rows as `BLOCKED` with all source
   signals, the source reason, and an explicit review deadline.
8. Generate deterministic filenames from lowercase case IDs.

Add one fixture row and one focused assertion per micro-cycle:

- [ ] exact source-field preservation;
- [ ] duplicate/malformed rejection;
- [ ] no pass inference from check marks;
- [ ] automated-looking row → `CANDIDATE`;
- [ ] expected-fail row → non-pass `CANDIDATE`;
- [ ] partial/manual/failure/unmarked → `MISSING`;
- [ ] blocked-only/mixed → expiring `BLOCKED`;
- [ ] deterministic lowercase filename.

- [ ] **Step 2: Run the tests and prove they fail**

```bash
npx tsx --test tests/coverage/import-matrix.test.ts
```

- [ ] **Step 3: Sanitize and track the matrix source**

Use inventory-first micro-cycles:

- [ ] add a missing-source assertion; copy only table headings and the first
      section, sanitize it, and make that section count pass;
- [ ] repeat one section at a time, adding its expected ID/count before its
      sanitized rows;
- [ ] add forbidden-value assertions for account aliases, run identifiers,
      local paths, and stale instructions;
- [ ] add the final exact `161 unique IDs` assertion.

Preserve all raw status cells because they are migration evidence; sanitize
only surrounding account/path/instruction text.

- [ ] **Step 4: Implement deterministic parsing and generation**

Implement in red/green units:

- [ ] add a header/table-boundary fixture; implement `parseMarkdownTables()`;
- [ ] add exact ID/title/section/row/status assertions; implement
      `parseLegacyMatrix()`;
- [ ] add duplicate/malformed fixtures; reject them before classification;
- [ ] add one fixture per `LegacySignal`; implement
      `classifyLegacySignals()`;
- [ ] add lifecycle precedence table tests; implement
      `lifecycleForLegacyRow()`;
- [ ] add deterministic deadline assertion; implement `normalizeLegacyRow()`
      with the injected `reviewAt`;
- [ ] add filename/order assertion; implement
      `requirementPathForLegacyId()` and lexical sorting;
- [ ] add canonical YAML snapshot assertion; implement stable YAML rendering;
- [ ] add dry-run diff assertion; implement CLI check mode;
- [ ] add write-mode fixture in a temporary root; implement atomic writes;
- [ ] add complete-catalog count assertions; generate the source map,
      bootstrap JSON, and 161 YAML records;
- [ ] run write mode twice and assert no second-run file or byte diff.

The importer must produce:

```text
161 unique bootstrap records
161 requirement YAML files
0 AUTOMATED requirements before reviewed binding
12 BLOCKED requirements: 10 blocked-only plus 2 mixed rows
all other rows represented as CANDIDATE or MISSING
```

The two mixed rows are `PUR-10` (check+blocked) and `STORE-10`
(manual+blocked). Preserve both component signals in `legacy.signals`, but use
the conservative `BLOCKED` lifecycle until every blocking assertion is
resolved. For all 12 blocked outcomes, use `owner: qa`,
`retryPolicy: prerequisite-change-or-weekly-review`, and an explicit near-term
`expiresAt` that forces review rather than allowing a permanent block. The
imported requirement remains promotion-ineligible.

The classifier precedence is explicit:

```ts
export function classifyLegacySignals(statusText: string): LegacySignal[] {
  const signals: LegacySignal[] = [];
  if (statusText.includes('✅')) signals.push('CHECK');
  if (statusText.includes('🖐')) signals.push('MANUAL');
  if (statusText.includes('⛔')) signals.push('BLOCKED');
  if (statusText.includes('✗')) signals.push('FAILURE');
  if (signals.length === 0) signals.push('UNCLASSIFIED');
  return signals;
}

export function lifecycleForLegacyRow(
  statusText: string,
  signals: LegacySignal[],
): LifecycleStatus {
  if (signals.includes('BLOCKED')) return 'BLOCKED';
  if (
    signals.includes('MANUAL') ||
    signals.includes('FAILURE') ||
    signals.includes('UNCLASSIFIED') ||
    /частично|вручную|опционально/i.test(statusText)
  ) {
    return 'MISSING';
  }
  return 'CANDIDATE';
}
```

The generator body is concrete and has no implicit clock:

```ts
export function importLegacyMatrix(
  markdown: string,
  options: LegacyImportOptions,
): CoverageRequirement[] {
  const rows = parseLegacyMatrix(markdown);
  assertUnique(rows.map((row) => row.id), 'legacy case ID');
  return rows
    .map((row) => normalizeLegacyRow(row, options))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}
```

- [ ] **Step 5: Generate, validate, and inspect the diff**

```bash
npm run coverage:import-matrix
npx tsx --test tests/coverage/import-matrix.test.ts
npm run coverage:validate:requirements
git diff --check
```

Run the importer twice and require no second-run diff.

- [ ] **Step 6: Commit**

```bash
git add coverage/sources coverage/bootstrap/matrix-161.v1.json coverage/requirements/legacy tools/coverage/import-matrix.ts tests/coverage
git commit -m "feat: normalize the 161-case legacy matrix"
```

---

### Task 6: Give Every Playwright Test a Stable Identity and Reviewed Coverage Binding

**Files:**

- Modify: all test-bearing files under `/Users/danilsolomin/projectsnew/FreelandQA/tests/playwright/`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/playwright-164.v1.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/playwright-auxiliary.v1.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/coverage-report.v1.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/sources/playwright-map.v1.yaml`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/capture-playwright.ts`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/render-report.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/fixtures/playwright-list.json`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/registry-validation.test.ts`

**Interfaces:**

- **Consumes:** discovery-only Playwright JSON reporter output, the tagged
  product-contract source, and reviewed committed inventories.
- **Produces:** canonical `TestInventory` documents and sorted validation
  issues; it never executes a browser or product module.
- **Tag boundary:** behavioral tests have exactly one `@check:` plus at least
  one `@req:`, or one `@diagnostic`; setup has `@support`.

```ts
export interface InventoryCheck {
  id: string;
  file: string;
  titleSha256: string;
  requirementIds: string[];
  resultPolicy: CheckResultPolicy;
  stability: CheckStability;
  observedOutcome: ObservedOutcome;
  occurrences: Array<{
    project: string;
    variants: {
      engine: string;
      viewport: string;
      transport: 'public' | 'mesh' | 'none';
    };
  }>;
}

export interface TestInventory {
  schemaVersion: 1;
  kind: 'playwright' | 'node-contract';
  setup: number;
  behavioral: number;
  total: number;
  sourceFiles: number;
  checks: InventoryCheck[];
}

export interface AuxiliaryInventory {
  schemaVersion: 1;
  playwright: {
    directIngress: TestInventory;
    vpnRegression: TestInventory;
    webkitRelease: TestInventory;
  };
  productContract: TestInventory;
}

export interface InventoryReviewDisposition {
  checkId: string;
  resultPolicy: CheckResultPolicy;
  stability: CheckStability;
  observedOutcome: ObservedOutcome;
}

export interface PlaywrightReviewDocument {
  schemaVersion: 1;
  entries: InventoryReviewDisposition[];
}

export type InventoryReviewMap = ReadonlyMap<
  string,
  InventoryReviewDisposition
>;

export function loadInventoryReviewMap(
  document: PlaywrightReviewDocument,
): InventoryReviewMap;
export function capturePlaywrightInventory(
  projectNames: readonly string[],
  reviewMap: InventoryReviewMap,
): Promise<TestInventory>;
export function captureProductContractInventory(
  sourcePaths: readonly string[],
  reviewMap: InventoryReviewMap,
): Promise<TestInventory>;
export function assertReviewedInventory(
  actual: TestInventory,
  committed: TestInventory,
): ValidationIssue[];
```

`PlaywrightReviewDocument`, `InventoryReviewDisposition`, and
`InventoryReviewMap` live in
`packages/contracts/src/test-inventory.ts`.
`loadInventoryReviewMap()` lives in
`tools/coverage/capture-playwright.ts`; it schema-validates the parsed YAML,
requires entries already sorted by `checkId`, rejects duplicate IDs, and
returns `new Map(entries.map((entry) => [entry.checkId, entry]))`.

- [ ] **Step 1: Add failing inventory-parser tests**

Require the parser to:

1. run Playwright only with `--list --reporter=json`;
2. reject reporter errors;
3. strip absolute local paths;
4. require exactly one `@check:` tag on every behavioral declaration and
   reject reuse for a different file/title identity;
5. require at least one `@req:` tag or a reviewed `@diagnostic` disposition;
6. require `@support` on setup;
7. group project reruns by logical check ID and retain every engine, viewport,
   and transport occurrence without duplicate requirement credit;
8. compare exact file-to-count maps;
9. fail if total tests or files are zero;
10. fail on any unreviewed addition, deletion, rename, conflicting tag reuse,
    or count change.
11. reject a malformed, unsorted, or duplicate-ID review-map document.

Add and run one parser case at a time:

- [ ] list/json process arguments;
- [ ] reporter errors;
- [ ] absolute-path stripping;
- [ ] exactly one `@check` and no conflicting logical-ID reuse;
- [ ] `@req` or diagnostic disposition;
- [ ] setup support tag;
- [ ] baseline/WebKit logical grouping and variants without duplicate credit;
- [ ] conflicting logical metadata and duplicate occurrence rejection;
- [ ] exact file/count map;
- [ ] zero inventory;
- [ ] reviewed-diff enforcement.
- [ ] serializable review-map shape/order/duplicate enforcement.

- [ ] **Step 2: Run the parser tests and prove they fail**

```bash
npx tsx --test tests/coverage/registry-validation.test.ts
```

- [ ] **Step 3: Implement discovery capture**

`capture-playwright.ts` must spawn Playwright with an environment copy containing `FREELAND_DISCOVERY=1`. It must never load the user's `.env`, never launch a browser, and never run a setup test. `--write` creates canonical JSON; default `--check` compares live discovery with the committed manifests.

Use the local binary and JSON reporter directly:

```ts
import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export async function capturePlaywrightInventory(
  projectNames: readonly string[],
  reviewMap: InventoryReviewMap,
): Promise<TestInventory> {
  const args = [
    'test',
    '--list',
    '--reporter=json',
    ...projectNames.flatMap((name) => ['--project', name]),
  ];
  const { stdout } = await execFile(
    path.resolve('node_modules/.bin/playwright'),
    args,
    {
      env: {
        ...process.env,
        FREELAND_DISCOVERY: '1',
        DOTENV_CONFIG_QUIET: 'true',
      },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  return normalizePlaywrightJson(JSON.parse(stdout), reviewMap);
}

interface ReporterSuite {
  file?: string;
  suites?: ReporterSuite[];
  specs?: Array<{
    title: string;
    tags?: string[];
    tests: Array<{
      projectName: string;
      annotations?: Array<{ type: string; description?: string }>;
    }>;
  }>;
}

export function normalizePlaywrightJson(
  value: unknown,
  reviewMap: InventoryReviewMap,
): TestInventory {
  const report = assertReporterShape(value);
  if (report.errors.length > 0) {
    throw new Error(`Playwright list reporter returned ${report.errors.length} errors`);
  }
  const checksById = new Map<string, InventoryCheck>();
  const visit = (suite: ReporterSuite, inheritedFile?: string): void => {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      for (const listed of spec.tests) {
        mergeInventoryCheck(
          checksById,
          inventoryCheckFromReporterSpec({
            file: requireRepositoryRelativeFile(file),
            title: spec.title,
            tags: spec.tags ?? [],
            projectName: listed.projectName,
            annotations: listed.annotations ?? [],
            reviewMap,
          }),
        );
      }
    }
    for (const child of suite.suites ?? []) visit(child, file);
  };
  for (const suite of report.suites) visit(suite);
  const sorted = [...checksById.values()]
    .map(sortInventoryOccurrences)
    .toSorted((a, b) => a.id.localeCompare(b.id));
  const occurrenceCount = sorted.reduce(
    (sum, check) => sum + check.occurrences.length,
    0,
  );
  if (occurrenceCount === 0) throw new Error('ZERO_TEST_INVENTORY');
  return summarizeInventory(sorted, 'playwright');
}
```

`normalizePlaywrightJson` rejects reporter errors, converts every file to a
repository-relative POSIX path, extracts tags/result policy, groups reruns by
stable logical check ID, sorts each occurrence tuple and check ID, and then
validates exact occurrence counts. `mergeInventoryCheck()` rejects any
invariant-field disagreement or repeated
`(project, engine, viewport, transport)` tuple. A behavioral declaration uses
its `@check:` value as the logical ID; a setup declaration tagged `@support`
uses the deterministic logical ID
`SUPPORT.${sha256(repositoryRelativeFile + "\0" + title)}` and has no
requirement IDs. Thus Chromium/WebKit selection of the same declaration adds
an occurrence rather than a second logical check.
`captureProductContractInventory`
parses the single `.mjs` file with the installed TypeScript parser and extracts
the tagged `node:test` call without importing or executing product source. Its
single occurrence uses `project: product-contract`, `engine: node`,
`viewport: none`, and `transport: none`.
`assertReporterShape`, `requireRepositoryRelativeFile`,
`inventoryCheckFromReporterSpec`, `mergeInventoryCheck`,
`sortInventoryOccurrences`, and `summarizeInventory` are private
functions in `tools/coverage/capture-playwright.ts`; each has a separate
malformed/path/tag/count test from Step 1.
The CLI loads `coverage/sources/playwright-map.v1.yaml` into
`InventoryReviewMap`. An absent disposition fails as an unreviewed change.
Discovery never derives an outcome from list output. New review dispositions
use `UNKNOWN` plus `NOT_RUN`; a persisted `PASS` is accepted only when its
timestamp and authoritative evidence reference are already present in the
review map.
The resulting committed inventories are canonical for execution policy,
stability, and outcome reporting; Task 4's join validator rejects any
requirement projection that differs.

The full baseline file is a `TestInventory` with 164 generated occurrences
grouped into logical `checks` records and these fixed count invariants:

```ts
const BASELINE_COUNTS = {
  schemaVersion: 1,
  kind: 'playwright',
  setup: 1,
  behavioral: 163,
  total: 164,
  sourceFiles: 24,
} as const satisfies Omit<TestInventory, 'checks'>;
```

The full auxiliary file is an `AuxiliaryInventory`; every leaf contains its
own canonical `checks` array:

```ts
const AUXILIARY_COUNTS = {
  directIngress: { setup: 0, behavioral: 1, total: 1, sourceFiles: 1 },
  vpnRegression: { setup: 0, behavioral: 3, total: 3, sourceFiles: 1 },
  webkitRelease: { setup: 1, behavioral: 35, total: 36, sourceFiles: 5 },
  productContract: { setup: 0, behavioral: 1, total: 1, sourceFiles: 1 },
} as const;
```

Each Playwright leaf also has `schemaVersion: 1, kind: playwright`; the product
leaf has `schemaVersion: 1, kind: node-contract`. Count summaries are never
accepted as substitutes for the typed manifests. For every leaf, `setup` and
`behavioral` count occurrences by `SUPPORT` versus non-`SUPPORT` policy,
`total === setup + behavioral === sum(check.occurrences.length)`, and
`sourceFiles` is the number of distinct repository-relative files. Logical
`checks.length` is deliberately not substituted for `total`.

- [ ] **Step 4: Tag the baseline in small reviewable groups**

Use Playwright details objects rather than changing visible titles:

```ts
test(
  'session survives a full page reload (GEN-02)',
  { tag: ['@check:PW.AUTH.SESSION_RELOAD', '@req:GEN-02'] },
  async ({ page }) => {
    await gotoAppSection(page, '/app/wallet');
    await page.reload();
    await gotoAppSection(page, '/app/wallet');
    await expect(page).toHaveURL(/\/app\/wallet/);
    await expect(page.getByText(/пополнить через/i).first()).toBeVisible();
  },
);
```

Parameterized declarations that represent distinct assertions need unique
check tags per expanded case, for example a viewport suffix. The `@req:` tag
may repeat across those cases. Project-level engine/viewport/transport reruns
of the same declaration deliberately reuse its logical check tag and become
additional occurrences.

For the Node product contract, put the same stable tags in the `node:test`
name because it has no Playwright details object:

```js
test('@check:CT.PAY.DURABLE_AUTH @req:PAY.SAFETY.DURABLE_AUTH fresh process cannot authorize twice', () => {
  const firstProcess = new StagingRequestGate();
  firstProcess.approveCheckoutMutation();
  assert.equal(firstProcess.decide(checkoutRequest).action, 'continue');
  const restartedProcess = new StagingRequestGate();
  restartedProcess.approveCheckoutMutation();
  const duplicateDecision = restartedProcess.decide(checkoutRequest);
  const duplicateWasBlocked = duplicateDecision.action === 'fail';

  if (process.env.FREELAND_STRICT_FREEL_211 === '1') {
    assert.equal(
      duplicateWasBlocked,
      true,
      'a durable ledger must block a second checkout after process restart',
    );
    return;
  }

  assert.equal(
    duplicateWasBlocked,
    false,
    'FREEL-211 unexpectedly passed; remove the expected-failure branch after review',
  );
});
```

Tag and validate through these small checkpoints:

Inside every listed file checkpoint, repeat this micro-cycle for exactly one
declaration: add its expected stable tag to the inventory fixture, prove the
missing-tag failure, add only that details/tag field, rerun the focused parser
test, then continue. The file/group checkbox closes only after all of its
single-declaration cycles are green.

- [ ] `smoke.spec.ts` and `landing.spec.ts`
- [ ] `auth.spec.ts`
- [ ] `auth-flows.spec.ts`
- [ ] `access-control.spec.ts`
- [ ] `app.spec.ts`
- [ ] `sections.spec.ts` and `settings-deep.spec.ts`
- [ ] `products.spec.ts`
- [ ] `purchase.spec.ts` and `payments.spec.ts`
- [ ] `mail.spec.ts`, `support.spec.ts`, and `referrals.spec.ts`
- [ ] `marketing.spec.ts`
- [ ] `seo.spec.ts` and `pwa.spec.ts`
- [ ] `responsive.spec.ts`
- [ ] `i18n.spec.ts`
- [ ] `telegram.spec.ts` and `tma.spec.ts`
- [ ] `freeman.spec.ts` and `api.spec.ts`
- [ ] authentication and WebKit setup as `@support`
- [ ] direct-ingress and VPN regressions
- [ ] semantic and product-contract regressions

Run the inventory check after every checkbox so a duplicate or missing tag is
localized.

- [ ] **Step 5: Review result policies explicitly**

Every check record must be one of:

```text
MUST_PASS
EXPECTED_FAIL
CONDITIONAL_EXPECTED_FAIL
MAY_SKIP
DIAGNOSTIC
SUPPORT
```

Do not infer a result policy from a ticket state. Inspect the executable
declaration and its `test.fail()`/`test.skip()` branches. `EXPECTED_FAIL`,
`CONDITIONAL_EXPECTED_FAIL`, and `MAY_SKIP` checks contribute executable
coverage but never promotion credit. `DIAGNOSTIC` contributes inventory only,
with neither coverage nor promotion credit.

Review stability independently as `STABLE`, `FLAKY`, or `UNKNOWN`. `FLAKY`
and `UNKNOWN` never receive promotion credit even when their declared policy
is `MUST_PASS`. Discovery writes `observedOutcome.status: NOT_RUN`; it never
manufactures `PASS`. A historical/runtime `PASS` is accepted only with an
authoritative `observedAt` and `evidenceRef`. The generated report counts
policy, stability, and observed outcome separately.

- [ ] **Step 6: Bind all tests to requirements**

Every behavioral test must either:

- bind to one or more legacy or semantic requirement IDs; or
- be explicitly reviewed as `@diagnostic`, with no coverage credit.

Create semantic QA requirements when no legacy row accurately describes the behavior. At minimum, the promoted regressions need semantic requirements for:

```text
supported staging ingress
VPN activation handoff
VPN clipboard/fallback behavior
mobile card containment
auth landmarks/labels/focus
durable single-payment authorization
```

After binding:

- a fully authoritative `MUST_PASS` requirement may move from `CANDIDATE` to `AUTOMATED`;
- an expected-fail-only or skip-capable requirement remains non-promotable;
- manual, partial, and blocked legacy rows remain `MISSING`, `CANDIDATE`, or `BLOCKED`;
- no test result is recorded as a pass during discovery.

A reviewed binding update has this exact shape:

```yaml
checks:
  - id: PW.AUTH.SESSION_RELOAD
    kind: playwright
    stableTag: "@check:PW.AUTH.SESSION_RELOAD"
    file: tests/playwright/freeland/auth-flows.spec.ts
    assertionIds: [session-reload]
    resultPolicy: MUST_PASS
    stability: STABLE
    observedOutcome:
      status: NOT_RUN
lifecycle:
  status: AUTOMATED
```

An expected-fail-only requirement uses
`resultPolicy: EXPECTED_FAIL`; its lifecycle may be `AUTOMATED` because the
oracle exists, but the generated report must show current outcome as non-pass
and promotion eligibility as false. Use `NOT_RUN` during discovery or
`EXPECTED_FAIL` only with timestamped authoritative evidence.

- [ ] **Step 7: Generate manifests and prove deterministic discovery**

```bash
npx tsx tools/coverage/capture-playwright.ts --write
npm run test:list
npm run coverage:report -- --write
npm run coverage:validate
npm run typecheck
```

Run `--write` twice and require no second-run diff.

- [ ] **Step 8: Commit**

```bash
git add tests/playwright tests/product-contracts coverage/bootstrap/playwright-164.v1.json coverage/bootstrap/playwright-auxiliary.v1.json coverage/bootstrap/coverage-report.v1.json coverage/sources/playwright-map.v1.yaml coverage/requirements tools/coverage tests/coverage
git commit -m "feat: bind the Freeland test inventory to coverage"
```

---

### Task 7: Capture an Atomic Read-Only Nuanu QA Snapshot and Account for Every Ticket

**Files:**

- Create: a mechanically named `nuanu-qa-*.sanitized.json` file under `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/`
- Create: one stable mapping per captured issue under `/Users/danilsolomin/projectsnew/FreelandQA/coverage/tickets/`
- Create or modify: semantic requirements under `/Users/danilsolomin/projectsnew/FreelandQA/coverage/requirements/qa/`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/normalize-nuanu-snapshot.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/coverage/reconcile-qa.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/fixtures/nuanu-before.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/fixtures/nuanu-after-changed.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/snapshot-normalization.test.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/coverage/reconciliation.test.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/runbooks/refresh-qa-snapshot.md`

**Interfaces:**

- **Consumes:** an exact QA state ID and a read-only Nuanu adapter capable of
  paginated issue, detail, relation, revision, and attachment-metadata reads.
- **Produces:** one immutable sanitized snapshot, stable ticket mappings,
  semantic requirements, and a reconciliation report. It performs zero Nuanu
  writes.

```ts
export interface RawQaIssue {
  issueId: string;
  key: `FREEL-${number}`;
  stateId: string;
  title: string;
  descriptionHtml: string;
  acceptanceHtml: string;
  priority: string;
  updatedAt: string;
  revision: string;
  relationKeys: string[];
  attachments: Array<{
    id: string;
    fileName: string;
    contentType: string;
    size: number;
    sha256: string;
  }>;
}

export interface RawQaSet {
  stateId: string;
  stateRevision: string;
  issues: RawQaIssue[];
}

export interface ReadOnlyNuanuClient {
  readStateRevision(exactStateId: string): Promise<string>;
  listQaPage(input: {
    exactStateId: string;
    cursor?: string;
  }): Promise<{
    issues: Array<{
      issueId: string;
      key: `FREEL-${number}`;
      stateId: string;
    }>;
    nextCursor?: string;
  }>;
  readIssue(issueId: string): Promise<Omit<
    RawQaIssue,
    'relationKeys' | 'attachments'
  >>;
  readRelations(issueId: string): Promise<string[]>;
  readAttachmentMetadata(issueId: string): Promise<RawQaIssue['attachments']>;
}

export interface AtomicCaptureOptions {
  exactStateId: string;
  maxAttempts: 3;
}

export interface ReconciliationReport {
  captured: number;
  mapped: number;
  missing: number;
  unrepresented: string[];
  stale: string[];
  invalidRequirementRefs: string[];
  nuanuWrites: 0;
}

export function readCompleteQaSet(
  client: ReadOnlyNuanuClient,
  exactStateId: string,
): Promise<RawQaSet>;
export function normalizeQaSet(raw: RawQaSet): NuanuQaSnapshot;
export function captureAtomicQaSnapshot(
  client: ReadOnlyNuanuClient,
  options: AtomicCaptureOptions,
): Promise<NuanuQaSnapshot>;
export function reconcileQa(
  snapshot: NuanuQaSnapshot,
  ticketMappings: readonly TicketMapping[],
  requirements: readonly CoverageRequirement[],
): ReconciliationReport;
```

- [ ] **Step 1: Write failing normalization and reconciliation tests**

Cover:

```ts
test('normalization removes HTML volatility and sensitive fields');
test('normalization redacts the title and never persists its raw value');
test('canonical ordering produces a stable content digest');
test('a membership change between the two QA reads discards the snapshot');
test('an updated_at change between reads discards the snapshot');
test('a revision-only change between reads discards the snapshot');
test('a relation-only change between reads discards the snapshot');
test('an attachment-metadata-only change between reads discards the snapshot');
test('every accepted QA issue has one mapped or missing ticket record');
test('a changed issue content digest marks a stable mapping stale');
test('explicit MISSING blocks routing but satisfies bootstrap accounting');
test('state, priority, and current verdict stay out of stable mapping files');
```

Add and run exactly one named test per micro-cycle:

- [ ] HTML/sensitive normalization;
- [ ] raw-title exclusion;
- [ ] canonical digest ordering;
- [ ] membership drift;
- [ ] `updatedAt` drift;
- [ ] revision drift;
- [ ] relation drift;
- [ ] attachment-metadata drift;
- [ ] mapped-or-missing completeness;
- [ ] stale content digest;
- [ ] explicit `MISSING` accounting;
- [ ] stable-mapping volatility exclusion.

- [ ] **Step 2: Implement the normalized contracts**

The immutable snapshot contains volatile facts:

```ts
export interface NuanuQaSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  workspace: 'freeland';
  project: 'FREEL';
  stateId: string;
  stateRevision: string;
  stateName: 'QA';
  membershipSha256: string;
  issues: Array<{
    issueId: string;
    key: `FREEL-${number}`;
    titleRedacted: string;
    titleSha256: string;
    priority: string;
    updatedAt: string;
    revision: string;
    contentSha256: string;
    relationKeys: string[];
    attachmentSha256: string[];
    issueSha256: string;
  }>;
}
```

Stable ticket mappings contain no current state, priority, or verdict:

```ts
export interface TicketMapping {
  schemaVersion: 1;
  ticketKey: `FREEL-${number}`;
  issueId: string;
  source: {
    workspace: 'freeland';
    project: 'FREEL';
    issueUpdatedAt: string;
    contentSha256: string;
    parserVersion: 1;
  };
  resolution: 'mapped' | 'missing';
  acceptanceClauses: Array<{
    id: string;
    textSha256: string;
    requirementIds: string[];
  }>;
  missing?: {
    reason: string;
    owner: string;
    nextReviewAt: string;
    proposedRequirementIds: string[];
  };
  review: {
    owner: string;
    revision: number;
  };
}
```

- [ ] **Step 3: Take the first exact-QA read**

Through Nuanu Flow MCP:

1. resolve the exact `QA` state for workspace `freeland`, project `FREEL`;
2. call `list_issues` with that exact state, not `state_group=started`;
3. paginate to exhaustion;
4. read each issue's details, relations, revision, and attachment metadata;
5. keep raw tool output only under ignored `.work/coverage/` or an explicit temporary directory.

Do not call any create, update, comment, transition, assign, label, relation, or attachment mutation tool.

Implement and test the read adapter in bounded checkpoints:

- [ ] add a two-page fixture; implement cursor pagination to exhaustion;
- [ ] add an exact-state assertion; reject any page whose issue state differs;
- [ ] add a missing-detail fixture; require one full detail read per issue;
- [ ] add relation ordering fixture; read and sort relation keys per issue;
- [ ] add attachment ordering fixture; read metadata only and sort hashes;
- [ ] add a revision fixture; read both state and issue revision tokens;
- [ ] add a duplicate issue fixture; reject duplicate IDs or keys;
- [ ] add a call-ledger assertion; permit only the five read methods above.

The composition is explicit and does not merge partial pages:

```ts
export async function readCompleteQaSet(
  client: ReadOnlyNuanuClient,
  exactStateId: string,
): Promise<RawQaSet> {
  const stateRevision = await client.readStateRevision(exactStateId);
  const summaries: Array<{
    issueId: string;
    key: `FREEL-${number}`;
    stateId: string;
  }> = [];
  let cursor: string | undefined;
  do {
    const page = await client.listQaPage({ exactStateId, cursor });
    for (const issue of page.issues) {
      assert.equal(issue.stateId, exactStateId);
    }
    summaries.push(...page.issues);
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  assertUnique(summaries.map(({ issueId }) => issueId), 'QA issue ID');
  assertUnique(summaries.map(({ key }) => key), 'QA issue key');
  const issues = await Promise.all(
    summaries.map(async ({ issueId, key, stateId }) => {
      const [detail, relationKeys, attachments] = await Promise.all([
        client.readIssue(issueId),
        client.readRelations(issueId),
        client.readAttachmentMetadata(issueId),
      ]);
      assert.equal(detail.key, key);
      assert.equal(stateId, exactStateId);
      assert.equal(detail.stateId, exactStateId);
      return {
        ...detail,
        relationKeys: relationKeys.toSorted(),
        attachments: attachments.toSorted((a, b) => a.id.localeCompare(b.id)),
      };
    }),
  );
  const stateRevisionAfter = await client.readStateRevision(exactStateId);
  if (stateRevisionAfter !== stateRevision) {
    throw new Error('QA_READ_DRIFT');
  }
  return { stateId: exactStateId, stateRevision, issues };
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function atomicDigest(snapshot: NuanuQaSnapshot): string {
  const canonical = {
    stateId: snapshot.stateId,
    stateRevision: snapshot.stateRevision,
    membershipSha256: snapshot.membershipSha256,
    issues: snapshot.issues
      .map(({ issueId, key, issueSha256 }) => ({ issueId, key, issueSha256 }))
      .toSorted((a, b) => a.key.localeCompare(b.key)),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
```

`normalize-nuanu-snapshot.ts` imports `createHash` from `node:crypto`; both
helpers above are private to that file and are covered by duplicate/digest
fixtures.

- [ ] **Step 4: Normalize to a temporary candidate snapshot**

Normalize title/description/acceptance HTML in memory, canonical-sort arrays,
retain attachment hashes rather than bytes, redact sensitive values, and
compute issue plus membership digests. The committed title is
`titleRedacted`; email addresses, phone-like values, query strings, UUIDs, and
long account identifiers become typed markers. Store `titleSha256` for drift
detection and never write the unredacted title or body to Git.

Normalize through separate fixtures:

- [ ] title email/phone/query/UUID/account markers;
- [ ] description and acceptance HTML canonicalization;
- [ ] relation and attachment canonical sorting;
- [ ] `contentSha256`, `titleSha256`, and complete `issueSha256`;
- [ ] membership/state atomic digest;
- [ ] JSON serialization proving raw title/body/attachment names are absent.

- [ ] **Step 5: Re-read before accepting**

Repeat the complete read: membership, full issue details, relations,
attachment metadata, and revisions. Re-normalize and recompute every digest.
Accept the snapshot only if:

```text
same state ID
same issue-key set
same issue IDs
same updatedAt values
same revision tokens
same content digests
same relation-key arrays
same attachment-metadata SHA-256 arrays
same issue digests
```

`issueSha256` is the canonical SHA-256 over `{ issueId, key, stateId,
titleSha256, priority, updatedAt, revision, contentSha256, sortedRelationKeys,
sortedAttachmentSha256 }`; the state-level atomic digest includes
`stateRevision` plus every sorted `issueSha256`. Equality is implemented
against that complete digest, never against a subset of fields:

```ts
export async function captureAtomicQaSnapshot(
  client: ReadOnlyNuanuClient,
  options: AtomicCaptureOptions,
): Promise<NuanuQaSnapshot> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const before = normalizeQaSet(
        await readCompleteQaSet(client, options.exactStateId),
      );
      const after = normalizeQaSet(
        await readCompleteQaSet(client, options.exactStateId),
      );
      if (
        before.stateId === after.stateId &&
        before.stateRevision === after.stateRevision &&
        atomicDigest(before) === atomicDigest(after)
      ) {
        return after;
      }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'QA_READ_DRIFT') {
        throw error;
      }
    }
  }
  throw new Error('QA_SNAPSHOT_UNSTABLE');
}
```

If any field changed, discard the candidate and repeat from the first complete
read. Allow at most three complete attempts; after the third mismatch, fail
with `QA_SNAPSHOT_UNSTABLE` and commit nothing. Do not merge two board moments.

Add one red/green atomic test per drift dimension before invoking the live
adapter:

- [ ] membership-only drift;
- [ ] issue-ID/key pairing drift;
- [ ] `updatedAt`-only drift;
- [ ] state-revision-only drift;
- [ ] issue-revision-only drift;
- [ ] content-only drift;
- [ ] relation-only drift;
- [ ] attachment-metadata-only drift;
- [ ] two stable reads accept the second normalized snapshot;
- [ ] three mismatches throw exactly `QA_SNAPSHOT_UNSTABLE` and write nothing.

- [ ] **Step 6: Reconcile every issue**

The 26-ticket reference snapshot suggests this conservative bootstrap:

| Bootstrap class | Tickets |
|---|---|
| Exact automated positive regression | `FREEL-181` |
| Exact executable regression with current expected failure | `FREEL-169`, `FREEL-134`, `FREEL-135`, `FREEL-136` |
| Promoted candidate regression | `FREEL-205`, `FREEL-210`, `FREEL-211` |
| Split dry automation plus missing/blocked live acceptance | `FREEL-82`, `FREEL-83` |
| Missing plus external/environment block | `FREEL-132`, `FREEL-202` |
| Exact acceptance currently missing | `FREEL-56`, `FREEL-145`, `FREEL-146`, `FREEL-147`, `FREEL-148`, `FREEL-149`, `FREEL-150`, `FREEL-151`, `FREEL-152`, `FREEL-153`, `FREEL-154`, `FREEL-201`, `FREEL-203`, `FREEL-204` |

Refresh this classification against the newly read acceptance text. For each live ticket:

- use `resolution: mapped` only when all represented acceptance clauses point to valid requirements;
- use `resolution: missing` with an explicit proposed semantic requirement when exact coverage is absent;
- split a ticket into multiple requirements when dry and external/live acceptance differ;
- keep `test.fail()` requirements executable but non-passing;
- create no fake mapping to a broad smoke test.

Implement reconciliation before authoring mappings:

- [ ] add exact mapped fixture; implement ticket-to-requirement lookup;
- [ ] add explicit missing fixture; count it without granting coverage;
- [ ] add absent mapping fixture; report it in `unrepresented`;
- [ ] add stale content digest fixture; report it in `stale`;
- [ ] add invalid requirement fixture; report it in
      `invalidRequirementRefs`;
- [ ] add reverse-link fixture; reject mappings not referenced by their
      requirements;
- [ ] add deterministic report-order fixture; implement sorted output;
- [ ] add write-ledger fixture; require `nuanuWrites: 0`.

Author the 26-reference set in these review-sized batches, replacing it with
the fresh set when membership changed:

Within each batch, add exactly one ticket mapping per micro-cycle: first add its
expected key/resolution/requirement references to the reconciliation fixture
and prove failure, then write that one sanitized mapping and rerun both
reconciliation and schema validation.

- [ ] `FREEL-181`, `FREEL-169`, `FREEL-134`, `FREEL-135`, `FREEL-136`
- [ ] `FREEL-205`, `FREEL-210`, `FREEL-211`
- [ ] `FREEL-82`, `FREEL-83`, `FREEL-132`, `FREEL-202`
- [ ] `FREEL-145`, `FREEL-146`, `FREEL-147`, `FREEL-148`, `FREEL-149`
- [ ] `FREEL-150`, `FREEL-151`, `FREEL-152`, `FREEL-153`, `FREEL-154`
- [ ] `FREEL-56`, `FREEL-201`, `FREEL-203`, `FREEL-204`
- [ ] any newly entered QA issue from the accepted snapshot

- [ ] **Step 7: Validate completeness and no mutations**

```bash
npx tsx --test tests/coverage/snapshot-normalization.test.ts tests/coverage/reconciliation.test.ts
npm run coverage:reconcile
npm run coverage:report -- --write
npm run coverage:validate
```

The reconciler must prove:

```text
captured QA issue count = stable mapping file count
unrepresented QA tickets = 0
invalid requirement references = 0
stale mappings = 0 at capture time
Nuanu writes = 0
```

Explicit `MISSING` records are visible gaps, not validation failures and not passes.

- [ ] **Step 8: Commit only sanitized outputs**

```bash
git add coverage/bootstrap/nuanu-qa-*.sanitized.json coverage/bootstrap/coverage-report.v1.json coverage/tickets coverage/requirements/qa tools/coverage tests/coverage docs/runbooks/refresh-qa-snapshot.md
git commit -m "feat: account for the current Nuanu QA column"
```

Before committing, prove no raw export under `.work/coverage/` is tracked.

---

### Task 8: Export and Verify the Six-Commit Product Patch Series

**Files:**

- Create: all files under `/Users/danilsolomin/projectsnew/FreelandQA/patchsets/freeland/virtual-numbers-card-canary-20260731/`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/patchsets/export-patchset.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/patchsets/git-io.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/patchsets/verify-patchset.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/patchsets/patchset-verification.test.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/runbooks/verified-product-patchset.md`

**Interfaces:**

- **Consumes:** one clean source-head repository for export, one clean
  disposable checkout at the exact base for verification, and the tracked
  manifest/patch files.
- **Produces:** deterministic patch bytes plus a `PatchVerification` whose
  `patchedWorktree` is guaranteed to contain and have indexed the final tree.
  Product tests consume only that returned path.

```ts
export interface PatchManifest {
  schemaVersion: 1;
  id: string;
  status: 'active';
  source: {
    repository: string;
    baseCommit: string;
    baseTree: string;
    sourceHead: string;
    finalTree: string;
  };
  patches: Array<{
    order: number;
    file: string;
    sourceCommit: string;
    treeAfterApply: string;
    sha256: string;
    stablePatchId: string;
  }>;
  expectedNameStatus: Array<{
    status: 'A' | 'M' | 'D' | 'R';
    path: string;
  }>;
  upstream: {
    state: 'unsubmitted' | 'partially-equivalent' | 'equivalent';
    equivalentCommits: string[];
  };
  knownGaps: string[];
}

export interface ExportResult {
  manifestId: string;
  patchFiles: string[];
  sha256SumsPath: string;
}

export interface PatchVerification {
  manifestId: string;
  baseCommit: string;
  baseTree: string;
  intermediateTrees: string[];
  finalTree: string;
  patchedWorktree: string;
  indexTreeAtReturn: string;
  exactNameStatus: true;
}

export type DriftVerification =
  | {
      observedAt: string;
      result: 'unavailable';
      observedStagingSha?: never;
    }
  | {
      observedAt: string;
      observedStagingSha: string;
      result: 'clean' | 'already-equivalent' | 'conflict';
    };

export function exportPatchset(
  sourceRepo: string,
  manifest: PatchManifest,
): Promise<ExportResult>;
export function applyAndVerifyImmutableBase(
  productDir: string,
  patchsetDir: string,
  manifest: PatchManifest,
): Promise<PatchVerification>;
export function verifyMovingStaging(
  sourceRepo: string,
  manifest: PatchManifest,
): Promise<DriftVerification>;
```

`applyAndVerifyImmutableBase()` requires `productDir` to be a clean disposable
checkout whose `HEAD` equals `baseCommit`. It applies each patch to both index
and worktree, asserts `git write-tree === finalTree`, and leaves that exact
patched tree in place. It never accepts the source-head worktree as
`productDir`.

- [ ] **Step 1: Write failing verifier tests with a disposable Git fixture**

Create a tiny temporary Git repository in the test. Prove that the verifier rejects:

```text
wrong base commit
wrong base tree
wrong patch SHA-256
wrong stable patch ID
wrong intermediate tree
wrong final tree
patch ordering changes
whitespace errors
dirty target checkout
```

Also prove that a correct two-patch fixture applies and verifies without creating a commit.

Add and run exactly one disposable-repository case per micro-cycle:

- [ ] wrong base commit;
- [ ] wrong base tree;
- [ ] wrong patch SHA-256;
- [ ] wrong stable patch ID;
- [ ] wrong intermediate tree;
- [ ] wrong final tree;
- [ ] reordered manifest;
- [ ] whitespace error;
- [ ] dirty target checkout;
- [ ] correct two-patch no-commit success.

- [ ] **Step 2: Run and prove the tests fail**

```bash
npx tsx --test tests/patchsets/patchset-verification.test.ts
```

- [ ] **Step 3: Preflight the real source worktree**

Require:

```text
clean worktree
HEAD = a08e63b568df27e34aeab3d745e9b9457c2f24d4
HEAD tree = 839e77b1640f682486a297210b30f0fbc1211219
merge-base = c702465facd4971eb456ce8efe92dd9a3d694139
base tree = 6e5304f23ded34faff364577b08e4b7db09a9d17
exactly six commits above base
```

If the source changed, stop and re-audit; do not silently export a different series under this manifest ID.

- [ ] **Step 4: Implement deterministic patch export**

For each source commit in the immutable table below, set `SOURCE_COMMIT` to that
full 40-character SHA and mechanically capture:

```bash
git format-patch --stdout --no-signature --full-index --binary --no-stat -1 "$SOURCE_COMMIT"
```

Write it to the fixed filename through `export-patchset.ts`. Do not hand-edit patch content.

Use one source-commit/filename assertion and export per checkbox:

- [ ] `272a5c040ea66931095e29bc64471ffa5d8d7f66` →
      `0001-272a5c04.patch`;
- [ ] `49db2ffd5b960cff70015ece7a6e28087114ee79` →
      `0002-49db2ffd.patch`;
- [ ] `294f9634394f490024c52e9a9098a2b6d916e583` →
      `0003-294f9634.patch`;
- [ ] `406e694de572bc31201116fae073975385e5e6f5` →
      `0004-406e694d.patch`;
- [ ] `5c02b6727a682f8885563c33afed7e6bfe008afc` →
      `0005-5c02b672.patch`;
- [ ] `a08e63b568df27e34aeab3d745e9b9457c2f24d4` →
      `0006-a08e63b5.patch`;
- [ ] run a byte-for-byte second export into a temporary directory and compare
      all six files before replacing tracked output.

The exporter uses argument arrays and writes the bytes returned by Git without
post-processing:

```ts
const FORMAT_PATCH_ARGS = [
  'format-patch',
  '--stdout',
  '--no-signature',
  '--full-index',
  '--binary',
  '--no-stat',
  '-1',
] as const;

const patchBytes = await gitBuffer(sourceRepo, [
  ...FORMAT_PATCH_ARGS,
  patch.sourceCommit,
]);
await writeFileAtomic(path.join(outputDir, patch.file), patchBytes);
```

Both patch tools share these exact private process/file boundaries in
`tools/patchsets/git-io.ts`:

```ts
export async function gitBuffer(
  cwd: string,
  args: readonly string[],
): Promise<Buffer> {
  const { stdout } = await execFile('git', [...args], {
    cwd,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

export async function gitStdout(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  return (await gitBuffer(cwd, args)).toString('utf8').trim();
}

export async function git(cwd: string, args: readonly string[]): Promise<void> {
  await gitBuffer(cwd, args);
}

export async function writeFileAtomic(
  target: string,
  bytes: Uint8Array,
): Promise<void> {
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, target);
}
```

The file imports promisified `execFile` from `node:child_process` and
`rename`/`writeFile` from `node:fs/promises`. `outputDir` is the validated
absolute CLI `--output-dir`; it defaults exactly to the manifest's tracked
directory and refuses a pre-existing temporary file.

- [ ] **Step 5: Write the exact manifest**

Use these immutable values:

| Order | File | Source commit | Tree after apply | SHA-256 | Stable patch ID |
|---:|---|---|---|---|---|
| 1 | `0001-272a5c04.patch` | `272a5c040ea66931095e29bc64471ffa5d8d7f66` | `f480b20f6489a2465c6fcc9a35b5191ffd200616` | `1a5a6407e07de81e143d5f95f92cf50651b18b8e9c82acdbfd415375a3124ffb` | `e9ef1d191e347f3cfceac37f25bff0844bf8f1b9` |
| 2 | `0002-49db2ffd.patch` | `49db2ffd5b960cff70015ece7a6e28087114ee79` | `fad5c160d53aa271e9eb239ae56763e679bf6930` | `6d87fb1beb45f32fd353aa9b75122fb0a2bd9f187cedb982feecfc544ec75f71` | `34322b736b50c4ce03da666f830af28b6c6482db` |
| 3 | `0003-294f9634.patch` | `294f9634394f490024c52e9a9098a2b6d916e583` | `38f0b7a7fa1a3945df66c6e7c52c828ab9aa37fa` | `8b3a6de7577fdca05d82e241f6be1cd58affcfa3fc78f81ca849b2b27afb356e` | `b81f69b45f599c23153ea3c19f190ad41a8a64ee` |
| 4 | `0004-406e694d.patch` | `406e694de572bc31201116fae073975385e5e6f5` | `7bd0ba0ba71d62646f3c784af1deb3610ccec9a6` | `37e856e70883f0bb0a9737736e5eb3da2e31c2c97ce1322f9cb5eef74427650f` | `85c0a692e1758c95147b1a18c705171ec7f6779d` |
| 5 | `0005-5c02b672.patch` | `5c02b6727a682f8885563c33afed7e6bfe008afc` | `d9b255f433794daef0172ab9766010ba82fc4454` | `2f0344ef211e1d63326da514472c9e1019f97815cd6bebe4f62a3b0ddbf1707e` | `9b932058341cad9d2f199c1898691d03f53aedfe` |
| 6 | `0006-a08e63b5.patch` | `a08e63b568df27e34aeab3d745e9b9457c2f24d4` | `839e77b1640f682486a297210b30f0fbc1211219` | `7b8845b7631ed54de869f8708822a51af16bf7b5e7e415e82a58c6fb749caf8a` | `45e7f0581348dc00efdb57612347c6e8d88b8d28` |

The manifest also records:

```yaml
schemaVersion: 1
id: freeland-virtual-numbers-card-canary-20260731
status: active
source:
  repository: nuanu-ai/freeland_app
  baseCommit: c702465facd4971eb456ce8efe92dd9a3d694139
  baseTree: 6e5304f23ded34faff364577b08e4b7db09a9d17
  sourceHead: a08e63b568df27e34aeab3d745e9b9457c2f24d4
  finalTree: 839e77b1640f682486a297210b30f0fbc1211219
upstream:
  state: unsubmitted
  equivalentCommits: []
knownGaps:
  - duplicate-provider-pair regression described in historical context is absent from the six commits
expectedNameStatus:
  - { status: M, path: package.json }
  - { status: A, path: scripts/e2e/scenarios/staging-virtual-numbers-card-canary.mjs }
  - { status: M, path: scripts/e2e/src/browser-target-mutation-guard.mjs }
  - { status: M, path: scripts/e2e/src/checkout-evidence.mjs }
  - { status: M, path: scripts/e2e/src/cli-options.mjs }
  - { status: M, path: scripts/e2e/src/evidence-writer.mjs }
  - { status: M, path: scripts/e2e/src/live-session.mjs }
  - { status: M, path: scripts/e2e/src/page-runtime.mjs }
  - { status: M, path: scripts/e2e/src/provider-handoff.mjs }
  - { status: A, path: scripts/e2e/src/virtual-numbers-browser-state.mjs }
  - { status: A, path: scripts/e2e/src/virtual-numbers-canary.mjs }
  - { status: M, path: scripts/e2e/src/vpn-browser-state.mjs }
  - { status: M, path: scripts/e2e/tests/checkout-evidence.test.mjs }
  - { status: A, path: scripts/e2e/tests/virtual-numbers-canary.test.mjs }
  - { status: M, path: scripts/e2e/tests/vpn-browser-state.test.mjs }
```

The six rows in the immutable table are serialized one-for-one as
`manifest.patches` in order; no SHA, tree, filename, or patch ID is derived at
verification time.

- [ ] **Step 6: Implement immutable-base verification**

Implement and test each verifier checkpoint separately:

- [ ] add `wrong base commit/tree` assertions; implement `assertExactBase()`;
- [ ] add `wrong SHA256SUMS` assertion; implement `verifyPatchSha256()`;
- [ ] add `wrong stable patch ID` assertion; implement
      `verifyStablePatchId()`;
- [ ] add `whitespace failure` assertion; implement
      `git apply --check --index --whitespace=error-all`;
- [ ] add `first intermediate tree mismatch` assertion; apply patch 1 with
      `git apply --index` and compare `git write-tree`;
- [ ] repeat the focused intermediate-tree assertion for patches 2–6;
- [ ] add `wrong final tree` assertion; compare the sixth `git write-tree`;
- [ ] add cached whitespace assertion; run `git diff --cached --check`;
- [ ] add changed-path assertion; compare exact 15-file name-status output;
- [ ] add return-path assertion; prove `patchedWorktree === productDir` and
      `indexTreeAtReturn === manifest.source.finalTree`.

The implementation path is explicit:

```ts
export async function applyAndVerifyImmutableBase(
  productDir: string,
  patchsetDir: string,
  manifest: PatchManifest,
): Promise<PatchVerification> {
  await assertCleanCheckout(productDir);
  await assertExactBase(productDir, manifest);
  const intermediateTrees: string[] = [];

  assert.deepEqual(
    manifest.patches.map(({ order }) => order),
    manifest.patches.map((_, index) => index + 1),
    'manifest patch order must already be canonical',
  );
  for (const patch of manifest.patches) {
    const patchPath = path.resolve(patchsetDir, patch.file);
    await verifyPatchSha256(patchPath, patch.sha256);
    await verifyStablePatchId(patchPath, patch.stablePatchId);
    await git(productDir, [
      'apply',
      '--check',
      '--index',
      '--whitespace=error-all',
      patchPath,
    ]);
    await git(productDir, ['apply', '--index', patchPath]);
    const tree = await gitStdout(productDir, ['write-tree']);
    assert.equal(tree, patch.treeAfterApply);
    intermediateTrees.push(tree);
  }

  await git(productDir, ['diff', '--cached', '--check']);
  await assertExactNameStatus(productDir, manifest);
  const finalTree = await gitStdout(productDir, ['write-tree']);
  assert.equal(finalTree, manifest.source.finalTree);
  await git(productDir, ['diff', '--exit-code']);
  return {
    manifestId: manifest.id,
    baseCommit: manifest.source.baseCommit,
    baseTree: manifest.source.baseTree,
    intermediateTrees,
    finalTree,
    patchedWorktree: path.resolve(productDir),
    indexTreeAtReturn: finalTree,
    exactNameStatus: true,
  };
}
```

`git diff --exit-code` compares the worktree with the verified index. The
verifier therefore returns only when product files read from disk equal final
tree `839e77…`; sorting the manifest inside the verifier is forbidden.

Do not create product commits or push a product branch.

- [ ] **Step 7: Add a separate moving-staging drift mode**

Read the current remote `refs/heads/staging`, record its observed SHA/time, and attempt the series in a disposable checkout. The outcome is one of:

```text
clean
already-equivalent
conflict
unavailable
```

It never changes the immutable-base result. A conflict against current staging is a maintenance signal, not evidence that the archived source series is corrupt.
Add focused tests for both discriminated branches: `unavailable` records an
ISO timestamp and forbids `observedStagingSha`; `clean`,
`already-equivalent`, and `conflict` each require the observed 40-character
lowercase hexadecimal staging SHA plus the ISO timestamp. The implementation
constructs only those exact `DriftVerification` shapes.

- [ ] **Step 8: Run local verification and safe product tests**

Create a disposable exact-base checkout; do not pass the source-head worktree:

```bash
npx tsx --test --test-name-pattern="returns the final patched worktree" tests/patchsets/patchset-verification.test.ts
npx tsx --test tests/patchsets/patchset-verification.test.ts
PRODUCT_FIXTURE="$(mktemp -d)/freeland-base"
git clone --no-local /Users/danilsolomin/Documents/Freeland/.worktrees/staging-qa "$PRODUCT_FIXTURE"
git -C "$PRODUCT_FIXTURE" checkout --detach c702465facd4971eb456ce8efe92dd9a3d694139
npm run patchset:verify -- --product-dir "$PRODUCT_FIXTURE" --mode immutable-base --leave-applied
test "$(git -C "$PRODUCT_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_FIXTURE" diff --exit-code
```

Only after the tree assertion, run all safe product checks against that same
`$PRODUCT_FIXTURE`:

```bash
git -C "$PRODUCT_FIXTURE" diff --exit-code
FREELAND_PRODUCT_ROOT="$PRODUCT_FIXTURE" npm run test:product-contracts
corepack pnpm install --dir "$PRODUCT_FIXTURE" --frozen-lockfile
test "$(git -C "$PRODUCT_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_FIXTURE" diff --exit-code
corepack pnpm --dir "$PRODUCT_FIXTURE" test:staging-cdp-harness
test "$(git -C "$PRODUCT_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_FIXTURE" diff --exit-code
corepack pnpm --dir "$PRODUCT_FIXTURE" test:ci
git -C "$PRODUCT_FIXTURE" diff --exit-code
```

These are local source/unit checks only. Do not run `staging:e2e:*`.

- [ ] **Step 9: Commit**

```bash
git add patchsets tools/patchsets tests/patchsets docs/runbooks/verified-product-patchset.md packages/contracts/schemas/patchset-manifest.v1.schema.json
git commit -m "feat: preserve the verified Freeland product patchset"
```

---

### Task 9: Add Repository Secret/Privacy Scanning and Deterministic CI

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/security/scan-repository.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/security/repository-scan.test.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.github/branch-protection.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.github/workflows/baseline.yml`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/.github/workflows/patchset.yml`
- Modify: `/Users/danilsolomin/projectsnew/FreelandQA/package.json`

**Interfaces:**

- **Consumes:** a repository path, tracked filenames/blobs, and optionally all
  reachable historical blobs; detector input is never persisted.
- **Produces:** sorted metadata-only findings and two required GitHub check
  contexts.

```ts
export type ScanLocation =
  | { kind: 'tree'; file: string; line: number }
  | { kind: 'history'; commit: string; file: string; line: number };

export interface ScanFinding {
  detector: string;
  location: ScanLocation;
}

export interface ScanDetector {
  name: string;
  find(input: string): ReadonlyArray<{ line: number }>;
}

export function scanTrackedTree(repo: string): Promise<ScanFinding[]>;
export function scanReachableHistory(repo: string): Promise<ScanFinding[]>;
export function formatFinding(finding: ScanFinding): string;
```

`formatFinding()` emits only detector, commit/file, and line. Required check
contexts are exactly `Baseline / deterministic` and `Patchset /
immutable-base`.

- [ ] **Step 1: Write failing repository-scanner tests**

Use generated temporary repositories. Prove detection of:

```text
tracked .env and storage-state paths
private-key and bearer-token markers
Nuanu/GitHub/Plane/Supabase-shaped tokens
Luhn-valid 13-19 digit sequences generated at test runtime
numeric security-code assignments generated at test runtime
password assignments
provider checkout URLs with query data
absolute user-home paths
internal mesh addresses
a secret committed and then deleted from the working tree
```

The scanner must report detector name, commit/file, and line number without printing the detected value.

Generate and run one isolated temporary-repository case per micro-cycle:

- [ ] forbidden env/auth path;
- [ ] private key/bearer marker;
- [ ] Nuanu/GitHub/Plane/Supabase token shape;
- [ ] runtime-generated Luhn sequence;
- [ ] runtime-generated security-code assignment;
- [ ] password assignment;
- [ ] provider checkout URL query;
- [ ] absolute home path;
- [ ] internal mesh address;
- [ ] committed-then-deleted secret;
- [ ] metadata-only masked output.

- [ ] **Step 2: Run and prove the scanner tests fail**

```bash
npx tsx --test tests/security/repository-scan.test.ts
```

- [ ] **Step 3: Implement tracked-file and history scanning**

Implement through these focused checkpoints:

- [ ] add one tracked-text fixture; implement `git ls-files -z` enumeration;
- [ ] add one forbidden filename fixture; scan filenames before content;
- [ ] add one binary evidence-path fixture; reject the path without reading it;
- [ ] add one patch fixture; scan patch text as ordinary UTF-8;
- [ ] add one Markdown fixture; scan documentation as ordinary UTF-8;
- [ ] add one deleted-secret commit fixture; enumerate reachable commits and
      their blob/file pairs;
- [ ] add one duplicate-blob fixture; de-duplicate reads by blob OID without
      losing commit/file locations;
- [ ] add an output-capture assertion; implement metadata-only
      `formatFinding()`;
- [ ] run the full scanner test twice and require stable sorted findings.

Use argument-array Git calls and keep the matched value out of the result:

```ts
export async function scanTrackedTree(repo: string): Promise<ScanFinding[]> {
  const files = splitNul(await gitStdout(repo, ['ls-files', '-z']));
  const findings: ScanFinding[] = [];
  for (const file of files.toSorted()) {
    findings.push(...scanPath(file, { kind: 'tree', file, line: 0 }));
    if (isForbiddenBinaryPath(file)) continue;
    const bytes = await gitBuffer(repo, ['show', `:${file}`]);
    if (isBinaryBuffer(bytes)) continue;
    const content = bytes.toString('utf8');
    findings.push(...scanText(content, (line) => ({ kind: 'tree', file, line })));
  }
  return sortFindings(findings);
}

export async function scanReachableHistory(
  repo: string,
): Promise<ScanFinding[]> {
  const commits = (await gitStdout(repo, ['rev-list', '--all']))
    .split('\n')
    .filter(Boolean);
  const blobMatches = new Map<
    string,
    Array<{ detector: string; line: number }>
  >();
  const findings: ScanFinding[] = [];
  for (const commit of commits) {
    const entries = parseLsTree(
      await gitBuffer(repo, ['ls-tree', '-r', '-z', commit]),
    );
    for (const { oid, file } of entries) {
      const location = (line: number): ScanLocation => ({
        kind: 'history',
        commit,
        file,
        line,
      });
      findings.push(...scanPath(file, location(0)));
      if (isForbiddenBinaryPath(file)) continue;
      let matches = blobMatches.get(oid);
      if (matches === undefined) {
        const bytes = await gitBuffer(repo, ['cat-file', 'blob', oid]);
        matches = isBinaryBuffer(bytes)
          ? []
          : detectorMatches(bytes.toString('utf8'));
        blobMatches.set(oid, matches);
      }
      findings.push(
        ...matches.map(({ detector, line }) => ({
          detector,
          location: location(line),
        })),
      );
    }
  }
  return sortFindings(findings);
}

function scanText(
  input: string,
  location: (line: number) => ScanLocation,
): ScanFinding[] {
  return detectorMatches(input).map(({ detector, line }) => ({
    detector,
    location: location(line),
  }));
}

export function formatFinding(finding: ScanFinding): string {
  const location =
    finding.location.kind === 'history'
      ? `${finding.location.commit}:${finding.location.file}:${finding.location.line}`
      : `${finding.location.file}:${finding.location.line}`;
  return `${finding.detector} ${location}`;
}
```

`parseLsTree`, `isBinaryBuffer`, `detectorMatches`, `scanPath`, and
`sortFindings` are private in `scan-repository.ts`; Step 3 contains one direct
fixture for each. The tool imports the shared argument-array `gitBuffer` and
`gitStdout` from `tools/patchsets/git-io.ts`, so it never invokes a shell.

Ignore binary contents but still reject forbidden binary/evidence path classes. Do not add a suppressions file for real secrets. Synthetic false positives must be changed at source to clearly non-secret `.invalid` data.

- [ ] **Step 4: Create the baseline workflow**

`baseline.yml` runs on pull requests, pushes to `main`, and manual dispatch. It uses Node 20 and:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run coverage:validate
npm run test:list
npm run security:scan
git diff --exit-code
```

It must not:

```text
install a browser
load staging credentials
contact Freeland
contact Nuanu
run Playwright tests
run a purchase
upload raw evidence
accept zero tests
```

Write and validate the exact job skeleton before adding commands one at a
time:

```yaml
name: Baseline
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  deterministic:
    name: deterministic
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run coverage:validate
      - run: npm run test:list
      - run: npm run security:scan
      - run: git diff --exit-code
```

After each `run` line, parse the YAML in a unit assertion and run the same
command locally before adding the next line.

- [ ] **Step 5: Create the immutable patchset workflow**

`patchset.yml` uses a second read-only checkout of `nuanu-ai/freeland_app` pinned to `c702465facd4971eb456ce8efe92dd9a3d694139`, with:

```yaml
persist-credentials: false
path: .product/freeland
```

It runs:

```bash
npm ci
npm run patchset:verify -- --product-dir .product/freeland --mode immutable-base --leave-applied
test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C .product/freeland diff --exit-code
FREELAND_PRODUCT_ROOT="$GITHUB_WORKSPACE/.product/freeland" npm run test:product-contracts
corepack pnpm install --dir .product/freeland --frozen-lockfile
test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C .product/freeland diff --exit-code
corepack pnpm --dir .product/freeland test:staging-cdp-harness
test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C .product/freeland diff --exit-code
corepack pnpm --dir .product/freeland test:ci
git -C .product/freeland diff --exit-code
```

The workflow has one step named `Assert patched product tree` between the
verifier and every product test. If that assertion fails, no product command
runs. Because `.product/freeland` is a disposable checkout pinned at the base
and the verifier leaves both index and worktree patched, all three product
commands consume final tree `839e77…`.

No staging URL, test account, Nuanu token, payment data, browser profile, or provider secret is available to this job.

The exact executable job is:

```yaml
name: Patchset
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  immutable-base:
    name: immutable-base
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: actions/checkout@v4
        with:
          repository: nuanu-ai/freeland_app
          ref: c702465facd4971eb456ce8efe92dd9a3d694139
          path: .product/freeland
          ssh-key: ${{ secrets.FREELAND_SOURCE_DEPLOY_KEY }}
          persist-credentials: false
      - run: npm run patchset:verify -- --product-dir .product/freeland --mode immutable-base --leave-applied
      - name: Assert patched product tree
        run: |
          test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
          git -C .product/freeland diff --exit-code
      - run: FREELAND_PRODUCT_ROOT="$GITHUB_WORKSPACE/.product/freeland" npm run test:product-contracts
      - run: corepack pnpm install --dir .product/freeland --frozen-lockfile
      - run: |
          test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
          git -C .product/freeland diff --exit-code
      - run: corepack pnpm --dir .product/freeland test:staging-cdp-harness
      - run: |
          test "$(git -C .product/freeland write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
          git -C .product/freeland diff --exit-code
      - run: corepack pnpm --dir .product/freeland test:ci
      - run: git -C .product/freeland diff --exit-code
```

Add one workflow parser assertion per step: exact product ref, read-only
checkout, `--leave-applied`, tree assertion before all product tests, then the
three exact product commands.

- [ ] **Step 6: Track the exact branch-protection payload**

Create `.github/branch-protection.json` with the exact payload specified in
Task 11 Step 5 so the initial private push contains the reviewed protection
policy.

- [ ] **Step 7: Add a non-required drift job**

On schedule/manual dispatch, fetch the moving `staging` head and run `--mode drift`. Mark its result as a maintenance report. Do not make it replace the required immutable-base check and do not apply or push changes upstream.

- [ ] **Step 8: Run the full local deterministic gate**

```bash
npm run verify:deterministic
PRODUCT_CI_FIXTURE="$(mktemp -d)/freeland-base"
git clone --no-local /Users/danilsolomin/Documents/Freeland/.worktrees/staging-qa "$PRODUCT_CI_FIXTURE"
git -C "$PRODUCT_CI_FIXTURE" checkout --detach c702465facd4971eb456ce8efe92dd9a3d694139
npm run patchset:verify -- --product-dir "$PRODUCT_CI_FIXTURE" --mode immutable-base --leave-applied
test "$(git -C "$PRODUCT_CI_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_CI_FIXTURE" diff --exit-code
FREELAND_PRODUCT_ROOT="$PRODUCT_CI_FIXTURE" npm run test:product-contracts
corepack pnpm install --dir "$PRODUCT_CI_FIXTURE" --frozen-lockfile
test "$(git -C "$PRODUCT_CI_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_CI_FIXTURE" diff --exit-code
corepack pnpm --dir "$PRODUCT_CI_FIXTURE" test:staging-cdp-harness
test "$(git -C "$PRODUCT_CI_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$PRODUCT_CI_FIXTURE" diff --exit-code
corepack pnpm --dir "$PRODUCT_CI_FIXTURE" test:ci
git -C "$PRODUCT_CI_FIXTURE" diff --exit-code
git diff --check
```

- [ ] **Step 9: Commit**

```bash
git add tools/security tests/security .github package.json package-lock.json
git commit -m "ci: enforce deterministic baseline and patch verification"
```

---

### Task 10: Prove a Clean Local Clone and Record Subproject Acceptance

**Files:**

- Create: `/Users/danilsolomin/projectsnew/FreelandQA/coverage/bootstrap/subproject-1-acceptance.v1.json`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/runbooks/clean-clone-verification.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/docs/history/2026-07-31-subproject-1-acceptance.md`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tools/acceptance/render-subproject-acceptance.ts`
- Create: `/Users/danilsolomin/projectsnew/FreelandQA/tests/acceptance/subproject-acceptance.test.ts`

**Interfaces:**

- **Consumes:** the final local commit, an exact-base disposable product
  checkout, and canonical generated reports.
- **Produces:** a clean `git clone --no-local` verification and one sanitized
  acceptance Markdown record.

```ts
import type { DriftVerification } from './patchset.js';

export interface SubprojectAcceptance {
  schemaVersion: 1;
  repositoryCommit: string;
  toolVersions: { node: string; npm: string; playwright: string };
  inventory: { legacyRows: 161; playwrightTests: 164; testFiles: 24 };
  qaSnapshot: { capturedAt: string; count: number; mapped: number; missing: number };
  patch: { fixedBase: 'pass'; movingStaging: DriftVerification['result'] };
  securityScan: 'pass';
  writes: { nuanu: 0; purchases: 0 };
}

export function renderSubprojectAcceptance(
  input: SubprojectAcceptance,
): string;
```

`SubprojectAcceptance` is implemented in
`packages/contracts/src/acceptance.ts`; the renderer/CLI is implemented in
`tools/acceptance/render-subproject-acceptance.ts`.

Clean-clone command contract: `npm ci && npm run verify:deterministic`.

- [ ] **Step 1: Clone the local repository into a new temporary directory**

Use an explicit `mktemp -d` path and `git clone --no-local`. Do not copy the working directory.

- [ ] **Step 2: Run clean-clone dependency and type gates**

Inside the clone:

```bash
npm ci
npm run typecheck
npm run test:unit
```

- [ ] **Step 3: Run the registry and enumeration gates**

```bash
npm run coverage:validate
npm run test:list
npm run security:scan
```

Require:

```text
legacy matrix rows = 161
baseline Playwright tests = 164
baseline test/setup files = 24
baseline support + test files tracked = 29
zero-test gate = armed
captured QA issues = stable mapping files
unrepresented QA issues = 0
stale mappings at capture = 0
```

- [ ] **Step 4: Verify the patchset from the clean clone**

From the clean QA clone, create and verify the exact disposable product tree:

```bash
CLEAN_PRODUCT_FIXTURE="$(mktemp -d)/freeland-base"
git clone --no-local /Users/danilsolomin/Documents/Freeland/.worktrees/staging-qa "$CLEAN_PRODUCT_FIXTURE"
git -C "$CLEAN_PRODUCT_FIXTURE" checkout --detach c702465facd4971eb456ce8efe92dd9a3d694139
npm run patchset:verify -- --product-dir "$CLEAN_PRODUCT_FIXTURE" --mode immutable-base --leave-applied
test "$(git -C "$CLEAN_PRODUCT_FIXTURE" write-tree)" = "839e77b1640f682486a297210b30f0fbc1211219"
git -C "$CLEAN_PRODUCT_FIXTURE" diff --exit-code
```

Require all six intermediate trees in verifier output, the exact final tree,
and no worktree/index difference.

- [ ] **Step 5: Prove generated outputs are clean**

After all checks:

```bash
git status --short
git diff --exit-code
```

Expected output: empty status and zero diff.

- [ ] **Step 6: Write the sanitized acceptance record**

Record:

- exact Git commit;
- Node/npm/Playwright versions;
- 161/164 inventory counts;
- fresh QA snapshot capture time and count;
- number mapped versus explicitly missing;
- fixed-base patch result;
- moving-staging drift result;
- secret/history scan result;
- confirmation of zero Nuanu writes and zero live purchases.

Do not include issue descriptions, account data, network addresses, local paths, secrets, or evidence payloads.

Implement in red/green checkpoints:

- [ ] reject a non-40-hex repository commit;
- [ ] reject inventory values other than `161/164/24`;
- [ ] reject any nonzero Nuanu write or purchase;
- [ ] reject fixed-base patch results other than `pass`;
- [ ] reject missing QA mapped/missing counts;
- [ ] render the exact Markdown headings and values;
- [ ] run migration safety and repository security scanning on JSON plus
      Markdown;
- [ ] run the renderer twice and require byte-identical output.

The renderer has no free-form interpolation:

```ts
export function renderSubprojectAcceptance(
  input: SubprojectAcceptance,
): string {
  validateSubprojectAcceptance(input);
  return [
    '# FreelandQA subproject 1 acceptance',
    '',
    `- Verified repository commit: \`${input.repositoryCommit}\``,
    `- Toolchain: Node ${input.toolVersions.node}; npm ${input.toolVersions.npm}; Playwright ${input.toolVersions.playwright}`,
    `- Inventory: ${input.inventory.legacyRows} legacy rows; ${input.inventory.playwrightTests} Playwright tests; ${input.inventory.testFiles} test/setup files`,
    `- QA snapshot: ${input.qaSnapshot.capturedAt}; ${input.qaSnapshot.count} captured; ${input.qaSnapshot.mapped} mapped; ${input.qaSnapshot.missing} explicitly missing`,
    `- Fixed-base patch: ${input.patch.fixedBase}`,
    `- Moving staging drift: ${input.patch.movingStaging}`,
    `- Repository and history scan: ${input.securityScan}`,
    `- External writes: Nuanu ${input.writes.nuanu}; purchases ${input.writes.purchases}`,
    '',
  ].join('\n');
}
```

The verified commit is the clean commit tested before this generated record;
the subsequent documentation commit does not claim to verify itself.

- [ ] **Step 7: Commit and repeat the clean-clone gate**

```bash
git add coverage/bootstrap/subproject-1-acceptance.v1.json docs/runbooks/clean-clone-verification.md docs/history/2026-07-31-subproject-1-acceptance.md tools/acceptance tests/acceptance
git commit -m "docs: record Freeland QA baseline acceptance"
```

Repeat Steps 1-5 against this final local commit.

---

### Task 11: Publish Privately and Configure Read-Only Product Access

> **Approved GitHub Free-safe supersession (2026-08-02):** Tasks 1–10 and
> this task's credential/exact-workflow requirements remain authoritative.
> The paid private-branch-protection requirement is superseded. Do not execute
> the historical protection operations; complete Task 11 through the exact
> detect-and-refuse I0 record in the sibling
> [Freeland Agent-First CDP Feedback Loop plan](./2026-08-02-freeland-agent-first-cdp-feedback-loop.md#task-1-collect-the-github-free-safe-remote-entry-gate-fl-cdp-i0).

**Files:**

- Read: `.github/workflows/baseline.yml`
- Read: `.github/workflows/patchset.yml`
- Read: `docs/superpowers/plans/2026-08-02-freeland-agent-first-cdp-feedback-loop.md`

**Interfaces:**

- **Consumes:** the accepted local `main`, authenticated `gh`, and either
  product-repository admin permission or an administrator-provided read-only
  credential.
- **Produces:** `nuanu-ai/FreelandQA` as a private repository, two passing
  exact required checks, read-only product checkout access, and the sibling
  plan's canonical Free-safe I0 integrity record.
- **Remote contract:** visibility `PRIVATE`, immutable repository ID
  `1319799876`, default branch `main`, automatic merge disabled, and exact
  before/after `main` snapshots around every permitted operation. GitHub Free
  does not provide server-side private-branch push prevention.
- **Credential contract:** deploy key or repository-scoped GitHub App with
  `contents:read`; never a broad personal token.

**Historical publication state — do not execute the superseded creation path:**

- The private repository already exists as `nuanu-ai/FreelandQA`, immutable
  REST repository ID `1319799876`, with canonical
  `main@a4df0c5e4b57dfda3ed658171452cccda6095d52`.
- The transfer from the personal namespace was explicitly approved and is
  complete. Never recreate the repository, change its namespace/visibility,
  force-push, or repush `main` from this baseline plan.
- Product deploy-key creation/installation is an out-of-band administrator
  prerequisite. The administrator supplies the exact read-only attestation
  and matching protected private key; this plan never generates, uploads, or
  deletes key material.
- The repository Actions-secret write and both workflow dispatches have not
  been accepted as completion evidence. They are performed exactly once only
  inside the sibling Task 1 six-operation ledger, with before/after snapshots
  and bounded exact-run selection.

Resume directly at Step 5. No GitHub mutation in the removed historical path
is authorized.

- [ ] **Step 5: Hand off to the canonical GitHub Free-safe I0 gate**

Task 9's already-tracked historical payload remains byte-exact so Tasks 1–10
are not rewritten:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Baseline / deterministic",
      "Patchset / immutable-base"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
```

It is a historical repository artifact only. Do not apply it, read it back as
success evidence, or claim it protects private `main` on GitHub Free.

Do not call a branch-protection, merge, auto-merge, force-push, deletion, or
`main` update API. Continue with Tasks 1–2 in the sibling plan. They must prove
and record:

```text
private nuanu-ai/FreelandQA repository ID 1319799876
GitHub organization plan free
repository ADMIN for the Actions-secret operation
automatic merge disabled
read-only source attestation and matching private-key fingerprint
exact Baseline and Patchset workflow/run/job/head windows
unchanged entry main before and after each of six ordered I0 operations
mode detect-and-refuse and serverSidePushPrevention false
canonical compact I0 JSON plus LF and its exact-byte SHA-256
```

The six operations are exactly repository secret write, Baseline dispatch,
Patchset dispatch, Baseline run selection, Patchset run selection, and feature
worktree creation. Any drift, failed read, duplicate/old run, or changed source
attestation closes the gate without retry. The owner accepts the residual risk
that GitHub Free cannot prevent a privileged direct push before observation.

- [ ] **Step 6: Treat the sibling I0 record as Task 11 completion evidence**

Task 11 is complete only when
`coverage/bootstrap/cdp-i0-entry-gate.v1.json` exists on the exact feature
branch, validates against its closed schema, contains no protection-success
field, and the sibling plan's history record identifies its exact-byte digest.
No claim that `main` is protected is permitted. Final integration remains a
human action after the sibling plan's complete I1 evidence and delivery
receipt.

---

## Final Acceptance Matrix

Before declaring subproject 1 complete, report evidence for every row:

| Approved criterion | Required evidence |
|---|---|
| Private `FreelandQA` repo with Free-safe integrity record | Repository ID/private/default-branch read-back; exact `main` before/after every permitted operation; automatic merge disabled; canonical detect-and-refuse I0 record |
| Authoritative tests and safe docs tracked | 29 baseline files, promoted regressions, sanitized-doc allowlist, ignored-evidence denylist |
| Clean clone installs, type-checks, and enumerates | Fresh remote clone; `npm ci`; typecheck; exact 164/24 list |
| Zero tests cannot pass | Unit proof plus `capture-playwright --check` nonzero behavior |
| 161-row matrix normalized conservatively | Exact count, unique IDs, lifecycle report, no legacy-derived pass |
| 164-test suite normalized | Unique stable tags, reviewed result policies, exact manifest |
| Every current QA ticket accounted for | Atomic snapshot count equals mapping count; every mapping is `mapped` or explicit `missing` |
| Six commits preserved or proven upstream-equivalent | Fixed-base SHA/tree/patch-ID proof and product-safe tests |
| CI validates registry, secrets, patch, deterministic suite | Two passing required workflows |
| No Nuanu mutation | Tool audit/log statement showing read-only calls only |
| No live purchase | Command ledger showing discovery/unit/source-only execution |
| No committed secrets or sensitive evidence | Current-tree and history scan pass |

Subproject 1 is not complete if the private product checkout credential is unavailable, either required workflow is red, the canonical Free-safe I0 record is absent/invalid, a QA issue is unrepresented, the clean clone selects zero tests, or a secret/evidence scan fails.

---

## Execution Handoff

After this plan is approved for execution, use one of:

1. `superpowers:subagent-driven-development` in the current task, with a fresh implementation subagent and review after each task.
2. `superpowers:executing-plans` for inline sequential execution with the same task boundaries and commits.

Do not combine this plan with subproject 2 until every row in the final acceptance matrix is green.

## Follow-on Plan

To close the still-pending remote/publication gate and then implement the next capability slice, continue with [Freeland Agent-First CDP Feedback Loop I0/I1](./2026-08-02-freeland-agent-first-cdp-feedback-loop.md). Its Tasks 1–2 are the authoritative GitHub Free-safe completion of this plan's unfinished Task 11: Tasks 1–10 and the credential/exact-workflow requirements here remain unchanged, while paid private-branch protection is explicitly superseded. Its Task 2 cannot start until the exact Task 1 observation bundle is complete, and Task 3 cannot start until the canonical I0 record is committed.

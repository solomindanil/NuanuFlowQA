# Freeland Agent-First CDP Feedback Loop — Design

**Status:** Approved in conversation on 2026-08-02; private GitHub Free-safe
amendment and written specification approved by the owner on 2026-08-02

**Program:** Freeland autonomous QA harness

**First delivery target:** read-only public staging observation

**Target implementation repository:** private `FreelandQA`

## 1. Decision

Add an agent-first Chrome DevTools Protocol feedback loop to the Freeland QA
program as a separate, typed capability broker owned by `FreelandQA`.

The broker gives an agent a small set of schema-validated browser operations.
It does not expose raw CDP, arbitrary JavaScript, browser storage, credentials,
or unrestricted network access. The first iteration observes explicitly
allowlisted, non-sensitive public pages on the exact deployed Freeland staging
candidate. It cannot mutate product data, open a checkout, submit a payment, or
change a Nuanu Flow item.

This design adopts the useful pattern from OpenAI's
[Harness Engineering](https://openai.com/index/harness-engineering/) work:
give agents direct, structured browser feedback so they can reproduce a UI
problem and validate behavior. It preserves Freeland's stronger environment,
mutation, evidence, and payment boundaries instead of turning the existing
payment canary into a generic browser tool.

## 2. Relationship to the Existing Program

This design extends, but does not rewrite, the approved
[`Freeland Autonomous QA Harness` design](./2026-07-31-freeland-autonomous-qa-harness-design.md).
The existing definitions of coverage, ticket/candidate freezing, verdicts,
Computer Use, payment handling, Nuanu routing, shadow calibration, and program
completion remain authoritative. The owner's later GitHub Free-safe decision
supersedes only the earlier protected-private-branch requirement; it does not
weaken any product, payment, privacy, evidence, or candidate rule.

The current
[`Repository Baseline and Coverage Registry` plan](../plans/2026-07-31-freeland-repository-baseline-and-coverage-registry.md)
implements only program subproject 1. Its Tasks 1–10, credential contract, and
exact workflow requirements remain unchanged. Its Task 11 and final acceptance
matrix are superseded only where they require paid private-branch protection;
the Free-safe integrity contract below governs instead. The CDP feedback loop
keeps its own sibling implementation plan; it is not appended as Task 12 and
does not cause completed baseline tasks to be renumbered.

Implementation cannot cross the `I0` entry gate until Task 11 proves all of the
following against one immutable `nuanu-ai/FreelandQA` commit:

1. the remote repository is private and its immutable REST repository ID is
   `1319799876`;
2. read-only product-source access uses the approved deploy key or
   repository-scoped GitHub App;
3. both exact required workflows pass on that commit;
4. the GitHub Free-safe integrity gate records that server-side private-branch
   protection is unavailable, automatic merge is disabled, and `main` equals
   the entry commit before and after every external step;
5. the accepted coverage revision and product patchset proof are pinned.

The owner explicitly accepts the narrow residual risk of GitHub Free: a user
with write authority can push before the harness observes it. This gate is
therefore detect-and-refuse, not prevent-and-claim. The closed operation ledger
below enumerates every guarded I0 and delivery step, including run selection,
feature-worktree creation, acceptance-record commit, feature push, PR creation,
and PR comment. Immediately before and after each step, the harness re-reads
repository ID, private visibility, default branch, and exact `main` SHA. Any
drift, object replacement, ambiguous run selection, or failed read closes the
gate without retrying, merging, or starting the next operation.

The canonical I0 record must state this limitation directly. It must not use a
field named `branchProtection`, `protected`, or any equivalent success claim.
Instead it records this closed conceptual contract:

```ts
interface FreePlanRepositorySnapshot {
  repositoryId: 1319799876;
  visibility: 'PRIVATE';
  defaultBranch: 'main';
  mainSha: string; // exact 40-lowercase-hex entry commit
}

type FreePlanI0Operation =
  | 'repository-secret-write'
  | 'baseline-workflow-dispatch'
  | 'patchset-workflow-dispatch'
  | 'baseline-run-selection'
  | 'patchset-run-selection'
  | 'feature-worktree-create';

type FreePlanDeliveryOperation =
  | 'acceptance-record-commit'
  | 'feature-branch-push'
  | 'pull-request-create'
  | 'baseline-pr-run-selection'
  | 'patchset-pr-run-selection'
  | 'pull-request-comment';

type FreePlanOperation = FreePlanI0Operation | FreePlanDeliveryOperation;

interface FreePlanOperationAttestation<
  TOperation extends FreePlanOperation,
> {
  operation: TOperation;
  before: FreePlanRepositorySnapshot;
  after: FreePlanRepositorySnapshot;
  result: 'observed_no_drift';
}

interface FreePlanDispatchOperation<
  TOperation extends
    | 'baseline-workflow-dispatch'
    | 'patchset-workflow-dispatch',
  TWorkflow extends 'baseline.yml' | 'patchset.yml',
> extends FreePlanOperationAttestation<TOperation> {
  workflowFile: TWorkflow;
  preWindowMaxRunId: number;
  windowOpenedAt: string;
}

interface FreePlanRunSelectionOperation<
  TOperation extends
    | 'baseline-run-selection'
    | 'patchset-run-selection'
    | 'baseline-pr-run-selection'
    | 'patchset-pr-run-selection',
  TWorkflow extends 'baseline.yml' | 'patchset.yml',
  TJob extends 'deterministic' | 'immutable-base',
  TEvent extends 'workflow_dispatch' | 'pull_request',
  TExpectedHeadRole extends 'entryCommit' | 'acceptedFeatureHead',
> extends FreePlanOperationAttestation<TOperation> {
  workflowFile: TWorkflow;
  event: TEvent;
  preWindowMaxRunId: number;
  windowOpenedAt: string;
  exactlyOneMatch: true;
  runId: number;
  createdAt: string;
  expectedHeadRole: TExpectedHeadRole;
  expectedHeadSha: string;
  headSha: string;
  headMatchesExpected: true;
  conclusion: 'success';
  requiredJob: TJob;
  requiredJobConclusion: 'success';
}

interface FreePlanFeaturePushOperation
  extends FreePlanOperationAttestation<'feature-branch-push'> {
  branch: 'codex/freeland-agent-first-cdp-i1';
  acceptedFeatureHead: string;
  pushedHeadSha: string;
  headMatchesAcceptedFeatureHead: true;
  baselinePreWindowMaxRunId: number;
  patchsetPreWindowMaxRunId: number;
  windowOpenedAt: string;
}

interface FreePlanSourceAccessAttestation {
  repository: 'nuanu-ai/freeland_app';
  title: 'FreelandQA read-only source checkout';
  fingerprint: string;
  attestationSha256: string;
  readOnly: true;
  allowWrite: false;
  privateKeyFingerprintMatched: true;
}

interface FreePlanIntegrityBase {
  mode: 'detect-and-refuse';
  serverSidePushPrevention: false;
  automaticMerge: false;
  harnessMayUpdateMain: false;
  ownerAcceptedResidualRisk: true;
}

interface FreePlanI0IntegrityRecord extends FreePlanIntegrityBase {
  schemaVersion: 1;
  entryCommit: string;
  sourceAccess: {
    before: FreePlanSourceAccessAttestation;
    after: FreePlanSourceAccessAttestation;
  };
  i0Operations: [
    FreePlanOperationAttestation<'repository-secret-write'>,
    FreePlanDispatchOperation<
      'baseline-workflow-dispatch',
      'baseline.yml'
    >,
    FreePlanDispatchOperation<
      'patchset-workflow-dispatch',
      'patchset.yml'
    >,
    FreePlanRunSelectionOperation<
      'baseline-run-selection',
      'baseline.yml',
      'deterministic',
      'workflow_dispatch',
      'entryCommit'
    >,
    FreePlanRunSelectionOperation<
      'patchset-run-selection',
      'patchset.yml',
      'immutable-base',
      'workflow_dispatch',
      'entryCommit'
    >,
    FreePlanOperationAttestation<'feature-worktree-create'>,
  ];
}

interface FreePlanDeliveryReceipt extends FreePlanIntegrityBase {
  schemaVersion: 1;
  i0RecordSha256: string;
  i1AcceptanceRecordSha256: string;
  i1AcceptanceCommit: string;
  acceptedFeatureHead: string;
  i0: FreePlanI0IntegrityRecord;
  deliveryOperations: [
    FreePlanOperationAttestation<'acceptance-record-commit'>,
    FreePlanFeaturePushOperation,
    FreePlanOperationAttestation<'pull-request-create'>,
    FreePlanRunSelectionOperation<
      'baseline-pr-run-selection',
      'baseline.yml',
      'deterministic',
      'pull_request',
      'acceptedFeatureHead'
    >,
    FreePlanRunSelectionOperation<
      'patchset-pr-run-selection',
      'patchset.yml',
      'immutable-base',
      'pull_request',
      'acceptedFeatureHead'
    >,
    FreePlanOperationAttestation<'pull-request-comment'>,
  ];
}
```

Each tuple entry occurs exactly once and in the displayed order. Every
before/after snapshot is recursively closed and must equal repository ID
`1319799876`, private visibility, default branch `main`, and
`FreePlanI0IntegrityRecord.entryCommit`. Timestamps are canonical UTC instants,
run IDs and pre-window maxima are non-negative safe integers, and a selected
run ID must be greater than its stored maximum. Each selection echoes the exact
window opened by its corresponding dispatch or feature push, has exactly one
match, and requires `createdAt >= windowOpenedAt`. For I0 selections,
`expectedHeadSha`, `headSha`, and the enclosing `entryCommit` must be equal. For
PR selections, both SHA fields must equal the enclosing
`acceptedFeatureHead`. The feature-push operation requires
`acceptedFeatureHead === pushedHeadSha === i1AcceptanceCommit` and
`headMatchesAcceptedFeatureHead:true`. Any unequal SHA rejects the closed
record even when every other field is valid. Old runs, duplicate matches,
renamed/similarly named workflows, reruns outside the window, or ambiguous
selection fail the gate.

The product deploy key is an out-of-band administrator prerequisite rather
than a harness write. Its closed administrator attestation digest, non-secret
public-key fingerprint, `readOnly:true`, `allowWrite:false`, and local private
key fingerprint match are persisted before the first I0 operation and
revalidated into the exact `after` object after the final I0 operation. The two
objects must be byte-for-byte equal. No key bytes enter the integrity record.

The canonical I0 record is schema version 1 at
`coverage/bootstrap/cdp-i0-entry-gate.v1.json`. It contains the base integrity
fields, `entryCommit`, `sourceAccess`, and the complete `i0Operations` tuple.
Its canonical encoding is compact JSON plus exactly one trailing LF;
`i0RecordSha256` is SHA-256 over those exact on-disk bytes, including the LF.

The pre-delivery I1 record is schema version 1 at
`coverage/bootstrap/cdp-i1-acceptance.v1.json`. It stores
`i0RecordSha256`, the local acceptance claims, and the exact implementation
commit that must become the acceptance commit's sole parent. Its own digest
uses the same exact-byte algorithm. It cannot contain its self-referential
future commit hash or later PR facts.

After feature push, PR creation, both exact PR-run selections, and the one
sanitized PR comment have all completed and received their post-step snapshot,
the collector writes the complete `FreePlanDeliveryReceipt` as canonical
compact JSON plus LF to the ignored private path
`.work/cdp-i1-delivery/receipt.v1.json`. It binds the exact I0 and I1 record
digests, embeds the validated I0 record unchanged, requires
`i1AcceptanceCommit === acceptedFeatureHead`, and appends the complete delivery
tuple. The receipt is the final local action: no network request, Git mutation,
push, PR update, or comment may occur afterward. GitHub retains the feature
head, run IDs/URLs, and sanitized comment for independent reconstruction; the
comment does not claim to contain its own post-comment receipt.

Before writing the delivery receipt, the collector proves that
`i1AcceptanceCommit` has exactly one parent equal to the I1 record's
implementation commit and that the acceptance commit changes only the two
reviewed canonical acceptance paths. It then requires
`acceptedFeatureHead === i1AcceptanceCommit` without attempting to place that
future hash inside the earlier committed record. The receipt validator also
requires the I1 record's stored `i0RecordSha256` to equal both the receipt's
`i0RecordSha256` and the digest recomputed from its embedded canonical I0
record.

The harness may push only `codex/freeland-agent-first-cdp-i1`; it may never
push or update `refs/heads/main`, invoke a merge or auto-merge API, or treat a
PR as integrated. Final integration is a human action.

Repository-level Actions secrets remain supported on the free plan, but the
operator needs repository `ADMIN` to create and manage them. Design and
planning may continue while administrator permission and the read-only deploy
key attestation are being resolved. Runtime implementation does not bypass
either dependency.

## 3. Audited Starting Point

The product worktree already contains a strong but narrow staging CDP harness:

- a raw WebSocket CDP client with request routing, events, session IDs, target
  discovery, and timeouts;
- loopback-only CDP and strict staging target guards;
- exact staging environment and release-SHA preflight;
- typed, product-specific UI projections for VPN and virtual-number purchases;
- a default-deny request gate with exactly-one-checkout semantics;
- scalar, schema-limited, redacted evidence;
- durable local payment-resume protection;
- fixed VPN and virtual-number staging payment canaries;
- 154 deterministic CDP harness tests at the last accepted handoff.

The current harness is not yet the agent feedback loop described here:

- navigation and UI inspection are embedded in hard-coded purchase scenarios;
- there is no agent-facing browser skill or typed generic command surface;
- the only generic evaluator can execute arbitrary page JavaScript;
- there is no reusable sanitized semantic snapshot;
- screenshots and DOM snapshots are correctly forbidden in payment evidence;
- live staging execution is operational and non-gated, while CI runs only
  deterministic helper tests;
- the harness validates a deployed candidate and does not yet provide the
  isolated local worktree reproduce/fix/reload loop.

## 4. Goals

### 4.1 First-iteration goals

1. Let an agent start, discover, attest, observe, and stop a dedicated staging
   Chrome session without manually copying a CDP port or target ID.
2. Expose only typed read-only operations with versioned JSON input and output.
3. Produce bounded, sanitized semantic observations that are useful for UI
   reasoning without persisting raw DOM, AX trees, secrets, or personal data.
4. Capture safe public screenshots, console fingerprints, and network summaries
   under an explicit route and artifact policy.
5. Fail closed before navigation or capture when origin, environment, release,
   target, request, route, or evidence policy is not satisfied.
6. Keep the existing product payment harness and every payment evidence rule
   unchanged.
7. Supply deterministic replay fixtures and security tests as required
   pre-integration evidence in the Free-safe manual-review workflow.

### 4.2 Program goals enabled later

- authenticated read-only staging observation;
- read-only Nuanu QA ticket intake and shadow validation;
- Computer Use-first reproduction followed by Playwright regression coverage;
- isolated product-worktree reproduction and fix validation;
- bounded non-financial mutations with cleanup and idempotency;
- Telegram Web and Mini App validation;
- separately governed staging and production payment automation;
- calibrated, atomic automatic ticket routing.

## 5. Non-Goals and Hard Boundaries

The first iteration does not:

- log in, reuse a personal browser profile, or read an authenticated session;
- expose `Runtime.evaluate`, `Storage.*`, raw `DOM.*`, raw `Accessibility.*`,
  `Network.getResponseBody`, cookies, headers, request bodies, response bodies,
  browser storage, or arbitrary CDP methods to an agent;
- permit `POST`, `PUT`, `PATCH`, `DELETE`, provider submission, checkout
  creation, account creation, settings changes, or any other product mutation;
- visit production, provider, Telegram, wallet-secret, OTP, payment, PaySheet,
  or other sensitive routes;
- treat a browser or policy failure as a product defect;
- create, comment on, label, assign, or move a Nuanu Flow item;
- generate a trusted automatic verdict or a trusted Playwright regression;
- modify, push, merge, or deploy product code;
- add screenshot or DOM capability to the existing payment evidence writer.

Payment capability will never be added to this observation broker. Later live
payments remain a separate worker, ledger, authorization, and evidence domain.

## 6. Ownership and Repository Boundary

`FreelandQA` owns:

- the capability broker and its command registry;
- Chrome lifecycle ownership manifests;
- environment, origin, target, route, and request policies;
- semantic projection and capture-time sanitization;
- public screenshot policy;
- console and network summarizers;
- versioned schemas and deterministic replay fixtures;
- the repository skill that teaches agents how to use the typed commands;
- CI tests and non-gated live-staging smoke entrypoints.

`freeland_app` continues to own:

- product behavior and deploy manifests;
- the existing staging payment harness and payment guards;
- product-side unit, behavior, integration, and smoke tests;
- product logs and supported diagnostic contracts.

The QA broker does not import product runtime code. Existing product CDP
modules are audited reference implementations and conformance inputs after the
read-only source gate is available; they are not an unrestricted runtime
dependency of the broker.

## 7. Architecture

The first-iteration flow is:

```text
Agent / Freeland CDP skill
  -> typed command + schema validation
  -> capability broker
      -> lifecycle owner
      -> candidate/environment attestor
      -> browser-wide target and request guard
      -> route policy
      -> fixed CDP operation implementation
      -> capture-time semantic projector/redactor
  -> dedicated ephemeral Chrome over loopback CDP
  -> exact Freeland staging candidate
  -> schema-valid sanitized observation
  -> ignored local artifact bundle
```

The broker is the only process allowed to talk to the Chrome CDP endpoint. The
agent receives neither the WebSocket URL nor a generic `send(method, params)`
operation. The endpoint and target ID may exist in the private lifecycle
manifest but are never part of the agent command output.

### 7.1 Lifecycle owner

`start` creates and records only resources owned by the current run:

- an ephemeral Chrome profile outside Git;
- a loopback-only random CDP port;
- a dedicated Chrome process;
- the exact expected staging origin and release SHA;
- the selected page target;
- an ignored artifact directory;
- process and cleanup identity needed to stop safely.

`status` verifies that the manifest, process, profile, target, origin, and
candidate still agree. `stop` removes only resources whose ownership identity
matches the manifest. A missing, stale, symlinked, PID-reused, or partially
initialized resource fails safe and is reported for explicit cleanup rather
than being broadly deleted.

The profile contains no authentication and is not reused across runs in `I1`.
Authenticated profile leasing is introduced only in `I2`.

### 7.2 Candidate attestor

Before the first navigation and before every observation batch, the broker
verifies:

- exact allowed staging origin;
- `appEnv=staging`;
- expected public origin;
- expected staging Supabase project;
- full 40-character deployed release SHA;
- allowed Chrome target type and route class;
- loopback-only CDP attachment.

The manifest is re-read at the end of the run. A release change makes the run
`STALE_CANDIDATE`; observations remain diagnostic and cannot support a later
ticket verdict.

### 7.3 Browser-wide guard

The guard is armed before the broker permits navigation. It covers the initial
page plus every new page, popup, iframe, dedicated worker, shared worker, and
service worker target.

Default network policy permits only reviewed staging `GET`, `HEAD`, and
`OPTIONS` reads needed by the allowlisted public routes. Every write method,
production request, foreign Supabase request, provider request, unclassified
origin, unexpected redirect, or target created outside the policy is blocked
and recorded as `POLICY_BLOCK` using sanitized metadata.

There is no blanket third-party or telemetry exception. A required read or
non-mutating request that cannot be expressed safely must be reviewed and
added to the versioned policy before the route can become `public-safe`.

### 7.4 Typed command surface

The initial command registry is:

| Command | Result |
|---|---|
| `start` | Owned session manifest alias and attested candidate identity |
| `status` | Process/target/candidate/policy health |
| `attest` | Fresh environment and release assertion |
| `navigate` | Allowlisted route transition and final route class |
| `back` | Guarded browser-history transition |
| `reload` | Guarded reload of the current allowlisted route |
| `wait` | Bounded wait for a typed semantic predicate |
| `snapshot` | Sanitized semantic page projection |
| `console-summary` | Severity counts and stable redacted fingerprints |
| `network-summary` | Templated route/method/status/duration observations |
| `screenshot-safe` | Policy-approved public screenshot metadata and local path |
| `stop` | Verified shutdown and retention/cleanup result |

Commands accept enumerated operations and bounded parameters only. Selectors
are accessible-role/label predicates or reviewed route-specific identifiers;
raw JavaScript and arbitrary CSS/XPath strings are not command inputs.

### 7.5 Versioned contracts

The implementation defines JSON Schemas for:

- `cdp-session-manifest.v1`;
- `cdp-command.v1`;
- `cdp-observation.v1`;
- `cdp-route-policy.v1`;
- `cdp-request-policy.v1`;
- `cdp-artifact-index.v1`;
- `cdp-run-result.v1`.

Every command validates input before execution and output before returning to
the agent. An invalid result is `HARNESS_FAIL`; no partially valid free-form
object is returned as evidence.

## 8. Route and Data Classification

Routes use three policy classes.

### 8.1 `public-safe`

The route is reachable from an unauthenticated fresh profile, contains no
account or payment state, and has a reviewed request graph. It may use:

- semantic snapshot;
- console summary;
- network summary;
- `screenshot-safe` after its additional capture checks pass.

The initial policy is generated from the tracked public Freeland route
inventory and admits only individually reviewed landing, localized landing,
legal, and unauthenticated welcome routes. An unlisted route is not inferred to
be safe from its path name.

### 8.2 `authenticated-safe`

This class is unavailable in `I1`. In `I2`, it uses a leased QA-only profile
and permits semantic projections without field values. Screenshots remain
deny-by-default and require a separate route-plus-region policy.

### 8.3 `sensitive`

Sensitive routes include authentication entry with populated identity, OTP,
account recovery, PaySheet, provider pages, payment pages, wallet secrets, VPN
credentials, personal Inbox content, and personal Telegram content. Raw or
sanitized DOM/AX capture and screenshots are prohibited. Later flows may emit
only predefined scalar checkpoints through their own dedicated worker and
evidence policy.

Unknown routes are `sensitive` by default.

## 9. Capture and Evidence Contract

### 9.1 Semantic snapshot

The broker may receive raw CDP data in process memory, but it projects and
sanitizes before serialization, logging, artifact writing, or agent return.
Raw DOM and raw accessibility responses are never persisted.

The projection may contain:

- policy route class and normalized path template;
- page title and document language;
- landmarks and headings;
- visible roles and bounded labels;
- enabled, disabled, selected, expanded, checked, and focusable state;
- reviewed stable test identifiers when policy permits them;
- an explicit truncation marker.

It excludes:

- input, textarea, select, clipboard, canvas, QR, and hidden values;
- cookies, local/session storage, tokens, headers, and browser profile data;
- arbitrary attributes and full URLs;
- raw node IDs after the command completes;
- hidden text and off-policy frames;
- free text not needed to identify a semantic control.

One snapshot is limited to 500 projected nodes, 200 Unicode characters per
text field, and 64 KiB of serialized JSON. Overflow is deterministic and
marked; it is not silently dropped.

### 9.2 Console summary

Raw console arguments and stack traces remain in memory only long enough to
classify and redact them. Persisted output contains:

- severity;
- stable message-class fingerprint;
- count;
- first and last relative occurrence time;
- reviewed source class such as `first-party`, `browser`, or `blocked`.

It does not contain raw arguments, stack text, query strings, account data, or
provider details.

### 9.3 Network summary

Persisted network observations contain only:

- classified origin role;
- templated path without query or identifiers;
- method;
- status or blocked result;
- duration bucket;
- stable correlation alias when already safe and reviewed.

Headers, bodies, full provider URLs, signed links, request IDs containing
personal data, and authentication material are forbidden.

### 9.4 Public screenshot

`screenshot-safe` is available only when all of these checks pass immediately
before capture:

1. route policy is `public-safe`;
2. the profile is unauthenticated and ephemeral;
3. no input or textarea contains a value;
4. no sensitive frame, provider target, canvas, QR, or policy-denied region is
   visible;
5. candidate and request guards remain healthy;
6. the artifact path resolves beneath the owned ignored directory.

The PNG is limited to 4096 by 4096 pixels and 5 MiB. Failure of any capture
check returns `POLICY_BLOCK` and writes no partial image.

### 9.5 Storage, permissions, and retention

Run artifacts are local and gitignored. Directories use mode `0700`; files use
mode `0600`. The artifact index stores only sanitized derivatives and hashes.
Normal `I1` artifacts expire after seven days and are deleted by an ownership-
checked cleanup command. Git and Nuanu Flow receive no live-run artifact in
`I1`.

The existing product payment evidence directory, writer, forbidden-key list,
and retention rules are not reused or weakened by this public observation
policy.

## 10. Error and Result Model

The broker emits typed run outcomes:

| Outcome | Meaning |
|---|---|
| `OBSERVED` | Requested read-only operation completed under one attested candidate |
| `STALE_CANDIDATE` | Deployment identity changed during the run |
| `POLICY_BLOCK` | Route, target, request, command, or capture was not allowed |
| `ATTESTATION_FAIL` | Environment or candidate identity could not be proven |
| `CAPTURE_REDACTION_FAIL` | Safe derivative could not be proven |
| `BROWSER_FAIL` | Chrome/CDP lifecycle or protocol failed |
| `HARNESS_FAIL` | Schema, fixture, broker, or internal invariant failed |

None of these is a product verdict in `I1`. A visible product observation is
returned as structured data for human/agent analysis, but classification into
`PASS` or `PRODUCT_FAIL` begins only in `I3` under the existing two-oracle and
fresh-context rules.

Retries do not overwrite the first clean-run fact. A retry is a child
diagnostic run with its own identity and artifacts.

## 11. Iterative Delivery

### `I0` — Entry gate and immutable baseline

Close the existing Task 11 and pin the accepted repository commit, remote,
required workflow runs, coverage revision, closed GitHub Free-safe integrity
record, and product source access method. The integrity record detects and
rejects drift but does not claim that GitHub Free prevents a privileged direct
push to a private repository.

### `I1` — Public staging CDP observer

Deliver Chrome lifecycle, candidate attestation, browser-wide guards, typed
commands, `public-safe` policy, sanitized observations, public screenshots,
replay fixtures, CI tests, and a separate non-gated live smoke.

### `I2` — Authenticated read-only staging observer

Add dedicated QA account/profile leasing, authenticated route classification,
safe app-page observations, secret-free session handling, and deny-by-default
authenticated screenshot regions. Personal accounts and personal Telegram
sessions remain forbidden.

### `I3` — Nuanu QA shadow validation

Read the exact Freeland `QA` column, freeze ticket and candidate revisions, map
requirements, run the required CDP/Playwright lanes, classify without mutation,
and create a sanitized candidate regression packet. Generated Playwright tests
remain candidates until their oracle, cleanup, repeatability, and independent
lane agreement are reviewed.

### `I4` — Product-agent worktree feedback loop

Provide an authorized product agent with an isolated worktree runtime, unique
ports/profile/artifacts, structured app logs and metrics, the sanitized fix
packet, and the same typed browser operations under a local-origin policy. The
agent reproduces, edits, reloads, and validates locally. Independent QA waits
for the exact fix SHA to be deployed, then re-runs staging acceptance. The QA
harness itself does not push, merge, or deploy product code.

### `I5` — Computer Use, Telegram, and bounded non-financial mutation

Add semantic Computer Use scenarios, Telegram Web/Mini App attestation, typed
single-use mutation capabilities, QA-owned persona leases, idempotency,
before/after ledgers, cleanup read-back, and unknown-state quarantine.

### `I6` — Durable payment automation

Implement the separately approved Postgres authorization/ledger/fencing model,
payment-data boundary, transient Computer Use card entry or audited tokenized
connector, CVV scrub barrier, provider settlement evidence, entitlement
reconciliation, and environment-specific staging then production canaries.
Observation-broker DOM/screenshot capability remains disabled on every payment
surface.

### `I7` — Calibrated automatic routing

After 30–50 reviewed shadow decisions meet the precision targets and Nuanu
provides an atomic conditional transition, enable idempotent comments and exact
state routing with read-back. Ambiguity, stale state, flake, policy failure,
provider blocks, and critical exceptions remain in QA.

### `I8` — Full inventory and continuous optimization

Account for every active product requirement, route, locale, viewport, engine,
integration mode, ticket, external effect, and negative flow. Drift detection
adds missing work without conflating 100% accounted coverage with 100% passing
tests.

## 12. Verification Strategy

### 12.1 Required deterministic pre-integration evidence

CI runs without contacting staging and proves:

- command input/output schema validation;
- loopback-only endpoint and target selection;
- origin, route, redirect, popup, iframe, worker, and service-worker denial;
- default-deny request policy and zero allowed writes;
- candidate-SHA mismatch and mid-run change handling;
- semantic projection bounds and deterministic truncation;
- removal of values, hidden text, URLs, identifiers, and secret-shaped data;
- console and network summarization;
- screenshot route and capture denial;
- artifact path containment, permissions, retention, and ownership cleanup;
- crash, stale manifest, PID reuse, partial startup, and stop recovery;
- stable replay of recorded synthetic CDP fixtures;
- no change to the existing payment evidence forbidden-key behavior.

Security fixtures inject synthetic PAN-, CVV-, bearer-token-, email-, phone-,
VPN-, checkout-link-, and Telegram-shaped markers. Tests require zero forbidden
value in command results, logs, artifact names, and JSON. A screenshot fixture
that contains a marker or policy-denied element must return `POLICY_BLOCK` and
must not write PNG bytes; permitted screenshot fixtures contain only synthetic
public copy and are checked by deterministic image hashes.

### 12.2 Non-gated live staging smoke

The live smoke is manual or scheduled, targets one exact staging SHA, uses a
fresh unauthenticated profile, and performs no writes. It proves:

1. start and target discovery require no manual port or target copying;
2. preflight attests the exact candidate;
3. at least one reviewed public route can be navigated and observed;
4. semantic, console, network, and safe screenshot outputs validate against
   their schemas;
5. a blocked route and a blocked write are proven fail-closed using safe
   synthetic fixtures rather than product mutation;
6. final attestation still matches;
7. stop and cleanup succeed.

Live staging results are evidence about the deployed environment, not part of
the deterministic pre-integration evidence. An environment or mesh outage
cannot fail deterministic CI.

### 12.3 Playwright relationship

CDP/Computer Use is the first-pass exploration and reproduction lane.
Playwright/API remains the deterministic regression and CI oracle. Starting in
`I3`, a confirmed behavior is translated into an ordinary correct-behavior
assertion with `retries=0`, effect-based waits, accessible roles/test IDs,
explicit setup/cleanup, and strict non-zero selection.

## 13. `I1` Acceptance Criteria

`I1` is complete only when all of the following are true on one pinned
`FreelandQA` commit:

1. Task 11's repository identity, credential, exact-workflow, and Free-safe
   detect-and-refuse acceptance is green.
2. An agent can start, attest, navigate, observe, and stop the dedicated Chrome
   session without receiving or copying a CDP endpoint or target ID.
3. Every exposed operation is in the typed command registry and both input and
   output validate against versioned schemas.
4. Unknown routes, targets, popups, frames, workers, redirects, origins, and
   write requests fail closed.
5. The persisted semantic snapshot, console summary, network summary, and
   screenshot artifacts satisfy the capture and size bounds.
6. Synthetic secret/PII canaries produce zero durable leakage.
7. The deterministic broker/replay/security suite is green, retained as
   required evidence, and manually reviewed before any human integration.
8. One exact-SHA live staging smoke is green and remains outside the
   deterministic pre-integration evidence lane.
9. The existing 154 product CDP harness tests are rerun through the read-only
   product checkout and remain green without weakening any assertion.
10. Existing payment target, mutation, evidence, and manual/automated payment
    policy code is unchanged by `I1`.
11. No product data, checkout, payment, account, authenticated session, or
    Nuanu Flow item is created or modified.
12. Cleanup removes only manifest-owned resources and a recovery drill proves
    safe behavior after partial startup and browser loss.

## 14. Principal Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Raw evaluator becomes an agent escape hatch | No generic CDP send or JavaScript command; fixed typed operations only |
| DOM/AX exposes values or personal data | Capture-time projection, route classes, hard size limits, synthetic leakage tests |
| Screenshot captures sensitive state | Fresh unauthenticated profile, explicit public policy, pre-capture checks, fail closed |
| Worker or popup bypasses page guard | Browser-wide target auto-attach and request policy before navigation |
| Third-party egress is missed | Default-deny origin/method graph; no inferred telemetry exception |
| Deployment changes mid-run | Pre/post attestation and `STALE_CANDIDATE` outcome |
| GitHub Free cannot protect a private `main` branch | Keep the repository private; pin REST repository ID and exact SHA; re-read before/after every external step; accept only exact-SHA runs; disable automatic merge; fail closed on drift; explicitly record that prevention is unavailable |
| Agent mistakes harness failure for product bug | Typed outcome model; no product verdict in `I1` |
| Cleanup kills unrelated processes or removes user data | Ownership manifest, PID/start identity, path containment, no broad deletion |
| Chrome/CDP version drift | Version probe, replay fixtures, explicit compatibility failure |
| Public broker weakens payment safety | Separate code path, schemas, evidence store, tests, and capability domain |
| Live staging instability breaks CI | Deterministic CI and non-gated live smoke remain separate |

## 15. Plan Integration Decision

After written-spec review, amend the existing sibling implementation plan
`docs/superpowers/plans/2026-08-02-freeland-agent-first-cdp-feedback-loop.md`.
Its current paid-plan/protected-main I0 clauses are superseded and execution is
suspended until that amendment is written, reviewed, and committed. The plan
continues to use independent iteration IDs (`FL-CDP-I0`, `FL-CDP-I1`, and later
iterations) and 2–5 minute test-driven checkpoints. It will not edit or
renumber baseline Tasks 1–10; it may amend baseline Task 11 and its acceptance
matrix only to install this exact Free-safe contract.

The baseline plan may receive one short cross-link after its Execution Handoff
only if that edit can be isolated from unrelated user work. The sibling plan is
the authoritative execution document for this stream.

## 16. Approval Record

The owner selected and approved:

- staging-first rather than local-worktree-first delivery;
- a separate typed CDP broker in `FreelandQA`;
- the architecture boundary and unchanged payment harness;
- the route/evidence/safety contract;
- the private GitHub Free-safe detect-and-refuse I0 gate, with no paid-plan or
  public-repository dependency and no false branch-protection claim;
- the `I0`–`I8` roadmap;
- the stated `I1` acceptance criteria.

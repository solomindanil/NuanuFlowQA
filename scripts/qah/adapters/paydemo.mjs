#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { canonicalJson } from "../canonical.mjs";
import { runProbe as existingPaydemoProbe } from "../../paydemo-qah-probe.mjs";

const INPUT_KEYS = ["schema_version", "branch", "run_id", "attempt_id", "branch_namespace", "test_data_profile", "environment"];
const ENVIRONMENT_KEYS = ["base_url", "commit", "content_hash", "environment_id", "instance_nonce"];
const MODES = Object.freeze({ api: "amount", ui: "ui", domain: "idempotency" });
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) throw new Error(`${label} must have exact keys`);
}

function validateInput(input) {
  exactKeys(input, INPUT_KEYS, "adapter input");
  if (input.schema_version !== "nuanu.qa-branch-adapter-input.v1" || !Object.hasOwn(MODES, input.branch)) throw new Error("adapter branch identity is invalid");
  for (const [label, value] of [["run_id", input.run_id], ["attempt_id", input.attempt_id]]) if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} is invalid`);
  if (typeof input.branch_namespace !== "string" || !/^[a-f0-9]{64}$/.test(input.branch_namespace)) throw new Error("branch namespace is invalid");
  if (input.branch === "domain") {
    if (input.test_data_profile !== "payment_sandbox") throw new Error("PayDemo domain checks require the named payment_sandbox profile");
  } else if (input.test_data_profile !== null) throw new Error("test-data profile is valid only for the domain branch");
  exactKeys(input.environment, ENVIRONMENT_KEYS, "adapter environment");
  const base = new URL(input.environment.base_url);
  if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname) || base.origin !== input.environment.base_url) throw new Error("PayDemo adapter requires an exact loopback origin");
  if (!/^[a-f0-9]{40}$/.test(input.environment.commit) || !DIGEST.test(input.environment.content_hash)) throw new Error("adapter build identity is invalid");
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.environment.environment_id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.environment.instance_nonce)) throw new Error("adapter environment identity is invalid");
  return input;
}

async function defaultArtifactReferences(result, input) {
  if (!DIGEST.test(result.evidence?.sha256 ?? "")) return [];
  return [{ kind: "document", name: `${input.branch}-evidence.md`, version: 1, sha256: result.evidence.sha256 }];
}

async function loadChromium(environment) {
  const specifier = environment.NUANU_QA_PLAYWRIGHT_MODULE;
  const loaded = specifier
    ? await import(isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier)
    : await import("@playwright/test");
  const chromium = loaded.chromium ?? loaded.default?.chromium;
  if (!chromium) throw new Error("Playwright chromium is unavailable");
  return chromium;
}

function fileDigest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function captureUiArtifactReferences(input, { environment = process.env, evidenceDirectory = join(tmpdir(), "nuanu-qah-paydemo", input.branch_namespace) } = {}) {
  const chromium = await loadChromium(environment);
  const ownsBrowser = !environment.NUANU_QA_BROWSER_CDP_URL;
  const browser = ownsBrowser
    ? await chromium.launch({ headless: true })
    : await chromium.connectOverCDP(environment.NUANU_QA_BROWSER_CDP_URL);
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const screenshotName = "ui-main.png";
  const traceName = "ui-trace.zip";
  const screenshotPath = join(evidenceDirectory, screenshotName);
  const tracePath = join(evidenceDirectory, traceName);
  const context = await browser.newContext();
  try {
    context.setDefaultTimeout(10_000);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    await page.goto(input.environment.base_url, { waitUntil: "domcontentloaded", timeout: 10_000 });
    const finalUrl = new URL(page.url());
    if (finalUrl.origin !== input.environment.base_url) throw new Error("UI evidence navigation escaped the exact prepared origin");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await context.tracing.stop({ path: tracePath });
  } finally {
    await context.close();
    await browser.close();
  }
  const [screenshot, trace] = await Promise.all([readFile(screenshotPath), readFile(tracePath)]);
  return [
    { kind: "screenshot", name: screenshotName, version: 1, sha256: fileDigest(screenshot) },
    { kind: "trace", name: traceName, version: 1, sha256: fileDigest(trace) },
  ];
}

async function createLocalUiProbeEnvironment(input, baseEnvironment) {
  const loaded = await import("@playwright/test");
  const browser = await loaded.chromium.launch({ headless: true });
  const fixtureKey = `__nuanuQahBrowser_${input.branch_namespace}`;
  globalThis[fixtureKey] = { chromium: { connectOverCDP: async () => browser } };
  return {
    environment: {
      NUANU_QA_PLAYWRIGHT_MODULE: `data:text/javascript,export const chromium=globalThis[${JSON.stringify(fixtureKey)}].chromium`,
      NUANU_QA_BROWSER_CDP_URL: "adapter-local://chromium",
    },
    async dispose() {
      delete globalThis[fixtureKey];
      await browser.close().catch(() => {});
    },
  };
}

export async function runPaydemoAdapter(rawInput, dependencies = {}) {
  const input = validateInput(rawInput);
  const runProbe = dependencies.runProbe ?? existingPaydemoProbe;
  const artifactReferences = dependencies.artifactReferences ?? (input.branch === "ui"
    ? async () => (dependencies.captureUiArtifacts ?? captureUiArtifactReferences)(input, {
      environment: dependencies.environment ?? process.env,
      evidenceDirectory: dependencies.evidenceDirectory ?? join(tmpdir(), "nuanu-qah-paydemo", input.branch_namespace),
    })
    : defaultArtifactReferences);
  const baseEnvironment = dependencies.environment ?? process.env;
  const needsProvisionedUi = input.branch === "ui" && (dependencies.createUiProbeEnvironment || !dependencies.runProbe);
  const provisionedUi = needsProvisionedUi
    ? await (dependencies.createUiProbeEnvironment ?? createLocalUiProbeEnvironment)(input, baseEnvironment)
    : null;
  let result;
  try {
    result = await runProbe({
      mode: MODES[input.branch],
      baseUrl: input.environment.base_url,
      expectedBuild: {
        app: "PayDemo",
        variant: "fixed-v2",
        commit: input.environment.commit,
        contentHash: input.environment.content_hash,
        environmentId: input.environment.environment_id,
        instanceNonce: input.environment.instance_nonce,
      },
      runId: input.branch_namespace,
      evidenceDirectory: dependencies.evidenceDirectory ?? join(tmpdir(), "nuanu-qah-paydemo", input.branch_namespace),
      environment: provisionedUi ? { ...baseEnvironment, ...provisionedUi.environment } : baseEnvironment,
    });
  } finally {
    await provisionedUi?.dispose();
  }
  const artifacts = await artifactReferences(result, input);
  return {
    schema_version: "nuanu.qa-branch-adapter-result.v1",
    branch: input.branch,
    product_result: result.axes.product_result,
    environment_status: result.axes.environment_status,
    evidence_status: result.axes.evidence_status,
    confidence: result.axes.confidence,
    code: result.code,
    observations: [{ code: "PROBE_RESULT", status: result.axes.product_result, value_sha256: result.occurrence_key }],
    artifacts,
  };
}

async function readBoundedStdin(stream, maximumBytes = 65_536) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.byteLength;
    if (total > maximumBytes) throw new Error("adapter stdin exceeds bound");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !Object.hasOwn(MODES, argv[0])) throw new Error("exactly one PayDemo adapter branch is required");
  const input = JSON.parse(await readBoundedStdin(process.stdin));
  if (input.branch !== argv[0]) throw new Error("adapter argv branch must match canonical stdin");
  const result = await runPaydemoAdapter(input);
  process.stdout.write(`${canonicalJson(result)}\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});

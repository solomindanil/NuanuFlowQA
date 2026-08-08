import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const port = Number.parseInt(process.env.PAYDEMO_PORT ?? '4173', 10);
const variant = process.env.PAYDEMO_VARIANT ?? 'fixed-v2';
const plans = new Map([['starter', { amountCents: 1000 }]]);
const paymentsByRun = new Map();
const buildInfo = JSON.parse(readFileSync('dist/paydemo/build-manifest.json', 'utf8'));
const staticFiles = new Map([
  ['/', { path: 'dist/paydemo/public/index.html', type: 'text/html; charset=utf-8' }],
  ['/app.mjs', { path: 'dist/paydemo/public/app.mjs', type: 'text/javascript; charset=utf-8', dynamic: true }],
  ['/styles.css', { path: 'dist/paydemo/public/styles.css', type: 'text/css; charset=utf-8' }],
]);

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const validRunId = (runId) => typeof runId === 'string' && /^[a-z0-9-]{1,64}$/.test(runId);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const staticFile = request.method === 'GET' ? staticFiles.get(pathname) : undefined;
  if (staticFile) {
    response.writeHead(200, { 'content-type': staticFile.type });
    const source = await readFile(staticFile.path);
    return response.end(staticFile.dynamic ? `globalThis.PAYDEMO_VARIANT = ${JSON.stringify(variant)};\n${source}` : source);
  }

  if (request.method === 'GET' && request.url === '/build-info') {
    return sendJson(response, 200, buildInfo);
  }

  if (request.method === 'POST' && request.url === '/api/reset') {
    const { runId } = await readJson(request);
    if (!validRunId(runId)) return sendJson(response, 400, { error: 'INVALID_RUN_ID' });
    paymentsByRun.delete(runId);
    return sendJson(response, 200, { runId, reset: true });
  }

  if (request.method === 'POST' && request.url === '/api/checkout') {
    const { runId, planId, amountCents, paymentMethod } = await readJson(request);
    const plan = plans.get(planId);
    const idempotencyKey = request.headers['idempotency-key'];
    if (!validRunId(runId)) return sendJson(response, 400, { error: 'INVALID_RUN_ID' });
    if (!plan) return sendJson(response, 404, { error: 'UNKNOWN_PLAN' });
    if (variant === 'fixed-v2' && amountCents !== plan.amountCents) {
      return sendJson(response, 422, { error: 'AMOUNT_MISMATCH' });
    }
    if (!['card', 'bank'].includes(paymentMethod)) return sendJson(response, 422, { error: 'INVALID_PAYMENT_METHOD' });
    if (variant === 'fixed-v2' && typeof idempotencyKey !== 'string') {
      return sendJson(response, 400, { error: 'MISSING_IDEMPOTENCY_KEY' });
    }

    const run = paymentsByRun.get(runId) ?? { payments: [], idempotency: new Map() };
    if (variant === 'fixed-v2' && run.idempotency.has(idempotencyKey)) {
      return sendJson(response, 200, run.idempotency.get(idempotencyKey));
    }
    const payment = {
      paymentId: `demo-${runId}-${run.payments.length + 1}`,
      amountCents: variant === 'buggy-v1' ? amountCents : plan.amountCents,
      paymentMethod,
    };
    run.payments.push(payment);
    if (variant === 'fixed-v2') run.idempotency.set(idempotencyKey, payment);
    paymentsByRun.set(runId, run);
    return sendJson(response, 201, payment);
  }

  return sendJson(response, 404, { error: 'NOT_FOUND' });
});

server.listen(port, '127.0.0.1');

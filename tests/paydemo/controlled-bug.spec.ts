import { expect, test, type Request } from '@playwright/test';

test('controlled BUG-1: checkout must reject an amount forged by the browser', async ({ request }) => {
  test.fail(true, 'buggy-v1 trusts the browser-supplied amount');
  const runId = 'bug-client-amount';
  await request.post('/api/reset', { data: { runId } });

  const response = await request.post('/api/checkout', {
    data: { runId, planId: 'starter', amountCents: 100, paymentMethod: 'card' },
  });
  expect(response.status()).toBe(422);
});

test('controlled BUG-2: bank selection must reach the checkout API', async ({ page, request }) => {
  test.fail(true, 'buggy-v1 keeps card as a stale payment method');
  const runId = 'bug-stale-method';
  await request.post('/api/reset', { data: { runId } });
  await page.goto(`/?runId=${runId}`);

  await page.getByLabel('Bank transfer').check();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/checkout'));
  await page.getByRole('button', { name: 'Pay $10.00' }).click();

  expect((await responsePromise).request().postDataJSON()).toMatchObject({ paymentMethod: 'bank' });
});

test('controlled BUG-3: a fast double click must create one checkout', async ({ page, request }) => {
  test.fail(true, 'buggy-v1 admits two payment submissions before completion');
  const runId = 'bug-duplicate-race';
  await request.post('/api/reset', { data: { runId } });
  const requests: Request[] = [];
  page.on('request', (requestEvent) => {
    if (requestEvent.url().endsWith('/api/checkout')) requests.push(requestEvent);
  });

  await page.goto(`/?runId=${runId}`);
  await page.getByRole('button', { name: 'Pay $10.00' }).evaluate((button) => {
    const submitButton = button as HTMLButtonElement;
    submitButton.click();
    submitButton.click();
  });
  await expect(page.getByRole('status')).toHaveText('Payment recorded by card.');
  expect(requests).toHaveLength(1);
});

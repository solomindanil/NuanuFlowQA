import { expect, test } from '@playwright/test';

// API-level checks: fast, browserless, run via the request fixture. On large
// products they complement UI specs — status codes and response shapes of
// critical endpoints break earlier and diagnose faster than UI flows.
test.describe('api', () => {
  test.skip(!process.env.MYPRODUCT_BASE_URL, 'MYPRODUCT_BASE_URL is not set');

  test('root endpoint responds', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBeLessThan(400);
  });

  // Patterns to add per product:
  // - protected endpoints return 401/403 without a token (never 200 or 500)
  // - critical endpoints return the expected shape:
  //     const data = await response.json();
  //     expect(data).toMatchObject({ id: expect.any(String) });
  // - error responses don't leak stack traces or internal hostnames
});

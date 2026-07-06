import { expect, test as setup } from '@playwright/test';

// Template auth setup. Enable it in playwright.config.ts:
//   ...product('myproduct', process.env.MYPRODUCT_BASE_URL, { authSetup: true })
// It runs once per test run: logs in through the UI and saves the session
// (cookies + localStorage) so authenticated specs reuse it via storageState
// instead of logging in per test — faster and gentler on the auth backend.
// Keep the path in sync with app.spec.ts (test files must not import each other).
const AUTH_FILE = 'playwright/.auth/myproduct.json';

setup('authenticate', async ({ page }) => {
  setup.skip(
    !process.env.MYPRODUCT_TEST_EMAIL || !process.env.MYPRODUCT_TEST_PASSWORD,
    'MYPRODUCT_TEST_EMAIL / MYPRODUCT_TEST_PASSWORD are not set',
  );

  await page.goto('/login'); // adjust to your product
  await page.locator('input[type="email"]').first().fill(process.env.MYPRODUCT_TEST_EMAIL!);
  await page.locator('input[type="password"]').first().fill(process.env.MYPRODUCT_TEST_PASSWORD!);
  await page.getByRole('button', { name: /log ?in|sign ?in|continue|войти|продолжить/i }).click();

  // Wait for a post-login landmark, not just the URL — proves the session works.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  await expect(page.locator('main')).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});

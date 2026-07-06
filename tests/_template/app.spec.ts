import { expect, test } from '@playwright/test';

// Template for the authenticated area. Requires authSetup: true for the product
// in playwright.config.ts (see auth.setup.ts). READ-ONLY by contract: no
// purchases, no settings mutations, no destructive actions on real accounts.
// Keep the path in sync with auth.setup.ts (test files must not import each other).
const AUTH_FILE = 'playwright/.auth/myproduct.json';

test.describe('app (authenticated)', () => {
  test.skip(
    !process.env.MYPRODUCT_BASE_URL ||
      !process.env.MYPRODUCT_TEST_EMAIL ||
      !process.env.MYPRODUCT_TEST_PASSWORD,
    'MYPRODUCT_BASE_URL / MYPRODUCT_TEST_EMAIL / MYPRODUCT_TEST_PASSWORD are not set',
  );
  test.use({ storageState: AUTH_FILE });

  test('main section renders for a logged-in user', async ({ page }) => {
    await page.goto('/app'); // adjust to your product's home
    await expect(page.locator('main')).toBeVisible();
    // Assert on landmarks of the logged-in state (nav items, user menu, …).
  });

  test('navigation reaches every primary section', async ({ page }) => {
    await page.goto('/app');
    // Loop your product's sections; after SPA hydration checks, assert URL + a landmark:
    // await page.getByRole('link', { name: /settings/i }).click();
    // await expect(page).toHaveURL(/settings/);
  });
});

// Actions that revoke the shared session (logout, password change) must run in
// a fresh context with their own UI login — never against the shared storageState.
test.describe('logout', () => {
  test.skip(
    !process.env.MYPRODUCT_BASE_URL ||
      !process.env.MYPRODUCT_TEST_EMAIL ||
      !process.env.MYPRODUCT_TEST_PASSWORD,
    'MYPRODUCT_BASE_URL / MYPRODUCT_TEST_EMAIL / MYPRODUCT_TEST_PASSWORD are not set',
  );

  test('logout returns to the login screen', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').first().fill(process.env.MYPRODUCT_TEST_EMAIL!);
    await page.locator('input[type="password"]').first().fill(process.env.MYPRODUCT_TEST_PASSWORD!);
    await page.getByRole('button', { name: /log ?in|sign ?in|continue|войти|продолжить/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // Let hydration finish so the click handler is attached (heavy SPA bundles
    // can swallow clicks fired right after navigation).
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /log ?out|sign ?out|выйти/i }).first().click();
    await expect(page).toHaveURL(/login|welcome|\/$/, { timeout: 15_000 });
  });
});

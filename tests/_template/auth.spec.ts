import { expect, test } from '@playwright/test';

// Template auth spec. Adjust routes/selectors after your first recon pass.
// Safety: use a dedicated test account; never trigger real password-reset
// emails to addresses you don't own; keep tests read-only.
test.describe('auth', () => {
  test.skip(!process.env.MYPRODUCT_BASE_URL, 'MYPRODUCT_BASE_URL is not set');

  const LOGIN_PATH = '/login'; // adjust to your product

  test('login screen renders', async ({ page }) => {
    await page.goto(LOGIN_PATH);

    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('malformed email is blocked before any network call', async ({ page }) => {
    await page.goto(LOGIN_PATH);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('not-an-email');
    await page.locator('input[type="password"]').first().fill('some-password-123');
    await page.getByRole('button', { name: /log ?in|sign ?in|continue|войти|продолжить/i }).click();

    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).checkValidity());
    expect(isInvalid, 'malformed email should fail native validation').toBe(true);
  });

  test('wrong credentials show a localized error', async ({ page }) => {
    await page.goto(LOGIN_PATH);

    await page.locator('input[type="email"]').first().fill('qa-nonexistent@example.com');
    await page.locator('input[type="password"]').first().fill('wrong-password-123');
    await page.getByRole('button', { name: /log ?in|sign ?in|continue|войти|продолжить/i }).click();

    // Wait for the error to actually render before asserting on its content.
    // Raw backend messages (e.g. "Invalid login credentials") leaking into the
    // UI untranslated is a common bug worth a ticket.
    await expect(
      page.getByText(/invalid|incorrect|wrong|не ?верн|ошибк/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated login succeeds', async ({ page }) => {
    test.skip(
      !process.env.MYPRODUCT_TEST_EMAIL || !process.env.MYPRODUCT_TEST_PASSWORD,
      'test account is not configured',
    );

    await page.goto(LOGIN_PATH);
    await page.locator('input[type="email"]').first().fill(process.env.MYPRODUCT_TEST_EMAIL!);
    await page.locator('input[type="password"]').first().fill(process.env.MYPRODUCT_TEST_PASSWORD!);
    await page.getByRole('button', { name: /log ?in|sign ?in|continue|войти|продолжить/i }).click();

    await page.waitForURL((url) => !url.pathname.includes(LOGIN_PATH), { timeout: 15_000 });
  });
});

import { expect, test } from '@playwright/test';

// Template smoke spec. Copy tests/_template/ to tests/<product>/, then replace
// MYPRODUCT with your product's env prefix and register the project in
// playwright.config.ts. This directory itself is never run by Playwright.
test.describe('smoke', () => {
  test.skip(!process.env.MYPRODUCT_BASE_URL, 'MYPRODUCT_BASE_URL is not set');

  test('landing page loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto('/');

    expect(response, 'no response from server').not.toBeNull();
    expect(response!.status(), 'landing should respond with 2xx/3xx').toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });
});

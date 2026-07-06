import { expect, test } from '@playwright/test';

// Template landing spec. Patterns baked in:
// - SPA hydration: wait for a rendered element before scraping the DOM.
// - Locale-agnostic assertions: the default language may follow the runner's locale.
// - Bot-protected externals (403/429/999) are not product bugs.
// - Known bugs live here as test.fail() with the tracker ticket ID.
test.describe('landing', () => {
  test.skip(!process.env.MYPRODUCT_BASE_URL, 'MYPRODUCT_BASE_URL is not set');

  test('has no console errors or failed requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toHaveLength(0);
    expect(failedRequests, `failed requests: ${failedRequests.join('; ')}`).toHaveLength(0);
  });

  test('serves a favicon', async ({ page, request }) => {
    await page.goto('/');
    const iconHref = await page
      .locator('link[rel~="icon"], link[rel="shortcut icon"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    const faviconUrl = new URL(iconHref ?? '/favicon.ico', page.url()).toString();
    const response = await request.get(faviconUrl);
    expect(response.status(), `favicon at ${faviconUrl}`).toBeLessThan(400);
  });

  test('internal links respond without errors', async ({ page, request }) => {
    await page.goto('/');
    // SPA: wait for hydration before collecting links.
    await expect(page.locator('h1')).toBeVisible();

    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href),
    );
    const origin = new URL(page.url()).origin;
    const internal = [...new Set(hrefs.filter((href) => href.startsWith(origin)))];
    expect(internal.length, 'landing should contain internal links').toBeGreaterThan(0);

    const broken: string[] = [];
    for (const href of internal) {
      const response = await request.get(href, { timeout: 15_000 }).catch(() => null);
      if (!response || response.status() >= 400) {
        broken.push(`${response ? response.status() : 'no response'} ${href}`);
      }
    }
    expect(broken, `broken internal links: ${broken.join('; ')}`).toHaveLength(0);
  });

  test('external links are reachable', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href),
    );
    const origin = new URL(page.url()).origin;
    const external = [
      ...new Set(hrefs.filter((href) => /^https?:/.test(href) && !href.startsWith(origin))),
    ];

    const broken: string[] = [];
    for (const href of external) {
      const response = await request.get(href, { timeout: 15_000 }).catch(() => null);
      const status = response?.status() ?? 0;
      // 403/429/999 from social networks is bot protection, not a product bug.
      const botProtected = [403, 429, 999].includes(status);
      if (!response || (status >= 400 && !botProtected)) {
        broken.push(`${response ? status : 'no response'} ${href}`);
      }
    }
    expect(broken, `broken external links: ${broken.join('; ')}`).toHaveLength(0);
  });

  test('has basic SEO meta tags', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content')
      .catch(() => null);
    expect(description?.trim(), 'meta description should exist and be non-empty').toBeTruthy();
  });

  // Example of documenting a known bug — replace TICKET-123 with a real ID:
  // test('nonexistent route responds with 404 (known bug TICKET-123)', async ({ request }) => {
  //   test.fail(true, 'TICKET-123: SPA catch-all returns 200 for unknown routes');
  //   const response = await request.get('/nonexistent-page-qa-check');
  //   expect(response.status()).toBe(404);
  // });
});

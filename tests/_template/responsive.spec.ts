import { expect, test, type Page } from '@playwright/test';

// Template responsive spec: no horizontal overflow across the viewport matrix,
// plus mobile vs desktop navigation switching.
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const assertNoHorizontalOverflow = async (page: Page, label: string) => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label}: horizontal overflow (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
};

test.describe('responsive', () => {
  test.skip(!process.env.MYPRODUCT_BASE_URL, 'MYPRODUCT_BASE_URL is not set');

  for (const viewport of VIEWPORTS) {
    test(`landing has no overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      await expect(page.locator('h1')).toBeVisible();
      await assertNoHorizontalOverflow(page, `landing@${viewport.width}`);
    });
  }

  // For authenticated areas: log in, then loop key pages at 320/375 and check
  // overflow + that the mobile navigation replaces the desktop one. See the
  // qa-check skill for the full pattern.
});

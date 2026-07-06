import { test as base } from '@playwright/test';
import { LoginPage } from './pages/login.page';

// Fixture example: inject page objects (and per-test data) into tests so specs
// stay declarative. Extend the object below as you add page objects.
// Usage in a spec:  import { expect, test } from './fixtures';
//                   test('logs in', async ({ loginPage }) => { ... });
export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';

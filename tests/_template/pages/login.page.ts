import { type Locator, type Page } from '@playwright/test';

// Page Object example. Adopt POM once a product grows past a handful of specs
// or the same selectors appear in more than one file: selectors live here once,
// tests keep only behavior and assertions.
// Conventions: actions in page objects, assertions in tests; prefer role/testid
// locators over CSS chains.
export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.locator('input[type="email"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton = page.getByRole('button', {
      name: /log ?in|sign ?in|continue|войти|продолжить/i,
    });
  }

  async goto() {
    await this.page.goto('/login'); // adjust to your product
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@core/base-page';

/** Page Object for the login screen at `/web/login`. */
export class LoginPage extends BasePage {
    private readonly accountIdInput: Locator;
    private readonly passwordInput: Locator;
    private readonly submitButton: Locator;

    constructor(page: Page) {
        super(page);

        this.accountIdInput = page.getByTestId('login-user-id');
        this.passwordInput = page.getByTestId('login-password');
        this.submitButton = page.getByTestId('login-submit');
    }

    async navigate(): Promise<void> {
        await this.goto('/web/login');
    }

    async setAccountId(accountId: string): Promise<void> {
        await this.accountIdInput.fill(accountId);
    }

    async setPassword(password: string): Promise<void> {
        await this.passwordInput.fill(password);
    }

    async clickLogin(): Promise<void> {
        await this.submitButton.click();
    }
}

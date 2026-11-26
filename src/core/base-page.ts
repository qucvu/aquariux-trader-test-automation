import { expect, type Locator, type Page } from '@playwright/test';

export abstract class BasePage {
    protected constructor(protected readonly page: Page) { }

    // Pass the full path from the origin, including any application prefix.
    protected async goto(path: string): Promise<void> {
        await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    }

    // An unmatched locator can still time out.
    protected async safeText(locator: Locator): Promise<string> {
        return (await locator.textContent())?.trim() ?? '';
    }

    protected async expectUrl(pattern: RegExp | string): Promise<void> {
        await expect(this.page).toHaveURL(pattern);
    }

    protected async expectVisible(locator: Locator): Promise<void> {
        await expect(locator).toBeVisible();
    }

    protected async expectText(locator: Locator, text: string | RegExp): Promise<void> {
        await expect(locator).toContainText(text);
    }
}

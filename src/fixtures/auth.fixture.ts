import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { test as base, type BrowserContext, type Page } from '@playwright/test';

import { LoginPage } from '@pages/login.page';
import { config } from '@core/config';
import { Logger } from '@core/logger';

/** Browser storage state reused across test contexts. */
const AUTH_STATE_FILE = 'playwright/.auth/demo-account.json';

interface AuthFixtures {
    authContext: BrowserContext;
    authPage: Page;
}

async function login(page: Page): Promise<void> {
    const logger = Logger.create('AuthFixture');

    logger.step(1, 'Navigate to login page');
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    logger.step(2, 'Submit demo account credentials');
    await loginPage.setAccountId(config.web.userAccountId);
    await loginPage.setPassword(config.web.userPassword);
    await loginPage.clickLogin();

    logger.step(3, 'Wait for the auth token to appear in localStorage');
    const tokenReady = await page.waitForFunction(
        () => Boolean(window.localStorage.getItem('token')), undefined
    );
    await tokenReady.dispose();

    logger.info('Login successful, session ready');
}

async function loginAndSaveState(context: BrowserContext, statePath: string): Promise<void> {
    const logger = Logger.create('AuthFixture');
    const page = await context.newPage();

    try {
        await login(page);
    } finally {
        await page.close();
    }

    mkdirSync(dirname(statePath), { recursive: true });
    await context.storageState({ path: statePath });

    logger.info(`Cached the authenticated session in ${AUTH_STATE_FILE}`);
}

export const test = base.extend<AuthFixtures>({
    authContext: async ({ browser }, use) => {
        const statePath = resolve(process.cwd(), AUTH_STATE_FILE);
        const hasCachedState = existsSync(statePath);
        const context = await browser.newContext(hasCachedState ? { storageState: statePath } : undefined);

        try {
            if (!hasCachedState) {
                await loginAndSaveState(context, statePath);
            }
            await use(context);
        } finally {
            await context.close();
        }
    },

    authPage: async ({ authContext }, use) => {
        const page = await authContext.newPage();
        await use(page);
    },
});

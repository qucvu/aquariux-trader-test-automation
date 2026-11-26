import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { test as base, type BrowserContext, type Page } from '@playwright/test';

import { LoginPage } from '@pages/login.page';
import { config } from '@core/config';
import { Logger } from '@core/logger';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
const DEMO_AUTH_STATE_FILE = fileURLToPath(new URL('../../playwright/.auth/demo-account.json', import.meta.url));

interface AuthFixtures {
    authContext: BrowserContext;
    authPage: Page;
}

interface AuthWorkerFixtures {
    demoStorageState: StorageState;
}

export async function saveDemoStorageState(page: Page): Promise<void> {
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

    await page.context().storageState({ path: DEMO_AUTH_STATE_FILE });
    logger.info('Login successful, authenticated state saved for this run');
}

export const test = base.extend<AuthFixtures, AuthWorkerFixtures>({
    demoStorageState: [async ({}, use) => {
        const state = await readFile(DEMO_AUTH_STATE_FILE, 'utf8');
        await use(JSON.parse(state) as StorageState);
    }, { scope: 'worker' }],

    authContext: async ({ browser, baseURL, demoStorageState }, use) => {
        const context = await browser.newContext({ baseURL, storageState: demoStorageState });
        try {
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

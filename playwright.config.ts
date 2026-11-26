import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/tests',
  outputDir: 'reports/test-results',
  globalSetup: './src/core/global-setup.ts',
  globalTeardown: './src/core/global-teardown.ts',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60 * 1000,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { open: 'never', outputFolder: 'reports/html' }],
    ['junit', { outputFile: 'reports/results.xml' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results' }],
  ],
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: process.env.WEB_APP_URL,
    // trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
  },

  projects: [
    {
      name: 'auth-setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['auth-setup'],
    },
  ],
});

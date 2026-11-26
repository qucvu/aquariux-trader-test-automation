# Aquariux WebTrader E2E Tests

A Playwright and TypeScript suite for order placement, position management, and trading records on the WebTrader demo. The [test plan](specs/test-plan.md) maps the 40 cases to their specs and records the Chromium and Firefox results.

## 1. Install Node.js and pnpm

Install Node.js with npm. This project was verified with Node.js 26.13.0 and uses pnpm 12.18.0.

```sh
npm install --global pnpm@12.18.0
pnpm --version
```

## 2. Install project dependencies and browsers

Run this from the repository root to install the dependencies and the Chromium and Firefox builds used by Playwright.

```sh
pnpm run setup
```

## 3. Configure the demo account

Copy `.env.example` to `.env` in the repository root. Use the demo credentials and set the WebTrader interface to **English**. Run order-placement cases while the selected market is open.

Keep `TEST_ONE_CLICK_TRADING` in sync with WebTrader. Use `false` for TC-10 and TC-11. Enable One-Click Trading in WebTrader and set the flag to `true` for TC-12 and TC-13.

## 4. Run the tests

For a fresh full-suite run, use `pnpm test:prepare` to validate the code, then clear the previous Allure results and saved demo session. The authentication setup creates a fresh session when the tests start. Run with one worker when using a single demo account.

```sh
pnpm test:prepare
pnpm test --workers=1
```

Save any Allure results you want to keep before preparing a fresh run.

To run one browser or one case, use the matching filter.

```sh
pnpm test --project=chromium --workers=1
pnpm test --project=firefox --workers=1
pnpm test --project=chromium --grep TC-39
```

Use `pnpm exec playwright test --list` to verify discovery. With both browsers enabled, it lists 40 scenarios per browser and one shared authentication setup.

## 5. View the results

- **Allure** — `pnpm report:open` or `pnpm report:generate` to export the report.
- **Playwright HTML** — `pnpm exec playwright show-report reports/html`.
- **JUnit XML** — `reports/results.xml`.

### Watch Allure results live

After `pnpm test:prepare`, start the watcher in one terminal. Then run `pnpm test --workers=1` in a second terminal.

```sh
pnpm report:watch
```

The report updates when each test finishes. Open the local URL printed in the terminal if needed. Stop the watcher with `Ctrl+C`.

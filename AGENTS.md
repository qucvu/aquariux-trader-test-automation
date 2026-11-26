# Playwright Framework Guide

Follow this guide when working on a Playwright test.

## Framework entry points

- [playwright.config.ts](playwright.config.ts) discovers specs under `src/tests/` and runs the enabled browser projects with one worker. HTML, JUnit, and Allure results are written under `reports/`.
- Use [.env.example](.env.example) as the template for `.env`. Set `WEB_APP_URL` to the app origin and provide the demo credentials through `USER_ACCOUNT_ID` and `USER_PASSWORD`. [Global setup](src/core/global-setup.ts) checks that all three values are present.
- [`@fixtures`](src/fixtures/index.ts) is the entry point for specs. [Authentication setup](src/tests/auth.setup.ts) uses the default `page` to sign in once and save the browser storage state at `playwright/.auth/demo-account.json`. Trading and records fixtures use `authPage` to restore that state in a separate context for each test.
- The [test plan](specs/test-plan.md) describes the 40 scenarios under `src/tests/trading/` and `src/tests/records/`. Shared trading data lives in [src/testdata/trading.json](src/testdata/trading.json).

## Scope

- Cover the requested feature and assertions. Reuse existing pages, modules, fixtures, and test data.
- For a test-case-only assignment, write the requested test cases. Store an optional plan in `specs/` when it helps with automation or submission.

## Framework rules

| Layer | Responsibility |
|---|---|
| `src/pages/` | Extend `BasePage`. Keep route navigation in page objects and reusable UI regions in `src/pages/components/`. Initialize `private readonly Locator` fields in the constructor. Expose UI actions and `expectXxx()` helpers. Keep business logic and branching in modules. |
| `src/modules/` | Compose page actions into business flows. Use `Logger` for steps. Keep locators in pages and detailed assertions in tests. |
| `src/tests/` | Import `test` and `expect` from `@fixtures`. Use fixtures to call modules and verify outcomes. Keep selectors, business logic, and direct page/module imports out of specs. |
| `src/core/`, `src/utils/` | Keep shared infrastructure reusable. Keep product URLs, credentials, selectors, and token keys out of shared implementation. |

- Read environment-specific settings through `.env` and `@core/config`. Use `DataGenerator` for dynamic data and `DataReader` for static JSON in `src/testdata/`.
- Use `this.goto()` with a path such as `/web/login` or `/web/trade` in page objects. Playwright resolves the path against the configured `baseURL`. `TradePage` composes `OrdersPanel` and `NotificationPanel`.
- Prefer web-first assertions and deterministic waits. Never use `page.waitForTimeout()`.
- Use precise types and `Logger` in framework code. Add dependencies only with explicit approval.

## Verify new or changed locators

1. Open the configured test app with `pnpm exec playwright cli open <url>`.
2. Run `pnpm exec playwright cli snapshot`. Identify the target by role and accessible name.
3. Verify the element with `click`, `fill`, or the interaction the scenario requires. Inspect the result before writing the locator.
4. Choose the first suitable locator from `getByRole()`, `getByLabel()`, `getByText()`, `getByTestId()`, `getByPlaceholder()`, and simple CSS, in that order. Avoid XPath, CSS chains, positional selectors, and generated attributes.

Close the CLI session when finished. If the app is unavailable, report the locator that still needs verification.

## Specs and verification

- Group specs with `test.describe()` and a priority tag (`@P0` for critical, `@P1` for high, or `@P2` for medium).
- In feature specs, use `test.step()` around meaningful actions and assertions. Use suite tags when a filter needs them.
- Keep framework self-tests in `src/tests/framework/` with `@framework` and independent of the live app.
- Run `pnpm typecheck`, `pnpm rules:check`, and `pnpm exec playwright test <relevant-spec>`. Use the configured reporters.
- Check for hard-coded secrets, `.only`, skipped tests, and leftover debug code before submission.

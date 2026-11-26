# Aquariux WebTrader E2E Tests

This Playwright and TypeScript suite tests order placement, position management, and trading records on the Aquariux WebTrader demo. The suite is verified on desktop Chromium and Firefox. The [test plan](specs/test-plan.md#scope-and-spec-mapping) maps all 40 cases to their specs and records the browser results.

## 1. Install Node.js and pnpm

Install [Node.js](https://nodejs.org/en/download) with npm. This project was verified with Node.js **26.13.0** and pins pnpm **12.18.0** in [package.json](package.json).

Open a terminal and check that Node.js and npm are available. Install the pinned pnpm version and check that it is on your PATH. [pnpm installation guide](https://pnpm.io/installation#using-npm)

```sh
node --version
npm --version
npm install --global pnpm@12.18.0
pnpm --version
```

If the terminal cannot find pnpm after installation, open a new terminal and run `pnpm --version` again.

## 2. Install project dependencies and browsers

Open the repository folder containing `package.json` and `playwright.config.ts`. Install dependencies from the lockfile, then download the browser builds used by Playwright. [Playwright browser installation guide](https://playwright.dev/docs/browsers#install-browsers)

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox
```

The repository also provides `pnpm run setup`, which installs project dependencies and both browsers. On Linux, if browser system libraries are missing, run `pnpm exec playwright install --with-deps chromium firefox`. [Playwright system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies)

## 3. Configure the demo account

On a fresh checkout, copy [`.env.example`](.env.example) to `.env` in the repository root. In PowerShell, run the following command.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Edit `.env` with the values for your dedicated demo account.

| Variable | Value |
|---|---|
| `WEB_APP_URL` | `https://aqxtrader.aquariux.com`. Use the origin shown here. The tests supply their own page paths. |
| `USER_ACCOUNT_ID` | The demo account ID provided for the assessment. |
| `USER_PASSWORD` | The password for the same demo account. Use single quotes in `.env` if the password contains `#`. |
| `TEST_ONE_CLICK_TRADING` | Start with `false` and disable One-Click Trading in the demo account. Set it to `true` after enabling the setting in the app. |

Set the **WebTrader interface to English** before running the suite. Cases that place orders require an open market for the selected symbol. The suite creates and modifies demo orders and positions, and some records can persist between runs. Keep your `.env` local.

## 4. Run the tests

Start with validation and test discovery. Discovery lists the authentication setup and the 40 scenarios for each selected browser without opening the demo.

```sh
pnpm validate
pnpm exec playwright test --list
```

`pnpm validate` runs the TypeScript and framework rule checks. `pnpm test` runs the Chromium and Firefox projects with one worker. Use `--project` to select a single browser. [Playwright config](playwright.config.ts)

The `auth-setup` project signs in once on Chromium and saves the session at `playwright/.auth/demo-account.json`. Install Chromium for setup even when running a different browser project. Setup replaces the file after a successful login, and the browser projects then read that session. The file stays local through `.gitignore`.

In Playwright UI mode (`pnpm test:ui`), enable `auth-setup` in the project filter and run its login test before running an individual trading test. Run setup again when the session expires.

| What to run | Command |
|---|---|
| Entire suite on the enabled projects | `pnpm test` |
| A specific browser | `pnpm test --project=chromium` or `pnpm test --project=firefox` |
| One spec | `pnpm test market-orders.spec.ts --project=chromium` |
| One case by ID | `pnpm test --project=chromium --grep TC-21` |
| Critical scenarios | `pnpm test:p0 --project=chromium` |
| Chromium with a visible browser window | `pnpm test:headed --project=chromium` |

With One-Click Trading disabled, TC-10 and TC-11 cover the confirmation dialog. To run the enabled variants, turn the setting on in WebTrader and set `TEST_ONE_CLICK_TRADING=true`. Use the following command to select the two cases.

```sh
pnpm test --project=chromium --grep "TC-12|TC-13"
```

## 5. View the results

| Report | How to open it |
|---|---|
| Playwright HTML | `pnpm exec playwright show-report reports/html` |
| JUnit XML | Read `reports/results.xml` for the most recent invocation. |
| Allure | `pnpm report:open` opens the report from `reports/allure-results`. Run `pnpm report:generate` to export it to `reports/allure-report`. |

Allure lists **Authentication setup** separately and groups the 40 scenarios by **Scope**. For case details and known limitations, see the [test plan](specs/test-plan.md).

### Watch Allure results live

Start the watcher in the first terminal. Use the local URL it prints if the report does not open automatically.

```sh
pnpm report:watch --host 127.0.0.1 --open --output reports/allure-live
```

Start the tests from the same repository in a second terminal.

```sh
pnpm test
```

The watcher updates the report as completed test results arrive in `reports/allure-results`. Start it before the test run to see the whole run live. The live output is written to `reports/allure-live`, separate from the export created by `pnpm report:generate`. To include results that were already on disk when the watcher started, pass `--no-new-only`. Press `Ctrl+C` in the watcher terminal when you are finished. [Allure 3 real-time reporting](https://allurereport.org/docs/v3/)

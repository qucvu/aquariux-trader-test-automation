# Test Plan — Aquariux WebTrader

## Scope and spec mapping

This desktop test suite covers seven trading workflows on the Aquariux WebTrader demo. It contains **40 scenarios in six Playwright specs**.

| Scope | Playwright spec | Cases | Count |
|---|---|---|---:|
| 1. Market Orders with Stop Loss and Take Profit | [market-orders.spec.ts](../src/tests/trading/market-orders.spec.ts) | TC-01–TC-09 | 9 |
| 2. Market Orders with One-Click Trading | [market-orders.spec.ts](../src/tests/trading/market-orders.spec.ts) | TC-10–TC-13 | 4 |
| 3. Pending Orders and Expiry Options | [pending-orders.spec.ts](../src/tests/trading/pending-orders.spec.ts) | TC-14–TC-23 | 10 |
| 4. Open Positions | [open-positions.spec.ts](../src/tests/trading/open-positions.spec.ts) | TC-24–TC-29 | 6 |
| 5. Bulk Close and Bulk Delete | [bulk-operations.spec.ts](../src/tests/trading/bulk-operations.spec.ts) | TC-30–TC-33 | 4 |
| 6. Trading Records, Notifications, and History Filters | [trading-records.spec.ts](../src/tests/records/trading-records.spec.ts) | TC-34–TC-36 | 3 |
| 7. Order Details and Transaction Status | [order-details-and-status.spec.ts](../src/tests/records/order-details-and-status.spec.ts) | TC-37–TC-40 | 4 |
| **Total** | | | **40** |

The suite has **24 critical (`@P0`), 15 high (`@P1`), and 1 medium (`@P2`)**.

The two market-order scopes share one spec and have separate `test.describe()` groups. The remaining five scopes each have their own spec. The `trading/` folder contains order and position workflows, and `records/` contains history, notifications, and order status workflows.

## Environment and assumptions

- **Application and credentials.** Tests use a dedicated account on the demo at `https://aqxtrader.aquariux.com`. See the [README setup instructions](../README.md#3-configure-the-demo-account) for the environment variables.
- **Language.** Set the WebTrader interface to **English**. The suite uses English UI labels, validation messages, expiry names, order types, and transaction states.
- **Authentication.** The [setup project](../src/tests/auth.setup.ts) signs in through `/web/login` on Chromium before the browser projects run. After the app writes its token to `localStorage`, Playwright saves fresh `storageState` to `playwright/.auth/demo-account.json`. Each worker loads that file, including workers that replace a failed test's worker. Each test starts a separate authenticated browser context.
- **Market availability.** The suite checks the selected symbol on the Trade screen. Market-dependent cases skip when the order button is disabled and shows **Market Closed**. TC-30, TC-31, and TC-33 search their configured symbol list for an open symbol with no orders in the relevant group. They fail during preparation if no candidate qualifies.
- **Demo account state.** Open positions and pending orders can persist between runs. Tests use the order IDs returned by their own submissions to identify records. TC-30, TC-31, and TC-33 also check that the symbol-filtered target group contains exactly the IDs created by the test before confirming a bulk action. Use one worker with a single demo account.
- **Position editing.** The demo **Edit Position** form displays the volume as read-only. TC-25 covers editing the position's Stop Loss and Take Profit.

### One-Click Trading

Set the option in WebTrader before starting a run, then give `TEST_ONE_CLICK_TRADING` the matching value. The flag describes the state of the account.

| WebTrader setting | Environment flag | Eligible confirmation cases | Cases skipped by the flag |
|---|---|---|---|
| Disabled | `false` | TC-10 and TC-11 | TC-12 and TC-13 |
| Enabled | `true` | TC-12 and TC-13 | TC-10 and TC-11 |

The open-market condition still applies. Market order submissions follow the selected confirmation behavior. Pending order submissions use confirmation in both modes. Run the applicable cases in separate invocations to cover both settings.

## Browser coverage and execution

The same **40 scenarios** apply to the Chromium and Firefox desktop projects. See the [README](../README.md#4-run-the-tests) for how to run both browsers or select one. [Playwright config](../playwright.config.ts)

| Project | Playwright desktop preset |
|---|---|
| `chromium` | Desktop Chrome |
| `firefox` | Desktop Firefox |

Use one worker with a single demo account. The suite allows 60 seconds per test, 20 seconds for assertions, and 15 seconds for actions. Each selected browser project depends on `auth-setup`, which appears separately in the report. If setup fails, the dependent scenarios do not start. Run browser projects separately when comparing results so each run has its own browser and account setting.

## Screens and test data

The suite signs in on **Login** (`/web/login`) and runs its scenarios on **Trade** (`/web/trade`). The Trade screen contains the symbol selector, trade ticket, **Open Positions**, **Pending Orders**, **Positions History**, **Orders & Deals**, and the **Notifications** panel.

| Data | Value or source |
|---|---|
| Primary symbol | `EURUSD` from [trading.json](../src/testdata/trading.json) |
| Market and pending order volume | `0.1` lot. TC-26 opens `0.2` lots and closes `0.1` lot. |
| Invalid volume | TC-09 enters `0` lots and compares it with the minimum displayed by the ticket. TC-29 enters `5` lots in the close dialog for a `0.1`-lot position. |
| Point value | The ticket's **One point equals** value for the selected symbol. The suite uses it to calculate and round price offsets. |
| Protection distances | `200` points per active protection in TC-03–TC-08. TC-25 uses `300` points on each side of the entry price. |
| Pending order offset | `300` points from the live reference price. |
| Bulk candidates | `EURGBP`, `CADJPY`, `EURNZD`, `USDSGD`, `USDJPY`, and `AUDUSD`. TC-32 uses `EURUSD`. |
| Specified expiry | Seven days after the run date. TC-21 uses `23:59`. The expiry table is checked for the date in `YYYY-MM-DD` format. |

## Common procedure

The authenticated tests open **Trade** and select the specified symbol. Standard scenarios use `EURUSD`. For an order submission, select the required order type and side, fill the ticket, click the place-order button, and confirm according to the applicable trading mode. The suite captures the submitted order ID and uses it to find the relevant row or notification.

## Scope 1 — Market Orders with Stop Loss and Take Profit

### TC-01 places a BUY market order @P0

**Steps**

Place a BUY Market order for `0.1` lot. Look up its ID in **Open Positions** and **Orders & Deals**.

**Expected result**

The open position has symbol `EURUSD` and volume `0.1`. The matching order has symbol `EURUSD`, requested and filled volumes of `0.1`, and status **Filled**.

### TC-02 places a SELL market order @P0

**Steps**

Place a SELL Market order for `0.1` lot. Look up its ID in **Open Positions** and **Orders & Deals**.

**Expected result**

The open position has symbol `EURUSD` and volume `0.1`. The matching order has symbol `EURUSD`, requested and filled volumes of `0.1`, and status **Filled**.

### TC-03 places a BUY market order with Stop Loss and Take Profit @P0

**Steps**

Prepare a BUY Market order for `0.1` lot. Enter `200` in both protection **Points** fields. Check the retained point values and read the calculated prices before placing the order. Find the resulting position by ID.

**Expected result**

Both point values remain `200` on the ticket. Both calculated prices are positive and match the Stop Loss and Take Profit saved on the position.

### TC-04 places a SELL market order with Stop Loss and Take Profit @P0

**Steps**

Prepare a SELL Market order for `0.1` lot. Enter `200` in both protection **Points** fields. Check the retained point values and read the calculated prices before placing the order. Find the resulting position by ID.

**Expected result**

Both point values remain `200` on the ticket. Both calculated prices are positive and match the Stop Loss and Take Profit saved on the position.

### TC-05 places a BUY market order with Stop Loss only @P1

**Steps**

Prepare a BUY Market order for `0.1` lot. Enter `200` in **Stop Loss Points** and leave Take Profit empty. Read the calculated Stop Loss price, place the order, and find the position by ID.

**Expected result**

The ticket retains `200` Stop Loss points and shows a positive Stop Loss price. The position keeps that price and has no Take Profit value.

### TC-06 places a BUY market order with Take Profit only @P1

**Steps**

Prepare a BUY Market order for `0.1` lot. Enter `200` in **Take Profit Points** and leave Stop Loss empty. Read the calculated Take Profit price, place the order, and find the position by ID.

**Expected result**

The ticket retains `200` Take Profit points and shows a positive Take Profit price. The position keeps that price and has no Stop Loss value.

### TC-07 rejects a Stop Loss above the ask for a BUY order @P0

**Steps**

Read the live ask and the point value. Prepare a BUY Market order for `0.1` lot and set the Stop Loss price to the ask plus `200` points. Attempt placement if the button is enabled.

**Expected result**

The ticket reports `Stop Loss must be less than Sell Price.` The confirmation dialog stays closed and the browser sends no order-placement POST during the checked steps.

### TC-08 rejects a Take Profit below the bid for a BUY order @P0

**Steps**

Read the live bid and the point value. Prepare a BUY Market order for `0.1` lot and set the Take Profit price to the bid minus `200` points. Attempt placement if the button is enabled.

**Expected result**

The ticket reports `Take Profit must be greater than Sell Price.` The confirmation dialog stays closed and the browser sends no order-placement POST during the checked steps.

### TC-09 rejects a volume below the minimum allowed @P1

**Steps**

Read the minimum volume from the ticket and verify that `0` is below it. Prepare a BUY Market order for `0` lots. Attempt placement if the button is enabled.

**Expected result**

The ticket reports `Please enter a valid volume.` The confirmation dialog stays closed and the browser sends no order-placement POST during the checked steps.

## Scope 2 — Market Orders with One-Click Trading

### TC-10 shows the confirmation dialog while One-Click Trading is disabled @P0

**Precondition**

One-Click Trading is disabled and `TEST_ONE_CLICK_TRADING=false`.

**Steps**

Prepare a BUY Market order for `0.1` lot and click the place-order button. Check the confirmation dialog, then cancel it.

**Expected result**

The confirmation dialog opens and displays the symbol field, order type field, and **Confirm** button.

### TC-11 cancels the confirmation dialog and creates no order @P0

**Precondition**

One-Click Trading is disabled and `TEST_ONE_CLICK_TRADING=false`.

**Steps**

Prepare a BUY Market order for `0.1` lot, open its confirmation dialog, and cancel.

**Expected result**

The dialog closes. The browser sends no order-placement POST during the checked steps.

### TC-12 places a BUY market order with One-Click Trading enabled @P0

**Precondition**

One-Click Trading is enabled and `TEST_ONE_CLICK_TRADING=true`.

**Steps**

Place a BUY Market order for `0.1` lot without a confirmation click. Find the resulting position by the submitted ID.

**Expected result**

The confirmation dialog is closed after submission. **Open Positions** shows the submitted ID with volume `0.1`.

### TC-13 places a SELL market order with One-Click Trading enabled @P0

**Precondition**

One-Click Trading is enabled and `TEST_ONE_CLICK_TRADING=true`.

**Steps**

Place a SELL Market order for `0.1` lot without a confirmation click. Find the resulting position by the submitted ID.

**Expected result**

The confirmation dialog is closed after submission. **Open Positions** shows the submitted ID with volume `0.1`.

## Scope 3 — Pending Orders and Expiry Options

### TC-14 creates a BUY Limit pending order @P0

**Steps**

Place and confirm a BUY Limit for `0.1` lot at the live ask minus `300` points. Find its ID in **Pending Orders**.

**Expected result**

The row has symbol `EURUSD`, type **BUY LIMIT**, requested volume `0.1`, and the submitted entry price.

### TC-15 creates a SELL Limit pending order @P0

**Steps**

Place and confirm a SELL Limit for `0.1` lot at the live bid plus `300` points. Find its ID in **Pending Orders**.

**Expected result**

The row has symbol `EURUSD`, type **SELL LIMIT**, requested volume `0.1`, and the submitted entry price.

### TC-16 creates a BUY Stop pending order @P1

**Steps**

Place and confirm a BUY Stop for `0.1` lot at the live ask plus `300` points. Find its ID in **Pending Orders**.

**Expected result**

The row has symbol `EURUSD`, type **BUY STOP**, requested volume `0.1`, and the submitted entry price.

### TC-17 creates a BUY Stop Limit pending order @P1

**Steps**

Prepare a BUY Stop Limit for `0.1` lot. Set **Price** to the live ask plus `300` points and **Stop Limit Price** to **Price** minus `300` points. Place and confirm the order, then find its ID in **Pending Orders**.

**Expected result**

The row has symbol `EURUSD`, type **BUY STOP LIMIT**, requested volume `0.1`, and an entry price equal to the submitted **Price**.

### TC-18 sets the expiry of a pending order to Good Till Canceled @P1

**Steps**

Configure a BUY Limit using the standard pending volume and price offset. Select **Good Till Canceled**, place and confirm the order, and find the submitted ID in **Pending Orders**.

**Expected result**

**Expiry** shows **Good Till Canceled** and **Expiry Date** shows `--`.

### TC-19 sets the expiry of a pending order to Good Till Day @P1

**Steps**

Configure a BUY Limit using the standard pending volume and price offset. Select **Good Till Day**, place and confirm the order, and find the submitted ID in **Pending Orders**.

**Expected result**

**Expiry** shows **Good Till Day**.

### TC-20 sets the expiry of a pending order to Specified Date @P1

**Steps**

Configure a BUY Limit using the standard pending volume and price offset. Select **Specified Date** and pick the date seven days after the run date. Confirm the order and find its ID in **Pending Orders**.

**Expected result**

**Expiry** shows **Specified Date**. **Expiry Date** includes the chosen date as `YYYY-MM-DD`.

### TC-21 sets the expiry of a pending order to a specific date and time @P2

**Steps**

Configure a BUY Limit using the standard pending volume and price offset. Select **Specified Date and Time**, pick the date seven days after the run date, and set the time to `23:59`. Confirm the order and find its ID in **Pending Orders**.

**Expected result**

**Expiry** shows **Specified Date and Time**. **Expiry Date** includes the chosen date as `YYYY-MM-DD` and the time `23:59`.

### TC-22 persists a pending order price change @P1

**Steps**

1. Create a BUY Limit order using the standard pending volume and price offset. Capture its ID and submitted price.
2. Open **Edit** for that ID and increase the entry price by one point. Submit the edit and confirm the change.
3. Check the new price, reload Trade, and look up the same ID again.

**Expected result**

A toast appears after confirmation. The new price appears on the same row before and after the reload.

### TC-23 deletes a pending order @P0

**Steps**

Create a BUY Limit order using the standard pending volume and price offset. Delete that ID in **Pending Orders**, confirm, and reload Trade.

**Expected result**

A toast appears after confirmation. The submitted ID is absent from **Pending Orders** after the reload.

TC-18 through TC-21 verify the expiry settings saved on the order. Actual expiry timing is outside these scenarios.

## Scope 4 — Open Positions

### TC-24 views the position created in Open Positions @P0

**Steps**

Place a BUY Market order for `0.1` lot and find its ID in **Open Positions**.

**Expected result**

The position shows `EURUSD` and volume `0.1`. Its profit/loss value contains a digit.

### TC-25 modifies the Stop Loss and Take Profit of a position @P0

**Steps**

Place a BUY Market order for `0.1` lot and read that position's entry price. Set the Stop Loss to entry minus `300` points and the Take Profit to entry plus `300` points. Submit the edit and confirm.

**Expected result**

A toast appears after confirmation. The same position shows both new prices and keeps volume `0.1`.

### TC-26 closes a position partially @P0

**Steps**

Open a BUY position for `0.2` lots. Read the original volume, verify it exceeds `0.1`, and confirm a partial close of `0.1` lot for that ID.

**Expected result**

The same position remains in **Open Positions**. Its remaining volume equals the original volume minus `0.1` lot, to eight decimal places.

### TC-27 closes a position completely @P0

**Steps**

Open a BUY position for `0.1` lot. Read the current volume for that ID, enter the full volume in the close dialog, and confirm.

**Expected result**

That ID disappears from **Open Positions**.

### TC-28 shows a closed position in Positions History @P0

**Steps**

Open a BUY position for `0.1` lot, close its full volume by ID, and look up the ID in **Open Positions** and **Positions History**.

**Expected result**

The ID disappears from **Open Positions**. **Positions History** shows the same ID, symbol `EURUSD`, volume `0.1`, and a profit/loss value containing a digit.

### TC-29 blocks a close volume that exceeds the current position volume @P1

**Steps**

Open a BUY position for `0.1` lot. Open its close dialog and enter `5` lots. Check the dialog's response, then cancel.

**Expected result**

**Confirm** is disabled or the input is capped at no more than `0.1` lot. The same position still has volume `0.1` after Cancel.

## Scope 5 — Bulk Close and Bulk Delete

### TC-30 bulk closes several positions @P0

**Steps**

Find an open candidate symbol with no existing open positions. Create two BUY Market positions of `0.1` lot each. Enable **Hide Other Symbols** and confirm that the filtered **Open Positions** table contains exactly the two new IDs. Select **Bulk Close → All Positions** and confirm.

**Expected result**

Both IDs disappear from **Open Positions** and appear in **Positions History**.

### TC-31 bulk deletes several pending orders @P0

**Steps**

Find an open candidate symbol with no existing pending orders. Create a BUY Limit and a SELL Limit using the standard pending data. Enable **Hide Other Symbols** and confirm that the filtered **Pending Orders** table contains exactly the two new IDs. Select **Bulk Delete → All Orders** and confirm.

**Expected result**

Both IDs disappear from **Pending Orders**.

### TC-32 keeps pending orders when bulk deletion is cancelled @P1

**Steps**

Create a BUY Limit and a SELL Limit on `EURUSD` using the standard pending data. Verify both IDs are present. Enable **Hide Other Symbols**, select **Bulk Delete → All Orders**, and cancel the visible confirmation dialog.

**Expected result**

Both IDs remain in **Pending Orders**.

### TC-33 deletes only the pending orders of the chosen type @P1

**Steps**

Find an open candidate symbol with no existing limit orders. Create a BUY Limit, a SELL Limit, and a BUY Stop using the standard pending data. Verify the Stop ID is present. Enable **Hide Other Symbols** and confirm that the filtered limit group contains exactly the two new Limit IDs. Select **Bulk Delete → Limit Orders** and confirm.

**Expected result**

Both Limit IDs disappear from **Pending Orders**. The Stop ID remains.

## Scope 6 — Trading Records, Notifications, and History Filters

### TC-34 shows the created order in Orders and Deals @P0

**Steps**

Place a BUY Market order for `0.1` lot. Find the submitted ID in **Orders & Deals**.

**Expected result**

The row shows symbol `EURUSD`, requested and filled volumes of `0.1`, and status **Filled**.

### TC-35 shows a notification for the new position @P1

**Steps**

Place a BUY Market order for `0.1` lot and watch for a toast. Open or refresh **Notifications → Positions** and look for the new position.

**Expected result**

A toast appears after placement. The notification list contains an entry titled **Position Created** with the exact metadata `EURUSD | Order No. <submitted ID>`.

### TC-36 filters the created order by date range @P1

**Steps**

1. Place a BUY Market order for `0.1` lot today and verify that its ID is visible in **Orders & Deals**.
2. Set the **Custom** date filter from 30 days ago to 20 days ago and apply it.
3. Apply a second **Custom** range from yesterday through today.

**Expected result**

The ID disappears in the earlier range and reappears when the range includes today.

## Scope 7 — Order Details and Transaction Status

### TC-37 matches the details of the created pending order @P0

**Steps**

Create a BUY Limit using the standard pending volume and offset with fill policy **Return** and expiry **Good Till Canceled**. Open **Edit** for the submitted ID, read the fields, and cancel the dialog.

**Expected result**

The dialog shows the submitted ID, symbol `EURUSD`, volume `0.1`, submitted price, and order type **Limit** or **Buy Limit**. The fill policy is **Return**, and expiry shows **GTC** or the full **Good Till Canceled** label.

### TC-38 records the transition from pending to cancelled @P0

**Steps**

Create a BUY Limit using the standard pending volume and offset. Check the ID in **Pending Orders** and **Orders & Deals**. Delete the same order and confirm.

**Expected result**

Before deletion, the ID is present in **Pending Orders** and absent from **Orders & Deals**. After deletion, it disappears from **Pending Orders** and appears in **Orders & Deals** with status **Canceled**.

### TC-39 matches the filled order to its closed position history record @P0

**Steps**

Place a BUY Market order for `0.1` lot and close the full position by ID. Read the original order in **Orders & Deals**, then open **Positions History** and wait for the fields on the matching ID to update.

**Expected result**

The ID is absent from **Open Positions**. The original order is **Filled** with symbol `EURUSD` and requested and filled volumes of `0.1`. The history row has the same ID and symbol, its volume matches the filled volume, and **Close Date** matches `YYYY-MM-DD HH:mm:ss`.

### TC-40 matches a filled market order to the open position @P1

**Steps**

Place a BUY Market order for `0.1` lot. Look up the ID in **Orders & Deals**, **Pending Orders**, and **Open Positions**.

**Expected result**

**Orders & Deals** shows status **Filled**, symbol `EURUSD`, and requested and filled volumes of `0.1`. The ID is absent from **Pending Orders**. The corresponding open position has the same symbol and filled volume.

## Execution evidence

Full-suite results from separate invocations on the demo environment on **26 November 2026**. The counts below cover the 40 trading scenarios. Authentication setup is reported separately.

| Project | Evidence | Passed | Skipped | Failed or errored |
|---|---|---:|---:|---:|
| Chromium | Full run completed at 12:02 ICT. Authentication setup passed. [Allure screenshot](../sample-reports/chrome.png) | 38 | 2 | 0 |
| Firefox | Full run completed at 12:14 ICT. Authentication setup passed. [Allure screenshot](../sample-reports/firefox.png) | 38 | 2 | 0 |

TC-12 and TC-13 were skipped with One-Click Trading disabled. TC-30 and TC-39 passed on Chromium and Firefox.

Record the browser project, the One-Click Trading setting, and the case results for each run. The JUnit report represents the most recent invocation, including focused reruns. Allure may group results from previous runs as additional attempts. For live results from a new run, start Allure Watch before the tests. [Live report instructions](../README.md#watch-allure-results-live)

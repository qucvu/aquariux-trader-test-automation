import { test, expect } from '@fixtures';
import { tradingData, tradingStates } from '@testdata/trading-data';
import { dateInDays } from '@utils/dates';

const data = tradingData();
const marketClosed = 'The demo disables order placement when the market is closed.';

test.describe('Scope 6 — Trading records and notifications', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), marketClosed);
    });

    test('TC-34 shows the created order in Orders and Deals @P0', async ({ tradingModule, recordsModule }) => {
        const orderId = await test.step('Execute a market order', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await test.step('Verify the symbol and volume of that order in Orders and Deals', async () => {
            const order = await recordsModule.getOrderRecord(orderId);
            expect(order.symbol).toBe(data.symbol);
            expect(order.requestedVolume).toBe(data.volume.min);
            expect(order.filledVolume).toBe(data.volume.min);
            expect(order.state).toMatch(tradingStates.filled);
        });
    });

    test('TC-35 shows a notification for the new position @P1', async ({ tradingModule, recordsModule, tradePage }) => {
        const orderId = await test.step('Execute a market order and verify the toast', () =>
            tradePage.expectToastAfter(() => tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min)),
        );

        await test.step('Verify the Position Created notification by symbol and order number', async () => {
            await expect(async () => {
                await recordsModule.refreshOrderNotifications();
                await expect.poll(() => recordsModule.getNotifications(), { timeout: 3_000 }).toContainEqual({
                    title: 'Position Created',
                    meta: `${data.symbol} | Order No. ${orderId}`,
                });
            }).toPass({
                timeout: 25_000,
                intervals: [1_000, 2_000, 4_000],
            });
        });
    });

    test('TC-36 filters the created order by date range @P1', async ({ tradingModule, recordsModule, tradePage }) => {
        const orderId = await test.step('Execute a market order today', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await test.step('Verify that the order is visible before filtering', async () => {
            await recordsModule.openOrdersAndDeals();
            await tradePage.orders.expectOrderIdPresent(orderId);
        });

        await test.step('Filter by an earlier range and verify that the order is excluded', async () => {
            await recordsModule.filterByDateRange(dateInDays(-30), dateInDays(-20));
            await tradePage.orders.expectOrderRemoved(orderId);
        });

        await test.step('Apply a range that includes the order and verify it reappears', async () => {
            await recordsModule.filterByDateRange(dateInDays(-1), new Date());
            await tradePage.orders.expectOrderIdPresent(orderId);
        });
    });
});

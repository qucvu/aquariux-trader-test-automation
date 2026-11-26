import { test } from '@fixtures';
import { tradingData } from '@testdata/trading-data';

const data = tradingData();

test.describe('Scope 5 — Bulk close and bulk delete @web', () => {
    test('TC-30 bulk closes several positions @P0', async ({ tradingModule, recordsModule }) => {
        const symbol = await test.step('Find an open symbol with no open positions', () =>
            tradingModule.prepareBulkSymbol(data.bulk.symbols, 'open-positions'),
        );

        const orderIds = await test.step('Create two positions on that symbol', async () => {
            const first = await tradingModule.placeMarketOrder(symbol, 'BUY', data.volume.min);
            const second = await tradingModule.placeMarketOrder(symbol, 'BUY', data.volume.min);
            return [first, second];
        });

        await test.step('Verify the symbol filter and close both positions', async () => {
            await tradingModule.openOpenPositions(true);
            await tradingModule.expectBulkOrderIds(orderIds);
            await tradingModule.bulkClosePositions();
            await tradingModule.confirmBulkAction();
            for (const id of orderIds) {
                await tradingModule.expectPositionClosed(id);
            }
        });

        await test.step('Verify both IDs in Positions History', async () => {
            for (const id of orderIds) {
                await recordsModule.expectPositionRecord(id);
            }
        });
    });

    test('TC-31 bulk deletes several pending orders @P0', async ({ tradingModule }) => {
        const symbol = await test.step('Find an open symbol with no pending orders', () =>
            tradingModule.prepareBulkSymbol(data.bulk.symbols, 'pending-orders'),
        );
        const orderIds = await test.step('Create two pending orders', async () => {
            const buy = await tradingModule.placePendingOrder(symbol, 'BUY', data.pending.volume, data.pending.offsetPoints);
            const sell = await tradingModule.placePendingOrder(symbol, 'SELL', data.pending.volume, data.pending.offsetPoints);
            return [buy.orderId, sell.orderId];
        });

        await test.step('Verify the symbol filter and delete both orders', async () => {
            await tradingModule.openPendingOrders(true);
            await tradingModule.expectBulkOrderIds(orderIds);
            await tradingModule.bulkDeletePendingOrders();
            await tradingModule.confirmBulkAction();
            for (const id of orderIds) {
                await tradingModule.expectPendingOrderRemoved(id);
            }
        });
    });

    test('TC-32 keeps pending orders when bulk deletion is cancelled @P1', async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), 'The demo disables order placement when the market is closed.');
        const orderIds = await test.step('Create two pending orders', async () => {
            const buy = await tradingModule.placePendingOrder(data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints);
            const sell = await tradingModule.placePendingOrder(data.symbol, 'SELL', data.pending.volume, data.pending.offsetPoints);
            return [buy.orderId, sell.orderId];
        });

        await test.step('Open and cancel the bulk delete confirmation', async () => {
            for (const id of orderIds) {
                await tradingModule.expectPendingOrderPresent(id);
            }
            await tradingModule.openPendingOrders(true);
            await tradingModule.bulkDeletePendingOrders();
            await tradingModule.expectBulkConfirmationVisible();
            await tradingModule.cancelBulkAction();
        });

        await test.step('Verify that both pending orders are still present', async () => {
            for (const id of orderIds) {
                await tradingModule.expectPendingOrderPresent(id);
            }
        });
    });

    test('TC-33 deletes only the pending orders of the chosen type @P1', async ({ tradingModule }) => {
        const symbol = await test.step('Find an open symbol with no pending limit orders', () =>
            tradingModule.prepareBulkSymbol(data.bulk.symbols, 'pending-orders', 'limit'),
        );
        const { limitOrderIds, stopOrderId } = await test.step('Create two limit orders and a stop order', async () => {
            const buy = await tradingModule.placePendingOrder(symbol, 'BUY', data.pending.volume, data.pending.offsetPoints);
            const sell = await tradingModule.placePendingOrder(symbol, 'SELL', data.pending.volume, data.pending.offsetPoints);
            const stop = await tradingModule.placePendingOrder(symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, 'Stop');
            return { limitOrderIds: [buy.orderId, sell.orderId], stopOrderId: stop.orderId };
        });

        await test.step('Bulk delete limit orders and verify the stop order remains', async () => {
            await tradingModule.expectPendingOrderPresent(stopOrderId);
            await tradingModule.openPendingOrders(true);
            await tradingModule.expectBulkOrderIds(limitOrderIds, 'limit');
            await tradingModule.bulkDeletePendingOrders('limit');
            await tradingModule.confirmBulkAction();

            for (const id of limitOrderIds) {
                await tradingModule.expectPendingOrderRemoved(id);
            }
            await tradingModule.expectPendingOrderPresent(stopOrderId);
        });
    });
});

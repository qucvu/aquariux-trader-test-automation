import { test, expect } from '@fixtures';
import { tradingData, tradingStates } from '@testdata/trading-data';

const data = tradingData();
const marketClosed = 'The demo disables order placement when the market is closed.';

test.describe('Scope 7 — Order details and transaction status', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), marketClosed);
    });

    test('TC-37 matches the details of the created pending order @P0', async ({ tradingModule, recordsModule }) => {
        const { orderId, price } = await test.step('Create a BUY Limit order with a known expiry', () =>
            tradingModule.placePendingOrder(
                data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, 'Limit',
                { fillPolicy: 'Return', expiry: 'Good Till Canceled' },
            ),
        );

        await test.step('Verify the details of that order', async () => {
            const details = await recordsModule.getOrderDetails(orderId);
            expect(details['order-id']).toBe(orderId);
            expect(details.symbol).toBe(data.symbol);
            expect(Number(details.volume)).toBe(data.pending.volume);
            expect(Number(details.price)).toBe(price);
            expect(details['order-type']).toMatch(/^(?:buy )?limit$/i);
            expect(details['fill-policy']).toMatch(/^return$/i);
            expect(details.expiry).toMatch(/^(?:GTC|good till cancell?ed)$/i);
        });
    });

    test('TC-38 records the transition from pending to cancelled @P0', async ({ tradingModule, recordsModule }) => {
        const { orderId } = await test.step('Create the pending order', () =>
            tradingModule.placePendingOrder(data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints),
        );

        await test.step('Verify that the order is pending', async () => {
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(await recordsModule.hasOrderRecord(orderId)).toBe(false);
        });

        await test.step('Delete the order and verify that the historical status is cancelled', async () => {
            await tradingModule.deletePendingOrder(orderId);
            await tradingModule.expectPendingOrderRemoved(orderId);
            await expect.poll(() => recordsModule.getOrderRecordState(orderId)).toMatch(tradingStates.canceled);
        });
    });

    test('TC-39 matches the filled order to its closed position history record @P0', async ({
        tradingModule,
        recordsModule,
    }) => {
        const orderId = await test.step('Create and close a position', async () => {
            const id = await tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min);
            await tradingModule.closePosition(id);
            await tradingModule.expectPositionClosed(id);
            return id;
        });

        await test.step('Verify the filled order and matching position with a close date', async () => {
            const order = await recordsModule.getOrderRecord(orderId, tradingStates.filled);
            await recordsModule.expectPositionRecord(orderId);
            expect(order.symbol).toBe(data.symbol);
            expect(order.requestedVolume).toBe(data.volume.min);
            expect(order.filledVolume).toBe(data.volume.min);
            expect(order.state).toMatch(tradingStates.filled);
            await expect.poll(() => recordsModule.readPositionHistoryRecord(orderId)).toEqual({
                closeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
                symbol: order.symbol,
                volume: order.filledVolume,
            });
        });
    });

    test('TC-40 matches a filled market order to the open position @P1', async ({ tradingModule, recordsModule }) => {
        const orderId = await test.step('Execute a market order', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await test.step('Verify the execution record and the resulting position', async () => {
            const order = await recordsModule.getOrderRecord(orderId);
            expect(order.symbol).toBe(data.symbol);
            expect(order.requestedVolume).toBe(data.volume.min);
            expect(order.filledVolume).toBe(data.volume.min);
            expect(order.state).toMatch(tradingStates.filled);
            await tradingModule.expectPendingOrderRemoved(orderId);
            await tradingModule.expectPositionPresent(orderId);
            expect(await tradingModule.getPositionSymbol(orderId)).toBe(order.symbol);
            expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(order.filledVolume);
        });
    });
});

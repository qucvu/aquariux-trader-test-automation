import { test, expect } from '@fixtures';
import { tradingData } from '@testdata/trading-data';
import { dateInDays, toIsoDate } from '@utils/dates';

const data = tradingData();

test.describe('Scope 3 — Pending orders and expiry options @web', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), 'The demo disables order placement when the market is closed.');
    });

    for (const { id, side, orderType, expectedType, priority } of [
        { id: 'TC-14', side: 'BUY', orderType: 'Limit', expectedType: 'BUY LIMIT', priority: '@P0' },
        { id: 'TC-15', side: 'SELL', orderType: 'Limit', expectedType: 'SELL LIMIT', priority: '@P0' },
        { id: 'TC-16', side: 'BUY', orderType: 'Stop', expectedType: 'BUY STOP', priority: '@P1' },
        { id: 'TC-17', side: 'BUY', orderType: 'Stop Limit', expectedType: 'BUY STOP LIMIT', priority: '@P1' },
    ] as const) {
        test(`${id} creates a ${side} ${orderType} pending order ${priority}`, async ({ tradingModule }) => {
            const { orderId, price } = await test.step('Place the pending order', () =>
                tradingModule.placePendingOrder(data.symbol, side, data.pending.volume, data.pending.offsetPoints, orderType),
            );

            await test.step('Verify the created pending order', async () => {
                await tradingModule.expectPendingOrderPresent(orderId);
                expect(await tradingModule.getPendingOrderSymbol(orderId)).toBe(data.symbol);
                expect(await tradingModule.getPendingOrderVolume(orderId)).toBe(data.pending.volume);
                expect(await tradingModule.getPendingOrderType(orderId)).toBe(expectedType);
                expect(Number(await tradingModule.getPendingOrderEntryPrice(orderId))).toBe(price);
            });
        });
    }

    test('TC-18 sets the expiry of a pending order to Good Till Canceled @P1', async ({ tradingModule }) => {
        const { orderId } = await test.step('Place the order with Good Till Canceled expiry', () =>
            tradingModule.placePendingOrderWithExpiry(
                data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, 'Good Till Canceled',
            ),
        );

        await test.step('Verify the expiry mode and the empty expiry date', async () => {
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(await tradingModule.getPendingOrderExpiry(orderId)).toBe('Good Till Canceled');
            expect(await tradingModule.getPendingOrderExpiryDate(orderId)).toBe('--');
        });
    });

    test('TC-19 sets the expiry of a pending order to Good Till Day @P1', async ({ tradingModule }) => {
        const { orderId } = await test.step('Place a BUY Limit with Good Till Day expiry', () =>
            tradingModule.placePendingOrderWithExpiry(
                data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, 'Good Till Day',
            ),
        );

        await test.step('Verify the saved expiry mode', async () => {
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(await tradingModule.getPendingOrderExpiry(orderId)).toBe('Good Till Day');
        });
    });

    test('TC-20 sets the expiry of a pending order to Specified Date @P1', async ({ tradingModule }) => {
        const futureDate = dateInDays(7);
        const { orderId } = await test.step('Place the order with a future expiry date', () =>
            tradingModule.placePendingOrderWithExpiryDate(
                data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, futureDate,
            ),
        );

        await test.step('Verify the stored expiry date', async () => {
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(await tradingModule.getPendingOrderExpiry(orderId)).toBe('Specified Date');
            expect(await tradingModule.getPendingOrderExpiryDate(orderId)).toContain(toIsoDate(futureDate));
        });
    });

    test('TC-21 sets the expiry of a pending order to a specific date and time @P2', async ({ tradingModule }) => {
        const futureDate = dateInDays(7);
        const futureTime = '23:59';
        const { orderId } = await test.step('Place the order with a specific expiry date and time', () =>
            tradingModule.placePendingOrderWithExpiryDateTime(
                data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints, futureDate, futureTime,
            ),
        );

        await test.step('Verify the stored expiry date and time', async () => {
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(await tradingModule.getPendingOrderExpiry(orderId)).toBe('Specified Date and Time');
            const expiryDate = await tradingModule.getPendingOrderExpiryDate(orderId);
            expect(expiryDate).toContain(toIsoDate(futureDate));
            expect(expiryDate).toContain(futureTime);
        });
    });

    test('TC-22 persists a pending order price change @P1', async ({ tradingModule }) => {
        const { orderId, price } = await test.step('Create the pending order', () =>
            tradingModule.placePendingOrder(data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints),
        );
        const pointValue = await tradingModule.getPointValue();
        const newPrice = tradingModule.calculateOffsetPrice(price, 1, pointValue);

        await test.step('Change the price of that order', async () => {
            await tradingModule.updatePendingOrder(orderId, { price: newPrice });
            await expect.poll(async () => Number(await tradingModule.getPendingOrderEntryPrice(orderId)))
                .toBe(newPrice);
        });

        await test.step('Reload the trade screen and verify the stored price', async () => {
            await tradingModule.prepareTradeScreen(data.symbol);
            await tradingModule.expectPendingOrderPresent(orderId);
            expect(Number(await tradingModule.getPendingOrderEntryPrice(orderId))).toBe(newPrice);
        });
    });

    test('TC-23 deletes a pending order @P0', async ({ tradingModule }) => {
        const { orderId } = await test.step('Create the pending order', () =>
            tradingModule.placePendingOrder(data.symbol, 'BUY', data.pending.volume, data.pending.offsetPoints),
        );

        await test.step('Delete that order and verify its removal', async () => {
            await tradingModule.deletePendingOrder(orderId);
            await tradingModule.expectPendingOrderRemoved(orderId);
        });
    });
});

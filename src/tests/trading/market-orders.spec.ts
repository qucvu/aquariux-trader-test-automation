import { config } from '@core/config';
import { test, expect } from '@fixtures';
import { tradingData, tradingStates } from '@testdata/trading-data';

const data = tradingData();
const marketClosed = 'Market is closed. See the environment limitations in the test plan.';

test.describe('Scope 1 — Market orders with Stop Loss and Take Profit', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), marketClosed);
    });

    for (const { id, side } of [
        { id: 'TC-01', side: 'BUY' },
        { id: 'TC-02', side: 'SELL' },
    ] as const) {
        test(`${id} places a ${side} market order @P0`, async ({ tradingModule, recordsModule }) => {
            const orderId = await test.step('Place the market order', () =>
                tradingModule.placeMarketOrder(data.symbol, side, data.volume.min),
            );

            await test.step('Verify the created position and its filled order', async () => {
                await tradingModule.expectPositionPresent(orderId);
                expect(await tradingModule.getPositionSymbol(orderId)).toBe(data.symbol);
                expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(data.volume.min);

                const order = await recordsModule.getOrderRecord(orderId);
                expect(order.symbol).toBe(data.symbol);
                expect(order.requestedVolume).toBe(data.volume.min);
                expect(order.filledVolume).toBe(data.volume.min);
                expect(order.state).toMatch(tradingStates.filled);
            });
        });
    }

    for (const { id, side, protection, priority } of [
        { id: 'TC-03', side: 'BUY', protection: 'Stop Loss and Take Profit', priority: '@P0' },
        { id: 'TC-04', side: 'SELL', protection: 'Stop Loss and Take Profit', priority: '@P0' },
        { id: 'TC-05', side: 'BUY', protection: 'Stop Loss only', priority: '@P1' },
        { id: 'TC-06', side: 'BUY', protection: 'Take Profit only', priority: '@P1' },
    ] as const) {
        test(`${id} places a ${side} market order with ${protection} ${priority}`, async ({ tradingModule }) => {
            const { orderId, stopLoss, takeProfit } = await test.step(
                'Place the market order with the requested protection points',
                () => tradingModule.placeMarketOrderWithProtection({
                    symbol: data.symbol,
                    side,
                    volume: data.volume.min,
                    stopLossPoints: protection === 'Take Profit only' ? undefined : data.stopLoss.points,
                    takeProfitPoints: protection === 'Stop Loss only' ? undefined : data.takeProfit.points,
                }),
            );

            await test.step('Verify the stored Stop Loss and Take Profit', async () => {
                await tradingModule.expectPositionPresent(orderId);
                await expect.poll(async () => ({
                    stopLoss: await tradingModule.getPositionStopLoss(orderId),
                    takeProfit: await tradingModule.getPositionTakeProfit(orderId),
                })).toEqual({ stopLoss, takeProfit });
            });
        });
    }

    for (const { name, priceField, offsetPoints, validation } of [
        {
            name: 'TC-07 rejects a Stop Loss above the ask for a BUY order',
            priceField: 'stopLossPrice',
            offsetPoints: data.stopLoss.points,
            validation: 'Stop Loss must be less than Sell Price.',
        },
        {
            name: 'TC-08 rejects a Take Profit below the bid for a BUY order',
            priceField: 'takeProfitPrice',
            offsetPoints: -data.takeProfit.points,
            validation: 'Take Profit must be greater than Sell Price.',
        },
    ] as const) {
        test(`${name} @P0`, async ({ tradingModule, tradePage }) => {
            const reference = priceField === 'stopLossPrice'
                ? await tradingModule.getAskPrice()
                : await tradingModule.getBidPrice();
            const pointValue = await tradingModule.getPointValue();
            const invalidPrice = tradingModule.calculateOffsetPrice(reference, offsetPoints, pointValue);
            await tradePage.expectNoOrderSubmissionDuring(async () => {
                await test.step('Attempt the BUY order with an invalid protection price', () =>
                    tradingModule.attemptInvalidOrder({
                        symbol: data.symbol,
                        orderType: 'Market',
                        side: 'BUY',
                        volume: data.volume.min,
                        [priceField]: invalidPrice,
                    }),
                );

                await test.step('Verify protection validation and that no confirmation opens', async () => {
                    await tradePage.ticket.expectValidationMessage(validation);
                    await tradePage.dialog.expectOrderConfirmationClosed();
                });
            });
        });
    }

    test('TC-09 rejects a volume below the minimum allowed @P1', async ({
        tradingModule,
        tradePage,
    }) => {
        const minVolume = await tradingModule.getMinVolume();
        expect(data.volume.belowMin).toBeLessThan(minVolume);

        await tradePage.expectNoOrderSubmissionDuring(async () => {
            await test.step('Attempt the BUY order with a below-minimum volume', () =>
                tradingModule.attemptInvalidOrder({
                    symbol: data.symbol,
                    orderType: 'Market',
                    side: 'BUY',
                    volume: data.volume.belowMin,
                }),
            );

            await test.step('Verify that the ticket reports the invalid volume', async () => {
                await tradePage.ticket.expectValidationMessage('Please enter a valid volume.');
                await tradePage.dialog.expectOrderConfirmationClosed();
            });
        });
    });
});

test.describe('Scope 2 — Market orders with One-Click Trading', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), marketClosed);
    });

    test('TC-10 shows the confirmation dialog while One-Click Trading is disabled @P0', async ({
        tradingModule,
        tradePage,
    }) => {
        test.skip(config.web.oneClickTradingEnabled, 'This case requires One-Click Trading to be disabled.');

        await test.step('Submit the BUY order', () =>
            tradingModule.openOrderConfirmation({
                symbol: data.symbol,
                orderType: 'Market',
                side: 'BUY',
                volume: data.volume.min,
            }),
        );

        await test.step('Verify that confirmation is requested', async () => {
            await tradePage.dialog.expectOrderConfirmationOpen();
            await tradePage.dialog.cancelOrderConfirmation();
        });
    });

    test('TC-11 cancels the confirmation dialog and creates no order @P0', async ({
        tradingModule,
        tradePage,
    }) => {
        test.skip(config.web.oneClickTradingEnabled, 'This case requires One-Click Trading to be disabled.');
        await test.step('Cancel the BUY order and verify that no submission was sent', () =>
            tradePage.expectNoOrderSubmissionDuring(async () => {
                await tradingModule.submitOrderWithoutConfirming({
                    symbol: data.symbol,
                    orderType: 'Market',
                    side: 'BUY',
                    volume: data.volume.min,
                });
                await tradePage.dialog.expectOrderConfirmationClosed();
            }),
        );
    });

    for (const { id, side } of [
        { id: 'TC-12', side: 'BUY' },
        { id: 'TC-13', side: 'SELL' },
    ] as const) {
        test(`${id} places a ${side} market order with One-Click Trading enabled @P0`, async ({
            tradingModule,
            tradePage,
        }) => {
            test.skip(!config.web.oneClickTradingEnabled, 'Enable One-Click Trading on the demo account and set TEST_ONE_CLICK_TRADING=true.');

            const orderId = await test.step('Place the market order without confirming a dialog', () =>
                tradingModule.placeOrder({
                    symbol: data.symbol,
                    orderType: 'Market',
                    side,
                    volume: data.volume.min,
                }, { confirm: 'never' }),
            );

            await test.step('Verify the new position and the absence of a confirmation dialog', async () => {
                await tradePage.dialog.expectOrderConfirmationClosed();
                await tradingModule.expectPositionPresent(orderId);
                expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(data.volume.min);
            });
        });
    }
});

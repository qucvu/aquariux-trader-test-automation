import { test, expect } from '@fixtures';
import { tradingData } from '@testdata/trading-data';

const data = tradingData();

test.describe('Scope 4 — Open positions', () => {
    test.beforeEach(async ({ tradingModule }) => {
        await tradingModule.prepareTradeScreen(data.symbol);
        test.skip(!(await tradingModule.isMarketOpen()), 'An open market is required to create the position.');
    });

    test('TC-24 views the position created in Open Positions @P0', async ({ tradingModule }) => {
        const orderId = await test.step('Create a position', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await test.step('Verify the fields of the created position', async () => {
            await tradingModule.expectPositionPresent(orderId);
            expect(await tradingModule.getPositionSymbol(orderId)).toBe(data.symbol);
            expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(data.volume.min);
            expect(await tradingModule.getPositionProfitLoss(orderId)).toMatch(/\d/);
        });
    });

    test('TC-25 modifies the Stop Loss and Take Profit of a position @P0', async ({ tradingModule }) => {
        const orderId = await test.step('Create a position', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await tradingModule.expectPositionPresent(orderId);
        const entryPrice = Number(await tradingModule.getPositionEntryPrice(orderId));
        const pointValue = await tradingModule.getPointValue();
        const newStopLoss = tradingModule.calculateOffsetPrice(entryPrice, -data.stopLoss.points * 1.5, pointValue);
        const newTakeProfit = tradingModule.calculateOffsetPrice(entryPrice, data.takeProfit.points * 1.5, pointValue);

        await test.step('Change the Stop Loss and Take Profit', () =>
            tradingModule.updatePositionProtection(orderId, newStopLoss, newTakeProfit),
        );

        await test.step('Verify both prices and the unchanged volume', async () => {
            await expect.poll(() => tradingModule.getPositionStopLoss(orderId))
                .toBe(newStopLoss);
            await expect.poll(() => tradingModule.getPositionTakeProfit(orderId))
                .toBe(newTakeProfit);
            expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(data.volume.min);
        });
    });

    test('TC-26 closes a position partially @P0', async ({ tradingModule }) => {
        const orderId = await test.step('Create a position', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min * 2),
        );
        await tradingModule.expectPositionPresent(orderId);
        const originalVolume = Number(await tradingModule.getPositionVolume(orderId));
        expect(originalVolume).toBeGreaterThan(data.close.partialVolume);

        await test.step('Close part of that position', () =>
            tradingModule.closePositionPartially(orderId, data.close.partialVolume),
        );

        await test.step('Verify the remaining volume on the same position', async () => {
            await expect.poll(async () => Number(await tradingModule.getPositionVolume(orderId)))
                .toBeCloseTo(originalVolume - data.close.partialVolume, 8);
        });
    });

    test('TC-27 closes a position completely @P0', async ({ tradingModule }) => {
        const orderId = await test.step('Create a position', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );
        await test.step('Close that position and verify its removal', async () => {
            await tradingModule.closePosition(orderId);
            await tradingModule.expectPositionClosed(orderId);
        });
    });

    test('TC-28 shows a closed position in Positions History @P0', async ({ tradingModule, recordsModule }) => {
        const orderId = await test.step('Create and close a position', async () => {
            const id = await tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min);
            await tradingModule.closePosition(id);
            await tradingModule.expectPositionClosed(id);
            return id;
        });

        await test.step('Verify the transaction fields in Positions History', async () => {
            await recordsModule.expectPositionRecord(orderId);
            expect(await recordsModule.getPositionRecordSymbol(orderId)).toBe(data.symbol);
            expect(Number(await recordsModule.getPositionRecordVolume(orderId))).toBe(data.volume.min);
            expect(await recordsModule.getPositionRecordProfitLoss(orderId)).toMatch(/\d/);
        });
    });

    test('TC-29 blocks a close volume that exceeds the current position volume @P1', async ({ tradingModule, tradePage }) => {
        const orderId = await test.step('Create a position', () =>
            tradingModule.placeMarketOrder(data.symbol, 'BUY', data.volume.min),
        );

        await test.step('Verify that the dialog blocks or caps the excessive volume', async () => {
            await tradingModule.attemptToCloseExcessiveVolume(orderId, data.close.excessiveVolume);
            const { dialog } = tradePage;
            try {
                await expect.poll(async () => {
                    const volume = await dialog.getCloseVolume();
                    return await dialog.isCloseConfirmDisabled()
                        || (volume !== '' && Number(volume) <= data.volume.min);
                }).toBe(true);
            } finally {
                await dialog.cancelClosePosition();
            }
        });

        await test.step('Verify that the position keeps its original volume', async () => {
            expect(Number(await tradingModule.getPositionVolume(orderId))).toBe(data.volume.min);
        });
    });
});

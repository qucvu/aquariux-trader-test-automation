import type {
    ExpiryOption,
    FillPolicy,
    OrderType,
    ProtectionPrices,
    TradeTicket,
} from '@pages/components/trade-ticket';
import type { BulkDeleteGroup, OrdersPanel } from '@pages/components/orders-panel';
import type { Dialog } from '@pages/components/dialog';
import type { SymbolOrdersTab, TradePage } from '@pages/trade.page';
import { config } from '@core/config';
import { Logger } from '@core/logger';

export interface OrderRequest {
    symbol: string;
    orderType: OrderType;
    side: 'BUY' | 'SELL';
    volume: string | number;
    /** Entry price for pending orders. */
    price?: string | number;
    stopLimitPrice?: number;
    stopLossPrice?: string | number;
    stopLossPoints?: string | number;
    takeProfitPrice?: string | number;
    takeProfitPoints?: string | number;
    fillPolicy?: FillPolicy;
    expiry?: ExpiryOption;
    expiryDate?: Date;
    /** Expiry time in `HH:mm` format. */
    expiryTime?: string;
}

/**
 * `always` waits and confirms. `never` leaves confirmation to the caller.
 */
export type ConfirmBehaviour = 'always' | 'never';

interface PendingOrderSubmission {
    orderId: string;
    price: number;
}

const LIMIT_ORDER_TYPES = new Set([2, 3]); // Buy Limit and Sell Limit in the order list response.

export class TradingModule {
    private readonly logger: Logger;
    private readonly tradeTicket: TradeTicket;
    private readonly orders: OrdersPanel;
    private readonly dialog: Dialog;

    constructor(private readonly tradePage: TradePage) {
        this.logger = Logger.create('TradingModule');
        this.tradeTicket = tradePage.ticket;
        this.orders = tradePage.orders;
        this.dialog = tradePage.dialog;
    }

    // Market state
    async prepareTradeScreen(symbol: string): Promise<void> {
        this.logger.info('Open the trade screen');
        await this.tradePage.navigate();

        this.logger.info(`Select the symbol ${symbol}`);
        await this.tradePage.selectSymbol(symbol);
        await this.orders.openOpenPositions();
    }

    async isMarketOpen(): Promise<boolean> {
        const open = !(await this.tradeTicket.isMarketClosed());
        this.logger.info(`Market state: ${open ? 'open' : 'closed'}`);
        return open;
    }

    async getAskPrice(): Promise<number> {
        return this.tradeTicket.getLiveAskPrice();
    }

    async getBidPrice(): Promise<number> {
        return this.tradeTicket.getLiveBidPrice();
    }

    async getPointValue(): Promise<number> {
        return this.tradeTicket.getPointValue();
    }

    /** Rounds the result to the precision implied by the point value. */
    calculateOffsetPrice(
        price: number,
        points: number,
        pointValue: number,
    ): number {
        const decimals = this.getPriceDecimals(pointValue);
        return Number((price + points * pointValue).toFixed(decimals));
    }

    async getMinVolume(): Promise<number> {
        return this.tradeTicket.getMinVolume();
    }

    // Order placement

    async placeOrder(
        request: OrderRequest,
        options: { confirm?: ConfirmBehaviour } = {},
    ): Promise<string> {
        await this.fillOrder(request);
        await this.tradeTicket.expectProtectionPrices(request.stopLossPrice, request.takeProfitPrice);
        return this.placePreparedOrder(request, options.confirm);
    }

    async placeMarketOrderWithProtection(
        request: Pick<OrderRequest, 'symbol' | 'side' | 'volume' | 'stopLossPoints' | 'takeProfitPoints'>,
    ): Promise<ProtectionPrices & { orderId: string }> {
        const marketOrder: OrderRequest = { ...request, orderType: 'Market' };
        await this.fillOrder(marketOrder);
        const prices = await this.tradeTicket.readProtectionPricesForPoints(
            request.stopLossPoints,
            request.takeProfitPoints,
        );
        const orderId = await this.placePreparedOrder(marketOrder);
        return { orderId, ...prices };
    }

    private async placePreparedOrder(request: OrderRequest, confirm?: ConfirmBehaviour): Promise<string> {
        const oneClick = request.orderType === 'Market' && config.web.oneClickTradingEnabled;
        const responseWait = new AbortController();
        const submission = this.tradePage.waitForSubmittedOrderId(responseWait.signal, 15_000)
            .catch((error: unknown) => new Error('Could not verify the submitted order ID', { cause: error }));

        try {
            await this.submitOrder(confirm ?? (oneClick ? 'never' : 'always'));
            const orderId = await submission;
            if (orderId instanceof Error) {
                throw orderId;
            }
            if (orderId === null) {
                throw new Error(`The ${request.side} ${request.orderType} order did not return an ID`);
            }
            return orderId;
        } finally {
            responseWait.abort();
        }
    }

    async openOrderConfirmation(request: OrderRequest): Promise<void> {
        await this.fillOrder(request);
        await this.submitOrder('never');
    }

    async attemptInvalidOrder(request: OrderRequest): Promise<void> {
        await this.fillOrder(request);
        if (await this.tradeTicket.isOrderSubmitEnabled()) {
            await this.submitOrder('never');
        }
    }

    private async fillOrder(request: OrderRequest): Promise<void> {
        this.logger.info(`Select the symbol ${request.symbol}`);
        await this.tradePage.selectSymbol(request.symbol);

        this.logger.info(`Set the order type to ${request.orderType}`);
        await this.tradeTicket.selectOrderType(request.orderType);

        if (request.fillPolicy) {
            this.logger.info(`Set the fill policy to ${request.fillPolicy}`);
            await this.tradeTicket.selectFillPolicy(request.fillPolicy);
        }

        if (request.expiry) {
            this.logger.info(`Set the expiry to ${request.expiry}`);
            await this.tradeTicket.selectExpiry(request.expiry);
        }

        if (request.expiryDate) {
            this.logger.info(`Set the expiry date to ${request.expiryDate.toDateString()}`);
            await this.tradeTicket.pickExpiryDate(request.expiryDate);
        }

        if (request.expiryTime) {
            this.logger.info(`Set the expiry time to ${request.expiryTime}`);
            await this.tradeTicket.setExpiryTime(request.expiryTime);
        }

        this.logger.info(`Enter the volume ${request.volume}`);
        await this.tradeTicket.setVolume(request.volume);

        this.logger.info(`Select the ${request.side} side`);
        if (request.side === 'BUY') {
            await this.tradeTicket.clickBuy();
        } else {
            await this.tradeTicket.clickSell();
        }

        if (request.price !== undefined) {
            this.logger.info(`Enter the entry price ${request.price}`);
            await this.tradeTicket.setPrice(request.price);
        }

        if (request.stopLimitPrice !== undefined) {
            this.logger.info(`Enter the stop limit price ${request.stopLimitPrice}`);
            await this.tradeTicket.setStopLimitPrice(request.stopLimitPrice);
        }

        if (request.stopLossPrice !== undefined) {
            await this.tradeTicket.setStopLossPrice(request.stopLossPrice);
        }

        if (request.stopLossPoints !== undefined) {
            await this.tradeTicket.setStopLossPoints(request.stopLossPoints);
        }

        if (request.takeProfitPrice !== undefined) {
            await this.tradeTicket.setTakeProfitPrice(request.takeProfitPrice);
        }

        if (request.takeProfitPoints !== undefined) {
            await this.tradeTicket.setTakeProfitPoints(request.takeProfitPoints);
        }
    }

    private async submitOrder(confirm: ConfirmBehaviour): Promise<void> {
        this.logger.info('Click the place order button');
        await this.tradeTicket.clickPlaceOrder();

        if (confirm === 'always') {
            this.logger.info('Confirm the order in the dialog');
            await this.dialog.confirmOrder();
        }
    }

    private async submitOrderUpdate(target: 'position' | 'pending order'): Promise<void> {
        this.logger.info(`Submit the ${target} change`);
        await this.dialog.saveEdit();

        this.logger.info(`Confirm the ${target} change`);
        await this.tradePage.expectToastAfter(() => this.dialog.confirmOrder());
        await this.dialog.expectOrderConfirmationClosed();
    }

    async placeMarketOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        volume: string | number,
    ): Promise<string> {
        return this.placeOrder({
            symbol,
            orderType: 'Market',
            side,
            volume,
        });
    }

    async placePendingOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        volume: string | number,
        offsetPoints: number,
        orderType: OrderType = 'Limit',
        options: {
            fillPolicy?: FillPolicy;
            expiry?: ExpiryOption;
            expiryDate?: Date;
            expiryTime?: string;
        } = {},
    ): Promise<PendingOrderSubmission> {
        await this.tradePage.selectSymbol(symbol);
        const pointValue = await this.getPointValue();
        const reference = side === 'BUY' ? await this.getAskPrice() : await this.getBidPrice();
        const sideDirection = side === 'BUY' ? 1 : -1;
        const isStop = orderType === 'Stop' || orderType === 'Stop Limit';

        const price = this.calculateOffsetPrice(
            reference,
            offsetPoints * sideDirection * (isStop ? 1 : -1),
            pointValue,
        );
        const stopLimitPrice = orderType === 'Stop Limit'
            ? this.calculateOffsetPrice(price, -offsetPoints * sideDirection, pointValue)
            : undefined;

        const orderId = await this.placeOrder({
            symbol,
            orderType,
            side,
            volume,
            price,
            stopLimitPrice,
            ...options,
        });
        return { orderId, price };
    }

    async placePendingOrderWithExpiry(
        symbol: string,
        side: 'BUY' | 'SELL',
        volume: string | number,
        offsetPoints: number,
        expiry: ExpiryOption,
        orderType: OrderType = 'Limit',
    ): Promise<PendingOrderSubmission> {
        return this.placePendingOrder(
            symbol,
            side,
            volume,
            offsetPoints,
            orderType,
            { expiry },
        );
    }

    async placePendingOrderWithExpiryDate(
        symbol: string,
        side: 'BUY' | 'SELL',
        volume: string | number,
        offsetPoints: number,
        date: Date,
        orderType: OrderType = 'Limit',
    ): Promise<PendingOrderSubmission> {
        return this.placePendingOrder(
            symbol,
            side,
            volume,
            offsetPoints,
            orderType,
            { expiry: 'Specified Date', expiryDate: date },
        );
    }

    async placePendingOrderWithExpiryDateTime(
        symbol: string,
        side: 'BUY' | 'SELL',
        volume: string | number,
        offsetPoints: number,
        date: Date,
        time: string,
        orderType: OrderType = 'Limit',
    ): Promise<PendingOrderSubmission> {
        return this.placePendingOrder(
            symbol,
            side,
            volume,
            offsetPoints,
            orderType,
            { expiry: 'Specified Date and Time', expiryDate: date, expiryTime: time },
        );
    }

    async submitOrderWithoutConfirming(request: OrderRequest): Promise<void> {
        await this.openOrderConfirmation(request);

        await this.dialog.cancelOrderConfirmation();
    }

    // Open positions

    async openOpenPositions(selectedSymbolOnly = false): Promise<void> {
        this.logger.info('Open the Open Positions table');
        await this.orders.openOpenPositions(selectedSymbolOnly);
    }

    async openPendingOrders(selectedSymbolOnly = false): Promise<void> {
        this.logger.info('Open the Pending Orders table');
        await this.orders.openPendingOrders(selectedSymbolOnly);
    }

    async expectPositionPresent(orderId: string): Promise<void> {
        await this.orders.openOpenPositions();
        await this.orders.expectOrderIdPresent(orderId);
    }

    async expectPositionClosed(orderId: string): Promise<void> {
        await this.orders.openOpenPositions();
        await this.orders.expectOrderRemoved(orderId);
    }

    async expectPendingOrderPresent(orderId: string): Promise<void> {
        await this.orders.openPendingOrders();
        await this.orders.expectOrderIdPresent(orderId);
    }

    async expectPendingOrderRemoved(orderId: string): Promise<void> {
        await this.orders.openPendingOrders();
        await this.orders.expectOrderRemoved(orderId);
    }

    async closePosition(row: number | string): Promise<void> {
        this.logger.info('Open the Open Positions table');
        await this.orders.openOpenPositions();
        const volume = await this.orders.getVolume(row);

        this.logger.info('Open the close dialog of the position');
        await this.orders.clickClose(row);

        this.logger.info(`Confirm the close with the full position volume ${volume}`);
        await this.dialog.confirmClosePosition(volume.replaceAll(',', ''));
    }

    async getPositionVolume(rowReference: number | string): Promise<string> {
        await this.orders.openOpenPositions();
        return this.orders.getVolume(rowReference);
    }

    async getPositionProfitLoss(rowReference: number | string): Promise<string> {
        await this.orders.openOpenPositions();
        return this.orders.getProfitLoss(rowReference);
    }

    async getPositionSymbol(rowReference: number | string): Promise<string> {
        await this.orders.openOpenPositions();
        return this.orders.getSymbol(rowReference);
    }

    async getPositionEntryPrice(rowReference: number | string): Promise<string> {
        await this.orders.openOpenPositions();
        return this.orders.getEntryPrice(rowReference);
    }

    async getPositionStopLoss(rowReference: number | string): Promise<number | undefined> {
        await this.orders.openOpenPositions();
        return this.orders.getProtectionPrice(rowReference, 'stop-loss');
    }

    async getPositionTakeProfit(rowReference: number | string): Promise<number | undefined> {
        await this.orders.openOpenPositions();
        return this.orders.getProtectionPrice(rowReference, 'take-profit');
    }

    async updatePositionProtection(
        rowReference: number | string,
        stopLoss: string | number,
        takeProfit: string | number,
    ): Promise<void> {
        this.logger.info('Open the Open Positions table');
        await this.orders.openOpenPositions();

        this.logger.info('Open the edit dialog of the position');
        await this.orders.clickEdit(rowReference);

        this.logger.info(`Set the stop loss to ${stopLoss}`);
        await this.dialog.setEditStopLossPrice(stopLoss);

        this.logger.info(`Set the take profit to ${takeProfit}`);
        await this.dialog.setEditTakeProfitPrice(takeProfit);

        await this.submitOrderUpdate('position');
    }

    async closePositionPartially(
        rowReference: number | string,
        volume: string | number,
    ): Promise<void> {
        this.logger.info('Open the Open Positions table');
        await this.orders.openOpenPositions();

        this.logger.info('Open the close dialog of the position');
        await this.orders.clickClose(rowReference);

        this.logger.info(`Confirm the close with volume ${volume}`);
        await this.dialog.confirmClosePosition(volume);
    }

    async attemptToCloseExcessiveVolume(
        rowReference: number | string,
        volume: string | number,
    ): Promise<void> {
        this.logger.info('Open the Open Positions table');
        await this.orders.openOpenPositions();

        this.logger.info('Open the close dialog of the position');
        await this.orders.clickClose(rowReference);

        this.logger.info(`Enter the excessive close volume ${volume}`);
        try {
            await this.dialog.setCloseVolume(volume);
        } catch (error) {
            await this.dialog.cancelClosePosition();
            throw error;
        }
    }

    // Pending orders

    async deletePendingOrder(row: number | string): Promise<void> {
        this.logger.info('Open the Pending Orders table');
        await this.orders.openPendingOrders();

        this.logger.info('Open the delete dialog of the order');
        await this.orders.clickDelete(row);

        this.logger.info('Confirm the deletion');
        await this.tradePage.expectToastAfter(() => this.dialog.confirmDeleteOrder());
        this.logger.info('Reload the trade screen to read the updated pending orders');
        await this.tradePage.navigate();
    }

    async getPendingOrderVolume(rowReference: number | string): Promise<number> {
        await this.orders.openPendingOrders();
        const [requested] = (await this.orders.getVolume(rowReference)).split('/');
        return Number(requested.replaceAll(',', '').trim());
    }

    async getPendingOrderExpiry(rowReference: number | string): Promise<string> {
        await this.orders.openPendingOrders();
        return this.orders.getCellValue(rowReference, 'expiry');
    }

    async getPendingOrderExpiryDate(rowReference: number | string): Promise<string> {
        await this.orders.openPendingOrders();
        return this.orders.getCellValue(rowReference, 'expiry-date');
    }

    async updatePendingOrder(
        rowReference: number | string,
        changes: { volume?: string | number; price?: string | number },
    ): Promise<void> {
        this.logger.info('Open the Pending Orders table');
        await this.orders.openPendingOrders();

        this.logger.info('Open the edit dialog of the order');
        await this.orders.clickEdit(rowReference);

        if (changes.volume !== undefined) {
            this.logger.info(`Set the volume to ${changes.volume}`);
            await this.dialog.setEditVolume(changes.volume);
        }

        if (changes.price !== undefined) {
            this.logger.info(`Set the entry price to ${changes.price}`);
            await this.dialog.setEditPrice(changes.price);
        }

        await this.submitOrderUpdate('pending order');
    }

    async getPendingOrderSymbol(rowReference: number | string): Promise<string> {
        await this.orders.openPendingOrders();
        return this.orders.getSymbol(rowReference);
    }

    async getPendingOrderType(rowReference: number | string): Promise<string> {
        await this.orders.openPendingOrders();
        return this.orders.getOrderType(rowReference);
    }

    async getPendingOrderEntryPrice(orderId: string): Promise<string> {
        await this.orders.openPendingOrders();
        return this.orders.getEntryPrice(orderId);
    }

    async prepareBulkSymbol(
        symbols: readonly string[],
        tab: SymbolOrdersTab,
        group: BulkDeleteGroup = 'all',
    ): Promise<string> {
        this.logger.info(`Find an open symbol with no existing orders in ${tab} for ${group}`);
        await this.tradePage.navigate();
        await this.orders.openTab(tab, true);

        const selected = await this.tradePage.getSelectedSymbol();
        const candidates = [...symbols.filter(symbol => symbol !== selected), ...symbols.filter(symbol => symbol === selected)];
        for (const symbol of candidates) {
            const orders = await this.tradePage.selectSymbolAndLoadOrders(symbol, tab);
            const hasExistingOrders = group === 'limit'
                ? orders.some(order => LIMIT_ORDER_TYPES.has(order.orderType))
                : orders.length > 0;
            if (!hasExistingOrders && await this.isMarketOpen()) {
                this.logger.info(`Use ${symbol} for the bulk action`);
                return symbol;
            }
        }
        throw new Error(`No open symbol has an empty ${tab} scope for ${group}: ${symbols.join(', ')}`);
    }

    async expectBulkOrderIds(orderIds: readonly string[], group: BulkDeleteGroup = 'all'): Promise<void> {
        await this.orders.expectBulkOrderIds(orderIds, group);
    }

    async bulkClosePositions(): Promise<void> {
        this.logger.info('Click the bulk close button');
        await this.orders.clickBulkClose();
    }

    async bulkDeletePendingOrders(group: BulkDeleteGroup = 'all'): Promise<void> {
        this.logger.info(`Open bulk deletion for ${group === 'all' ? 'all orders' : 'limit orders'}`);
        await this.orders.clickBulkDelete(group);
    }

    async confirmBulkAction(): Promise<void> {
        this.logger.info('Confirm the bulk action');
        await this.dialog.confirmBulkAction();
    }

    async cancelBulkAction(): Promise<void> {
        this.logger.info('Cancel the bulk action');
        await this.dialog.cancelBulkAction();
    }

    async expectBulkConfirmationVisible(): Promise<void> {
        await this.dialog.expectBulkConfirmationVisible();
    }

    /** Falls back to five decimals when the point value is invalid. */
    private getPriceDecimals(pointValue: number): number {
        if (!Number.isFinite(pointValue) || pointValue <= 0) {
            return 5;
        }

        const text = String(pointValue);
        const dotIndex = text.indexOf('.');

        return dotIndex < 0 ? 0 : text.length - dotIndex - 1;
    }
}

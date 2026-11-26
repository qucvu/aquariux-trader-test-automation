import { expect } from '@playwright/test';

import type { Dialog, OrderDetails } from '@pages/components/dialog';
import type { NotificationItem, NotificationPanel } from '@pages/components/notification-panel';
import type { OrdersPanel } from '@pages/components/orders-panel';
import { Logger } from '@core/logger';
import { toDisplayDate } from '@utils/dates';

interface OrderRecord {
    orderId: string;
    symbol: string;
    volume: string;
    requestedVolume: number;
    filledVolume: number;
    state: string;
}

export class RecordsModule {
    private readonly logger: Logger;

    constructor(
        private readonly orders: OrdersPanel,
        private readonly notifications: NotificationPanel,
        private readonly dialog: Dialog,
    ) {
        this.logger = Logger.create('RecordsModule');
    }

    async openOrdersAndDeals(): Promise<void> {
        this.logger.info('Open the Orders & Deals table');
        await this.orders.openOrdersAndDeals();
    }

    async getOrderRecord(orderId: string, expectedState?: RegExp): Promise<OrderRecord> {
        await this.openOrdersAndDeals();
        await this.orders.expectOrderIdPresent(orderId);
        if (expectedState) {
            await expect.poll(async () => {
                const { state, requestedVolume, filledVolume } = await this.readOrderRecord(orderId);
                return expectedState.test(state)
                    && Number.isFinite(requestedVolume)
                    && Number.isFinite(filledVolume);
            }, { message: `Wait for the expected state and volume of order ${orderId}` }).toBe(true);
        }
        return this.readOrderRecord(orderId);
    }

    private async readOrderRecord(row: number | string): Promise<OrderRecord> {
        const [orderId, symbol, volume, state] = await Promise.all([
            this.orders.getOrderId(row),
            this.orders.getSymbol(row),
            this.orders.getVolume(row),
            this.orders.getState(row),
        ]);
        return { orderId, symbol, volume, state, ...this.parseOrderVolumes(volume) };
    }

    private parseOrderVolumes(volume: string): Pick<OrderRecord, 'requestedVolume' | 'filledVolume'> {
        const [requested = '', filled = ''] = volume.replaceAll(',', '').split('/').map(part => part.trim());
        return {
            requestedVolume: requested === '' ? Number.NaN : Number(requested),
            filledVolume: filled === '' ? Number.NaN : Number(filled),
        };
    }

    async hasOrderRecord(orderId: string): Promise<boolean> {
        await this.orders.openOrdersAndDeals();
        return this.orders.hasOrderId(orderId);
    }

    async expectPositionRecord(orderId: string): Promise<void> {
        await this.orders.openPositionsHistory();
        await this.orders.expectOrderIdPresent(orderId);
    }

    async getPositionRecordSymbol(orderId: string): Promise<string> {
        await this.orders.openPositionsHistory();
        const index = await this.orders.findRowIndexByOrderId(orderId);

        return index < 0 ? '' : this.orders.getSymbol(index);
    }

    async getPositionRecordProfitLoss(orderId: string): Promise<string> {
        await this.orders.openPositionsHistory();
        const index = await this.orders.findRowIndexByOrderId(orderId);

        return index < 0 ? '' : this.orders.getProfitLoss(index);
    }

    async filterByDateRange(from: Date, to: Date): Promise<void> {
        await this.openOrdersAndDeals();
        this.logger.info(`Filter the history from ${toDisplayDate(from)} to ${toDisplayDate(to)}`);
        await this.orders.filterByDateRange(from, to);
    }

    async getPositionRecordVolume(orderId: string): Promise<string> {
        await this.orders.openPositionsHistory();
        const index = await this.orders.findRowIndexByOrderId(orderId);

        return index < 0 ? '' : this.orders.getVolume(index);
    }

    async getPositionRecordCloseDate(orderId: string): Promise<string> {
        await this.orders.openPositionsHistory();
        return this.orders.getCellValue(orderId, 'close-date');
    }

    async getOrderRecordState(orderId: string): Promise<string> {
        await this.orders.openOrdersAndDeals();
        return await this.orders.hasOrderId(orderId) ? this.orders.getState(orderId) : '';
    }

    async getNotifications(): Promise<NotificationItem[]> {
        return this.notifications.getNotifications();
    }

    async refreshOrderNotifications(): Promise<void> {
        await this.notifications.refreshOrderNotifications();
    }

    async getOrderDetails(rowReference: number | string = 0): Promise<OrderDetails> {
        this.logger.info('Open the edit dialog of the order');
        await this.orders.openPendingOrderEdit(rowReference);

        this.logger.info('Read the fields of the dialog');
        try {
            return await this.dialog.getOrderDetails();
        } finally {
            await this.dialog.cancelEdit();
        }
    }
}

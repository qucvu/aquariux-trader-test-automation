import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from '@core/base-page';
import { toDisplayDate } from '@utils/dates';

import type { Dialog } from './dialog';

export type AssetTab =
    | 'open-positions'
    | 'pending-orders'
    | 'positions-history'
    | 'orders-and-deals';

export type BulkDeleteGroup = 'all' | 'limit';

export class OrdersPanel extends BasePage {
    // Tracks the last tab confirmed as selected.
    private activeTab: AssetTab = 'open-positions';

    private readonly openPositionsTab: Locator;
    private readonly pendingOrdersTab: Locator;
    private readonly positionsHistoryTab: Locator;
    private readonly ordersAndDealsTab: Locator;

    private readonly openPositionRows: Locator;
    private readonly pendingOrderRows: Locator;
    private readonly historyRows: Locator;

    private readonly datePickerButton: Locator;
    private readonly customDateRange: Locator;
    private readonly calendarMonth: Locator;
    private readonly previousCalendarMonth: Locator;
    private readonly nextCalendarMonth: Locator;
    private readonly applyDateRangeButton: Locator;

    private readonly bulkCloseButton: Locator;
    private readonly bulkCloseAllOption: Locator;
    private readonly bulkDeleteButton: Locator;
    private readonly bulkDeleteOptions: Record<BulkDeleteGroup, Locator>;
    private readonly hideOtherSymbolsButton: Locator;
    private readonly hideOtherSymbolsChecked: Locator;

    constructor(page: Page, private readonly dialog: Dialog) {
        super(page);

        this.openPositionsTab = page.getByTestId('tab-asset-order-type-open-positions');
        this.pendingOrdersTab = page.getByTestId('tab-asset-order-type-pending-orders');
        this.positionsHistoryTab = page.getByTestId(
            'tab-asset-order-type-history-positions-history',
        );
        this.ordersAndDealsTab = page.getByTestId(
            'tab-asset-order-type-history-orders-and-deals',
        );

        this.openPositionRows = page.getByTestId('asset-open-list-item');
        this.pendingOrderRows = page.getByTestId('asset-pending-list-item');
        this.historyRows = page.getByTestId('asset-history-position-list-item');

        this.datePickerButton = page.getByRole('button').filter({
            has: page.getByTestId('orders-date-picker-icon-calendar'),
        });
        this.customDateRange = page.getByText('Custom', { exact: true });
        this.calendarMonth = page.getByRole('button', { name: /^[A-Za-z]+ \d{4}$/ });
        this.previousCalendarMonth = page.getByRole('button', { name: '‹', exact: true });
        this.nextCalendarMonth = page.getByRole('button', { name: '›', exact: true });
        this.applyDateRangeButton = page.getByTestId('orders-date-picker-button-apply')

        this.bulkCloseButton = page.getByTestId('bulk-close');
        this.bulkCloseAllOption = page.getByText('All Positions', { exact: true });
        this.bulkDeleteButton = page.getByTestId('bulk-delete');
        this.bulkDeleteOptions = {
            all: page.getByText('All Orders', { exact: true }),
            limit: page.getByText('Limit Orders', { exact: true }),
        };
        this.hideOtherSymbolsButton = page.getByText('Hide Other Symbols', { exact: true });
        this.hideOtherSymbolsChecked = page.getByTestId('hide-other-symbols-button-checked');
    }

    async openTab(tab: AssetTab, selectedSymbolOnly = false): Promise<void> {
        const locator = this.tabLocator(tab);
        await locator.click();
        await expect(locator).toContainClass('selected');
        this.activeTab = tab;
        await this.setHideOtherSymbols(selectedSymbolOnly);
    }

    async openOpenPositions(selectedSymbolOnly = false): Promise<void> {
        await this.openTab('open-positions', selectedSymbolOnly);
    }

    async openPendingOrders(selectedSymbolOnly = false): Promise<void> {
        await this.openTab('pending-orders', selectedSymbolOnly);
    }

    async openPositionsHistory(): Promise<void> {
        await this.openTab('positions-history');
    }

    async openOrdersAndDeals(): Promise<void> {
        await this.openTab('orders-and-deals');
    }

    async openDatePicker(): Promise<void> {
        await this.datePickerButton.click();
    }

    async applyFilter(): Promise<void> {
        await this.applyDateRangeButton.click();
        await expect(this.applyDateRangeButton).toBeHidden();
    }

    async setDateRange(from: Date, to: Date): Promise<void> {
        await this.openDatePicker();
        await this.customDateRange.click();
        await this.pickCalendarDate(from);
        await this.pickCalendarDate(to);
    }

    async filterByDateRange(from: Date, to: Date): Promise<void> {
        await this.setDateRange(from, to);
        await this.applyFilter();
        await expect(this.datePickerButton).toHaveText(`${toDisplayDate(from)} - ${toDisplayDate(to)}`);
    }

    private async pickCalendarDate(date: Date): Promise<void> {
        const currentMonth = new Date(`1 ${await this.calendarMonth.innerText()}`);
        const monthsAway = (date.getFullYear() - currentMonth.getFullYear()) * 12
            + date.getMonth() - currentMonth.getMonth();
        const arrow = monthsAway < 0 ? this.previousCalendarMonth : this.nextCalendarMonth;
        for (let index = 0; index < Math.abs(monthsAway); index += 1) {
            await arrow.click();
        }

        const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        await this.page.getByRole('button', { name: label, exact: true }).click();
    }

    async clickEdit(rowReference: number | string): Promise<void> {
        const row = this.orderRow(rowReference);
        await row
            .getByTestId('asset-open-button-edit')
            .or(row.getByRole('button', { name: /edit/i }))
            .first()
            .click();
        await this.dialog.expectEditReady();
    }

    async clickClose(rowReference: number | string): Promise<void> {
        const row = this.orderRow(rowReference);
        await row
            .getByTestId('asset-open-button-close')
            .or(row.getByRole('button', { name: /close/i }))
            .first()
            .click();
        await this.dialog.expectClosePositionReady();
    }

    // Pending rows can use the same test ID for Delete as positions use for Close.
    async clickDelete(rowReference: number | string): Promise<void> {
        const row = this.orderRow(rowReference);
        await row
            .getByTestId('asset-open-button-close')
            .or(row.getByTestId('asset-pending-button-delete'))
            .or(row.getByRole('button', { name: /delete/i }))
            .first()
            .click();
    }

    async clickBulkClose(): Promise<void> {
        await expect(this.bulkCloseButton).toHaveCSS('cursor', 'pointer');
        await this.bulkCloseButton.click();
        await this.bulkCloseAllOption.click();
    }

    async clickBulkDelete(group: BulkDeleteGroup): Promise<void> {
        await expect(this.bulkDeleteButton).toHaveCSS('cursor', 'pointer');
        await this.bulkDeleteButton.click();
        await this.bulkDeleteOptions[group].click();
    }

    private async setHideOtherSymbols(hide: boolean): Promise<void> {
        await this.expectVisible(this.hideOtherSymbolsButton);
        if (await this.hideOtherSymbolsChecked.isVisible() !== hide) {
            await this.hideOtherSymbolsButton.click();
        }
        await expect(this.hideOtherSymbolsChecked).toBeVisible({ visible: hide });
    }

    async getBulkOrderIds(group: BulkDeleteGroup = 'all'): Promise<string[]> {
        const rows = group === 'limit'
            ? this.currentRows().filter({
                has: this.page.locator('[data-testid$="-column-order-type"]')
                    .filter({ hasText: /^(?:BUY|SELL) LIMIT$/i }),
            })
            : this.currentRows();
        const ids = await rows.locator('[data-testid$="-column-order-id"]').allTextContents();
        return ids.map(id => id.trim()).sort();
    }

    async expectBulkOrderIds(orderIds: readonly string[], group: BulkDeleteGroup = 'all'): Promise<void> {
        await this.expectVisible(this.hideOtherSymbolsChecked);
        await expect.poll(() => this.getBulkOrderIds(group), {
            message: 'Verify that the bulk action targets only the orders created by this test',
        }).toEqual([...orderIds].sort());
    }

    async getRowCount(): Promise<number> {
        return this.currentRows().count();
    }

    async getCellValue(rowReference: number | string, column: string): Promise<string> {
        const row = this.orderRow(rowReference);
        const cell = row.locator(`[data-testid$="-column-${column}"]`).first();
        return this.safeText(cell);
    }

    async getOrderId(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'order-id');
    }

    async getSymbol(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'symbol');
    }

    async getOrderType(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'order-type');
    }

    async getVolume(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'volume');
    }

    async getState(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'state');
    }

    async getEntryPrice(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'entry-price');
    }

    async getProtectionPrice(
        rowReference: number | string,
        column: 'stop-loss' | 'take-profit',
    ): Promise<number | undefined> {
        const text = await this.getCellValue(rowReference, column);
        return text === '--' ? undefined : Number(text.replaceAll(',', ''));
    }

    async getProfitLoss(rowReference: number | string): Promise<string> {
        return this.getCellValue(rowReference, 'profit');
    }

    async findRowIndexByOrderId(orderId: string): Promise<number> {
        const count = await this.getRowCount();
        for (let index = 0; index < count; index += 1) {
            if ((await this.getOrderId(index)) === orderId) {
                return index;
            }
        }
        return -1;
    }

    async openPendingOrderEdit(rowReference: number | string): Promise<void> {
        await this.openPendingOrders();
        await this.clickEdit(rowReference);
    }

    async expectOrderIdPresent(orderId: string): Promise<void> {
        await this.expectVisible(this.orderRow(orderId).first());
    }

    async hasOrderId(orderId: string): Promise<boolean> {
        return this.orderRow(orderId).first().isVisible();
    }

    async expectOrderRemoved(orderId: string): Promise<void> {
        await expect(this.orderRow(orderId)).toHaveCount(0);
    }

    private orderRow(rowReference: number | string): Locator {
        const rows = this.currentRows();
        if (typeof rowReference === 'number') {
            return rows.nth(rowReference);
        }

        const escapedId = rowReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const orderIdCell = this.page.locator('[data-testid$="-column-order-id"]').filter({
            hasText: new RegExp(`^\\s*${escapedId}\\s*$`),
        });
        return rows.filter({ has: orderIdCell });
    }

    private tabLocator(tab: AssetTab): Locator {
        switch (tab) {
            case 'open-positions':
                return this.openPositionsTab;
            case 'pending-orders':
                return this.pendingOrdersTab;
            case 'positions-history':
                return this.positionsHistoryTab;
            case 'orders-and-deals':
                return this.ordersAndDealsTab;
        }
    }

    private currentRows(): Locator {
        switch (this.activeTab) {
            case 'pending-orders':
                return this.pendingOrderRows;
            case 'positions-history':
            case 'orders-and-deals':
                return this.historyRows;
            case 'open-positions':
            default:
                return this.openPositionRows;
        }
    }
}

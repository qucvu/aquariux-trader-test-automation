import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from '@core/base-page';

export type OrderDetails = {
    'order-id': string;
    symbol: string;
    'order-type': string;
    volume: string;
    price: string;
    units: string;
    'fill-policy': string;
    expiry: string;
};

export class Dialog extends BasePage {
    private readonly orderConfirmationSymbol: Locator;
    private readonly orderConfirmationType: Locator;
    private readonly orderConfirmButton: Locator;
    private readonly orderConfirmationCancelButton: Locator;

    private readonly editDialog: Locator;
    private readonly editVolumeInput: Locator;
    private readonly editPriceInput: Locator;
    private readonly editStopLossInput: Locator;
    private readonly editTakeProfitInput: Locator;
    private readonly editExpiryValue: Locator;
    private readonly editSubmitButton: Locator;
    private readonly editCancelButton: Locator;

    private readonly closeVolumeInput: Locator;
    private readonly closeConfirmButton: Locator;
    private readonly closeCancelButton: Locator;
    private readonly deleteConfirmButton: Locator;
    private readonly bulkDialog: Locator;
    private readonly bulkConfirmButton: Locator;
    private readonly bulkCancelButton: Locator;

    constructor(page: Page) {
        super(page);

        const dialogs = page.getByRole('dialog');
        const orderConfirmation = dialogs.filter({ has: page.getByTestId('trade-confirmation-button-confirm') });
        this.orderConfirmationSymbol = orderConfirmation.getByTestId('trade-confirmation-symbol');
        this.orderConfirmationType = orderConfirmation.getByTestId('trade-confirmation-order-type');
        this.orderConfirmButton = orderConfirmation.getByTestId('trade-confirmation-button-confirm');
        this.orderConfirmationCancelButton = orderConfirmation.getByTestId('trade-confirmation-button-close');

        this.editDialog = dialogs.filter({ has: page.getByTestId('edit-button-order') });
        this.editVolumeInput = this.editDialog.getByTestId('edit-input-volume')
            .or(this.editDialog.locator('input[name="volume"]'))
            .or(this.editDialog.locator('input[name="lotSize"]'));
        this.editPriceInput = this.editDialog.getByTestId('edit-input-price')
            .or(this.editDialog.locator('input[name="price"]'));
        this.editStopLossInput = this.editDialog.getByTestId('edit-input-stoploss-price')
            .or(this.editDialog.locator('input[name="stopLoss"]'))
            .or(this.editDialog.locator('input[name="slPrice"]'));
        this.editTakeProfitInput = this.editDialog.getByTestId('edit-input-takeprofit-price')
            .or(this.editDialog.locator('input[name="takeProfit"]'))
            .or(this.editDialog.locator('input[name="tpPrice"]'));
        this.editExpiryValue = this.editDialog.getByTestId('edit-dropdown-expiry').locator('[tabindex="0"]').first();
        this.editSubmitButton = this.editDialog.getByTestId('edit-button-order');
        this.editCancelButton = this.editDialog.getByTestId('edit-button-cancel');

        const closeDialog = page.getByRole('dialog', { name: 'Confirm To Close Position', exact: true });
        this.closeVolumeInput = closeDialog.getByRole('textbox', { name: /^Min:/i });
        this.closeConfirmButton = closeDialog.getByRole('button', { name: /^confirm$/i });
        this.closeCancelButton = closeDialog.getByRole('button', { name: /^cancel$/i });

        const deleteDialog = page.getByRole('dialog', { name: /^confirm to delete order$/i });
        this.deleteConfirmButton = deleteDialog.getByRole('button', { name: /^confirm$/i });

        this.bulkDialog = dialogs.filter({ hasText: /Would you like to (?:close|delete) all/i });
        this.bulkConfirmButton = this.bulkDialog.getByRole('button', { name: /^confirm$/i });
        this.bulkCancelButton = this.bulkDialog.getByRole('button', { name: /^cancel$/i });
    }

    async expectOrderConfirmationOpen(): Promise<void> {
        await this.expectVisible(this.orderConfirmationSymbol);
        await this.expectVisible(this.orderConfirmationType);
        await this.expectVisible(this.orderConfirmButton);
    }

    async expectOrderConfirmationClosed(): Promise<void> {
        await expect(this.orderConfirmButton).toBeHidden();
    }

    async confirmOrder(): Promise<void> {
        await this.orderConfirmButton.click();
    }

    async cancelOrderConfirmation(): Promise<void> {
        await this.orderConfirmationCancelButton.click();
    }

    async expectEditReady(): Promise<void> {
        await this.expectVisible(this.editSubmitButton);
    }

    async setEditVolume(volume: string | number): Promise<void> {
        await this.editVolumeInput.first().fill(String(volume));
    }

    async setEditPrice(price: string | number): Promise<void> {
        const input = this.editPriceInput.first();
        await input.fill(String(price));
        await input.blur();
        await expect.poll(async () => Number((await input.inputValue()).replaceAll(',', '')), {
            message: 'Verify the edit dialog kept the new pending order price',
        }).toBe(Number(String(price).replaceAll(',', '')));
    }

    async setEditStopLossPrice(price: string | number): Promise<void> {
        await this.editStopLossInput.first().fill(String(price));
    }

    async setEditTakeProfitPrice(price: string | number): Promise<void> {
        await this.editTakeProfitInput.first().fill(String(price));
    }

    async saveEdit(): Promise<void> {
        await this.editSubmitButton.click();
    }

    async cancelEdit(): Promise<void> {
        await this.editCancelButton.click();
        await expect(this.editDialog).toBeHidden();
    }

    async getOrderDetails(): Promise<OrderDetails> {
        return {
            'order-id': await this.getEditValue('order-id'),
            symbol: await this.getEditValue('symbol'),
            'order-type': await this.getEditValue('order-type'),
            volume: await this.getEditValue('volume'),
            price: await this.editPriceInput.first().inputValue(),
            units: await this.getEditValue('units'),
            'fill-policy': await this.getEditValue('fill-policy'),
            expiry: await this.safeText(this.editExpiryValue),
        };
    }

    private async getEditValue(field: Exclude<keyof OrderDetails, 'expiry' | 'price'>): Promise<string> {
        return this.safeText(this.editDialog.getByTestId(`edit-${field}-value`));
    }

    async expectClosePositionReady(): Promise<void> {
        await this.expectVisible(this.closeVolumeInput);
    }

    async getCloseVolume(): Promise<string> {
        return this.closeVolumeInput.inputValue();
    }

    async setCloseVolume(volume: string | number): Promise<void> {
        await this.closeVolumeInput.fill(String(volume));
    }

    async confirmClosePosition(volume: string | number): Promise<void> {
        const requestedVolume = Number(volume);
        await this.setCloseVolume(volume);
        await expect.poll(async () => {
            const currentVolume = await this.getCloseVolume();
            if (currentVolume === '' || Number(currentVolume.replaceAll(',', '')) !== requestedVolume) {
                await this.setCloseVolume(volume);
                return false;
            }
            return this.closeConfirmButton.isEnabled();
        }, { message: `Verify the close dialog accepts volume ${volume}` }).toBe(true);
        await this.closeConfirmButton.click();
    }

    async isCloseConfirmDisabled(): Promise<boolean> {
        return this.closeConfirmButton.isDisabled();
    }

    async cancelClosePosition(): Promise<void> {
        await this.closeCancelButton.click();
        await expect(this.closeCancelButton).toBeHidden();
    }

    async confirmDeleteOrder(): Promise<void> {
        await this.deleteConfirmButton.click();
    }

    async expectBulkConfirmationVisible(): Promise<void> {
        await this.expectVisible(this.bulkDialog);
    }

    async confirmBulkAction(): Promise<void> {
        await this.bulkConfirmButton.click();
        await expect(this.bulkDialog).toBeHidden();
    }

    async cancelBulkAction(): Promise<void> {
        await this.bulkCancelButton.click();
        await expect(this.bulkDialog).toBeHidden();
    }
}

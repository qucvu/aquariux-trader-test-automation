import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from '@core/base-page';

export type OrderType = 'Market' | 'Limit' | 'Stop' | 'Stop Limit';

export type FillPolicy = 'Return' | 'Fill or Kill' | 'Return';

export type ExpiryOption =
    | 'Good Till Canceled'
    | 'Good Till Day'
    | 'Specified Date and Time'
    | 'Specified Date';

export interface ProtectionPrices {
    stopLoss: number | undefined;
    takeProfit: number | undefined;
}

export class TradeTicket extends BasePage {
    private readonly orderTypeDropdown: Locator;
    private readonly fillPolicyDropdown: Locator;
    private readonly expiryDropdown: Locator;

    private readonly priceInput: Locator;
    private readonly stopLimitPriceInput: Locator;
    private readonly volumeInput: Locator;
    private readonly stopLossPriceInput: Locator;
    private readonly stopLossPointsInput: Locator;
    private readonly takeProfitPriceInput: Locator;
    private readonly takeProfitPointsInput: Locator;

    private readonly buyButton: Locator;
    private readonly sellButton: Locator;
    private readonly liveBuyPrice: Locator;
    private readonly liveSellPrice: Locator;
    private readonly placeOrderButton: Locator;

    private readonly onePointLabel: Locator;

    private readonly expiryDateControl: Locator;
    private readonly expiryCalendarMonth: Locator;
    private readonly expiryPreviousMonth: Locator;
    private readonly expiryNextMonth: Locator;
    private readonly expiryTimeControl: Locator;
    private readonly expiryHourDropdown: Locator;
    private readonly expiryMinuteDropdown: Locator;
    private readonly expiryTimeConfirm: Locator;

    private readonly validationMessage: Locator;

    constructor(page: Page) {
        super(page);

        this.orderTypeDropdown = page.getByTestId('trade-dropdown-order-type');
        this.fillPolicyDropdown = page.getByTestId('trade-dropdown-fill-policy');
        this.expiryDropdown = page.getByTestId('trade-dropdown-expiry');

        this.priceInput = page.locator('input[name="price"]');
        this.stopLimitPriceInput = page.locator('input[name="priceTrigger"]');
        this.volumeInput = page.getByTestId('trade-input-volume');
        this.stopLossPriceInput = page.getByTestId('trade-input-stoploss-price');
        this.stopLossPointsInput = page.getByTestId('trade-input-stoploss-points');
        this.takeProfitPriceInput = page.getByTestId('trade-input-takeprofit-price');
        this.takeProfitPointsInput = page.getByTestId('trade-input-takeprofit-points');

        this.buyButton = page.getByTestId('trade-button-order-buy');
        this.sellButton = page.getByTestId('trade-button-order-sell');
        this.liveBuyPrice = page.getByTestId('trade-live-buy-price');
        this.liveSellPrice = page.getByTestId('trade-live-sell-price');
        this.placeOrderButton = page.getByTestId('trade-button-order');

        this.onePointLabel = page.getByTestId('trade-one-point-equal-label');

        this.expiryDateControl = page.getByTestId('trade-input-expiry-date');
        this.expiryCalendarMonth = page.getByRole('button', { name: /^[A-Za-z]+ \d{4}$/ });
        this.expiryPreviousMonth = page.getByRole('button', { name: '‹', exact: true });
        this.expiryNextMonth = page.getByRole('button', { name: '›', exact: true });
        this.expiryTimeControl = page.getByTestId('trade-input-expiry-time');
        this.expiryHourDropdown = page.locator('div:has(> :text-is("Hour"))');
        this.expiryMinuteDropdown = page.locator('div:has(> :text-is("Minute"))');
        this.expiryTimeConfirm = page.getByRole('button', { name: 'OK', exact: true });

        this.validationMessage = page
            .locator('[class*="error"], [class*="invalid"], [role="alert"]')
            .filter({ hasText: /.+/ });
    }

    async selectOrderType(orderType: OrderType): Promise<void> {
        await this.openDropdown(this.orderTypeDropdown);
        await this.pickDropdownOption(this.orderTypeDropdown, orderType);
    }

    async selectFillPolicy(policy: FillPolicy): Promise<void> {
        await this.openDropdown(this.fillPolicyDropdown);
        await this.pickDropdownOption(this.fillPolicyDropdown, policy);
    }

    async selectExpiry(expiry: ExpiryOption): Promise<void> {
        await this.openDropdown(this.expiryDropdown);
        await this.pickDropdownOption(this.expiryDropdown, expiry);
    }

    async setPrice(price: string | number): Promise<void> {
        await this.fillPrice(this.priceInput, price);
    }

    async setStopLimitPrice(price: number): Promise<void> {
        await this.fillPrice(this.stopLimitPriceInput, price);
    }

    async setVolume(volume: string | number): Promise<void> {
        await this.volumeInput.fill(String(volume));
    }

    async setStopLossPrice(price: string | number): Promise<void> {
        await this.stopLossPriceInput.fill(String(price));
        await this.stopLossPriceInput.blur();
    }

    async setStopLossPoints(points: string | number): Promise<void> {
        await this.stopLossPointsInput.fill(String(points));
        await this.stopLossPointsInput.blur();
    }

    async setTakeProfitPrice(price: string | number): Promise<void> {
        await this.takeProfitPriceInput.fill(String(price));
        await this.takeProfitPriceInput.blur();
    }

    async setTakeProfitPoints(points: string | number): Promise<void> {
        await this.takeProfitPointsInput.fill(String(points));
        await this.takeProfitPointsInput.blur();
    }

    async readProtectionPricesForPoints(
        stopLossPoints?: string | number,
        takeProfitPoints?: string | number,
    ): Promise<ProtectionPrices> {
        await expect.poll(async () => ({
            stopLoss: await this.readOptionalInputNumber(this.stopLossPointsInput),
            takeProfit: await this.readOptionalInputNumber(this.takeProfitPointsInput),
        }), { message: 'Protection points on the trade ticket' }).toEqual({
            stopLoss: stopLossPoints === undefined ? undefined : Number(stopLossPoints),
            takeProfit: takeProfitPoints === undefined ? undefined : Number(takeProfitPoints),
        });

        const [stopLoss, takeProfit] = await Promise.all([
            this.readOptionalInputNumber(this.stopLossPriceInput),
            this.readOptionalInputNumber(this.takeProfitPriceInput),
        ]);
        if (stopLossPoints === undefined) {
            expect(stopLoss, 'Stop Loss price on the trade ticket').toBeUndefined();
        } else {
            expect(Number(stopLoss), 'Stop Loss price on the trade ticket').toBeGreaterThan(0);
        }
        if (takeProfitPoints === undefined) {
            expect(takeProfit, 'Take Profit price on the trade ticket').toBeUndefined();
        } else {
            expect(Number(takeProfit), 'Take Profit price on the trade ticket').toBeGreaterThan(0);
        }
        return { stopLoss, takeProfit };
    }

    async expectProtectionPrices(stopLoss?: string | number, takeProfit?: string | number): Promise<void> {
        if (stopLoss !== undefined) {
            await expect.poll(() => this.stopLossPriceInput.inputValue().then(Number), {
                message: 'Stop Loss price on the trade ticket',
            }).toBe(Number(stopLoss));
        }
        if (takeProfit !== undefined) {
            await expect.poll(() => this.takeProfitPriceInput.inputValue().then(Number), {
                message: 'Take Profit price on the trade ticket',
            }).toBe(Number(takeProfit));
        }
    }

    async clickBuy(): Promise<void> {
        await this.buyButton.click();
    }

    async clickSell(): Promise<void> {
        await this.sellButton.click();
    }

    async isMarketClosed(): Promise<boolean> {
        await this.expectVisible(this.placeOrderButton);
        const label = await this.safeText(this.placeOrderButton);
        return /^market closed$/i.test(label) && !(await this.isOrderSubmitEnabled());
    }

    async isOrderSubmitEnabled(): Promise<boolean> {
        return this.placeOrderButton.isEnabled();
    }

    async clickPlaceOrder(): Promise<void> {
        await this.placeOrderButton.click();
    }

    async pickExpiryDate(date: Date): Promise<void> {
        await this.expiryDateControl.click();
        const currentMonth = new Date(`1 ${await this.expiryCalendarMonth.innerText()}`);
        const monthsAway = (date.getFullYear() - currentMonth.getFullYear()) * 12
            + date.getMonth() - currentMonth.getMonth();
        const arrow = monthsAway < 0 ? this.expiryPreviousMonth : this.expiryNextMonth;
        for (let index = 0; index < Math.abs(monthsAway); index += 1) {
            await arrow.click();
        }

        const dateName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        await this.page.getByRole('button', { name: dateName, exact: true }).click();
    }

    /** Expects the time in `HH:mm` format. */
    async setExpiryTime(time: string): Promise<void> {
        const [hour, minute] = time.split(':');
        await this.expiryTimeControl.click();
        for (const [dropdown, value] of [[this.expiryHourDropdown, hour], [this.expiryMinuteDropdown, minute]] as const) {
            if (await this.readDropdownValue(dropdown) !== value) {
                await this.openDropdown(dropdown);
                await dropdown.getByText(value, { exact: true }).click();
            }
        }
        await this.expiryTimeConfirm.click();
    }

    async getLiveBidPrice(): Promise<number> {
        return this.readNumber(this.liveSellPrice);
    }

    async getLiveAskPrice(): Promise<number> {
        return this.readNumber(this.liveBuyPrice);
    }

    async getPointValue(): Promise<number> {
        let pointValue = Number.NaN;
        await expect.poll(async () => {
            const text = await this.safeText(this.onePointLabel);
            pointValue = Number(text.match(/([\d.]+)\s*$/)?.[1]);
            return pointValue;
        }, { message: 'Wait for the selected symbol point value' }).toBeGreaterThan(0);
        return pointValue;
    }

    async getMinVolume(): Promise<number> {
        const placeholder = await this.volumeInput.getAttribute('placeholder');
        const minimum = placeholder?.match(/^Min:\s*([\d,.]+)$/i)?.[1];
        return minimum === undefined ? Number.NaN : Number(minimum.replaceAll(',', ''));
    }

    async expectReady(): Promise<void> {
        await expect(this.volumeInput, 'Wait for the trade ticket volume field to load').toBeVisible();
    }

    async expectValidationMessage(message?: string | RegExp): Promise<void> {
        const messages = message
            ? this.page.getByText(message, { exact: true })
            : this.validationMessage;
        await expect(messages.first()).toBeVisible();
    }

    private async openDropdown(dropdown: Locator): Promise<void> {
        await dropdown.locator('[tabindex="0"]').first().click();
    }

    private async pickDropdownOption(dropdown: Locator, label: string): Promise<void> {
        const option = dropdown
            .locator('div[tabindex="0"]:not(:has(svg))')
            .filter({ hasText: new RegExp(`^${label}$`) })
            .first();

        await option.click();
    }

    private async readDropdownValue(dropdown: Locator): Promise<string> {
        return this.safeText(dropdown.locator('[tabindex="0"]').first());
    }

    private async fillPrice(input: Locator, price: string | number): Promise<void> {
        await input.fill(String(price));
        await input.blur();
        await expect.poll(() => this.readOptionalInputNumber(input), {
            message: 'Verify the trade ticket kept the entered pending order price',
        }).toBe(Number(String(price).replaceAll(',', '')));
    }

    private async readOptionalInputNumber(input: Locator): Promise<number | undefined> {
        const text = (await input.inputValue()).trim();
        return text === '' ? undefined : Number(text.replaceAll(',', ''));
    }

    /** Returns `NaN` when the text contains no number. */
    private async readNumber(locator: Locator): Promise<number> {
        const text = await this.safeText(locator);
        const normalised = text.replace(/,/g, '');
        const match = normalised.match(/-?\d+(\.\d+)?/);
        return match ? Number(match[0]) : Number.NaN;
    }
}

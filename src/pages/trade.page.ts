import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test';

import { BasePage } from '@core/base-page';

import { Dialog } from './components/dialog';
import { NotificationPanel } from './components/notification-panel';
import { OrdersPanel, type AssetTab } from './components/orders-panel';
import { TradeTicket } from './components/trade-ticket';

const ORDER_SUBMISSION_PATHS = new Set([
    '/api/trade/trade/v1/market',
    '/api/trade/trade/v1/limit',
]);
const SYMBOL_ORDERS_PATHS = {
    'open-positions': '/api/trade/order/v1',
    'pending-orders': '/api/trade/order/v1/pending',
};

export type SymbolOrdersTab = Extract<AssetTab, keyof typeof SYMBOL_ORDERS_PATHS>;

interface SymbolOrder {
    orderType: number;
}

export class TradePage extends BasePage {
    readonly ticket: TradeTicket;
    readonly dialog: Dialog;
    readonly orders: OrdersPanel;
    readonly notifications: NotificationPanel;

    private readonly symbolInput: Locator;
    private readonly symbolSearchResults: Locator;
    private readonly selectedSymbol: Locator;
    private readonly toastDescription: Locator;

    constructor(page: Page) {
        super(page);
        this.ticket = new TradeTicket(page);
        this.dialog = new Dialog(page);
        this.orders = new OrdersPanel(page, this.dialog);
        this.notifications = new NotificationPanel(page);

        this.symbolInput = page.getByTestId('symbol-input-search');
        this.symbolSearchResults = page.getByTestId('symbol-input-search-items-symbol');
        this.selectedSymbol = page.getByTestId('symbol-overview-id');
        this.toastDescription = page.getByTestId('notification-box-description');
    }

    async navigate(): Promise<void> {
        await this.goto('/web/trade');
        await this.ticket.expectReady();
    }

    async expectToastAfter<T>(action: () => Promise<T>): Promise<T> {
        await expect(this.toastDescription).toBeHidden();
        const result = await action();
        await this.expectVisible(this.toastDescription);
        return result;
    }

    async selectSymbol(symbol: string): Promise<void> {
        if (await this.selectedSymbol.isVisible() && (await this.getSelectedSymbol()) === symbol) {
            return;
        }

        await this.symbolInput.fill(symbol);
        const option = this.symbolSearchResults.filter({ hasText: symbol }).first();
        await option.click();
        await this.expectSymbolSelected(symbol);
    }

    async expectSymbolSelected(symbol: string): Promise<void> {
        await expect(this.selectedSymbol).toHaveText(symbol);
    }

    async getSelectedSymbol(): Promise<string> {
        return this.safeText(this.selectedSymbol);
    }

    async selectSymbolAndLoadOrders(symbol: string, tab: SymbolOrdersTab): Promise<SymbolOrder[]> {
        const origin = new URL(this.page.url()).origin;
        const [response] = await Promise.all([
            this.page.waitForResponse(response => {
                const url = new URL(response.url());
                return response.request().method() === 'GET'
                    && url.origin === origin
                    && url.pathname === SYMBOL_ORDERS_PATHS[tab]
                    && url.searchParams.get('symbol') === symbol;
            }, { timeout: 15_000 }),
            this.selectSymbol(symbol),
        ]);
        if (!response.ok()) {
            throw new Error(`Could not load ${tab} for ${symbol}. HTTP ${response.status()}`);
        }
        const body: { result?: SymbolOrder[] } = await response.json();
        if (!Array.isArray(body.result)) {
            throw new Error(`Could not read the ${tab} list for ${symbol}`);
        }
        return body.result;
    }

    async waitForSubmittedOrderId(signal: AbortSignal, timeout: number): Promise<string | null> {
        const origin = new URL(this.page.url()).origin;
        const response = await this.page.waitForResponse(
            response => this.isOrderSubmission(response.request(), origin),
            { signal, timeout },
        ).catch((error: unknown) => {
            if (signal.aborted) {
                return null;
            }
            throw error;
        });

        return response ? this.readSubmittedOrderId(response) : null;
    }

    async expectNoOrderSubmissionDuring(action: () => Promise<void>): Promise<void> {
        const origin = new URL(this.page.url()).origin;
        let submissionSent = false;
        const onRequest = (request: Request): void => {
            submissionSent ||= this.isOrderSubmission(request, origin);
        };

        this.page.on('request', onRequest);
        try {
            await action();
        } finally {
            this.page.off('request', onRequest);
        }
        expect(submissionSent, 'Unexpected order submission request').toBe(false);
    }

    private isOrderSubmission(request: Request, origin: string): boolean {
        const url = new URL(request.url());
        return request.method() === 'POST'
            && url.origin === origin
            && ORDER_SUBMISSION_PATHS.has(url.pathname);
    }

    private async readSubmittedOrderId(response: Response): Promise<string | null> {
        const status = response.status();
        if (status >= 400 && status < 500) {
            return null;
        }
        if (!response.ok()) {
            throw new Error(`Order submission returned HTTP ${status}`);
        }

        const body: { result?: { clOrdId?: unknown } } | null = await response.json();
        const orderId = body?.result?.clOrdId;
        if (typeof orderId === 'string' && orderId.trim() !== '') {
            return orderId;
        }

        throw new Error('Successful order submission did not return a usable result.clOrdId');
    }
}

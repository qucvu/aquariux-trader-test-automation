import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from '@core/base-page';

export type NotificationTab = 'order' | 'system' | 'information';

export interface NotificationItem {
    title: string;
    meta: string;
}

export class NotificationPanel extends BasePage {
    private readonly selector: Locator;
    private readonly tabs: Record<NotificationTab, Locator>;
    private readonly list: Locator;
    private readonly listItems: Locator;

    constructor(page: Page) {
        super(page);

        this.selector = page.getByTestId('notification-selector');
        this.tabs = {
            order: page.getByTestId('tab-notification-type-order'),
            system: page.getByTestId('tab-notification-type-system'),
            information: page.getByTestId('tab-notification-type-information'),
        };
        this.list = page.getByTestId('notification-list-result');
        this.listItems = page.getByTestId('notification-list-result-item');
    }

    async openPanel(): Promise<void> {
        if (!(await this.list.isVisible())) {
            await this.selector.click();
        }
        await this.expectVisible(this.list);
    }

    async closePanel(): Promise<void> {
        await this.page.locator('body').click({ position: { x: 5, y: 5 } });
        await expect(this.list).toBeHidden();
    }

    async openTab(tab: NotificationTab): Promise<void> {
        const tabElement = this.tabs[tab];
        await tabElement.click();
        await expect(tabElement).toContainClass('selected');
    }

    async refreshOrderNotifications(): Promise<void> {
        if (await this.list.isVisible()) {
            await this.closePanel();
        }

        const origin = new URL(this.page.url()).origin;
        const [response] = await Promise.all([
            this.page.waitForResponse(response => {
                const url = new URL(response.url());
                return response.request().method() === 'GET'
                    && url.origin === origin
                    && url.pathname === '/api/notification/v2'
                    && url.searchParams.get('notificationType') === 'ORDER';
            }, { timeout: 8_000 }),
            (async () => {
                await this.openPanel();
                await this.openTab('order');
            })(),
        ]);
        if (!response.ok()) {
            throw new Error(`The notifications feed returned HTTP ${response.status()}`);
        }
    }

    async getNotifications(): Promise<NotificationItem[]> {
        return this.listItems.evaluateAll(items => items.map(item => {
            const title = item.querySelector('[data-testid="notification-list-result-item-title"]');
            const meta = item.querySelector('[data-testid="notification-list-result-item-meta"]');

            return {
                title: title?.textContent?.trim() ?? '',
                meta: meta?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            };
        }));
    }
}

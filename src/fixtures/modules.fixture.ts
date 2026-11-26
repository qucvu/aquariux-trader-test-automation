import { RecordsModule } from '@modules/records.module';
import { TradingModule } from '@modules/trading.module';

import { test as pageTest } from './pages.fixture';

interface ModuleFixtures {
    tradingModule: TradingModule;
    recordsModule: RecordsModule;
}

export const test = pageTest.extend<ModuleFixtures>({
    tradingModule: async ({ tradePage }, use) => {
        await use(new TradingModule(tradePage));
    },
    recordsModule: async ({ tradePage }, use) => {
        await use(new RecordsModule(tradePage.orders, tradePage.notifications, tradePage.dialog));
    },
});

export { expect } from '@playwright/test';

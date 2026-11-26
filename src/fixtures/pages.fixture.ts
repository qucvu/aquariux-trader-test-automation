import { TradePage } from '@pages/trade.page';

import { test as authTest } from './auth.fixture';

interface PageFixtures {
    tradePage: TradePage;
}

export const test = authTest.extend<PageFixtures>({
    tradePage: async ({ authPage }, use) => {
        await use(new TradePage(authPage));
    },
});

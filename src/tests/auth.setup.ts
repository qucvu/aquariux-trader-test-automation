import { saveDemoStorageState, test } from '@fixtures';

test.describe('Authentication setup', () => {
    test('signs in to the demo account', async ({ page }) => {
        await saveDemoStorageState(page);
    });
});

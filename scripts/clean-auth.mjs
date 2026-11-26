import { rmSync } from 'node:fs';

const authStatePath = 'playwright/.auth/demo-account.json';

rmSync(new URL(`../${authStatePath}`, import.meta.url), { force: true });
console.log(`[del:auth] Cleared ${authStatePath}`);

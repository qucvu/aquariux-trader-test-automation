import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

rmSync(path.join(root, 'reports/allure-results'), {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
});
console.log('[del:logs] removed reports/allure-results');
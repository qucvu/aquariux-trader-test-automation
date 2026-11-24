import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const placement = [
    ['.page.ts', 'src/pages/'],
    ['.module.ts', 'src/modules/'],
    ['.spec.ts', 'src/tests/'],
];
const locatorCall = /\.\s*(?:locator|getBy(?:Role|Label|Text|TestId|Placeholder|AltText|Title))\s*\(/;

const files = readdirSync(join(root, 'src'), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
    .map(entry => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
const errors = [];

for (const file of files) {
    const [, folder] = placement.find(([suffix]) => file.endsWith(suffix)) ?? [];
    if (folder && !file.startsWith(folder)) {
        errors.push(`${file}: Move this file to ${folder}.`);
    }

    const checkLocator = file.startsWith('src/modules/') || file.endsWith('.module.ts') || file.endsWith('.spec.ts');
    if (checkLocator && locatorCall.test(readFileSync(join(root, file), 'utf8'))) {
        errors.push(`${file}: Put locators in a Page Object.`);
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Rules passed (${files.length} TypeScript files).`);
}

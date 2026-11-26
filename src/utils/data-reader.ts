import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export class DataReader {
    /**
     * Resolves relative paths from the current working directory.
     * The expected data shape T is a compile-time assertion.
     */
    static json<T = unknown>(filePath: string): T {
        const fullPath = resolve(process.cwd(), filePath);
        const content = readFileSync(fullPath, 'utf8');

        try {
            return JSON.parse(content) as T;
        } catch (error) {
            throw new Error(`Test data file is not valid JSON: ${fullPath}`, { cause: error });
        }
    }
}

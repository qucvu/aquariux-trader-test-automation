import { assertConfig } from './config';
import { Logger } from './logger';

// Validates the test environment before the suite starts.
export default async function globalSetup(): Promise<void> {
    const logger = Logger.create('GlobalSetup');

    try {
        assertConfig();
        logger.info('Environment configuration is valid');
    } catch (error) {
        logger.error('Environment configuration is invalid', error);
        throw error;
    }
}

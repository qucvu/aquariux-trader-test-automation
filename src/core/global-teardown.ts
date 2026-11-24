import { Logger } from './logger';

export default async function globalTeardown(): Promise<void> {
    const logger = Logger.create('GlobalTeardown');
    logger.info('Test suite finished');
}

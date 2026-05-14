import { sweepPassiveData } from './jobs/passiveSweep';
import { logger } from './lib/logger';

async function verifyCron() {
  logger.info('--- Starting Cron Verification ---');
  await sweepPassiveData();
  logger.info('--- Cron Verification Complete ---');
}

verifyCron().catch(err => logger.error({ err }, 'Cron verification failed'));

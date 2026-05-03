import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { TransactionRepository } from './repository/transaction.repository';

const repo = new TransactionRepository();

if (config.SEED) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sampleData = require('../demo/sample-data.json');
  repo.bulkLoad(sampleData);
  logger.info({ count: sampleData.length }, 'Seed data loaded');
}

const app = createApp(repo);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

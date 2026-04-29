import express from 'express';
import cors from 'cors';
import path from 'path';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import healthRouter from './routes/health.routes';
import { createTransactionsRouter } from './routes/transactions.routes';
import { createAccountsRouter } from './routes/accounts.routes';
import { TransactionRepository } from './repository/transaction.repository';
import { TransactionsService } from './services/transactions.service';
import { AccountsService } from './services/accounts.service';
import { TransactionsController } from './controllers/transactions.controller';
import { AccountsController } from './controllers/accounts.controller';
import { config } from './config';

export function createApp(repo?: TransactionRepository) {
  const app = express();
  const repository = repo ?? new TransactionRepository();

  const txService = new TransactionsService(repository);
  const acctService = new AccountsService(repository);
  const txController = new TransactionsController(txService);
  const acctController = new AccountsController(acctService);

  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestId);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/health', healthRouter);
  app.use('/api/transactions', createTransactionsRouter(txController));
  app.use('/api/accounts', createAccountsRouter(acctController));

  app.use(errorHandler);

  return app;
}

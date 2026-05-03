import { Router } from 'express';
import { TransactionsController } from '../controllers/transactions.controller';
import { validate } from '../middleware/validate';
import { CreateTransactionSchema, ListFiltersSchema } from '../validators/transaction.schemas';
import { AccountId } from '../validators/common.schemas';
import { z } from 'zod';

export function createTransactionsRouter(controller: TransactionsController): Router {
  const router = Router();

  router.post('/', validate({ body: CreateTransactionSchema }), controller.create);
  router.get('/export', validate({ query: ListFiltersSchema }), controller.exportCSV);
  router.get('/', validate({ query: ListFiltersSchema }), controller.list);
  router.get(
    '/:id',
    validate({ params: z.object({ id: z.string() }) }),
    controller.getById,
  );

  return router;
}

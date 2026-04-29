import { Router } from 'express';
import { AccountsController } from '../controllers/accounts.controller';
import { validate } from '../middleware/validate';
import { AccountId } from '../validators/common.schemas';
import { z } from 'zod';

const accountParams = z.object({ accountId: AccountId });

export function createAccountsRouter(controller: AccountsController): Router {
  const router = Router();

  router.get(
    '/:accountId/balance',
    validate({ params: accountParams }),
    controller.getBalance,
  );
  router.get(
    '/:accountId/summary',
    validate({ params: accountParams }),
    controller.getSummary,
  );

  return router;
}

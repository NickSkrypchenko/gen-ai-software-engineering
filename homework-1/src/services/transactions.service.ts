import { ulid } from 'ulid';
import { TransactionRepository } from '../repository/transaction.repository';
import { Transaction, CreateTransactionInput, ListFilters } from '../models/transaction.types';
import { Clock, realClock } from '../utils/clock';
import { logger } from '../utils/logger';

export class TransactionsService {
  constructor(
    private readonly repo: TransactionRepository,
    private readonly clock: Clock = realClock,
  ) {}

  create(input: CreateTransactionInput, requestId?: string): Transaction {
    const id = `txn_${ulid()}`;
    const timestamp = this.clock();

    const txn = this.repo.create(input, id, timestamp);

    try {
      const balance = this.getBalance(txn.fromAccount, txn.currency);

      const needsBalanceCheck =
        txn.type === 'withdrawal' || txn.type === 'transfer';

      if (needsBalanceCheck && balance < txn.amount) {
        return this.repo.markFailed(id, 'INSUFFICIENT_FUNDS');
      }

      return this.repo.markCompleted(id);
    } catch (err) {
      logger.error({ err, requestId, txnId: id }, 'Settlement error — marking failed');
      return this.repo.markFailed(id, 'INSUFFICIENT_FUNDS');
    }
  }

  list(filters: ListFilters): Transaction[] {
    return this.repo.list(filters);
  }

  getById(id: string): Transaction | undefined {
    return this.repo.getById(id);
  }

  getBalance(accountId: string, currency: string): number {
    if (accountId === 'EXTERNAL') return 0;
    const txns = this.repo.list({ accountId });
    return txns
      .filter(t => t.status === 'completed' && t.currency === currency)
      .reduce((sum, t) => {
        if (t.toAccount === accountId) return sum + t.amount;
        if (t.fromAccount === accountId) return sum - t.amount;
        return sum;
      }, 0);
  }
}

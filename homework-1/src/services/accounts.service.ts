import { TransactionRepository } from '../repository/transaction.repository';
import { CURRENCY_CODES } from '../validators/common.schemas';

interface BalanceEntry {
  currency: string;
  amount: number;
}

interface SummaryEntry {
  currency: string;
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
  lastTransactionAt: string | null;
}

export class AccountsService {
  constructor(private readonly repo: TransactionRepository) {}

  getBalances(accountId: string): { accountId: string; balances: BalanceEntry[]; asOf: string } {
    const txns = this.repo.list({ accountId });
    const completed = txns.filter(t => t.status === 'completed');

    const currencies = [...new Set(completed.map(t => t.currency))];
    const balances: BalanceEntry[] = currencies.map(currency => {
      const amount = completed
        .filter(t => t.currency === currency)
        .reduce((sum, t) => {
          if (t.toAccount === accountId) return sum + t.amount;
          if (t.fromAccount === accountId) return sum - t.amount;
          return sum;
        }, 0);
      return { currency, amount: Math.round(amount * 100) / 100 };
    });

    return { accountId, balances, asOf: new Date().toISOString() };
  }

  getSummary(accountId: string): { accountId: string; perCurrency: SummaryEntry[] } {
    const txns = this.repo.list({ accountId });

    const currencies = [...new Set(txns.map(t => t.currency))];
    const perCurrency: SummaryEntry[] = currencies.map(currency => {
      const currencyTxns = txns.filter(t => t.currency === currency);
      const completed = currencyTxns.filter(t => t.status === 'completed');

      const totalDeposits = completed
        .filter(t => t.toAccount === accountId)
        .reduce((sum, t) => Math.round((sum + t.amount) * 100) / 100, 0);

      const totalWithdrawals = completed
        .filter(t => t.fromAccount === accountId)
        .reduce((sum, t) => Math.round((sum + t.amount) * 100) / 100, 0);

      const sorted = currencyTxns.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const lastTransactionAt = sorted[0]?.timestamp ?? null;

      return {
        currency,
        totalDeposits,
        totalWithdrawals,
        transactionCount: currencyTxns.length,
        lastTransactionAt,
      };
    });

    return { accountId, perCurrency };
  }
}

import { describe, it, expect } from 'vitest';
import { TransactionRepository } from '../repository/transaction.repository';
import { AccountsService } from './accounts.service';
import { TransactionsService } from './transactions.service';

const fakeClock = () => new Date('2026-04-29T10:00:00.000Z');

function makeServices() {
  const repo = new TransactionRepository(fakeClock);
  const txService = new TransactionsService(repo, fakeClock);
  const acctService = new AccountsService(repo);
  return { repo, txService, acctService };
}

describe('AccountsService.getBalances', () => {
  it('returns empty balances for an account with no transactions', () => {
    const { acctService } = makeServices();
    const result = acctService.getBalances('ACC-AAAAA');
    expect(result.accountId).toBe('ACC-AAAAA');
    expect(result.balances).toEqual([]);
    expect(result.asOf).toBeDefined();
  });

  it('computes balance from completed deposits', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 1000, currency: 'USD', type: 'deposit' });
    const result = acctService.getBalances('ACC-AAAAA');
    const usd = result.balances.find(b => b.currency === 'USD');
    expect(usd?.amount).toBe(1000);
  });

  it('excludes failed transactions from balance calculation', () => {
    const { txService, acctService } = makeServices();
    // deposit 500
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'USD', type: 'deposit' });
    // attempt failed withdrawal (exceeds balance)
    txService.create({ fromAccount: 'ACC-AAAAA', toAccount: 'EXTERNAL', amount: 999, currency: 'USD', type: 'withdrawal' });

    const result = acctService.getBalances('ACC-AAAAA');
    const usd = result.balances.find(b => b.currency === 'USD');
    // balance should still be 500, not reduced by the failed withdrawal
    expect(usd?.amount).toBe(500);
  });

  it('tracks multiple currencies independently', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 1000, currency: 'USD', type: 'deposit' });
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'EUR', type: 'deposit' });

    const result = acctService.getBalances('ACC-AAAAA');
    const usd = result.balances.find(b => b.currency === 'USD');
    const eur = result.balances.find(b => b.currency === 'EUR');
    expect(usd?.amount).toBe(1000);
    expect(eur?.amount).toBe(500);
  });

  it('subtracts withdrawals from balance', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 1000, currency: 'USD', type: 'deposit' });
    txService.create({ fromAccount: 'ACC-AAAAA', toAccount: 'EXTERNAL', amount: 300, currency: 'USD', type: 'withdrawal' });

    const result = acctService.getBalances('ACC-AAAAA');
    const usd = result.balances.find(b => b.currency === 'USD');
    expect(usd?.amount).toBe(700);
  });
});

describe('AccountsService.getSummary', () => {
  it('returns empty perCurrency for account with no transactions', () => {
    const { acctService } = makeServices();
    const result = acctService.getSummary('ACC-AAAAA');
    expect(result.accountId).toBe('ACC-AAAAA');
    expect(result.perCurrency).toEqual([]);
  });

  it('transactionCount includes failed rows for the initiator', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' });
    // failed withdrawal — ACC-AAAAA is initiator
    txService.create({ fromAccount: 'ACC-AAAAA', toAccount: 'EXTERNAL', amount: 9999, currency: 'USD', type: 'withdrawal' });

    const result = acctService.getSummary('ACC-AAAAA');
    const usd = result.perCurrency.find(e => e.currency === 'USD');
    expect(usd?.transactionCount).toBe(2);
  });

  it('totalWithdrawals excludes failed rows', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'USD', type: 'deposit' });
    txService.create({ fromAccount: 'ACC-AAAAA', toAccount: 'EXTERNAL', amount: 9999, currency: 'USD', type: 'withdrawal' });

    const result = acctService.getSummary('ACC-AAAAA');
    const usd = result.perCurrency.find(e => e.currency === 'USD');
    expect(usd?.totalWithdrawals).toBe(0);
  });

  it('totalDeposits accumulates completed deposits', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 200, currency: 'USD', type: 'deposit' });
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 300, currency: 'USD', type: 'deposit' });

    const result = acctService.getSummary('ACC-AAAAA');
    const usd = result.perCurrency.find(e => e.currency === 'USD');
    expect(usd?.totalDeposits).toBe(500);
  });

  it('aggregates multi-currency summaries independently', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 1000, currency: 'USD', type: 'deposit' });
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'EUR', type: 'deposit' });

    const result = acctService.getSummary('ACC-AAAAA');
    const usd = result.perCurrency.find(e => e.currency === 'USD');
    const eur = result.perCurrency.find(e => e.currency === 'EUR');
    expect(usd?.totalDeposits).toBe(1000);
    expect(eur?.totalDeposits).toBe(500);
    expect(usd?.transactionCount).toBe(1);
    expect(eur?.transactionCount).toBe(1);
  });

  it('lastTransactionAt is set to the most recent transaction timestamp', () => {
    const { txService, acctService } = makeServices();
    txService.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' });

    const result = acctService.getSummary('ACC-AAAAA');
    const usd = result.perCurrency.find(e => e.currency === 'USD');
    expect(usd?.lastTransactionAt).toBeDefined();
    expect(usd?.lastTransactionAt).not.toBeNull();
  });
});

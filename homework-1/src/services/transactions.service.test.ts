import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionRepository } from '../repository/transaction.repository';
import { TransactionsService } from './transactions.service';

const fakeClock = () => new Date('2026-04-29T10:00:00.000Z');

function makeService() {
  const repo = new TransactionRepository(fakeClock);
  const service = new TransactionsService(repo, fakeClock);
  return { repo, service };
}

describe('TransactionsService — deposit', () => {
  it('deposit always succeeds regardless of balance', () => {
    const { service } = makeService();
    const txn = service.create({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-AAAAA',
      amount: 1000,
      currency: 'USD',
      type: 'deposit',
    });
    expect(txn.status).toBe('completed');
    expect(txn.failureReason).toBeNull();
  });

  it('deposit to empty account succeeds (no balance needed)', () => {
    const { service } = makeService();
    const txn = service.create({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-CCCCC',
      amount: 9999,
      currency: 'USD',
      type: 'deposit',
    });
    expect(txn.status).toBe('completed');
  });
});

describe('TransactionsService — withdrawal', () => {
  it('withdrawal with sufficient balance completes', () => {
    const { service } = makeService();
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'USD', type: 'deposit' });
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 200,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(txn.status).toBe('completed');
  });

  it('withdrawal with insufficient balance fails with INSUFFICIENT_FUNDS', () => {
    const { service } = makeService();
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 999,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(txn.status).toBe('failed');
    expect(txn.failureReason).toBe('INSUFFICIENT_FUNDS');
  });

  it('USD withdrawal cannot be paid by EUR balance (multi-currency)', () => {
    const { service } = makeService();
    // Fund ACC-AAAAA with EUR only
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 1000, currency: 'EUR', type: 'deposit' });
    // Attempt USD withdrawal
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 100,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(txn.status).toBe('failed');
    expect(txn.failureReason).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('TransactionsService — transfer', () => {
  it('transfer with sufficient balance completes', () => {
    const { service } = makeService();
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'USD', type: 'deposit' });
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'ACC-BBBBB',
      amount: 300,
      currency: 'USD',
      type: 'transfer',
    });
    expect(txn.status).toBe('completed');
  });

  it('transfer with insufficient balance fails with INSUFFICIENT_FUNDS', () => {
    const { service } = makeService();
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'ACC-BBBBB',
      amount: 500,
      currency: 'USD',
      type: 'transfer',
    });
    expect(txn.status).toBe('failed');
    expect(txn.failureReason).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('TransactionsService — settlement never leaves pending', () => {
  it('completed transaction is never pending in final response', () => {
    const { service } = makeService();
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' });
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 50,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(txn.status).not.toBe('pending');
  });

  it('failed transaction is never pending in final response', () => {
    const { service } = makeService();
    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 9999,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(txn.status).not.toBe('pending');
  });
});

describe('TransactionsService — try/catch fallback', () => {
  it('marks failed and logs when getBalance throws', () => {
    const { service } = makeService();
    // Fund so it would succeed normally
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 500, currency: 'USD', type: 'deposit' });

    // Make getBalance throw on the next call
    const spy = vi.spyOn(service, 'getBalance').mockImplementationOnce(() => {
      throw new Error('Simulated internal error');
    });

    const txn = service.create({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 100,
      currency: 'USD',
      type: 'withdrawal',
    });

    expect(txn.status).toBe('failed');
    expect(txn.failureReason).toBe('INSUFFICIENT_FUNDS');
    spy.mockRestore();
  });
});

describe('TransactionsService — list and getById', () => {
  it('list returns all transactions', () => {
    const { service } = makeService();
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' });
    service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-BBBBB', amount: 200, currency: 'EUR', type: 'deposit' });
    expect(service.list({})).toHaveLength(2);
  });

  it('getById returns the transaction', () => {
    const { service } = makeService();
    const txn = service.create({ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' });
    expect(service.getById(txn.id)).toEqual(txn);
  });

  it('getById returns undefined for unknown id', () => {
    const { service } = makeService();
    expect(service.getById('txn_nonexistent')).toBeUndefined();
  });
});

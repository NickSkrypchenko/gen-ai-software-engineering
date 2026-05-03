import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionRepository } from './transaction.repository';
import { Transaction } from '../models/transaction.types';

const fakeClock = () => new Date('2026-04-29T10:00:00.000Z');

function makeRepo() {
  return new TransactionRepository(fakeClock);
}

const depositInput = {
  fromAccount: 'EXTERNAL' as const,
  toAccount: 'ACC-AAAAA',
  amount: 1000,
  currency: 'USD',
  type: 'deposit' as const,
};

const transferInput = {
  fromAccount: 'ACC-AAAAA',
  toAccount: 'ACC-BBBBB',
  amount: 200,
  currency: 'USD',
  type: 'transfer' as const,
};

describe('TransactionRepository.create', () => {
  it('creates a transaction in pending state', () => {
    const repo = makeRepo();
    const txn = repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    expect(txn.status).toBe('pending');
    expect(txn.id).toBe('txn_01HWTEST00000000000000001');
    expect(txn.failureReason).toBeNull();
  });

  it('indexes the transaction by real accounts (not EXTERNAL)', () => {
    const repo = makeRepo();
    repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    const results = repo.list({ accountId: 'ACC-AAAAA' });
    expect(results).toHaveLength(1);
  });

  it('does not index EXTERNAL account', () => {
    const repo = makeRepo();
    repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    // There's no way to filter by EXTERNAL via the API but we verify
    // the byAccount map doesn't blow up for it via the list path
    const all = repo.list({});
    expect(all).toHaveLength(1);
  });
});

describe('TransactionRepository.markCompleted / markFailed', () => {
  it('marks a transaction completed', () => {
    const repo = makeRepo();
    repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    const txn = repo.markCompleted('txn_01HWTEST00000000000000001');
    expect(txn.status).toBe('completed');
    expect(txn.failureReason).toBeNull();
  });

  it('marks a transaction failed with reason', () => {
    const repo = makeRepo();
    repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    const txn = repo.markFailed('txn_01HWTEST00000000000000001', 'INSUFFICIENT_FUNDS');
    expect(txn.status).toBe('failed');
    expect(txn.failureReason).toBe('INSUFFICIENT_FUNDS');
  });

  it('throws if transaction id not found', () => {
    const repo = makeRepo();
    expect(() => repo.markCompleted('txn_nonexistent')).toThrow();
  });
});

describe('TransactionRepository.list — failed-transaction visibility filter', () => {
  let repo: TransactionRepository;

  beforeEach(() => {
    repo = makeRepo();
    // ACC-AAAAA initiates a failed transfer to ACC-BBBBB
    repo.create(transferInput, 'txn_01HWTEST00000000000000001', fakeClock());
    repo.markFailed('txn_01HWTEST00000000000000001', 'INSUFFICIENT_FUNDS');
  });

  it('shows failed transfer to the initiating fromAccount (ACC-AAAAA)', () => {
    const results = repo.list({ accountId: 'ACC-AAAAA' });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
  });

  it('hides failed transfer from the counterparty toAccount (ACC-BBBBB)', () => {
    const results = repo.list({ accountId: 'ACC-BBBBB' });
    expect(results).toHaveLength(0);
  });

  it('returns failed transfer in admin view (no accountId filter)', () => {
    const results = repo.list({});
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
  });
});

describe('TransactionRepository.list — filters', () => {
  let repo: TransactionRepository;

  beforeEach(() => {
    repo = makeRepo();
    const id1 = 'txn_01HWTEST00000000000000001';
    const id2 = 'txn_01HWTEST00000000000000002';
    repo.create(
      { fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', amount: 100, currency: 'USD', type: 'deposit' },
      id1,
      new Date('2026-04-29T08:00:00.000Z'),
    );
    repo.markCompleted(id1);
    repo.create(
      { fromAccount: 'ACC-AAAAA', toAccount: 'ACC-BBBBB', amount: 50, currency: 'USD', type: 'transfer' },
      id2,
      new Date('2026-04-29T09:00:00.000Z'),
    );
    repo.markCompleted(id2);
  });

  it('filters by type', () => {
    const results = repo.list({ type: 'deposit' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('deposit');
  });

  it('filters by date range (from)', () => {
    const results = repo.list({ from: '2026-04-29T08:30:00.000Z' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('transfer');
  });

  it('filters by date range (to)', () => {
    const results = repo.list({ to: '2026-04-29T08:30:00.000Z' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('deposit');
  });

  it('returns results sorted by timestamp descending', () => {
    const results = repo.list({});
    expect(results[0].type).toBe('transfer');
    expect(results[1].type).toBe('deposit');
  });
});

describe('TransactionRepository.getById', () => {
  it('returns the transaction if found', () => {
    const repo = makeRepo();
    repo.create(depositInput, 'txn_01HWTEST00000000000000001', fakeClock());
    const txn = repo.getById('txn_01HWTEST00000000000000001');
    expect(txn).toBeDefined();
    expect(txn?.id).toBe('txn_01HWTEST00000000000000001');
  });

  it('returns undefined if not found', () => {
    const repo = makeRepo();
    expect(repo.getById('txn_unknown')).toBeUndefined();
  });
});

describe('TransactionRepository.bulkLoad', () => {
  it('loads transactions and makes them queryable', () => {
    const repo = makeRepo();
    const txns: Transaction[] = [
      {
        id: 'txn_01HWTEST00000000000000001',
        fromAccount: 'EXTERNAL',
        toAccount: 'ACC-AAAAA',
        amount: 500,
        currency: 'USD',
        type: 'deposit',
        timestamp: '2026-04-29T08:00:00.000Z',
        status: 'completed',
        failureReason: null,
      },
    ];
    repo.bulkLoad(txns);
    const results = repo.list({ accountId: 'ACC-AAAAA' });
    expect(results).toHaveLength(1);
  });
});

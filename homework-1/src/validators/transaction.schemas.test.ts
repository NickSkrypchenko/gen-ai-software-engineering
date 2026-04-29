import { describe, it, expect } from 'vitest';
import { CreateTransactionSchema, ListFiltersSchema } from './transaction.schemas';

const validDeposit = {
  fromAccount: 'EXTERNAL',
  toAccount: 'ACC-AAAAA',
  amount: 100,
  currency: 'USD',
  type: 'deposit',
};

const validWithdrawal = {
  fromAccount: 'ACC-AAAAA',
  toAccount: 'EXTERNAL',
  amount: 50,
  currency: 'USD',
  type: 'withdrawal',
};

const validTransfer = {
  fromAccount: 'ACC-AAAAA',
  toAccount: 'ACC-BBBBB',
  amount: 25,
  currency: 'EUR',
  type: 'transfer',
};

describe('CreateTransactionSchema — happy paths', () => {
  it('accepts a valid deposit', () => {
    expect(CreateTransactionSchema.safeParse(validDeposit).success).toBe(true);
  });

  it('accepts a valid withdrawal', () => {
    expect(CreateTransactionSchema.safeParse(validWithdrawal).success).toBe(true);
  });

  it('accepts a valid transfer', () => {
    expect(CreateTransactionSchema.safeParse(validTransfer).success).toBe(true);
  });
});

describe('CreateTransactionSchema — strict() rejects extra fields', () => {
  it('rejects id in body', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, id: 'txn_abc' });
    expect(result.success).toBe(false);
  });

  it('rejects status in body', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, status: 'completed' });
    expect(result.success).toBe(false);
  });

  it('rejects timestamp in body', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, timestamp: new Date().toISOString() });
    expect(result.success).toBe(false);
  });
});

describe('CreateTransactionSchema — type-account cross-rules', () => {
  it('rejects deposit where fromAccount is not EXTERNAL', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validDeposit,
      fromAccount: 'ACC-AAAAA',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('fromAccount'))).toBe(true);
    }
  });

  it('rejects deposit where toAccount is EXTERNAL', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validDeposit,
      toAccount: 'EXTERNAL',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('toAccount'))).toBe(true);
    }
  });

  it('rejects withdrawal where toAccount is not EXTERNAL', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validWithdrawal,
      toAccount: 'ACC-BBBBB',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('toAccount'))).toBe(true);
    }
  });

  it('rejects withdrawal where fromAccount is EXTERNAL', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validWithdrawal,
      fromAccount: 'EXTERNAL',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('fromAccount'))).toBe(true);
    }
  });

  it('rejects transfer where from equals to', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransfer,
      fromAccount: 'ACC-AAAAA',
      toAccount: 'ACC-AAAAA',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.message.includes('differ'))).toBe(true);
    }
  });
});

describe('CreateTransactionSchema — field validation', () => {
  it('rejects invalid currency', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, currency: 'XYZ' });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, amount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects 3-decimal amount', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, amount: 1.001 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown type', () => {
    const result = CreateTransactionSchema.safeParse({ ...validDeposit, type: 'refund' });
    expect(result.success).toBe(false);
  });
});

describe('ListFiltersSchema', () => {
  it('accepts empty filters', () => {
    expect(ListFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('accepts all filters combined', () => {
    const result = ListFiltersSchema.safeParse({
      accountId: 'ACC-AAAAA',
      type: 'transfer',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid accountId', () => {
    expect(ListFiltersSchema.safeParse({ accountId: 'bad' }).success).toBe(false);
  });

  it('rejects from > to', () => {
    const result = ListFiltersSchema.safeParse({
      from: '2026-12-31T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/from must be/);
    }
  });

  it('accepts from === to', () => {
    const ts = '2026-06-01T00:00:00.000Z';
    expect(ListFiltersSchema.safeParse({ from: ts, to: ts }).success).toBe(true);
  });
});

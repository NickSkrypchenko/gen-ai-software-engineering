import { describe, expect, it } from 'vitest';
import { ALLOWED_CURRENCIES, validateTransaction } from '../../src/domain/validation';
import type { RawTransaction } from '../../src/types';

const base: RawTransaction = {
  transaction_id: 'T1',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1001',
  destination_account: 'ACC-2001',
  amount: '100.00',
  currency: 'USD',
  transaction_type: 'transfer',
  metadata: { country: 'US' },
};

describe('validateTransaction', () => {
  it('accepts a well-formed transaction', () => {
    expect(validateTransaction(base)).toEqual({ valid: true, status: 'validated' });
  });

  it('has a closed 7-currency allow-list', () => {
    expect([...ALLOWED_CURRENCIES].sort()).toEqual(
      ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'USD'],
    );
  });

  it.each(['transaction_id', 'amount', 'currency', 'source_account', 'destination_account', 'timestamp'] as const)(
    'rejects missing field %s with MISSING_FIELD',
    (field) => {
      const tx = { ...base };
      delete (tx as Record<string, unknown>)[field];
      const r = validateTransaction(tx);
      expect(r.valid).toBe(false);
      expect(r.reject_reason).toBe(`MISSING_FIELD:${field}`);
    },
  );

  it('treats empty-string field as missing', () => {
    expect(validateTransaction({ ...base, currency: '   ' }).reject_reason).toBe(
      'MISSING_FIELD:currency',
    );
  });

  it.each(['-100.00', '0', '0.00', 'abc'])('rejects non-positive/invalid amount %s', (amount) => {
    expect(validateTransaction({ ...base, amount }).reject_reason).toBe('NON_POSITIVE_AMOUNT');
  });

  it.each(['../../etc/passwd', 'TXN/001', 'TXN 001', 'TXN.001'])(
    'rejects a path-unsafe transaction_id %s with INVALID_TRANSACTION_ID',
    (transaction_id) => {
      expect(validateTransaction({ ...base, transaction_id }).reject_reason).toBe(
        'INVALID_TRANSACTION_ID',
      );
    },
  );

  it('accepts a normal transaction_id with letters, digits, _ and -', () => {
    expect(validateTransaction({ ...base, transaction_id: 'TXN_001-A' }).valid).toBe(true);
  });

  it('rejects a currency outside the allow-list', () => {
    expect(validateTransaction({ ...base, currency: 'XYZ' }).reject_reason).toBe(
      'INVALID_CURRENCY:XYZ',
    );
  });

  it.each(['2026-03-16', 'not-a-date', '2026-13-40T99:99:99Z', '2026-03-16 09:00:00'])(
    'rejects malformed timestamp %s',
    (timestamp) => {
      expect(validateTransaction({ ...base, timestamp }).reject_reason).toBe('INVALID_TIMESTAMP');
    },
  );

  it('accepts a timestamp with a numeric offset', () => {
    expect(validateTransaction({ ...base, timestamp: '2026-03-16T09:00:00+02:00' }).valid).toBe(
      true,
    );
  });

  it('checks order: amount before currency (non-positive wins over bad currency)', () => {
    expect(validateTransaction({ ...base, amount: '-1', currency: 'XYZ' }).reject_reason).toBe(
      'NON_POSITIVE_AMOUNT',
    );
  });
});

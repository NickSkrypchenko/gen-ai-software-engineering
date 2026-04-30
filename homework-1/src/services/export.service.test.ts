import { describe, it, expect } from 'vitest';
import { toCSV } from './export.service';
import { Transaction } from '../models/transaction.types';

const baseTxn: Transaction = {
  id: 'txn_01HWTEST00000000000000001',
  fromAccount: 'EXTERNAL',
  toAccount: 'ACC-AAAAA',
  amount: 100.50,
  currency: 'USD',
  type: 'deposit',
  timestamp: '2026-04-29T10:00:00.000Z',
  status: 'completed',
  failureReason: null,
};

describe('toCSV', () => {
  it('includes a header row as the first line', () => {
    const csv = toCSV([baseTxn]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('id,fromAccount,toAccount,amount,currency,type,timestamp,status,failureReason');
  });

  it('outputs one data row per transaction', () => {
    const csv = toCSV([baseTxn, baseTxn]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('handles empty transaction list (header only)', () => {
    const csv = toCSV([]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^id,/);
  });

  it('uses CRLF line endings (RFC 4180)', () => {
    const csv = toCSV([baseTxn]);
    expect(csv).toContain('\r\n');
  });

  it('outputs null failureReason as empty string', () => {
    const csv = toCSV([baseTxn]);
    const dataRow = csv.split('\r\n')[1];
    // last field is failureReason which is null → ""
    expect(dataRow.endsWith(',')).toBe(true);
  });

  it('sets failureReason field for failed transactions', () => {
    const failed: Transaction = {
      ...baseTxn,
      status: 'failed',
      failureReason: 'INSUFFICIENT_FUNDS',
    };
    const csv = toCSV([failed]);
    expect(csv).toContain('INSUFFICIENT_FUNDS');
  });

  it('RFC 4180: wraps field containing comma in double quotes', () => {
    const txn: Transaction = {
      ...baseTxn,
      id: 'txn_,weird' as unknown as string,
    };
    const csv = toCSV([txn]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow.startsWith('"txn_,weird"')).toBe(true);
  });

  it('RFC 4180: doubles embedded double-quotes', () => {
    const txn: Transaction = {
      ...baseTxn,
      id: 'txn_"quoted"' as unknown as string,
    };
    const csv = toCSV([txn]);
    expect(csv).toContain('"txn_""quoted"""');
  });

  it('header column order matches spec', () => {
    const csv = toCSV([baseTxn]);
    const headers = csv.split('\r\n')[0].split(',');
    expect(headers).toEqual([
      'id', 'fromAccount', 'toAccount', 'amount', 'currency',
      'type', 'timestamp', 'status', 'failureReason',
    ]);
  });
});

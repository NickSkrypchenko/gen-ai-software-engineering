import { Transaction } from '../models/transaction.types';

const HEADERS = [
  'id',
  'fromAccount',
  'toAccount',
  'amount',
  'currency',
  'type',
  'timestamp',
  'status',
  'failureReason',
] as const;

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(transactions: Transaction[]): string {
  const headerRow = HEADERS.join(',');
  const rows = transactions.map(txn =>
    HEADERS.map(key => escapeField(String(txn[key] ?? ''))).join(','),
  );
  return [headerRow, ...rows].join('\r\n');
}

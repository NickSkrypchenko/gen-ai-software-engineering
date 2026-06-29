/**
 * Transaction Validator — pure core.
 *
 * Validation is terminal on failure: the first failing rule yields a `REJECTED_VALIDATION`
 * reason and the transaction never reaches the Fraud Detector or Compliance Checker.
 * Check order: missing field → non-positive amount → invalid currency → invalid timestamp.
 */
import { isPositiveAmount } from '../lib/money.js';
import type { Currency, RawTransaction, ValidationResult } from '../types.js';

/** Closed ISO 4217 allow-list — exactly 7, equal 1:1 to the FX-rate keys (parity test). */
export const ALLOWED_CURRENCIES: readonly Currency[] = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
];

const REQUIRED_FIELDS: Array<keyof RawTransaction> = [
  'transaction_id',
  'amount',
  'currency',
  'source_account',
  'destination_account',
  'timestamp',
];

/**
 * `transaction_id` becomes part of result/audit filenames, so it must be a safe path segment.
 * Restrict to an unambiguous token charset — this also blocks path traversal (`../`, `/`).
 */
const TRANSACTION_ID = /^[A-Za-z0-9_-]+$/;

/** Strict-ish ISO 8601 with a `Z` or numeric offset, plus a real calendar check. */
function isValidIso8601(ts: string): boolean {
  if (typeof ts !== 'string') return false;
  const shape = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (!shape.test(ts)) return false;
  return !Number.isNaN(Date.parse(ts));
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Validate a raw transaction. `valid: false` ⇒ terminal `REJECTED_VALIDATION`. */
export function validateTransaction(tx: Partial<RawTransaction>): ValidationResult {
  for (const field of REQUIRED_FIELDS) {
    if (isMissing(tx[field])) {
      return { valid: false, status: 'rejected', reject_reason: `MISSING_FIELD:${field}` };
    }
  }

  if (!TRANSACTION_ID.test(tx.transaction_id as string)) {
    return { valid: false, status: 'rejected', reject_reason: 'INVALID_TRANSACTION_ID' };
  }

  if (!isPositiveAmount(tx.amount as string)) {
    return { valid: false, status: 'rejected', reject_reason: 'NON_POSITIVE_AMOUNT' };
  }

  if (!ALLOWED_CURRENCIES.includes(tx.currency as Currency)) {
    return {
      valid: false,
      status: 'rejected',
      reject_reason: `INVALID_CURRENCY:${tx.currency}`,
    };
  }

  if (!isValidIso8601(tx.timestamp as string)) {
    return { valid: false, status: 'rejected', reject_reason: 'INVALID_TIMESTAMP' };
  }

  return { valid: true, status: 'validated' };
}

import { z } from 'zod';

export const AccountId = z
  .string()
  .regex(/^ACC-[A-Z0-9]{5}$/, 'Account must match ACC-XXXXX (5 uppercase alphanumeric)');

export const ExternalAccount = z.literal('EXTERNAL');
export const AccountIdOrExternal = z.union([AccountId, ExternalAccount]);

export const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
] as const;

export const Currency = z.enum(CURRENCY_CODES);

export const MAX_AMOUNT = 1_000_000;

export const MoneySchema = z
  .number()
  .positive('Amount must be a positive number')
  .refine(Number.isFinite, 'Amount must be finite')
  .refine(n => n <= MAX_AMOUNT, `Amount must not exceed ${MAX_AMOUNT}`)
  .refine(
    n => Math.round(n * 100) === n * 100,
    'Amount supports max 2 decimal places',
  );

export const FailureReason = z.enum(['INSUFFICIENT_FUNDS']);
export type FailureReasonType = z.infer<typeof FailureReason>;

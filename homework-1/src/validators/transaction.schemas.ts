import { z } from 'zod';
import {
  AccountIdOrExternal,
  AccountId,
  Currency,
  MoneySchema,
  FailureReason,
} from './common.schemas';

export const CreateTransactionSchema = z
  .object({
    fromAccount: AccountIdOrExternal,
    toAccount: AccountIdOrExternal,
    amount: MoneySchema,
    currency: Currency,
    type: z.enum(['deposit', 'withdrawal', 'transfer']),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === 'transfer' && v.fromAccount === v.toAccount) {
      ctx.addIssue({
        path: ['toAccount'],
        code: 'custom',
        message: 'Transfer accounts must differ',
      });
    }
    if (v.type === 'deposit' && v.fromAccount !== 'EXTERNAL') {
      ctx.addIssue({
        path: ['fromAccount'],
        code: 'custom',
        message: 'Deposit must originate from EXTERNAL',
      });
    }
    if (v.type === 'withdrawal' && v.toAccount !== 'EXTERNAL') {
      ctx.addIssue({
        path: ['toAccount'],
        code: 'custom',
        message: 'Withdrawal must target EXTERNAL',
      });
    }
    if (v.type === 'deposit' && v.toAccount === 'EXTERNAL') {
      ctx.addIssue({
        path: ['toAccount'],
        code: 'custom',
        message: 'Deposit destination must be an account, not EXTERNAL',
      });
    }
    if (v.type === 'withdrawal' && v.fromAccount === 'EXTERNAL') {
      ctx.addIssue({
        path: ['fromAccount'],
        code: 'custom',
        message: 'Withdrawal source must be an account, not EXTERNAL',
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export const ListFiltersSchema = z
  .object({
    accountId: AccountId.optional(),
    type: z.enum(['deposit', 'withdrawal', 'transfer']).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine(v => !(v.from && v.to) || v.from <= v.to, {
    message: 'from must be <= to',
    path: ['to'],
  });

export type ListFilters = z.infer<typeof ListFiltersSchema>;

export const TransactionSchema = z.object({
  id: z.string().regex(/^txn_[0-9A-HJKMNP-TV-Z]{26}$/),
  fromAccount: AccountIdOrExternal,
  toAccount: AccountIdOrExternal,
  amount: z.number().positive(),
  currency: Currency,
  type: z.enum(['deposit', 'withdrawal', 'transfer']),
  timestamp: z.string().datetime(),
  status: z.enum(['pending', 'completed', 'failed']),
  failureReason: FailureReason.nullable(),
});

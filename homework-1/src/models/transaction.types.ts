import { z } from 'zod';
import { TransactionSchema, CreateTransactionSchema, ListFiltersSchema } from '../validators/transaction.schemas';
import { FailureReason } from '../validators/common.schemas';

export type Transaction = z.infer<typeof TransactionSchema>;
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type ListFilters = z.infer<typeof ListFiltersSchema>;
export type TransactionStatus = Transaction['status'];
export type TransactionType = Transaction['type'];
export type FailureReasonType = z.infer<typeof FailureReason>;

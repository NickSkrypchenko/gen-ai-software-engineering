import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

extendZodWithOpenApi(z);

import {
  AccountId,
  AccountIdOrExternal,
  Currency,
  MoneySchema,
  FailureReason,
  CURRENCY_CODES,
} from '../src/validators/common.schemas';
import {
  CreateTransactionSchema,
  ListFiltersSchema,
  TransactionSchema,
} from '../src/validators/transaction.schemas';

const registry = new OpenAPIRegistry();

// ── Schemas ──────────────────────────────────────────────────────────────────

registry.register(
  'Transaction',
  TransactionSchema.openapi({ description: 'A banking transaction record' }),
);

registry.register(
  'CreateTransactionRequest',
  CreateTransactionSchema.openapi({ description: 'Request body for creating a transaction' }),
);

registry.register('ErrorDetail', z.object({
  field: z.string(),
  message: z.string(),
}).openapi({ description: 'A single validation error detail' }));

const ErrorResponse = z.object({
  error: z.string(),
  code: z.enum(['VALIDATION_ERROR', 'NOT_FOUND', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL']),
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  requestId: z.string(),
}).openapi({ description: 'Uniform error response' });

registry.register('ErrorResponse', ErrorResponse);

const BalanceEntry = z.object({
  currency: Currency,
  amount: z.number(),
}).openapi({ description: 'Balance for a single currency' });

const BalanceResponse = z.object({
  accountId: AccountId,
  balances: z.array(BalanceEntry),
  asOf: z.string().datetime(),
}).openapi({ description: 'Account balance response' });

const SummaryEntry = z.object({
  currency: Currency,
  totalDeposits: z.number(),
  totalWithdrawals: z.number(),
  transactionCount: z.number().int(),
  lastTransactionAt: z.string().datetime().nullable(),
}).openapi({ description: 'Summary for a single currency' });

const SummaryResponse = z.object({
  accountId: AccountId,
  perCurrency: z.array(SummaryEntry),
}).openapi({ description: 'Account summary response' });

// ── Paths ─────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            uptime: z.number().int(),
            version: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/transactions',
  summary: 'Create a transaction',
  tags: ['Transactions'],
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: CreateTransactionSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Transaction created (may have status=failed if business rules rejected it)',
      content: { 'application/json': { schema: TransactionSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/transactions',
  summary: 'List transactions',
  tags: ['Transactions'],
  request: {
    query: ListFiltersSchema,
  },
  responses: {
    200: {
      description: 'Paginated transaction list',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(TransactionSchema), count: z.number().int() }),
        },
      },
    },
    400: {
      description: 'Invalid filter parameters',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/transactions/export',
  summary: 'Export transactions as CSV',
  tags: ['Transactions'],
  request: {
    query: ListFiltersSchema,
  },
  responses: {
    200: {
      description: 'CSV file download',
      content: { 'text/csv': { schema: z.string() } },
    },
    400: {
      description: 'Invalid filter parameters',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/transactions/{id}',
  summary: 'Get a transaction by ID',
  tags: ['Transactions'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Transaction found',
      content: { 'application/json': { schema: TransactionSchema } },
    },
    404: {
      description: 'Transaction not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/accounts/{accountId}/balance',
  summary: 'Get account balance',
  tags: ['Accounts'],
  request: {
    params: z.object({ accountId: AccountId }),
  },
  responses: {
    200: {
      description: 'Account balance per currency',
      content: { 'application/json': { schema: BalanceResponse } },
    },
    400: {
      description: 'Invalid accountId',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/accounts/{accountId}/summary',
  summary: 'Get account transaction summary',
  tags: ['Accounts'],
  request: {
    params: z.object({ accountId: AccountId }),
  },
  responses: {
    200: {
      description: 'Account summary per currency',
      content: { 'application/json': { schema: SummaryResponse } },
    },
    400: {
      description: 'Invalid accountId',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

// ── Generate ──────────────────────────────────────────────────────────────────

const generator = new OpenApiGeneratorV31(registry.definitions);

const doc = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Banking Transactions API',
    version: '1.0.0',
    description: 'REST API for banking transactions — Homework 1',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
});

const outPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, yaml.dump(doc, { noRefs: true, lineWidth: 120 }));
console.log(`OpenAPI spec written to ${outPath}`);

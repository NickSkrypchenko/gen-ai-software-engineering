import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';

extendZodWithOpenApi(z);

import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TransitionRequestSchema,
  ListFiltersSchema,
} from '../src/validators/ticket.schemas';
import { ImportQuerySchema } from '../src/validators/import.schemas';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../src/domain/ticket';

const registry = new OpenAPIRegistry();

// ── Shared schemas ────────────────────────────────────────────────────────────
const TicketIdParam = z.string().uuid().openapi({ description: 'Ticket UUID (v7)' });

const TicketSchema = registry.register(
  'Ticket',
  z.object({
    id:             z.string().uuid(),
    customer_id:    z.string(),
    customer_email: z.string().email(),
    customer_name:  z.string(),
    subject:        z.string(),
    description:    z.string(),
    category:       z.enum(TICKET_CATEGORIES),
    priority:       z.enum(TICKET_PRIORITIES),
    status:         z.enum(TICKET_STATUSES),
    created_at:     z.string().datetime(),
    updated_at:     z.string().datetime(),
    resolved_at:    z.string().datetime().nullable(),
    assigned_to:    z.string().nullable(),
    tags:           z.array(z.string()),
    metadata:       z.object({ source: z.string() }),
    version:        z.number().int(),
  }).openapi({ title: 'Ticket' }),
);

const ClassificationResultSchema = registry.register(
  'ClassificationResult',
  z.object({
    category:         z.enum(TICKET_CATEGORIES),
    priority:         z.enum(TICKET_PRIORITIES),
    confidence:       z.number().min(0).max(1),
    reasoning:        z.string(),
    matched_keywords: z.array(z.string()),
    source:           z.string(),
    classified_at:    z.string().datetime(),
  }).openapi({ title: 'ClassificationResult' }),
);

const TransitionSchema = registry.register(
  'Transition',
  z.object({
    id:          z.string().uuid(),
    ticket_id:   z.string().uuid(),
    from_status: z.enum(TICKET_STATUSES).nullable(),
    to_status:   z.enum(TICKET_STATUSES),
    changed_at:  z.string().datetime(),
    changed_by:  z.string().nullable(),
    reason:      z.string().nullable(),
  }).openapi({ title: 'Transition' }),
);

const ImportSummarySchema = registry.register(
  'ImportSummary',
  z.object({
    total:           z.number().int(),
    succeeded:       z.number().int(),
    failed:          z.array(z.object({
      row:     z.number().int(),
      stage:   z.enum(['parse', 'validate', 'insert']),
      field:   z.string().optional(),
      message: z.string(),
    })),
    ticket_ids:      z.array(z.string().uuid()),
    auto_classified: z.number().int().optional(),
  }).openapi({ title: 'ImportSummary' }),
);

const ErrorSchema = registry.register(
  'Error',
  z.object({
    error:     z.string(),
    code:      z.string(),
    requestId: z.string().optional(),
    details:   z.array(z.unknown()).optional(),
  }).openapi({ title: 'Error' }),
);

const ticketIdPath = { in: 'path' as const, name: 'id', required: true, schema: TicketIdParam };

const ifMatchHeader = {
  in: 'header' as const,
  name: 'If-Match',
  required: true,
  description: 'Current ticket version: "1"',
  schema: z.string(),
};

const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorSchema } },
});

// ── Endpoints ─────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post', path: '/api/tickets',
  summary: 'Create a ticket',
  request: {
    query: z.object({ auto_classify: z.boolean().optional() }),
    body: { content: { 'application/json': { schema: CreateTicketSchema } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: TicketSchema } } },
    400: err('Validation error'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/tickets',
  summary: 'List tickets',
  request: { query: ListFiltersSchema },
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data:  z.array(TicketSchema),
            count: z.number().int(),
            page:  z.number().int(),
          }),
        },
      },
    },
    400: err('Invalid filter value'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/tickets/{id}',
  summary: 'Get ticket by ID',
  request: { params: z.object({ id: TicketIdParam }) },
  responses: {
    200: { description: 'Ticket', content: { 'application/json': { schema: TicketSchema } } },
    404: err('Not found'),
  },
});

registry.registerPath({
  method: 'put', path: '/api/tickets/{id}',
  summary: 'Update ticket (partial)',
  request: {
    params:  z.object({ id: TicketIdParam }),
    headers: z.object({ 'If-Match': z.string() }),
    body:    { content: { 'application/json': { schema: UpdateTicketSchema } } },
  },
  responses: {
    200: { description: 'Updated ticket', content: { 'application/json': { schema: TicketSchema } } },
    404: err('Not found'), 412: err('Version conflict'), 428: err('If-Match required'),
  },
});

registry.registerPath({
  method: 'delete', path: '/api/tickets/{id}',
  summary: 'Delete ticket',
  request: {
    params:  z.object({ id: TicketIdParam }),
    headers: z.object({ 'If-Match': z.string() }),
  },
  responses: { 204: { description: 'Deleted' }, 404: err('Not found'), 412: err('Version conflict'), 428: err('If-Match required') },
});

registry.registerPath({
  method: 'post', path: '/api/tickets/{id}/transitions',
  summary: 'Transition ticket status',
  request: {
    params:  z.object({ id: TicketIdParam }),
    headers: z.object({ 'If-Match': z.string() }),
    body:    { content: { 'application/json': { schema: TransitionRequestSchema } } },
  },
  responses: {
    200: { description: 'Transitioned ticket', content: { 'application/json': { schema: TicketSchema } } },
    404: err('Not found'), 412: err('Version conflict'), 422: err('Invalid transition'), 428: err('If-Match required'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/tickets/{id}/auto-classify',
  summary: 'Auto-classify ticket',
  request: {
    params:  z.object({ id: TicketIdParam }),
    headers: z.object({ 'If-Match': z.string() }),
  },
  responses: {
    200: { description: 'Classification result', content: { 'application/json': { schema: ClassificationResultSchema } } },
    404: err('Not found'), 412: err('Version conflict'), 428: err('If-Match required'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/tickets/{id}/transitions',
  summary: 'Get transition audit log',
  request: { params: z.object({ id: TicketIdParam }) },
  responses: {
    200: { description: 'Transitions (newest first)', content: { 'application/json': { schema: z.array(TransitionSchema) } } },
    404: err('Not found'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/tickets/{id}/classifications',
  summary: 'Get classification history',
  request: { params: z.object({ id: TicketIdParam }) },
  responses: {
    200: { description: 'Classifications (newest first)', content: { 'application/json': { schema: z.array(ClassificationResultSchema) } } },
    404: err('Not found'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/tickets/import',
  summary: 'Bulk import tickets from file',
  request: {
    query: ImportQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any().openapi({ type: 'string', format: 'binary' }) }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Import summary', content: { 'application/json': { schema: ImportSummarySchema } } },
    400: err('Parse error or missing format'), 413: err('File too large'), 415: err('Not multipart'),
  },
});

registry.registerPath({
  method: 'get', path: '/health',
  summary: 'Health check',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({ status: z.string(), uptime: z.number(), db: z.string() }),
        },
      },
    },
  },
});

// ── Generate ──────────────────────────────────────────────────────────────────
const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title:       'Customer Support API',
    version:     '1.0.0',
    description: 'Intelligent Customer Support Ticket System — Homework 2',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
    { url: 'https://customer-support-api.vercel.app', description: 'Production' },
  ],
});

mkdirSync(resolve('docs'), { recursive: true });
writeFileSync(resolve('docs/openapi.yaml'), YAML.stringify(doc));
console.log('docs/openapi.yaml written');

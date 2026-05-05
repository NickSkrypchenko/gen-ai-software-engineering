import { pgTable, pgEnum, uuid, varchar, text, integer, real, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketMetadata,
} from '../domain/ticket';

// ── Postgres enums (single source of truth: domain/ticket.ts arrays) ─────────
export const categoryEnum = pgEnum('ticket_category', TICKET_CATEGORIES);
export const priorityEnum = pgEnum('ticket_priority', TICKET_PRIORITIES);
export const statusEnum   = pgEnum('ticket_status',   TICKET_STATUSES);

// ── tickets ───────────────────────────────────────────────────────────────────
export const tickets = pgTable(
  'tickets',
  {
    id:             uuid('id').primaryKey(),
    customerId:     varchar('customer_id',    { length: 64  }).notNull(),
    customerEmail:  varchar('customer_email', { length: 255 }).notNull(),
    customerName:   varchar('customer_name',  { length: 200 }).notNull(),
    subject:        varchar('subject',        { length: 200 }).notNull(),
    description:    text('description').notNull(),
    category:       categoryEnum('category').notNull().default('other'),
    priority:       priorityEnum('priority').notNull().default('medium'),
    status:         statusEnum('status').notNull().default('new'),
    createdAt:      timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp('updated_at',  { withTimezone: true }).notNull().defaultNow(),
    resolvedAt:     timestamp('resolved_at', { withTimezone: true }),
    assignedTo:     varchar('assigned_to', { length: 200 }),
    tags:           text('tags').array().notNull().default(sql`'{}'`),
    metadata:       jsonb('metadata').$type<TicketMetadata>().notNull().default({ source: 'api' }),
    version:        integer('version').notNull().default(1),
  },
  (t) => [
    index('ix_tickets_customer_email').on(t.customerEmail),
    index('ix_tickets_status_priority').on(t.status, t.priority),
    index('ix_tickets_created_at').on(t.createdAt),
    index('ix_tickets_category').on(t.category),
    check('subject_len',     sql`char_length(${t.subject})     BETWEEN 1 AND 200`),
    check('description_len', sql`char_length(${t.description}) BETWEEN 10 AND 2000`),
    check('email_format',    sql`${t.customerEmail} ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`),
  ],
);

// ── ticket_transitions (append-only audit log) ────────────────────────────────
export const ticketTransitions = pgTable(
  'ticket_transitions',
  {
    id:          uuid('id').primaryKey(),
    ticketId:    uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    fromStatus:  statusEnum('from_status'),
    toStatus:    statusEnum('to_status').notNull(),
    changedAt:   timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    changedBy:   varchar('changed_by', { length: 200 }),
    reason:      text('reason'),
  },
  (t) => [
    index('ix_transitions_ticket').on(t.ticketId, t.changedAt),
  ],
);

// ── classifications (append-only history) ─────────────────────────────────────
export const classifications = pgTable(
  'classifications',
  {
    id:              uuid('id').primaryKey(),
    ticketId:        uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    category:        categoryEnum('category').notNull(),
    priority:        priorityEnum('priority').notNull(),
    confidence:      real('confidence').notNull(),
    reasoning:       text('reasoning').notNull(),
    matchedKeywords: text('matched_keywords').array().notNull().default(sql`'{}'`),
    source:          varchar('source', { length: 32 }).notNull(),
    classifiedAt:    timestamp('classified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ix_classifications_ticket').on(t.ticketId, t.classifiedAt),
    check('confidence_range', sql`${t.confidence} BETWEEN 0 AND 1`),
  ],
);

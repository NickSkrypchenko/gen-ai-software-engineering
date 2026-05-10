import { eq, and, gte, lte, ilike, sql, desc } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client';
import { tickets, ticketTransitions, classifications } from '../db/schema';
import type { TicketRow } from '../db/types';
import type { CreateTicketInput, UpdateTicketInput, ListFilters } from '../validators/ticket.schemas';
import type { TicketStatus } from '../domain/ticket';
import { clock } from '../utils/clock';
import {
  NotFoundError,
  VersionConflictError,
} from '../utils/http-errors';

export type InsertError = { rowIndex: number; message: string };

function extractDbErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// Maps a DB row to a camelCase-free, snake_case API object
export function rowToTicket(row: TicketRow) {
  return {
    id:             row.id,
    customer_id:    row.customerId,
    customer_email: row.customerEmail,
    customer_name:  row.customerName,
    subject:        row.subject,
    description:    row.description,
    category:       row.category,
    priority:       row.priority,
    status:         row.status,
    created_at:     row.createdAt,
    updated_at:     row.updatedAt,
    resolved_at:    row.resolvedAt ?? null,
    assigned_to:    row.assignedTo ?? null,
    tags:           row.tags,
    metadata:       row.metadata,
    version:        row.version,
  };
}

export const ticketRepository = {
  async create(input: CreateTicketInput & { auto_classify?: boolean }) {
    const now = clock.now();
    const [row] = await db.insert(tickets).values({
      id:            uuidv7(),
      customerId:    input.customer_id,
      customerEmail: input.customer_email,
      customerName:  input.customer_name,
      subject:       input.subject,
      description:   input.description,
      category:      input.category ?? 'other',
      priority:      input.priority ?? 'medium',
      status:        'new',
      createdAt:     now,
      updatedAt:     now,
      assignedTo:    input.assigned_to ?? null,
      tags:          input.tags ?? [],
      metadata:      input.metadata,
      version:       1,
    }).returning();
    // Initial transition log entry
    await db.insert(ticketTransitions).values({
      id:         uuidv7(),
      ticketId:   row.id,
      fromStatus: null,
      toStatus:   'new',
      changedAt:  now,
      changedBy:  'system',
      reason:     'Ticket created',
    });
    return rowToTicket(row);
  },

  async findById(id: string) {
    const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!row) throw new NotFoundError(id);
    return rowToTicket(row);
  },

  async list(filters: ListFilters) {
    const conditions = [];
    if (filters.status)      conditions.push(eq(tickets.status, filters.status));
    if (filters.category)    conditions.push(eq(tickets.category, filters.category));
    if (filters.priority)    conditions.push(eq(tickets.priority, filters.priority));
    if (filters.assigned_to) conditions.push(eq(tickets.assignedTo, filters.assigned_to));
    if (filters.customer_id) conditions.push(eq(tickets.customerId, filters.customer_id));
    if (filters.from)        conditions.push(gte(tickets.createdAt, new Date(filters.from)));
    if (filters.to)          conditions.push(lte(tickets.createdAt, new Date(filters.to)));
    if (filters.q)           conditions.push(ilike(tickets.subject, `%${filters.q}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(tickets)
        .where(where)
        .orderBy(desc(tickets.createdAt))
        .limit(filters.limit)
        .offset(filters.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(tickets).where(where),
    ]);

    return { data: rows.map(rowToTicket), count, page: filters.offset };
  },

  async update(id: string, expectedVersion: number, input: UpdateTicketInput) {
    const now = clock.now();

    // Build the update set using Drizzle's expected partial type
    type TicketUpdate = Parameters<ReturnType<typeof db.update<typeof tickets>>['set']>[0];
    const updateData: TicketUpdate = {
      updatedAt: now,
      version:   sql`${tickets.version} + 1`,
    };
    if (input.customer_name !== undefined) updateData.customerName = input.customer_name;
    if (input.subject       !== undefined) updateData.subject      = input.subject;
    if (input.description   !== undefined) updateData.description  = input.description;
    if (input.category      !== undefined) updateData.category     = input.category;
    if (input.priority      !== undefined) updateData.priority     = input.priority;
    if ('assigned_to' in input)            updateData.assignedTo   = input.assigned_to ?? null;
    if (input.tags          !== undefined) updateData.tags         = input.tags;
    if (input.metadata      !== undefined) updateData.metadata     = input.metadata as typeof updateData.metadata;

    const [updated] = await db.update(tickets)
      .set(updateData)
      .where(and(eq(tickets.id, id), eq(tickets.version, expectedVersion)))
      .returning();

    if (!updated) {
      const [current] = await db.select({ version: tickets.version }).from(tickets).where(eq(tickets.id, id));
      if (!current) throw new NotFoundError(id);
      throw new VersionConflictError(current.version, expectedVersion);
    }
    return rowToTicket(updated);
  },

  async delete(id: string, expectedVersion: number) {
    const [deleted] = await db.delete(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.version, expectedVersion)))
      .returning({ id: tickets.id });

    if (!deleted) {
      const [current] = await db.select({ version: tickets.version }).from(tickets).where(eq(tickets.id, id));
      if (!current) throw new NotFoundError(id);
      throw new VersionConflictError(current.version, expectedVersion);
    }
  },

  async transition(
    ticketId: string,
    to: TicketStatus,
    expectedVersion: number,
    resolvedAt: Date | null,
    reason?: string,
    by?: string,
  ) {
    return await db.transaction(async (tx) => {
      // 0. Lock row + verify version
      const [current] = await tx.select().from(tickets)
        .where(eq(tickets.id, ticketId))
        .for('update');
      if (!current) throw new NotFoundError(ticketId);
      if (current.version !== expectedVersion)
        throw new VersionConflictError(current.version, expectedVersion);

      const now = clock.now();

      // 1. Update ticket + bump version
      const [updated] = await tx.update(tickets)
        .set({
          status:     to,
          updatedAt:  now,
          resolvedAt: resolvedAt,
          version:    sql`${tickets.version} + 1`,
        })
        .where(and(eq(tickets.id, ticketId), eq(tickets.version, expectedVersion)))
        .returning();

      // 2. Append audit log (same transaction — atomic)
      await tx.insert(ticketTransitions).values({
        id:         uuidv7(),
        ticketId,
        fromStatus: current.status,
        toStatus:   to,
        changedAt:  now,
        changedBy:  by ?? 'system',
        reason,
      });

      return rowToTicket(updated);
    });
  },

  // Per-row SAVEPOINTs — partial success is intentional (spec §4.6)
  async bulkInsert(rows: CreateTicketInput[]): Promise<{ inserted: ReturnType<typeof rowToTicket>[]; insertErrors: InsertError[] }> {
    const inserted: ReturnType<typeof rowToTicket>[] = [];
    const insertErrors: InsertError[] = [];

    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        try {
          await tx.execute(sql.raw(`SAVEPOINT row_${i}`));
          const now = clock.now();
          const [t] = await tx.insert(tickets).values({
            id:            uuidv7(),
            customerId:    rows[i].customer_id,
            customerEmail: rows[i].customer_email,
            customerName:  rows[i].customer_name,
            subject:       rows[i].subject,
            description:   rows[i].description,
            category:      rows[i].category ?? 'other',
            priority:      rows[i].priority ?? 'medium',
            status:        'new',
            createdAt:     now,
            updatedAt:     now,
            assignedTo:    rows[i].assigned_to ?? null,
            tags:          rows[i].tags ?? [],
            metadata:      rows[i].metadata,
            version:       1,
          }).returning();
          await tx.execute(sql.raw(`RELEASE SAVEPOINT row_${i}`));
          inserted.push(rowToTicket(t));
        } catch (e) {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT row_${i}`));
          insertErrors.push({ rowIndex: i + 1, message: extractDbErrorMessage(e) });
        }
      }
    });

    return { inserted, insertErrors };
  },
};

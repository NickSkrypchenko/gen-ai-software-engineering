import { describe, test, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { ticketRepository } from '../../src/repository/ticket.repository';

const makeRow = (n: number) => ({
  customer_id:    `CUST-${n}`,
  customer_email: `user${n}@example.com`,
  customer_name:  `User ${n}`,
  subject:        `Issue number ${n}`,
  description:    `Description for issue ${n} — at least 10 chars.`,
  category:       'other' as const,
  priority:       'medium' as const,
  tags:           [],
  metadata:       { source: 'api' as const },
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('ticketRepository.bulkInsert()', () => {
  test('inserts all valid rows and returns them', async () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    const { inserted, insertErrors } = await ticketRepository.bulkInsert(rows);
    expect(inserted).toHaveLength(3);
    expect(insertErrors).toHaveLength(0);
    inserted.forEach(t => {
      expect(t.id).toBeDefined();
      expect(t.version).toBe(1);
    });
  });

  test('returns unique ids for all inserted rows', async () => {
    const rows = [makeRow(10), makeRow(11), makeRow(12)];
    const { inserted } = await ticketRepository.bulkInsert(rows);
    const ids = inserted.map(t => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('returns empty arrays for empty input', async () => {
    const { inserted, insertErrors } = await ticketRepository.bulkInsert([]);
    expect(inserted).toHaveLength(0);
    expect(insertErrors).toHaveLength(0);
  });
});

describe('ticketRepository.list() — extended filter coverage', () => {
  beforeEach(async () => {
    // Create a mix of tickets for filtering
    await ticketRepository.create({ ...makeRow(100), priority: 'urgent', category: 'bug_report', assigned_to: 'agent-alice' });
    await ticketRepository.create({ ...makeRow(101), priority: 'low',    category: 'billing_question', customer_id: 'VIP-001' });
  });

  test('filters by priority', async () => {
    const r = await ticketRepository.list({ priority: 'urgent', limit: 50, offset: 0 });
    expect(r.count).toBe(1);
    expect(r.data[0].priority).toBe('urgent');
  });

  test('filters by category', async () => {
    const r = await ticketRepository.list({ category: 'billing_question', limit: 50, offset: 0 });
    expect(r.count).toBe(1);
  });

  test('filters by assigned_to', async () => {
    const r = await ticketRepository.list({ assigned_to: 'agent-alice', limit: 50, offset: 0 });
    expect(r.count).toBe(1);
  });

  test('filters by customer_id', async () => {
    const r = await ticketRepository.list({ customer_id: 'VIP-001', limit: 50, offset: 0 });
    expect(r.count).toBe(1);
  });

  test('filters by q (full-text subject search)', async () => {
    const r = await ticketRepository.list({ q: 'Issue number 100', limit: 50, offset: 0 });
    expect(r.count).toBe(1);
  });

  test('respects pagination offset', async () => {
    const r = await ticketRepository.list({ limit: 1, offset: 1 });
    expect(r.data).toHaveLength(1);
  });

  test('filters by from/to date range', async () => {
    const r = await ticketRepository.list({
      from:  '2025-01-01T00:00:00.000Z',
      to:    '2030-12-31T00:00:00.000Z',
      limit: 50, offset: 0,
    });
    expect(r.count).toBe(2);
  });
});

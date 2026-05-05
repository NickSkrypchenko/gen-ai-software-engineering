import { describe, test, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tickets, ticketTransitions, classifications } from '../../src/db/schema';
import { ticketRepository } from '../../src/repository/ticket.repository';

const VALID_INPUT = {
  customer_id:    'CUST-001',
  customer_email: 'alice@example.com',
  customer_name:  'Alice Johnson',
  subject:        'Cannot log in',
  description:    'After resetting my password I get a 500 on submit.',
  category:       'account_access' as const,
  priority:       'high' as const,
  tags:           ['login', 'auth'],
  metadata:       { source: 'web_form' as const },
};

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('ticketRepository.create()', () => {
  test('creates a ticket and returns a mapped API object', async () => {
    const ticket = await ticketRepository.create(VALID_INPUT);
    expect(ticket.id).toBeDefined();
    expect(ticket.customer_email).toBe('alice@example.com');
    expect(ticket.status).toBe('new');
    expect(ticket.version).toBe(1);
    expect(ticket.resolved_at).toBeNull();
  });

  test('inserts an initial transition log entry', async () => {
    const ticket = await ticketRepository.create(VALID_INPUT);
    const rows = await db.select().from(ticketTransitions)
      .where(sql`ticket_id = ${ticket.id}::uuid`);
    expect(rows).toHaveLength(1);
    expect(rows[0].fromStatus).toBeNull();
    expect(rows[0].toStatus).toBe('new');
  });
});

describe('ticketRepository.findById()', () => {
  test('returns the ticket by id', async () => {
    const created = await ticketRepository.create(VALID_INPUT);
    const found   = await ticketRepository.findById(created.id);
    expect(found.id).toBe(created.id);
  });

  test('throws NotFoundError for unknown id', async () => {
    await expect(ticketRepository.findById('00000000-0000-7000-8000-000000000000'))
      .rejects.toThrow('not found');
  });
});

describe('ticketRepository.list()', () => {
  test('returns all tickets with default pagination', async () => {
    await ticketRepository.create(VALID_INPUT);
    await ticketRepository.create({ ...VALID_INPUT, customer_id: 'CUST-002', subject: 'Another issue' });
    const result = await ticketRepository.list({ limit: 50, offset: 0 });
    expect(result.count).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  test('filters by status', async () => {
    await ticketRepository.create(VALID_INPUT);
    const result = await ticketRepository.list({ status: 'new', limit: 50, offset: 0 });
    expect(result.count).toBe(1);
    result.data.forEach(t => expect(t.status).toBe('new'));
  });
});

describe('ticketRepository.update()', () => {
  test('updates fields and bumps version', async () => {
    const ticket  = await ticketRepository.create(VALID_INPUT);
    const updated = await ticketRepository.update(ticket.id, 1, { subject: 'Updated subject' });
    expect(updated.subject).toBe('Updated subject');
    expect(updated.version).toBe(2);
  });

  test('throws VersionConflictError on stale version', async () => {
    const ticket = await ticketRepository.create(VALID_INPUT);
    await expect(ticketRepository.update(ticket.id, 99, { subject: 'x' }))
      .rejects.toThrow('Version conflict');
  });
});

describe('ticketRepository.delete()', () => {
  test('removes the ticket', async () => {
    const ticket = await ticketRepository.create(VALID_INPUT);
    await ticketRepository.delete(ticket.id, 1);
    await expect(ticketRepository.findById(ticket.id)).rejects.toThrow('not found');
  });

  test('throws VersionConflictError on stale version', async () => {
    const ticket = await ticketRepository.create(VALID_INPUT);
    await expect(ticketRepository.delete(ticket.id, 99)).rejects.toThrow('Version conflict');
  });
});

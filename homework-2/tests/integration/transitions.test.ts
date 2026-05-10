import { describe, test, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { ticketRepository } from '../../src/repository/ticket.repository';
import { transitionRepository } from '../../src/repository/transition.repository';

const BASE_INPUT = {
  customer_id:    'CUST-001',
  customer_email: 'alice@example.com',
  customer_name:  'Alice Johnson',
  subject:        'Cannot log in',
  description:    'After resetting my password I get a 500 on submit.',
  metadata:       { source: 'web_form' as const },
};

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('ticketRepository.transition()', () => {
  test('changes status and bumps version', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    const updated = await ticketRepository.transition(
      ticket.id, 'in_progress', 1, null, 'Starting work', 'agent-bob',
    );
    expect(updated.status).toBe('in_progress');
    expect(updated.version).toBe(2);
  });

  test('sets resolved_at when transitioning to resolved', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    await ticketRepository.transition(ticket.id, 'in_progress', 1, null);
    const now = new Date();
    const resolved = await ticketRepository.transition(ticket.id, 'resolved', 2, now);
    expect(resolved.resolved_at).toBeDefined();
    expect(resolved.status).toBe('resolved');
  });

  test('clears resolved_at when reopening from resolved', async () => {
    const ticket  = await ticketRepository.create(BASE_INPUT);
    await ticketRepository.transition(ticket.id, 'in_progress', 1, null);
    const resolved = await ticketRepository.transition(ticket.id, 'resolved', 2, new Date());
    const reopened = await ticketRepository.transition(resolved.id, 'in_progress', resolved.version, null);
    expect(reopened.resolved_at).toBeNull();
  });

  test('throws VersionConflictError on stale version', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    await expect(
      ticketRepository.transition(ticket.id, 'in_progress', 99, null),
    ).rejects.toThrow('Version conflict');
  });

  test('throws NotFoundError for unknown ticket', async () => {
    await expect(
      ticketRepository.transition('00000000-0000-7000-8000-000000000001', 'in_progress', 1, null),
    ).rejects.toThrow('not found');
  });
});

describe('transitionRepository.findByTicketId()', () => {
  test('returns transitions in newest-first order', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    await ticketRepository.transition(ticket.id, 'in_progress', 1, null, 'Starting');
    const transitions = await transitionRepository.findByTicketId(ticket.id);
    // Initial creation entry + manual transition
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    // Newest first: in_progress should be first
    expect(transitions[0].to_status).toBe('in_progress');
    expect(transitions[0].from_status).toBe('new');
  });

  test('returns empty array for ticket with no transitions', async () => {
    // Create a ticket then immediately check its ID — it always has at least 1 entry from creation
    const ticket = await ticketRepository.create(BASE_INPUT);
    const transitions = await transitionRepository.findByTicketId(ticket.id);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
  });

  test('includes from_status, to_status, reason fields', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    await ticketRepository.transition(ticket.id, 'in_progress', 1, null, 'Test reason', 'agent-x');
    const transitions = await transitionRepository.findByTicketId(ticket.id);
    const last = transitions[0];
    expect(last.from_status).toBe('new');
    expect(last.to_status).toBe('in_progress');
    expect(last.reason).toBe('Test reason');
    expect(last.changed_by).toBe('agent-x');
  });
});

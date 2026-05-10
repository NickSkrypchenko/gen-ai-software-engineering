import { describe, test, expect } from 'vitest';
import { canTransition, allowedTransitions, transition } from './ticket-state-machine';
import type { Ticket, TicketStatus } from './ticket';

const STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

function makeTicket(status: TicketStatus, resolvedAt: Date | null = null): Ticket {
  return {
    id:             'test-id',
    customer_id:    'CUST-1',
    customer_email: 'a@b.com',
    customer_name:  'Test User',
    subject:        'Test',
    description:    'Test description here',
    category:       'other',
    priority:       'medium',
    status,
    created_at:     new Date('2026-01-01'),
    updated_at:     new Date('2026-01-01'),
    resolved_at:    resolvedAt,
    assigned_to:    null,
    tags:           [],
    metadata:       { source: 'api' },
    version:        1,
  };
}

describe('canTransition() — full 5×5 matrix', () => {
  // Allowed
  test('new → in_progress allowed', () => expect(canTransition('new', 'in_progress')).toBe(true));
  test('in_progress → waiting_customer allowed', () => expect(canTransition('in_progress', 'waiting_customer')).toBe(true));
  test('in_progress → resolved allowed', () => expect(canTransition('in_progress', 'resolved')).toBe(true));
  test('waiting_customer → in_progress allowed', () => expect(canTransition('waiting_customer', 'in_progress')).toBe(true));
  test('waiting_customer → resolved allowed', () => expect(canTransition('waiting_customer', 'resolved')).toBe(true));
  test('resolved → in_progress (reopen) allowed', () => expect(canTransition('resolved', 'in_progress')).toBe(true));
  test('resolved → closed allowed', () => expect(canTransition('resolved', 'closed')).toBe(true));
  test('closed → in_progress (reopen) allowed', () => expect(canTransition('closed', 'in_progress')).toBe(true));

  // Disallowed — sample of all cells not in the allowed list
  test('new → new disallowed', () => expect(canTransition('new', 'new')).toBe(false));
  test('new → waiting_customer disallowed', () => expect(canTransition('new', 'waiting_customer')).toBe(false));
  test('new → resolved disallowed', () => expect(canTransition('new', 'resolved')).toBe(false));
  test('new → closed disallowed', () => expect(canTransition('new', 'closed')).toBe(false));
  test('in_progress → new disallowed', () => expect(canTransition('in_progress', 'new')).toBe(false));
  test('in_progress → in_progress disallowed', () => expect(canTransition('in_progress', 'in_progress')).toBe(false));
  test('in_progress → closed disallowed', () => expect(canTransition('in_progress', 'closed')).toBe(false));
  test('waiting_customer → new disallowed', () => expect(canTransition('waiting_customer', 'new')).toBe(false));
  test('waiting_customer → waiting_customer disallowed', () => expect(canTransition('waiting_customer', 'waiting_customer')).toBe(false));
  test('waiting_customer → closed disallowed', () => expect(canTransition('waiting_customer', 'closed')).toBe(false));
  test('resolved → new disallowed', () => expect(canTransition('resolved', 'new')).toBe(false));
  test('resolved → waiting_customer disallowed', () => expect(canTransition('resolved', 'waiting_customer')).toBe(false));
  test('resolved → resolved disallowed', () => expect(canTransition('resolved', 'resolved')).toBe(false));
  test('closed → new disallowed', () => expect(canTransition('closed', 'new')).toBe(false));
  test('closed → waiting_customer disallowed', () => expect(canTransition('closed', 'waiting_customer')).toBe(false));
  test('closed → resolved disallowed', () => expect(canTransition('closed', 'resolved')).toBe(false));
  test('closed → closed disallowed', () => expect(canTransition('closed', 'closed')).toBe(false));
});

describe('allowedTransitions()', () => {
  test('returns correct allowed list for each status', () => {
    expect(allowedTransitions('new')).toEqual(['in_progress']);
    expect(allowedTransitions('in_progress')).toEqual(['waiting_customer', 'resolved']);
    expect(allowedTransitions('waiting_customer')).toEqual(['in_progress', 'resolved']);
    expect(allowedTransitions('resolved')).toEqual(['in_progress', 'closed']);
    expect(allowedTransitions('closed')).toEqual(['in_progress']);
  });
});

describe('transition() side effects', () => {
  const now = new Date('2026-05-01T12:00:00Z');

  test('sets resolved_at = now when transitioning to resolved', () => {
    const result = transition(makeTicket('in_progress'), 'resolved', now);
    expect(result.ticket.resolved_at).toEqual(now);
    expect(result.ticket.status).toBe('resolved');
  });

  test('clears resolved_at when reopening from resolved', () => {
    const ticket = makeTicket('resolved', now);
    const result = transition(ticket, 'in_progress', now);
    expect(result.ticket.resolved_at).toBeNull();
  });

  test('clears resolved_at when reopening from closed', () => {
    const ticket = makeTicket('closed', now);
    const result = transition(ticket, 'in_progress', now);
    expect(result.ticket.resolved_at).toBeNull();
  });

  test('preserves resolved_at when not touching resolved/closed', () => {
    const resolvedAt = new Date('2026-04-01');
    const ticket = makeTicket('waiting_customer', resolvedAt);
    // waiting_customer → in_progress should not change resolved_at
    const result = transition(ticket, 'in_progress', now);
    expect(result.ticket.resolved_at).toEqual(resolvedAt);
  });

  test('returns correct from/to/at fields', () => {
    const result = transition(makeTicket('new'), 'in_progress', now);
    expect(result.from).toBe('new');
    expect(result.to).toBe('in_progress');
    expect(result.at).toEqual(now);
  });

  test('throws InvalidTransitionError on illegal transition', () => {
    expect(() => transition(makeTicket('closed'), 'resolved', now)).toThrow();
  });

  test('updates ticket.updated_at to now', () => {
    const result = transition(makeTicket('new'), 'in_progress', now);
    expect(result.ticket.updated_at).toEqual(now);
  });

  test('most-recent resolved_at: resolving again after reopen updates the timestamp', () => {
    const firstResolution = new Date('2026-04-01T10:00:00Z');
    const secondResolution = new Date('2026-05-01T12:00:00Z');
    // Ticket was resolved once (resolved_at = firstResolution), then reopened (resolved_at = null)
    const reopened = makeTicket('in_progress', null);
    const result = transition(reopened, 'resolved', secondResolution);
    expect(result.ticket.resolved_at).toEqual(secondResolution);
  });
});

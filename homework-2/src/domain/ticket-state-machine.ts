// Pure state machine — no I/O, implemented in Phase 1
import type { Ticket, TicketStatus } from './ticket';
import { InvalidTransitionError } from '../utils/http-errors';

export interface TransitionResult {
  from:   TicketStatus;
  to:     TicketStatus;
  at:     Date;
  ticket: Ticket;
}

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new:              ['in_progress'],
  in_progress:      ['waiting_customer', 'resolved'],
  waiting_customer: ['in_progress', 'resolved'],
  resolved:         ['in_progress', 'closed'],
  closed:           ['in_progress'],
};

export function allowedTransitions(from: TicketStatus): TicketStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(ticket: Ticket, to: TicketStatus, now: Date): TransitionResult {
  if (!canTransition(ticket.status, to)) {
    throw new InvalidTransitionError(ticket.status, to, allowedTransitions(ticket.status));
  }

  const resolved_at =
    to === 'resolved'
      ? now
      : to === 'closed'
        ? ticket.resolved_at                                            // resolved→closed: preserve (finalize, not reopen)
        : ticket.status === 'resolved' || ticket.status === 'closed'
          ? null                                                        // reopen: clear
          : ticket.resolved_at;

  return {
    from:   ticket.status,
    to,
    at:     now,
    ticket: { ...ticket, status: to, resolved_at, updated_at: now },
  };
}

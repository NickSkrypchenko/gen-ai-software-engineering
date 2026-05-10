import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { ticketTransitions } from '../db/schema';

export const transitionRepository = {
  async findByTicketId(ticketId: string) {
    const rows = await db.select()
      .from(ticketTransitions)
      .where(eq(ticketTransitions.ticketId, ticketId))
      .orderBy(desc(ticketTransitions.changedAt));

    return rows.map(r => ({
      id:          r.id,
      ticket_id:   r.ticketId,
      from_status: r.fromStatus ?? null,
      to_status:   r.toStatus,
      changed_at:  r.changedAt,
      changed_by:  r.changedBy ?? null,
      reason:      r.reason ?? null,
    }));
  },
};

import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { classifications } from '../db/schema';

// Read-only. Inserts happen in classify.service.ts inside transactions.
export const classificationRepository = {
  async findByTicketId(ticketId: string) {
    const rows = await db.select()
      .from(classifications)
      .where(eq(classifications.ticketId, ticketId))
      .orderBy(desc(classifications.classifiedAt));

    return rows.map(r => ({
      id:               r.id,
      ticket_id:        r.ticketId,
      category:         r.category,
      priority:         r.priority,
      confidence:       r.confidence,
      reasoning:        r.reasoning,
      matched_keywords: r.matchedKeywords,
      source:           r.source,
      classified_at:    r.classifiedAt,
    }));
  },
};

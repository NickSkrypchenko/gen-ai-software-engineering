import { eq, and, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client';
import { tickets, classifications } from '../db/schema';
import { classify } from '../domain/classifier';
import { clock } from '../utils/clock';
import { NotFoundError, VersionConflictError } from '../utils/http-errors';
import { rowToTicket } from '../repository/ticket.repository';

export const classifyService = {
  async autoClassify(ticketId: string, expectedVersion: number) {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(tickets)
        .where(eq(tickets.id, ticketId))
        .for('update');
      if (!current) throw new NotFoundError(ticketId);
      if (current.version !== expectedVersion)
        throw new VersionConflictError(current.version, expectedVersion);

      const text   = `${current.subject} ${current.description}`;
      const result = classify(text);
      const now    = clock.now();

      await tx.insert(classifications).values({
        id:              uuidv7(),
        ticketId,
        category:        result.category,
        priority:        result.priority,
        confidence:      result.confidence,
        reasoning:       result.reasoning,
        matchedKeywords: result.matchedKeywords,
        source:          'rules',
        classifiedAt:    now,
      });

      const [updated] = await tx.update(tickets)
        .set({
          category:  result.category,
          priority:  result.priority,
          updatedAt: now,
          version:   sql`${tickets.version} + 1`,
        })
        .where(and(eq(tickets.id, ticketId), eq(tickets.version, expectedVersion)))
        .returning();

      return {
        classification: {
          category:         result.category,
          priority:         result.priority,
          confidence:       result.confidence,
          reasoning:        result.reasoning,
          matched_keywords: result.matchedKeywords,
          source:           'rules' as const,
          classified_at:    now,
        },
        ticket: rowToTicket(updated),
      };
    });
  },
};

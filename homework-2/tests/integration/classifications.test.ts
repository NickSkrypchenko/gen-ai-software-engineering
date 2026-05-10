import { describe, test, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../../src/db/client';
import { classifications } from '../../src/db/schema';
import { ticketRepository } from '../../src/repository/ticket.repository';
import { classificationRepository } from '../../src/repository/classification.repository';

const BASE_INPUT = {
  customer_id:    'CUST-001',
  customer_email: 'test@example.com',
  customer_name:  'Test User',
  subject:        'Stack trace on login page',
  description:    'I see a stack trace every time I click the login button.',
  metadata:       { source: 'api' as const },
};

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('classificationRepository.findByTicketId()', () => {
  test('returns empty array when no classifications exist', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    const results = await classificationRepository.findByTicketId(ticket.id);
    expect(results).toEqual([]);
  });

  test('returns classifications in newest-first order', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    // Insert two classification records directly
    const now1 = new Date('2026-01-01T10:00:00Z');
    const now2 = new Date('2026-01-01T11:00:00Z');
    await db.insert(classifications).values([
      {
        id: uuidv7(), ticketId: ticket.id, category: 'bug_report', priority: 'high',
        confidence: 0.8, reasoning: 'stack trace', matchedKeywords: ['stack trace'],
        source: 'auto', classifiedAt: now1,
      },
      {
        id: uuidv7(), ticketId: ticket.id, category: 'account_access', priority: 'urgent',
        confidence: 0.9, reasoning: 'login', matchedKeywords: ['login'],
        source: 'manual_override', classifiedAt: now2,
      },
    ]);
    const results = await classificationRepository.findByTicketId(ticket.id);
    expect(results).toHaveLength(2);
    // Newest first
    expect(results[0].source).toBe('manual_override');
    expect(results[1].source).toBe('auto');
  });

  test('maps fields to snake_case API format', async () => {
    const ticket = await ticketRepository.create(BASE_INPUT);
    await db.insert(classifications).values({
      id: uuidv7(), ticketId: ticket.id, category: 'technical_issue', priority: 'medium',
      confidence: 0.7, reasoning: 'crash detected', matchedKeywords: ['crash'],
      source: 'auto', classifiedAt: new Date(),
    });
    const [result] = await classificationRepository.findByTicketId(ticket.id);
    expect(result.ticket_id).toBe(ticket.id);
    expect(result.matched_keywords).toEqual(['crash']);
    expect(result.classified_at).toBeDefined();
  });
});

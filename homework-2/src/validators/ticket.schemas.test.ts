import { describe, test, expect } from 'vitest';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TransitionRequestSchema,
  ListFiltersSchema,
} from './ticket.schemas';

const VALID_CREATE = {
  customer_id:    'CUST-001',
  customer_email: 'alice@example.com',
  customer_name:  'Alice Johnson',
  subject:        'Cannot log in',
  description:    'After resetting my password I get a 500 on submit.',
  metadata:       { source: 'web_form' as const },
};

describe('CreateTicketSchema', () => {
  test('accepts fully valid input', () => {
    expect(CreateTicketSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  test('defaults category to other', () => {
    const r = CreateTicketSchema.parse(VALID_CREATE);
    expect(r.category).toBe('other');
  });

  test('defaults priority to medium', () => {
    const r = CreateTicketSchema.parse(VALID_CREATE);
    expect(r.priority).toBe('medium');
  });

  test('defaults tags to []', () => {
    const r = CreateTicketSchema.parse(VALID_CREATE);
    expect(r.tags).toEqual([]);
  });

  test('rejects missing customer_email', () => {
    const { customer_email: _, ...rest } = VALID_CREATE;
    expect(CreateTicketSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects description shorter than 10 chars', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, description: 'short' }).success).toBe(false);
  });

  test('rejects description longer than 2000 chars', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, description: 'x'.repeat(2001) }).success).toBe(false);
  });

  test('rejects subject longer than 200 chars', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, subject: 'x'.repeat(201) }).success).toBe(false);
  });

  test('rejects invalid category enum', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, category: 'unknown' }).success).toBe(false);
  });

  test('rejects invalid priority enum', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, priority: 'critical' }).success).toBe(false);
  });

  test('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, tags }).success).toBe(false);
  });

  test('rejects extra unknown fields (strict)', () => {
    expect(CreateTicketSchema.safeParse({ ...VALID_CREATE, extra: 'field' }).success).toBe(false);
  });

  test('accepts assigned_to as null', () => {
    const r = CreateTicketSchema.safeParse({ ...VALID_CREATE, assigned_to: null });
    expect(r.success).toBe(true);
  });

  test('trims and lowercases email', () => {
    const r = CreateTicketSchema.parse({ ...VALID_CREATE, customer_email: '  ALICE@EXAMPLE.COM  ' });
    expect(r.customer_email).toBe('alice@example.com');
  });
});

describe('UpdateTicketSchema', () => {
  test('accepts a partial update with just subject', () => {
    expect(UpdateTicketSchema.safeParse({ subject: 'New subject' }).success).toBe(true);
  });

  test('rejects empty object (must have at least one field)', () => {
    expect(UpdateTicketSchema.safeParse({}).success).toBe(false);
  });

  test('rejects status field (not allowed in PUT)', () => {
    expect(UpdateTicketSchema.safeParse({ status: 'resolved' }).success).toBe(false);
  });

  test('rejects customer_id field (not allowed in PUT)', () => {
    expect(UpdateTicketSchema.safeParse({ customer_id: 'NEW' }).success).toBe(false);
  });

  test('accepts partial metadata update', () => {
    expect(UpdateTicketSchema.safeParse({ metadata: { source: 'api' } }).success).toBe(true);
  });
});

describe('TransitionRequestSchema', () => {
  test('accepts valid to + reason', () => {
    expect(TransitionRequestSchema.safeParse({ to: 'resolved', reason: 'Fixed' }).success).toBe(true);
  });

  test('accepts missing reason', () => {
    expect(TransitionRequestSchema.safeParse({ to: 'in_progress' }).success).toBe(true);
  });

  test('rejects invalid status enum', () => {
    expect(TransitionRequestSchema.safeParse({ to: 'archived' }).success).toBe(false);
  });

  test('rejects reason over 500 chars', () => {
    expect(TransitionRequestSchema.safeParse({ to: 'resolved', reason: 'x'.repeat(501) }).success).toBe(false);
  });

  test('rejects extra unknown fields (strict)', () => {
    expect(TransitionRequestSchema.safeParse({ to: 'resolved', extra: 'bad' }).success).toBe(false);
  });
});

describe('ListFiltersSchema', () => {
  test('accepts empty query (all defaults)', () => {
    const r = ListFiltersSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(50);
      expect(r.data.offset).toBe(0);
    }
  });

  test('coerces limit and offset from string', () => {
    const r = ListFiltersSchema.parse({ limit: '10', offset: '5' });
    expect(r.limit).toBe(10);
    expect(r.offset).toBe(5);
  });

  test('rejects limit > 200', () => {
    expect(ListFiltersSchema.safeParse({ limit: 201 }).success).toBe(false);
  });

  test('rejects negative offset', () => {
    expect(ListFiltersSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  test('rejects from > to', () => {
    const result = ListFiltersSchema.safeParse({
      from: '2026-05-02T00:00:00.000Z',
      to:   '2026-05-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  test('accepts from == to', () => {
    const result = ListFiltersSchema.safeParse({
      from: '2026-05-01T00:00:00.000Z',
      to:   '2026-05-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('accepts valid status filter', () => {
    expect(ListFiltersSchema.safeParse({ status: 'resolved' }).success).toBe(true);
  });

  test('rejects invalid status filter', () => {
    expect(ListFiltersSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  test('rejects q shorter than 2 chars', () => {
    expect(ListFiltersSchema.safeParse({ q: 'a' }).success).toBe(false);
  });
});

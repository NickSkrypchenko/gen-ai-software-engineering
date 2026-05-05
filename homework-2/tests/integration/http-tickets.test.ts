import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { createApp } from '../../src/app';

const app = createApp();

const makeBody = (n = 1) => ({
  customer_id:    `CUST-HTTP-${n}`,
  customer_email: `http${n}@example.com`,
  customer_name:  `HTTP User ${n}`,
  subject:        `HTTP Issue ${n}`,
  description:    `Description for HTTP issue ${n} — at least 10 chars.`,
  category:       'other',
  priority:       'medium',
  tags:           [],
  metadata:       { source: 'api' },
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('POST /api/tickets', () => {
  test('creates ticket and returns 201 with versioned body', async () => {
    const res = await request(app).post('/api/tickets').send(makeBody(1));
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.version).toBe(1);
    expect(res.body.status).toBe('new');
  });

  test('returns 400 for invalid body (missing required field)', async () => {
    const res = await request(app).post('/api/tickets').send({ subject: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('auto_classify=true classifies ticket inline', async () => {
    const body = {
      ...makeBody(2),
      subject:     'Login fails with password error',
      description: 'I cannot login — my account is blocked and password reset fails too.',
    };
    const res = await request(app).post('/api/tickets?auto_classify=true').send(body);
    expect(res.status).toBe(201);
    // Category and priority come from classifier — ticket version is 2 (after classify bump)
    expect(res.body.version).toBe(2);
    expect(res.body.category).not.toBe('other');
  });
});

describe('GET /api/tickets', () => {
  test('returns paginated list', async () => {
    await request(app).post('/api/tickets').send(makeBody(10));
    await request(app).post('/api/tickets').send(makeBody(11));
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);
  });

  test('filters by status', async () => {
    await request(app).post('/api/tickets').send(makeBody(20));
    const res = await request(app).get('/api/tickets?status=new');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('returns 400 for invalid filter value', async () => {
    const res = await request(app).get('/api/tickets?status=bogus');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tickets/:id', () => {
  test('returns ticket with ETag header', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(30));
    const id = create.body.id;
    const res = await request(app).get(`/api/tickets/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers['etag']).toBe('"1"');
    expect(res.body.id).toBe(id);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/tickets/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tickets/:id', () => {
  test('updates ticket and bumps version', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(40));
    const id = create.body.id;
    const res = await request(app).put(`/api/tickets/${id}`)
      .set('If-Match', '"1"')
      .send({ subject: 'Updated subject' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated subject');
    expect(res.body.version).toBe(2);
    expect(res.headers['etag']).toBe('"2"');
  });

  test('returns 428 when If-Match is missing', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(41));
    const res = await request(app).put(`/api/tickets/${create.body.id}`)
      .send({ subject: 'No match header' });
    expect(res.status).toBe(428);
  });

  test('returns 412 on version conflict', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(42));
    const id = create.body.id;
    const res = await request(app).put(`/api/tickets/${id}`)
      .set('If-Match', '"99"')
      .send({ subject: 'Stale' });
    expect(res.status).toBe(412);
    expect(res.body.code).toBe('VERSION_CONFLICT');
  });
});

describe('DELETE /api/tickets/:id', () => {
  test('deletes ticket and returns 204', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(50));
    const id = create.body.id;
    const del = await request(app).delete(`/api/tickets/${id}`).set('If-Match', '"1"');
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/tickets/${id}`);
    expect(get.status).toBe(404);
  });

  test('returns 428 without If-Match', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(51));
    const res = await request(app).delete(`/api/tickets/${create.body.id}`);
    expect(res.status).toBe(428);
  });
});

describe('POST /api/tickets/:id/transitions', () => {
  test('transitions ticket status', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(60));
    const id = create.body.id;
    const res = await request(app).post(`/api/tickets/${id}/transitions`)
      .set('If-Match', '"1"')
      .send({ to: 'in_progress', reason: 'Starting work' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.version).toBe(2);
  });

  test('returns 422 for invalid transition', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(61));
    const id = create.body.id;
    const res = await request(app).post(`/api/tickets/${id}/transitions`)
      .set('If-Match', '"1"')
      .send({ to: 'closed' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  test('returns 428 without If-Match', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(62));
    const res = await request(app).post(`/api/tickets/${create.body.id}/transitions`)
      .send({ to: 'in_progress' });
    expect(res.status).toBe(428);
  });
});

describe('POST /api/tickets/:id/auto-classify', () => {
  test('classifies ticket and returns classification result', async () => {
    const body = {
      ...makeBody(70),
      subject:     'Cannot login, password reset broken',
      description: 'Account locked after too many failed login attempts.',
    };
    const create = await request(app).post('/api/tickets').send(body);
    const id = create.body.id;
    const res = await request(app).post(`/api/tickets/${id}/auto-classify`)
      .set('If-Match', '"1"');
    expect(res.status).toBe(200);
    expect(res.body.category).toBeDefined();
    expect(res.body.priority).toBeDefined();
    expect(res.body.confidence).toBeGreaterThan(0);
    expect(res.body.matched_keywords).toBeInstanceOf(Array);
  });

  test('returns 428 without If-Match', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(71));
    const res = await request(app).post(`/api/tickets/${create.body.id}/auto-classify`);
    expect(res.status).toBe(428);
  });
});

describe('GET /api/tickets/:id/transitions', () => {
  test('returns transition audit log', async () => {
    const create = await request(app).post('/api/tickets').send(makeBody(80));
    const id = create.body.id;
    await request(app).post(`/api/tickets/${id}/transitions`)
      .set('If-Match', '"1"')
      .send({ to: 'in_progress' });
    const res = await request(app).get(`/api/tickets/${id}/transitions`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/tickets/:id/classifications', () => {
  test('returns classification history', async () => {
    const body = { ...makeBody(90), subject: 'Billing refund request', description: 'I was charged twice this month.' };
    const create = await request(app).post('/api/tickets').send(body);
    const id = create.body.id;
    await request(app).post(`/api/tickets/${id}/auto-classify`).set('If-Match', '"1"');
    const res = await request(app).get(`/api/tickets/${id}/classifications`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBeDefined();
  });
});

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

describe('Error response shape', () => {
  it('validation error has expected shape', async () => {
    const res = await request(app).post('/api/transactions').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
      ]),
      requestId: expect.any(String),
    });
  });

  it('404 response has expected shape', async () => {
    const res = await request(app).get('/api/transactions/txn_nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    });
    expect(res.body.details).toBeUndefined();
  });

  it('every response includes x-request-id header', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('requestId in error body matches x-request-id header', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({})
      .set('x-request-id', 'test-123');
    expect(res.body.requestId).toBe('test-123');
    expect(res.headers['x-request-id']).toBe('test-123');
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.version).toBeDefined();
  });
});

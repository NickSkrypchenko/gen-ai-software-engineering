import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('createApp()', () => {
  const app = createApp();

  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.db).toBe('ok');
  });

  test('sets x-request-id header on every response', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('returns 404-like response for unknown routes (no crash)', async () => {
    const res = await request(app).get('/api/nonexistent-route-xyz');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('unknown route does not crash the server', async () => {
    const res = await request(app).get('/not/a/route');
    expect([404, 200]).toContain(res.status);
  });
});

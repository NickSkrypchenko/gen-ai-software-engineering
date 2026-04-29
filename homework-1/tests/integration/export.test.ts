import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/transactions/export', () => {
  it('returns 200 with text/csv content-type', async () => {
    await request(app).post('/api/transactions').send({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-AAAAA',
      amount: 100,
      currency: 'USD',
      type: 'deposit',
    });
    const res = await request(app).get('/api/transactions/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('sets content-disposition attachment header with filename', async () => {
    const res = await request(app).get('/api/transactions/export');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/transactions-/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
  });

  it('includes header row in CSV output', async () => {
    const res = await request(app).get('/api/transactions/export');
    const firstLine = res.text.split('\r\n')[0];
    expect(firstLine).toBe('id,fromAccount,toAccount,amount,currency,type,timestamp,status,failureReason');
  });

  it('includes one data row per transaction', async () => {
    await request(app).post('/api/transactions').send({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-AAAAA',
      amount: 100,
      currency: 'USD',
      type: 'deposit',
    });
    await request(app).post('/api/transactions').send({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-BBBBB',
      amount: 200,
      currency: 'EUR',
      type: 'deposit',
    });
    const res = await request(app).get('/api/transactions/export');
    const lines = res.text.split('\r\n').filter(Boolean);
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('applies accountId filter', async () => {
    await request(app).post('/api/transactions').send({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-AAAAA',
      amount: 100,
      currency: 'USD',
      type: 'deposit',
    });
    await request(app).post('/api/transactions').send({
      fromAccount: 'EXTERNAL',
      toAccount: 'ACC-BBBBB',
      amount: 200,
      currency: 'USD',
      type: 'deposit',
    });
    const res = await request(app).get('/api/transactions/export?accountId=ACC-AAAAA');
    const lines = res.text.split('\r\n').filter(Boolean);
    expect(lines.length).toBe(2); // header + 1 row
    expect(lines[1]).toContain('ACC-AAAAA');
  });

  it('returns 400 for invalid filter', async () => {
    const res = await request(app).get('/api/transactions/export?accountId=bad');
    expect(res.status).toBe(400);
  });
});

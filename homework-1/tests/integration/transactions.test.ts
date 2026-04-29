import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

const deposit = (overrides = {}) =>
  ({
    fromAccount: 'EXTERNAL',
    toAccount: 'ACC-AAAAA',
    amount: 500,
    currency: 'USD',
    type: 'deposit',
    ...overrides,
  }) as const;

describe('POST /api/transactions', () => {
  it('returns 201 with completed transaction for a valid deposit', async () => {
    const res = await request(app).post('/api/transactions').send(deposit());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('completed');
    expect(res.body.id).toMatch(/^txn_/);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.failureReason).toBeNull();
  });

  it('returns 201 with failed transaction when balance insufficient', async () => {
    const res = await request(app).post('/api/transactions').send({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 9999,
      currency: 'USD',
      type: 'withdrawal',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('failed');
    expect(res.body.failureReason).toBe('INSUFFICIENT_FUNDS');
  });

  it('returns 400 for missing required field', async () => {
    const res = await request(app).post('/api/transactions').send({ fromAccount: 'EXTERNAL' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toBeInstanceOf(Array);
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 400 for extra fields (strict schema)', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ ...deposit(), id: 'txn_sneaky' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid currency', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send(deposit({ currency: 'XYZ' }));
    expect(res.status).toBe(400);
    expect(res.body.details.some((d: { field: string }) => d.field === 'currency')).toBe(true);
  });

  it('returns 400 for deposit with non-EXTERNAL fromAccount', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send(deposit({ fromAccount: 'ACC-BBBBB' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for transfer where from equals to', async () => {
    const res = await request(app).post('/api/transactions').send({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'ACC-AAAAA',
      amount: 100,
      currency: 'USD',
      type: 'transfer',
    });
    expect(res.status).toBe(400);
  });

  it('sets x-request-id header on response', async () => {
    const res = await request(app).post('/api/transactions').send(deposit());
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('mirrors x-request-id from request', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('x-request-id', 'my-req-id')
      .send(deposit());
    expect(res.headers['x-request-id']).toBe('my-req-id');
  });
});

describe('GET /api/transactions', () => {
  it('returns 200 with data array and count', async () => {
    await request(app).post('/api/transactions').send(deposit());
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  it('filters by accountId', async () => {
    await request(app).post('/api/transactions').send(deposit({ toAccount: 'ACC-AAAAA' }));
    await request(app).post('/api/transactions').send(deposit({ toAccount: 'ACC-BBBBB' }));
    const res = await request(app).get('/api/transactions?accountId=ACC-AAAAA');
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { fromAccount: string; toAccount: string }) =>
      t.fromAccount === 'ACC-AAAAA' || t.toAccount === 'ACC-AAAAA',
    )).toBe(true);
  });

  it('filters by type', async () => {
    await request(app).post('/api/transactions').send(deposit());
    const res = await request(app).get('/api/transactions?type=deposit');
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { type: string }) => t.type === 'deposit')).toBe(true);
  });

  it('returns 400 for invalid accountId filter', async () => {
    const res = await request(app).get('/api/transactions?accountId=bad');
    expect(res.status).toBe(400);
  });

  it('hides failed transactions from counterparty', async () => {
    // failed withdrawal from ACC-AAAAA — counterparty (toAccount=EXTERNAL) shouldn't see it
    // But EXTERNAL is not a valid filter so test with a transfer scenario
    await request(app).post('/api/transactions').send({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'ACC-BBBBB',
      amount: 9999,
      currency: 'USD',
      type: 'transfer',
    });
    // ACC-BBBBB (counterparty) should not see the failed transfer
    const res = await request(app).get('/api/transactions?accountId=ACC-BBBBB');
    expect(res.status).toBe(200);
    expect(res.body.data.filter((t: { status: string }) => t.status === 'failed')).toHaveLength(0);
  });
});

describe('GET /api/transactions/:id', () => {
  it('returns 200 with the transaction', async () => {
    const created = await request(app).post('/api/transactions').send(deposit());
    const id = created.body.id;
    const res = await request(app).get(`/api/transactions/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/transactions/txn_nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });
});

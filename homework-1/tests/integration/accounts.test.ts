import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

async function seedDeposit(toAccount: string, amount: number, currency = 'USD') {
  return request(app).post('/api/transactions').send({
    fromAccount: 'EXTERNAL',
    toAccount,
    amount,
    currency,
    type: 'deposit',
  });
}

describe('GET /api/accounts/:accountId/balance', () => {
  it('returns 200 with empty balances for account with no transactions', async () => {
    const res = await request(app).get('/api/accounts/ACC-AAAAA/balance');
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('ACC-AAAAA');
    expect(res.body.balances).toEqual([]);
    expect(res.body.asOf).toBeDefined();
  });

  it('returns correct balance after deposit', async () => {
    await seedDeposit('ACC-AAAAA', 1000);
    const res = await request(app).get('/api/accounts/ACC-AAAAA/balance');
    expect(res.status).toBe(200);
    const usd = res.body.balances.find((b: { currency: string }) => b.currency === 'USD');
    expect(usd.amount).toBe(1000);
  });

  it('tracks multiple currencies separately', async () => {
    await seedDeposit('ACC-AAAAA', 1000, 'USD');
    await seedDeposit('ACC-AAAAA', 500, 'EUR');
    const res = await request(app).get('/api/accounts/ACC-AAAAA/balance');
    expect(res.status).toBe(200);
    const usd = res.body.balances.find((b: { currency: string }) => b.currency === 'USD');
    const eur = res.body.balances.find((b: { currency: string }) => b.currency === 'EUR');
    expect(usd.amount).toBe(1000);
    expect(eur.amount).toBe(500);
  });

  it('returns 400 for malformed accountId', async () => {
    const res = await request(app).get('/api/accounts/bad-format/balance');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/accounts/:accountId/summary', () => {
  it('returns 200 with empty perCurrency for account with no transactions', async () => {
    const res = await request(app).get('/api/accounts/ACC-AAAAA/summary');
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('ACC-AAAAA');
    expect(res.body.perCurrency).toEqual([]);
  });

  it('returns correct deposit summary', async () => {
    await seedDeposit('ACC-AAAAA', 300);
    await seedDeposit('ACC-AAAAA', 200);
    const res = await request(app).get('/api/accounts/ACC-AAAAA/summary');
    expect(res.status).toBe(200);
    const usd = res.body.perCurrency.find((e: { currency: string }) => e.currency === 'USD');
    expect(usd.totalDeposits).toBe(500);
    expect(usd.totalWithdrawals).toBe(0);
    expect(usd.transactionCount).toBe(2);
  });

  it('includes failed transactions in transactionCount but not totals', async () => {
    await seedDeposit('ACC-AAAAA', 100);
    // failed withdrawal
    await request(app).post('/api/transactions').send({
      fromAccount: 'ACC-AAAAA',
      toAccount: 'EXTERNAL',
      amount: 9999,
      currency: 'USD',
      type: 'withdrawal',
    });
    const res = await request(app).get('/api/accounts/ACC-AAAAA/summary');
    const usd = res.body.perCurrency.find((e: { currency: string }) => e.currency === 'USD');
    expect(usd.transactionCount).toBe(2);
    expect(usd.totalWithdrawals).toBe(0);
  });

  it('returns 400 for malformed accountId', async () => {
    const res = await request(app).get('/api/accounts/bad/summary');
    expect(res.status).toBe(400);
  });
});

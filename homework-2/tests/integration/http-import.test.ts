import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { createApp } from '../../src/app';

const app = createApp();
const fixture = (rel: string) => readFileSync(resolve('tests/fixtures', rel));

beforeEach(async () => {
  await db.execute(sql`TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE`);
});

describe('POST /api/tickets/import', () => {
  test('imports valid CSV and returns summary', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=csv')
      .attach('file', fixture('csv/valid.csv'), { filename: 'valid.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.succeeded).toBe(3);
    expect(res.body.failed).toHaveLength(0);
    expect(res.body.ticket_ids).toHaveLength(3);
  });

  test('imports valid JSON and returns summary', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json')
      .attach('file', fixture('json/valid.json'), { filename: 'valid.json', contentType: 'application/json' });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toHaveLength(0);
  });

  test('imports valid XML and returns summary', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=xml')
      .attach('file', fixture('xml/valid.xml'), { filename: 'valid.xml', contentType: 'text/xml' });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(2);
  });

  test('partial CSV: records validation failures in summary with stage=validate', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=csv')
      .attach('file', fixture('csv/partial.csv'), { filename: 'partial.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].stage).toBe('validate');
    expect(res.body.failed[0].row).toBe(2);
  });

  test('partial JSON: records validation failure', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json')
      .attach('file', fixture('json/partial.json'), { filename: 'partial.json', contentType: 'application/json' });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].stage).toBe('validate');
  });

  test('malformed JSON returns 400 PARSE_ERROR', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json')
      .attach('file', fixture('json/malformed.json'), { filename: 'malformed.json', contentType: 'application/json' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PARSE_ERROR');
  });

  test('JSON with non-array root returns 400 PARSE_ERROR', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json')
      .attach('file', fixture('json/not_array.json'), { filename: 'not_array.json', contentType: 'application/json' });
    expect(res.status).toBe(400);
  });

  test('missing ?format returns 400', async () => {
    const res = await request(app)
      .post('/api/tickets/import')
      .attach('file', fixture('json/valid.json'), { filename: 'valid.json', contentType: 'application/json' });
    expect(res.status).toBe(400);
  });

  test('wrong content-type (not multipart) returns 415', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json')
      .set('Content-Type', 'application/json')
      .send([]);
    expect(res.status).toBe(415);
  });

  test('auto_classify=true classifies imported tickets', async () => {
    const res = await request(app)
      .post('/api/tickets/import?format=json&auto_classify=true')
      .attach('file', fixture('json/valid.json'), { filename: 'valid.json', contentType: 'application/json' });
    expect(res.status).toBe(200);
    expect(res.body.auto_classified).toBe(2);
  });
});

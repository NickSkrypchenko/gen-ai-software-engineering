import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { jsonImporter } from '../../../src/importers/json.importer';

const fixture = (rel: string) => readFileSync(resolve('tests/fixtures', rel));

describe('jsonImporter.parse()', () => {
  test('parses valid JSON array into rows', () => {
    const { rows, parseErrors } = jsonImporter.parse(fixture('json/valid.json'));
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].rowIndex).toBe(1);
    expect(rows[0].raw.customer_id).toBe('CUST-J01');
  });

  test('assigns correct 1-based rowIndex', () => {
    const { rows } = jsonImporter.parse(fixture('json/valid.json'));
    expect(rows.map(r => r.rowIndex)).toEqual([1, 2]);
  });

  test('partial.json: all rows pass through (validation is a later step)', () => {
    const { rows, parseErrors } = jsonImporter.parse(fixture('json/partial.json'));
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });

  test('not_array.json: returns parse error', () => {
    const { rows, parseErrors } = jsonImporter.parse(fixture('json/not_array.json'));
    expect(rows).toHaveLength(0);
    expect(parseErrors[0].message).toMatch(/array/);
  });

  test('malformed.json: returns parse error', () => {
    const { rows, parseErrors } = jsonImporter.parse(fixture('json/malformed.json'));
    expect(rows).toHaveLength(0);
    expect(parseErrors[0].message).toMatch(/Malformed JSON/);
  });
});

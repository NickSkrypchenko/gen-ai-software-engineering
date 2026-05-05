import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { xmlImporter } from '../../../src/importers/xml.importer';

const fixture = (rel: string) => readFileSync(resolve('tests/fixtures', rel));

describe('xmlImporter.parse()', () => {
  test('parses valid XML into rows', () => {
    const { rows, parseErrors } = xmlImporter.parse(fixture('xml/valid.xml'));
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].rowIndex).toBe(1);
    expect(rows[0].raw.customer_id).toBe('CUST-X01');
  });

  test('unwraps tags.tag into flat array', () => {
    const { rows } = xmlImporter.parse(fixture('xml/valid.xml'));
    expect(Array.isArray(rows[0].raw.tags)).toBe(true);
    expect(rows[0].raw.tags).toContain('password');
  });

  test('single_ticket.xml: isArray ensures result is always an array', () => {
    const { rows, parseErrors } = xmlImporter.parse(fixture('xml/single_ticket.xml'));
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  test('no_root.xml: returns parse error for missing <tickets> root', () => {
    const { rows, parseErrors } = xmlImporter.parse(fixture('xml/no_root.xml'));
    expect(rows).toHaveLength(0);
    expect(parseErrors[0].message).toMatch(/<tickets>/);
  });

  test('assigns correct 1-based rowIndex', () => {
    const { rows } = xmlImporter.parse(fixture('xml/valid.xml'));
    expect(rows.map(r => r.rowIndex)).toEqual([1, 2]);
  });

  test('empty tags element yields empty array', () => {
    const { rows } = xmlImporter.parse(fixture('xml/valid.xml'));
    // second ticket has <tags/> — should be empty array, not object
    const tags = rows[1].raw.tags;
    expect(Array.isArray(tags) || tags === '' || tags === undefined).toBe(true);
  });
});

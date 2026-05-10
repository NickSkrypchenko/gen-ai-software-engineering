import { describe, test, expect } from 'vitest';
import { ImportQuerySchema } from './import.schemas';

describe('ImportQuerySchema', () => {
  test('accepts valid format=csv', () => {
    expect(ImportQuerySchema.safeParse({ format: 'csv' }).success).toBe(true);
  });

  test('accepts all valid formats', () => {
    for (const fmt of ['csv', 'json', 'xml'] as const) {
      expect(ImportQuerySchema.safeParse({ format: fmt }).success).toBe(true);
    }
  });

  test('rejects missing format', () => {
    expect(ImportQuerySchema.safeParse({}).success).toBe(false);
  });

  test('rejects unknown format', () => {
    expect(ImportQuerySchema.safeParse({ format: 'yaml' }).success).toBe(false);
  });

  test('auto_classify defaults to false', () => {
    const r = ImportQuerySchema.parse({ format: 'csv' });
    expect(r.auto_classify).toBe(false);
  });

  test('coerces auto_classify from string "true"', () => {
    const r = ImportQuerySchema.parse({ format: 'json', auto_classify: 'true' });
    expect(r.auto_classify).toBe(true);
  });
});

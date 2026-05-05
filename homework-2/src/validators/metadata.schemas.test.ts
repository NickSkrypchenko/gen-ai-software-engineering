import { describe, test, expect } from 'vitest';
import { TicketMetadataSchema } from './metadata.schemas';

describe('TicketMetadataSchema', () => {
  test('accepts valid minimal metadata', () => {
    expect(TicketMetadataSchema.safeParse({ source: 'web_form' }).success).toBe(true);
  });

  test('accepts all optional fields', () => {
    const result = TicketMetadataSchema.safeParse({
      source: 'email',
      browser: 'Chrome 124',
      device_type: 'desktop',
    });
    expect(result.success).toBe(true);
  });

  test('rejects unknown source enum value', () => {
    expect(TicketMetadataSchema.safeParse({ source: 'telegram' }).success).toBe(false);
  });

  test('rejects unknown device_type enum value', () => {
    expect(TicketMetadataSchema.safeParse({ source: 'api', device_type: 'watch' }).success).toBe(false);
  });

  test('rejects missing source', () => {
    expect(TicketMetadataSchema.safeParse({}).success).toBe(false);
  });

  test('rejects extra unknown fields (strict)', () => {
    expect(TicketMetadataSchema.safeParse({ source: 'api', extra: 'field' }).success).toBe(false);
  });

  test('accepts all valid source values', () => {
    for (const s of ['web_form', 'email', 'api', 'chat', 'phone'] as const) {
      expect(TicketMetadataSchema.safeParse({ source: s }).success).toBe(true);
    }
  });

  test('accepts all valid device_type values', () => {
    for (const d of ['desktop', 'mobile', 'tablet'] as const) {
      expect(TicketMetadataSchema.safeParse({ source: 'api', device_type: d }).success).toBe(true);
    }
  });
});

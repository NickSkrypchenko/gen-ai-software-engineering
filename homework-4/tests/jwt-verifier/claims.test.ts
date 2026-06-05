import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateClaims } from '../../src/jwt/claims';
import { signedToken, unsignedToken, now } from '../../tests/jwt-fixtures';

describe('validateClaims — Bug 002 expiration boundary fix', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('accepts token with exp well in the future', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    expect(validateClaims({ sub: 'alice', exp: now() + 3600 })).toEqual({
      valid: true,
      claims: expect.objectContaining({ sub: 'alice' }),
    });
  });

  test('rejects token where exp equals current time (Bug 002 regression)', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const result = validateClaims({ sub: 'alice', exp: now() });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });

  test('accepts token where exp is one second in the future', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    expect(validateClaims({ sub: 'alice', exp: now() + 1 })).toEqual({
      valid: true,
      claims: expect.objectContaining({ sub: 'alice' }),
    });
  });

  test('rejects token with exp one second in the past', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const result = validateClaims({ sub: 'alice', exp: now() - 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });
});

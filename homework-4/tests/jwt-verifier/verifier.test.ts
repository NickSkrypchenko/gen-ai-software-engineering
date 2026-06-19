import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyToken } from '../../src/jwt/verifier';
import { signedToken, unsignedToken } from '../../tests/jwt-fixtures';

describe('verifyToken — Bug 001 alg=none bypass fix', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('accepts valid HS256 token after alg=none bypass removed', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const token = signedToken({ sub: 'user', exp: 1_700_003_600 });
    expect(verifyToken(token)).toEqual({
      valid: true,
      claims: expect.objectContaining({ sub: 'user' }),
    });
  });

  test('rejects alg=none token with exact algorithm error message', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const token = unsignedToken({ sub: 'user', exp: 1_700_003_600 });
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unsupported algorithm: none');
  });

  test('alg=none token rejected via algorithm check, not claims validation', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    // payload is expired — but the alg check fires first
    const token = unsignedToken({ sub: 'user', exp: 1_699_000_000 });
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported/);
    expect(result.error).not.toMatch(/expired/);
  });
});

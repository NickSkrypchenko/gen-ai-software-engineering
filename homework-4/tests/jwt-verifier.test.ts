import { readFileSync } from 'node:fs';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyToken } from '../src/jwt/verifier';
import { signedToken, unsignedToken, now } from './jwt-fixtures';

describe('verifyToken — baseline behavior', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('happy path: valid signed token → valid:true with claims', () => {
    const t = signedToken({ sub: 'alice', exp: now() + 3600 });
    expect(verifyToken(t)).toEqual({
      valid: true,
      claims: expect.objectContaining({ sub: 'alice' }),
    });
  });

  test('wrong secret: signed with X, verified with Y → bad signature', () => {
    const t = signedToken({ sub: 'alice', exp: now() + 3600 }, 'wrong-secret');
    expect(verifyToken(t).valid).toBe(false);
    expect(verifyToken(t).error).toMatch(/bad signature/);
  });

  test('rejects alg=none (Bug 001 — failing pre-fix)', () => {
    const t = unsignedToken({ sub: 'alice', exp: now() + 3600 });
    expect(verifyToken(t).valid).toBe(false);
    expect(verifyToken(t).error).toMatch(/none|unsupported/);
  });

  test('expiration boundary inclusive (Bug 002 — failing pre-fix)', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const t = signedToken({ sub: 'alice', exp: 1_700_000_000 });
    expect(verifyToken(t).valid).toBe(false);
    expect(verifyToken(t).error).toMatch(/expired/);
  });

  test('signature comparison is constant-time (Bug 003 — failing pre-fix)', () => {
    const src = readFileSync('src/jwt/signature.ts', 'utf-8');
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).not.toMatch(/===\s*expected|signature\s*===/);
  });
});

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { sign, verifySignature } from '../../src/jwt/signature';

describe('verifySignature — Bug 003 timing-safe comparison fix', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('accepts a correctly signed input (happy path)', () => {
    const input = 'header.payload';
    const sig = sign(input, 'secret');
    expect(verifySignature(input, sig, 'secret')).toBe(true);
  });

  test('rejects same-length incorrect signature via timingSafeEqual (Bug 003 regression)', () => {
    // HMAC-SHA256 base64url is always 43 chars, so signing with a different secret
    // produces a same-length signature — the length pre-check passes and timingSafeEqual
    // must detect the difference.
    const input = 'header.payload';
    const wrongSig = sign(input, 'other-secret');
    expect(verifySignature(input, wrongSig, 'secret')).toBe(false);
  });

  test('rejects signature with wrong length via new length pre-check (edge case)', () => {
    expect(verifySignature('header.payload', 'tooshort', 'secret')).toBe(false);
  });
});

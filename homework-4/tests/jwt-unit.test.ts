import { describe, test, expect } from 'vitest';
import { decode } from '../src/jwt/decoder';
import { verifyToken } from '../src/jwt/verifier';
import { validateClaims } from '../src/jwt/claims';
import { signedToken } from './jwt-fixtures';

describe('decoder — error paths', () => {
  test('throws on fewer than 3 dot-separated parts', () => {
    expect(() => decode('only.two')).toThrow('malformed token');
  });

  test('throws on more than 3 dot-separated parts', () => {
    expect(() => decode('a.b.c.d')).toThrow('malformed token');
  });

  test('throws on empty header part', () => {
    const p = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url');
    expect(() => decode(`.${p}.sig`)).toThrow('malformed token');
  });

  test('throws on invalid base64url header', () => {
    const badHeader = '!!!notbase64';
    const validPayload = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url');
    expect(() => decode(`${badHeader}.${validPayload}.sig`)).toThrow('malformed token');
  });

  test('throws on invalid base64url payload', () => {
    const validHeader = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const badPayload = '!!!notbase64';
    expect(() => decode(`${validHeader}.${badPayload}.sig`)).toThrow('malformed token');
  });

  test('returns rawHeader and rawPayload as original base64url strings', () => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url');
    const decoded = decode(`${h}.${p}.sig`);
    expect(decoded.rawHeader).toBe(h);
    expect(decoded.rawPayload).toBe(p);
    expect(decoded.signature).toBe('sig');
  });
});

describe('validateClaims — edge paths', () => {
  test('accepts token with no exp claim', () => {
    const result = validateClaims({ sub: 'alice' });
    expect(result.valid).toBe(true);
  });

  test('rejects genuinely expired token (exp strictly before now)', () => {
    const result = validateClaims({ sub: 'alice', exp: 1_000_000 }); // Jan 1970 — long past
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });

  test('rejects token where nbf is in the future', () => {
    const futureNbf = Math.floor(Date.now() / 1000) + 3600;
    const result = validateClaims({ sub: 'alice', nbf: futureNbf });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not yet valid/);
  });

  test('accepts token where nbf is in the past', () => {
    const pastNbf = Math.floor(Date.now() / 1000) - 60;
    const result = validateClaims({ sub: 'alice', nbf: pastNbf });
    expect(result.valid).toBe(true);
  });
});

describe('verifyToken — additional error paths', () => {
  test('returns error on malformed token (not 3 parts)', () => {
    const result = verifyToken('not.valid');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/malformed/);
  });

  test('returns error for unsupported algorithm (RS256)', () => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'alice', exp: 9_999_999_999 })).toString('base64url');
    const result = verifyToken(`${h}.${p}.sig`);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported/);
  });

  test('returns error when no secret configured', () => {
    const t = signedToken({ sub: 'alice', exp: 9_999_999_999 });
    // Pass empty string explicitly — bypasses env var
    const result = verifyToken(t, '');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });
});

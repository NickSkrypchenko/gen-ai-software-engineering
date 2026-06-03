import type { Claims, VerifyResult } from '../types';

export function validateClaims(payload: Claims): VerifyResult {
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp !== undefined && payload.exp < now) {         // Bug 002 — should be <=
    return { valid: false, error: 'expired' };
  }

  if (payload.nbf !== undefined && payload.nbf > now) {
    return { valid: false, error: 'not yet valid' };
  }

  return { valid: true, claims: payload };
}

import { decode } from './decoder';
import { verifySignature } from './signature';
import { validateClaims } from './claims';
import type { VerifyResult } from '../types';

export function verifyToken(token: string, secret?: string): VerifyResult {
  let decoded;
  try {
    decoded = decode(token);
  } catch (e: any) {
    return { valid: false, error: e.message };
  }

  const { rawHeader, rawPayload, signature, header, payload } = decoded;

  if (header.alg !== 'HS256') {
    return { valid: false, error: `unsupported algorithm: ${header.alg}` };
  }

  const jwtSecret = secret ?? process.env.JWT_SECRET ?? '';
  if (!jwtSecret) {
    return { valid: false, error: 'JWT_SECRET not configured' };
  }

  const signingInput = `${rawHeader}.${rawPayload}`;
  if (!verifySignature(signingInput, signature, jwtSecret)) {
    return { valid: false, error: 'bad signature' };
  }

  return validateClaims(payload);
}

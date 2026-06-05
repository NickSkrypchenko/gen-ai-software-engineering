import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

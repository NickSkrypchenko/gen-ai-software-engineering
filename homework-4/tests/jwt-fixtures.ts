import { createHmac } from 'node:crypto';

const DEFAULT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-cli-demo-only';

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function signedToken(
  payload: Record<string, unknown>,
  secret = DEFAULT_SECRET,
): string {
  const header  = b64url({ alg: 'HS256', typ: 'JWT' });
  const body    = b64url(payload);
  const signing = `${header}.${body}`;
  const sig     = createHmac('sha256', secret).update(signing).digest('base64url');
  return `${signing}.${sig}`;
}

export function unsignedToken(payload: Record<string, unknown>): string {
  const header  = b64url({ alg: 'none', typ: 'JWT' });
  const body    = b64url(payload);
  return `${header}.${body}.`;
}

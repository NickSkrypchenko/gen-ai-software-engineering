import type { DecodedToken, Header, Claims } from '../types';

function b64urlDecode(s: string): string {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, 'base64url').toString('utf-8');
}

export function decode(token: string): DecodedToken {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('malformed token: expected 3 dot-separated parts');
  }
  const [rawHeader, rawPayload, signature] = parts as [string, string, string];
  if (!rawHeader || !rawPayload) {
    throw new Error('malformed token: empty header or payload');
  }

  let header: Header;
  let payload: Claims;
  try {
    header = JSON.parse(b64urlDecode(rawHeader)) as Header;
  } catch {
    throw new Error('malformed token: invalid header encoding');
  }
  try {
    payload = JSON.parse(b64urlDecode(rawPayload)) as Claims;
  } catch {
    throw new Error('malformed token: invalid payload encoding');
  }

  return { rawHeader, rawPayload, signature, header, payload };
}

# Bug 003 — Signature comparison is timing-attack vulnerable

## Symptom

`verifySignature()` in `src/jwt/signature.ts` uses JavaScript's `===` operator to compare
the expected HMAC signature against the received signature. String comparison via `===` is
not constant-time: it short-circuits on the first differing character, leaking information
about how many characters of the signature are correct. Over many requests, an attacker
can use this timing differential to forge valid signatures character by character.

## Reproduction

The vulnerability is a code inspection finding — it cannot be demonstrated with a simple
CLI test without statistical timing infrastructure. The baseline test in
`tests/jwt-verifier.test.ts` (test 5) detects it by source inspection:

```ts
const src = readFileSync('src/jwt/signature.ts', 'utf-8');
expect(src).toMatch(/timingSafeEqual/);         // fails pre-fix
expect(src).not.toMatch(/===\s*expected|signature\s*===/);  // fails pre-fix
```

A practical timing attack requires thousands of requests to a running service, but the
theoretical vulnerability exists in any comparison-based validation of cryptographic outputs.

## Suspected severity

**HIGH** — Timing attack on HMAC signature validation. Enables offline brute-force of
the signature given sufficient request capacity. Particularly dangerous if the verifier
is exposed via a high-throughput API.

## Hint

`src/jwt/signature.ts` — `verifySignature()` function. The line `return signature === expected`
must be replaced with `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))`
with a pre-check for equal lengths (Node's `timingSafeEqual` throws on length mismatch).

## Expected behavior

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

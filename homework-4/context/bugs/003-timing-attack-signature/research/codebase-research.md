I now have everything needed. Here is the complete research report for Bug 003.

---

## Bug Summary

`verifySignature()` in `src/jwt/signature.ts` computes the expected HMAC-SHA256 signature and then compares it to the attacker-supplied signature using JavaScript's `===` operator (`signature.ts:9`). V8's string equality short-circuits on the first differing byte, so the time the comparison takes is proportional to the length of the common prefix between the forged signature and the correct one. Over a statistically large number of timed HTTP requests an attacker can recover the correct signature one character at a time without ever knowing the secret key — a classic CWE-208 timing side-channel on a cryptographic MAC.

---

## Affected Files

| File | Line | Role in bug |
|---|---|---|
| `src/jwt/signature.ts` | 9 | **Vulnerable comparison**: `return signature === expected` |
| `src/jwt/verifier.ts` | 26 | Calls `verifySignature()` — the attacker-facing entry point |
| `tests/jwt-verifier.test.ts` | 37–41 | Source-inspection detection test that fails pre-fix |

---

## Relevant Code Snippets

**`src/jwt/signature.ts:1-10`** — full vulnerable file
```ts
import { createHmac } from 'node:crypto';

export function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  return signature === expected;                                // Bug 003 — timing-attack vulnerable
}
```

**`src/jwt/verifier.ts:25-28`** — attacker-facing call site
```ts
  const signingInput = `${rawHeader}.${rawPayload}`;
  if (!verifySignature(signingInput, signature, jwtSecret)) {
    return { valid: false, error: 'bad signature' };
  }
```

**`tests/jwt-verifier.test.ts:37-41`** — source-inspection detection test
```ts
  test('signature comparison is constant-time (Bug 003 — failing pre-fix)', () => {
    const src = readFileSync('src/jwt/signature.ts', 'utf-8');
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).not.toMatch(/===\s*expected|signature\s*===/);
  });
```

---

## Reproduction Steps

1. `git checkout homework-4-submission`
2. `cd homework-4 && npm install`
3. Run the baseline suite:
   ```bash
   npx vitest run tests/jwt-verifier.test.ts
   ```
4. The test at line 37 — **"signature comparison is constant-time (Bug 003)"** — fails with two `expect` failures:
   - `expect(src).toMatch(/timingSafeEqual/)` → fails because the word is absent from `signature.ts`
   - `expect(src).not.toMatch(/===\s*expected|signature\s*===/)` → fails because `signature === expected` is present on line 9

No runtime infrastructure or timing tooling is required; the test catches the bug by source inspection.

---

## Root Cause Hypothesis

The root cause is a single expression at `src/jwt/signature.ts:9`: `return signature === expected`. JavaScript's `===` on strings is a byte-by-byte loop that returns `false` the moment any byte mismatches, so wall-clock time grows linearly with the length of the shared prefix between the attacker-supplied `signature` and the correct `expected` value. Because `verifyToken` (`src/jwt/verifier.ts:26`) passes the raw third segment of the JWT directly into `verifySignature` after only a secret-presence guard (`verifier.ts:20–23`), the comparison is fully reachable by any remote caller who can send crafted tokens and measure response latencies. The fix is to replace the `===` comparison with `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))`, preceded by a `signature.length !== expected.length` guard, because Node's `timingSafeEqual` throws a `RangeError` when its two `Buffer` arguments differ in byte length.
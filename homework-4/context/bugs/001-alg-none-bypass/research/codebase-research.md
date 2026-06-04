I now have a complete picture of the bug. Here is the structured research report:

---

## Bug Summary

The `verifyToken()` function in `src/jwt/verifier.ts` contains an explicit early-return branch at line 16–18 that checks whether `header.alg === 'none'` and, if so, immediately returns `{ valid: true, claims: payload }` — bypassing all signature verification and claims validation. An attacker can craft a JWT with `alg=none` in the header, an empty signature field, and arbitrary claims (including forged `sub`, inflated `exp`, etc.) and have the verifier accept it as fully valid without a secret ever being checked.

---

## Affected Files

| File | Line | Role in bug |
|------|------|-------------|
| `src/jwt/verifier.ts` | 16–18 | **Root cause**: early-return branch accepts `alg=none` unconditionally |
| `src/jwt/decoder.ts` | 8–32 | Decodes token; correctly splits 3 parts but does **not** reject `alg=none` |
| `src/types.ts` | 1–5 | `Header.alg` typed as `string` — no type-level constraint on allowed values |
| `tests/fixtures/alg-none-token.txt` | 1 | Pre-built attack fixture used for reproduction |
| `tests/jwt-verifier.test.ts` | 24–28 | Failing test that asserts `alg=none` must be rejected (marked as pre-fix) |
| `tests/jwt-fixtures.ts` | 24–28 | `unsignedToken()` helper that constructs `alg=none` tokens for tests |

---

## Relevant Code Snippets

**`src/jwt/verifier.ts:6-35`** — the full `verifyToken` function with the bug at lines 16–18:
```ts
export function verifyToken(token: string, secret?: string): VerifyResult {
  let decoded;
  try {
    decoded = decode(token);
  } catch (e: any) {
    return { valid: false, error: e.message };
  }

  const { rawHeader, rawPayload, signature, header, payload } = decoded;

  if (header.alg === 'none') {                                  // Bug 001 — alg=none bypass
    return { valid: true, claims: payload };
  }

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
```

**`tests/fixtures/alg-none-token.txt:1`** — pre-built unsigned attack token:
```
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhbGljZSIsImV4cCI6OTk5OTk5OTk5OX0.
```
(Decodes to header `{"alg":"none","typ":"JWT"}`, payload `{"sub":"alice","exp":9999999999}`, empty signature.)

**`tests/jwt-fixtures.ts:24-28`** — test helper that constructs `alg=none` tokens:
```ts
export function unsignedToken(payload: Record<string, unknown>): string {
  const header  = b64url({ alg: 'none', typ: 'JWT' });
  const body    = b64url(payload);
  return `${header}.${body}.`;
}
```

**`tests/jwt-verifier.test.ts:24-28`** — the currently-failing test that asserts the fix:
```ts
test('rejects alg=none (Bug 001 — failing pre-fix)', () => {
  const t = unsignedToken({ sub: 'alice', exp: now() + 3600 });
  expect(verifyToken(t).valid).toBe(false);
  expect(verifyToken(t).error).toMatch(/none|unsupported/);
});
```

---

## Reproduction Steps

```bash
cd homework-4

# Option A — use the pre-built fixture
npm run cli -- verify "$(cat tests/fixtures/alg-none-token.txt)"
# Observed (buggy):  { "valid": true, "claims": { "sub": "alice", "exp": 9999999999 } }
# Expected (fixed):  { "valid": false, "error": "unsupported algorithm: none" }

# Option B — build a fresh unsigned token and verify it
node -e "
  const h = Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');
  const p = Buffer.from(JSON.stringify({sub:'attacker',exp:9999999999})).toString('base64url');
  console.log(h + '.' + p + '.');
" | xargs -I{} npm run cli -- verify {}

# Option C — run the test suite (Bug 001 test will fail)
npx vitest run tests/jwt-verifier.test.ts
```

---

## Root Cause Hypothesis

The root cause is an explicit, intentionally-placed (the comment even labels it "Bug 001") early-return branch at `src/jwt/verifier.ts:16–18`. When `header.alg === 'none'`, the code returns `{ valid: true, claims: payload }` **before** reaching the algorithm allowlist check at line 20 (`if (header.alg !== 'HS256')`). The `alg=none` check should not exist at all, or at minimum must return `{ valid: false, error: 'unsupported algorithm: none' }` just like any other unknown algorithm. The existing unsupported-algorithm guard at line 20–22 would correctly reject `alg=none` if the short-circuit at line 16 were removed — no other code change is needed. The `decoder.ts`, `signature.ts`, and `claims.ts` modules are all uninvolved in this specific bug path since execution never reaches them for `alg=none` tokens.
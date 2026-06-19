---

### Bug Summary

Bug 002 is an off-by-one error in the JWT expiration check. When a token's `exp` claim equals the current Unix timestamp (i.e., it expires at exactly this second), `validateClaims()` in `src/jwt/claims.ts` incorrectly accepts it as valid. RFC 7519 §4.1.4 requires that the current time must be **strictly before** the expiry — meaning `exp === now` is already expired and must be rejected. The code uses `<` where it should use `<=`.

---

### Affected Files

| File | Line | Role in bug |
|------|------|-------------|
| `src/jwt/claims.ts` | 6 | Contains the faulty `<` comparison — should be `<=` |
| `src/jwt/verifier.ts` | 30 | Calls `validateClaims(payload)` — entry point into the buggy path |
| `tests/jwt-verifier.test.ts` | 30–35 | Test 4 that fails pre-fix, verifies the boundary-inclusive behavior |

---

### Relevant Code Snippets

**`src/jwt/claims.ts:3-15`** — the faulty condition:
```ts
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
```

**`src/jwt/verifier.ts:6-31`** — call site:
```ts
export function verifyToken(token: string, secret?: string): VerifyResult {
  // ...decode, alg check, signature check...
  return validateClaims(payload);   // line 30
}
```

**`tests/jwt-verifier.test.ts:30-35`** — failing test:
```ts
test('expiration boundary inclusive (Bug 002 — failing pre-fix)', () => {
  vi.setSystemTime(new Date(1_700_000_000_000));
  const t = signedToken({ sub: 'alice', exp: 1_700_000_000 });
  expect(verifyToken(t).valid).toBe(false);
  expect(verifyToken(t).error).toMatch(/expired/);
});
```

---

### Reproduction Steps

```bash
cd homework-4

# 1. Run the failing test directly
npx vitest run tests/jwt-verifier.test.ts

# 2. Or via CLI — set exp to exactly now:
NOW=$(date +%s)
TOKEN=$(node -e "
  const { createHmac } = require('crypto');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const p = Buffer.from(JSON.stringify({sub:'alice',exp:${NOW}})).toString('base64url');
  const sig = createHmac('sha256','test-secret-for-cli-demo-only').update(h+'.'+p).digest('base64url');
  console.log(h+'.'+p+'.'+sig);
")
npm run cli -- verify "$TOKEN"
# Expected: { "valid": false, "error": "expired" }
# Actual:   { "valid": true, "claims": {...} }
```

---

### Root Cause Hypothesis

The bug is entirely localized to `src/jwt/claims.ts:6`. The condition `payload.exp < now` uses strict less-than, so when `payload.exp === now` the condition evaluates to `false` and the token is returned as `{ valid: true }`. RFC 7519 §4.1.4 states the current time must be **before** expiry — not equal to it — so the correct operator is `<=`. Changing `payload.exp < now` to `payload.exp <= now` makes the boundary inclusive and rejects tokens whose `exp` equals the current second, fixing the off-by-one. No other files are involved; `verifier.ts:30` simply delegates to `validateClaims` and the test fixture at `tests/jwt-fixtures.ts` is correct.
# Bug 002 — Expiration check is not boundary-inclusive (`exp` off-by-one)

## Symptom

A JWT token whose `exp` claim equals the current Unix timestamp (i.e., expires at
exactly this second) is accepted as valid instead of being rejected. Per RFC 7519 §4.1.4,
the `exp` check MUST be `exp <= now` (inclusive), meaning a token whose `exp` matches
the current time is already expired.

## Reproduction

```bash
# Set exp to exactly the current Unix second:
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

The test in `tests/jwt-verifier.test.ts` (test 4) demonstrates this with fake timers:
```ts
vi.setSystemTime(new Date(1_700_000_000_000));
const t = signedToken({ sub: 'alice', exp: 1_700_000_000 });
expect(verifyToken(t).valid).toBe(false);  // fails pre-fix
```

## Suspected severity

**MEDIUM** — A token that expired exactly one second ago is accepted as valid for
the duration of that second. Minimal real-world window but violates the RFC specification.
Can allow session continuation past the intended expiry boundary.

## Hint

`src/jwt/claims.ts` — `validateClaims()` function. The `exp` comparison uses `<`
where it should use `<=`.

## Expected behavior

`payload.exp <= now` — per RFC 7519 §4.1.4: "The current date/time MUST be before
the expiration date/time listed in the 'exp' claim." A token with `exp === now` is
at or past the expiry boundary and MUST be rejected.

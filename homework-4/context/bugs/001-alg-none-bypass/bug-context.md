# Bug 001 — JWT verifier accepts unsigned tokens (`alg=none` bypass)

## Symptom

Passing a JWT with `"alg":"none"` in the header returns `{ valid: true, claims: {...} }`
without any signature verification. An attacker can forge arbitrary claims by constructing
a JWT with `alg=none`, sign nothing, and have it accepted as valid.

## Reproduction

```bash
# 1. Build an unsigned alg=none token manually:
node -e "
  const h = Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');
  const p = Buffer.from(JSON.stringify({sub:'attacker',exp:9999999999})).toString('base64url');
  console.log(h + '.' + p + '.');
" > /tmp/none-token.txt

# 2. Verify it against the CLI — observe valid:true without any secret:
npm run cli -- verify "$(cat /tmp/none-token.txt)"
# Expected: { "valid": false, "error": "..." }
# Actual:   { "valid": true, "claims": { "sub": "attacker", ... } }

# 3. Alternatively use the pre-generated fixture:
npm run cli -- verify "$(cat tests/fixtures/alg-none-token.txt)"
```

## Suspected severity

**CRITICAL** — Bypasses authentication entirely. Any system trusting this verifier
can be compromised by an unsigned token claiming any identity.

## Hint

`src/jwt/verifier.ts` — `verifyToken()` function. Look for an early-return branch
that checks `header.alg === 'none'`.

## Expected behavior

Any `alg=none` token MUST be rejected with `{ valid: false, error: "unsupported algorithm: none" }`
or similar. The verifier must always perform signature verification for HS256 tokens
and must never accept tokens that skip signing.

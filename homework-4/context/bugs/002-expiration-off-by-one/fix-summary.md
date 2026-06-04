---

### Changes Made

**File:** `src/jwt/claims.ts`
**Change:** Changed `payload.exp < now` to `payload.exp <= now` on line 6, so a token whose `exp` equals the current Unix timestamp is correctly rejected per RFC 7519 §4.1.4 (which requires the current time to be *before* the expiration time, not equal to it).
**Before:**
```
  if (payload.exp !== undefined && payload.exp < now) {         // Bug 002 — should be <=
```
**After:**
```
  if (payload.exp !== undefined && payload.exp <= now) {
```

---

### Overall Status

`ALL CHANGES APPLIED`

---

### Manual Verification Steps

1. In a terminal, navigate to the homework-4 directory:
   ```
   cd /Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering/homework-4
   ```
2. Create a JWT where `exp` is set to the exact current Unix second:
   ```
   node -e "
   const now = Math.floor(Date.now() / 1000);
   console.log('exp at boundary (should be REJECTED):', now);
   "
   ```
3. Use that `exp` value to build a test token and call `validateClaims` — the result should be `{ valid: false, error: 'expired' }`.
4. Set `exp = now + 1` — the result should be `{ valid: true, ... }` (not yet expired).
5. Run the targeted test file to confirm all four cases pass:
   ```
   npx vitest run tests/jwt-verifier.test.ts
   ```

---

### References

- **Read** `src/jwt/claims.ts` lines 1–15 (full file) — confirmed before snippet at line 6
- **Edit** `src/jwt/claims.ts` line 6 — applied the `<=` fix

## Test Results (orchestrator-recorded)
```

 RUN  v3.2.6 /Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering/homework-4

 ✓ tests/pipeline/claude-runner.test.ts (7 tests) 5ms
 ✓ tests/jwt-unit.test.ts (13 tests) 6ms
 ❯ tests/jwt-verifier.test.ts (5 tests | 1 failed) 11ms
   ✓ verifyToken — baseline behavior > happy path: valid signed token → valid:true with claims 3ms
   ✓ verifyToken — baseline behavior > wrong secret: signed with X, verified with Y → bad signature 1ms
   ✓ verifyToken — baseline behavior > rejects alg=none (Bug 001 — failing pre-fix) 0ms
   ✓ verifyToken — baseline behavior > expiration boundary inclusive (Bug 002 — failing pre-fix) 0ms
   × verifyToken — baseline behavior > signature comparison is constant-time (Bug 003 — failing pre-fix) 6ms
     → expected 'import { createHmac } from \'node:cry…' to match /timingSafeEqual/
 ✓ tests/jwt-verifier/verifier.test.ts (3 tests) 7ms
 ✓ tests/pipeline/agent-loader.test.ts (11 tests) 16ms
 ✓ tests/pipeline/validators.test.ts (7 tests) 120ms
 ✓ tests/pipeline/stages.test.ts (7 tests) 193ms
 ✓ tests/pipeline/messages.test.ts (3 tests) 3ms
 ✓ tests/pipeline/skill-loader.test.ts (7 tests) 7ms

 Test Files  1 failed | 8 passed (9)
      Tests  1 failed | 62 passed (63)
   Start at  11:49:49
   Duration  884ms (transform 328ms, setup 0ms, collect 676ms, tests 367ms, environment 1ms, prepare 1.11s)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/jwt-verifier.test.ts > verifyToken — baseline behavior > signature comparison is constant-time (Bug 003 — failing pre-fix)
AssertionError: expected 'import { createHmac } from \'node:cry…' to match /timingSafeEqual/

[32m- Expected:[39m 
/timingSafeEqual/

[31m+ Received:[39m 
"import { createHmac } from 'node:crypto';

export function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  return signature === expected;                                // Bug 003 — timing-attack vulnerable
}
"

 ❯ tests/jwt-verifier.test.ts:39:17
     37|   test('signature comparison is constant-time (Bug 003 — failing pre-f…
     38|     const src = readFileSync('src/jwt/signature.ts', 'utf-8');
     39|     expect(src).toMatch(/timingSafeEqual/);
       |                 ^
     40|     expect(src).not.toMatch(/===\s*expected|signature\s*===/);
     41|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


```

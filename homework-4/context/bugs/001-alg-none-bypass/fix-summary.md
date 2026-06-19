---

### Changes Made

**File:** `src/jwt/verifier.ts`
**Change:** Deleted the three-line `if (header.alg === 'none')` short-circuit (lines 16–18) and the blank separator line (line 19). Unsigned tokens now fall through to the existing `header.alg !== 'HS256'` allowlist guard and are rejected with `{ valid: false, error: "unsupported algorithm: none" }`.

**Before:**
```ts
  if (header.alg === 'none') {                                  // Bug 001 — alg=none bypass
    return { valid: true, claims: payload };
  }

  if (header.alg !== 'HS256') {
```

**After:**
```ts
  if (header.alg !== 'HS256') {
```

---

### Overall Status

`ALL CHANGES APPLIED`

---

### Manual Verification Steps

1. `cd homework-4`
2. Craft a JWT with `alg: "none"` (base64url-encode `{"alg":"none","typ":"JWT"}`, add any payload, append an empty signature segment).
3. Call `verifyToken(token)` — expect `{ valid: false, error: "unsupported algorithm: none" }`.
4. Run `npx vitest run tests/jwt-verifier.test.ts` — the `rejects alg=none` test (line 24) must pass; all other tests in the file must remain in their pre-existing state.

---

### References

| File | Action | Lines affected |
|------|--------|---------------|
| `src/jwt/verifier.ts` | Read (pre-edit verification) | 1–35 |
| `src/jwt/verifier.ts` | Edit (4 lines deleted) | 16–19 |
| `context/bugs/001-alg-none-bypass/fix-summary.md` | Read + Edit | updated |

## Test Results (orchestrator-recorded)
```

 RUN  v3.2.6 /Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering/homework-4

 ✓ tests/pipeline/claude-runner.test.ts (7 tests) 5ms
 ✓ tests/pipeline/skill-loader.test.ts (7 tests) 8ms
 ✓ tests/jwt-unit.test.ts (13 tests) 8ms
 ❯ tests/jwt-verifier.test.ts (5 tests | 2 failed) 10ms
   ✓ verifyToken — baseline behavior > happy path: valid signed token → valid:true with claims 3ms
   ✓ verifyToken — baseline behavior > wrong secret: signed with X, verified with Y → bad signature 1ms
   ✓ verifyToken — baseline behavior > rejects alg=none (Bug 001 — failing pre-fix) 0ms
   × verifyToken — baseline behavior > expiration boundary inclusive (Bug 002 — failing pre-fix) 4ms
     → expected true to be false // Object.is equality
   × verifyToken — baseline behavior > signature comparison is constant-time (Bug 003 — failing pre-fix) 1ms
     → expected 'import { createHmac } from \'node:cry…' to match /timingSafeEqual/
 ✓ tests/pipeline/validators.test.ts (7 tests) 73ms
 ✓ tests/pipeline/agent-loader.test.ts (11 tests) 14ms
 ✓ tests/pipeline/stages.test.ts (7 tests) 104ms
 ✓ tests/pipeline/messages.test.ts (3 tests) 3ms

 Test Files  1 failed | 7 passed (8)
      Tests  2 failed | 58 passed (60)
   Start at  11:35:05
   Duration  757ms (transform 294ms, setup 0ms, collect 619ms, tests 224ms, environment 2ms, prepare 1.16s)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/jwt-verifier.test.ts > verifyToken — baseline behavior > expiration boundary inclusive (Bug 002 — failing pre-fix)
AssertionError: expected true to be false // Object.is equality

[32m- Expected[39m
[31m+ Received[39m

[32m- false[39m
[31m+ true[39m

 ❯ tests/jwt-verifier.test.ts:33:34
     31|     vi.setSystemTime(new Date(1_700_000_000_000));
     32|     const t = signedToken({ sub: 'alice', exp: 1_700_000_000 });
     33|     expect(verifyToken(t).valid).toBe(false);
       |                                  ^
     34|     expect(verifyToken(t).error).toMatch(/expired/);
     35|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


```

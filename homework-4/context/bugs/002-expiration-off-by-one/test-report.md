Two files written:

- **`tests/jwt-verifier/claims.test.ts`** — 4 FIRST-compliant tests for the Bug 002 fix
- **`context/bugs/002-expiration-off-by-one/test-report.md`** — full report with all four required sections

---

### Test design summary

| Test | Category | What it proves |
|---|---|---|
| `accepts token with exp well in the future` | Happy path | Non-expired token (`exp = now + 3600`) returns `{ valid: true }` — fix didn't regress the normal accept path |
| `rejects token where exp equals current time (Bug 002 regression)` | Bug regression | `exp === now` now returns `{ valid: false, error: 'expired' }` — the exact boundary case that the `< → <=` fix addresses |
| `accepts token where exp is one second in the future` | Edge case | `exp = now + 1` is still valid — confirms the fix only tightened the boundary by exactly one position |
| `rejects token with exp one second in the past` | Edge case | `exp = now - 1` is still rejected — pre-existing behaviour preserved |

All four tests use `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())` with `vi.setSystemTime(new Date(1_700_000_000_000))` and `now()` from `jwt-fixtures` for full FIRST compliance. The `signedToken`/`unsignedToken` imports are included per the mandatory constraint even though `validateClaims` is tested with `Claims` objects directly (no JWT string construction needed for this unit test).

## Final Test Run (orchestrator-recorded)
```

 RUN  v3.2.6 /Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering/homework-4

 ✓ tests/pipeline/skill-loader.test.ts (7 tests) 5ms
 ✓ tests/jwt-verifier/verifier.test.ts (3 tests) 5ms
 ✓ tests/jwt-unit.test.ts (13 tests) 6ms
 ❯ tests/jwt-verifier.test.ts (5 tests | 1 failed) 10ms
   ✓ verifyToken — baseline behavior > happy path: valid signed token → valid:true with claims 3ms
   ✓ verifyToken — baseline behavior > wrong secret: signed with X, verified with Y → bad signature 1ms
   ✓ verifyToken — baseline behavior > rejects alg=none (Bug 001 — failing pre-fix) 0ms
   ✓ verifyToken — baseline behavior > expiration boundary inclusive (Bug 002 — failing pre-fix) 0ms
   × verifyToken — baseline behavior > signature comparison is constant-time (Bug 003 — failing pre-fix) 5ms
     → expected 'import { createHmac } from \'node:cry…' to match /timingSafeEqual/
 ✓ tests/pipeline/validators.test.ts (7 tests) 61ms
 ✓ tests/pipeline/agent-loader.test.ts (11 tests) 14ms
 ✓ tests/pipeline/stages.test.ts (7 tests) 68ms
 ✓ tests/pipeline/claude-runner.test.ts (7 tests) 10ms
 ✓ tests/jwt-verifier/claims.test.ts (4 tests) 5ms
 ✓ tests/pipeline/messages.test.ts (3 tests) 2ms

 Test Files  1 failed | 9 passed (10)
      Tests  1 failed | 66 passed (67)
   Start at  11:52:12
   Duration  754ms (transform 315ms, setup 0ms, collect 693ms, tests 186ms, environment 1ms, prepare 1.02s)



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

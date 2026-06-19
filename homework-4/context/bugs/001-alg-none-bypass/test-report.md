Two files written:

- **`tests/jwt-verifier/verifier.test.ts`** — 3 FIRST-compliant tests for the Bug 001 fix
- **`tests/jwt-verifier/test-report.md`** — full report with all four required sections

---

### Test design summary

| Test | Category | What it proves |
|---|---|---|
| `accepts valid HS256 token after alg=none bypass removed` | Happy path | The deletion didn't break the normal HS256 flow |
| `rejects alg=none token with exact algorithm error message` | Bug regression | The `alg=none` bypass is gone; exact error string `'unsupported algorithm: none'` is returned |
| `alg=none token rejected via algorithm check, not claims validation` | Edge case | The `header.alg !== 'HS256'` guard fires *before* claims — an expired-payload unsigned token produces an algorithm error, not an expiration error |

All three tests use `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())` with `vi.setSystemTime(new Date(1_700_000_000_000))` and absolute `exp` values for full FIRST compliance.

## Final Test Run (orchestrator-recorded)
```

 RUN  v3.2.6 /Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering/homework-4

 ✓ tests/pipeline/skill-loader.test.ts (7 tests) 4ms
 ✓ tests/pipeline/claude-runner.test.ts (7 tests) 6ms
 ✓ tests/jwt-unit.test.ts (13 tests) 6ms
 ❯ tests/jwt-verifier.test.ts (5 tests | 2 failed) 11ms
   ✓ verifyToken — baseline behavior > happy path: valid signed token → valid:true with claims 3ms
   ✓ verifyToken — baseline behavior > wrong secret: signed with X, verified with Y → bad signature 1ms
   ✓ verifyToken — baseline behavior > rejects alg=none (Bug 001 — failing pre-fix) 0ms
   × verifyToken — baseline behavior > expiration boundary inclusive (Bug 002 — failing pre-fix) 6ms
     → expected true to be false // Object.is equality
   × verifyToken — baseline behavior > signature comparison is constant-time (Bug 003 — failing pre-fix) 1ms
     → expected 'import { createHmac } from \'node:cry…' to match /timingSafeEqual/
 ✓ tests/pipeline/validators.test.ts (7 tests) 64ms
 ✓ tests/pipeline/agent-loader.test.ts (11 tests) 12ms
 ✓ tests/pipeline/stages.test.ts (7 tests) 96ms
 ✓ tests/pipeline/messages.test.ts (3 tests) 2ms
 ✓ tests/jwt-verifier/verifier.test.ts (3 tests) 5ms

 Test Files  1 failed | 8 passed (9)
      Tests  2 failed | 61 passed (63)
   Start at  11:37:35
   Duration  730ms (transform 362ms, setup 0ms, collect 658ms, tests 206ms, environment 1ms, prepare 1.08s)



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

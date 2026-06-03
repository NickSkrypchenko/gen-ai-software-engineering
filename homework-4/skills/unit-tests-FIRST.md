# Unit Tests — FIRST Principles

> A rubric for writing unit tests that are Fast, Independent, Repeatable, Self-validating,
> and Timely. The Unit Test Generator uses this skill to produce FIRST-compliant Vitest
> tests for code changed by the Bug Fixer. Every generated test must be checked against
> each letter before it is written to disk.

## Levels

| Letter | Principle | Pass condition | Fail condition |
|---|---|---|---|
| **F** | Fast | Completes in <100 ms. No real network calls. No real filesystem I/O (use in-memory or tmp). No real timers (`vi.useFakeTimers()` where `Date.now()` or `setTimeout` is involved). | Test takes >100 ms, or makes HTTP requests, or reads production files. |
| **I** | Independent | Passes regardless of execution order. No shared mutable state between tests. `beforeEach` resets all state. **`vi.useFakeTimers()` MUST be paired with `vi.useRealTimers()` in `afterEach`** — failing to restore real timers leaks fake time into subsequent tests. | Test depends on another test's side effects, or fake timers leak across test boundaries. |
| **R** | Repeatable | Same input → same result on any machine, in any timezone, at any time. No raw `Date.now()` without injection. No randomness without a fixed seed. No environment-specific paths. | Test passes locally but fails in CI, or fails on a different day. |
| **S** | Self-validating | Test produces a binary pass/fail. No "check console output manually." Single assertion per test, or tightly grouped assertions on one behavior. | Test has no assertions, or always passes regardless of behavior, or requires human interpretation. |
| **T** | Timely | Tests cover only code that changed in the current fix. Do not retest existing behavior that is already covered. Written concurrently with the fix, not after the fact. | Tests cover unchanged code, or duplicate existing coverage. |

## Application

Follow these steps when generating tests for changed code:

1. **Read `fix-summary.md`** to identify which functions and files were changed. List them explicitly before writing any test.
2. **For each changed function**, plan three test categories:
   - **Happy path** — correct input produces expected output.
   - **Bug regression** — input that previously triggered the bug now behaves correctly (e.g., `alg=none` token must return `valid: false` after Bug 001 fix).
   - **Edge case** — boundary value, empty input, or off-by-one that the fix touches (e.g., `exp === now` for Bug 002).
3. **Before writing each test**, self-check all five letters (F/I/R/S/T):
   - Does it call real timers? → wrap in `vi.useFakeTimers()` / `vi.useRealTimers()`.
   - Does it read a real file or network? → mock or use test fixtures.
   - Is the expected value hardcoded without date injection? → fix with `vi.setSystemTime`.
   - Does it have at least one `expect(...)` call? → yes, always.
   - Is the function under test in `fix-summary.md`? → if not, skip.
4. **Use existing project test patterns.** Look at `tests/jwt-verifier.test.ts` for import style, describe/it nesting, and vi.mock usage. Replicate the same structure.
5. **Write tests via the `Write` tool** to `tests/jwt-verifier/<changed-module>.test.ts`.
   One file per changed module. Do not append to existing files without reading them first.
6. **Fill the test-report** with one row per test: name, what it covers, FIRST compliance ✓/✗ per letter. If any letter is ✗, explain why (and whether it is an acceptable compromise).

**Worked example — FIRST Independent violation and fix:**

```ts
// WRONG — vi.useFakeTimers without afterEach cleanup
describe('claims', () => {
  beforeEach(() => vi.useFakeTimers());   // ✗ I: no cleanup!

  test('expired token rejected', () => { ... });
});

// CORRECT — paired beforeEach / afterEach
describe('claims', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());   // ✓ I: cleanup ensures independence

  test('expired token rejected', () => { ... });
});
```

## Required output sections

The `test-report.md` document MUST contain all four of these sections:

1. **Tests Generated** — table with one row per test: file path, test name, what behavior it covers, and FIRST compliance check (✓/✗ per letter). Example:

   | File | Test name | Covers | F | I | R | S | T |
   |---|---|---|---|---|---|---|---|
   | tests/jwt-verifier/claims.test.ts | rejects token with exp === now | Bug 002 boundary fix | ✓ | ✓ | ✓ | ✓ | ✓ |

2. **Test Run Results** — placeholder section. The orchestrator appends the actual `vitest` output here after running `npm test`. Leave a note: `[orchestrator appends test run results here]`.

3. **Coverage Delta** — rough estimate per changed file: e.g., "+12% line coverage on src/jwt/claims.ts". Based on which branches the new tests exercise, not a precise measurement.

4. **FIRST Violations** — any test that could not fully satisfy a principle, with the reason and the mitigation applied. If all tests are fully FIRST-compliant, write "None."

## Examples

### Example 1 — Bug 001 fix (alg=none bypass removed)

**Changed file:** `src/jwt/verifier.ts` — removed `if (header.alg === 'none') return { valid: true }`.

**Generated tests:**
```ts
describe('verifyToken — alg=none fix', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('rejects token with alg=none', () => {                    // F✓ I✓ R✓ S✓ T✓
    const token = unsignedToken({ sub: 'x', exp: 9_999_999_999 });
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/none|unsupported/);
  });

  test('still accepts valid HS256 token after fix', () => {      // F✓ I✓ R✓ S✓ T✓
    const token = signedToken({ sub: 'x', exp: 9_999_999_999 });
    expect(verifyToken(token).valid).toBe(true);
  });
});
```

### Example 2 — Bug 002 fix (exp off-by-one)

**Changed file:** `src/jwt/claims.ts` — `payload.exp < now` changed to `payload.exp <= now`.

**Generated tests:**
```ts
describe('validateClaims — expiration boundary', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('rejects token where exp equals current time', () => {    // F✓ I✓ R✓ S✓ T✓
    vi.setSystemTime(new Date(1_700_000_000_000));
    const token = signedToken({ sub: 'x', exp: 1_700_000_000 });
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });

  test('accepts token where exp is one second in the future', () => { // F✓ I✓ R✓ S✓ T✓
    vi.setSystemTime(new Date(1_700_000_000_000));
    const token = signedToken({ sub: 'x', exp: 1_700_000_001 });
    expect(verifyToken(token).valid).toBe(true);
  });
});
```

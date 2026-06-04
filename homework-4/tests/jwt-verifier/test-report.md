# Test Report — Bug 001 alg=none Bypass Fix

## Changed Functions

| File | Function | Change |
|---|---|---|
| `src/jwt/verifier.ts` | `verifyToken` | Deleted 3-line `if (header.alg === 'none') return { valid: true }` short-circuit; `alg=none` tokens now fall through to the `header.alg !== 'HS256'` guard and return `{ valid: false, error: "unsupported algorithm: none" }` |

---

## Tests Generated

| File | Test name | Covers | F | I | R | S | T |
|---|---|---|---|---|---|---|---|
| `tests/jwt-verifier/verifier.test.ts` | accepts valid HS256 token after alg=none bypass removed | Happy path — confirms the fix did not regress the normal signed-token flow through `verifyToken` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tests/jwt-verifier/verifier.test.ts` | rejects alg=none token with exact algorithm error message | Bug 001 regression — verifies the exact error string `'unsupported algorithm: none'` produced by the newly exercised `header.alg !== 'HS256'` branch (more specific than the existing `/none\|unsupported/` regex in `jwt-verifier.test.ts`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tests/jwt-verifier/verifier.test.ts` | alg=none token rejected via algorithm check, not claims validation | Edge case — expired-payload `alg=none` token proves the algorithm guard fires before claims validation; error must match `/unsupported/` and must NOT match `/expired/` | ✓ | ✓ | ✓ | ✓ | ✓ |

**FIRST compliance notes:**

- **F:** All tests are synchronous and use `vi.useFakeTimers()` — no real I/O, no real network, no real timers.
- **I:** `beforeEach`/`afterEach` pair (`vi.useFakeTimers` / `vi.useRealTimers`) ensures fake time does not leak into other test files.
- **R:** System time is pinned to `new Date(1_700_000_000_000)` and token `exp` values are absolute numbers — results are identical on any machine in any timezone.
- **S:** Each test has exactly one logical assertion group that produces a binary pass/fail.
- **T:** All three tests exercise only the code path altered by Bug 001 — the removal of the `alg=none` bypass in `verifyToken`. Test 1 has partial overlap with the existing happy-path test in `jwt-verifier.test.ts`; it is retained as a direct regression guard scoped to the changed function, not as general coverage expansion.

---

## Test Run Results

[orchestrator appends test run results here]

---

## Coverage Delta

| File | Before fix | After fix (estimated) | Delta |
|---|---|---|---|
| `src/jwt/verifier.ts` | The `alg=none` early-return branch (3 lines) was never reachable from existing test suite after fix — it was dead code that `jwt-verifier.test.ts` line 24 now traverses via the `header.alg !== 'HS256'` guard | New tests add a second `alg=none` call (expired payload variant) and an exact-string assertion on the error message | +~10% branch coverage on `src/jwt/verifier.ts` (the unsupported-alg branch is now exercised by two distinct inputs: valid-exp and expired-exp `alg=none` tokens) |

---

## FIRST Violations

None. All three tests are fully FIRST-compliant:
- Fake timers are set up and torn down in `beforeEach`/`afterEach`.
- All time-dependent values use `vi.setSystemTime` with a fixed absolute epoch.
- No filesystem reads, no network calls, no shared mutable state.

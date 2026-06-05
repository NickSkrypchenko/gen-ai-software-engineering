All snippets confirmed. Here is the implementation plan.

---

### Goal

Change the `exp` comparison in `validateClaims` from strict less-than (`<`) to less-than-or-equal (`<=`) so that a token whose `exp` equals the current Unix timestamp is correctly rejected, in conformance with RFC 7519 §4.1.4.

---

### Files to Change

**File:** `src/jwt/claims.ts`

**Location:** `validateClaims`, line 6

**Before** — exact snippet to replace:

```
  if (payload.exp !== undefined && payload.exp < now) {         // Bug 002 — should be <=
```

**After** — replacement to insert in its place:

```
  if (payload.exp !== undefined && payload.exp <= now) {
```

---

### Order of Operations

1. Apply the single edit above to `src/jwt/claims.ts` line 6. Only one file changes; order is irrelevant by definition.

---

### Verification Command

```
npx vitest run tests/jwt-verifier.test.ts
```

This runs the test file that contains the boundary-inclusive assertion at line 30–35 (Test 4, "expiration boundary inclusive"). All four tests in that file should pass after the fix.

---

### Risk Notes

- **`nbf` symmetry:** The adjacent `nbf` check on line 10 uses strict `>` (`payload.nbf > now`), meaning a token whose `nbf` equals the current time is accepted. RFC 7519 §4.1.5 states "the current date/time MUST be after or equal to the Not Before date/time," which means `nbf === now` should be allowed — so the strict `>` for `nbf` is already correct. No change needed there.
- **Single call site:** `validateClaims` is only called from `verifier.ts:30`. The change affects every token whose `exp` equals the exact current Unix second — a one-second window at the boundary. Tokens with `exp > now` are unaffected; tokens with `exp < now` are unaffected. Only the `exp === now` edge case changes behavior, which is the intended correction.
- No other callers, no database changes, no API contract changes. Regression risk is minimal.
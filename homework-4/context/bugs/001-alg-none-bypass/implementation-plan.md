---

### Goal

Remove the `alg=none` short-circuit in `verifyToken()` so that unsigned tokens fall through to the existing algorithm allowlist, which already rejects any non-HS256 value — including every case/whitespace variant of `"none"`.

---

### Files to Change

**File:** `src/jwt/verifier.ts`

**Location:** `verifyToken()`, lines 16–18

**Before** — exact snippet to replace (copy verbatim from source):

```
  if (header.alg === 'none') {                                  // Bug 001 — alg=none bypass
    return { valid: true, claims: payload };
  }

```

**After** — replacement to insert in its place:

```
```

*(Delete those three lines and the blank line that follows — nothing replaces them.)*

---

### Order of Operations

1. Open `src/jwt/verifier.ts`.
2. Delete lines 16–18 (the `if (header.alg === 'none')` block) **and** the blank line at line 19 that separated it from the allowlist guard.
3. Verify the file now reads: line 14 destructure → line 15 blank (or directly) → the `if (header.alg !== 'HS256')` allowlist check as the first guard after `decode()`.

Order is irrelevant — this is a single-file, single-hunk deletion with no cross-file dependencies.

---

### Verification Command

```bash
npx vitest run tests/jwt-verifier.test.ts
```

The test at line 24 (`rejects alg=none`) must flip from failing to passing. All other tests in the file must continue to pass.

---

### Risk Notes

- **Case variants (`"None"`, `"NONE"`, `"nOnE"`):** The deleted code only guarded the exact lowercase string `'none'`. The surviving allowlist at line 20 (`header.alg !== 'HS256'`) is a strict positive allowlist — every non-`HS256` string is rejected regardless of case, so case variants are already safe after the fix.
- **`alg` field fully absent:** If `header.alg` is `undefined`, it also fails the `!== 'HS256'` check and returns `unsupported algorithm: undefined`. No regression introduced.
- **No other call sites are affected:** The fix is purely subtractive (one deleted branch); the function signature and all other return paths are unchanged. All callers (CLI `verify` command, any downstream) see identical behavior for valid HS256 tokens.
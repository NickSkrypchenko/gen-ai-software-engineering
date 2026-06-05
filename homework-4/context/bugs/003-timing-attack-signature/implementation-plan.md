All references confirmed. Here is the implementation plan.

---

### Goal

Replace the non-constant-time `===` string comparison in `verifySignature` with `crypto.timingSafeEqual` (plus a length pre-check) to eliminate the CWE-208 timing side-channel on HMAC signature validation.

---

### Files to Change

**File:** `src/jwt/signature.ts`

**Location:** `verifySignature`, lines 7–10

**Before** — exact snippet to replace:

```
import { createHmac } from 'node:crypto';

export function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  return signature === expected;                                // Bug 003 — timing-attack vulnerable
}
```

**After** — replacement to insert in its place:

```
import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

### Order of Operations

1. Apply the single edit to `src/jwt/signature.ts` — add `timingSafeEqual` to the import and replace the function body as shown above. This is the only file that changes; order is irrelevant since no other files are modified.

---

### Verification Command

```
npx vitest run tests/jwt-verifier.test.ts
```

This runs the targeted test suite including test 5 (`'signature comparison is constant-time'`) at line 37, which asserts `timingSafeEqual` is present and `===` is absent in the source.

---

### Risk Notes

- **`timingSafeEqual` throws `RangeError` if the two `Buffer` arguments have different byte lengths.** The length pre-check (`signature.length !== expected.length`) guards this. Since both values are base64url strings of equal length for the same HMAC output, the guard will only fire on a tampered/truncated input token — which is the correct early-reject behavior.
- **No call-site changes needed.** `verifySignature` has exactly one caller (`src/jwt/verifier.ts:26`); its signature is unchanged; `verifier.ts` requires no edit.
- **No behavioral change for valid tokens.** The new code returns the same boolean for every input; the only difference is that the wall-clock time of the comparison is now independent of how many leading characters match.
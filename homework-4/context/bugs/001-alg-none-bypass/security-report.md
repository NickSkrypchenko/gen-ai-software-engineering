## Summary

**Findings by severity:** CRITICAL: 0 · HIGH: 0 · MEDIUM: 1 · LOW: 1 · INFO: 1

The fix to `src/jwt/verifier.ts` is correct and closes the `alg=none` authentication bypass cleanly. By deleting the short-circuit, unsigned tokens now fall through to the `header.alg !== 'HS256'` allowlist and are rejected before any signature/claims processing. The allowlist is a positive (allow-known) check rather than a blocklist, which is the right pattern — no new injection, secret-handling, or crypto regressions were introduced by this change. The empty-secret guard (`if (!jwtSecret)`) is preserved and correctly prevents verification against an empty key.

The remaining concerns are **not in the changed file** but are reachable from it and were left unaddressed: the HMAC signature comparison in `signature.ts` uses `===` (timing-attack vulnerable, Bug 003), and an information-disclosure pattern in error echoing. I report these because the verifier's security guarantee depends on them, but note they are out of scope of the literal `<changed-file>` block.

## Findings

**Severity:** MEDIUM
**File:** `src/jwt/signature.ts:9` (imported and called by `verifier.ts:26`)
**Description:** `verifyToken` rejects bad signatures via `verifySignature(...)`, but that function compares the computed and supplied HMAC with `signature === expected`. JavaScript string equality short-circuits at the first differing byte, leaking timing information that can, over many requests, allow an attacker to forge a valid signature byte-by-byte. This is the unaddressed Bug 003 (confirmed still failing in the test run). The verifier's security depends entirely on this comparison, so the fix to `verifier.ts` does not fully restore token integrity while this remains.
**Remediation:** Use a constant-time comparison over fixed-length buffers:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = sign(signingInput, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // length check first — timingSafeEqual throws on length mismatch
  return a.length === b.length && timingSafeEqual(a, b);
}
```

**Severity:** LOW
**File:** `src/jwt/verifier.ts:17`
**Description:** The error message reflects the attacker-controlled `header.alg` value verbatim: `unsupported algorithm: ${header.alg}`. If this `error` string is ever rendered into an HTML response or log viewer without escaping, it becomes a reflected-XSS / log-injection vector (the `alg` field is fully attacker-controlled JSON). No HTTP endpoint is present in the changed files, so exploitability cannot be confirmed here, but the untrusted value crosses a trust boundary into an output string.
**Remediation:** Avoid echoing the raw value, or sanitize/whitelist it: return a static message such as `'unsupported algorithm'`, or coerce/escape `header.alg` before interpolation. Ensure any consumer escapes `VerifyResult.error` before rendering.

**Severity:** INFO
**File:** `src/jwt/verifier.ts:11`
**Description:** The decode `catch (e: any)` returns `e.message` directly as the error. Depending on what `decode` throws, this could surface internal parsing details to callers. Low risk given decoding is on already-untrusted input, but worth normalizing error messages at the trust boundary to avoid leaking implementation details.
**Remediation:** Map internal exceptions to a generic `'malformed token'` message and log the detailed `e.message` server-side only.

## Scope

**Reviewed:**
- `src/jwt/verifier.ts` (full post-fix content from the `<changed-file>` block)

**Not reviewed (out of scope for this run — not provided as `<changed-file>` blocks):**
- `src/jwt/signature.ts` — referenced via the MEDIUM finding above using the source visible in the test failure output; not independently inspected in full.
- `src/jwt/decoder.ts`, `src/jwt/claims.ts`, `src/types.ts` — imported by the verifier but not provided. Note: Bug 002 (inclusive expiration boundary) lives in `claims.ts` and remains failing per the test run; it is a correctness/auth-window issue but was not in the changed file and is outside this security review's changed-file scope.

The `alg=none` fix itself introduces **no new security issues** and correctly remediates the CRITICAL bypass it targeted.
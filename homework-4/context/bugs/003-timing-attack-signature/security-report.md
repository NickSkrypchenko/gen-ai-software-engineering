## Summary

**Findings by severity:** CRITICAL: 0 · HIGH: 0 · MEDIUM: 1 · LOW: 1 · INFO: 1

The three core fixes are sound. The timing-attack remediation in `signature.ts` correctly replaces `===` with `crypto.timingSafeEqual`, the `alg` allowlist in `verifier.ts` properly defends against the `alg:none` / algorithm-confusion class of attack (Bug 001), and the `exp <= now` comparison in `claims.ts` is correct. No hardcoded secrets, no injection sinks, and no insecure crypto primitives were introduced (HMAC-SHA256 with `base64url` digest is appropriate). The one residual concern is a robustness/DoS edge case in how the timing-safe comparison handles attacker-controlled, non-ASCII signature input — the length pre-check operates on string length while `timingSafeEqual` operates on decoded byte buffers, which can diverge and throw an uncaught exception.

### Findings

**Severity:** MEDIUM
**File:** `src/jwt/signature.ts:9-10`
**Description:** The signature argument is attacker-controlled (it is the third, base64url segment split out of the incoming token). The length guard compares JavaScript **string lengths** (`signature.length !== expected.length`), but `timingSafeEqual` compares the **byte buffers** produced by `Buffer.from(...)`, which defaults to UTF-8 encoding. An attacker can craft a 43-character signature string that contains a multi-byte UTF-8 code point. Its `.length` (UTF-16 code-unit count) can equal `expected.length` (43), passing the guard, while `Buffer.from(signature)` yields more than 43 bytes. `timingSafeEqual` throws a `RangeError` when buffer lengths differ. `verifyToken` only wraps `decode()` in try/catch — not `verifySignature` — so this exception propagates uncaught, turning a malformed token into an unhandled crash / 500 (a low-cost DoS / availability issue). It also means a malformed-but-same-string-length signature is no longer rejected cleanly.
**Remediation:** Compare on explicitly decoded byte buffers and reject decode failures, so string-vs-byte-length divergence cannot occur:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(signingInput, secret), 'base64url');
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
```

This keeps the comparison constant-time over equal-length MAC byte arrays and removes the throw-on-mismatch path. (Alternatively, wrap the call in try/catch and return `false`, but decoding to bytes is cleaner.)

---

**Severity:** LOW
**File:** `src/jwt/verifier.ts:18`
**Description:** The error string `unsupported algorithm: ${header.alg}` reflects an attacker-controlled value (`header.alg`) back into the response payload. Within this module it is returned as a data field, not rendered as HTML, so it is not directly exploitable. However, if a caller surfaces this `error` string in an HTML context (web page, admin log viewer) without escaping, it becomes a reflected-XSS vector, and it also enables minor verifier-fingerprinting. Echoing untrusted input into error messages is a smell worth removing.
**Remediation:** Return a constant message and log the offending value server-side only:

```ts
if (header.alg !== 'HS256') {
  return { valid: false, error: 'unsupported algorithm' };
}
```

---

**Severity:** INFO
**File:** `src/jwt/verifier.ts:21`
**Description:** `const jwtSecret = secret ?? process.env.JWT_SECRET ?? '';` falls back to an empty string and then rejects it via the `if (!jwtSecret)` guard. This is safe (empty secret is refused rather than used), but it is worth confirming at the deployment boundary that `JWT_SECRET` is validated for sufficient entropy/length at startup — HMAC-SHA256 security depends entirely on secret strength, and nothing in the changed files enforces a minimum. No code change required here; flagging as a configuration-hardening note.

### Scope

**Reviewed (from `<changed-file>` blocks):**
- `src/jwt/claims.ts` — no security findings (off-by-one `exp` fix is correct)
- `src/jwt/signature.ts` — MEDIUM finding above
- `src/jwt/verifier.ts` — LOW + INFO findings above

**Not reviewed (out of scope for this run):**
- `src/jwt/decoder.ts` — referenced by `verifier.ts` but not included; its parsing/segment-splitting behavior (and whether it bounds the signature segment) directly affects the MEDIUM finding above and should be reviewed separately.
- `src/types.ts` — type definitions not provided.
- Test files under `tests/jwt-verifier/` and the `context/bugs/**` artifacts — not source code under audit.
All claims verified against source. Every `file:line` reference matches the actual code exactly. Here is the verification report.

---

# Verified Research — Bug 003 (Timing-Attack Signature Comparison)

## Verification Summary

**PASS — Research Quality Level: L3 (Solid).** Every `file:line` reference in the research exists and matches the source character-for-character (whitespace-normalized). The root-cause hypothesis is grounded in a specific code construct (`signature === expected` at `signature.ts:9`), is traceable through two distinct locations (the vulnerable comparison and its sole attacker-facing call site), includes concrete reproduction steps, identifies the exact fix region, and notes the `RangeError` length-mismatch edge case plus a CWE-208 classification. The planner can proceed with confidence; the only gap separating this from L4 is the absence of an explicit "sole call site" impact enumeration (independently confirmed below).

## Verified Claims

| Claim | Result | Evidence |
|---|---|---|
| `src/jwt/signature.ts:9` contains the vulnerable comparison `return signature === expected` | ✓ | Line 9 reads `return signature === expected;` followed by the comment `// Bug 003 — timing-attack vulnerable` |
| `signature.ts:1-10` full-file snippet (imports `createHmac`, `sign()` uses `digest('base64url')`, `verifySignature` computes `expected` then compares) | ✓ | Lines 1–10 match verbatim: `createHmac('sha256', secret).update(signingInput).digest('base64url')` and `const expected = sign(signingInput, secret);` |
| `src/jwt/verifier.ts:26` calls `verifySignature()` as the attacker-facing entry point | ✓ | Line 26: `if (!verifySignature(signingInput, signature, jwtSecret)) {`; line 25 sets `signingInput`; lines 25–28 match the quoted snippet |
| `verifier.ts:20-23` is a secret-presence guard preceding the call | ✓ | Lines 20–23: `const jwtSecret = secret ?? process.env.JWT_SECRET ?? '';` then `if (!jwtSecret) return { valid: false, error: 'JWT_SECRET not configured' };` |
| `tests/jwt-verifier.test.ts:37-41` is a source-inspection detection test failing pre-fix | ✓ | Lines 37–41 match: `readFileSync('src/jwt/signature.ts', ...)`, `expect(src).toMatch(/timingSafeEqual/)`, `expect(src).not.toMatch(/===\s*expected\|signature\s*===/)` |
| Root cause: `===` short-circuits, leaking common-prefix timing (CWE-208) | ✓ | Grounded in `signature.ts:9`; `===` on strings is non-constant-time by language semantics |
| Fix region: replace `===` with `crypto.timingSafeEqual(...)` + length guard (Node throws `RangeError` on length mismatch) | ✓ | Consistent with `signature.ts:9` being the only comparison; matches the bug-context expected behavior |

## Discrepancies Found

None. All file paths, line numbers, and code snippets match the source under whitespace normalization.

## Research Quality Assessment

**L3 — Solid.** All five `file:line` references are verified against the source with zero discrepancies. The root-cause hypothesis is not a paraphrase of the symptom — it cites a concrete construct (`return signature === expected` at `signature.ts:9`) and explains the mechanism (V8 string equality short-circuits on the first differing byte, making wall-clock time proportional to the shared-prefix length). The bug is traceable through **two distinct code locations**: the failure site (`signature.ts:9`) and the attacker-facing call site (`verifier.ts:26`), with the intermediate reachability guard (`verifier.ts:20-23`) correctly characterized. Reproduction steps are concrete (`npx vitest run tests/jwt-verifier.test.ts`, naming the exact failing assertions), the fix region is precisely identified (single line), one edge case is noted (`timingSafeEqual` throws `RangeError` on unequal buffer lengths, requiring a length pre-check), and the weakness is classified (CWE-208). It falls short of L4 only because it does not explicitly perform an impact analysis enumerating other call sites of `verifySignature`; an independent grep confirms `verifier.ts:26` is in fact the **sole** caller in `src/`, so the omission carries no hidden risk — the planner may proceed.

## References

- `src/jwt/signature.ts:1-10` (cited line 9)
- `src/jwt/verifier.ts:14`, `:20-23`, `:25-28` (cited line 26)
- `tests/jwt-verifier.test.ts:37-41`
- Grep `verifySignature` across `homework-4/` — confirms single call site at `src/jwt/verifier.ts:26`
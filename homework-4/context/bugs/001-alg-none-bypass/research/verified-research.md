# Verified Research — Bug 001 (alg=none bypass)

## Verification Summary

**PASS — Research Quality Level: L3 (Solid).** Every `file:line` reference in the research exists and every code snippet matches the source character-for-character (whitespace normalization only). The root-cause hypothesis is grounded in a specific conditional (`verifier.ts:16–18`), traced through multiple corroborating locations (verifier, decoder, test, fixture), with concrete reproduction steps and an identified fix region. The planner can proceed.

## Verified Claims

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | `src/jwt/verifier.ts:16–18` early-returns `{ valid: true, claims: payload }` when `header.alg === 'none'` | ✓ | Lines 16–18 confirmed verbatim: `if (header.alg === 'none') {` → `return { valid: true, claims: payload };`, with the inline comment `// Bug 001 — alg=none bypass` |
| 2 | The `alg=none` branch precedes the allowlist check `if (header.alg !== 'HS256')` | ✓ | Allowlist guard confirmed at `verifier.ts:20–22`, which returns `unsupported algorithm: ${header.alg}` — unreachable for `none` due to short-circuit at line 16 |
| 3 | `src/jwt/decoder.ts:8–32` splits into 3 parts but does not reject `alg=none` | ✓ | `decode()` at lines 8–32 validates 3-part structure (line 10) and non-empty header/payload (line 14) only; no `alg` inspection present |
| 4 | `src/types.ts:1–5` types `Header.alg` as `string` (no constraint) | ✓ | Lines 1–5 confirm `interface Header { alg: string; typ?: string; [key: string]: unknown; }` |
| 5 | `tests/fixtures/alg-none-token.txt:1` is the pre-built unsigned attack token | ✓ | Line 1 matches exactly; header segment `eyJhbGciOiJub25lIi...` decodes to `{"alg":"none","typ":"JWT"}`, empty trailing signature |
| 6 | `tests/jwt-verifier.test.ts:24–28` asserts `alg=none` must be rejected (failing pre-fix) | ✓ | Lines 24–28 match verbatim, including `expect(verifyToken(t).error).toMatch(/none|unsupported/)` |
| 7 | `tests/jwt-fixtures.ts:24–28` `unsignedToken()` constructs `alg=none` tokens | ✓ | Lines 24–28 match verbatim: `b64url({ alg: 'none', typ: 'JWT' })` and trailing-dot empty signature |
| 8 | Root cause: removing the `verifier.ts:16` short-circuit lets the existing line 20 guard reject `none` | ✓ | Confirmed by control-flow: `none ≠ HS256`, so line 20–21 would return `unsupported algorithm: none` |

## Discrepancies Found

None. All eight claims verified against source with exact matches.

## Research Quality Assessment

**L3 — Solid.** All `file:line` references were verified and every snippet matched the source under whitespace normalization. The root-cause hypothesis is grounded in a specific code construct — the conditional `if (header.alg === 'none')` at `verifier.ts:16` returning `{ valid: true }` before the algorithm allowlist at line 20 — rather than restating the symptom. The bug is traceable through more than two distinct locations: the faulty branch in `verifier.ts`, the `decoder.ts` path that passes `alg` through unchecked, and the corroborating test (`jwt-verifier.test.ts:24`) plus attack fixtures (`alg-none-token.txt`, `jwt-fixtures.ts:unsignedToken`). Concrete reproduction is described (CLI invocation against the fixture, and `npx vitest run`), and the fix region is precisely identified (delete the lines 16–18 short-circuit; the line 20 guard then handles rejection). It falls short of L4 because the research omits edge-case analysis (e.g. case/whitespace variants such as `"None"`, `"NONE"`, or `"nOnE"` that an attacker could try against the lowercase string compare), provides no impact analysis of other `verifyToken` call sites (e.g. the CLI `verify` command), and does not reference the well-known JWT `alg=none` vulnerability class (CVE-2015-9235 / RFC 8725 §2.1) despite this being a classic, documented attack.

## References

- `src/jwt/verifier.ts:6–35` (root-cause branch at 16–18; allowlist guard at 20–22)
- `src/jwt/decoder.ts:8–32`
- `src/types.ts:1–5`
- `tests/fixtures/alg-none-token.txt:1`
- `tests/jwt-verifier.test.ts:24–28`
- `tests/jwt-fixtures.ts:24–28`
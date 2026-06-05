# Research Quality Measurement

> A rubric for evaluating the quality of bug research produced by the Bug Researcher agent.
> The Research Verifier uses this skill to assign a quality level to `codebase-research.md`
> and produce `verified-research.md`. Higher levels indicate research that is plan-ready
> with high confidence; lower levels block progression until gaps are filled.

## Levels

| Level | Label | Definition |
|---|---|---|
| L0 | Unverifiable | References to files/lines that do not exist, or code snippets that do not match the actual source. Researcher has hallucinated file paths, line numbers, or code content. |
| L1 | Speculative | All file:line references exist and snippets match source, but the root-cause hypothesis is not grounded in code — it restates the bug description without citing specific code paths. Investigation is incomplete. |
| L2 | Adequate | All references verified. Root-cause hypothesis is supported by at least one piece of concrete evidence from the code (a specific conditional, a function call, a missing check). Sufficient for the planner to proceed, but carries risk of missed edge cases. |
| L3 | Solid | Verified references + root cause traceable through two or more code locations + reproduction steps described + the likely fix region identified. Plan-ready. |
| L4 | Comprehensive | All of L3, plus: edge cases noted (boundary values, concurrent access, etc.), impact analysis of other call sites, and related historical bugs or CVEs referenced if applicable. Plan-ready with high confidence. |

## Application

Follow these steps when producing `verified-research.md`:

1. **Load source files.** For every `file:line` reference in `codebase-research.md`, use the `Read` tool to fetch lines ±3 around the cited line.
2. **Compare snippets character-by-character.** Allow only whitespace normalization (leading/trailing spaces, single vs. double space). Any other difference is a discrepancy. Record ✓ (match) or ✗ (mismatch) per claim.
3. **Evaluate root-cause grounding.** Does the hypothesis cite at least one specific code construct (a conditional, a return value, a missing boundary check)? A hypothesis that only paraphrases the bug description is L1 or lower.
4. **Count corroborating locations.** Trace the bug from the entry point to the failure site. Two or more distinct code locations cited = L3 candidate.
5. **Check presence of:** reproduction steps (concrete command or call sequence), edge case discussion (boundary values, off-by-one, etc.), impact analysis (other callers of the buggy function), CVE/advisory references if the bug class is known.
6. **Assign a single Level (L0–L4)** with a one-sentence justification citing what was or was not present. The level drives whether the Bug Planner can proceed.

**When to block progression:**
- L0 → stop. Research must be redone. Document what was hallucinated.
- L1 → proceed with caution. Note the speculation in Discrepancies Found.
- L2+ → planner can proceed. Note any missing analysis as informational.

## Required output sections

The `verified-research.md` document MUST contain all five of these sections (in order):

1. **Verification Summary** — one paragraph: overall pass/fail verdict, Research Quality Level (e.g. "L3 Solid"), and one sentence on whether the planner can proceed.
2. **Verified Claims** — table or list with one row per claim from `codebase-research.md`: claim text, ✓/✗, and brief evidence (file:line + snippet excerpt or "not found").
3. **Discrepancies Found** — per discrepancy: what was claimed vs. what the source actually shows, and the impact on the root-cause hypothesis. If none, write "None."
4. **Research Quality Assessment** — the assigned level (L0–L4) with a paragraph of reasoning citing specific code evidence.
5. **References** — flat list of `file:line` entries used during verification, for auditing.

## Examples

### Example 1 — L0 (Unverifiable)

**Input fragment from codebase-research.md:**
> Affected file: `src/auth/middleware.ts:42` — `if (token === null) return next()` allows unauthenticated access.

**Verifier action:** Read `src/auth/middleware.ts` lines 39–45. File does not contain that pattern; line 42 is `const user = req.headers['x-user']`.

**Correct output excerpt:**
```
## Verified Claims
| Claim | Result | Evidence |
|---|---|---|
| src/auth/middleware.ts:42 has null-token bypass | ✗ | Line 42 is `const user = req.headers['x-user']`; pattern not found in file |

## Research Quality Assessment
**L0 — Unverifiable.** The cited file exists but the snippet does not match any line in the file.
The root-cause hypothesis cannot be evaluated. Research must be redone.
```

### Example 2 — L3 (Solid)

**Input fragment from codebase-research.md:**
> `src/jwt/claims.ts:14` — `if (payload.exp < now)` should be `<=` per RFC 7519 §4.1.4.
> Root cause: boundary not inclusive; a token with `exp === now` passes validation incorrectly.

**Verifier action:** Read `src/jwt/claims.ts` lines 11–17. Confirms `if (payload.exp < now)` at line 14. Also reads `src/jwt/verifier.ts` where `validateClaims` is called — confirms the call site.

**Correct output excerpt:**
```
## Verified Claims
| Claim | Result | Evidence |
|---|---|---|
| src/jwt/claims.ts:14 uses strict < for exp check | ✓ | `if (payload.exp < now)` confirmed at line 14 |
| Root cause: boundary inclusive per RFC 7519 §4.1.4 | ✓ | RFC 7519 §4.1.4 states exp is inclusive; `<` is incorrect |

## Research Quality Assessment
**L3 — Solid.** All file:line references verified. Root cause traceable through two code
locations (claims.ts:14 + verifier.ts call site). Reproduction step described
(token with exp === now returns valid:true). Fix region identified (claims.ts line 14).
No edge case or CVE discussion — not required for this straightforward boundary fix.
```

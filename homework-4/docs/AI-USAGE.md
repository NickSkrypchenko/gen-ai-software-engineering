# AI Tools — Usage Log (HW4)

> Living document — appended after each code-producing phase (0-9, 12). Consolidated in Phase 14.

---

## Context-Model-Prompt summary table

| Phase | Surface | Context | Model | Prompt strategy |
|---|---|---|---|---|
| 0 | Scaffold | This spec | Sonnet 4.6 | Imperative kickoff prompt |
| 1 | Skills (research-quality, FIRST) | Spec §4 + Task 1.2/4.2 briefs | Sonnet 4.6 | 2 skill .md files per defined shape |
| 2 | Sample JWT app | Spec §5 + 3 seeded-bug specs | Sonnet 4.6 | src/jwt/*, src/index.ts, types |
| 3 | Baseline tests + fixtures | Spec §7.1, §7.5 | Sonnet 4.6 | 5 baseline tests + jwt-fixtures.ts + generate-fixtures.ts |
| 4 | Bug context files | Spec §5.6 | Sonnet 4.6 | 3 files in context/bugs/<ID>/ |
| 5 | Loaders + validators | Spec §3.2, §4.5 | Sonnet 4.6 | agent-loader, skill-loader, validators + unit tests |
| 6 | Claude runner + messages | Spec §6.4, §6.6 | Sonnet 4.6 | ~40 LOC subprocess wrapper + 6 unit tests (mocked execFile) |
| 7 | Stages | Spec §6.5 | Sonnet 4.6 | Sequential 1-4 + allSettled 5-6 + unit tests |
| 8 | Run-pipeline entry | Spec §6.2 | Sonnet 4.6 | CLI argv parsing, startup validation, integrates phases 5-7 |
| 9 | 6 agents (.agent.md) | Spec §3 per-agent contract | Sonnet 4.6 | 6 markdown files with frontmatter + prompts |
| 10 | E2E manual pipeline run | Built pipeline + 3 bugs | Mixed (Opus 4.8 / Sonnet 4.6 per agent via --model flag) | npm run pipeline -- --bug <ID> × 3 |
| 11 | Code review | Branch diff + review-brief.md | /codex:review | Skill invocation |
| 12 | README + agent justifications | Spec + final repo | claude-opus-4-8 | Opus for per-agent model justification (brief's showcase) |
| 12 | HOWTORUN | Spec + final scripts | claude-sonnet-4-6 | Cold-start runbook |
| 13 | Screenshots | Pipeline runs + final code | Playwright MCP (fallback: manual) | Tool orchestration |
| 14 | AI-USAGE consolidation | Conversation + per-phase notes | Sonnet 4.6 | Editorial pass |
| 15 | PR | All commits | Sonnet 4.6 | PR body composition |

---

## Phase 0: Scaffold

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- `homework-4/docs/specs/2026-06-02-4-agent-pipeline-design.md` (full spec, §0-§11)
- `homework-4/TASKS.md` (brief requirements)
- Repo top-level `README.md` (submission rules)

**Prompt:** _(verbatim kickoff from user)_
> You are implementing Homework 4 — 4-Agent Pipeline as the implementation driver for this repo. The full design spec is at: `homework-4/docs/specs/2026-06-02-4-agent-pipeline-design.md`. Step 0 — read the spec end-to-end before doing anything else. [...] Once I confirm, execute Phase 0 (scaffold). Commit. Summarize. Then proceed phase-by-phase in order without asking — phases 0 → 8 don't need approvals between them as long as quality gates are green and you keep me in the loop with a one-line summary per phase.

**Outcome:** accepted

**What changed and why:**
Created full project scaffold: `package.json` (deps: vitest, gray-matter, zod, dotenv, pino, tsx — no @anthropic-ai/sdk), `tsconfig.json` (CommonJS/Node module resolution for tsx compatibility), `vitest.config.ts` (perFile coverage ≥85%, excludes entry points), `.gitignore`, `.env.example`. Folder skeleton: agents/, skills/, scripts/pipeline/, src/jwt/, tests/pipeline/, context/bugs/, docs/reviews/, docs/screenshots/. All pipeline modules created: full implementations of agent-loader (Zod-validated gray-matter parsing), skill-loader (required-header validation), validators (claude/git/npx system dep checks), messages (XML builder); stubs for claude-runner and stages (to be filled at Phases 6-7). Exit criteria verified: `tsx scripts/run-pipeline.ts --bug nonexistent` exits 2 with `Bug not found: context/bugs/nonexistent/bug-context.md`.

---

## Phase 2: Sample JWT app

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §5 (sample JWT verifier CLI, 5 sections + decoder shape §5.7)
- Spec §5.3-5.5 (3 seeded bug specs, exact code with bug markers)

**Prompt:** _(authoring phase — spec §5 consumed directly)_
> Implement src/types.ts, src/jwt/decoder.ts, src/jwt/signature.ts, src/jwt/claims.ts,
> src/jwt/verifier.ts, src/index.ts per spec §5. 3 bugs embedded exactly as specced.
> Decoder must return { rawHeader, rawPayload, signature, header, payload } — critical shape.

**Outcome:** accepted

**What changed and why:**
6 files created (~250 LOC). `DecodedToken` interface returns both raw base64url strings
(`rawHeader`, `rawPayload`) and decoded JS objects (`header`, `payload`) — required for
correct JWT signing. Bug 001 in verifier.ts (alg=none bypass at `header.alg === 'none'`
returns `valid: true`), Bug 002 in claims.ts (strict `<` instead of `<=` for exp), Bug 003
in signature.ts (string equality `===` instead of `timingSafeEqual`). CLI smoke test confirms
valid token returns `valid:true` and alg=none exploit returns `valid:true` pre-fix.

---

## Phase 3: Baseline tests + fixtures

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §7.1 (baseline test code, 5 tests), §7.5 (fixture generation helper)
- `tests/jwt-fixtures.ts` (token helpers)

**Prompt:** _(authoring phase — spec §7.1/§7.5 consumed directly)_
> Implement tests/jwt-verifier.test.ts (5 baseline tests, 3 failing pre-fix),
> tests/jwt-fixtures.ts (signedToken/unsignedToken/now helpers), scripts/generate-fixtures.ts
> (one-time helper writing 3 fixture files). vitest.config updated with JWT_SECRET env var.

**Outcome:** accepted (with one fix — see decisions log)

**What changed and why:**
5 baseline tests written exactly per spec §7.1 with FIRST-compliant `beforeEach/afterEach`
fake-timer pair. `signedToken`/`unsignedToken` helpers use `node:crypto` directly — no
external `jsonwebtoken` dep. Fixture files generated and committed. Test run confirms
3 failing (Bug 001 alg=none bypass, Bug 002 exp boundary, Bug 003 timingSafeEqual), 2 passing.
Fix applied: added `test.env.JWT_SECRET` to vitest.config — verifyToken reads env var which
isn't loaded by dotenv in test env (only src/index.ts imports dotenv/config).

---

## Decisions log (HW4-specific)

- **Orchestrator runtime is `claude -p` subprocess** (NOT direct @anthropic-ai/sdk). User has Claude Code subscription; no API key setup needed. Delegates tool-use loop + retries + 4 built-in tools to Claude Code. Trade-off: ~2-5s subprocess startup per stage vs ~100ms SDK.
- **6 agents total** (4 brief-required + Researcher + Planner) for true end-to-end autonomy.
- **Tools list in frontmatter** (`tools: [Read, Grep, Edit, Write]`) maps directly to `--allowed-tools` flag — no custom registry needed.
- **`Promise.allSettled` for stages 5-6** — partial-failure isolation (both complete even if one fails).
- **CommonJS module format** chosen over ESM for tsx compatibility and zero `.js` extension friction on local imports.
- **`runAgent` returns `{ text, durationMs }`** — not `{ text, turns, usage }` as in SDK design. Subprocess stdout doesn't expose token counts. Duration logged instead.
- _(add more as decisions arise during build)_

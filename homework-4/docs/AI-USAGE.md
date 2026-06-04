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

## Phase 4: Bug context files

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §5.6 (bug-context.md format), §5.3-5.5 (seeded issue details)

**Prompt:** _(authoring phase — spec §5.6 consumed directly)_
> Create 3 context/bugs/<ID>/bug-context.md files per spec §5.6 format:
> Symptom, Reproduction, Suspected severity, Hint, Expected behavior.

**Outcome:** accepted

**What changed and why:**
3 bug context files with full reproduction steps, severity ratings (CRITICAL/MEDIUM/HIGH),
and hints pointing at exact file:function. These are the seed inputs to the pipeline —
the Bug Researcher reads bug-context.md and explores src/ from there.

---

## Phase 5: Loaders + validators + unit tests

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §3.2 (AgentSpecSchema, MODELS/TOOLS enums), §4.5 (skill-loader, validateSkillStructure)
- Implementations from Phase 0 (agent-loader, skill-loader, validators, messages)

**Prompt:** _(authoring phase — spec §3.2/§4.5 consumed directly)_
> Write unit tests for agent-loader (8 tests), skill-loader (4 tests), validators (4 tests),
> messages (3 tests). Create fixture agents and skills. All must pass.

**Outcome:** accepted (with one fix — initial test used empty async fn with `.rejects.toThrow()`, replaced with `mkdtempSync` temp dir for real file-based test isolation)

**What changed and why:**
25 unit tests across 4 test files. agent-loader tests cover valid load, empty dir, missing dir,
invalid model, invalid name, invalid tool, max_tokens default. skill-loader tests cover
required-header validation (each missing header), loadAllSkills with valid fixture.
validators tests cover skill-ref cross-check (pass + fail). messages tests cover
XML tag generation, multi-part join, name attribute. Fixture files created for agent
validation tests (valid, bad-model, bad-name, bad-tool) and skill tests (valid, missing-section).

---

## Phase 6: Claude runner + messages + tests

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §6.4 (subprocess wrapper, ~40 LOC), §6.6 (buildUserMessage)
- messages.ts already implemented in Phase 0

**Prompt:** _(authoring phase — spec §6.4/§6.6 consumed directly)_
> Implement claude-runner.ts (~40 LOC subprocess wrapper) and its unit tests.
> Subprocess mock must work without mocking node:child_process.

**Outcome:** accepted (with design change — see decisions log)

**What changed and why:**
`claude-runner.ts` implemented with `buildSystemPrompt` (skill XML injection) and `runAgent`
(subprocess wrapper with ENOENT/SIGTERM/empty-output error handling). `spawnClaude` exported
as injectable seam to avoid CommonJS module mocking issues. 7 unit tests using vi.fn() injection
rather than `vi.mock('node:child_process')` which doesn't intercept CJS local bindings.

---

## Phase 7: Stages + tests

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §6.5 (stages.ts, sequential 1-4 + allSettled 5-6, runTests, gitDiffNames)

**Prompt:** _(authoring phase — spec §6.5 consumed directly)_
> Implement stages.ts (~120 LOC) with SpawnFn DI to match claude-runner.ts pattern.
> Write 4 unit tests: happy path, test-results appended, sequential failure, allSettled isolation.

**Outcome:** accepted

**What changed and why:**
stages.ts: 6 sequential/parallel agent stages, orchestrator-run test results appended to
fix-summary.md and test-report.md, gitDiffNames('src/') used to pass changed files to
reviewers. `execFileSync` mocked in tests for git + npx calls. allSettled isolation
verified: security-verifier failure leaves test-report.md intact.

---

## Phase 8: Run-pipeline entry + coverage hardening

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §6.2 (run-pipeline.ts entry), §7.3 (coverage config), §8.4 (review-brief.md)
- Coverage output from all test files (57 passing, 3 intentionally failing pre-fix)

**Prompt:** _(authoring phase — spec §6.2/§7.3 consumed directly)_
> Verify run-pipeline.ts integration (exits 2 for nonexistent bug, for missing --bug arg).
> Create docs/specs/review-brief.md. Fix coverage gaps: reportOnFailure, jwt unit tests,
> c8 ignore on spawnClaude seam, validators DI. Ensure all files ≥85% per perFile:true.

**Outcome:** accepted (with iterative fixes — see decisions log)

**What changed and why:**
vitest.config: added `reportOnFailure: true` (coverage generates even when pre-fix tests
fail), `json-summary` reporter. Added `tests/jwt-unit.test.ts` (13 tests covering decoder
error paths, validateClaims edge cases, verifyToken error paths). All files now ≥85% per-file.
`docs/specs/review-brief.md` created for Phase 11 codex:review. Pipeline smoke tests confirmed:
`--bug nonexistent` exits 2; no `--bug` arg exits 2. Total: 57 passing, 3 failing (pre-fix).

---

## Decisions log (HW4-specific)

- **Orchestrator runtime is `claude -p` subprocess** (NOT direct @anthropic-ai/sdk). User has Claude Code subscription; no API key setup needed. Delegates tool-use loop + retries + 4 built-in tools to Claude Code. Trade-off: ~2-5s subprocess startup per stage vs ~100ms SDK.
- **6 agents total** (4 brief-required + Researcher + Planner) for true end-to-end autonomy.
- **Tools list in frontmatter** (`tools: [Read, Grep, Edit, Write]`) maps directly to `--allowed-tools` flag — no custom registry needed.
- **`Promise.allSettled` for stages 5-6** — partial-failure isolation (both complete even if one fails).
- **CommonJS module format** chosen over ESM for tsx compatibility and zero `.js` extension friction on local imports.
- **`runAgent` returns `{ text, durationMs }`** — not `{ text, turns, usage }` as in SDK design. Subprocess stdout doesn't expose token counts. Duration logged instead.
- **`reportOnFailure: true` in vitest.config** — pre-fix baseline tests fail by design; coverage must still generate to verify per-file thresholds.
- **`/* c8 ignore start/end */` on `spawnClaude`** — subprocess seam excluded from coverage; DI injection is the test contract.
- **`spawnClaude` exported as injectable seam** — `vi.mock('node:child_process')` doesn't intercept CommonJS local bindings. `runAgent` accepts `spawn` as a defaulted parameter. Tests inject `vi.fn()` directly. Avoids all module system hacks.
- _(add more as decisions arise during build)_

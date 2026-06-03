# Claude Code — Kickoff Prompt (Homework 4)

Paste the block below into a Claude Code session opened with the repo root at `~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering` and the working branch already checked out as `homework-4-submission`.

---

## Prerequisites (do once, before pasting the prompt)

These are environment-level setup steps Claude Code can't do for you (require system install or authentication):

1. **Claude Code installed and authenticated** — verify via `which claude` (must return a path) and `claude /status` (must show logged-in user). If not installed: https://docs.anthropic.com/claude-code. If not authenticated: `claude /login`.

   **The pipeline runs Claude Code as subprocess via `claude -p`** — no separate `ANTHROPIC_API_KEY` is needed. The pipeline uses your existing Claude Code subscription.

2. **Verify available tools** in your Claude Code environment:
   - `/codex:review` skill (Phase 11) — fallback to inline review if unavailable, like HW1/HW2
   - **Playwright MCP** for screenshot capture (Phase 13) — fallback to OS screenshot tools
   - Both `claude-sonnet-4-6` and `claude-opus-4-8` models — Opus needed at Phase 12 for README per-agent justification section

   Missing tools aren't blocking — Claude Code will tell you when it gets to them and use the documented fallback.

3. **Wall-time awareness for Phase 10.** Each bug pipeline run takes ~5-10 minutes (6 stages × Claude Code subprocess startup + LLM latency). Total for 3 bugs: ~20-30 minutes. **No money cost** — uses your existing Claude Code subscription.

---

## Prompt to paste

You are implementing **Homework 4 — 4-Agent Pipeline** as the implementation driver for this repo. The full design spec is at:

```
homework-4/docs/specs/2026-06-02-4-agent-pipeline-design.md
```

**Step 0 — read the spec end-to-end before doing anything else.** It is authoritative. If anything in the spec contradicts these instructions, the spec wins. If anything is genuinely ambiguous, ask me before guessing.

### Ground rules

1. **Working directory:** `homework-4/`. All implementation lives there. Do not modify files outside that directory.
2. **Branch:** stay on `homework-4-submission`. Do not create new branches.
3. **One phase at a time.** Execute the phase pipeline in spec §8.2 (Phases 0 → 15) in order, respecting the ordering rules in §8.3. After each phase: commit with a Conventional Commits message scoped to the phase (`feat(phase-N):`, `docs(phase-N):`, `test(phase-N):`, etc.), then summarize what you did and what's next in one short message before starting the next phase.
4. **Ask me before:**
   - Phase 9 begins (writing the 6 `.agent.md` files) — I want to review the agent prompts before they get deployed in Phase 10's real subprocess runs. Show me each prompt body for confirmation before committing.
   - Phase 10 begins (E2E pipeline runs with real `claude -p` subprocess) — I want to confirm tests + lint are green. This phase takes ~30 minutes wall-time.
   - Phase 11 begins (`/codex:review`) — I want to confirm the diff is at the right state.
5. **`docs/AI-USAGE.md` is a living document.** Append a section after every AI-driven phase (0-9, 12). Phases 10, 13 get one-liner entries (orchestration / screenshot capture). Phase 14 = consolidation pass: re-read, dedupe, fix references, add the decisions log (HW4-specific, NOT HW2 copypasta about classifier ordering).
6. **Use the Context-Model-Prompt framework explicitly.** Each entry in `docs/AI-USAGE.md` records:
   - **Context loaded** (which files, which spec sections, which prior outputs)
   - **Model** (`claude-sonnet-4-6` default; `claude-opus-4-8` at Phase 12 for README; skill names like `/codex:review`)
   - **Prompt** (verbatim — even if you authored it in-flight)
   - **Outcome** (accepted | edited | rejected) + one-paragraph rationale
   The full CMP table from spec §8.1 should be reproduced at the top of `AI-USAGE.md` for one-page reference.
7. **Phase 12 — README uses Opus 4.8** for the per-agent model justification section (it's the showcase artifact for brief's "justify model choice" requirement). HOWTORUN uses Sonnet 4.6. Spawn an `Agent(..., model: "opus")` sub-agent for the README work, just like HW2's ARCHITECTURE.md pattern.
8. **Quality gates (non-negotiable):**
   - `npm test` passes with **≥85% line/branch/function/statement coverage** with `perFile: true` — every file individually must meet threshold (not just average). Entry points and one-shot scripts are in the spec's exclude list.
   - At Phase 10 exit, all 3 bug runs exit with code 0, all 6 artifacts per bug are produced, and `npm test` returns 5+ passing / 0 failing.
   - `/codex:review` runs (or inline-review fallback) and all `[BLOCKING]` findings are addressed (or explicitly waived in `docs/reviews/codex-review-<date>.md` with rationale).
   - All 6 `agents/*.agent.md` files load without Zod errors and cross-ref to skills correctly.
   - Both `skills/*.md` files pass `validateSkillStructure` (required `## Levels`, `## Application`, `## Required output sections` headers present).
   - All required deliverables present per spec §11 acceptance checklist.
9. **Don't invent scope.** If something isn't in the spec, it isn't in v1. If you find a real gap, add a bullet to spec §10 (future work) and proceed. The spec explicitly lists known limitations (HS256 only, no HTTP server, Claude Code subscription required, no real-Claude E2E in CI, no per-file Vitest threshold customization, single-bug-per-invocation, POSIX-only `pipeline:all`) — don't try to "improve" them.

### Skills, MCPs, and tools to use (and when)

| Phase | Tool / skill | If unavailable |
|---|---|---|
| Phase 10 — E2E pipeline runs | Built pipeline that spawns `claude -p` subprocess per stage (uses your Claude Code subscription) | If `claude` CLI missing or not authenticated: stop and ask me |
| Phase 11 — code review | **`/codex:review`** (consume `docs/specs/review-brief.md`) | Run inline review with the same brief; output to same file path |
| Phase 12 — README (per-agent justification section) | **claude-opus-4-8** via Agent sub-task | If Opus unavailable: use Sonnet for README and document the substitution in AI-USAGE |
| Phase 13 — screenshots | **Playwright MCP** + macOS screencapture | Manual screenshots via OS tooling; document tool used in AI-USAGE |

For all other phases, you author code directly with `claude-sonnet-4-6` (your default). Don't invoke a skill where the spec doesn't call for one.

### Pre-flight environment (special: applies before Phase 5)

The orchestrator depends on three system tools, all checked at pipeline startup (per spec §6.2 `checkSystemDependencies`):

- `claude` — Claude Code CLI. Verify with `which claude && claude /status`. Required for all 6 agent stages (subprocess spawn).
- `git` — for `git diff --name-only` after Bug Fixer. Always present in this repo's environment.
- `npx` (Node) — for `npm test` runs inside the pipeline. Always present.

If any are missing at Phase 0 scaffold, ask me.

### How to start

1. Read `homework-4/docs/specs/2026-06-02-4-agent-pipeline-design.md` end-to-end. Pay special attention to:
   - §1 — Architectural approach. **Claude Code subprocess as runtime, NOT direct Anthropic SDK.** No tool registry, no tool-use loop, no retry logic — Claude Code handles all of that internally.
   - §3.3 — per-agent contract table (model, tools, skills, inputs, outputs). This is the source of truth for Phase 9 .agent.md files.
   - §4 — skills contract. Both skills' content (Levels, Application, Required output sections) is fully specified.
   - §5.7 — Decoder return shape (`rawHeader/rawPayload/header/payload`). Critical correctness for sample JWT app — broken decoder makes baseline tests unreadable.
   - §6.3 — Why we use Claude Code subprocess (no custom tool registry, frontmatter `tools` maps to `--allowed-tools` flag).
   - §6.4 — Subprocess wrapper (~40 LOC: `execFile('claude', args)` with stdin for long user messages, 5min timeout, ENOENT handling).
   - §6.5 — Stages: linear 1-4 (throw propagates), parallel 5-6 via `Promise.allSettled` (partial-failure isolation).
   - §7.1 — Baseline tests use **`beforeEach(() => vi.useFakeTimers())` + `afterEach(() => vi.useRealTimers())`** — FIRST Independent. This is the worked example for the FIRST skill.
   - §7.2 — Mock subprocess (not Anthropic SDK) via `mockClaudeSubprocess(responsesByInvocation: string[])`. Single response per agent (Claude Code handles tool-use internally).
   - §8.1 — CMP table. This is the course's Lesson 5 in action.
2. Skim `homework-4/TASKS.md` and the repo's top-level `README.md` (submission rules) so you have the homework context.
3. Reply with a short (≤10 bullet) restatement of what you understood, plus any genuine ambiguities you want me to resolve **before Phase 0**. In particular flag:
   - Whether `claude` CLI is on PATH (`which claude` works) and authenticated (`claude /status` shows logged-in user)
   - Whether you have access to the listed tools/MCPs/skills (Phase 11/13)
   - Whether you have access to `claude-opus-4-8` (Phase 12 README — fallback noted)
   Do not start Phase 0 until I confirm.
4. Once I confirm, execute Phase 0 (scaffold). Commit. Summarize. Then proceed phase-by-phase in order without asking — phases 0 → 8 don't need approvals between them as long as quality gates are green and you keep me in the loop with a one-line summary per phase.
5. Stop and ask before Phases 9 (agent prompt review), 10 (E2E ~30min wall-time), and 11 (codex:review) per ground rule #4.

### Definition of done

The acceptance checklist in spec §11 is the canonical "done" definition. Highlights:
- 6 `agents/*.agent.md` files load cleanly; cross-refs to 2 skills valid.
- `npm test` passes with ≥85% coverage per-file (subprocess mocked).
- Baseline tests: pre-pipeline 3 failing / 2 passing; post-pipeline (all 3 bugs) all green.
- 3 `context/bugs/<ID>/` folders contain all 6 artifacts per bug.
- 3 generated test files in `tests/jwt-verifier/`, all FIRST-compliant.
- `docs/AI-USAGE.md` covers every phase from §8.2, CMP table at top.
- `docs/screenshots/` contains ~12-15 shots (pre-pipeline, pipeline-run-stdout per bug, git-diff, post-pipeline, security-report, test-report, AI-USAGE, codex-review).
- `README.md` contains per-agent model justification table (brief's showcase requirement); `HOWTORUN.md` documents Claude Code prerequisite (`which claude` + `claude /login`) + Platform notes for `pipeline:all`.
- **No `ANTHROPIC_API_KEY` referenced anywhere in code or docs.**
- PR opened against fork's `main` (not upstream) with `Alexey-Popov` as reviewer, labels `homework-4` and `ready-for-review`, body templated per spec §9.4.

Good luck. Start with Step 1.

---

## Notes for Nicko (not part of the prompt)

- **Major pivot vs original HW4 plan:** orchestrator runtime is now `claude -p` subprocess, NOT direct `@anthropic-ai/sdk`. This means **$0 cost** (uses Claude Code subscription) and ~290 LOC orchestrator instead of ~500 (tool registry + tool-use loop delegated to Claude Code). Trade-off is ~2-5s subprocess startup per stage and dependency on Claude Code being installed/authenticated.

- **Differences from HW1/HW2 kickoff prompts:**
  1. **No deployment** — HW4 is local CLI. Phases 10, 13 are still significant but no `/vercel:deploy` equivalent.
  2. **No money cost at Phase 10** — wall-time only (~30 min for 3 bugs).
  3. **Phase 9 agent prompt review gate** — new. Agent prompts get deployed against real Claude Code in Phase 10, so review before commit makes sense.
  4. **Only 2 docs** — README + HOWTORUN (no ARCHITECTURE, no API_REFERENCE, no TESTING_GUIDE). Opus only for README's per-agent justification section.
  5. **Pre-flight checks:** `claude` CLI authenticated + `git` + `npx`. Spec's `checkSystemDependencies` exits 2 if missing.
  6. **Approval gates at 9/10/11** — reflects HW4's phase numbering.

- **The Phase 10 approval gate is the most important one** — it takes ~30 minutes to run. Before approving, double-check: tests green, all 6 agents load, `claude /status` shows authenticated. After approval, the pipeline runs 3 bugs sequentially.

- **The fallback procedures** for unavailable tools mean the build can complete even if some skills aren't installed. The brief is the value; the skill is the convenience.

- **If you want it even more autonomous**, drop ground rule #4 entirely. If less autonomous, change to "ask before every phase boundary."

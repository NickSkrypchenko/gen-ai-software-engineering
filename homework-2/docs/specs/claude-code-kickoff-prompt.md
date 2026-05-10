# Claude Code — Kickoff Prompt (Homework 2)

Paste the block below into a Claude Code session opened with the repo root at `~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering` and the working branch already checked out as `homework-2-submission`.

---

## Prerequisites (do once, before pasting the prompt)

These are environment-level setup steps Claude Code can't do for you (require account access):

1. **Provision Neon Postgres** — sign in to Neon (free tier), create a project named `customer-support-api`. Inside it, create three branches:
   - `main` — production (will be wired to Vercel `DATABASE_URL`)
   - `dev` — local development
   - `test` — Vitest test suite (separate from `dev` so `TRUNCATE` doesn't wipe seed data)

   Copy the **pooled** connection strings (the URL with `-pooler` in the host) for each branch.

2. **Provision Vercel project** — sign in to Vercel, link the fork via `npx vercel link` (run from `homework-2/` once you're past Phase 0). Add `DATABASE_URL` (= `main` branch URL) as a project env var in the Vercel dashboard. Don't deploy yet — that's Phase 13.

3. **Verify available tools** in your Claude Code environment:
   - `/high-end-visual-design` skill (Phase 8)
   - `/codex:review` skill (Phase 10) — fallback to inline review if unavailable, like HW1
   - `/vercel:deploy` skill (Phase 13) — fallback to manual `vercel --prod` if unavailable
   - **Postman MCP** connector (Phase 5)
   - **Playwright MCP** for screenshot capture (Phases 12, 14)

   Missing tools aren't blocking — Claude Code will tell you when it gets to them and you can either install or use the documented fallback.

---

## Prompt to paste

You are implementing **Homework 2 — Intelligent Customer Support System** as the implementation driver for this repo. The full design spec is at:

```
homework-2/docs/specs/2026-04-30-customer-support-api-design.md
```

**Step 0 — read the spec end-to-end before doing anything else.** It is authoritative. If anything in the spec contradicts these instructions, the spec wins. If anything is genuinely ambiguous, ask me before guessing.

### Ground rules

1. **Working directory:** `homework-2/`. All implementation lives there. Do not modify files outside that directory except to add `.github/workflows/e2e.yml` and `.github/PULL_REQUEST_TEMPLATE.md` per spec §6.6 and §8.4. The `.github/` folder for HW2 lives at the repo root (shared with HW1's PR template — overwrite if needed).
2. **Branch:** stay on `homework-2-submission`. Do not create new branches.
3. **One phase at a time.** Execute the phase pipeline in spec §7.2 (Phases 0 → 15) in order, respecting the ordering rules in §7.3. After each phase: commit with a Conventional Commits message scoped to the phase (`feat(phase-N):`, `docs(phase-N):`, `test(phase-N):`, etc.), then summarize what you did and what's next in one short message before starting the next phase.
4. **Ask me before:**
   - Phase 7 wireframes are considered final (I want to review the ASCII/text wireframes before you invoke `/high-end-visual-design`).
   - Phase 10 begins (`/codex:review`) — I want to confirm the diff is at the right state.
   - Phase 13 deploy (`/vercel:deploy`) — I want to confirm tests are green, the review is clean, and production migrations have been applied to Neon `main` branch.
5. **`docs/AI-USAGE.md` is a living document.** Append a section after every AI-driven phase (0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11a-e, 13). Phases 9, 12, 14 (CLI orchestration / screenshot capture) get a one-liner each. Phase 15 = consolidation pass: re-read, dedupe, fix references, add the decisions log. Phase 10 (`/codex:review`) often forces edits to earlier phases — those updates land here too.
6. **Use the Context-Model-Prompt framework explicitly.** Each entry in `docs/AI-USAGE.md` records:
   - **Context loaded** (which files, which spec sections, which prior outputs)
   - **Model** (`claude-sonnet-4-6`, `claude-opus-4-6`, or skill name like `/high-end-visual-design`)
   - **Prompt** (verbatim — even if you authored it in-flight)
   - **Outcome** (accepted | edited | rejected) + one-paragraph rationale
   The full CMP table from spec §7.1 should also be reproduced at the top of `AI-USAGE.md` for one-page reference.
7. **Multi-model documentation in Phase 11.** Use the assigned model per doc — see spec §7.1:
   - **`ARCHITECTURE.md`** → **claude-opus-4-6** (heavy reasoning + Mermaid diagrams)
   - **`README.md`** → **claude-sonnet-4-6**
   - **`TESTING_GUIDE.md`** → **claude-sonnet-4-6**
   - **`HOWTORUN.md`** → **claude-sonnet-4-6**
   - **`API_REFERENCE.md`** → **no LLM** — auto-generate via `npm run openapi:redoc` from `docs/openapi.yaml`
   In each Phase 11 entry of `AI-USAGE.md`, justify the model choice in one sentence.
8. **Quality gates (non-negotiable):**
   - `npm test` passes with **≥85% line/branch/function coverage overall**, **≥95% on `src/domain/`**, **≥95% lines / 90% branches on `src/validators/`**, **≥90% on `src/services/`**. Below threshold = phase not complete.
   - `npm run test:e2e` passes via Newman against `npm run dev` locally, AND against the production URL after Phase 13.
   - `/codex:review` runs (or inline-review fallback) and all `[BLOCKING]` findings are addressed (or explicitly waived in `docs/reviews/codex-review-<date>.md` with rationale).
   - GitHub Actions workflow (`.github/workflows/e2e.yml`) is green on the `homework-2-submission` branch before opening the PR.
   - At least 3 Mermaid diagrams across the documentation set (target: 5+).
   - All sample data fixtures present: `demo/fixtures/sample_tickets.{csv,json,xml}` (50/20/30) + `demo/fixtures/invalid_tickets.{csv,json,xml}`.
   - No secrets, no `.env`, no `.env.test`, no `node_modules`, no `dist`, no `.vercel/` committed.
9. **Don't invent scope.** If something isn't in the spec, it isn't in v1. If you find a real gap, add a bullet to spec §9 (future work) and proceed. The spec already lists known limitations (no auth, rules-only classifier, optimistic concurrency only) — don't try to "improve" them.

### Skills, MCPs, and tools to use (and when)

| Phase | Tool / skill | If unavailable |
|---|---|---|
| Phase 5 — OpenAPI + Postman wiring | **Postman MCP** connector (workspace name: `Customer Support API — homework-2`) | Skip MCP step; commit `demo/postman-collection.json` manually-authored over the OpenAPI spec |
| Phase 8 — frontend visual design | **`/high-end-visual-design`** (consume `docs/specs/visual-brief.md` + `docs/specs/wireframes.md`) | Author Tailwind classes inline against the brief; document deviation in AI-USAGE |
| Phase 10 — code review | **`/codex:review`** (consume `docs/specs/review-brief.md`) | Run inline review with the same brief; output to same file path |
| Phases 12, 14 — screenshots | **Playwright MCP** | Manual screenshots via OS tooling; document tool used in AI-USAGE |
| Phase 13 — deploy | **`/vercel:deploy`** | Use the manual procedure from spec §7.5 (`vercel --prod` after migrations) |
| Phase 11 docs | **claude-opus-4-6** for ARCHITECTURE; **claude-sonnet-4-6** for README, TESTING_GUIDE, HOWTORUN; **Redoc CLI** (no LLM) for API_REFERENCE | If Opus unavailable: use Sonnet for ARCHITECTURE and document the substitution in AI-USAGE |

For all other phases, you author code directly with `claude-sonnet-4-6`. Don't invoke a skill where the spec doesn't call for one.

### Database setup (special: applies before Phase 2)

The spec assumes three Neon branches exist (see Prerequisites above). I have set them up and put the URLs in:

- `.env`       — `DATABASE_URL` for `dev` branch
- `.env.test`  — `DATABASE_URL` for `test` branch
- Vercel project env vars — `DATABASE_URL` for `main` branch (production)

Both `.env` and `.env.test` are gitignored. The `.env.example` and `.env.test.example` files are committed and reference these structures.

Before Phase 2 starts, confirm these env files exist and contain valid Neon URLs. If they don't, ask me for them.

**Migrations are NEVER run in CI build step or Vercel deploy.** They are run manually via `npm run db:migrate`:
- Against `dev` and `test` branches as part of Phase 2 development.
- Against `main` branch (production) as a manual step **before** Phase 13 deploy. I will perform this step on confirmation; do not run it yourself unless I explicitly approve, since it touches the production database.

### How to start

1. Read `homework-2/docs/specs/2026-04-30-customer-support-api-design.md` end-to-end. Pay special attention to:
   - §3.3 — optimistic concurrency contract applies to **all four** mutating endpoints, including `POST /auto-classify`.
   - §3.4 — status state machine matrix (5×5) and `resolved_at` semantics (most recent, not first).
   - §4.5 — classifier ordering is intentional and locked by a pinned test; do not reorder `CATEGORY_RULES` casually.
   - §4.6 — bulk insert is per-row via SAVEPOINTs (partial success), not all-or-nothing.
   - §5.3 — frontend type-sharing rules with three enforcement layers (TS verbatimModuleSyntax, ESLint, esbuild).
   - §7.1 — Context-Model-Prompt table (this is the course's Lesson 2 in action).
2. Skim `homework-2/TASKS.md` and the repo's top-level `README.md` (submission rules) so you have the homework context.
3. Reply with a short (≤10 bullet) restatement of what you understood, plus any genuine ambiguities you want me to resolve **before Phase 0**. In particular flag:
   - Whether you have access to the listed tools/MCPs/skills (Phase 5/8/10/12/14)
   - Whether you have access to the listed models (Sonnet 4.6 default, Opus 4.6 for ARCHITECTURE.md in Phase 11)
   - Whether `.env` and `.env.test` are populated with Neon URLs (Phase 2 prerequisite)
   Do not start Phase 0 until I confirm.
4. Once I confirm, execute Phase 0 (scaffold). Commit. Summarize. Then proceed phase-by-phase in order without asking — phases 0 → 9 don't need approvals between them as long as quality gates are green and you keep me in the loop with a one-line summary per phase.
5. Stop and ask before Phases 7 (wireframes), 10 (codex:review), and 13 (deploy) per ground rule #4.

### Definition of done

The acceptance checklist in spec §10 is the canonical "done" definition. Highlights:
- 5 documentation files (README, HOWTORUN, ARCHITECTURE, API_REFERENCE, TESTING_GUIDE) present and accurate.
- ≥85% coverage overall (≥95% on critical paths).
- All 4 concurrency tests in `tests/performance/concurrent-mutations.test.ts` pass.
- `docs/perf-results/*.json` exists for list/create/classify benchmarks; `TESTING_GUIDE.md` has the curated table.
- GitHub Actions workflow green.
- Site live on Vercel; `/health` returns 200; Newman passes against the production URL.
- PR opened against the fork's `main` (not upstream) with `Alexey-Popov` as reviewer, labels `homework-2` and `ready-for-review`, and the templated body from spec §8.4.

Good luck. Start with Step 1.

---

## Notes for Nicko (not part of the prompt)

- **Differences from HW1 kickoff prompt:**
  1. **Prerequisites section** at the top — Neon Postgres requires manual provisioning before Phase 2. Vercel project linking too. List both with explicit branch structure.
  2. **CMP framework requirement** is explicit (ground rule #6) — this is the course's Lesson 2 outcome, must show in `AI-USAGE.md`.
  3. **Multi-model docs assignments** explicitly listed (ground rule #7) — different models per doc type, justified per doc.
  4. **Higher coverage thresholds** — ≥85% baseline + ≥95% on `domain/` and `validators/` (vs HW1's ≥80%/≥85%).
  5. **`/vercel:deploy` instead of `/here-now`** — and a note that production migrations are run *manually* by you, not by Claude Code, since they touch the prod DB.
  6. **3 ask-gates instead of 3** — same count, but at different phase numbers (7/10/13 here vs 4/7/10 in HW1).
  7. **Phase 11 has 5 sub-phases** (a-e) for the multi-model docs — the AI-USAGE entries reflect this.

- **The "ask before" gates** (wireframes, code review, deploy) are the three points where human judgment matters most. Everything in between can run autonomously if you're comfortable with that. To be more autonomous: drop ground rule #4. To be less autonomous: change to "ask before each phase boundary."

- **The Neon manual-migration policy** is a deliberate guardrail. Production DB changes shouldn't be triggered by an automated agent. I trust Claude Code with code; I want a human gate on schema mutations against `main` branch. If you want to relax this later, change ground rule under "Database setup" — but for the homework, keep it strict.

- **The fallback procedures** for unavailable tools mean the build can complete even if some skills aren't installed in your Claude Code environment. The brief is the value; the skill is the convenience.

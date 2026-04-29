# Claude Code — Kickoff Prompt

Paste the block below into a Claude Code session opened with the repo root at `~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering` and the working branch already checked out as `homework-1-submission`.

---

## Prompt to paste

You are implementing **Homework 1 — Banking Transactions API** as the implementation driver for this repo. The full design spec is at:

```
homework-1/docs/specs/2026-04-29-banking-api-design.md
```

**Step 0 — read the spec end-to-end before doing anything else.** It is authoritative. If anything in the spec contradicts these instructions, the spec wins. If anything is genuinely ambiguous, ask me before guessing.

### Ground rules

1. **Working directory:** `homework-1/`. All implementation lives there. Do not modify files outside that directory except to add `.github/PULL_REQUEST_TEMPLATE.md` per spec §8.4.
2. **Branch:** stay on `homework-1-submission`. Do not create new branches.
3. **One phase at a time.** Execute the phase pipeline in spec §7.1 (Phases 0 → 11) in order, respecting the ordering rules in §7.2. After each phase: commit with a Conventional Commits message scoped to the phase, then summarize what you did and what's next in one short message before starting the next phase.
4. **Ask me before:**
   - Phase 4 wireframes are considered final (I want to review the ASCII/text wireframes before you invoke `/high-end-visual-design`).
   - Phase 7 begins (`/codex:review`) — I want to confirm the diff is at the right state.
   - Phase 10 deploy (`/here-now`) — I want to confirm tests are green and the review is clean before publishing.
5. **`docs/AI-USAGE.md` is a living document.** Append a section after every code-producing phase (0, 1, 2, 3, 5, 7) with the verbatim prompt you used, the outcome (accepted / edited / rejected), and a short paragraph on what you changed and why. Phase 6 is the consolidation pass — re-read, dedupe, fix references, add the decisions log.
6. **Quality gates (non-negotiable):**
   - `npm test` passes with ≥80% line coverage overall, ≥85% on `services/` and `validators/`. Below threshold = phase not complete.
   - `npm run test:e2e` passes via Newman against `npm run dev`.
   - `/codex:review` runs and all findings tagged blocking are addressed (or explicitly waived in `docs/reviews/codex-review-<date>.md` with rationale).
   - No secrets, no `.env`, no `node_modules`, no `dist` committed (verified by spec's `.gitignore`).
7. **Don't invent scope.** If something isn't in the spec, it isn't in v1. If you find a real gap, add a bullet to spec §9 (future work) and proceed.

### Skills and tools to use (and when)

| Phase | Tool / skill |
|---|---|
| Phase 5 — frontend visual design | `/high-end-visual-design` (consume `docs/specs/visual-brief.md` + `docs/specs/wireframes.md`) |
| Phase 3 — OpenAPI + Postman wiring | Postman MCP connector (workspace name: `Banking Transactions API — homework-1`) |
| Phase 7 — code review | `/codex:review` (consume `docs/specs/review-brief.md`) |
| Phase 10 — deploy | `/here-now` skill (publish to `www.here.now`) |

For all other phases, you author code directly. Don't invoke a skill where the spec doesn't call for one.

### How to start

1. Read `homework-1/docs/specs/2026-04-29-banking-api-design.md` end-to-end.
2. Skim `homework-1/TASKS.md` and the repo's top-level `README.md` (submission rules) so you have the homework context.
3. Reply with a short (≤8 bullet) restatement of what you understood, plus any genuine ambiguities you want me to resolve **before Phase 0**. Do not start Phase 0 until I confirm.
4. Once I confirm, execute Phase 0 (scaffold). Commit. Summarize. Then proceed to Phase 1 without asking — phases 0 → 6 don't need approvals between them as long as quality gates are green and you keep me in the loop with a one-line summary per phase.
5. Stop and ask before Phases 4 (wireframes), 7 (codex:review), and 10 (deploy) per ground rule #4.

### Definition of done

The acceptance checklist in spec §10 is the canonical "done" definition. The PR is opened against the fork's `main` (not upstream) with `Alexey-Popov` requested as reviewer and the templated body from spec §8.4. The site is live at `www.here.now` and `here-now-deployed.png` exists in `docs/screenshots/`.

Good luck. Start with Step 1.

---

## Notes for Nicko (not part of the prompt)

- The kickoff prompt above is intentionally self-contained — Claude Code starts cold. It points at the spec rather than re-stating it, so updates to the spec automatically propagate.
- The "ask before" gates (wireframes, code review, deploy) are the three points where human judgment matters most. Everything in between can run autonomously if you're comfortable with that.
- If you want Claude Code to be even more autonomous, drop ground rule #4. If you want it to be less autonomous (ask before *every* phase), change the rule to "ask before each phase boundary."
- The prompt assumes the relevant MCPs and skills are already configured in your Claude Code environment. If `/here-now` or Postman MCP aren't wired up, Claude Code will tell you when it gets to those phases.

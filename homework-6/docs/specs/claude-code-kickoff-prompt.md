# Claude Code — Kickoff Prompt (Homework 6)

Paste the block below into a Claude Code session opened at the repo root (`~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering`) with the working branch checked out as `homework-6-submission`.

---

## Prerequisites (do once, before pasting)

These are environment-level steps Claude Code can't do for you:

1. **Node.js ≥ 22 + npm** — verify `node -v`. The toolchain runs TypeScript via `tsx` (no build step needed for dev/run).
2. **Claude Code installed and authenticated** — needed for the slash commands and the context7 MCP. `which claude` + `claude /status`.
3. **context7 MCP** — `mcp.json` will configure `npx -y @upstash/context7-mcp`. If it isn't available in your client, Agent 2 still proceeds, but `research-notes.md` must still document **2 queries** with the source you used (note the fallback).
4. **No `ANTHROPIC_API_KEY` is required at runtime** — the pipeline makes **no LLM calls**. AI is build-time only (these meta-agents) + the two MCP servers.

---

## Prompt to paste

You are the implementation driver for **Homework 6 — AI-Powered Multi-Agent Banking Pipeline**. Your authoritative inputs (read all of them end-to-end **before** Phase 0):

```
homework-6/specification.md                  ← the contract (WHAT to build)
homework-6/agents.md                         ← how to behave (standards, forbidden actions)
homework-6/docs/specs/plan.md                ← the order (phases, dependencies, gates)
homework-6/docs/specs/brainstorm-summary.md  ← rationale + the Golden results table
```

**Step 0 — read all four before doing anything.** `specification.md` is authoritative; if anything contradicts it, the spec wins. If something is genuinely ambiguous, ask me before guessing. Do **not** restate these docs back to me in full — I've read them.

### Ground rules

1. **Working dir:** `homework-6/`. Do not modify anything outside it. **Never modify `sample-transactions.json`** (reference input).
2. **Branch:** `homework-6-submission`. No new branches.
3. **One phase at a time** per `plan.md` (`0 → 1 → 2 → {3 ∥ 4} → 5 → 6`). After each phase: commit with a Conventional Commits message scoped to the phase (`feat(phase-2):`, `test(phase-3):`, `docs(phase-5):` …) and give me a one-line summary before starting the next.
4. **Ask me before:**
   - **Phase 2** (code generation begins) — confirm scaffold builds and the environment is green.
   - **Phase 6** (open the PR).
   Phases 1, 3, 4, 5 run without stopping as long as their `plan.md` gates stay green.
5. **Non-negotiables (from `agents.md`) — do not drift:**
   - Money uses the isolated `Money = Decimal.clone({ rounding: ROUND_HALF_EVEN })` from `src/lib/money.ts`. **Never** `Decimal.set(...)` on the global, **never** `number`/`float`/raw `Decimal` for money.
   - `message_id` = `crypto.randomUUID()` v4.
   - Append-only `shared/results/audit.log`, one line per agent-hop, PII masked — **separate** from the per-transaction result JSON.
   - No LLM calls / no network at runtime. Inject a `Clock` for deterministic timestamps.
   - Closed **7-currency** allow-list (`USD, EUR, GBP, JPY, CHF, CAD, AUD`) = the FX-rate keys, 1:1 (parity unit test).
   - `decision` enum is exactly 4 values; `escalate` is an audit flag, not a status.
6. **Coverage:** **hard gate 80%** (both `vitest.config.ts` thresholds and the `coverage-gate.mjs` push hook), **target ≥ 90%** (aim, not a hard fail). The custom MCP server launches as `npx tsx mcp/server.ts` (not bare `node`).

### Skills, MCPs, tools (and when)

| Phase | Tool / skill | If unavailable |
|---|---|---|
| 2, 4 | **context7 MCP** — look up `decimal.js` (clone/rounding), `fastmcp`, Vitest coverage | Proceed; still log 2 queries in `research-notes.md`, noting the source used |
| 1 | **Create** `.claude/commands/write-spec.md` (Agent 1). The spec/`agents.md` are already authored & approved — but the command **file itself** is a required deliverable: create it, then dry-run it to a scratch path (e.g. `/tmp/write-spec-check.md`), never overwriting the approved spec. | n/a |
| 3 | `/run-pipeline`, `/validate-transactions` (authored this phase) | n/a |
| 6 | screenshots (Playwright MCP or OS capture) | OS screenshot tool; note which in the PR |

### How to start

1. Read the four docs above.
2. Reply with a short (≤ 10 bullet) restatement of the build + any genuine ambiguities. Flag specifically: `node -v` ≥ 22, whether `npx tsx` runs a `.ts` file, and whether context7 is available.
3. On my confirmation, execute **Phase 0 (scaffold)**, commit, summarize. Then proceed phase-by-phase, stopping for approval only before **Phase 2** and **Phase 6**.

### Definition of done

The **Acceptance checklist in `specification.md`** is the canonical "done". Highlights:
- `.claude/commands/write-spec.md` **exists on disk** and regenerates a compliant spec (verified via dry-run to a scratch path) — "the spec is already approved" does **not** satisfy this item.
- `npm run pipeline` processes all 8 transactions to `shared/results/`; outcomes equal the **Golden results** table (strict per-transaction integration assert).
- Coverage ≥ 90% target (hard gate 80%); coverage-gate hook blocks `git push` below 80% (demonstrate it).
- `mcp.json` wires context7 + `pipeline-status`; `get_transaction_status`, `list_pipeline_results`, and `pipeline://summary` all respond; `research-notes.md` logs ≥ 2 context7 queries.
- `README.md` includes **Created by Nick Skrypchenko** + an ASCII diagram; `HOWTORUN.md` is reproducible from a clean clone.
- 5 screenshots in `docs/screenshots/` and embedded in the PR description.
- **Vercel is out of rubric** (Phase S) — do not let it gate the submission.

Good luck. Start with Step 1.

---

## Notes for Nicko (not part of the prompt)

- **This is a planning-package handoff.** The four docs are done and mutually consistent (we reconciled them over several review rounds). The kickoff prompt deliberately does **not** repeat their content — it points Claude Code at them and enforces the order + gates.
- **Two coverage numbers are intentional, not a typo:** 80% is the hard floor (config thresholds *and* the push hook), 90% is the target. An honest 85% run is spec-compliant and must not read as "broken".
- **Two branches can't be hit by the reference sample** (`escalate=true` needs risk ≥ 0.60; the country-denylist branch needs a denylisted country) → Phase 3 must add synthetic fixtures, or coverage drops below 90%.
- **`mcp.json` uses `npx tsx mcp/server.ts`**, not `node` — bare Node 22 can't run `.ts`.
- **If you want it more autonomous,** drop the Phase 2 approval gate. **If less,** add "ask before every phase boundary" to ground rule #4.
- **Phase 1 is not a no-op.** Because we hand-authored the approved spec, Claude Code could wrongly conclude Phase 1's gate is already green and skip creating `.claude/commands/write-spec.md` — but that file is a named required artifact and a checklist item. The kickoff + `plan.md` now force its creation plus a dry-run self-check (to a scratch path, never overwriting the approved spec).
- **Vercel (Phase S)** is a separate, optional step after the rubric passes — see `plan.md` §Phase S.

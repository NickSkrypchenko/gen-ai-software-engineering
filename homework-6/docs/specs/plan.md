# Homework 6 — Implementation Plan

**Status:** Ready for implementation. The spec is **approved** → the gate "spec approved before code generation" is satisfied.
**Authoritative inputs:** `specification.md` (contract) · `agents.md` (AI behavior) · `docs/specs/brainstorm-summary.md` (rationale + golden results).
**Driver:** Claude Code, via `docs/specs/claude-code-kickoff-prompt.md`.

This plan sequences TASKS.md Task 1–5 into ordered phases with explicit dependencies and per-phase quality gates. It maps each phase to the responsible **meta-agent** (Agent 1–4). It does **not** restate the spec — the spec owns the *what*; this plan owns the *order* and the *gates*.

---

## Hard gate (already cleared)

> **G0 — Spec approval.** No production/runtime code is generated until `specification.md` is approved. **Cleared on 2026-06-19.** Phases 0–1 (scaffold + spec command) may run before approval; Phase 2 onward requires it.

---

## Phase pipeline

| Phase | TASKS.md | Meta-agent | Output | Depends on |
|---|---|---|---|---|
| 0 — Scaffold | — | — | Project skeleton, deps, config, dirs | — |
| 1 — Spec command | Task 1 | Agent 1 | `/write-spec` + (spec/agents.md already authored) | 0 |
| 2 — Pipeline | Task 2 | Agent 2 | integrator + 3 agents + cores/lib + `research-notes.md` | 1 (+ G0) |
| 3 — Tests + hook + skills | Task 3 / Task 5 | Agent 3 | Vitest suite ≥90%, fixtures, 2 skills, coverage gate | 2 |
| 4 — MCP | Task 4 | Agent 2 | `mcp/server.ts` + `mcp.json` (context7 + pipeline-status) | 2 (∥ 3) |
| 5 — Docs | Task 5 | Agent 4 | `README.md` (+name +ASCII) + `HOWTORUN.md` | 2, 3, 4 |
| 6 — Screenshots + PR | Submission | — | 5 screenshots + PR description | 2–5 |
| S — Vercel (**stretch, out of rubric**) | — | — | dashboard + status API | 2 (results exist) |

Ordering rule: 0 → 1 → 2 → {3 ∥ 4} → 5 → 6. Phase S is optional and runs only after Phase 6 passes; it is **not** in the spec's acceptance checklist.

---

## Phase detail

### Phase 0 — Scaffold
- `package.json` (scripts: `dev`, `build`, `pipeline`, `test`, `test:cov`, `mcp`), `tsconfig.json`, `vitest.config.ts` (v8 coverage, **thresholds 80/80/80/80 — the hard floor, the same number the push gate enforces**; 90% is the target we *aim* for, not config-enforced, so an honest 85% run does **not** fail `test:cov` or the `test-coverage.png` screenshot).
- Install: `typescript`, `tsx`, `decimal.js`, `fastmcp`, `vitest`, `@vitest/coverage-v8`.
- Create dirs: `src/{domain,agents,lib}`, `config/`, `shared/{input,processing,output,results}` (`.gitkeep`), `tests/{unit,integration,fixtures}`, `mcp/`, `.claude/{commands,hooks}`, `docs/screenshots`.
- Author data: `config/fx-rates.json` (`as_of` + exactly 7 keys), `config/denylist.json` (`{accounts:["ACC-9999"], countries:[...]}`); confirm `sample-transactions.json` present (do not modify).
- **Gate:** `npm run build` + an empty `vitest run` both green.

### Phase 1 — Agent 1 (Specification command)
- **Create the file `.claude/commands/write-spec.md`** (prompt/template from Low-Level Task Agent 1) — it regenerates `specification.md` from `brainstorm-summary.md` and extends `agents.md`. It is a **named required artifact** and a separate Acceptance-checklist item; it must exist on disk **even though** `specification.md`/`agents.md` were already hand-authored and approved.
- **"Spec already approved" does NOT close this phase** — the deliverable is the *command*, not the spec. Do not skip to Phase 2 on the grounds that the spec already exists.
- Self-verify without clobbering the approved spec: run `/write-spec` in **dry-run to a scratch path** (e.g. `/tmp/write-spec-check.md`) and diff against `specification.md`; never overwrite the approved file.
- **Gate:** `.claude/commands/write-spec.md` exists on disk **and** a dry-run regenerates a compliant spec into the scratch path.

### Phase 2 — Agent 2 (Pipeline) — uses **context7**
- Pure cores: `domain/{validation,fraud-rules,fx,compliance-rules}.ts`.
- Lib: `lib/{money,messages,logger,shared-dirs}.ts` (`Money = Decimal.clone(...)`; UUIDv4 envelopes; append-only `audit.log` with PII masking; FS helpers).
- Agents: `agents/{transaction-validator,fraud-detector,compliance-checker}.ts` (thin CLI wrappers; validator `--dry-run`).
- `integrator.ts` (`runPipeline(clock, dirs)`); `types.ts`.
- `research-notes.md`: **≥ 2 context7 queries** (e.g. `decimal.js` clone/rounding, `fastmcp` API) with library IDs + applied insight.
- **Gate:** `npm run pipeline` writes 8 result JSONs + `audit.log` + summary; outcomes match the **Golden results** table by hand.

### Phase 3 — Agent 3 (Tests + skills + coverage gate)
- Unit tests: each core + each domain module. Integration test: **strict per-transaction assert** against Golden results.
- Synthetic fixtures: `risk_score ≥ 0.60` (→ `escalate=true`) and denylisted `metadata.country` (→ country `REJECT`) — both unreachable from the sample.
- Skills: `.claude/commands/run-pipeline.md`, `.claude/commands/validate-transactions.md` (exact TASKS.md steps).
- Coverage gate: `.claude/hooks/coverage-gate.mjs` + `.claude/settings.json` (`PreToolUse`+`Bash`, exit 2 on `git push` when lines < 80%).
- **Gate:** coverage ≥ 90%; gate verified by a temporary sub-80% run that blocks the push.

### Phase 4 — Task 4 (Custom MCP)  *(parallel with Phase 3)*
- `mcp/server.ts` (`fastmcp`): `get_transaction_status`, `list_pipeline_results`, resource `pipeline://summary`.
- `mcp.json`: context7 (`npx @upstash/context7-mcp`) + `pipeline-status` (`npx tsx mcp/server.ts` — **not** bare `node`, which cannot run `.ts`; consistent with the rest of the toolchain).
- **Gate:** all three artifacts respond against a real run's `shared/results/`.

### Phase 5 — Agent 4 (Docs)
- `README.md`: **Created by Nick Skrypchenko**, 1–2 paragraph summary, one bullet per agent, ASCII pipeline diagram, tech-stack table.
- `HOWTORUN.md`: numbered setup → `npm run pipeline` → `/run-pipeline`, `/validate-transactions` → coverage gate → both MCP servers.
- **Gate:** name + diagram present; HOWTORUN runs clean on a fresh clone.

### Phase 6 — Screenshots + PR
- `docs/screenshots/`: `pipeline-run.png`, `test-coverage.png` (≥90%), `skill-run-pipeline.png`, `hook-trigger.png`, `mcp-interaction.png` (context7 + custom tool).
- PR `homework-6-submission` → fork `main`; embed all 5 screenshots + implementation summary + AI-tool log.
- **Gate:** every spec acceptance-checklist box ticked.

### Phase S — Vercel (stretch, out of rubric)
- `api/` serverless handler + `vercel.json` + a small dashboard reading a committed `shared/results/` snapshot (read-only), mirroring HW1.
- Deploy via the user's Vercel account. **Excluded from the spec checklist**; do not let it gate Phases 0–6.

---

## Quality gates (non-negotiable)
- `npm run pipeline` exits 0; all 8 transactions in `shared/results/`; outcomes equal the Golden results table.
- **Coverage: hard gate 80%** (enforced by both `vitest.config.ts` thresholds and the `coverage-gate.mjs` push hook), **target ≥ 90%** (aim, not a hard fail — an 85% run is spec-compliant and must not read as "broken").
- `mcp.json` wires both servers; all three custom artifacts respond; `research-notes.md` logs ≥ 2 context7 queries.
- `README.md` contains the author name + ASCII diagram; `HOWTORUN.md` is reproducible from a clean clone.
- No `number`/`float` for money; no global `Decimal.set`; no runtime LLM/network; `sample-transactions.json` unmodified.

## Don't invent scope
If something isn't in `specification.md`, it isn't in v1. Real gaps get a line in `brainstorm-summary.md` §11 (out of scope), not silent expansion. Known non-goals: live FX, live sanctions API, cross-transaction structuring, DB, runtime LLM — leave them out.

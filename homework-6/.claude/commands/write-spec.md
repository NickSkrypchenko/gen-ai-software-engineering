---
description: Generate a compliant specification.md (and extend agents.md) for the Homework 6 banking pipeline from the approved design log.
argument-hint: "[output-path]  # optional; default: specification.md. Pass /tmp/write-spec-check.md for a dry-run."
allowed-tools: Read, Write, Edit
---

# /write-spec — Agent 1 (Specification meta-agent)

You are the **Specification meta-agent** for the Homework 6 capstone. Regenerate a
complete, compliant `specification.md` from the **approved design log**, and extend
`agents.md` with project-specific behavior context. Do **not** invent scope beyond the
design log.

## Inputs (read fully before writing)

1. `TASKS.md` — the assignment brief (four meta-agents; the required "plus" per agent).
2. `docs/specs/brainstorm-summary.md` — the **approved** decision log: scope decisions,
   architecture, the deterministic decision rules, the FX table, the **Golden results
   table** (§4), assumptions (§10), and explicit non-goals (§11). This is the source of
   truth for every value you emit.

## Output target

- **Argument `$1` = output path.** If `$1` is provided, write the regenerated spec there
  (e.g. `/tmp/write-spec-check.md` for a **dry-run**). If `$1` is empty, the target is
  `specification.md`.
- **Guardrail — never clobber an approved file.** If the target is `specification.md` and
  it already exists with `Status: Approved`, do **not** overwrite it unless the invoker
  explicitly says "overwrite the approved spec". For verification, always dry-run to a
  scratch path and diff. The `agents.md` extension step is **skipped** on a dry-run (only
  run it when writing the real `specification.md`).

## Required structure (all five sections must be present)

Emit a single Markdown file with exactly these sections, in order:

1. **Title + front-matter block** — `Author: Nick Skrypchenko`, course line,
   `Status: Approved for implementation`, and the stack line
   (Node.js ≥ 22 · TypeScript 5 · Vitest 3 · `decimal.js` · `fastmcp`).
2. **High-Level Objective** — one paragraph: a deterministic, file-based multi-agent
   pipeline (Validator → Fraud Detector → Compliance Checker) built and operated by four
   Claude Code meta-agents; four terminal dispositions.
3. **Mid-Level Objectives** — 4–5 **testable** bullets: envelope + shared-dir transport;
   validation terminal on failure; auditable additive risk scoring; compliance owns
   APPROVE/HOLD/REJECT; complete audited well-tested run (coverage ≥ 90%, gate 80%).
4. **Implementation Notes** — encode every banking constraint (see checklist below).
5. **Context** — *Beginning context* (sample-transactions.json, config snapshots, empty
   shared dirs, the planning docs) and *Ending context* (result JSONs + audit.log +
   summary, src tree, mcp server, tests, .claude artifacts, README/HOWTORUN/research-notes,
   extended agents.md), **followed by the Golden results table** copied verbatim from
   brainstorm-summary.md §4 (8 rows: TXN001 APPROVE, TXN002 HOLD, TXN003 REJECT,
   TXN004 HOLD, TXN005 HOLD, TXN006 REJECTED_VALIDATION, TXN007 REJECTED_VALIDATION,
   TXN008 APPROVE; tally 2/3/1/2).
6. **Low-Level Tasks** — exactly **one block per meta-agent** (Agent 1 spec command,
   Agent 2 pipeline, Agent 3 tests+hook+skills, Agent 4 docs), each with Task / Prompt /
   Files to CREATE / Functions to CREATE / Details.
7. **Acceptance checklist** — the TASKS.md success criteria as checkboxes (Vercel excluded).

## Banking constraints to embed (non-negotiable — must all appear)

- **Money:** `const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN })` in
  `src/lib/money.ts`; amounts as strings; **never** `number`/`float`/raw `Decimal`;
  **never** `Decimal.set(...)` on the global; round only at the final step.
- **IDs:** `message_id = crypto.randomUUID()` v4. Envelope fields: `message_id`,
  `timestamp` (ISO 8601), `source_agent`, `target_agent`, `message_type`, `data`.
- **Currencies:** closed ISO 4217 allow-list of **exactly 7** — `USD, EUR, GBP, JPY, CHF,
  CAD, AUD` — equal **1:1** to the `config/fx-rates.json` keys (parity unit test). FX→USD
  normalization happens **before** amount thresholds; cores receive the rate table as an
  argument (pure).
- **Risk model (additive, cap 1.0):** high-value >$10k +0.40 · NEAR_THRESHOLD
  $9000–9999.99 +0.20 · off-hours UTC[0–5] +0.20 · cross-border (currency≠USD or
  country≠US) +0.20 · wire +0.10. Bands: <0.30 low · 0.30–0.59 medium · ≥0.60 high.
- **Compliance:** denylist hit (either `source_account`/`destination_account` vs
  `denylist.accounts`, or `metadata.country` vs `denylist.countries`) → `REJECT`; else
  `score ≥ 0.30` → `HOLD`; else `APPROVE`.
- **Decision enum:** exactly four — `APPROVE`, `HOLD`, `REJECT`, `REJECTED_VALIDATION`.
  `escalate` is a boolean **audit annotation** on a `HOLD` when band ≥ 0.60 — not a 5th
  status.
- **Audit trail (distinct from results):** append-only `shared/results/audit.log`, **one
  line per agent-hop** (`validate`/`score`/`decide`) with ISO 8601 ts, agent, transaction_id,
  outcome. **PII masked** (`ACC-1001` → `ACC-***1`); never plaintext accounts/names.
- **Determinism:** no LLM calls, no network at runtime; inject a `Clock`; identical input →
  identical `shared/results/`.
- **Coverage:** target **≥ 90%**, hard gate **80%** enforced by both `vitest.config.ts`
  thresholds and a `coverage-gate.mjs` push hook (`PreToolUse`+`Bash`, exit 2).
- **Custom MCP** launches as `npx tsx mcp/server.ts` (bare `node` cannot run `.ts`).

## Steps

1. Read `TASKS.md` and `docs/specs/brainstorm-summary.md` end-to-end.
2. Compose the spec per the structure + constraints above, taking every concrete value
   (rates, weights, thresholds, Golden table, denylist semantics) from the design log.
   Invent nothing the log does not establish.
3. Write to `$1` if given, else to `specification.md` (respecting the approved-file
   guardrail).
4. **Only when writing the real `specification.md`:** extend `agents.md` so its tech stack,
   domain-rules table, FX/denylist assumptions, and coverage-gate section stay in sync with
   the spec. Skip this on a dry-run.
5. Report what was written and, if a dry-run, suggest diffing against `specification.md`.

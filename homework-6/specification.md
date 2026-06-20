# AI-Powered Multi-Agent Banking Transaction Pipeline — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives. This spec is authoritative; if it conflicts with a prompt, the spec wins.

**Author:** Nick Skrypchenko
**Course:** GenAI and Agentic AI for Software Engineering — Homework 6 (Capstone)
**Status:** Approved for implementation (design log: `docs/specs/brainstorm-summary.md`)
**Stack:** Node.js ≥ 22 · TypeScript 5 · Vitest 3 · `decimal.js` · `fastmcp`

---

## High-Level Objective

- Build a deterministic, file-based multi-agent pipeline that ingests raw bank transactions and routes each one to a final disposition (APPROVE / HOLD / REJECT / REJECTED_VALIDATION) through a Transaction Validator, a Fraud Detector, and a Compliance Checker — created and operated entirely by four Claude Code meta-agents.

---

## Mid-Level Objectives

1. **Envelope + transport.** Each raw record is wrapped in a standard message envelope (`message_id` = `crypto.randomUUID()` v4, ISO 8601 `timestamp`, `source_agent`, `target_agent`, `message_type`, `data`) and flows Validator → Fraud Detector → Compliance Checker via JSON files in `shared/{input,processing,output,results}/`.
2. **Validation is terminal on failure.** Transactions that fail validation (missing required field, unsafe `transaction_id`, non-positive amount, non-ISO-4217 currency, malformed ISO 8601 timestamp) terminate as `REJECTED_VALIDATION` in `shared/results/` and never reach the Fraud Detector or Compliance Checker.
3. **Auditable risk scoring.** The Fraud Detector normalizes the amount to a USD-equivalent (static FX table) and produces an additive `risk_score` ∈ [0, 1] from high-value, near-threshold, off-hours, cross-border, and wire signals; it records `amount_usd_equivalent`, `risk_score`, `risk_band`, and `matched_signals[]` on the envelope for a complete rule trail.
4. **Compliance owns all three of its outcomes.** The Compliance Checker emits exactly one of `APPROVE` / `HOLD` / `REJECT`; `REJECT` is owned by a static denylist/sanctions policy (independent of score), `score ≥ 0.30` → `HOLD` (with an `escalate` audit flag when the band is high), otherwise `APPROVE`.
5. **Complete, audited, well-tested run.** The pipeline processes all 8 sample transactions to completion in `shared/results/`, writes an append-only ISO 8601 audit log of every agent operation, emits a run summary, and is covered by tests at **≥ 90%** (hard gate **80%**), enforced by a coverage-gate hook that blocks `git push`.

---

## Implementation Notes

- **Monetary values.** Use `decimal.js` for every amount; keep amounts as strings end-to-end (`"1500.00"`). **`number`/`float` is banned for money.** Round with banker's rounding only at the final step. **Do not mutate the global `Decimal` via `Decimal.set(...)`** — that leaks across the whole process and makes Vitest worker/file order affect results (it would violate the determinism principle, which applies to tests too). Instead create an **isolated** constructor `const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN })` in `src/lib/money.ts` and import `Money` everywhere (`decimal.js` defaults to `ROUND_HALF_UP`; cloning leaves the global default untouched and keeps tests order-independent).
- **FX normalization.** Amounts are converted to a USD-equivalent before amount thresholds using `config/fx-rates.json` (`{ "as_of": "<date>", "rates": { "USD": "1.00", ... } }`). A loader in `src/domain/fx.ts` *reads* this snapshot into an `FxTable`; the pure converter `toUsd(amount, currency, rates)` receives the table as an argument so the cores stay pure. **The set of rate keys equals the validator's ISO 4217 allow-list, 1:1** — enforced by a unit test; a valid currency with no rate must be impossible.
- **Currency codes.** ISO 4217 allow-list is a fixed, **closed set of exactly 7**: `USD, EUR, GBP, JPY, CHF, CAD, AUD` (no open-ended extension). `config/fx-rates.json` carries exactly these 7 keys; the parity unit test asserts the two sets are equal. Codes outside the set are rejected by the validator.
- **Validator reject reasons (terminal `REJECTED_VALIDATION`).** The first failing rule wins; check order is missing field → unsafe id → amount → currency → timestamp:

  | Rule | `reject_reason` |
  |---|---|
  | Missing required field | `MISSING_FIELD:<name>` |
  | `transaction_id` not matching `^[A-Za-z0-9_-]+$` (becomes part of result/audit filenames — also blocks path traversal) | `INVALID_TRANSACTION_ID` |
  | Amount not a positive decimal (`> 0`) | `NON_POSITIVE_AMOUNT` |
  | Currency outside the ISO 4217 allow-list | `INVALID_CURRENCY:<code>` |
  | Malformed ISO 8601 timestamp | `INVALID_TIMESTAMP` |
- **Audit trail (distinct from result files).** Every agent operation is appended to an **append-only audit log** at `shared/results/audit.log` — **one line per agent-hop** (`validate` / `score` / `decide`) with ISO 8601 timestamp, agent name, `transaction_id`, and outcome. This is **separate** from the per-transaction outcome JSON files written to `shared/results/`; the result JSON is the final state, the audit log is the operation history. `src/lib/logger.ts` owns this.
- **PII.** `source_account`, `destination_account`, and any name/description are sensitive. Never write them in plaintext to logs — mask account numbers (`ACC-1001` → `ACC-***1`). The audit log stores `transaction_id` and outcome, not raw PII.
- **Determinism.** No LLM calls and no network at runtime. Inject a `Clock` into agents/integrator so timestamps are deterministic in tests. The pipeline must produce identical `shared/results/` for identical input.
- **Decision enum.** Exactly four values: `APPROVE`, `HOLD`, `REJECT`, `REJECTED_VALIDATION`. `escalate` is a boolean **audit annotation** on a `HOLD` when the fraud band is high (`≥ 0.60`) — not a fifth status and not a separate enum branch.
- **Two-layer agents.** The three pipeline agents are **pure deterministic TypeScript** (no runtime LLM). The four meta-agents (below) are build-time Claude Code workflows.

---

## Context

### Beginning context
- `sample-transactions.json` — 8 raw transaction records (the reference input; **must not be modified**).
- `config/fx-rates.json`, `config/denylist.json` — static snapshots (FX rates with `as_of`; denylisted accounts + countries).
- Empty `shared/{input,processing,output,results}/` directories.
- `TASKS.md`, `specification.md`, `agents.md`, and `docs/specs/brainstorm-summary.md` (design log — the rationale behind the golden results below).

### Ending context
- `shared/results/` — one outcome JSON per transaction (8 total) + append-only `audit.log` + a `pipeline-summary.json` run report.
- `src/` — integrator + 3 pipeline agents (CLI wrappers) + pure domain cores + lib helpers.
- `mcp/server.ts` — custom `fastmcp` server; `mcp.json` wiring context7 + pipeline-status.
- `tests/` — unit (each agent core + each domain module) + 1 integration test + synthetic fixtures; coverage **≥ 90%**.
- `.claude/commands/{write-spec,run-pipeline,validate-transactions}.md`, `.claude/hooks/coverage-gate.mjs`, `.claude/settings.json` (coverage gate).
- `README.md` (Created by Nick Skrypchenko, ASCII diagram), `HOWTORUN.md`, `research-notes.md` (≥ 2 context7 queries).
- `agents.md` — project AI-behavior guide (stack, domain rules, FX/denylist assumptions, coverage gate), extended from the starter.

### Golden results — source of truth for the integration test

| ID | Amount / Ccy | Validator | Risk | Outcome |
|---|---|---|---|---|
| TXN001 | 1500.00 USD | valid | 0.00 | APPROVE |
| TXN002 | 25000.00 USD wire | valid | 0.50 | HOLD |
| TXN003 | 9999.99 USD → ACC-9999 (denylist) | valid | 0.20 | REJECT |
| TXN004 | 500.00 EUR @ 02:47 DE | valid | 0.40 | HOLD |
| TXN005 | 75000.00 USD wire | valid | 0.50 | HOLD |
| TXN006 | 200.00 XYZ | reject | — | REJECTED_VALIDATION |
| TXN007 | -100.00 GBP | reject | — | REJECTED_VALIDATION |
| TXN008 | 3200.00 USD | valid | 0.00 | APPROVE |

Tally: **2 APPROVE · 3 HOLD · 1 REJECT** (compliance, on `destination_account` = `ACC-9999`) **· 2 REJECTED_VALIDATION = 8**. The integration test asserts each transaction's **exact** outcome (`TXN001→APPROVE, TXN002→HOLD, TXN003→REJECT, …`), not merely that all 8 reached `shared/results/`.

---

## Low-Level Tasks

> One entry per meta-agent. Each is the exact prompt to run plus the files/functions it creates.

### 1. Agent 1 — Specification (slash command)

**Task:** Specification meta-agent
**Prompt:** *"Read `TASKS.md` and `docs/specs/brainstorm-summary.md`. Generate `specification.md` following the required template — High-Level Objective, Mid-Level Objectives (4–5 testable items), Implementation Notes, Context (beginning/ending), and Low-Level Tasks with one block per meta-agent. Then extend `agents.md` with project-specific context (stack, domain rules, FX/denylist assumptions, coverage gate). Do not invent scope beyond the approved design log."*
**Files to CREATE:** `.claude/commands/write-spec.md` (the reusable slash command) → which produces `specification.md` **and** extends `agents.md`
**Function to CREATE:** n/a (Claude Code command; the "function" is the spec-generation workflow)
**Details:** The `/write-spec` command encodes the template and the banking constraints (decimal money, ISO 4217, ISO 8601 audit, PII masking, coverage ≥ 90%) so re-running it regenerates a compliant `specification.md` from the design log. It also extends `agents.md` so the AI-behavior guide stays in sync with the spec — **both are required deliverables of Task 1**.

### 2. Agent 2 — Code generation (integrator + 3 pipeline agents)

**Task:** Code-generation meta-agent (uses **MCP context7**; log ≥ 2 queries in `research-notes.md`)
**Prompt:** *"Implement the deterministic pipeline from `specification.md`. Create the integrator and three pure agent cores with thin CLI wrappers, the shared-dir protocol, the message envelope, the decimal/FX/logger libs, and the append-only audit log. Use context7 to look up `decimal.js`, `fastmcp`, and Vitest-coverage APIs; record the queries and applied insights in `research-notes.md`. No runtime LLM calls."*
**Files to CREATE:**
- `src/integrator.ts` — orchestrator
- `src/agents/{transaction-validator,fraud-detector,compliance-checker}.ts` — CLI wrappers (validator supports `--dry-run`)
- `src/domain/{validation,fraud-rules,compliance-rules,fx}.ts` — pure cores
- `src/lib/{messages,money,logger,shared-dirs}.ts`, `src/types.ts`
- `mcp/server.ts`, `mcp.json`, `config/fx-rates.json`, `config/denylist.json`
**Functions to CREATE:**
- `validateTransaction(tx): ValidationResult` · `scoreTransaction(tx, rates): RiskResult` · `decide(scored, denylist): ComplianceResult`
- `buildEnvelope(data, source, target): Message` · `toUsd(amount, currency, rates: FxTable): Money`
- `runPipeline(clock, dirs): PipelineSummary`
- **MCP server (`mcp/server.ts`) — exact named artifacts (TASKS.md Task 4):** tool `get_transaction_status` → `getTransactionStatus(transactionId: string): TransactionStatus` (reads `shared/results/`); tool `list_pipeline_results` → `listPipelineResults(): PipelineResultsSummary`; resource `pipeline://summary` → latest run summary as text. **Launched from `mcp.json` as `npx tsx mcp/server.ts`** (bare `node` cannot run `.ts`; matches the `tsx` toolchain used by `npm run pipeline`).
**Details:** Validator checks required fields, a safe `transaction_id` (`^[A-Za-z0-9_-]+$`), positive `Decimal` amount, ISO 4217 currency, ISO 8601 timestamp; failure ⇒ `REJECTED_VALIDATION` written straight to `shared/results/`. The id is additionally sanitized to a single path segment before any filename use (defense in depth). Fraud Detector applies the additive model on `amount_usd_equivalent` (high-value > 10000 +0.40; `NEAR_THRESHOLD` 9000–9999.99 +0.20; off-hours UTC[0–5] +0.20; cross-border +0.20; wire +0.10) and records `matched_signals[]`. Compliance Checker: denylist hit — **both** `source_account` and `destination_account` checked against `config/denylist.json.accounts`, **or** `metadata.country` against `.countries` → `REJECT`; else `score ≥ 0.30` → `HOLD` (`escalate=true` when band high); else `APPROVE`. **Audit log (`shared/results/audit.log`) is written per agent-hop and is distinct from the per-transaction result JSON** — do not conflate "a file in `shared/`" with the audit trail.

### 3. Agent 3 — Unit tests + skills + coverage-gate hook

**Task:** Unit-test meta-agent
**Prompt:** *"Write a Vitest suite covering each agent core, each domain module, and one full-pipeline integration test. Add synthetic fixtures for the branches the 8-record sample cannot reach. Add the `/run-pipeline` and `/validate-transactions` slash commands and a coverage-gate hook that blocks `git push` below 80%. Target ≥ 90% coverage."*
**Files to CREATE:**
- `tests/unit/*.test.ts` (per agent core + per domain module), `tests/integration/pipeline.test.ts`, `tests/fixtures/*`
- `.claude/commands/run-pipeline.md`, `.claude/commands/validate-transactions.md`
- `.claude/hooks/coverage-gate.mjs`, `.claude/settings.json`
**Functions to CREATE:** test suites; `coverage-gate.mjs` reads `coverage/coverage-summary.json` and `process.exit(2)` if lines < 80%
**Details:** The integration test asserts each of the 8 sample transactions' **exact** outcome against the **Golden results** table in Context — a strict per-transaction assert (`TXN001→APPROVE, TXN002→HOLD, TXN003→REJECT, …`), not merely that all 8 reached `shared/results/`. **Synthetic fixtures are required for two branches that are physically unreachable from the reference sample** (which never exceeds risk 0.50 and only triggers an account denylist hit): (a) a transaction with `risk_score ≥ 0.60` to exercise `escalate=true` on a `HOLD`; (b) a transaction whose `metadata.country` is on the denylist to exercise the country-branch `REJECT`. Without these fixtures both branches drop coverage below 90%. `/run-pipeline` steps (per TASKS.md): check `sample-transactions.json` exists → clear `shared/` dirs → run the pipeline → show a summary of `shared/results/` → report rejected transactions and why. `/validate-transactions` steps: run the validator in `--dry-run` → report total / valid / invalid counts + rejection reasons → print a results table. Tests run against a temp dir, never the real `shared/`. The hook: `PreToolUse` + matcher `Bash`; the script detects a `git push` command, runs coverage, exits 2 (blocks) if below 80%.

### 4. Agent 4 — Documentation

**Task:** Documentation meta-agent
**Prompt:** *"Generate `README.md` and `HOWTORUN.md` from the implemented system. README must include the author name, a 1–2 paragraph description, one bullet per agent, an ASCII architecture diagram, and a tech-stack table. HOWTORUN must be numbered setup → run → demo steps."*
**Files to CREATE:** `README.md`, `HOWTORUN.md`
**Function to CREATE:** n/a (documentation workflow)
**Details:** `README.md` **must include "Created by Nick Skrypchenko"**, the ASCII pipeline diagram (Validator → Fraud Detector → Compliance Checker → results), agent responsibilities (one bullet each), and a tech-stack table. `HOWTORUN.md` covers install, `npm run pipeline`, the `/run-pipeline` and `/validate-transactions` skills, the coverage gate, and the two MCP servers (context7 + custom `pipeline-status`).

---

## Acceptance checklist (TASKS.md success criteria — Vercel deliberately excluded)

- [ ] `specification.md` has all 5 sections and one Low-Level Task block per meta-agent.
- [ ] `agents.md` present and extended with project context (stack, domain rules, FX/denylist assumptions).
- [ ] `/write-spec` skill regenerates a compliant `specification.md` (and updates `agents.md`) from the design log.
- [ ] Pipeline runs to completion (`npm run pipeline`) with no errors; all 8 transactions in `shared/results/`.
- [ ] All agents write valid JSON envelopes to `shared/` dirs; audit log written per agent-hop.
- [ ] `/run-pipeline` and `/validate-transactions` skills execute.
- [ ] Coverage-gate hook blocks `git push` when coverage < 80%.
- [ ] `mcp.json` wires context7 + custom `pipeline-status`; both respond; `research-notes.md` logs ≥ 2 context7 queries.
- [ ] Test coverage ≥ 90% (gate 80%), including synthetic fixtures for `escalate=true` and country-denylist.
- [ ] `README.md` includes the author name + ASCII diagram; `HOWTORUN.md` has numbered steps.
- [ ] 5 screenshots in `docs/screenshots/` and in the PR description.

> **Out of rubric (stretch only):** a Vercel dashboard + status API mirroring HW1 is tracked in `plan.md` §Stretch and is **not** part of this checklist.

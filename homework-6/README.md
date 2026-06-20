# AI-Powered Multi-Agent Banking Transaction Pipeline

**Created by Nick Skrypchenko**
GenAI and Agentic AI for Software Engineering — Homework 6 (Capstone)

A deterministic, file-based pipeline that ingests raw bank transactions and routes each one to
a final disposition — **APPROVE**, **HOLD**, **REJECT**, or **REJECTED_VALIDATION** — through a
**Transaction Validator → Fraud Detector → Compliance Checker**. The system is *built and
operated* by four Claude Code **meta-agents** (spec, code, tests, docs), but the runtime
pipeline itself makes **no LLM calls and no network requests**: it is pure rule-based
TypeScript, so identical input always produces identical output.

Money is handled with `decimal.js` (banker's rounding, strings end-to-end — never floats);
every amount is normalized to a USD-equivalent before fraud thresholds via a static FX
snapshot; and every agent hop is written to an append-only, PII-masked audit log that is
distinct from the per-transaction result files.

---

## Two layers of "agents" (don't conflate them)

| Layer | What it is | Runtime LLM? |
|---|---|---|
| **Meta-agents (Agent 1–4)** | Build-time Claude Code workflows that *create* the system: `/write-spec` (spec), code generation (with context7), tests + coverage gate, docs. | Yes — at build time only |
| **Pipeline agents (3)** | Cooperating modules *inside* the built system: Validator → Fraud Detector → Compliance Checker. Plain deterministic TypeScript. | **No** |

### Pipeline agents (one bullet each)

- **Transaction Validator** — checks required fields, a positive `Decimal` amount, an ISO 4217
  currency (closed 7-currency allow-list), and an ISO 8601 timestamp. Failure is terminal:
  the transaction becomes `REJECTED_VALIDATION` and never reaches the downstream agents.
- **Fraud Detector** — normalizes the amount to a USD-equivalent, then applies an additive,
  capped risk score (high-value, near-threshold, off-hours, cross-border, wire) and records
  `amount_usd_equivalent`, `risk_score`, `risk_band`, and `matched_signals[]` for a full audit trail.
- **Compliance Checker** — owns the final decision: a denylist/sanctions hit (account or
  country) → `REJECT`; otherwise `risk_score ≥ 0.30` → `HOLD` (with an `escalate` audit flag
  when the band is high); otherwise `APPROVE`.

---

## Architecture

```
                       sample-transactions.json  (8 raw records — never modified)
                                    │
                                    ▼
                            ┌────────────────┐
                            │   Integrator   │  loads input, builds UUIDv4 envelopes,
                            │ (orchestrator) │  runs the 3 cores in order, writes files
                            └───────┬────────┘
                                    │  shared/input/
                                    ▼
                        ┌───────────────────────┐
                        │ Transaction Validator │   required fields · positive Decimal
                        │   (deterministic TS)  │   amount · ISO 4217 · ISO 8601
                        └───────────┬───────────┘
          valid → shared/output/    │    invalid → shared/results/ (REJECTED_VALIDATION)
                                    ▼
                        ┌───────────────────────┐
                        │     Fraud Detector    │   USD-equiv normalization →
                        │   (deterministic TS)  │   additive risk ∈ [0,1] + band + signals
                        └───────────┬───────────┘
                                    │  shared/output/
                                    ▼
                        ┌───────────────────────┐
                        │   Compliance Checker  │   denylist → REJECT ·
                        │   (deterministic TS)  │   score ≥ 0.30 → HOLD · else APPROVE
                        └───────────┬───────────┘
                                    │
                                    ▼
                        shared/results/  →  <id>.result.json  (one per transaction)
                                            audit.log          (one masked line per hop)
                                            pipeline-summary.json
```

**Shared-directory protocol:** `input/` (initial message) → `processing/` (in-flight) →
`output/` (handed to the next agent) → `results/` (final outcome + audit log + summary).

---

## Decision rules (deterministic)

- **Risk signals (additive, capped at 1.0):** high-value `> $10,000` USD-eq `+0.40` ·
  near-threshold `$9,000–9,999.99` `+0.20` · off-hours UTC[0–5] `+0.20` ·
  cross-border (currency ≠ USD **or** country ≠ US) `+0.20` · wire `+0.10`.
  Bands: `< 0.30` low · `0.30–0.59` medium · `≥ 0.60` high.
- **Decision enum (exactly 4):** `APPROVE`, `HOLD`, `REJECT`, `REJECTED_VALIDATION`.
  `escalate` is a boolean audit flag on a high-band `HOLD` — not a fifth status.
- **FX ↔ allow-list parity:** the FX-rate keys equal the currency allow-list 1:1
  (`USD, EUR, GBP, JPY, CHF, CAD, AUD`), enforced by a unit test.

### Golden results (the 8 sample transactions)

| ID | Amount / Ccy | Risk | Outcome |
|---|---|---|---|
| TXN001 | 1500.00 USD | 0.00 | APPROVE |
| TXN002 | 25000.00 USD wire | 0.50 | HOLD |
| TXN003 | 9999.99 USD → ACC-9999 (denylist) | 0.20 | REJECT |
| TXN004 | 500.00 EUR @ 02:47 DE | 0.40 | HOLD |
| TXN005 | 75000.00 USD wire | 0.50 | HOLD |
| TXN006 | 200.00 XYZ | — | REJECTED_VALIDATION |
| TXN007 | -100.00 GBP | — | REJECTED_VALIDATION |
| TXN008 | 3200.00 USD | 0.00 | APPROVE |

Tally: **2 APPROVE · 3 HOLD · 1 REJECT · 2 REJECTED_VALIDATION = 8.**

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22 |
| Language | TypeScript (strict) | 5.x |
| Decimal math | `decimal.js` | 10.x |
| Test runner | Vitest | 3.x |
| Coverage | `@vitest/coverage-v8` | latest |
| Custom MCP server | `fastmcp` + `zod` | latest |
| External MCP (build-time) | `@upstash/context7-mcp` | latest |
| IDs | `crypto.randomUUID()` (built-in) | — |

---

## Quick start

```bash
npm install
npm run pipeline      # process all 8 sample transactions → shared/results/
npm run test:cov      # run the suite with coverage (≥ 90% target, 80% hard gate)
```

See **[HOWTORUN.md](./HOWTORUN.md)** for full setup, the `/run-pipeline` and
`/validate-transactions` skills, the coverage-gate hook, and the two MCP servers.

---

## Project layout

```
homework-6/
├── src/
│   ├── integrator.ts                       # orchestrator (runPipeline)
│   ├── agents/{transaction-validator,fraud-detector,compliance-checker}.ts   # thin CLI wrappers
│   ├── domain/{validation,fraud-rules,compliance-rules,fx}.ts                 # pure cores
│   ├── lib/{money,messages,logger,shared-dirs}.ts
│   └── types.ts
├── mcp/server.ts                           # custom pipeline-status MCP server
├── mcp.json                                # context7 + pipeline-status
├── config/{fx-rates,denylist}.json         # static snapshots
├── shared/{input,processing,output,results}/
├── tests/{unit,integration,fixtures}/
├── .claude/commands/{write-spec,run-pipeline,validate-transactions}.md
├── .claude/hooks/coverage-gate.mjs · .claude/settings.json
├── specification.md · agents.md · research-notes.md · README.md · HOWTORUN.md
└── sample-transactions.json
```

# Homework 6 Capstone — Brainstorm / Decision Log

**Date:** 2026-06-19
**Status:** APPROVED design (planning phase — no code, no deploy yet)
**Feature:** AI-powered multi-agent banking transaction-processing pipeline, built by four Claude Code meta-agents.
**Author:** Nick Skrypchenko (design produced collaboratively with Claude in brainstorming mode)
**Deliverable of this phase:** Planning package only — `brainstorm-summary.md`, `plan.md`, `specification.md`, `agents.md`, `claude-code-kickoff-prompt.md`. Implementation and the optional Vercel deployment happen only after this package is reviewed and approved.

---

## 0. The single most important distinction (read first)

This assignment has **two layers of "agents"** and conflating them is the most common way to get the architecture wrong.

| Layer | What it is | Count | Runtime LLM calls? |
|---|---|---|---|
| **Meta-agents** | Claude Code AI workflows that **build** the system — the four deliverable "agents" (Agent 1–4). | 4 | Yes — they *are* Claude Code, at build time only |
| **Pipeline agents** | The cooperating modules **inside the built system** — Validator → Fraud Detector → Compliance Checker. **Ordinary deterministic TypeScript.** | 3 | **No** — pure rule-based logic, zero LLM at runtime |

**Consequence:** the runtime pipeline is fully deterministic, offline, reproducible. We do **NOT** repeat the Homework 4 pattern of orchestrating agents through `claude -p` subprocesses or the Anthropic SDK at runtime. No API key, no model latency, no non-determinism. "AI" lives entirely at build time (the four meta-agents) and in the two MCP integrations.

---

## 1. Scope decisions (approved)

| Parameter | Decision | Rationale |
|---|---|---|
| **Runtime stack** | Node.js ≥ 22 + TypeScript 5 | Consistency with HW1–HW5; reviewer already has the toolchain. TASKS.md is language-agnostic. |
| **Test runner** | Vitest 3 + `@vitest/coverage-v8` | Same as HW1–HW4; coverage gating is first-class. |
| **3rd pipeline agent** | **Compliance Checker** | Most on-theme; produces the final `approve / hold / reject` decision after Validator → Fraud Detector. |
| **Custom MCP server** | `fastmcp` (npm, TypeScript) | Single language across the project; ergonomic `addTool` / `addResourceTemplate` API. |
| **`message_id`** | UUID v4 via `crypto.randomUUID()` | TASKS.md message format specifies `"uuid4-string"`. Deliberate deviation from the ULID convention of earlier homeworks. |
| **Monetary type** | `decimal.js` (`Decimal`); amounts as strings end-to-end | "Never `float`". JSON amounts already strings (`"1500.00"`). |
| **Pipeline execution** | **Hybrid: pure core function + thin CLI wrapper per agent** | Core functions tested in isolation and called in-process by the integrator; CLI wrapper enables `validator --dry-run` for `/validate-transactions`. Files in `shared/*/` are written for real. |
| **Meta-agent realization** | **Slash commands + prompts in the spec** (no `.agent.md` files) | Brief strictly requires only the 3 slash commands; the 4 meta-agents are described as roles in the spec's Low-Level Tasks (one exact prompt each). Fewer files. |
| **Coverage gate** | Hook blocks `git push` if coverage **< 80%**; project target **≥ 90%** | Brief mandates the 80% gate; brief's "ending context" asks for ≥ 90%. |
| **Vercel dashboard** | **Out of rubric.** Separate stretch step *after* all TASKS.md criteria pass | Not graded by TASKS.md. Must **not** appear in `specification.md`'s acceptance checklist; tracked only in `plan.md` §Stretch. |

---

## 2. Architecture — file-based multi-agent pipeline

Deterministic linear pipeline. The integrator loads `sample-transactions.json`, wraps each record in a standard message envelope, and passes it through three agents via **files on disk** (no shared mutable memory).

```
                 sample-transactions.json
                          │
                          ▼
                  ┌────────────────┐
                  │   Integrator   │  loads input, creates envelopes,
                  │  (orchestrator)│  calls agent cores in order, collects results
                  └───────┬────────┘
                          │  shared/input/
                          ▼
              ┌───────────────────────┐
              │ Transaction Validator │  required fields, positive Decimal
              │  (deterministic TS)   │  amount, ISO 4217 currency, ISO 8601 ts
              └───────────┬───────────┘
        valid → shared/output/ │ invalid → shared/results/ (REJECTED_VALIDATION)
                          ▼
              ┌───────────────────────┐
              │    Fraud Detector     │  USD-equiv normalization → additive
              │  (deterministic TS)   │  risk score ∈ [0,1] + band + signals
              └───────────┬───────────┘
                          │  shared/output/
                          ▼
              ┌───────────────────────┐
              │  Compliance Checker   │  denylist/sanctions → REJECT;
              │  (deterministic TS)   │  score≥0.30 → HOLD; else APPROVE
              └───────────┬───────────┘
                          │
                          ▼
                  shared/results/  +  pipeline-summary report
```

### Shared-directory protocol

```
shared/
├── input/       ← integrator drops initial transaction messages
├── processing/  ← an agent moves a message here while working on it
├── output/      ← an agent writes its result here for the next agent
└── results/     ← final outcomes (APPROVE / HOLD / REJECT / REJECTED_VALIDATION)
```

### Standard message envelope

`message_id`, `timestamp`, `source_agent`, `target_agent`, `message_type` are constant across stages; each stage enriches `data`.

```json
{
  "message_id": "crypto.randomUUID() v4",
  "timestamp": "2026-03-16T10:00:00Z",
  "source_agent": "fraud_detector",
  "target_agent": "compliance_checker",
  "message_type": "transaction",
  "data": {
    "transaction_id": "TXN004",
    "amount": "500.00",
    "currency": "EUR",
    "amount_usd_equivalent": "540.00",
    "status": "scored",
    "risk_score": 0.40,
    "risk_band": "medium",
    "matched_signals": ["off_hours", "cross_border"]
  }
}
```

**Fix #2 — `amount_usd_equivalent` is part of `data`.** The Fraud Detector writes the normalized USD-equivalent into the envelope so the rule trail is auditable: a reviewer seeing `NEAR_THRESHOLD` on a non-USD transaction can see exactly why, even when the raw `amount` looks below the threshold.

Per-stage `data` fields:
- **Validator** adds `status: "validated" | "rejected"` and, on failure, `reject_reason`.
- **Fraud Detector** adds `amount_usd_equivalent`, `risk_score`, `risk_band`, `matched_signals[]`, `status: "scored"`.
- **Compliance Checker** adds `decision`, `reason`, and the boolean `escalate` (audit only — see §3.4).

---

## 3. Deterministic decision rules

### 3.1 Validator — reject reasons (failure ⇒ terminal `REJECTED_VALIDATION`, does NOT enter compliance)

| Rule | Reject reason |
|---|---|
| Missing required field (`transaction_id`, `amount`, `currency`, `source_account`, `destination_account`, `timestamp`) | `MISSING_FIELD:<name>` |
| Amount not a positive decimal (`> 0`) | `NON_POSITIVE_AMOUNT` |
| Currency not in the ISO 4217 allow-list | `INVALID_CURRENCY:<code>` |
| Malformed ISO 8601 timestamp | `INVALID_TIMESTAMP` |

### 3.2 Fraud Detector — additive risk score (capped at 1.0)

Amount is first normalized to a **USD-equivalent** via the static FX table (§5) **before** the amount thresholds are evaluated.

| Signal | Condition | Weight |
|---|---|---|
| High value | `amount_usd_equivalent > 10000` | +0.40 |
| `NEAR_THRESHOLD` | `9000 ≤ amount_usd_equivalent ≤ 9999.99` | +0.20 |
| Off-hours | UTC hour ∈ [0, 5] | +0.20 |
| Cross-border | `currency ≠ USD` **or** `metadata.country ≠ US` | +0.20 |
| Wire | `transaction_type == "wire_transfer"` | +0.10 |

> Renamed from "Structuring" to **`NEAR_THRESHOLD`**: true structuring requires aggregating multiple transactions over time (per-account state), which is out of scope for v1. The single-transaction signal must not over-promise that capability.

Bands (informational): `< 0.30` low · `0.30–0.59` medium · `≥ 0.60` high.

### 3.3 Compliance Checker — owns all three of its outcomes

```
if denylist hit (source/dest account, or country, on the static list)   → REJECT
elif risk_score ≥ 0.30                                                  → HOLD
else                                                                    → APPROVE
```

REJECT is owned by compliance via its **own policy** (sanctions/denylist screening), independent of the fraud score — not a pass-through. Validator failures are a *separate* terminal status (`REJECTED_VALIDATION`) that never reaches compliance.

### 3.4 Decision enum & the `escalate` flag (Fix #5)

The outcome enum has **exactly four values**: `APPROVE`, `HOLD`, `REJECT`, `REJECTED_VALIDATION`.

- `REJECT` = compliance-policy reject; `REJECTED_VALIDATION` = validator reject.
- When the fraud band is `high` (`≥ 0.60`), the Compliance Checker sets a boolean `escalate: true` **annotation on the HOLD audit record**. This is audit metadata only — **not** a fifth status and **not** a separate branch in the `decision` enum. The outcome is still `HOLD`.

---

## 4. Worked example for the 8 sample transactions (source of truth for tests)

| ID | Amount/Ccy | Notable signals | Validator | Risk | Outcome |
|---|---|---|---|---|---|
| TXN001 | 1500.00 USD | — | valid | 0.00 | **APPROVE** |
| TXN002 | 25000.00 USD wire | high value + wire | valid | 0.50 | **HOLD** |
| TXN003 | 9999.99 USD → **ACC-9999** | near-threshold; **denylist hit** | valid | 0.20 | **REJECT** (policy) |
| TXN004 | 500.00 EUR @02:47 DE | off-hours + cross-border | valid | 0.40 | **HOLD** |
| TXN005 | 75000.00 USD wire | high value + wire | valid | 0.50 | **HOLD** |
| TXN006 | 200.00 **XYZ** | invalid currency | **REJECT** | — | **REJECTED_VALIDATION** |
| TXN007 | **-100.00** GBP | non-positive amount | **REJECT** | — | **REJECTED_VALIDATION** |
| TXN008 | 3200.00 USD | — | valid | 0.00 | **APPROVE** |

Tally: **2 APPROVE · 3 HOLD · 1 REJECT (compliance) · 2 REJECTED_VALIDATION = 8** — every transaction reaches `shared/results/`, satisfying the brief's deliverable check. All four outcome values are exercised in the live run.

---

## 5. Currency handling — static FX normalization

A static, in-repo FX table normalizes every amount to a USD-equivalent before the amount-based fraud thresholds are applied; the cross-border signal fires independently of amount.

- **Data lives in `config/fx-rates.json`** (Fix #3), with an `as_of` snapshot date; `src/domain/fx.ts` only reads it (data separated from logic, auditable as a snapshot, not live).
- Approximate frozen rates for the closed 7-currency allow-list: USD 1.00, EUR 1.08, GBP 1.27, JPY 0.0067, CHF 1.12, CAD 0.73, AUD 0.66 (exactly these 7 keys — no more, no less).
- **FX keys = validator ISO-4217 allow-list, 1:1** (Fix #1). A unit test asserts this parity; a valid currency with no rate must be impossible (it would otherwise break the Fraud Detector).

---

## 6. The four meta-agents (build-time Claude Code workflows)

| Agent | Role | "Plus" requirement | Concrete artifact |
|---|---|---|---|
| **Agent 1 — Specification** | Produces `specification.md` from the template | **Skill**: `/write-spec` slash command | `.claude/commands/write-spec.md` |
| **Agent 2 — Code generation** | Generates integrator + 3 pipeline agents | **MCP context7**: 2+ queries documented | `src/**` + `research-notes.md` |
| **Agent 3 — Unit tests** | Generates the Vitest suite | **Hook**: blocks push if coverage < 80% | `tests/**` + `.claude/settings.json` + `/run-pipeline`, `/validate-transactions` |
| **Agent 4 — Documentation** | Generates README + HOWTORUN | **Requirement**: README includes student name | `README.md` (Created by **Nick Skrypchenko**), `HOWTORUN.md` |

Realized as the 3 required slash commands plus one exact prompt per agent in the spec's Low-Level Tasks. No separate `.claude/agents/*.md` files.

---

## 7. Two MCP integrations (single `mcp.json`)

| MCP | Type | Used by | Purpose |
|---|---|---|---|
| **context7** | External (`npx @upstash/context7-mcp`) | Agent 2 at build time | Look up TS library docs (decimal handling, fastmcp, Vitest coverage). ≥2 queries logged in `research-notes.md`. |
| **pipeline-status** | Custom (`fastmcp`, `mcp/server.ts`) | Reviewer / Claude after a run | `get_transaction_status(transaction_id)`, `list_pipeline_results()`, resource `pipeline://summary`. |

---

## 8. Testing & coverage gate

- Vitest; **target ≥ 90%**, hard **gate 80%**.
- Unit tests for each agent core + each domain module (validation, fraud-rules, fx, compliance-rules) + 1 integration test for the full pipeline.
- Tests isolated from the real `shared/` (use a temp dir per run).
- Coverage gate hook: `.claude/settings.json` `PreToolUse` + matcher `Bash`; `.claude/hooks/coverage-gate.mjs` runs coverage, parses `coverage-summary.json`, **exits 2 to block** the `git push` if lines coverage < 80%.

---

## 9. Project file layout

```
homework-6/
├── specification.md  agents.md  research-notes.md  README.md  HOWTORUN.md
├── package.json  tsconfig.json  vitest.config.ts  mcp.json  sample-transactions.json
├── config/
│   ├── fx-rates.json          # { "as_of": "YYYY-MM-DD", "rates": { "USD": "1.00", ... } }
│   └── denylist.json          # { "accounts": ["ACC-9999"], "countries": [ ... ] }
├── .claude/
│   ├── commands/{write-spec,run-pipeline,validate-transactions}.md
│   ├── hooks/coverage-gate.mjs
│   └── settings.json
├── src/
│   ├── integrator.ts
│   ├── agents/{transaction-validator,fraud-detector,compliance-checker}.ts   # CLI wrappers
│   ├── domain/{validation,fraud-rules,compliance-rules,fx}.ts                 # pure cores
│   ├── lib/{messages,money,logger,shared-dirs}.ts
│   └── types.ts
├── mcp/server.ts
├── shared/{input,processing,output,results}/
├── tests/{unit,integration,fixtures}/
└── docs/{specs/*, screenshots/*}
```

---

## 10. Assumptions log

| ID | Assumption | Rationale |
|---|---|---|
| ASM-001 | ISO 4217 allow-list is a fixed, closed set of exactly 7 (USD, EUR, GBP, JPY, CHF, CAD, AUD), not a live lookup | No network; deterministic tests; 1:1 with FX keys (ASM-007) |
| ASM-002 | Cross-border inferred from `currency ≠ USD` OR `metadata.country ≠ US`; home country is US | Sample data is US-centric; documented heuristic |
| ASM-003 | Non-positive amounts are always invalid, including `refund` type (TXN007 rejected) | Brief says "valid amounts"; keeps the validator unambiguous |
| ASM-004 | Off-hours window is UTC [00:00–05:59] | Sample timestamps are UTC (`Z`); no timezone resolution in v1 |
| ASM-005 | PII (`source_account`, `destination_account`, names/descriptions) is masked in all logs (`ACC-1001` → `ACC-***1`) | Brief: no plaintext PII in logs |
| ASM-006 | **FX rates are a static snapshot** in `config/fx-rates.json` with an `as_of` date — approximate, not live | Deterministic offline pipeline; no FX feed |
| ASM-007 | **FX-rate keys are exactly the validator's ISO-4217 allow-list** (1:1); enforced by a unit test | A valid currency with no rate would break the Fraud Detector |
| ASM-008 | **Denylist/sanctions is a static in-repo list** (`config/denylist.json`: accounts checked on **both** `source_account` and `destination_account`, plus countries), not a live sanctions API | Realistic compliance screening without external dependency |
| ASM-009 | The runtime pipeline makes **no LLM calls**; all "AI" is build-time meta-agents + MCP | Determinism, reproducibility, $0 runtime cost |

---

## 11. What this phase deliberately does NOT do

- No source code, no tests, no `npm install`, no pipeline run.
- No Vercel deployment (out of rubric; tracked only as a stretch step in `plan.md`).
- No screenshots (implementation-phase artifacts).
- The kickoff prompt references `specification.md` + `agents.md` as authoritative; it does not duplicate their content.

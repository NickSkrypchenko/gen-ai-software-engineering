# agents.md — Multi-Agent Banking Transaction Pipeline (Homework 6)

> Read this file before any implementation task. It is the single source of truth for how an AI coding agent should behave in this project. The authoritative spec is `specification.md`; the design rationale is `docs/specs/brainstorm-summary.md`.

---

## Project purpose & non-goals

This project is the Homework 6 capstone: **four Claude Code meta-agents** that build and operate a **deterministic, file-based banking transaction pipeline**. The pipeline routes each raw transaction through **Transaction Validator → Fraud Detector → Compliance Checker** to a final disposition.

**Two layers of "agents" — never conflate them:**
- **Meta-agents (Agent 1–4):** build-time Claude Code workflows (spec, code-gen, tests, docs). They *are* AI.
- **Pipeline agents (Validator, Fraud Detector, Compliance Checker):** ordinary **deterministic TypeScript** inside the built system — **no LLM calls, no network at runtime.**

**Non-goals:** runtime LLM/agentic orchestration (no `claude -p`, no Anthropic SDK at runtime — unlike HW4); live FX or live sanctions APIs; true cross-transaction structuring detection (needs per-account state); a database (file-based only); any feature not in `specification.md`. The Vercel dashboard is an out-of-rubric stretch, not part of the graded deliverables.

---

## Tech stack (pinned)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22 |
| Language | TypeScript | 5.x (strict) |
| Test runner | Vitest | 3.x |
| Coverage | `@vitest/coverage-v8` | latest |
| Decimal math | `decimal.js` | 10.x |
| Custom MCP server | `fastmcp` | 4.x (1.x crashes on `start()` vs MCP SDK ≥1.29) |
| MCP tool-param schema | `zod` | 3.x (required by fastmcp's Standard-Schema params) |
| External MCP | `@upstash/context7-mcp` (build-time) | latest |
| IDs | `crypto.randomUUID()` (built-in) | — |

---

## Permission tier: Standard

**Allowed:** read files, write/edit source under `homework-6/`, run `git`, `npm`, `npx`, `node`, `vitest`.

**Forbidden — never do these:**
- `rm -rf` or any destructive filesystem command.
- **Modify `sample-transactions.json`** — it is the reference input for review.
- Use `number`/`float` for any monetary value (use `decimal.js` `Decimal`).
- Write raw PII (`source_account`, `destination_account`, names) to any log in plaintext.
- Bypass the coverage gate (`git push --no-verify`, disabling the hook) without explicit approval.
- Add an LLM call or network request to the runtime pipeline.
- Install packages not listed above without confirming.

---

## Coding standards

### Monetary values
- **All money uses one isolated constructor**, `const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN })`, exported from `src/lib/money.ts`; import `Money` everywhere and keep amounts as strings (`"1500.00"`). Never use raw `number` / `float` / `Decimal` for money, and never mutate the global `Decimal` via `Decimal.set(...)` (it leaks across the process and reused Vitest workers → test order would matter). `decimal.js` defaults to `ROUND_HALF_UP`; cloning leaves that untouched. Round only at the final step.

### Messages & files
- `message_id` is UUID v4 via `crypto.randomUUID()`. Envelope: `message_id`, `timestamp` (ISO 8601), `source_agent`, `target_agent`, `message_type`, `data`.
- The Fraud Detector records `amount_usd_equivalent`, `risk_score`, `risk_band`, `matched_signals[]` on `data` for a full rule trail.
- File names: `kebab-case`. Types/classes: `PascalCase`; functions/vars: `camelCase`.

### Architecture (pure cores + thin CLI)
- `src/domain/*` are **pure functions** (no I/O): `validateTransaction`, `scoreTransaction(tx, rates)`, `decide`, `toUsd(amount, currency, rates)`. FX rates are passed in, never read from disk inside a core.
- `src/agents/*` are thin CLI wrappers around the cores (validator supports `--dry-run`).
- The integrator calls cores in-process but writes real JSON files through `shared/{input,processing,output,results}/`.

### Audit trail (distinct from result files)
- `src/lib/logger.ts` appends **one line per agent-hop** (`validate` / `score` / `decide`) to `shared/results/audit.log` with ISO 8601 timestamp, agent name, `transaction_id`, outcome. Account numbers masked (`ACC-1001` → `ACC-***1`).
- This is **separate** from the per-transaction outcome JSON in `shared/results/`. Do not treat "a file in `shared/`" as the audit trail.

---

## Domain rules (apply at all times)

| Rule | Detail |
|---|---|
| Validation is terminal on failure | Missing field / non-positive amount / non-ISO-4217 currency / bad ISO 8601 ts → `REJECTED_VALIDATION` straight to `shared/results/`; never enters compliance. |
| FX before thresholds | Normalize amount to USD-equivalent via the static `config/fx-rates.json` snapshot before high-value/`NEAR_THRESHOLD` checks. |
| FX ↔ allow-list parity | Allow-list is a **closed set of exactly 7**: `USD, EUR, GBP, JPY, CHF, CAD, AUD`. `config/fx-rates.json` carries exactly these 7 keys; a unit test asserts equality. A valid currency with no rate must be impossible. |
| Additive risk | high-value (>$10k USD-eq) +0.40 · `NEAR_THRESHOLD` ($9000–9999.99) +0.20 · off-hours UTC[0–5] +0.20 · cross-border +0.20 · wire +0.10; capped at 1.0. |
| Compliance owns REJECT | Denylist hit — **both** `source_account` and `destination_account` vs `config/denylist.json.accounts`, **or** `metadata.country` vs `.countries` → `REJECT`, independent of score. |
| Decision enum | Exactly 4 values: `APPROVE`, `HOLD`, `REJECT`, `REJECTED_VALIDATION`. `score ≥ 0.30` → `HOLD`, else `APPROVE`. |
| `escalate` is audit-only | High band (`≥ 0.60`) sets boolean `escalate` on a `HOLD` — not a 5th status, not an enum branch. |
| Determinism | Inject a `Clock`; identical input → identical `shared/results/`. |

---

## Testing & verification expectations

A task is **done** when all of the following pass:

1. **Coverage ≥ 90%** (hard gate 80%) via `vitest run --coverage`.
2. Unit tests for each agent core + each domain module (`validation`, `fraud-rules`, `compliance-rules`, `fx`) + 1 integration test for the full pipeline over the 8 sample transactions.
3. **Synthetic fixtures** cover the two branches the reference sample cannot reach: `risk_score ≥ 0.60` (→ `escalate=true`) and a denylisted `metadata.country` (→ country-branch `REJECT`).
4. Tests run against a temp dir, never the real `shared/`.
5. The coverage-gate hook (`.claude/settings.json` `PreToolUse`+`Bash` → `.claude/hooks/coverage-gate.mjs`) blocks `git push` when lines coverage < 80% (exit code 2).
6. `npm run pipeline` processes all 8 transactions to `shared/results/` with no errors.

---

## MCP integrations

- **context7 (build-time only):** Agent 2 looks up `decimal.js`, `fastmcp`, Vitest-coverage APIs; ≥ 2 queries logged in `research-notes.md`.
- **Custom `pipeline-status` (`mcp/server.ts`, `fastmcp`):** tool `get_transaction_status(transaction_id)`, tool `list_pipeline_results()`, resource `pipeline://summary`. Both wired in a single `mcp.json`; launch the custom server as `npx tsx mcp/server.ts` (bare `node` cannot run `.ts`).

---

## Edge-case posture — fail closed

- Ambiguous/invalid input → `REJECTED_VALIDATION`, never silently passed downstream.
- Missing FX rate for an allow-listed currency → treated as a programming error (caught by the parity test), not a runtime guess.
- Denylist hit always wins over a low risk score (e.g., `ACC-9999` at risk 0.20 still → `REJECT`).

---

## Skill-invocation order for implementation tasks

1. `/brainstorming` — explore context, get design approval (done: `docs/specs/brainstorm-summary.md`).
2. `/write-spec` (Agent 1) — produce/refresh `specification.md` and extend this `agents.md`.
3. Implement against `specification.md` (Agent 2), then tests + hook (Agent 3), then docs (Agent 4).
4. `/run-pipeline`, `/validate-transactions` for demos. Self-verify against `specification.md` Acceptance checklist before reporting done.

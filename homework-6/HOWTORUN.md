# HOWTORUN — Multi-Agent Banking Transaction Pipeline

Reproducible from a clean clone. All commands run from inside `homework-6/`.

> **Author:** Nick Skrypchenko · **Requires:** Node.js ≥ 22 (verify with `node -v`).

---

## 1. Setup

```bash
cd homework-6
npm install
```

This installs the runtime deps (`decimal.js`, `fastmcp`, `zod`) and dev deps
(`typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`).

Optional sanity checks:

```bash
node -v            # expect v22.x or newer
npm run build      # tsc --noEmit — typecheck the whole project
```

---

## 2. Run the pipeline

```bash
npm run pipeline
```

This processes all 8 records in `sample-transactions.json`. The integrator clears the shared
directories first, so every run is fresh and deterministic. Expected console output:

```
Pipeline complete — 8 transactions processed.
  APPROVE: 2  HOLD: 3  REJECT: 1  REJECTED_VALIDATION: 2
  Results: .../homework-6/shared/results
```

Outputs in `shared/results/`:

- `TXN00N.result.json` — one final outcome per transaction (decision, reason, risk trail, envelope).
- `audit.log` — append-only, **one masked line per agent-hop** (`validate` / `score` / `decide`).
- `pipeline-summary.json` — the run report (totals + per-decision counts).

Inspect a result and the audit log:

```bash
cat shared/results/TXN003.result.json      # REJECT — DENYLIST_ACCOUNT:ACC-***9
cat shared/results/audit.log                # account numbers are masked (ACC-***N)
```

---

## 3. Tests & coverage

```bash
npm test           # run the full suite
npm run test:cov   # run with coverage (target ≥ 90%, hard gate 80%)
```

Coverage thresholds (80/80/80/80) are enforced by `vitest.config.ts`. A coverage summary is
written to `coverage/coverage-summary.json` (consumed by the push gate below).

---

## 4. Skills (slash commands)

When this directory is open in Claude Code, the following slash commands are available
(`.claude/commands/`):

- **`/run-pipeline`** — checks the input exists, clears `shared/`, runs the pipeline, summarizes
  `shared/results/`, and reports each rejected transaction and why.
- **`/validate-transactions`** — runs the validator in dry-run and prints a total / valid / invalid
  table with rejection reasons. Equivalent CLI:

  ```bash
  npx tsx src/agents/transaction-validator.ts --dry-run
  ```

- **`/write-spec`** — (Agent 1) regenerates a compliant `specification.md` from the design log and
  extends `agents.md`. Pass a scratch path to dry-run without overwriting the approved spec.

---

## 5. Coverage-gate hook (blocks `git push` below 80%)

`.claude/settings.json` registers a `PreToolUse` (matcher `Bash`) hook,
`.claude/hooks/coverage-gate.mjs`. When a `git push` is detected it runs coverage and **exits 2
to block the push** if line coverage is below 80%.

Demonstrate it directly:

```bash
# Allowed — current coverage is ≥ 80% (reads the existing summary):
echo '{"tool_name":"Bash","tool_input":{"command":"git push"}}' \
  | COVERAGE_GATE_SKIP_RUN=1 node .claude/hooks/coverage-gate.mjs; echo "exit=$?"   # → 0

# Blocked — simulate sub-80% coverage:
printf '{"total":{"lines":{"pct":75}}}' > /tmp/low.json
echo '{"tool_name":"Bash","tool_input":{"command":"git push"}}' \
  | COVERAGE_GATE_SKIP_RUN=1 COVERAGE_GATE_SUMMARY=/tmp/low.json node .claude/hooks/coverage-gate.mjs; echo "exit=$?"   # → 2
```

In normal operation (no `COVERAGE_GATE_SKIP_RUN`) the hook runs `npm run test:cov` itself before
deciding.

---

## 6. MCP servers

Both are wired in a single `mcp.json`:

| Server | Command | Purpose |
|---|---|---|
| `context7` | `npx -y @upstash/context7-mcp` | Build-time library docs (used by Agent 2; see `research-notes.md`). |
| `pipeline-status` | `npx tsx mcp/server.ts` | Reads a finished run's `shared/results/`. |

Run a pipeline first (step 2), then start the custom server:

```bash
npm run mcp        # launches mcp/server.ts over stdio
```

The `pipeline-status` server exposes:

- **tool** `get_transaction_status(transaction_id)` — e.g. `TXN003` → its decision + masked reason.
- **tool** `list_pipeline_results()` — all results + a per-decision tally.
- **resource** `pipeline://summary` — the latest `pipeline-summary.json` as text.

To use it from Claude Code / Claude Desktop, point the MCP client at this project's `mcp.json`
(launch is `npx tsx mcp/server.ts` — bare `node` cannot run a `.ts` file).

---

## Troubleshooting

- **`No FX rate for currency ...`** — a currency outside the closed 7-code allow-list reached the
  Fraud Detector. The validator should have rejected it first; check `config/fx-rates.json` still
  has exactly the 7 allow-list keys (the parity unit test guards this).
- **`pipeline://summary` says "No pipeline run found"** — run `npm run pipeline` first.
- **Push unexpectedly blocked** — line coverage is below 80%; run `npm run test:cov` and add tests.

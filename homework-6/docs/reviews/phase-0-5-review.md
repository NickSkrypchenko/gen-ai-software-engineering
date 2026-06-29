# Pre-PR Review Record — Phases 0–5

Reviews run on the `homework-6-submission` diff (`main...HEAD`) before opening the PR:
`/code-review` (high effort) and `/security-review`. This file records every finding, its
resolution, and the rationale for anything waived.

**Result:** all BLOCKING findings resolved. 2 non-blocking findings fixed opportunistically;
2 waived with rationale below.

---

## Security review

### SEC-1 — Path traversal via `transaction_id` (write primitive) — **BLOCKING → FIXED**

- **Severity:** Medium · **Category:** path_traversal · `src/integrator.ts`
- **Issue:** `transaction_id` from the (untrusted) transaction record was interpolated directly
  into filesystem paths (`input/<id>.json`, `results/<id>.result.json`, processing/output) with
  no charset sanitization, and the `input/` write happened before validation. A record with
  `"transaction_id": "../../../../tmp/evil"` could write attacker-influenced JSON outside
  `shared/` (suffix-constrained to `.json`/`.result.json`).
- **Fix (defense in depth, two layers):**
  1. `validateTransaction` now rejects any `transaction_id` not matching `^[A-Za-z0-9_-]+$`
     with `INVALID_TRANSACTION_ID` (terminal `REJECTED_VALIDATION`).
  2. `sanitizeSegment()` (in `src/lib/shared-dirs.ts`) reduces the id to a safe single path
     segment for **every** filename, so no write can traverse regardless of validation order.
- **Tests:** `validation.test.ts` (4 path-unsafe ids rejected), `shared-dirs.test.ts`
  (`sanitizeSegment` never yields `/`, `\`, or `..`).

### SEC-2 — Path traversal via `transaction_id` (MCP read probe) — **FIXED**

- **Severity:** Low · **Category:** path_traversal · `mcp/server.ts`
- **Issue:** `get_transaction_status(transaction_id)` joined the parameter into a path with a
  `.result.json` suffix; `../` could probe `*.result.json` outside the results dir.
- **Fix:** `getTransactionStatus` returns `{ found: false }` for any id not matching
  `^[A-Za-z0-9_-]+$`.
- **Tests:** `mcp.test.ts` — `../../../../etc/passwd` and `TXN003/../../secret` → `found: false`.

*No other security findings:* the only subprocess (`execSync('npm run test:cov')`) has no
interpolated input; deserialization is `JSON.parse` only; no hardcoded secrets; the MCP surface
returns masked reasons (no PII).

---

## Code review (high effort) — non-blocking

### CR-1 — Cross-border fired on an absent `country` — **FIXED**

- `src/domain/fraud-rules.ts`. `country !== 'US'` was `true` for `undefined`; the validator does
  not require `metadata.country`, so a valid USD transaction omitting `country` got a spurious
  `+0.20 CROSS_BORDER`. Now: `currency !== 'USD' || (country !== undefined && country !== 'US')`.
  No Golden outcome changes (all 8 sample rows carry `country`). Test added.

### CR-2 — Fragile path re-derivation in `listPipelineResults` — **FIXED**

- `mcp/server.ts` listed files via `resolveSharedDirs(join(resultsDir,'..')).results` but read
  contents from `resultsDir` — two sources that coincide only when the dir is named `results`.
  Replaced with `listResultFilesIn(resultsDir)` (new helper in `shared-dirs.ts`) so listing and
  reading use the same directory.

### CR-3 — Over-broad `git push` detection in the hook — **WAIVED**

- `.claude/hooks/coverage-gate.mjs`: `/\bgit\s+push\b/` matches the substring anywhere (e.g.
  `echo "git push"`).
- **Rationale:** fails safe — it can only *over*-block (run coverage / refuse a non-push), never
  let a sub-80% push through. The hook is a local developer-workflow gate, not a security or
  correctness boundary. Tightening risks missing real push forms (`git -C x push`, aliases).
  Accepted as-is.

### CR-4 — No-stdin invocation of the hook allows — **WAIVED**

- `.claude/hooks/coverage-gate.mjs`: `readFileSync(0)` on a TTY/no-pipe invocation throws →
  caught → `payload = {}` → `allow()`.
- **Rationale:** not reachable in the real `PreToolUse` path, where Claude Code always pipes the
  tool payload as JSON on stdin. A manual no-stdin run is a developer action, not an attack
  surface, and the failure direction is "allow a manual command", not "bypass the gate on a real
  push". Accepted as-is.

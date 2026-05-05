# Code Review Brief — Customer Support API

Brief for the `/codex:review` skill (Phase 10).

---

## Scope

Review the full `homework-2-submission` branch diff against `main`.
Focus on correctness and security — not style.

---

## Review checklist

### 1. State machine correctness + `resolved_at` side effects

- `src/domain/ticket-state-machine.ts` — verify all 5×5 transitions are correct
- Confirm `resolved_at` is set to `now` on `→ resolved`, cleared to `null` on reopen from `resolved`/`closed`, and **preserved** on `resolved → closed` (a finalize, not a reopen)
- Check that `ticketRepository.transition()` uses `SELECT FOR UPDATE` to prevent concurrent state corruption
- Verify `transition()` in the service layer calls `domainTransition()` before the repository to get the correct `resolvedAt`, not after

### 2. Classifier determinism + ordering

- `src/domain/classifier-rules.ts` — keyword arrays must be in specificity-descending order: `bug_report` → `account_access` → `billing_question` → `technical_issue` → `feature_request`
- `src/domain/classifier.ts` — first-match wins; no merging of categories
- Confidence formula: `totalHits === 0 ? 0.5 : min(1.0, 0.7 + (totalHits-1) * 0.1)`
- `classify.service.ts` — runs classifier on `subject + ' ' + description`, not just subject

### 3. Optimistic concurrency atomicity

- All 4 mutating endpoints use `If-Match` → 428 if absent (check `parseIfMatch` middleware)
- Version conflict path: `WHERE id=:id AND version=:v` → 412 with `current_version` + `your_version` in body
- `transition()` and `autoClassify()` use full DB transactions with `SELECT FOR UPDATE`
- `bulkInsert()` uses per-row SAVEPOINTs — a rollback at row N must not affect rows 1–N-1
- `update()` uses `sql\`\${tickets.version} + 1\`` (atomic DB-side increment, not read-modify-write)

### 4. Importer error contracts + 1-based row indexing

- Parse errors have `rowIndex` matching position in source file (1-based, not 0-based)
- `import.service.ts`: parse → validate → insert stages; failed rows stop at first failure per row but don't abort the whole batch
- `importErrors` from `bulkInsert()` use `ie.rowIndex - 1` as an index into `validRowIndices` — check off-by-one
- Whole-file parse failure throws immediately (400 PARSE_ERROR) before attempting validation or insert
- Row limit (1000) checked before Zod validation loop, not after

### 5. Audit log append-only invariant

- `ticketTransitions` and `classifications` tables have no UPDATE or DELETE paths outside cascade-on-ticket-delete
- `classifyService.autoClassify()` always inserts a new row — never updates an existing classification
- No code path in `transitionRepository` or `classificationRepository` modifies rows

### 6. Frontend type-sharing rules

- `public/js/` files must not import runtime values from `src/db/`, `src/repository/`, `src/services/`, `src/middleware/`, or `src/utils/logger.ts`
- `tsconfig.web.json` has `"verbatimModuleSyntax": true` — type-only imports enforce this at compile time
- `src/models/ticket.types.ts` is the approved bridge file — all shared types re-exported from here
- `src/domain/ticket.ts` enum arrays (`TICKET_STATUSES` etc.) are safe to import at runtime from frontend

### 7. Error response shape consistency

Every error response must include: `error` (message), `code` (enum string), `requestId`.
- `VersionConflictError` must include `current_version` + `your_version`
- `InvalidTransitionError` must include `allowed[]`
- `ValidationError` must include `details[]` with `field` + `message` per issue

### 8. Database schema constraints

- `confidence BETWEEN 0 AND 1` CHECK constraint in `classifications`
- `char_length(subject) BETWEEN 1 AND 200` and `char_length(description) BETWEEN 10 AND 2000` CHECKs in `tickets`
- `email_format` CHECK uses `~*` (case-insensitive) regex
- All FKs have `onDelete: 'cascade'` — verify migrations reflect this

---

## Known deviations to accept (do not flag as issues)

- `start` script uses `node dist/src/index.js` not `node dist/index.js` — correct given `rootDir: "."`
- `redoc-cli` replaced with `@redocly/cli` — upstream deprecated package
- HTTP driver replaced with WebSocket driver — required for transaction support
- Coverage excludes `src/utils/logger.ts` — pino transport, covered by integration test side-effects

# Virtual Card Lifecycle Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

---

## 1. Metadata & System Context

| Parameter | Value |
|---|---|
| **Spec ID** | SPEC-VCARD-001 |
| **Version** | 1.0.0 |
| **Status** | APPROVED |
| **Author** | Nick Skrypchenko |
| **Date** | 2026-05-17 |
| **Agent permission tier** | Standard (git, npm/pnpm allowed; no `rm -rf`, no destructive migrations, no raw PAN/CVV writes) |
| **Regulatory scope** | EU — PCI-DSS v4.0, GDPR (Art. 5/17/20), 4th/5th EU AMLD |
| **Target stack** (assumed) | Node.js ≥ 22, TypeScript 5, Express 4, PostgreSQL 16, Drizzle ORM, Zod, Vitest |
| **Architecture** | Modular monolith: CardModule / LimitsModule / TransactionModule / AuditModule |
| **Design doc** | `homework-3/_design/brainstorm-summary.md` |

**Scope boundary:** This spec covers the Virtual Card lifecycle API only — card issuance, freeze/unfreeze, spending-limit management, and transaction history. Out of scope: physical card issuance, 3DS challenge flows, dispute intake, card replacement, push notifications, FX conversion, and any UI rendering.

---

## 2. High-Level Objective

**HL-OBJ-1:** Build a regulated EU consumer Virtual Card lifecycle API that allows a cardholder to create a reloadable EUR virtual card, freeze and unfreeze it, configure spending limits, and view transaction history — with full PCI-DSS data handling and an immutable audit trail for every state change.

---

## 3. Mid-Level Objectives

| ID | Objective | How a tester verifies it |
|---|---|---|
| **ML-OBJ-1** | A cardholder can request a new virtual card that transitions PENDING → ACTIVE; the response contains a vault token (never a raw PAN) and an ETag for optimistic concurrency. | `POST /v1/cards` returns 201 with `vault_token`, `status: "ACTIVE"`, `ETag` header; DB row has `status = ACTIVE`; no raw PAN in DB or logs. |
| **ML-OBJ-2** | A cardholder or Ops agent can freeze an ACTIVE card and unfreeze a FROZEN card (both require step-up OTP); a FraudReviewer can fraud-freeze any ACTIVE/FROZEN card without step-up; a FROZEN card's authorisation attempts are declined with `CARD_FROZEN`. | POST freeze/unfreeze returns 200 with updated status; subsequent authorisation on FROZEN card returns 422 `CARD_FROZEN`; AuditEvent row exists for each transition. |
| **ML-OBJ-3** | A cardholder can create, update, and delete spending limits (DAILY / MONTHLY / per-MCC) on their card; the limits engine declines authorisations that would breach any active limit. | CRUD on `/v1/cards/:id/limits` returns correct status codes; a simulated authorisation exceeding a DAILY limit returns 422 `LIMIT_EXCEEDED`; LimitCounter row reflects spend. |
| **ML-OBJ-4** | A cardholder can retrieve a paginated, filtered transaction history (by status, date range, amount range) with a max page size of 100 rows and a `next_cursor` for keyset pagination. | `GET /v1/cards/:id/transactions?status=AUTHORIZED&limit=10` returns correct subset; `next_cursor` is present when more rows exist; response time meets NFR-PERF-004. |
| **ML-OBJ-5** | Every state-changing operation emits an immutable AuditEvent with actor_id, actor_role, event_type, payload_hash, and server-side occurred_at; AuditEvents are append-only and retained for 5 years. | After any mutation, `audit_events` table contains a row with non-null actor_id, event_type, payload_hash, occurred_at; no UPDATE/DELETE on audit_events succeeds at the DB layer. |
| **ML-OBJ-6** | All mutating endpoints reject requests without a valid JWT with 401; sensitive mutations (freeze, close, limit change) additionally reject requests without `X-Step-Up-Token` with 428; fraud_freeze requires role `fraud_reviewer`, else 403. | Calling any mutating endpoint without `Authorization` → 401; calling freeze without step-up → 428; calling fraud_freeze with role `cardholder` → 403. |
| **ML-OBJ-7** | All error responses conform to RFC 7807 Problem Details (`type`, `title`, `status`, `detail`, `instance` with request-id); `X-Request-Id` is echoed in every response. | Every 4xx/5xx response body has all five RFC 7807 fields; `X-Request-Id` present in response headers; errors never expose stack traces or SQL. |

---

## 4. Non-Functional & Policy Requirements

### 4.1 Performance & Scalability

| ID | Metric | Target | Label | Justification |
|---|---|---|---|---|
| **NFR-PERF-001** | POST /v1/cards p95 latency | < 800 ms | assumed target | Includes vault tokenisation call + DB write + async audit; consistent with consumer fintech UX expectation |
| **NFR-PERF-002** | POST freeze/unfreeze p95 | < 400 ms | assumed target | DB state update + AuditEvent only; no external calls on critical path |
| **NFR-PERF-003** | In-process limit check p95 | < 100 ms | assumed target | In-process LimitCounter read; on the authorisation hot path |
| **NFR-PERF-004** | GET /v1/cards/:id/transactions p95 | < 500 ms | assumed target | Paginated keyset read, max 100 rows, indexed on (card_id, authorized_at DESC) |
| **NFR-PERF-005** | Sustained throughput (mixed ops) | 200 RPS | assumed target | Mid-scale EU consumer fintech launch; assumes connection-pooled PostgreSQL 16 |
| **NFR-PERF-006** | Page size cap | max 100 rows per page | required | Prevents unbounded memory allocation; excess `limit` values clamped, not rejected |
| **NFR-PERF-007** | Read-after-write consistency | ≤ 200 ms | assumed target | Cardholder must see FROZEN immediately after freeze on same client |

### 4.2 Security & Privacy

| ID | Rule |
|---|---|
| **NFR-SEC-001** | All data at rest encrypted with AES-256-GCM (DEK + KEK envelope encryption). PCI-DSS Req 3.5. |
| **NFR-SEC-002** | All data in transit over TLS 1.2+. TLS 1.0/1.1 disabled. PCI-DSS Req 4.1. |
| **NFR-SEC-003** | PAN never stored in application DB. Only Card Vault token is persisted. Display format: `411111******1111`. Any log line containing a 13–19 digit string that passes Luhn check is rejected by the log pipeline. |
| **NFR-SEC-004** | CVV never persisted anywhere. In-memory only during card issuance vault call (< 100 ms window). Vault holds it; application receives only the vault token. |
| **NFR-SEC-005** | All inputs validated with Zod schemas at the HTTP boundary before any business logic. Unknown fields are stripped (not passed through). |
| **NFR-SEC-006** | `cardholder_id` is a pseudonymous UUID referencing an external PII store. The card service never stores name, email, address, or date of birth. |
| **NFR-SEC-007** | JWT claims consumed: `sub` (actor_id), `role` (`cardholder` / `ops` / `fraud_reviewer` / `system`), `step_up_verified` (boolean, max age 5 min). Validated against IdP JWKS. |
| **NFR-SEC-008** | Ops role may read card status and audit events but may not read vault tokens or instruct vault to reveal PAN. Violations logged as `PERMISSION_BOUNDARY_VIOLATION` AuditEvent. |

### 4.3 Audit, Logging & Compliance

| ID | Rule |
|---|---|
| **NFR-AUD-001** | AuditEvent written asynchronously after every mutation (fire-and-forget, 3-retry). Write p95 < 50 ms measured from operation commit. `audit_events` table is INSERT-only at application layer — no UPDATE or DELETE methods exist in the repository. |
| **NFR-AUD-002** | Retention: AuditEvents and Transactions retained for 5 years (1 826 days). Soft-delete via `archived_at` after 2 years; hard deletion only after 5 years, gated by compliance team. |
| **NFR-AUD-003** | GDPR: export (all card data + audit events for a cardholder_id) and erasure (pseudonymisation of cardholder_id in AuditEvents; transactions retained for AML). Response within 30 days. |
| **NFR-AUD-004** | All logs are structured JSON. Fields: `request_id`, `card_id`, `actor_id`, `event_type`, `status_code`, `latency_ms`. No PII, no PAN, no CVV in any log field. |
| **NFR-AUD-005** | Each AuditEvent includes `payload_hash` (SHA-256 of canonicalised request body) for forensic verification. |

### 4.4 Reliability

| ID | Rule |
|---|---|
| **NFR-REL-001** | All POST endpoints accept `Idempotency-Key` header (UUID, max 128 chars). Duplicate key within 24 h returns original response without re-executing. |
| **NFR-REL-002** | Retry policy for transient DB and vault errors: 3 attempts, exponential backoff 100 ms → 400 ms → 1 600 ms, ±20% jitter. Non-retryable errors surface immediately. |
| **NFR-REL-003** | All mutating DB operations use optimistic concurrency via `version` column and `If-Match` / `ETag` headers. Mismatch returns 412. |
| **NFR-REL-004** | Card state transitions and AuditEvent writes committed in the same ACID transaction. AuditEvent failure rolls back the state transition. |
| **NFR-REL-005** | LimitCounter increments use `SELECT … FOR UPDATE` inside a serialisable transaction to prevent concurrent over-spend. |

---

## 5. Implementation Notes

### Monetary discipline
- All monetary values: `NUMERIC(18, 4)` in PostgreSQL; `Decimal` (scale 4) in application code.
- `float`, `double`, and JS `number` are **forbidden** for any monetary field.
- Rounding: `HALF_EVEN` (banker's rounding). Round after all arithmetic, never at intermediate steps.
- API responses: money as string `"12.5000"` (4 decimal places), never as JSON number.

### ID format
- All entity IDs: UUID v7 (time-ordered, generated server-side via `uuidv7` library).
- `Idempotency-Key` and `X-Request-Id`: UUID v4 accepted from client; UUID v7 generated server-side if absent.

### Error semantics (RFC 7807)
Every error response body:
```json
{
  "type": "https://errors.vcard.example.com/card-frozen",
  "title": "Card is frozen",
  "status": 422,
  "detail": "Card crd_01J... is currently frozen and cannot process authorisations.",
  "instance": "/v1/cards/crd_01J.../authorise",
  "request_id": "req_01J..."
}
```

| HTTP status | When used |
|---|---|
| 400 | Zod validation failure |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT, insufficient role |
| 404 | Card or limit not found |
| 409 | Invalid state transition attempted |
| 412 | `If-Match` version mismatch |
| 422 | Business rule violation (card frozen, limit exceeded, KYC downgrade) |
| 428 | Step-up OTP required but not provided |
| 429 | Rate limit exceeded |
| 503 | Vault service unreachable after retries |

### Naming conventions
- DB tables: `snake_case` plural (`virtual_cards`, `spending_limits`, `limit_counters`, `transactions`, `audit_events`, `idempotency_keys`)
- TypeScript: `PascalCase` types/classes, `camelCase` functions/variables, `kebab-case` file names
- Route prefix: `/v1/`

### Forbidden operations
- No raw PAN or CVV written to any DB column, log line, or response body.
- No `UPDATE` or `DELETE` on `audit_events`.
- No `float`/`number` for monetary values.
- No `SELECT *` in repositories — always name columns.
- No synchronous audit writes on mutation critical path.

---

## 6. Context

### 6.1 Beginning Context (hypothetical)

| Artifact | Path / Endpoint | Notes |
|---|---|---|
| Project root config | `package.json`, `tsconfig.json` (strict: true) | Node.js 22, TypeScript 5 |
| Environment template | `.env.example` | `DATABASE_URL`, `VAULT_API_URL`, `VAULT_API_KEY`, `IDP_JWKS_URL`, `PORT` |
| Agent conventions | `homework-3/agents.md`, `homework-3/.claude/rules/fintech-defaults.md` | Read before any implementation step |
| DB schema (empty) | `src/db/schema.ts` | Drizzle ORM schema file, empty |
| Migration directory | `src/db/migrations/` | Empty; migrations to be generated |
| Express app scaffold | `src/app.ts` | Empty Express app, middleware chain TBD |
| External: Card Vault API | `$VAULT_API_URL` | REST service; `POST /tokens` (issue), `GET /tokens/:id/reveal` (ops only) |
| External: IdP JWKS | `$IDP_JWKS_URL` | Public key endpoint for JWT signature verification |

### 6.2 Ending Context (hypothetical)

| Artifact | Hypothetical path |
|---|---|
| DB schema (all tables) | `src/db/schema.ts` |
| Initial migration | `src/db/migrations/0001_virtual_card_schema.sql` |
| Card state machine | `src/domain/card-state-machine.ts` |
| Limits engine | `src/domain/limits-engine.ts` |
| Zod validators | `src/validators/card.schemas.ts`, `limits.schemas.ts`, `transaction.schemas.ts` |
| Repositories | `src/repository/card.repository.ts`, `limits.repository.ts`, `transaction.repository.ts`, `audit.repository.ts` |
| Services | `src/services/card.service.ts`, `limits.service.ts`, `transaction.service.ts` |
| Controllers | `src/controllers/cards.controller.ts`, `limits.controller.ts`, `transactions.controller.ts` |
| Routes | `src/routes/cards.routes.ts`, `limits.routes.ts`, `transactions.routes.ts` |
| Middleware | `src/middleware/auth.ts`, `step-up.ts`, `idempotency.ts`, `request-id.ts`, `error-handler.ts` |
| OpenAPI spec | `docs/openapi.yaml` (generated from Zod schemas) |
| Unit tests | `tests/unit/card-state-machine.test.ts`, `limits-engine.test.ts` |
| Integration tests | `tests/integration/cards.test.ts`, `limits.test.ts`, `transactions.test.ts`, `auth.test.ts`, `error-handling.test.ts` |
| Concurrency tests | `tests/integration/concurrency.test.ts` |
| Contract tests | `tests/contract/openapi.contract.test.ts` |
| Audit trail tests | `tests/integration/audit-events.test.ts` |
| Perf results | `docs/perf-results/` |

---

## 7. Domain Model & State Machine

### Card status state machine

```
PENDING ──[activate (system)]────────────> ACTIVE
ACTIVE  ──[freeze (cardholder/ops, OTP)]──> FROZEN
FROZEN  ──[unfreeze (cardholder/ops, OTP)]─> ACTIVE
ACTIVE  ──[close (cardholder/ops, OTP)]───> CLOSED  ← terminal
FROZEN  ──[close (cardholder/ops, OTP)]───> CLOSED  ← terminal
PENDING ──[expire (system, no OTP)]───────> CLOSED  ← terminal
ACTIVE  ──[fraud_freeze (fraud_reviewer)]──> FROZEN
FROZEN  ──[fraud_freeze (fraud_reviewer)]──> FROZEN  (idempotent no-op)
```

**Terminal states:** `CLOSED` — no transitions out.

### Allowed transitions table

| From | Event | To | Permitted actors | Step-up required |
|---|---|---|---|---|
| PENDING | activate | ACTIVE | system | No |
| ACTIVE | freeze | FROZEN | cardholder, ops | Yes (OTP) |
| FROZEN | unfreeze | ACTIVE | cardholder, ops | Yes (OTP) |
| ACTIVE | close | CLOSED | cardholder, ops | Yes (OTP) |
| FROZEN | close | CLOSED | cardholder, ops | Yes (OTP) |
| PENDING | expire | CLOSED | system | No |
| ACTIVE | fraud_freeze | FROZEN | fraud_reviewer | No |
| FROZEN | fraud_freeze | FROZEN | fraud_reviewer | No (idempotent) |

Any transition not in this table throws `InvalidTransitionError` → HTTP 409.

### SpendingLimit types

| Type | Window | Counter reset |
|---|---|---|
| DAILY | Calendar day UTC | 00:00 UTC daily |
| MONTHLY | Calendar month UTC | 00:00 UTC on 1st of month |
| MCC | Per merchant category code | Never (cumulative cap per MCC code) |

Each limit has `amount_eur` (max spend, Decimal) and optionally `tx_count_cap` (max transactions). Both constraints enforced independently; breaching either triggers `LIMIT_EXCEEDED`.

---

## 8. Edge Cases & Failure Modes

| ID | Trigger | User-visible behaviour | System behaviour | Audit/compliance implication | Linked ML-OBJ |
|---|---|---|---|---|---|
| **EDGE-01** | Authorisation attempted while card is FROZEN | 422 `CARD_FROZEN` with RFC 7807 body | LimitsModule skipped; CardModule returns FROZEN; no LimitCounter increment | AuditEvent `AUTHORISATION_DECLINED` with reason `CARD_FROZEN` | ML-OBJ-2 |
| **EDGE-02** | Authorisation amount would exceed DAILY spending limit | 422 `LIMIT_EXCEEDED` with `limit_type: "DAILY"` and `remaining_eur` in detail | LimitsModule checks counter under `SELECT FOR UPDATE`; declines without committing increment | AuditEvent `AUTHORISATION_DECLINED` with `limit_id`, `window_key`, `remaining_eur` | ML-OBJ-3 |
| **EDGE-03** | Authorisation amount would exceed MONTHLY spending limit | 422 `LIMIT_EXCEEDED` with `limit_type: "MONTHLY"` | Same as EDGE-02 for monthly window | AuditEvent with monthly window data | ML-OBJ-3 |
| **EDGE-04** | Authorisation merchant MCC matches a per-MCC cap that is fully spent | 422 `LIMIT_EXCEEDED` with `limit_type: "MCC"` and the matched MCC code | MCC limit checked after DAILY/MONTHLY; earliest-failing limit wins | AuditEvent `AUTHORISATION_DECLINED` with `mcc` field | ML-OBJ-3 |
| **EDGE-05** | PENDING card not activated within expiry window (system-scheduled job) | Card silently transitions to CLOSED; cardholder sees CLOSED on next GET | System triggers `expire` event; state machine transitions PENDING → CLOSED; vault token invalidated | AuditEvent `CARD_EXPIRED` with `actor_role: system` | ML-OBJ-1, ML-OBJ-5 |
| **EDGE-06** | Concurrent freeze request and authorisation request arrive simultaneously for the same card | Exactly one wins; the other receives 422 `CARD_FROZEN` (if freeze wins) or 412 (if authorisation committed first) | Both use `SELECT … FOR UPDATE` inside a serialisable transaction; PostgreSQL prevents split outcome | AuditEvent only for winner; declined attempt logged with `CONCURRENT_CONFLICT` | ML-OBJ-2, ML-OBJ-3 |
| **EDGE-07** | Client replays `POST /v1/cards/:id/freeze` with the same `Idempotency-Key` | HTTP 200 with original response body; no second state transition | IdempotencyKey store lookup returns cached response; state machine not invoked | No second AuditEvent; replay logged at DEBUG level | ML-OBJ-6 |
| **EDGE-08** | Payment network sends reversal for a previously SETTLED transaction | Transaction status updated to REVERSED; LimitCounter decremented | `POST .../reverse` idempotent; LimitCounter updated under `FOR UPDATE` | AuditEvent `TRANSACTION_REVERSED` with original txn_id; compliance alert if reversal > 30 days post-settlement | ML-OBJ-4, ML-OBJ-5 |
| **EDGE-09** | Fraud system triggers `fraud_freeze` on card already FROZEN | HTTP 200 (idempotent no-op); card remains FROZEN | State machine returns current state without write | AuditEvent `FRAUD_FREEZE_NOOP` emitted to preserve forensic trail | ML-OBJ-2, ML-OBJ-5 |
| **EDGE-10** | Ops user attempts to reveal PAN via vault token | 403 Forbidden; vault reveal endpoint never called | RBAC check fails before any vault call; ops role not in `vault_reveal_allowed_roles` | AuditEvent `PERMISSION_BOUNDARY_VIOLATION` with `actor_id`, `actor_role: ops`, `attempted_action: vault_reveal` | ML-OBJ-6, ML-OBJ-5 |
| **EDGE-11** | Client reads card status immediately after a freeze call from another session (stale read) | GET returns FROZEN within 200 ms of the freeze commit | Primary DB read for owning cardholder; no read-replica routing for card status | No compliance implication; logged at INFO for latency tracking | ML-OBJ-2 |
| **EDGE-12** | KYC provider downgrades cardholder KYC level below the threshold to hold an active card | Card transitions ACTIVE → FROZEN automatically; out-of-band notification out of scope for this service | System event `kyc_downgrade` triggers `fraud_freeze` equivalent; card cannot be unfrozen until KYC re-approved | AuditEvent `KYC_DOWNGRADE_FREEZE` with `actor_role: system`, `kyc_level` before/after; compliance event forwarded to AML queue | ML-OBJ-2, ML-OBJ-5 |

---

## 9. Verification

| ML-OBJ | Verification method | Test category | Passing artifact |
|---|---|---|---|
| **ML-OBJ-1** | Issue card via `POST /v1/cards`; assert 201, `status: ACTIVE`, `vault_token` present, no PAN in DB or logs | Integration (supertest + Neon test branch) | `tests/integration/cards.test.ts` — "POST /v1/cards creates ACTIVE card" passes |
| **ML-OBJ-2** | Freeze ACTIVE card → assert 200 + FROZEN; attempt authorisation → assert 422 `CARD_FROZEN`; unfreeze → assert 200 + ACTIVE | Integration + Concurrency | `tests/integration/cards.test.ts`, `tests/integration/concurrency.test.ts` |
| **ML-OBJ-3** | Create DAILY limit; send authorisations summing to limit; assert next auth returns 422 `LIMIT_EXCEEDED`; verify LimitCounter row | Integration | `tests/integration/limits.test.ts` — DAILY, MONTHLY, MCC sub-tests |
| **ML-OBJ-4** | Seed 150 transactions; GET with `limit=100`; assert 100 rows, `next_cursor` present; follow cursor; assert no duplicates | Integration | `tests/integration/transactions.test.ts` |
| **ML-OBJ-5** | After each mutation, query `audit_events`; assert row with non-null `actor_id`, `event_type`, `payload_hash`, `occurred_at`; attempt `DELETE FROM audit_events` → assert DB error | Integration + DB constraint | `tests/integration/audit-events.test.ts` |
| **ML-OBJ-6** | Call freeze without JWT → 401; without step-up → 428; fraud_freeze with role=cardholder → 403; fraud_freeze with role=fraud_reviewer → 200 | Integration | `tests/integration/auth.test.ts` |
| **ML-OBJ-7** | Trigger each error code; assert RFC 7807 body has all 5 fields; assert `X-Request-Id` in response headers | Integration | `tests/integration/error-handling.test.ts` |

**Additional checkpoints:**

- **Contract test checkpoint (TASK-14):** `tests/contract/openapi.contract.test.ts` — validates every integration-test response against `docs/openapi.yaml`. CI fails on drift.
- **OpenAPI lint checkpoint (TASK-13):** `npm run openapi:lint` — `redocly lint` with `recommended` ruleset. CI step runs before tests.
- **Audit immutability checkpoint (TASK-16):** Direct `DELETE FROM audit_events` fails with PostgreSQL error (trigger or RLS policy) — verified in `audit-events.test.ts`.

---

## 10. Performance Budgets & SLOs

| ID | Endpoint / operation | p50 | p95 | p99 | Measurement | Alert threshold |
|---|---|---|---|---|---|---|
| **NFR-PERF-001** | POST /v1/cards | < 400 ms | < 800 ms | < 1 500 ms | `autocannon -c 20 -d 30` vs staging | Alert if p95 > 800 ms for 5 min |
| **NFR-PERF-002** | POST /v1/cards/:id/freeze or /unfreeze | < 150 ms | < 400 ms | < 800 ms | `autocannon -c 20 -d 30` | Alert if p95 > 400 ms for 5 min |
| **NFR-PERF-003** | In-process limit check (LimitsModule.check) | < 20 ms | < 100 ms | < 200 ms | Vitest timer assertions + production histogram | Alert if p95 > 100 ms |
| **NFR-PERF-004** | GET /v1/cards/:id/transactions | < 150 ms | < 500 ms | < 900 ms | `autocannon -c 10 -d 30` | Alert if p95 > 500 ms for 5 min |
| **NFR-PERF-005** | Sustained throughput (mixed ops) | — | — | — | `autocannon -c 50 -d 60` | Alert if throughput < 200 RPS for 5 min |
| **NFR-PERF-007** | Read-after-write consistency (freeze → GET) | — | ≤ 200 ms | — | Integration test: freeze then GET; assert FROZEN | Test fails if > 200 ms |

All "assumed target" numbers justified by: consumer fintech UX research shows abandonment above 1 s RTT; 800 ms budget for card create accounts for vault API (~300 ms) + DB write + async audit, leaving 200 ms headroom.

---

## 11. Low-Level Tasks

---

### TASK-01 — Define database schema (all tables)

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-2, ML-OBJ-3, ML-OBJ-4, ML-OBJ-5  
**Linked NFR:** NFR-SEC-001, NFR-AUD-002, NFR-REL-003

**Prompt for agent:**
Define the complete Drizzle ORM schema in `src/db/schema.ts`. Use `pgTable`, `uuid`, `numeric`, `varchar`, `timestamp`, `integer`, `pgEnum`. All monetary fields: `numeric('amount_eur', { precision: 18, scale: 4 })`. All IDs: `uuid('id').primaryKey()`. Add `version integer not null default 1` to `virtual_cards`, `spending_limits`, `transactions` for optimistic concurrency.

**File to CREATE:** `src/db/schema.ts`

**Tables to CREATE:**
- `virtual_cards` (id, cardholder_id, vault_token, status enum, expires_at, created_at, updated_at, version)
- `spending_limits` (id, card_id FK, type enum DAILY/MONTHLY/MCC, amount_eur, tx_count_cap, mcc, created_at, version)
- `limit_counters` (id, limit_id FK, window_key varchar, spent_eur, tx_count, updated_at)
- `transactions` (id, card_id FK, merchant_id, mcc, amount_eur, status enum, authorized_at, settled_at, reversed_at)
- `audit_events` (id, card_id, actor_id, actor_role, event_type, payload_hash, occurred_at) — NO updated_at, NO version, NO cascading deletes
- `idempotency_keys` (key varchar PK, response_status, response_body jsonb, created_at, expires_at)

**Acceptance criteria:**
- [ ] `npx drizzle-kit generate` produces SQL migration with all six tables
- [ ] `audit_events` has no `updated_at`, no `version`, no FK enabling cascading event deletion
- [ ] All monetary columns are `NUMERIC(18,4)` — verified by inspecting generated SQL
- [ ] `virtual_cards.status` is a PostgreSQL ENUM with values `PENDING`, `ACTIVE`, `FROZEN`, `CLOSED`
- [ ] `spending_limits.type` is a PostgreSQL ENUM with values `DAILY`, `MONTHLY`, `MCC`

---

### TASK-02 — Card state machine (pure domain function)

**Linked ML-OBJ:** ML-OBJ-2  
**Linked NFR:** NFR-REL-004

**Prompt for agent:**
Implement a pure TypeScript function `transition(card, event, actor): CardTransitionResult` in `src/domain/card-state-machine.ts`. Use the allowed-transitions table from §7 as sole source of truth. Throw `InvalidTransitionError` for any combination not in the table. Return `{ newStatus, auditEventType }`. Zero I/O — no DB calls, no external calls.

**File to CREATE:** `src/domain/card-state-machine.ts`

**Functions to CREATE:**
- `transition(card: Card, event: CardEvent, actor: Actor): CardTransitionResult`
- `getAllowedTransitions(status: CardStatus): CardEvent[]`

**Acceptance criteria:**
- [ ] Unit test: `ACTIVE + freeze by cardholder → FROZEN` passes
- [ ] Unit test: `FROZEN + freeze by cardholder → throws InvalidTransitionError` passes
- [ ] Unit test: `CLOSED + any event → throws InvalidTransitionError` passes (terminal state)
- [ ] Unit test: `ACTIVE + fraud_freeze by fraud_reviewer → FROZEN` passes
- [ ] Unit test: `FROZEN + fraud_freeze by fraud_reviewer → FROZEN` (idempotent no-op) passes
- [ ] Zero imports from `src/repository`, `src/services`, or any I/O module

---

### TASK-03 — LimitsEngine (pure domain function)

**Linked ML-OBJ:** ML-OBJ-3  
**Linked NFR:** NFR-PERF-003, NFR-REL-005

**Prompt for agent:**
Implement `checkLimits(card, limits, counters, txAmount: Decimal, txMcc: string): LimitCheckResult` in `src/domain/limits-engine.ts`. Check DAILY first, then MONTHLY, then MCC. Return `{ allowed: true }` or `{ allowed: false, failedLimit, reason: 'AMOUNT' | 'TX_COUNT' }`. Use `Decimal` from `decimal.js` — never `number`. No I/O.

**File to CREATE:** `src/domain/limits-engine.ts`

**Functions to CREATE:**
- `checkLimits(...): LimitCheckResult`
- `getCurrentWindowKey(limitType: LimitType, now: Date): string` — returns `"2026-05-17"` for DAILY, `"2026-05"` for MONTHLY, MCC code for MCC

**Acceptance criteria:**
- [ ] Unit test: amount equal to daily limit → `{ allowed: true }` (inclusive boundary)
- [ ] Unit test: amount one cent over daily limit → `{ allowed: false, reason: 'AMOUNT' }`
- [ ] Unit test: tx_count at cap → `{ allowed: false, reason: 'TX_COUNT' }`
- [ ] Unit test: DAILY passes, MCC breached → `{ allowed: false, failedLimit: <MCC limit> }`
- [ ] No `number` or `float` arithmetic anywhere — verified by ESLint `no-restricted-globals` rule

---

### TASK-04 — Card repository (optimistic concurrency)

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-2  
**Linked NFR:** NFR-REL-003, NFR-REL-004

**Prompt for agent:**
Implement `card.repository.ts`. All mutations use optimistic concurrency: `SELECT … FOR UPDATE` in a serialisable transaction, compare `version`, update with `version = version + 1`, raise `VersionConflictError` on mismatch.

**File to CREATE:** `src/repository/card.repository.ts`

**Methods to CREATE:**
- `findById(id: string): Promise<Card | null>`
- `findByIdForUpdate(id: string, tx: DbTransaction): Promise<Card>` — locks row, throws `NotFoundError` if absent
- `create(data: NewCard, tx: DbTransaction): Promise<Card>`
- `updateStatus(id: string, expectedVersion: number, newStatus: CardStatus, tx: DbTransaction): Promise<Card>`

**Acceptance criteria:**
- [ ] `updateStatus` with wrong `expectedVersion` throws `VersionConflictError`
- [ ] No `SELECT *` — column names explicit in all queries
- [ ] No UPDATE or DELETE methods exist for `audit_events` — verified by `grep -r "audit_events" src/repository | grep -v "INSERT"`
- [ ] Integration test: concurrent `updateStatus` calls for same card → exactly one succeeds, other gets `VersionConflictError`

---

### TASK-05 — LimitsRepository and LimitCounterRepository

**Linked ML-OBJ:** ML-OBJ-3  
**Linked NFR:** NFR-REL-005

**Prompt for agent:**
Implement `limits.repository.ts`. `LimitCounterRepository.increment` must use `SELECT … FOR UPDATE` inside a serialisable transaction to prevent concurrent over-spend. `LimitCounterRepository` has no DELETE method.

**File to CREATE:** `src/repository/limits.repository.ts`

**Methods to CREATE:**
- `SpendingLimitRepository`: `create`, `findByCardId`, `update`, `delete`
- `LimitCounterRepository`: `findOrCreate(limitId, windowKey, tx)`, `increment(id, amountDelta, txCountDelta, tx)`, `decrement(id, amountDelta, tx)` (for reversals)

**Acceptance criteria:**
- [ ] `increment` acquires `FOR UPDATE` lock before reading counter value
- [ ] Decrement cannot produce negative `spent_eur` — enforced by `CHECK (spent_eur >= 0)` in schema (TASK-01)
- [ ] Unit test: two concurrent `increment` calls for same counter → final value equals sum of both, no lost update
- [ ] `LimitCounterRepository` has no `delete` method

---

### TASK-06 — TransactionRepository and AuditRepository

**Linked ML-OBJ:** ML-OBJ-4, ML-OBJ-5  
**Linked NFR:** NFR-AUD-001, NFR-AUD-002, NFR-AUD-003, NFR-AUD-005, NFR-PERF-006

**Prompt for agent:**
Implement `transaction.repository.ts` (append-only INSERT + keyset-paginated SELECT) and `audit.repository.ts` (INSERT only — no UPDATE, no DELETE method exists).

**File to CREATE:** `src/repository/transaction.repository.ts`, `src/repository/audit.repository.ts`

**TransactionRepository methods:**
- `create(data: NewTransaction, tx: DbTransaction): Promise<Transaction>`
- `listByCardId(cardId, filters: TxFilter, cursor?: string, limit?: number): Promise<{ rows: Transaction[], nextCursor: string | null }>`
- `updateStatus(id: string, newStatus: TxStatus, tx: DbTransaction): Promise<Transaction>` (for reversals only)

**AuditRepository methods:**
- `insert(event: NewAuditEvent): Promise<void>` — async, non-blocking (no await on the caller's critical path)

**Acceptance criteria:**
- [ ] `listByCardId` uses keyset pagination on `(authorized_at DESC, id DESC)` — no OFFSET
- [ ] `limit` parameter clamped to max 100 (NFR-PERF-006)
- [ ] `AuditRepository` has no `update` or `delete` methods — TypeScript type system enforces this
- [ ] Integration test: insert 150 transactions, paginate with limit=100, verify second page has 50 rows and no duplicates across pages

---

### TASK-07 — Card service (orchestration)

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-2, ML-OBJ-5  
**Linked NFR:** NFR-REL-001, NFR-REL-002, NFR-REL-004, NFR-SEC-003, NFR-SEC-004

**Prompt for agent:**
Implement `card.service.ts` orchestrating CardRepository + card-state-machine + AuditRepository. All mutations wrapped in a single DB transaction (NFR-REL-004). AuditEvent written inside the same transaction. Vault API called outside the transaction (vault failure → 503 before transaction begins).

**File to CREATE:** `src/services/card.service.ts`

**Methods to CREATE:**
- `issueCard(cardholderId: string, idempotencyKey: string): Promise<Card>`
- `transitionCard(cardId: string, event: CardEvent, actor: Actor, expectedVersion: number): Promise<Card>`
- `closeCard(cardId: string, actor: Actor, expectedVersion: number): Promise<Card>`

**Acceptance criteria:**
- [ ] `issueCard` calls vault API first; on vault failure throws `VaultUnavailableError` (→ 503) without touching DB
- [ ] `transitionCard` with wrong version throws `VersionConflictError` (→ 412)
- [ ] `transitionCard` with invalid event throws `InvalidTransitionError` (→ 409)
- [ ] AuditEvent row exists after every successful `transitionCard` — verified in integration test

---

### TASK-08 — LimitsService

**Linked ML-OBJ:** ML-OBJ-3  
**Linked NFR:** NFR-PERF-003, NFR-REL-005

**Prompt for agent:**
Implement `limits.service.ts`. `checkAndIncrement` must run the pure domain check first (fast, no lock), then acquire the DB lock and re-check atomically to prevent TOCTOU race.

**File to CREATE:** `src/services/limits.service.ts`

**Methods to CREATE:**
- `createLimit(cardId, data, actor): Promise<SpendingLimit>`
- `updateLimit(limitId, cardId, data, actor, expectedVersion): Promise<SpendingLimit>`
- `deleteLimit(limitId, cardId, actor): Promise<void>`
- `checkAndIncrement(cardId, txAmount: Decimal, txMcc: string, tx: DbTransaction): Promise<void>` — throws `LimitExceededError` if declined

**Acceptance criteria:**
- [ ] `checkAndIncrement` with amount breaching DAILY limit throws `LimitExceededError` with `limit_type: "DAILY"`
- [ ] Concurrent `checkAndIncrement` calls for the same card do not result in combined spend exceeding the limit
- [ ] `deleteLimit` emits AuditEvent `LIMIT_DELETED`

---

### TASK-09 — HTTP controllers and routes (all 10 endpoints)

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-2, ML-OBJ-3, ML-OBJ-4, ML-OBJ-6, ML-OBJ-7  
**Linked NFR:** NFR-PERF-001, NFR-PERF-002, NFR-SEC-005

**Prompt for agent:**
Implement thin HTTP controllers (no business logic) and Express route registration. Each controller extracts typed, Zod-validated input from `req`, calls exactly one service method, sets `ETag` and `Location` headers where appropriate.

**Files to CREATE:** `src/controllers/cards.controller.ts`, `src/controllers/limits.controller.ts`, `src/controllers/transactions.controller.ts`, `src/routes/cards.routes.ts`, `src/routes/limits.routes.ts`, `src/routes/transactions.routes.ts`

**Endpoints:**

| Method | Path | Auth | Step-up |
|---|---|---|---|
| POST | /v1/cards | JWT (cardholder) | No |
| GET | /v1/cards/:id | JWT (cardholder / ops) | No |
| POST | /v1/cards/:id/freeze | JWT (cardholder / ops) | Yes |
| POST | /v1/cards/:id/unfreeze | JWT (cardholder / ops) | Yes |
| POST | /v1/cards/:id/close | JWT (cardholder / ops) | Yes |
| POST | /v1/cards/:id/fraud-freeze | JWT (fraud_reviewer) | No |
| POST | /v1/cards/:id/limits | JWT (cardholder) | Yes |
| PUT | /v1/cards/:id/limits/:limitId | JWT (cardholder) | Yes |
| DELETE | /v1/cards/:id/limits/:limitId | JWT (cardholder) | Yes |
| GET | /v1/cards/:id/transactions | JWT (cardholder / ops) | No |

**Acceptance criteria:**
- [ ] Controllers contain no SQL, no domain logic, no branching on business state
- [ ] `POST /v1/cards` returns `Location: /v1/cards/:id` and `ETag: "1"` headers
- [ ] `GET /v1/cards/:id` by a different `cardholder_id` returns 403 (ownership check)
- [ ] All endpoints return `X-Request-Id` header

---

### TASK-10 — Auth middleware (JWT validation + RBAC)

**Linked ML-OBJ:** ML-OBJ-6  
**Linked NFR:** NFR-SEC-007, NFR-SEC-008

**Prompt for agent:**
Implement `src/middleware/auth.ts` that validates JWT signature using JWKS from `IDP_JWKS_URL`, extracts `sub`, `role`, `step_up_verified` claims, attaches to `req.actor`. Implement `src/middleware/step-up.ts` that checks `req.actor.step_up_verified === true` and `step_up_verified_at` within 5 minutes. Implement `requireRole(...roles)` helper returning 403 if role not allowed.

**Files to CREATE:** `src/middleware/auth.ts`, `src/middleware/step-up.ts`

**Acceptance criteria:**
- [ ] Missing `Authorization` header → 401 with RFC 7807 body
- [ ] Expired JWT → 401
- [ ] Valid JWT, wrong role → 403
- [ ] Valid JWT, `step_up_verified: false` on step-up route → 428
- [ ] Valid JWT, `step_up_verified: true` but `step_up_verified_at` > 5 min ago → 428

---

### TASK-11 — Idempotency middleware

**Linked ML-OBJ:** ML-OBJ-6  
**Linked NFR:** NFR-REL-001

**Prompt for agent:**
Implement `src/middleware/idempotency.ts`. On POST with `Idempotency-Key`: check `idempotency_keys` table; if key exists and not expired (< 24 h), return cached response immediately. If new, let request proceed, store response after handler responds.

**File to CREATE:** `src/middleware/idempotency.ts`

**Acceptance criteria:**
- [ ] Duplicate `Idempotency-Key` returns identical status code and body as original
- [ ] Duplicate request does NOT create a second AuditEvent — verified by counting `audit_events` rows before and after replay
- [ ] `Idempotency-Key` longer than 128 chars → 400 Bad Request
- [ ] Missing key on POST → request proceeds without idempotency guarantee (key is optional)

---

### TASK-12 — RFC 7807 error handler and request-id middleware

**Linked ML-OBJ:** ML-OBJ-7  
**Linked NFR:** NFR-AUD-004

**Prompt for agent:**
Implement `src/middleware/request-id.ts` (generate UUID v7 if `X-Request-Id` absent; always echo in response). Implement `src/middleware/error-handler.ts` as final Express error handler: map typed errors to RFC 7807; unknown errors degrade to 500 without leaking internals. Log only `{ request_id, error_code, status_code, latency_ms }`.

**Files to CREATE:** `src/middleware/request-id.ts`, `src/middleware/error-handler.ts`

**Error → HTTP status mapping:**

| Error class | Status |
|---|---|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `InvalidTransitionError` | 409 |
| `VersionConflictError` | 412 |
| `LimitExceededError` | 422 |
| `CardFrozenError` | 422 |
| `StepUpRequiredError` | 428 |
| `VaultUnavailableError` | 503 |
| Any unknown `Error` | 500 (no internals exposed) |

**Acceptance criteria:**
- [ ] Every error response has `type`, `title`, `status`, `detail`, `instance`, `request_id`
- [ ] `X-Request-Id` header present in every response (success and error)
- [ ] Uncaught error returns 500 with no stack trace in body
- [ ] Log output for errors contains only the structured fields listed above

---

### TASK-13 — OpenAPI schema generation and lint gate

**Linked ML-OBJ:** ML-OBJ-1 through ML-OBJ-7  
**Linked NFR:** NFR-SEC-005

**Prompt for agent:**
Using `@asteasolutions/zod-to-openapi`, register all Zod schemas with OpenAPI metadata. Write `scripts/generate-openapi.ts` outputting `docs/openapi.yaml`. Add `npm run openapi` and `npm run openapi:lint` (redocly lint) scripts.

**Files to CREATE:** `src/validators/card.schemas.ts`, `src/validators/limits.schemas.ts`, `src/validators/transaction.schemas.ts`, `scripts/generate-openapi.ts`, `docs/openapi.yaml`, `redocly.yaml`

**Acceptance criteria:**
- [ ] `npm run openapi` completes without error
- [ ] `npm run openapi:lint` exits 0 with zero errors
- [ ] `docs/openapi.yaml` documents all 10 endpoints from TASK-09
- [ ] `ProblemDetailsSchema` referenced as error response for all 4xx/5xx status codes

---

### TASK-14 — Contract tests (OpenAPI response validator)

**Linked ML-OBJ:** ML-OBJ-1 through ML-OBJ-7

**Prompt for agent:**
Implement `tests/contract/openapi.contract.test.ts` using `openapi-response-validator`. For each of the 10 endpoints, make a real HTTP call (supertest) and validate response body and headers against `docs/openapi.yaml`. Test must fail if implementation drifts from spec.

**File to CREATE:** `tests/contract/openapi.contract.test.ts`

**Acceptance criteria:**
- [ ] Contract tests cover all 10 endpoints (at minimum happy-path response)
- [ ] Changing a response field name in the controller without updating `docs/openapi.yaml` causes contract test to fail
- [ ] `npm run test:contract` exits 0 for all passing tests

---

### TASK-15 — Concurrency integration tests

**Linked ML-OBJ:** ML-OBJ-2, ML-OBJ-3  
**Linked NFR:** NFR-REL-003, NFR-REL-005, NFR-PERF-007

**Prompt for agent:**
Implement `tests/integration/concurrency.test.ts` with three scenarios: (1) 20 concurrent freeze calls, same card, same `If-Match` — exactly 1 succeeds (200), 19 receive 412; (2) 20 concurrent authorisations all slightly below DAILY limit — exactly as many succeed as limit allows, remainder receive 422 `LIMIT_EXCEEDED`; (3) simultaneous freeze + authorisation — one wins, other gets 412 or 422 `CARD_FROZEN`.

**File to CREATE:** `tests/integration/concurrency.test.ts`

**Acceptance criteria:**
- [ ] Scenario 1: exactly 1 status 200, exactly 19 status 412
- [ ] Scenario 2: total spent in LimitCounter equals exactly (successes × tx amount), never exceeds limit
- [ ] Scenario 3: `audit_events` has exactly one successful transition record
- [ ] All three scenarios pass consistently over 5 consecutive runs (no flakiness)

---

### TASK-16 — Audit events integration tests

**Linked ML-OBJ:** ML-OBJ-5  
**Linked NFR:** NFR-AUD-001, NFR-AUD-002, NFR-AUD-003, NFR-AUD-005

**Prompt for agent:**
Implement `tests/integration/audit-events.test.ts`. For each of 7 mutation types (card create, freeze, unfreeze, close, limit create, limit delete, fraud-freeze), assert AuditEvent row exists with correct `event_type`, non-null `actor_id`, non-null `payload_hash`, and `occurred_at` within 1 second of the operation. Assert `DELETE FROM audit_events` fails with a PostgreSQL error (trigger or RLS).

**File to CREATE:** `tests/integration/audit-events.test.ts`

**Acceptance criteria:**
- [ ] AuditEvent exists after each of the 7 mutation types
- [ ] `payload_hash` matches SHA-256 of the canonicalised request body
- [ ] Attempt to delete an AuditEvent row via raw SQL fails with a DB-level error
- [ ] `occurred_at` is server-side timestamp, not client-supplied

---

### TASK-17 — Performance baseline scripts

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-4  
**Linked NFR:** NFR-PERF-001, NFR-PERF-004, NFR-PERF-005

**Prompt for agent:**
Add `npm run perf:cards` and `npm run perf:transactions` using `autocannon`. Write `scripts/perf-summary.ts` that reads autocannon JSON output and exits 1 if p95 exceeds NFR-PERF-001 or NFR-PERF-004 targets. Store raw JSON in `docs/perf-results/`.

**Files to CREATE / UPDATE:** `scripts/perf-summary.ts`, `package.json` (scripts section), `docs/perf-results/.gitkeep`

**Acceptance criteria:**
- [ ] `npm run perf:cards` runs autocannon against `POST /v1/cards` with 20 connections for 30 s
- [ ] `npm run perf:summary` exits 1 if p95 > 800 ms (NFR-PERF-001)
- [ ] Raw JSON saved to `docs/perf-results/cards-<timestamp>.json`

---

### TASK-18 — Database migration, audit protection, and seed script

**Linked ML-OBJ:** ML-OBJ-1, ML-OBJ-3, ML-OBJ-4, ML-OBJ-5  
**Linked NFR:** NFR-AUD-002, NFR-SEC-001, NFR-SEC-002, NFR-SEC-006

**Prompt for agent:**
Run `npx drizzle-kit generate` to produce `src/db/migrations/0001_virtual_card_schema.sql`. Add a PostgreSQL trigger on `audit_events` that raises an exception on any DELETE or UPDATE (application-layer protection alone is insufficient for PCI-DSS). Write `scripts/seed.ts` that inserts 3 sample cards with 5 limits each and 50 transactions per card into test DB.

**Files to CREATE:** `src/db/migrations/0001_virtual_card_schema.sql`, `scripts/seed.ts`

**Acceptance criteria:**
- [ ] `npm run db:migrate` applies migration without error
- [ ] `npm run db:seed` populates test data without error
- [ ] `DELETE FROM audit_events WHERE id = <any>` via raw psql returns a PostgreSQL trigger error
- [ ] Migration is idempotent: applying twice does not error (use `IF NOT EXISTS`)

---

## 12. Traceability Matrix

| HL-OBJ | ML-OBJ | NFR IDs | Edge cases | Low-Level Tasks | Verification entries |
|---|---|---|---|---|---|
| HL-OBJ-1 | ML-OBJ-1 | NFR-PERF-001, NFR-SEC-003, NFR-SEC-004, NFR-REL-001 | EDGE-05 | TASK-01, TASK-04, TASK-07, TASK-09, TASK-13, TASK-18 | §9 ML-OBJ-1; `cards.test.ts` |
| HL-OBJ-1 | ML-OBJ-2 | NFR-PERF-002, NFR-REL-003, NFR-REL-004 | EDGE-01, EDGE-06, EDGE-07, EDGE-09, EDGE-11, EDGE-12 | TASK-02, TASK-04, TASK-07, TASK-09, TASK-10, TASK-11, TASK-15 | §9 ML-OBJ-2; `concurrency.test.ts` |
| HL-OBJ-1 | ML-OBJ-3 | NFR-PERF-003, NFR-REL-005 | EDGE-02, EDGE-03, EDGE-04 | TASK-01, TASK-03, TASK-05, TASK-08, TASK-09, TASK-15 | §9 ML-OBJ-3; `limits.test.ts` |
| HL-OBJ-1 | ML-OBJ-4 | NFR-PERF-004, NFR-PERF-006 | EDGE-08 | TASK-01, TASK-06, TASK-09, TASK-14, TASK-17 | §9 ML-OBJ-4; `transactions.test.ts` |
| HL-OBJ-1 | ML-OBJ-5 | NFR-AUD-001, NFR-AUD-002, NFR-AUD-003, NFR-AUD-004, NFR-AUD-005 | EDGE-05, EDGE-08, EDGE-09, EDGE-10, EDGE-12 | TASK-01, TASK-06, TASK-07, TASK-08, TASK-16, TASK-18 | §9 ML-OBJ-5; `audit-events.test.ts` |
| HL-OBJ-1 | ML-OBJ-6 | NFR-SEC-007, NFR-SEC-008, NFR-REL-001 | EDGE-07, EDGE-10 | TASK-09, TASK-10, TASK-11 | §9 ML-OBJ-6; `auth.test.ts` |
| HL-OBJ-1 | ML-OBJ-7 | NFR-AUD-004 | EDGE-01 through EDGE-12 (all surface via error handler) | TASK-12, TASK-13, TASK-14 | §9 ML-OBJ-7; `error-handling.test.ts`; contract test |

> Every ML-OBJ appears in ≥1 TASK and ≥1 Verification row. ✓  
> Every NFR-* is referenced by ≥1 TASK. ✓  
> Every EDGE-* links to ≥1 ML-OBJ. ✓  
> Edge-case table has 12 rows. ✓  
> Low-Level Tasks: 18 (≥15). ✓

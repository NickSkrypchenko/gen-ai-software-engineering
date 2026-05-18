# Virtual Card Lifecycle — Brainstorm Summary

**Date:** 2026-05-17  
**Status:** APPROVED  
**Feature:** Virtual Card lifecycle (create, freeze/unfreeze, spending limits, transaction history)  
**Deliverable:** Specification package only — no implementation code.

---

## Scope decisions (Q&A approved)

| Parameter | Decision | Rationale |
|---|---|---|
| Card type | Reloadable consumer (физлицо) | Full lifecycle scope; richest domain for spec |
| Currency | Single-currency EUR only | Simplifies limits, settlement, reconciliation for v1 |
| Sub-flows v1 | Create (PENDING→ACTIVE), Freeze/Unfreeze, Spending limits, View transactions | All four core lifecycle flows included |
| Out of scope v1 | Card replacement, dispute intake, 3DS, notifications, physical card | Deferred; noted in spec as Out of scope |
| Authentication | JWT Bearer + step-up OTP/PIN for mutating ops | PSD2 SCA-aligned; freeze, close, limit changes require step-up |
| Regulator | EU — PCI-DSS + GDPR + AML (4th/5th AMLD) | Stated in kick-off prompt |
| Audit retention | 5 years | PCI-DSS Req 10.7 (1yr online + 1yr offline), AML EU 5yr minimum |
| Perf posture | Near-realtime (<1s p95 mutations, async audit write) | Consumer fintech UX — user expects instant feedback on freeze/create |

---

## Architectural approach: Modular Monolith with Bounded Contexts

Chosen over Monolithic Card Service (A) and Microservices (B).

**Rationale:** Provides clear module interfaces for spec decomposition, ACID transaction integrity within a single DB (critical for freeze + spend race), realistic migration path to microservices, and testable module boundaries without distributed saga complexity.

### Bounded context map

```
┌──────────────────────────────────────────────────────────┐
│                 Virtual Card Service                      │
│                                                          │
│  ┌─────────────┐   domain events   ┌──────────────────┐  │
│  │  CardModule │ ────────────────> │   AuditModule    │  │
│  │             │                   │ (append-only log) │  │
│  │ - state     │   domain events   └──────────────────┘  │
│  │   machine   │ ──────────────┐                         │
│  │ - vault ref │               v                         │
│  └──────┬──────┘  ┌────────────────────┐                 │
│         │         │  LimitsModule      │                 │
│         │ checks  │ - daily cap        │                 │
│         └────────>│ - monthly cap      │                 │
│                   │ - per-MCC cap      │                 │
│                   │ - tx count limit   │                 │
│                   └────────┬───────────┘                 │
│                            │ domain events               │
│                            v                             │
│                   ┌────────────────────┐                 │
│                   │ TransactionModule  │                 │
│                   │ - append-only      │                 │
│                   │ - read model       │                 │
│                   │ - pagination/filter│                 │
│                   └────────────────────┘                 │
└──────────────────────────────────────────────────────────┘
         │ external calls (tokenisation)
         v
  ┌─────────────────┐
  │  Card Vault     │  ← PAN/CVV stored here ONLY
  │  (tokenisation) │    (external service or HSM)
  └─────────────────┘
```

---

## Key entities

| Entity | Key fields | Owner module |
|---|---|---|
| `Card` | id (UUID v7), cardholder_id, vault_token, status, expires_at, created_at, version | CardModule |
| `SpendingLimit` | id, card_id, type (DAILY/MONTHLY/MCC), amount_eur (Decimal 18,4), tx_count_cap, period_start | LimitsModule |
| `LimitCounter` | id, limit_id, window_key (YYYY-MM-DD / YYYY-MM), spent_eur, tx_count | LimitsModule |
| `Transaction` | id (UUID v7), card_id, merchant_id, mcc, amount_eur (Decimal), status (AUTHORIZED/SETTLED/REVERSED), authorized_at | TransactionModule |
| `AuditEvent` | id (UUID v7), card_id, actor_id, actor_role, event_type, payload_hash, occurred_at | AuditModule |

---

## Card state machine

```
PENDING ──[activate]────> ACTIVE
ACTIVE  ──[freeze]──────> FROZEN   (step-up OTP required)
FROZEN  ──[unfreeze]────> ACTIVE   (step-up OTP required)
ACTIVE  ──[close]───────> CLOSED   (terminal; step-up OTP)
FROZEN  ──[close]───────> CLOSED   (terminal; step-up OTP)
PENDING ──[expire]──────> CLOSED   (system event; no step-up)
*       ──[fraud_freeze]─> FROZEN   (FraudReviewer; no step-up)

CLOSED — terminal state, no outbound transitions
```

| From | Event | To | Actor | Step-up |
|---|---|---|---|---|
| PENDING | activate | ACTIVE | System | — |
| ACTIVE | freeze | FROZEN | Cardholder / Ops | OTP |
| FROZEN | unfreeze | ACTIVE | Cardholder / Ops | OTP |
| ACTIVE | close | CLOSED | Cardholder / Ops | OTP |
| FROZEN | close | CLOSED | Cardholder / Ops | OTP |
| PENDING | expire | CLOSED | System | — |
| ACTIVE / FROZEN | fraud_freeze | FROZEN | FraudReviewer | — |

---

## Data-handling rules (PCI-DSS + GDPR)

| Field | PCI/GDPR class | Storage rule |
|---|---|---|
| PAN | PCI Primary Account | Vault token only in DB; raw PAN never leaves Card Vault. Logs: always masked `411111******1111` |
| CVV | PCI Sensitive Auth Data | In-memory only during issuance (<100ms); never persisted anywhere |
| cardholder_id | GDPR PII | Pseudonymised (UUID references external PII store). Audit log records actor_id only |
| amount_eur | Financial | `NUMERIC(18,4)` in DB; `Decimal` type in application code; float prohibited |
| AuditEvent | Compliance | Append-only, retention 5 years, occurred_at is server-side immutable timestamp |

---

## Non-functional requirements (assumed targets)

| ID | Metric | Target | Label | Justification |
|---|---|---|---|---|
| NFR-PERF-001 | Card create p95 | <800ms | assumed | Includes vault call + DB write + async audit event |
| NFR-PERF-002 | Freeze/Unfreeze p95 | <400ms | assumed | DB state update + audit only; no external calls |
| NFR-PERF-003 | Limit check p95 | <100ms | assumed | In-process counter read; on critical auth path |
| NFR-PERF-004 | GET /transactions p95 | <500ms | assumed | Paginated read, max 100 rows per page |
| NFR-PERF-005 | Throughput | 200 RPS (card ops) | assumed | Consumer fintech EU mid-scale launch |
| NFR-SEC-001 | Encryption at rest | AES-256-GCM | standard | PCI-DSS Req 3.5 |
| NFR-SEC-002 | TLS | 1.2+ in transit | standard | PCI-DSS Req 4.1 |
| NFR-AUD-001 | Audit write p95 | <50ms (async) | assumed | Non-blocking fire-and-forget with retry; does not block mutation response |
| NFR-REL-001 | Idempotency | All POSTs idempotent on `Idempotency-Key` header | standard | Protection against duplicate mutations on retry |
| NFR-REL-002 | Retry policy | 3 attempts, exponential backoff 100ms→400ms→1600ms, jitter ±20% | standard | Standard retry budget for near-realtime profile |
| NFR-REL-003 | Read-after-write consistency | ≤200ms for own writes | assumed | User expects to see frozen card immediately after freeze call |
| NFR-PRIV-001 | GDPR data-subject rights | Export, erasure (pseudonymisation), portability — within 30 days | legal | GDPR Art. 17, 20 |

---

## Open questions / assumptions log

| ID | Assumption | Rationale |
|---|---|---|
| ASM-001 | Card Vault is an external tokenisation service (API call) | Not implementing HSM — just spec-level reference |
| ASM-002 | JWT issued by external IdP; spec only defines claims consumed (sub, role, step_up_verified) | Auth provider out of scope for this feature |
| ASM-003 | OTP delivery channel (SMS/email) is out of scope — spec assumes step_up_verified claim in JWT | Step-up flow owned by IdP |
| ASM-004 | LimitCounter windows reset server-side at 00:00 UTC (daily) and 00:00 UTC 1st of month | Simple, auditable reset rule |
| ASM-005 | MCC (Merchant Category Code) provided by payment network on authorization; spec treats it as opaque string | Network integration out of scope |
| ASM-006 | 200 RPS assumed target reflects mid-scale EU consumer fintech launch; no load test data available | Label: assumed target |

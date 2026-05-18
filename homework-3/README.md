# Homework 3 — Specification-Driven Design: Virtual Card Lifecycle

**Student:** Nick Skrypchenko  
**Course:** GenAI and Agentic AI for Software Engineering  
**Date:** 2026-05-17

---

## 1. Student & Task Summary

This folder contains a **specification package** for a regulated EU consumer Virtual Card lifecycle feature. The package includes a layered specification (`specification.md`), an AI agent configuration file (`agents.md`), two editor/AI rule files (`.claude/rules/`), and this README. No implementation code is present — the deliverable is the specification itself.

The chosen domain is a reloadable EUR virtual card for individual consumers, covering four sub-flows: card issuance (PENDING → ACTIVE), freeze/unfreeze (with step-up OTP), spending-limit management (DAILY / MONTHLY / per-MCC), and paginated transaction history. The system operates under EU regulatory constraints: PCI-DSS v4.0, GDPR (Art. 5/17/20), and 4th/5th EU AMLD.

---

## 2. Rationale

### Why this layering

The specification follows a six-layer hierarchy (HL-OBJ → ML-OBJ → NFR → Implementation Notes → Context → Low-Level Tasks) because each layer answers a different question for a different reader:

- **HL-OBJ** gives the product team a one-sentence north star — testable at the business level.
- **ML-OBJ** gives QA and compliance a set of independently verifiable outcomes.
- **NFR** gives infrastructure and security engineers measurable constraints they can configure and alert on.
- **Implementation Notes** gives the implementing AI agent guardrails it can check itself against without re-deriving them from the domain.
- **Context (begin/end)** eliminates the most common source of AI implementation drift: ambiguity about what exists before and after the work.
- **Low-Level Tasks** give the agent concrete, file-scoped instructions so it can work without guessing.

The traceability matrix in §12 closes the loop: every ML-OBJ must appear in at least one TASK and one Verification row, making it impossible to have a stated goal with no implementation path and no way to prove it was met.

### How performance targets were chosen

All latency and throughput numbers are labelled `assumed target` in the spec. The values were derived from two sources:

1. **FinTech UX research:** consumer abandonment rates spike above ~1 second for payment-related interactions. The 800 ms p95 budget for card issuance (TASK-01, NFR-PERF-001) accounts for a ~300 ms vault tokenisation call plus DB write and async audit, leaving ~200 ms headroom.
2. **Infrastructure baseline:** 200 RPS (NFR-PERF-005) reflects a mid-scale EU consumer fintech launch with a connection-pooled PostgreSQL 16 backend. This is conservative enough to be achievable without sharding and realistic enough to be a meaningful target.

The assumed-target label is deliberate: it signals to the implementing team that these numbers must be validated with real load tests (TASK-17) and adjusted if the actual infrastructure differs.

### Why verification depth is high

The spec includes contract tests, OpenAPI lint, concurrency tests, and a DB-level audit immutability check because:

- PCI-DSS requires demonstrable control evidence, not just code comments.
- Optimistic concurrency bugs (freeze + spend races) are silent in unit tests but catastrophic in production.
- OpenAPI drift is the #1 cause of integration failures in API-first teams; an automated lint gate prevents it cheaply.
- Audit log immutability is a regulatory requirement — a DB-level trigger (TASK-18) is the only proof that cannot be bypassed by a future code change.

---

## 3. Industry Best Practices Applied

| Practice | Where it appears | Why it matters for FinTech |
|---|---|---|
| **PCI-DSS PAN masking** | `specification.md §4.2 NFR-SEC-003`, `agents.md § Sensitive data masking`, `.claude/rules/fintech-defaults.md § PAN and CVV handling` | Raw PAN exposure is a PCI DSS Category 1 finding; tokenisation + masking is the standard mitigation |
| **CVV never persisted** | `specification.md §4.2 NFR-SEC-004`, `agents.md § Monetary values` | CVV storage is explicitly prohibited by PCI-DSS Req 3.2.1; in-memory-only handling eliminates the risk entirely |
| **GDPR data-subject rights** | `specification.md §4.3 NFR-AUD-003` | Art. 17 (erasure) and Art. 20 (portability) require a documented implementation path; spec calls out pseudonymisation as the erasure mechanism while retaining transaction data for AML |
| **Immutable audit log (append-only)** | `specification.md §4.3 NFR-AUD-001`, `TASK-16`, `TASK-18`, `agents.md § Domain rules` | Immutable audit trails are required by PCI-DSS Req 10 and EU AMLD; DB-level trigger (TASK-18) enforces this beyond the application layer |
| **5-year retention** | `specification.md §4.3 NFR-AUD-002` | EU AMLD 4th/5th directive requires transaction records for at least 5 years; PCI-DSS Req 10.7 requires audit logs for 1 year online + 1 year archived |
| **Idempotency keys on all POSTs** | `specification.md §4.4 NFR-REL-001`, `TASK-11`, `agents.md § Domain rules`, `.claude/rules/fintech-defaults.md § Idempotency keys` | Network retries are unavoidable in payment flows; without idempotency, a retry can double-charge or double-issue a card |
| **Optimistic concurrency (ETag / If-Match)** | `specification.md §4.4 NFR-REL-003`, `TASK-04`, `TASK-07` | Pessimistic locking over HTTP connections causes connection-pool exhaustion under modest concurrency; optimistic locking pushes conflict resolution to the client at low cost |
| **Least-privilege agent permission tier** | `agents.md § Permission tier: Standard` | Standard mode prevents destructive filesystem and DB operations; aligns with the principle of least privilege for automated agents in a regulated environment |
| **Contract tests + OpenAPI lint** | `specification.md §9 Additional checkpoints`, `TASK-13`, `TASK-14` | Contract tests are the only automated check that catches API drift between spec and implementation; OpenAPI lint catches structural errors before they reach consumers |
| **Progressive disclosure for agent context** | `.claude/rules/fintech-defaults.md`, `.claude/rules/spec-conventions.md`, `agents.md` design (all ≤ 150 lines) | Keeping root config files lean maximises the agent's effective token budget for the actual task; domain-specific rules are loaded on directory entry, not pre-loaded globally |
| **RFC 7807 Problem Details errors** | `specification.md §5 Implementation Notes`, `TASK-12` | Standardised error shapes allow API consumers and support tooling to parse and route errors without brittle string matching |
| **Monetary Decimal discipline** | `specification.md §5 Implementation Notes`, `.claude/rules/fintech-defaults.md § Monetary arithmetic`, `agents.md § Monetary values` | Float rounding errors compound in financial calculations; Decimal with fixed scale 4 and HALF_EVEN rounding is the industry standard for EUR amounts |
| **Pseudonymisation of PII** | `specification.md §4.2 NFR-SEC-006`, `TASK-01 (cardholder_id field)` | GDPR Art. 5 requires data minimisation; storing only a pseudonymous UUID in the card service means a breach of this service does not expose cardholder identity |

---

## 4. How to Run an AI Agent Against This Spec

The brainstorming phase for this feature is already complete — see `homework-3/_design/brainstorm-summary.md`.

To run a fresh implementation session:

1. Open Claude Code at the repository root (`gen-ai-software-engineering/`).
2. The agent automatically loads `homework-3/agents.md` and `.claude/rules/fintech-defaults.md` when working in `homework-3/`. Verify by checking that the agent acknowledges the Standard permission tier.
3. Run `/spec-writer` in audit mode to review `homework-3/specification.md` before coding begins. The spec is at version `1.0.0 APPROVED` — no changes should be needed.
4. Hand the agent `TASK-01` through `TASK-18` in order. Each task is self-contained: it names the file, the functions, and the acceptance criteria. The agent can verify its own work against the criteria before reporting done.
5. After each TASK, run `npm run typecheck && npm run lint && npm test` to gate progress.
6. After all tasks, run `npm run openapi:lint` and `npm run test:contract` to verify API contract integrity.

---

## 5. Open Questions / Assumptions Log

| ID | Assumption | Rationale |
|---|---|---|
| ASM-001 | Card Vault is an external tokenisation service (REST API call) | Spec does not implement an HSM; the vault is treated as an opaque external dependency |
| ASM-002 | JWT is issued by an external IdP; spec only defines which claims are consumed (`sub`, `role`, `step_up_verified`) | Auth provider and OTP delivery are out of scope for this feature |
| ASM-003 | OTP delivery channel (SMS/email) is managed by the IdP; spec assumes `step_up_verified` claim is set in the JWT after successful OTP verification | Step-up flow UX is owned by the identity layer, not the card service |
| ASM-004 | LimitCounter windows reset server-side at 00:00 UTC (daily) and 00:00 UTC on the 1st of each month | Simple, auditable, timezone-safe reset rule; production may need cardholder-timezone support (out of scope for v1) |
| ASM-005 | MCC (Merchant Category Code) is provided by the payment network on authorisation; the card service treats it as an opaque string | Network integration is out of scope; the MCC value is trusted from the upstream call |
| ASM-006 | 200 RPS throughput target (NFR-PERF-005) reflects a mid-scale EU launch; no actual load test data available | Labelled `assumed target`; must be validated with TASK-17 perf scripts against the real deployment |
| ASM-007 | KYC downgrade events (EDGE-12) are delivered as system webhook calls to a dedicated internal endpoint; the delivery mechanism is out of scope | The spec only covers what the card service does when it receives the event, not how the event is delivered |

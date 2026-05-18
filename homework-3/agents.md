# agents.md — Virtual Card Lifecycle Service

> Read this file before starting any implementation task. It is the single source of truth for how an AI coding agent should behave in this project.

---

## Project purpose & non-goals

This project implements a **Virtual Card lifecycle REST API** for a regulated EU consumer fintech product. The feature covers card issuance, freeze/unfreeze, spending-limit management, and transaction history. The deliverable of the current phase is a **specification package only** (no implementation code). When implementation begins, the spec in `homework-3/specification.md` is the ground truth.

**Non-goals:** physical card issuance, 3DS challenge flows, dispute intake, push notifications, FX conversion, UI rendering, or any feature not listed in `specification.md §2`.

---

## Tech stack (assumed; versions pinned)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22 |
| Language | TypeScript | 5.x (strict: true, strictNullChecks: true) |
| Framework | Express | 4.x |
| Database | PostgreSQL | 16 |
| ORM | Drizzle ORM | latest stable |
| Validation | Zod | 3.x |
| Decimal math | decimal.js | 10.x |
| Test runner | Vitest | 3.x |
| HTTP test client | supertest | 7.x |
| OpenAPI generation | @asteasolutions/zod-to-openapi | 7.x |
| ID generation | uuidv7 | 1.x |

---

## Permission tier: Standard

The agent operates at **Standard** permission level.

**Allowed:** read files, write/edit source files, run `git`, `npm`, `npx`, `pnpm`, `vitest`, `drizzle-kit`.

**Forbidden — never do these:**
- `rm -rf` or any destructive filesystem command
- Dropping or truncating production database tables
- Writing raw PAN (Primary Account Number) or CVV to any file, log, or database column
- Running `git push --force` or amending published commits
- Installing packages not listed in `package.json` without confirming with the user
- Calling vault reveal endpoint (`GET /tokens/:id/reveal`) from application code except in an explicitly authorised ops-only route
- Bypassing linting (`--no-verify`, `--skip-validation`) without user approval

---

## Coding standards

### Monetary values
- Always `NUMERIC(18, 4)` in PostgreSQL; always `Decimal` (decimal.js) in TypeScript application code.
- `float`, `double`, and JS `number` are **banned** for any monetary field — ESLint rule enforces this.
- Round using `HALF_EVEN` (banker's rounding). Round at the final step, never intermediate.
- Return monetary values in API responses as JSON strings with 4 decimal places: `"12.5000"`.

### IDs
- All entity IDs: UUID v7 (server-generated via `uuidv7`).
- `Idempotency-Key` and `X-Request-Id`: UUID v4 accepted from clients; UUID v7 generated server-side if absent.

### Sensitive data masking
- PAN display format: `411111******1111` (first 6, asterisks, last 4). Never display more digits.
- No PII, PAN, CVV, or secret in any log line, error message, or API response.
- `cardholder_id` is a pseudonymous UUID — never store name, email, address, or DOB in this service.

### Error responses
- All errors: RFC 7807 Problem Details with fields `type`, `title`, `status`, `detail`, `instance`, `request_id`.
- `X-Request-Id` header in every response (success and error).
- Unknown/unexpected errors degrade to 500 — never expose stack traces or SQL to the client.

### File and code style
- File names: `kebab-case`
- TypeScript: `PascalCase` for types/classes/interfaces, `camelCase` for functions and variables
- Route prefix: `/v1/`
- No `SELECT *` in repositories — always name columns explicitly

---

## Testing & verification expectations

A task is **done** when all of the following pass:

1. **Unit tests** — pure domain functions (`src/domain/`) covered at ≥95% statements. No I/O mocks needed (domain has no I/O).
2. **Integration tests** — supertest against a live Neon test branch; `singleFork: true` in `vitest.config.ts` (prevents TRUNCATE/INSERT races).
3. **Contract test** — `tests/contract/openapi.contract.test.ts` validates every response against `docs/openapi.yaml`. Must pass.
4. **OpenAPI lint** — `npm run openapi:lint` exits 0 with zero redocly errors.
5. **Audit-log assertion** — every mutation test asserts that an `audit_events` row exists after the operation.
6. **TypeScript** — `npm run typecheck` exits 0 (zero type errors).
7. **Lint** — `npm run lint` exits 0.

Coverage gate: ≥85% statements/functions/lines, ≥75% branches (configured in `vitest.config.ts`).

---

## Domain rules

These rules apply at all times — the agent must not require a reminder:

| Rule | Detail |
|---|---|
| Never log PAN/CVV | Any log line containing a 13–19 digit Luhn-passing number must be rejected by the log pipeline |
| Mask PANs on display | Always use `411111******1111` format — first 6, stars, last 4 |
| Idempotency keys on all POSTs | All POST endpoints must check `Idempotency-Key` header and return cached response on replay |
| Prefer append-only for audit | `audit_events` table has no UPDATE or DELETE methods in the repository layer. Period. |
| Default deny on permission ambiguity | If a role is not explicitly listed in the allowed roles for an endpoint, return 403. Never assume permission. |
| ACID for state + audit | Card state transitions and AuditEvent writes must commit in the same DB transaction (NFR-REL-004) |
| Optimistic concurrency | All mutating endpoints require `If-Match` header carrying ETag version. Mismatch → 412. |
| No float for money | Violations must be caught by ESLint `no-restricted-globals` or a custom rule. |

---

## Edge-case posture

When in doubt, **fail closed and emit a compliance event.**

- If a permission check is ambiguous → return 403 and log `PERMISSION_BOUNDARY_VIOLATION` AuditEvent.
- If the vault API is unreachable → return 503, do not partially commit the card record.
- If the step-up token is expired or missing on a sensitive operation → return 428, do not proceed.
- If two concurrent writes conflict → return 412 to the loser; let the application retry with a fresh ETag.
- If a limit check result is ambiguous (e.g., missing counter row) → treat as limit NOT exceeded but create the counter row before proceeding.

---

## Skill-invocation order for future implementation tasks

When beginning a new feature or sub-feature, follow this order:

1. `/brainstorming` — explore context, ask clarifying questions, propose approaches, get design approval.
2. `/spec-writer` — produce or update `specification.md` with the approved design.
3. Implementation skill (e.g., default coding workflow) — implement against the approved spec.
4. Self-verify against §9 (Verification) and §5 (Phase 5 checklist) before reporting done.

Do not skip brainstorming for any task larger than a single-file bug fix.

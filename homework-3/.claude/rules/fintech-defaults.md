# fintech-defaults.md

> Loaded automatically when working in the Virtual Card service directory.
> Apply every rule below without being asked. These are non-negotiable defaults.

---

## Monetary arithmetic

- Use `Decimal` (decimal.js ≥ 10) for ALL monetary values. Never `number`, `float`, or `BigInt` for money.
- DB columns: `NUMERIC(18, 4)` — precision 18, scale 4.
- Rounding: `HALF_EVEN` (Decimal.ROUND_HALF_EVEN). Round at the final step only.
- API responses: return amounts as JSON strings `"12.5000"`, never as JSON numbers.
- ESLint rule `no-restricted-syntax` must block `parseFloat(money)` and `+moneyString` patterns.

## Encryption & transport

- Data at rest: AES-256-GCM with envelope encryption (DEK encrypted by KEK). No plaintext secrets in DB.
- Data in transit: TLS 1.2+ only. TLS 1.0 and 1.1 are disabled at the load balancer.
- Secrets (API keys, DB passwords): environment variables only — never in source files or logs.

## PAN and CVV handling

- PAN is NEVER stored in the application database. Store only the Card Vault token.
- Masked display: first 6 digits + `******` + last 4 digits → `411111******1111`.
- CVV lives in memory only during the vault issuance call (< 100 ms). Never write CVV to disk or logs.
- Any log line that contains a 13–19 digit string passing Luhn check must be scrubbed by the log pipeline.

## Structured logging (JSON only)

- All logs: structured JSON. No free-text log lines.
- Required fields: `request_id`, `card_id` (if applicable), `actor_id`, `event_type`, `status_code`, `latency_ms`.
- Forbidden in any log field: PAN, CVV, full card number, cardholder name, email, date of birth, IBAN.
- Log level for security events: `warn` or `error`. Never suppress them.

## Idempotency keys (all POSTs)

- Every POST endpoint must accept `Idempotency-Key` header (UUID, max 128 chars).
- On duplicate key (within 24 h): return the original response without re-executing. No second AuditEvent.
- Missing key: request proceeds without idempotency guarantee (key is optional, not required).

## RFC 7807 error responses

Every error response must include:
```json
{
  "type": "https://errors.vcard.example.com/<error-slug>",
  "title": "Human-readable title",
  "status": 422,
  "detail": "Specific detail for this occurrence.",
  "instance": "/v1/cards/:id/freeze",
  "request_id": "req_01J..."
}
```
No stack traces. No SQL error messages. No internal service names in error bodies.

## Request ID propagation

- Generate UUID v7 `X-Request-Id` on ingress if client does not supply one.
- Echo `X-Request-Id` in every response header (success and error).
- Include `request_id` in every log line and every error response body.

## Idempotent state writes — append-only audit

- `audit_events` table: INSERT only. No UPDATE, no DELETE — not even in migrations.
- All other append-only tables (`transactions`): only add `updateStatus` for reversals; no general UPDATE.
- Any attempt to add an `update` or `delete` method to `AuditRepository` must be rejected in code review.

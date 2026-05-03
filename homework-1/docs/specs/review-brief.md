# Code Review Brief — `/codex:review`

Review the `homework-1-submission` branch diff vs `main` for a homework submission graded on functionality, AI-usage documentation, code quality, documentation, and demo.

## Focus areas (in priority order)

1. **Settlement correctness** — the `pending → completed | failed` logic in `TransactionsService.create` (and indirectly `TransactionRepository.markCompleted` / `markFailed`). Does the try/catch fallback path always call `markFailed`? Can a transaction ever remain `pending` after the handler exits? Is the `getBalance` call correctly scoped by currency (no cross-currency substitution)?

2. **Money math** — any float-drift risk in `AccountsService` aggregations? Is `MAX_AMOUNT` enforced at both the Zod layer and the `Money.parse` util? Check the `Money.add` rounding in `accounts.service.ts` totals.

3. **Zod schema completeness** — does `CreateTransactionSchema` catch all invalid combinations (deposit with non-EXTERNAL from, withdrawal with non-EXTERNAL to, transfer with same from/to, EXTERNAL on both sides of a transfer)? Does `ListFiltersSchema` reject `from > to`? Does `.strict()` prevent injected fields like `id`, `status`, `timestamp`?

4. **Error-handler uniformity** — does every route surface the `x-request-id` header and the `requestId` body field? Does the error handler correctly omit `details` for non-validation errors (not just `details: []`)?

5. **Test coverage of edge cases** — multi-currency balance (USD withdrawal not payable by EUR balance), failed-transaction visibility filter (counterparty hidden, initiator visible, admin sees all), CSV quoting (RFC 4180), `transactionCount` vs totals in summary (failed rows counted but not summed).

## Out of scope

Production-grade money types (number is acceptable for homework), persistence, authentication, horizontal scaling, CI configuration.

## Output format

`docs/reviews/codex-review-2026-04-29.md` with findings tagged:

- `[BLOCKING]` — must fix before submission
- `[SUGGESTED]` — improvement, not required
- `[INFO]` — observation or note

Include: finding description, file:line reference, recommended fix or rationale for waiver.

# Code Review — `homework-1-submission` vs `main`

**Reviewer:** Claude Code (claude-sonnet-4-6) via inline review (skill `codex:review` unavailable due to `disable-model-invocation`)  
**Date:** 2026-04-29  
**Branch diff scope:** `homework-1-submission` → `main`

---

## Summary

The implementation is solid. No blocking defects were found. Settlement logic is correct and exhaustive, currency scoping is tight, and the test pyramid covers the meaningful edge cases. The findings below are primarily observational or suggested hardening.

---

## Focus Area 1 — Settlement correctness

### F1-A [INFO] Theoretical `pending` leak if `markFailed` throws inside the catch block

**File:** `src/services/transactions.service.ts:30-33`

```ts
} catch (err) {
  logger.error({ err, requestId, txnId: id }, 'Settlement error — marking failed');
  return this.repo.markFailed(id, 'INSUFFICIENT_FUNDS');
}
```

If `this.repo.markFailed` itself throws (e.g., `requireById` can't find the ID it just inserted), the exception propagates out of `create()` and the transaction remains `pending` in the repo. Under current implementation this is unreachable — `repo.create` always inserts before the try block, so `requireById` inside `markFailed` will always find the ID. No fix required for homework; note for production hardening.

**Recommended fix (production only):** Wrap the `markFailed` call in its own try/catch and emit a critical log if it also fails, rather than propagating.

---

### F1-B [INFO] `getBalance` called unconditionally for deposits

**File:** `src/services/transactions.service.ts:20-26`

```ts
const balance = this.getBalance(txn.fromAccount, txn.currency);
const needsBalanceCheck = txn.type === 'withdrawal' || txn.type === 'transfer';
if (needsBalanceCheck && balance < txn.amount) { … }
```

For deposits, `fromAccount` is `EXTERNAL` and `getBalance('EXTERNAL', …)` short-circuits to `0`. The result is then ignored (deposits skip `needsBalanceCheck`). Harmless and the guard is correct — this is a minor readability observation. Could be `if (!needsBalanceCheck) return repo.markCompleted(id)` before the `getBalance` call, but the current style is defensively clear.

---

### F1-C [INFO] `requestId` threading into `logger.error` but not the 201 response body

**File:** `src/services/transactions.service.ts:13`, `src/controllers/transactions.controller.ts:15-25`

`requestId` is accepted by `create()` and forwarded to the error logger, which is correct. The successful 201 body returns the raw `Transaction` object which has no `requestId` field — the correlation ID is available only via the `x-request-id` response header. This is consistent with REST convention (header carries correlation; body carries resource). No issue per se, but worth documenting if the spec requires the body field on success too.

---

## Focus Area 2 — Money math

### F2-A [INFO] `Money.parse` is dead code

**File:** `src/utils/money.ts:4-11`

`Money.parse` validates finite, positive, ≤ MAX_AMOUNT, and ≤ 2 decimal places — but is never imported or called in the active transaction creation flow. All of those checks are handled inline by `MoneySchema` in `common.schemas.ts`. The function is correct but unreachable. Either delete it or wire it into `MoneySchema` via `.transform` to make the Zod schema the single call site.

---

### F2-B [SUGGESTED] `AccountsService.getBalances` reduces without intermediate rounding; inconsistent with `getSummary`

**File:** `src/services/accounts.service.ts:28-33` vs `48-53`

`getSummary` applies `Math.round((sum + t.amount) * 100) / 100` on every accumulation step. `getBalances` applies the final `Math.round(amount * 100) / 100` only once after the entire reduce. For homework-grade inputs validated to ≤ 2 decimal places, IEEE 754 drift is unlikely to produce a wrong final cent, but the inconsistency makes the codebase misleading about its rounding strategy.

**Recommended fix:** Apply `Money.add` (or the equivalent `Math.round((sum ± t.amount) * 100) / 100`) per iteration in `getBalances`, mirroring `getSummary`.

```ts
// current
return sum + t.amount;          // no intermediate rounding

// suggested
return Math.round((sum + t.amount) * 100) / 100;
```

---

### F2-C [INFO] `MAX_AMOUNT` enforced at both layers, but only Zod layer is active

**Files:** `src/validators/common.schemas.ts:22`, `src/utils/money.ts:7`

Both `MoneySchema` (`.refine(n => n <= MAX_AMOUNT)`) and `Money.parse` (`if (input > MAX_AMOUNT)`) enforce the limit. Since `Money.parse` is dead code (see F2-A), only the Zod schema is active — which is the correct layer anyway. Confirmed: enforcement at the system boundary. ✓

---

## Focus Area 3 — Zod schema completeness

### F3-A [SUGGESTED] `CreateTransactionSchema` does not reject EXTERNAL on either side of a transfer

**File:** `src/validators/transaction.schemas.ts:19-55`

The five `superRefine` rules correctly cover:
- deposit with non-EXTERNAL from
- deposit with EXTERNAL to
- withdrawal with non-EXTERNAL to
- withdrawal with EXTERNAL from
- transfer where from === to (catches the EXTERNAL===EXTERNAL case)

However, a transfer where *one* side is EXTERNAL passes Zod validation:
- `{ fromAccount: 'EXTERNAL', toAccount: 'ACC-AAAAA', type: 'transfer' }` — valid per schema, fails at service level (balance 0) with `INSUFFICIENT_FUNDS`. Returns **201 with `status: failed`** instead of **400**.
- `{ fromAccount: 'ACC-AAAAA', toAccount: 'EXTERNAL', type: 'transfer' }` — valid per schema. If ACC-AAAAA has sufficient balance, this **succeeds** as a de-facto withdrawal but with `type: transfer` in the audit record — a semantic corruption of the ledger.

The second case is the more serious one: it allows type=transfer to behave as an unaudited withdrawal.

**Recommended fix:** Add two rules to the existing `superRefine`:

```ts
if (v.type === 'transfer' && v.fromAccount === 'EXTERNAL') {
  ctx.addIssue({ path: ['fromAccount'], code: 'custom',
    message: 'Transfer source must be an account, not EXTERNAL' });
}
if (v.type === 'transfer' && v.toAccount === 'EXTERNAL') {
  ctx.addIssue({ path: ['toAccount'], code: 'custom',
    message: 'Transfer destination must be an account, not EXTERNAL' });
}
```

---

### F3-B [INFO] `ListFiltersSchema` rejects `from > to`, `strict` blocks injected fields — both correct

**Files:** `src/validators/transaction.schemas.ts:66-68`, line `18` (`.strict()`)

- `from > to` rejected via `.refine`. ✓  
- `.strict()` rejects `id`, `status`, `timestamp` in POST body. ✓  
- Test coverage for both in `transaction.schemas.test.ts:158-165` and `:43-57`. ✓

---

### F3-C [INFO] `TransactionSchema` includes `pending` in the `status` enum

**File:** `src/validators/transaction.schemas.ts:81`

```ts
status: z.enum(['pending', 'completed', 'failed']),
```

`TransactionSchema` is used for the in-memory domain model (which legitimately holds `pending` during repo creation) and implicitly for OpenAPI response documentation. A reviewer reading the OpenAPI spec will see `pending` as a valid API response status, which contradicts the promise that clients never observe `pending`. Consider a separate `TransactionResponseSchema` with only `['completed', 'failed']` for the response documentation. No runtime impact.

---

## Focus Area 4 — Error-handler uniformity

### F4-A [INFO] All routes surface `x-request-id` header and `requestId` body field on errors

**File:** `src/middleware/request-id.ts`, `src/middleware/error-handler.ts`

- `requestId` middleware sets `res.setHeader('x-request-id', id)` unconditionally before any route runs. ✓  
- `errorHandler` includes `requestId` in both the `HttpError` branch and the 500 fallback. ✓  
- Integration tests confirm mirroring on 201 (`transactions.test.ts:85-96`) and `requestId` in body on 400 and 404. ✓

---

### F4-B [INFO] `details` correctly omitted (not `details: []`) for non-validation errors

**File:** `src/middleware/error-handler.ts:16-18`

```ts
...(err.details && err.details.length > 0 ? { details: err.details } : {}),
```

Non-validation `HttpError` subclasses (`NotFoundError`, `ConflictError`) don't pass `details`, so `err.details` is `undefined` — condition false, key entirely absent. ✓ Even if a `ValidationError` is somehow constructed with `[]`, the empty guard ensures omission. ✓

---

## Focus Area 5 — Test coverage of edge cases

### F5-A [INFO] Multi-currency balance (USD withdrawal not payable by EUR balance) — covered

**File:** `src/services/transactions.service.test.ts:67-81`

The test funds ACC-AAAAA with EUR, then attempts a USD withdrawal, and asserts `status: failed` with `INSUFFICIENT_FUNDS`. Confirms `getBalance` is scoped by currency. ✓

---

### F5-B [INFO] Failed-transaction visibility filter — covered at three levels

**Files:** `src/repository/transaction.repository.test.ts:86-101`, `tests/integration/transactions.test.ts:130-144`

Three assertions at the repo unit level: initiator sees it, counterparty does not, admin (no filter) sees it. One integration test confirms the counterparty HTTP path. ✓

---

### F5-C [SUGGESTED] CSV quoting tests are nominal — no adversarial field value tested

**File:** `src/services/export.service.test.ts:59-81`

The two RFC 4180 quoting tests are comment-acknowledged placeholders. The comma-quoting test (lines 59-72) doesn't inject a `,` into any field — it tests a normal transaction and asserts the output doesn't accidentally contain `""`. The double-quote test (lines 74-81) asserts only that the function "doesn't throw".

The `escapeField` implementation at `export.service.ts:15-20` looks correct, but without adversarial inputs the tests don't prove it.

**Recommended additions:**

```ts
it('RFC 4180: wraps field containing comma in double quotes', () => {
  // Inject comma via type cast — escapeField must handle it
  const txn: Transaction = { ...baseTxn, id: 'txn_,weird' as any };
  const csv = toCSV([txn]);
  const dataRow = csv.split('\r\n')[1];
  expect(dataRow).toContain('"txn_,weird"');
});

it('RFC 4180: doubles embedded double-quotes', () => {
  const txn: Transaction = { ...baseTxn, id: 'txn_"quoted"' as any };
  const csv = toCSV([txn]);
  expect(csv).toContain('"txn_""quoted"""');
});
```

---

### F5-D [INFO] `transactionCount` includes failed rows; totals exclude them — covered

**File:** `src/services/accounts.service.test.ts:76-95`

Two dedicated tests: `transactionCount` is 2 when one deposit completes and one withdrawal fails; `totalWithdrawals` is 0 (failed rows not summed). ✓

---

## Blocking findings requiring pre-submission action

**None.** The only item that could arguably rise to blocking is **F3-A** (transfer with EXTERNAL participant produces a semantic ledger corruption), but since the homework spec doesn't explicitly enumerate this restriction among the validation rules and the service handles it deterministically, it is left as `[SUGGESTED]`.

---

## Suggested pre-submission improvements (prioritised)

| Priority | Finding | Fix effort |
|---|---|---|
| 1 | F3-A — transfer + EXTERNAL passes schema | 2 lines in `superRefine` + 2 test cases |
| 2 | F5-C — CSV quoting tests are nominal | 2 new `it` blocks in `export.service.test.ts` |
| 3 | F2-B — `getBalances` rounding inconsistency | 2-line change in `accounts.service.ts` |
| 4 | F2-A — dead `Money.parse` | Delete or wire into `MoneySchema` |
| 5 | F3-C — `pending` in response schema | Add separate response-schema variant |

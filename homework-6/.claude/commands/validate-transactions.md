---
description: Run the Transaction Validator in --dry-run over sample-transactions.json and print a results table.
allowed-tools: Bash(npx tsx src/agents/transaction-validator.ts:*), Bash(npm run:*), Read
---

# /validate-transactions

Run only the validation stage (no scoring, no compliance) as a dry run — it reads
`sample-transactions.json` and writes nothing to `shared/`.

## Steps

1. **Dry-run the validator.** Run:
   `npx tsx src/agents/transaction-validator.ts --dry-run`
2. **Report counts.** From the output, report total / valid / invalid.
3. **Report rejection reasons.** For each invalid transaction, show its `reject_reason`
   (`MISSING_FIELD:<name>` · `NON_POSITIVE_AMOUNT` · `INVALID_CURRENCY:<code>` · `INVALID_TIMESTAMP`).
4. **Print the results table.** Show the per-transaction table (ID / VALID / REASON) the CLI emits.

## Expected output (for the reference sample)

- Transactions: 8 — Valid: 6 — Invalid: 2.
- TXN006 → `INVALID_CURRENCY:XYZ`.
- TXN007 → `NON_POSITIVE_AMOUNT`.

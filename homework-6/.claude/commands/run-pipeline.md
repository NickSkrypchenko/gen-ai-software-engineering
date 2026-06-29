---
description: Run the full banking pipeline over sample-transactions.json and summarize shared/results/.
allowed-tools: Bash(npm run pipeline), Bash(ls:*), Bash(cat:*), Bash(test:*), Read
---

# /run-pipeline

Execute the deterministic pipeline end-to-end and report the outcome.

## Steps

1. **Check input exists.** Confirm `sample-transactions.json` is present in the project root.
   If it is missing, stop and report the error (do not fabricate input).
2. **Clear + run.** Run `npm run pipeline`. The integrator clears `shared/{input,processing,output,results}/`
   at the start of every run, so each run is fresh and deterministic.
3. **Summarize results.** Read `shared/results/pipeline-summary.json` and report the total and
   the per-decision counts (APPROVE / HOLD / REJECT / REJECTED_VALIDATION).
4. **Report rejections and why.** List every transaction whose decision is `REJECT` (compliance
   policy) or `REJECTED_VALIDATION` (validator), with its `reason` / `reject_reason` from the
   matching `shared/results/<id>.result.json`. Account numbers in reasons are already masked.
5. **Point at the audit trail.** Note that `shared/results/audit.log` holds one masked line per
   agent-hop (validate / score / decide) as the operation history, distinct from the result JSON.

## Expected output (for the reference sample)

- 8 transactions processed: 2 APPROVE · 3 HOLD · 1 REJECT · 2 REJECTED_VALIDATION.
- REJECT: TXN003 — `DENYLIST_ACCOUNT:ACC-***9`.
- REJECTED_VALIDATION: TXN006 — `INVALID_CURRENCY:XYZ`; TXN007 — `NON_POSITIVE_AMOUNT`.

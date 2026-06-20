/**
 * Integrator — orchestrates the deterministic file-based pipeline.
 *
 * Loads `sample-transactions.json`, wraps each record in a UUIDv4 envelope, and runs it
 * through the three pure cores (validate → score → decide), writing real JSON files through
 * the shared-dir protocol (input → processing → output → results). Validation failures
 * terminate early as `REJECTED_VALIDATION`. Every hop is appended to `shared/results/audit.log`.
 *
 * No LLM calls, no network. Timestamps come from an injected `Clock`, so identical input
 * yields identical `shared/results/`.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateTransaction } from './domain/validation.js';
import { scoreTransaction } from './domain/fraud-rules.js';
import { decide } from './domain/compliance-rules.js';
import { loadFxTable } from './domain/fx.js';
import { buildEnvelope, forward } from './lib/messages.js';
import { createAuditLogger } from './lib/logger.js';
import {
  clearDirs,
  ensureDirs,
  readJson,
  resolveSharedDirs,
  writeJson,
  type SharedDirs,
} from './lib/shared-dirs.js';
import type {
  Clock,
  Decision,
  Denylist,
  FxSnapshot,
  Message,
  PipelineSummary,
  RawTransaction,
  RiskResult,
  TransactionResult,
} from './types.js';

/** Real wall-clock implementation (used by `npm run pipeline`). Tests inject a fixed clock. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A clock pinned to a fixed instant — deterministic runs/tests. */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

export interface PipelineOptions {
  sampleFile: string;
  fxPath: string;
  denylistPath: string;
}

/** Default file locations relative to a project root (the homework-6 dir). */
export function defaultOptions(root: string): PipelineOptions {
  return {
    sampleFile: join(root, 'sample-transactions.json'),
    fxPath: join(root, 'config', 'fx-rates.json'),
    denylistPath: join(root, 'config', 'denylist.json'),
  };
}

const EMPTY_COUNTS = (): Record<Decision, number> => ({
  APPROVE: 0,
  HOLD: 0,
  REJECT: 0,
  REJECTED_VALIDATION: 0,
});

function asData(tx: RawTransaction): Record<string, unknown> {
  return { ...tx } as Record<string, unknown>;
}

function rejectedValidationResult(
  tx: RawTransaction,
  reason: string,
  envelope: Message,
  processedAt: string,
): TransactionResult {
  return {
    transaction_id: tx.transaction_id,
    decision: 'REJECTED_VALIDATION',
    reason,
    escalate: false,
    validator_status: 'rejected',
    reject_reason: reason,
    amount_usd_equivalent: null,
    risk_score: null,
    risk_band: null,
    matched_signals: [],
    processed_at: processedAt,
    envelope,
  };
}

/**
 * Run the full pipeline over the sample transactions. Writes per-stage envelopes, one result
 * JSON per transaction, an append-only audit log, and a run summary. Returns the summary.
 */
export function runPipeline(
  clock: Clock,
  dirs: SharedDirs,
  opts: PipelineOptions,
): PipelineSummary {
  ensureDirs(dirs);
  clearDirs(dirs);

  const rates = loadFxTable(readJson<FxSnapshot>(opts.fxPath));
  const denylist = readJson<Denylist>(opts.denylistPath);
  const transactions = readJson<RawTransaction[]>(opts.sampleFile);

  const audit = createAuditLogger(join(dirs.results, 'audit.log'), clock);
  const counts = EMPTY_COUNTS();
  const summaryRows: PipelineSummary['results'] = [];

  for (const tx of transactions) {
    const id = tx.transaction_id;
    const inputEnvelope = buildEnvelope(asData(tx), 'integrator', 'transaction_validator', clock);
    writeJson(join(dirs.input, `${id}.json`), inputEnvelope);

    // --- Hop 1: validate ---
    writeJson(join(dirs.processing, `${id}.json`), inputEnvelope);
    const validation = validateTransaction(tx);
    audit.log({
      hop: 'validate',
      agent: 'transaction_validator',
      transaction_id: id,
      outcome: validation.valid ? 'validated' : `rejected:${validation.reject_reason}`,
    });

    if (!validation.valid) {
      const result = rejectedValidationResult(
        tx,
        validation.reject_reason ?? 'REJECTED_VALIDATION',
        forward(inputEnvelope, 'transaction_validator', 'integrator', {
          status: 'rejected',
          reject_reason: validation.reject_reason,
        }),
        clock.now().toISOString(),
      );
      writeJson(join(dirs.results, `${id}.result.json`), result);
      counts.REJECTED_VALIDATION += 1;
      summaryRows.push({ transaction_id: id, decision: 'REJECTED_VALIDATION', risk_score: null, escalate: false });
      continue;
    }

    const validatedEnvelope = forward(inputEnvelope, 'transaction_validator', 'fraud_detector', {
      status: 'validated',
    });
    writeJson(join(dirs.output, `${id}.validated.json`), validatedEnvelope);

    // --- Hop 2: score ---
    writeJson(join(dirs.processing, `${id}.json`), validatedEnvelope);
    const risk: RiskResult = scoreTransaction(tx, rates);
    audit.log({
      hop: 'score',
      agent: 'fraud_detector',
      transaction_id: id,
      outcome: `scored:${risk.risk_score}:${risk.risk_band}`,
    });
    const scoredEnvelope = forward(validatedEnvelope, 'fraud_detector', 'compliance_checker', {
      amount_usd_equivalent: risk.amount_usd_equivalent,
      risk_score: risk.risk_score,
      risk_band: risk.risk_band,
      matched_signals: risk.matched_signals,
      status: 'scored',
    });
    writeJson(join(dirs.output, `${id}.scored.json`), scoredEnvelope);

    // --- Hop 3: decide ---
    writeJson(join(dirs.processing, `${id}.json`), scoredEnvelope);
    const compliance = decide(tx, risk, denylist);
    audit.log({
      hop: 'decide',
      agent: 'compliance_checker',
      transaction_id: id,
      outcome: compliance.escalate ? `${compliance.decision}:escalate` : compliance.decision,
    });
    const finalEnvelope = forward(scoredEnvelope, 'compliance_checker', 'integrator', {
      decision: compliance.decision,
      reason: compliance.reason,
      escalate: compliance.escalate,
      status: 'completed',
    });

    const result: TransactionResult = {
      transaction_id: id,
      decision: compliance.decision,
      reason: compliance.reason,
      escalate: compliance.escalate,
      validator_status: 'validated',
      amount_usd_equivalent: risk.amount_usd_equivalent,
      risk_score: risk.risk_score,
      risk_band: risk.risk_band,
      matched_signals: risk.matched_signals,
      processed_at: clock.now().toISOString(),
      envelope: finalEnvelope,
    };
    writeJson(join(dirs.results, `${id}.result.json`), result);
    counts[compliance.decision] += 1;
    summaryRows.push({
      transaction_id: id,
      decision: compliance.decision,
      risk_score: risk.risk_score,
      escalate: compliance.escalate,
    });
  }

  const summary: PipelineSummary = {
    generated_at: clock.now().toISOString(),
    total: transactions.length,
    counts,
    results: summaryRows,
  };
  writeJson(join(dirs.results, 'pipeline-summary.json'), summary);
  return summary;
}

/** CLI entry: `npm run pipeline` → process all sample transactions into `shared/results/`. */
export function main(): void {
  const root = process.cwd();
  const dirs = resolveSharedDirs(join(root, 'shared'));
  const summary = runPipeline(new SystemClock(), dirs, defaultOptions(root));
  const { counts } = summary;
  process.stdout.write(
    `Pipeline complete — ${summary.total} transactions processed.\n` +
      `  APPROVE: ${counts.APPROVE}  HOLD: ${counts.HOLD}  ` +
      `REJECT: ${counts.REJECT}  REJECTED_VALIDATION: ${counts.REJECTED_VALIDATION}\n` +
      `  Results: ${dirs.results}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

/**
 * Fraud Detector — thin CLI wrapper around the pure `scoreTransaction` core.
 *
 * Loads the FX snapshot, scores a single transaction (given as a JSON file path), and prints
 * the auditable rule trail. Used for ad-hoc inspection; the integrator calls the core in-process.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { scoreTransaction } from '../domain/fraud-rules.js';
import { loadFxTable } from '../domain/fx.js';
import { readJson } from '../lib/shared-dirs.js';
import type { FxSnapshot, RawTransaction, RiskResult } from '../types.js';

/** Score a single transaction using the FX snapshot at `fxPath`. */
export function scoreFromFiles(txPath: string, fxPath: string): RiskResult {
  const tx = readJson<RawTransaction>(txPath);
  const rates = loadFxTable(readJson<FxSnapshot>(fxPath));
  return scoreTransaction(tx, rates);
}

/** Render the risk result as a compact line. */
export function formatRisk(id: string, risk: RiskResult): string {
  return (
    `${id}  usd=${risk.amount_usd_equivalent}  score=${risk.risk_score}  ` +
    `band=${risk.risk_band}  signals=[${risk.matched_signals.join(', ')}]`
  );
}

/** CLI entry: `fraud-detector <transaction.json>`. */
export function runFraudCli(
  argv: string[],
  root: string,
  write: (s: string) => void = (s) => process.stdout.write(s),
): RiskResult {
  const txPath = argv[0];
  if (!txPath) throw new Error('usage: fraud-detector <transaction.json>');
  const fxPath = join(root, 'config', 'fx-rates.json');
  const tx = readJson<RawTransaction>(txPath);
  const risk = scoreFromFiles(txPath, fxPath);
  write(`${formatRisk(tx.transaction_id, risk)}\n`);
  return risk;
}

/* v8 ignore next 3 -- CLI bootstrap guard, exercised only as a script */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFraudCli(process.argv.slice(2), process.cwd());
}

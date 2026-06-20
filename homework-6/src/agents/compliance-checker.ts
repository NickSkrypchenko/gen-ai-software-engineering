/**
 * Compliance Checker — thin CLI wrapper around the pure `decide` core.
 *
 * Loads the denylist + FX snapshot, scores a single transaction, applies the compliance
 * policy, and prints the decision. Used for ad-hoc inspection; the integrator calls the core
 * in-process.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { decide } from '../domain/compliance-rules.js';
import { scoreTransaction } from '../domain/fraud-rules.js';
import { loadFxTable } from '../domain/fx.js';
import { readJson } from '../lib/shared-dirs.js';
import type { ComplianceResult, Denylist, FxSnapshot, RawTransaction } from '../types.js';

/** Score + decide a single transaction from files. */
export function decideFromFiles(
  txPath: string,
  fxPath: string,
  denylistPath: string,
): ComplianceResult {
  const tx = readJson<RawTransaction>(txPath);
  const rates = loadFxTable(readJson<FxSnapshot>(fxPath));
  const denylist = readJson<Denylist>(denylistPath);
  const risk = scoreTransaction(tx, rates);
  return decide(tx, risk, denylist);
}

/** Render the compliance result as a compact line. */
export function formatDecision(id: string, result: ComplianceResult): string {
  const flag = result.escalate ? ' [ESCALATE]' : '';
  return `${id}  ${result.decision}${flag}  (${result.reason})`;
}

/** CLI entry: `compliance-checker <transaction.json>`. */
export function runComplianceCli(
  argv: string[],
  root: string,
  write: (s: string) => void = (s) => process.stdout.write(s),
): ComplianceResult {
  const txPath = argv[0];
  if (!txPath) throw new Error('usage: compliance-checker <transaction.json>');
  const fxPath = join(root, 'config', 'fx-rates.json');
  const denylistPath = join(root, 'config', 'denylist.json');
  const tx = readJson<RawTransaction>(txPath);
  const result = decideFromFiles(txPath, fxPath, denylistPath);
  write(`${formatDecision(tx.transaction_id, result)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runComplianceCli(process.argv.slice(2), process.cwd());
}

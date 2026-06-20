/**
 * Transaction Validator — thin CLI wrapper around the pure `validateTransaction` core.
 *
 * Supports `--dry-run` (used by the `/validate-transactions` skill): reads
 * `sample-transactions.json`, validates every record, and prints a total / valid / invalid
 * report with rejection reasons. It writes nothing to `shared/`.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateTransaction } from '../domain/validation.js';
import { readJson } from '../lib/shared-dirs.js';
import type { RawTransaction } from '../types.js';

export interface ValidationRow {
  transaction_id: string;
  valid: boolean;
  reject_reason?: string;
}

export interface ValidationReport {
  total: number;
  valid: number;
  invalid: number;
  rows: ValidationRow[];
}

/** Validate a list of transactions and tally the results (pure). */
export function validateAll(transactions: RawTransaction[]): ValidationReport {
  const rows: ValidationRow[] = transactions.map((tx) => {
    const result = validateTransaction(tx);
    return {
      transaction_id: tx.transaction_id,
      valid: result.valid,
      ...(result.reject_reason ? { reject_reason: result.reject_reason } : {}),
    };
  });
  const valid = rows.filter((r) => r.valid).length;
  return { total: rows.length, valid, invalid: rows.length - valid, rows };
}

/** Render a human-readable report (used by the CLI / skill). */
export function formatReport(report: ValidationReport): string {
  const lines = [
    `Transactions: ${report.total}  Valid: ${report.valid}  Invalid: ${report.invalid}`,
    '',
    'ID         VALID  REASON',
    '---------- -----  ----------------------------',
  ];
  for (const row of report.rows) {
    lines.push(
      `${row.transaction_id.padEnd(10)} ${(row.valid ? 'yes' : 'no').padEnd(5)}  ${row.reject_reason ?? ''}`,
    );
  }
  return lines.join('\n');
}

/** CLI entry. `--dry-run` is accepted (and is the only mode); never writes to `shared/`. */
export function runValidatorCli(
  argv: string[],
  root: string,
  write: (s: string) => void = (s) => process.stdout.write(s),
): ValidationReport {
  const sampleFile = join(root, 'sample-transactions.json');
  const transactions = readJson<RawTransaction[]>(sampleFile);
  const report = validateAll(transactions);
  const mode = argv.includes('--dry-run') ? ' (dry-run)' : '';
  write(`Validator${mode}\n${formatReport(report)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runValidatorCli(process.argv.slice(2), process.cwd());
}

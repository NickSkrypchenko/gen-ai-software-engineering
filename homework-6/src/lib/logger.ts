/**
 * Append-only audit log — distinct from the per-transaction result JSON.
 *
 * One line per agent-hop (`validate` / `score` / `decide`) with an ISO 8601 timestamp,
 * agent name, transaction_id, and outcome. PII is never written in plaintext: account
 * numbers are masked (`ACC-1001` → `ACC-***1`). The audit log is the operation history;
 * the result JSON is the final state.
 */
import { appendFileSync } from 'node:fs';
import type { Clock } from '../types.js';

/** Mask an account number, keeping the `ACC-` prefix and only the last character. */
export function maskAccount(account: string): string {
  if (typeof account !== 'string' || account.length === 0) return account;
  const match = account.match(/^(ACC-)(.+)$/);
  if (match) {
    const body = match[2];
    return `ACC-***${body.slice(-1)}`;
  }
  // Generic fallback: reveal only the last character.
  return `***${account.slice(-1)}`;
}

/** Mask any `ACC-####` tokens embedded in an arbitrary string (e.g. a reject reason). */
export function maskPii(text: string): string {
  return text.replace(/ACC-\w+/g, (m) => maskAccount(m));
}

export type AuditHop = 'validate' | 'score' | 'decide';

export interface AuditEntry {
  hop: AuditHop;
  agent: string;
  transaction_id: string;
  outcome: string;
}

export interface AuditLogger {
  log(entry: AuditEntry): void;
}

/**
 * Create an append-only audit logger writing tab-separated lines to `filePath`.
 * The timestamp is taken from the injected `Clock`; the outcome string is PII-masked.
 */
export function createAuditLogger(filePath: string, clock: Clock): AuditLogger {
  return {
    log(entry: AuditEntry): void {
      const ts = clock.now().toISOString();
      const line =
        [ts, entry.hop, entry.agent, entry.transaction_id, maskPii(entry.outcome)].join('\t') +
        '\n';
      appendFileSync(filePath, line, 'utf8');
    },
  };
}

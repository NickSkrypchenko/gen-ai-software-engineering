/**
 * Compliance Checker — pure core. Owns all three of its outcomes.
 *
 *   denylist hit (source/dest account, or country)  → REJECT   (independent of score)
 *   else risk_score ≥ 0.30                           → HOLD     (escalate when band is high)
 *   else                                             → APPROVE
 *
 * `escalate` is a boolean audit annotation on a HOLD when the band is `high` (≥ 0.60) — not a
 * fifth status. A denylist hit always wins over a low score (e.g. ACC-9999 at risk 0.20).
 */
import { maskAccount } from '../lib/logger.js';
import type { ComplianceResult, Denylist, RawTransaction, RiskResult } from '../types.js';

const HOLD_THRESHOLD_HUNDREDTHS = 30;

/** Decide the compliance outcome for a scored transaction. */
export function decide(
  tx: RawTransaction,
  risk: RiskResult,
  denylist: Denylist,
): ComplianceResult {
  // 1. Denylist / sanctions policy — independent of the fraud score.
  if (denylist.accounts.includes(tx.source_account)) {
    return {
      decision: 'REJECT',
      reason: `DENYLIST_ACCOUNT:${maskAccount(tx.source_account)}`,
      escalate: false,
    };
  }
  if (denylist.accounts.includes(tx.destination_account)) {
    return {
      decision: 'REJECT',
      reason: `DENYLIST_ACCOUNT:${maskAccount(tx.destination_account)}`,
      escalate: false,
    };
  }
  const country = tx.metadata?.country;
  if (country !== undefined && denylist.countries.includes(country)) {
    return { decision: 'REJECT', reason: `DENYLIST_COUNTRY:${country}`, escalate: false };
  }

  // 2. Risk-based hold.
  const hundredths = Math.round(risk.risk_score * 100);
  if (hundredths >= HOLD_THRESHOLD_HUNDREDTHS) {
    const escalate = risk.risk_band === 'high';
    return {
      decision: 'HOLD',
      reason: escalate ? 'HIGH_RISK_ESCALATE' : 'RISK_HOLD',
      escalate,
    };
  }

  // 3. Default approve.
  return { decision: 'APPROVE', reason: 'CLEARED', escalate: false };
}

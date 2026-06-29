/**
 * Fraud Detector — pure core.
 *
 * The amount is first normalized to a USD-equivalent (FX table) BEFORE the amount
 * thresholds. The risk score is additive and capped at 1.0. To stay deterministic we sum
 * integer "hundredths" (40, 20, 20, 20, 10) and divide once at the end, so the score never
 * suffers float drift (e.g. 0.4 + 0.2). Monetary thresholds compare `Decimal` values, never
 * floats.
 */
import { toUsd } from './fx.js';
import { formatMoney } from '../lib/money.js';
import type { FxTable, RawTransaction, RiskBand, RiskResult } from '../types.js';

/** Additive signal weights, in integer hundredths of a point. */
export const SIGNAL_WEIGHTS = {
  HIGH_VALUE: 40,
  NEAR_THRESHOLD: 20,
  OFF_HOURS: 20,
  CROSS_BORDER: 20,
  WIRE: 10,
} as const;

const HIGH_VALUE_THRESHOLD = '10000';
const NEAR_LOW = '9000';
const NEAR_HIGH = '9999.99';

/** Map a score (in hundredths) to its informational band. */
export function bandForHundredths(hundredths: number): RiskBand {
  if (hundredths >= 60) return 'high';
  if (hundredths >= 30) return 'medium';
  return 'low';
}

/** Parse the UTC hour from an ISO 8601 timestamp. */
function utcHour(timestamp: string): number {
  return new Date(timestamp).getUTCHours();
}

/** Score a (validated) transaction. Returns the full auditable rule trail. */
export function scoreTransaction(tx: RawTransaction, rates: FxTable): RiskResult {
  const usd = toUsd(tx.amount, tx.currency, rates);
  const matched: string[] = [];
  let hundredths = 0;

  if (usd.greaterThan(HIGH_VALUE_THRESHOLD)) {
    matched.push('HIGH_VALUE');
    hundredths += SIGNAL_WEIGHTS.HIGH_VALUE;
  } else if (usd.greaterThanOrEqualTo(NEAR_LOW) && usd.lessThanOrEqualTo(NEAR_HIGH)) {
    matched.push('NEAR_THRESHOLD');
    hundredths += SIGNAL_WEIGHTS.NEAR_THRESHOLD;
  }

  const hour = utcHour(tx.timestamp);
  if (hour >= 0 && hour <= 5) {
    matched.push('OFF_HOURS');
    hundredths += SIGNAL_WEIGHTS.OFF_HOURS;
  }

  // Cross-border on the currency dimension, or on a *known* non-US country. An absent country
  // is not treated as foreign (the currency check still covers non-USD).
  const country = tx.metadata?.country;
  if (tx.currency !== 'USD' || (country !== undefined && country !== 'US')) {
    matched.push('CROSS_BORDER');
    hundredths += SIGNAL_WEIGHTS.CROSS_BORDER;
  }

  if (tx.transaction_type === 'wire_transfer') {
    matched.push('WIRE');
    hundredths += SIGNAL_WEIGHTS.WIRE;
  }

  const capped = Math.min(100, hundredths);

  return {
    amount_usd_equivalent: formatMoney(usd),
    risk_score: capped / 100,
    risk_band: bandForHundredths(capped),
    matched_signals: matched,
    status: 'scored',
  };
}

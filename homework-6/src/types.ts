/**
 * Shared type definitions for the banking transaction pipeline.
 *
 * Kept out of coverage (see vitest.config.ts) — declarations only, no logic.
 */

/** The four — and only four — terminal dispositions. `escalate` is an audit flag, not a 5th value. */
export type Decision = 'APPROVE' | 'HOLD' | 'REJECT' | 'REJECTED_VALIDATION';

/** Closed ISO 4217 allow-list — exactly 7, equal 1:1 to the FX-rate keys. */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD';

/** Informational risk band derived from the additive score. */
export type RiskBand = 'low' | 'medium' | 'high';

/** Injectable clock so pipeline timestamps are deterministic in tests. */
export interface Clock {
  now(): Date;
}

/** A raw transaction record as it appears in `sample-transactions.json`. */
export interface RawTransaction {
  transaction_id: string;
  timestamp: string;
  source_account: string;
  destination_account: string;
  amount: string;
  currency: string;
  transaction_type: string;
  description?: string;
  metadata?: {
    channel?: string;
    country?: string;
  };
}

/** Standard message envelope carried between agents (constant header, enriched `data`). */
export interface Message<T = Record<string, unknown>> {
  message_id: string;
  timestamp: string;
  source_agent: string;
  target_agent: string;
  message_type: 'transaction';
  data: T;
}

/** Validator output. Terminal `REJECTED_VALIDATION` when `valid` is false. */
export interface ValidationResult {
  valid: boolean;
  status: 'validated' | 'rejected';
  reject_reason?: string;
}

/** Fraud Detector output — the full, auditable rule trail. */
export interface RiskResult {
  amount_usd_equivalent: string;
  risk_score: number;
  risk_band: RiskBand;
  matched_signals: string[];
  status: 'scored';
}

/** Compliance Checker output — owns APPROVE / HOLD / REJECT. */
export interface ComplianceResult {
  decision: Extract<Decision, 'APPROVE' | 'HOLD' | 'REJECT'>;
  reason: string;
  escalate: boolean;
}

/** Static FX snapshot: currency code → rate-to-USD as a decimal string. */
export type FxTable = Record<string, string>;

/** Shape of `config/fx-rates.json`. */
export interface FxSnapshot {
  as_of: string;
  rates: FxTable;
}

/** Shape of `config/denylist.json`. */
export interface Denylist {
  accounts: string[];
  countries: string[];
}

/** A per-transaction final outcome written to `shared/results/<id>.result.json`. */
export interface TransactionResult {
  transaction_id: string;
  decision: Decision;
  reason: string;
  escalate: boolean;
  validator_status: 'validated' | 'rejected';
  reject_reason?: string;
  amount_usd_equivalent: string | null;
  risk_score: number | null;
  risk_band: RiskBand | null;
  matched_signals: string[];
  processed_at: string;
  envelope: Message;
}

/** The run report written to `shared/results/pipeline-summary.json`. */
export interface PipelineSummary {
  generated_at: string;
  total: number;
  counts: Record<Decision, number>;
  results: Array<{
    transaction_id: string;
    decision: Decision;
    risk_score: number | null;
    escalate: boolean;
  }>;
}

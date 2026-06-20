/**
 * Shared type definitions for the banking transaction pipeline.
 *
 * Phase 0 scaffold: this file currently declares only the foundational
 * enums/shapes needed to compile. Agent 2 (Phase 2) extends it with the
 * full envelope, validation/fraud/compliance result types, and the
 * pipeline summary. Kept out of coverage (see vitest.config.ts).
 */

/** The four — and only four — terminal dispositions. `escalate` is an audit flag, not a 5th value. */
export type Decision = 'APPROVE' | 'HOLD' | 'REJECT' | 'REJECTED_VALIDATION';

/** Closed ISO 4217 allow-list — exactly 7, equal 1:1 to the FX-rate keys. */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD';

/** Injectable clock so pipeline timestamps are deterministic in tests. */
export interface Clock {
  now(): Date;
}

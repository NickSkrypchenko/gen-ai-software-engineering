import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decide } from '../../src/domain/compliance-rules';
import { scoreTransaction } from '../../src/domain/fraud-rules';
import { loadFxTable } from '../../src/domain/fx';
import type { Denylist, FxSnapshot, RawTransaction, RiskResult } from '../../src/types';

const ROOT = process.cwd();
const rates = loadFxTable(
  JSON.parse(readFileSync(join(ROOT, 'config', 'fx-rates.json'), 'utf8')) as FxSnapshot,
);
const denylist = JSON.parse(
  readFileSync(join(ROOT, 'config', 'denylist.json'), 'utf8'),
) as Denylist;

const readFixture = (name: string): RawTransaction =>
  JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', name), 'utf8')) as RawTransaction;

const lowRisk: RiskResult = {
  amount_usd_equivalent: '100.00',
  risk_score: 0.2,
  risk_band: 'low',
  matched_signals: [],
  status: 'scored',
};

const baseTx: RawTransaction = {
  transaction_id: 'T',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1000',
  destination_account: 'ACC-2000',
  amount: '100.00',
  currency: 'USD',
  transaction_type: 'transfer',
  metadata: { country: 'US' },
};

describe('decide (compliance policy)', () => {
  it('REJECTS on a denylisted destination account (masked), independent of low score', () => {
    const r = decide({ ...baseTx, destination_account: 'ACC-9999' }, lowRisk, denylist);
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toBe('DENYLIST_ACCOUNT:ACC-***9');
    expect(r.escalate).toBe(false);
  });

  it('REJECTS on a denylisted source account', () => {
    const r = decide({ ...baseTx, source_account: 'ACC-9999' }, lowRisk, denylist);
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toBe('DENYLIST_ACCOUNT:ACC-***9');
  });

  it('denylist beats a would-be HOLD score', () => {
    const highRisk: RiskResult = { ...lowRisk, risk_score: 0.5, risk_band: 'medium' };
    expect(decide({ ...baseTx, destination_account: 'ACC-9999' }, highRisk, denylist).decision).toBe(
      'REJECT',
    );
  });

  it('HOLDS when score ≥ 0.30 with escalate=false for a medium band', () => {
    const r = decide(baseTx, { ...lowRisk, risk_score: 0.4, risk_band: 'medium' }, denylist);
    expect(r.decision).toBe('HOLD');
    expect(r.escalate).toBe(false);
    expect(r.reason).toBe('RISK_HOLD');
  });

  it('APPROVES when score < 0.30 and no denylist hit', () => {
    const r = decide(baseTx, { ...lowRisk, risk_score: 0.2 }, denylist);
    expect(r.decision).toBe('APPROVE');
    expect(r.reason).toBe('CLEARED');
  });

  it('boundary: score exactly 0.30 → HOLD', () => {
    expect(decide(baseTx, { ...lowRisk, risk_score: 0.3, risk_band: 'medium' }, denylist).decision).toBe(
      'HOLD',
    );
  });

  // --- Synthetic fixtures (branches unreachable from the 8-record sample) ---

  it('FIXTURE escalate-high: high band (≥0.60) HOLD sets escalate=true', () => {
    const tx = readFixture('escalate-high.json');
    const risk = scoreTransaction(tx, rates);
    expect(risk.risk_band).toBe('high');
    expect(risk.risk_score).toBeGreaterThanOrEqual(0.6);
    const r = decide(tx, risk, denylist);
    expect(r.decision).toBe('HOLD');
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('HIGH_RISK_ESCALATE');
  });

  it('FIXTURE country-denylist: metadata.country on the denylist (IR) → REJECT', () => {
    const tx = readFixture('country-denylist.json');
    expect(tx.metadata?.country).toBe('IR');
    expect(denylist.countries).toContain('IR');
    const risk = scoreTransaction(tx, rates);
    const r = decide(tx, risk, denylist);
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toBe('DENYLIST_COUNTRY:IR');
  });
});

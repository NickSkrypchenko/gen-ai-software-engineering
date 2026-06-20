import { describe, expect, it } from 'vitest';
import { bandForHundredths, scoreTransaction } from '../../src/domain/fraud-rules';
import type { FxTable, RawTransaction } from '../../src/types';

const rates: FxTable = { USD: '1.00', EUR: '1.08', GBP: '1.27', JPY: '0.0067', CHF: '1.12', CAD: '0.73', AUD: '0.66' };

const tx = (over: Partial<RawTransaction>): RawTransaction => ({
  transaction_id: 'T',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1',
  destination_account: 'ACC-2',
  amount: '100.00',
  currency: 'USD',
  transaction_type: 'transfer',
  metadata: { country: 'US' },
  ...over,
});

describe('scoreTransaction (additive risk)', () => {
  it('clean domestic USD transfer scores 0', () => {
    const r = scoreTransaction(tx({}), rates);
    expect(r.risk_score).toBe(0);
    expect(r.risk_band).toBe('low');
    expect(r.matched_signals).toEqual([]);
    expect(r.status).toBe('scored');
  });

  it('high value (>$10k) adds 0.40', () => {
    const r = scoreTransaction(tx({ amount: '25000.00' }), rates);
    expect(r.risk_score).toBe(0.4);
    expect(r.matched_signals).toContain('HIGH_VALUE');
  });

  it('near-threshold ($9000–9999.99) adds 0.20 and excludes high-value', () => {
    const r = scoreTransaction(tx({ amount: '9999.99' }), rates);
    expect(r.risk_score).toBe(0.2);
    expect(r.matched_signals).toEqual(['NEAR_THRESHOLD']);
  });

  it('off-hours (UTC 0–5) adds 0.20', () => {
    const r = scoreTransaction(tx({ timestamp: '2026-03-16T02:47:00Z' }), rates);
    expect(r.matched_signals).toContain('OFF_HOURS');
  });

  it('cross-border by non-USD currency adds 0.20 (with FX normalization)', () => {
    const r = scoreTransaction(tx({ amount: '500.00', currency: 'EUR', metadata: { country: 'DE' }, timestamp: '2026-03-16T02:47:00Z' }), rates);
    expect(r.amount_usd_equivalent).toBe('540.00');
    expect(r.matched_signals).toEqual(['OFF_HOURS', 'CROSS_BORDER']);
    expect(r.risk_score).toBe(0.4);
  });

  it('cross-border by non-US country adds 0.20 even for USD', () => {
    const r = scoreTransaction(tx({ currency: 'USD', metadata: { country: 'GB' } }), rates);
    expect(r.matched_signals).toContain('CROSS_BORDER');
  });

  it('wire adds 0.10 and stacks with high value (0.50)', () => {
    const r = scoreTransaction(tx({ amount: '25000.00', transaction_type: 'wire_transfer' }), rates);
    expect(r.risk_score).toBe(0.5);
    expect(r.matched_signals).toEqual(['HIGH_VALUE', 'WIRE']);
  });

  it('caps the score at 1.0', () => {
    const r = scoreTransaction(
      tx({ amount: '99999.00', currency: 'EUR', metadata: { country: 'DE' }, timestamp: '2026-03-16T03:00:00Z', transaction_type: 'wire_transfer' }),
      rates,
    );
    // 0.40 + 0.20 + 0.20 + 0.10 = 0.90 → still ≤ 1.0
    expect(r.risk_score).toBeLessThanOrEqual(1);
    expect(r.risk_score).toBe(0.9);
  });
});

describe('bandForHundredths', () => {
  it.each([
    [0, 'low'],
    [29, 'low'],
    [30, 'medium'],
    [59, 'medium'],
    [60, 'high'],
    [100, 'high'],
  ] as const)('band(%i) === %s', (h, band) => {
    expect(bandForHundredths(h)).toBe(band);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  formatReport,
  runValidatorCli,
  validateAll,
} from '../../src/agents/transaction-validator';
import { formatRisk, runFraudCli, scoreFromFiles } from '../../src/agents/fraud-detector';
import {
  decideFromFiles,
  formatDecision,
  runComplianceCli,
} from '../../src/agents/compliance-checker';
import type { RawTransaction } from '../../src/types';

const ROOT = process.cwd();
const sample = JSON.parse(
  readFileSync(join(ROOT, 'sample-transactions.json'), 'utf8'),
) as RawTransaction[];
const escalateFixture = join(ROOT, 'tests', 'fixtures', 'escalate-high.json');
const countryFixture = join(ROOT, 'tests', 'fixtures', 'country-denylist.json');
const fxPath = join(ROOT, 'config', 'fx-rates.json');
const denylistPath = join(ROOT, 'config', 'denylist.json');

describe('transaction-validator CLI wrapper', () => {
  it('validateAll tallies the 8-record sample (6 valid, 2 invalid)', () => {
    const report = validateAll(sample);
    expect(report.total).toBe(8);
    expect(report.valid).toBe(6);
    expect(report.invalid).toBe(2);
  });

  it('formatReport renders a table with a header and reasons', () => {
    const text = formatReport(validateAll(sample));
    expect(text).toContain('Valid: 6');
    expect(text).toContain('INVALID_CURRENCY:XYZ');
    expect(text).toContain('NON_POSITIVE_AMOUNT');
  });

  it('runValidatorCli --dry-run reads the sample and writes a dry-run report', () => {
    const write = vi.fn();
    const report = runValidatorCli(['--dry-run'], ROOT, write);
    expect(report.invalid).toBe(2);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain('(dry-run)');
  });
});

describe('fraud-detector CLI wrapper', () => {
  it('scoreFromFiles scores the high-band fixture ≥ 0.60', () => {
    const risk = scoreFromFiles(escalateFixture, fxPath);
    expect(risk.risk_band).toBe('high');
    expect(risk.risk_score).toBeGreaterThanOrEqual(0.6);
  });

  it('formatRisk renders the rule trail', () => {
    const risk = scoreFromFiles(escalateFixture, fxPath);
    expect(formatRisk('FIX', risk)).toContain('score=');
    expect(formatRisk('FIX', risk)).toContain('HIGH_VALUE');
  });

  it('runFraudCli writes a line and returns the risk', () => {
    const write = vi.fn();
    const risk = runFraudCli([escalateFixture], ROOT, write);
    expect(risk.status).toBe('scored');
    expect(write).toHaveBeenCalledOnce();
  });

  it('runFraudCli throws on missing argument', () => {
    expect(() => runFraudCli([], ROOT, vi.fn())).toThrow(/usage/);
  });
});

describe('compliance-checker CLI wrapper', () => {
  it('decideFromFiles REJECTS the denylisted-country fixture', () => {
    const r = decideFromFiles(countryFixture, fxPath, denylistPath);
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toBe('DENYLIST_COUNTRY:IR');
  });

  it('formatDecision flags an escalated HOLD', () => {
    const r = decideFromFiles(escalateFixture, fxPath, denylistPath);
    expect(r.decision).toBe('HOLD');
    expect(formatDecision('FIX', r)).toContain('[ESCALATE]');
  });

  it('runComplianceCli writes a line and returns the decision', () => {
    const write = vi.fn();
    const r = runComplianceCli([countryFixture], ROOT, write);
    expect(r.decision).toBe('REJECT');
    expect(write).toHaveBeenCalledOnce();
  });

  it('runComplianceCli throws on missing argument', () => {
    expect(() => runComplianceCli([], ROOT, vi.fn())).toThrow(/usage/);
  });
});

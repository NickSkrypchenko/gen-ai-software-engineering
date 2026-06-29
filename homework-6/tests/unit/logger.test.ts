import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAuditLogger, maskAccount, maskPii } from '../../src/lib/logger';
import { FixedClock } from '../../src/integrator';

describe('maskAccount', () => {
  it.each([
    ['ACC-1001', 'ACC-***1'],
    ['ACC-9999', 'ACC-***9'],
    ['ACC-5500', 'ACC-***0'],
  ])('masks %s → %s', (input, expected) => {
    expect(maskAccount(input)).toBe(expected);
  });

  it('falls back to last-char masking for non-ACC tokens', () => {
    expect(maskAccount('IBAN1234')).toBe('***4');
  });

  it('returns empty string unchanged', () => {
    expect(maskAccount('')).toBe('');
  });
});

describe('maskPii', () => {
  it('masks every ACC- token embedded in text', () => {
    expect(maskPii('from ACC-1001 to ACC-2002')).toBe('from ACC-***1 to ACC-***2');
  });
});

describe('createAuditLogger', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'audit-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('appends one masked tab-separated line per hop with a clock timestamp', () => {
    const file = join(dir, 'audit.log');
    const clock = new FixedClock(new Date('2026-03-16T10:00:00Z'));
    const logger = createAuditLogger(file, clock);
    logger.log({ hop: 'validate', agent: 'transaction_validator', transaction_id: 'T1', outcome: 'validated' });
    logger.log({ hop: 'decide', agent: 'compliance_checker', transaction_id: 'T2', outcome: 'REJECT ACC-9999' });

    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('2026-03-16T10:00:00.000Z\tvalidate\ttransaction_validator\tT1\tvalidated');
    // PII masked in the outcome:
    expect(lines[1]).toContain('ACC-***9');
    expect(lines[1]).not.toContain('ACC-9999');
  });
});

import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  FixedClock,
  defaultOptions,
  main,
  runPipeline,
} from '../../src/integrator';
import { listResultFiles, readJson, resolveSharedDirs } from '../../src/lib/shared-dirs';
import type { Decision, PipelineSummary, TransactionResult } from '../../src/types';

/** The Golden results table — the contract the integration test enforces, per-transaction. */
const GOLDEN: Record<string, { decision: Decision; risk: number | null }> = {
  TXN001: { decision: 'APPROVE', risk: 0 },
  TXN002: { decision: 'HOLD', risk: 0.5 },
  TXN003: { decision: 'REJECT', risk: 0.2 },
  TXN004: { decision: 'HOLD', risk: 0.4 },
  TXN005: { decision: 'HOLD', risk: 0.5 },
  TXN006: { decision: 'REJECTED_VALIDATION', risk: null },
  TXN007: { decision: 'REJECTED_VALIDATION', risk: null },
  TXN008: { decision: 'APPROVE', risk: 0 },
};

const PROJECT_ROOT = process.cwd();

/** Build an isolated temp project root with sample + config (never touches the real shared/). */
function makeTempProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-'));
  cpSync(join(PROJECT_ROOT, 'sample-transactions.json'), join(root, 'sample-transactions.json'));
  cpSync(join(PROJECT_ROOT, 'config'), join(root, 'config'), { recursive: true });
  return root;
}

describe('full pipeline integration (Golden results)', () => {
  let root: string;
  let summary: PipelineSummary;

  beforeAll(() => {
    root = makeTempProject();
    const dirs = resolveSharedDirs(join(root, 'shared'));
    summary = runPipeline(new FixedClock(new Date('2026-03-16T12:00:00Z')), dirs, defaultOptions(root));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('processes all 8 transactions to shared/results/', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    expect(listResultFiles(dirs)).toHaveLength(8);
    expect(summary.total).toBe(8);
  });

  it.each(Object.entries(GOLDEN))('%s → exact Golden decision + risk', (id, expected) => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    const result = readJson<TransactionResult>(join(dirs.results, `${id}.result.json`));
    expect(result.decision).toBe(expected.decision);
    expect(result.risk_score).toBe(expected.risk);
    expect(result.escalate).toBe(false); // no sample row reaches the high band
  });

  it('summary tally is 2 APPROVE · 3 HOLD · 1 REJECT · 2 REJECTED_VALIDATION', () => {
    expect(summary.counts).toEqual({
      APPROVE: 2,
      HOLD: 3,
      REJECT: 1,
      REJECTED_VALIDATION: 2,
    });
  });

  it('TXN003 REJECT carries a masked denylist reason (no raw account)', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    const r = readJson<TransactionResult>(join(dirs.results, 'TXN003.result.json'));
    expect(r.reason).toBe('DENYLIST_ACCOUNT:ACC-***9');
  });

  it('writes an append-only audit log: one line per hop, PII masked', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    const log = readFileSync(join(dirs.results, 'audit.log'), 'utf8').trim().split('\n');
    // 6 valid txns × 3 hops + 2 rejected × 1 validate hop = 20 lines.
    expect(log).toHaveLength(20);
    expect(log.every((l) => l.split('\t').length === 5)).toBe(true);
    expect(log.join('\n')).not.toMatch(/ACC-\d{4}/); // no raw account numbers
  });

  it('is deterministic: a second run yields identical outcomes (modulo the random UUID)', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    const stripId = (r: TransactionResult) => ({ ...r, envelope: { ...r.envelope, message_id: '' } });
    const before = stripId(readJson<TransactionResult>(join(dirs.results, 'TXN002.result.json')));
    runPipeline(new FixedClock(new Date('2026-03-16T12:00:00Z')), dirs, defaultOptions(root));
    const after = stripId(readJson<TransactionResult>(join(dirs.results, 'TXN002.result.json')));
    expect(after).toEqual(before);
  });
});

describe('main() CLI entry (against a temp project root, not the real shared/)', () => {
  it('runs the pipeline from cwd and prints a summary line', () => {
    const root = makeTempProject();
    const prevCwd = process.cwd();
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk));
      return true;
    });
    try {
      process.chdir(root);
      main();
    } finally {
      write.mockRestore();
      process.chdir(prevCwd);
    }
    const printed = chunks.join('');
    expect(printed).toContain('8 transactions processed');
    expect(printed).toContain('APPROVE: 2');
    rmSync(root, { recursive: true, force: true });
  });
});

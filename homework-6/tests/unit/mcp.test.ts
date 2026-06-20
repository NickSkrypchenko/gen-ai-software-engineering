import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildServer,
  getTransactionStatus,
  listPipelineResults,
  readSummaryText,
} from '../../mcp/server';
import { FixedClock, defaultOptions, runPipeline } from '../../src/integrator';
import { resolveSharedDirs } from '../../src/lib/shared-dirs';

const PROJECT_ROOT = process.cwd();

describe('pipeline-status MCP data functions', () => {
  let root: string;
  let resultsDir: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'mcp-'));
    cpSync(join(PROJECT_ROOT, 'sample-transactions.json'), join(root, 'sample-transactions.json'));
    cpSync(join(PROJECT_ROOT, 'config'), join(root, 'config'), { recursive: true });
    const dirs = resolveSharedDirs(join(root, 'shared'));
    runPipeline(new FixedClock(new Date('2026-03-16T12:00:00Z')), dirs, defaultOptions(root));
    resultsDir = dirs.results;
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('get_transaction_status returns the decision for a known id', () => {
    const s = getTransactionStatus(resultsDir, 'TXN003');
    expect(s.found).toBe(true);
    expect(s.decision).toBe('REJECT');
    expect(s.reason).toBe('DENYLIST_ACCOUNT:ACC-***9');
  });

  it('get_transaction_status reports not-found for an unknown id', () => {
    expect(getTransactionStatus(resultsDir, 'NOPE').found).toBe(false);
  });

  it('list_pipeline_results tallies all 8 results', () => {
    const summary = listPipelineResults(resultsDir);
    expect(summary.total).toBe(8);
    expect(summary.counts).toEqual({ APPROVE: 2, HOLD: 3, REJECT: 1, REJECTED_VALIDATION: 2 });
  });

  it('pipeline://summary text is the run summary JSON', () => {
    const text = readSummaryText(resultsDir);
    expect(JSON.parse(text).total).toBe(8);
  });

  it('readSummaryText reports a clear message when no run exists', () => {
    const empty = mkdtempSync(join(tmpdir(), 'mcp-empty-'));
    expect(readSummaryText(empty)).toMatch(/No pipeline run found/);
    rmSync(empty, { recursive: true, force: true });
  });

  it('buildServer wires a named FastMCP server', () => {
    const server = buildServer(resultsDir);
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
  });
});

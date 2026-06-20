/**
 * pipeline-status — custom fastmcp server exposing a finished pipeline run.
 *
 * Reads the real `shared/results/` snapshot (no LLM, no network):
 *   tool      get_transaction_status(transaction_id) → status of one transaction
 *   tool      list_pipeline_results()                → all results + tally
 *   resource  pipeline://summary                      → latest run summary (text)
 *
 * Launched via `npx tsx mcp/server.ts` (bare `node` cannot run `.ts`); wired in `mcp.json`.
 * The data-access functions are exported and pure (dir in → value out) so they are unit-tested;
 * only the server bootstrap is excluded from coverage.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

import { listResultFilesIn, readJson, resolveSharedDirs } from '../src/lib/shared-dirs.js';
import type { Decision, PipelineSummary, TransactionResult } from '../src/types.js';

export interface TransactionStatus {
  transaction_id: string;
  found: boolean;
  decision?: Decision;
  reason?: string;
  risk_score?: number | null;
  risk_band?: string | null;
  escalate?: boolean;
  amount_usd_equivalent?: string | null;
}

export interface PipelineResultsSummary {
  total: number;
  counts: Record<Decision, number>;
  results: Array<{
    transaction_id: string;
    decision: Decision;
    risk_score: number | null;
    escalate: boolean;
  }>;
}

const emptyCounts = (): Record<Decision, number> => ({
  APPROVE: 0,
  HOLD: 0,
  REJECT: 0,
  REJECTED_VALIDATION: 0,
});

/** Safe single path segment — blocks `../` traversal via the tool parameter. */
const SAFE_TRANSACTION_ID = /^[A-Za-z0-9_-]+$/;

/** Status of a single transaction from `shared/results/<id>.result.json`. */
export function getTransactionStatus(resultsDir: string, transactionId: string): TransactionStatus {
  if (!SAFE_TRANSACTION_ID.test(transactionId)) {
    return { transaction_id: transactionId, found: false };
  }
  const file = join(resultsDir, `${transactionId}.result.json`);
  if (!existsSync(file)) {
    return { transaction_id: transactionId, found: false };
  }
  const r = readJson<TransactionResult>(file);
  return {
    transaction_id: r.transaction_id,
    found: true,
    decision: r.decision,
    reason: r.reason,
    risk_score: r.risk_score,
    risk_band: r.risk_band,
    escalate: r.escalate,
    amount_usd_equivalent: r.amount_usd_equivalent,
  };
}

/** All per-transaction results plus a tally, read from `shared/results/`. */
export function listPipelineResults(resultsDir: string): PipelineResultsSummary {
  const counts = emptyCounts();
  const results: PipelineResultsSummary['results'] = [];
  for (const name of listResultFilesIn(resultsDir)) {
    const r = readJson<TransactionResult>(join(resultsDir, name));
    counts[r.decision] += 1;
    results.push({
      transaction_id: r.transaction_id,
      decision: r.decision,
      risk_score: r.risk_score,
      escalate: r.escalate,
    });
  }
  return { total: results.length, counts, results };
}

/** Latest run summary as pretty text (or a clear message if no run exists yet). */
export function readSummaryText(resultsDir: string): string {
  const file = join(resultsDir, 'pipeline-summary.json');
  if (!existsSync(file)) {
    return 'No pipeline run found. Run `npm run pipeline` to generate shared/results/.';
  }
  const summary = readJson<PipelineSummary>(file);
  return JSON.stringify(summary, null, 2);
}

/** Build a configured FastMCP server bound to `resultsDir`. */
export function buildServer(resultsDir: string): FastMCP {
  const server = new FastMCP({ name: 'pipeline-status', version: '1.0.0' });

  server.addTool({
    name: 'get_transaction_status',
    description: 'Get the final pipeline status of one transaction by its transaction_id.',
    parameters: z.object({
      transaction_id: z.string().describe('e.g. TXN001'),
    }),
    execute: async ({ transaction_id }) =>
      JSON.stringify(getTransactionStatus(resultsDir, transaction_id), null, 2),
  });

  server.addTool({
    name: 'list_pipeline_results',
    description: 'List every processed transaction with its decision, plus a per-decision tally.',
    parameters: z.object({}),
    execute: async () => JSON.stringify(listPipelineResults(resultsDir), null, 2),
  });

  server.addResource({
    uri: 'pipeline://summary',
    name: 'Pipeline run summary',
    mimeType: 'application/json',
    load: async () => ({ text: readSummaryText(resultsDir) }),
  });

  return server;
}

/* v8 ignore start -- server bootstrap, exercised only when launched as a process */
function main(): void {
  const resultsDir = resolveSharedDirs(join(process.cwd(), 'shared')).results;
  const server = buildServer(resultsDir);
  void server.start({ transportType: 'stdio' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
/* v8 ignore stop */

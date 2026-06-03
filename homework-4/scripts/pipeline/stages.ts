import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runAgent, spawnClaude } from './claude-runner';
import { buildUserMessage } from './messages';
import { logger } from './logger';
import type { RunCtx, RunResult, AgentSpec } from './types';

export type SpawnFn = typeof spawnClaude;

function runTests(): string {
  try {
    return execFileSync('npx', ['vitest', 'run', 'tests/'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (e: any) {
    return (e.stdout?.toString() ?? '') + '\n' + (e.stderr?.toString() ?? '');
  }
}

function gitDiffNames(scope: string): string[] {
  return execFileSync('git', ['diff', '--name-only', 'HEAD', '--', scope], {
    encoding: 'utf-8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
}

export async function runStages(ctx: RunCtx, spawn: SpawnFn = spawnClaude): Promise<RunResult> {
  const { bugId, agents, skills, bugDir } = ctx;
  const failures: string[] = [];

  async function runStage(agentName: string, userMsg: string, outputPath: string): Promise<void> {
    const spec = agents.get(agentName) as AgentSpec;
    logger.info({ agent: agentName, model: spec.model }, 'starting');
    try {
      const { text, durationMs } = await runAgent(spec, skills, userMsg, spawn);
      await fs.mkdir(`${bugDir}/${outputPath.split('/').slice(0, -1).join('/')}`, { recursive: true });
      await fs.writeFile(`${bugDir}/${outputPath}`, text, 'utf-8');
      logger.info({ agent: agentName, durationMs }, 'done');
    } catch (e: any) {
      logger.error({ agent: agentName, err: e.message }, 'FAILED');
      failures.push(agentName);
      throw e;
    }
  }

  const bugContext = await fs.readFile(`${bugDir}/bug-context.md`, 'utf-8');

  // Stage 1 — Researcher
  await runStage(
    'researcher',
    buildUserMessage([{ type: 'bug-context', content: bugContext }]),
    'research/codebase-research.md',
  );

  // Stage 2 — Research Verifier
  const codebaseResearch = await fs.readFile(`${bugDir}/research/codebase-research.md`, 'utf-8');
  await runStage(
    'research-verifier',
    buildUserMessage([
      { type: 'bug-context',       content: bugContext },
      { type: 'codebase-research', content: codebaseResearch },
    ]),
    'research/verified-research.md',
  );

  // Stage 3 — Planner
  const verifiedResearch = await fs.readFile(`${bugDir}/research/verified-research.md`, 'utf-8');
  await runStage(
    'planner',
    buildUserMessage([
      { type: 'bug-context',       content: bugContext },
      { type: 'verified-research', content: verifiedResearch },
    ]),
    'implementation-plan.md',
  );

  // Stage 4 — Bug Fixer
  const plan = await fs.readFile(`${bugDir}/implementation-plan.md`, 'utf-8');
  await runStage(
    'bug-fixer',
    buildUserMessage([{ type: 'implementation-plan', content: plan }]),
    'fix-summary.md',
  );

  // 4a — Orchestrator runs tests (deterministic)
  const testResult = runTests();
  await fs.appendFile(
    `${bugDir}/fix-summary.md`,
    `\n\n## Test Results (orchestrator-recorded)\n\`\`\`\n${testResult}\n\`\`\`\n`,
  );

  // Build shared context for parallel stages
  const fixSummary = await fs.readFile(`${bugDir}/fix-summary.md`, 'utf-8');
  const changedFiles = gitDiffNames('src/');
  const changedParts = await Promise.all(
    changedFiles.map(async f => ({
      type: 'changed-file',
      name: f,
      content: await fs.readFile(f, 'utf-8'),
    })),
  );
  const msgForReviewers = buildUserMessage([
    { type: 'fix-summary', content: fixSummary },
    ...changedParts,
  ]);

  // Stages 5 & 6 — parallel via allSettled (partial-failure isolation)
  const [secRes, testRes] = await Promise.allSettled([
    runStage('security-verifier',    msgForReviewers, 'security-report.md'),
    runStage('unit-test-generator',  msgForReviewers, 'test-report.md'),
  ]);
  if (secRes.status  === 'rejected') logger.error({ err: secRes.reason  }, 'security-verifier failed');
  if (testRes.status === 'rejected') logger.error({ err: testRes.reason }, 'unit-test-generator failed');

  // 6a — Re-run tests to capture generated ones
  const finalTests = runTests();
  await fs.appendFile(
    `${bugDir}/test-report.md`,
    `\n\n## Final Test Run (orchestrator-recorded)\n\`\`\`\n${finalTests}\n\`\`\`\n`,
  ).catch(() => {
    // test-report.md may not exist if unit-test-generator failed
  });

  return {
    summary: { bugId, stagesRun: 6, failures },
    failures,
  };
}

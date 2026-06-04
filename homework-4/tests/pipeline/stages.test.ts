import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { AgentSpec } from '../../scripts/pipeline/types';

// Mock logger to silence output during tests
vi.mock('../../scripts/pipeline/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock execFileSync (used for git diff and npx vitest)
vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execFileSync: vi.fn((cmd: string) => {
      if (cmd === 'git') return '';        // no changed files
      if (cmd === 'npx') return 'Tests passed\n';
      return '';
    }),
  };
});

import { runStages } from '../../scripts/pipeline/stages';

function makeAgent(name: string, overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    name,
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    tools: [],
    skills: [],
    role: name,
    inputs: [],
    outputs: [],
    model_justification: 'test',
    prompt: `You are ${name}.`,
    ...overrides,
  };
}

const AGENT_NAMES = [
  'researcher', 'research-verifier', 'planner', 'bug-fixer',
  'security-verifier', 'unit-test-generator',
];

function makeAgents(responseMap: Record<string, string>) {
  const agents = new Map<string, AgentSpec>();
  for (const name of AGENT_NAMES) {
    agents.set(name, makeAgent(name));
  }
  return agents;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'hw4-stages-'));
  mkdirSync(path.join(tmpDir, 'research'), { recursive: true });
  writeFileSync(path.join(tmpDir, 'bug-context.md'), '# Bug\nSymptom: broken.\n');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

const NO_SKILLS = new Map<string, string>();

describe('runStages', () => {
  test('happy path: all 6 agents produce artifacts', async () => {
    let call = 0;
    const responses = [
      '# Codebase Research\nFound it.',
      '# Verified Research\nL3 Solid.',
      '# Implementation Plan\nChange line 5.',
      '# Fix Summary\nApplied edit.',
      '# Security Report\nNo critical issues.',
      '# Test Report\nGenerated 3 tests.',
    ];
    const spawn = vi.fn().mockImplementation(async () => ({
      stdout: responses[call++] ?? '# Done',
      stderr: '',
    }));

    const result = await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    expect(spawn).toHaveBeenCalledTimes(6);
    expect(result.failures).toHaveLength(0);
    expect(existsSync(path.join(tmpDir, 'research/codebase-research.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'research/verified-research.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'implementation-plan.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'fix-summary.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'security-report.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'test-report.md'))).toBe(true);
  });

  test('fix-summary.md gets test results appended by orchestrator', async () => {
    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => ({
      stdout: ['# Research', '# Verified', '# Plan', '# Fix Summary', '# Security', '# Tests'][call++],
      stderr: '',
    }));

    await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    const fixSummary = readFileSync(path.join(tmpDir, 'fix-summary.md'), 'utf-8');
    expect(fixSummary).toContain('## Test Results (orchestrator-recorded)');
  });

  test('stage 2 failure stops pipeline (sequential propagation)', async () => {
    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => {
      const idx = call++;
      if (idx === 1) throw new Error('stage 2 error');
      return { stdout: `# Stage ${idx}`, stderr: '' };
    });

    await expect(
      runStages(
        { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
        spawn,
      ),
    ).rejects.toThrow('stage 2 error');

    // Only 2 calls made (researcher + research-verifier)
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(existsSync(path.join(tmpDir, 'research/codebase-research.md'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'research/verified-research.md'))).toBe(false);
  });

  test('allSettled: security-verifier failure does not block unit-test-generator', async () => {
    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => {
      const idx = call++;
      if (idx === 4) {
        const err = new Error('security agent failed');
        throw err;
      }
      return { stdout: `# Stage ${idx}`, stderr: '' };
    });

    const result = await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    expect(result.failures).toContain('security-verifier');
    expect(existsSync(path.join(tmpDir, 'security-report.md'))).toBe(false);
    expect(existsSync(path.join(tmpDir, 'test-report.md'))).toBe(true);
  });

  test('runTests catch branch: npx failure output captured in fix-summary', async () => {
    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === 'git') return '' as any;
      if (cmd === 'npx') {
        const e: any = new Error('tests failed');
        e.stdout = 'FAIL some.test.ts\n';
        e.stderr = undefined;   // covers the ?? '' branch on stderr
        throw e;
      }
      return '' as any;
    });

    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => ({
      stdout: ['# Research', '# Verified', '# Plan', '# Fix', '# Security', '# Tests'][call++],
      stderr: '',
    }));

    await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    const fixSummary = readFileSync(path.join(tmpDir, 'fix-summary.md'), 'utf-8');
    expect(fixSummary).toContain('FAIL some.test.ts');
  });

  test('both parallel stages fail: test-report appendFile catch silently swallowed', async () => {
    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => {
      const idx = call++;
      if (idx >= 4) throw new Error(`stage ${idx} failed`);  // both security + testgen fail
      return { stdout: `# Stage ${idx}`, stderr: '' };
    });

    const result = await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    expect(result.failures).toContain('security-verifier');
    expect(result.failures).toContain('unit-test-generator');
    // appendFile creates test-report.md even when agent failed (orchestrator appends final run)
    expect(result.failures).toHaveLength(2);
  });

  test('changed files branch: git diff returns file path read into context', async () => {
    // Write a src file that git diff "reports" as changed
    const srcFile = path.join(tmpDir, 'src/jwt/verifier.ts');
    mkdirSync(path.join(tmpDir, 'src/jwt'), { recursive: true });
    writeFileSync(srcFile, 'export function verifyToken() {}');

    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === 'git') return `${srcFile}\n` as any;
      if (cmd === 'npx') return 'Tests passed\n' as any;
      return '' as any;
    });

    let call = 0;
    const spawn = vi.fn().mockImplementation(async () => ({
      stdout: ['# Research', '# Verified', '# Plan', '# Fix', '# Security', '# Tests'][call++],
      stderr: '',
    }));

    await runStages(
      { bugId: 'test-bug', agents: makeAgents({}), skills: NO_SKILLS, bugDir: tmpDir },
      spawn,
    );

    // security-verifier and unit-test-generator calls include changed-file content
    const calls = spawn.mock.calls;
    const reviewMsg = calls[4][1] as string;  // 5th call (security-verifier), 2nd arg is userMessage
    expect(reviewMsg).toContain('changed-file');
  });
});

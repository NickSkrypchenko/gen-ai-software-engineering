import { describe, test, expect, vi } from 'vitest';
import { runAgent, buildSystemPrompt } from '../../scripts/pipeline/claude-runner';
import type { AgentSpec } from '../../scripts/pipeline/types';

const BASE_SPEC: AgentSpec = {
  name:                'test-agent',
  model:               'claude-sonnet-4-6',
  max_tokens:          8192,
  tools:               ['Read', 'Grep'],
  skills:              [],
  role:                'Test',
  inputs:              [],
  outputs:             [],
  model_justification: 'Test',
  prompt:              'You are a test agent.',
};

const NO_SKILLS = new Map<string, string>();

describe('buildSystemPrompt', () => {
  test('returns agent prompt when no skills', () => {
    expect(buildSystemPrompt(BASE_SPEC, NO_SKILLS)).toBe('You are a test agent.');
  });

  test('injects skill as XML block after prompt', () => {
    const skills = new Map([['my-skill', '# Skill Content']]);
    const spec = { ...BASE_SPEC, skills: ['my-skill'] };
    const result = buildSystemPrompt(spec, skills);
    expect(result).toContain('<skill name="my-skill">');
    expect(result).toContain('# Skill Content');
    expect(result).toContain('</skill>');
  });

  test('throws when referenced skill not in map', () => {
    const spec = { ...BASE_SPEC, skills: ['missing'] };
    expect(() => buildSystemPrompt(spec, NO_SKILLS))
      .toThrow('references unknown skill: missing');
  });
});

describe('runAgent — subprocess behaviour (spawn injected)', () => {
  test('returns trimmed stdout text on success', async () => {
    const spawn = vi.fn().mockResolvedValue({ stdout: '  # Research\nFound bug  ', stderr: '' });
    const result = await runAgent(BASE_SPEC, NO_SKILLS, 'hello', spawn);
    expect(result.text).toBe('# Research\nFound bug');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(spawn).toHaveBeenCalledOnce();
  });

  test('throws friendly error on ENOENT (claude not installed)', async () => {
    const err: any = new Error('spawn ENOENT');
    err.code = 'ENOENT';
    const spawn = vi.fn().mockRejectedValue(err);
    await expect(runAgent(BASE_SPEC, NO_SKILLS, 'hi', spawn)).rejects.toThrow('claude CLI not found');
  });

  test('throws timeout error on SIGTERM', async () => {
    const err: any = new Error('killed');
    err.killed = true;
    err.signal = 'SIGTERM';
    const spawn = vi.fn().mockRejectedValue(err);
    await expect(runAgent(BASE_SPEC, NO_SKILLS, 'hi', spawn)).rejects.toThrow('exceeded');
  });

  test('throws on empty stdout', async () => {
    const spawn = vi.fn().mockResolvedValue({ stdout: '   ', stderr: '' });
    await expect(runAgent(BASE_SPEC, NO_SKILLS, 'hi', spawn)).rejects.toThrow('empty output');
  });

  test('passes --allowedTools none when tools list is empty', async () => {
    const noToolsSpec = { ...BASE_SPEC, tools: [] as any };
    const spawn = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' });
    await runAgent(noToolsSpec, NO_SKILLS, 'hi', spawn);
    const [args] = spawn.mock.calls[0] as [string[], string];
    const idx = args.indexOf('--allowedTools');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('none');
  });
});

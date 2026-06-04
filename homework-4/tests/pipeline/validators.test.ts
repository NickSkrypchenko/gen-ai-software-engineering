import { describe, test, expect, vi } from 'vitest';
import { validateAgentSkillRefs, checkSystemDependencies } from '../../scripts/pipeline/validators';
import type { AgentSpec } from '../../scripts/pipeline/types';

function makeAgent(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    name:                'test-agent',
    model:               'claude-sonnet-4-6',
    max_tokens:          8192,
    tools:               [],
    skills:              [],
    role:                'Test role',
    inputs:              [],
    outputs:             [],
    model_justification: 'Test',
    prompt:              'You are a test agent.',
    ...overrides,
  };
}

describe('validateAgentSkillRefs', () => {
  test('passes when all agent skill refs are present in skills map', () => {
    const skills = new Map([['my-skill', '# Skill content']]);
    const agents = new Map([['agent', makeAgent({ skills: ['my-skill'] })]]);
    expect(() => validateAgentSkillRefs(agents, skills)).not.toThrow();
  });

  test('throws when agent references a skill not in skills map', () => {
    const skills = new Map<string, string>();
    const agents = new Map([['agent', makeAgent({ skills: ['missing-skill'] })]]);
    expect(() => validateAgentSkillRefs(agents, skills))
      .toThrow('references unknown skill: "missing-skill"');
  });

  test('passes with empty agents map (nothing to validate)', () => {
    const skills = new Map<string, string>();
    const agents = new Map<string, AgentSpec>();
    expect(() => validateAgentSkillRefs(agents, skills)).not.toThrow();
  });

  test('error message lists available skills', () => {
    const skills = new Map([['actual-skill', '']]);
    const agents = new Map([['agent', makeAgent({ skills: ['wrong-skill'] })]]);
    expect(() => validateAgentSkillRefs(agents, skills))
      .toThrow('actual-skill');
  });
});

describe('checkSystemDependencies', () => {
  test('does not exit when called with no args in real environment (claude+git+npx on PATH)', () => {
    // This calls the real `which` against the actual PATH — passes because claude, git, npx exist.
    expect(() => checkSystemDependencies()).not.toThrow();
  });

  test('does not exit when all deps found (injected)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const which = vi.fn();
    checkSystemDependencies(which);
    expect(which).toHaveBeenCalledWith('claude');
    expect(which).toHaveBeenCalledWith('git');
    expect(which).toHaveBeenCalledWith('npx');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('exits with code 2 when a dep is missing (injected)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const which = vi.fn().mockImplementation((dep: string) => {
      if (dep === 'claude') throw new Error('not found');
    });
    checkSystemDependencies(which);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('claude'));
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

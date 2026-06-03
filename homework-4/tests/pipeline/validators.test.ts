import { describe, test, expect, vi, afterEach } from 'vitest';
import { validateAgentSkillRefs } from '../../scripts/pipeline/validators';
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

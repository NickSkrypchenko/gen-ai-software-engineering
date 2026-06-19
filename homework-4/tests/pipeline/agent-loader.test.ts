import { describe, test, expect } from 'vitest';
import { loadAllAgents, AgentSpecSchema, MODELS, TOOLS } from '../../scripts/pipeline/agent-loader';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FIXTURES = path.join(__dirname, 'fixtures/agents');

describe('loadAllAgents', () => {
  test('returns empty map when dir has no .agent.md files', async () => {
    const agents = await loadAllAgents(path.join(__dirname, 'fixtures/skills'));
    expect(agents.size).toBe(0);
  });

  test('returns empty map when dir does not exist', async () => {
    const agents = await loadAllAgents('/nonexistent-dir-xyz-hw4');
    expect(agents.size).toBe(0);
  });

  test('loads valid agent and keys it by name', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'hw4-agents-'));
    writeFileSync(path.join(dir, 'my-agent.agent.md'), [
      '---',
      'name: my-agent',
      'model: claude-sonnet-4-6',
      'tools: []',
      'skills: []',
      'role: A test agent.',
      'inputs: []',
      'outputs: []',
      'model_justification: Routine work.',
      '---',
      '',
      'You are a test agent.',
    ].join('\n'));
    const agents = await loadAllAgents(dir);
    expect(agents.has('my-agent')).toBe(true);
    expect(agents.get('my-agent')?.prompt).toBe('You are a test agent.');
    rmSync(dir, { recursive: true });
  });

  test('throws on invalid model ID in agent file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'hw4-agents-'));
    writeFileSync(path.join(dir, 'bad.agent.md'), [
      '---',
      'name: bad-agent',
      'model: claude-opus-4-6',
      'tools: []',
      'skills: []',
      'role: Agent with invalid model.',
      'inputs: []',
      'outputs: []',
      'model_justification: j',
      '---',
      'Body',
    ].join('\n'));
    await expect(loadAllAgents(dir)).rejects.toThrow('Zod validation');
    rmSync(dir, { recursive: true });
  });

  test('applies default max_tokens of 8192 when omitted', () => {
    const result = AgentSpecSchema.safeParse({
      name: 'test-agent',
      model: 'claude-sonnet-4-6',
      tools: [],
      skills: [],
      role: 'Role',
      inputs: [],
      outputs: [],
      model_justification: 'Justification.',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.max_tokens).toBe(8192);
  });
});

describe('AgentSpecSchema validations', () => {
  const base = {
    name: 'valid-agent',
    model: 'claude-sonnet-4-6' as const,
    tools: [] as const,
    skills: [],
    role: 'Role',
    inputs: [],
    outputs: [],
    model_justification: 'j',
  };

  test('rejects model not in MODELS enum', () => {
    const result = AgentSpecSchema.safeParse({ ...base, model: 'claude-opus-4-6' });
    expect(result.success).toBe(false);
  });

  test('rejects non-kebab-case name', () => {
    const result = AgentSpecSchema.safeParse({ ...base, name: 'BadName' });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].message).toContain('kebab-case');
  });

  test('rejects tool not in TOOLS enum (Bash)', () => {
    const result = AgentSpecSchema.safeParse({ ...base, tools: ['Bash'] });
    expect(result.success).toBe(false);
  });

  test('rejects max_tokens over 16384', () => {
    const result = AgentSpecSchema.safeParse({ ...base, max_tokens: 16385 });
    expect(result.success).toBe(false);
  });
});

describe('MODELS and TOOLS enums', () => {
  test('MODELS contains exactly claude-opus-4-8 and claude-sonnet-4-6', () => {
    expect(MODELS).toContain('claude-opus-4-8');
    expect(MODELS).toContain('claude-sonnet-4-6');
    expect(MODELS.length).toBe(2);
  });

  test('TOOLS contains exactly Read, Grep, Edit, Write', () => {
    expect(new Set(TOOLS)).toEqual(new Set(['Read', 'Grep', 'Edit', 'Write']));
    expect(TOOLS.length).toBe(4);
  });
});

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { z } from 'zod';
import type { AgentSpec } from './types';

export const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'] as const;
export const TOOLS  = ['Read', 'Grep', 'Edit', 'Write'] as const;

export const AgentSpecSchema = z.object({
  name:                z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab-case required'),
  model:               z.enum(MODELS),
  max_tokens:          z.number().int().positive().max(16384).default(8192),
  tools:               z.array(z.enum(TOOLS)).default([]),
  skills:              z.array(z.string()).default([]),
  role:                z.string().min(1),
  inputs:              z.array(z.string()).default([]),
  outputs:             z.array(z.string()).default([]),
  model_justification: z.string().min(1),
}).strict();

export async function loadAllAgents(dir: string): Promise<Map<string, AgentSpec>> {
  const agents = new Map<string, AgentSpec>();
  if (!existsSync(dir)) return agents;

  const files = readdirSync(dir).filter(f => f.endsWith('.agent.md'));
  for (const file of files) {
    const raw = readFileSync(`${dir}/${file}`, 'utf-8');
    const parsed = matter(raw);
    const result = AgentSpecSchema.safeParse(parsed.data);
    if (!result.success) {
      const errs = result.error.errors
        .map(e => `  ${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Agent ${file} failed Zod validation:\n${errs}`);
    }
    const spec: AgentSpec = { ...result.data, prompt: parsed.content.trim() };
    agents.set(spec.name, spec);
  }
  return agents;
}

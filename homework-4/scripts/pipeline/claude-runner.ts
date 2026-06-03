import type { AgentSpec } from './types';

export function buildSystemPrompt(agent: AgentSpec, skills: Map<string, string>): string {
  const skillBlocks = agent.skills
    .map(id => {
      const content = skills.get(id);
      if (!content) throw new Error(`Agent ${agent.name} references unknown skill: ${id}`);
      return `\n\n<skill name="${id}">\n${content}\n</skill>\n\n`;
    })
    .join('');
  return agent.prompt + skillBlocks;
}

export async function runAgent(
  _spec: AgentSpec,
  _skills: Map<string, string>,
  _userMessage: string,
): Promise<{ text: string; durationMs: number }> {
  throw new Error('runAgent not yet implemented — Phase 6');
}

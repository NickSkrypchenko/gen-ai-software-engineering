import { execFile } from 'node:child_process';
import type { AgentSpec } from './types';

const SUBPROCESS_TIMEOUT_MS = 5 * 60 * 1000;

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

export function spawnClaude(
  args: string[],
  input: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    (execFile as any)('claude', args, {
      input,
      encoding: 'utf-8',
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    }, (err: Error | null, stdout: string, stderr: string) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

export async function runAgent(
  spec: AgentSpec,
  skills: Map<string, string>,
  userMessage: string,
  spawn: typeof spawnClaude = spawnClaude,
): Promise<{ text: string; durationMs: number }> {
  const systemPrompt = buildSystemPrompt(spec, skills);
  const allowedTools = spec.tools.join(',');

  const args = [
    '-p',
    '--model', spec.model,
    '--append-system-prompt', systemPrompt,
    ...(allowedTools ? ['--allowedTools', allowedTools] : []),
  ];

  const start = Date.now();
  try {
    const { stdout } = await spawn(args, userMessage);
    const durationMs = Date.now() - start;
    const text = stdout.trim();
    if (!text) throw new Error(`Agent ${spec.name} returned empty output`);
    return { text, durationMs };
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error(
        'claude CLI not found. Install Claude Code: https://docs.anthropic.com/claude-code. See HOWTORUN.md.',
      );
    }
    if (e.killed && e.signal === 'SIGTERM') {
      throw new Error(
        `Agent ${spec.name} exceeded ${SUBPROCESS_TIMEOUT_MS / 1000}s timeout`,
      );
    }
    throw new Error(`Agent ${spec.name} failed: ${e.message}\n${e.stderr ?? ''}`);
  }
}

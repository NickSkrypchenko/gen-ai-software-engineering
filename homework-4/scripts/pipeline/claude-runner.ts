import { spawn as nodeSpawn } from 'node:child_process';
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

/* c8 ignore start — real subprocess seam; coverage via runAgent's injected `spawn` param in tests */
export function spawnClaude(
  args: string[],
  input: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn('claude', args, { timeout: SUBPROCESS_TIMEOUT_MS });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err: any = new Error(`Command failed: claude ${args[0] ?? ''}`);
        err.stdout = stdout;
        err.stderr = stderr;
        if (child.killed || signal === 'SIGTERM') {
          err.killed = true;
          err.signal = 'SIGTERM';
        }
        reject(err);
      }
    });

    child.stdin.on('error', () => { /* EPIPE when subprocess exits before reading all stdin */ });
    child.stdin.write(input, 'utf-8');
    child.stdin.end();
  });
}
/* c8 ignore end */

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
    ...(spec.tools.length > 0 ? ['--allowedTools', allowedTools] : ['--allowedTools', 'none']),
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

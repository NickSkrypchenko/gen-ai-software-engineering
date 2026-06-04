import { execFileSync } from 'node:child_process';
import type { AgentSpec } from './types';

type WhichFn = (dep: string) => void;

const defaultWhich: WhichFn = (dep) => execFileSync('which', [dep], { stdio: 'ignore' });

export function checkSystemDependencies(whichFn: WhichFn = defaultWhich): void {
  const deps: Array<{ cmd: string; hint: string }> = [
    {
      cmd: 'claude',
      hint: 'Install Claude Code: https://docs.anthropic.com/claude-code. See HOWTORUN.md.',
    },
    { cmd: 'git',  hint: 'Install git and ensure it is on PATH.' },
    { cmd: 'npx',  hint: 'Install Node.js (includes npx) and ensure it is on PATH.' },
  ];

  for (const { cmd, hint } of deps) {
    try {
      whichFn(cmd);
    } catch {
      console.error(`Missing system dependency: ${cmd}. ${hint}`);
      process.exit(2);
    }
  }
}

export function validateAgentSkillRefs(
  agents: Map<string, AgentSpec>,
  skills: Map<string, string>,
): void {
  for (const [, spec] of agents) {
    for (const skillId of spec.skills) {
      if (!skills.has(skillId)) {
        const available = [...skills.keys()].join(', ') || '(none)';
        throw new Error(
          `Agent "${spec.name}" references unknown skill: "${skillId}". Available: [${available}]`,
        );
      }
    }
  }
}

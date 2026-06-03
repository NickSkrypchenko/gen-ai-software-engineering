#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadAllAgents } from './pipeline/agent-loader';
import { loadAllSkills } from './pipeline/skill-loader';
import { checkSystemDependencies, validateAgentSkillRefs } from './pipeline/validators';
import { runStages } from './pipeline/stages';
import { logger } from './pipeline/logger';

const { values } = parseArgs({ options: { bug: { type: 'string', short: 'b' } } });
if (!values.bug) {
  console.error('Usage: npm run pipeline -- --bug <id>');
  process.exit(2);
}

async function main(): Promise<void> {
  checkSystemDependencies();
  const agents = await loadAllAgents('agents/');
  const skills = await loadAllSkills('skills/');
  validateAgentSkillRefs(agents, skills);

  const bugId = values.bug!;
  const bugDir = `context/bugs/${bugId}`;
  if (!existsSync(`${bugDir}/bug-context.md`)) {
    throw new Error(`Bug not found: ${bugDir}/bug-context.md`);
  }

  const result = await runStages({ bugId, agents, skills, bugDir });
  logger.info({ summary: result.summary }, 'Pipeline complete');
  process.exit(result.failures.length === 0 ? 0 : 1);
}

main().catch(err => {
  logger.error({ err }, 'Pipeline failed');
  process.exit(2);
});

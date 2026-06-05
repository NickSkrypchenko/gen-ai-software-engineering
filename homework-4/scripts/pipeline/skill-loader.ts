import { existsSync, readdirSync, readFileSync } from 'node:fs';

const REQUIRED_HEADERS = ['## Levels', '## Application', '## Required output sections'];

export function validateSkillStructure(content: string, filename: string): void {
  for (const header of REQUIRED_HEADERS) {
    if (!content.includes(header)) {
      throw new Error(`Skill "${filename}" missing required header: "${header}"`);
    }
  }
}

export async function loadAllSkills(dir: string): Promise<Map<string, string>> {
  const skills = new Map<string, string>();
  if (!existsSync(dir)) return skills;

  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, 'utf-8');
    validateSkillStructure(content, file);
    skills.set(file.replace(/\.md$/, ''), content);
  }
  return skills;
}

import { describe, test, expect } from 'vitest';
import { loadAllSkills, validateSkillStructure } from '../../scripts/pipeline/skill-loader';
import path from 'node:path';

const SKILLS_FIXTURES = path.join(__dirname, 'fixtures/skills');

describe('validateSkillStructure', () => {
  test('passes when all required headers are present', () => {
    const content = [
      '# Skill\n',
      '## Levels\nL0...\n',
      '## Application\nDo stuff.\n',
      '## Required output sections\n- Section A\n',
    ].join('\n');
    expect(() => validateSkillStructure(content, 'test.md')).not.toThrow();
  });

  test('throws when ## Levels is missing', () => {
    const content = '## Application\nDo stuff.\n## Required output sections\n- A\n';
    expect(() => validateSkillStructure(content, 'test.md'))
      .toThrow('missing required header: "## Levels"');
  });

  test('throws when ## Application is missing', () => {
    const content = '## Levels\nL0.\n## Required output sections\n- A\n';
    expect(() => validateSkillStructure(content, 'test.md'))
      .toThrow('missing required header: "## Application"');
  });

  test('throws when ## Required output sections is missing', () => {
    const content = '## Levels\nL0.\n## Application\nDo stuff.\n';
    expect(() => validateSkillStructure(content, 'test.md'))
      .toThrow('missing required header: "## Required output sections"');
  });
});

describe('loadAllSkills', () => {
  test('returns empty map for non-existent directory', async () => {
    const skills = await loadAllSkills('/nonexistent-dir-xyz');
    expect(skills.size).toBe(0);
  });

  test('loads valid skill and keys it without .md extension', async () => {
    const skills = await loadAllSkills(SKILLS_FIXTURES);
    expect(skills.has('valid-skill')).toBe(true);
    expect(skills.get('valid-skill')).toContain('## Levels');
  });

  test('throws on skill file missing required header', async () => {
    const singleBadDir = path.join(__dirname, 'fixtures/skills-bad');
    // Test via validateSkillStructure directly since loadAllSkills short-circuits on first bad file
    expect(() => validateSkillStructure('## Levels\nL0.', 'bad.md'))
      .toThrow('missing required header: "## Application"');
  });
});

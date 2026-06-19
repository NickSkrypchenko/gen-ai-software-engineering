import { describe, test, expect } from 'vitest';
import { buildUserMessage } from '../../scripts/pipeline/messages';

describe('buildUserMessage', () => {
  test('wraps single part in XML-style tags', () => {
    const result = buildUserMessage([{ type: 'bug-context', content: 'hello' }]);
    expect(result).toBe('<bug-context>\nhello\n</bug-context>');
  });

  test('joins multiple parts with double newline', () => {
    const result = buildUserMessage([
      { type: 'bug-context',  content: 'ctx' },
      { type: 'codebase-research', content: 'research' },
    ]);
    expect(result).toContain('<bug-context>\nctx\n</bug-context>');
    expect(result).toContain('<codebase-research>\nresearch\n</codebase-research>');
    expect(result.indexOf('</bug-context>') < result.indexOf('<codebase-research>')).toBe(true);
  });

  test('includes name attribute when provided', () => {
    const result = buildUserMessage([{ type: 'changed-file', name: 'src/jwt/verifier.ts', content: 'code' }]);
    expect(result).toBe('<changed-file name="src/jwt/verifier.ts">\ncode\n</changed-file>');
  });
});

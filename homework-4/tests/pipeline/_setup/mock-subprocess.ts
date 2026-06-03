import { vi } from 'vitest';

export function mockClaudeSubprocess(responsesByInvocation: string[]) {
  let invocationIdx = 0;

  vi.mock('node:child_process', async (importOriginal) => {
    const original = await importOriginal<typeof import('node:child_process')>();
    return {
      ...original,
      execFile: vi.fn(
        (
          cmd: string,
          args: string[],
          opts: object,
          callback: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          if (cmd !== 'claude') {
            return original.execFile(cmd as any, args as any, opts as any, callback as any);
          }
          if (invocationIdx >= responsesByInvocation.length) {
            callback(
              new Error(`mock-subprocess: no response queued for invocation ${invocationIdx}`),
              '',
              '',
            );
            return;
          }
          const stdout = responsesByInvocation[invocationIdx++];
          callback(null, stdout, '');
        },
      ),
    };
  });
}

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Phase 0 scaffold has no tests yet; the suite fills in at Phase 3.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'mcp/**/*.ts'],
      exclude: ['src/types.ts', '**/*.d.ts'],
      // Hard floor — the same 80% the coverage-gate push hook enforces.
      // 90% is the project target (an aim), not enforced here.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_SECRET: 'test-secret-for-cli-demo-only',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      include: ['scripts/pipeline/**/*.ts', 'src/**/*.ts'],
      perFile: true,
      thresholds: {
        lines:      85,
        branches:   85,
        functions:  85,
        statements: 85,
      },
      exclude: [
        '**/*.test.ts',
        'tests/**',
        'src/index.ts',
        'scripts/run-pipeline.ts',
        'scripts/seed-bugs.ts',
        'scripts/generate-fixtures.ts',
        'scripts/pipeline/logger.ts',
        'scripts/pipeline/types.ts',
        'src/types.ts',
      ],
    },
  },
});

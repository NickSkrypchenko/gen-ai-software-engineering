import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/db/migrations/**',
        // Stubs — excluded until each phase implements them
        // Phase 2: db layer
        'src/db/client.ts',
        'src/db/schema.ts',
        'src/db/types.ts',
        // Phase 3: HTTP layer
        'src/controllers/**',
        'src/services/**',
        'src/middleware/etag.ts',
        'src/middleware/validate.ts',
        // Phase 4: importers
        'src/repository/**',
        'src/importers/csv.importer.ts',
        'src/importers/json.importer.ts',
        'src/importers/xml.importer.ts',
        // logger is infrastructure; pino transport integration tested in Phase 3
        'src/utils/logger.ts',
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: false },
    },
  },
});

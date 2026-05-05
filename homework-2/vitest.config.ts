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
        // Pure TypeScript type files — erased at compile time, no runtime code to cover
        'src/db/types.ts',
        'src/importers/importer.types.ts',
        'src/models/ticket.types.ts',
        // Phase 3 implemented — controllers/services now covered by http-tickets.test.ts
        // error-handler covered via HTTP error paths in integration tests

        // Phase 4 stubs — un-excluded once importers are implemented
        'src/importers/csv.importer.ts',
        'src/importers/json.importer.ts',
        'src/importers/xml.importer.ts',
        'src/importers/index.ts',
        // Infrastructure — logger uses pino transport; covered by Phase 3 integration tests
        'src/utils/logger.ts',
      ],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 85,
        statements: 85,
      },
    },
    // singleFork ensures integration tests sharing the Neon test DB run sequentially
    // preventing TRUNCATE in one test from racing with INSERT in another
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});

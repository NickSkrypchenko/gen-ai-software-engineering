import dotenv from 'dotenv';
import { resolve } from 'path';
import { afterAll } from 'vitest';

// Load .env.test so the test Neon branch URL overrides any dev DATABASE_URL.
// Must happen before any src/ module that reads config.ts is imported.
dotenv.config({ path: resolve(process.cwd(), '.env.test'), override: true });

afterAll(async () => {
  // Neon HTTP driver does not maintain a persistent pool — no pool.end() needed.
  // If a pg pool is introduced in future, close it here.
});

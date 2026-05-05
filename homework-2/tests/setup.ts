import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.test so the test Neon branch URL overrides any dev DATABASE_URL
dotenv.config({ path: resolve(process.cwd(), '.env.test'), override: true });

// DB pool teardown (afterAll) will be added in Phase 2 once the client is wired.

import ws from 'ws';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { config } from '../config';
import * as schema from './schema';

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// WebSocket constructor is required for transaction support in Node.js.
// Browsers have a built-in WebSocket; neonConfig picks it up automatically.
neonConfig.webSocketConstructor = ws;

// Pool-based driver supports db.transaction(), SELECT FOR UPDATE, and SAVEPOINTs.
// Neon's pooler URL (-pooler suffix) multiplexes connections server-side.
const pool = new Pool({ connectionString: config.databaseUrl });
export const db = drizzle(pool, { schema });

export type DB = typeof db;

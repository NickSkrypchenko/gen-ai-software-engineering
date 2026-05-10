import 'dotenv/config';

export const config = {
  port:        parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv:     process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  logLevel:    process.env.LOG_LEVEL ?? 'info',
  corsOrigin:  process.env.CORS_ORIGIN ?? '*',
} as const;

export type NodeEnv = 'development' | 'test' | 'production';

#!/usr/bin/env tsx
import 'dotenv/config';
import { verifyToken } from './jwt/verifier';

const [, , cmd, token] = process.argv;

if (cmd !== 'verify' || !token) {
  console.error('Usage: npm run cli -- verify <jwt-token>');
  process.exit(1);
}

const result = verifyToken(token);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);

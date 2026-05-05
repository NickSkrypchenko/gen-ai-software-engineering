import 'dotenv/config';
import { createApp } from '../src/app';

// Vercel serverless entry — @vercel/node handles TypeScript compilation
export default createApp();

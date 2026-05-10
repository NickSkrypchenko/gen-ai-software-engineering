import pino from 'pino';
import { config } from '../config';

export const logger = pino(
  config.nodeEnv === 'development'
    ? {
        level: config.logLevel,
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : {
        level: config.logLevel,
      },
);

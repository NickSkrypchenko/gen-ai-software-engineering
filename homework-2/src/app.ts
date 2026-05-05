import express from 'express';
import cors from 'cors';
import { config } from './config';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health.routes';
import { ticketsRouter } from './routes/tickets.routes';
import { importRouter } from './routes/import.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);

  // Static frontend
  app.use(express.static('public'));

  // API routes
  app.use(healthRouter);
  app.use('/api', ticketsRouter);
  app.use('/api', importRouter);

  // Central error handler — must be last
  app.use(errorHandler);

  return app;
}

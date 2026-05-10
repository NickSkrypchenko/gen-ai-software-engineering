import type { Request, Response, NextFunction } from 'express';
import {
  HttpError,
  VersionConflictError,
  InvalidTransitionError,
} from '../utils/http-errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof HttpError) {
    const body: Record<string, unknown> = {
      error: err.message,
      code:  err.code,
      requestId,
    };
    if (err.details !== undefined)           body.details         = err.details;
    if (err instanceof VersionConflictError) {
      body.current_version = err.current_version;
      body.your_version    = err.your_version;
    }
    if (err instanceof InvalidTransitionError) {
      body.allowed = err.allowed;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, requestId, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL', requestId });
}

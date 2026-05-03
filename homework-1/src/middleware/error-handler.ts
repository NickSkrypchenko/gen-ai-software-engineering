import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/http-errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
      requestId,
    });
    return;
  }

  logger.error({ err, requestId }, 'Unexpected error');
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL',
    requestId,
  });
}

import { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || `req_${ulid()}`;
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}

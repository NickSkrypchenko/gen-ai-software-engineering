import type { Request, Response, NextFunction } from 'express';
import { uuidv7 } from 'uuidv7';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? `req_${uuidv7()}`;
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}

import type { Request, Response, NextFunction } from 'express';
import { PreconditionRequiredError } from '../utils/http-errors';

// Parses If-Match: "N" → attaches req.expectedVersion as integer.
// Throws 428 if header is absent or unparseable.
export function parseIfMatch(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['if-match'];
  if (!header) return next(new PreconditionRequiredError());
  const match = /^"?(\d+)"?$/.exec(header.trim());
  if (!match) return next(new PreconditionRequiredError());
  (req as Request & { expectedVersion: number }).expectedVersion = parseInt(match[1], 10);
  next();
}

export function setETag(res: Response, version: number) {
  res.setHeader('ETag', `"${version}"`);
}

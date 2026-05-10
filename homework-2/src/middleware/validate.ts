import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/http-errors';

export function validate<T extends z.ZodTypeAny>(
  schema: T,
  target: 'body' | 'query' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(new ValidationError(
        result.error.issues.map(i => ({
          field:   i.path.join('.') || undefined,
          message: i.message,
        })),
      ));
    }
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}

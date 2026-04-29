import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/http-errors';

interface ValidateTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(targets: ValidateTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.body) req.body = targets.body.parse(req.body);
      if (targets.query) req.query = targets.query.parse(req.query) as typeof req.query;
      if (targets.params) req.params = targets.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new ValidationError(
            err.issues.map(issue => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          ),
        );
      } else {
        next(err);
      }
    }
  };
}

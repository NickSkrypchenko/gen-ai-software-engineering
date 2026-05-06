import type { Request, Response, NextFunction } from 'express';
import { importService } from '../services/import.service';
import { ParseError, PayloadTooLargeError } from '../utils/http-errors';
import type { ImportFormat } from '../importers/importer.types';
import type { ImportQuery } from '../validators/import.schemas';

export const importController = {
  async importFile(req: Request, res: Response, next: NextFunction) {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) return next(new ParseError('No file uploaded'));

      const { format, auto_classify: autoClassify } = req.query as unknown as ImportQuery;

      try {
        const summary = await importService.importFile(file.buffer, format, autoClassify);
        res.json(summary);
      } catch (e: unknown) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'PARSE_ERROR') {
          return next(new ParseError(e.message));
        }
        if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'PAYLOAD_TOO_LARGE') {
          return next(new PayloadTooLargeError(e.message));
        }
        next(e);
      }
    } catch (e) { next(e); }
  },
};

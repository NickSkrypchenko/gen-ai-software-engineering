import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { importController } from '../controllers/import.controller';
import { validate } from '../middleware/validate';
import { ImportQuerySchema } from '../validators/import.schemas';
import { MissingFormatError, UnsupportedMediaTypeError, PayloadTooLargeError } from '../utils/http-errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function requireMultipart(req: Request, _res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next(new UnsupportedMediaTypeError());
  }
  next();
}

// Catches multer's LIMIT_FILE_SIZE error and maps it to 413
function multerErrorHandler(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err && typeof err === 'object' && (err as Record<string, unknown>).code === 'LIMIT_FILE_SIZE') {
    return next(new PayloadTooLargeError('File exceeds the 5 MB limit'));
  }
  next(err);
}

export const importRouter = Router();

importRouter.post(
  '/tickets/import',
  requireMultipart,
  validate(ImportQuerySchema, 'query'),
  upload.single('file'),
  multerErrorHandler,
  importController.importFile,
);

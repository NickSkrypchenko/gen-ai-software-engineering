import { z } from 'zod';

export const IMPORT_FORMATS = ['csv', 'json', 'xml'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export const ImportQuerySchema = z.object({
  format:        z.enum(IMPORT_FORMATS),
  auto_classify: z.coerce.boolean().default(false),
});

export type ImportQuery = z.infer<typeof ImportQuerySchema>;

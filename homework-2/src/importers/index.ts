import type { ImportFormat, Importer } from './importer.types';
import { csvImporter } from './csv.importer';
import { jsonImporter } from './json.importer';
import { xmlImporter } from './xml.importer';

export const importers: Record<ImportFormat, Importer> = {
  csv:  csvImporter,
  json: jsonImporter,
  xml:  xmlImporter,
};

export type { ImportFormat, Importer, ImporterResult } from './importer.types';

// JSON importer — implemented in Phase 4 (root array of ticket objects)
import type { Importer } from './importer.types';

export const jsonImporter: Importer = {
  format: 'json',
  parse(_file) {
    return { rows: [], parseErrors: [{ message: 'JSON importer not yet implemented' }] };
  },
};

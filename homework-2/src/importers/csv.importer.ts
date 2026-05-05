// CSV importer — implemented in Phase 4 (papaparse + unflattenRow for dot-notation headers)
import type { Importer } from './importer.types';

export const csvImporter: Importer = {
  format: 'csv',
  parse(_file) {
    return { rows: [], parseErrors: [{ message: 'CSV importer not yet implemented' }] };
  },
};

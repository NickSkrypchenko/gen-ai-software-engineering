// XML importer — implemented in Phase 4 (fast-xml-parser with isArray callbacks)
import type { Importer } from './importer.types';

export const xmlImporter: Importer = {
  format: 'xml',
  parse(_file) {
    return { rows: [], parseErrors: [{ message: 'XML importer not yet implemented' }] };
  },
};

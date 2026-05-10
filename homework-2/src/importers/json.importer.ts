import type { Importer, ImporterResult } from './importer.types';

export const jsonImporter: Importer = {
  format: 'json',
  parse(file: Buffer): ImporterResult {
    const rows: ImporterResult['rows']            = [];
    const parseErrors: ImporterResult['parseErrors'] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(file.toString('utf-8'));
    } catch (e) {
      parseErrors.push({ message: `Malformed JSON: ${e instanceof Error ? e.message : String(e)}` });
      return { rows, parseErrors };
    }

    if (!Array.isArray(parsed)) {
      parseErrors.push({ message: 'JSON root must be an array of ticket objects' });
      return { rows, parseErrors };
    }

    (parsed as unknown[]).forEach((item, i) => {
      rows.push({ rowIndex: i + 1, raw: item as Record<string, unknown> });
    });

    return { rows, parseErrors };
  },
};

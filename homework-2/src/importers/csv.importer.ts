import Papa from 'papaparse';
import type { Importer, ImporterResult } from './importer.types';

// Reconstruct nested objects from dot-notation CSV headers.
// e.g. { "metadata.source": "api" } → { metadata: { source: "api" } }
function unflattenRow(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined) cur[parts[i]] = {};
      cur = cur[parts[i]] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

export const csvImporter: Importer = {
  format: 'csv',
  parse(file: Buffer): ImporterResult {
    const rows: ImporterResult['rows']            = [];
    const parseErrors: ImporterResult['parseErrors'] = [];

    const result = Papa.parse<Record<string, string>>(file.toString('utf-8'), {
      header:          true,
      skipEmptyLines:  true,
      transformHeader: h => h.trim(),
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      parseErrors.push({ message: `Malformed CSV: ${result.errors[0].message}` });
      return { rows, parseErrors };
    }

    result.data.forEach((flat, i) => {
      const rowIndex = i + 1;
      try {
        const unflat = unflattenRow(flat as Record<string, unknown>);
        // tags: comma-separated cell → string[]
        if (typeof unflat.tags === 'string') {
          unflat.tags = (unflat.tags as string)
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
        }
        rows.push({ rowIndex, raw: unflat });
      } catch (e) {
        parseErrors.push({ rowIndex, message: e instanceof Error ? e.message : String(e) });
      }
    });

    return { rows, parseErrors };
  },
};

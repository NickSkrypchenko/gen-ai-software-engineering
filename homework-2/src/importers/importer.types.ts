export type ImportFormat = 'csv' | 'json' | 'xml';

export interface ImporterResult {
  rows:        Array<{ rowIndex: number; raw: Record<string, unknown> }>;
  parseErrors: Array<{ rowIndex?: number; message: string }>;
}

export interface Importer {
  format: ImportFormat;
  parse(file: Buffer): ImporterResult;
}

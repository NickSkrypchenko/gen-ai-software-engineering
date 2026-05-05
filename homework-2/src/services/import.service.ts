import { importers } from '../importers';
import type { ImportFormat } from '../importers/importer.types';
import { CreateTicketSchema } from '../validators/ticket.schemas';
import { ticketRepository } from '../repository/ticket.repository';
import { classifyService } from './classify.service';

export interface ImportFailure {
  row:     number;
  stage:   'parse' | 'validate' | 'insert';
  field?:  string;
  message: string;
}

export interface ImportSummary {
  total:           number;
  succeeded:       number;
  failed:          ImportFailure[];
  ticket_ids:      string[];
  auto_classified?: number;
}

const MAX_ROWS = 1000;

export const importService = {
  async importFile(
    file: Buffer,
    format: ImportFormat,
    autoClassify: boolean,
  ): Promise<ImportSummary> {
    const importer = importers[format];
    const { rows, parseErrors } = importer.parse(file);

    const failed: ImportFailure[] = [];

    // Whole-file parse failure
    if (parseErrors.length > 0 && rows.length === 0) {
      throw Object.assign(new Error(parseErrors[0].message), { code: 'PARSE_ERROR', statusCode: 400 });
    }

    // Per-row parse errors
    for (const pe of parseErrors) {
      failed.push({ row: pe.rowIndex ?? 0, stage: 'parse', message: pe.message });
    }

    // Row limit check
    if (rows.length > MAX_ROWS) {
      throw Object.assign(
        new Error(`Import exceeds maximum of ${MAX_ROWS} rows (got ${rows.length})`),
        { code: 'PAYLOAD_TOO_LARGE', statusCode: 413 },
      );
    }

    // Zod validation — per row
    const validRows: ReturnType<typeof CreateTicketSchema.parse>[] = [];
    const validRowIndices: number[] = [];

    for (const { rowIndex, raw } of rows) {
      const result = CreateTicketSchema.safeParse(raw);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        failed.push({
          row:     rowIndex,
          stage:   'validate',
          field:   firstIssue.path.join('.') || undefined,
          message: firstIssue.message,
        });
      } else {
        validRows.push(result.data);
        validRowIndices.push(rowIndex);
      }
    }

    // Bulk insert with per-row SAVEPOINTs
    const { inserted, insertErrors } = await ticketRepository.bulkInsert(validRows);

    for (const ie of insertErrors) {
      const rowIndex = validRowIndices[ie.rowIndex - 1] ?? ie.rowIndex;
      failed.push({ row: rowIndex, stage: 'insert', message: ie.message });
    }

    const ticket_ids = inserted.map(t => t.id);

    // Auto-classify all successfully inserted tickets
    let auto_classified: number | undefined;
    if (autoClassify && inserted.length > 0) {
      let classified = 0;
      for (const ticket of inserted) {
        try {
          await classifyService.autoClassify(ticket.id, ticket.version);
          classified++;
        } catch {
          // Non-fatal — classification failures don't affect import summary
        }
      }
      auto_classified = classified;
    }

    const summary: ImportSummary = {
      total:      rows.length,
      succeeded:  inserted.length,
      failed,
      ticket_ids,
    };
    if (auto_classified !== undefined) summary.auto_classified = auto_classified;

    return summary;
  },
};

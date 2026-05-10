import { XMLParser } from 'fast-xml-parser';
import type { Importer, ImporterResult } from './importer.types';

// fast-xml-parser: always treat these paths as arrays regardless of element count
const ARRAY_PATHS = ['tickets.ticket', 'tickets.ticket.tags.tag'];

function unwrapTicket(raw: Record<string, unknown>): Record<string, unknown> {
  // Normalise tags: fast-xml-parser gives { tags: { tag: [...] } } for non-empty,
  // '' or undefined for <tags/> — always normalise to string[]
  if (raw.tags === undefined || raw.tags === '' || raw.tags === null) {
    raw.tags = [];
  } else if (typeof raw.tags === 'object' && !Array.isArray(raw.tags)) {
    const inner = (raw.tags as Record<string, unknown>).tag;
    raw.tags = Array.isArray(inner) ? inner : inner !== undefined ? [String(inner)] : [];
  }
  return raw;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (_name, jpath) => ARRAY_PATHS.includes(jpath),
});

export const xmlImporter: Importer = {
  format: 'xml',
  parse(file: Buffer): ImporterResult {
    const rows: ImporterResult['rows']            = [];
    const parseErrors: ImporterResult['parseErrors'] = [];

    let parsed: unknown;
    try {
      parsed = parser.parse(file.toString('utf-8'));
    } catch (e) {
      parseErrors.push({ message: `Malformed XML: ${e instanceof Error ? e.message : String(e)}` });
      return { rows, parseErrors };
    }

    const root = (parsed as Record<string, unknown>).tickets;
    if (!root || typeof root !== 'object') {
      parseErrors.push({ message: 'XML root element <tickets> not found' });
      return { rows, parseErrors };
    }

    const ticketNodes = (root as Record<string, unknown>).ticket;
    if (!Array.isArray(ticketNodes) || ticketNodes.length === 0) {
      return { rows, parseErrors };
    }

    (ticketNodes as Record<string, unknown>[]).forEach((raw, i) => {
      rows.push({ rowIndex: i + 1, raw: unwrapTicket({ ...raw }) });
    });

    return { rows, parseErrors };
  },
};

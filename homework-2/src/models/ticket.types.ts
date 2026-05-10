// Central re-export — frontend and tests import from here.
// Db row types (Phase 2), API input types, and runtime enum arrays.
export type {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketMetadata,
} from '../domain/ticket';

export {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../domain/ticket';

export type {
  CreateTicketInput,
  UpdateTicketInput,
  TransitionRequest,
  ListFilters,
} from '../validators/ticket.schemas';

export type { ClassificationResult } from '../domain/classifier';

export type {
  TicketRow,
  TransitionRow,
  ClassificationRow,
} from '../db/types';

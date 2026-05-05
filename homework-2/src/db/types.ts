import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { tickets, ticketTransitions, classifications } from './schema';

export type TicketRow          = InferSelectModel<typeof tickets>;
export type TicketInsert       = InferInsertModel<typeof tickets>;
export type TransitionRow      = InferSelectModel<typeof ticketTransitions>;
export type TransitionInsert   = InferInsertModel<typeof ticketTransitions>;
export type ClassificationRow  = InferSelectModel<typeof classifications>;
export type ClassificationInsert = InferInsertModel<typeof classifications>;

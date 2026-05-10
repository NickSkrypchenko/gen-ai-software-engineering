import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../domain/ticket';
import { Email, NonEmptyString } from './common.schemas';
import { TicketMetadataSchema } from './metadata.schemas';

export const CreateTicketSchema = z.object({
  customer_id:    NonEmptyString(64),
  customer_email: Email,
  customer_name:  NonEmptyString(200),
  subject:        NonEmptyString(200),
  description:    z.string().trim().min(10).max(2000),
  category:       z.enum(TICKET_CATEGORIES).default('other'),
  priority:       z.enum(TICKET_PRIORITIES).default('medium'),
  assigned_to:    z.string().trim().min(1).max(200).nullable().optional(),
  tags:           z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  metadata:       TicketMetadataSchema,
}).strict();

export const UpdateTicketSchema = CreateTicketSchema
  .omit({ customer_id: true, customer_email: true })
  .partial()
  .strict()
  .refine(v => Object.keys(v).length > 0, 'Update body must contain at least one field');

export const TransitionRequestSchema = z.object({
  to:     z.enum(TICKET_STATUSES),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const ListFiltersSchema = z.object({
  status:      z.enum(TICKET_STATUSES).optional(),
  category:    z.enum(TICKET_CATEGORIES).optional(),
  priority:    z.enum(TICKET_PRIORITIES).optional(),
  assigned_to: z.string().trim().max(200).optional(),
  customer_id: z.string().trim().max(64).optional(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
  q:           z.string().trim().min(2).max(200).optional(),
  limit:       z.coerce.number().int().positive().max(200).default(50),
  offset:      z.coerce.number().int().nonnegative().default(0),
}).refine(
  v => !(v.from && v.to) || v.from <= v.to,
  { message: 'from must be <= to', path: ['to'] },
);

export type CreateTicketInput    = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput    = z.infer<typeof UpdateTicketSchema>;
export type TransitionRequest    = z.infer<typeof TransitionRequestSchema>;
export type ListFilters          = z.infer<typeof ListFiltersSchema>;

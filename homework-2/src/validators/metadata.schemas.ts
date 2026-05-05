import { z } from 'zod';

export const TICKET_SOURCES = ['web_form', 'email', 'api', 'chat', 'phone'] as const;
export const DEVICE_TYPES   = ['desktop', 'mobile', 'tablet'] as const;

export const TicketMetadataSchema = z.object({
  source:      z.enum(TICKET_SOURCES),
  browser:     z.string().max(200).optional(),
  device_type: z.enum(DEVICE_TYPES).optional(),
}).strict();

export type TicketMetadataInput = z.infer<typeof TicketMetadataSchema>;

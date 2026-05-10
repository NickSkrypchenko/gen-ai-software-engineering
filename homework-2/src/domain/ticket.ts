// Domain types and enum value arrays — no I/O, no DB imports.
// These arrays are imported by db/schema.ts (pgEnum) and validators/*.schemas.ts (z.enum),
// and by the frontend at runtime (safe — no backend dependencies).

export const TICKET_CATEGORIES = [
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = [
  'new',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface TicketMetadata {
  source:      string;
  browser?:    string;
  device_type?: string;
}

export interface Ticket {
  id:             string;
  customer_id:    string;
  customer_email: string;
  customer_name:  string;
  subject:        string;
  description:    string;
  category:       TicketCategory;
  priority:       TicketPriority;
  status:         TicketStatus;
  created_at:     Date;
  updated_at:     Date;
  resolved_at:    Date | null;
  assigned_to:    string | null;
  tags:           string[];
  metadata:       TicketMetadata;
  version:        number;
}

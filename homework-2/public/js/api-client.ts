/**
 * ETag-aware API client.
 * Caches the version (ETag) per ticket id so callers don't need to track it manually.
 * On 412 (version conflict) automatically re-fetches the ticket, updates the cache,
 * and retries the request once for PUT and auto-classify operations.
 */

export interface Ticket {
  id: string;
  customer_id: string;
  customer_email: string;
  customer_name?: string;
  subject: string;
  description: string;
  category?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'new' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  assigned_to?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  version: number;
}

export interface TicketListResponse {
  data: Ticket[];
  count: number;
  page: { limit: number; offset: number };
}

export interface Transition {
  id: string;
  ticket_id: string;
  from_status: string;
  to_status: string;
  reason?: string | null;
  transitioned_by?: string | null;
  transitioned_at: string;
}

export interface Classification {
  id: string;
  ticket_id: string;
  category: string;
  priority: string;
  confidence: number;
  matched_keywords?: string[];
  source: string;
  classified_at: string;
}

export interface ImportSummary {
  imported: number;
  failed: number;
  errors: Array<{ rowIndex: number; stage: string; field?: string; message: string }>;
}

export interface ApiError {
  error: string;
  code: string;
  requestId?: string;
  current_version?: number;
  your_version?: number;
  allowed?: string[];
  details?: Array<{ field: string; message: string }>;
}

const BASE = '/api';

/** Per-ticket version cache: ticketId → version number */
const versionCache = new Map<string, number>();

function setVersion(ticketId: string, version: number): void {
  versionCache.set(ticketId, version);
}

function getVersion(ticketId: string): number | undefined {
  return versionCache.get(ticketId);
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

function extractETag(res: Response): number | null {
  const etag = res.headers.get('etag');
  if (!etag) return null;
  const m = /^"?(\d+)"?$/.exec(etag.trim());
  return m ? parseInt(m[1], 10) : null;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryOnConflict = false,
  ticketId?: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });

  const etag = extractETag(res);
  if (etag !== null && ticketId) setVersion(ticketId, etag);

  if (res.ok) return parseJson<T>(res);

  if (res.status === 412 && retryOnConflict && ticketId) {
    const fresh = await fetch(`${BASE}/tickets/${ticketId}`);
    const freshEtag = extractETag(fresh);
    if (freshEtag !== null) setVersion(ticketId, freshEtag);
    if (fresh.ok) {
      const headers = { ...(init.headers as Record<string, string>), 'If-Match': `"${freshEtag}"` };
      return request<T>(path, { ...init, headers }, false, ticketId);
    }
  }

  const body = await parseJson<ApiError>(res).catch(() => ({ error: res.statusText, code: 'UNKNOWN' } as ApiError));
  const err = new Error((body as ApiError).error ?? res.statusText) as Error & { status: number; body: ApiError };
  (err as unknown as Record<string, unknown>)['status'] = res.status;
  (err as unknown as Record<string, unknown>)['body'] = body;
  throw err;
}

function ifMatch(ticketId: string): Record<string, string> {
  const v = getVersion(ticketId);
  return v !== undefined ? { 'If-Match': `"${v}"` } : {};
}

export const apiClient = {
  async listTickets(params: Record<string, string> = {}): Promise<TicketListResponse> {
    const qs = new URLSearchParams(params).toString();
    const path = qs ? `/tickets?${qs}` : '/tickets';
    return request<TicketListResponse>(path);
  },

  async getTicket(id: string): Promise<Ticket> {
    return request<Ticket>(`/tickets/${id}`, {}, false, id);
  },

  async createTicket(body: Partial<Ticket>): Promise<Ticket> {
    return request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateTicket(id: string, body: Partial<Ticket>): Promise<Ticket> {
    return request<Ticket>(
      `/tickets/${id}`,
      { method: 'PUT', body: JSON.stringify(body), headers: ifMatch(id) },
      true,
      id,
    );
  },

  async deleteTicket(id: string): Promise<void> {
    await request<void>(`/tickets/${id}`, { method: 'DELETE', headers: ifMatch(id) }, false, id);
    versionCache.delete(id);
  },

  async transition(id: string, to: string, reason?: string): Promise<Ticket> {
    return request<Ticket>(
      `/tickets/${id}/transitions`,
      { method: 'POST', body: JSON.stringify({ to, reason }), headers: ifMatch(id) },
      true,
      id,
    );
  },

  async autoClassify(id: string): Promise<{ classification: Classification; ticket: Ticket }> {
    return request<{ classification: Classification; ticket: Ticket }>(
      `/tickets/${id}/auto-classify`,
      { method: 'POST', headers: ifMatch(id) },
      true,
      id,
    );
  },

  async getTransitions(id: string): Promise<Transition[]> {
    return request<Transition[]>(`/tickets/${id}/transitions`);
  },

  async getClassifications(id: string): Promise<Classification[]> {
    return request<Classification[]>(`/tickets/${id}/classifications`);
  },

  async importTickets(file: File, format: 'csv' | 'json' | 'xml', autoClassify: boolean): Promise<ImportSummary> {
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams({ format, auto_classify: String(autoClassify) });
    const res = await fetch(`${BASE}/tickets/import?${qs}`, { method: 'POST', body: form });
    if (res.ok) return parseJson<ImportSummary>(res);
    const body = await parseJson<ApiError>(res).catch(() => ({ error: res.statusText, code: 'UNKNOWN' } as ApiError));
    const err = new Error((body as ApiError).error) as Error & { status: number; body: ApiError };
    (err as unknown as Record<string, unknown>)['status'] = res.status;
    (err as unknown as Record<string, unknown>)['body'] = body;
    throw err;
  },

  setVersion,
  getVersion,
};

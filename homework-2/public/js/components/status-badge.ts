export type TicketStatus = 'new' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

const STATUS_CONFIG: Record<TicketStatus, { dot: string; label: string; cls: string }> = {
  new:              { dot: '○', label: 'New',              cls: 'badge-new' },
  in_progress:      { dot: '●', label: 'In progress',      cls: 'badge-in_progress' },
  waiting_customer: { dot: '◐', label: 'Waiting customer', cls: 'badge-waiting_customer' },
  resolved:         { dot: '✓', label: 'Resolved',         cls: 'badge-resolved' },
  closed:           { dot: '—', label: 'Closed',           cls: 'badge-closed' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { icon: string; label: string; cls: string }> = {
  urgent: { icon: '!!', label: 'Urgent', cls: 'badge-urgent' },
  high:   { icon: '▲',  label: 'High',   cls: 'badge-high' },
  medium: { icon: '─',  label: 'Medium', cls: 'badge-medium' },
  low:    { icon: '▽',  label: 'Low',    cls: 'badge-low' },
};

export function renderStatusBadge(status: string): string {
  const cfg = STATUS_CONFIG[status as TicketStatus] ?? { dot: '?', label: status, cls: 'badge-new' };
  return `<span class="badge-status ${cfg.cls}" aria-label="Status: ${cfg.label}">
    <span aria-hidden="true">${cfg.dot}</span>${cfg.label}
  </span>`;
}

export function renderPriorityBadge(priority: string): string {
  const cfg = PRIORITY_CONFIG[priority as TicketPriority] ?? { icon: '─', label: priority, cls: 'badge-medium' };
  return `<span class="badge-status ${cfg.cls}" aria-label="Priority: ${cfg.label}">
    <span aria-hidden="true">${cfg.icon}</span>${cfg.label}
  </span>`;
}

/** Inject a status badge into a DOM element by id */
export function setStatusBadge(elementId: string, status: string): void {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = renderStatusBadge(status);
}

/** Inject a priority badge into a DOM element by id */
export function setPriorityBadge(elementId: string, priority: string): void {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = renderPriorityBadge(priority);
}

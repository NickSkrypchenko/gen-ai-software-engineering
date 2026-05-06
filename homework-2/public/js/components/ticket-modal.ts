import { apiClient, type Ticket, type Transition, type Classification } from '../api-client.js';
import { renderStatusBadge, renderPriorityBadge } from './status-badge.js';
import { renderLatestClassification } from './classification-badge.js';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new:              ['in_progress'],
  in_progress:      ['waiting_customer', 'resolved'],
  waiting_customer: ['in_progress', 'resolved'],
  resolved:         ['in_progress', 'closed'],
  closed:           [],
};

const TRANSITION_LABELS: Record<string, string> = {
  in_progress:      '→ In progress',
  waiting_customer: '→ Waiting customer',
  resolved:         '✓ Resolved',
  closed:           '✗ Close',
};

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

export class TicketModal {
  private backdrop = document.getElementById('ticket-backdrop')!;
  private panel = document.getElementById('ticket-panel')!;
  private currentTicket: Ticket | null = null;
  private onUpdated?: (ticket: Ticket) => void;
  private onDeleted?: (id: string) => void;

  constructor(opts: { onUpdated?: (t: Ticket) => void; onDeleted?: (id: string) => void } = {}) {
    this.onUpdated = opts.onUpdated;
    this.onDeleted = opts.onDeleted;
    this.bindEvents();
  }

  open(ticket: Ticket): void {
    this.currentTicket = ticket;
    apiClient.setVersion(ticket.id, ticket.version);
    this.populate(ticket);
    this.switchTab('details');
    this.backdrop.classList.add('open');
    this.panel.classList.add('open');
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.panel.focus?.();
  }

  close(): void {
    this.backdrop.classList.remove('open');
    this.panel.classList.remove('open');
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.currentTicket = null;
  }

  private populate(t: Ticket): void {
    const set = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('modal-ticket-id', t.id);
    set('modal-ticket-subject', t.subject);
    set('modal-ticket-customer', `${t.customer_name ?? t.customer_id} · ${t.customer_email}`);
    set('modal-version', `v${t.version}`);
    set('modal-subject-full', t.subject);
    set('modal-description', t.description);
    set('modal-assigned', t.assigned_to ?? '—');
    set('modal-created-at', fmt(t.created_at));
    set('modal-updated-at', fmt(t.updated_at));

    const catBadge = document.getElementById('modal-category-badge');
    if (catBadge) catBadge.innerHTML = t.category
      ? `<span class="text-xs font-medium text-[var(--text)]">${t.category.replace('_', ' ')}</span>`
      : `<span class="text-xs text-[var(--muted)]">Unclassified</span>`;

    const priEl = document.getElementById('modal-priority-badge');
    if (priEl) priEl.innerHTML = renderPriorityBadge(t.priority);

    const statusDetail = document.getElementById('modal-status-badge-detail');
    if (statusDetail) statusDetail.innerHTML = renderStatusBadge(t.status);

    const tagsEl = document.getElementById('modal-tags');
    if (tagsEl) {
      tagsEl.innerHTML = (t.tags ?? []).length
        ? (t.tags ?? []).map(tag =>
            `<span class="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-[var(--muted)]">${tag}</span>`
          ).join('')
        : `<span class="text-xs text-[var(--muted)]">—</span>`;
    }

    this.renderTransitionButtons(t);
  }

  private renderTransitionButtons(t: Ticket): void {
    const container = document.getElementById('transition-buttons')!;
    const statusBadge = document.getElementById('modal-status-badge-status')!;
    statusBadge.innerHTML = renderStatusBadge(t.status);

    const allowed = ALLOWED_TRANSITIONS[t.status] ?? [];
    container.innerHTML = allowed.length === 0
      ? `<p class="text-xs text-[var(--muted)]">No transitions available from <strong>${t.status}</strong>.</p>`
      : allowed.map(to => `
          <button
            class="btn-sm"
            data-to="${to}"
            type="button"
            aria-label="Transition to ${to.replace('_', ' ')}"
          >${TRANSITION_LABELS[to] ?? to}</button>
        `).join('');

    container.querySelectorAll<HTMLButtonElement>('[data-to]').forEach(btn => {
      btn.addEventListener('click', () => this.handleTransition(btn.dataset['to']!));
    });
  }

  private async handleTransition(to: string): Promise<void> {
    if (!this.currentTicket) return;
    const reasonInput = document.getElementById('transition-reason') as HTMLInputElement;
    const reasonWrap = document.getElementById('transition-reason-wrap')!;
    const result = document.getElementById('transition-result')!;

    if (!reasonWrap.classList.contains('hidden') && reasonInput.value.trim()) {
      const reason = reasonInput.value.trim();
      try {
        const updated = await apiClient.transition(this.currentTicket.id, to, reason);
        this.currentTicket = updated;
        this.populate(updated);
        result.textContent = `Transitioned to ${to.replace('_', ' ')}`;
        result.classList.remove('hidden');
        reasonWrap.classList.add('hidden');
        reasonInput.value = '';
        this.onUpdated?.(updated);
      } catch (e: unknown) {
        const err = e as Error & { body?: { error?: string } };
        result.textContent = err.body?.error ?? err.message;
        result.classList.remove('hidden');
      }
    } else {
      reasonWrap.classList.remove('hidden');
      reasonWrap.querySelector<HTMLButtonElement>('input')?.focus();
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn-sm ml-2';
      confirmBtn.textContent = 'Confirm';
      confirmBtn.type = 'button';
      confirmBtn.setAttribute('aria-label', `Confirm transition to ${to}`);
      confirmBtn.onclick = () => this.handleTransition(to);
      reasonWrap.querySelector('p')?.appendChild(confirmBtn);
    }
  }

  private async loadHistory(ticketId: string): Promise<void> {
    const loading = document.getElementById('history-loading')!;
    const timeline = document.getElementById('history-timeline')!;
    const empty = document.getElementById('history-empty')!;

    loading.classList.remove('hidden');
    timeline.classList.add('hidden');
    empty.classList.add('hidden');

    try {
      const [transitions, classifications] = await Promise.all([
        apiClient.getTransitions(ticketId),
        apiClient.getClassifications(ticketId),
      ]);

      type Entry =
        | { kind: 'transition'; time: number; data: Transition }
        | { kind: 'classification'; time: number; data: Classification };

      const entries: Entry[] = [
        ...transitions.map(t => ({ kind: 'transition' as const, time: new Date(t.transitioned_at).getTime(), data: t })),
        ...classifications.map(c => ({ kind: 'classification' as const, time: new Date(c.classified_at).getTime(), data: c })),
      ].sort((a, b) => a.time - b.time);

      if (!entries.length) {
        empty.classList.remove('hidden');
        return;
      }

      timeline.innerHTML = entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        if (entry.kind === 'transition') {
          const t = entry.data as Transition;
          const by = t.transitioned_by ?? 'system';
          const dotCls = by === 'system' ? '' : 'agent';
          return `
            <div class="timeline-item">
              <div class="timeline-line">
                <div class="timeline-dot ${dotCls}" aria-hidden="true"></div>
                ${isLast ? '' : '<div class="timeline-connector"></div>'}
              </div>
              <div class="pb-1">
                <div class="flex items-baseline gap-2 mb-0.5">
                  <span class="text-xs font-medium text-[var(--text)]">${by}</span>
                  <time class="text-[10px] text-[var(--muted)] font-mono">${fmt(t.transitioned_at)}</time>
                </div>
                <p class="text-xs text-[var(--muted)]">
                  Transition: <span class="text-[var(--text)]">${t.from_status}</span>
                  → <span class="text-[var(--text)]">${t.to_status}</span>
                </p>
                ${t.reason ? `<p class="text-xs text-[var(--muted)] italic mt-0.5">"${t.reason}"</p>` : ''}
              </div>
            </div>`;
        } else {
          const c = entry.data as Classification;
          const keywords = (c.matched_keywords ?? [])
            .map(k => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted)]">${k}</span>`)
            .join(' ');
          return `
            <div class="timeline-item">
              <div class="timeline-line">
                <div class="timeline-dot classifier" aria-hidden="true"></div>
                ${isLast ? '' : '<div class="timeline-connector"></div>'}
              </div>
              <div class="pb-1">
                <div class="flex items-baseline gap-2 mb-0.5">
                  <span class="text-xs font-medium text-[var(--muted)]">classifier</span>
                  <time class="text-[10px] text-[var(--muted)] font-mono">${fmt(c.classified_at)}</time>
                </div>
                <p class="text-xs text-[var(--muted)]">
                  Classified: <span class="text-[var(--text)]">${c.category}</span> ·
                  <span class="text-[var(--text)]">${c.priority}</span>
                  <span class="font-mono">(${c.confidence.toFixed(2)})</span>
                </p>
                <div class="flex flex-wrap gap-1 mt-1">${keywords}</div>
              </div>
            </div>`;
        }
      }).join('');

      timeline.classList.remove('hidden');
    } catch {
      empty.textContent = 'Failed to load history.';
      empty.classList.remove('hidden');
    } finally {
      loading.classList.add('hidden');
    }
  }

  private switchTab(tab: 'details' | 'status' | 'history'): void {
    const tabs = ['details', 'status', 'history'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`)!;
      const panel = document.getElementById(`tab-${t}`)!;
      const active = t === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      panel.classList.toggle('hidden', !active);
    });
    if (tab === 'history' && this.currentTicket) {
      this.loadHistory(this.currentTicket.id);
    }
  }

  private bindEvents(): void {
    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', e => { if (e.target === this.backdrop) this.close(); });

    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(btn => {
      const tab = btn.dataset['tab'] as 'details' | 'status' | 'history';
      btn.addEventListener('click', () => this.switchTab(tab));
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.backdrop.classList.contains('open')) this.close();
    });

    document.getElementById('btn-classify')?.addEventListener('click', async () => {
      if (!this.currentTicket) return;
      const btn = document.getElementById('btn-classify') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const res = await apiClient.autoClassify(this.currentTicket.id);
        this.currentTicket = res.ticket;
        this.populate(res.ticket);
        this.onUpdated?.(res.ticket);
      } catch (e: unknown) {
        const err = e as Error;
        console.error('Classify failed', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Classify →';
      }
    });

    document.getElementById('btn-edit-assigned')?.addEventListener('click', () => {
      document.getElementById('assigned-edit-wrap')?.classList.toggle('hidden');
      (document.getElementById('assigned-input') as HTMLInputElement).value =
        this.currentTicket?.assigned_to ?? '';
    });

    document.getElementById('btn-save-assigned')?.addEventListener('click', async () => {
      if (!this.currentTicket) return;
      const input = document.getElementById('assigned-input') as HTMLInputElement;
      try {
        const updated = await apiClient.updateTicket(this.currentTicket.id, { assigned_to: input.value.trim() || null });
        this.currentTicket = updated;
        this.populate(updated);
        document.getElementById('assigned-edit-wrap')?.classList.add('hidden');
        this.onUpdated?.(updated);
      } catch (e: unknown) {
        const err = e as Error & { body?: { error?: string } };
        const errEl = document.getElementById('modal-action-error')!;
        errEl.textContent = err.body?.error ?? err.message;
        errEl.classList.remove('hidden');
      }
    });

    document.getElementById('btn-delete-ticket')?.addEventListener('click', async () => {
      if (!this.currentTicket) return;
      if (!confirm(`Delete ticket ${shortId(this.currentTicket.id)}? This cannot be undone.`)) return;
      try {
        await apiClient.deleteTicket(this.currentTicket.id);
        this.onDeleted?.(this.currentTicket.id);
        this.close();
      } catch (e: unknown) {
        const err = e as Error & { body?: { error?: string } };
        const errEl = document.getElementById('modal-action-error')!;
        errEl.textContent = err.body?.error ?? err.message;
        errEl.classList.remove('hidden');
      }
    });
  }
}

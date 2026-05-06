import { apiClient, type Ticket } from './api-client.js';
import { renderStatusBadge, renderPriorityBadge } from './components/status-badge.js';
import { TicketModal } from './components/ticket-modal.js';
import { ImportDropzone } from './import-dropzone.js';

const LIMIT = 50;
let currentPage = 0;
let totalCount = 0;
let currentFilters: Record<string, string> = {};
let modal: TicketModal;

function shortId(id: string): string { return id.slice(0, 8); }

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(s: string, n = 60): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

function setLoading(on: boolean): void {
  document.getElementById('table-loading')?.classList.toggle('hidden', !on);
}

async function updateNavCount(): Promise<void> {
  try {
    const res = await apiClient.listTickets({ status: 'new', limit: '1' });
    const el = document.getElementById('nav-open-count');
    if (el) el.textContent = `${res.count} open`;
  } catch { /* ignore */ }
}

function buildRow(t: Ticket): string {
  return `
    <tr tabindex="0" role="row" data-ticket-id="${t.id}" aria-label="Ticket ${shortId(t.id)} — ${t.subject}">
      <td><span class="font-mono text-xs text-[var(--muted)]">${shortId(t.id)}…</span></td>
      <td>
        <div class="text-sm font-medium text-[var(--text)] truncate max-w-[120px]">${t.customer_name ?? t.customer_id}</div>
        <div class="text-xs text-[var(--muted)] truncate max-w-[120px]">${t.customer_email}</div>
      </td>
      <td>
        <span class="text-sm" title="${t.subject}">${truncate(t.subject)}</span>
      </td>
      <td>
        <span class="text-xs text-[var(--muted)]">${(t.category ?? '—').replace('_', ' ')}</span>
      </td>
      <td>${renderStatusBadge(t.status)}</td>
      <td>${renderPriorityBadge(t.priority)}</td>
      <td><span class="text-xs text-[var(--muted)] tabular-nums">${fmt(t.created_at)}</span></td>
    </tr>`;
}

function buildMobileCard(t: Ticket): string {
  return `
    <div class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors duration-100" tabindex="0" data-ticket-id="${t.id}" role="button" aria-label="View ticket ${shortId(t.id)}">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          ${renderStatusBadge(t.status)}
          ${renderPriorityBadge(t.priority)}
        </div>
        <p class="text-sm font-medium truncate text-[var(--text)]">${truncate(t.subject, 50)}</p>
        <p class="text-xs text-[var(--muted)] truncate">${t.customer_name ?? t.customer_id}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="text-[var(--muted)] flex-shrink-0" aria-hidden="true">
        <path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
}

async function loadTickets(page = 0): Promise<void> {
  currentPage = page;
  setLoading(true);
  const params: Record<string, string> = { ...currentFilters, limit: String(LIMIT), offset: String(page * LIMIT) };
  Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });

  try {
    const res = await apiClient.listTickets(params);
    totalCount = res.count;

    const tbody = document.getElementById('ticket-tbody')!;
    const mobileList = document.getElementById('mobile-list')!;
    const emptyRow = document.getElementById('table-empty-row')!;
    const summary = document.getElementById('table-summary')!;

    if (!res.data.length) {
      tbody.innerHTML = '';
      tbody.appendChild(emptyRow);
      emptyRow.classList.remove('hidden');
      mobileList.innerHTML = '<p class="p-4 text-sm text-[var(--muted)]">No tickets match the current filters.</p>';
      summary.textContent = '0 tickets';
    } else {
      emptyRow.classList.add('hidden');
      tbody.innerHTML = res.data.map(buildRow).join('');
      mobileList.innerHTML = res.data.map(buildMobileCard).join('');
      const start = page * LIMIT + 1;
      const end = Math.min(page * LIMIT + res.data.length, totalCount);
      summary.textContent = `Showing ${start}–${end} of ${totalCount}`;
    }

    renderPagination();
    updateActiveFilters();
    updateNavCount();

    const openTicket = async (id: string) => {
      const ticket = await apiClient.getTicket(id);
      modal.open(ticket);
    };

    tbody.querySelectorAll<HTMLTableRowElement>('[data-ticket-id]').forEach(row => {
      row.addEventListener('click', () => openTicket(row.dataset['ticketId']!));
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openTicket(row.dataset['ticketId']!); });
    });
    mobileList.querySelectorAll<HTMLElement>('[data-ticket-id]').forEach(card => {
      card.addEventListener('click', () => openTicket(card.dataset['ticketId']!));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openTicket(card.dataset['ticketId']!); });
    });
  } catch (e) {
    console.error('Failed to load tickets', e);
    document.getElementById('table-summary')!.textContent = 'Failed to load tickets.';
  } finally {
    setLoading(false);
  }
}

function renderPagination(): void {
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const pageInfo = document.getElementById('page-info')!;
  const pagebtns = document.getElementById('page-btns')!;
  const prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;
  const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;

  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage >= totalPages - 1;
  pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;

  const range = 3;
  const start = Math.max(0, currentPage - range);
  const end = Math.min(totalPages - 1, currentPage + range);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  pagebtns.innerHTML = pages.map(p => `
    <button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}" type="button" aria-label="Page ${p + 1}" ${p === currentPage ? 'aria-current="page"' : ''}>${p + 1}</button>
  `).join('');
  pagebtns.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => loadTickets(parseInt(btn.dataset['page']!, 10)));
  });
}

function collectFilters(): Record<string, string> {
  const status = (document.getElementById('filter-status') as HTMLSelectElement).value;
  const category = (document.getElementById('filter-category') as HTMLSelectElement).value;
  const priority = (document.getElementById('filter-priority') as HTMLSelectElement).value;
  const assigned = (document.getElementById('filter-assigned') as HTMLInputElement).value.trim();
  const q = (document.getElementById('filter-search') as HTMLInputElement).value.trim();
  return { status, category, priority, assigned_to: assigned, q };
}

function updateActiveFilters(): void {
  const el = document.getElementById('active-filters')!;
  const active = Object.entries(currentFilters).filter(([, v]) => v);
  if (!active.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.textContent = 'Active: ' + active.map(([k, v]) => `${k}=${v}`).join(' · ');
}

function initFilters(): void {
  const form = document.getElementById('filter-form')!;
  form.addEventListener('submit', e => {
    e.preventDefault();
    currentFilters = collectFilters();
    loadTickets(0);
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    (document.getElementById('filter-status') as HTMLSelectElement).value = '';
    (document.getElementById('filter-category') as HTMLSelectElement).value = '';
    (document.getElementById('filter-priority') as HTMLSelectElement).value = '';
    (document.getElementById('filter-assigned') as HTMLInputElement).value = '';
    (document.getElementById('filter-search') as HTMLInputElement).value = '';
    currentFilters = {};
    loadTickets(0);
  });

  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (currentPage > 0) loadTickets(currentPage - 1);
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (currentPage < Math.ceil(totalCount / LIMIT) - 1) loadTickets(currentPage + 1);
  });
}

function initCreateTicket(): void {
  const backdrop = document.getElementById('create-backdrop')!;
  const panel = document.getElementById('create-panel')!;
  const form = document.getElementById('create-form') as HTMLFormElement;

  const openCreate = () => {
    backdrop.classList.add('open');
    panel.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    (document.getElementById('new-customer-id') as HTMLInputElement).focus();
  };
  const closeCreate = () => {
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  };

  document.getElementById('btn-new-ticket')?.addEventListener('click', openCreate);
  document.getElementById('btn-close-create')?.addEventListener('click', closeCreate);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeCreate(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('create-error')!;
    errEl.classList.add('hidden');

    const data = {
      customer_id: (document.getElementById('new-customer-id') as HTMLInputElement).value.trim(),
      customer_email: (document.getElementById('new-customer-email') as HTMLInputElement).value.trim(),
      customer_name: (document.getElementById('new-customer-name') as HTMLInputElement).value.trim() || undefined,
      subject: (document.getElementById('new-subject') as HTMLInputElement).value.trim(),
      description: (document.getElementById('new-description') as HTMLTextAreaElement).value.trim(),
      priority: (document.getElementById('new-priority') as HTMLSelectElement).value as Ticket['priority'],
      assigned_to: (document.getElementById('new-assigned-to') as HTMLInputElement).value.trim() || undefined,
    };

    const submitBtn = document.getElementById('btn-create-submit') as HTMLButtonElement;
    submitBtn.disabled = true;

    try {
      await apiClient.createTicket(data);
      form.reset();
      closeCreate();
      loadTickets(0);
    } catch (err: unknown) {
      const e = err as Error & { body?: { error?: string; details?: Array<{field: string; message: string}> } };
      errEl.textContent = e.body?.error ?? e.message;
      errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function initImportSection(): void {
  const toggleBtn = document.getElementById('btn-toggle-import')!;
  const section = document.getElementById('import-section')!;
  const chevron = document.getElementById('import-chevron')!;

  toggleBtn.addEventListener('click', () => {
    const open = section.classList.toggle('hidden');
    toggleBtn.setAttribute('aria-expanded', String(!open));
    chevron.style.transform = open ? '' : 'rotate(180deg)';
  });

  new ImportDropzone({
    onComplete: (summary) => {
      if (summary.imported > 0) loadTickets(0);
    },
  });
}

function initScrollReveal(): void {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  modal = new TicketModal({
    onUpdated: (ticket) => {
      const row = document.querySelector<HTMLElement>(`[data-ticket-id="${ticket.id}"]`);
      if (row && row.tagName === 'TR') {
        row.outerHTML = buildRow(ticket);
      }
      loadTickets(currentPage);
    },
    onDeleted: () => loadTickets(currentPage),
  });

  initFilters();
  initCreateTicket();
  initImportSection();
  initScrollReveal();
  loadTickets(0);
  updateNavCount();
});

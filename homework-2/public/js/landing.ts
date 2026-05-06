/**
 * Landing page: try-it panels, state-machine SVG interactivity, live stats.
 */

const BASE = '/api';

// ── Live open-ticket count ────────────────────────────────────────────────────

async function updateOpenCount(): Promise<void> {
  try {
    const res = await fetch(`${BASE}/tickets?status=new&limit=1`);
    if (!res.ok) return;
    const data = await res.json();
    document.querySelectorAll<HTMLElement>('.live-open-count').forEach(el => {
      el.textContent = String(data.count ?? '—');
    });
  } catch { /* network unavailable, ignore */ }
}

// ── Try-it panels ─────────────────────────────────────────────────────────────

interface TryItConfig {
  btnId: string;
  panelId: string;
  bodyId?: string;
  resultId: string;
  sendId: string;
  method: string;
  path: string;
  requiresBody?: boolean;
}

const TRY_IT_PANELS: TryItConfig[] = [
  {
    btnId:  'try-btn-create',
    panelId: 'try-panel-create',
    bodyId:  'try-body-create',
    resultId: 'try-result-create',
    sendId:  'try-send-create',
    method: 'POST',
    path:   '/api/tickets',
    requiresBody: true,
  },
  {
    btnId:  'try-btn-list',
    panelId: 'try-panel-list',
    resultId: 'try-result-list',
    sendId:  'try-send-list',
    method: 'GET',
    path:   '/api/tickets?limit=5',
  },
  {
    btnId:  'try-btn-health',
    panelId: 'try-panel-health',
    resultId: 'try-result-health',
    sendId:  'try-send-health',
    method: 'GET',
    path:   '/health',
  },
];

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function initTryItPanel(cfg: TryItConfig): void {
  const btn = document.getElementById(cfg.btnId);
  const panel = document.getElementById(cfg.panelId);
  const sendBtn = document.getElementById(cfg.sendId);
  const resultEl = document.getElementById(cfg.resultId);
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.try-arrow')?.classList.toggle('rotate-90', open);
  });

  sendBtn?.addEventListener('click', async () => {
    if (!resultEl) return;
    resultEl.textContent = 'Sending…';
    resultEl.className = 'font-mono text-xs whitespace-pre-wrap text-[var(--muted)] mt-3 block';

    let fetchInit: RequestInit = { method: cfg.method };
    if (cfg.requiresBody && cfg.bodyId) {
      const bodyEl = document.getElementById(cfg.bodyId) as HTMLTextAreaElement | null;
      if (bodyEl) {
        try {
          JSON.parse(bodyEl.value);
          fetchInit = {
            ...fetchInit,
            headers: { 'Content-Type': 'application/json' },
            body: bodyEl.value,
          };
        } catch {
          resultEl.textContent = '✗ Invalid JSON in request body';
          resultEl.classList.add('text-[var(--red)]');
          return;
        }
      }
    }

    try {
      const res = await fetch(cfg.path, fetchInit);
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      const statusColor = res.ok ? 'text-[var(--emerald)]' : 'text-[var(--red)]';
      resultEl.innerHTML =
        `<span class="${statusColor} font-semibold">${res.status} ${res.statusText}</span>\n` +
        `<span class="text-[var(--muted)]">${formatJson(parsed)}</span>`;
    } catch (e: unknown) {
      const err = e as Error;
      resultEl.textContent = `✗ Network error: ${err.message}`;
      resultEl.classList.add('text-[var(--red)]');
    }
  });
}

// ── Curl tab switcher (bulk import section) ───────────────────────────────────

function initCurlTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-curl-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['curlTab']!;
      document.querySelectorAll<HTMLButtonElement>('[data-curl-tab]').forEach(b => {
        b.classList.toggle('active', b.dataset['curlTab'] === tab);
        b.setAttribute('aria-selected', String(b.dataset['curlTab'] === tab));
      });
      document.querySelectorAll<HTMLElement>('[data-curl-content]').forEach(c => {
        c.classList.toggle('hidden', c.dataset['curlContent'] !== tab);
      });
    });
  });
}

// ── State machine SVG interactivity ──────────────────────────────────────────

const FSM_DESCRIPTIONS: Record<string, string> = {
  new:              'Ticket created. Waiting to be picked up.',
  in_progress:      'Agent is actively working on the ticket.',
  waiting_customer: 'Awaiting reply or action from the customer.',
  resolved:         'Issue resolved. Customer can reopen if needed.',
  closed:           'Ticket permanently closed. No further transitions.',
};

function initStateMachineSVG(): void {
  const nodes = document.querySelectorAll<SVGElement>('.fsm-node-group');
  const descEl = document.getElementById('fsm-description');
  if (!nodes.length) return;

  nodes.forEach(node => {
    const status = node.dataset['status'];
    if (!status) return;

    node.addEventListener('mouseenter', () => {
      if (descEl) {
        descEl.textContent = FSM_DESCRIPTIONS[status] ?? '';
        descEl.classList.remove('hidden');
      }
      node.querySelector('.fsm-node')?.setAttribute('data-hover', 'true');
    });
    node.addEventListener('mouseleave', () => {
      if (descEl) descEl.classList.add('hidden');
      node.querySelector('.fsm-node')?.removeAttribute('data-hover');
    });
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Status: ${status.replace('_', ' ')} — ${FSM_DESCRIPTIONS[status] ?? ''}`);
    node.addEventListener('focus', () => {
      if (descEl) {
        descEl.textContent = FSM_DESCRIPTIONS[status] ?? '';
        descEl.classList.remove('hidden');
      }
    });
    node.addEventListener('blur', () => {
      if (descEl) descEl.classList.add('hidden');
    });
  });
}

// ── Scroll reveal ─────────────────────────────────────────────────────────────

function initScrollReveal(): void {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    }),
    { threshold: 0.05 },
  );
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Hamburger menu (mobile) ───────────────────────────────────────────────────

function initMobileMenu(): void {
  const btn = document.getElementById('nav-menu-btn');
  const overlay = document.getElementById('nav-overlay');
  if (!btn || !overlay) return;

  btn.addEventListener('click', () => {
    const open = overlay.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    overlay.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      overlay.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  TRY_IT_PANELS.forEach(initTryItPanel);
  initCurlTabs();
  initStateMachineSVG();
  initScrollReveal();
  initMobileMenu();
  updateOpenCount();
});

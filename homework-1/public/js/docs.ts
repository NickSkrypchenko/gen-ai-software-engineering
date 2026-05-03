import { api, ApiClientError } from './api-client';

// ─── live health status ───────────────────────────────────────────────────────
async function initHealthPill() {
  const pill = document.querySelector<HTMLElement>('#health-pill');
  if (!pill) return;
  try {
    const h = await api.health();
    if (h.status === 'ok') {
      pill.textContent = '● Live';
      pill.className = pill.className
        .replace(/text-\w+-\d+|border-\w+-\d+|bg-\w+-\d+/g, '')
        + ' text-green-600 border-green-200 bg-green-50';
    }
  } catch {
    pill.textContent = '● Offline';
    pill.className = pill.className
      .replace(/text-\w+-\d+|border-\w+-\d+|bg-\w+-\d+/g, '')
      + ' text-red-500 border-red-200 bg-red-50';
  }
}

// ─── try-it panels ────────────────────────────────────────────────────────────
function initTryItPanels() {
  document.querySelectorAll<HTMLButtonElement>('[data-try-it]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.getAttribute('data-try-it')!;
      const panel = document.querySelector<HTMLElement>(`#panel-${panelId}`);
      if (!panel) return;
      const isHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-expanded', String(isHidden));
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-try-submit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpointId = btn.getAttribute('data-try-submit')!;
      const panel = btn.closest<HTMLElement>('[id^="panel-"]');
      if (!panel) return;

      const output = panel.querySelector<HTMLElement>('.try-output');
      if (!output) return;
      output.textContent = 'Fetching…';

      const get = (name: string) =>
        panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? '';

      try {
        let result: unknown;

        if (endpointId === 'health') {
          result = await api.health();
        } else if (endpointId === 'list') {
          const txns = await api.listTransactions({ accountId: get('accountId') || undefined });
          result = txns;
        } else if (endpointId === 'create') {
          result = await api.createTransaction({
            fromAccount: get('fromAccount') || 'EXTERNAL',
            toAccount:   get('toAccount')   || 'ACC-AAAAA',
            amount:      parseFloat(get('amount') || '100'),
            currency:    (get('currency') || 'USD') as any,
            type:        (get('type')     || 'deposit') as any,
          });
        } else if (endpointId === 'get-by-id') {
          const id = get('id');
          if (!id) { output.textContent = 'Enter a transaction ID first.'; return; }
          result = await api.getTransaction(id);
        } else if (endpointId === 'balance') {
          const acct = get('accountId');
          if (!acct) { output.textContent = 'Enter an account ID first.'; return; }
          result = await api.getBalances(acct);
        } else if (endpointId === 'summary') {
          const acct = get('accountId');
          if (!acct) { output.textContent = 'Enter an account ID first.'; return; }
          result = await api.getSummary(acct);
        } else if (endpointId === 'export') {
          output.textContent = 'Triggering CSV download…';
          window.location.href = api.exportCSVUrl({ accountId: get('accountId') || undefined });
          return;
        }

        output.textContent = JSON.stringify(result, null, 2);
      } catch (err) {
        const body = err instanceof ApiClientError ? err.data : { error: String(err) };
        output.textContent = JSON.stringify(body, null, 2);
      }
    });
  });
}

// ─── scroll reveal ────────────────────────────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add('reveal-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

// ─── mobile nav ───────────────────────────────────────────────────────────────
function initMobileMenu() {
  const burger  = document.querySelector<HTMLButtonElement>('#burger-btn');
  const overlay = document.querySelector<HTMLElement>('#mobile-overlay');
  const close   = document.querySelector<HTMLButtonElement>('#close-overlay');
  const links   = document.querySelectorAll<HTMLElement>('#overlay-links li');

  if (!burger || !overlay) return;

  function open() {
    overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    links.forEach((li, i) => {
      li.style.transitionDelay = `${80 + i * 50}ms`;
      li.classList.remove('opacity-0', 'translate-y-4');
      li.classList.add('opacity-100', 'translate-y-0');
    });
  }

  function closeMenu() {
    links.forEach(li => {
      li.classList.remove('opacity-100', 'translate-y-0');
      li.classList.add('opacity-0', 'translate-y-4');
    });
    setTimeout(() => {
      overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }, 250);
  }

  burger.addEventListener('click', open);
  close?.addEventListener('click', closeMenu);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeMenu();
  });
}

initHealthPill();
initTryItPanels();
initScrollReveal();
initMobileMenu();

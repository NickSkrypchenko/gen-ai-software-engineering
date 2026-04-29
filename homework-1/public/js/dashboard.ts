import { api } from './api-client';
import type { Transaction, TransactionType } from './api-client';
import { renderBalanceCards, renderSummaryStats } from './components/balance-card';
import { renderTransactionTable, renderMobileCards } from './components/tx-table';
import { mountTransactionForm } from './components/tx-form';

// ─── state ───────────────────────────────────────────────────────────────────
let allTxns: Transaction[] = [];
let accounts: string[] = [];
let currentAccountId = '';
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// ─── helpers ─────────────────────────────────────────────────────────────────
function $<T extends HTMLElement>(sel: string): T {
  return document.querySelector<T>(sel)!;
}

function getFilterValues() {
  return {
    accountId: $<HTMLSelectElement>('#f-account').value || undefined,
    type:      ($<HTMLSelectElement>('#f-type').value as TransactionType) || undefined,
    from:      $<HTMLInputElement>('#f-from').value
                 ? new Date($<HTMLInputElement>('#f-from').value).toISOString() : undefined,
    to:        $<HTMLInputElement>('#f-to').value
                 ? new Date($<HTMLInputElement>('#f-to').value).toISOString() : undefined,
  };
}

function applyFilters() {
  const { accountId, type, from, to } = getFilterValues();
  const filtered = allTxns.filter(t => {
    if (accountId && t.fromAccount !== accountId && t.toAccount !== accountId) return false;
    if (type      && t.type !== type)        return false;
    if (from      && t.timestamp < from)     return false;
    if (to        && t.timestamp > to)       return false;
    return true;
  });

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    renderMobileCards($('#tx-container'), filtered);
  } else {
    renderTransactionTable($('#tx-container'), filtered, accountId);
  }
}

// ─── account sidebar ─────────────────────────────────────────────────────────
async function loadAccountSidebar(accountId: string) {
  if (!accountId) {
    $<HTMLDivElement>('#sidebar-data').classList.add('hidden');
    return;
  }
  try {
    const [balances, summary] = await Promise.all([
      api.getBalances(accountId),
      api.getSummary(accountId),
    ]);
    renderBalanceCards($('#balance-cards'), balances);
    renderSummaryStats($('#summary-stats'), summary);
    $<HTMLDivElement>('#sidebar-data').classList.remove('hidden');
  } catch {
    $<HTMLDivElement>('#sidebar-data').classList.add('hidden');
  }
}

// ─── toasts & banners ────────────────────────────────────────────────────────
function showToast(message: string) {
  const toast = $('#success-toast');
  $('#toast-text').textContent = message;
  toast.classList.remove('opacity-0', 'translate-x-full');
  toast.classList.add('opacity-100', 'translate-x-0');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-x-0');
    toast.classList.add('opacity-0', 'translate-x-full');
  }, 4000);
}

function showWarning(message: string) {
  $('#banner-text').textContent = message;
  $('#failure-banner').classList.remove('hidden');
}

// ─── init ────────────────────────────────────────────────────────────────────
async function init() {
  // Load all transactions
  try {
    allTxns = await api.listTransactions();
  } catch {
    allTxns = [];
  }

  // Discover unique real accounts
  const seen = new Set<string>();
  allTxns.forEach(t => {
    if (t.fromAccount !== 'EXTERNAL') seen.add(t.fromAccount);
    if (t.toAccount   !== 'EXTERNAL') seen.add(t.toAccount);
  });
  accounts = Array.from(seen).sort();

  // Populate account dropdowns
  const acctOpts =
    `<option value="">All accounts</option>` +
    accounts.map(a => `<option value="${a}">${a}</option>`).join('');
  $<HTMLSelectElement>('#account-picker').innerHTML = acctOpts;
  $<HTMLSelectElement>('#f-account').innerHTML      = acctOpts;

  // Mount the transaction form
  mountTransactionForm($('#tx-form-container'), {
    accounts,
    onSuccess(txn) {
      showToast(`Transaction ${txn.id} completed.`);
      allTxns = [txn, ...allTxns];
      applyFilters();
    },
    onFailure(txn) {
      showWarning(`Transaction failed: ${txn.failureReason ?? 'INSUFFICIENT_FUNDS'}`);
      allTxns = [txn, ...allTxns];
      applyFilters();
    },
    onError(err) {
      showWarning(err.message);
    },
  });

  // Restore URL params
  const params = new URLSearchParams(location.search);
  const paramAcct = params.get('accountId');
  if (paramAcct && accounts.includes(paramAcct)) {
    $<HTMLSelectElement>('#account-picker').value = paramAcct;
    $<HTMLSelectElement>('#f-account').value      = paramAcct;
    currentAccountId = paramAcct;
    await loadAccountSidebar(currentAccountId);
  }

  applyFilters();

  // ─── event listeners ────────────────────────────────────────────────────────
  $<HTMLSelectElement>('#account-picker').addEventListener('change', async e => {
    currentAccountId = (e.target as HTMLSelectElement).value;
    $<HTMLSelectElement>('#f-account').value = currentAccountId;

    const p = new URLSearchParams(location.search);
    if (currentAccountId) p.set('accountId', currentAccountId);
    else p.delete('accountId');
    history.pushState(null, '', `${location.pathname}${p.toString() ? '?' + p : ''}`);

    await loadAccountSidebar(currentAccountId);
    applyFilters();
  });

  $<HTMLSelectElement>('#f-account').addEventListener('change', e => {
    const val = (e.target as HTMLSelectElement).value;
    $<HTMLSelectElement>('#account-picker').value = val;
    $<HTMLSelectElement>('#account-picker').dispatchEvent(new Event('change'));
  });

  ['#f-type', '#f-from', '#f-to'].forEach(sel =>
    $(sel).addEventListener('change', applyFilters),
  );

  $<HTMLButtonElement>('#export-btn').addEventListener('click', () => {
    window.location.href = api.exportCSVUrl(getFilterValues());
  });

  $<HTMLButtonElement>('#new-txn-btn')?.addEventListener('click', () => {
    const target = document.getElementById('form-section');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $<HTMLButtonElement>('#dismiss-banner')?.addEventListener('click', () => {
    $('#failure-banner').classList.add('hidden');
  });

  window.addEventListener('resize', applyFilters);
}

init();

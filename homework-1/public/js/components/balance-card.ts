import type { BalancesResponse, SummaryResponse } from '../api-client';

export function renderBalanceCards(container: HTMLElement, balances: BalancesResponse): void {
  if (balances.balances.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-400 py-2">No balances yet.</p>`;
    return;
  }

  container.innerHTML = balances.balances
    .map(b => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: b.currency,
        minimumFractionDigits: 2,
      }).format(b.amount);
      return `
        <div class="p-1.5 rounded-2xl ring-1 ring-black/[0.05] bg-black/[0.02]">
          <div class="p-3 rounded-[calc(1rem-0.375rem)] bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
            <p class="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold mb-1">${b.currency}</p>
            <p class="text-2xl font-bold text-gray-900 leading-none">${formatted}</p>
          </div>
        </div>`;
    })
    .join('');
}

export function renderSummaryStats(container: HTMLElement, summary: SummaryResponse): void {
  const totals = summary.perCurrency.reduce(
    (acc, c) => ({
      deposits:     acc.deposits + c.totalDeposits,
      withdrawals:  acc.withdrawals + c.totalWithdrawals,
      count:        acc.count + c.transactionCount,
      lastAt:
        !acc.lastAt || (c.lastTransactionAt && c.lastTransactionAt > acc.lastAt)
          ? c.lastTransactionAt
          : acc.lastAt,
    }),
    { deposits: 0, withdrawals: 0, count: 0, lastAt: null as string | null },
  );

  const lastLabel = totals.lastAt
    ? new Date(totals.lastAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      <div>
        <p class="text-[11px] uppercase tracking-[0.08em] text-gray-400 mb-0.5">In</p>
        <p class="text-sm font-semibold text-gray-900">$${totals.deposits.toFixed(2)}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Out</p>
        <p class="text-sm font-semibold text-gray-900">$${totals.withdrawals.toFixed(2)}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Count</p>
        <p class="text-sm font-semibold text-gray-900">${totals.count}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Last</p>
        <p class="text-sm font-semibold text-gray-900">${lastLabel}</p>
      </div>
    </div>`;
}

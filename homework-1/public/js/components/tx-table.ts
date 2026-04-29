import type { Transaction } from '../api-client';

export function renderTransactionTable(
  container: HTMLElement,
  transactions: Transaction[],
  viewerAccountId?: string,
): void {
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="mb-3 opacity-40">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-sm">No transactions found.</p>
      </div>`;
    return;
  }

  const rows = transactions.map(txn => {
    const isFailed = txn.status === 'failed';
    const rowCls = isFailed
      ? 'bg-red-50'
      : 'bg-white hover:bg-blue-50/40';
    const badge = isFailed
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">
           <span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>Failed
         </span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-600">
           <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Done
         </span>`;

    const time = new Date(txn.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
    const amt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: txn.currency,
    }).format(txn.amount);
    const tipAttr = isFailed && txn.failureReason
      ? `title="${txn.failureReason}" aria-label="${txn.failureReason}"`
      : '';

    return `
      <tr class="${rowCls} transition-colors duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)] border-b border-gray-100 last:border-0" ${tipAttr}>
        <td class="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">${time}</td>
        <td class="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[110px]" title="${txn.id}">${txn.id.slice(0, 18)}…</td>
        <td class="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
          <span class="text-gray-400">${txn.fromAccount}</span>
          <span class="mx-1 text-gray-300">→</span>
          <span>${txn.toAccount}</span>
        </td>
        <td class="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap tabular-nums">${amt}</td>
        <td class="px-4 py-3 text-xs text-gray-500 capitalize">${txn.type}</td>
        <td class="px-4 py-3">${badge}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="w-full text-left table-fixed">
      <colgroup>
        <col class="w-[72px]" />
        <col class="w-[130px]" />
        <col />
        <col class="w-[110px]" />
        <col class="w-[90px]" />
        <col class="w-[100px]" />
      </colgroup>
      <thead>
        <tr class="bg-gray-50 border-b border-gray-200">
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Time</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">ID</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">From → To</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Amount</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Type</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderMobileCards(container: HTMLElement, transactions: Transaction[]): void {
  if (transactions.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-400 py-8 text-center">No transactions found.</p>`;
    return;
  }

  container.innerHTML = transactions.map(txn => {
    const isFailed = txn.status === 'failed';
    const borderColor = isFailed ? 'border-red-400' : 'border-green-400';
    const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: txn.currency }).format(txn.amount);
    const time = new Date(txn.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="p-4 bg-white rounded-xl border-l-4 ${borderColor} ring-1 ring-black/[0.04] mb-3">
        <div class="flex items-start justify-between mb-2">
          <p class="text-xs font-mono text-gray-400 truncate max-w-[180px]">${txn.id}</p>
          <span class="text-xs text-gray-400 ml-2 whitespace-nowrap">${time}</span>
        </div>
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-700">${txn.fromAccount} → ${txn.toAccount}</p>
          <p class="text-sm font-bold text-gray-900 tabular-nums">${amt}</p>
        </div>
        ${isFailed && txn.failureReason ? `<p class="mt-1.5 text-xs text-red-500">${txn.failureReason}</p>` : ''}
      </div>`;
  }).join('');
}

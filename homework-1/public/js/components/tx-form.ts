import { api, ApiClientError, CURRENCIES } from '../api-client';
import type { Transaction } from '../api-client';

interface TxFormOptions {
  accounts: string[];
  onSuccess: (txn: Transaction) => void;
  onFailure: (txn: Transaction) => void;
  onError: (err: Error) => void;
}

export function mountTransactionForm(container: HTMLElement, options: TxFormOptions): void {
  const acctOptions = options.accounts
    .map(a => `<option value="${a}">${a}</option>`)
    .join('');
  const currOptions = CURRENCIES.map(c => `<option value="${c}"${c === 'USD' ? ' selected' : ''}>${c}</option>`).join('');

  container.innerHTML = `
    <form id="tx-form" class="space-y-4" novalidate autocomplete="off">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[13px] font-semibold text-gray-900 mb-1.5" for="f-from">From</label>
          <select id="f-from" name="fromAccount"
            class="w-full px-3 py-2 rounded-lg ring-1 ring-black/[0.08] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200">
            <option value="EXTERNAL">EXTERNAL</option>
            ${acctOptions}
          </select>
          <p class="mt-1 text-xs text-red-600 hidden" id="err-fromAccount" aria-live="polite"></p>
        </div>
        <div>
          <label class="block text-[13px] font-semibold text-gray-900 mb-1.5" for="f-to">To</label>
          <select id="f-to" name="toAccount"
            class="w-full px-3 py-2 rounded-lg ring-1 ring-black/[0.08] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200">
            ${acctOptions}
            <option value="EXTERNAL">EXTERNAL</option>
          </select>
          <p class="mt-1 text-xs text-red-600 hidden" id="err-toAccount" aria-live="polite"></p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div class="col-span-2">
          <label class="block text-[13px] font-semibold text-gray-900 mb-1.5" for="f-amount">Amount</label>
          <input type="number" id="f-amount" name="amount" min="0.01" max="1000000" step="0.01"
            placeholder="0.00"
            class="w-full px-3 py-2 rounded-lg ring-1 ring-black/[0.08] bg-white text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
          <p class="mt-1 text-xs text-red-600 hidden" id="err-amount" aria-live="polite"></p>
        </div>
        <div>
          <label class="block text-[13px] font-semibold text-gray-900 mb-1.5" for="f-currency">Currency</label>
          <select id="f-currency" name="currency"
            class="w-full px-3 py-2 rounded-lg ring-1 ring-black/[0.08] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200">
            ${currOptions}
          </select>
        </div>
      </div>

      <div>
        <label class="block text-[13px] font-semibold text-gray-900 mb-1.5" for="f-type">Type</label>
        <select id="f-type" name="type"
          class="w-full px-3 py-2 rounded-lg ring-1 ring-black/[0.08] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200">
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="transfer">Transfer</option>
        </select>
        <p class="mt-1 text-xs text-red-600 hidden" id="err-type" aria-live="polite"></p>
      </div>

      <button type="submit" id="tx-submit"
        class="group w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
        <span id="tx-label">Create Transaction</span>
        <span class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
          <svg id="tx-arrow" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
          </svg>
          <svg id="tx-spinner" class="hidden animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" stroke-width="2.5"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </span>
      </button>
    </form>`;

  const form    = container.querySelector<HTMLFormElement>('#tx-form')!;
  const submit  = container.querySelector<HTMLButtonElement>('#tx-submit')!;
  const label   = container.querySelector<HTMLElement>('#tx-label')!;
  const arrow   = container.querySelector<HTMLElement>('#tx-arrow')!;
  const spinner = container.querySelector<HTMLElement>('#tx-spinner')!;
  const fromSel = form.querySelector<HTMLSelectElement>('[name="fromAccount"]')!;
  const toSel   = form.querySelector<HTMLSelectElement>('[name="toAccount"]')!;
  const typeSel = form.querySelector<HTMLSelectElement>('[name="type"]')!;

  function autoType() {
    const f = fromSel.value, t = toSel.value;
    if (f === 'EXTERNAL' && t !== 'EXTERNAL')      typeSel.value = 'deposit';
    else if (f !== 'EXTERNAL' && t === 'EXTERNAL') typeSel.value = 'withdrawal';
    else if (f !== 'EXTERNAL' && t !== 'EXTERNAL') typeSel.value = 'transfer';
  }
  fromSel.addEventListener('change', autoType);
  toSel.addEventListener('change', autoType);

  function clearErrors() {
    container.querySelectorAll('[id^="err-"]').forEach(el => {
      el.textContent = '';
      el.classList.add('hidden');
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();

    const fd = new FormData(form);
    submit.disabled = true;
    label.textContent = 'Creating…';
    arrow.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
      const txn = await api.createTransaction({
        fromAccount: fd.get('fromAccount') as string,
        toAccount:   fd.get('toAccount')   as string,
        amount:      parseFloat(fd.get('amount') as string),
        currency:    fd.get('currency')    as any,
        type:        fd.get('type')        as any,
      });
      form.reset();
      if (txn.status === 'completed') options.onSuccess(txn);
      else                            options.onFailure(txn);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 400 && err.data.details) {
        err.data.details.forEach(d => {
          const el = container.querySelector<HTMLElement>(`#err-${d.field}`);
          if (el) { el.textContent = d.message; el.classList.remove('hidden'); }
        });
      } else {
        options.onError(err as Error);
      }
    } finally {
      submit.disabled = false;
      label.textContent = 'Create Transaction';
      arrow.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  });
}

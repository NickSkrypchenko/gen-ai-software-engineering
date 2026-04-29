"use strict";
(() => {
  // public/js/api-client.ts
  var CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "CZK"];
  var ApiClientError = class extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
      this.name = "ApiClientError";
    }
  };
  async function apiFetch(path, options) {
    const res = await fetch(path, options);
    const data = await res.json();
    if (!res.ok) {
      throw new ApiClientError(
        data.error ?? "Request failed",
        res.status,
        data
      );
    }
    return data;
  }
  var api = {
    createTransaction: (input) => apiFetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }),
    listTransactions: async (filters = {}) => {
      const p = new URLSearchParams();
      if (filters.accountId)
        p.set("accountId", filters.accountId);
      if (filters.type)
        p.set("type", filters.type);
      if (filters.from)
        p.set("from", filters.from);
      if (filters.to)
        p.set("to", filters.to);
      const qs = p.toString();
      const res = await apiFetch(
        `/api/transactions${qs ? "?" + qs : ""}`
      );
      return res.data;
    },
    getTransaction: (id) => apiFetch(`/api/transactions/${id}`),
    getBalances: (accountId) => apiFetch(`/api/accounts/${accountId}/balance`),
    getSummary: (accountId) => apiFetch(`/api/accounts/${accountId}/summary`),
    health: () => apiFetch("/health"),
    exportCSVUrl: (filters = {}) => {
      const p = new URLSearchParams();
      if (filters.accountId)
        p.set("accountId", filters.accountId);
      if (filters.type)
        p.set("type", filters.type);
      if (filters.from)
        p.set("from", filters.from);
      if (filters.to)
        p.set("to", filters.to);
      const qs = p.toString();
      return `/api/transactions/export${qs ? "?" + qs : ""}`;
    }
  };

  // public/js/components/balance-card.ts
  function renderBalanceCards(container, balances) {
    if (balances.balances.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-400 py-2">No balances yet.</p>`;
      return;
    }
    container.innerHTML = balances.balances.map((b) => {
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: b.currency,
        minimumFractionDigits: 2
      }).format(b.amount);
      return `
        <div class="p-1.5 rounded-2xl ring-1 ring-black/[0.05] bg-black/[0.02]">
          <div class="p-3 rounded-[calc(1rem-0.375rem)] bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
            <p class="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold mb-1">${b.currency}</p>
            <p class="text-2xl font-bold text-gray-900 leading-none">${formatted}</p>
          </div>
        </div>`;
    }).join("");
  }
  function renderSummaryStats(container, summary) {
    const totals = summary.perCurrency.reduce(
      (acc, c) => ({
        deposits: acc.deposits + c.totalDeposits,
        withdrawals: acc.withdrawals + c.totalWithdrawals,
        count: acc.count + c.transactionCount,
        lastAt: !acc.lastAt || c.lastTransactionAt && c.lastTransactionAt > acc.lastAt ? c.lastTransactionAt : acc.lastAt
      }),
      { deposits: 0, withdrawals: 0, count: 0, lastAt: null }
    );
    const lastLabel = totals.lastAt ? new Date(totals.lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "\u2014";
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

  // public/js/components/tx-table.ts
  function renderTransactionTable(container, transactions, viewerAccountId) {
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
    const rows = transactions.map((txn) => {
      const isFailed = txn.status === "failed";
      const rowCls = isFailed ? "bg-red-50" : "bg-white hover:bg-blue-50/40";
      const badge = isFailed ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">
           <span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>Failed
         </span>` : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-600">
           <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Done
         </span>`;
      const time = new Date(txn.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const amt = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: txn.currency
      }).format(txn.amount);
      const tipAttr = isFailed && txn.failureReason ? `title="${txn.failureReason}" aria-label="${txn.failureReason}"` : "";
      return `
      <tr class="${rowCls} transition-colors duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)] border-b border-gray-100 last:border-0" ${tipAttr}>
        <td class="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">${time}</td>
        <td class="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[110px]" title="${txn.id}">${txn.id.slice(0, 18)}\u2026</td>
        <td class="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
          <span class="text-gray-400">${txn.fromAccount}</span>
          <span class="mx-1 text-gray-300">\u2192</span>
          <span>${txn.toAccount}</span>
        </td>
        <td class="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap tabular-nums">${amt}</td>
        <td class="px-4 py-3 text-xs text-gray-500 capitalize">${txn.type}</td>
        <td class="px-4 py-3">${badge}</td>
      </tr>`;
    }).join("");
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
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">From \u2192 To</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Amount</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Type</th>
          <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 text-left">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  function renderMobileCards(container, transactions) {
    if (transactions.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-400 py-8 text-center">No transactions found.</p>`;
      return;
    }
    container.innerHTML = transactions.map((txn) => {
      const isFailed = txn.status === "failed";
      const borderColor = isFailed ? "border-red-400" : "border-green-400";
      const amt = new Intl.NumberFormat("en-US", { style: "currency", currency: txn.currency }).format(txn.amount);
      const time = new Date(txn.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      return `
      <div class="p-4 bg-white rounded-xl border-l-4 ${borderColor} ring-1 ring-black/[0.04] mb-3">
        <div class="flex items-start justify-between mb-2">
          <p class="text-xs font-mono text-gray-400 truncate max-w-[180px]">${txn.id}</p>
          <span class="text-xs text-gray-400 ml-2 whitespace-nowrap">${time}</span>
        </div>
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-700">${txn.fromAccount} \u2192 ${txn.toAccount}</p>
          <p class="text-sm font-bold text-gray-900 tabular-nums">${amt}</p>
        </div>
        ${isFailed && txn.failureReason ? `<p class="mt-1.5 text-xs text-red-500">${txn.failureReason}</p>` : ""}
      </div>`;
    }).join("");
  }

  // public/js/components/tx-form.ts
  function mountTransactionForm(container, options) {
    const acctOptions = options.accounts.map((a) => `<option value="${a}">${a}</option>`).join("");
    const currOptions = CURRENCIES.map((c) => `<option value="${c}"${c === "USD" ? " selected" : ""}>${c}</option>`).join("");
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
    const form = container.querySelector("#tx-form");
    const submit = container.querySelector("#tx-submit");
    const label = container.querySelector("#tx-label");
    const arrow = container.querySelector("#tx-arrow");
    const spinner = container.querySelector("#tx-spinner");
    const fromSel = form.querySelector('[name="fromAccount"]');
    const toSel = form.querySelector('[name="toAccount"]');
    const typeSel = form.querySelector('[name="type"]');
    function autoType() {
      const f = fromSel.value, t = toSel.value;
      if (f === "EXTERNAL" && t !== "EXTERNAL")
        typeSel.value = "deposit";
      else if (f !== "EXTERNAL" && t === "EXTERNAL")
        typeSel.value = "withdrawal";
      else if (f !== "EXTERNAL" && t !== "EXTERNAL")
        typeSel.value = "transfer";
    }
    fromSel.addEventListener("change", autoType);
    toSel.addEventListener("change", autoType);
    function clearErrors() {
      container.querySelectorAll('[id^="err-"]').forEach((el) => {
        el.textContent = "";
        el.classList.add("hidden");
      });
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();
      const fd = new FormData(form);
      submit.disabled = true;
      label.textContent = "Creating\u2026";
      arrow.classList.add("hidden");
      spinner.classList.remove("hidden");
      try {
        const txn = await api.createTransaction({
          fromAccount: fd.get("fromAccount"),
          toAccount: fd.get("toAccount"),
          amount: parseFloat(fd.get("amount")),
          currency: fd.get("currency"),
          type: fd.get("type")
        });
        form.reset();
        if (txn.status === "completed")
          options.onSuccess(txn);
        else
          options.onFailure(txn);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 400 && err.data.details) {
          err.data.details.forEach((d) => {
            const el = container.querySelector(`#err-${d.field}`);
            if (el) {
              el.textContent = d.message;
              el.classList.remove("hidden");
            }
          });
        } else {
          options.onError(err);
        }
      } finally {
        submit.disabled = false;
        label.textContent = "Create Transaction";
        arrow.classList.remove("hidden");
        spinner.classList.add("hidden");
      }
    });
  }

  // public/js/dashboard.ts
  var allTxns = [];
  var accounts = [];
  var currentAccountId = "";
  var toastTimer = null;
  function $(sel) {
    return document.querySelector(sel);
  }
  function getFilterValues() {
    return {
      accountId: $("#f-account").value || void 0,
      type: $("#f-type").value || void 0,
      from: $("#f-from").value ? new Date($("#f-from").value).toISOString() : void 0,
      to: $("#f-to").value ? new Date($("#f-to").value).toISOString() : void 0
    };
  }
  function applyFilters() {
    const { accountId, type, from, to } = getFilterValues();
    const filtered = allTxns.filter((t) => {
      if (accountId && t.fromAccount !== accountId && t.toAccount !== accountId)
        return false;
      if (type && t.type !== type)
        return false;
      if (from && t.timestamp < from)
        return false;
      if (to && t.timestamp > to)
        return false;
      return true;
    });
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      renderMobileCards($("#tx-container"), filtered);
    } else {
      renderTransactionTable($("#tx-container"), filtered, accountId);
    }
  }
  async function loadAccountSidebar(accountId) {
    if (!accountId) {
      $("#sidebar-data").classList.add("hidden");
      return;
    }
    try {
      const [balances, summary] = await Promise.all([
        api.getBalances(accountId),
        api.getSummary(accountId)
      ]);
      renderBalanceCards($("#balance-cards"), balances);
      renderSummaryStats($("#summary-stats"), summary);
      $("#sidebar-data").classList.remove("hidden");
    } catch {
      $("#sidebar-data").classList.add("hidden");
    }
  }
  function showToast(message) {
    const toast = $("#success-toast");
    $("#toast-text").textContent = message;
    toast.classList.remove("opacity-0", "translate-x-full");
    toast.classList.add("opacity-100", "translate-x-0");
    if (toastTimer)
      clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("opacity-100", "translate-x-0");
      toast.classList.add("opacity-0", "translate-x-full");
    }, 4e3);
  }
  function showWarning(message) {
    $("#banner-text").textContent = message;
    $("#failure-banner").classList.remove("hidden");
  }
  async function init() {
    try {
      allTxns = await api.listTransactions();
    } catch {
      allTxns = [];
    }
    const seen = /* @__PURE__ */ new Set();
    allTxns.forEach((t) => {
      if (t.fromAccount !== "EXTERNAL")
        seen.add(t.fromAccount);
      if (t.toAccount !== "EXTERNAL")
        seen.add(t.toAccount);
    });
    accounts = Array.from(seen).sort();
    const acctOpts = `<option value="">All accounts</option>` + accounts.map((a) => `<option value="${a}">${a}</option>`).join("");
    $("#account-picker").innerHTML = acctOpts;
    $("#f-account").innerHTML = acctOpts;
    mountTransactionForm($("#tx-form-container"), {
      accounts,
      onSuccess(txn) {
        showToast(`Transaction ${txn.id} completed.`);
        allTxns = [txn, ...allTxns];
        applyFilters();
      },
      onFailure(txn) {
        showWarning(`Transaction failed: ${txn.failureReason ?? "INSUFFICIENT_FUNDS"}`);
        allTxns = [txn, ...allTxns];
        applyFilters();
      },
      onError(err) {
        showWarning(err.message);
      }
    });
    const params = new URLSearchParams(location.search);
    const paramAcct = params.get("accountId");
    if (paramAcct && accounts.includes(paramAcct)) {
      $("#account-picker").value = paramAcct;
      $("#f-account").value = paramAcct;
      currentAccountId = paramAcct;
      await loadAccountSidebar(currentAccountId);
    }
    applyFilters();
    $("#account-picker").addEventListener("change", async (e) => {
      currentAccountId = e.target.value;
      $("#f-account").value = currentAccountId;
      const p = new URLSearchParams(location.search);
      if (currentAccountId)
        p.set("accountId", currentAccountId);
      else
        p.delete("accountId");
      history.pushState(null, "", `${location.pathname}${p.toString() ? "?" + p : ""}`);
      await loadAccountSidebar(currentAccountId);
      applyFilters();
    });
    $("#f-account").addEventListener("change", (e) => {
      const val = e.target.value;
      $("#account-picker").value = val;
      $("#account-picker").dispatchEvent(new Event("change"));
    });
    ["#f-type", "#f-from", "#f-to"].forEach(
      (sel) => $(sel).addEventListener("change", applyFilters)
    );
    $("#export-btn").addEventListener("click", () => {
      window.location.href = api.exportCSVUrl(getFilterValues());
    });
    $("#new-txn-btn")?.addEventListener("click", () => {
      const target = document.getElementById("form-section");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#dismiss-banner")?.addEventListener("click", () => {
      $("#failure-banner").classList.add("hidden");
    });
    window.addEventListener("resize", applyFilters);
  }
  init();
})();
//# sourceMappingURL=dashboard.bundle.js.map

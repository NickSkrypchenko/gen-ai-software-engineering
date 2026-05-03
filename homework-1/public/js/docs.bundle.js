"use strict";
(() => {
  // public/js/api-client.ts
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

  // public/js/docs.ts
  async function initHealthPill() {
    const pill = document.querySelector("#health-pill");
    if (!pill)
      return;
    try {
      const h = await api.health();
      if (h.status === "ok") {
        pill.textContent = "\u25CF Live";
        pill.className = pill.className.replace(/text-\w+-\d+|border-\w+-\d+|bg-\w+-\d+/g, "") + " text-green-600 border-green-200 bg-green-50";
      }
    } catch {
      pill.textContent = "\u25CF Offline";
      pill.className = pill.className.replace(/text-\w+-\d+|border-\w+-\d+|bg-\w+-\d+/g, "") + " text-red-500 border-red-200 bg-red-50";
    }
  }
  function initTryItPanels() {
    document.querySelectorAll("[data-try-it]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panelId = btn.getAttribute("data-try-it");
        const panel = document.querySelector(`#panel-${panelId}`);
        if (!panel)
          return;
        const isHidden = panel.classList.contains("hidden");
        panel.classList.toggle("hidden", !isHidden);
        btn.setAttribute("aria-expanded", String(isHidden));
      });
    });
    document.querySelectorAll("[data-try-submit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const endpointId = btn.getAttribute("data-try-submit");
        const panel = btn.closest('[id^="panel-"]');
        if (!panel)
          return;
        const output = panel.querySelector(".try-output");
        if (!output)
          return;
        output.textContent = "Fetching\u2026";
        const get = (name) => panel.querySelector(`[name="${name}"]`)?.value ?? "";
        try {
          let result;
          if (endpointId === "health") {
            result = await api.health();
          } else if (endpointId === "list") {
            const txns = await api.listTransactions({ accountId: get("accountId") || void 0 });
            result = txns;
          } else if (endpointId === "create") {
            result = await api.createTransaction({
              fromAccount: get("fromAccount") || "EXTERNAL",
              toAccount: get("toAccount") || "ACC-AAAAA",
              amount: parseFloat(get("amount") || "100"),
              currency: get("currency") || "USD",
              type: get("type") || "deposit"
            });
          } else if (endpointId === "get-by-id") {
            const id = get("id");
            if (!id) {
              output.textContent = "Enter a transaction ID first.";
              return;
            }
            result = await api.getTransaction(id);
          } else if (endpointId === "balance") {
            const acct = get("accountId");
            if (!acct) {
              output.textContent = "Enter an account ID first.";
              return;
            }
            result = await api.getBalances(acct);
          } else if (endpointId === "summary") {
            const acct = get("accountId");
            if (!acct) {
              output.textContent = "Enter an account ID first.";
              return;
            }
            result = await api.getSummary(acct);
          } else if (endpointId === "export") {
            output.textContent = "Triggering CSV download\u2026";
            window.location.href = api.exportCSVUrl({ accountId: get("accountId") || void 0 });
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
  function initScrollReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
  }
  function initMobileMenu() {
    const burger = document.querySelector("#burger-btn");
    const overlay = document.querySelector("#mobile-overlay");
    const close = document.querySelector("#close-overlay");
    const links = document.querySelectorAll("#overlay-links li");
    if (!burger || !overlay)
      return;
    function open() {
      overlay.classList.remove("hidden");
      document.body.classList.add("overflow-hidden");
      links.forEach((li, i) => {
        li.style.transitionDelay = `${80 + i * 50}ms`;
        li.classList.remove("opacity-0", "translate-y-4");
        li.classList.add("opacity-100", "translate-y-0");
      });
    }
    function closeMenu() {
      links.forEach((li) => {
        li.classList.remove("opacity-100", "translate-y-0");
        li.classList.add("opacity-0", "translate-y-4");
      });
      setTimeout(() => {
        overlay.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
      }, 250);
    }
    burger.addEventListener("click", open);
    close?.addEventListener("click", closeMenu);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        closeMenu();
    });
  }
  initHealthPill();
  initTryItPanels();
  initScrollReveal();
  initMobileMenu();
})();
//# sourceMappingURL=docs.bundle.js.map

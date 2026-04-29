# Wireframes — Banking Transactions API

Two pages. Layout is mobile-first; breakpoints at `md` (768px) and `lg` (1024px).

---

## Page 1: `/` — Landing + API Docs

```
┌─────────────────────────────────────────────────────────┐
│  [logo]  Banking API          [Dashboard →]  [GitHub →] │  nav (sticky)
├─────────────────────────────────────────────────────────┤
│                                                         │
│   BANKING TRANSACTIONS API                              │  hero section
│   A clean, typed REST API for money movement.           │
│   Status: ✓ Live   Uptime from /health                 │
│                                                         │
│   [Open Dashboard ▶]     [View Spec ↓]                  │  CTAs
│                                                         │
├─────────────────────────────────────────────────────────┤
│  API Endpoints                                          │  section heading
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  POST  /api/transactions                           │ │  endpoint card
│  │  Create a transaction                              │ │
│  │                                                    │ │
│  │  Request body ▾              Response schema ▾     │ │
│  │  { fromAccount, toAccount,   { id, status,         │ │
│  │    amount, currency, type }    failureReason, … }  │ │
│  │                                                    │ │
│  │  [Try it ▶]   ← fires against running API         │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  {live JSON response rendered here}          │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  (6 more cards — same structure — GET /api/transactions, │
│   GET /api/transactions/:id, GET /api/transactions/      │
│   export, GET /api/accounts/:id/balance,                │
│   GET /api/accounts/:id/summary, GET /health)           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  v1.0.0 · Node.js · Express · TypeScript                │  footer
└─────────────────────────────────────────────────────────┘
```

**Mobile (< md):** Nav collapses to hamburger. Endpoint cards stack full-width. Try-it inline form stacks vertically.

---

## Page 2: `/dashboard` — Operator Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  [logo]  Dashboard        [← Docs]    [＋ New Txn]      │  nav (sticky)
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  Account      │  Filters                                │
│  [ACC-AAAAA▼] │  Account [ACC-AAAAA ▼]  Type [all ▼]   │
│               │  From [date]  To [date]  [Export CSV]   │
│  ─────────    ├─────────────────────────────────────────┤
│               │                                         │
│  Balances     │  Transaction Table                      │
│  USD $4,449   │  ┌──────────────────────────────────┐  │
│  EUR €1,700   │  │ Time  │ ID    │ From→To │ Amt │ St│  │
│               │  │───────┼───────┼─────────┼─────┼───│  │
│  ─────────    │  │ 12:00 │ txn_… │ EXT→AAA │$1k  │ ✓ │  │
│               │  │ 11:30 │ txn_… │ AAA→BBB │$250 │✗⚠ │  │
│  Summary      │  │       │       │(red row)│     │   │  │
│  Deposits:    │  │ 11:00 │ txn_… │ EXT→AAA │$500 │ ✓ │  │
│  $1,500       │  └──────────────────────────────────┘  │
│  Withdrawals: │  (failed row: red background, ⚠ badge,  │
│  $0           │   hover tooltip shows failureReason)    │
│  Count: 3     │                                         │
│  Last: today  │  ─────────────────────────────────────  │
│               │                                         │
│               │  New Transaction Form                   │
│               │  ┌──────────────────────────────────┐  │
│               │  │ From  [EXTERNAL         ▼]        │  │
│               │  │ To    [ACC-AAAAA        ▼]        │  │
│               │  │ Amt   [___________] [USD ▼]       │  │
│               │  │ Type  [deposit          ▼]        │  │
│               │  │       [Create Transaction]         │  │
│               │  │ ← inline field errors              │  │
│               │  │ ← success toast / failure warning  │  │
│               │  └──────────────────────────────────┘  │
│               │                                         │
├───────────────┴─────────────────────────────────────────┤
│  Banking Transactions API · v1.0.0                      │  footer
└─────────────────────────────────────────────────────────┘
```

**Mobile (< md):**
- Left sidebar (account picker + balance + summary) collapses to a horizontal scroll card strip at the top.
- Transaction table degrades to stacked cards (one per row).
- New transaction form becomes a bottom sheet / full-width section.
- All interactive elements reachable by keyboard; form labels via `<label for>`.

---

## Interaction notes

- **Account picker** dropdown populates from distinct accounts seen in `GET /api/transactions` response; updates URL param `?accountId=`.
- **Filters** are reflected in URL search params; page is reload-safe and shareable.
- **Try-it buttons** (docs page): on click, reveal a small request editor pre-populated from the schema example; submit fires `fetch` against `/api/*`; response renders as syntax-highlighted JSON below.
- **Failed row tooltip**: `title` attribute + `aria-label` with the `failureReason` string.
- **Export CSV**: calls `/api/transactions/export` with current filter params; browser download.
- **Form success/failure**: on 201 with `status=completed` → green success toast; on 201 with `status=failed` → amber warning banner with `failureReason`; on 400 → inline field error messages.

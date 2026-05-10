# Wireframes — Customer Support API

Two pages: Landing (`/`) and Dashboard (`/dashboard`).
Vanilla TypeScript + Tailwind. No JS framework. Mobile-first.

---

## Page 1: Landing / API Docs (`/`)

### Layout (desktop, 1280px)

```
┌──────────────────────────────────────────────────────────────────┐
│ NAV                                                              │
│  [Logo + wordmark]          [Stats pill: 212 tests ✓]  [Dashboard →]│
├──────────────────────────────────────────────────────────────────┤
│ HERO                                                             │
│                                                                  │
│   Intelligent Customer Support API                               │
│   Keyword-based classification · Optimistic concurrency ·        │
│   CSV / JSON / XML bulk import                                   │
│                                                                  │
│   [Open Dashboard]    [View on GitHub]                           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ ENDPOINTS  (3-column card grid)                                  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ POST /tickets    │  │ GET /tickets     │  │ GET /tickets/:id│ │
│  │ [201] Create     │  │ [200] List       │  │ [200] Get      │ │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────  │ │
│  │ Request schema   │  │ Query params     │  │ ETag header    │ │
│  │ [Try it ▸]       │  │ [Try it ▸]       │  │ [Try it ▸]     │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ PUT /tickets/:id │  │ DELETE /:id      │  │ POST /import   │ │
│  │ [200] Update     │  │ [204] Delete     │  │ [200] Bulk     │ │
│  │ If-Match reqd    │  │ If-Match reqd    │  │ Link to dash ↗ │ │
│  │ [Try it ▸]       │  │ [Try it ▸]       │  │                │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ POST /transitions│  │ POST /auto-classify│                   │
│  │ [200] Transition │  │ [200] Classify   │                     │
│  │ State machine    │  │ Rules-based      │                     │
│  │ [Try it ▸]       │  │ [Try it ▸]       │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ STATE MACHINE                                                    │
│                                                                  │
│   Inline SVG: nodes = statuses, arrows = allowed transitions     │
│   new → in_progress → waiting_customer ↔ in_progress            │
│              ↓                 ↓                                 │
│           resolved ──────→ closed                               │
│              ↑                                                   │
│           in_progress (reopen)                                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ BULK IMPORT                                                      │
│                                                                  │
│   Supported formats: CSV · JSON · XML                            │
│   Max: 5 MB / 1,000 rows per request                             │
│                                                                  │
│   curl examples (3 tabs: CSV / JSON / XML)                       │
│   [Open Dashboard to import files →]                             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ FOOTER: MIT License · Homework-2 · Nick Skrypchenko              │
└──────────────────────────────────────────────────────────────────┘
```

### Endpoint card detail

```
┌───────────────────────────────────────┐
│  [POST] /api/tickets                  │  ← method pill (color-coded)
│  Create a support ticket              │
│  ─────────────────────────────────── │
│  Request body (collapsible)           │
│  > customer_id   string  required     │
│  > customer_email email  required     │
│  > subject       string  required     │
│  > ...                                │
│  ─────────────────────────────────── │
│  Response: 201 Ticket                 │
│  > id, version, status: "new"         │
│                                       │
│  [▸ Try it]                           │
│  ┌──────────────────────────────────┐ │
│  │ {  "customer_id": "CUST-001",   │ │  ← inline JSON editor
│  │    "customer_email": "...",      │ │
│  │    ...                           │ │
│  │ }                                │ │
│  │ [Send →]           [Reset]       │ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

### Responsive (mobile, <768px)
- Nav collapses to hamburger + wordmark only
- Cards stack to 1 column
- Try-it panels hidden by default, expand on tap
- State machine SVG scrolls horizontally

---

## Page 2: Operator Dashboard (`/dashboard`)

### Layout (desktop, 1280px)

```
┌──────────────────────────────────────────────────────────────────┐
│ NAV                                                              │
│  [← API Docs]  Customer Support Dashboard  [○ 5 tickets open]   │
├──────────────────────────────────────────────────────────────────┤
│ FILTER BAR                                                       │
│                                                                  │
│  [Status ▾] [Category ▾] [Priority ▾] [Assigned to ▾] [🔍 Search]│
│                                                                  │
│  Active filters: status=in_progress  [× clear all]              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ TICKETS TABLE                                                    │
│                                                                  │
│  ID        Customer     Subject          Status      Priority    │
│  ──────────────────────────────────────────────────────────────  │
│  01933a… │ Alice S.   │ Cannot login   │ ●in_progress│ ▲ high   │
│  0193b4… │ Bob J.     │ Billing issue  │ ○ new       │ ─ medium  │
│  0193c1… │ Carol W.   │ App crash      │ ⚠ urgent    │ !! urgent │
│  ...                                                             │
│                                                                  │
│  ← Prev  [1] [2] [3]  Next →          Showing 1–50 of 127      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ IMPORT DROPZONE  [▾ Bulk Import]  (collapsed by default)        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │   Drop CSV / JSON / XML here, or [Browse files]           │  │
│  │         Max 5 MB · 1,000 rows                              │  │
│  │                                                            │  │
│  │  Format: [CSV ▾]   [□ Auto-classify]   [Upload →]         │  │
│  │                                                            │  │
│  │  (After upload: per-row error table if any failures)       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Ticket detail modal (opens on row click)

```
┌─────────────────────────────────────────────┐
│  [×]  Ticket 01933a8e...                     │
│       Alice Smith · alice@example.com         │
│                                              │
│  [Details] [Status] [History]                │  ← 3 tabs
│  ─────────────────────────────────────────  │
│                                              │
│  TAB: Details                                │
│  Subject:     Cannot login                   │
│  Description: My account is locked after...  │
│  Category:    account_access    [Classify →] │
│  Priority:    high                           │
│  Assigned to: agent-alice  [Edit]            │
│  Tags:        login · access                 │
│  Created:     2026-05-05 13:04               │
│  Version:     3                              │
│                                              │
│  TAB: Status                                 │
│  Current: ● in_progress                      │
│  Allowed transitions:                        │
│    [→ waiting_customer]  [✓ resolved]        │
│  (buttons disabled for illegal transitions)   │
│                                              │
│  TAB: History (Timeline)                     │
│  ─── system ─────────── 13:04:38            │
│    Created · status: new                     │
│  ─── agent-alice ────── 13:05:12            │
│    Transition: new → in_progress             │
│    Reason: "Starting investigation"          │
│  ─── classifier ──────── 13:05:44           │
│    Classified: account_access · high         │
│    Confidence: 0.80  [login, access]         │
│                                              │
└─────────────────────────────────────────────┘
```

### Dropzone states

```
Idle:      dashed border, cloud-upload icon, muted text
Hover:     solid primary border, background tint, "Drop to import"
Uploading: progress bar, spinner, "Importing 3 rows..."
Success:   green check, "3 imported · 0 failed"
Error:     red border, per-row error table:
           Row  Stage     Field           Message
           2    validate  customer_email  Invalid email format
           5    parse     —               Unterminated quoted string
```

### Responsive (mobile, <768px)
- Table → stacked ticket cards (status badge + subject + customer)
- Modal → full-screen bottom sheet
- Filter bar → horizontal scroll
- Import dropzone → tap-to-upload only (drag hidden)

---

## Shared components

| Component | Notes |
|---|---|
| Method pill | `GET` blue · `POST` green · `PUT` amber · `DELETE` red |
| Status badge | `new` grey · `in_progress` blue · `waiting_customer` yellow · `resolved` green · `closed` slate |
| Priority badge | `urgent` red · `high` orange · `medium` blue · `low` slate |
| Stats pill | `N tickets open` in nav, live count from `GET /tickets?status=new` |
| Confidence indicator | `0.5` grey · `0.7` blue · `0.9+` green with keyword chips |

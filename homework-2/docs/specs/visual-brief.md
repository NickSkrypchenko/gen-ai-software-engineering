# Visual Brief — Customer Support API

Brief for the `/high-end-visual-design` skill (Phase 8).

---

## Brand

**Operator-focused tooling.** Calmer than fintech, denser than marketing site.
Think **Linear / Height / Plane.so** — not Mercury or Stripe Press.

- Dense information, clear hierarchy
- Subdued palette — primary blue, neutral greys, semantic status colors
- Monospace type for IDs, versions, code snippets
- No decorative illustrations. Utility-first.

---

## Palette

| Role | Color | Notes |
|---|---|---|
| Primary | `#3B82F6` (blue-500) | CTAs, links, active states |
| Surface | `#0F172A` (slate-900) | Dark page background |
| Card | `#1E293B` (slate-800) | Cards, modals, dropzone |
| Border | `#334155` (slate-700) | Dividers, input borders |
| Text primary | `#F1F5F9` (slate-100) | Headings, body |
| Text muted | `#94A3B8` (slate-400) | Labels, metadata |
| Success | `#10B981` (emerald-500) | resolved status, import success |
| Warning | `#F59E0B` (amber-500) | waiting_customer, high priority |
| Danger | `#EF4444` (red-500) | urgent, delete, error |
| Neutral | `#64748B` (slate-500) | new status, medium priority |

Dark theme only (no light mode toggle needed for v1).

---

## Typography

- **UI text**: `Inter` (sans-serif), loaded via `@font-face` from `public/fonts/`
- **Monospace**: `JetBrains Mono` for IDs, versions, code, JSON payloads
- Scale: 12px labels · 14px body · 16px card titles · 24px section headings · 40px hero

---

## Required components

### Method pills
Small `<span>` with colored background + white text. Border-radius: full.
```
GET    → bg-blue-500/20   text-blue-300   border border-blue-500/40
POST   → bg-green-500/20  text-green-300  border border-green-500/40
PUT    → bg-amber-500/20  text-amber-300  border border-amber-500/40
DELETE → bg-red-500/20    text-red-300    border border-red-500/40
```

### Status badges
Dot indicator + text. Inline flex.
```
new              → ○ slate    text-slate-400
in_progress      → ● blue     text-blue-400
waiting_customer → ◐ amber    text-amber-400
resolved         → ✓ emerald  text-emerald-400
closed           → — slate    text-slate-500  opacity-60
```

### Priority badges
```
urgent  → !! red    bg-red-500/10    text-red-400
high    → ▲ orange  bg-orange-500/10 text-orange-400
medium  → ─ blue    bg-blue-500/10   text-blue-400
low     → ▽ slate   bg-slate-500/10  text-slate-400
```

### Stats pill (nav)
```
bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
rounded-full px-3 py-1 text-sm tabular-nums
"N open"
```

### Tickets table
- `thead` sticky on scroll, `bg-slate-900`
- Alternating row hover: `hover:bg-slate-800/60`
- Row click → modal (cursor-pointer)
- Truncate subject at 60 chars with tooltip

### Ticket detail modal
- Desktop: fixed right panel, `w-[480px]`, full viewport height, slide-in animation
- Mobile: bottom sheet, `max-h-[90vh]`, drag handle at top
- Three tabs: Details / Status / History
- Backdrop: `bg-black/50 backdrop-blur-sm`

### Drag-and-drop dropzone
Five visual states via CSS class swap:
```
idle       → border-2 border-dashed border-slate-600    bg-slate-800/40
hover      → border-2 border-solid   border-blue-500    bg-blue-500/5
uploading  → border-2 border-solid   border-blue-400    bg-blue-500/5  + spinner
success    → border-2 border-solid   border-emerald-500 bg-emerald-500/5
error      → border-2 border-solid   border-red-500     bg-red-500/5
```
Error state: show per-row table below dropzone (row · stage · field · message).

### FSM transition buttons
Only render buttons for **allowed transitions** from current status.
Disabled appearance for blocked transitions (shown greyed with tooltip explaining why).
```
in_progress → [→ waiting customer] [✓ Mark resolved]
resolved    → [↩ Reopen]  [✗ Close]
```

### Classification badge
```
┌─────────────────────────────────────┐
│  account_access   0.80              │
│  ▓▓▓▓▓▓▓▓░░  high                  │
│  keywords: login · access · blocked │
└─────────────────────────────────────┘
```
Confidence bar: `bg-blue-500` fill, 0–1 → 0–100%.

### History timeline
Mixed source: `system`, `agent-*`, `classifier`.
```
  ┃  ● system ─── 13:04:38
  ┃    Created · status: new
  ┃
  ┃  ● agent-alice ─── 13:05:12
  ┃    Transition: new → in_progress
  ┃    "Starting investigation"
  ┃
  ┃  ◇ classifier ─── 13:05:44
  ┃    Classified: account_access · high (0.80)
  ┃    [login] [access]
```
Left border line connects entries. System entries are muted; agent entries are primary; classifier entries use a diamond node.

### Endpoint cards (landing page)
```
┌──────────────────────────────────────┐
│  [POST]  /api/tickets                │
│  Create a support ticket             │
│  ──────────────────────────────────  │
│  Request  ▾                          │
│    customer_id    string  required   │
│    customer_email email   required   │
│    subject        string  required   │
│  Response: 201 Ticket                │
│                                      │
│  [▸ Try it]                          │
└──────────────────────────────────────┘
```
Try-it panel: collapsible `<details>` with JSON textarea + Send button.

### State-machine SVG (landing page)
Five nodes connected by directed arrows. Highlight current status on hover.
Nodes arranged left-to-right in flow order: `new → in_progress → waiting_customer`.
Below: `resolved → closed`. Bidirectional arrows shown as two parallel lines with opposing arrowheads.

---

## Motion

Minimal. No layout shift.
- Modal: `translate-x-full → translate-x-0` (300ms ease-out) on desktop; `translate-y-full → translate-y-0` on mobile
- Dropzone state transitions: `transition-colors duration-200`
- Table row hover: `transition-colors duration-100`
- Stats pill count: no animation (just update)

---

## Accessibility

- All interactive elements keyboard-navigable (`tabIndex`, `:focus-visible` ring)
- `<label for>` on every form input
- `aria-describedby` on validation error messages
- `aria-invalid="true"` on invalid fields
- `role="dialog" aria-modal="true"` on modal
- `role="status"` on import progress
- `aria-label` on icon-only buttons
- WCAG AA contrast on all text/background pairs (min 4.5:1)

---

## File structure produced by skill

```
public/
├── index.html              ← Landing page
├── dashboard.html          ← Operator dashboard
├── css/
│   ├── main.css            ← Tailwind output
│   └── custom.css          ← Overrides, CSS vars, motion specs
└── js/
    ├── landing.ts          ← Try-it logic, state-machine SVG
    ├── dashboard.ts        ← Table, filters, pagination, modal
    ├── api-client.ts       ← ETag-aware fetch wrapper
    ├── import-dropzone.ts  ← Drag-and-drop + file picker
    └── components/
        ├── ticket-modal.ts
        ├── status-badge.ts
        └── classification-badge.ts
```

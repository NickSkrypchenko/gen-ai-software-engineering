# Visual Brief — Banking Transactions API

## Audience for this brief
`/high-end-visual-design` skill. Consume this brief together with `docs/specs/wireframes.md`.

---

## Brand direction

**Tone:** Confident, calm, financial-but-modern. Think Mercury / Stripe Press / Linear — not Wells Fargo or Chase. Clean white space, strong typographic hierarchy, restrained color use.

**Do not:** Use gradients on primary surfaces, rounded-everything "friendly fintech" aesthetics, or hero illustrations. The API product speaks for itself.

---

## Typography

- **Display / hero:** `Inter` or `Plus Jakarta Sans`, weight 700–800, tight tracking (`-0.02em`).
- **Body / UI:** `Inter`, weight 400/500, 14–16px, line-height 1.6.
- **Monospace (JSON, IDs, code):** `JetBrains Mono` or `Fira Code`, 13px.
- No web-font fallbacks needed — assume both fonts loaded.

---

## Color palette

| Token | Value | Usage |
|---|---|---|
| `surface` | `#FFFFFF` | Page background |
| `surface-subtle` | `#F8F9FA` | Card backgrounds, sidebar |
| `border` | `#E5E7EB` | All dividers and card borders |
| `text-primary` | `#111827` | Headings, labels |
| `text-secondary` | `#6B7280` | Meta text, descriptions |
| `accent` | `#2563EB` | Primary CTA, links, method pills (POST) |
| `accent-subtle` | `#EFF6FF` | Hover states, active rows |
| `success` | `#16A34A` | Completed status badge, success toast |
| `success-subtle` | `#F0FDF4` | Completed row tint (optional) |
| `danger` | `#DC2626` | Failed status badge, error text |
| `danger-subtle` | `#FEF2F2` | Failed transaction row background |
| `warning` | `#D97706` | Failure warning banner |
| `warning-subtle` | `#FFFBEB` | Warning banner background |
| `mono-bg` | `#1E1E2E` | Code/JSON response blocks |
| `mono-text` | `#CDD6F4` | Code text on dark background |

---

## Component specs

### Navigation bar
- Height: 56px. Sticky. `border-bottom: 1px solid var(--border)`.
- Logo: wordmark "Banking API" in `text-primary` weight 700.
- Right items: ghost links (`text-secondary`, no underline on rest state, `text-primary` on hover).
- On mobile: hamburger menu icon; nav links in a full-width drawer.

### Hero section (docs page)
- Full-width, `padding: 80px 0`. Center-aligned.
- Live status pill: `●  Live` — green dot, small text, border `1px solid var(--border)`, `border-radius: 9999px`, subtle background.
- H1: 48–56px, weight 800, tight tracking.
- Sub: 18–20px, `text-secondary`.
- CTAs: primary button `background: var(--accent)`, white text, `border-radius: 8px`, `padding: 12px 24px`; secondary button is outlined.

### Endpoint card (docs page)
- `border: 1px solid var(--border)`, `border-radius: 12px`, `padding: 24px`.
- Method pill: `POST` → blue, `GET` → gray/green — small uppercase label, `border-radius: 6px`.
- Path: monospace, `text-primary`.
- Description: `text-secondary`, 14px.
- Expandable sections (Request / Response) use a subtle `<details>`-style toggle.
- **Try it button:** `background: var(--accent-subtle)`, `color: var(--accent)`, border, hover lifts to `var(--accent)` background + white text. Keyboard focusable.
- Live JSON response block: dark `var(--mono-bg)` background, `border-radius: 8px`, max-height 240px, overflow scroll.

### Transaction table (dashboard)
- `border: 1px solid var(--border)`, `border-radius: 12px`, overflow hidden.
- Header row: `background: var(--surface-subtle)`, `font-size: 12px`, uppercase, `text-secondary`, `letter-spacing: 0.05em`.
- Data rows: `border-bottom: 1px solid var(--border)`, hover → `background: var(--accent-subtle)`.
- Failed rows: `background: var(--danger-subtle)`, status badge in `var(--danger)`.
- Status badges: pill shape, `border-radius: 9999px`, 11px text, weight 500.
  - completed: `color: var(--success)`, `background: var(--success-subtle)`.
  - failed: `color: var(--danger)`, `background: var(--danger-subtle)`.
- Mobile: table collapses to cards. Each card has a thin left border colored by status.

### Balance card (dashboard sidebar)
- `background: var(--surface-subtle)`, `border: 1px solid var(--border)`, `border-radius: 10px`, `padding: 16px`.
- Currency label: 12px uppercase `text-secondary`.
- Amount: 24px, weight 700, `text-primary`, formatted via `Intl.NumberFormat`.

### Summary stats strip (dashboard sidebar)
- 4 stats in a 2×2 grid below balance cards.
- Label: 11px `text-secondary`. Value: 16px weight 600 `text-primary`.

### New transaction form (dashboard)
- `border: 1px solid var(--border)`, `border-radius: 12px`, `padding: 24px`.
- Labels: 13px weight 500 `text-primary`.
- Inputs: `border: 1px solid var(--border)`, `border-radius: 6px`, `padding: 8px 12px`, focus ring `2px solid var(--accent)`.
- Inline errors: 12px `color: var(--danger)`, shown below the field via `aria-describedby`.
- Submit: full-width primary button, loading spinner during in-flight request.
- Success toast: fixed bottom-right, `background: var(--success)`, white text, auto-dismiss 4s.
- Failure warning: amber banner above the table, dismissable `×`.

---

## Motion

- **Hover on cards/rows:** `transition: background 150ms ease, box-shadow 150ms ease`.
- **Try it panel open:** `max-height` expand, `opacity` 0→1, `200ms ease-out`.
- **Toast appear:** slide-in from right, `transform: translateX(100%) → 0`, `200ms ease-out`.
- **Table row appear on new transaction:** highlight row for 1s with `background: var(--accent-subtle)` fade-out.
- No animation on page load. No gratuitous motion.

---

## Spacing system (Tailwind 4-based)

Use Tailwind's default scale. Key values:
- `gap-4` (16px) between cards.
- `p-6` (24px) card padding.
- `px-6 py-4` nav padding.
- `space-y-3` (12px) between form fields.
- Max content width: `max-w-4xl mx-auto` on docs page; `max-w-7xl` on dashboard.

---

## Output expected from the skill

1. Tailwind class sets for each component listed above, as applied directly in HTML.
2. Any custom CSS needed where Tailwind is insufficient (e.g. syntax-highlight colors, custom scrollbar, the status badge variants).
3. `public/index.html` — fully styled landing + docs page.
4. `public/dashboard.html` — fully styled operator dashboard.
5. `public/css/tailwind.css` — built output.
6. Any `public/js/` component stubs updated to wire into the styled HTML.

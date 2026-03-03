# v0 Prompt — T1 Entity List Toolbar Redesign

Paste this into v0.dev to generate the prototype.

---

## Prompt

Create a full-page ERP invoice list screen with a redesigned toolbar layout. This is a UK SME ERP called "Nexa ERP" using a purple design system. The page demonstrates the new two-row toolbar pattern.

### Design System (Concept D — Purple + AI)

**Colors:**
- Primary: `#7c3aed` (purple-600), hover: `#5b21b6` (purple-800)
- Page background: `#f4f2ff` (light purple tint)
- Surface/cards: `#ffffff`
- Muted: `#f5f3ff` (purple-50)
- Text primary: `#111827` (gray-900)
- Text secondary: `#6b7280` (gray-500)

**Typography:**
- Headings: "Plus Jakarta Sans" (font-bold)
- Body: "Inter" (font-normal)
- Amounts/codes: "JetBrains Mono" (font-medium)

**Corners & Shadows:**
- Cards: 12px radius, `shadow: 0 1px 3px rgba(0,0,0,0.06)`, hover: `0 4px 12px rgba(124,58,237,0.1)`
- Buttons: 8px radius
- Modals/popovers: 12px radius, `shadow: 0 4px 24px rgba(124,58,237,0.08)`
- Pills: `rounded-full`

**Animation:** `fadeInUp 0.4s ease` with staggered delays.

### Page Structure

The page has: app header, left sidebar, and main content area on `#f4f2ff` background.

**App Header (56px):** White, border-bottom. Contains: purple "N" logo, "Nexa ERP" text, centered search bar, notification bell, user avatar "SC" in purple circle.

**Left Sidebar (224px):** White, border-right. Navigation items with icons. "Invoices" item is active with purple background and white text (8px radius). Other items: Dashboard, Sales Orders, CRM Pipeline, General Ledger, etc.

### Main Content — Invoice List

**Page header row:**
```
Finance — Invoices                              [+ New Invoice] (purple primary button)
```
Breadcrumbs below: "Finance > Invoices" in small muted text.

**KPI cards row (4 cards):**
- Total Invoices: 82 (+10.8%)
- Pending: 18 (+50%, red badge)
- Overdue: 7 (urgent, red)
- Collected This Month: £289,400 (+11%)

### NEW TOOLBAR — Row 1 (Search + Buttons)

A single row with items aligned in a flex container, gap-2:

```
[🔍 Search invoices...                    ] [≡ Columns] [▽ Filter] [⚙ Advanced]
```

- **Search:** Full-width input with search icon, `bg-white border border-gray-200 rounded-lg`, placeholder "Search invoices...", flex-1
- **Columns button:** Outline button, size sm (h-9), icon `Columns3` (three vertical lines), label "Columns" (hidden on mobile). On click opens a POPOVER below.
- **Filter button:** Outline button, size sm, icon `Filter` (funnel), label "Filter" (hidden on mobile). Purple badge pill "3" shown next to it indicating 3 active filters. On click opens a MODAL.
- **Advanced button:** Outline button, size sm, icon `SlidersHorizontal` (horizontal sliders), label "Advanced" (hidden on mobile). On click opens a wider MODAL.

All three buttons have: `border-gray-200 bg-white hover:bg-purple-50 text-gray-700` style, 8px radius.

### NEW TOOLBAR — Row 2 (Views Bar)

A horizontal row below Row 1, same width, with flex justify-between:

**Left side — Pill tabs:**
```
(All) (Overdue ★) (This Month ★) (High Value) (Paid Only) (+2 more)
```

- Pills are `rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer transition`
- **Active pill** ("Overdue" is active): `bg-[#7c3aed] text-white`
- **Inactive pills:** `bg-white border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-200`
- **Favourite star** ★: Small amber/gold star after the view name for favourited views
- **"+2 more" pill:** `bg-gray-100 text-gray-500` — indicates overflow, would open a dropdown

**Right side — Action buttons:**
```
[💾 Save] [🗑 Delete]
```

- **Save:** Small outline button, icon `Save` (floppy disk), label "Save". Always visible/enabled.
- **Delete:** Small outline button, icon `Trash2`, label "Delete". Slightly muted since it's destructive. Enabled because a named view is loaded.

### Data Table

Below the views bar, a white card with 12px radius containing:

**Table header:** Light gray background `rgba(107,114,128,0.04)`, uppercase 11px font-medium tracking-wide text-gray-500.

**Columns:** ☑ (checkbox) | Invoice # | Customer | Date | Amount | Status | Due Date

**Sample rows (8 rows):**

| ☐ | INV-2026-0082 | Acme Corporation | 15 Feb 2026 | £4,250.00 | Overdue (red badge) | 01 Feb 2026 |
| ☐ | INV-2026-0081 | Meridian Supplies | 14 Feb 2026 | £1,800.00 | Overdue (red badge) | 02 Feb 2026 |
| ☐ | INV-2026-0080 | TechFlow Ltd | 12 Feb 2026 | £12,400.00 | Overdue (red badge) | 05 Feb 2026 |
| ☐ | INV-2026-0079 | Northern Rail Co | 10 Feb 2026 | £3,100.00 | Overdue (red badge) | 08 Feb 2026 |
| ☐ | INV-2026-0078 | Beta Industries | 08 Feb 2026 | £6,700.00 | Overdue (red badge) | 10 Feb 2026 |
| ☐ | INV-2026-0077 | Coastal Foods | 05 Feb 2026 | £890.00 | Overdue (red badge) | 12 Feb 2026 |
| ☐ | INV-2026-0076 | Summit Partners | 03 Feb 2026 | £15,200.00 | Overdue (red badge) | 14 Feb 2026 |

(Since "Overdue" view is active, all shown invoices are overdue.)

- Invoice numbers and amounts in `JetBrains Mono` font
- Status badges: `rounded-full px-2 py-0.5 text-xs font-medium` — Overdue: `bg-red-50 text-red-600`, Paid: `bg-green-50 text-green-600`, Pending: `bg-amber-50 text-amber-600`, Draft: `bg-gray-100 text-gray-500`, Posted: `bg-purple-50 text-purple-600`
- Row hover: `bg-purple-50/30`
- Table border: `rounded-xl border border-gray-100`

**Table footer:**
```
Showing 7 of 7 overdue invoices                              [Load More]
```

### ALSO SHOW — Columns Popover (Open State)

Show the Columns popover in its open state, positioned below the Columns button. Width ~300px, white card with purple-tinted shadow.

```
┌─────────────────────────────────┐
│ Columns                     (x) │
│ ─────────────────────────────── │
│ ☰ ☑ Invoice #          [📌 L]  │
│ ☰ ☑ Customer           [📌 L]  │
│ ☰ ☑ Date                 [ ]   │
│ ☰ ☑ Amount               [ ]   │
│ ☰ ☑ Status               [ ]   │
│ ☰ ☑ Due Date             [ ]   │
│ ☰ ☐ Payment Terms        [ ]   │
│ ☰ ☐ VAT Code             [ ]   │
│ ☰ ☐ Created By           [ ]   │
│ ─────────────────────────────── │
│ Reset to Default       [Apply]  │
└─────────────────────────────────┘
```

- Drag handle (☰): `text-gray-300 hover:text-gray-500 cursor-grab`
- Checkbox: Purple accent when checked
- Pin button: Cycles NONE/LEFT/RIGHT. Left pinned = purple icon + purple/10 bg. Right = blue icon. None = gray muted icon.
- [Apply] button: Purple primary, small.
- [Reset to Default]: Ghost button, text-gray-500.

### Colour & Feel Notes

This should feel like a modern SaaS tool (Linear, Notion, Attio). Clean whitespace, subtle purple accents, no heavy borders. The purple is used as the accent — not the dominant colour. Most of the UI is white/gray with purple highlights on active states, buttons, and badges.

Use shadcn/ui component styling patterns (Tailwind). The page should feel airy with the `#f4f2ff` background giving a subtle warmth compared to pure white.

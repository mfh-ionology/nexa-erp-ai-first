# Nexa ERP — v0 Design System Base Prompt

> Paste this entire prompt into v0 BEFORE the epic-specific section. This establishes the design system context.

---

## Project Context

You are generating UI components for **Nexa ERP**, an AI-first ERP system for UK SMEs. The design system is called **Concept D** — a purple-themed, professional, modern design with AI co-pilot integration.

**Tech Stack:**
- React 19 + TypeScript
- Tailwind CSS 4 (CSS-first configuration, NOT tailwind.config.js)
- Shadcn UI (New York style, customised to Concept D theme)
- Radix Primitives (accessibility)
- Lucide React icons
- TanStack Table (data tables)
- Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (amounts/codes)

## Colour System

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#7c3aed` | Primary buttons, active sidebar items, focus rings |
| `--primary-hover` | `#5b21b6` | Button hover, link hover |
| `--primary-light` | `#a78bfa` | Soft accents, secondary indicators |
| `--background` | `#f4f2ff` | Page background (NOT white, NOT grey) |
| `--card` | `#ffffff` | Card backgrounds |
| `--sidebar-bg` | `#ffffff` | Sidebar background |
| `--sidebar-active` | `#7c3aed` | Active sidebar item background |
| `--sidebar-active-text` | `#ffffff` | Active sidebar item text |
| `--sidebar-hover` | `#f5f3ff` | Sidebar item hover |
| `--border` | `#e5e7eb` | Default borders |
| `--muted` | `#f3f4f6` | Muted backgrounds |

### Semantic Status Colours
| Status | Badge BG | Badge Text | Use |
|--------|----------|------------|-----|
| Draft/Initial | `#dbeafe` | `#1e40af` | New records |
| In Progress | `#e0e7ff` | `#3730a3` | Active work |
| Awaiting Action | `#fef3c7` | `#92400e` | Needs attention (amber) |
| Success/Completed | `#d1fae5` | `#065f46` | Finished items |
| Partial | `#e0e7ff` | `#4338ca` | Partially done |
| Cancelled | `#f3f4f6` | `#374151` | Cancelled (grey) |
| Error/Overdue | `#fee2e2` | `#991b1b` | Problems (red) |
| Warning | `#fef3c7` | `#92400e` | Caution (amber) |
| Locked/Terminal | `#f3f4f6` | `#374151` | Cannot be changed |

### AI Confidence Palette
| Level | Colour | Hex |
|-------|--------|-----|
| High (>80%) | Green | `#10b981` |
| Medium (50-80%) | Amber | `#f59e0b` |
| Low (<50%) | Red | `#ef4444` |

## Typography

```css
/* Headings - Plus Jakarta Sans */
font-family: 'Plus Jakarta Sans', sans-serif;
/* h1: 30px/600, h2: 24px/600, h3: 20px/600, h4: 16px/600 */

/* Body - Inter */
font-family: 'Inter', sans-serif;
/* body: 14px/400, small: 12px/400, label: 14px/500 */

/* Mono - JetBrains Mono (amounts, codes, IDs) */
font-family: 'JetBrains Mono', monospace;
/* amounts: 14px/500, codes: 13px/400 */
```

## Spacing & Layout

- **8px grid system** — all spacing in multiples of 8px
- **Card radius:** 12px
- **Button radius:** 8px
- **Input radius:** 6px
- **Badge/pill radius:** 99px (fully rounded)
- **Default shadow:** `0 1px 3px rgba(0,0,0,0.06)`
- **Hover shadow:** `0 4px 12px rgba(124,58,237,0.10)` (purple-tinted)
- **Header height:** 56px
- **Sidebar width:** 240px (expanded), 56px (collapsed)

## Standard Card Pattern

```tsx
<div className="animate-fade-in-up rounded-xl border border-border bg-card p-5
  shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow
  hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
  {/* content */}
</div>
```

## Standard Button Patterns

```tsx
/* Primary */
<Button className="bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-lg">

/* Secondary/Outline */
<Button variant="outline" className="border-border hover:bg-[#f5f3ff] hover:text-[#7c3aed] rounded-lg">

/* Ghost */
<Button variant="ghost" className="hover:bg-[#f5f3ff] hover:text-[#7c3aed] rounded-lg">

/* Destructive */
<Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white rounded-lg">
```

## Animations

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.4s, ease-out */
/* Apply: animate-fade-in-up on cards, page sections */

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
/* Duration: 0.3s — sidebar items, list rows */

@keyframes stepIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
/* Duration: 0.5s — modals, dialogs */
```

All animations must respect `prefers-reduced-motion: reduce`.

## Page Background

The page background is ALWAYS `#f4f2ff` (light purple). NEVER white. NEVER grey. Cards sit on this background in white.

## Data Table Patterns

- Header row: `bg-muted/50` with `text-xs font-medium text-muted-foreground uppercase tracking-wider`
- Row hover: `hover:bg-[#f5f3ff]`
- Selected row: `bg-[#ede9fe]`
- Amounts right-aligned in JetBrains Mono
- Status shown as coloured badges (see semantic colours above)
- Sticky header on scroll

## Action Bar (appears on detail/document pages)

```
┌──────────────────────────────────────────────────────────────┐
│ [← Back] Page Title                                          │
│                                                              │
│ [Primary Action]  [Secondary...]  │ 📎 🔗 │  [⋮ Overflow]  │
│                                   │ Tools │                  │
└──────────────────────────────────────────────────────────────┘
```

- Primary action: purple filled button (e.g., "Save", "Post", "Approve")
- Secondary actions: outline buttons
- Persistent tools: icon buttons for Attachments (📎) and Record Links (🔗)
- Overflow menu (⋮): grouped sections — Document, Status, Record, AI, History

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Phone | 375px | Single column, bottom nav, stacked cards |
| Tablet | 768px | Collapsible sidebar, 2-column where appropriate |
| Desktop | 1024px+ | Full sidebar, multi-column, all features visible |

## Important Rules

1. Page background is ALWAYS `#f4f2ff` — not white, not grey
2. Primary colour is ALWAYS `#7c3aed` — not blue, not generic
3. Cards always have 12px radius and the purple-tinted hover shadow
4. Amounts and codes ALWAYS use JetBrains Mono
5. Status badges use the semantic colour palette, never arbitrary colours
6. All interactive elements have visible focus rings (`ring-2 ring-[#7c3aed]/30`)
7. Empty states show an illustration + descriptive message + CTA button
8. Loading states use skeleton animations (NOT spinners for page content)
9. The design should feel **premium and polished**, not generic SaaS

---

## EPIC-SPECIFIC SECTION: E5 + E5b — AI Co-Pilot Frontend

### Epic Context

These screens power the **AI Co-Pilot** features of Nexa ERP:
- **E5** — Wire existing Co-Pilot chat and dashboard components to real backend. Add an AI Briefing page.
- **E5b** — New pages for AI Memory Management and Skills Browser. Enhance the chat textbox with inline entity mentions and autocomplete.

The sidebar has a new top-level **"AI"** section with: Morning Briefing, My Memory, Skills.

---

## Screen 1: AI Morning Briefing Page (MEDIUM priority)

**Template:** T4 — Briefing Dashboard
**Route:** `/ai/briefing`
**Story:** E5.S5

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ AI > Morning Briefing                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ "Good morning, Sarah"                    [🔄 Refresh]   │
│ Thursday, 27 February 2026                               │
│                                                          │
│ ── Summary Metrics ─────────────────────────────────── │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ Revenue  │ │ Cash     │ │ Overdue  │ │ Pipeline │   │
│ │ £347,200 │ │ £128,400 │ │ 7        │ │ £215,000 │   │
│ │ +11% ▲   │ │ -12% ▼   │ │ +3 ▲     │ │ +14% ▲   │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│ ── Actionable Items ────────────────────────────────── │
│ ┌─ Briefing Card ─────────────────────────────────┐    │
│ │ ⚠️ 3 invoices overdue >30 days (£42,100)        │    │
│ │ Acme Ltd £18,200 · Bolt Inc £14,600 · ...       │    │
│ │ ✨ AI: "Recommend chasing Acme first — largest   │    │
│ │     amount, good payment history"                │    │
│ │ [Chase All]  [Review Details →]                  │    │
│ └──────────────────────────────────────────────────┘    │
│ ┌─ Briefing Card ─────────────────────────────────┐    │
│ │ 💰 AP run due Friday — 12 invoices (£67,300)     │    │
│ │ ✨ AI: "All within credit terms. Approve to      │    │
│ │     maintain supplier relationships"             │    │
│ │ [Approve All]  [Review Batch →]                  │    │
│ └──────────────────────────────────────────────────┘    │
│ ┌─ Briefing Card ─────────────────────────────────┐    │
│ │ 📊 Cash flow forecast: 14-day safety window       │    │
│ │ ✨ AI: "Revenue pipeline is strong. Consider       │    │
│ │     accelerating collections on 7 overdue items" │    │
│ │ [View Forecast →]                                │    │
│ └──────────────────────────────────────────────────┘    │
│ ┌─ Briefing Card ─────────────────────────────────┐    │
│ │ 📋 3 POs awaiting approval (£23,800)              │    │
│ │ ✨ AI: "2 are within policy. 1 needs review —     │    │
│ │     exceeds department budget by 12%"            │    │
│ │ [Approve 2]  [Review 1 →]                        │    │
│ └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Data Displayed
- **Greeting:** Dynamic "Good morning/afternoon/evening, {firstName}" with current date
- **Summary Metrics:** 4 KPI cards with large mono-font values, trend badges (green up / red down), sparklines
- **Briefing Cards:** Each contains:
  - Category icon + title + aggregate figure
  - Entity preview (names, amounts in JetBrains Mono)
  - AI recommendation text (prefixed with ✨, styled in `bg-[#ede9fe] text-[#6d28d9]` chip)
  - 1-2 action buttons (primary purple + outline secondary)

### Actions
- **Refresh:** Outline button with rotate icon, regenerates the briefing
- **Per-card primary:** "Chase All", "Approve All", "Approve 2" — purple filled
- **Per-card secondary:** "Review Details →", "Review Batch →" — outline link-style

### Interactions
- **Loading state:** Skeleton cards (6 skeleton rectangles in the card grid area), pulsing. NOT spinners.
- **Empty state:** "Your briefing is being prepared..." with a soft illustration and "Check back shortly" message
- **Refresh animation:** Cards fade out then fade in with staggered fadeInUp
- **AI text highlight:** The ✨ AI recommendation section within each card has a subtle `bg-[#f5f3ff]` background with left purple border (2px solid `#7c3aed`)
- **Role-based content:** Cards shown depend on user role (Finance Manager sees AR/AP/Cash, Sales sees Pipeline/Quotes)

### New Components Needed
- `BriefingActionCard` — Extends existing `BriefingCard` with action buttons, AI recommendation section, entity preview list

### Responsive Behaviour
- **Desktop (1024px+):** 4-column metrics grid, single-column briefing cards (full width for readability)
- **Tablet (768px):** 2-column metrics grid, single-column briefing cards
- **Phone (375px):** 1-column metrics grid (horizontal scroll option), briefing cards stack vertically, action buttons become full-width

### AI Co-Pilot Integration
- "Ask AI about this" link on each briefing card opens the Co-Pilot drawer with context pre-filled
- Briefing generated server-side via `GET /ai/briefing` — role-aware

---

## Screen 2: AI Memory Management Page (HIGH priority)

**Template:** T7 — Settings
**Route:** `/ai/memory`
**Story:** E5b.S5

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ AI > My Memory                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ Memory Settings Panel ─────────────────────────────┐ │
│ │                                                      │ │
│ │ Enable AI Memory              [━━━━━━ ON]            │ │
│ │ The AI remembers your preferences,                   │ │
│ │ instructions, and workflow patterns.                  │ │
│ │                                                      │ │
│ │ Categories                                           │ │
│ │ [☑ Preferences] [☑ Instructions] [☑ Workflows]      │ │
│ │ [☑ Decisions]   [☑ Corrections]                     │ │
│ │                                                      │ │
│ │ Auto-delete after   [90 days ▾]                      │ │
│ │                                                      │ │
│ │ ┌──────────────────────────────────────────────┐    │ │
│ │ │ [🗑️ Forget Everything]                        │    │ │
│ │ │  Permanently delete all AI memories.          │    │ │
│ │ │  This cannot be undone.                       │    │ │
│ │ └──────────────────────────────────────────────┘    │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [🔍 Search memories...]        [Filter by category ▾]   │
│                                         [All] active     │
│                                                          │
│ ── Preferences (4) ──────────────────────────────────── │
│ ┌─ Memory Card ──────────────────────────────────────┐  │
│ │ "Prefers overdue invoices sorted by amount          │  │
│ │  descending, not by date"                           │  │
│ │                                                     │  │
│ │ 📌 PREFERENCE     Explicit     3 Feb 2026           │  │
│ │ Last used: 2 days ago                               │  │
│ │                                                     │  │
│ │                              [✏️ Edit]  [🗑️ Delete] │  │
│ └─────────────────────────────────────────────────────┘  │
│ ┌─ Memory Card ──────────────────────────────────────┐  │
│ │ "Always apply Net 30 payment terms for new          │  │
│ │  customers unless told otherwise"                   │  │
│ │                                                     │  │
│ │ 📌 INSTRUCTION    Explicit     15 Jan 2026          │  │
│ │ Last used: 5 days ago                               │  │
│ │                                                     │  │
│ │                              [✏️ Edit]  [🗑️ Delete] │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ── Workflows (2) ────────────────────────────────────── │
│ ┌─ Memory Card ──────────────────────────────────────┐  │
│ │ "Usually reviews AR aging report on Fridays         │  │
│ │  and chases overdue invoices >30 days first"        │  │
│ │                                                     │  │
│ │ 🔄 WORKFLOW       Learned      28 Jan 2026          │  │
│ │ Last used: today                                    │  │
│ │                                                     │  │
│ │                              [✏️ Edit]  [🗑️ Delete] │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ── Corrections (1) ──────────────────────────────────── │
│ ┌─ Memory Card ──────────────────────────────────────┐  │
│ │ "VAT rate for consulting services is 20%, not 0%    │  │
│ │  — corrected from AI suggestion on 10 Feb 2026"     │  │
│ │                                                     │  │
│ │ 🔧 CORRECTION     Learned      10 Feb 2026          │  │
│ │ Last used: 1 week ago                               │  │
│ │                                                     │  │
│ │                              [✏️ Edit]  [🗑️ Delete] │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ── Decisions (1) ────────────────────────────────────── │
│ ┌─ Memory Card ──────────────────────────────────────┐  │
│ │ "Approved 5% discount threshold for orders over     │  │
│ │  £10,000 from repeat customers"                     │  │
│ │                                                     │  │
│ │ 📋 DECISION       Explicit     22 Jan 2026          │  │
│ │ Last used: 3 days ago                               │  │
│ │                                                     │  │
│ │                              [✏️ Edit]  [🗑️ Delete] │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Displayed
- **Memory content:** Main text describing what the AI remembers — shown in the card body, regular weight, `text-sm`
- **Category badge:** Colour-coded pill badge at bottom of card
  - PREFERENCE: `bg-[#dbeafe] text-[#1e40af]` (blue)
  - INSTRUCTION: `bg-[#e0e7ff] text-[#3730a3]` (indigo)
  - WORKFLOW: `bg-[#d1fae5] text-[#065f46]` (green)
  - CORRECTION: `bg-[#fef3c7] text-[#92400e]` (amber)
  - DECISION: `bg-[#ede9fe] text-[#6d28d9]` (purple)
- **Source badge:** `Explicit` (user told the AI) or `Learned` (AI inferred) — muted grey pill
- **Date:** DD MMM YYYY format
- **Last used:** Relative time ("2 days ago", "today", "1 week ago")

### Actions
- **Settings Panel:** Toggle switch for enable/disable, category checkboxes, retention dropdown
- **Forget Everything:** Destructive button in a warning card (red border, red text), opens confirmation dialog
- **Per-card Edit:** Opens a dialog with textarea to edit the memory text
- **Per-card Delete:** Opens confirmation dialog "Delete this memory?"

### Interactions
- **Search:** Debounced text search (300ms) across memory content. Results filter in real-time.
- **Category filter:** Multi-select dropdown. Active filters shown as removable chips below the search bar.
- **Edit Dialog:** Modal with textarea (pre-filled with memory content), Save/Cancel buttons. Textarea auto-resizes.
- **Delete Confirmation:** Simple dialog: "Are you sure? This memory helps the AI understand your preferences."
- **Forget Everything Confirmation:** Destructive dialog with text input — user must type "FORGET" to confirm. Red-themed dialog with warning icon.
- **Loading state:** Skeleton cards (3-4 cards) in a single column with pulsing animation
- **Empty state:** Illustration of a brain/lightbulb + "No memories yet — the AI will learn your preferences as you work" + "Start a conversation" CTA button
- **Empty search:** "No memories match your search" with clear filter link
- **Category section:** Collapsible group header with item count badge. Section title is the category name with count in parentheses.

### New Components Needed
- `MemoryCard` — Card with content text, category badge, source badge, date, last-used relative time, edit/delete actions
- `MemorySettingsPanel` — Toggle, category checkboxes, retention dropdown, Forget Everything button in warning zone
- `MemoryEditDialog` — Modal dialog with textarea for editing memory content
- `ForgetAllDialog` — Destructive confirmation dialog requiring "FORGET" text input

### Responsive Behaviour
- **Desktop (1024px+):** Settings panel as a card at top. Memory cards in single column (full width for readability). Search + filter bar side by side.
- **Tablet (768px):** Same layout, slightly narrower cards
- **Phone (375px):** Settings panel collapsible (accordion). Search and filter stack vertically. Memory cards full width. Edit/Delete buttons become icon-only (tooltip on hover). Forget Everything button full-width.

### AI Co-Pilot Integration
- Each memory card has a subtle "Used in X conversations" stat
- The AI references these memories when generating responses — shown as "📌 Referenced" indicator during chat

---

## Screen 3: AI Skills Browser Page (HIGH priority)

**Template:** T7 — Settings (read-only for STAFF, editable for ADMIN)
**Route:** `/ai/skills`
**Story:** E5b.S5

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ AI > Skills                                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [🔍 Search skills...]              [Filter by module ▾]  │
│                                                          │
│ Your AI co-pilot has these skills. Skills are grouped    │
│ by module and can be activated or deactivated.           │
│                                                          │
│ ▼ Views & Navigation (5 skills) ─────────────────────── │
│ ┌─ Skill Card ───────────────────────────────────────┐  │
│ │ Open Entity List                                    │  │
│ │ Navigate to an entity list page and display records │  │
│ │                                                     │  │
│ │ Triggers:                                           │  │
│ │ [show] [open] [view] [list] [display]               │  │
│ │                                                     │  │
│ │ Won't match:                                        │  │
│ │ [create] [new] [edit] [delete]                      │  │
│ │                                                     │  │
│ │ Pattern: CONTEXT_AWARE          [━━━━━━ ON]         │  │
│ └─────────────────────────────────────────────────────┘  │
│ ┌─ Skill Card ───────────────────────────────────────┐  │
│ │ Apply Data Filter                                   │  │
│ │ Apply an ad-hoc filter or saved view to a list page │  │
│ │                                                     │  │
│ │ Triggers:                                           │  │
│ │ [filter] [show only] [where] [with]                 │  │
│ │                                                     │  │
│ │ Pattern: ITERATIVE              [━━━━━━ ON]         │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ▼ Finance (4 skills) ────────────────────────────────── │
│ ┌─ Skill Card ───────────────────────────────────────┐  │
│ │ Post Journal Entry                                  │  │
│ │ Create and post a manual journal entry              │  │
│ │                                                     │  │
│ │ Triggers:                                           │  │
│ │ [post journal] [create journal] [manual entry]      │  │
│ │                                                     │  │
│ │ Won't match:                                        │  │
│ │ [reverse] [void]                                    │  │
│ │                                                     │  │
│ │ Pattern: REQUIRES_APPROVAL      [━━━━━━ ON]         │  │
│ └─────────────────────────────────────────────────────┘  │
│ ┌─ Skill Card ───────────────────────────────────────┐  │
│ │ Generate Financial Report                           │  │
│ │ Run P&L, Balance Sheet, or Trial Balance            │  │
│ │                                                     │  │
│ │ Triggers:                                           │  │
│ │ [P&L] [profit and loss] [balance sheet]             │  │
│ │ [trial balance] [financial report]                  │  │
│ │                                                     │  │
│ │ Pattern: CONTEXT_AWARE          [━━━━━━ ON]         │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ▶ Accounts Receivable (5 skills) ────────────────────── │
│                                                          │
│ ▶ Accounts Payable (4 skills) ───────────────────────── │
│                                                          │
│ ▶ Sales (6 skills) ──────────────────────────────────── │
│                                                          │
│ ▶ Purchasing (4 skills) ─────────────────────────────── │
│                                                          │
│ ▶ Inventory (5 skills) ──────────────────────────────── │
│                                                          │
│ ▶ CRM (3 skills) ────────────────────────────────────── │
│                                                          │
│ ▶ HR & Payroll (4 skills) ───────────────────────────── │
│                                                          │
│ ▶ Manufacturing (3 skills) ──────────────────────────── │
└─────────────────────────────────────────────────────────┘
```

### Data Displayed
- **Skill name:** Bold title (Plus Jakarta Sans, 16px/600)
- **Skill description:** Body text below name (Inter, 14px/400, `text-muted-foreground`)
- **Trigger phrases:** Green-tinted pill tags `bg-[#d1fae5] text-[#065f46]` (positive triggers — what activates this skill)
- **Negative triggers:** Red-tinted pill tags `bg-[#fee2e2] text-[#991b1b]` under "Won't match:" label (phrases that explicitly DON'T match this skill)
- **Orchestration pattern badge:** Muted pill showing the execution pattern:
  - `CONTEXT_AWARE` — `bg-[#dbeafe] text-[#1e40af]` (blue)
  - `ITERATIVE` — `bg-[#e0e7ff] text-[#3730a3]` (indigo)
  - `REQUIRES_APPROVAL` — `bg-[#fef3c7] text-[#92400e]` (amber)
  - `AUTONOMOUS` — `bg-[#d1fae5] text-[#065f46]` (green)
- **Active toggle:** Switch component (ON = primary purple, OFF = muted grey). ADMIN only — STAFF users see a static "Active" / "Inactive" badge instead.
- **Module group header:** Accordion trigger with module name, skill count badge, expand/collapse chevron

### Actions
- **Toggle active/inactive:** Switch per skill card (ADMIN only, optimistic update)
- **Click skill:** Opens a slide-out Sheet (right panel) with full skill details (ADMIN: editable trigger phrases, instruction text; STAFF: read-only)
- **Search:** Filters across skill names AND trigger phrases simultaneously
- **Module filter:** Dropdown to show only skills from selected module(s)

### Interactions
- **Accordion expand/collapse:** Each module group expands/collapses independently. Default: first 2 groups expanded, rest collapsed.
- **Toggle animation:** Smooth switch transition with optimistic UI update + rollback on server error
- **Search highlighting:** Matching trigger phrase tags get a thicker border when matched by search
- **Skill detail sheet:** Right-side Sheet component, 400px wide, with full skill details:
  - Name (editable for ADMIN)
  - Description (editable)
  - Full trigger phrases list (tag editor for ADMIN)
  - Full negative triggers list (tag editor for ADMIN)
  - Instruction text (code-style textarea for ADMIN)
  - Pattern badge
  - Created/Modified dates
- **Loading state:** 3 accordion groups with skeleton card placeholders inside
- **Empty state:** "No skills found" + suggestion to adjust search/filter

### New Components Needed
- `SkillPackAccordion` — Accordion wrapper with module name header, skill count badge, expand/collapse
- `SkillCard` — Card with name, description, trigger phrase tags, negative trigger tags, pattern badge, active toggle
- `TriggerPhraseTag` — Colour-coded pill tag (green for positive, red for negative), removable in edit mode
- `SkillDetailSheet` — Right-side Sheet with full skill editing (ADMIN) or viewing (STAFF)

### Responsive Behaviour
- **Desktop (1024px+):** Full-width accordions. Skill cards in single column for readability. Detail Sheet opens from right (400px).
- **Tablet (768px):** Same layout, Sheet becomes wider (80% viewport).
- **Phone (375px):** Accordions stack naturally. Skill cards simplified (trigger tags wrap). Detail Sheet becomes full-screen bottom Sheet. Toggle switch stays inline.

### AI Co-Pilot Integration
- "Test a phrase" input at the top — type a natural language phrase and see which skill would match + confidence score
- Each skill shows "Used X times this week" usage stat

---

## Screen 4: Inline Entity Mentions — Chat Textbox Enhancement (HIGH priority)

**Template:** Custom (enhancement to existing CopilotInput component)
**Route:** N/A (inside Co-Pilot drawer)
**Story:** E5b.S7

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Co-Pilot Drawer (existing)                               │
│                                                          │
│ ┌─ Chat Messages Area ───────────────────────────────┐  │
│ │ (existing chat history)                             │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Enhanced CopilotInput ────────────────────────────┐  │
│ │                                                     │  │
│ │  Send invoice 1042 to contact jo█                   │  │
│ │                                                     │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Entity Autocomplete Dropdown ─────────────────────┐  │
│ │ Contacts for Acme Ltd                  3 results    │  │
│ │ ────────────────────────────────────────────────── │  │
│ │ ▸ 👤 John Smith          john@acme.com             │  │
│ │   👤 Jane Jones           jane@acme.com             │  │
│ │   👤 James Oliver         james@acme.com            │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ─── After entity selection ───────────────────────────  │
│                                                          │
│ ┌─ Enhanced CopilotInput ────────────────────────────┐  │
│ │                                                     │  │
│ │  Send invoice 1042 to [John Smith] asap             │  │
│ │                                                     │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ Entity Chip: purple-tinted pill with entity name         │
│ ┌──────────────┐                                        │
│ │ 👤 John Smith │ — bg-[#ede9fe] text-[#6d28d9]        │
│ └──────────────┘    rounded-full, inline, removable     │
│                     with backspace                       │
└─────────────────────────────────────────────────────────┘

Mobile Layout (bottom sheet instead of dropdown):

┌─────────────────────────────────────────────────────────┐
│ Co-Pilot Drawer (full screen on mobile)                  │
│                                                          │
│ ┌─ Chat Messages ────────────────────────────────────┐  │
│ │ (pushed up by bottom sheet)                         │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Entity Bottom Sheet ──────────────────────────────┐  │
│ │ ─── (drag handle) ───                               │  │
│ │ Contacts for Acme Ltd                               │  │
│ │ [🔍 Search contacts...]                             │  │
│ │                                                     │  │
│ │ 👤 John Smith          john@acme.com                │  │
│ │ 👤 Jane Jones           jane@acme.com                │  │
│ │ 👤 James Oliver         james@acme.com               │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ CopilotInput ─────────────────────────────────────┐  │
│ │ Send invoice 1042 to contact jo█                    │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Displayed
- **Autocomplete dropdown header:** Entity type label + context scope ("Contacts for Acme Ltd") + result count
- **Autocomplete rows:** Icon (entity-type specific) + display name (bold) + subtitle field (email, code, reference number) in `text-muted-foreground`
- **Entity chip (inline):** Purple pill `bg-[#ede9fe] text-[#6d28d9]` with entity type icon + entity name, rendered inline within the textarea text flow
- **Entity icons by type:**
  - Contact: `👤` / User icon
  - Customer: `🏢` / Building icon
  - Invoice: `📄` / FileText icon
  - Product: `📦` / Package icon
  - Purchase Order: `📋` / ClipboardList icon

### Actions
- **Select entity:** Click or Enter on autocomplete row → inserts entity chip at cursor position
- **Remove entity chip:** Backspace when cursor is immediately after the chip → removes chip, restores text
- **Dismiss autocomplete:** Escape key or click outside → closes dropdown
- **Navigate autocomplete:** ↑↓ arrow keys to move selection, Enter to confirm

### Interactions
- **Trigger detection:** As user types, the system monitors for known entity trigger words (e.g., "invoice", "customer", "contact", "product", "order"). After a trigger word + space + 2+ characters, the autocomplete activates.
  - Example: "Send invoice 1042 to contact jo" → detects "contact" + "jo" → shows matching contacts
  - No slash prefix required — natural language detection
- **Context scoping:** If the message already mentions an entity (e.g., "invoice 1042"), the autocomplete scopes results. Invoice 1042 belongs to Acme Ltd, so contact search is scoped to Acme Ltd contacts.
- **Debounced search:** 300ms debounce before sending search request to server
- **Keyboard navigation:**
  - ↑ / ↓: Move highlighted row in autocomplete
  - Enter: Select highlighted entity → insert chip
  - Escape: Dismiss autocomplete
  - Tab: Select first result
- **Entity chip rendering:** The chip is an inline element within the textarea's visual representation. Internally, the text stores `{contact:uuid}` but displays `[John Smith]` as a styled chip.
- **Loading state:** Autocomplete dropdown shows skeleton rows (3 rows) while fetching
- **No results:** "No matching contacts found" with muted text
- **Error state:** "Search unavailable" with retry link
- **Mobile bottom sheet:** On phone (<768px), autocomplete appears as a draggable bottom sheet above the virtual keyboard instead of a dropdown

### New Components Needed
- `EntityMentionInput` — Enhanced textarea that detects entity trigger words, manages chip insertion/removal, and coordinates with autocomplete
- `EntityAutocompleteDropdown` — Positioned dropdown with entity search results, keyboard navigation, context scope header
- `EntityChip` — Inline purple pill with icon + entity name, rendered within text flow, removable
- `EntityBottomSheet` — Mobile-only variant of autocomplete as a draggable bottom sheet

### Responsive Behaviour
- **Desktop (1024px+):** Autocomplete dropdown appears below the cursor position in the textarea. Max 5 visible results with scroll.
- **Tablet (768px):** Same as desktop but dropdown takes more width
- **Phone (375px):** Bottom sheet instead of dropdown. Sheet has drag handle, search input, and scrollable entity list. Sheet takes 50% of viewport height.

### AI Co-Pilot Integration
- Entity chips are sent to the AI as structured references `{entity_type:uuid}` — the AI resolves them to full entity data
- The AI context assembler uses mentioned entities to enrich the prompt with relevant data

---

## Generation Instructions

Generate all screens listed above as React components using:
- Shadcn UI components (already installed: accordion, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip)
- Tailwind CSS 4 classes
- TypeScript
- Lucide React icons

For each screen, provide:
1. The main page component
2. Any new sub-components listed under "New Components Needed"
3. Mock data that demonstrates the layout with realistic ERP data (UK company names, GBP amounts, realistic statuses)

Ensure:
- Page background is `#f4f2ff` throughout
- All cards use 12px radius and purple-tinted hover shadow
- Amounts use JetBrains Mono font
- Status badges use the semantic colour palette defined above
- All animations use fadeInUp/slideIn/stepIn as specified
- Loading states use skeleton patterns, not spinners
- Empty states have illustration + message + CTA
- Entity chips use `bg-[#ede9fe] text-[#6d28d9]` purple pill styling
- Trigger phrase tags use green (`bg-[#d1fae5] text-[#065f46]`) for positive and red (`bg-[#fee2e2] text-[#991b1b]`) for negative
- Category badges on memory cards use their respective semantic colours
- The "Forget Everything" dialog is clearly destructive (red theme, requires typing "FORGET")
- Focus rings use `ring-2 ring-[#7c3aed]/30` on all interactive elements
- The overall feel is premium, polished, and cohesive — NOT generic SaaS

# Design System Foundation

## Design System Choice

**Shadcn UI + Tailwind CSS 4 + Radix Primitives** — a themeable component system with full control.

This is a **Category 3: Themeable System** approach, but closer to custom than most themeable systems because Shadcn UI copies components into your codebase (not a locked npm dependency). You own every line of component code, can modify anything, and still benefit from Radix's accessibility primitives and Tailwind's utility-class architecture.

| Layer | Technology | Role |
|-------|-----------|------|
| **Design tokens** | Tailwind CSS 4 config + CSS custom properties | Colours, spacing, typography, shadows, radii — single source of truth |
| **Accessibility primitives** | Radix UI | ARIA-compliant foundations: dialogs, dropdowns, tabs, tooltips, popovers |
| **Component library** | Shadcn UI (copied into codebase) | Pre-built components (Button, Card, Table, Form, Dialog, etc.) that we own and customise |
| **Utility styling** | Tailwind CSS 4 | Responsive, dark mode, animations — all via utility classes |
| **Icons** | Lucide React | Consistent, tree-shakeable icon set matching Shadcn's aesthetic |
| **Charts** | Recharts (wrapped in Shadcn chart components) | Period comparison charts, trend sparklines, dashboard visualisations |
| **Forms** | React Hook Form + Zod | Type-safe validation, field-level error display, schema-driven forms |

## Rationale for Selection

1. **Ownership without overhead** — Shadcn copies components into `src/components/ui/`. We can modify `<Button>`, `<DataTable>`, `<Dialog>` directly. No waiting for upstream releases, no fighting a locked API. Critical for custom components like `<StatusBadge>`, `<EventFlowTracker>`, `<ConfidenceIndicator>`.

2. **Purple theme native** — Tailwind CSS 4's design token system (`--color-primary`, `--color-secondary`) maps directly to our purple theme from prototypes D/E/F. One `theme.css` file defines the entire visual identity: `#7c3aed` primary, `#f4f2ff` background, semantic status colours. Theme switching (if needed later) is a CSS variable swap.

3. **Accessibility built-in** — Radix primitives handle ARIA attributes, keyboard navigation, focus management, and screen reader support out of the box. For an ERP with complex forms, tabs, dialogs, and tables, this is non-negotiable. Meets WCAG 2.1 AA baseline without custom ARIA work.

4. **Responsive by default** — Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) map directly to our breakpoint system (375px, 768px, 1024px, 1280px). Mobile-first responsive design is a utility class, not a CSS rewrite.

5. **Community and ecosystem** — Shadcn UI has become the de facto standard for React 19 + Tailwind applications. Extensive documentation, active community, growing component library. The team will find solutions to common problems quickly.

6. **Performance** — Tailwind's JIT compiler produces only the CSS classes used. Radix components are tree-shakeable. No massive UI framework bundle. Combined with Vite 6's code splitting, initial load stays under the 3-second target (NFR3).

## Implementation Approach

**Phase 1: Foundation (Story 0)**
- Install Shadcn UI, configure Tailwind CSS 4 with purple theme tokens
- Copy base components: Button, Card, Input, Select, Dialog, Table, Tabs, Form, Badge, Toast, Tooltip
- Define CSS custom properties for the purple theme palette
- Set up responsive breakpoint config matching our 5-tier system

**Phase 2: Custom ERP Components (Stories 1–2)**
- Build `<StatusBadge>` — maps any entity status enum to semantic colour/icon via config
- Build `<HeaderLinesForm>` — generic header + line items layout for all 18 document types
- Build `<EntityList>` — sortable, filterable table with saved views, cursor pagination, and batch selection
- Build `<NotificationCentre>` — 3-tier notification display with actionable items
- Build `<BriefingCard>` — period comparison card with one-tap action for the AI briefing

**Phase 3: AI Components (Stories 3–4)**
- Build `<ConfidenceIndicator>` — green/amber/red field-level indicator with "AI suggested because..." tooltip
- Build `<AICommandInput>` — natural language input with streaming response display
- Build `<DocumentViewer>` — side-by-side original document + extracted data with bounding boxes
- Build `<EventFlowTracker>` — horizontal process lifecycle visualisation

## Customisation Strategy

**Design Tokens (CSS Custom Properties):**

Tokens are defined in two layers in `globals.css`: `:root` defines raw values, and the `@theme inline` block exposes them to Tailwind CSS 4 as `--color-*` aliases.

```
/* ── Core palette (`:root` canonical names) ────────────── */
--primary: #7c3aed;              /* Primary purple */
--primary-light: #a78bfa;        /* Hover/active states */
--primary-dark: #5b21b6;         /* Pressed states */
--primary-50: #f5f3ff;           /* Subtle tint */
--primary-100: #ede9fe;          /* Card hover, selected row */
--background: #f4f2ff;           /* Page background */
--foreground: #1e1b4b;           /* Primary text */
--card: #ffffff;                 /* Cards, panels (surface) */
--card-foreground: #1e1b4b;      /* Text on cards */
--muted-foreground: #6b7280;     /* Secondary/muted text */
--border: #e5e7eb;               /* Card borders, dividers */
--ring: #7c3aed;                 /* Focus rings */
--accent: #f5f3ff;               /* Hover backgrounds */
--destructive: #ef4444;          /* Destructive actions */

/* ── Semantic Status Colours ───────────────────────────── */
--status-initial: #6b7280;       /* Grey — Draft, New */
--status-in-progress: #3b82f6;   /* Blue — Processing, Open */
--status-awaiting: #f59e0b;      /* Amber — Pending Approval */
--status-success: #10b981;       /* Green — Approved, Paid, Completed */
--status-partial: #8b5cf6;       /* Purple — Partially Paid/Delivered */
--status-cancelled: #6b7280;     /* Grey — Cancelled, Voided */
--status-error: #ef4444;         /* Red — Failed, Rejected */
--status-warning: #f59e0b;       /* Amber — Overdue, At Risk */
--status-terminal: #1f2937;      /* Dark — Closed, Archived */

/* ── AI Confidence Colours ─────────────────────────────── */
--confidence-high: #10b981;      /* >=90% — Auto-suggest */
--confidence-medium: #f59e0b;    /* 70–89% — Review */
--confidence-low: #ef4444;       /* <70% — Manual entry */

/* ── Shadow Tokens ─────────────────────────────────────── */
--shadow-card: 0 1px 3px rgba(0,0,0,0.06);
--shadow-card-hover: 0 4px 12px rgba(124,58,237,0.1);
--shadow-dropdown: 0 4px 12px rgba(0,0,0,0.1);

/* ── Radius Tokens ─────────────────────────────────────── */
--radius-card: 0.75rem;          /* 12px — cards, panels */
--radius-button: 0.5rem;         /* 8px — buttons, nav items */
--radius-input: 0.375rem;        /* 6px — form inputs */
--radius-badge: 99px;            /* Pill-shaped badges */

/* ── Typography ────────────────────────────────────────── */
--font-serif: 'Plus Jakarta Sans', sans-serif;  /* Display: headings, navigation */
--font-sans: 'Inter', sans-serif;                /* Body: text, form labels */
--font-mono: 'JetBrains Mono', monospace;        /* Mono: codes, amounts, IDs */
/* Backward-compat aliases also defined: --font-display, --font-body */
```

> **Note on spacing:** Spacing is consumed via Tailwind CSS 4 utility classes (`p-5`, `gap-4`, `mb-6`) which use the standard Tailwind spacing scale (multiples of 4px). Explicit `--space-*` CSS custom properties are not needed in a Tailwind-first codebase.

> **Note on Tailwind `@theme inline`:** The `@theme inline` block in `globals.css` creates `--color-*` aliases (e.g., `--color-primary`, `--color-background`) that Tailwind utility classes consume. Both the `:root` canonical names and the `--color-*` aliases resolve to the same values.

**Component Customisation Levels:**
1. **Token-level** — Change colours, spacing, fonts globally via CSS variables
2. **Variant-level** — Add Nexa-specific variants to Shadcn components (e.g., `<Button variant="approve">`, `<Badge variant="status-success">`)
3. **Composition-level** — Compose Shadcn primitives into ERP-specific components (`<StatusBadge>` = Badge + Icon + Tooltip)
4. **Custom-level** — Build from scratch when no Shadcn primitive applies (`<EventFlowTracker>`, `<DocumentViewer>`)

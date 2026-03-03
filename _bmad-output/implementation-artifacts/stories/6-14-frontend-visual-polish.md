# Story 6.14: Frontend Page-Level Visual Polish — Animations, Dashboard, Module Stubs & Atmosphere

Status: done

## Story

As a user,
I want the dashboard to show meaningful business metrics with animated KPI cards, the login page to have atmospheric visual effects, all module stubs to show professional "coming soon" previews, and all page elements to use the staggered entrance animations already defined in CSS,
so that every visible page in Nexa ERP feels polished, purposeful, and production-ready rather than like placeholder scaffolding.

## Background / Course Correction

E6.13 delivered **component-level** visual polish — Shadcn token reconciliation, button/card/badge/table restyling, login branding, sidebar/header Concept D styling, animation CSS definitions, and typography utilities. However:

1. **Animations defined but never applied** — `fadeInUp`, `slideIn`, `stepIn` keyframes and `.animate-fade-in-up`, `.delay-1`–`.delay-6` classes exist in `globals.css` (lines 142–175) but are not used on any page component
2. **Dashboard is a placeholder** — `routes/_authenticated/index.tsx` renders only `<h1>Dashboard</h1>` (25 lines)
3. **10 module stubs are empty** — each renders `<h1 className="page-title">{t('navigation:moduleName')}</h1>` with no visual content
4. **Login page lacks atmosphere** — has NexaLogo + branded card but no background effects, no entrance animation
5. **403 page is minimal** — plain text with raw `<Link>`, no card, no icon, no animation

This story brings all visible pages up to Concept D prototype fidelity by wiring up animations and adding meaningful visual content.

**Canonical Design Reference:** `_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`

## Acceptance Criteria

1. **GIVEN** any page with a `<PageHeader>` component **WHEN** it loads **THEN** breadcrumbs animate with `fadeInUp delay-1` and the title row with `fadeInUp delay-2`, respecting `prefers-reduced-motion`

2. **GIVEN** the `<EntityListPage>` template **WHEN** it loads **THEN** the search/filter toolbar animates with `fadeInUp delay-2` and the data table with `fadeInUp delay-3`

3. **GIVEN** the login page at `/login` **WHEN** it renders **THEN**:
   - The page background uses a subtle animated gradient mesh (layered radial gradients in purple/violet/indigo tones at 5-8% opacity, slow 15s movement)
   - The NexaLogo animates with `stepIn delay-1`
   - The login card animates with `fadeInUp delay-2`
   - `prefers-reduced-motion: reduce` disables all login animations and gradient movement

4. **GIVEN** the dashboard at `/` (authenticated) **WHEN** it renders **THEN** it shows:
   - Greeting header: "Good morning, {firstName}" with current date subtitle
   - 6 KPI cards in a 3-column grid (2-col tablet, 1-col phone) with staggered `fadeInUp` animations (delay-1 through delay-6)
   - Each KPI card: icon in coloured circle, label, value in JetBrains Mono, trend badge (up/down with colour), inline SVG sparkline, comparison text
   - 2 chart placeholder cards ("Revenue & Payments" bar chart, "Cash Flow Forecast" line chart) using CSS/SVG visuals — no charting library required
   - "Tasks Today" card with 4 mock task items (checkbox, description, priority badge)
   - "Recent Activity" card with 3 mock activity items (avatar, description, timestamp)
   - All data is static mock — no API calls

5. **GIVEN** any of the 10 module stub pages (Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR, Manufacturing, Reporting) **WHEN** they render **THEN** they show:
   - Module icon in a 64px purple-tinted circle, animated `fadeInUp delay-1`
   - Module name as `page-title`, animated `fadeInUp delay-2`
   - Description paragraph, animated `fadeInUp delay-3`
   - "Coming in a future release" label
   - Feature preview card listing 3-5 planned features with check icons, animated `fadeInUp delay-4`
   - The module icon matches the sidebar navigation icon for that module

6. **GIVEN** the 403 page **WHEN** it renders **THEN** it shows:
   - ShieldX icon in a large red-tinted circle, animated `fadeInUp delay-1`
   - "403" in display font (Plus Jakarta Sans bold), animated `fadeInUp delay-2`
   - Error message and description, animated `fadeInUp delay-3`
   - "Back to Dashboard" as a `<Button>` component (not raw `<Link>`), animated `fadeInUp delay-4`
   - Wrapped in a `<Card>` component with Concept D card styling

7. **GIVEN** any animated element on any page **WHEN** the user has `prefers-reduced-motion: reduce` enabled **THEN** all animations are disabled (opacity immediately 1, no transform) per existing CSS media query in `globals.css` lines 178-186

8. **GIVEN** all new visible text added by this story **WHEN** rendered **THEN** it uses i18n translation keys via `useI18n()` `t()` — no hardcoded English strings

## Tasks / Subtasks

- [x] **Task 1: Wire animations to PageHeader** (AC: #1)
  - [x] 1.1 — In `apps/web/src/components/templates/page-header.tsx`, add `animate-fade-in-up delay-1` to the breadcrumb container
  - [x] 1.2 — Add `animate-fade-in-up delay-2` to the title + action bar row
  - [x] 1.3 — Verify `prefers-reduced-motion` CSS media query handles these classes (already defined in globals.css)

- [x] **Task 2: Wire animations to EntityListPage** (AC: #2)
  - [x] 2.1 — In `apps/web/src/components/templates/entity-list-page.tsx`, add `animate-fade-in-up delay-2` to the search/filter toolbar div (line ~262)
  - [x] 2.2 — Add `animate-fade-in-up delay-3` to the data table wrapper div (line ~291)

- [x] **Task 3: Login page atmospheric effects** (AC: #3)
  - [x] 3.1 — In `apps/web/src/styles/globals.css`, add `@keyframes gradientShift` and `.login-bg-mesh` class:
    ```css
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    .login-bg-mesh {
      background:
        radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 40% 80%, rgba(139,92,246,0.05) 0%, transparent 50%),
        var(--color-background);
      background-size: 200% 200%;
      animation: gradientShift 15s ease-in-out infinite;
    }
    ```
  - [x] 3.2 — Add `.login-bg-mesh` to `prefers-reduced-motion` media query to disable animation
  - [x] 3.3 — In `apps/web/src/routes/login.tsx`, apply `login-bg-mesh` class to the `LoginPageShell` outer container (replacing plain `bg-background`)
  - [x] 3.4 — Add `animate-step-in delay-1` to the NexaLogo container
  - [x] 3.5 — Add `animate-fade-in-up delay-2` to the login Card

- [x] **Task 4: Dashboard page rewrite** (AC: #4) — BIGGEST IMPACT
  - [x] 4.1 — Create `apps/web/src/components/dashboard/mock-data.ts` (NEW) with all static mock data:
    - 6 KPI items: { key, label (i18n key), value, formattedValue, trend (up/down), trendValue, trendLabel, sparklineData (number[]), iconName, iconColorClass }
    - 4 task items: { id, description (i18n key), priority, isChecked }
    - 3 activity items: { id, name, initials, avatarColor, description (i18n key), timestamp }
    - 2 chart configs: { title (i18n key), type ('bar'|'line') }
  - [x] 4.2 — Create `apps/web/src/components/dashboard/sparkline.tsx` (NEW):
    - SVG component: `<svg viewBox="0 0 140 24">` with `<polyline>` from data points
    - Props: `data: number[]`, `color: string`, `className?: string`
    - Normalise data to fit 0-24 y-range
  - [x] 4.3 — Create `apps/web/src/components/dashboard/kpi-card.tsx` (NEW):
    - Uses `Card` component from `@/components/ui/card`
    - Layout: icon circle (40px, coloured bg) | label + trend badge row | value (mono-amount) | sparkline | comparison text
    - Icon from Lucide by name via dynamic import or switch
    - Trend badge: green up-arrow for positive, red down-arrow for negative
    - Value in `font-mono tabular-nums text-2xl font-bold`
    - Props: `{ label, value, trend, trendValue, sparklineData, icon, iconColorClass, delay }`
  - [x] 4.4 — Rewrite `apps/web/src/routes/_authenticated/index.tsx`:
    - Import `useAuthStore` for user name, `useI18n` for translations, `useBreakpoint` for responsive grid
    - Greeting section: "Good morning, {firstName}" (`animate-fade-in-up`)
    - KPI grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` with 6 KpiCard components (delay-1 through delay-6)
    - Chart row: 2 placeholder chart cards (`grid-cols-1 lg:grid-cols-2`) with CSS bar chart / SVG line chart
    - Bottom row: Tasks card + Activity card (`grid-cols-1 lg:grid-cols-2`)
    - All sections use `animate-fade-in-up` with staggered delays
  - [x] 4.5 — Chart placeholders: "Revenue & Payments" card with 6 CSS-only bar columns (flex items with gradient fills from primary-light to primary), "Cash Flow Forecast" card with SVG `<path>` representing a line chart
  - [x] 4.6 — Tasks card: 4 items with `Checkbox` component, task description, priority `Badge`
  - [x] 4.7 — Activity card: 3 items with avatar circle (initials, coloured bg using same pattern as user-list-page.tsx AVATAR_COLORS), description, relative timestamp

- [x] **Task 5: Module placeholder component** (AC: #5)
  - [x] 5.1 — Create `apps/web/src/components/templates/module-placeholder.tsx` (NEW):
    ```tsx
    interface ModulePlaceholderProps {
      moduleKey: string;
      icon: LucideIcon;
      descriptionKey: string;
      features: string[]; // i18n keys
    }
    ```
    - Centre-aligned layout
    - Icon in 64px circle: `bg-secondary` (= `#ede9fe`), icon `text-primary` (= `#7c3aed`)
    - Module name h1 with `page-title` class
    - Description paragraph in `text-muted-foreground`
    - "Coming in a future release" label: `text-xs uppercase tracking-wider text-muted-foreground/60`
    - Feature card: `Card` with `CardContent`, each feature as a row with `CheckCircle2` icon (green) + text
    - All sections animated with staggered `fadeInUp delay-1` through `delay-5`

- [x] **Task 6: Update 10 module stub pages** (AC: #5)
  - [x] 6.1 — `routes/_authenticated/finance/index.tsx` — use `ModulePlaceholder` with icon=Landmark, 5 features (Chart of Accounts, Journal Entries, Period Close, Bank Reconciliation, Budgets)
  - [x] 6.2 — `routes/_authenticated/ar/index.tsx` — icon=Receipt, 5 features (Customers, Invoices, Payments, Credit Notes, Statements)
  - [x] 6.3 — `routes/_authenticated/ap/index.tsx` — icon=FileText, 4 features (Suppliers, Bills, Payments, Credit Notes)
  - [x] 6.4 — `routes/_authenticated/sales/index.tsx` — icon=ShoppingCart, 3 features (Quotes, Orders, Delivery Notes)
  - [x] 6.5 — `routes/_authenticated/purchasing/index.tsx` — icon=Package, 2 features (Purchase Orders, Goods Receipts)
  - [x] 6.6 — `routes/_authenticated/inventory/index.tsx` — icon=Warehouse, 4 features (Items, Warehouses, Stock Movements, Stock Takes)
  - [x] 6.7 — `routes/_authenticated/crm/index.tsx` — icon=Users, 4 features (Leads, Opportunities, Campaigns, Contacts)
  - [x] 6.8 — `routes/_authenticated/hr/index.tsx` — icon=UserCog, 5 features (Employees, Contracts, Leave, Payroll, Appraisals)
  - [x] 6.9 — `routes/_authenticated/manufacturing/index.tsx` — icon=Factory, 4 features (Recipes, Work Orders, Machines, MRP)
  - [x] 6.10 — `routes/_authenticated/reporting/index.tsx` — icon=BarChart3, 2 features (Financial Reports, Custom Dashboards)

- [x] **Task 7: 403 page polish** (AC: #6)
  - [x] 7.1 — In `apps/web/src/routes/403.tsx`:
    - Import `ShieldX` from lucide-react, `Button` from `@/components/ui/button`, `Card`/`CardContent` from `@/components/ui/card`
    - Wrap content in `<Card>` with `max-w-md mx-auto`
    - ShieldX icon in 64px circle: `bg-destructive/10 text-destructive`
    - "403" heading: `font-display text-6xl font-bold text-foreground`
    - Replace raw `<Link>` with `<Button asChild><Link to="/">...</Link></Button>`
    - Add staggered `animate-fade-in-up` delays to icon (delay-1), heading (delay-2), messages (delay-3), button (delay-4)

- [x] **Task 8: Add i18n translation keys** (AC: #8)
  - [x] 8.1 — In `packages/i18n/locales/en/common.json`, add dashboard keys:
    - `dashboard.greeting.morning`, `dashboard.greeting.afternoon`, `dashboard.greeting.evening`
    - `dashboard.subtitle`, `dashboard.kpi.*` (6 KPI labels), `dashboard.charts.*` (2 chart titles)
    - `dashboard.tasks.title`, `dashboard.tasks.*` (4 task descriptions)
    - `dashboard.activity.title`, `dashboard.activity.*` (3 activity descriptions)
    - `dashboard.comingSoon`, `dashboard.comingSoonLabel`
  - [x] 8.2 — Add module description keys: `modules.finance.description`, `modules.finance.feature.*`, etc. for all 10 modules

- [x] **Task 9: Visual verification** (AC: all)
  - [x] 9.1 — Build passes clean: `pnpm --filter @nexa/web typecheck` — zero errors
  - [ ] 9.2 — Verify login page: gradient mesh background, animated logo + card entry *(manual — requires browser)*
  - [ ] 9.3 — Verify dashboard: 6 KPI cards with sparklines, 2 chart placeholders, tasks, activity — all animated *(manual — requires browser)*
  - [ ] 9.4 — Verify all 10 module stubs show professional "coming soon" with icon, description, features *(manual — requires browser)*
  - [ ] 9.5 — Verify 403 page: card wrapper, ShieldX icon, Button component, animations *(manual — requires browser)*
  - [ ] 9.6 — Verify PageHeader and EntityListPage animations (check user-list-page) *(manual — requires browser)*
  - [ ] 9.7 — Toggle `prefers-reduced-motion: reduce` in DevTools — all animations disabled *(manual — requires browser)*
  - [ ] 9.8 — Check phone (<768px) and tablet (768-1024px) — dashboard grid collapses correctly *(manual — requires browser)*

## Dev Notes

### Critical Implementation Context

**E6.13 Completed (DO NOT REDO):**
- All Shadcn component styling (button, card, badge, table, input, dialog, etc.) — DONE
- Token reconciliation (globals.css `@theme` block is the sole source of truth) — DONE
- Login branding (NexaLogo, brand text, tagline) — DONE
- Sidebar/header Concept D styling — DONE
- Animation CSS keyframes + utility classes + stagger delays + reduced-motion media query — DONE
- Typography utilities (`.page-title`, `.section-header`, `.mono-amount`) — DONE
- StatusBadge, AiChip components — DONE
- `nexa-logo.tsx`, `ai-chip.tsx` — CREATED

**Tailwind CSS 4 Architecture (from E6.13 learnings):**
- `@theme` block in globals.css is the SOLE source for utility class resolution
- `:root` block only exists for Sonner toast bridge variables
- Use `--color-*` tokens from `@theme` block for all colour references
- Tailwind classes like `bg-primary`, `text-muted-foreground`, `shadow-card` all resolve from `@theme`

**Existing Animation System (globals.css lines 142-195):**
```css
/* Already defined — DO NOT recreate */
@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
@keyframes stepIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.animate-fade-in-up { animation: fadeInUp 0.4s ease forwards; opacity: 0; }
.animate-slide-in { animation: slideIn 0.3s ease forwards; opacity: 0; }
.animate-step-in { animation: stepIn 0.5s ease forwards; opacity: 0; }
.delay-1 { animation-delay: 0.05s; }  /* through .delay-6 at 0.30s */
```
Reduced motion media query at lines 178-186 disables all of these. **Just add these classes to elements — no new animation infrastructure needed.**

**Avatar Color Pattern (from user-list-page.tsx — REUSE):**
```typescript
const AVATAR_COLORS = [
  'bg-[#ede9fe] text-[#7c3aed]', 'bg-[#dbeafe] text-[#3b82f6]',
  'bg-[#d1fae5] text-[#10b981]', 'bg-[#fef3c7] text-[#d97706]',
  'bg-[#fee2e2] text-[#ef4444]', 'bg-[#e0e7ff] text-[#4f46e5]',
] as const;
```
Extract to a shared utility if needed, or duplicate in mock-data.ts.

**Responsive Breakpoints (from use-breakpoint.ts):**
- Desktop: >= 1024px (`lg:` prefix)
- Tablet: 768-1023px (`md:` prefix)
- Phone: < 768px (default / no prefix)
- Use Tailwind responsive prefixes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Module Icons (from navigation-config.ts — MUST MATCH):**
| Module | Lucide Icon |
|--------|-------------|
| finance | Landmark |
| ar | Receipt |
| ap | FileText |
| sales | ShoppingCart |
| purchasing | Package |
| inventory | Warehouse |
| crm | Users |
| hr | UserCog |
| manufacturing | Factory |
| reporting | BarChart3 |

**Dashboard Mock Data Strategy:**
- All data is static/hardcoded in `mock-data.ts` — NO API calls
- Use `£` currency symbol for UK ERP context
- Values should look realistic for a UK SME (£100K-£500K revenue range)
- Mock data file is isolated so it's easy to replace with real API calls later
- Use `formatDate` from `@nexa/i18n` for date display

**i18n Pattern:**
```typescript
const { t } = useI18n();
// Use keys like: t('dashboard.greeting.morning', { name: firstName })
// NOT: "Good morning, Mohammed"
```

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: N/A for this story (no data queries, all mock data)
- **i18n**: ALL user-facing text must use translation keys — including dashboard greetings, KPI labels, task descriptions, module descriptions, feature lists, "coming soon" label. Add keys to `packages/i18n/locales/en/common.json` (or relevant namespace)
- **Audit**: N/A for this story (no state-changing operations)
- **Attachments/Notes/Tasks**: N/A for this story

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **UX Design Spec** | §Visual Design Foundation | Colour system, typography scale, spacing grid — all tokens already in globals.css `@theme` |
| **UX Design Spec** | §Design Direction Decision | Concept D rationale, card 12px radius, shadow tokens, purple hover |
| **UX Prototypes** | concept-d-purple-copilot.html | Dashboard layout, KPI card design, chart placeholders, animation system |
| **UX Design Spec** | §UX Quality Contract §4 | Visual fidelity checklist — animations must be present on page load |
| **Architecture** | §5 Frontend Architecture | Component architecture, Tailwind CSS 4 + Shadcn, `components/templates/` for shared templates |
| **Project Context** | §3 i18n Infrastructure | Translation key requirements for ALL user-facing text |
| **Project Context** | §8 Mobile Strategy | Web-first design, mobile adapts — use responsive Tailwind prefixes |
| **API Contracts** | N/A | No API changes in this story |
| **Data Models** | N/A | No data model changes in this story |
| **Event Catalog** | N/A | No events emitted in this story |
| **Business Rules** | N/A | No business rules enforced in this story |
| **State Machine Ref** | N/A | No state transitions in this story |

### Project Structure Notes

**Files to create (NEW — 4 files):**
```
apps/web/src/components/dashboard/mock-data.ts        — Static mock data for dashboard
apps/web/src/components/dashboard/sparkline.tsx        — SVG sparkline component
apps/web/src/components/dashboard/kpi-card.tsx         — KPI card component
apps/web/src/components/templates/module-placeholder.tsx — Module "coming soon" template
```

**Files to modify (EDIT — 16 files):**
```
apps/web/src/styles/globals.css                        — Add gradientShift keyframes + .login-bg-mesh class
apps/web/src/components/templates/page-header.tsx      — Add animate-fade-in-up to breadcrumbs + title
apps/web/src/components/templates/entity-list-page.tsx — Add animate-fade-in-up to toolbar + table
apps/web/src/routes/login.tsx                          — Apply login-bg-mesh, card/logo animations
apps/web/src/routes/_authenticated/index.tsx           — REWRITE: Full dashboard with KPIs, charts, tasks, activity
apps/web/src/routes/_authenticated/finance/index.tsx   — Use ModulePlaceholder
apps/web/src/routes/_authenticated/ar/index.tsx        — Use ModulePlaceholder
apps/web/src/routes/_authenticated/ap/index.tsx        — Use ModulePlaceholder
apps/web/src/routes/_authenticated/sales/index.tsx     — Use ModulePlaceholder
apps/web/src/routes/_authenticated/purchasing/index.tsx — Use ModulePlaceholder
apps/web/src/routes/_authenticated/inventory/index.tsx — Use ModulePlaceholder
apps/web/src/routes/_authenticated/crm/index.tsx       — Use ModulePlaceholder
apps/web/src/routes/_authenticated/hr/index.tsx        — Use ModulePlaceholder
apps/web/src/routes/_authenticated/manufacturing/index.tsx — Use ModulePlaceholder
apps/web/src/routes/_authenticated/reporting/index.tsx — Use ModulePlaceholder
apps/web/src/routes/403.tsx                            — Card wrapper, ShieldX icon, Button, animations
```

**Files to add translation keys:**
```
packages/i18n/locales/en/common.json                   — Dashboard and module description keys
```

### Previous Story Intelligence (from E6.13)

**Key learnings from E6.13 completion notes:**
- Token reconciliation: `@theme` block is sole source of truth — Shadcn HSL vars were REMOVED (not reconciled) because Tailwind CSS 4 resolves from `@theme` directly
- Old HSL conversion bug: `--primary: 263 70% 58%` produced `#8249df` not `#7c3aed` — this was fixed by using hex directly in `@theme`
- Migrated all `text-text`/`text-text-muted` → `text-foreground`/`text-muted-foreground` across 17 files — DO NOT reintroduce these invalid classes
- Inline `fontFamily` styles migrated to Tailwind `font-display` utility — maintain this pattern
- Button uses CVA (class-variance-authority) — maintain when modifying
- Card uses simple functional components — keep simple
- CopilotDrawer has reduced-motion guard — this is the pattern to follow

**Files created by E6.13 that this story MUST NOT break:**
- `apps/web/src/components/ui/nexa-logo.tsx` — reusable logo component (import it, don't recreate)
- `apps/web/src/components/ui/ai-chip.tsx` — AI chip component
- All restyled Shadcn components in `components/ui/` — do not modify their styling

### Git Intelligence

Last 5 commits:
- `b39201f fix(sidebar): remove max-height cap on expanded menu groups`
- `07c872c feat(epic-e6): Visual Design Polish — Concept D fidelity (E6.13)`
- `26cb2d7 feat(epic-e6): Web Frontend Shell + Mobile Scaffold`
- `396f925 feat(epic-e5): AI Orchestration — service layer, chat, actions, predictions, briefings`
- `86d5d57 Revert "feat(db): add granular RBAC schema"`

E6.13 commit (`07c872c`) modified 40+ files for component styling. This story builds on that work at the page level.

### Source References

- [Source: apps/web/src/styles/globals.css:142-195] — Animation keyframes, utility classes, delays, reduced-motion
- [Source: apps/web/src/routes/_authenticated/index.tsx] — Current dashboard placeholder (25 lines, just h1)
- [Source: apps/web/src/routes/_authenticated/finance/index.tsx] — Module stub pattern (22 lines, just h1)
- [Source: apps/web/src/routes/login.tsx:1-60] — Login page with NexaLogo, Card, Form
- [Source: apps/web/src/routes/403.tsx] — Access denied page (47 lines, plain text + Link)
- [Source: apps/web/src/components/templates/page-header.tsx] — PageHeader (94 lines)
- [Source: apps/web/src/components/templates/entity-list-page.tsx] — EntityListPage (355 lines)
- [Source: apps/web/src/hooks/use-breakpoint.ts] — useBreakpoint(), usePrefersReducedMotion() hooks
- [Source: apps/web/src/features/admin/users/user-list-page.tsx:25-40] — AVATAR_COLORS pattern to reuse
- [Source: apps/web/src/lib/navigation-config.ts] — Module icon definitions
- [Source: _bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html] — Canonical visual reference
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md] — Colour system, typography
- [Source: _bmad-output/planning-artifacts/project-context.md §3] — i18n requirements
- [Source: _bmad-output/implementation-artifacts/6-13-visual-design-polish.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Typecheck: `pnpm --filter @nexa/web typecheck` — zero errors

### Completion Notes List
- All 9 tasks implemented (Tasks 1-8 fully complete, Task 9 typecheck passes, visual verification requires manual browser testing)
- i18n `keySeparator: false` — all dotted keys in common.json are flat lookups, not nested
- MFA card also received `animate-fade-in-up delay-2` for consistency with login card
- `prefers-reduced-motion` media query updated to include `.login-bg-mesh` class
- Dashboard uses static mock data (no API calls) — isolated in `mock-data.ts` for future replacement
- All module icons match sidebar navigation-config.ts icons exactly

### File List

**Files created (4):**
- `apps/web/src/components/dashboard/mock-data.ts` — Static mock data for dashboard KPIs, tasks, activity, charts
- `apps/web/src/components/dashboard/sparkline.tsx` — SVG sparkline component
- `apps/web/src/components/dashboard/kpi-card.tsx` — KPI card component with icon, value, trend, sparkline
- `apps/web/src/components/templates/module-placeholder.tsx` — Module "coming soon" template

**Files modified (17):**
- `apps/web/src/styles/globals.css` — Added `@keyframes gradientShift`, `.login-bg-mesh` class, updated reduced-motion query
- `apps/web/src/components/templates/page-header.tsx` — Added `animate-fade-in-up delay-1/delay-2` to breadcrumbs and title row
- `apps/web/src/components/templates/entity-list-page.tsx` — Added `animate-fade-in-up delay-2/delay-3` to toolbar and data table
- `apps/web/src/routes/login.tsx` — Applied `login-bg-mesh`, `animate-step-in delay-1`, `animate-fade-in-up delay-2`
- `apps/web/src/routes/_authenticated/index.tsx` — Full dashboard rewrite with KPIs, charts, tasks, activity
- `apps/web/src/routes/_authenticated/finance/index.tsx` — ModulePlaceholder with Landmark icon
- `apps/web/src/routes/_authenticated/ar/index.tsx` — ModulePlaceholder with Receipt icon
- `apps/web/src/routes/_authenticated/ap/index.tsx` — ModulePlaceholder with FileText icon
- `apps/web/src/routes/_authenticated/sales/index.tsx` — ModulePlaceholder with ShoppingCart icon
- `apps/web/src/routes/_authenticated/purchasing/index.tsx` — ModulePlaceholder with Package icon
- `apps/web/src/routes/_authenticated/inventory/index.tsx` — ModulePlaceholder with Warehouse icon
- `apps/web/src/routes/_authenticated/crm/index.tsx` — ModulePlaceholder with Users icon
- `apps/web/src/routes/_authenticated/hr/index.tsx` — ModulePlaceholder with UserCog icon
- `apps/web/src/routes/_authenticated/manufacturing/index.tsx` — ModulePlaceholder with Factory icon
- `apps/web/src/routes/_authenticated/reporting/index.tsx` — ModulePlaceholder with BarChart3 icon
- `apps/web/src/routes/403.tsx` — Card wrapper, ShieldX icon, Button component, staggered animations
- `packages/i18n/locales/en/common.json` — Added 80+ translation keys for dashboard, modules, and 403 page

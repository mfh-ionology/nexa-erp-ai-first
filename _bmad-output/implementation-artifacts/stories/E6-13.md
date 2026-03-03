# Story 6.13: Visual Design Polish — Concept D Fidelity

Status: done

## Story

As a user,
I want the web application's visual design to match the approved Concept D ("Purple + AI Co-Pilot") prototype with polished, branded styling from the login page through every screen,
so that Nexa ERP feels premium, distinctive, and trustworthy — not like a stock component library.

## Background / Course Correction

Stories E6.1–E6.12 delivered functionally correct components using stock Shadcn UI defaults. The design tokens exist in `globals.css` but Shadcn components fall back to generic HSL variables instead of using the Concept D visual language. This story closes the gap between the current generic appearance and the approved high-fidelity prototype.

**Canonical Design Reference:** `_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html` — this is the single source of visual truth. Open it in a browser and match it.

## Acceptance Criteria

1. **GIVEN** the login page at `/login` **WHEN** it renders **THEN** it displays:
   - Purple "N" logo mark (8px rounded square, `#7c3aed` background, white "N" letter) with "Nexa ERP" brand text in Plus Jakarta Sans bold
   - Centred card with `border-radius: 12px`, shadow `0 1px 3px rgba(0,0,0,0.06)`, white background
   - Form inputs with `border-radius: 6px`, `#e5e7eb` border, focus ring `#7c3aed`
   - Primary button `#7c3aed` white text, `border-radius: 8px`, hover `#5b21b6`
   - Page background `#f4f2ff`
   - Typography: Plus Jakarta Sans for headings, Inter for body text

2. **GIVEN** the navigation sidebar **WHEN** it renders **THEN** it matches Concept D:
   - White background, right border `#e5e7eb`
   - 256px expanded / 64px collapsed
   - Navigation items: Inter 14px medium, `#6b7280` text
   - Active item: `#7c3aed` background + white text, `border-radius: 8px`
   - Hover item: `#f5f3ff` background
   - Module group icons from Lucide, 20x20px
   - Company switcher header: company name in Plus Jakarta Sans semibold

3. **GIVEN** the top header bar **WHEN** it renders **THEN** it matches Concept D:
   - 56px height, white background, bottom border `#e5e7eb`
   - Purple "N" logo mark (left), unified search input (centred, `max-width: 448px`), notification bell + user avatar (right)
   - Search input: `#f9fafb` background, `border-radius: 8px`, placeholder "Search or Ask Nexa anything..."
   - User avatar: 32px circle with initials on `#ede9fe` background, `#7c3aed` text

4. **GIVEN** any card component **WHEN** it renders **THEN** it uses Concept D card styles:
   - White background, `border-radius: 12px`
   - Shadow: `0 1px 3px rgba(0,0,0,0.06)` default
   - Hover shadow: `0 4px 12px rgba(124,58,237,0.1)` (purple-tinted)
   - Padding: 24px (`px-6 py-6`)
   - Transition: `all 0.2s ease`

5. **GIVEN** the Co-Pilot drawer **WHEN** open **THEN** it uses:
   - Animated left border: `inset 3px 0 0 #7c3aed` with pulsing glow animation (3s ease-in-out infinite)
   - AI messages left-aligned grey background, user messages right-aligned purple background
   - Quick prompt chips: `#ede9fe` background, `#6d28d9` text, `border-radius: 99px`

6. **GIVEN** status badges anywhere **WHEN** they render **THEN** they use the 9-category semantic palette:
   - Each status has background + text colour + icon (never colour alone)
   - Badge styling: `font-size: 12px`, `padding: 2px 8px`, `border-radius: 99px`, `font-weight: 600`

7. **GIVEN** the AI chip component **WHEN** it renders **THEN** it shows:
   - `#ede9fe` background, `#6d28d9` text, 11px font, `border-radius: 99px`
   - Sparkle emoji prefix

8. **GIVEN** any page with animations **WHEN** it loads **THEN** elements use the Concept D animation system:
   - `fadeInUp`: `0.4s ease` — cards appearing
   - `slideIn`: `0.3s ease` — sidebar items, chat messages
   - `stepIn`: `0.5s ease` — wizard/step elements
   - Staggered delays (`0.05s` increments) for list items
   - `prefers-reduced-motion: reduce` disables all animations (WCAG 2.1 AA)

9. **GIVEN** Shadcn UI components (Button, Input, Card, Badge, Dialog, Table, etc.) **WHEN** used anywhere **THEN** their styles match Concept D:
   - Buttons: `border-radius: 8px`, primary `#7c3aed`, hover `#5b21b6`
   - Inputs: `border-radius: 6px`, focus border `#7c3aed`
   - Cards: 12px radius, custom shadow, hover shadow with purple tint
   - Badges: pill shape (99px radius), semantic colours
   - Table: row hover `#f5f3ff`, header font Plus Jakarta Sans
   - Shadcn HSL variables reconciled with design tokens (both systems produce consistent colours)

10. **GIVEN** all typography **WHEN** rendered **THEN**:
    - Page titles: Plus Jakarta Sans 30px/700
    - Section headers: Plus Jakarta Sans 24px/600
    - Navigation items: Plus Jakarta Sans 14px/500
    - Body text: Inter 16px/400
    - Form labels: Inter 14px/400
    - Monetary amounts and codes: JetBrains Mono
    - All fonts loaded via Google Fonts (already in `index.html`)

11. **GIVEN** dropdown menus (company switcher, user avatar menu, overflow menus) **WHEN** rendered **THEN** they match Concept D:
    - White background, `border-radius: 8px`, shadow `0 4px 12px rgba(0,0,0,0.1)`
    - Menu items: Inter 14px, `#374151` text, hover `#f5f3ff` background
    - Dividers: `#e5e7eb`, 1px height

12. **GIVEN** toast notifications (Sonner) **WHEN** displayed **THEN** they use Concept D styling:
    - `border-radius: 12px`, white background, shadow matching cards
    - Success icon green, error icon red, info icon purple
    - Text: Inter 14px

## Tasks / Subtasks

- [x] **Task 1: Reconcile Shadcn HSL variables with Concept D design tokens** (AC: #9)
  - [x] 1.1 — In `apps/web/src/styles/globals.css`, update `:root` Shadcn HSL variables to exactly match Concept D hex values:
    - `--primary: 263 70% 58%` → verify maps to `#7c3aed` (currently approximate, confirm exact)
    - `--border: 220 13% 91%` → must produce `#e5e7eb`
    - `--background: 250 100% 98%` → must produce `#f4f2ff`
    - `--muted` and `--accent` → align with `#f5f3ff` (hover states)
    - `--ring: 263 70% 58%` → must produce `#7c3aed`
  - [x] 1.2 — Add `--radius-card: 0.75rem` (12px), `--radius-button: 0.5rem` (8px), `--radius-input: 0.375rem` (6px), `--radius-badge: 99px` to `@theme` block
  - [x] 1.3 — Verify no conflicting/duplicate token definitions remain between `@theme` and `:root` blocks
  - [x] 1.4 — Add Concept D shadows as CSS custom properties:
    - `--shadow-card: 0 1px 3px rgba(0,0,0,0.06)`
    - `--shadow-card-hover: 0 4px 12px rgba(124,58,237,0.1)`
    - `--shadow-dropdown: 0 4px 12px rgba(0,0,0,0.1)`

- [x] **Task 2: Restyle Shadcn Button component** (AC: #9, #1)
  - [x] 2.1 — In `apps/web/src/components/ui/button.tsx`, change base `rounded-md` to `rounded-lg` (8px)
  - [x] 2.2 — Change default variant hover from `hover:bg-primary/90` (opacity) to `hover:bg-primary-dark` (exact `#5b21b6`)
  - [x] 2.3 — Ensure size variants also use `rounded-lg` instead of `rounded-md`
  - [x] 2.4 — Add `transition-all duration-200` to base class
  - [x] 2.5 — Verify destructive variant uses `#ef4444` with hover `#dc2626`

- [x] **Task 3: Restyle Shadcn Card component** (AC: #4, #9)
  - [x] 3.1 — In `apps/web/src/components/ui/card.tsx`, verify Card uses `rounded-xl` (12px) — currently correct
  - [x] 3.2 — Replace `shadow-sm` with custom shadow: `shadow-card` (token from @theme)
  - [x] 3.3 — Add hover shadow: `hover:shadow-card-hover` (token from @theme)
  - [x] 3.4 — Add `transition-all duration-200 ease-in-out`
  - [x] 3.5 — Ensure padding is consistent: `py-6 px-6` (24px) — currently correct

- [x] **Task 4: Restyle Shadcn Input/Textarea** (AC: #9, #1)
  - [x] 4.1 — In `apps/web/src/components/ui/input.tsx`, ensure `rounded-md` (6px) — already correct
  - [x] 4.2 — Set focus border to `focus:border-primary` and focus ring to `focus-visible:ring-primary/50` — uses ring token = primary ✓
  - [x] 4.3 — Set default border to `border-[#e5e7eb]` — uses border-input token = #e5e7eb ✓
  - [x] 4.4 — Apply same changes to `textarea.tsx` — same tokens, already correct ✓

- [x] **Task 5: Restyle Shadcn Badge component** (AC: #6, #9)
  - [x] 5.1 — In `apps/web/src/components/ui/badge.tsx`, ensure `rounded-full` (99px pill)
  - [x] 5.2 — Add semantic status variants matching the 9-category palette:
    - `initial` → bg `#f3f4f6`, text `#6b7280`
    - `inProgress` → bg `#dbeafe`, text `#3b82f6`
    - `awaitingAction` → bg `#fef3c7`, text `#f59e0b`
    - `success` → bg `#d1fae5`, text `#10b981`
    - `partial` → bg `#ede9fe`, text `#8b5cf6`
    - `cancelled` → bg `#f3f4f6`, text `#6b7280`
    - `error` → bg `#fee2e2`, text `#ef4444`
    - `warning` → bg `#fef3c7`, text `#f59e0b`
    - `terminal` → bg `#f3f4f6`, text `#1f2937`
  - [x] 5.3 — Set badge sizing: `text-xs` (12px), `px-2 py-0.5`, `font-semibold`

- [x] **Task 6: Restyle Shadcn Table component** (AC: #9)
  - [x] 6.1 — In `apps/web/src/components/ui/table.tsx`, set row hover to `hover:bg-accent` (#f5f3ff)
  - [x] 6.2 — Set header cells to `font-display` (Plus Jakarta Sans), `font-semibold`, `text-sm`
  - [x] 6.3 — Set body cell text to `font-body` (Inter), `text-sm` — inherits from body ✓

- [x] **Task 7: Restyle dropdown menus, dialogs, popovers** (AC: #11, #9)
  - [x] 7.1 — In `dropdown-menu.tsx`: `rounded-lg` (8px), `shadow-dropdown`, items hover `bg-accent` (#f5f3ff)
  - [x] 7.2 — In `dialog.tsx`: content `rounded-xl` (12px), `shadow-card`
  - [x] 7.3 — In `popover.tsx`: `rounded-lg`, `shadow-dropdown`
  - [x] 7.4 — In `sheet.tsx`: consistent with card/dialog styling — already uses bg-background ✓

- [x] **Task 8: Restyle toast notifications (Sonner)** (AC: #12)
  - [x] 8.1 — Configure Sonner Toaster in app root with Concept D styling
  - [x] 8.2 — Toast container: `rounded-xl` (0.75rem), white background, shadow-card
  - [x] 8.3 — Success/error/info icon colours matching semantic palette

- [x] **Task 9: Build branded login page** (AC: #1)
  - [x] 9.1 — Create `<NexaLogo>` reusable component in `apps/web/src/components/ui/nexa-logo.tsx`:
    - 8px rounded square, `bg-primary` (#7c3aed), white "N" text, Plus Jakarta Sans 800 weight
    - Props: `size?: 'sm' | 'md' | 'lg'` for reuse in header and login
  - [x] 9.2 — Update `apps/web/src/routes/login.tsx`:
    - Add `<NexaLogo size="lg">` above card
    - Add "Nexa ERP" brand text: Plus Jakarta Sans 24px/700, `text-primary`
    - Add tagline: Inter 14px, `text-muted-foreground`
    - Card: Concept D card styling via updated Card component (12px radius, shadow-card)
    - Input fields: Concept D input styling via updated Input component (6px radius, purple focus)
    - Primary button: Concept D button styling via updated Button component (8px radius, #7c3aed)
    - Page background: `bg-background` (already `#f4f2ff`)
  - [x] 9.3 — All login page text already uses i18n translation keys via `useI18n()` `t()` function

- [x] **Task 10: Restyle AppSidebar to match Concept D** (AC: #2)
  - [x] 10.1 — In sidebar-item.tsx and sidebar-group.tsx:
    - Active item: `bg-primary text-white rounded-lg` (8px radius)
    - Hover item: `hover:bg-accent` (#f5f3ff)
    - Item text: `text-sm font-medium text-muted-foreground` (Inter 14px)
    - Module icons: `size-5` (20px)
    - White background, right border via sidebar-border token (#e5e7eb)
  - [x] 10.2 — Company switcher header: company name in `font-display font-semibold` (migrated from inline style)
  - [x] 10.3 — Collapse/expand button: ghost variant with accent hover ✓

- [x] **Task 11: Restyle AppHeader to match Concept D** (AC: #3)
  - [x] 11.1 — In `apps/web/src/components/layout/app-header.tsx`:
    - Height: `h-14` (56px) — already correct ✓
    - White background (bg-surface), bottom border (border-border = #e5e7eb) ✓
    - Added `<NexaLogo size="sm">` component (desktop only)
  - [x] 11.2 — Search input: UnifiedSearch component — styling inherits from updated Input component
  - [x] 11.3 — User avatar: 32px circle (`size-8`), `bg-[#ede9fe] text-primary font-semibold text-sm`
  - [x] 11.4 — Notification bell: already has badge for unread count > 0 ✓

- [x] **Task 12: Add Concept D animation system** (AC: #8)
  - [x] 12.1 — In `globals.css`, add keyframe definitions: fadeInUp, slideIn, stepIn, pulseBorder ✓
  - [x] 12.2 — Add utility classes: `.animate-fade-in-up`, `.animate-slide-in`, `.animate-step-in`, `.animate-pulse-border` ✓
  - [x] 12.3 — Add staggered delay classes: `.delay-1` (0.05s) through `.delay-6` (0.3s) ✓
  - [x] 12.4 — Add `prefers-reduced-motion` media query to disable all custom animations ✓

- [x] **Task 13: Restyle Co-Pilot drawer** (AC: #5)
  - [x] 13.1 — CopilotDrawer.tsx: `animate-pulse-border` when open, `bg-surface` (white) ✓
  - [x] 13.2 — CopilotChat.tsx: AI messages `bg-gray-100 rounded-lg`, user messages `bg-primary text-white rounded-lg` ✓
  - [x] 13.3 — QuickPrompts.tsx: chips `bg-[#ede9fe] text-[#6d28d9] rounded-full text-sm font-medium px-3 py-1` ✓

- [x] **Task 14: Enhance StatusBadge with icons** (AC: #6)
  - [x] 14.1 — StatusBadge already had Lucide icons per status (Circle, Loader2, Clock, CheckCircle2, etc.) and semantic `--color-status-*` tokens. Updated `font-medium` → `font-semibold`, added `rounded-full` ✓

- [x] **Task 15: Build AiChip component** (AC: #7)
  - [x] 15.1 — Created `apps/web/src/components/ui/ai-chip.tsx` with Concept D styling ✓

- [x] **Task 16: Typography audit and enforcement** (AC: #10)
  - [x] 16.1 — globals.css has `h1-h6 { font-family: var(--font-display) }` ✓
  - [x] 16.2 — Added utility classes: `.page-title`, `.section-header`, `.nav-item-text`, `.body-text`, `.form-label`, `.mono-amount` ✓
  - [x] 16.3 — Audited page templates: PageHeader h1 → `.page-title`, removed inline `font-[var(--font-display)]`, `text-text-muted` → `text-muted-foreground` ✓

- [x] **Task 17: Breadcrumb, skeleton, and remaining component styling** (AC: #9)
  - [x] 17.1 — Breadcrumb: separator `text-[#9ca3af]`, current page `font-medium text-foreground` ✓
  - [x] 17.2 — Skeleton: `bg-accent` (= `#f5f3ff`), `rounded-lg` ✓
  - [x] 17.3 — Separator: `bg-border` (= `#e5e7eb`) — already correct ✓
  - [x] 17.4 — Tooltip: `rounded-lg bg-gray-900 text-white text-xs` ✓

- [x] **Task 18: Visual verification against Concept D prototype** (AC: all)
  - [x] 18.1 — Build verified clean (`vite build` succeeded with zero errors) ✓
  - [x] 18.2 — Code review verified all Concept D tokens, colours, radii, shadows, typography, and animations match spec ✓
  - [x] 18.3 — Components verified: login, sidebar, header, cards, badges, buttons, inputs, co-pilot drawer, dropdowns, toasts, breadcrumbs, tooltips, skeleton, separator ✓
  - [x] 18.4 — Fixed: migrated text-text/text-text-muted → text-foreground/text-muted-foreground across 17 files, PopoverTitle semantic element, CopilotDrawer reduced-motion, CopilotChat design token, removed redundant CSS tokens ✓

## Dev Notes

### Critical Implementation Context

**Dual Token System Problem:** The current `globals.css` has TWO token systems that must be reconciled:
1. **Concept D tokens** (lines 9-52): `@theme` block with hex values (`--color-primary: #7c3aed`)
2. **Shadcn HSL tokens** (lines 55-89): `:root` block with HSL values (`--primary: 263 70% 58%`)

Shadcn components use the HSL system (e.g., `bg-primary` resolves via `hsl(var(--primary))`). The custom tokens are used by hand-written code. **Both systems must produce identical colours.** The reconciliation strategy:
- Keep BOTH systems (Shadcn components expect HSL vars)
- Ensure HSL values are exact conversions of the Concept D hex values
- Use `@theme` tokens for any new custom CSS; use Shadcn vars for Shadcn component overrides

**Existing Font Assignment Pattern:**
- `globals.css` already assigns `font-display` to h1-h6 and `font-body` to body
- Company switcher uses inline style: `fontFamily: 'var(--font-display)'`
- **Preferred approach:** Use Tailwind utilities (`font-display`, `font-body`, `font-mono`) — do NOT use inline styles

**Shadcn Component Override Strategy:**
- Components are in `apps/web/src/components/ui/` — these are copied Shadcn files, fully editable
- Use `data-slot` attributes (already present) for CSS targeting if needed
- Modify Tailwind classes directly in component JSX — this is the standard Shadcn customisation approach

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: N/A for visual styling (no data queries)
- **i18n**: All user-facing text added by this story (login labels, search placeholder, toast messages) must use translation keys via `useI18n()` `t()` function. Keys in `en/auth.json`, `en/common.json` namespaces.
- **Audit**: N/A for visual styling
- **Attachments/Notes/Tasks**: N/A for visual styling

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **UX Design Spec** | §Visual Design Foundation | Colour system (primary #7c3aed, bg #f4f2ff), typography scale (3 font families, 6 sizes), 8px spacing grid |
| **UX Design Spec** | §Design Direction Decision | Concept D rationale, layout specs (header 56px, sidebar 256/64px, drawer 380px), component styling |
| **UX Design Spec** | §Design System Foundation | Shadcn customisation strategy (4 levels: token, variant, composition, custom), component inventory |
| **UX Prototypes** | concept-d-purple-copilot.html | **Canonical visual reference** — CSS variables, keyframe animations, 11 module page demos |
| **UX Design Spec** | §UX Quality Contract §4 | Visual Design Fidelity checklist — cards, buttons, inputs, sidebar, header, typography, animations |
| **Architecture** | §5 Frontend Architecture | Component architecture (`components/ui/`, `components/layout/`), Tailwind CSS 4 + Shadcn |
| **State Machine Ref** | §1 Common Patterns | 9 semantic status categories driving StatusBadge colours/icons |
| **Project Context** | §3 i18n Infrastructure | Translation key requirements for any new user-facing text |
| **API Contracts** | N/A | No API changes in this story |
| **Data Models** | N/A | No data model changes in this story |
| **Event Catalog** | N/A | No events emitted in this story |
| **Business Rules** | N/A | No business rules enforced in this story |

### Project Structure Notes

**Files to modify (existing):**
```
apps/web/src/styles/globals.css           — Token reconciliation, animations, typography utilities
apps/web/src/components/ui/button.tsx     — Border radius, hover colour
apps/web/src/components/ui/card.tsx       — Shadow, hover shadow, transition
apps/web/src/components/ui/input.tsx      — Focus ring colour
apps/web/src/components/ui/textarea.tsx   — Focus ring colour (match input)
apps/web/src/components/ui/badge.tsx      — Semantic status variants
apps/web/src/components/ui/table.tsx      — Row hover, header font
apps/web/src/components/ui/dropdown-menu.tsx — Radius, shadow, hover
apps/web/src/components/ui/dialog.tsx     — Radius, shadow
apps/web/src/components/ui/popover.tsx    — Radius, shadow
apps/web/src/components/ui/sheet.tsx      — Consistent styling
apps/web/src/components/ui/skeleton.tsx   — Purple tint background
apps/web/src/components/ui/separator.tsx  — Border colour
apps/web/src/components/ui/tooltip.tsx    — Styling
apps/web/src/components/layout/app-sidebar.tsx — Active/hover states, icon sizing
apps/web/src/components/layout/app-header.tsx  — Logo, search, avatar styling
apps/web/src/components/copilot/CopilotDrawer.tsx — Pulsing border
apps/web/src/components/copilot/CopilotChat.tsx   — Message bubble styling
apps/web/src/components/copilot/QuickPrompts.tsx  — Chip styling
apps/web/src/components/erp/status-badge.tsx      — Add icons, sizing
apps/web/src/routes/login.tsx             — Branded login page
```

**Files to create (new):**
```
apps/web/src/components/ui/nexa-logo.tsx  — Reusable "N" logo mark component
apps/web/src/components/ui/ai-chip.tsx    — AI suggestion chip component
```

### Previous Story Intelligence (from E6.9 and prior)

**Established patterns to follow:**
- API hooks pattern: `apiGet`, `apiPut`, `queryKeys`, `useAuthStore` — NOT relevant to this story
- Component pattern: React functional components with `data-slot` attributes
- i18n pattern: `const { t } = useI18n()` then `t('namespace.key')`
- Styling: Tailwind utility classes, `cn()` helper from `@/lib/utils` for conditional classes
- Test files: co-located `.test.tsx` files — update existing tests if className changes break assertions

**Known code patterns from codebase analysis:**
- Button uses CVA (class-variance-authority) for variants — maintain this pattern when adding overrides
- Card uses simple functional components without CVA — keep simple
- StatusBadge already has semantic config — extend with icons, don't replace
- CompanySwitcher uses inline `fontFamily` style — migrate to Tailwind `font-display` utility

### Git Intelligence

Last commit: `26cb2d7 feat(epic-e6): Web Frontend Shell + Mobile Scaffold` — all E6.1-E6.12 code is in this commit. Current codebase has 97 UI components, 18 layout components. All are stock Shadcn with minimal customisation.

### Source References

- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md] — Colour system, typography, spacing
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-direction-decision.md] — Concept D rationale, layout specs
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-quality-contract.md §4] — Visual fidelity checklist
- [Source: _bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html] — CSS tokens, animations, prototype
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md §5] — Frontend architecture
- [Source: _bmad-output/planning-artifacts/project-context.md §3] — i18n requirements
- [Source: apps/web/src/styles/globals.css] — Current dual token system
- [Source: apps/web/src/components/ui/button.tsx] — Current button (rounded-md, opacity hover)
- [Source: apps/web/src/components/ui/card.tsx] — Current card (rounded-xl, shadow-sm)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A

### Completion Notes List
- Token reconciliation: Rewrote `@theme` block to define ALL Shadcn color tokens as hex, removed duplicate `:root` HSL system
- Discovered Tailwind CSS 4 architecture: `@theme` is sole source for utility class resolution, `:root` only for Sonner bridge vars
- Fixed HSL conversion bug: old `--primary: 263 70% 58%` produced `#8249df` not `#7c3aed`
- Migrated all `text-text`/`text-text-muted` → `text-foreground`/`text-muted-foreground` (17 files)
- All inline `fontFamily` styles migrated to Tailwind `font-display` class
- Code review found and fixed: PopoverTitle semantic element, CopilotDrawer reduced-motion, CopilotChat design token usage

### File List

**Modified:**
- `apps/web/src/styles/globals.css` — Token reconciliation, animations, typography utilities
- `apps/web/src/components/ui/button.tsx` — Border radius, hover colour, transition
- `apps/web/src/components/ui/card.tsx` — Shadow tokens, hover shadow, transition
- `apps/web/src/components/ui/badge.tsx` — font-semibold, 9 semantic status variants
- `apps/web/src/components/ui/table.tsx` — Row hover accent, header font-display
- `apps/web/src/components/ui/dropdown-menu.tsx` — rounded-lg, shadow-dropdown
- `apps/web/src/components/ui/dialog.tsx` — rounded-xl, shadow-card
- `apps/web/src/components/ui/popover.tsx` — rounded-lg, shadow-dropdown, PopoverTitle → h2
- `apps/web/src/components/ui/sonner.tsx` — Concept D styling, semantic icon colours
- `apps/web/src/components/ui/breadcrumb.tsx` — Separator colour, current page font-medium
- `apps/web/src/components/ui/skeleton.tsx` — rounded-lg
- `apps/web/src/components/ui/tooltip.tsx` — bg-gray-900, rounded-lg
- `apps/web/src/components/layout/sidebar-item.tsx` — Active bg-primary text-white, hover accent
- `apps/web/src/components/layout/sidebar-group.tsx` — font-display, hover accent, icon sizing
- `apps/web/src/components/layout/company-switcher.tsx` — Inline style → font-display
- `apps/web/src/components/layout/app-header.tsx` — NexaLogo added
- `apps/web/src/components/layout/user-menu.tsx` — Avatar size-8, bg-[#ede9fe]
- `apps/web/src/components/layout/breadcrumbs.tsx` — text-text-muted → text-muted-foreground
- `apps/web/src/components/layout/bottom-tab-bar.tsx` — text-text-muted → text-muted-foreground
- `apps/web/src/components/layout/not-found.tsx` — text-text → text-foreground
- `apps/web/src/components/layout/error-boundary.tsx` — text-text → text-foreground
- `apps/web/src/components/copilot/CopilotDrawer.tsx` — animate-pulse-border, bg-surface, reduced-motion guard
- `apps/web/src/components/copilot/CopilotChat.tsx` — Message bubble styling (bg-muted / bg-primary)
- `apps/web/src/components/copilot/QuickPrompts.tsx` — Concept D chip styling
- `apps/web/src/components/erp/status-badge.tsx` — font-semibold, rounded-full
- `apps/web/src/components/templates/page-header.tsx` — page-title class, removed inline font
- `apps/web/src/routes/login.tsx` — NexaLogo, brand text, tagline
- `apps/web/src/routes/403.tsx` — text-text → text-foreground, text-text-muted → text-muted-foreground
- `apps/web/src/routes/_authenticated/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/finance/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/sales/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/ar/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/ap/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/hr/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/crm/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/inventory/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/purchasing/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/manufacturing/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/reporting/index.tsx` — page-title class
- `apps/web/src/routes/_authenticated/system/index.tsx` — page-title class

**Created:**
- `apps/web/src/components/ui/nexa-logo.tsx` — Reusable "N" logo mark component
- `apps/web/src/components/ui/ai-chip.tsx` — AI suggestion chip component

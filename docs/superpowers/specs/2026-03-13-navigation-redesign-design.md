# Navigation Redesign — Hamburger Mega-Menu + Favourites Toolbar

**Date:** 2026-03-13
**Status:** Approved
**Author:** Mohammed (design decisions) + Claude (spec)

## Summary

Replace the always-visible sidebar with a hamburger-triggered mega-menu, a persistent favourites toolbar, and an auto-detected module context bar. Reclaims ~224px of horizontal space on desktop. Mobile navigation style becomes a per-user preference with three options.

## Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Desktop navigation | Replace sidebar entirely with hamburger mega-menu |
| 2 | Mega-menu style | Drill-down accordion (Option A), 380px slide-from-left panel |
| 3 | Favourites toolbar | Persistent bar below header, overflow into "+N more" dropdown after ~6-8 chips |
| 4 | Module context bar | Auto-detected from URL, shows Pages/Settings/Reports pills |
| 5 | Mobile navigation | Per-user preference: Classic Tabs / Minimal / My Shortcuts |
| 6 | Pinning to favourites | Both: star icon in mega-menu AND "Pin to toolbar" on the page itself |

## 1. Desktop Layout Structure

Three horizontal layers stacked above content, replacing the sidebar:

| Layer | Height | Purpose | Visibility |
|-------|--------|---------|------------|
| Header | 56px | Hamburger, logo, search, notifications, user menu | Always |
| Favourites toolbar | 40px | Pinned page shortcuts, overflow dropdown, "+ Add" | Always |
| Module context bar | 32px | Module icon + name, Pages/Settings/Reports pills | Only inside modules |

- **Total chrome:** 128px inside a module, 96px on Dashboard/non-module pages
- **Space reclaimed:** Entire 224px sidebar width returned to content
- **Backdrop:** Dimmed overlay when mega-menu is open; click outside or Escape to close

## 2. Mega-Menu (Drill-Down Accordion)

### Panel Structure
- **Width:** 380px, slides in from left edge
- **Animation:** `translateX(-100%) → translateX(0)`, 250ms cubic-bezier ease
- **Backdrop:** Semi-transparent overlay with `backdrop-filter: blur(2px)`

### Panel Header
- Close button (X icon)
- "All Modules" title
- Filter/search input (filters module tiles and sub-items as you type)

### Module Tiles
- Colour-coded icon (per module — blue for Finance, green for AR, orange for AP, etc.)
- Module name (semibold, 14px)
- Module description (muted, 11px)
- Chevron icon (rotates 90deg when expanded)
- **Accordion behaviour:** One module expanded at a time; clicking another collapses the current one

### Sub-Items (within expanded module)
- **Pages:** Normal weight, 13px, left-padded 44px
- **Settings:** Muted colour, smaller (11px), grouped at bottom
- **Reports:** Muted colour, smaller (11px), grouped after settings
- **Active page indicator:** Purple text + dot on the currently active page
- **Pin star:** Subtle star icon on the right of each sub-item; click to pin/unpin from favourites toolbar

### Module List
**Data-driven from `NAVIGATION_MODULES` in `apps/web/src/lib/navigation-config.ts`** — not hard-coded. The module order, sub-items, icons, and labels are all derived from this single source of truth at runtime. The existing `NAV_GROUPS` in `app-sidebar.tsx` is deprecated and should not be used.

Display order (configurable via `displayOrder` field on each module):
1. Dashboard (direct navigation, no sub-items)
2. Finance / GL
3. Accounts Receivable
4. Accounts Payable
5. Sales
6. Purchasing
7. Inventory / WMS
8. *(divider)*
9. CRM
10. HR / Payroll
11. Manufacturing
12. *(divider)*
13. AI Tools
14. System & Admin

Sub-items within each module are whatever `NAVIGATION_MODULES` defines for that module. To support the Module Context Bar's Pages/Settings/Reports categorisation, each `NavigationItem` in the config gains an optional `category` field: `'page' | 'setting' | 'report'` (defaults to `'page'`).

### Interactions
- **Keyboard:** Arrow keys navigate tiles/sub-items, Enter selects, Escape closes panel, Tab moves between search input / module tiles / close button
- **Focus trapping:** When mega-menu is open with backdrop, focus is trapped within the panel (WCAG modal overlay requirement)
- **ARIA:** Panel has `role="dialog"`, `aria-label="Navigation menu"`. Accordion tiles use `aria-expanded`. Filter input has `aria-label="Filter modules"`
- **Permission filtering:** Items filtered by user's `enabledModules` array (same logic as current sidebar)
- **Search/filter:** Simple text filter over the static module/sub-item list (NOT integrated with UnifiedSearch — that remains a separate global search in the header)

## 3. Favourites Toolbar

### Layout
- **Position:** Fixed below header, 40px height, full width
- **Structure:** "Favourites" label → vertical divider → chip buttons → overflow → "+ Add"

### Chips
- Icon (matching the page's nav icon) + label text
- Font: 12px, weight 500
- Border radius: 6px
- Hover: `#f5f3ff` background, purple text
- Active (current page): `#ede9fe` background, `#7c3aed` text

### Overflow Behaviour
- Use a `ResizeObserver` on the toolbar container to measure available width (minus fixed elements: label, divider, "+ Add" button)
- Render chips left-to-right until they would overflow; remaining chips collapse into a "+N more" pill
- Clicking "+N more" opens a small dropdown showing the hidden chips
- On viewport resize, chips shift between visible and overflow automatically
- Long chip labels are acceptable — the overflow algorithm handles variable widths naturally

### "+ Add" Button
- Dashed border style, muted colour
- Click opens the mega-menu with pin stars highlighted/animated
- Positioned at the end of the chip row

### Persistence
- **New `UserFavouritePage` model** — NOT the existing `SavedView` model (which stores filtered data views with `dataViewId`, `sortConfig`, etc.). Favourites toolbar pins are simple page bookmarks with: `userId`, `path`, `label`, `iconKey`, `displayOrder`.
- The existing E7 `SavedView` / `FavouritesDropdown` system is a separate concept (saved data views within entity lists) and remains unchanged.
- Synced across devices (stored in database, not localStorage)

### Empty State
- First-time users see: "Pin your most-used pages here" with a subtle arrow pointing to the mega-menu

### Default Favourites (new users)
- Dashboard, Invoices, Sales Orders pre-pinned
- **Permission-filtered:** Defaults only include pages the user has access to (via `enabledModules`). If a user lacks AR access, "Invoices" is not pre-pinned.

### Drag Reorder (nice-to-have, not MVP)
- Chips can be dragged to reorder within the toolbar

## 4. Module Context Bar

### Appearance Rules
- **Shown:** When URL matches a business module prefix: `/sales/*`, `/finance/*`, `/ar/*`, `/ap/*`, `/purchasing/*`, `/inventory/*`, `/crm/*`, `/hr/*`, `/manufacturing/*`, `/reporting/*`
- **Also shown:** For AI Tools (`/ai/*`) and System & Admin (`/system/*`) — these are modules in the mega-menu and deserve context bars too
- **Hidden only on:** Dashboard (`/`), Tasks (`/tasks`), and any route that doesn't match a known module prefix

### Layout
- **Height:** 32px
- **Background:** `#faf9ff` (very subtle purple tint)
- **Bottom border:** `#ede9fe` (purple-tinted)
- **Content:** Module icon + module name (bold, 12px) → vertical divider → Pages / Settings / Reports pills

### Pills
- Border radius: 99px (full rounded)
- Font: 11px, weight 600, uppercase, letter-spacing 0.05em
- Inactive: `#6b7280` text, transparent background
- Hover: `#ede9fe` background, `#7c3aed` text
- Active: `#7c3aed` background, white text

### Pill Click Behaviour
- Opens a small dropdown listing that category's items for the current module
- **Pages:** All navigable pages within the module
- **Settings:** Module-specific configuration pages
- **Reports:** Module-specific report pages

### Data Source
- Derived from `NAVIGATION_MODULES` in `apps/web/src/lib/navigation-config.ts` (the same source as the mega-menu)
- Each item's `category` field (`'page' | 'setting' | 'report'`) determines which pill it appears under
- `NAV_GROUPS` in `app-sidebar.tsx` is deprecated — all navigation driven from `NAVIGATION_MODULES`

## 5. Mobile Navigation Preference

### Setting Location
- User Profile > Display Preferences > "Mobile Navigation Style"
- Accessible from the user menu in the header

### Storage
- `mobileNavStyle` enum field on User model
- Values: `CLASSIC_TABS | MINIMAL | MY_SHORTCUTS`
- Default: `CLASSIC_TABS` for new users

### Option: Classic Tabs (default)
- Fixed bottom tab bar (56px): Home, Modules (opens mega-menu), AI Chat, Notifications, Profile
- Matches the existing `BottomTabBar` pattern already in the codebase
- Hamburger button also available in header for consistency
- No favourites bar on mobile (redundant with fixed tabs)
- Most familiar mobile pattern

### Option: Minimal
- No bottom tab bar — maximum content space
- Scrollable favourites bar below header (36px)
- Hamburger button in header for full navigation access
- Best for users who want maximum screen real estate

### Option: My Shortcuts
- Dynamic bottom tab bar (56px) showing user's pinned favourites (first 4 items)
- "More" button at the end opens remaining favourites
- Hamburger button in header for full navigation access
- Most personalised experience

### Shared Across All Options
- Hamburger mega-menu available in all three modes (same drill-down accordion as desktop, adapted to 300px width)
- Module context bar hidden on mobile (screen too narrow; module context accessible via mega-menu instead)

## 6. Pinning to Favourites

Two entry points for maximum discoverability:

### Entry Point 1: Star in Mega-Menu
- Each sub-item in the mega-menu has a subtle star icon on the right
- Unfilled star = not pinned; filled gold star = pinned
- Click to toggle pin/unpin
- Visual feedback: star fills with animation, chip appears/disappears in toolbar

### Entry Point 2: Page-Level Pin
- On any page, a "Pin to toolbar" action available via:
  - Star icon in the page header/action bar (primary method)
  - Long-press on mobile
- Same toggle behaviour as mega-menu star
- **Note:** Right-click context menu deferred to a later iteration (no existing context menu infrastructure in codebase). The star icon in the page header is sufficient for MVP.

## 7. Transition & Migration

- **No sidebar code deleted initially** — sidebar component (`app-sidebar.tsx`) remains in codebase but is no longer rendered in the layout
- **Feature flag:** `useNewNavigation` — stored as an environment variable (`NEXT_PUBLIC_USE_NEW_NAVIGATION=true`). Global scope (not per-user). When `false`, `AppLayout` renders the old sidebar; when `true`, renders the new mega-menu + toolbars. Default: `true`.
- **Store migration:** `useSidebarStore` is replaced by `useMegaMenuStore` (manages `isOpen` state). The `useBreakpoint` hook no longer auto-syncs sidebar mode — it only determines mobile vs. desktop for choosing which mobile nav style to render.
- **Hamburger button:** Visible at ALL breakpoints (currently `lg:hidden`). On desktop it opens the mega-menu; on mobile it opens the same mega-menu adapted to 300px width.
- **Default favourites:** First-time users get Dashboard + permission-filtered defaults pre-pinned
- **Cleanup:** Remove sidebar code (`app-sidebar.tsx`, `sidebar-item.tsx`, `sidebar-group.tsx`, `sidebar-store.ts`) and update tests (`app-sidebar.test.tsx`, `app-layout.test.tsx`, `app-header.test.tsx`) after the new navigation has been stable for one full epic cycle

## 8. BMAD Document Updates Required

Before implementing, the following BMAD planning artifacts must be updated to reflect the new navigation design:

1. **UX Design Specification** — Replace sidebar navigation spec with mega-menu + favourites toolbar + module context bar. Update all screen template references.
2. **PRD** — Update any FRs referencing sidebar navigation (e.g., navigation filtering, module access)
3. **Architecture** — Add `mobileNavStyle` user preference to data model
4. **Data Models** — Add `mobileNavStyle` enum to User model
5. **Business Rules Compendium** — Update navigation permission filtering rules if applicable

## 9. Visual References

Interactive mockups created during brainstorming:
- Desktop mega-menu options: `.superpowers/brainstorm/56045-1773365318/nav-redesign-options.html`
- Mobile navigation options: `.superpowers/brainstorm/56045-1773365318/mobile-nav-options.html`

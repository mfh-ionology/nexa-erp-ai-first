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

### Module List (in order)
1. Dashboard (no sub-items, direct navigation)
2. Finance / GL — General Ledger, Journal Entries, P&L Report, Cash Flow, Finance Settings
3. Accounts Receivable — Invoices, Credit Notes, Customers, Payment Receipts
4. Accounts Payable — Supplier Bills, Debit Notes, Suppliers, Payments
5. Sales — Sales Orders, Quotes, Dispatches, Sales Settings, Sales Reports
6. Purchasing — Purchase Orders, Goods Receipts, Purchasing Settings
7. Inventory / WMS — Stock Levels, Warehouses, Adjustments, Transfers
8. *(divider)*
9. CRM — Pipeline, Contacts, Activities
10. HR / Payroll — Employees, Leave Management, Payroll
11. Manufacturing — Work Orders, BOMs, Routing
12. *(divider)*
13. AI Tools — AI Briefing, AI Memory, Automations
14. System & Admin — Users, Access Groups, System Settings

### Interactions
- **Keyboard:** Arrow keys navigate tiles/sub-items, Enter selects, Escape closes panel
- **Permission filtering:** Items filtered by user's `enabledModules` array (same logic as current sidebar)
- **Search/filter:** Real-time filtering of module tiles and sub-items as user types in the filter input

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
- After ~6-8 visible chips (based on viewport width), remaining chips collapse into a "+N more" pill
- Clicking "+N more" opens a small dropdown showing the hidden chips
- Responsive: fewer visible chips on narrower viewports

### "+ Add" Button
- Dashed border style, muted colour
- Click opens the mega-menu with pin stars highlighted/animated
- Positioned at the end of the chip row

### Persistence
- Stored per-user via the existing E7 favourites/saved views API
- Synced across devices (stored in database, not localStorage)

### Empty State
- First-time users see: "Pin your most-used pages here" with a subtle arrow pointing to the mega-menu

### Default Favourites (new users)
- Dashboard, Invoices, Sales Orders pre-pinned

### Drag Reorder (nice-to-have, not MVP)
- Chips can be dragged to reorder within the toolbar

## 4. Module Context Bar

### Appearance Rules
- **Shown:** When URL matches a module prefix (`/sales/*`, `/finance/*`, `/ar/*`, `/ap/*`, `/purchasing/*`, `/inventory/*`, `/crm/*`, `/hr/*`, `/manufacturing/*`, `/reporting/*`)
- **Hidden:** On Dashboard (`/`), Tasks (`/tasks`), Settings (`/system/*`), AI pages (`/ai/*`), and other non-module routes

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
- Derived from the existing `NAV_GROUPS` config in `app-sidebar.tsx`
- Each module's items are categorised by type (page vs setting vs report) based on path patterns or explicit metadata
- No new data structures needed — extends existing navigation config

## 5. Mobile Navigation Preference

### Setting Location
- User Profile > Display Preferences > "Mobile Navigation Style"
- Accessible from the user menu in the header

### Storage
- `mobileNavStyle` enum field on User model
- Values: `CLASSIC_TABS | MINIMAL | MY_SHORTCUTS`
- Default: `CLASSIC_TABS` for new users

### Option: Classic Tabs (default)
- Fixed bottom tab bar (56px): Home, Tasks, Search, AI Chat
- Hamburger button in header for full navigation access
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
  - Star icon in the page header/action bar
  - Right-click context menu on desktop
  - Long-press on mobile
- Same toggle behaviour as mega-menu star

## 7. Transition & Migration

- **No sidebar code deleted initially** — sidebar component (`app-sidebar.tsx`) remains in codebase but is no longer rendered in the layout
- **Feature flag:** `useNewNavigation` (default: `true`) allows rollback during testing
- **Existing E7 favourites data:** Migrated to populate the toolbar — no data loss
- **Default favourites:** First-time users get Dashboard, Invoices, Sales Orders pre-pinned
- **Cleanup:** Remove sidebar code after the new navigation has been stable for one full epic cycle

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

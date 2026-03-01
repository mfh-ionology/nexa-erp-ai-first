# T1 Entity List Toolbar Redesign

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Replaces E7 toolbar (ViewsColumnsButton, FilterSortButton, SavedViewSelector) with a cleaner two-row layout

## Problem

The current E7 toolbar uses two modal-heavy buttons (Views & Columns, Filter & Sort) that each open tabbed dialogs combining unrelated concerns. This feels clunky — columns and views shouldn't share a modal, and simple filters shouldn't require navigating past a sort tab.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Views display (desktop) | Pill/chip tabs in a dedicated row | Scannable, one-click switching, no dropdown hunting |
| Views display (phone) | Dropdown selector | Horizontal pills overflow on small screens |
| Columns UI | Popover below button | Lightweight, stays in context, fast dismiss |
| Quick filter UI | Modal (metadata-driven) | Needs room for LOV multi-selects, date pickers — database-loaded fields |
| Advanced filter UI | Modal (~640px) with Sort tab | Power-user tool, condition builder + sort rules together |
| Sort location | Inside advanced filter modal only | Quick filter stays simple; power users who need multi-sort use advanced |
| Save button visibility | Always visible | Consistent layout, no shifting elements |
| Advanced filter placement | Next to quick filter in toolbar row | Both filter buttons together, clear discoverability |

## Layout

### Desktop / Tablet

```
Page Header: [Title] [Breadcrumbs]                [+ New] [AI] [...]
─────────────────────────────────────────────────────────────────────
Row 1 (Toolbar):
┌───────────────────────────────────────────────────────────────────┐
│ 🔍 Search...                   [≡ Columns] [▽ Filter] [⚙ Adv]   │
└───────────────────────────────────────────────────────────────────┘

Row 2 (Views Bar):
┌───────────────────────────────────────────────────────────────────┐
│ (All) (Overdue ★) (This Month ★) (High Value)         [💾] [🗑]  │
└───────────────────────────────────────────────────────────────────┘

Data Table...
```

### Phone

```
┌──────────────────────────────────┐
│ 🔍 Search...       [≡] [▽] [⚙]  │
├──────────────────────────────────┤
│ [▾ All Views ▾]          [💾] [🗑]│
└──────────────────────────────────┘

Card list...
```

- Row 1: Search fills available space, buttons are icon-only on small screens
- Row 2: Pill tabs become dropdown on phone. Save/Delete always visible.

## Components

### 1. Columns Button + Popover

**Icon:** `Columns3` (lucide-react) — already familiar to users
**Trigger:** Outline button, size sm
**Popover content (~320px wide):**

```
┌─────────────────────────────────┐
│ Columns                         │
│ ─────────────────────────────── │
│ ☰ ☑ Email              [📌]    │
│ ☰ ☑ First Name         [📌]    │
│ ☰ ☑ Last Name          [  ]    │
│ ☰ ☐ Role               [  ]    │
│ ☰ ☑ Status             [📌→]   │
│ ☰ ☐ Last Login         [  ]    │
│ ─────────────────────────────── │
│ [Reset to Default]     [Apply]  │
└─────────────────────────────────┘
```

- Drag handles for reorder (`@dnd-kit`, 5px activation distance)
- Checkboxes for visibility toggle
- Pin button cycles: NONE → LEFT → RIGHT → NONE
- Pin colour: LEFT = primary, RIGHT = blue-600
- ScrollArea if column list exceeds ~320px height
- Apply persists to `user_column_preferences` via bulk update API
- Reset restores `defaultVisible`, `defaultOrder`, pin NONE

### 2. Quick Filter Button + Modal

**Icon:** `Filter` (lucide-react) — standard funnel
**Badge:** Active filter count pill when > 0 filters applied
**Modal title:** "Filter {entityName}" (e.g., "Filter Users")
**Modal width:** Default (~480px)

Content is metadata-driven from `data_view_fields`:

| Field Type | Control |
|------------|---------|
| ENUM | Multi-select combobox (LOV values from DB) |
| BOOLEAN | Three-state button group: All / Yes / No |
| DATE | Preset dropdown (from `date_range_presets`) + custom range option |
| STRING | Text input with CONTAINS operator |
| NUMBER | Min / Max range inputs (BETWEEN, GTE, LTE) |
| CURRENCY | Same as NUMBER |

**Included fields:** `filterable = true` AND `advancedFilterOnly = false`
**LOV loading:** Static values from `lovStaticValues` JSON, or API fetch for GLOBAL/VIEW_SPECIFIC types
**Footer:** [Reset] (ghost, left) — [Apply] (primary, right)

### 3. Advanced Filter Button + Modal

**Icon:** `SlidersHorizontal` (lucide-react) — conveys tuning/configuration
**Badge:** Same active filter count as quick filter (they share filter state)
**Modal width:** ~640px

**Two tabs:**

**Filters tab:**
- Condition builder with AND/OR group logic
- All fields available (including `advancedFilterOnly = true`)
- All operators (EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY)
- Group bracketing for complex logic
- Inherits current implementation from `AdvancedFilterPanel`

**Sort tab:**
- Drag-reorderable priority rules
- Field select (only `sortable = true` fields)
- Direction toggle (ASC / DESC)
- Max 5 rules
- Inherits current implementation from `SortTab`

**Footer:** [Reset] (ghost, left) — [Apply] (primary, right)

### 4. Views Bar (Pill Tabs)

**Desktop/Tablet layout:**
- Horizontal row of rounded-full pills
- `"All"` pill always first (represents default / no saved view)
- Active pill: `bg-primary text-primary-foreground` (purple)
- Inactive pill: `bg-muted text-muted-foreground`, hover `bg-muted/80`
- Favourite views: small `★` after the name
- Ordering: favourites first, then alphabetical within scope groups
- Overflow: `+N more` pill opens dropdown with remaining views
- Click pill → load that view's filters + columns + sort config

**Phone layout:**
- Dropdown selector (like current SavedViewSelector)
- Shows active view name + chevron
- Popover with searchable list grouped by scope

### 5. Save Button

**Icon:** `Save` (lucide-react)
**Always visible,** right-aligned at end of views bar

**Behaviour on click:**

1. **Named view loaded + dirty** → Confirm dialog:
   - "Replace view '{viewName}'?"
   - Buttons: [Replace] [Save as New] [Cancel]

2. **Named view loaded + NOT dirty** → "Save as New" form directly

3. **"All" (default) active** → "Save as New" form directly

**Save as New form** (popover from save button):
- Text input: View name (required)
- Checkbox: "Add to favourites" (star)
- Select: Scope — Personal / Team / Global (Team/Global only if user has permission)
- Buttons: [Save] [Cancel]

### 6. Delete Button

**Icon:** `Trash2` (lucide-react)
**Always visible,** right-aligned after Save button
**Disabled** when "All" (default) is active — no view to delete
**Enabled** when a named view is loaded

**Behaviour on click:**
- Confirm dialog: "Delete view '{viewName}'? This cannot be undone."
- Buttons: [Delete] [Cancel]
- On success: switches to "All" (default view), removes pill from bar

## Components Removed

| Old Component | Replacement |
|---------------|-------------|
| `ViewsColumnsButton` | Separate `ColumnsButton` (popover) + views bar |
| `FilterSortButton` | `QuickFilterButton` (modal) + `AdvancedFilterButton` (modal) |
| `ViewsAndColumnsModal` | Removed entirely — split into popover + views bar |
| `FilterSortModal` | Becomes `AdvancedFilterModal` (filters + sort tabs) |
| `SavedViewSelector` (dropdown) | `ViewsBar` (pills on desktop, dropdown on phone) |
| `ViewsTab` (inside old modal) | Absorbed into views bar + save/delete buttons |
| `ColumnsTab` (inside old modal) | Becomes `ColumnsPopover` content |

## Shared State

Filter state is shared between Quick Filter and Advanced Filter:
- Both read from and write to the same `useFilterState` hook
- Applying filters in quick filter updates what advanced filter shows, and vice versa
- Active filter count badge appears on BOTH filter buttons
- Quick filter only shows simple conditions; advanced filter shows all (including any set via quick filter)

## Styling (Concept D)

- Pill tabs: `rounded-full`, 8px vertical padding, Plus Jakarta Sans font
- Buttons: 8px radius, outline variant, Concept D shadow on hover
- Popover/Modal: 12px radius, purple-tinted shadow `rgba(124,58,237,0.08)`
- Background: inherits `#f4f2ff` page background
- Active pill: `#7c3aed` bg, white text
- Animations: `animate-fade-in-up` on views bar, popover uses Radix default transitions

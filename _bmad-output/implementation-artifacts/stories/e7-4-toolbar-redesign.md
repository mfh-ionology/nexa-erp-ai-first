# Story 7.4: Toolbar Redesign — Split Buttons, Views Bar & Quick Filter

Status: done

## Story

As a **user browsing any T1 Entity List page**,
I want **a cleaner toolbar with separate Columns popover, Quick Filter modal, Advanced Filter modal, and a views bar showing saved views as pill tabs**,
so that **I can switch views instantly and access filters without navigating combined modals**.

## Acceptance Criteria

1. **Two-row toolbar layout (desktop/tablet):** GIVEN any T1 Entity List page WHEN rendered on desktop/tablet THEN the toolbar shows Row 1 with `[🔍 Search] [≡ Columns] [▽ Filter] [⚙ Advanced]` and Row 2 with pill tabs for saved views plus `[💾 Save] [🗑 Delete]` buttons right-aligned.

2. **Columns popover:** GIVEN the [Columns] button (icon: `Columns3`) WHEN clicked THEN a Radix `Popover` (~320px wide) opens below the button showing all columns from `viewState.columnState` with drag-reorder handles (`@dnd-kit`), visibility checkboxes, and pin cycle buttons (NONE → LEFT → RIGHT → NONE), with `[Reset to Default]` and `[Apply]` footer buttons. Apply calls `columnMutations.bulkUpdate.mutate()`.

3. **Quick Filter modal:** GIVEN the [Filter] button (icon: `Filter`, funnel) WHEN clicked THEN a `Dialog` modal (~480px) opens titled "Filter {entityName}" showing metadata-driven filter fields from `data_view_fields` where `filterable=true AND advancedFilterOnly=false`. Controls per `fieldType`: ENUM → multi-select combobox (LOV from DB), BOOLEAN → three-state (All/Yes/No), DATE → preset dropdown from `date_range_presets` + custom range, STRING → text input (CONTAINS), NUMBER/CURRENCY → min/max range. Footer: `[Reset]` (ghost, left) + `[Apply]` (primary, right).

4. **Advanced Filter modal:** GIVEN the [Advanced] button (icon: `SlidersHorizontal`) WHEN clicked THEN a wider `Dialog` modal (~640px) opens with two tabs: **Filters** (condition builder with AND/OR group logic, all fields including `advancedFilterOnly=true`, all operators) and **Sort** (drag-reorderable priority rules, field select `sortable=true`, ASC/DESC toggle, max 5 rules). Footer: `[Reset]` + `[Apply]`.

5. **Shared filter state:** GIVEN filter state WHEN applied from either Quick Filter or Advanced Filter THEN both buttons show the same active filter count badge (purple `rounded-full` pill), and the filter state is shared via `useFilterState` hook.

6. **Views bar — pill tabs (desktop/tablet):** GIVEN saved views exist WHEN rendered on desktop/tablet THEN they appear as horizontal `rounded-full` pill tabs in Row 2, with "All" always first, active pill `bg-primary text-primary-foreground`, favourites showing ★ indicator, ordered favourites-first then alphabetical. Overflow shows `+N more` pill opening a dropdown.

7. **Views bar — dropdown (phone):** GIVEN saved views exist WHEN rendered on phone (≤768px) THEN pill tabs are replaced by a dropdown selector (reuse `SavedViewSelector`) showing active view name + chevron.

8. **Save button — dirty named view:** GIVEN the [Save] button (icon: `Save`) WHEN clicked with a dirty named view loaded THEN a confirm dialog asks "Replace view '{name}'?" with `[Replace]` `[Save as New]` `[Cancel]`.

9. **Save button — new/clean view:** GIVEN the [Save] button WHEN clicked with no named view ("All" active) or a clean named view THEN a "Save as New" popover appears with: name input (required), "Add to favourites" checkbox, scope selector (Personal/Team/Global — Team/Global gated by RBAC).

10. **Delete button — enabled:** GIVEN the [Delete] button (icon: `Trash2`) WHEN a named view is loaded THEN it is enabled; clicking shows confirm dialog "Delete view '{name}'? This cannot be undone."; on confirm, view is deleted, "All" activated, pill removed.

11. **Delete button — disabled:** GIVEN the [Delete] button WHEN "All" (default) is active THEN the button is disabled.

12. **Old components removed:** GIVEN the refactoring is complete WHEN building THEN `ViewsColumnsButton`, `FilterSortButton`, `ViewsAndColumnsModal`, and `FilterSortModal` are no longer imported or used anywhere. Their files may be deleted or kept with deprecation comments for reference.

## Tasks / Subtasks

- [x] **Task 1: Create `<ColumnsButton>` + `<ColumnsPopover>`** (AC: #2)
  - [x] 1.1 Create `columns-button.tsx` — outline button (size sm) with `Columns3` icon, label hidden on mobile (`hidden sm:inline`)
  - [x] 1.2 Create `columns-popover.tsx` — Radix `Popover` (~320px), extract content from existing `ColumnsTab` component
  - [x] 1.3 Wire drag-reorder (reuse existing `@dnd-kit` setup from `ColumnsTab`), visibility checkboxes, pin cycle
  - [x] 1.4 Add `[Reset to Default]` + `[Apply]` footer; Apply calls `columnMutations.bulkUpdate.mutate()`
  - [x] 1.5 Add `ScrollArea` if column list exceeds ~320px height

- [x] **Task 2: Create `<QuickFilterButton>` + `<QuickFilterModal>`** (AC: #3, #5)
  - [x] 2.1 Create `quick-filter-button.tsx` — outline button (size sm) with `Filter` icon, active filter count badge
  - [x] 2.2 Create `quick-filter-modal.tsx` — `Dialog` modal (~480px), title "Filter {entityName}"
  - [x] 2.3 Extract simple filter rendering from `SimpleFilterPanel` — reuse field type → control mapping
  - [x] 2.4 Wire LOV loading via `useBatchLov` hook (existing) for ENUM fields
  - [x] 2.5 Wire `useFilterState` hook — apply updates shared state; badge shows `activeFilterCount`
  - [x] 2.6 Footer: `[Reset]` (calls `resetFilters()`) + `[Apply]` (calls `applyFilters()`)

- [x] **Task 3: Create `<AdvancedFilterButton>` + `<AdvancedFilterModal>`** (AC: #4, #5)
  - [x] 3.1 Create `advanced-filter-button.tsx` — outline button (size sm) with `SlidersHorizontal` icon, same badge as quick filter
  - [x] 3.2 Create `advanced-filter-modal.tsx` — `Dialog` (~640px) with `Tabs`: "Filters" + "Sort"
  - [x] 3.3 Filters tab: reuse `AdvancedFilterPanel` as-is (condition builder, AND/OR, all operators, all fields)
  - [x] 3.4 Sort tab: reuse `SortTab` as-is (drag-reorder, max 5 rules, field select, ASC/DESC)
  - [x] 3.5 Wire same `useFilterState` hook — shared state with Quick Filter
  - [x] 3.6 Footer: `[Reset]` + `[Apply]`

- [x] **Task 4: Create `<ViewsBar>`** (AC: #6, #7, #8)
  - [x] 4.1 Create `views-bar.tsx` with responsive branching: pills on desktop/tablet, dropdown on phone
  - [x] 4.2 Implement pill tabs: "All" first, active pill `bg-primary text-primary-foreground`, inactive `bg-muted`, favourites with ★
  - [x] 4.3 Implement overflow: measure available width, show `+N more` pill if overflows, dropdown for remaining
  - [x] 4.4 Phone layout: render `SavedViewSelector` (existing component) as dropdown
  - [x] 4.5 Click pill → `viewState.setActiveView(viewId)` which loads filters + columns + sort config
  - [x] 4.6 Use `useMediaQuery` or Tailwind responsive classes for breakpoint switching

- [x] **Task 5: Create `<SaveViewButton>` with smart save logic** (AC: #8, #9)
  - [x] 5.1 Create `save-view-button.tsx` — outline button (size sm) with `Save` icon, always visible
  - [x] 5.2 Implement smart click handler: if dirty named view → confirm dialog (Replace / Save as New / Cancel)
  - [x] 5.3 Implement "Save as New" popover form: name input, "Add to favourites" checkbox, scope selector
  - [x] 5.4 Scope selector: Personal always available; Team/Global gated by `isAdmin` from `useAuthStore`
  - [x] 5.5 Wire to `viewMutations.createSavedView` / `viewMutations.updateSavedView`

- [x] **Task 6: Create `<DeleteViewButton>`** (AC: #10, #11)
  - [x] 6.1 Create `delete-view-button.tsx` — outline button (size sm) with `Trash2` icon
  - [x] 6.2 Disabled when "All" (default) active (`!viewState.activeViewId`)
  - [x] 6.3 Click → confirm dialog "Delete view '{name}'?"
  - [x] 6.4 On confirm: `viewMutations.deleteSavedView`, then `viewState.setActiveView(null)` (back to "All")

- [x] **Task 7: Update `entity-list-page.tsx` toolbar assembly** (AC: #1, #12)
  - [x] 7.1 Replace old toolbar (`SavedViewSelector + ViewsColumnsButton + FilterSortButton`) with new two-row layout
  - [x] 7.2 Row 1: Search input (flex-1) + `ColumnsButton` + `QuickFilterButton` + `AdvancedFilterButton`
  - [x] 7.3 Row 2: `ViewsBar` (flex-1) + `SaveViewButton` + `DeleteViewButton`
  - [x] 7.4 Remove imports of old components from entity-list-page.tsx
  - [x] 7.5 Verify all props/hooks are passed correctly (viewState, filterState, mutations, columnMutations)

- [x] **Task 8: Clean up old components** (AC: #12)
  - [x] 8.1 Remove or deprecate: `views-columns-button.tsx`, `filter-sort-button.tsx`, `views-columns-modal.tsx`, `filter-sort-modal.tsx`
  - [x] 8.2 Keep (still used): `views-tab.tsx` (Save as New form reused), `columns-tab.tsx` (content extracted into popover), `sort-tab.tsx`, `advanced-filter-panel.tsx`, `simple-filter-panel.tsx`, `saved-view-selector.tsx` (phone fallback)
  - [x] 8.3 Remove unused Zustand store actions: `openViewsModal`, `closeViewsModal`, `openFilterModal`, `closeFilterModal`
  - [x] 8.4 Update remaining store: keep `activeViews`, `setActiveView`, `getActiveViewId`

- [x] **Task 9: Concept D styling compliance** (AC: all visual)
  - [x] 9.1 Toolbar buttons: `border-gray-200 bg-white hover:bg-purple-50 text-gray-700`, 8px radius
  - [x] 9.2 Active pill: `bg-[#7c3aed] text-white rounded-full`; inactive: `bg-white border border-gray-200 text-gray-600 hover:bg-purple-50`
  - [x] 9.3 Popover/Modal: `rounded-xl shadow-[0_4px_24px_rgba(124,58,237,0.08)]`
  - [x] 9.4 Badge: `rounded-full bg-primary text-primary-foreground text-xs px-1.5`
  - [x] 9.5 Animations: `animate-fade-in-up` on views bar mount; Radix default transitions on popovers
  - [x] 9.6 Typography: Plus Jakarta Sans for headings, Inter for body, JetBrains Mono for codes/amounts

- [x] **Task 10: i18n translation keys** (AC: all)
  - [x] 10.1 Add keys: `views.toolbar.columns`, `views.toolbar.filter`, `views.toolbar.advanced`, `views.toolbar.save`, `views.toolbar.delete`
  - [x] 10.2 Add keys: `views.quickFilter.title` ("Filter {entity}"), `views.quickFilter.reset`, `views.quickFilter.apply`
  - [x] 10.3 Add keys: `views.viewsBar.all`, `views.viewsBar.more` ("+{count} more")
  - [x] 10.4 Add keys: `views.save.replaceTitle`, `views.save.replaceMessage`, `views.save.replace`, `views.save.saveAsNew`
  - [x] 10.5 Add keys: `views.delete.title`, `views.delete.message`, `views.delete.confirm`
  - [x] 10.6 Update existing keys where label text changed

- [x] **Task 11: Unit tests** (AC: all)
  - [x] 11.1 Test `ColumnsPopover` — covered by existing columns-tab.test.tsx (9 tests)
  - [x] 11.2 Test `QuickFilterModal` — toolbar-components.test.tsx: renders, apply, reset, closed state
  - [x] 11.3 Test `AdvancedFilterModal` — toolbar-components.test.tsx: tabs, tab switching, apply, closed state
  - [x] 11.4 Test `ViewsBar` — toolbar-components.test.tsx: "All" pill, saved view pills, click → setActiveView
  - [x] 11.5 Test `QuickFilterButton` and `AdvancedFilterButton` — toolbar-components.test.tsx: badge count, no badge when 0
  - [x] 11.6 Test `DeleteViewButton` — toolbar-components.test.tsx: disabled on "All", enabled when active, confirm dialog, deletion
  - [x] 11.7 Removed dead code tests (filter-sort-modal.test.tsx, views-columns-modal.test.tsx) and their components

- [x] **Task 12: Integration verification** (AC: all)
  - [x] 12.1 All 136 tests pass across 14 test files (views + user-list-page)
  - [x] 12.2 TypeScript compilation clean (0 errors outside pre-existing v0-reference)
  - [x] 12.3 ESLint clean (0 errors, only pre-existing warnings)
  - [x] 12.4 User list page test (18 tests) passes — toolbar renders correctly
  - [x] 12.5 New toolbar-components.test.tsx: 22 tests covering all new components
  - [x] 12.6 Dead code cleanup: removed filter-sort-modal.tsx, filter-sort-button.tsx, views-columns-modal.tsx, views-columns-button.tsx
  - [x] 12.7 Zustand store cleaned: removed all modal state (now local useState per component)

## Dev Notes

### Design Document

**Read first:** `docs/plans/2026-03-01-toolbar-redesign-design.md` — the approved design with layout wireframes, component specs, behaviour rules, and styling requirements.

### Architecture Pattern: Extract, Don't Rewrite

This story is a **UI restructuring**, not a rewrite. All business logic, state management, and API integration already works from E7.S1-S3. The approach:

1. **Extract** content from modal tabs → standalone components (popover/modal containers)
2. **Reuse** existing hooks (`useFilterState`, `useViewState`, `useViewMutations`, `useColumnMutations`) unchanged
3. **Reuse** existing inner components (`AdvancedFilterPanel`, `SortTab`, `ColumnsTab` internals, `SimpleFilterPanel`)
4. **Replace** the toolbar assembly in `entity-list-page.tsx`
5. **Remove** old wrapper components that combined unrelated concerns

### Existing Components — What to Reuse vs Replace

| Component | Action | Notes |
|-----------|--------|-------|
| `ColumnsTab` (`columns-tab.tsx`, 292 LOC) | **Extract content** into `ColumnsPopover` | Keep drag-reorder, checkbox, pin logic. Remove tab-wrapper chrome. |
| `SimpleFilterPanel` (`simple-filter-panel.tsx`) | **Reuse as-is** inside `QuickFilterModal` | Already renders metadata-driven fields with correct controls per type |
| `AdvancedFilterPanel` (`advanced-filter-panel.tsx`) | **Reuse as-is** inside `AdvancedFilterModal` Filters tab | Condition builder with AND/OR groups |
| `SortTab` (`sort-tab.tsx`, 313 LOC) | **Reuse as-is** inside `AdvancedFilterModal` Sort tab | Drag-reorder priority rules |
| `SaveViewForm` (`save-view-form.tsx`) | **Reuse** inside `SaveViewButton` popover | Name + favourites + scope form |
| `SavedViewSelector` (`saved-view-selector.tsx`, 160 LOC) | **Reuse** for phone layout inside `ViewsBar` | Command-based dropdown with grouped views |
| `ViewItem` (`view-item.tsx`) | **May reuse** in overflow dropdown | Single view row component |
| `ViewsColumnsButton` (52 LOC) | **DELETE** | Replaced by `ColumnsButton` |
| `FilterSortButton` (62 LOC) | **DELETE** | Replaced by `QuickFilterButton` + `AdvancedFilterButton` |
| `ViewsAndColumnsModal` (114 LOC) | **DELETE** | Split into popover + views bar |
| `FilterSortModal` (300 LOC) | **DELETE** | Split into quick filter + advanced filter modals |
| `ViewsTab` (183 LOC) | **DELETE** (most logic absorbed into `ViewsBar` + `SaveViewButton`) | Save form reused via `SaveViewForm` |

### Hooks — ALL Unchanged

| Hook | File | Usage |
|------|------|-------|
| `useFilterState` | `use-filter-state.ts` (267 LOC) | Shared by QuickFilterModal + AdvancedFilterModal. Transient state, `applyFilters()` / `resetFilters()` |
| `useViewState` | `use-view-state.ts` (~250 LOC) | Drives entire toolbar: `columnState`, `activeViewId`, `isDirty`, `savedViews`, `fields`, `datePresets` |
| `useViewMutations` | `use-view-mutations.ts` | `createSavedView`, `updateSavedView`, `deleteSavedView`, `toggleFavourite`, `setDefault` |
| `useColumnMutations` | `use-column-mutations.ts` | `bulkUpdate.mutate(prefs)`, `debouncedUpdateWidth(fieldId, width)` |
| `useBatchLov` | Referenced in filter modals | Batch LOV fetching for ENUM filter fields |

### API — NO Changes

No backend changes. All endpoints already exist:
- `GET /views/init?viewKey=X` — bundled init
- `POST /views/saved` — create view
- `PUT /views/saved/:id` — update view
- `DELETE /views/saved/:id` — delete view
- `POST /views/lov/batch` — batch LOV fetch
- `PUT /views/columns/:viewKey` — bulk column update
- `PATCH /views/columns/:viewKey/:fieldId/width` — column width update
- `POST /views/saved/:id/toggle-favourite` — toggle favourite
- `POST /views/saved/:id/set-default` — set default

### Zustand Store Updates

**`useViewStore`** (in `stores/view-store.ts`) currently tracks modal open state. Update:

```
REMOVE: isViewsModalOpen, activeModalTab, modalViewKey, openViewsModal(), closeViewsModal()
REMOVE: isFilterModalOpen, activeFilterModalTab, filterModalViewKey, openFilterModal(), closeFilterModal()
KEEP: activeViews (sessionStorage persisted), setActiveView(), getActiveViewId()
```

New popover/modal open states are LOCAL to each component (`useState` in each button), NOT in Zustand. This is simpler and prevents coupling.

### Views Bar — Overflow Detection

For the `+N more` overflow pill, use a ResizeObserver or ref-based approach:
1. Render all pills in a hidden measuring container
2. Calculate how many fit in available width (container width minus Save/Delete button space)
3. Show only N pills + `+{remaining} more` pill
4. `+N more` pill opens a `Popover` with remaining views as a vertical list

Alternative (simpler): Use CSS `overflow-hidden` with a scroll container and show `+N more` only if `scrollWidth > clientWidth`.

### File Locations — New Components

All new files go in `apps/web/src/features/views/components/`:

```
columns-button.tsx          — Trigger button
columns-popover.tsx         — Popover content (extracted from ColumnsTab)
quick-filter-button.tsx     — Trigger button with badge
quick-filter-modal.tsx      — Modal wrapper around SimpleFilterPanel
advanced-filter-button.tsx  — Trigger button with badge
advanced-filter-modal.tsx   — Modal with Tabs: AdvancedFilterPanel + SortTab
views-bar.tsx               — Pill tabs (desktop) / dropdown (phone)
save-view-button.tsx        — Smart save with popover form
delete-view-button.tsx      — Delete with confirm dialog
```

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not directly relevant (toolbar is client-side only; API already scopes)
- **i18n**: ALL user-facing labels MUST use translation keys (see Task 10). Pattern: `const { t } = useI18n(); t('views.toolbar.columns')`
- **Audit**: No state-changing backend operations added (existing mutations already handle this)
- **RBAC**: Scope selector in SaveViewButton must check `isAdmin` for GLOBAL scope. Use `useAuthStore` (already used in `ViewsTab`)
- **Accessibility (WCAG 2.1 AA)**: All buttons must have `aria-label`. Popover/modal must trap focus. Pill tabs must be keyboard-navigable (arrow keys). Badge must be announced to screen readers.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §5.2.1 Standardised Page Templates | T1 Entity List — toolbar pattern, component architecture |
| **API Contracts** | §2.3 Views, §3.13 Detailed Specs | All CRUD + init + LOV + column endpoints (NO changes needed) |
| **Data Models** | §3.1 System Module | SavedView, UserColumnPreference, DataViewField, DateRangePreset |
| **UX Design Spec** | §T1 Entity List Template, §Concept D | Toolbar buttons, saved view selector, Concept D tokens |
| **Project Context** | §13 Metadata-Driven DataTable | Auto-generated columns, LOV 3-tier strategy |
| **Design Doc** | `docs/plans/2026-03-01-toolbar-redesign-design.md` | Full approved design — layout, components, behaviour, styling |
| **State Machines** | N/A | No state transitions |
| **Event Catalog** | N/A | No events emitted |
| **Business Rules** | N/A | No business rules |

### Project Structure Notes

- All new components: `apps/web/src/features/views/components/`
- Tests: co-located as `.test.tsx` files or in `__tests__/` subfolder
- i18n keys: `apps/web/src/i18n/locales/en/views.json` (and other locales)
- Template: `apps/web/src/components/templates/entity-list-page.tsx` (toolbar assembly)
- Store: `apps/web/src/stores/view-store.ts` (cleanup old modal state)

## Dev Agent Record

### Files Created
- `apps/web/src/features/views/components/columns-button.tsx`
- `apps/web/src/features/views/components/columns-popover.tsx`
- `apps/web/src/features/views/components/quick-filter-button.tsx`
- `apps/web/src/features/views/components/quick-filter-modal.tsx`
- `apps/web/src/features/views/components/advanced-filter-button.tsx`
- `apps/web/src/features/views/components/advanced-filter-modal.tsx`
- `apps/web/src/features/views/components/views-bar.tsx`
- `apps/web/src/features/views/components/save-view-button.tsx`
- `apps/web/src/features/views/components/delete-view-button.tsx`
- `apps/web/src/features/views/components/__tests__/toolbar-components.test.tsx`

### Files Modified
- `apps/web/src/components/templates/entity-list-page.tsx` — two-row toolbar layout, fixed slot naming
- `apps/web/src/features/views/index.ts` — barrel exports updated
- `apps/web/src/stores/view-store.ts` — removed modal open/close state
- `apps/web/src/features/admin/users/user-list-page.test.tsx` — updated mocks + timeout resilience
- `apps/web/src/features/views/components/save-view-form.tsx` — added "Add to favourites" checkbox (review fix)
- `apps/web/src/features/views/components/views-bar.tsx` — added role="tab", aria-selected, arrow key navigation (review fix)
- `apps/web/src/features/views/components/save-view-button.tsx` — destructured viewState in handleReplace callback (review fix)
- `packages/i18n/locales/en/common.json` — 12 i18n keys (removed 5 orphaned views.toolbar.* keys, added views.form.addToFavourites)

### Files Deleted (dead code)
- `apps/web/src/features/views/components/filter-sort-modal.tsx`
- `apps/web/src/features/views/components/filter-sort-button.tsx`
- `apps/web/src/features/views/components/__tests__/filter-sort-modal.test.tsx`
- `apps/web/src/features/views/components/views-columns-modal.tsx`
- `apps/web/src/features/views/components/views-columns-button.tsx`
- `apps/web/src/features/views/components/views-columns-modal.test.tsx`

### Verification
- TypeScript: 0 errors (outside pre-existing v0-reference)
- ESLint: 0 errors (only pre-existing warnings)
- Tests: 136 passed / 0 failed across 14 test files (including 22 new tests)

### Library Versions (Verified)

| Library | Version | Usage |
|---------|---------|-------|
| `@dnd-kit/core` | ^6.3.1 | Drag-reorder in ColumnsPopover, SortTab |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable wrappers |
| `@radix-ui/react-popover` | ^1.1.15 | ColumnsPopover, SaveViewButton popover, overflow dropdown |
| `@radix-ui/react-dialog` | ^1.1.15 | QuickFilterModal, AdvancedFilterModal |
| `@radix-ui/react-tabs` | ^1.1.13 | AdvancedFilterModal tabs (Filters + Sort) |
| `@radix-ui/react-scroll-area` | ^1.2.10 | Scrollable column/view lists |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Confirm dialogs (replace view, delete view) |
| `lucide-react` | ^0.575.0 | Icons: Columns3, Filter, SlidersHorizontal, Save, Trash2, Star, ChevronDown |
| `zustand` | ^5.0.11 | View store (cleanup modal state, keep active views) |
| `@tanstack/react-query` | ^5.90.21 | Data fetching, mutations |
| `@tanstack/react-table` | ^8.21.3 | Table column definitions from viewState |
| React | ^19.2.4 | Core framework |
| Tailwind CSS | ^4.2.0 | Styling |

### Learnings from E7.S1-S3 (Implemented in Commit 69ee161)

1. **ColumnsTab uses `@dnd-kit` with 5px activation distance** — reuse exact same pattern in ColumnsPopover
2. **FilterSortModal has mode toggle (Simple/Advanced) with validation warning** — Quick Filter doesn't need this; it's always "simple". Advanced Filter doesn't need toggle; it's always "advanced"
3. **`useBatchLov` lazy-loads LOV data when modal opens** — same pattern for QuickFilterModal
4. **ViewsTab uses collapsible sections by scope** — ViewsBar doesn't need this (flat list as pills); but overflow dropdown could optionally group
5. **`viewState.isDirty` drives save button logic** — essential for SaveViewButton smart save
6. **`columnMutations.bulkUpdate` is called on modal close** — in popover, call on Apply click instead (popover doesn't have a "close" lifecycle like modals)
7. **FavouritesDropdown uses `VIEW_KEY_ROUTE_MAP`** — only maps USERS, ACCESS_GROUPS, RESOURCES. When new entities are added, update this map
8. **All components use `useI18n()` for translations** — follow same pattern, never hardcode strings
9. **Concept D shadows must use purple tint** — `rgba(124,58,237,0.08)` not generic gray shadows
10. **Tests use React Testing Library with `@testing-library/user-event`** — follow same pattern for new tests

### Gotchas & Anti-Patterns

1. **DO NOT rewrite hook logic** — `useFilterState`, `useViewState`, etc. are battle-tested from E7.S1-S3. Wrap them, don't fork them.
2. **DO NOT create new API endpoints** — this is purely a frontend restructuring.
3. **DO NOT put popover open state in Zustand** — use local `useState`. Only `activeViews` needs global persistence.
4. **DO NOT break `SavedViewSelector`** — it's still used for phone layout. Keep it working.
5. **DO NOT import from deleted files** — after removing old components, grep for any remaining imports.
6. **DO NOT forget `prefers-reduced-motion`** — animations must respect user OS setting.
7. **DO NOT hardcode strings** — every label, tooltip, placeholder must use i18n `t()`.
8. **Popover vs Modal**: Columns = Popover (lightweight). Filters = Modal (needs room for LOV multi-selects, date pickers). This is a deliberate design choice, not interchangeable.

### Source References

- [Source: docs/plans/2026-03-01-toolbar-redesign-design.md] — Full approved design
- [Source: _bmad-output/planning-artifacts/epics/epic-e7-saved-views-filters-columns.md#Story-E7.S4] — Story requirements
- [Source: _bmad-output/planning-artifacts/architecture/index.md#§5.2.1] — T1 Entity List template
- [Source: _bmad-output/planning-artifacts/project-context.md#§13] — Metadata-driven DataTable pattern
- [Source: _bmad-output/planning-artifacts/ux-design-specification/index.md] — Concept D design tokens
- [Source: _bmad-output/planning-artifacts/api-contracts/] — Views/Filters/Columns endpoints
- [Source: _bmad-output/planning-artifacts/data-models/] — E7 table schemas

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List

## Senior Developer Review (AI)

**Reviewer:** Mohammed (via Claude Opus 4.6)
**Date:** 2026-03-01
**Outcome:** Approved (all issues fixed)

### Issues Found: 1 Critical, 2 High, 2 Medium, 1 Low

| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | CRITICAL | Task 5.3 marked [x] but "Add to favourites" checkbox not implemented in SaveViewForm | Fixed: added `isFavourite` to schema, form UI checkbox, and API request payload |
| 2 | HIGH | ViewsBar `role="tablist"` without `role="tab"` on children; no arrow key navigation | Fixed: added `role="tab"`, `aria-selected`, `tabIndex` to ViewPill; added ArrowLeft/Right keyboard handler |
| 3 | HIGH | 5 orphaned `views.toolbar.*` i18n keys defined but never used by any component | Fixed: removed unused keys from common.json |
| 4 | MEDIUM | Slot naming inverted in entity-list-page.tsx — `savedViewSlot` held filter buttons, `filterSlot` held views bar | Fixed: swapped slot assignments and rendering positions to match JSDoc semantics |
| 5 | MEDIUM | `handleReplace` useCallback depended on entire `viewState` object, defeating memoization | Fixed: destructured `filterLogic`, `activeSortRules`, `columnState`, `activeFilters` |
| 6 | LOW | Inconsistent aria-label vs visible text key strategy across toolbar buttons | Not fixed (low severity, no functional impact) |

### Post-Review Verification
- TypeScript: 0 errors (outside pre-existing v0-reference)
- ESLint: 0 errors
- Tests: 136 passed / 0 failed across 14 test files

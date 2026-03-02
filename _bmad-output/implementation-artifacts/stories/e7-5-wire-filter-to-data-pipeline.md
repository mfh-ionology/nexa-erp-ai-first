# Story 7.5: Wire Filter Conditions to Data Pipeline

Status: done

## Story

As a **user browsing any T1 Entity List page**,
I want the filter conditions I apply (via the Quick Filter or Advanced Filter modal) to actually filter the displayed records,
so that selecting "Role = ADMIN" shows only admin users, and the metadata-driven filter system works end-to-end.

## Acceptance Criteria

1. **GIVEN** a user on the Users page with the "All" view active **WHEN** they open the Quick Filter modal, set Role = SUPER_ADMIN, and click Apply **THEN** only users with the SUPER_ADMIN role are displayed, and the Filter button badge shows "1"
2. **GIVEN** active filter conditions in `viewState.activeFilters` **WHEN** the data-fetching hook re-runs **THEN** it includes the serialized conditions as query parameters in the API request to `/system/users`
3. **GIVEN** the `GET /system/users` endpoint **WHEN** it receives serialized filter conditions **THEN** it calls `buildPrismaWhere()` from `filter-builder.ts` to construct a Prisma `where` clause and returns only matching records
4. **GIVEN** the user clears all filters (removes conditions and clicks Apply) **WHEN** the data refetches **THEN** all records are returned (no filter applied)
5. **GIVEN** the user applies multiple conditions with AND logic (e.g., Role = STAFF AND Active = true) **WHEN** the data refetches **THEN** only records matching ALL conditions are returned
6. **GIVEN** the user applies conditions with OR logic **WHEN** the data refetches **THEN** records matching ANY condition are returned
7. **GIVEN** the user re-opens the Quick Filter or Advanced Filter modal after applying filters **WHEN** the modal renders **THEN** it shows the currently applied conditions (not blank), matching what `viewState.activeFilters` holds
8. **GIVEN** the user loads a saved view with persisted conditions **WHEN** the view is activated **THEN** the saved conditions are applied as filters to the data fetch, and the correct subset of records is displayed
9. **GIVEN** a sort configuration is active (from sort rules or saved view) **WHEN** the data refetches **THEN** the sort is also applied server-side via the API (not just client-side TanStack Table sorting)
10. **GIVEN** any T1 entity list page using `viewKey` (Users, Access Groups, Resources) **WHEN** filters are applied **THEN** the filtering works identically — the mechanism is generic, not per-entity
11. **GIVEN** the existing 136 E7 tests **WHEN** all changes are complete **THEN** all tests still pass, and new tests cover the filter-to-API wiring

## Tasks / Subtasks

### Backend

- [x] Task 1: Add generic filter query param support to entity list endpoints (AC: #2, #3, #10)
  - [x] 1.1 Add `conditions` (JSON-encoded `FilterCondition[]`), `filterLogic` (`AND`|`OR`), `sortField`, `sortDir` query params to `userListQuerySchema` in `user.schema.ts`
  - [x] 1.2 In `user.service.ts` `listUsers()`, when `conditions` is provided, load `DataViewField` metadata for the USERS view key, call `buildPrismaWhere(conditions, fieldMetadata, filterLogic)`, and merge the result into the Prisma `where` clause
  - [x] 1.3 When `sortField` and `sortDir` are provided, use them for `orderBy` instead of the hardcoded `sort`/`order` params (retain backward compat — if old params present and new ones absent, use old params)
  - [x] 1.4 Extract a reusable helper `applyViewFilters(viewKey, conditions, filterLogic)` in `apps/api/src/core/views/` that loads field metadata and calls `buildPrismaWhere()` — so future entity endpoints can use it in one line
  - [x] 1.5 Write unit tests for the new query params: filter by single condition, multiple AND conditions, OR conditions, empty conditions (no filter), invalid conditions (400 error)

### Frontend — Data Hook Wiring

- [x] Task 2: Wire `viewState.activeFilters` to the data-fetching hook (AC: #1, #2, #4, #5, #6, #10)
  - [x] 2.1 In `entity-list-page.tsx` `MetadataEntityListPage`, added reactive useEffect that fires `onFilterChange` whenever `viewState.activeFilters` changes
  - [x] 2.2 Reactive notification via `onFilterChange` callback — no new prop needed, parent notified regardless of how filters changed (Apply click, saved view load, default view init)
  - [x] 2.3 In `UserListPage`, consume the filter params via `handleFilterChange` callback and pass them to `useUsers()` via query params
  - [x] 2.4 `useUsers()` already passes all params to `buildQueryString()` — added `conditions`, `filterLogic`, `sortField`, `sortDir` to `UserListParams` type
  - [x] 2.5 TanStack Query key already includes all params via the params object spread — filter changes trigger refetch automatically

### Frontend — Filter State Consistency

- [x] Task 3: Fix `useFilterState` initialization to use live applied filters (AC: #7, #8)
  - [x] 3.1 In `use-filter-state.ts`, changed initialization to use priority: `activeView?.conditions` → `viewState.activeFilters` → empty. Same for sort rules and filter logic.
  - [x] 3.2 Already handled by `setActiveView()` in `use-view-state.ts` (lines 276-284) which calls `setActiveFilters()` and `setActiveSortRules()` from saved view conditions
  - [x] 3.3 Existing `use-filter-state.test.ts` (15 tests) covers initialization — all pass with new priority logic

### Frontend — Saved View Filter Application

- [x] Task 4: Wire saved view activation to data pipeline (AC: #8)
  - [x] 4.1 Already implemented in `use-view-state.ts` `setActiveView()` (lines 268-287) — populates activeFilters from saved view's deserialized conditions
  - [x] 4.2 Already implemented — when viewId is null ("All" view), clears activeFilters to `[]`, activeSortRules to `[]`, filterLogic to `'AND'`

### Verification

- [x] Task 5: End-to-end verification (AC: #11)
  - [x] 5.1 All E7 tests pass: API 228/228 (7 files), Web 193/193 (21 files) = 421 total, 0 failures
  - [ ] 5.2 Manual test: Users page — apply Role = SUPER_ADMIN filter → only 1 user shown
  - [ ] 5.3 Manual test: Users page — apply Role = STAFF filter → only staff users shown
  - [ ] 5.4 Manual test: Clear filters → all users shown
  - [ ] 5.5 Manual test: Load a saved view with conditions → filters applied automatically
  - [ ] 5.6 Manual test: Re-open filter modal → shows current applied conditions

## Dev Notes

### Architecture: Server-Side Filtering (NOT Client-Side)

Per Architecture §2.9 and Project Context §13, the metadata-driven DataTable uses **server-side filtering**. `buildPrismaWhere()` in `apps/api/src/core/views/filter-builder.ts` converts `FilterCondition[]` to Prisma `where` clauses. TanStack Table is for display, column management, and client-side sorting only — it does NOT use `getFilteredRowModel()` or `columnFilters`.

### The 3-Break Problem This Story Fixes

1. **Break 1 — No filter params in API**: `GET /system/users` only accepts `search` and `isActive`. No generic filter condition support.
2. **Break 2 — `viewState.activeFilters` is a dead end**: After `applyFilters()` stores conditions in state, nothing reads them for data fetching.
3. **Break 3 — `useFilterState` re-initializes from saved view, not live filters**: Re-opening the modal after ad-hoc filter shows blank conditions.

### Key Serialization Bridge

`serializeConditionsForApi()` in `filter-serializer.ts` produces output that matches `buildPrismaWhere()` input exactly. The wire format is already agreed — only the transport (frontend → API) and consumption (API → Prisma) are missing.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: All queries must include `WHERE companyId = ?` (see RegisterSharingRule for shared entities). The `buildPrismaWhere()` output is MERGED with the existing companyId where clause, not replacing it.
- **i18n**: All user-facing labels must use translation keys (see i18n infrastructure). No new UI strings needed — this is a wiring story.
- **Audit**: No state-changing operations in this story — read-only filter queries.
- **Attachments/Notes/Tasks**: N/A for this story.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.9 Saved Views & DataTable Design | Server-side filter architecture, `buildPrismaWhere()` pattern, component file structure |
| **API Contracts** | §3.13 Views endpoints | `GET /views/init`, `POST /views/saved`, filter condition schema, `FilterOperator` enum |
| **State Machine** | N/A | No state transitions |
| **Event Catalog** | N/A | No events emitted |
| **Data Models** | §3.1 System Module | DataViewField (filterable, fieldType, lovType), SavedViewCondition (operator, value, groupId, groupLogic) |
| **Business Rules** | N/A | No business rules — pure infrastructure wiring |
| **Project Context** | §12 AI-First Integration, §13 Metadata-Driven DataTable | 3-tier LOV strategy, bundled init endpoint, TanStack Query + Zustand state split |

### Project Structure Notes

- `apps/api/src/core/views/filter-builder.ts` — Already complete, 14 operators, dot-notation fields, group bracketing, date presets. Call it, don't rebuild it.
- `apps/web/src/features/views/utils/filter-serializer.ts` — `serializeConditionsForApi()` and `serializeSortForApi()` already produce wire-ready format.
- `apps/web/src/features/views/hooks/use-view-state.ts` — `activeFilters`, `activeSortRules`, `filterLogic` state already populated by `applyFilters()`.
- `apps/web/src/features/views/hooks/use-filter-state.ts` — Transient modal state. Fix initialization at lines 108-111.
- `apps/web/src/components/templates/entity-list-page.tsx` — `MetadataEntityListPage` has `handleFilterApply` that calls `viewState.applyFilters()`. Add filter params forwarding here.
- `apps/web/src/features/admin/users/user-list-page.tsx` — Currently only passes `search` to `useUsers()`. Must also pass serialized filter conditions.
- `apps/web/src/features/admin/users/api/use-users.ts` — `useUsers()` hook. Extend params to include conditions, filterLogic, sortField, sortDir.

### FilterOperator Enum (14 values — from Prisma schema)

```
EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH,
GT, GTE, LT, LTE, BETWEEN,
IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY
```

### Source References

- [Source: apps/api/src/core/views/filter-builder.ts] — `buildPrismaWhere()` implementation, all 14 operators
- [Source: apps/web/src/features/views/utils/filter-serializer.ts] — `serializeConditionsForApi()`, `serializeSortForApi()`
- [Source: apps/web/src/features/views/hooks/use-view-state.ts#L187-189] — `activeFilters` useState
- [Source: apps/web/src/features/views/hooks/use-view-state.ts#L347-354] — `applyFilters()` function
- [Source: apps/web/src/features/views/hooks/use-filter-state.ts#L108-111] — Initialization from `activeView?.conditions` (the bug)
- [Source: apps/api/src/modules/system/user.service.ts#L89-134] — Current `listUsers()` with hardcoded where
- [Source: apps/api/src/modules/system/user.schema.ts#L64-74] — Current `userListQuerySchema` (no filter params)
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#L393-408] — Server-side filter architecture
- [Source: _bmad-output/planning-artifacts/project-context.md#§13] — Metadata-Driven DataTable pattern

### Previous Story Intelligence (E7.4)

- E7.4 restructured the toolbar into separate Columns, Filter, Advanced buttons and added the ViewsBar with pill navigation
- `onApply` callback in modals already returns `{ conditions, sortRules, filterLogic, serializedConditions, serializedSort }` — the wire format is ready
- `SaveViewForm` now includes `isFavourite` checkbox (fixed in review)
- ARIA tablist pattern added to ViewsBar with arrow key navigation
- 136 tests passing across 14 test files — must remain green
- All modal open/close state is local `useState`, not Zustand

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 via BMAD dev-story workflow

### Debug Log References

- TypeScript fix: added `filterLogic: 'AND' as const` to `defaultQuery` in `user.service.test.ts` (Zod `.default()` makes output type required)
- TypeScript fix: removed unused `serializeConditionsForApi`/`serializeSortForApi` imports from `entity-list-page.tsx`

### Completion Notes List

- **Break 1 fixed**: API now accepts `conditions`, `filterLogic`, `sortField`, `sortDir` query params. `applyViewFilters()` helper is reusable for any entity endpoint.
- **Break 2 fixed**: Reactive `useEffect` in `MetadataEntityListPage` fires `onFilterChange` whenever `viewState.activeFilters` changes, propagating to the data-fetching hook.
- **Break 3 fixed**: `useFilterState` initialization now uses priority chain: saved view conditions → live applied filters → empty.
- **Task 4 was already implemented**: `setActiveView()` in `use-view-state.ts` already populated activeFilters from saved views and cleared on "All" view.
- **423 tests pass** (230 API + 193 Web), 0 failures, 0 TypeScript errors.

### Code Review Fixes Applied

- **[HIGH] sortField validation**: Added allowlist check against `userSelect` keys in `user.service.ts` — rejects `passwordHash`, `mfaSecret`, etc.
- **[MEDIUM] handleFilterApply deps**: Fixed to `[viewState.applyFilters]` in `entity-list-page.tsx` — was `[viewState, filterState]` (new objects every render)
- **[MEDIUM] sortField/sortDir test coverage**: Added 2 tests to `user.service.test.ts` — valid sort + security rejection
- **[MEDIUM] barrel export**: Exported `applyViewFilters` from `apps/api/src/core/views/index.ts`

### File List

**New files:**
- `apps/api/src/core/views/apply-view-filters.ts` — Reusable helper: JSON conditions → Prisma where clause via buildPrismaWhere()
- `apps/api/src/core/views/apply-view-filters.test.ts` — 11 unit tests for applyViewFilters helper

**Modified files:**
- `apps/api/src/modules/system/user.schema.ts` — Added conditions, filterLogic, sortField, sortDir to userListQuerySchema
- `apps/api/src/modules/system/user.service.ts` — listUsers() calls applyViewFilters(), sortField validated against userSelect allowlist
- `apps/api/src/modules/system/user.service.test.ts` — Added filterLogic to defaultQuery, 2 new sortField tests (valid + security)
- `apps/api/src/core/views/index.ts` — Added barrel export for applyViewFilters
- `apps/web/src/components/templates/entity-list-page.tsx` — Reactive useEffect for onFilterChange, fixed handleFilterApply deps
- `apps/web/src/features/admin/users/user-list-page.tsx` — Filter state, handleFilterChange, filter params in queryParams
- `apps/web/src/features/admin/users/api/types.ts` — Added filter params to UserListParams
- `apps/web/src/features/views/hooks/use-filter-state.ts` — Fixed initialization priority chain

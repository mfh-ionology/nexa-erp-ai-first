# Epic E7: Saved Views / Filters / Columns

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR86 (saved views) | **NFRs:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA)

---

## Design Summary

E7 implements a **metadata-driven DataTable system** where a single `data_view_fields` table defines every column, filter, sort option, and LOV dropdown for every T1 Entity List page. When a new module is added in later epics, developers just seed rows — zero custom filter/column UI code per entity.

### Database Schema (6 Tables)

| Table | Purpose | Replaces |
|-------|---------|----------|
| `data_views` | List page registry (one row per entity list) | — |
| `data_view_fields` | Master column & filter metadata (the automation engine) | — |
| `date_range_presets` | Preset date ranges (Today, This Week, YTD, etc.) | — |
| `user_column_preferences` | Per-user column order/width/visibility | — |
| `saved_views` | Named views with filters + sort + columns + scope | Previous SavedView model |
| `saved_view_conditions` | Individual filter conditions with group bracketing | — |

### Key UX Decisions

1. **Two toolbar buttons** (not one cog): [Views & Columns] + [Filter & Sort]
2. **★ Favourites** in app header — accessible from ANY page, grouped by category
3. **Simple + Advanced filter modes** — Simple: vertical field list with searchable multi-select. Advanced: AND/OR with group bracketing
4. **Date fields** use preset dropdown from `date_range_presets` table (Today, This Week, MTD, YTD, Custom, etc.)
5. **Column widths** adjusted by dragging borders on the table, NOT numerical input
6. **Views store EVERYTHING** — filters + sort + column config
7. **ViewScope**: PERSONAL (creator only), ROLE (team), GLOBAL (admin-created, all users)
8. **Default view precedence**: personal default → role default → global default → system fallback

### Performance Strategy

- Bundled init endpoint: `GET /views/init?viewKey=X` (1 call instead of 4-5)
- 3-tier LOV strategy: Static (inline), Global (Zustand), View-Specific (lazy batch)
- Redis metadata cache (1hr TTL), TanStack Query (staleTime 30s)
- Server-side LOV search for >50 items
- Partial indexes on `is_favourite` and `is_default`

---

## Story E7.1: Database Schema & API Foundation

**User Story:** As a developer, I want the metadata-driven DataTable database schema and API endpoints created, so that the frontend can build a fully automated list page experience.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN migrations run THEN the 6 tables (data_views, data_view_fields, date_range_presets, user_column_preferences, saved_views, saved_view_conditions) are created with all fields, indexes, and foreign keys as specified in the Data Models document
2. GIVEN the database WHEN the seed script runs THEN 20 date_range_presets are seeded (CUSTOM RANGE, Today, Yesterday, Tomorrow, Last 3/7/30 days, Next 7/30 days, This/Last/Next Week/Month/Year, MTD, YTD) and at least one data_view with fields is seeded (e.g., USERS or INVOICES)
3. GIVEN the bundled init endpoint `GET /views/init?viewKey=USERS` WHEN called by an authenticated user THEN it returns the data_view, all fields, date_presets, the user's saved views (with conditions), and user column preferences in a single response within 100ms
4. GIVEN the saved view CRUD endpoints WHEN a STAFF user creates a view with scope=PERSONAL THEN only that user sees it; WHEN scope=ROLE THEN all users with matching role see it; WHEN scope=GLOBAL THEN only ADMIN can create it and all users see it
5. GIVEN the filter-to-Prisma converter WHEN a saved view's conditions are applied THEN the backend correctly builds a Prisma `where` clause supporting all FilterOperator values (EQUALS, CONTAINS, GT, LT, BETWEEN, IN, IS_EMPTY, etc.) with AND/OR group bracketing
6. GIVEN the `POST /views/lov/batch` endpoint WHEN called with multiple LOV requests THEN it returns all LOV data in a single response, respecting `lovSearchMin` thresholds and `lovDependsOn` parent values
7. GIVEN the `PATCH /views/columns/:viewKey/:fieldId/width` endpoint WHEN called after a column drag-resize THEN the width is persisted to user_column_preferences within 50ms

**Key Tasks:**
- [ ] Create Prisma models for all 6 tables with proper relations, indexes, and enums (FieldDataType, LovType, PinPosition, FilterOperator)
- [ ] Create migration and seed script (date_range_presets + initial data_view + fields)
- [ ] Implement `GET /views/init` bundled endpoint with Redis caching (1hr TTL for metadata)
- [ ] Implement saved view CRUD endpoints with scope-based visibility logic
- [ ] Implement filter-to-Prisma converter (`filter-builder.ts`) supporting all operators and group bracketing
- [ ] Implement `POST /views/lov/batch` with 3-tier LOV strategy
- [ ] Implement `PUT /views/columns/:viewKey` bulk upsert and `PATCH .../width` for drag-resize
- [ ] Implement `POST /views/saved/:id/toggle-favourite` and `POST .../set-default`
- [ ] Add comprehensive test coverage (unit + integration)

**FR/NFR:** FR86; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | T1 Entity List — metadata-driven column/filter/sort |
| API Contracts | §2.3 Views, Filters & Columns; §3.13 Detailed Specs | All CRUD + init + LOV + column endpoints |
| Data Models | §3.1 System Module | DataView, DataViewField, DateRangePreset, UserColumnPreference, SavedView, SavedViewCondition |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no specific business rules |
| UX Design Spec | §Standardised Screen Templates, T1 | Metadata-driven DataTable pattern |
| Project Context | §12 AI-First Integration, §13 Metadata-Driven DataTable | LOV strategy, bundled init, AI tool definitions |

---

## Story E7.2: Column Customization & Views UI

**User Story:** As a user, I want to manage columns (reorder, hide/show, pin, resize) and manage saved views (create, edit, delete, set default, star) from a Views & Columns modal, so that I can customise how I browse data.

**Acceptance Criteria:**
1. GIVEN any T1 Entity List page WHEN the page mounts THEN it calls `GET /views/init` and auto-generates columns from `data_view_fields` metadata, applying user column preferences if they exist, or the user's default saved view if set
2. GIVEN the [Views & Columns] button WHEN clicked THEN a modal opens with two tabs: Views and Columns
3. GIVEN the Views Tab WHEN rendered THEN saved views are grouped into My Views (PERSONAL), Team Views (ROLE), and Global Views (GLOBAL) sections, each showing star toggle, edit/delete actions on hover, and a "Set as Default" action
4. GIVEN the Views Tab WHEN "Save as New View" is clicked THEN a form captures name, group name, and scope, and saves the current filter + sort + column configuration as a new SavedView
5. GIVEN a named saved view is loaded WHEN "Save Current View" is clicked THEN the view's configuration is updated in-place (overwrite)
6. GIVEN the Columns Tab WHEN rendered THEN all available columns appear as a checkbox list with drag handles for reorder and pin toggle (Left/Right/None)
7. GIVEN a column header border on the table WHEN the user drags it THEN the column resizes in real-time and the new width is persisted via `PATCH /views/columns/:viewKey/:fieldId/width` with debounce
8. GIVEN a column is pinned Left WHEN the table scrolls horizontally THEN the pinned column stays fixed with a shadow indicator

**Key Tasks:**
- [ ] Build `useViewInit(viewKey)` hook that calls `/views/init` and hydrates TanStack Table state
- [ ] Build `<ViewsAndColumnsModal>` with two tabs: Views and Columns (Concept D styled)
- [ ] Build Views Tab with grouped sections, star toggle, edit/delete, "Set as Default", "Save as New", "Save Current View"
- [ ] Build Columns Tab with checkbox visibility, drag-handle reorder (dnd-kit), pin toggle
- [ ] Integrate TanStack Table column sizing with drag-resize on column borders
- [ ] Implement column pinning with sticky positioning and shadow indicators
- [ ] Build `<SavedViewSelector>` dropdown for the toolbar row
- [ ] Wire all mutations (create/update/delete view, toggle favourite, set default, update columns) to API endpoints with optimistic updates
- [ ] Ensure all components match Concept D visual design (purple theme, 12px radius, custom shadows)

**FR/NFR:** FR86; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | T1 Entity List — column customisation, saved view selector |
| API Contracts | §2.3 Views, §3.13 | CRUD + column prefs endpoints |
| Data Models | §3.1 System Module | SavedView, UserColumnPreference |
| State Machines | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules | N/A | N/A |
| UX Design Spec | §T1 Entity List Template | Views & Columns button, column drag-resize, saved view selector |
| Project Context | §13 Metadata-Driven DataTable | Auto-generated columns from metadata |

---

## Story E7.3: Filter Builder & Favourites

**User Story:** As a user, I want to build filters using Simple mode (field list with multi-select) or Advanced mode (AND/OR with group bracketing), use date presets, and access my favourite views from the app header, so that I can find specific records efficiently.

**Acceptance Criteria:**
1. GIVEN the [Filter & Sort] button WHEN clicked THEN a wider modal (~640px) opens with two tabs: Filters and Sort
2. GIVEN the Filters Tab in Simple mode WHEN rendered THEN it shows a vertical list of all filterable fields (where `filterable=true`), each with a searchable multi-select dropdown populated from the field's LOV configuration
3. GIVEN a date field in Simple mode WHEN the user clicks it THEN a dropdown of date presets appears (from `date_range_presets` table: Today, This Week, Last 30 Days, YTD, Custom, etc.). Selecting "Custom" shows from/to date pickers
4. GIVEN the Filters Tab WHEN toggled to Advanced mode THEN the user can add condition rows with field/operator/value selection, AND/OR toggle between conditions, and group bracketing with `( )` for complex logic
5. GIVEN active filters WHEN applied THEN the list immediately refreshes showing only matching records, and the [Filter & Sort] button shows a badge with the active filter count
6. GIVEN the Sort Tab WHEN rendered THEN the user can add priority-numbered sort rules with field selection, direction toggle (ASC/DESC), and drag reorder
7. GIVEN the ★ star icon in the app header WHEN clicked THEN a dropdown shows all favourite views from ALL data_views, grouped by `groupName` (e.g., "Invoices", "Sales", "CRM"). Clicking a favourite navigates to the entity list with the view applied
8. GIVEN a filter configuration WHEN included in a saved view (via E7.2) THEN the filters persist and re-apply when the view is loaded
9. GIVEN the LOV batch endpoint WHEN the filter modal opens THEN all VIEW_SPECIFIC LOVs are fetched in a single `POST /views/lov/batch` call. For LOVs with >50 items, search is server-side with debounce

**Key Tasks:**
- [ ] Build `<FilterAndSortModal>` with two tabs: Filters and Sort (Concept D styled, ~640px width)
- [ ] Build Simple Filter mode: vertical field list, searchable multi-select, LOV integration
- [ ] Build date filter component with preset dropdown + custom date picker fallback
- [ ] Build Advanced Filter mode: condition rows (field/operator/value), AND/OR toggle, group bracketing
- [ ] Build Sort Tab: priority-numbered rules, drag reorder, direction toggle
- [ ] Implement filter-to-query integration: convert UI filter state to API request parameters
- [ ] Build `<FavouritesDropdown>` for the app header (★ icon, grouped by groupName, navigate on click)
- [ ] Integrate LOV batch loading with React Query (lazy-load on modal open, cache results)
- [ ] Add active filter count badge to [Filter & Sort] button
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR86; NFR2 (CRUD <500ms)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | Filter bar in T1, filter-builder.ts |
| API Contracts | §2.3 Views, §3.13 | LOV batch, saved view conditions |
| Data Models | §3.1 System Module | SavedViewCondition, DateRangePreset |
| State Machines | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules | N/A | N/A |
| UX Design Spec | §T1 Entity List Template | Filter & Sort button, Simple + Advanced modes, header favourites |
| Project Context | §12 AI-First, §13 Metadata-Driven DataTable | LOV 3-tier strategy, date presets |

---

## AI Integration

### Tools Added (registered with AI Gateway)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `open_entity_list` | `viewKey: string`, `savedViewName?: string` | Navigate to an entity list page, optionally with a named saved view |
| `search_views` | `query: string` | Fuzzy-match user intent to saved view names, return matches with confidence scores |
| `apply_filter` | `viewKey: string`, `conditions: FilterCondition[]` | Apply ad-hoc filter conditions to a list page |
| `list_saved_views` | `viewKey?: string` | List available saved views (all scopes visible to user) |
| `create_saved_view` | `name: string`, `viewKey: string`, `conditions: FilterCondition[]`, `sortConfig: SortRule[]` | Create a new saved view from natural language |

### Context Injected into System Prompt

On each AI session, include:
- List of all `data_views` (viewKey + viewName) the user has access to
- User's saved views per data_view (names + group names)
- User's favourite views
- User's default views

### Example User Queries

| User Says | AI Action |
|-----------|-----------|
| "Show me all invoices" | `open_entity_list('INVOICES')` — opens with user's default view |
| "Open my overdue invoices view" | `search_views('overdue invoices')` → match → `open_entity_list('INVOICES', 'Overdue Invoices')` |
| "Filter invoices by this month" | `apply_filter('INVOICES', [{field: 'invoiceDate', operator: 'BETWEEN', datePreset: 'thismonth'}])` |
| "Show me all customers in London" | `apply_filter('CUSTOMERS', [{field: 'city', operator: 'EQUALS', value: 'London'}])` |
| "What views do I have for sales orders?" | `list_saved_views('SALES_ORDERS')` → present list to user |

### Fallback Behaviour

- **View not found:** Fuzzy match → if no match (score < 0.5), offer to create ad-hoc filter
- **Ambiguous match:** Present top 2-3 matches and ask user to choose
- **Entity not found:** Clarify which module/entity type the user means

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E7.1 | Database Schema & API Foundation | backlog |
| E7.2 | Column Customization & Views UI | backlog |
| E7.3 | Filter Builder & Favourites | backlog |

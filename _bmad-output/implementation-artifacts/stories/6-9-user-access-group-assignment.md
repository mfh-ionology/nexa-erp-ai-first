# Story 6.9: User Access Group Assignment

Status: ready-for-dev

## Story

As an **administrator**,
I want to view a list of users and assign one or more access groups to each user from their detail page,
so that users get the exact permissions their role requires.

## Acceptance Criteria

1. **GIVEN** an authenticated ADMIN user **WHEN** they navigate to `/system/users` **THEN** a T1 Entity List displays all users for the current company with columns: Name, Email, Role, Access Groups count, Status, Last Login — with cursor-based pagination and 300ms debounced search by name or email

2. **GIVEN** the user list **WHEN** a row is clicked **THEN** the app navigates to `/system/users/:id` showing a T2 Record Detail page with read-only user profile (name, email, role badge, status badge, last login) and an Access Groups assignment panel

3. **GIVEN** the user detail page **WHEN** the Access Groups panel loads **THEN** it fetches `GET /system/users/:id/access-groups` and displays each assigned group as a removable tag/chip showing group name, a "System" badge if `isSystem: true`, and a tooltip on hover showing `assignedBy` and `assignedAt` metadata

4. **GIVEN** the Access Groups panel **WHEN** the admin clicks "Add Access Group" **THEN** a Popover + Command (cmdk) combobox opens showing all active access groups from `GET /system/access-groups?isActive=true` filtered to exclude groups already assigned, with type-ahead search

5. **GIVEN** the combobox **WHEN** the admin selects a group **THEN** it appears immediately as a new tag in the assignment panel (optimistic local state, unsaved)

6. **GIVEN** an assigned group tag **WHEN** the admin clicks the remove (X) button **THEN** the tag is removed from local state immediately (optimistic, unsaved) and the Save button becomes enabled

7. **GIVEN** the admin has made changes to group assignments **WHEN** they click "Save Access Groups" **THEN** `PUT /system/users/:id/access-groups` is called with the full `accessGroupIds` array (replace-all semantics), on success a toast "Access groups updated successfully" appears, and the query cache is invalidated

8. **GIVEN** the admin tries to save with zero groups assigned **WHEN** the PUT request returns 422 BUSINESS_RULE_VIOLATION **THEN** an error toast displays "At least one access group is required" and the panel shows the validation message

9. **GIVEN** the Access Groups panel **WHEN** no groups are assigned **THEN** an empty state displays: "No access groups assigned. Add at least one group." with the "Add Access Group" combobox prominently shown and the Save button disabled

10. **GIVEN** the user list and detail pages **WHEN** rendered on phone (<768px) **THEN** the list shows card layout per user, the detail page stacks fields vertically, and the combobox opens as a full-width sheet — all touch targets are minimum 44x44px

## Tasks / Subtasks

- [ ] Task 1: Add user query keys and TypeScript types (AC: #1, #2)
  - [ ] 1.1: Add `users`, `usersInfinite`, `user`, `userAccessGroups` keys to `apps/web/src/lib/query-keys.ts`
  - [ ] 1.2: Create `apps/web/src/features/admin/users/api/types.ts` with `UserListItem`, `UserDetail`, `UserAccessGroupAssignment`, `AssignAccessGroupsRequest`, `UserListParams` interfaces matching API contracts

- [ ] Task 2: Create user API hooks (AC: #1, #2, #3, #7)
  - [ ] 2.1: Create `apps/web/src/features/admin/users/api/use-users.ts` with `useUsers()` infinite query hook (same pattern as `useAccessGroups` in `access-groups/api/use-access-groups.ts`)
  - [ ] 2.2: Create `apps/web/src/features/admin/users/api/use-user-detail.ts` with `useUser(id)` single query hook
  - [ ] 2.3: Create `apps/web/src/features/admin/users/api/use-user-access-groups.ts` with `useUserAccessGroups(userId)` query hook and `useAssignAccessGroups(userId)` mutation hook — mutation invalidates `userAccessGroups`, `user`, and `usersInfinite` query keys, shows success/error toasts via Sonner

- [ ] Task 3: Create User List Page (AC: #1, #10)
  - [ ] 3.1: Create `apps/web/src/features/admin/users/user-list-page.tsx` using `<EntityListPage>` template (same pattern as `access-group-list-page.tsx`)
  - [ ] 3.2: Configure columns: Name (sortable), Email (sortable), Role (Badge with semantic colour: SUPER_ADMIN=purple, ADMIN=blue, MANAGER=green, STAFF=default, VIEWER=secondary), Access Groups count (`tabular-nums`), Status (Badge: Active=green, Inactive=grey), Last Login (formatted date, "Never" if null)
  - [ ] 3.3: Wire 300ms debounced search, cursor pagination via `useUsers()`, row click navigates to `/system/users/:id`
  - [ ] 3.4: Set `canCreate={false}` (users created via auth registration), `batchActions={[]}` (no batch actions)

- [ ] Task 4: Create User Detail Page with Access Groups panel (AC: #2, #3, #6, #9)
  - [ ] 4.1: Create `apps/web/src/features/admin/users/user-detail-page.tsx` using `<PageHeader>` + read-only user profile Card (name as title, email, role badge, status badge, last login)
  - [ ] 4.2: Create `apps/web/src/features/admin/users/components/access-group-assignment-panel.tsx` as the primary editable section — manages local state array of assigned groups with dirty tracking
  - [ ] 4.3: Render each assigned group as a `<Badge variant="outline">` with group name, optional "System" sub-badge, X remove button (`aria-label="Remove {groupName}"`), and `<Tooltip>` on hover showing "Assigned by: {name}" and "Assigned: {date}"
  - [ ] 4.4: Show empty state when no groups: muted text + "Add at least one group" message

- [ ] Task 5: Create Access Group Combobox (AC: #4, #5, #10)
  - [ ] 5.1: Create `apps/web/src/features/admin/users/components/access-group-combobox.tsx` using Shadcn `<Popover>` + `<Command>` + `<CommandInput>` + `<CommandItem>` pattern
  - [ ] 5.2: Fetch available groups via `useAccessGroups({ isActive: true })` (reuse existing hook from `access-groups/api/use-access-groups.ts`), client-side filter to exclude already-assigned groups
  - [ ] 5.3: On select, add group to local state array, close popover
  - [ ] 5.4: Full keyboard support: Arrow Up/Down navigate, Enter selects, Escape closes; WAI-ARIA combobox attributes (`role="combobox"`, `aria-expanded`, `aria-controls`)

- [ ] Task 6: Implement Save mutation with error handling (AC: #7, #8)
  - [ ] 6.1: Wire "Save Access Groups" button in assignment panel — enabled only when dirty AND at least one group assigned, shows `<Loader2>` spinner while pending
  - [ ] 6.2: On click call `useAssignAccessGroups` mutation with full `accessGroupIds` array
  - [ ] 6.3: On success: toast `t('users.accessGroups.saveSuccess')`, reset dirty state, invalidate queries
  - [ ] 6.4: On 422 error: toast `t('users.accessGroups.minOneRequired')` — catch `ApiError` with statusCode 422
  - [ ] 6.5: On other errors: toast `t('errors:unexpected')`

- [ ] Task 7: Create TanStack Router route files (AC: #1, #2)
  - [ ] 7.1: Create `apps/web/src/routes/_authenticated/system/users.tsx` layout route (same pattern as `access-groups.tsx`)
  - [ ] 7.2: Create `apps/web/src/routes/_authenticated/system/users/index.tsx` rendering `<UserListPage>`
  - [ ] 7.3: Create `apps/web/src/routes/_authenticated/system/users/$id.tsx` rendering `<UserDetailPage id={id}>`

- [ ] Task 8: Add i18n translation keys (AC: all)
  - [ ] 8.1: Add user-related keys to `packages/i18n/locales/en/common.json`: `users.title`, `users.column.*`, `users.status.*`, `users.lastLogin.never`, `users.searchPlaceholder`, `users.detail.title`, `users.role.*`, `users.accessGroups.*` (title, addGroup, searchPlaceholder, assignedBy, assignedAt, emptyState, minOneRequired, save, saveSuccess, saveError, removeLabel)
  - [ ] 8.2: Add `"users": "Users"` to `packages/i18n/locales/en/navigation.json`

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1: Create `apps/web/src/features/admin/users/api/use-users.test.ts` — tests for `useUsers` hook (loading, data, pagination, search)
  - [ ] 9.2: Create `apps/web/src/features/admin/users/api/use-user-access-groups.test.ts` — tests for query + mutation (success, 422 error, cache invalidation)
  - [ ] 9.3: Create `apps/web/src/features/admin/users/user-list-page.test.tsx` — renders list, search filters, row click navigates, loading/empty states
  - [ ] 9.4: Create `apps/web/src/features/admin/users/user-detail-page.test.tsx` — renders profile, access group tags with tooltips, remove tag, save button states
  - [ ] 9.5: Create `apps/web/src/features/admin/users/components/access-group-combobox.test.tsx` — opens popover, filters assigned groups, selects group, keyboard navigation
  - [ ] 9.6: Create `apps/web/src/features/admin/users/components/access-group-assignment-panel.test.tsx` — empty state, dirty tracking, save success/error toasts

## Dev Notes

### Established Codebase Patterns (MUST follow)

**E6.8 Access Group pages set the authoritative pattern.** Copy these patterns exactly:

1. **API hooks:** Follow `access-groups/api/use-access-groups.ts` for infinite query and `use-access-group-mutations.ts` for mutations — use `apiGet`, `apiPut` from `@/lib/api-client`, `queryKeys` from `@/lib/query-keys`, `useAuthStore` for `isAuthenticated` gate
2. **List page:** Follow `access-group-list-page.tsx` — use `<EntityListPage>` template with `useMemo` for columns and breadcrumbs, `useState`/`useEffect` for 300ms debounced search, `useNavigate` for row clicks
3. **Detail page:** Follow `access-group-detail-page.tsx` — use `<PageHeader>` with breadcrumbs + status badge, `<Card>` for content sections, Sonner `toast` for success/error
4. **Route files:** Follow `system/access-groups/$id.tsx` — `createFileRoute`, extract params, pass to page component
5. **Types:** Follow `access-groups/api/types.ts` — interfaces matching API contract response shapes exactly
6. **Translations:** All user-facing text via `useI18n()` `t()` function, keys in `common.json`
7. **Error handling:** `ApiError` from `@nexa/api-client`, check `statusCode` for specific error codes (422 = business rule, 409 = conflict, 400 = validation)
8. **Query key factory:** ALL query keys MUST go through `apps/web/src/lib/query-keys.ts`

### File Structure

```
apps/web/src/features/admin/users/
├── api/
│   ├── types.ts                          # TypeScript interfaces
│   ├── use-users.ts                      # useUsers() infinite query
│   ├── use-users.test.ts
│   ├── use-user-detail.ts                # useUser(id) query
│   ├── use-user-access-groups.ts         # useUserAccessGroups + useAssignAccessGroups
│   └── use-user-access-groups.test.ts
├── components/
│   ├── access-group-assignment-panel.tsx  # Tags + combobox + save button
│   ├── access-group-assignment-panel.test.tsx
│   ├── access-group-combobox.tsx          # Popover + Command multi-select
│   └── access-group-combobox.test.tsx
├── user-list-page.tsx                    # T1 Entity List
├── user-list-page.test.tsx
├── user-detail-page.tsx                  # T2 Record Detail
└── user-detail-page.test.tsx

apps/web/src/routes/_authenticated/system/
├── users.tsx                             # Layout route
└── users/
    ├── index.tsx                          # List route
    └── $id.tsx                            # Detail route
```

### Shadcn UI Components to Use

| Component | Import | Usage |
|-----------|--------|-------|
| `Badge` | `@/components/ui/badge` | Role badges, status badges, group tags |
| `Button` | `@/components/ui/button` | Save, Add Group trigger, tag remove |
| `Card` | `@/components/ui/card` | Profile section, assignment panel |
| `Popover` | `@/components/ui/popover` | Combobox container |
| `Command` | `@/components/ui/command` | Searchable group list inside popover |
| `Tooltip` | `@/components/ui/tooltip` | Hover metadata on tags (assignedBy, assignedAt) |
| `Skeleton` | `@/components/ui/skeleton` | Loading states |
| `Input` | `@/components/ui/input` | Search fields |

Also reuse:
- `EntityListPage` from `@/components/templates/entity-list-page`
- `PageHeader` from `@/components/templates/page-header`
- `StatusBadge` from `@/components/erp/status-badge`
- `useBreakpoint` from `@/hooks/use-breakpoint`
- `useI18n`, `useFormatDate` from `@nexa/i18n`
- `apiGet`, `apiPut` from `@/lib/api-client`
- `ApiError` from `@nexa/api-client`

### API Endpoints (from API Contracts §3.12)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/system/users` | List users (cursor, limit, search, isActive) | ADMIN |
| `GET` | `/system/users/:id` | User detail | ADMIN |
| `GET` | `/system/users/:id/access-groups` | User's assigned groups for current company | ADMIN |
| `PUT` | `/system/users/:id/access-groups` | Replace-all group assignment (`{ accessGroupIds: string[] }`) | ADMIN |
| `GET` | `/system/access-groups` | List all groups for combobox dropdown | ADMIN |

**PUT response (200):**
```typescript
{
  success: true,
  data: {
    userId: string;
    companyId: string;
    accessGroups: Array<{
      id: string; code: string; name: string;
      assignedBy: string; assignedAt: string;
    }>;
  }
}
```

**PUT error (422):**
```typescript
{
  success: false,
  error: {
    code: "BUSINESS_RULE_VIOLATION",
    message: "At least one access group is required"
  }
}
```

### Cross-Cutting Patterns (MANDATORY)

- **companyId**: All API calls use company context from JWT/auth store — no manual companyId params needed on frontend (API client adds `X-Company-Id` header)
- **i18n**: ALL user-facing labels use translation keys via `t()` — no hardcoded strings
- **Permissions**: This page requires ADMIN role. The backend enforces this. Frontend should check `permissions.role` from auth store if hiding navigation items
- **Cache invalidation**: After `PUT /system/users/:id/access-groups`, server invalidates Redis cache `permissions:{userId}:{companyId}`. Frontend invalidates React Query cache for `userAccessGroups` and `usersInfinite` keys
- **Accessibility (NFR27/NFR28)**: WCAG 2.1 AA — all badge colours meet 4.5:1 contrast, tag remove buttons have `aria-label`, combobox follows WAI-ARIA pattern, all interactive elements reachable via Tab/Enter/Escape

### Business Rules (from Business Rules Compendium)

| Rule | Description | Enforcement |
|------|-------------|-------------|
| BR-RBAC-001 | Most-permissive-wins across all user access groups (OR logic) | Backend resolution — frontend just displays |
| BR-RBAC-002 | SUPER_ADMIN bypasses permission matrix entirely | Backend — frontend shows all for SUPER_ADMIN |
| BR-RBAC-008 | Only ADMIN/SUPER_ADMIN can manage access groups | Backend guard + frontend route protection |
| N/A | At least one access group required per user per company | Backend 422 + frontend validation (disable Save when 0 groups) |

### Events Emitted (from Event Catalog §20)

The **backend** emits these on successful PUT — frontend does NOT emit events directly:
- `user.accessGroups.assigned` — payload: `{ userId, companyId, groupIds, assignedBy }`
- `user.accessGroups.revoked` — payload: `{ userId, companyId, groupIds, revokedBy }`

These trigger permission cache invalidation and optional user notifications.

### State Machines

No state machine applies. User and AccessGroup are reference entities using `isActive: Boolean` soft-delete pattern, not lifecycle state machines.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §5 Frontend Architecture, §5.2 Component Architecture | React 19 + Vite, TanStack Query + Zustand, feature-based directory structure, `components/templates/` for T1/T2 |
| **API Contracts** | §3.12 Granular RBAC Endpoints | GET/PUT /system/users/:id/access-groups, GET /system/users list, replace-all semantics, 422 on zero groups |
| **State Machine** | §1 Common Patterns (reference entities) | User/AccessGroup use isActive soft-delete, no lifecycle state machine |
| **Event Catalog** | §20 Access Groups (RBAC) | `user.accessGroups.assigned/revoked` events, permission cache invalidation |
| **Data Models** | §3.1 System Module | User, UserAccessGroup (junction table), AccessGroup models; @@unique([userId, accessGroupId, companyId]) |
| **Business Rules** | §12b RBAC Rules | BR-RBAC-001 (most-permissive-wins), BR-RBAC-008 (ADMIN-only management), min 1 group per user |
| **Project Context** | §1 Multi-Company, §3 i18n | companyId scoping on all access groups, translation keys for all UI text |
| **UX Design Spec** | §Screen Templates (T1, T2), §Action Bar System, §Responsive Design | Entity list columns, record detail layout, tag/chip pattern, combobox pattern, 44px touch targets |

### Project Structure Notes

- New feature directory: `apps/web/src/features/admin/users/` — parallel to existing `features/admin/access-groups/` and `features/admin/resources/`
- Reuse `useAccessGroups` hook from `access-groups/api/use-access-groups.ts` for the combobox dropdown data (DO NOT duplicate)
- Reuse `AccessGroup` and `AccessGroupListParams` types from `access-groups/api/types.ts`
- Route layout file `system/users.tsx` follows same pattern as `system/access-groups.tsx`
- Add query keys to existing `query-keys.ts` (DO NOT create a separate query key file)

### Source References

- [Source: _bmad-output/planning-artifacts/api-contracts/3-detailed-endpoint-specifications.md#§3.12]
- [Source: _bmad-output/planning-artifacts/data-models/3-module-by-module-models.md#§3.1]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md#§12b]
- [Source: _bmad-output/planning-artifacts/event-catalog.md#§20]
- [Source: _bmad-output/planning-artifacts/state-machine-reference.md#§1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/standardised-screen-templates.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#§5]
- [Source: _bmad-output/planning-artifacts/project-context.md#§1-§3]
- [Source: _bmad-output/implementation-artifacts/epics/epic-E6.md#Story-E6.9]
- [Source: apps/web/src/features/admin/access-groups/ (E6.8 established patterns)]

## Dev Agent Record

### Agent Model Used



### Debug Log References

### Completion Notes List

### File List

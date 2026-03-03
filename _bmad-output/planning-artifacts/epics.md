---
stepsCompleted: ['step-01-validate-prerequisites-DONE', 'step-02-design-epics-DONE', 'step-03-create-stories-DONE', 'step-04-final-validation-DONE']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd/functional-requirements.md'
  - '_bmad-output/planning-artifacts/prd/non-functional-requirements.md'
  - '_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/standardised-screen-templates.md'
  - '_bmad-output/planning-artifacts/api-contracts/3-detailed-endpoint-specifications.md'
  - '_bmad-output/planning-artifacts/data-models/3-module-by-module-models.md'
  - '_bmad-output/planning-artifacts/data-models/4-enum-reference.md'
  - '_bmad-output/planning-artifacts/project-context.md'
  - 'docs/plans/2026-02-19-granular-rbac-access-groups-design.md'
  - 'docs/plans/2026-02-19-e2b-granular-rbac-implementation-plan.md'
---

# nexa-erp-ai-first - Epic Breakdown

## Overview

This document provides the epic and story breakdown for active epics. Currently tracking:
- **Epic E7: Saved Views / Filters / Columns** — Story E7.4 (Toolbar Redesign) is in backlog
- **Epic E2b: Granular RBAC & Access Groups** — All stories completed

**Context:** E2b replaces the fixed 5-level role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`) with custom Access Groups providing per-resource, per-action, per-field permissions. This is a foundational epic that all downstream business module epics (E14+) depend on.

## Requirements Inventory

### Functional Requirements

- FR81: Administrators can assign tenant-level roles (SUPER_ADMIN, ADMIN) for platform bypass and user/access-group management authority, and assign one or more access groups per user per company for granular page, action, and field permissions
- FR175: Administrators can create custom access groups with per-resource permissions (canAccess, canNew, canView, canEdit, canDelete) scoped to a company, and assign one or more access groups to each user per company
- FR176: Users can be assigned multiple access groups per company, with the effective permission set derived from the union of all assigned groups
- FR177: The system must resolve permissions using a most-permissive-wins strategy — when a user belongs to multiple access groups, each permission flag (canAccess, canNew, canView, canEdit, canDelete) is the logical OR across all groups, and SUPER_ADMIN bypasses the permission matrix entirely
- FR227: The system must maintain a Resource registry table as the single source of truth for all controllable pages, reports, settings, and maintenances, with each resource identified by a dot-notation code (e.g., `sales.orders.list`), module grouping, resource type (PAGE, REPORT, SETTING, MAINTENANCE), and sort order
- FR228: Administrators can configure field-level visibility overrides per access group per resource, with three states — VISIBLE, READ_ONLY, HIDDEN — where fields default to VISIBLE when no override exists, and the most-permissive-wins rule applies across groups (VISIBLE > READ_ONLY > HIDDEN)
- FR229: The system must ship pre-built access groups (Full Access, Finance Manager, Finance Clerk, Sales Manager, Sales Staff, Purchase Manager, Purchase Clerk, Warehouse Staff, HR Manager, HR Viewer, Report Viewer, Read Only) seeded on company creation, marked as system groups (cannot be deleted but can be modified and cloned by administrators)
- FR230: The system must support a default data file (JSON) for company creation that defines the resource registry, pre-built access groups with their permissions and field overrides, and other company defaults (VAT codes, payment terms, number series, currencies), with import/export endpoints for administrators to customise and share configurations
- FR231: Module access must be derived from access group permissions — a module is accessible to a user if any resource within that module has canAccess: true in any of the user's assigned access groups, replacing the previous per-user module toggle
- FR232: The existing UserRole enum (SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER) must be retained but its meaning narrowed: SUPER_ADMIN provides platform-level permission bypass, ADMIN grants user and access group management authority, and the remaining values (MANAGER, STAFF, VIEWER) are retained for backward compatibility but no longer drive page, action, or field permissions
- FR233: The system must cache resolved permissions per user per company (cache key: permissions:{userId}:{companyId}) with a 60-second TTL, invalidating the cache on access group edits, user-group assignment changes, or resource changes

### NonFunctional Requirements

- NFR2: Traditional CRUD operations must complete within 500ms for 95th percentile (permission resolution must stay within this budget)
- NFR8: All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- NFR9: Database-per-tenant architecture must provide complete isolation with zero cross-tenant access
- NFR12: All API endpoints authenticated and authorised against role and module access
- NFR41: All code written in TypeScript with strict mode
- NFR42: All coding performed exclusively using Claude Opus 4.6
- NFR43: Test coverage minimum 80% for business logic and financial calculation modules
- NFR44: Database schema changes managed through versioned migrations
- NFR45: All API endpoints documented with OpenAPI/Swagger specifications

### Additional Requirements

**From Architecture (§3b — Granular RBAC):**

- Permission cache must use Redis key `permissions:{userId}:{companyId}` with 60-second TTL, invalidated on access group edit, user group assignment change, or resource change
- `createPermissionGuard(resourceCode, action?)` Fastify preHandler replaces deprecated `createRbacGuard()`
- `filterFieldsByPermission(resourceCode)` Fastify onSend response hook strips HIDDEN fields from response JSON, adds `_fieldMeta` object with READ_ONLY markers
- Default data file located at `packages/db/default-data/company-defaults.json`
- Progressive module adoption pattern: each future module epic adds its resources to the Resource table, adds default permissions to company-defaults.json, uses createPermissionGuard() on all routes, defines field overrides for sensitive fields
- 12 pre-built access groups seeded via company-defaults.json (FULL_ACCESS, FINANCE_MANAGER, FINANCE_CLERK, SALES_MANAGER, SALES_STAFF, PURCHASE_MANAGER, PURCHASE_CLERK, WAREHOUSE_STAFF, HR_MANAGER, HR_VIEWER, REPORT_VIEWER, READ_ONLY)
- All pre-built groups marked `isSystem: true` (cannot be deleted, can be modified and cloned)

**From Data Models (§3.1):**

- 5 new database tables: Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup
- 2 new enums: ResourceType (PAGE, REPORT, SETTING, MAINTENANCE), FieldVisibility (VISIBLE, READ_ONLY, HIDDEN)
- Resource table: global (not company-scoped), unique code, module grouping, parent-child hierarchy (detail → list), sort order
- AccessGroup table: company-scoped, unique code per company, isSystem flag, isActive soft-delete
- AccessGroupPermission: compound unique on (accessGroupId, resourceCode), five boolean flags
- AccessGroupFieldOverride: compound unique on (accessGroupId, resourceCode, fieldPath), sparse table
- UserAccessGroup: many-to-many, compound unique on (userId, accessGroupId, companyId), assignedBy audit
- UserCompanyRole.role meaning narrows: SUPER_ADMIN = platform bypass, ADMIN = user/group management, others = backward compat only

**From API Contracts (§3.12):**

- GET /system/resources — list all resources (admin only), filterable by module, type, search, isActive
- GET /system/access-groups — list access groups for current company, cursor pagination, search/filter
- GET /system/access-groups/:id — detail with full permission matrix and field overrides, includes userCount
- POST /system/access-groups — create new access group (unique code per company)
- PATCH /system/access-groups/:id — update metadata (name, description), system groups can be modified
- DELETE /system/access-groups/:id — soft-delete (isActive=false), system groups cannot be deactivated
- PUT /system/access-groups/:id/permissions — replace-all permission matrix, invalidates cache
- PUT /system/access-groups/:id/field-overrides — replace-all field overrides, invalidates cache
- GET /system/users/:id/access-groups — get user's assigned groups for current company
- PUT /system/users/:id/access-groups — replace-all group assignment, at least one group required
- GET /system/my-permissions — current user's resolved permissions (frontend calls on login + company switch)
- GET /system/company-profile/export-defaults — export company config as JSON
- POST /system/company-profile/import-defaults — import/upsert default data, supports dryRun

**From UX Design Specification (Screen Templates):**

- T1 Entity List: `[+ New]` button hidden if user lacks `canNew` permission for the resource
- T1 Entity List: Batch Delete hidden if user lacks `canDelete` permission
- T7 Settings: Admin UI for access group management (permission matrix editor)
- All screen templates: field-level visibility must respect HIDDEN/READ_ONLY overrides from access groups
- Admin must be able to see and edit the permission matrix visually (checkbox grid per resource per action)

**From Previous E2b Implementation (commits — to be reverted):**

- 4 stories with 17 tasks were successfully implemented and tested (375 tests passed)
- Implementation covered: Prisma schema, default data JSON, data loader utility, seed script, permission cache, permission service, permission guard, field filter hook, resource routes, access group routes, user access group routes, my-permissions endpoint, export/import defaults endpoints, company creation seeding, route migration, enabledModules deprecation
- Key learnings: in-memory permission cache with Map works for MVP (Redis interface planned for scale), Fastify 5 requires getter/setter for reference-type request decorators, Zod `.default([])` makes arrays always truthy (no need for null checks)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR81 | E2b | Assign tenant-level roles + access groups per user per company |
| FR175 | E2b | Create custom access groups with per-resource permissions |
| FR176 | E2b | Multiple access groups per user, union of permissions |
| FR177 | E2b | Most-permissive-wins resolution, SUPER_ADMIN bypass |
| FR227 | E2b | Resource registry table with dot-notation codes |
| FR228 | E2b | Field-level visibility overrides (VISIBLE/READ_ONLY/HIDDEN) |
| FR229 | E2b | 12 pre-built access groups seeded on company creation |
| FR230 | E2b | Default data JSON file with import/export endpoints |
| FR231 | E2b | Module access derived from access group permissions |
| FR232 | E2b | UserRole enum retained, meaning narrowed |
| FR233 | E2b | Permission caching with 60s TTL, invalidation on changes |

## Epic List

### Epic E2b: Granular Permissions & Access Control

**User Outcome:** Administrators can create custom access groups with per-resource, per-action, and per-field permissions, assign multiple groups to users per company, and export/import permission configurations. Users experience permission-enforced access across all pages — buttons, actions, and fields are automatically shown/hidden based on their assigned access groups. The system ships with 12 pre-built access groups covering common ERP roles.

**Dependencies:** E2 (auth infrastructure, JWT, company context) — already completed.
**Dependents:** All business module epics (E14+) will use `createPermissionGuard()` and add resources to the registry.

**FRs covered:** FR81, FR175, FR176, FR177, FR227, FR228, FR229, FR230, FR231, FR232, FR233

## Epic E2b: Granular Permissions & Access Control

Administrators can create custom access groups with per-resource, per-action, and per-field permissions, assign multiple groups to users per company, and export/import permission configurations. Users experience permission-enforced access across all pages. The system ships with 12 pre-built access groups covering common ERP roles.

### Story E2b.1: Admin can view the system resource registry

As an **administrator**,
I want to view all controllable pages, reports, settings, and maintenances registered in the system,
So that I can understand what resources are available for permission configuration.

**FRs covered:** FR227

**Acceptance Criteria:**

**Given** an administrator is authenticated
**When** they request GET /system/resources
**Then** they receive a list of all resources with code, name, module, type, sortOrder, parentCode, and isActive
**And** resources can be filtered by module, type, search, and isActive

**Given** a new database is seeded
**When** the seed script runs
**Then** all resources defined in company-defaults.json are upserted into the Resource table
**And** each resource has a unique dot-notation code (e.g., `system.users.list`)

**Given** a non-admin user
**When** they request GET /system/resources
**Then** they receive a 403 Forbidden response

---

### Story E2b.2: Admin can create and configure access groups with permissions

As an **administrator**,
I want to create custom access groups and set per-resource permissions (canAccess, canNew, canView, canEdit, canDelete),
So that I can define granular roles tailored to my company's needs.

**FRs covered:** FR175, FR229

**Acceptance Criteria:**

**Given** an administrator is authenticated
**When** they POST /system/access-groups with code, name, description
**Then** a new access group is created for the current company
**And** the code is unique per company (409 if duplicate)

**Given** an access group exists
**When** the admin GETs /system/access-groups
**Then** they receive a paginated list of access groups for the current company with id, code, name, description, isSystem, isActive, userCount

**Given** an access group exists
**When** the admin GETs /system/access-groups/:id
**Then** they receive the full detail including permissions array and fieldOverrides array

**Given** an access group exists
**When** the admin PATCHes /system/access-groups/:id with name and/or description
**Then** the metadata is updated (system groups can have name/description modified)

**Given** an access group exists
**When** the admin PUTs /system/access-groups/:id/permissions with a permission array
**Then** all existing permissions are replaced with the provided set
**And** omitted resources have no permissions (all flags false)

**Given** a new company is created
**When** the company creation completes
**Then** 12 pre-built access groups are seeded (FULL_ACCESS, FINANCE_MANAGER, FINANCE_CLERK, SALES_MANAGER, SALES_STAFF, PURCHASE_MANAGER, PURCHASE_CLERK, WAREHOUSE_STAFF, HR_MANAGER, HR_VIEWER, REPORT_VIEWER, READ_ONLY)
**And** all are marked isSystem: true (cannot be deleted, can be modified)
**And** the creating user is assigned the FULL_ACCESS group

**Given** a system access group (isSystem: true)
**When** the admin attempts DELETE /system/access-groups/:id
**Then** they receive a 409 Conflict response

**Given** a custom access group with no active users
**When** the admin DELETEs /system/access-groups/:id
**Then** the group is soft-deleted (isActive set to false)

---

### Story E2b.3: Admin can assign access groups to users

As an **administrator**,
I want to assign one or more access groups to each user per company,
So that users get the exact permissions their role requires.

**FRs covered:** FR81, FR176

**Acceptance Criteria:**

**Given** an administrator is authenticated
**When** they GET /system/users/:id/access-groups
**Then** they receive the list of access groups assigned to that user for the current company
**And** each group includes id, code, name, assignedBy, and assignedAt

**Given** an administrator
**When** they PUT /system/users/:id/access-groups with an array of accessGroupIds
**Then** all current group assignments are replaced with the provided set
**And** the assignedBy field records who made the assignment

**Given** an administrator tries to assign zero access groups
**When** they PUT /system/users/:id/access-groups with an empty array
**Then** they receive a 422 Business Rule Violation (at least one group required)

**Given** an administrator provides an accessGroupId from a different company
**When** they PUT /system/users/:id/access-groups
**Then** they receive a 400 Validation Error

---

### Story E2b.4: System enforces granular permissions on all routes

As a **user**,
I want the system to enforce my access group permissions on every page and action,
So that I can only access what my groups allow, and administrators using SUPER_ADMIN bypass all checks.

**FRs covered:** FR177, FR231, FR232, FR233

**Acceptance Criteria:**

**Given** a user with multiple access groups where Group A has canView=true and Group B has canView=false for the same resource
**When** the system resolves permissions
**Then** the effective canView is true (most-permissive-wins / OR logic)

**Given** a SUPER_ADMIN user
**When** they access any protected route
**Then** they are always allowed (permission matrix bypassed entirely)

**Given** a user with no canAccess on a resource
**When** they request a route guarded by createPermissionGuard for that resource
**Then** they receive a 403 Forbidden

**Given** a user with canAccess=true but canNew=false
**When** they attempt a POST route guarded with action='new'
**Then** they receive a 403 Forbidden

**Given** any authenticated user
**When** they GET /system/my-permissions
**Then** they receive their resolved permissions, fieldOverrides, accessGroups, role, isSuperAdmin, and enabledModules
**And** enabledModules is derived from permissions (modules where any resource has canAccess=true)

**Given** resolved permissions are requested
**When** the permission cache has a valid entry (within 60s TTL)
**Then** the cached result is returned without DB query

**Given** an access group's permissions are modified
**When** the change is saved
**Then** the permission cache is invalidated for all affected users

**Given** all existing system routes (company-profile, users, company switch, resources, access-groups)
**When** the migration is complete
**Then** all routes use createPermissionGuard instead of the legacy createRbacGuard
**And** createRbacGuard is marked @deprecated but not deleted

**Given** the UserRole enum
**When** E2b is complete
**Then** SUPER_ADMIN provides platform-level permission bypass
**And** ADMIN grants user and access group management authority
**And** MANAGER, STAFF, VIEWER are retained for backward compatibility but no longer drive page/action permissions

---

### Story E2b.5: Admin can control field-level visibility per access group

As an **administrator**,
I want to configure which fields are visible, read-only, or hidden for each access group,
So that sensitive information like cost prices can be hidden from specific user groups.

**FRs covered:** FR228

**Acceptance Criteria:**

**Given** an administrator
**When** they PUT /system/access-groups/:id/field-overrides with field visibility rules
**Then** all existing overrides are replaced with the provided set

**Given** a user in multiple groups where Group A sets costPrice=HIDDEN and Group B sets costPrice=READ_ONLY
**When** the system resolves field visibility
**Then** the effective visibility is READ_ONLY (most-permissive-wins: VISIBLE > READ_ONLY > HIDDEN)

**Given** a field has no override for any of the user's groups
**When** the system resolves field visibility
**Then** the field defaults to VISIBLE

**Given** a SUPER_ADMIN user
**When** any response is processed through the field filter
**Then** no fields are hidden or marked read-only (full visibility)

**Given** a user with a HIDDEN field override for costPrice on a resource
**When** the API returns a response for that resource
**Then** the costPrice field is stripped from the response JSON

**Given** a user with a READ_ONLY field override
**When** the API returns the response
**Then** the field is present in the data and a `_fieldMeta` object marks it as readOnly

---

### Story E2b.6: Admin can export and import permission configurations

As an **administrator**,
I want to export my company's access group configuration as a JSON file and import it into other companies,
So that I can standardize permissions across multiple companies or share best-practice configurations.

**FRs covered:** FR230

**Acceptance Criteria:**

**Given** an administrator
**When** they GET /system/company-profile/export-defaults
**Then** they receive a JSON file containing the company's access groups, permissions, field overrides, and metadata (version, exportedAt, companyId)

**Given** an administrator with a valid defaults JSON file
**When** they POST /system/company-profile/import-defaults
**Then** existing access groups matched by code are updated, new ones are created
**And** the response shows counts of created/updated records

**Given** an administrator imports defaults
**When** an access group code already exists in the target company
**Then** its name and description are updated but its isSystem flag is preserved

**Given** an import modifies access group permissions
**When** the import completes
**Then** the permission cache is invalidated for all users in the company

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E2b.1 | Admin can view the system resource registry | done |
| E2b.2 | Admin can create and configure access groups with permissions | done |
| E2b.3 | Admin can assign access groups to users | done |
| E2b.4 | System enforces granular permissions on all routes | done |
| E2b.5 | Admin can control field-level visibility per access group | done |
| E2b.6 | Admin can export and import permission configurations | done |

All 11 FRs covered. All 6 stories completed. Backend API tests: 55/55 passed (100%).

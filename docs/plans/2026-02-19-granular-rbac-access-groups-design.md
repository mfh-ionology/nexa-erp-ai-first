# Granular RBAC & Access Groups — Design Document

**Date:** 2026-02-19
**Status:** Approved
**Epic:** E2b (new — inserted after E2, before E3)
**Author:** Mohammed (requirements) + Claude Opus 4.6 (design)

## Problem Statement

The current RBAC system uses a fixed 5-level role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`) with one role per user per company. This is insufficient for a production ERP where:

- Different users need different access to different pages/registers/reports
- Field-level visibility control is required (e.g., hide cost prices from sales staff)
- Actions (New, Edit, Delete, View) need independent per-page control
- Reports need individual access control
- Admins need to create custom roles without code changes

The previous ERP system (HansaWorld) had a granular AccessVc (Access Rights) register with per-item, per-action, per-field permissions. Nexa ERP needs equivalent granularity adapted for a modern web application.

## Design Decisions

1. **Multiple access groups per user** — users can be assigned 1+ access groups per company
2. **Conflict resolution: most permissive wins** — when two groups give different permissions for the same resource, the more permissive one applies
3. **Resource table** — single source of truth for all controllable pages, reports, settings, and maintenances
4. **Permission matrix** — per resource per group: `canAccess` (Yes/No), plus action flags: `canNew`, `canView`, `canEdit`, `canDelete`
5. **Field overrides** — sparse table with three states: `VISIBLE`, `READ_ONLY`, `HIDDEN`
6. **Default data file** — JSON file imported on company creation; editable without code changes; supports industry variants
7. **Pre-built access groups** — ship with sensible defaults (Full Access, Sales Manager, etc.), customisable by admins
8. **Reports treated as pages** — same permission model, no separate report permission type
9. **SUPER_ADMIN stays** as system-level bypass; existing `UserRole` narrows to admin privilege level
10. **Resource names** — every UI and AI interaction shows `resource.name` (human-readable) not `resource.code`

## Data Model

### New Tables

#### `Resource`

Registry of all controllable pages, reports, settings, and maintenances in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Primary key |
| code | String | UNIQUE, NOT NULL | Dot-notation key (e.g., `sales.orders.list`) |
| name | String | NOT NULL | Human-readable display name ("Sales Orders") |
| module | String | NOT NULL | Module grouping ("sales", "finance", "system") |
| type | ResourceType | NOT NULL | `PAGE`, `REPORT`, `SETTING`, `MAINTENANCE` |
| parentCode | String? | FK → Resource.code | Parent resource (detail → list) |
| sortOrder | Int | NOT NULL, default 0 | Display order in admin UI and navigation |
| icon | String? | | Icon key for navigation rendering |
| description | String? | | Help text for admin UI and AI context |
| isActive | Boolean | NOT NULL, default true | Soft-disable without deleting |
| createdAt | DateTime | NOT NULL, default now() | Audit |
| updatedAt | DateTime | NOT NULL, auto | Audit |

**Indexes:** `@@unique([code])`, index on `[module, sortOrder]`

#### `AccessGroup`

User-defined or system-seeded role definitions. Replaces the fixed `UserRole` enum for permission purposes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Primary key |
| companyId | UUID | FK → CompanyProfile.id, NOT NULL | Company scope |
| code | String | NOT NULL | Unique per company (e.g., "SALES_MGR") |
| name | String | NOT NULL | Display name ("Sales Manager") |
| description | String? | | Description of this group's purpose |
| isSystem | Boolean | NOT NULL, default false | Pre-built groups (can't be deleted, can be modified) |
| isActive | Boolean | NOT NULL, default true | Soft-delete |
| createdBy | String | NOT NULL | Audit |
| updatedBy | String | NOT NULL | Audit |
| createdAt | DateTime | NOT NULL, default now() | Audit |
| updatedAt | DateTime | NOT NULL, auto | Audit |

**Indexes:** `@@unique([companyId, code])`

#### `AccessGroupPermission`

The permission matrix — one row per resource per access group.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Primary key |
| accessGroupId | UUID | FK → AccessGroup.id, NOT NULL | Which access group |
| resourceCode | String | FK → Resource.code, NOT NULL | Which resource |
| canAccess | Boolean | NOT NULL, default false | Can the user see this page/resource? |
| canNew | Boolean | NOT NULL, default false | Can create new records |
| canView | Boolean | NOT NULL, default false | Can view/open existing records |
| canEdit | Boolean | NOT NULL, default false | Can modify existing records |
| canDelete | Boolean | NOT NULL, default false | Can delete records |
| createdAt | DateTime | NOT NULL, default now() | Audit |
| updatedAt | DateTime | NOT NULL, auto | Audit |

**Indexes:** `@@unique([accessGroupId, resourceCode])`

#### `AccessGroupFieldOverride`

Sparse field-level visibility overrides per access group per resource.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Primary key |
| accessGroupId | UUID | FK → AccessGroup.id, NOT NULL | Which access group |
| resourceCode | String | FK → Resource.code, NOT NULL | Which page/resource |
| fieldPath | String | NOT NULL | Field identifier (e.g., "costPrice") |
| visibility | FieldVisibility | NOT NULL | `VISIBLE`, `READ_ONLY`, `HIDDEN` |
| createdAt | DateTime | NOT NULL, default now() | Audit |
| updatedAt | DateTime | NOT NULL, auto | Audit |

**Indexes:** `@@unique([accessGroupId, resourceCode, fieldPath])`

#### `UserAccessGroup`

Many-to-many assignment of access groups to users, scoped per company.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Primary key |
| userId | UUID | FK → User.id, NOT NULL | Which user |
| accessGroupId | UUID | FK → AccessGroup.id, NOT NULL | Which access group |
| companyId | UUID | FK → CompanyProfile.id, NOT NULL | Which company context |
| assignedBy | String | NOT NULL | Who assigned this (audit) |
| createdAt | DateTime | NOT NULL, default now() | Audit |

**Indexes:** `@@unique([userId, accessGroupId, companyId])`

### New Enums

```prisma
enum ResourceType {
  PAGE
  REPORT
  SETTING
  MAINTENANCE

  @@map("resource_type")
}

enum FieldVisibility {
  VISIBLE
  READ_ONLY
  HIDDEN

  @@map("field_visibility")
}
```

### Modified Tables

#### `User` — remove `enabledModules`

The `enabledModules` JSON field is removed. Module access is now derived from the user's access group permissions (if any resource in a module has `canAccess: true`, the module is accessible).

#### `UserCompanyRole` — meaning narrows

The existing `UserRole` enum and `UserCompanyRole` table stay but their meaning narrows:

- `SUPER_ADMIN` — platform-level bypass (skips permission matrix entirely)
- `ADMIN` — can manage users, access groups, company settings
- Other values (`MANAGER`, `STAFF`, `VIEWER`) — retained for backward compatibility but no longer drive page/action permissions; those are now driven by `AccessGroup`

## Permission Resolution Algorithm

### Page/Action Check

```
function hasPermission(userId, companyId, resourceCode, action):
  1. If user has SUPER_ADMIN role → ALLOW (bypass)
  2. Get user's access groups: SELECT accessGroupId FROM UserAccessGroup
     WHERE userId = ? AND companyId = ?
  3. Get permissions: SELECT * FROM AccessGroupPermission
     WHERE accessGroupId IN (groups) AND resourceCode = ?
  4. Merge across groups — most permissive wins:
     canAccess = OR(all canAccess values)
     canNew    = OR(all canNew values)
     canView   = OR(all canView values)
     canEdit   = OR(all canEdit values)
     canDelete = OR(all canDelete values)
  5. If canAccess = false → DENY
  6. If action specified and corresponding flag = false → DENY
  7. → ALLOW
```

### Field Visibility Check

```
function getFieldVisibility(userId, companyId, resourceCode, fieldPath):
  1. If user has SUPER_ADMIN role → VISIBLE
  2. Get user's access groups for this company
  3. Get field overrides: SELECT visibility FROM AccessGroupFieldOverride
     WHERE accessGroupId IN (groups) AND resourceCode = ? AND fieldPath = ?
  4. If no overrides exist → VISIBLE (default)
  5. Merge: most permissive wins (VISIBLE > READ_ONLY > HIDDEN)
  6. Return merged visibility
```

### Caching

- Cache key: `permissions:{userId}:{companyId}`
- TTL: 60 seconds
- Invalidate on: access group edit, user group assignment change, resource change
- Storage: Redis (already in stack from E0)

## Middleware Architecture

### `createPermissionGuard(resourceCode, action?)`

Fastify `preHandler` hook that replaces `createRbacGuard()`.

```typescript
// Route example:
fastify.get('/sales/orders', {
  preHandler: createPermissionGuard('sales.orders.list', 'view')
}, handler);

fastify.post('/sales/orders', {
  preHandler: createPermissionGuard('sales.orders.list', 'new')
}, handler);

fastify.delete('/sales/orders/:id', {
  preHandler: createPermissionGuard('sales.orders.detail', 'delete')
}, handler);
```

### `filterFieldsByPermission(resourceCode)`

Response hook that processes outgoing data:

1. Loads `AccessGroupFieldOverride` entries for the user's groups
2. Merges visibility per field (most permissive wins)
3. Strips `HIDDEN` fields from response JSON
4. Adds `_fieldMeta` object to response with read-only markers for frontend

```json
{
  "data": { "orderNumber": "SO-00001", "customerName": "Acme Ltd", "totalExVat": 1500.00 },
  "_fieldMeta": { "totalExVat": "readOnly" }
}
```

## Default Data File

### Format

A JSON file at `packages/db/default-data/company-defaults.json`:

```json
{
  "version": "1.0.0",
  "description": "Nexa ERP Default Company Data — UK SME",
  "resources": [
    {
      "code": "system.users.list",
      "name": "Users",
      "module": "system",
      "type": "PAGE",
      "sortOrder": 100
    }
  ],
  "accessGroups": [
    {
      "code": "FULL_ACCESS",
      "name": "Full Access",
      "description": "Everything enabled — assigned to company creator",
      "isSystem": true,
      "permissions": [
        {
          "resourceCode": "system.users.list",
          "canAccess": true,
          "canNew": true,
          "canView": true,
          "canEdit": true,
          "canDelete": true
        }
      ],
      "fieldOverrides": []
    },
    {
      "code": "SALES_STAFF",
      "name": "Sales Staff",
      "description": "Create/view orders and quotes, no delete, no cost fields",
      "isSystem": true,
      "permissions": [
        {
          "resourceCode": "sales.orders.list",
          "canAccess": true,
          "canNew": true,
          "canView": true,
          "canEdit": true,
          "canDelete": false
        }
      ],
      "fieldOverrides": [
        {
          "resourceCode": "sales.orders.detail",
          "fieldPath": "costPrice",
          "visibility": "HIDDEN"
        },
        {
          "resourceCode": "sales.orders.detail",
          "fieldPath": "margin",
          "visibility": "HIDDEN"
        }
      ]
    }
  ],
  "vatCodes": [
    { "code": "S", "name": "Standard Rate", "rate": 20, "type": "STANDARD", "isDefault": true },
    { "code": "R", "name": "Reduced Rate", "rate": 5, "type": "REDUCED", "isDefault": false },
    { "code": "Z", "name": "Zero Rate", "rate": 0, "type": "ZERO", "isDefault": false },
    { "code": "E", "name": "Exempt", "rate": 0, "type": "EXEMPT", "isDefault": false },
    { "code": "RC", "name": "Reverse Charge", "rate": 0, "type": "REVERSE_CHARGE", "isDefault": false }
  ],
  "paymentTerms": [
    { "code": "NET30", "name": "Net 30", "dueDays": 30, "isDefault": true },
    { "code": "NET60", "name": "Net 60", "dueDays": 60, "isDefault": false },
    { "code": "DOR", "name": "Due on Receipt", "dueDays": 0, "isDefault": false },
    { "code": "NET14", "name": "Net 14", "dueDays": 14, "isDefault": false }
  ],
  "numberSeries": [
    { "entityType": "INVOICE", "prefix": "INV-", "padding": 5 },
    { "entityType": "CREDIT_NOTE", "prefix": "CN-", "padding": 5 },
    { "entityType": "SALES_ORDER", "prefix": "SO-", "padding": 5 },
    { "entityType": "SALES_QUOTE", "prefix": "QT-", "padding": 5 },
    { "entityType": "PURCHASE_ORDER", "prefix": "PO-", "padding": 5 },
    { "entityType": "BILL", "prefix": "BIL-", "padding": 5 },
    { "entityType": "JOURNAL", "prefix": "JE-", "padding": 5 },
    { "entityType": "PAYMENT", "prefix": "PAY-", "padding": 5 },
    { "entityType": "SHIPMENT", "prefix": "SHP-", "padding": 5 },
    { "entityType": "GOODS_RECEIPT", "prefix": "GRN-", "padding": 5 },
    { "entityType": "EMPLOYEE", "prefix": "EMP-", "padding": 4 },
    { "entityType": "CUSTOMER", "prefix": "CUS-", "padding": 5 },
    { "entityType": "SUPPLIER", "prefix": "SUP-", "padding": 5 }
  ],
  "currencies": [
    { "code": "GBP", "name": "British Pound Sterling", "symbol": "\u00a3", "minorUnit": 2 },
    { "code": "EUR", "name": "Euro", "symbol": "\u20ac", "minorUnit": 2 },
    { "code": "USD", "name": "US Dollar", "symbol": "$", "minorUnit": 2 }
  ]
}
```

### Import/Export Endpoints

- `POST /system/company-profile` — existing; now accepts optional `defaultDataFile` (multipart upload or inline JSON)
- `GET /system/company-profile/export-defaults` — exports current company's configuration as default data JSON
- `POST /system/company-profile/import-defaults` — imports default data into existing company (upsert)

### Shipped Default Files

| File | Description |
|------|-------------|
| `company-defaults.json` | Standard UK SME defaults |
| Future: `company-defaults-retail.json` | Retail-focused (POS, inventory emphasis) |
| Future: `company-defaults-manufacturing.json` | Manufacturing-focused (BOM, MRP emphasis) |

## Pre-built Access Groups

Shipped in `company-defaults.json`:

| Code | Name | Purpose |
|------|------|---------|
| `FULL_ACCESS` | Full Access | Everything enabled — auto-assigned to company creator |
| `FINANCE_MANAGER` | Finance Manager | Full GL, AR, AP, bank, reports. No HR/Manufacturing |
| `FINANCE_CLERK` | Finance Clerk | Create/view invoices, receipts, payments. No GL journals, no delete |
| `SALES_MANAGER` | Sales Manager | Full sales orders, quotes, customers, sales reports |
| `SALES_STAFF` | Sales Staff | Create/view orders and quotes. No delete, no cost price fields |
| `PURCHASE_MANAGER` | Purchase Manager | Full POs, suppliers, goods receipts |
| `PURCHASE_CLERK` | Purchase Clerk | Create/view POs. No delete, no supplier credit limit fields |
| `WAREHOUSE_STAFF` | Warehouse Staff | Goods receipt, stock takes, transfers. No pricing fields |
| `HR_MANAGER` | HR Manager | Full employee, payroll, leave management |
| `HR_VIEWER` | HR Viewer | View employee records, no salary fields |
| `REPORT_VIEWER` | Report Viewer | All reports read-only, no transactional pages |
| `READ_ONLY` | Read Only | View access to all pages, no create/edit/delete |

All seeded with `isSystem: true` (cannot be deleted, can be modified and cloned).

## Migration from Current E2

| Current | New | Action |
|---------|-----|--------|
| `UserRole` enum | Stays | Meaning narrows to admin privilege level |
| `UserCompanyRole` table | Stays | `SUPER_ADMIN` bypass + `ADMIN` for user management |
| `createRbacGuard()` | Deprecated | Replaced by `createPermissionGuard()` |
| `enabledModules` on User | Removed | Derived from access group permissions |
| No Resource table | `Resource` table | New — seeded per module epic |
| No field control | `AccessGroupFieldOverride` | New — sparse |

### Progressive Module Adoption

Each module epic (E14 Finance, E16 Sales, etc.) will:
1. Add its resources to the `Resource` table via Prisma migration
2. Add resources + default permissions to `company-defaults.json`
3. Use `createPermissionGuard()` on all routes
4. Define field overrides for sensitive fields in default access groups

## Epic Placement

**Epic E2b: Granular RBAC & Access Groups** — after E2, before E3.

**Dependencies:** E2 (auth infrastructure, JWT, company context)
**Dependents:** All business module epics (E14+)

# 1. Overview

This document defines every REST (and WebSocket) endpoint for the Nexa ERP platform. A developer agent should be able to implement any module's routes purely from this document combined with the Prisma schema in the corresponding architecture section.

## Base URL

```
https://{tenant-slug}.nexa-erp.com/api/v1
```

All paths below are relative to this base. Example: `/system/currencies` means `GET https://acme.nexa-erp.com/api/v1/system/currencies`.

## Authentication

Every request must include a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

The JWT payload carries `userId`, `tenantId`, and `role`. MFA (TOTP) is enforced on sensitive state transitions. Token refresh via `POST /auth/refresh`.

> **Note (E2b):** The JWT no longer carries `enabledModules[]`. Module access is now derived from the user's access group permissions via `GET /system/my-permissions`. The frontend should call this endpoint on login and cache the result.

## RBAC Roles (highest to lowest)

| Role | Scope | Capabilities |
|------|-------|-------------|
| `SUPER_ADMIN` | Platform | All operations across all tenants (bypasses permission matrix) |
| `ADMIN` | Tenant | User management, access group management, company settings |
| `MANAGER` | — | Retained for backward compatibility; page/action permissions now driven by Access Groups |
| `STAFF` | — | Retained for backward compatibility; page/action permissions now driven by Access Groups |
| `VIEWER` | — | Retained for backward compatibility; page/action permissions now driven by Access Groups |

> **Granular RBAC (E2b):** The `UserRole` hierarchy above is retained but its meaning has narrowed. `SUPER_ADMIN` provides a platform-level bypass of all permission checks. `ADMIN` is required for user and access-group management. For all other users, page-level access, action permissions (New/View/Edit/Delete), and field-level visibility are controlled by **Access Groups** — not by the role enum. See the Access Group Management API section in the endpoint summary.

## Permission Guard System

As of Epic E2b, route-level authorisation uses `createPermissionGuard(resourceCode, action?)` instead of the legacy `createRbacGuard(minRole)`. The permission guard:

1. Allows `SUPER_ADMIN` users unconditionally (bypass)
2. Resolves the user's access groups for the current company
3. Merges permissions across all assigned groups (most permissive wins)
4. Checks `canAccess` for the target resource, plus the specific action flag if provided
5. Returns `403 FORBIDDEN` if the permission check fails

Field-level visibility is enforced by a separate `filterFieldsByPermission(resourceCode)` response hook that strips `HIDDEN` fields and annotates `READ_ONLY` fields in a `_fieldMeta` response property.

Resolved permissions are cached in Redis (`permissions:{userId}:{companyId}`, TTL 60s) and invalidated on access group edits, user group assignment changes, and resource changes.

## Access Group Management API

Endpoints under `/system/access-groups` allow admins to create custom access groups, define per-resource permission matrices, and set field-level visibility overrides. Users can be assigned multiple access groups per company; conflicts resolve by most-permissive-wins. Pre-built system groups (Full Access, Sales Manager, Finance Clerk, etc.) are seeded from `company-defaults.json` on company creation and can be customised but not deleted.

The `/system/my-permissions` endpoint returns the current user's resolved permissions (merged across all their access groups) and is the primary endpoint the frontend uses for navigation rendering and UI element visibility.

## Response Envelope

**Success:**
```typescript
{
  success: true,
  data: T,
  meta?: { cursor?: string; hasMore?: boolean; total?: number }
}
```

**Error:**
```typescript
{
  success: false,
  error: {
    code: string,       // e.g. "VALIDATION_ERROR", "NOT_FOUND", "FORBIDDEN"
    message: string,    // Human-readable
    details?: Record<string, string[]>  // Field-level validation errors
  }
}
```

## Pagination

Cursor-based pagination on all list endpoints:

```
GET /api/v1/{module}/{entity}?cursor={lastId}&limit={10-100}&sort={field}&order={asc|desc}
```

Default `limit` = 20. Maximum `limit` = 100.

## Common Query Parameters (all list endpoints)

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | `string` | Cursor for pagination (last item ID) |
| `limit` | `number` | Items per page (default 20, max 100) |
| `sort` | `string` | Sort field name |
| `order` | `asc\|desc` | Sort direction (default `asc`) |
| `search` | `string` | Full-text search across key fields |
| `isActive` | `boolean` | Filter by active status (reference entities) |

## Data Conventions

| Type | Format | Example |
|------|--------|---------|
| Monetary amounts | `string` (Decimal 19,4) | `"1234.5600"` |
| Exchange rates | `string` (Decimal 18,8) | `"1.21340000"` |
| Quantities | `string` (Decimal 10,4) | `"100.0000"` |
| Percentages | `string` (Decimal 5,2) | `"20.00"` |
| Dates | ISO 8601 date | `"2026-02-16"` |
| Timestamps | ISO 8601 datetime | `"2026-02-16T09:30:00Z"` |
| IDs | UUID v4 | `"a1b2c3d4-e5f6-..."` |
| Enums | UPPER_SNAKE_CASE | `"DRAFT"`, `"POSTED"` |

## Common Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body or params failed Zod validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | User lacks required role/permission |
| 404 | `NOT_FOUND` | Entity does not exist |
| 409 | `CONFLICT` | State transition not allowed / duplicate |
| 422 | `BUSINESS_RULE_VIOLATION` | Domain rule violated (e.g. period locked) |
| 423 | `PERIOD_LOCKED` | Financial period is locked |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Standard CRUD Pattern

Most entities follow this pattern (deviations noted per endpoint):

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `GET` | `/{entity}` | List with pagination + filters | VIEWER |
| `POST` | `/{entity}` | Create new record | STAFF |
| `GET` | `/{entity}/:id` | Get by ID | VIEWER |
| `PATCH` | `/{entity}/:id` | Partial update | STAFF |
| `DELETE` | `/{entity}/:id` | Soft-delete / deactivate | MANAGER |

---

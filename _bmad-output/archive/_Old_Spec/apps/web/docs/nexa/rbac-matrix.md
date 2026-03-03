# RBAC Matrix — Nexa ERP (Task K)

Concise, implementation-aligned RBAC for Task K SUPER_ADMIN isolation.

## Roles and allowed surfaces

### SUPER_ADMIN (platform only)
- **Purpose**: Tenant provisioning, plan catalog, billing, security/monitoring, audits.
- **Can**: `/super-admin/**` (dashboard, tenants, plan catalog/billing, monitoring, AI oversight), system-level permissions (`system:*`, `billing:manage`).
- **Cannot**: All tenant business modules (`/finance`, `/inventory`, `/manufacturing`, `/hr`, `/sales`, `/crm`, `/purchasing`, `/supply`, `/projects`, `/pos`, `/costing`, `/healthcare`, `/ai/assistant`, `/ai/automation`) and tenant admin surfaces (`/admin/**`, `/settings/modules`).
- **Nav**: Shell renders SUPER_ADMIN console links only (no tenant modules).
- **Daily work**: Must not use SUPER_ADMIN for operational flows; use ADMIN/STAFF instead.

### ADMIN (per-tenant)
- **Purpose**: Day-to-day operations for their tenant.
- **Can**: Tenant business modules per RBAC + plan features; tenant user/config management where permitted (e.g. `/admin/users`, `/admin/plan-billing`).
- **Cannot**: `/super-admin/**`.

### STAFF (per-tenant)
- **Purpose**: Restricted operational work.
- **Can**: Allowed business modules per STAFF permissions.
- **Cannot**: `/super-admin/**`, tenant user/billing administration.

### MANAGER / VIEWER
- **MANAGER**: Elevated tenant operations per RBAC; no `/super-admin/**`.
- **VIEWER**: Read-only where permitted; no `/super-admin/**`.

## Plan & feature gating
- Plan templates drive `modules` feature flags used by Shell nav filtering and `requirePlanFeature`.
- User capacity enforced via `assertTenantUserCapacity`; ADMIN/SUPER_ADMIN user creation respects caps.

## Enforcement hooks (implemented)
- **Route/API guards**: `requireSuperAdminForPortal` protects `/super-admin/**`; business modules use `requireNotSuperAdmin` / permission checks that deny SUPER_ADMIN.
- **Navigation**: `buildNav` in `apps/web/src/components/layout/Shell.tsx` shows only SUPER_ADMIN console links for SUPER_ADMIN; tenant nav for others.
- **Dashboards**: Revalidation keeps SUPER_ADMIN and tenant dashboards fresh on billing/user updates.

## Business modules denied to SUPER_ADMIN
`/finance`, `/inventory`, `/manufacturing`, `/hr`, `/sales`, `/crm`, `/purchasing`, `/supply`, `/projects`, `/pos`, `/costing`, `/healthcare`, `/ai/assistant`, `/ai/automation` (and equivalent child routes/APIs).

## Testing references
- SUPER_ADMIN isolation and billing/plan flows: `apps/web/src/tests/super-admin/*.test.ts`, `apps/web/src/tests/dashboard/super-admin-dashboard-propagation.test.ts`.
- Plan/catalog/billing helpers: `apps/web/src/tests/billing/*.test.ts`.


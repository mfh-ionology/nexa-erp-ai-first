# 21. Platform Admin API — Admin-Facing Endpoints

> **Base URL:** `https://admin.nexa-erp.com/api/v1`
>
> These endpoints are consumed by the Platform Admin Portal (Super Admin UI). Authenticated via platform-level JWT + MFA. Only accessible to PLATFORM_ADMIN and PLATFORM_VIEWER roles.

## 21.1 Tenant Management

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/tenants` | List all tenants with status, plan, usage summary | PLATFORM_VIEWER+ | FR194 |
| `GET` | `/admin/tenants/:id` | Full tenant detail with diagnostics | PLATFORM_VIEWER+ | FR194 |
| `POST` | `/admin/tenants` | Create new tenant | PLATFORM_ADMIN | FR193 |
| `PATCH` | `/admin/tenants/:id` | Update tenant settings (display name, region, etc.) | PLATFORM_ADMIN | FR193 |
| `POST` | `/admin/tenants/:id/suspend` | Suspend tenant | PLATFORM_ADMIN | FR193 |
| `POST` | `/admin/tenants/:id/reactivate` | Reactivate suspended tenant | PLATFORM_ADMIN | FR193 |
| `POST` | `/admin/tenants/:id/archive` | Soft-delete/archive tenant | PLATFORM_ADMIN | FR193 |
| `PUT` | `/admin/tenants/:id/modules` | Set per-tenant module overrides | PLATFORM_ADMIN | FR195 |
| `PUT` | `/admin/tenants/:id/feature-flags` | Set per-tenant feature flags | PLATFORM_ADMIN | FR195 |
| `POST` | `/admin/tenants/:id/rotate-secrets` | Rotate API keys and webhook secrets | PLATFORM_ADMIN | FR196 |

## 21.2 Tenant User Management (read + controlled actions)

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/tenants/:id/users` | List tenant users and roles | PLATFORM_VIEWER+ | FR198 |
| `POST` | `/admin/tenants/:id/users/:userId/force-password-reset` | Force password reset | PLATFORM_ADMIN | FR196 |
| `POST` | `/admin/tenants/:id/users/:userId/reset-mfa` | Reset user MFA | PLATFORM_ADMIN | FR198 |
| `POST` | `/admin/tenants/:id/users/:userId/lock` | Lock user account | PLATFORM_ADMIN | FR198 |
| `POST` | `/admin/tenants/:id/users/:userId/revoke-sessions` | Revoke all active sessions | PLATFORM_ADMIN | FR198 |

## 21.3 Impersonation

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `POST` | `/admin/tenants/:id/impersonate` | Start impersonation session (requires reason, time limit) | PLATFORM_ADMIN | FR199 |
| `POST` | `/admin/impersonation-sessions/:sessionId/end` | End active impersonation session | PLATFORM_ADMIN | FR200 |
| `GET` | `/admin/impersonation-sessions` | List all impersonation sessions (audit) | PLATFORM_VIEWER+ | FR200 |

## 21.4 Plans & Billing

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/plans` | List all plans | PLATFORM_VIEWER+ | FR201 |
| `POST` | `/admin/plans` | Create new plan | PLATFORM_ADMIN | FR201 |
| `PATCH` | `/admin/plans/:id` | Update plan limits/modules | PLATFORM_ADMIN | FR201 |
| `POST` | `/admin/tenants/:id/assign-plan` | Assign/change tenant plan | PLATFORM_ADMIN | FR201 |
| `GET` | `/admin/tenants/:id/billing` | Tenant billing status and history | PLATFORM_VIEWER+ | FR202 |
| `PATCH` | `/admin/tenants/:id/billing/enforcement` | Set enforcement controls (grace period, read-only, suspend) | PLATFORM_ADMIN | FR203 |

## 21.5 AI Usage & Quotas

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/tenants/:id/ai/usage` | Per-tenant AI usage dashboard data | PLATFORM_VIEWER+ | FR207 |
| `GET` | `/admin/tenants/:id/ai/usage/by-feature` | Usage breakdown by ERP feature | PLATFORM_VIEWER+ | FR207 |
| `GET` | `/admin/tenants/:id/ai/quota` | Current quota settings and usage percentage | PLATFORM_VIEWER+ | FR208 |
| `PATCH` | `/admin/tenants/:id/ai/quota` | Update quota settings (allowance, soft/hard limits) | PLATFORM_ADMIN | FR208 |
| `GET` | `/admin/ai/usage/export` | CSV export of AI usage across all tenants | PLATFORM_ADMIN | FR210 |
| `GET` | `/admin/ai/alerts` | Active AI quota alerts and spike flags | PLATFORM_VIEWER+ | FR209 |

## 21.6 Platform Monitoring

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/monitoring/health` | Platform health overview | PLATFORM_VIEWER+ | FR211 |
| `GET` | `/admin/monitoring/errors` | Error aggregation (top issues, affected tenants) | PLATFORM_VIEWER+ | FR211 |
| `GET` | `/admin/monitoring/jobs` | Background job queue status | PLATFORM_VIEWER+ | FR212 |
| `POST` | `/admin/monitoring/jobs/:jobId/retry` | Re-run failed job | PLATFORM_ADMIN | FR212 |
| `POST` | `/admin/monitoring/maintenance-mode` | Toggle maintenance mode | PLATFORM_ADMIN | FR213 |

## 21.7 Audit & Compliance

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/audit-log` | Platform audit log with filtering | PLATFORM_VIEWER+ | FR214 |
| `GET` | `/admin/audit-log/data-access` | Data access log (who viewed what) | PLATFORM_ADMIN | FR216 |
| `POST` | `/admin/tenants/:id/gdpr/export` | Trigger DSAR data export | PLATFORM_ADMIN | FR215 |
| `POST` | `/admin/tenants/:id/gdpr/anonymise` | Anonymise tenant data | PLATFORM_ADMIN | FR215 |

## 21.8 Support Console

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/admin/support/search` | Search tenants by domain, name, email, ID | PLATFORM_VIEWER+ | FR217 |
| `GET` | `/admin/tenants/:id/diagnostics` | Tenant diagnostics (auth, webhooks, email, integrations) | PLATFORM_VIEWER+ | FR217 |
| `POST` | `/admin/tenants/:id/runbook/reindex` | Rebuild tenant DB indexes | PLATFORM_ADMIN | FR218 |
| `POST` | `/admin/tenants/:id/runbook/rotate-tokens` | Rotate integration tokens | PLATFORM_ADMIN | FR218 |
| `POST` | `/admin/tenants/:id/runbook/resync/:integrationId` | Trigger integration re-sync | PLATFORM_ADMIN | FR218 |

## 21.9 Platform Auth

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `POST` | `/admin/auth/login` | Platform admin login | Public | FR197 |
| `POST` | `/admin/auth/mfa/verify` | MFA verification | Partial | FR197 |
| `POST` | `/admin/auth/refresh` | Refresh platform JWT | Platform JWT | FR197 |
| `GET` | `/admin/users` | List platform admin accounts | PLATFORM_ADMIN | FR197 |
| `POST` | `/admin/users` | Create platform admin account | PLATFORM_ADMIN | FR197 |
| `PATCH` | `/admin/users/:id` | Update platform admin (role, MFA, active) | PLATFORM_ADMIN | FR197 |

---

*End of API Contracts Reference*

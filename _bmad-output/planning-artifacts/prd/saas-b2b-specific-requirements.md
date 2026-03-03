# SaaS B2B Specific Requirements

## Project-Type Overview

Nexa ERP is a cloud-native, multi-tenant SaaS B2B product targeting UK SMEs (10-250 employees). It combines traditional ERP functionality with an AI-first interaction paradigm. The SaaS delivery model means the vendor handles infrastructure, updates, and operations — customers consume the service.

## Tenant Model

**Architecture: Database-per-tenant, zero shared ERP state**

- Each customer gets their own PostgreSQL database with the full ERP schema
- NO `tenant_id` column in any ERP table — complete isolation by design
- Connection routing at application/infrastructure layer: request → resolve tenant → connect to correct database
- Schema migrations applied per-tenant (rolling deployment pattern)
- Tenant provisioning: create database, apply migrations, seed default data (chart of accounts template, default settings)

**Platform Database (MVP — required for operations):**
- Separate platform-level database for tenant management, billing, AI usage metering, and operational control
- Stores: tenant metadata, subscription plans, billing status, AI token usage/quotas, feature flags, module entitlements, platform audit logs, super admin accounts
- Required from day one — even for dogfooding, the AI Gateway needs quota tracking and the platform needs operational control
- The Platform Admin portal (Super Admin) is a separate application that reads/writes this database
- ERP tenant databases connect to the Platform via internal API for entitlement checks, AI quota enforcement, and status queries

**MVP Simplification:**
- Single tenant in the platform database (founding company)
- Platform Admin portal with core operational features (tenant status, AI usage dashboard, basic billing)
- Full tenant provisioning automation deferred to Phase 2 commercialisation
- AI Gateway service operational from day one for all AI calls

## RBAC Matrix

### Platform-Level Roles (Fixed)

| Role | Scope | Capabilities |
|------|-------|-------------|
| PLATFORM_ADMIN | Platform-level (vendor only) | Full Super Admin portal access: tenant lifecycle, billing, AI quotas, impersonation, platform monitoring, compliance tooling. MFA mandatory. All actions audit-logged. |
| PLATFORM_VIEWER | Platform-level (vendor only) | Read-only Super Admin portal access: view tenant status, billing, AI usage dashboards. No lifecycle actions. |

### Tenant-Level Roles (UserRole enum — narrowed scope)

| Role | Scope | Purpose |
|------|-------|---------|
| SUPER_ADMIN | Tenant-level | Platform-level permission bypass — skips the access group permission matrix entirely |
| ADMIN | Tenant-level | User management, access group management, company settings, integrations, audit. Page/action/field permissions still governed by access groups |

> **Note:** The `MANAGER`, `STAFF`, and `VIEWER` values are retained in the `UserRole` enum for backward compatibility but **no longer drive page, action, or field permissions**. All granular permissions are now controlled by **Access Groups** (see below).

### Access Groups (Granular Permission Model)

Access groups replace the fixed role hierarchy for all page-level, action-level, and field-level permissions. Each access group defines a permission matrix: per resource (page, report, setting, maintenance), per action (canAccess, canNew, canView, canEdit, canDelete), with optional field-level visibility overrides (VISIBLE, READ_ONLY, HIDDEN).

Users can be assigned **multiple access groups per company**. Permission resolution uses **most-permissive-wins** across all assigned groups.

**Pre-built Access Group Templates** (seeded on company creation, customisable by admins):

| Access Group | Purpose |
|--------------|---------|
| Full Access | Everything enabled — auto-assigned to company creator |
| Finance Manager | Full GL, AR, AP, bank, reports. No HR/Manufacturing |
| Finance Clerk | Create/view invoices, receipts, payments. No GL journals, no delete |
| Sales Manager | Full sales orders, quotes, customers, sales reports |
| Sales Staff | Create/view orders and quotes. No delete, no cost price fields |
| Purchase Manager | Full POs, suppliers, goods receipts |
| Purchase Clerk | Create/view POs. No delete, no supplier credit limit fields |
| Warehouse Staff | Goods receipt, stock takes, transfers. No pricing fields |
| HR Manager | Full employee, payroll, leave management |
| HR Viewer | View employee records, no salary fields |
| Report Viewer | All reports read-only, no transactional pages |
| Read Only | View access to all pages, no create/edit/delete |

**Module Gating:**
- Module access is **derived from access group permissions** — a module is accessible if any resource within it has `canAccess: true` in any of the user's assigned access groups
- No separate module toggle per user — module visibility is a natural consequence of the permission matrix
- Module toggles per tenant (plan-level entitlements from Platform API) still apply — disabled modules are invisible regardless of access group permissions
- Feature flags for progressive rollout

**External Roles (Post-MVP):**
- EXTERNAL_ACCOUNTANT — Scoped access groups limited to Finance modules, with journal posting requiring internal approval
- API_CONSUMER — Programmatic access via API keys, scoped to specific endpoints

## Subscription Tiers

Plan definitions are stored in the Platform database and enforced via the Platform API. The ERP queries entitlements at login and caches them with short TTL.

| Tier | Target | Modules | Users | AI Token Allowance | AI Features |
|------|--------|---------|-------|--------------------|-------------|
| Core | 1-10 employees | Finance, Invoicing, basic CRM | 3 | 500K tokens/month | Basic AI (record creation, queries) |
| Pro | 10-50 employees | All core modules | 15 | 2M tokens/month | Full AI (briefings, forecasting, all modules) |
| Enterprise | 50-250 employees | All modules + Manufacturing | Unlimited | 10M tokens/month | Full AI + custom integrations + priority support |

**Enforcement:** Plan limits (user seats, modules, AI tokens) are enforced by the Platform API. The ERP calls `GET /platform/tenants/:id/entitlements` at login and caches the response. The AI Gateway calls `POST /platform/tenants/:id/ai/check` before every AI request.

## Integration Architecture

| Pattern | Use Case | Implementation |
|---------|----------|---------------|
| REST API (outbound) | HMRC MTD, payroll API, bank feeds, Companies House | HTTP client with retry, circuit breaker, credential vault |
| Webhooks (inbound) | Bank feed notifications, payment confirmations | Webhook receiver with signature verification, idempotency |
| File exchange | BACS payments, bank statement import, report export | File generation/parsing services |
| OAuth 2.0 flows | Bank connections, HMRC Government Gateway | Token management with refresh, per-tenant credential storage |
| Email (SMTP/IMAP) | Invoice delivery, bill ingestion via OCR | Email service with attachment handling |

**Integration management:**
- Per-tenant integration credentials (encrypted, never shared)
- Integration health monitoring and alerting
- Sync status dashboard for admin
- Retry and dead-letter queue for failed integrations

## SaaS Compliance Additions

- **SOC 2 Type II** target for commercialisation
- **Data residency** — UK data centres for all tenant databases
- **Right to data portability** — full export in CSV/JSON per GDPR Article 20
- **Right to erasure** — complete tenant deletion capability
- **Breach notification** — 72-hour process per GDPR Article 33
- **Sub-processor management** — documented third-party service list

## Implementation Considerations

**Deployment:**
- Containerised (Docker/Kubernetes), CI/CD with automated testing
- Blue/green or canary deployment for zero-downtime updates
- Per-tenant migration scheduling

**Monitoring:**
- Per-tenant health metrics (response time, error rate, storage)
- AI layer monitoring (latency, accuracy, token usage, cost per tenant)
- Integration health per tenant, alerting thresholds

**Onboarding:**
- Guided setup wizard: company details → chart of accounts → bank connection → first invoice
- Data import: customers, suppliers, items, opening balances (CSV)
- "Magic moment" within 5 minutes of first login

# Epic E13b: Platform Admin Portal

**Tier:** 1 | **Dependencies:** E3b (Platform API + AI Gateway), E6 (Frontend Shell) | **FRs:** FR193-FR222 | **NFRs:** NFR46-NFR51

---

## Story E13b.S1: Platform Admin App Shell

**User Story:** As a platform administrator, I want a separate React application with dark sidebar navigation and platform-level authentication, so that I can manage tenants, billing, and AI usage from a dedicated control plane.

**Acceptance Criteria:**
1. GIVEN the `apps/platform-admin` package WHEN built THEN it produces a separate Vite + React + TypeScript application distinct from the tenant ERP
2. GIVEN the platform admin app WHEN the sidebar renders THEN it uses a dark theme with "PLATFORM ADMIN" branding to visually distinguish from the tenant ERP
3. GIVEN the navigation WHEN it renders THEN it shows: Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings
4. GIVEN an unauthenticated platform user WHEN they access the app THEN they are presented with a login page requiring platform credentials + MFA
5. GIVEN a PLATFORM_VIEWER user WHEN they navigate THEN write actions (suspend, impersonate, etc.) are hidden or disabled

**Key Tasks:**
- [ ] Scaffold `apps/platform-admin` as separate Vite + React app (AC: #1)
  - [ ] Share design system packages (shadcn/ui, Tailwind config)
  - [ ] Use `packages/api-client` configured for Platform Admin API base URL
  - [ ] Separate auth flow from tenant ERP
- [ ] Build dark sidebar navigation (AC: #2, #3)
  - [ ] Dark background (slate-900) with purple accent
  - [ ] "PLATFORM ADMIN" branding header
  - [ ] Navigation items: Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings
- [ ] Implement platform authentication flow (AC: #4)
  - [ ] `POST /admin/auth/login` — platform credentials
  - [ ] `POST /admin/auth/mfa/verify` — MFA challenge (mandatory for PLATFORM_ADMIN)
  - [ ] JWT storage and refresh for platform session
- [ ] Implement RBAC for PLATFORM_ADMIN vs PLATFORM_VIEWER (AC: #5)
  - [ ] PLATFORM_VIEWER: read-only access to dashboards and lists
  - [ ] PLATFORM_ADMIN: full access including write operations
  - [ ] Hide/disable actions based on role

**FR/NFR:** FR193, FR197; NFR46, NFR48

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Separate app, platform auth, PLATFORM_ADMIN/PLATFORM_VIEWER roles |
| API Contracts | §21 Platform Admin API, §21.9 Platform Auth | POST /admin/auth/login, POST /admin/auth/mfa/verify, GET /admin/users |
| Data Models | §5 Platform Database Models | PlatformUser: email, role (PlatformRole enum), mfaEnabled |
| State Machines | N/A | N/A — no state machine for app shell |
| Event Catalog | §19 Platform Admin Events | Platform events emitted by admin actions |
| Business Rules | §14b Platform Admin Rules | BR-PLT-018 (MFA mandatory for PLATFORM_ADMIN) |
| UX Design Spec | §Platform Admin Portal | Dark sidebar, separate app, PLATFORM ADMIN branding, navigation structure |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications |

---

## Story E13b.S2: Tenant Management Dashboard

**User Story:** As a platform administrator, I want to view all tenants in a list with status indicators, drill into tenant details, and perform lifecycle actions (activate, suspend, archive), so that I can manage the tenant fleet.

**Acceptance Criteria:**
1. GIVEN the Tenants page WHEN it loads THEN a T1 Entity List shows all tenants with columns: name, code, plan, status (colour-coded badge), billing status, last activity, user count
2. GIVEN a tenant row WHEN clicked THEN a T2 Record Detail page shows tabbed detail: Overview, Modules & Flags, Users, AI Usage, Billing, Diagnostics, Audit
3. GIVEN an ACTIVE tenant WHEN the admin clicks "Suspend" THEN a confirmation dialog requires a reason, and on confirm the tenant is suspended and the ERP webhook fires within 30 seconds
4. GIVEN a SUSPENDED tenant WHEN the admin clicks "Reactivate" THEN the tenant returns to ACTIVE status and the ERP entitlement cache is busted
5. GIVEN the Modules & Flags tab WHEN the admin toggles a module override or feature flag THEN the change takes effect immediately via webhook

**Key Tasks:**
- [ ] Build tenant list page using T1 Entity List template (AC: #1)
  - [ ] Columns: displayName, code, planCode, status (StatusBadge), billingStatus, lastActivityAt, userCount
  - [ ] Status colour coding: ACTIVE=green, SUSPENDED=red, READ_ONLY=amber, ARCHIVED=grey
  - [ ] Filters: status, plan, billing status
- [ ] Build tenant detail page using T2 Record Detail template (AC: #2)
  - [ ] Overview tab: status, plan, billing, creation date, region, sandbox flag
  - [ ] Modules & Flags tab: module override toggles, feature flag toggles
  - [ ] Users tab: tenant user list (read-only) with action buttons
  - [ ] AI Usage tab: usage chart, quota settings
  - [ ] Billing tab: subscription status, payment history, enforcement controls
  - [ ] Diagnostics tab: auth health, webhook status, integration status
  - [ ] Audit tab: platform actions for this tenant
- [ ] Implement lifecycle action buttons with confirmation (AC: #3, #4)
  - [ ] Suspend: requires reason text, calls `POST /admin/tenants/:id/suspend`
  - [ ] Reactivate: calls `POST /admin/tenants/:id/reactivate`
  - [ ] Archive: calls `POST /admin/tenants/:id/archive`, confirm irreversibility
- [ ] Implement module override and feature flag management (AC: #5)
  - [ ] `PUT /admin/tenants/:id/modules` — set module overrides
  - [ ] `PUT /admin/tenants/:id/feature-flags` — set feature flags

**FR/NFR:** FR193, FR194, FR195; NFR46, NFR51

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Tenant lifecycle, module overrides, feature flags |
| API Contracts | §21.1 Tenant Management | GET/POST/PATCH /admin/tenants, suspend, reactivate, archive, module/flag endpoints |
| Data Models | §5 Platform Database Models | Tenant, TenantModuleOverride, TenantFeatureFlag |
| State Machines | §20.1 Tenant Lifecycle | PROVISIONING -> ACTIVE -> SUSPENDED -> ARCHIVED |
| Event Catalog | §19 Platform Admin Events | `tenant.suspended`, `tenant.reactivated`, `tenant.archived`, `tenant.modules_changed` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-001 (strict state machine), BR-PLT-002 (30s effect), BR-PLT-003 (archive irrecoverable) |
| UX Design Spec | §Platform Admin Portal | Tenant list (T1), tenant detail (T2, tabbed), status indicators |
| Project Context | §8b Platform Layer Architecture | Webhook cache invalidation, Platform Client SDK |

---

## Story E13b.S3: Billing Dashboard

**User Story:** As a platform administrator, I want an overview of payment status across all tenants with dunning level tracking and enforcement action controls, so that I can manage billing health and take action on delinquent accounts.

**Acceptance Criteria:**
1. GIVEN the Billing page WHEN it loads THEN a dashboard shows: total active tenants, payment status breakdown (current/grace/overdue/blocked), revenue summary, and enforcement action distribution
2. GIVEN a tenant with overdue billing WHEN the admin views the tenant's billing tab THEN they see dunning level (0-3), grace period remaining, last payment date, and enforcement action
3. GIVEN billing enforcement controls WHEN the admin changes enforcement from WARNING to READ_ONLY THEN the ERP webhook fires and the tenant enters read-only mode
4. GIVEN a plan change workflow WHEN the admin assigns a new plan THEN module entitlements and limits update immediately via webhook

**Key Tasks:**
- [ ] Build billing overview dashboard using T8 Report template (AC: #1)
  - [ ] KPI cards: active tenants, current/grace/overdue/blocked counts
  - [ ] Revenue chart (monthly)
  - [ ] Enforcement action distribution pie chart
- [ ] Build per-tenant billing detail in tenant detail Billing tab (AC: #2)
  - [ ] Dunning level display with escalation timeline
  - [ ] Grace period countdown
  - [ ] Payment history list
- [ ] Implement enforcement control actions (AC: #3)
  - [ ] `PATCH /admin/tenants/:id/billing/enforcement`
  - [ ] Confirmation dialog with consequence description
- [ ] Implement plan change workflow (AC: #4)
  - [ ] `POST /admin/tenants/:id/assign-plan`
  - [ ] Plan selector with comparison view (old vs new limits)

**FR/NFR:** FR201, FR202, FR203; NFR46

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Billing enforcement, plan management |
| API Contracts | §21.4 Plans & Billing | GET /admin/plans, POST /admin/tenants/:id/assign-plan, PATCH /admin/tenants/:id/billing/enforcement |
| Data Models | §5 Platform Database Models | TenantBilling: dunningLevel, enforcementAction; Plan: maxUsers, enabledModules |
| State Machines | §20.2 Billing Enforcement Lifecycle | NONE -> WARNING -> READ_ONLY -> SUSPENDED |
| Event Catalog | §19 Platform Admin Events | `billing.enforcement_changed`, `tenant.plan_changed` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-004 (escalation), BR-PLT-005 (READ_ONLY blocks writes), BR-PLT-006 (plan change immediate) |
| UX Design Spec | §Platform Admin Portal | Billing overview section, enforcement indicators |
| Project Context | §8b Platform Layer Architecture | Webhook-based enforcement propagation |

---

## Story E13b.S4: AI Usage Dashboard

**User Story:** As a platform administrator, I want AI usage charts (daily/weekly/monthly), quota alerts, spike detection, and per-tenant usage breakdowns, so that I can monitor AI costs and identify anomalies.

**Acceptance Criteria:**
1. GIVEN the AI Usage page WHEN it loads THEN it shows cross-tenant usage summary: total tokens today, this month, cost estimate, and trend chart
2. GIVEN per-tenant AI usage WHEN the admin drills into a tenant THEN they see usage by feature (chat, document processing, forecasting), by provider (Anthropic, OpenAI, etc.), daily trend (30-day), quota progress bar, and BYOK vs vendor key breakdown
3. GIVEN quota alerts WHEN a tenant crosses the soft limit (80%) THEN an alert appears in the alerts list with tenant name, usage percentage, and timestamp
4. GIVEN spike detection WHEN a tenant's daily usage exceeds 3x their 7-day rolling average THEN an anomaly alert is flagged for investigation
5. GIVEN the AI Usage page WHEN the admin clicks "Export CSV" THEN a CSV file downloads with per-tenant, per-day usage data
6. GIVEN the Platform Admin AI settings page WHEN the admin views provider configuration THEN they see vendor-level API keys per provider (masked), active/inactive status, and can update keys
7. GIVEN an Enterprise tier tenant WHEN the admin views the tenant's AI configuration THEN they see any BYOK API keys configured per provider (masked), active/inactive status, and usage split between BYOK and vendor keys

**Key Tasks:**
- [ ] Build cross-tenant AI usage dashboard (T8 Report template) (AC: #1)
  - [ ] KPI cards: total tokens today, month, cost estimate
  - [ ] Time series chart: daily usage across all tenants
  - [ ] Top consumers table
- [ ] Build per-tenant AI usage view (AC: #2)
  - [ ] Usage by feature pie/bar chart
  - [ ] Daily trend line chart (30 days)
  - [ ] Quota progress bar with soft/hard limit indicators
  - [ ] Quota settings editor
- [ ] Build alerts view (AC: #3, #4)
  - [ ] `GET /admin/ai/alerts` — list active alerts
  - [ ] Alert types: quota_warning, quota_exceeded, usage_spike
  - [ ] Acknowledge/dismiss actions
- [ ] Implement CSV export (AC: #5)
  - [ ] `GET /admin/ai/usage/export` — CSV download
- [ ] Build provider management settings (AC: #6)
  - [ ] Vendor-level API key management per provider (masked display, update)
  - [ ] Provider active/inactive toggles
- [ ] Build tenant BYOK management view (AC: #7)
  - [ ] Per-tenant BYOK key list (masked), add/remove/activate/deactivate
  - [ ] BYOK vs vendor usage split chart

**FR/NFR:** FR205-FR210, FR224 (BYOK), FR226 (provider management dashboards); NFR46, NFR50

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | AI usage tracking, quota management |
| API Contracts | §21.5 AI Usage & Quotas | GET /admin/tenants/:id/ai/usage, /ai/usage/by-feature, /ai/quota, GET /admin/ai/alerts, /ai/usage/export |
| Data Models | §5 Platform Database Models | TenantAiUsage (append-only), TenantAiQuota (softLimitPct, hardLimitPct) |
| State Machines | §20.3 AI Quota State | Runtime states: NORMAL -> SOFT_WARNING -> HARD_LIMIT -> BLOCKED |
| Event Catalog | §19 Platform Admin Events | `tenant.quota_warning`, `tenant.quota_exceeded` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-007 (AI Gateway mandatory), BR-PLT-008 (quota check), BR-PLT-009 (durable records), BR-PLT-010 (threshold alerts), BR-PLT-011 (spike detection 3x rolling avg) |
| UX Design Spec | §Platform Admin Portal, Key UX Patterns | AI Usage dashboard wireframe, quota progress bar, feature breakdown |
| Project Context | §8b Platform Layer Architecture | AI Gateway, quota check flow, usage recording |

---

## Story E13b.S5: Impersonation & Support Console

**User Story:** As a platform administrator, I want to impersonate a tenant for support purposes with mandatory reason, time limit, non-dismissable banner, and full action audit, so that I can troubleshoot issues while maintaining security and accountability.

**Acceptance Criteria:**
1. GIVEN the admin clicks "Impersonate" on a tenant WHEN a dialog appears THEN they must provide a text reason (mandatory) and the session has a configurable time limit (default 60 minutes)
2. GIVEN an impersonation session starts WHEN the admin is redirected to the tenant's ERP THEN a permanent non-dismissable amber banner shows: admin identity, tenant name, session expiry countdown, and "End Session" button
3. GIVEN an active impersonation session WHEN the session timer expires THEN the session auto-terminates and the admin is returned to the platform admin portal
4. GIVEN every action during impersonation WHEN it executes THEN it is logged in both the platform audit log and the tenant's audit log with `impersonatedBy` metadata
5. GIVEN the Support Console WHEN the admin searches THEN they can find tenants by domain, name, email, or ID

**Key Tasks:**
- [ ] Implement impersonation start flow (AC: #1)
  - [ ] `POST /admin/tenants/:id/impersonate` — requires reason, returns session token
  - [ ] Validate reason is non-empty (BR-PLT-012)
  - [ ] Create ImpersonationSession record with expiresAt
- [ ] Implement impersonation banner in ERP frontend (AC: #2)
  - [ ] Detect impersonation token in auth context
  - [ ] Render non-dismissable `bg-amber-500` banner at top of viewport
  - [ ] Show: admin email, tenant name, countdown timer, "End Session" button
- [ ] Implement session termination (AC: #3)
  - [ ] `POST /admin/impersonation-sessions/:sessionId/end` — manual end
  - [ ] BullMQ scheduled check for expired sessions (auto-terminate)
  - [ ] Redirect to platform admin portal on end
- [ ] Implement dual audit logging during impersonation (AC: #4)
  - [ ] Platform audit: `platform.impersonation_started`, `platform.impersonation_ended`
  - [ ] Tenant audit: all actions carry `impersonatedBy` field
  - [ ] Record actionsLog in ImpersonationSession
- [ ] Build Support Console search page (AC: #5)
  - [ ] `GET /admin/support/search` — search by domain, name, email, ID
  - [ ] Results show tenant summary with quick-action buttons

**FR/NFR:** FR199, FR200, FR217, FR218; NFR46, NFR49

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Impersonation sessions, support console |
| API Contracts | §21.3 Impersonation, §21.8 Support Console | POST /admin/tenants/:id/impersonate, POST /admin/impersonation-sessions/:id/end, GET /admin/support/search |
| Data Models | §5 Platform Database Models | ImpersonationSession: reason, startedAt, endedAt, expiresAt, actionsLog |
| State Machines | N/A | Session active/ended (time-limited) |
| Event Catalog | §19 Platform Admin Events | `platform.impersonation_started`, `platform.impersonation_ended` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-012 (mandatory reason), BR-PLT-013 (time-limited), BR-PLT-014 (non-dismissable banner), BR-PLT-015 (dual audit log) |
| UX Design Spec | §Platform Admin Portal, Key UX Patterns | Impersonation banner wireframe (amber, non-dismissable), Support Console layout, Runbook Actions |
| Project Context | §8b Platform Layer Architecture | Impersonation always time-limited and audited |

---

## Story E13b.S6: Platform Audit Log Viewer

**User Story:** As a platform administrator, I want to search and filter the immutable platform audit log by action, target, user, and date range, with detail view and CSV export, so that I can investigate incidents and demonstrate compliance.

**Acceptance Criteria:**
1. GIVEN the Audit Log page WHEN it loads THEN a T1 Entity List shows audit records with columns: timestamp, admin user, action, target type, target name, IP address
2. GIVEN the audit log WHEN the admin filters by action type (e.g., "tenant.suspend") THEN only matching records are shown
3. GIVEN the audit log WHEN the admin filters by date range THEN only records within that range are shown
4. GIVEN an audit log entry WHEN clicked THEN a detail view shows the full action details JSON, before/after state (if applicable), user agent, and IP address
5. GIVEN the audit log WHEN the admin clicks "Export CSV" THEN a CSV file downloads with the filtered records

**Key Tasks:**
- [ ] Build audit log list page using T1 Entity List template (AC: #1)
  - [ ] Columns: timestamp, platformUser.displayName, action, targetType, targetId, ipAddress
  - [ ] Sorted by timestamp DESC (newest first)
  - [ ] Cursor-based pagination for large datasets
- [ ] Implement filter controls (AC: #2, #3)
  - [ ] Action type filter (dropdown with known actions)
  - [ ] Target type filter (tenant, plan, platform_user)
  - [ ] Date range picker
  - [ ] Platform user filter
- [ ] Build audit log detail view (AC: #4)
  - [ ] Modal or side panel with full details
  - [ ] JSON viewer for `details` field
  - [ ] Display ipAddress and userAgent
- [ ] Implement CSV export (AC: #5)
  - [ ] Export filtered results as CSV download
  - [ ] Include all fields in export

**FR/NFR:** FR214; NFR46, NFR49

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Immutable platform audit log |
| API Contracts | §21.7 Audit & Compliance | GET /admin/audit-log with filtering |
| Data Models | §5 Platform Database Models | PlatformAuditLog: platformUserId, action, targetType, targetId, details (JSONB), ipAddress, userAgent, timestamp |
| State Machines | N/A | N/A — append-only log, no state transitions |
| Event Catalog | §19 Platform Admin Events | All platform events produce audit log entries |
| Business Rules | §14b Platform Admin Rules | BR-PLT-016 (immutable log), BR-PLT-017 (every state-changing action logged) |
| UX Design Spec | §Platform Admin Portal | Audit Log in navigation, T1 Entity List template |
| Project Context | §8b Platform Layer Architecture | Platform audit log append-only, no update/delete |
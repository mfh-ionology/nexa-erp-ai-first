# Nexa ERP — Project Context

> Architectural decisions, cross-cutting patterns, and conventions that ALL agents (SM, DEV, TEA) must follow. This document supplements the Architecture — read this FIRST before implementing any story.

## 1. Multi-Company Architecture

### Decision: companyId on EVERY table from Day 1

Every database table has a `companyId` foreign key. This includes transactional tables (invoices, journals, POs) AND master data (customers, items, suppliers).

```prisma
model Company {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id") // the database-per-tenant context
  name          String
  legalName     String   @map("legal_name")
  registrationNo String? @map("registration_no")
  vatNumber     String?  @map("vat_number")
  baseCurrency  String   @default("GBP") @map("base_currency") @db.VarChar(3)
  isDefault     Boolean  @default(false) @map("is_default") // the "main" company
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("companies")
}
```

### Query Pattern

Every repository method MUST scope queries by company:

```typescript
// CORRECT — always scope by companyId
const invoices = await prisma.customerInvoice.findMany({
  where: { companyId: ctx.companyId, status: 'POSTED' },
});

// WRONG — never query without companyId
const invoices = await prisma.customerInvoice.findMany({
  where: { status: 'POSTED' },
});
```

The `ctx.companyId` comes from the company-context middleware (set via company-switching API or session default).

### Register Sharing

Some tenants want to share master data (Customers, Items) between companies. This is configurable per entity type, per company pair:

```prisma
model RegisterSharingRule {
  id              String       @id @default(uuid())
  entityType      String       @map("entity_type")     // 'Customer', 'Item', 'Supplier', 'ChartOfAccount'
  sharingMode     SharingMode  @map("sharing_mode")
  sourceCompanyId String       @map("source_company_id")
  targetCompanyId String?      @map("target_company_id") // null if ALL_COMPANIES

  sourceCompany   Company      @relation("SharingSource", fields: [sourceCompanyId], references: [id])
  targetCompany   Company?     @relation("SharingTarget", fields: [targetCompanyId], references: [id])

  @@map("register_sharing_rules")
  @@unique([entityType, sourceCompanyId, targetCompanyId], map: "uq_sharing_rule")
}

enum SharingMode {
  NONE             // Default — company-only access
  ALL_COMPANIES    // Visible to all companies in tenant
  SELECTED         // Visible only to specified target company
}
```

**Query with sharing:**

```typescript
// PrismaClient is accepted as a parameter for dependency injection (testability).
// Implemented in packages/db/src/utils/sharing.ts, exported from @nexa/db.
async function getVisibleCompanyIds(
  prisma: PrismaClient,
  companyId: string,
  entityType: string,
): Promise<string[]> {
  // NONE rules are excluded — sharingMode NONE means no sharing
  const rules = await prisma.registerSharingRule.findMany({
    where: {
      sharingMode: { not: 'NONE' },
      OR: [
        { sourceCompanyId: companyId, entityType },
        { targetCompanyId: companyId, entityType },
        { sharingMode: 'ALL_COMPANIES', entityType },
      ],
    },
  });

  const ids = new Set([companyId]);
  let fetchedAllCompanies = false;
  for (const rule of rules) {
    if (rule.sharingMode === 'ALL_COMPANIES') {
      if (!fetchedAllCompanies) {
        const allCompanies = await prisma.companyProfile.findMany({ select: { id: true } });
        allCompanies.forEach(c => ids.add(c.id));
        fetchedAllCompanies = true;
      }
    } else {
      ids.add(rule.sourceCompanyId);
      if (rule.targetCompanyId) ids.add(rule.targetCompanyId);
    }
  }
  return Array.from(ids);
}
```

## 2. RBAC: Access Groups + Resource Permission Matrix

### Decision: Granular permissions via access groups (replaces fixed role hierarchy)

The original 5-level role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`) was insufficient for production ERP needs. The new model provides per-resource, per-action, per-field permissions via custom **access groups**. Designed in Epic E2b. See full design: `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`.

### Key Concepts

- **Resource** — single registry of all controllable pages, reports, settings, and maintenances. Each resource has a dot-notation `code` (e.g., `sales.orders.list`), a human-readable `name`, and a `module` grouping. Resource names (not codes) are shown in all UI and AI interactions.
- **AccessGroup** — a named, company-scoped collection of permissions (e.g., "Sales Manager", "Finance Clerk"). Replaces fixed roles for permission purposes. Admins create custom groups without code changes.
- **Permission Matrix** — per resource per access group: `canAccess` (gate), `canNew`, `canView`, `canEdit`, `canDelete` (action flags).
- **Field Overrides** — sparse table with three states: `VISIBLE`, `READ_ONLY`, `HIDDEN`. Default when no override exists: `VISIBLE`.
- **Multiple groups per user** — a user can be assigned 1+ access groups per company. Conflict resolution: **most permissive wins** (OR across all groups).
- **SUPER_ADMIN** — system-level bypass; skips the permission matrix entirely.
- **UserCompanyRole** — meaning narrows to admin privilege level only (`SUPER_ADMIN`, `ADMIN`). `MANAGER`/`STAFF`/`VIEWER` retained for backward compat but no longer drive page/action permissions.
- **Default data file** — JSON file (`packages/db/default-data/company-defaults.json`) imported on company creation; contains resources, pre-built access groups with permissions and field overrides, plus VAT codes, payment terms, number series, currencies. Editable without code changes; supports industry variants.
- **Resource registry drives navigation, permissions, and AI context** — the Resource table is the single source of truth for what appears in the sidebar, what the permission guard checks, and what the AI assistant knows about available functionality.

### Prisma Schema (Key Tables)

```prisma
model Resource {
  id          String       @id @default(uuid())
  code        String       @unique                       // "sales.orders.list"
  name        String                                     // "Sales Orders"
  module      String                                     // "sales"
  type        ResourceType                               // PAGE, REPORT, SETTING, MAINTENANCE
  parentCode  String?      @map("parent_code")           // detail → list
  sortOrder   Int          @default(0) @map("sort_order")
  icon        String?
  description String?
  isActive    Boolean      @default(true) @map("is_active")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@map("resources")
  @@index([module, sortOrder], map: "idx_resources_module_sort")
}

model AccessGroup {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  code        String                                     // "SALES_MGR" — unique per company
  name        String                                     // "Sales Manager"
  description String?
  isSystem    Boolean  @default(false) @map("is_system") // pre-built, can't delete
  isActive    Boolean  @default(true) @map("is_active")
  createdBy   String   @map("created_by")
  updatedBy   String   @map("updated_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company     Company  @relation(fields: [companyId], references: [id])
  permissions AccessGroupPermission[]
  fieldOverrides AccessGroupFieldOverride[]
  users       UserAccessGroup[]

  @@map("access_groups")
  @@unique([companyId, code], map: "uq_access_group_company_code")
}

model AccessGroupPermission {
  id            String      @id @default(uuid())
  accessGroupId String      @map("access_group_id")
  resourceCode  String      @map("resource_code")
  canAccess     Boolean     @default(false) @map("can_access")
  canNew        Boolean     @default(false) @map("can_new")
  canView       Boolean     @default(false) @map("can_view")
  canEdit       Boolean     @default(false) @map("can_edit")
  canDelete     Boolean     @default(false) @map("can_delete")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  accessGroup   AccessGroup @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)

  @@map("access_group_permissions")
  @@unique([accessGroupId, resourceCode], map: "uq_agp_group_resource")
}

model AccessGroupFieldOverride {
  id            String          @id @default(uuid())
  accessGroupId String          @map("access_group_id")
  resourceCode  String          @map("resource_code")
  fieldPath     String          @map("field_path")         // "costPrice"
  visibility    FieldVisibility                             // VISIBLE, READ_ONLY, HIDDEN

  accessGroup   AccessGroup     @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)

  @@map("access_group_field_overrides")
  @@unique([accessGroupId, resourceCode, fieldPath], map: "uq_agfo_group_resource_field")
}

model UserAccessGroup {
  id            String      @id @default(uuid())
  userId        String      @map("user_id")
  accessGroupId String      @map("access_group_id")
  companyId     String      @map("company_id")
  assignedBy    String      @map("assigned_by")
  createdAt     DateTime    @default(now()) @map("created_at")

  user          User        @relation(fields: [userId], references: [id])
  accessGroup   AccessGroup @relation(fields: [accessGroupId], references: [id])
  company       Company     @relation(fields: [companyId], references: [id])

  @@map("user_access_groups")
  @@unique([userId, accessGroupId, companyId], map: "uq_uag_user_group_company")
}

model UserCompanyRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  companyId String?  @map("company_id")  // NULL = global role
  role      UserRole                     // SUPER_ADMIN or ADMIN (others retained but no longer drive permissions)

  user      User     @relation(fields: [userId], references: [id])
  company   Company? @relation(fields: [companyId], references: [id])

  @@map("user_company_roles")
  @@unique([userId, companyId], map: "uq_user_company_role")
}

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

### Permission Resolution Order

1. **SUPER_ADMIN bypass** — if user has `SUPER_ADMIN` in `UserCompanyRole`, allow everything (skip matrix)
2. **Resolve access groups** — `SELECT accessGroupId FROM UserAccessGroup WHERE userId = ? AND companyId = ?`
3. **Merge permissions (most permissive wins)** — OR across all groups: `canAccess = OR(all), canNew = OR(all), canView = OR(all), canEdit = OR(all), canDelete = OR(all)`
4. **Check resource + action** — if `canAccess = false` → deny; if specific action flag = false → deny; otherwise → allow
5. **Field visibility** — merge field overrides across groups (most permissive wins: `VISIBLE > READ_ONLY > HIDDEN`); default when no override exists: `VISIBLE`

### Caching

- Cache key: `permissions:{userId}:{companyId}`
- TTL: 60 seconds
- Invalidate on: access group edit, user group assignment change, resource change
- Storage: Redis (already in stack from E0)

### Module Access Derivation

Module-level navigation visibility is derived from access group permissions: if **any** resource in a module has `canAccess = true` for the user, that module's nav item is shown. The `enabledModules` JSON field on User is removed.

### Pre-built Access Groups (Shipped Defaults)

| Code | Name | Purpose |
|------|------|---------|
| `FULL_ACCESS` | Full Access | Everything enabled — auto-assigned to company creator |
| `FINANCE_MANAGER` | Finance Manager | Full GL, AR, AP, bank, reports. No HR/Manufacturing |
| `SALES_MANAGER` | Sales Manager | Full sales orders, quotes, customers, sales reports |
| `SALES_STAFF` | Sales Staff | Create/view orders and quotes. No delete, no cost price fields |
| `READ_ONLY` | Read Only | View access to all pages, no create/edit/delete |
| (+ 7 more) | See design doc | Finance Clerk, Purchase Manager/Clerk, Warehouse Staff, HR Manager/Viewer, Report Viewer |

All seeded with `isSystem: true` (cannot be deleted, can be modified and cloned).

### Middleware

- `createPermissionGuard(resourceCode, action?)` — Fastify `preHandler` hook replacing `createRbacGuard()`. Checks resource + action via the resolution algorithm above.
- `filterFieldsByPermission(resourceCode)` — response hook that strips `HIDDEN` fields and adds `_fieldMeta` for `READ_ONLY` markers.

### Progressive Module Adoption

Each module epic (E14 Finance, E16 Sales, etc.) will:
1. Add its resources to the `Resource` table via Prisma migration
2. Add resources + default permissions to `company-defaults.json`
3. Use `createPermissionGuard()` on all routes
4. Define field overrides for sensitive fields in default access groups

### Example

Mohammed has the "Full Access" group in most companies + the "Read Only" group in Company 3 → full permissions everywhere except Company 3 (view-only there).

## 3. i18n / Localization Infrastructure

### Decision: Translation key system from Day 1

All user-facing text (labels, messages, placeholders, validation errors, system messages) must use translation keys, not hardcoded strings.

**Pattern:**

```typescript
// CORRECT — use translation key
t('invoice.status.posted')
t('validation.required', { field: t('field.customerName') })

// WRONG — hardcoded string
'Posted'
'Customer Name is required'
```

**Implementation:**
- Translation files stored per locale: `locales/en.json`, `locales/fr.json`, etc.
- Default locale: `en` (English-first for UK MVP)
- User selects language in profile settings
- Company can set default language
- Fallback chain: user language → company language → `en`
- Number/date/currency formatting via `Intl` API based on locale

**Scope for MVP:** English only, but ALL strings go through the translation system so adding languages later requires zero code changes — only new translation files.

## 4. Cross-Cutting Task System

Tasks can be created from ANY record and assigned to one or more users. This is a cross-cutting entity like Attachments and Notes.

```prisma
model Task {
  id            String       @id @default(uuid())
  companyId     String       @map("company_id")
  title         String       @db.VarChar(255)
  description   String?      @db.Text
  priority      TaskPriority @default(NORMAL)
  status        TaskStatus   @default(OPEN)
  dueDate       DateTime?    @map("due_date")
  entityType    String?      @map("entity_type")    // 'CustomerInvoice', 'PurchaseOrder', etc.
  entityId      String?      @map("entity_id")      // polymorphic FK
  createdById   String       @map("created_by_id")
  completedAt   DateTime?    @map("completed_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  company       Company      @relation(fields: [companyId], references: [id])
  createdBy     User         @relation("TaskCreator", fields: [createdById], references: [id])
  assignees     TaskAssignee[]

  @@map("tasks")
  @@index([companyId, status], map: "idx_tasks_company_status")
  @@index([entityType, entityId], map: "idx_tasks_entity")
  @@index([dueDate], map: "idx_tasks_due_date")
}

model TaskAssignee {
  id       String @id @default(uuid())
  taskId   String @map("task_id")
  userId   String @map("user_id")

  task     Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user     User   @relation(fields: [userId], references: [id])

  @@map("task_assignees")
  @@unique([taskId, userId], map: "uq_task_assignee")
}

enum TaskPriority { LOW NORMAL HIGH URGENT }
enum TaskStatus { OPEN IN_PROGRESS COMPLETED CANCELLED }
```

## 5. Notifications (Core — NOT Phase 3)

Notifications are core infrastructure needed from the first approval workflow. Moved from Phase 3 Communications to Tier 1.

**Delivery channels:** In-app (WebSocket), Push (Expo), Email (via Email Integration)
**Triggers:** Event-driven — approval requests, task assignments, status changes, AI alerts
**User preferences:** Per-channel, per-event-type opt-in/out

## 6. Email Integration (Core — NOT Phase 3)

Email send capability is needed from the first business module (sending invoices, PO confirmations). Moved from Phase 3 Communications to Tier 1.

**MVP scope:** SMTP outbound only (send invoices, statements, POs, notifications). Inbound email (IMAP) deferred to Phase 2.

## 7. Printer Management

Auto-print on save is a common ERP workflow. Cloud-based approach:

**Pattern:** When user saves an invoice/PO/etc., the system:
1. Generates PDF via Document Templates (Puppeteer)
2. Based on user's print preference: auto-download PDF, send to browser Print API, or queue for print service
3. Print preferences configurable per user, per document type

**No physical printer drivers** — this is cloud SaaS. Print = PDF generation + browser print dialog or download.

## 8. Mobile Strategy

**Approach:** Mobile as end-of-epic story. Each epic's web screens are built first, then a "Mobile Adaptation" story evaluates what to expose on mobile.

**Tech:** Expo (React Native) with shared API client. Mobile scaffold (auth, nav shell) created in E6.

**Rule:** Never design mobile-first — web screens drive the design, mobile adapts.

## 8b. Platform Layer Architecture

> The Platform layer is a **separate system** from the ERP tenant application. It is the vendor's operational control plane. See Architecture §2.31.

### Two Databases, Two Applications

| System | Database | Purpose | Users |
|--------|----------|---------|-------|
| **Nexa ERP** | Per-tenant PostgreSQL | Business operations (finance, sales, HR, etc.) | Tenant users (customers) |
| **Nexa Platform** | Central PostgreSQL | Tenant management, billing, AI metering, audit | Platform admins (vendor staff) |

The ERP application talks to the Platform via internal API calls (entitlements, AI quota) through the **Platform Client SDK** (`packages/platform-client`). The Platform Admin portal is a separate React app (`apps/platform-admin`).

### AI Gateway — Mandatory Routing

**Every AI call in the ERP MUST go through the AI Gateway** (`packages/ai-gateway`). No module may call any LLM API directly. The AI Gateway resolves the provider adapter based on the `AiModel` registry and routes through the appropriate SDK (Anthropic, OpenAI, etc.).

Flow: ERP module → `aiGateway.complete()` → quota check → resolve provider from AiModel → resolve credentials (vendor or BYOK) → provider adapter → usage record → return response.

The AI Gateway is defined in E3b and must exist before E5 (AI Orchestration).

### Platform Client SDK — Entitlement Caching

Every ERP service imports `packages/platform-client` which provides:
- `getEntitlements(tenantId)` — cached 5-min TTL, webhook-invalidated
- `checkModuleAccess(tenantId, moduleKey)` — for navigation guards
- `checkUserQuota(tenantId)` — for "Add User" button gating
- `checkAiQuota(tenantId, tokens, feature)` — called by AI Gateway
- `recordAiUsage(record)` — async, queued, zero-loss

**Circuit breaker:** If Platform API unreachable for >10s, serve stale cache. ERP never crashes due to Platform outage. AI usage records queued locally for later sync.

**Webhook listener:** `POST /webhooks/platform` receives `tenant.suspended`, `tenant.plan_changed`, `tenant.quota_warning` events to bust cache immediately.

### Development Rules for Platform

1. **ERP modules never call Platform API directly** — always through Platform Client SDK
2. **AI modules never call any LLM API directly** — always through AI Gateway
3. **Platform database has no companyId** — it is cross-tenant by nature
4. **Platform audit log is append-only** — no update/delete endpoints, ever
5. **Impersonation sessions are always time-limited and audited** — no exceptions

## 9. Epic Build Sequence (E0-E27+)

### Tier 0: Foundation
| Epic | Name |
|------|------|
| E0 | Monorepo + DevOps (includes Platform DB in Docker Compose) |
| E1 | Database + Core Models (ERP DB with companyId + **Platform DB** with tenant/plan/billing/AI usage models) |
| E2 | API Server + Auth + Multi-Company RBAC |
| **E2b** | **Granular RBAC & Access Groups** (Resource table, AccessGroup, permission matrix, field overrides, `createPermissionGuard()`, default data file) |
| E3 | Event Bus + Audit Trail |
| **E3b** | **Platform API + AI Gateway** (internal entitlement endpoints, AI Gateway service, Platform Client SDK with caching + circuit breaker) |

### Tier 1: Core Platform
| Epic | Name |
|------|------|
| E4 | i18n Infrastructure |
| E5 | AI Orchestration (**via AI Gateway from E3b** — all AI calls routed through gateway) |
| E6 | Web Frontend Shell + Mobile Scaffold |
| E7 | Saved Views / Filters / Columns |
| E8 | Attachments + Notes + Record Links |
| E9 | Notifications |
| E10 | Email Integration |
| E11 | Cross-cutting Tasks |
| E12 | Document Templates & PDF |
| E13 | Printer Management |
| **E13b** | **Platform Admin Portal** (Super Admin UI: tenant management, billing dashboard, AI usage dashboard, impersonation, audit log, support console) |

### Tier 2: First Business Module
| Epic | Name |
|------|------|
| E14 | Finance / NL (GL) |

### Tier 3: Business Modules (each ends with Mobile Adaptation story)
| Epic | Name |
|------|------|
| E15 | Inventory |
| E16 | Sales Orders (SO) |
| E17 | Sales Ledger / AR (SL) |
| E18 | Purchase Orders (PO) |
| E19 | Purchase Ledger / AP (PL) |
| E20 | Document Understanding |
| E21 | CRM |
| E22 | Fixed Assets |
| E23 | HR / Payroll |
| E24 | Manufacturing / MRP |
| E25 | Reporting Engine |
| E26+ | Warehouse, POS, Projects, Contracts, Service Orders, Intercompany |
| E27+ | Platform Admin Phase 2 (auto-provisioning, Stripe billing, advanced monitoring, GDPR tooling) |

## 10. Planning Artifact Map

All agents should consult these documents:

| Document | Path | Purpose |
|----------|------|---------|
| PRD | `planning-artifacts/prd.md` | Functional & non-functional requirements (222 FRs, 51 NFRs) |
| Architecture | `planning-artifacts/architecture.md` | Prisma models, module designs, AI infrastructure, build sequence |
| **UX Design Specification** | `planning-artifacts/ux-design-specification.md` | Design system, screen templates (T1–T8), action bar, Co-Pilot Dock, UX Quality Contract |
| API Contracts | `planning-artifacts/api-contracts.md` | REST endpoints, request/response schemas, FR mapping |
| State Machines | `planning-artifacts/state-machine-reference.md` | Entity lifecycles, transitions, guards, side effects |
| Event Catalog | `planning-artifacts/event-catalog.md` | Published/subscribed events, payload schemas, cross-module flows |
| Data Models | `planning-artifacts/data-models.md` | Prisma schema details, entity relationships |
| Business Rules | `planning-artifacts/business-rules-compendium.md` | Validation, calculations, domain constraints |
| Project Context | `planning-artifacts/project-context.md` | THIS FILE — architectural decisions, cross-cutting patterns |
| Traceability | `planning-artifacts/Nexa-ERP-Traceability-Workbook-v1.xlsx` | FR→Architecture→Workflow→Test mapping |

## 11. Development Rules

1. **Every ERP model has companyId** — no exceptions (Platform DB models do NOT have companyId)
2. **Every ERP query scopes by companyId** — check RegisterSharingRule for shared entities
3. **Every user-facing string uses translation keys** — even in MVP (English-only)
4. **Every state change emits a typed event** — via event bus
5. **Every business module story ends with Mobile Adaptation** — assess what goes to mobile
6. **Claude Opus 4.6 for all coding** — no other models for implementation
7. **TDD: Red-Green-Refactor** — write failing tests first, then implement
8. **Every AI call goes through the AI Gateway** — no direct LLM API calls from business modules. All provider SDKs (Anthropic, OpenAI, etc.) are encapsulated in provider adapters within the AI Gateway.
9. **Every ERP module checks entitlements via Platform Client SDK** — module access, user quotas, write permissions. Module-level access is also derived from access group permissions on resources in that module (if any resource in a module has `canAccess = true`, the module nav item is shown)
10. **Platform Admin actions are always audit-logged** — no state-changing operation without an audit record
11. **Epic Page Approval Gate** — before starting any Epic, all pages for that Epic must be designed (using screen templates T1–T8, action bar system, and UX Quality Contract from the UX Design Specification), reviewed, and approved by Mohammed. No implementation begins without this approval.
12. **8-Document Rule** — SM, Dev, and TEA agents must reference ALL 8 key specification documents (PRD, Architecture, UX Design Specification, API Contracts, Data Models, Event Catalog, State Machine Reference, Business Rules Compendium) when creating stories, acceptance criteria, or test plans

# Architecture Validation Results

## Coherence Validation ✅

**Decision Compatibility:**

All technology choices are compatible and work together without conflicts:

| Pairing | Compatibility | Notes |
|---------|-------------|-------|
| Turborepo + pnpm | ✅ | First-class support; pnpm workspaces + turbo.json task orchestration |
| Fastify 5.x + Prisma 7.x | ✅ | Both TypeScript-first. Fastify plugin system + Prisma client injection via request decorator |
| React 19 + Vite 6.x | ✅ | Vite has native React support. React 19 features (use, server components) compatible but not required |
| Tailwind 4.x + Shadcn UI | ✅ | Shadcn is Tailwind-native. Tailwind 4's CSS-first config works with Shadcn |
| Zod + Fastify Swagger | ✅ | zod-to-json-schema feeds Fastify's ajv schema validation and OpenAPI generation |
| BullMQ + Redis | ✅ | BullMQ is purpose-built for Redis. Redis also serves caching and session storage — single dependency |
| Vitest + Vite | ✅ | Vitest shares Vite's config and transform pipeline — zero extra config |
| Socket.io + Fastify | ✅ | @fastify/websocket or fastify-socket.io plugin. Works with Fastify lifecycle hooks |
| Node.js 22 LTS | ✅ | Supports all listed packages. Native fetch, structuredClone, module support |

No version conflicts or contradictory decisions identified.

**Pattern Consistency:**

All implementation patterns support and reinforce the architectural decisions:

- **Naming conventions** are consistent across all layers: PascalCase models → camelCase fields → snake_case DB columns (via Prisma @@map) → kebab-case URLs → kebab-case file names
- **Repository pattern** consistently gates all database access — aligns with tenant database routing (repository receives the tenant-specific PrismaClient)
- **Event bus** for cross-module communication — consistent with modular monolith decision (no direct imports between modules)
- **Zod schemas in packages/shared** — consistent with full-stack type sharing (single source of truth for validation)
- **OKFlag state machine** — consistent generic pattern applied to all transactional entities, aligns with Document lifecycle (Draft→Approved→Posted)
- **Error hierarchy** (AppError → DomainError / AuthError / NotFoundError) — consistent with standardised API error response format

**Structure Alignment:**

The project structure fully supports all architectural decisions:

- Modular monolith → each module is a directory under `api/src/modules/` with identical internal structure
- Database-per-tenant → `api/src/core/tenant/` houses the PrismaClient factory and middleware
- AI orchestration → `api/src/ai/` is a dedicated layer with clear boundaries (orchestrator, context engine, guardrails, briefing engine)
- Background jobs → `api/src/workers/` with one file per job type, using BullMQ
- Shared packages → `packages/db`, `packages/shared`, `packages/ai-tools`, `packages/config` enable cross-app code sharing
- Integration adapters → `api/src/integrations/` grouped by external service (HMRC, banking, payroll, OCR, email)

## Requirements Coverage Validation ✅

**Functional Requirements Coverage (157 FRs):**

| FR Category | FRs | Architecture Support | Status |
|-------------|-----|---------------------|--------|
| **AI Interaction** | FR1-10 | AI orchestration layer (`api/src/ai/`), tool-use pattern, context engine (Redis), guardrails, briefing engine (BullMQ worker), WebSocket (Socket.io), `packages/ai-tools/` | ✅ Full |
| **Finance/GL** | FR11-18 | `modules/finance/`, double-entry DB trigger, period lock DB trigger, multi-currency decision, bank reconciliation service, bank statement parser (`integrations/banking/`) | ✅ Full |
| **Accounts Receivable** | FR19-25 | `modules/ar/`, OKFlag state machine (Draft→Approved→Posted), multi-address (schema design principle), customer entity (~80 fields), payment allocation, credit notes, aging | ✅ Full |
| **Accounts Payable** | FR26-32 | `modules/ap/`, BACS generator (`integrations/banking/bacs-generator.ts`), OCR adapter (`integrations/ocr/`), 3-way matching, bill lifecycle | ✅ Full |
| **Sales Management** | FR33-40 | `modules/sales/`, Quote→Order→Shipment→Invoice lifecycle via state machine, stock check via event bus (`order.confirmed` → inventory check), pricing/discount in schema | ✅ Full |
| **Purchasing** | FR41-45, FR154 | `modules/purchasing/`, PO lifecycle, goods receipt (partial/full) with barcode scanning, reorder suggestions via AI tools | ✅ Full |
| **Inventory & Stock** | FR46-53 | `modules/inventory/`, typed relational fields (schema design principle: typed over JSON), multi-warehouse, stock movements (ACID via Prisma transactions), serial/batch tracking, reorder alerts | ✅ Full |
| **CRM** | FR54-58, FR95-100 | `modules/crm/`, contacts/accounts, activities, leads, pipeline, campaigns, opportunities, Kanban pipeline views, activity auto-rules. CRM→Sales integration via event bus. See §2.21 | ✅ Full |
| **HR & Payroll** | FR59-67, FR101-108 | `modules/hr/`, employment contracts with immutable change history, performance appraisals, skills evaluations, training plans, checklists, job positions, UK payroll engine (PAYE, NI, pension, RTI, BACS). See §2.22 | ✅ Full |
| **Manufacturing** | FR68-73, FR109-115 | `modules/manufacturing/`, BOM/recipe explosion, work orders, MRP, shift scheduling, multi-worker time registration, operation-level GL with WIP, machine/work centre capacity. See §2.23 | ✅ Full |
| **Reporting** | FR74-79, FR153 | `modules/reporting/`, report generation worker, PDF/CSV export, AI NL queries via AI orchestration, AI-driven cash flow forecasting (8-52 week projections with scenario analysis using AR/AP aging, recurring invoices, historical patterns) | ✅ Full |
| **Administration** | FR80-88 | `modules/admin/` + `core/rbac/` + `core/audit/`, 5 roles, module gating, settings, number series (`core/number-series/`), CSV import, audit logs | ✅ Full |
| **Compliance & VAT** | FR89-94, FR155-157 | VAT calculation in finance schemas, MTD adapter (`integrations/hmrc/mtd-vat.adapter.ts`), immutable audit (DB rules), period locks (DB trigger), GDPR soft-delete pattern, fraud detection (`core/fraud-detection/`: duplicate payment detection, suspicious transaction rules engine, anomaly pattern reporting) | ✅ Full |
| **POS** | FR116-122 | `modules/pos/`, session management, barcode scanning, multi-payment, receipt printing, offline sync, cash drawer. See §2.24 | ✅ Full (Phase 2) |
| **Projects & Job Costing** | FR123-129 | `modules/projects/`, project lifecycle, time/expense tracking, rate resolution waterfall, budget vs actual, WIP/revenue recognition. See §2.25 | ✅ Full (Phase 2) |
| **Contracts & Agreements** | FR130-134 | `modules/contracts/`, rental/lease/service agreements, recurring invoicing, loan schedules (4 algorithms). See §2.26 | ✅ Full (Phase 2) |
| **Warehouse Management** | FR135-140 | `modules/warehouse/`, bin/position management, pick lists, cycle counting, packing/dispatch. See §2.27 | ✅ Full (Phase 2) |
| **Intercompany & Consolidation** | FR141-144 | `modules/intercompany/`, transaction routing (PO→SO), elimination entries, consolidated reporting, currency translation. See §2.28 | ✅ Full (Phase 3) |
| **Communications** | FR145-148 | `modules/communications/`, internal messaging, email integration, activity feeds, document attachments. See §2.29 | ✅ Full (Phase 3) |
| **Service Orders** | FR149-152 | `modules/service-orders/`, service order lifecycle, service item tracking, field scheduling, invoice conversion. See §2.30 | ✅ Full (Phase 2) |

**All 157 FRs have architectural support (99 MVP + 58 Phase 2/3).**

**Non-Functional Requirements Coverage (45 NFRs):**

| NFR Category | NFRs | Architecture Support | Status |
|-------------|------|---------------------|--------|
| **Performance** | NFR1-7 | Fastify 70k req/s, Redis caching (30s-5min), cursor pagination, lazy-loaded modules, BullMQ for async operations, code splitting | ✅ Full |
| **Security** | NFR8-16 | AES-256/TLS 1.3, database-per-tenant (no tenant_id), TOTP MFA, session timeout (Redis), RBAC on every endpoint, Argon2id, immutable audit, rate limiting, AI guardrails (never auto-execute financials) | ✅ Full |
| **Reliability** | NFR17-22 | ACID via Prisma transactions, pg_dump + WAL archiving, AI graceful degradation (dual interface pattern — traditional forms independent of AI layer), integration retry with dead-letter queue | ✅ Full |
| **Scalability** | NFR23-26 | Database-per-tenant (1,000 tenants), LRU PrismaClient pool (~200 concurrent), per-tenant migration CLI, 60s provisioning (create DB + migrate + seed) | ✅ Full |
| **Accessibility** | NFR27-30 | Shadcn UI (WCAG-compliant components), keyboard navigation (Shadcn built-in), screen reader support (semantic HTML from Shadcn) | ⚠️ Implicit |
| **Integration** | NFR31-35 | Adapter pattern with retry/backoff, HMRC timeout compliance, bank feed idempotency, encrypted credentials, health monitoring | ✅ Full |
| **Data Integrity** | NFR36-40 | Double-entry trigger, period lock trigger, DECIMAL(19,4), append-only audit rules, retention via soft-delete (never delete financial records) | ✅ Full |
| **Maintainability** | NFR41-45 | TypeScript strict, co-located tests (80% target), Prisma migrations, OpenAPI via Fastify Swagger | ✅ Full |

**44 of 45 NFRs explicitly addressed. NFR27-30 (Accessibility) covered implicitly through Shadcn UI but not architecturally enforced — see Gap Analysis.**

## Implementation Readiness Validation ✅

**Decision Completeness:**

- All critical technology decisions documented with specific versions ✅
- 14 architectural decisions made with rationale and code examples ✅
- 11 enforcement rules ("MUST" list) provide clear guardrails for AI agents ✅
- Anti-patterns list prevents common mistakes ✅
- Implementation sequence defined (8-step build order) ✅
- 3 pending decisions clearly flagged with ⚠️ DECISION NEEDED markers and recommendations ✅

**Structure Completeness:**

- Complete directory tree with ~200+ specific files and directories ✅
- Every backend module has identical internal structure template (routes, services, repositories, schemas, events, types) ✅
- Every frontend feature mirrors backend module structure ✅
- All shared packages defined (db, shared, ai-tools, config) ✅
- Cross-cutting concerns mapped to specific locations ✅
- CI/CD pipeline structure defined (.github/workflows/) ✅
- Docker Compose for local development ✅

**Pattern Completeness:**

- Naming conventions cover database, API, code, events, logging — comprehensive ✅
- Format patterns cover API responses (success/error), dates, money handling ✅
- Process patterns cover error handling (backend + frontend), OKFlag state machine, repository pattern ✅
- Communication patterns cover event naming, logging levels, structured JSON format ✅
- Code examples provided for every major pattern (Prisma model, event bus, state machine, repository, error handler, route handler) ✅

## §2.31 Platform Admin — Tenant Management, Billing, AI Gateway & Operations

> **Scope:** Separate application and database for platform-level operations. NOT part of any tenant ERP database. Covers FR193-FR222, NFR46-NFR51.

### 2.31.1 Architecture Overview

The Platform Admin system consists of three components:

1. **Platform Database** — Central PostgreSQL database holding tenant metadata, billing, AI usage, and platform audit data. Separate Prisma schema (`apps/platform-admin/prisma/schema.prisma`).
2. **Platform API** — Internal REST endpoints consumed by ERP tenants at runtime for entitlement checks, AI quota enforcement, and status queries. Authenticated with internal service tokens (not user JWTs).
3. **Platform Admin Portal** — Separate React application (`apps/platform-admin/`) for vendor super administrators. Separate auth system (platform-level JWT + MFA). Never accessed by tenant users.

```
┌─────────────────────────────────────┐
│       Platform Admin Portal         │ ← Super Admin UI (React)
│      (apps/platform-admin)          │
└───────────┬─────────────────────────┘
            │ Platform Admin API (REST)
            ▼
┌─────────────────────────────────────┐
│         Platform API Server         │ ← Fastify (shared or separate process)
│    (apps/platform-api)              │
└───┬───────────┬─────────────────────┘
    │           │
    ▼           ▼
┌────────┐  ┌──────────────────────────────┐
│Platform│  │   AI Gateway Service          │
│  DB    │  │ (packages/ai-gateway)         │
│        │  │ quota check → proxy → record  │
└────────┘  └──────────────────────────────┘
                    ▲
                    │ All AI calls from ERP
            ┌───────┴──────────┐
            │  ERP Tenant App  │
            │  (via Platform   │
            │   Client SDK)    │
            └──────────────────┘
```

### 2.31.2 Platform Database Schema (Prisma)

```prisma
// Platform database — NOT in any tenant ERP database
// File: apps/platform-api/prisma/schema.prisma

model Tenant {
  id              String        @id @default(uuid())
  code            String        @unique @db.VarChar(50)    // slug, e.g. "acme-ltd"
  displayName     String        @map("display_name")
  legalName       String?       @map("legal_name")
  status          TenantStatus  @default(ACTIVE)
  planId          String        @map("plan_id")
  billingStatus   BillingStatus @default(CURRENT) @map("billing_status")
  region          String        @default("uk-south") @db.VarChar(30)
  dbHost          String        @map("db_host")
  dbName          String        @map("db_name")
  dbPort          Int           @default(5432) @map("db_port")
  sandboxEnabled  Boolean       @default(false) @map("sandbox_enabled")
  lastActivityAt  DateTime?     @map("last_activity_at")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  plan              Plan                    @relation(fields: [planId], references: [id])
  moduleOverrides   TenantModuleOverride[]
  featureFlags      TenantFeatureFlag[]
  aiQuota           TenantAiQuota?
  aiUsageRecords    TenantAiUsage[]
  billing           TenantBilling?
  impersonations    ImpersonationSession[]

  @@map("tenants")
}

enum TenantStatus {
  PROVISIONING
  ACTIVE
  SUSPENDED
  READ_ONLY
  ARCHIVED
}

enum BillingStatus {
  CURRENT
  GRACE
  OVERDUE
  BLOCKED
}

model Plan {
  id                      String   @id @default(uuid())
  code                    String   @unique @db.VarChar(30) // core, pro, enterprise, custom
  displayName             String   @map("display_name")
  maxUsers                Int      @map("max_users")
  maxCompanies            Int      @map("max_companies")
  monthlyAiTokenAllowance BigInt   @map("monthly_ai_token_allowance")
  aiHardLimit             Boolean  @default(true) @map("ai_hard_limit")
  enabledModules          Json     @map("enabled_modules") @db.JsonB // string[] of module keys
  apiRateLimit            Int      @default(1000) @map("api_rate_limit") // requests per minute
  isActive                Boolean  @default(true) @map("is_active")
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  tenants Tenant[]

  @@map("plans")
}

model TenantModuleOverride {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  moduleKey  String   @map("module_key") @db.VarChar(50)
  enabled    Boolean
  reason     String?
  changedBy  String   @map("changed_by")
  changedAt  DateTime @default(now()) @map("changed_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, moduleKey], map: "uq_tenant_module_override")
  @@map("tenant_module_overrides")
}

model TenantFeatureFlag {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  featureKey String   @map("feature_key") @db.VarChar(100)
  enabled    Boolean
  changedBy  String   @map("changed_by")
  changedAt  DateTime @default(now()) @map("changed_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, featureKey], map: "uq_tenant_feature_flag")
  @@map("tenant_feature_flags")
}

model TenantAiUsage {
  id                String   @id @default(uuid())
  tenantId          String   @map("tenant_id")
  userId            String   @map("user_id") @db.VarChar(100) // tenant userId or "system"
  featureKey        String   @map("feature_key") @db.VarChar(100) // e.g. "chat", "document_processing", "forecasting"
  model             String   @db.VarChar(100) // e.g. "claude-sonnet-4-5-20250929"
  promptTokens      Int      @map("prompt_tokens")
  completionTokens  Int      @map("completion_tokens")
  totalTokens       Int      @map("total_tokens")
  costEstimate      Decimal  @map("cost_estimate") @db.Decimal(10, 6) // unit price snapshot at call time
  requestId         String   @unique @map("request_id") @db.VarChar(100) // trace ID
  timestamp         DateTime @default(now()) @db.Timestamptz

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, timestamp], map: "idx_ai_usage_tenant_time")
  @@index([tenantId, featureKey], map: "idx_ai_usage_tenant_feature")
  @@map("tenant_ai_usage")
}

model TenantAiQuota {
  id              String   @id @default(uuid())
  tenantId        String   @unique @map("tenant_id")
  periodStart     DateTime @map("period_start") @db.Date
  periodEnd       DateTime @map("period_end") @db.Date
  tokensUsed      BigInt   @default(0) @map("tokens_used")
  tokenAllowance  BigInt   @map("token_allowance")
  softLimitPct    Int      @default(80) @map("soft_limit_pct")
  hardLimitPct    Int      @default(100) @map("hard_limit_pct")
  burstAllowance  BigInt?  @map("burst_allowance")
  updatedAt       DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("tenant_ai_quotas")
}

model TenantBilling {
  id                  String           @id @default(uuid())
  tenantId            String           @unique @map("tenant_id")
  stripeCustomerId    String?          @map("stripe_customer_id")
  subscriptionStatus  String?          @map("subscription_status") @db.VarChar(30)
  currentPeriodEnd    DateTime?        @map("current_period_end")
  gracePeriodDays     Int              @default(14) @map("grace_period_days")
  lastPaymentAt       DateTime?        @map("last_payment_at")
  dunningLevel        Int              @default(0) @map("dunning_level") // 0-3
  enforcementAction   EnforcementAction @default(NONE) @map("enforcement_action")
  updatedAt           DateTime         @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("tenant_billing")
}

enum EnforcementAction {
  NONE
  WARNING
  READ_ONLY
  SUSPENDED
}

model PlatformUser {
  id            String          @id @default(uuid())
  email         String          @unique
  passwordHash  String          @map("password_hash")
  displayName   String          @map("display_name")
  role          PlatformRole    @default(PLATFORM_VIEWER)
  mfaEnabled    Boolean         @default(false) @map("mfa_enabled")
  mfaSecret     String?         @map("mfa_secret")
  isActive      Boolean         @default(true) @map("is_active")
  lastLoginAt   DateTime?       @map("last_login_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  auditLogs       PlatformAuditLog[]
  impersonations  ImpersonationSession[]

  @@map("platform_users")
}

enum PlatformRole {
  PLATFORM_ADMIN
  PLATFORM_VIEWER
}

model PlatformAuditLog {
  id              String   @id @default(uuid())
  platformUserId  String   @map("platform_user_id")
  action          String   @db.VarChar(100) // e.g. "tenant.suspend", "impersonation.start", "plan.change"
  targetType      String?  @map("target_type") @db.VarChar(50) // "tenant", "plan", "platform_user"
  targetId        String?  @map("target_id")
  details         Json?    @db.JsonB // action-specific detail payload
  ipAddress       String   @map("ip_address") @db.VarChar(45)
  userAgent       String?  @map("user_agent") @db.VarChar(500)
  timestamp       DateTime @default(now()) @db.Timestamptz

  platformUser PlatformUser @relation(fields: [platformUserId], references: [id])

  @@index([platformUserId, timestamp], map: "idx_audit_user_time")
  @@index([targetType, targetId], map: "idx_audit_target")
  @@map("platform_audit_log")
}

model ImpersonationSession {
  id              String    @id @default(uuid())
  platformUserId  String    @map("platform_user_id")
  tenantId        String    @map("tenant_id")
  reason          String
  startedAt       DateTime  @default(now()) @map("started_at")
  endedAt         DateTime? @map("ended_at")
  expiresAt       DateTime  @map("expires_at") // hard time limit
  actionsLog      Json?     @map("actions_log") @db.JsonB // array of actions during session

  platformUser PlatformUser @relation(fields: [platformUserId], references: [id])
  tenant       Tenant       @relation(fields: [tenantId], references: [id])

  @@index([tenantId, startedAt], map: "idx_impersonation_tenant")
  @@map("impersonation_sessions")
}
```

### 2.31.3 AI Gateway Service

The AI Gateway is the **single enforcement point** for all AI usage in Nexa ERP. Every module that calls an LLM must route through the gateway — no direct Claude API calls from business modules.

**Location:** `packages/ai-gateway/`

**Flow:**
```
ERP Module → aiGateway.complete({ tenantId, userId, featureKey, messages, tools }) →
  1. POST /platform/tenants/:id/ai/check { estimatedTokens, featureKey }
     → { allowed: true/false, remainingTokens, quotaPct, warning? }
  2. If allowed → call Claude API → receive response
  3. POST /platform/tenants/:id/ai/record { usage details }
     → Fire-and-forget with retry queue
  4. Return response to calling module
```

**Quota enforcement behaviour:**
- Below soft limit: normal operation
- At soft limit (default 80%): return warning in response metadata, trigger `tenant.quota_warning` event
- At hard limit (default 100%): if `plan.aiHardLimit = true`, block with `AI_QUOTA_EXCEEDED` error; if false, allow with overage logging
- Platform unreachable: serve from cached quota data, queue usage records for later sync

### 2.31.4 Platform Client SDK

**Location:** `packages/platform-client/`

Every ERP service imports this SDK. It provides:

```typescript
// packages/platform-client/src/index.ts
export interface PlatformClient {
  // Entitlements (cached, 5-min TTL, webhook-invalidated)
  getEntitlements(tenantId: string): Promise<TenantEntitlements>;
  checkModuleAccess(tenantId: string, moduleKey: string): Promise<ModuleAccess>;
  checkUserQuota(tenantId: string): Promise<UserQuota>;
  getTenantStatus(tenantId: string): Promise<TenantStatusResponse>;

  // AI Gateway (always live, no cache)
  checkAiQuota(tenantId: string, estimatedTokens: number, featureKey: string): Promise<AiQuotaCheck>;
  recordAiUsage(record: AiUsageRecord): Promise<void>; // async, queued

  // Cache management
  invalidateCache(tenantId: string): void; // called by webhook handler
}

export interface TenantEntitlements {
  status: TenantStatus;
  planCode: string;
  billingStatus: BillingStatus;
  enforcementAction: EnforcementAction;
  maxUsers: number;
  maxCompanies: number;
  enabledModules: string[];
  featureFlags: Record<string, boolean>;
}
```

**Caching strategy:**
- Redis (production) or in-memory LRU (development)
- 5-minute TTL on entitlements
- Webhook listener on `POST /webhooks/platform` for immediate cache invalidation
- Circuit breaker: if Platform API unreachable for >10s, serve stale cache with `degraded: true` flag

### 2.31.5 ERP Integration Points

| ERP Moment | Platform Call | On Failure Response |
|---|---|---|
| Tenant login / app init | `GET /entitlements` | Block login if `suspended` or `blocked` |
| Dashboard load | Cached entitlements | Show banner if `read_only` or `grace` |
| Navigate to module | `checkModuleAccess()` | Hide module or show "not on your plan" upgrade CTA |
| Admin → Add User | `checkUserQuota()` | Disable "Add User" button, show limit message |
| Any AI feature triggered | `checkAiQuota()` via AI Gateway | Degrade gracefully: show "AI quota reached" with upgrade CTA |
| AI response received | `recordAiUsage()` | Fire-and-forget with local retry queue |
| Feature flag check | Cached from entitlements | Default to `false` if unreachable |
| Any write operation | Check cached `enforcementAction` | Block writes if `read_only`, show billing notice |

## Gap Analysis Results

**Critical Gaps: None**

No missing architectural decisions that block implementation. All 99 MVP FRs, 30 Platform FRs (FR193-FR222), and 50/51 NFRs have explicit architectural support.

**Important Gaps (should address during early implementation stories):**

| # | Gap | Impact | Recommendation |
|---|-----|--------|----------------|
| GAP-1 | **Accessibility enforcement** — NFR27-30 rely on Shadcn's built-in accessibility but no architectural enforcement (linting rules, testing strategy for a11y) | MEDIUM — could fail WCAG audit | Add `eslint-plugin-jsx-a11y` to ESLint config. Add Playwright axe-core checks in E2E tests. Document as implementation pattern. |
| GAP-2 | **File/document storage** — Document understanding (FR164-FR168), payslip generation (FR66), P45/P60 (FR66), report PDF export (FR78) all produce files. Document ingestion pipeline (§6.10) defines storage key pattern but needs concrete S3/MinIO implementation | MEDIUM — needs a decision before building document processing or report features | Recommend: S3-compatible object storage (MinIO for local dev, S3 for production). Add `api/src/core/storage/` for file storage abstraction. Document originals stored with tenant-scoped keys. |
| GAP-3 | **Email delivery pipeline** — Customer statements (FR22), invoice delivery, bill ingestion (FR32), payslips (FR66) require email but `integrations/email/` is skeletal | LOW-MEDIUM — email adapter defined but queue/template/tracking not specified | Implement: BullMQ email queue → template engine (Handlebars/React Email) → SMTP send → delivery tracking. Add `email-send.worker.ts` is already in workers. |
| GAP-4 | **Barcode scanning** — Journey 4 (Marcus) mentions barcode scanning for goods receipt and warehouse operations | LOW — can be a frontend-only concern | Implement as frontend camera API integration (Web API or library like `zxing-js`). No backend architecture change needed — scanned code becomes standard API parameter. |
| GAP-5 | **CSV import pipeline** — FR87 mentions data import (customers, suppliers, items, opening balances) but no architecture for parsing/mapping/validation | LOW — can be designed when building admin module | Implement: File upload → BullMQ job → parse/validate/map → batch insert. Add to admin module. Error rows returned to user for correction. |

**Nice-to-Have Gaps (address when needed):**

| # | Gap | Notes |
|---|-----|-------|
| GAP-6 | Feature flag system | Mentioned in RBAC section. Recommend simple DB-backed flags for MVP; LaunchDarkly for scale. |
| GAP-7 | Health check endpoint structure | `/health` and `/ready` mentioned but format not specified. Standard: `{ status: "ok", version: "...", uptime: N, checks: {...} }` |
| GAP-8 | Multi-tenant migration orchestrator | Per-tenant migrations mentioned but tooling not specified. Recommend: CLI script iterating all tenant DB URLs from platform DB. |
| GAP-9 | Error monitoring service | No APM/error tracking specified. Recommend: Sentry for error tracking, Prometheus + Grafana for metrics (already mentioned). |
| GAP-10 | WebSocket authentication | Socket.io connection must validate JWT on handshake. Not explicitly documented in auth flow. |

## Validation Issues Addressed

**Issue 1: Double-Entry CHECK Constraint Implementation**

The architecture shows a CHECK constraint on `journal_lines` for double-entry enforcement. PostgreSQL CHECK constraints cannot reference other rows (they are per-row only). The document correctly notes it will be implemented as an AFTER INSERT trigger instead. The SQL example is illustrative of intent — the actual implementation will be a trigger function. **No architectural change needed — the intent and approach are correct.**

**Issue 2: Prisma 7.x Maturity**

Prisma 7 (TypeScript rewrite) is specified. As a relatively new major version, there may be ecosystem gaps (community plugins, edge cases). **Mitigation:** Prisma 7 was released to address the Rust engine bottleneck. The architecture uses standard Prisma features (basic CRUD, relations, transactions). Raw SQL via `$queryRaw` is available for PostgreSQL-specific features (triggers, functions). Risk is low.

**Issue 3: Socket.io vs Native WebSocket**

Socket.io adds ~40KB to the frontend bundle and has its own protocol overhead. For the use cases defined (AI chat streaming, notifications), native WebSocket would be lighter. **Decision stands** — Socket.io provides automatic reconnection, room management (per-tenant), and fallback transport, which are valuable for production reliability. Can revisit if bundle size becomes an issue.

## Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analysed (157 FRs, 45 NFRs, 14 cross-cutting concerns)
- [x] Scale and complexity assessed (ENTERPRISE, 17 modules across 3 phases, 30+ components)
- [x] Technical constraints identified (12 constraints with architectural impact)
- [x] Cross-cutting concerns mapped (14 concerns with affected modules and approach)
- [x] External dependencies catalogued (9 external service families)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (14 technology decisions with version numbers)
- [x] Technology stack fully specified (13 technology choices across all layers)
- [x] Integration patterns defined (adapter pattern, retry/backoff, credential vault)
- [x] Performance considerations addressed (caching strategy, connection pooling, code splitting)
- [x] Security architecture defined (JWT + Argon2id + TOTP MFA + RBAC + encryption)
- [x] Data architecture defined (DECIMAL, tenant routing, schema principles, audit trail)

**✅ Implementation Patterns**

- [x] Naming conventions established (database, API, code, events, logging)
- [x] Structure patterns defined (file suffixes, test location, module template)
- [x] Communication patterns specified (event naming, logging format, API response format)
- [x] Process patterns documented (error handling, state machine, repository pattern)
- [x] Enforcement guidelines defined (11 MUST rules, anti-patterns list)
- [x] Code examples provided (Prisma model, event bus, state machine, repository, route handler)

**✅ Project Structure**

- [x] Complete directory structure defined (~200+ files/directories)
- [x] Component boundaries established (API, module, data boundaries)
- [x] Integration points mapped (6 API boundaries documented)
- [x] Requirements to structure mapping complete (all 20 FR categories → specific locations)
- [x] Cross-cutting concerns mapped to specific files/directories
- [x] Data flow diagram provided (ASCII art showing full request lifecycle)

## Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: HIGH** — based on comprehensive validation across coherence, requirements coverage, and implementation readiness.

**Key Strengths:**

1. **Comprehensive FR/NFR coverage** — all 99 MVP FRs (157 total) and 44/45 NFRs have explicit architectural support with traceable locations
2. **Consistency enforcement** — 11 MUST rules + anti-patterns list ensures AI agents produce consistent code across sessions
3. **Financial integrity at DB level** — double-entry triggers, period locks, immutable audit trail are enforced by PostgreSQL, not application code
4. **Modular monolith with clean boundaries** — event bus for cross-module communication, repository pattern for data access, plugin architecture for module isolation
5. **AI-first but AI-independent** — dual interface pattern ensures traditional forms work when AI layer is unavailable (NFR21)
6. **Production-ready patterns** — structured logging, correlation IDs, error hierarchy, health endpoints, background job processing
7. **Full-stack type safety** — Zod schemas shared between frontend and backend, Prisma types flow through repository→service→route→API response

**Areas for Future Enhancement:**

1. Accessibility testing automation (GAP-1) — add to implementation stories
2. File storage architecture (GAP-2) — decide S3/MinIO before building report/payslip features
3. Multi-tenant migration orchestrator (GAP-8) — build when moving beyond single-tenant MVP
4. WebSocket authentication pattern (GAP-10) — document during AI orchestration implementation
5. Error monitoring/APM integration (GAP-9) — add Sentry during deployment story

## Confirmed Decisions Summary

All three pending decisions have been confirmed by the product owner. Optimised for **customer experience** and **development speed**.

> **✅ DECISION 1 — Frontend:** **Vite + React (web) + React Native / Expo (mobile)**
> - Mobile app is a critical component of an AI-first ERP — briefings, approvals, chat, barcode scanning require native experience
> - Web handles complex ERP forms (80+ field invoices, data tables, reports) — desktop/tablet primary
> - Mobile handles AI-first interactions (chat, briefings, approvals, scanning) — phone primary
> - Both consume the same Fastify API via `packages/api-client`

> **✅ DECISION 2 — Backend:** **Fastify**
> - 2x throughput, simpler mental model for AI-driven development, plugin system maps to ERP modules
> - Less abstraction = cleaner code, fewer bugs, better sustainability when Claude Opus 4.6 manages entire codebase

> **✅ DECISION 3 — Decimal:** **DECIMAL(19,4)**
> - No conversion code at boundaries, Prisma Decimal handles natively, fewer money bugs, faster development

## Implementation Handoff

**AI Agent Guidelines:**

1. Follow all architectural decisions exactly as documented — this document is the single source of truth
2. Use implementation patterns consistently across all components — check naming, structure, format, and process patterns before writing code
3. Respect project structure and boundaries — modules communicate only via event bus, shared types, or API endpoints
4. Use the enforcement guidelines (11 MUST rules) as a pre-commit checklist
5. When in doubt, check the anti-patterns list — if something is listed there, do not do it
6. Refer to this document for all architectural questions before making ad-hoc decisions

**Implementation Build Sequence (E0-E27+):**

> Full details of cross-cutting patterns (companyId, i18n, RBAC, tasks, etc.) are in `project-context.md`. All epics must follow those patterns.

### Tier 0: Foundation
| Epic | Name | Scope |
|------|------|-------|
| **E0** | Monorepo + DevOps | Turborepo + pnpm workspace, turbo.json, Docker Compose (PostgreSQL + PgBouncer + Redis + **Platform DB**), shared configs (ESLint, TypeScript, Tailwind), `packages/shared` + `packages/api-client` + **`packages/platform-client`** stubs |
| **E1** | Database + Core Models | **Two databases:** (1) Tenant ERP DB — Prisma schema (Company model with multi-company support, User, AuditLog, NumberSeries + System module entities from §2.10 + Cross-cutting entities from §2.20 + DocumentTemplate from §2.12 + RegisterSharingRule, UserCompanyRole). **companyId FK on ALL ERP tables.** Migrations, seed data. (2) **Platform DB** — Prisma schema (Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession). Seed data (default plans, founding tenant record, platform admin account). |
| **E2** | API Server + Auth + Multi-Company RBAC | Fastify app factory, auth (JWT + Argon2id), tenant middleware, **company-context middleware** (company switching API + session default), RBAC guard with UserCompanyRole resolution (company-specific → global → no access), correlation ID middleware, structured logger, error handler, health endpoints |
| **E3** | Event Bus + Audit Trail | Typed event bus implementation, audit service, DB-level audit protection rules, approval workflow engine (§2.20) |
| **E3b** | Platform API + AI Gateway | **Platform API** — internal REST endpoints for ERP runtime: `GET /platform/tenants/:id/entitlements`, `GET /platform/tenants/:id/modules/:key/access`, `GET /platform/tenants/:id/users/quota`, `POST /platform/tenants/:id/ai/check`, `POST /platform/tenants/:id/ai/record`, `GET /platform/tenants/:id/status`. **AI Gateway service** — single function/service through which ALL ERP AI calls are routed: quota check → proxy to model provider → write usage record. **Platform Client SDK** (`packages/platform-client`) — thin library imported by ERP: entitlement caching (Redis/in-memory, 5-min TTL), circuit breaker (serve from cache if Platform down), async AI usage recording (local queue + sync), webhook listener for cache invalidation (`tenant.suspended`, `tenant.plan_changed`, `tenant.quota_warning`). See FR205-FR222. |

### Tier 1: Core Platform
| Epic | Name | Scope |
|------|------|-------|
| **E4** | i18n Infrastructure | Translation key system, locale files (`locales/en.json`), `t()` helper, Intl API for number/date/currency formatting, user language preference, company default language, fallback chain (user → company → en). English-only MVP content. |
| **E5** | AI Orchestration | Claude API integration **via AI Gateway (E3b)**, tool definitions, context engine, guardrails, WebSocket handler, chat panel UI (web). All AI calls routed through the AI Gateway for quota enforcement and usage metering. |
| **E6** | Web Frontend Shell + Mobile Scaffold | **Web:** Vite + React app, React Router with module guards, app shell (sidebar, header with company switcher), auth flow, TanStack Query client, Zustand stores, system admin screens (company management, reference data). **Mobile:** Expo project setup, Expo Router, auth flow (login + biometric), WebSocket connection, AI chat screen, push notifications scaffold. |
| **E7** | Saved Views / Filters / Columns | SavedView model (§2.9), per-user column selection, saved filters, quick filters, favourite views. Reusable list infrastructure for all business modules. |
| **E8** | Attachments + Notes + Record Links | Attachment upload/download API (S3/MinIO presign), Note CRUD, RecordLink CRUD + bidirectional query |
| **E9** | Notifications | In-app (WebSocket real-time), Push (Expo), Email channel. Event-driven triggers. User per-channel, per-event-type preferences. Notification centre UI. |
| **E10** | Email Integration | SMTP outbound: send invoices, statements, POs, payslips, notifications. Email template system. Per-company SMTP configuration. Inbound (IMAP) deferred to Phase 2. |
| **E11** | Cross-cutting Tasks | Task + TaskAssignee models, create tasks from any record (polymorphic entityType/entityId), multi-assignee, due dates, priority, task list UI, task dashboard widget. |
| **E12** | Document Templates & PDF | DocumentTemplate + DocumentTemplateVersion Prisma models, PDF generation service (Puppeteer), template version selection algorithm, template admin UI (CRUD + preview), 10 default seed templates, email delivery integration. See §2.12. |
| **E13** | Printer Management | Print preference configuration per user per document type, auto-print on save, browser Print API integration, PDF download fallback. |
| **E13b** | Platform Admin Portal (Super Admin) | Separate React app (`apps/platform-admin`). Auth (platform-level JWT + MFA). **Tenant management UI** (list, create, suspend, reactivate, archive, configure modules/flags). **Billing dashboard** (plan assignment, payment status, enforcement controls). **AI usage dashboard** (per-tenant token usage, quotas, alerts, CSV export). **Impersonation** (time-limited, bannered, fully audited). **Platform audit log viewer**. **Support console** (tenant search, diagnostics, runbook buttons). See FR193-FR218, §2.31. |

### Tier 2: First Business Module
| Epic | Name | Scope |
|------|------|-------|
| **E14** | Finance / NL (GL) | First business module. Proves the entire architecture: routes → services → repositories → events → audit. ChartOfAccount, AccountClassification, **AccountMapping** (27 mapping types + FRS 102 seed), JournalEntry, JournalLine, FinancialPeriod, BankAccount, BankTransaction, BankReconciliation, Budget, BudgetLine. GL posting template pattern. Trial balance. **+ Mobile Adaptation story.** See §2.13. |

### Tier 3: Business Modules (each ends with Mobile Adaptation story)
| Epic | Name | Scope |
|------|------|-------|
| **E15** | Inventory | ItemGroup, Warehouse, UnitOfMeasure, InventoryItem, StockMovement, StockBalance, SerialNumber (P1 stub). Costing engine (FIFO/WA/Standard/Last Purchase). See §2.14. |
| **E16** | Sales Orders (SO) | SalesQuote, SalesQuoteLine, SalesOrder, SalesOrderLine, Dispatch, DispatchLine, ShippingMethod + PriceList, PriceListEntry, QuantityBreak, Rebate (P1). Quote→Order→Ship→Invoice lifecycle. See §2.16, §2.19. |
| **E17** | Sales Ledger / AR (SL) | Customer, CustomerAddress, CustomerContact, CustomerInvoice, CustomerInvoiceLine, CustomerPayment, PaymentAllocation. Invoice lifecycle, credit management, aging. See §2.15. |
| **E18** | Purchase Orders (PO) | Supplier, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine. See §2.17. |
| **E19** | Purchase Ledger / AP (PL) | SupplierBill, SupplierBillLine, SupplierPayment, SupplierPaymentAllocation, BacsRun (P1). 3-way matching, BACS payment runs. See §2.17. |
| **E20** | Document Understanding | DocumentIngestion pipeline, SupplierExtractionProfile, extraction service (Claude Vision), matching service, review UI. Depends on E19 (AP) + E5 (AI). See §6.10. |
| **E21** | CRM | Leads, campaigns, opportunities, pipeline Kanban, activity auto-rules. See §2.21. |
| **E22** | Fixed Assets | DepreciationMethod, AssetGroup, AssetClass, FixedAsset, DepreciationEntry, AssetDisposal, AssetTransfer, AssetTransaction. Dual-basis depreciation, disposal workflow. See §2.18. |
| **E23** | HR / Payroll | Employment contracts (immutable change history), UK payroll engine (PAYE, NI, pension, RTI, BACS), leave, checklists, skills, appraisals, training. See §2.22. |
| **E24** | Manufacturing / MRP | BOM/recipe explosion, MRP, work orders, shift scheduling, operation-level GL with WIP. See §2.23. |
| **E25** | Reporting Engine | Standard & custom report engine, P0 financial/operational/HR reports. |
| **E26+** | Phase 2/3 Modules | POS (§2.24), Projects & Job Costing (§2.25), Contracts & Agreements (§2.26), Warehouse Management (§2.27), Service Orders (§2.30), Intercompany & Consolidation (§2.28), Communications (§2.29). |
| **E27+** | Platform Admin Phase 2 | Automated tenant provisioning (self-service sign-up, auto DB creation), Stripe billing integration (automated invoicing, dunning, payment sync), advanced platform monitoring (Sentry-style error aggregation, latency dashboards), GDPR tooling (DSAR export, anonymisation), advanced support console (runbook automation). |

> **Note:** Stories 1b (System) and 5b (Document Templates) from the original sequence are now E1 (included in Database + Core Models) and E12 respectively. Notifications and Email Integration have been promoted from Phase 3 to Tier 1 core platform (E9, E10). Mobile scaffold is in E6 with dedicated Mobile Adaptation stories at the end of each Tier 3 epic. **Platform Admin** has been split: E3b (Platform API + AI Gateway) is Tier 0 foundation, E13b (Platform Admin Portal UI) is Tier 1 core platform. The AI Gateway MUST exist before E5 (AI Orchestration) since all AI calls route through it.

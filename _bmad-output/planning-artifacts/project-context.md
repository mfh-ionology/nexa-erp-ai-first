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

## 2. RBAC: Global Role + Per-Company Exceptions

```prisma
model UserCompanyRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  companyId String?  @map("company_id")  // NULL = global role (applies to all companies)
  role      UserRole

  user      User     @relation(fields: [userId], references: [id])
  company   Company? @relation(fields: [companyId], references: [id])

  @@map("user_company_roles")
  @@unique([userId, companyId], map: "uq_user_company_role")
}
```

**Resolution order:**
1. Look for company-specific role: `WHERE userId = ? AND companyId = ?`
2. If found, use it (this is the exception/override)
3. If not found, fall back to global role: `WHERE userId = ? AND companyId IS NULL`
4. If neither, user has NO access to that company

**Example:** Mohammed has ADMIN globally + VIEWER override for Company 3 → ADMIN everywhere except Company 3.

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
- Translation files stored per locale per namespace: `packages/i18n/locales/en/common.json`, `packages/i18n/locales/en/validation.json`, etc. (directory-per-locale, file-per-namespace)
- Core namespaces: `common`, `validation`, `navigation`, `errors` — business modules add their own (e.g., `finance`, `sales`) via `i18next.addResourceBundle()` or by extending the `TranslationNamespace` type
- Default locale: `en` (English-first for UK MVP)
- User selects language in profile settings
- Company can set default language
- Fallback chain: user language → company language → `en` (implemented via `resolveLocale()` in `@nexa/i18n`)
- Number/date/currency formatting via `Intl` API based on locale
- Pluralisation: i18next `_one`/`_other` suffix convention (e.g., `itemCount_one`, `itemCount_other`)

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
9. **Every ERP module checks entitlements via Platform Client SDK** — module access, user quotas, write permissions
10. **Platform Admin actions are always audit-logged** — no state-changing operation without an audit record
11. **Epic Page Approval Gate** — before starting any Epic, all pages for that Epic must be designed (using screen templates T1–T8, action bar system, and UX Quality Contract from the UX Design Specification), reviewed, and approved by Mohammed. No implementation begins without this approval.
12. **8-Document Rule** — SM, Dev, and TEA agents must reference ALL 8 key specification documents (PRD, Architecture, UX Design Specification, API Contracts, Data Models, Event Catalog, State Machine Reference, Business Rules Compendium) when creating stories, acceptance criteria, or test plans
13. **Visual Design Fidelity Rule (Concept D)** — All frontend components MUST match the approved Concept D prototype (`_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`). This means: (a) Shadcn UI components must be restyled to use the purple theme, not stock defaults; (b) typography must use Plus Jakarta Sans for headings, Inter for body, JetBrains Mono for amounts/codes; (c) cards must use 12px radius, custom shadows with purple-tinted hover; (d) animations (fadeInUp, slideIn, stepIn) must be present with `prefers-reduced-motion` respect; (e) the sidebar, header, and Co-Pilot drawer must visually match the prototype. Dev agents must open the prototype HTML in a browser and verify visual parity before marking any frontend story as complete.
14. **Login Page Branding** — The login page must include the purple "N" logo mark, "Nexa ERP" in Plus Jakarta Sans bold, and use the full Concept D visual language (purple primary button, branded card styling, `#f4f2ff` background). No generic/unstyled login pages.
15. **Per-Epic AI Integration Section** — Every epic MUST include an "AI Integration" section defining: (a) tools/functions the AI gains; (b) context injected into the system prompt; (c) example user queries the AI should handle. This ensures the Co-Pilot grows capability with each epic.

## 12. AI-First Integration Pattern

Nexa is an **AI-first ERP**. The Co-Pilot is not an add-on — it is a primary interaction mode. Every module must be designed so the AI can operate it on behalf of the user.

### Approach: Dynamic Tool Definitions + Context (No Fine-Tuning)

Fine-tuning is expensive, fragile, and hard to update. Instead, Nexa uses:

1. **Tool/Function Calling** — Each epic registers tools the AI can invoke via the AI Gateway. Tools are typed TypeScript functions with JSON Schema parameter definitions. Example: `open_entity_list(viewKey: string, savedViewName?: string)`, `apply_filter(viewKey: string, conditions: FilterCondition[])`.

2. **Dynamic System Context** — On each AI session, the system prompt is built dynamically from live database metadata:
   - Available modules (from `data_views`)
   - User's saved views per module (names + group names)
   - User's favourites and defaults
   - User's role and permissions (from resolved access groups)
   - User's memories (from E5b memory management)
   - Available actions per entity type

3. **RAG for Deep Knowledge** — For complex domain questions ("how do I reconcile a bank statement?"), the AI retrieves relevant help documentation via vector search.

4. **Semantic Search for Fuzzy Matching** — When the user says "show me overdue invoices view", the AI calls `search_views(query)` which performs fuzzy matching on saved view names. Results include confidence scores:
   - Score > 0.8: execute immediately
   - Score 0.5-0.8: present options to user
   - Score < 0.5: offer to create ad-hoc filter instead

### Per-Epic AI Tool Registry

Each epic adds entries to the **AI Tool Registry** (`ai_tool_definitions` seed data or runtime config). Example for E7:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `open_entity_list` | `viewKey`, `savedViewName?` | Navigate to an entity list page, optionally with a named saved view |
| `search_views` | `query` | Fuzzy-match user intent to saved view names |
| `apply_filter` | `viewKey`, `conditions[]` | Apply ad-hoc filter conditions to a list page |
| `list_saved_views` | `viewKey?` | List available saved views (all scopes visible to user) |
| `create_saved_view` | `name`, `viewKey`, `conditions[]`, `sortConfig[]` | Create a new saved view from natural language |

### Fallback Behaviour

When the AI cannot match a user request to existing data:
1. **View not found** → Try fuzzy match → If no match, offer to create an ad-hoc filter
2. **Entity not found** → Clarify which module/entity type the user means
3. **Action not permitted** → Explain the permission requirement, suggest contacting admin
4. **Ambiguous request** → Present top 2-3 interpretations and ask user to choose

## 13. Metadata-Driven DataTable Pattern

The `data_view_fields` table is the **automation engine** for all list pages. It defines every column, filter, sort option, and LOV dropdown for every entity list. When a new business module is added (e.g., E14 Finance, E17 AR), developers:

1. Add a `DataView` row (e.g., `viewKey: 'JOURNAL_ENTRIES'`)
2. Seed `DataViewField` rows for each column (field key, type, visibility, filter settings, LOV config)
3. Done — the T1 Entity List template auto-generates all filter UI, column management, sort options, and LOV dropdowns from the metadata

### 3-Tier LOV Strategy

| Tier | LOV Type | When Loaded | Example |
|------|----------|-------------|---------|
| Static | `STATIC` | Never loaded — inline JSON values in `lovStaticValues` | Status enums, Yes/No, Priority levels |
| Global | `GLOBAL` | Once on login, cached in Zustand store | Currencies, Departments, VAT Codes |
| View-Specific | `VIEW_SPECIFIC` | Lazy-loaded when filter modal opens, via batch endpoint | Customer names, Item codes, Employee names |

For VIEW_SPECIFIC LOVs with >50 items, search is server-side with debounce. The `lovSearchMin` field controls the character threshold before search triggers.

### Bundled Init Endpoint

`GET /views/init?viewKey=INVOICES` returns everything in one call: data_view, fields, date_presets, saved_views, user_column_preferences. This avoids the waterfall problem of 4-5 sequential API calls on page mount. Redis caches metadata with 1hr TTL; user-specific data is always fresh.

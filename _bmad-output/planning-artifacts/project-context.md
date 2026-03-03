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
| **E5b** | **AI Co-Pilot Intelligence** (memory system with hybrid search + temporal decay, skills registry with progressive disclosure, dynamic context assembly, per-module skill packs, memory/skills management UI) |
| **E5c** | **AI Administration & Autonomous Workflows** (admin UI for models/prompts/agents/skills, prompt variable binding, automation engine with scheduled/event/chained workflows, automation builder & monitoring) |
| **E5d** | **AI Knowledge Evolution & Cross-Tenant Intelligence** (per-tenant knowledge base with RAG, correction loop, training examples, cross-tenant anonymised intelligence, platform knowledge distribution, vendor product intelligence dashboard) |
| E6 | Web Frontend Shell + Mobile Scaffold |
| E7 | Saved Views / Filters / Columns (metadata-driven DataTable, 6-table schema, Simple + Advanced filters, favourites) |
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
11. **Epic Page Approval Gate + v0 Design Generation** — before starting any Epic with frontend stories, run `/bmad-bmm-pre-epic-frontend-design {EPIC_ID}`. This workflow: (a) analyses the epic's UI requirements and creates a page inventory with T1–T8 template assignments, (b) generates a v0 prompt using the Concept D base template + epic-specific screens, (c) Mohammed reviews, runs in v0, and approves. v0 reference components are saved to `apps/web/src/components/v0-reference/epic-{ID}/`. No implementation begins without this approval. See `_bmad/bmm/workflows/3-solutioning/pre-epic-frontend-design/`.
12. **8-Document Rule** — SM, Dev, and TEA agents must reference ALL 8 key specification documents (PRD, Architecture, UX Design Specification, API Contracts, Data Models, Event Catalog, State Machine Reference, Business Rules Compendium) when creating stories, acceptance criteria, or test plans
13. **Visual Design Fidelity Rule (Concept D)** — All frontend components MUST match the approved Concept D prototype (`_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`). This means: (a) Shadcn UI components must be restyled to use the purple theme, not stock defaults; (b) typography must use Plus Jakarta Sans for headings, Inter for body, JetBrains Mono for amounts/codes; (c) cards must use 12px radius, custom shadows with purple-tinted hover; (d) animations (fadeInUp, slideIn, stepIn) must be present with `prefers-reduced-motion` respect; (e) the sidebar, header, and Co-Pilot drawer must visually match the prototype. Dev agents must open the prototype HTML in a browser and verify visual parity before marking any frontend story as complete.
14. **Login Page Branding** — The login page must include the purple "N" logo mark, "Nexa ERP" in Plus Jakarta Sans bold, and use the full Concept D visual language (purple primary button, branded card styling, `#f4f2ff` background). No generic/unstyled login pages.
15. **Per-Epic AI Integration Section** — Every epic MUST include an "AI Integration" section defining: (a) tools/functions the AI gains; (b) context injected into the system prompt; (c) example user queries the AI should handle. This ensures the Co-Pilot grows capability with each epic.
16. **Per-Epic AI Registration (4 Seeds)** — Every business module epic MUST include ALL FOUR of the following seed files:
    - (a) **Skill Pack** (`packages/db/prisma/seeds/skill-packs/<module>.ts`) — registers AI skills with trigger phrases, negative triggers, orchestration patterns, and required tools. Skills tell the AI HOW to do things.
    - (b) **Module Knowledge** (`packages/db/prisma/seeds/module-knowledge/<module>.ts`) — registers domain knowledge (OVERVIEW, ENTITIES, WORKFLOWS, BUSINESS_RULES, FAQ, TERMINOLOGY). Knowledge tells the AI WHAT things are.
    - (c) **Tool Definitions** (`packages/ai-tools/src/modules/<module>.ts`) — defines query tools (reads) and action tools (writes) with JSON Schema input definitions. Tool handlers are registered in the module's Fastify plugin via `queryExecutor.registerHandler()` and `actionExecutor.registerHandler()`. Tools are what actually DO the work.
    - (d) **Entity Triggers** (`packages/db/prisma/seeds/entity-triggers/<module>.ts`) — registers trigger words for inline chat autocomplete (e.g., "invoice" → CustomerInvoice, "contact" → Contact with scope to customer). Entity triggers enable natural language entity mentions in the chat textbox.
    See E5b appendices for seed patterns for all four.

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

### Per-Epic AI Skill Packs

Each epic adds a **skill pack** to the `ai_skills` table (see §14 Skills Architecture and §15 Seeding Pattern). Skills use progressive disclosure (L0→L1→L2) to keep token budgets manageable. Each epic also registers tools the AI can invoke. Example for E7:

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
5. **Missing required parameters** → List all missing fields with descriptions and ask the user to supply them before proceeding (see §19 — mandatory parameter gathering rule)

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

## 14. AI Skills Architecture (E5b)

The AI Co-Pilot uses a **database-driven skills registry** with **progressive disclosure** to manage capabilities at scale. This is the mechanism by which each new module automatically extends the AI's abilities.

### Three-Level Progressive Disclosure

To avoid loading 100+ skill definitions into every AI session (which would exhaust the token budget), skills are loaded in three levels:

| Level | Loaded When | Token Cost | Contains |
|-------|------------|------------|----------|
| **L0: Meta-Router** | Every session | ~200 tokens | Module list + 1-line descriptions. Routes user intent to the correct module |
| **L1: Module Pack** | After L0 identifies module | ~500 tokens | All skills for that module with trigger phrases. Selects the best-matching skill |
| **L2: Skill Instructions** | After L1 selects skill | ~300 tokens | Full instructions, parameters, examples, required tools |

Total per-request skill overhead: ~1000 tokens (not 5000+).

### Skill Pack Per Module

Each business module epic seeds a skill pack into the `ai_skills` table:

| Epic | Module | Example Skills |
|------|--------|---------------|
| E7 | views | `open_entity_list`, `search_views`, `apply_filter`, `list_saved_views`, `create_saved_view` |
| E14 | finance | `open_chart_of_accounts`, `create_journal_entry`, `view_trial_balance`, `explain_account_balance` |
| E17 | ar | `create_invoice`, `post_invoice`, `apply_payment`, `view_aging_report`, `email_statement` |
| E18 | purchasing | `create_po`, `approve_po`, `receive_goods`, `view_po_status` |

### Trigger Phrase Engineering

Each skill has:
- **Positive triggers** (String[]): Phrases that activate — "show overdue", "open invoices view"
- **Negative triggers** (String[]): Phrases that must NOT activate — "create invoice" ≠ "create a view"
- **Priority** (Int): When multiple skills match, highest priority wins
- **Context required** (String[]): Conditions that must hold — e.g., `["screen:entity-list", "module:ar"]`

### Five Orchestration Patterns

| Pattern | When Used | Example |
|---------|-----------|---------|
| SEQUENTIAL | Steps must run in order | Create invoice → post → email |
| PARALLEL | Independent actions | Fetch customer + items + terms simultaneously |
| ITERATIVE | Refinement loop | Filter → "also over £1000" → refine filter |
| CONTEXT_AWARE | Depends on current screen | "Filter" on list page ≠ "filter" on detail page |
| DOMAIN_INTELLIGENCE | Requires business knowledge | "Cash position?" → GL + bank + AR + AP |

### Module Knowledge Registry

Each module seeds structured domain knowledge into `ai_module_knowledge` (system-wide, no companyId):

| Knowledge Type | Purpose | Example |
|---------------|---------|---------|
| `OVERVIEW` | What the module does, key entities, key metrics | "AR manages money owed TO the company by customers" |
| `ENTITIES` | Entity definitions with fields, status flows, relationships | "Customer Invoice: status DRAFT→POSTED→PAID, cannot post without lines" |
| `WORKFLOWS` | Step-by-step business processes | "Month-end close: reconcile bank → post adjustments → lock period" |
| `BUSINESS_RULES` | Domain constraints and validation rules | "Payment allocation: FIFO by default, credit limit blocks new invoices" |
| `FAQ` | Common user questions with query patterns | "How many overdue invoices? → COUNT WHERE dueDate < today AND status = POSTED" |
| `TERMINOLOGY` | Business terms and their ERP-specific meanings | "DSO = Days Sales Outstanding = average days to collect payment" |

This is what separates "AI tool router" from "AI business expert." Skills tell the AI HOW to create an invoice. Knowledge tells the AI WHAT an invoice is, WHAT rules apply, and WHAT users commonly ask about.

### Tool Framework (E5b.S2)

The missing layer between "AI routes to a skill" and "the skill actually does something." Two executor types:

| Executor | Purpose | Approval | Example |
|----------|---------|----------|---------|
| **QueryExecutor** | READ tools — fetch data for AI reasoning | No (read-only, RBAC-checked) | `get_aging_report`, `search_invoices`, `get_cash_flow` |
| **ActionExecutor** | WRITE tools — modify data on user's behalf | Yes (always via ActionPlanner) | `create_invoice`, `post_journal`, `send_email` |

Both use a **registry pattern** — modules register handlers at startup:
```typescript
queryExecutor.registerHandler('get_aging_report', handler);   // READ
actionExecutor.registerHandler('CREATE_INVOICE', handler);     // WRITE
```

QueryExecutor enforces: companyId scoping, RBAC permission check, result size limits (max rows), token budget awareness (truncate if too large for context), **mandatory parameter validation** (all `required` fields in `inputSchema` must be present — see §19). ActionExecutor (from E5) enforces: transaction wrapping, guardrail chain, user confirmation, **mandatory parameter validation** (incomplete proposals must never be staged — see §19).

When a skill is activated (L2), its `requiredTools` are resolved from the registry and passed to the AI Gateway as the `tools` array. Only the tools the active skill needs are sent — not all registered tools.

**Architecture note:** The existing `packages/ai-tools/` package (currently empty stub from E5) is populated with tool definition objects per module. Architecture spec §6.4 (Skill Registry) needs updating to reflect the progressive disclosure model and tool framework — the 11 MVP skills listed there should be remapped to E5b's skill pack + tool definition structure.

### Inline Entity Mentions (E5b.S7)

The chat textbox supports **natural language entity autocomplete** — when the user types a recognised entity keyword ("contact", "invoice", "customer"), context-aware suggestions appear:

```
User types: "Send invoice 1042 as email to contact jo..."
                                            ↑
                         Dropdown: John Smith (john@acme.com)
                                   Jane Jones (jane@acme.com)
```

Key design decisions:
- **No special prefix character** (no `/` or `@`) — trigger words are natural language ("contact", not "/contact")
- **Context-scoped** — "contact" after mentioning a customer scopes to that customer's contacts
- **Entity Trigger Registry** — `ai_entity_triggers` table maps trigger words → entity types → search endpoints → display fields. Seeded per-module
- **Client-side trigger detection** — triggers are cached client-side (1hr TTL). Only the entity search itself hits the server
- **Structured references** — selected entities become `{entityType:uuid}` in the AI payload, eliminating ambiguity

### Dynamic Context Assembly

On each AI session, the system prompt is built from live data. Two modes:

**INTERACTIVE mode** (chat sessions) — total budget ~5000 tokens:
```
Base system prompt (~500 tokens)
+ User memories from hybrid search (~2000 tokens) [from ai_memories via E5b.S1/S4]
+ Active skill chain L0→L1→L2 (~1000 tokens) [from ai_skills via E5b.S2]
+ Module knowledge for active module (~500 tokens) [from ai_module_knowledge via E5b.S2]
+ User permissions summary (~200 tokens) [from access groups]
+ Current screen context (~300 tokens) [from frontend state]
+ Tenant knowledge via RAG (~500 tokens) [from ai_knowledge_articles via E5d — when available]
= ~5000 tokens total
```

**AUTONOMOUS mode** (E5c automations) — total budget ~3000 tokens:
```
Base system prompt (~500 tokens)
+ Module knowledge (~500 tokens) [from ai_module_knowledge]
+ Skill instructions (~1000 tokens) [from ai_skills]
+ Automation input data (~1000 tokens) [from step config / previous step output]
= ~3000 tokens total (NO user memories, NO screen context — no user session)
```

### Shared Vector Infrastructure (E5b.S4)

E5b creates shared services that E5d reuses:
- **`VectorSearchService`** — pgvector similarity search, BM25 keyword search, Reciprocal Rank Fusion, MMR re-ranking. Used by both memory search (E5b) and knowledge RAG (E5d)
- **`EmbeddingService`** — generates embeddings via AI Gateway, batch-capable, with caching. Used by both memory embeddings (E5b) and knowledge chunk embeddings (E5d)
- **pgvector extension** — installed once in E5b.S4 migration (`CREATE EXTENSION IF NOT EXISTS vector`), shared by all vector columns

### Memory System (OpenClaw-Inspired)

The memory system uses:
- **Hybrid search**: BM25 keyword (PostgreSQL tsvector) + pgvector semantic (cosine similarity), fused via Reciprocal Rank Fusion (weights: keyword 0.3, semantic 0.7)
- **Temporal decay**: `effectiveScore = baseScore * 0.5^(daysSinceAccess / halfLife)` where halfLife=30 days
- **MMR re-ranking**: Maximal Marginal Relevance (lambda=0.7) ensures injected memories are diverse, not redundant
- **Pre-compaction flush**: Before conversation context is trimmed, important facts are extracted and stored as new memories (with semantic dedup check at cosine similarity threshold 0.85)

### Report Configuration (Planned for E25)

Reports use **separate tables** from E7's data_view_fields because reports have fundamentally different features: aggregation (count/sum/avg per column), hierarchical grouping with custom headers, computed columns, and cross-entity joins. Schema: `report_definitions` + `report_columns`. See E5b epic appendix for full schema.

## 15. Per-Epic AI Skill Pack Seeding Pattern

When implementing a new business module epic, developers MUST:

1. Create a skill pack seed file: `packages/db/prisma/seeds/skill-packs/<module>.ts`
2. Define skills with: `skillKey`, `name`, `description`, `triggerPhrases[]`, `negativeTriggers[]`, `orchestrationPattern`, `requiredTools[]`, `contextRequired[]`, `priority`, `examples[]`
3. Register the seed in the module's migration script
4. Document the skills in the epic's "AI Integration" section

Example seed structure:
```typescript
export const arSkillPack: SkillPackSeed = {
  moduleKey: 'ar',
  packKey: 'ar-core',
  skills: [
    {
      skillKey: 'create_invoice',
      name: 'Create Customer Invoice',
      triggerPhrases: ['create invoice', 'new invoice', 'bill customer'],
      negativeTriggers: ['view invoice', 'find invoice'],
      orchestrationPattern: 'SEQUENTIAL',
      requiredTools: ['create_customer_invoice', 'add_invoice_line'],
      contextRequired: ['module:ar'],
      priority: 100,
    },
  ],
};
```

This ensures the AI Co-Pilot grows capabilities automatically with every module added.

## 16. Autonomous AI Workflows (E5c)

Nexa supports **goal-oriented agent automations** — scheduled or event-triggered workflows where AI agents work autonomously to achieve business goals, with results chaining into subsequent automations.

### Three AI Capability Tiers

| Tier | Epic | What the AI Can Do |
|------|------|--------------------|
| **Reactive** | E5 | Respond to user chat, execute actions on request |
| **Intelligent** | E5b | Remember, learn, route skills, build context dynamically |
| **Autonomous** | E5c | Run goal-oriented workflows on schedule, chain agents, produce actionable results |

### Trigger Types

- **SCHEDULED**: Cron-based (e.g., "every weekday at 7am")
- **EVENT**: In response to system events (e.g., "when invoice becomes 30 days overdue")
- **CHAIN**: After a previous automation completes (output of A → input of B)
- **MANUAL**: Admin clicks "Run Now" for testing or one-off execution

### Prompt Variable Binding

Prompt templates support variables (`{{customer.name}}`, `{{today - 30 days}}`) that resolve from:
- **DB_FIELD**: Direct database field lookup (scoped by companyId)
- **DB_QUERY**: Arbitrary SQL query result
- **PAGE_FIELD**: Current frontend page state (for chat-context prompts)
- **SYSTEM**: Built-in variables (today, currentUser, company)
- **PREVIOUS_STEP**: Output from a previous automation step
- **CONSTANT**: Static value configured in automation
- **EXPRESSION**: Evaluated expression (date arithmetic, string operations)

### Safety: Circuit Breaker

If an automation fails 3 consecutive times, it is auto-paused and admins are notified. This prevents runaway token usage on broken automations.

### Development Rule

17. **Automations respect token budgets** — every automation run has a `maxTokenBudget` (default: 50,000 tokens) and `maxDurationMs` (default: 5 minutes). If either limit is exceeded, the run is terminated gracefully with status CANCELLED.

## 17. AI Administration UI (E5c)

All AI infrastructure from E5 (10 Prisma models) and E5b (enhanced skills, memories) must be configurable through admin screens. E5c provides:

| Admin Screen | Purpose | Who Uses It |
|-------------|---------|-------------|
| AI Configuration Dashboard | Overview of all AI infrastructure health | ADMIN |
| Model Registry | CRUD for LLM models, costs, routing, fallbacks | ADMIN |
| Prompt Template Editor | Rich editor with variable binding, version history, diff, live preview | ADMIN |
| Agent Configuration | Model/prompt/tool/guardrail assignment | ADMIN |
| Skill Pack Manager | View/edit/test skills and trigger phrases | ADMIN |
| Automation Builder | Visual workflow builder with schedule and step configuration | ADMIN, MANAGER |
| Automation Run History | Execution logs, per-step details, retry/skip actions | ADMIN, MANAGER |

Without these screens, AI configuration requires direct database access — which defeats the purpose of a self-service AI-First ERP.

## 18. AI Knowledge Evolution & Learning Loop (E5d)

The AI improves over time through a two-level learning loop:

### Level 1: Per-Tenant Knowledge (Tenant DB)

Each tenant builds a private knowledge base that makes the AI smarter for THEIR business:

- **Knowledge Articles** — Admin-uploaded SOPs, business terminology, industry rules, custom field definitions. Chunked and embedded for RAG retrieval
- **Training Examples** — Curated input/output pairs ("When user asks X, correct answer is Y"). Injected as few-shot examples
- **Correction Loop** — Every user correction to an AI response is logged. After 3+ corrections on the same topic, a draft knowledge article is auto-generated for admin review
- **RAG Pipeline** — On each AI query, relevant knowledge chunks are retrieved via pgvector similarity search and injected into the context (~1000 token budget)
- **Learning Signals** — Daily aggregated per-skill metrics: success rate, correction rate, confidence trend

### Level 2: Cross-Tenant Intelligence (Platform DB)

Anonymised aggregate patterns flow to the vendor for product intelligence:

- **Feature Gap Detection** — AI queries that fail across many tenants = unbuilt features
- **Default Optimisation** — Configurations >60% of tenants create manually should be system defaults
- **Workflow Discovery** — Repeated manual patterns across tenants = automation opportunities
- **Skill Effectiveness** — Cross-tenant success/correction rates per skill, with trend tracking
- **Industry Benchmarks** — Patterns grouped by tenant industry for industry-specific AI tuning

### Privacy Rules

- No tenant data crosses boundaries — only anonymised statistics (counts, percentages, categories)
- Tenants can opt-out of cross-tenant sharing entirely (`ai_knowledge_settings.shareAnonymisedPatterns`)
- No model fine-tuning on tenant data — knowledge is injected via RAG at runtime only
- Platform knowledge is suggestions — tenant admin must accept before it enters their knowledge base
- GDPR compliant — automated PII verification on all cross-tenant data flows

### Knowledge Confidence Hierarchy

| Source | Base Confidence | Description |
|--------|----------------|-------------|
| Admin uploaded | 1.0 | Admin explicitly added this knowledge |
| Platform suggested + accepted | 0.9 | Vendor best practice, confirmed by tenant |
| AI-generated + confirmed | 0.8 | AI detected pattern, admin confirmed |
| Correction-derived | 0.7 | Generated from repeated user corrections |
| AI-generated (unconfirmed) | 0.5 | Auto-detected, awaiting admin review |

### Development Rule

18. **Cross-tenant data flows use anonymisation service** — Any data leaving a tenant DB for the platform MUST go through the anonymisation service which strips all PII and is verified by automated PII detection tests. No entity names, amounts, user names, or email addresses cross tenant boundaries.

## 19. Mandatory Parameter Gathering Before Tool Execution (AI Orchestrator Rule)

The AI orchestrator MUST validate that all **required** parameters for a tool are present BEFORE executing it. If any required parameter is missing, the AI MUST ask the user for the missing information — it must NEVER call a tool with incomplete required parameters or guess/default values for mandatory business data.

### The Rule

Every tool definition has an `inputSchema` with a `required` array. Before the orchestrator invokes any tool (query or action):

1. **Check all `required` fields** in the tool's `inputSchema` — both top-level and nested (e.g., `required` inside `items` of an array property)
2. **If any required field is missing** from the AI's proposed tool call → the orchestrator MUST NOT execute the tool. Instead, it MUST prompt the user for the missing values
3. **Optional fields may be omitted** — the tool executes without them using service-layer defaults
4. **No silent defaults for business data** — the AI must never invent values for quantity, price, date, account, tax code, or any business-meaningful field marked as required. The user must supply them explicitly

### Example

```
User: "Create an invoice for Customer ABC for item LM08"

AI analysis:
  Tool: create_customer_invoice
  Required params: customerId ✓ (resolved "ABC" → uuid), lines[].itemId ✓ (resolved "LM08" → uuid),
                   lines[].quantity ✗ MISSING, lines[].unitPrice ✗ MISSING

AI response: "I can create that invoice. I need a couple more details:
  - What quantity of LM08?
  - What unit price? (or should I use the item's default price £24.50?)"

User: "5 units at default price"

AI: Now all required params present → call create_customer_invoice
```

### Implementation Requirements

- **Tool `inputSchema` must be complete** — every field that the business logic requires must be in the `required` array. Tool authors must not mark genuinely mandatory fields as optional
- **Nested validation** — for tools with array inputs (e.g., invoice lines), required fields inside the array item schema must also be validated per item
- **Smart resolution before prompting** — the AI should first attempt to resolve values from context (e.g., item default price, customer default payment terms) before asking the user. Only ask for values that genuinely cannot be inferred
- **Batch gathering** — when multiple required fields are missing, ask for ALL of them in one prompt, not one at a time
- **Action tools (writes)** — this validation happens BEFORE the ActionPlanner stages the proposal. An incomplete proposal must never be shown to the user for confirmation
- **Query tools (reads)** — same rule applies; a search with a required filter missing should prompt, not return unscoped results
- **Automation context (E5c)** — for autonomous workflows, all required parameters must be resolvable from the variable binding system (DB_FIELD, PREVIOUS_STEP, SYSTEM, etc.). If a required variable cannot be resolved at runtime, the automation step FAILS with a clear error — it does not proceed with partial data

### Per-Epic Responsibility

When defining tool `inputSchema` for any business module epic (E14+), developers MUST:
1. Mark all business-critical fields as `required` (quantity, amounts, entity references, dates)
2. Mark truly optional fields (notes, tags, description) as optional
3. Include `description` on every parameter so the AI can explain what it needs when prompting the user
4. Test that the orchestrator correctly blocks execution when required fields are removed from the tool call

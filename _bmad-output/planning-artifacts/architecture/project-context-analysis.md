# Project Context Analysis

## Requirements Overview

**Functional Requirements:**

99 MVP FRs across 13 capability areas (plus 58 Phase 2/3 FRs + 22 cross-cutting FRs = 192 total), organised by architectural weight:

| Category | FRs | Architectural Weight | Key Implication |
|----------|-----|---------------------|-----------------|
| AI Interaction & Intelligence | FR1-10 | **HIGHEST** | AI orchestration layer is the system's interaction paradigm — intent recognition, context engine, action planning, guardrails, daily briefings. Must compose across all 10 modules. |
| Finance / GL | FR11-18 | HIGH | Double-entry enforcement, period management, multi-currency, bank reconciliation. Foundation that all sub-ledgers post into. |
| Accounts Receivable | FR19-25 | HIGH | Customer entity (~80 fields target), invoice lifecycle (draft→approved→posted), payment allocation, credit notes, aging, multi-address. |
| Accounts Payable | FR26-32 | HIGH | Supplier entity, bill lifecycle, BACS payment generation, 3-way matching (PO→GRN→Invoice), OCR bill ingestion. |
| Sales Management | FR33-40 | HIGH | Quote→Order→Shipment→Invoice lifecycle. Stock availability checks during order entry. Currently SKELETON in legacy target — must be rebuilt. |
| Purchasing | FR41-45, FR154 | MEDIUM | PO lifecycle, goods receipt with barcode scanning (full/partial), reorder suggestions. |
| Inventory & Stock | FR46-53 | HIGH | Item entity must move from 4 typed fields to ~50+ relational fields. Serial/batch tracking, multi-warehouse, BOM integration, stock movements must be ACID. |
| CRM | FR54-58 | MEDIUM | Contact/account management, activity logging, lead conversion, pipeline. CRM-to-Sales integration is critical. |
| HR & Payroll | FR59-67 | HIGH | UK-specific: RTI, BACS payroll, auto-enrolment pension, statutory payments. Employee entity needs ~30+ typed fields. External payroll API (Staffology/PayRun.io). |
| Manufacturing | FR68-73 | MEDIUM | BOM, work orders, routing, scheduling, material consumption. Already reasonably complete in target. |
| Reporting | FR74-79, FR153 | MEDIUM | 10 P0 financial/operational reports + NL ad-hoc queries via AI. PDF/CSV export. AI-driven cash flow forecasting. |
| Administration | FR80-88 | MEDIUM | RBAC (5 roles), module gating, settings engine, integration management, number series, data import, audit logs. |
| Compliance & VAT | FR89-94, FR155-157 | HIGH | VAT calculation (5 rates), MTD submission, immutable audit trail, period locks, GDPR operations, fraud detection (duplicate payments, suspicious transactions, anomaly reporting). |
| Multi-Company | FR171-174 | **HIGHEST** | companyId on every table, company switching, RegisterSharingRule, query scoping. Foundation for all other modules. |
| Company RBAC | FR175-177 | HIGH | Global role + per-company overrides via UserCompanyRole. Resolution: specific → global → no access. |
| i18n / Localization | FR178-180 | HIGH | Translation key system, locale-based formatting, user/company language preference. All UI text via `t()` from Day 1. |
| Cross-Cutting Tasks | FR181-183 | MEDIUM | Tasks from any record, multi-assignee, polymorphic entity binding. |
| Notifications | FR184-186 | HIGH | In-app + push + email channels. Event-driven. User preferences. Core infrastructure for approval workflows. |
| Email Integration | FR187-189 | HIGH | SMTP outbound for business documents. Per-company SMTP config. Email templates with merge fields. |
| Printer Management | FR190-192 | MEDIUM | PDF generation + browser Print API. Auto-print on save. Per-user/company preferences. |

**Non-Functional Requirements:**

45 NFRs that drive architectural decisions, grouped by architectural impact:

| NFR Category | Count | Architecture-Driving Requirements |
|-------------|-------|----------------------------------|
| **Performance** | 7 | AI responses <3s (NFR1), CRUD <500ms (NFR2), reports <5s (NFR3), 50 concurrent users/tenant (NFR7) |
| **Security** | 9 | Database-per-tenant isolation (NFR9), MFA (NFR10), immutable audit trail (NFR14), AI never auto-executes financials (NFR16) |
| **Reliability** | 6 | 99.9% uptime (NFR17), zero data loss / ACID (NFR18), AI layer degradation must not break traditional UI (NFR21) |
| **Scalability** | 4 | 1,000 tenants (NFR23), 1M txn/year/tenant (NFR24), per-tenant migrations without downtime (NFR25), 60s provisioning (NFR26) |
| **Accessibility** | 4 | WCAG 2.1 AA (NFR27), keyboard navigation (NFR28), screen reader for AI chat (NFR30) |
| **Integration** | 5 | Retry with exponential backoff (NFR31), HMRC timeout compliance (NFR32), no duplicate bank transactions (NFR33) |
| **Data Integrity** | 5 | Double-entry at DB level (NFR36), period locks at DB level (NFR37), fixed-point decimal (NFR38), append-only audit (NFR39), 6-year retention (NFR40) |
| **Maintainability** | 5 | TypeScript strict (NFR41), Opus 4.6 exclusively (NFR42), 80% test coverage for business logic (NFR43), versioned migrations (NFR44), OpenAPI docs (NFR45) |

**Scale & Complexity:**

- Primary domain: **Full-stack web application (TypeScript/Node.js, React, PostgreSQL)**
- Complexity level: **ENTERPRISE**
- Estimated architectural components: **~15-20** (AI orchestration, API gateway, auth service, 10 module services/domains, event bus, integration adapters, reporting engine, admin/config, background job processor)

Complexity drivers:
1. **10 ERP modules** with deep cross-module integration (not 10 independent apps)
2. **AI orchestration layer** that composes across all modules — the primary interaction paradigm
3. **UK regulatory compliance** — HMRC MTD, RTI, auto-enrolment, GDPR, Companies House
4. **Database-per-tenant** — connection routing, per-tenant migrations, credential isolation
5. **Legacy parity requirement** — 300+ business rules from HAL, 3,170 legacy fields informing schema design
6. **5 external integration families** with distinct protocols and failure modes
7. **Financial integrity invariants** enforced at database level (double-entry, period locks, immutable audit)

## Technical Constraints & Dependencies

| Constraint | Source | Architectural Impact |
|-----------|--------|---------------------|
| **All code via Claude Opus 4.6** | PRD NFR42, user directive | Development tooling and workflow design |
| **TypeScript strict mode** | PRD NFR41 | Full-stack type safety, shared types between client/server |
| **PostgreSQL** | Vision doc, PRD | Relational model, pgvector potential, database-per-tenant |
| **Prisma ORM** | Existing target codebase | Schema-first, migration tooling, but must evaluate for financial integrity constraints (DB-level enforcement) |
| **React** | Vision doc, PRD | Component-based UI with conversational + traditional form paths |
| **Database-per-tenant** | PRD, user architectural decision | No tenant_id columns. Connection routing at infrastructure level. Per-tenant migration orchestration. |
| **Single base currency + FX** | PRD, MIGRATION_MAP D-5 | Not dual-base like legacy. Simplified but must handle all multi-currency scenarios. |
| **External payroll API** | PRD, D-4 | UK payroll calculations delegated to Staffology/PayRun.io. Architecture must handle API-dependent critical path. |
| **80% test coverage (business logic)** | PRD NFR43 | Test architecture must be planned alongside code architecture |
| **OpenAPI/Swagger** | PRD NFR45 | API-first design, contract-driven development |
| **HMRC API compliance** | PRD, domain requirements | Must meet HMRC timeout windows, authentication (Government Gateway OAuth), and submission formats |
| **Immutable audit at DB level** | PRD NFR39 | Append-only tables, no UPDATE/DELETE on audit records — DB-level triggers or constraints |
| **Fixed-point decimal** | PRD NFR38 | All monetary fields use DECIMAL, not FLOAT. Prisma Decimal type throughout. |

**Key Dependencies (External):**
- HMRC MTD API + Government Gateway OAuth
- HMRC RTI API
- Bank feed provider (Plaid / TrueLayer / Yapily)
- UK payroll API (Staffology or PayRun.io)
- Pension provider API (NEST / People's Pension)
- Exchange rate feed (Bank of England)
- OCR service (for bill/receipt scanning)
- Email service (SMTP/IMAP for invoice delivery and bill ingestion)
- LLM API (Claude) for AI orchestration

## Cross-Cutting Concerns Identified

These concerns span multiple modules and must be addressed architecturally rather than per-module:

| # | Concern | Affected Modules | Architectural Approach Needed |
|---|---------|-----------------|------------------------------|
| 1 | **AI Orchestration Layer** | ALL 10 modules | Central layer: intent recognition → action planning → module API composition → guardrails → response. Must maintain session context, user preferences, and full business state awareness. |
| 2 | **OKFlag / Approval State Machine** | Finance, AR, AP, Sales, Purchasing, HR, Manufacturing | Universal pattern: Draft→Approved→Posted with side-effects on transition (GL postings, stock updates, notifications). Un-approve must reverse all effects. Needs generic state machine framework. |
| 3 | **Double-Entry Bookkeeping** | Finance, AR, AP, Sales, Purchasing, Fixed Assets | Every sub-ledger posting creates balanced journal entries. Must be enforced at DB level (constraint or trigger). ~30% of auto-posting from sub-ledgers currently implemented. |
| 4 | **Immutable Audit Trail** | ALL financial modules | Append-only audit log. Every financial modification recorded with before/after, user, timestamp, AI flag. Cannot UPDATE or DELETE audit records. |
| 5 | **RBAC + Module Gating** | ALL modules | 5 roles × module access matrix. Every API endpoint checks role + module permission. UI hides inaccessible modules. |
| 6 | **Multi-Currency** | AR, AP, Sales, Purchasing, Banking | Single base currency + foreign currency amounts + exchange rate at transaction date. Rate feeds, revaluation, gain/loss calculations. |
| 7 | **Number Series** | AR, AP, Sales, Purchasing, HR, Manufacturing | Configurable prefix + sequential counter per document type. Must handle concurrent creation without gaps or duplicates. |
| 8 | **Event-Driven Backbone** | ALL modules | Business events emitted for every state change. AI context engine subscribes. Enables cross-module awareness (e.g., sales order triggers stock check, approved invoice triggers AR update). |
| 9 | **Period Locking** | Finance, AR, AP | Closed financial periods prevent all modifications. Enforced at DB level. Must handle period-spanning transactions. |
| 10 | **Bank Integration** | Finance, AR, AP | Transaction ingestion (feeds/import), AI-powered matching, reconciliation, BACS payment generation. Shared infrastructure across modules. |
| 11 | **UK Compliance** | Finance (VAT/MTD), HR (RTI/pension), Reporting (iXBRL) | Regulatory APIs, statutory calculations, document generation. Must be current with HMRC rules and tax tables. |
| 12 | **Schema Evolution (JSON→Relational)** | Inventory (Item), HR (Employee), AR (Customer), Sales (Quote/Order) | Critical entities must move from JSON blobs to typed Prisma columns. Architecture must support this migration path cleanly. |
| 13 | **Database-per-Tenant Routing** | Infrastructure (all modules) | Request → resolve tenant → connect to correct database. Migration orchestration across all tenant databases. Connection pooling strategy. |
| 14 | **AI Graceful Degradation** | ALL modules | If AI layer is unavailable (NFR21), all traditional form operations must continue. Architecture must not couple module functionality to AI availability. |
| 15 | **Multi-Company (companyId)** | ALL tables | Every table has companyId FK. Every query scopes by companyId. RegisterSharingRule allows per-entity, per-company sharing. Company model replaces singleton Company. See project-context.md §1. |
| 16 | **Company-Specific RBAC** | ALL modules | UserCompanyRole: global role (companyId=NULL) + per-company exceptions. Resolution: company-specific → global → no access. See project-context.md §2. |
| 17 | **i18n / Localization** | ALL modules | Translation key system from Day 1. All user-facing text via `t('key')`. English-only MVP but zero-code-change language addition. See project-context.md §3. |
| 18 | **Cross-Cutting Tasks** | ALL modules | Tasks created from any record, assigned to multiple users. Polymorphic entity binding (entityType/entityId). See project-context.md §4. |
| 19 | **Notifications (Core)** | ALL modules | In-app (WebSocket), Push (Expo), Email. Event-driven triggers: approvals, task assignments, status changes, AI alerts. User per-channel preferences. See project-context.md §5. |
| 20 | **Email Integration (Core)** | AR, AP, Sales, Purchasing, HR | SMTP outbound from first business module (invoices, POs, payslips, statements). Inbound (IMAP) deferred to Phase 2. See project-context.md §6. |
| 21 | **Printer Management** | AR, AP, Sales, Purchasing | PDF generation (Puppeteer) + browser Print API. Auto-print on save configurable per user per document type. See project-context.md §7. |

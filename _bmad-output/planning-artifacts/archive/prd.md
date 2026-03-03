---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
classification:
  projectType: saas_b2b
  domain: erp
  complexity: high
  projectContext: greenfield
inputDocuments:
  - docs/spec-pack/REPO_MAP.md
  - docs/spec-pack/MANUAL_EXTRACT.md
  - docs/spec-pack/DATA_MODEL.md
  - docs/spec-pack/CODE_REQUIREMENTS.md
  - docs/spec-pack/MIGRATION_MAP.md
  - docs/spec-pack/DIFF_AND_GAPS.md
  - docs/spec-pack/OPEN_QUESTIONS.md
  - docs/spec-pack/UI_MAP.md
  - docs/spec-pack/API_INVENTORY.md
  - docs/spec-pack/SPEC_LEDGER.md
  - docs/spec-pack/QA_PACK.md
  - _bmad-output/planning-artifacts/erp-module-status-summary.md
  - _bmad-output/planning-artifacts/nexa-erp-business-rules-requirements.md
  - _bmad-output/planning-artifacts/extraction-completeness-report.md
  - _bmad-output/planning-artifacts/extraction-contradictions-report.md
  - _bmad-output/ai-first-erp-vision-summary.md
  - _bmad-output/planning-artifacts/_Old_Spec/ (90+ files)
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 0
  specPack: 11
  planningArtifacts: 5
  oldSpec: 90
projectType: greenfield
referenceSources:
  - HansaWorld ERP (HAL legacy codebase)
  - Old_Spec (previous Nexa ERP specifications)
workflowType: prd
---

# Product Requirements Document - nexa-erp-ai-first

**Author:** Mohammed
**Date:** 2026-02-15

## Executive Summary

**Nexa ERP** is an AI-first, cloud-native ERP platform for UK SMEs (10-250 employees). The core differentiator: AI is the interaction paradigm, not a feature. Users talk to the system in natural language to create records, retrieve information, and manage their business. The AI pre-fills records using contextual knowledge; users review, approve, and move on — "told, shown, approve, done."

**Target market:** UK SMEs currently on legacy desktop ERPs (HansaWorld, Sage, custom systems) seeking modern cloud alternatives.

**Product type:** SaaS B2B, database-per-tenant, greenfield codebase. Requirements mined from two legacy sources: HansaWorld ERP (HAL — 1,055 entities, 3,170 fields, 300+ business rules) and Old_Spec (previous Nexa ERP specifications, 90+ documents). No code or design carried forward — requirements only.

**MVP scope:** 10 core business modules (Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR/Payroll, Manufacturing, Reporting) with full AI integration, plus Platform Admin (Super Admin portal for tenant management, billing, AI token metering, and platform operations), plus cross-cutting platform capabilities (multi-company management, i18n, notifications, email integration, tasks, printer management, document templates), plus 8 Phase 2/3 modules (POS, Projects & Job Costing, Contracts & Agreements, Warehouse Management, Service Orders, Fixed Assets, Communications, Intercompany & Consolidation). Multi-company architecture with companyId on every table. AI Gateway service enforces token quotas from day one. First customer: founding company (dogfooding).

**Development approach:** All coding performed exclusively using Claude Opus 4.6. TypeScript/Node.js full-stack.

## Success Criteria

### User Success

1. **Zero-Friction Record Creation** — Users create business records (invoices, purchase orders, stock movements, employee records) via natural language conversation. The AI pre-fills fields using contextual knowledge (customer history, default terms, recent patterns). The user's role is to **review, approve, and move on** — not data entry.

2. **Instant Information Retrieval** — Users ask business questions in plain English ("What's my outstanding AR over 60 days?", "Which items are below reorder point?") and receive immediate, accurate answers with supporting data — no report navigation or filter configuration required.

3. **Role-Based Daily Briefings** — Every user receives a personalised daily summary based on their role, job description, and actual system usage patterns. A Finance Manager sees cash flow alerts and overdue invoices. A Warehouse Manager sees stock alerts and pending shipments. An HR Manager sees leave requests and payroll deadlines.

4. **5-Minute Magic Moment** — A new user connects their data source (bank feed, CSV import, or manual entry) and within 5 minutes experiences the AI proactively organising, categorising, and recommending actions — proving the system understands their business.

5. **Progressive Disclosure** — Power users can always drop into traditional forms for complex operations. The AI path is primary but never forced.

### Business Success

1. **Market Velocity Target** — Nexa ERP becomes the **fastest-selling ERP product in the prior 12 months** within its target segment (UK SMEs, 10-250 employees).

2. **Dogfooding Validation** — The founding company uses Nexa ERP as its own production system across CRM, Manufacturing, HR, and Payroll — proving enterprise readiness through real daily operations.

3. **Revenue Milestones**:
   - **Month 3**: Internal production use (dogfooding) across all 4 founding modules
   - **Month 6**: First 10 paying external customers
   - **Month 12**: Fastest-selling ERP claim substantiated by market data

4. **Retention Target** — <5% monthly churn after month 3 of any customer's lifecycle, indicating genuine stickiness.

### Technical Success

1. **AI Accuracy** — >90% of AI-generated records require no user correction before approval. >95% of natural language queries return accurate, relevant answers.

2. **Response Time** — AI conversational responses within 3 seconds. Traditional UI operations within 500ms. Report generation within 5 seconds for standard reports.

3. **Reliability** — 99.9% uptime. Zero data loss. All financial transactions are ACID-compliant.

4. **Multi-Tenant Isolation** — Database-per-tenant architecture with zero cross-tenant data leakage. Tenant provisioning in <60 seconds.

5. **UK Compliance** — HMRC MTD-compliant VAT returns. RTI payroll submissions. Auto-enrolment pension compliance. GDPR data handling.

### Measurable Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to create an invoice via AI | <30 seconds | From intent to approved record |
| Time to get a financial answer | <5 seconds | From question to accurate response |
| Daily briefing relevance score | >80% useful items | User feedback sampling |
| AI record accuracy (no edits needed) | >90% | Approval vs edit ratio |
| Customer onboarding to first value | <5 minutes | Magic moment metric |
| Monthly customer churn | <5% | After 3-month mark |
| System uptime | 99.9% | Monthly measurement |

## User Journeys

### Journey 1: Sarah — The Business Owner

**Situation:** Sarah runs a 45-person UK manufacturing company. She juggles finance, sales oversight, and strategic decisions. Her current ERP requires navigating 15+ screens to understand her business position each morning.

**Opening Scene:** Monday 8:15 AM. Sarah opens Nexa on her phone. Her personalised daily briefing: 3 overdue invoices totalling £47,200, cash position £128K projected to £89K in 3 weeks, 2 completed work orders ready for dispatch, 1 pending leave request.

**Rising Action:** Sarah speaks: "Chase Acme Corp on that £31K." AI drafts payment reminder email with invoice references, shows draft. She taps "Approve & Send" — 30 seconds. Asks: "How did January compare to December?" AI generates plain-English comparison with chart — revenue up 12%, material costs up 18%, flags margin pressure from steel prices.

**Climax:** "Show me cash flow forecast for next 8 weeks." Projection based on real AR, AP, committed POs — not a manual spreadsheet. AI highlights: "Week 6 tight. Options: accelerate £62K collection or delay Supplier B payment 7 days (no penalty per terms)."

**Resolution:** By 8:30 AM — chased payments, reviewed performance, approved leave, understood 2-month cash position. Zero menus navigated. Previous ERP: 2 hours.

**Requirements:** Daily briefing engine, role-based personalisation, AI email drafting, NL reporting, cash flow forecasting, approval workflows, mobile-first.

---

### Journey 2: David — The Finance Manager

**Situation:** Manages AR, AP, VAT, month-end close. ~200 invoices/month, 3 bank accounts, quarterly VAT returns. Currently 3 days for month-end close.

**Opening Scene:** Briefing: 12 supplier bills via email overnight, 4 customer payments in bank feed, 3 invoices due for posting, VAT deadline in 9 days.

**Rising Action:** "Process the bank feed." AI matched 4 payments to invoices (amount + reference). 3 exact matches, 1 partial (£4,200 against £5,600 — £1,400 remaining). David approves all 4 with one tap. For 12 supplier bills — AI OCR-scanned email attachments, matched 10 to POs, flagged 2 new suppliers. 45 minutes of data entry becomes 3 minutes of review.

**Climax:** Month-end: "Run month-end close for January." AI presents checklist — bank reconciliations (2/3 done, alerts to third), unposted invoices, accruals (estimated from patterns), depreciation. David validates and approves each item.

**Resolution:** Month-end drops from 3 days to half a day. VAT pre-calculated, one-click HMRC MTD submission.

**Requirements:** Bank feed integration, AI payment matching, document understanding (AI extraction of invoices/receipts → draft records), PO matching, month-end automation, MTD VAT, bank reconciliation, depreciation runs.

---

### Journey 3: Priya — The Sales & CRM Manager (Edge Case & Recovery)

**Situation:** Manages 6-person sales team. Needs pipeline visibility, quote-to-invoice lifecycle. Frustrated by CRM disconnected from Sales Orders.

**Opening Scene:** Briefing: 3 quotes expiring (£78K), pipeline £340K/62% weighted, top deal MegaCorp £120K — no activity 14 days, 2 orders ready for dispatch.

**Rising Action:** "Create quote for BlueStar — 500 Widget-A, 200 Widget-B, standard terms." AI applies negotiated discount from CRM, calculates VAT. Priya updates shipping address. "Convert MegaCorp quote QT-2024-0089 to sales order." AI converts, checks stock — flags Widget-C 30 units short.

**Edge Case:** Stock conflict. AI offers: (1) Partial ship 70 now, backorder 30. (2) Delay entire order. (3) Suggest alternative Widget-C-Plus (compatible, in stock). Priya selects partial — AI creates shipment and backorder PO in one flow.

**Resolution:** Full pipeline visibility without module switching. Quote→Order→Delivery→Invoice as single journey. Stock conflicts handled proactively.

**Requirements:** Quote-to-order conversion, stock availability checks, partial shipment/backorder, address management, pipeline reporting, CRM-Sales integration, discount management.

---

### Journey 4: Marcus — The Warehouse & Production Manager

**Situation:** Manages warehouse and production floor. Needs real-time stock visibility and production scheduling.

**Opening Scene:** Tablet briefing: 5 WOs in progress, WO-0034 completed (200 Widget-A ready for QC), raw material delivery arriving (PO-0078), 3 items below reorder point, 2 dispatch notes for picking.

**Rising Action:** Delivery arrives. "Receive PO-0078." Scans barcodes — AI matches to PO lines, flags 95 vs 100 received. "Accept partial and note 5 missing?" Confirmed. Stock updates instantly. "Schedule work orders for this week by sales order priority." AI checks materials, capacity, proposes schedule.

**Climax:** Rush order from Sales — 150 Widget-B by Friday. Current stock: 40, need 110 produced. AI: "Insert WO-0038 today, push WO-0037 to Thursday. Materials available." Marcus approves — work order created with automatic material reservations.

**Resolution:** Runs receiving, production, dispatch from tablet. AI handles scheduling conflicts and cross-module coordination that used to require 4 phone calls and 3 spreadsheets.

**Requirements:** Goods receipt with barcode scanning, PO matching, partial receipt, production scheduling, BOM explosion, rush order handling, material reservation, dispatch management.

---

### Journey 5: Fatima — The HR Manager

**Situation:** 45 employees — onboarding, leave, payroll, compliance. Monthly payroll, HMRC RTI, auto-enrolment pension.

**Opening Scene:** Briefing: Payroll due in 5 days, 2 new starters for onboarding, 1 probation review due, 3 leave requests pending, auto-enrolment assessment for 2 employees.

**Rising Action:** "Onboard Ahmed Khan — starts Monday, Software Developer, £45K, Engineering." AI creates record, populates statutory fields (NI category, tax code), sets leave entitlement (28 days), flags: "Need bank details, NI number, emergency contact — send self-service form?" "Prepare payroll for February." AI calculates PAYE, NI, student loan, pension. Flags exceptions: James 2 days unpaid leave, Sarah 8 hours overtime at 1.5x, Ahmed pro-rata.

**Climax:** AI submits FPS to HMRC via RTI, generates payslips, triggers BACS payment file. Flags: "2 employees now meet auto-enrolment criteria — letters needed within 6 weeks."

**Resolution:** Payroll drops from 2 days to half a day. Compliance is proactive — AI tracks deadlines and eligibility automatically.

**Requirements:** Employee onboarding, self-service forms, payroll engine, PAYE/NI/pension calculations, RTI, BACS, auto-enrolment tracking, leave management, payslip generation.

---

### Journey 6: Tom — The System Administrator

**Situation:** IT manager responsible for Nexa config, user management, integrations. 15 users.

**Opening Scene:** Dashboard: all healthy, 15 active users, 3 integration syncs pending, last backup 6 hours ago. Alert: failed bank feed sync — auth expired.

**Rising Action:** Re-authenticates bank feed (OAuth). Creates user account for Ahmed — Staff role, Manufacturing + Inventory modules only. Reviews audit log, checks AI action logs. Adjusts reorder threshold after reviewing a rejected AI suggestion.

**Climax:** Company adding new warehouse. Creates location, configures bins, assigns team, sets transfer rules, tests barcode scanning integration.

**Resolution:** Entire system managed from single admin console. 30 minutes/week administration.

**Requirements:** RBAC user management, module access control, integration management, audit/AI logging, system monitoring, multi-warehouse config, backup management.

---

### Journey 7: Claire — The External Accountant (Phase 2 Preview)

**Situation:** External accountancy firm handling year-end accounts and tax advisory. Needs read access to financials plus journal posting.

**Opening Scene:** Logs into accountant portal — sees trial balance, P&L, balance sheet, VAT, bank rec. Cannot see HR, CRM, or operations.

**Rising Action:** Year-end. Reviews trial balance, posts 3 adjustments (prepayment, accrual, depreciation correction). Journals require internal approval — David reviews and approves.

**Resolution:** Year-end adjustments without VPN or physical access. Audit trail distinguishes external from internal actions. Claire generates reports independently.

**Requirements:** External user roles, scoped permissions, journal approval workflow, audit trail by user type, report export.

---

### Journey 8: New User Onboarding — The 5-Minute Magic Moment

**Situation:** A new Nexa ERP customer has just signed up. The admin (or owner) logs in for the first time. They need to experience the AI-first value proposition within 5 minutes — connecting a data source and seeing the AI proactively organise, categorise, and recommend actions.

**Opening Scene:** First login. Guided setup wizard: company name, industry, employee count. AI selects a UK GAAP (FRS 102) chart of accounts template based on industry. One click to confirm.

**Rising Action:** "Connect your bank." OAuth flow to bank feed provider — 30 seconds. AI ingests last 30 days of transactions. Within 90 seconds: transactions categorised (rent, utilities, supplier payments, customer receipts), unmatched items flagged, and a summary presented: "I found 47 transactions. 38 auto-categorised, 6 need your review, 3 are potential duplicates."

**Climax:** User reviews 6 flagged items — AI suggests categories with confidence scores. User approves 5 with one tap each, corrects 1. AI learns the correction. Total elapsed: 4 minutes. AI presents: "Your opening cash position is £128,400. You have £31,200 in unmatched receipts that may be customer payments — shall I create customer records?"

**Resolution:** Under 5 minutes from first login to a working, AI-organised financial picture. The user has experienced AI categorisation, contextual recommendations, and the "told, shown, approve, done" pattern — the magic moment that proves the system understands their business.

**Requirements:** Guided setup wizard, chart of accounts templates, bank feed OAuth connection, AI transaction categorisation, confidence scoring, one-tap approval, AI learning from corrections, opening balance detection.

---

### Journey Requirements Summary

| Journey | User Type | Key Capability Areas |
|---------|-----------|---------------------|
| Sarah (Owner) | Business Owner | Daily briefings, NL reporting, cash flow forecasting, mobile-first, approvals |
| David (Finance) | Finance Manager | Bank feeds, AI matching, document understanding, month-end automation, MTD VAT, bank rec |
| Priya (Sales) | Sales/CRM Manager | Quote→Order→Invoice, stock checks, pipeline, CRM integration, partial shipments |
| Marcus (Warehouse) | Warehouse/Production | Goods receipt, barcode scanning, production scheduling, BOM, rush orders |
| Fatima (HR) | HR Manager | Onboarding, payroll, RTI, BACS, auto-enrolment, leave management |
| Tom (Admin) | System Admin | RBAC, integrations, audit logs, config, monitoring |
| Claire (Accountant) | External Accountant | Scoped access, journals, financial reporting, approval workflows |
| New User (Onboarding) | Any First-Time User | Guided setup, bank feed connection, AI categorisation, magic moment <5min |

**Cross-Journey Patterns:**
- Every journey starts with a **role-based daily briefing**
- Every journey follows **"AI prepares, human approves"** — told, shown, approve, done
- Every journey requires **cross-module awareness**
- Every journey has **fallback to traditional forms** for complex operations

## Domain-Specific Requirements

*Multi-tenancy architecture defined in SaaS B2B Specific Requirements > Tenant Model.*

### Compliance & Regulatory

**UK Tax & VAT:**
- HMRC Making Tax Digital (MTD) — mandatory digital VAT return submission via approved API
- VAT scheme support: Standard, Flat Rate, Cash Accounting, Annual Accounting
- VAT rate handling: Standard (20%), Reduced (5%), Zero (0%), Exempt, Outside Scope, Reverse Charge
- EC Sales List / Postponed VAT Accounting (post-Brexit imports)
- Construction Industry Scheme (CIS) deductions if applicable

**UK Payroll & Employment:**
- Real Time Information (RTI) — FPS and EPS submissions to HMRC per pay period
- PAYE tax calculations using current HMRC tax tables and codes
- National Insurance contributions (employer + employee, multiple categories)
- Student Loan deductions (Plan 1, 2, 4, Postgraduate)
- Statutory payments: SSP, SMP, SPP, ShPP, SAP
- Auto-enrolment pension: eligibility assessment, opt-in/opt-out, contribution calculations
- P45/P46/Starter Declaration handling
- P60 year-end certificates, P11D benefits reporting

**Financial Reporting:**
- Companies House annual accounts (iXBRL format for small/medium companies)
- UK GAAP (FRS 102 / FRS 105 for micro-entities) chart of accounts structure
- Audit trail requirements — immutable once financial periods are closed
- Anti-money laundering (AML) — know-your-customer for financial transactions

**Data Protection:**
- GDPR compliance: data minimisation, right to erasure, data portability, consent management
- Employee data handling per UK Data Protection Act 2018
- Data retention policies (HMRC requires 6 years for financial records)
- Cross-border data transfer restrictions (UK adequacy decisions)

### Technical Constraints

**Security:**
- Encryption at rest (AES-256) and in transit (TLS 1.3)
- Database-per-tenant isolation — zero cross-tenant data leakage by architecture
- Role-based access control with module-level gating
- Session management with configurable timeout
- Audit log for all financial transactions (immutable, tamper-evident)
- API authentication (OAuth 2.0 / API keys) with rate limiting

**Financial Integrity:**
- ACID-compliant transactions for all financial operations
- Double-entry bookkeeping enforcement — every debit has a credit
- Period locking — prevent modifications to closed financial periods
- OKFlag/approval pattern — draft→approved→posted state machine for transactional documents
- Rounding rules per UK VAT guidance (round per line vs round per invoice)
- Multi-currency with daily exchange rate feeds (Bank of England / ECB)

*Performance, availability, and scalability targets specified in Non-Functional Requirements.*

### Integration Requirements

**Banking:**
- Open Banking API (UK) — account information and payment initiation (future)
- Bank feed providers (Plaid, TrueLayer, or Yapily) for transaction ingestion
- OFX/CSV/MT940 file import for manual bank statement upload
- BACS payment file generation for supplier payments and payroll
- Faster Payments / CHAPS support via bank API

**HMRC:**
- MTD VAT API — submit VAT returns, retrieve obligations, view liabilities
- RTI API — submit FPS, EPS, retrieve notifications
- Government Gateway OAuth authentication

**Payroll:**
- UK payroll engine integration (Staffology or PayRun.io API)
- Pension provider API (NEST, People's Pension, or others)
- P45/P60 generation per HMRC specifications

**Third-Party:**
- Email integration (SMTP/IMAP for invoice delivery and bill ingestion)
- AI document understanding service for invoice/receipt/expense extraction (multi-format: PDF, JPEG, PNG, TIFF)
- Exchange rate feed (Bank of England daily rates)
- Companies House API (company lookup, filing)

*Risk assessment consolidated in Project Scoping & Phased Development > Risk Mitigation Strategy.*

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. AI as the Interaction Paradigm (not a Feature)**

The fundamental innovation is that the AI is not a chatbot bolted onto a traditional ERP — it IS the primary interface. This inverts the standard ERP model:

| Traditional ERP | Nexa AI-First ERP |
|----------------|-------------------|
| User navigates menus to find the right screen | User states intent in natural language |
| User fills in form fields manually | AI pre-fills from context; user approves |
| User runs reports by configuring filters | User asks questions; gets answers |
| System shows data; user makes decisions | System recommends actions; user confirms |
| User learns the system | System learns the user |

No major ERP vendor (SAP, Oracle, Sage, Xero, Odoo, ERPNext, Zoho) has shipped an AI-first interaction paradigm. They've added "AI assistants" and "copilots" as sidebar features — the underlying workflow remains form-driven.

**Chosen AI Interaction Model: Co-Pilot Dock (Concept D)** — The AI is accessed via a unified header input ("Search or Ask Nexa anything...", Cmd+K) and a collapsible right-side Co-Pilot drawer (380px) for multi-turn chat, chat history, and role-based preset prompts. The main content area resizes when the drawer opens. This balances AI presence with workspace efficiency — AI is always one keystroke away without consuming permanent screen space. See UX Design Specification for full details.

**2. Role-Based Proactive Intelligence**

Daily briefings personalised by role, job description, AND usage patterns are novel in the ERP space. Current competitors offer static dashboards with configurable widgets. Nexa's approach is:
- **Contextual** — briefing content changes based on what's happening in the business right now
- **Personalised** — adapts to individual user patterns ("you usually run payroll on the 25th")
- **Actionable** — every briefing item has a one-tap action path
- **Cross-module** — connects dots across Finance, Inventory, Sales, HR that siloed dashboards miss

**3. "Told, Shown, Approve, Done" Workflow Pattern**

A novel UX pattern for ERP: the system does the work, presents the result, and the human's role is quality assurance — not data entry. This fundamentally changes the user's relationship with the system from "operator" to "supervisor."

**4. AI-Powered Record Creation with Contextual Knowledge**

Going beyond simple form auto-fill: the AI uses full business context (customer history, default terms, recent patterns, seasonal trends) to create records that are right first time >90% of the time. This requires deep cross-module context that current ERPs don't maintain.

### Market Context & Competitive Landscape

- **Odoo** (~12M users): Traditional form-driven with optional AI features. No AI-first paradigm.
- **Xero** (accounting-focused): Added "Xero AI" for bank categorisation — feature, not paradigm.
- **Sage** (UK SME incumbent): "Sage Copilot" is a sidebar assistant — traditional UI unchanged.
- **ERPNext** (open source): No AI integration at interaction layer.
- **Zoho** (suite approach): "Zia AI" for predictions and anomaly detection — dashboard feature.

**The gap:** No one has rethought the fundamental ERP interaction model. Everyone is adding AI to existing UIs. Nexa is building the UI around AI.

**Window of opportunity:** LLM capabilities have matured enough (tool use, function calling, context windows) to make this technically viable in 2026. Early movers who ship a genuinely AI-native ERP will define the category.

### Validation Approach

| Innovation | Validation Method | Success Criteria |
|-----------|------------------|-----------------|
| AI as primary interface | Dogfooding — internal use of AI path exclusively for 30 days | >80% of daily operations via AI, not traditional forms |
| Role-based briefings | User relevance scoring | >80% of briefing items rated useful |
| Told-shown-approve-done | Approval rate tracking | >90% of AI records approved without modification |
| Contextual record creation | A/B test: AI vs manual accuracy | AI matches or exceeds manual accuracy |

*Innovation risk fallback strategies detailed in Project Scoping > Risk Mitigation Strategy.*

## SaaS B2B Specific Requirements

### Project-Type Overview

Nexa ERP is a cloud-native, multi-tenant SaaS B2B product targeting UK SMEs (10-250 employees). It combines traditional ERP functionality with an AI-first interaction paradigm. The SaaS delivery model means the vendor handles infrastructure, updates, and operations — customers consume the service.

### Tenant Model

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

### RBAC Matrix

| Role | Scope | Capabilities |
|------|-------|-------------|
| PLATFORM_ADMIN | Platform-level (vendor only) | Full Super Admin portal access: tenant lifecycle, billing, AI quotas, impersonation, platform monitoring, compliance tooling. MFA mandatory. All actions audit-logged. |
| PLATFORM_VIEWER | Platform-level (vendor only) | Read-only Super Admin portal access: view tenant status, billing, AI usage dashboards. No lifecycle actions. |
| ADMIN | Tenant-level | All modules, user management, settings, integrations, audit |
| MANAGER | Module-level | Full CRUD within assigned modules, approval authority, reporting |
| STAFF | Module-level | Create/read/update within assigned modules, no delete, no approvals |
| VIEWER | Module-level | Read-only access to assigned modules |

**Module Gating:**
- Each role scoped to specific modules
- Module toggles per tenant — disabled modules invisible
- Feature flags for progressive rollout

**External Roles (Post-MVP):**
- EXTERNAL_ACCOUNTANT — Finance modules, read + journal posting, requires internal approval
- API_CONSUMER — Programmatic access via API keys, scoped to specific endpoints

### Subscription Tiers

Plan definitions are stored in the Platform database and enforced via the Platform API. The ERP queries entitlements at login and caches them with short TTL.

| Tier | Target | Modules | Users | AI Token Allowance | AI Features |
|------|--------|---------|-------|--------------------|-------------|
| Core | 1-10 employees | Finance, Invoicing, basic CRM | 3 | 500K tokens/month | Basic AI (record creation, queries) |
| Pro | 10-50 employees | All core modules | 15 | 2M tokens/month | Full AI (briefings, forecasting, all modules) |
| Enterprise | 50-250 employees | All modules + Manufacturing | Unlimited | 10M tokens/month | Full AI + custom integrations + priority support |

**Enforcement:** Plan limits (user seats, modules, AI tokens) are enforced by the Platform API. The ERP calls `GET /platform/tenants/:id/entitlements` at login and caches the response. The AI Gateway calls `POST /platform/tenants/:id/ai/check` before every AI request.

### Integration Architecture

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

### SaaS Compliance Additions

- **SOC 2 Type II** target for commercialisation
- **Data residency** — UK data centres for all tenant databases
- **Right to data portability** — full export in CSV/JSON per GDPR Article 20
- **Right to erasure** — complete tenant deletion capability
- **Breach notification** — 72-hour process per GDPR Article 33
- **Sub-processor management** — documented third-party service list

### Implementation Considerations

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

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach: Dogfooding-Driven Platform MVP**

This is a production-grade ERP that must run a real company from day one. The MVP philosophy is:
- **Build what we eat** — founding company is first customer and harshest critic
- **AI-first from day one** — differentiator must be present in MVP, not bolted on later
- **Depth over breadth** — 10 modules done properly with AI, not 20 half-built
- **HansaWorld parity as the floor** — settings, registers, reports, maintenances from HansaWorld set the functional baseline

**Development Approach:**
- **All coding performed exclusively using Claude Opus 4.6** — no other models for implementation
- Full-stack TypeScript/Node.js with ERP domain understanding
- AI/LLM integration for the product's AI orchestration layer
- UK compliance knowledge (VAT, payroll, employment law)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
All 8 journeys are MVP-scope (founding company requires all roles):
1. Sarah (Owner) — briefings, approvals, NL reporting
2. David (Finance) — AR, AP, bank feeds, MTD VAT, month-end
3. Priya (Sales/CRM) — quote→order→delivery→invoice, pipeline
4. Marcus (Warehouse/Production) — goods receipt, production scheduling, BOM
5. Fatima (HR) — onboarding, payroll, RTI, auto-enrolment
6. Tom (Admin) — user management, config, integrations
7. Claire (Accountant) — Phase 2 Preview (EXTERNAL_ACCOUNTANT role deferred)
8. New User (Onboarding) — guided setup, bank feed, AI categorisation, magic moment

**Must-Have Modules (11 MVP Modules):**

| # | Module | MVP Scope | AI Integration |
|---|--------|-----------|---------------|
| 0 | Platform Admin | Tenant management, plan/entitlement enforcement, AI Gateway + token metering, billing status, feature flags, impersonation, platform audit log, support console | AI usage analytics, anomaly detection |
| 1 | Finance / GL | CoA (FRS 102), journals, TB, P&L, balance sheet, periods | AI journal suggestions, NL financial queries |
| 2 | Accounts Receivable | Customer (~80 fields), invoices (full lifecycle), payments, aging, credit notes | AI invoice creation, payment matching |
| 3 | Accounts Payable | Suppliers, purchase invoices, payment runs, AP aging, BACS | AI document understanding (invoice/receipt → record), PO-to-invoice matching |
| 4 | Sales | Quotes, orders, shipments, Q→O→I conversion, pricing | AI quote creation, stock checks |
| 5 | Purchasing | POs, goods receipt with barcode scanning, 3-way matching, reorder suggestions | AI reorder recommendations |
| 6 | Inventory | Items (relational), stock movements, warehouses, serial/batch, stock take, item groups | AI stock queries, reorder alerts |
| 7 | CRM | Contacts, accounts, activities, leads, pipeline, campaigns, opportunity management | AI activity logging, pipeline briefings, lead scoring |
| 8 | HR & Payroll | Employees (typed fields), leave, payroll via UK API, RTI, BACS, auto-enrolment, contracts, appraisals, skills, training | AI onboarding, payroll prep |
| 9 | Manufacturing | BOM, work orders, routing, scheduling, material consumption, MRP, quality inspection | AI scheduling, material checks |
| 10 | Reporting | 10 P0 reports, PDF/CSV export, cash flow forecasting | AI NL reporting, AI cash flow projections |

**Phase 2/3 Modules (8 Planned Modules):**

| # | Module | Phase | Scope | AI Integration |
|---|--------|-------|-------|---------------|
| 11 | POS | Phase 2 | Sessions, cash management, barcode scanning, receipts, offline mode | AI product lookup, promotion suggestions |
| 12 | Projects & Job Costing | Phase 2 | Project management, time tracking, expense tracking, WIP, revenue recognition | AI budget alerts, rate resolution |
| 13 | Contracts & Agreements | Phase 2 | Rental/lease/service contracts, recurring invoicing, loan agreements | AI renewal alerts, schedule calculation |
| 14 | Warehouse Management | Phase 2 | Bin locations, pick lists, goods receipt positioning, cycle counting, packing | AI pick optimisation, position suggestions |
| 15 | Service Orders | Phase 2 | Service orders, service items, field scheduling, service-to-invoice | AI scheduling, SLA monitoring |
| 16 | Fixed Assets | Phase 2 | Asset register, depreciation (straight-line, reducing balance, sum-of-digits), disposals, revaluations | AI depreciation scheduling, asset lifecycle alerts |
| 17 | Communications | Phase 3 | Internal messaging, email integration, activity feeds, document attachments | AI notification prioritisation |
| 18 | Intercompany & Consolidation | Phase 3 | Intercompany routing, elimination entries, consolidated reporting, currency translation | AI elimination suggestions |

**Must-Have Foundation:**
- AI Orchestration (intent recognition, context engine, action planning, guardrails, daily briefings)
- Document Understanding (AI document extraction, financial document → record transformation, confidence scoring, learning from corrections)
- Auth & RBAC (5 roles, module gating, MFA)
- Audit trail (immutable financial log, AI action logging)
- Fraud prevention (duplicate payment detection, suspicious transaction alerting, anomaly reporting)
- Number series (configurable per entity)
- Multi-currency (single base + foreign currency with exchange rates)
- Multi-address (billing + shipping per customer/supplier)
- Bank integration (OFX/CSV import, payment matching, reconciliation)
- HMRC integration (MTD VAT, RTI payroll)
- Settings engine (per-module, replicating key HansaWorld settings)
- Platform API (entitlement checking, module gating, user quota enforcement for ERP runtime)
- AI Gateway (single internal service through which ALL AI calls are routed — quota check before, usage record after)
- Platform Admin portal (Super Admin operational control plane for tenant, billing, and AI management)

**Now IN MVP (promoted from Post-MVP):**
- Platform database (tenant management, AI usage metering, operational control — required for AI Gateway and platform operations)
- Subscription plan catalogue and entitlement enforcement (required for module gating and AI quota enforcement)
- Platform Admin portal (Super Admin) — core operational features (tenant status, AI usage dashboard, billing view, impersonation, audit logs)
- AI Gateway service (all AI calls routed through gateway for quota checking and usage recording)

**Explicitly OUT of MVP:**
- Automated multi-tenant provisioning (tenants created manually via Platform Admin in MVP)
- External accountant portal
- Fixed Assets module (Phase 2 — FR158-FR163)
- POS module (Phase 2)
- Projects & Job Costing module (Phase 2)
- Contracts & Agreements module (Phase 2)
- Warehouse Management module (Phase 2)
- Service Orders module (Phase 2)
- Communications module (Phase 3)
- Intercompany & Consolidation module (Phase 3)
- Open Banking / GoCardless
- Configurable workflow engine (beyond OKFlag)
- Custom report builder
- Marketplace / extensions
- Voice interface, predictive intelligence

### Post-MVP Features

**Phase 2 — Commercialisation:**
- Automated tenant provisioning (self-service sign-up, auto database creation, auto migration)
- Stripe billing integration (automated invoicing, dunning, payment status sync)
- External accountant portal
- Fixed Assets module (asset register, depreciation, disposals, revaluations — FR158-FR163)
- POS module (sessions, cash management, barcode scanning, receipts, offline mode)
- Projects & Job Costing module (project management, time tracking, expense tracking, WIP, revenue recognition)
- Contracts & Agreements module (rental/lease/service contracts, recurring invoicing, loan agreements)
- Warehouse Management module (bin locations, pick lists, goods receipt positioning, cycle counting, packing)
- Service Orders module (service orders, service items, field scheduling, service-to-invoice)
- Advanced Banking (Open Banking, GoCardless)
- Document Knowledge Base (company handbooks, policy manuals, employee contracts → vector DB + RAG — FR169-FR170)
- Document Management (attachments, version control)
- 20 additional reports from HansaWorld
- Configurable approval workflows
- SSO / SAML

**Phase 3 — Expansion:**
- Communications module (internal messaging, email integration, activity feeds, document attachments)
- Intercompany & Consolidation module (intercompany routing, elimination entries, consolidated reporting, currency translation)
- Planning & Budgeting
- Predictive Intelligence (cash flow forecasting, demand prediction)
- Supply Chain extensions (pick/pack/ship, RMA)
- Integration Hub (Zapier, webhooks, API marketplace)
- Voice interface
- Custom report builder
- Global expansion (EU VAT, US GAAP)
- Marketplace for third-party extensions

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|------|------------|
| AI accuracy insufficient for financials | Mandatory human approval; AI learns from corrections; traditional forms fallback |
| 10-module scope too ambitious | Prioritise by dependency: Finance→Inventory→Sales→Purchasing first, then CRM→HR→Manufacturing. Ship incrementally |
| LLM costs too high per tenant | Cache common queries; smaller models for simple ops; token budgets |
| UK compliance gaps late | External accountant validation early; parallel-run payroll |

**Market Risks:**

| Risk | Mitigation |
|------|------------|
| SMEs don't trust AI for finances | "Approve, don't automate" — AI proposes, never executes without confirmation |
| Competitors ship AI-first ERP first | Speed through dogfooding — building for ourselves, not waiting for validation |
| HansaWorld parity bar too high | Focus on 80% of settings/registers that matter for UK SMEs |

**Innovation Risks:**

| Risk | Mitigation |
|------|------------|
| AI accuracy too low for financials | Progressive disclosure — traditional forms one click deep; AI learns from corrections |
| Users don't trust AI for finances | Confidence scoring visible; all AI actions require approval; full audit trail |
| LLM latency too high for real-time | Async pattern: AI prepares in background; cache common queries |
| AI hallucination on business data | Constrained generation — AI only references actual database data; no invented figures |
| Users prefer traditional forms | Support both paths equally; track usage; don't force AI path |

**Compliance Risks:**

| Risk | Mitigation |
|------|------------|
| Incorrect VAT calculation | Automated tests against HMRC examples; accountant review before MTD submission |
| Payroll calculation errors | Certified payroll API (Staffology/PayRun.io); reconciliation checks; parallel run |
| HMRC API changes | API version monitoring; abstraction layer; emergency manual filing fallback |
| Period manipulation | Immutable period locks; segregation of duties; audit trail |
| Data breach | Database-per-tenant; pen testing; encryption; access logging; security audits |
| Exchange rate staleness | Daily automated fetch; manual override with audit trail |

**Resource Risks:**

| Risk | Mitigation |
|------|------------|
| Fewer developers than planned | Module priority order allows shipping useful subset first |
| Key person dependency on compliance | Document all rules; external accountant as partner |
| AI integration takes longer | Traditional forms work independently; AI added progressively |

## Functional Requirements

### AI Interaction & Intelligence

- FR1: Users can issue natural language commands to create, query, and manage business records across all modules with >90% correct interpretation rate for supported entity types and AI responses within 3 seconds (95th percentile)
- FR2: The system can pre-fill record fields using contextual knowledge (customer history, default terms, recent patterns, user behaviour) achieving >90% field accuracy as measured by the approval-without-edit ratio
- FR3: Users can receive a personalised daily briefing based on their role, job description, and system usage patterns
- FR4: Users can ask business questions in natural language and receive accurate answers with supporting data, achieving >95% accuracy for queries within the supported question taxonomy and responding within 3 seconds (95th percentile)
- FR5: The system can recommend actions to users with explanation and one-tap approval path
- FR6: Users can approve, modify, or reject any AI-generated record or recommendation before it takes effect
- FR7: The system can maintain conversational context across a session to handle multi-step operations
- FR8: Users can fall back to traditional form-based interfaces for any operation at any time
- FR9: The system can log all AI actions, suggestions, and user responses for audit and learning purposes
- FR10: The system can display confidence scoring for AI-generated records and recommendations

### Document Understanding (MVP)

- FR164: Users can upload, photograph, or forward financial documents (purchase invoices, receipts, expense claims, credit notes) via web upload, mobile camera, or email for AI-powered data extraction
- FR165: The system can extract structured fields from financial documents (supplier name, invoice number, date, line items, amounts, VAT, payment terms, bank details) with field-level confidence scoring, achieving >85% extraction accuracy for standard UK invoice and receipt formats
- FR166: The system can automatically match extracted document data to existing supplier records, purchase orders, and GL accounts, creating draft purchase invoices or expense records following the "told, shown, approve, done" pattern
- FR167: Users can review, correct, and approve AI-extracted document records before posting, with corrections feeding back to improve future extraction accuracy for that supplier
- FR168: The system can process documents in PDF, JPEG, PNG, and TIFF formats with automatic orientation correction and quality validation, rejecting unreadable documents with a clear re-upload prompt

### Document Knowledge Base (Phase 2)

- FR169: Administrators can upload company documents (employee contracts, handbooks, policy manuals, procedure guides) for AI indexing and storage in a vector knowledge base
- FR170: Users can ask natural language questions about company policies, procedures, and employment terms, receiving accurate answers with source document references and page citations

### Finance & General Ledger

- FR11: Administrators can configure a chart of accounts based on UK GAAP (FRS 102) templates
- FR12: Users can create, edit, and post journal entries with double-entry enforcement
- FR13: Users can generate trial balance, profit & loss, and balance sheet reports for any date range
- FR14: Administrators can open and close financial periods with enforcement preventing posting to closed periods
- FR15: Users can manage multiple currencies with configurable exchange rates from external feeds
- FR16: Users can perform bank reconciliation matching bank statement lines to ledger transactions
- FR17: Users can import bank statements in OFX, CSV, and MT940 formats
- FR18: The system can automatically match bank transactions to open invoices and bills based on amount and reference

### Accounts Receivable

- FR19: Users can create and manage customer records with comprehensive fields (contacts, addresses, payment terms, VAT registration, credit limits, bank details)
- FR20: Users can create, approve, and post sales invoices following the draft→approved→posted lifecycle
- FR21: Users can record customer payments and allocate them against specific invoices (full or partial)
- FR22: Users can generate and send customer statements
- FR23: Users can create credit notes linked to original invoices
- FR24: Users can view AR aging analysis by customer and date band
- FR25: Users can manage multiple billing and shipping addresses per customer

### Accounts Payable

- FR26: Users can create and manage supplier records with comprehensive fields (contacts, addresses, payment terms, VAT registration, bank details)
- FR27: Users can create, approve, and post supplier bills following the draft→approved→posted lifecycle
- FR28: Users can record supplier payments and allocate them against specific bills
- FR29: Users can generate BACS payment files for bulk supplier payments
- FR30: Users can view AP aging analysis by supplier and date band
- FR31: The system can match supplier bills to purchase orders (3-way matching with goods receipt)
- FR32: The system can ingest supplier bills via email/OCR and extract key fields for review

### Sales Management

- FR33: Users can create sales quotes with line items, pricing, discounts, and VAT calculation
- FR34: Users can convert approved quotes to sales orders
- FR35: Users can manage sales orders through the full lifecycle (draft→confirmed→shipped→invoiced)
- FR36: Users can create shipments/delivery notes against sales orders (full or partial)
- FR37: Users can convert sales orders to invoices (single or batch)
- FR38: The system can check stock availability during order entry and alert on shortfalls
- FR39: Users can manage customer-specific pricing and discount rules
- FR40: Users can view sales pipeline with weighted values and activity tracking

### Purchasing

- FR41: Users can create purchase orders with line items, pricing, and VAT calculation
- FR42: Users can manage PO approval workflows
- FR43: Users can record goods receipt against purchase orders (full or partial)
- FR154: Users can scan item barcodes during goods receipt to automatically identify items, validate against the purchase order, and record received quantities
- FR44: The system can suggest reorder purchase orders based on stock levels and reorder points
- FR45: Users can track PO status through the lifecycle (draft→approved→ordered→received)

### Inventory & Stock

- FR46: Users can create and manage item records with typed relational fields (name, description, type, UoM, barcode, weight, dimensions, cost price, sales price, VAT code, reorder point)
- FR47: Users can manage item groups with default GL account mappings
- FR48: Users can record stock movements (receipt, issue, transfer, adjustment) with audit trail
- FR49: Users can manage multiple warehouse locations with bin-level tracking
- FR50: Users can perform stock takes with variance reporting
- FR51: Users can track items by serial number or batch number
- FR52: Users can view real-time stock levels across all locations
- FR53: The system can alert users when items fall below reorder point

### CRM

- FR54: Users can create and manage contacts and accounts with activity history
- FR55: Users can log activities (calls, meetings, emails, notes) against contacts and accounts
- FR56: Users can manage leads with status tracking and conversion to customers/quotes
- FR57: Users can view pipeline reporting with stages, values, and probability weighting
- FR58: Users can link CRM records to sales transactions (quotes, orders, invoices)

### HR & Payroll

- FR59: Users can create and manage employee records with typed fields required by UK employment law (NI number, tax code, employment type, start/end dates, department, job title, pay details)
- FR60: Users can manage employee onboarding with configurable checklist and self-service data collection
- FR61: Users can manage leave requests (request, approve, reject) with entitlement tracking
- FR62: Users can prepare and run monthly payroll with PAYE, NI, student loan, and pension calculations
- FR63: The system can submit Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC via RTI
- FR64: Users can generate BACS payment files for payroll payments
- FR65: The system can assess employee auto-enrolment pension eligibility and track opt-in/opt-out status
- FR66: Users can generate payslips, P45s, and P60s per HMRC specifications
- FR67: Users can manage statutory payments (SSP, SMP, SPP, ShPP, SAP)

### Manufacturing

- FR68: Users can create and manage Bills of Materials (BOM) with multi-level component structures
- FR69: Users can create and manage work orders with material requirements and routing operations
- FR70: Users can schedule production based on sales order priority and material availability
- FR71: Users can record material consumption against work orders
- FR72: Users can record finished goods receipt from completed work orders
- FR73: The system can check material availability before work order confirmation and alert on shortages

### Reporting & Analytics

- FR74: Users can generate standard financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow Statement)
- FR75: Users can generate operational reports (AR/AP Aging, Stock Valuation, Bank Reconciliation)
- FR76: Users can generate HR reports (Payslips, Employee List)
- FR77: Users can generate VAT returns for HMRC MTD submission
- FR78: Users can export reports in PDF and CSV formats
- FR79: Users can ask ad-hoc reporting questions in natural language and receive data-backed tabular or chart answers generated from live data, achieving >95% accuracy for supported query patterns (aggregations, comparisons, trend analysis, filtered listings)
- FR153: Users can generate AI-driven cash flow forecasts for 8-52 week projection periods with scenario analysis (best case, expected, worst case) based on AR/AP aging, recurring invoices, historical payment patterns, and known commitments

### Administration & Configuration

- FR80: Administrators can create, edit, and deactivate user accounts with role assignment
- FR81: Administrators can assign roles (SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER) with module-level access gating
- FR82: Administrators can enable/disable modules per tenant configuration
- FR83: Administrators can configure per-module settings (payment terms defaults, VAT schemes, number series, currency, etc.)
- FR84: Administrators can manage integration connections (bank feeds, HMRC, payroll API) with health monitoring
- FR85: Administrators can view audit logs of all system actions including AI-generated operations
- FR86: Administrators can configure number series (prefix + sequential counter) per document type
- FR87: Administrators can import data (customers, suppliers, items, opening balances) from CSV files
- FR88: Administrators can manage backup and restore operations

### Compliance & VAT

- FR89: The system can calculate VAT at standard (20%), reduced (5%), zero (0%), exempt, and reverse charge rates
- FR90: Users can configure VAT schemes (Standard, Flat Rate, Cash Accounting)
- FR91: The system can generate and submit VAT returns to HMRC via the MTD API
- FR92: The system can maintain immutable audit trails for all financial transactions
- FR93: Administrators can manage GDPR compliance operations (data export, data deletion requests)
- FR94: The system can enforce period locks preventing modification of closed financial period data
- FR155: The system can detect and alert on duplicate payment attempts by matching supplier, amount, invoice reference, and date proximity
- FR156: The system can flag suspicious transactions based on configurable rules (unusual amounts, out-of-pattern timing, new supplier with large first payment, sequential invoice numbers from same supplier)
- FR157: The system can generate a fraud risk summary report showing flagged transactions, duplicate payment attempts, and anomaly patterns for administrator review

### CRM — Expanded

- FR95: Users can create and manage marketing campaigns with recipient lists, media types, status tracking, and response analysis
- FR96: Users can manage sales opportunities with weighted pipeline stages, probability percentages, and expected revenue calculations
- FR97: Administrators can configure pipeline Kanban board stages at system level, and users can create personal pipeline views
- FR98: Administrators can define activity auto-creation rules that automatically generate activities for key CRM events (e.g., new lead, opportunity stage change, overdue follow-up)
- FR99: Users can assign lead ratings (Cold, Warm, Hot) and manage lead lifecycle from initial contact through qualification to conversion or closure
- FR100: Administrators can configure CRM-specific activity types and activity groups for structured activity tracking

### HR & Payroll — Expanded

- FR101: Users can manage employment contracts through a full lifecycle (draft, approve, active, terminate) with immutable change history
- FR102: The system can track contract changes (salary adjustments, job title changes, department transfers) with full audit trail and effective dates
- FR103: Users can conduct performance appraisals using configurable factor and rating matrices with multi-level approval workflows
- FR104: Users can manage employee skills and competencies with rating evaluations and point-in-time reporting for workforce planning
- FR105: Users can create and manage training plans with scheduling, automatic double-booking detection, and auto-closure on completion
- FR106: Administrators can define job positions and organisational structure hierarchies for departmental reporting
- FR107: Users can manage employee benefits on contracts with configurable benefit types, amounts, and payment frequencies
- FR108: Users can manage onboarding and offboarding checklists using configurable checkpoint templates with assignment and completion tracking

### Manufacturing — Expanded

- FR109: Users can trigger recipe/BOM explosion across document types including quotes, sales orders, and invoices to automatically generate component line items
- FR110: Users can define and manage production shift schedules with worker assignments per shift
- FR111: Users can register time worked by multiple workers per production operation with start/stop tracking
- FR112: The system can post operation-level costs to GL accounts including work-in-progress (WIP) accounting entries
- FR113: The system can run Material Requirements Planning (MRP) calculations based on demand, stock levels, lead times, and open orders
- FR114: Users can manage machine and work centre capacity with availability calendars and utilisation tracking
- FR115: Users can perform quality inspections at the production operation level with pass/fail recording and defect tracking

### POS

- FR116: Users can open and close POS sessions with cash float entry, end-of-day cash counting, and Z-report generation
- FR117: Users can look up products by name, code, or barcode scan at the point of sale
- FR118: Users can process multiple payment methods per transaction including cash, card, voucher, and split payments
- FR119: Users can print receipts or send email receipts to customers from the POS terminal
- FR120: Administrators can configure POS-specific pricing rules and promotional discounts
- FR121: The system can operate in offline mode and automatically synchronise transactions when connectivity is restored
- FR122: Users can manage cash drawer operations with till reconciliation and variance reporting

### Projects & Job Costing

- FR123: Users can create and manage projects with budgets, phases, milestones, and status tracking
- FR124: Users can record time entries against projects with billable and non-billable classification
- FR125: Users can record expenses against projects with receipt attachment and approval workflow
- FR126: Users can view project budget versus actual reports with variance analysis by phase and cost category
- FR127: The system can resolve billing rates using a priority hierarchy: project-specific rate, customer rate, employee rate, then default rate
- FR128: The system can post job costs to GL accounts per project with cost centre tracking
- FR129: The system can calculate work-in-progress (WIP) values and support revenue recognition for long-running projects

### Contracts & Agreements

- FR130: Users can create and manage contracts for rental, lease, and service agreements with defined terms and conditions
- FR131: The system can automatically generate recurring invoices from active contracts based on configured billing schedules
- FR132: Users can manage contract renewal and termination workflows with advance notification and approval steps
- FR133: Users can manage loan agreements with repayment schedule calculations supporting annuity, linear, and bullet repayment methods
- FR134: Users can configure contract-based pricing and payment terms that override default customer terms

### Warehouse Management

- FR135: Users can define and manage warehouse positions and bin locations with capacity and zone classification
- FR136: Users can generate pick lists from sales orders and manage pick completion with quantity tracking
- FR137: Users can receive goods into specific warehouse positions with automatic or manual bin assignment
- FR138: Users can create internal transfer orders to move stock between warehouse positions
- FR139: Users can perform cycle counts by warehouse position with variance reporting and adjustment posting
- FR140: Users can manage packing and dispatch operations with shipment tracking and carrier assignment

### Intercompany & Consolidation

- FR141: The system can route intercompany transactions so that a purchase order in one company automatically creates a corresponding sales order in the counterpart company
- FR142: The system can generate intercompany elimination journal entries for consolidated financial reporting
- FR143: Users can generate consolidated financial reports (P&L, Balance Sheet) across multiple companies
- FR144: The system can perform currency translation for foreign subsidiary consolidation using closing rate and average rate methods

### Communications

- FR145: Users can send and receive internal messages and notifications within the ERP system
- FR146: Users can send and receive emails from within the ERP with automatic linking to relevant business entities
- FR147: Users can view a chronological activity feed per entity (customer, supplier, employee, project) showing all related interactions
- FR148: Users can attach documents to any business record with version tracking and access control

### Service Orders

- FR149: Users can create and manage service orders with assignment to service personnel, status tracking, and completion recording
- FR150: Users can track service items (equipment or assets under service contract) with service history and warranty information
- FR151: Users can schedule field service visits with calendar integration and technician availability checking
- FR152: Users can convert completed service orders to invoices with automatic line item generation from service activities and parts used

### Fixed Assets (Phase 2)

- FR158: Users can create and manage fixed asset records with acquisition date, cost, useful life, residual value, asset category, location, and responsible person
- FR159: The system can calculate depreciation using straight-line, reducing balance, and sum-of-digits methods per UK GAAP (FRS 102 Section 17)
- FR160: The system can automatically post monthly depreciation journal entries to the general ledger
- FR161: Users can record asset disposals with gain/loss calculation and GL posting
- FR162: Users can perform asset revaluations with revaluation reserve posting per FRS 102
- FR163: Users can generate a fixed asset register report showing cost, accumulated depreciation, and net book value per asset and category

### Multi-Company Management

- FR171: Administrators can create and manage multiple companies within a single tenant, each with its own name, legal name, registration number, VAT number, base currency, address, and branding
- FR172: Users can switch between companies via the application header, with all subsequent queries automatically scoped to the selected company
- FR173: Administrators can configure per-entity register sharing rules between companies (e.g., share customers between Company 1 and Company 2 but not Company 3) with modes: no sharing, share with all companies, or share with selected companies
- FR174: The system must scope every database query by company, ensuring complete data isolation between companies unless sharing rules explicitly permit cross-company visibility

### Company-Specific RBAC

- FR175: Administrators can assign users a global role that applies across all companies within the tenant
- FR176: Administrators can assign per-company role overrides that take precedence over the global role for specific companies (e.g., ADMIN globally but VIEWER for Company 3)
- FR177: The system must resolve user permissions by checking for a company-specific role first, then falling back to the global role, with no access granted if neither exists

### i18n / Localization Infrastructure

- FR178: All user-facing text (labels, messages, placeholders, validation errors, system messages) must use translation keys via a centralised translation system, with no hardcoded strings in the UI
- FR179: Administrators can set a default language per company, and users can select their preferred language in profile settings, with fallback chain: user language, then company language, then English
- FR180: The system must format numbers, dates, and currency values according to the user's locale using standard internationalisation APIs

### Cross-Cutting Tasks

- FR181: Users can create tasks from any business record (invoice, purchase order, customer, employee, etc.) with title, description, priority (Low/Normal/High/Urgent), and due date
- FR182: Users can assign tasks to one or more users, with task assignees receiving notifications on assignment and status changes
- FR183: Users can view and manage their assigned tasks from a centralised task list with filtering by status, priority, due date, and source entity

### Notifications

- FR184: The system can deliver real-time notifications via in-app (WebSocket), push (mobile), and email channels, triggered by business events (approval requests, task assignments, status changes, AI alerts)
- FR185: Users can configure per-channel, per-event-type notification preferences (opt-in/out for each notification type per delivery channel)
- FR186: Users can view a notification centre showing all recent notifications with read/unread status and direct links to related records

### Email Integration

- FR187: The system can send business documents (invoices, statements, purchase orders, payslips, notifications) via email using configurable per-company SMTP settings
- FR188: Users can send emails from within the ERP directly from business records (e.g., "Email this invoice") with document PDF attachment and customisable email templates
- FR189: Administrators can configure email templates per document type with merge fields for dynamic content (company name, recipient, document details)

### Printer Management

- FR190: Users can configure print preferences per document type (auto-print on save, manual print, or download PDF only)
- FR191: The system can generate PDF documents via the Document Templates engine and present them via the browser Print API or as downloadable files
- FR192: Administrators can set default print preferences per document type at the company level, which users can override with personal preferences

### Platform Admin — Tenant Management

- FR193: Platform administrators can create, view, suspend, reactivate, and archive tenants with full lifecycle tracking including legal entity details, billing profile, and database provisioning status
- FR194: Platform administrators can view a tenant list with status, plan, region, created date, last activity, active user count, and enabled modules
- FR195: Platform administrators can configure per-tenant module entitlements (allowed modules), feature flags, and environment toggles (sandbox mode) that override plan defaults
- FR196: Platform administrators can force password resets for tenant users, revoke tenant user sessions, and rotate tenant API keys/webhook secrets from the platform admin portal

### Platform Admin — Identity & Access

- FR197: Platform administrators can manage platform admin accounts with mandatory MFA enforcement, including adding/removing platform admins and emergency "break glass" account handling
- FR198: Platform administrators can view tenant user lists and roles (read-only), reset tenant user MFA, and lock/unlock tenant user accounts
- FR199: Platform administrators can initiate time-limited, fully audited impersonation sessions to access a tenant's ERP as a support user, with a visible banner always displayed: "You are impersonating [tenant name]"
- FR200: The system must record every impersonation session with start time, end time, platform admin identity, target tenant, and all actions performed during the session in the platform audit log

### Platform Admin — Billing & Plan Enforcement

- FR201: Platform administrators can manage a plan catalogue (Core/Pro/Enterprise/Custom) defining user limits, module entitlements, API rate limits, and AI token quotas per plan
- FR202: Platform administrators can view per-tenant billing status including current subscription, payment status, invoices/receipts, and dunning flags
- FR203: Platform administrators can configure billing enforcement controls per tenant: grace period duration, read-only mode activation, and hard stop (suspension) triggers based on payment status
- FR204: The system must enforce plan limits at runtime: the ERP queries the Platform API for entitlements at login and caches with short TTL, blocking module access, user creation, or AI usage when limits are exceeded

### Platform Admin — AI Gateway & Token Metering

- FR205: All AI calls from the ERP must be routed through a single internal AI Gateway service that checks tenant token quota before forwarding to the AI model provider and records usage after response
- FR206: The system must record per-AI-call usage data: tenantId, userId, featureKey (which ERP feature triggered the call), model, promptTokens, completionTokens, totalTokens, costEstimate (using unit price snapshot at time of call), requestId/traceId, and UTC timestamp
- FR207: Platform administrators can view per-tenant AI token dashboards showing usage today/this week/this month, rolling 30-day usage, cost estimates, and usage split by ERP feature
- FR208: Platform administrators can configure per-tenant AI token quotas: monthly token allowance (by plan), soft limit percentage (warn), hard limit percentage (block/require top-up), and optional burst allowance
- FR209: The system must alert platform administrators at configurable quota thresholds (default: 50%, 80%, 100%) and flag unusual usage spikes for investigation
- FR210: Platform administrators can export AI usage data as CSV for finance and margin tracking per tenant, with dispute-proof audit trail linking every billable AI call to a trace ID

### Platform Admin — Platform Monitoring & Incident Control

- FR211: Platform administrators can view a platform health dashboard showing error rates, top issues by affected tenant count, latency metrics, and uptime status
- FR212: Platform administrators can view a background jobs dashboard showing queue depths, failure counts, retry status, and dead letter items with the ability to re-run failed jobs
- FR213: Platform administrators can activate system-wide or per-tenant maintenance mode, disable specific regions, and trigger feature kill-switches for emergency incident response

### Platform Admin — Compliance & Audit

- FR214: The system must maintain an immutable platform audit log recording every platform admin action: tenant lifecycle changes, impersonation sessions, plan changes, quota changes, user resets, data access events, with actor identity, timestamp, IP address, and action details
- FR215: Platform administrators can perform GDPR compliance operations: export all tenant data (DSAR), delete/anonymise tenant data (where lawful), and configure data retention policies per tenant
- FR216: Platform administrators can view data access logs showing which platform admin viewed which tenant's data and the stated reason

### Platform Admin — Support Console

- FR217: Platform administrators can search for tenants by domain, company name, admin email, or customer ID and view tenant diagnostic information including auth status, webhook health, email deliverability, and integration connection status
- FR218: Platform administrators can execute safe "runbook" operations from the support console: re-run failed background jobs, rebuild tenant database indexes, rotate integration tokens, and trigger data re-sync for specific integrations

### Platform API — ERP Runtime Integration

- FR219: The ERP must call the Platform API at tenant login/app initialisation to retrieve entitlements (tenant status, plan, billing status, enforcement action, max users, max companies, enabled modules, feature flags) and cache the response with configurable TTL (default 5 minutes)
- FR220: The ERP must check cached entitlements before loading any module, adding users, or performing write operations, degrading gracefully (showing upgrade prompts or billing notices) when limits are reached or enforcement actions are active
- FR221: The Platform must push real-time events (tenant.suspended, tenant.plan_changed, tenant.quota_warning) to the ERP via webhook to bust the entitlement cache immediately, ensuring enforcement actions take effect within seconds rather than waiting for TTL expiry
- FR222: The ERP must continue operating using last-cached entitlements if the Platform API is unreachable, with AI usage records queued locally for later sync (circuit breaker pattern)

## Non-Functional Requirements

### Performance

- NFR1: AI conversational responses must complete within 3 seconds for 95th percentile of requests
- NFR2: Traditional CRUD operations must complete within 500ms for 95th percentile
- NFR3: Standard report generation must complete within 5 seconds for datasets up to 100,000 transactions
- NFR4: Bank feed processing must complete within 15 minutes of feed availability
- NFR5: Bulk operations (month-end close, payroll for up to 250 employees) must complete within 60 seconds with progress indication
- NFR6: Page load time must be under 2 seconds on standard broadband (10Mbps+)
- NFR7: The system must support 50 concurrent users per tenant without degradation

### Security

- NFR8: All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- NFR9: Database-per-tenant architecture must provide complete isolation with zero cross-tenant access, verified by automated cross-tenant penetration tests per release cycle and continuous connection-routing validation in CI
- NFR10: Authentication must support MFA (TOTP at minimum)
- NFR11: Sessions must expire after configurable inactivity period (default 30 minutes)
- NFR12: All API endpoints authenticated and authorised against role and module access
- NFR13: Password storage must use bcrypt or argon2 with minimum 10 rounds
- NFR14: All financial transaction modifications logged in immutable, tamper-evident audit trail
- NFR15: Failed logins rate-limited (max 5 per 15 minutes) with account lockout
- NFR16: AI-generated actions must never execute without explicit user approval for financial operations, verified by mandatory approval-gate integration tests and zero-bypass audit log validation per release

### Reliability

- NFR17: System uptime 99.9% (max 8.76 hours unplanned downtime per year)
- NFR18: Zero data loss for committed financial transactions (ACID compliance), verified by RPO=0 for committed transactions with ACID integrity tests and point-in-time recovery drills quarterly
- NFR19: Automated daily backups with point-in-time recovery
- NFR20: Backup restoration within 1 hour for databases up to 50GB
- NFR21: If AI layer unavailable, all traditional form operations must continue functioning
- NFR22: External integration failures handled gracefully with retry, dead-letter queue, and user notification

### Scalability

- NFR23: Support up to 1,000 tenants without architectural changes
- NFR24: Each tenant database must handle up to 1 million transactions per year without degradation
- NFR25: Schema migrations applicable per-tenant without system-wide downtime
- NFR26: New tenant provisioning within 60 seconds

### Accessibility

- NFR27: WCAG 2.1 Level AA compliance for all traditional form interfaces
- NFR28: All interactive elements keyboard-navigable
- NFR29: Colour contrast minimum 4.5:1 normal text, 3:1 large text
- NFR30: AI conversational interface must support screen reader compatibility

### Integration

- NFR31: All external API integrations must implement retry with exponential backoff (max 3 retries)
- NFR32: HMRC MTD/RTI submissions must complete within HMRC API timeout windows
- NFR33: Bank feed sync must handle failures without data loss or duplicate transactions
- NFR34: Integration credentials stored encrypted, never exposed in logs or API responses
- NFR35: Integration health monitorable from admin dashboard with alerting on failures

### Data Integrity

- NFR36: Double-entry bookkeeping enforced at database level — no unbalanced journals
- NFR37: Financial period locks enforced at database level — no DML on locked periods
- NFR38: All monetary values use fixed-point decimal (not floating point)
- NFR39: Audit trail records append-only — no update or delete
- NFR40: Data retention supports minimum 6 years for financial records per HMRC

### Platform Operations

- NFR46: Platform API entitlement checks must complete within 50ms (95th percentile) to avoid impacting ERP login/navigation performance
- NFR47: AI Gateway quota check + usage recording must add no more than 100ms latency to AI calls (95th percentile)
- NFR48: Platform Admin portal must enforce MFA for all platform administrator accounts with no exceptions
- NFR49: Every platform admin action must be recorded in an immutable audit log with actor identity, timestamp, IP address, and action details — no audit log entry may be modified or deleted
- NFR50: AI usage records must be durable — zero loss of billable AI call records even during Platform API outages (local queue with guaranteed delivery)
- NFR51: Tenant entitlement cache in the ERP must support webhook-based invalidation, ensuring enforcement actions (suspend, read-only) take effect within 30 seconds of platform admin action

### Maintainability

- NFR41: All code written in TypeScript with strict mode
- NFR42: All coding performed exclusively using Claude Opus 4.6
- NFR43: Test coverage minimum 80% for business logic and financial calculation modules
- NFR44: Database schema changes managed through versioned migrations
- NFR45: All API endpoints documented with OpenAPI/Swagger specifications

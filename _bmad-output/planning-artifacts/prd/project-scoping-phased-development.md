# Project Scoping & Phased Development

## MVP Strategy & Philosophy

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

## MVP Feature Set (Phase 1)

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

## Post-MVP Features

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

## Risk Mitigation Strategy

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

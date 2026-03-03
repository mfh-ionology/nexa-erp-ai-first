# Old Spec Requirements NOT Covered by HansaWorld Extraction

## Quick Summary

The HansaWorld deep-dive covered 8 modules with 63 Prisma models across sections 2.13 to 2.20 of the architecture. These modules are: Finance/GL, Inventory, Sales Ledger (AR), Sales Orders, Purchasing/AP, Fixed Assets, Pricing, and Cross-Cutting Infrastructure.

The Old Spec contains requirements for approximately 20 additional capability areas that have NO HansaWorld equivalent because HansaWorld simply does not have these features. These are Nexa-original requirements that must be designed from scratch.

There are 5 severity levels below:

- CRITICAL: Core MVP modules with no HansaWorld source. Must be designed from first principles.
- HIGH: Important MVP features that sit outside HansaWorld's scope.
- MEDIUM: Post-MVP modules that will eventually need architecture work.
- LOW: Platform infrastructure not found in any ERP legacy system.
- INFO: Items that exist in Old Spec but are already handled elsewhere.

### Score Card

| Category | Count | Severity |
|----------|-------|----------|
| Entire modules with zero HansaWorld coverage | 8 | CRITICAL to MEDIUM |
| Major feature areas with no HansaWorld source | 7 | HIGH |
| Integration requirements with no legacy parallel | 12 | HIGH to MEDIUM |
| Platform/SaaS infrastructure requirements | 6 | LOW |
| Compliance/regulatory requirements | 8 | HIGH |
| **Total distinct gap areas** | **41** | |

### One-Line Verdict

HansaWorld gave us deep ERP transactional coverage (GL, AR, AP, SO, PO, Inventory, Pricing, Fixed Assets). Everything else in the Old Spec -- AI, HR/Payroll, CRM, Manufacturing, POS, Projects, Communications, Healthcare, DMS, Integrations, Compliance, Platform, and Mobile -- must be designed without any HansaWorld reference.

---

## Also: Status of PRD, UX Design, and Excel

**PRD (prd.md, 830 lines):** Exists and covers all 10 MVP modules at a functional requirements level (94 FRs, 45 NFRs, 7 user journeys). It references HansaWorld parity as the floor but does NOT contain the register/field/settings/report/maintenance level detail that came from the deep dives. The deep-dive findings are in the architecture only.

**UX Design Specification:** EXISTS at `_bmad-output/planning-artifacts/ux-design-specification.md` (~1,900 lines). Covers: design system (Shadcn UI + Tailwind CSS 4), visual foundation, 8 standardised screen templates (T1–T8), action bar system, AI interaction model (Concept D: Co-Pilot Dock), component strategy, UX patterns, responsive & accessibility, and UX Quality Contract. Module-specific page designs are produced at Epic level before implementation (see CLAUDE.md "Epic Page Approval Gate").

**Excel Traceability Workbook (46KB):** Exists at `Nexa-ERP-Traceability-Workbook-v1.xlsx`. It is a traceability matrix linking requirements to architecture sections. It was created before the HansaWorld deep-dive sections (2.13-2.20) were added, so it does NOT yet reference the new 63 models or the 8 new architecture sections.

**Action needed:** The PRD, Excel workbook, and future UX design all need updating to reflect the HansaWorld deep-dive findings now in architecture.md sections 2.13-2.20.

---

## CRITICAL -- Entire MVP Modules With Zero HansaWorld Coverage

These are modules required in the MVP (Old Spec and PRD) that have absolutely no HansaWorld legacy source to draw from. They must be designed entirely from requirements in the Old Spec and PRD.

---

### 1. AI Engine and Intelligence Layer

**Old Spec Source:** Master Plan sections 16, PRD FR1-FR10, Module Status summary section 8

**What the Old Spec requires:**
- AI as the PRIMARY interaction paradigm, not a bolted-on feature
- Natural language commands to create, query, and manage records across ALL modules
- AI pre-fills fields using full business context (customer history, defaults, patterns, seasonal trends)
- Personalised daily briefings by role, job description, and usage patterns
- Natural language business questions with accurate data-backed answers
- Action recommendations with explanation and one-tap approval path
- User must approve, modify, or reject any AI suggestion before it takes effect
- Conversational context maintained across session for multi-step operations
- Confidence scoring displayed for all AI-generated records
- All AI actions logged for audit and learning
- Fallback to traditional form-based interfaces at any time

**AI capabilities needed per module:**
- Finance: Smart bank reconciliation, anomaly detection, cash flow prediction, auto-categorisation, month-end assistant
- Inventory: Demand forecasting, smart reorder, anomaly detection, warehouse optimisation
- Sales/CRM: Lead scoring, next best action, win/loss analysis, smart pricing, email drafting, duplicate detection, churn prediction
- Manufacturing: Production scheduling optimisation, predictive maintenance, quality prediction, BOM optimisation
- Supply Chain: Supply risk assessment, optimal order quantity, delivery ETA prediction, spend analysis
- HR: Absence pattern detection, smart scheduling, recruitment screening, payroll anomaly detection
- Projects: Effort estimation, risk prediction, resource recommendation

**AI-first UX patterns required:**
- Command palette (Cmd+K for natural language access to any action)
- Inline AI suggestions while filling forms
- AI copilot sidebar (persistent context-aware assistant)
- AI-generated summaries on every list/register page
- Smart defaults (forms pre-filled with AI predictions)
- Natural language filters (type queries instead of building filter UI)
- Voice input for warehouse and shop floor
- AI-guided onboarding via conversation

**HansaWorld coverage:** ZERO. HansaWorld is a traditional form-driven ERP with no AI features whatsoever.

**Design source:** Old Spec product-overview.md, PRD user journeys, PRD FR1-FR10, Module Status section 8.

---

### 2. HR and Payroll Module

**Old Spec Source:** PAYROLL.md, Master Plan section 8.6, PRD FR59-FR67, Module docs hr-payroll.md

**What the Old Spec requires:**

Employee management:
- Employee records with UK-required typed fields: NI number, tax code, employment type, start date, end date, department, job title, pay rate, pay frequency, bank details, emergency contact
- Employee onboarding with configurable checklist and self-service data collection
- Organisation chart
- Performance management and appraisals
- Training and development tracking
- Benefits administration
- Onboarding and offboarding workflows
- Document management per employee

Leave management:
- Leave request, approve, reject workflow
- Leave entitlement tracking by type (annual, sick, maternity, paternity, etc.)
- Absence calendar view
- Statutory sick pay automation

Payroll engine:
- Monthly payroll run with PAYE calculation using current HMRC tax tables and codes (K, BR, W1, M1, Scottish rates)
- National Insurance contributions (employer and employee, multiple NI categories)
- Student loan deductions (Plan 1, 2, 4, Postgraduate)
- Statutory payments: SSP, SMP, SPP, ShPP, SAP with eligibility rules
- Auto-enrolment pension: eligibility assessment, opt-in/opt-out, contribution calculations
- Payroll journal generation (integration with Finance GL)
- P45, P46, and Starter Declaration handling
- P60 year-end certificates
- P11D benefits reporting

HMRC submissions:
- Real Time Information (RTI): FPS (Full Payment Submission) and EPS (Employer Payment Summary) per pay period
- Government Gateway OAuth authentication

Payments:
- BACS payment file generation for payroll
- Payslip generation per employee per run

**HansaWorld coverage:** HansaWorld does have a payroll module (PPrsVc, PPDVc), but it was NOT deep-dived because it is highly country-specific (Nordic-focused). The UK payroll rules (PAYE, NI, RTI, auto-enrolment) have no HansaWorld equivalent. This module must be designed from UK regulatory requirements.

**Design source:** Old Spec PAYROLL.md, PRD FR59-FR67, HMRC RTI specifications, UK payroll legislation.

---

### 3. CRM Module

**Old Spec Source:** Master Plan section 6.6, PRD FR54-FR58, Module docs sales-crm.md

**What the Old Spec requires:**
- Leads with status tracking, source, and conversion to customers or quotes
- Opportunities with pipeline stages, probability weighting, and expected close dates
- Pipeline kanban board visualisation
- Contacts and accounts with full activity history
- Activity logging: calls, meetings, emails, notes against contacts and accounts
- Activities with reminders and follow-up scheduling
- Campaign management
- Territory and region assignment
- Commission tracking
- Lead scoring (AI-driven)
- Duplicate detection (AI-driven)
- Customer 360 view (unified cross-module view)
- Customer portal (post-MVP)
- Link CRM records to sales transactions

**HansaWorld coverage:** HansaWorld has Activities (ActVc) which we mapped in section 2.20 as a cross-cutting entity. But HansaWorld has NO dedicated CRM module -- no leads, no opportunities, no pipeline, no campaign management. The Activities model covers calendar bookings and CRM notes, but the full CRM entity set must be designed from scratch.

**Design source:** Old Spec sales-crm.md, PRD FR54-FR58.

---

### 4. Manufacturing Module

**Old Spec Source:** Master Plan section 6.8, PRD FR68-FR73, Module docs manufacturing.md, Process docs make-to-stock.md

**What the Old Spec requires:**
- Bills of Materials (BOMs) with multi-level component structures
- Version-controlled BOMs with effectivity dates
- Routings with operation steps, work centres, and run times
- Work orders with material requirements and routing operations
- Work order lifecycle: create, release, in-progress, complete, close
- Production scheduling by sales order priority and material availability
- Material consumption recording against work orders (issue/backflush)
- Finished goods receipt from completed work orders
- Work-in-Progress (WIP) tracking and reporting
- Cost roll-ups from BOMs
- Variance handling (material, labour, overhead) with approvals
- Scrap recording with approvals
- Material availability check before WO confirmation with shortage alerts
- MRP (Material Requirements Planning): reorder point, lead time, demand netting
- Co-product and by-product handling
- Subcontracting
- Production batch tracking and lot genealogy
- Quality management: holds, non-conformance (NC), corrective and preventive action (CAPA)
- Supplier quality scoring
- Engineering Change Orders (ECO)
- Shop floor execution interface

**HansaWorld coverage:** HansaWorld does have manufacturing registers (ProdVc, ProdOpVc, BOMLVc). These were NOT deep-dived yet (marked NOT STARTED on module roadmap). Manufacturing is a Phase 2 module on the roadmap. When the deep dive happens, some HansaWorld manufacturing patterns will emerge, but the advanced features (MRP, APS, quality/CAPA, ECO) likely exceed HansaWorld's capabilities.

**Design source:** Old Spec manufacturing.md, make-to-stock.md, PRD FR68-FR73, Phase 2 and Phase 3 plans.

---

### 5. POS (Point of Sale)

**Old Spec Source:** Master Plan section 6.10, Process docs pos.md

**What the Old Spec requires:**
- POS register (cashier/till interface)
- POS sessions: open, close, shift management
- Sale transactions: create, finalise, void
- Payment processing (cash, card, split payment)
- Receipt generation (HTML and PDF)
- Returns and refunds
- End-of-day reconciliation and cashup
- X and Z reports per shift
- Product search and quick-add
- Discount and promotion engine
- Customer lookup and loyalty
- Offline mode (continue selling when internet is down)
- Multi-register and multi-store support
- Cash drawer management
- Till reconciliation
- Barcode scanner integration
- Card-present payment via Stripe Terminal

**HansaWorld coverage:** HansaWorld has POS-related fields scattered across modules (POSSessionRn, CreatePOSButtonsMn, fields like MachineName, TerminalID on invoices) but no coherent POS module was extracted. POS is marked NOT STARTED on the module roadmap.

**Design source:** Old Spec pos.md, Master Plan section 6.10, Phase 2 plans.

---

### 6. Projects and Time Tracking

**Old Spec Source:** Master Plan section 6.9, PRD not in MVP, Module docs projects.md, Process docs project-billing.md

**What the Old Spec requires:**
- Project management with tasks, milestones, and dependencies
- Project boards and kanban
- Timesheets: submit, approve, reject with rollup calculations
- Expense tracking per project
- Resource allocation and utilisation
- Billing modes: fixed price and time-and-materials (T&M)
- Milestone-based billing
- Revenue recognition
- Budget vs actuals tracking per project
- Project templates
- Risk and issue register
- Project profitability dashboard
- Gantt chart visualisation
- Client-facing portal (post-MVP)

**HansaWorld coverage:** HansaWorld has project-related entities (PRVc for projects, Activities with PRCode linkage). These were partially captured in cross-cutting (section 2.20, Activity model has project linkage). But the full project management, timesheet, expense, and billing architecture must be designed from scratch.

**Design source:** Old Spec projects.md, project-billing.md, Phase 2 plans.

---

### 7. Communication: Chat and Calls

**Old Spec Source:** Master Plan section 6.12, product-overview.md

**What the Old Spec requires:**
- Nexa Chat: internal messaging within the platform
- Tenant-isolated channels with role-based access
- Direct messaging
- Channel management (create, join, leave)
- Message search
- File sharing in chat
- Thread support
- Mentions and notifications
- Audio calls: browser-based via WebRTC
- Video calls: browser-based via WebRTC
- Call metadata: who, when, duration
- No PSTN integration
- No default recording (opt-in only with consent)
- Sensitive read logging for chat content
- TURN/STUN server infrastructure

**HansaWorld coverage:** ZERO. HansaWorld has no communication features. Entirely Nexa-original.

**Design source:** Old Spec product-overview.md, Master Plan section 6.12.

---

### 8. Document Management System (DMS)

**Old Spec Source:** Master Plan section 6.11, Module Status

**What the Old Spec requires:**
- Document storage with folder structure
- Document versioning
- Document templates (invoice templates, PO templates, etc.)
- PDF generation for business documents
- Document approval workflows
- OCR and scanning (AI-powered)
- Tagging and categorisation
- Full-text search across documents
- External sharing with links
- Retention policies with automatic enforcement
- Virus scanning pipeline for uploads
- S3-compatible object storage with signed URLs

**HansaWorld coverage:** PARTIAL. HansaWorld has attachments (Attach2Vc) and document forms (DocVc). We mapped Attachment in section 2.20 with S3/MinIO presigned URL flow. But the full DMS (versioning, folders, templates, OCR, full-text search, retention enforcement) is beyond what HansaWorld provides.

**Design source:** Old Spec Master Plan section 6.11, section 2.20 for attachment foundation.

---

## HIGH -- Major Feature Areas Not in HansaWorld

---

### 9. VAT and UK Tax Compliance

**Old Spec Source:** PRD FR89-FR94, Process docs vat-uk-mtd.md, Master Plan sections on compliance

**What the Old Spec requires:**
- HMRC Making Tax Digital (MTD) VAT API integration
- VAT obligation retrieval from HMRC
- VAT return preparation from transaction data
- VAT return submission via MTD API
- Government Gateway OAuth authentication
- VAT schemes: Standard, Flat Rate, Cash Accounting, Annual Accounting
- VAT rates: Standard 20%, Reduced 5%, Zero 0%, Exempt, Outside Scope, Reverse Charge
- EC Sales List and Postponed VAT Accounting (post-Brexit imports)
- Construction Industry Scheme (CIS) deductions
- Evidence retention per HMRC requirements
- Rounding rules per UK VAT guidance (per line vs per invoice)

**HansaWorld coverage:** HansaWorld has VATCodeBlock and VAT fields throughout, which we captured in the architecture. But the UK-specific MTD API integration, HMRC Gateway auth, and UK VAT schemes are not in HansaWorld (which is Nordic/international).

**Design source:** HMRC MTD API documentation, Old Spec vat-uk-mtd.md, PRD FR89-FR94.

---

### 10. Reporting and Analytics Engine

**Old Spec Source:** PRD FR74-FR79, Module Status, Master Plan

**What the Old Spec requires (10 P0 reports minimum):**
- Profit and Loss (P&L) statement
- Balance Sheet
- Trial Balance
- Cash Flow Statement
- AR Aging report by customer and date band
- AP Aging report by supplier and date band
- Stock Valuation report
- Bank Reconciliation report
- Manufacturing Variance report
- Manufacturing WIP report
- Margin report
- VAT returns
- Payslips and employee list
- PDF and CSV export for all reports
- Natural language ad-hoc reporting via AI
- Budget vs actual variance

**HansaWorld coverage:** HansaWorld has extensive report files (POStatRn, APRn, ARS2Rn, PriceRn, etc.) which we documented in the deep-dive findings. But the actual report logic, layout, and calculations were not extracted into the architecture -- only the existence of reports was noted. The Nexa reporting engine (rendering, PDF generation, NL queries) must be designed from scratch.

**Design source:** Old Spec, PRD FR74-FR79, FRS 102 reporting standards.

---

### 11. Bank Integration and Open Banking

**Old Spec Source:** PRD FR16-FR18, Master Plan section 11.4, configuration docs

**What the Old Spec requires:**
- Open Banking API (UK) via TrueLayer, Yapily, or Plaid
- Bank feed automatic sync
- OFX, CSV, and MT940 file import for manual upload
- Auto-match bank transactions to open invoices and bills (target 80% or higher match rate)
- AI-powered matching with confidence scoring
- BACS payment file generation (Standard 18 format) for supplier and payroll payments
- Faster Payments and CHAPS support via bank API
- Bank account health monitoring
- Bank rules for auto-categorisation

**HansaWorld coverage:** PARTIAL. HansaWorld has BankVc, BankTRVc, and bank reconciliation registers which we mapped to BankAccount, BankTransaction, and BankReconciliation in section 2.13. But the Open Banking API integration, auto-match algorithms, and BACS file generation logic must be designed from scratch.

**Design source:** Old Spec Master Plan section 11, TrueLayer API docs, BACS Standard 18 specification.

---

### 12. Integrations Framework (12 External Systems)

**Old Spec Source:** Master Plan section 11, configuration docs, Phase 6 connector docs

**External integrations required that have no HansaWorld equivalent:**

| Integration | Purpose | Old Spec Reference |
|---|---|---|
| HMRC MTD VAT API | Submit VAT returns digitally | vat-uk-mtd.md |
| HMRC RTI API | Submit payroll FPS/EPS | PAYROLL.md, Phase 6 connectors |
| Stripe | SaaS billing, payments, webhooks | Phase 4, configuration docs |
| Stripe Terminal | Card-present POS payments | Module Status POS section |
| TrueLayer | Open Banking feeds | configuration-and-env.md |
| Staffology or PayRun.io | UK payroll calculations API | PRD section 1.5 |
| Pension provider API | NEST, People's Pension | PRD section 1.5 |
| Companies House API | Company lookup, filing | PRD section 1.5 |
| Email SMTP/IMAP | Invoice delivery, bill ingestion | PRD section 1.5 |
| OCR service | Invoice and receipt scanning | PRD FR32 |
| Bank of England | Daily exchange rate feeds | PRD section 1.5 |
| Shopify, Amazon, eBay | E-commerce connectors | Phase 6 connectors |
| EDI | B2B document exchange | Phase 6 connectors |

**HansaWorld coverage:** ZERO for all integration APIs. HansaWorld is a self-contained desktop ERP with no REST API integrations.

---

### 13. Workflow Engine (Beyond OKFlag)

**Old Spec Source:** Module Status, product-overview.md

**What the Old Spec requires beyond the OKFlag pattern already in the architecture:**
- Visual workflow designer
- Conditional branching (if amount > X, route to Y)
- Parallel approval paths
- Escalation rules with timeouts
- Delegation (out-of-office routing)
- SLA tracking
- Workflow templates
- Email notifications on approval events
- Mobile approval support
- Custom triggers (not just document approval)

**HansaWorld coverage:** PARTIAL. We extracted ApprovalRule, ApprovalRuleLevel, and ApprovalRequest in section 2.20 with auto-escalation. But the visual designer, conditional branching, parallel paths, and SLA tracking are beyond HansaWorld's acceptance workflow.

---

### 14. Notification System

**Old Spec Source:** Module Status, Master Plan section 17

**What the Old Spec requires:**
- In-app notification centre with bell icon
- Email notification delivery
- Push notifications (mobile)
- SMS notifications (optional)
- Per-user notification preferences
- Digest and summary notifications
- Webhook notifications (outbound events)
- Server-Sent Events (SSE) for real-time updates
- Notification templates (configurable)
- Events: invoice created, payment received, stock alert, approval needed, etc.

**HansaWorld coverage:** HansaWorld has AlarmVc (section 2.20 cross-cutting deep-dive) which covers basic reminders. But modern push/email/SMS notification infrastructure must be designed from scratch.

---

### 15. Security and Compliance Requirements

**Old Spec Source:** SECURITY.md, LEGAL-COMPLIANCE-NOTES.md, Master Plan section 12-13, PRD NFR8-NFR16

**Requirements not derivable from HansaWorld:**
- GDPR compliance: Records of Processing Activities (RoPA), Data Protection Impact Assessment (DPIA) for payroll, data subject rights (access, rectification, erasure, portability, objection), data retention policies, breach notification within 72 hours
- PECR: Cookie consent mechanism, electronic marketing opt-in/opt-out
- UK Data Protection Act 2018 for employee data
- SOC 2 Type II target for commercialisation
- Data classification scheme: Public, Internal, Confidential
- AML/KYC for financial transactions
- MFA/2FA (TOTP minimum)
- SSO and SAML
- Segregation of Duties (SoD) enforcement at runtime
- Maker-checker patterns
- Immutable tamper-evident audit trail for financial modifications
- Sensitive read logging (HR, healthcare, chat, DMS, tenant config)
- SIEM integration
- Security headers: CSP, HSTS, XFO, XCTO, Referrer-Policy
- Rate limiting on auth and sensitive APIs
- WCAG 2.2 Level AA accessibility
- IT asset inventory

**HansaWorld coverage:** HansaWorld has OKFlag (approval) and basic user authentication. ZERO coverage of modern security, compliance, GDPR, or accessibility requirements.

---

## MEDIUM -- Post-MVP Modules

---

### 16. Healthcare Vertical

**Old Spec Source:** Master Plan section 6.14, product-overview.md

**What the Old Spec requires:**
- Rota and scheduling management
- Patient records (if stored, heavily controlled)
- Appointment scheduling (integration-driven)
- Referrals management
- CQC compliance reporting
- Operational-only AI assistance (explicitly no diagnosis or treatment suggestions)
- PHI (Protected Health Information) redaction
- Enhanced audit logging for healthcare data access
- Segregation, encryption, retention, and consent management

**HansaWorld coverage:** ZERO. No healthcare features in HansaWorld.

---

### 17. Enterprise Features (Intercompany, Consolidation, Treasury)

**Old Spec Source:** Module Status, Phase 3 plans

**What the Old Spec requires:**
- Intercompany transactions with automatic elimination entries
- Consolidation reporting (group-level financials across entities)
- Consolidation exchange rates (P&L rates vs balance sheet rates)
- Treasury dashboard with cash position management
- Cash forecasting
- FX exposure tracking and netting
- Inter-entity transfer pricing

**HansaWorld coverage:** PARTIAL. HansaWorld has DaughterCompBlock, ConsolidationBlock, ConsERVc (consolidation exchange rates), and ShareVcSetBlock (shared registers). These were documented in the cross-cutting deep-dive but NOT included in architecture section 2.20 because they are Phase 3. The HansaWorld patterns provide a useful starting point when this module is designed.

---

### 18. Supply Chain Extensions

**Old Spec Source:** Module Status, Phase 2 plans

**What the Old Spec requires beyond basic purchasing and inventory:**
- Pick, pack, ship workflow with wave planning
- Advanced warehouse operations: putaway, replenishment, cross-docking
- Bin and zone management within warehouses
- RMA (Return Merchandise Authorization) and returns processing
- Freight and shipping rate management
- Carrier integration (labels, tracking)
- Drop-ship capability
- Advanced Shipping Notice (ASN) processing
- Demand planning
- Barcode and QR code scanning throughout
- FEFO (First Expired First Out) for perishables

**HansaWorld coverage:** PARTIAL. HansaWorld has some warehouse fields (LocationVc, RetPUVc for returns) captured in the deep dives. But advanced WMS features (pick/pack/ship, wave planning, bin management, carrier integration) are beyond HansaWorld's capabilities.

---

## LOW -- Platform and SaaS Infrastructure

---

### 19. Multi-Tenant SaaS Platform

**Old Spec Source:** Master Plan section 3, PRD section 1.7

**What the Old Spec requires:**
- Database-per-tenant with zero shared ERP state
- Connection routing: request to resolve tenant to connect to correct DB
- Tenant provisioning: create DB, apply migrations, seed defaults within 60 seconds
- Tenant lifecycle: Active, Suspended, Closed
- Per-tenant schema migration scheduling
- Platform database for subscriber management (post-MVP)
- Subscription tiers: Starter, Business, Enterprise with module gating
- Stripe billing integration with webhooks
- Tenant data export and deletion (GDPR)
- Up to 1000 tenants without architectural changes

**HansaWorld coverage:** ZERO. HansaWorld is a single-company desktop application. Multi-tenancy is an entirely Nexa concept.

---

### 20. Super Admin Platform Console

**Old Spec Source:** Master Plan section 6.3, Module Status

**What the Old Spec requires:**
- Cross-tenant administration interface
- Tenant management (create, suspend, close)
- Global user management
- Billing and plans administration
- Feature flag management with A/B testing
- System health monitoring in real-time
- Audit log review across tenants
- Integration management
- Support mode with impersonation (audited, time-limited)
- Migration management
- Anomaly alerting

**HansaWorld coverage:** ZERO. No platform console concept in HansaWorld.

---

### 21. Custom Fields Engine

**Old Spec Source:** Module Status

**What the Old Spec requires:**
- User-defined custom fields on CRM, Inventory, Healthcare, and other modules
- Field definitions with types (text, number, date, dropdown, etc.)
- Validation rules per field
- Conditional visibility
- Custom field values stored and queried
- Custom field reporting and filtering
- Bulk import and export of custom field data

**HansaWorld coverage:** HansaWorld has UserStr1-5, UserVal1-3, UserDate1-3 fields on several registers (CUVc, ContactVc, ActVc). These fixed user fields were noted in the deep dives but are far simpler than a dynamic custom fields engine.

---

### 22. Mobile Application

**Old Spec Source:** Phase 6 mobile-parity.md

**What the Old Spec requires:**
- Offline draft storage for mobile
- Push notification inbox
- Background sync for offline-to-online data
- Web-mobile screen parity across all modules
- Expo Notifications integration (real push)

**HansaWorld coverage:** ZERO. HansaWorld is a desktop application with no mobile concept.

---

### 23. Feature Flags System

**Old Spec Source:** feature-flags.md, connector-flags.md

**What the Old Spec requires:**
- Server-side feature flag evaluation
- Gradual rollout support (percentage or segment-based)
- Owner and expiry date per flag
- Flags must be removed after full rollout
- Per-connector enable/disable flags via environment variables

**HansaWorld coverage:** ZERO. No feature flag concept in HansaWorld.

---

### 24. Number Series and Configuration Engine

**Old Spec Source:** PRD FR86, Module Status, PRD FR83

**What the Old Spec requires:**
- Configurable number series per document type (invoice, PO, journal, etc.)
- Prefix plus sequential counter
- Per-module settings (payment terms defaults, VAT schemes, currency, etc.)
- Company profile and branding settings
- Email template customisation
- Fiscal year and calendar configuration

**HansaWorld coverage:** PARTIAL. HansaWorld has SerNrTrackBlock and CYBlock (Company Year) with number series arrays. These were documented in the cross-cutting deep-dive. The existing architecture (section 2.10 System Module) already has NumberSeries and SystemSetting models. But the configuration UI and wizards must be designed from scratch.

---

## Summary Table

| # | Gap Area | Severity | HansaWorld Coverage | Design Source |
|---|----------|----------|-------------------|---------------|
| 1 | AI Engine and Intelligence | CRITICAL | ZERO | Old Spec, PRD FR1-FR10 |
| 2 | HR and Payroll | CRITICAL | ZERO (UK-specific) | Old Spec, PRD FR59-FR67, HMRC rules |
| 3 | CRM | CRITICAL | Activities only | Old Spec, PRD FR54-FR58 |
| 4 | Manufacturing | CRITICAL | Not yet deep-dived | Old Spec, PRD FR68-FR73 |
| 5 | POS | MEDIUM | Fragments only | Old Spec, Master Plan |
| 6 | Projects and Time | MEDIUM | Activities only | Old Spec, project-billing.md |
| 7 | Chat and Calls | MEDIUM | ZERO | Old Spec, product-overview.md |
| 8 | DMS (full) | MEDIUM | Attachments only | Old Spec, Master Plan |
| 9 | VAT and UK Tax | HIGH | VAT codes only | HMRC MTD docs, PRD FR89-FR94 |
| 10 | Reporting Engine | HIGH | Report names only | PRD FR74-FR79, FRS 102 |
| 11 | Bank Integration | HIGH | Models only | TrueLayer docs, BACS spec |
| 12 | Integrations (12 systems) | HIGH | ZERO | Old Spec, Phase 6 connectors |
| 13 | Workflow Engine (advanced) | HIGH | Basic approval | Old Spec, Module Status |
| 14 | Notification System | HIGH | Alarms only | Old Spec, Master Plan |
| 15 | Security and Compliance | HIGH | ZERO | GDPR, HMRC, WCAG, SOC 2 |
| 16 | Healthcare Vertical | MEDIUM | ZERO | Old Spec, product-overview.md |
| 17 | Enterprise (Intercompany) | MEDIUM | Partial (blocks) | Old Spec, Phase 3 |
| 18 | Supply Chain Extensions | MEDIUM | Partial | Old Spec, Phase 2 |
| 19 | Multi-Tenant Platform | LOW | ZERO | Old Spec, PRD section 1.7 |
| 20 | Super Admin Console | LOW | ZERO | Old Spec, Master Plan |
| 21 | Custom Fields Engine | LOW | Fixed user fields | Old Spec, Module Status |
| 22 | Mobile Application | LOW | ZERO | Phase 6 mobile-parity.md |
| 23 | Feature Flags System | LOW | ZERO | feature-flags.md |
| 24 | Number Series / Config | LOW | Partial (blocks) | PRD FR83, FR86 |

---

## Recommendation

The HansaWorld deep-dive has given us exceptional coverage of the core ERP transactional layer: General Ledger, Accounts Receivable, Accounts Payable, Sales Orders, Purchase Orders, Inventory, Pricing, and Fixed Assets. These 8 modules now have 63 detailed Prisma models with full field definitions, business logic, and workflow descriptions in the architecture.

For the 24 gap areas listed above, the design must come from:
1. The Old Spec requirements (captured above)
2. The PRD functional requirements (FR1-FR94)
3. UK regulatory specifications (HMRC, GDPR, PECR, FRS 102)
4. Domain best practices and modern SaaS patterns
5. Future HansaWorld deep-dives (Manufacturing is the most valuable remaining one)

**Immediate next steps should prioritise:**
1. Manufacturing deep-dive (Phase 2 module, HansaWorld has BOMs and WOs to extract)
2. CRM architecture design (CRITICAL MVP module, minimal HansaWorld input)
3. HR/Payroll architecture design (CRITICAL MVP module, UK-specific, no HansaWorld input)
4. AI Engine architecture design (the core differentiator)
5. Update PRD and Excel workbook to reference architecture sections 2.13-2.20

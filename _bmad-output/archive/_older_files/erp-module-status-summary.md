# Nexa ERP — Module Status Summary

> Generated: 2026-01-29
> Purpose: Map all modules, screens, and completion status. Identify gaps and AI-First requirements.

---

## Table of Contents

1. [Module Hierarchy](#1-module-hierarchy)
2. [Tier 0 — Foundation Modules](#2-tier-0--foundation-modules)
3. [Tier 1 — Core Business Modules](#3-tier-1--core-business-modules)
4. [Tier 2 — Operational Modules](#4-tier-2--operational-modules)
5. [Tier 3 — Extended / Vertical Modules](#5-tier-3--extended--vertical-modules)
6. [Tier 4 — Platform & Intelligence Modules](#6-tier-4--platform--intelligence-modules)
7. [Cross-Module Gaps Summary](#7-cross-module-gaps-summary)
8. [AI-First Requirements](#8-ai-first-requirements)

---

## 1. Module Hierarchy

Modules are layered by dependency — each tier depends on the tiers below it.

```
TIER 4 — Platform & Intelligence
  AI Engine | Workflow Engine | Notifications | Integrations | DMS

TIER 3 — Extended / Vertical
  Healthcare | Chat | Enterprise (Intercompany/Consolidation/Treasury)

TIER 2 — Operational
  Manufacturing | Supply Chain (Pick/Pack/Ship, Replenishment, RMA)
  POS | Projects & Time | HR & Payroll | Planning & Budgeting

TIER 1 — Core Business
  Finance (GL, AR, AP, Banking, FA, VAT) | Inventory & WMS
  Sales & CRM | Purchasing

TIER 0 — Foundation
  Auth & RBAC | Tenancy | Audit | Admin & Users | Settings & Modules
  Billing (SaaS) | Custom Fields
```

---

## 2. Tier 0 — Foundation Modules

### 2.1 Auth & RBAC

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Login | `/login` | DONE | NextAuth credentials + optional Google/Microsoft |
| Forgot Password | `/forgot-password` | DONE | |
| Reset Password | `/reset-password` | DONE | |
| Reset Temp Password | `/reset-temp-password` | DONE | |
| RBAC Middleware | server-side | DONE | 5 roles: SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER |
| Permission Guards | server-side | DONE | Per-route, per-API enforcement |
| Module Toggle Gating | server-side | DONE | Feature flags per tenant |

**Completion: 95%**
**Missing:**
- SSO / SAML provider support (only credentials + optional OAuth stubs)
- MFA / 2FA (not implemented)
- Session management UI (active sessions, force-logout for self)
- Password policy configuration (min length, complexity, expiry)

---

### 2.2 Tenancy & Admin

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Admin Dashboard | `/admin/dashboard` | DONE | |
| User Management | `/admin/users`, `/admin/users/[id]` | DONE | CRUD, role assign, force-logout |
| Global Users | `/admin/global-users` | DONE | |
| Audit Log | `/admin/audit` | DONE | Centralized, non-PII |
| Backups | `/admin/backups` | DONE | List, run, download, restore dry-run |
| Jobs Monitor | `/admin/jobs` | DONE | Dead letter, retry |
| Metrics | `/admin/metrics` | DONE | |
| GDPR / Compliance | `/admin/gdpr` | DONE | Export, delete |
| Imports | `/admin/imports` | DONE | Customers, items, suppliers |
| Integrations Admin | `/admin/integrations` | DONE | Overview, sandbox, sync |
| AI Logs | `/admin/ai-logs` | DONE | |
| Plan & Billing | `/admin/plan-billing` | DONE | |
| Tenant Config | API only | DONE | Timezone, modules, features |

**Completion: 90%**
**Missing:**
- Tenant self-service onboarding wizard (setup page exists but is minimal)
- Role/permission matrix editor (roles are hard-coded)
- Custom role creation
- IP whitelisting / access restrictions
- Data retention policies UI

---

### 2.3 Super Admin (Platform Console)

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| SA Dashboard | `/super-admin/dashboard` | DONE | |
| Tenant Management | `/super-admin/tenants`, `/super-admin/tenants/[tenantId]` | DONE | |
| User Management | `/super-admin/users` | DONE | |
| Billing & Plans | `/super-admin/billing`, `/super-admin/plan-catalog` | DONE | Plan templates CRUD |
| Compliance | `/super-admin/compliance` | DONE | Config, checks, export |
| Security | `/super-admin/security` | DONE | Policies |
| Audit | `/super-admin/audit` | DONE | Config changes, sensitive reads, SA actions |
| Integrations | `/super-admin/integrations` | DONE | |
| Monitoring | `/super-admin/monitoring` | DONE | |
| Ops / Runbooks | `/super-admin/ops` | DONE | |
| Notifications Config | `/super-admin/notifications` | DONE | |
| AI Config | `/super-admin/ai` | DONE | |
| Help | `/super-admin/help` | DONE | |

**Completion: 85%**
**Missing:**
- Real-time tenant health monitoring (currently snapshot-based)
- Automated anomaly alerting
- Multi-region tenant routing
- Feature flag A/B testing controls

---

### 2.4 Settings & Module Configuration

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Module Toggles | `/settings/modules` | DONE | Enable/disable per tenant |
| Billing Settings | `/settings/billing` | DONE | |
| Custom Fields Config | `/settings/custom-fields` | DONE | Define fields per entity |
| Integrations Settings | `/settings/integrations` | DONE | Tenant-level provider config |

**Completion: 85%**
**Missing:**
- Company profile / branding settings (logo, colors, address)
- Email template customization
- Number sequence configuration (invoice numbers, PO numbers, etc.)
- Tax configuration wizard
- Currency & exchange rate settings UI
- Fiscal year / calendar configuration

---

### 2.5 SaaS Billing (Stripe)

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Billing Status | API `/api/billing/status` | DONE | |
| Checkout Flow | API `/api/billing/checkout` | DONE | |
| Customer Portal | API `/api/billing/portal` | DONE | |
| Webhook Handler | API `/api/stripe/webhook` | DONE | |
| Plan Feature Gating | server-side | DONE | requirePlanFeature, featureFlags |

**Completion: 90%**
**Missing:**
- Usage-based billing metering (model exists but capture is partial)
- Add-on management UI
- Billing history / invoice download for tenants

---

### 2.6 Custom Fields

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Field Definitions | `/settings/custom-fields` | DONE | |
| Field Values API | `/api/custom/values` | DONE | |
| Dynamic Rendering | Components | DONE | Renders in CRM, Inventory, Healthcare |

**Completion: 85%**
**Missing:**
- Field validation rules (regex, range, required)
- Conditional visibility (show field X when field Y = Z)
- Custom field reporting / filtering
- Bulk import/export of custom field values

---

## 3. Tier 1 — Core Business Modules

### 3.1 Finance

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Finance Dashboard | `/finance` | DONE | |
| **General Ledger** | | | |
| Journal Entries | `/finance/journals` | DONE | List, post, reverse |
| GL Posting | API `/api/finance/gl/post` | DONE | |
| GL Reverse | API `/api/finance/gl/reverse` | DONE | |
| Chart of Accounts | DB: CoaTemplate, CoaTemplateLine | PARTIAL | Templates exist; no dedicated COA management UI |
| **Accounts Receivable** | | | |
| AR Dashboard | `/finance/ar` | DONE | |
| AR Aging | `/finance/ar/aging` | DONE | |
| Invoices | `/finance/invoices` | DONE | Create, approve, pay, credit, write-off |
| Customer Payments / Receipts | `/finance/payments` | DONE | Record, reverse |
| Credit Notes | API `/api/finance/ar/credit-note/create` | DONE | |
| **Accounts Payable** | | | |
| AP Dashboard | `/finance/ap` | DONE | |
| AP Aging | `/finance/ap/aging` | DONE | |
| Bills | `/finance/bills` | DONE | Create, update, credit |
| Supplier Payments | `/finance/payments` | DONE | Record, reverse |
| **Banking** | | | |
| Bank Accounts | `/finance/bank` or `/finance/banking` | DONE | |
| Bank Reconciliation | `/finance/reconciliation` | DONE | |
| Statement Import | API `/api/banking/statements/import` | DONE | |
| Unreconciled Report | API | DONE | |
| **Fixed Assets** | | | |
| FA Register | `/finance/fa/register` | DONE | |
| FA Depreciation | `/finance/fa/depreciation` | DONE | Schedule, run |
| Asset Acquire / Dispose / Revalue | APIs | DONE | |
| **VAT** | | | |
| VAT Codes | `/finance/vat` | DONE | |
| VAT Returns / MTD Submit | API `/api/finance/vat/submit` | DONE | Sandbox/stub |
| **Period Management** | | | |
| Period Open/Close | `/finance/close` | DONE | Lock/unlock |
| **FX** | | | |
| FX Revaluation | `/finance/fx` | DONE | |
| **Reports** | | | |
| P&L | `/finance/reports` | DONE | |
| Trial Balance | `/finance/reports` | DONE | |
| Balance Sheet | `/finance/reports` | DONE | |
| Inventory Valuation Report | `/finance/reports/inventory-valuation` | DONE | |
| Manufacturing Variance Report | `/finance/reports/manufacturing-variance` | DONE | |
| Manufacturing WIP Report | `/finance/reports/manufacturing-wip` | DONE | |
| Margin Report | `/finance/reports/margin` | DONE | |
| Expenses | `/finance/expenses` | DONE | |
| Purchase Orders (Finance view) | `/finance/purchase-orders` | DONE | |

**Completion: 80%**
**Missing:**
- Chart of Accounts management UI (add/edit/deactivate accounts — templates exist, no CRUD screen)
- Multi-currency GL postings (FX revaluation exists but multi-currency transactions are partial)
- Recurring journals / templates
- Budget vs actual variance in GL
- Intercompany elimination in consolidation (Enterprise module stubs exist but not connected)
- Cash flow statement report
- Aged debt letters / dunning automation
- Payment allocation / matching UI
- Bank rules for auto-categorization
- Financial dashboard KPI widgets (KPI snapshots exist but dashboard is basic)

---

### 3.2 Inventory & WMS

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Inventory Dashboard | `/inventory` | DONE | |
| Item Master | `/inventory/items` | DONE | CRUD, file-backed + DB hybrid |
| Categories | `/inventory/categories` | DONE | |
| Warehouses | `/inventory/warehouses` | DONE | CRUD |
| Stock Movements | `/inventory/stock-movements` | DONE | |
| Adjustments | `/inventory/adjustments` | DONE | |
| Transfers | `/inventory/transfers` | DONE | |
| Lot Tracking | `/inventory/lots`, `/inventory/lots/[id]` | DONE | |
| Cycle Count | `/inventory/cycle-count` | DONE | Plan, count, post variance |
| Quality Inspections | `/inventory/quality` | DONE | Inspections, holds, release |
| Valuation | `/inventory/valuation` | DONE | Report |
| Shipments | `/inventory/shipments` | DONE | |
| Suppliers (Inventory view) | `/inventory/suppliers` | DONE | |
| WMS Receiving | `/inventory/wms/receiving` | DONE | GRN, open POs, putaway |
| WMS Shipping | `/inventory/wms/shipping` | DONE | Open SOs, pick, ship |
| ATP (Available to Promise) | API `/api/inventory/atp` | DONE | |

**Completion: 85%**
**Missing:**
- Bin/location management within warehouses (Location model exists but no dedicated UI)
- Barcode/QR scanning integration
- Serial number tracking (lots exist but no serial-level)
- Reorder point alerts / automation
- Inventory forecasting (demand planning)
- Multi-unit-of-measure conversion
- Kitting / assembly (separate from manufacturing BOM)
- Consignment inventory tracking
- Inventory images / attachments per item

---

### 3.3 Sales & CRM

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| **CRM** | | | |
| Leads | `/crm/leads`, `/crm/leads/[id]` | DONE | Create, convert, cancel |
| Accounts | `/crm/accounts`, `/crm/accounts/[id]` | DONE | |
| Contacts | `/crm/contacts`, `/crm/contacts/[id]` | DONE | |
| Opportunities | `/crm/opportunities`, `/crm/opportunities/[id]` | DONE | Reopen support |
| Activities | `/crm/activities` | DONE | |
| Quotes | `/crm/quotes`, `/crm/quotes/[id]` | DONE | Approve, cancel, supersede |
| Price Books | `/crm/price-books`, `/crm/price-books/[id]` | DONE | |
| **Sales** | | | |
| Sales Dashboard | `/sales` | DONE | |
| Sales Leads | `/sales/leads` | DONE | |
| Sales Quotes | `/sales/quotes` | DONE | |
| Sales Opportunities | `/sales/opportunities` | DONE | |
| Customers | `/sales/customers` | DONE | |
| Sales Orders | `/sales/orders` | DONE | Create, deliver |
| Invoice from Order | API | DONE | `sales/invoice/from-order` |
| Margin Report | API | DONE | |
| Credit Note from Sales | API | DONE | |

**Completion: 80%**
**Missing:**
- Sales pipeline visualization / kanban board
- Email integration (send/receive from CRM — email module exists but not linked)
- Sales forecasting / quota management
- Territory / region assignment
- Commission tracking
- Contract management (separate from purchasing contracts)
- Customer portal (self-service)
- Campaign management / marketing automation
- Lead scoring (AI candidate)
- Duplicate detection (AI candidate)
- Customer 360 view (unified cross-module customer view)

---

### 3.4 Purchasing

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Purchasing Dashboard | `/purchasing` | DONE | |
| Suppliers | `/purchasing/suppliers` | DONE | CRUD |
| Purchase Orders | `/purchasing/orders` | DONE | Approve workflow |
| RFQ | `/purchasing/rfq` | DONE | Create, respond, award |
| Contracts | `/purchasing/contracts` | DONE | |
| Bill from PO | API | DONE | `purchasing/bill/from-po` |
| GRN Posting | API | DONE | `purchasing/grn/post` |

**Completion: 80%**
**Missing:**
- Purchase requisitions (internal request before PO)
- Blanket / framework orders
- Supplier evaluation / rating UI (scorecards exist in Supply Chain but not in Purchasing)
- Three-way matching UI (PO vs GRN vs Invoice — logic exists but no dedicated screen)
- Approval delegation / escalation rules
- Purchase price variance tracking
- Supplier self-service portal

---

## 4. Tier 2 — Operational Modules

### 4.1 Manufacturing

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Manufacturing Dashboard | `/manufacturing` | DONE | |
| Work Orders | `/manufacturing/work-orders`, `[id]` | DONE | Release, complete, consume, scrap, reverse |
| Bill of Materials (BOM) | `/manufacturing/bom`, `/manufacturing/boms` | DONE | Items CRUD |
| Routing | `/manufacturing/routing` | DONE | Steps |
| Resources | `/manufacturing/resources` | DONE | |
| WIP | `/manufacturing/wip` | DONE | Overview, reporting |
| Variance | `/manufacturing/variance` | DONE | Report |
| Schedules | `/manufacturing/schedules` | DONE | |
| MRP | `/manufacturing/mrp` | DONE | Run, firm |
| Cost Rollup | API | DONE | |

**Completion: 80%**
**Missing:**
- Advanced Planning & Scheduling (APS) UI (stubs referenced but no full UI)
- Capacity Calendar visual editor (model exists, no calendar UI)
- Shop floor execution / operator interface
- Quality checkpoints within routing steps
- Engineering Change Orders (ECO)
- Version-controlled BOMs
- Co-product / by-product handling
- Subcontracting / outside processing
- Production batch tracking / genealogy

---

### 4.2 Supply Chain

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Supply Dashboard | `/supply/dashboard` | DONE | Inbound, outbound, performance, stockout risks |
| Pick/Pack/Ship | `/supply/pick-pack-ship` | DONE | Waves, tasks, assign, complete |
| Replenishment | `/supply/replenishment` | DONE | Rules, suggestions, apply |
| RMA (Returns) | `/supply/rma`, `/supply/rma/[id]` | DONE | Create, process, update |
| Supplier Scorecards | `/supply/scorecards`, `[supplierId]` | DONE | |

**Completion: 80%**
**Missing:**
- Freight / shipping rate management
- Carrier integration (label printing, tracking)
- Advanced wave planning rules
- Cross-docking support
- Drop-ship management
- Demand planning integration
- Supply chain analytics / visibility dashboard (beyond current KPIs)
- EDI integration (models exist: EdiMessage, but no UI)
- ASN (Advanced Shipping Notice) UI (model + API stubs exist, no UI)

---

### 4.3 POS (Point of Sale)

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| POS Register | `/pos` or `/pos/register` | DONE | Cashier view |
| Products | `/pos/products` | DONE | |
| Sessions | `/pos/sessions` | DONE | Open/close |
| Receipts | `/pos/receipts` | DONE | Printable HTML |
| Shifts | API | DONE | Open/close, X/Z reports |
| Refunds | API | DONE | Create, finalize |
| EOD Report | API | DONE | |
| Sales CRUD | API | DONE | Create, update, finalize, void |

**Completion: 75%**
**Missing:**
- Card-present payment (Stripe Terminal stubbed, not live)
- Receipt PDF generation (HTML only currently)
- Barcode scanner support
- Product search / quick-add
- Discount / promotion engine
- Customer loyalty integration
- Offline mode / resilience
- Multi-register / multi-store management
- Cash drawer management
- Till reconciliation automation
- Kitchen / order display (for food service)

---

### 4.4 Projects & Time

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Projects Dashboard | `/projects` | DONE | |
| Boards / Kanban | `/projects/board`, `/projects/boards` | DONE | |
| Tasks | `/projects/tasks` | DONE | |
| Time Entry | `/projects/time` | DONE | |
| Timesheets | `/projects/timesheets` | DONE | Submit, approve, rollup |
| Project Billing | `/projects/billing` | DONE | Export |

**Completion: 75%**
**Missing:**
- Gantt chart view
- Resource allocation / utilization view
- Project templates
- Budget tracking per project (linked to planning)
- Milestone tracking
- Risk / issue register
- Project profitability dashboard
- Client-facing project portal
- Time entry approval workflows (basic approval exists)
- Expense tracking per project
- Revenue recognition automation

---

### 4.5 HR & Payroll

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| HR Dashboard | `/hr` | DONE | |
| Employees | `/hr/employees` | DONE | CRUD |
| Leave Management | `/hr/leave` | DONE | Types, requests, balances, entitlements, approve/reject |
| Payroll | `/hr/payroll` | DONE | Config, run, history |
| Payslips | API | DONE | Per-employee, per-run |
| Recruitment | `/hr/recruitment` | DONE | |

**Completion: 70%**
**Missing:**
- Employee self-service portal (profile, payslips, leave requests)
- Organization chart
- Performance management / appraisals
- Training / development tracking
- Benefits administration
- Onboarding / offboarding workflows
- Document management per employee (contracts, ID)
- Absence calendar view
- Statutory sick pay automation (UK)
- P45/P60 generation
- Pension auto-enrolment
- RTI (Real Time Information) HMRC submission
- Employee cost center allocation
- Shift scheduling (separate from healthcare rota)
- BACS file export UI (API exists, no UI)

---

### 4.6 Planning & Budgeting

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Budgets | `/planning/budgets` | DONE | CRUD, file-backed |
| Forecasts | `/planning/forecasts` | DONE | |
| Reports (Budget vs Actual) | `/planning/reports` | DONE | Variance from P&L actuals |

**Completion: 65%**
**Missing:**
- Multi-scenario planning (model: PlanningScenario exists, no UI)
- Rolling forecast support
- Top-down / bottom-up budgeting
- Budget approval workflow
- Department / cost center level budgets
- Capital expenditure planning
- Headcount planning
- What-if analysis tools
- AI-driven forecast suggestions (AI candidate)

---

## 5. Tier 3 — Extended / Vertical Modules

### 5.1 Healthcare

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Rota / Scheduling | `/healthcare/rota` | DONE | File-backed shifts |
| Cost of Care | `/healthcare/cost-of-care` | DONE | Derived from finance + inventory |
| Patients | `/healthcare/patients` | DONE | |

**Completion: 50%**
**Missing:**
- Patient records / clinical data management
- Appointment scheduling
- Care pathway management
- Compliance / CQC reporting
- Medicine management / drug formulary
- Bed management
- Referral tracking
- Insurance / funding management
- Clinical outcomes tracking
- Staff certification / competency tracking

---

### 5.2 Chat & Communication

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Chat | `/chat` | DONE | Channels, messages, search, workspaces |
| Calls | `/chat/calls` | DONE | |
| Signal API | API | DONE | Real-time |

**Completion: 70%**
**Missing:**
- Video/audio call integration (beyond signaling)
- File sharing in chat (attachments API exists but not connected)
- Thread support
- @mentions / notifications
- Chat bots / AI assistant in chat (AI candidate)
- External messaging (client communication via chat)

---

### 5.3 Enterprise (Intercompany / Consolidation / Treasury)

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Intercompany Transactions | API stubs | PARTIAL | Model: IntercompanyTxn, API referenced but UI not built |
| Consolidation Mapping | API stubs | PARTIAL | Model: ConsolidationMap |
| Treasury Movements | API stubs | PARTIAL | Model: TreasuryMovement |
| KPI Snapshots | Model exists | PARTIAL | KpiSnapshot model |

**Completion: 30%**
**Missing:**
- Full intercompany journal UI and reconciliation
- Consolidation reporting (group-level financials)
- Treasury dashboard
- Cash position management
- Inter-entity transfer pricing
- Elimination entries automation
- Multi-entity reporting

---

## 6. Tier 4 — Platform & Intelligence Modules

### 6.1 AI Engine

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| AI Bar (Shell) | Every authenticated page | DONE | Context-aware prompts |
| AI Query Endpoint | `/api/ai/query` | DONE | Intent resolution, 501 for unsupported |
| AI Ask | `/api/ai/ask` | DONE | |
| AI Execute | `/api/ai/execute` | DONE | |
| AI Agent | `/api/ai/agent` | DONE | |
| AI Workbench | `/ai/workbench` | DONE | |
| AI Automations | `/ai/automation`, `/ai/automations` | DONE | |
| AI Logs | `/ai/logs` | DONE | |
| AI Assistant | `/ai/assistant` | DONE | |
| Module Insight | `/api/ai/module-insight` | DONE | |
| Finance Invoice Insight | `/api/ai/finance/invoices-insight` | DONE | |

**Completion: 60%** (read-only phase complete; write/action phase not started)
**Missing — see Section 8 for full AI-First analysis**

---

### 6.2 Workflow Engine

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Definitions | `/workflow/definitions` | DONE | |
| Instances | `/workflow/instances` | DONE | |
| My Approvals | `/workflow/my-approvals` | DONE | |
| Approve / Reject | APIs | DONE | |
| Enforcement | Server-side | DONE | PO, RFQ, Quote, RMA |

**Completion: 70%**
**Missing:**
- Visual workflow designer / builder
- Conditional branching (if/else rules)
- Parallel approvals
- Escalation rules (time-based)
- Delegation (out-of-office)
- SLA tracking
- Workflow templates library
- Email notifications on pending approvals
- Mobile approval support
- Custom workflow triggers (beyond current 4 enforcement points)

---

### 6.3 Notifications

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Alerts Page | `/alerts` | DONE | |
| Notification Templates | DB model | DONE | |
| Notification Jobs | DB model | DONE | |
| Events Stream (SSE) | `/api/events/stream` | DONE | |

**Completion: 55%**
**Missing:**
- In-app notification center / bell icon with unread count
- Push notifications (browser / mobile)
- Email notification delivery (Twilio integration referenced but not complete)
- SMS notifications
- Notification preferences per user
- Digest / summary notifications
- Webhook notifications to external systems

---

### 6.4 Integrations

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| Accounting (QB, Sage, Xero) | Stubs | PARTIAL | Feature-flagged, no real sync |
| CRM (Generic + HubSpot) | Stubs + models | PARTIAL | HubSpot models in Prisma |
| Logistics (3PL) | Stubs | PARTIAL | Feature-flagged |
| HMRC MTD | Sandbox only | PARTIAL | OAuth + returns |
| Open Banking (TrueLayer) | Sandbox only | PARTIAL | OAuth + accounts |
| Stripe Billing | DONE | DONE | Full webhook, checkout, portal |

**Completion: 40%**
**Missing:**
- Live accounting sync (any provider)
- Live CRM sync (HubSpot models exist but sync is stubbed)
- Any live 3PL/logistics connector
- Payment gateway beyond Stripe (PayPal, GoCardless, etc.)
- E-commerce platform connectors (Shopify, WooCommerce)
- Marketplace connectors (Amazon, eBay — EDI models exist but no UI)
- Banking API live connection
- Zapier / Make / n8n webhook bridge
- API key management for tenant-level integrations

---

### 6.5 Document Management (DMS)

| Screen / Part | Route | Status | Notes |
|---|---|---|---|
| DMS Dashboard | `/dms` | DONE | |
| Documents CRUD | API | DONE | |
| Attachments | API | DONE | Upload, download |

**Completion: 50%**
**Missing:**
- Document versioning
- Document templates (invoice templates, PO templates, etc.)
- PDF generation for business documents
- Document approval workflows
- OCR / document scanning (AI candidate)
- Document tagging / categorization
- Full-text search within documents
- Document sharing / external links

---

## 7. Cross-Module Gaps Summary

### Critical Gaps (Must Have)

| # | Gap | Impact | Modules Affected |
|---|---|---|---|
| 1 | **Chart of Accounts management UI** | Cannot configure GL structure | Finance |
| 2 | **Number sequence configuration** | No control over invoice/PO/SO numbering | All transactional |
| 3 | **Company profile / branding** | Cannot set up company identity | All (headers, documents) |
| 4 | **PDF document generation** | Cannot produce professional invoices, POs, quotes, receipts | Finance, Sales, Purchasing, POS |
| 5 | **Email delivery system** | No transactional emails (invoices, notifications, password resets rely on dev endpoint) | All |
| 6 | **Notification center** | Users have no way to see pending actions | Workflow, Alerts, all |
| 7 | **MFA / 2FA** | Security gap for production use | Auth |
| 8 | **Payment gateway live mode** | POS card payments not functional, only stubbed | POS |
| 9 | **Three-way matching screen** | Core procurement control missing UI | Purchasing, Finance AP |
| 10 | **Customer 360 view** | No unified view across Sales, CRM, Finance, Support | CRM, Sales, Finance |

### Important Gaps (Should Have)

| # | Gap | Impact | Modules Affected |
|---|---|---|---|
| 11 | Recurring journals / templates | Manual re-entry for monthly journals | Finance |
| 12 | Visual workflow designer | Cannot build custom workflows without code | Workflow |
| 13 | Barcode/QR scanning | Manual data entry in warehouse | Inventory, WMS, POS |
| 14 | Dashboard KPI widgets (configurable) | Static dashboards | All |
| 15 | Reporting engine (custom reports) | Only pre-built reports available | All |
| 16 | Employee self-service | HR admin bottleneck | HR |
| 17 | Gantt chart for projects | No visual timeline | Projects |
| 18 | Purchase requisitions | No internal request flow | Purchasing |
| 19 | Sales pipeline kanban | CRM missing core visualization | CRM |
| 20 | Serial number tracking | Lots only, no serial-level | Inventory |

---

## 8. AI-First Requirements

### 8.1 Current AI State

The AI Engine is in **Phase 1: Read-Only**. It can query data across all modules via intent resolution but cannot take actions or make changes. Current capabilities:

- AI bar on every page with context-aware prompts
- 13 read-only intents covering all major modules
- Truthfulness enforcement (501 for unsupported/insufficient data)
- RBAC-scoped queries
- Rate limiting per tenant

### 8.2 What "AI-First" Means for Nexa ERP

An AI-First ERP doesn't just bolt AI onto existing screens — it fundamentally changes how users interact with the system. Every module should have AI as a primary interaction mode, not an afterthought.

### 8.3 AI Capabilities Needed — By Module

#### Foundation: AI Core Platform (Priority: P0)

| Capability | Description | Status |
|---|---|---|
| **AI Action Engine** | Move beyond read-only to AI-initiated writes (create invoice, approve PO, adjust stock) | NOT STARTED |
| **Conversational ERP** | Natural language to perform any action: "Create a PO for 500 units of SKU-123 from our best supplier" | NOT STARTED |
| **AI Agent Framework** | Multi-step autonomous workflows (e.g., "Process month-end close") | PARTIAL (agent endpoint exists) |
| **Context Memory** | Remember user preferences, recent actions, common patterns | NOT STARTED |
| **Explainability** | AI explains WHY it suggests something, citing data | NOT STARTED |
| **AI Safety / Guardrails** | Confirmation for destructive/financial actions, audit trail for AI actions | NOT STARTED |

#### Finance AI (Priority: P0)

| Capability | Description |
|---|---|
| **Smart Bank Reconciliation** | AI matches bank transactions to invoices/bills automatically |
| **Anomaly Detection** | Flag unusual journal entries, duplicate payments, suspicious transactions |
| **Cash Flow Prediction** | Forecast cash position based on AR/AP aging, recurring patterns |
| **Auto-categorization** | Classify expenses, bank transactions into correct GL accounts |
| **Month-End Assistant** | Guide users through close process, identify missing steps, suggest accruals |
| **Financial Insights** | Natural language financial analysis ("How did Q4 compare to Q3?") |

#### Inventory & WMS AI (Priority: P0)

| Capability | Description |
|---|---|
| **Demand Forecasting** | Predict stock needs based on sales history, seasonality, trends |
| **Smart Reorder** | AI-calculated reorder points, auto-generate POs when stock is low |
| **Anomaly Detection** | Flag unexpected stock movements, shrinkage patterns |
| **Warehouse Optimization** | Suggest optimal bin locations based on pick frequency |
| **Expiry / Lot Management** | Alert on approaching expiry, suggest FIFO allocation |

#### Sales & CRM AI (Priority: P1)

| Capability | Description |
|---|---|
| **Lead Scoring** | AI ranks leads by conversion probability |
| **Next Best Action** | Suggest what to do next with each opportunity |
| **Win/Loss Analysis** | Pattern recognition on why deals close or don't |
| **Smart Pricing** | Suggest optimal pricing based on customer history, margins |
| **Email Drafting** | Generate follow-up emails, proposals from context |
| **Duplicate Detection** | Find and merge duplicate leads/contacts/accounts |
| **Churn Prediction** | Flag customers likely to leave based on activity patterns |

#### Manufacturing AI (Priority: P1)

| Capability | Description |
|---|---|
| **Production Scheduling** | AI-optimized sequencing based on constraints, due dates |
| **Predictive Maintenance** | Flag equipment likely to need attention (requires IoT data) |
| **Quality Prediction** | Identify batches likely to fail QC based on process parameters |
| **BOM Optimization** | Suggest material substitutions for cost/availability |
| **Yield Prediction** | Forecast expected output vs waste |

#### Supply Chain AI (Priority: P1)

| Capability | Description |
|---|---|
| **Supply Risk Assessment** | Flag at-risk suppliers based on lead times, quality scores |
| **Optimal Order Quantity** | Calculate EOQ with AI-adjusted parameters |
| **Delivery ETA Prediction** | Predict actual delivery dates vs promised |
| **Spend Analysis** | Categorize and analyze procurement spend for savings opportunities |

#### HR & Payroll AI (Priority: P2)

| Capability | Description |
|---|---|
| **Absence Pattern Detection** | Flag unusual absence patterns |
| **Smart Scheduling** | Optimize shift coverage based on demand and preferences |
| **Recruitment Screening** | Initial CV/resume analysis and ranking |
| **Payroll Anomaly Detection** | Flag unusual payroll entries before processing |

#### Projects AI (Priority: P2)

| Capability | Description |
|---|---|
| **Effort Estimation** | Predict task duration based on historical data |
| **Risk Prediction** | Flag projects likely to overrun |
| **Resource Recommendation** | Suggest team composition based on skills and availability |
| **Auto-categorization** | Classify time entries to correct projects/tasks |

#### Cross-Module AI (Priority: P0)

| Capability | Description |
|---|---|
| **Universal Search** | Natural language search across all modules ("Find all overdue invoices from Acme Corp") |
| **Smart Dashboards** | AI-generated KPI summaries, anomaly highlights, suggested actions |
| **Report Generation** | Natural language to report ("Show me top 10 customers by revenue this quarter") |
| **Workflow Suggestions** | AI recommends workflow automations based on repeated manual patterns |
| **Data Quality** | Flag incomplete records, suggest corrections, detect inconsistencies |
| **Audit Intelligence** | AI reviews audit trail for compliance issues, SOD violations |
| **Predictive Alerts** | Proactive notifications ("Inventory for SKU-456 will run out in 3 days based on current sales rate") |

### 8.4 AI-First UX Patterns to Implement

| Pattern | Description |
|---|---|
| **Command Palette** | Keyboard-first (Cmd+K) access to any action via natural language |
| **Inline AI Suggestions** | While filling forms, AI suggests values based on context |
| **AI Copilot Sidebar** | Persistent assistant that understands current screen context |
| **AI-Generated Summaries** | Every list/register page shows AI summary at top |
| **Smart Defaults** | Forms pre-filled with AI-predicted values |
| **Natural Language Filters** | Type "overdue invoices over 10k" instead of building filter UI |
| **Voice Input** | Speech-to-action for warehouse/shop floor use |
| **AI Onboarding** | Guided setup wizard driven by AI conversation |

### 8.5 AI-First Priority Roadmap

```
PHASE 2 (Next) — AI Action Engine
  - AI can create, update, approve across all modules
  - Confirmation flow for financial/destructive actions
  - Audit trail for all AI-initiated actions
  - Command palette (Cmd+K)

PHASE 3 — Intelligence Layer
  - Anomaly detection (Finance, Inventory, HR)
  - Demand forecasting (Inventory, Manufacturing)
  - Cash flow prediction (Finance)
  - Lead scoring (CRM)
  - Smart dashboards with AI summaries

PHASE 4 — Autonomous Agents
  - Multi-step workflows (month-end close assistant)
  - Auto-reconciliation
  - Smart reorder / auto-PO generation
  - Predictive alerts engine

PHASE 5 — AI-Native UX
  - Inline suggestions on all forms
  - Natural language filters / search
  - AI copilot sidebar
  - Voice input for warehouse/POS
  - AI-generated custom reports
```

---

## Appendix A — Module Completion Summary

| Module | Tier | Completion | Key Blocker |
|---|---|---|---|
| Auth & RBAC | 0 | 95% | MFA, SSO |
| Tenancy & Admin | 0 | 90% | Custom roles |
| Super Admin | 0 | 85% | Real-time monitoring |
| Settings | 0 | 85% | Company profile, number sequences |
| SaaS Billing | 0 | 90% | Usage metering |
| Custom Fields | 0 | 85% | Validation rules |
| Finance | 1 | 80% | COA UI, PDF generation, recurring journals |
| Inventory & WMS | 1 | 85% | Bin management, barcode, serial tracking |
| Sales & CRM | 1 | 80% | Pipeline kanban, email integration |
| Purchasing | 1 | 80% | Requisitions, three-way matching UI |
| Manufacturing | 2 | 80% | APS UI, capacity calendar, ECO |
| Supply Chain | 2 | 80% | Carrier integration, ASN UI |
| POS | 2 | 75% | Live card payments, offline mode |
| Projects & Time | 2 | 75% | Gantt, resource utilization |
| HR & Payroll | 2 | 70% | Self-service, statutory reporting |
| Planning | 2 | 65% | Scenario planning, approval workflow |
| Healthcare | 3 | 50% | Clinical data, appointments, compliance |
| Chat | 3 | 70% | Video/audio, file sharing |
| Enterprise | 3 | 30% | Full intercompany, consolidation |
| AI Engine | 4 | 60% | Action engine, agents, predictions |
| Workflow | 4 | 70% | Visual designer, escalation |
| Notifications | 4 | 55% | Email delivery, push, preferences |
| Integrations | 4 | 40% | Any live external sync |
| DMS | 4 | 50% | Versioning, templates, OCR |

---

*End of Module Status Summary*

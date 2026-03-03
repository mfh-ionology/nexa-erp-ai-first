# 4. FR-to-Endpoint Mapping

Every FR from the PRD must map to at least one API endpoint. This table provides the comprehensive mapping using the PRD's authoritative FR definitions.

| FR | Description | Primary Endpoints |
|----|-------------|-------------------|
| FR1 | NL commands to create/query/manage records | `WS /ai/chat`, `POST /ai/chat/message` |
| FR2 | AI pre-fill fields using context | `POST /ai/suggestions` |
| FR3 | Personalised daily briefing | `GET /ai/briefing` |
| FR4 | NL business questions with answers | `WS /ai/chat`, `POST /ai/chat/message` |
| FR5 | Recommend actions with one-tap approval | `POST /ai/suggestions` |
| FR6 | Approve/modify/reject AI-generated records | `CRUD /approval-rules`, `GET /approval-requests`, `PATCH /approval-requests/:id` |
| FR7 | Maintain conversational context | `POST /ai/chat/sessions`, `GET /ai/chat/history` |
| FR8 | Fall back to traditional form-based interfaces | All CRUD endpoints; `CRUD /views` (saved views) |
| FR9 | Log all AI actions for audit/learning | Handled via `GET /system/audit-log` (AI actions logged automatically) |
| FR10 | Confidence scoring for AI records | `GET /ai/confidence/:entityType/:entityId`, `POST /ai/explain` |
| FR11 | Chart of accounts (UK GAAP FRS 102) | `CRUD /finance/chart-of-accounts`, `GET .../tree`, account classifications, account mappings |
| FR12 | Create/edit/post journal entries (double-entry) | `CRUD /finance/journal-entries`, `POST .../post`, `POST .../reverse`, `GET .../lines` |
| FR13 | Trial balance, P&L, balance sheet reports | `GET /finance/reports/trial-balance`, balance-sheet, P&L, GL listing, budget-vs-actual; `CRUD /finance/budgets` |
| FR14 | Open and close financial periods | `CRUD /finance/financial-periods`, `POST .../lock`, `POST .../unlock`, `POST .../generate` |
| FR15 | Multiple currencies with exchange rates | `CRUD /system/currencies`, `CRUD /system/exchange-rates`, `GET .../latest` |
| FR16 | Bank reconciliation | `CRUD /finance/bank-accounts`, bank reconciliation endpoints, `POST .../match`, `POST .../unmatch` |
| FR17 | Import bank statements (OFX/CSV/MT940) | `POST /finance/bank-accounts/:id/import` |
| FR18 | Auto-match bank transactions to invoices/bills | `POST /finance/bank-reconciliations/:id/auto-match` |
| FR19 | Customer records (contacts, addresses, terms) | `CRUD /ar/customers`, customer contacts, `GET .../credit-check` |
| FR20 | Sales invoices (draft->approved->posted) | `CRUD /ar/invoices`, `POST .../approve`, `POST .../post`, `POST .../void` |
| FR21 | Customer payments and allocation | `CRUD /ar/payments`, `POST .../post`, `POST .../allocate`, `POST .../void` |
| FR22 | Generate and send customer statements | `GET /ar/customers/:id/statement`, `POST /ar/invoices/:id/email`, `POST /ar/reports/statements/batch` |
| FR23 | Credit notes linked to invoices | `POST /ar/invoices/:id/credit` |
| FR24 | AR aging analysis by customer | `GET /ar/reports/aging`, overdue, cash-receipts; `GET /ar/customers/:id/balance`, transaction-history |
| FR25 | Multiple billing/shipping addresses | `GET/POST/PATCH /ar/customers/:id/addresses` |
| FR26 | Supplier records (contacts, terms, bank) | `CRUD /ap/suppliers`, `GET .../purchase-history` |
| FR27 | Supplier bills (draft->approved->posted) | `CRUD /ap/supplier-bills`, `POST .../approve`, `POST .../post`, `POST .../void` |
| FR28 | Supplier payments and allocation | `CRUD /ap/supplier-payments`, `POST .../approve`, `POST .../post`, `POST .../allocate`, `POST .../void` |
| FR29 | BACS payment files for bulk payments | `CRUD /ap/bacs-runs`, `POST .../approve`, `POST .../generate-file`, `POST .../submit`, `POST .../complete` |
| FR30 | AP aging analysis by supplier | `GET /ap/reports/aging`, overdue, purchase-journal, payment-forecast; `GET /ap/suppliers/:id/balance` |
| FR31 | 3-way matching (PO/GRN/bill) | `GET /ap/supplier-bills/:id/matching` |
| FR32 | Ingest supplier bills via email/OCR | `POST /ap/supplier-bills/import-ocr` |
| FR33 | Sales quotes with pricing and VAT | `CRUD /sales/quotes`, `POST .../send`, `POST .../accept`, `POST .../reject`, `POST .../revise` |
| FR34 | Convert quotes to sales orders | `POST /sales/quotes/:id/convert-to-order` |
| FR35 | Sales orders full lifecycle | `CRUD /sales/orders`, `POST .../approve`, `POST .../close`, `POST .../cancel`; order-book/backorder reports |
| FR36 | Create shipments/delivery notes | `POST /sales/orders/:id/create-dispatch`, `CRUD /sales/dispatches`, `POST .../ship`, shipping-methods |
| FR37 | Convert orders to invoices | `POST /sales/orders/:id/create-invoice`, `POST /sales/quotes/:id/convert-to-invoice` |
| FR38 | Stock availability check during order | `GET /sales/orders/:id/stock-check`, `POST .../reserve-stock`, `POST .../create-backorder` |
| FR39 | Customer-specific pricing/discounts | `CRUD /pricing/price-lists`, price entries, quantity breaks, `POST /pricing/resolve`, rebates |
| FR40 | Sales pipeline with weighted values | `GET /sales/reports/sales-analysis` |
| FR41 | Create purchase orders with line items | `CRUD /ap/purchase-orders`, `GET .../lines` |
| FR42 | PO approval workflows | `POST /ap/purchase-orders/:id/approve` |
| FR43 | Goods receipt against purchase orders | `CRUD /ap/goods-receipts`, `POST .../post`, `POST .../cancel` |
| FR44 | Suggest reorder POs based on stock levels | `POST /purchasing/reorder-check`, `POST /purchasing/auto-generate-pos` |
| FR45 | Track PO status through lifecycle | `POST /ap/purchase-orders/:id/send`, `POST .../close`, `POST .../cancel` |
| FR46 | Item records (name, UoM, barcode, prices) | `CRUD /inventory/items`, `POST .../batch`, barcode-scan/lookup, `CRUD /inventory/units-of-measure` |
| FR47 | Item groups with GL account mappings | `CRUD /inventory/item-groups` |
| FR48 | Stock movements with audit trail | `CRUD /inventory/stock-movements`, `POST .../post`, `POST .../reverse`, `POST .../batch` |
| FR49 | Multiple warehouse locations | `CRUD /inventory/warehouses` |
| FR50 | Stock takes with variance reporting | `POST /inventory/stock-take`, `PATCH .../id`, `POST .../post` |
| FR51 | Serial/batch number tracking | `CRUD /inventory/serial-numbers` |
| FR52 | Real-time stock levels across locations | `GET /inventory/stock-balances`, `GET /inventory/items/:id/stock`, `GET .../availability` |
| FR53 | Alert when items below reorder point | `GET /inventory/reports/reorder-report` |
| FR54 | Contacts and accounts with activity history | `CRUD /crm/industries` (reference); contact/account via `/ar/customers` |
| FR55 | Log activities (calls, meetings, notes) | `CRUD /activities`, `CRUD /notes`, `GET /crm/leads/:id/activities`, salesperson-activity report |
| FR56 | Lead management with conversion | `CRUD /crm/leads`, `POST .../convert`, lead statuses, lead sources; lead-list/conversion reports |
| FR57 | Pipeline reporting with stages/values | `GET /crm/reports/pipeline-forecast` |
| FR58 | Link CRM records to sales transactions | `GET/POST/DELETE /record-links` |
| FR59 | Employee records (NI, tax code, etc.) | `CRUD /hr/employees`, `CRUD /hr/job-titles`, `CRUD /hr/residency-types` |
| FR60 | Employee onboarding with checklist | `CRUD /hr/checklists` (see also FR108 for expanded checklist features) |
| FR61 | Leave requests with entitlement tracking | `CRUD /hr/leave-entitlements`, `CRUD /hr/leave-requests`, approve/reject/cancel, calendar |
| FR62 | Monthly payroll (PAYE, NI, pension) | `CRUD /hr/payroll-runs`, `POST .../calculate`, `POST .../approve`, `POST .../post`; `CRUD /hr/tax-year-configs`, payment-types |
| FR63 | Submit FPS/EPS to HMRC via RTI | `POST /hr/hmrc/fps`, `POST /hr/hmrc/eps`, `GET /hr/hmrc/submissions` |
| FR64 | BACS payment files for payroll | `POST /hr/payroll-runs/:id/generate-bacs` |
| FR65 | Auto-enrolment pension eligibility | `CRUD /hr/pension-enrolments`, `POST /hr/pension/assess`; `GET /hr/employees/:id/pension` |
| FR66 | Generate payslips, P45s, P60s | `GET /hr/employees/:id/payslips`, `POST /hr/payroll-runs/:id/generate-payslips` |
| FR67 | Statutory payments (SSP, SMP, etc.) | `GET /hr/employees/:id/statutory-payments` |
| FR68 | Bills of Materials (BOM) | `CRUD /production/recipes`, recipe lines, `CRUD /production/production-classes` |
| FR69 | Work orders with material/routing | `CRUD /production/production-orders`, state transitions; `CRUD /production/routings`, standard-operations |
| FR70 | Schedule production by priority | `CRUD /production/production-plans`, `POST .../approve`, `POST .../generate-orders` |
| FR71 | Record material consumption | `CRUD /production/productions`, `POST .../start`; `GET /production/reports/material-usage` |
| FR72 | Finished goods receipt from work orders | `POST /production/production-orders/:id/finish`, `POST /production/productions/:id/finish` |
| FR73 | Check material availability before WO confirm | `GET /production/production-plans/:id/components` |
| FR74 | Standard financial reports (P&L, BS, CF) | `GET /reports/definitions`, `POST /reports/generate`, job status/download; dashboards, schedule, KPIs |
| FR75 | Operational reports (AR/AP aging, stock val) | Module-specific report endpoints: `/ar/reports/*`, `/ap/reports/*`, `/inventory/reports/*`, `/purchasing/reports/*`, etc. |
| FR76 | HR reports (payslips, employee list) | `GET /hr/reports/headcount`, payroll-summary, leave-summary, starters-leavers |
| FR77 | VAT returns for HMRC MTD submission | See FR91 (VAT return generation and submission) |
| FR78 | Export reports in PDF and CSV | `POST /reports/export`; document template endpoints (`CRUD /document-templates`, `POST /documents/generate`, batch-generate) |
| FR79 | Ad-hoc NL reporting questions | `POST /reports/custom-query`; also `WS /ai/chat` for NL queries |
| FR80 | Create/edit/deactivate user accounts | Auth endpoints (login, logout, password management, MFA); `CRUD /system/users` |
| FR81 | Assign roles with module-level access | `PATCH /system/users/:id/role` |
| FR82 | Enable/disable modules per tenant | `PATCH /system/users/:id/modules` |
| FR83 | Configure per-module settings | `GET/POST/PATCH /system/company-profile`, `CRUD /system/system-settings`, country/department/payment-terms/tag/bank-holiday reference data; `CRUD /crm/module-settings` |
| FR84 | Manage integration connections | `POST /finance/bank-accounts/:id/feed/sync`, `GET /compliance/mtd/status`, `POST /compliance/mtd/authorize` |
| FR85 | View audit logs of all system actions | `GET /system/audit-log`, `GET /system/audit-log/:entityType/:entityId` |
| FR86 | Configure number series per document type | `CRUD /system/number-series` |
| FR87 | Import data from CSV files | `POST /inventory/items/import`, `POST /hr/employees/import`, `POST /crm/leads/import`, `POST /purchasing/import` |
| FR88 | Backup and restore operations | `POST /system/backups`, `GET /system/backups`, `POST /system/backups/:id/restore` |
| FR89 | VAT calculation at multiple rates | `CRUD /system/vat-codes`; VAT calculated automatically on invoice/bill/quote post |
| FR90 | Configure VAT schemes | `CRUD /system/vat-codes`, VAT scheme config via system settings |
| FR91 | Generate and submit VAT returns via MTD | `POST /compliance/vat/returns/calculate`, `GET .../returns`, `POST .../approve`, `POST .../submit`, `GET .../status`, `GET .../obligations` |
| FR92 | Maintain immutable audit trails | `GET /compliance/reports/vat-audit-trail`; `GET /system/audit-log` (all financial transactions logged) |
| FR93 | GDPR compliance (data export/deletion) | Endpoint TBD (GDPR operations not yet exposed as API endpoints) |
| FR94 | Enforce period locks | `POST /finance/financial-periods/:id/lock` (prevents posting to closed periods) |
| FR95 | Marketing campaigns | `CRUD /crm/campaigns`, activate/complete/cancel, metrics, recipients; `CRUD /crm/media-types`; campaign-performance report |
| FR96 | Sales opportunities with pipeline | `CRUD /crm/opportunities`, win/lose/create-quote, stage-history; `CRUD /crm/opportunity-classes` |
| FR97 | Pipeline Kanban board stages | `CRUD /crm/pipeline-views`, `GET .../data`, `POST /crm/pipeline/drag` |
| FR98 | Activity auto-creation rules | `CRUD /crm/activity-auto-rules` |
| FR99 | Lead ratings and lifecycle | `PATCH /crm/leads/:id/qualify` |
| FR100 | Configure CRM activity types | `CRUD /crm/activity-types` |
| FR101 | Employment contracts with change history | `CRUD /hr/contracts`, `POST .../approve`, `POST .../terminate`; `CRUD /hr/contract-types`, contract-classes |
| FR102 | Track contract changes with audit trail | `POST /hr/contracts/:id/changes`, `GET /hr/contracts/:id/changes` |
| FR103 | Performance appraisals | `CRUD /hr/appraisals`, `POST .../approve`; performance-factors, performance-ratings, appraisal-categories |
| FR104 | Employee skills and competencies | `CRUD /hr/skills-evaluations`, `CRUD /hr/skills`, `CRUD /hr/skill-ratings` |
| FR105 | Training plans with scheduling | `CRUD /hr/training-plans` |
| FR106 | Job positions and org structure | `CRUD /hr/job-positions` |
| FR107 | Employee benefits on contracts | `GET/POST /hr/contracts/:id/benefits`, `CRUD /hr/benefit-types` |
| FR108 | Onboarding/offboarding checklists | `CRUD /hr/checklists`, `PATCH .../items/:itemId`; `CRUD /hr/checkpoints` |
| FR109 | BOM explosion across document types | `POST /production/recipes/:id/explode` |
| FR110 | Production shift schedules | `GET/POST /production/machines/:id/shifts` |
| FR111 | Time worked per production operation | `CRUD /production/production-operations`, `POST .../start`, `POST .../finish` |
| FR112 | Post operation costs to GL/WIP | `GET /production/reports/wip`, production-cost |
| FR113 | MRP calculations | `POST /production/mrp/run`, `GET /production/mrp/suggestions` |
| FR114 | Machine/work centre capacity | `CRUD /production/machines`, `CRUD /production/machine-groups`; machine-utilisation/capacity reports |
| FR115 | Quality inspections at operation level | Endpoint TBD (quality inspection endpoints not yet defined) |
| FR116 | POS sessions (open/close, Z-report) | `CRUD /pos/terminals`, `POST /pos/sessions/open`, `POST .../close`; x-report, z-report |
| FR117 | POS product lookup by name/code/barcode | `POST /pos/sales/:id/add-item` (triggers item lookup) |
| FR118 | Multiple payment methods per transaction | `CRUD /pos/payment-methods`; `POST /pos/sales`, payment, complete, void, suspend, resume, return |
| FR119 | Print/email receipts from POS | `POST /pos/sales/:id/receipt` |
| FR120 | POS pricing rules and promotions | `CRUD /pos/button-layouts` (POS-specific config); pricing resolved via `/pricing/resolve` |
| FR121 | Offline mode and auto-sync | `POST /pos/sync` |
| FR122 | Cash drawer and till reconciliation | `CRUD /pos/cash-drawers`, `POST /pos/cash-movements`, cashup endpoints (create, update, complete, post) |
| FR123 | Projects with budgets and milestones | `CRUD /projects/projects`, state transitions, tasks, budgets; project-list report |
| FR124 | Time entries against projects | `CRUD /projects/timesheets`, submit/approve/reject, entries; time-analysis report |
| FR125 | Expenses against projects | `CRUD /projects/expenses`, `POST .../submit`, `POST .../approve` |
| FR126 | Budget vs actual reports by phase | `GET /projects/projects/:id/transactions` |
| FR127 | Billing rate priority hierarchy | `CRUD /projects/projects/:id/rate-cards`, `POST .../create-invoice` |
| FR128 | Post job costs to GL per project | `GET /projects/projects/:id/profitability`, `GET /projects/reports/profitability` |
| FR129 | WIP values and revenue recognition | `GET /projects/reports/utilisation` |
| FR130 | Contracts (rental/lease/service) | `CRUD /contracts/agreements`, activate/close, off-hires; `CRUD /contracts/contracts`, activate; contract-classes |
| FR131 | Auto recurring invoices from contracts | `POST .../generate-charges`, `POST .../generate-invoice`; `POST /contracts/contracts/batch-invoice` |
| FR132 | Contract renewal/termination workflows | `POST /contracts/contracts/:id/renew`, `POST .../cancel`; `POST /contracts/contracts/batch-renew` |
| FR133 | Loan agreements with repayment schedules | `CRUD /contracts/loans`, schedule, approve, sign, activate, disburse; `CRUD /contracts/loan-types` |
| FR134 | Contract-based pricing and payment terms | Handled via contract line items and pricing configuration |
| FR135 | Warehouse positions and bin locations | `CRUD /warehouse/wms-configs`, zones, groups, `CRUD /warehouse/bin-positions`, position-stock |
| FR136 | Pick lists from sales orders | `CRUD /warehouse/picking-lists`, start, complete, record pick |
| FR137 | Receive goods into specific positions | Goods receipt to positions via `/ap/goods-receipts` with bin assignment |
| FR138 | Internal transfer orders | `CRUD /warehouse/forklifts`, `CRUD /warehouse/forklift-tasks`, assign, complete |
| FR139 | Cycle counts by warehouse position | `GET /warehouse/reports/position-stock-report` |
| FR140 | Packing and dispatch operations | `GET /warehouse/reports/picking-performance` |
| FR141 | Intercompany transactions | `CRUD /intercompany/rules`, intercompany transaction endpoints (list, detail, retry, compensate) |
| FR142 | Elimination journal entries | `CRUD /consolidation/elimination-templates`, `POST .../execute` |
| FR143 | Consolidated financial reports | `CRUD /consolidation/groups`, members, account-maps; `POST /consolidation/runs`; consolidated balance-sheet/P&L |
| FR144 | Currency translation for consolidation | `CRUD /consolidation/groups/:id/exchange-rates` |
| FR145 | Internal messages and notifications | Chat channel/message endpoints, `WS /chat/ws`; conference room endpoints; notification list/read/dismiss/preferences |
| FR146 | Email within ERP with entity linking | `CRUD /email/messages`, send, inbox; email templates, aliases, signatures |
| FR147 | Activity feed per entity | `CRUD /activities`; `GET /crm/leads/:id/activities` (entity-level activity timelines) |
| FR148 | Document attachments with version tracking | Attachment endpoints (presign, confirm, download, delete, list) |
| FR149 | Service orders with assignment/tracking | `CRUD /service/orders`, state transitions; work-orders, work-sheets; fault codes |
| FR150 | Service items/equipment with warranty | `CRUD /service/known-serial-numbers`, lookup, warranty-check |
| FR151 | Schedule field service visits | `CRUD /timekeeper/target-times`, clock-in, clock-out, status, attendance/variance reports |
| FR152 | Convert service orders to invoices | `POST /service/orders/:id/invoice`, `POST /service/work-sheets/:id/invoice` |
| FR153 | AI cash flow forecasts (8-52 week) | `POST /ai/predict/cash-flow` |
| FR154 | Barcode scan during goods receipt | Barcode lookup via `/inventory/items/barcode/:code` during GRN processing |
| FR155 | Detect duplicate payment attempts | `POST /ai/detect/duplicates` |
| FR156 | Flag suspicious transactions | `POST /ai/detect/anomalies` |
| FR157 | Fraud risk summary report | `POST /ai/detect/anomalies` (generates fraud risk data); `POST /reports/generate` (report output) |
| FR164 | Upload/photograph/email documents for AI extraction | `POST /documents/ingest`, `POST /documents/ingest/email`, `GET /documents/ingestions` |
| FR165 | Extract structured fields with confidence scoring | `GET /documents/ingestions/:id`, `POST /documents/ingestions/:id/reprocess` |
| FR166 | Auto-match and create draft records | `POST /documents/ingestions/:id/approve` |
| FR167 | Review, correct, approve with learning | `PATCH /documents/ingestions/:id/corrections`, `POST /documents/ingestions/:id/approve`, `GET /documents/supplier-profiles/:supplierId` |
| FR168 | Multi-format document support | `POST /documents/ingest` (validates format) |
| FR169 | Upload company documents to knowledge base | `POST /knowledge/documents`, `GET /knowledge/documents`, `DELETE /knowledge/documents/:id` |
| FR170 | NL questions about policies | `POST /knowledge/query` |

---

# Nexa ERP Extraction Document - Completeness Review Report

**Date:** 2026-02-03
**Reviewer Role:** Senior ERP Product Consultant
**Document Under Review:** `nexa-erp-business-rules-requirements.md` (9,455 lines)
**ERP Context:** UK-focused, AI-first, SME ERP -- 5 core modules + Management Platform

---

## Table of Contents

1. [Part 1: Content Classification Summary](#part-1-content-classification-summary)
2. [Part 2: Missing Features Analysis (Market Research)](#part-2-missing-features-analysis)
3. [Part 3: Competitor Feature Matrix](#part-3-competitor-feature-matrix)
4. [Part 4: Prioritized Addition List (Gap Analysis)](#part-4-prioritized-addition-list)

---

## Part 1: Content Classification Summary

### Classification Definitions

| Classification | Definition |
|---|---|
| **CORE-COMPLETE** | Entity/feature fully documented with schema, business rules, API operations, validations, and edge cases. Ready to build from. |
| **CORE-PARTIAL** | Entity/feature documented but with significant gaps: missing fields, incomplete business rules, missing API operations, or dual implementations that need consolidation. |
| **CORE-SKELETON** | Entity exists in schema only or has stub/mock implementations. Not buildable without substantial additional specification. |
| **INFRASTRUCTURE** | Cross-cutting concern, platform service, or architectural component (not a business feature). |
| **OUT-OF-SCOPE** | Feature mentioned but explicitly excluded, or belonging to a module not in the 5-core scope. |

---

### 1.1 Module: Invoicing & Accounts (Section 1)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **Customer Entity** | CORE-PARTIAL | Schema documented but missing 7 critical fields (VAT number, structured address, credit limit, billing vs shipping address, contact person). Permissions use wrong keys. |
| **Customer Invoice** | CORE-PARTIAL | CRUD operations documented. Missing: PDF generation, email sending, recurring invoices, configurable numbering (uses timestamp), line-level discounts, account codes on lines, address snapshot, FX rate UI exposure. Duplicate create endpoints. |
| **Invoice Lines** | CORE-PARTIAL | Basic fields documented. Missing: account code (exists on CN lines but not invoice lines), unit of measure, discount fields, SKU picker integration. |
| **Customer Payment** | CORE-PARTIAL | 4 duplicate payment endpoints documented. Missing: batch processing, bank feed matching, bank account reference, BACS support, direct debit. |
| **Credit Note** | CORE-PARTIAL | Schema and lifecycle documented. Missing: void/cancel, approval workflow (posts immediately). Inconsistency: CN lines have accountCode but invoice lines do not. |
| **Write-Off** | CORE-PARTIAL | Basic operation documented. Missing: reversal, approval workflow, configurable GL codes (hardcoded). |
| **Allocation** | CORE-PARTIAL | Linking logic documented. Missing: validation that exactly one of paymentId/creditNoteId is set. |
| **AR Aging** | CORE-PARTIAL | Two implementations documented. Missing: configurable buckets, dunning automation, interest calculation. Does not account for partial payments. |
| **Supplier Entity** | CORE-PARTIAL | Schema documented but missing 8 critical fields (address, VAT number, payment terms, bank details, status field, category, contact person, audit trail). |
| **Purchase Order** | CORE-PARTIAL | Schema and lifecycle documented. Missing: line validation before approval, three-way matching, received qty tracking, tax/duty, UoM, delivery address, payment terms. |
| **Supplier Bill** | CORE-PARTIAL | Dual create endpoints documented. Missing: PO reference on bill, partial credit notes. Status is String not Enum. Hardcoded GL codes. |
| **Supplier Payment** | CORE-PARTIAL | Duplicate endpoints documented. Missing: payment run approval, BACS file generation, payment method tracking, bank reconciliation link, batch export. |
| **AP Aging** | CORE-PARTIAL | Documented with same partial-payment shortcut as AR aging. |
| **GL Account** | CORE-PARTIAL | Schema documented. Missing: opening balance, description, hierarchy/parent-child, cost centre dimension, posting restrictions. All GL codes hardcoded throughout system. |
| **Journal Entry** | CORE-PARTIAL | CRUD documented with balance validation. Missing: DELETE for drafts, concurrent posting protection, recurring templates, budget vs actual. Two parallel GL systems (legacy + modern). |
| **Chart of Accounts Templates** | CORE-PARTIAL | 5 UK templates documented. Missing: API endpoints for CRUD, UI for management. Type is String not Enum. No unique constraint on (templateId, code). |
| **Bank Account** | CORE-PARTIAL | Schema documented. Missing: sort code, account number, IBAN/BIC, GL account link, opening balance. No update/delete endpoints. |
| **Bank Statement Lines** | CORE-PARTIAL | Import and matching documented. Missing: duplicate detection, multi-match, bank rules for auto-categorization, balance assertion. Reconciliation mappings stored in JSON. |
| **Bank Reconciliation** | CORE-PARTIAL | Basic flow documented. Missing: reconciliation report, link to reconciled statement lines, variance/tolerance threshold. |
| **Open Banking (TrueLayer)** | CORE-SKELETON | Provider hardcoded. Sandbox mode only. No actual integration. |
| **VAT Returns** | CORE-PARTIAL | Schema and box calculation documented. Boxes 2, 8, 9 hardcoded to zero. Stored in TenantConfig JSON not relational table. No quarterly scheduling. |
| **HMRC MTD Submission** | CORE-SKELETON | Returns 501 if HMRC_CLIENT_ID not set. Sandbox mode only. No live API calls. Schema model exists but no submission logic. |
| **Fixed Assets** | CORE-PARTIAL | Schema, depreciation (straight-line only), disposal, revaluation documented. Missing: depreciation method field, revaluation history, asset category enum, impairment testing, asset grouping. Can dispose already-disposed assets. |
| **Period Management** | CORE-PARTIAL | Two parallel mechanisms documented. Missing: year-end close, fiscal year configuration, period auto-generation. |
| **Foreign Exchange** | CORE-PARTIAL | FxRate table and revaluation documented. Missing: realized gain/loss on payment, rate provider integration, historical rate lookups, currency management UI. CurrencyRate table never populated. Revaluation returns draft only. |
| **Legacy GL (JournalLine/Account)** | INFRASTRUCTURE | Legacy system still in schema. Used by P&L and BS reports. Should be deprecated. |

### 1.2 Module: Inventory/Stock (Section 2)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **InventoryItem** | CORE-PARTIAL | Prisma model has only 4 typed fields (id, tenantId, sku, qtyOnHand). All metadata (name, description, category, UoM, barcode, weight, dimensions, status, reorder point) stored in TenantConfig JSON blob. Dual creation endpoints. Search filter is a no-op. |
| **Stock Movements** | CORE-PARTIAL | 13 movement types documented. Source/destination decrement/increment are NOT transactional (separate Prisma calls). Missing: movement history API endpoint. |
| **Warehouse** | CORE-PARTIAL | Schema documented. Missing: address, contact info, timezone, capacity, status fields. Code has global unique constraint instead of per-tenant. Disabled warehouses tracked in JSON. |
| **Location** | CORE-SKELETON | Model exists. Missing: capacity, zone, aisle, shelf, status. No CRUD API endpoints. |
| **ASN (Advanced Shipping Notice)** | CORE-SKELETON | Schema model exists. No service, no API routes, no CRUD operations, no link to PO. |
| **Wave / PickTask (Prisma)** | CORE-SKELETON | Prisma models exist. No server-side services or API routes. File-based implementation used instead. |
| **PutawayTask** | CORE-SKELETON | Model exists. Putaway implemented via stock transfer, not PutawayTask records. |
| **Pick/Pack/Ship** | CORE-PARTIAL | File-based JSON implementation documented. Not database-backed. No pack step (picked goes directly to shipped). packedQty field never used. Pick behavior inconsistent between createPick() and pickShipment(). |
| **WMS Receiving** | CORE-PARTIAL | File-based. Records stored in TenantConfig JSON. No over-receiving validation. No partial receiving tracking per PO line. |
| **WMS Shipping** | CORE-PARTIAL | Dual shipment systems (WMS and inventory WMS shipping) with different code paths. |
| **Stock Transfers** | CORE-PARTIAL | Two separate mechanisms (config-based two-step and immediate single-step). File-based JSON storage. Missing: cancel/void transfer. Not transactional. |
| **Quality Control - Holds** | CORE-PARTIAL | QualityHold Prisma model + TenantConfig JSON (dual storage). updateMany() could affect multiple holds unintentionally. |
| **Quality Control - Inspection** | CORE-SKELETON | Model exists in schema. No service or API implementation. |
| **Quality Control - CAPA** | CORE-SKELETON | Model exists in schema. No service or API implementation. |
| **Cycle Counting** | CORE-PARTIAL | Two parallel implementations (database-backed and file-based). No GL journal entries for variances. No scheduled/recurring automation. No approval workflow for variances. |
| **Reservations/ATP** | CORE-PARTIAL | Reservation model exists. ATP service exists but ignores Reservation model (derives from Shipment data). Does not consider incoming supply (open POs) or demand (open SOs). No reservation creation/management API. SalesOrderLine has reservedQty/backorderQty fields never written to. |
| **Lot/Batch Tracking** | CORE-PARTIAL | InventoryLot model exists. StockMove has optional lotId FK (rarely populated). Missing: lot number generation, expiry date, query API, serial number tracking. trackBatch/trackSerial flags stored but never enforced. |
| **Costing (WAC/FIFO)** | CORE-PARTIAL | Two costing methods documented. Cost state stored in TenantConfig JSON. Missing: standard cost method, configurable method per item/tenant, unified interface. No point-in-time valuation (asOf parameter unused). No cost revaluation or price variance reporting. |
| **Replenishment** | CORE-SKELETON | File-based JSON storage for rules. No API routes. No automatic PO generation. No lead time consideration. |
| **RMA (Returns)** | CORE-SKELETON | Entirely file-based. No database model, no API routes. No integration with inventory movements or credit notes. |
| **Landed Costs** | CORE-SKELETON | Model exists. No service, no API routes. No allocation logic. No valuation impact. |
| **Manufacturing Integration** | CORE-PARTIAL | Material issue events tracked. Work order completion records metrics with zero costs. No manufacturing GL posting. Scrap records exist but do not create stock movements. |
| **Star Schema (Metrics)** | CORE-COMPLETE | 7 Dimension tables and 6 Fact tables documented. Event-driven population operational for GRN, pick, putaway, material issue, invoices, POS receipts. |

### 1.3 Module: CRM/Sales (Section 3)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **CRM Lead** | CORE-PARTIAL | Dual stores (file-based + DB-backed). Schema documented. Missing: description/notes field. No dedicated lead-to-opportunity conversion function. Zod schema excludes "cancelled" but server sets it. |
| **CRM Contact** | CORE-PARTIAL | Dual stores. Missing: address fields. Name splitting via space. createdBy/updatedBy never populated. |
| **CRM Account** | CORE-PARTIAL | Dual stores. File-based has parentId for hierarchy; DB does not. No cascade delete check for child contacts/opportunities. |
| **CRM Opportunity** | CORE-PARTIAL | Dual stores with different stage names and transition rules. Pipeline stages hardcoded as strings. No formal stage ordering enforcement. No weighted pipeline value. No PipelineStage model. |
| **Pipeline Summary** | CORE-PARTIAL | Loads ALL opportunities and counts client-side (no SQL GROUP BY). Hardcoded stages. |
| **Sales Quotes** | CORE-PARTIAL | Dual stores with different lifecycle guards. Missing: quote-to-order conversion, terms/conditions, tax on lines. sentAt/acceptedAt/rejectedAt never populated. version never incremented. DB version does not guard editing of accepted quotes. Number format uses timestamp. |
| **Sales Orders** | CORE-SKELETON | Uses wrong model (OrderExternal via Channel model instead of SalesOrder). Only create endpoint exists. No list, get, update, cancel, or status-transition endpoints. No fulfillment workflow. reservedQty/backorderQty never managed. |
| **Activities** | CORE-PARTIAL | Dual stores. completeActivity() sets completedAt but does NOT update status field (remains "pending"). No update endpoint. No reminder/notification integration. |
| **Price Books** | CORE-PARTIAL | Dual stores. Multiple defaults allowed without conflict. No linkage to quote/order lines. |
| **CPQ** | CORE-SKELETON | Minimal 3-line utility. No integration into quote workflow. No approval workflow. No product configuration. |
| **Customer Bridge** | CORE-PARTIAL | Auto-created entity linking CRM contacts to finance customers. No direct API. |
| **POS - Store/TillShift/Session** | CORE-PARTIAL | Three parallel implementations (DB-backed, config-based JSON, file-based). Register stored in JSON. |
| **POS - Sale/Lines/Payments** | CORE-PARTIAL | Triple implementation. Sale number uses count + random nonce (not sequential). Payment persistence failure swallowed. posAudit() only console.logs. |
| **POS - Refund** | CORE-PARTIAL | Schema documented. No inventory or finance reversal on refund. |
| **POS - Promotions** | CORE-SKELETON | Schema exists. No server logic. |
| **POS - Z-Reports** | CORE-SKELETON | Schema exists. No implementation. |
| **POS - CashMovement** | CORE-SKELETON | Schema exists. Not populated. |
| **POS - Drawer** | CORE-SKELETON | No functional logic. |
| **Purchasing - Supplier** | CORE-PARTIAL | Minimal API. Disable tracked in TenantConfig JSON. No REST routes wired. |
| **Purchasing - PO** | CORE-PARTIAL | Status transitions incomplete. cancelPurchaseOrder() sets "closed" instead of "cancelled". Approved/received statuses have no transition logic. |
| **Purchasing - RFQ** | CORE-SKELETON | Stored in TenantConfig JSON. No proper DB table. |
| **Purchasing - BlanketPO** | CORE-SKELETON | Schema only. No server logic. |
| **Purchasing - SupplierContract** | CORE-SKELETON | Schema only. No server logic. |
| **Purchasing - SupplierPerformance** | CORE-SKELETON | Schema only. No server logic. |
| **HubSpot Sync** | CORE-SKELETON | Schema only. No sync logic, no API, no integration code. |
| **RBAC for CRM** | CORE-PARTIAL | Module-level toggle only. No granular crm:manage vs crm:view permissions. Owner validation has no FK constraint. |

### 1.4 Module: HR/Payroll (Section 4)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **Employee Entity** | CORE-PARTIAL | Extremely minimal Prisma model (id, tenantId, employeeNumber, name, email, nationalId, encryptedNationalId). All operational fields (status, department, job title, manager, start date, employment type, pay frequency, base pay, address, DOB, gender) stored in JSON metadata. Dual storage (Prisma + JSON). Encryption stores plaintext alongside encrypted. |
| **Employee CRUD** | CORE-PARTIAL | Create and list operations exist as server functions. No HTTP API routes or tRPC routers. No delete/archive. No bulk import. Search filtering done client-side after fetch. |
| **Department** | CORE-SKELETON | Schema exists. Missing: description, managerId, parentDepartmentId, costCentreCode, active/status. No server-side CRUD services. No API operations. Links Users to Departments but not Employees. |
| **Team** | CORE-SKELETON | Schema exists. Same issues as Department. |
| **Leave Management (Legacy)** | CORE-PARTIAL | JSON-stored leave requests and balances. No LeaveRequest/LeaveType/LeaveBalance models in schema. Simplified accrual (proportional only). No weekend/bank holiday exclusion. In-memory cache not production-safe. |
| **Leave Management (Enhanced)** | CORE-PARTIAL | More sophisticated JSON-based system. Still no database models. Overlap check only on approval not submission. No approval workflow with delegation/escalation. No email notifications. No team leave planner. STAFF has VIEW but no SUBMIT permission. |
| **Attendance/Time Tracking** | OUT-OF-SCOPE (MISSING) | No attendance or time tracking exists in any form. |
| **Payroll - PaySchedule** | CORE-PARTIAL | Prisma model exists. Missing: payDayOfMonth, payDayOfWeek, active flag, taxYear reference. |
| **Payroll - PayrollRun** | CORE-PARTIAL | Three parallel implementations (Prisma, JSON, file). Missing: payDate, processedBy, approvedBy, totalGross, totalNet, totalDeductions, currency, reversalRef. No approval workflow. |
| **Payroll - Payslip** | CORE-PARTIAL | Prisma model and PDF generation exist. Missing: payDate, taxCode, niCategory, pensionOptIn, hoursWorked, paymentMethod, bankSortCode, bankAccountNumber. PDF saved to public directory with no access control. |
| **Payroll - Deduction** | CORE-PARTIAL | Model exists. Missing: type enum (tax, ni, pension, student_loan), rate, threshold, statutory flag. |
| **UK Tax Calculators** | CORE-SKELETON | Simplified demo calculators. Only basic rate (20%). No higher/additional rate bands. No Scottish/Welsh tax. Tax code stored but not parsed. NI category stored but only Category A implemented. Hardcoded 30,000 GBP annual salary. Clearly labeled as demo/test. |
| **Third-Party Payroll API** | CORE-SKELETON | Staffology/PayRun.io mentioned as recommendation. No integration code exists. |
| **BACS Payment File** | CORE-PARTIAL | File generation exists. No integration with payroll runs. No API endpoint. |
| **Payslip PDF** | CORE-PARTIAL | Generation exists. Files saved to public directory with no access control. |
| **Payroll-to-GL Posting** | CORE-PARTIAL | Event subscriber creates journal entries. Two different GL posting mechanisms (risk of double-posting). On-the-fly GL account creation using name-derived codes (fragile). No NI employer contribution line. |
| **Staff Dashboard** | CORE-PARTIAL | "My" prefix misleading (metrics are tenant-wide, not user-specific). myTasks hardcoded to 0. |
| **Recruitment** | OUT-OF-SCOPE (MISSING) | No recruitment functionality exists. |
| **Training** | OUT-OF-SCOPE (MISSING) | No training or development functionality exists. |
| **Employee Document Management** | OUT-OF-SCOPE (MISSING) | No employee document management exists. |
| **HR API Routes** | OUT-OF-SCOPE (MISSING) | No HTTP API routes or tRPC routers for any HR functionality. |
| **HR Frontend** | OUT-OF-SCOPE (MISSING) | No UI pages exist despite routes defined in AI schema. |

### 1.5 Module: Reporting (Section 5)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **P&L Report** | CORE-PARTIAL | Implementation documented. Uses legacy GL model. Missing: date range filtering, comparative periods, budget vs actual, department/cost-centre segmentation. |
| **Balance Sheet** | CORE-PARTIAL | Implementation documented. Uses legacy GL model. Missing: as-of date parameter, retained earnings rollup, comparative periods. |
| **Trial Balance** | CORE-PARTIAL | Two implementations (legacy + modern GL). Need consolidation. |
| **Cash Flow Statement** | OUT-OF-SCOPE (MISSING) | No dedicated cash flow report. Data partially available via TreasuryMovement/BankStatementLine but no report aggregates them. |
| **VAT Reports** | CORE-PARTIAL | Box calculations documented (Boxes 2, 8, 9 hardcoded to zero). Stored in JSON. Does not use line-level taxRate. No MTD submission. |
| **AR Aging Report** | CORE-PARTIAL | Two implementations with different bucket naming. Does not account for partial payments. |
| **AP Aging Report** | CORE-PARTIAL | Same shortcut issues as AR aging. |
| **Invoice Insights** | CORE-PARTIAL | Limited to 50 most recent invoices. |
| **Fixed Asset Register** | CORE-PARTIAL | Only straight-line depreciation. |
| **FX Revaluation Report** | CORE-PARTIAL | Hardcoded to GBP base. No unrealized vs realized distinction. |
| **Unified Report Dispatcher** | CORE-PARTIAL | Exists for TB/P&L/BS. No date range passthrough. Missing: cash flow, VAT, asset register support. |
| **Manufacturing WIP Report** | CORE-PARTIAL | Exists. Does not use VarianceReport model. |
| **Manufacturing Variance Report** | CORE-SKELETON | Model exists in schema. Service does not query it. |
| **Stock Reports** | OUT-OF-SCOPE (MISSING) | No stock valuation, turnover, or reorder point reports. |
| **Sales Reports** | OUT-OF-SCOPE (MISSING) | No pipeline conversion, sales by customer/product reports. |
| **HR Reports** | OUT-OF-SCOPE (MISSING) | No headcount, payroll cost, or absence reports. |
| **POS Reports** | OUT-OF-SCOPE (MISSING) | No daily sales summary, product mix reports. |
| **Project Reports** | OUT-OF-SCOPE (MISSING) | No profitability, utilization, or WIP aging reports. |
| **KPI Dashboard** | CORE-PARTIAL | 21 KPIs defined. Service complete. API returns entirely hardcoded/mock data (does not call KPI service). inventory_value counts items not monetary value. ai_errors counts all logs not just errors. Sequential computation. |
| **KPI Snapshot** | CORE-SKELETON | Model exists. No code writes to it or reads from it. |
| **AI-Generated Reports** | CORE-PARTIAL | Context providers, tenant metrics, forecasting (linear trend + moving average), orchestrator intents, agent tools documented. Risk classification returns "UNCLASSIFIED". Context limited to 5 records per entity. Tool handlers are passthrough. |
| **Report Scheduling** | CORE-SKELETON | Schedule definitions exist (Redis/file). Nothing triggers them. No rendering pipeline. No email/Slack delivery. |
| **Report Export (PDF/CSV/Excel)** | OUT-OF-SCOPE (MISSING) | No export capability for any report. |
| **Data Warehouse** | CORE-PARTIAL | 7 Dimension + 6 Fact tables documented and populated. No reporting layer reads from fact tables. No analytics dashboards. |
| **MetricPoint/MetricsSnapshot** | CORE-SKELETON | Schema models exist. Event metrics write to Redis, not these database models. |

### 1.6 Cross-Module Interactions (Section 6)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **Event Bus (typed, in-process)** | CORE-COMPLETE | 50+ event types defined. Handler registry operational. |
| **Transactional Outbox** | CORE-COMPLETE | Full CRUD, retry with backoff, replay support. Database-backed. |
| **Event Subscribers** | CORE-PARTIAL | Only ~30% have real business logic. Rest are stubs or logs-only. Critical missing: invoice GL posting, SO inventory reservation, POS refund reversal. |
| **Payroll-to-GL Posting** | CORE-COMPLETE | Creates journal entries with expense/payable/liability lines via event subscriber. |
| **WMS/Manufacturing-to-Metrics** | CORE-COMPLETE | GRN, pick, putaway, material issue all record FactInventoryMovement. |
| **Sales Invoice-to-Metrics** | CORE-COMPLETE | FactInvoice recorded for sales and project invoices. |
| **POS Sale-to-Metrics** | CORE-COMPLETE | FactReceipt recorded for completed POS sales. |
| **Notification System** | CORE-PARTIAL | High-value invoice and stock shortfall alerts work. Configurable per-tenant. Only 1 email template (welcome). No business event emails. |
| **Propagation Framework** | CORE-COMPLETE | Registry of 200+ routes. Runtime enforcement available. |
| **Workflow Approval Framework** | CORE-PARTIAL | Definition + instance + enforcer exist. NOT wired to any business operations. |
| **AI Cross-Module Context** | CORE-COMPLETE | 8 module context providers feed data into AI prompts. |
| **AI Agent System** | CORE-COMPLETE | Agent runs with steps, tool registry, audit trail. |
| **External Integration Sync** | CORE-SKELETON | Infrastructure complete. Actual provider APIs not implemented. Mock data. |
| **External Connectors** | CORE-SKELETON | In-memory boolean state. No real OAuth or API integration. |
| **Orchestration (Saga)** | CORE-SKELETON | In-memory queue placeholder. No real orchestration. |
| **Redis Pub/Sub** | INFRASTRUCTURE | Coexists with newer typed event bus. Different type definitions. Not unified. |
| **Redis Queue** | INFRASTRUCTURE | No worker/consumer loop. Jobs enqueued/popped but no automatic processing. |

### 1.7 Management Platform (Section 7)

| Entity / Feature | Classification | Justification |
|---|---|---|
| **Tenant Entity** | CORE-COMPLETE | Full schema with 40+ fields documented. Status lifecycle, demo detection, setup wizard, locale/preferences all documented with business rules. |
| **TenantConfig** | CORE-PARTIAL | Overloaded JSON config field acts as catch-all. Should be broken into typed tables. Used by all modules. |
| **User Entity** | CORE-COMPLETE | Full schema documented. Relations, constraints, indexes all specified. |
| **Authentication** | CORE-COMPLETE | Credentials + Google OAuth + Microsoft Azure AD. JWT sessions (8hr). Cookie configuration. Email normalization. Business rules fully documented. |
| **User Onboarding** | CORE-COMPLETE | Temp password generation, bcrypt hashing, capacity guard, welcome email, reactivation of inactive users. |
| **User Deletion** | CORE-COMPLETE | Soft-delete with permission checks fully documented. |
| **Password Reset** | CORE-PARTIAL | Token model exists. Full reset flow (generate, email, validate, consume) not found. |
| **Re-Authentication** | CORE-SKELETON | 10-minute threshold documented. Password verification is a STUB (accepts any non-empty password). |
| **MFA** | CORE-SKELETON | Schema fields exist (mfaEnabled, mfaSecret). Only warning log during login. No TOTP verification. No setup UI. Advisory only for SUPER_ADMIN. |
| **RBAC - Role Hierarchy** | CORE-COMPLETE | 5 roles with normalization documented. SUPER_ADMIN isolation fully specified. |
| **RBAC - Permission Matrix** | CORE-PARTIAL | Flat permission mapping documented. Hardcoded static matrix. No database-backed dynamic permissions. No custom roles. Inconsistent role normalization between two files. |
| **RBAC - Module Access** | CORE-PARTIAL | Three-level access check documented. Per-user overrides always return null (stubbed). |
| **RBAC - Impersonation** | CORE-COMPLETE | x-act-as header, permission check, audit logging documented. |
| **RBAC - Field Visibility** | CORE-COMPLETE | Role-based redaction for employee, payroll, healthcare, tenant, document entities documented. |
| **Billing Plan Catalog** | CORE-COMPLETE | 5 plans with module assignments documented. Database and fallback resolution. |
| **BillingPlanTemplate** | CORE-COMPLETE | Full schema, validation rules, cloning, tenant count documented. |
| **Effective Plan Resolution** | CORE-COMPLETE | Template + tenant overrides + fallback resolution documented. |
| **Billing Status Lifecycle** | CORE-COMPLETE | trial -> active -> past_due -> cancelled. Route restrictions for past_due/cancelled documented. |
| **User Capacity** | CORE-COMPLETE | Enforcement with effective plan documented. |
| **Feature Gating** | CORE-COMPLETE | Plan-based + tenant-override module gating documented. |
| **Stripe Integration** | CORE-SKELETON | Client initialization, ensureCustomer (creates new each call), checkout/portal session documented. No webhooks, no customer ID persistence, no subscription lifecycle. |
| **Subscription Entity** | CORE-SKELETON | Schema exists. Not the primary billing mechanism. |
| **Platform Invoice** | CORE-SKELETON | Model exists. No generation/management service. |
| **UsageEvent** | CORE-PARTIAL | Schema exists. Used for AI query tracking. |
| **Three Plan Models** | CORE-PARTIAL | Plan, BillingPlan, BillingPlanTemplate all exist. Only BillingPlanTemplate actively used. Others are legacy. |
| **API Key Entity** | CORE-SKELETON | Schema exists. No CRUD service, no validation middleware, no rate limiting. |
| **Webhook Endpoint/Event** | CORE-SKELETON | Schema exists. No management service, no delivery system, no event processing. |
| **Audit Logging** | CORE-PARTIAL | AuditLog entity + SUPER_ADMIN/config/sensitive-read event types documented. Missing: retention policy, search API, login/logout events, CRUD events. |
| **SIEM Export** | CORE-SKELETON | Schema exists. No export service. |
| **Backup/DR** | CORE-SKELETON | BackupJob and DrDrill models exist. No service code. |
| **Notification Model** | CORE-SKELETON | Schema exists. No notification service. |
| **Tenant Encryption Keys** | CORE-SKELETON | Model exists. No key management, rotation, or BYOK service. |
| **Demo Data Visibility** | CORE-SKELETON | Schema exists. No service code. |
| **Rate Limiting** | CORE-PARTIAL | In-memory token bucket. Not shared across instances. Not connected to ApiKey. |
| **Security Headers** | CORE-COMPLETE | CSP, HSTS, X-Frame-Options, etc. fully documented. |
| **Super Admin Dashboard** | CORE-COMPLETE | Platform-wide stats, billing breakdown, MRR documented. |
| **Super Admin Security Policies** | CORE-COMPLETE | Max 3 SUPER_ADMIN, password policy, self-promotion detection, break-glass accounts documented. |
| **Compliance Management** | CORE-SKELETON | Read/update/check/export operations exist. Compliance check is a no-op (just records timestamp). |
| **Integrations Management** | CORE-COMPLETE | 8 built-in integration status checks via env vars documented. |
| **AI Configuration** | CORE-COMPLETE | Per-role AI config with system prompts documented. |
| **AI Usage Analytics** | CORE-COMPLETE | Usage tracking, windowed queries, tenant/role/day breakdowns documented. |
| **Operational Runbooks** | CORE-PARTIAL | Stored in NEXA_ROOT tenant. 3 default runbooks. Should be in dedicated PlatformConfig table. |

### 1.8 Classification Summary Statistics

| Classification | Count | Percentage |
|---|---|---|
| CORE-COMPLETE | 32 | 18% |
| CORE-PARTIAL | 95 | 53% |
| CORE-SKELETON | 40 | 22% |
| INFRASTRUCTURE | 3 | 2% |
| OUT-OF-SCOPE (MISSING) | 10 | 6% |
| **Total** | **180** | **100%** |

**Key Takeaway:** Only 18% of documented entities/features are complete enough to build from without additional specification. 53% require significant gap-filling. 22% are schema-only stubs. 6% represent entirely missing features that are expected for an SME ERP.

---

## Part 2: Missing Features Analysis

### 2.1 Invoicing & Accounts -- Missing Features

#### Features Found in Competitors but Missing from Extraction

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **Invoice PDF Generation & Email** | Xero, QuickBooks, Sage, Odoo, ERPNext, Zoho | MUST | Cannot issue invoices to customers without this. Table stakes for any invoicing system. |
| **Recurring Invoices** | Xero, QuickBooks, Sage, Zoho, ERPNext | SHOULD | Standard feature for subscription billing and regular retainer invoicing. |
| **Credit Control / Automated Dunning** | Xero (via Chaser), Sage, Profit4, Credit Hound | SHOULD | UK market expectation for SME accounting. Automated payment reminders, multi-channel chasing. |
| **Customer Statements** | Xero, QuickBooks, Sage, Zoho | SHOULD | Monthly/on-demand customer statements. Standard AR feature. |
| **Bank Rules / Auto-Categorization** | Xero, QuickBooks, Sage, Zoho | SHOULD | Xero and QuickBooks learn from user categorizations. Major time-saver. |
| **Multi-Currency with Auto Rate Fetch** | Xero, QuickBooks, Sage, ERPNext | SHOULD | Automatic FX rate fetching from providers (ECB, Open Exchange Rates). |
| **MTD VAT Live Submission** | Xero, QuickBooks, Sage, FreeAgent, Zoho | MUST | UK legal requirement since April 2022. All competitors are HMRC-recognised. |
| **MTD for Income Tax** | Xero, QuickBooks, FreeAgent | MUST | Mandatory from April 2026 for income over 50K. QuickBooks and Xero already in HMRC testing. |
| **Open Banking Live Integration** | Xero, Sage, QuickBooks | SHOULD | Real-time bank feeds. Xero has direct feeds with major UK banks. |
| **Three-Way Matching (PO/GRN/Invoice)** | Sage 200, ERPNext, Odoo | SHOULD | Standard for any system with purchasing and AP. |
| **Direct Debit / GoCardless Integration** | Xero, QuickBooks, Sage | COULD | Collect payments automatically via DD mandate. |
| **E-Invoicing Preparation (Peppol/UBL)** | Odoo, SAP B1 | COULD | UK mandatory e-invoicing for B2B/B2G from April 2029 (HMRC consultation 2025). |
| **Budget Management** | Xero, QuickBooks, Sage, ERPNext | SHOULD | Budget vs actual comparison. Standard management accounting feature. |
| **Configurable Aging Buckets** | Sage, ERPNext | COULD | Allow tenants to define aging periods beyond standard 30/60/90. |
| **Batch Payment Processing (BACS)** | Sage, ERPNext | SHOULD | UK standard for paying multiple suppliers. BACS file generation critical. |
| **Payment Portal / Self-Service** | Xero (Stripe/GoCardless), Credit Hound (PayThem) | COULD | Allow customers to pay directly from invoice email. |
| **Companies House Filing** | Sage, Xero (via partners) | SHOULD | Mandatory software filing from April 2027 (iXBRL format). |

#### UK Compliance Gaps (Regulatory Requirements)

| Requirement | Status in Extraction | Regulatory Deadline | Priority |
|---|---|---|---|
| MTD for VAT (live HMRC API) | STUBBED (sandbox only) | Already mandatory (April 2022) | MUST |
| MTD for Income Tax | NOT MENTIONED | April 2026 (>50K income) | MUST |
| GDPR Data Subject Rights | PARTIAL (compliance config exists, no enforcement) | Current law | MUST |
| GDPR Right to Erasure | MISSING | Current law | MUST |
| GDPR Data Portability | MISSING | Current law | SHOULD |
| GDPR Consent Management | MISSING | Current law | SHOULD |
| Open Banking / PSD2 | STUBBED (TrueLayer sandbox) | Current regulation | SHOULD |
| SCA (Strong Customer Auth) | NOT MENTIONED | Current regulation | SHOULD |
| Companies House iXBRL | NOT MENTIONED | April 2027 | SHOULD |
| UK E-Invoicing (B2B/B2G) | NOT MENTIONED | April 2029 | COULD |

### 2.2 Inventory/Stock -- Missing Features

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **Proper Item Master (relational columns)** | Unleashed, ERPNext, Odoo, Brightpearl | MUST | Every competitor has named columns for item fields. JSON blob is not queryable or indexable. |
| **Barcode Scanning** | Unleashed, Brightpearl, ERPNext | SHOULD | Standard warehouse feature. Scan to receive, pick, count. |
| **Demand Forecasting** | Unleashed (AIM module), ERPNext, Odoo | SHOULD | Auto-detect optimal reorder points based on historical demand and lead times. |
| **Serial Number Tracking** | Unleashed, ERPNext, Odoo | SHOULD | trackSerial flag exists but no implementation. Required for regulated industries. |
| **Expiry Date / Shelf Life Tracking** | Unleashed, ERPNext | SHOULD | Critical for food/pharma. Lot model has no expiryDate. |
| **Multi-UoM (Unit of Measure)** | ERPNext, Odoo, Sage 200 | SHOULD | Buy in cases, sell in units. UoM conversion. |
| **Landed Cost Allocation** | Unleashed (auto), ERPNext, Odoo | SHOULD | Model exists but no service or allocation logic. Unleashed does this automatically. |
| **Inventory Valuation Reports** | Unleashed, ERPNext, Sage | SHOULD | No report reads from costing data. |
| **Stock Aging Report** | Unleashed, ERPNext | COULD | Identify slow-moving and dead stock. |
| **Multi-Channel Inventory Sync** | Unleashed, Brightpearl | COULD | Sync stock across ecommerce channels (Shopify, Amazon, WooCommerce). |
| **Automated Reorder / Auto-PO** | Unleashed, ERPNext, Odoo | SHOULD | Automatic PO generation when stock falls below reorder point. |
| **Bin/Zone Management** | ERPNext, Odoo | COULD | Sub-location management within warehouses. |
| **Returns Management (integrated)** | Brightpearl, ERPNext | SHOULD | RMA with inventory restock + credit note + refund integration. |
| **Stock Take / Physical Count (mobile)** | Unleashed, ERPNext | COULD | Mobile interface for physical stock counts. |

### 2.3 CRM/Sales -- Missing Features

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **Single Implementation (remove duals)** | All competitors (single source of truth) | MUST | Every CRM entity has file-based AND DB stores. No competitor has this pattern. |
| **Complete Sales Order Lifecycle** | Odoo, ERPNext, Sage 200, Brightpearl | MUST | Confirm -> Pick -> Pack -> Ship -> Invoice -> Payment. Core ERP workflow. |
| **Quote-to-Order Conversion** | Odoo, ERPNext, Sage, HubSpot | MUST | One-click conversion. Core sales workflow. |
| **Email Integration** | HubSpot, Salesforce, Zoho CRM | SHOULD | Track emails sent/received per contact. Email templates. Sequence automation. |
| **Pipeline Analytics / Sales Dashboard** | HubSpot, Zoho CRM, ERPNext | SHOULD | Win rates, conversion rates, pipeline velocity, forecast. |
| **Configurable Pipeline Stages** | HubSpot, Zoho CRM, Odoo | SHOULD | Admin-defined pipeline stages with ordering and probability. |
| **Lead Scoring** | HubSpot, Zoho CRM | COULD | AI-powered or rule-based lead prioritization. |
| **Sales Forecasting** | HubSpot, Zoho CRM, ERPNext | SHOULD | Based on pipeline stage probability and close dates. |
| **Territory Management** | Zoho CRM, Salesforce | COULD | Assign leads/accounts by geography or other criteria. |
| **Web Form / Lead Capture** | HubSpot, Zoho CRM | SHOULD | Embed forms on website to capture leads directly into CRM. |
| **POS - Stripe Terminal Integration** | Brightpearl, Shopify POS | SHOULD | Schema fields exist but no implementation. |
| **POS - Offline Mode** | Shopify POS, Lightspeed | SHOULD | Process sales when internet is down, sync when back online. |
| **POS - Loyalty/Rewards** | Shopify POS, Lightspeed | COULD | Customer loyalty points and rewards programs. |
| **Goods Receipt / 3-Way Match** | Sage 200, ERPNext, Odoo | MUST | PO -> GRN -> Invoice matching. Core procurement feature. |
| **Supplier Evaluation** | ERPNext, Odoo, Sage 200 | COULD | Rate suppliers on delivery, quality, price compliance. |

### 2.4 HR/Payroll -- Missing Features

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **Proper Employee Schema** | BambooHR, CharlieHR, Breathe HR, ERPNext | MUST | Every HR system has proper columns for employee fields. JSON blob is not acceptable. |
| **API Layer** | All competitors | MUST | No HR module can function without API endpoints. |
| **Frontend UI** | All competitors | MUST | No UI pages for any HR functionality. Cannot be used. |
| **UK Payroll via Third-Party API** | Sage Payroll, Staffology, PayRun.io, BrightPay | MUST | UK payroll tax calculation is too complex for in-house. RTI/FPS/EPS submission to HMRC. Use Staffology or PayRun.io API. |
| **Employee Self-Service Portal** | BambooHR, CharlieHR, Breathe HR | MUST | View payslips, request leave, update personal details. Table stakes for modern HR. |
| **Leave Approval Workflow** | CharlieHR, Breathe HR, BambooHR | MUST | Manager approval with email notification. Calendar view. |
| **UK Bank Holidays** | CharlieHR, Breathe HR | MUST | Automatic UK bank holiday integration. Working day calculation. |
| **Pension Auto-Enrolment** | Sage Payroll, BrightPay, Staffology | MUST | UK legal requirement. Employer must auto-enrol eligible workers. Must integrate with pension providers (NEST, etc.). |
| **P45/P60 Generation** | Sage Payroll, BrightPay | MUST | Required for joiners/leavers (P45) and annual tax summary (P60). |
| **RTI Submissions (FPS/EPS)** | Sage Payroll, BrightPay, Staffology | MUST | Real-Time Information submissions to HMRC. Legal requirement for every pay run. |
| **Student Loan Deductions** | Sage Payroll, BrightPay | MUST | Plan 1, Plan 2, Plan 4, Postgraduate. UK legal requirement. |
| **Statutory Pay (SSP/SMP/SPP/SAP)** | Sage Payroll, BrightPay | MUST | Statutory Sick Pay, Maternity, Paternity, Adoption Pay. UK legal requirement. |
| **Organisation Chart** | BambooHR, CharlieHR | SHOULD | Visual reporting hierarchy. |
| **Onboarding Workflow** | BambooHR, CharlieHR | SHOULD | New joiner checklist, document collection, equipment assignment. |
| **Offboarding Workflow** | BambooHR, CharlieHR | SHOULD | Leaver checklist, equipment return, access revocation, final pay. |
| **Document Management (HR)** | BambooHR, CharlieHR, Breathe HR | SHOULD | Store employment contracts, right to work documents, certifications with expiry tracking. |
| **Absence Analytics** | CharlieHR, Breathe HR | SHOULD | Bradford Factor, absence trends, trigger points. |
| **Performance Reviews** | BambooHR, CharlieHR | COULD | Goals, reviews, 1:1 tracking. |
| **Expense Claims** | CharlieHR, Xero, QuickBooks | COULD | Employee expense submission and approval. |
| **Time Tracking** | BambooHR, ERPNext | COULD | Clock in/out, timesheet approval, payroll integration. |

### 2.5 Reporting -- Missing Features

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **PDF/CSV/Excel Export** | All competitors | MUST | No report can be exported. Table stakes. |
| **Cash Flow Statement** | Xero, QuickBooks, Sage | MUST | One of the three core financial statements. |
| **Comparative Periods** | Xero, QuickBooks, Sage | MUST | This month vs last month/year. Standard financial reporting. |
| **MTD VAT Submission Report** | Xero, QuickBooks, Sage | MUST | 9-box VAT return with HMRC submission. |
| **Real-Time KPI Dashboard** | Odoo, ERPNext, Zoho One | SHOULD | KPI API currently returns mock data. |
| **Stock Valuation Report** | Unleashed, ERPNext, Sage | SHOULD | FIFO/WAC valuation with cost analysis. |
| **Sales Analytics** | HubSpot, Zoho CRM, ERPNext | SHOULD | Pipeline, conversion, revenue by product/customer. |
| **Payroll Summary Reports** | Sage Payroll, BrightPay | SHOULD | Cost analysis, tax summary, pension contributions. |
| **Scheduled Report Delivery** | Odoo, ERPNext | COULD | Email scheduled reports to stakeholders. |
| **Custom Report Builder** | Odoo Studio, ERPNext | COULD | User-defined report criteria and layouts. |
| **AI Anomaly Detection** | Modern ERP trend (2025-2026) | COULD | Flag unusual transactions, spending patterns, missing entries. |

### 2.6 Management Platform -- Missing Features

| Feature | Found In | Priority | Notes |
|---|---|---|---|
| **Database-Per-Tenant Architecture** | Document recommends this. Modern SaaS standard. | MUST | Currently shared-database with application-layer isolation only. |
| **Row-Level Security (RLS)** | PostgreSQL standard. Multi-tenant SaaS requirement. | MUST | No RLS policies exist. Single coding error could expose cross-tenant data. |
| **MFA Enforcement** | All SaaS platforms | MUST | Currently advisory only. Must enforce for admin roles. |
| **Password Complexity (all users)** | All SaaS platforms | MUST | Only SUPER_ADMIN has password policy. Regular users have none. |
| **Account Lockout** | All SaaS platforms | MUST | No lockout after failed login attempts. Brute force vulnerability. |
| **Session Invalidation** | All SaaS platforms | SHOULD | No mechanism beyond 8hr JWT expiry. Cannot force-logout compromised sessions. |
| **Stripe Webhook Processing** | Standard for SaaS billing | SHOULD | No webhook handlers for subscription lifecycle events. |
| **API Key Management** | Standard for developer platforms | SHOULD | Schema exists but no service code. |
| **Webhook Delivery System** | Standard for integrations | SHOULD | Schema exists but no delivery system. |
| **GDPR Data Subject Requests** | UK legal requirement | MUST | No mechanism to handle data access, erasure, or portability requests. |
| **Audit Log for Business CRUD** | SOC 2 / ISO 27001 standard | SHOULD | Only SUPER_ADMIN, config changes, and sensitive reads are audited. No CRUD audit. |
| **Backup/DR Automation** | Standard for SaaS platforms | SHOULD | Models exist but no service code. |

### 2.7 Cross-Cutting Concerns -- Missing Features

| Feature | Priority | Notes |
|---|---|---|
| **Data Import/Export (CSV/Excel)** | MUST | No bulk import or export capability for any module. SMEs need to migrate data from existing systems. |
| **Document Management (General)** | SHOULD | Attachment model exists (polymorphic) but no document management features (version control, approval, retention). |
| **Email Templates Library** | SHOULD | Only 1 email template (welcome). Need: invoice, order confirmation, payment receipt, approval request, password reset, statement. |
| **Notification Preferences (per-user)** | SHOULD | Only per-tenant notification config. Users cannot set their own preferences. |
| **Integration Marketplace** | COULD | No marketplace API or developer portal. Schemas exist but empty directories. |
| **Mobile/Responsive UI** | SHOULD | Not assessed in extraction but critical for SME field workers, POS, warehouse. |
| **Multi-Language Support** | COULD | Locale field exists but no i18n framework documented. |
| **Data Retention Policies** | SHOULD | No configurable retention for audit logs, old transactions, archived data. GDPR requirement. |
| **Webhook Outbound** | SHOULD | Schema exists but no delivery system. Needed for third-party integrations. |
| **SSO (SAML/OIDC)** | COULD | Google OAuth and Azure AD exist. No generic SAML/OIDC provider support. |

---

## Part 3: Competitor Feature Matrix

### 3.1 Invoicing & Accounts

| Feature | Nexa ERP | Xero | QuickBooks UK | Sage 50/200 | Odoo | ERPNext | Zoho Books |
|---|---|---|---|---|---|---|---|
| Invoice CRUD | PARTIAL | YES | YES | YES | YES | YES | YES |
| Invoice PDF/Email | NO | YES | YES | YES | YES | YES | YES |
| Recurring Invoices | NO | YES | YES | YES | YES | YES | YES |
| Credit Notes | PARTIAL | YES | YES | YES | YES | YES | YES |
| Customer Statements | NO | YES | YES | YES | YES | YES | YES |
| Multi-Currency | PARTIAL | YES | YES | YES | YES | YES | YES |
| Auto FX Rates | NO | YES | YES | YES | YES | YES | YES |
| Bank Feeds (Live) | STUB | YES | YES | YES | YES | NO | YES |
| Bank Reconciliation | PARTIAL | YES | YES | YES | YES | YES | YES |
| Bank Rules | NO | YES | YES | YES | YES | YES | YES |
| MTD VAT (Live) | STUB | YES | YES | YES | YES | YES | YES |
| MTD Income Tax | NO | TESTING | TESTING | PLANNED | NO | NO | NO |
| AP / Bills | PARTIAL | YES | YES | YES | YES | YES | YES |
| 3-Way Matching | NO | NO | NO | YES | YES | YES | NO |
| Batch Payments (BACS) | NO | YES | YES | YES | YES | YES | NO |
| Fixed Assets | PARTIAL | YES | YES | YES | YES | YES | YES |
| Budget Management | NO | YES | YES | YES | YES | YES | YES |
| GL Journal Entries | PARTIAL | YES | YES | YES | YES | YES | YES |
| P&L Report | PARTIAL | YES | YES | YES | YES | YES | YES |
| Balance Sheet | PARTIAL | YES | YES | YES | YES | YES | YES |
| Cash Flow Statement | NO | YES | YES | YES | YES | YES | YES |
| Report Export (PDF/CSV) | NO | YES | YES | YES | YES | YES | YES |
| Open Banking | STUB | YES | YES | YES | NO | NO | NO |
| Direct Debit Collection | NO | YES | YES | YES | NO | NO | NO |
| Credit Control/Dunning | NO | VIA ADD-ON | NO | YES | YES | YES | YES |
| Companies House Filing | NO | VIA PARTNER | NO | YES | NO | NO | NO |

### 3.2 Inventory/Stock

| Feature | Nexa ERP | Unleashed | ERPNext | Odoo | Brightpearl | Sage 200 |
|---|---|---|---|---|---|---|
| Item Master (relational) | JSON ONLY | YES | YES | YES | YES | YES |
| Multi-Warehouse | PARTIAL | YES | YES | YES | YES | YES |
| Stock Movements | PARTIAL | YES | YES | YES | YES | YES |
| Batch/Lot Tracking | PARTIAL | YES | YES | YES | YES | YES |
| Serial Number Tracking | FLAG ONLY | YES | YES | YES | YES | YES |
| Expiry Date Tracking | NO | YES | YES | YES | YES | YES |
| Barcode Scanning | NO | YES | YES | YES | YES | YES |
| Demand Forecasting | NO | YES (AIM) | YES | YES | YES | YES |
| Auto Reorder / Auto-PO | NO | YES | YES | YES | YES | YES |
| Landed Cost Tracking | STUB | YES (auto) | YES | YES | YES | YES |
| Multi-UoM | NO | YES | YES | YES | YES | YES |
| Cycle Counting | PARTIAL | YES | YES | YES | YES | YES |
| Pick/Pack/Ship | FILE-BASED | YES | YES | YES | YES | YES |
| Stock Valuation Report | NO | YES | YES | YES | YES | YES |
| Returns (RMA) | FILE-BASED | YES | YES | YES | YES | YES |
| Quality Control | STUB | NO | YES | YES | NO | YES |
| ATP/Reservations | PARTIAL | YES | YES | YES | YES | YES |
| Manufacturing Integration | PARTIAL | NO | YES | YES | NO | YES |
| Multi-Channel Sync | NO | YES | NO | YES | YES | NO |
| Costing (FIFO/WAC/Std) | PARTIAL (no Std) | YES | YES | YES | YES | YES |

### 3.3 CRM/Sales

| Feature | Nexa ERP | HubSpot CRM | Zoho CRM | Odoo CRM | ERPNext |
|---|---|---|---|---|---|
| Lead Management | PARTIAL (dual stores) | YES | YES | YES | YES |
| Contact Management | PARTIAL (dual stores) | YES | YES | YES | YES |
| Account/Company | PARTIAL (dual stores) | YES | YES | YES | YES |
| Opportunity/Deal | PARTIAL (dual stores) | YES | YES | YES | YES |
| Configurable Pipeline | NO (hardcoded) | YES | YES | YES | YES |
| Sales Quotes | PARTIAL (dual stores) | YES | YES | YES | YES |
| Sales Orders | SKELETON | NO (via integration) | YES | YES | YES |
| Quote-to-Order | NO | NO | YES | YES | YES |
| Order-to-Invoice | NO | NO | YES | YES | YES |
| Activities/Tasks | PARTIAL (bug) | YES | YES | YES | YES |
| Email Integration | NO | YES | YES | YES | YES |
| Lead Scoring | NO | YES | YES | YES | NO |
| Sales Forecasting | NO | YES | YES | YES | YES |
| Pipeline Analytics | NO | YES | YES | YES | YES |
| Web Forms/Lead Capture | NO | YES | YES | YES | YES |
| POS | PARTIAL (triple impl) | NO | NO | YES | YES |
| Purchasing | SKELETON | NO | YES | YES | YES |
| Price Books | PARTIAL | NO | YES | YES | YES |

### 3.4 HR/Payroll

| Feature | Nexa ERP | BambooHR | CharlieHR | Breathe HR | Sage Payroll | Staffology API |
|---|---|---|---|---|---|---|
| Employee Management | JSON-BASED | YES | YES | YES | YES | YES |
| Employee Self-Service | NO | YES | YES | YES | YES | YES |
| Leave Management | JSON-BASED | YES | YES | YES | YES | YES |
| Leave Approval Workflow | NO | YES | YES | YES | YES | YES |
| UK Bank Holidays | NO | YES | YES | YES | YES | YES |
| Payroll Processing | DEMO ONLY | NO | NO | NO | YES | YES (API) |
| UK PAYE/NI Calculation | DEMO | NO | NO | NO | YES | YES |
| RTI Submission (FPS/EPS) | NO | NO | NO | NO | YES | YES |
| Pension Auto-Enrolment | NO | NO | YES | NO | YES | YES |
| P45/P60 Generation | NO | NO | NO | NO | YES | YES |
| Statutory Pay (SSP/SMP) | NO | NO | NO | NO | YES | YES |
| Student Loan Deductions | NO | NO | NO | NO | YES | YES |
| Org Chart | NO | YES | YES | YES | NO | NO |
| Onboarding Workflow | NO | YES | YES | YES | NO | NO |
| Document Management | NO | YES | YES | YES | NO | NO |
| Performance Reviews | NO | YES | YES | NO | NO | NO |
| Absence Analytics | NO | YES | YES | YES | NO | NO |
| Time Tracking | NO | YES | NO | NO | NO | NO |
| Expense Claims | NO | NO | YES | NO | NO | NO |

### 3.5 Reporting & Analytics

| Feature | Nexa ERP | Xero | QuickBooks | Sage | Odoo | ERPNext |
|---|---|---|---|---|---|---|
| P&L (with date range) | PARTIAL | YES | YES | YES | YES | YES |
| Balance Sheet (as-of date) | PARTIAL | YES | YES | YES | YES | YES |
| Cash Flow Statement | NO | YES | YES | YES | YES | YES |
| Trial Balance | PARTIAL (dual GL) | YES | YES | YES | YES | YES |
| VAT Return (MTD) | STUB | YES | YES | YES | YES | YES |
| Comparative Periods | NO | YES | YES | YES | YES | YES |
| Budget vs Actual | NO | YES | YES | YES | YES | YES |
| PDF Export | NO | YES | YES | YES | YES | YES |
| CSV/Excel Export | NO | YES | YES | YES | YES | YES |
| Scheduled Reports | STUB | NO | NO | YES | YES | YES |
| Custom Report Builder | NO | NO | YES | YES | YES (Studio) | YES |
| KPI Dashboard (live) | MOCK DATA | YES | YES | YES | YES | YES |
| AI Analytics | PARTIAL | YES (AI) | YES (AI) | NO | YES (AI) | NO |

### 3.6 Management Platform

| Feature | Nexa ERP | Standard SaaS | Notes |
|---|---|---|---|
| Multi-Tenant Isolation | APP-LAYER ONLY | DB-LEVEL (RLS or DB-per-tenant) | Security risk |
| MFA | ADVISORY ONLY | ENFORCED | Security risk |
| Password Policy (all users) | SUPER_ADMIN ONLY | ALL USERS | Security risk |
| Account Lockout | NO | YES | Brute force vulnerability |
| RBAC (database-backed) | HARDCODED MATRIX | DB-BACKED | Cannot customize roles |
| Stripe Billing (full lifecycle) | SKELETON | FULL WEBHOOK PROCESSING | Cannot bill customers |
| API Key Management | SCHEMA ONLY | FULL CRUD + VALIDATION | No developer access |
| Webhook System | SCHEMA ONLY | FULL DELIVERY + RETRY | No integration events |
| Audit Logging (comprehensive) | PARTIAL | FULL CRUD + LOGIN/LOGOUT | Compliance gap |
| GDPR Data Subject Requests | NO | YES | Legal requirement |
| Data Import/Export | NO | YES | Migration blocker |

---

## Part 4: Prioritized Addition List

### Priority Definitions

| Priority | Definition | Criteria |
|---|---|---|
| **MUST** | Required for compliance, data integrity, or basic operability | UK legal requirement, or system cannot function without it, or security vulnerability |
| **SHOULD** | Required for competitor parity and user expectations | Every major competitor has this, or significantly degrades UX without it |
| **COULD** | Differentiating or nice-to-have features | Would set Nexa apart, or useful but not essential for launch |

---

### 4.1 MUST-HAVE Additions (Compliance / Data Integrity / Operability)

#### 4.1.1 UK Regulatory Compliance

| # | Feature | Module | Rationale |
|---|---|---|---|
| M-1 | **MTD VAT Live HMRC Integration** | Invoicing | UK legal requirement since April 2022. All competitors are HMRC-recognised. Currently stubbed (sandbox only). Must implement 9-box return, obligations API, fraud prevention headers. Consider using third-party MTD bridge (e.g., Tax Digital by Avalara). |
| M-2 | **MTD for Income Tax Readiness** | Invoicing/Reporting | Mandatory April 2026 for income >50K. Quarterly digital reporting + end-of-period statement. QuickBooks and Xero already in HMRC testing. |
| M-3 | **Pension Auto-Enrolment** | HR/Payroll | UK legal requirement. Employers must auto-enrol eligible workers. Integration with pension providers (NEST, People's Pension, Smart Pension). |
| M-4 | **RTI Submissions (FPS/EPS)** | HR/Payroll | Real-Time Information to HMRC is a legal requirement for every pay run. Must use Staffology or PayRun.io API. |
| M-5 | **Statutory Pay Calculations** | HR/Payroll | SSP, SMP, SPP, SAP, ShPP are UK legal requirements. Cannot process payroll without these. Use third-party API. |
| M-6 | **Student Loan Deductions** | HR/Payroll | Plan 1, 2, 4, Postgraduate. Employer must deduct when notified by HMRC. Use third-party API. |
| M-7 | **P45/P60 Generation** | HR/Payroll | Legal documents for joiners/leavers (P45) and annual tax summary (P60). |
| M-8 | **GDPR Data Subject Request Handling** | Platform | UK law. Must support: data access requests, right to erasure, data portability. Need mechanism to locate, export, and delete personal data across all modules. |
| M-9 | **GDPR Data Retention Policies** | Platform | Must have configurable retention periods for different data types with automated archival/deletion. |

#### 4.1.2 Data Integrity / Security

| # | Feature | Module | Rationale |
|---|---|---|---|
| M-10 | **Database-Level Tenant Isolation (RLS)** | Platform | Application-layer only isolation. Single coding error exposes cross-tenant data. PostgreSQL RLS policies required as defense-in-depth. |
| M-11 | **MFA Enforcement (Admin Roles)** | Platform | Currently advisory only (warning log). Must enforce TOTP/WebAuthn for ADMIN and SUPER_ADMIN roles. |
| M-12 | **Password Complexity (All Users)** | Platform | Only SUPER_ADMIN has password policy. All users need minimum complexity requirements. |
| M-13 | **Account Lockout** | Platform | No lockout after failed attempts. Brute force vulnerability. Standard: lock after 5 failed attempts, unlock after 30 mins or admin reset. |
| M-14 | **Re-Authentication (Real Implementation)** | Platform | Currently accepts any non-empty password. Must verify actual password for high-risk operations. |
| M-15 | **Transactional Stock Movements** | Inventory | Source/destination updates are separate Prisma calls. Failure midway creates inconsistent state. Must use database transactions. |

#### 4.1.3 Core Operability

| # | Feature | Module | Rationale |
|---|---|---|---|
| M-16 | **Invoice PDF Generation & Email** | Invoicing | Cannot issue invoices without PDF generation. Table stakes for any invoicing system. Every competitor has this. |
| M-17 | **Report Export (PDF/CSV/Excel)** | Reporting | No report can be exported. Users cannot work with data. Every competitor has this. |
| M-18 | **Single GL System** | Invoicing | Two parallel GL systems (legacy + modern). Must consolidate to one before building. Risk of double-posting and data inconsistency. |
| M-19 | **Invoice/Bill GL Auto-Posting** | Cross-Module | Invoices and bills do not create GL journal entries. Only payroll does. Fundamental double-entry accounting requirement. |
| M-20 | **Employee Schema (Proper Columns)** | HR | Employee model has only id/tenantId/sku/name/email. All operational fields in JSON blob. Cannot query, index, or validate. Must have proper relational columns. |
| M-21 | **HR API Layer** | HR | No HTTP API routes or tRPC routers. Module cannot be used by any client. |
| M-22 | **HR Frontend Pages** | HR | No UI pages exist despite routes defined. Module is invisible to users. |
| M-23 | **UK Payroll via Third-Party API** | HR/Payroll | Current tax calculators are simplified demos (basic rate only, hardcoded salaries). Must integrate Staffology or PayRun.io for production tax calculation. |
| M-24 | **Sales Order System (Proper)** | CRM/Sales | Uses wrong model (OrderExternal). No CRUD, no status transitions, no fulfillment workflow. Core sales workflow is broken. |
| M-25 | **Quote-to-Order-to-Invoice Flow** | CRM/Sales | No conversion functions exist between these core entities. Fundamental sales process. |
| M-26 | **Item Master Migration (JSON to Relational)** | Inventory | All item metadata in JSON blob. Cannot query by name, category, or barcode. Cannot index for performance. Not acceptable for any inventory system. |
| M-27 | **Database-Backed Storage (All Modules)** | All | Pick/pack/ship, transfers, receiving, replenishment, RMA, leave requests, payroll runs all use file-based JSON storage. Must migrate to database. |
| M-28 | **Eliminate Dual Implementations** | CRM/All | Every CRM entity has file-based AND DB-backed stores. HR has triple payroll implementations. Must consolidate to single source of truth. |
| M-29 | **Data Import/Export (Bulk)** | Platform | No bulk import or export for any module. SMEs must migrate data from existing systems (Xero, QuickBooks, spreadsheets). Migration blocker. |
| M-30 | **Cash Flow Statement** | Reporting | One of the three core financial statements. Every accounting competitor has this. |
| M-31 | **Leave Management (Proper Schema)** | HR | No LeaveRequest/LeaveType/LeaveBalance models in schema. JSON-only. Cannot have a functioning HR module without proper leave management. |
| M-32 | **Configurable GL Account Codes** | Invoicing | All GL account codes hardcoded as strings throughout the system. Must be configurable per tenant via Chart of Accounts. |
| M-33 | **Customer/Supplier Schema Completeness** | Invoicing | Customer missing: VAT number, structured address, credit limit. Supplier missing: address, VAT number, payment terms, bank details. Core business entity fields. |

**MUST-HAVE Total: 33 items**

---

### 4.2 SHOULD-HAVE Additions (Competitor Parity / User Expectations)

#### 4.2.1 Invoicing & Accounts

| # | Feature | Rationale |
|---|---|---|
| S-1 | Recurring Invoices | All major competitors (Xero, QuickBooks, Sage, Zoho) support this. Standard for subscription billing. |
| S-2 | Customer Statements | Standard AR feature. Monthly/on-demand statements. All competitors have this. |
| S-3 | Credit Control / Automated Dunning | UK market expectation. Automated payment reminders via email/SMS. Chaser-style integration. |
| S-4 | Bank Rules / Auto-Categorization | Xero and QuickBooks learn from user categorizations. Major time-saver for reconciliation. |
| S-5 | Open Banking Live Integration | Real-time bank feeds. Xero has direct feeds with major UK banks. TrueLayer currently sandbox only. |
| S-6 | Multi-Currency Auto FX Rate Fetch | All competitors auto-fetch rates. Current system requires manual rate entry. |
| S-7 | Three-Way Matching (PO/GRN/Invoice) | Sage 200, ERPNext, Odoo all have this. Standard for any system with purchasing. |
| S-8 | Batch Payment Processing (BACS) | UK standard for paying suppliers. BACS file generation. Sage and ERPNext have this. |
| S-9 | Budget Management | Standard management accounting. Xero, QuickBooks, Sage all have budget vs actual. |
| S-10 | Companies House Filing Preparation | Mandatory software filing from April 2027 (iXBRL). Sage already supports this. |
| S-11 | Fixed Assets - Multiple Depreciation Methods | Only straight-line implemented. Need declining balance at minimum. |
| S-12 | FX Realized Gain/Loss | Standard multi-currency accounting. Post gain/loss journal on payment at different rate. |
| S-13 | Year-End Close Process | No year-end close. No fiscal year configuration. Fundamental accounting requirement. |

#### 4.2.2 Inventory/Stock

| # | Feature | Rationale |
|---|---|---|
| S-14 | Barcode Scanning Integration | Unleashed, Brightpearl, ERPNext all support this. Standard warehouse feature. |
| S-15 | Demand Forecasting / Auto-Reorder | Unleashed AIM module. ERPNext, Odoo have this. Automatic PO generation at reorder point. |
| S-16 | Serial Number Tracking | Flag exists but no implementation. Required for electronics, equipment, regulated industries. |
| S-17 | Expiry Date / Shelf Life Tracking | Critical for food/pharma. Unleashed, ERPNext have this. |
| S-18 | Multi-UoM | Buy in cases, sell in units. ERPNext, Odoo, Sage 200. |
| S-19 | Landed Cost Allocation | Unleashed does this automatically. Model exists but no service. |
| S-20 | Inventory Valuation Reports | Unleashed, ERPNext, Sage all have this. No report reads from costing data. |
| S-21 | Returns Management (Integrated RMA) | RMA with inventory restock + credit note + refund integration. Brightpearl, ERPNext. |
| S-22 | Movement History API | No endpoint to query stock movement history. Fundamental audit requirement. |
| S-23 | ATP with Supply/Demand Netting | Current ATP ignores open POs and open SOs. Must consider full supply/demand picture. |
| S-24 | Costing - Standard Cost Method | Only WAC and FIFO. Standard cost needed for manufacturing. |
| S-25 | Quality Inspection Workflow | QualityInspection model exists but no implementation. ERPNext, Odoo have this. |

#### 4.2.3 CRM/Sales

| # | Feature | Rationale |
|---|---|---|
| S-26 | Configurable Pipeline Stages | Stages hardcoded as strings. HubSpot, Zoho, Odoo all have admin-defined stages. |
| S-27 | Pipeline Analytics / Sales Dashboard | Win rates, conversion rates, pipeline velocity. HubSpot, Zoho CRM. |
| S-28 | Email Integration (Track/Send) | HubSpot, Zoho CRM. Email tracking per contact. Templates and sequences. |
| S-29 | Sales Forecasting | Based on pipeline stage probability. HubSpot, Zoho CRM, ERPNext. |
| S-30 | Web Form / Lead Capture | HubSpot, Zoho CRM. Embed forms to capture leads directly. |
| S-31 | POS - Stripe Terminal Integration | Schema fields exist. Brightpearl, Shopify POS have card terminal support. |
| S-32 | POS - Offline Mode | Shopify POS, Lightspeed. Process sales without internet. |
| S-33 | Purchasing API (Full REST) | No REST API. No goods receipt. No PO-to-bill conversion. |
| S-34 | Activity Bug Fix + Update Endpoint | completeActivity() does not update status field. No update endpoint. |

#### 4.2.4 HR/Payroll

| # | Feature | Rationale |
|---|---|---|
| S-35 | Employee Self-Service Portal | BambooHR, CharlieHR, Breathe HR. View payslips, request leave, update details. Table stakes for modern HR. |
| S-36 | Leave Approval Workflow | Manager approval with email notification. Calendar view. CharlieHR, Breathe HR. |
| S-37 | UK Bank Holiday Integration | Automatic working day calculation excluding bank holidays. All UK HR systems. |
| S-38 | Onboarding Workflow | New joiner checklist, document collection. BambooHR, CharlieHR. |
| S-39 | Offboarding Workflow | Leaver checklist, equipment return, access revocation. BambooHR, CharlieHR. |
| S-40 | HR Document Management | Employment contracts, right-to-work, certifications with expiry tracking. BambooHR, CharlieHR, Breathe HR. |
| S-41 | Absence Analytics (Bradford Factor) | Absence trends, trigger points. CharlieHR, Breathe HR. |
| S-42 | Organisation Chart | Visual reporting hierarchy. BambooHR, CharlieHR. |
| S-43 | Department Hierarchy with Cost Centres | No department CRUD services. Need proper hierarchy for management reporting. |

#### 4.2.5 Reporting & Platform

| # | Feature | Rationale |
|---|---|---|
| S-44 | Comparative Financial Reports | This period vs prior period/year. Every accounting software. |
| S-45 | Real-Time KPI Dashboard (Live Data) | Currently returns mock data. Odoo, ERPNext, Zoho One have live dashboards. |
| S-46 | Report Scheduler with Delivery | Email scheduled reports. Odoo, ERPNext. |
| S-47 | Event Subscriber Wiring (Critical Flows) | ~70% of subscribers are stubs. Need: invoice GL, SO reservation, POS refund reversal, procurement cycle. |
| S-48 | Workflow Enforcer Integration | Framework exists but not wired to any business operation. Needed for invoice approval, PO approval, payroll approval. |
| S-49 | RBAC - Database-Backed with Custom Roles | Hardcoded matrix. Tenants cannot create custom roles. |
| S-50 | Stripe Billing (Full Lifecycle) | No webhook handlers. Cannot process subscription events. Cannot bill customers. |
| S-51 | Session Invalidation Mechanism | Cannot force-logout compromised sessions. Only 8hr JWT expiry. |
| S-52 | Audit Logging (Login/Logout + CRUD) | Only SUPER_ADMIN and config changes audited. No business entity CRUD audit. |
| S-53 | Email Templates Library | Only 1 template (welcome). Need invoice, order, payment, approval, statement, password reset. |
| S-54 | Notification Preferences (Per-User) | Only per-tenant config. Users need individual notification preferences. |
| S-55 | Document Management (Versioning/Approval) | Attachment model is polymorphic but no version control, approval, or retention features. |

**SHOULD-HAVE Total: 55 items**

---

### 4.3 COULD-HAVE Additions (Differentiating / Nice-to-Have)

| # | Feature | Module | Rationale |
|---|---|---|---|
| C-1 | Direct Debit Collection (GoCardless) | Invoicing | Collect payments automatically. Xero, QuickBooks. |
| C-2 | Payment Portal / Self-Service | Invoicing | Customer pays from invoice email. Credit Hound PayThem, Xero Stripe. |
| C-3 | E-Invoicing Preparation (Peppol/UBL) | Invoicing | UK mandatory B2B/B2G e-invoicing from April 2029. Early preparation. |
| C-4 | Configurable Aging Buckets | Invoicing | Custom aging periods beyond 30/60/90. |
| C-5 | GL Account Hierarchy / Cost Centres | Invoicing | Parent-child GL grouping. Department-level reporting. |
| C-6 | Intercompany Eliminations | Invoicing | Multi-entity groups need consolidated reporting. |
| C-7 | Multi-Channel Inventory Sync | Inventory | Shopify, Amazon, WooCommerce stock sync. Unleashed, Brightpearl. |
| C-8 | Stock Aging Report | Inventory | Identify slow-moving and dead stock. |
| C-9 | Mobile Stock Take | Inventory | Mobile interface for physical counts. |
| C-10 | Bin/Zone Management | Inventory | Sub-location management within warehouses. |
| C-11 | Lead Scoring (AI) | CRM | AI-powered lead prioritization. HubSpot. |
| C-12 | Territory Management | CRM | Geographic assignment. Zoho CRM, Salesforce. |
| C-13 | POS Loyalty/Rewards | CRM/POS | Customer loyalty points. Shopify POS. |
| C-14 | CPQ (Configure-Price-Quote) | CRM | Full product configuration workflow. Currently 3-line stub. |
| C-15 | HubSpot Sync | CRM | Bidirectional sync. Schema exists but no implementation. |
| C-16 | Supplier Evaluation/Scorecard | Purchasing | Rate suppliers on delivery, quality, price compliance. |
| C-17 | Performance Reviews | HR | Goals, reviews, 1:1 tracking. BambooHR, CharlieHR. |
| C-18 | Expense Claims | HR | Employee expense submission and approval. CharlieHR. |
| C-19 | Time Tracking | HR | Clock in/out, timesheet approval. BambooHR. |
| C-20 | Recruitment (ATS) | HR | Job posting, applicant tracking. BambooHR, CharlieHR. |
| C-21 | Training & Development | HR | Course management, certification tracking. |
| C-22 | Custom Report Builder | Reporting | User-defined reports. Odoo Studio, ERPNext. |
| C-23 | AI Anomaly Detection | Reporting | Flag unusual transactions, missing entries. Modern ERP trend. |
| C-24 | Saga/Orchestration (Durable) | Cross-Module | Multi-step process orchestration. In-memory placeholder currently. |
| C-25 | External Integration (Xero/Sage/QB) | Cross-Module | Bidirectional sync with existing accounting packages. Infrastructure exists but no providers. |
| C-26 | Integration Marketplace | Platform | Developer portal, API docs, app store. Schema exists but empty directories. |
| C-27 | SSO (Generic SAML/OIDC) | Platform | Beyond Google/Microsoft. Generic provider support. |
| C-28 | Multi-Language (i18n) | Platform | Locale field exists but no i18n framework. |
| C-29 | Backup/DR Automation | Platform | Models exist but no service code. |
| C-30 | SIEM Export | Platform | Security event export. Schema exists but no service. |
| C-31 | AI-Powered Insights/Recommendations | All | Intelligent automation beyond current agent tools. Predictive analytics, smart suggestions. |
| C-32 | Webhook Outbound Delivery | Platform | Schema exists but no delivery system. |

**COULD-HAVE Total: 32 items**

---

### 4.4 Complete Priority Summary

| Priority | Count | Description |
|---|---|---|
| **MUST** | 33 | Compliance, data integrity, basic operability. Blocks launch if missing. |
| **SHOULD** | 55 | Competitor parity, user expectations. Significantly degrades product without these. |
| **COULD** | 32 | Differentiating features, nice-to-haves. Enhances but not required for launch. |
| **TOTAL** | **120** | Features to consider adding beyond what exists in the extraction document. |

---

### 4.5 Recommended Implementation Order

#### Phase 1: Foundation (Weeks 1-8) -- Address MUST Items M-10 through M-33

Focus on data architecture and eliminating technical debt before building features:

1. **Consolidate to single implementations** (M-18, M-28): Single GL system, eliminate file-based stores, eliminate dual implementations for every CRM entity, consolidate triple payroll to single pipeline.
2. **Fix database schema** (M-20, M-26, M-31, M-32, M-33): Employee proper columns, Item Master proper columns, LeaveRequest/LeaveType models, configurable GL codes, Customer/Supplier field completeness.
3. **Database-per-tenant + RLS** (M-10): Implement database-level tenant isolation.
4. **Security hardening** (M-11, M-12, M-13, M-14): MFA enforcement, password policy, account lockout, re-auth fix.
5. **Transaction safety** (M-15): Wrap stock movements in database transactions.
6. **Data import/export** (M-29): CSV/Excel import for all core entities. Critical for customer onboarding.

#### Phase 2: Core Features (Weeks 9-20) -- Address MUST Items M-1 through M-9, M-16, M-17, M-19

Build core features that make the system operational:

1. **Invoice PDF + Email** (M-16): First thing users need.
2. **GL auto-posting from invoices/bills** (M-19): Double-entry accounting must work.
3. **Report export** (M-17): PDF/CSV/Excel for all financial reports.
4. **Cash flow statement** (M-30): Third core financial statement.
5. **HR API + Frontend** (M-21, M-22): Make HR module usable.
6. **UK Payroll via Staffology/PayRun.io** (M-23): Third-party API for tax, NI, pension, statutory pay, RTI (covers M-3 through M-7).
7. **MTD VAT live integration** (M-1): UK legal requirement. Consider third-party MTD bridge.
8. **MTD Income Tax preparation** (M-2): Ready for April 2026 deadline.
9. **Sales order system** (M-24, M-25): Proper CRUD with quote-to-order-to-invoice flow.
10. **GDPR compliance** (M-8, M-9): Data subject requests, retention policies.

#### Phase 3: Competitive Features (Weeks 21-36) -- Address SHOULD Items

Build features that bring the product to competitive parity:

1. **Invoicing enhancements**: Recurring invoices, statements, dunning, bank rules, open banking, BACS, FX auto-rates, budget management.
2. **Inventory enhancements**: Barcode, forecasting, serial tracking, expiry, multi-UoM, landed cost, valuation reports, RMA integration, ATP enhancement.
3. **CRM enhancements**: Configurable pipelines, analytics, email integration, forecasting, web forms, POS improvements.
4. **HR enhancements**: Self-service, leave approval, bank holidays, onboarding/offboarding, document management, absence analytics, org chart.
5. **Reporting enhancements**: Comparative reports, live KPI dashboard, report scheduler, event subscriber wiring.
6. **Platform enhancements**: Database-backed RBAC, Stripe full lifecycle, audit logging, email templates, notification preferences.

#### Phase 4: Differentiation (Weeks 37+) -- Address COULD Items

Build features that differentiate Nexa from competitors, leveraging the AI-first positioning:

1. **AI-powered features**: Lead scoring, anomaly detection, intelligent recommendations, predictive analytics.
2. **Integration ecosystem**: External integrations (Xero/Sage/QB sync), marketplace, webhook delivery, SSO.
3. **Advanced modules**: CPQ, territory management, recruitment/ATS, performance reviews, training.
4. **Future compliance**: E-invoicing preparation (2029), Companies House filing (2027).

---

## Appendix A: Document Statistics from Extraction

The extraction document itself provides a comprehensive gap analysis in Section 8. The following statistics are taken directly from the document:

| Flag Type | Count |
|---|---|
| SCHEMA-GAP | 79 |
| MISSING | 140 |
| STUBBED | 30 |
| PARTIAL | 62 |
| SHORTCUT | 123 |
| GAP | 117 |
| FRONTEND-GAP | 10 |
| RECOMMEND | 115 |
| **Total flagged items** | **676** |

## Appendix B: Research Sources

The following sources informed the market research and competitor analysis in this report:

### Competitor Research
- Xero UK: MTD VAT compliance, MTD for Income Tax (April 2026 readiness), bank feeds, AI features
- Sage 50/200: UK ERP features, Companies House filing, credit control, payroll
- Odoo: Full ERP module suite, CRM, manufacturing, inventory, POS
- ERPNext: Open source ERP features, inventory, manufacturing, HR
- Zoho Books/One: UK SME accounting, CRM, HR integration
- Brightpearl: Retail ERP, inventory, order management, POS
- Unleashed: Inventory management, batch/serial tracking, AIM forecasting, landed cost
- HubSpot CRM: Pipeline management, email integration, lead scoring, analytics
- BambooHR: Employee management, self-service, performance reviews
- CharlieHR: UK-focused HR, leave management, onboarding, pension auto-enrolment
- Breathe HR: UK SME HR, absence management, Bradford Factor
- QuickBooks Online UK: MTD VAT/ITSA, payroll, bank feeds, AI insights
- Staffology API: UK payroll calculation API, RTI submissions, pension

### UK Compliance Research
- HMRC Making Tax Digital: VAT (current), Income Tax (April 2026 for >50K, April 2027 for >30K)
- UK GDPR / Data (Use and Access) Act 2025: Employee/customer data privacy requirements
- Open Banking / PSD2: AISP/PISP licensing, bank feed standards, SCA requirements
- UK Companies House: Mandatory software filing from April 2027 (iXBRL format)
- UK E-Invoicing: HMRC/DBT consultation 2025, mandatory B2B/B2G from April 2029

### Technology Research
- ERP AI features 2025-2026: Autonomous agents, predictive analytics, zero-touch accounting
- ERP workflow automation 2025-2026: Multi-tier approvals, no-code design, cross-system orchestration
- Document management integration: GDPR compliance, ERP-DMS integration, audit trails
- Credit control automation: Automated dunning, AI prioritization, multi-channel chasing, payment portals

---

*End of Extraction Completeness Review Report*
*Generated: 2026-02-03*

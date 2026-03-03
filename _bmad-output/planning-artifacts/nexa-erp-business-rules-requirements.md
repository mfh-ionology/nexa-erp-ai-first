# Nexa ERP — Business Rules & Requirements Extraction

> **Status:** COMPLETE
> **Source Project:** `nexa-erp-local-main` (current repo)
> **Generated:** 2026-02-02
> **Contradiction Review:** Complete -- 72 issues resolved (2026-02-03)
> **MUST-HAVE Review:** Complete -- 33 features added from completeness review (2026-02-03)
> **Purpose:** Complete extraction of business rules, entity definitions, status lifecycles, validations, calculations, and cross-module interactions from the existing API layer. This document serves as the foundational requirements input for building the new AI-first ERP project.

---

## Instructions for PM, Architects, and Agents

### What This Document Is

This is a **business rules reference** extracted from a working (but incomplete) ERP codebase. It captures what the system *does* and *should do*, along with flagged gaps where the implementation is incomplete, stubbed, or has shortcuts.

### How to Use This Document

1. **For PRD Creation:** Use the entity definitions, status lifecycles, and business rules as the basis for functional requirements. The "Gaps & Issues" flags indicate where the new system must improve on the original.

2. **For Architecture:** Use the cross-module interaction map (Section 7) to understand data flows and event chains. The database-per-tenant decision has already been made — design accordingly. The AI orchestration layer should subscribe to the events documented here.

3. **For Story Writing:** Each entity section contains enough detail to derive user stories. Status lifecycles map directly to user workflows. Validation rules map to acceptance criteria.

4. **For UX Design:** The "Frontend Gap" flags show where the original UI was inadequate. The new project is AI-first with conversational UI as primary and traditional forms as fallback.

### Key Decisions Already Made

- **Fresh project** — not a fork of the current codebase. Extract business logic, not code.
- **Database-per-tenant** — each client gets their own PostgreSQL database. A management database tracks tenants, billing, subscriptions, modules, users.
- **AI-first interaction paradigm** — AI is the primary interface, not a feature. See `ai-first-erp-vision-summary.md` for full vision.
- **UK payroll via API integration** — use a third-party payroll calculation engine (e.g., Staffology, PayRun.io) rather than building PAYE/NI/RTI from scratch.
- **5 core modules for first tenant:** Invoicing & Accounts, Inventory/Stock, CRM, HR/Payroll, Reporting.
- **Mobile-first** — responsive design, with future WhatsApp/Telegram channels.
- **Event-driven backbone** — every business action emits events for the AI reasoning layer.

### Flags Used in This Document

| Flag | Meaning |
|---|---|
| `[COMPLETE]` | Feature is fully implemented in current codebase, business rules are reliable |
| `[PARTIAL]` | Feature exists but is incomplete — notes explain what's missing |
| `[STUBBED]` | API endpoint exists but returns mock/hardcoded data or is not connected |
| `[MISSING]` | Feature should exist but doesn't in current codebase |
| `[SHORTCUT]` | Implementation has technical debt (e.g., `as any` casts, hardcoded values) |
| `[GAP]` | Business rule gap — the current system doesn't handle this case |
| `[SCHEMA-GAP]` | Database schema is missing fields needed for proper implementation |
| `[FRONTEND-GAP]` | Backend supports it but frontend doesn't expose it |
| `[RECOMMEND]` | Recommendation for the new project |

### Module Coverage

| # | Module | Section | Status |
|---|---|---|---|
| 1 | Invoicing & Accounts (AR, AP, GL, Banking, VAT, FA) | Section 1 | COMPLETE + MUST-HAVE additions (M-1, M-2, M-16, M-18, M-19, M-32, M-33, bank feed) |
| 2 | Inventory / Stock (Items, WMS, Quality, ATP) | Section 2 | COMPLETE + MUST-HAVE additions (M-15, M-26) |
| 3 | CRM / Sales (Leads, Contacts, Opportunities, Quotes, Orders) | Section 3 | COMPLETE + MUST-HAVE additions (M-24, M-25) |
| 4 | HR / Payroll (Employees, Leave, Payroll, Recruitment) | Section 4 | COMPLETE + MUST-HAVE additions (M-3, M-4, M-5, M-6, M-7, M-20, M-21, M-22, M-23, M-31) |
| 5 | Reporting (Financial, Operational, AI-generated) | Section 5 | COMPLETE + MUST-HAVE additions (M-17, M-30) |
| 6 | Cross-Module Interactions | Section 6 | COMPLETE + MUST-HAVE additions (M-27, M-28, M-29) |
| 7 | Management Platform (Tenants, Billing, Provisioning) | Section 7 | COMPLETE + MUST-HAVE additions (M-8, M-9, M-10, M-11, M-12, M-13, M-14) |
| 8 | Gaps & Recommendations Summary | Section 8 | COMPLETE |

### Canonical Terminology [CONTRADICTION-RESOLVED]

> This table was added during contradiction review (2026-02-03) to standardize terminology used inconsistently across the document. All sections should use the canonical terms below.

| Term Used (Canonical) | Aliases (do not use) | Meaning |
|---|---|---|
| Supplier | Vendor | Entity you purchase from |
| Bill | Supplier Invoice, Purchase Invoice | Invoice received from a supplier |
| Ageing | Aging | Time-based analysis of outstanding amounts (British spelling, consistent with UK-focused ERP) |
| Receipt (AR) | Payment (AR context) | Money received from a customer. Use "Receipt" for AR, "Payment" for AP. |
| value (CrmOpportunity) | amount | Deal value on an opportunity. Use `value`; remove `amount` alias in new project. |
| expectedCloseDate (CrmOpportunity) | closeDate | Expected close date on an opportunity. Use `expectedCloseDate`; remove `closeDate` alias in new project. |
| isService (InventoryItem) | type: "non_stock" | Boolean flag for service/non-stock items. Legacy `type` field maps: `"stock"` = `isService: false`, `"non_stock"` = `isService: true`. |
| ownerId (CRM) | ownerUserId | Assigned user on CRM entities. Standardize to `ownerId` across all CRM entities. |
| PosSale | POS receipt | POS transaction entity. Model is `PosSale`; file-level references to "receipts" are implementation artifacts. |
| Minor units (pence) | Major units (pounds) | All monetary values should be stored as minor units (pence/cents) internally. APIs should document accepted format. Fields using minor units should use a `Minor` suffix (e.g., `grossMinor`). |
| PLATFORM (tenant) | NEXA_ROOT | Special tenant for platform-level configuration. Consolidate to single `PLATFORM` tenant or dedicated `PlatformConfig` table. |
| Unique per tenant | Unique (global) | All code/identifier uniqueness constraints in a multi-tenant system must be per-tenant via `@@unique([tenantId, code])`, not globally unique. |

---

## Section 1: Invoicing & Accounts

### 1.1 Accounts Receivable (AR)

#### 1.1.1 Customer Entity

**Source:** `prisma/schema.prisma` → `Customer` model, `api/finance/ar/customers/`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | Primary key | |
| tenantId | String | Yes | From auth context | FK to Tenant | Will be removed in per-tenant DB |
| code | String | Yes | — | Unique per tenant | Customer reference code |
| name | String | Yes | — | Min 1 char, trimmed | |
| email | String | No | null | Trimmed | |
| phone | String | No | null | Trimmed | |
| address | String | No | null | Trimmed | `[SCHEMA-GAP]` Single text field — should be structured (line1, line2, city, county, postcode, country) |
| termsDays | Int | Yes (default: 30) | 30 | 0-365 | Payment terms in days [CONTRADICTION-RESOLVED: EC-3] |
| status | CustomerStatus (Enum) | Yes (default: ACTIVE) | ACTIVE | ACTIVE, INACTIVE | [CONTRADICTION-RESOLVED: EC-3] |
| currency | String | No | null | | Default currency for this customer |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Relations:** invoices (CustomerInvoice[]), creditNotes (CustomerCreditNote[]), payments (CustomerPayment[]), quotes (SalesQuote[]), orders (SalesOrder[]), posSales (PosSale[])

**Business Rules:**
- Customer code must be unique within tenant (composite unique `@@unique([tenantId, code])`) `[COMPLETE]` [CONTRADICTION-RESOLVED: EC-1 -- Section 3.10.1 incorrectly stated "Unique (global)"; per-tenant is correct for multi-tenant systems. The `[tenantId, code]` index confirms this.]
- Trimming applied to name, email, phone, address on create/update `[COMPLETE]`
- termsDays validated 0-365 `[COMPLETE]`
- Status enum: ACTIVE, INACTIVE `[COMPLETE]`
- **CRM-to-Finance Auto-Creation:** `resolveCustomerId()` in `quotes.ts` auto-creates Customer records from CrmAccount data with code pattern `CRM-{tenantId}-{accountCode}` `[COMPLETE]` [CONTRADICTION-RESOLVED: EC-9 -- this rule was documented only in Section 3.10.1 and has been added here as the canonical Customer definition.]

**API Operations:**
- `POST /api/finance/ar/customers` — Create customer `[COMPLETE]`
- `GET /api/finance/ar/customers` — List customers (paginated) `[COMPLETE]`
- `GET /api/finance/ar/customers/[id]` — Get customer detail `[COMPLETE]`
- `PATCH /api/finance/ar/customers/[id]` — Update customer `[COMPLETE]`
- `DELETE` — `[MISSING]` No delete/archive endpoint

**Gaps & Issues:**
- `[SCHEMA-GAP]` Address is a single text field. Needs structured address: line1, line2, city, county, postcode, country. Essential for invoice printing and HMRC compliance.
- `[SCHEMA-GAP]` No VAT registration number field. Required for UK VAT invoicing.
- `[SCHEMA-GAP]` No trading name (legal name vs display name).
- `[SCHEMA-GAP]` No credit limit field.
- `[SCHEMA-GAP]` No account manager / salesperson reference.
- `[SCHEMA-GAP]` No billing vs shipping address distinction.
- `[SCHEMA-GAP]` No contact person (separate from customer entity).
- `[MISSING]` No customer merge/deduplicate functionality.
- `[MISSING]` No customer statement generation.
- `[RECOMMEND]` New project should have a `CustomerContact` entity (multiple contacts per customer).

**Permissions:**
- Create/Update: `finance:create_invoice` or `finance:post_journal` `[SHORTCUT]` — should have dedicated customer permissions

---

#### 1.1.1A Customer & Supplier Schema Completeness `[MUST-HAVE -- Added from completeness review M-33]`

**Requirement Source:** Core business entity completeness -- Customer missing VAT number, structured address, credit limit. Supplier missing address, VAT number, payment terms, bank details. These are fundamental fields for any invoicing system.

**Current State in Document:** Section 1.1.1 lists 7 SCHEMA-GAP flags on Customer. Section 1.2.1 lists 8 SCHEMA-GAP flags on Supplier.

**Description:**
Customer and Supplier entities must have proper relational columns for all business-critical fields, not single text fields or missing fields.

**Customer -- Fields to Add:**

| Field | Type | Required | Notes |
|---|---|---|---|
| vatNumber | String | No | VAT registration number (required for VAT invoicing) |
| tradingName | String | No | Legal name vs display name |
| addressLine1 | String | No | Structured address |
| addressLine2 | String | No | |
| city | String | No | |
| county | String | No | |
| postcode | String | No | |
| country | String | No | Default "GB" |
| billingAddressLine1 | String | No | Separate billing address |
| billingAddressLine2 | String | No | |
| billingCity | String | No | |
| billingCounty | String | No | |
| billingPostcode | String | No | |
| billingCountry | String | No | |
| creditLimit | Decimal | No | Credit limit in base currency |
| accountManagerId | String | No | FK to User (salesperson) |
| defaultAccountCode | String | No | Default revenue account for invoicing |
| taxScheme | String | No | Standard, flat rate, reverse charge |

**Supplier -- Fields to Add:**

| Field | Type | Required | Notes |
|---|---|---|---|
| vatNumber | String | No | VAT registration number |
| addressLine1 | String | No | Structured address |
| addressLine2 | String | No | |
| city | String | No | |
| county | String | No | |
| postcode | String | No | |
| country | String | No | Default "GB" |
| termsDays | Int | No | Default 30. Payment terms |
| status | Enum | Yes | ACTIVE, INACTIVE, ON_HOLD |
| category | String | No | Supplier classification |
| bankAccountName | String | No | For payment |
| bankSortCode | String | No | UK sort code |
| bankAccountNumber | String | No | UK account number |
| bankIban | String | No | International payments |
| bankBic | String | No | SWIFT/BIC code |
| contactPerson | String | No | Primary contact name |
| defaultExpenseAccountCode | String | No | Default expense account for bills |
| createdBy | String | No | Audit trail |
| updatedBy | String | No | Audit trail |

**Business Rules:**
- VAT number format validation for UK: GB followed by 9 digits (e.g., GB123456789)
- Structured address required for invoice PDF generation
- Credit limit must be checked when creating new invoices (warn or block if limit exceeded)
- Supplier bank details required for BACS payment file generation
- Default account codes must reference valid GL accounts from tenant's Chart of Accounts

**Competitor Reference:** Xero, QuickBooks, and Sage all have structured address fields, VAT numbers, credit limits, and supplier bank details as standard.

---

#### 1.1.1B Structured Address Fields `[MUST-HAVE -- Added from completeness review, part of M-33]`

**Requirement Source:** UK compliance / data quality -- single text address fields cannot be used for proper invoice formatting, HMRC reporting, or postcode-based validation. Essential for invoice PDF generation and VAT compliance.

**Current State in Document:** Section 1.1.1 flags `[SCHEMA-GAP] Address is a single text field`.

**Description:**
All address fields across the system (Customer, Supplier, Warehouse, Store, Employee, Tenant billing) must use structured address components. This enables proper formatting on invoices, postcode validation, and integration with address lookup services.

**Business Rules:**
- All entities with addresses must use the same structured format: line1, line2, city, county, postcode, country
- Country defaults to "GB" for UK tenants
- Postcode format validation for UK: standard UK postcode regex
- Address lookup integration via API (e.g., Ideal Postcodes, Loqate) for auto-completion
- Invoice PDFs must format addresses properly using structured fields

---

#### 1.1.2 Customer Invoice Entity

**Source:** `prisma/schema.prisma` → `CustomerInvoice` model, `api/finance/ar/invoice/`, `api/finance/ar/invoices/`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | Primary key | |
| tenantId | String | Yes | From auth context | | |
| number | String | No | `INV-${Date.now()}` | Unique per tenant | `[SHORTCUT]` Timestamp-based numbering — needs configurable sequence |
| customerId | String | Yes | — | FK to Customer | Min 1 char |
| currency | String | No | "GBP" | | |
| fxRate | Decimal | No | 1 | | `[FRONTEND-GAP]` Not exposed in UI |
| subtotal | Decimal | Auto | 0 | Computed from lines | |
| taxTotal | Decimal | Auto | 0 | Computed from lines | |
| total | Decimal | Auto | 0 | subtotal + taxTotal | |
| balance | Decimal | Auto | = total | Decremented by payments/credits | |
| status | String | No | "draft" | See lifecycle below | |
| issuedAt | DateTime | No | now() | | |
| dueAt | DateTime | No | null | | Computed from customer.termsDays if not provided |
| postedAt | DateTime | No | null | | Set when approved |
| quoteId | String | No | null | FK to SalesQuote | `[FRONTEND-GAP]` Not exposed in form |
| orderId | String | No | null | FK to SalesOrder | `[FRONTEND-GAP]` Not exposed in form |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Relations:** customer, quote (SalesQuote), order (SalesOrder), lines (CustomerInvoiceLine[]), creditNotes (CustomerCreditNote[]), allocations (CustomerAllocation[]), writeOffs (CustomerWriteOff[]), payments (CustomerPayment[])

**Status Lifecycle:**
```
draft → approved → issued → paid
  │         │         │
  │         ├→ part_paid → paid
  │         │         │
  │         ├→ credited (if full credit note)
  │         │
  │         └→ written_off (if full write-off)
  │
  └→ (can edit lines only in draft)
```

**Business Rules:**
- Invoice number must be unique within tenant `[COMPLETE]`
- Invoice must have at least 1 line item `[COMPLETE]`
- Totals are computed server-side from lines, not accepted from client `[COMPLETE]`
- Balance starts at total, decremented by payments, credit notes, write-offs `[COMPLETE]`
- Lines can only be edited when status is "draft" `[COMPLETE]`
- dueAt auto-calculated from customer.termsDays if not provided `[COMPLETE]`
- Currency defaults to customer's currency, then "GBP" `[COMPLETE]`
- Tax calculation: per line `netAmount = qty * unitPrice`, `taxAmount = netAmount * taxRate` `[COMPLETE]`
- All monetary values stored as Decimal for precision `[COMPLETE]`

**Line Item Entity (CustomerInvoiceLine):**

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | | |
| tenantId | String | Yes | From auth context | | |
| invoiceId | String | Yes | — | FK to CustomerInvoice | |
| lineNo | Int | Auto | 1-based index | | |
| sku | String | No | null | | `[FRONTEND-GAP]` Not in form — should link to InventoryItem |
| description | String | Yes | — | Min 1 char | |
| qty | Int/Decimal | Yes | — | Min 1 | |
| unitPrice | Decimal | Yes | — | Non-negative | API accepts as minor units (pence), converted to major |
| taxRate | Decimal | No | 0 | Non-negative | e.g., 0.2 for 20% VAT [CONTRADICTION-RESOLVED: CR-7 -- canonical format is decimal (0.2 for 20%), NOT percentage (20). POS receipts.ts may treat taxRate as percentage in some calculations. All modules must use decimal format.] |
| netAmount | Decimal | Auto | qty * unitPrice | Computed server-side | |
| taxAmount | Decimal | Auto | netAmount * taxRate | Computed server-side | |
| totalAmount | Decimal | Auto | netAmount + taxAmount | Computed server-side | |
| taxCodeId | String | No | null | | Looked up from vatCode if provided `[FRONTEND-GAP]` |

**Gaps & Issues:**
- `[SCHEMA-GAP]` No billing address snapshot on invoice (uses customer address at query time — if customer moves, old invoices show new address)
- `[SCHEMA-GAP]` No PO reference / customer reference field
- `[SCHEMA-GAP]` No notes/memo field
- `[SCHEMA-GAP]` No discount fields (per-line or invoice-level)
- `[SCHEMA-GAP]` No account code on invoice lines (exists on credit note lines but not invoice lines — needed for revenue GL posting)
- `[SCHEMA-GAP]` No unit of measure per line
- `[SCHEMA-GAP]` No salesperson / sales rep reference
- `[SCHEMA-GAP]` No delivery address
- `[SHORTCUT]` Invoice number generation uses `Date.now()` timestamp — needs configurable auto-numbering (prefix, sequence, reset per fiscal year)
- `[SHORTCUT]` Two separate create endpoints exist (`/api/finance/ar/invoice/create` and `/api/finance/ar/invoices` POST) with slightly different schemas -- consolidate in new project [CONTRADICTION-RESOLVED: DE-1, IT-10 -- The two endpoints accept different monetary unit conventions (minor units vs major units). Standardize on minor units (pence) internally per canonical terminology.]
- `[FRONTEND-GAP]` Quick-create form only supports ONE line item
- `[FRONTEND-GAP]` No SKU/item picker on line items
- `[FRONTEND-GAP]` No VAT code selector on line items
- `[FRONTEND-GAP]` No FX rate input for multi-currency
- `[FRONTEND-GAP]` No link to quote/sales order from form
- `[FRONTEND-GAP]` Customer shown by ID, not name
- `[MISSING]` No recurring invoice support
- `[MISSING]` No invoice PDF generation
- `[MISSING]` No invoice email sending
- `[MISSING]` No invoice duplication/copy
- `[MISSING]` No batch invoicing
- `[MISSING]` No pro-forma invoice type
- `[RECOMMEND]` New project should snapshot billing address at invoice creation time
- `[RECOMMEND]` New project should support line-level discounts (% and fixed amount)
- `[RECOMMEND]` New project should have configurable number sequences per document type

**API Operations:**
- `POST /api/finance/ar/invoice/create` — Create invoice (minor units format) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-1 -- Duplicate endpoint. New project should have single endpoint `POST /api/finance/ar/invoices` with documented monetary unit convention (minor units).]
- `POST /api/finance/ar/invoices` — Create invoice (major units format) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-1 -- Canonical endpoint. Adopt minor units convention to match internal storage.]
- `GET /api/finance/ar/invoices` — List invoices (paginated, filterable by customer, status, date range, overdue) `[COMPLETE]`
- `GET /api/finance/ar/invoices/[id]` — Get invoice detail with lines `[COMPLETE]`
- `PATCH /api/finance/ar/invoices/update` — Update invoice (draft only for lines) `[COMPLETE]`
- `POST /api/finance/ar/invoice/approve` — Approve invoice `[COMPLETE]`
- `POST /api/finance/ar/invoices/[id]/issue` — Issue invoice (approved -> issued) `[COMPLETE]` [CONTRADICTION-RESOLVED: CR-9 -- API description said "draft -> issued" but lifecycle diagram shows "draft -> approved -> issued". The canonical path requires approval before issue. Direct draft->issued should not be permitted without prior approval.]
- `POST /api/finance/ar/invoice/pay` — Record payment against invoice `[COMPLETE]`
- `POST /api/finance/ar/invoices/[id]/credit` — Create credit note from invoice `[COMPLETE]`
- `POST /api/finance/ar/invoice/writeoff` — Write off invoice balance `[COMPLETE]`
- `DELETE` — `[MISSING]` No void/cancel endpoint (only write-off)

**Permissions:**
- Create: `finance:create_invoice` `[COMPLETE]`
- Approve: `finance:approve_invoice` `[COMPLETE]`
- Payment: `finance:record_payment` `[COMPLETE]`
- Read: `ui:finance_reports:view` `[COMPLETE]`

---

#### 1.1.2A Invoice PDF Generation & Email Delivery `[MUST-HAVE -- Added from completeness review M-16]`

**Requirement Source:** Core operability -- cannot issue invoices to customers without PDF generation. This is table stakes for any invoicing system. Every competitor (Xero, QuickBooks, Sage, Odoo, ERPNext, Zoho) has this.

**Current State in Document:** Section 1.1.2 lists `[MISSING] No invoice PDF generation` and `[MISSING] No invoice email sending` as gaps.

**Description:**
Generate professional PDF invoices from CustomerInvoice data and send them to customers via email. The PDF must include all legally required information for a UK VAT invoice.

**Business Rules:**
- PDF must contain all UK VAT invoice requirements: seller name/address/VRN, buyer name/address, unique invoice number, date of issue, date of supply, description of goods/services, unit price, quantity, VAT rate per line, net amount per line, total VAT, total amount
- PDF template must be configurable per tenant (logo, colour scheme, payment terms text, bank details, notes)
- Invoice must snapshot the billing address at creation time (not look up current customer address)
- Email delivery must use tenant-configured SMTP or platform email service
- Email must include the PDF as an attachment and a summary in the email body
- Must support multiple email recipients (CC/BCC)
- Track email delivery status: queued, sent, delivered, bounced, failed
- Must record `sentAt` timestamp on the invoice when email is sent
- Must support bulk email sending (send all unsent issued invoices)
- PDF must be stored and retrievable (not regenerated each time)
- Credit note PDFs must also be supported with the same template system
- Must support multi-currency display (show amounts in invoice currency)

**Expected Entities/Fields (InvoiceEmail tracking):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | |
| invoiceId | String | Yes | FK to CustomerInvoice |
| recipientEmail | String | Yes | |
| ccEmails | String[] | No | |
| status | Enum | Yes | queued, sent, delivered, bounced, failed |
| sentAt | DateTime | No | |
| pdfUrl | String | Yes | Storage path to generated PDF |
| messageId | String | No | Email provider message ID |
| errorMessage | String | No | If failed |
| createdAt | DateTime | Auto | |

**API Operations Expected:**
- `GET /api/finance/ar/invoices/[id]/pdf` -- Generate/retrieve invoice PDF
- `POST /api/finance/ar/invoices/[id]/send` -- Send invoice PDF via email
- `POST /api/finance/ar/invoices/batch-send` -- Batch send all unsent issued invoices
- `GET /api/finance/ar/invoices/[id]/email-history` -- View email delivery history
- `GET /api/finance/ar/credit-notes/[id]/pdf` -- Generate credit note PDF
- `GET /api/tenant/invoice-template` -- Get tenant invoice template settings
- `PUT /api/tenant/invoice-template` -- Update tenant invoice template settings

**UK Compliance Notes:**
- UK VAT invoices must include: supplier name and address, VAT registration number, invoice number, date, customer name and address, description of goods/services, quantity, unit price, VAT rate, net amount, VAT amount, total
- Simplified VAT invoices (under 250 GBP) have reduced requirements
- Modified VAT invoices (over 250 GBP to another VAT-registered business) need additional details

**Competitor Reference:** Xero generates branded PDF invoices with one click and sends via email with payment links. QuickBooks has customisable invoice templates. Sage allows invoice customisation with logo and branding.

---

#### 1.1.3 Customer Payment Entity

**Source:** `prisma/schema.prisma` → `CustomerPayment`, `api/finance/ar/receipts/`, `api/finance/ar/invoice/pay`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | | |
| tenantId | String | Yes | From auth context | | |
| customerId | String | Yes | — | FK to Customer | |
| invoiceId | String | No | null | FK to CustomerInvoice | Can be unallocated |
| amount | Decimal | Yes | — | Positive | API accepts minor units |
| currency | String | No | "GBP" | | |
| fxRate | Decimal | No | 1 | | |
| status | String | No | "recorded" | recorded, reversed | |
| allocatedAmount | Decimal | No | 0 | | Tracks how much is allocated to invoices |
| unallocatedAmount | Decimal | No | 0 | | amount - allocatedAmount |
| paidAt | DateTime | No | now() | | |
| method | String | Yes | — | Min 1 char | e.g., "card", "bank_transfer", "cash" |
| reference | String | No | null | | Payment reference / cheque number |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Relations:** customer, invoice (optional), allocations (CustomerAllocation[])

**Status Lifecycle:**
```
recorded → reversed (append "-REVERSED" to reference)
```

**Business Rules:**
- Payment amount must be positive `[COMPLETE]`
- Payment reduces invoice balance `[COMPLETE]`
- Invoice status updates: if balance becomes 0 → "paid", if partially paid → "part_paid" `[COMPLETE]`
- Reversal: restores invoice balance, sets payment status to "reversed" `[COMPLETE]`
- Reversal appends "-REVERSED" to reference field `[COMPLETE]`
- Allocation tracking: allocatedAmount and unallocatedAmount maintained `[COMPLETE]`
- Supports payment against specific invoice or unallocated (on-account) `[COMPLETE]`

**API Operations:**
- `POST /api/finance/ar/invoice/pay` — Pay specific invoice (minor units) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-3 -- Duplicate. Consolidate to single receipt endpoint.]
- `POST /api/finance/ar/receipts/create` — Record receipt (minor units) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-3 -- Duplicate. Consolidate to single receipt endpoint.]
- `POST /api/finance/ar/receipts` — Record receipt with multi-invoice allocation `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-3 -- Canonical receipt endpoint with flexible allocation array. IT-6: Use "receipt" terminology for AR (money received), "payment" for AP (money paid).]
- `POST /api/finance/ar/receipt/record` — Alternative receipt recording `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-3 -- Duplicate. Consolidate to single receipt endpoint.]
- `GET /api/finance/ar/receipts` — List receipts (paginated) `[COMPLETE]`
- `GET /api/finance/ar/receipts/[id]` — Get receipt detail `[COMPLETE]`
- `POST /api/finance/ar/payments/[paymentId]/reverse` — Reverse payment `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Four separate payment/receipt endpoints doing similar things — consolidate in new project
- `[MISSING]` No payment batch processing
- `[MISSING]` No bank feed auto-matching to receipts
- `[MISSING]` No direct debit / standing order support
- `[SCHEMA-GAP]` No bank account reference on payment (which bank account was it received into)
- `[RECOMMEND]` New project: single receipt endpoint with flexible allocation array

---

#### 1.1.4 Customer Credit Note Entity

**Source:** `prisma/schema.prisma` → `CustomerCreditNote`, `api/finance/ar/credit-note/`, `api/finance/ar/invoices/[id]/credit`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | | |
| tenantId | String | Yes | From auth context | | |
| customerId | String | Yes | — | FK to Customer | |
| invoiceId | String | No | null | FK to CustomerInvoice | Can be standalone or linked |
| number | String | No | `CN-${Date.now()}` or `CN-${invoiceNumber}` | Unique per tenant | `[SHORTCUT]` Needs configurable sequence |
| currency | String | No | "GBP" | | |
| fxRate | Decimal | No | 1 | | |
| subtotal | Decimal | Auto | Computed from lines | | |
| taxTotal | Decimal | Auto | Computed from lines | | |
| total | Decimal | Auto | subtotal + taxTotal | | |
| balance | Decimal | Auto | = total (standalone) or 0 (from invoice) | | |
| status | String | No | "posted" | | Created as posted immediately |
| reason | String | No | null | | |
| issuedAt | DateTime | Auto | now() | | |
| postedAt | DateTime | Auto | now() | | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Credit Note Lines:** Mirror invoice lines (tenantId, creditNoteId, lineNo, sku, description, qty, unitPrice, taxRate, netAmount, taxAmount, totalAmount, accountCode)

**Business Rules:**
- Two creation paths: (a) from existing invoice — copies all lines, sets balance to 0, reduces invoice balance `[COMPLETE]`; (b) standalone — custom lines, balance = total `[COMPLETE]`
- When created from invoice: creates CustomerAllocation linking credit note to invoice `[COMPLETE]`
- If credit note fully covers invoice balance → invoice status becomes "credited" `[COMPLETE]`
- Credit note lines include accountCode (unlike invoice lines) `[COMPLETE]`

**API Operations:**
- `POST /api/finance/ar/invoices/[id]/credit` — Create credit note from invoice `[COMPLETE]`
- `POST /api/finance/ar/credit-note/create` — Create standalone credit note `[COMPLETE]`

**Gaps & Issues:**
- `[GAP]` No credit note approval workflow — created as "posted" immediately
- `[MISSING]` No credit note void/cancel
- `[SCHEMA-GAP]` Invoice lines don't have accountCode but credit note lines do — inconsistent

---

#### 1.1.5 Customer Write-Off Entity

**Source:** `prisma/schema.prisma` → `CustomerWriteOff`, `api/finance/ar/invoice/writeoff`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | | |
| tenantId | String | Yes | From auth context | | |
| invoiceId | String | Yes | — | FK to CustomerInvoice | |
| amount | Decimal | Yes | — | Positive, capped at invoice balance | |
| reason | String | No | "write_off" | | |
| createdBy | String | Auto | From auth context (userId) | | |
| createdAt | DateTime | Auto | now() | | |

**Business Rules:**
- Write-off amount capped at remaining invoice balance `[COMPLETE]`
- Creates GL journal entry: debit write-off expense account, credit AR control account `[COMPLETE]`
- If write-off covers full balance → invoice status becomes "written_off" `[COMPLETE]`
- Journal entry memo: "AR write-off", docRef: `AR:${invoiceNumber}` `[COMPLETE]`

**Gaps & Issues:**
- `[GAP]` Write-off GL accounts appear to be hardcoded — should be configurable per tenant
- `[MISSING]` No write-off reversal
- `[MISSING]` No write-off approval workflow (may need manager approval above threshold)

---

#### 1.1.6 Customer Allocation Entity

**Source:** `prisma/schema.prisma` → `CustomerAllocation`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | | |
| tenantId | String | Yes | From auth context | | |
| invoiceId | String | Yes | — | FK to CustomerInvoice | |
| paymentId | String | No | null | FK to CustomerPayment | |
| creditNoteId | String | No | null | FK to CustomerCreditNote | |
| amount | Decimal | Yes | — | | |
| reference | String | No | null | | e.g., `CN-${number}` |
| createdAt | DateTime | Auto | now() | | |

**Business Rules:**
- Links payments or credit notes to invoices `[COMPLETE]`
- One of paymentId or creditNoteId should be set (not both, not neither) `[GAP]` — not validated
- Amount reduces the invoice balance `[COMPLETE]`

---

#### 1.1.7 AR Aging

**Source:** `api/finance/ar/aging/`

**Business Rules:**
- Calculates aged balances across standard buckets: current, 1-30, 31-60, 61-90, 91+ days `[COMPLETE]` [CONTRADICTION-RESOLVED: CR-8 -- Two naming conventions existed: "current, 1-30, 31-60, 61-90, 91+" (ageing service) vs "0-30, 31-60, 61-90, 91+" (report dispatcher). Canonical: "current" for the first bucket (not "0-30"). JSON keys must use consistent naming.]
- Based on dueAt date vs current date `[COMPLETE]`
- Groups by customer `[COMPLETE]`

**Gaps & Issues:**
- `[MISSING]` No configurable aging buckets
- `[MISSING]` No aged debt letters / dunning automation
- `[MISSING]` No interest calculation on overdue amounts

---

#### 1.1.8 Credit Control & Debt Chasing `[MUST-HAVE -- Added from completeness review, part of M-33 credit limit + market expectation]`

**Requirement Source:** Market standard for UK SME accounting -- automated payment reminders and credit control are expected features. While not strictly regulatory, inability to chase overdue invoices makes the invoicing module incomplete for real business use.

**Description:**
Automated and manual credit control features to chase overdue invoices, enforce credit limits, and reduce debtor days.

**Business Rules:**
- Credit limit per customer (set on Customer entity) -- warn or block new invoices when outstanding balance exceeds limit
- Overdue invoice identification based on dueAt vs current date
- Automated dunning sequences: configurable multi-step reminders (e.g., 7 days overdue, 14 days, 30 days, 60 days)
- Email templates for each dunning step (friendly reminder, formal notice, final demand)
- Customer statement generation (monthly or on-demand) showing all outstanding invoices
- Statement PDF generation and email delivery
- Payment promise tracking (record expected payment dates from customer communication)
- Escalation rules (e.g., after 90 days overdue, flag for legal action)
- Credit hold: ability to put a customer on credit hold, blocking new orders/invoices
- Dashboard showing total overdue amount, aging breakdown, and action items

**API Operations Expected:**
- `GET /api/finance/ar/credit-control/overdue` -- List overdue invoices with aging
- `POST /api/finance/ar/credit-control/send-reminder/[invoiceId]` -- Send payment reminder
- `POST /api/finance/ar/credit-control/batch-chase` -- Send reminders for all overdue invoices
- `GET /api/finance/ar/customers/[id]/statement` -- Generate customer statement
- `POST /api/finance/ar/customers/[id]/statement/send` -- Email customer statement
- `POST /api/finance/ar/customers/[id]/credit-hold` -- Place customer on credit hold
- `DELETE /api/finance/ar/customers/[id]/credit-hold` -- Release credit hold

**Competitor Reference:** Sage has built-in credit control. Xero integrates with Chaser for automated credit control. Credit Hound offers multi-channel chasing integrated with Sage/Xero.

---

### 1.2 Accounts Payable (AP)

#### 1.2.1 Supplier Entity

**Source:** `prisma/schema.prisma` → `Supplier`, `api/finance/ap/suppliers/`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| code | String | Yes | — | Unique | Case-insensitive |
| name | String | Yes | — | Trimmed, non-empty | |
| email | String | No | null | Trimmed | |
| phone | String | No | null | Trimmed | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Relations:** purchaseOrders (PurchaseOrder[]), bills (SupplierBill[]), payments (SupplierPayment[]), creditNotes (SupplierCreditNote[]), paymentRunLines (SupplierPaymentRunLine[]) [CONTRADICTION-RESOLVED: EC-4 -- relations merged from Section 3.12.1]

**Business Rules:**
- Code unique per tenant (composite unique `@@unique([tenantId, code])`), trimmed, case-insensitive `[COMPLETE]` [CONTRADICTION-RESOLVED: EC-2 -- Section 3.12.1 incorrectly stated "Unique (global)"; per-tenant is correct.]
- Name required, trimmed `[COMPLETE]`
- Enable/disable via separate endpoints (no status field in schema) `[SHORTCUT]`

**API Operations:**
- `POST /api/finance/ap/suppliers/` — Create `[COMPLETE]`
- `GET /api/finance/ap/suppliers/` — List (paginated) `[COMPLETE]`
- `GET /api/finance/ap/suppliers/[id]` — Get detail `[COMPLETE]`
- `GET /api/finance/ap/suppliers/search` — Search `[COMPLETE]`
- `POST /api/finance/ap/suppliers/update` — Update `[COMPLETE]`
- `POST /api/finance/ap/suppliers/[supplierId]/enable` — Enable `[COMPLETE]`
- `POST /api/finance/ap/suppliers/[supplierId]/disable` — Disable `[COMPLETE]`
- `POST /api/finance/ap/suppliers/delete` — Delete `[COMPLETE]`

**Gaps & Issues:**
- `[SCHEMA-GAP]` No status field — enable/disable tracked outside schema
- `[SCHEMA-GAP]` No address fields (single or structured)
- `[SCHEMA-GAP]` No VAT registration number
- `[SCHEMA-GAP]` No payment terms field (termsDays)
- `[SCHEMA-GAP]` No supplier category/classification
- `[SCHEMA-GAP]` No audit trail fields (createdBy, updatedBy)
- `[SCHEMA-GAP]` No bank details for payment (sort code, account number)
- `[SCHEMA-GAP]` No contact person
- `[SHORTCUT]` Uses `finance:post_journal` permission — should have dedicated supplier permissions

---

#### 1.2.2 Purchase Order Entity

**Source:** `prisma/schema.prisma` → `PurchaseOrder`, `PoLine`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| supplierId | String | Yes | — | FK to Supplier | |
| tenantId | String | Yes | — | Indexed | |
| number | String | Yes | — | Unique | PO number |
| currency | String | Yes | "GBP" | | |
| status | PoStatus (Enum) | Yes | draft | draft, approved, sent, received, closed, cancelled | |
| orderDate | DateTime | Yes | now() | | |
| expectedAt | DateTime | No | null | | Expected delivery |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**PO Line Item (PoLine):**

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK |
| poId | String | Yes | — | FK to PurchaseOrder |
| tenantId | String | Yes | — | Indexed |
| lineNo | Int | Yes | — | Unique per PO |
| sku | String | Yes | — | Product SKU |
| qty | Decimal | Yes | — | |
| price | Decimal | Yes | — | Unit price |
| createdAt | DateTime | Auto | now() | |
| updatedAt | DateTime | Auto | Auto | |

**Status Lifecycle:**
```
draft → approved → sent → received → closed
  └─────────────────────────────────→ cancelled (from any state)
```

**API Operations:**
- `POST /api/purchasing/purchase-orders/` — Create PO `[COMPLETE]`
- `GET /api/purchasing/purchase-orders/` — List POs `[COMPLETE]`
- `GET /api/purchasing/purchase-orders/[poId]` — Get PO detail `[COMPLETE]`
- `POST /api/purchasing/po/approve/` — Approve PO `[COMPLETE]`
- `POST /api/purchasing/purchase-orders/[poId]/issue` — Issue PO `[COMPLETE]`
- `POST /api/purchasing/purchase-orders/[poId]/close` — Close PO `[COMPLETE]`
- `POST /api/purchasing/purchase-orders/[poId]/cancel` — Cancel PO `[COMPLETE]`
- `POST /api/purchasing/bill/from-po` — Create bill from PO `[COMPLETE]`
- `POST /api/purchasing/grn/post` — Post GRN `[COMPLETE]`

**Gaps & Issues:**
- `[SCHEMA-GAP]` No received qty vs ordered qty tracking on lines
- `[SCHEMA-GAP]` No tax/duty handling on PO lines
- `[SCHEMA-GAP]` No unit of measure field
- `[SCHEMA-GAP]` No delivery address
- `[SCHEMA-GAP]` No payment terms
- `[MISSING]` No validation that lines exist before approval
- `[MISSING]` No three-way matching (PO vs GRN vs Invoice)
- `[SHORTCUT]` Bill from PO uses hardcoded number `BILL-${Date.now()}`
- `[SHORTCUT]` Bill from PO doesn't create line items — data loss risk

---

#### 1.2.3 Supplier Bill Entity

**Source:** `prisma/schema.prisma` → `SupplierBill`, `SupplierBillLine`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | Indexed | |
| supplierId | String | Yes | — | FK to Supplier | |
| billNumber | String | Yes | — | Unique per tenant | Supplier's invoice number |
| billDate | DateTime | No | null | | Date on supplier's invoice |
| dueDate | DateTime | No | null | | Default: billDate + 30 days |
| currency | String | Yes | "GBP" | 3-char ISO | |
| fxRate | Decimal | Yes | 1 | | |
| subtotal | Decimal | Yes | 0 | Computed from lines | |
| taxTotal | Decimal | Yes | 0 | Computed from lines | |
| total | Decimal | Yes | 0 | subtotal + taxTotal | |
| balance | Decimal | Yes | 0 | total - payments/credits | |
| status | String | Yes | "draft" | See lifecycle below | `[SHORTCUT]` Should be enum [CONTRADICTION-RESOLVED: EC-14 -- PurchaseOrder uses PoStatus Enum but SupplierBill uses plain String. All status fields must use enums in new project for database-level validation.] |
| postedAt | DateTime | No | null | Set on issue | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Bill Line Item (SupplierBillLine):**

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK |
| tenantId | String | Yes | — | |
| billId | String | Yes | — | FK to SupplierBill |
| lineNo | Int | Yes | — | Unique per bill |
| description | String | Yes | — | Min 1 char |
| accountCode | String | No | null | GL account for expense |
| qty | Decimal | Yes | — | Positive |
| unitPrice | Decimal | Yes | — | Non-negative |
| taxRate | Decimal | Yes | 0 | Non-negative |
| netAmount | Decimal | Yes | — | qty * unitPrice |
| taxAmount | Decimal | Yes | 0 | netAmount * taxRate |
| totalAmount | Decimal | Yes | — | netAmount + taxAmount |

**Status Lifecycle:**
```
draft → issued → part_paid → paid
                → credited (if full credit)
                → written_off (if full write-off)
```

**Business Rules:**
- Bill number unique per tenant `[COMPLETE]`
- Minimum 1 line item `[COMPLETE]`
- Line qty > 0, unitPrice >= 0, taxRate >= 0 `[COMPLETE]`
- Totals computed server-side from lines `[COMPLETE]`
- Balance initialized to total `[COMPLETE]`
- Default due date: billDate + 30 days `[COMPLETE]`
- Issue checks period close status (AP ledger) `[COMPLETE]`
- Issue triggers GL posting: debit EXP, debit VAT_IN (if tax), credit AP `[COMPLETE]`
- Can only edit lines in draft status `[COMPLETE]`

**API Operations:**
- `POST /api/finance/ap/bills/` — Create bill with lines `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-2 -- Canonical endpoint for bill creation.]
- `POST /api/finance/ap/bill/create` — Create bill (legacy, simple format) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-2 -- Duplicate endpoint. Consolidate to `POST /api/finance/ap/bills/` in new project.]
- `GET /api/finance/ap/bills/` — List bills (paginated) `[COMPLETE]`
- `GET /api/finance/ap/bills/[billId]` — Get bill detail `[COMPLETE]`
- `PATCH /api/finance/ap/bills/update` — Update draft bill `[COMPLETE]`
- `POST /api/finance/ap/bills/[billId]/issue` — Issue/post bill `[COMPLETE]`
- `POST /api/finance/ap/bills/[billId]/credit` — Create credit note `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Duplicate create endpoints (bill/ vs bills/) with different schemas [CONTRADICTION-RESOLVED: DE-2 -- Canonical: `/api/finance/ap/bills/`]
- `[SHORTCUT]` Status is String not Enum — allows invalid states
- `[SHORTCUT]` GL account codes hardcoded (EXP, VAT_IN, AP)
- `[SCHEMA-GAP]` No PO reference on bill (cannot trace bill to PO)
- `[SCHEMA-GAP]` accountCode optional on lines — may cause GL issues
- `[MISSING]` No partial credit notes (always full bill amount)
- `[MISSING]` No reason/description field on credit notes

---

#### 1.2.4 Supplier Payment Entity

**Source:** `prisma/schema.prisma` → `SupplierPayment`, `SupplierAllocation`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| supplierId | String | Yes | — | FK to Supplier | |
| billId | String | No | null | FK to SupplierBill | Optional direct link |
| bankAccountId | String | No | null | | Bank account used |
| paymentDate | DateTime | Yes | now() | | |
| currency | String | Yes | "GBP" | | |
| fxRate | Decimal | Yes | 1 | | |
| amount | Decimal | Yes | — | Positive | |
| allocatedAmount | Decimal | Yes | 0 | | |
| unallocatedAmount | Decimal | Yes | 0 | | |
| status | String | Yes | "recorded" | recorded, reversed | `[SHORTCUT]` Should be enum |
| reference | String | No | null | | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Business Rules:**
- Amount must be positive `[COMPLETE]`
- Auto-allocates to oldest due posted bills (by dueDate, then billDate) `[COMPLETE]`
- Can provide explicit allocations array `[COMPLETE]`
- Allocated bills transition: issued → part_paid → paid `[COMPLETE]`
- Reversal: restores bill balance, reverses GL, appends "-REVERSED" to reference `[COMPLETE]`
- Period close check on recording and reversal `[COMPLETE]`
- GL posting: debit AP, credit BANK `[COMPLETE]`

**Payment Run Entity (SupplierPaymentRun):**
- Suggest payment run from bills due up to cutoff date `[COMPLETE]`
- Group by supplier and create payment per supplier `[COMPLETE]`
- Status: draft → proposed → executed `[PARTIAL]`
- `[MISSING]` No approval workflow on payment runs
- `[MISSING]` No BACS file generation

**API Operations:**
- `POST /api/finance/ap/payment/record` — Record payment `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-4 -- Duplicate. Consolidate to single endpoint `POST /api/finance/ap/payments` in new project.]
- `POST /api/finance/ap/payments/create` — Record payment (alt) `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-4 -- Duplicate. Consolidate to single endpoint.]
- `GET /api/finance/ap/payments/` — List payments `[COMPLETE]`
- `GET /api/finance/ap/payments/[paymentId]` — Get detail `[COMPLETE]`
- `POST /api/finance/ap/payments/[paymentId]/reverse` — Reverse `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Duplicate payment endpoints (payment/record vs payments/create) [CONTRADICTION-RESOLVED: DE-4 -- Canonical: `/api/finance/ap/payments`]
- `[SHORTCUT]` `as any` casts for allocations
- `[MISSING]` No payment method tracking (BACS, cheque, card)
- `[MISSING]` No bank account reconciliation link
- `[SCHEMA-GAP]` No cleared date for bank reconciliation
- `[MISSING]` No batch payment export (BACS file)

---

#### 1.2.5 AP Aging

**Source:** `api/finance/ap/aging/` (also `ageing/` -- duplicate spelling) [CONTRADICTION-RESOLVED: DE-6, IT-1 -- Standardize on "ageing" (British spelling) since the system is UK-focused. Canonical path: `/api/finance/ap/ageing/`. Remove `/api/finance/ap/aging/` variant in new project.]

**Business Rules:**
- Standard buckets: Current, 1-30, 31-60, 61-90, 90+ days `[COMPLETE]`
- Based on dueDate vs current date `[COMPLETE]`
- Groups by supplier `[COMPLETE]`

**Gaps:** Same as AR aging — no configurable buckets, no dunning.

---

#### 1.2.6 AP Cross-Cutting Issues

**Hardcoded GL Account Codes:**

| Code | Type | Usage |
|---|---|---|
| EXP | expense | Bill posting debit |
| VAT_IN | asset | Tax input debit/credit |
| AP | liability | Bill posting credit, payment debit |
| BANK | asset | Payment credit |
| AP_WOFF | expense | Write-off debit |

`[SHORTCUT]` All hardcoded strings — need to be configurable per tenant via Chart of Accounts.

**Duplicate API Route Patterns:**
- `/api/finance/ap/bills/` vs `/api/finance/ap/bill/` (plural vs singular) [CONTRADICTION-RESOLVED: DE-2 -- Canonical: `/api/finance/ap/bills/` (plural)]
- `/api/finance/ap/payment/record` vs `/api/finance/ap/payments/create` [CONTRADICTION-RESOLVED: DE-4 -- Canonical: `/api/finance/ap/payments` (plural, RESTful)]
- `/api/finance/ap/ageing/` vs `/api/finance/ap/aging/` (spelling variants) [CONTRADICTION-RESOLVED: DE-6, IT-1 -- Canonical: `/api/finance/ap/ageing/` (British spelling)]

`[RECOMMEND]` New project: single endpoint per operation, consistent naming.

---

### 1.3 General Ledger (GL)

#### 1.3.1 GL Account Entity (Modern)

**Source:** `prisma/schema.prisma` → `GlAccount`, `api/finance/gl/accounts/`

**Note:** The system has TWO ledger systems -- the modern GL (GlAccount, GlJournalEntry, GlJournalLine) and a legacy ledger (Account, JournalEntry, JournalLine). The modern GL is used by all financial modules. [CONTRADICTION-RESOLVED: DE-12 -- The modern GL (`POST /api/finance/gl/post`) is the canonical GL system. The legacy GL (JournalLine/Account) is used by some financial reports (P&L, Balance Sheet via SC-88/SC-89) but should be deprecated. New project must use a single unified GL system.]

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| code | String | Yes | — | Unique per tenant | Normalized: uppercase, alphanumeric, underscores |
| name | String | Yes | — | | |
| type | GlAccountType (Enum) | Yes | — | ASSET, LIABILITY, EQUITY, INCOME, EXPENSE | |
| isActive | Boolean | Yes | true | | Can deactivate only if no posted activity |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Business Rules:**
- Code normalized: trimmed, uppercase, non-alphanumeric → underscore `[COMPLETE]`
- Code + tenant unique `[COMPLETE]`
- Can only deactivate if no posted journal lines reference it `[COMPLETE]`
- Accounts auto-created by `ensureAccounts()` during GL posting if not found `[COMPLETE]`

**API Operations:**
- `GET /api/finance/gl/accounts` — List (paginated, sorted by code) `[COMPLETE]`
- `POST /api/finance/gl/accounts` — Create `[COMPLETE]`
- `GET /api/finance/gl/accounts/[id]` — Get detail `[COMPLETE]`
- `PATCH /api/finance/gl/accounts/[id]` — Update (name, type, isActive) `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Type cast: `.toUpperCase() as any` when creating/updating
- `[MISSING]` No account hierarchy (parent/child grouping)
- `[MISSING]` No cost center / department dimension
- `[MISSING]` No posting restrictions (leaf-only posting)
- `[SCHEMA-GAP]` No opening balance field
- `[SCHEMA-GAP]` No account description field

---

#### 1.3.1A Configurable GL Account Codes `[MUST-HAVE -- Added from completeness review M-32]`

**Requirement Source:** Data integrity -- all GL account codes are currently hardcoded as strings throughout the system (EXP, AP, BANK, COGS, INV, etc.). Must be configurable per tenant via Chart of Accounts.

**Current State in Document:** Section 1.2.6 documents hardcoded AP codes. Section 1.6.1 documents hardcoded FA codes. Every module uses hardcoded GL code strings.

**Description:**
Each tenant must have a configurable Chart of Accounts where GL account codes are defined. All sub-ledger postings must reference GL accounts from this chart, not hardcoded strings. The system should seed accounts from a COA template at tenant setup.

**Business Rules:**
- Each tenant gets a Chart of Accounts seeded from a template during tenant setup
- GL account mappings for each module (AR control, AP control, bank, VAT input, VAT output, revenue, COGS, etc.) must be configurable per tenant
- Default mappings provided by COA template but overridable
- Module posting rules must look up GL accounts from tenant config, not hardcoded strings
- Validation: posting accounts must be leaf-level (not parent accounts)
- Validation: posting accounts must be active
- Validation: posting accounts must be of the correct type (e.g., cannot post revenue to an asset account)

**Expected Entities/Fields (GL Account Mapping):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | |
| mappingKey | String | Yes | e.g., "ar_control", "ap_control", "vat_output", "revenue_default" |
| accountId | String | Yes | FK to GlAccount |
| module | String | Yes | e.g., "ar", "ap", "inventory", "payroll", "fa" |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |

**API Operations Expected:**
- `GET /api/finance/gl/mappings` -- Get all GL account mappings for tenant
- `PUT /api/finance/gl/mappings` -- Update GL account mappings
- `GET /api/finance/gl/mappings/[module]` -- Get mappings for a specific module

---

#### 1.3.2 GL Journal Entry Entity

**Source:** `prisma/schema.prisma` → `GlJournalEntry`, `GlJournalLine`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| entryNo | Int | Auto | Next sequence per tenant | Unique per tenant | Auto-incremented |
| date | DateTime | Yes | — | Indexed | Transaction date |
| memo | String | No | null | | |
| status | GlJournalStatus (Enum) | Yes | DRAFT | DRAFT, POSTED | |
| postedAt | DateTime | No | null | | Set when posted |
| createdByUserId | String | Yes | From auth context | | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**GL Journal Line (GlJournalLine):**

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK |
| tenantId | String | Yes | From auth context | |
| journalEntryId | String | Yes | — | FK, cascade delete |
| accountId | String | Yes | — | FK to GlAccount |
| description | String | No | null | |
| debit | Decimal | Yes | 0 | Non-negative |
| credit | Decimal | Yes | 0 | Non-negative |

**Status Lifecycle:**
```
DRAFT → POSTED (immutable, cannot edit or delete)
```

**Business Rules — Double-Entry Validation:** `[COMPLETE]`
- Minimum 2 lines required
- No negative amounts (debit or credit)
- Cannot have both debit AND credit > 0 on same line
- Must have either debit OR credit > 0 (not both zero)
- Total debits MUST equal total credits (uses Prisma.Decimal for precision)
- All referenced accounts must exist and be active

**Business Rules — Posting:**
- Period must be open for the journal date `[COMPLETE]`
- Status changes to POSTED, postedAt set to now() `[COMPLETE]`
- Idempotent: if already posted, returns existing `[COMPLETE]`
- Posted journals are immutable `[COMPLETE]`

**Business Rules — Reversal:**
- Creates new journal entry swapping debit/credit on all lines `[COMPLETE]`
- docRef format: `REV:${originalId}` `[COMPLETE]`

**Cross-Module GL Posting Triggers:**

| Trigger | DocRef Format | Ledger Scope |
|---|---|---|
| Supplier bill issued | `AP:${billNumber}` | ap |
| Supplier payment | `AP-PAY:${paymentId}` | ap |
| Customer invoice posted | `AR:${invoiceNumber}` | ar |
| Customer payment | `AR-PAY:${paymentId}` | ar |
| Asset acquisition | `ASSET:${assetId}` | gl |
| Asset depreciation | `ASSET-DEP:${assetId}` | gl |
| Asset disposal | `ASSET-DISP:${assetId}` | gl |
| FX revaluation | `FX:${dateKey}` | gl |
| AR write-off | `AR:${invoiceNumber}` | ar |

**API Operations:**
- `GET /api/finance/gl/journals` — List (paginated, filterable by status) `[COMPLETE]`
- `POST /api/finance/gl/journals` — Create draft `[COMPLETE]`
- `GET /api/finance/gl/journals/[id]` — Get detail with lines `[COMPLETE]`
- `PATCH /api/finance/gl/journals/[id]` — Update draft (memo, date, lines) `[COMPLETE]`
- `POST /api/finance/gl/journals/[id]/post` — Post journal `[COMPLETE]`
- `POST /api/finance/gl/post` — Direct GL posting (used by other modules) `[COMPLETE]`
- `POST /api/finance/gl/reverse` — Reverse posted journal `[COMPLETE]`
- `GET /api/finance/gl/trial-balance` — Trial balance report `[COMPLETE]`

**Gaps & Issues:**
- `[GAP]` TWO period close mechanisms coexist: `PeriodClose` table (granular per-ledger flags) AND `TenantConfig.finance.close.lockedThrough` (simple date). No documented precedence. [CONTRADICTION-RESOLVED: CR-5, DC-6 -- PeriodClose table is canonical. See Section 1.7.]
- `[SHORTCUT]` Decimal precision: some places use `Number()` conversion losing precision
- `[SHORTCUT]` `as any` casts for composite unique key queries
- `[MISSING]` No DELETE endpoint for draft journals
- `[MISSING]` No concurrent posting protection (optimistic locking)
- `[MISSING]` No account hierarchy / roll-up reports
- `[MISSING]` No recurring journal templates
- `[MISSING]` No budget vs actual variance
- `[MISSING]` No intercompany eliminations

**Permissions:**
- Read: `ui:finance_reports:view` `[COMPLETE]`
- All writes: `finance:post_journal` `[COMPLETE]` — single permission for all GL operations

---

#### 1.3.3 Legacy Ledger (Account, JournalEntry, JournalLine)

**Status:** `[SHORTCUT]` — Legacy system, still in schema but should be deprecated.

**Critical Issue:** The `Account` model conflates OAuth provider accounts with financial accounts (has fields like `refresh_token`, `access_token`, `provider` alongside `code`, `name`, and journal line relations).

`[RECOMMEND]` New project: single GL system (modern), no legacy models, separate OAuth from financial accounts.

---

#### 1.3.3A Single Unified General Ledger `[MUST-HAVE -- Added from completeness review M-18]`

**Requirement Source:** Data integrity -- two parallel GL systems (legacy Account/JournalEntry/JournalLine and modern GlAccount/GlJournalEntry/GlJournalLine) create risk of double-posting and data inconsistency. Must consolidate to one before building.

**Current State in Document:** Section 1.3.3 documents the legacy ledger and recommends deprecation. Section 1.3.1-1.3.2 document the modern GL. Both are actively used by different parts of the system.

**Description:**
The new project MUST have a single GL system. All financial reports, all sub-ledger postings (AR, AP, FA, Payroll, Inventory), and all manual journal entries must use the same GL account and journal entry models.

**Business Rules:**
- Single GlAccount model with proper hierarchy (parent/child accounts for roll-up reporting)
- Single GlJournalEntry model used by all modules
- All sub-ledger postings (AR invoices, AP bills, payroll, inventory COGS, asset depreciation) must create journal entries in the same GL
- The legacy Account model (which conflates OAuth accounts with financial accounts) must not exist in the new project
- Auto-posting from sub-ledgers must be event-driven and auditable
- Every posted transaction must have a balanced journal entry (debits = credits)
- No manual GL code strings anywhere in the codebase -- all GL codes resolved via Chart of Accounts

**Competitor Reference:** Every accounting system (Xero, QuickBooks, Sage, Odoo, ERPNext) uses a single unified general ledger.

---

#### 1.3.3B GL Auto-Posting from Sub-Ledgers `[MUST-HAVE -- Added from completeness review M-19]`

**Requirement Source:** Core operability / accounting fundamentals -- invoices and bills do not currently create GL journal entries. Only payroll does. Double-entry accounting is a fundamental requirement.

**Current State in Document:** Section 6.12 summary confirms: `Invoice -> GL journal auto-posting [MISSING] -- Only payroll creates GL entries; invoices/bills do not`.

**Description:**
When a customer invoice is posted (approved), the system must automatically create a GL journal entry. Same for supplier bills, payments, credit notes, and write-offs. This is fundamental double-entry bookkeeping.

**Business Rules:**
- **Customer Invoice Posted:** Debit Accounts Receivable (AR), Credit Revenue per line (using line-level account codes)
- **Customer Invoice with VAT:** Additionally Debit AR, Credit VAT Output (per line tax amount)
- **Customer Payment Received:** Debit Bank, Credit AR
- **Customer Credit Note:** Debit Revenue, Credit AR (reverse of invoice)
- **Supplier Bill Posted:** Debit Expense per line (using line-level account codes), Credit Accounts Payable (AP)
- **Supplier Bill with VAT:** Additionally Debit VAT Input, Credit AP
- **Supplier Payment Made:** Debit AP, Credit Bank
- **Write-Off:** Debit Bad Debt Expense, Credit AR
- All GL account codes must be resolved from the tenant's Chart of Accounts (not hardcoded strings)
- GL posting must happen within the same database transaction as the status change
- DocRef format must identify the source document (e.g., `AR:INV-001`, `AP:BILL-001`)
- Period must be open for the posting date

**API Operations Expected:**
- No new API endpoints needed -- GL posting is triggered automatically via event subscribers when invoices/bills are posted, payments recorded, etc.

**Competitor Reference:** This is standard in every accounting system. Xero, QuickBooks, Sage, Odoo, ERPNext all create GL entries automatically when transactions are posted.

---

#### 1.3.4 COA Templates

**Source:** `prisma/schema.prisma` → `CoaTemplate`, `CoaTemplateLine`

Templates for seeding chart of accounts per tenant. Schema exists but:
- `[MISSING]` No API endpoints for template CRUD
- `[MISSING]` No UI for template management
- `[SCHEMA-GAP]` CoaTemplateLine.type is String, not GlAccountType enum
- `[SCHEMA-GAP]` No unique constraint on (templateId, code) — allows duplicates

`[RECOMMEND]` New project: COA templates seeded on tenant provisioning, with CRUD API for template management.

---

### 1.4 Banking

#### 1.4.1 Bank Account Entity

**Source:** `prisma/schema.prisma` → `BankAccount`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| code | String | Yes | — | Unique per tenant | |
| name | String | Yes | — | | |
| currency | String | No | "GBP" | 3-char ISO | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Business Rules:**
- Code normalization: uppercase, trimmed `[COMPLETE]`
- Currency: 3-letter uppercase ISO `[COMPLETE]`

**API Operations:**
- `POST /api/banking/accounts` — Create `[COMPLETE]`
- `GET /api/banking/accounts` — List `[COMPLETE]`

**Gaps & Issues:**
- `[SCHEMA-GAP]` No sort code / account number fields
- `[SCHEMA-GAP]` No IBAN / BIC fields
- `[SCHEMA-GAP]` No GL account link (bank account → GL account mapping)
- `[SCHEMA-GAP]` No opening balance
- `[MISSING]` No update/delete endpoints

---

#### 1.4.2 Bank Statement Line Entity

**Source:** `prisma/schema.prisma` → `BankStatementLine`

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK |
| tenantId | String | Yes | — | |
| bankAccountId | String | Yes | — | FK to BankAccount |
| date | DateTime | Yes | — | Indexed |
| description | String | Yes | — | |
| amount | Decimal | Yes | — | Positive or negative |
| reference | String | No | null | |
| reconciled | Boolean | No | false | |

**Import:** CSV or JSON array `[COMPLETE]`
**CSV Format:** date, description, amount, [reference] — header auto-detected `[COMPLETE]`

**Reconciliation:**
- Manual: mark individual transactions reconciled, optionally link to CustomerPayment or SupplierPayment `[COMPLETE]`
- Auto: `autoMatchStatements()` — returns matched/unmatched counts `[PARTIAL]`
- Unreconcile: toggle back to unreconciled `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` No duplicate detection on import
- `[SHORTCUT]` Reconciliation mappings stored in TenantConfig JSON, not relational
- `[SCHEMA-GAP]` No running balance field
- `[MISSING]` No multi-match (one payment → multiple statement lines)
- `[MISSING]` No bank rules for auto-categorization
- `[MISSING]` No balance assertion (statement balance vs system balance)

---

#### 1.4.3 Bank Reconciliation Entity

**Source:** `prisma/schema.prisma` → `BankReconciliation`

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK |
| tenantId | String | Yes | — | |
| bankAccountId | String | Yes | — | |
| fromDate | DateTime | Yes | — | |
| toDate | DateTime | Yes | — | |
| statementBal | Decimal | Yes | — | |
| reconciledAt | DateTime | No | now() | |

**Gaps & Issues:**
- `[GAP]` No link to actual reconciled statement lines
- `[GAP]` No variance/tolerance threshold
- `[MISSING]` No reconciliation report generation

---

#### 1.4.4 Bank Connection (Open Banking)

**Source:** `prisma/schema.prisma` → `BankConnection`

**Status:** `[STUBBED]` — TrueLayer provider hardcoded, no actual integration.

| Field | Type | Notes |
|---|---|---|
| provider | String | Default "truelayer" |
| status | String | Connection status |
| institutionId | String | |
| consentId | String | |

`[STUBBED]` No live Open Banking calls. Sandbox mode only.

---

#### 1.4.5 Bank Feed / Open Banking Integration Specification `[MUST-HAVE -- Added from completeness review, part of M-1 ecosystem]`

**Requirement Source:** Market standard -- real-time bank feeds are a core feature of modern accounting software. TrueLayer is currently stubbed (sandbox only). Must specify the production integration.

**Current State in Document:** Section 1.4.4 documents Open Banking as `[STUBBED]` -- TrueLayer provider hardcoded, sandbox mode only.

**Description:**
Production Open Banking integration via TrueLayer (or alternative provider) for automated bank statement import and real-time balance checking.

**Business Rules:**
- Support AISP (Account Information Service Provider) for read-only bank data access
- OAuth2 consent flow: user authenticates with their bank, grants access to Nexa
- Automatic daily import of bank transactions (or more frequent if supported)
- Map imported transactions to BankStatementLine records
- Support major UK banks: Barclays, HSBC, Lloyds, NatWest, Santander, Metro Bank, Starling, Monzo, Revolut
- Consent renewal: bank consents expire (typically 90 days) -- system must track and prompt for renewal
- Error handling: graceful degradation if bank feed is unavailable (allow manual CSV import as fallback)
- Transaction deduplication: prevent duplicate import of same transaction
- Balance reconciliation: compare bank-reported balance with system balance

**API Operations Expected:**
- `POST /api/banking/connections/initiate` -- Start Open Banking consent flow
- `GET /api/banking/connections/callback` -- Handle OAuth callback from bank
- `GET /api/banking/connections` -- List active bank connections with consent status
- `POST /api/banking/connections/[id]/sync` -- Manually trigger bank sync
- `DELETE /api/banking/connections/[id]` -- Revoke bank connection
- `GET /api/banking/accounts/[id]/feed` -- View auto-imported transactions

**Competitor Reference:** Xero has direct bank feeds with major UK banks. Sage and QuickBooks also offer automated bank feeds.

---

### 1.5 VAT

#### 1.5.1 VAT Return Entity

**Source:** `prisma/schema.prisma` → `VatReturn`, `HmrcMtdSubmission`

**Critical Note:** VAT returns are stored in TenantConfig JSON, NOT the VatReturn table. The relational table exists but is never populated. `[SHORTCUT]`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | |
| tenantId | String | Yes | — | |
| vrn | String | Yes | — | VAT Registration Number |
| periodKey | String | Yes | — | e.g., "2024-Q1" |
| start | DateTime | Yes | — | Period start |
| end | DateTime | Yes | — | Period end |
| due | DateTime | Yes | — | Payment due date |
| status | String | Yes | — | draft, submitted, accepted, rejected |
| totalDue | Decimal | No | — | Amount due (nullable) |
| submittedAt | DateTime | No | — | |

**VAT Box Calculations:** `[PARTIAL]`

| Box | Description | Source | Status |
|---|---|---|---|
| Box 1 | VAT due on sales | SUM(CustomerInvoice.taxTotal where non-draft, in period) | `[COMPLETE]` |
| Box 2 | VAT due on EC acquisitions | Hardcoded to 0 | `[SHORTCUT]` |
| Box 3 | Total VAT due (Box 1 + Box 2) | Calculated | `[COMPLETE]` |
| Box 4 | VAT reclaimed on purchases | SUM(SupplierBill.taxTotal where non-draft, in period) | `[COMPLETE]` |
| Box 5 | Net VAT payable (Box 3 - Box 4) | Calculated | `[COMPLETE]` |
| Box 6 | Total sales ex-VAT | SUM(CustomerInvoice.subtotal) | `[COMPLETE]` |
| Box 7 | Total purchases ex-VAT | SUM(SupplierBill.subtotal) | `[COMPLETE]` |
| Box 8 | EU goods supplies | Hardcoded to 0 | `[SHORTCUT]` |
| Box 9 | EU goods acquisitions | Hardcoded to 0 | `[SHORTCUT]` |

**API Operations:**
- `GET /api/finance/vat/returns` — List returns `[PARTIAL]`
- `POST /api/finance/vat/returns` — Create draft return with computed boxes `[PARTIAL]`
- `GET /api/finance/vat/summary` — Get VAT summary for date range `[PARTIAL]`
- `POST /api/finance/vat/returns/[periodKey]/submit` — Submit return `[STUBBED]`

**HMRC MTD Integration:** `[STUBBED]` — No live HMRC API calls. Returns 501 if HMRC_CLIENT_ID not set. Sandbox mode only.

**Gaps & Issues:**
- `[SHORTCUT]` VAT data stored in TenantConfig JSON, not VatReturn table
- `[STUBBED]` HMRC MTD submission non-functional
- `[GAP]` No VAT code tracking on invoice/bill lines
- `[GAP]` No reverse charge VAT handling
- `[GAP]` No adjustment/correction mechanism
- `[MISSING]` No quarterly/annual return scheduling
- `[MISSING]` No Making Tax Digital (MTD) live integration
- `[RECOMMEND]` New project: relational VAT return storage with proper HMRC MTD integration via third-party (similar to payroll API approach)

---

#### 1.5.2 MTD VAT Live HMRC Integration `[MUST-HAVE -- Added from completeness review M-1]`

**Requirement Source:** UK legal compliance -- Making Tax Digital for VAT has been mandatory since April 2022. All competitors (Xero, QuickBooks, Sage, FreeAgent, Zoho) are HMRC-recognised software providers. The current implementation is stubbed (returns 501 if HMRC_CLIENT_ID not set, sandbox mode only).

**Description:**
Full integration with HMRC's Making Tax Digital VAT API to allow tenants to retrieve VAT obligations, submit 9-box VAT returns, and view submission history. This is a legal requirement for all VAT-registered UK businesses.

**Business Rules:**
- Tenant must have a valid VAT Registration Number (VRN) stored on their tenant profile
- VAT returns must be stored in a relational `VatReturn` table (not TenantConfig JSON as currently implemented)
- 9-box calculation must use line-level tax rates from invoices and bills (not aggregated totals)
- Box 1: VAT due on sales -- SUM of tax amounts from posted customer invoices in period
- Box 2: VAT due on EU acquisitions -- calculated from reverse-charge invoices (zero if not applicable post-Brexit)
- Box 3: Total VAT due (Box 1 + Box 2)
- Box 4: VAT reclaimed on purchases -- SUM of tax amounts from posted supplier bills in period
- Box 5: Net VAT payable/refundable (Box 3 - Box 4)
- Box 6: Total value of sales ex-VAT (net amounts from customer invoices)
- Box 7: Total value of purchases ex-VAT (net amounts from supplier bills)
- Box 8: Total value of goods supplied to EU (zero post-Brexit for most businesses)
- Box 9: Total value of goods acquired from EU (zero post-Brexit for most businesses)
- Submission requires HMRC fraud prevention headers (client IP, device info, timezone, connection method, etc.)
- Draft returns can be reviewed and edited before submission
- Once submitted to HMRC and accepted, returns are immutable
- VAT obligations must be fetched from HMRC to know which periods require submission
- System must track submission status: draft, submitted, accepted, rejected, error
- Consider using a third-party MTD bridge API (e.g., Tax Digital by Avalara, MTD Bridge by SilverFin) to reduce HMRC API complexity

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | FK to Tenant |
| vrn | String | Yes | VAT Registration Number |
| periodKey | String | Yes | HMRC obligation period key |
| periodStart | DateTime | Yes | Period start date |
| periodEnd | DateTime | Yes | Period end date |
| paymentDue | DateTime | Yes | HMRC payment due date |
| status | Enum | Yes | draft, submitted, accepted, rejected, error |
| box1 | Decimal | Yes | VAT due on sales |
| box2 | Decimal | Yes | VAT due on acquisitions |
| box3 | Decimal | Yes | Total VAT due |
| box4 | Decimal | Yes | VAT reclaimed |
| box5 | Decimal | Yes | Net VAT payable |
| box6 | Decimal | Yes | Total sales ex-VAT |
| box7 | Decimal | Yes | Total purchases ex-VAT |
| box8 | Decimal | Yes | Goods supplied to EU |
| box9 | Decimal | Yes | Goods acquired from EU |
| hmrcCorrelationId | String | No | HMRC receipt correlation ID |
| hmrcReceiptId | String | No | HMRC submission receipt |
| submittedAt | DateTime | No | Submission timestamp |
| submittedBy | String | No | User who submitted |
| fraudPreventionHeaders | Json | No | Stored for audit trail |
| notes | String | No | Internal notes |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |

**API Operations Expected:**
- `GET /api/finance/vat/obligations` -- Fetch open VAT obligations from HMRC
- `POST /api/finance/vat/returns` -- Create draft VAT return with computed boxes for a period
- `GET /api/finance/vat/returns` -- List VAT returns (filterable by status, period)
- `GET /api/finance/vat/returns/[id]` -- Get VAT return detail with box breakdown
- `PATCH /api/finance/vat/returns/[id]` -- Update draft return (manual adjustments)
- `POST /api/finance/vat/returns/[id]/submit` -- Submit return to HMRC (requires approval permission)
- `GET /api/finance/vat/returns/[id]/submission-status` -- Check submission status with HMRC

**UK Compliance Notes:**
- HMRC requires specific fraud prevention headers on all API calls (Gov-Client-Connection-Method, Gov-Client-Device-ID, Gov-Client-User-IDs, Gov-Client-Timezone, Gov-Client-Local-IPs, Gov-Client-MAC-Addresses, Gov-Client-Screens, Gov-Client-Window-Size, Gov-Client-Browser-Plugins, Gov-Client-User-Agent, Gov-Vendor-Version, etc.)
- Software must be HMRC-recognised before live submissions
- Test submissions must be made against HMRC sandbox first
- VAT return submission deadline: 1 month and 7 days after end of VAT period
- Penalties apply for late submission under HMRC points-based system (from January 2023)

**Competitor Reference:** Xero, QuickBooks, Sage, and FreeAgent all offer one-click MTD VAT submission directly from their applications. They are all HMRC-recognised software.

**Permissions:**
- Create/view: `finance:vat_return:view`
- Submit to HMRC: `finance:vat_return:submit` (restricted to ADMIN+)

---

#### 1.5.3 MTD for Income Tax Self Assessment `[MUST-HAVE -- Added from completeness review M-2]`

**Requirement Source:** UK legal compliance -- MTD for Income Tax becomes mandatory from April 2026 for self-employed individuals and landlords with income over 50,000 GBP. QuickBooks and Xero are already in HMRC pilot testing.

**Description:**
Quarterly digital reporting of business income and expenses to HMRC, plus an end-of-period statement (EOPS). This applies to sole traders and landlords using the ERP to manage their business finances. While the initial deadline is April 2026 for income over 50K, the threshold drops to 30K from April 2027.

**Business Rules:**
- Quarterly updates must be submitted to HMRC containing income and expense summaries
- End-of-period statement (EOPS) must be submitted after tax year end
- Final declaration must be submitted confirming all income reported
- Data must be sourced from the GL (income and expense accounts) for the reporting period
- System must track which periods have been reported to HMRC
- Quarterly updates are not binding -- they can be amended
- EOPS and final declaration are binding once submitted
- Must support multiple business income sources per taxpayer (if applicable)
- Must comply with HMRC fraud prevention header requirements (same as MTD VAT)

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | FK to Tenant |
| taxYear | String | Yes | e.g., "2026-27" |
| periodType | Enum | Yes | quarterly_update, eops, final_declaration |
| periodStart | DateTime | Yes | |
| periodEnd | DateTime | Yes | |
| totalIncome | Decimal | Yes | Total business income |
| totalExpenses | Decimal | Yes | Total business expenses |
| netProfit | Decimal | Yes | Income minus expenses |
| status | Enum | Yes | draft, submitted, accepted, rejected |
| hmrcReceiptId | String | No | HMRC submission receipt |
| submittedAt | DateTime | No | |
| submittedBy | String | No | |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |

**API Operations Expected:**
- `GET /api/finance/itsa/obligations` -- Fetch ITSA obligations from HMRC
- `POST /api/finance/itsa/quarterly-update` -- Create quarterly update with computed income/expenses
- `POST /api/finance/itsa/quarterly-update/[id]/submit` -- Submit quarterly update to HMRC
- `POST /api/finance/itsa/eops` -- Create end-of-period statement
- `POST /api/finance/itsa/final-declaration` -- Submit final declaration

**UK Compliance Notes:**
- April 2026: Mandatory for income > 50,000 GBP
- April 2027: Mandatory for income > 30,000 GBP
- Must use HMRC sandbox for testing before live
- Same fraud prevention header requirements as MTD VAT

**Competitor Reference:** QuickBooks and Xero are already in HMRC pilot testing for MTD ITSA. FreeAgent also supports this.

---

### 1.6 Fixed Assets

#### 1.6.1 Fixed Asset Entity

**Source:** `prisma/schema.prisma` → `FixedAsset`, `DepreciationSchedule`, `FixedAssetDisposal`

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | PK | |
| tenantId | String | Yes | From auth context | | |
| assetCode | String | Yes | — | Unique per tenant | |
| name | String | Yes | — | | |
| category | String | Yes | — | e.g., "Plant", "Buildings" | String, not enum |
| cost | Decimal | Yes | — | In minor units | Original cost |
| salvage | Decimal | No | 0 | In minor units | Residual value |
| usefulLifeM | Int | Yes | — | Positive | Useful life in months |
| acquiredAt | DateTime | Yes | — | | |
| disposedAt | DateTime | No | null | | Set on disposal |
| disposalProceeds | Decimal | No | null | | Sale proceeds |
| disposalNotes | String | No | null | | |
| createdAt | DateTime | Auto | now() | | |
| updatedAt | DateTime | Auto | Auto | | |

**Depreciation Schedule (DepreciationSchedule):**

| Field | Type | Required | Default |
|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated |
| tenantId | String | Yes | — |
| assetId | String | Yes | FK to FixedAsset |
| period | DateTime | Yes | 1st of month |
| amount | Decimal | Yes | — |
| posted | Boolean | No | false |

**Depreciation Calculation:** `[COMPLETE]`
```
Monthly = Math.floor((cost - salvage) / usefulLifeM)
Method: Straight-line only
```

**GL Posting on Depreciation:** `[COMPLETE]`
- Debit: DEP_EXP (Depreciation Expense)
- Credit: ACCUM_DEP (Accumulated Depreciation)
- Accounts auto-created if not found

**Disposal Calculation:** `[COMPLETE]`
```
Accumulated = SUM(posted depreciation amounts)
NBV = MAX(0, cost - accumulated)
GainLoss = proceeds - NBV
```

**GL Posting on Disposal:** `[COMPLETE]`
- Debit BANK (proceeds, if any)
- Debit ACCUM_DEP (remove accumulated)
- Credit FA_COST (remove asset cost)
- Debit FA_LOSS or Credit FA_GAIN (gain/loss)

**Revaluation:** `[PARTIAL]`
- Creates GL journal only — no revaluation stored in asset record
- Debit FA_COST / Credit REVAL_RES (increase), or Debit REVAL_LOSS / Credit FA_COST (decrease)

**API Operations:**
- `POST /api/finance/fa/acquire` — Acquire asset `[COMPLETE]`
- `POST /api/finance/fa/depreciate` — Run depreciation for period `[COMPLETE]`
- `POST /api/finance/fa/dispose` — Dispose asset `[COMPLETE]`
- `POST /api/finance/fa/revalue` — Revalue asset `[PARTIAL]`
- `GET /api/finance/fa/reports/register` — Asset register report `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Only straight-line depreciation (no declining balance, sum-of-digits)
- `[SHORTCUT]` All GL account codes hardcoded
- `[SHORTCUT]` No check: can dispose already-disposed assets
- `[SCHEMA-GAP]` No depreciation method field
- `[SCHEMA-GAP]` No revaluation history tracking
- `[SCHEMA-GAP]` No asset category enum
- `[MISSING]` No impairment testing
- `[MISSING]` No asset grouping for batch depreciation reporting

**Permissions:**
- Acquire: `finance:fa_acquire`
- Depreciate: `finance:fa_depreciate`
- Dispose: `finance:fa_dispose`
- Revalue: `finance:fa_depreciate` `[SHORTCUT]` — should be separate permission

---

### 1.7 Period Management

**Source:** `prisma/schema.prisma` → `PeriodClose`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated | |
| tenantId | String | Yes | — | |
| periodKey | String | Yes | — | Format: YYYY-MM |
| periodStart | DateTime | Yes | — | |
| periodEnd | DateTime | Yes | — | |
| status | PeriodStatus (Enum) | Yes | CLOSED | OPEN, CLOSED |
| glClosed | Boolean | Yes | true | GL ledger locked |
| arClosed | Boolean | Yes | true | AR ledger locked |
| apClosed | Boolean | Yes | true | AP ledger locked |
| bankClosed | Boolean | Yes | true | Banking locked |
| assetsClosed | Boolean | Yes | true | Fixed assets locked |
| vatClosed | Boolean | Yes | true | VAT locked |
| closedBy | String | No | null | User ID (legacy) |
| closedByUserId | String | No | null | User ID |
| closedAt | DateTime | No | null | |
| notes | String | No | null | |

**Status Lifecycle:**
```
OPEN ↔ CLOSED (bidirectional — can reopen)
```

**Business Rules:**
- Per-ledger locking: can close GL but leave AP open `[COMPLETE]`
- Period assertion: `assertPeriodOpen(tenantId, date, ledger)` checks if specific ledger is closed for that date `[COMPLETE]`
- Close: upserts record, sets all or specified ledger flags `[COMPLETE]`
- Open: resets all flags to false, status to OPEN `[COMPLETE]`

**API Operations:**
- `GET /api/finance/close/periods` — List periods `[COMPLETE]`
- `POST /api/finance/close/lock` — Lock period (all or specific ledgers) `[COMPLETE]`
- `POST /api/finance/close/open` — Reopen period `[COMPLETE]`

**Gaps & Issues:**
- `[GAP]` Dual mechanism: PeriodClose table + TenantConfig.finance.close.lockedThrough. No documented precedence. [CONTRADICTION-RESOLVED: CR-5 -- The database-backed `PeriodClose` table with per-ledger flags is the canonical mechanism. It supports granular per-ledger locking (GL, AR, AP, Banking, Fixed Assets, VAT). The `TenantConfig.finance.close.lockedThrough` date-based mechanism should be deprecated. See Section 6.8 for detailed comparison and R-87 for consolidation recommendation.]
- `[SCHEMA-GAP]` Duplicate fields: closedBy + closedByUserId
- `[MISSING]` No year-end close process
- `[MISSING]` No fiscal year configuration
- `[MISSING]` No period auto-generation (monthly periods must be created on demand)

---

### 1.8 Foreign Exchange

#### 1.8.1 Currency Rate Entity

**Source:** `prisma/schema.prisma` → `CurrencyRate`

| Field | Type | Required | Default |
|---|---|---|---|
| id | String (CUID) | Auto | Auto-generated |
| fromCode | String | Yes | — |
| toCode | String | Yes | — |
| rate | Decimal | Yes | — |
| asOfDate | DateTime | Yes | — |

`[SHORTCUT]` This table is never populated by the API. FX rates are passed in request bodies.

**FX Exposure Calculation:** `[COMPLETE]`
- Queries open AR invoices and AP bills in foreign currencies
- Calculates baseAtOriginal = balance * fxRate per item
- Groups by currency with totals

**FX Revaluation:** `[COMPLETE]`
- Compares original rate vs new rate per exposed item
- Calculates unrealized gain/loss per currency
- AP sign reversed (liability = negative exposure)
- Builds draft GL journal (gain account / loss account)
- `[SHORTCUT]` Returns draft only — does not post

**API Operations:**
- `GET /api/finance/fx/exposure` — FX exposure report `[COMPLETE]`
- `POST /api/finance/fx/revalue` — Compute revaluation and draft journal `[COMPLETE]`

**Gaps & Issues:**
- `[SHORTCUT]` Revaluation draft not posted automatically
- `[SHORTCUT]` CurrencyRate table never populated
- `[MISSING]` No realized gain/loss on payment
- `[MISSING]` No FX rate provider integration
- `[MISSING]` No historical rate lookups
- `[MISSING]` No currency management UI (add/remove currencies)

---

## Section 2: Inventory / Stock

---

### 2.1 Item Master

#### 2.1.1 InventoryItem Entity (Prisma Model)

| Field       | Type      | Required | Default      | Constraints                    | Notes                                    |
|-------------|-----------|----------|--------------|--------------------------------|------------------------------------------|
| id          | String    | Yes      | cuid()       | @id                            | Primary key                              |
| tenantId    | String    | Yes      | -            | -                              | Multi-tenant scoping                     |
| sku         | String    | Yes      | -            | -                              | Stock Keeping Unit identifier            |
| qtyOnHand   | Decimal   | Yes      | 0            | -                              | Current quantity on hand (denormalized)   |
| warehouseId | String    | No       | null         | FK -> Warehouse                | Optional warehouse assignment            |
| locationId  | String    | No       | null         | FK -> Location                 | Optional bin/location assignment         |
| createdAt   | DateTime  | Yes      | now()        | -                              | -                                        |
| updatedAt   | DateTime  | Yes      | @updatedAt   | -                              | -                                        |

**Indexes:**
- `@@index([tenantId, sku])`

**Relations:**
- `location` -> `Location?` (optional, via locationId)
- `warehouse` -> `Warehouse?` (optional, via warehouseId)

#### 2.1.2 Item Metadata (Stored in TenantConfig JSON)

Item metadata is NOT stored in the InventoryItem table. Instead, it is persisted in the `TenantConfig.config` JSON field under `config.inventory.items[sku]`. This is a `[SHORTCUT]` design decision.

**InventoryItemMeta type** (from `items.service.ts`):

| Field              | Type         | Required | Notes                                 |
|--------------------|--------------|----------|---------------------------------------|
| sku                | string       | Yes      | Matches InventoryItem.sku             |
| name               | string/null  | No       | Display name                          |
| description        | string/null  | No       | Description text                      |
| category           | string/null  | No       | Item category                         |
| unitOfMeasure      | string/null  | No       | UoM (e.g., "ea", "kg")               |
| isService          | boolean/null | No       | If true, non-stockable service item   |
| trackBatch         | boolean/null | No       | Enable batch/lot tracking             |
| trackSerial        | boolean/null | No       | Enable serial number tracking         |
| defaultWarehouseId | string/null  | No       | Default receiving warehouse           |
| defaultLocationId  | string/null  | No       | Default bin location                  |

**ItemMeta type** (from `items.ts` -- legacy variant):

| Field         | Type                      | Required | Notes                      |
|---------------|---------------------------|----------|----------------------------|
| name          | string/null               | No       | Display name               |
| description   | string/null               | No       | Description                |
| category      | string/null               | No       | Category                   |
| unitOfMeasure | string/null               | No       | Unit of measure            |
| type          | "stock" / "non_stock"     | No       | Stock vs non-stock item    |

**Disabled Items** are also stored in TenantConfig at `config.inventory.disabledItems[sku] = true`. This is soft-delete; items can be disabled but not physically deleted from the database. `[SHORTCUT]`

#### 2.1.3 DimProduct (Metrics Dimension Table)

| Field         | Type     | Required | Default | Constraints                      | Notes                       |
|---------------|----------|----------|---------|----------------------------------|-----------------------------|
| id            | String   | Yes      | cuid()  | @id                              | Primary key                 |
| tenantId      | String   | Yes      | -       | -                                | Multi-tenant scoping        |
| sku           | String   | Yes      | -       | @@unique([tenantId, sku])        | SKU reference               |
| name          | String   | Yes      | -       | -                                | Product display name        |
| category      | String   | No       | null    | -                                | Category                    |
| brand         | String   | No       | null    | -                                | Brand                       |
| unitOfMeasure | String   | No       | null    | -                                | UoM                         |
| createdAt     | DateTime | Yes      | -       | -                                | -                           |
| updatedAt     | DateTime | Yes      | -       | -                                | -                           |

**Relations:**
- `factInventoryMovements` -> `FactInventoryMovement[]`
- `factWorkOrders` -> `FactWorkOrder[]`

DimProduct is auto-synced when inventory items are created/updated via `upsertDimProductFromMeta()` and `ensureDimProduct()`.

#### 2.1.4 Business Rules -- Item Master

1. **SKU uniqueness**: SKU must be unique per tenant. Checked via `ensureSkuUnique()`. Returns 409 if duplicate. `[COMPLETE]`
2. **SKU required**: SKU cannot be empty/blank. Validated at both API (Zod: `z.string().min(1)`) and service layer. `[COMPLETE]`
3. **Soft-delete via disable**: Items are disabled by setting `config.inventory.disabledItems[sku] = true` in TenantConfig. No physical delete of InventoryItem row. `[COMPLETE]`
4. **Disabled item blocks adjustments**: `createAdjustment()` checks `item.disabled` and returns 409 "item_disabled". `[COMPLETE]`
5. **On-hand computation**: Two mechanisms exist:
   - **Legacy** (`items.ts`): `getOnHand()` aggregates `StockMove.qty` via `groupBy`. Returns Decimal.
   - **Service** (`items.service.ts`): `qtyOnHand` stored directly on `InventoryItem` and updated atomically via `increment`/`decrement`. `[COMPLETE]`
6. **In-memory meta cache**: `items.service.ts` maintains an in-memory `Map<string, InventoryItemMeta>` cache for fast lookups. `[SHORTCUT]` -- not cluster-safe, no TTL, no invalidation on config change from another process.
7. **Search filter is a no-op**: `listInventoryItems()` in `items.service.ts` accepts a `q` parameter but always returns `true` for all items regardless of query. `[SHORTCUT]` -- comment says "Lenient filtering for tests".

#### 2.1.5 API Operations -- Item Master

| Method | Path                                        | Description                          | Permission             | Module Gate | Status       |
|--------|---------------------------------------------|--------------------------------------|------------------------|-------------|--------------|
| GET    | `/api/inventory/items`                      | List items (paginated)               | `ui:finance_reports:view` | inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/items`                      | Create item (legacy)                 | `inventory:manage`     | inventory   | `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-5 -- Duplicate. Consolidate to single endpoint.] |
| POST   | `/api/inventory/items/create`               | Create item (service layer)          | `inventory:manage`     | -           | `[COMPLETE]` [CONTRADICTION-RESOLVED: DE-5 -- Duplicate. Canonical is `POST /api/inventory/items` with service-layer schema.] |
| GET    | `/api/inventory/items/[itemId]`             | Get single item                      | varies                 | inventory   | `[COMPLETE]` |
| PUT    | `/api/inventory/items/update`               | Update item                          | `inventory:manage`     | -           | `[COMPLETE]` |
| DELETE | `/api/inventory/items/delete`               | Delete item                          | `inventory:manage`     | -           | `[COMPLETE]` |

**Zod Schemas:**

- **ListQuery**: `{ q?: string, page: int(positive, default=1), pageSize: int(positive, max=100, default=50) }`
- **CreateBody (legacy)**: `{ sku: string(min=1), name?: string, description?: string, category?: string, unitOfMeasure?: string, type?: enum("stock","non_stock") }` [CONTRADICTION-RESOLVED: EC-10, IT-4 -- Legacy `type` field maps to `isService`: `"stock"` = `isService: false`, `"non_stock"` = `isService: true`. New project should consolidate to a single creation schema using `isService` boolean.]
- **CreateBody (service)**: `{ tenantId?: string, sku: string(min=1), name?: string, description?: string, category?: string, unitOfMeasure?: string, isService?: boolean, trackBatch?: boolean, trackSerial?: boolean, qtyOnHand: number(>=0, default=0), warehouseId?: string, locationId?: string }` [CONTRADICTION-RESOLVED: EC-10 -- This is the canonical creation schema. The legacy schema above should be deprecated in favor of this one.]

**Guards:**
- `requireAuth(ctx)` -- session auth required
- `requireTenant(ctx)` -- tenant context required
- `assertModuleEnabled({ module: "inventory" })` -- inventory module must be enabled
- `requirePlanFeature(tenantId, "inventory")` -- billing plan must include "inventory"
- `requirePermissionServer("inventory:manage")` -- RBAC permission check
- `rateLimitTenant("inventory-items", tenantId, userId)` -- per-tenant rate limiting
- Payload size guard: `Content-Length > 1MB` returns 413

**Gaps & Issues:**
- `[SHORTCUT]` Metadata stored in JSON blob rather than proper relational columns. No schema validation on stored metadata.
- `[SHORTCUT]` Two separate creation endpoints (`/items` POST and `/items/create` POST) with different code paths and slightly different validation.
- `[SHORTCUT]` In-memory cache for metadata not safe for multi-instance deployments.
- `[GAP]` `trackBatch` and `trackSerial` flags are stored but not enforced anywhere in the movement/GRN flows.
- `[SCHEMA-GAP]` InventoryItem has no fields for: name, description, category, UoM, barcode, weight, dimensions, status, reorder point, min/max qty, lead time, or any other typical item master fields. All stored in JSON.
- `[RECOMMEND]` Migrate item metadata from TenantConfig JSON to proper InventoryItem columns or a dedicated `ItemMaster` model.

---

#### 2.1.1A Item Master Migration to Relational Schema `[MUST-HAVE -- Added from completeness review M-26]`

**Requirement Source:** Data integrity -- all item metadata (name, description, category, UoM, barcode, weight, dimensions, status, reorder point) is stored in TenantConfig JSON blob. Cannot query by name, category, or barcode. Cannot index for performance. Not acceptable for any inventory system.

**Current State in Document:** Section 2.1.1 shows InventoryItem has only 4 typed fields. Section 2.1.2 shows all metadata in JSON. Section 2.1.4 Rule 7 confirms search filter is a no-op.

**Description:**
All item metadata must be migrated from TenantConfig JSON to proper relational columns on the InventoryItem model (or a dedicated ItemMaster model). This enables database-level queries, indexing, validation, and reporting.

**Expected Entities/Fields (enhanced InventoryItem):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | |
| sku | String | Yes | Unique per tenant |
| name | String | Yes | Display name |
| description | String | No | |
| category | String | No | Item category |
| subcategory | String | No | |
| unitOfMeasure | String | Yes | Default "ea" |
| barcode | String | No | EAN/UPC barcode |
| weight | Decimal | No | Weight in KG |
| length | Decimal | No | Dimensions |
| width | Decimal | No | |
| height | Decimal | No | |
| status | Enum | Yes | active, inactive, discontinued |
| type | Enum | Yes | stock, non_stock, service |
| trackBatch | Boolean | Yes | Default false |
| trackSerial | Boolean | Yes | Default false |
| reorderPoint | Decimal | No | Auto-reorder trigger level |
| reorderQty | Decimal | No | Default reorder quantity |
| minStockLevel | Decimal | No | Minimum stock warning |
| maxStockLevel | Decimal | No | Maximum stock level |
| leadTimeDays | Int | No | Supplier lead time |
| defaultWarehouseId | String | No | FK to Warehouse |
| defaultLocationId | String | No | FK to Location |
| defaultSupplierId | String | No | FK to Supplier |
| costingMethod | Enum | No | WAC, FIFO, standard (tenant default if not set) |
| standardCost | Decimal | No | Standard cost (if costing method = standard) |
| salesPrice | Decimal | No | Default selling price |
| purchasePrice | Decimal | No | Default purchase price |
| taxRate | Decimal | No | Default VAT rate |
| qtyOnHand | Decimal | Yes | Default 0. Denormalized |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |

**Business Rules:**
- SKU must be unique per tenant (not globally)
- Name is required (min 1 char)
- Search must work on name, SKU, category, and barcode fields using database-level queries
- Status changes: active items can become inactive or discontinued; discontinued is terminal
- Inactive items can be reactivated; discontinued items cannot
- trackBatch and trackSerial flags must be enforced in GRN/movement flows (if trackBatch=true, lot number required on receipt)

**Competitor Reference:** Unleashed, ERPNext, Odoo, Brightpearl, and Sage 200 all have proper relational item master schemas with named columns.

---

### 2.2 Stock Movements

#### 2.2.1 StockMove Entity (Prisma Model)

| Field          | Type     | Required | Default | Constraints                       | Notes                                |
|----------------|----------|----------|---------|-----------------------------------|--------------------------------------|
| id             | String   | Yes      | cuid()  | @id                               | Primary key                          |
| tenantId       | String   | Yes      | -       | -                                 | Multi-tenant scoping                 |
| sku            | String   | Yes      | -       | -                                 | SKU being moved                      |
| warehouseId    | String   | No       | null    | FK -> Warehouse                   | Warehouse context                    |
| fromLocationId | String   | No       | null    | FK -> Location (StockMoveFrom)    | Source bin/location                  |
| toLocationId   | String   | No       | null    | FK -> Location (StockMoveTo)      | Destination bin/location             |
| type           | String   | Yes      | -       | -                                 | Movement type code (see below)       |
| qty            | Decimal  | Yes      | -       | -                                 | Quantity (signed per type)           |
| unitCost       | Decimal  | Yes      | 0       | -                                 | Unit cost in minor currency          |
| totalCost      | Decimal  | Yes      | 0       | -                                 | Total cost in minor currency         |
| sourceType     | String   | No       | null    | -                                 | Source document type                 |
| sourceId       | String   | No       | null    | -                                 | Source document ID                   |
| lotId          | String   | No       | null    | FK -> InventoryLot                | Lot/batch reference                  |
| reference      | String   | No       | null    | -                                 | External reference string            |
| notes          | String   | No       | null    | -                                 | Free-text notes                      |
| movedAt        | DateTime | Yes      | now()   | -                                 | Timestamp of movement                |
| movedBy        | String   | No       | null    | -                                 | Actor user ID                        |
| sourceEventId  | String   | No       | null    | -                                 | Triggering event ID                  |

**Indexes:**
- `@@index([tenantId, sku])`
- `@@index([tenantId, warehouseId])`
- `@@index([tenantId, type])`
- `@@index([tenantId, sourceType, sourceId])`
- `@@index([tenantId, movedAt])`
- `@@index([tenantId, lotId])`

**Relations:**
- `warehouse` -> `Warehouse?`
- `fromLocation` -> `Location?` (StockMoveFrom)
- `toLocation` -> `Location?` (StockMoveTo)
- `lot` -> `InventoryLot?`

#### 2.2.2 Movement Types

**Type codes** used in `StockMove.type`:

| Type               | Direction | Sign | Source                        |
|--------------------|-----------|------|-------------------------------|
| `grn`              | Inbound   | +    | Goods Receipt (PO receiving)  |
| `receipt`          | Inbound   | +    | General receipt               |
| `receive`          | Inbound   | +    | Used by ledger system         |
| `issue`            | Outbound  | -    | Stock issue / pick            |
| `transfer_out`     | Outbound  | -    | Inter-warehouse transfer out  |
| `transfer_in`      | Inbound   | +    | Inter-warehouse transfer in   |
| `adjustment_in`    | Inbound   | +    | Positive adjustment           |
| `adjustment_out`   | Outbound  | -    | Negative adjustment           |
| `adjustment`       | Either    | +/-  | Corrections service           |
| `reversal`         | Either    | +/-  | Movement reversal             |
| `cycle_count`      | Either    | +/-  | Cycle count variance          |
| `production_issue` | Outbound  | -    | Manufacturing material issue  |
| `production_receipt`| Inbound  | +    | Manufacturing finished goods  |

**Source types** used in `StockMove.sourceType`:

| sourceType    | Description                     |
|---------------|---------------------------------|
| `po`          | Purchase order                  |
| `so`          | Sales order                     |
| `wo`          | Work order                      |
| `grn`         | Goods receipt note              |
| `cycle_count` | Cycle count                     |
| `adjustment`  | Manual adjustment               |
| `reversal`    | Reversal of prior movement      |
| `pos`         | Point of sale                   |
| `pos_sale`    | POS sale                        |
| `wms_ship`    | WMS shipment                    |

#### 2.2.3 Ledger Module (`ledger.ts`)

The ledger module provides a lower-level movement recording system with signed quantities.

**MovementType union:**
```
"adjustment_in" | "adjustment_out" | "transfer_out" | "transfer_in" | "receive" | "issue"
```

**Sign mapping:**
- `adjustment_in` = +1, `adjustment_out` = -1
- `transfer_out` = -1, `transfer_in` = +1
- `receive` = +1, `issue` = -1

**Functions:**
- `recordMovement(input)` -- Creates a StockMove record with signed qty
- `computeOnHand(opts)` -- Groups StockMove by sku+warehouseId, sums qty
- `getOnHandForSku(tenantId, sku, warehouseId)` -- Returns Decimal on-hand for a single SKU

**Business Rules:**
- On-hand is computed by summing ALL StockMove.qty for a given tenantId+sku+warehouseId. `[COMPLETE]`
- Sign is applied at recording time based on type mapping. `[COMPLETE]`

#### 2.2.4 Movements Service (`movements.service.ts`)

Higher-level service layer that orchestrates stock movements with costing and GL integration.

**`receiveStock(input)` -- Goods Receipt:**
1. Validates `qty > 0`, throws 422 "qty_must_be_positive" otherwise.
2. Gets or creates InventoryItem for tenant+sku+warehouse.
3. Atomically increments `InventoryItem.qtyOnHand`.
4. Records StockMove with type="grn".
5. Updates cost state via `applyMovementToCostState(current, { type: "GRN", qty, unitCostMinor })`.
6. Persists updated cost state.
- `[COMPLETE]`

**`issueStock(input)` -- Stock Issue:**
1. Validates `qty > 0`, throws 422.
2. Gets or creates InventoryItem.
3. Checks `onHand >= qty`, throws 400 "insufficient_stock" if not.
4. Atomically decrements `InventoryItem.qtyOnHand`.
5. Reads current avg cost from cost state.
6. Records StockMove with type="issue".
7. Updates cost state via outbound movement.
8. Posts GL journal entry: Debit COGS, Credit INV (only if movementCost > 0).
- `[COMPLETE]`

**`transferStock(input)` -- Inter-Warehouse Transfer:**
1. Validates `qty > 0`, throws 422.
2. Gets or creates source InventoryItem.
3. Checks source `onHand >= qty`, throws 400 "insufficient_stock".
4. Gets or creates destination InventoryItem.
5. Decrements source, increments destination (two separate updates -- not atomic).
6. Records TWO StockMove records: `transfer_out` and `transfer_in`.
7. Updates cost state for both source (outbound) and destination (inbound, carrying source avg cost).
- `[COMPLETE]`
- `[SHORTCUT]` The two inventory updates and two stock moves are NOT in a single transaction. Failure midway could leave inconsistent state.

#### 2.2.4A Transactional Stock Movements `[MUST-HAVE -- Added from completeness review M-15]`

**Requirement Source:** Data integrity -- source/destination updates for stock transfers are separate Prisma calls (not in a single transaction). Failure midway creates inconsistent state where stock is deducted from source but not added to destination.

**Current State in Document:** Section 2.2.4 explicitly calls out: `[SHORTCUT] The two inventory updates and two stock moves are NOT in a single transaction`.

**Description:**
All stock movement operations that modify multiple records (transfers, adjustments with GL posting, reversals) must be wrapped in database transactions to ensure atomicity.

**Business Rules:**
- `transferStock()` must wrap all operations (source decrement, destination increment, two StockMove records, cost state updates) in a single `prisma.$transaction()`
- `issueStock()` must wrap inventory decrement, StockMove creation, cost state update, and GL posting in a transaction
- `receiveStock()` must wrap inventory increment, StockMove creation, lot creation, and cost state update in a transaction
- If any part of the transaction fails, all changes must be rolled back
- Optimistic locking (using `updatedAt` check) should be used within transactions to handle concurrent access
- Maximum retry count for optimistic lock failures: 5 (matching existing GRN pattern)

---

#### 2.2.5 Goods Receipt Note (`grn.ts`)

Dedicated GRN posting function with optimistic concurrency control.

**`postGoodsReceipt(input)` Business Rules:**
1. Runs inside `prisma.$transaction()`.
2. Creates an `InventoryLot` for FIFO/WAV costing.
3. Uses optimistic locking: reads `updatedAt`, then `updateMany` with `where: { id, updatedAt: prevUpdatedAt }`. Retries up to 5 times.
4. If item does not exist, creates it with initial qty.
5. Emits audit event `inventory.grn.received`.
6. On concurrent update failure after 5 retries, throws 409.
- `[COMPLETE]`

#### 2.2.6 Adjustments (Legacy -- `adjustments.ts`)

**`createAdjustment(input)` Business Rules:**
1. `qtyDelta` must not be zero (422).
2. Item must exist and not be disabled (409 "item_disabled").
3. Warehouse (if specified) must not be disabled (409 "warehouse_disabled").
4. Resulting on-hand must not go negative (409 "insufficient_stock").
5. Records movement as `adjustment_in` or `adjustment_out` based on sign.
- `[COMPLETE]`

#### 2.2.7 Corrections Service (`corrections.service.ts`)

**`reverseStockMovement(tenantId, movementId, actorId, reason)` Business Rules:**
1. Movement must exist and belong to tenant (404).
2. No existing reversal for this movement (409 "movement_already_reversed").
3. Movement cannot have blocked dependants (pos, pos_sale, wo, workorder, wms_ship) -- 409 "movement_has_dependants".
4. Period must be open for the movement's date (via `assertPeriodOpen`).
5. If reversal would make on-hand negative, throws 409 "would_go_negative".
6. Within a transaction:
   - Updates InventoryItem.qtyOnHand
   - Updates cost state
   - Posts GL journal (reversal entries: Credit INV/Debit COGS for issue reversals)
   - Creates reversal StockMove with type="reversal", sourceType="reversal", sourceId=originalMovementId
   - Emits audit event `inventory.movement.reversed`
- `[COMPLETE]`

**`createStockAdjustment(input)` Business Rules:**
1. Reason is required (400).
2. Qty delta must not be zero (400).
3. Period must be open.
4. On-hand must not go negative (409).
5. Within a transaction:
   - Updates or creates InventoryItem
   - Updates cost state
   - Creates StockMove with type="adjustment"
   - Posts GL journal: Debit INV/Credit INV_GAIN (positive adj) or Debit INV_LOSS/Credit INV (negative adj)
   - Emits audit event `inventory.adjustment.created`
- `[COMPLETE]`

#### 2.2.8 API Operations -- Stock Movements

| Method | Path                                                   | Description                        | Permission               | Module Gate | Status       |
|--------|--------------------------------------------------------|------------------------------------|--------------------------|-------------|--------------|
| POST   | `/api/inventory/grn`                                   | Post goods receipt                 | `inventory:receive_grn`  | -           | `[COMPLETE]` |
| POST   | `/api/inventory/issue`                                 | Issue stock                        | `inventory:adjust`       | -           | `[COMPLETE]` |
| POST   | `/api/inventory/transfer`                              | Transfer stock between warehouses  | `inventory:adjust`       | -           | `[COMPLETE]` |
| POST   | `/api/inventory/adjustments`                           | Create adjustment (legacy)         | `inventory:manage`       | inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/movements/[movementId]/reverse`        | Reverse a stock movement           | `inventory:adjust`       | -           | `[COMPLETE]` |
| GET    | `/api/inventory/on-hand`                               | Query on-hand by sku/warehouse     | `ui:finance_reports:view`| inventory   | `[COMPLETE]` |

**Zod Schemas:**

- **GRN Body**: `{ sku: string(min=1), qty: number(positive), unitCostMinor: int(>=0), warehouseId?: string, locationId?: string, tenantId?: string }`
- **Issue Body**: `{ tenantId?: string, sku: string(min=1), qty: number(positive), warehouseId?: string, locationId?: string, reason?: string }`
- **Transfer Body**: `{ tenantId?: string, sku: string(min=1), fromWarehouseId?: string, toWarehouseId?: string, fromLocId?: string, toLocId?: string, qty: number(positive), reference?: string }`
- **Adjustment Body**: `{ sku: string(min=1), warehouseId?: string, qtyDelta: string|number, reason?: string }`
- **Reverse Body**: `{ tenantId?: string, reason?: string }`
- **On-hand Query**: `{ sku?: string, warehouseId?: string }`

**Additional Guards:**
- Transfer supports idempotency key via `Idempotency-Key` header. Returns 409 with cached response on duplicate.
- Sentry breadcrumb on GRN for observability.
- Metrics increment on GRN: `erp_inventory_grn_total`.

**Gaps & Issues:**
- `[GAP]` No bulk GRN endpoint. Each line must be received individually via separate calls (except WMS receiving which handles PO lines).
- `[SHORTCUT]` Transfer movement is not transactional -- source decrement and destination increment are separate Prisma calls.
- `[GAP]` No audit trail query endpoint. Movements can be read via on-hand endpoint but no dedicated movement history API.
- `[RECOMMEND]` Add a GET `/api/inventory/movements` endpoint for movement history with filtering by sku, type, date range.

---

### 2.3 Warehouse Management (WMS)

#### 2.3.1 Warehouse Entity (Prisma Model)

| Field     | Type     | Required | Default    | Constraints          | Notes                     |
|-----------|----------|----------|------------|----------------------|---------------------------|
| id        | String   | Yes      | cuid()     | @id                  | Primary key               |
| tenantId  | String   | Yes      | -          | -                    | Multi-tenant scoping      |
| code      | String   | Yes      | -          | @@unique([tenantId, code]) | Warehouse code (unique per tenant) [CONTRADICTION-RESOLVED: EC-11 -- `@unique` on code means global uniqueness, not per-tenant. Must use composite unique `@@unique([tenantId, code])` for multi-tenant systems.] |
| name      | String   | Yes      | -          | -                    | Display name              |
| createdAt | DateTime | Yes      | now()      | -                    | -                         |
| updatedAt | DateTime | Yes      | @updatedAt | -                    | -                         |

**Indexes:**
- `@@index([tenantId])`

**Relations:**
- `InventoryItem[]` -- items stored here
- `locations[]` -> `Location[]`
- `stockMoves[]` -> `StockMove[]`
- `cycleCountPlans[]` -> `CycleCountPlan[]`
- `shipments[]` -> `Shipment[]`

**Disabled Warehouses** are stored in TenantConfig at `config.inventory.disabledWarehouses[warehouseId] = true`. `[SHORTCUT]`

#### 2.3.2 Location Entity (Prisma Model)

| Field       | Type     | Required | Default    | Constraints         | Notes                     |
|-------------|----------|----------|------------|---------------------|---------------------------|
| id          | String   | Yes      | cuid()     | @id                 | Primary key               |
| tenantId    | String   | Yes      | -          | -                   | Multi-tenant scoping      |
| warehouseId | String   | Yes      | -          | FK -> Warehouse     | Parent warehouse          |
| code        | String   | Yes      | -          | -                   | Location/bin code         |
| type        | String   | No       | null       | -                   | Location type             |
| createdAt   | DateTime | Yes      | now()      | -                   | -                         |
| updatedAt   | DateTime | Yes      | @updatedAt | -                   | -                         |

**Indexes:**
- `@@index([tenantId])`
- `@@index([warehouseId, code])`

**Relations:**
- `warehouse` -> `Warehouse`
- `InventoryItem[]`
- `fromTasks` -> `PickTask[]` (FromLocationTasks)
- `toTasks` -> `PickTask[]` (ToLocationTasks)
- `stockMovesFrom` -> `StockMove[]` (StockMoveFrom)
- `stockMovesTo` -> `StockMove[]` (StockMoveTo)
- `putawayTasksFrom` -> `PutawayTask[]` (PutawayFrom)
- `putawayTasksTo` -> `PutawayTask[]` (PutawayTo)
- `cycleCountLines` -> `CycleCountLine[]`

**Business Rules -- Warehouse:**
1. Code and name are required (422 "code_name_required"). `[COMPLETE]`
2. Code must be unique globally (409 "code_exists"). Note: `@unique` on code means global uniqueness, not per-tenant. `[SHORTCUT]` -- should be `@@unique([tenantId, code])`.
3. Only name can be updated; code is immutable after creation. `[COMPLETE]`
4. Disabled warehouse blocks adjustments. `[COMPLETE]`

#### 2.3.3 Warehouse API Operations

| Method | Path                                          | Description               | Permission               | Module Gate | Status       |
|--------|-----------------------------------------------|---------------------------|--------------------------|-------------|--------------|
| GET    | `/api/inventory/warehouses`                   | List warehouses (paginated)| `ui:finance_reports:view`| inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/warehouses`                   | Create warehouse          | `inventory:manage`       | inventory   | `[COMPLETE]` |
| GET    | `/api/inventory/warehouses/[warehouseId]`     | Get single warehouse      | varies                   | inventory   | `[COMPLETE]` |
| PUT    | `/api/inventory/warehouses/[warehouseId]`     | Update warehouse name     | `inventory:manage`       | inventory   | `[COMPLETE]` |

**Gaps & Issues:**
- `[SCHEMA-GAP]` Warehouse has no address, contact info, timezone, capacity, or status fields.
- `[SCHEMA-GAP]` Location has no capacity, zone, aisle, shelf, or status fields. The `type` field is undefined.
- `[MISSING]` No API endpoints for Location CRUD.
- `[MISSING]` No WarehouseZone model exists despite being mentioned in requirements. Locations are flat.
- `[SHORTCUT]` Warehouse code is globally unique rather than per-tenant unique.
- `[RECOMMEND]` Add proper warehouse address/config fields and Location management APIs.

#### 2.3.4 ASN (Advance Shipping Notice) Entity

| Field      | Type      | Required | Default  | Constraints     | Notes                    |
|------------|-----------|----------|----------|-----------------|--------------------------|
| id         | String    | Yes      | cuid()   | @id             | Primary key              |
| tenantId   | String    | Yes      | -        | -               | Multi-tenant scoping     |
| number     | String    | Yes      | -        | @unique         | ASN number               |
| supplierRef| String    | No       | null     | -               | Supplier reference       |
| status     | AsnStatus | Yes      | created  | enum            | Status                   |
| eta        | DateTime  | No       | null     | -               | Expected arrival         |
| receivedAt | DateTime  | No       | null     | -               | Actual receipt date      |
| createdAt  | DateTime  | Yes      | now()    | -               | -                        |
| updatedAt  | DateTime  | Yes      | @updatedAt| -              | -                        |

**ASN Status Lifecycle:**
```
created --> received --> closed
```

**Gaps:**
- `[STUBBED]` ASN model exists in schema but no server-side service or API routes were found. No CRUD operations implemented.
- `[MISSING]` No ASN lines/details model.
- `[MISSING]` No link between ASN and PurchaseOrder.

#### 2.3.5 Wave / Pick Task Entities

**Wave:**

| Field     | Type       | Required | Default  | Constraints | Notes               |
|-----------|------------|----------|----------|-------------|---------------------|
| id        | String     | Yes      | cuid()   | @id         | Primary key         |
| tenantId  | String     | Yes      | -        | -           | Multi-tenant        |
| number    | String     | Yes      | -        | @unique     | Wave number         |
| status    | WaveStatus | Yes      | planned  | enum        | Status              |
| createdAt | DateTime   | Yes      | now()    | -           | -                   |
| updatedAt | DateTime   | Yes      | @updatedAt| -          | -                   |

**Wave Status:**
```
planned --> released --> dispatched
```

**PickTask:**

| Field     | Type       | Required | Default  | Constraints         | Notes                  |
|-----------|------------|----------|----------|---------------------|------------------------|
| id        | String     | Yes      | cuid()   | @id                 | Primary key            |
| tenantId  | String     | Yes      | -        | -                   | Multi-tenant           |
| waveId    | String     | No       | null     | FK -> Wave          | Parent wave            |
| sku       | String     | Yes      | -        | -                   | SKU to pick            |
| qty       | Decimal    | Yes      | -        | -                   | Quantity to pick       |
| fromLocId | String     | No       | null     | FK -> Location      | Source location        |
| toLocId   | String     | No       | null     | FK -> Location      | Destination location   |
| status    | PickStatus | Yes      | queued   | enum                | Status                 |
| createdAt | DateTime   | Yes      | now()    | -                   | -                      |
| updatedAt | DateTime   | Yes      | @updatedAt| -                  | -                      |

**Pick Status:**
```
queued --> picked
           short (insufficient stock)
           cancelled
```

**Gaps:**
- `[STUBBED]` Wave and PickTask Prisma models exist but no server-side service files or API routes are implemented for the Prisma-backed versions.
- The actual pick/pack/ship logic is in `pickPackShipStore.ts` which uses file-based JSON storage (see 2.3.7).

#### 2.3.6 PutawayTask Entity

| Field          | Type     | Required | Default  | Constraints       | Notes                    |
|----------------|----------|----------|----------|--------------------|--------------------------|
| id             | String   | Yes      | cuid()   | @id                | Primary key              |
| tenantId       | String   | Yes      | -        | -                  | Multi-tenant             |
| grnId          | String   | No       | null     | -                  | ASN/GRN reference        |
| sku            | String   | Yes      | -        | -                  | SKU to put away          |
| qty            | Decimal  | Yes      | -        | -                  | Quantity                 |
| fromLocationId | String   | No       | null     | FK -> Location     | Staging area             |
| toLocationId   | String   | Yes      | -        | FK -> Location     | Target bin               |
| status         | String   | Yes      | "pending"| -                  | Status                   |
| assignedTo     | String   | No       | null     | -                  | User ID assigned         |
| completedAt    | DateTime | No       | null     | -                  | Completion timestamp     |
| completedBy    | String   | No       | null     | -                  | Completing user ID       |
| createdAt      | DateTime | Yes      | now()    | -                  | -                        |
| updatedAt      | DateTime | Yes      | @updatedAt| -                 | -                        |

**Status Lifecycle:**
```
pending --> in_progress --> completed
                           cancelled
```

**Gaps:**
- `[STUBBED]` PutawayTask model exists in schema but putaway is implemented via `wmsReceiving.service.ts` `confirmPutaway()` which does a stock transfer rather than using PutawayTask records.

#### 2.3.7 Pick/Pack/Ship (File-Based Store -- `pickPackShipStore.ts`)

This is a separate implementation from the Prisma-backed Wave/PickTask models. It uses file-based JSON storage in `apps/web/.data/supply/pick-pack-ship/`.

**PickWave type:**
- id, tenantId, createdAt, createdBy, status ("open" | "closed"), salesOrderIds[], warehouseId?

**PickTask type:**
- id, tenantId, waveId, salesOrderId, sku, quantityRequired, quantityPicked, pickerUserId?, status ("queued" | "in_progress" | "completed")

**PackRecord type:**
- id, tenantId, waveId, salesOrderId, packedByUserId, packedAt, items[]

**Shipment type (supply):**
- id, tenantId, waveId, salesOrderId, carrier?, trackingNumber?, shippedAt

**Operations:**
- `createWave(tenantId, createdBy, salesOrderIds, warehouseId)` -- creates pick wave
- `listWaves(tenantId)` -- lists waves
- `assignTasks(tenantId, waveId, tasks)` -- assigns pick tasks
- `completeTask(tenantId, taskId, pickerUserId, qtyPicked?)` -- marks task complete
- `recordPack(tenantId, waveId, salesOrderId, items, packedByUserId)` -- records packing
- `createShipment(tenantId, waveId, salesOrderId, carrier?, trackingNumber?)` -- records shipment
- `listPacks/listShipments/closeWave`

**Gaps:**
- `[SHORTCUT]` Entire pick/pack/ship workflow uses file-system JSON storage, not database-backed. [CONTRADICTION-RESOLVED: DE-7 -- Two parallel shipment systems exist: (1) DB-backed WMS at `/api/wms/shipments/` using Prisma Shipment/ShipmentLine models, and (2) file-based WMS at `/api/inventory/wms/shipping/` using file-system JSON. The DB-backed system is canonical. BG-14: pick behavior also differs -- createPick() issues stock immediately but pickShipment() does not.]
- `[GAP]` No integration between file-based pick/pack/ship and Prisma-backed inventory movements.
- `[RECOMMEND]` Migrate to database-backed models using existing Wave, PickTask, Shipment Prisma models.

#### 2.3.8 WMS Receiving (`wmsReceiving.service.ts`)

Handles PO-line receiving and putaway.

**`listOpenPurchaseOrdersForTenant(tenantId)`:**
- Returns open POs (status != "closed") with lines, limited to 50, ordered by createdAt desc.
- Requires `inventory` plan feature.

**`receivePurchaseOrderLines(params)`:**
1. Requires `inventory` plan feature.
2. PO must exist for tenant (404).
3. For each line where qty > 0:
   - Calls `receiveStock()` from movements.service (creates StockMove, updates InventoryItem, updates cost state).
   - Uses PO line price as `unitCostMinor`.
   - Creates a receiving config record with status "received".
4. Persists receipts to TenantConfig JSON under `inventoryReceiving.receipts[]`.

**`confirmPutaway(params)`:**
1. Requires `inventory` plan feature.
2. Finds receipt by ID. If missing, returns idempotent no-op `{ ok: true }`.
3. If already "putaway", returns idempotent success.
4. Calls `transferStock()` to move from receiving location to target location.
5. Updates receipt status to "putaway" with timestamp.

**Gaps:**
- `[SHORTCUT]` Receiving records stored in TenantConfig JSON, not in PutawayTask or dedicated table.
- `[GAP]` No over-receiving validation (qty received vs PO line qty).
- `[GAP]` No partial receiving tracking per PO line.

#### 2.3.9 WMS Shipping (`wmsShipping.service.ts`)

Handles sales-order-driven picking and shipping.

**`listOpenSalesOrdersForTenant(tenantId)`:**
- Returns SOs with status "confirmed" or "draft", limited to 50.

**`createPick(params)`:**
1. SO must exist (404).
2. For each line where qty > 0:
   - Calls `issueStock()` (decrements inventory, creates StockMove, posts GL COGS/INV journal).
3. Creates Shipment record in database with status "picked" and ShipmentLines.
4. Also persists pick config to TenantConfig JSON under `inventoryShipping.shipments[]`.

**`confirmShipment(params)`:**
1. Shipment must exist (404).
2. Updates Shipment status to "shipped", sets shippedAt and carrier.
3. Updates all ShipmentLine.shippedQty = pickedQty.
4. Updates shipping config status to "shipped".

#### 2.3.10 WMS Shipment Entities (Prisma Models)

**Shipment:**

| Field       | Type     | Required | Default    | Constraints       | Notes                     |
|-------------|----------|----------|------------|--------------------|---------------------------|
| id          | String   | Yes      | cuid()     | @id                | Primary key               |
| tenantId    | String   | Yes      | -          | -                  | Multi-tenant              |
| number      | String   | Yes      | -          | @unique            | Shipment number           |
| orderId     | String   | No       | null       | -                  | Sales order ID            |
| orderType   | String   | No       | null       | -                  | "sales_order", "work_order", "transfer" |
| warehouseId | String   | Yes      | -          | FK -> Warehouse    | Source warehouse          |
| carrier     | String   | No       | null       | -                  | Carrier name              |
| tracking    | String   | No       | null       | -                  | Tracking number           |
| status      | String   | Yes      | "pending"  | -                  | Status                    |
| shippedAt   | DateTime | No       | null       | -                  | Ship timestamp            |
| deliveredAt | DateTime | No       | null       | -                  | Delivery timestamp        |
| createdAt   | DateTime | Yes      | now()      | -                  | -                         |
| updatedAt   | DateTime | Yes      | @updatedAt | -                  | -                         |
| createdBy   | String   | No       | null       | -                  | Creator user ID           |

**Shipment Status Lifecycle:**
```
pending --> picked --> packed --> shipped --> delivered
                                             cancelled
```

Note: `packed` status exists in schema comment but is not used in code. Picking goes directly to shipping.

**ShipmentLine:**

| Field      | Type     | Required | Default | Constraints                    | Notes              |
|------------|----------|----------|---------|--------------------------------|--------------------|
| id         | String   | Yes      | cuid()  | @id                            | Primary key        |
| shipmentId | String   | Yes      | -       | FK -> Shipment                 | Parent shipment    |
| lineNo     | Int      | Yes      | -       | @@unique([shipmentId, lineNo]) | Line number        |
| sku        | String   | Yes      | -       | -                              | SKU shipped        |
| qty        | Decimal  | Yes      | -       | -                              | Ordered quantity   |
| pickedQty  | Decimal  | Yes      | 0       | -                              | Picked quantity    |
| packedQty  | Decimal  | Yes      | 0       | -                              | Packed quantity    |
| shippedQty | Decimal  | Yes      | 0       | -                              | Shipped quantity   |
| createdAt  | DateTime | Yes      | now()   | -                              | -                  |
| updatedAt  | DateTime | Yes      | @updatedAt| -                            | -                  |

#### 2.3.11 WMS Shipments Server Module (`wms/shipments.ts`)

Provides WMS-oriented shipment operations using the Prisma Shipment model.

**Functions:**
- `createShipment(input)` -- Creates shipment with lines. Validates lines not empty, warehouse not disabled.
- `listShipments(tenantId, opts)` -- Paginated list.
- `getShipment(tenantId, shipmentId)` -- Single shipment with lines.
- `updateShipment(tenantId, shipmentId, input)` -- Update tracking reference.
- `pickShipment(tenantId, shipmentId)` -- Validates availability (available = on-hand - quarantine). Sets status "picked". Does NOT record stock moves.
- `shipShipment(tenantId, shipmentId)` -- Validates availability again, records `issue` movements for each line, updates ShipmentLine.shippedQty and pickedQty, sets status "shipped".
- `cancelShipment(tenantId, shipmentId)` -- Sets status "cancelled". Cannot cancel if already shipped.

**Business Rules:**
- Cannot pick/ship disabled items or from disabled warehouses (409).
- Available qty = on-hand minus quarantine. `[COMPLETE]`
- Cannot ship if already shipped (409) or cancelled (409).
- Cannot cancel if already shipped (409).

#### 2.3.12 WMS API Operations

| Method | Path                                                  | Description                         | Permission               | Status       |
|--------|-------------------------------------------------------|-------------------------------------|--------------------------|--------------|
| GET    | `/api/wms/shipments`                                  | List WMS shipments                  | `ui:finance_reports:view`| `[COMPLETE]` |
| POST   | `/api/wms/shipments`                                  | Create WMS shipment                 | `inventory:manage`       | `[COMPLETE]` |
| GET    | `/api/wms/shipments/[shipmentId]`                     | Get WMS shipment details            | `ui:finance_reports:view`| `[COMPLETE]` |
| PUT    | `/api/wms/shipments/[shipmentId]`                     | Update WMS shipment                 | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/shipments/[shipmentId]/pick`                | Pick shipment                       | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/shipments/[shipmentId]/ship`                | Ship shipment                       | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/shipments/[shipmentId]/cancel`              | Cancel shipment                     | `inventory:manage`       | `[COMPLETE]` |
| GET    | `/api/inventory/wms/shipping/open-sos`                | List open sales orders for shipping | `inventory:adjust`       | `[COMPLETE]` |
| POST   | `/api/inventory/wms/shipping/pick`                    | Pick from sales order               | `inventory:adjust`       | `[COMPLETE]` |
| POST   | `/api/inventory/wms/shipping/ship`                    | Confirm shipment                    | `inventory:adjust`       | `[COMPLETE]` |
| POST   | `/api/inventory/wms/receiving/grn`                    | Receive PO lines                    | `inventory:receive_grn`  | `[COMPLETE]` |
| POST   | `/api/inventory/wms/receiving/putaway`                | Confirm putaway                     | `inventory:receive_grn`  | `[COMPLETE]` |

**Gaps & Issues:**
- `[GAP]` Two parallel shipment systems exist: WMS (`/api/wms/shipments/`) and inventory WMS shipping (`/api/inventory/wms/shipping/`). They use different code paths.
- `[GAP]` `pickShipment()` in WMS does NOT actually record stock movements or decrement inventory. It only validates and changes status. The actual deduction happens at `shipShipment()`.
- `[GAP]` `createPick()` in the shipping service immediately issues stock (decrements inventory) at pick time, while `pickShipment()` in WMS module does not. Inconsistent behavior.
- `[MISSING]` No pack step in WMS -- status goes directly from "picked" to "shipped". The `packedQty` field on ShipmentLine is never used.
- `[FRONTEND-GAP]` File-based pick/pack/ship (supply lib) not connected to database-backed WMS.

---

### 2.4 Stock Transfers

#### 2.4.1 Transfer Records (Config-Based -- `transfers.ts`)

Transfers between warehouses are tracked in TenantConfig JSON at `config.inventory.transfers[id]`. [CONTRADICTION-RESOLVED: CR-14 -- Two separate transfer mechanisms exist: (1) this config-based two-step transfer (created->shipped->received) and (2) an immediate single-step transfer via the movements API (`POST /api/inventory/movements/transfer`). They do not share state. A transfer started in one mechanism cannot be tracked or completed in the other. The two-step config-based mechanism here is the more complete business process. New project should consolidate to a single DB-backed transfer mechanism with proper two-step flow.]

**TransferRecord type:**
- id: string (auto-generated `tx-{timestamp}-{random}`)
- tenantId: string
- fromWarehouseId: string
- toWarehouseId: string
- status: "created" | "shipped" | "received"
- lines: `{ sku: string, qty: string }[]`

**Status Lifecycle:**
```
created --> shipped --> received
```

**`createTransfer(input)` Business Rules:**
1. Lines array must not be empty (422 "lines_required").
2. Both warehouses must exist and belong to tenant (calls `getWarehouse()`).
3. Each line must have a non-empty SKU and qty > 0 (422 "invalid_line").
4. Transfer record is stored in TenantConfig JSON.

**`shipTransfer(tenantId, transferId)` Business Rules:**
1. Status must be "created" (409 "invalid_status").
2. For each line, verifies item exists and sufficient on-hand at source warehouse.
3. Records `transfer_out` movements for each line.
4. Updates status to "shipped".

**`receiveTransfer(tenantId, transferId)` Business Rules:**
1. Status must be "shipped" (409 "invalid_status").
2. Records `transfer_in` movements for each line at destination warehouse.
3. Updates status to "received".

#### 2.4.2 Transfer API Operations

| Method | Path                                             | Description                  | Permission               | Module Gate | Status       |
|--------|--------------------------------------------------|------------------------------|--------------------------|-------------|--------------|
| GET    | `/api/inventory/transfers`                       | List transfers               | `ui:finance_reports:view`| inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/transfers`                       | Create transfer              | `inventory:manage`       | inventory   | `[COMPLETE]` |
| GET    | `/api/inventory/transfers/[transferId]`           | Get transfer details         | varies                   | inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/transfers/[transferId]/ship`      | Ship transfer                | `inventory:manage`       | inventory   | `[COMPLETE]` |
| POST   | `/api/inventory/transfers/[transferId]/receive`   | Receive transfer             | `inventory:manage`       | inventory   | `[COMPLETE]` |

**Gaps & Issues:**
- `[SHORTCUT]` Transfer records stored in TenantConfig JSON, not in a dedicated database table.
- `[GAP]` Two separate transfer mechanisms: `transfers.ts` (config-based, two-step ship/receive) and `movements.service.ts` `transferStock()` (immediate, single-step). They don't share state.
- `[MISSING]` No cancel/void transfer operation.
- `[RECOMMEND]` Consolidate into a single transfer mechanism with proper database backing.

---

### 2.5 Quality Control

#### 2.5.1 QualityInspection Entity (Prisma Model)

| Field     | Type          | Required | Default | Constraints                     | Notes                      |
|-----------|---------------|----------|---------|---------------------------------|----------------------------|
| id        | String        | Yes      | cuid()  | @id                             | Primary key                |
| tenantId  | String        | Yes      | -       | -                               | Multi-tenant               |
| docType   | String        | Yes      | -       | -                               | Document type              |
| docId     | String        | Yes      | -       | -                               | Document ID                |
| status    | QualityStatus | Yes      | open    | enum                            | Inspection status          |
| findings  | Json          | No       | null    | -                               | Inspection findings        |
| createdAt | DateTime      | Yes      | now()   | -                               | -                          |
| updatedAt | DateTime      | Yes      | @updatedAt| -                             | -                          |

**QualityStatus enum:**
```
open --> accepted
         rejected
         released
         in_progress --> completed
```

#### 2.5.2 QualityHold Entity (Prisma Model)

| Field     | Type          | Required | Default | Constraints            | Notes                    |
|-----------|---------------|----------|---------|------------------------|--------------------------|
| id        | String        | Yes      | cuid()  | @id                    | Primary key              |
| tenantId  | String        | Yes      | -       | -                      | Multi-tenant             |
| sku       | String        | No       | null    | -                      | SKU on hold              |
| lotId     | String        | No       | null    | -                      | Lot/batch on hold        |
| reason    | String        | Yes      | -       | -                      | Reason for hold          |
| status    | QualityStatus | Yes      | open    | enum                   | Hold status              |
| createdAt | DateTime      | Yes      | now()   | -                      | -                        |
| updatedAt | DateTime      | Yes      | @updatedAt| -                    | -                        |

#### 2.5.3 CAPA Entity (Prisma Model)

| Field     | Type          | Required | Default | Constraints            | Notes                        |
|-----------|---------------|----------|---------|------------------------|------------------------------|
| id        | String        | Yes      | cuid()  | @id                    | Primary key                  |
| tenantId  | String        | Yes      | -       | -                      | Multi-tenant                 |
| title     | String        | Yes      | -       | -                      | CAPA title                   |
| rootCause | String        | No       | null    | -                      | Root cause analysis          |
| actions   | Json          | No       | null    | -                      | Corrective/Preventive actions|
| ownerId   | String        | No       | null    | -                      | Owner user ID                |
| status    | QualityStatus | Yes      | open    | enum                   | CAPA status                  |
| createdAt | DateTime      | Yes      | now()   | -                      | -                            |
| updatedAt | DateTime      | Yes      | @updatedAt| -                    | -                            |

#### 2.5.4 Quarantine & Quality Holds (WMS Helpers)

Quality holds use a dual storage mechanism:
1. **TenantConfig JSON** at `config.wms.quarantine[warehouseId][sku]` -- stores quarantined qty
2. **TenantConfig JSON** at `config.wms.holds[]` -- stores hold records
3. **QualityHold Prisma model** -- also stores the hold

**Hold Record type (in TenantConfig):**
- id: string (auto-generated)
- warehouseId: string
- sku: string
- qty: string (decimal as string)
- status: "hold" | "released" | "rejected"
- reason: string | null
- createdAt: string (ISO)

**Available Quantity Computation:**
```
available = onHand - quarantine
```
Where quarantine is the sum of held quantities for that SKU+warehouse.

**`createHold(input)` Business Rules:**
1. Warehouse and SKU must not be disabled (409).
2. Qty must be > 0 (422 "qty_required").
3. Available qty must be >= hold qty (409 "insufficient_available").
4. Increments quarantine for the sku+warehouse.
5. Creates hold record in TenantConfig. [CONTRADICTION-RESOLVED: CR-12 -- Quarantine data stored in BOTH TenantConfig JSON AND QualityHold Prisma model. The QualityHold Prisma model is canonical. TenantConfig storage should be deprecated to avoid dual sources of truth.]
6. Creates QualityHold Prisma record with status "open". [CONTRADICTION-RESOLVED: CR-12 -- This is the canonical storage.]

**`releaseHold(tenantId, holdId)` Business Rules:**
1. Hold must exist (404) and be in "hold" status (409).
2. Decrements quarantine (releases qty back to available).
3. Updates hold record to "released".
4. Updates QualityHold Prisma records to "released".

**`rejectHold(tenantId, holdId)` Business Rules:**
1. Hold must exist (404) and be in "hold" status (409).
2. Decrements quarantine.
3. Records an `adjustment_out` movement (stock is removed from inventory).
4. Updates hold record to "rejected".
5. Updates QualityHold Prisma records to "rejected".

**Hold Status Lifecycle:**
```
hold --> released  (qty goes back to available)
         rejected  (qty removed from inventory via adjustment_out)
```

#### 2.5.5 Quality API Operations

| Method | Path                                              | Description            | Permission               | Status       |
|--------|---------------------------------------------------|------------------------|--------------------------|--------------|
| GET    | `/api/wms/quality/holds`                          | List quality holds     | `ui:finance_reports:view`| `[COMPLETE]` |
| POST   | `/api/wms/quality/holds`                          | Create quality hold    | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/quality/holds/[holdId]/release`         | Release hold           | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/quality/holds/[holdId]/reject`          | Reject hold            | `inventory:manage`       | `[COMPLETE]` |

**Gaps & Issues:**
- `[SHORTCUT]` Quarantine and hold data stored in TenantConfig JSON. Also duplicated in QualityHold Prisma model. Two sources of truth.
- `[STUBBED]` QualityInspection model exists in schema but has no service or API implementation.
- `[STUBBED]` CAPA model exists in schema but has no service or API implementation.
- `[MISSING]` No quality inspection workflow (create inspection, record findings, accept/reject).
- `[MISSING]` No link between quality holds and lot/batch tracking.
- `[GAP]` `QualityHold.updateMany()` matches by sku+reason which could affect multiple holds.
- `[RECOMMEND]` Implement QualityInspection workflow with full CRUD and tie to receiving process.

---

### 2.6 Cycle Counting

#### 2.6.1 CycleCountPlan Entity (Prisma Model)

| Field       | Type     | Required | Default    | Constraints                   | Notes                      |
|-------------|----------|----------|------------|-------------------------------|----------------------------|
| id          | String   | Yes      | cuid()     | @id                           | Primary key                |
| tenantId    | String   | Yes      | -          | -                             | Multi-tenant               |
| warehouseId | String   | Yes      | -          | FK -> Warehouse               | Target warehouse           |
| name        | String   | Yes      | -          | -                             | Plan name                  |
| frequency   | String   | Yes      | -          | -                             | daily, weekly, monthly, ad_hoc |
| status      | String   | Yes      | "planned"  | -                             | Status                     |
| startDate   | DateTime | Yes      | -          | -                             | Start date                 |
| endDate     | DateTime | No       | null       | -                             | End date                   |
| createdAt   | DateTime | Yes      | now()      | -                             | -                          |
| updatedAt   | DateTime | Yes      | @updatedAt | -                             | -                          |
| createdBy   | String   | No       | null       | -                             | Creator user ID            |

**Indexes:**
- `@@index([tenantId, warehouseId])`
- `@@index([tenantId, status])`
- `@@index([tenantId, startDate])`

#### 2.6.2 CycleCountLine Entity (Prisma Model)

| Field       | Type     | Required | Default    | Constraints                   | Notes                      |
|-------------|----------|----------|------------|-------------------------------|----------------------------|
| id          | String   | Yes      | cuid()     | @id                           | Primary key                |
| planId      | String   | Yes      | -          | FK -> CycleCountPlan          | Parent plan                |
| sku         | String   | Yes      | -          | -                             | SKU being counted          |
| locationId  | String   | No       | null       | FK -> Location                | Location scope             |
| expectedQty | Decimal  | Yes      | -          | -                             | System on-hand at count start |
| countedQty  | Decimal  | No       | null       | -                             | Actual count (entered)     |
| varianceQty | Decimal  | Yes      | 0          | -                             | countedQty - expectedQty   |
| status      | String   | Yes      | "pending"  | -                             | Line status                |
| countedAt   | DateTime | No       | null       | -                             | Count timestamp            |
| countedBy   | String   | No       | null       | -                             | Counter user ID            |
| approvedAt  | DateTime | No       | null       | -                             | Approval timestamp         |
| approvedBy  | String   | No       | null       | -                             | Approver user ID           |
| createdAt   | DateTime | Yes      | now()      | -                             | -                          |
| updatedAt   | DateTime | Yes      | @updatedAt | -                             | -                          |

**Indexes:**
- `@@index([planId])`
- `@@index([planId, status])`

#### 2.6.3 Cycle Count Lifecycle

**Plan Status Lifecycle:**
```
draft --> counting --> posted
                       cancelled
```

Note: The schema default is "planned" but `createCycleCount()` sets it to "draft". `startCycleCount()` transitions to "counting". Code uses "posted" and "cancelled" as terminal states.

**Line Status Lifecycle:**
```
pending --> counted --> approved
                        rejected
```

#### 2.6.4 Cycle Count Business Rules

**`createCycleCount(input)` (`wms/cycleCounts.ts`):**
1. Lines must not be empty (422 "lines_required").
2. Warehouse must not be disabled.
3. Creates CycleCountPlan with status "draft", frequency "ad_hoc".
4. Creates CycleCountLines with SKU and countedQty from input.

**`startCycleCount(tenantId, planId):`**
1. Plan must not be "posted" or "cancelled" (409 "invalid_status").
2. For each line, verifies item/warehouse not disabled.
3. Captures `expectedQty` = current available qty (on-hand minus quarantine).
4. Sets plan status to "counting".

**`updateCycleCount(tenantId, planId, lines):`**
1. Plan must not be "posted" or "cancelled" (409).
2. Updates `countedQty` on each CycleCountLine and sets line status to "counted".

**`postCycleCount(tenantId, planId):`**
1. Plan must not already be "posted" (409 "already_posted") or "cancelled" (409).
2. For each line, computes `variance = countedQty - expectedQty`.
3. If variance != 0, records `adjustment_in` or `adjustment_out` movement with reference `cycle:{planId}`.
4. Sets line status to "approved" and stores varianceQty.
5. Sets plan status to "posted".

**`cancelCycleCount(tenantId, planId):`**
1. Plan must not be "posted" (409 "already_posted").
2. Sets status to "cancelled".

#### 2.6.5 Cycle Count (File-Based Store -- `cycleStore.ts`)

A separate file-based implementation exists in `apps/web/.data/cycle/`. [CONTRADICTION-RESOLVED: CR-13 -- Two parallel cycle count implementations exist: database-backed (Section 2.6.1-2.6.4) and file-based (this section). The database-backed implementation is canonical. Cycle counts performed in the file-based system are invisible to the DB-backed system. New project should use only the DB-backed implementation.]

**CyclePlan type:**
- id, tenantId, warehouseId, title, scheduledAt, frequency ("DAILY"|"WEEKLY"|"MONTHLY"), items[], status ("planned"|"in_progress"|"completed"|"posted"), counts?, variances?

**Operations:**
- `listPlans(tenantId)` -- list all plans
- `createPlan(tenantId, input)` -- create plan with status "planned"
- `recordCounts(tenantId, planId, counts)` -- records counted quantities, computes variances, status -> "in_progress"
- `markPosted(tenantId, planId)` -- status -> "posted"

#### 2.6.6 Cycle Count API Operations

| Method | Path                                             | Description                  | Permission               | Status       |
|--------|--------------------------------------------------|------------------------------|--------------------------|--------------|
| GET    | `/api/wms/cycle-counts`                          | List cycle count plans       | `ui:finance_reports:view`| `[COMPLETE]` |
| POST   | `/api/wms/cycle-counts`                          | Create cycle count plan      | `inventory:manage`       | `[COMPLETE]` |
| GET    | `/api/wms/cycle-counts/[countId]`                | Get cycle count details      | `ui:finance_reports:view`| `[COMPLETE]` |
| POST   | `/api/wms/cycle-counts/[countId]/start`          | Start counting               | `inventory:manage`       | `[COMPLETE]` |
| PUT    | `/api/wms/cycle-counts/[countId]`                | Update counted quantities    | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/cycle-counts/[countId]/post`           | Post cycle count (apply adj) | `inventory:manage`       | `[COMPLETE]` |
| POST   | `/api/wms/cycle-counts/[countId]/cancel`         | Cancel cycle count           | `inventory:manage`       | `[COMPLETE]` |

**Gaps & Issues:**
- `[SHORTCUT]` Two parallel cycle count implementations: database-backed (`wms/cycleCounts.ts`) and file-based (`supply/cycleStore.ts`).
- `[GAP]` Database-backed cycle count does not record GL journal entries for variances.
- `[GAP]` No scheduled/recurring cycle count automation -- all counts are ad-hoc.
- `[GAP]` No approval workflow for cycle count variances above a threshold.
- `[RECOMMEND]` Consolidate into database-backed implementation and add GL posting for adjustments.

---

### 2.7 Reservations / ATP (Available to Promise)

#### 2.7.1 Reservation Entity (Prisma Model)

| Field       | Type     | Required | Default    | Constraints               | Notes                      |
|-------------|----------|----------|------------|---------------------------|----------------------------|
| id          | String   | Yes      | cuid()     | @id                       | Primary key                |
| tenantId    | String   | Yes      | -          | -                         | Multi-tenant               |
| orderId     | String   | No       | null       | FK -> SalesOrder          | Sales order                |
| orderLineId | String   | No       | null       | FK -> SalesOrderLine      | Sales order line           |
| sku         | String   | Yes      | -          | -                         | SKU reserved               |
| qty         | Decimal  | Yes      | -          | -                         | Reserved quantity          |
| warehouseId | String   | No       | null       | -                         | Warehouse                  |
| status      | String   | Yes      | "reserved" | -                         | reserved, allocated, shipped, cancelled |
| createdAt   | DateTime | Yes      | now()      | -                         | -                          |
| updatedAt   | DateTime | Yes      | @updatedAt | -                         | -                          |

**Indexes:**
- `@@index([tenantId, orderId])`
- `@@index([tenantId, sku])`

**Reservation Status:**
```
reserved --> allocated --> shipped
                           cancelled
```

#### 2.7.2 ATP Computation (`reservations.service.ts`)

**InventorySnapshot type:**
- sku: string
- warehouseId: string | null
- onHand: number
- reserved: number
- available: number (= onHand - reserved)

**`getInventorySnapshot(params)`:**
1. Requires `inventory` plan feature.
2. Computes `onHand` by summing InventoryItem.qtyOnHand.
3. Computes `reserved` by scanning Shipments with status "pending" or "picked" and summing `pickedQty - shippedQty` for matching SKU lines.
4. `available = onHand - reserved`.

**`computeATP(params)`:**
- Computes inventory snapshot for multiple SKUs.
- Returns Record<sku, InventorySnapshot>.

#### 2.7.3 ATP API Operations

| Method | Path                        | Description                  | Permission             | Status       |
|--------|-----------------------------|------------------------------|------------------------|--------------|
| GET    | `/api/inventory/atp`        | Get ATP for a single SKU     | `inventory:transfer`   | `[COMPLETE]` |

**Zod Schema:**
- `{ sku: string(min=1), warehouseId?: string }`

**Gaps & Issues:**
- `[GAP]` Reservation model exists in schema but has no CRUD API or service. ATP does NOT use the Reservation model -- it derives reserved qty from Shipment data.
- `[GAP]` No endpoint for multiple-SKU ATP batch query (despite `computeATP` accepting an array).
- `[GAP]` ATP does not consider incoming supply (open PO lines) or demand (open SO lines) -- only current on-hand minus in-flight shipments.
- `[MISSING]` No reservation creation/management API.
- `[MISSING]` SalesOrderLine has `reservedQty` and `backorderQty` fields but they are never written to.
- `[RECOMMEND]` Implement full ATP with supply/demand netting: onHand - reserved - openDemand + incomingSupply.
- `[RECOMMEND]` Build Reservation CRUD and integrate with sales order and shipment workflows.

---

### 2.8 Lot / Batch Tracking

#### 2.8.1 InventoryLot Entity (Prisma Model)

| Field       | Type     | Required | Default    | Constraints                        | Notes                        |
|-------------|----------|----------|------------|------------------------------------|------------------------------|
| id          | String   | Yes      | cuid()     | @id                                | Primary key                  |
| tenantId    | String   | Yes      | -          | -                                  | Multi-tenant                 |
| sku         | String   | Yes      | -          | -                                  | SKU reference                |
| lotNumber   | String   | No       | null       | -                                  | Lot/batch number             |
| qty         | Decimal  | Yes      | 0          | -                                  | Current qty in this lot      |
| unitCost    | Decimal  | Yes      | 0          | -                                  | Unit cost at receipt         |
| receivedAt  | DateTime | Yes      | now()      | -                                  | Receipt timestamp            |
| warehouseId | String   | No       | null       | -                                  | Warehouse                   |
| locationId  | String   | No       | null       | -                                  | Location                     |
| createdAt   | DateTime | Yes      | now()      | -                                  | -                            |
| updatedAt   | DateTime | Yes      | @updatedAt | -                                  | -                            |

**Indexes:**
- `@@index([tenantId, sku, receivedAt])`

**Relations:**
- `stockMoves` -> `StockMove[]` (via lotId)
- `workOrderMaterialIssues` -> `WorkOrderMaterialIssue[]` (via lotId)

#### 2.8.2 Lot Business Rules

1. **Lots created at GRN**: `postGoodsReceipt()` creates an InventoryLot with qty, unitCost, and receivedAt. `[COMPLETE]`
2. **Lots used for costing**: `getWeightedAverageCost()` and `averageCost()` compute WAV from lots. `[COMPLETE]`
3. **FIFO depletion**: `applyFifoCost()` depletes lots in `receivedAt` ascending order. `[COMPLETE]`
4. **Lot linkage**: StockMove has optional `lotId` FK but it is rarely populated by movement services. `[PARTIAL]`
5. **WorkOrder material issues** can reference a lotId. `[COMPLETE]`

**Gaps & Issues:**
- `[GAP]` `trackBatch` flag on item metadata is stored but never enforced. Lots are created for ALL GRN receipts, not just batch-tracked items.
- `[MISSING]` No lot number generation or assignment logic. `lotNumber` is always null in GRN flow.
- `[MISSING]` No lot/batch query API endpoint.
- `[MISSING]` No serial number tracking despite `trackSerial` flag in metadata.
- `[MISSING]` No expiry date on lots.
- `[SCHEMA-GAP]` InventoryLot has no fields for: expiryDate, batchStatus, manufacturer, supplier, qualityStatus.
- `[RECOMMEND]` Add lot number generation, expiry tracking, and enforce batch/serial requirements per item.

---

### 2.9 Costing

#### 2.9.1 Cost State Model (Service Layer)

Cost state is stored in TenantConfig JSON at `config.inventory.costing[sku:warehouseId]`.

**CostState type:**

| Field          | Type   | Description                                 |
|----------------|--------|---------------------------------------------|
| totalQty       | number | Total quantity on hand (for cost computation)|
| totalCostMinor | number | Total cost in minor currency units           |
| avgCostMinor   | number | Weighted average unit cost (floor division)  |

#### 2.9.2 Cost State Computation (`costing.service.ts`)

**`applyMovementToCostState(current, movement)` -- Pure function:**

| Movement Type  | Direction | Computation                                                  |
|----------------|-----------|--------------------------------------------------------------|
| GRN            | Inbound   | totalQty += qty; totalCost += qty * unitCost                 |
| TRANSFER_IN    | Inbound   | totalQty += qty; totalCost += qty * unitCost                 |
| ADJUSTMENT (+) | Inbound   | totalQty += qty; totalCost += qty * (unitCost or avgCost)    |
| ISSUE          | Outbound  | totalQty -= qty; totalCost -= qty * avgCost                  |
| TRANSFER_OUT   | Outbound  | totalQty -= qty; totalCost -= qty * avgCost                  |
| ADJUSTMENT (-) | Outbound  | totalQty -= qty; totalCost -= qty * avgCost                  |

**Clamping rules:**
- If totalQty <= 0 or totalCost <= 0, all three fields reset to 0.
- avgCostMinor = floor(totalCostMinor / totalQty).

**`getCostStateForItem(tenantId, itemId, warehouseId)`:**
1. Reads from TenantConfig JSON.
2. If not found, falls back to computing WAV from InventoryLot records.
3. Returns null if no data found.

**`rebuildCostState(tenantId, itemId, warehouseId, lots?)`:**
- Rebuilds cost state from lot data. Persists result.

**`getCurrentCostForIssue(tenantId, itemId, warehouseId)`:**
- Returns avgCostMinor for the item. Used by issue flows.

#### 2.9.3 Valuation (`valuation.ts`)

**`getWeightedAverageCost(tenantId, sku)` -- Weighted Average Cost:**
- Fetches all InventoryLot records for sku.
- totalCost = sum(qty * unitCost), totalQty = sum(qty).
- Returns Math.round(totalCost / totalQty) or 0.

**`computeCogsForSkus(tenantId, items)` -- COGS Computation:**
- For each sku, gets WAV cost and multiplies by qty.
- Returns array of `{ sku, qtyMinor, costPerUnitMinor, totalCostMinor }`.

#### 2.9.4 FIFO Costing (`costing/cost.ts`)

**`applyFifoCost(tenantId, sku, issueQty)`:**
1. Fetches all lots ordered by `receivedAt asc` (FIFO).
2. Depletes lots in order: takes min(lotQty, remaining) from each lot.
3. Updates lot qty in database.
4. If insufficient total lot qty, throws "Insufficient inventory for FIFO issue".
5. Returns totalCost.

**`averageCost(tenantId, sku)`:**
- Computes weighted average from lots. Returns `value / qty` or 0.

#### 2.9.5 Valuation Reports (`valuationReports.service.ts`)

**`getInventoryValuation(tenantId, asOf)`:**
1. Fetches all InventoryItems with qtyOnHand > 0.
2. For each item, gets unitCost from cost state (fallback to WAV from lots).
3. valueMinor = qty * unitCostMinor.
4. Returns items array with totals.

**`aggregateValuationByItem(rows)`:**
- Aggregates across warehouses for same SKU.

**`aggregateValuationByWarehouse(rows)`:**
- Aggregates by warehouseId.

**`getMarginSummary(tenantId, startDate, endDate)`:**
1. Fetches JournalLine records in date range.
2. Sums revenue (credit - debit for REV-prefixed accounts).
3. Sums COGS (debit - credit for COGS-prefixed accounts).
4. grossProfit = revenue - COGS.
5. grossMarginPct = grossProfit / revenue.

#### 2.9.6 GL Integration

Stock movements generate journal entries:

| Operation       | Debit Account | Credit Account | Condition                  |
|-----------------|---------------|----------------|----------------------------|
| Issue stock     | COGS          | INV            | movementCost > 0           |
| Reversal (issue)| INV           | COGS           | Reversal of issue movement |
| Adjustment (+)  | INV           | INV_GAIN       | movementCost > 0           |
| Adjustment (-)  | INV_LOSS      | INV            | movementCost > 0           |

#### 2.9.7 Costing API Operations

| Method | Path                                    | Description                  | Permission           | Status       |
|--------|-----------------------------------------|------------------------------|----------------------|--------------|
| GET    | `/api/finance/inventory/valuation`      | Inventory valuation report   | `finance:reports`    | `[COMPLETE]` |
| GET    | `/api/finance/inventory/margin`         | Gross margin summary         | `finance:reports`    | `[COMPLETE]` |

**Zod Schemas:**
- **Valuation Query**: `{ asOf?: string }` (defaults to now)
- **Margin Query**: `{ start?: string, end?: string }` (defaults to current month)

**Gaps & Issues:**
- `[SHORTCUT]` Cost state stored in TenantConfig JSON, not in a dedicated table. Risk of corruption on concurrent updates.
- `[GAP]` No standard cost method implemented -- only WAV and FIFO.
- `[GAP]` FIFO costing (`cost.ts`) and WAV costing (`costing.service.ts`) are in separate files with no unified interface or configuration to select method.
- `[GAP]` No cost revaluation or price variance reporting.
- `[GAP]` Valuation report uses current on-hand, not historical. `asOf` parameter exists but is not used for point-in-time snapshot.
- `[MISSING]` No configurable costing method per item or per tenant.
- `[MISSING]` No landed cost allocation to inventory items (LandedCost model exists but has no service).
- `[RECOMMEND]` Create a dedicated CostLedger table for per-item-per-warehouse cost tracking.
- `[RECOMMEND]` Implement point-in-time valuation using StockMove history.

---

### 2.10 Replenishment / Reorder

#### 2.10.1 Replenishment Rules (File-Based -- `replenishmentStore.ts`)

Stored in file system at `apps/web/.data/supply/replenishment/`.

**ReplenishmentRule type:**

| Field         | Type   | Description                            |
|---------------|--------|----------------------------------------|
| id            | string | Auto-generated rule ID                 |
| tenantId      | string | Tenant                                 |
| sku           | string | SKU                                    |
| warehouseId   | string | Optional warehouse scope               |
| minQty        | number | Minimum order quantity                 |
| maxQty        | number | Maximum/target inventory level         |
| reorderPoint  | number | Trigger level for reorder              |
| safetyStock   | number | Safety stock level                     |
| updatedAt     | string | Last update ISO timestamp              |

#### 2.10.2 Suggestion Computation (`computeSuggestions`)

**Algorithm:**
1. Fetch all replenishment rules.
2. For each rule:
   - `onHand` = aggregate InventoryItem.qtyOnHand for sku(+warehouse).
   - `onOrder` = sum qty from open POs (status "draft" or "approved") for sku.
   - `level` = onHand + onOrder.
   - If `level <= reorderPoint`: suggest `max(0, maxQty - level)`, reason = "below_reorder_point".
   - Else if `onHand < safetyStock`: suggest `max(0, minQty - onHand)`, reason = "below_safety_stock".
   - Else: reason = "sufficient" (no suggestion).
3. If suggestion > 0, look up supplier contract for the SKU. If no contract found, reason = "no_supplier_contract".

**Suggestion type:**
- sku, warehouseId, onHand, onOrder, targetQty, suggestedQty, supplierId, reason

**Gaps & Issues:**
- `[SHORTCUT]` Replenishment rules stored in file system JSON, not database.
- `[MISSING]` No API routes found for replenishment rules or suggestions.
- `[GAP]` No automatic PO generation from suggestions.
- `[GAP]` No lead time consideration in reorder calculation.
- `[RECOMMEND]` Migrate to database-backed storage and add API endpoints.

---

### 2.11 RMA (Return Merchandise Authorization)

#### 2.11.1 RMA (File-Based -- `rmaStore.ts`)

Stored in file system at `apps/web/.data/supply/rma/`.

**RMAHeader type:**

| Field         | Type   | Description                            |
|---------------|--------|----------------------------------------|
| id            | string | Auto-generated ID                      |
| tenantId      | string | Tenant                                 |
| salesOrderId  | string | Optional sales order reference         |
| shipmentId    | string | Optional shipment reference            |
| customerId    | string | Optional customer reference            |
| status        | string | "open" / "inspecting" / "processed" / "closed" |
| reason        | string | Return reason                          |
| createdAt     | string | ISO timestamp                          |

**RMALine type:**

| Field               | Type   | Description                      |
|---------------------|--------|----------------------------------|
| id                  | string | Auto-generated ID                |
| tenantId            | string | Tenant                           |
| headerId            | string | FK to RMAHeader                  |
| sku                 | string | SKU being returned               |
| quantity            | number | Return quantity                  |
| condition           | string | Item condition                   |
| resolutionRequested | string | "restock" / "scrap" / "refund"   |

**Operations:**
- `createRma(tenantId, input)` -- creates header + lines
- `listRma(tenantId)` -- lists all RMA headers
- `getRma(tenantId, id)` -- get header + lines
- `updateRma(tenantId, id, data, lineUpdates?)` -- update status/reason and optional line updates

**Gaps & Issues:**
- `[SHORTCUT]` Entirely file-based. No database model, no API routes.
- `[MISSING]` No integration with inventory movements (restock does not create a stock receipt).
- `[MISSING]` No integration with credit notes or refunds.
- `[RECOMMEND]` Create Prisma model and API routes, integrate with inventory and finance.

---

### 2.12 Landed Costs

#### 2.12.1 LandedCost Entity (Prisma Model)

| Field       | Type     | Required | Default       | Constraints           | Notes                          |
|-------------|----------|----------|---------------|-----------------------|--------------------------------|
| id          | String   | Yes      | cuid()        | @id                   | Primary key                    |
| tenantId    | String   | Yes      | -             | -                     | Multi-tenant                   |
| poId        | String   | No       | null          | -                     | Purchase order reference       |
| asnId       | String   | No       | null          | -                     | ASN reference                  |
| type        | String   | Yes      | -             | -                     | freight, duty, insurance, etc. |
| amount      | Decimal  | Yes      | -             | -                     | Cost amount                    |
| allocatedTo | String   | Yes      | "inventory"   | -                     | "inventory" or "cogs"          |
| createdAt   | DateTime | Yes      | now()         | -                     | -                              |
| updatedAt   | DateTime | Yes      | @updatedAt    | -                     | -                              |

**Indexes:**
- `@@index([tenantId, poId])`
- `@@index([tenantId, asnId])`

**Gaps & Issues:**
- `[STUBBED]` LandedCost model exists in schema but has no service, no API routes, and no integration with inventory costing.
- `[MISSING]` No allocation logic to distribute landed costs across PO line items.
- `[MISSING]` No landed cost impact on inventory valuation.
- `[RECOMMEND]` Implement CRUD API and allocation to item cost.

---

### 2.13 Manufacturing -- Inventory Integration

#### 2.13.1 Work Order Material Issue Entity (Prisma Model)

| Field       | Type     | Required | Default  | Constraints            | Notes                      |
|-------------|----------|----------|----------|------------------------|----------------------------|
| id          | String   | Yes      | cuid()   | @id                    | Primary key                |
| tenantId    | String   | Yes      | -        | -                      | Multi-tenant               |
| workOrderId | String   | Yes      | -        | FK -> WorkOrder        | Parent work order          |
| sku         | String   | Yes      | -        | -                      | Component SKU              |
| qty         | Decimal  | Yes      | -        | -                      | Quantity issued             |
| unitCost    | Decimal  | Yes      | 0        | -                      | Unit cost at time of issue |
| totalCost   | Decimal  | Yes      | 0        | -                      | Total cost                 |
| lotId       | String   | No       | null     | FK -> InventoryLot     | Lot reference              |
| type        | String   | Yes      | "issue"  | -                      | "issue" or "return"        |
| issuedAt    | DateTime | Yes      | now()    | -                      | Issue timestamp            |
| issuedBy    | String   | No       | null     | -                      | Actor user ID              |
| notes       | String   | No       | null     | -                      | -                          |

#### 2.13.2 Manufacturing Inventory Integration (`inventoryIntegration.ts`)

**`computeRequirements(opts)` -- BOM Explosion:**
- For each BOM component: `required = qtyPer * (1 + scrapPct/100) * woQty`.

**`assertAvailability(tenantId, reqs, warehouseId):`**
- For each requirement, checks available qty (on-hand minus quarantine).
- Throws 409 "insufficient_stock" if any component insufficient.

**`postCompletion(opts)` -- Work Order Completion:**
1. For each component: records `issue` movement (consumes raw materials).
2. For finished good: records `receive` movement (produces finished goods).

#### 2.13.3 Scrap Records (Prisma Model)

| Field       | Type     | Required | Default  | Constraints            | Notes                   |
|-------------|----------|----------|----------|------------------------|-------------------------|
| id          | String   | Yes      | cuid()   | @id                    | Primary key             |
| tenantId    | String   | Yes      | -        | -                      | Multi-tenant            |
| workOrderId | String   | Yes      | -        | FK -> WorkOrder        | Parent work order       |
| sku         | String   | Yes      | -        | -                      | Scrapped SKU            |
| qty         | Decimal  | Yes      | -        | -                      | Scrapped quantity       |
| reason      | String   | Yes      | -        | -                      | Scrap reason            |
| cost        | Decimal  | Yes      | 0        | -                      | Scrap cost              |
| recordedAt  | DateTime | Yes      | now()    | -                      | -                       |
| recordedBy  | String   | No       | null     | -                      | Actor user ID           |

**Gaps & Issues:**
- `[COMPLETE]` BOM explosion with scrap percentage is implemented.
- `[COMPLETE]` Availability check against WMS quarantine is implemented.
- `[COMPLETE]` Post-completion material issue and finished goods receipt integrated with stock ledger.
- `[GAP]` Manufacturing does not use costing service for GL postings.
- `[GAP]` Scrap records exist but do not create stock movements or GL entries.

---

### 2.14 Metrics / Analytics

#### 2.14.1 FactInventoryMovement (Star Schema)

| Field          | Type     | Required | Constraints           | Notes                        |
|----------------|----------|----------|-----------------------|------------------------------|
| id             | String   | Yes      | @id                   | Primary key                  |
| tenantId       | String   | Yes      | -                     | Multi-tenant                 |
| dateId         | String   | Yes      | FK -> DimDate         | Date dimension               |
| tenantDimId    | String   | Yes      | FK -> DimTenant       | Tenant dimension             |
| productDimId   | String   | Yes      | FK -> DimProduct      | Product dimension            |
| locationDimId  | String   | Yes      | FK -> DimLocation     | Location dimension           |
| stockMoveId    | String   | Yes      | -                     | Source StockMove ID          |
| qty            | Decimal  | Yes      | -                     | Movement quantity            |
| unitCost       | Decimal  | Yes      | -                     | Unit cost                    |
| totalCost      | Decimal  | Yes      | -                     | Total cost                   |
| type           | String   | Yes      | -                     | Movement type                |
| createdAt      | DateTime | Yes      | -                     | -                            |

This star schema enables BI/analytics queries across inventory movements by date, product, and location.

**Gaps:**
- `[PARTIAL]` DimProduct is auto-synced on item create/update. FactInventoryMovement population is not verified in movement service code.
- `[RECOMMEND]` Verify that FactInventoryMovement rows are created for every StockMove.

---

### 2.15 Permission Model Summary

All inventory/WMS API endpoints are guarded by the following permissions:

| Permission             | Used For                                              |
|------------------------|-------------------------------------------------------|
| `ui:finance_reports:view` | Read-only access to items, warehouses, on-hand, holds, shipments, cycle counts |
| `inventory:manage`     | CRUD on items, warehouses, transfers, shipments, cycle counts, holds |
| `inventory:adjust`     | Issue stock, transfer stock, reverse movements        |
| `inventory:receive_grn`| Goods receipt, WMS receiving, putaway                 |
| `inventory:transfer`   | ATP queries                                           |
| `finance:reports`      | Valuation and margin reports                          |

All mutating endpoints also check:
- `requirePlanFeature(tenantId, "inventory")` -- Billing plan must include inventory module
- `assertModuleEnabled({ module: "inventory" })` -- Module must be enabled in TenantConfig
- `rateLimitTenant(bucket, tenantId, userId)` -- Per-tenant rate limiting

---

### 2.16 Cross-Cutting Gaps Summary

| Area                     | Flag             | Description                                                          |
|--------------------------|------------------|----------------------------------------------------------------------|
| Item Master metadata     | `[SHORTCUT]`     | Stored in JSON blob, not relational columns                          |
| Dual creation endpoints  | `[SHORTCUT]`     | Two create-item APIs with different code paths                       |
| Transfer atomicity       | `[SHORTCUT]`     | Source/dest updates not wrapped in single transaction                 |
| Pick/Pack/Ship store     | `[SHORTCUT]`     | Uses file-system JSON, not database                                  |
| Cycle count store        | `[SHORTCUT]`     | Dual implementation (DB + file)                                      |
| Replenishment store      | `[SHORTCUT]`     | File-system based, no API                                            |
| RMA store                | `[SHORTCUT]`     | File-system based, no API, no inventory integration                  |
| Cost state storage       | `[SHORTCUT]`     | TenantConfig JSON, not dedicated table                               |
| Warehouse code uniqueness| `[SHORTCUT]`     | Global @unique instead of per-tenant unique                          |
| ASN                      | `[STUBBED]`      | Schema model only, no implementation                                 |
| Wave / PickTask (Prisma) | `[STUBBED]`      | Schema models only, file-based implementation used instead           |
| PutawayTask              | `[STUBBED]`      | Schema model exists, putaway done via stock transfer                 |
| QualityInspection        | `[STUBBED]`      | Schema model only, no service or API                                 |
| CAPA                     | `[STUBBED]`      | Schema model only, no service or API                                 |
| LandedCost               | `[STUBBED]`      | Schema model only, no service or API                                 |
| Reservation CRUD         | `[MISSING]`      | Model exists, no service or API. ATP ignores it.                     |
| Location CRUD            | `[MISSING]`      | Model exists, no management API                                      |
| Movement history API     | `[MISSING]`      | No endpoint to query stock movement history                          |
| Lot/batch management     | `[MISSING]`      | No lot number assignment, no query API, no expiry                    |
| Serial tracking          | `[MISSING]`      | Flag exists but never implemented                                    |
| Standard costing method  | `[MISSING]`      | Only WAV and FIFO available                                          |
| Point-in-time valuation  | `[GAP]`          | asOf parameter accepted but not used for historical snapshot         |
| Batch/serial enforcement | `[GAP]`          | trackBatch/trackSerial flags not enforced in movement flows          |
| Over-receiving check     | `[GAP]`          | No validation of received qty vs PO ordered qty                      |
| Pack step               | `[GAP]`          | packedQty field exists but pack workflow not implemented              |
| Dual shipment systems    | `[GAP]`          | Two parallel shipment mechanisms with different behaviors             |

---

## Section 3: CRM / Sales

> [CONTRADICTION-RESOLVED: IT-8 -- CRM entities use "Crm" prefix (CrmLead, CrmContact, CrmAccount, CrmActivity, CrmOpportunity) while other modules do not prefix (Customer, Supplier, PurchaseOrder, SalesOrder). This naming inconsistency is acknowledged. The new project should adopt a consistent convention (recommended: no prefix, use module/namespace context instead).]

### 3.1 Leads

#### 3.1.1 Lead Entity (CrmLead)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | FK -> Tenant | Multi-tenant scoping |
| title | String | Yes | - | - | Lead title/name |
| status | String | Yes | "new" | Enum: new, qualified, converted, lost, cancelled | Status lifecycle |
| source | String | No | null | - | Lead source (web, referral, etc.) |
| priority | String | No | null | - | Lead priority |
| accountId | String | No | null | FK -> CrmAccount | Optional account linkage |
| contactId | String | No | null | FK -> CrmContact | Optional contact linkage; onDelete: SetNull |
| ownerUserId | String | No | null | - | Assigned user (no FK enforced in schema) |
| expectedValue | Decimal | No | null | - | Expected deal value |
| currency | String | No | "GBP" | - | Currency code |
| score | Int | Yes | 0 | - | Lead scoring integer |
| cancelledAt | DateTime | No | null | - | Timestamp of cancellation |
| cancelReason | String | No | null | - | Reason for cancellation |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Relations:**
- `account` -> CrmAccount (optional, many-to-one)
- `contact` -> CrmContact (optional, many-to-one, onDelete: SetNull)

**Indexes:**
- `[tenantId, status]`
- `[tenantId, ownerUserId]`
- `[tenantId, accountId]`
- `[tenantId, contactId]`

#### 3.1.2 Lead Status Lifecycle

```
                +-------+
                |  new  |
                +---+---+
                    |
              (qualify)
                    |
                +---v------+
                | qualified|
                +---+------+
                    |
              (convert)
                    |
                +---v-------+
                | converted |  (terminal -- cannot cancel or edit)
                +-----------+

  From any non-terminal:
    (lose) --> lost
    (cancel) --> cancelled  (terminal -- cannot transition out)
```

**State transition rules (from server logic):**
- `new` -> `qualified`, `converted`, `lost`, `cancelled`
- `qualified` -> `converted`, `lost`, `cancelled`
- `converted` -> TERMINAL (cannot be cancelled or edited)
- `lost` -> `cancelled` (allowed in DB-backed; file-store blocks all edits once closed)
- `cancelled` -> TERMINAL (cannot transition to any other status; server returns 409)

#### 3.1.3 Business Rules

1. **Cancellation guard:** Cancelled leads cannot transition to any other status (409 Conflict). `[COMPLETE]`
2. **Conversion guard:** Converted leads cannot be cancelled (409 Conflict). `[COMPLETE]`
3. **Idempotent cancel:** Cancelling an already-cancelled lead returns the existing record without error. `[COMPLETE]`
4. **Soft delete:** `deleteLead()` calls `cancelLead()` with reason "deleted" in production. Hard delete only when `QA_BYPASS_MODULE_DISABLED=1 && TEST_AUTH_ENABLED=1`. `[COMPLETE]`
5. **Default status:** New leads default to status "new". `[COMPLETE]`
6. **Default currency:** Defaults to "GBP" if not specified. `[COMPLETE]`
7. **Default score:** Defaults to 0 if not specified. `[COMPLETE]`
8. **Audit trail:** All CRUD operations emit audit events (best-effort, failures swallowed). `[COMPLETE]`
9. **File-store duplicate (lib/crm/leadsStore.ts):** A legacy file-based store also exists that enforces stricter rules -- converted OR cancelled leads cannot be edited at all (409). `[SHORTCUT]`
10. **No formal lead-to-opportunity conversion in leads.ts:** The conversion flow exists in `pipelines.ts` as `convertContactToOpportunity()`, not as a dedicated lead conversion function. `[GAP]`
11. **Owner validation:** `ownerUserId` is not validated against the User table. `[GAP]`

#### 3.1.4 Zod Validation (ERP Service Layer)

From `apps/web/src/server/erp/crmLeads.ts`:
- `title`: string, min length 1 (required)
- `score`: integer, non-negative, default 0
- `ownerId`: string (optional)
- `source`: string (optional)
- `status`: enum ["new", "qualified", "converted", "lost"] (optional; note: "cancelled" is excluded from Zod schema)

`[GAP]` -- Zod schema does not include "cancelled" as a valid status, but `cancelLead()` sets it server-side.

#### 3.1.5 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/leads | List leads (with optional status filter, paging) | `[COMPLETE]` |
| GET | /api/crm/leads/:id | Get single lead by ID | `[COMPLETE]` |
| POST | /api/crm/leads | Create new lead | `[COMPLETE]` |
| POST | /api/crm/leads/:id | Update existing lead | `[COMPLETE]` |
| POST | /api/crm/leads/:id/cancel | Cancel a lead with optional reason | `[COMPLETE]` |
| DELETE | /api/crm/leads/:id | Soft-delete (cancel with reason "deleted") | `[COMPLETE]` |

**Permissions:** Module check via `getTenantConfig()` -> `modules.crm.enabled`. Rate limiting via `rateLimitTenant("crm", ...)`. No explicit RBAC permission checks beyond module toggle. `[GAP]` -- No role-based granularity (e.g., crm:manage vs crm:view).

#### 3.1.6 Gaps & Issues

- `[SHORTCUT]` Dual implementation: both file-based store (`lib/crm/leadsStore.ts`) and DB-backed (`server/crm/leads.ts`). The file store uses JSON files on disk; the DB-backed version uses Prisma. The client (`lib/crm/client.ts`) calls the API which uses the DB-backed version.
- `[GAP]` No dedicated lead-to-opportunity conversion function on the Lead entity.
- `[GAP]` `ownerUserId` has no FK constraint or validation.
- `[SCHEMA-GAP]` No `description` or `notes` field on CrmLead.
- `[RECOMMEND]` Add RBAC permission check (crm:manage, crm:view) beyond module toggle.
- `[RECOMMEND]` Remove legacy file-based store or add migration path.

---

### 3.2 Contacts

#### 3.2.1 Contact Entity (CrmContact)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| accountId | String | No | null | FK -> CrmAccount | Optional account linkage |
| firstName | String | Yes | - | - | First name |
| lastName | String | Yes | - | - | Last name |
| email | String | No | null | - | Email address |
| phone | String | No | null | - | Phone number |
| title | String | No | null | - | Job title / role |
| status | String | Yes | "active" | Enum: active, inactive | Soft delete via status |
| ownerId | String | No | null | - | Assigned user |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| createdBy | String | No | null | - | Not populated in current code |
| updatedBy | String | No | null | - | Not populated in current code |
| deletedAt | DateTime | No | null | - | Soft delete timestamp |

**Relations:**
- `account` -> CrmAccount (optional, many-to-one)
- `activities` -> CrmActivity[] (one-to-many)
- `CrmOpportunity` -> CrmOpportunity[] (one-to-many)
- `leads` -> CrmLead[] (one-to-many)

**Indexes:**
- `[tenantId, accountId]`
- `[tenantId, status]`
- `[tenantId, ownerId]`

#### 3.2.2 Business Rules

1. **Account validation:** When `accountId` is provided, the referenced CrmAccount must exist within the same tenant. `[COMPLETE]`
2. **Soft delete:** `deleteContact()` sets `status = "inactive"` and `deletedAt = now()`. Hard delete only in QA bypass mode. `[COMPLETE]`
3. **Legal entity access:** All operations call `assertLegalEntityAccess()` to validate entity-level permissions. `[COMPLETE]`
4. **Audit trail:** All CRUD operations emit audit events (best-effort). `[COMPLETE]`
5. **Name splitting:** The ERP service layer (`crmContacts.ts`) splits a single `name` field into `firstName` and `lastName` by space. `[SHORTCUT]`

#### 3.2.3 Zod Validation (ERP Service Layer)

From `apps/web/src/server/erp/crmContacts.ts`:
- `accountId`: string, min length 1 (required in Zod, optional in server layer)
- `name`: string, min length 1 (required; split into firstName/lastName)
- `email`: string, valid email format (optional)
- `phone`: string (optional)
- `role`: string (optional; mapped to `title` field)

#### 3.2.4 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/contacts | List contacts (optional accountId filter, paging) | `[COMPLETE]` |
| GET | /api/crm/contacts/:id | Get single contact with account and activities | `[COMPLETE]` |
| POST | /api/crm/contacts | Create new contact | `[COMPLETE]` |
| POST | /api/crm/contacts/:id | Update existing contact | `[COMPLETE]` |
| DELETE | /api/crm/contacts/:id | Soft-delete contact (set inactive) | `[COMPLETE]` |

**Permissions:** Module check (`crm.enabled`), rate limiting. No RBAC granularity. `[GAP]`

#### 3.2.5 Gaps & Issues

- `[SHORTCUT]` Dual implementation: file-based store (`lib/crm/contactsStore.ts`) and DB-backed. File store uses a flat `name` field and `role` field instead of firstName/lastName/title.
- `[GAP]` `createdBy` and `updatedBy` fields exist in schema but are never populated.
- `[GAP]` `ownerId` has no FK constraint or validation.
- `[SCHEMA-GAP]` No `address`, `city`, `postcode`, `country` fields on CrmContact (these exist on CrmAccount but not contacts).
- `[RECOMMEND]` Standardize on single implementation (remove file-based store).

---

### 3.3 Accounts / Companies

#### 3.3.1 Account Entity (CrmAccount)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| code | String | Yes | derived | Unique per tenant | Auto-derived from name if not provided |
| name | String | Yes | - | - | Company/account name |
| type | String | No | null | Suggested: company, individual | Account type |
| website | String | No | null | - | Website URL |
| industry | String | No | null | - | Industry classification |
| phone | String | No | null | - | Phone number |
| email | String | No | null | - | Email address |
| address | String | No | null | - | Street address |
| city | String | No | null | - | City |
| postcode | String | No | null | - | Postal code |
| country | String | No | null | - | Country |
| status | String | Yes | "active" | Enum: active, inactive | Soft delete via status |
| ownerId | String | No | null | - | Assigned user |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| createdBy | String | No | null | - | Not populated |
| updatedBy | String | No | null | - | Not populated |
| deletedAt | DateTime | No | null | - | Soft delete timestamp |

**Relations:**
- `contacts` -> CrmContact[] (one-to-many)
- `opportunities` -> CrmOpportunity[] (one-to-many)
- `leads` -> CrmLead[] (one-to-many)
- `CrmActivity` -> CrmActivity[] (one-to-many)

**Unique constraint:** `@@unique([tenantId, code])`

**Indexes:**
- `[tenantId, status]`
- `[tenantId, ownerId]`
- `[tenantId, type]`

#### 3.3.2 Business Rules

1. **Code derivation:** If `code` is not provided, it is derived from the `name` field: uppercase, non-alphanumeric chars replaced with underscores, trimmed. `[COMPLETE]`
2. **Soft delete:** `deleteAccount()` sets `status = "inactive"` and `deletedAt = now()`. Hard delete only in QA bypass mode. `[COMPLETE]`
3. **Legal entity access:** All operations call `assertLegalEntityAccess()`. `[COMPLETE]`
4. **Audit trail:** All CRUD operations emit audit events (best-effort). `[COMPLETE]`
5. **No cascade delete protection:** Deleting an account does not check for child contacts, opportunities, or leads. `[GAP]`

#### 3.3.3 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/accounts | List accounts with contacts and opportunities | `[COMPLETE]` |
| GET | /api/crm/accounts/:id | Get single account with contacts, opportunities, activities | `[COMPLETE]` |
| POST | /api/crm/accounts | Create new account | `[COMPLETE]` |
| POST | /api/crm/accounts/:id | Update existing account | `[COMPLETE]` |
| DELETE | /api/crm/accounts/:id | Soft-delete account (set inactive) | `[COMPLETE]` |

**Permissions:** Module check (`crm.enabled`). No RBAC. `[GAP]`

#### 3.3.4 Gaps & Issues

- `[SHORTCUT]` Dual implementation: file-based store (`lib/crm/accountsStore.ts`) with simpler schema (name, parentId only) and DB-backed with full schema.
- `[GAP]` `createdBy`, `updatedBy` fields never populated.
- `[GAP]` `ownerId` not validated against User table.
- `[GAP]` No cascade protection on delete (contacts/opportunities may become orphaned).
- `[SCHEMA-GAP]` File-based store has `parentId` for hierarchical accounts; DB schema does not support parent-child account hierarchy.
- `[RECOMMEND]` Add parent-child account hierarchy to DB schema.

---

### 3.4 Opportunities / Pipeline

#### 3.4.1 Opportunity Entity (CrmOpportunity)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| accountId | String | No | null | FK -> CrmAccount | Optional account linkage |
| contactId | String | No | null | FK -> CrmContact | Optional contact; onDelete: SetNull |
| name | String | Yes | - | - | Opportunity name |
| stage | String | Yes | "qualification" | See lifecycle | Pipeline stage |
| value | Decimal | No | null | - | Deal value [CONTRADICTION-RESOLVED: EC-8 -- canonical field for deal value. Use `value` not `amount`.] |
| amount | Decimal | No | 0 | - | **DEPRECATED** -- Alias for value (compatibility). [CONTRADICTION-RESOLVED: EC-8, IT-2 -- remove in new project. Different default (0 vs null) makes these non-interchangeable.] |
| probability | Decimal | No | 0 | - | Win probability (0-100 or 0-1) |
| currency | String | Yes | "GBP" | - | Currency code |
| expectedCloseDate | DateTime | No | null | - | Expected close date [CONTRADICTION-RESOLVED: EC-8 -- canonical field for expected close.] |
| actualCloseDate | DateTime | No | null | - | Actual close date |
| closeDate | DateTime | No | null | - | **DEPRECATED** -- Alias for expectedCloseDate. [CONTRADICTION-RESOLVED: EC-8, IT-3 -- remove in new project. Used only in HubSpot mapping.] |
| ownerId | String | No | null | - | Assigned user [CONTRADICTION-RESOLVED: IT-7 -- Canonical field name. Some CRM entities use `ownerUserId` (BG-35). Standardize to `ownerId` across all CRM entities.] |
| status | String | Yes | "open" | Enum: open, won, lost | Opportunity status |
| source | String | No | null | - | Lead source |
| description | String | No | null | - | Description |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| createdBy | String | No | null | - | Not populated |
| updatedBy | String | No | null | - | Not populated |
| deletedAt | DateTime | No | null | - | Soft delete timestamp |

**Relations:**
- `account` -> CrmAccount (optional)
- `contact` -> CrmContact (optional, onDelete: SetNull)
- `stageHistory` -> OpportunityStageHistory[] (one-to-many)
- `activities` -> CrmActivity[] (one-to-many)
- `quotes` -> SalesQuote[] (one-to-many)

**Indexes:**
- `[tenantId, accountId, stage]`
- `[tenantId, stage, status]`
- `[tenantId, ownerId]`
- `[tenantId, expectedCloseDate]`

#### 3.4.2 Stage History Entity (OpportunityStageHistory)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| opportunityId | String | Yes | - | FK -> CrmOpportunity | onDelete: Cascade |
| fromStage | String | No | null | - | Previous stage |
| toStage | String | Yes | - | - | New stage |
| probability | Decimal | Yes | 0 | - | Probability at time of change |
| changedAt | DateTime | Yes | now() | - | Timestamp of change |
| changedBy | String | No | null | - | User who made the change |

**Indexes:**
- `[opportunityId, changedAt]`

#### 3.4.3 Pipeline Stage Lifecycle

The pipeline has hardcoded stages defined in `pipelines.ts`:

[CONTRADICTION-RESOLVED: CR-4 -- Two stage name sets existed. The DB-backed version (`pipelines.ts`) is canonical. Stage "lead" (not "prospect") is the correct first stage. "qualified" is an important intermediate stage that the file-based version omits. "lost" is a valid terminal state in both versions.]

**Canonical stages (DB-backed, `pipelines.ts`):**
```
  lead -> qualified -> proposal -> negotiation -> won
                                                   |
                                               (terminal)

  Any stage ---------> lost (terminal)
```

**File-store stages (opportunitiesStore.ts) -- DEPRECATED:**
```
  prospect -> proposal -> negotiation -> won | lost
```
[CONTRADICTION-RESOLVED: CR-4 -- File-store uses "prospect" instead of "lead" and omits "qualified". The DB-backed version is canonical. File-store also has stricter transition rules (won/lost cannot be changed). New project should use configurable PipelineStage model (see SG-54, R-30).]

**DB-backed stages (server/crm/pipelines.ts):**
```
  lead -> qualified -> proposal -> negotiation -> won
                                                   |
  (any) ------------------------------------> lost

  Won/Lost are closed states.
```

**State transition rules:**
- Stage moves are recorded in `OpportunityStageHistory`.
- Moving to "won" or "lost" emits a `crm.opportunity.closed` domain event.
- Moving to any other stage emits `crm.opportunity.updated`.
- No formal stage ordering enforcement in DB-backed code -- any stage can transition to any other. `[GAP]`

**File-store rules (opportunitiesStore.ts):**
- Won/lost opportunities cannot have their stage changed (409 Conflict).
- Reopen is an explicit function moving won/lost back to prospect, proposal, or negotiation.

#### 3.4.4 Business Rules

1. **Account validation:** If `accountId` is provided on create, verifies the CrmAccount exists in same tenant. `[COMPLETE]`
2. **Stage history tracking:** Every stage change creates an `OpportunityStageHistory` record with fromStage, toStage, probability, and actor. `[COMPLETE]`
3. **Domain events:** Creates `crm.opportunity.created`, `crm.opportunity.updated`, and `crm.opportunity.closed` events via outbox pattern. `[COMPLETE]`
4. **Soft delete:** `deleteOpportunity()` sets `deletedAt`, `status = "lost"`, `stage = "lost"`. Hard delete only in QA bypass mode. `[COMPLETE]`
5. **Contact-to-opportunity conversion:** `convertContactToOpportunity()` creates an opportunity at "qualification" stage, links the contact, and emits `crm.lead.converted` event. `[COMPLETE]`
6. **Legal entity access:** All operations validate via `assertLegalEntityAccess()`. `[COMPLETE]`
7. **Audit trail:** Best-effort audit events for all mutations. `[COMPLETE]`

#### 3.4.5 Pipeline Summary

`listPipelines()` returns a summary array of the 6 predefined stages with opportunity counts:
```
[
  { stage: "lead", count: N },
  { stage: "qualified", count: N },
  { stage: "proposal", count: N },
  { stage: "negotiation", count: N },
  { stage: "won", count: N },
  { stage: "lost", count: N }
]
```
`[SHORTCUT]` -- This loads ALL opportunities and counts client-side rather than using SQL GROUP BY.

#### 3.4.6 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/opportunities | List opportunities (optional accountId, stage filters) | `[COMPLETE]` |
| GET | /api/crm/opportunities/:id | Get single opportunity with account, contact, quotes, activities | `[COMPLETE]` |
| POST | /api/crm/opportunities | Create new opportunity | `[COMPLETE]` |
| POST | /api/crm/opportunities/:id | Update existing opportunity | `[COMPLETE]` |
| POST | /api/crm/pipelines/:id/stage | Move opportunity to new stage | `[COMPLETE]` |
| DELETE | /api/crm/opportunities/:id | Soft-delete (set to lost) | `[COMPLETE]` |

#### 3.4.7 Gaps & Issues

- `[SHORTCUT]` Pipeline summary loads all opportunities and counts in-memory.
- `[GAP]` No formal stage ordering enforcement -- any stage can move to any other in DB-backed code.
- `[GAP]` No weighted pipeline value calculation.
- `[GAP]` `ownerId`, `createdBy`, `updatedBy` not validated or populated.
- `[GAP]` Duplicate `value`/`amount` and `expectedCloseDate`/`closeDate` fields exist for compatibility. [CONTRADICTION-RESOLVED: EC-8 -- use `value` and `expectedCloseDate` as canonical; `amount` and `closeDate` are deprecated aliases to remove in new project.]
- `[SHORTCUT]` File-based store (`opportunitiesStore.ts`) has different stage names (prospect vs lead) and stricter transition rules.
- `[SCHEMA-GAP]` No `Pipeline` or `PipelineStage` model in schema -- stages are hardcoded strings.
- `[RECOMMEND]` Create PipelineStage model for configurable pipelines.
- `[RECOMMEND]` Add weighted pipeline value aggregation.

---

### 3.5 Sales Quotes

#### 3.5.1 Quote Entity (SalesQuote)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| customerId | String | Yes | - | FK -> Customer | Required; auto-resolved from CRM account |
| opportunityId | String | No | null | FK -> CrmOpportunity | Optional; onDelete: SetNull |
| number | String | Yes | - | Unique | Auto-generated: "QT-{timestamp}" |
| version | Int | Yes | 1 | - | Quote version number |
| status | String | Yes | "draft" | See lifecycle | Quote status |
| validUntil | DateTime | No | null | - | Quote expiry date |
| total | Decimal | Yes | 0 | - | Computed total (sum of line qty * price) |
| currency | String | Yes | "GBP" | - | Currency code |
| sentAt | DateTime | No | null | - | Not populated in current code |
| acceptedAt | DateTime | No | null | - | Not populated in current code |
| rejectedAt | DateTime | No | null | - | Not populated in current code |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| createdBy | String | No | null | - | Not populated |
| updatedBy | String | No | null | - | Not populated |

**Relations:**
- `customer` -> Customer (many-to-one, required)
- `opportunity` -> CrmOpportunity (optional, onDelete: SetNull)
- `lines` -> SalesQuoteLine[] (one-to-many)
- `SalesOrder` -> SalesOrder[] (one-to-many)
- `invoices` -> CustomerInvoice[] (one-to-many)

**Indexes:**
- `[tenantId, customerId]`
- `[tenantId, opportunityId]`
- `[tenantId, status]`

#### 3.5.2 Quote Line Entity (SalesQuoteLine)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| quoteId | String | Yes | - | FK -> SalesQuote | Parent quote |
| lineNo | Int | Yes | - | Unique per quote | Line number |
| sku | String | Yes | - | - | Product SKU |
| description | String | Yes | - | - | Line description |
| qty | Decimal | Yes | - | - | Quantity |
| price | Decimal | Yes | - | - | Unit price |
| discount | Decimal | Yes | 0 | - | Discount amount |
| total | Decimal | Yes | - | - | Computed: qty * price |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Unique constraint:** `@@unique([quoteId, lineNo])`

#### 3.5.3 Quote Status Lifecycle

```
  draft -> sent -> accepted (terminal -- locked for edits)
                |-> rejected
                |-> expired

  draft -> cancelled (terminal)
  sent  -> cancelled (terminal)

  Any non-accepted -> superseded (terminal)
```

**File-store rules (quotesStore.ts):**
- Cancelled or superseded quotes cannot be edited (409).
- Accepted quotes with line or status changes are blocked (409).
- Accepted quotes are treated as converted and locked.

**DB-backed rules (server/crm/quotes.ts):**
- `cancelQuote()` sets status to "cancelled".
- `approveQuote()` sets status to "accepted".
- `supersedeQuote()` sets status to "superseded".
- No explicit guard against editing accepted quotes in DB-backed version. `[GAP]`

#### 3.5.4 Business Rules

1. **Customer resolution:** `resolveCustomerId()` auto-creates a Customer record from CrmAccount data. If no account, creates a default "CRM Customer". Customer code pattern: `CRM-{tenantId}-{accountCode}`. `[COMPLETE]`
2. **Total computation:** Quote total is computed as `sum(line.qty * line.priceMinor)` on create and update. `[COMPLETE]`
3. **Line replacement:** On update, all existing lines are deleted and re-created (full replace strategy within a transaction). `[COMPLETE]`
4. **Soft delete:** `deleteQuote()` calls `cancelQuote()` with reason "deleted" in production. Hard delete (lines + quote) only in QA bypass mode. `[COMPLETE]`
5. **Audit trail:** All mutations emit audit events (best-effort). `[COMPLETE]`
6. **Quote number generation:** `QT-{Date.now()}` -- timestamp-based, not sequential. `[SHORTCUT]`

#### 3.5.5 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/quotes | List all quotes with lines and opportunity | `[COMPLETE]` |
| GET | /api/crm/quotes/:id | Get single quote with lines and opportunity | `[COMPLETE]` |
| POST | /api/crm/quotes | Create new quote with lines | `[COMPLETE]` |
| POST | /api/crm/quotes/:id | Update quote (full line replacement) | `[COMPLETE]` |
| POST | /api/crm/quotes/:id/approve | Accept/approve a quote | `[COMPLETE]` |
| POST | /api/crm/quotes/:id/cancel | Cancel a quote | `[COMPLETE]` |
| POST | /api/crm/quotes/:id/supersede | Supersede a quote | `[COMPLETE]` |
| DELETE | /api/crm/quotes/:id | Soft-delete (cancel) | `[COMPLETE]` |

#### 3.5.6 Gaps & Issues

- `[SHORTCUT]` Dual implementation: file-based store (`lib/crm/quotesStore.ts`) has stricter lifecycle guards; DB-backed version is more permissive.
- `[GAP]` DB-backed version does not guard against editing accepted quotes.
- `[GAP]` `sentAt`, `acceptedAt`, `rejectedAt` timestamp fields exist in schema but are never populated.
- `[GAP]` `version` field exists but is never incremented.
- `[GAP]` No quote-to-order conversion function exists. `[MISSING]`
- `[GAP]` No tax computation on quote lines (discount field exists but no tax rate).
- `[SHORTCUT]` Quote number uses timestamp, not a sequential counter.
- `[SCHEMA-GAP]` No terms/conditions field on SalesQuote.
- `[RECOMMEND]` Implement quote-to-order conversion.
- `[RECOMMEND]` Add tax calculation to quote lines.
- `[RECOMMEND]` Implement version incrementing for quote revisions.

---

#### 3.5.7 Quote-to-Order-to-Invoice Flow `[MUST-HAVE -- Added from completeness review M-25]`

**Requirement Source:** Core operability -- no conversion functions exist between quotes, orders, and invoices. This is the fundamental sales process for any ERP system.

**Current State in Document:** Section 3.5.6 lists `[GAP] No quote-to-order conversion function exists [MISSING]`. Section 3.6.7 lists `[MISSING] No quote-to-order conversion endpoint` and `[MISSING] No order-to-invoice generation`.

**Description:**
One-click conversion between Sales Quote -> Sales Order -> Customer Invoice, carrying forward all line items, prices, customer details, and references.

**Business Rules:**
- **Quote to Order:** Accepted quotes can be converted to sales orders. All line items, prices, discounts, and customer reference are copied. Quote status changes to "converted". Quote-to-order link maintained via `SalesOrder.quoteId`.
- **Order to Invoice:** Confirmed/shipped orders can be converted to customer invoices. All line items copied with prices. Order status progresses to "invoiced". Invoice-to-order link maintained via `CustomerInvoice.orderId`.
- **Partial Invoicing:** Support creating invoices for partial order quantities (e.g., invoice only shipped lines)
- **Multiple Invoices per Order:** Support creating multiple invoices against one order (e.g., milestone billing)
- **Conversion must be atomic:** If any step fails, the entire conversion rolls back
- **Audit trail:** Record who converted and when

**API Operations Expected:**
- `POST /api/crm/quotes/[id]/convert-to-order` -- Convert accepted quote to sales order
- `POST /api/sales/orders/[id]/convert-to-invoice` -- Convert order to invoice (full or partial)

**Competitor Reference:** Odoo, ERPNext, and Sage all support one-click quote-to-order and order-to-invoice conversion.

---

### 3.6 Sales Orders

#### 3.6.1 Sales Order Entity (SalesOrder)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| customerId | String | Yes | - | FK -> Customer | Required |
| number | String | Yes | - | Unique | Order number |
| quoteId | String | No | null | FK -> SalesQuote | Optional quote linkage |
| status | String | Yes | "draft" | Enum: draft, confirmed, shipped, invoiced, cancelled | Order status |
| total | Decimal | Yes | 0 | - | Order total |
| currency | String | Yes | "GBP" | - | Currency code |
| orderDate | DateTime | Yes | now() | - | Order date |
| requestedDate | DateTime | No | null | - | Requested delivery date |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Relations:**
- `customer` -> Customer (many-to-one)
- `quote` -> SalesQuote (optional)
- `lines` -> SalesOrderLine[] (one-to-many)
- `reservations` -> Reservation[] (one-to-many)
- `invoices` -> CustomerInvoice[] (one-to-many)

**Indexes:**
- `[tenantId, customerId]`
- `[tenantId, quoteId]`

#### 3.6.2 Sales Order Line Entity (SalesOrderLine)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| orderId | String | Yes | - | FK -> SalesOrder | Parent order |
| lineNo | Int | Yes | - | Unique per order | Line number |
| sku | String | Yes | - | - | Product SKU |
| description | String | Yes | - | - | Line description |
| qty | Decimal | Yes | - | - | Quantity |
| price | Decimal | Yes | - | - | Unit price |
| total | Decimal | Yes | - | - | Line total |
| reservedQty | Decimal | Yes | 0 | - | Reserved stock quantity |
| backorderQty | Decimal | Yes | 0 | - | Backordered quantity |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Unique constraint:** `@@unique([orderId, lineNo])`

#### 3.6.3 Sales Order Status Lifecycle

```
  draft -> confirmed -> shipped -> invoiced
                     |
                     +-> cancelled

  draft -> cancelled
```

#### 3.6.4 Reservation Entity

> **See Section 2.7.1 for canonical Reservation Entity definition.** [CONTRADICTION-RESOLVED: EC-7, DC-4 -- Reservation entity was defined identically in both Section 2.7.1 (Inventory) and Section 3.6.4 (Sales). The canonical definition is in Section 2.7.1 (Inventory module) since reservations are fundamentally an inventory concept. Sales orders reference reservations but do not own the entity.]

#### 3.6.5 Business Rules (ERP Service Layer)

From `apps/web/src/server/erp/salesOrders.ts`:

1. **Zod validation:** Lines must have `sku` (min 1 char), `qty` (positive number), `price` (non-negative). At least 1 line required. `[COMPLETE]`
2. **Idempotency:** Uses `idempotentGet`/`idempotentSet` with key `so:create:{tenantId}:{key}`. Returns 409 if duplicate. `[COMPLETE]`
3. **Rate limiting:** `rateLimitTenant("erp-mutating", ...)`. `[COMPLETE]`
4. **Dashboard revalidation:** After creation, triggers `revalidateDashboardsForTenant()` and `revalidateSuperAdminDashboards()`. `[COMPLETE]`

`[SHORTCUT]` -- The ERP service layer creates an `OrderExternal` record (not a `SalesOrder`) using the Channel model. This is a workaround that stores sales orders in the marketplace/EDI channel table.

#### 3.6.6 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | /api/sales/order/create | Create a new sales order | `[PARTIAL]` |

`[MISSING]` -- No list, get, update, cancel, or status-transition endpoints for SalesOrder.
`[MISSING]` -- No quote-to-order conversion endpoint.
`[MISSING]` -- No order-to-invoice conversion endpoint.

#### 3.6.7 Gaps & Issues

- `[SHORTCUT]` Sales order creation uses `OrderExternal` model instead of `SalesOrder` model. The proper `SalesOrder` schema exists but is not wired to any API.
- `[MISSING]` No CRUD API for SalesOrder (only create via ERP service layer using wrong model).
- `[MISSING]` No status transition logic (confirm, ship, invoice, cancel).
- `[MISSING]` No quote-to-order conversion.
- `[MISSING]` No order-to-invoice generation.
- `[MISSING]` Reservation logic is schema-only -- no server implementation.
- `[GAP]` `reservedQty` and `backorderQty` on SalesOrderLine exist but no code manages them.
- `[RECOMMEND]` Build proper SalesOrder CRUD API using the SalesOrder model.
- `[RECOMMEND]` Implement order fulfillment workflow (confirm -> ship -> invoice).

---

#### 3.6.1A Proper Sales Order System `[MUST-HAVE -- Added from completeness review M-24]`

**Requirement Source:** Core operability -- the current implementation uses the wrong model (OrderExternal via Channel model instead of SalesOrder). Only a create endpoint exists with no list, get, update, cancel, or status-transition endpoints. Core sales workflow is broken.

**Current State in Document:** Section 3.6 documents the SalesOrder schema exists but is not wired to any API. Section 3.6.5 confirms the ERP service layer creates OrderExternal records.

**Description:**
Build a complete Sales Order CRUD system using the proper SalesOrder model with full lifecycle management and integration with inventory, invoicing, and shipping.

**Business Rules:**
- Sales orders must use the SalesOrder Prisma model (not OrderExternal)
- Full CRUD: create, list, get, update, cancel
- Status lifecycle: draft -> confirmed -> picking -> shipped -> invoiced -> closed (+ cancelled from draft/confirmed)
- Confirmation triggers inventory reservation (reserve stock for order lines)
- Picking creates shipment records and issues stock from warehouse
- Shipping updates shipment tracking and confirms delivery
- Invoicing creates customer invoice from order (order-to-invoice conversion)
- Cancellation releases any reserved inventory
- Order number must be sequential and configurable (prefix + sequence)
- Line items must reference valid SKUs from inventory
- Prices can be looked up from price books
- Tax calculation per line (VAT rate from item or manual override)
- Total computed server-side from lines (net + tax)
- Back-order support: if insufficient stock, allow partial fulfilment with backorder tracking
- `reservedQty` and `backorderQty` on SalesOrderLine must be managed by the system

**API Operations Expected:**
- `POST /api/sales/orders` -- Create sales order with lines
- `GET /api/sales/orders` -- List orders (filterable by customer, status, date range)
- `GET /api/sales/orders/[id]` -- Get order detail with lines
- `PATCH /api/sales/orders/[id]` -- Update draft order
- `POST /api/sales/orders/[id]/confirm` -- Confirm order (triggers reservation)
- `POST /api/sales/orders/[id]/cancel` -- Cancel order (releases reservations)
- `POST /api/sales/orders/[id]/invoice` -- Generate invoice from order
- `POST /api/sales/orders/[id]/ship` -- Create shipment from order

**Permissions:**
- Create/Edit: `sales:order:manage`
- Confirm: `sales:order:confirm`
- Cancel: `sales:order:cancel`
- Invoice: `finance:create_invoice`

**Competitor Reference:** Odoo, ERPNext, Sage 200, and Brightpearl all have complete sales order lifecycles with confirm, pick, pack, ship, invoice workflows.

---

### 3.7 Activities / Notes

#### 3.7.1 Activity Entity (CrmActivity)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| contactId | String | No | null | FK -> CrmContact | Optional contact linkage |
| accountId | String | No | null | FK -> CrmAccount | Optional account linkage |
| opportunityId | String | No | null | FK -> CrmOpportunity | Optional; onDelete: SetNull |
| type | String | Yes | - | Enum: call, email, meeting, note, task | Activity type |
| subject | String | Yes | - | - | Activity subject/title |
| description | String | No | null | - | Detailed description |
| assignedTo | String | No | null | - | Assigned user ID |
| dueDate | DateTime | No | null | - | Due date for tasks |
| status | String | Yes | "pending" | Enum: pending, completed, cancelled | Activity status |
| completedAt | DateTime | No | null | - | Completion timestamp |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| createdBy | String | No | null | - | Not populated |
| updatedBy | String | No | null | - | Not populated |

**Relations:**
- `contact` -> CrmContact (optional)
- `account` -> CrmAccount (optional)
- `opportunity` -> CrmOpportunity (optional, onDelete: SetNull)

**Indexes:**
- `[tenantId, contactId]`
- `[tenantId, accountId]`
- `[tenantId, opportunityId]`
- `[tenantId, type, status]`
- `[tenantId, assignedTo]`

#### 3.7.2 Business Rules

1. **Reference validation:** When `contactId` or `accountId` is provided, the referenced entity must exist in the same tenant (404 if not found). `[COMPLETE]`
2. **Complete activity:** `completeActivity()` sets `completedAt = now()` but does NOT update the `status` field. `[GAP]` -- Status remains "pending" after completion.
3. **Soft delete:** `deleteActivity()` sets `status = "cancelled"`. Hard delete only in QA bypass mode. `[COMPLETE]`
4. **Legal entity access:** All operations validate via `assertLegalEntityAccess()`. `[COMPLETE]`
5. **Audit trail:** Best-effort audit events for all mutations. `[COMPLETE]`

#### 3.7.3 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/activities | List activities (optional contactId, accountId filters, paging) | `[COMPLETE]` |
| GET | /api/crm/activities/:id | Get single activity with contact and account | `[COMPLETE]` |
| POST | /api/crm/activities | Create new activity | `[COMPLETE]` |
| POST | /api/crm/activities/:id/complete | Mark activity as completed | `[COMPLETE]` |
| DELETE | /api/crm/activities/:id | Soft-delete (set cancelled) | `[COMPLETE]` |

#### 3.7.4 Gaps & Issues

- `[GAP]` `completeActivity()` sets `completedAt` but does not update `status` to "completed".
- `[GAP]` No update endpoint for activities (only create, complete, delete).
- `[GAP]` `createdBy`, `updatedBy`, `assignedTo` not validated or populated.
- `[SHORTCUT]` File-based store (`lib/crm/activitiesStore.ts`) has `targetType`/`targetId` polymorphic fields; DB schema uses separate `contactId`/`accountId`/`opportunityId` FKs.
- `[SCHEMA-GAP]` No reminder/notification integration for tasks with due dates.
- `[RECOMMEND]` Fix completeActivity to also set `status = "completed"`.
- `[RECOMMEND]` Add update endpoint for activities.

---

### 3.8 Price Books

#### 3.8.1 PriceBook Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| name | String | Yes | - | Unique per tenant | Price book name |
| currency | String | Yes | "GBP" | - | Currency code |
| isDefault | Boolean | Yes | false | - | Default price book flag |
| active | Boolean | Yes | true | - | Active flag |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Relations:**
- `items` -> PriceBookItem[] (one-to-many, onDelete: Cascade)

**Unique constraint:** `@@unique([tenantId, name])`

**Indexes:**
- `[tenantId, isDefault]`
- `[tenantId, active]`

#### 3.8.2 PriceBookItem Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| priceBookId | String | Yes | - | FK -> PriceBook | Parent price book; onDelete: Cascade |
| sku | String | No | null | - | Product SKU |
| name | String | Yes | - | - | Item name |
| unitPrice | Decimal | Yes | - | - | Unit price |
| uom | String | No | null | - | Unit of measure |
| active | Boolean | Yes | true | - | Active flag |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Unique constraints:**
- `@@unique([tenantId, priceBookId, sku])`
- `@@unique([tenantId, priceBookId, name])`

#### 3.8.3 Business Rules

1. **Item replacement:** On update, all existing items are deleted and re-created (full replace within transaction). `[COMPLETE]`
2. **Hard delete:** `deletePriceBook()` performs a hard delete (items cascade-deleted, then price book deleted). `[COMPLETE]`
3. **Audit trail:** Best-effort audit events. `[COMPLETE]`
4. **No default enforcement:** Multiple price books can be marked as default without conflict. `[GAP]`

#### 3.8.4 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/crm/price-books | List all price books with items | `[COMPLETE]` |
| GET | /api/crm/price-books/:id | Get single price book with items | `[COMPLETE]` |
| POST | /api/crm/price-books | Create new price book with items | `[COMPLETE]` |
| POST | /api/crm/price-books/:id | Update price book (full item replacement) | `[COMPLETE]` |
| DELETE | /api/crm/price-books/:id | Hard delete price book and items | `[COMPLETE]` |

#### 3.8.5 Gaps & Issues

- `[GAP]` No enforcement that only one price book can be the default.
- `[GAP]` No linkage between PriceBook items and SalesQuote/SalesOrder lines.
- `[SHORTCUT]` File-based store (`lib/crm/priceBooksStore.ts`) has simpler schema (sku, priceMinor, discountPct).
- `[RECOMMEND]` Enforce single default price book per tenant.
- `[RECOMMEND]` Integrate price book lookup into quote/order line creation.

---

### 3.9 CPQ (Configure-Price-Quote)

#### 3.9.1 CPQ Service

Located at `apps/api/src/crm/cpq.service.js` -- a minimal JavaScript module with two functions:

```
needsApproval(price, floor)  -- returns true if price < floor
applyDiscount(total, discountPct) -- returns total * (1 - discountPct/100), rounded to 2 decimal places
```

`[STUBBED]` -- This is a minimal placeholder with no integration into the quote workflow.

#### 3.9.2 Gaps & Issues

- `[STUBBED]` CPQ service is a 3-line utility with no integration.
- `[MISSING]` No approval workflow for quotes below price floor.
- `[MISSING]` No product configuration logic.
- `[RECOMMEND]` Build proper CPQ workflow integrating price books, discount approval, and quote generation.

---

### 3.10 Customer Entity

#### 3.10.1 Customer Entity

> **See Section 1.1.1 for canonical Customer Entity definition.** [CONTRADICTION-RESOLVED: EC-1, EC-3, EC-9, DC-1]

The following CRM-specific business rule supplements the canonical definition in Section 1.1.1:

**CRM-to-Finance Bridge Rule:** Customer is the bridge entity between CRM (CrmAccount) and Finance (invoicing, payments). The `resolveCustomerId()` function in `quotes.ts` auto-creates Customer records from CrmAccount data with code pattern `CRM-{tenantId}-{accountCode}`. [CONTRADICTION-RESOLVED: EC-9 -- this auto-creation rule was missing from Section 1.1.1 and has been added there.]

**Indexes:**
- `[tenantId, code]` (supports per-tenant uniqueness)
- `[tenantId, status]`

---

### 3.11 Point of Sale (POS)

#### 3.11.1 Store Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| name | String | Yes | - | - | Store name |
| code | String | Yes | - | Unique per tenant | Store code |
| address | String | No | null | - | Store address |
| timezone | String | Yes | "Europe/London" | - | Store timezone |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |

**Relations:**
- `sales` -> PosSale[] (one-to-many)
- `shifts` -> TillShift[] (one-to-many)
- `sessions` -> PosSession[] (one-to-many)
- `drawers` -> PosDrawer[] (one-to-many)

**Unique constraint:** `@@unique([tenantId, code])`

#### 3.11.2 TillShift Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| storeId | String | Yes | - | FK -> Store | Store linkage |
| openedByUserId | String | Yes | - | - | User who opened |
| closedByUserId | String | No | null | - | User who closed |
| openedAt | DateTime | Yes | - | - | Open timestamp |
| closedAt | DateTime | No | null | - | Close timestamp |
| openingFloat | Decimal | Yes | 0 | - | Opening cash float |
| closingFloat | Decimal | No | null | - | Counted closing cash |
| status | TillShiftStatus | Yes | open | Enum: open, closed | Shift status |

**Relations:**
- `events` -> PosEvent[]
- `sales` -> PosSale[]
- `sessions` -> PosSession[]
- `variances` -> PosVariance[]
- `store` -> Store

#### 3.11.3 POS Session Entity (PosSession)

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| storeId | String | Yes | - | FK -> Store | Store linkage |
| shiftId | String | Yes | - | FK -> TillShift | Shift linkage |
| openedBy | String | Yes | - | - | User who opened |
| closedBy | String | No | null | - | User who closed |
| openedAt | DateTime | Yes | now() | - | Open timestamp |
| closedAt | DateTime | No | null | - | Close timestamp |
| openingFloat | Decimal | Yes | 0 | - | Opening float |
| closingFloat | Decimal | No | null | - | Closing float |
| status | String | Yes | "open" | Enum: open, closed | Session status |

**Relations:**
- `store` -> Store
- `shift` -> TillShift
- `PosVariance` -> PosVariance[]
- `sales` -> PosSale[]
- `cashMovements` -> CashMovement[]
- `zReports` -> ZReport[]

#### 3.11.4 PosSale Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| storeId | String | Yes | - | FK -> Store | Store linkage |
| sessionId | String | No | null | FK -> PosSession | Session linkage; onDelete: SetNull |
| shiftId | String | No | null | FK -> TillShift | Shift linkage |
| cashierUserId | String | Yes | - | - | Cashier user ID |
| customerId | String | No | null | FK -> Customer | Optional customer; onDelete: SetNull |
| saleNumber | String | Yes | - | Unique per tenant | Sale number: POS-{storeCode}-{YYYYMMDD}-{seq}-{nonce} |
| status | PosSaleStatus | Yes | open | Enum: open, paid, refunded, void | Sale status |
| subtotal | Decimal | Yes | 0 | - | Net subtotal |
| tax | Decimal | Yes | 0 | - | Tax total |
| total | Decimal | Yes | 0 | - | Grand total |
| currency | String | Yes | "GBP" | - | Currency code |
| createdAt | DateTime | Yes | now() | - | Auto-set |

**Relations:**
- `events` -> PosEvent[]
- `lines` -> PosLine[]
- `payments` -> PosPayment[]
- `refunds` -> PosRefund[]
- `session` -> PosSession (optional)
- `shift` -> TillShift (optional)
- `store` -> Store
- `customer` -> Customer (optional)

**Unique constraint:** `@@unique([tenantId, saleNumber])`

#### 3.11.5 PosLine Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| saleId | String | Yes | - | FK -> PosSale | Parent sale |
| sku | String | Yes | - | - | Product SKU |
| name | String | Yes | - | - | Product name |
| qty | Decimal | Yes | - | - | Quantity (must be > 0) |
| unitPrice | Decimal | Yes | - | - | Unit price |
| taxRate | Decimal | Yes | 0 | - | Tax rate (decimal, e.g. 0.2 for 20%) |
| lineTotal | Decimal | Yes | - | - | Computed line total |
| inventoryItemId | String | No | null | - | Optional inventory item linkage |

#### 3.11.6 PosPayment Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| saleId | String | Yes | - | FK -> PosSale | Parent sale |
| method | PosPaymentMethod | Yes | - | Enum: card, cash | Payment method |
| amount | Decimal | Yes | - | - | Payment amount (negative for refunds) |
| tip | Decimal | No | null | - | Tip amount |
| stripePaymentIntentId | String | No | null | - | Stripe PI ID |
| stripeChargeId | String | No | null | - | Stripe charge ID |
| createdAt | DateTime | Yes | now() | - | Auto-set |

#### 3.11.7 PosRefund Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| tenantId | String | Yes | - | - | Multi-tenant scoping |
| saleId | String | Yes | - | FK -> PosSale | Original sale |
| amount | Decimal | Yes | - | - | Refund amount |
| reason | String | No | null | - | Refund reason (also stores JSON state for finalised refunds) |
| stripeRefundId | String | No | null | - | Stripe refund ID (also used as "finalised" marker) |
| createdAt | DateTime | Yes | now() | - | Auto-set |

#### 3.11.8 Supporting POS Entities

**PosEvent:**
- `id`, `tenantId`, `saleId?`, `shiftId?`, `type`, `payload` (Json), `createdAt`
- Used for event sourcing of sale lifecycle (refund drafts, finalisations, session closings)

**PosDrawer:**
- `id`, `tenantId`, `storeId`, `code`, `name`
- Unique per `[tenantId, storeId, code]`

**PosPromotion:**
- `id`, `tenantId`, `code` (unique), `name`, `type`, `conditions` (Json), `effectiveFrom`, `effectiveTo`, `active`
- Schema-only; no server logic. `[SCHEMA-GAP]`

**PosVariance:**
- `id`, `tenantId`, `sessionId`, `shiftId`, `type`, `expected`, `actual`, `variance`, `reason`, `resolved`, `resolvedBy`, `resolvedAt`
- Schema exists; partially used by session close logic.

**CashMovement:**
- `id`, `tenantId`, `sessionId`, `type` (opening_float, sale, refund, cash_out, cash_in), `amount`, `description`, `createdAt`, `createdBy`
- Schema exists; not actively populated in current code. `[SCHEMA-GAP]`

**ZReport:**
- `id`, `tenantId`, `sessionId`, `reportNumber` (unique), `totalSales`, `totalDiscounts`, `totalTax`, `totalCash`, `totalCard`, `totalOther`, `openingFloat`, `closingFloat`, `variance`, `receiptCount`, `generatedAt`, `generatedBy`
- Schema exists; no generation logic. `[MISSING]`

#### 3.11.9 POS Sale Lifecycle

```
  open -----> paid -----> refunded
    |
    +-------> void (only if no payments exist)
```

#### 3.11.10 Business Rules -- Sale Creation

1. **Module check:** `assertPosModuleEnabled()` validates `cfg.modules.pos.enabled`. `[COMPLETE]`
2. **Lines required:** At least 1 line required; each line qty must be > 0 (422 if invalid). `[COMPLETE]`
3. **Auto-shift creation:** If no open shift exists for the store, one is automatically created. `[COMPLETE]`
4. **Sale number generation:** Pattern: `POS-{storeCode}-{YYYYMMDD}-{seq}-{nonce}`. Sequence is based on total sale count for tenant, plus random nonce. `[SHORTCUT]`

#### 3.11.11 Business Rules -- Pricing Computation

The `computePricing()` function implements a sophisticated pricing engine:

1. **Line-level discounts:** Either percent (0-1 range) or fixed amount, but not both (400 error). `[COMPLETE]`
2. **Basket-level discounts:** Either percent or fixed amount for entire basket, but not both (400 error). `[COMPLETE]`
3. **Discount validation:** Discount percent must be 0-1; discount amount must be non-negative; line discount cannot exceed line gross. `[COMPLETE]`
4. **Basket discount allocation:** Proportionally distributed across lines based on net value share, with rounding remainder on last line. `[COMPLETE]`
5. **Tax computation:** Per-line: `tax = netAfterBasketDiscount * taxRate`. `[COMPLETE]`
6. **Total:** `netAfterAllDiscounts + tax`. `[COMPLETE]`

#### 3.11.12 Business Rules -- Sale Finalisation

1. **Idempotent:** If sale is already "paid", returns existing sale. `[COMPLETE]`
2. **Session required:** An open TillShift must exist for the store. If not found, auto-creates one. `[COMPLETE]`
3. **Inventory decrement:** For each line, issues stock via `issueStock()`. Locates warehouse from store config or finds inventory item with highest qty. `[COMPLETE]`
4. **Payment persistence:** Creates PosPayment record (cash or card). Failure is swallowed. `[SHORTCUT]`
5. **GL journal entry:** Posts a journal with:
   - Debit: POS_CARD or CASH account (asset) for total
   - Credit: REV account (revenue) for net
   - Credit: VAT account (liability) for tax (if > 0)
   `[COMPLETE]`
6. **Status update:** Sets sale status to "paid". `[COMPLETE]`
7. **Audit event:** `pos.sale.finalised`. `[COMPLETE]`
8. **Period check:** Not explicitly checked on sale finalisation (only on void/refund). `[GAP]`

#### 3.11.13 Business Rules -- Sale Void

1. **Only open sales:** Can only void sales with status "open" (409 if not). `[COMPLETE]`
2. **No payments:** Cannot void a sale that has payments (409). `[COMPLETE]`
3. **Period check:** Validates the period is open via `assertPeriodOpen()`. `[COMPLETE]`
4. **Transaction:** Void is performed in a Prisma transaction with audit event. `[COMPLETE]`

#### 3.11.14 Business Rules -- Refund

**Draft creation (`createPosRefundDraft`):**
1. **Sale must be "paid":** 409 if not refundable. `[COMPLETE]`
2. **Session required:** Open shift must exist. `[COMPLETE]`
3. **Quantity validation:** Refund qty cannot exceed original qty minus already-refunded qty (checks refund history via PosEvent). `[COMPLETE]`
4. **Per-unit calculation:** Computes refund amounts proportionally from original sale line totals. `[COMPLETE]`
5. **Creates PosRefund record** and **PosEvent** with type "pos.refund.draft". `[COMPLETE]`

**Finalisation (`finalisePosRefund`):**
1. **Period check:** `assertPeriodOpen()` for GL posting. `[COMPLETE]`
2. **Session required:** Open shift must exist. `[COMPLETE]`
3. **Double-refund guard:** Re-checks quantity limits against refund history. `[COMPLETE]`
4. **Idempotent:** If `stripeRefundId === "finalised"`, returns existing result. `[COMPLETE]`
5. **Payment mismatch check:** Sum of refund payments must equal refund total (400 if not). `[COMPLETE]`
6. **Inventory return:** Receives stock back via `receiveStock()`. `[COMPLETE]`
7. **Negative payment records:** Creates PosPayment with negative amounts. `[COMPLETE]`
8. **GL reversal journal:** Reverses revenue and VAT, with COGS/inventory reversal if cost data available. `[COMPLETE]`
9. **Audit event:** `pos.refund.finalised`. `[COMPLETE]`

#### 3.11.15 Business Rules -- Sessions

1. **Single open session per store:** `openSession()` checks for existing open shift; throws 409 if one exists. `[COMPLETE]`
2. **Plan feature check:** `requirePlanFeature(tenantId, "pos")` -- POS requires plan-level enablement. `[COMPLETE]`
3. **Cash variance on close:** `closeSession()` computes expected cash (opening float + cash payments) vs counted cash. If variance != 0, posts a GL journal entry to CASH_SHORT_OVER. `[COMPLETE]`
4. **Session listing:** Returns computed totals per session (cash, card, refunds, salesTotal, expectedCash, variance). `[COMPLETE]`
5. **PosEvent on close:** Records session closure event with expected/counted/variance. `[COMPLETE]`

#### 3.11.16 Business Rules -- Register Management

Registers are stored in TenantConfig JSON (not a DB table):
1. **Config-based storage:** Registers stored in `tenantConfig.config.pos.registers[]`. `[SHORTCUT]`
2. **Register status:** active or inactive. `[COMPLETE]`
3. **Inactive register check:** Receipt creation checks register is active (409 if inactive). `[COMPLETE]`
4. **Idempotency:** Receipt creation uses `tenantConfig.config.pos.idempotency` map to prevent duplicates. `[COMPLETE]`

#### 3.11.17 Business Rules -- Receipts (Legacy Config-Based)

The `receipts.ts` module provides a config-based receipt system (separate from DB-backed sales):
1. **Line calculation:** qty * unitPrice - discount + tax (taxRate as percentage, not decimal). `[COMPLETE]`
2. **Change due:** amountPaid - total. `[COMPLETE]`
3. **Void receipt:** Sets status to "voided" and reverses stock via `receiveStock()`. Idempotent. `[COMPLETE]`
4. **Stock integration:** Issues stock on receipt creation, receives stock on void. `[COMPLETE]`

#### 3.11.18 Business Rules -- Receipt Printing

- Supports PDF mode and network ESC/POS printer mode.
- Network printer sends formatted text to configurable host:port (default 127.0.0.1:9100).
- Receipt includes store code, sale number, line items, subtotal, VAT, total.

#### 3.11.19 POS-Related Utility Modules

**Tax (`lib/pos/tax.ts`):**
- `computeLineTotals()`: subtotal = qty * unitPrice, tax = subtotal * taxRate, total = subtotal + tax
- `sumLines()`: aggregates multiple LineTotals
- `roundCurrencyMinor()`, `toMinorUnits()`, `fromMinorUnits()`: currency conversion helpers

**Currency (`lib/pos/currency.ts`):**
- `formatMoney(minor, currency)`: formats minor units to currency string using Intl.NumberFormat

**Inventory (`lib/pos/inventory.ts`):**
- `postSaleToGlAndInventory()`: Decrements inventory via FIFO lots, posts GL journal (Stripe Clearing / Sales / VAT Liability)
- `reverseSaleFromGlAndInventory()`: Reverses inventory and GL for refunds
- Gated by `POS_POSTING_ENABLED` env var

**Audit (`lib/pos/audit.ts`):**
- `posAudit()`: Console-logs POS audit events (no persistent storage). `[SHORTCUT]`

#### 3.11.20 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | /api/pos/sales | Create a POS sale (via ERP service) | `[PARTIAL]` |
| - | /api/pos/summary | POS module summary | `[STUBBED]` |
| - | /api/pos/terminal/summary | Stripe terminal summary | `[STUBBED]` |
| - | /api/pos/receipts/summary | Receipts summary | `[STUBBED]` |
| - | /api/pos/offline-sync/summary | Offline sync summary | `[STUBBED]` |
| - | /api/pos/reconciliation/summary | Reconciliation summary | `[STUBBED]` |
| - | /api/pos/postings/summary | GL postings summary | `[STUBBED]` |
| - | /api/pos/reports/summary | X/Z reports summary | `[STUBBED]` |

**Zod Validation (ERP service layer):**
- `shiftId`: string, min length 1 (required)
- `lines`: array of `{ sku: string min(1), qty: number positive, priceMinor: number non-negative }`, min 1 line
- `payment`: `{ method: string min(1), amountMinor: number non-negative }`

#### 3.11.21 Gaps & Issues

- `[SHORTCUT]` Dual POS implementations: (a) DB-backed via `server/pos/sales.ts` with sophisticated pricing, GL, and inventory; (b) config-based via `server/pos/receipts.ts` + `helpers.ts` with JSON storage in TenantConfig. (c) file-based via `lib/pos/salesStore.ts` and `lib/pos/shiftStore.ts`.
- `[SHORTCUT]` Register management stored in TenantConfig JSON, not a proper DB table.
- `[SHORTCUT]` POS audit is console.log only (`lib/pos/audit.ts`).
- `[MISSING]` Z-report generation logic (schema exists, no implementation).
- `[MISSING]` CashMovement tracking (schema exists, not populated).
- `[MISSING]` PosPromotion application (schema exists, no logic).
- `[GAP]` Sale finalisation does not check period open status (void and refund do).
- `[GAP]` No offline/park-and-recall functionality.
- `[GAP]` No Stripe Terminal integration beyond schema fields.
- `[GAP]` PosDrawer has no functional logic.
- `[RECOMMEND]` Consolidate to single DB-backed POS implementation.
- `[RECOMMEND]` Implement Z-report generation.
- `[RECOMMEND]` Build Stripe Terminal integration.

---

### 3.12 Purchasing

#### 3.12.1 Supplier Entity

> **See Section 1.2.1 for canonical Supplier Entity definition.** [CONTRADICTION-RESOLVED: EC-2, EC-4, DC-2]

The following additional relations and rules supplement the canonical definition in Section 1.2.1:

**Relations (from Purchasing module):**
- `PurchaseOrder` -> PurchaseOrder[]
- `bills` -> SupplierBill[]
- `payments` -> SupplierPayment[]
- `creditNotes` -> SupplierCreditNote[]
- `paymentRunLines` -> SupplierPaymentRunLine[]

[CONTRADICTION-RESOLVED: EC-4 -- These relations were documented only here and have been merged into the canonical definition in Section 1.2.1.]

**Indexes:**
- `[tenantId, code]` [CONTRADICTION-RESOLVED: EC-2 -- was `[tenantId]` only; needs composite unique index for per-tenant code uniqueness]

#### 3.12.2 Business Rules -- Suppliers

1. **Unique code:** Supplier code must be unique per tenant (composite unique `@@unique([tenantId, code])`), trimmed, case-insensitive. 409 on duplicate. `[COMPLETE]` [CONTRADICTION-RESOLVED: EC-2 -- was "unique globally"; corrected to per-tenant, consistent with Section 1.2.1 and multi-tenant design.]
2. **Disable/enable:** Supplier enablement is tracked in TenantConfig JSON (`config.purchasing.disabledSuppliers`), not a DB column. `[SHORTCUT]`
3. **Active assertion:** `assertSupplierActive()` checks the TenantConfig disable list before allowing PO/RFQ operations. `[COMPLETE]`

#### 3.12.3 Purchase Order Entity

> **See Section 1.2.2 for canonical PurchaseOrder Entity definition and lifecycle.** [CONTRADICTION-RESOLVED: EC-5, EC-6, CR-1, CR-2, DC-3]

The following Purchasing-module-specific details supplement the canonical definition:

**Indexes:**
- `[tenantId, supplierId]`

#### 3.12.4 PoLine Entity

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | cuid() | PK | Auto-generated |
| poId | String | Yes | - | FK -> PurchaseOrder | Parent PO |
| lineNo | Int | Yes | - | Unique per PO | Line number |
| sku | String | Yes | - | - | Product SKU; defaults to "N/A" if empty |
| qty | Decimal | Yes | - | - | Quantity |
| price | Decimal | Yes | - | - | Unit price |
| createdAt | DateTime | Yes | now() | - | Auto-set |
| updatedAt | DateTime | Yes | @updatedAt | - | Auto-set |
| tenantId | String | Yes | - | - | Multi-tenant scoping |

**Unique constraint:** `@@unique([poId, lineNo])`

#### 3.12.5 PO Status Lifecycle

> **See Section 1.2.2 for canonical PO Status Lifecycle.** [CONTRADICTION-RESOLVED: CR-1, CR-2]

**Canonical lifecycle (from Section 1.2.2):**
```
draft -> approved -> sent -> received -> closed
  |         |          |
  +---------+----------+-----> cancelled (from draft, approved, or sent)
```

**Transition rules (resolved):**
- `issuePurchaseOrder()`: draft -> sent (409 if not draft) -- [CONTRADICTION-RESOLVED: CR-2 -- should be `approved -> sent` in canonical lifecycle. The `approved` step is required before sending to supplier.]
- `closePurchaseOrder()`: received -> closed (409 if not received)
- `cancelPurchaseOrder()`: draft|approved|sent -> **cancelled** (NOT "closed") [CONTRADICTION-RESOLVED: CR-1 -- the current implementation incorrectly maps cancel to "closed"; the canonical behavior must set status to "cancelled" as a distinct terminal state.]
- `updatePurchaseOrder()`: Only allowed in draft status (409 if not draft)
- `approvePurchaseOrder()`: draft -> approved (API: `POST /api/purchasing/po/approve/`)

`[GAP]` -- Current code sets cancel to "closed" instead of "cancelled". The `approved` state exists in enum but has incomplete transition logic in the Purchasing module (Section 1.2.2 has the approve endpoint). `[RECOMMEND]` New project must implement the full canonical lifecycle from Section 1.2.2.

#### 3.12.6 Business Rules -- Purchase Orders

1. **Lines required:** At least 1 line required (422 if empty). `[COMPLETE]`
2. **Supplier active check:** Supplier must not be disabled before creating or updating a PO. `[COMPLETE]`
3. **Immutable when issued:** PO cannot be updated once status leaves "draft" (409). `[COMPLETE]`
4. **Number generation:** `PO-{timestamp_base36}-{random_base36}`. `[COMPLETE]`
5. **SKU normalization:** Empty/null SKU defaults to "N/A". `[COMPLETE]`
6. **Total computation:** `subtotal = sum(line.qty * line.price)`. `[COMPLETE]`
7. **Line replacement:** On update, all lines are deleted and re-created within a transaction. `[COMPLETE]`

#### 3.12.7 Zod Validation (ERP Service Layer)

From `apps/web/src/server/erp/purchasingPo.ts`:
- `supplierId`: string, min length 1 (required)
- `number`: string (optional; auto-generated if not provided)
- `currency`: string, default "GBP"
- `lines`: array of `{ lineNo: int positive, sku: string min(1), qty: number positive, price: number non-negative }`, min 1 line
- Idempotency key support with 1-hour TTL.

#### 3.12.8 RFQ (Request for Quotation)

RFQs are stored in TenantConfig JSON (`config.purchasing.rfqs[]`), not a dedicated DB table.

**RfqRecord type:**
- `id`, `tenantId`, `supplierId`, `status` (draft, sent, closed, cancelled), `lines[]`, `createdAt`, `updatedAt`

**RfqLine type:**
- `id`, `lineNo`, `sku`, `qty`, `price`, `currency`, `description`

**RFQ Status Lifecycle:**
```
  draft -> sent -> closed
    |        |
    +--------+----> cancelled
```

**Business Rules:**
1. **Lines required:** At least 1 line (422 if empty). `[COMPLETE]`
2. **Supplier active check:** Supplier must not be disabled. `[COMPLETE]`
3. **Immutable when sent:** RFQ cannot be updated once status leaves "draft" (409). `[COMPLETE]`
4. **Idempotent sent:** Sending an already-sent RFQ returns 409. `[COMPLETE]`
5. **RFQ-to-PO conversion:** `convertRfqToPo()` creates a PurchaseOrder from RFQ lines. Uses first line's currency as PO currency. Lines with no price default to "0". `[COMPLETE]`
6. **Hard delete:** RFQs can be deleted entirely (no soft delete). `[COMPLETE]`

`[SHORTCUT]` -- RFQs stored in TenantConfig JSON, not a proper DB table.

#### 3.12.9 Additional Purchasing Schema Models

**BlanketPO / BlanketPOLine / BlanketPORelease:**
- Schema exists for blanket/framework POs with release schedules.
- No server logic. `[SCHEMA-GAP]`

**SupplierContract / SupplierContractTier:**
- Schema exists for tiered pricing contracts.
- No server logic. `[SCHEMA-GAP]`

**LandedCost:**
- Schema exists for freight, duty, insurance allocation.
- No server logic. `[SCHEMA-GAP]`

**SupplierPerformance:**
- Schema exists for OTIF and quality scoring.
- No server logic. `[SCHEMA-GAP]`

#### 3.12.10 API Operations

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | /api/purchasing/po/create | Create purchase order (ERP service layer) | `[COMPLETE]` |
| - | /api/purchasing/summary | Purchasing module summary | `[STUBBED]` [CONTRADICTION-RESOLVED: DE-9] |
| - | /api/purchasing/requisitions/summary | Requisitions summary | `[STUBBED]` [CONTRADICTION-RESOLVED: DE-9] |
| - | /api/purchasing/orders/summary | PO summary | `[STUBBED]` [CONTRADICTION-RESOLVED: DE-9] |
| - | /api/purchasing/supplier-invoices/summary | Supplier invoices summary | `[STUBBED]` [CONTRADICTION-RESOLVED: DE-9, IT-5 -- uses "supplier-invoices" instead of canonical term "bills". Standardize in new project.] |

`[MISSING]` -- No REST API for supplier CRUD, PO listing/detail, RFQ operations, or PO status transitions. Server functions exist but no routes are wired.

#### 3.12.11 Gaps & Issues

- `[SHORTCUT]` RFQs stored in TenantConfig JSON, not a DB table.
- `[SHORTCUT]` Supplier disable/enable tracked in TenantConfig JSON rather than a DB field.
- `[GAP]` `cancelPurchaseOrder()` sets status to "closed" instead of "cancelled". [CONTRADICTION-RESOLVED: CR-1 -- canonical behavior is to set status to "cancelled". See Section 1.2.2.]
- `[GAP]` `approved` and `received` PO statuses exist in enum but have no transition logic. [CONTRADICTION-RESOLVED: CR-2 -- canonical lifecycle includes `approved` step. See Section 1.2.2.]
- `[MISSING]` No REST API routes for most purchasing operations (list, get, update, status transitions).
- `[SCHEMA-GAP]` BlanketPO, SupplierContract, LandedCost, SupplierPerformance models have no implementation.
- `[MISSING]` No goods receipt / three-way match logic. [CONTRADICTION-RESOLVED: DC-7 -- Same gap documented in Section 1.2.2 (MF-21) and here (MF-90). Both are consistent. Primary reference: Section 1.2.2.]
- `[MISSING]` No PO-to-bill conversion.
- `[RECOMMEND]` Build full purchasing API with proper status transitions.
- `[RECOMMEND]` Implement goods receipt and three-way matching.
- `[RECOMMEND]` Move RFQs and supplier status to proper DB tables.

---

### 3.13 HubSpot CRM Sync

#### 3.13.1 HubSpot Mirror Entities

Three mirror models exist for syncing with HubSpot:

**HubspotContact:**
- `id`, `tenantId`, `hsId` (unique), `email`, `firstName`, `lastName`, `phone`, `lastSyncAt`

**HubspotCompany:**
- `id`, `tenantId`, `hsId` (unique), `name`, `domain`, `lastSyncAt`

**HubspotDeal:**
- `id`, `tenantId`, `hsId` (unique), `name`, `amount`, `stage`, `closeDate`, `lastSyncAt`

`[SCHEMA-GAP]` -- Schema-only. No sync logic, no API, no integration code found in the codebase.

#### 3.13.2 Gaps & Issues

- `[MISSING]` No HubSpot sync implementation (schema only).
- `[RECOMMEND]` Implement bidirectional HubSpot sync or remove schema.

---

### 3.14 Cross-Cutting Concerns

#### 3.14.1 Multi-Tenancy

All CRM/Sales entities are scoped by `tenantId`. Queries always include `tenantId` in WHERE clauses. `[COMPLETE]`

#### 3.14.2 Legal Entity Access

CRM server functions (contacts, accounts, activities, pipelines) call `assertLegalEntityAccess()` for entity-level permission checks. Lead and quote functions do NOT perform this check. `[PARTIAL]`

#### 3.14.3 Audit Trail

All CRM mutations emit audit events via `auditEvent()` or `auditEventInTx()`. Audit failures are swallowed (best-effort pattern). Events include: `crm.lead.created`, `crm.lead.updated`, `crm.lead.cancelled`, `crm.contact.created`, `crm.contact.updated`, `crm.contact.deleted`, `crm.account.created`, `crm.account.updated`, `crm.account.deleted`, `crm.opportunity.created`, `crm.opportunity.updated`, `crm.opportunity.stage.moved`, `crm.opportunity.deleted`, `crm.activity.created`, `crm.activity.completed`, `crm.activity.deleted`, `crm.quote.created`, `crm.quote.updated`, `crm.quote.cancelled`, `crm.quote.superseded`, `crm.pricebook.created`, `crm.pricebook.updated`, `crm.pricebook.deleted`, `pos.sale.created`, `pos.sale.finalised`, `pos.sale.voided`, `pos.refund.finalised`, `pos.shift.opened`, `pos.shift.closed`, `purchasing.po.created`, `sales.order.created`. `[COMPLETE]`

#### 3.14.4 Domain Events (Outbox Pattern)

Opportunity operations emit domain events via `publishWithOutbox()`:
- `crm.opportunity.created` -- includes opportunityId, accountId, contactId, stage, value, currency
- `crm.opportunity.updated` -- includes opportunityId, stage, value, status
- `crm.opportunity.closed` -- includes opportunityId, status (won/lost), actualCloseDate, finalValue
- `crm.lead.converted` -- includes leadId (contactId), opportunityId, accountId, contactId, convertedAt

`[COMPLETE]`

#### 3.14.5 Rate Limiting

CRM and POS API endpoints use `rateLimitTenant()` with module-specific keys ("crm", "pos", "erp-mutating"). `[COMPLETE]`

#### 3.14.6 Module Toggles

CRM and POS are gated by tenant configuration:
- CRM: `tenantConfig.modules.crm.enabled`
- POS: `tenantConfig.modules.pos.enabled` + `requirePlanFeature(tenantId, "pos")`

Returns 403 with "module_disabled" if not enabled. `[COMPLETE]`

#### 3.14.7 Soft Delete Pattern

Most CRM entities use soft delete:
- Contacts/Accounts: set `status = "inactive"`, `deletedAt = now()`
- Leads: set `status = "cancelled"`, `cancelledAt = now()`
- Opportunities: set `status = "lost"`, `stage = "lost"`, `deletedAt = now()`
- Activities: set `status = "cancelled"`
- Quotes: set `status = "cancelled"`

Hard delete only available when `QA_BYPASS_MODULE_DISABLED=1 && TEST_AUTH_ENABLED=1`. `[COMPLETE]`

#### 3.14.8 Test Coverage

Only a single scaffold test exists at `apps/web/src/server/crm/__tests__/scaffold.spec.ts`, which verifies that exported functions exist (type-level only). No functional or integration tests. `[GAP]`

---

### 3.15 Summary of Implementation Status

| Feature Area | Schema | Server Logic | API Routes | UI Client | Status |
|---|---|---|---|---|---|
| Leads (CrmLead) | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[COMPLETE]` |
| Contacts (CrmContact) | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[COMPLETE]` |
| Accounts (CrmAccount) | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[COMPLETE]` |
| Opportunities (CrmOpportunity) | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[COMPLETE]` |
| Pipeline Summary | Implicit | Yes (hardcoded) | Yes | Yes | `[PARTIAL]` |
| Stage History | Yes | Yes | Via pipeline API | No dedicated UI | `[COMPLETE]` |
| Sales Quotes | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[PARTIAL]` |
| Sales Orders | Yes | `[SHORTCUT]` (wrong model) | Minimal | Minimal | `[PARTIAL]` |
| Price Books | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[COMPLETE]` |
| Activities | Yes | Yes (DB + file) | Yes (client paths) | Yes | `[PARTIAL]` |
| POS Sales | Yes | Yes (3 implementations) | Minimal | Via store | `[PARTIAL]` |
| POS Sessions/Shifts | Yes | Yes (DB) | Via service fns | Via store | `[COMPLETE]` |
| POS Refunds | Yes | Yes (DB) | Via service fns | No | `[COMPLETE]` |
| POS Registers | Config-based | Yes | No routes | No | `[SHORTCUT]` |
| POS Receipts | Config-based | Yes | No routes | No | `[SHORTCUT]` |
| POS Z-Reports | Yes (schema) | No | No | No | `[MISSING]` |
| POS Promotions | Yes (schema) | No | No | No | `[MISSING]` |
| Suppliers | Yes | Yes (DB) | Minimal | No | `[PARTIAL]` |
| Purchase Orders | Yes | Yes (DB) | Minimal | No | `[PARTIAL]` |
| RFQs | Config-based | Yes | No routes | No | `[SHORTCUT]` |
| Blanket POs | Yes (schema) | No | No | No | `[MISSING]` |
| Supplier Contracts | Yes (schema) | No | No | No | `[MISSING]` |
| CPQ | Minimal JS | `[STUBBED]` | No | No | `[STUBBED]` |
| HubSpot Sync | Yes (schema) | No | No | No | `[MISSING]` |
| Quote-to-Order | No | No | No | No | `[MISSING]` |
| Order-to-Invoice | Schema FK only | No | No | No | `[MISSING]` |
| Customer (bridge) | Yes | Auto-created | No direct API | No | `[PARTIAL]` |

---

## Section 4: HR / Payroll

### 4.0 Module Overview

The HR module is implemented as a **hybrid architecture** across two distinct layers:

1. **Prisma database models** -- `Employee`, `PaySchedule`, `PayrollRun`, `Payslip`, `Deduction`, `Allowance`, `Department`, `Team`, `UserDepartment`, `UserTeam` are stored in PostgreSQL via Prisma ORM.
2. **TenantConfig JSON blob** -- Employee metadata (status, department, cost centre, pay frequency, leave entitlements), leave types, leave requests, leave balances, payroll configuration, and payroll run records are stored as nested JSON within the `TenantConfig.config` column under the `hr` key.

This dual-storage approach results in significant architectural complexity. Core employee identity fields (name, empNo, contact) reside in Prisma, while operational HR data (status, department, pay, leave) is stored in JSON, requiring merge logic at read time.

**Module Gating:** HR is gated by `TenantConfig.config.modules.hr.enabled` and validated via `requirePlanFeature(tenantId, "hr")`.

**No dedicated API routes exist.** There are no Next.js API routes (`/pages/api/hr/` or `/pages/api/payroll/`) and no tRPC routers for HR. All HR functionality is invoked through server-side service functions, likely called by AI agent tools or internal orchestration. `[GAP]`

**No frontend pages exist.** Routes `/hr/employees`, `/hr/payroll`, `/hr/leave`, `/hr/recruitment` are defined in the AI schema but no corresponding Next.js pages or App Router components exist. `[FRONTEND-GAP]`

---

#### 4.0.1 HR API Layer `[MUST-HAVE -- Added from completeness review M-21]`

**Requirement Source:** Core operability -- no HTTP API routes or tRPC routers exist for any HR functionality. The module cannot be used by any client application.

**Current State in Document:** Section 4.0 explicitly states: "No dedicated API routes exist."

**Description:**
A complete REST API layer for all HR functionality with proper authentication, authorisation, and validation middleware.

**API Operations Expected:**
- **Employees:**
  - `POST /api/hr/employees` -- Create employee
  - `GET /api/hr/employees` -- List employees (paginated, filterable by department, status)
  - `GET /api/hr/employees/[id]` -- Get employee detail
  - `PATCH /api/hr/employees/[id]` -- Update employee
  - `POST /api/hr/employees/[id]/terminate` -- Terminate employee
  - `POST /api/hr/employees/[id]/activate` -- Reactivate employee
  - `GET /api/hr/employees/me` -- Get own employee record (self-service)
  - `PATCH /api/hr/employees/me` -- Update own details (limited fields)
- **Leave:**
  - `POST /api/hr/leave/requests` -- Submit leave request
  - `GET /api/hr/leave/requests` -- List leave requests (filterable by employee, status, date)
  - `GET /api/hr/leave/requests/[id]` -- Get leave request detail
  - `POST /api/hr/leave/requests/[id]/approve` -- Approve leave request
  - `POST /api/hr/leave/requests/[id]/reject` -- Reject leave request
  - `POST /api/hr/leave/requests/[id]/cancel` -- Cancel leave request
  - `GET /api/hr/leave/balances/[employeeId]` -- Get leave balances
  - `GET /api/hr/leave/calendar` -- Team leave calendar view
- **Departments:**
  - `POST /api/hr/departments` -- Create department
  - `GET /api/hr/departments` -- List departments
  - `PATCH /api/hr/departments/[id]` -- Update department
- **Payroll:**
  - `POST /api/hr/payroll/runs` -- Create payroll run
  - `GET /api/hr/payroll/runs` -- List payroll runs
  - `GET /api/hr/payroll/runs/[id]` -- Get payroll run detail with payslips
  - `POST /api/hr/payroll/runs/[id]/calculate` -- Calculate payroll (via third-party API)
  - `POST /api/hr/payroll/runs/[id]/approve` -- Approve payroll run
  - `POST /api/hr/payroll/runs/[id]/post` -- Post payroll to GL
  - `GET /api/hr/payslips/[id]/pdf` -- Download payslip PDF
  - `GET /api/hr/payslips/me` -- Get own payslips (self-service)

**Permissions:**
- `hr:employees:view` -- View employee list (ADMIN+)
- `hr:employees:manage` -- Create/update employees (ADMIN+)
- `hr:employees:self_service` -- View/edit own record (STAFF+)
- `hr:leave:manage` -- Approve/reject leave (ADMIN/MANAGER)
- `hr:leave:submit` -- Submit own leave requests (STAFF+)
- `hr:payroll:view` -- View payroll runs (ADMIN+)
- `hr:payroll:manage` -- Run/approve payroll (ADMIN+)
- `hr:payslips:self_service` -- View own payslips (STAFF+)

---

#### 4.0.2 HR Frontend Pages `[MUST-HAVE -- Added from completeness review M-22]`

**Requirement Source:** Core operability -- no UI pages exist for any HR functionality despite routes being defined in the AI schema. The module is invisible to users.

**Current State in Document:** Section 4.0 states: "No frontend pages exist. Routes /hr/employees, /hr/payroll, /hr/leave, /hr/recruitment are defined in the AI schema but no corresponding pages exist."

**Description:**
Frontend pages for all core HR functionality accessible to appropriate user roles.

**Required Pages:**
- `/hr/employees` -- Employee list with search, filter, pagination
- `/hr/employees/[id]` -- Employee detail/edit form
- `/hr/employees/new` -- New employee form
- `/hr/leave` -- Leave management dashboard (team calendar, pending requests)
- `/hr/leave/request` -- Submit leave request form
- `/hr/leave/balances` -- Leave balance summary
- `/hr/payroll` -- Payroll runs list and management
- `/hr/payroll/[runId]` -- Payroll run detail with payslip preview
- `/hr/departments` -- Department management
- `/hr/org-chart` -- Visual organisation chart
- `/staff/payslips` -- Self-service payslip viewer (STAFF role)
- `/staff/leave` -- Self-service leave request and balance viewer (STAFF role)
- `/staff/profile` -- Self-service employee profile editor (STAFF role)

---

### 4.1 Employee Management

#### 4.1.1 Employee Entity (Prisma Model)

Source: `prisma/schema.prisma` line 1637

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | Indexed | Multi-tenant isolation |
| empNo | String | Yes | -- | `@unique` | Employee number; encrypted at rest (Task B3) |
| empNoEncrypted | String? | No | -- | -- | BYOK encrypted version |
| firstName | String | Yes | -- | -- | |
| lastName | String | Yes | -- | -- | |
| email | String? | No | -- | -- | |
| phone | String? | No | -- | -- | Encrypted at rest (Task B3) |
| phoneEncrypted | String? | No | -- | -- | BYOK encrypted version |
| nationalId | String? | No | -- | -- | NI number / SSN; encrypted at rest |
| nationalIdEncrypted | String? | No | -- | -- | BYOK encrypted version |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Relations:**
- `payslips` -> `Payslip[]` (one-to-many)

**Indexes:**
- `@@index([tenantId])`

`[SCHEMA-GAP]` The Employee model is **extremely minimal** -- it lacks critical fields that exist only in JSON metadata:
- No `status` field (active/inactive/terminated)
- No `departmentId` FK (department stored only in JSON)
- No `startDate` / `endDate` fields
- No `employmentType` field
- No `jobTitle` / `role` field
- No `userId` FK (linking to User)
- No `payFrequency`, `basePay`, `currency` fields
- No `managerId` / `reportsTo` FK
- No `address`, `dateOfBirth`, `gender` fields

`[RECOMMEND]` In the new project, all these fields should be proper columns on the Employee table with appropriate foreign keys and indexes. [CONTRADICTION-RESOLVED: EC-12 -- the Employee schema and its operational usage (Section 4.1.2 JSON metadata) are fundamentally misaligned. The JSON metadata fields listed above must be promoted to proper schema columns with FKs and indexes to support queries like "list all employees in department X".]

#### 4.1.1A Proper Employee Schema `[MUST-HAVE -- Added from completeness review M-20]`

**Requirement Source:** Data integrity -- Employee model has only id, tenantId, empNo, name, email, and nationalId. All operational fields (status, department, job title, manager, start date, employment type, pay frequency, base pay, address, DOB, gender) stored in JSON metadata. Cannot query, index, or validate.

**Current State in Document:** Section 4.1.1 lists 11 missing fields as SCHEMA-GAP.

**Description:**
All employee operational fields must be proper columns on the Employee table with appropriate foreign keys, indexes, and validation.

**Expected Entities/Fields (enhanced Employee):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | Primary key |
| tenantId | String | Yes | |
| empNo | String | Yes | Unique per tenant, auto-generated |
| firstName | String | Yes | |
| lastName | String | Yes | |
| email | String | No | |
| phone | String | No | |
| nationalId | String | No | NI number -- encrypted |
| status | Enum | Yes | active, inactive, on_leave, terminated |
| departmentId | String | No | FK to Department |
| teamId | String | No | FK to Team |
| jobTitle | String | No | |
| managerId | String | No | Self-referential FK to Employee |
| userId | String | No | FK to User (for login access) |
| startDate | Date | Yes | Employment start date |
| endDate | Date | No | Employment end date (if terminated/left) |
| employmentType | Enum | Yes | full_time, part_time, contract, zero_hours |
| payFrequency | Enum | Yes | monthly, weekly, fortnightly |
| basePayMinor | Int | No | Base pay in pence |
| currency | String | No | Default "GBP" |
| payrollEligible | Boolean | Yes | Default true |
| dateOfBirth | Date | No | |
| gender | Enum | No | male, female, non_binary, prefer_not_to_say |
| addressLine1 | String | No | |
| addressLine2 | String | No | |
| city | String | No | |
| county | String | No | |
| postcode | String | No | |
| country | String | No | Default "GB" |
| taxCode | String | No | UK tax code e.g., "1257L" |
| niCategory | String | No | NI category e.g., "A" |
| pensionOptIn | Boolean | No | Pension auto-enrolment status |
| pensionProvider | String | No | NEST, People's Pension, etc. |
| pensionEmployeePct | Decimal | No | Employee contribution % |
| pensionEmployerPct | Decimal | No | Employer contribution % |
| bankAccountName | String | No | For payroll |
| bankSortCode | String | No | |
| bankAccountNumber | String | No | |
| leaveEntitlementDays | Decimal | No | Annual leave entitlement |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |
| createdBy | String | No | |
| updatedBy | String | No | |

**Business Rules:**
- Employee number format: configurable prefix + sequential number (e.g., EMP-0001)
- Status lifecycle: active <-> inactive <-> on_leave, any -> terminated (terminal)
- Terminated employees cannot be reactivated
- Manager must be an active employee in the same tenant
- Department FK must reference valid Department
- Sensitive fields (nationalId, bankSortCode, bankAccountNumber) must be encrypted at rest
- Search must work on name, empNo, department, status, jobTitle

**Competitor Reference:** BambooHR, CharlieHR, Breathe HR, and ERPNext all have comprehensive employee schemas with proper relational columns.

---

#### 4.1.2 Employee Metadata (TenantConfig JSON)

Source: `apps/web/src/server/hr/employees.service.ts`

Employee metadata is stored in `TenantConfig.config.hr.employees` as a `Record<string, EmployeeMeta>` keyed by employee ID.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| status | `"active" \| "inactive" \| "terminated"` | Yes | `"active"` | |
| department | string | No | -- | Free-text, not FK |
| costCenter | string | No | -- | Free-text |
| role | string | No | -- | Job title / role |
| payFrequency | `"monthly" \| "weekly" \| "biweekly"` | No | `"monthly"` | |
| basePayMinor | number | No | `0` | Base pay in minor currency units (pence) |
| currency | string | No | `"GBP"` | |
| payrollEligible | boolean | No | `true` | Whether included in payroll runs |
| leaveEntitlementDays | number | No | `20` | Annual leave entitlement |
| startDate | string | No | -- | ISO date |
| endDate | string | No | -- | ISO date |

#### 4.1.3 Employee Status Lifecycle

```
                  +----------+
                  |  active   |
                  +----+------+
                       |
          +------------+------------+
          |                         |
          v                         v
    +-----------+            +-------------+
    | inactive  |            | terminated  |
    +-----------+            +-------------+
          |                    (terminal)
          |
          v
    +----------+
    |  active  |
    +----------+
```

**Business Rules:**
- `terminated` is a **terminal state** -- terminated employees cannot be reactivated. Attempting to change status from `terminated` to any other status throws `terminated_employees_cannot_be_reactivated` (HTTP 422).
- `active` <-> `inactive` transitions are allowed in both directions.
- Default status for new employees is `"active"`.

#### 4.1.4 Employee CRUD Business Rules

**Create Employee (`createEmployeeWithMeta`):**
1. Checks if HR module is enabled via `getTenantConfig()` -- throws 403 `module_disabled` if HR module is disabled
2. Validates plan feature via `requirePlanFeature(tenantId, "hr")` -- throws 403 if plan does not include HR
3. Creates encrypted employee record via `createEmployeeEncrypted()`
4. Upserts metadata in TenantConfig JSON
5. Employee number generation (legacy path): `EMP-{tenantId}-{6-digit-random}` `[SHORTCUT]` -- uses random number, no sequence guarantee, potential collisions

**Encryption (Task B3 / BYOK):**
- `empNo`, `phone`, `nationalId` are encrypted using tenant-specific BYOK keys
- Both plaintext (for search/indexing) and encrypted versions are stored
- Encryption functions: `encryptEmpNo()`, `encryptPhone()`, `encryptNationalId()`
- Decryption functions: `decryptEmpNo()`, `decryptPhone()`, `decryptNationalId()`
- `[SHORTCUT]` Plaintext is stored alongside encrypted for search -- in production this defeats the purpose of encryption

**Update Employee (`updateEmployeeWithMeta`):**
1. Fetches existing employee (404 if not found)
2. Updates base Prisma fields if any base fields provided (empNo, firstName, lastName, email, phone, nationalId)
3. Updates metadata in TenantConfig JSON (status, department, role, pay, etc.)
4. Applies `normalizeMeta()` merge logic

**Set Status (`setEmployeeStatus`):**
- Legacy path only supports `"active" | "inactive"`
- Service-layer path supports `"active" | "inactive" | "terminated"` with terminal-state guard

**List Employees (`listEmployeesWithMeta`):**
- Fetches from Prisma with pagination (`skip`, `take`)
- Merges with metadata map from TenantConfig JSON
- Returns total count for pagination
- `[SHORTCUT]` Two separate queries (Prisma + JSON) merged in application code

**Filter by Status (`filterEmployeesByStatus`):**
- Client-side filtering after fetch -- not database-level `[SHORTCUT]`

#### 4.1.5 Employee API Operations

No dedicated HTTP API routes exist. All operations are service-layer functions:

| Operation | Function | Source File | Notes |
|-----------|----------|-------------|-------|
| List employees | `listEmployeesWithMeta()` | `employees.service.ts` | Paginated, merges Prisma + JSON |
| List employees (legacy) | `listEmployees()` | `employees.ts` | Returns all, merges Prisma + JSON |
| Get employee | `getEmployee()` | `employees.ts` | 404 if not found |
| Get encrypted employee | `getEmployeeEncrypted()` | `employees-encrypted.ts` | Decrypts sensitive fields |
| Create employee | `createEmployeeWithMeta()` | `employees.service.ts` | Module + plan gated |
| Create employee (legacy) | `createEmployee()` | `employees.ts` | Generates empNo, checks P2002 unique |
| Update employee | `updateEmployeeWithMeta()` | `employees.service.ts` | Updates both Prisma + JSON |
| Update employee (legacy) | `updateEmployee()` | `employees.ts` | Partial update |
| Set status | `setEmployeeStatus()` | `employees.ts` | active/inactive only |
| Upsert metadata | `upsertEmployeeMeta()` | `employees.service.ts` | JSON config only |
| Get metadata map | `getEmployeeMetaMap()` | `employees.service.ts` | All employee metadata |

`[MISSING]` No delete/archive employee operation
`[MISSING]` No bulk import/export
`[MISSING]` No employee search by name/department
`[FRONTEND-GAP]` No UI pages for employee management

#### 4.1.6 Employee Permissions

From AI capabilities definition (`nexa-capabilities.ts`):

| Capability | Roles | Actions |
|------------|-------|---------|
| `hr.employees` | SUPER_ADMIN | VIEW |
| `hr.employees` | ADMIN | VIEW, EDIT |

`[GAP]` No STAFF-level self-service view of own employee record
`[GAP]` No permission enforcement in service layer -- capabilities are defined but not checked in server code

---

### 4.2 Departments & Org Structure

#### 4.2.1 Department Entity

Source: `prisma/schema.prisma` line 3633

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | Indexed | |
| code | String | Yes | -- | Unique per tenant | |
| name | String | Yes | -- | -- | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Relations:**
- `users` -> `UserDepartment[]` (many-to-many via join table)
- `Team` -> `Team[]` (one-to-many)

**Constraints:**
- `@@unique([tenantId, code])` -- department code unique within tenant
- `@@index([tenantId])`

`[SCHEMA-GAP]` Missing fields: `description`, `managerId`, `parentDepartmentId` (for hierarchy), `costCentreCode`, `active/status`

#### 4.2.2 Team Entity

Source: `prisma/schema.prisma` line 3647

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | -- | |
| departmentId | String? | No | -- | FK -> Department | |
| code | String | Yes | -- | Unique per tenant | |
| name | String | Yes | -- | -- | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Relations:**
- `department` -> `Department?` (optional belongs-to)
- `users` -> `UserTeam[]` (many-to-many via join table)

**Constraints:**
- `@@unique([tenantId, code])`
- `@@index([tenantId, departmentId])`

#### 4.2.3 UserDepartment Join Table

Source: `prisma/schema.prisma` line 3662

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| userId | String | Yes | -- | FK -> User | |
| departmentId | String | Yes | -- | FK -> Department | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Constraints:**
- `@@unique([userId, departmentId])` -- prevents duplicate assignments
- `@@index([userId])`

`[SCHEMA-GAP]` Links Users to Departments, but not Employees to Departments. The Employee model has no departmentId FK. Department assignment for employees is stored in TenantConfig JSON metadata only.

#### 4.2.4 UserTeam Join Table

Source: `prisma/schema.prisma` line 3675

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| userId | String | Yes | -- | FK -> User | |
| teamId | String | Yes | -- | FK -> Team | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Constraints:**
- `@@unique([userId, teamId])`
- `@@index([userId])`

#### 4.2.5 Department/Team Business Rules

`[MISSING]` No server-side CRUD services for Department or Team exist. The schema defines the models, but there are no service files like `department.service.ts` or `team.service.ts`.

`[MISSING]` No API operations for managing departments, teams, or user assignments.

`[SCHEMA-GAP]` User-Department and User-Team link to `User`, not `Employee`. There is no `EmployeeDepartment` or `EmployeeTeam` join table. The Employee model's department is a free-text JSON field.

`[RECOMMEND]` In the new project:
- Add `Employee.departmentId` FK
- Add `Employee.teamId` FK
- Add `Employee.managerId` self-referential FK for org hierarchy
- Add `Department.parentDepartmentId` for department hierarchy
- Create proper service layer with CRUD operations

---

### 4.3 Leave Management

Leave management is implemented across **two parallel systems** -- a legacy system and an enhanced system. Both store data in TenantConfig JSON rather than dedicated database tables.

#### 4.3.1 Legacy Leave System

Source: `apps/web/src/server/hr/helpers.ts`, `apps/web/src/server/hr/leaveRequests.ts`, `apps/web/src/server/hr/leavePolicy.ts`, `apps/web/src/server/hr/dateCalc.ts`

##### 4.3.1.1 Leave Request (Legacy Type)

Stored in `TenantConfig.config.hr.leaveRequests` as an array.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | string | Yes | UUID | |
| tenantId | string | Yes | -- | |
| employeeId | string | Yes | -- | |
| startDate | string | Yes | -- | ISO date (date-only) |
| endDate | string | Yes | -- | ISO date (date-only) |
| days | number | Yes | computed | Inclusive day count |
| type | `"annual" \| "sick" \| "unpaid"` | Yes | -- | |
| status | `"draft" \| "submitted" \| "approved" \| "rejected" \| "cancelled"` | Yes | `"draft"` | |
| notes | string? | No | -- | |
| createdAt | string | Yes | -- | ISO datetime |
| updatedAt | string | Yes | -- | ISO datetime |

##### 4.3.1.2 Leave Policy (Legacy)

Stored in `TenantConfig.config.hr.leavePolicy`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| holidayYearStartMonth | number | Yes | `1` (January) | 1-12 |
| entitlementDays | number | Yes | `28` | UK statutory default |
| carryOverDays | number | Yes | `5` | Max carry-over days |

##### 4.3.1.3 Legacy Leave Status Lifecycle

```
  +-------+      submit      +-----------+
  | draft |  ------------>   | submitted |
  +---+---+                  +-----+-----+
      |                        |       |
      | cancel                 |       |
      v                 approve|       |reject
  +-----------+                |       |
  | cancelled |<------+        v       v
  +-----------+       |   +---------+  +----------+
      ^               |   | approved|  | rejected |
      |               |   +----+----+  +----------+
      +----cancel-----+        |
                                |
                           (terminal)
```

**Transition Rules (Legacy):**
- `draft` -> `submitted`: checks for overlap with existing submitted/approved requests for same employee
- `submitted` -> `approved`: checks overlap + checks annual leave entitlement
- `submitted` -> `rejected`: allowed
- `draft`, `submitted`, `approved` -> `cancelled`: allowed
- `rejected`, `cancelled` are terminal (no outbound transitions)
- Only `draft` requests can be edited (fields: startDate, endDate, type, notes)

##### 4.3.1.4 Legacy Leave Business Rules

**Overlap Detection:**
- Two requests overlap if date ranges intersect (inclusive)
- Only checks against requests with status `submitted` or `approved`
- Same employee only

**Entitlement Validation (annual leave only):**
- Calculated per holiday year (configurable start month)
- `holidayYearRange()` computes the start/end of the holiday year containing the request date
- Sums all `approved` annual leave days within the holiday year
- Allowance = `entitlementDays + carryOverDays`
- If `approvedTotal + requestDays > allowance`, throws `entitlement_exceeded` (409)
- `[GAP]` Only checked on approval, not on submission
- `[GAP]` No per-employee entitlement override in legacy system

**Day Calculation:**
- `inclusiveDays(start, end)`: counts calendar days inclusive of both endpoints
- Validates date format, throws 422 for invalid dates
- Throws 422 if end < start
- `[GAP]` No weekend/bank holiday exclusion -- counts all calendar days

**Holiday Year Calculation:**
- If current month >= startMonth, year = current year; else year = previous year
- Range: [startYear-startMonth-01, startYear+1-startMonth-01)

#### 4.3.2 Enhanced Leave System

Source: `apps/web/src/server/hr/leave.service.ts`, `apps/web/src/server/hr/leaveConfig.service.ts`

The enhanced system adds half-day support, a "taken" status, configurable leave types, per-employee entitlements, accrual logic, and balance tracking.

##### 4.3.2.1 Leave Request (Enhanced Type)

Stored in `TenantConfig.config.hr.leave.requests` as a `Record<string, LeaveRequest>` keyed by ID.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | string | Yes | UUID | |
| employeeId | string | Yes | -- | |
| leaveTypeCode | string | Yes | -- | References LeaveType.code |
| startDate | string | Yes | -- | ISO date |
| endDate | string | Yes | -- | ISO date |
| halfDayStart | boolean? | No | -- | If true, first day is half-day |
| halfDayEnd | boolean? | No | -- | If true, last day is half-day |
| status | `"draft" \| "submitted" \| "approved" \| "rejected" \| "cancelled" \| "taken"` | Yes | `"draft"` | |
| notes | string? | No | -- | |
| approverUserId | string? | No | -- | Set on approve/reject |
| createdAt | string | Yes | -- | ISO datetime |
| updatedAt | string | Yes | -- | ISO datetime |
| submittedAt | string? | No | -- | Timestamp of submission |
| approvedAt | string? | No | -- | Timestamp of approval |
| rejectedAt | string? | No | -- | Timestamp of rejection |
| cancelledAt | string? | No | -- | Timestamp of cancellation |
| takenAt | string? | No | -- | Timestamp of marking as taken |

##### 4.3.2.2 Enhanced Leave Status Lifecycle

```
  +-------+     submit      +-----------+
  | draft |  ------------>  | submitted |
  +---+---+                 +-----+-----+
      |                       |   |   |
      | cancel         approve|   |   |reject
      v                       |   |   |
  +-----------+               v   |   v
  | cancelled |<-----+  +---------+  +----------+
  +-----------+      |  | approved|  | rejected |
   (terminal)        |  +----+----+  +----------+
                     |       |          (terminal)
                cancel|      | taken
                     |       v
                     +--+-------+
                        | taken |
                        +-------+
                        (terminal)
```

**Transition Matrix:**
| From | Allowed To |
|------|-----------|
| draft | submitted, cancelled |
| submitted | approved, rejected, cancelled |
| approved | taken, cancelled |
| rejected | (none -- terminal) |
| cancelled | (none -- terminal) |
| taken | (none -- terminal) |

##### 4.3.2.3 Leave Type Configuration

Source: `apps/web/src/server/hr/leaveConfig.service.ts`

Stored in `TenantConfig.config.hr.leave.leaveTypes` as an array.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| code | string | Yes | -- | Unique identifier |
| name | string | Yes | -- | Display name |
| paid | boolean | Yes | -- | Whether leave is paid |
| defaultAnnualDays | number | Yes | `0` | Default entitlement |
| carryoverAllowed | boolean | Yes | -- | Whether carryover is permitted |
| maxCarryoverDays | number? | No | -- | Max days that can carry over |
| accrualFrequency | `"annual" \| "monthly"` | No | -- | How entitlement accrues |
| accrualDaysPerPeriod | number? | No | -- | Days per accrual period |
| active | boolean | No | `true` | Whether type is currently active |

**Business Rules:**
- Duplicate codes within the same `upsertLeaveTypes()` call throw `duplicate_code_{code}` (400)
- Normalization: `paid` and `carryoverAllowed` are coerced to boolean; numeric fields are coerced via `Number()`

##### 4.3.2.4 Leave Entitlement (Per-Employee Override)

Stored in `TenantConfig.config.hr.leave.entitlementsByEmployee` as `Record<string, LeaveEntitlement[]>`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| leaveTypeCode | string | Yes | -- | References LeaveType.code |
| annualDays | number | Yes | `0` | Override annual entitlement |
| carryoverDays | number? | No | -- | Override carryover |
| effectiveFrom | string? | No | -- | ISO date |
| effectiveTo | string? | No | -- | ISO date |

**Business Rules:**
- When entitlements are set, `recomputeBalancesForEmployee()` is called automatically
- Per-employee entitlements override leave type defaults

##### 4.3.2.5 Leave Balance

Stored in `TenantConfig.config.hr.leave.balancesByEmployee` as `Record<string, Record<string, LeaveBalance>>`.

| Field | Type | Notes |
|-------|------|-------|
| leaveTypeCode | string | |
| year | number | Calendar year |
| entitlementDays | number | Total annual entitlement |
| carryoverDays | number | Days carried over |
| accruedDays | number | Days accrued to date |
| takenDays | number | Days taken (approved + taken status) |
| remainingDays | number | Max(0, accrued + carryover - taken) |
| lastAccrualDate | string? | ISO datetime of last accrual |

##### 4.3.2.6 Accrual Calculation

Source: `leave.service.ts` function `computeAccrued()`

```
accruedDays = entitlement * (monthsElapsed / 12)
```

Where `monthsElapsed = current UTC month index + 1` (1 in January, 12 in December).

Capped at `Math.min(entitlement, Math.max(0, accrued))`.

`[SHORTCUT]` This is a simple proportional accrual -- does not account for:
- Employee start date within the year
- Custom accrual schedules (despite `accrualFrequency` being configurable)
- Accrual by days worked
- Pro-rata for part-time employees

##### 4.3.2.7 Balance Recomputation

Triggered on:
- Status change to `approved`, `taken`, or `cancelled`
- Setting employee entitlements
- Getting balances for employee

**Logic:**
1. Collect all `approved` or `taken` requests for the employee
2. For each leave type, compute entitlement and carryover from config
3. Compute accrued days using proportional formula
4. Sum taken days using `daysBetweenInclusive()` with half-day support
5. `remainingDays = Max(0, accrued + carryover - taken)`
6. Existing balances are never reduced below their previous value (monotonically increasing protection)

##### 4.3.2.8 Half-Day Calculation

Source: `leave.service.ts` function `daysBetweenInclusive()`

```
days = floor((endDate - startDate) / msPerDay) + 1
if halfDayStart: days -= 0.5
if halfDayEnd: days -= 0.5
minimum: 0.5 if any half-day flag set, 0 otherwise
```

##### 4.3.2.9 Leave Correction Model (P10D)

Comments document an immutability-based correction model:
- Leave requests are immutable once cancelled/rejected/taken
- Corrections happen via cancel + adjust with audit trail
- Approved future leave can be cancelled
- Past/taken leave should not be silently removed
- `adjustLeaveRequest()` allows modifying startDate, endDate, halfDayStart, halfDayEnd, notes on non-terminal requests
- Both cancel and adjust operations emit audit events (`hr.leave.cancelled`, `hr.leave.adjusted`)

#### 4.3.3 Leave API Operations

| Operation | Function | Source | Notes |
|-----------|----------|--------|-------|
| Create request | `createRequest()` | `leave.service.ts` | Creates with draft status |
| Submit request | `submitRequest()` | `leave.service.ts` | draft -> submitted |
| Approve request | `approveRequest()` | `leave.service.ts` | submitted -> approved, recomputes balances |
| Reject request | `rejectRequest()` | `leave.service.ts` | submitted -> rejected |
| Cancel request | `cancelRequest()` / `cancelLeaveRequest()` | `leave.service.ts` | Multiple cancel paths; recomputes balances |
| Mark taken | `markTaken()` | `leave.service.ts` | approved -> taken; recomputes balances |
| Adjust request | `adjustLeaveRequest()` | `leave.service.ts` | Modify dates/notes on non-terminal |
| List for tenant | `listRequestsForTenant()` | `leave.service.ts` | Filterable by status, employeeId |
| List for employee | `listRequestsForEmployee()` | `leave.service.ts` | Delegates to tenant list |
| List for period | `listRequestsForPeriod()` | `leave.service.ts` | Window-based overlap filter |
| Get balances | `getBalancesForEmployee()` | `leave.service.ts` | Recomputes on access |
| Recompute balances | `recomputeBalancesForEmployee()` | `leave.service.ts` | Force recompute |
| Upsert leave types | `upsertLeaveTypes()` | `leaveConfig.service.ts` | Tenant-wide config |
| Set entitlements | `setEmployeeEntitlements()` | `leaveConfig.service.ts` | Per-employee override |
| Get leave config | `getLeaveConfig()` | `leaveConfig.service.ts` | Leave types + entitlements |
| Get policy (legacy) | `getPolicy()` | `leavePolicy.ts` | Legacy leave policy |
| Set policy (legacy) | `setPolicy()` | `leavePolicy.ts` | Update legacy policy |
| List requests (legacy) | `listLeaveRequests()` | `leaveRequests.ts` | Array-based, filterable by employeeIds |
| Create request (legacy) | `createLeaveRequest()` | `leaveRequests.ts` | Validates dates, calculates days |
| Update request (legacy) | `updateLeaveRequest()` | `leaveRequests.ts` | Only draft status |
| Submit (legacy) | `submitLeaveRequest()` | `leaveRequests.ts` | Overlap check |
| Approve (legacy) | `approveLeaveRequest()` | `leaveRequests.ts` | Overlap + entitlement check |
| Reject (legacy) | `rejectLeaveRequest()` | `leaveRequests.ts` | Status guard |
| Cancel (legacy) | `cancelLeaveRequest()` | `leaveRequests.ts` | Broader cancellation |

`[SHORTCUT]` In-memory request cache (`requestCache` Map) is used to avoid read-after-write gaps -- not production-safe for multi-instance deployments.

`[MISSING]` No approval workflow with delegation/escalation
`[MISSING]` No email/notification on leave status changes
`[MISSING]` No calendar view / team leave planner
`[MISSING]` No bank holiday / public holiday integration
`[GAP]` Weekend exclusion not implemented in day calculations

#### 4.3.4 Leave Permissions

| Capability | Roles | Actions |
|------------|-------|---------|
| `hr.leave` | SUPER_ADMIN | VIEW |
| `hr.leave` | ADMIN | VIEW, EDIT |
| `hr.leave` | STAFF | VIEW |

`[GAP]` STAFF has VIEW but no SUBMIT/REQUEST action -- employees cannot request their own leave through permissions model
`[GAP]` No manager-level approval permission -- approval is service-level only

---

#### 4.3.5 Leave Management with Proper Schema `[MUST-HAVE -- Added from completeness review M-31]`

**Requirement Source:** Core operability -- no LeaveRequest, LeaveType, or LeaveBalance models exist in the database schema. All leave data is in JSON blobs. Cannot have a functioning HR module without proper leave management.

**Current State in Document:** Sections 4.3.1-4.3.2 document JSON-based leave systems with no database models.

**Description:**
Create proper database-backed leave management with LeaveRequest, LeaveType, and LeaveBalance entities.

**Expected Entities/Fields (LeaveType):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| code | String | Yes | Unique per tenant (e.g., "annual", "sick", "unpaid") |
| name | String | Yes | Display name |
| paid | Boolean | Yes | Whether leave is paid |
| defaultEntitlementDays | Decimal | Yes | Default annual entitlement |
| carryoverAllowed | Boolean | Yes | Whether unused days carry over |
| maxCarryoverDays | Decimal | No | Maximum carryover days |
| requiresApproval | Boolean | Yes | Default true |
| active | Boolean | Yes | Default true |

**Expected Entities/Fields (LeaveRequest):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| employeeId | String | Yes | FK to Employee |
| leaveTypeId | String | Yes | FK to LeaveType |
| startDate | Date | Yes | |
| endDate | Date | Yes | |
| halfDayStart | Boolean | No | Default false |
| halfDayEnd | Boolean | No | Default false |
| totalDays | Decimal | Yes | Computed (excluding weekends and bank holidays) |
| status | Enum | Yes | draft, submitted, approved, rejected, cancelled, taken |
| notes | String | No | |
| approverUserId | String | No | FK to User |
| submittedAt | DateTime | No | |
| approvedAt | DateTime | No | |
| rejectedAt | DateTime | No | |
| cancelledAt | DateTime | No | |
| rejectionReason | String | No | |
| createdAt | DateTime | Auto | |
| updatedAt | DateTime | Auto | |

**Expected Entities/Fields (LeaveBalance):**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| employeeId | String | Yes | FK to Employee |
| leaveTypeId | String | Yes | FK to LeaveType |
| year | Int | Yes | Leave year |
| entitlement | Decimal | Yes | Total entitlement for year |
| carriedOver | Decimal | Yes | Days carried from previous year |
| taken | Decimal | Yes | Days taken |
| pending | Decimal | Yes | Days in pending/approved requests |
| remaining | Decimal | Yes | Computed: entitlement + carriedOver - taken - pending |

**Business Rules:**
- Day calculation must exclude weekends and UK bank holidays
- Overlap detection: cannot submit leave that overlaps with existing approved/submitted leave
- Entitlement check on approval (not just submission)
- Manager approval workflow with email notification
- Auto-accrual for new starters (proportional entitlement based on start date)
- Year-end carryover processing

---

### 4.4 Attendance / Time Tracking

`[MISSING]` No attendance or time tracking functionality exists in the HR module. The timesheets system exists under Projects (`apps/web/src/server/projects/timesheets.ts`) but is project-focused, not HR attendance-focused.

`[RECOMMEND]` For the new project:
- Clock in/out tracking
- Overtime calculation
- Absence management integrated with leave
- Timesheet approval workflow
- Integration with payroll for hours-based pay

---

### 4.5 Payroll

The payroll system has **three parallel implementations** at different maturity levels, plus UK-specific tax calculators.

#### 4.5.1 PaySchedule Entity

Source: `prisma/schema.prisma` line 1656

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | -- | |
| name | String | Yes | -- | -- | e.g., "PAYROLL-UK-MONTHLY" |
| frequency | String | Yes | -- | -- | "monthly", "weekly", etc. |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Relations:**
- `PayrollRun` -> `PayrollRun[]`

`[SCHEMA-GAP]` Missing: `payDayOfMonth`, `payDayOfWeek`, `active` flag, `taxYear` reference

#### 4.5.2 PayrollRun Entity (Prisma)

Source: `prisma/schema.prisma` line 1666

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | -- | |
| scheduleId | String | Yes | -- | FK -> PaySchedule | |
| periodStart | DateTime | Yes | -- | -- | |
| periodEnd | DateTime | Yes | -- | -- | |
| status | PayrollRunStatus | Yes | `draft` | -- | Enum |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**PayrollRunStatus Enum:**
```
enum PayrollRunStatus {
  draft
  calculated
  posted
}
```

**Relations:**
- `schedule` -> `PaySchedule`
- `Payslip` -> `Payslip[]`

`[SCHEMA-GAP]` Missing: `payDate`, `processedBy`, `approvedBy`, `totalGross`, `totalNet`, `totalDeductions`, `currency`, `reversalRef`

#### 4.5.3 PayrollRun Status Lifecycle (Prisma-based)

```
  +-------+    calculate    +------------+    finalise    +--------+
  | draft | ------------->  | calculated | ------------> | posted  |
  +-------+                 +------------+               +--------+
```

**Transition Rules:**
- `draft` -> `calculated`: recalculates all payslips (deletes existing, recreates)
- `calculated` -> `posted`: validates GL period is open, finalises
- `posted` is terminal in Prisma; cannot be recalculated
- `calculated` can be re-calculated (back to `calculated`)

#### 4.5.4 Payslip Entity (Prisma)

Source: `prisma/schema.prisma` line 1679

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| tenantId | String | Yes | -- | -- | |
| runId | String | Yes | -- | FK -> PayrollRun | |
| employeeId | String | Yes | -- | FK -> Employee | |
| grossPay | Decimal | Yes | `0` | -- | |
| netPay | Decimal | Yes | `0` | -- | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |

**Relations:**
- `Allowance` -> `Allowance[]`
- `Deduction` -> `Deduction[]`
- `employee` -> `Employee`
- `run` -> `PayrollRun`

**Indexes:**
- `@@index([tenantId, runId, employeeId])`

`[SCHEMA-GAP]` Missing: `payDate`, `taxCode`, `niCategory`, `pensionOptIn`, `hoursWorked`, `paymentMethod`, `bankSortCode`, `bankAccountNumber`, `currency`

#### 4.5.5 Deduction Entity

Source: `prisma/schema.prisma` line 1696

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| payslipId | String | Yes | -- | FK -> Payslip | |
| name | String | Yes | -- | -- | e.g., "PAYE", "NI Employee", "Pension Employee" |
| amount | Decimal | Yes | -- | -- | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |
| tenantId | String | Yes | -- | Indexed | |

`[SCHEMA-GAP]` Missing: `type` (enum: tax, ni, pension, student_loan, other), `rate`, `threshold`, `statutory` flag

#### 4.5.6 Allowance Entity

Source: `prisma/schema.prisma` line 1709

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | String | Yes | `cuid()` | PK | |
| payslipId | String | Yes | -- | FK -> Payslip | |
| name | String | Yes | -- | -- | e.g., "NI Employer", "Pension Employer" |
| amount | Decimal | Yes | -- | -- | |
| createdAt | DateTime | Yes | `now()` | -- | |
| updatedAt | DateTime | Yes | `@updatedAt` | -- | |
| tenantId | String | Yes | -- | Indexed | |

`[SHORTCUT]` The Allowance table is being used to store **employer costs** (NI Employer, Pension Employer) rather than employee allowances/benefits. This is a semantic misuse of the entity.

#### 4.5.7 Payroll Configuration (TenantConfig JSON)

Source: `apps/web/src/server/hr/payrollConfig.service.ts`

Stored in `TenantConfig.config.hr.payroll`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| frequency | `"monthly" \| "weekly" \| "biweekly"` | Yes | `"monthly"` | |
| payDayOfMonth | number? | No | `28` | For monthly; 1-28 |
| deductions.incomeTaxRate | number? | No | `0.2` | Placeholder rate (0-1) |
| deductions.niEmployeeRate | number? | No | `0.12` | |
| deductions.niEmployerRate | number? | No | `0.138` | |
| deductions.pensionEmployeeRate | number? | No | `0.05` | |
| deductions.pensionEmployerRate | number? | No | `0.03` | |
| deductions.studentLoanRate | number? | No | `0.09` | |
| calendar | PayrollPeriod[] | No | `[]` | Auto-generated |
| updatedAt | string? | No | -- | |

**Calendar Auto-Generation:**
- For monthly: generates 12 periods from current month, pay day clamped to days-in-month
- For weekly: generates periods stepping 7 days from today
- For biweekly: generates periods stepping 14 days from today
- `[SHORTCUT]` Non-monthly frequencies are forced back to monthly in `getPayrollConfig()`: "For demo/test tenants, enforce monthly as the safe default"

#### 4.5.8 Payroll Implementation 1: Prisma-Based Pay Runs

Source: `apps/web/src/server/payroll/payRuns.ts`

This is the most structured implementation using Prisma models.

**Create Pay Run (`createPayRun`):**
1. Parses period string (YYYY-MM) into start/end dates
2. Ensures a PaySchedule exists (creates "PAYROLL-UK-MONTHLY" if missing)
3. Creates PayrollRun record in `draft` status

**Calculate Pay Run (`calculatePayRun`):**
1. Validates status is `draft` or `calculated`
2. Lists eligible employee settings (from UK payroll config)
3. Throws 422 if no employees
4. In a transaction: deletes existing payslips/deductions/allowances, recalculates all
5. For each employee: calls `calculatePayslip()` from calculations module
6. Creates Payslip, Deduction (PAYE, NI Employee, Pension Employee), Allowance (NI Employer, Pension Employer) records
7. Persists payslip meta and run totals to TenantConfig JSON
8. Updates PayrollRun status to `calculated`

**Finalise Pay Run (`finalisePayRun`):**
1. Validates status is `calculated` (409 if already posted, 409 if not calculated)
2. Calls `assertGlPeriodOpen()` -- checks no closed PeriodClose record covers the pay date
3. Updates status to `posted`

**Build GL Draft (`buildGlDraft`):**
1. Validates GL account mappings exist (5 required accounts)
2. Fetches all payslips for the run
3. Sums all payslip metas (gross, tax, NI, pension, net)
4. Creates balanced journal entry draft:
   - DR: Wages Expense (gross + employer NI + employer pension)
   - CR: PAYE Liability (tax)
   - CR: NI Liability (employee NI + employer NI)
   - CR: Pension Liability (employee pension + employer pension)
   - CR: Net Wages Payable (net)
5. Validates debit = credit, throws 500 if unbalanced

#### 4.5.9 Payroll Implementation 2: TenantConfig JSON-Based Runs

Source: `apps/web/src/server/hr/payrollRun.service.ts`

This is a more comprehensive implementation that bypasses Prisma PayrollRun records and stores everything in TenantConfig JSON. It includes GL journal posting, leave snapshots, reversal, and adjustments.

**Run Payroll for Period (`runPayrollForPeriod`):**
1. Checks HR module is enabled (403 if disabled)
2. Checks for idempotent cached run (returns if valid run exists for period)
3. Gets payroll config
4. Lists active, payroll-eligible employees
5. Throws 400 if no active employees
6. For each employee: computes pay using UK tax calculator (`computeAnnual`)
7. Calculates period totals
8. Posts journal entry to Finance GL with 4 lines:
   - DR: `5000-PAYROLL-EXP` (gross)
   - DR: `5001-EMPLOYER-COSTS` (employer NI + pension)
   - CR: `2100-NET-PAY-ACCRUAL` (net pay)
   - CR: `2105-PAYROLL-LIAB` (deductions + employer costs)
9. Captures leave snapshots for the period
10. Persists run and payslips to TenantConfig JSON
11. Updates payroll config

**Payroll Computation per Employee (`computeForEmployee`):**
```
grossMinor = basePayMinor || 300000 (default 3000.00 GBP) [SHORTCUT]
grossAnnual = grossMinor * periodsPerYear
annual = computeAnnual(grossAnnual) // UK tax calculation
Each deduction = annual amount / periodsPerYear (rounded)
```

`[SHORTCUT]` Default gross of 300000 minor units (3,000 GBP/month) is hardcoded as fallback.

**Periods per Year:**
- monthly: 12
- biweekly: 26
- weekly: 52

**Reverse Payroll Run (`reversePayrollRun`):**
1. Finds existing run (404 if not found)
2. Checks not already reversed (409 if reversed)
3. Checks GL period is open via `assertPeriodOpen()`
4. Posts reversal journal entry (all entries flipped: debits become credits and vice versa)
5. Marks run as reversed with timestamp and reason
6. Emits audit event `hr.payroll.run_reversed`

**Payroll Adjustment (`createPayrollAdjustment`):**
1. Finds base run (404 if not found)
2. Finds employee (404 if not found)
3. Checks GL period is open
4. Creates adjustment run with key `{baseRunId}-adj-{timestamp}`
5. Posts journal entry for the adjustment amount (simple: expense DR, accrual CR)
6. No deduction calculations on adjustments -- gross = net `[SHORTCUT]`
7. Emits audit event `hr.payroll.adjustment_created`

**Correction Model (P10D):**
- Posted payroll runs are immutable
- Corrections via reversal journal (same period if open) or adjustment run in current open period
- Payslips from a run are immutable; adjustment payslips are separate records
- Period-close respected via finance period guard
- Double reversal blocked via `reversedAt` metadata check

#### 4.5.10 Payroll Implementation 3: File-Based Store

Source: `apps/web/src/lib/hr/payrollStore.ts`

A **legacy/fallback** implementation using JSON files on disk.

- Data stored in `apps/web/.data/hr-payroll/{tenantId}.json`
- Simple net calculation: `net = gross * 0.8` (80% of gross) `[STUBBED]`
- No tax/NI/pension calculation
- Emits audit event `hr.payroll.run`

`[STUBBED]` This is clearly a stub/placeholder implementation.

#### 4.5.11 Payroll Job Runner

Source: `apps/web/src/jobs/payroll/run.ts`

Background job that creates Prisma-based payroll runs.

- Upserts PaySchedule if missing
- Creates PayrollRun record
- For each employee: assumes 30,000 GBP annual salary `[SHORTCUT]`
- Uses `computeAnnual()` for UK tax calculation
- Creates Payslip records in Prisma

`[SHORTCUT]` Hardcoded 30K salary for all employees.

#### 4.5.12 UK Tax Calculators

Source: `apps/web/src/server/payroll/calculators.ts`

**PAYE Income Tax (`computePAYE`):**
```
Personal Allowance: 12,570
Basic Rate (20%): 12,571 - 50,270
Higher Rate (40%): 50,271 - 125,140
Additional Rate (45%): over 125,140
```

**National Insurance Employee (`computeNIEmployee`):**
```
Primary Threshold (PT): 9,500 per annum
Upper Earnings Limit: 50,000
Rate below UEL: 12%
Rate above UEL: 2%
```

**National Insurance Employer (`computeNIEmployer`):**
```
Secondary Threshold: 9,500 (same as PT)
Rate: 13.8%
```

**Auto-Enrolment Pension (`computePension`):**
```
Lower Earnings Threshold: 6,240
Employee Default: 5% of qualifying earnings
Employer Default: 3% of qualifying earnings
Pension can be opted out
```

**Student Loan (`computeStudentLoan`):**
```
Threshold: 27,295
Rate: 9% of earnings above threshold
Only applied if enabled
```

**Net Calculation:**
```
net = gross - PAYE - NI Employee - Pension Employee - Student Loan
```

`[SHORTCUT]` These are simplified UK 2025 tax bands for demo purposes. Comments confirm: "Simplified UK bands for demo (2025) -- numbers illustrative". No support for:
- Tax code parsing (1257L etc.)
- Multiple NI categories (only Category A)
- Scottish/Welsh tax rates
- Marriage allowance
- Multiple student loan plan types
- National Insurance LEL/UEL thresholds by period
- Employer's Allowance

#### 4.5.13 Prisma-Based Payslip Calculation

Source: `apps/web/src/server/payroll/calculations.ts`

A separate calculation engine using Prisma Decimal precision:

```
Monthly gross = annualSalary / 12
Monthly allowance = 12,570 / 12 = 1,047.50
Taxable = max(0, gross - allowance)
Tax = taxable * 20%
NI threshold = 1,048/month
NI employee = max(0, gross - 1,048) * 12%
NI employer = max(0, gross - 1,048) * 13.8%
Pension employee = gross * pensionEmployeePct / 100 (if enabled)
Pension employer = gross * pensionEmployerPct / 100 (if enabled)
Net = gross - tax - NI employee - pension employee
```

`[SHORTCUT]` Uses only basic rate (20%) for income tax -- no higher/additional rate bands. Simpler than the `calculators.ts` version.

#### 4.5.14 UK Payroll Employee Settings

Source: `apps/web/src/server/payroll/settings.ts`

Per-employee payroll settings stored in TenantConfig JSON (`payrollUk.employeeSettings`).

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| employeeId | string | -- | Links to Employee |
| annualSalary | Decimal | `36,000` | |
| payFrequency | `"monthly"` | `"monthly"` | Hardcoded to monthly only |
| taxCode | string | `"1257L"` | UK tax code |
| niCategory | string | `"A"` | NI category |
| pensionEnabled | boolean | `true` | Auto-enrolment |
| pensionEmployeePct | number | `5` | % |
| pensionEmployerPct | number | `3` | % |

**Business Rules:**
- Employee must exist in Prisma (404 check)
- Upsert logic: merge with existing settings
- Tax code is stored but not parsed for calculation `[SHORTCUT]`
- NI category is stored but only Category A is implemented `[SHORTCUT]`

#### 4.5.15 GL Account Mappings

Source: `apps/web/src/server/payroll/settings.ts`

| Mapping | Purpose |
|---------|---------|
| wagesExpenseAccountCode | Wages expense (debit) |
| payeLiabilityAccountCode | PAYE liability (credit) |
| niLiabilityAccountCode | NI liability (credit) |
| pensionLiabilityAccountCode | Pension liability (credit) |
| netWagesPayableAccountCode | Net wages payable (credit) |

All 5 mappings are required. Validation throws 422 `missing_account` if any are empty.

#### 4.5.16 BACS Payment File Generation

Source: `apps/web/src/server/payroll/bacs.ts`

Generates CSV-format BACS payment files.

| Column | Type | Notes |
|--------|------|-------|
| DestinationSortCode | string | Bank sort code |
| DestinationAccountNumber | string | Bank account number |
| AmountPence | number | Amount in pence |
| DestinationName | string | Payee name (CSV-escaped) |
| Reference | string | Payment reference (CSV-escaped) |
| ProcessingDate | string | YYYYMMDD format |

`[PARTIAL]` File generation exists but no integration with payroll runs to auto-generate BACS files. No API endpoint to trigger BACS export.

#### 4.5.17 Payslip PDF Generation

Source: `apps/web/src/server/payroll/payslip-pdf.ts`

Generates A4 PDF payslips using `pdf-lib`.

**Content:**
- Title: "Nexa ERP -- Payslip"
- Employee name and code
- Period start/end
- Line items: Gross, Net, PAYE, NI, Pension (Employee/Employer), Student Loan
- Amounts formatted as GBP (pounds)

**Output:** Saved to `apps/web/public/_generated/payslips/payslip-{timestamp}.pdf`

`[PARTIAL]` PDF generation exists but:
- No API endpoint to request payslip PDF
- No integration with payroll run to auto-generate PDFs
- Files saved to public directory with no access control `[SHORTCUT]`
- No email delivery of payslips

#### 4.5.18 Payroll Event System

**Event: `hr.payroll.run.committed`**

Source: `apps/web/src/server/events/types.ts`

| Field | Type | Notes |
|-------|------|-------|
| runId | string | PayrollRun.id |
| periodStart | string | ISO date |
| periodEnd | string | ISO date |
| employeeCount | number | Number of employees in run |
| totalGrossPayMinor | number | Total gross in minor units |
| committedAt | string | ISO datetime |

**Subscriber Action:**
When this event fires, the subscriber:
1. Fetches the PayrollRun from Prisma
2. Fetches all Payslips for the run
3. Fetches all Deductions to extract PAYE tax
4. Calculates totals (net, tax)
5. Creates/finds GL accounts (Payroll Expense, Payroll Payable, PAYE Liability)
6. Posts a JournalEntry with balanced lines

`[SHORTCUT]` The subscriber creates accounts on-the-fly if they don't exist, using name-derived codes. This is fragile.

#### 4.5.19 Payroll API Operations

No dedicated HTTP API routes. All operations are service-layer functions:

**Prisma-Based (payRuns.ts):**

| Operation | Function | Notes |
|-----------|----------|-------|
| Create pay run | `createPayRun()` | Creates draft PayrollRun |
| List pay runs | `listPayRuns()` | With meta from JSON |
| Get pay run | `getPayRun()` | With meta |
| Calculate pay run | `calculatePayRun()` | Recalculates all payslips |
| Finalise pay run | `finalisePayRun()` | Checks GL period, posts |
| List payslips | `listPayslips()` | By run, optional employee filter |
| Get payslip meta | `getPayslipMeta()` | From JSON config |
| Get run totals | `getRunTotals()` | From JSON config |
| Build GL draft | `buildGlDraft()` | Creates balanced journal draft |

**JSON-Based (payrollRun.service.ts):**

| Operation | Function | Notes |
|-----------|----------|-------|
| Run payroll for period | `runPayrollForPeriod()` | Idempotent, posts GL journal |
| List payroll runs | `listPayrollRunsForTenant()` | All runs, sorted by date desc |
| List payslips | `listPayslips()` | Multiple fallback strategies |
| Get employee payslip | `getPayslipForEmployee()` | Multiple fallback strategies |
| Reverse payroll run | `reversePayrollRun()` | Posts reversal journal |
| Create adjustment | `createPayrollAdjustment()` | Posts adjustment journal |

**UK Settings (settings.ts):**

| Operation | Function | Notes |
|-----------|----------|-------|
| List employee settings | `listEmployeeSettings()` | All employee payroll configs |
| Get employee setting | `getEmployeeSetting()` | With defaults |
| Upsert employee setting | `upsertEmployeeSetting()` | Validates employee exists |
| Upsert GL mappings | `upsertGlMappings()` | All 5 required |
| Get GL mappings | `getGlMappings()` | |

**Payroll Config (payrollConfig.service.ts):**

| Operation | Function | Notes |
|-----------|----------|-------|
| Get config | `getPayrollConfig()` | With defaults, auto-generates calendar |
| Update config | `updatePayrollConfig()` | Merge with optional calendar regeneration |
| Generate calendar | `generateCalendar()` | Monthly/weekly/biweekly periods |

#### 4.5.20 Payroll Permissions

| Capability | Roles | Actions |
|------------|-------|---------|
| `hr.payroll` | SUPER_ADMIN | VIEW |
| `hr.payroll` | ADMIN | VIEW, EDIT |

`[GAP]` No STAFF-level payslip self-service view
`[GAP]` No payroll approval workflow (run -> review -> approve -> post)

#### 4.5.21 Payroll Integration with Finance

**Journal Entry Posting:**
Two separate paths post journals:
1. `payrollRun.service.ts` via `postJournalEntry()` with hardcoded account codes:
   - `5000-PAYROLL-EXP` (expense)
   - `5001-EMPLOYER-COSTS` (expense)
   - `2100-NET-PAY-ACCRUAL` (liability)
   - `2105-PAYROLL-LIAB` (liability)

2. Event subscriber via `hr.payroll.run.committed` event with dynamic account creation

`[SHORTCUT]` Two different GL posting mechanisms for the same operation -- risk of double-posting.

**Period Close Guard:**
- Both implementations check that the GL period is open before posting
- Uses `assertPeriodOpen()` / `assertGlPeriodOpen()`

#### 4.5.22 Payroll Integration with Leave

Source: `payrollRun.service.ts`

When running payroll for a period:
1. Queries all leave requests that overlap the payroll period
2. Filters for approved/taken status
3. Calculates total taken days per employee
4. Stores leave snapshots in the payroll run record:
   ```
   leaveSnapshots: {
     [employeeId]: {
       periodKey: string,
       takenDays: number,
       requestIds: string[]
     }
   }
   ```

`[GAP]` Leave data is captured but not used to adjust pay (e.g., unpaid leave deduction, sick pay calculation)

---

#### 4.5.23 UK Payroll via Third-Party API Integration `[MUST-HAVE -- Added from completeness review M-23]`

**Requirement Source:** UK compliance / core operability -- current tax calculators are simplified demos (basic rate only, hardcoded 30,000 GBP salary). UK payroll tax calculation is extremely complex (multiple tax bands, Scottish/Welsh rates, tax code parsing, multiple NI categories, student loan plans, pension auto-enrolment). Must integrate with a specialist payroll API.

**Current State in Document:** Section 4.5.12-4.5.13 document simplified demo calculators. Section 4.5.14 confirms tax codes stored but not parsed, NI category stored but only Cat A implemented.

**Description:**
Integrate with Staffology or PayRun.io API for production-quality UK payroll calculations including PAYE, NI, pension, student loans, statutory pay, and RTI submission to HMRC.

**Business Rules:**
- All tax, NI, and pension calculations must be performed by the third-party API (not in-house calculators)
- The system sends employee details and gross pay to the API, receives calculated deductions
- The API handles: multi-band PAYE (basic 20%, higher 40%, additional 45%), Scottish tax bands, Welsh tax bands, tax code parsing (L, BR, D0, D1, NT, K codes, etc.), NI categories (A, B, C, H, J, M, Z), employer NI, student loan Plans 1-4 and postgraduate, pension auto-enrolment
- API credentials stored securely per tenant (each tenant may have their own Staffology/PayRun.io account)
- Payroll run workflow: draft -> calculate (API call) -> review -> approve -> post GL -> submit RTI
- Must handle: starters (P45/new employee), leavers (P45 generation), year-end (P60 generation)
- API response must be cached per payroll run (do not re-call API unnecessarily)
- Must support monthly, weekly, and fortnightly pay frequencies

**Expected Integration Points:**

| Integration | API Endpoint | Description |
|---|---|---|
| Employee sync | Create/update employer + employees in Staffology | Keep employee tax details in sync |
| Pay run calculation | POST pay run to Staffology | Calculate PAYE, NI, pension, student loan |
| RTI FPS submission | Submit FPS to HMRC via Staffology | Real-Time Information on each pay day |
| RTI EPS submission | Submit EPS to HMRC via Staffology | Employer Payment Summary (monthly) |
| P45 generation | Generate P45 via Staffology | For leavers |
| P60 generation | Generate P60 via Staffology | Year-end |
| Pension filing | Submit pension contributions via Staffology | To pension provider (NEST, etc.) |

**API Operations Expected:**
- `POST /api/hr/payroll/runs/[id]/calculate` -- Send pay run to third-party API for calculation
- `GET /api/hr/payroll/runs/[id]/rti-status` -- Check RTI submission status
- `POST /api/hr/payroll/runs/[id]/submit-rti` -- Submit FPS to HMRC via API
- `GET /api/hr/payroll/p45/[employeeId]` -- Generate P45 for leaver
- `GET /api/hr/payroll/p60/[employeeId]` -- Generate P60 for year-end

**Competitor Reference:** Sage Payroll is the UK market leader. Staffology provides a pure API for payroll calculation. PayRun.io offers similar API-first payroll. BrightPay is a desktop alternative with cloud sync.

---

#### 4.5.24 Pension Auto-Enrolment Compliance `[MUST-HAVE -- Added from completeness review M-3]`

**Requirement Source:** UK legal requirement -- employers must auto-enrol eligible workers into a qualifying workplace pension scheme. Failure to comply results in penalties from The Pensions Regulator.

**Description:**
Automatic assessment of employees for pension auto-enrolment eligibility, management of opt-in/opt-out, and submission of contributions to pension providers.

**Business Rules:**
- Assess every employee on each pay date for auto-enrolment eligibility
- Eligible jobholder criteria: aged 22 to State Pension age, earning above 10,000 GBP/year (2024/25 threshold), working in the UK
- Non-eligible jobholders (earn between lower and upper thresholds) have right to opt in
- Entitled workers (earn below lower threshold) have right to join
- Minimum contributions: 8% total (5% employee, 3% employer) on qualifying earnings
- Qualifying earnings band: 6,240 to 50,270 GBP (2024/25 thresholds)
- Opt-out period: 1 month from auto-enrolment date
- Re-enrolment: every 3 years for opted-out employees
- Postponement: up to 3 months allowed
- Must integrate with pension providers (NEST, People's Pension, Smart Pension, NOW:Pensions)
- Must track: assessment date, eligibility status, enrolment date, opt-out date, contribution rates

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| employeeId | String | Yes | FK to Employee |
| assessmentDate | Date | Yes | Date of eligibility assessment |
| eligibilityStatus | Enum | Yes | eligible, non_eligible, entitled |
| enrolmentDate | Date | No | Date auto-enrolled |
| optOutDate | Date | No | Date opted out |
| reEnrolmentDueDate | Date | No | 3 years from opt-out |
| pensionProvider | String | No | NEST, etc. |
| employeeContributionPct | Decimal | Yes | |
| employerContributionPct | Decimal | Yes | |
| status | Enum | Yes | enrolled, opted_out, postponed |

**Competitor Reference:** Sage Payroll, BrightPay, and Staffology all handle pension auto-enrolment compliance automatically.

---

#### 4.5.25 RTI (Real Time Information) Submission to HMRC `[MUST-HAVE -- Added from completeness review M-4]`

**Requirement Source:** UK legal requirement -- employers must submit RTI information to HMRC on or before each pay day. This includes Full Payment Submission (FPS) and Employer Payment Summary (EPS).

**Description:**
Submit payroll data to HMRC in real-time via the RTI system. This is handled via the third-party payroll API (Staffology/PayRun.io) but must be tracked and auditable in Nexa.

**Business Rules:**
- FPS (Full Payment Submission) must be submitted on or before each pay day containing: employee details, pay, tax, NI, student loan deductions
- EPS (Employer Payment Summary) must be submitted monthly if there are adjustments (recovery of statutory pay, apprenticeship levy, employment allowance)
- Late FPS submissions result in penalties from HMRC
- Must track submission status per payroll run: pending, submitted, accepted, rejected, error
- Must store HMRC correlation IDs for audit trail
- Year-end FPS must include "final submission for year" indicator
- Earlier Year Updates (EYU) for corrections to previous tax years

**Competitor Reference:** Sage Payroll, BrightPay, and Staffology all handle RTI submissions.

---

#### 4.5.26 Statutory Pay Calculations `[MUST-HAVE -- Added from completeness review M-5]`

**Requirement Source:** UK legal requirement -- employers must pay statutory pay to eligible employees. SSP, SMP, SPP, ShPP, and SAP are all legal obligations.

**Description:**
Calculate and process statutory payments via the third-party payroll API. Track eligibility, qualifying periods, and payment schedules.

**Business Rules:**
- **SSP (Statutory Sick Pay):** Payable after 3 consecutive qualifying days, up to 28 weeks. Rate set by HMRC annually (currently 116.75/week for 2024/25)
- **SMP (Statutory Maternity Pay):** 90% of average weekly earnings for first 6 weeks, then lower of statutory rate or 90% for remaining 33 weeks
- **SPP (Statutory Paternity Pay):** 1 or 2 consecutive weeks at statutory rate
- **ShPP (Shared Parental Pay):** Up to 37 weeks at statutory rate
- **SAP (Statutory Adoption Pay):** Same structure as SMP
- All calculations delegated to third-party API (Staffology/PayRun.io)
- Must track: absence type, start date, expected return date, qualifying weeks, payment amounts
- Must integrate with leave management system

**Competitor Reference:** Sage Payroll and BrightPay calculate all statutory pay types automatically.

---

#### 4.5.27 Student Loan Deductions `[MUST-HAVE -- Added from completeness review M-6]`

**Requirement Source:** UK legal requirement -- employers must deduct student loan repayments when notified by HMRC via SL1/SL2 notice.

**Description:**
Track and calculate student loan deductions for employees on Plan 1, Plan 2, Plan 4, and Postgraduate loans.

**Business Rules:**
- Plan 1 (pre-2012): 9% of earnings above threshold (currently 22,015/year)
- Plan 2 (post-2012): 9% of earnings above threshold (currently 27,295/year)
- Plan 4 (Scottish): 9% of earnings above threshold (currently 27,660/year)
- Postgraduate: 6% of earnings above threshold (currently 21,000/year)
- Multiple plans can apply simultaneously
- Deductions calculated on gross pay above threshold
- HMRC notifies employer via SL1/SL2 -- must be recorded on employee record
- All calculations delegated to third-party payroll API
- Must be included in RTI FPS submission

**Competitor Reference:** Sage Payroll and BrightPay handle all student loan plan types automatically.

---

#### 4.5.28 P45/P60 Generation `[MUST-HAVE -- Added from completeness review M-7]`

**Requirement Source:** UK legal requirement -- P45 must be issued to leavers and P60 to all employees at year-end.

**Description:**
Generate P45 documents when an employee leaves and P60 documents at the end of each tax year.

**Business Rules:**
- **P45:** Issued when employee leaves. Contains: tax code, total pay and tax in current year, date of leaving, employee details. Generated via third-party API.
- **P60:** Issued to all employees by 31 May after end of tax year. Contains: total pay, total tax, NI contributions for the year. Generated via third-party API.
- Both documents must be downloadable as PDF
- Must be available via employee self-service portal
- Must be stored securely with access controls (not in public directory)
- P45 generation triggers employee status change to "terminated"

**API Operations Expected:**
- `POST /api/hr/employees/[id]/p45` -- Generate P45 for leaver
- `GET /api/hr/employees/[id]/p45/pdf` -- Download P45 PDF
- `POST /api/hr/payroll/year-end/p60s` -- Generate P60s for all employees
- `GET /api/hr/employees/[id]/p60/[taxYear]/pdf` -- Download P60 PDF

**Competitor Reference:** Sage Payroll and BrightPay generate P45 and P60 documents automatically.

---

### 4.6 Recruitment

#### 4.6.1 Current State

`[MISSING]` No recruitment functionality is implemented in server code. The feature exists only as:

1. **AI Route Definition** (`nexa-schema.ts`):
   - Route: `/hr/recruitment`
   - Label: "Recruitment"
   - Description: "Recruitment pipeline"
   - Tags: ["recruitment"]

2. **AI Capability** (`nexa-capabilities.ts`):
   - `hr.recruitment`: SUPER_ADMIN (VIEW), ADMIN (VIEW, EDIT)

No Prisma models exist for:
- JobPosting
- Applicant
- Interview
- HiringPipeline
- Offer

No service files, no API routes, no business logic.

`[RECOMMEND]` For the new project, recruitment module should include:
- Job postings with approval workflow
- Applicant tracking with pipeline stages
- Interview scheduling
- Offer management
- Integration with employee onboarding

---

### 4.7 Training & Development

`[MISSING]` No training or development functionality exists anywhere in the codebase. No Prisma models, no service files, no routes.

`[RECOMMEND]` For the new project:
- Training courses and schedules
- Employee training records
- Certification tracking
- Competency matrix
- Training compliance reporting

---

### 4.8 Document Management

`[MISSING]` No employee document management exists. No models for:
- Employee contracts
- HR documents (offer letters, disciplinary records)
- Right-to-work documents
- Certificates/qualifications

`[RECOMMEND]` For the new project:
- Document upload with categorisation
- Expiry date tracking and alerts
- Version control
- Access controls based on document type

---

### 4.9 Staff Dashboard

Source: `apps/web/src/server/staff/dashboard-metrics.service.ts`

A minimal staff dashboard service that aggregates high-level metrics.

| Metric | Source | Notes |
|--------|--------|-------|
| myTasks | Hardcoded `0` | `[STUBBED]` ProjectTask has no tenantId/assignee |
| myProjects | `Project.count()` | Counts all tenant projects, not user-specific `[SHORTCUT]` |
| myRecentInvoices | `CustomerInvoice.count()` | Counts all tenant invoices, not user-specific `[SHORTCUT]` |
| billingStatus | `Tenant.billingStatus` | |

`[SHORTCUT]` "My" prefix is misleading -- metrics are tenant-wide, not user-specific.

---

### 4.10 Audit Trail

HR operations emit audit events to the central audit system:

| Event | Trigger | Data |
|-------|---------|------|
| `hr.payroll.run` | File-based payroll run | tenantId, actorId, period, payslips count, totalGross |
| `hr.payroll.run.committed` | Prisma payroll committed | runId, periodStart/End, employeeCount, totalGross, committedAt |
| `hr.payroll.run_reversed` | Payroll reversal | tenantId, actorId, target, reason, originalPeriod |
| `hr.payroll.adjustment_created` | Payroll adjustment | tenantId, actorId, target, baseRunId, employeeId, amount, reason |
| `hr.leave.cancelled` | Leave cancellation | tenantId, actorId, target, reason |
| `hr.leave.adjusted` | Leave adjustment | tenantId, actorId, target, patch fields |

`[MISSING]` No audit events for:
- Employee creation/update/status change
- Leave creation/submission/approval/rejection
- Department/team changes
- Payroll config changes

---

### 4.11 Summary of Gaps and Recommendations

#### Architecture Gaps

| ID | Category | Description | Flag |
|----|----------|-------------|------|
| A1 | Storage | Employee metadata split between Prisma (identity) and JSON (operational data) | `[SHORTCUT]` |
| A2 | Storage | Leave requests/balances stored in JSON blob, not normalised tables | `[SHORTCUT]` |
| A3 | Storage | Payroll runs have 3 parallel implementations (Prisma, JSON, file) | `[SHORTCUT]` |
| A4 | API | No HTTP API routes or tRPC routers for any HR functionality | `[MISSING]` |
| A5 | Frontend | No UI pages despite routes defined in AI schema | `[FRONTEND-GAP]` |
| A6 | Concurrency | In-memory leave request cache not safe for multi-instance | `[SHORTCUT]` |
| A7 | GL | Two different GL posting mechanisms for payroll | `[SHORTCUT]` |

#### Schema Gaps

| ID | Entity | Missing | Flag |
|----|--------|---------|------|
| S1 | Employee | status, departmentId, jobTitle, managerId, startDate, address, DOB, gender, employmentType, userId FK | `[SCHEMA-GAP]` |
| S2 | PayrollRun | payDate, processedBy, approvedBy, totals, currency, reversalRef | `[SCHEMA-GAP]` |
| S3 | Payslip | payDate, taxCode, niCategory, hoursWorked, paymentMethod, bankDetails | `[SCHEMA-GAP]` |
| S4 | Deduction | type enum, rate, threshold, statutory flag | `[SCHEMA-GAP]` |
| S5 | Department | description, managerId, parentDepartmentId, costCentreCode, active | `[SCHEMA-GAP]` |
| S6 | PaySchedule | payDayOfMonth, payDayOfWeek, active, taxYear | `[SCHEMA-GAP]` |
| S7 | -- | No LeaveRequest model in schema (JSON only) | `[SCHEMA-GAP]` |
| S8 | -- | No LeaveType/LeaveBalance models in schema | `[SCHEMA-GAP]` |
| S9 | -- | No Attendance/TimeTracking model | `[SCHEMA-GAP]` |
| S10 | -- | No Recruitment models (JobPosting, Applicant) | `[SCHEMA-GAP]` |
| S11 | -- | No EmployeeDepartment join table (Employee->Department FK missing) | `[SCHEMA-GAP]` |

#### Business Logic Gaps

| ID | Area | Description | Flag |
|----|------|-------------|------|
| B1 | Leave | No weekend/bank holiday exclusion in day calculation | `[GAP]` |
| B2 | Leave | No approval workflow with delegation/escalation | `[GAP]` |
| B3 | Leave | No notification on status changes | `[MISSING]` |
| B4 | Payroll | Tax calculators are simplified demo versions | `[SHORTCUT]` |
| B5 | Payroll | No tax code parsing (1257L stored but ignored) | `[SHORTCUT]` |
| B6 | Payroll | No multiple NI categories (only Cat A) | `[SHORTCUT]` |
| B7 | Payroll | No Scottish/Welsh tax rates | `[MISSING]` |
| B8 | Payroll | Unpaid leave not used to adjust pay | `[GAP]` |
| B9 | Payroll | BACS generation not integrated with pay runs | `[PARTIAL]` |
| B10 | Payroll | Payslip PDF has no access control | `[SHORTCUT]` |
| B11 | Employee | Encryption stores plaintext alongside encrypted | `[SHORTCUT]` |
| B12 | Permissions | AI capabilities defined but not enforced in services | `[GAP]` |
| B13 | Department | No CRUD services for departments/teams | `[MISSING]` |
| B14 | Staff | Dashboard metrics are tenant-wide, not user-specific | `[SHORTCUT]` |

#### Recommendations for New Project

| ID | Area | Recommendation | Flag |
|----|------|----------------|------|
| R1 | Payroll | Use Staffology/PayRun.io API for all tax calculations and RTI submissions | `[RECOMMEND]` |
| R2 | Schema | Normalise all employee data into proper Prisma columns with FKs | `[RECOMMEND]` |
| R3 | Schema | Create dedicated LeaveRequest, LeaveType, LeaveBalance tables | `[RECOMMEND]` |
| R4 | API | Create proper REST or tRPC API layer with auth middleware | `[RECOMMEND]` |
| R5 | Leave | Implement working-day calculation with bank holiday support | `[RECOMMEND]` |
| R6 | Leave | Add approval workflow with email notifications | `[RECOMMEND]` |
| R7 | Payroll | Single payroll pipeline: draft -> calculate (via API) -> review -> approve -> post GL | `[RECOMMEND]` |
| R8 | Employee | Proper employee lifecycle: onboarding -> active -> leave of absence -> offboarding -> terminated | `[RECOMMEND]` |
| R9 | Department | Hierarchical department structure with cost centre mapping | `[RECOMMEND]` |
| R10 | Self-Service | Employee self-service portal for payslips, leave requests, personal details | `[RECOMMEND]` |
| R11 | Recruitment | ATS integration or built-in recruitment pipeline | `[RECOMMEND]` |
| R12 | Documents | Employee document management with expiry tracking | `[RECOMMEND]` |
| R13 | Attendance | Time and attendance tracking with payroll integration | `[RECOMMEND]` |
| R14 | Reporting | HR analytics dashboard (headcount, turnover, absence rates) | `[RECOMMEND]` |

---

## Section 5: Reporting

This section documents all reporting, analytics, KPI, and dashboard functionality extracted from the Nexa ERP codebase. It covers financial reports, operational reports, KPI/metrics dashboards, AI-generated insights, and the underlying reporting infrastructure.

---

### 5.1 Financial Reports

Financial reports are generated from two parallel general ledger systems: (1) the legacy `JournalEntry`/`JournalLine`/`Account` model, and (2) the newer `GlJournalEntry`/`GlJournalLine`/`GlAccount` model with typed enums. Both systems are active. Report generation functions exist in `apps/web/src/server/finance/gl.ts` (legacy GL) and `apps/web/src/server/finance/gl/trialBalance.ts` (new GL). A unified report dispatcher exists in `apps/web/src/server/finance/reports.ts`.

#### 5.1.1 Profit & Loss (Income Statement)

- **Report Name:** Profit & Loss / Income Statement
- **Type:** Financial
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/gl.ts` -- function `getPnL()`
- **Data Sources:**
  - `JournalLine` (joined with `Account` and `JournalEntry`)
  - Derived from Trial Balance output
- **Parameters:**
  - `tenantId` (required) -- scopes data to tenant
  - `dateFrom` (optional) -- start date filter on `JournalEntry.postedAt`
  - `dateTo` (optional) -- end date filter on `JournalEntry.postedAt`
  - Accepts a pre-computed `TrialBalanceResult` to avoid redundant computation
- **Calculations:**
  - Filters trial balance rows by `type === "revenue"` or `type === "income"` for income lines
  - Filters trial balance rows by `type === "expense"` for expense lines
  - `totalIncome = SUM(credit - debit)` for income accounts
  - `totalExpense = SUM(debit - credit)` for expense accounts
  - `net = totalIncome - totalExpense`
- **Output Format:** JSON object: `{ asOf, totalIncome, totalExpense, net, income[], expense[] }`
- **Flags:**
  - `[SHORTCUT]` -- Uses the legacy `JournalLine`/`Account` model rather than the newer `GlJournalEntry`/`GlJournalLine`/`GlAccount` model
  - `[GAP]` -- No date range filtering exposed in the `getPnL()` function directly; relies on pre-filtered trial balance
  - `[GAP]` -- No comparative periods (e.g., current vs. prior period)
  - `[GAP]` -- No departmental or cost-center segmentation
  - `[RECOMMEND]` -- Add support for comparative periods, budget vs. actual, and department-level breakdown

#### 5.1.2 Balance Sheet

- **Report Name:** Balance Sheet / Statement of Financial Position
- **Type:** Financial
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/gl.ts` -- function `getBalanceSheet()`
- **Data Sources:**
  - `JournalLine` (joined with `Account` and `JournalEntry`)
  - Derived from Trial Balance
- **Parameters:**
  - `tenantId` (required)
  - Implicitly uses full date range (no date filtering on the `getBalanceSheet()` call itself; gets the cumulative trial balance)
- **Calculations:**
  - Filters trial balance rows by account type:
    - `type === "asset"` -- Assets
    - `type === "liability"` -- Liabilities
    - `type === "equity"` -- Equity
  - `totalAssets = SUM(balance)` where `balance = debit - credit` for asset rows
  - `totalLiabilities = SUM(credit - debit)` for liability rows
  - `totalEquity = SUM(credit - debit)` for equity rows
- **Output Format:** JSON object: `{ asOf, totals: { assets, liabilities, equity }, assets[], liabilities[], equity[] }`
- **Flags:**
  - `[SHORTCUT]` -- Uses the legacy GL model
  - `[GAP]` -- No "as of" date parameter; always returns cumulative balances
  - `[GAP]` -- No retained earnings / net income rollup into equity
  - `[GAP]` -- No comparative balance sheet
  - `[RECOMMEND]` -- Add as-of date filtering, retained earnings calculation, and comparative periods

#### 5.1.3 Trial Balance

There are two independent Trial Balance implementations:

**5.1.3.1 Legacy Trial Balance**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/gl.ts` -- function `getTrialBalance()`
- **Data Sources:** `JournalLine` joined with `Account` and `JournalEntry`
- **Parameters:**
  - `tenantId` (required)
  - `dateFrom` (optional) -- filters `JournalEntry.postedAt >= dateFrom`
  - `dateTo` (optional) -- filters `JournalEntry.postedAt <= dateTo`
- **Calculations:**
  - Groups all journal lines by account code
  - For each account: accumulates `debit` and `credit` totals
  - `balance = debit - credit`
  - Grand totals: `SUM(debit)` and `SUM(credit)` across all accounts
- **Output Format:** JSON: `{ from, to, asOf, rows: [{ code, name, type, debit, credit, balance }], totals: { debit, credit } }`
- **Validation:** Uses JavaScript `Number` type (floating point)

**5.1.3.2 New GL Trial Balance**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/gl/trialBalance.ts` -- function `getTrialBalance()`
- **Data Sources:** `GlJournalLine` joined with `GlAccount` and `GlJournalEntry`
- **Parameters:**
  - `tenantId` (required)
  - `from` (optional Date) -- filters on `GlJournalEntry.date >= from`
  - `to` (optional Date) -- filters on `GlJournalEntry.date <= to`
- **Calculations:**
  - Only includes lines from `GlJournalEntry` where `status === "POSTED"`
  - Groups by `accountId`
  - Uses `Prisma.Decimal` for precise arithmetic (no floating point errors)
  - `debitTotal`, `creditTotal`, `net = debit - credit` per account
  - Grand totals: sum of all `debitTotal` and `creditTotal`
- **Output Format:** JSON: `{ rows: BalanceRow[], totals: { debitTotal, creditTotal } }` where `BalanceRow = { accountId, code, name, type, debitTotal, creditTotal, net }` (all amounts as strings)
- **Flags:**
  - `[SHORTCUT]` -- Two parallel implementations exist (legacy and new GL); both are used by different consumers
  - `[RECOMMEND]` -- Consolidate into a single trial balance implementation using the new GL model

#### 5.1.4 Cash Flow Statement

- **Report Name:** Cash Flow Statement
- **Type:** Financial
- **Status:** `[MISSING]`
- **Flags:**
  - `[MISSING]` -- No dedicated cash flow statement report exists
  - `[GAP]` -- Cash flow data is partially available via `TreasuryMovement` model and `BankStatementLine` model but no report aggregates them
  - `[RECOMMEND]` -- Implement a cash flow report using the indirect method (derived from P&L and balance sheet changes) or direct method (from bank transactions and treasury movements)

#### 5.1.4A Cash Flow Statement `[MUST-HAVE -- Added from completeness review M-30]`

**Requirement Source:** Core operability -- one of the three core financial statements (alongside P&L and Balance Sheet). Every accounting competitor has this.

**Current State in Document:** Section 5.1.4 states `[MISSING] No dedicated cash flow statement report exists`.

**Description:**
Generate a cash flow statement showing cash inflows and outflows categorized by operating, investing, and financing activities.

**Business Rules:**
- Support both indirect method (derived from P&L adjustments and balance sheet changes) and direct method (from actual cash transactions)
- **Operating activities (indirect):** Net profit + depreciation + changes in working capital (AR, AP, inventory)
- **Operating activities (direct):** Cash received from customers, cash paid to suppliers, cash paid to employees, other operating cash flows
- **Investing activities:** Purchase of fixed assets, proceeds from asset disposal
- **Financing activities:** Loan proceeds, loan repayments, equity contributions, dividend payments
- Date range filtering (period start to period end)
- Comparative periods (this period vs same period last year)
- Net change in cash must reconcile with opening and closing bank balances

**API Operations Expected:**
- `GET /api/finance/reports/cash-flow` -- Generate cash flow statement (params: startDate, endDate, method=indirect|direct, comparative=true|false)

---

#### 5.1.5 VAT Reports

There are two VAT reporting implementations: a comprehensive VAT service and a simpler legacy VAT return system.

**5.1.5.1 VAT Return Summary (vat/service.ts)**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/vat/service.ts`
- **Data Sources:**
  - `CustomerInvoice` (AR invoices, filtered by date range and non-draft status)
  - `SupplierBill` (AP bills, filtered by date range and non-draft status)
  - `TenantConfig` (stores VAT return records as JSON)
- **Parameters:**
  - `tenantId` (required)
  - `from` / `to` date range for the VAT period
  - `periodKey` (e.g., "2024-Q1") for return identification
- **Calculations (9-Box VAT Return):**
  - `Box 1` = SUM of `taxTotal` from CustomerInvoice in period (Output VAT due on sales)
  - `Box 2` = 0 (VAT due on acquisitions from EU -- hardcoded to zero)
  - `Box 3` = Box 1 + Box 2 (Total VAT due)
  - `Box 4` = SUM of `taxTotal` from SupplierBill in period (Input VAT reclaimed)
  - `Box 5` = Box 3 - Box 4 (Net VAT to pay/reclaim)
  - `Box 6` = SUM of `subtotal` from CustomerInvoice (Total sales ex-VAT)
  - `Box 7` = SUM of `subtotal` from SupplierBill (Total purchases ex-VAT)
  - `Box 8` = 0 (Total supplies to EU -- hardcoded to zero)
  - `Box 9` = 0 (Total acquisitions from EU -- hardcoded to zero)
- **Operations:**
  - `computeVatSummary(tenantId, from, to)` -- computes the 9-box summary
  - `createVatReturnDraft(tenantId, periodKey, from, to)` -- creates a draft return
  - `listVatReturns(tenantId)` -- lists all returns
  - `getVatReturn(tenantId, periodKey)` -- gets a specific return
  - `submitVatReturn(tenantId, periodKey)` -- marks a return as submitted
- **Validation Rules:**
  - Date range: `from <= to`, both must be valid dates
  - Period key must be non-empty
  - Conflict check: cannot create a return for a period that already exists (409)
  - Cannot submit an already-submitted return (409)
- **Storage:** VAT return records stored in `TenantConfig.config.vat.returns` as JSON (not in a dedicated table)
- **Flags:**
  - `[SHORTCUT]` -- Returns stored in JSON blob in TenantConfig rather than a proper database table
  - `[GAP]` -- Box 2, 8, 9 hardcoded to zero (no EU/international VAT support)
  - `[GAP]` -- No Making Tax Digital (MTD) API integration for actual HMRC submission
  - `[PARTIAL]` -- `HmrcMtdSubmission` model exists in the schema but no code implements submission logic

**5.1.5.2 VAT Return Summary with Tax Code Breakdown (vat.ts)**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/vat.ts` -- function `vatReturnSummary()`
- **Data Sources:**
  - `TaxCode` (active tax codes for tenant)
  - `CustomerInvoice` with `CustomerInvoiceLine` (AR lines in date range)
  - `SupplierBill` with `SupplierBillLine` (AP lines in date range)
- **Parameters:**
  - `tenantId` (required)
  - `from` / `to` (Date range)
- **Calculations:**
  - Groups by tax code
  - For each tax code: sums `netSales`, `vat`, `netPurchases`, `vatPurchases` from invoice/bill lines
  - `vatDue = SUM(vat - vatPurchases)` across all codes
- **Output:** `{ rows: VatReturnRow[], vatDue: number }` where `VatReturnRow = { code, name, netSales, vat, netPurchases, vatPurchases }`
- **Flags:**
  - `[SHORTCUT]` -- Hardcodes all lines to `VAT_STD` tax code regardless of actual line-level tax code assignment
  - `[GAP]` -- Does not use the line-level `taxRate` field to determine the correct tax code

**5.1.5.3 VAT Rate Calculation (lib/finance/vat.ts)**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/lib/finance/vat.ts`
- **Purpose:** Calculates VAT amounts for invoices and bills
- **Data Sources:** `TaxCode` with `TaxRate` (effective date lookup)
- **Logic:**
  - Looks up `TaxCode` by code (default: `VAT_STD`) for the tenant
  - Finds the most recent `TaxRate` effective before the given date
  - Falls back to the deprecated `TaxCode.rate` field if no `TaxRate` entries exist
  - Falls back to hardcoded 20% UK VAT if tables are missing
- **Functions:**
  - `getVatRate(options)` -- returns the VAT rate as a decimal
  - `calculateVat(subtotal, options)` -- returns `{ subtotal, vat, total }`

**5.1.5.4 HMRC MTD Integration**

- **Status:** `[PARTIAL]`
- **Schema Model:** `HmrcMtdSubmission` -- fields: `id, tenantId, vatReturnId, submissionId, status, submittedAt, response, createdAt, updatedAt`
- **Schema Model:** `VatReturn` -- fields: `id, tenantId, vrn, periodKey, start, end, due, status, totalDue, submittedAt`
- **Flags:**
  - `[PARTIAL]` -- Schema models exist with relationships (`VatReturn` has many `HmrcMtdSubmission`)
  - `[MISSING]` -- No server-side code implements MTD API calls to HMRC
  - `[RECOMMEND]` -- Implement MTD VAT obligations API, 9-box submission, and fraud prevention headers

#### 5.1.6 Accounts Receivable Ageing Report

There are two implementations:

**5.1.6.1 Dedicated AR Ageing Service**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/ar/ageing.ts` -- function `getAgeing()`
- **Data Sources:**
  - `CustomerInvoice` (filtered by `status === "issued"` and tenant)
  - `CustomerAllocation` (to calculate paid amounts)
- **Parameters:**
  - `tenantId` (required)
  - `asOf` (Date) -- the reference date for ageing calculation
  - `customerId` (optional) -- filter by specific customer
- **Calculations:**
  - For each invoice: `outstanding = invoice.total - SUM(allocations.amount)`
  - Skip invoices where outstanding <= 0
  - Calculate days overdue: `(asOf - dueDate) / (1 day)`
  - Bucket assignment:
    - `current`: days <= 0
    - `1-30`: 0 < days <= 30
    - `31-60`: 30 < days <= 60
    - `61-90`: 60 < days <= 90
    - `91+`: days > 90
  - `total = SUM(all buckets)`
- **Output:** `{ buckets: { current, "1-30", "31-60", "61-90", "91+" }, total }` (all values as strings from Prisma.Decimal)

**5.1.6.2 Report Payload AR Ageing**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/reports.ts` -- within `generateReportPayload(type: "ar_aging")`
- **Data Sources:** `CustomerInvoice` (all invoices for tenant)
- **Calculations:**
  - Excludes invoices with status containing "paid"
  - Uses `dueAt || issuedAt || createdAt` as the reference date
  - Buckets: `0-30`, `31-60`, `61-90`, `90+`
  - Uses `Number(total)` for amounts (floating point)
- **Flags:**
  - `[SHORTCUT]` -- Does not account for partial payments (uses full `total` not outstanding balance)
  - `[SHORTCUT]` -- Different bucket naming convention from the dedicated ageing service ("0-30" vs "current"/"1-30")

#### 5.1.7 Accounts Payable Ageing Report

There are two implementations:

**5.1.7.1 Dedicated AP Ageing Service**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/ap/ageing.ts` -- function `getAgeing()`
- **Data Sources:**
  - `SupplierBill` (filtered by `status === BILL_STATUS.issued`)
  - `SupplierAllocation` (to calculate paid amounts)
- **Parameters:**
  - `tenantId` (required)
  - `asOf` (Date) -- reference date for ageing
  - `supplierId` (optional) -- filter by specific supplier
- **Calculations:**
  - For each bill: `outstanding = bill.total - SUM(allocations.amount)`
  - Skip bills where outstanding <= 0
  - Uses `dueDate || billDate || createdAt` as reference date
  - Same 5-bucket structure as AR ageing: `current, 1-30, 31-60, 61-90, 91+`
- **Output:** `{ buckets: { current, "1-30", "31-60", "61-90", "91+" }, total }`

**5.1.7.2 Report Payload AP Ageing**

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/reports.ts` -- within `generateReportPayload(type: "ap_aging")`
- **Calculations:** Same simplified approach as the AR aging report payload (no allocation deduction, floating point)
- **Flags:**
  - `[SHORTCUT]` -- Same shortcut issues as AR aging report payload (no partial payment deduction)

#### 5.1.8 Invoice Insights Summary

- **Report Name:** AR Invoice Insights Summary
- **Type:** Financial (KPI-style)
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/ar/invoiceInsights.service.ts` -- function `getInvoiceInsightSummary()`
- **Data Sources:** `CustomerInvoice` (top 50 most recent by `issuedAt`)
- **Parameters:** `tenantId` (required)
- **Calculations:**
  - `openCount` = count of invoices retrieved (capped at 50)
  - `totalMinor` = SUM of `total` across all invoices
  - Overdue = invoices where `dueAt < now` and status not "paid" or "void"
  - `overdueMinor` = SUM of `balance ?? total` for overdue invoices
  - `overdueCount` = count of overdue invoices
- **Output:** `{ totalMinor, overdueMinor, overdueCount, openCount, currency }`
- **Flags:**
  - `[SHORTCUT]` -- Limited to 50 most recent invoices; not a true full-portfolio summary
  - `[RECOMMEND]` -- Remove the `take: 50` limit or use aggregate queries for accurate totals

#### 5.1.9 Fixed Asset Register and Depreciation Reports

- **Report Name:** Fixed Asset Register
- **Type:** Financial
- **Status:** `[COMPLETE]`
- **Implementation Files:**
  - `/apps/web/src/server/finance/assets.ts` -- function `assetRegister()`
  - `/apps/web/src/server/finance/assets/index.ts` -- function `listAssets()`, `getAsset()`, `computeSchedule()`
- **Data Sources:**
  - `FixedAsset` (all assets for tenant)
  - `DepreciationSchedule` (posted depreciation records)
- **Parameters:** `tenantId` (required), `assetId` (for individual asset detail), `asOf` (optional Date for schedule cutoff)
- **Calculations:**
  - For each asset:
    - `accumDep = SUM(DepreciationSchedule.amount)` where `posted === true`
    - `nbv = MAX(0, cost - accumDep)` (Net Book Value)
    - `status = disposedAt ? "disposed" : "active"`
  - Depreciation schedule computation (straight-line method):
    - `monthlyAmount = (cost - salvage) / usefulLifeMonths`
    - Last period gets the remainder to avoid rounding drift
    - Schedule runs from acquisition month for `usefulLifeMonths` periods
- **Output:** Array of `{ assetCode, name, cost, accumDep, nbv, status }` for register; `{ asset, schedule: DepreciationPeriod[] }` for individual asset
- **Related Operations:**
  - `runDepreciation(tenantId, asOf)` -- Posts depreciation journal entries for all un-posted periods up to `asOf`
  - `disposeAsset(tenantId, assetId, disposalDate, proceeds)` -- Posts disposal journal and updates asset record
  - `createDepreciationDraft(tenantId, input)` -- Creates a draft depreciation journal for review before posting
  - `depreciationHistory(tenantId, from?, to?)` -- Returns posted depreciation entries with asset details
- **Flags:**
  - `[GAP]` -- Only straight-line depreciation method is supported; no declining balance or units-of-production
  - `[RECOMMEND]` -- Add additional depreciation methods

#### 5.1.10 FX Revaluation Report

- **Report Name:** Foreign Exchange Revaluation
- **Type:** Financial
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/fxRevaluation.ts` -- function `revalueOpenBalances()`
- **Data Sources:**
  - `CustomerInvoice` (AR exposures with `balance > 0` and `currency !== "GBP"`)
  - `SupplierBill` (AP exposures with `balance > 0` and `currency !== "GBP"`)
  - `JournalEntry` (to check for existing revaluation journals)
- **Parameters:**
  - `tenantId` (required)
  - `asOf` (Date) -- revaluation date
  - `rates` (FxRateMap: `Record<string, number>`) -- current exchange rates by currency code
- **Calculations:**
  - For each open AR/AP item in foreign currency:
    - `origBase = balance / originalFxRate` (converted to base currency at original rate)
    - `newBase = balance / currentRate` (converted at new rate)
    - `diff = newBase - origBase`
    - If diff > 0: AR gain (debit AR, credit FX_GAIN) or AP loss (debit FX_LOSS, credit AP)
    - If diff < 0: AR loss (debit FX_LOSS, credit AR) or AP gain (debit AP, credit FX_GAIN)
  - Idempotent: checks for existing revaluation journal by `docRef` pattern before creating
- **Output:** `{ ok: true, journals: string[] }` -- list of created journal docRefs
- **Flags:**
  - `[SHORTCUT]` -- Hardcoded to GBP as base currency
  - `[GAP]` -- No unrealised vs realised gain/loss distinction

#### 5.1.11 Unified Report Dispatcher

- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/finance/reports.ts` -- function `generateReportPayload()`
- **Supported Report Types:**
  - `"trial_balance"` -- delegates to `getTrialBalance(tenantId)` from legacy GL
  - `"pnl"` -- delegates to `getPnL(tenantId)` from legacy GL
  - `"balance_sheet"` -- delegates to `getBalanceSheet(tenantId)` from legacy GL
  - `"ar_aging"` -- inline AR aging calculation
  - `"ap_aging"` -- inline AP aging calculation
- **Error Handling:** Throws error with `code: 400` for unknown report types
- **Flags:**
  - `[SHORTCUT]` -- No date range parameters are passed through for TB/P&L/BS
  - `[GAP]` -- No support for additional report types (cash flow, VAT, asset register)
  - `[RECOMMEND]` -- Extend the dispatcher to support all available report types with parameter passthrough

---

### 5.2 Operational Reports

#### 5.2.1 Manufacturing Reports

**5.2.1.1 WIP (Work-in-Progress) Rollforward**

- **Report Name:** WIP Rollforward
- **Type:** Operational / Manufacturing
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/manufacturing/reports.service.ts` -- function `getWipRollforward()`
- **Data Sources:**
  - `JournalLine` (filtered by account code `"WIP"`)
  - `Account` (for code matching)
  - `JournalEntry` (for date range and docRef)
- **Parameters:**
  - `tenantId` (required)
  - `rangeInput: { from?, to? }` -- date range for the period
- **Calculations:**
  - `opening` = rollup of all WIP journal lines before `from` date
  - `movement` = rollup of all WIP journal lines within the date range
  - `closing = opening.net + movement.net`
  - Groups movements by `docRef` (work order reference) to show per-work-order breakdown
  - Each group: `{ docRef, debit, credit, net }`
- **Output:** `{ range, opening: { debit, credit, net }, movement, closing, lines[], byWorkOrder[] }`

**5.2.1.2 Manufacturing Variance Report**

- **Report Name:** Manufacturing Variance Report
- **Type:** Operational / Manufacturing
- **Status:** `[COMPLETE]`
- **Implementation File:** `/apps/web/src/server/manufacturing/reports.service.ts` -- function `getManufacturingVarianceReport()`
- **Data Sources:**
  - `JournalLine` (filtered by account code `"WIP_VAR"`)
  - Same structure as WIP Rollforward
- **Parameters:** Same as WIP Rollforward
- **Calculations:** Same rollforward logic applied to the `WIP_VAR` account code
- **Output:** Same structure as WIP Rollforward
- **Flags:**
  - `[GAP]` -- Does not use the `VarianceReport` model from the schema (which tracks material, labour, overhead variances separately)
  - `[RECOMMEND]` -- Integrate with the `VarianceReport` model for type-specific variance analysis

**5.2.1.3 Variance Report Model (Schema)**

- **Status:** `[PARTIAL]`
- **Schema Model:** `VarianceReport`
  - Fields: `id, tenantId, workOrderId, type (material|labour|overhead), standardCost, actualCost, variance, variancePercent, reason, posted, postedAt, createdAt, createdBy`
  - Relations: belongs to `WorkOrder`
  - Indexes: `[tenantId, workOrderId]`, `[tenantId, posted]`, `[tenantId, createdAt]`
- **Flags:**
  - `[PARTIAL]` -- Model exists in schema but the manufacturing variance report service does not query it
  - `[RECOMMEND]` -- Build a variance analysis report that uses this model for detailed standard vs. actual cost comparison

#### 5.2.2 Inventory Reports

No dedicated inventory report services exist. Inventory data is available through:

- **KPI Service** (`/apps/web/src/lib/kpi/service.ts`):
  - `inventory_skus_active` -- count of active SKUs
  - `inventory_value_on_hand` -- count of items with qty > 0 (note: not a true monetary value)
  - `inventory_movements_30d` -- count of stock movements in last 30 days
- **Data Warehouse Facts** (via `FactInventoryMovement`):
  - Tracks individual stock movements with qty, unitCost, totalCost, and type
  - Linked to DimProduct, DimLocation, DimDate dimensions
- **Flags:**
  - `[MISSING]` -- No stock valuation report (FIFO, WAC, or standard cost)
  - `[MISSING]` -- No stock turnover / days-of-supply report
  - `[MISSING]` -- No reorder point / below-minimum-stock report
  - `[RECOMMEND]` -- Build inventory valuation report using `InventoryLot` data (FIFO) and stock movement summary reports

#### 5.2.3 Sales / CRM Reports

No dedicated sales or CRM report services exist. Data is available through:

- **KPI Service:**
  - `crm_open_opportunities` -- count of open CRM opportunities
  - `crm_pipeline_value` -- SUM of open opportunity values
  - `crm_quotes_30d` -- count of quotes issued in last 30 days
- **Data Warehouse Facts:**
  - `FactOrder` -- order-level facts (total, currency, status) linked to DimCustomer and DimDate
  - `FactInvoice` -- invoice-level facts linked to DimCustomer and DimDate
- **Flags:**
  - `[MISSING]` -- No pipeline stage conversion report
  - `[MISSING]` -- No sales by customer/product/region report
  - `[MISSING]` -- No quote-to-order conversion rate report
  - `[RECOMMEND]` -- Build sales analytics reports using the data warehouse fact tables

#### 5.2.4 HR / Payroll Reports

No dedicated HR report services exist. Data is available through:

- **KPI Service:**
  - `hr_headcount` -- count of active employees
  - `hr_payroll_runs_30d` -- count of payroll runs in last 30 days
- **Flags:**
  - `[MISSING]` -- No headcount report by department
  - `[MISSING]` -- No payroll cost summary report
  - `[MISSING]` -- No leave balance / absence report
  - `[RECOMMEND]` -- Build HR reports using Employee, PayrollRun, and Payslip models

#### 5.2.5 POS Reports

No dedicated POS report services exist. Data is available through:

- **KPI Service:**
  - `pos_sales_30d` -- total POS sales in last 30 days
  - `pos_transactions_30d` -- count of POS transactions in last 30 days
  - `pos_stores_active` -- count of active stores
- **Data Warehouse Facts:**
  - `FactReceipt` -- POS receipt facts (total, discount, tax, net, paymentMethod) linked to DimChannel and DimCustomer
- **Flags:**
  - `[MISSING]` -- No daily sales summary report
  - `[MISSING]` -- No product mix / category sales report
  - `[MISSING]` -- No cash register reconciliation report
  - `[RECOMMEND]` -- Build POS analytics reports using FactReceipt and DimChannel

#### 5.2.6 Projects Reports

No dedicated project report services exist. Data is available through:

- **KPI Service:**
  - `projects_open_projects` -- count of projects not in "completed" status
  - `projects_billable_hours_30d` -- SUM of timesheet hours in last 30 days
  - `projects_tasks_pending` -- count of pending project tasks
- **Data Warehouse Facts:**
  - `FactProjectWip` -- WIP ledger facts (amount, currency, type, billed) linked to DimProject
- **Flags:**
  - `[MISSING]` -- No project profitability report (revenue vs. cost per project)
  - `[MISSING]` -- No resource utilization report
  - `[MISSING]` -- No WIP aging report
  - `[RECOMMEND]` -- Build project analytics using FactProjectWip and WipLedger

---

### 5.3 KPI / Metrics Dashboard

#### 5.3.1 KPI Type System

- **Implementation File:** `/apps/web/src/lib/kpi/types.ts`
- **KPI Modules:** `finance`, `inventory`, `manufacturing`, `crm`, `projects`, `hr`, `pos`, `ai`, `system`
- **KPI Formats:** `currency`, `number`, `percentage`, `duration`, `count`
- **KPI Definition Type:**
  ```
  { id, label, description?, module: KpiModule, format: KpiFormat, period?: string }
  ```
- **KPI Value Type:**
  ```
  { id, value: number | null, currencyCode?, locale?, periodLabel?, computedAt: string, warning?: string }
  ```

#### 5.3.2 KPI Definitions

- **Implementation File:** `/apps/web/src/lib/kpi/definitions.ts`
- **Status:** `[COMPLETE]`
- **Total KPIs Defined:** 21

| KPI ID | Label | Module | Format | Period |
|--------|-------|--------|--------|--------|
| `finance_ar_outstanding` | Outstanding AR | finance | currency | last_30_days |
| `finance_ap_outstanding` | Outstanding AP | finance | currency | last_30_days |
| `finance_cash_collected_30d` | Cash Collected (30d) | finance | currency | last_30_days |
| `finance_invoices_30d` | Invoices (30d) | finance | count | last_30_days |
| `inventory_skus_active` | Active SKUs | inventory | count | -- |
| `inventory_value_on_hand` | Inventory Value | inventory | currency | -- |
| `inventory_movements_30d` | Stock Movements (30d) | inventory | count | last_30_days |
| `pos_sales_30d` | POS Sales (30d) | pos | currency | last_30_days |
| `pos_transactions_30d` | POS Transactions (30d) | pos | count | last_30_days |
| `pos_stores_active` | Active Stores | pos | count | -- |
| `crm_open_opportunities` | Open Opportunities | crm | count | -- |
| `crm_pipeline_value` | Pipeline Value | crm | currency | -- |
| `crm_quotes_30d` | Quotes (30d) | crm | count | last_30_days |
| `projects_open_projects` | Open Projects | projects | count | -- |
| `projects_billable_hours_30d` | Billable Hours (30d) | projects | number | last_30_days |
| `projects_tasks_pending` | Pending Tasks | projects | count | -- |
| `hr_headcount` | Headcount | hr | count | -- |
| `hr_payroll_runs_30d` | Payroll Runs (30d) | hr | count | last_30_days |
| `manufacturing_work_orders_active` | Active Work Orders | manufacturing | count | -- |
| `manufacturing_boms` | BOMs | manufacturing | count | -- |
| `ai_queries_7d` | AI Queries (7d) | ai | count | last_7_days |
| `ai_errors_7d` | AI Errors (7d) | ai | count | last_7_days |

- **Helper Functions:**
  - `getKpiDefinitionsByModule(module)` -- filter definitions by module
  - `getKpiDefinition(id)` -- find a single definition
  - `getKpiIdsByModule(module)` -- get IDs for a module

#### 5.3.3 KPI Service (Real-time Computation)

- **Implementation File:** `/apps/web/src/lib/kpi/service.ts`
- **Status:** `[COMPLETE]`
- **Function:** `getKpiValuesForTenant(tenantId, kpiIds)` -- computes KPI values on-demand
- **Tenant Locale:** Loads tenant locale settings (currencyCode, timezone, locale) for formatting; defaults to `{ GBP, Europe/London, en-GB }`
- **Computation Details by KPI:**

| KPI ID | Data Source | Query Logic |
|--------|-----------|-------------|
| `finance_ar_outstanding` | `CustomerInvoice.aggregate` | WHERE status IN (sent, overdue) AND issuedAt >= 30d ago; SUM(total) |
| `finance_ap_outstanding` | `SupplierBill.aggregate` | WHERE status IN (received, overdue) AND billDate >= 30d ago; SUM(total) |
| `finance_cash_collected_30d` | `CustomerPayment.aggregate` | WHERE paidAt >= 30d ago; SUM(amount) |
| `finance_invoices_30d` | `CustomerInvoice.count` | WHERE issuedAt >= 30d ago |
| `inventory_skus_active` | `InventoryItem.count` | WHERE tenantId (all items) |
| `inventory_value_on_hand` | `InventoryItem.findMany` | Count items where qtyOnHand > 0 (take: 1000 limit) |
| `inventory_movements_30d` | `StockMove.count` | WHERE movedAt >= 30d ago |
| `pos_sales_30d` | `PosSale.aggregate` | WHERE createdAt >= 30d ago; SUM(total) |
| `pos_transactions_30d` | `PosSale.count` | WHERE createdAt >= 30d ago |
| `pos_stores_active` | `Store.count` | WHERE tenantId |
| `crm_open_opportunities` | `CrmOpportunity.count` | WHERE status = "open" |
| `crm_pipeline_value` | `CrmOpportunity.aggregate` | WHERE status = "open"; SUM(value) |
| `crm_quotes_30d` | `SalesQuote.count` | WHERE createdAt >= 30d ago |
| `projects_open_projects` | `Project.count` | WHERE status != "completed" |
| `projects_billable_hours_30d` | `Timesheet.aggregate` | Via projects for tenant; SUM(hours) WHERE date >= 30d ago |
| `projects_tasks_pending` | `ProjectTask.count` | Via projects for tenant; WHERE status = "pending" |
| `hr_headcount` | `Employee.count` | WHERE tenantId |
| `hr_payroll_runs_30d` | `PayrollRun.count` | WHERE createdAt >= 30d ago |
| `manufacturing_work_orders_active` | `WorkOrder.count` | WHERE status NOT IN (completed, cancelled) |
| `manufacturing_boms` | `BomItem.count` | WHERE tenantId |
| `ai_queries_7d` | `AIEngineLog.count` | WHERE createdAt >= 7d ago (graceful fallback if model missing) |
| `ai_errors_7d` | `AIEngineLog.count` | WHERE createdAt >= 7d ago (same table, no error filter) |

- **Flags:**
  - `[SHORTCUT]` -- `inventory_value_on_hand` counts items instead of computing monetary value (comment acknowledges this)
  - `[SHORTCUT]` -- `ai_errors_7d` counts all AI logs, not just errors (no error filter applied)
  - `[SHORTCUT]` -- `inventory_skus_active` counts all items, not just "active" ones (no status filter)
  - `[SHORTCUT]` -- Performance: sequential KPI computation (one query per KPI in a loop)
  - `[RECOMMEND]` -- Implement true inventory valuation, parallelize KPI queries, add error filtering for AI errors

#### 5.3.4 KPI Dashboard API Route

- **Status:** `[STUBBED]`
- **Implementation File:** `/apps/web/src/pages/api/kpi/dashboard.ts`
- **Endpoint:** `GET /api/kpi/dashboard`
- **Response:** Hardcoded mock data -- returns static values:
  ```
  kpis: [
    { key: "revenue_total", value: 254000, currency: "GBP", trend: 6.2 },
    { key: "ar_balance", value: 48000, currency: "GBP", trend: -1.1 },
    { key: "ap_balance", value: 36500, currency: "GBP", trend: 0.9 },
    { key: "orders_today", value: 27, trend: 3.4 },
    { key: "inventory_onhand", value: 15234, trend: 0.5 }
  ]
  ```
- **Flags:**
  - `[STUBBED]` -- Returns entirely hardcoded/mock data; does not call the KPI service
  - `[RECOMMEND]` -- Connect to the `getKpiValuesForTenant()` service for real data

#### 5.3.5 KPI Snapshot Model (Historical Storage)

- **Schema Model:** `KpiSnapshot`
  - Fields: `id, tenantId, name, value (Decimal), asOf (DateTime), createdAt, updatedAt`
  - Index: `[tenantId, name, asOf]`
- **Status:** `[PARTIAL]`
- **Flags:**
  - `[PARTIAL]` -- Model exists but no code writes to it or reads from it for historical KPI trending
  - `[RECOMMEND]` -- Implement scheduled KPI snapshot capture and historical trending charts

#### 5.3.6 Dashboard Revalidation

- **Implementation File:** `/apps/web/src/lib/dashboard/revalidation.ts`
- **Status:** `[COMPLETE]`
- **Functions:**
  - `revalidateDashboardsForTenant(tenantId)` -- Revalidates `/admin/dashboard` and `/staff/dashboard` paths using Next.js `revalidatePath`
  - `revalidateSuperAdminDashboards()` -- Revalidates `/super-admin/dashboard` and `/super-admin/billing` paths
- **Notes:** Uses safe wrapper around `revalidatePath` that catches errors; designed for tenant-scoped and super-admin dashboard cache invalidation

#### 5.3.7 Dashboard Setup Indicator Component

- **Implementation File:** `/apps/web/src/components/dashboard/SetupIndicator.tsx`
- **Status:** `[COMPLETE]`
- **Purpose:** Client-side component that checks tenant setup status and shows a warning banner if setup is incomplete
- **Data Source:** Fetches `GET /api/tenant/setup/status` to check `setupComplete` flag
- **UI:** Yellow warning banner with a "Complete Setup" link to `/setup`

---

### 5.4 AI-Generated Reports / Insights

#### 5.4.1 AI Context Providers

The AI system gathers contextual data from each module to power conversational insights. Each context provider fetches a small sample of recent data.

- **Implementation Directory:** `/apps/web/src/server/ai/context/`
- **Status:** `[COMPLETE]`

| Context Provider | File | Data Fetched |
|-----------------|------|-------------|
| Finance | `financeContext.ts` | Last 5 customer invoices (number, status, total, currency); Last 5 supplier bills |
| Inventory | `inventoryContext.ts` | Last 5 inventory items (sku, qtyOnHand) |
| CRM | `crmContext.ts` | Last 5 CRM accounts (name, type); Last 5 opportunities (name, stage, value, currency) |
| Manufacturing | `manufacturingContext.ts` | Last 5 work orders (number, status, itemCode, quantity) |
| HR | `hrContext.ts` | Last 5 employees (firstName, lastName, email) |
| POS | `posContext.ts` | Last 5 POS sales (saleNumber, status, total, currency); Last 3 refunds |
| Projects | `projectsContext.ts` | Last 5 projects (name, status, budget); Last 5 timesheets (optional) |
| Healthcare | `healthcareContext.ts` | Last 3 PCN records (name, region); Last 5 rota records (title, status) -- optional model |

- **Flags:**
  - `[SHORTCUT]` -- Each provider fetches only 5 records; not suitable for comprehensive reporting
  - `[GAP]` -- No aggregation or summary statistics in context; just raw recent records

#### 5.4.2 Tenant Metrics Service (AI)

- **Implementation File:** `/apps/web/src/server/ai/tenant-metrics.service.ts`
- **Status:** `[COMPLETE]`
- **Purpose:** Provides simple count metrics for AI "how many X do I have?" queries
- **Functions:**
  - `getCustomerCountForTenant(tenantId)` -- `Customer.count()`
  - `getInvoiceCountForTenant(tenantId)` -- `CustomerInvoice.count()`
  - `getItemCountForTenant(tenantId)` -- `InventoryItem.count()`
- **Error Handling:** Returns 0 on failure with console error logging

#### 5.4.3 Tenant Analytics Service (AI Forecasting)

- **Implementation File:** `/apps/web/src/server/ai/tenant-analytics.service.ts`
- **Status:** `[COMPLETE]`
- **Purpose:** Provides deterministic (non-LLM) revenue and cash receipt analytics with forecasting

**5.4.3.1 Monthly Revenue History**

- **Function:** `getTenantRevenueHistoryMonthly(tenantId, { monthsBack })`
- **Data Source:** Raw SQL query on `CustomerInvoice` using `DATE_TRUNC('month', "issuedAt")`
- **Parameters:** `monthsBack` (1-24, default 12)
- **Filters:** Excludes statuses: "draft", "cancelled", "void"
- **Output:** `{ history: MonthlyPoint[], pointsUsed }` where `MonthlyPoint = { periodStart, amount }`

**5.4.3.2 Daily Cash Receipts History**

- **Function:** `getTenantCashReceiptsHistory(tenantId, { daysBack })`
- **Data Source:** Raw SQL query on `CustomerPayment` using `DATE("paidAt")`
- **Parameters:** `daysBack` (1-365, default 60)
- **Output:** `{ history: DailyPoint[], pointsUsed }` where `DailyPoint = { date, amount }`

**5.4.3.3 Cash by Risk Bucket**

- **Function:** `getTenantCashByRiskBucketHistory(tenantId, { daysBack })`
- **Status:** `[PARTIAL]`
- **Note:** No risk classification exists in the schema; returns a single "UNCLASSIFIED" bucket using cash receipts data
- **Flags:**
  - `[PARTIAL]` -- Returns single unclassified bucket; needs risk classification model

**5.4.3.4 Monthly Series Forecast**

- **Function:** `forecastMonthlySeries(history, { horizonMonths })`
- **Parameters:** `horizonMonths` (1-24, default 6)
- **Methods:**
  - **Linear trend** (>= 4 data points): Least-squares linear regression; projected values clamped to >= 0
  - **Moving average** (3 data points): Average of last 3 months; projected forward
  - **Insufficient** (< 3 data points): Returns empty forecast with `sufficientHistory: false`
- **Output:** `{ forecast: MonthlyPoint[], method, sufficientHistory }`

**5.4.3.5 Daily Series Forecast**

- **Function:** `forecastDailySeries(history, { horizonDays })`
- **Parameters:** `horizonDays` (1-30, default 7)
- **Methods:** Same as monthly (linear trend or moving average)
- **Output:** `{ forecast: DailyPoint[], method, sufficientHistory }`

#### 5.4.4 AI Orchestrator Analytics Intents

- **Implementation File:** `/apps/web/src/lib/ai/orchestrator.ts`
- **Status:** `[COMPLETE]`
- **Purpose:** Routes deterministic analytics queries through the AI orchestrator without using the LLM

**Supported Analytics Intents:**

| Intent | Role | Description |
|--------|------|------------|
| `superadmin.forecast_6m_revenue_overview` | SUPER_ADMIN | Cross-tenant revenue forecasting (returns informational message that cross-tenant forecasting is not available) |
| `admin.forecast_6m_revenue` | ADMIN | 6-month revenue forecast using linear trend / moving average |
| `admin.forecast_12m_performance` | ADMIN | 12-month revenue forecast |
| `admin.cash_forecast_7d_by_risk` | ADMIN | 7-day cash forecast by risk bucket |
| `finance.ar.invoice_insight` | ADMIN | AR invoice insights summary |
| `superadmin.platform_summary` | SUPER_ADMIN | Platform-wide tenant/user/billing summary |
| `superadmin.user_ai_performance` | SUPER_ADMIN | Top users by AI usage |
| `superadmin.customer_ai_usage` | SUPER_ADMIN | Customers with highest AI usage |
| `superadmin.ai_usage_summary` | SUPER_ADMIN | AI usage summary |

- **Flags:**
  - `[GAP]` -- Cross-tenant forecasting not available (by design, tenant-scoped data)
  - `[RECOMMEND]` -- Add more deterministic analytics intents (e.g., AP aging summary, inventory value, project profitability)

#### 5.4.5 AI Agent Tool Registry

- **Implementation File:** `/apps/web/src/server/ai/agent.ts`
- **Status:** `[PARTIAL]`
- **Registered Tools (read-only):**
  - `finance.journals.summary` -- Get summary of journal entries
  - `inventory.on_hand_by_item` -- Get inventory on-hand quantities by item
  - `supply.stockout_and_suggestions` -- Get stock-out risks and replenishment suggestions
- **Flags:**
  - `[PARTIAL]` -- Tool handlers return `{ ok: true, data: input }` (passthrough); actual implementation delegated to intent resolution
  - `[GAP]` -- No report-specific tools (e.g., generate trial balance, P&L)
  - `[RECOMMEND]` -- Add report generation tools to the AI agent registry

#### 5.4.6 Chat Access Permissions

- **Implementation File:** `/apps/web/src/server/chat/access.ts`
- **Permission for Finance Reports:** `CHAT_READ_PERMISSION = "ui:finance_reports:view"`
- **Used by:** Intent resolution to gate access to financial reporting intents

---

### 5.5 Report Infrastructure

#### 5.5.1 Report Scheduling

- **Implementation File:** `/apps/web/src/lib/reports/schedule.ts`
- **Status:** `[COMPLETE]`
- **Purpose:** Manage scheduled report delivery via email or Slack

**Schedule Type:**
```
{
  id: string,
  tenantId: string,
  report: "trial_balance" | "pnl" | "balance_sheet" | "ar_aging" | "ap_aging",
  channel: "email" | "slack",
  target: string, // email address or webhook URL
  cadence: string, // cron-like string
  createdAt: string
}
```

**Operations:**

| Function | Description |
|----------|------------|
| `listSchedules(tenantId)` | List all schedules for a tenant |
| `createSchedule(tenantId, input)` | Create a new schedule |
| `deleteSchedule(tenantId, id)` | Delete a schedule by ID |

**Storage:**
- **Primary:** Redis (key: `schedules:{tenantId}`, TTL: 30 days)
- **Fallback:** JSON file at `apps/web/.data/report-schedules.json`
- Storage checks Redis availability first; falls back to file storage if Redis is unavailable

**Flags:**
- `[SHORTCUT]` -- Stored in Redis with 30-day TTL or a JSON file; not persisted in the database
- `[MISSING]` -- No cron runner / scheduler to actually execute the schedules and deliver reports
- `[MISSING]` -- No report rendering to PDF/CSV for delivery
- `[GAP]` -- Schedule definitions exist but nothing triggers them
- `[RECOMMEND]` -- Implement a cron-based scheduler, report rendering pipeline, and email/Slack delivery

#### 5.5.2 Export Formats

- **Status:** `[PARTIAL]`
- **Current Capabilities:**
  - **JSON:** All report functions return JSON payloads (default format)
  - **CSV (Import/Export):** CSV import/export exists for master data (`/apps/web/src/server/import-export/masterData.ts`) supporting Customers, Suppliers, and Inventory Items
  - **PDF:** Payslip PDF generation exists (`/apps/web/src/server/payroll/payslip-pdf.ts`) but no report PDF generation
- **Flags:**
  - `[MISSING]` -- No PDF export for financial reports (P&L, Balance Sheet, Trial Balance, VAT Return)
  - `[MISSING]` -- No CSV export for financial reports
  - `[MISSING]` -- No Excel/XLSX export
  - `[RECOMMEND]` -- Add PDF and CSV export capabilities to the report dispatcher

#### 5.5.2A Report Export (PDF, CSV, Excel) `[MUST-HAVE -- Added from completeness review M-17]`

**Requirement Source:** Core operability -- no report can be exported in any format. Users cannot share, print, or work with report data outside the application. Every competitor has this.

**Current State in Document:** Section 5.5.2 lists `[MISSING] No PDF export for financial reports`, `[MISSING] No CSV export`, `[MISSING] No Excel/XLSX export`.

**Description:**
Add export capabilities for all financial and operational reports in PDF, CSV, and Excel formats.

**Business Rules:**
- PDF export: formatted report with headers, company logo, date range, page numbers
- CSV export: raw data with headers, suitable for import into spreadsheets
- Excel export: formatted workbook with multiple sheets (summary + detail), proper column types (numbers as numbers, dates as dates)
- Export must respect the same permissions as report viewing
- Large exports (>10,000 rows) should be processed asynchronously with download link sent via notification
- Export audit trail: log who exported what and when (GDPR compliance)
- Date formatting must respect tenant locale (DD/MM/YYYY for UK)
- Currency formatting must respect tenant base currency
- Reports that must support export: Trial Balance, P&L, Balance Sheet, Cash Flow Statement, VAT Return, AR Aging, AP Aging, Asset Register, Inventory Valuation, Payroll Summary

**API Operations Expected:**
- `GET /api/reports/[reportType]/export?format=pdf` -- Export report as PDF
- `GET /api/reports/[reportType]/export?format=csv` -- Export report as CSV
- `GET /api/reports/[reportType]/export?format=xlsx` -- Export report as Excel
- All report export endpoints accept the same query parameters as their JSON counterparts (date range, filters, etc.)

**Competitor Reference:** Xero, QuickBooks, Sage, Odoo, and ERPNext all support PDF and CSV export for all reports. Most also support Excel.

---

#### 5.5.3 Period Close (Reporting Period Controls)

- **Implementation Files:**
  - `/apps/web/src/server/finance/periodClose.ts` -- Full period close with per-ledger granularity
  - `/apps/web/src/server/finance/close/index.ts` -- Simplified close state using TenantConfig JSON

**5.5.3.1 Full Period Close System**

- **Status:** `[COMPLETE]`
- **Schema Model:** `PeriodClose`
  - Fields: `id, tenantId, periodKey (YYYY-MM), periodStart, periodEnd, status (OPEN|CLOSED), glClosed, arClosed, apClosed, bankClosed, assetsClosed, vatClosed, closedBy, closedByUserId, closedAt, notes`
  - Unique: `[tenantId, periodKey]`
- **Ledger Scopes:** `gl, ar, ap, bank, assets, vat`
- **Functions:**
  - `assertPeriodOpen(tenantId, postedAt, ledger?)` -- Throws `period_closed` (409) if posting date falls within a closed period; optionally checks specific ledger flag
  - `listPeriods(tenantId)` -- Lists all periods ordered by start date descending
  - `closePeriod(input)` -- Creates/updates period close record; sets all or selected ledger flags
  - `openPeriod(input)` -- Reopens a closed period (sets all flags to false)
  - `inferPeriodKey(date)` -- Derives period key (YYYY-MM) from a date

**5.5.3.2 Simplified Close State**

- **Status:** `[COMPLETE]`
- **Implementation:** Stores `lockedThrough` date in `TenantConfig.config.finance.close`
- **Functions:**
  - `getCloseState(tenantId)` -- Returns `{ lockedThrough, notes, updatedAt, updatedBy, runId }`
  - `setCloseState(tenantId, input)` -- Sets the lock-through date
  - `clearCloseState(tenantId)` -- Removes the lock
  - `assertPeriodNotClosed(tenantId, date)` -- Throws 409 if date is before `lockedThrough`
- **Flags:**
  - `[SHORTCUT]` -- Two parallel period close mechanisms exist (database model and JSON config); both are actively used by different parts of the system
  - `[RECOMMEND]` -- Consolidate into a single period close mechanism

---

### 5.6 Data Warehouse / Star Schema (Metrics Store)

The system implements a star-schema data warehouse for analytical reporting.

#### 5.6.1 Dimension Tables

- **Implementation File:** `/apps/web/src/server/metrics/store.ts`
- **Schema Models:**

| Dimension | Key Fields | Unique Index |
|-----------|-----------|-------------|
| `DimDate` | date, year, quarter, month, week, day, dayOfWeek, isWeekend, isHoliday, fiscalYear, fiscalQuarter | `date` |
| `DimTenant` | tenantId, name, region, industry | `tenantId` |
| `DimCustomer` | tenantId, customerId, code, name, type, industry, region | `[tenantId, customerId]` |
| `DimProduct` | tenantId, sku, name, category, brand, unitOfMeasure | `[tenantId, sku]` |
| `DimLocation` | tenantId, warehouseId, locationId, warehouseCode, locationCode, warehouseName, locationName, type | `[tenantId, warehouseId, locationId]` |
| `DimProject` | tenantId, projectId, code, name, customerId, status | `[tenantId, projectId]` |
| `DimChannel` | tenantId, channelId, code, name, type (pos/online/marketplace) | `[tenantId, channelId]` |

- **Dimension Ensure Functions** (idempotent -- create if not exists):
  - `ensureDimDate(date)` -- creates date dimension with calendar attributes
  - `ensureDimTenant(tenantId)` -- loads tenant name from `Tenant` table
  - `ensureDimCustomer(tenantId, customerId)` -- loads from `Customer` table
  - `ensureDimProduct(tenantId, sku)` -- loads from `InventoryItem` table
  - `ensureDimLocation(tenantId, warehouseId, locationId?)` -- loads from `Warehouse`/`Location` tables
  - `ensureDimProject(tenantId, projectId)` -- loads from `Project` table
  - `ensureDimChannel(tenantId, channelId)` -- creates default with type "pos"

#### 5.6.2 Fact Tables

| Fact Table | Key Metrics | Dimensions | Source |
|-----------|------------|-----------|--------|
| `FactInvoice` | total, tax, discount, net, currency, status | DimDate, DimTenant, DimCustomer | CustomerInvoice |
| `FactOrder` | total, currency, status | DimDate, DimTenant, DimCustomer | SalesOrder |
| `FactReceipt` | total, discount, tax, net, currency, paymentMethod | DimDate, DimTenant, DimCustomer?, DimChannel | PosSale |
| `FactProjectWip` | amount, currency, type, billed | DimDate, DimTenant, DimProject, DimCustomer? | WipLedger |
| `FactInventoryMovement` | qty, unitCost, totalCost, type | DimDate, DimTenant, DimProduct, DimLocation | StockMove |
| `FactWorkOrder` | qty, status, materialCost, labourCost, overheadCost, totalCost | DimDate, DimTenant, DimProduct | WorkOrder |

- **Upsert Functions** (idempotent -- skip if exists):
  - `upsertFactInvoice(...)` -- 10 parameters
  - `upsertFactOrder(...)` -- 8 parameters
  - `upsertFactReceipt(...)` -- 11 parameters
  - `upsertFactProjectWip(...)` -- 9 parameters
  - `upsertFactInventoryMovement(...)` -- 10 parameters
  - `upsertFactWorkOrder(...)` -- 10 parameters

#### 5.6.3 Event-Driven Fact Population

- **Implementation File:** `/apps/web/src/server/events/subscribers/index.ts`
- **Status:** `[PARTIAL]`
- **Mechanism:** Event bus subscribers listen for domain events and populate fact tables

**Event-to-Fact Mapping:**

| Event | Fact Table Populated | Notes |
|-------|---------------------|-------|
| `sales.invoice.created` | FactInvoice | Creates invoice fact with discount=0 |
| `projects.invoice.created` | FactInvoice | Same as sales invoice |
| `pos.sale.completed` | FactReceipt | Creates receipt fact; payment method hardcoded to "card" |
| `inventory.transfer.created` | FactInventoryMovement | Creates movement fact; unitCost defaults to 0 |
| `manufacturing.workorder.completed` | FactWorkOrder | Creates WO fact; all costs default to 0 |
| `wms.grn.received` | FactInventoryMovement | Matches StockMove by time window (+/- 5 seconds) |
| `wms.putaway.completed` | FactInventoryMovement | Matches StockMove by sourceType/sourceId |
| `wms.pick.completed` | FactInventoryMovement | Matches StockMove by sourceType/sourceId |
| `wms.cyclecount.variance` | FactInventoryMovement | Matches StockMove by sourceType/sourceId |
| `manufacturing.workorder.material.issued` | FactInventoryMovement | Matches StockMove by sourceType/sourceId |

- **Flags:**
  - `[SHORTCUT]` -- Several fact table entries have defaulted/hardcoded values (costs = 0, payment method = "card")
  - `[SHORTCUT]` -- GRN stock move matching uses a time-window search (+/- 5 seconds) which could miss or match incorrectly
  - `[GAP]` -- Many events have placeholder handlers that only `console.log` (e.g., `finance.invoice.paid`, `finance.payment.applied`, `purchasing.po.approved`, `pos.cashup.previewed`, `tax.vat.return.drafted`)
  - `[MISSING]` -- No reporting layer reads from the fact tables; they are populated but no analytics dashboards or reports query them [CONTRADICTION-RESOLVED: XR-3 -- The data warehouse is write-only. Sections 5 and 6 describe fact table population in detail, but no section describes consumption. The PRD should specify which fact tables the reporting module must consume.]
  - `[RECOMMEND]` -- Build analytics queries and dashboards that consume the star schema fact tables

#### 5.6.4 Point Metrics Models

- **Schema Models:**
  - `MetricPoint` -- Time-series metric storage: `{ tenantId, name, timestamp, value, dimensions (JSON) }`. Index: `[tenantId, name, timestamp]`
  - `MetricsSnapshot` -- Module-level analytics snapshots: `{ tenantId, module, snapshotAt, data (JSON) }`. Index: `[tenantId, module, snapshotAt]`
- **Status:** `[PARTIAL]`
- **Flags:**
  - `[PARTIAL]` -- Schema models exist; event metrics (`recordEventMetric`) writes to Redis-based metrics via `incMetric()` function, not to these database models
  - `[MISSING]` -- No code reads from `MetricPoint` or `MetricsSnapshot` for reporting
  - `[RECOMMEND]` -- Implement metric collection and visualization using these models

#### 5.6.5 Event Metrics

- **Implementation File:** `/apps/web/src/server/events/metrics.ts`
- **Status:** `[COMPLETE]`
- **Function:** `recordEventMetric(event, outcome)` -- Records event metrics to:
  - Redis-based metrics via `incMetric("event", { type, outcome, tenantId })`
  - Console logging (non-PII)
  - Sentry (for failures only)
- **Outcomes:** `published`, `failed`, `replayed`

---

### 5.7 Summary of Gaps and Recommendations

#### Critical Gaps

| ID | Area | Gap | Priority |
|----|------|-----|----------|
| G5.1 | Financial Reports | No Cash Flow Statement | HIGH |
| G5.2 | Financial Reports | No comparative period support on P&L or Balance Sheet | HIGH |
| G5.3 | Report Infrastructure | Report schedules exist but no execution engine | HIGH |
| G5.4 | Report Infrastructure | No PDF/CSV/Excel export for any financial report | HIGH |
| G5.5 | Data Warehouse | Fact tables populated but no reporting layer reads them | HIGH |
| G5.6 | KPI Dashboard | `/api/kpi/dashboard` returns hardcoded mock data | MEDIUM |

#### Technical Debt (Shortcuts)

| ID | Area | Issue |
|----|------|-------|
| S5.1 | GL System | Two parallel GL systems (legacy and new) with separate trial balance implementations |
| S5.2 | Period Close | Two parallel period close mechanisms (PeriodClose model and TenantConfig JSON) |
| S5.3 | VAT Returns | VAT returns stored in TenantConfig JSON blob, not a proper table |
| S5.4 | AR Aging | Report payload version does not deduct partial payments |
| S5.5 | KPI Service | Sequential query execution (one per KPI); inventory value returns count not value |
| S5.6 | Report Schedule | Stored in Redis (30d TTL) or JSON file, not database |
| S5.7 | Fact Population | Many event subscribers only console.log; costs defaulted to 0 |
| S5.8 | AI Errors KPI | `ai_errors_7d` counts all logs, not just errors |

#### Recommendations for New Project

| ID | Recommendation | Impact |
|----|---------------|--------|
| R5.1 | Consolidate to a single GL model (new GL with enums) and single trial balance implementation | Eliminates S5.1 |
| R5.2 | Implement a dedicated Cash Flow Statement report (indirect method from P&L + balance sheet delta) | Fills G5.1 |
| R5.3 | Add comparative period support (current vs. prior period) to P&L and Balance Sheet | Fills G5.2 |
| R5.4 | Build a report execution engine with cron scheduling, PDF/CSV rendering, and email/Slack delivery | Fills G5.3, G5.4 |
| R5.5 | Build analytics dashboards reading from the star-schema fact tables | Fills G5.5 |
| R5.6 | Connect KPI dashboard API to the real KPI service | Fills G5.6 |
| R5.7 | Move VAT returns and report schedules to proper database tables | Eliminates S5.3, S5.6 |
| R5.8 | Implement true inventory valuation reports (FIFO/WAC) using InventoryLot data | Fills inventory report gaps |
| R5.9 | Add department/cost-center segmentation to financial reports | Enhanced reporting |
| R5.10 | Implement MTD VAT submission to HMRC | Fills HMRC gap |
| R5.11 | Add operational reports: stock valuation, sales by customer, project profitability, HR headcount by dept | Fills operational gaps |

---

## Section 6: Cross-Module Interactions

This section maps how the modules in Nexa ERP interact with each other through data flows, events, shared services, and business process chains. Each interaction pattern is annotated with implementation status flags.

---

### 6.1 Event System Architecture

The event system is the primary mechanism for cross-module communication. It operates via a typed, in-process event bus with a DB-backed transactional outbox for durability.

#### 6.1.1 Event Bus Core `[COMPLETE]`

- **Location**: `apps/web/src/server/events/bus.ts`
- **Pattern**: In-process, synchronous handler dispatch with typed event registry
- **Handler registration**: `registerHandler<T>(type, handler)` registers handlers keyed by event type
- **Dispatch**: `publishEvent(event)` iterates through all registered handlers for the event type, executing sequentially
- **Error handling**: Handler errors are caught, logged to console, and reported to Sentry; they are never propagated upstream to the publisher. This means a failing subscriber cannot block the source operation.
- **Metrics**: Every handler execution records `events_handled_total` counter and `events_handler_duration_ms` duration via the observability layer
- **Testing**: `clearHandlers()` utility provided for test isolation

#### 6.1.2 Event Publisher with Outbox `[COMPLETE]`

- **Location**: `apps/web/src/server/events/publisher.ts`
- **Function**: `publishWithOutbox(event)` is the primary publish entry point used by business modules
- **Sequence**:
  1. Propagate `correlationId` and `causationId` from the current request context (observability)
  2. Record `events_published_total` metric
  3. Write event to `OutboxEvent` table (DB-backed, durable persistence) -- best-effort; failure logged but not thrown
  4. Execute in-process handlers via `publishEvent(event)` (immediate processing)
- **Correlation**: Events carry `correlationId` and `causationId` for distributed tracing across module boundaries

#### 6.1.3 Transactional Outbox `[COMPLETE]`

- **Location**: `apps/web/src/server/events/outboxRepository.ts`
- **Prisma model**: `OutboxEvent` with fields: `tenantId`, `type`, `payload` (JSON), `status` (pending/published/failed), `attempts`, `maxAttempts` (default 3), `nextAttemptAt`, `publishedAt`, `error`
- **Enqueue**: `enqueueOutboxEvent(event)` writes to DB with status "pending"
- **Fetch pending**: `fetchPendingOutboxBatch(limit, options)` retrieves events where `status = pending` and `nextAttemptAt <= now()`
- **Mark processed**: `markOutboxEventProcessed(id, status, errorMessage)` updates status and implements exponential backoff on failure (delays doubling up to 1 hour max)
- **Dead letter**: Events that exceed `maxAttempts` are marked as "failed" permanently
- **Replay**: `replayOutboxEvents(ids)` re-publishes specific events by ID (supports manual recovery)
- **Indexes**: `[tenantId, status, nextAttemptAt]` and `[tenantId, type]` for efficient polling

#### 6.1.4 Consumer Runner `[COMPLETE]`

- **Location**: `apps/web/src/server/events/consumerRunner.ts`
- **Function**: `processOutboxBatch(options)` and `runOutboxConsumersOnce(limit)` poll the outbox and re-dispatch pending events
- **Design**: All handlers are required to be idempotent since events may be replayed
- **Batch processing**: Processes events sequentially, marking each as success or failure individually
- **Remaining count**: After processing a batch, checks for remaining pending events

#### 6.1.5 Redis Pub/Sub Layer `[PARTIAL]`

- **Location**: `apps/web/src/lib/events/publish.ts`
- **Separate system**: A parallel, simpler event publish mechanism exists alongside the main event bus
- **Function**: `publishEvent(e)` (different from the bus `publishEvent`) publishes to Redis channel `nexa:events:{tenantId}` and triggers Next.js cache revalidation via `revalidateForEvent`
- **Event types**: Limited to 8 types: `finance.invoice.approved`, `finance.invoice.paid`, `inventory.grn.posted`, `inventory.stock.adjusted`, `manufacturing.wo.started`, `manufacturing.wo.completed`, `sales.lead.updated`, `projects.task.updated`
- **Fallback**: If Redis is unavailable, the publish silently fails; server tag revalidation still runs
- **`[GAP]`**: This older event system coexists with the newer typed event bus but uses different type definitions (`DomainEvent` vs `NexaEvent`). The two systems are not unified. [CONTRADICTION-RESOLVED: CR-10 -- The modern `server/events` system (NexaEvent with 50+ types, DB-backed OutboxEvent) is canonical. The legacy `lib/events` system (DomainEvent with 8 types, in-memory/Redis) must be deprecated. Events emitted by one system are invisible to the other.]

#### 6.1.6 Redis Queue (Job Queue) `[PARTIAL]`

- **Location**: `apps/web/src/lib/queue/index.ts`
- **Redis-backed FIFO queue** for background jobs using keys `jobs:queue` and `jobs:dead`
- **Operations**: `enqueueJob(type, data, backoffSec)`, `popJob()`, `deadLetter(job)`, `queueInfo()`
- **Job payload**: `{ id, type, data, tries, backoffSec, createdAt }`
- **`[GAP]`**: No worker/consumer loop is implemented; jobs can be enqueued and popped but there is no automatic processing. This is infrastructure-ready but not wired to any business process.

#### 6.1.7 Redis Outbox (Simple) `[PARTIAL]`

- **Location**: `apps/web/src/lib/outbox/index.ts`
- **Simpler outbox**: Pushes events to Redis list `outbox` with `lpush`, trims to 5000 entries
- **`[SHORTCUT]`**: This is a simpler, earlier version of the outbox pattern. The DB-backed `OutboxEvent` model in the server events layer supersedes this. [CONTRADICTION-RESOLVED: CR-11 -- The DB-backed `OutboxEvent` (Section 6.1.3) is the canonical outbox. This Redis-based outbox must be deprecated.]

---

### 6.2 Defined Event Types and Payloads

All event types are strongly typed in `apps/web/src/server/events/types.ts`. The following table lists every defined event type, its source module, payload structure, and registered subscribers.

#### 6.2.1 Finance Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `finance.invoice.created` | `invoiceId`, `number`, `customerCode`, `totalMinor`, `currencyCode`, `issuedAt` | Chat notification handler (high-value invoice alert to #finance channel if total >= 10000 pence and status is "posted") |
| `finance.invoice.paid` | `invoiceId`, `number`, `amountPaidMinor`, `currencyCode`, `paidAt` | Analytics snapshot scheduling (stub -- logs only) |
| `finance.payment.applied` | `paymentId`, `invoiceId`, `billId`, `amountMinor`, `currencyCode`, `appliedAt` | KPI cache update (stub -- logs only) |

#### 6.2.2 Inventory / WMS Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `inventory.transfer.created` | `transferId`, `fromWarehouseCode`, `toWarehouseCode`, `sku`, `quantity`, `createdAt` | Records `FactInventoryMovement` in metrics store (resolves warehouse codes to IDs) |
| `inventory.stock.adjusted` | `adjustmentId`, `sku`, `warehouseCode`, `quantityDelta`, `reason`, `adjustedAt` | Chat notification handler (stock shortfall alert if qty < reorder point) |
| `wms.grn.received` | `sku`, `qty`, `unitCost`, `warehouseId`, `locationId`, `receivedAt` | Records `FactInventoryMovement` via StockMove lookup |
| `wms.putaway.completed` | `putawayTaskId`, `sku`, `qty`, `fromLocationId`, `toLocationId`, `completedAt` | Records `FactInventoryMovement` via StockMove lookup |
| `wms.pick.completed` | `pickTaskId`, `sku`, `qty`, `fromLocationId`, `orderId`, `orderType`, `completedAt` | Records `FactInventoryMovement` via StockMove lookup |
| `wms.shipment.confirmed` | `shipmentId`, `shipmentNumber`, `orderId`, `orderType`, `warehouseId`, `shippedAt` | Handler slot registered (empty) |
| `wms.cyclecount.variance` | `cycleCountLineId`, `sku`, `locationId`, `expectedQty`, `countedQty`, `varianceQty`, `approvedAt` | Records `FactInventoryMovement` via StockMove lookup |

#### 6.2.3 Manufacturing Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `manufacturing.workorder.released` | `workOrderId`, `number`, `itemCode`, `quantity`, `releasedAt` | Handler slot registered (empty) |
| `manufacturing.workorder.completed` | `workOrderId`, `number`, `itemCode`, `quantity`, `completedAt` | Records `FactWorkOrder` in metrics store (material/labour/overhead costs stubbed as 0) |
| `manufacturing.workorder.material.issued` | `workOrderId`, `materialIssueId`, `sku`, `qty`, `unitCost`, `issuedAt` | Records `FactInventoryMovement` via StockMove lookup |
| `manufacturing.variance.posted` | `varianceReportId`, `workOrderId`, `materialVariance`, `labourVariance`, `overheadVariance`, `postedAt` | Handler slot registered (empty) |

#### 6.2.4 Purchasing Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `purchasing.po.approved` | `poId`, `number`, `supplierCode`, `totalMinor`, `currencyCode`, `approvedAt` | Stub: logs only, mentions MRP recalculation as future work |

- **`[GAP]`**: No event emitted for PO creation (only approval). The `createPurchaseOrder` service does not publish events -- it only creates an audit log entry.

#### 6.2.5 HR/Payroll Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `hr.payroll.run.committed` | `runId`, `periodStart`, `periodEnd`, `employeeCount`, `totalGrossPayMinor`, `committedAt` | **Full GL posting**: Creates `JournalEntry` with 3 lines: Debit Payroll Expense (gross), Credit Payroll Payable (net), Credit PAYE Liability (tax). Auto-creates GL accounts if missing. |

- **Cross-module impact**: This is the most complete event-driven cross-module integration. When a payroll run is committed, it automatically creates GL journal entries in the Finance module, bridging HR and Finance.

#### 6.2.6 POS Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `pos.cashup.previewed` | `cashupId`, `storeCode`, `shiftId`, `totalCashMinor`, `totalCardMinor` | Stub: logs only |
| `pos.cashup.submitted` | `cashupId`, `storeCode`, `shiftId`, `totalCashMinor`, `totalCardMinor` | Handler slot registered (empty) |
| `pos.session.opened` | `sessionId`, `storeId`, `shiftId`, `openedBy`, `openingFloat` | Stub: logs only, mentions FactPosSession |
| `pos.session.closed` | `sessionId`, `storeId`, `shiftId`, `closedBy`, `closingFloat`, `openedAt`, `closedAt` | Stub: logs only |
| `pos.sale.completed` | `saleId`, `saleNumber`, `storeId`, `sessionId`, `customerId`, `subtotal`, `tax`, `total`, `currency` | Records `FactReceipt` in metrics store |
| `pos.refund.created` | `refundId`, `saleId`, `storeId`, `amount`, `reason` | Stub: logs only, mentions inventory restore and finance reversal as future work |

- **`[GAP]`**: POS refund does not reverse inventory or finance entries. Only logged with a comment indicating future implementation.

#### 6.2.7 CRM/Sales Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `crm.lead.converted` | `leadId`, `opportunityId`, `accountId`, `contactId`, `convertedAt` | Handler slot registered (empty) |
| `crm.opportunity.created` | `opportunityId`, `accountId`, `contactId`, `stage`, `value`, `currency` | Stub: logs only |
| `crm.opportunity.updated` | `opportunityId`, `stage`, `value`, `status` | Handler slot registered (empty) |
| `crm.opportunity.closed` | `opportunityId`, `status` (won/lost), `finalValue` | Stub: logs only |
| `sales.quote.created` | `quoteId`, `opportunityId`, `customerId`, `number`, `total`, `currency` | Stub: logs only |
| `sales.quote.sent` | `quoteId`, `sentAt` | Handler slot registered (empty) |
| `sales.quote.accepted` | `quoteId`, `acceptedAt` | Stub: logs only (mentions quote acceptance rate metrics) |
| `sales.quote.rejected` | `quoteId`, `rejectedAt` | Handler slot registered (empty) |
| `sales.order.created` | `orderId`, `quoteId`, `customerId`, `number`, `total`, `currency` | Stub: logs only (mentions inventory reservation as future work) |
| `sales.order.fulfilled` | `orderId`, `fulfilledAt` | Stub: logs only (mentions inventory stock movement as future work) |
| `sales.invoice.created` | `invoiceId`, `orderId`, `customerId`, `number`, `total`, `tax`, `currency`, `issuedAt` | Records `FactInvoice` in metrics store |

- **`[GAP]`**: No automatic inventory reservation on sales order creation. No automatic stock deduction on order fulfilment. These are mentioned in subscriber comments as future work.

#### 6.2.8 Projects/PSA Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `projects.timesheet.posted` | `timesheetId`, `projectId`, `phaseId`, `employeeId`, `hours`, `postedAt` | Stub: logs only (mentions FactProjectWip as future work) |
| `projects.expense.approved` | `expenseId`, `projectId`, `phaseId`, `amount`, `approvedAt` | Handler slot registered (empty) |
| `projects.wip.posted` | `wipLedgerId`, `projectId`, `phaseId`, `type`, `amount`, `postedAt` | Handler slot registered (empty) |
| `projects.invoice.created` | `invoiceId`, `projectId`, `customerId`, `number`, `total`, `tax`, `currency`, `issuedAt` | Records `FactInvoice` in metrics store |

#### 6.2.9 Tax Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `tax.vat.return.drafted` | `returnId`, `vrn`, `periodKey`, `periodStart`, `periodEnd`, `totalDueMinor` | Stub: logs only |

#### 6.2.10 Infrastructure Events `[PARTIAL]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `analytics.snapshot.generated` | `snapshotId`, `snapshotType`, `asOf`, `generatedAt` | Handler slot registered (empty) |
| `ai.task.completed` | `taskId`, `taskType`, `result` | Handler slot registered (empty) |
| `healthcare.claim.previewed` | `claimId`, `practiceId`, `claimType`, `totalAmountMinor` | Handler slot registered (empty) |
| `attachments.attachment.created` | `attachmentId`, `entityType`, `entityId`, `filename`, `sizeBytes` | Stub: logs only (mentions attachment metrics) |
| `imports.job.completed` | `jobId`, `importType`, `rowsProcessed`, `rowsSucceeded`, `rowsFailed` | Stub: logs only (mentions analytics snapshot trigger) |

#### 6.2.11 Workflow Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `workflow.state.changed` | `entityType`, `entityId`, `fromState`, `toState`, `action`, `actorId` | Handler slot registered (empty) |
| `workflow.transition.denied` | `entityType`, `entityId`, `currentState`, `attemptedAction`, `reason`, `actorId` | Handler slot registered (empty) |
| `customfields.definition.changed` | `entityType`, `fieldId`, `action` (created/updated/deleted) | Handler slot registered (empty) |
| `customfields.values.changed` | `entityType`, `entityId`, `fieldIds` | Handler slot registered (empty) |
| `planning.plan.generated` | `horizonMonths`, `bucketSize`, `recommendationsCount`, `constrainedItemsCount` | Handler slot registered (empty) |

#### 6.2.12 User Management Events `[COMPLETE]`

| Event Type | Payload | Subscribers |
|---|---|---|
| `user.created` | `userId`, `email`, `role` | Handler slot registered (empty) |
| `user.roles.changed` | `userId`, `oldRole`, `newRole` | Handler slot registered (empty) |
| `user.deactivated` | `userId` | Handler slot registered (empty) |
| `user.reactivated` | `userId` | Handler slot registered (empty) |
| `user.passwordreset.triggered` | `userId` | Handler slot registered (empty) |
| `superadmin.supportview.opened` | `targetTenantId`, `targetUserId`, `superAdminUserId` | Handler slot registered (empty) |

---

### 6.3 Business Process Chains

#### 6.3.1 Sales Cycle: Lead to Cash `[PARTIAL]`

The full intended sales cycle as defined by the event types:

```
CRM Lead --> (convert) --> CRM Opportunity --> (close-won) --> Sales Quote
  --> (accept) --> Sales Order --> (fulfil) --> Sales Invoice --> (pay) --> Finance Payment --> GL Posting
```

**Implementation status of each transition**:

1. **Lead to Opportunity** (`crm.lead.converted`): Event type defined with full payload. `[PARTIAL]` -- event type exists but no subscriber wires conversion logic.
2. **Opportunity to Quote** (`sales.quote.created` with `opportunityId`): Event type defined, quote payload links to opportunity. `[PARTIAL]` -- event defined, subscriber is stub-only.
3. **Quote Acceptance** (`sales.quote.accepted`): Event defined. `[PARTIAL]` -- subscriber logs only.
4. **Quote to Order** (`sales.order.created` with `quoteId`): Event type defined with `quoteId` in payload. `[PARTIAL]` -- subscriber mentions inventory reservation as future work.
5. **Order Fulfilment** (`sales.order.fulfilled`): Event defined. `[PARTIAL]` -- subscriber mentions stock movements as future work. No automatic inventory deduction.
6. **Order to Invoice** (`sales.invoice.created` with `orderId`): Event defined with `orderId` reference. `[COMPLETE]` -- subscriber records `FactInvoice` in metrics store.
7. **Invoice Payment** (`finance.invoice.paid`): Event defined. `[PARTIAL]` -- subscriber logs only. No automatic GL posting from invoice payment.
8. **Payment Applied** (`finance.payment.applied`): Event defined. `[PARTIAL]` -- subscriber logs only.

- **`[GAP]`**: The full sales cycle has event types defined end-to-end but most transitions are not wired with real cross-module logic. The only operational cross-module interactions are: invoice creation records metrics facts, and the high-value invoice notification. [CONTRADICTION-RESOLVED: XR-1 -- Section 6 describes event-driven architecture but only ~30% of subscribers have real business logic (PA-55). The PRD must list required cross-module integrations with explicit subscriber requirements. Unimplemented connections include: sales.invoice.created (no GL journal), sales.order.created (no inventory reservation), pos.refund.created (no reversals).]
- **`[RECOMMEND]`**: Wire `sales.order.created` subscriber to reserve inventory. Wire `sales.order.fulfilled` subscriber to create stock movements. Wire `sales.invoice.created` subscriber to post AR journal entries. Wire `finance.invoice.paid` subscriber to apply payment and update balance.

#### 6.3.2 Procurement Cycle: PO to Payment `[PARTIAL]`

```
Purchase Order --> (approve) --> Goods Receipt (GRN) --> Supplier Bill --> Payment --> GL Posting
```

1. **PO Creation**: `createPurchaseOrder` in `apps/web/src/server/erp/purchasingPo.ts` creates PO in DB. `[COMPLETE]` for creation, `[MISSING]` for event emission.
2. **PO Approval** (`purchasing.po.approved`): Event type defined. `[PARTIAL]` -- subscriber stub mentions MRP recalculation.
3. **GRN Receipt** (`wms.grn.received`): Event type defined. `[COMPLETE]` -- subscriber records `FactInventoryMovement`.
4. **GRN to Bill**: `[MISSING]` -- no event or logic links GRN receipt to automatic supplier bill creation.
5. **Bill Payment**: `[MISSING]` -- no event type for bill payment.
6. **GL Posting**: `[MISSING]` -- no automatic GL entry creation from PO approval or bill payment.

- **`[RECOMMEND]`**: Add `purchasing.bill.created` and `purchasing.bill.paid` event types. Wire GRN receipt to create a corresponding supplier bill. Wire bill payment to create AP journal entries.

#### 6.3.3 Manufacturing Cycle: Work Order to Cost `[PARTIAL]`

```
Work Order --> (release) --> Material Issue --> (complete) --> Finished Goods Receipt --> Variance Posting --> GL Posting
```

1. **Work Order Release** (`manufacturing.workorder.released`): Event defined. `[PARTIAL]` -- handler slot empty.
2. **Material Issue** (`manufacturing.workorder.material.issued`): Event defined. `[COMPLETE]` -- subscriber records `FactInventoryMovement`.
3. **Work Order Completion** (`manufacturing.workorder.completed`): Event defined. `[PARTIAL]` -- subscriber records `FactWorkOrder` but all costs (material, labour, overhead) are hardcoded as 0.
4. **Variance Posting** (`manufacturing.variance.posted`): Event defined. `[PARTIAL]` -- handler slot empty.
5. **GL Posting**: `[MISSING]` -- no automatic GL journal entries from manufacturing cost postings.

- **`[SHORTCUT]`**: Work order completion records metrics with zero costs. The actual cost rollup from material issues and labour tracking is not implemented.
- **`[RECOMMEND]`**: Wire material issue costs to accumulate on the work order. On completion, calculate actual vs standard cost variance. Post variance to GL.

#### 6.3.4 HR to Finance: Payroll to GL `[COMPLETE]`

```
Payroll Run --> (commit) --> GL Journal Entry (Expense / Payable / PAYE Liability)
```

This is the most complete cross-module chain:

1. **Payroll Run Committed** (`hr.payroll.run.committed`): Fires when a payroll run is finalized.
2. **Subscriber** (in `apps/web/src/server/events/subscribers/index.ts`):
   - Loads the `PayrollRun` record to verify existence
   - Loads all `Payslip` records for the run and their `Deduction` records
   - Calculates `totalNetMinor` from payslips and `totalTaxMinor` from PAYE/tax deductions
   - Auto-creates GL accounts ("Payroll Expense", "Payroll Payable", "PAYE Liability") if they do not exist
   - Creates a `JournalEntry` with three lines:
     - Debit: Payroll Expense (gross amount)
     - Credit: Payroll Payable (net amount)
     - Credit: PAYE Liability (tax amount)

- **`[COMPLETE]`**: This chain is fully implemented and creates real GL entries.
- **`[GAP]`**: No NI (National Insurance) employer contribution line. Only PAYE deductions are calculated. Other deduction types (student loan, pension) are not posted to separate GL accounts.
- [CONTRADICTION-RESOLVED: CR-6, XR-2 -- Two GL posting mechanisms exist for payroll: (1) event-driven via `hr.payroll.run.committed` subscriber (documented here), and (2) direct GL posting within the payroll service (Section 4.5, SC-83). The event-driven mechanism documented here is canonical. The direct call risks double-posting. New project should use a single event-driven GL posting path with NI employer contributions included.]

#### 6.3.5 POS to Finance and Inventory `[PARTIAL]`

```
POS Sale --> Finance (invoice/receipt) + Inventory (stock deduction)
POS Refund --> Finance (reversal) + Inventory (stock restoration)
```

1. **POS Sale Completed** (`pos.sale.completed`): `[PARTIAL]` -- subscriber records `FactReceipt` in metrics store. The comment mentions that Finance posting is "already done in finalisePosSale" (direct call, not event-driven).
2. **POS Refund Created** (`pos.refund.created`): `[PARTIAL]` -- subscriber logs only with comment "Would reverse inventory and finance entries."

- **`[SHORTCUT]`**: POS-to-Finance integration happens via direct function calls in `finalisePosSale`, not through the event system. This bypasses the outbox and event replay capabilities.
- **`[RECOMMEND]`**: Refactor POS-to-Finance posting to use the event system for consistency and replay support.

#### 6.3.6 Inventory to Metrics `[COMPLETE]`

All WMS events (`wms.grn.received`, `wms.putaway.completed`, `wms.pick.completed`, `wms.cyclecount.variance`) and manufacturing material issues have working subscribers that record `FactInventoryMovement` entries in the metrics store. These subscribers:
- Look up the corresponding `StockMove` record by `sourceType` and `sourceId`
- Use the StockMove's warehouse, location, and cost data
- Call `upsertFactInventoryMovement` to persist the metric

---

### 6.4 Event-Driven Notification System `[COMPLETE]`

#### 6.4.1 Notification Handlers

- **Location**: `apps/web/src/server/notifications/handlers.ts`
- **Registration**: `initializeNotificationHandlers()` is called during `registerAllSubscribers()` at application bootstrap
- **Two active notification handlers**:

1. **High-Value Invoice Alert** (`finance.invoice.created`):
   - Checks if `high_value_invoice_alert` notification is enabled for the tenant
   - Verifies the invoice status is "posted" (reads from DB)
   - Gets the configured target channel (default: "finance")
   - If invoice total >= 10000 pence (100 GBP), posts a chat message to the #finance channel

2. **Stock Shortfall Alert** (`inventory.stock.adjusted`):
   - Looks up the inventory item by SKU and optional warehouse code
   - Checks replenishment rules from `ReplenishmentStore` for matching SKU
   - If current quantity < reorder point, checks if `stock_shortfall_alert` is enabled
   - Posts a chat message to the configured channel (default: "inventory")

#### 6.4.2 Chat Notification Delivery

- **Location**: `apps/web/src/server/notifications/chat-notifications.ts`
- **Mechanism**: Posts `ChatMessage` records to chat channels using a "system" user (`system@nexa.ai`)
- **Channel resolution**: `getOrCreateChannel(tenantId, channelName)` auto-creates the workspace and channel if they do not exist
- **System user**: Creates a `User` record with id "system" if it does not exist (creates membership in target channel)
- **Channel mapping**: Hard-coded mapping of event types to channel names: `finance.invoice.created` -> "finance", `inventory.stock.adjusted` -> "inventory"

#### 6.4.3 Notification Configuration `[COMPLETE]`

- **Location**: `apps/web/src/server/notifications/config.ts`
- **Storage**: Stored in `TenantConfig.config` JSON field under `notifications` key
- **Event types**: `high_value_invoice_alert`, `stock_shortfall_alert`
- **Per-event config**: `enabled` (boolean), `targetChannel` (string)
- **Defaults**: Both alerts enabled by default; finance alerts go to "finance" channel, stock alerts go to "inventory" channel
- **In-memory cache**: `MEMORY_CACHE` Map for per-tenant notification configs
- **CRUD**: `getNotificationConfig`, `updateNotificationConfig`, `isNotificationEnabled`, `getNotificationChannel`

---

### 6.5 Propagation Framework `[COMPLETE]`

The propagation framework enforces cross-module data consistency rules at the route level.

#### 6.5.1 Propagation Registry

- **Location**: `apps/web/src/lib/propagation/registry.json` (large JSON file with 200+ entries)
- **Structure**: Each entry defines:
  - `route`: HTTP method and path (e.g., "POST /api/finance/ar/invoices/create")
  - `module`: The owning module (e.g., "finance", "inventory", "admin")
  - `writes`: Tables/entities written by this route
  - `requiredEmits`: Events that MUST be emitted during the route handler execution
  - `consistency`: "strong" or "eventual"
  - `idempotency`: `{ required: boolean, key: string | null }`
  - `notes`: Implementation notes

#### 6.5.2 Propagation Enforcement

- **Location**: `apps/web/src/lib/propagation/withPropagation.ts`
- **Middleware wrapper**: `withPropagation(ruleId, handler)` wraps route handlers
- **Enforcement modes**:
  - `PROPAGATION_ENFORCE=1`: Strict mode. Throws error if required events are not emitted. Also throws if rule definition is missing.
  - Non-production without enforce: Warns in console for missing rules
  - Production without enforce: Silent (no enforcement)
- **Mechanism**: Creates a `PropagationContext` that tracks emitted events via `ctx.emit(eventName)`. After handler execution, verifies all `requiredEmits` from the rule were emitted.
- **`[GAP]`**: The `writes` and `idempotency` fields in the registry are populated but not enforced at runtime. Only `requiredEmits` is checked. [CONTRADICTION-RESOLVED: XR-6 -- The propagation framework appears complete in documentation but is largely passive/unconfigured at runtime. Only `requiredEmits` checking is operational.]
- **`[GAP]`**: Most registry entries have `idempotency.required = false` and `idempotency.key = null`, meaning idempotency is not enforced through the propagation framework even though individual services implement it manually. [CONTRADICTION-RESOLVED: XR-6]

#### 6.5.3 Modules Covered in Registry

The propagation registry covers routes across these modules: admin, attachments, finance, hr, manufacturing, reports, super-admin, _test, crm, inventory, pos, purchasing, sales, projects, workflow, healthcare, ai, planning, supply, and settings.

---

### 6.6 Workflow Engine (Cross-Module Approval) `[COMPLETE]`

#### 6.6.1 Workflow Definitions and Instances

- **Location**: `apps/web/src/lib/workflow/workflowStore.ts`
- **DB-backed**: Uses Prisma models `WorkflowDefinition` and `WorkflowInstance`
- **Definitions**: Per-tenant, linked to a `module` and `targetType` (e.g., module="finance", targetType="invoice")
- **Steps**: Stored as JSON array of `{ id, name, role, thresholdMinor }`
- **Instances**: Track `status` (active/completed/cancelled), `entityType`, `entityId`, `currentStep`
- **State transitions**: `approveInstance` advances step index; if final step reached, marks as "approved". `rejectInstance` marks as "rejected".
- **Audit**: All workflow operations (create, approve, reject) generate audit events

#### 6.6.2 Workflow Enforcer `[COMPLETE]`

- **Location**: `apps/web/src/lib/workflow/enforcer.ts`
- **Function**: `requireWorkflowApproval(tenantId, actorId, module, targetType, targetId)`
- **Logic**:
  1. Check if workflow module is enabled for tenant (via `TenantConfig`)
  2. Find workflow definition matching `module` and `targetType`
  3. If no definition exists, approval is not required (returns `{ ok: true }`)
  4. If definition exists but no instance for this target, auto-creates a pending instance (returns `{ ok: false, reason: "workflow_required" }`)
  5. If instance exists and not approved, returns `{ ok: false, reason: "workflow_pending" }`
  6. If instance is approved, returns `{ ok: true }`
- **Integration**: Can be called by any module before performing a critical action (e.g., posting an invoice, approving a PO)
- **`[GAP]`**: No evidence of the enforcer being called from actual business module code (e.g., invoice posting, PO approval). The framework exists but integration points are not wired. [CONTRADICTION-RESOLVED: XR-4 -- The workflow engine is documented as existing infrastructure (Section 6.6) but no business module actually calls it. References to "approval workflow" in other sections are aspirational. The PRD should specify which business operations require approval workflows.]
- **`[RECOMMEND]`**: Wire `requireWorkflowApproval` into finance invoice posting, PO approval, and other critical business operations.

---

### 6.7 Orchestration Runner `[STUBBED]`

- **Location**: `apps/web/src/lib/orchestration/runner.ts`
- **In-memory queue**: Simple array-based job queue with `enqueueOrchestration`, `completeRun`, `getRuns`
- **No persistence**: Jobs are stored in-memory only; lost on process restart
- **No actual orchestration**: Jobs can be enqueued and marked complete but no business logic is executed
- **Test coverage**: Basic unit tests verify queue mechanics
- **`[STUBBED]`**: This is a placeholder for future multi-step business process orchestration (e.g., order-to-cash saga)

---

### 6.8 External Integrations `[STUBBED]`

#### 6.8.1 External Systems Configuration

- **Location**: `apps/web/src/lib/integrations/external-systems.ts`
- **Provider types**: Accounting (QuickBooks, Sage, Xero), CRM (Generic), Logistics (Generic)
- **Stored per-tenant** in `TenantIntegrationConfig` Prisma model
- **Feature-flagged**: Each provider requires an environment variable (e.g., `QUICKBOOKS_ENABLED=true`)
- **Connection status**: disconnected / connected / error

#### 6.8.2 Sync Orchestrator

- **Location**: `apps/web/src/lib/integrations/sync-orchestrator.ts`
- **Function**: `runExternalSync(options)` with `domain` (accounting/crm/logistics), `provider`, `direction` (import/export/bidirectional)
- **Idempotency**: Checks `IntegrationImportLog` for existing records by `externalId` before importing
- **Sync job tracking**: Creates `IntegrationSyncJob` with status tracking, start/end times, record counts
- **`[STUBBED]`**: The actual sync logic uses mock data (`ext-001`, `ext-002`). No real provider API calls are made. The infrastructure (job tracking, idempotency, logging) is complete but the actual data mapping and API integration is not implemented.
- **`[RECOMMEND]`**: Implement actual provider API clients for QuickBooks, Sage, Xero. Map external entities to Nexa ERP models (Customer, Supplier, InventoryItem, etc.).

#### 6.8.3 Connectors Service

- **Location**: `apps/web/src/lib/connectors/mockConnectorService.ts`
- **Connector types**: Google, Microsoft, Twilio, Stripe, Open Banking, HMRC
- **`[STUBBED]`**: In-memory boolean state only. `connect(key)` sets state to true and logs an audit event. No actual OAuth or API integration.
- **`[RECOMMEND]`**: Replace with real OAuth flows and credential storage for each connector type.

---

### 6.9 Shared Services

#### 6.9.1 Authentication and Authorization `[COMPLETE]`

**Auth Context** (`apps/web/src/lib/access/guard.ts`):
- `getAuthContext()` resolves session from Next.js headers via `getSessionContext()`
- Returns `{ tenantId, userId, role, actingUserId, modules }`
- Supports impersonation: SUPER_ADMIN can act as any user via `x-act-as` header; non-SUPER_ADMIN restricted to same tenant
- Impersonation requires `system:impersonate` permission in RBAC matrix

**Module Access Control** (`requireModuleAccess`):
- **SUPER_ADMIN isolation**: SUPER_ADMIN role is explicitly denied access to business modules (returns 403). Must use ADMIN or STAFF accounts.
- **Tenant-level module toggles**: Core modules (finance, inventory, purchasing, manufacturing, sales, projects, pos) enabled by default. New modules (supply, planning, workflow, healthcare) must be explicitly enabled via `TenantConfig`.
- **Per-user overrides**: `UserAccessConfig` can override module access per user, including fine-grained action permissions (view, create, update, delete, approve, post, manage)
- **Role-based fallback**: Falls back to RBAC permission matrix (`{module}:{action}`) if no user override exists

**Dimension Scoping** (`apps/web/src/lib/access/scope.ts`):
- `applyInventoryScope(tenantId, userId, where)`: Filters inventory queries to warehouses the user has access to
- Reads from `UserAccessConfig.modules.inventory.dimensions.warehouses`
- `[PARTIAL]`: Only inventory warehouse scoping is implemented. No scoping for finance cost centers, project sites, etc.

#### 6.9.2 Tenant Isolation `[COMPLETE]`

- **Enforcement**: Every Prisma model includes a `tenantId` field. All queries include `tenantId` in the where clause.
- **Shared tables**: `Currency`, `FxRate`, `BillingPlanTemplate` are multi-tenant but queried with tenant context
- **No row-level security (RLS)**: Tenant isolation is enforced at the application layer via Prisma queries, not at the database level
- **`[SHORTCUT]`**: Application-layer enforcement means a coding error could expose cross-tenant data. Database-level RLS would be more robust.
- **`[RECOMMEND]`**: Consider implementing PostgreSQL RLS policies as a defense-in-depth measure

#### 6.9.3 Audit Logging `[COMPLETE]`

- **Location**: `apps/web/src/lib/observability/audit.ts`
- **Dual persistence**:
  1. **Database**: Writes to `AuditLog` table (tenantId, actorId, action, target, at, data JSON)
  2. **Redis**: Pushes to `audit:{tenantId}` list (ring buffer of 200 entries) for quick UI rendering
  3. **Console**: Always logs `[AUDIT]` with timestamp, type, and sanitized data as fallback
- **Data sanitization**: Removes passwords, secrets; truncates reference fields; caps payload at 2KB
- **Transactional variant**: `auditEventInTx(tx, type, payload)` uses Prisma transaction client for atomic audit + business operation
- **Best-effort**: All persistence operations wrapped in try/catch; audit failures never block business operations
- **AI-specific**: `logAiAction` helper for structured AI action logging

**Audit events generated across modules**:
- Finance: `finance.ar.invoice.created`, `finance.update.updated`
- Purchasing: `purchasing.po.created`
- Inventory: `inventory.item.created`
- Sales: `sales.order.created`
- HR: `hr.employees.updated`, `hr.config.updated`
- CRM: (via `createContact`, `updateContact`, `createLead`, `updateLead` in their respective stores)
- Workflow: `workflow.definitions.upserted`, `workflow.instance.created`, `workflow.instance.approved`, `workflow.instance.rejected`
- Profile: `profile.preferences.update`, `profile.ai.updated`
- AI: `ai.agent.run.completed`, `ai.agent.run.failed`, `ai.query.denied`, `ai.service.error`, `AI_ACTION`
- Email: `email.sent`
- Connectors: `connect`, `disconnect` (via audit helper in log/mask)

#### 6.9.4 Email System `[COMPLETE]`

- **Core sender**: `apps/web/src/lib/email/sender.ts` wraps `sendMailProviderAgnostic` with audit logging
- **Providers**: Resend (preferred, via `RESEND_API_KEY`) and SMTP (fallback, via `SMTP_HOST` etc.)
- **Email logging**: `apps/web/src/server/email/email-log.service.ts` writes to `EmailLog` table with best-effort semantics
- **Templates**: Currently only `welcome-temp-password` template exists (sends temporary password to new users)
- **Audit**: Every email send generates an `email.sent` audit event with redacted recipient (`jo***@example.com`)
- **`[PARTIAL]`**: Only one email template (welcome with temp password). No invoice email, order confirmation, payment receipt, or notification digest templates.
- **`[RECOMMEND]`**: Add templates for: invoice PDF email, order confirmation, payment receipt, stock alert digest, workflow approval request, password reset

#### 6.9.5 Rate Limiting `[COMPLETE]`

- **Function**: `rateLimitTenant(bucket, tenantId, userId)` called from all ERP service modules
- **Buckets**: `erp-mutating` (used by invoice, sales order, PO, inventory, profile), `projects`, `crm`, `pos`, `workflow`, `ai-service`
- **Applied uniformly**: Every mutating service function checks rate limit before executing business logic

#### 6.9.6 Idempotency `[COMPLETE]`

- **Functions**: `idempotentGet(key)`, `idempotentSet(key, value, ttlSeconds)`
- **Applied to**: Invoice creation (`ar:inv:create:{tenantId}:{key}`), sales order creation (`so:create:{tenantId}:{key}`), PO creation (`po:create:{tenantId}:{key}`), inventory item creation (`invitem:create:{tenantId}:{key}`), profile preferences (`profile:{userId}:{key}`)
- **Mechanism**: If a matching key is found, returns the previous result with 409 status (conflict) instead of creating a duplicate
- **TTL**: 3600 seconds (1 hour) for all idempotency keys

#### 6.9.7 Dashboard Revalidation `[COMPLETE]`

- **Location**: `apps/web/src/lib/dashboard/revalidation.ts`
- **Functions**: `revalidateDashboardsForTenant(tenantId)` and `revalidateSuperAdminDashboards()`
- **Paths revalidated**: `/admin/dashboard`, `/staff/dashboard`, `/super-admin/dashboard`, `/super-admin/billing`
- **Called from**: Invoice creation, sales order creation (both tenant and super-admin dashboards)
- **Mechanism**: Uses Next.js `revalidatePath()` for server-side cache invalidation

#### 6.9.8 Cache Revalidation (Event-Driven) `[COMPLETE]`

- **Location**: `apps/web/src/lib/cache/revalidate.ts`
- **Function**: `revalidateForEvent(event)` called from the simpler Redis pub/sub event publisher
- **Tag-based**: Maps event types to cache tags:
  - `finance.invoice.*` -> `invoices:list:{tenantId}`, `finance:reports:{tenantId}`, `invoice:{tenantId}:{invoiceId}`
  - `inventory.grn.posted` -> `inventory:stock:{tenantId}`, `inventory:warehouses:{tenantId}`, `grn:{tenantId}:{grnId}`
  - `inventory.stock.adjusted` -> `inventory:stock:{tenantId}`, per-item and per-warehouse tags
  - `manufacturing.wo.*` -> `manufacturing:wip:{tenantId}`, `manufacturing:variance:{tenantId}`, per-workorder tags
  - `sales.lead.updated` -> `sales:leads:{tenantId}`
  - `projects.task.updated` -> `projects:tasks:{tenantId}`
  - Default -> `tenant:generic:{tenantId}`

---

### 6.10 AI Reasoning Layer (Cross-Module) `[COMPLETE]`

The AI system is designed to reason across all ERP modules by gathering context from each.

#### 6.10.1 AI Service Architecture

- **Location**: `apps/web/src/server/ai/aiService.ts`
- **Central dispatcher**: `callAiService(req)` handles all AI request kinds: chat, summary, notification, template, echo
- **Access control**: `requireAiAccess` validates role, tenant, feature flag before processing
- **Rate limiting**: AI requests use the `ai-service` rate limit bucket
- **Module context injection**: Before calling the AI orchestrator, loads module-specific context data

#### 6.10.2 Module Context Providers `[COMPLETE]`

Each module has a dedicated context provider that loads recent data for AI reasoning:

| Module | Context Provider | Data Loaded |
|---|---|---|
| Finance | `getFinanceContext` | 5 most recent invoices (number, status, total, currency) + 5 most recent supplier bills |
| Inventory | `getInventoryContext` | 5 most recent inventory items (sku, qtyOnHand) |
| POS | `getPosContext` | 5 most recent POS sales + 3 most recent refunds |
| Manufacturing | `getManufacturingContext` | 5 most recent work orders (number, status, itemCode, quantity) |
| Projects | `getProjectsContext` | 5 most recent projects (name, status, budget) + 5 most recent timesheets |
| CRM | `getCrmContext` | 5 most recent CRM accounts + 5 most recent opportunities (name, stage, value) |
| HR | `getHrContext` | 5 most recent employees (name, email) |
| Healthcare | `getHealthcareContext` | 3 PCN records + 5 rota records (uses optional chaining for models that may not exist) |

- **Context is appended to prompts**: Module context is serialized to JSON and appended (max 4000 chars) to the user's prompt before AI processing
- **`[SHORTCUT]`**: Context is limited to 5 most recent records per entity. No aggregation, filtering by relevance, or semantic search. [CONTRADICTION-RESOLVED: XR-5 -- The AI-first vision described in the document introduction relies on rich context, but the actual implementation is limited to 5 recent records per entity. The PRD should specify context depth requirements per module for AI.]

#### 6.10.3 Agent System `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/agent.ts`
- **Agent runs**: Persisted in `AgentRun` model with steps in `AgentStep`
- **Tool registry**: Read-only tools registered: `finance.journals.summary`, `inventory.on_hand_by_item`, `supply.stockout_and_suggestions`
- **Execution flow**:
  1. Create AgentRun record (status: running)
  2. Resolve intent via `resolveIntent` (deterministic intent classification)
  3. Call AI service with context
  4. Create AgentStep records for each operation
  5. Update AgentRun with result (status: completed/failed)
- **Audit**: All agent runs generate audit events (`ai.agent.run.completed`, `ai.agent.run.failed`)

#### 6.10.4 AI Automations `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/automations.ts`
- **Per-tenant automations**: Stored in `TenantConfig.config.ai.automations` JSON
- **Templates**: Automations use Mustache-like template syntax (`{{ variable }}`) to inject payload data into prompts
- **Idempotency**: Automation runs are idempotent -- results cached in `TenantConfig.config.ai.idempotency`
- **Intents**: Restricted to allowed intents: `query`, `explain`, `draft`, `classify`, `summary`
- **Triggers**: `manual` or `webhook`
- **AI engine**: `apps/web/src/server/ai/engineClient.ts` -- in test mode returns deterministic echo hash; in production throws `ai_engine_not_configured` (503)
- **`[STUBBED]`**: The AI engine client has no real AI provider integration. It returns mock data in test mode and errors in production.

#### 6.10.5 AI Guardrails `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/guardrails.ts`
- **Prompt safety**: `assertPromptSafe(prompt)` checks:
  - Not empty
  - Max 8000 characters
  - No embedded API keys, Bearer tokens, JWTs, or `sk-` prefixed keys (regex patterns)
- **Intent validation**: `assertIntent(intent)` restricts to allowed intents only
- **Resource reference validation**: `validateResourceRefs(tenantId, refs)` verifies referenced entities (chatChannel, project, inventoryItem) belong to the tenant

#### 6.10.6 Tenant Analytics and Forecasting `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/tenant-analytics.service.ts`
- **Revenue history**: Monthly aggregation from `CustomerInvoice` using SQL `DATE_TRUNC` (excludes draft/cancelled/void)
- **Cash receipts**: Daily aggregation from `CustomerPayment`
- **Forecasting**: Two methods based on data availability:
  - **Linear trend**: Used when 4+ historical points exist (ordinary least squares regression)
  - **Moving average**: Used when 3 points exist (average of last 3)
  - Returns `sufficientHistory: false` when fewer than 3 data points
- **Risk classification**: `[STUBBED]` -- returns single "UNCLASSIFIED" bucket (no risk model implemented)

#### 6.10.7 AI Automation Service `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/automations.service.ts`
- **Cross-module queries**: Pre-built queries spanning multiple modules:
  - `selectOverdueInvoices(tenantId)`: Finance -- invoices with status "posted" and dueAt in the past
  - `selectLowStockItems(tenantId)`: Inventory -- items with qtyOnHand < 10
  - `selectProjectOverruns(tenantId)`: Projects -- all projects (no actual overrun detection)
  - `selectStalledOpportunities(tenantId)`: CRM -- opportunities ordered by oldest updatedAt
- **AI-phrased notifications**: `phraseNotification` calls AI service to generate natural-language notification text
- **`[SHORTCUT]`**: `selectProjectOverruns` does not actually detect overruns; it returns all projects. `selectLowStockItems` uses hardcoded threshold of 10.

#### 6.10.8 Tenant Metrics Service `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/tenant-metrics.service.ts`
- **Cross-module counts**: `getCustomerCountForTenant`, `getInvoiceCountForTenant`, `getItemCountForTenant`
- **Used by**: ADMIN AI queries to answer "how many X do I have?" type questions

#### 6.10.9 AI Audit `[COMPLETE]`

- **Location**: `apps/web/src/server/ai/audit.ts`
- **Dual persistence**: Attempts `AIEngineLog` table first; falls back to `TenantConfig.config.ai.audit` JSON ring buffer (max 200 entries)
- **Data captured**: tenantId, userId, intent, traceId, promptLength, responseSnippet (first 200 chars)

---

### 6.11 Cross-Module Data Flows (FK Relationships)

Based on the Prisma schema, the following FK relationships cross module boundaries:

#### 6.11.1 Tenant as Universal Root

Every business entity has a `tenantId` FK to `Tenant`. The `Tenant` model is the root of the multi-tenant hierarchy. Key direct relations from Tenant:
- Users, Accounts, Customers, Suppliers
- CustomerInvoice, SupplierBill, JournalEntry
- InventoryItem, Warehouse, WorkOrder
- PurchaseOrder, CrmAccount, Project
- TenantConfig, TenantIntegrationConfig

#### 6.11.2 Finance to Customer/Supplier

- `CustomerInvoice.customerId` -> `Customer` (Finance reads from CRM/Customer master)
- `CustomerPayment.customerId` -> `Customer`
- `SupplierBill.supplierId` -> `Supplier` (Finance reads from Purchasing/Supplier master)
- `SupplierPayment.supplierId` -> `Supplier`
- `JournalEntry.lines[].accountId` -> `Account` (Chart of Accounts)

#### 6.11.3 Purchasing to Supplier and Inventory

- `PurchaseOrder.supplierId` -> `Supplier`
- `PurchaseOrderLine.sku` references inventory items (string match, not FK)
- GRN receipt events link to inventory stock movements

#### 6.11.4 Manufacturing to Inventory

- `WorkOrder.itemCode` references inventory items (string match, not FK)
- `WorkOrderMaterialIssue.lotId` -> `InventoryLot` (optional FK)
- `WorkOrderMaterialIssue.workOrderId` -> `WorkOrder`
- Manufacturing material issue events trigger inventory stock movements

#### 6.11.5 Sales to Customer and Inventory

- `SalesQuote/SalesOrder` link to `Customer` via `customerId`
- Sales order lines reference inventory via `sku` (string match)
- `SalesInvoice.orderId` links back to `SalesOrder`

#### 6.11.6 POS to Inventory and Finance

- `PosSale` linked to shifts and stores
- POS sale lines reference inventory items by SKU
- POS sale completion should deduct inventory and create finance entries

#### 6.11.7 Projects to Finance and HR

- `ProjectTimesheet` links `projectId` -> `Project` and `employeeId` -> `Employee`
- `ProjectExpense` links to `Project`
- `ProjectInvoice` links `projectId` and `customerId`
- `WipLedger` tracks work-in-progress costs per project phase

#### 6.11.8 HR to Finance

- Payroll run commitment creates GL journal entries (via event subscriber)
- `Payslip` and `Deduction` records feed into GL calculations

#### 6.11.9 Workflow to All Modules

- `WorkflowDefinition.entityType` can reference any module's entity type
- `WorkflowInstance.entityId` references the specific entity requiring approval
- The workflow enforcer can be called from any module

#### 6.11.10 Attachments (Cross-Cutting)

- `Attachment` model has `entityType` and `entityId` fields -- polymorphic reference to any entity across all modules
- `attachments.attachment.created` event fires on attachment upload

#### 6.11.11 Shared Lookup Tables

- **Currency**: Shared across all financial modules (invoices, bills, POs, sales, POS)
- **FxRate**: Currency pair exchange rates (from/to currency FKs)
- **Account** (Chart of Accounts): Used by Finance GL, auto-created by Payroll subscriber
- **TenantConfig**: Central JSON configuration shared by all modules for feature flags, notification settings, AI config, HR config

---

### 6.12 Summary of Cross-Module Interaction Maturity

| Interaction | Status | Notes |
|---|---|---|
| Event bus (typed, in-process) | `[COMPLETE]` | 50+ event types defined, handler registry operational |
| Transactional outbox (DB-backed) | `[COMPLETE]` | Full CRUD, retry with backoff, replay support |
| Event subscribers (wired logic) | `[PARTIAL]` | Only ~30% of subscribers have real business logic; rest are stubs or logs-only |
| HR Payroll -> Finance GL posting | `[COMPLETE]` | Creates journal entries with expense/payable/liability lines |
| WMS/Manufacturing -> Metrics facts | `[COMPLETE]` | GRN, pick, putaway, material issue all record FactInventoryMovement |
| Sales Invoice -> Metrics facts | `[COMPLETE]` | FactInvoice recorded for sales and project invoices |
| POS Sale -> Metrics facts | `[COMPLETE]` | FactReceipt recorded for completed POS sales |
| Finance invoice -> Chat notification | `[COMPLETE]` | High-value invoice alert posted to #finance channel |
| Inventory -> Chat notification | `[COMPLETE]` | Stock shortfall alert posted to #inventory channel |
| Notification config (per-tenant) | `[COMPLETE]` | Configurable enable/disable and target channel per event type |
| Propagation enforcement | `[COMPLETE]` | Registry of 200+ routes with required event emissions; runtime enforcement available |
| Workflow approval framework | `[COMPLETE]` | Definition + instance + enforcer exist; not wired to business operations |
| AI cross-module context | `[COMPLETE]` | 8 module context providers feed data into AI prompts |
| AI agent system | `[COMPLETE]` | Agent runs with steps, tool registry, audit trail |
| External integration sync | `[STUBBED]` | Infrastructure complete, actual provider APIs not implemented |
| External connectors | `[STUBBED]` | In-memory state, no real OAuth/API integration |
| Orchestration (saga) | `[STUBBED]` | In-memory queue placeholder, no real orchestration |
| Full sales cycle (Quote->Order->Invoice->Payment) | `[PARTIAL]` | Event types defined end-to-end; cross-module wiring mostly stubs |
| Full procurement cycle (PO->GRN->Bill->Payment) | `[PARTIAL]` | GRN->metrics works; PO->Bill and Bill->Payment not wired |
| Manufacturing costing pipeline | `[PARTIAL]` | Material issue tracked; completion costs hardcoded as zero |
| POS refund reversal | `[MISSING]` | No inventory or finance reversal on POS refund |
| Invoice -> GL journal auto-posting | `[MISSING]` | Only payroll creates GL entries; invoices/bills do not |
| Sales order -> Inventory reservation | `[MISSING]` | Mentioned in subscriber comments as future work |
| Tenant isolation (DB-level RLS) | `[MISSING]` | Application-layer only |

---

### 6.13 Recommendations for New Project `[RECOMMEND]`

1. **Unify event systems**: Merge the older `lib/events` (DomainEvent with 8 types) and the newer `server/events` (NexaEvent with 50+ types) into a single event bus. Eliminate the dual-system confusion.

2. **Complete subscriber wiring**: The event bus and outbox infrastructure is production-ready. The gap is in subscribers -- most log only. Priority subscribers to implement:
   - `finance.invoice.created` -> Create AR journal entries (Debit: Accounts Receivable, Credit: Revenue)
   - `purchasing.po.approved` -> Reserve budget in procurement
   - `sales.order.created` -> Reserve inventory quantities
   - `sales.order.fulfilled` -> Create stock movements (outbound)
   - `pos.refund.created` -> Reverse inventory deductions and finance entries
   - `manufacturing.workorder.completed` -> Calculate actual costs from material issues and timesheets

3. **Wire workflow enforcer**: Connect `requireWorkflowApproval` to critical business operations: invoice posting (finance), PO approval (purchasing), payroll run commitment (HR), budget approval (projects).

4. **Implement database-level tenant isolation**: Add PostgreSQL Row-Level Security (RLS) policies as defense-in-depth alongside the application-layer filtering.

5. **Build real external integrations**: Replace stub sync orchestrator with actual QuickBooks/Sage/Xero API clients. Implement OAuth2 credential management, field mapping, conflict resolution, and bidirectional sync.

6. **Implement saga orchestration**: Replace the in-memory orchestration runner with a durable saga pattern for complex multi-step processes (order-to-cash, procure-to-pay) using the existing outbox as the persistence layer.

7. **Expand notification system**: Add email notifications for business events (invoice due, order confirmation, approval request). Add notification preference management per user (not just per tenant).

8. **Enhance AI context**: Replace the "last 5 records" context providers with more intelligent context gathering: aggregations, trend summaries, anomaly detection, and user-relevant filtering.

---

### 6.14 Data Import/Export Tools `[MUST-HAVE -- Added from completeness review M-29]`

**Requirement Source:** Core operability -- no bulk import or export capability for any module. SMEs must migrate data from existing systems (Xero, QuickBooks, spreadsheets). This is a migration blocker -- without it, no customer can onboard.

**Description:**
Bulk data import and export for all core entities via CSV and Excel files. This is essential for customer onboarding (migrating from existing systems) and ongoing data management.

**Business Rules:**
- **Import:** Upload CSV/Excel file, preview mapping, validate data, import with error reporting
- **Export:** Download all records for an entity as CSV or Excel
- **Entities requiring import/export:**
  - Customers (with structured addresses)
  - Suppliers (with bank details)
  - GL Chart of Accounts
  - Inventory Items
  - Opening Balances (customer/supplier/GL)
  - Employees
  - Products/Price Lists
  - Bank Statement Lines
- **Import validation:** Check required fields, validate data types, check for duplicates (by code/SKU), validate foreign key references
- **Import modes:** Create only, Update only, Create or Update (upsert)
- **Error handling:** Return detailed error report with row numbers and field-level errors
- **Batch size:** Support up to 10,000 rows per import
- **Template download:** Provide downloadable CSV/Excel templates with headers and example data for each entity
- **Mapping UI:** Allow users to map CSV columns to entity fields (for non-standard column names)
- **Audit trail:** Log all imports (who, what, when, how many records)

**API Operations Expected:**
- `GET /api/import-export/templates/[entity]` -- Download import template
- `POST /api/import-export/import/[entity]` -- Upload and import data file
- `GET /api/import-export/import/[jobId]/status` -- Check import job status
- `GET /api/import-export/import/[jobId]/errors` -- Get import error report
- `GET /api/import-export/export/[entity]?format=csv|xlsx` -- Export entity data

**Competitor Reference:** Xero has a comprehensive import wizard. QuickBooks supports CSV import for all major entities. Sage has data migration tools.

---

### 6.15 Database-Backed Storage Migration `[MUST-HAVE -- Added from completeness review M-27]`

**Requirement Source:** Data integrity -- Pick/pack/ship, transfers, receiving, replenishment, RMA, leave requests, and payroll runs all use file-based JSON storage. Must migrate to database.

**Current State in Document:** Multiple sections document file-based storage: Section 2.3.7 (pick/pack/ship), Section 2.4.1 (transfers), Section 2.3.8 (receiving), Section 2.10.1 (replenishment), Section 2.11.1 (RMA), Section 4.3 (leave), Section 4.5 (payroll runs).

**Description:**
All business data must be stored in the PostgreSQL database via proper Prisma models. File-based JSON storage is not acceptable for production use (no transactions, no queries, no concurrent access safety, no backup/restore).

**Business Rules:**
- All entities currently in file-based storage must have Prisma models
- All entities currently in TenantConfig JSON must have dedicated relational tables
- Migration path: create new tables, migrate data, switch service layer, deprecate old storage
- No business data in the filesystem (except file uploads/attachments which go to object storage)
- No business data in TenantConfig JSON catch-all (except pure configuration flags)

---

### 6.16 Eliminate Dual/Triple Implementations `[MUST-HAVE -- Added from completeness review M-28]`

**Requirement Source:** Data integrity -- every CRM entity has file-based AND DB-backed stores. HR has triple payroll implementations. Must consolidate to single source of truth.

**Current State in Document:** Sections 3.1-3.8 document dual stores for every CRM entity. Section 4.5 documents triple payroll implementations.

**Description:**
Every feature must have exactly one implementation. The database-backed implementation must be the single source of truth.

**Business Rules:**
- CRM entities (Leads, Contacts, Accounts, Opportunities, Activities, Quotes, Price Books): remove file-based stores, use only Prisma/DB-backed implementations
- Payroll: consolidate three implementations (Prisma, JSON, file) into single Prisma-backed pipeline
- Cycle counting: consolidate database-backed and file-based implementations
- POS: consolidate three implementations into single DB-backed implementation
- GL: consolidate to single modern GL system (remove legacy Account/JournalEntry)
- Period close: consolidate PeriodClose table and TenantConfig JSON mechanisms

---

## Section 7: Management Platform (Tenants, Billing, Provisioning)

This section documents the complete management layer of the Nexa ERP platform, covering tenant lifecycle, user authentication, role-based access control, billing and subscriptions, module licensing, API key management, audit logging, and super-admin functions. All business rules are extracted directly from the codebase.

---

### 7.1 Tenant Management

#### 7.1.1 Tenant Entity

**Source:** `prisma/schema.prisma` (model `Tenant`, mapped to `tenants` table)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| name | String | Yes | - | - | Tenant display name |
| code | String | No | - | @unique | Tenant code for identification; indexed |
| status | String | Yes | "active" | Indexed | Lifecycle: active, suspended, deleted, archived |
| region | String | No | - | - | e.g., "GB", "US", "EU" |
| vertical | String | No | - | Indexed | healthcare, manufacturing, retail, consulting, supply_chain |
| plan | String | No | - | - | Legacy plan field: STANDARD, ENTERPRISE, etc. |
| baseCurrency | String | Yes | "GBP" | - | Functional currency |
| baseCurrencyCode | String | No | - | FK to Currency.code | Normalized FK reference |
| defaultTimezone | String | Yes | "Europe/London" | - | IANA timezone |
| defaultTimezoneId | String | No | - | FK to Timezone.ianaId | Normalized FK reference |
| isHealthcare | Boolean | Yes | false | - | Healthcare vertical flag |
| pcnId | String | No | - | - | PCN identifier if healthcare tenant |
| practiceCount | Int | No | - | - | Number of practices if healthcare |
| stripeCustomerId | String | No | - | Indexed | Stripe customer ID |
| stripeSubscriptionId | String | No | - | Indexed | Stripe subscription ID |
| billingStatus | BillingStatus? | No | - | Enum | trial, active, past_due, cancelled |
| billingPlan | String | No | - | - | Legacy billing plan reference |
| billingPlanCode | String | No | - | Indexed, FK to BillingPlanTemplate.code | Plan catalog linkage |
| billingMethod | BillingMethod? | No | - | Enum | INVOICE, BANK_TRANSFER, STRIPE, OTHER |
| billingDayOfMonth | Int | No | - | 1-28 | Billing cycle day |
| billingContactName | String | No | - | - | |
| billingContactEmail | String | No | - | - | |
| billingContactPhone | String | No | - | - | |
| billingAddressLine1 | String | No | - | - | |
| billingAddressLine2 | String | No | - | - | |
| billingCity | String | No | - | - | |
| billingPostcode | String | No | - | - | |
| billingCountry | String | No | - | - | |
| bankAccountName | String | No | - | - | |
| bankSortCode | String | No | - | - | |
| bankAccountNumber | String | No | - | - | |
| bankIban | String | No | - | - | |
| nextBillingDate | DateTime | No | - | - | |
| customMaxUsersTotal | Int | No | - | - | Overrides plan max users |
| customPriceMonthly | Decimal(18,2) | No | - | - | Overrides plan price |
| setupComplete | Boolean | Yes | false | - | Wizard completion flag |
| setupCompletedAt | DateTime | No | - | - | |
| setupData | Json | No | - | - | CoA template, scenario seeds, etc. |
| createdAt | DateTime | Yes | now() | - | |
| updatedAt | DateTime | Yes | @updatedAt | - | |

**Relations:**
- `users` -> User[] (one-to-many)
- `entities` -> Entity[] (one-to-many; legal entities / subsidiaries)
- `subscriptions` -> Subscription[] (one-to-many)
- `billingPlanTemplate` -> BillingPlanTemplate (many-to-one via billingPlanCode -> code)

**Indexes:**
- `code` (unique + indexed)
- `status`
- `vertical`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `billingPlanCode`

#### 7.1.2 Tenant Status Lifecycle

```
[new] --> active --> suspended --> active (reactivation)
                 --> deleted (soft-delete, excluded from queries)
                 --> archived (excluded from queries)
```

**Business Rules:**
- **BR-T-001:** Tenant creation defaults status to `"active"`. (Source: `tenants.service.ts` line 809)
- **BR-T-002:** Tenant deletion is a **soft-delete** -- sets `status = "deleted"`. The record is never physically removed. (Source: `tenants.service.ts#deleteTenantFromSuperAdmin`)
- **BR-T-003:** Queries for tenant lists exclude tenants with `status IN ("deleted", "archived")`. (Source: `tenants.service.ts` line 113, 185)
- **BR-T-004:** Platform/root tenants (code = "platform" or "root") cannot be updated via the super-admin update function. (Source: `tenants.service.ts` line 918-919)
- **BR-T-005:** Tenant codes must be unique. Creating a tenant with an existing code throws `"tenant_code_exists"`. (Source: `tenants.service.ts` line 445)

#### 7.1.3 Demo Tenant Detection

**Source:** `apps/web/src/server/super-admin/tenants.service.ts`

A tenant is classified as "demo" if ANY of these conditions are met:
1. `TenantConfig.config.demo === true`
2. Tenant code matches patterns: `DEMO-`, `DEMO_`, `SEED-DEMO-`, `NEXA_DEMO`
3. Tenant name matches patterns: "nexa demo", "nexa root", "manufacturing demo", "retail demo", "consulting demo", "healthcare demo", "supply chain demo", "test tenant", "sample tenant"

**Business Rules:**
- **BR-T-006:** Demo tenants are excluded from super-admin listing by default. Pass `includeDemo: true` to include them. (Source: `tenants.service.ts#listTenantsForSuperAdmin`)
- **BR-T-007:** Demo tenants are excluded from billing summary stats and MRR calculations by default. (Source: `tenants.service.ts#getTenantSummaryStats`)

#### 7.1.4 Tenant Setup Wizard

**Source:** `apps/web/src/lib/tenant/wizard-guard.ts`, `apps/web/src/components/tenant/SetupGuard.tsx`

**Business Rules:**
- **BR-T-008:** New tenants start with `setupComplete = false`. Transactional routes (finance, inventory, manufacturing, sales, purchasing, projects, POS, HR, costing) are blocked until setup completes. (Source: `SetupGuard.tsx`)
- **BR-T-009:** Allowed routes during setup: `/setup`, `/profile`, `/settings`, `/help`, `/dashboard`.
- **BR-T-010:** `markTenantSetupComplete()` records the CoA template, baseCurrency, timezone, vertical, and scenario seeds into `setupData` JSON field. (Source: `wizard-guard.ts`)
- **BR-T-011:** In test/CI environments (when test auth is enabled), the setup wizard guard is bypassed and always returns `true`. (Source: `wizard-guard.ts` line 14-16) **[SHORTCUT]**

#### 7.1.5 TenantConfig Entity

**Source:** `prisma/schema.prisma` (model `TenantConfig`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | @unique, indexed | FK to Tenant |
| locale | String | No | "en-GB" | - | |
| timezone | String | No | "Europe/London" | - | |
| currency | String | No | "GBP" | - | |
| region | String | No | "EU" | - | EU, UK, US, GCC |
| keyId | String | No | - | - | TenantKey.id (BYOK encryption key) |
| keyAlias | String | No | - | - | External KMS alias |
| keyVersion | Int | No | 1 | - | Key rotation version |
| config | Json | No | - | - | Module flags, agent flags, billing, compliance, policies, userPreferences, runbooks, integrations, etc. |
| createdAt | DateTime | Yes | now() | - | |
| updatedAt | DateTime | Yes | @updatedAt | - | |

**Notes:** The `config` JSON field is heavily overloaded. It stores:
- `billing` (TenantBillingConfig)
- `modules` (per-module enabled/disabled flags)
- `demo` (boolean)
- `policies` (requireMFAForAdmin, restrictExports, allowCrossTenantAccess)
- `compliance` (region, dataResidency, retentionProfile, exportAllowed, gdprCompliant)
- `complianceChecks` (array, last 10)
- `complianceSnapshots` (array, last 5)
- `userPreferences` (per-user preferences keyed by userId)
- `hr` (HR module metadata)
- `aiConfig` (stored on PLATFORM tenant)
- `integrations` (stored on PLATFORM tenant)
- `plansCatalog` (stored on PLATFORM tenant)
- `runbooks` (stored on NEXA_ROOT tenant)

**[GAP]:** The `config` JSON field acts as a catch-all bag. In the new database-per-tenant architecture, these should be broken into properly typed tables. **[RECOMMEND]:** Create dedicated tables: `TenantPolicy`, `TenantComplianceConfig`, `UserPreference`, `PlatformConfig`. [CONTRADICTION-RESOLVED: EC-13 -- Multiple sections rely on TenantConfig for different data (period close state, VAT returns, disabled suppliers, disabled warehouses, disabled items, leave balances, payroll data, replenishment rules, RFQs, POS registers, report schedules). Each should migrate to proper relational tables. See R-107.]

#### 7.1.6 Tenant Locale & Preferences

**Source:** `apps/web/src/lib/tenant/locale.ts`, `apps/web/src/lib/profile/prefs.ts`

**Business Rules:**
- **BR-T-012:** Currency resolution order: `Tenant.baseCurrencyCode` FK -> `Tenant.baseCurrency` legacy field -> "GBP" fallback.
- **BR-T-013:** Timezone resolution order: `Tenant.defaultTimezoneId` FK -> `Tenant.defaultTimezone` legacy field -> "Europe/London" fallback.
- **BR-T-014:** User timezone override: `User.timezoneId` FK -> `User.timezone` legacy field -> tenant default.
- **BR-T-015:** Locale derived from currency/timezone mapping: GBP/London -> en-GB, USD/America -> en-US, EUR/Europe -> en-GB (fallback).

**User Preferences:** Stored in `TenantConfig.config.userPreferences[userId]` JSON. Cached via Redis with 30-day TTL.
- timezone, currency, bgKind (solid/gradient/image/upload), bgValue, themeJson, aiPrompt

#### 7.1.7 Tenant API Operations

| Operation | Source | Access | Notes |
|---|---|---|---|
| List tenants | `tenants.service.ts#getTenantList` | SUPER_ADMIN | Excludes deleted/archived; includes effective billing |
| List tenants (filtered) | `tenants.service.ts#listTenantsForSuperAdmin` | SUPER_ADMIN | Excludes demo tenants by default |
| Get tenant detail | `tenants.service.ts#getTenantDetail` | SUPER_ADMIN | Includes users list |
| Get tenant summary stats | `tenants.service.ts#getTenantSummaryStats` | SUPER_ADMIN | Total, setup, billing breakdown |
| Create tenant (simple) | `tenants.service.ts#createTenantFromSuperAdmin` | SUPER_ADMIN | Creates tenant + admin user + TenantConfig |
| Create tenant (full billing) | `tenants.service.ts#createTenantWithPlanAndBilling` | SUPER_ADMIN | Full billing config including plan, method, contact |
| Update tenant | `tenants.service.ts#updateTenantFromSuperAdmin` | SUPER_ADMIN | Whitelisted fields only |
| Delete tenant | `tenants.service.ts#deleteTenantFromSuperAdmin` | SUPER_ADMIN | Soft-delete (status -> deleted) |
| Update plan & billing | `tenants.service.ts#updateTenantPlanAndBilling` | SUPER_ADMIN | Full billing detail update |
| Get plan billing detail | `tenants.service.ts#getTenantPlanBillingDetail` | SUPER_ADMIN | All billing fields + active user count |
| Get admin plan view | `plan-billing.service.ts#getAdminPlanBilling` | ADMIN | Current tenant billing summary |
| Get admin dashboard | `dashboard-metrics.service.ts#getAdminDashboardMetrics` | ADMIN | Revenue, invoices, orders, utilization |
| Check setup status | `wizard-guard.ts#isTenantSetupComplete` | Any authenticated | Boolean check |
| Mark setup complete | `wizard-guard.ts#markTenantSetupComplete` | ADMIN | Stores setup data |

#### 7.1.8 Tenant Gaps & Issues

- **[SCHEMA-GAP]:** `baseCurrencyCode` and `defaultTimezoneId` FK fields exist but are nullable and often null. Code falls back to legacy string fields. The FK relations to Currency and Timezone tables are not formally declared in the schema on the Tenant model.
- **[GAP]:** No tenant suspension/reactivation API. `status = "suspended"` is documented in schema comments but no service function implements the transition.
- **[SHORTCUT]:** TenantConfig uses raw SQL `INSERT ... ON CONFLICT` to handle upsert because of schema validation issues, with a fallback to Prisma upsert. This pattern is repeated across many super-admin service files.
- **[RECOMMEND]:** In the new architecture, each tenant should have its own database. The management database should contain: tenant metadata, billing config, user directory (for cross-tenant auth), plan assignments.

---

### 7.2 User Management & Authentication

#### 7.2.1 User Entity

**Source:** `prisma/schema.prisma` (model `User`, mapped to `users` table)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| email | String | Yes | - | @unique, indexed | |
| name | String | No | - | - | Display name |
| passwordHash | String | No | - | mapped: password_hash | bcrypt hash |
| role | String | No | "USER" | - | USER, ADMIN, SUPER_ADMIN (stored); normalized to AppRole |
| tenantId | String | Yes | - | FK to Tenant, indexed | mapped: tenant_id |
| active | Boolean | Yes | true | Indexed (composite with tenantId) | Soft-delete flag |
| mustChangePasswordOnNextLogin | Boolean | Yes | false | - | Force password change on first login |
| phone | String | No | - | - | |
| timezone | String | No | - | - | Per-user timezone override (IANA) |
| timezoneId | String | No | - | FK to Timezone.ianaId | Normalized FK reference |
| locale | String | No | "en-GB" | - | |
| dateFormat | String | No | "DD/MM/YYYY" | - | |
| avatar | String | No | - | - | Avatar URL or path |
| mfaEnabled | Boolean | Yes | false | mapped: mfa_enabled | MFA toggle |
| mfaSecret | String | No | - | mapped: mfa_secret | TOTP secret |
| emailVerified | DateTime | No | - | mapped: email_verified | |
| image | String | No | - | - | Legacy image field |
| createdAt | DateTime | Yes | now() | mapped: created_at | |
| updatedAt | DateTime | Yes | @updatedAt | mapped: updated_at | |

**Relations:**
- `accounts` -> accounts[] (OAuth providers)
- `sessions` -> sessions[] (NextAuth sessions)
- `passwordResetTokens` -> password_reset_tokens[]
- `tenant` -> Tenant (many-to-one)
- `departments` -> UserDepartment[] (many-to-many via join table)
- `teams` -> UserTeam[] (many-to-many via join table)
- `aiProfile` -> AIProfile? (one-to-one)

#### 7.2.2 Authentication System

**Source:** `apps/web/src/lib/auth/options.ts`

**Provider Stack:**
1. **Credentials Provider** (email + password via NextAuth CredentialsProvider)
2. **Google OAuth** (optional, enabled when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set)
3. **Microsoft Azure AD** (optional, enabled when `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` are set)

**Session Configuration:**
- Strategy: JWT
- Max age: 8 hours (`60 * 60 * 8` seconds)
- Sign-in page: `/login`
- Cookie name: `__Secure-next-auth.session-token` (production), `next-auth.session-token` (dev)
- Cookie domain: `.nexaai.co.uk` (production only)
- SameSite: `lax`, HttpOnly: `true`, Secure: production only

**Business Rules:**
- **BR-A-001:** Email is normalized (lowercased, trimmed) before authentication. (Source: `verifyCredentials.ts`, `normalizeEmail.ts`)
- **BR-A-002:** Inactive users (`active = false`) are denied login. (Source: `verifyCredentials.ts` line 21)
- **BR-A-003:** Users without a password hash cannot log in via credentials (OAuth-only users). (Source: `verifyCredentials.ts` line 22)
- **BR-A-004:** Password verification uses bcrypt comparison. (Source: `verifyCredentials.ts` line 24)
- **BR-A-005:** JWT token stores `role`, `tenant_id`, and `mustChangePasswordOnNextLogin`. (Source: `options.ts` jwt callback)
- **BR-A-006:** If tenant_id is missing from JWT, it is resolved from the database during token creation. SUPER_ADMIN users fall back to the first available tenant or synthetic "t-demo". (Source: `options.ts` jwt callback lines 104-121) **[SHORTCUT]**
- **BR-A-007:** SUPER_ADMIN MFA check is logged but not enforced during login. MFA is documented but currently a soft warning. (Source: `options.ts` lines 37-49) **[PARTIAL]**

#### 7.2.3 Session Context Resolution

**Source:** `apps/web/src/lib/auth/tenant.server.ts`

**Business Rules:**
- **BR-A-008:** `getSessionContext()` resolves `tenantId`, `userId`, and `role` from the JWT session. If test auth is enabled, it reads from test auth cookies/headers.
- **BR-A-009:** If `tenantId` is missing from the session, the system attempts to resolve it from the User record in the database. For non-SUPER_ADMIN users, it falls back to the first tenant. For SUPER_ADMIN, it falls back to the root tenant or "t-demo". **[SHORTCUT]**
- **BR-A-010:** `assertTenantScope()` enforces that in production, a request's tenant ID must match the session's tenant ID (cross-tenant access prevention). (Source: `tenant.server.ts` line 94-98)

#### 7.2.4 User Onboarding

**Source:** `apps/web/src/server/auth/onboarding.service.ts`

**Business Rules:**
- **BR-A-011:** New users are created with a randomly generated temporary password (14 chars by default, includes uppercase, lowercase, digits, symbols). (Source: `onboarding.service.ts#generateTempPassword`)
- **BR-A-012:** Password is hashed with bcrypt, salt rounds = 12. (Source: `onboarding.service.ts` line 42)
- **BR-A-013:** New users are marked with `mustChangePasswordOnNextLogin = true`. (Source: `onboarding.service.ts` line 65, 81)
- **BR-A-014:** If a user with the same email already exists and is active, creation is rejected with "User with this email already exists". (Source: `onboarding.service.ts` line 53)
- **BR-A-015:** If a user with the same email exists but is inactive (`active = false`), the existing user is reactivated and updated with new credentials/role. (Source: `onboarding.service.ts` lines 56-67)
- **BR-A-016:** User capacity guard is enforced before user creation. If the tenant has reached its user limit, creation throws `USER_CAP_REACHED` (HTTP 409). (Source: `onboarding.service.ts` line 30-38)
- **BR-A-017:** After user creation, a welcome email with temporary password is sent via `sendWelcomeTempPasswordEmail()`. Email failures are logged but do not block user creation. (Source: `onboarding.service.ts` lines 108-119)

#### 7.2.5 User Deletion

**Business Rules:**
- **BR-A-018:** User deletion is a soft-delete -- sets `active = false`. Users are never physically removed. (Source: `users.service.ts#deleteUserFromSuperAdmin`, `guards.server.ts#canDeleteUser`)
- **BR-A-019:** SUPER_ADMIN can delete any non-SUPER_ADMIN user. (Source: `guards.server.ts` line 140-142)
- **BR-A-020:** ADMIN can only delete users in their own tenant with role STAFF or VIEWER. (Source: `guards.server.ts` lines 145-150)
- **BR-A-021:** The singleton SUPER_ADMIN (matching `SUPER_ADMIN_EMAIL` env var, default: `info@nexaai.co.uk`) can never be deleted. (Source: `guards.server.ts` lines 133-137)

#### 7.2.6 Password Reset Tokens

**Source:** `prisma/schema.prisma` (model `password_reset_tokens`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | - | PK | |
| userId | String | Yes | - | FK to User | |
| token | String | Yes | - | @unique | |
| expires_at | DateTime | Yes | - | - | |
| used | Boolean | Yes | false | - | |

**[PARTIAL]:** The password reset token model exists in the schema, but the reset flow implementation (generating tokens, sending emails, validating) was not found in the scanned server-side code. It may exist in API route handlers not covered by the search paths.

#### 7.2.7 Re-Authentication Guard

**Source:** `apps/web/src/lib/security/re-auth-guard.ts`

**Business Rules:**
- **BR-A-022:** High-risk operations require re-authentication within the last 10 minutes. (Source: `re-auth-guard.ts`, `REAUTH_THRESHOLD_MS = 10 * 60 * 1000`)
- **BR-A-023:** Re-auth tokens are stored in Redis with a TTL matching the threshold (10 minutes). If Redis is unavailable, re-auth is always required. (Source: `re-auth-guard.ts` lines 33-36)
- **BR-A-024:** `verifyReAuthPassword()` is currently a **stub** -- accepts any non-empty password as valid. (Source: `re-auth-guard.ts` lines 93-98) **[STUBBED]**

#### 7.2.8 Related Auth Models

**accounts** (OAuth provider links):

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| id | String | Yes | PK | |
| userId | String | Yes | FK to User | |
| type | String | No | - | |
| provider | String | No | - | |
| providerAccountId | String | Yes | - | |
| refresh_token | String | No | - | |
| access_token | String | No | - | |
| expires_at | Int | No | - | |
| token_type | String | No | - | |
| scope | String | No | - | |
| id_token | String | No | - | |
| session_state | String | No | - | |

Unique constraint: `[provider, providerAccountId]`

**sessions** (NextAuth sessions):

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| id | String | Yes | PK | |
| sessionToken | String | Yes | @unique | |
| userId | String | Yes | FK to User | |
| expires | DateTime | Yes | - | |

**verification_token** (email verification):

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| identifier | String | Yes | - | |
| token | String | Yes | @unique | |
| expires | DateTime | Yes | - | |

Unique constraint: `[identifier, token]`

#### 7.2.9 User API Operations

| Operation | Source | Access | Notes |
|---|---|---|---|
| Search users globally | `users.service.ts#searchUsers` | SUPER_ADMIN | Filter by search, role; excludes demo users by default |
| Get user counts by role | `users.service.ts#getUserCountsByRole` | SUPER_ADMIN | Excludes demo users by default |
| Update user | `users.service.ts#updateUserFromSuperAdmin` | SUPER_ADMIN | Name, email, role, active; cannot assign SUPER_ADMIN role |
| Create user for tenant | `users.service.ts#createUserFromSuperAdmin` | SUPER_ADMIN | Includes capacity guard |
| Delete user (soft) | `users.service.ts#deleteUserFromSuperAdmin` | SUPER_ADMIN | Sets active = false |
| Verify credentials | `verifyCredentials.ts` | Unauthenticated | Login flow |
| Onboard user with temp password | `onboarding.service.ts` | SUPER_ADMIN, ADMIN | Creates user + sends welcome email |
| Delete user (admin) | Via `/api/admin/users/delete` | ADMIN, SUPER_ADMIN | Permission checks in canDeleteUser |

#### 7.2.10 User Gaps & Issues

- **[STUBBED]:** Re-authentication password verification is a stub (accepts any non-empty password). Must be implemented before production.
- **[PARTIAL]:** MFA is modeled in the schema (mfaEnabled, mfaSecret) but only has a warning log during login. No TOTP verification flow or MFA setup UI was found in the scanned code.
- **[PARTIAL]:** Password reset token model exists but the full reset flow (generate, email, validate, consume) was not found in the scanned server-side services.
- **[GAP]:** No password complexity validation for regular users. Only SUPER_ADMIN has password policy enforcement (12+ chars, mixed case, number, symbol).
- **[GAP]:** No account lockout after failed login attempts.
- **[GAP]:** No session invalidation mechanism beyond JWT expiry (8 hours).
- **[SHORTCUT]:** Demo user detection uses email pattern matching (@example.com) which is fragile.

---

#### 7.2.11 MFA Enforcement `[MUST-HAVE -- Added from completeness review M-11]`

**Requirement Source:** Security -- MFA is currently advisory only (warning log during login). Must enforce for admin roles to prevent account takeover.

**Current State in Document:** Section 7.2 documents MFA as `[STUBBED]` -- schema fields exist but no TOTP verification, no setup UI.

**Description:**
Enforce multi-factor authentication for ADMIN and SUPER_ADMIN roles. Implement TOTP-based MFA with setup flow, backup codes, and enforcement.

**Business Rules:**
- ADMIN and SUPER_ADMIN roles MUST have MFA enabled before accessing the system
- Grace period: new ADMIN users have 7 days to set up MFA before enforcement
- MFA methods supported: TOTP (Google Authenticator, Authy, etc.), backup codes (10 single-use codes)
- MFA setup flow: generate secret, display QR code, verify with 6-digit code, store verified secret
- Login flow with MFA: email/password -> MFA code prompt -> session created
- Backup codes: 10 single-use codes generated at MFA setup, can be regenerated (invalidates old ones)
- MFA can be reset by SUPER_ADMIN for a user (in case of lost device)
- STAFF role: MFA optional but recommended
- Per-tenant policy: tenants can enforce MFA for all users via tenant configuration

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| User.mfaEnabled | Boolean | Yes | Default false |
| User.mfaSecret | String | No | Encrypted TOTP secret |
| User.mfaBackupCodes | String[] | No | Hashed backup codes |
| User.mfaVerifiedAt | DateTime | No | When MFA was verified/setup |
| User.mfaGraceDeadline | DateTime | No | Deadline to set up MFA |

**API Operations Expected:**
- `POST /api/auth/mfa/setup` -- Generate MFA secret and QR code
- `POST /api/auth/mfa/verify` -- Verify TOTP code to complete setup
- `POST /api/auth/mfa/validate` -- Validate TOTP code during login
- `POST /api/auth/mfa/backup-codes` -- Generate new backup codes
- `POST /api/auth/mfa/reset/[userId]` -- Reset MFA for user (SUPER_ADMIN only)

---

#### 7.2.12 Password Policy Enforcement `[MUST-HAVE -- Added from completeness review M-12]`

**Requirement Source:** Security -- only SUPER_ADMIN has password policy. Regular users have none. All SaaS platforms enforce password complexity for all users.

**Current State in Document:** Section 7.8.2 documents SUPER_ADMIN password policy (12 chars, mixed case, number, special). No policy for other users.

**Description:**
Enforce password complexity requirements for all user roles, with configurable policy per tenant.

**Business Rules:**
- **Default policy (all users):** Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
- **ADMIN policy:** Minimum 10 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
- **SUPER_ADMIN policy:** Minimum 12 characters (existing policy, unchanged)
- Password history: cannot reuse last 5 passwords
- Password expiry: configurable per tenant (default: 90 days for ADMIN, no expiry for STAFF)
- Password change on first login (for temporary/assigned passwords)
- Common password check: reject passwords from a known weak password list
- Tenant-configurable: tenants can set stricter policies than defaults

---

#### 7.2.13 Account Lockout `[MUST-HAVE -- Added from completeness review M-13]`

**Requirement Source:** Security -- no lockout after failed login attempts. Brute force vulnerability. All SaaS platforms have this.

**Current State in Document:** Not documented at all -- no lockout mechanism exists.

**Description:**
Lock user accounts after consecutive failed login attempts to prevent brute force attacks.

**Business Rules:**
- Lock account after 5 consecutive failed login attempts
- Lockout duration: 30 minutes (auto-unlock)
- ADMIN/SUPER_ADMIN can manually unlock accounts immediately
- Failed attempt counter resets on successful login
- Track failed attempts: timestamp, IP address, user agent
- Notify user via email when account is locked
- Notify ADMIN when multiple accounts in tenant are locked (potential attack)
- Rate limiting on login endpoint: max 10 attempts per IP per minute (in addition to per-account lockout)

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| User.failedLoginAttempts | Int | Yes | Default 0 |
| User.lockedUntil | DateTime | No | Null if not locked |
| User.lastFailedLoginAt | DateTime | No | |
| User.lastFailedLoginIp | String | No | |

**API Operations Expected:**
- `POST /api/admin/users/[id]/unlock` -- Manually unlock user account (ADMIN+)
- Login endpoint must check lockout status before attempting authentication

---

#### 7.2.14 Re-Authentication (Real Implementation) `[MUST-HAVE -- Added from completeness review M-14]`

**Requirement Source:** Security -- current re-authentication accepts any non-empty password. Must verify actual password for high-risk operations.

**Current State in Document:** Section 7.2 documents re-authentication as `[STUBBED]` -- "Password verification is a STUB (accepts any non-empty password)".

**Description:**
Implement proper password verification for re-authentication when performing high-risk operations.

**Business Rules:**
- Re-authentication required for: changing email, changing password, viewing/exporting sensitive data, changing security settings, deleting entities, modifying billing
- Re-authentication window: 10 minutes (user does not need to re-authenticate again within window)
- Must verify actual password against stored bcrypt hash
- If MFA is enabled, require MFA code in addition to password for highest-risk operations
- Failed re-authentication attempts count toward account lockout

---

### 7.3 Roles & Permissions (RBAC)

#### 7.3.1 Role Hierarchy

**Source:** `apps/web/src/lib/rbac/matrix.ts`

| Role | Code | Level | Description |
|---|---|---|---|
| SUPER_ADMIN | SUPER_ADMIN | Platform | Platform-wide administration; no business module access |
| ADMIN | ADMIN | Tenant | Full tenant administration + all business modules |
| MANAGER | MANAGER | Tenant | Business module access with elevated permissions |
| STAFF | STAFF | Tenant | Standard business module access |
| VIEWER | VIEWER | Tenant | Read-only access; default for unknown roles |

**Role Normalization:**
- `normalizeRole()` maps input strings: `"SUPERADMIN"` / `"SUPER-ADMIN"` -> `SUPER_ADMIN`; `"USER"` -> `VIEWER`; unknown -> `VIEWER` (Source: `matrix.ts` lines 5-11) [CONTRADICTION-RESOLVED: CR-3 -- This is the canonical normalization. Unknown roles map to VIEWER (principle of least privilege).]
- A separate legacy `roles.ts` maps unknown roles to `STAFF` instead of `VIEWER`. **[GAP]** -- inconsistency between the two normalization functions. [CONTRADICTION-RESOLVED: CR-3 -- The `matrix.ts` version (unknown -> VIEWER) is canonical. The legacy `roles.ts` mapping (unknown -> STAFF) must be deprecated as STAFF has more permissions than VIEWER, violating least-privilege principle.]

#### 7.3.2 Permission Matrix

**Source:** `apps/web/src/lib/rbac/matrix.ts`

The system uses a flat permission key -> allowed roles mapping. Key permission categories:

**System Permissions (SUPER_ADMIN only):**
- `ui:superadmin:portal` -- Super Admin portal access
- `system:users:list`, `system:users:update`, `system:users:delete` -- Cross-tenant user management
- `system:impersonate` -- Act-as-user capability
- `tenant:users:list` -- Tenant user listing
- `billing:manage` -- Billing management
- `admin:role_change` -- Role change operations
- `ui:admin:users`, `ui:admin:rbac` -- Admin UI pages

**Business Module Permissions (ADMIN, MANAGER, STAFF, VIEWER subsets):**
- `finance:*` -- Create/edit/approve invoices, post journals, VAT submit, FA depreciation/disposal
- `inventory:*` -- View, manage, adjust, transfer, receive GRN, valuation
- `mfg:*` -- Consume BOM, cost rollup
- `hr:*` -- Payroll run
- `pos:*` -- Register, finalize sale
- `projects:*` -- Timesheet rollup, billing export
- `sales:*` -- Create order, invoice, manage
- `crm:*` -- Manage
- `banking:*` -- View, edit, admin
- `workflow:*` -- Manage
- `ai:use` -- AI operational use

**UI Route Permissions:**
- `ui:dashboard:view`, `ui:admin:view`, `ui:admin:manage`, `ui:admin:super`
- `ui:healthcare:view`, `ui:healthcare:admin`
- `ui:workflow:view`, `ui:workflow:admin`
- `ui:customfields:view`, `ui:customfields:admin`
- `ui:planning:view`, `ui:planning:admin`
- `ui:ai:admin`, `ui:ai:finance`, `ui:ai:inventory`, `ui:ai:planning`, `ui:ai:analytics`
- `ui:attachments:view`, `ui:attachments:edit`

#### 7.3.3 SUPER_ADMIN Isolation (Task K)

**Source:** `apps/web/src/lib/rbac/matrix.ts`, `apps/web/src/lib/rbac/route-guards.ts`, `apps/web/src/lib/rbac/business-module-guard.ts`, `apps/web/src/lib/auth/super-admin-restrictions.ts`

**Business Rules:**
- **BR-R-001:** SUPER_ADMIN is **denied** all business module permissions. `hasPermission("SUPER_ADMIN", "finance:create_invoice")` returns `false`. (Source: `matrix.ts#hasPermission` line 106-168)
- **BR-R-002:** SUPER_ADMIN is only granted explicit system-level permissions. For unknown permissions, access is denied by default. (Source: `matrix.ts` line 167)
- **BR-R-003:** SUPER_ADMIN is denied access to business module URL routes: `/finance`, `/inventory`, `/manufacturing`, `/hr`, `/sales`, `/crm`, `/purchasing`, `/supply`, `/projects`, `/pos`, `/ai/assistant`, `/ai/automation`, `/costing`, `/healthcare`. (Source: `route-guards.ts`)
- **BR-R-004:** Non-SUPER_ADMIN users are denied access to `/super-admin/**` routes. (Source: `route-guards.ts#shouldDenySuperAdminPortal`)
- **BR-R-005:** SUPER_ADMIN can access system-level routes: `/admin/integrations`, `/settings/modules`, `/admin/users`, `/admin/rbac`, `/admin/security`, `/admin/config`, `/dashboard`. (Source: `route-guards.ts`)
- **BR-R-006:** `denySuperAdminFromBusinessModule()` is a server-side page guard that redirects SUPER_ADMIN to `/super-admin/tenants?error=business_module_denied`. (Source: `business-module-guard.ts`)

#### 7.3.4 SUPER_ADMIN Operational Restrictions

**Source:** `apps/web/src/lib/auth/super-admin-restrictions.ts`

**Business Rules:**
- **BR-R-007:** SUPER_ADMIN is blocked from operational actions (finance:create_invoice, finance:post_invoice, finance:record_payment, inventory:create_po, inventory:receive_grn, sales:create_order, sales:fulfill_order) unless explicit test mode is enabled via `x-super-admin-test-mode` request header. (Source: `super-admin-restrictions.ts`)
- **BR-R-008:** Test mode must be explicitly set and is never auto-inferred from NODE_ENV or other environment variables.

#### 7.3.5 Module-Level Access Control

**Source:** `apps/web/src/lib/access/guard.ts`, `apps/web/src/lib/access/types.ts`, `apps/web/src/lib/access/tenantConfig.ts`

**Business Rules:**
- **BR-R-009:** Module access is checked at three levels: (1) SUPER_ADMIN isolation, (2) Tenant-level module toggle from TenantConfig, (3) User-level override from UserAccessConfig.
- **BR-R-010:** Default-enabled modules: finance, inventory, purchasing, manufacturing, sales, projects, pos. New modules (supply, planning, workflow, healthcare) must be explicitly enabled. (Source: `guard.ts` line 54)
- **BR-R-011:** Per-user module overrides can enable or disable specific modules and actions. Dimension scoping (warehouses, sites, costCenters) is supported but the `getUserAccessConfig()` function currently returns `null` (no user-specific overrides implemented). (Source: `types.ts` line 43-47) **[STUBBED]**

#### 7.3.6 Impersonation ("Act-As")

**Source:** `apps/web/src/lib/access/guard.ts`

**Business Rules:**
- **BR-R-012:** Impersonation is initiated via `x-act-as` HTTP header containing a target user ID.
- **BR-R-013:** Only users with `system:impersonate` permission (SUPER_ADMIN only) can impersonate any user. Other roles can only impersonate users within their own tenant.
- **BR-R-014:** The impersonated user's permissions replace the actor's for module access checks, but the original actor is logged for audit.

#### 7.3.7 Field-Level Visibility

**Source:** `apps/web/src/lib/security/field-visibility.ts`

Sensitive fields are redacted based on role:

| Entity Type | VIEWER Hidden | STAFF Hidden | MANAGER Hidden | ADMIN/SUPER_ADMIN Hidden |
|---|---|---|---|---|
| employee | salary, baseGrossMinor, address, nationalId, phone, email | salary, baseGrossMinor, nationalId | nationalId | (none) |
| payroll | baseGrossMinor, netPayMinor, deductions | baseGrossMinor, netPayMinor | (none) | (none) |
| healthcare | patientId, nhsNumber, clinicalNotes, diagnosis | nhsNumber, clinicalNotes, diagnosis | clinicalNotes, diagnosis | (none) |
| tenant | isHealthcare, pcnId, practiceCount, billingStatus, billingPlan | isHealthcare, pcnId, practiceCount, billingStatus, billingPlan | isHealthcare, pcnId, practiceCount | (none) |
| document | content, metadata | content | (none) | (none) |

Fields are masked with `"[REDACTED]"` rather than removed, maintaining API contract stability.

#### 7.3.8 RBAC Gaps & Issues

- **[GAP]:** Permissions are hardcoded in a static matrix. No database-backed dynamic permission assignment per user or custom role creation.
- **[GAP]:** No role hierarchy inheritance -- each permission must explicitly list all allowed roles.
- **[STUBBED]:** Per-user module access overrides (`getUserAccessConfig`) always returns null. The infrastructure exists but is not wired to any database storage.
- **[GAP]:** Inconsistent role normalization between `lib/rbac/matrix.ts` (unknown -> VIEWER) and `lib/auth/roles.ts` (unknown -> STAFF). [CONTRADICTION-RESOLVED: CR-3 -- canonical is VIEWER. See Section 7.3.1.]
- **[RECOMMEND]:** In the new architecture, implement a database-backed RBAC system with: Role table, Permission table, RolePermission junction, UserRole assignment per tenant. Allow tenants to create custom roles.

---

### 7.4 Billing & Subscriptions

#### 7.4.1 Billing Plan Catalog (Code-Defined)

**Source:** `apps/web/src/lib/billing/plans.ts`

| Plan Code | Label | Price/Month (GBP) | Modules Included |
|---|---|---|---|
| BASIC | Basic | 29 | finance, inventory, sales |
| STANDARD | Standard | 79 | finance, inventory, manufacturing, sales, crm, projects, pos |
| ADVANCED | Advanced | 149 | finance, inventory, manufacturing, sales, crm, projects, pos, hr, healthcare, planning |
| ENTERPRISE | Enterprise | 299 | finance, inventory, manufacturing, sales, crm, projects, pos, hr, healthcare, planning, workflow, customfields |
| DEMO | Demo | 0 | [] (all modules enabled for testing) |

**Business Rules:**
- **BR-B-001:** Plans catalog is stored in database (`TenantConfig.config.plansCatalog` on PLATFORM tenant). If database is unavailable, hardcoded `DEFAULT_PLANS` are used as fallback. (Source: `plans.ts`)
- **BR-B-002:** Super-admin billing pages always read plans from database (no in-memory cache) to ensure consistency across Vercel instances. (Source: `plans.ts#loadPlansCatalogAsync`)
- **BR-B-003:** Plans can be saved/updated via `savePlansCatalog()` which merges into existing PLATFORM tenant config, preserving other keys. (Source: `plans.ts#savePlansCatalog`)

#### 7.4.2 BillingPlanTemplate Entity (DB-Stored)

**Source:** `prisma/schema.prisma` (model `BillingPlanTemplate`, mapped to `billing_plan_templates`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| code | String | Yes | - | @unique | Plan code (e.g., STANDARD) |
| name | String | Yes | - | - | |
| description | String | No | - | - | |
| currency | String | Yes | - | - | |
| priceMonthly | Decimal(18,2) | No | - | - | |
| maxUsersTotal | Int | Yes | - | - | User capacity limit |
| features | Json | No | - | - | Module feature flags |
| isActive | Boolean | Yes | true | - | |
| sortOrder | Int | Yes | 0 | - | Display ordering |
| createdAt | DateTime | Yes | now() | - | |
| updatedAt | DateTime | Yes | @updatedAt | - | |

**Relations:** `tenants` -> Tenant[] (one-to-many via Tenant.billingPlanCode -> code)

**Business Rules:**
- **BR-B-004:** Plan template code is automatically uppercased on creation. (Source: `plan-templates.service.ts` line 44)
- **BR-B-005:** Plan validation: code required (on create), name required, currency required, maxUsersTotal must be > 0. (Source: `plan-templates.service.ts#validateInput`)
- **BR-B-006:** Plan templates can be cloned via `clonePlanTemplate()` which copies all properties with a new code. (Source: `plan-templates.service.ts`)
- **BR-B-007:** Plan listing includes count of tenants assigned to each plan. (Source: `plan-templates.service.ts#listPlanTemplates`)

#### 7.4.3 Effective Plan Resolution

**Source:** `apps/web/src/lib/billing/effectivePlan.ts`

**Business Rules:**
- **BR-B-008:** The effective plan is resolved by combining the BillingPlanTemplate with tenant-level overrides. Source hierarchy:
  1. `template` -- pure plan template values
  2. `template_with_overrides` -- plan template with tenant custom price/user cap
  3. `fallback` -- when no plan template matches (code: "FALLBACK", 2 users, no price)
- **BR-B-009:** `customPriceMonthly` on the Tenant overrides `priceMonthly` from the template.
- **BR-B-010:** `customMaxUsersTotal` on the Tenant overrides `maxUsersTotal` from the template.
- **BR-B-011:** Fallback plan allows only 2 users and no price -- this is the effective plan when no billing plan is configured. (Source: `effectivePlan.ts` line 15-23)

#### 7.4.4 Tenant Billing Config (JSON-stored)

**Source:** `apps/web/src/lib/billing/tenant-billing-config.ts`

Stored in `TenantConfig.config.billing` as JSON:
```typescript
{
  planCode: string;            // e.g. "STANDARD"
  customPricePerMonth?: number; // overrides plan price
  currency?: "GBP"|"USD"|"EUR"; // overrides plan currency
  modules?: {                   // per-module override
    [module: PlanFeatureModule]: boolean;
  }
}
```

**Business Rules:**
- **BR-B-012:** Module resolution: Start with plan's `modulesIncluded` (all set to true), then apply tenant overrides (explicit true/false). Undefined modules inherit from plan. (Source: `tenant-billing-config.ts#resolveEffectiveTenantBilling`)
- **BR-B-013:** Price resolution: tenant override > plan default. Currency resolution: tenant override > plan default. (Source: `tenant-billing-config.ts` lines 47-50)

#### 7.4.5 Billing Status Lifecycle

**Source:** `apps/web/src/lib/billing/enforcement.ts`, `apps/web/src/server/billing/status.ts`

```
[new] --> trial --> active --> past_due --> active (payment received)
                           --> cancelled
```

**Business Rules:**
- **BR-B-014:** Billing status enum values: `trial`, `active`, `past_due`, `cancelled`. (Source: `prisma/schema.prisma` BillingStatus enum)
- **BR-B-015:** `recomputeTenantBillingStatus()` checks subscription invoices (prefixed `SUBS-`) for overdue balances. If any invoice has a positive balance past its due date, status is set to `past_due`. Otherwise, status stays as current (trial stays trial, others become active). Cancelled tenants are never auto-changed. (Source: `status.ts`)
- **BR-B-016:** When `billingStatus = "past_due"` or `"cancelled"`, the system restricts access to all non-billing routes. Allowed paths: `/api/billing`, `/api/admin/billing`, `/settings/billing`, `/settings`, `/api/diag`. (Source: `enforcement.ts#isBillingRouteAllowed`)
- **BR-B-017:** `shouldRestrictHeavyActions()` returns true for `past_due` and `cancelled` statuses.
- **BR-B-018:** `isTenantLocked()` returns true only for `cancelled` status.
- **BR-B-019:** Default billing status for new tenants is `"trial"`. (Source: `tenants.service.ts` line 815)

#### 7.4.6 User Capacity Enforcement

**Source:** `apps/web/src/lib/billing/userCapacity.ts`

**Business Rules:**
- **BR-B-020:** Before creating a new user, `assertTenantUserCapacity()` checks if `currentActiveUsers >= effectivePlan.maxUsersTotal`. If limit reached, throws `USER_CAP_REACHED` with HTTP 409. (Source: `userCapacity.ts`)
- **BR-B-021:** Capacity check uses effective plan (includes tenant overrides for maxUsersTotal).
- **BR-B-022:** In test/mocked environments where Prisma tenant access is unavailable, capacity enforcement is skipped. (Source: `userCapacity.ts` lines 15-18) **[SHORTCUT]**

#### 7.4.7 Feature Gating (Plan-Based)

**Source:** `apps/web/src/lib/billing/requirePlanFeature.ts`, `apps/web/src/lib/billing/featureFlags.ts`

**Business Rules:**
- **BR-B-023:** `requirePlanFeature()` checks if a tenant's plan includes a specific feature module. If not included, throws HTTP 403 "This module is not included in your plan". (Source: `requirePlanFeature.ts`)
- **BR-B-024:** Feature resolution order: (1) TenantConfig.config.modules[feature] explicit toggle, (2) BillingPlanTemplate.features.modules[feature]. If neither enables it, access is denied. (Source: `featureFlags.ts#tenantHasFeatureByTenantId`)
- **BR-B-025:** In CI environments (test auth enabled), plan feature gating is bypassed entirely. (Source: `requirePlanFeature.ts` lines 13-19) **[SHORTCUT]**
- **BR-B-026:** For `hr` and `inventory` modules, TenantConfig is checked first before plan features. (Source: `requirePlanFeature.ts` lines 20-29)

#### 7.4.8 Subscription Entity

**Source:** `prisma/schema.prisma` (model `Subscription`, mapped to `subscriptions`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | FK to Tenant, indexed | |
| planId | String | Yes | - | FK to Plan | |
| status | String | Yes | - | Indexed | |
| currentPeriodStart | DateTime | Yes | - | - | |
| currentPeriodEnd | DateTime | Yes | - | - | |
| customerId | String | No | - | - | Stripe customer ID |
| trialEnd | DateTime | No | - | - | |
| cancelAt | DateTime | No | - | - | |
| createdAt | DateTime | Yes | now() | - | |
| updatedAt | DateTime | Yes | @updatedAt | - | |

**[PARTIAL]:** The Subscription model exists in the schema but the Tenant model's billing is primarily managed through direct fields (billingStatus, billingPlanCode, etc.) rather than through the Subscription entity. The Subscription model appears to be an older/alternate approach that is not the primary billing mechanism.

#### 7.4.9 Plan Entity (Legacy)

**Source:** `prisma/schema.prisma` (model `Plan`, mapped to `plans`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| code | String | Yes | - | @unique | |
| name | String | Yes | - | - | |
| tier | String | Yes | - | - | |
| active | Boolean | Yes | true | - | |

**[PARTIAL]:** This legacy Plan model is referenced by Subscription.planId but the primary billing system uses BillingPlanTemplate. Two parallel plan systems exist.

#### 7.4.10 Stripe Integration

**Source:** `apps/web/src/lib/stripe/client.ts`, `apps/web/src/lib/stripe/helpers.ts`

**Business Rules:**
- **BR-B-027:** Stripe client is initialized lazily using `STRIPE_SECRET_KEY` environment variable. If not configured, throws `"billing_disabled"`. (Source: `client.ts`)
- **BR-B-028:** Stripe API version is hardcoded to `"2023-10-16"`. App info: "Nexa ERP". (Source: `client.ts`)
- **BR-B-029:** `ensureCustomer()` creates a new Stripe customer for each call. **[SHORTCUT]** -- does not look up existing customers or persist the ID back to the Tenant. (Source: `helpers.ts` lines 4-15)
- **BR-B-030:** `createCheckoutSession()` creates a Stripe Checkout subscription session with correlationId and tenantId metadata.
- **BR-B-031:** `createPortalSession()` creates a Stripe Billing Portal session for self-service management.

**[PARTIAL]:** Stripe integration is skeletal. The helpers exist but there is no webhook handler for subscription lifecycle events (payment succeeded, subscription cancelled, etc.). The `ensureCustomer()` function does not persist the customer ID, making it unsuitable for production use.

#### 7.4.11 Invoice Entity (Platform Billing)

**Source:** `prisma/schema.prisma` (model `Invoice`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| total | Decimal | Yes | - | - | |
| status | String | Yes | - | - | |
| currencyCode | String | Yes | - | - | |
| dueAt | DateTime | Yes | - | - | |
| issuedAt | DateTime | Yes | - | - | |
| number | String | Yes | - | @unique | |
| pdfHash | String | Yes | - | - | |
| tenantId | String | Yes | - | Indexed | |

**[STUBBED]:** The Invoice model exists but no service code for generating platform billing invoices was found. Billing status computation uses `CustomerInvoice` (tenant AR invoices with `SUBS-` prefix) rather than this Invoice model.

#### 7.4.12 UsageEvent Entity

**Source:** `prisma/schema.prisma` (model `UsageEvent`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | Indexed | |
| type | String | Yes | - | - | e.g., "ai.query" |
| quantity | Int | Yes | - | - | |
| at | DateTime | Yes | - | - | |
| metadata | Json | Yes | - | - | |

Used for AI usage tracking. Queried by `ai-usage.service.ts` with `type = "ai.query"`.

#### 7.4.13 BillingPlan Entity (Alternate)

**Source:** `prisma/schema.prisma` (model `BillingPlan`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| code | String | Yes | - | @unique | |
| name | String | Yes | - | - | |
| currency | String | Yes | - | - | |
| unitPriceMinor | Int | Yes | - | - | Price in minor units (pence/cents) |
| isActive | Boolean | Yes | true | - | |
| createdAt | DateTime | Yes | now() | - | |
| updatedAt | DateTime | Yes | @updatedAt | - | |

**[GAP]:** This is yet another plan model. Three separate plan-related models exist: `Plan`, `BillingPlan`, and `BillingPlanTemplate`. Only `BillingPlanTemplate` is actively used by the billing system. The others are legacy/unused. [CONTRADICTION-RESOLVED: CR-16 -- `BillingPlanTemplate` is the canonical plan model. `Plan` (legacy, referenced by Subscription.planId) and `BillingPlan` (alternate, unused) should be deprecated and removed in new project.]

#### 7.4.14 Billing Summary (Super Admin)

**Source:** `apps/web/src/server/super-admin/billing.service.ts`

**Business Rules:**
- **BR-B-032:** MRR (Monthly Recurring Revenue) is computed by summing effective plan `priceMonthly` for all tenants with billingStatus in (trial, trialing, active, past_due). Cancelled tenants are excluded from MRR. (Source: `billing.service.ts`)
- **BR-B-033:** Billing summary provides counts by status: active, trial, past_due, cancelled.

#### 7.4.15 Billing Gaps & Issues

- **[GAP]:** Three separate plan models exist (Plan, BillingPlan, BillingPlanTemplate). Only BillingPlanTemplate is actively used. The others should be removed or consolidated.
- **[PARTIAL]:** Stripe integration is skeletal -- no webhook handlers, no customer ID persistence, no subscription lifecycle management.
- **[STUBBED]:** Platform Invoice model exists but has no generation/management service code.
- **[GAP]:** No usage-based billing calculation beyond AI query counting.
- **[GAP]:** No billing history/invoice history for tenants.
- **[SHORTCUT]:** `nextBillingDate` is computed as 30 days from creation for trial/active tenants, but no billing cycle processing exists.
- **[RECOMMEND]:** In the new architecture, the management database should have: Plan, PlanFeature, Subscription (with Stripe sync), BillingInvoice, PaymentRecord, UsageRecord tables. Stripe webhook processing should handle subscription.updated, invoice.paid, customer.subscription.deleted events.

---

### 7.5 Module Licensing

#### 7.5.1 Module Feature Definitions

**Source:** `apps/web/src/lib/billing/plans.ts`

Available modules (PlanFeatureModule):
- `finance`, `inventory`, `manufacturing`, `projects`, `pos`, `crm`, `purchasing`, `healthcare`
- `chat`, `calls`, `dms` (communication modules)
- `ai_core`, `ai_autopilot` (AI modules)
- `sales`, `hr`, `planning`, `workflow`, `customfields`

#### 7.5.2 Module Access Resolution

**Business Rules:**
- **BR-M-001:** Module access is determined by the combination of: (1) Plan-included modules, (2) Tenant-level overrides in TenantConfig.config.billing.modules, (3) Tenant-level toggles in TenantConfig.config.modules, (4) User-level overrides (not yet implemented).
- **BR-M-002:** A module is accessible if: plan includes it OR tenant explicitly enables it. A module is inaccessible if: plan excludes it AND tenant does not explicitly enable it, OR tenant explicitly disables it (even if plan includes it).
- **BR-M-003:** Default plan features for templates include: finance, inventory, manufacturing, projects, pos, chat, calls, dms. (Source: `planFeatures.ts#DEFAULT_PLAN_FEATURES`)

#### 7.5.3 Tenant Module Configuration

**Source:** `apps/web/src/lib/access/tenantConfig.ts`

Module configuration is stored as `TenantConfig.config.modules`:
```json
{
  "finance": { "enabled": true },
  "inventory": { "enabled": true },
  "hr": { "enabled": false }
}
```

**Business Rules:**
- **BR-M-004:** `getTenantConfig()` reads module flags from TenantConfig. If no config exists, returns empty (all modules default to enabled for legacy modules). (Source: `tenantConfig.ts`)
- **BR-M-005:** `setTenantConfig()` merges with existing config to avoid wiping other sections (e.g., HR meta). (Source: `tenantConfig.ts`)
- **BR-M-006:** When creating a new tenant, default modules are set: finance, inventory, manufacturing, sales, projects, pos all enabled. (Source: `tenants.service.ts` lines 791-798)

#### 7.5.4 Module Licensing Gaps

- **[GAP]:** No dedicated ModuleLicense entity in the schema. Module licensing is entirely managed through JSON fields in TenantConfig and BillingPlanTemplate.features.
- **[GAP]:** No module usage tracking or per-module billing.
- **[RECOMMEND]:** Create a `TenantModule` junction table: tenantId, moduleCode, enabled, enabledAt, source (plan/override). This enables proper audit trail for module activation/deactivation.

---

### 7.6 API Keys & Developer Portal

#### 7.6.1 ApiKey Entity

**Source:** `prisma/schema.prisma` (model `ApiKey`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | Indexed | |
| label | String | Yes | - | - | Human-readable label |
| status | String | Yes | - | - | active, revoked, etc. |
| lastUsedAt | DateTime | No | - | - | Last usage timestamp |
| rateLimitPerMin | Int | Yes | - | - | Rate limit per minute |
| burst | Int | Yes | - | - | Burst limit |
| ipAllowlist | Json | Yes | - | - | IP whitelist as JSON |
| secretHash | String | Yes | - | - | Hashed API secret |

**[STUBBED]:** The ApiKey model exists in the schema but no service code for API key management (creation, validation, revocation, rate limiting) was found in the scanned directories. No DevPortal API directory exists (`apps/api/src/devportal/` returned no files). No Marketplace API exists (`apps/api/src/marketplace/` returned no files). No billing API exists (`apps/api/src/billing/` returned no files).

#### 7.6.2 WebhookEndpoint Entity

**Source:** `prisma/schema.prisma` (model `WebhookEndpoint`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | Indexed | |
| url | String | Yes | - | - | Webhook delivery URL |
| secretHash | String | Yes | - | - | Webhook signing secret hash |
| active | Boolean | Yes | true | - | |

**[STUBBED]:** Schema exists but no webhook management service code was found.

#### 7.6.3 WebhookEvent Entity

**Source:** `prisma/schema.prisma` (model `WebhookEvent`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| endpointId | String | Yes | - | - | |
| eventType | String | Yes | - | - | |
| deliveredAt | DateTime | No | - | - | |
| status | String | Yes | - | - | |
| payload | Json | Yes | - | - | |
| source | WebhookSource? | No | - | Enum | stripe, open_banking, hmrc |
| eventId | String | No | - | - | |
| receivedAt | DateTime | No | - | - | |
| tenantId | String | Yes | - | Indexed | |

**[STUBBED]:** Schema exists but no webhook event processing service code was found.

#### 7.6.4 API Key & Developer Portal Gaps

- **[MISSING]:** No API key CRUD service functions
- **[MISSING]:** No API key validation middleware
- **[MISSING]:** No rate limiting implementation using ApiKey.rateLimitPerMin/burst (the in-memory rate limiter in `ratelimit.ts` is a simple token bucket, not connected to ApiKey model)
- **[MISSING]:** No developer portal API (`apps/api/src/devportal/` is empty)
- **[MISSING]:** No marketplace API (`apps/api/src/marketplace/` is empty)
- **[MISSING]:** No webhook delivery system
- **[RECOMMEND]:** These are critical for multi-tenant SaaS. Implement: ApiKeyService (create, rotate, revoke, validate), WebhookService (register, deliver with retry, event logging), RateLimitMiddleware (per-key limits using Redis).

---

### 7.7 Audit Logging

#### 7.7.1 AuditLog Entity

**Source:** `prisma/schema.prisma` (model `AuditLog`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | Indexed | |
| actorId | String | Yes | - | - | User who performed the action |
| action | String | Yes | - | - | Action identifier |
| target | String | Yes | - | - | Target entity/resource |
| at | DateTime | Yes | - | - | Timestamp |
| data | Json | Yes | - | - | Additional context |

#### 7.7.2 Audit Event Types

**SUPER_ADMIN Actions** (Source: `super-admin-audit.ts`):
- `superAdmin.created` -- SUPER_ADMIN account created
- `superAdmin.removed` -- SUPER_ADMIN account removed
- `superAdmin.promotedUser` -- User promoted to SUPER_ADMIN
- `superAdmin.demotedUser` -- User demoted from SUPER_ADMIN
- `superAdmin.impersonate` -- SUPER_ADMIN impersonated another user
- `superAdmin.largeExport` -- Large data export by SUPER_ADMIN
- `superAdmin.configChange` -- Configuration change by SUPER_ADMIN

**Configuration Changes** (Source: `config-audit.ts`):
- `config.change` -- High-risk configuration changes (tax rates, healthcare mode, region, currency, timezone, account types, AI settings, chart of accounts)

**Sensitive Reads** (Source: `sensitive-read-logging.ts`):
- `sensitive.read` -- Access to sensitive data (employee PII, payroll, healthcare, documents)

**AI Usage:**
- `ai.query.executed` -- AI query execution (used for usage analytics)

**Business Rules:**
- **BR-AU-001:** SUPER_ADMIN audit events include a `breakGlass` flag indicating if the action was performed by a break-glass emergency account (identified by email pattern: break-glass, emergency, emergency-admin). (Source: `super-admin-audit.ts`)
- **BR-AU-002:** Break-glass actions are logged at `warn` level; normal SUPER_ADMIN actions at `info` level. (Source: `super-admin-audit.ts` line 45-46)
- **BR-AU-003:** All audit logging is best-effort -- logging failures do not block the primary operation. (Source: `super-admin-audit.ts` line 53-56, `config-audit.ts` line 49-52, `sensitive-read-logging.ts` line 38-41)
- **BR-AU-004:** Configuration change audit captures: userId, tenantId, entityType, entityId, field, previousValue, newValue, origin (UI/API). (Source: `config-audit.ts`)
- **BR-AU-005:** Sensitive read audit captures: userId, tenantId, entityType, entityId, source (UI/API/chat/DMS). (Source: `sensitive-read-logging.ts`)

#### 7.7.3 SIEM Export

**Source:** `prisma/schema.prisma` (model `SiemExportBatch`)

| Field | Type | Required | Default | Constraints | Notes |
|---|---|---|---|---|---|
| id | String | Yes | cuid() | PK | |
| tenantId | String | Yes | - | Indexed | |
| createdAt | DateTime | Yes | now() | - | |
| filePath | String | Yes | - | - | Export file path |
| recordCount | Int | Yes | - | - | |
| sha256 | String | Yes | - | - | Integrity hash |

**[STUBBED]:** Schema exists but no SIEM export service code was found.

#### 7.7.4 Audit Logging Gaps

- **[GAP]:** No audit log retention/archival policy
- **[GAP]:** No audit log search/query API for tenants
- **[STUBBED]:** SIEM export model exists but no export service
- **[GAP]:** No audit log for user login/logout events
- **[GAP]:** No audit log for data modification events (CRUD on business entities)
- **[RECOMMEND]:** In the new architecture, audit logs should be append-only with configurable retention. Consider separate audit database or event streaming (e.g., to S3/CloudWatch).

---

### 7.8 Super Admin Functions

#### 7.8.1 Super Admin Dashboard

**Source:** `apps/web/src/server/super-admin/dashboard.service.ts`

Provides platform-wide statistics:
- Total tenants (excluding demo by default)
- Total active users
- Setup-incomplete tenants (with top 5 list)
- Billing-issue tenants (non-active billing status, top 5 list)
- Billing breakdown: active, trial, past_due, cancelled
- MRR (from billing.service.ts)

#### 7.8.2 Super Admin Security Policies

**Source:** `apps/web/src/lib/security/super-admin-policies.ts`

**Business Rules:**
- **BR-SA-001:** Maximum SUPER_ADMIN count is capped at 3. `checkSuperAdminCountLimit()` returns `allowed: false` when limit would be exceeded. (Source: `super-admin-policies.ts` line 9, 68-81)
- **BR-SA-002:** SUPER_ADMIN password must be at least 12 characters with mixed case, number, and special character. (Source: `super-admin-policies.ts#validateSuperAdminPassword`)
- **BR-SA-003:** MFA is recommended for SUPER_ADMIN. `requireMFAForSuperAdmin()` returns `requiresMFA: true` if user is SUPER_ADMIN and MFA is not enabled. (Source: `super-admin-policies.ts` lines 15-29) **[PARTIAL]** -- advisory only, not enforced.
- **BR-SA-004:** Self-promotion to SUPER_ADMIN is detected and can be prevented. `isSelfPromotion()` returns true when actorId === targetUserId and targetRole === SUPER_ADMIN. (Source: `super-admin-policies.ts` lines 87-89)
- **BR-SA-005:** SUPER_ADMIN role cannot be assigned via the standard user management `updateUserFromSuperAdmin()` function. It throws "Cannot assign SUPER_ADMIN role via user management". (Source: `users.service.ts` lines 170-173)
- **BR-SA-006:** Break-glass SUPER_ADMIN accounts are identified by email pattern (break-glass, emergency, emergency-admin). Their actions are flagged in audit logs. (Source: `super-admin-policies.ts#isBreakGlassAccount`)

#### 7.8.3 Compliance Management

**Source:** `apps/web/src/server/super-admin/compliance.service.ts`

**Operations:**
- `getComplianceConfig(tenantId)` -- Read compliance config from TenantConfig.config.compliance
- `updateComplianceConfig(tenantId, config)` -- Update compliance config
- `getComplianceSummaryStats()` -- Aggregate tenants by compliance region
- `runComplianceCheck(tenantId)` -- Non-destructive check, stores result in TenantConfig (last 10 kept)
- `exportComplianceSnapshot(tenantId)` -- Creates JSON snapshot, stores in TenantConfig (last 5 kept)

**ComplianceConfig fields:** region, dataResidency, retentionProfile, exportAllowed, gdprCompliant

**Business Rules:**
- **BR-SA-007:** Region resolution for compliance stats: TenantConfig.config.compliance.region -> TenantConfig.region -> Tenant.region -> "Not specified". (Source: `compliance.service.ts`)
- **BR-SA-008:** Compliance checks are non-destructive and append-only. Only the last 10 checks and last 5 snapshots are retained. (Source: `compliance.service.ts`)

**[PARTIAL]:** Compliance check is a no-op that just logs and stores a record. No actual compliance validation logic exists.

#### 7.8.4 Integrations Management

**Source:** `apps/web/src/server/super-admin/integrations.service.ts`

**Built-in Integration Status Checks:**
| Integration | Key | Check | Notes |
|---|---|---|---|
| Stripe Billing | stripe_billing | STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY | Payment processing |
| SMTP Email | smtp_email | SMTP_HOST + SMTP_USER + SMTP_PASS | Email delivery |
| OpenAI | openai | OPENAI_API_KEY | AI Engine |
| Sentry | sentry | SENTRY_DSN | Error tracking |
| Redis | redis | REDIS_URL | Caching/sessions |
| Google OAuth | google_oauth | GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET | SSO |
| Azure AD | azure_ad | MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET | SSO |
| Database | database | DATABASE_URL | Primary database |

**Business Rules:**
- **BR-SA-009:** Integration status is derived from environment variable presence. No secrets are returned to the frontend. (Source: `integrations.service.ts`)
- **BR-SA-010:** Integration metadata (display name, category, notes, visibility) is stored as editable entries in TenantConfig on the PLATFORM tenant. Status checks (env-driven) are merged with editable metadata. (Source: `integrations.service.ts#getIntegrationsStatusWithMetadata`)
- **BR-SA-011:** A platform tenant (code: "PLATFORM") is auto-created via upsert when needed to store platform-level configs. (Source: `integrations.service.ts#getOrCreatePlatformTenant`)

#### 7.8.5 AI Configuration

**Source:** `apps/web/src/server/super-admin/ai-config.service.ts`

Per-role AI configuration:

| Setting | SUPER_ADMIN Default | ADMIN Default | STAFF Default |
|---|---|---|---|
| allowExecution | true | true | false |
| requireConfirmation | false | true | true |
| verbosity | normal | normal | low |
| systemPrompt | Platform-focused | Tenant-focused | Navigation-focused |

**Business Rules:**
- **BR-SA-012:** AI config is stored globally in the PLATFORM tenant's TenantConfig.config.aiConfig. (Source: `ai-config.service.ts`)
- **BR-SA-013:** SUPER_ADMIN AI assistant is scoped to platform operations (tenants, users, billing, integrations). It is explicitly instructed not to reference business modules.
- **BR-SA-014:** ADMIN AI assistant is scoped to single-tenant operations. It is instructed not to reference Super Admin routes.
- **BR-SA-015:** STAFF AI assistant provides navigation guidance only. It cannot execute actions and must not reference admin screens.

#### 7.8.6 AI Usage Analytics

**Source:** `apps/web/src/server/super-admin/ai-usage.service.ts`

**Business Rules:**
- **BR-SA-016:** AI usage is tracked via UsageEvent (type: "ai.query") or AuditLog (action: "ai.query.executed") as fallback. (Source: `ai-usage.service.ts`)
- **BR-SA-017:** Usage can be queried by window (7d, 30d, all) and optionally filtered by tenantId.
- **BR-SA-018:** Usage summary provides breakdowns by tenant, by role, and by day.
- **BR-SA-019:** Demo tenants and demo users are excluded from AI usage statistics. (Source: `ai-usage.service.ts`)
- **BR-SA-020:** Top users by AI usage are ranked by request count, with demo users excluded.

#### 7.8.7 Operational Runbooks

**Source:** `apps/web/src/server/super-admin/ops.service.ts`

Runbooks are stored in the NEXA_ROOT tenant's TenantConfig.config.runbooks.

**Default Runbooks:**
1. "How to onboard a new tenant" (7 steps)
2. "How to update a billing plan" (6 steps)
3. "How to run a compliance check" (6 steps)

**Operations:** List, create, update runbooks. Each runbook has: title, description, steps[], category.

#### 7.8.8 Backup & DR Models

**Source:** `prisma/schema.prisma`

**BackupJob:**
| Field | Type | Required | Notes |
|---|---|---|---|
| id | String | Yes | PK |
| tenantId | String | Yes | Indexed |
| ranAt | DateTime | Yes | |
| ok | Boolean | Yes | |
| summary | String | Yes | |

**DrDrill:**
| Field | Type | Required | Notes |
|---|---|---|---|
| id | String | Yes | PK |
| tenantId | String | Yes | Indexed |
| ranAt | DateTime | Yes | |
| ok | Boolean | Yes | |
| restoredCounts | Json | Yes | |
| notes | String | No | |

**[STUBBED]:** Both models exist in schema but no backup/DR service code was found.

#### 7.8.9 Demo Data Visibility

**Source:** `prisma/schema.prisma` (model `DemoDataVisibility`)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String | Yes | PK |
| tenantId | String | Yes | Indexed |
| adminUserId | String | Yes | |
| visibleUntil | DateTime | Yes | |
| maskLevel | Int | Yes | |

**[STUBBED]:** Schema exists but no service code for demo data visibility management was found.

#### 7.8.10 Security Infrastructure

**Rate Limiting:**
**Source:** `apps/web/src/lib/security/ratelimit.ts`

Simple in-memory token bucket rate limiter with configurable windows (1m, 5m, 1h). **[SHORTCUT]** -- in-memory only, not shared across server instances. Not connected to ApiKey rate limits.

**Security Headers:**
**Source:** `apps/web/src/lib/security/headers.ts`

Applied via middleware to all non-static routes:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; etc.
- Strict-Transport-Security: max-age=31536000; includeSubDomains

**Tenant Encryption Keys:**
**Source:** `prisma/schema.prisma` (model `tenant_keys`)

| Field | Type | Required | Notes |
|---|---|---|---|
| tenant_id | String | Yes | PK |
| enc_key | Bytes | Yes | Encrypted key material |
| alg | String | Yes | Default: AES-256-GCM |
| version | Int | Yes | Default: 1 |
| rotated_at | DateTime | No | |
| created_at | DateTime | No | |

**[STUBBED]:** The tenant encryption key model exists but no key management, rotation, or BYOK service code was found.

**Production Write Guard:**
**Source:** `apps/web/src/server/verification/prodTestGuard.ts`

- `assertProdWriteAllowed()` restricts write operations in production to a specific test tenant (identified by `PROD_TEST_TENANT_SLUG` env var). Only enabled when `PROD_SMOKE_WRITE=1`.

#### 7.8.11 Notification Model

**Source:** `prisma/schema.prisma` (model `Notification`)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String | Yes | PK |
| tenantId | String | Yes | Indexed |
| type | String | Yes | |
| body | String | Yes | |
| readAt | DateTime | No | |

**[STUBBED]:** Schema exists but no notification service code was found in the scanned directories.

#### 7.8.12 Super Admin Gaps & Issues

- **[PARTIAL]:** MFA enforcement for SUPER_ADMIN is advisory only -- login is allowed without MFA with a warning log.
- **[PARTIAL]:** Compliance checking is a no-op that just records a timestamp. No actual validation logic.
- **[STUBBED]:** Backup/DR, SIEM export, notification, demo data visibility, and tenant encryption key management models exist in schema but have no service implementations.
- **[SHORTCUT]:** Rate limiting is in-memory only, not suitable for multi-instance deployments.
- **[GAP]:** No tenant suspension/unsuspension workflow in super-admin services.
- **[GAP]:** No bulk operations (e.g., bulk email tenants, bulk update plans).
- **[RECOMMEND]:** For the new architecture, implement proper MFA enforcement, backup scheduling, key management (AWS KMS / Azure Key Vault integration), and push notifications.

---

### 7.9 Platform Special Tenants

The system uses two special tenant codes for platform-level configuration storage:

| Tenant Code | Purpose | Used By |
|---|---|---|
| `PLATFORM` | Stores platform config: plans catalog, AI config, integration metadata | plans.ts, ai-config.service.ts, integrations.service.ts |
| `NEXA_ROOT` | Stores operational runbooks | ops.service.ts |

**Business Rules:**
- **BR-P-001:** The PLATFORM tenant is auto-created via upsert when needed. It is always set to `status: "active"`. (Source: `plans.ts`, `integrations.service.ts`)
- **BR-P-002:** Platform/root tenants cannot be updated via the standard super-admin update function (guarded by code check). (Source: `tenants.service.ts` line 918-919)

**[GAP]:** Two separate special tenants are used inconsistently. PLATFORM stores most configs, but NEXA_ROOT stores runbooks. This should be consolidated. **[RECOMMEND]:** In the new architecture, platform-level configuration should be stored in a dedicated `PlatformConfig` table rather than hijacking the tenant model. [CONTRADICTION-RESOLVED: IT-11, XR-9 -- Consolidate to single `PLATFORM` tenant or dedicated `PlatformConfig` table. `NEXA_ROOT` is used only for runbooks and should be merged into `PLATFORM`.]

---

### 7.10 Data Isolation & Multi-Tenancy Architecture

#### 7.10.1 Current Architecture

The current system uses a **shared-database, shared-schema** architecture with `tenantId` columns on most tables for row-level data isolation.

**Business Rules:**
- **BR-MT-001:** Every data query must include `tenantId` in the WHERE clause to ensure tenant isolation. This is enforced at the application level, not at the database level. **[GAP]** -- no Row-Level Security (RLS) policies.
- **BR-MT-002:** `assertTenantScope()` verifies that the requesting user's tenant matches the data being accessed. Cross-tenant access is forbidden in production. (Source: `tenant.server.ts`)
- **BR-MT-003:** SUPER_ADMIN can impersonate users across tenants via `x-act-as` header, but requires `system:impersonate` permission. (Source: `guard.ts`)

#### 7.10.2 Recommendations for Database-Per-Tenant Migration

Based on the analysis, the following entities belong in the **management database** (shared across all tenants):

**Core Management Tables:**
1. **Tenant** -- tenant metadata, status, region, vertical, healthcare flags
2. **User** -- user directory (for authentication; business user profiles in tenant DBs)
3. **Plan** -- billing plan definitions
4. **TenantPlan** -- tenant-to-plan assignment with overrides
5. **Subscription** -- Stripe subscription tracking
6. **BillingInvoice** -- platform billing invoices
7. **PaymentRecord** -- payment history
8. **UsageEvent** -- metered usage for billing
9. **ApiKey** -- API key management
10. **WebhookEndpoint** -- webhook configuration
11. **AuditLog** -- platform-level audit events
12. **PlatformConfig** -- AI config, integration config, runbooks
13. **TenantModule** -- module licensing per tenant

**Tables that should move to tenant databases:**
- All business entities (GL, AR, AP, Inventory, Manufacturing, Sales, Projects, etc.)
- TenantConfig (per-tenant config should live in tenant DB)
- UserPreference (per-user prefs within tenant context)
- Notification (per-tenant notifications)

**Shared reference data (read replicas or shared DB):**
- Currency, Timezone, FxRate, CoaTemplate

---

#### 7.10.3 Row-Level Security (RLS) for Database-Per-Tenant `[MUST-HAVE -- Added from completeness review M-10]`

**Requirement Source:** Security / data integrity -- application-layer only tenant isolation means a single coding error could expose cross-tenant data. PostgreSQL RLS policies are required as defense-in-depth.

**Current State in Document:** Section 7.10.1 documents application-layer isolation only with `[GAP] no Row-Level Security (RLS) policies`.

**Description:**
Implement PostgreSQL Row-Level Security policies as defense-in-depth alongside the database-per-tenant architecture. Even in a database-per-tenant model, RLS provides an additional safety layer.

**Business Rules:**
- Every table with a `tenantId` column must have an RLS policy
- RLS policy must enforce that queries can only access rows matching the session's tenant context
- PostgreSQL session variable `app.current_tenant_id` set at connection time from authentication context
- RLS policies must be enabled by default on all new tables
- SUPER_ADMIN queries across tenants must use a designated bypass role (not disabling RLS)
- Migration tooling must verify RLS policies are in place for all tenant-scoped tables
- Automated tests must verify cross-tenant data leakage is impossible

**Implementation Notes:**
```sql
-- Example RLS policy
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant_id'));
```

**Competitor Reference:** PostgreSQL RLS is the industry standard for multi-tenant SaaS data isolation. All modern multi-tenant platforms implement this as defense-in-depth.

---

### 7.11 GDPR Data Subject Request Handling `[MUST-HAVE -- Added from completeness review M-8]`

**Requirement Source:** UK law (UK GDPR / Data Protection Act 2018) -- must support data access requests, right to erasure, and data portability. No mechanism currently exists to locate, export, or delete personal data across all modules.

**Description:**
Implement a comprehensive GDPR data subject rights system that can locate, export, and (where legally permitted) delete personal data across all modules.

**Business Rules:**
- **Right of Access (SAR - Subject Access Request):**
  - Locate all personal data for a given individual across all modules (Customer, Supplier, Employee, CRM Contact, User)
  - Generate a complete data export in machine-readable format (JSON/CSV)
  - Must respond within 1 calendar month (30 days)
  - Must include: all stored data, purposes of processing, categories of data, recipients, retention periods
- **Right to Erasure (Right to be Forgotten):**
  - Delete or anonymise personal data when requested
  - Cannot delete data required for legal compliance (e.g., invoice data for 6+ years per UK tax law, employment records for pension purposes)
  - Must anonymise rather than delete where legal retention applies (replace PII with anonymised placeholders)
  - Must cascade across all modules (anonymise customer name, email, phone, address across invoices, payments, CRM records)
- **Right to Data Portability:**
  - Export personal data in structured, machine-readable format (JSON, CSV)
  - Must include all data the individual has provided
- **Consent Management:**
  - Track consent for data processing per purpose
  - Track when consent was given/withdrawn
  - Allow individuals to withdraw consent
- **Data Retention:**
  - Configurable retention periods per data type
  - Automated archival/deletion when retention period expires
  - UK tax records: 6 years minimum
  - Employment records: varies by type (payroll 6 years, accident records 3 years, pension records indefinitely)

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| requestType | Enum | Yes | access, erasure, portability, rectification |
| subjectType | Enum | Yes | customer, employee, contact, user |
| subjectId | String | Yes | ID of the data subject |
| subjectEmail | String | No | For identification |
| status | Enum | Yes | received, in_progress, completed, rejected |
| requestedAt | DateTime | Yes | |
| dueBy | DateTime | Yes | 30 days from request |
| completedAt | DateTime | No | |
| completedBy | String | No | |
| notes | String | No | |
| exportUrl | String | No | Link to data export file |
| createdAt | DateTime | Auto | |

**API Operations Expected:**
- `POST /api/gdpr/requests` -- Create data subject request
- `GET /api/gdpr/requests` -- List GDPR requests (filterable by status, type)
- `GET /api/gdpr/requests/[id]` -- Get request detail
- `POST /api/gdpr/requests/[id]/process` -- Process request (generate export or perform erasure)
- `GET /api/gdpr/requests/[id]/export` -- Download data export
- `GET /api/gdpr/data-map` -- View data map showing where personal data is stored across modules

**UK Compliance Notes:**
- UK GDPR (retained EU GDPR post-Brexit) requires response within 30 days
- Complex requests can be extended by 2 months with notification to the individual
- Cannot charge a fee unless request is manifestly unfounded or excessive
- Must verify identity of requester before disclosing data
- ICO (Information Commissioner's Office) can issue fines for non-compliance

---

### 7.12 GDPR Data Retention Policies `[MUST-HAVE -- Added from completeness review M-9]`

**Requirement Source:** UK GDPR compliance -- must have configurable retention periods for different data types with automated archival/deletion.

**Description:**
Configurable data retention policies that automatically archive or delete data when retention periods expire.

**Business Rules:**
- Default retention periods by UK law:
  - Tax records (invoices, bills, GL): 6 years from end of tax year
  - Payroll records: 6 years after end of tax year
  - Employee records: 6 years after employment ends
  - Pension records: indefinite
  - Accident/injury records: 3 years
  - Audit logs: configurable (default 2 years)
  - CRM data: configurable (default: until erasure requested)
- Automated monthly job to identify data past retention period
- Options: archive (move to cold storage) or anonymise (for data that must be retained in anonymised form)
- Cannot delete data that has legal holds or active GDPR requests
- Retention policy configurable per tenant
- Audit trail of all retention actions

**Expected Entities/Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (CUID) | Auto | |
| tenantId | String | Yes | |
| dataCategory | String | Yes | e.g., "invoices", "employees", "audit_logs" |
| retentionDays | Int | Yes | Retention period in days |
| action | Enum | Yes | archive, anonymise, delete |
| lastRunAt | DateTime | No | |
| nextRunAt | DateTime | No | |
| active | Boolean | Yes | Default true |

---

# Section 8: Gaps & Recommendations Summary

This section consolidates every flagged item (`[SCHEMA-GAP]`, `[MISSING]`, `[STUBBED]`, `[PARTIAL]`, `[SHORTCUT]`, `[GAP]`, `[FRONTEND-GAP]`, `[RECOMMEND]`) from Sections 1 through 7 of the Nexa ERP Business Rules & Requirements document. Each item includes its source section reference for traceability.

---

## 8.1 Schema Gaps

Items where the database schema is missing fields needed for proper implementation.

### 8.1.1 Invoicing & Accounts (Section 1)

| # | Source | Entity | Missing Fields / Issue |
|---|--------|--------|----------------------|
| SG-1 | Section 1.1.1 | Customer | Address is a single text field. Needs structured address: line1, line2, city, county, postcode, country. Essential for invoice printing and HMRC compliance. |
| SG-2 | Section 1.1.1 | Customer | No VAT registration number field. Required for UK VAT invoicing. |
| SG-3 | Section 1.1.1 | Customer | No trading name (legal name vs display name). |
| SG-4 | Section 1.1.1 | Customer | No credit limit field. |
| SG-5 | Section 1.1.1 | Customer | No account manager / salesperson reference. |
| SG-6 | Section 1.1.1 | Customer | No billing vs shipping address distinction. |
| SG-7 | Section 1.1.1 | Customer | No contact person (separate from customer entity). |
| SG-8 | Section 1.1.2 | Invoice | No billing address snapshot on invoice (uses customer address at query time -- if customer moves, old invoices show new address). |
| SG-9 | Section 1.1.2 | Invoice | No PO reference / customer reference field. |
| SG-10 | Section 1.1.2 | Invoice | No notes/memo field. |
| SG-11 | Section 1.1.2 | Invoice | No discount fields (per-line or invoice-level). |
| SG-12 | Section 1.1.2 | Invoice | No account code on invoice lines (exists on credit note lines but not invoice lines -- needed for revenue GL posting). |
| SG-13 | Section 1.1.2 | Invoice | No unit of measure per line. |
| SG-14 | Section 1.1.2 | Invoice | No salesperson / sales rep reference. |
| SG-15 | Section 1.1.2 | Invoice | No delivery address. |
| SG-16 | Section 1.1.3 | Payment | No bank account reference on payment (which bank account was it received into). |
| SG-17 | Section 1.1.4 | CreditNote | Invoice lines don't have accountCode but credit note lines do -- inconsistent. |
| SG-18 | Section 1.2.1 | Supplier | No status field -- enable/disable tracked outside schema. |
| SG-19 | Section 1.2.1 | Supplier | No address fields (single or structured). |
| SG-20 | Section 1.2.1 | Supplier | No VAT registration number. |
| SG-21 | Section 1.2.1 | Supplier | No payment terms field (termsDays). |
| SG-22 | Section 1.2.1 | Supplier | No supplier category/classification. |
| SG-23 | Section 1.2.1 | Supplier | No audit trail fields (createdBy, updatedBy). |
| SG-24 | Section 1.2.1 | Supplier | No bank details for payment (sort code, account number). |
| SG-25 | Section 1.2.1 | Supplier | No contact person. |
| SG-26 | Section 1.2.2 | PurchaseOrder | No received qty vs ordered qty tracking on lines. |
| SG-27 | Section 1.2.2 | PurchaseOrder | No tax/duty handling on PO lines. |
| SG-28 | Section 1.2.2 | PurchaseOrder | No unit of measure field. |
| SG-29 | Section 1.2.2 | PurchaseOrder | No delivery address. |
| SG-30 | Section 1.2.2 | PurchaseOrder | No payment terms. |
| SG-31 | Section 1.2.3 | Bill | No PO reference on bill (cannot trace bill to PO). |
| SG-32 | Section 1.2.3 | Bill | accountCode optional on lines -- may cause GL issues. |
| SG-33 | Section 1.2.4 | Payment | No cleared date for bank reconciliation. |
| SG-34 | Section 1.3.1 | GlAccount | No opening balance field. |
| SG-35 | Section 1.3.1 | GlAccount | No account description field. |
| SG-36 | Section 1.3.4 | CoaTemplateLine | type is String, not GlAccountType enum. |
| SG-37 | Section 1.3.4 | CoaTemplateLine | No unique constraint on (templateId, code) -- allows duplicates. |
| SG-38 | Section 1.4.1 | BankAccount | No sort code / account number fields. |
| SG-39 | Section 1.4.1 | BankAccount | No IBAN / BIC fields. |
| SG-40 | Section 1.4.1 | BankAccount | No GL account link (bank account to GL account mapping). |
| SG-41 | Section 1.4.1 | BankAccount | No opening balance. |
| SG-42 | Section 1.4.2 | BankStatement | No running balance field. |
| SG-43 | Section 1.6.1 | FixedAsset | No depreciation method field. |
| SG-44 | Section 1.6.1 | FixedAsset | No revaluation history tracking. |
| SG-45 | Section 1.6.1 | FixedAsset | No asset category enum. |
| SG-46 | Section 1.7 | PeriodClose | Duplicate fields: closedBy + closedByUserId. |

### 8.1.2 Inventory/Stock (Section 2)

| # | Source | Entity | Missing Fields / Issue |
|---|--------|--------|----------------------|
| SG-47 | Section 2.1.5 | InventoryItem | No fields for: name, description, category, UoM, barcode, weight, dimensions, status, reorder point, min/max qty, lead time, or any other typical item master fields. All stored in JSON. |
| SG-48 | Section 2.3.3 | Warehouse | No address, contact info, timezone, capacity, or status fields. |
| SG-49 | Section 2.3.3 | Location | No capacity, zone, aisle, shelf, or status fields. The `type` field is undefined. |
| SG-50 | Section 2.8.1 | InventoryLot | No fields for: expiryDate, batchStatus, manufacturer, supplier, qualityStatus. |

### 8.1.3 CRM/Sales (Section 3)

| # | Source | Entity | Missing Fields / Issue |
|---|--------|--------|----------------------|
| SG-51 | Section 3.1.6 | CrmLead | No `description` or `notes` field. |
| SG-52 | Section 3.2.5 | CrmContact | No `address`, `city`, `postcode`, `country` fields (these exist on CrmAccount but not contacts). |
| SG-53 | Section 3.3.4 | CrmAccount | File-based store has `parentId` for hierarchical accounts; DB schema does not support parent-child account hierarchy. |
| SG-54 | Section 3.4.7 | Pipeline | No `Pipeline` or `PipelineStage` model in schema -- stages are hardcoded strings. |
| SG-55 | Section 3.5.6 | SalesQuote | No terms/conditions field. |
| SG-56 | Section 3.7.4 | Activity | No reminder/notification integration for tasks with due dates. |
| SG-57 | Section 3.8.5 | PriceBook | File-based store has `parentId` for hierarchy; DB does not. |
| SG-58 | Section 3.11.8 | PosPromotion | Schema-only; no server logic. |
| SG-59 | Section 3.11.8 | CashMovement | Schema exists; not actively populated in current code. |
| SG-60 | Section 3.12.9 | BlanketPO | No server logic. |
| SG-61 | Section 3.12.9 | SupplierContract | No server logic. |
| SG-62 | Section 3.12.9 | LandedCost (CRM) | No server logic. [CONTRADICTION-RESOLVED: XR-7 -- Same LandedCost model referenced from both Inventory (Section 2.12.1, ST-8) and CRM/Purchasing (Section 3.12.9). Canonical definition is in Section 2.12.1.] |
| SG-63 | Section 3.12.9 | SupplierPerformance | No server logic. |
| SG-64 | Section 3.12.9 | -- | BlanketPO, SupplierContract, LandedCost, SupplierPerformance models have no implementation. |
| SG-65 | Section 3.13.1 | HubSpot models | Schema-only. No sync logic, no API, no integration code found. |

### 8.1.4 HR/Payroll (Section 4)

| # | Source | Entity | Missing Fields / Issue |
|---|--------|--------|----------------------|
| SG-66 | Section 4.1.1 | Employee | Extremely minimal -- lacks: status, departmentId, jobTitle, managerId, startDate, employmentType, userId FK, payFrequency, basePay, currency, address, DOB, gender. All in JSON metadata. |
| SG-67 | Section 4.2.1 | Department | Missing: description, managerId, parentDepartmentId (for hierarchy), costCentreCode, active/status. |
| SG-68 | Section 4.2.5 | UserDepartment | Links Users to Departments, but not Employees to Departments. Employee has no departmentId FK. |
| SG-69 | Section 4.2.5 | -- | User-Department and User-Team link to `User`, not `Employee`. No `EmployeeDepartment` or `EmployeeTeam` join table. Employee's department is free-text JSON. |
| SG-70 | Section 4.3 | -- | No LeaveRequest model in schema (JSON only). |
| SG-71 | Section 4.3 | -- | No LeaveType/LeaveBalance models in schema. |
| SG-72 | Section 4.4 | -- | No Attendance/TimeTracking model. |
| SG-73 | Section 4.4 | -- | No Recruitment models (JobPosting, Applicant). |
| SG-74 | Section 4.5.1 | PaySchedule | Missing: payDayOfMonth, payDayOfWeek, active flag, taxYear reference. |
| SG-75 | Section 4.5.2 | PayrollRun | Missing: payDate, processedBy, approvedBy, totalGross, totalNet, totalDeductions, currency, reversalRef. |
| SG-76 | Section 4.5.4 | Payslip | Missing: payDate, taxCode, niCategory, pensionOptIn, hoursWorked, paymentMethod, bankSortCode, bankAccountNumber, currency. |
| SG-77 | Section 4.5.5 | Deduction | Missing: type (enum: tax, ni, pension, student_loan, other), rate, threshold, statutory flag. |

### 8.1.5 Management Platform (Section 7)

| # | Source | Entity | Missing Fields / Issue |
|---|--------|--------|----------------------|
| SG-78 | Section 7.1.5 | TenantConfig | Overloaded JSON `config` field acts as a catch-all bag. Should be broken into properly typed tables. |
| SG-79 | Section 7.1.8 | Tenant | baseCurrencyCode and defaultTimezoneId FK fields are nullable and often null. FK relations not formally declared. Code falls back to legacy string fields. |

---

## 8.2 Missing Features

Features that should exist but do not in the current codebase.

### 8.2.1 Invoicing & Accounts (Section 1)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-1 | Section 1.1.1 | Customer delete/archive | No delete/archive endpoint. |
| MF-2 | Section 1.1.1 | Customer merge | No customer merge/deduplicate functionality. |
| MF-3 | Section 1.1.1 | Customer statements | No customer statement generation. |
| MF-4 | Section 1.1.2 | Recurring invoices | No recurring invoice support. |
| MF-5 | Section 1.1.2 | Invoice PDF | No invoice PDF generation. |
| MF-6 | Section 1.1.2 | Invoice email | No invoice email sending. |
| MF-7 | Section 1.1.2 | Invoice duplication | No invoice duplication/copy. |
| MF-8 | Section 1.1.2 | Batch invoicing | No batch invoicing. |
| MF-9 | Section 1.1.2 | Pro-forma invoices | No pro-forma invoice type. |
| MF-10 | Section 1.1.2 | Invoice void | No void/cancel endpoint (only write-off). |
| MF-11 | Section 1.1.3 | Payment batch | No payment batch processing. |
| MF-12 | Section 1.1.3 | Bank feed matching | No bank feed auto-matching to receipts. |
| MF-13 | Section 1.1.3 | Direct debit | No direct debit / standing order support. |
| MF-14 | Section 1.1.4 | Credit note void | No credit note void/cancel. |
| MF-15 | Section 1.1.5 | Write-off reversal | No write-off reversal. |
| MF-16 | Section 1.1.5 | Write-off approval | No write-off approval workflow (may need manager approval above threshold). |
| MF-17 | Section 1.1.7 | Aging buckets | No configurable aging buckets. |
| MF-18 | Section 1.1.7 | Dunning | No aged debt letters / dunning automation. |
| MF-19 | Section 1.1.7 | Interest calculation | No interest calculation on overdue amounts. |
| MF-20 | Section 1.2.2 | PO line validation | No validation that lines exist before approval. |
| MF-21 | Section 1.2.2 | Three-way matching | No three-way matching (PO vs GRN vs Invoice). |
| MF-22 | Section 1.2.3 | Partial credit notes | No partial credit notes (always full bill amount). |
| MF-23 | Section 1.2.3 | Credit note reason | No reason/description field on credit notes. |
| MF-24 | Section 1.2.4 | Payment run approval | No approval workflow on payment runs. |
| MF-25 | Section 1.2.4 | BACS file generation | No BACS file generation. |
| MF-26 | Section 1.2.4 | Payment method tracking | No payment method tracking (BACS, cheque, card). |
| MF-27 | Section 1.2.4 | Bank reconciliation link | No bank account reconciliation link on AP payments. |
| MF-28 | Section 1.2.4 | Batch payment export | No batch payment export (BACS file). |
| MF-29 | Section 1.3.1 | GL account hierarchy | No account hierarchy (parent/child grouping). |
| MF-30 | Section 1.3.1 | Cost center | No cost center / department dimension. |
| MF-31 | Section 1.3.1 | Posting restrictions | No posting restrictions (leaf-only posting). |
| MF-32 | Section 1.3.2 | Journal delete | No DELETE endpoint for draft journals. |
| MF-33 | Section 1.3.2 | Concurrent protection | No concurrent posting protection (optimistic locking). |
| MF-34 | Section 1.3.2 | GL roll-up reports | No account hierarchy / roll-up reports. |
| MF-35 | Section 1.3.2 | Recurring journals | No recurring journal templates. |
| MF-36 | Section 1.3.2 | Budget vs actual | No budget vs actual variance. |
| MF-37 | Section 1.3.2 | Intercompany | No intercompany eliminations. |
| MF-38 | Section 1.3.4 | COA template API | No API endpoints for template CRUD. |
| MF-39 | Section 1.3.4 | COA template UI | No UI for template management. |
| MF-40 | Section 1.4.1 | Bank update/delete | No update/delete endpoints for bank accounts. |
| MF-41 | Section 1.4.2 | Multi-match | No multi-match (one payment to multiple statement lines). |
| MF-42 | Section 1.4.2 | Bank rules | No bank rules for auto-categorization. |
| MF-43 | Section 1.4.2 | Balance assertion | No balance assertion (statement balance vs system balance). |
| MF-44 | Section 1.4.3 | Reconciliation report | No reconciliation report generation. |
| MF-45 | Section 1.5.1 | VAT scheduling | No quarterly/annual return scheduling. |
| MF-46 | Section 1.5.1 | MTD integration | No Making Tax Digital (MTD) live integration. |
| MF-47 | Section 1.6.1 | Impairment testing | No impairment testing. |
| MF-48 | Section 1.6.1 | Asset grouping | No asset grouping for batch depreciation reporting. |
| MF-49 | Section 1.7 | Year-end close | No year-end close process. |
| MF-50 | Section 1.7 | Fiscal year config | No fiscal year configuration. |
| MF-51 | Section 1.7 | Period auto-generation | No period auto-generation (monthly periods must be created on demand). |
| MF-52 | Section 1.8.1 | FX realized gain/loss | No realized gain/loss on payment. |
| MF-53 | Section 1.8.1 | FX rate provider | No FX rate provider integration. |
| MF-54 | Section 1.8.1 | Historical rates | No historical rate lookups. |
| MF-55 | Section 1.8.1 | Currency management | No currency management UI (add/remove currencies). |

### 8.2.2 Inventory/Stock (Section 2)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-56 | Section 2.3.3 | Location CRUD | No API endpoints for Location CRUD. |
| MF-57 | Section 2.3.3 | Warehouse zones | No WarehouseZone model despite being mentioned in requirements. Locations are flat. |
| MF-58 | Section 2.3.4 | ASN details | No ASN lines/details model. |
| MF-59 | Section 2.3.4 | ASN-PO link | No link between ASN and PurchaseOrder. |
| MF-60 | Section 2.3.12 | Pack step | No pack step in WMS -- status goes directly from picked to shipped. packedQty field never used. |
| MF-61 | Section 2.4.2 | Cancel transfer | No cancel/void transfer operation. |
| MF-62 | Section 2.5.5 | Quality inspection | No quality inspection workflow (create inspection, record findings, accept/reject). |
| MF-63 | Section 2.5.5 | Quality-lot link | No link between quality holds and lot/batch tracking. |
| MF-64 | Section 2.7.2 | Reservation API | No reservation creation/management API. |
| MF-65 | Section 2.7.2 | SO reserved/backorder | SalesOrderLine has `reservedQty` and `backorderQty` fields but they are never written to. |
| MF-66 | Section 2.8.2 | Lot number generation | No lot number generation or assignment logic. `lotNumber` is always null in GRN flow. |
| MF-67 | Section 2.8.2 | Lot query API | No lot/batch query API endpoint. |
| MF-68 | Section 2.8.2 | Serial tracking | No serial number tracking despite `trackSerial` flag in metadata. |
| MF-69 | Section 2.8.2 | Lot expiry | No expiry date on lots. |
| MF-70 | Section 2.9.7 | Configurable costing | No configurable costing method per item or per tenant. |
| MF-71 | Section 2.9.7 | Landed cost allocation | No landed cost allocation to inventory items (model exists but no service). |
| MF-72 | Section 2.10.2 | Replenishment API | No API routes for replenishment rules or suggestions. |
| MF-73 | Section 2.11.1 | RMA integration | No integration with inventory movements (restock does not create a stock receipt). |
| MF-74 | Section 2.11.1 | RMA refunds | No integration with credit notes or refunds. |
| MF-75 | Section 2.12.1 | Landed cost logic | No allocation logic to distribute landed costs across PO line items. |
| MF-76 | Section 2.12.1 | Landed cost valuation | No landed cost impact on inventory valuation. |
| MF-77 | Section 2.2.8 | Movement history API | No endpoint to query stock movement history. |

### 8.2.3 CRM/Sales (Section 3)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-78 | Section 3.5.6 | Quote-to-order | No quote-to-order conversion function. |
| MF-79 | Section 3.6.7 | Sales order CRUD | No list, get, update, cancel, or status-transition endpoints for SalesOrder. |
| MF-80 | Section 3.6.7 | Order-to-invoice | No order-to-invoice conversion endpoint. |
| MF-81 | Section 3.6.7 | SO status transitions | No status transition logic (confirm, ship, invoice, cancel). |
| MF-82 | Section 3.6.7 | SO reservation logic | Reservation logic is schema-only -- no server implementation. |
| MF-83 | Section 3.9.2 | CPQ approval | No approval workflow for quotes below price floor. |
| MF-84 | Section 3.9.2 | CPQ configuration | No product configuration logic. |
| MF-85 | Section 3.11.8 | Z-report generation | Schema exists, no implementation. [CONTRADICTION-RESOLVED: DC-10 -- MF-85 and MF-86 describe the same gap (Z-report generation) from different source sections. Merged: single gap covering both schema existence and missing implementation logic.] |
| MF-86 | Section 3.11.21 | Z-reports | Z-report generation logic missing. [CONTRADICTION-RESOLVED: DC-10 -- Duplicate of MF-85. See MF-85 for consolidated entry.] |
| MF-87 | Section 3.11.21 | CashMovement tracking | Schema exists, not populated. |
| MF-88 | Section 3.11.21 | POS promotions | PosPromotion application (schema exists, no logic). |
| MF-89 | Section 3.12.11 | Purchasing API | No REST API for supplier CRUD, PO listing/detail, RFQ operations, or PO status transitions. |
| MF-90 | Section 3.12.11 | Goods receipt | No goods receipt / three-way match logic. |
| MF-91 | Section 3.12.11 | PO-to-bill conversion | No PO-to-bill conversion. |
| MF-92 | Section 3.13.2 | HubSpot sync | No HubSpot sync implementation (schema only). |

### 8.2.4 HR/Payroll (Section 4)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-93 | Section 4.0 | HR API routes | No HTTP API routes or tRPC routers for any HR functionality. |
| MF-94 | Section 4.0 | HR frontend | No frontend pages exist despite routes defined in AI schema. |
| MF-95 | Section 4.1.5 | Employee delete | No delete/archive employee operation. |
| MF-96 | Section 4.1.5 | Employee bulk import | No bulk import/export. |
| MF-97 | Section 4.1.5 | Employee search | No employee search by name/department. |
| MF-98 | Section 4.2.5 | Department CRUD | No server-side CRUD services for Department or Team exist. |
| MF-99 | Section 4.2.5 | Department API | No API operations for managing departments, teams, or user assignments. |
| MF-100 | Section 4.3.3 | Leave approval workflow | No approval workflow with delegation/escalation. |
| MF-101 | Section 4.3.3 | Leave notifications | No email/notification on leave status changes. |
| MF-102 | Section 4.3.3 | Team leave planner | No calendar view / team leave planner. |
| MF-103 | Section 4.3.3 | Bank holidays | No bank holiday / public holiday integration. |
| MF-104 | Section 4.4 | Attendance | No attendance or time tracking in HR module. |
| MF-105 | Section 4.5.20 | Payroll approval | No payroll approval workflow. |
| MF-106 | Section 4.5.20 | Staff self-service | No STAFF-level payslip self-service view. |
| MF-107 | Section 4.5.22 | Payroll Scottish/Welsh tax | No Scottish/Welsh tax rates. |
| MF-108 | Section 4.6 | Recruitment | No recruitment functionality implemented. |
| MF-109 | Section 4.7 | Training | No training or development functionality. |
| MF-110 | Section 4.8 | Document management | No employee document management. |
| MF-111 | Section 4.9 | Audit events | No audit events for employee/leave/payroll operations. |

### 8.2.5 Reporting (Section 5)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-112 | Section 5.1.4 | Cash flow statement | No dedicated cash flow statement report. |
| MF-113 | Section 5.1.5.4 | MTD submission code | No server-side code implements MTD API calls to HMRC. |
| MF-114 | Section 5.2.2 | Stock reports | No stock valuation, stock turnover, or reorder point reports. |
| MF-115 | Section 5.2.3 | Sales reports | No pipeline conversion, sales by customer/product, or quote conversion rate reports. |
| MF-116 | Section 5.2.4 | HR reports | No headcount, payroll cost summary, or leave/absence reports. |
| MF-117 | Section 5.2.5 | POS reports | No daily sales summary, product mix, or cash register reconciliation reports. |
| MF-118 | Section 5.2.6 | Project reports | No project profitability, resource utilization, or WIP aging reports. |
| MF-119 | Section 5.5.1 | Report execution engine | No cron runner/scheduler to execute report schedules and deliver reports. |
| MF-120 | Section 5.5.1 | Report rendering | No report rendering to PDF/CSV for delivery. |
| MF-121 | Section 5.5.2 | PDF export | No PDF export for financial reports. |
| MF-122 | Section 5.5.2 | CSV export | No CSV export for financial reports. |
| MF-123 | Section 5.5.2 | Excel export | No Excel/XLSX export. |
| MF-124 | Section 5.6.3 | Data warehouse reporting | No reporting layer reads from the fact tables; they are populated but no analytics dashboards or reports query them. |
| MF-125 | Section 5.6.4 | Metric reporting | No code reads from MetricPoint or MetricsSnapshot for reporting. |

### 8.2.6 Cross-Module Interactions (Section 6)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-126 | Section 6.3.2 | PO creation event | No event emitted for PO creation (only approval). |
| MF-127 | Section 6.3.2 | GRN to Bill | No event or logic links GRN receipt to automatic supplier bill creation. |
| MF-128 | Section 6.3.2 | Bill payment event | No event type for bill payment. |
| MF-129 | Section 6.3.2 | GL posting from PO/bill | No automatic GL entry creation from PO approval or bill payment. |
| MF-130 | Section 6.3.3 | Manufacturing GL | No automatic GL journal entries from manufacturing cost postings. |
| MF-131 | Section 6.12 | POS refund reversal | No inventory or finance reversal on POS refund. |
| MF-132 | Section 6.12 | Invoice GL auto-posting | Only payroll creates GL entries via events; invoices/bills do not. |
| MF-133 | Section 6.12 | SO inventory reservation | Sales order to inventory reservation mentioned as future work. |
| MF-134 | Section 6.12 | Tenant isolation RLS | Application-layer only; no database-level RLS. |

### 8.2.7 Management Platform (Section 7)

| # | Source | Feature | Description |
|---|--------|---------|-------------|
| MF-135 | Section 7.6.4 | API key management | No API key CRUD service functions. |
| MF-136 | Section 7.6.4 | API key validation | No API key validation middleware. |
| MF-137 | Section 7.6.4 | API rate limiting | No rate limiting implementation using ApiKey.rateLimitPerMin/burst. |
| MF-138 | Section 7.6.4 | Developer portal | No developer portal API (directory is empty). |
| MF-139 | Section 7.6.4 | Marketplace | No marketplace API (directory is empty). |
| MF-140 | Section 7.6.4 | Webhook delivery | No webhook delivery system. |

---

## 8.3 Stubbed/Mock Implementations

API endpoints or models that exist but return mock/hardcoded data or are not connected.

### 8.3.1 Invoicing & Accounts (Section 1)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-1 | Section 1.4.4 | Open Banking (TrueLayer) | TrueLayer provider hardcoded, no actual integration. Sandbox mode only. |
| ST-2 | Section 1.5.1 | HMRC MTD submission | Returns 501 if HMRC_CLIENT_ID not set. Sandbox mode only. No live HMRC API calls. |

### 8.3.2 Inventory/Stock (Section 2)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-3 | Section 2.3.4 | ASN model | Schema model exists but no service or API routes. No CRUD operations. |
| ST-4 | Section 2.3.5 | Wave / PickTask (Prisma) | Prisma models exist but no server-side service files or API routes. File-based implementation used instead. |
| ST-5 | Section 2.3.6 | PutawayTask | Model exists but putaway is implemented via stock transfer rather than PutawayTask records. |
| ST-6 | Section 2.5.5 | QualityInspection | Model exists in schema but no service or API implementation. |
| ST-7 | Section 2.5.5 | CAPA | Model exists in schema but no service or API implementation. |
| ST-8 | Section 2.12.1 | LandedCost | Model exists but no service, no API routes, no integration with inventory costing. |

### 8.3.3 CRM/Sales (Section 3)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-9 | Section 3.9.1 | CPQ service | Minimal 3-line utility with no integration into quote workflow. |
| ST-10 | Section 3.11.20 | POS summary endpoints | 7 stub endpoints: /api/pos/summary, terminal/summary, receipts/summary, offline-sync/summary, reconciliation/summary, postings/summary, reports/summary. [CONTRADICTION-RESOLVED: DE-8 -- All return mock data. Could mislead developers into thinking POS is operational. Remove or implement in new project.] |
| ST-11 | Section 3.12.10 | Purchasing summary endpoints | 4 stub endpoints: /api/purchasing/summary, requisitions/summary, orders/summary, supplier-invoices/summary. |

### 8.3.4 HR/Payroll (Section 4)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-12 | Section 4.5.10 | File-based payroll store | Simple net calculation: net = gross * 0.8 (80% of gross). Clearly a stub/placeholder. |
| ST-13 | Section 4.5.18 | Staff dashboard myTasks | Hardcoded `0` -- ProjectTask has no tenantId/assignee. |

### 8.3.5 Reporting (Section 5)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-14 | Section 5.3.4 | KPI dashboard API | Returns entirely hardcoded/mock data; does not call the KPI service. |

### 8.3.6 Cross-Module Interactions (Section 6)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-15 | Section 6.7 | Orchestration runner | In-memory queue placeholder for future multi-step business process orchestration (e.g., order-to-cash saga). |
| ST-16 | Section 6.8 | External integration sync | Infrastructure (job tracking, idempotency, logging) is complete but actual data mapping and API integration uses mock data. |
| ST-17 | Section 6.8.3 | Connectors service | In-memory boolean state only. connect(key) sets state to true and logs audit event. No real OAuth or API integration. |
| ST-18 | Section 6.10.4 | AI engine client | No real AI provider integration. Returns mock data in test mode and errors in production. |
| ST-19 | Section 6.10.4 | Risk classification | Returns single "UNCLASSIFIED" bucket (no risk model implemented). |

### 8.3.7 Management Platform (Section 7)

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| ST-20 | Section 7.2.7 | Re-auth password verification | Accepts any non-empty password as valid. Must be implemented before production. |
| ST-21 | Section 7.3.5 | Per-user module access | getUserAccessConfig() always returns null. Infrastructure exists but not wired to database storage. |
| ST-22 | Section 7.4.11 | Platform Invoice model | Exists but no service code for generating platform billing invoices. |
| ST-23 | Section 7.6 | ApiKey model | Schema exists but no service code for API key management (creation, validation, revocation, rate limiting). |
| ST-24 | Section 7.6 | Webhook management | Schema exists but no webhook management service code. |
| ST-25 | Section 7.6 | Webhook event processing | Schema exists but no webhook event processing service code. |
| ST-26 | Section 7.7.1 | SIEM export | Model exists but no export service code. |
| ST-27 | Section 7.7.1 | Backup/DR | Both models exist in schema but no backup/DR service code. |
| ST-28 | Section 7.7.1 | Demo data visibility | Schema exists but no service code for demo data visibility management. |
| ST-29 | Section 7.7.1 | Tenant encryption keys | Model exists but no key management, rotation, or BYOK service code. |
| ST-30 | Section 7.7.1 | Notification service | Schema exists but no notification service code. |

---

## 8.4 Partial Implementations

Features that exist but are incomplete.

### 8.4.1 Invoicing & Accounts (Section 1)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-1 | Section 1.2.4 | Payment run status | Status lifecycle (draft -> proposed -> executed) only partially implemented. |
| PA-2 | Section 1.4.2 | Bank auto-matching | autoMatchStatements() returns matched/unmatched counts but limited matching logic. |
| PA-3 | Section 1.5.1 | VAT box calculations | Box 2, 8, 9 hardcoded to zero. Partial box logic for boxes 1, 3-7. |
| PA-4 | Section 1.5.1 | VAT return endpoints | List, create, and summary endpoints are partial; submit is stubbed. |
| PA-5 | Section 1.6.1 | Asset revaluation | Revalue endpoint exists but is partial -- creates draft journal only. |

### 8.4.2 Inventory/Stock (Section 2)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-6 | Section 2.8.2 | Lot linkage | StockMove has optional lotId FK but it is rarely populated by movement services. |
| PA-7 | Section 2.14.1 | FactInventoryMovement | DimProduct auto-synced on item create/update. FactInventoryMovement population is not verified in movement service code. |

### 8.4.3 CRM/Sales (Section 3)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-8 | Section 3.4.5 | Pipeline summary | Hardcoded stages; loads all opportunities and counts client-side. |
| PA-9 | Section 3.5 | Sales quotes lifecycle | DB + file dual implementation. Lifecycle guards incomplete in DB version. |
| PA-10 | Section 3.6 | Sales orders | Uses wrong model (OrderExternal). Only create endpoint; no CRUD. |
| PA-11 | Section 3.7 | Activities | No update endpoint. Complete function doesn't update status field. |
| PA-12 | Section 3.11 | POS sales | Three parallel implementations (DB, config-based, file-based). |
| PA-13 | Section 3.12 | Suppliers/POs | Minimal API; no REST routes wired. |
| PA-14 | Section 3.10 | Customer bridge | Auto-created entity; no direct API. |
| PA-15 | Section 3.14.2 | Legal entity access | Only CRM server functions (contacts, accounts, activities, pipelines) call `assertLegalEntityAccess()`. Leads and quotes do not. |
| PA-16 | Section 3.14.8 | CRM test coverage | Only a single scaffold test exists (type-level only). No functional or integration tests. |

### 8.4.4 HR/Payroll (Section 4)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-17 | Section 4.5.16 | BACS generation | File generation exists but no integration with payroll runs to auto-generate. No API endpoint. |
| PA-18 | Section 4.5.17 | Payslip PDF | PDF generation exists but files saved to public directory with no access control. |

### 8.4.5 Reporting (Section 5)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-19 | Section 5.1.5.4 | HMRC MTD schema | HmrcMtdSubmission model exists but no code implements submission logic. |
| PA-20 | Section 5.1.5 | VAT return infrastructure | Schema models exist with relationships but no MTD submission code. |
| PA-21 | Section 5.2.1.3 | VarianceReport model | Model exists in schema but the manufacturing variance report service does not query it. |
| PA-22 | Section 5.3.5 | KpiSnapshot model | Model exists but no code writes to it or reads from it for historical KPI trending. |
| PA-23 | Section 5.4.3 | AI risk classification | Returns single unclassified bucket; needs risk classification model. |
| PA-24 | Section 5.4.4 | AI tool handlers | Tool handlers return `{ ok: true, data: input }` (passthrough); actual implementation delegated to intent resolution. |
| PA-25 | Section 5.5.1 | Report scheduling | Schedule definitions exist (Redis/file) but nothing triggers them. |
| PA-26 | Section 5.6.2 | Fact table population | Several fact table entries have defaulted/hardcoded values. |
| PA-27 | Section 5.6.4 | MetricPoint/MetricsSnapshot | Schema models exist; event metrics write to Redis, not to these database models. |

### 8.4.6 Cross-Module Interactions (Section 6)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-28 | Section 6.1.5 | Redis pub/sub layer | Coexists with newer typed event bus but uses different type definitions. Two systems not unified. |
| PA-29 | Section 6.1.6 | Redis queue | No worker/consumer loop. Jobs can be enqueued/popped but no automatic processing. |
| PA-30 | Section 6.1.7 | Redis outbox | Simpler, earlier version. DB-backed OutboxEvent supersedes this. |
| PA-31 | Section 6.2.4 | Purchasing events | No event emitted for PO creation (only approval). |
| PA-32 | Section 6.2.6 | POS events | POS refund does not reverse inventory or finance entries. Only logged. |
| PA-33 | Section 6.2.7 | CRM/Sales events | No automatic inventory reservation on sales order creation. No stock deduction on fulfilment. |
| PA-34 | Section 6.2.8 | Projects/PSA events | Partial subscriber wiring. |
| PA-35 | Section 6.2.9 | Tax events | Partial subscriber wiring. |
| PA-36 | Section 6.2.10 | Infrastructure events | Partial subscriber wiring. |
| PA-37 | Section 6.3.1 | Sales cycle: Lead to Cash | Event types defined end-to-end but most transitions not wired with real cross-module logic. Only invoice creation records metrics facts and high-value invoice notification. |
| PA-38 | Section 6.3.1 | Lead to Opportunity | Event type exists but no subscriber wires conversion logic. |
| PA-39 | Section 6.3.1 | Opportunity to Quote | Event defined, subscriber is stub-only. |
| PA-40 | Section 6.3.1 | Quote Acceptance | Subscriber logs only. |
| PA-41 | Section 6.3.1 | Quote to Order | Subscriber mentions inventory reservation as future work. |
| PA-42 | Section 6.3.1 | Order Fulfilment | Subscriber mentions stock movements as future work. No automatic inventory deduction. |
| PA-43 | Section 6.3.1 | Invoice Payment | Subscriber logs only. No automatic GL posting. |
| PA-44 | Section 6.3.1 | Payment Applied | Subscriber logs only. |
| PA-45 | Section 6.3.2 | Procurement cycle | GRN-to-metrics works; PO-to-Bill and Bill-to-Payment not wired. |
| PA-46 | Section 6.3.2 | PO Approval | Subscriber stub mentions MRP recalculation. |
| PA-47 | Section 6.3.3 | Manufacturing cycle | Material issue tracked; completion costs hardcoded as zero. |
| PA-48 | Section 6.3.3 | Work Order Release | Handler slot empty. |
| PA-49 | Section 6.3.3 | Work Order Completion | Subscriber records FactWorkOrder but all costs (material, labour, overhead) hardcoded as 0. |
| PA-50 | Section 6.3.3 | Variance Posting | Handler slot empty. |
| PA-51 | Section 6.3.5 | POS to Finance | Subscriber records FactReceipt. Finance posting done via direct call, not event-driven. |
| PA-52 | Section 6.3.5 | POS Refund | Subscriber logs only with comment "Would reverse inventory and finance entries." |
| PA-53 | Section 6.9 | Shared services - dimension scoping | Only inventory warehouse scoping implemented. No scoping for finance cost centers, project sites. |
| PA-54 | Section 6.9 | Email templates | Only one template (welcome with temp password). No invoice email, order confirmation, payment receipt, etc. |
| PA-55 | Section 6.2 | Event subscribers (all) | Only ~30% of subscribers have real business logic; rest are stubs or logs-only. |

### 8.4.7 Management Platform (Section 7)

| # | Source | Feature | What's Missing |
|---|--------|---------|---------------|
| PA-56 | Section 7.2.7 | MFA | Schema fields exist (mfaEnabled, mfaSecret) but only warning log during login. No TOTP verification or MFA setup UI. |
| PA-57 | Section 7.2.6 | Password reset | Token model exists but full reset flow (generate, email, validate, consume) not found. |
| PA-58 | Section 7.4.10 | Stripe integration | Skeletal. No webhook handlers, no customer ID persistence, no subscription lifecycle management. |
| PA-59 | Section 7.4.8 | Subscription model | Exists but tenant billing primarily managed through direct fields, not through Subscription entity. |
| PA-60 | Section 7.4.9 | Plan model (legacy) | Referenced by Subscription.planId but primary billing uses BillingPlanTemplate. Two parallel plan systems. |
| PA-61 | Section 7.7.1 | SUPER_ADMIN MFA | MFA enforcement is advisory only -- login allowed without MFA with warning log. |
| PA-62 | Section 7.7.1 | Compliance checking | No-op that just logs and stores a record. No actual compliance validation logic. |

---

## 8.5 Technical Debt/Shortcuts

Implementation shortcuts, hardcoded values, `as any` casts, and other technical debt.

### 8.5.1 Invoicing & Accounts (Section 1)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-1 | Section 1.1.1 | Customer permissions | Uses `finance:create_invoice` or `finance:post_journal` -- should have dedicated customer permissions. |
| SC-2 | Section 1.1.2 | Invoice numbering | `INV-${Date.now()}` timestamp-based -- needs configurable sequence. |
| SC-3 | Section 1.1.2 | Duplicate endpoints | Two separate create endpoints (`/api/finance/ar/invoice/create` and `/api/finance/ar/invoices` POST) with different schemas. |
| SC-4 | Section 1.1.3 | Duplicate payment endpoints | Four separate payment/receipt endpoints doing similar things. |
| SC-5 | Section 1.1.4 | CN numbering | `CN-${Date.now()}` or `CN-${invoiceNumber}` -- needs configurable sequence. |
| SC-6 | Section 1.2.1 | Supplier permissions | Uses `finance:post_journal` -- should have dedicated supplier permissions. |
| SC-7 | Section 1.2.1 | Supplier enable/disable | Via separate endpoints (no status field in schema). |
| SC-8 | Section 1.2.2 | Bill from PO numbering | Hardcoded `BILL-${Date.now()}`. |
| SC-9 | Section 1.2.2 | Bill from PO data loss | Doesn't create line items -- data loss risk. |
| SC-10 | Section 1.2.3 | Bill duplicate endpoints | Duplicate create endpoints (bill/ vs bills/) with different schemas. |
| SC-11 | Section 1.2.3 | Bill status type | Status is String not Enum -- allows invalid states. |
| SC-12 | Section 1.2.3 | Hardcoded GL codes | GL account codes hardcoded (EXP, VAT_IN, AP). |
| SC-13 | Section 1.2.4 | AP Payment status type | Status is String not Enum. |
| SC-14 | Section 1.2.4 | Duplicate AP payment endpoints | Duplicate endpoints (payment/record vs payments/create). |
| SC-15 | Section 1.2.4 | `as any` casts | `as any` casts for allocations. |
| SC-16 | Section 1.3.1 | Hardcoded GL strings | All GL account codes are hardcoded strings -- need to be configurable per tenant via Chart of Accounts. |
| SC-17 | Section 1.3.1 | GL type cast | `.toUpperCase() as any` when creating/updating. |
| SC-18 | Section 1.3.2 | Decimal precision | Some places use `Number()` conversion losing Decimal precision. |
| SC-19 | Section 1.3.2 | Composite key `as any` | `as any` casts for composite unique key queries. |
| SC-20 | Section 1.3.3 | Legacy ledger system | Legacy GL system still in schema; should be deprecated. |
| SC-21 | Section 1.4.2 | No duplicate detection | No duplicate detection on bank statement import. |
| SC-22 | Section 1.4.2 | Reconciliation storage | Reconciliation mappings stored in TenantConfig JSON, not relational. |
| SC-23 | Section 1.5.1 | VAT in TenantConfig | VAT returns stored in TenantConfig JSON, NOT the VatReturn table. Relational table exists but never populated. [CONTRADICTION-RESOLVED: DC-5 -- This issue is described in multiple locations (Section 1.5.1, 5.1.5, 8.5.1, 8.7.1, 8.8.1). All descriptions are consistent. Primary documentation is in Section 5.1.5. Resolution: use relational VatReturn table per R-9.] |
| SC-24 | Section 1.5.1 | Hardcoded VAT boxes | Box 2 (EC acquisitions), Box 8, Box 9 hardcoded to 0. |
| SC-25 | Section 1.6.1 | Single depreciation method | Only straight-line depreciation (no declining balance, sum-of-digits). |
| SC-26 | Section 1.6.1 | FA hardcoded GL codes | All GL account codes for fixed assets hardcoded. |
| SC-27 | Section 1.6.1 | Disposed asset disposal | No check: can dispose already-disposed assets. |
| SC-28 | Section 1.6.1 | FA revalue permission | Uses `finance:fa_depreciate` permission for revaluation -- should be separate. |
| SC-29 | Section 1.8.1 | CurrencyRate unused | Table never populated. FX rates passed in request bodies. |
| SC-30 | Section 1.8.1 | FX revaluation draft only | Returns draft only -- does not post automatically. |

### 8.5.2 Inventory/Stock (Section 2)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-31 | Section 2.1.5 | Item metadata in JSON | Stored in TenantConfig JSON blob rather than proper relational columns. No schema validation. |
| SC-32 | Section 2.1.5 | Dual creation endpoints | Two separate creation endpoints with different code paths. |
| SC-33 | Section 2.1.5 | In-memory meta cache | Not cluster-safe, no TTL, no invalidation on config change from another process. |
| SC-34 | Section 2.1.5 | Search filter no-op | listInventoryItems() accepts `q` parameter but always returns true for all items. |
| SC-35 | Section 2.1.5 | Disabled items in JSON | Disabled items stored in TenantConfig JSON (soft-delete). |
| SC-36 | Section 2.2.5 | Non-transactional transfer | Source decrement and destination increment are separate Prisma calls. |
| SC-37 | Section 2.2.8 | Non-transactional movement | Two inventory updates and two stock moves are NOT in a single transaction. |
| SC-38 | Section 2.3.3 | Disabled warehouses in JSON | Stored in TenantConfig JSON. |
| SC-39 | Section 2.3.3 | Warehouse code global unique | `@unique` on code means global uniqueness, not per-tenant. [CONTRADICTION-RESOLVED: EC-11 -- Must use `@@unique([tenantId, code])` for per-tenant uniqueness.] |
| SC-40 | Section 2.3.12 | File-based pick/pack/ship | Entire pick/pack/ship workflow uses file-system JSON storage, not database-backed. |
| SC-41 | Section 2.3.12 | File-based receiving | Receiving records stored in TenantConfig JSON, not in PutawayTask or dedicated table. |
| SC-42 | Section 2.4.2 | File-based transfers | Transfer records stored in TenantConfig JSON, not in a dedicated database table. |
| SC-43 | Section 2.5.5 | Quarantine dual storage | Data stored in TenantConfig JSON AND in QualityHold Prisma model. Two sources of truth. |
| SC-44 | Section 2.6.6 | Dual cycle count | Two parallel implementations: database-backed and file-based. |
| SC-45 | Section 2.9.7 | Cost state in JSON | Cost state stored in TenantConfig JSON, not in a dedicated table. Risk of corruption on concurrent updates. |
| SC-46 | Section 2.10.2 | File-based replenishment | Replenishment rules stored in file system JSON. |
| SC-47 | Section 2.11.1 | File-based RMA | Entirely file-based. No database model, no API routes. |

### 8.5.3 CRM/Sales (Section 3)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-48 | Section 3.1.6 | Dual lead stores | Both file-based (leadsStore.ts) and DB-backed (leads.ts). File store uses JSON on disk. |
| SC-49 | Section 3.2.5 | Dual contact stores | File-based and DB-backed. File store uses flat `name` and `role` instead of firstName/lastName/title. |
| SC-50 | Section 3.2.5 | Name splitting | ERP service splits single `name` into firstName/lastName by space. |
| SC-51 | Section 3.3.4 | Dual account stores | File-based (simpler schema: name, parentId) and DB-backed (full schema). |
| SC-52 | Section 3.4.5 | Pipeline in-memory counting | Loads ALL opportunities and counts client-side rather than using SQL GROUP BY. |
| SC-53 | Section 3.4.7 | Dual opportunity stores | File-based store has different stage names and stricter transition rules. |
| SC-54 | Section 3.5.6 | Quote number timestamp | `QT-{Date.now()}` -- not sequential. |
| SC-55 | Section 3.5.6 | Dual quote stores | File-based store has stricter lifecycle guards; DB version is more permissive. |
| SC-56 | Section 3.6.7 | Wrong SO model | ERP service creates OrderExternal record (not SalesOrder) using Channel model. |
| SC-57 | Section 3.7.4 | Dual activity stores | File-based store has polymorphic fields; DB schema uses separate FKs. |
| SC-58 | Section 3.8.5 | Dual price book stores | File-based store has simpler schema. |
| SC-59 | Section 3.11.8 | POS sale number generation | Pattern uses sale count + random nonce. Not sequential. |
| SC-60 | Section 3.11.8 | POS payment persistence | Failure is swallowed. |
| SC-61 | Section 3.11.8 | POS register in JSON | Registers stored in tenantConfig JSON. |
| SC-62 | Section 3.11.8 | POS audit console.log | posAudit() only console-logs POS audit events (no persistent storage). |
| SC-63 | Section 3.11.8 | POS triple implementation | (a) DB-backed with sophisticated pricing/GL/inventory; (b) config-based with JSON in TenantConfig; (c) file-based. [CONTRADICTION-RESOLVED: CR-15 -- The DB-backed implementation (a) is canonical. Config-based and file-based implementations must be deprecated. Sales recorded in one implementation are invisible to the others, causing incomplete financial reporting.] |
| SC-64 | Section 3.12.5 | Supplier disable in JSON | Enablement tracked in TenantConfig JSON, not a DB column. |
| SC-65 | Section 3.12.9 | RFQ in JSON | RFQs stored in TenantConfig JSON, not a proper DB table. |

### 8.5.4 HR/Payroll (Section 4)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-66 | Section 4.1.3 | Employee number generation | `EMP-{tenantId}-{6-digit-random}` -- uses random number, no sequence guarantee, potential collisions. |
| SC-67 | Section 4.1.3 | Encryption stores plaintext | Plaintext stored alongside encrypted for search -- defeats purpose of encryption. |
| SC-68 | Section 4.1.4 | Dual employee queries | Two separate queries (Prisma + JSON) merged in application code. |
| SC-69 | Section 4.1.4 | Client-side filtering | Filtering after fetch, not database-level. |
| SC-70 | Section 4.3.2 | Simplified accrual | Simple proportional accrual; does not account for multiple leave types, carry-over, pro-rata. |
| SC-71 | Section 4.3.2 | In-memory leave cache | requestCache Map not production-safe for multi-instance deployments. |
| SC-72 | Section 4.5.5 | Allowance entity misuse | Allowance table stores employer costs (NI Employer, Pension Employer) rather than employee allowances/benefits. |
| SC-73 | Section 4.5.5 | Non-monthly frequency forced | Non-monthly frequencies forced back to monthly: "For demo/test tenants, enforce monthly as the safe default". |
| SC-74 | Section 4.5.6 | Hardcoded base pay | grossMinor = basePayMinor or default 300000 (3,000 GBP/month). |
| SC-75 | Section 4.5.6 | No deduction on adjustments | Gross = net for adjustments. |
| SC-76 | Section 4.5.7 | Hardcoded annual salary | Assumes 30,000 GBP annual salary for all employees. |
| SC-77 | Section 4.5.8 | Simplified UK tax | Simplified UK 2025 tax bands for demo purposes. No support for Scottish/Welsh, cumulative basis, or tax code parsing. |
| SC-78 | Section 4.5.9 | Simplified income tax | Uses only basic rate (20%) -- no higher/additional rate bands. |
| SC-79 | Section 4.5.9 | Tax code ignored | Tax code is stored but not parsed for calculation. |
| SC-80 | Section 4.5.9 | NI category ignored | NI category stored but only Category A implemented. |
| SC-81 | Section 4.5.17 | Payslip PDF no access control | Files saved to public directory with no access control. |
| SC-82 | Section 4.5.18 | GL on-the-fly accounts | Subscriber creates GL accounts on-the-fly using name-derived codes. Fragile. |
| SC-83 | Section 4.5.18 | Dual GL posting | Two different GL posting mechanisms for the same operation -- risk of double-posting. |
| SC-84 | Section 4.5.18 | Staff dashboard tenant-wide | "My" prefix misleading -- metrics are tenant-wide, not user-specific. |
| SC-85 | Section 4.0 | Dual employee storage | Employee metadata split between Prisma (identity) and JSON (operational data). |
| SC-86 | Section 4.0 | JSON leave storage | Leave requests/balances stored in JSON blob, not normalised tables. |
| SC-87 | Section 4.0 | Triple payroll storage | Payroll runs have 3 parallel implementations (Prisma, JSON, file). |

### 8.5.5 Reporting (Section 5)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-88 | Section 5.1.1 | Legacy GL in P&L | Uses legacy JournalLine/Account model rather than newer GlJournalEntry/GlJournalLine/GlAccount. |
| SC-89 | Section 5.1.2 | Legacy GL in BS | Uses the legacy GL model. |
| SC-90 | Section 5.1.3 | Dual GL systems | Two parallel implementations (legacy and new GL); both used by different consumers. |
| SC-91 | Section 5.1.5 | VAT in JSON | Returns stored in JSON blob in TenantConfig rather than proper database table. |
| SC-92 | Section 5.1.5 | Hardcoded tax code | Hardcodes all lines to VAT_STD regardless of actual line-level tax code. |
| SC-93 | Section 5.1.6 | AR aging partial payments | Does not account for partial payments (uses full total, not outstanding balance). |
| SC-94 | Section 5.1.6 | AR aging bucket naming | Different bucket naming convention from dedicated ageing service ("0-30" vs "current"/"1-30"). |
| SC-95 | Section 5.1.7 | AP aging partial payments | Same shortcut issues as AR aging. |
| SC-96 | Section 5.1.8 | Invoice insights cap | Limited to 50 most recent invoices; not a true full-portfolio summary. |
| SC-97 | Section 5.1.10 | FX hardcoded currency | Hardcoded to GBP as base currency. |
| SC-98 | Section 5.1.11 | No date range passthrough | No date range parameters passed through for TB/P&L/BS in dispatcher. |
| SC-99 | Section 5.3.3 | KPI inventory value | inventory_value_on_hand counts items instead of computing monetary value. |
| SC-100 | Section 5.3.3 | KPI AI errors | ai_errors_7d counts all AI logs, not just errors (no error filter). |
| SC-101 | Section 5.3.3 | KPI active SKUs | inventory_skus_active counts all items, not just active ones. |
| SC-102 | Section 5.3.3 | Sequential KPI queries | Sequential computation (one query per KPI in a loop). |
| SC-103 | Section 5.4.2 | AI context limit | Each provider fetches only 5 records; not suitable for comprehensive reporting. |
| SC-104 | Section 5.5.1 | Report schedules storage | Stored in Redis with 30-day TTL or JSON file; not persisted in database. |
| SC-105 | Section 5.6.1 | Dual period close | Two parallel period close mechanisms exist (database model and JSON config); both actively used. |
| SC-106 | Section 5.6.2 | Fact table defaults | Several fact table entries have defaulted/hardcoded values (costs = 0, payment method = "card"). |
| SC-107 | Section 5.6.2 | GRN time-window matching | GRN stock move matching uses +/- 5 seconds time-window which could miss or match incorrectly. |

### 8.5.6 Cross-Module Interactions (Section 6)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-108 | Section 6.1.7 | Redis outbox superseded | Simpler, earlier version of outbox. DB-backed OutboxEvent supersedes this. |
| SC-109 | Section 6.3.3 | Manufacturing zero costs | Work order completion records metrics with zero costs. Actual cost rollup not implemented. |
| SC-110 | Section 6.3.5 | POS direct GL calls | POS-to-Finance integration via direct function calls, not event system. Bypasses outbox and replay. |
| SC-111 | Section 6.9 | Application-layer tenant isolation | Coding error could expose cross-tenant data. Database-level RLS would be more robust. |
| SC-112 | Section 6.10.4 | AI context limited | Context limited to 5 most recent records per entity. No aggregation, filtering by relevance, or semantic search. |
| SC-113 | Section 6.10.4 | Hardcoded thresholds | selectProjectOverruns returns all projects. selectLowStockItems uses hardcoded threshold of 10. |

### 8.5.7 Management Platform (Section 7)

| # | Source | Issue | Description |
|---|--------|-------|-------------|
| SC-114 | Section 7.1.5 | Raw SQL upsert | TenantConfig uses raw SQL INSERT...ON CONFLICT with fallback to Prisma upsert. Repeated across super-admin services. |
| SC-115 | Section 7.2.3 | Demo user detection | Uses email pattern matching (@example.com) which is fragile. |
| SC-116 | Section 7.2.3 | SUPER_ADMIN tenant fallback | Falls back to first available tenant or synthetic "t-demo". |
| SC-117 | Section 7.2.3 | Session tenant fallback | For non-SUPER_ADMIN, falls back to first tenant. For SUPER_ADMIN, falls back to root tenant or "t-demo". |
| SC-118 | Section 7.1.8 | Setup wizard CI bypass | In test/CI environments, setup wizard guard is bypassed and returns true. |
| SC-119 | Section 7.3.8 | Plan feature CI bypass | In CI environments, plan feature gating is bypassed entirely. |
| SC-120 | Section 7.4.10 | Stripe ensureCustomer | Creates a new Stripe customer for each call. Does not look up existing or persist ID back. |
| SC-121 | Section 7.4.10 | nextBillingDate | Computed as 30 days from creation but no billing cycle processing exists. |
| SC-122 | Section 7.3.8 | User capacity CI bypass | In test/mocked environments, capacity enforcement is skipped. |
| SC-123 | Section 7.7.1 | In-memory rate limiter | Not shared across server instances. Not connected to ApiKey rate limits. |

---

## 8.6 Frontend Gaps

Backend supports the feature but frontend does not expose it.

| # | Source | Component | Description |
|---|--------|-----------|-------------|
| FG-1 | Section 1.1.2 | Invoice FX rate | FX rate field not exposed in UI. |
| FG-2 | Section 1.1.2 | Invoice quote/order link | quoteId/orderId FKs not exposed in invoice form. |
| FG-3 | Section 1.1.2 | Invoice SKU picker | No SKU/item picker on line items. |
| FG-4 | Section 1.1.2 | Invoice VAT code selector | No VAT code selector on line items. |
| FG-5 | Section 1.1.2 | Invoice FX rate input | No FX rate input for multi-currency. |
| FG-6 | Section 1.1.2 | Invoice link display | No link to quote/sales order from form. |
| FG-7 | Section 1.1.2 | Customer display | Customer shown by ID, not name. |
| FG-8 | Section 1.1.2 | Quick-create single line | Quick-create form only supports ONE line item. |
| FG-9 | Section 2.3.12 | WMS pick/pack/ship | File-based pick/pack/ship (supply lib) not connected to database-backed WMS. |
| FG-10 | Section 4.0 | HR UI pages | No UI pages for employee management, payroll, leave, recruitment despite routes defined in AI schema. |

---

## 8.7 Business Rule Gaps

Cases where the current system does not handle a necessary business scenario.

### 8.7.1 Invoicing & Accounts (Section 1)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-1 | Section 1.1.4 | CN approval | No credit note approval workflow -- created as "posted" immediately. |
| BG-2 | Section 1.1.5 | Write-off GL codes | Write-off GL accounts appear to be hardcoded -- should be configurable per tenant. |
| BG-3 | Section 1.1.6 | Allocation validation | One of paymentId or creditNoteId should be set (not both, not neither) -- not validated. |
| BG-4 | Section 1.3.2 / 1.7 | Dual period close | TWO period close mechanisms coexist: PeriodClose table AND TenantConfig.finance.close.lockedThrough. No documented precedence. [CONTRADICTION-RESOLVED: CR-5, DC-6 -- PeriodClose table is canonical. See Section 1.7.] |
| BG-5 | Section 1.4.3 | Bank recon link | No link to actual reconciled statement lines. |
| BG-6 | Section 1.4.3 | Recon tolerance | No variance/tolerance threshold. |
| BG-7 | Section 1.5.1 | VAT code tracking | No VAT code tracking on invoice/bill lines. |
| BG-8 | Section 1.5.1 | Reverse charge | No reverse charge VAT handling. |
| BG-9 | Section 1.5.1 | VAT adjustments | No adjustment/correction mechanism. |

### 8.7.2 Inventory/Stock (Section 2)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-10 | Section 2.1.4 | Batch/serial enforcement | `trackBatch` and `trackSerial` flags stored but not enforced in movement/GRN flows. |
| BG-11 | Section 2.2.8 | Bulk GRN | No bulk GRN endpoint. Each line must be received individually. |
| BG-12 | Section 2.2.8 | Audit trail query | No dedicated movement history API endpoint. |
| BG-13 | Section 2.3.12 | Dual shipment systems | Two parallel shipment systems (WMS and inventory WMS shipping) with different code paths. |
| BG-14 | Section 2.3.12 | Pick behavior inconsistency | createPick() immediately issues stock at pick time; pickShipment() in WMS does not. |
| BG-15 | Section 2.3.12 | Over-receiving | No over-receiving validation (qty received vs PO line qty). |
| BG-16 | Section 2.3.12 | Partial receiving | No partial receiving tracking per PO line. |
| BG-17 | Section 2.4.2 | Dual transfer mechanisms | Two separate mechanisms (config-based two-step and immediate single-step). Don't share state. |
| BG-18 | Section 2.5.5 | Quality hold scope | QualityHold.updateMany() matches by sku+reason which could affect multiple holds unintentionally. |
| BG-19 | Section 2.6.6 | Cycle count GL | Database-backed cycle count does not record GL journal entries for variances. |
| BG-20 | Section 2.6.6 | Scheduled counts | No scheduled/recurring cycle count automation. |
| BG-21 | Section 2.6.6 | Count variance approval | No approval workflow for cycle count variances above threshold. |
| BG-22 | Section 2.7.2 | ATP ignores Reservation | Reservation model exists but ATP does NOT use it -- derives reserved qty from Shipment data. |
| BG-23 | Section 2.7.2 | ATP batch query | No endpoint for multiple-SKU ATP batch query. |
| BG-24 | Section 2.7.2 | ATP supply/demand | ATP does not consider incoming supply (open POs) or demand (open SOs). Only current on-hand minus in-flight. |
| BG-25 | Section 2.8.2 | Lot trackBatch flag | trackBatch flag stored but never enforced. Lots created for ALL GRN receipts. |
| BG-26 | Section 2.9.7 | No standard cost | No standard cost method -- only WAV and FIFO. |
| BG-27 | Section 2.9.7 | FIFO/WAV not unified | FIFO and WAV costing in separate files with no unified interface or config to select method. |
| BG-28 | Section 2.9.7 | Cost revaluation | No cost revaluation or price variance reporting. |
| BG-29 | Section 2.9.7 | Historical valuation | Valuation report uses current on-hand, not historical. asOf parameter exists but not used for point-in-time. |
| BG-30 | Section 2.10.2 | Auto PO | No automatic PO generation from suggestions. |
| BG-31 | Section 2.10.2 | Lead time | No lead time consideration in reorder calculation. |
| BG-32 | Section 2.13.2 | Manufacturing GL | Manufacturing does not use costing service for GL postings. |
| BG-33 | Section 2.13.2 | Scrap no movements | Scrap records exist but do not create stock movements or GL entries. |

### 8.7.3 CRM/Sales (Section 3)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-34 | Section 3.1.3 | Lead conversion | No dedicated lead-to-opportunity conversion function on Lead entity. |
| BG-35 | Section 3.1.6 | Owner validation | ownerUserId has no FK constraint or validation (multiple entities: leads, contacts, accounts, opportunities). |
| BG-36 | Section 3.1.6 | CRM RBAC | No role-based granularity (e.g., crm:manage vs crm:view) beyond module toggle. |
| BG-37 | Section 3.1.6 | Lead cancelled status | Zod schema does not include "cancelled" but cancelLead() sets it server-side. |
| BG-38 | Section 3.2.5 | Audit fields unpopulated | createdBy and updatedBy fields exist but never populated (contacts, accounts, opportunities). |
| BG-39 | Section 3.3.4 | No cascade delete | Deleting an account does not check for child contacts, opportunities, or leads. |
| BG-40 | Section 3.4.7 | No stage ordering | No formal stage ordering enforcement -- any stage can transition to any other in DB-backed code. |
| BG-41 | Section 3.4.7 | No weighted pipeline | No weighted pipeline value calculation. |
| BG-42 | Section 3.5.6 | Quote editing guard | DB-backed version does not guard against editing accepted quotes. |
| BG-43 | Section 3.5.6 | Quote timestamps | sentAt, acceptedAt, rejectedAt fields exist but are never populated. |
| BG-44 | Section 3.5.6 | Quote versioning | version field exists but is never incremented. |
| BG-45 | Section 3.5.6 | Quote line tax | No tax computation on quote lines (discount field exists but no tax rate). |
| BG-46 | Section 3.6.7 | SO reserved/backorder | reservedQty and backorderQty on SalesOrderLine exist but no code manages them. |
| BG-47 | Section 3.7.4 | Activity completion bug | completeActivity() sets completedAt but does NOT update status field. Status remains "pending". |
| BG-48 | Section 3.7.4 | No activity update | No update endpoint for activities (only create, complete, delete). |
| BG-49 | Section 3.8.5 | No default enforcement | Multiple price books can be marked as default without conflict. |
| BG-50 | Section 3.8.5 | No price book linkage | No linkage between PriceBook items and SalesQuote/SalesOrder lines. |
| BG-51 | Section 3.11.21 | POS period check | Sale finalisation does not check period open status (void and refund do). |
| BG-52 | Section 3.11.21 | POS offline | No offline/park-and-recall functionality. |
| BG-53 | Section 3.11.21 | Stripe Terminal | No Stripe Terminal integration beyond schema fields. |
| BG-54 | Section 3.11.21 | POS drawer | PosDrawer has no functional logic. |
| BG-55 | Section 3.12.5 | PO cancel status | cancelPurchaseOrder() sets status to "closed" instead of "cancelled". [CONTRADICTION-RESOLVED: CR-1 -- canonical is "cancelled". See Section 1.2.2.] |
| BG-56 | Section 3.12.5 | PO unused statuses | approved and received PO statuses exist in enum but have no transition logic. [CONTRADICTION-RESOLVED: CR-2 -- canonical lifecycle includes approved step. See Section 1.2.2.] |
| BG-57 | Section 3.14.8 | CRM test coverage | Only a single scaffold test (type-level only). No functional or integration tests. |

### 8.7.4 HR/Payroll (Section 4)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-58 | Section 4.0 | No API routes | All HR functionality invoked through server-side service functions only. No REST or tRPC. |
| BG-59 | Section 4.1.5 | No self-service | No STAFF-level self-service view of own employee record. |
| BG-60 | Section 4.1.5 | No permission enforcement | Capabilities defined but not checked in server code. |
| BG-61 | Section 4.3.2 | Leave overlap check | Only checked on approval, not on submission. |
| BG-62 | Section 4.3.2 | Per-employee entitlement | No per-employee entitlement override in legacy system. |
| BG-63 | Section 4.3.3 | Weekend exclusion | No weekend/bank holiday exclusion -- counts all calendar days. |
| BG-64 | Section 4.3.3 | Leave STAFF permissions | STAFF has VIEW but no SUBMIT/REQUEST action -- employees cannot request own leave through permissions model. |
| BG-65 | Section 4.3.3 | Manager approval permission | No manager-level approval permission -- approval is service-level only. |
| BG-66 | Section 4.5.22 | Leave data in payroll | Leave data captured but not used to adjust pay (e.g., unpaid leave deduction, sick pay calculation). |
| BG-67 | Section 4.5.20 | Payslip self-service | No STAFF-level payslip self-service view. |
| BG-68 | Section 4.5.20 | Payroll approval | No payroll approval workflow (run -> review -> approve -> post). |

### 8.7.5 Reporting (Section 5)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-69 | Section 5.1.1 | P&L date range | No date range filtering exposed in getPnL() directly; relies on pre-filtered trial balance. |
| BG-70 | Section 5.1.1 | P&L comparative | No comparative periods (current vs prior). |
| BG-71 | Section 5.1.1 | P&L segmentation | No departmental or cost-center segmentation. |
| BG-72 | Section 5.1.2 | BS as-of date | No "as of" date parameter; always returns cumulative balances. |
| BG-73 | Section 5.1.2 | BS retained earnings | No retained earnings / net income rollup into equity. |
| BG-74 | Section 5.1.2 | BS comparative | No comparative balance sheet. |
| BG-75 | Section 5.1.4 | Cash flow data | Cash flow data partially available via TreasuryMovement and BankStatementLine but no report aggregates them. |
| BG-76 | Section 5.1.5 | VAT EU boxes | Box 2, 8, 9 hardcoded to zero (no EU/international VAT support). |
| BG-77 | Section 5.1.5 | MTD submission | No MTD API integration for actual HMRC submission. |
| BG-78 | Section 5.1.5 | VAT line tax rate | Does not use line-level taxRate field to determine correct tax code. |
| BG-79 | Section 5.1.9 | FA depreciation methods | Only straight-line supported; no declining balance or units-of-production. |
| BG-80 | Section 5.1.10 | FX gain/loss distinction | No unrealised vs realised gain/loss distinction. |
| BG-81 | Section 5.1.11 | Report dispatcher types | No support for additional report types (cash flow, VAT, asset register) in dispatcher. |
| BG-82 | Section 5.2.1.2 | Variance report model | Does not use VarianceReport model from schema (tracks material, labour, overhead variances separately). |
| BG-83 | Section 5.4.2 | AI context scope | No aggregation or summary statistics in context; just raw recent records. |
| BG-84 | Section 5.4.3 | Cross-tenant forecasting | Not available (by design, tenant-scoped data). |
| BG-85 | Section 5.4.4 | AI report tools | No report-specific tools (e.g., generate trial balance, P&L). |
| BG-86 | Section 5.5.1 | Schedule execution | Schedule definitions exist but nothing triggers them. |
| BG-87 | Section 5.6.2 | Placeholder event handlers | Many events have placeholder handlers that only console.log (invoice.paid, payment.applied, po.approved, etc.). |

### 8.7.6 Cross-Module Interactions (Section 6)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-88 | Section 6.1.5 | Dual event systems | Older `lib/events` (DomainEvent with 8 types) and newer `server/events` (NexaEvent with 50+ types) coexist without unification. [CONTRADICTION-RESOLVED: CR-10 -- modern NexaEvent system is canonical.] |
| BG-89 | Section 6.1.6 | No job worker | Redis queue has no worker/consumer loop. Infrastructure-ready but not wired to business process. |
| BG-90 | Section 6.2.6 | POS refund no reversal | POS refund does not reverse inventory or finance entries. |
| BG-91 | Section 6.2.7 | No SO reservation | No automatic inventory reservation on sales order creation. |
| BG-92 | Section 6.3.1 | Sales cycle stubs | Full sales cycle has event types defined end-to-end but most transitions not wired with real logic. |
| BG-93 | Section 6.3.4 | Payroll GL NI gap | No NI employer contribution line in payroll GL posting. Only PAYE deductions calculated. |
| BG-94 | Section 6.5.2 | Propagation not enforced | writes and idempotency fields populated but not enforced at runtime. Only requiredEmits checked. |
| BG-95 | Section 6.5.2 | Idempotency disabled | Most registry entries have idempotency.required = false and key = null. |
| BG-96 | Section 6.6.2 | Workflow enforcer not wired | No evidence of enforcer being called from actual business module code. Framework exists but integration points not wired. [CONTRADICTION-RESOLVED: XR-4 -- Framework exists but is aspirational. PRD must specify which operations require workflows.] |

### 8.7.7 Management Platform (Section 7)

| # | Source | Rule Gap | Description |
|---|--------|----------|-------------|
| BG-97 | Section 7.1.5 | TenantConfig catch-all | config JSON field acts as catch-all bag. Should be broken into typed tables. |
| BG-98 | Section 7.1.8 | No tenant suspension | No tenant suspension/reactivation API. status = "suspended" documented but no service implements transition. |
| BG-99 | Section 7.2.10 | Password complexity | No password complexity validation for regular users. Only SUPER_ADMIN has policy enforcement. |
| BG-100 | Section 7.2.10 | Account lockout | No account lockout after failed login attempts. |
| BG-101 | Section 7.2.10 | Session invalidation | No session invalidation mechanism beyond JWT expiry (8 hours). |
| BG-102 | Section 7.3.8 | Role normalization inconsistency | lib/rbac/matrix.ts maps unknown -> VIEWER; lib/auth/roles.ts maps unknown -> STAFF. [CONTRADICTION-RESOLVED: CR-3 -- canonical is VIEWER (least privilege).] |
| BG-103 | Section 7.3.8 | No dynamic permissions | Permissions hardcoded in static matrix. No database-backed dynamic permission assignment per user or custom role creation. |
| BG-104 | Section 7.3.8 | No role hierarchy | Each permission must explicitly list all allowed roles. No inheritance. |
| BG-105 | Section 7.4.13 | Three plan models | Plan, BillingPlan, and BillingPlanTemplate. Only BillingPlanTemplate actively used. Others are legacy/unused. [CONTRADICTION-RESOLVED: CR-16 -- BillingPlanTemplate is canonical.] |
| BG-106 | Section 7.4.15 | No billing history | No billing history/invoice history for tenants. |
| BG-107 | Section 7.4.15 | No usage-based billing | No usage-based billing beyond AI query counting. |
| BG-108 | Section 7.4.15 | No module licensing entity | No dedicated ModuleLicense entity. Module licensing entirely in JSON fields. [CONTRADICTION-RESOLVED: XR-8 -- Section 7.5 describes module licensing as if it works (and it does via JSON), but the entity it relies on (TenantModule) does not exist in the schema. R-111 recommends creating a `TenantModule` junction table.] |
| BG-109 | Section 7.4.15 | No module usage tracking | No module usage tracking or per-module billing. |
| BG-110 | Section 7.7.1 | Audit log retention | No audit log retention/archival policy. |
| BG-111 | Section 7.7.1 | Audit log search | No audit log search/query API for tenants. |
| BG-112 | Section 7.7.1 | Login/logout audit | No audit log for user login/logout events. |
| BG-113 | Section 7.7.1 | CRUD audit | No audit log for data modification events (CRUD on business entities). |
| BG-114 | Section 7.7.1 | Tenant suspension workflow | No tenant suspension/unsuspension workflow in super-admin services. |
| BG-115 | Section 7.7.1 | Bulk operations | No bulk operations (e.g., bulk email tenants, bulk update plans). |
| BG-116 | Section 7.7.1 | Special tenant inconsistency | PLATFORM stores most configs but NEXA_ROOT stores runbooks. Should be consolidated. [CONTRADICTION-RESOLVED: IT-11, XR-9 -- Consolidate to PLATFORM or PlatformConfig table.] |
| BG-117 | Section 7.7.1 | Tenant isolation RLS | Every query must include tenantId in WHERE clause enforced at application level, not database level. No RLS policies. |

---

## 8.8 Recommendations for New Project

All `[RECOMMEND]` flags organized by module.

### 8.8.1 Invoicing & Accounts

| # | Source | Recommendation |
|---|--------|---------------|
| R-1 | Section 1.1.1 | New project should have a CustomerContact entity (multiple contacts per customer). |
| R-2 | Section 1.1.2 | Snapshot billing address at invoice creation time. |
| R-3 | Section 1.1.2 | Support line-level discounts (% and fixed amount). |
| R-4 | Section 1.1.2 | Configurable number sequences per document type. |
| R-5 | Section 1.1.3 | Single receipt endpoint with flexible allocation array. |
| R-6 | Section 1.3.1 | Single endpoint per operation, consistent naming. Eliminate duplicate endpoints. |
| R-7 | Section 1.3.3 | Single GL system (modern), no legacy models, separate OAuth from financial accounts. |
| R-8 | Section 1.3.4 | COA templates seeded on tenant provisioning, with CRUD API for template management. |
| R-9 | Section 1.5.1 | Relational VAT return storage with proper HMRC MTD integration via third-party. |

### 8.8.2 Inventory/Stock

| # | Source | Recommendation |
|---|--------|---------------|
| R-10 | Section 2.1.5 | Migrate item metadata from TenantConfig JSON to proper InventoryItem columns or a dedicated ItemMaster model. |
| R-11 | Section 2.2.8 | Add a GET /api/inventory/movements endpoint for movement history with filtering. |
| R-12 | Section 2.3.3 | Add proper warehouse address/config fields and Location management APIs. |
| R-13 | Section 2.3.12 | Migrate pick/pack/ship to database-backed models using existing Wave, PickTask, Shipment Prisma models. |
| R-14 | Section 2.4.2 | Consolidate into a single transfer mechanism with proper database backing. |
| R-15 | Section 2.5.5 | Implement QualityInspection workflow with full CRUD and tie to receiving process. |
| R-16 | Section 2.6.6 | Consolidate cycle counts into database-backed implementation and add GL posting for adjustments. |
| R-17 | Section 2.7.2 | Implement full ATP with supply/demand netting: onHand - reserved - openDemand + incomingSupply. |
| R-18 | Section 2.7.2 | Build Reservation CRUD and integrate with sales order and shipment workflows. |
| R-19 | Section 2.8.2 | Add lot number generation, expiry tracking, and enforce batch/serial requirements per item. |
| R-20 | Section 2.9.7 | Create a dedicated CostLedger table for per-item-per-warehouse cost tracking. |
| R-21 | Section 2.9.7 | Implement point-in-time valuation using StockMove history. |
| R-22 | Section 2.10.2 | Migrate replenishment to database-backed storage and add API endpoints. |
| R-23 | Section 2.11.1 | Create RMA Prisma model and API routes, integrate with inventory and finance. |
| R-24 | Section 2.12.1 | Implement landed cost CRUD API and allocation to item cost. |
| R-25 | Section 2.14.1 | Verify that FactInventoryMovement rows are created for every StockMove. |

### 8.8.3 CRM/Sales

| # | Source | Recommendation |
|---|--------|---------------|
| R-26 | Section 3.1.6 | Add RBAC permission check (crm:manage, crm:view) beyond module toggle. |
| R-27 | Section 3.1.6 | Remove legacy file-based store or add migration path. |
| R-28 | Section 3.2.5 | Standardize on single implementation (remove file-based store). |
| R-29 | Section 3.3.4 | Add parent-child account hierarchy to DB schema. |
| R-30 | Section 3.4.7 | Create PipelineStage model for configurable pipelines. |
| R-31 | Section 3.4.7 | Add weighted pipeline value aggregation. |
| R-32 | Section 3.5.6 | Implement quote-to-order conversion. |
| R-33 | Section 3.5.6 | Add tax calculation to quote lines. |
| R-34 | Section 3.5.6 | Implement version incrementing for quote revisions. |
| R-35 | Section 3.6.7 | Build proper SalesOrder CRUD API using the SalesOrder model. |
| R-36 | Section 3.6.7 | Implement order fulfillment workflow (confirm -> ship -> invoice). |
| R-37 | Section 3.7.4 | Fix completeActivity to also set status = "completed". |
| R-38 | Section 3.7.4 | Add update endpoint for activities. |
| R-39 | Section 3.8.5 | Enforce single default price book per tenant. |
| R-40 | Section 3.8.5 | Integrate price book lookup into quote/order line creation. |
| R-41 | Section 3.9.2 | Build proper CPQ workflow integrating price books, discount approval, and quote generation. |
| R-42 | Section 3.11.21 | Consolidate to single DB-backed POS implementation. |
| R-43 | Section 3.11.21 | Implement Z-report generation. |
| R-44 | Section 3.11.21 | Build Stripe Terminal integration. |
| R-45 | Section 3.12.11 | Build full purchasing API with proper status transitions. |
| R-46 | Section 3.12.11 | Implement goods receipt and three-way matching. |
| R-47 | Section 3.12.11 | Move RFQs and supplier status to proper DB tables. |
| R-48 | Section 3.13.2 | Implement bidirectional HubSpot sync or remove schema. |

### 8.8.4 HR/Payroll

| # | Source | Recommendation |
|---|--------|---------------|
| R-49 | Section 4.1.1 | All employee metadata fields should be proper columns on Employee table with FKs and indexes. |
| R-50 | Section 4.2.5 | Create EmployeeDepartment join table, add departmentId FK to Employee, build department hierarchy. |
| R-51 | Section 4.3 | Create dedicated LeaveRequest, LeaveType, LeaveBalance tables. |
| R-52 | Section 4.3.3 | Implement working-day calculation with bank holiday support. |
| R-53 | Section 4.3.3 | Add approval workflow with email notifications. |
| R-54 | Section 4.5 | Use Staffology/PayRun.io API for all tax calculations and RTI submissions. |
| R-55 | Section 4.5 | Single payroll pipeline: draft -> calculate (via API) -> review -> approve -> post GL. |
| R-56 | Section 4.0 | Create proper REST or tRPC API layer with auth middleware. |
| R-57 | Section 4.1 | Proper employee lifecycle: onboarding -> active -> leave of absence -> offboarding -> terminated. |
| R-58 | Section 4.2 | Hierarchical department structure with cost centre mapping. |
| R-59 | Section 4.5.20 | Employee self-service portal for payslips, leave requests, personal details. |
| R-60 | Section 4.6 | ATS integration or built-in recruitment pipeline. |
| R-61 | Section 4.7 | Training and development tracking with course management. |
| R-62 | Section 4.8 | Employee document management with expiry tracking. |
| R-63 | Section 4.4 | Time and attendance tracking with payroll integration. |
| R-64 | Section 4.9 | HR analytics dashboard (headcount, turnover, absence rates). |

### 8.8.5 Reporting

| # | Source | Recommendation |
|---|--------|---------------|
| R-65 | Section 5.1.1 | Add support for comparative periods, budget vs. actual, and department-level breakdown. |
| R-66 | Section 5.1.2 | Add as-of date filtering, retained earnings calculation, and comparative periods. |
| R-67 | Section 5.1.3 | Consolidate into a single trial balance implementation using the new GL model. |
| R-68 | Section 5.1.4 | Implement cash flow report using indirect method (from P&L and BS changes) or direct method (from bank transactions). |
| R-69 | Section 5.1.5 | Implement MTD VAT obligations API, 9-box submission, and fraud prevention headers. |
| R-70 | Section 5.1.8 | Remove the take: 50 limit or use aggregate queries for accurate totals. |
| R-71 | Section 5.1.9 | Add additional depreciation methods. |
| R-72 | Section 5.1.11 | Extend the dispatcher to support all available report types with parameter passthrough. |
| R-73 | Section 5.2.1.2 | Integrate with VarianceReport model for type-specific variance analysis. |
| R-74 | Section 5.2.1.3 | Build a variance analysis report for detailed standard vs. actual cost comparison. |
| R-75 | Section 5.2.2 | Build inventory valuation report using InventoryLot data (FIFO) and stock movement summaries. |
| R-76 | Section 5.2.3 | Build sales analytics reports using data warehouse fact tables. |
| R-77 | Section 5.2.4 | Build HR reports using Employee, PayrollRun, and Payslip models. |
| R-78 | Section 5.2.5 | Build POS analytics reports using FactReceipt and DimChannel. |
| R-79 | Section 5.2.6 | Build project analytics using FactProjectWip and WipLedger. |
| R-80 | Section 5.3.3 | Implement true inventory valuation, parallelize KPI queries, add error filtering for AI errors. |
| R-81 | Section 5.3.4 | Connect KPI dashboard API to getKpiValuesForTenant() service for real data. |
| R-82 | Section 5.3.5 | Implement scheduled KPI snapshot capture and historical trending charts. |
| R-83 | Section 5.4.3 | Add more deterministic analytics intents (AP aging summary, inventory value, project profitability). |
| R-84 | Section 5.4.4 | Add report generation tools to AI agent registry. |
| R-85 | Section 5.5.1 | Implement cron-based scheduler, report rendering pipeline, and email/Slack delivery. |
| R-86 | Section 5.5.2 | Add PDF and CSV export capabilities to report dispatcher. |
| R-87 | Section 5.6.1 | Consolidate into a single period close mechanism. |
| R-88 | Section 5.6.3 | Build analytics queries and dashboards that consume the star schema fact tables. |
| R-89 | Section 5.6.4 | Implement metric collection and visualization using MetricPoint/MetricsSnapshot models. |

### 8.8.6 Cross-Module Interactions

| # | Source | Recommendation |
|---|--------|---------------|
| R-90 | Section 6.3.1 | Wire sales.order.created subscriber to reserve inventory. Wire sales.order.fulfilled to create stock movements. Wire sales.invoice.created to post AR journal entries. Wire finance.invoice.paid to apply payment and update balance. |
| R-91 | Section 6.3.2 | Add purchasing.bill.created and purchasing.bill.paid event types. Wire GRN receipt to create supplier bill. Wire bill payment to create AP journal entries. |
| R-92 | Section 6.3.3 | Wire material issue costs to accumulate on work order. On completion, calculate actual vs standard cost variance. Post variance to GL. |
| R-93 | Section 6.3.5 | Refactor POS-to-Finance posting to use event system for consistency and replay support. |
| R-94 | Section 6.6.2 | Wire requireWorkflowApproval into finance invoice posting, PO approval, and other critical business operations. |
| R-95 | Section 6.8 | Implement actual provider API clients for QuickBooks, Sage, Xero. Map external entities to Nexa ERP models. |
| R-96 | Section 6.8.3 | Replace with real OAuth flows and credential storage for each connector type. |
| R-97 | Section 6.9 | Consider implementing PostgreSQL RLS policies as defense-in-depth measure. |
| R-98 | Section 6.9 | Add email templates for: invoice PDF, order confirmation, payment receipt, stock alert digest, workflow approval request, password reset. |
| R-99 | Section 6.13 | Unify event systems: merge older lib/events and newer server/events into single event bus. |
| R-100 | Section 6.13 | Complete subscriber wiring for critical cross-module events (invoice GL, PO budget, SO reservation, POS refund reversal, manufacturing costing). |
| R-101 | Section 6.13 | Wire workflow enforcer to critical business operations. |
| R-102 | Section 6.13 | Implement database-level tenant isolation via PostgreSQL RLS. |
| R-103 | Section 6.13 | Build real external integrations (QuickBooks/Sage/Xero) with OAuth2, field mapping, conflict resolution, bidirectional sync. |
| R-104 | Section 6.13 | Implement saga orchestration using outbox as persistence layer for multi-step processes. |
| R-105 | Section 6.13 | Expand notification system with business event emails and per-user notification preferences. |
| R-106 | Section 6.13 | Enhance AI context with aggregations, trend summaries, anomaly detection, user-relevant filtering. |

### 8.8.7 Management Platform

| # | Source | Recommendation |
|---|--------|---------------|
| R-107 | Section 7.1.5 | Create dedicated tables: TenantPolicy, TenantComplianceConfig, UserPreference, PlatformConfig. Replace TenantConfig JSON bag. |
| R-108 | Section 7.1.8 | In new architecture, each tenant should have its own database. Management database contains: tenant metadata, billing config, user directory, plan assignments. |
| R-109 | Section 7.3.8 | Implement database-backed RBAC with: Role table, Permission table, RolePermission junction, UserRole assignment per tenant. Allow custom roles. |
| R-110 | Section 7.4.10 | Management database should have: Plan, PlanFeature, Subscription (Stripe sync), BillingInvoice, PaymentRecord, UsageRecord. Stripe webhook processing for subscription lifecycle. |
| R-111 | Section 7.4.15 | Create TenantModule junction table: tenantId, moduleCode, enabled, enabledAt, source (plan/override). Enables proper audit trail. |
| R-112 | Section 7.6 | Implement: ApiKeyService (create, rotate, revoke, validate), WebhookService (register, deliver with retry, event logging), RateLimitMiddleware (per-key limits using Redis). |
| R-113 | Section 7.7.1 | Audit logs should be append-only with configurable retention. Consider separate audit database or event streaming (e.g., S3/CloudWatch). |
| R-114 | Section 7.7.1 | Implement proper MFA enforcement, backup scheduling, key management (AWS KMS / Azure Key Vault), and push notifications. |
| R-115 | Section 7.7.1 | Platform-level configuration should be stored in dedicated PlatformConfig table rather than hijacking tenant model. |

---

## 8.9 Priority Matrix

Classification of all gaps and recommendations by priority tier across modules. Priority definitions:
- **P0 (Critical):** Must have for MVP. Missing this blocks core business operations or creates regulatory/compliance risk.
- **P1 (High):** Should have for launch. Missing this significantly degrades user experience or operational capability.
- **P2 (Medium):** Nice to have. Enhances capability but not required for initial launch.

### 8.9.1 Invoicing & Accounts

| Priority | Area | Items | Key Issues |
|----------|------|-------|-----------|
| **P0** | Single GL System | SC-20, SC-88-90, R-7 | Two parallel GL systems (legacy + modern) cause confusion and risk double-posting. Must consolidate to one. |
| **P0** | Schema Completeness | SG-1-17, SG-18-25, SG-31-35, SG-38-42 | Customer, Supplier, Invoice, GL Account, Bank Account all missing critical fields. |
| **P0** | Invoice PDF/Email | MF-5, MF-6 | Cannot issue invoices to customers without PDF generation and email sending. |
| **P0** | Hardcoded GL Codes | SC-12, SC-16, SC-26 | All GL account codes are hardcoded strings. Must be configurable per tenant via Chart of Accounts. |
| **P0** | VAT/MTD Compliance | MF-46, PA-3, PA-4, SC-23-24, BG-7-9, R-9 | UK legal requirement. VAT boxes incomplete, stored in JSON, no MTD integration. |
| **P0** | Period Management | BG-4, MF-49-51, SC-105 | Dual period close mechanisms. No year-end close. No fiscal year configuration. |
| **P0** | Bank Reconciliation | MF-41-44, SC-22, BG-5-6 | Missing multi-match, rules, balance assertion, reconciliation report. Mappings in JSON. |
| **P1** | Invoice Features | MF-4, MF-7-10, R-2-4 | Recurring, duplication, batch, pro-forma, void, configurable numbering. |
| **P1** | Payment Processing | MF-11-13, MF-24-28, SC-4, SC-14-15, R-5 | Batch payments, BACS, direct debit, consolidate duplicate endpoints. |
| **P1** | Three-Way Matching | MF-20-21, SG-26-30 | PO vs GRN vs Invoice matching. PO schema gaps (received qty, tax, UOM). |
| **P1** | Customer/Supplier Mgmt | MF-1-3, R-1 | Delete, merge, statements, CustomerContact entity. |
| **P1** | Fixed Assets | SG-43-45, SC-25, SC-27, MF-47-48 | Missing depreciation methods, disposed check, impairment, grouping. |
| **P1** | FX Management | MF-52-55, SC-29-30, BG-80 | No realized gain/loss, rate provider, historical rates, currency mgmt. |
| **P1** | Duplicate Endpoints | SC-3, SC-10, SC-14, R-6 | Multiple duplicate create/payment endpoints. Consolidate in new project. |
| **P2** | GL Advanced Features | MF-29-37 | Hierarchy, cost centers, posting restrictions, recurring journals, budgets, intercompany. |
| **P2** | COA Templates | MF-38-39, SG-36-37, R-8 | Template API/UI, type enum fix, unique constraint. |
| **P2** | Aging/Dunning | MF-17-19 | Configurable buckets, dunning automation, interest calculation. |
| **P2** | Credit Note Approval | BG-1 | Currently posted immediately without approval workflow. |
| **P2** | Write-Off Controls | MF-15-16, BG-2 | Reversal, approval workflow, configurable GL codes. |

### 8.9.2 Inventory/Stock

| Priority | Area | Items | Key Issues |
|----------|------|-------|-----------|
| **P0** | Item Master Migration | SG-47, SC-31-32, SC-34-35, R-10 | Item metadata in JSON blob, not relational. No schema validation. Search is no-op. |
| **P0** | Database-Backed Storage | SC-40-47, R-13-14, R-22-23 | Pick/pack/ship, transfers, receiving, replenishment, RMA all in file-based JSON storage. |
| **P0** | Transaction Safety | SC-36-37 | Stock transfers and movements not transactional. Failure midway creates inconsistent state. |
| **P0** | Location/Warehouse Mgmt | SG-48-49, MF-56-57, SC-39, R-12 | Missing fields, no Location CRUD, globally unique warehouse code instead of per-tenant. |
| **P1** | Costing System | SG-50, BG-26-29, SC-45, R-20-21 | No standard cost, FIFO/WAV not unified, cost in JSON, no point-in-time valuation. |
| **P1** | ATP Enhancement | BG-22-24, MF-64-65, R-17-18 | Ignores Reservation model, no supply/demand netting, no SO integration. |
| **P1** | Lot/Batch Management | MF-66-69, BG-10, BG-25, R-19 | No lot generation, no query API, no serial tracking, no expiry, flags not enforced. |
| **P1** | Quality Management | ST-6-7, MF-62-63, R-15 | QualityInspection and CAPA are schema-only. No inspection workflow. |
| **P1** | WMS Consistency | BG-13-16, MF-60, FG-9 | Dual shipment systems, pick inconsistency, no pack step, no over-receiving check. |
| **P1** | Landed Cost | ST-8, MF-71, MF-75-76, R-24 | Model exists but no service, no allocation, no valuation impact. |
| **P1** | Movement History | MF-77, BG-12, R-11 | No movement history API. No audit trail query endpoint. |
| **P2** | ASN | ST-3, MF-58-59 | Schema model only; no implementation. |
| **P2** | Replenishment | MF-72, BG-30-31 | No API routes, no auto PO, no lead time consideration. |
| **P2** | RMA Integration | MF-73-74 | No inventory or credit note integration. |
| **P2** | Cycle Count GL | BG-19-21 | No GL for variances, no scheduled counts, no approval workflow. |
| **P2** | Manufacturing GL | BG-32-33 | No costing GL for manufacturing, no scrap movements. |

### 8.9.3 CRM/Sales

| Priority | Area | Items | Key Issues |
|----------|------|-------|-----------|
| **P0** | Remove Dual Implementations | SC-48-58, R-27-28 | Every CRM entity has file-based AND DB-backed stores. Consolidate to single DB-backed. |
| **P0** | Sales Order System | SC-56, MF-79-82, PA-10, R-35-36 | Uses wrong model (OrderExternal). No CRUD, no status transitions, no fulfillment workflow. |
| **P0** | Quote-to-Order-to-Invoice | MF-78, MF-80, R-32 | No conversion functions exist. Core sales workflow is broken. |
| **P0** | RBAC for CRM | BG-36, R-26 | No role-based permission granularity beyond module toggle. |
| **P1** | Pipeline Configuration | SG-54, BG-40-41, R-30-31 | Stages hardcoded as strings. No ordering enforcement. No weighted pipeline value. |
| **P1** | Quote Lifecycle | BG-42-45, R-33-34 | No editing guards, timestamps unpopulated, version never incremented, no tax on lines. |
| **P1** | Audit Fields | BG-38 | createdBy, updatedBy never populated across contacts, accounts, opportunities. |
| **P1** | Owner Validation | BG-35 | ownerUserId has no FK constraint or validation (leads, contacts, accounts, opportunities). |
| **P1** | POS Consolidation | SC-59-63, PA-12, R-42-44 | Triple implementation, console.log audit, register in JSON. Consolidate to single DB-backed. |
| **P1** | Purchasing API | MF-89-91, SC-64-65, R-45-47 | No REST API, RFQs in JSON, supplier disable in JSON, no goods receipt, no PO-to-bill. |
| **P1** | Activity Bug Fix | BG-47-48, R-37-38 | completeActivity doesn't update status. No update endpoint. |
| **P2** | Price Books | BG-49-50, R-39-40 | No default enforcement, no linkage to quotes/orders. |
| **P2** | Account Hierarchy | SG-53, R-29 | DB schema lacks parent-child support. |
| **P2** | Cascade Delete | BG-39 | No cascade protection on account delete. |
| **P2** | CPQ | ST-9, MF-83-84, R-41 | 3-line stub. No approval workflow, no product configuration. |
| **P2** | Contact/Lead Schema | SG-51-52 | Missing description/notes on leads, address on contacts. |
| **P2** | HubSpot Integration | SG-65, MF-92, R-48 | Schema-only; no sync logic. |
| **P2** | POS Advanced Features | BG-51-54, MF-85-88 | No offline, no Stripe Terminal, no Z-reports, no promotions, no drawer logic. |

### 8.9.4 HR/Payroll

| Priority | Area | Items | Key Issues |
|----------|------|-------|-----------|
| **P0** | Employee Schema | SG-66-69, SG-72-77, R-49-50 | Employee model missing nearly all operational fields. All in JSON. No department FK. |
| **P0** | API Layer | MF-93, BG-58, R-56 | No API routes or tRPC routers. All HR is server-side functions only. |
| **P0** | Frontend Pages | MF-94, FG-10 | No UI pages for any HR functionality despite routes defined. |
| **P0** | Payroll Tax Calculations | SC-77-80, R-54 | Simplified demo tax calculators. Hardcoded salaries. Use Staffology/PayRun.io API. |
| **P0** | Leave Management | SG-70-71, R-51, BG-63-65, R-52-53 | No LeaveRequest/LeaveType/LeaveBalance models. No weekend exclusion. No approval workflow. |
| **P0** | Data Storage | SC-85-87 | Dual storage (Prisma + JSON). Triple payroll implementations. Must consolidate. |
| **P1** | Single Payroll Pipeline | SC-83, R-55 | Two GL posting mechanisms. Three parallel implementations. Need single pipeline. |
| **P1** | Employee Lifecycle | MF-95-97, R-57 | No delete, no search, no proper lifecycle (onboarding -> active -> ... -> terminated). |
| **P1** | Department/Team CRUD | MF-98-99, R-58 | No services, no API. Hierarchical structure needed with cost centres. |
| **P1** | Self-Service Portal | BG-59, BG-67, R-59 | No employee view of own record, no payslip self-service. |
| **P1** | Leave-Payroll Integration | BG-66 | Leave data captured but not used to adjust pay. |
| **P1** | Payslip Security | SC-81, PA-18 | PDF saved to public directory with no access control. |
| **P1** | Encryption Fix | SC-67 | Plaintext stored alongside encrypted defeats encryption purpose. |
| **P2** | Attendance | MF-104, R-63 | No attendance/time tracking in HR module. |
| **P2** | Recruitment | MF-108, R-60 | No recruitment functionality. ATS needed. |
| **P2** | Training | MF-109, R-61 | No training or development tracking. |
| **P2** | Document Management | MF-110, R-62 | No employee document management. |
| **P2** | HR Analytics | R-64 | No headcount, turnover, or absence rate dashboards. |
| **P2** | BACS Integration | PA-17 | File generation exists but not integrated with pay runs. |
| **P2** | Audit Events | MF-111 | No audit events for HR operations. |

### 8.9.5 Reporting & Cross-Module

| Priority | Area | Items | Key Issues |
|----------|------|-------|-----------|
| **P0** | Financial Reports | BG-69-75, R-65-68 | P&L lacks date range/comparative. BS lacks as-of date/retained earnings. No cash flow statement. |
| **P0** | Export Capability | MF-121-123, R-86 | No PDF, CSV, or Excel export for any report. |
| **P0** | Event System Unification | BG-88, PA-28, R-99 | Two parallel event systems (lib/events vs server/events). Must unify. |
| **P0** | Invoice GL Auto-Posting | MF-132, R-90 | Invoices/bills do not create GL entries via events. Only payroll does. |
| **P0** | Tenant Isolation RLS | MF-134, BG-117, R-97, R-102 | Application-layer only. No database-level Row-Level Security. |
| **P1** | Subscriber Wiring | PA-37-55, BG-92, R-100 | ~70% of event subscribers are stubs or logs-only. Critical cross-module flows not wired. |
| **P1** | MTD VAT Submission | MF-113, PA-19, R-69 | HMRC MTD schema exists but no submission code. UK legal requirement. |
| **P1** | KPI Dashboard | ST-14, PA-22, R-81-82 | Returns hardcoded mock data. KpiSnapshot model unused. |
| **P1** | Report Scheduler | MF-119-120, PA-25, BG-86, R-85 | Schedule definitions exist but nothing triggers them. No rendering pipeline. |
| **P1** | Workflow Enforcer | BG-96, R-94, R-101 | Framework exists but not wired to any business operations. |
| **P1** | RBAC Database-Backed | BG-103-104, R-109 | Static hardcoded matrix. No custom roles. No inheritance. Must be database-backed. |
| **P1** | Billing/Stripe | PA-58-60, BG-105-107, SC-120, R-110 | Skeletal Stripe integration. Three plan models. No webhooks, no customer ID persistence. |
| **P1** | Sales Cycle Wiring | PA-37-44, R-90 | Full lead-to-cash event flow defined but not wired with real logic. |
| **P1** | Procurement Cycle Wiring | PA-45-46, MF-126-130, R-91 | GRN-to-metrics works but PO-to-Bill and Bill-to-Payment not wired. No GL posting. |
| **P1** | POS Refund Reversal | MF-131, BG-90, PA-52 | No inventory or finance reversal on POS refund. |
| **P2** | Stock Reports | MF-114, R-75 | No stock valuation, turnover, or reorder point reports. |
| **P2** | Sales Reports | MF-115, R-76 | No pipeline conversion, sales by customer/product reports. |
| **P2** | HR Reports | MF-116, R-77 | No headcount, payroll cost, or absence reports. |
| **P2** | POS Reports | MF-117, R-78 | No daily sales summary, product mix reports. |
| **P2** | Project Reports | MF-118, R-79 | No profitability, utilization, or WIP aging reports. |
| **P2** | Data Warehouse | MF-124-125, R-88-89 | Fact tables populated but no dashboards or queries read from them. |
| **P2** | External Integrations | ST-15-18, R-95-96, R-103-104 | Orchestration, external sync, connectors all stubbed. |
| **P2** | Saga Orchestration | ST-15, R-104 | In-memory queue placeholder. Needs durable saga pattern. |
| **P2** | API Key/Webhook Platform | MF-135-140, ST-23-25, R-112 | Schema exists but no services. Critical for multi-tenant SaaS. |
| **P2** | Notification System | PA-54, ST-30, R-98, R-105 | Only 1 email template. No business event notifications. |
| **P2** | AI Context Enhancement | SC-112-113, R-106 | Limited to 5 records per entity. Needs aggregation and semantic search. |
| **P2** | Platform Operations | ST-26-30, R-113-115 | SIEM, backup/DR, demo data, encryption keys, notifications all schema-only. |
| **P2** | Super-Admin Auth | ST-20, PA-56-57, BG-99-101 | Re-auth stub, MFA advisory-only, no password complexity, no lockout, no session invalidation. |
| **P2** | Audit Logging | BG-110-113, R-113 | No retention policy, no search API, no login/logout events, no CRUD events. |

---

## Summary Statistics

| Flag Type | Count |
|-----------|-------|
| SCHEMA-GAP | 79 |
| MISSING | 140 |
| STUBBED | 30 |
| PARTIAL | 62 |
| SHORTCUT | 123 |
| GAP | 117 |
| FRONTEND-GAP | 10 |
| RECOMMEND | 115 |
| **Total flagged items** | **676** |

| Priority | P0 (Critical) | P1 (High) | P2 (Medium) |
|----------|---------------|-----------|-------------|
| Invoicing & Accounts | 7 areas | 7 areas | 5 areas |
| Inventory/Stock | 4 areas | 7 areas | 5 areas |
| CRM/Sales | 4 areas | 7 areas | 7 areas |
| HR/Payroll | 6 areas | 6 areas | 5 areas |
| Reporting & Cross-Module | 5 areas | 9 areas | 12 areas |
| **Totals** | **26 areas** | **36 areas** | **34 areas** |

---

*End of document — document will be updated incrementally as extraction progresses.*

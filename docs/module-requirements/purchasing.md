# Purchasing Module (PUR)

Suppliers, procurement, purchase orders, payments, and supplier management.

---

## Pages

### Suppliers
- Supplier master list with filters (group, status, category)
- **Features:**
  - Supplier details: name, addresses, contacts, phone, email
  - Supplier groups/categories
  - Payment terms (agreed with supplier)
  - Default currency
  - Tax registration (VAT number)
  - Bank details (for payment)
  - Supplier rating/evaluation
  - Supplier notes and activity history
  - Dimension defaults

### Supplier Items
- Items supplied by each supplier
- **Features:**
  - Supplier item code (may differ from internal item code)
  - Supplier price and currency
  - Lead time (days)
  - Minimum order quantity
  - Preferred supplier flag per item
  - Price break quantities

### Supplier Contracts
- Formal agreements with suppliers
- **Features:**
  - Contract details: start/end date, terms, value
  - Contracted pricing (override standard supplier prices)
  - Volume commitments
  - Contract status: Draft, Active, Expired, Terminated
  - Renewal reminders
  - Document attachments (signed contract PDF)

### Purchase Orders
- PO creation and management
- **Features:**
  - Create PO manually or from purchase plan / reorder point trigger
  - PO status: Draft, Sent, Partially Received, Fully Received, Invoiced, Cancelled
  - Expected delivery date
  - Multiple delivery addresses
  - PO approval workflow (by value threshold)
  - Email PO to supplier (with PDF)
  - Blanket/framework POs (call-off orders)

### Supplier Invoices (AP Invoices)
- Record and manage supplier invoices
- **Features:**
  - Match to PO and goods receipt (3-way matching)
  - Price/quantity variance handling
  - Invoice status: Draft, Matched, Approved, Paid, Disputed
  - Invoice approval workflow
  - Multi-currency invoices
  - Recurring supplier invoices (rent, subscriptions)
  - Debit note creation

### Payments
- Supplier payment processing
- **Features:**
  - Payment allocation to invoices (full or partial)
  - Payment run: batch payment generation
  - Payment methods: bank transfer (BACS), cheque, direct debit
  - Foreign currency payments with exchange rate
  - Payment remittance advice generation
  - Early payment discount tracking
  - Payment scheduling (pay on due date)

### Purchase Plans
- Procurement planning
- **Features:**
  - Auto-generate from reorder points
  - Auto-generate from sales forecast (cross-module)
  - Suggested POs grouped by supplier
  - Review and approve suggestions before creating POs
  - MRP (Materials Requirements Planning) integration

---

## Settings

- Supplier groups
- Payment terms
- Approval workflows (PO approval thresholds)
- Number series (POs, supplier invoices, debit notes, payments)
- Default accounts (payables, purchase, freight)
- 3-way matching tolerances (price %, quantity %)
- Purchase tax / VAT defaults
- Payment run settings (BACS file format, payment day)

---

## Reports

- Purchase by Supplier Report
- Purchase by Item Report
- Purchase by Period Report
- Outstanding AP / AP Aging Report
- PO Status Report (open, overdue, partially received)
- Supplier Statement
- 3-Way Matching Exceptions Report
- Supplier Spend Analysis
- Purchase Price Variance Report
- Payment Run Report
- Supplier Performance Report (on-time delivery %, quality)

---

## Maintenances (Batch Jobs)

- **Payment Run** — generate batch payments for approved invoices
- **PO Auto-Generation** — create POs from purchase plans
- **Recurring Invoice Generation** — auto-create recurring supplier invoices
- **Supplier Evaluation** — calculate supplier scores from delivery/quality data

---

## Exports & Imports

- Supplier master export/import
- Supplier item prices export/import
- Purchase orders export
- Payment file export (BACS format)
- Supplier contact list export

---

## Forms (Printable Documents)

- Purchase Order
- Goods Receipt Note
- Supplier Remittance Advice
- Debit Note
- Payment Voucher

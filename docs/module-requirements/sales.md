# Sales Module (SAL)

Customers, sales pipeline, pricing, orders, invoicing, and payments.

---

## Pages

### Customers
- Customer master list with filters (group, status, region, salesperson)
- **Features:**
  - Customer details: name, addresses (billing, shipping), contacts, phone, email
  - Customer groups/categories
  - Credit limit and credit terms (payment days)
  - Default price list assignment
  - Default VAT code
  - Default salesperson assignment
  - Currency preference
  - Customer-specific discounts
  - Customer notes and activity history
  - Statement preferences (email, post, frequency)
  - Tax registration (VAT number)
  - Dimension defaults (department, cost centre)

### Sales Persons
- Sales team management
- **Features:**
  - Salesperson details, commission %, targets
  - Territory/region assignment
  - Link to user account
  - Sales performance summary

### Pricing
- Price list management
- **Features:**
  - Multiple price lists (retail, wholesale, trade, VIP)
  - Price by customer, customer group, quantity break
  - Date-effective pricing (valid from/to)
  - Discount structures (% or fixed, stacking rules)
  - Currency-specific pricing
  - Promotional pricing with date ranges

### Quotations
- Quote creation and management
- **Features:**
  - Create quote with header (customer, date, validity, salesperson) + line items
  - Quote versioning (revisions)
  - Quote status: Draft, Sent, Accepted, Rejected, Expired
  - Convert quote to sales order (one-click)
  - Quote validity period with auto-expiry
  - Quote approval workflow (for discounts above threshold)
  - Email quote to customer (with PDF attachment)

### Sales Orders
- Order processing
- **Features:**
  - Create from quote or standalone
  - Order status: Draft, Confirmed, Partially Delivered, Fully Delivered, Invoiced, Cancelled
  - Delivery date and ship-to address
  - Partial delivery tracking
  - Back-order management
  - Stock availability check on order entry
  - Order approval workflow
  - Recurring orders (subscription-style)

### Invoices
- Sales invoice creation and management
- **Features:**
  - Create from sales order or standalone
  - Invoice status: Draft, Sent, Partially Paid, Paid, Overdue, Void
  - Line items with qty, price, discount, VAT, total
  - Multi-currency invoicing
  - Credit note creation (linked to invoice)
  - Proforma invoice generation
  - Recurring invoices
  - Late payment interest calculation
  - Batch invoicing (generate invoices for multiple orders)

### Payments / Receipts
- Record customer payments
- **Features:**
  - Payment allocation to invoices (full or partial)
  - Multiple payment methods (bank transfer, cash, cheque, card)
  - Overpayment handling (credit balance)
  - Foreign currency payments with exchange rate gain/loss
  - Payment matching suggestions (AI-assisted)
  - Direct debit collection batches

### Credit Notes
- Credit note creation
- **Features:**
  - Full or partial credit against original invoice
  - Reason codes (return, overcharge, goodwill, etc.)
  - Stock return linkage (if goods returned)
  - Apply credit to outstanding invoices or refund

### Sales Forecast
- Demand forecasting
- **Features:**
  - Historical sales analysis by item, customer, period
  - AI-assisted forecast generation
  - Manual adjustment of forecasts
  - Forecast vs actual tracking
  - Feed into Purchase Plans (cross-module)

---

## Settings

- Customer groups
- Payment terms (Net 30, Net 60, COD, etc.)
- Price lists
- Discount types and rules
- Sales regions/territories
- Commission structures
- Number series (quotes, orders, invoices, credit notes, receipts)
- Default accounts (receivables, revenue, discount, shipping)
- Invoice email templates
- Late payment interest rates
- Sales tax / VAT defaults

---

## Reports

- Sales by Customer Report
- Sales by Item Report
- Sales by Salesperson Report
- Sales by Period Report (daily, weekly, monthly)
- Outstanding Invoices / AR Aging Report
- Customer Statement
- Sales Order Backlog Report
- Quote Conversion Report (quotes → orders ratio)
- Sales Forecast vs Actual
- Commission Report
- Top Customers Report
- Price List Report
- Credit Note Report

---

## Maintenances (Batch Jobs)

- **Invoice Aging Update** — recalculate aging bands for all invoices
- **Late Payment Interest** — calculate and generate interest charges
- **Recurring Invoice Generation** — generate invoices from recurring templates
- **Statement Generation** — batch generate customer statements

---

## Exports & Imports

- Customer master export/import
- Price list export/import
- Sales orders export
- Invoice export (for accountant/auditor)
- Customer contact list export

---

## Forms (Printable Documents)

- Sales Invoice
- Proforma Invoice
- Credit Note
- Sales Quote / Quotation
- Sales Order Confirmation
- Delivery Note
- Customer Statement
- Cash Receipt

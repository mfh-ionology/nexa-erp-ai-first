# Nexa ERP — All Modules Summary

Quick-reference listing: Pages, Settings, Features, and Reports for every module.
Items in <span style="color:red">red</span> can be deferred to a later phase without blocking core functionality.

---

## Module 1: Finance (FIN)

### Pages
1. **Chart of Accounts** — hierarchical account list, balances, create/edit/deactivate
2. **Journal Entries** — manual journals, recurring, reversing
3. **Bank Accounts** — bank setup, balances, feed import
4. **Bank Reconciliation** — side-by-side matching, auto-match rules
5. **Budgets** — entry grid by account/period, versions, budget keys
6. **Simulations** — what-if scenarios, compare, convert to budget/journal
7. **Dimensions** — dimension types and values, hierarchies
8. **Financial Years & Periods** — (managed in Settings)
9. **Inter-Company Transactions** — cross-company journals, auto-matching, reconciliation
10. **Consolidation** — group statements, eliminations, currency translation, drill-down

### Settings
1. Accounting Periods (calendar, open/close, locking)
2. Financial Years (start/end, year-end close, retained earnings account)
3. Base Currencies — Base 1 & Base 2 per company
4. Currencies table
5. Currency Exchange Rates (manual + auto-sync from online service)
6. Number Series (NL transactions, simulations)
7. VAT Codes (standard, reduced, zero, exempt, reverse charge, flat rate)
8. Rate Gain/Loss (realised/unrealised accounts, revaluation settings)
9. Sub Systems (AR, AP, Payroll, FA, Inventory sources)
10. Sub-Ledger Control Accounts (receivables, payables, stock control mappings)
11. Budget Versions
12. Budget Keys (distribution patterns across months)
13. Inter-Company Settings (account mapping, clearing accounts, auto-posting rules)
14. Consolidation Settings (group definition, ownership %, group COA mapping, elimination rules, translation method)

### Features

**Chart of Accounts:** Account types (Asset/Liability/Equity/Revenue/Expense), sub-accounts, default VAT code, dimension tagging, block posting to header accounts

**Journals:** Recurring templates, reversing journals, attachments, sub-ledger source tracking

**Bank:** Account setup (name, number, sort code, currency, GL link), opening balances, feed import (OFX/CSV/QIF), manual entry

**Bank Reconciliation:** Auto-matching rules, manual matching, adjustment entries, reconciliation history/audit trail

**Budgets:** Multiple versions, budget keys (equal/seasonal/custom distribution), copy from prior year with % adjust, budget vs actual, dimension-based budgets, Excel import

**Simulations:** Create from existing data, adjust values, compare side by side, convert to budget or journal

**Dimensions:** Types and values, assign to transactions, hierarchies for roll-up, mandatory dimension rules per account

**Inter-Company:** Auto-generate counterpart entry, inter-company balance tracking, reconciliation, currency handling across companies, audit trail linking both sides

**Consolidation:** Group setup (parent/subsidiaries), COA mapping, elimination entries (auto-generate), currency translation (closing rate BS / average rate P&L), translation gain/loss, minority interest, manual adjustments, drill-down to subsidiary source

### Reports
- Profit & Loss (P&L) — comparative periods, dimension breakdown, % of revenue
- Balance Sheet — as-at date, comparative, dimension breakdown
- Trial Balance — period or date range, detail or summary, include zero balances toggle
- Cash Flow Statement — direct or indirect method, period comparison
- Transaction Journal — all posted transactions with filters
- Nominal Ledger — account-by-account transaction listing
- VAT Return — 9-box HMRC format, Flat Rate scheme support
- VAT Audit Report — transaction-level detail per box
- Budget vs Actual — variance analysis by account, period, dimension
- Bank Reconciliation Report — reconciled/unreconciled at a date
- Key Financial Ratios — liquidity, profitability, efficiency ratios
- Aged Analysis — receivables and payables aging
- Dimension Analysis — P&L or TB grouped by dimension
- Inter-Company Transactions Report
- Inter-Company Balances Report
- Inter-Company Reconciliation Report
- Consolidated P&L
- Consolidated Balance Sheet
- Consolidated Trial Balance
- Consolidation Adjustments Report
- <span style="color:red">Budget Summary — version comparison</span>
- <span style="color:red">Bank Summary — balances across all bank accounts</span>
- <span style="color:red">Currency Translation Report</span>
- <span style="color:red">Subsidiary Contribution Report</span>

---

## Module 2: Fixed Assets (FA)

### Pages
1. **Assets Register** — master list, full lifecycle tracking
2. **Depreciation Schedule** — view/preview depreciation per asset or all
3. **Disposals** — sale, write-off, scrapping with gain/loss
4. **Revaluation** — revalue carrying amount to fair value

### Settings
1. Asset Categories (default useful life, depreciation method, GL accounts)
2. Depreciation Frequencies (monthly, quarterly, annually)
3. Disposal Reason Codes
4. Asset Locations

### Features

**Assets Register:** Asset creation (description, category, location, acquisition date, cost, useful life), asset card with full history, <span style="color:red">photo/document attachments</span>, <span style="color:red">barcode/QR tracking</span>, status (Active/Fully Depreciated/Disposed/Written Off), GL mapping per category, <span style="color:red">dimension tagging</span>, <span style="color:red">serial number tracking</span>

**Depreciation:** Methods (Straight Line, Reducing Balance, <span style="color:red">Sum of Years' Digits</span>, <span style="color:red">Units of Production</span>), preview before posting, partial year pro-rata

**Disposals:** Proceeds entry, gain/loss calculation, auto-generate disposal journal

**Revaluation:** Surplus/deficit calculation, auto-generate revaluation journals, revaluation reserve tracking

### Reports
- Asset Register Report — full listing with cost, accumulated depreciation, net book value
- Depreciation Schedule Report — projected depreciation by period
- Disposal Report — disposed assets with gain/loss
- <span style="color:red">Asset Movement Report — additions, disposals, transfers in period</span>
- <span style="color:red">Asset Valuation Report — NBV by category, location, department</span>

---

## Module 3: Inventory & Stock (INV)

### Pages
1. **Items** — item master (stock, non-stock, service, kit/BOM)
2. **Locations** — warehouses, stores, virtual locations
3. **Goods Receipts** — receive stock (from PO or manual)
4. **Returns** — return stock to supplier
5. **Stock In / Stock Out** — manual adjustments
6. **Stock Transfers** — move between locations
7. **Delivery** — goods out to customer
8. **Stock Take / Physical Count** — count and variance posting

### Settings
1. Item Categories and Sub-Categories
2. Units of Measure (with conversion factors)
3. Location Types
4. Adjustment Reason Codes
5. Return Reason Codes
6. Costing Method per item/category (FIFO, Weighted Average, Standard Cost)
7. Stock Valuation Method
8. Reorder Calculation Settings
9. Number Series (goods receipt, delivery, transfer, adjustment)
10. Item Tags / Classifications (configurable tag groups for grouping, filtering, reporting)

### Features

**Items:** Item types (Stock/Non-Stock/Service/Kit-BOM), code/description/UOM/weight/dimensions, multiple barcodes (EAN/UPC/internal), categories, reorder point/quantity, min/max stock levels, multiple suppliers with preferred, pricing (cost/selling/price lists), images, GL mapping (stock/COGS/revenue), dimension tagging, serial number tracking, item tags/classifications (multiple tags per item for flexible grouping — e.g., "non-resale", "promotional", "fragile"), <span style="color:red">batch/lot tracking</span>

**Locations:** Hierarchy (warehouse→zone→bin), default location per item, location-specific stock, <span style="color:red">transit locations</span>, <span style="color:red">quarantine/inspection locations</span>

**Goods Receipts:** Link to PO (auto-populate), <span style="color:red">quality inspection hold</span>, partial receipt, GRN generation, update stock + GL on posting

**Returns:** Link to original GRN/PO, reason codes, trigger credit note, stock adjustment

**Stock In / Stock Out:** Reason codes (damaged/expired/found/sample), GL posting

**Stock Transfers:** Request→in-transit→received, inter-warehouse, cost tracking

**Delivery:** Link to sales order, partial delivery, delivery note, picking list, ship-to address

**Stock Take:** Count sheets (by location/category), enter counted qty, variance report, post adjustments

### Reports
- Stock Valuation Report — value by item, location, category
- Stock Movement Report — ins/outs/transfers by period
- Reorder Report — items below reorder point
- Stock Take Variance Report
- Item Price List Report
- Stock by Tag/Classification Report — items grouped by tag
- <span style="color:red">Stock Aging Report — items by age since last movement</span>
- <span style="color:red">Dead Stock Report — no movement in X months</span>
- <span style="color:red">Goods Receipt Report</span>
- <span style="color:red">Delivery Report</span>

---

## Module 4: Sales (SAL)

### Pages
1. **Customers** — customer master, credit limits, payment terms
2. **Sales Persons** — team management, targets
3. **Pricing** — price lists, discounts, quantity breaks, date-effective
4. **Quotations** — create, version, convert to order
5. **Sales Orders** — order processing, delivery tracking, back-orders
6. **Invoices** — sales invoices, multi-currency
7. **Payments / Receipts** — payment allocation, multi-method
8. **Credit Notes** — full/partial credit against invoice
9. **Sales Forecast** — demand forecasting, AI-assisted

### Settings
1. Customer Groups
2. Payment Terms (Net 30, Net 60, COD, etc.)
3. Price Lists
4. Discount Types and Rules
5. Sales Regions / Territories
6. Number Series (quotes, orders, invoices, credit notes, receipts)
7. Default Accounts (receivables, revenue, discount, shipping)
8. Invoice Email Templates
9. Sales Tax / VAT Defaults

### Features

**Customers:** Name, addresses (billing/shipping), contacts, customer groups, credit limit/terms, default price list, default VAT code, default salesperson, currency preference, customer-specific discounts, statement preferences, VAT number, dimension defaults

**Sales Persons:** Details, targets, territory/region, link to user, performance summary

**Pricing:** Multiple price lists (retail/wholesale/trade/VIP), by customer/group/quantity break, date-effective, discount structures (% or fixed), currency-specific, promotional with date ranges

**Quotations:** Header + line items, versioning (revisions), status (Draft/Sent/Accepted/Rejected/Expired), convert to SO, validity period, email with PDF

**Sales Orders:** Create from quote or standalone, status tracking (Draft→Confirmed→Delivered→Invoiced→Cancelled), delivery date, partial delivery, back-order management, stock availability check, <span style="color:red">recurring orders</span>

**Invoices:** From SO or standalone, status (Draft/Sent/Partially Paid/Paid/Overdue/Void), line items with qty/price/discount/VAT, multi-currency, credit note creation, proforma, <span style="color:red">recurring invoices</span>, batch invoicing

**Payments:** Allocation to invoices (full/partial), multiple methods (bank/cash/cheque/card), overpayment handling, FX gain/loss, AI-assisted matching, <span style="color:red">direct debit batches</span>

**Credit Notes:** Full or partial credit, reason codes, stock return linkage, apply to outstanding invoices or refund

**Sales Forecast:** Historical analysis by item/customer/period, AI-assisted generation, manual adjustment, forecast vs actual, feed into Purchase Plans

### Reports
- Sales by Customer Report
- Sales by Item Report
- Sales by Salesperson Report
- Sales by Period Report (daily, weekly, monthly)
- Outstanding Invoices / AR Aging Report
- Customer Statement
- Sales Order Backlog Report
- Quote Conversion Report (quotes→orders ratio)
- Sales Forecast vs Actual
- Credit Note Report
- <span style="color:red">Top Customers Report</span>
- <span style="color:red">Price List Report</span>

---

## Module 5: Purchasing (PUR)

### Pages
1. **Suppliers** — supplier master, payment terms, bank details
2. **Supplier Items** — supplier-specific codes, prices, lead times, volume pricing
3. <span style="color:red">**Supplier Contracts** — formal agreements, contracted pricing, volumes</span>
4. **Purchase Orders** — PO creation, send to supplier
5. **Supplier Invoices (AP)** — 3-way matching, multi-currency
6. **Payments** — payment runs, BACS, allocation
7. <span style="color:red">**Purchase Plans** — auto-generate from reorder/forecast, suggested POs</span>

### Settings
1. Supplier Groups
2. Payment Terms
3. Number Series (POs, supplier invoices, debit notes, payments)
4. Default Accounts (payables, purchase, freight)
5. 3-Way Matching Tolerances (price %, quantity %)
6. Purchase Tax / VAT Defaults
7. Payment Run Settings (BACS format, payment day)

### Features

**Suppliers:** Name, addresses, contacts, groups, payment terms, default currency, VAT number, bank details, <span style="color:red">rating/evaluation</span>, notes and history, dimension defaults

**Supplier Items:** Supplier item code, supplier price/currency, lead time, min order qty, preferred supplier flag, price breaks / volume pricing (discounts, extra pieces, or lower cost at higher volumes)

<span style="color:red">**Supplier Contracts:** Start/end date, terms, value, contracted pricing, volume commitments, status, renewal reminders, document attachments</span>

**Purchase Orders:** Create manually or from reorder trigger, status (Draft/Sent/Partially Received/Fully Received/Invoiced/Cancelled), expected delivery date, email PO with PDF, <span style="color:red">blanket/framework POs (call-off)</span>

**Supplier Invoices:** 3-way matching (PO + GRN + invoice), price/quantity variance handling, status (Draft/Matched/Approved/Paid/Disputed), multi-currency, <span style="color:red">recurring supplier invoices</span>, debit note creation

**Payments:** Allocation to invoices (full/partial), payment run (batch), methods (BACS/cheque/direct debit), FX handling, remittance advice generation, <span style="color:red">early payment discount</span>, <span style="color:red">payment scheduling</span>

<span style="color:red">**Purchase Plans:** Auto-generate from reorder points, auto-generate from sales forecast, suggested POs grouped by supplier, review/approve before creating POs, MRP integration</span>

### Reports
- Purchase by Supplier Report
- Outstanding AP / AP Aging Report
- PO Status Report (open, overdue, partially received)
- Payment Run Report
- <span style="color:red">Purchase by Item Report</span>
- <span style="color:red">Purchase by Period Report</span>
- <span style="color:red">Supplier Statement</span>
- <span style="color:red">3-Way Matching Exceptions Report</span>
- <span style="color:red">Supplier Spend Analysis</span>
- <span style="color:red">Purchase Price Variance Report</span>
- <span style="color:red">Supplier Performance Report (on-time delivery %, quality)</span>

---

## Module 6: POS

### Pages
1. **POS Invoice (Touch Screen)** — full-screen POS optimised for touch
2. **Tills** — till/register management, opening/closing, cash in/out

### Settings
1. POS Terminal Setup (location, till, receipt printer)
2. Quick-Add Item Grid Configuration
3. Payment Methods per Terminal
4. Receipt Template (header, footer, logo)
5. Discount Permissions (who, max %)
6. Void/Refund Permissions
7. Number Series (POS invoices, receipts)
8. <span style="color:red">Tax Rounding Rules</span>
9. <span style="color:red">Shift Schedule Settings</span>

### Features

**POS Invoice:** Item search by code/barcode/name, quick-add grid, qty adjustment, line discount, customer lookup (optional — walk-in default), split payment (cash + card), change calculation, receipt printing (thermal), <span style="color:red">hold/park and resume</span>, void line/transaction (reason + supervisor override), returns/refunds at POS, discount (% or fixed, requires permission), <span style="color:red">price override (supervisor approval)</span>, VAT display, end-of-day summary

**Tills:** Opening (enter float), closing (count cash, reconcile), cash in/out, till assignment to user/shift, variance report

### Reports
- Daily Sales Summary (by terminal, by user)
- Till Reconciliation Report
- Void/Refund Report
- <span style="color:red">POS Sales by Item Report</span>
- <span style="color:red">POS Sales by Payment Method</span>
- <span style="color:red">Discount Report (by whom, reason)</span>
- <span style="color:red">Hourly Sales Report (peak hours)</span>
- <span style="color:red">Cashier Performance Report</span>

---

## Module 7: CRM

### Pages
1. **Prospects** — potential customers, scoring, source tracking
2. **Leads / Opportunities** — pipeline stages, kanban board
3. **Activities** — calls, emails, meetings, tasks, calendar view
4. <span style="color:red">**Campaigns** — marketing campaigns, targeting, ROI tracking</span>
5. <span style="color:red">**Email Templates** — reusable templates with variables</span>
6. **Contacts** — directory across all prospects/customers

### Settings
1. Lead Pipeline Stages (customisable names and order)
2. Activity Types
3. Lead Sources
4. Win/Loss Reason Codes
5. <span style="color:red">Prospect Scoring Rules</span>
6. <span style="color:red">Campaign Types</span>
7. <span style="color:red">Email Sending Configuration (SMTP, sender)</span>
8. Number Series (leads, activities, campaigns)
9. <span style="color:red">Default Salesperson Assignment Rules</span>

### Features

**Prospects:** Company/contact details, status (New/Contacted/Qualified/Unqualified/Converted), convert to customer (one-click), <span style="color:red">scoring (manual or AI)</span>, source tracking, notes and history

**Leads:** Prospect/customer link, estimated value, probability, pipeline stages (New/Qualification/Proposal/Negotiation/Won/Lost), expected close date, kanban + list views, win/loss reason codes, <span style="color:red">competitor tracking</span>, documents, assign to salesperson

**Activities:** Types (Call/Email/Meeting/Task/Note), link to prospect/customer/lead/contact, due date/priority/assigned to, status (Planned/Completed/Cancelled), calendar view, follow-up reminders, <span style="color:red">call outcomes and meeting notes</span>

<span style="color:red">**Campaigns:** Name, type, budget, dates, target audience, status, response/conversion tracking, ROI calculation, email template integration</span>

<span style="color:red">**Email Templates:** Variable placeholders, HTML and plain text, categories, preview with sample data</span>

**Contacts:** Name/title/email/phone/mobile, link to prospect or customer, role (decision maker/influencer/technical/billing), <span style="color:red">communication preferences</span>, <span style="color:red">duplicate detection</span>

### Reports
- Sales Pipeline Report (by stage, value, probability)
- Lead Conversion Report
- Activity Report (by user, type, date range)
- Overdue Activities Report
- <span style="color:red">Campaign Performance Report (ROI, response rate)</span>
- <span style="color:red">Prospect Source Analysis</span>
- <span style="color:red">Sales Forecast from Pipeline (weighted by probability)</span>
- <span style="color:red">Win/Loss Analysis Report</span>

---

## Module 8: Warehouse (WH)

### Pages
1. **Warehouses** — warehouse master, type, manager
2. **Areas / Zones** — logical divisions (receiving, storage, picking, shipping, quarantine)
3. **Positions / Bins** — individual storage locations, capacity, barcode
4. **Put-Away** — inbound placement, suggested positions, scan confirmation
5. **Picking** — order fulfilment, strategies, batch picking
6. <span style="color:red">**Packing** — pack station, carton selection, weight, labels</span>
7. <span style="color:red">**Dispatch** — outbound shipment, carrier, tracking</span>
8. **Stock Enquiry (by Position)** — drill-down warehouse→area→bin

### Settings
1. Warehouse Structure Configuration
2. Position Naming Conventions
3. Put-Away Rules (by item category, size, velocity)
4. Picking Strategy per Warehouse/Zone
5. <span style="color:red">Carrier / Shipping Provider Setup</span>
6. Barcode Format Configuration
7. <span style="color:red">Packing Material Types</span>
8. Number Series (put-away, pick, pack, dispatch)

### Features

**Warehouses:** Name, address, type (main/satellite/bonded/cold storage), <span style="color:red">operating hours</span>, manager, GL account link

**Areas / Zones:** Types (Receiving/Storage/Picking/Packing/Shipping/Quarantine/Returns), <span style="color:red">temperature requirements (ambient/chilled/frozen)</span>, <span style="color:red">access restrictions (hazardous)</span>

**Positions / Bins:** Code (A-01-03-02), type (shelf/pallet/floor/bulk), capacity (weight/volume/count), current contents and fill level, barcode/QR, status (Available/Full/Reserved/Blocked)

**Put-Away:** Suggested position (rules-based), scan confirmation, <span style="color:red">split put-away</span>, task assignment

**Picking:** Pick list from sales orders, strategies (FIFO/FEFO/<span style="color:red">zone</span>/<span style="color:red">wave</span>), <span style="color:red">batch picking (multiple orders)</span>, scan confirmation, task assignment, short pick handling

<span style="color:red">**Packing:** Packing station UI, package selection, weight capture, packing slip, shipping label</span>

<span style="color:red">**Dispatch:** Scheduling, carrier assignment, tracking number, proof of dispatch, loading dock allocation</span>

**Stock Enquiry:** Drill-down from warehouse to bin, stock on hand/reserved/available, movement history per position

### Reports
- Warehouse Utilisation Report (fill level by zone/position)
- Stock by Position Report
- Position Empty/Available Report
- <span style="color:red">Picking Performance Report (picks/hour, accuracy)</span>
- <span style="color:red">Put-Away Performance Report</span>
- <span style="color:red">Movement History Report</span>
- <span style="color:red">Dispatch Report (by carrier, date, destination)</span>
- <span style="color:red">Slow-Moving Stock by Position</span>

---

## Module 9: Production / Manufacturing (PRD)

### Pages
1. **Bill of Materials (BOM)** — product structure, multi-level, versioning
2. **Routings** — process steps, work centres, times
3. **Machines / Work Centres** — shop floor resources, capacity
4. <span style="color:red">**Production Plan** — aggregate planning, MRP, capacity check</span>
5. **Production Orders** — individual manufacturing orders
6. **Operations** — routing step progress within a production order
7. <span style="color:red">**Batches / Lots** — batch tracking, attributes, traceability</span>
8. **Materials** — material requirements, availability, substitution
9. <span style="color:red">**Quality Control** — inspection plans, results, non-conformance</span>

### Settings
1. BOM Types and Categories
2. Operation Types
3. Work Centre Types
4. Scrap Reason Codes
5. Production Order Number Series
6. <span style="color:red">Batch Number Series and Format</span>
7. <span style="color:red">MRP Parameters (lead times, safety stock, lot sizing rules)</span>
8. Shift Patterns for Capacity Planning
9. <span style="color:red">Quality Inspection Templates</span>
10. Cost Allocation Methods (standard cost, actual cost)

### Features

**BOM:** Multi-level (sub-assemblies), component list (item/qty/UOM/scrap %), versioning, status (Draft/Active/Obsolete), where-used enquiry, cost roll-up, <span style="color:red">phantom BOM support</span>

**Routings:** Operation sequence, work centre/machine, setup/run time, <span style="color:red">versioning</span>, <span style="color:red">alternative routings</span>, <span style="color:red">outsourced operations</span>

**Machines / Work Centres:** Name/type/capacity/cost rate, availability calendar (shifts/maintenance), status (Available/Running/Maintenance/Down), <span style="color:red">OEE tracking</span>

<span style="color:red">**Production Plan:** Plan by period, demand sources (forecast/orders/reorder/manual), capacity check, MRP (explode through BOMs), generate production orders, what-if scenarios</span>

**Production Orders:** Product/quantity/BOM/routing/dates, status (Planned/Released/In Progress/Completed/Cancelled), material reservation, material issue, partial completion, scrap/waste recording, <span style="color:red">by-product and co-product support</span>

**Operations:** Status (Pending/Setup/Running/Complete/On Hold), actual time recording, operator assignment, <span style="color:red">quality checkpoints</span>, operation-level scrap

<span style="color:red">**Batches:** Auto or manual numbering, attributes (potency/grade/colour), splitting/merging, full traceability (forward/backward), expiry management</span>

**Materials:** Requirements from BOM explosion, availability check, <span style="color:red">substitution (alternatives)</span>, issue and return from shop floor

<span style="color:red">**Quality Control:** Inspection plans (what to check, tolerances), results recording, pass/fail/conditional release, non-conformance reporting, corrective actions</span>

### Reports
- Production Order Status Report
- Work in Progress (WIP) Report
- Material Usage Report (planned vs actual)
- Production Cost Report (standard vs actual)
- BOM Cost Roll-Up Report
- <span style="color:red">Scrap/Waste Report</span>
- <span style="color:red">Machine Utilisation Report</span>
- <span style="color:red">OEE Report (Availability x Performance x Quality)</span>
- <span style="color:red">MRP Exception Report (shortages, excess)</span>
- <span style="color:red">Batch Traceability Report (forward/backward)</span>
- <span style="color:red">Quality Inspection Report</span>
- <span style="color:red">Capacity Planning Report (load vs capacity)</span>
- <span style="color:red">Production Schedule (Gantt view)</span>

---

## Module 10: Projects & Job Costing (PRJ)

### Pages
1. **Projects** — project master, hierarchy (project→phases→tasks)
2. **Project Transactions** — all financial transactions against a project
3. **Time Sheets** — weekly time recording, billable/non-billable
4. <span style="color:red">**Project Schedule** — Gantt, dependencies, milestones, % complete</span>
5. **Project Budget** — cost/revenue budgeting by category and phase
6. **Expenses** — project expense claims, reimbursement

### Settings
1. Project Types and Categories
2. Cost Categories
3. Billing Rate Tables (by role, project type, client)
4. Expense Categories and Limits
5. Timesheet Approval Rules
6. <span style="color:red">Overhead Allocation Rates</span>
7. Revenue Recognition Methods (% completion, milestone, time-based)
8. Number Series (projects, timesheets, expense claims)
9. Working Hours per Day/Week

### Features

**Projects:** Name/code/client/manager/dates, types (Fixed Price/Time & Materials/Internal/Retainer), status (Planning/Active/On Hold/Completed/Cancelled), hierarchy (project→phases→tasks), team assignment, billing method, documents

**Project Transactions:** Types (labour/materials/expenses/overheads), source linking (timesheet/PO/expense claim), <span style="color:red">revenue recognition entries</span>, <span style="color:red">WIP journals</span>, drill-down to source

**Time Sheets:** Weekly grid (days x projects/tasks), daily entry with hours/description, billable flag, <span style="color:red">overtime</span>, submission and approval, <span style="color:red">timer/stopwatch mode</span>, <span style="color:red">copy from previous week</span>

<span style="color:red">**Project Schedule:** Task list with dependencies, Gantt chart, milestones, % complete, critical path, resource allocation, baseline vs actual</span>

**Project Budget:** By cost category (labour/materials/expenses/subcontract/overheads), by phase/task, <span style="color:red">versions (original/revised)</span>, budget vs actual variance, <span style="color:red">EAC calculation</span>, <span style="color:red">revenue budget and billing schedule</span>

**Expenses:** Date/category/amount/project/description/receipt, categories (travel/accommodation/meals/supplies), <span style="color:red">mileage calculator</span>, <span style="color:red">per diem</span>, reimbursement tracking, billable flag

### Reports
- Project Profitability Report (revenue vs cost vs margin)
- Project Status Report (schedule, budget, % complete)
- Timesheet Report (by employee, project, date range)
- Budget vs Actual Report
- Expense Report (by project, employee, category)
- <span style="color:red">Utilisation Report (billable hours / available hours)</span>
- <span style="color:red">WIP Report (unbilled work in progress)</span>
- <span style="color:red">Resource Allocation Report</span>
- <span style="color:red">Billing Report (invoiced vs unbilled)</span>
- <span style="color:red">Project Pipeline Report (upcoming projects)</span>

---

## Module 11: HR & Payroll (HR)

### Pages
1. **Employees** — employee master, personal/employment/tax details
2. **Contracts** — employment contracts, salary, benefits, amendments
3. **Job Positions** — org structure, grades, headcount
4. <span style="color:red">**Checklists** — onboarding/offboarding task tracking</span>
5. <span style="color:red">**Appraisals** — performance reviews, goals, ratings</span>
6. **Leave Management** — holiday/absence requests, calendar, balances
7. <span style="color:red">**Skills & Qualifications** — skill tracking, certifications, expiry</span>
8. <span style="color:red">**Training** — courses, enrolment, completion, costs</span>
9. <span style="color:red">**Payroll (UK)** — gross to net, PAYE, NI, pension, RTI — **use third-party payroll service/vendor for calculations and HMRC integration**</span>

### Settings
1. Departments and Org Structure
2. Job Grades/Bands and Salary Scales
3. Leave Types and Entitlement Rules
4. Public Holiday Calendars (by region)
5. <span style="color:red">Appraisal Cycle Configuration</span>
6. <span style="color:red">Checklist Templates</span>
7. <span style="color:red">Skill Categories</span>
8. <span style="color:red">Training Providers</span>
9. <span style="color:red">Payroll: Tax Bands, NI Thresholds, Pension Thresholds (updated annually)</span>
10. <span style="color:red">Pay Elements (addition and deduction types)</span>
11. <span style="color:red">BACS Bureau Configuration</span>
12. <span style="color:red">HMRC Gateway Credentials (for RTI)</span>
13. Number Series (employee numbers)
14. Working Pattern Templates

### Features

**Employees:** Personal details (name/DOB/address/phone/email/emergency contact), employment details (number/hire date/department/title/manager), status (Active/Probation/Suspended/Terminated/Retired), <span style="color:red">photo</span>, bank details, tax details (tax code/NI number/student loan), right to work documents, attachments, <span style="color:red">self-service access</span>

**Contracts:** Type (permanent/fixed-term/zero-hours/contractor), start/end, salary/rate, working hours (full/part-time), probation period, notice period, <span style="color:red">benefits (pension/healthcare/car allowance)</span>, amendments history, <span style="color:red">renewal reminders</span>

**Job Positions:** Title/department/grade/reporting line, status (Open/Filled/Frozen), headcount (budgeted vs actual), <span style="color:red">job description and requirements</span>, <span style="color:red">salary range per grade</span>

<span style="color:red">**Checklists:** Templates (Onboarding/Offboarding/Probation Review), task items with assignee/due date/completion, auto-trigger on status change, document collection tracking</span>

<span style="color:red">**Appraisals:** Cycles (annual/bi-annual/quarterly), goal setting and tracking, self-assessment + manager assessment, customisable rating scales, development plans, history, 360-degree feedback (optional)</span>

**Leave:** Types (Annual/Sick/Maternity/Paternity/Unpaid/TOIL/Compassionate), entitlement calculation (by contract/tenure/pro-rata), request and approval workflow, team calendar, carry-over rules, <span style="color:red">Bradford Factor</span>, public holidays

<span style="color:red">**Skills:** Categories and individual skills, proficiency levels, certification expiry dates, renewal reminders, skills gap analysis</span>

<span style="color:red">**Training:** Courses (name/provider/cost/duration), requests and approval, schedule and enrolment, completion tracking and certificates, cost tracking, mandatory training tracking</span>

<span style="color:red">**Payroll (UK):** Gross to net (basic + additions - deductions), additions (overtime/bonus/commission/allowances/SSP/SMP/SPP), deductions (PAYE/NI employee+employer/pension/student loan/attachment of earnings), tax code processing (cumulative and week 1/month 1), NI categories, workplace pension auto-enrolment, payslip generation, BACS file, RTI (FPS/EPS), year-end (P60, final FPS), starter/leaver (P45/P46), salary sacrifice, multiple pay frequencies — **Recommend integration with third-party payroll provider (e.g., Staffology, Moorepay, BrightPay API) rather than building payroll engine in-house**</span>

### Reports
- Employee Directory Report
- Headcount Report (by department, location, status)
- Absence Report (by employee, type)
- Leave Balance Report
- Employer Cost Report (salary + employer NI + employer pension)
- <span style="color:red">Turnover Report (starters/leavers by period)</span>
- <span style="color:red">Appraisal Status Report (due, overdue, completed)</span>
- <span style="color:red">Skills Matrix Report</span>
- <span style="color:red">Training Report (completed, upcoming, costs)</span>
- <span style="color:red">Payroll Summary Report (gross, deductions, net by department)</span>
- <span style="color:red">Payroll Variance Report (period-over-period)</span>
- <span style="color:red">P11 Deductions Working Sheet</span>
- <span style="color:red">Gender Pay Gap Report</span>
- <span style="color:red">Right to Work Expiry Report</span>

---

## AI Engine (Cross-Module Intelligence Layer)

### Already Specified (in existing PRD/Epics)

| # | Capability | Source | Defer? |
|---|-----------|--------|--------|
| 1 | AI Copilot (conversational, multi-turn, streaming) | E5.S1-S2 | No — core |
| 2 | Action Framework (propose→review→confirm, guardrails) | E5.S3 | No — core |
| 3 | Anomaly & Fraud Detection (duplicates, suspicious patterns) | FR155-157 | <span style="color:red">Yes — Phase 2</span> |
| 4 | Cash Flow Forecasting (8-52 weeks, scenarios) | FR153 | <span style="color:red">Yes — Phase 2</span> |
| 5 | Prediction Explainability (`POST /ai/explain`) | E5.S4 | <span style="color:red">Yes — Phase 2</span> |
| 6 | Document Understanding (extract fields, learn from corrections) | FR164-167 | <span style="color:red">Yes — Phase 2</span> |
| 7 | Autonomous Workflows (scheduled/event/chained, circuit breaker) | E5c | <span style="color:red">Yes — Phase 2</span> |
| 8 | Ad-Hoc NL Queries (natural language→SQL→table/chart) | E25.S4 | <span style="color:red">Yes — Phase 2</span> |

### New / Expected (not yet in specs)

| # | Capability | Defer? |
|---|-----------|--------|
| 9 | Risk Detection (credit, supply chain, cash flow, regulatory, operational) | <span style="color:red">Yes — Phase 3</span> |
| 10 | Data Quality Improvement (missing fields, duplicates, stale data, health score) | <span style="color:red">Yes — Phase 3</span> |
| 11 | End-to-End Trace Explanations (cross-module causal chains) | <span style="color:red">Yes — Phase 3</span> |
| 12 | Sales Forecast & Demand Prediction (feed into Purchase/Production) | <span style="color:red">Yes — Phase 3</span> |
| 13 | Smart Feed / Role-Based AI (copilot adapts per user role) | <span style="color:red">Yes — Phase 2</span> |

See `ai-engine.md` for full detail on each capability.

---

## Cross-Cutting Frameworks

| # | Framework | Defer? |
|---|-----------|--------|
| 1 | Report Runner (T8 template, parameter panel, export, schedule, AI summary) | No — core |
| 2 | Batch Job Runner (parameter form, progress, background, notifications) | No — core |
| 3 | Jobs & Reports Monitor (in-progress, recent, scheduled) | <span style="color:red">Yes — Phase 2</span> |
| 4 | Copilot Chat History page | <span style="color:red">Yes — Phase 2</span> |
| 5 | Copilot Context Monitor (token usage slider) | <span style="color:red">Yes — Phase 2</span> |
| 6 | Form Creator (HTML templates, versioning, batch PDF, email) | No — core |
| 7 | Exports & Imports Framework (CSV/Excel, import wizard, validation) | No — core |

See `cross-cutting.md` for full detail.

---

## Approval Workflow Module (Future)

<span style="color:red">**Deferred — to be added as a separate cross-cutting module.**</span>

A generic approval workflow engine that works across all modules:

- Configurable approval rules per document type (PO, Sales Order, Invoice, Journal, etc.)
- Approval triggers: value threshold, discount %, specific account, new supplier, etc.
- Single-step or multi-step approval chains
- Role-based approvers (by department, value band, document type)
- Substitution / delegation (when approver is absent)
- Email/push notification to approvers
- Approve/reject with comments
- Approval history and audit trail
- Dashboard: pending approvals for current user

**Applies to:** Purchase Orders, Sales Orders, Journals, Expense Claims, Leave Requests, Credit Notes, Stock Adjustments, Budget Changes, and any future document types.

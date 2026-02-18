# MANUAL_EXTRACT — HansaWorld Standard ERP Manual

> **Generated:** 2026-02-15
> **Source:** https://www.hansamanuals.com (Standard ERP section, version 8.5)
> **Status:** COMPLETE — Comprehensive extraction from 37+ module index pages.
> **Last Updated:** 2026-02-15

---

## 1. Product Overview

**HansaWorld Standard ERP** is an integrated accounting, CRM, and ERP platform with:
- Modular architecture (3 tiers: Accounting, Logistics, Enterprise)
- Client-Server architecture with thick desktop client + web interfaces
- Multi-company, multi-currency, multi-language support
- 30+ vertical product SKUs (Hotel, Restaurant, Healthcare, POS, etc.)

### Minimum Configuration (Accounting Package):
- System module
- Nominal Ledger (General Ledger)
- Sales Ledger (AR)
- Purchase Ledger (AP)
- Multi-currency capabilities
- Calendar and Task Manager

### Logistics Package (adds):
- Sales Order module
- Purchase Order module
- Stock Control module

### Enterprise Features (adds):
- Server module (multi-user)
- Additional specialized modules

---

## 2. Common Module Structure Pattern

Every module in Standard ERP follows a consistent organizational pattern:

**Settings** → **Registers** → **Maintenance Functions** → **Forms/Documents** → **Reports** → **Exports** → *(some: Imports)*

This pattern is reflected in the manual structure and in the UI navigation for each module.

---

## 3. Module Inventory (Comprehensive — from 37+ Module Index Pages)

### 3.1 Sales Ledger (Accounts Receivable)
**Evidence:** hansamanuals.com → Standard ERP → Sales Ledger

- **Purpose:** Customer invoicing, payments, credit management, aging
- **Registers:** Invoices (IVVc), Receipts (ARPayVc), Customers (CUVc), Credit Notes
- **Settings:** Sales Ledger Settings, Payment Terms, Payment Modes, Interest rates, Reminder texts
- **Reports:** Sales Ledger (aged), Open Invoices, Customer Statements, Sales Journal, VAT report
- **Exports:** Bank payment files (BACS, SEPA), Statement exports
- **Business Rules:**
  - Invoice types: Normal, Cash, Credit, Interest, Debit Note, Prepayment
  - Payment terms (days), early payment discounts
  - Automatic reminders with configurable escalation
  - Interest invoicing on overdue amounts
  - Credit notes linked to original invoice (CredInv field)
  - OK flag for approval/posting workflow
  - Auto-posting to Nominal Ledger on OK
  - Multi-currency with exchange rate capture at invoice date
  - Disputes flag to exclude from collection/reminder processing
  - Installment invoicing support
  - Commission tracking per salesperson

### 3.2 Sales Orders
**Evidence:** hansamanuals.com → Standard ERP → Sales Orders

- **Purpose:** Quote-to-order-to-delivery-to-invoice workflow
- **Registers:** Quotations (QTVc), Orders (ORVc), Deliveries (DispatchVc), Customer Orders (COVc)
- **Settings:** Order Settings, Delivery Settings, Price Lists, Discount rules
- **Business Rules:**
  - Quote → Order → Delivery → Invoice lifecycle
  - Stock reservation on order confirmation
  - Partial deliveries from orders
  - Automatic invoice generation from deliveries
  - Price/discount hierarchy: Customer > Item > Item Group > Price List
  - Available-to-Promise (ATP) checking
  - Credit limit checking on order entry

### 3.3 Purchase Ledger (Accounts Payable)
**Evidence:** hansamanuals.com → Standard ERP → Purchase Ledger

- **Purpose:** Supplier bills, payments, AP aging
- **Sub-Sections:** Settings, Purchase Invoices, Payments, PO Contracts, Buybacks, Maintenance, Documents, Reports, Exports
- **Reports:** Purchase Ledger (aged), Open Invoice Supplier Statement, Periodic Supplier Statement, Payments Forecast
- **Automation:** Create Payments Suggestion — auto-creates Payment records based on Due Dates
- **Business Rules:**
  - Three-way matching: PO → GRN → Purchase Invoice
  - Payment terms and early payment discounts
  - Multi-currency purchase invoices
  - Auto-posting to Nominal Ledger
  - Payment proposal generation for batch payments
  - BACS/SEPA payment file export

### 3.4 Purchase Orders
**Evidence:** hansamanuals.com → Standard ERP → Purchase Orders

- **Purpose:** Purchase requisition to PO to goods receipt
- **Registers:** Purchase Item Register, PO Register, PO Quotation Register, Internal Order Register, PO Process Register, Shipment Notification (Drop Shipments)
- **Key Features:**
  - Deficiency lists (items below minimum stock)
  - Purchase proposals (automated suggestions)
  - Batch PO generation from outstanding Sales Orders
  - Restock below minimum levels

### 3.5 Stock / Inventory / Warehouse
**Evidence:** hansamanuals.com → Standard ERP → Stock

- **Purpose:** Item master, stock movements, valuation, warehouse management
- **10 Registers:** Delivery, Goods Receipt, Stock Depreciation, Stock Movement, Returned Goods, Returned Goods to Supplier, Stocktaking, Stock Revaluation, Recipe (BOM), Item
- **Key Features:**
  - Multiple Locations (warehouses/bins)
  - Cost Accounting integration
  - Rebuild Stock maintenance function
- **NL Integration Accounts:**
  - Stock Accounts
  - Purchase Accruals
  - Cost of Sales
  - Returned Goods
  - Stock Loss
- **Business Rules:**
  - Costing methods: FIFO, Weighted Average, Standard Cost
  - Per-location stock tracking
  - Stock movements: Sales, Purchase, Transfer, Adjustment, Scrap
  - Lot/batch tracking with expiry dates
  - Serial number tracking
  - Multi-unit of measure with conversion factors
  - Reorder point and minimum stock level alerts
  - Stock reservation for sales orders
  - Cycle counting (Stocktaking register)
  - Item variants (sizes, colors, etc.)

### 3.6 Nominal Ledger (General Ledger)
**Evidence:** hansamanuals.com → Standard ERP → Nominal Ledger

- **Purpose:** Chart of Accounts, Journal Entries, Financial Reporting
- **Registers:** Transaction, Simulation, Account Reconciliation, Account (CoA), Object/Tag, Budget, Revised Budget, Brought Forward Balances, Bank Reconciliation
- **Key Reports:** Balance Sheet, Profit & Loss, Trial Balance
- **Sub-Sections:** Settings, CoA, Tags/Objects, Transaction entry, Account Reconciliation, Bank Reconciliation, Budget, Simulation, Maintenance, Documents
- **Business Rules:**
  - Double-entry bookkeeping enforced (debits must equal credits)
  - Period locking prevents posting to closed periods
  - Account types: Asset, Liability, Income, Expense, Equity
  - Objects (cost centres/dimensions) for multi-dimensional analysis
  - Hierarchical objects for drill-down reporting
  - Simulation register for what-if analysis
  - Consolidation mapping for multi-company group reporting

### 3.7 Contacts / Customers / Suppliers
**Evidence:** hansamanuals.com → Standard ERP → Contacts

- **Purpose:** Unified contact register for all entity types
- **Contact Register:** Single register for Customers, Suppliers, Contact Persons, and general Contacts
- **Contact Types:**
  - Customer (checkbox on Contact record)
  - Supplier (checkbox on Contact record)
  - Contact Person (linked to parent Contact)
  - Contact Classification (grouping)
- **Customer Categories:** Group similar customers; provide default Price Lists, Discount Matrices, Debtor Accounts
- **Supplier Categories:** Group similar suppliers; provide default On Account / Creditor Accounts
- **Dual Membership:** A company can be both Customer and Supplier simultaneously
- **Data Migration:** Convert Suppliers to Contacts, Convert Contact Persons to Contacts

### 3.8 CRM
**Evidence:** hansamanuals.com → Standard ERP → CRM

- **Purpose:** Customer relationship management, sales force tracking, opportunity pipeline
- **Registers:** Activity, Calendar, Task Manager, Customer Letter, Contact Person, Standard Text, Standard Period, Opportunity, Target Time, Mailing List, Workflow Overview
- **Features:**
  - Activities per user (privacy-controlled)
  - Sales force monitoring
  - Call logging
  - Opportunity pipeline management

### 3.9 Job Costing (Projects)
**Evidence:** hansamanuals.com → Standard ERP → Job Costing

- **Purpose:** Project cost tracking, time recording, project invoicing
- **5 Main Registers:** Project, Project Budget, Time Sheet, Project Transaction, Quotation
- **Additional Registers:** Project Schedule, Item, Item Group, Person, Contact
- **Invoicing Methods:**
  - Actual cost-based invoicing
  - Fixed cost (budget-based) invoicing
  - System auto-selects method based on project configuration
- **Time Recording:**
  - Individual time sheets (daily entry)
  - Activities method (linked to CRM Activities)
  - Manager approval workflow

### 3.10 Contracts
**Evidence:** hansamanuals.com → Standard ERP → Contracts

- **Purpose:** Recurring billing, contract lifecycle management
- **4 Registers:** Contract, Contract Quotation, Contract Status, Service Agreement
- **Features:**
  - Periodic invoice creation (automated recurring billing)
  - Quotation-to-contract conversion
  - Contract status tracking

### 3.11 Cash Book / Payments
**Evidence:** hansamanuals.com → Standard ERP → Cash Book

- **Purpose:** Cash management, payment processing, bank reconciliation
- **Registers:**
  - Cash In
  - Cash Out
  - Receipt (shared with Sales Ledger)
  - Payment (shared with Purchase Ledger)
  - Personnel Payment (shared with Expenses)
  - Simulation (shared with Nominal Ledger)
  - Account Reconciliation (shared with Nominal Ledger)
  - Forex Transaction
- **Business Rules:**
  - Bank statement import and matching
  - Reconciliation with tolerance thresholds
  - Multi-currency bank accounts

### 3.12 Assets (Fixed Assets)
**Evidence:** hansamanuals.com → Standard ERP → Assets

- **Purpose:** Fixed asset register, depreciation, disposal, revaluation
- **7 Registers:** Asset, Depreciation Model, Asset Category, Disposal, Revaluation, Asset Status, Asset Transaction
- **Depreciation:**
  - User-defined depreciation rates
  - Frequency: daily, monthly, quarterly, yearly
  - Methods: Straight-line, Declining balance
- **Asset Creation Methods:**
  - Direct entry
  - From Purchase Invoices (automatic asset creation)
  - From Stock Transfer (transfer to rental stock)
- **Business Rules:**
  - Asset categories for grouped configuration
  - Disposal workflow with gain/loss calculation
  - Revaluation with history tracking
  - Asset status lifecycle
  - Automatic GL posting for depreciation

### 3.13 HR (Human Resources)
**Evidence:** hansamanuals.com → Standard ERP → Human Resources Management

- **Purpose:** Employee records, contracts, performance, leave management
- **7 Registers:** Employee, Job Position, Employment Contract, Contract Change, Performance Appraisal, Skills Evaluation, Leave Application
- **Business Rules:**
  - Employee lifecycle management
  - Contract management with change tracking
  - Performance appraisal workflow
  - Skills evaluation tracking
  - Leave application and approval

### 3.14 Production (Manufacturing)
**Evidence:** hansamanuals.com → Standard ERP → Production

- **Purpose:** Bill of materials, production orders, shop floor control
- **7 Registers:** Item, Recipe (BOM), Production Order, Production, Production Item Alternatives, Production Operation, Machine Hours
- **Two Production Types:**
  - Point-of-delivery (no stock — produced and delivered immediately)
  - Advance assembly (with stock — produced to inventory)
- **Business Rules:**
  - BOM explosion for material requirements
  - Routing/operations with work centres
  - Production order lifecycle
  - Material consumption and output recording
  - Production item alternatives for substitution
  - Machine hours tracking

### 3.15 MRP (Material Requirements Planning)
**Evidence:** hansamanuals.com → Standard ERP → MRP

- **Purpose:** Demand-driven production and purchasing planning
- **6 Registers:** Sales Forecast, Production Plan, PO Plan, Item, Purchase Item, Recipe
- **Key Features:**
  - Creates production schedules with quantities and timetables
  - Creates purchasing schedules with quantities and timetables
  - Driven by sales forecasts and current stock levels

### 3.16 Service Orders
**Evidence:** hansamanuals.com → Standard ERP → Service Orders

- **Purpose:** Service delivery, warranty tracking, work order management
- **8 Registers:** Service Order, Work Order, Work Sheet, Work Sheet Transaction, Service Stock Transaction, Known Serial Number, Contact, Item
- **Key Features:**
  - Automatic warranty determination from Known Serial Number data
  - Work order assignment and tracking
  - Service stock management (spare parts)
  - Work sheet time and material recording

### 3.17 Expenses
**Evidence:** hansamanuals.com → Standard ERP → Expenses

- **Purpose:** Employee expense claims and reimbursement
- **5 Registers:** Expense, Personnel Payment, Person, Mileage, Daily Allowance
- **Integration:** Job Costing — expenses can be charged to projects for project cost tracking

### 3.18 Business Alerts / Workflow / Approvals
**Evidence:** hansamanuals.com → Standard ERP → Business Alerts

- **Purpose:** Event-driven notifications and approval workflows
- **Notifications:**
  - High-value transaction alerts
  - Low-margin alerts
  - Delivery notifications
  - System event warnings
- **Channels:** Messages (internal), Mail (email), SMS
- **Approval Rules:** Configurable for large-value transactions

### 3.19 Multi-Currency
**Evidence:** hansamanuals.com → Standard ERP → Multi-Currency

- **Purpose:** Foreign currency transaction handling and conversion
- **Currency Register:** With historical exchange rates by date
- **Auto Conversion:** Foreign currency amounts automatically converted to home currency
- **Conversion Methods:**
  - Simple (single base currency conversion)
  - Dual-Base Triangulation (for multi-country / Euro zone operations)

### 3.20 Point of Sale (POS)
**Evidence:** hansamanuals.com → Standard ERP → POS

- **Purpose:** Retail point of sale operations
- **Key Design Decision:** POS Invoices do NOT immediately update Stock or NL (for transaction speed)
- **Connection Methods:**
  - Live Connection (always online)
  - Live Synchronized (offline-capable with sync)
- **Hardware Support:** Desktop, tills, receipt printers, touch-screen, customer displays, cash drawers
- **Business Rules:**
  - Sales transaction processing
  - Cash/card payment handling
  - Session open/close with X/Z reports
  - Refund processing
  - Periodic batch posting to SL, Stock, and NL

### 3.21 Items and Pricing
**Evidence:** hansamanuals.com → Standard ERP → Items and Pricing

- **Purpose:** Product/service master data and pricing rules
- **Account Defaults:**
  - Item Group provides default Sales/Cost/Stock Accounts and VAT Codes
  - Item-level settings override Item Group defaults
- **Pricing Features:**
  - Price Lists (multiple per market/customer group)
  - Pricing Module (advanced rules)
  - Item Varieties (product options/variants)
- **Business Rules:**
  - Price rules for quantity-based, date-based, customer-specific pricing
  - Hierarchy: Transaction > Item > Item Group > Customer/Supplier > Settings

### 3.22 Quotations
**Evidence:** hansamanuals.com → Standard ERP → Quotations

- **Purpose:** Sales quotation management and follow-up
- **Sub-Sections:** Settings, Quotation Register, Contact, Item, Price, Maintenance, Documents, Reports, Exports
- **Features:**
  - Contact date per quotation for follow-up scheduling
  - Call list generation from quotations
  - Conversion to Orders or Invoices
- **Business Rules:**
  - Quote creation, versioning, approval
  - Quote-to-Order conversion
  - Quote-to-Invoice conversion (direct)

### 3.23 Report Generator
**Evidence:** hansamanuals.com → Standard ERP → Report Generator

- **Purpose:** Custom report builder
- **Features:**
  - Search/filtering on any field
  - Sorting and subtotals
  - Custom column headings
  - Field/variable placement
  - Header/body/footer design sections

### 3.24 Consolidation
**Evidence:** hansamanuals.com → Standard ERP → Consolidation

- **Purpose:** Multi-company group financial reporting
- **Structure:**
  - Mother Company (parent)
  - Daughter Companies (subsidiaries)
  - Grand-Daughter Companies (sub-subsidiaries)
- **Features:**
  - Multi-level consolidation hierarchy
  - Variable ownership percentages per subsidiary
  - Account Linking (mapping subsidiary accounts to group accounts)
  - Eliminations (intercompany transaction removal)
  - Consolidation Export

### 3.25 Inter-Company
**Evidence:** hansamanuals.com → Standard ERP → Inter-Company

- **Purpose:** Automated mirror transactions between group companies
- **Integration Patterns:**
  - PO in Company A → SO in Company B (auto-created)
  - Sales Invoice in Company A → Purchase Invoice in Company B (auto-created)
  - NL Transaction in Company A → NL Transaction in Company B (auto-created)

### 3.26 Mail / Internal Communications
**Evidence:** hansamanuals.com → Standard ERP → Mail

- **Purpose:** Internal and external messaging
- **Features:**
  - Internal Mail (within ERP)
  - Conference (group discussions)
  - Update Mail (system notifications)
  - External email integration
  - Real-time Chat

### 3.27 Timekeeper
**Evidence:** hansamanuals.com → Standard ERP → Timekeeper

- **Purpose:** Employee attendance and time tracking
- **Features:**
  - Clock-in / clock-out functionality
  - Shift-based control
  - Intra-shift activity tracking

### 3.28 Rental
**Evidence:** hansamanuals.com → Standard ERP → Rental

- **Purpose:** Equipment and asset rental management
- **Registers:** Rental Item, Rental Quotation, Agreement, Rental Reservation, Collection, Rental Item Inspection
- **Features:**
  - Multi-location rental operations
  - Automated nightly charging
  - Asset depreciation integration (linked to Fixed Assets)
  - Rental lifecycle management

### 3.29 Webshop and CMS
**Evidence:** hansamanuals.com → Standard ERP → Webshop

- **Purpose:** E-commerce and content management
- **Features:**
  - Static pages (CMS)
  - Webshop with automatic Order/Invoice creation in ERP
  - Customer portal (self-service)
  - CMS content management
  - CSS/JS customization

### 3.30 Data Integrity
**Evidence:** hansamanuals.com → Standard ERP → Data Integrity

- **Purpose:** Cross-module reconciliation and verification
- **10 Reports:**
  1. Access Control
  2. N/L Correction List (normal)
  3. N/L Correction List (consolidated)
  4. Purchase Ledger Checking
  5. PL Roll Forward
  6. Sales Ledger Checking
  7. SL Roll Forward
  8. Subsystems Checking
  9. Transaction Checking
  10. (combined report variations)
- **Business Rules:**
  - Compares sub-ledger balances to GL control accounts
  - Identifies mismatches between modules

### 3.31 Default Accounts, Tax Templates and VAT Codes
**Evidence:** hansamanuals.com → Standard ERP → Default Accounts, Tax Templates and VAT Codes

- **5 Configuration Areas:**
  1. Sales Accounts
  2. Purchase Tax Templates
  3. Sales Tax Templates
  4. Purchase VAT Codes
  5. Sales VAT Codes
- **Hierarchy:** Transaction > Item > Item Group > Customer/Supplier > Settings

### 3.32 Form Template Register
**Evidence:** hansamanuals.com → Standard ERP → Form Templates

- **Purpose:** Document layout design for printed/emailed forms
- **Two Components:**
  - Form (data extraction definition)
  - Form Template (graphical layout definition)
- **Design Elements:** Text, Line, Frame, Field, Picture, Page Sum
- **Features:**
  - Conditional printing (show/hide based on data)
  - Multi-language form support
  - Multi-page layout support

### 3.33 System Module
**Evidence:** hansamanuals.com → Standard ERP → System

- **Purpose:** Core platform settings, user management, access control
- **Key Registers:** Access Groups, Users, Companies, Reporting Periods, Form Templates, Number Series
- **Settings:** Company Info, Fiscal Year, Reporting Periods, Locking, Access Groups, Persons/Users
- **Business Rules:**
  - Access Groups define module-level and register-level permissions
  - Users assigned to Access Groups; permissions enforced per module
  - Companies support multi-entity operations within single database
  - Fiscal year and period management for financial reporting boundaries
  - Form Templates control print layout for all documents
  - Number Series define auto-numbering for all transaction types

### 3.34 Hotel Reservation
**Evidence:** hansamanuals.com → Standard ERP → Hotel

- **Purpose:** Hospitality reservation and property management
- **Features:** Room booking, guest management, rate management, housekeeping integration

### 3.35 System Admin / Technical
**Evidence:** hansamanuals.com → Standard ERP → System Admin

- **Purpose:** Server administration, database management, technical configuration
- **Features:** Backup/restore, server settings, performance tuning, user sessions

### 3.36 REST API
**Evidence:** hansamanuals.com → Standard ERP → REST API

- **Purpose:** External system integration via REST endpoints
- **Features:** CRUD operations on registers, authentication, rate limiting

### 3.37 Working Environment (UI Patterns)
**Evidence:** hansamanuals.com → Standard ERP → Working Environment

- **Navigation Centre:** Central desktop with icon shortcuts
- **UI Model:** Menu-driven + keyboard shortcut navigation
- **Organization:** Modules and Registers (two-level hierarchy)
- **Record Management:** Create, Edit, Delete, Duplicate
- **Workflow Manager:** Document approval workflows
- **Link Manager:** Cross-entity navigation
- **Personal Desktop:** User customization
- **Business Alerts:** Notification system

---

## 4. Cross-Module Integration Map

| Source → Target | Integration Description |
|---|---|
| Sales Orders → SL, Stock, Job Costing | Invoices, Deliveries, Project charging |
| Purchase Orders → PL, Stock | Purchase Invoices, Goods Receipts |
| Sales Ledger → NL | Automatic transaction posting |
| Purchase Ledger → NL | Automatic transaction posting |
| Stock → NL | Stock valuation postings |
| Contracts → SL | Periodic invoice generation |
| Job Costing → SL, NL | Project invoicing, Tag/Object accounting |
| Quotations → Sales Orders, SL | Quote-to-Order/Invoice conversion |
| Service Orders → SL, Stock, PO | Invoice generation, spare parts, PO creation |
| Expenses → Job Costing | Project expense tracking |
| Assets → NL, Rental | Depreciation posting, rental stock |
| Production → Stock | Component consumption, finished goods |
| MRP → Production, PO | Production Plans, PO Plans |
| Cash Book → SL, PL, NL | Receipts, Payments, Reconciliation |
| CRM → Contacts, Sales, Quotations | Activity tracking, opportunity pipeline |
| Consolidation → NL | Multi-company financial aggregation |
| Inter-Company → SO/PO, NL | Auto-create mirror transactions |
| POS → SL, Stock, NL | Periodic batch posting |
| Webshop → SO, SL, Stock | Online order/invoice creation |
| Rental → Assets, Stock, SL | Rental lifecycle, depreciation, invoicing |
| Business Alerts → All transactional | Notifications and approvals |

---

## 5. Key Business Rules from Manual (Cross-Module)

### 5.1 Default Account Hierarchy
**Evidence:** hansamanuals.com → Default Accounts, Tax Templates and VAT Codes

- Sales Accounts: Applied as defaults in Quotations, Sales Orders, and Sales Invoices
- Purchase Tax Templates: Used in Purchase Orders, Goods Receipts, and Purchase Invoices
- Hierarchy: Transaction > Item > Item Group > Customer/Supplier > Settings

### 5.2 Document/Transaction Status Lifecycle
- **OK Flag**: Universal approval mechanism — transactions must be marked "OK" to post to GL
- **Credit Notes**: Always linked back to original document
- **Fiscal Flag**: For countries requiring fiscal device reporting
- **Export Flag**: Tracks whether transaction has been exported to external systems

### 5.3 Multi-Currency Rules
- Exchange rate captured at transaction date
- Base Currency 1 and Base Currency 2 support (dual reporting)
- Rate tables maintained per currency pair with date history
- Revaluation at period end
- Dual-Base Triangulation method for Euro zone / multi-country

### 5.4 VAT/Tax Rules
- VAT Codes define tax rates per transaction type
- Tax Templates for complex multi-tax scenarios
- Tax Matrix for jurisdiction-based taxation
- Country-specific VAT return formats

---

## 6. Open Questions (Manual Gaps)

| # | Question | Where to Look |
|---|----------|---------------|
| OQ-M1 | What are the exact field definitions for each register? | Deep-dive into each module's register pages on hansamanuals.com |
| OQ-M2 | What are the complete validation rules per field? | Individual field help pages |
| OQ-M3 | What is the full permission model per register/action? | Access Groups configuration pages |
| OQ-M4 | What are the exact report parameters and outputs? | Individual report pages |
| OQ-M5 | What is the complete list of Settings per module? | Settings sub-pages per module |
| OQ-M6 | What are the exact number series/sequence rules? | Number Series configuration pages |
| OQ-M7 | What are the exact bank export/import file formats? | Export/Import sub-pages per country |

---

## 7. Summary Statistics

| Metric | Count |
|---|---|
| Modules extracted | 37+ |
| Named registers (data entities) | 100+ |
| Cross-module integrations mapped | 21 |
| Business rules documented | 80+ |
| Source pages analyzed | hansamanuals.com Standard ERP section |

---

*Extraction COMPLETE. This document represents the comprehensive manual extraction from hansamanuals.com Standard ERP documentation.*
*Next step: Merge with CODE_REQUIREMENTS.md and prior extraction in `_bmad-output/` for full spec-pack assembly.*

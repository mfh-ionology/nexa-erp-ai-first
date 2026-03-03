# Nexa ERP — Module Roadmap & Deep Dive Tracker

## General Features (Cross-Cutting)

- **Attachments** — Every record can have file attachments (images, PDFs, documents)
- **Record Links** — Cross-module navigation (e.g., NL transaction links back to the Invoice that created it)
- **Multi-Company** — Each company has its own data; some tables can be shared across companies (Items, Customers, etc.)
- **Activities** — Multi-purpose entity used for: CRM notes against customers, calendar bookings, time tracking against projects, service hours against service orders. Calendar view shows bookings. Integration with Outlook requires sync with overlap detection — ERP is source of truth, two-way sync to external calendars.

## Phase 1 — Core Modules

| # | Module | HW Code | Status | Notes |
|---|--------|---------|--------|-------|
| 1 | Nominal Ledger (Finance/GL) | NL | DEEP DIVE DONE | §2.13 in architecture — 12 models, GL posting pattern, bank rec, budgets |
| 2 | Stock / Inventory | IN | DEEP DIVE DONE | §2.14 in architecture — 7 models, 4 costing methods, ATP calc |
| 3 | Sales Orders | SO | DEEP DIVE DONE | §2.16 in architecture — 7 models, quote→order→ship→invoice lifecycle |
| 4 | Sales Ledger (AR) | SL | DEEP DIVE DONE | §2.15 in architecture — 7 models, credit management, aging, payment allocation |
| 5 | Purchase Orders | PO | DEEP DIVE DONE | §2.17 in architecture — 10 models, 3-way matching, BACS runs |
| 6 | Purchase Ledger (AP) | PL | DEEP DIVE DONE | §2.17 (combined with PO) — supplier bills, payments, payment allocation |
| 7 | Cash Book | CB | ABSORBED | Absorbed into Finance module (§2.13) — BankAccount, BankTransaction |
| 8 | Cheques | — | SKIP | Not needed for UK (direct bank payments via BACS) |
| 9 | Fixed Assets | FA | DEEP DIVE DONE | §2.18 in architecture — 8 models, dual-basis depreciation, disposal workflow. **NEW module.** |
| 10 | Pricing | PR | DEEP DIVE DONE | §2.19 in architecture — 5 models, 6-level price resolution, formula pricing |
| 11 | Calendar Module | — | NOT STARTED | Integration with Outlook/Google Calendar |
| 12 | Email Module | — | NOT STARTED | Integration — transactional + inbound email processing |
| 13 | Document Management | — | NOT STARTED | File storage, versioning, search across all attachments |

## Phase 2 — Essential Modules

| # | Module | HW Code | Status | Notes |
|---|--------|---------|--------|-------|
| 14 | CRM | CRM | NOT STARTED | Contacts, leads, pipeline, activities |
| 15 | Quotations | QT | NOT STARTED | May be part of Sales Orders module |
| 16 | Warehouse | WH | NOT STARTED | Advanced warehouse ops (picking, packing, zones) |
| 17 | Production / Manufacturing | PROD | NOT STARTED | BOMs, work orders, material consumption |
| 18 | MRP | MRP | NOT STARTED | Material Requirements Planning |
| 19 | POS (Point of Sale) | POS | NOT STARTED | Till interface, receipt printing, cash management |
| 20 | HR & Payroll | HR | NOT STARTED | Employees, payroll, leave, HMRC submissions |
| 21 | Business Alerts / Approvals | — | DEEP DIVE DONE | §2.20 in architecture — ApprovalRule, ApprovalRuleLevel, ApprovalRequest, auto-escalation |

## Phase 3 — Future Modules

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 22 | Consolidation | NOT STARTED | Multi-company financial consolidation |
| 23 | Contracts (Recurring Invoices) | NOT STARTED | Subscription billing, recurring invoice generation |
| 24 | Job Costing (Projects & Timesheets) | NOT STARTED | Project tracking, time entry, cost allocation |
| 25 | Task Manager | NOT STARTED | Task assignment, tracking, workflows |
| 26 | Calendar Integration | NOT STARTED | Deep Outlook/Google Calendar sync |
| 27 | KPIs | NOT STARTED | Dashboard KPI definitions, targets, tracking |

## Deep Dive Checklist (per module)

For each module, explore:
- [ ] **Registers** — Tables/entities, field definitions, record actions, row actions
- [ ] **Settings** — Module configuration that affects workflows and transactions
- [ ] **Forms** — Print-outs, PDF templates specific to this module
- [ ] **Reports** — Standard reports available in this module
- [ ] **Maintenances** — Batch updates, period-end processes, maintenance routines
- [ ] **Exports** — Data export formats and destinations
- [ ] **Imports** — Data import formats and sources
- [ ] **Workflows** — Transaction creation paths (manual + from other modules)
- [ ] **Cross-module links** — How transactions flow in from and out to other modules

## Transaction Creation Sources

Transactions in NL (and other ledgers) can be created:
- Manually by user
- From Invoices (AR → NL journal)
- From Bills (AP → NL journal)
- From Asset Depreciation (FA → NL journal)
- From Expenses
- From Delivery/Shipment (stock → NL journal)
- From Goods Receipt (stock → NL journal)
- From Payments/Receipts (banking → NL journal)
- From Manufacturing process completion (production → NL journal)
- From Payroll runs (HR → NL journal)
- From Period-end batch processes

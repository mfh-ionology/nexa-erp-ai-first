# Finance Module (FIN)

General Ledger, budgeting, bank reconciliation, VAT, financial reporting, inter-company transactions, and consolidation.

---

## Pages

### Chart of Accounts
- Hierarchical account list with account code, name, type, balance
- Tree view with expandable groups
- Quick search/filter by code, name, type
- Inline balance display (current period, YTD)
- **Features:**
  - Create/edit/deactivate accounts
  - Account types: Asset, Liability, Equity, Revenue, Expense
  - Sub-account support (parent-child hierarchy)
  - Default VAT code per account
  - Dimension tagging (department, cost centre)
  - Block posting to group/header accounts

### Journal Entries
- List of all journal entries with filters (date range, status, source, account)
- **Features:**
  - Manual journal creation (debit/credit lines)
  - Recurring journal templates
  - Reversing journals (auto-reverse on specified date)
  - Journal approval workflow (draft → pending approval → posted)
  - Attachment support (receipts, invoices)
  - Sub-ledger source tracking (AR, AP, Payroll, etc.)

### Bank Accounts
- List of bank accounts with current balances
- **Features:**
  - Bank account setup (name, account number, sort code, currency, GL account link)
  - Opening balance entry
  - Bank feed import (OFX, CSV, QIF)
  - Manual transaction entry

### Bank Reconciliation
- Side-by-side view: bank statement vs GL transactions
- **Features:**
  - Auto-matching rules (amount, date, reference)
  - Manual matching (drag-and-drop or checkbox)
  - Create adjustment entries for differences
  - Reconciliation history and audit trail
  - Unreconciled items report

### Budgets
- Budget entry grid by account and period
- **Features:**
  - Multiple budget versions (e.g., Original, Revised, Forecast)
  - Budget Keys — predefined distribution patterns across months (e.g., equal, seasonal, weighted)
  - Copy budget from prior year with % adjustment
  - Budget vs Actual comparison
  - Dimension-based budgets (by department, cost centre, project)
  - Budget approval workflow
  - Import budgets from Excel

### Simulations
- What-if scenario modelling
- **Features:**
  - Create simulation from existing data
  - Adjust values and see projected impact
  - Compare multiple simulations side by side
  - Convert simulation to budget or journal

### Dimensions
- Manage dimension types (Department, Cost Centre, Project, etc.)
- **Features:**
  - Create dimension types and values
  - Assign dimensions to transactions
  - Dimension hierarchies for roll-up reporting
  - Mandatory dimension rules per account

### Financial Years & Periods
- _(See Settings section)_

### Inter-Company Transactions
- Transactions between companies within the same group
- **Features:**
  - Inter-company journal creation (debit in Company A, credit in Company B)
  - Auto-generate matching entry in the counterpart company
  - Inter-company account mapping (define which accounts link between companies)
  - Inter-company balance tracking (who owes whom)
  - Inter-company reconciliation (match and clear balances)
  - Currency handling when companies use different base currencies
  - Inter-company transaction approval workflow
  - Audit trail linking both sides of the transaction

### Consolidation
- Combine financial data from multiple companies into group-level statements
- **Features:**
  - Consolidation group setup (parent company, subsidiaries)
  - Chart of accounts mapping (map subsidiary accounts to group COA)
  - Elimination entries (inter-company balances, inter-company revenue/cost)
  - Auto-generate elimination journals
  - Currency translation for foreign subsidiaries (closing rate for BS, average rate for P&L)
  - Translation gain/loss tracking (equity reserve)
  - Minority interest calculation (if partially owned subsidiaries)
  - Consolidation adjustments (manual entries for goodwill, fair value adjustments)
  - Consolidation status: Draft, In Progress, Finalised
  - Period-by-period consolidation with comparative
  - Drill-down from consolidated figures to individual company source

---

## Settings

### Accounting Periods
- Define period calendar (monthly, 4-4-5, 13-period, custom)
- Open/close periods (prevent posting to closed periods)
- Period locking with override permission for authorised users

### Financial Years
- Define fiscal year start/end dates
- Year-end close process (see Maintenances)
- Retained earnings account assignment

### Base Currencies (Base 1 & Base 2)
- Set primary reporting currency (Base 1) per company
- Set secondary reporting currency (Base 2) per company
- All transactions stored in transaction currency + both base currencies

### Currencies
- Currency master table (code, name, symbol, decimal places)
- Active/inactive flag

### Currency Exchange Rates
- Exchange rate table (from currency, to currency, date, rate)
- Rate types: spot, average, closing
- **Auto-sync from online service** (e.g., ECB, Open Exchange Rates, free API)
- Manual rate entry/override
- Historical rate lookup

### Number Series
- NL Transactions number series (prefix, next number, format)
- Simulations number series
- Configurable per document type

### VAT Codes
- VAT code table (code, description, rate %, account)
- Standard, reduced, zero-rated, exempt, reverse charge
- Flat Rate scheme support
- EU/international VAT handling

### Rate Gain/Loss
- Realised and unrealised gain/loss accounts
- Auto-calculation on payment/receipt in foreign currency
- Revaluation settings for period-end

### Sub Systems
- Define sub-ledger sources (AR, AP, Payroll, Fixed Assets, Inventory, etc.)
- Each sub-system maps to a control account

### Sub-Ledger Control Accounts
- Map each sub-system to its GL control account(s)
- Receivables control, payables control, stock control, etc.
- Prevent direct posting to control accounts (only via sub-ledger)

### Budget Versions
- Define named budget versions (Original, Revised Q1, Forecast H2, etc.)
- Active/locked status

### Budget Keys
- Predefined month-by-month distribution patterns
- Examples: Equal (1/12 each), Seasonal (heavier in Q4), Custom percentages
- Assign to budget lines for automatic period distribution

### Inter-Company Settings
- Inter-company account mapping (Company A account ↔ Company B account)
- Default inter-company clearing accounts
- Auto-posting rules (auto-generate counterpart entry on/off)
- Inter-company approval thresholds

### Consolidation Settings
- Consolidation group definition (parent, subsidiaries, ownership %)
- Group chart of accounts
- Subsidiary-to-group account mapping
- Currency translation method per subsidiary (closing rate, temporal, etc.)
- Elimination rule templates (inter-company revenue, inter-company balances)
- Consolidation calendar (which periods to consolidate)

---

## Reports

### Standard Financial Reports
- **Profit & Loss (P&L)** — comparative periods, dimension breakdown, % of revenue
- **Balance Sheet** — as-at date, comparative, dimension breakdown
- **Trial Balance** — period or date range, detail or summary, include zero balances toggle
- **Cash Flow Statement** — direct or indirect method, period comparison
- **Transaction Journal** — all posted transactions with filters (date, account, source, amount range)
- **Nominal Ledger** — account-by-account transaction listing (HansaWorld reference)

### VAT Reports
- **VAT Return** — 9-box HMRC format, Flat Rate scheme support
- **VAT Audit Report** — transaction-level detail supporting each box

### Budget Reports
- **Budget vs Actual** — variance analysis by account, period, dimension
- **Budget Summary** — version comparison

### Bank Reports
- **Bank Reconciliation Report** — reconciled/unreconciled items at a date
- **Bank Summary** — balances across all bank accounts

### Analysis Reports
- **Key Financial Ratios** — liquidity (current ratio, quick ratio), profitability (gross margin, net margin, ROE), efficiency (debtor days, creditor days, stock turnover) — **TODO:** Review HansaWorld Key Financial Ratios report
- **Aged Analysis** — receivables and payables aging
- **Dimension Analysis** — P&L or TB grouped by dimension values

### Inter-Company Reports
- **Inter-Company Transactions Report** — all transactions between group companies with matching status
- **Inter-Company Balances Report** — who owes whom, with aging
- **Inter-Company Reconciliation Report** — matched vs unmatched entries between companies

### Consolidation Reports
- **Consolidated P&L** — group-level P&L with elimination of inter-company revenue/costs
- **Consolidated Balance Sheet** — group-level BS with elimination of inter-company balances
- **Consolidated Trial Balance** — group TB after eliminations
- **Consolidation Adjustments Report** — all elimination entries and manual adjustments
- **Currency Translation Report** — translation gains/losses per subsidiary
- **Subsidiary Contribution Report** — each subsidiary's contribution to group figures

### Additional Reports (from HansaWorld reference)
- **TODO:** Mohammed to review and confirm which of these are needed:
  - Cash Flow (detailed)
  - Account Reconciliation

---

## Maintenances (Batch Jobs)

### Year End Close
- Close all revenue and expense accounts to retained earnings
- Generate closing journal entries automatically
- Lock the financial year after close
- Carry forward balance sheet balances to new year opening
- **Prerequisite checks:** all periods closed, all sub-ledgers posted, bank reconciled

### Period End Close
- Close accounting period (prevent further posting)
- Generate period-end adjustments (accruals, prepayments)

### Currency Revaluation
- Revalue foreign currency balances at period-end rates
- Generate unrealised gain/loss journals
- Reverse on first day of next period (optional)

### VAT Return Generation
- Calculate 9-box values from transactions in period
- Generate draft for review
- Submit to HMRC via MTD API

### Recurring Journal Processing
- Process all due recurring journals for the period
- Generate actual journal entries from templates

### Inter-Company Reconciliation
- Auto-match inter-company transactions across companies
- Flag unmatched entries for review
- Clear matched balances

### Consolidation Run
- Execute consolidation for a period: pull subsidiary data, apply account mapping, generate eliminations, translate currencies
- Consolidation validation checks (all subsidiaries closed, account mappings complete)
- Generate consolidated trial balance and financial statements

---

## Exports & Imports

### Exports
- Chart of Accounts export (CSV/Excel)
- Journal entries export (CSV/Excel, filtered by date/status)
- Trial Balance export (PDF/Excel)
- Bank statement export
- VAT return export (for accountant review)

### Imports
- Chart of Accounts import (CSV/Excel with mapping wizard)
- Opening balances import
- Journal entries import (bulk)
- Bank statement import (OFX, CSV, QIF)
- Budget import (Excel)
- Historical data migration import

---

## Forms (Printable Documents)

- **Customer Statement** — outstanding balance and transaction history
- **Cash Receipt** — payment received acknowledgement
- **Bank Payment Voucher** — internal payment authorisation record
- **Journal Voucher** — printed journal entry for filing

---

## Notes

- Finance module is partially built (E14 Wave 1). Chart of Accounts, Journals, Bank Accounts, Bank Reconciliation, Budgets, Simulations, Dimensions, Financial Years pages exist.
- Multi-currency (Base 1/Base 2), currency exchange sync, VAT codes, sub-ledger controls, budget keys are NEW requirements to be added.
- Financial report renderer (P&L, BS, TB specialised display) is a gap vs the generic T8 report template.

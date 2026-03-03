# Epic E25: Reporting Engine

> **Comprehensive reporting engine providing standard financial reports, operational reports, HR reports, custom report builder, and AI-powered ad-hoc natural language queries.** Includes VAT return generation for HMRC MTD submission and cash flow forecasting.

**Architecture:** §2.25 Reporting Engine (referenced in PRD)
**API:** §2.18 — ~14 endpoints under `/reports/*`
**FRs:** FR74–FR79, FR91, FR153
**UX Templates:** T8 (Report), T4 (Briefing)

**Dependencies:** E14 (Finance/GL for financial reports), E17/E19 (AR/AP for aging), E23 (HR for payroll/HR reports), E15 (Inventory for stock valuation), E5 (AI for natural language queries)

---

## Story E25.S1: Financial Reports (P&L, Balance Sheet, Trial Balance)

**User Story:** As a finance user, I want to generate standard financial reports (Profit & Loss, Balance Sheet, Trial Balance, Cash Flow Statement) for any date range so that I can review the company's financial position.

**Acceptance Criteria:**

```gherkin
Scenario: Generate Profit & Loss report
  Given journal entries exist for Q1 2026
  When I generate a P&L report for 1 Jan to 31 Mar 2026
  Then the report shows income, cost of sales, gross profit, expenses, and net profit
  And each line maps to chart of account categories
  And the report totals balance (income - expenses = net profit)

Scenario: Generate Balance Sheet
  Given the GL has posted entries
  When I generate a Balance Sheet as at 31 March 2026
  Then the report shows assets, liabilities, and equity
  And assets = liabilities + equity (double-entry verification)

Scenario: Generate Trial Balance
  Given GL accounts have balances
  When I generate a Trial Balance for March 2026
  Then all accounts with non-zero balances are listed
  And total debits equal total credits

Scenario: Comparative period reporting
  Given I want to compare Q1 2026 to Q1 2025
  When I generate a comparative P&L
  Then both periods are shown side by side with variance (amount and percentage)

Scenario: Export report to PDF and CSV
  Given a financial report is generated
  When I click Export PDF
  Then a formatted PDF is downloaded
  When I click Export CSV
  Then a CSV file with report data is downloaded (FR78)
```

**Key Tasks:**
1. **Implement P&L report query** — aggregate journal entries by account category for date range
   - Income, COGS, operating expenses, other income/expenses
   - Support department/cost centre filtering
2. **Implement Balance Sheet query** — cumulative balances as at date
   - Fixed assets (net of depreciation), current assets, liabilities, equity
3. **Implement Trial Balance query** — all accounts with period debits, credits, and closing balance
4. **Implement comparative reporting** — dual-period with variance calculation
5. **Implement PDF export** — formatted report via Document Templates (E12)
6. **Implement CSV export** — tabular data export
7. **Build report UI** — T8 (Report) template with period selector, filters, table, and export buttons
8. **Write unit tests** — aggregation logic, balance verification (A=L+E, DR=CR)
9. **Write integration tests** — report generation with seeded GL data

**FR/NFR References:** FR74, FR78, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR74, FR78) | Standard financial reports, export |
| Architecture | §2.25 Reporting Engine | Report query design, aggregation patterns |
| UX Design Specification | T8 (Report) | Report template with filters and export |
| API Contracts | §2.18 Reporting | Financial report endpoints |
| Data Models | §3 Finance | GL Account, JournalEntry for report queries |
| State Machine Reference | N/A | N/A for reports |
| Event Catalog | N/A | N/A for reports |
| Business Rules Compendium | §12 Cross-Cutting | Report calculation rules |

---

## Story E25.S2: Operational Reports (AR/AP Aging, Stock Valuation)

**User Story:** As a finance/operations user, I want to generate operational reports (AR/AP aging, stock valuation, bank reconciliation) so that I can manage working capital and operational performance.

**Acceptance Criteria:**

```gherkin
Scenario: Generate AR aging report
  Given open customer invoices exist with various due dates
  When I generate the AR aging report as at 31 March 2026
  Then invoices are grouped by customer and aging bands (Current, 30, 60, 90, 120+ days)
  And each band shows the outstanding amount
  And the total matches the debtor balance in the GL

Scenario: Generate AP aging report
  Given open supplier invoices exist
  When I generate the AP aging report
  Then invoices are grouped by supplier and aging bands
  And payment priority is indicated for overdue items

Scenario: Generate stock valuation report
  Given inventory items have stock and cost prices
  When I generate the stock valuation report
  Then each item shows quantity on hand, unit cost, and total value
  And the total valuation matches the inventory GL account balance

Scenario: Bank reconciliation report
  Given bank reconciliation has been performed
  When I generate the bank reconciliation report
  Then it shows: bank statement balance, unreconciled items, adjusted book balance
  And the reconciliation matches (statement balance - unreconciled = book balance)
```

**Key Tasks:**
1. **Implement AR aging report** — group open invoices by customer and aging bands
2. **Implement AP aging report** — group open supplier invoices by supplier and aging bands
3. **Implement stock valuation report** — current stock * cost price per item
4. **Implement bank reconciliation report** — reconciled vs unreconciled items
5. **Build report UIs** — T8 (Report) template for each report type
6. **Write unit tests** — aging band calculation, valuation, reconciliation math
7. **Write integration tests** — report accuracy with seeded transaction data

**FR/NFR References:** FR75, FR24, FR30, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR75) | Operational reports (aging, stock, bank rec) |
| Architecture | §2.25 Reporting Engine | Operational report queries |
| UX Design Specification | T8 (Report) | Report template |
| API Contracts | §2.18 Reporting | Operational report endpoints |
| Data Models | §5 AR, §7 AP, §4 Inventory | Models for report queries |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Aging calculation rules |

---

## Story E25.S3: VAT Return & HMRC MTD Submission

**User Story:** As a finance user, I want to generate VAT returns and submit them to HMRC via the Making Tax Digital (MTD) API so that we comply with UK VAT reporting requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Generate VAT return
  Given transactions exist for the VAT quarter (Jan-Mar 2026)
  When I generate the VAT return
  Then the 9 VAT return boxes are calculated from GL data:
    Box 1: VAT due on sales, Box 2: VAT due on acquisitions,
    Box 3: Total VAT due, Box 4: VAT reclaimed on purchases,
    Box 5: Net VAT (Box 3 - Box 4), Boxes 6-9: Sales/purchases totals

Scenario: VAT scheme configuration
  Given the company uses Flat Rate VAT Scheme
  When the VAT return is calculated
  Then the flat rate percentage is applied instead of standard input/output VAT (FR90)

Scenario: Submit VAT return to HMRC MTD
  Given a VAT return has been generated and reviewed
  When I submit to HMRC
  Then the return is sent via the HMRC MTD API
  And the response (acceptance/rejection) is recorded
  And the submission is logged in the audit trail

Scenario: Fraud prevention headers
  Given HMRC requires fraud prevention headers
  When the VAT return is submitted
  Then all required fraud prevention headers are included per HMRC specification
```

**Key Tasks:**
1. **Implement VAT return calculation** — aggregate transactions by VAT code and rate for the period
   - Support Standard, Flat Rate, and Cash Accounting schemes (FR90)
   - Calculate all 9 boxes per HMRC specification
2. **Implement HMRC MTD API integration** — authenticate via OAuth2, submit VAT return
   - Include fraud prevention headers
   - Handle async response and polling
3. **Build VAT return wizard** — T6 with period selection, preview of 9 boxes, submit button
4. **Implement audit logging** — log all submission attempts and responses
5. **Write unit tests** — box calculation for each VAT scheme, fraud header generation
6. **Write integration tests** — submission flow with mocked HMRC MTD API

**FR/NFR References:** FR77, FR89, FR90, FR91, NFR31, NFR32

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR77), §3.1.10 Compliance (FR89-FR91) | VAT return, MTD submission |
| Architecture | §2.25 Reporting Engine | HMRC MTD integration design |
| UX Design Specification | T6 (Wizard) | VAT return wizard |
| API Contracts | §2.18 Reporting | VAT return generation and submission endpoints |
| Data Models | §3 Finance | VAT-related GL accounts and transaction data |
| State Machine Reference | N/A | VAT return submission lifecycle |
| Event Catalog | N/A | vat.return.submitted event |
| Business Rules Compendium | §12 Cross-Cutting | VAT calculation rules, scheme handling |

---

## Story E25.S4: AI-Powered Ad-Hoc Queries

**User Story:** As a business user, I want to ask ad-hoc reporting questions in natural language and receive data-backed tabular or chart answers so that I can get instant insights without building custom reports.

**Acceptance Criteria:**

```gherkin
Scenario: Natural language query returns table
  Given financial data exists
  When I ask "What are our top 10 customers by revenue this year?"
  Then the AI interprets the query and generates a SQL query
  And returns a table showing customer name and total revenue, sorted by revenue descending
  And the query completes within 3 seconds (NFR1)

Scenario: Natural language query returns chart
  Given sales data exists for the past 12 months
  When I ask "Show me monthly sales trend for the last year"
  Then the AI generates a line chart showing monthly sales totals
  And the data is accurate per the GL

Scenario: Query with filters
  Given I ask "What is the average invoice value for customer ABC Ltd in Q1?"
  When the AI processes the query
  Then it applies customer and date filters correctly
  And returns the calculated average

Scenario: Confidence and accuracy
  Given a supported query type (aggregation, comparison, trend, filtered listing)
  When the AI generates the answer
  Then accuracy is >95% for supported patterns (FR79)
  And a confidence indicator is shown
  And the user can view the generated SQL for verification

Scenario: Unsupported query type
  Given I ask a question outside supported patterns
  When the AI processes it
  Then it responds with "I'm not able to answer that type of question yet" with suggestions for supported query types
```

**Key Tasks:**
1. **Implement natural language query endpoint** — `POST /api/v1/reports/ai-query`
   - Send query to AI Gateway for SQL generation
   - Execute generated SQL against read-only replica
   - Format results as table or chart based on query type
2. **Implement query type classification** — aggregation, comparison, trend, filtered listing
   - Return appropriate visualisation (table, bar chart, line chart, pie chart)
3. **Implement safety layer** — prevent destructive SQL; read-only queries only; scope by companyId
4. **Implement confidence scoring** — based on query pattern match and result verification
5. **Build ad-hoc query UI** — chat-like interface or query bar with results panel
   - Toggle between table and chart views
   - Show generated SQL for transparency
6. **Implement query caching** — cache results for identical queries within TTL
7. **Write unit tests** — SQL generation safety, companyId scoping, confidence scoring
8. **Write integration tests** — end-to-end query flow with AI Gateway mock

**FR/NFR References:** FR79, FR4, FR1, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR79), §3.1.1 AI (FR4) | Natural language queries, accuracy requirements |
| Architecture | §2.25 Reporting Engine, §2.7 AI Orchestration | AI query pipeline, SQL generation |
| UX Design Specification | T8 (Report), T4 (Briefing) | Query interface, results display |
| API Contracts | §2.18 Reporting | AI query endpoint |
| Data Models | All modules | All models queryable via AI |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Query safety rules, companyId scoping |

---

## Story E25.S5: Cash Flow Forecasting

**User Story:** As a finance director, I want AI-driven cash flow forecasts for 8-52 week projection periods with scenario analysis so that I can plan for liquidity needs and make informed financial decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Generate expected case forecast
  Given AR aging, AP aging, recurring invoices, and historical payment patterns exist
  When I generate a cash flow forecast for the next 12 weeks
  Then the system projects weekly inflows and outflows
  And shows opening balance, inflows, outflows, and closing balance per week

Scenario: Three scenario analysis
  Given a forecast is generated
  When I view scenario analysis
  Then I see Best Case, Expected, and Worst Case projections
  And each scenario uses different assumptions (e.g., payment timing, collection rates)

Scenario: Forecast includes known commitments
  Given payroll runs GBP 100K/month, rent is GBP 5K/month, and VAT payment of GBP 20K is due
  When these are included in the forecast
  Then they appear as committed outflows on their due dates

Scenario: Forecast warns of cash shortfall
  Given the Expected case shows a negative balance in week 8
  When I view the forecast
  Then the shortfall period is highlighted in red
  And the AI suggests actions (e.g., "Chase overdue AR invoices totalling GBP 15,000")
```

**Key Tasks:**
1. **Implement cash flow forecast engine** — `POST /api/v1/reports/cash-flow-forecast`
   - Gather: AR aging (expected collections), AP aging (expected payments), recurring items, committed costs
   - Apply historical payment patterns for collection timing
   - Generate weekly projections for specified period
2. **Implement scenario modelling** — best (fast collection, delayed payments), expected (average), worst (slow collection, early payments)
3. **Implement known commitments** — payroll, rent, tax payments, loan repayments
4. **Implement AI suggestions** — action recommendations for shortfall periods via AI Gateway
5. **Build forecast dashboard** — T4 (Briefing) with line chart showing 3 scenarios, weekly table
6. **Write unit tests** — projection calculation, scenario parameters, shortfall detection
7. **Write integration tests** — forecast with seeded AR/AP/commitment data

**FR/NFR References:** FR153, FR4, NFR1, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR153) | Cash flow forecasting, scenario analysis |
| Architecture | §2.25 Reporting Engine | Forecast engine design, AI integration |
| UX Design Specification | T4 (Briefing) | Forecast dashboard with charts |
| API Contracts | §2.18 Reporting | Cash flow forecast endpoint |
| Data Models | §5 AR, §7 AP, §3 Finance | Data sources for forecasting |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Forecast calculation assumptions |

---

## Story E25.S6: Custom Report Builder

**User Story:** As a power user, I want to build custom reports by selecting entities, fields, filters, groupings, and calculations so that I can create reports specific to my business needs without developer assistance.

**Acceptance Criteria:**

```gherkin
Scenario: Build a custom report
  Given I want a report showing "Invoice amount by customer by month"
  When I select entity "CustomerInvoice", fields "customer.name, invoiceDate, totalAmount"
  And add grouping by "customer.name" and "month(invoiceDate)"
  And add aggregation "SUM(totalAmount)"
  Then the report is generated with the specified structure

Scenario: Save report definition
  Given I built a custom report
  When I save it with name "Monthly Revenue by Customer"
  Then the report definition is saved and appears in my saved reports

Scenario: Schedule report
  Given a saved custom report exists
  When I schedule it to run weekly on Monday and email to finance@company.com
  Then the report runs automatically on schedule and is emailed as PDF

Scenario: Share report with team
  Given a saved custom report exists
  When I share it with the "Finance" role
  Then users with Finance access can view and run the report
```

**Key Tasks:**
1. **Design report definition schema** — entity, fields, joins, filters, groupings, aggregations, sort order
2. **Implement report builder endpoint** — `POST /api/v1/reports/custom/run`
   - Translate definition to SQL query; execute; return results
3. **Implement report definition CRUD** — save, update, delete, list saved reports
4. **Implement report scheduling** — BullMQ scheduled jobs for automatic execution and email delivery
5. **Build report builder UI** — drag-and-drop field selector, filter builder, preview pane
6. **Implement report sharing** — role-based access to saved report definitions
7. **Write unit tests** — definition-to-SQL translation, filter logic
8. **Write integration tests** — build-save-run-schedule cycle

**FR/NFR References:** FR79, FR78, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR79, FR78) | Custom reporting, export capabilities |
| Architecture | §2.25 Reporting Engine | Custom report builder design |
| UX Design Specification | T8 (Report) | Report builder interface |
| API Contracts | §2.18 Reporting | Custom report endpoints |
| Data Models | All modules | All models available for custom reports |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | Report generation events |
| Business Rules Compendium | §12 Cross-Cutting | Report security, companyId scoping |

---

## Story E25.S7: Fraud Detection Reports

**User Story:** As a finance administrator, I want fraud detection reports showing duplicate payment attempts, suspicious transactions, and anomaly patterns so that I can identify and investigate potential financial fraud.

**Acceptance Criteria:**

```gherkin
Scenario: Duplicate payment detection
  Given two supplier invoices have the same supplier, amount, and similar reference
  When the duplicate detection report runs
  Then the potential duplicates are flagged with match details (FR155)

Scenario: Suspicious transaction alerting
  Given a transaction matches configurable rules (unusual amount, new supplier large payment)
  When the fraud risk analysis runs
  Then the transaction is flagged with the triggered rule and risk score (FR156)

Scenario: Fraud risk summary report
  Given flagged transactions exist
  When I view the fraud risk summary
  Then I see: duplicate payment attempts, suspicious transactions, anomaly patterns
  And each item has investigation status (Open, Investigating, Cleared, Confirmed) (FR157)

Scenario: Configurable fraud rules
  Given I am an ADMIN
  When I configure a fraud rule "Flag payments over GBP 10,000 to suppliers created in last 30 days"
  Then the rule is active and flags matching transactions
```

**Key Tasks:**
1. **Implement duplicate payment detection** — match supplier + amount + reference + date proximity
2. **Implement configurable fraud rules engine** — rule definition with conditions and thresholds
3. **Implement anomaly detection** — statistical analysis for out-of-pattern transactions
4. **Build fraud risk dashboard** — T4 (Briefing) with risk summary, flagged items, investigation tracking
5. **Build rule configuration UI** — T7 (Settings) for ADMIN users
6. **Write unit tests** — duplicate matching, rule evaluation, anomaly scoring
7. **Write integration tests** — fraud detection pipeline with test transactions

**FR/NFR References:** FR155, FR156, FR157, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.10 Compliance (FR155, FR156, FR157) | Fraud detection rules, duplicate payments |
| Architecture | §2.25 Reporting Engine | Fraud detection engine design |
| UX Design Specification | T4 (Briefing), T7 (Settings) | Fraud dashboard, rule configuration |
| API Contracts | §2.18 Reporting | Fraud detection and rule endpoints |
| Data Models | §7 AP, §3 Finance | Transaction data for fraud analysis |
| State Machine Reference | N/A | Investigation status lifecycle |
| Event Catalog | N/A | fraud.alert.created event |
| Business Rules Compendium | §12 Cross-Cutting | BR-SYS-013 (duplicate detection), BR-SYS-014 (fraud rules) |

---

## Story E25.S8: Mobile Adaptation — Reporting

**User Story:** As a mobile user, I want to view key financial dashboards and saved reports on my phone so that I can monitor business performance on the go.

**Acceptance Criteria:**

```gherkin
Scenario: View financial dashboard on mobile
  Given financial reports are available
  When I open the reporting section on mobile
  Then I see KPI cards (revenue, profit, cash balance, AR/AP totals)
  And can tap to see trend charts

Scenario: View saved report on mobile
  Given a saved report "Monthly Revenue by Customer" exists
  When I open it on mobile
  Then the report renders in a mobile-friendly format (scrollable table or chart)

Scenario: Push notification for scheduled reports
  Given a scheduled report completed
  When I receive the notification
  Then I can view the report summary or download the PDF

Scenario: Cash flow forecast on mobile
  Given a cash flow forecast exists
  When I view it on mobile
  Then I see a simplified chart with the expected case
  And shortfall warnings are highlighted
```

**Key Tasks:**
1. **Create mobile financial dashboard** — KPI cards with sparkline charts
2. **Create mobile report viewer** — adaptive rendering for tables and charts
3. **Implement push notifications** — for scheduled report completion
4. **Create mobile forecast viewer** — simplified chart view
5. **Write unit tests** — mobile data transformations
6. **Write integration tests** — mobile report access

**FR/NFR References:** FR74, FR75, FR78, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR74, FR75, FR78) | Reports applicable to mobile |
| Architecture | §2.25 Reporting Engine | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.18 Reporting | Same endpoints for mobile |
| Data Models | All modules | Same data sources |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | Push notification triggers |
| Business Rules Compendium | §12 Cross-Cutting | Same rules |

---

---

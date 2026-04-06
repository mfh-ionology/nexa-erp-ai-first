# Cross-Cutting Requirements

These frameworks and features apply across all modules.

---

## 1. Report Runner Framework

A standardised way to define, run, filter, and display reports across all modules.

### Report Parameter Window
- Every report opens with a **Parameters Panel** before execution
- Collapsible/expandable panel at the top of the report screen
- Standard filter types: date pickers, dropdowns (LOV-backed), lookups, toggles/checkboxes
- "Run Report" primary action button
- "Save Parameters" to reuse filter presets
- Date presets: Today, This Week, This Month, This Quarter, YTD, Last Month, Last Quarter, Last Year, Custom Range

### Report Display
- Results rendered in a data table with sortable/groupable columns
- AI Summary section — narrative insights generated from report data
- Optional chart/visualisation toggle (bar, line, pie)
- Group by Dimension dropdown (where applicable)

### Report Actions
- Export: PDF, Excel (CSV), Print
- Schedule: run on a recurring cron (daily, weekly, monthly, custom)
- Share: email report output to users/groups
- Save as Custom View: save column selection + filters as a named view

### Report Template (T8)
- Already specified in UX Design Specification (`standardised-screen-templates.md`)
- All reports MUST use T8 as the base layout

### Financial Report Add-on
- Financial statements (P&L, Balance Sheet, Trial Balance) need a specialised renderer
- Support for comparative periods (current vs prior period, current vs budget)
- Support for dimension-based views (by department, cost centre, project)
- Hierarchical account grouping with subtotals and totals
- Key Financial Ratios report (liquidity, profitability, efficiency ratios)
- **TODO:** Mohammed to review HansaWorld Key Financial Ratios report for reference

---

## 2. Maintenance / Batch Job Runner Framework

A standardised way to define, run, and monitor background batch jobs.

### Batch Job Runner Window
- Dedicated page to launch maintenance/batch jobs
- Each job has a parameter form (similar to report parameters) before execution
- "Run Now" button to start, with confirmation dialog for destructive jobs
- Shows estimated duration where possible

### Job Progress
- Real-time progress bar with percentage and status text
- Jobs run in background — user can navigate away
- Notification when job completes (success or failure)
- Job log with detailed output for troubleshooting

### Technology
- BullMQ + Redis (already in the stack)
- Each job type registered as a named queue/processor

---

## 3. Jobs & Reports Monitor

A single window showing all in-progress and recent background activity.

### Content
- **In Progress**: currently running reports, batch jobs, exports, imports
  - Shows: job name, type (report/batch/export/import), started at, progress %, user who triggered
- **Recent**: completed jobs from the last 24 hours
  - Shows: job name, type, started, completed, duration, status (success/failed/cancelled)
  - Failed jobs show error summary with "Retry" action
- **Scheduled**: upcoming scheduled reports and jobs
  - Shows: next run time, frequency, last run status

### Actions
- Cancel an in-progress job
- Retry a failed job
- Download output (for completed reports/exports)
- View detailed log

---

## 4. Copilot Enhancements

### Chat History
- Dedicated page or panel to browse past copilot conversations
- List view: conversation title (auto-generated or user-named), date, message count
- Click to open full conversation transcript
- Search across conversations
- Delete/archive old conversations

### Context Monitor
- Visual indicator in the copilot drawer showing token usage
- Slider/progress bar that fills as conversation grows toward max context
- Warning when approaching limit (e.g., 80%)
- "Start New Chat" suggestion when context is nearly full
- Show current token count / max tokens

---

## 5. Form Creator (Printable Documents)

System for designing and generating printable business documents.

### Supported Document Types
- Sales: Invoice, Credit Note, Proforma Invoice, Quote, Sales Order, Delivery Note
- Purchase: Purchase Order, Goods Receipt Note, Supplier Remittance
- Finance: Cash Receipt, Customer Statement
- HR: Payslip, P45, P60
- (extensible per module)

### Template Management
- HTML-based templates with variable injection (Handlebars syntax)
- Admin UI with syntax-highlighted HTML editor
- Live preview with sample data
- Template versioning (active/draft)
- Priority-based selection: by language, branch, number series, access group, customer group
- Company branding toggles: show logo, bank details, VAT number, custom footer

### Generation
- Single document: generate PDF from template + record ID
- Batch generation: generate PDFs for multiple records (via BullMQ)
- Email: generate and send document as email attachment
- Already specified in Epic E12 (Document Templates & PDF)

---

## 6. Exports & Imports Framework

### Exports
- Export any list/report to CSV, Excel, PDF
- Export with current filters applied
- Large exports run as background jobs (visible in Jobs Monitor)
- Template-based export: define which fields to include

### Imports
- CSV/Excel import with column mapping wizard
- Validation step: show preview of parsed data with error highlighting
- Dry run option: validate without committing
- Import log: track what was imported, by whom, when
- Rollback capability for recent imports (within configurable window)

---

## Notes

- **Existing specs**: Report framework (E25), Document templates (E12), BullMQ workers, T8 template are already defined in the planning artifacts. This file captures the consolidated requirements and any gaps.
- **Sales Forecast + Purchase Plans**: cross-module feature that combines Sales forecasting with automated purchase planning. To be detailed in Sales and Purchasing module files.

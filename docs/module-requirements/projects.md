# Projects & Job Costing Module (PRJ)

Project management, time tracking, budgeting, and job costing.

---

## Pages

### Projects
- Project master list with filters (status, manager, client, date range)
- **Features:**
  - Project details: name, code, client/customer, manager, start/end dates
  - Project types: Fixed Price, Time & Materials, Internal, Retainer
  - Project status: Planning, Active, On Hold, Completed, Cancelled
  - Project hierarchy (project → phases → tasks)
  - Project team assignment
  - Billing method configuration
  - Document attachments (contracts, specs)

### Project Transactions
- All financial transactions against a project
- **Features:**
  - Transaction types: labour (from timesheets), materials (from stock/purchase), expenses, overheads
  - Transaction source linking (timesheet entry, purchase order, expense claim)
  - Revenue recognition entries
  - WIP (Work in Progress) journal entries
  - Drill-down to source documents

### Time Sheets
- Staff time recording against projects/tasks
- **Features:**
  - Weekly timesheet grid (days as columns, projects/tasks as rows)
  - Daily time entry with hours, description
  - Billable / non-billable flag per entry
  - Overtime tracking
  - Timesheet submission and approval workflow
  - Timer/stopwatch mode
  - Copy from previous week

### Project Schedule
- Task scheduling and progress tracking
- **Features:**
  - Task list with dependencies (finish-to-start, start-to-start)
  - Gantt chart view
  - Milestone tracking
  - % complete per task
  - Critical path highlighting
  - Resource allocation per task
  - Baseline schedule vs actual comparison

### Project Budget
- Cost and revenue budgeting per project
- **Features:**
  - Budget by cost category (labour, materials, expenses, subcontract, overheads)
  - Budget by phase/task
  - Budget versions (original, revised)
  - Budget vs actual tracking with variance analysis
  - Estimated cost at completion (EAC) calculation
  - Revenue budget and billing schedule

### Expenses
- Project-related expense claims
- **Features:**
  - Expense entry: date, category, amount, project, description, receipt attachment
  - Expense categories: travel, accommodation, meals, supplies, etc.
  - Mileage calculator
  - Per diem rates
  - Expense approval workflow
  - Reimbursement tracking
  - Billable expense flag (pass through to client)

---

## Settings

- Project types and categories
- Cost categories
- Billing rate tables (by role, project type, client)
- Expense categories and limits
- Timesheet approval rules
- Overhead allocation rates
- Revenue recognition methods (% completion, milestone, time-based)
- Number series (projects, timesheets, expense claims)
- Working hours per day/week (for schedule calculations)

---

## Reports

- Project Profitability Report (revenue vs cost vs margin)
- Project Status Report (schedule, budget, % complete)
- Timesheet Report (by employee, project, date range)
- Utilisation Report (billable hours / available hours)
- WIP Report (unbilled work in progress)
- Budget vs Actual Report
- Expense Report (by project, employee, category)
- Resource Allocation Report (who is assigned where)
- Billing Report (invoiced vs unbilled)
- Project Pipeline Report (upcoming projects)

---

## Maintenances (Batch Jobs)

- **WIP Calculation** — calculate and post WIP journal entries at period end
- **Revenue Recognition** — calculate and post revenue based on recognition method
- **Timesheet Reminders** — notify users with incomplete timesheets
- **Billing Run** — generate invoices from approved time and expenses

---

## Exports & Imports

- Project master export/import
- Timesheet data export
- Project budget export/import (Excel)
- Expense data export

---

## Forms (Printable Documents)

- Project Proposal / Quote
- Timesheet Summary (for client approval)
- Expense Claim Form
- Project Invoice (with time/expense detail)
- Project Status Report (printable)

# HR & Payroll Module (HR)

Employee management, contracts, payroll, leave, appraisals, and compliance.

---

## Pages

### Employees
- Employee master list with filters (department, status, location, job title)
- **Features:**
  - Personal details: name, DOB, address, phone, email, emergency contact
  - Employment details: employee number, hire date, department, job title, manager
  - Employment status: Active, Probation, Suspended, Terminated, Retired
  - Employee photo
  - Bank details (for payroll)
  - Tax details (tax code, NI number, student loan plan)
  - Right to work documents
  - Document attachments (contracts, certificates, ID copies)
  - Employee self-service portal access

### Contracts
- Employment contract management
- **Features:**
  - Contract details: type (permanent, fixed-term, zero-hours, contractor), start/end date
  - Salary/rate: annual salary, hourly rate, daily rate
  - Working hours: full-time, part-time, hours per week
  - Probation period and review date
  - Notice period
  - Benefits (pension, healthcare, car allowance)
  - Contract amendments history
  - Contract renewal reminders

### Job Positions
- Organisational structure and role definitions
- **Features:**
  - Position details: title, department, grade/band, reporting line
  - Position status: Open, Filled, Frozen
  - Headcount tracking (budgeted vs actual)
  - Job description and requirements
  - Salary range per position/grade

### Checklists
- Onboarding/offboarding task tracking
- **Features:**
  - Checklist templates: Onboarding, Offboarding, Probation Review
  - Task items with assignee, due date, completion status
  - Auto-trigger on employee status change (e.g., hire triggers onboarding)
  - Document collection tracking (right to work, P45, bank details)

### Appraisals / Performance Reviews
- Employee performance management
- **Features:**
  - Appraisal cycles (annual, bi-annual, quarterly)
  - Goal setting and tracking
  - Self-assessment and manager assessment
  - Rating scales (customisable)
  - Development plan creation
  - Appraisal history per employee
  - 360-degree feedback (optional)

### Leave Management
- Holiday and absence management
- **Features:**
  - Leave types: Annual Leave, Sick Leave, Maternity/Paternity, Unpaid, TOIL, Compassionate
  - Leave entitlement calculation (by contract type, tenure, pro-rata for part-time)
  - Leave request and approval workflow
  - Leave calendar view (team availability)
  - Carry-over rules (max days, expiry)
  - Bradford Factor calculation (absence patterns)
  - Public holiday calendar (by region)
  - Leave balance display

### Skills & Qualifications
- Employee skill tracking
- **Features:**
  - Skill categories and individual skills
  - Proficiency levels
  - Expiry dates for certifications (e.g., first aid, forklift licence)
  - Renewal reminders
  - Skills gap analysis (position requirements vs employee skills)

### Training
- Training management
- **Features:**
  - Training courses: name, provider, cost, duration
  - Training requests and approval
  - Training schedule and enrolment
  - Completion tracking and certificates
  - Training cost tracking per employee/department
  - Mandatory training tracking (health & safety, GDPR)

### Payroll (UK)
- Monthly payroll processing
- **Features:**
  - Gross to net calculation: basic pay + additions - deductions
  - Additions: overtime, bonus, commission, allowances, SSP, SMP, SPP
  - Deductions: PAYE tax, National Insurance (employee + employer), pension, student loan, attachment of earnings
  - Tax code processing (cumulative and week 1/month 1)
  - NI category handling (A, B, C, H, M, etc.)
  - Workplace pension auto-enrolment (assessment, opt-in/out, contribution calculation)
  - Payslip generation
  - BACS payment file generation
  - RTI submissions to HMRC (FPS, EPS)
  - Year-end: P60 generation, final FPS
  - Starter/leaver processing (P45/P46)
  - Salary sacrifice schemes
  - Multiple pay frequencies (monthly, weekly, 4-weekly)

---

## Settings

- Departments and organisational structure
- Job grades/bands and salary scales
- Leave types and entitlement rules
- Public holiday calendars (by region)
- Appraisal cycle configuration
- Checklist templates
- Skill categories
- Training providers
- Payroll: tax bands, NI thresholds, pension auto-enrolment thresholds (updated annually)
- Pay elements (additions and deduction types)
- BACS bureau configuration
- HMRC gateway credentials (for RTI)
- Number series (employee numbers, payslips)
- Working pattern templates (Mon-Fri, shift patterns)

---

## Reports

- Employee Directory Report
- Headcount Report (by department, location, status)
- Turnover Report (starters/leavers by period)
- Absence Report (by employee, type, Bradford Factor)
- Leave Balance Report
- Appraisal Status Report (due, overdue, completed)
- Skills Matrix Report
- Training Report (completed, upcoming, costs)
- Payroll Summary Report (gross, deductions, net by department)
- Payroll Variance Report (period-over-period changes)
- P11 Deductions Working Sheet
- Employer Cost Report (salary + employer NI + employer pension)
- Gender Pay Gap Report
- Right to Work Expiry Report

---

## Maintenances (Batch Jobs)

- **Payroll Run** — calculate pay for all employees in a pay period
- **RTI Submission** — submit FPS/EPS to HMRC
- **Pension Auto-Enrolment Assessment** — assess eligible jobholders
- **Leave Carry-Over** — process carry-over at year end, expire excess
- **Certification Expiry Check** — flag expiring skills/certifications
- **Probation Review Reminders** — notify managers of upcoming reviews
- **P60 Generation** — batch generate year-end P60s

---

## Exports & Imports

- Employee master export/import (CSV/Excel)
- Payroll data export (for accountant/auditor)
- BACS payment file export
- RTI file export (XML for HMRC)
- Leave data export
- Training records export

---

## Forms (Printable Documents)

- Payslip
- P45 (leaver certificate)
- P60 (annual tax summary)
- Employment Contract
- Offer Letter
- Leave Request Form
- Expense Claim Form
- Training Certificate
- Appraisal Form

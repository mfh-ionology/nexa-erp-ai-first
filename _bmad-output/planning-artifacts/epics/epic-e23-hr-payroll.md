# Epic E23: HR / Payroll

> **Comprehensive HR and payroll management covering employee records, contracts, leave, appraisals, skills, training, payroll processing, and HMRC RTI submissions.** UK employment law compliant with PAYE, NI, auto-enrolment pension, and statutory payments.

**Architecture:** §2.22 HR/Payroll
**Models:** 36 models — `Employee`, `EmploymentContract`, `ContractChange`, `Department`, `JobPosition`, `PayrollRun`, `PayrollRunLine`, `PayComponent`, `PayrollCalendar`, `LeaveType`, `LeaveEntitlement`, `LeaveRequest`, `AppraisalTemplate`, `AppraisalFactor`, `Appraisal`, `AppraisalFactorRating`, `Skill`, `SkillCategory`, `EmployeeSkill`, `TrainingPlan`, `TrainingSession`, `TrainingAttendance`, `CheckpointTemplate`, `Checkpoint`, `CheckpointItem`, `CheckpointItemCompletion`, `Benefit`, `EmployeeBenefit`, `HMRCSubmission`, `ShiftSchedule`, `ShiftAssignment`, plus reference data models
**State Machines:** SM:Employee, SM:EmploymentContract, SM:PayrollRun, SM:LeaveRequest, SM:HMRCSubmission
**Events:** `employee.hired`, `employee.terminated`, `contract.activated`, `payroll.run.completed`, `leave.approved`, `leave.rejected`, `rti.submitted`
**API:** §2.16 — ~62 endpoints under `/hr/*`
**Business Rules:** BR-EMP-001-004, BR-CTR-001-010, BR-APR-001-004, BR-SKL-001-003, BR-CHK-001-004, BR-TRN-001-005, BR-LEV-001-009, BR-PAY-001-018, BR-JP-001-002
**FRs:** FR59–FR67, FR101–FR108
**UX Templates:** T1 (Entity List), T2 (Record Detail), T3 (Header+Lines), T6 (Wizard), T7 (Settings)

**Dependencies:** E14 (Finance/GL for payroll journal posting), E9 (Notifications for leave/appraisal workflows), E11 (Tasks), E10 (Email for payslips)

---

## Story E23.S1: Employee Records & Department Structure

**User Story:** As an HR administrator, I want to create and manage employee records with all fields required by UK employment law and organise employees within a department hierarchy so that we maintain compliant and structured employee data.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new employee record
  Given I am an HR ADMIN or MANAGER
  When I create an employee with name, NI number, tax code, employment type, start date, department, job title, and pay details
  Then an Employee record is created with status ACTIVE scoped to companyId
  And an "employee.hired" event is emitted
  And the employee appears in the employee list

Scenario: UK employment law mandatory fields
  Given I am creating a new employee
  When I omit the NI number or tax code
  Then validation errors are shown for UK-required fields (BR-EMP-001)
  And the record is not created

Scenario: Department hierarchy
  Given departments "Operations" → "Warehouse" → "Warehouse Team A" exist
  When I view the department structure
  Then departments display in a hierarchical tree
  And each department shows the employee count

Scenario: Job position management
  Given I create a job position "Senior Developer" in department "IT"
  When I assign an employee to this position
  Then the employee's jobPositionId is updated
  And the position's headcount is tracked

Scenario: Employee search and filtering
  Given the company has 150 employees
  When I search for employees by name, department, or status
  Then matching employees are returned with cursor-based pagination
  And I can filter by status (ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED)
```

**Key Tasks:**
1. **Create Employee model and migration** — companyId, employeeNumber (NumberSeries), firstName, lastName, email, niNumber (encrypted), taxCode, employmentType enum, startDate, endDate, departmentId, jobPositionId, managerId (self-ref), status enum, all timestamps
   - Department model: companyId, name, parentDepartmentId, managerId, costCentreCode
   - JobPosition model: companyId, title, departmentId, grade, headcount, isActive
2. **Implement employee CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/employees`
   - Search with cursor-based pagination; filter by department, status, employment type
   - Encrypt NI number at rest (NFR8)
3. **Implement department endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/departments`
   - Hierarchy endpoints with tree structure
4. **Implement job position endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/positions`
5. **Build employee list UI** — T1 template with photo thumbnail, department, status badge
6. **Build employee detail UI** — T2 template with tabs: personal, employment, contracts, leave, payroll
7. **Build department tree UI** — hierarchical view with drag-and-drop reordering
8. **Write unit tests** — UK field validation (BR-EMP-001), NI number encryption, department hierarchy queries
9. **Write integration tests** — employee CRUD, department tree, position assignment

**FR/NFR References:** FR59, FR106, NFR2, NFR8, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR59, FR106) | Employee records, UK law fields, departments |
| Architecture | §2.22 HR/Payroll | Employee model, Department hierarchy, NI encryption |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Employee list and detail layouts |
| API Contracts | §2.16 HR/Payroll | Employee, department, position CRUD endpoints |
| Data Models | §12 HR/Payroll | Employee, Department, JobPosition schemas |
| State Machine Reference | §9 HR/Payroll | SM:Employee — ACTIVE / ON_LEAVE / SUSPENDED / TERMINATED |
| Event Catalog | §8 HR/Payroll | employee.hired event |
| Business Rules Compendium | §7 HR/Payroll | BR-EMP-001 to BR-EMP-004 (employee rules) |

---

## Story E23.S2: Employment Contracts & Change History

**User Story:** As an HR administrator, I want to manage employment contracts through a full lifecycle with immutable change history so that contract changes (salary, title, department) are tracked with effective dates and audit trail.

**Acceptance Criteria:**

```gherkin
Scenario: Create employment contract
  Given an employee exists with status ACTIVE
  When I create a contract with job title, salary, contract type, start date, probation period, and notice period
  Then an EmploymentContract record is created with status DRAFT
  And the contract is linked to the employee

Scenario: Approve and activate contract
  Given a contract is in DRAFT status
  When a MANAGER approves the contract
  Then the contract status changes to ACTIVE
  And a "contract.activated" event is emitted
  And the employee's current contract reference is updated

Scenario: Record contract change with effective date
  Given an active contract exists
  When I record a salary change from GBP 45,000 to GBP 50,000 effective 1 April 2026
  Then a ContractChange record is created with old value, new value, effective date, and changed by
  And the change is immutable once saved (BR-CTR-005)

Scenario: View contract change history
  Given an employee has had 5 contract changes over 2 years
  When I view the contract history
  Then all changes are displayed chronologically with effective dates
  And each shows: field changed, old value, new value, changed by, change date

Scenario: Terminate contract
  Given an active contract exists
  When I terminate the contract with end date and reason
  Then the contract status changes to TERMINATED
  And the employee status updates accordingly
  And an "employee.terminated" event is emitted
```

**Key Tasks:**
1. **Create EmploymentContract model** — employeeId, companyId, contractType enum, jobTitle, annualSalary, hourlyRate, hoursPerWeek, startDate, endDate, probationEndDate, noticePeriodWeeks, status enum
   - ContractChange: contractId, fieldName, oldValue, newValue, effectiveDate, changedById, changeReason
2. **Implement contract CRUD endpoints** — `GET/POST/PUT /api/v1/hr/employees/:id/contracts`
   - Approval endpoint: `POST /api/v1/hr/contracts/:id/approve`
   - Terminate endpoint: `POST /api/v1/hr/contracts/:id/terminate`
3. **Implement change tracking** — detect field differences on update; create ContractChange records automatically
   - Changes are immutable after save (BR-CTR-005)
4. **Build contract detail UI** — T2 template with contract terms, change history tab
5. **Build contract wizard** — T6 for creating new contracts with all required fields
6. **Write unit tests** — lifecycle transitions, change detection, immutability enforcement
7. **Write integration tests** — full contract lifecycle from draft to termination

**FR/NFR References:** FR101, FR102, NFR14, NFR39

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR101, FR102) | Contract lifecycle, change tracking |
| Architecture | §2.22 HR/Payroll | EmploymentContract model, ContractChange design |
| UX Design Specification | T2 (Record Detail), T6 (Wizard) | Contract detail and creation wizard |
| API Contracts | §2.16 HR/Payroll | Contract CRUD, approve, terminate endpoints |
| Data Models | §12 HR/Payroll | EmploymentContract, ContractChange schemas |
| State Machine Reference | §9 HR/Payroll | SM:EmploymentContract — DRAFT → ACTIVE → TERMINATED |
| Event Catalog | §8 HR/Payroll | contract.activated, employee.terminated events |
| Business Rules Compendium | §7 HR/Payroll | BR-CTR-001 to BR-CTR-010 (contract rules) |

---

## Story E23.S3: Leave Management

**User Story:** As an employee, I want to request leave and as a manager, I want to approve or reject leave requests with entitlement tracking so that leave is managed within company policy and legal requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Submit a leave request
  Given I am an employee with annual leave entitlement of 25 days
  And I have used 10 days
  When I request 3 days annual leave from 10-12 March 2026
  Then a LeaveRequest record is created with status PENDING
  And my manager receives a notification

Scenario: Approve leave request
  Given a leave request is PENDING for my team member
  When I approve the request
  Then the status changes to APPROVED
  And a "leave.approved" event is emitted
  And the employee's used entitlement is incremented by 3 days
  And the employee receives an approval notification

Scenario: Reject leave request with reason
  Given a leave request is PENDING
  When I reject it with reason "Team capacity insufficient"
  Then the status changes to REJECTED
  And a "leave.rejected" event is emitted
  And the entitlement is not decremented

Scenario: Prevent exceeding entitlement
  Given I have 2 days remaining annual leave
  When I request 5 days annual leave
  Then the system warns "Request exceeds remaining entitlement by 3 days"
  And allows submission with manager override flag (BR-LEV-004)

Scenario: Leave type configuration
  Given I am an ADMIN
  When I configure leave types (Annual, Sick, Maternity, Paternity, Unpaid, TOIL)
  Then each type has: name, default entitlement days, paid/unpaid flag, carry-over limit, requires medical cert flag

Scenario: Leave entitlement based on start date
  Given an employee starts on 1 July 2026 (mid-year)
  And annual entitlement is 25 days
  When the system calculates their entitlement
  Then the pro-rated entitlement is 12.5 days (25 * 6/12) (BR-LEV-001)
```

**Key Tasks:**
1. **Create leave models** — LeaveType: companyId, name, defaultEntitlementDays, isPaid, carryOverLimit, requiresMedicalCert
   - LeaveEntitlement: employeeId, leaveTypeId, year, entitlementDays, usedDays, carryOverDays
   - LeaveRequest: employeeId, companyId, leaveTypeId, startDate, endDate, workingDays, status enum, reason, approvedById, rejectedById, rejectionReason
2. **Implement leave request endpoints** — `POST /api/v1/hr/leave/requests`, approve/reject
   - Validate against entitlement balance
   - Calculate working days (exclude weekends, public holidays)
   - Notify manager on submission; notify employee on approval/rejection
3. **Implement entitlement calculation** — annual reset, pro-rata for mid-year starters, carry-over processing
4. **Build leave request form** — calendar date picker, type selector, remaining balance display
5. **Build manager approval queue** — T1 list of pending requests with bulk approve/reject
6. **Build leave calendar view** — team leave calendar showing who is off when
7. **Write unit tests** — working days calculation, pro-rata entitlement, balance validation, carry-over
8. **Write integration tests** — full request-approve cycle, entitlement decrement

**FR/NFR References:** FR61, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR61) | Leave request, approval, entitlement tracking |
| Architecture | §2.22 HR/Payroll | Leave models, entitlement calculation, calendar |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Leave request list, calendar view |
| API Contracts | §2.16 HR/Payroll | Leave request, approve, reject endpoints |
| Data Models | §12 HR/Payroll | LeaveType, LeaveEntitlement, LeaveRequest schemas |
| State Machine Reference | §9 HR/Payroll | SM:LeaveRequest — PENDING → APPROVED / REJECTED / CANCELLED |
| Event Catalog | §8 HR/Payroll | leave.approved, leave.rejected events |
| Business Rules Compendium | §7 HR/Payroll | BR-LEV-001 to BR-LEV-009 (leave rules) |

---

## Story E23.S4: Payroll Processing Engine

**User Story:** As a payroll administrator, I want to prepare and run monthly payroll with PAYE, NI, student loan, and pension calculations so that employees are paid correctly and statutory deductions are applied per HMRC rules.

**Acceptance Criteria:**

```gherkin
Scenario: Prepare payroll run
  Given it is the end of March 2026
  When I initiate a payroll run for March 2026
  Then a PayrollRun record is created with status DRAFT
  And PayrollRunLine records are generated for each active employee
  And each line pre-calculates gross pay from contract salary

Scenario: Calculate PAYE income tax
  Given an employee has annual salary GBP 45,000 and tax code 1257L
  When payroll calculations run
  Then the monthly PAYE deduction is calculated per HMRC tax tables
  And the calculation uses cumulative basis (BR-PAY-003)

Scenario: Calculate National Insurance contributions
  Given an employee earns GBP 3,750/month (above NI primary threshold)
  When NI is calculated
  Then employee NI and employer NI are calculated per HMRC rates
  And both amounts appear on the PayrollRunLine

Scenario: Calculate auto-enrolment pension
  Given an employee is pension-eligible (BR-PAY-010)
  And the pension scheme is 5% employee + 3% employer
  When pension is calculated
  Then employee pension deduction is GBP 187.50
  And employer pension contribution is GBP 112.50

Scenario: Calculate student loan deduction
  Given an employee has student loan Plan 2
  When earnings exceed the Plan 2 threshold
  Then 9% of earnings above threshold is deducted (BR-PAY-008)

Scenario: Approve and finalise payroll run
  Given a payroll run is in DRAFT status with all lines calculated
  When I approve the payroll run
  Then the status changes to APPROVED
  And pay amounts are locked
  And a "payroll.run.completed" event is emitted
```

**Key Tasks:**
1. **Create payroll models** — PayrollRun: companyId, periodMonth, periodYear, status enum, runDate, totalGross, totalNet, totalDeductions, totalEmployerCosts
   - PayrollRunLine: payrollRunId, employeeId, grossPay, basicPay, overtime, allowances, paye, employeeNi, employerNi, studentLoan, employeePension, employerPension, otherDeductions, netPay
   - PayComponent: companyId, name, type enum (EARNING, DEDUCTION, EMPLOYER_COST), calculationType, rate, isStatutory
   - PayrollCalendar: companyId, year, payFrequency, payDates
2. **Implement PAYE calculation engine** — cumulative and week1/month1 basis
   - Tax code parsing (standard, K codes, NT, BR, D0, D1)
   - Use HMRC tax bands and thresholds (configurable per tax year)
3. **Implement NI calculation** — employee and employer NI per HMRC tables
   - Category letters (A, B, C, H, M, Z)
   - Upper and lower earnings limits
4. **Implement pension auto-enrolment** — eligibility check (age, earnings threshold)
   - Calculate employee and employer contributions
   - Track opt-in/opt-out status per employee
5. **Implement student loan deduction** — Plans 1, 2, 4, 5, and PG
   - Apply threshold and percentage per plan type
6. **Implement payroll run workflow** — DRAFT → calculated → APPROVED → POSTED
7. **Build payroll run UI** — T3 (Header+Lines) with run header and employee lines
8. **Write unit tests** — each calculation component with HMRC test scenarios
9. **Write integration tests** — full payroll run cycle

**FR/NFR References:** FR62, FR65, NFR5, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR62, FR65) | Payroll processing, PAYE/NI/pension |
| Architecture | §2.22 HR/Payroll | Payroll calculation engine, HMRC compliance |
| UX Design Specification | T3 (Header+Lines) | Payroll run header + employee lines |
| API Contracts | §2.16 HR/Payroll | Payroll run CRUD, calculate, approve endpoints |
| Data Models | §12 HR/Payroll | PayrollRun, PayrollRunLine, PayComponent schemas |
| State Machine Reference | §9 HR/Payroll | SM:PayrollRun — DRAFT → CALCULATED → APPROVED → POSTED |
| Event Catalog | §8 HR/Payroll | payroll.run.completed event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY-001 to BR-PAY-018 (payroll rules) |

---

## Story E23.S5: Payroll GL Posting & BACS

**User Story:** As a payroll administrator, I want approved payroll to automatically post journal entries to the GL and generate BACS payment files so that payroll accounting and payments are processed efficiently.

**Acceptance Criteria:**

```gherkin
Scenario: Post payroll to GL
  Given a payroll run is APPROVED
  When I trigger GL posting
  Then journal entries are created:
    Debit: Salary Expense (gross pay)
    Credit: PAYE Liability (tax deducted)
    Credit: NI Liability (employee + employer NI)
    Credit: Pension Liability (employee + employer pension)
    Credit: Student Loan Liability (student loan deductions)
    Credit: Net Pay (bank/payroll clearing)
  And the payroll run status changes to POSTED

Scenario: Generate BACS payment file
  Given a payroll run is POSTED
  When I generate the BACS file
  Then a Standard 18 BACS file is created with all employee payment details
  And the file includes: sort code, account number, amount, employee reference
  And the file is downloadable

Scenario: Prevent duplicate posting
  Given payroll for March 2026 has already been posted
  When I attempt to post it again
  Then the system rejects with "payroll.error.already_posted"

Scenario: GL posting respects period locks
  Given the March 2026 financial period is locked
  When I attempt to post payroll for March 2026
  Then the system rejects with "payroll.error.period_locked"
```

**Key Tasks:**
1. **Implement payroll GL posting service** — create multi-line journal entry from payroll run totals
   - Map each payroll component to configured GL accounts
   - Support departmental cost centre posting
2. **Implement BACS file generation** — Standard 18 format for UK bank payments
   - Include header, detail, and contra records
   - Validate sort codes and account numbers
3. **Build GL posting UI** — preview journal entries before posting; confirm button
4. **Build BACS download UI** — generate and download button with file details
5. **Write unit tests** — GL journal construction, BACS file format validation
6. **Write integration tests** — payroll → GL → BACS complete flow

**FR/NFR References:** FR62, FR64, FR12, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR62, FR64) | GL posting, BACS file generation |
| Architecture | §2.22 HR/Payroll | Payroll GL mapping, BACS Standard 18 format |
| UX Design Specification | T3 (Header+Lines) | GL preview on payroll run |
| API Contracts | §2.16 HR/Payroll | GL posting and BACS generation endpoints |
| Data Models | §12 HR/Payroll | PayrollRun GL fields, BACS config |
| State Machine Reference | §9 HR/Payroll | SM:PayrollRun — APPROVED → POSTED |
| Event Catalog | §8 HR/Payroll | payroll.run.posted event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY-015 to BR-PAY-018 (posting and BACS rules) |

---

## Story E23.S6: HMRC RTI Submissions

**User Story:** As a payroll administrator, I want to submit Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC via the RTI system so that we comply with real-time information reporting requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Generate FPS from payroll run
  Given a payroll run is POSTED
  When I generate the FPS
  Then an HMRCSubmission record is created with type FPS and status PENDING
  And the FPS XML payload is constructed per HMRC RTI schema
  And each employee's payment details are included

Scenario: Submit FPS to HMRC
  Given an FPS submission is PENDING
  When I submit to HMRC
  Then the submission is sent to the HMRC RTI API
  And the status changes to SUBMITTED
  And a "rti.submitted" event is emitted

Scenario: HMRC acknowledges submission
  Given an FPS was submitted
  When HMRC responds with acceptance
  Then the status changes to ACCEPTED
  And the HMRC correlation ID and response details are stored

Scenario: HMRC rejects submission
  Given an FPS was submitted
  When HMRC responds with errors
  Then the status changes to REJECTED
  And error details are displayed for correction

Scenario: Generate EPS for period
  Given it is the end of the tax month
  When I generate the EPS
  Then employer-level data (SMP recovered, NIC holiday, apprenticeship levy) is included
  And the EPS is ready for submission

Scenario: Generate P45 for leaving employee
  Given an employee is terminated
  When I generate their P45
  Then the P45 document is created per HMRC specification
  And the leaving FPS is generated for submission

Scenario: Generate P60 at year end
  Given it is the end of tax year 2025/26
  When I generate P60s for all employees
  Then each employee receives a P60 showing total pay and tax for the year
```

**Key Tasks:**
1. **Create HMRCSubmission model** — companyId, type enum (FPS, EPS, P45, P60), payrollRunId, status enum, payload (XML/JSON), responsePayload, correlationId, submittedAt, respondedAt
2. **Implement FPS XML generation** — per HMRC RTI technical specification
   - Employee details, pay details, NI details, student loan details
3. **Implement EPS XML generation** — employer-level data per HMRC spec
4. **Implement HMRC API integration** — authenticate with HMRC credentials, submit XML, handle async response
   - Retry logic per NFR31; timeout handling per NFR32
5. **Implement P45/P60 generation** — per HMRC document specifications
6. **Build RTI submission UI** — T2 detail with submission status, payload preview, error display
7. **Write unit tests** — XML generation, field validation, HMRC response parsing
8. **Write integration tests** — submission flow with mocked HMRC API

**FR/NFR References:** FR63, FR66, NFR31, NFR32, NFR34

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR63, FR66) | RTI submissions, P45/P60 generation |
| Architecture | §2.22 HR/Payroll | HMRC RTI integration, XML schema, API auth |
| UX Design Specification | T2 (Record Detail) | RTI submission detail view |
| API Contracts | §2.16 HR/Payroll | RTI submission endpoints |
| Data Models | §12 HR/Payroll | HMRCSubmission model |
| State Machine Reference | §9 HR/Payroll | SM:HMRCSubmission — PENDING → SUBMITTED → ACCEPTED / REJECTED |
| Event Catalog | §8 HR/Payroll | rti.submitted event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY related HMRC compliance rules |

---

## Story E23.S7: Statutory Payments (SSP, SMP, SPP, ShPP, SAP)

**User Story:** As a payroll administrator, I want to calculate and process statutory payments (Statutory Sick Pay, Maternity Pay, Paternity Pay, Shared Parental Pay, Adoption Pay) so that employees receive their legal entitlements.

**Acceptance Criteria:**

```gherkin
Scenario: Calculate SSP for qualifying absence
  Given an employee has been absent for 5 consecutive days (including 3 waiting days)
  And their average weekly earnings exceed the lower earnings limit
  When SSP is calculated
  Then 2 qualifying days at the current SSP rate are calculated
  And the SSP amount appears on their payroll run line

Scenario: Calculate SMP
  Given a female employee qualifies for SMP (26 weeks continuous service, earnings above LEL)
  When SMP is calculated for weeks 1-6
  Then SMP is 90% of average weekly earnings
  And for weeks 7-39, SMP is the lesser of 90% AWE or the statutory flat rate

Scenario: Statutory payment reduces employer NI liability
  Given SSP of GBP 200 was paid in the period
  When the EPS is generated
  Then the SSP amount is included for recovery/offset against NI liability

Scenario: Statutory payment replaces regular pay
  Given an employee receiving SMP
  When the payroll run processes their line
  Then SMP replaces their normal salary for the SMP period
  And any company-enhanced maternity pay is calculated on top if configured
```

**Key Tasks:**
1. **Implement SSP calculation** — qualifying days, waiting days, earnings threshold, daily rate
2. **Implement SMP calculation** — 90% AWE for 6 weeks + flat rate/90% for 33 weeks
3. **Implement SPP, ShPP, SAP calculations** — per HMRC current year rates
4. **Integrate statutory payments into payroll run** — replace or supplement regular pay
5. **Include in EPS for HMRC recovery** — track amounts for employer NI offset
6. **Build statutory payment configuration UI** — T7 (Settings) for rates and thresholds
7. **Write unit tests** — each statutory calculation with HMRC test scenarios
8. **Write integration tests** — statutory payment through payroll cycle

**FR/NFR References:** FR67, FR62, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR67) | Statutory payments (SSP, SMP, SPP, ShPP, SAP) |
| Architecture | §2.22 HR/Payroll | Statutory payment calculation engine |
| UX Design Specification | T7 (Settings) | Statutory payment configuration |
| API Contracts | §2.16 HR/Payroll | Statutory payment endpoints |
| Data Models | §12 HR/Payroll | Statutory payment models within PayrollRunLine |
| State Machine Reference | §9 HR/Payroll | Part of PayrollRun lifecycle |
| Event Catalog | §8 HR/Payroll | Statutory payment events (part of payroll events) |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY related statutory payment rules |

---

## Story E23.S8: Performance Appraisals

**User Story:** As a manager, I want to conduct performance appraisals using configurable factor and rating matrices with multi-level approval workflows so that employee performance is assessed consistently and fairly.

**Acceptance Criteria:**

```gherkin
Scenario: Configure appraisal template
  Given I am an HR ADMIN
  When I create an appraisal template with factors (Communication, Teamwork, Technical Skills) and rating scale (1-5)
  Then an AppraisalTemplate is created with AppraisalFactor records
  And the template is available for creating appraisals

Scenario: Initiate employee appraisal
  Given an appraisal template exists
  When I create an appraisal for employee "Jane Smith" using the template
  Then an Appraisal record is created with status DRAFT
  And factor rating fields are pre-populated from the template

Scenario: Rate employee on factors
  Given an appraisal is in DRAFT status
  When I rate the employee: Communication=4, Teamwork=5, Technical Skills=3
  Then AppraisalFactorRating records are created for each factor
  And the overall score is calculated as weighted average (BR-APR-002)

Scenario: Multi-level approval
  Given an appraisal is completed by the line manager
  When submitted for approval
  Then it goes to the next level approver (e.g., department head)
  And the employee receives it for acknowledgement after final approval

Scenario: Employee self-assessment
  Given an appraisal cycle includes self-assessment
  When the employee completes their self-assessment ratings
  Then self-ratings are stored alongside manager ratings for comparison
```

**Key Tasks:**
1. **Create appraisal models** — AppraisalTemplate: companyId, name, isActive
   - AppraisalFactor: templateId, name, description, weight, sortOrder
   - Appraisal: employeeId, companyId, templateId, reviewerId, periodStart, periodEnd, status, overallScore, comments
   - AppraisalFactorRating: appraisalId, factorId, managerRating, selfRating, comments
2. **Implement appraisal CRUD endpoints** — `GET/POST/PUT /api/v1/hr/appraisals`
   - Template management: `GET/POST/PUT /api/v1/hr/appraisal-templates`
   - Submit for approval, acknowledge
3. **Implement scoring calculation** — weighted average of factor ratings (BR-APR-002)
4. **Implement multi-level approval** — integrate with ApprovalRequest (cross-cutting)
5. **Build appraisal form UI** — T2 with factor rating grid, comments, score summary
6. **Build template management** — T7 (Settings) for ADMIN
7. **Write unit tests** — score calculation, approval workflow, validation
8. **Write integration tests** — full appraisal cycle

**FR/NFR References:** FR103, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR103) | Performance appraisals, factor matrices |
| Architecture | §2.22 HR/Payroll | Appraisal models, scoring algorithm |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Appraisal form, template config |
| API Contracts | §2.16 HR/Payroll | Appraisal and template endpoints |
| Data Models | §12 HR/Payroll | AppraisalTemplate, Appraisal, AppraisalFactorRating |
| State Machine Reference | §9 HR/Payroll | Appraisal approval workflow |
| Event Catalog | §8 HR/Payroll | appraisal.completed event |
| Business Rules Compendium | §7 HR/Payroll | BR-APR-001 to BR-APR-004 (appraisal rules) |

---

## Story E23.S9: Skills, Training & Checkpoints

**User Story:** As an HR administrator, I want to manage employee skills and competencies, create training plans with scheduling, and track onboarding/offboarding checklists so that workforce development and HR processes are structured and tracked.

**Acceptance Criteria:**

```gherkin
Scenario: Record employee skill with rating
  Given skill categories and skills are configured (e.g., "Programming" → "TypeScript", "Python")
  When I rate an employee's TypeScript skill as 4/5
  Then an EmployeeSkill record is created with the rating and evaluation date
  And the skill appears on the employee's competency profile

Scenario: Create training plan
  Given a training need is identified
  When I create a training plan with title, description, trainer, and sessions
  Then a TrainingPlan is created with TrainingSession records for each scheduled session
  And double-booking detection warns if a session conflicts with another (BR-TRN-003)

Scenario: Track training attendance
  Given a training session is scheduled
  When I record attendance for enrolled employees
  Then TrainingAttendance records are created (attended/absent/excused)
  And the training plan auto-closes when all sessions are complete (BR-TRN-005)

Scenario: Onboarding checklist
  Given a checkpoint template "New Employee Onboarding" has 15 items
  When a new employee is hired
  Then a Checkpoint is created from the template with 15 CheckpointItems
  And each item can be assigned to different people (IT setup, HR, manager)
  And progress is tracked as items are completed

Scenario: Offboarding checklist
  Given an employee is terminated
  When the offboarding process starts
  Then an "Employee Offboarding" checkpoint is created
  And includes items like: return equipment, disable accounts, exit interview
```

**Key Tasks:**
1. **Create skill models** — SkillCategory, Skill, EmployeeSkill (with rating, evaluationDate, evaluatorId)
2. **Create training models** — TrainingPlan, TrainingSession, TrainingAttendance
3. **Create checkpoint models** — CheckpointTemplate, CheckpointItem template, Checkpoint, CheckpointItem, CheckpointItemCompletion
4. **Implement skill management endpoints** — CRUD for categories, skills, employee skill ratings
5. **Implement training plan endpoints** — CRUD with session management, attendance recording
   - Double-booking detection (BR-TRN-003)
   - Auto-close on completion (BR-TRN-005)
6. **Implement checkpoint endpoints** — template CRUD, checkpoint creation from template, item completion
7. **Build skill profile UI** — radar chart or matrix view on employee detail
8. **Build training management UI** — T1 list, T2 detail with sessions and attendance
9. **Build checkpoint UI** — checklist with progress bar, assignee indicators
10. **Write unit tests** — double-booking detection, auto-close, completion tracking
11. **Write integration tests** — full training lifecycle, checkpoint lifecycle

**FR/NFR References:** FR104, FR105, FR60, FR108, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR104, FR105, FR60, FR108) | Skills, training, onboarding checkpoints |
| Architecture | §2.22 HR/Payroll | Skill, Training, Checkpoint models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Training list, skill profile |
| API Contracts | §2.16 HR/Payroll | Skill, training, checkpoint endpoints |
| Data Models | §12 HR/Payroll | All skill, training, and checkpoint schemas |
| State Machine Reference | §9 HR/Payroll | Training plan lifecycle |
| Event Catalog | §8 HR/Payroll | training.completed, checkpoint.completed events |
| Business Rules Compendium | §7 HR/Payroll | BR-SKL-001-003, BR-TRN-001-005, BR-CHK-001-004 |

---

## Story E23.S10: Employee Benefits

**User Story:** As an HR administrator, I want to manage employee benefits on contracts with configurable benefit types, amounts, and payment frequencies so that total compensation packages are accurately recorded and calculated.

**Acceptance Criteria:**

```gherkin
Scenario: Configure benefit types
  Given I am an HR ADMIN
  When I create a benefit type "Company Car" with default monthly value and GL account
  Then the Benefit record is available for assignment to employees

Scenario: Assign benefit to employee
  Given benefit type "Private Health Insurance" exists
  When I add this benefit to an employee's contract with value GBP 150/month
  Then an EmployeeBenefit record is created linked to the contract
  And the benefit appears in the employee's total compensation view

Scenario: Benefit included in payroll
  Given an employee has benefits totalling GBP 500/month
  When the payroll run processes their line
  Then taxable benefits are included in PAYE calculation
  And non-taxable benefits are reported separately

Scenario: P11D reporting
  Given employees have benefits in kind
  When the P11D report is generated at year end
  Then each employee's benefits are listed with correct values
```

**Key Tasks:**
1. **Create benefit models** — Benefit: companyId, name, type, defaultValue, frequency, isTaxable, glAccountId
   - EmployeeBenefit: employeeId, contractId, benefitId, value, frequency, startDate, endDate
2. **Implement benefit endpoints** — CRUD for types and employee assignments
3. **Integrate with payroll** — include taxable benefits in PAYE calculation
4. **Implement P11D report generation**
5. **Build benefits management UI** — T7 (Settings) for types, T2 tab on employee detail
6. **Write unit tests** — benefit valuation, PAYE inclusion
7. **Write integration tests** — benefit through payroll cycle

**FR/NFR References:** FR107, FR62, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR107) | Employee benefits, amounts, frequencies |
| Architecture | §2.22 HR/Payroll | Benefit models, payroll integration |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Benefits on employee detail, type config |
| API Contracts | §2.16 HR/Payroll | Benefit type and assignment endpoints |
| Data Models | §12 HR/Payroll | Benefit, EmployeeBenefit schemas |
| State Machine Reference | §9 HR/Payroll | Part of contract lifecycle |
| Event Catalog | §8 HR/Payroll | benefit.assigned event |
| Business Rules Compendium | §7 HR/Payroll | Benefit calculation and tax treatment rules |

---

## Story E23.S11: HR Reports & Analytics

**User Story:** As an HR manager, I want to generate HR reports (employee list, headcount, leave summary, payroll summary, turnover analysis) so that I can make informed workforce decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Employee list report
  Given the company has 100 employees
  When I generate the employee list report
  Then I see all employees with name, department, position, start date, status
  And I can export to PDF or CSV

Scenario: Payslip generation
  Given a payroll run is POSTED
  When I generate payslips
  Then each employee receives a payslip showing gross pay, deductions, net pay
  And payslips can be emailed to employees or downloaded as PDF

Scenario: Leave summary report
  Given leave requests exist for Q1 2026
  When I generate the leave summary
  Then I see per-employee: entitlement, used, remaining, by leave type
  And department-level aggregations

Scenario: Headcount and turnover analysis
  Given employee records span 2 years
  When I generate the turnover report
  Then I see monthly headcount, joiners, leavers, and turnover rate
  And trends are displayed as line charts
```

**Key Tasks:**
1. **Implement employee list report** — filterable, sortable, exportable
2. **Implement payslip generation** — PDF per employee from payroll run data
   - Email distribution via Email Integration (E10)
3. **Implement leave summary report** — per employee and department aggregation
4. **Implement headcount/turnover report** — monthly tracking with trend analysis
5. **Build reports dashboard** — T8 (Report) template with filter controls and chart/table display
6. **Write unit tests** — report calculation logic, aggregations
7. **Write integration tests** — report generation with seeded data

**FR/NFR References:** FR66, FR76, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR66, FR76) | Payslips, P45/P60, HR reports |
| Architecture | §2.22 HR/Payroll | Report definitions, PDF generation |
| UX Design Specification | T8 (Report) | Report template with filters and export |
| API Contracts | §2.16 HR/Payroll | Report generation endpoints |
| Data Models | §12 HR/Payroll | All HR models for report queries |
| State Machine Reference | §9 HR/Payroll | N/A for reports |
| Event Catalog | §8 HR/Payroll | N/A for reports |
| Business Rules Compendium | §7 HR/Payroll | Report calculation rules |

---

## Story E23.S12: Mobile Adaptation — HR/Payroll

**User Story:** As a mobile user, I want to submit leave requests, view my payslips, and check my team's availability from my phone so that I can manage essential HR tasks on the go.

**Acceptance Criteria:**

```gherkin
Scenario: Submit leave request from mobile
  Given I am on the mobile app
  When I submit a leave request with dates and type
  Then the request is created and my manager is notified

Scenario: View payslip on mobile
  Given my latest payslip is available
  When I view it on mobile
  Then I see a mobile-optimised payslip summary
  And I can download the full PDF

Scenario: Manager views team leave calendar
  Given I am a manager on mobile
  When I view my team's availability
  Then I see a simplified calendar showing who is off
  And I can approve/reject pending leave requests

Scenario: Push notification for leave approval
  Given I submitted a leave request
  When my manager approves it
  Then I receive a push notification confirming the approval
```

**Key Tasks:**
1. **Create mobile leave request form** — simplified date picker and type selector
2. **Create mobile payslip viewer** — summary view with PDF download option
3. **Create mobile team calendar** — simplified availability view
4. **Create mobile approval queue** — leave requests pending my approval
5. **Implement push notifications** — leave approved/rejected, payslip available
6. **Write unit tests** — mobile data transformations
7. **Write integration tests** — mobile leave flow, payslip access

**FR/NFR References:** FR61, FR66, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR61, FR66) | Leave requests, payslips |
| Architecture | §2.22 HR/Payroll | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.16 HR/Payroll | Same endpoints for mobile |
| Data Models | §12 HR/Payroll | Same models |
| State Machine Reference | §9 HR/Payroll | Same state machines |
| Event Catalog | §8 HR/Payroll | Push notification triggers |
| Business Rules Compendium | §7 HR/Payroll | Same rules apply |

---

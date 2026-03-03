# HansaWorld HRM Module — Deep-Dive Findings

> **Source**: HAL codebase (`legacy-src/c8520240417/`) and HansaManuals documentation
> **Date**: 2026-02-15
> **Purpose**: Extract all registers, fields, settings, reports, maintenances, documents, business logic, and workflows for Nexa ERP HR/Payroll module requirements

---

## 1. Registers (Entities)

### 1.1 Employment Contract (HRMCOVc)

The core HRM entity. Records the formal agreement between company and employee.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number (primary key) |
| TransDate | Date | Transaction/creation date |
| StartDate | Date | Contract start date (mandatory) |
| EndDate | Date | Contract end date (for fixed-term contracts; required when terminated) |
| TrialEndDate | Date | Probation/trial period end date |
| Employee | String | Employee code (FK to CUVc/Contact register; must be of EmployeeType != 0; must not be blocked) |
| Name | String | Employee name (auto-populated from CUVc) |
| JobTitle | String | Job title code (FK to JobTitleVc) |
| JobTitleDesc | String | Job title description (auto-populated from JobTitleVc.Title) |
| SalaryType | Enum (kHRMCOSalaryType) | Salary frequency: Monthly(0), Yearly(1), Weekly(2), Fortnightly(3), Hourly(4) |
| GrossSalary | Val (decimal) | Gross salary amount |
| CurncyCode | String | Currency code for salary |
| TaxLoad | Val | Tax loading percentage (mandatory when GrossSalary set and no EndDate) |
| DepCode | String | Department code |
| Class | String | Contract class (FK to HRMCOClassVc) |
| Type | String | Contract type (FK to HRMCOTypeVc) — implied from register existence |
| LeaveScheme | String | Leave scheme reference |
| WorkHoursPerDay | Val | Working hours per day (mandatory when LeaveRulesBlock.LeaveTimeCalculationBase == 1) |
| Superior | String | Manager/supervisor code |
| Comment | String | Free-text comment |
| LangCode | String | Language code (auto-populated from CUVc.LangCode) |
| Reason | Enum (kHRMCOReason) | Termination reason (mandatory when terminating) |
| ReasonDetails | String | Termination reason details (mandatory when terminating) |
| OKFlag | Integer | Approval status: 0 = Draft, 1 = Approved/OK |
| TerminatedFlag | Integer | Termination status: 0 = Active, != 0 = Terminated |
| HRMCOSerNr | LongInt | Reference to parent/previous contract (for renewals) |

**Row/Matrix Fields (Benefits):**

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Benefit type code (FK to HRMBenefitTypeVc) |
| Description | String | Benefit description (auto-populated from HRMBenefitTypeVc) |
| Type | String/Enum | Benefit type classification (from HRMBenefitTypeVc) |
| Terms | String | Benefit terms (from HRMBenefitTypeVc) |
| Amount | Val | Benefit amount (from HRMBenefitTypeVc) |
| CurncyCode | String | Benefit currency (from HRMBenefitTypeVc) |
| Frequency | String/Enum | Benefit frequency (from HRMBenefitTypeVc) |
| StartDate | Date | Benefit effective start |
| EndDate | Date | Benefit effective end |

**Indexes:**
- SerNr (primary)
- Employee
- ActClass (excludes terminated contracts)
- Name
- DepCode

**Business Rules:**
- Only one active (OK, non-terminated) contract per employee at a time
- StartDate is mandatory
- When terminating: Reason, EndDate, and ReasonDetails are all mandatory
- Approved contracts cannot be deleted (RemoveTest checks OKFlag)
- Requires "HRMCOOK" access right to approve
- When duplicating: resets SerNr, TerminatedFlag, OKFlag, TransDate
- Termination triggers: SetTrainingPlanClosedStatus, SetHRMSETerminatedStatus

---

### 1.2 Employment Contract Change (HRMCOChangeVc)

Tracks modifications to approved employment contracts, preserving full change history.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Date of change |
| HRMCOSerNr | LongInt | FK to parent Employment Contract |
| Employee | String | Employee code (read-only, inherited from contract) |
| Name | String | Employee name (read-only) |
| JobTitle | String | New job title |
| JobTitleDesc | String | New job title description |
| SalaryType | Enum (kHRMCOSalaryType) | New salary type |
| GrossSalary | Val | New gross salary |
| CurncyCode | String | New salary currency |
| DepCode | String | New department |
| LeaveScheme | String | New leave scheme |
| Class | String | New contract class |
| TrialEndDate | Date | New trial end date |
| Comment | String | Change description/reason |
| Reason | Enum (kHRMCOChangeReason) | Change reason: New(1), Promotion(2), Transfer(3), Demotion(4) |
| OKFlag | Integer | Approval status |
| TerminatedFlag | Integer | Terminated flag |

**Indexes:**
- SerNr
- Employee
- HRMCONrDate (compound: HRMCOSerNr + TransDate, for finding latest change per contract)
- ActClass (excludes terminated)

**Business Rules:**
- Can only be created from an approved (OKFlag == 1) Employment Contract
- HRMCOSerNr, Employee, and Name fields are read-only after creation
- Approved changes cannot be deleted
- Requires "HRMCOChangeOK" access right to approve
- The system overlays change data onto the contract when printing/reporting (FindHRMCOChange logic)
- Changes track: TrialEndDate, Class, JobTitle, Comment, SalaryType, GrossSalary, CurncyCode, DepCode, LeaveScheme

---

### 1.3 Contract Class (HRMCOClassVc)

Lookup/classification register for contract categories.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Class code (mandatory, primary key) |
| Name | String | Class description (implied) |

---

### 1.4 Contract Type (HRMCOTypeVc)

Lookup register for contract types (e.g., permanent, fixed-term, casual).

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Type code (mandatory, primary key) |
| Name | String | Type description (implied) |

---

### 1.5 Performance Appraisal (HRMPAVc)

Records formal performance evaluations.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Appraisal date (mandatory when approving) |
| Employee | String | Employee being appraised (FK to CUVc; must be employee type, not blocked) |
| EmployeeName | String | Employee name (auto-populated) |
| Interviewer | String | Appraiser/interviewer code (FK to CUVc; must be employee type, not blocked) |
| InterviewerName | String | Interviewer name (auto-populated) |
| PAClass | String | Performance appraisal class/category (FK to HRMPACVc) |
| Comment | String | Appraisal comments |
| OKFlag | Integer | Approval status |

**Row/Matrix Fields (Appraisal Lines):**

| Field | Type | Description |
|-------|------|-------------|
| PerfFactor | String | Performance factor code (FK to HRMPFVc, mandatory) |
| PerfFactorName | String | Performance factor description (auto-populated) |
| PerfRating | String | Rating code (FK to HRMPRVc, mandatory) |
| PerfRatingName | String | Rating description (auto-populated) |

**Indexes:**
- SerNr
- Employee

**Business Rules:**
- At least one row (PerfFactor + PerfRating) required when approving
- Both Employee and Interviewer must be valid, unblocked employees
- Requires "HRMPAOK" access right to approve
- Can create Activity (CRM) from appraisal via MakeActFromHRMPA
- Uses ASTBlock.PerformanceAppraisal activity type

---

### 1.6 Performance Appraisal Category (HRMPACVc)

Lookup register for categorizing appraisals.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Category code (mandatory, primary key) |
| Name | String | Category description (implied) |

---

### 1.7 Performance Factor (HRMPFVc)

Lookup register defining what is evaluated in appraisals.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Factor code (mandatory, primary key) |
| Name | String | Factor description (e.g., "Communication", "Technical Skills") |

---

### 1.8 Performance Rating (HRMPRVc)

Lookup register for rating scales used in appraisals.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Rating code (mandatory, primary key) |
| Name | String | Rating description (e.g., "Exceeds Expectations", "Meets Expectations") |

---

### 1.9 Skills Evaluation (HRMSEVc)

Records employee skill assessments — the central skills/competency management register.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Evaluation date |
| Employee | String | Employee code (FK to CUVc; must not be blocked) |
| Name | String | Employee name (auto-populated) |
| JobTitle | String | Employee's current job title (auto-populated from latest contract/change) |
| JobTitleDesc | String | Job title description |
| Superior | String | Supervisor/manager code (FK to UserVc; mandatory) |
| SuperiorName | String | Supervisor name (auto-populated) |
| OKFlag | Integer | Approval status |
| TerminatedFlag | Integer | Terminated status (inherited from employee's contract termination) |

**Row/Matrix Fields (Skill Lines):**

| Field | Type | Description |
|-------|------|-------------|
| Skill | String | Skill code (FK to HRMSkillVc; mandatory) |
| SkillComment | String | Skill description (auto-populated from HRMSkillVc.Name) |
| Rating | String | Rating code (FK to HRMRatingVc; mandatory) |
| RatingComment | String | Rating description (auto-populated from HRMRatingVc.Name) |

**Indexes:**
- SerNr
- TransDate
- Employee
- DateEmployee (compound)
- Skill:<Code> (per-skill index for searching by skill)

**Business Rules:**
- At least one skill row required when approving
- Each row must have both Skill and Rating
- Requires "HRMSEOK" access right to approve
- TerminatedFlag is automatically set when the employee's contract is terminated (SetHRMSETerminatedStatus)
- RemotePopulateSkill: when user has BrowseNew access, auto-populates from their latest skills evaluation
- Default list view filters to non-terminated (subset "0"); toggle with ToggleTerminated

---

### 1.10 Skill (HRMSkillVc)

Lookup register defining available skills/competencies.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Skill code (mandatory, primary key) |
| Name | String | Skill description |

---

### 1.11 Rating (HRMRatingVc)

Lookup register for skill proficiency ratings. Also used as status in Training Plans.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Rating code (mandatory, primary key) |
| Name | String | Rating description |

---

### 1.12 Benefit Type (HRMBenefitTypeVc)

Lookup register defining types of employee benefits.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Benefit type code (mandatory, primary key) |
| Description | String | Benefit description |
| Type | String/Enum | Benefit classification |
| Terms | String | Standard terms |
| Amount | Val | Default amount |
| CurncyCode | String | Default currency |
| Frequency | String/Enum | Payment frequency |

---

### 1.13 Residency Type (HRMResidencyTypeVc)

Lookup register for employee residency/visa classifications.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Residency type code (mandatory, primary key) |
| Name | String | Residency type description (implied) |

---

### 1.14 Checklist (HRMCheckListVc)

Structured task lists for onboarding, offboarding, and other employee lifecycle processes.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| StartDate | Date | Checklist start date (used for serial number generation) |
| Employee | String | Employee code (FK to CUVc; must not be blocked) |
| Name | String | Employee name (auto-populated) |
| JobTitle | String | Job title (auto-populated from latest contract/change) |
| JobTitleDesc | String | Job title description |
| Superior | String | Supervisor code (FK to UserVc; mandatory) |
| SuperiorName | String | Supervisor name (auto-populated) |
| Office | String | Office location |
| LastWorkDay | String/Date | Last working day |
| LastEmplDay | String/Date | Last employment day |
| ListType | Integer | List type: 0 = Onboarding, 1 = Offboarding (auto-set from contract TerminatedFlag) |
| OKFlag | Integer | Approval status |

**Row/Matrix Fields (Checklist Items):**

| Field | Type | Description |
|-------|------|-------------|
| CheckPoint | String | Checkpoint code (FK to CheckPointVc) |
| CheckPointComment | String | Checkpoint description (auto-populated from CheckPointVc.Name; mandatory) |
| Responsible | String | Person responsible (FK to CUVc) |
| ResponsibleName | String | Responsible person name (auto-populated) |
| Status | Enum (kHRMCheckListStatus) | Item status: N/A(0), WIP(1), Done(2), None/Pending(3) |
| DateCompleted | Date | Auto-set to current date when Status = Done |

**Indexes:**
- SerNr
- Employee

**Business Rules:**
- At least one row required when approving
- Each row must have CheckPointComment (description)
- CheckPoint codes validated against CheckPointVc register
- Requires "HRMSEOK" access right to approve (shared permission)
- When duplicating: clears Employee, Name, Superior, SuperiorName, Office, LastWorkDay, LastEmplDay, ListType; resets all row statuses to NONE
- Can generate email (Mail) from checklist via CreateMailFromHRMCheckList
- ListType auto-detected from employee's contract termination status

---

### 1.15 Job Position (HRMJPVc)

Defines organizational positions/roles and their current incumbents.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| StartDate | Date | Position effective start date |
| EndDate | Date | Position end date (must be >= StartDate) |
| DepCode | String | Department code (FK to DepVc; validated) |
| OKFlag | Integer | Approval status |

**Row/Matrix Fields (Position Incumbents):**

| Field | Type | Description |
|-------|------|-------------|
| Employee | String | Employee code (FK to CUVc; must be employee type, not blocked) |
| Name | String | Employee name (auto-populated) |

**Indexes:**
- SerNr
- StartDate

**Business Rules:**
- EndDate must be >= StartDate if specified
- Department validated against DepVc register
- All row employees must be valid, unblocked employees
- Requires "HRMJPOK" access right to approve

**Associated Enum:**
- kHRMJPStatusO: Opening(0), Free(1), Filled(2), Cancelled(3)

---

### 1.16 Payroll (HRMPayrollVc)

Records payroll transactions per employee.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Payroll date |
| UserCode | String | Person/user code (FK to UserVc; must not be Closed or Terminated) |
| UserName | String | Person name (auto-populated) |
| TotSum | Val | Total payroll amount (auto-calculated, read-only) |
| CurncyCode | String | Currency code |
| FrRate | Val | Foreign exchange rate |
| ToRateB1 | Val | To-rate base 1 |
| ToRateB2 | Val | To-rate base 2 |
| BaseRate1 | Val | Base rate 1 |
| BaseRate2 | Val | Base rate 2 |
| OKFlag | Integer | Approval status (once approved, cannot be un-approved) |

**Row/Matrix Fields (Payment Lines):**

| Field | Type | Description |
|-------|------|-------------|
| HRMPymtType | String | Payment type code (FK to HRMPymtTypeVc; validated) |
| HRMPymtTypeComment | String | Payment type description (auto-populated) |
| Sum | Val | Line amount |

**Business Rules:**
- UserCode must reference a valid, non-closed, non-terminated user
- Each row's HRMPymtType must exist in HRMPymtTypeVc
- TotSum is automatically recalculated as the sum of all row amounts
- TotSum field is read-only (cannot be edited directly)
- Once approved, payroll record cannot be modified or un-approved
- Supports dual-base currency conversion and import
- Multi-currency support with full exchange rate tracking

---

### 1.17 Payment Type (HRMPymtTypeVc)

Lookup register for payroll line item types (e.g., basic salary, overtime, bonus, deduction).

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Payment type code (primary key) |
| Comment | String | Payment type description |
| Closed | Integer | Closed flag (excluded from active indexes when closed) |
| HRMPymtTypeClass | String | Payment type classification |

**Indexes:**
- Code
- ActCode (excludes closed)
- ActHRMPymtTypeClass (excludes closed)
- ActComment (excludes closed)

---

### 1.18 Training Plan (TrainingPlanVc)

Records planned and completed training sessions. Referenced from HRM context.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| SerNr | LongInt | Auto-generated serial number |
| Employee | String | Primary trainee (mandatory) |
| Name | String | Employee name |
| Topic | String | Training topic (mandatory) |
| Description | String | Training description |
| Trainer | String | Trainer employee code |
| Shadower | String | Observer/shadow participant 1 |
| Shadower2 | String | Observer/shadow participant 2 |
| Shadower3 | String | Observer/shadow participant 3 |
| TrainingDate | Date | Scheduled training date |
| TrainingStart | Time | Scheduled start time |
| TrainingEnd | Time | Scheduled end time (mandatory if TrainingStart set) |
| Status | String | Training status (FK to HRMRatingVc; default from TrainingPlanBlock.DefStatus) |
| Comment | String | Training notes |

**Business Rules:**
- Employee and Topic are mandatory
- Trainer, Employee, and Shadowers cannot overlap (no person can be in multiple roles)
- Double-booking detection: checks for time conflicts across all training plans
- When an employment contract is terminated, training plans for that employee are auto-closed (SetTrainingPlanClosedStatus sets Status = TrainingPlanBlock.ClosedStatus)
- Training Plan settings block (TrainingPlanBlock): DefStatus, DoneStatus, ClosedStatus

---

### 1.19 Checkpoint (CheckPointVc)

Lookup register for checklist checkpoint templates.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Checkpoint code (primary key) |
| Name | String | Checkpoint description |

---

### 1.20 Job Title (JobTitleVc)

Lookup register for job titles.

| Field | Type | Description |
|-------|------|-------------|
| Code | String | Job title code (primary key) |
| Title | String | Job title description |

---

### 1.21 Employee Profile Settings (EmplPSVc)

Per-user settings controlling which sections appear in the Employee Statistics report.

| Field | Type | Description |
|-------|------|-------------|
| Signature | String | User code (primary key) |
| Activities | Boolean | Show activities section |
| NrOfAct | Integer | Max number of activities to show |
| Softfactors | Boolean | Show soft factors section |
| NrOfSoftFactors | Integer | Max number of soft factors |
| EmplContract | Boolean | Show employment contracts section |
| NrOfEmplContract | Integer | Max number of contracts |
| EmplContractCh | Boolean | Show contract changes section |
| NrOfEmplContractCh | Integer | Max number of contract changes |
| PerformanceAppr | Boolean | Show performance appraisals section |
| NrOfPerformanceAppr | Integer | Max number of appraisals |
| LeaveApp | Boolean | Show leave applications section |
| NrOfLeaveApp | Integer | Max number of leave applications |

---

## 2. Settings

### 2.1 Leave Rules Block (LeaveRulesBlock)

| Setting | Description |
|---------|-------------|
| LeaveTimeCalculationBase | Controls how leave is calculated: 0 = calendar days, 1 = work hours (when 1, WorkHoursPerDay is mandatory on contracts) |

### 2.2 Training Plan Block (TrainingPlanBlock)

| Setting | Description |
|---------|-------------|
| DefStatus | Default status for new training plans (FK to HRMRatingVc) |
| DoneStatus | Status code meaning "completed" |
| ClosedStatus | Status code applied when auto-closing due to contract termination |

### 2.3 Activity Settings Block (ASTBlock) — HRM-Related

| Setting | Description |
|---------|-------------|
| PerformanceAppraisal | Default activity type for performance appraisals |
| PerformanceAppraisalDone | OKFlag value when appraisal activity is done |
| WorkSheetDone | OKFlag for worksheet activities |

### 2.4 Access Rights / Permissions

| Permission Code | Description |
|----------------|-------------|
| HRMCOOK | Approve/OK Employment Contracts |
| HRMCOChangeOK | Approve/OK Employment Contract Changes |
| HRMSEOK | Approve/OK Skills Evaluations and Checklists |
| HRMPAOK | Approve/OK Performance Appraisals |
| HRMJPOK | Approve/OK Job Positions |
| AllowBenefitChangeOKHRMCO | Allow editing benefit rows on approved contracts |
| UnOKAll | Allow un-approving records |

---

## 3. Reports

### 3.1 Employment Contract List (HRMCOListRn)

Lists employment contracts with extensive filtering and sorting.

**Specification Fields:**
- Contract number range (f1)
- Employee range (f2)
- Department (FirstAcc)
- Contract class (LastAcc)
- Job title (f3)
- Start date period (Period2Str / sStartDate / sEndDate)
- End date period (Stext)
- Trial end date period (f11)
- Contract change date period (f12)
- Include terminated (flags[3])

**Sorting Options (flags[0]):**
- 0: By Employee
- 1: By Name
- 2: By Department
- 3: By Serial Number

**Detail Levels (ArtMode):**
- 0: Summary (SerNr, StartDate, Employee, Name, JobTitle, Department)
- 1: Detailed (adds TrialEndDate, EndDate, Reason, ReasonDetails, SalaryType, GrossSalary, Currency, Comment, and lists all contract changes with approval status)

**Key Feature:** Report overlays the latest approved contract change data onto the original contract fields, showing the current effective values.

---

### 3.2 Employment Contract Data (HRMCODataRn)

Detailed report for a specific contract or range of contracts.

**Output includes:**
- Contract serial number, start date, employee, name, job title, department
- Trial end date, end date, leave scheme
- Termination reason and reason details
- Salary type, gross salary, currency
- Comment
- Overlays latest contract change data

---

### 3.3 Skills Evaluation Report (HRMSkillRn)

Comprehensive skills/competency report with two sort modes.

**Specification Fields:**
- Employee range (f1)
- Skill range (f2)
- Rating range (f3)
- As-of date (d1, defaults to current date)
- Include daughter companies (IncDaughter)
- Current employees only (flags[3])
- OK/Not OK filter (flags[1], flags[2])

**Sorting Options (flags[0]):**
- 0: By Employee (shows each employee with their skill list)
- 1: By Skill (shows each skill with the employees who have it)

**Key Feature:** Uses the as-of date to find the most recent evaluation per employee, supporting point-in-time skills reporting. Supports multi-company (daughter company) aggregation.

---

### 3.4 Employee Statistics Report (EmployeeStatRn)

Comprehensive employee profile report showing multiple HRM dimensions.

**Sections (configurable per user via EmplPSVc):**
- Activities (CRM activities linked to employee)
- Soft Factors (behavioral assessments)
- Employment Contracts (with dates and comments)
- Contract Changes (with dates and comments)
- Performance Appraisals (with dates and comments)
- Leave Applications (with start/end dates and days)

**Filtering:**
- Employee range
- Date period

---

### 3.5 Employee Status Report (EmpStatusRn)

Financial report showing employee billable status.

**Output:**
- Time, materials, purchases, stock amounts per employee
- Split into: "To Invoice" and "Invoiced" categories
- Totals across all employees
- Two display modes: by category and by type

**Filtering:**
- Employee range
- Date period
- Project filter

---

### 3.6 Employee Training Report (EmployeeTrainingRn)

Lists training plans with full participant details.

**Specification Fields:**
- Employee (f1)
- Topic (f2)
- Status (f3)
- Trainer (f4)
- Shadower(s) (f5 — supports comma-separated list)
- Date period

**Sorting Options (flags[1]):**
- 0: By Training Date and Time
- 1: By Topic
- 2: By Status

**Output:**
- Training serial number, topic, description, status name, date, start/end time
- Employee, trainer, and up to 3 shadowers with names
- Comments

---

## 4. Maintenances (Batch Operations)

No dedicated HRM maintenance routines were found in the `hal/Maint/` directory. HRM batch operations are embedded within the register logic:

### 4.1 Contract Termination Cascade
When an Employment Contract's TerminatedFlag is set:
1. **SetTrainingPlanClosedStatus**: Closes all non-completed training plans for the employee (sets Status to ClosedStatus from TrainingPlanBlock), unless the employee has another open contract
2. **SetHRMSETerminatedStatus**: Sets TerminatedFlag on all Skills Evaluations for the employee, unless the employee has another open contract

### 4.2 Contract Change Overlay
When printing or reporting on contracts, the system automatically finds the latest approved contract change (FindHRMCOChange) and overlays: TrialEndDate, Class, JobTitle, Comment, SalaryType, GrossSalary, CurncyCode, DepCode, LeaveScheme.

---

## 5. Documents (Forms)

### 5.1 Employment Contract Form (HRMCOForm / DoHRMCOForm)

Printable employment contract document.

**Form Fields Output:**
- F_SERNR — Contract serial number
- F_TRANSDATE — Transaction date
- F_STARTDATE — Contract start date
- F_ENDDATE — Contract end date
- F_TRIALENDDATE — Trial period end date
- F_EMPLOYEE — Employee code
- F_EMPLOYEENAME — Employee name
- F_JOBTITLE — Job title
- F_SALARYTYPE — Salary type (resolved from set 463)
- F_GROSSSALARY — Gross salary amount
- F_MANAGER2 — Manager/superior code
- F_COMMENT — Comment text
- F_DEPARTMENT — Department code
- F_CLASS — Contract class
- F_VALUTA — Currency code
- F_LEAVESCHEME — Leave scheme
- F_LEAVEREASON — Termination reason (resolved from set 470)
- F_LEAVEREASONDETAILS — Termination reason details
- F_EMPCONTRCHANGEDATE — Latest contract change date (if changes exist)

**Features:**
- Form code selection based on OKFlag, language, user group, serial number
- Multiple document printing supported (multi-page / multi-copy)
- Overlays latest contract change data onto printout
- Uses FormDefVc for form template definition

---

## 6. Business Logic and Workflows

### 6.1 Employment Contract Lifecycle

```
Draft → Approved (OK) → [Changes via Contract Change] → Terminated
  │                          │                              │
  │ StartDate mandatory      │ Creates change history       │ Reason mandatory
  │ Employee validated       │ Overlays onto contract       │ EndDate mandatory
  │ SerNr auto-assigned      │ Requires HRMCOChangeOK      │ ReasonDetails mandatory
  │                          │                              │
  │ Requires HRMCOOK         │ Fields changed:              │ Cascades:
  │ One active per employee  │ - TrialEndDate               │ - Close training plans
  │                          │ - Class, JobTitle            │ - Set SE terminated
  └──────────────────────────│ - SalaryType, GrossSalary   │
                             │ - CurncyCode, DepCode       └──────────────────
                             │ - LeaveScheme
                             │ - Comment
                             └─────────────────────────────
```

**Step-by-step:**
1. Create new contract: SerNr auto-generated, TransDate defaults to today
2. Fill mandatory fields: Employee (validated as employee type, not blocked), StartDate
3. Fill optional fields: JobTitle (auto-fills description), SalaryType, GrossSalary, Department, Class, LeaveScheme
4. Add benefit rows from BenefitTypeVc (auto-populates Description, Type, Terms, Amount, Currency, Frequency)
5. Set TaxLoad if GrossSalary is specified and contract is open-ended
6. Set WorkHoursPerDay if leave calculation is hours-based
7. Approve (set OKFlag = 1) — requires HRMCOOK permission
8. Print contract using HRMCOForm
9. To modify: create Employment Contract Change (cannot edit approved contract directly)
10. To terminate: set TerminatedFlag (requires Reason, EndDate, ReasonDetails)
11. Termination cascades to training plans and skills evaluations
12. Can create CRM Activity linked to contract

### 6.2 Contract Change Workflow

1. Open approved Employment Contract
2. Use "Employment Contract Change" operation (HRMCOChangeFromHRMCODsm)
3. System pre-fills from the latest change or the original contract
4. Modify: TrialEndDate, Class, JobTitle, SalaryType, GrossSalary, CurncyCode, DepCode, LeaveScheme, Comment
5. Approve change (requires HRMCOChangeOK)
6. Subsequent reports/forms automatically overlay the latest change

### 6.3 Performance Appraisal Workflow

1. Create appraisal: assign Employee and Interviewer (both must be valid employees)
2. Add rows with PerfFactor + PerfRating pairs
3. Approve (requires HRMPAOK, at least one row required)
4. Optionally create CRM Activity linked to appraisal (uses PerformanceAppraisal activity type)

### 6.4 Skills Evaluation Workflow

1. Create evaluation: assign Employee and Superior
2. For BrowseNew access users: auto-populates from their latest evaluation (RemotePopulateSkill)
3. Add rows with Skill + Rating pairs
4. Approve (requires HRMSEOK, at least one row required)
5. TerminatedFlag auto-set when employee's contract is terminated
6. List view defaults to showing non-terminated evaluations; toggle available

### 6.5 Checklist Workflow (Onboarding/Offboarding)

1. Create checklist: assign Employee (auto-detects ListType from contract termination status)
2. System populates Name, JobTitle from employee/contract data
3. Assign Superior
4. Add rows with Checkpoint + CheckPointComment
5. Assign Responsible person per task
6. Track Status: Pending (3/NONE) → WIP (1) → Done (2) or N/A (0)
7. DateCompleted auto-set when Status = Done
8. Approve (requires HRMSEOK)
9. Can generate email notification (CreateMailFromHRMCheckList)
10. When duplicating: clears employee-specific data, resets all statuses to NONE

### 6.6 Payroll Processing Workflow

1. Create payroll record: assign UserCode (must be valid, non-closed, non-terminated user)
2. Add payment type rows (validated against HRMPymtTypeVc)
3. Enter amounts per line — TotSum auto-calculated
4. Multi-currency support with exchange rate conversion
5. Approve (once approved, cannot be un-approved — stricter than other registers)
6. Supports import with dual-base currency conversion

### 6.7 Training Plan Workflow

1. Create plan with Employee (mandatory) and Topic (mandatory)
2. Assign Trainer, up to 3 Shadowers (no role overlap allowed)
3. Set training date and time range
4. Double-booking detection checks time conflicts
5. Default status from TrainingPlanBlock.DefStatus
6. Auto-closed when employee's contract is terminated

### 6.8 Activity (CRM) Integration

Employment Contracts, Contract Changes, and Performance Appraisals can all create linked CRM Activities:
- **From Contract**: MakeActFromHRMCO — creates todo activity linked to employee contact
- **From Contract Change**: MakeActFromHRMCOChange — same pattern
- **From Appraisal**: MakeActFromHRMPA — uses PerformanceAppraisal activity type from settings

---

## 7. Enums and Constants

### 7.1 kHRMCOSalaryType (Set 463)
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMCOSalaryTypeMonthly | Monthly salary |
| 1 | kHRMCOSalaryTypeYearly | Yearly salary |
| 2 | kHRMCOSalaryTypeWeekly | Weekly salary |
| 3 | kHRMCOSalaryTypeFortnightly | Fortnightly salary |
| 4 | kHRMCOSalaryTypeHourly | Hourly rate |

### 7.2 kHRMCOReason (Set 470) — Termination Reasons
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMCOReasonDummy | (none/placeholder) |
| 1 | kHRMCOReasonResignation | Resignation |
| 2 | kHRMCOReasonNonRenewal | Non-renewal of contract |
| 3 | kHRMCOReasonDismissalOperational | Dismissal - Operational reasons |
| 4 | kHRMCOReasonDismissalMisconduct | Dismissal - Misconduct |
| 5 | kHRMCOReasonDismissalIncapacity | Dismissal - Incapacity |
| 6 | kHRMCOReasonDismissalRetirement | Dismissal - Retirement |
| 7 | kHRMCOReasonDismissalDeath | Dismissal - Death |
| 8 | kHRMCOReasonMoveToOtherDepartment | Move to other department |
| 9 | kHRMCOReasonMoveToOtherCountry | Move to other country |
| 10 | kHRMCOReasonEndOfIntership | End of internship |
| 11 | kHRMCOReasonTrialPeriodnotpast | Trial period not passed |
| 12 | kHRMCOReasonDismissalNonPerformance | Dismissal - Non-performance |

### 7.3 kHRMCOChangeReason — Contract Change Reasons
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMCOChangeReasonDummy | (none/placeholder) |
| 1 | kHRMCOChangeReasonNew | New/initial |
| 2 | kHRMCOChangeReasonPromotion | Promotion |
| 3 | kHRMCOChangeReasonTransfer | Transfer |
| 4 | kHRMCOChangeReasonDemotion | Demotion |

### 7.4 kHRMCOJobType
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMCOJobTypeMonthly | Monthly |
| 1 | kHRMCOJobTypeYearly | Yearly |
| 2 | kHRMCOJobTypeWeekly | Weekly |
| 3 | kHRMCOJobTypeFortnightly | Fortnightly |

### 7.5 kHRMJPStatusO — Job Position Status
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMJPStatusOpening | Opening/being defined |
| 1 | kHRMJPStatusFree | Vacant/unfilled |
| 2 | kHRMJPStatusFilled | Filled/occupied |
| 3 | kHRMJPStatusCancelled | Cancelled |

### 7.6 kHRMCheckListStatus
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kHRMCheckListStatusNA | Not Applicable |
| 1 | kHRMCheckListStatusWIP | Work In Progress |
| 2 | kHRMCheckListStatusDONE | Completed |
| 3 | kHRMCheckListStatusNONE | Pending/Not Started |

### 7.7 kLeaveSchemeType
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kIncludedinAllowance | Included in allowance |
| 1 | kExcludedinAllowance | Excluded from allowance |
| 2 | kEnforcedProportionally | Enforced proportionally |

### 7.8 kLeaveCalculationBase
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kLeaveCalculationBaseCalendarYear | Calendar year |
| 1 | kLeaveCalculationBaseFiscalYear | Fiscal year |

### 7.9 kAccessLevel (relevant subset)
| Value | Constant | Description |
|-------|----------|-------------|
| 0 | kAccessLevelDummy | None |
| 1 | kAccessLevelFull | Full access |
| 2 | kAccessLevelReadOnly | Read only |
| 3 | kAccessLevelReadNew | Read + create |
| 6 | kAccessLevelBrowse | Browse only |
| 7 | kAccessLevelBrowseNew | Browse + create new (triggers self-population for Skills) |
| 5 | kAccessLevelNone | No access |

---

## 8. Cross-Module Integration Points

### 8.1 Contact Register (CUVc) — Employee Base
- Employees are stored in the Contact register with `EmployeeType != 0`
- HRM modules reference employees via CUVc.Code
- Fields inherited: Name, Phone, Person (contact person), JobDesc, LangCode
- blockedFlag prevents using blocked contacts

### 8.2 User Register (UserVc)
- Supervisors and payroll users reference UserVc
- Fields: Code, Name, CustCode (link to CUVc), Closed, TerminatedFlag

### 8.3 Department Register (DepVc)
- Employment Contracts and Job Positions reference departments

### 8.4 CRM Activities (ActVc)
- Employment Contracts, Contract Changes, and Performance Appraisals can all create linked activities
- Activity types configured via ASTBlock settings
- Bidirectional record links created between HRM record and Activity

### 8.5 Leave Management (LeaveApplicationVc)
- Leave Applications reference employees (same CUVc FK)
- Leave Scheme on Employment Contract controls leave entitlement
- LeaveRulesBlock settings affect contract validation (WorkHoursPerDay requirement)
- Employee Statistics report includes leave application data

### 8.6 Soft Factor Appraisals (SoftFactorVc)
- Behavioral/interpersonal assessments
- Referenced in Employee Statistics report
- Linked to employees via UserVc.CustCode -> SoftFactorVc.EmployeeCode

### 8.7 Mail System (MailVc)
- Checklists can generate email notifications
- Creates Mail record linked to the checklist with record links

### 8.8 Nominal Ledger / Finance
- Payroll register (HRMPayrollVc) uses currency conversion features (dual-base currency, exchange rates)
- Payment types likely map to GL accounts (implied by the import/conversion logic)
- No direct NL transaction creation found in HAL code — payroll posting to NL may be in additional modules or manual

### 8.9 Multi-Company Support
- Skills Evaluation report supports daughter company aggregation
- Training Plan and contract termination cascades operate within company context

---

## 9. Nexa ERP Implications

### 9.1 What HansaWorld Provides (to carry forward)

1. **Employment Contract lifecycle** — Draft/Approve/Terminate with full change history is solid and should be replicated
2. **Contract Change register** — Immutable audit trail of all contract modifications is excellent practice
3. **Benefits on contracts** — Row-level benefits with type, amount, frequency, currency is a good model
4. **Skills/Competency management** — Skills Evaluation with Skill + Rating matrix, point-in-time reporting
5. **Performance Appraisals** — Factor + Rating matrix approach
6. **Checklists** — Onboarding/offboarding with checkpoint templates, status tracking, responsible persons, auto-date completion
7. **Job Positions** — Organizational structure with department linkage
8. **Training Plans** — With double-booking detection and auto-closure on termination
9. **CRM Activity integration** — Linking HRM events to CRM activities
10. **Approval/access rights model** — Granular permissions per register action
11. **Multi-sort reports** — Flexible filtering and sorting for skills, contracts, statistics

### 9.2 What HansaWorld Lacks (UK-specific gaps for Nexa)

#### Payroll Gaps (Critical for UK)
HansaWorld's payroll is **extremely basic** — just a simple payment-type + amount register with no:
- **PAYE tax calculation** — No income tax tables, tax codes, cumulative/week1-month1 basis
- **National Insurance (NI)** — No NI category letters, employee/employer NI calculations, thresholds
- **RTI (Real Time Information)** — No FPS/EPS/FPSn submissions to HMRC
- **P45/P60/P11D** — No statutory forms generation
- **Student loan deductions** — No plan types, thresholds, recovery
- **Pension auto-enrolment** — No qualifying criteria, opt-in/out, contribution calculations, staging dates
- **Statutory pay calculations** — No SSP, SMP, SPP, ShPP, SAP calculations with qualifying rules
- **Tax year management** — No year-end processing, P35, EYU
- **Salary sacrifice** — No pre-tax deduction modeling
- **Payslip generation** — No standardized payslip document
- **BACS payment files** — No electronic payment file generation
- **Holiday pay calculation** — No UK-compliant 52-week reference period calculations

#### HR Process Gaps
- **Absence management** — Leave Applications exist but no Bradford Factor, return-to-work tracking
- **Disciplinary/Grievance** — No formal disciplinary or grievance process tracking
- **Right to Work** — ResidencyType exists but no document expiry tracking, right-to-work checks
- **Recruitment** — No applicant tracking, interview scheduling, offer management
- **Time & Attendance** — Timesheet exists separately but no integration with HR/Payroll
- **Organisation chart** — Job Positions exist but no hierarchical org structure
- **Employee self-service** — BrowseNew access for skills is the only self-service feature

#### Compliance Gaps
- **GDPR** — No data retention policies, right-to-erasure support
- **Gender pay gap reporting** — No pay gap analysis tools
- **Working Time Directive** — No working hours tracking against WTD limits
- **Equalities monitoring** — No protected characteristics tracking (optional/voluntary)

### 9.3 Nexa ERP HR/Payroll Module Recommendations

#### Phase 1 (MVP — Story Scope)
1. **Employee management** — Based on HansaWorld CUVc employee type, but as a first-class entity
2. **Employment contracts** — Full HansaWorld model: Draft/Approve/Terminate with change history
3. **UK Payroll engine** — NEW BUILD, not based on HansaWorld:
   - PAYE tax calculation with tax codes
   - NI categories and calculations
   - Pension auto-enrolment
   - Statutory pay (SSP, SMP, SPP, ShPP, SAP)
   - Student loan deductions
   - RTI submission (FPS, EPS)
   - Payslip generation
   - BACS file generation
4. **Leave management** — Enhanced from HansaWorld with UK statutory entitlements
5. **Checklists** — Based on HansaWorld model for onboarding/offboarding

#### Phase 2 (Post-MVP)
6. **Skills & Training** — Based on HansaWorld's skills evaluation and training plan model
7. **Performance management** — Based on HansaWorld's appraisal model, enhanced with 360-degree feedback
8. **Job positions & org structure** — Based on HansaWorld, enhanced with hierarchical reporting
9. **Benefits management** — Based on HansaWorld's contract benefits model

#### Phase 3 (Future)
10. **Recruitment/ATS** — New build
11. **Time & Attendance** — Integration with attendance systems
12. **Employee self-service portal** — Full self-service for leave, expenses, personal details
13. **Analytics & reporting** — Gender pay gap, headcount trends, turnover analysis

### 9.4 Key Architectural Decisions from HansaWorld

1. **Immutable contract changes** — Keep this pattern. Never edit approved contracts; always create change records.
2. **Cascading termination** — When a contract is terminated, cascade to close training plans and mark skills as terminated. Good pattern.
3. **Approval workflow** — Per-register OK flag with granular permissions. Extend to multi-level approval for Nexa.
4. **Benefit types on contracts** — Good model for UK benefits: pension contributions, health insurance, company car, etc.
5. **Checkpoint templates** — Reusable checklist templates with per-item responsible person and status tracking.
6. **Point-in-time skills reporting** — Excellent for compliance audits and skills gap analysis.
7. **CRM activity linkage** — Maintain this for a unified activity timeline per employee.

---

## Appendix A: HAL Source File Index

| File | Purpose |
|------|---------|
| `hal/RActions/HRMCOVcRAction.hal` | Employment Contract: validation, defaults, duplicate, remove test |
| `hal/RActions/HRMCOChangeVcRAction.hal` | Contract Change: validation, defaults, index, update-after |
| `hal/RActions/HRMCOClassVcRAction.hal` | Contract Class: code validation |
| `hal/RActions/HRMCOTypeVcRAction.hal` | Contract Type: code validation |
| `hal/RActions/HRMChecklistVcRAction.hal` | Checklist: validation, defaults, duplicate |
| `hal/RActions/HRMPAVcRAction.hal` | Performance Appraisal: validation, duplicate |
| `hal/RActions/HRMPACVcRAction.hal` | PA Category: code validation |
| `hal/RActions/HRMPFVcRAction.hal` | Performance Factor: code validation |
| `hal/RActions/HRMPOVcRAction.hal` | Job Position: validation, duplicate |
| `hal/RActions/HRMPRVcRAction.hal` | Performance Rating: code validation |
| `hal/RActions/HRMPayrollVcRAction.hal` | Payroll: defaults, duplicate, validation, import |
| `hal/RActions/HRMPymtTypeVcRAction.hal` | Payment Type: index filtering |
| `hal/RActions/HRMRatingVcRAction.hal` | Rating: code validation |
| `hal/RActions/HRMResidencyTypeVcRAction.hal` | Residency Type: code validation |
| `hal/RActions/HRMSEVcRAction.hal` | Skills Evaluation: validation, defaults, duplicate, termination cascade |
| `hal/RActions/HRMSEVcRActionClient.hal` | Skills Evaluation client: auto-populate from previous |
| `hal/RActions/HRMSkillVcRAction.hal` | Skill: code validation |
| `hal/RActions/HRMBenefitTypeVcRAction.hal` | Benefit Type: code validation |
| `hal/RActions/TrainingPlanVcRAction.hal` | Training Plan: validation, duplicate, defaults, termination closure |
| `hal/WActions/HRMCOVcWAction.hal` | Contract UI: field logic, benefit paste, termination, reports, activities |
| `hal/WActions/HRMCOChangeVcWAction.hal` | Contract Change UI: field logic, approval, activities |
| `hal/WActions/HRMCheckListVcWAction.hal` | Checklist UI: field logic, status tracking, email generation |
| `hal/WActions/HRMPAVcWAction.hal` | Appraisal UI: field logic, approval, activities |
| `hal/WActions/HRMPOVcWAction.hal` | Job Position UI: field logic, approval |
| `hal/WActions/HRMPayrollVcWAction.hal` | Payroll UI: sum calculation, field logic, approval (no un-OK) |
| `hal/WActions/HRMSEVcWAction.hal` | Skills Eval UI: field logic, terminated toggle |
| `hal/Documents/DoHRMCOForm.hal` | Contract form: field output, change overlay |
| `hal/Documents/HRMCOForm.hal` | Contract form: print driver |
| `hal/Reports/EmpStatusRn.hal` | Employee billing status report |
| `hal/Reports/EmployeeStatRn.hal` | Employee statistics/profile report |
| `hal/Reports/EmployeeTrainingRn.hal` | Training plan report |
| `hal/Reports/HRMCODataRn.hal` | Contract detailed data report |
| `hal/Reports/HRMCOListRn.hal` | Contract list report |
| `hal/Reports/HRMSkillRn.hal` | Skills evaluation report |
| `hal/Tools/HRMCheckListVcTools.hal` | Checklist tools: email creation |
| `hal/Tools/RemoteTools8.hal` | Activity creation for HRM records |
| `hal/Tools/RemoteTools13.hal` | Skills auto-population |
| `amaster/haldefs.h` | Enum definitions for all HRM constants |

# Epic E22: Fixed Assets

> **Fixed asset register with acquisition, depreciation, disposal, revaluation, and transfer management.** Supports UK GAAP (FRS 102 Section 17) depreciation methods and automatic GL posting of depreciation entries.

**Architecture:** §2.18 Fixed Assets
**Models:** 8 models — `FixedAsset`, `AssetCategory`, `AssetDepreciationEntry`, `AssetDisposal`, `AssetRevaluation`, `AssetTransfer`, `DepreciationRun`, `AssetMaintenanceLog`
**State Machines:** SM:FixedAsset, SM:DepreciationEntry, SM:AssetDisposal, SM:AssetTransfer
**Events:** `asset.acquired`, `depreciation.run.completed`, `depreciation.entry.posted`, `asset.disposed`
**API:** §2.19 — ~13 endpoints under `/assets/*`
**Business Rules:** BR-FA-001 to BR-FA-012
**FRs:** FR158–FR163
**UX Templates:** T1 (Entity List), T2 (Record Detail), T6 (Wizard)

**Dependencies:** E14 (Finance/GL for journal posting), E1 (Database + Core Models), E3 (Event Bus + Audit Trail)

---

## Story E22.S1: Asset Register & Categories

**User Story:** As a finance user, I want to create and manage fixed asset records with acquisition details, categories, and locations so that I maintain a complete fixed asset register.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new fixed asset
  Given I am logged in as STAFF or higher
  When I create an asset with name, category, acquisition date, cost, useful life, residual value, location, and responsible person
  Then a FixedAsset record is created with status ACTIVE scoped to my companyId
  And an "asset.acquired" event is emitted
  And the asset appears in the asset register list

Scenario: Configure asset categories with GL mappings
  Given I am an ADMIN user
  When I create an asset category "Office Equipment" with GL accounts for cost, depreciation, accumulated depreciation, and disposal gain/loss
  Then the AssetCategory record is created
  And new assets in this category inherit the GL account mappings

Scenario: Asset category enforces depreciation method
  Given asset category "Vehicles" has depreciation method REDUCING_BALANCE
  When I create an asset in category "Vehicles"
  Then the depreciation method defaults to REDUCING_BALANCE
  And can be overridden at the asset level if permitted (BR-FA-002)

Scenario: View asset register with net book value
  Given the asset register contains 50 assets
  When I view the asset register list
  Then each asset shows: name, category, acquisition date, cost, accumulated depreciation, net book value
  And I can filter by category, status, location

Scenario: Asset has mandatory fields
  Given I attempt to create an asset without acquisition date or cost
  When I submit the form
  Then validation errors are shown for required fields
  And the asset is not created
```

**Key Tasks:**
1. **Create FixedAsset model and migration** — companyId, name, assetNumber (NumberSeries), categoryId FK, acquisitionDate, acquisitionCost (Decimal 19,4), residualValue, usefulLifeMonths, depreciationMethod enum (STRAIGHT_LINE, REDUCING_BALANCE, SUM_OF_DIGITS), status enum, locationId, responsiblePersonId, netBookValue (computed)
   - Add AssetCategory: companyId, name, depreciationMethod default, costAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId, disposalGainLossAccountId
2. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/assets` and `/api/v1/assets/categories`
   - Scope all queries by companyId; cursor-based pagination
   - Asset number auto-generation via NumberSeries
3. **Implement net book value calculation** — cost - accumulated depreciation + revaluations
4. **Build asset register list** — T1 template with computed NBV column, category filter, status badges
5. **Build asset detail** — T2 template with all fields, depreciation schedule tab, history tab
6. **Build category management** — T7 (Settings) for ADMIN users
7. **Write unit tests** — NBV calculation, required field validation, category inheritance
8. **Write integration tests** — CRUD lifecycle, category GL mapping inheritance

**FR/NFR References:** FR158, FR163, NFR2, NFR14, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR158, FR163) | Asset register, categories, mandatory fields |
| Architecture | §2.18 Fixed Assets | FixedAsset model, AssetCategory, GL mappings |
| UX Design Specification | T1 (Entity List), T2 (Record Detail), T7 (Settings) | Register list, detail, category settings |
| API Contracts | §2.19 Fixed Assets | Asset and category CRUD endpoints |
| Data Models | §8 Fixed Assets | FixedAsset, AssetCategory schemas |
| State Machine Reference | §7 Fixed Assets | SM:FixedAsset — ACTIVE / DISPOSED / WRITTEN_OFF |
| Event Catalog | §6 Fixed Assets | asset.acquired event |
| Business Rules Compendium | §13 Additional (BR-FA-001 to BR-FA-012) | Category rules, NBV calculation, mandatory fields |

---

## Story E22.S2: Depreciation Calculation Engine

**User Story:** As a finance user, I want the system to calculate depreciation using straight-line, reducing balance, and sum-of-digits methods per UK GAAP (FRS 102) so that asset values are correctly reduced over their useful life.

**Acceptance Criteria:**

```gherkin
Scenario: Straight-line depreciation calculation
  Given an asset with cost GBP 12,000, residual value GBP 2,000, useful life 60 months
  When monthly depreciation is calculated
  Then the monthly charge is GBP 166.67 ((12000-2000)/60)
  And the calculation uses Decimal(19,4) precision

Scenario: Reducing balance depreciation calculation
  Given an asset with cost GBP 10,000, reducing balance rate 25%, net book value GBP 7,500
  When annual depreciation is calculated
  Then the annual charge is GBP 1,875 (7500 * 25%)
  And depreciation stops when NBV reaches residual value (BR-FA-005)

Scenario: Sum-of-digits depreciation calculation
  Given an asset with cost GBP 20,000, residual value GBP 2,000, useful life 5 years
  When Year 1 depreciation is calculated
  Then the charge is GBP 6,000 (18000 * 5/15)
  And Year 2 is GBP 4,800 (18000 * 4/15)

Scenario: Depreciation respects residual value floor
  Given an asset with NBV GBP 2,100 and residual value GBP 2,000
  And the calculated monthly depreciation would be GBP 166.67
  When depreciation is calculated
  Then the charge is limited to GBP 100 (bringing NBV to residual value)
  And no further depreciation is calculated in subsequent periods

Scenario: Pro-rata depreciation for mid-month acquisition
  Given an asset acquired on 15 March with monthly depreciation GBP 100
  When March depreciation is calculated
  Then the charge is GBP 51.61 (17/31 * 100) — pro-rated by days
```

**Key Tasks:**
1. **Implement depreciation calculation service** — support three methods per FRS 102 Section 17
   - Straight-line: (cost - residual) / useful life months
   - Reducing balance: NBV * rate% (annual, divided by 12 for monthly)
   - Sum-of-digits: (cost - residual) * (remaining years / sum of digits)
2. **Implement residual value floor** — never depreciate below residual value (BR-FA-005)
3. **Implement pro-rata calculation** — daily pro-rating for partial first/last months
4. **Use Decimal(19,4) for all monetary calculations** — per NFR38
5. **Create depreciation schedule preview** — show projected depreciation over remaining useful life
6. **Write unit tests** — each method with known expected values, edge cases (zero residual, 1-month life, mid-month acquisition)
7. **Write integration tests** — calculation service with real asset data

**FR/NFR References:** FR159, NFR38, NFR36

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR159) | Depreciation methods per UK GAAP |
| Architecture | §2.18 Fixed Assets | Depreciation calculation algorithms, formulas |
| UX Design Specification | T2 (Record Detail) | Depreciation schedule display on asset detail |
| API Contracts | §2.19 Fixed Assets | Depreciation preview endpoint |
| Data Models | §8 Fixed Assets | FixedAsset depreciation fields, Decimal(19,4) types |
| State Machine Reference | §7 Fixed Assets | SM:DepreciationEntry lifecycle |
| Event Catalog | §6 Fixed Assets | depreciation.entry.calculated event |
| Business Rules Compendium | §13 Additional (BR-FA-003 to BR-FA-006) | Calculation rules, residual floor, pro-rata |

---

## Story E22.S3: Depreciation Run & GL Posting

**User Story:** As a finance user, I want to run monthly depreciation and have it automatically post journal entries to the general ledger so that the accounts reflect accurate asset values.

**Acceptance Criteria:**

```gherkin
Scenario: Execute monthly depreciation run
  Given 20 active assets exist for the current company
  When I trigger the monthly depreciation run for March 2026
  Then an AssetDepreciationEntry is created for each asset with a calculated charge
  And a DepreciationRun record is created with status COMPLETED
  And a "depreciation.run.completed" event is emitted

Scenario: GL journal entries are posted
  Given a depreciation run has completed
  When GL posting is triggered
  Then a journal entry is created per asset (or batch journal)
  Debiting the depreciation expense account (from asset category)
  Crediting the accumulated depreciation account (from asset category)
  And each journal entry references the depreciation entry
  And "depreciation.entry.posted" events are emitted

Scenario: Prevent duplicate depreciation run
  Given depreciation has already been run for March 2026
  When I attempt to run depreciation for March 2026 again
  Then the system rejects the run with "depreciation.error.already_run_for_period"

Scenario: Depreciation run respects period locks
  Given the financial period for February 2026 is locked
  When I attempt to run depreciation for February 2026
  Then the system rejects the run with "depreciation.error.period_locked"

Scenario: Depreciation run with progress indication
  Given 500 assets need depreciation calculation
  When the run executes
  Then progress is reported (e.g., 200/500 processed)
  And the run completes within 60 seconds (NFR5)
```

**Key Tasks:**
1. **Create DepreciationRun model** — companyId, periodMonth, periodYear, status, runDate, processedCount, totalCount, journalBatchId
   - AssetDepreciationEntry: assetId, depreciationRunId, amount, postDate, journalEntryId, status
2. **Implement depreciation run service** — `POST /api/v1/assets/depreciation-runs`
   - Iterate all ACTIVE assets; call calculation engine per asset
   - Create AssetDepreciationEntry records; update asset accumulated depreciation and NBV
   - Validate no duplicate run for same period (BR-FA-007)
   - Check period lock status (BR-FA-008)
3. **Implement GL posting** — create journal entries per asset or batched
   - Debit: category.depreciationExpenseAccountId; Credit: category.accumulatedDepreciationAccountId
   - Use journal entry API from E14 (Finance)
4. **Build depreciation run UI** — T6 (Wizard) with period selection, preview, execute, and results summary
5. **Implement progress tracking** — WebSocket updates during long-running depreciation runs
6. **Write unit tests** — duplicate run prevention, period lock check, GL posting logic
7. **Write integration tests** — full run cycle with GL verification

**FR/NFR References:** FR160, FR12, NFR5, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR160) | Automatic depreciation journal posting |
| Architecture | §2.18 Fixed Assets | DepreciationRun, batch GL posting design |
| UX Design Specification | T6 (Wizard) | Depreciation run wizard flow |
| API Contracts | §2.19 Fixed Assets | Depreciation run endpoints, GL posting |
| Data Models | §8 Fixed Assets | DepreciationRun, AssetDepreciationEntry models |
| State Machine Reference | §7 Fixed Assets | SM:DepreciationEntry — CALCULATED → POSTED |
| Event Catalog | §6 Fixed Assets | depreciation.run.completed, depreciation.entry.posted events |
| Business Rules Compendium | §13 Additional (BR-FA-007, BR-FA-008) | Duplicate prevention, period lock rules |

---

## Story E22.S4: Asset Disposal & Gain/Loss

**User Story:** As a finance user, I want to record asset disposals with automatic gain/loss calculation and GL posting so that disposed assets are removed from the register with correct accounting entries.

**Acceptance Criteria:**

```gherkin
Scenario: Dispose of an asset with gain
  Given an asset has NBV of GBP 3,000 (cost 10,000, accumulated dep 7,000)
  When I record disposal with proceeds of GBP 4,000
  Then the disposal gain is calculated as GBP 1,000
  And an AssetDisposal record is created
  And the asset status changes to DISPOSED
  And an "asset.disposed" event is emitted

Scenario: Dispose of an asset with loss
  Given an asset has NBV of GBP 5,000
  When I record disposal with proceeds of GBP 3,000
  Then the disposal loss is calculated as GBP 2,000

Scenario: GL entries for disposal
  Given an asset is disposed with gain GBP 1,000
  When GL posting is triggered
  Then journal entries are created:
    Debit: Bank/Cash (proceeds) GBP 4,000
    Debit: Accumulated Depreciation GBP 7,000
    Credit: Asset Cost Account GBP 10,000
    Credit: Disposal Gain/Loss Account GBP 1,000

Scenario: Disposal requires approval
  Given an asset disposal is created
  When submitted for approval
  Then the disposal follows the standard approval workflow
  And GL posting only occurs after approval (BR-FA-010)

Scenario: Disposal date must be after last depreciation date
  Given the last depreciation entry for the asset was 31 March 2026
  When I attempt to record disposal with date 15 March 2026
  Then the system rejects with "asset.error.disposal_before_last_depreciation"
```

**Key Tasks:**
1. **Create AssetDisposal model** — assetId, disposalDate, disposalMethod (SALE, SCRAP, WRITE_OFF), proceedsAmount, nbvAtDisposal, gainLoss (computed), journalEntryId, status, approvedById
2. **Implement disposal endpoint** — `POST /api/v1/assets/:id/dispose`
   - Calculate gain/loss: proceeds - NBV at disposal date
   - Run catch-up depreciation if disposal date is mid-period
   - Create AssetDisposal record; update asset status to DISPOSED
3. **Implement GL disposal posting** — multi-line journal entry (debit bank + accumulated dep, credit cost + gain/loss)
4. **Implement disposal approval workflow** — integrate with ApprovalRequest (cross-cutting)
5. **Build disposal UI** — T6 (Wizard) with disposal type selection, proceeds entry, GL preview
6. **Write unit tests** — gain/loss calculation, GL entry construction, date validation
7. **Write integration tests** — full disposal cycle with GL verification

**FR/NFR References:** FR161, FR12, NFR36, NFR38, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR161) | Disposal with gain/loss calculation |
| Architecture | §2.18 Fixed Assets | AssetDisposal model, GL posting logic |
| UX Design Specification | T6 (Wizard) | Disposal wizard flow |
| API Contracts | §2.19 Fixed Assets | Disposal endpoint |
| Data Models | §8 Fixed Assets | AssetDisposal model |
| State Machine Reference | §7 Fixed Assets | SM:AssetDisposal — PENDING → APPROVED → POSTED |
| Event Catalog | §6 Fixed Assets | asset.disposed event |
| Business Rules Compendium | §13 Additional (BR-FA-009 to BR-FA-011) | Disposal rules, date validation, gain/loss |

---

## Story E22.S5: Asset Revaluation & Transfer

**User Story:** As a finance user, I want to perform asset revaluations (per FRS 102) and record asset transfers between locations or departments so that the register reflects current values and accurate asset tracking.

**Acceptance Criteria:**

```gherkin
Scenario: Revalue an asset upward
  Given an asset has NBV of GBP 8,000
  When I record a revaluation to GBP 12,000
  Then an AssetRevaluation record is created with surplus of GBP 4,000
  And a GL journal entry credits the Revaluation Reserve for GBP 4,000
  And the asset's cost is adjusted to reflect the revalued amount

Scenario: Revalue an asset downward
  Given an asset has NBV of GBP 8,000 with no previous revaluation surplus
  When I record a revaluation to GBP 6,000
  Then the deficit of GBP 2,000 is posted to P&L (expense)
  And the asset's cost and accumulated depreciation are adjusted

Scenario: Transfer asset between locations
  Given an asset is at location "Head Office"
  When I transfer it to location "Branch Manchester"
  Then an AssetTransfer record is created with from/to locations and transfer date
  And the asset's locationId is updated
  And the transfer is recorded in the asset audit trail

Scenario: Transfer asset between departments with cost centre change
  Given an asset is assigned to department "IT"
  When I transfer it to department "Marketing"
  Then the responsible department is updated
  And future depreciation posts to the new department's cost centre

Scenario: Revaluation requires FRS 102 compliance
  Given a revaluation is recorded
  When the revaluation is processed
  Then the system follows FRS 102 Section 17 rules for revaluation accounting
  And the revaluation reserve is correctly maintained
```

**Key Tasks:**
1. **Create AssetRevaluation model** — assetId, revaluationDate, previousNbv, newValue, surplusDeficit, journalEntryId, approvedById
2. **Create AssetTransfer model** — assetId, transferDate, fromLocationId, toLocationId, fromDepartmentId, toDepartmentId, reason, transferredById
3. **Implement revaluation endpoint** — `POST /api/v1/assets/:id/revalue`
   - Calculate surplus/deficit; post to Revaluation Reserve or P&L per FRS 102
   - Adjust cost basis and recalculate future depreciation
4. **Implement transfer endpoint** — `POST /api/v1/assets/:id/transfer`
   - Update location/department; create audit record
5. **Build revaluation UI** — T6 (Wizard) with current value display, new value entry, GL preview
6. **Build transfer UI** — form with location/department dropdowns, reason field
7. **Write unit tests** — revaluation accounting (surplus vs deficit), transfer validation
8. **Write integration tests** — revaluation GL posting, transfer audit trail

**FR/NFR References:** FR162, NFR36, NFR38, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR162) | Revaluation with revaluation reserve per FRS 102 |
| Architecture | §2.18 Fixed Assets | AssetRevaluation, AssetTransfer models, FRS 102 rules |
| UX Design Specification | T6 (Wizard) | Revaluation and transfer wizard flows |
| API Contracts | §2.19 Fixed Assets | Revalue and transfer endpoints |
| Data Models | §8 Fixed Assets | AssetRevaluation, AssetTransfer models |
| State Machine Reference | §7 Fixed Assets | SM:AssetTransfer — PENDING → COMPLETED |
| Event Catalog | §6 Fixed Assets | asset.revalued, asset.transferred events |
| Business Rules Compendium | §13 Additional (BR-FA-011, BR-FA-012) | FRS 102 revaluation rules |

---

## Story E22.S6: Mobile Adaptation — Fixed Assets

**User Story:** As a mobile user, I want to view the asset register, scan asset barcodes for identification, and record asset location changes from my phone.

**Acceptance Criteria:**

```gherkin
Scenario: View asset register on mobile
  Given I am on the mobile app
  When I navigate to Fixed Assets
  Then I see a mobile-optimised list with asset name, category, location, and NBV

Scenario: Scan asset barcode
  Given I am on the mobile asset view
  When I scan an asset barcode using the phone camera
  Then the asset record is retrieved and displayed
  And I can view its details or initiate a transfer

Scenario: Record asset location change from mobile
  Given I am viewing an asset on mobile
  When I change the location to "Branch Manchester"
  Then an AssetTransfer record is created
  And the change syncs to the server

Scenario: Asset stock take from mobile
  Given I am conducting a physical asset verification
  When I scan assets and confirm their locations
  Then verified assets are marked as confirmed
  And discrepancies are flagged for review
```

**Key Tasks:**
1. **Create mobile asset register** — simplified T1 list with barcode scan button
2. **Implement barcode scanning** — Expo Camera/BarCode scanner integration
3. **Create mobile transfer form** — streamlined location change with confirmation
4. **Implement mobile stock take** — scan and confirm assets, report discrepancies
5. **Write unit tests** — barcode lookup, transfer validation
6. **Write integration tests** — mobile scan → asset retrieval → transfer flow

**FR/NFR References:** FR158, FR163, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR158, FR163) | Asset register, fixed asset report |
| Architecture | §2.18 Fixed Assets | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns |
| API Contracts | §2.19 Fixed Assets | Same endpoints used by mobile |
| Data Models | §8 Fixed Assets | Same models |
| State Machine Reference | §7 Fixed Assets | Same state machines |
| Event Catalog | §6 Fixed Assets | Same events |
| Business Rules Compendium | §13 Additional (BR-FA) | Same business rules |

---

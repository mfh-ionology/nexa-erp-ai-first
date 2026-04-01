# Finance Module Phase 2 -- Design Specification

> **Date:** 2026-04-01
> **Author:** Mohammed / Claude Opus 4.6
> **Status:** Draft -- pending approval
> **Depends on:** Finance Phase 1 (E14 Wave 1 -- complete)

---

## 1. Overview

Finance Phase 1 delivered the core GL: chart of accounts, financial periods, journal entries with dimension support, bank accounts, bank reconciliation, VAT returns, budgets, reports (TB, P&L, BS, Transaction Journal, Budget Variance), month-end, year-end, opening balances, exchange rates, and the finance dashboard.

Phase 2 fills the remaining gaps to make Finance production-ready:

| # | Feature Area | Summary |
|---|---|---|
| F1 | Dimension Management | CRUD UI + APIs for dimension types, values, requirements, defaults |
| F2 | Simulations | What-if journal entries that can be toggled into reports or converted to real postings |
| F3 | Budget Redesign | Versioned budgets, budget keys (allocation patterns), dimensional budget splits |
| F4 | Missing Settings | Dimensions tab, budget keys, budget versions, number series, approval rules, rounding |
| F5 | Missing Reports | Departmental P&L, Cost Centre, Project Profitability, GL Detail, Cash Flow, General Ledger |
| F6 | Exports & Imports | CSV/Excel export for all reports + list pages; CSV/Excel import for accounts, journals, budgets, rates |
| F7 | Skill Improvements | User persona checklist, test data seeder, Chrome extension testing |

### Goals

1. Every dimension table in the DB gets a full CRUD API and management UI
2. Simulations provide what-if analysis without polluting the GL
3. Budget versioning replaces the rigid ANNUAL/REVISED pattern with unlimited named versions
4. All reports gain dimension filtering, simulation inclusion, and export capability
5. Bulk import tools enable migration from legacy systems
6. Tooling improvements accelerate future module builds

---

## 2. Feature 1: Dimension Management

### 2.1 Current State

Six dimension tables already exist in the Prisma schema and are fully migrated:

- `DimensionType` -- defines dimension categories (Department, Cost Centre, Project, etc.)
- `DimensionValue` -- values within each type (hierarchical via `parentId`)
- `DimensionRequirement` -- rules that require dimensions on certain account ranges
- `JournalLineDimension` -- junction table linking journal lines to dimension values
- `DimensionDefault` -- default dimension values for entities (customers, suppliers, items, accounts)
- `DimensionBalance` -- pre-aggregated dimension balances per account/period

The journal service already validates dimension requirements (`validateDimensionRequirements`) and single-select constraints (`validateSingleSelectDimensions`) during posting. Journal lines support dimension assignment via the `dimensions` array in `GlPostingInput`.

**What is missing:** No CRUD APIs exist for managing DimensionType, DimensionValue, DimensionRequirement, or DimensionDefault. No UI pages exist. Users cannot configure dimensions without direct DB access.

### 2.2 API Contracts

#### 2.2.1 Dimension Types

```
GET    /finance/dimensions/types
       Query: { isActive?: boolean, cursor?: string, limit?: number }
       Response: { data: DimensionType[], meta: PaginationMeta }

POST   /finance/dimensions/types
       Body: { code: string, name: string, description?: string,
               isSingleSelect?: boolean, allowManualEntry?: boolean, sortOrder: number }
       Response: DimensionType

PATCH  /finance/dimensions/types/:id
       Body: Partial<{ name, description, isSingleSelect, allowManualEntry, sortOrder, isActive }>
       Response: DimensionType

GET    /finance/dimensions/types/:id
       Response: DimensionType (with values count)
```

Permission: `finance.dimensions.view`, `finance.dimensions.edit`

#### 2.2.2 Dimension Values

```
GET    /finance/dimensions/types/:typeId/values
       Query: { isActive?: boolean, parentId?: string, search?: string,
                cursor?: string, limit?: number }
       Response: { data: DimensionValue[], meta: PaginationMeta }

POST   /finance/dimensions/types/:typeId/values
       Body: { code: string, name: string, parentId?: string, metadata?: object }
       Response: DimensionValue

PATCH  /finance/dimensions/types/:typeId/values/:id
       Body: Partial<{ name, parentId, isActive, metadata }>
       Response: DimensionValue

GET    /finance/dimensions/types/:typeId/values/:id
       Response: DimensionValue (with children, parent)
```

Permission: `finance.dimensions.edit`

**Hierarchy rules:**
- `parentId` must reference a DimensionValue of the same type
- Maximum depth: 5 levels (validated server-side)
- Deactivating a parent does NOT cascade to children (they remain active but orphaned in the tree display)

#### 2.2.3 Dimension Requirements

```
GET    /finance/dimensions/requirements
       Query: { dimensionTypeId?: string, cursor?: string, limit?: number }
       Response: { data: DimensionRequirement[], meta: PaginationMeta }

POST   /finance/dimensions/requirements
       Body: { dimensionTypeId: string, accountCodeFrom: string, accountCodeTo: string,
               isRequired?: boolean }
       Response: DimensionRequirement

PATCH  /finance/dimensions/requirements/:id
       Body: Partial<{ accountCodeFrom, accountCodeTo, isRequired, isActive }>
       Response: DimensionRequirement

DELETE /finance/dimensions/requirements/:id
       Response: 204 No Content
```

Permission: `finance.dimensions.edit`

**Validation:**
- `accountCodeFrom` must be <= `accountCodeTo` (lexicographic)
- Both account codes must exist in ChartOfAccount
- Overlapping ranges for the same dimension type are allowed (union semantics)

#### 2.2.4 Dimension Defaults

```
GET    /finance/dimensions/defaults
       Query: { entityType?: string, entityId?: string, dimensionTypeId?: string }
       Response: DimensionDefault[]

POST   /finance/dimensions/defaults
       Body: { dimensionTypeId: string, dimensionValueId: string,
               entityType: string, entityId?: string }
       Response: DimensionDefault

DELETE /finance/dimensions/defaults/:id
       Response: 204 No Content
```

Permission: `finance.dimensions.edit`

**Entity types:** `ACCOUNT`, `CUSTOMER`, `SUPPLIER`, `ITEM`, `COMPANY` (global default).
When `entityId` is null and `entityType` is `COMPANY`, the default applies company-wide for that dimension type.

### 2.3 Zod Schemas

```typescript
// dimension-types.schema.ts
export const createDimensionTypeSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isSingleSelect: z.boolean().default(true),
  allowManualEntry: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999),
});

export const updateDimensionTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isSingleSelect: z.boolean().optional(),
  allowManualEntry: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});

// dimension-values.schema.ts
export const createDimensionValueSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateDimensionValueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});

// dimension-requirements.schema.ts
export const createDimensionRequirementSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  accountCodeFrom: z.string().min(1).max(20),
  accountCodeTo: z.string().min(1).max(20),
  isRequired: z.boolean().default(true),
});

// dimension-defaults.schema.ts
export const ENTITY_TYPES = ['ACCOUNT', 'CUSTOMER', 'SUPPLIER', 'ITEM', 'COMPANY'] as const;

export const createDimensionDefaultSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  dimensionValueId: z.string().uuid(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid().optional(),
});
```

### 2.4 UI Pages

#### Page: Dimension Types (T2 -- List Page)

- Route: `/finance/dimensions`
- Columns: Code, Name, Single Select (badge), Allow Manual Entry (badge), Sort Order, Active (badge), Values Count
- Actions: New Type (primary), Edit, Deactivate/Activate
- Click row -> navigates to Dimension Values for that type

#### Page: Dimension Values (T2 -- List Page with tree)

- Route: `/finance/dimensions/:typeId/values`
- Breadcrumb: Finance > Dimensions > {Type Name}
- Tree-table view: indented rows showing hierarchy, expandable/collapsible
- Columns: Code, Name, Parent, Active (badge)
- Actions: New Value (primary), Edit, Deactivate
- Flat list toggle for search/filter

#### Page: Dimension Requirements (T2 -- List Page)

- Route: `/finance/dimensions/requirements`
- Columns: Dimension Type (name), Account Range (From - To), Required (badge), Active (badge)
- Actions: New Requirement (primary), Edit, Delete
- Account range inputs use account code autocomplete (search ChartOfAccount)

#### Page: Dimension Defaults (T2 -- List Page)

- Route: `/finance/dimensions/defaults`
- Filter by: Entity Type dropdown, Dimension Type dropdown
- Columns: Dimension Type, Dimension Value, Entity Type, Entity (name/code from lookup)
- Actions: New Default (primary), Delete

### 2.5 Report Enhancement: Dimension Filters

All existing and new report APIs gain two optional query parameters:

```typescript
// Added to trialBalanceQuerySchema, reportQuerySchema, transactionJournalQuerySchema, etc.
dimensionTypeId: z.string().uuid().optional(),
dimensionValueId: z.string().uuid().optional(),
```

**Implementation approach:**

When `dimensionTypeId` + `dimensionValueId` are present, the report service:

1. Joins `JournalLine` -> `JournalLineDimension` -> `DimensionValue`
2. Filters to lines where `JournalLineDimension.dimensionValueId = ?`
3. Aggregates only those filtered lines

This applies to: Trial Balance, P&L, Balance Sheet, Transaction Journal, Budget Variance, and all new reports.

For the **DimensionBalance** table (pre-aggregated), reports can query it directly for faster performance when filtering by a single dimension value. The DimensionBalance rows are updated during journal posting (already partially implemented in `updateDimensionBalances`).

### 2.6 New Dimension-Specific Reports

#### Departmental P&L

- Route: `GET /finance/reports/departmental-pnl`
- Query: `{ fiscalYear, periodFrom, periodTo, dimensionTypeId }`
- Response: P&L structure with columns per dimension value
- Each column shows the P&L for journal lines tagged with that dimension value
- Final column: "Unallocated" for lines without any value for that dimension type

```typescript
export const departmentalPnlResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  dimensionTypeName: z.string(),
  columns: z.array(z.object({
    dimensionValueId: z.string(),
    dimensionValueName: z.string(),
    dimensionValueCode: z.string(),
  })),
  sections: z.array(z.object({
    classification: z.string(),
    name: z.string(),
    accounts: z.array(z.object({
      accountCode: z.string(),
      accountName: z.string(),
      values: z.array(z.number()), // one per column, same order
      total: z.number(),
    })),
    totals: z.array(z.number()), // one per column
    grandTotal: z.number(),
  })),
  summary: z.object({
    netProfitPerColumn: z.array(z.number()),
    totalNetProfit: z.number(),
  }),
});
```

#### Cost Centre Report

- Route: `GET /finance/reports/cost-centre`
- Query: `{ fiscalYear, periodFrom, periodTo, dimensionTypeId }`
- Response: Expense accounts grouped by cost centre dimension values
- Same columnar structure as Departmental P&L but showing only EXPENSE account types

#### Project Profitability

- Route: `GET /finance/reports/project-profitability`
- Query: `{ fiscalYear, periodFrom, periodTo, dimensionTypeId }`
- Response: Revenue vs Expense per project dimension value, with margin calculation

```typescript
export const projectProfitabilityResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  projects: z.array(z.object({
    dimensionValueId: z.string(),
    dimensionValueCode: z.string(),
    dimensionValueName: z.string(),
    revenue: z.number(),
    expenses: z.number(),
    profit: z.number(),
    marginPercentage: z.number().nullable(),
  })),
  totals: z.object({
    revenue: z.number(),
    expenses: z.number(),
    profit: z.number(),
    marginPercentage: z.number().nullable(),
  }),
});
```

---

## 3. Feature 2: Simulations

### 3.1 Concept

Simulations are what-if journal entries. They have the same line structure as real journal entries but exist in a separate table and do NOT affect account balances, period totals, or the GL. They can be:

- **Included in reports** for analysis (toggle `includeSimulations=true`)
- **Converted to real journal entries** (one-click, creates a DRAFT journal with the same lines)
- **Invalidated** when the scenario is no longer relevant

### 3.2 Data Model Changes

New Prisma models to add:

```prisma
enum SimulationStatus {
  ACTIVE
  TRANSFERRED
  INVALID

  @@map("simulation_status")
}

model Simulation {
  id              String           @id @default(uuid()) @map("id")
  companyId       String           @map("company_id")
  entryNumber     String           @map("entry_number") @db.VarChar(20)
  transactionDate DateTime         @map("transaction_date") @db.Date
  description     String           @map("description")
  reference       String?          @map("reference")
  status          SimulationStatus @default(ACTIVE) @map("status")
  periodId        String           @map("period_id")
  totalDebit      Decimal          @default(0) @map("total_debit") @db.Decimal(19, 4)
  totalCredit     Decimal          @default(0) @map("total_credit") @db.Decimal(19, 4)
  transferredToId String?          @map("transferred_to_id")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  createdBy       String           @map("created_by")
  updatedBy       String           @map("updated_by")

  period        FinancialPeriod  @relation(fields: [periodId], references: [id])
  transferredTo JournalEntry?    @relation("SimulationTransfer", fields: [transferredToId], references: [id])
  lines         SimulationLine[]

  @@unique([companyId, entryNumber], name: "uq_simulation_company_number")
  @@index([companyId])
  @@index([companyId, status])
  @@map("simulations")
}

model SimulationLine {
  id           String   @id @default(uuid()) @map("id")
  simulationId String   @map("simulation_id")
  lineNumber   Int      @map("line_number")
  accountCode  String   @map("account_code") @db.VarChar(20)
  companyId    String   @map("company_id")
  description  String?  @map("description")
  debit        Decimal  @default(0) @map("debit") @db.Decimal(19, 4)
  credit       Decimal  @default(0) @map("credit") @db.Decimal(19, 4)
  vatCode      String?  @map("vat_code") @db.VarChar(20)
  dimensionValues Json? @map("dimension_values") // [{dimensionTypeId, dimensionValueId}]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  simulation Simulation     @relation(fields: [simulationId], references: [id], onDelete: Cascade)
  account    ChartOfAccount @relation(fields: [companyId, accountCode], references: [companyId, code], onDelete: NoAction, onUpdate: NoAction)

  @@index([simulationId])
  @@index([companyId, accountCode])
  @@map("simulation_lines")
}
```

**Number series:** `SIM` prefix, e.g. `SIM-00001`. Added to NumberSeries seed data.

**Schema notes:**
- `SimulationLine.dimensionValues` uses JSON instead of a junction table because simulations are transient/analytical -- no need for query-optimized dimension lookups. When converting to a real journal, the JSON is read and proper `JournalLineDimension` records are created.
- `transferredToId` links to the `JournalEntry` created during conversion, providing an audit trail.
- `FinancialPeriod` needs a new reverse relation added: `simulations Simulation[]`.
- `JournalEntry` needs a new reverse relation added: `simulationSource Simulation[]  @relation("SimulationTransfer")`.
- `ChartOfAccount` needs a new reverse relation: `simulationLines SimulationLine[]`.

### 3.3 API Contracts

```
GET    /finance/simulations
       Query: { status?: 'ACTIVE' | 'TRANSFERRED' | 'INVALID',
                periodId?: string, cursor?: string, limit?: number }
       Response: { data: SimulationListItem[], meta: PaginationMeta }

GET    /finance/simulations/:id
       Response: SimulationDetail (header + lines with account names)

POST   /finance/simulations
       Body: { transactionDate: string (ISO date), description: string,
               reference?: string, periodId: string,
               lines: Array<{ accountCode, debit, credit, description?, vatCode?,
                              dimensionValues?: Array<{dimensionTypeId, dimensionValueId}> }> }
       Validation: lines must balance (total debit == total credit), accounts must exist
       Response: SimulationDetail

PATCH  /finance/simulations/:id
       Body: Partial header + optional lines replacement (same as journal update pattern)
       Constraint: only ACTIVE simulations can be updated
       Response: SimulationDetail

POST   /finance/simulations/:id/convert
       Converts to a real JournalEntry:
       1. Creates a DRAFT JournalEntry with the same lines (including proper JournalLineDimension records)
       2. Sets simulation.status = TRANSFERRED, simulation.transferredToId = newJournal.id
       3. Returns the created JournalEntry
       Constraint: only ACTIVE simulations can be converted
       Response: JournalEntryDetail

POST   /finance/simulations/:id/invalidate
       Sets status = INVALID
       Constraint: only ACTIVE simulations can be invalidated
       Response: SimulationDetail

DELETE /finance/simulations/:id
       Hard delete (simulations are analytical, not audited)
       Constraint: only ACTIVE or INVALID simulations can be deleted (not TRANSFERRED)
       Response: 204 No Content
```

Permission: `finance.simulations.view`, `finance.simulations.edit`, `finance.simulations.convert`

### 3.4 Zod Schemas

```typescript
// simulations.schema.ts
export const SIMULATION_STATUSES = ['ACTIVE', 'TRANSFERRED', 'INVALID'] as const;

const simulationLineInputSchema = z.object({
  accountCode: z.string().min(1).max(20),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
  vatCode: z.string().max(20).optional(),
  dimensionValues: z.array(z.object({
    dimensionTypeId: z.string().uuid(),
    dimensionValueId: z.string().uuid(),
  })).optional(),
});

export const createSimulationSchema = z.object({
  transactionDate: z.string().date(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  periodId: z.string().uuid(),
  lines: z.array(simulationLineInputSchema).min(2, 'At least two lines required'),
});

export const updateSimulationSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).nullable().optional(),
  lines: z.array(simulationLineInputSchema).min(2).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});

export const listSimulationsQuerySchema = z.object({
  status: z.enum(SIMULATION_STATUSES).optional(),
  periodId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
```

### 3.5 Report Integration

All report query schemas gain:

```typescript
includeSimulations: z.coerce.boolean().default(false).optional(),
```

When `includeSimulations=true`:

1. The report service queries `SimulationLine` for ACTIVE simulations in the same period range
2. Simulation line amounts are aggregated alongside real journal line amounts
3. Response includes a `simulationsIncluded: boolean` flag
4. For TB/P&L/BS: simulation amounts shown in a separate column or clearly labelled

**Implementation approach:** Add a helper function `getSimulationLineAggregations(prisma, companyId, periodIds)` that mirrors the existing `JournalLine.groupBy` pattern but queries `SimulationLine` joined to `Simulation` where `status = ACTIVE`.

### 3.6 UI Pages

#### Page: Simulations List (T2 -- List Page)

- Route: `/finance/simulations`
- Columns: Entry Number, Date, Description, Reference, Status (colour-coded badge), Total Debit, Total Credit
- Filters: Status dropdown (ACTIVE/TRANSFERRED/INVALID)
- Actions: New Simulation (primary), Convert to Journal (on ACTIVE rows), Invalidate, Delete
- Transferred simulations show a link to the created journal entry

#### Page: Simulation Form (T3 -- Form Page)

- Route: `/finance/simulations/new` and `/finance/simulations/:id`
- Layout: mirrors the Journal Entry form exactly
- Header fields: Transaction Date (date picker), Description, Reference, Period (dropdown)
- Lines table: Account Code (autocomplete), Description, Debit, Credit, VAT Code, Dimensions (multi-select per configured types)
- Running totals bar at bottom: Total Debit, Total Credit, Difference (highlighted red if non-zero)
- Action bar: Save Draft, Convert to Journal (on existing ACTIVE), Invalidate

---

## 4. Feature 3: Budget Redesign

### 4.1 Current State

The current budget system uses:
- `Budget` model with `budgetType` field (ANNUAL or REVISED) and `originalBudgetId` for linking revised to original
- `BudgetLine` with 12 period columns + totalAmount
- No versioning beyond the ANNUAL/REVISED distinction
- No dimensional budget splits
- No budget keys (allocation patterns)

### 4.2 Design: Budget Versions

Replace the `budgetType`/`originalBudgetId` pattern with a proper versioning system.

#### New Model: BudgetVersion

```prisma
model BudgetVersion {
  id                  String   @id @default(uuid()) @map("id")
  companyId           String   @map("company_id")
  fiscalYear          Int      @map("fiscal_year")
  versionNumber       Int      @map("version_number")
  versionName         String   @map("version_name") @db.VarChar(100)
  copiedFromVersionId String?  @map("copied_from_version_id")
  isActive            Boolean  @default(true) @map("is_active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  createdBy           String   @map("created_by")

  copiedFromVersion BudgetVersion?  @relation("VersionCopy", fields: [copiedFromVersionId], references: [id])
  copiedToVersions  BudgetVersion[] @relation("VersionCopy")
  budgets           Budget[]

  @@unique([companyId, fiscalYear, versionNumber], name: "uq_budget_version_company_year_number")
  @@index([companyId])
  @@index([companyId, fiscalYear])
  @@map("budget_versions")
}
```

#### Budget Model Changes

```prisma
model Budget {
  // ... existing fields ...
  budgetVersionId String?  @map("budget_version_id")  // NEW -- nullable for migration
  // budgetType and originalBudgetId remain for backward compat during migration
  // but budgetVersionId is the forward-looking FK

  budgetVersion BudgetVersion? @relation(fields: [budgetVersionId], references: [id])
  // ... existing relations ...
}
```

#### Migration Strategy

1. Add `BudgetVersion` table and `budgetVersionId` column (nullable) to `Budget`
2. Migration script: for each existing budget, create a BudgetVersion:
   - ANNUAL budgets -> version 1 "Original Budget"
   - REVISED budgets -> version 2 "Revised Budget", `copiedFromVersionId` = version 1's id
3. Set `budgetVersionId` on all existing budgets
4. Future: make `budgetVersionId` required, deprecate `budgetType`/`originalBudgetId`

### 4.3 Design: Budget Keys

Budget Keys are predefined allocation patterns for distributing an annual amount across 12 periods.

#### New Model: BudgetKey

```prisma
model BudgetKey {
  id        String   @id @default(uuid()) @map("id")
  companyId String   @map("company_id")
  name      String   @map("name") @db.VarChar(100)
  pct1      Decimal  @map("pct_1") @db.Decimal(7, 4)
  pct2      Decimal  @map("pct_2") @db.Decimal(7, 4)
  pct3      Decimal  @map("pct_3") @db.Decimal(7, 4)
  pct4      Decimal  @map("pct_4") @db.Decimal(7, 4)
  pct5      Decimal  @map("pct_5") @db.Decimal(7, 4)
  pct6      Decimal  @map("pct_6") @db.Decimal(7, 4)
  pct7      Decimal  @map("pct_7") @db.Decimal(7, 4)
  pct8      Decimal  @map("pct_8") @db.Decimal(7, 4)
  pct9      Decimal  @map("pct_9") @db.Decimal(7, 4)
  pct10     Decimal  @map("pct_10") @db.Decimal(7, 4)
  pct11     Decimal  @map("pct_11") @db.Decimal(7, 4)
  pct12     Decimal  @map("pct_12") @db.Decimal(7, 4)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")

  @@unique([companyId, name], name: "uq_budget_key_company_name")
  @@index([companyId])
  @@map("budget_keys")
}
```

**Validation:** `pct1 + pct2 + ... + pct12` must equal `100.0000`.

**Default seed data:**

| Name | Distribution |
|------|-------------|
| Even Split | 8.3333% x 12 (last period absorbs rounding) |
| Seasonal (Retail) | Higher in Nov-Dec (15% each), lower in Jan-Feb (5% each) |
| Q1 Heavy | 15% x 3 for Q1, 6.875% x 8 for Q2-Q4 (last absorbs rounding) |

#### Usage Flow

1. User creates a budget line for account 4000 with annual amount 120,000
2. User selects Budget Key "Even Split"
3. System distributes: period1-12 = 10,000 each
4. User can manually adjust individual periods after distribution

### 4.4 Design: Dimensional Budget Splits

Allow a budget line to be broken down by dimension values.

#### New Model: BudgetLineDimension

```prisma
model BudgetLineDimension {
  id               String   @id @default(uuid()) @map("id")
  budgetLineId     String   @map("budget_line_id")
  dimensionTypeId  String   @map("dimension_type_id")
  dimensionValueId String   @map("dimension_value_id")
  period1          Decimal  @default(0) @map("period_1") @db.Decimal(19, 4)
  period2          Decimal  @default(0) @map("period_2") @db.Decimal(19, 4)
  period3          Decimal  @default(0) @map("period_3") @db.Decimal(19, 4)
  period4          Decimal  @default(0) @map("period_4") @db.Decimal(19, 4)
  period5          Decimal  @default(0) @map("period_5") @db.Decimal(19, 4)
  period6          Decimal  @default(0) @map("period_6") @db.Decimal(19, 4)
  period7          Decimal  @default(0) @map("period_7") @db.Decimal(19, 4)
  period8          Decimal  @default(0) @map("period_8") @db.Decimal(19, 4)
  period9          Decimal  @default(0) @map("period_9") @db.Decimal(19, 4)
  period10         Decimal  @default(0) @map("period_10") @db.Decimal(19, 4)
  period11         Decimal  @default(0) @map("period_11") @db.Decimal(19, 4)
  period12         Decimal  @default(0) @map("period_12") @db.Decimal(19, 4)
  totalAmount      Decimal  @default(0) @map("total_amount") @db.Decimal(19, 4)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  budgetLine     BudgetLine     @relation(fields: [budgetLineId], references: [id], onDelete: Cascade)
  dimensionType  DimensionType  @relation(fields: [dimensionTypeId], references: [id])
  dimensionValue DimensionValue @relation(fields: [dimensionValueId], references: [id])

  @@unique([budgetLineId, dimensionTypeId, dimensionValueId], name: "uq_budget_line_dimension")
  @@index([budgetLineId])
  @@map("budget_line_dimensions")
}
```

**Relations to add:**
- `BudgetLine.dimensionSplits BudgetLineDimension[]`
- `DimensionType.budgetLineDimensions BudgetLineDimension[]`
- `DimensionValue.budgetLineDimensions BudgetLineDimension[]`

**Constraint:** For a given budget line and dimension type, the sum of all `BudgetLineDimension.period{N}` values must equal the parent `BudgetLine.period{N}`. Validated server-side on save.

### 4.5 Budget API Changes

#### Budget Version APIs

```
GET    /finance/budget-versions
       Query: { fiscalYear?: number, cursor?: string, limit?: number }
       Response: { data: BudgetVersion[], meta: PaginationMeta }

POST   /finance/budget-versions
       Body: { fiscalYear: number, versionName: string, copyFromVersionId?: string }
       Response: BudgetVersion
       If copyFromVersionId is provided: copies all budgets + lines from that version

PATCH  /finance/budget-versions/:id
       Body: Partial<{ versionName, isActive }>
       Response: BudgetVersion

GET    /finance/budget-versions/:id
       Response: BudgetVersion (with budget count)
```

#### Budget Key APIs

```
GET    /finance/budget-keys
       Query: { isActive?: boolean, cursor?: string, limit?: number }
       Response: { data: BudgetKey[], meta: PaginationMeta }

POST   /finance/budget-keys
       Body: { name: string, pct1-pct12: number }
       Validation: percentages must sum to 100
       Response: BudgetKey

PATCH  /finance/budget-keys/:id
       Body: Partial<{ name, pct1-pct12, isActive }>
       Response: BudgetKey

DELETE /finance/budget-keys/:id
       Response: 204 No Content

POST   /finance/budget-keys/:id/apply
       Body: { budgetLineId: string, annualAmount: number }
       Response: { period1-12: number } (calculated distribution, NOT saved -- client applies)
```

#### Budget Dimension Split APIs

```
GET    /finance/budgets/:budgetId/lines/:lineId/dimension-splits
       Query: { dimensionTypeId?: string }
       Response: BudgetLineDimension[]

PUT    /finance/budgets/:budgetId/lines/:lineId/dimension-splits
       Body: { dimensionTypeId: string, splits: Array<{ dimensionValueId, period1-12 }> }
       Validation: split totals must equal parent line totals per period
       Response: BudgetLineDimension[]

DELETE /finance/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId
       Removes all splits for that dimension type on that line
       Response: 204 No Content
```

#### Updated Create/Update Budget Schema

```typescript
export const createBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  fiscalYear: z.number().int().min(2000).max(2100),
  budgetVersionId: z.string().uuid().optional(), // NEW
  budgetType: z.enum(BUDGET_TYPES).default('ANNUAL'), // kept for backward compat
  description: z.string().max(1000).optional(),
  lines: z.array(budgetLineInputSchema).min(1),
});
```

### 4.6 Budget Variance Report Enhancement

The existing Budget Variance report (`GET /finance/reports/budget-variance`) gains:

```typescript
export const budgetVarianceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  budgetId: z.string().uuid().optional(),
  budgetVersionId: z.string().uuid().optional(),    // NEW: filter by version
  dimensionTypeId: z.string().uuid().optional(),     // NEW: dimension filter
  dimensionValueId: z.string().uuid().optional(),    // NEW: dimension filter
  includeSimulations: z.coerce.boolean().optional(), // NEW: include simulations
});
```

When `budgetVersionId` is provided but `budgetId` is not, the report aggregates all budgets in that version. When dimension filters are provided, both the budget amounts (from `BudgetLineDimension`) and actual amounts (from `JournalLineDimension`) are filtered.

### 4.7 UI Changes

#### Budget Form Enhancement

The existing Budget form at `/finance/budgets/new` and `/finance/budgets/:id` gains:

1. **Version selector** -- dropdown showing available BudgetVersions for the selected fiscal year
2. **Budget Key** quick-apply -- button on each line row that opens a popover:
   - Select a Budget Key from dropdown
   - Enter annual amount
   - Click Apply -> periods filled
3. **Dimension split** -- expandable row action:
   - Click "Split by Dimension" on a line row
   - Modal: select dimension type, shows all active values as sub-rows
   - User distributes the line's period amounts across dimension values
   - Total per period must match parent -- validation shown inline

#### Settings: Budget Versions Section

- Nested within Finance Settings, new tab "Budgets"
- Year selector dropdown -> shows versions for that year
- Table: Version Number, Version Name, Copied From, Created, Budget Count
- Actions: New Version (primary), Copy Version, Rename

#### Settings: Budget Keys Section

- Table: Name, P1-P12 percentages, Total (should be 100%), Active
- Actions: New Key (primary), Edit, Delete
- Inline validation: total must equal 100%

---

## 5. Feature 4: Missing Settings

### 5.1 Current Settings Structure

Finance Settings uses the `SystemSetting` table with `category = FINANCE` and 8 tabs: general, vat, subSystems, tags, dataEntry, reconciliation, multiCurrency, reporting.

### 5.2 New Settings Tabs

#### Tab: Dimensions

Added to the existing settings schema:

```typescript
export const dimensionsSettingsSchema = z.object({
  enableDimensions: z.boolean().default(false),
  requireDimensionsOnManualJournals: z.boolean().default(false),
  defaultDimensionBehavior: z.enum(['NONE', 'SUGGEST', 'REQUIRE']).default('NONE'),
  maxDimensionTypes: z.number().int().min(1).max(20).default(10),
});
```

This tab controls global dimension behavior. Individual dimension type enable/disable is handled through the DimensionType `isActive` flag.

#### Tab: Approvals

```typescript
export const approvalsSettingsSchema = z.object({
  journalApprovalEnabled: z.boolean().default(false),
  journalApprovalThreshold: z.number().min(0).default(10000),
  budgetApprovalRequired: z.boolean().default(true),
  yearEndApprovalRequired: z.boolean().default(true),
});
```

When `journalApprovalEnabled=true` and a journal's totalDebit exceeds `journalApprovalThreshold`, the journal cannot be posted without approval (future enhancement -- sets the stage).

#### Tab: Number Series

```typescript
export const numberSeriesSettingsSchema = z.object({
  journalPrefix: z.string().max(10).default('JNL'),
  journalPadding: z.number().int().min(4).max(10).default(5),
  simulationPrefix: z.string().max(10).default('SIM'),
  simulationPadding: z.number().int().min(4).max(10).default(5),
  budgetPrefix: z.string().max(10).default('BDG'),
  budgetPadding: z.number().int().min(4).max(10).default(5),
});
```

This provides a UI for configuring the NumberSeries entries for finance documents. Under the hood, changes update the NumberSeries table.

#### Tab: Rounding

```typescript
export const roundingSettingsSchema = z.object({
  currencyRoundingMethod: z.enum(['HALF_UP', 'HALF_EVEN', 'CEILING', 'FLOOR']).default('HALF_UP'),
  displayDecimals: z.number().int().min(0).max(4).default(2),
  internalDecimals: z.number().int().min(2).max(4).default(4),
});
```

### 5.3 Updated Settings Schema

```typescript
export const financeSettingsSchema = z.object({
  general: generalSettingsSchema,
  vat: vatSettingsSchema,
  subSystems: subSystemsSettingsSchema,
  tags: tagsSettingsSchema,
  dimensions: dimensionsSettingsSchema,        // NEW
  dataEntry: dataEntrySettingsSchema,
  approvals: approvalsSettingsSchema,           // NEW
  reconciliation: reconciliationSettingsSchema,
  multiCurrency: multiCurrencySettingsSchema,
  numberSeries: numberSeriesSettingsSchema,     // NEW
  rounding: roundingSettingsSchema,             // NEW
  reporting: reportingSettingsSchema,
});
```

The `TAB_NAMES` array in `settings.service.ts` gains four new entries. The `FINANCE_DEFAULTS` object gains four new sections.

### 5.4 UI: Settings Page Updates

The existing Finance Settings page at `/finance/settings` currently shows 8 tabs. It gains 4 new tabs in the sidebar:
- Dimensions (between Tags and Data Entry)
- Approvals (after Data Entry)
- Number Series (after Multi-Currency)
- Rounding (after Number Series, before Reporting)

Each new tab follows the same form pattern as existing tabs: form fields with Save and Reset buttons.

---

## 6. Feature 5: Missing Reports

### 6.1 New Report: GL Detail / Account Activity

**Purpose:** Shows all individual postings for a single account with a running balance. This is the drill-down from Trial Balance (click an account row -> see all transactions).

```
GET /finance/reports/gl-detail
    Query: { fiscalYear, periodFrom?, periodTo?, accountCode }
    Response: GLDetailResponse
```

```typescript
export const glDetailQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCode: z.string().min(1).max(20),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});

export const glDetailResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accountCode: z.string(),
  accountName: z.string(),
  openingBalance: z.number(),
  entries: z.array(z.object({
    journalEntryId: z.string(),
    entryNumber: z.string(),
    transactionDate: z.string(),
    description: z.string(),
    reference: z.string().nullable(),
    source: z.string(),
    debit: z.number(),
    credit: z.number(),
    runningBalance: z.number(),
    isSimulation: z.boolean(),
    dimensions: z.array(z.object({
      dimensionTypeName: z.string(),
      dimensionValueName: z.string(),
    })),
  })),
  closingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
});
```

**UI Page:** `/finance/reports/gl-detail`
- Account selector (autocomplete) + fiscal year + period range
- Table: Date, Entry Number, Description, Reference, Source, Debit, Credit, Running Balance
- Click entry number -> navigates to journal detail
- Also accessible via TB drill-down (click account row in Trial Balance)

### 6.2 New Report: General Ledger

**Purpose:** Full GL listing for ALL accounts in a period range. Essentially a multi-account version of GL Detail.

```
GET /finance/reports/general-ledger
    Query: { fiscalYear, periodFrom?, periodTo?, accountCodeFrom?, accountCodeTo?,
             dimensionTypeId?, dimensionValueId?, includeSimulations? }
    Response: GeneralLedgerResponse
```

```typescript
export const generalLedgerResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accounts: z.array(z.object({
    accountCode: z.string(),
    accountName: z.string(),
    accountType: z.string(),
    openingBalance: z.number(),
    entries: z.array(z.object({
      entryNumber: z.string(),
      transactionDate: z.string(),
      description: z.string(),
      debit: z.number(),
      credit: z.number(),
      runningBalance: z.number(),
    })),
    closingBalance: z.number(),
    totalDebit: z.number(),
    totalCredit: z.number(),
  })),
  grandTotals: z.object({
    totalDebit: z.number(),
    totalCredit: z.number(),
  }),
});
```

**UI Page:** `/finance/reports/general-ledger`
- Account range (from/to), fiscal year, period range
- Grouped by account: each account section shows its entries, subtotals
- Collapsible account sections

### 6.3 New Report: Cash Flow Statement

**Purpose:** Operating, investing, and financing activities (simplified indirect method for MVP).

```
GET /finance/reports/cash-flow
    Query: { fiscalYear, periodFrom?, periodTo? }
    Response: CashFlowResponse
```

```typescript
export const cashFlowResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  operating: z.object({
    netProfit: z.number(),
    adjustments: z.array(z.object({ label: z.string(), amount: z.number() })),
    total: z.number(),
  }),
  investing: z.object({
    items: z.array(z.object({ label: z.string(), amount: z.number() })),
    total: z.number(),
  }),
  financing: z.object({
    items: z.array(z.object({ label: z.string(), amount: z.number() })),
    total: z.number(),
  }),
  netChange: z.number(),
  openingCash: z.number(),
  closingCash: z.number(),
});
```

**Implementation approach:**
- Operating: Start with net profit from P&L, add back non-cash items (depreciation accounts)
- Investing: Sum movements in fixed asset accounts (identified by AccountClassification)
- Financing: Sum movements in loan/equity accounts
- Account classification mapping: use `AccountClassification.code` to determine which section an account's movements belong to. New classification codes needed: `FA` (Fixed Assets), `LOAN` (Loans), `EQUITY_MOV` (Equity Movements).
- Opening/closing cash: sum of bank account GL codes' balances

**UI Page:** `/finance/reports/cash-flow`
- Fiscal year + period range selectors
- Three collapsible sections: Operating, Investing, Financing
- Summary bar: Net Change, Opening Cash, Closing Cash

### 6.4 Existing Report Enhancements

All 5 existing report endpoints gain these optional query params:

| Parameter | Type | Reports |
|-----------|------|---------|
| `dimensionTypeId` | uuid | TB, P&L, BS, TJ, BV |
| `dimensionValueId` | uuid | TB, P&L, BS, TJ, BV |
| `includeSimulations` | boolean | TB, P&L, BS, TJ, BV |
| `budgetVersionId` | uuid | BV only |

Implementation is described in sections 2.5, 3.5, and 4.6.

### 6.5 UI: Report Page Template Updates

All report pages gain:
1. **Dimension filter** -- two cascading dropdowns: Dimension Type -> Dimension Value
2. **Include Simulations** toggle (switch)
3. **Export** buttons (see Feature 6)

Budget Variance page gains:
4. **Budget Version** dropdown alongside the existing Budget selector

---

## 7. Feature 6: Exports and Imports

### 7.1 Export Architecture

#### Approach

Add export endpoints as variants of existing report/list endpoints. Use `csv-stringify` for CSV and `exceljs` for Excel.

```
GET /finance/reports/{report}/export
    Query: { ...existing report params..., format: 'csv' | 'excel' }
    Response: file download (Content-Type: text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
    Content-Disposition: attachment; filename="{report}-{date}.{ext}"
```

#### Exportable Endpoints

| Endpoint | Source |
|----------|--------|
| `/finance/reports/trial-balance/export` | TB data |
| `/finance/reports/profit-and-loss/export` | P&L data |
| `/finance/reports/balance-sheet/export` | BS data |
| `/finance/reports/transaction-journal/export` | TJ data |
| `/finance/reports/budget-variance/export` | BV data |
| `/finance/reports/gl-detail/export` | GL Detail data |
| `/finance/reports/general-ledger/export` | General Ledger data |
| `/finance/reports/departmental-pnl/export` | Dept P&L data |
| `/finance/reports/cost-centre/export` | Cost Centre data |
| `/finance/reports/project-profitability/export` | Project data |
| `/finance/reports/cash-flow/export` | Cash Flow data |
| `/finance/accounts/export` | Chart of Accounts list |
| `/finance/journals/export` | Journal list |
| `/finance/bank-accounts/export` | Bank accounts list |
| `/finance/budgets/export` | Budget list |

#### Export Service

```typescript
// export.service.ts
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'number' | 'currency' | 'date' | 'percentage';
}

export async function generateCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const headers = columns.map(c => c.header);
  const data = rows.map(row => columns.map(c => row[c.key]));
  return Buffer.from(stringify([headers, ...data]));
}

export async function generateExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 15,
  }));
  for (const row of rows) {
    sheet.addRow(row);
  }
  // Format currency columns
  for (const col of columns) {
    if (col.format === 'currency') {
      const excelCol = sheet.getColumn(col.key);
      excelCol.numFmt = '#,##0.00';
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
```

#### Zod Schema

```typescript
export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
});
```

### 7.2 Import Architecture

#### Endpoints

```
POST /finance/accounts/import
     Content-Type: multipart/form-data
     Body: file (CSV), options: { skipHeader?: boolean, updateExisting?: boolean }
     Response: { imported: number, skipped: number, errors: Array<{ row, message }> }

POST /finance/journals/import
     Content-Type: multipart/form-data
     Body: file (CSV), options: { skipHeader?: boolean, autoPost?: boolean }
     Response: { imported: number, errors: Array<{ row, message }> }

POST /finance/budgets/import
     Content-Type: multipart/form-data
     Body: file (CSV/Excel), options: { budgetId?: string, fiscalYear: number }
     Response: { imported: number, errors: Array<{ row, message }> }

POST /finance/exchange-rates/import
     Content-Type: multipart/form-data
     Body: file (CSV), options: { skipHeader?: boolean }
     Response: { imported: number, errors: Array<{ row, message }> }
```

Permission: `finance.{resource}.import`

#### Import CSV Formats

**Accounts import:**
```csv
code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable
1000,Cash at Bank,ASSET,DEBIT,,CA,,true
1100,Petty Cash,ASSET,DEBIT,1000,CA,,true
```

**Journals import:**
```csv
transactionDate,description,reference,accountCode,debit,credit,vatCode
2026-01-15,Office supplies,INV-001,4200,500.00,0,S1
2026-01-15,Office supplies,INV-001,2100,0,500.00,S1
```
Lines with the same date+description+reference are grouped into a single journal entry.

**Budget import:**
```csv
accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12
4000,10000,10000,10000,10000,10000,10000,10000,10000,10000,10000,10000,10000
```

**Exchange rates import:**
```csv
currencyCode,rateDate,buyRate,sellRate,midRate,source
EUR,2026-01-01,0.8520,0.8580,0.8550,MANUAL
USD,2026-01-01,0.7820,0.7880,0.7850,MANUAL
```

#### Import Service

```typescript
// import.service.ts
import { parse } from 'csv-parse/sync';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export function parseCsv(buffer: Buffer, options?: { skipHeader?: boolean }): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    from: options?.skipHeader ? 2 : 1,
  });
}
```

Each import endpoint:
1. Parses the uploaded file
2. Validates each row against the expected schema
3. Processes valid rows in batches of 100 (within transactions)
4. Collects errors for invalid rows
5. Returns summary with error details

### 7.3 UI: Export Buttons

All report pages have disabled Export CSV / Export Excel buttons in the action bar (from Phase 1 page stubs). Wire these up:

```typescript
// In report page action bar
<Button onClick={() => handleExport('csv')}>Export CSV</Button>
<Button onClick={() => handleExport('excel')}>Export Excel</Button>

// Handler
async function handleExport(format: 'csv' | 'excel') {
  const params = new URLSearchParams({ ...currentFilters, format });
  const response = await fetch(`/api/finance/reports/${reportName}/export?${params}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportName}-${new Date().toISOString().slice(0,10)}.${format === 'csv' ? 'csv' : 'xlsx'}`;
  a.click();
}
```

### 7.4 UI: Import Pages

New page: `/finance/import`

- Tabbed interface: Accounts | Journals | Budgets | Exchange Rates
- Each tab:
  1. Download template (CSV with correct headers, no data)
  2. File upload area (drag-and-drop)
  3. Options (skip header, auto-post for journals, etc.)
  4. Preview table showing first 10 rows
  5. Import button
  6. Results: imported count, skipped count, error table

---

## 8. Feature 7: Skill Improvements

### 8.1 User Persona Checklist (specops-module-build enhancement)

**Integration point:** After story definition, before packet generation in the `specops-module-build` skill.

**Implementation:**

Add a checklist step that, for each finance persona, lists expected tasks and maps them to existing pages/APIs:

| Persona | Example Tasks |
|---------|---------------|
| **Financial Controller** | Approve journals, review month-end, sign off year-end, review budget variance, approve budgets, configure approval thresholds, review cash flow |
| **Accountant** | Post journals, reconcile bank, prepare VAT return, create budgets, run P&L/BS/TB, manage chart of accounts, process opening balances |
| **Bookkeeper** | Enter journals, import bank transactions, match transactions, enter expense claims, run daily reports |
| **Admin** | Configure settings, manage dimension types, manage budget keys, set up number series, import data |

This is a documentation/skill-only change -- no code in the ERP codebase.

### 8.2 Test Data Seeder Skill

**New skill:** `specops-validate-module`

**What it does:**
1. Seeds realistic test data for the finance module:
   - 50+ chart of accounts (full UK GAAP template)
   - 12 months of financial periods
   - 3 dimension types (Department, Cost Centre, Project) with 5+ values each
   - 200+ journal entries across all 12 periods with dimension assignments
   - 3 bank accounts with 50+ transactions each
   - 2 budget versions with budget lines
   - 5 simulations
2. Runs all report APIs and verifies:
   - Trial balance is balanced
   - P&L net profit matches expected
   - Balance sheet balances (assets = liabilities + equity)
   - Budget variance totals are consistent
   - Dimension-filtered reports are subsets of unfiltered reports
3. Tests business rule enforcement:
   - Post to closed period (should fail)
   - Post to control account manually (should fail)
   - Missing required dimension (should fail)
   - Single-select dimension violation (should fail)
4. Outputs pass/fail report

This is a skill file, not ERP code. Location: `.claude/skills/specops-core/specops-validate-module/SKILL.md`

### 8.3 Chrome Extension Testing

**Documentation:** Add a section to the module build skill documenting:
1. Chrome MCP extension setup requirements
2. Testing flow: navigate to page, verify elements render, fill forms, submit, verify success
3. CRUD verification pattern for each entity type

This is documentation/skill only.

---

## 9. Dependencies and Build Order

### 9.1 New npm Dependencies

| Package | Purpose | Install location |
|---------|---------|-----------------|
| `csv-stringify` | CSV generation for exports | `apps/api` |
| `csv-parse` | CSV parsing for imports | `apps/api` |
| `exceljs` | Excel generation/parsing for exports + budget import | `apps/api` |

### 9.2 Database Migration Order

All schema changes in a single migration (or two if needed for safety):

**Migration 1: New tables and columns**
1. Add `SimulationStatus` enum
2. Add `Simulation` table
3. Add `SimulationLine` table
4. Add `BudgetVersion` table
5. Add `BudgetKey` table
6. Add `BudgetLineDimension` table
7. Add `budgetVersionId` column to `Budget` (nullable)
8. Add reverse relations on `FinancialPeriod`, `JournalEntry`, `ChartOfAccount`

**Migration 2: Data migration (after code deploys)**
1. Create BudgetVersion records from existing budgets
2. Set `budgetVersionId` on existing budgets

### 9.3 Story Build Order (DB -> API -> Frontend)

```
Wave 1: Database (1 story)
  DB-1: Prisma schema changes -- all new models + migration

Wave 2: API -- Dimensions (2 stories)
  API-1: Dimension Types + Values CRUD (routes, service, schema, tests)
  API-2: Dimension Requirements + Defaults CRUD (routes, service, schema, tests)

Wave 3: API -- Simulations (2 stories)
  API-3: Simulations CRUD (routes, service, schema, tests)
  API-4: Simulation convert + invalidate + report integration (service, tests)

Wave 4: API -- Budget Redesign (3 stories)
  API-5: Budget Versions CRUD (routes, service, schema, tests)
  API-6: Budget Keys CRUD + apply (routes, service, schema, tests)
  API-7: Budget Dimension Splits CRUD + validation (routes, service, schema, tests)

Wave 5: API -- Reports + Settings (3 stories)
  API-8: GL Detail + General Ledger reports (service, routes, tests)
  API-9: Departmental P&L + Cost Centre + Project Profitability reports (service, routes, tests)
  API-10: Cash Flow Statement + dimension/simulation filters on existing reports (service, routes, tests)
  API-11: Settings expansion -- 4 new tabs (schema, service update, routes, tests)

Wave 6: API -- Exports + Imports (2 stories)
  API-12: Export service + export endpoints for all reports + lists
  API-13: Import service + import endpoints (accounts, journals, budgets, rates)

Wave 7: Frontend -- Dimensions + Simulations (3 stories)
  FE-1: Dimension Types + Values pages (list, form, tree view)
  FE-2: Dimension Requirements + Defaults pages
  FE-3: Simulations list + form pages

Wave 8: Frontend -- Budget + Settings + Reports (4 stories)
  FE-4: Budget form enhancements (version selector, budget key apply, dimension split modal)
  FE-5: Budget Versions + Budget Keys settings sections
  FE-6: New report pages (GL Detail, General Ledger, Cash Flow, Dept P&L, Cost Centre, Project)
  FE-7: Report enhancements (dimension filter, simulation toggle, export buttons)

Wave 9: Frontend -- Import + Polish (2 stories)
  FE-8: Import page (tabbed, file upload, preview, results)
  FE-9: Settings page -- 4 new tabs + wiring

Wave 10: Skill improvements (non-code)
  SKILL-1: User persona checklist addition to specops-module-build
  SKILL-2: specops-validate-module skill creation
  SKILL-3: Chrome extension testing documentation
```

**Total: ~22 stories across 10 waves**

### 9.4 Parallelisation Opportunities

Within each wave, stories are independent and can run in parallel:
- Wave 2: API-1 and API-2 are independent
- Wave 4: API-5, API-6, API-7 are independent
- Wave 5: API-8, API-9, API-10, API-11 are independent
- Wave 6: API-12 and API-13 are independent
- Wave 7: FE-1, FE-2, FE-3 are independent
- Wave 8: FE-4, FE-5, FE-6, FE-7 are independent (though FE-7 depends on FE-6's report pages existing)
- Wave 10: All skills are independent

---

## 10. Risk and Mitigation

| Risk | Mitigation |
|------|-----------|
| Budget migration breaks existing data | Migration script tested against prod snapshot first; `budgetVersionId` is nullable so old budgets work without versions |
| Report performance with dimension joins | Use `DimensionBalance` table for pre-aggregated data where possible; add DB indexes on dimension filter paths |
| Excel export memory for large reports | Stream-based Excel generation with ExcelJS; add row limit (10,000 rows max per export) |
| Import validation edge cases | Dry-run mode (validate without saving); row-level error reporting; batch processing with rollback per batch |
| Cash Flow classification accuracy | Start simple (classification-based), allow manual overrides in future; clearly label as "simplified" in UI |

---

## 11. Acceptance Criteria Summary

### F1: Dimensions
- [ ] CRUD APIs for DimensionType, DimensionValue, DimensionRequirement, DimensionDefault all return correct responses
- [ ] DimensionValue hierarchy enforced (max 5 levels, same type constraint)
- [ ] DimensionRequirement range validation works (accountCodeFrom <= accountCodeTo)
- [ ] All 4 dimension management pages render and function

### F2: Simulations
- [ ] Create, update, delete simulations with balanced lines
- [ ] Convert ACTIVE simulation to DRAFT journal entry (lines + dimensions transferred)
- [ ] Invalidate simulations
- [ ] Reports with `includeSimulations=true` include ACTIVE simulation data
- [ ] Simulation list and form pages function correctly

### F3: Budgets
- [ ] BudgetVersion CRUD works; versions are per fiscal year with sequential numbering
- [ ] Copy version creates new version with all budgets + lines copied
- [ ] BudgetKey CRUD works; percentages validate to sum = 100
- [ ] Apply budget key distributes annual amount across 12 periods correctly
- [ ] BudgetLineDimension splits validate: period sums match parent line
- [ ] Budget Variance report accepts version + dimension filters

### F4: Settings
- [ ] 4 new settings tabs (Dimensions, Approvals, Number Series, Rounding) save and load correctly
- [ ] Default values applied for new companies
- [ ] Reset returns all tabs to defaults

### F5: Reports
- [ ] GL Detail shows all postings for single account with running balance
- [ ] General Ledger shows all accounts with entries in period range
- [ ] Cash Flow Statement shows operating/investing/financing with correct totals
- [ ] Departmental P&L, Cost Centre, Project Profitability show columnar dimension breakdowns
- [ ] All existing reports accept dimension filters and simulation toggle

### F6: Exports/Imports
- [ ] CSV export downloads correctly formatted file for all report + list endpoints
- [ ] Excel export downloads formatted .xlsx with currency formatting
- [ ] Account import creates/updates accounts from CSV
- [ ] Journal import creates journal entries, grouping lines by date+description+reference
- [ ] Budget import creates budget lines from CSV/Excel
- [ ] Exchange rate import creates rate records from CSV
- [ ] All imports return row-level error details for invalid data

### F7: Skills
- [ ] User persona checklist documented and integrated into module build skill
- [ ] specops-validate-module skill file created with seeder + verification logic
- [ ] Chrome extension testing flow documented

# Finance Phase 2 Wave 5: Report Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance all 5 existing finance reports with dimension filtering, simulation inclusion, and budget version selection. Add 3 new reports: GL Detail, Departmental P&L, and General Ledger.

**Architecture:** Three stories executed in parallel (API-8, API-9, API-10) as specified in the design spec section 9.3. Each story adds schemas, service functions, routes, and tests following the established patterns in `reports.service.ts`, `reports.schema.ts`, and `reports.routes.ts`.

**Tech Stack:** Fastify 5, Zod, Prisma 7, PostgreSQL 17, TypeScript strict, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-01-fin-phase2-design.md` -- sections 2.5, 2.6, 3.5, 4.6, 6.1-6.4

**Depends on:**
- Wave 1 (DB-1): Prisma schema with Simulation, SimulationLine, BudgetVersion, BudgetLineDimension tables
- Wave 3 (API-3, API-4): Simulation CRUD and service (needed for `getSimulationLineAggregations` helper)
- Wave 4 (API-5): Budget Versions CRUD (needed for budget version selector in Budget Variance)

**Blocked by this plan:** Wave 8 FE-6 (new report pages), FE-7 (report filter enhancements), Wave 6 (export endpoints)

---

## File Structure

### New Files
```
(none -- all work modifies existing files)
```

### Modified Files
```
apps/api/src/modules/finance/reports.schema.ts       -- MODIFY: add new query/response schemas, extend existing query schemas
apps/api/src/modules/finance/reports.service.ts      -- MODIFY: add dimension filtering, simulation helpers, 3 new report functions, modify 5 existing functions
apps/api/src/modules/finance/reports.routes.ts       -- MODIFY: add 3 new route handlers, update existing handlers for new query params
apps/api/src/modules/finance/reports.routes.test.ts  -- MODIFY: add tests for dimension filtering + simulation toggle on TB
apps/api/src/modules/finance/reports-pnl-bs.routes.test.ts          -- MODIFY: add tests for dimension filtering + simulation toggle on P&L, BS
apps/api/src/modules/finance/reports-journal-variance.routes.test.ts -- MODIFY: add tests for dimension filtering on TJ + budget version on BV
apps/api/src/modules/finance/reports-new.routes.test.ts              -- CREATE: tests for GL Detail, General Ledger, Departmental P&L
```

### Reference Files (read-only)
```
docs/superpowers/specs/2026-04-01-fin-phase2-design.md  -- Design spec sections 2.5, 2.6, 3.5, 4.6, 6.1-6.4
packages/db/prisma/schema.prisma                        -- JournalLine, JournalLineDimension, DimensionBalance, DimensionType, DimensionValue, Simulation, SimulationLine models
```

### Protected Files (DO NOT MODIFY)
```
packages/db/src/client.ts
packages/db/src/index.ts
packages/db/src/services/number-series.service.ts
```

---

## Story API-8: GL Detail + General Ledger Reports

### Task 1: Add GL Detail Query and Response Schemas

**File:** `apps/api/src/modules/finance/reports.schema.ts`

- [ ] **Step 1: Read the current reports.schema.ts**

Read the full file to find the insertion point (after the Budget Variance schemas, before the type exports section).

- [ ] **Step 2: Add GL Detail query schema**

After the `budgetVarianceResponseSchema`, add:

```typescript
// ---------------------------------------------------------------------------
// GL Detail / Account Activity -- Query Schema
// ---------------------------------------------------------------------------

export const glDetailQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCode: z.string().min(1).max(20),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

- [ ] **Step 3: Add GL Detail response schema**

```typescript
// ---------------------------------------------------------------------------
// GL Detail / Account Activity -- Response Schemas
// ---------------------------------------------------------------------------

const glDetailDimensionSchema = z.object({
  dimensionTypeName: z.string(),
  dimensionValueName: z.string(),
});

const glDetailEntrySchema = z.object({
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
  dimensions: z.array(glDetailDimensionSchema),
});

export const glDetailResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accountCode: z.string(),
  accountName: z.string(),
  openingBalance: z.number(),
  entries: z.array(glDetailEntrySchema),
  closingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
});
```

- [ ] **Step 4: Add GL Detail TypeScript types to the exports section**

```typescript
export type GLDetailQuery = z.infer<typeof glDetailQuerySchema>;
export type GLDetailResponse = z.infer<typeof glDetailResponseSchema>;
```

### Task 2: Add General Ledger Query and Response Schemas

**File:** `apps/api/src/modules/finance/reports.schema.ts`

- [ ] **Step 1: Add General Ledger query schema**

After the GL Detail schemas:

```typescript
// ---------------------------------------------------------------------------
// General Ledger -- Query Schema
// ---------------------------------------------------------------------------

export const generalLedgerQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCodeFrom: z.string().max(20).optional(),
  accountCodeTo: z.string().max(20).optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

- [ ] **Step 2: Add General Ledger response schema**

```typescript
// ---------------------------------------------------------------------------
// General Ledger -- Response Schemas
// ---------------------------------------------------------------------------

const generalLedgerEntrySchema = z.object({
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  debit: z.number(),
  credit: z.number(),
  runningBalance: z.number(),
});

const generalLedgerAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  openingBalance: z.number(),
  entries: z.array(generalLedgerEntrySchema),
  closingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
});

export const generalLedgerResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accounts: z.array(generalLedgerAccountSchema),
  grandTotals: z.object({
    totalDebit: z.number(),
    totalCredit: z.number(),
  }),
});
```

- [ ] **Step 3: Add General Ledger TypeScript types to the exports section**

```typescript
export type GeneralLedgerQuery = z.infer<typeof generalLedgerQuerySchema>;
export type GeneralLedgerResponse = z.infer<typeof generalLedgerResponseSchema>;
```

### Task 3: Implement GL Detail Service Function

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Read the current reports.service.ts**

Read the full file. Note the patterns:
- Period lookup via `financialPeriod.findMany`
- Aggregation via `journalLine.groupBy`
- Account lookup via `chartOfAccount.findMany`
- `roundToFourDecimals` helper at the bottom
- All functions take `(prisma, companyId, query)` and return a typed response

- [ ] **Step 2: Add imports for the new types**

Update the import block at the top of `reports.service.ts`:

```typescript
import type {
  TrialBalanceQuery,
  TrialBalanceResponse,
  ReportQuery,
  ReportAccountLine,
  ReportSection,
  ProfitAndLossResponse,
  BalanceSheetResponse,
  TransactionJournalQuery,
  TransactionJournalResponse,
  BudgetVarianceQuery,
  BudgetVarianceResponse,
  GLDetailQuery,
  GLDetailResponse,
  GeneralLedgerQuery,
  GeneralLedgerResponse,
} from './reports.schema.js';
```

- [ ] **Step 3: Add the `getGLDetail` function**

Add before the Helpers section. This function:
1. Fetches the account by `accountCode` to get the name and opening balance
2. Fetches all periods in the range
3. Queries `JournalLine` entries for that account in those periods (via `journalEntry` join with `status: 'POSTED'`), ordered by `journalEntry.transactionDate` ASC, `lineNumber` ASC
4. For each line, includes the `JournalLineDimension` -> `DimensionValue` -> `DimensionType` to populate the `dimensions` array
5. When `dimensionValueId` is provided, filters lines through `JournalLineDimension` where `dimensionValueId` matches
6. When `includeSimulations=true`, queries `SimulationLine` for ACTIVE simulations and merges them in date order, marking `isSimulation: true`
7. Computes running balance: starts at `openingBalance`, adds debit - credit (for DEBIT normal) or credit - debit (for CREDIT normal) for each entry

```typescript
/**
 * GL Detail / Account Activity -- all postings for a single account with running balance.
 *
 * - Fetches individual JournalLine records (not aggregated) for the given account
 * - Includes dimension info per line (for drill-down context)
 * - Optionally filters by dimension value
 * - Optionally includes SimulationLine entries (marked isSimulation=true)
 * - Computes running balance per entry starting from the account's opening balance
 */
export async function getGLDetail(
  prisma: PrismaClient,
  companyId: string,
  query: GLDetailQuery,
): Promise<GLDetailResponse> {
  const { fiscalYear, periodFrom, periodTo, accountCode, dimensionTypeId, dimensionValueId, includeSimulations } = query;

  // 1. Fetch the account
  const account = await (prisma as any).chartOfAccount.findFirst({
    where: { companyId, code: accountCode, isActive: true },
    select: { code: true, name: true, normalBalance: true, openingBalance: true },
  });

  if (!account) {
    const error = new Error(`Account ${accountCode} not found`) as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Find periods in range
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  if (periodIds.length === 0) {
    const openingBalance = roundToFourDecimals(Number(account.openingBalance ?? 0));
    return {
      fiscalYear, periodFrom, periodTo,
      accountCode, accountName: account.name,
      openingBalance,
      entries: [],
      closingBalance: openingBalance,
      totalDebit: 0, totalCredit: 0,
    };
  }

  // 3. Build where clause for journal lines
  const lineWhere: Record<string, unknown> = {
    companyId,
    accountCode,
    journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
  };

  // Dimension filter: join through JournalLineDimension
  if (dimensionValueId) {
    lineWhere.dimensions = { some: { dimensionValueId } };
  }

  // 4. Fetch journal lines with entry info and dimensions
  const journalLines = await (prisma as any).journalLine.findMany({
    where: lineWhere,
    orderBy: [
      { journalEntry: { transactionDate: 'asc' } },
      { lineNumber: 'asc' },
    ],
    include: {
      journalEntry: {
        select: {
          id: true,
          entryNumber: true,
          transactionDate: true,
          description: true,
          reference: true,
          source: true,
        },
      },
      dimensions: {
        include: {
          dimensionValue: {
            select: {
              name: true,
              dimensionType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // 5. Build entries from journal lines
  type RawLine = {
    journalEntry: {
      id: string;
      entryNumber: string;
      transactionDate: Date | string;
      description: string;
      reference: string | null;
      source: string;
    };
    debit: unknown;
    credit: unknown;
    dimensions: Array<{
      dimensionValue: {
        name: string;
        dimensionType: { name: string };
      };
    }>;
  };

  const openingBalance = roundToFourDecimals(Number(account.openingBalance ?? 0));
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: GLDetailResponse['entries'] = [];

  for (const line of journalLines as RawLine[]) {
    const debit = roundToFourDecimals(Number(line.debit ?? 0));
    const credit = roundToFourDecimals(Number(line.credit ?? 0));

    // Running balance respects normal balance direction
    if (account.normalBalance === 'DEBIT') {
      runningBalance = roundToFourDecimals(runningBalance + debit - credit);
    } else {
      runningBalance = roundToFourDecimals(runningBalance + credit - debit);
    }

    totalDebit += debit;
    totalCredit += credit;

    const txDate = line.journalEntry.transactionDate instanceof Date
      ? line.journalEntry.transactionDate.toISOString().split('T')[0]
      : String(line.journalEntry.transactionDate);

    entries.push({
      journalEntryId: line.journalEntry.id,
      entryNumber: line.journalEntry.entryNumber,
      transactionDate: txDate,
      description: line.journalEntry.description,
      reference: line.journalEntry.reference,
      source: line.journalEntry.source,
      debit,
      credit,
      runningBalance,
      isSimulation: false,
      dimensions: line.dimensions.map((d) => ({
        dimensionTypeName: d.dimensionValue.dimensionType.name,
        dimensionValueName: d.dimensionValue.name,
      })),
    });
  }

  // 6. Optionally include simulation lines
  if (includeSimulations) {
    const simLines = await getSimulationLinesForAccount(prisma, companyId, periodIds, accountCode, dimensionValueId);
    // Merge sim lines into entries by date, then re-compute running balance
    for (const simLine of simLines) {
      entries.push(simLine);
    }
    // Sort all entries by date, then re-compute running balance from scratch
    entries.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    runningBalance = openingBalance;
    totalDebit = 0;
    totalCredit = 0;
    for (const entry of entries) {
      if (account.normalBalance === 'DEBIT') {
        runningBalance = roundToFourDecimals(runningBalance + entry.debit - entry.credit);
      } else {
        runningBalance = roundToFourDecimals(runningBalance + entry.credit - entry.debit);
      }
      entry.runningBalance = runningBalance;
      totalDebit += entry.debit;
      totalCredit += entry.credit;
    }
  }

  totalDebit = roundToFourDecimals(totalDebit);
  totalCredit = roundToFourDecimals(totalCredit);

  return {
    fiscalYear, periodFrom, periodTo,
    accountCode, accountName: account.name,
    openingBalance,
    entries,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
  };
}
```

### Task 4: Implement General Ledger Service Function

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Add the `getGeneralLedger` function**

This is a multi-account version of GL Detail. For each account in the range:
1. Fetch all active accounts, optionally filtered by accountCodeFrom/accountCodeTo
2. Fetch all periods in the range
3. For each account that has activity, fetch individual JournalLine entries (with dimension filter if provided)
4. Compute running balance per account
5. Aggregate grand totals

```typescript
/**
 * General Ledger -- all postings for all accounts (or a range) with running balances.
 *
 * - For each account with activity in the period: lists all postings with running balance
 * - Optionally filters by account code range (from/to)
 * - Optionally filters by dimension value
 * - Optionally includes simulation lines
 */
export async function getGeneralLedger(
  prisma: PrismaClient,
  companyId: string,
  query: GeneralLedgerQuery,
): Promise<GeneralLedgerResponse> {
  const { fiscalYear, periodFrom, periodTo, accountCodeFrom, accountCodeTo, dimensionTypeId, dimensionValueId, includeSimulations } = query;

  // 1. Find periods
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 2. Fetch accounts in range
  const accountWhere: Record<string, unknown> = { companyId, isActive: true };
  if (accountCodeFrom || accountCodeTo) {
    accountWhere.code = {};
    if (accountCodeFrom) (accountWhere.code as Record<string, unknown>).gte = accountCodeFrom;
    if (accountCodeTo) (accountWhere.code as Record<string, unknown>).lte = accountCodeTo;
  }

  const allAccounts = await (prisma as any).chartOfAccount.findMany({
    where: accountWhere,
    orderBy: { code: 'asc' },
    select: { code: true, name: true, accountType: true, normalBalance: true, openingBalance: true },
  });

  if (periodIds.length === 0 || allAccounts.length === 0) {
    return {
      fiscalYear, periodFrom, periodTo,
      accounts: [],
      grandTotals: { totalDebit: 0, totalCredit: 0 },
    };
  }

  // 3. For each account, fetch individual journal lines
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;
  const accountResults: GeneralLedgerResponse['accounts'] = [];

  for (const acct of allAccounts) {
    const lineWhere: Record<string, unknown> = {
      companyId,
      accountCode: acct.code,
      journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
    };
    if (dimensionValueId) {
      lineWhere.dimensions = { some: { dimensionValueId } };
    }

    const lines = await (prisma as any).journalLine.findMany({
      where: lineWhere,
      orderBy: [
        { journalEntry: { transactionDate: 'asc' } },
        { lineNumber: 'asc' },
      ],
      include: {
        journalEntry: {
          select: { entryNumber: true, transactionDate: true, description: true },
        },
      },
    });

    // Skip accounts with no activity and no opening balance
    const openingBal = Number(acct.openingBalance ?? 0);
    if (lines.length === 0 && openingBal === 0) continue;

    let runningBalance = roundToFourDecimals(openingBal);
    let acctTotalDebit = 0;
    let acctTotalCredit = 0;

    const acctEntries: GeneralLedgerResponse['accounts'][0]['entries'] = [];
    for (const line of lines) {
      const debit = roundToFourDecimals(Number(line.debit ?? 0));
      const credit = roundToFourDecimals(Number(line.credit ?? 0));

      if (acct.normalBalance === 'DEBIT') {
        runningBalance = roundToFourDecimals(runningBalance + debit - credit);
      } else {
        runningBalance = roundToFourDecimals(runningBalance + credit - debit);
      }

      acctTotalDebit += debit;
      acctTotalCredit += credit;

      const txDate = line.journalEntry.transactionDate instanceof Date
        ? line.journalEntry.transactionDate.toISOString().split('T')[0]
        : String(line.journalEntry.transactionDate);

      acctEntries.push({
        entryNumber: line.journalEntry.entryNumber,
        transactionDate: txDate,
        description: line.journalEntry.description,
        debit,
        credit,
        runningBalance,
      });
    }

    acctTotalDebit = roundToFourDecimals(acctTotalDebit);
    acctTotalCredit = roundToFourDecimals(acctTotalCredit);
    grandTotalDebit += acctTotalDebit;
    grandTotalCredit += acctTotalCredit;

    accountResults.push({
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.accountType,
      openingBalance: roundToFourDecimals(openingBal),
      entries: acctEntries,
      closingBalance: runningBalance,
      totalDebit: acctTotalDebit,
      totalCredit: acctTotalCredit,
    });
  }

  return {
    fiscalYear, periodFrom, periodTo,
    accounts: accountResults,
    grandTotals: {
      totalDebit: roundToFourDecimals(grandTotalDebit),
      totalCredit: roundToFourDecimals(grandTotalCredit),
    },
  };
}
```

### Task 5: Register GL Detail and General Ledger Routes

**File:** `apps/api/src/modules/finance/reports.routes.ts`

- [ ] **Step 1: Add schema imports**

Update the imports at the top of the routes file to include:

```typescript
import {
  // ...existing imports...
  glDetailQuerySchema,
  glDetailResponseSchema,
  generalLedgerQuerySchema,
  generalLedgerResponseSchema,
} from './reports.schema.js';
import type {
  // ...existing imports...
  GLDetailQuery,
  GeneralLedgerQuery,
} from './reports.schema.js';
import {
  // ...existing imports...
  getGLDetail,
  getGeneralLedger,
} from './reports.service.js';
```

- [ ] **Step 2: Add response envelopes**

```typescript
const glDetailEnvelope = successEnvelope(glDetailResponseSchema);
const generalLedgerEnvelope = successEnvelope(generalLedgerResponseSchema);
```

- [ ] **Step 3: Add GL Detail route handler**

Inside the `reportsRoutes` function, after the budget-variance handler:

```typescript
// GET /reports/gl-detail -- GL Detail / Account Activity report (F5-6.1)
fastify.get<{ Querystring: GLDetailQuery }>(
  '/reports/gl-detail',
  {
    schema: {
      querystring: glDetailQuerySchema,
      response: { 200: glDetailEnvelope },
    },
    preHandler: createPermissionGuard('finance.reports', 'view'),
  },
  async (request, reply) => {
    const ctx = extractRequestContext(request);
    const result = await getGLDetail(prisma, ctx.companyId, request.query);
    return sendSuccess(reply, result);
  },
);
```

- [ ] **Step 4: Add General Ledger route handler**

```typescript
// GET /reports/general-ledger -- General Ledger report (F5-6.2)
fastify.get<{ Querystring: GeneralLedgerQuery }>(
  '/reports/general-ledger',
  {
    schema: {
      querystring: generalLedgerQuerySchema,
      response: { 200: generalLedgerEnvelope },
    },
    preHandler: createPermissionGuard('finance.reports', 'view'),
  },
  async (request, reply) => {
    const ctx = extractRequestContext(request);
    const result = await getGeneralLedger(prisma, ctx.companyId, request.query);
    return sendSuccess(reply, result);
  },
);
```

### Task 6: Write Tests for GL Detail and General Ledger

**File:** `apps/api/src/modules/finance/reports-new.routes.test.ts` (CREATE)

- [ ] **Step 1: Create the test file following the existing pattern**

Follow the exact pattern from `reports.routes.test.ts` (same mock setup, same `buildTestApp`, same `setupMocks`, same JWT generation). The mockPrisma must additionally include:
- `chartOfAccount.findFirst` -- for GL Detail account lookup
- `journalLine.findMany` -- for fetching individual line records (not just groupBy)

- [ ] **Step 2: GL Detail tests -- basic functionality**

```
describe('GET /finance/reports/gl-detail')
  - returns account entries with running balance for a single account
  - returns 404 when accountCode does not exist
  - computes running balance correctly for DEBIT normal account
  - computes running balance correctly for CREDIT normal account
  - returns empty entries when no periods match
  - requires accountCode query parameter
  - validates fiscalYear range
  - returns 401 without auth token
  - returns 403 for user without finance.reports permission
```

Mock setup for GL Detail:
- `chartOfAccount.findFirst` returns one account object `{ code, name, normalBalance, openingBalance }`
- `financialPeriod.findMany` returns period IDs
- `journalLine.findMany` returns line objects with nested `journalEntry` and `dimensions`

- [ ] **Step 3: GL Detail tests -- dimension filtering**

```
  - filters lines by dimensionValueId when provided
  - passes dimension filter through to journalLine.findMany where clause
```

Verify that when `dimensionValueId` is in the query, the `findMany` call includes `dimensions: { some: { dimensionValueId } }` in its where clause.

- [ ] **Step 4: General Ledger tests -- basic functionality**

```
describe('GET /finance/reports/general-ledger')
  - returns all accounts with their entries and running balances
  - filters by accountCodeFrom and accountCodeTo range
  - skips accounts with no activity and no opening balance
  - returns empty result when no periods match
  - computes grand totals across all accounts
  - returns 401 without auth token
  - returns 403 for user without finance.reports permission
```

Mock setup: `chartOfAccount.findMany` returns multiple accounts, `journalLine.findMany` returns lines per account.

- [ ] **Step 5: General Ledger tests -- dimension filtering**

```
  - filters lines by dimensionValueId when provided
```

- [ ] **Step 6: Run the tests and verify they pass**

```bash
cd /Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first
pnpm --filter api test -- --reporter=verbose apps/api/src/modules/finance/reports-new.routes.test.ts
```

---

## Story API-9: Departmental P&L Report

### Task 7: Add Departmental P&L Schema

**File:** `apps/api/src/modules/finance/reports.schema.ts`

- [ ] **Step 1: Add Departmental P&L query schema**

After the General Ledger schemas:

```typescript
// ---------------------------------------------------------------------------
// Departmental P&L -- Query Schema
// ---------------------------------------------------------------------------

export const departmentalPnlQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  dimensionTypeId: z.string().uuid(),
});
```

- [ ] **Step 2: Add Departmental P&L response schema**

Per the design spec (section 2.6):

```typescript
// ---------------------------------------------------------------------------
// Departmental P&L -- Response Schemas
// ---------------------------------------------------------------------------

const departmentalPnlColumnSchema = z.object({
  dimensionValueId: z.string(),
  dimensionValueName: z.string(),
  dimensionValueCode: z.string(),
});

const departmentalPnlAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  values: z.array(z.number()),  // one per column, same order as columns array
  total: z.number(),
});

const departmentalPnlSectionSchema = z.object({
  classification: z.string(),
  name: z.string(),
  accounts: z.array(departmentalPnlAccountSchema),
  totals: z.array(z.number()),  // one per column
  grandTotal: z.number(),
});

export const departmentalPnlResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  dimensionTypeName: z.string(),
  columns: z.array(departmentalPnlColumnSchema),
  sections: z.array(departmentalPnlSectionSchema),
  summary: z.object({
    netProfitPerColumn: z.array(z.number()),
    totalNetProfit: z.number(),
  }),
});
```

- [ ] **Step 3: Add TypeScript types**

```typescript
export type DepartmentalPnlQuery = z.infer<typeof departmentalPnlQuerySchema>;
export type DepartmentalPnlResponse = z.infer<typeof departmentalPnlResponseSchema>;
```

### Task 8: Implement Departmental P&L Service Function

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Add the import for the new types**

```typescript
import type {
  // ...existing imports...
  DepartmentalPnlQuery,
  DepartmentalPnlResponse,
} from './reports.schema.js';
```

- [ ] **Step 2: Implement `getDepartmentalPnl`**

Algorithm:
1. Fetch the DimensionType by ID to get the type name
2. Fetch all active DimensionValues for that type -- these become the column headers
3. Fetch periods in range
4. Query `DimensionBalance` table grouped by `accountCode` + `dimensionValueId` for the given periods. This is the fast path using pre-aggregated data.
5. Alternatively, if DimensionBalance data is not populated, fall back to: query `JournalLine` joined through `JournalLineDimension` to `DimensionValue`, grouped by `accountCode` + `dimensionValueId`
6. Also query journal lines WITHOUT any dimension assignment for the given type -- these become the "Unallocated" column
7. Fetch P&L accounts (classification.reportSection = 'PROFIT_AND_LOSS')
8. Build the P&L sections using `PNL_CLASSIFICATIONS`, but instead of a single balance per account, compute an array of balances (one per dimension value column)
9. Compute net profit per column

```typescript
/**
 * Departmental P&L -- P&L report pivoted by dimension.
 *
 * Each column represents a dimension value (e.g., "Sales Dept", "Marketing Dept").
 * Final column represents "Unallocated" lines (no dimension value for the given type).
 */
export async function getDepartmentalPnl(
  prisma: PrismaClient,
  companyId: string,
  query: DepartmentalPnlQuery,
): Promise<DepartmentalPnlResponse> {
  const { fiscalYear, periodFrom, periodTo, dimensionTypeId } = query;

  // 1. Fetch dimension type
  const dimType = await (prisma as any).dimensionType.findFirst({
    where: { id: dimensionTypeId, companyId },
    select: { id: true, name: true },
  });
  if (!dimType) {
    const error = new Error('Dimension type not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch active dimension values for this type (these are our columns)
  const dimValues = await (prisma as any).dimensionValue.findMany({
    where: { dimensionTypeId, companyId, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });

  const columns = dimValues.map((dv: { id: string; code: string; name: string }) => ({
    dimensionValueId: dv.id,
    dimensionValueName: dv.name,
    dimensionValueCode: dv.code,
  }));

  // Add "Unallocated" as the last column
  columns.push({
    dimensionValueId: '__UNALLOCATED__',
    dimensionValueName: 'Unallocated',
    dimensionValueCode: 'UNALLOC',
  });

  const columnCount = columns.length;
  const dimValueIdToIndex = new Map<string, number>();
  dimValues.forEach((dv: { id: string }, idx: number) => {
    dimValueIdToIndex.set(dv.id, idx);
  });
  const unallocatedIndex = columnCount - 1;

  // 3. Find periods
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 4. Fetch P&L accounts
  const pnlAccounts = await (prisma as any).chartOfAccount.findMany({
    where: {
      companyId,
      isActive: true,
      classification: { reportSection: 'PROFIT_AND_LOSS' },
    },
    orderBy: { code: 'asc' },
    select: {
      code: true, name: true, normalBalance: true,
      classification: { select: { code: true, name: true } },
    },
  });

  // 5. Query DimensionBalance for pre-aggregated data
  //    Grouped by accountCode + dimensionValueId
  //    This gives us per-account, per-dimension-value debit/credit totals
  const dimBalances = periodIds.length > 0
    ? await (prisma as any).dimensionBalance.findMany({
        where: {
          companyId,
          dimensionTypeId,
          periodId: { in: periodIds },
        },
        select: {
          accountCode: true,
          dimensionValueId: true,
          totalDebit: true,
          totalCredit: true,
        },
      })
    : [];

  // Build a nested map: accountCode -> dimensionValueId -> { totalDebit, totalCredit }
  const dimBalanceMap = new Map<string, Map<string, { totalDebit: number; totalCredit: number }>>();
  for (const db of dimBalances) {
    const acctMap = dimBalanceMap.get(db.accountCode) ?? new Map();
    const existing = acctMap.get(db.dimensionValueId) ?? { totalDebit: 0, totalCredit: 0 };
    existing.totalDebit += Number(db.totalDebit ?? 0);
    existing.totalCredit += Number(db.totalCredit ?? 0);
    acctMap.set(db.dimensionValueId, existing);
    dimBalanceMap.set(db.accountCode, acctMap);
  }

  // 6. Also compute total per account (from journal lines) to determine unallocated
  let totalLineAgg: Array<{ accountCode: string; _sum: { debit: unknown; credit: unknown } }> = [];
  if (periodIds.length > 0) {
    totalLineAgg = await (prisma as any).journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
      },
      _sum: { debit: true, credit: true },
    });
  }
  const totalLineMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const agg of totalLineAgg) {
    totalLineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // 7. Build sections
  const accountsByClassification = new Map<string, Array<{ code: string; name: string; normalBalance: string; values: number[]; total: number }>>();

  for (const acct of pnlAccounts) {
    const classCode = acct.classification?.code;
    if (!classCode) continue;

    const acctDimMap = dimBalanceMap.get(acct.code);
    const totalLine = totalLineMap.get(acct.code);
    const totalDebit = totalLine?.totalDebit ?? 0;
    const totalCredit = totalLine?.totalCredit ?? 0;

    if (totalDebit === 0 && totalCredit === 0) continue;

    // Compute balance per dimension value
    const values = new Array<number>(columnCount).fill(0);
    let allocatedDebit = 0;
    let allocatedCredit = 0;

    if (acctDimMap) {
      for (const [dvId, totals] of acctDimMap.entries()) {
        const colIdx = dimValueIdToIndex.get(dvId);
        if (colIdx !== undefined) {
          const balance = acct.normalBalance === 'DEBIT'
            ? totals.totalDebit - totals.totalCredit
            : totals.totalCredit - totals.totalDebit;
          values[colIdx] = roundToFourDecimals(balance);
          allocatedDebit += totals.totalDebit;
          allocatedCredit += totals.totalCredit;
        }
      }
    }

    // Unallocated = total - allocated
    const unallocatedDebit = totalDebit - allocatedDebit;
    const unallocatedCredit = totalCredit - allocatedCredit;
    const unallocatedBalance = acct.normalBalance === 'DEBIT'
      ? unallocatedDebit - unallocatedCredit
      : unallocatedCredit - unallocatedDebit;
    values[unallocatedIndex] = roundToFourDecimals(unallocatedBalance);

    const accountTotal = roundToFourDecimals(values.reduce((s, v) => s + v, 0));

    const existing = accountsByClassification.get(classCode) ?? [];
    existing.push({ code: acct.code, name: acct.name, normalBalance: acct.normalBalance, values, total: accountTotal });
    accountsByClassification.set(classCode, existing);
  }

  // Build sections in P&L order
  const sections: DepartmentalPnlResponse['sections'] = [];
  const sectionTotalsPerColumn = new Map<string, number[]>();

  for (const { code, name } of PNL_CLASSIFICATIONS) {
    const sectionAccounts = accountsByClassification.get(code) ?? [];
    const sectionTotals = new Array<number>(columnCount).fill(0);
    for (const acct of sectionAccounts) {
      for (let i = 0; i < columnCount; i++) {
        sectionTotals[i] += acct.values[i];
      }
    }
    const roundedTotals = sectionTotals.map(roundToFourDecimals);
    const grandTotal = roundToFourDecimals(roundedTotals.reduce((s, v) => s + v, 0));

    sections.push({
      classification: code,
      name,
      accounts: sectionAccounts.map((a) => ({
        accountCode: a.code,
        accountName: a.name,
        values: a.values,
        total: a.total,
      })),
      totals: roundedTotals,
      grandTotal,
    });
    sectionTotalsPerColumn.set(code, roundedTotals);
  }

  // 8. Calculate net profit per column
  //    Net Profit = Revenue - COGS - OPEX + Other Income - Finance Costs - Taxation
  const netProfitPerColumn = new Array<number>(columnCount).fill(0);
  const rev = sectionTotalsPerColumn.get('REV') ?? new Array<number>(columnCount).fill(0);
  const cogs = sectionTotalsPerColumn.get('COGS') ?? new Array<number>(columnCount).fill(0);
  const opex = sectionTotalsPerColumn.get('OPEX') ?? new Array<number>(columnCount).fill(0);
  const oi = sectionTotalsPerColumn.get('OI') ?? new Array<number>(columnCount).fill(0);
  const fin = sectionTotalsPerColumn.get('FIN') ?? new Array<number>(columnCount).fill(0);
  const tax = sectionTotalsPerColumn.get('TAX') ?? new Array<number>(columnCount).fill(0);

  for (let i = 0; i < columnCount; i++) {
    netProfitPerColumn[i] = roundToFourDecimals(
      rev[i] - cogs[i] - opex[i] + oi[i] - fin[i] - tax[i]
    );
  }

  const totalNetProfit = roundToFourDecimals(netProfitPerColumn.reduce((s, v) => s + v, 0));

  return {
    fiscalYear, periodFrom, periodTo,
    dimensionTypeName: dimType.name,
    columns,
    sections,
    summary: { netProfitPerColumn, totalNetProfit },
  };
}
```

### Task 9: Register Departmental P&L Route

**File:** `apps/api/src/modules/finance/reports.routes.ts`

- [ ] **Step 1: Add schema imports for Departmental P&L**

Add `departmentalPnlQuerySchema`, `departmentalPnlResponseSchema` to schema imports and `DepartmentalPnlQuery` to type imports. Add `getDepartmentalPnl` to service imports.

- [ ] **Step 2: Add response envelope**

```typescript
const departmentalPnlEnvelope = successEnvelope(departmentalPnlResponseSchema);
```

- [ ] **Step 3: Add route handler**

```typescript
// GET /reports/departmental-pnl -- Departmental P&L report (F5-2.6)
fastify.get<{ Querystring: DepartmentalPnlQuery }>(
  '/reports/departmental-pnl',
  {
    schema: {
      querystring: departmentalPnlQuerySchema,
      response: { 200: departmentalPnlEnvelope },
    },
    preHandler: createPermissionGuard('finance.reports', 'view'),
  },
  async (request, reply) => {
    const ctx = extractRequestContext(request);
    const result = await getDepartmentalPnl(prisma, ctx.companyId, request.query);
    return sendSuccess(reply, result);
  },
);
```

### Task 10: Write Tests for Departmental P&L

**File:** `apps/api/src/modules/finance/reports-new.routes.test.ts` (append to file created in Task 6)

- [ ] **Step 1: Add mock fields to mockPrisma**

Add to the vi.hoisted mockPrisma:
```typescript
dimensionType: { findFirst: vi.fn() },
dimensionValue: { findMany: vi.fn() },
dimensionBalance: { findMany: vi.fn() },
```

- [ ] **Step 2: Write Departmental P&L tests**

```
describe('GET /finance/reports/departmental-pnl')
  - returns P&L pivoted by dimension values with per-column totals
  - returns 404 when dimensionTypeId does not exist
  - computes unallocated column as remainder (total - allocated)
  - handles empty result when no periods match
  - requires dimensionTypeId query parameter
  - returns 401 without auth token
  - returns 403 for user without finance.reports permission
```

Mock setup:
- `dimensionType.findFirst` returns `{ id, name }`
- `dimensionValue.findMany` returns 2-3 values `[{ id, code, name }]`
- `financialPeriod.findMany` returns period IDs
- `chartOfAccount.findMany` returns P&L accounts with classification
- `dimensionBalance.findMany` returns pre-aggregated records `[{ accountCode, dimensionValueId, totalDebit, totalCredit }]`
- `journalLine.groupBy` returns total line aggregations

- [ ] **Step 3: Run the tests**

```bash
cd /Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first
pnpm --filter api test -- --reporter=verbose apps/api/src/modules/finance/reports-new.routes.test.ts
```

---

## Story API-10: Dimension Filters + Simulation Toggle on Existing Reports

### Task 11: Extend Existing Query Schemas with Dimension and Simulation Params

**File:** `apps/api/src/modules/finance/reports.schema.ts`

- [ ] **Step 1: Extend `trialBalanceQuerySchema`**

Add three optional params:

```typescript
export const trialBalanceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

- [ ] **Step 2: Extend `reportQuerySchema` (used by P&L and BS)**

```typescript
export const reportQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

- [ ] **Step 3: Extend `transactionJournalQuerySchema`**

```typescript
export const transactionJournalQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCode: z.string().optional(),
  source: z.enum(JOURNAL_SOURCES).optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

- [ ] **Step 4: Extend `budgetVarianceQuerySchema`**

```typescript
export const budgetVarianceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  budgetId: z.string().uuid().optional(),
  budgetVersionId: z.string().uuid().optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});
```

**NOTE:** The response types for TB, P&L, and BS do not change. The dimension/simulation parameters only filter the data; they do not add new response fields at this stage.

### Task 12: Add Shared Dimension-Filtering Helper

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Add `getDimensionFilteredAggregations` helper**

This helper replaces the raw `journalLine.groupBy` pattern used across all 5 existing reports. When `dimensionValueId` is present, it queries through `JournalLineDimension`:

```typescript
/**
 * Aggregates journal lines by accountCode, optionally filtered by a dimension value.
 *
 * When dimensionValueId is provided, only lines linked to that dimension value
 * via JournalLineDimension are included.
 *
 * Falls back to the standard groupBy when no dimension filter is present.
 */
async function getDimensionFilteredAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  dimensionValueId?: string,
): Promise<Map<string, { totalDebit: number; totalCredit: number }>> {
  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  if (periodIds.length === 0) return lineMap;

  const where: Record<string, unknown> = {
    companyId,
    journalEntry: {
      companyId,
      status: 'POSTED',
      periodId: { in: periodIds },
    },
  };

  if (dimensionValueId) {
    where.dimensions = { some: { dimensionValueId } };
  }

  const lineAggregations: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = await (prisma as any).journalLine.groupBy({
    by: ['accountCode'],
    where,
    _sum: { debit: true, credit: true },
  });

  for (const agg of lineAggregations) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  return lineMap;
}
```

- [ ] **Step 2: Add `getSimulationLineAggregations` helper**

This mirrors the journal line aggregation but queries `SimulationLine` for ACTIVE simulations:

```typescript
/**
 * Aggregates simulation lines by accountCode for ACTIVE simulations in the given periods.
 * Used when includeSimulations=true on reports.
 */
async function getSimulationLineAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  dimensionValueId?: string,
): Promise<Map<string, { totalDebit: number; totalCredit: number }>> {
  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  if (periodIds.length === 0) return lineMap;

  // SimulationLine does not have a JournalLineDimension junction table -- it uses JSON.
  // For dimension filtering on simulations, we must filter in application code.
  const simLineAgg: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = await (prisma as any).simulationLine.groupBy({
    by: ['accountCode'],
    where: {
      companyId,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    _sum: { debit: true, credit: true },
  });

  for (const agg of simLineAgg) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // TODO: If dimensionValueId is provided, we need to filter simulations that have
  // matching dimensionValues in their JSON. For MVP, simulation dimension filtering
  // is not supported -- all simulation lines are included regardless of dimension filter.

  return lineMap;
}
```

- [ ] **Step 3: Add `getSimulationLinesForAccount` helper**

Used by GL Detail's `includeSimulations` path:

```typescript
/**
 * Fetches individual simulation lines for a single account (used by GL Detail).
 */
async function getSimulationLinesForAccount(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  accountCode: string,
  _dimensionValueId?: string,
): Promise<GLDetailResponse['entries']> {
  if (periodIds.length === 0) return [];

  const simLines = await (prisma as any).simulationLine.findMany({
    where: {
      companyId,
      accountCode,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    include: {
      simulation: {
        select: {
          id: true,
          entryNumber: true,
          transactionDate: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: { simulation: { transactionDate: 'asc' } },
  });

  return simLines.map((line: {
    simulation: {
      id: string;
      entryNumber: string;
      transactionDate: Date | string;
      description: string;
      reference: string | null;
    };
    debit: unknown;
    credit: unknown;
    dimensionValues: unknown;
  }) => {
    const txDate = line.simulation.transactionDate instanceof Date
      ? line.simulation.transactionDate.toISOString().split('T')[0]
      : String(line.simulation.transactionDate);

    // Parse dimension values from JSON
    const dimVals = Array.isArray(line.dimensionValues) ? line.dimensionValues : [];

    return {
      journalEntryId: line.simulation.id,
      entryNumber: line.simulation.entryNumber,
      transactionDate: txDate,
      description: line.simulation.description,
      reference: line.simulation.reference,
      source: 'SIMULATION',
      debit: roundToFourDecimals(Number(line.debit ?? 0)),
      credit: roundToFourDecimals(Number(line.credit ?? 0)),
      runningBalance: 0, // Will be recomputed by caller
      isSimulation: true,
      dimensions: dimVals.map((dv: { dimensionTypeName?: string; dimensionValueName?: string }) => ({
        dimensionTypeName: dv.dimensionTypeName ?? '',
        dimensionValueName: dv.dimensionValueName ?? '',
      })),
    };
  });
}
```

- [ ] **Step 4: Add `mergeSimulationAggregations` helper**

Merges simulation aggregations into journal aggregations:

```typescript
/**
 * Merges simulation line aggregations into the journal line aggregation map.
 * Adds simulation amounts on top of existing journal amounts for each account.
 */
function mergeSimulationAggregations(
  journalMap: Map<string, { totalDebit: number; totalCredit: number }>,
  simulationMap: Map<string, { totalDebit: number; totalCredit: number }>,
): Map<string, { totalDebit: number; totalCredit: number }> {
  const merged = new Map(journalMap);
  for (const [accountCode, simTotals] of simulationMap) {
    const existing = merged.get(accountCode) ?? { totalDebit: 0, totalCredit: 0 };
    merged.set(accountCode, {
      totalDebit: existing.totalDebit + simTotals.totalDebit,
      totalCredit: existing.totalCredit + simTotals.totalCredit,
    });
  }
  return merged;
}
```

### Task 13: Update `getTrialBalance` to Support Dimension Filters and Simulations

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Update the function signature**

The `TrialBalanceQuery` type already includes the new optional fields (from Task 11). The function receives them via `query`.

- [ ] **Step 2: Replace the inline `journalLine.groupBy` call with `getDimensionFilteredAggregations`**

Replace lines that do:
```typescript
lineAggregations = await (prisma as any).journalLine.groupBy({...});
```

With:
```typescript
const lineMap = await getDimensionFilteredAggregations(
  prisma, companyId, periodIds, query.dimensionValueId,
);
```

- [ ] **Step 3: Add simulation merging**

After building `lineMap`, if `query.includeSimulations` is true:
```typescript
if (query.includeSimulations) {
  const simMap = await getSimulationLineAggregations(prisma, companyId, periodIds, query.dimensionValueId);
  // Merge simulation data into lineMap
  for (const [accountCode, simTotals] of simMap) {
    const existing = lineMap.get(accountCode) ?? { totalDebit: 0, totalCredit: 0 };
    lineMap.set(accountCode, {
      totalDebit: existing.totalDebit + simTotals.totalDebit,
      totalCredit: existing.totalCredit + simTotals.totalCredit,
    });
  }
}
```

- [ ] **Step 4: Remove the old `lineAggregations` array and `lineMap` construction**

The new `getDimensionFilteredAggregations` returns the map directly, so the old array-to-map conversion code is no longer needed.

### Task 14: Update `getProfitAndLoss` to Support Dimension Filters and Simulations

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Same pattern as Task 13**

Replace the `journalLine.groupBy` block with `getDimensionFilteredAggregations` call. Add simulation merging via `getSimulationLineAggregations` when `query.includeSimulations` is true. The `ReportQuery` type already includes the new fields.

### Task 15: Update `getBalanceSheet` to Support Dimension Filters and Simulations

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Same pattern as Task 13**

Replace `journalLine.groupBy` with `getDimensionFilteredAggregations`. Add simulation merging. Also update the `calculatePeriodNetPnl` helper to accept optional `dimensionValueId` and `includeSimulations` params so that the P&L carried into equity is also filtered consistently.

### Task 16: Update `getTransactionJournal` to Support Dimension Filters

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Add dimension filter to entry where clause**

When `query.dimensionValueId` is provided, filter journal entries to only those that have at least one line matching the dimension:

```typescript
if (query.dimensionValueId) {
  entryWhere.lines = {
    ...((entryWhere.lines as Record<string, unknown>) ?? {}),
    some: {
      ...((entryWhere.lines as Record<string, unknown>)?.some as Record<string, unknown> ?? {}),
      dimensions: { some: { dimensionValueId: query.dimensionValueId } },
    },
  };
}
```

Note: when `accountCode` is already set, the `lines.some` filter must combine both conditions. Use a single `some` with both constraints.

- [ ] **Step 2: Include dimension info in the response**

When lines are fetched, include `dimensions` in the `include`:
```typescript
lines: {
  orderBy: { lineNumber: 'asc' },
  include: {
    account: { select: { name: true } },
    dimensions: {
      include: {
        dimensionValue: { select: { name: true, dimensionType: { select: { name: true } } } },
      },
    },
  },
},
```

### Task 17: Update `getBudgetVariance` to Support Budget Version and Dimension Filters

**File:** `apps/api/src/modules/finance/reports.service.ts`

- [ ] **Step 1: Add budget version filtering**

When `query.budgetVersionId` is provided but `query.budgetId` is not, fetch all budgets for that version and aggregate their lines:

```typescript
if (query.budgetVersionId && !query.budgetId) {
  // Find all budgets in this version for the fiscal year
  const budgets = await (prisma as any).budget.findMany({
    where: { companyId, fiscalYear, budgetVersionId: query.budgetVersionId },
    include: {
      lines: {
        orderBy: { accountCode: 'asc' },
        include: { account: { select: { name: true } } },
      },
    },
  });
  // Aggregate lines across all budgets in the version
  // ...
}
```

- [ ] **Step 2: Add dimension filtering to actuals**

Replace the raw `journalLine.groupBy` with `getDimensionFilteredAggregations(prisma, companyId, periodIds, query.dimensionValueId)`.

- [ ] **Step 3: Add simulation merging for actuals**

When `query.includeSimulations` is true, merge simulation line aggregations into the actuals.

### Task 18: Write Tests for Dimension Filtering on Existing Reports

**File:** `apps/api/src/modules/finance/reports.routes.test.ts` (MODIFY)

- [ ] **Step 1: Add test for TB with dimension filter**

```
describe('GET /finance/reports/trial-balance -- dimension filtering')
  - passes dimensionValueId through to journalLine.groupBy where clause
  - returns filtered results when dimensionValueId is provided
```

Verify that `mockPrisma.journalLine.groupBy` is called with `where.dimensions.some.dimensionValueId` when the query param is present.

- [ ] **Step 2: Add test for TB with includeSimulations**

```
describe('GET /finance/reports/trial-balance -- simulation inclusion')
  - merges simulation line aggregations when includeSimulations=true
```

Add `simulationLine: { groupBy: vi.fn() }` to mockPrisma. Verify that when `includeSimulations=true` is in the query, `simulationLine.groupBy` is called and the resulting amounts are merged.

**File:** `apps/api/src/modules/finance/reports-pnl-bs.routes.test.ts` (MODIFY)

- [ ] **Step 3: Add dimension filter tests for P&L and BS**

```
describe('GET /finance/reports/profit-and-loss -- dimension filtering')
  - passes dimensionValueId through to journalLine.groupBy

describe('GET /finance/reports/balance-sheet -- dimension filtering')
  - passes dimensionValueId through to journalLine.groupBy
```

**File:** `apps/api/src/modules/finance/reports-journal-variance.routes.test.ts` (MODIFY)

- [ ] **Step 4: Add dimension filter test for Transaction Journal**

```
describe('GET /finance/reports/transaction-journal -- dimension filtering')
  - filters entries by dimensionValueId
```

- [ ] **Step 5: Add budget version test for Budget Variance**

```
describe('GET /finance/reports/budget-variance -- budget version filtering')
  - accepts budgetVersionId and aggregates budgets in that version
```

### Task 19: Run All Tests and Verify

- [ ] **Step 1: Run all report tests**

```bash
cd /Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first
pnpm --filter api test -- --reporter=verbose apps/api/src/modules/finance/reports.routes.test.ts apps/api/src/modules/finance/reports-pnl-bs.routes.test.ts apps/api/src/modules/finance/reports-journal-variance.routes.test.ts apps/api/src/modules/finance/reports-new.routes.test.ts
```

- [ ] **Step 2: Run TypeScript compiler check**

```bash
cd /Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first
pnpm --filter api exec tsc --noEmit
```

- [ ] **Step 3: Fix any failures and re-run until all pass**

---

## Verification Checklist

Before marking this wave complete, verify each acceptance criterion from the design spec (section 11, F5):

- [ ] GL Detail shows all postings for single account with running balance
- [ ] GL Detail correctly computes running balance for DEBIT and CREDIT normal accounts
- [ ] GL Detail supports dimension filtering (dimensionValueId query param)
- [ ] GL Detail supports simulation inclusion (includeSimulations query param)
- [ ] General Ledger shows all accounts with entries in period range
- [ ] General Ledger supports account code range filtering (accountCodeFrom/accountCodeTo)
- [ ] General Ledger supports dimension filtering
- [ ] Departmental P&L shows columns per dimension value with per-column totals
- [ ] Departmental P&L includes "Unallocated" column for untagged lines
- [ ] Departmental P&L requires dimensionTypeId parameter
- [ ] All 5 existing reports accept dimensionValueId query param and filter results
- [ ] All 5 existing reports accept includeSimulations query param and merge ACTIVE simulation data
- [ ] Budget Variance accepts budgetVersionId query param
- [ ] All new and modified endpoints return 401 without auth, 403 without permission
- [ ] All tests pass
- [ ] TypeScript compiles with no errors

---

## Out of Scope (handled by other waves)

- **Cash Flow Statement** (spec section 6.3) -- excluded from this plan; can be added as a follow-up story if needed. Requires new AccountClassification codes and more complex categorization logic.
- **Cost Centre Report** and **Project Profitability Report** (spec section 2.6) -- structurally very similar to Departmental P&L; can be added as a small follow-up task reusing the same columnar pattern.
- **CSV/Excel Export** for reports -- handled by Wave 6 (API-12)
- **Frontend pages** for new reports -- handled by Wave 8 (FE-6, FE-7)
- **Settings expansion** (API-11) -- separate story in Wave 5, not covered in this plan

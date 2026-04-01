# Finance Phase 2 Wave 6: Exports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install export dependencies, create a shared export service, and add CSV/Excel export endpoints for all 11 report routes and 4 list routes — enabling users to download finance data in either format.

**Architecture:** One story (API-12) with a shared export utility module consumed by every existing report and list route. Export endpoints are GET routes appended to the existing route trees, returning file downloads with appropriate Content-Type and Content-Disposition headers.

**Tech Stack:** Fastify 5, csv-stringify, exceljs, TypeScript strict

**Depends on:** Waves 1-5 (all report APIs must exist, including GL Detail, General Ledger, Cash Flow, Departmental P&L, Cost Centre, Project Profitability)

**Blocked by this plan:** Wave 10 frontend (wiring Export CSV/Excel buttons)

---

## File Structure

### New Files
```
apps/api/src/modules/finance/export.service.ts          — Shared CSV + Excel generation service
apps/api/src/modules/finance/export.schema.ts            — Export query schema (format param)
apps/api/src/modules/finance/export.routes.ts            — Report export routes (11 reports)
apps/api/src/modules/finance/export.routes.test.ts       — Tests for export endpoints
apps/api/src/modules/finance/list-export.routes.ts       — List export routes (accounts, journals, bank-accounts, budgets)
apps/api/src/modules/finance/list-export.routes.test.ts  — Tests for list export endpoints
```

### Modified Files
```
apps/api/package.json                                    — Add csv-stringify + exceljs dependencies
apps/api/src/modules/finance/index.ts                    — Register export + list-export route plugins
```

### Reference Files (read-only)
```
apps/api/src/modules/finance/reports.service.ts          — Existing report service functions
apps/api/src/modules/finance/reports.schema.ts           — Existing report query schemas
apps/api/src/modules/finance/accounts.service.ts         — Existing account list service
apps/api/src/modules/finance/journals.service.ts         — Existing journal list service
apps/api/src/modules/finance/budgets.service.ts          — Existing budget list service
apps/api/src/modules/finance/bank-accounts.service.ts    — Existing bank account list service
docs/superpowers/specs/2026-04-01-fin-phase2-design.md   — Design spec section 7
```

### Protected Files (DO NOT MODIFY)
```
packages/db/src/client.ts
packages/db/src/index.ts
packages/db/src/utils/sharing.ts
packages/db/src/services/number-series.service.ts
```

---

## Task 1: Install Export Dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install csv-stringify and exceljs**

```bash
cd apps/api && pnpm add csv-stringify exceljs
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/api && node -e "require('csv-stringify'); require('exceljs'); console.log('OK')"
```

---

## Task 2: Create Export Schema

**Files:**
- Create: `apps/api/src/modules/finance/export.schema.ts`

- [ ] **Step 1: Create the export query schema**

```typescript
// export.schema.ts
import { z } from 'zod';

export const EXPORT_FORMATS = ['csv', 'excel'] as const;

export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).default('csv'),
});

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
```

This schema is merged with each report's existing query schema in the route handlers.

---

## Task 3: Create Shared Export Service

**Files:**
- Create: `apps/api/src/modules/finance/export.service.ts`

- [ ] **Step 1: Define ExportColumn interface and CSV generator**

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

export function generateCsv(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Buffer {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? ''));
  return Buffer.from(stringify([headers, ...data]));
}
```

- [ ] **Step 2: Add Excel generator**

```typescript
export async function generateExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 15,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E0FF' }, // Light purple matching Concept D
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Format currency/percentage columns
  for (const col of columns) {
    if (col.format === 'currency') {
      const excelCol = sheet.getColumn(col.key);
      excelCol.numFmt = '#,##0.00';
    } else if (col.format === 'percentage') {
      const excelCol = sheet.getColumn(col.key);
      excelCol.numFmt = '0.00%';
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
```

- [ ] **Step 3: Add reply helper for Fastify**

```typescript
import type { FastifyReply } from 'fastify';
import type { ExportFormat } from './export.schema.js';

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  excel:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  excel: 'xlsx',
};

export async function sendExportFile(
  reply: FastifyReply,
  format: ExportFormat,
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const ext = FILE_EXTENSIONS[format];
  const fullFilename = `${filename}-${new Date().toISOString().slice(0, 10)}.${ext}`;

  const buffer =
    format === 'csv'
      ? generateCsv(columns, rows)
      : await generateExcel(sheetName, columns, rows);

  void reply
    .header('Content-Type', CONTENT_TYPES[format])
    .header('Content-Disposition', `attachment; filename="${fullFilename}"`)
    .send(buffer);
}
```

---

## Task 4: Create Report Export Routes

**Files:**
- Create: `apps/api/src/modules/finance/export.routes.ts`

This file registers GET `/reports/{name}/export` for all 11 report endpoints (5 existing + 6 new from Wave 5).

- [ ] **Step 1: Create the route plugin skeleton**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { exportQuerySchema } from './export.schema.js';
import { sendExportFile } from './export.service.js';
import type { ExportColumn } from './export.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// Import all report query schemas
import { trialBalanceQuerySchema } from './reports.schema.js';
// ... (import all report query schemas from reports.schema.ts)

// Import all report service functions
import { getTrialBalance } from './reports.service.js';
// ... (import all report service functions)

async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  // ... routes registered below
}

export const exportRoutesPlugin = exportRoutes;
```

- [ ] **Step 2: Add Trial Balance export route**

Pattern for all report exports — call the existing report service, flatten data to rows, send via export service:

```typescript
  // GET /reports/trial-balance/export
  fastify.get(
    '/reports/trial-balance/export',
    {
      schema: {
        querystring: trialBalanceQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getTrialBalance(prisma, ctx.companyId, query);

      const columns: ExportColumn[] = [
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Account Type', key: 'accountType', width: 12 },
        { header: 'Opening Balance', key: 'openingBalance', width: 18, format: 'currency' },
        { header: 'Total Debit', key: 'totalDebit', width: 18, format: 'currency' },
        { header: 'Total Credit', key: 'totalCredit', width: 18, format: 'currency' },
        { header: 'Closing Balance', key: 'closingBalance', width: 18, format: 'currency' },
      ];

      await sendExportFile(reply, format, 'trial-balance', 'Trial Balance', columns, result.accounts);
    },
  );
```

- [ ] **Step 3: Add remaining 10 report export routes**

Repeat the pattern for each report, adjusting columns to match each report's response shape:

- `/reports/profit-and-loss/export` — Flatten sections -> rows (classification, accountCode, accountName, amount)
- `/reports/balance-sheet/export` — Same flattening as P&L
- `/reports/transaction-journal/export` — Flatten entries to one row per journal line
- `/reports/budget-variance/export` — One row per account with budget/actual/variance columns
- `/reports/gl-detail/export` — One row per entry line
- `/reports/general-ledger/export` — One row per entry line, grouped by account
- `/reports/departmental-pnl/export` — One row per account, one column per dimension value
- `/reports/cost-centre/export` — Same as departmental P&L
- `/reports/project-profitability/export` — One row per project
- `/reports/cash-flow/export` — One row per line item across all 3 sections

Key: for hierarchical reports (P&L, BS, Departmental P&L), flatten `sections[].accounts[]` into rows with a `section` column added.

---

## Task 5: Create List Export Routes

**Files:**
- Create: `apps/api/src/modules/finance/list-export.routes.ts`

Export endpoints for entity list pages (accounts, journals, bank accounts, budgets).

- [ ] **Step 1: Create the accounts export route**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { exportQuerySchema } from './export.schema.js';
import { sendExportFile } from './export.service.js';
import type { ExportColumn } from './export.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { extractRequestContext } from '../../core/types/request-context.js';

async function listExportRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /accounts/export
  fastify.get(
    '/accounts/export',
    {
      schema: { querystring: exportQuerySchema },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format } = request.query as any;

      // Fetch all accounts (no pagination for export, limit 10000)
      const accounts = await (prisma as any).chartOfAccount.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { code: 'asc' },
        take: 10000,
      });

      const columns: ExportColumn[] = [
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Account Type', key: 'accountType', width: 12 },
        { header: 'Normal Balance', key: 'normalBalance', width: 12 },
        { header: 'Postable', key: 'isPostable', width: 8 },
        { header: 'Active', key: 'isActive', width: 8 },
      ];

      await sendExportFile(reply, format, 'chart-of-accounts', 'Chart of Accounts', columns, accounts);
    },
  );
```

- [ ] **Step 2: Add journals, bank-accounts, and budgets export routes**

Same pattern for each:

- `GET /journals/export` — columns: entryNumber, date, description, reference, status, source, totalDebit, totalCredit
- `GET /bank-accounts/export` — columns: accountName, bankName, accountNumber, sortCode, currency, isActive
- `GET /budgets/export` — columns: name, fiscalYear, status, totalAmount

Each queries the respective Prisma model with `take: 10000` and `orderBy` appropriate to the entity.

```typescript
  // Close the plugin
}

export const listExportRoutesPlugin = listExportRoutes;
```

---

## Task 6: Register Export Plugins in Finance Module

**Files:**
- Modify: `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Import and register both export plugins**

Add imports:
```typescript
import { exportRoutesPlugin } from './export.routes.js';
import { listExportRoutesPlugin } from './list-export.routes.js';
```

Add registrations inside `financeModule()` (after existing report routes):
```typescript
  await fastify.register(exportRoutesPlugin);
  await fastify.register(listExportRoutesPlugin);
```

---

## Task 7: Write Tests

**Files:**
- Create: `apps/api/src/modules/finance/export.routes.test.ts`
- Create: `apps/api/src/modules/finance/list-export.routes.test.ts`

- [ ] **Step 1: Test CSV export for Trial Balance**

```typescript
describe('GET /finance/reports/trial-balance/export', () => {
  it('returns CSV file with correct headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance/export?fiscalYear=2026&format=csv',
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('trial-balance-');
    expect(res.headers['content-disposition']).toContain('.csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Account Code');
  });

  it('returns Excel file when format=excel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance/export?fiscalYear=2026&format=excel',
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });
});
```

- [ ] **Step 2: Test CSV export for accounts list**

```typescript
describe('GET /finance/accounts/export', () => {
  it('returns CSV with account data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/export?format=csv',
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Code');
    expect(lines[0]).toContain('Name');
  });
});
```

- [ ] **Step 3: Add tests for remaining export endpoints**

Cover at minimum: P&L export, transaction journal export, journals list export, budgets list export. Verify correct Content-Type, Content-Disposition, and that the CSV body contains expected header columns.

---

## Verification

- [ ] Run: `cd apps/api && pnpm exec tsc --noEmit` — no type errors
- [ ] Run: `cd apps/api && pnpm test -- --grep export` — all export tests pass
- [ ] Manual: `curl "http://localhost:5100/finance/reports/trial-balance/export?fiscalYear=2026&format=csv"` — returns CSV file
- [ ] Manual: `curl "http://localhost:5100/finance/accounts/export?format=excel" -o test.xlsx` — opens in Excel correctly

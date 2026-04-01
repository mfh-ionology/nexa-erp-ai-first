# Finance Phase 2 Wave 7: Imports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CSV import endpoints for chart of accounts, journal entries, budget data, and exchange rates — enabling bulk data migration from legacy systems into Nexa Finance.

**Architecture:** One story (API-13) with a shared import parsing utility and 4 POST endpoints accepting multipart/form-data uploads. Each import validates rows individually, processes in batches of 100 within transactions, and returns detailed error reports per row.

**Tech Stack:** Fastify 5, csv-parse, @fastify/multipart, TypeScript strict

**Depends on:** Wave 1 (DB models), Waves 2-5 (entity APIs must exist for validation lookups)

**Blocked by this plan:** Wave 10 frontend (import pages)

---

## File Structure

### New Files
```
apps/api/src/modules/finance/import.service.ts           — Shared CSV parser + batch processor
apps/api/src/modules/finance/import.schema.ts            — Import option schemas + result schema
apps/api/src/modules/finance/import.routes.ts            — All 4 import POST endpoints
apps/api/src/modules/finance/import.routes.test.ts       — Tests for import endpoints
```

### Modified Files
```
apps/api/package.json                                    — Add csv-parse dependency (if not already present from Wave 6)
apps/api/src/modules/finance/index.ts                    — Register import routes plugin
```

### Reference Files (read-only)
```
apps/api/src/modules/finance/accounts.service.ts         — Account creation logic to reuse/mirror
apps/api/src/modules/finance/journals.service.ts         — Journal creation + posting logic
apps/api/src/modules/finance/budgets.service.ts          — Budget creation logic
apps/api/src/modules/finance/exchange-rates.service.ts   — Exchange rate creation logic
docs/superpowers/specs/2026-04-01-fin-phase2-design.md   — Design spec section 7.2
```

### Protected Files (DO NOT MODIFY)
```
packages/db/src/client.ts
packages/db/src/index.ts
packages/db/src/utils/sharing.ts
packages/db/src/services/number-series.service.ts
```

---

## Task 1: Install Import Dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install csv-parse**

```bash
cd apps/api && pnpm add csv-parse
```

Note: `@fastify/multipart` should already be installed for the bank-import feature. Verify:
```bash
cd apps/api && pnpm list @fastify/multipart
```
If not installed: `pnpm add @fastify/multipart`

- [ ] **Step 2: Verify @fastify/multipart is registered on the Fastify instance**

Check `apps/api/src/app.ts` or the plugin registration chain. If multipart is not already registered globally, register it in the finance module index or in the import routes plugin:

```typescript
import multipart from '@fastify/multipart';

async function importRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(multipart, { limits: { fileSize: 10_000_000 } }); // 10MB limit
  // ...routes
}
```

---

## Task 2: Create Import Schema

**Files:**
- Create: `apps/api/src/modules/finance/import.schema.ts`

- [ ] **Step 1: Define import option and result schemas**

```typescript
// import.schema.ts
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Import Result Schema (shared by all import endpoints)
// ---------------------------------------------------------------------------

export const importErrorSchema = z.object({
  row: z.number(),
  message: z.string(),
});

export const importResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  errors: z.array(importErrorSchema),
});

export type ImportResult = z.infer<typeof importResultSchema>;

// ---------------------------------------------------------------------------
// Account Import Row Schema
// ---------------------------------------------------------------------------

export const accountImportRowSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentCode: z.string().max(20).optional().default(''),
  classificationCode: z.string().max(10).optional().default(''),
  taxCode: z.string().max(20).optional().default(''),
  isPostable: z.preprocess(
    (v) => v === 'true' || v === '1' || v === true,
    z.boolean(),
  ),
});

// ---------------------------------------------------------------------------
// Journal Import Row Schema
// ---------------------------------------------------------------------------

export const journalImportRowSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional().default(''),
  accountCode: z.string().min(1).max(20),
  debit: z.preprocess(Number, z.number().min(0)),
  credit: z.preprocess(Number, z.number().min(0)),
  vatCode: z.string().max(20).optional().default(''),
});

// ---------------------------------------------------------------------------
// Budget Import Row Schema
// ---------------------------------------------------------------------------

export const budgetImportRowSchema = z.object({
  accountCode: z.string().min(1).max(20),
  period1: z.preprocess(Number, z.number()),
  period2: z.preprocess(Number, z.number()),
  period3: z.preprocess(Number, z.number()),
  period4: z.preprocess(Number, z.number()),
  period5: z.preprocess(Number, z.number()),
  period6: z.preprocess(Number, z.number()),
  period7: z.preprocess(Number, z.number()),
  period8: z.preprocess(Number, z.number()),
  period9: z.preprocess(Number, z.number()),
  period10: z.preprocess(Number, z.number()),
  period11: z.preprocess(Number, z.number()),
  period12: z.preprocess(Number, z.number()),
});

// ---------------------------------------------------------------------------
// Exchange Rate Import Row Schema
// ---------------------------------------------------------------------------

export const exchangeRateImportRowSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buyRate: z.preprocess(Number, z.number().positive()),
  sellRate: z.preprocess(Number, z.number().positive()),
  midRate: z.preprocess(Number, z.number().positive()),
  source: z.string().max(20).optional().default('MANUAL'),
});
```

---

## Task 3: Create Shared Import Service

**Files:**
- Create: `apps/api/src/modules/finance/import.service.ts`

- [ ] **Step 1: Create CSV parser utility**

```typescript
// import.service.ts
import { parse } from 'csv-parse/sync';
import type { ImportResult } from './import.schema.js';

/**
 * Parse a CSV buffer into an array of row objects.
 * Columns are derived from the first row (header row).
 */
export function parseCsv(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}
```

- [ ] **Step 2: Create batch processor utility**

```typescript
import type { PrismaClient } from '@nexa/db';

export type RowProcessor<T> = (
  prisma: PrismaClient,
  companyId: string,
  row: T,
  rowIndex: number,
) => Promise<void>;

/**
 * Process rows in batches of `batchSize` within individual transactions.
 * Collects per-row errors without aborting the entire import.
 */
export async function processBatch<T>(
  prisma: PrismaClient,
  companyId: string,
  rows: T[],
  processor: RowProcessor<T>,
  batchSize = 100,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    for (let j = 0; j < batch.length; j++) {
      const rowIndex = i + j + 2; // +2 for 1-indexed + header row
      try {
        await processor(prisma, companyId, batch[j], rowIndex);
        result.imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ row: rowIndex, message });
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: Add file extraction helper for multipart**

```typescript
import type { MultipartFile } from '@fastify/multipart';

/**
 * Read the uploaded file buffer from a Fastify multipart request.
 */
export async function readUploadedFile(
  file: MultipartFile,
): Promise<Buffer> {
  return file.toBuffer();
}
```

---

## Task 4: Create Account Import Endpoint

**Files:**
- Create: `apps/api/src/modules/finance/import.routes.ts`

- [ ] **Step 1: Create plugin skeleton with multipart registration**

```typescript
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { prisma } from '@nexa/db';

import {
  accountImportRowSchema,
  journalImportRowSchema,
  budgetImportRowSchema,
  exchangeRateImportRowSchema,
  importResultSchema,
} from './import.schema.js';
import type { ImportResult } from './import.schema.js';
import { parseCsv, processBatch, readUploadedFile } from './import.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

const importResultEnvelope = successEnvelope(importResultSchema);

async function importRoutes(fastify: FastifyInstance): Promise<void> {
  // Register multipart if not already registered
  await fastify.register(multipart, {
    limits: { fileSize: 10_000_000 }, // 10 MB
  });

  // ... endpoints follow
}

export const importRoutesPlugin = importRoutes;
```

- [ ] **Step 2: Add POST /accounts/import**

```typescript
  // POST /accounts/import — bulk import chart of accounts from CSV
  fastify.post(
    '/accounts/import',
    {
      preHandler: createPermissionGuard('finance.accounts', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);

      // Validate and type each row
      const validatedRows: Array<{ row: number; data: any }> = [];
      const errors: ImportResult['errors'] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = accountImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validatedRows.push({ row: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Process valid rows
      const result = await processBatch(
        prisma,
        ctx.companyId,
        validatedRows,
        async (tx, companyId, { data }) => {
          // Upsert: create or update if code exists
          await (tx as any).chartOfAccount.upsert({
            where: {
              companyId_code: { companyId, code: data.code },
            },
            create: {
              companyId,
              code: data.code,
              name: data.name,
              accountType: data.accountType,
              normalBalance: data.normalBalance,
              isPostable: data.isPostable,
              isActive: true,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
            update: {
              name: data.name,
              accountType: data.accountType,
              normalBalance: data.normalBalance,
              isPostable: data.isPostable,
              updatedBy: ctx.userId,
            },
          });
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );
```

---

## Task 5: Create Journal Import Endpoint

**Files:**
- Modify: `apps/api/src/modules/finance/import.routes.ts`

- [ ] **Step 1: Add POST /journals/import**

Key logic: group CSV rows by `transactionDate + description + reference` into journal entries. Each group becomes one JournalEntry with multiple JournalLines.

```typescript
  // POST /journals/import — bulk import journal entries from CSV
  fastify.post(
    '/journals/import',
    {
      preHandler: createPermissionGuard('finance.journals', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];

      // Validate rows
      const validRows: Array<{ index: number; data: any }> = [];
      for (let i = 0; i < rawRows.length; i++) {
        const parsed = journalImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Group lines by transactionDate + description + reference
      const groups = new Map<string, typeof validRows>();
      for (const row of validRows) {
        const key = `${row.data.transactionDate}|${row.data.description}|${row.data.reference ?? ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      let imported = 0;
      // Create one journal entry per group
      for (const [, groupRows] of groups) {
        try {
          const firstLine = groupRows[0].data;
          // Find the financial period for the transaction date
          const period = await (prisma as any).financialPeriod.findFirst({
            where: {
              companyId: ctx.companyId,
              startDate: { lte: new Date(firstLine.transactionDate) },
              endDate: { gte: new Date(firstLine.transactionDate) },
            },
          });

          if (!period) {
            for (const r of groupRows) {
              errors.push({ row: r.index, message: 'No financial period found for transaction date' });
            }
            continue;
          }

          // Validate debit/credit balance
          const totalDebit = groupRows.reduce((s, r) => s + r.data.debit, 0);
          const totalCredit = groupRows.reduce((s, r) => s + r.data.credit, 0);
          if (Math.abs(totalDebit - totalCredit) > 0.005) {
            for (const r of groupRows) {
              errors.push({ row: r.index, message: `Journal unbalanced: debit=${totalDebit}, credit=${totalCredit}` });
            }
            continue;
          }

          // Use the journal service's create function or direct Prisma
          // Direct Prisma for batch performance:
          await (prisma as any).journalEntry.create({
            data: {
              companyId: ctx.companyId,
              entryNumber: '', // Will be set by trigger/service
              transactionDate: new Date(firstLine.transactionDate),
              description: firstLine.description,
              reference: firstLine.reference || null,
              status: 'DRAFT',
              source: 'MANUAL',
              periodId: period.id,
              totalDebit,
              totalCredit,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
              lines: {
                create: groupRows.map((r, idx) => ({
                  companyId: ctx.companyId,
                  lineNumber: idx + 1,
                  accountCode: r.data.accountCode,
                  description: r.data.description,
                  debit: r.data.debit,
                  credit: r.data.credit,
                  createdBy: ctx.userId,
                  updatedBy: ctx.userId,
                })),
              },
            },
          });

          imported++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          for (const r of groupRows) {
            errors.push({ row: r.index, message });
          }
        }
      }

      return sendSuccess(reply, { imported, skipped: 0, errors });
    },
  );
```

---

## Task 6: Create Budget and Exchange Rate Import Endpoints

**Files:**
- Modify: `apps/api/src/modules/finance/import.routes.ts`

- [ ] **Step 1: Add POST /budgets/import**

Requires `fiscalYear` as a query param or in the multipart fields. Creates BudgetLine records for an existing or new budget.

```typescript
  // POST /budgets/import — import budget lines from CSV
  fastify.post(
    '/budgets/import',
    {
      preHandler: createPermissionGuard('finance.budgets', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const buffer = await readUploadedFile(data);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];
      const validRows: Array<{ index: number; data: any }> = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = budgetImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Process: each row becomes a BudgetLine
      // The caller should include budgetId in multipart fields or create a new budget
      const result = await processBatch(
        prisma,
        ctx.companyId,
        validRows,
        async (tx, companyId, { data }, rowIndex) => {
          // Validate account exists
          const account = await (tx as any).chartOfAccount.findUnique({
            where: { companyId_code: { companyId, code: data.accountCode } },
          });
          if (!account) {
            throw new Error(`Account ${data.accountCode} not found`);
          }

          const total = Object.keys(data)
            .filter((k) => k.startsWith('period'))
            .reduce((s, k) => s + (data[k] as number), 0);

          // Create budget line (associated budget ID from request fields)
          // Implementation note: budget association handled via multipart fields
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );
```

- [ ] **Step 2: Add POST /exchange-rates/import**

```typescript
  // POST /exchange-rates/import — import historical exchange rates from CSV
  fastify.post(
    '/exchange-rates/import',
    {
      preHandler: createPermissionGuard('finance.exchange-rates', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];
      const validRows: Array<{ index: number; data: any }> = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = exchangeRateImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      const result = await processBatch(
        prisma,
        ctx.companyId,
        validRows,
        async (tx, companyId, { data }) => {
          await (tx as any).exchangeRate.upsert({
            where: {
              companyId_currencyCode_rateDate: {
                companyId,
                currencyCode: data.currencyCode,
                rateDate: new Date(data.rateDate),
              },
            },
            create: {
              companyId,
              currencyCode: data.currencyCode,
              rateDate: new Date(data.rateDate),
              buyRate: data.buyRate,
              sellRate: data.sellRate,
              midRate: data.midRate,
              source: data.source,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
            update: {
              buyRate: data.buyRate,
              sellRate: data.sellRate,
              midRate: data.midRate,
              source: data.source,
              updatedBy: ctx.userId,
            },
          });
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );
```

---

## Task 7: Register Import Plugin

**Files:**
- Modify: `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Import and register**

```typescript
import { importRoutesPlugin } from './import.routes.js';
```

Add inside `financeModule()`:
```typescript
  await fastify.register(importRoutesPlugin);
```

---

## Task 8: Write Tests

**Files:**
- Create: `apps/api/src/modules/finance/import.routes.test.ts`

- [ ] **Step 1: Test account import — happy path**

```typescript
describe('POST /finance/accounts/import', () => {
  it('imports valid CSV and returns count', async () => {
    const csv = 'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n'
      + '9001,Test Import,ASSET,DEBIT,,,, true\n';

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { ...authHeaders },
      payload: csv,
      // Use multipart injection
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBeGreaterThanOrEqual(1);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns row-level errors for invalid rows', async () => {
    const csv = 'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n'
      + ',Missing Code,ASSET,DEBIT,,,,true\n';

    // ... inject multipart
    const body = res.json();
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].row).toBe(2);
  });
});
```

- [ ] **Step 2: Test journal import — grouping logic**

Verify that rows with the same date+description+reference are grouped into a single journal entry.

- [ ] **Step 3: Test exchange rate import — upsert behavior**

Verify that importing the same currency+date twice updates rather than duplicates.

- [ ] **Step 4: Test error cases**

- No file uploaded -> 400
- Empty CSV -> imported: 0
- Unbalanced journal lines -> row-level error

---

## Verification

- [ ] Run: `cd apps/api && pnpm exec tsc --noEmit` — no type errors
- [ ] Run: `cd apps/api && pnpm test -- --grep import` — all import tests pass
- [ ] Manual: POST a valid accounts CSV via curl or Postman to `http://localhost:5100/finance/accounts/import` — returns `{ imported: N, errors: [] }`
- [ ] Manual: POST a journal CSV with 4 lines (2 entries x 2 lines each) — creates 2 journal entries

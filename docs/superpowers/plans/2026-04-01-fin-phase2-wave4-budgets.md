# Finance Phase 2 Wave 4: Budget Redesign APIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Budget Redesign APIs — BudgetVersion CRUD, BudgetKey CRUD + apply, Budget Dimension Splits CRUD — transforming the rigid ANNUAL/REVISED budget system into a flexible versioned model with allocation patterns and dimensional splits.

**Architecture:** Three independent stories (API-5, API-6, API-7) that can execute in parallel. Each produces a complete set of schema, service, routes, and tests following the established finance module patterns.

**Tech Stack:** Fastify 5, Zod, Prisma 7, Vitest, TypeScript strict

**Design Spec:** `docs/superpowers/specs/2026-04-01-fin-phase2-design.md` section 4 (Feature 3: Budget Redesign)

**Depends on:** Wave 1 (DB-1) must be complete — `BudgetVersion`, `BudgetKey`, and `BudgetLineDimension` tables must exist in the Prisma schema with migrations applied.

**Blocked by this plan:** Wave 8 frontend stories (FE-4: Budget form enhancements, FE-5: Budget Versions + Budget Keys settings)

---

## Pre-flight Checklist

Before starting any task, verify:

- [ ] `BudgetVersion` model exists in `packages/db/prisma/schema.prisma` with fields: id, companyId, fiscalYear, versionNumber, versionName, copiedFromVersionId, isActive, createdAt, updatedAt, createdBy
- [ ] `BudgetKey` model exists in `packages/db/prisma/schema.prisma` with fields: id, companyId, name, pct1-pct12, isActive, createdAt, updatedAt, createdBy
- [ ] `BudgetLineDimension` model exists in `packages/db/prisma/schema.prisma` with fields: id, budgetLineId, dimensionTypeId, dimensionValueId, period1-12, totalAmount, createdAt, updatedAt
- [ ] `Budget` model has `budgetVersionId` (nullable) FK to `BudgetVersion`
- [ ] `BudgetLine` model has `dimensionSplits BudgetLineDimension[]` relation
- [ ] Migrations have been applied: `pnpm --filter @nexa/db prisma migrate dev`
- [ ] Prisma client has been regenerated: `pnpm --filter @nexa/db prisma generate`

---

## Story API-5: Budget Versions CRUD

### File Structure

```
apps/api/src/modules/finance/budget-versions.schema.ts    — CREATE
apps/api/src/modules/finance/budget-versions.service.ts    — CREATE
apps/api/src/modules/finance/budget-versions.routes.ts     — CREATE
apps/api/src/modules/finance/budget-versions.routes.test.ts — CREATE
apps/api/src/modules/finance/budgets.schema.ts             — MODIFY (add budgetVersionId)
apps/api/src/modules/finance/budgets.service.ts            — MODIFY (create budget accepts budgetVersionId)
apps/api/src/modules/finance/index.ts                      — MODIFY (register new route plugin)
```

### Task 5.1: Create budget-versions.schema.ts

**File:** `apps/api/src/modules/finance/budget-versions.schema.ts`

- [ ] **Step 1: Create the schema file with all Zod schemas**

The file must define:

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createBudgetVersionSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  versionName: z.string().min(1, 'Version name is required').max(100),
  copyFromVersionId: z.string().uuid().optional(),
});

export const updateBudgetVersionSchema = z
  .object({
    versionName: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const budgetVersionParamsSchema = z.object({
  id: z.uuid(),
});

export const listBudgetVersionsQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetVersionListItemSchema = z.object({
  id: z.string(),
  fiscalYear: z.number(),
  versionNumber: z.number(),
  versionName: z.string(),
  copiedFromVersionId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  _count: z.object({
    budgets: z.number(),
  }).optional(),
});

export const budgetVersionDetailSchema = budgetVersionListItemSchema.extend({
  copiedFromVersion: z.object({
    id: z.string(),
    versionName: z.string(),
    versionNumber: z.number(),
  }).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>;
export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>;
export type ListBudgetVersionsQuery = z.infer<typeof listBudgetVersionsQuerySchema>;
export type BudgetVersionListItem = z.infer<typeof budgetVersionListItemSchema>;
export type BudgetVersionDetail = z.infer<typeof budgetVersionDetailSchema>;
```

### Task 5.2: Create budget-versions.service.ts

**File:** `apps/api/src/modules/finance/budget-versions.service.ts`

- [ ] **Step 1: Create the service file**

Follow the pattern from `budgets.service.ts` and `journal-templates.service.ts`. The service must implement:

**Prisma select shapes:**

```typescript
const LIST_SELECT = {
  id: true,
  fiscalYear: true,
  versionNumber: true,
  versionName: true,
  copiedFromVersionId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  _count: { select: { budgets: true } },
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  copiedFromVersion: {
    select: { id: true, versionName: true, versionNumber: true },
  },
} as const;
```

**Functions to implement:**

1. `listBudgetVersions(prisma, companyId, query)` — cursor-based pagination, optional `fiscalYear` filter. Order by `fiscalYear DESC, versionNumber ASC`. Return `{ data, meta }`.

2. `getBudgetVersionById(prisma, companyId, id)` — find by id + companyId. Throw `NotFoundError` if missing. Use DETAIL_SELECT.

3. `createBudgetVersion(prisma, companyId, data, userId)` — within a `$transaction`:
   - Auto-assign `versionNumber`: query `MAX(versionNumber)` for the given companyId + fiscalYear, increment by 1 (or start at 1).
   - Create the `BudgetVersion` record.
   - If `copyFromVersionId` is provided:
     - Validate the source version exists and belongs to the same company.
     - Copy all budgets from the source version into the new version:
       - For each budget in the source version, create a new budget with `budgetVersionId` set to the new version's id.
       - Copy all `BudgetLine` records for each budget.
       - Copy all `BudgetLineDimension` records for each budget line.
     - Set `copiedFromVersionId` on the new version record.
   - Return the created version using DETAIL_SELECT.

4. `updateBudgetVersion(prisma, companyId, id, data, userId)` — find + update. Throw `NotFoundError` if missing. Only allow updating `versionName` and `isActive`. Return updated record.

**Key implementation notes:**
- The copy logic is the most complex part. Use a transaction to ensure atomicity.
- When copying budgets, generate new UUIDs for all copied records.
- The `versionNumber` auto-increment must be race-safe inside the transaction.
- Use `Prisma.Decimal` to `number` conversion for any decimal fields in copied budget lines (same `toNumber` pattern as `budgets.service.ts`).

### Task 5.3: Create budget-versions.routes.ts

**File:** `apps/api/src/modules/finance/budget-versions.routes.ts`

- [ ] **Step 1: Create the routes file**

Follow the exact pattern from `budgets.routes.ts` / `journal-templates.routes.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createBudgetVersionSchema,
  updateBudgetVersionSchema,
  listBudgetVersionsQuerySchema,
  budgetVersionParamsSchema,
  budgetVersionDetailSchema,
  budgetVersionListItemSchema,
} from './budget-versions.schema.js';
import type { ListBudgetVersionsQuery } from './budget-versions.schema.js';
import {
  listBudgetVersions,
  getBudgetVersionById,
  createBudgetVersion,
  updateBudgetVersion,
} from './budget-versions.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
```

**Routes to register:**

| Method | Path | Permission | Service Function | Status Code |
|--------|------|------------|------------------|-------------|
| GET | `/budget-versions` | `finance.budgets` view | `listBudgetVersions` | 200 |
| GET | `/budget-versions/:id` | `finance.budgets` view | `getBudgetVersionById` | 200 |
| POST | `/budget-versions` | `finance.budgets` new | `createBudgetVersion` | 201 |
| PATCH | `/budget-versions/:id` | `finance.budgets` edit | `updateBudgetVersion` | 200 |

Export as `budgetVersionsRoutesPlugin`.

### Task 5.4: Modify budgets.schema.ts — add budgetVersionId

**File:** `apps/api/src/modules/finance/budgets.schema.ts`

- [ ] **Step 1: Add budgetVersionId to createBudgetSchema**

In `createBudgetSchema`, add:
```typescript
budgetVersionId: z.string().uuid().optional(),
```

- [ ] **Step 2: Add budgetVersionId to listBudgetsQuerySchema**

In `listBudgetsQuerySchema`, add:
```typescript
budgetVersionId: z.string().uuid().optional(),
```

- [ ] **Step 3: Add budgetVersionId to response schemas**

In `budgetListItemSchema`, add:
```typescript
budgetVersionId: z.string().nullable(),
```

In `budgetDetailSchema` (which extends `budgetListItemSchema`), no additional change needed since it inherits.

### Task 5.5: Modify budgets.service.ts — support budgetVersionId

**File:** `apps/api/src/modules/finance/budgets.service.ts`

- [ ] **Step 1: Update LIST_SELECT and DETAIL_SELECT to include budgetVersionId**

Add `budgetVersionId: true` to both select shapes.

- [ ] **Step 2: Update listBudgets to support budgetVersionId filter**

In `listBudgets`, add the filter:
```typescript
if (budgetVersionId !== undefined) where.budgetVersionId = budgetVersionId;
```

- [ ] **Step 3: Update createBudget to accept budgetVersionId**

In `createBudget`, include `budgetVersionId` in the `prisma.budget.create` data:
```typescript
budgetVersionId: data.budgetVersionId ?? null,
```

- [ ] **Step 4: Update copyBudget to accept optional targetVersionId**

Modify `copyBudget` signature to accept an optional `targetVersionId`:
```typescript
export async function copyBudget(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  userId: string,
  targetVersionId?: string,
)
```

When `targetVersionId` is provided, set `budgetVersionId` on the copy. Otherwise preserve original behavior.

### Task 5.6: Register budget-versions routes in index.ts

**File:** `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Add import and registration**

Add import:
```typescript
import { budgetVersionsRoutesPlugin } from './budget-versions.routes.js';
```

Add registration (before budgetsRoutesPlugin):
```typescript
await fastify.register(budgetVersionsRoutesPlugin);
```

### Task 5.7: Create budget-versions.routes.test.ts

**File:** `apps/api/src/modules/finance/budget-versions.routes.test.ts`

- [ ] **Step 1: Create the test file following the exact pattern from budgets.routes.test.ts**

Use the same test setup infrastructure:
- `vi.hoisted` for mock declarations
- `vi.mock('@nexa/db', ...)` with `mockPrisma` including `budgetVersion`, `budget`, `budgetLine`, `budgetLineDimension` models
- `vi.mock('../../core/rbac/permission.service.js', ...)`
- Same JWT helper, `buildTestApp`, `setupMocks`, `beforeAll`/`beforeEach`/`afterEach` pattern

**Mock Prisma shape additions:**
```typescript
budgetVersion: {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
},
```

Register the `budgetVersionsRoutesPlugin` in `buildTestApp` under `/finance` prefix.

**Test cases to implement:**

**GET /finance/budget-versions:**
- [ ] Returns list of budget versions with pagination meta
- [ ] Filters by fiscalYear
- [ ] Returns 401 without auth token

**GET /finance/budget-versions/:id:**
- [ ] Returns budget version detail with copiedFromVersion
- [ ] Returns 404 for non-existent version
- [ ] Returns 401 without auth token

**POST /finance/budget-versions:**
- [ ] Creates a budget version with auto-assigned versionNumber
- [ ] Creates a budget version with copyFromVersionId (copies all budgets + lines)
- [ ] Returns 404 when copyFromVersionId does not exist
- [ ] Returns 401 without auth token

**PATCH /finance/budget-versions/:id:**
- [ ] Updates versionName
- [ ] Updates isActive (deactivation)
- [ ] Returns 404 for non-existent version
- [ ] Returns 401 without auth token

**Expected test count: 12 tests minimum.**

---

## Story API-6: Budget Keys CRUD + Apply

### File Structure

```
apps/api/src/modules/finance/budget-keys.schema.ts        — CREATE
apps/api/src/modules/finance/budget-keys.service.ts        — CREATE
apps/api/src/modules/finance/budget-keys.routes.ts         — CREATE
apps/api/src/modules/finance/budget-keys.routes.test.ts    — CREATE
apps/api/src/modules/finance/index.ts                      — MODIFY (register new route plugin)
```

### Task 6.1: Create budget-keys.schema.ts

**File:** `apps/api/src/modules/finance/budget-keys.schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Percentage field: Decimal(7,4) represented as number, 0-100 range */
const pctField = z.number().min(0).max(100);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createBudgetKeySchema = z.object({
  name: z.string().min(1, 'Budget key name is required').max(100),
  pct1: pctField,
  pct2: pctField,
  pct3: pctField,
  pct4: pctField,
  pct5: pctField,
  pct6: pctField,
  pct7: pctField,
  pct8: pctField,
  pct9: pctField,
  pct10: pctField,
  pct11: pctField,
  pct12: pctField,
}).refine(
  (data) => {
    const sum = data.pct1 + data.pct2 + data.pct3 + data.pct4 +
      data.pct5 + data.pct6 + data.pct7 + data.pct8 +
      data.pct9 + data.pct10 + data.pct11 + data.pct12;
    return Math.abs(sum - 100) < 0.01; // tolerance for floating point
  },
  { message: 'Percentages must sum to 100' },
);

export const updateBudgetKeySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    pct1: pctField.optional(),
    pct2: pctField.optional(),
    pct3: pctField.optional(),
    pct4: pctField.optional(),
    pct5: pctField.optional(),
    pct6: pctField.optional(),
    pct7: pctField.optional(),
    pct8: pctField.optional(),
    pct9: pctField.optional(),
    pct10: pctField.optional(),
    pct11: pctField.optional(),
    pct12: pctField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });
  // NOTE: if any pct field is provided, ALL 12 must be provided and sum validated.
  // Implement this as a superRefine or secondary refinement on the update schema.

export const applyBudgetKeySchema = z.object({
  annualAmount: z.number().min(0, 'Annual amount must be non-negative'),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const budgetKeyParamsSchema = z.object({
  id: z.uuid(),
});

export const listBudgetKeysQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetKeyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  pct1: z.number(),
  pct2: z.number(),
  pct3: z.number(),
  pct4: z.number(),
  pct5: z.number(),
  pct6: z.number(),
  pct7: z.number(),
  pct8: z.number(),
  pct9: z.number(),
  pct10: z.number(),
  pct11: z.number(),
  pct12: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
});

export const applyBudgetKeyResultSchema = z.object({
  period1: z.number(),
  period2: z.number(),
  period3: z.number(),
  period4: z.number(),
  period5: z.number(),
  period6: z.number(),
  period7: z.number(),
  period8: z.number(),
  period9: z.number(),
  period10: z.number(),
  period11: z.number(),
  period12: z.number(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBudgetKeyInput = z.infer<typeof createBudgetKeySchema>;
export type UpdateBudgetKeyInput = z.infer<typeof updateBudgetKeySchema>;
export type ApplyBudgetKeyInput = z.infer<typeof applyBudgetKeySchema>;
export type ListBudgetKeysQuery = z.infer<typeof listBudgetKeysQuerySchema>;
export type BudgetKeyItem = z.infer<typeof budgetKeyItemSchema>;
```

### Task 6.2: Create budget-keys.service.ts

**File:** `apps/api/src/modules/finance/budget-keys.service.ts`

- [ ] **Step 1: Create the service file**

**Prisma select shape:**

```typescript
const ITEM_SELECT = {
  id: true,
  name: true,
  pct1: true,
  pct2: true,
  pct3: true,
  pct4: true,
  pct5: true,
  pct6: true,
  pct7: true,
  pct8: true,
  pct9: true,
  pct10: true,
  pct11: true,
  pct12: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;
```

**Helper: `normaliseKey(row)`** — convert all `pct{N}` Decimal fields to numbers using the `toNumber` pattern from `budgets.service.ts`.

**PCT_FIELDS constant:** `['pct1', 'pct2', ..., 'pct12'] as const`

**Functions to implement:**

1. `listBudgetKeys(prisma, companyId, query)` — cursor-based pagination, optional `isActive` filter. Order by `name ASC`. Return `{ data: normalised[], meta }`.

2. `getBudgetKeyById(prisma, companyId, id)` — find by id + companyId. Throw `NotFoundError` if missing. Return normalised.

3. `createBudgetKey(prisma, companyId, data, userId)` — check uniqueness of name within company (Prisma unique constraint `uq_budget_key_company_name` will catch this, but provide a friendly error). Create record. Return normalised.

4. `updateBudgetKey(prisma, companyId, id, data, userId)` — find + update. Throw `NotFoundError` if missing. If any `pct{N}` field is being updated, require all 12 to be present in the update data and validate sum = 100 server-side. Return normalised.

5. `deleteBudgetKey(prisma, companyId, id)` — hard delete. Throw `NotFoundError` if missing. Return void. (Budget keys have no FK references from other tables, so hard delete is safe.)

6. `applyBudgetKey(prisma, companyId, id, annualAmount)` — fetch the key, compute `period{N} = annualAmount * pct{N} / 100` for N=1..11. For period12, compute as `annualAmount - sum(period1..11)` to absorb rounding. Return the 12 period amounts as `{ period1, period2, ..., period12 }`. This is a pure calculation — nothing is saved.

**Key implementation notes:**
- The apply endpoint is read-only: it returns calculated values for the client to apply locally.
- Rounding absorption on period 12 ensures exact total matches the annual amount.
- The `Prisma.Decimal` to number conversion must be applied to all pct fields.

### Task 6.3: Create budget-keys.routes.ts

**File:** `apps/api/src/modules/finance/budget-keys.routes.ts`

- [ ] **Step 1: Create the routes file**

Follow the same plugin pattern:

**Routes to register:**

| Method | Path | Permission | Service Function | Status Code |
|--------|------|------------|------------------|-------------|
| GET | `/budget-keys` | `finance.budgets` view | `listBudgetKeys` | 200 |
| GET | `/budget-keys/:id` | `finance.budgets` view | `getBudgetKeyById` | 200 |
| POST | `/budget-keys` | `finance.budgets` new | `createBudgetKey` | 201 |
| PATCH | `/budget-keys/:id` | `finance.budgets` edit | `updateBudgetKey` | 200 |
| DELETE | `/budget-keys/:id` | `finance.budgets` delete | `deleteBudgetKey` | 204 |
| POST | `/budget-keys/:id/apply` | `finance.budgets` view | `applyBudgetKey` | 200 |

For the DELETE route, use `reply.status(204).send()` (no body).
For the apply route, the body uses `applyBudgetKeySchema` and response uses `applyBudgetKeyResultSchema`.

Export as `budgetKeysRoutesPlugin`.

### Task 6.4: Register budget-keys routes in index.ts

**File:** `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Add import and registration**

Add import:
```typescript
import { budgetKeysRoutesPlugin } from './budget-keys.routes.js';
```

Add registration (after budgetVersionsRoutesPlugin, before budgetsRoutesPlugin):
```typescript
await fastify.register(budgetKeysRoutesPlugin);
```

### Task 6.5: Create budget-keys.routes.test.ts

**File:** `apps/api/src/modules/finance/budget-keys.routes.test.ts`

- [ ] **Step 1: Create the test file following the budgets.routes.test.ts pattern**

**Mock Prisma shape additions:**
```typescript
budgetKey: {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
},
```

Register `budgetKeysRoutesPlugin` in `buildTestApp` under `/finance` prefix.

**Mock helper: `makeMockBudgetKey(overrides)`:**
```typescript
function makeMockBudgetKey(overrides = {}) {
  return {
    id: TEST_BUDGET_KEY_ID,
    name: 'Even Split',
    pct1: 8.3333, pct2: 8.3333, pct3: 8.3333,
    pct4: 8.3333, pct5: 8.3333, pct6: 8.3333,
    pct7: 8.3333, pct8: 8.3333, pct9: 8.3333,
    pct10: 8.3333, pct11: 8.3333, pct12: 8.3337,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    ...overrides,
  };
}
```

**Test cases to implement:**

**GET /finance/budget-keys:**
- [ ] Returns list of budget keys with pagination meta
- [ ] Filters by isActive
- [ ] Returns 401 without auth token

**GET /finance/budget-keys/:id:**
- [ ] Returns budget key detail
- [ ] Returns 404 for non-existent key
- [ ] Returns 401 without auth token

**POST /finance/budget-keys:**
- [ ] Creates a budget key with valid percentages summing to 100
- [ ] Rejects when percentages do not sum to 100
- [ ] Rejects when name is empty
- [ ] Returns 401 without auth token

**PATCH /finance/budget-keys/:id:**
- [ ] Updates name
- [ ] Rejects update on non-existent key (404)
- [ ] Returns 401 without auth token

**DELETE /finance/budget-keys/:id:**
- [ ] Deletes an existing budget key (204)
- [ ] Returns 404 for non-existent key
- [ ] Returns 401 without auth token

**POST /finance/budget-keys/:id/apply:**
- [ ] Applies even split key to annual amount (120,000 -> 10,000 x 12)
- [ ] Absorbs rounding into period 12 for uneven splits
- [ ] Returns 404 for non-existent key
- [ ] Returns 401 without auth token

**Expected test count: 17 tests minimum.**

---

## Story API-7: Budget Dimension Splits CRUD + Validation

### File Structure

```
apps/api/src/modules/finance/budget-dimension-splits.schema.ts     — CREATE
apps/api/src/modules/finance/budget-dimension-splits.service.ts     — CREATE
apps/api/src/modules/finance/budget-dimension-splits.routes.ts      — CREATE
apps/api/src/modules/finance/budget-dimension-splits.routes.test.ts — CREATE
apps/api/src/modules/finance/index.ts                               — MODIFY (register new route plugin)
```

### Task 7.1: Create budget-dimension-splits.schema.ts

**File:** `apps/api/src/modules/finance/budget-dimension-splits.schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const periodAmount = z.number().default(0);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const splitLineSchema = z.object({
  dimensionValueId: z.string().uuid(),
  period1: periodAmount,
  period2: periodAmount,
  period3: periodAmount,
  period4: periodAmount,
  period5: periodAmount,
  period6: periodAmount,
  period7: periodAmount,
  period8: periodAmount,
  period9: periodAmount,
  period10: periodAmount,
  period11: periodAmount,
  period12: periodAmount,
});

export const putDimensionSplitsSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  splits: z.array(splitLineSchema).min(1, 'At least one split is required'),
});

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const budgetLineSplitParamsSchema = z.object({
  budgetId: z.uuid(),
  lineId: z.uuid(),
});

export const deleteSplitParamsSchema = z.object({
  budgetId: z.uuid(),
  lineId: z.uuid(),
  dimensionTypeId: z.uuid(),
});

export const listSplitsQuerySchema = z.object({
  dimensionTypeId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetLineDimensionSchema = z.object({
  id: z.string(),
  budgetLineId: z.string(),
  dimensionTypeId: z.string(),
  dimensionValueId: z.string(),
  period1: z.number(),
  period2: z.number(),
  period3: z.number(),
  period4: z.number(),
  period5: z.number(),
  period6: z.number(),
  period7: z.number(),
  period8: z.number(),
  period9: z.number(),
  period10: z.number(),
  period11: z.number(),
  period12: z.number(),
  totalAmount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type PutDimensionSplitsInput = z.infer<typeof putDimensionSplitsSchema>;
export type BudgetLineSplitParams = z.infer<typeof budgetLineSplitParamsSchema>;
export type DeleteSplitParams = z.infer<typeof deleteSplitParamsSchema>;
export type ListSplitsQuery = z.infer<typeof listSplitsQuerySchema>;
```

### Task 7.2: Create budget-dimension-splits.service.ts

**File:** `apps/api/src/modules/finance/budget-dimension-splits.service.ts`

- [ ] **Step 1: Create the service file**

**PERIOD_FIELDS constant:** `['period1', 'period2', ..., 'period12'] as const`

**Prisma select shape:**

```typescript
const SPLIT_SELECT = {
  id: true,
  budgetLineId: true,
  dimensionTypeId: true,
  dimensionValueId: true,
  period1: true,
  period2: true,
  period3: true,
  period4: true,
  period5: true,
  period6: true,
  period7: true,
  period8: true,
  period9: true,
  period10: true,
  period11: true,
  period12: true,
  totalAmount: true,
  createdAt: true,
  updatedAt: true,
} as const;
```

**Helper functions:** `toNumber`, `normaliseSplit` — same Decimal-to-number conversion pattern as `budgets.service.ts`.

**Functions to implement:**

1. `listDimensionSplits(prisma, companyId, budgetId, lineId, query)`:
   - Validate the budget exists and belongs to company: `prisma.budget.findFirst({ where: { id: budgetId, companyId } })`
   - Validate the budget line exists and belongs to the budget: `prisma.budgetLine.findFirst({ where: { id: lineId, budgetId } })`
   - Query `budgetLineDimension` for the line, optionally filtered by `dimensionTypeId`.
   - Return normalised array.

2. `putDimensionSplits(prisma, companyId, budgetId, lineId, data)` — the core write operation, within a `$transaction`:
   - Validate budget exists + company ownership. Throw `NotFoundError` if missing.
   - Validate budget is DRAFT status. Throw `DomainError('BUDGET_NOT_DRAFT', ...)` if not.
   - Validate budget line exists + belongs to budget. Throw `NotFoundError` if missing.
   - Validate `dimensionTypeId` exists: `prisma.dimensionType.findFirst({ where: { id: data.dimensionTypeId, companyId } })`. Throw `NotFoundError` if missing.
   - Validate all `dimensionValueId`s exist and belong to the given dimension type.
   - **Period sum validation:** For each period (1-12), sum the split amounts across all splits. Compare with the parent budget line's period amount. If any period sum does not match the parent line amount, throw `AppError('SPLIT_SUM_MISMATCH', 'Dimension split totals for period {N} ({splitSum}) do not match parent line amount ({lineAmount})', 400)`. Use a tolerance of 0.01 for floating-point comparison.
   - Delete existing splits for this line + dimension type: `prisma.budgetLineDimension.deleteMany({ where: { budgetLineId: lineId, dimensionTypeId: data.dimensionTypeId } })`.
   - Create new splits from the input, computing `totalAmount` for each split as the sum of period1-12.
   - Return the newly created splits (normalised).

3. `deleteDimensionSplits(prisma, companyId, budgetId, lineId, dimensionTypeId)`:
   - Validate budget exists + company ownership.
   - Validate budget is DRAFT.
   - Validate budget line exists.
   - Delete all `budgetLineDimension` records for the line + dimension type.
   - If none existed, throw `NotFoundError`.
   - Return void.

**Key implementation notes:**
- The PUT endpoint is idempotent: it replaces all splits for a given line + dimension type combination.
- The sum validation is critical: per the spec, "For a given budget line and dimension type, the sum of all BudgetLineDimension.period{N} values must equal the parent BudgetLine.period{N}."
- Use `Prisma.Decimal` for comparison — convert both sides to numbers before comparing.

### Task 7.3: Create budget-dimension-splits.routes.ts

**File:** `apps/api/src/modules/finance/budget-dimension-splits.routes.ts`

- [ ] **Step 1: Create the routes file**

**Routes to register:**

| Method | Path | Permission | Service Function | Status Code |
|--------|------|------------|------------------|-------------|
| GET | `/budgets/:budgetId/lines/:lineId/dimension-splits` | `finance.budgets` view | `listDimensionSplits` | 200 |
| PUT | `/budgets/:budgetId/lines/:lineId/dimension-splits` | `finance.budgets` edit | `putDimensionSplits` | 200 |
| DELETE | `/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId` | `finance.budgets` edit | `deleteDimensionSplits` | 204 |

For the DELETE route, return `reply.status(204).send()`.

Export as `budgetDimensionSplitsRoutesPlugin`.

### Task 7.4: Register budget-dimension-splits routes in index.ts

**File:** `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Add import and registration**

Add import:
```typescript
import { budgetDimensionSplitsRoutesPlugin } from './budget-dimension-splits.routes.js';
```

Add registration (after budgetsRoutesPlugin):
```typescript
await fastify.register(budgetDimensionSplitsRoutesPlugin);
```

### Task 7.5: Create budget-dimension-splits.routes.test.ts

**File:** `apps/api/src/modules/finance/budget-dimension-splits.routes.test.ts`

- [ ] **Step 1: Create the test file following the budgets.routes.test.ts pattern**

**Mock Prisma shape additions (beyond the standard base):**
```typescript
budget: {
  findFirst: vi.fn(),
},
budgetLine: {
  findFirst: vi.fn(),
},
budgetLineDimension: {
  findMany: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
},
dimensionType: {
  findFirst: vi.fn(),
},
dimensionValue: {
  findMany: vi.fn(),
},
$transaction: vi.fn(),
```

Register `budgetDimensionSplitsRoutesPlugin` in `buildTestApp` under `/finance` prefix.

Also register `budgetsRoutesPlugin` since the dimension split routes are nested under `/budgets/...`.

**Mock helpers:**

```typescript
const TEST_BUDGET_LINE_ID = '33333333-3333-4000-a000-333333333333';
const TEST_DIM_TYPE_ID = '44444444-4444-4000-a000-444444444444';
const TEST_DIM_VALUE_ID_1 = '55555555-5555-4000-a000-555555555555';
const TEST_DIM_VALUE_ID_2 = '66666666-6666-4000-a000-666666666666';
const TEST_SPLIT_ID_1 = '77777777-7777-4000-a000-777777777777';

function makeMockBudgetLine(overrides = {}) {
  return {
    id: TEST_BUDGET_LINE_ID,
    budgetId: TEST_BUDGET_ID,
    accountCode: '4000',
    period1: 1000, period2: 1000, period3: 1000,
    period4: 1000, period5: 1000, period6: 1000,
    period7: 1000, period8: 1000, period9: 1000,
    period10: 1000, period11: 1000, period12: 1000,
    totalAmount: 12000,
    ...overrides,
  };
}

function makeMockSplit(overrides = {}) {
  return {
    id: TEST_SPLIT_ID_1,
    budgetLineId: TEST_BUDGET_LINE_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
    dimensionValueId: TEST_DIM_VALUE_ID_1,
    period1: 600, period2: 600, period3: 600,
    period4: 600, period5: 600, period6: 600,
    period7: 600, period8: 600, period9: 600,
    period10: 600, period11: 600, period12: 600,
    totalAmount: 7200,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
```

**Test cases to implement:**

**GET /finance/budgets/:budgetId/lines/:lineId/dimension-splits:**
- [ ] Returns splits for a budget line
- [ ] Filters by dimensionTypeId
- [ ] Returns 404 when budget does not exist
- [ ] Returns 404 when budget line does not exist
- [ ] Returns 401 without auth token

**PUT /finance/budgets/:budgetId/lines/:lineId/dimension-splits:**
- [ ] Creates dimension splits when sums match parent line periods
- [ ] Rejects when period sums do not match parent line (SPLIT_SUM_MISMATCH)
- [ ] Rejects when budget is not DRAFT (409)
- [ ] Rejects when dimension type does not exist (404)
- [ ] Rejects when dimension value does not exist (400)
- [ ] Returns 404 when budget does not exist
- [ ] Returns 401 without auth token

**DELETE /finance/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId:**
- [ ] Deletes all splits for a dimension type on a line (204)
- [ ] Returns 404 when no splits exist for that dimension type
- [ ] Rejects when budget is not DRAFT (409)
- [ ] Returns 401 without auth token

**Expected test count: 15 tests minimum.**

---

## Final Verification

After all three stories are complete:

- [ ] **TypeScript check:** `pnpm --filter api tsc --noEmit` passes with zero errors
- [ ] **Lint check:** `pnpm --filter api lint` passes
- [ ] **All new tests pass:** `pnpm --filter api vitest run --reporter=verbose apps/api/src/modules/finance/budget-versions.routes.test.ts apps/api/src/modules/finance/budget-keys.routes.test.ts apps/api/src/modules/finance/budget-dimension-splits.routes.test.ts`
- [ ] **Existing budget tests still pass:** `pnpm --filter api vitest run --reporter=verbose apps/api/src/modules/finance/budgets.routes.test.ts`
- [ ] **All finance tests pass:** `pnpm --filter api vitest run --reporter=verbose apps/api/src/modules/finance/`
- [ ] **Route registration verified:** The finance index.ts imports and registers all three new plugins
- [ ] **No protected files modified:** Verify `packages/db/src/client.ts`, `packages/db/src/index.ts`, `packages/db/src/utils/sharing.ts`, `packages/db/src/utils/rbac.ts` are untouched

---

## Summary

| Story | Files Created | Files Modified | Test Count | Key Endpoints |
|-------|--------------|----------------|------------|---------------|
| API-5: Budget Versions | 4 (schema, service, routes, test) | 3 (budgets.schema, budgets.service, index) | 12+ | GET/POST/PATCH /budget-versions |
| API-6: Budget Keys | 4 (schema, service, routes, test) | 1 (index) | 17+ | GET/POST/PATCH/DELETE /budget-keys, POST /budget-keys/:id/apply |
| API-7: Dimension Splits | 4 (schema, service, routes, test) | 1 (index) | 15+ | GET/PUT /budgets/:id/lines/:lineId/dimension-splits, DELETE .../dimension-splits/:dimTypeId |
| **Total** | **12** | **5** | **44+** | **10 endpoints** |

### Parallelisation

All three stories are independent and can be executed in parallel via `superpowers:dispatching-parallel-agents`. The only shared modification is `index.ts` — each story adds one import + one registration line, which are additive and non-conflicting (each touches a different line).

Recommendation: dispatch 3 parallel agents, one per story. Merge the `index.ts` changes after all complete.

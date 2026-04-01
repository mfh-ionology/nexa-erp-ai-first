# Finance Phase 2 Wave 3: Simulations API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Simulations CRUD, convert-to-journal, and invalidate endpoints — enabling what-if journal entries that can be analysed, converted to real GL postings, or discarded.

**Architecture:** Two stories executed sequentially — API-3 builds full CRUD (list, get, create, update, delete) with Zod schemas and service layer. API-4 adds convert and invalidate actions plus the `getSimulationLineAggregations` helper for future report integration. Both follow existing Fastify + Prisma + vi.mock patterns from `journals.routes.ts` / `journals.service.ts`.

**Tech Stack:** Fastify 5, Zod, Prisma 7 (generated client), Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-01-fin-phase2-design.md` section 3 (Feature 2: Simulations)

**Depends on:** Wave 1 DB (Simulation + SimulationLine tables exist in Prisma schema), Wave 2 Dimensions API (not a hard dependency, but dimension values must be valid UUIDs)

**Blocked by this plan:** Wave 7 FE-3 (Simulations list + form pages), Wave 5 API-10 (report integration using `getSimulationLineAggregations`)

---

## File Structure

### New Files
```
apps/api/src/modules/finance/simulations.schema.ts       — Zod schemas (input, query, response)
apps/api/src/modules/finance/simulations.service.ts       — Service layer (CRUD, convert, invalidate)
apps/api/src/modules/finance/simulations.routes.ts        — Fastify route plugin
apps/api/src/modules/finance/simulations.routes.test.ts   — Route-level tests (vi.mock pattern)
```

### Modified Files
```
apps/api/src/modules/finance/index.ts                     — Register simulationsRoutesPlugin
packages/db/prisma/seeds/finance-seed.ts                  — Add SIMULATION number series seed
```

### Reference Files (read-only)
```
apps/api/src/modules/finance/journals.schema.ts           — Pattern: Zod schemas
apps/api/src/modules/finance/journals.service.ts          — Pattern: service layer, createGlPosting()
apps/api/src/modules/finance/journals.routes.ts           — Pattern: Fastify routes
apps/api/src/modules/finance/journals.routes.test.ts      — Pattern: vi.mock testing
apps/api/src/core/utils/response.ts                       — sendSuccess()
apps/api/src/core/schemas/envelope.ts                     — successEnvelope()
apps/api/src/core/rbac/index.ts                           — createPermissionGuard()
apps/api/src/core/types/request-context.ts                — extractRequestContext()
apps/api/src/core/errors/index.ts                         — AppError, DomainError, NotFoundError
packages/db/src/services/number-series.service.ts         — nextNumber()
```

### Protected Files (DO NOT MODIFY)
```
packages/db/src/client.ts
packages/db/src/index.ts
packages/db/src/utils/sharing.ts
packages/db/src/utils/rbac.ts
packages/db/src/services/number-series.service.ts
```

---

## Data Model Reference (added in Wave 1)

The following models are assumed to exist in the Prisma schema from Wave 1 DB:

```
SimulationStatus enum: ACTIVE, TRANSFERRED, INVALID
Simulation: id, companyId, entryNumber, transactionDate, description, reference,
            status, periodId, totalDebit, totalCredit, transferredToId,
            createdAt, updatedAt, createdBy, updatedBy
SimulationLine: id, simulationId, lineNumber, accountCode, companyId, description,
                debit, credit, vatCode, dimensionValues (Json?), createdAt, updatedAt
```

Number series entity type: `SIMULATION`, prefix: `SIM-`, padding: 5 (produces `SIM-00001`).

---

## Story API-3: Simulations CRUD

### Task 1: Create simulations.schema.ts

**File:** Create `apps/api/src/modules/finance/simulations.schema.ts`

- [ ] **Step 1: Define status enum and line input schema**

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma-generated SimulationStatus)
// ---------------------------------------------------------------------------

export const SIMULATION_STATUSES = ['ACTIVE', 'TRANSFERRED', 'INVALID'] as const;

// ---------------------------------------------------------------------------
// Shared line schemas
// ---------------------------------------------------------------------------

const simulationLineDimensionInputSchema = z.object({
  dimensionTypeId: z.uuid(),
  dimensionValueId: z.uuid(),
});

const simulationLineInputSchema = z.object({
  accountCode: z.string().min(1).max(20),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
  vatCode: z.string().max(20).optional(),
  dimensionValues: z.array(simulationLineDimensionInputSchema).optional(),
});
```

- [ ] **Step 2: Define request schemas (create, update, list, params)**

```typescript
// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createSimulationSchema = z.object({
  transactionDate: z.coerce.date(),
  description: z.string().min(1, 'Description is required').max(500),
  reference: z.string().max(100).optional(),
  periodId: z.uuid(),
  lines: z.array(simulationLineInputSchema).min(2, 'At least two lines required'),
});

export const updateSimulationSchema = z
  .object({
    transactionDate: z.coerce.date().optional(),
    description: z.string().min(1).max(500).optional(),
    reference: z.string().max(100).nullable().optional(),
    periodId: z.uuid().optional(),
    lines: z.array(simulationLineInputSchema).min(2).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export const simulationParamsSchema = z.object({
  id: z.uuid(),
});

export const listSimulationsQuerySchema = z.object({
  status: z.enum(SIMULATION_STATUSES).optional(),
  periodId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
```

- [ ] **Step 3: Define response schemas (list item, detail, line)**

Follow the journals pattern. Note: simulation lines include `dimensionValues` (JSON) and `accountName` (resolved from relation).

```typescript
// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const simulationLineResponseSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  accountCode: z.string(),
  accountName: z.string().nullable(),
  description: z.string().nullable(),
  debit: z.number(),
  credit: z.number(),
  vatCode: z.string().nullable(),
  dimensionValues: z.any().nullable(), // JSON array [{dimensionTypeId, dimensionValueId}]
});

export const simulationListItemSchema = z.object({
  id: z.uuid(),
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  reference: z.string().nullable(),
  status: z.enum(SIMULATION_STATUSES),
  periodId: z.string(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  transferredToId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

export const simulationDetailSchema = simulationListItemSchema.extend({
  lines: z.array(simulationLineResponseSchema),
});
```

- [ ] **Step 4: Export inferred TypeScript types**

```typescript
// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type ListSimulationsQuery = z.infer<typeof listSimulationsQuerySchema>;
export type SimulationLineInput = z.infer<typeof simulationLineInputSchema>;
```

---

### Task 2: Create simulations.service.ts

**File:** Create `apps/api/src/modules/finance/simulations.service.ts`

- [ ] **Step 1: Add imports and Prisma select shapes**

```typescript
import type { PrismaClient } from '@nexa/db';
import { Prisma, nextNumber } from '@nexa/db';

import type {
  CreateSimulationInput,
  UpdateSimulationInput,
  ListSimulationsQuery,
} from './simulations.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { PaginationMeta } from '../../core/utils/response.js';
```

Define Prisma select shapes mirroring journals:

```typescript
const LINE_SELECT = {
  id: true,
  lineNumber: true,
  accountCode: true,
  description: true,
  debit: true,
  credit: true,
  vatCode: true,
  dimensionValues: true,
  account: { select: { name: true } },
} as const;

const LIST_SELECT = {
  id: true,
  entryNumber: true,
  transactionDate: true,
  description: true,
  reference: true,
  status: true,
  periodId: true,
  totalDebit: true,
  totalCredit: true,
  transferredToId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  lines: {
    select: LINE_SELECT,
    orderBy: { lineNumber: 'asc' as const },
  },
} as const;
```

- [ ] **Step 2: Add helper functions (toNumber, toDateString, normalise)**

Mirror the journal service helpers but adapted for simulation lines (no multi-currency, has dimensionValues JSON):

```typescript
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function normaliseLine(line: Record<string, unknown>) {
  const account = line.account as { name: string } | null | undefined;
  return {
    ...line,
    accountName: account?.name ?? null,
    account: undefined,
    debit: toNumber(line.debit as Prisma.Decimal),
    credit: toNumber(line.credit as Prisma.Decimal),
  };
}

function normaliseListItem(row: Record<string, unknown>) {
  return {
    ...row,
    transactionDate:
      row.transactionDate instanceof Date
        ? toDateString(row.transactionDate)
        : String(row.transactionDate),
    totalDebit: toNumber(row.totalDebit as Prisma.Decimal),
    totalCredit: toNumber(row.totalCredit as Prisma.Decimal),
  };
}

function normaliseDetail(row: Record<string, unknown>) {
  const lines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    ...normaliseListItem(row),
    lines: lines.map(normaliseLine),
  };
}
```

- [ ] **Step 3: Add validation helpers**

Two validation functions needed for create/update:

```typescript
/**
 * Validate that lines balance (total debit == total credit).
 * Simulations enforce balance on create/update (not just on posting like journals).
 */
function validateLinesBalance(lines: Array<{ debit: number; credit: number }>) {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new DomainError(
      'ENTRY_NOT_BALANCED',
      `Simulation is not balanced: debits (${String(totalDebit)}) != credits (${String(totalCredit)})`,
    );
  }
  return { totalDebit, totalCredit };
}

/**
 * Validate period exists, belongs to company, and is OPEN.
 */
async function validatePeriodOpen(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  periodId: string,
) {
  const period = await tx.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: { id: true, status: true },
  });
  if (!period) {
    throw new NotFoundError('PERIOD_NOT_FOUND', 'Financial period not found');
  }
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    throw new DomainError(
      'PERIOD_NOT_OPEN',
      `Cannot create simulation in ${period.status.toLowerCase()} period`,
    );
  }
  return period;
}

/**
 * Validate all account codes exist and belong to the company.
 */
async function validateAccountCodes(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  accountCodes: string[],
) {
  const uniqueCodes = [...new Set(accountCodes)];
  const accounts = await tx.chartOfAccount.findMany({
    where: { companyId, code: { in: uniqueCodes } },
    select: { code: true },
  });
  const foundCodes = new Set(accounts.map((a) => a.code));
  for (const code of uniqueCodes) {
    if (!foundCodes.has(code)) {
      throw new AppError('ACCOUNT_NOT_FOUND', `Account code "${code}" not found`, 400);
    }
  }
}
```

- [ ] **Step 4: Implement listSimulations**

```typescript
export async function listSimulations(
  prisma: PrismaClient,
  companyId: string,
  query: ListSimulationsQuery,
): Promise<{ data: unknown[]; meta: PaginationMeta }> {
  const where: Record<string, unknown> = { companyId };
  if (query.status) where.status = query.status;
  if (query.periodId) where.periodId = query.periodId;
  if (query.cursor) where.id = { lt: query.cursor };

  const rows = await prisma.simulation.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const data = (hasMore ? rows.slice(0, -1) : rows).map((r) =>
    normaliseListItem(r as unknown as Record<string, unknown>),
  );

  return {
    data,
    meta: {
      cursor: data.length > 0 ? (data[data.length - 1] as { id: string }).id : undefined,
      hasMore,
    },
  };
}
```

- [ ] **Step 5: Implement getSimulationById**

```typescript
export async function getSimulationById(
  prisma: PrismaClient,
  companyId: string,
  id: string,
) {
  const row = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });
  if (!row) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  return normaliseDetail(row as unknown as Record<string, unknown>);
}
```

- [ ] **Step 6: Implement createSimulation**

Key differences from createJournalEntry:
1. Balance validation on create (not deferred to posting)
2. Period must be OPEN
3. Number series entity type is `SIMULATION`
4. dimensionValues stored as JSON, not junction table
5. No multi-currency conversion

```typescript
export async function createSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  data: CreateSimulationInput,
  userId: string,
) {
  // Validate balance up-front
  const { totalDebit, totalCredit } = validateLinesBalance(data.lines);

  const result = await prisma.$transaction(async (tx) => {
    // Validate period is OPEN
    await validatePeriodOpen(tx, companyId, data.periodId);

    // Validate account codes
    await validateAccountCodes(
      tx,
      companyId,
      data.lines.map((l) => l.accountCode),
    );

    // Generate entry number
    const entryNumber = await nextNumber(tx, companyId, 'SIMULATION');

    // Create simulation header
    const simulation = await tx.simulation.create({
      data: {
        companyId,
        entryNumber,
        transactionDate: data.transactionDate,
        description: data.description,
        reference: data.reference ?? null,
        status: 'ACTIVE',
        periodId: data.periodId,
        totalDebit,
        totalCredit,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });

    // Create lines
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i]!;
      await tx.simulationLine.create({
        data: {
          simulationId: simulation.id,
          lineNumber: i + 1,
          accountCode: line.accountCode,
          companyId,
          description: line.description ?? null,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          vatCode: line.vatCode ?? null,
          dimensionValues: line.dimensionValues ?? Prisma.JsonNull,
        },
      });
    }

    // Fetch complete simulation for response
    return tx.simulation.findUniqueOrThrow({
      where: { id: simulation.id },
      select: DETAIL_SELECT,
    });
  });

  // Emit event
  eventBus.emit('simulation.created', {
    simulationId: result.id,
    entryNumber: result.entryNumber,
    companyId,
    createdBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}
```

- [ ] **Step 7: Implement updateSimulation**

Only ACTIVE simulations can be updated. When lines are provided, delete-and-replace (same pattern as journal update).

```typescript
export async function updateSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  data: UpdateSimulationInput,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.simulation.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Simulation not found');
    }
    if (existing.status !== 'ACTIVE') {
      throw new DomainError(
        'SIMULATION_NOT_ACTIVE',
        `Cannot update simulation with status ${existing.status}`,
      );
    }

    // If periodId is changing, validate new period is OPEN
    if (data.periodId) {
      await validatePeriodOpen(tx, companyId, data.periodId);
    }

    // If lines provided, validate balance and accounts
    let totalDebit: number | undefined;
    let totalCredit: number | undefined;
    if (data.lines) {
      const totals = validateLinesBalance(data.lines);
      totalDebit = totals.totalDebit;
      totalCredit = totals.totalCredit;

      await validateAccountCodes(
        tx,
        companyId,
        data.lines.map((l) => l.accountCode),
      );
    }

    // Update header
    const updateData: Record<string, unknown> = { updatedBy: userId };
    if (data.transactionDate !== undefined) updateData.transactionDate = data.transactionDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.periodId !== undefined) updateData.periodId = data.periodId;
    if (totalDebit !== undefined) updateData.totalDebit = totalDebit;
    if (totalCredit !== undefined) updateData.totalCredit = totalCredit;

    await tx.simulation.update({
      where: { id },
      data: updateData,
    });

    // Replace lines if provided
    if (data.lines) {
      await tx.simulationLine.deleteMany({ where: { simulationId: id } });
      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i]!;
        await tx.simulationLine.create({
          data: {
            simulationId: id,
            lineNumber: i + 1,
            accountCode: line.accountCode,
            companyId,
            description: line.description ?? null,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            vatCode: line.vatCode ?? null,
            dimensionValues: line.dimensionValues ?? Prisma.JsonNull,
          },
        });
      }
    }

    return tx.simulation.findUniqueOrThrow({
      where: { id },
      select: DETAIL_SELECT,
    });
  });

  eventBus.emit('simulation.updated', {
    simulationId: result.id,
    companyId,
    updatedBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}
```

- [ ] **Step 8: Implement deleteSimulation**

Hard delete. Only ACTIVE or INVALID simulations can be deleted (not TRANSFERRED).

```typescript
export async function deleteSimulation(
  prisma: PrismaClient,
  companyId: string,
  id: string,
) {
  const existing = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (existing.status === 'TRANSFERRED') {
    throw new DomainError(
      'SIMULATION_TRANSFERRED',
      'Cannot delete a transferred simulation',
    );
  }
  // onDelete: Cascade on SimulationLine handles line cleanup
  await prisma.simulation.delete({ where: { id } });
}
```

---

### Task 3: Create simulations.routes.ts

**File:** Create `apps/api/src/modules/finance/simulations.routes.ts`

- [ ] **Step 1: Add imports and response envelopes**

Follow `journals.routes.ts` pattern exactly:

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createSimulationSchema,
  updateSimulationSchema,
  listSimulationsQuerySchema,
  simulationParamsSchema,
  simulationDetailSchema,
  simulationListItemSchema,
} from './simulations.schema.js';
import type { ListSimulationsQuery } from './simulations.schema.js';
import {
  createSimulation,
  updateSimulation,
  deleteSimulation,
  getSimulationById,
  listSimulations,
} from './simulations.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';
```

- [ ] **Step 2: Define route plugin with CRUD endpoints**

```typescript
const simulationDetailEnvelope = successEnvelope(simulationDetailSchema);

async function simulationsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /simulations — list
  fastify.get<{ Querystring: ListSimulationsQuery }>(
    '/simulations',
    {
      schema: { querystring: listSimulationsQuerySchema },
      preHandler: createPermissionGuard('finance.simulations', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listSimulations(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data, meta as { cursor?: string; hasMore?: boolean; total?: number });
    },
  );

  // GET /simulations/:id — detail
  fastify.get<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getSimulationById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /simulations — create
  fastify.post(
    '/simulations',
    {
      schema: {
        body: createSimulationSchema,
        response: { 201: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createSimulation(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.body as z.infer<typeof createSimulationSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /simulations/:id — update
  fastify.patch<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: {
        params: simulationParamsSchema,
        body: updateSimulationSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await updateSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          request.body as z.infer<typeof updateSimulationSchema>,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // DELETE /simulations/:id — hard delete
  fastify.delete<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: { params: simulationParamsSchema },
      preHandler: createPermissionGuard('finance.simulations', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        await deleteSimulation(prisma, ctx.companyId, request.params.id);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_TRANSFERRED') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const simulationsRoutesPlugin = simulationsRoutes;
```

---

### Task 4: Register simulations routes in finance module

**File:** Modify `apps/api/src/modules/finance/index.ts`

- [ ] **Step 1: Add import and registration**

After the existing import block, add:
```typescript
import { simulationsRoutesPlugin } from './simulations.routes.js';
```

Inside `financeModule()`, add after the existing registrations:
```typescript
await fastify.register(simulationsRoutesPlugin);
```

---

### Task 5: Seed SIMULATION number series

**File:** Modify `packages/db/prisma/seeds/finance-seed.ts`

- [ ] **Step 1: Add SIMULATION number series seed**

After the existing JOURNAL number series block (around line 850), add:

```typescript
// 5. Number Series for SIMULATION
console.log('  Seeding NumberSeries SIMULATION...');
const existingSimSeries = await prisma.numberSeries.findFirst({
  where: {
    companyId,
    entityType: 'SIMULATION',
  },
});
if (existingSimSeries) {
  await prisma.numberSeries.update({
    where: { id: existingSimSeries.id },
    data: { prefix: 'SIM-', padding: 5 },
  });
} else {
  await prisma.numberSeries.create({
    data: {
      companyId,
      entityType: 'SIMULATION',
      prefix: 'SIM-',
      padding: 5,
      nextValue: 1,
      isActive: true,
    },
  });
}
console.log('    NumberSeries SIMULATION seeded');
```

---

### Task 6: Write CRUD tests — simulations.routes.test.ts (API-3 coverage)

**File:** Create `apps/api/src/modules/finance/simulations.routes.test.ts`

- [ ] **Step 1: Set up vi.hoisted mocks**

Mirror `journals.routes.test.ts` exactly but replace journalEntry/journalLine mocks with simulation/simulationLine:

```typescript
const { mockPrisma, mockResolveUserRole, mockPermissionService, mockEventBus, mockNextNumber } =
  vi.hoisted(() => ({
    mockEventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      drain: vi.fn(),
    },
    mockPrisma: {
      user: { findUnique: vi.fn() },
      userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
      companyProfile: { findUnique: vi.fn() },
      systemSetting: { findMany: vi.fn() },
      simulation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      simulationLine: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      chartOfAccount: {
        findMany: vi.fn(),
      },
      financialPeriod: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockResolveUserRole: vi.fn(),
    mockPermissionService: {
      getEffectivePermissions: vi.fn(),
      hasPermission: vi.fn(),
      invalidateUser: vi.fn(),
      invalidateGroup: vi.fn(),
      invalidateAll: vi.fn(),
      clearCache: vi.fn(),
      getCacheSize: vi.fn(),
      deriveEnabledModules: vi.fn(),
      getFieldVisibility: vi.fn(),
    },
    mockNextNumber: vi.fn(),
  }));
```

Set up mocks for `@nexa/db` and `../../core/rbac/permission.service.js` identically to journals test.

- [ ] **Step 2: Set up test constants and helpers**

```typescript
const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '22222222-2222-4000-a000-222222222222';
const TEST_SIMULATION_ID = '55555555-5555-4000-a000-555555555555';
```

Write `makeTestJwt()`, `buildTestApp()`, `setupMocks()` helpers mirroring journals. In `buildTestApp`, register `simulationsRoutesPlugin` instead of `journalsRoutesPlugin`. In `setupMocks`, configure `finance.simulations` permissions (not `finance.journals`).

Write `makeMockSimulation()`:
```typescript
function makeMockSimulation(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SIMULATION_ID,
    entryNumber: 'SIM-00001',
    transactionDate: new Date('2026-01-15'),
    description: 'Test simulation',
    reference: 'REF-SIM-001',
    status: 'ACTIVE',
    periodId: TEST_PERIOD_ID,
    totalDebit: 1000,
    totalCredit: 1000,
    transferredToId: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    lines: [
      {
        id: 'sim-line-1',
        lineNumber: 1,
        accountCode: '1000',
        description: 'Debit line',
        debit: 1000,
        credit: 0,
        vatCode: null,
        dimensionValues: null,
        account: { name: 'Cash' },
      },
      {
        id: 'sim-line-2',
        lineNumber: 2,
        accountCode: '2000',
        description: 'Credit line',
        debit: 0,
        credit: 1000,
        vatCode: null,
        dimensionValues: null,
        account: { name: 'Bank' },
      },
    ],
    ...overrides,
  };
}
```

- [ ] **Step 3: Write test — POST /finance/simulations (create)**

```
describe('POST /finance/simulations', () => {
  it('creates simulation with auto-generated entryNumber') — mock transaction, period,
     accounts, nextNumber; verify 201, SIM-00001, ACTIVE, 2 lines,
     nextNumber called with 'SIMULATION', simulation.created event emitted

  it('rejects unbalanced lines') — send debit 1000, credit 500; expect 409 ENTRY_NOT_BALANCED

  it('rejects with invalid period ID') — period not found; expect 404

  it('rejects with non-existent account code') — one account missing; expect 400 ACCOUNT_NOT_FOUND

  it('rejects fewer than 2 lines') — single line; expect 400 (Zod validation)

  it('returns 401 without auth token') — no auth header; expect 401
});
```

- [ ] **Step 4: Write test — GET /finance/simulations (list)**

```
describe('GET /finance/simulations', () => {
  it('returns paginated list of simulations') — mock findMany; verify 200, data array

  it('filters by status') — pass ?status=ACTIVE; verify where clause includes status

  it('filters by periodId') — pass ?periodId=...; verify where clause
});
```

- [ ] **Step 5: Write test — GET /finance/simulations/:id (detail)**

```
describe('GET /finance/simulations/:id', () => {
  it('returns simulation detail with lines') — mock findFirst; verify 200, lines present

  it('returns 404 for non-existent simulation') — findFirst returns null; expect 404
});
```

- [ ] **Step 6: Write test — PATCH /finance/simulations/:id (update)**

```
describe('PATCH /finance/simulations/:id', () => {
  it('updates an ACTIVE simulation') — mock existing ACTIVE; verify 200

  it('rejects update of TRANSFERRED simulation') — mock existing TRANSFERRED; expect 409

  it('rejects unbalanced replacement lines') — lines that don't balance; expect 409
});
```

- [ ] **Step 7: Write test — DELETE /finance/simulations/:id**

```
describe('DELETE /finance/simulations/:id', () => {
  it('deletes an ACTIVE simulation') — mock existing ACTIVE; verify 204

  it('deletes an INVALID simulation') — mock existing INVALID; verify 204

  it('rejects deletion of TRANSFERRED simulation') — mock existing TRANSFERRED; expect 409

  it('returns 404 for non-existent simulation') — mock findFirst null; expect 404
});
```

- [ ] **Step 8: Run tests and verify pass**

```bash
cd apps/api && npx vitest run src/modules/finance/simulations.routes.test.ts
```

All tests must pass before proceeding to API-4.

---

## Story API-4: Simulation Convert + Invalidate

### Task 7: Add convertSimulation to service

**File:** Modify `apps/api/src/modules/finance/simulations.service.ts`

- [ ] **Step 1: Import createJournalEntry from journals.service**

Add to the imports:
```typescript
import { createJournalEntry } from './journals.service.js';
import type { CreateJournalInput } from './journals.schema.js';
```

- [ ] **Step 2: Implement convertSimulation**

Converts an ACTIVE simulation to a DRAFT journal entry. Reads the simulation lines (including `dimensionValues` JSON) and creates proper journal lines with `JournalLineDimension` records.

```typescript
export async function convertSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  userId: string,
) {
  // Fetch simulation with lines
  const simulation = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: {
      ...DETAIL_SELECT,
      status: true,
    },
  });

  if (!simulation) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (simulation.status !== 'ACTIVE') {
    throw new DomainError(
      'SIMULATION_NOT_ACTIVE',
      `Cannot convert simulation with status ${simulation.status}`,
    );
  }

  // Build journal input from simulation data
  const journalLines = simulation.lines.map((line) => {
    const dims = line.dimensionValues as Array<{ dimensionValueId: string }> | null;
    return {
      accountCode: line.accountCode,
      debit: toNumber(line.debit as Prisma.Decimal),
      credit: toNumber(line.credit as Prisma.Decimal),
      description: line.description ?? undefined,
      vatCode: line.vatCode ?? undefined,
      dimensions: dims
        ? dims.map((d) => ({ dimensionValueId: d.dimensionValueId }))
        : undefined,
    };
  });

  const journalInput: CreateJournalInput = {
    transactionDate: simulation.transactionDate as Date,
    description: simulation.description,
    reference: simulation.reference ?? undefined,
    periodId: simulation.periodId,
    lines: journalLines,
  };

  // Create journal entry (this generates its own entry number, validates period/accounts)
  const journalResult = await createJournalEntry(
    prisma,
    eventBus,
    companyId,
    journalInput,
    userId,
  );

  // Mark simulation as TRANSFERRED
  await prisma.simulation.update({
    where: { id },
    data: {
      status: 'TRANSFERRED',
      transferredToId: journalResult.id as string,
      updatedBy: userId,
    },
  });

  // Emit event
  eventBus.emit('simulation.converted', {
    simulationId: id,
    journalEntryId: journalResult.id,
    companyId,
    convertedBy: userId,
  });

  return journalResult;
}
```

**Note on createJournalEntry reuse:** The `createJournalEntry` function in `journals.service.ts` already handles number series allocation, account validation, multi-currency conversion, line creation with dimension junction records, and event emission. Reusing it avoids duplicating this logic.

---

### Task 8: Add invalidateSimulation to service

**File:** Modify `apps/api/src/modules/finance/simulations.service.ts`

- [ ] **Step 1: Implement invalidateSimulation**

```typescript
export async function invalidateSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  userId: string,
) {
  const existing = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (existing.status !== 'ACTIVE') {
    throw new DomainError(
      'SIMULATION_NOT_ACTIVE',
      `Cannot invalidate simulation with status ${existing.status}`,
    );
  }

  const result = await prisma.simulation.update({
    where: { id },
    data: {
      status: 'INVALID',
      updatedBy: userId,
    },
    select: DETAIL_SELECT,
  });

  eventBus.emit('simulation.invalidated', {
    simulationId: id,
    companyId,
    invalidatedBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}
```

---

### Task 9: Add getSimulationLineAggregations helper

**File:** Modify `apps/api/src/modules/finance/simulations.service.ts`

This helper is used by report services (Wave 5 API-10) when `includeSimulations=true`.

- [ ] **Step 1: Implement getSimulationLineAggregations**

```typescript
/**
 * Aggregate simulation line amounts by account code for ACTIVE simulations
 * in the given periods. Used by report services when includeSimulations=true.
 *
 * Returns a Map of accountCode -> { debit, credit } totals.
 */
export async function getSimulationLineAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
): Promise<Map<string, { debit: number; credit: number }>> {
  if (periodIds.length === 0) return new Map();

  const aggregations = await prisma.simulationLine.groupBy({
    by: ['accountCode'],
    where: {
      companyId,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const result = new Map<string, { debit: number; credit: number }>();
  for (const row of aggregations) {
    result.set(row.accountCode, {
      debit: toNumber(row._sum.debit),
      credit: toNumber(row._sum.credit),
    });
  }
  return result;
}
```

---

### Task 10: Add convert and invalidate routes

**File:** Modify `apps/api/src/modules/finance/simulations.routes.ts`

- [ ] **Step 1: Add imports for convertSimulation and invalidateSimulation**

Update the import from `./simulations.service.js` to include:
```typescript
import {
  createSimulation,
  updateSimulation,
  deleteSimulation,
  getSimulationById,
  listSimulations,
  convertSimulation,
  invalidateSimulation,
} from './simulations.service.js';
```

Also import `journalDetailSchema` from journals for the convert response:
```typescript
import { journalDetailSchema } from './journals.schema.js';
```

- [ ] **Step 2: Add POST /simulations/:id/convert route**

Add before the closing `}` of the route plugin:

```typescript
  // POST /simulations/:id/convert — convert to journal entry
  const journalDetailEnvelope = successEnvelope(journalDetailSchema);

  fastify.post<{ Params: { id: string } }>(
    '/simulations/:id/convert',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await convertSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
```

- [ ] **Step 3: Add POST /simulations/:id/invalidate route**

```typescript
  // POST /simulations/:id/invalidate — mark as invalid
  fastify.post<{ Params: { id: string } }>(
    '/simulations/:id/invalidate',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await invalidateSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
```

---

### Task 11: Write convert + invalidate tests

**File:** Modify `apps/api/src/modules/finance/simulations.routes.test.ts`

- [ ] **Step 1: Add journalEntry and journalLine mocks to mockPrisma**

The convert action calls `createJournalEntry`, which uses `journalEntry.create`, `journalLine.create`, `journalEntry.findUniqueOrThrow`, and `nextNumber`. Add these to the existing mockPrisma:

```typescript
journalEntry: {
  create: vi.fn(),
  findUniqueOrThrow: vi.fn(),
},
journalLine: {
  create: vi.fn(),
},
journalLineDimension: {
  create: vi.fn(),
},
```

Also add a mock for multi-currency:
```typescript
vi.mock('./multi-currency.service.js', () => ({
  convertLinesToBaseCurrency: vi.fn(
    async (_tx: unknown, _companyId: string, _base: string, _date: Date, lines: unknown[]) => lines,
  ),
  getBaseCurrencyCode: vi.fn(async () => 'GBP'),
}));
```

- [ ] **Step 2: Write test — POST /finance/simulations/:id/convert**

```
describe('POST /finance/simulations/:id/convert', () => {
  it('converts ACTIVE simulation to DRAFT journal entry') —
     mock simulation.findFirst returning ACTIVE with lines,
     mock createJournalEntry chain (financialPeriod, chartOfAccount, nextNumber,
       journalEntry.create, journalLine.create, journalEntry.findUniqueOrThrow),
     mock simulation.update for TRANSFERRED status;
     verify 200, returned data has journal entry fields,
     simulation.update called with status TRANSFERRED and transferredToId,
     simulation.converted event emitted

  it('rejects conversion of TRANSFERRED simulation') —
     mock simulation.findFirst returning TRANSFERRED status;
     expect 409 SIMULATION_NOT_ACTIVE

  it('rejects conversion of INVALID simulation') —
     mock simulation.findFirst returning INVALID status;
     expect 409 SIMULATION_NOT_ACTIVE

  it('returns 404 for non-existent simulation') —
     mock simulation.findFirst returning null;
     expect 404
});
```

- [ ] **Step 3: Write test — POST /finance/simulations/:id/invalidate**

```
describe('POST /finance/simulations/:id/invalidate', () => {
  it('invalidates an ACTIVE simulation') —
     mock simulation.findFirst returning ACTIVE,
     mock simulation.update returning result with INVALID status;
     verify 200, status is INVALID, simulation.invalidated event emitted

  it('rejects invalidation of TRANSFERRED simulation') —
     mock findFirst returning TRANSFERRED; expect 409

  it('rejects invalidation of already INVALID simulation') —
     mock findFirst returning INVALID; expect 409

  it('returns 404 for non-existent simulation') —
     mock findFirst null; expect 404
});
```

- [ ] **Step 4: Run full test suite and verify pass**

```bash
cd apps/api && npx vitest run src/modules/finance/simulations.routes.test.ts
```

All tests must pass.

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `simulations.schema.ts` exports all schemas and types
- [ ] `simulations.service.ts` exports: `listSimulations`, `getSimulationById`, `createSimulation`, `updateSimulation`, `deleteSimulation`, `convertSimulation`, `invalidateSimulation`, `getSimulationLineAggregations`
- [ ] `simulations.routes.ts` exports `simulationsRoutesPlugin` and registers 7 routes:
  - `GET /simulations` (list)
  - `GET /simulations/:id` (detail)
  - `POST /simulations` (create, 201)
  - `PATCH /simulations/:id` (update)
  - `DELETE /simulations/:id` (hard delete, 204)
  - `POST /simulations/:id/convert` (returns journal detail)
  - `POST /simulations/:id/invalidate` (returns simulation detail)
- [ ] `index.ts` registers `simulationsRoutesPlugin`
- [ ] `finance-seed.ts` seeds `SIMULATION` number series (SIM- prefix, padding 5)
- [ ] All tests pass: `npx vitest run src/modules/finance/simulations.routes.test.ts`
- [ ] No TypeScript errors: `npx tsc --noEmit` from `apps/api`
- [ ] Balance validation enforced on create and update
- [ ] Period validation (OPEN) enforced on create and update
- [ ] Status guards: only ACTIVE can be updated/converted/invalidated; only ACTIVE/INVALID can be deleted
- [ ] Convert reuses `createJournalEntry()` from journals service (no duplicated GL logic)
- [ ] Convert maps `dimensionValues` JSON to proper `dimensions` array for journal line creation
- [ ] Events emitted: `simulation.created`, `simulation.updated`, `simulation.converted`, `simulation.invalidated`

---

## Endpoint Summary

| Method | Path | Permission | Status |
|--------|------|-----------|--------|
| GET | `/finance/simulations` | `finance.simulations.view` | 200 |
| GET | `/finance/simulations/:id` | `finance.simulations.view` | 200 |
| POST | `/finance/simulations` | `finance.simulations.new` | 201 |
| PATCH | `/finance/simulations/:id` | `finance.simulations.edit` | 200 |
| DELETE | `/finance/simulations/:id` | `finance.simulations.delete` | 204 |
| POST | `/finance/simulations/:id/convert` | `finance.simulations.edit` | 200 |
| POST | `/finance/simulations/:id/invalidate` | `finance.simulations.edit` | 200 |

---

## Error Codes

| Code | HTTP | Trigger |
|------|------|---------|
| `ENTRY_NOT_BALANCED` | 409 | Lines debit total != credit total |
| `PERIOD_NOT_FOUND` | 404 | Period ID not found or wrong company |
| `PERIOD_NOT_OPEN` | 409 | Period is CLOSED or LOCKED |
| `ACCOUNT_NOT_FOUND` | 400 | Account code not in chart of accounts |
| `SIMULATION_NOT_ACTIVE` | 409 | Attempting update/convert/invalidate on non-ACTIVE simulation |
| `SIMULATION_TRANSFERRED` | 409 | Attempting delete on TRANSFERRED simulation |
| `NOT_FOUND` | 404 | Simulation ID not found |

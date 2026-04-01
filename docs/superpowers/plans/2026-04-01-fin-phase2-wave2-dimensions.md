# Finance Phase 2 Wave 2: Dimension Management APIs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRUD APIs for all four dimension entities (DimensionType, DimensionValue, DimensionRequirement, DimensionDefault) with full Zod validation, service layer, route registration, and test coverage.

**Architecture:** Four tasks, one per API group. Each task creates a schema file, a service file, a routes file, and a test file — following the exact patterns established in `accounts.routes.ts`, `accounts.service.ts`, and `accounts.schema.ts`. All tasks are independent and can run in parallel.

**Tech Stack:** Fastify 5, Zod, Prisma 7, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-01-fin-phase2-design.md` section F1 (section 2)

**Depends on:** Finance Phase 1 complete (E14 Wave 1 — all 6 dimension tables exist in Prisma schema)

**DB Changes:** NONE — all 6 dimension tables (DimensionType, DimensionValue, DimensionRequirement, JournalLineDimension, DimensionDefault, DimensionBalance) already exist.

---

## File Structure

### New Files
```
apps/api/src/modules/finance/dimension-types.schema.ts
apps/api/src/modules/finance/dimension-types.service.ts
apps/api/src/modules/finance/dimension-types.routes.ts
apps/api/src/modules/finance/dimension-types.routes.test.ts

apps/api/src/modules/finance/dimension-values.schema.ts
apps/api/src/modules/finance/dimension-values.service.ts
apps/api/src/modules/finance/dimension-values.routes.ts
apps/api/src/modules/finance/dimension-values.routes.test.ts

apps/api/src/modules/finance/dimension-requirements.schema.ts
apps/api/src/modules/finance/dimension-requirements.service.ts
apps/api/src/modules/finance/dimension-requirements.routes.ts
apps/api/src/modules/finance/dimension-requirements.routes.test.ts

apps/api/src/modules/finance/dimension-defaults.schema.ts
apps/api/src/modules/finance/dimension-defaults.service.ts
apps/api/src/modules/finance/dimension-defaults.routes.ts
apps/api/src/modules/finance/dimension-defaults.routes.test.ts
```

### Modified Files
```
apps/api/src/modules/finance/index.ts   — MODIFY: register 4 new route plugins
```

### Reference Files (read-only, for patterns)
```
apps/api/src/modules/finance/accounts.routes.ts     — route structure pattern
apps/api/src/modules/finance/accounts.service.ts     — service pattern
apps/api/src/modules/finance/accounts.schema.ts      — Zod schema pattern
apps/api/src/modules/finance/accounts.routes.test.ts — test pattern (mocks, buildTestApp, inject)
apps/api/src/core/utils/response.ts                  — sendSuccess helper
apps/api/src/core/schemas/envelope.ts                — successEnvelope wrapper
apps/api/src/core/rbac/index.ts                      — createPermissionGuard
apps/api/src/core/types/request-context.ts           — extractRequestContext
apps/api/src/core/errors/index.ts                    — AppError, DomainError, NotFoundError
```

### Prisma Models (already exist — DO NOT MODIFY)
```
packages/db/prisma/schema.prisma
  — DimensionType     (line ~2750)
  — DimensionValue    (line ~2773)
  — DimensionRequirement (line ~2798)
  — DimensionDefault  (line ~2830)
```

---

## Shared Conventions

All four tasks follow the same conventions established by the accounts module:

### Import Pattern (routes)
```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
```

### Import Pattern (service)
```typescript
import type { PrismaClient } from '@nexa/db';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';
```

### Permission Key
All dimension APIs use the permission key `finance.dimensions` with actions `view` and `edit`.

### Response Pattern
- GET list: `sendSuccess(reply, data, meta)` with PaginationMeta
- GET detail: `sendSuccess(reply, data)`
- POST create: `sendSuccess(reply, data, undefined, 201)`
- PATCH update: `sendSuccess(reply, data)`
- DELETE: `reply.status(204).send()`

### Company Scoping
Every query MUST include `companyId` from `extractRequestContext(request).companyId`. This is the multi-company isolation rule — never skip it.

### Error Handling
- Not found: `throw new NotFoundError('NOT_FOUND', '<Entity> not found')`
- Duplicate code: catch Prisma P2002 → `throw new AppError('DUPLICATE_CODE', '...', 409)`
- Validation: `throw new AppError('VALIDATION_ERROR', '...', 400)`

---

## Task 1: DimensionType CRUD APIs

**Routes:** `GET /dimensions/types`, `GET /dimensions/types/:id`, `POST /dimensions/types`, `PATCH /dimensions/types/:id`

### Step 1: Create `dimension-types.schema.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-types.schema.ts`

```typescript
// Zod schemas for DimensionType CRUD

// --- Request Schemas ---

createDimensionTypeSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isSingleSelect: z.boolean().default(true),
  allowManualEntry: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999),
});

updateDimensionTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isSingleSelect: z.boolean().optional(),
  allowManualEntry: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update',
});

// --- Params & Query Schemas ---

dimensionTypeParamsSchema = z.object({ id: z.uuid() });

listDimensionTypesQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// --- Response Schemas ---

dimensionTypeItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSingleSelect: z.boolean(),
  allowManualEntry: z.boolean(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

dimensionTypeDetailSchema = dimensionTypeItemSchema.extend({
  _count: z.object({ values: z.number() }).optional(),
});

// --- Inferred Types ---
// Export: CreateDimensionTypeInput, UpdateDimensionTypeInput, ListDimensionTypesQuery
```

### Step 2: Create `dimension-types.service.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-types.service.ts`

Service functions:

1. **`listDimensionTypes(prisma, companyId, query)`**
   - Cursor-based pagination on `dimensionType.findMany`
   - Filter: `isActive` (optional)
   - OrderBy: `sortOrder asc, code asc`
   - Select: all fields from `dimensionTypeItemSchema`
   - Return: `{ data, meta: PaginationMeta }`

2. **`getDimensionTypeById(prisma, companyId, id)`**
   - `dimensionType.findFirst({ where: { id, companyId }, include: { _count: { select: { values: true } } } })`
   - Throw `NotFoundError` if not found
   - Return: detail object

3. **`createDimensionType(prisma, companyId, data, userId)`**
   - `dimensionType.create({ data: { companyId, ...data } })`
   - Catch P2002 → `AppError('DUPLICATE_CODE', 'Dimension type code already exists', 409)`
   - Return: created record

4. **`updateDimensionType(prisma, companyId, id, data, userId)`**
   - Find existing or throw `NotFoundError`
   - `dimensionType.update({ where: { id }, data: { ...updates, updatedAt: new Date() } })`
   - Return: updated record with _count

### Step 3: Create `dimension-types.routes.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-types.routes.ts`

Route definitions:

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| GET | `/dimensions/types` | `finance.dimensions` / `view` | listDimensionTypes |
| GET | `/dimensions/types/:id` | `finance.dimensions` / `view` | getDimensionTypeById |
| POST | `/dimensions/types` | `finance.dimensions` / `edit` | createDimensionType |
| PATCH | `/dimensions/types/:id` | `finance.dimensions` / `edit` | updateDimensionType |

Export: `dimensionTypesRoutesPlugin`

### Step 4: Create `dimension-types.routes.test.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-types.routes.test.ts`

Mock setup (follow `accounts.routes.test.ts` pattern exactly):
- `vi.hoisted` block with mockPrisma containing `dimensionType: { findMany, findFirst, create, update, count }`
- `vi.mock('@nexa/db', ...)` and `vi.mock('../../core/rbac/permission.service.js', ...)`
- `buildTestApp()` registers `dimensionTypesRoutesPlugin` at prefix `/finance`
- `setupMocks()` configures user, company, permissions for `finance.dimensions`
- `makeSampleDimensionType()` helper returning test fixture

Test cases:

```
describe('GET /finance/dimensions/types')
  - [ ] returns list with pagination meta
  - [ ] filters by isActive
  - [ ] returns 401 without auth

describe('GET /finance/dimensions/types/:id')
  - [ ] returns type with values count
  - [ ] returns 404 for non-existent
  - [ ] returns 401 without auth

describe('POST /finance/dimensions/types')
  - [ ] creates type successfully (201)
  - [ ] returns 409 for duplicate code
  - [ ] validates code format (rejects lowercase, special chars)
  - [ ] validates sortOrder bounds
  - [ ] returns 401 without auth

describe('PATCH /finance/dimensions/types/:id')
  - [ ] updates name successfully
  - [ ] updates isActive (deactivate)
  - [ ] returns 404 for non-existent
  - [ ] rejects empty update body
  - [ ] returns 401 without auth

describe('Permission enforcement')
  - [ ] returns 403 for VIEWER on GET
  - [ ] returns 403 for VIEWER on POST
  - [ ] returns 403 for VIEWER on PATCH
```

### Step 5: Verify

- [ ] Run: `cd apps/api && npx vitest run src/modules/finance/dimension-types.routes.test.ts`
- [ ] All tests pass

---

## Task 2: DimensionValue CRUD APIs

**Routes:** `GET /dimensions/types/:typeId/values`, `GET /dimensions/types/:typeId/values/:id`, `POST /dimensions/types/:typeId/values`, `PATCH /dimensions/types/:typeId/values/:id`

### Step 1: Create `dimension-values.schema.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-values.schema.ts`

```typescript
// --- Request Schemas ---

createDimensionValueSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with underscores/hyphens'),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

updateDimensionValueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update',
});

// --- Params & Query Schemas ---

dimensionValueParamsSchema = z.object({
  typeId: z.uuid(),
  id: z.uuid(),
});

typeIdParamsSchema = z.object({
  typeId: z.uuid(),
});

listDimensionValuesQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  parentId: z.string().uuid().optional(),
  search: z.string().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// --- Response Schemas ---

dimensionValueItemSchema = z.object({
  id: z.string().uuid(),
  dimensionTypeId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

dimensionValueDetailSchema = dimensionValueItemSchema.extend({
  parent: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable().optional(),
  children: z.array(dimensionValueItemSchema).optional(),
});

// --- Inferred Types ---
// Export: CreateDimensionValueInput, UpdateDimensionValueInput, ListDimensionValuesQuery
```

### Step 2: Create `dimension-values.service.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-values.service.ts`

Service functions:

1. **`listDimensionValues(prisma, companyId, typeId, query)`**
   - First: verify typeId belongs to companyId (`dimensionType.findFirst`), throw NotFoundError if not
   - Cursor-based pagination on `dimensionValue.findMany`
   - Where: `{ companyId, dimensionTypeId: typeId }` + optional `isActive`, `parentId`, `search` (OR on code/name)
   - OrderBy: `code asc`
   - Return: `{ data, meta }`

2. **`getDimensionValueById(prisma, companyId, typeId, id)`**
   - `dimensionValue.findFirst({ where: { id, companyId, dimensionTypeId: typeId }, include: { parent: { select: { id, code, name } }, children: { select: ..., orderBy: { code: 'asc' } } } })`
   - Throw NotFoundError if not found

3. **`createDimensionValue(prisma, companyId, typeId, data)`**
   - Verify typeId belongs to companyId
   - If `parentId` provided:
     - Verify parent exists, belongs to same type and company
     - **Hierarchy depth check:** walk up parent chain, reject if depth > 5. Implementation: recursive query or loop with max 5 iterations, counting depth. If inserting this value would make depth > 5, throw `AppError('MAX_DEPTH_EXCEEDED', 'Maximum hierarchy depth of 5 levels exceeded', 400)`
   - `dimensionValue.create({ data: { companyId, dimensionTypeId: typeId, ...data } })`
   - Catch P2002 → `AppError('DUPLICATE_CODE', 'Dimension value code already exists for this type', 409)`

4. **`updateDimensionValue(prisma, companyId, typeId, id, data)`**
   - Find existing or throw NotFoundError
   - If `parentId` is being set:
     - Cannot be self: `if (data.parentId === id) throw AppError('CIRCULAR_PARENT', '...', 400)`
     - Verify parent exists in same type/company
     - Hierarchy depth check (same as create)
   - `dimensionValue.update(...)`

### Step 3: Create `dimension-values.routes.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-values.routes.ts`

Route definitions:

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| GET | `/dimensions/types/:typeId/values` | `finance.dimensions` / `view` | listDimensionValues |
| GET | `/dimensions/types/:typeId/values/:id` | `finance.dimensions` / `view` | getDimensionValueById |
| POST | `/dimensions/types/:typeId/values` | `finance.dimensions` / `edit` | createDimensionValue |
| PATCH | `/dimensions/types/:typeId/values/:id` | `finance.dimensions` / `edit` | updateDimensionValue |

Export: `dimensionValuesRoutesPlugin`

### Step 4: Create `dimension-values.routes.test.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-values.routes.test.ts`

Mock setup:
- mockPrisma with `dimensionType: { findFirst }`, `dimensionValue: { findMany, findFirst, create, update, count }`
- `makeSampleDimensionValue()` helper
- `makeSampleDimensionType()` helper (for type existence checks)

Test cases:

```
describe('GET /finance/dimensions/types/:typeId/values')
  - [ ] returns list with pagination meta
  - [ ] filters by isActive
  - [ ] filters by parentId
  - [ ] supports search on code and name
  - [ ] returns 404 when typeId does not exist
  - [ ] returns 401 without auth

describe('GET /finance/dimensions/types/:typeId/values/:id')
  - [ ] returns value with parent and children
  - [ ] returns 404 for non-existent value
  - [ ] returns 401 without auth

describe('POST /finance/dimensions/types/:typeId/values')
  - [ ] creates value successfully (201)
  - [ ] creates value with parentId
  - [ ] returns 409 for duplicate code within type
  - [ ] returns 404 when typeId does not exist
  - [ ] validates code format (rejects lowercase, special chars)
  - [ ] rejects parentId that is in a different type (400)
  - [ ] returns 401 without auth

describe('PATCH /finance/dimensions/types/:typeId/values/:id')
  - [ ] updates name successfully
  - [ ] updates isActive (deactivate)
  - [ ] rejects self-referencing parentId (CIRCULAR_PARENT)
  - [ ] returns 404 for non-existent value
  - [ ] rejects empty update body
  - [ ] returns 401 without auth

describe('Permission enforcement')
  - [ ] returns 403 for VIEWER on GET
  - [ ] returns 403 for VIEWER on POST
  - [ ] returns 403 for VIEWER on PATCH
```

### Step 5: Verify

- [ ] Run: `cd apps/api && npx vitest run src/modules/finance/dimension-values.routes.test.ts`
- [ ] All tests pass

---

## Task 3: DimensionRequirement CRUD APIs

**Routes:** `GET /dimensions/requirements`, `POST /dimensions/requirements`, `PATCH /dimensions/requirements/:id`, `DELETE /dimensions/requirements/:id`

### Step 1: Create `dimension-requirements.schema.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-requirements.schema.ts`

```typescript
// --- Request Schemas ---

createDimensionRequirementSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  accountCodeFrom: z.string().min(1).max(20),
  accountCodeTo: z.string().min(1).max(20),
  isRequired: z.boolean().default(true),
});

updateDimensionRequirementSchema = z.object({
  accountCodeFrom: z.string().min(1).max(20).optional(),
  accountCodeTo: z.string().min(1).max(20).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update',
});

// --- Params & Query Schemas ---

dimensionRequirementParamsSchema = z.object({ id: z.uuid() });

listDimensionRequirementsQuerySchema = z.object({
  dimensionTypeId: z.string().uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// --- Response Schemas ---

dimensionRequirementItemSchema = z.object({
  id: z.string().uuid(),
  dimensionTypeId: z.string().uuid(),
  accountCodeFrom: z.string(),
  accountCodeTo: z.string(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // Include dimension type name for display
  dimensionType: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
  }).optional(),
});

// --- Inferred Types ---
// Export: CreateDimensionRequirementInput, UpdateDimensionRequirementInput, ListDimensionRequirementsQuery
```

### Step 2: Create `dimension-requirements.service.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-requirements.service.ts`

Service functions:

1. **`listDimensionRequirements(prisma, companyId, query)`**
   - Cursor-based pagination on `dimensionRequirement.findMany`
   - Where: `{ companyId }` + optional `dimensionTypeId`
   - Include: `dimensionType: { select: { id, code, name } }`
   - OrderBy: `accountCodeFrom asc`
   - Return: `{ data, meta }`

2. **`createDimensionRequirement(prisma, companyId, data)`**
   - **Validate dimensionTypeId** exists and belongs to companyId
   - **Validate account code range:** `accountCodeFrom <= accountCodeTo` (lexicographic). If not: `AppError('INVALID_RANGE', 'accountCodeFrom must be <= accountCodeTo', 400)`
   - **Validate both account codes exist** in ChartOfAccount for this company:
     ```typescript
     const fromAccount = await prisma.chartOfAccount.findFirst({
       where: { companyId, code: data.accountCodeFrom },
     });
     if (!fromAccount) throw new AppError('INVALID_ACCOUNT', 'Account code from does not exist', 400);
     // Same for accountCodeTo
     ```
   - `dimensionRequirement.create({ data: { companyId, ...data } })`
   - Return with included dimensionType

3. **`updateDimensionRequirement(prisma, companyId, id, data)`**
   - Find existing or throw NotFoundError
   - If accountCodeFrom or accountCodeTo are being updated, re-validate the range and account existence
   - Determine effective from/to (merge existing with updates) and validate `from <= to`
   - `dimensionRequirement.update(...)`
   - Return with included dimensionType

4. **`deleteDimensionRequirement(prisma, companyId, id)`**
   - Find existing or throw NotFoundError
   - `dimensionRequirement.delete({ where: { id } })`
   - Return void

### Step 3: Create `dimension-requirements.routes.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-requirements.routes.ts`

Route definitions:

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| GET | `/dimensions/requirements` | `finance.dimensions` / `view` | listDimensionRequirements |
| POST | `/dimensions/requirements` | `finance.dimensions` / `edit` | createDimensionRequirement |
| PATCH | `/dimensions/requirements/:id` | `finance.dimensions` / `edit` | updateDimensionRequirement |
| DELETE | `/dimensions/requirements/:id` | `finance.dimensions` / `edit` | deleteDimensionRequirement |

Export: `dimensionRequirementsRoutesPlugin`

### Step 4: Create `dimension-requirements.routes.test.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-requirements.routes.test.ts`

Mock setup:
- mockPrisma with `dimensionRequirement: { findMany, findFirst, create, update, delete, count }`, `dimensionType: { findFirst }`, `chartOfAccount: { findFirst }`
- `makeSampleRequirement()` helper
- `makeSampleDimensionType()` helper

Test cases:

```
describe('GET /finance/dimensions/requirements')
  - [ ] returns list with pagination meta and dimensionType included
  - [ ] filters by dimensionTypeId
  - [ ] returns 401 without auth

describe('POST /finance/dimensions/requirements')
  - [ ] creates requirement successfully (201)
  - [ ] validates accountCodeFrom <= accountCodeTo
  - [ ] rejects when accountCodeFrom does not exist in ChartOfAccount
  - [ ] rejects when accountCodeTo does not exist in ChartOfAccount
  - [ ] rejects when dimensionTypeId does not exist (404)
  - [ ] returns 401 without auth

describe('PATCH /finance/dimensions/requirements/:id')
  - [ ] updates accountCodeFrom successfully
  - [ ] updates isActive (deactivate)
  - [ ] re-validates range when codes change
  - [ ] returns 404 for non-existent
  - [ ] rejects empty update body
  - [ ] returns 401 without auth

describe('DELETE /finance/dimensions/requirements/:id')
  - [ ] deletes requirement successfully (204)
  - [ ] returns 404 for non-existent
  - [ ] returns 401 without auth

describe('Permission enforcement')
  - [ ] returns 403 for VIEWER on GET
  - [ ] returns 403 for VIEWER on POST
  - [ ] returns 403 for VIEWER on DELETE
```

### Step 5: Verify

- [ ] Run: `cd apps/api && npx vitest run src/modules/finance/dimension-requirements.routes.test.ts`
- [ ] All tests pass

---

## Task 4: DimensionDefault CRUD APIs

**Routes:** `GET /dimensions/defaults`, `POST /dimensions/defaults`, `DELETE /dimensions/defaults/:id`

### Step 1: Create `dimension-defaults.schema.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-defaults.schema.ts`

```typescript
// --- Constants ---
ENTITY_TYPES = ['ACCOUNT', 'CUSTOMER', 'SUPPLIER', 'ITEM', 'COMPANY'] as const;

// --- Request Schemas ---

createDimensionDefaultSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  dimensionValueId: z.string().uuid(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid().optional(),
  // entityId is required for all entityTypes EXCEPT 'COMPANY'
}).refine(data => {
  if (data.entityType === 'COMPANY') return true; // entityId is optional for COMPANY
  return data.entityId !== undefined;
}, {
  message: 'entityId is required for non-COMPANY entity types',
  path: ['entityId'],
});

// --- Params & Query Schemas ---

dimensionDefaultParamsSchema = z.object({ id: z.uuid() });

listDimensionDefaultsQuerySchema = z.object({
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().uuid().optional(),
  dimensionTypeId: z.string().uuid().optional(),
});

// --- Response Schemas ---

dimensionDefaultItemSchema = z.object({
  id: z.string().uuid(),
  dimensionTypeId: z.string().uuid(),
  dimensionValueId: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // Include related names for display
  dimensionType: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
  }).optional(),
  dimensionValue: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
  }).optional(),
});

// --- Inferred Types ---
// Export: CreateDimensionDefaultInput, ListDimensionDefaultsQuery
```

### Step 2: Create `dimension-defaults.service.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-defaults.service.ts`

Service functions:

1. **`listDimensionDefaults(prisma, companyId, query)`**
   - No pagination needed (defaults are typically a small set per entity)
   - `dimensionDefault.findMany({ where: { companyId, ...filters } })`
   - Include: `dimensionType: { select: { id, code, name } }`, `dimensionValue: { select: { id, code, name } }`
   - Filters: `entityType`, `entityId`, `dimensionTypeId` (all optional)
   - OrderBy: `createdAt asc`
   - Return: data array (no meta needed — not paginated)

2. **`createDimensionDefault(prisma, companyId, data)`**
   - **Validate dimensionTypeId** exists and belongs to companyId
   - **Validate dimensionValueId** exists, belongs to companyId, and belongs to the specified dimensionTypeId
   - If `entityType` is `COMPANY`, set `entityId` to null (company-wide default)
   - **Check for duplicate:** same companyId + dimensionTypeId + entityType + entityId should not already have a default. If it does: `AppError('DUPLICATE_DEFAULT', 'A default already exists for this dimension type and entity', 409)`
   - `dimensionDefault.create({ data: { companyId, ...data } })`
   - Return with included dimensionType and dimensionValue

3. **`deleteDimensionDefault(prisma, companyId, id)`**
   - Find existing or throw NotFoundError (scoped to companyId)
   - `dimensionDefault.delete({ where: { id } })`
   - Return void

### Step 3: Create `dimension-defaults.routes.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-defaults.routes.ts`

Route definitions:

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| GET | `/dimensions/defaults` | `finance.dimensions` / `view` | listDimensionDefaults |
| POST | `/dimensions/defaults` | `finance.dimensions` / `edit` | createDimensionDefault |
| DELETE | `/dimensions/defaults/:id` | `finance.dimensions` / `edit` | deleteDimensionDefault |

Export: `dimensionDefaultsRoutesPlugin`

Note: No PATCH endpoint — defaults are created and deleted, not updated. To change a default, delete the old one and create a new one.

### Step 4: Create `dimension-defaults.routes.test.ts`

- [ ] Create file at `apps/api/src/modules/finance/dimension-defaults.routes.test.ts`

Mock setup:
- mockPrisma with `dimensionDefault: { findMany, findFirst, create, delete }`, `dimensionType: { findFirst }`, `dimensionValue: { findFirst }`
- `makeSampleDefault()` helper
- `makeSampleDimensionType()` and `makeSampleDimensionValue()` helpers

Test cases:

```
describe('GET /finance/dimensions/defaults')
  - [ ] returns list with dimensionType and dimensionValue included
  - [ ] filters by entityType
  - [ ] filters by dimensionTypeId
  - [ ] filters by entityId
  - [ ] returns 401 without auth

describe('POST /finance/dimensions/defaults')
  - [ ] creates default successfully (201)
  - [ ] creates company-wide default (entityType=COMPANY, no entityId)
  - [ ] rejects when dimensionTypeId does not exist
  - [ ] rejects when dimensionValueId does not exist
  - [ ] rejects when dimensionValueId belongs to different type
  - [ ] rejects duplicate default for same type+entity (409)
  - [ ] requires entityId for non-COMPANY entity types
  - [ ] returns 401 without auth

describe('DELETE /finance/dimensions/defaults/:id')
  - [ ] deletes default successfully (204)
  - [ ] returns 404 for non-existent
  - [ ] returns 401 without auth

describe('Permission enforcement')
  - [ ] returns 403 for VIEWER on GET
  - [ ] returns 403 for VIEWER on POST
  - [ ] returns 403 for VIEWER on DELETE
```

### Step 5: Verify

- [ ] Run: `cd apps/api && npx vitest run src/modules/finance/dimension-defaults.routes.test.ts`
- [ ] All tests pass

---

## Task 5: Register All Routes in Finance Module Index

**This task depends on Tasks 1-4 completing first.**

### Step 1: Update `apps/api/src/modules/finance/index.ts`

- [ ] Add imports for all 4 new route plugins:

```typescript
import { dimensionTypesRoutesPlugin } from './dimension-types.routes.js';
import { dimensionValuesRoutesPlugin } from './dimension-values.routes.js';
import { dimensionRequirementsRoutesPlugin } from './dimension-requirements.routes.js';
import { dimensionDefaultsRoutesPlugin } from './dimension-defaults.routes.js';
```

- [ ] Add registrations inside `financeModule()` (after the existing registrations, grouped together):

```typescript
  // Dimension Management (Phase 2 Wave 2)
  await fastify.register(dimensionTypesRoutesPlugin);
  await fastify.register(dimensionValuesRoutesPlugin);
  await fastify.register(dimensionRequirementsRoutesPlugin);
  await fastify.register(dimensionDefaultsRoutesPlugin);
```

### Step 2: Run all dimension tests together

- [ ] Run: `cd apps/api && npx vitest run src/modules/finance/dimension-types.routes.test.ts src/modules/finance/dimension-values.routes.test.ts src/modules/finance/dimension-requirements.routes.test.ts src/modules/finance/dimension-defaults.routes.test.ts`
- [ ] All tests pass

### Step 3: TypeScript compilation check

- [ ] Run: `cd apps/api && npx tsc --noEmit`
- [ ] No type errors

---

## Summary

| Task | Entity | Files | Routes | Test Cases |
|------|--------|-------|--------|------------|
| 1 | DimensionType | 4 new | GET list, GET :id, POST, PATCH | ~15 |
| 2 | DimensionValue | 4 new | GET list, GET :id, POST, PATCH | ~18 |
| 3 | DimensionRequirement | 4 new | GET list, POST, PATCH, DELETE | ~16 |
| 4 | DimensionDefault | 4 new | GET list, POST, DELETE | ~14 |
| 5 | Route registration | 1 modified | — | Compilation check |
| **Total** | | **16 new + 1 modified** | **15 endpoints** | **~63 tests** |

Tasks 1-4 are independent and can execute in parallel. Task 5 runs after all four complete.

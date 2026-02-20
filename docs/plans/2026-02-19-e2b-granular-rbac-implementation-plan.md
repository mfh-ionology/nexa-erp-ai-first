# E2b: Granular RBAC & Access Groups — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed 5-level role hierarchy with custom Access Groups providing per-resource, per-action, per-field permissions.

**Architecture:** Five new Prisma models (Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup) with two new enums. A `createPermissionGuard(resourceCode, action)` Fastify preHandler replaces `createRbacGuard()`. Permission resolution uses most-permissive-wins across groups, cached in-memory with 60s TTL (Redis-ready interface). A response hook strips/marks fields based on visibility overrides.

**Tech Stack:** TypeScript, Fastify, Prisma ORM, PostgreSQL, Vitest, Zod

**Design Document:** `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`

---

## Story 1: Schema Migration & Default Data

### Task 1: Add Prisma schema — enums and Resource model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Step 1: Add enums and Resource model to schema.prisma**

After the `ViewScope` enum (line ~422), add:

```prisma
enum ResourceType {
  PAGE
  REPORT
  SETTING
  MAINTENANCE

  @@map("resource_type")
}

enum FieldVisibility {
  VISIBLE
  READ_ONLY
  HIDDEN

  @@map("field_visibility")
}

model Resource {
  id          String       @id @default(uuid()) @map("id")
  code        String       @unique @map("code")
  name        String       @map("name")
  module      String       @map("module")
  type        ResourceType @map("type")
  parentCode  String?      @map("parent_code")
  sortOrder   Int          @default(0) @map("sort_order")
  icon        String?      @map("icon")
  description String?      @map("description")
  isActive    Boolean      @default(true) @map("is_active")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  parent          Resource?                  @relation("ResourceHierarchy", fields: [parentCode], references: [code])
  children        Resource[]                 @relation("ResourceHierarchy")
  permissions     AccessGroupPermission[]
  fieldOverrides  AccessGroupFieldOverride[]

  @@index([module, sortOrder], map: "idx_resources_module_sort")
  @@map("resources")
}
```

**Step 2: Add AccessGroup model**

```prisma
model AccessGroup {
  id          String   @id @default(uuid()) @map("id")
  companyId   String   @map("company_id")
  code        String   @map("code")
  name        String   @map("name")
  description String?  @map("description")
  isSystem    Boolean  @default(false) @map("is_system")
  isActive    Boolean  @default(true) @map("is_active")
  createdBy   String   @map("created_by")
  updatedBy   String   @map("updated_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company          CompanyProfile            @relation(fields: [companyId], references: [id])
  permissions      AccessGroupPermission[]
  fieldOverrides   AccessGroupFieldOverride[]
  userAccessGroups UserAccessGroup[]

  @@unique([companyId, code], map: "uq_access_groups_company_code")
  @@map("access_groups")
}
```

**Step 3: Add AccessGroupPermission model**

```prisma
model AccessGroupPermission {
  id            String   @id @default(uuid()) @map("id")
  accessGroupId String   @map("access_group_id")
  resourceCode  String   @map("resource_code")
  canAccess     Boolean  @default(false) @map("can_access")
  canNew        Boolean  @default(false) @map("can_new")
  canView       Boolean  @default(false) @map("can_view")
  canEdit       Boolean  @default(false) @map("can_edit")
  canDelete     Boolean  @default(false) @map("can_delete")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  accessGroup AccessGroup @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)
  resource    Resource    @relation(fields: [resourceCode], references: [code])

  @@unique([accessGroupId, resourceCode], map: "uq_access_group_permissions")
  @@map("access_group_permissions")
}
```

**Step 4: Add AccessGroupFieldOverride model**

```prisma
model AccessGroupFieldOverride {
  id            String          @id @default(uuid()) @map("id")
  accessGroupId String          @map("access_group_id")
  resourceCode  String          @map("resource_code")
  fieldPath     String          @map("field_path")
  visibility    FieldVisibility @map("visibility")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  accessGroup AccessGroup @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)
  resource    Resource    @relation(fields: [resourceCode], references: [code])

  @@unique([accessGroupId, resourceCode, fieldPath], map: "uq_access_group_field_overrides")
  @@map("access_group_field_overrides")
}
```

**Step 5: Add UserAccessGroup model**

```prisma
model UserAccessGroup {
  id            String   @id @default(uuid()) @map("id")
  userId        String   @map("user_id")
  accessGroupId String   @map("access_group_id")
  companyId     String   @map("company_id")
  assignedBy    String   @map("assigned_by")
  createdAt     DateTime @default(now()) @map("created_at")

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessGroup AccessGroup    @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)
  company     CompanyProfile @relation(fields: [companyId], references: [id])

  @@unique([userId, accessGroupId, companyId], map: "uq_user_access_groups")
  @@map("user_access_groups")
}
```

**Step 6: Update existing model relations**

Add to `CompanyProfile` model (after existing relations):
```prisma
  accessGroups         AccessGroup[]
  userAccessGroups     UserAccessGroup[]
```

Add to `User` model (after existing relations):
```prisma
  userAccessGroups     UserAccessGroup[]
```

**Step 7: Generate migration and client**

Run:
```bash
cd packages/db && npx prisma migrate dev --name add-granular-rbac-tables
```
Expected: Migration created, Prisma client regenerated with new types.

**Step 8: Update `packages/db/src/index.ts` exports**

Add new types and enums:
```typescript
// Add to model type exports:
//   Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup
// Add to enum exports:
//   ResourceType, FieldVisibility
```

**Step 9: Build and verify**

Run: `pnpm build`
Expected: Clean build, no type errors.

**Step 10: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/ packages/db/src/index.ts packages/db/generated/
git commit -m "feat(db): add granular RBAC schema — Resource, AccessGroup, permissions, field overrides

Adds 5 new tables and 2 new enums for Epic E2b granular RBAC system.
Tables: resources, access_groups, access_group_permissions,
access_group_field_overrides, user_access_groups.
Enums: ResourceType (PAGE/REPORT/SETTING/MAINTENANCE),
FieldVisibility (VISIBLE/READ_ONLY/HIDDEN).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create default data JSON file

**Files:**
- Create: `packages/db/default-data/company-defaults.json`

**Step 1: Create the default-data directory and JSON file**

Create `packages/db/default-data/company-defaults.json` with:

```json
{
  "version": "1.0.0",
  "description": "Nexa ERP Default Company Data — UK SME",
  "resources": [
    { "code": "system.dashboard", "name": "Dashboard", "module": "system", "type": "PAGE", "sortOrder": 10 },
    { "code": "system.users.list", "name": "Users", "module": "system", "type": "PAGE", "sortOrder": 100 },
    { "code": "system.users.detail", "name": "User Detail", "module": "system", "type": "PAGE", "sortOrder": 101, "parentCode": "system.users.list" },
    { "code": "system.access-groups.list", "name": "Access Groups", "module": "system", "type": "PAGE", "sortOrder": 110 },
    { "code": "system.access-groups.detail", "name": "Access Group Detail", "module": "system", "type": "PAGE", "sortOrder": 111, "parentCode": "system.access-groups.list" },
    { "code": "system.company-profile", "name": "Company Profile", "module": "system", "type": "SETTING", "sortOrder": 200 },
    { "code": "system.system-settings", "name": "System Settings", "module": "system", "type": "SETTING", "sortOrder": 210 },
    { "code": "system.currencies", "name": "Currencies", "module": "system", "type": "MAINTENANCE", "sortOrder": 300 },
    { "code": "system.exchange-rates", "name": "Exchange Rates", "module": "system", "type": "MAINTENANCE", "sortOrder": 310 },
    { "code": "system.departments", "name": "Departments", "module": "system", "type": "MAINTENANCE", "sortOrder": 320 },
    { "code": "system.payment-terms", "name": "Payment Terms", "module": "system", "type": "MAINTENANCE", "sortOrder": 330 },
    { "code": "system.vat-codes", "name": "VAT Codes", "module": "system", "type": "MAINTENANCE", "sortOrder": 340 },
    { "code": "system.number-series", "name": "Number Series", "module": "system", "type": "MAINTENANCE", "sortOrder": 350 },
    { "code": "system.tags", "name": "Tags", "module": "system", "type": "MAINTENANCE", "sortOrder": 360 },
    { "code": "system.audit-log", "name": "Audit Log", "module": "system", "type": "REPORT", "sortOrder": 900 }
  ],
  "accessGroups": [
    {
      "code": "FULL_ACCESS",
      "name": "Full Access",
      "description": "Everything enabled — assigned to company creator",
      "isSystem": true,
      "permissions": [
        { "resourceCode": "system.dashboard", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.users.list", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.users.detail", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.access-groups.list", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.access-groups.detail", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.company-profile", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": false },
        { "resourceCode": "system.system-settings", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": false },
        { "resourceCode": "system.currencies", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.exchange-rates", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.departments", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.payment-terms", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.vat-codes", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.number-series", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.tags", "canAccess": true, "canNew": true, "canView": true, "canEdit": true, "canDelete": true },
        { "resourceCode": "system.audit-log", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false }
      ],
      "fieldOverrides": []
    },
    {
      "code": "READ_ONLY",
      "name": "Read Only",
      "description": "View access to all pages, no create/edit/delete",
      "isSystem": true,
      "permissions": [
        { "resourceCode": "system.dashboard", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.users.list", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.users.detail", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.company-profile", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.system-settings", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.currencies", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.exchange-rates", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.departments", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.payment-terms", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.vat-codes", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.number-series", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.tags", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false },
        { "resourceCode": "system.audit-log", "canAccess": true, "canNew": false, "canView": true, "canEdit": false, "canDelete": false }
      ],
      "fieldOverrides": []
    }
  ],
  "vatCodes": [
    { "code": "S", "name": "Standard Rate", "rate": 20, "type": "STANDARD", "isDefault": true },
    { "code": "R", "name": "Reduced Rate", "rate": 5, "type": "REDUCED", "isDefault": false },
    { "code": "Z", "name": "Zero Rate", "rate": 0, "type": "ZERO", "isDefault": false },
    { "code": "E", "name": "Exempt", "rate": 0, "type": "EXEMPT", "isDefault": false },
    { "code": "RC", "name": "Reverse Charge", "rate": 0, "type": "REVERSE_CHARGE", "isDefault": false }
  ],
  "paymentTerms": [
    { "code": "NET30", "name": "Net 30", "dueDays": 30, "isDefault": true },
    { "code": "NET60", "name": "Net 60", "dueDays": 60, "isDefault": false },
    { "code": "DOR", "name": "Due on Receipt", "dueDays": 0, "isDefault": false },
    { "code": "NET14", "name": "Net 14", "dueDays": 14, "isDefault": false }
  ],
  "numberSeries": [
    { "entityType": "INVOICE", "prefix": "INV-", "padding": 5 },
    { "entityType": "CREDIT_NOTE", "prefix": "CN-", "padding": 5 },
    { "entityType": "SALES_ORDER", "prefix": "SO-", "padding": 5 },
    { "entityType": "SALES_QUOTE", "prefix": "QT-", "padding": 5 },
    { "entityType": "PURCHASE_ORDER", "prefix": "PO-", "padding": 5 },
    { "entityType": "BILL", "prefix": "BIL-", "padding": 5 },
    { "entityType": "JOURNAL", "prefix": "JE-", "padding": 5 },
    { "entityType": "PAYMENT", "prefix": "PAY-", "padding": 5 },
    { "entityType": "SHIPMENT", "prefix": "SHP-", "padding": 5 },
    { "entityType": "GOODS_RECEIPT", "prefix": "GRN-", "padding": 5 },
    { "entityType": "EMPLOYEE", "prefix": "EMP-", "padding": 4 },
    { "entityType": "CUSTOMER", "prefix": "CUS-", "padding": 5 },
    { "entityType": "SUPPLIER", "prefix": "SUP-", "padding": 5 }
  ],
  "currencies": [
    { "code": "GBP", "name": "British Pound Sterling", "symbol": "£", "minorUnit": 2 },
    { "code": "EUR", "name": "Euro", "symbol": "€", "minorUnit": 2 },
    { "code": "USD", "name": "US Dollar", "symbol": "$", "minorUnit": 2 }
  ]
}
```

> **Note:** Only system module resources are included initially. Each business module epic (E14 Finance, E16 Sales, etc.) will add its own resources to this file. The remaining 10 pre-built access groups (FINANCE_MANAGER, SALES_STAFF, etc.) will be added when their respective module epics are implemented.

**Step 2: Commit**

```bash
git add packages/db/default-data/
git commit -m "feat(db): add company-defaults.json for default data seeding

Declarative JSON file for company creation. Includes resources,
access groups (FULL_ACCESS + READ_ONLY for now), VAT codes,
payment terms, number series, and currencies. Business module
access groups will be added by their respective epics.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create default data loader utility

**Files:**
- Create: `packages/db/src/utils/default-data-loader.ts`
- Test: `packages/db/src/utils/default-data-loader.test.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Write the test**

Create `packages/db/src/utils/default-data-loader.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { loadDefaultData, type CompanyDefaults } from './default-data-loader.js';

describe('loadDefaultData', () => {
  it('loads and parses company-defaults.json', () => {
    const data = loadDefaultData();
    expect(data.version).toBe('1.0.0');
    expect(data.resources.length).toBeGreaterThan(0);
    expect(data.accessGroups.length).toBeGreaterThan(0);
    expect(data.vatCodes.length).toBeGreaterThan(0);
    expect(data.paymentTerms.length).toBeGreaterThan(0);
    expect(data.numberSeries.length).toBeGreaterThan(0);
    expect(data.currencies.length).toBeGreaterThan(0);
  });

  it('validates resource codes are unique', () => {
    const data = loadDefaultData();
    const codes = data.resources.map(r => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('validates access group codes are unique', () => {
    const data = loadDefaultData();
    const codes = data.accessGroups.map(g => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('validates all permission resourceCodes reference existing resources', () => {
    const data = loadDefaultData();
    const resourceCodes = new Set(data.resources.map(r => r.code));
    for (const group of data.accessGroups) {
      for (const perm of group.permissions) {
        expect(resourceCodes.has(perm.resourceCode), `Missing resource: ${perm.resourceCode} in group ${group.code}`).toBe(true);
      }
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/../../packages/db/src/utils/default-data-loader.test.ts`
Expected: FAIL — module not found

**Step 3: Write the loader**

Create `packages/db/src/utils/default-data-loader.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ResourceDefault {
  code: string;
  name: string;
  module: string;
  type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
  sortOrder: number;
  parentCode?: string;
  icon?: string;
  description?: string;
}

export interface PermissionDefault {
  resourceCode: string;
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface FieldOverrideDefault {
  resourceCode: string;
  fieldPath: string;
  visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
}

export interface AccessGroupDefault {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionDefault[];
  fieldOverrides: FieldOverrideDefault[];
}

export interface CompanyDefaults {
  version: string;
  description: string;
  resources: ResourceDefault[];
  accessGroups: AccessGroupDefault[];
  vatCodes: Array<{ code: string; name: string; rate: number; type: string; isDefault: boolean }>;
  paymentTerms: Array<{ code: string; name: string; dueDays: number; isDefault: boolean }>;
  numberSeries: Array<{ entityType: string; prefix: string; padding: number }>;
  currencies: Array<{ code: string; name: string; symbol: string; minorUnit: number }>;
}

/**
 * Load the company defaults JSON file from `packages/db/default-data/`.
 * @param filename — defaults to 'company-defaults.json'
 */
export function loadDefaultData(filename = 'company-defaults.json'): CompanyDefaults {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, '../../default-data', filename);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CompanyDefaults;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/db && npx vitest run src/utils/default-data-loader.test.ts`
Expected: PASS

**Step 5: Export from index.ts**

Add to `packages/db/src/index.ts`:
```typescript
export { loadDefaultData, type CompanyDefaults } from './utils/default-data-loader';
```

**Step 6: Build and commit**

```bash
pnpm build
git add packages/db/src/utils/default-data-loader.ts packages/db/src/utils/default-data-loader.test.ts packages/db/src/index.ts
git commit -m "feat(db): add default data loader utility

Reads company-defaults.json and returns typed CompanyDefaults object.
Used by seed.ts and company creation flow to import default data.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update seed.ts to seed resources and access groups

**Files:**
- Modify: `packages/db/prisma/seed.ts`

**Step 1: Add resource and access group seeding**

Import the loader and add seeding functions after the existing seed functions. The seed should:
1. Load `company-defaults.json`
2. Upsert all resources (global, not company-scoped)
3. Upsert access groups + permissions + field overrides for the default company
4. Assign FULL_ACCESS group to the default admin user

Key code additions to `seed.ts`:

```typescript
import { loadDefaultData } from '../src/utils/default-data-loader.js';
import { ResourceType, FieldVisibility } from '../generated/prisma/client';

async function seedResources() {
  const defaults = loadDefaultData();
  for (const r of defaults.resources) {
    await prisma.resource.upsert({
      where: { code: r.code },
      update: { name: r.name, module: r.module, type: r.type as ResourceType, parentCode: r.parentCode ?? null, sortOrder: r.sortOrder, icon: r.icon ?? null, description: r.description ?? null },
      create: { code: r.code, name: r.name, module: r.module, type: r.type as ResourceType, parentCode: r.parentCode ?? null, sortOrder: r.sortOrder, icon: r.icon ?? null, description: r.description ?? null },
    });
  }
  console.log(`Seeded ${defaults.resources.length} resources`);
}

async function seedAccessGroups() {
  const defaults = loadDefaultData();
  for (const group of defaults.accessGroups) {
    const ag = await prisma.accessGroup.upsert({
      where: { companyId_code: { companyId: DEFAULT_COMPANY_ID, code: group.code } },
      update: { name: group.name, description: group.description, isSystem: group.isSystem, updatedBy: 'system-seed' },
      create: { companyId: DEFAULT_COMPANY_ID, code: group.code, name: group.name, description: group.description, isSystem: group.isSystem, createdBy: 'system-seed', updatedBy: 'system-seed' },
    });

    // Upsert permissions
    for (const perm of group.permissions) {
      await prisma.accessGroupPermission.upsert({
        where: { accessGroupId_resourceCode: { accessGroupId: ag.id, resourceCode: perm.resourceCode } },
        update: { canAccess: perm.canAccess, canNew: perm.canNew, canView: perm.canView, canEdit: perm.canEdit, canDelete: perm.canDelete },
        create: { accessGroupId: ag.id, resourceCode: perm.resourceCode, canAccess: perm.canAccess, canNew: perm.canNew, canView: perm.canView, canEdit: perm.canEdit, canDelete: perm.canDelete },
      });
    }

    // Upsert field overrides
    for (const fo of group.fieldOverrides) {
      await prisma.accessGroupFieldOverride.upsert({
        where: { accessGroupId_resourceCode_fieldPath: { accessGroupId: ag.id, resourceCode: fo.resourceCode, fieldPath: fo.fieldPath } },
        update: { visibility: fo.visibility as FieldVisibility },
        create: { accessGroupId: ag.id, resourceCode: fo.resourceCode, fieldPath: fo.fieldPath, visibility: fo.visibility as FieldVisibility },
      });
    }
  }
  console.log(`Seeded ${defaults.accessGroups.length} access groups with permissions`);
}

async function assignDefaultUserAccessGroups() {
  // Assign FULL_ACCESS group to default admin user
  const fullAccessGroup = await prisma.accessGroup.findUnique({
    where: { companyId_code: { companyId: DEFAULT_COMPANY_ID, code: 'FULL_ACCESS' } },
  });
  if (fullAccessGroup) {
    const existing = await prisma.userAccessGroup.findFirst({
      where: { userId: DEFAULT_USER_ID, accessGroupId: fullAccessGroup.id, companyId: DEFAULT_COMPANY_ID },
    });
    if (!existing) {
      await prisma.userAccessGroup.create({
        data: { userId: DEFAULT_USER_ID, accessGroupId: fullAccessGroup.id, companyId: DEFAULT_COMPANY_ID, assignedBy: 'system-seed' },
      });
    }
  }
  console.log('Assigned FULL_ACCESS group to default admin user');
}
```

Add to `main()`:
```typescript
  await seedResources();
  await seedAccessGroups();
  await assignDefaultUserAccessGroups();
```

**Step 2: Run seed**

Run: `cd packages/db && npx prisma db seed`
Expected: All resources and access groups seeded successfully.

**Step 3: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(db): seed resources and access groups from default data file

Seed now loads company-defaults.json and upserts resources,
access groups, permissions, and field overrides. Assigns
FULL_ACCESS group to the default admin user.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Story 2: Permission Service & Guards

### Task 5: Permission cache service

**Files:**
- Create: `apps/api/src/core/rbac/permission-cache.ts`
- Test: `apps/api/src/core/rbac/permission-cache.test.ts`

**Step 1: Write the test**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionCache } from './permission-cache.js';

describe('PermissionCache', () => {
  let cache: PermissionCache;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for cache miss', () => {
    cache = new PermissionCache();
    expect(cache.get('user1', 'company1')).toBeUndefined();
  });

  it('stores and retrieves cached permissions', () => {
    cache = new PermissionCache();
    const perms = { permissions: {}, fieldOverrides: {}, enabledModules: [] };
    cache.set('user1', 'company1', perms);
    expect(cache.get('user1', 'company1')).toBe(perms);
  });

  it('invalidates by userId + companyId', () => {
    cache = new PermissionCache();
    const perms = { permissions: {}, fieldOverrides: {}, enabledModules: [] };
    cache.set('user1', 'company1', perms);
    cache.invalidate('user1', 'company1');
    expect(cache.get('user1', 'company1')).toBeUndefined();
  });

  it('invalidates all entries for a company', () => {
    cache = new PermissionCache();
    cache.set('user1', 'company1', { permissions: {}, fieldOverrides: {}, enabledModules: [] });
    cache.set('user2', 'company1', { permissions: {}, fieldOverrides: {}, enabledModules: [] });
    cache.invalidateCompany('company1');
    expect(cache.get('user1', 'company1')).toBeUndefined();
    expect(cache.get('user2', 'company1')).toBeUndefined();
  });

  it('auto-expires entries after TTL', () => {
    vi.useFakeTimers();
    cache = new PermissionCache(1000); // 1s TTL
    cache.set('user1', 'company1', { permissions: {}, fieldOverrides: {}, enabledModules: [] });
    vi.advanceTimersByTime(1001);
    expect(cache.get('user1', 'company1')).toBeUndefined();
    vi.useRealTimers();
  });
});
```

**Step 2: Write the implementation**

```typescript
export interface ResolvedPermissions {
  permissions: Record<string, { canAccess: boolean; canNew: boolean; canView: boolean; canEdit: boolean; canDelete: boolean }>;
  fieldOverrides: Record<string, Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>>;
  enabledModules: string[];
}

interface CacheEntry {
  data: ResolvedPermissions;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds

export class PermissionCache {
  private store = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(userId: string, companyId: string): string {
    return `permissions:${userId}:${companyId}`;
  }

  get(userId: string, companyId: string): ResolvedPermissions | undefined {
    const entry = this.store.get(this.key(userId, companyId));
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(userId, companyId));
      return undefined;
    }
    return entry.data;
  }

  set(userId: string, companyId: string, data: ResolvedPermissions): void {
    this.store.set(this.key(userId, companyId), {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(userId: string, companyId: string): void {
    this.store.delete(this.key(userId, companyId));
  }

  invalidateCompany(companyId: string): void {
    const suffix = `:${companyId}`;
    for (const key of this.store.keys()) {
      if (key.endsWith(suffix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton instance
export const permissionCache = new PermissionCache();
```

**Step 3: Run tests, verify pass, commit**

---

### Task 6: Permission service — resolve user permissions

**Files:**
- Create: `apps/api/src/core/rbac/permission.service.ts`
- Test: `apps/api/src/core/rbac/permission.service.test.ts`

This is the core permission resolution service. It:
1. Checks cache first
2. Queries DB for user's access groups and their permissions
3. Merges using most-permissive-wins (OR for booleans, VISIBLE > READ_ONLY > HIDDEN)
4. Derives `enabledModules` from the merged permission set
5. Caches the result

**Key function signature:**
```typescript
export async function resolvePermissions(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<ResolvedPermissions>
```

**Resolution algorithm (matching design doc):**
1. Query `UserAccessGroup` for this userId + companyId
2. Query `AccessGroupPermission` for all those groups
3. Query `AccessGroupFieldOverride` for all those groups
4. Merge permissions: for each resource, OR all boolean flags
5. Merge field overrides: for each field, pick the most permissive visibility
6. Derive enabledModules: unique set of modules where at least one resource has `canAccess: true`

**Convenience functions:**
```typescript
export async function hasPermission(prisma, userId, companyId, resourceCode, action?): Promise<boolean>
export async function getFieldVisibility(prisma, userId, companyId, resourceCode, fieldPath): Promise<'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>
```

Tests should cover:
- Single access group → permissions returned correctly
- Multiple access groups → most-permissive-wins merging
- No access groups → all denied
- Cache hit returns cached data
- Cache invalidation forces DB re-query
- Field overrides merge correctly (VISIBLE beats READ_ONLY beats HIDDEN)
- enabledModules derived correctly

---

### Task 7: createPermissionGuard middleware

**Files:**
- Create: `apps/api/src/core/rbac/permission.guard.ts`
- Test: `apps/api/src/core/rbac/permission.guard.test.ts`
- Modify: `apps/api/src/core/rbac/index.ts`

**Key function:**
```typescript
export function createPermissionGuard(
  resourceCode: string,
  action?: 'new' | 'view' | 'edit' | 'delete',
): preHandlerHookHandler
```

**Logic:**
1. If `request.userRole === 'SUPER_ADMIN'` → ALLOW (bypass)
2. Call `resolvePermissions(prisma, userId, companyId)`
3. Check `permissions[resourceCode]?.canAccess` → if false, DENY (403)
4. If `action` specified, check `permissions[resourceCode]?.[`can${Action}`]` → if false, DENY (403)
5. ALLOW

**Tests (mirror rbac.guard.test.ts pattern):**
- SUPER_ADMIN bypasses all checks
- User with canAccess: false → 403
- User with canAccess: true but canNew: false → 403 on 'new' action
- User with canAccess: true and canNew: true → 200 on 'new' action
- User with no access groups → 403

**Update `apps/api/src/core/rbac/index.ts`:**
```typescript
export { createPermissionGuard } from './permission.guard.js';
export { resolvePermissions, hasPermission } from './permission.service.js';
export { permissionCache } from './permission-cache.js';
// Keep existing exports for backward compatibility during migration:
export { ROLE_LEVEL, hasMinimumRole, type RbacGuardOptions } from './rbac.types.js';
export { createRbacGuard } from './rbac.guard.js';
```

---

### Task 8: filterFieldsByPermission response hook

**Files:**
- Create: `apps/api/src/core/rbac/field-filter.hook.ts`
- Test: `apps/api/src/core/rbac/field-filter.hook.test.ts`

**Key function:**
```typescript
export function filterFieldsByPermission(resourceCode: string): onSendHookHandler
```

**Logic:**
1. Load resolved permissions for the user (from cache)
2. Get field overrides for this resourceCode
3. If no overrides → passthrough
4. For each HIDDEN field: remove from response JSON
5. For each READ_ONLY field: add to `_fieldMeta` object
6. Return modified response

**Tests:**
- No field overrides → response unchanged
- HIDDEN field → removed from response data
- READ_ONLY field → present in data, marked in `_fieldMeta`
- VISIBLE field → unchanged
- SUPER_ADMIN → no filtering applied

---

## Story 3: API Routes

### Task 9: Resource list endpoint

**Files:**
- Create: `apps/api/src/modules/system/resource.routes.ts`
- Create: `apps/api/src/modules/system/resource.schema.ts`
- Test: `apps/api/src/modules/system/resource.routes.test.ts`
- Modify: `apps/api/src/modules/system/index.ts`

**Endpoint:** `GET /system/resources`
- Auth: ADMIN (uses `createRbacGuard({ minimumRole: UserRole.ADMIN })` for now; will switch to `createPermissionGuard` once all routes are migrated)
- Query params: `module`, `type`, `search`, `isActive`
- Returns list of all resources

---

### Task 10: Access group CRUD routes

**Files:**
- Create: `apps/api/src/modules/system/access-group.routes.ts`
- Create: `apps/api/src/modules/system/access-group.schema.ts`
- Create: `apps/api/src/modules/system/access-group.service.ts`
- Test: `apps/api/src/modules/system/access-group.routes.test.ts`
- Modify: `apps/api/src/modules/system/index.ts`

**Endpoints:**
- `GET /system/access-groups` — list for current company
- `GET /system/access-groups/:id` — detail with permissions + field overrides
- `POST /system/access-groups` — create
- `PATCH /system/access-groups/:id` — update metadata
- `DELETE /system/access-groups/:id` — soft-delete (isActive=false)
- `PUT /system/access-groups/:id/permissions` — replace-all permissions
- `PUT /system/access-groups/:id/field-overrides` — replace-all field overrides

**Business rules:**
- System groups (`isSystem: true`) cannot be deleted
- Deactivating a group with active users requires confirmation or auto-reassignment
- Permission changes invalidate the permission cache for all affected users

---

### Task 11: User access group assignment routes

**Files:**
- Modify: `apps/api/src/modules/system/user.routes.ts`
- Modify: `apps/api/src/modules/system/user.service.ts`
- Modify: `apps/api/src/modules/system/user.schema.ts`

**Endpoints:**
- `GET /system/users/:id/access-groups` — get user's assigned groups
- `PUT /system/users/:id/access-groups` — replace-all group assignment

**Business rules:**
- Users must have at least one access group (validation)
- Assignment changes invalidate the permission cache for the user

---

### Task 12: My permissions endpoint

**Files:**
- Modify: `apps/api/src/modules/system/user.routes.ts` (or new file)

**Endpoint:** `GET /system/my-permissions`
- Auth: any authenticated user
- Returns the caller's resolved permissions (from cache)
- Frontend calls this on login + company switch

---

### Task 13: Default data export/import endpoints

**Files:**
- Modify: `apps/api/src/modules/system/company-profile.routes.ts`
- Modify: `apps/api/src/modules/system/company-profile.service.ts`

**Endpoints:**
- `GET /system/company-profile/export-defaults` — export current company config as JSON
- `POST /system/company-profile/import-defaults` — import default data (upsert)

---

## Story 4: Integration & Migration

### Task 14: Update company-context middleware

**Files:**
- Modify: `apps/api/src/core/middleware/company-context.ts`
- Update: `apps/api/src/core/middleware/company-context.test.ts`

**Changes:**
- After resolving `userRole`, also load the user's access groups (via `resolvePermissions` or a lighter query)
- Set `request.accessGroupIds` (or store resolved permissions on request for downstream use)
- Keep `request.userRole` for SUPER_ADMIN/ADMIN checks

---

### Task 15: Update createCompanyProfile to seed defaults

**Files:**
- Modify: `apps/api/src/modules/system/company-profile.service.ts`

**Changes:**
When a new company is created (`createCompanyProfile`), also:
1. Load `company-defaults.json`
2. Create AccessGroup records for the new company
3. Create AccessGroupPermission records
4. Create AccessGroupFieldOverride records
5. Assign FULL_ACCESS group to the creating user

---

### Task 16: Migrate existing routes to createPermissionGuard

**Files:**
- Modify: `apps/api/src/modules/system/company-profile.routes.ts`
- Modify: `apps/api/src/modules/system/user.routes.ts`
- Modify: `apps/api/src/modules/system/company.routes.ts`

**Changes:**
Replace all `createRbacGuard({ minimumRole: UserRole.X })` calls with `createPermissionGuard(resourceCode, action)`:

| Before | After |
|--------|-------|
| `createRbacGuard({ minimumRole: UserRole.VIEWER })` for GET company-profile | `createPermissionGuard('system.company-profile', 'view')` |
| `createRbacGuard({ minimumRole: UserRole.ADMIN })` for POST company-profile | `createPermissionGuard('system.company-profile', 'new')` |
| `createRbacGuard({ minimumRole: UserRole.ADMIN })` for PATCH company-profile | `createPermissionGuard('system.company-profile', 'edit')` |
| `createRbacGuard({ minimumRole: UserRole.ADMIN })` for POST users | `createPermissionGuard('system.users.list', 'new')` |
| `createRbacGuard({ minimumRole: UserRole.ADMIN })` for GET users | `createPermissionGuard('system.users.list', 'view')` |
| etc. | etc. |

> **Important:** Keep `createRbacGuard` available (not deleted) for backward compatibility during the migration window. Mark it as `@deprecated` in JSDoc.

---

### Task 17: Deprecate enabledModules

**Files:**
- Modify: `apps/api/src/core/auth/jwt-verify.hook.ts`
- Modify: `apps/api/src/core/auth/auth.service.ts` (JWT generation)
- Modify: `apps/api/src/core/types/request-context.ts`

**Changes:**
- JWT generation: keep `enabledModules` in JWT for now (backward compat) but mark as deprecated
- Request context: add `resolvedPermissions` field, keep `enabledModules` as derived from permissions
- Module access: derived from permission resolution, not from JWT claim

> **Note:** Full removal of `enabledModules` from the JWT and User model happens in a follow-up cleanup task after all routes are migrated.

---

## Implementation Order

Execute stories in order:

1. **Story 1** (Tasks 1-4): Schema + seed → ensures DB layer works
2. **Story 2** (Tasks 5-8): Permission service + guards → core logic
3. **Story 3** (Tasks 9-13): API routes → expose to frontend
4. **Story 4** (Tasks 14-17): Integration → wire everything together

Each story ends with a working, testable increment.

---

## Testing Strategy

- **Unit tests:** Permission cache, permission resolution, guards, field filter (Vitest, mock Prisma)
- **Integration tests:** Route tests using Fastify inject (no real DB), mock permission service
- **E2E tests:** Full-stack tests via the post-epic test runner (curl-based, real DB)

Run all tests:
```bash
cd apps/api && pnpm test
```

---

## Files Created/Modified Summary

| Action | Path |
|--------|------|
| Modify | `packages/db/prisma/schema.prisma` |
| Create | `packages/db/default-data/company-defaults.json` |
| Create | `packages/db/src/utils/default-data-loader.ts` |
| Create | `packages/db/src/utils/default-data-loader.test.ts` |
| Modify | `packages/db/src/index.ts` |
| Modify | `packages/db/prisma/seed.ts` |
| Create | `apps/api/src/core/rbac/permission-cache.ts` |
| Create | `apps/api/src/core/rbac/permission-cache.test.ts` |
| Create | `apps/api/src/core/rbac/permission.service.ts` |
| Create | `apps/api/src/core/rbac/permission.service.test.ts` |
| Create | `apps/api/src/core/rbac/permission.guard.ts` |
| Create | `apps/api/src/core/rbac/permission.guard.test.ts` |
| Create | `apps/api/src/core/rbac/field-filter.hook.ts` |
| Create | `apps/api/src/core/rbac/field-filter.hook.test.ts` |
| Create | `apps/api/src/modules/system/resource.routes.ts` |
| Create | `apps/api/src/modules/system/resource.schema.ts` |
| Create | `apps/api/src/modules/system/resource.routes.test.ts` |
| Create | `apps/api/src/modules/system/access-group.routes.ts` |
| Create | `apps/api/src/modules/system/access-group.schema.ts` |
| Create | `apps/api/src/modules/system/access-group.service.ts` |
| Create | `apps/api/src/modules/system/access-group.routes.test.ts` |
| Modify | `apps/api/src/modules/system/user.routes.ts` |
| Modify | `apps/api/src/modules/system/user.service.ts` |
| Modify | `apps/api/src/modules/system/user.schema.ts` |
| Modify | `apps/api/src/modules/system/index.ts` |
| Modify | `apps/api/src/modules/system/company-profile.routes.ts` |
| Modify | `apps/api/src/modules/system/company-profile.service.ts` |
| Modify | `apps/api/src/modules/system/company.routes.ts` |
| Modify | `apps/api/src/core/middleware/company-context.ts` |
| Modify | `apps/api/src/core/auth/jwt-verify.hook.ts` |
| Modify | `apps/api/src/core/auth/auth.service.ts` |
| Modify | `apps/api/src/core/types/request-context.ts` |
| Modify | `apps/api/src/core/rbac/index.ts` |

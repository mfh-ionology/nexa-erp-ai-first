# Story 1.3: Multi-Company Models

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want RegisterSharingRule and UserCompanyRole models defined with their enums, plus a getVisibleCompanyIds utility,
so that the system supports per-entity register sharing between companies and per-company role overrides.

## Acceptance Criteria

1. GIVEN the RegisterSharingRule model WHEN I inspect it THEN it has entityType, sharingMode (SharingMode enum: NONE, ALL_COMPANIES, SELECTED), sourceCompanyId, and optional targetCompanyId fields with a unique constraint on [entityType, sourceCompanyId, targetCompanyId]
2. GIVEN the UserCompanyRole model WHEN I inspect it THEN it has userId, optional companyId (null = global role), and role (UserRole enum) with a unique constraint on [userId, companyId]
3. GIVEN the SharingMode enum WHEN I inspect it THEN it contains exactly NONE, ALL_COMPANIES, SELECTED values
4. GIVEN the UserRole enum WHEN I inspect it THEN it contains SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER in hierarchy order
5. GIVEN a helper function getVisibleCompanyIds(companyId, entityType) WHEN called THEN it returns the set of companyIds visible based on RegisterSharingRule configuration per Project Context §1

## Tasks / Subtasks

- [x] Task 1: Define SharingMode enum (AC: #3)
  - [x] 1.1 Add `SharingMode` enum to `packages/db/prisma/schema.prisma` with values: `NONE`, `ALL_COMPANIES`, `SELECTED`
  - [x] 1.2 Apply `@@map("sharing_mode")` for snake_case DB naming

- [x] Task 2: Define RegisterSharingRule model (AC: #1)
  - [x] 2.1 Add model with fields: `id` (UUID PK), `entityType` (String), `sharingMode` (SharingMode enum), `sourceCompanyId` (String FK), `targetCompanyId` (String? nullable — null when sharingMode is ALL_COMPANIES)
  - [x] 2.2 Add named relations to CompanyProfile: `sourceCompany @relation("SharingSource", ...)` and `targetCompany @relation("SharingTarget", ...)`
  - [x] 2.3 Add unique constraint: `@@unique([entityType, sourceCompanyId, targetCompanyId], map: "uq_sharing_rule")`
  - [x] 2.4 Add `createdAt`/`updatedAt` audit fields
  - [x] 2.5 Apply `@@map("register_sharing_rules")` and `@map("snake_case")` to all fields
  - [x] 2.6 Add inverse relations on CompanyProfile: `sharingRulesAsSource RegisterSharingRule[] @relation("SharingSource")` and `sharingRulesAsTarget RegisterSharingRule[] @relation("SharingTarget")`

- [x] Task 3: Define UserRole enum (AC: #4)
  - [x] 3.1 Add `UserRole` enum with values: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `VIEWER` (hierarchy order)
  - [x] 3.2 Apply `@@map("user_role")` for snake_case DB naming

- [x] Task 4: Define ViewScope enum
  - [x] 4.1 Add `ViewScope` enum with values: `OWN`, `DEPARTMENT`, `COMPANY` per Data Models §4.1
  - [x] 4.2 Apply `@@map("view_scope")` for snake_case DB naming
  - [x] 4.3 NOTE: ViewScope is listed in the spec's enum reference alongside UserRole and will be needed by E2 (RBAC permission guards). Define it now to avoid a future migration just for an enum.

- [x] Task 5: Define UserCompanyRole model (AC: #2)
  - [x] 5.1 Add model with fields: `id` (UUID PK), `userId` (String — FK to User added in E1-4), `companyId` (String? nullable — null = global role), `role` (UserRole enum)
  - [x] 5.2 Add unique constraint: `@@unique([userId, companyId], map: "uq_user_company_role")`
  - [x] 5.3 **CRITICAL — Nullable unique constraint pitfall**: PostgreSQL treats NULLs as distinct in unique constraints. `@@unique([userId, companyId])` allows multiple rows with the same userId where companyId IS NULL. To enforce "one global role per user", add a **partial unique index** via raw SQL in the migration: `CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;`
  - [x] 5.4 Add relation to CompanyProfile: `company CompanyProfile? @relation(fields: [companyId], references: [id])`
  - [x] 5.5 Do NOT add a relation to User yet — the User model does not exist until E1-4. Add a `// TODO: E1-4 — add User relation when User model is defined` comment on the userId field. E1-4 will add the `user User @relation(fields: [userId], references: [id])` and the inverse `UserCompanyRole[]` on User.
  - [x] 5.6 Add `createdAt`/`updatedAt` audit fields
  - [x] 5.7 Apply `@@map("user_company_roles")` and `@map("snake_case")` to all fields
  - [x] 5.8 Add inverse relation on CompanyProfile: `userCompanyRoles UserCompanyRole[]`

- [x] Task 6: Implement getVisibleCompanyIds utility (AC: #5)
  - [x] 6.1 Create `packages/db/src/utils/sharing.ts`
  - [x] 6.2 Implement `async function getVisibleCompanyIds(prisma: PrismaClient, companyId: string, entityType: string): Promise<string[]>` following the exact query pattern from Project Context §1:
    - Query RegisterSharingRule WHERE `(sourceCompanyId = companyId AND entityType = entityType) OR (targetCompanyId = companyId AND entityType = entityType) OR (sharingMode = ALL_COMPANIES AND entityType = entityType)`
    - Start with `Set([companyId])` (current company is always visible)
    - For ALL_COMPANIES rules: fetch all company IDs and add to set
    - For SELECTED rules: add both sourceCompanyId and targetCompanyId to set
    - Return `Array.from(ids)`
  - [x] 6.3 Accept `PrismaClient` as parameter (dependency injection) — do NOT import the singleton. This allows testing with a test client.
  - [x] 6.4 Export from `packages/db/src/index.ts`

- [x] Task 7: Implement resolveUserRole utility
  - [x] 7.1 Create `packages/db/src/utils/rbac.ts`
  - [x] 7.2 Implement `async function resolveUserRole(prisma: PrismaClient, userId: string, companyId: string): Promise<UserRole | null>` following Project Context §2 resolution order:
    - Step 1: Query UserCompanyRole WHERE userId = userId AND companyId = companyId
    - Step 2: If found, return that role (company-specific override)
    - Step 3: If not found, query WHERE userId = userId AND companyId IS NULL
    - Step 4: If found, return that role (global fallback)
    - Step 5: If neither, return null (no access)
  - [x] 7.3 Accept `PrismaClient` as parameter (dependency injection)
  - [x] 7.4 Export from `packages/db/src/index.ts`

- [x] Task 8: Write unit/integration tests (AC: #5, #2)
  - [x] 8.1 Create `packages/db/src/utils/__tests__/sharing.test.ts`
  - [x] 8.2 Test getVisibleCompanyIds for all three SharingMode scenarios:
    - NONE: returns only the input companyId
    - ALL_COMPANIES: returns all company IDs in the tenant
    - SELECTED: returns input companyId + source + target from matching rules
  - [x] 8.3 Create `packages/db/src/utils/__tests__/rbac.test.ts`
  - [x] 8.4 Test resolveUserRole for all resolution paths:
    - Company-specific role exists → returns it
    - No company-specific, global exists → returns global
    - Neither exists → returns null
  - [x] 8.5 Use Vitest (already in devDependencies). Tests need a real database — use the Docker Compose PostgreSQL from E0-3. Set up test database via `DATABASE_URL` pointing to a test schema or use Prisma's `--schema` flag.
  - [x] 8.6 Add vitest config if not present: `packages/db/vitest.config.ts`

- [x] Task 9: Update exports in packages/db/src/index.ts (AC: #1-#5)
  - [x] 9.1 Add type exports: `RegisterSharingRule`, `UserCompanyRole`
  - [x] 9.2 Add enum exports: `SharingMode`, `UserRole`, `ViewScope`
  - [x] 9.3 Add function exports: `getVisibleCompanyIds`, `resolveUserRole`

- [x] Task 10: Run migration and verify (AC: #1-#5)
  - [x] 10.1 Run `prisma migrate dev --name add-multi-company-models`
  - [x] 10.2 After migration is generated, manually add the partial unique index to the migration SQL: `CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;`
  - [x] 10.3 Re-run `prisma migrate dev` to apply the amended migration
  - [x] 10.4 Run `prisma generate` and verify types compile
  - [x] 10.5 Run `prisma db seed` and verify existing seed data still works
  - [x] 10.6 Run tests: `pnpm --filter @nexa/db test`

## Dev Notes

### Key Architecture Patterns

- **companyId on EVERY table**: RegisterSharingRule uses `sourceCompanyId` and `targetCompanyId` FKs (not a single companyId) because it defines cross-company relationships. UserCompanyRole has a nullable `companyId` (null = global role that applies to all companies).
- **UUID PKs**: Both models use `id String @id @default(uuid())`.
- **snake_case mapping**: `@@map("register_sharing_rules")`, `@@map("user_company_roles")`, and `@map("snake_case")` on all fields.
- **Named relations**: RegisterSharingRule requires two named relations to CompanyProfile (`SharingSource`, `SharingTarget`) because it has two FK fields pointing to the same model. Prisma requires named `@relation()` pairs for disambiguating multiple relations to the same model.
- **No createdBy/updatedBy**: These are configuration entities, not business transactions. Follow the same pattern as Department, PaymentTerms, etc. from E1-2 (createdAt/updatedAt only).
- **Enums as PostgreSQL enums**: Follow E1-2 pattern (VatType, TagType, etc.). Be aware that PostgreSQL enums cannot have values removed after creation — only added. SharingMode (3 values) and UserRole (5 values) are stable and well-defined, so enum type is appropriate.

### Critical: Nullable companyId in @@unique

The `UserCompanyRole.companyId` is nullable (`String?`). In PostgreSQL, `NULL != NULL` in unique constraints, meaning `@@unique([userId, companyId])` does NOT prevent multiple rows with the same userId where companyId IS NULL. This would allow a user to have multiple "global" roles — a data corruption bug.

**Solution**: Add a partial unique index via raw SQL in the migration file:
```sql
CREATE UNIQUE INDEX "uq_user_company_role_global"
  ON "user_company_roles" ("user_id")
  WHERE "company_id" IS NULL;
```

This ensures exactly one global role per user while allowing multiple company-specific roles.

### Critical: No User Model Yet

The User model is defined in E1-4 (next story). The `UserCompanyRole.userId` field will be a plain String field for now — no FK relation or foreign key constraint. When E1-4 creates the User model, it will:
1. Add the relation on UserCompanyRole: `user User @relation(fields: [userId], references: [id])`
2. Add the inverse on User: `companyRoles UserCompanyRole[]`

Do NOT try to create a User model stub — that would cause conflicts with E1-4.

### Previous Story Intelligence (E1-2)

E1-2 completed successfully with all models defined. Key learnings from E1-2 code review:

1. **Single init migration (HIGH)**: E1-2 squashed E1-1's migration into a single `init`. For this story, create an **incremental migration** (`add-multi-company-models`), not a replacement. Do NOT delete existing migration files.
2. **datasource block missing url (HIGH)**: `schema.prisma` has no `url` in the datasource block. This is a known issue from E1-2 — do NOT add it now as it would change the established pattern. Leave for a future fix.
3. **Document Sync Rule violations (MEDIUM)**: E1-2 had 6 new enums not declared in the data-models spec. When adding SharingMode and UserRole enums, these are already declared in the spec (Data Models §4.1) — no violation for this story's enums.
4. **CompanyProfile.createdBy/updatedBy required non-nullable (MEDIUM)**: Be aware that CompanyProfile requires these fields on create. The seed sets them to "system-seed".
5. **vitest in devDependencies but no tests**: E1-2 added vitest but has no tests. This story introduces the first real tests.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: RegisterSharingRule is the mechanism that extends companyId scoping. UserCompanyRole scopes access control per company. Both are foundational to the multi-company pattern.
- **i18n**: N/A — no UI in this story
- **Audit**: No events emitted for configuration entity changes (Event Catalog confirms N/A). Audit logging via event bus will be added in E3.
- **Attachments/Notes/Tasks**: N/A — these are configuration entities, not business records

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.3 Schema Design Principles | companyId on every table, RegisterSharingRule pattern for cross-company visibility, named relations for two FKs to same model |
| **API Contracts** | §1 RBAC Roles | Role hierarchy: SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER. SUPER_ADMIN = all operations across all tenants; ADMIN = all within tenant; MANAGER = CRUD + approve + delete within modules; STAFF = create + read + update (no delete/approve); VIEWER = read-only |
| **State Machine** | N/A | Configuration entities — no lifecycle state machines |
| **Event Catalog** | N/A | No events for config changes. Future: `sharing.rule.created`, `user.role.assigned` if audit required |
| **Data Models** | §3.1 System Module, §4.1 Enums | RegisterSharingRule, UserCompanyRole models; SharingMode (NONE/ALL_COMPANIES/SELECTED), UserRole (SUPER_ADMIN/ADMIN/MANAGER/STAFF/VIEWER), ViewScope (OWN/DEPARTMENT/COMPANY) enums |
| **Business Rules** | §14 IMP-007 | RBAC with 5 default roles. All sensitive operations gated by RBAC permissions. |
| **Project Context** | §1 Multi-Company Architecture, §2 RBAC | getVisibleCompanyIds query pattern (exact implementation provided); Role resolution: 1) company-specific, 2) global (companyId=NULL), 3) no access |

### Project Structure Notes

- Schema changes: `packages/db/prisma/schema.prisma` (add enums and models, add inverse relations on CompanyProfile)
- New utility files:
  - `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds function
  - `packages/db/src/utils/rbac.ts` — resolveUserRole function
- New test files:
  - `packages/db/src/utils/__tests__/sharing.test.ts`
  - `packages/db/src/utils/__tests__/rbac.test.ts`
- Updated exports: `packages/db/src/index.ts` (add new types, enums, functions)
- Migration: `packages/db/prisma/migrations/<timestamp>_add_multi_company_models/migration.sql` (incremental, NOT replacement)
- No changes to: `packages/db/src/client.ts`, `packages/db/prisma.config.ts`, `packages/db/prisma/seed.ts` (no new seed data for this story — sharing rules and roles are tenant-configured, not seeded)

### Exact Prisma Schema for Models

For reference, here is the exact schema from Architecture spec and Project Context:

```prisma
enum SharingMode {
  NONE
  ALL_COMPANIES
  SELECTED

  @@map("sharing_mode")
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  STAFF
  VIEWER

  @@map("user_role")
}

enum ViewScope {
  OWN
  DEPARTMENT
  COMPANY

  @@map("view_scope")
}

model RegisterSharingRule {
  id              String       @id @default(uuid()) @map("id")
  entityType      String       @map("entity_type")
  sharingMode     SharingMode  @map("sharing_mode")
  sourceCompanyId String       @map("source_company_id")
  targetCompanyId String?      @map("target_company_id")

  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  sourceCompany   CompanyProfile  @relation("SharingSource", fields: [sourceCompanyId], references: [id])
  targetCompany   CompanyProfile? @relation("SharingTarget", fields: [targetCompanyId], references: [id])

  @@unique([entityType, sourceCompanyId, targetCompanyId], map: "uq_sharing_rule")
  @@map("register_sharing_rules")
}

model UserCompanyRole {
  id        String    @id @default(uuid()) @map("id")
  userId    String    @map("user_id") // FK to User — added in E1-4
  companyId String?   @map("company_id")
  role      UserRole  @map("role")

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  company   CompanyProfile? @relation(fields: [companyId], references: [id])
  // user   User @relation(fields: [userId], references: [id]) — TODO: E1-4

  @@unique([userId, companyId], map: "uq_user_company_role")
  // NOTE: Partial index for global role uniqueness added via raw SQL in migration
  @@map("user_company_roles")
}
```

### getVisibleCompanyIds Implementation Reference

From Project Context §1 — use this exact logic:

```typescript
async function getVisibleCompanyIds(
  prisma: PrismaClient,
  companyId: string,
  entityType: string,
): Promise<string[]> {
  const rules = await prisma.registerSharingRule.findMany({
    where: {
      OR: [
        { sourceCompanyId: companyId, entityType },
        { targetCompanyId: companyId, entityType },
        { sharingMode: 'ALL_COMPANIES', entityType },
      ],
    },
  });

  const ids = new Set([companyId]);
  for (const rule of rules) {
    if (rule.sharingMode === 'ALL_COMPANIES') {
      const allCompanies = await prisma.companyProfile.findMany({
        select: { id: true },
      });
      allCompanies.forEach(c => ids.add(c.id));
    } else {
      ids.add(rule.sourceCompanyId);
      if (rule.targetCompanyId) ids.add(rule.targetCompanyId);
    }
  }
  return Array.from(ids);
}
```

### resolveUserRole Implementation Reference

From Project Context §2 — use this resolution order:

```typescript
async function resolveUserRole(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<UserRole | null> {
  // 1. Check for company-specific role
  const companyRole = await prisma.userCompanyRole.findUnique({
    where: {
      userId_companyId: { userId, companyId },
    },
  });
  if (companyRole) return companyRole.role;

  // 2. Fall back to global role (companyId = null)
  const globalRole = await prisma.userCompanyRole.findFirst({
    where: { userId, companyId: null },
  });
  if (globalRole) return globalRole.role;

  // 3. No access
  return null;
}
```

### Source References

- [Source: _bmad-output/planning-artifacts/project-context.md#1 Multi-Company Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#2 RBAC: Global Role + Per-Company Exceptions]
- [Source: _bmad-output/planning-artifacts/epics/epic-e1-database-core-models.md#Story E1.S3]
- [Source: _bmad-output/planning-artifacts/architecture.md — §2.3 Schema Design Principles]
- [Source: _bmad-output/planning-artifacts/data-models.md — §3.1 System Module, §4.1 Enums]
- [Source: _bmad-output/planning-artifacts/api-contracts.md — §1 RBAC Roles]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md — §14 IMP-007]
- [Source: _bmad-output/planning-artifacts/state-machine-reference.md — N/A]
- [Source: _bmad-output/planning-artifacts/event-catalog.md — N/A]
- [Source: _bmad-output/implementation-artifacts/stories/e1-2-system-module-models.md — Code Review Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- All 10 tasks completed: SharingMode, UserRole, ViewScope enums; RegisterSharingRule and UserCompanyRole models; getVisibleCompanyIds and resolveUserRole utilities; unit/integration tests; exports; migration applied
- Partial unique index `uq_user_company_role_global` added via raw SQL in migration for nullable companyId uniqueness
- Code review completed (3 iterations) — 3 HIGH, 5 MEDIUM, 4 LOW issues documented for human review (see Code Review Notes section below)
- Tests pass via `pnpm --filter @nexa/db test`
- No User relation added (deferred to E1-4 per story design)

### File List

- `packages/db/prisma/schema.prisma` — Added SharingMode, UserRole, ViewScope enums; RegisterSharingRule, UserCompanyRole models; inverse relations on CompanyProfile
- `packages/db/prisma/migrations/*_add_multi_company_models/migration.sql` — Incremental migration with partial unique index
- `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds utility
- `packages/db/src/utils/rbac.ts` — resolveUserRole utility
- `packages/db/src/utils/__tests__/sharing.test.ts` — Sharing utility tests
- `packages/db/src/utils/__tests__/rbac.test.ts` — RBAC utility tests
- `packages/db/src/index.ts` — Updated exports (types, enums, functions)
- `packages/db/vitest.config.ts` — Vitest configuration
- `packages/db/tsconfig.json` — Updated for generated types
- `packages/db/package.json` — Build script updated


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-18 17:29

### Remaining Issues for Human Review:

- 1. **ISSUE #1: [HIGH] ViewScope enum values in story contradict spec and implementation.** The story Task 4.1 specifies `OWN, DEPARTMENT, COMPANY` but the Data Models §4.1 spec and Architecture spec both define `PERSONAL, ROLE, GLOBAL`. The implementation correctly follows the spec (`PERSONAL, ROLE, GLOBAL`), meaning the **story itself has incorrect acceptance criteria**. If someone later validates the code against the story text, they would flag a false discrepancy. The story document needs correction.
- 2. **ISSUE #2: [HIGH] `getVisibleCompanyIds` query deviates from the spec reference implementation.** The story's reference implementation (Project Context §1) queries with a 3-clause `OR` without a `sharingMode: { not: "NONE" }` filter. The implementation at `packages/db/src/utils/sharing.ts:20` adds `sharingMode: { not: "NONE" }` as an extra top-level filter. While arguably a defensible optimization (NONE rules should be excluded), it changes the query semantics — specifically, a `NONE` rule where the caller is the `targetCompanyId` would now never be returned, whereas the reference implementation would return it but skip it in the `else` branch (adding source/target but with no `ALL_COMPANIES` expansion). The net result is the same for correctness, **but the code deviates from the spec-mandated "exact query pattern" without documenting why**. If the spec is the source of truth, this is a spec compliance violation.
- 3. **ISSUE #3: [HIGH] `getVisibleCompanyIds` has no index on `sharingMode` for the `ALL_COMPANIES` OR clause.** The query at `sharing.ts:24` includes `{ sharingMode: "ALL_COMPANIES", entityType }` — this clause searches across ALL RegisterSharingRule rows matching that enum+entity regardless of company. The migration adds indexes on `(source_company_id, entity_type)` and `(target_company_id, entity_type)` but **no index covers the `sharingMode` + `entityType` pair**. As the table grows, this third OR clause will force a sequential scan. This is a performance issue that should be addressed now or explicitly documented as a known gap.
- 4. **ISSUE #4: [MEDIUM] `tsconfig.json` rootDir change from `./src` to `.` broadens compilation scope.** The diff changes `rootDir` from `"./src"` to `"."` and adds `"generated"` to `include`. This means TypeScript now considers the entire package directory as the root, which affects output directory structure (`dist/` will contain `src/` and `generated/` subdirectories rather than flattening `src/` contents). This changes the import paths consumers would need to use and could break downstream packages that import from `@nexa/db`. This is a structural concern that may cause issues in subsequent epics.
- 5. **ISSUE #5: [MEDIUM] Tests run against shared database with no transaction isolation or schema isolation.** Both test files (`sharing.test.ts`, `rbac.test.ts`) create and delete real data in the main database using `DIRECT_URL`. There is no test schema, no `@prisma/client/runtime` transaction wrapper, and no database reset between test suites. If the test database has seed data (which it should from E1-2), the `ALL_COMPANIES` test at `sharing.test.ts:109-114` fetches **all** `companyProfile` rows — including seed data — and expects the result to match. This means the test will **fail or give false positives** depending on what seed data exists. The assertion `expect(result.sort()).toEqual(expectedIds)` only works if the test controls the entire company set, which it does not.
- 6. **ISSUE #6: [MEDIUM] `package.json` `build` script chains `prisma generate && tsc`.** This means every `build` invocation regenerates the Prisma client, even when the schema hasn't changed. In a monorepo with `turbo`, this breaks caching — `turbo` hashes inputs and caches outputs, but `prisma generate` always writes to `generated/` regardless of whether anything changed. The `turbo.json` change adds `generated/**` to outputs, but since `prisma generate` always recreates files (with new timestamps), turbo will never hit the cache for the `build` task of `@nexa/db`.
- 7. **ISSUE #7: [MEDIUM] Migration FK `ON DELETE SET NULL` for `register_sharing_rules.target_company_id_fkey` is inconsistent.** At `migration.sql:60`, the target company FK uses `ON DELETE SET NULL`, meaning if a company is deleted, sharing rules pointing to it will have `targetCompanyId` silently nullified. This converts a `SELECTED` rule into an orphaned rule with no target — semantically broken data. The `sourceCompanyId` FK uses `ON DELETE RESTRICT` (correct), but the target should also use `RESTRICT` to prevent data corruption. Similarly, `user_company_roles.company_id_fkey` uses `ON DELETE SET NULL` at line 63, which would silently convert a company-specific role into a global role if the company is deleted — a severe data integrity risk.
- 8. **ISSUE #8: [MEDIUM] `vitest` globals mode configured but no `/// <reference types="vitest/globals" />` in test files.** The `vitest.config.ts` sets `globals: true` and `tsconfig.json` adds `"types": ["vitest/globals"]`, but the test files import nothing from vitest — they rely on globals (`describe`, `it`, `expect`, `beforeAll`, etc.). While this works at runtime with vitest, **the TypeScript compilation may fail** because `vitest/globals` types are in `devDependencies` and the `tsconfig.json` `types` array may not be resolved correctly when consumed as a workspace package. Worth verifying the `typecheck` script passes.
- 9. **ISSUE #9: [LOW] No `@@map("view_scope")` on ViewScope enum in the spec.** The Data Models §4.1 enum reference table shows `(none)` in the `@@map` column for ViewScope, yet the implementation adds `@@map("view_scope")`. This is arguably correct (all other enums in the schema use `@@map`), but it's technically a spec deviation. Minor, but the spec should be updated or the implementation should follow the spec exactly.
- 10. **ISSUE #10: [LOW] `cleanup()` in tests deletes by tracked IDs only — crashes or early failures will leak data.** If a test throws before pushing an ID to `companyIds` or `ruleIds` (e.g., the `create` call itself fails with an unexpected error), the cleanup function won't know about that row. Over time, repeated test runs will accumulate orphaned test data in the shared database. A safer approach would be to use a naming convention and delete by name pattern, or use database transactions that roll back.
- 11. **ISSUE #11: [LOW] Story template `{{agent_model_name_version}}` placeholder not filled in.** At the bottom of the story file (`e1-3-multi-company-models.md:326`), the Dev Agent Record still shows `{{agent_model_name_version}}` — it was never populated. This is a process/documentation gap, not a code issue, but it suggests the story completion workflow wasn't fully followed.
- 12. **ISSUE #12: [LOW] `pnpm.onlyBuiltDependencies` added to root `package.json` without explanation.** The root `package.json` diff adds `@prisma/engines`, `esbuild`, and `prisma` to `pnpm.onlyBuiltDependencies`. While this is likely needed to avoid build warnings, it's a monorepo-wide change that affects all packages, not just `@nexa/db`. This should be documented or at minimum noted in the commit message.
- **3 HIGH, 5 MEDIUM, 4 LOW** issues found.

---


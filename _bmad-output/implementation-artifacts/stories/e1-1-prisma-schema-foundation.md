# Story 1.1: Prisma Schema Foundation

Status: done

## Story

As a developer,
I want the ERP Prisma schema initialised with base configuration and migration tooling,
so that I can define and evolve database models with versioned migrations.

## Acceptance Criteria

1. GIVEN `packages/db/prisma/schema.prisma` WHEN I run `npx prisma generate` THEN it produces a typed PrismaClient in `packages/db/generated/prisma/` with no errors
2. GIVEN the Prisma schema WHEN I run `npx prisma migrate dev` against the ERP PostgreSQL container THEN the migration creates all tables in the `nexa_erp_dev` database
3. GIVEN the schema uses snake_case table mapping WHEN I inspect PostgreSQL THEN all table names use snake_case via `@@map()` and all column names use snake_case via `@map()`
4. GIVEN the schema WHEN I review the datasource THEN it connects via `DATABASE_URL` environment variable pointing to PgBouncer or direct PostgreSQL
5. GIVEN seed scripts WHEN I run `npx prisma db seed` THEN reference data (currencies, countries, default company) is populated
6. GIVEN `packages/db/src/index.ts` WHEN imported by other workspace packages THEN it re-exports PrismaClient class, generated types, and the `@prisma/adapter-pg` adapter setup

## Tasks / Subtasks

- [x] Task 1: Install Prisma 7.x dependencies (AC: #1, #4)
  - [x] 1.1 Add `prisma` (devDep), `@prisma/client` (dep), `@prisma/adapter-pg` (dep) to `packages/db/package.json`
  - [x] 1.2 Add `tsx` (devDep) for seed script execution
  - [x] 1.3 Add `vitest` (devDep) for future integration tests
  - [x] 1.4 Run `pnpm install` from root
- [x] Task 2: Initialize Prisma 7 schema and config (AC: #1, #4)
  - [x] 2.1 Create `packages/db/prisma/schema.prisma` with Prisma 7 generator (`provider = "prisma-client"`, `output = "../generated/prisma"`)
  - [x] 2.2 Configure datasource: `provider = "postgresql"` (no url in schema — Prisma 7 uses `prisma.config.ts`)
  - [x] 2.3 Create `packages/db/prisma.config.ts` with `defineConfig()` specifying schema path, migrations dir, seed command (`tsx prisma/seed.ts`), and `datasource.url` from `env("DATABASE_URL")`
  - [x] 2.4 Add `DATABASE_URL` to `.env.example` and `.env` pointing to PgBouncer: `postgresql://nexa:nexa_dev_pass@localhost:6432/nexa_erp_dev`
  - [x] 2.5 Add `DIRECT_URL` for migrations (bypasses PgBouncer): `postgresql://nexa:nexa_dev_pass@localhost:5432/nexa_erp_dev`
- [x] Task 3: Define base Prisma schema conventions (AC: #3)
  - [x] 3.1 Define `Company` model with UUID PK: `id String @id @default(uuid())`
  - [x] 3.2 Apply `@@map("companies")` on model, `@map("snake_case")` on every field
  - [x] 3.3 Add `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")` patterns
  - [x] 3.4 Add `createdBy String @map("created_by")` and `updatedBy String @map("updated_by")` patterns
  - [x] 3.5 Use `Decimal @db.Decimal(19, 4)` for any monetary fields (none in base Company but establish pattern)
  - [x] 3.6 Define `Currency` model with natural key: `code String @id @db.VarChar(3)` (NOT UUID)
  - [x] 3.7 Define `Country` model with natural key: `code String @id @db.VarChar(2)` (ISO 3166-1 alpha-2)
- [x] Task 4: Create initial migration (AC: #2)
  - [x] 4.1 Run `npx prisma migrate dev --name init` using DIRECT_URL (bypassing PgBouncer for DDL)
  - [x] 4.2 Verify migration files created in `packages/db/prisma/migrations/`
  - [x] 4.3 Verify tables exist in PostgreSQL with correct snake_case names
- [x] Task 5: Create seed script framework (AC: #5)
  - [x] 5.1 Create `packages/db/prisma/seed.ts` using upsert pattern (idempotent)
  - [x] 5.2 Seed ISO 4217 currencies: GBP (£, 2 decimals), EUR (€, 2), USD ($, 2) minimum — use `upsert` on `code`
  - [x] 5.3 Seed UK country record: `{ code: "GB", name: "United Kingdom", ... }`
  - [x] 5.4 Seed default Company: `{ name: "Default Company", baseCurrencyCode: "GBP", countryCode: "GB", isDefault: true }`
  - [x] 5.5 Verify seed runs: `npx prisma db seed`
- [x] Task 6: Export PrismaClient and types (AC: #1, #6)
  - [x] 6.1 Create `packages/db/src/client.ts` — instantiates PrismaClient with `@prisma/adapter-pg` adapter
  - [x] 6.2 Update `packages/db/src/index.ts` — re-export PrismaClient, all generated types, and the client helper
  - [x] 6.3 Add `"prisma:generate"` script to `packages/db/package.json`: `"prisma generate"`
  - [x] 6.4 Add `"prisma:migrate"` script: `"prisma migrate dev"`
  - [x] 6.5 Add `"prisma:seed"` script: `"prisma db seed"`
  - [x] 6.6 Update `packages/db/package.json` `"build"` script to run `prisma generate` before `tsc`
  - [x] 6.7 Add `generated/` to `packages/db/.gitignore` (generated code should not be committed)
  - [x] 6.8 Verify `turbo build` from root completes with packages/db generating client first

## Dev Notes

### CRITICAL: Prisma 7 Breaking Changes (vs Architecture Doc)

The Architecture doc references Prisma patterns that predate Prisma 7. These are the differences the dev MUST follow:

| Architecture Doc Says | Prisma 7 Reality | What To Do |
|---|---|---|
| `provider = "prisma-client-js"` | DEPRECATED — use `provider = "prisma-client"` | Use new provider |
| URL in schema datasource block | URL now in `prisma.config.ts` via `defineConfig()` | Create config file |
| Import from `@prisma/client` | Import from `./generated/prisma/client` (local output) | Use `output = "../generated/prisma"` in generator |
| `new PrismaClient({ datasources: { db: { url } } })` | Requires `@prisma/adapter-pg` driver adapter | `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` |
| Auto-seed on `migrate dev` | Seeding NO LONGER automatic in Prisma 7 | Must run `npx prisma db seed` explicitly |
| `--skip-generate` flag | REMOVED in Prisma 7 | Run `prisma generate` manually when needed |

### Prisma 7 Generator Block (exact syntax)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### Prisma 7 Config File (exact syntax)

```typescript
// packages/db/prisma.config.ts
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### Prisma 7 Client Instantiation (exact syntax)

```typescript
// packages/db/src/client.ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
export { PrismaClient };
```

### Node.js Version Warning

`.nvmrc` declares Node 22 but the dev machine runs Node 20. Prisma 7 supports both. Run `nvm use` before starting to ensure consistency. If Node 22 is not installed, `nvm install 22` first.

### Database Containers (from E0-3)

Docker Compose services are already configured:
- **erp-db**: PostgreSQL 17, port 5432, `nexa_erp_dev` database
- **platform-db**: PostgreSQL 17, port 5433, `nexa_platform_dev` database (not used in this story)
- **pgbouncer**: Port 6432, transaction-mode pooling to erp-db
- **redis**: Port 6379

Start with: `docker compose up -d`

Use `DIRECT_URL` (port 5432, direct PG) for `prisma migrate dev` — PgBouncer transaction mode breaks DDL. Use `DATABASE_URL` (port 6432, PgBouncer) for runtime queries.

### Schema Design Conventions (MANDATORY)

From Architecture §2.3:
- **companyId on every table**: `companyId String @map("company_id")` FK to Company. Every query MUST scope by companyId. (Exception: Currency and Country use natural keys and are tenant-wide, not company-scoped)
- **UUID PKs**: `id String @id @default(uuid())` on all models (except Currency/Country which use natural keys)
- **snake_case mapping**: `@@map("table_name")` on model, `@map("column_name")` on every field
- **Timestamps**: `createdAt DateTime @default(now()) @map("created_at")` + `updatedAt DateTime @updatedAt @map("updated_at")`
- **isActive on reference entities**: `isActive Boolean @default(true) @map("is_active")`
- **Decimal(19,4)** for monetary, **Decimal(18,8)** for exchange rates, **Decimal(10,4)** for quantities
- **Typed fields over JSON**: Only use JSON for truly custom/extensible attributes
- **Foreign keys everywhere**: All relationships enforced at DB level

### Index Naming Convention

`@@index([field1, field2], map: "idx_{table_name}_{field1}_{field2}")`

Example: `@@index([companyId, isActive], map: "idx_currencies_company_active")`

### Minimal Models for This Story

This story creates ONLY enough models to validate the schema tooling. Do NOT create all System module models — that's E1.2. The minimum models are:

1. **Company** — minimal version: id, name, baseCurrencyCode, countryCode, isDefault, isActive, createdAt, updatedAt
2. **Currency** — natural key code: code (PK), name, symbol, minorUnit, isActive, createdAt, updatedAt
3. **Country** — natural key code: code (PK), name, isActive, createdAt, updatedAt

These 3 models are enough to validate: UUID generation, natural keys, snake_case mapping, `@@map`, `@map`, timestamps, `isActive`, FK relationships, and seed scripts.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: All queries must include `WHERE companyId = ?` (see RegisterSharingRule for shared entities)
- **i18n**: All user-facing labels must use translation keys (see i18n infrastructure) — N/A for this story (no UI)
- **Audit**: All state-changing operations must emit typed events via event bus — N/A for this story (schema only)
- **Attachments/Notes/Tasks**: Consider if this entity needs cross-cutting record support — N/A for this story

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.1 Monetary Representation, §2.2 Database-per-Tenant, §2.3 Schema Design Principles, §2.3.1 Active/Inactive Pattern | DECIMAL(19,4), UUID PKs, snake_case mapping, companyId on every table, isActive on reference entities |
| **Architecture** | §Implementation Patterns | Naming: PascalCase models, camelCase fields, UPPER_SNAKE_CASE enums, snake_case DB columns |
| **Architecture** | §Project Structure | `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`, `packages/db/src/client.ts` |
| **API Contracts** | §1 Data Conventions | Decimal as string in API, ISO dates, UUID IDs |
| **State Machine** | N/A | No stateful entities in this story |
| **Event Catalog** | N/A | No events in this story |
| **Data Models** | Not yet created | This story creates the foundation — later stories populate it |
| **Business Rules** | §14 IMP-001 (DB per tenant), IMP-002 (Decimal 19,4) | Database-per-tenant architecture, fixed-point decimal for monetary |
| **Project Context** | §1 Multi-Company Architecture | companyId on EVERY table from Day 1, RegisterSharingRule for shared entities |

### Project Structure Notes

Files to create/modify:
```
packages/db/
├── prisma/
│   ├── schema.prisma          # NEW: Prisma schema with generator, datasource, base models
│   ├── migrations/            # NEW: Auto-generated by prisma migrate dev
│   └── seed.ts                # NEW: Seed script for currencies, countries, default company
├── generated/
│   └── prisma/                # NEW: Auto-generated PrismaClient (gitignored)
├── src/
│   ├── index.ts               # MODIFY: Re-export PrismaClient and types
│   └── client.ts              # NEW: PrismaClient instantiation with adapter
├── prisma.config.ts           # NEW: Prisma 7 configuration
├── .gitignore                 # NEW: Ignore generated/ directory
├── package.json               # MODIFY: Add prisma, @prisma/client, @prisma/adapter-pg deps
└── tsconfig.json              # VERIFY: Ensure it handles generated types
```

Root files:
```
.env.example                   # MODIFY: Add DATABASE_URL and DIRECT_URL
```

### Source References

- [Source: architecture/core-architectural-decisions.md §2.1-§2.3] — Schema design principles
- [Source: architecture/core-architectural-decisions.md §2.8] — Number series (for seed pattern reference)
- [Source: architecture/core-architectural-decisions.md §2.10] — System module foundation entities
- [Source: architecture/implementation-patterns-consistency-rules.md] — Naming conventions, file suffixes
- [Source: architecture/project-structure-boundaries.md] — packages/db structure
- [Source: epics/epic-e1-database-core-models.md §E1.S1] — Story requirements and acceptance criteria
- [Source: business-rules-compendium.md §14 IMP-001, IMP-002] — DB-per-tenant, Decimal(19,4)
- [Source: retrospectives/epic-E0-retro-2026-02-18.md] — E0 tech debt and learnings

### Previous Epic Intelligence (E0)

Key learnings from E0 retrospective that apply:
- **Commit work**: E0-3 and E0-4 changes were initially uncommitted. Commit after each task.
- **Node.js v22 vs v20**: `.nvmrc` declares v22 but dev runs v20. Verify `nvm use` before starting.
- **CI pipeline**: CI was consolidated in the retro fix (ci.yml calls ci-reusable.yml). E1 may need migration steps added to CI.
- **PgBouncer is configured**: Transaction-mode pooling on port 6432. Use DIRECT_URL (5432) for DDL/migrations.
- **turbo.json lint no longer has dependsOn chain**: Fixed in retro — lint tasks run in parallel now.
- **tsconfig fixed**: platform-client and ai-tools now extend base.json correctly.

### Anti-Patterns to Avoid

- Do NOT use `provider = "prisma-client-js"` — that's Prisma 6. Use `"prisma-client"` (Prisma 7).
- Do NOT put DATABASE_URL in schema.prisma datasource block — use `prisma.config.ts`.
- Do NOT import PrismaClient from `@prisma/client` — import from `../generated/prisma/client`.
- Do NOT use `new PrismaClient({ datasources: { db: { url } } })` — use adapter pattern with `@prisma/adapter-pg`.
- Do NOT use `number` type for monetary values — always use Prisma `Decimal`.
- Do NOT create ALL System module models — only Company, Currency, Country for this story.
- Do NOT delete reference entities — use `isActive: false` instead.
- Do NOT hardcode strings — use translation keys (though no UI in this story).
- Do NOT run `prisma migrate dev` through PgBouncer — use DIRECT_URL for DDL.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- All 6 tasks (28 subtasks) completed successfully
- Prisma 7.x schema initialized with `prisma-client` provider and `prisma.config.ts`
- Base models created: Company, Currency, Country with correct snake_case mapping, UUID/natural key PKs, timestamps, and isActive patterns
- Initial migration generated and applied to PostgreSQL via DIRECT_URL
- Seed script created with idempotent upsert pattern for GBP/EUR/USD currencies, GB country, and default company
- PrismaClient exported via `@prisma/adapter-pg` driver adapter pattern
- Workspace package exports configured in `packages/db/src/index.ts`
- Code review completed (3 iterations) — 14 issues documented (3 HIGH, 7 MEDIUM, 4 LOW) for human review

### File List

- `packages/db/prisma/schema.prisma` — Prisma 7 schema with Company, Currency, Country models
- `packages/db/prisma.config.ts` — Prisma 7 defineConfig with datasource, migrations, seed
- `packages/db/prisma/seed.ts` — Seed script for reference data
- `packages/db/prisma/migrations/` — Auto-generated migration files
- `packages/db/src/client.ts` — PrismaClient instantiation with PrismaPg adapter
- `packages/db/src/index.ts` — Re-exports PrismaClient, types, and client helper
- `packages/db/package.json` — Updated with prisma deps and scripts
- `packages/db/tsconfig.json` — Verified for generated types
- `packages/db/.gitignore` — Ignores generated/ directory
- `.env.example` — Updated with DATABASE_URL and DIRECT_URL


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-18 14:38

### Remaining Issues for Human Review:

- 1. **ISSUE #1 [HIGH]: Table name mismatch — `companies` vs `company_profiles`**
- 2. **ISSUE #2 [HIGH]: Exchange rate decimal precision inconsistency in schema comment**
- 3. **ISSUE #3 [HIGH]: `createdBy`/`updatedBy` on Company but data-models spec says audit fields only on transactional entities**
- 4. **ISSUE #4 [MEDIUM]: Company model vastly exceeds "minimal" scope defined in story**
- 5. **ISSUE #5 [MEDIUM]: `prisma.config.ts` uses `env("DIRECT_URL") || env("DATABASE_URL")` — `env()` throws, does not return falsy**
- 6. **ISSUE #6 [MEDIUM]: `src/client.ts` exports `PrismaPg` — leaking adapter internals**
- 7. **ISSUE #7 [MEDIUM]: `src/index.ts` only exports three model types — fragile and incomplete**
- 8. **ISSUE #8 [MEDIUM]: No `@unique` constraint ensuring only one `isDefault: true` Company**
- 9. **ISSUE #9 [MEDIUM]: Currency `symbol` field semantics are wrong in seed data context**
- 10. **ISSUE #10 [MEDIUM]: `tsconfig.json` includes `generated` in compilation but `rootDir` is `.`**
- 11. **ISSUE #11 [LOW]: Seed script creates a hardcoded UUID `00000000-0000-4000-a000-000000000001` for default company**
- 12. **ISSUE #12 [LOW]: `.env.example` uses `user:password` as placeholder credentials but story specifies `nexa:nexa_dev_pass`**
- 13. **ISSUE #13 [LOW]: No `vatPrefix` in Country seed for other countries, and only one country seeded**
- 14. **ISSUE #14 [LOW]: `pnpm.onlyBuiltDependencies` added to root `package.json` without explanation**
- **3 HIGH, 7 MEDIUM, 4 LOW** issues found.

---


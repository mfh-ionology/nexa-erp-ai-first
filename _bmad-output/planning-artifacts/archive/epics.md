# Nexa ERP — Epic & Story Outline

> Comprehensive breakdown of all implementation epics (E0–E27+) with detailed story outlines.
> Each story references all 8 planning specification documents per the **8-Document Rule** (CLAUDE.md).
> Before starting any Epic, the **Epic Page Approval Gate** must be completed — page inventory, initial design, and Mohammed's approval.

## Document References

All stories reference these 8 specification documents:

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 1 | **PRD** | `planning-artifacts/prd.md` | Functional & non-functional requirements (222 FRs, 51 NFRs) |
| 2 | **Architecture** | `planning-artifacts/architecture.md` | Prisma models, module designs, AI infrastructure, project structure |
| 3 | **UX Design Specification** | `planning-artifacts/ux-design-specification.md` | Screen templates T1–T8, ActionBar, Co-Pilot Dock, design system |
| 4 | **API Contracts** | `planning-artifacts/api-contracts.md` | REST endpoints, request/response schemas, FR mapping (400+ endpoints) |
| 5 | **Data Models** | `planning-artifacts/data-models.md` | Prisma schema details, 254 models, 175 enums, relationships |
| 6 | **Event Catalog** | `planning-artifacts/event-catalog.md` | 87 business events, payload schemas, cross-module flows |
| 7 | **State Machine Reference** | `planning-artifacts/state-machine-reference.md` | 44 entity lifecycles, transitions, guards, side effects |
| 8 | **Business Rules Compendium** | `planning-artifacts/business-rules-compendium.md` | 363 rules (190 explicit + 173 implicit/cross-module) |

Supporting documents: **Project Context** (`planning-artifacts/project-context.md`) — cross-cutting architectural decisions.

## Cross-Cutting Patterns (Apply to ALL Stories)

Every implementation story MUST follow these patterns from `project-context.md`:

| Pattern | Requirement |
|---------|-------------|
| **companyId** | Every ERP model has `companyId`; every query scopes by `companyId` (check `RegisterSharingRule` for shared entities) |
| **i18n** | All user-facing strings use translation keys via `t('key')` — even in MVP (English-only) |
| **Audit** | All state-changing operations emit typed events via the event bus |
| **Platform** | AI calls go through AI Gateway; module access checked via Platform Client SDK |
| **Attachments/Notes/Tasks** | Consider if each entity needs cross-cutting record support |
| **Mobile** | Each business epic ends with a Mobile Adaptation story |

## Story Template

Each story uses this structure:
- **User Story:** As a {role}, I want {action}, so that {benefit}
- **Acceptance Criteria:** BDD format (GIVEN/WHEN/THEN)
- **Key Tasks:** Implementation checklist with AC traceability
- **FR/NFR Coverage:** Specific requirement IDs
- **Reference Documents:** Section references from all 8 docs

---

## Epic Overview

### Tier 0: Foundation (No UX Required)
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E0 | Monorepo + DevOps | — | Infrastructure only |
| E1 | Database + Core Models | E0 | FR80, FR84, FR171–FR177; Platform: FR193–FR197 |
| E2 | API Server + Auth + Multi-Company RBAC | E1 | FR80–FR83, FR178–FR180 |
| E3 | Event Bus + Audit Trail | E2 | FR88 |
| E3b | Platform API + AI Gateway | E1 | FR198–FR207 |

### Tier 1: Core Platform
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E4 | i18n Infrastructure | E2 | FR181–FR184 |
| E5 | AI Orchestration | E3b, E4 | FR1–FR10, FR153–FR163 |
| E6 | Web Frontend Shell + Mobile Scaffold | E2, E4 | UX infrastructure |
| E7 | Saved Views / Filters / Columns | E6 | FR86 |
| E8 | Attachments + Notes + Record Links | E6 | FR85, FR87 |
| E9 | Notifications | E3, E6 | FR185–FR187 |
| E10 | Email Integration | E9 | FR188–FR189 |
| E11 | Cross-cutting Tasks | E6 | FR190–FR192 |
| E12 | Document Templates & PDF | E6 | FR79, FR85 |
| E13 | Printer Management | E12 | FR192 |
| E13b | Platform Admin Portal | E3b, E6 | FR208–FR222 |

### Tier 2: First Business Module
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E14 | Finance / NL (GL) | E3, E4, E6, E8 | FR11–FR18 |

### Tier 3: Business Modules (each ends with Mobile Adaptation story)
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E15 | Inventory | E14 | FR46–FR53 |
| E16 | Sales Orders | E14, E15 | FR33–FR40 |
| E17 | Sales Ledger / AR | E14 | FR19–FR25 |
| E18 | Purchase Orders | E14, E15 | FR41–FR45 |
| E19 | Purchase Ledger / AP | E14, E18 | FR26–FR32 |
| E20 | Document Understanding | E5, E19 | FR164–FR170 |
| E21 | CRM | E14, E17 | FR54–FR60, FR95–FR100 |
| E22 | Fixed Assets | E14 | FR89–FR94 |
| E23 | HR / Payroll | E14 | FR61–FR67, FR101–FR108 |
| E24 | Manufacturing / MRP | E14, E15 | FR68–FR73, FR109–FR114 |
| E25 | Reporting Engine | E14+ | FR74–FR79 |

### Phase 2+ Modules
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E26a | Warehouse Management | E15 | FR135–FR140 |
| E26b | POS | E14, E15, E17 | FR116–FR122 |
| E26c | Projects & Job Costing | E14, E17 | FR123–FR129 |
| E26d | Contracts & Agreements | E14, E17 | FR130–FR134 |
| E26e | Service Orders & Timekeeper | E14, E15 | FR149–FR152 |
| E26f | Intercompany & Consolidation | E14 | FR141–FR144 |
| E26g | Communications (Chat & Conference) | E9, E10 | FR145–FR148 |
| E27+ | Platform Admin Phase 2 | E13b | Auto-provisioning, Stripe, GDPR |

---

<!-- TIER 0 BEGINS -->
# Tier 0: Foundation

> **Scope:** Infrastructure, database schemas, authentication, event bus, audit trail, platform API, and AI gateway. No business modules. No frontend UI. These epics establish the technical foundation on which all subsequent tiers depend.

---

## Epic E0: Monorepo + DevOps

**Tier:** 0 | **Dependencies:** None | **Type:** Infrastructure only (no FRs)
**NFRs:** NFR1 (API <500ms), NFR2 (AI <3s), NFR40-NFR45 (security & maintainability)

---

### Story E0.S1: Initialize Monorepo Structure

**User Story:** As a developer, I want a properly configured pnpm + Turborepo monorepo with standard directory structure, so that all future packages and applications have a consistent foundation.

**Acceptance Criteria:**
1. GIVEN the repository root WHEN I run `pnpm install` THEN all workspace packages resolve correctly with zero peer dependency warnings for internal packages
2. GIVEN the monorepo structure WHEN I inspect the directory layout THEN apps/api, apps/web, apps/mobile, apps/platform-api, apps/platform-admin, packages/db, packages/shared, packages/api-client, packages/ai-tools, packages/platform-client, and packages/config directories all exist with valid package.json files
3. GIVEN a shared TypeScript configuration WHEN any package compiles THEN it inherits from the root tsconfig.base.json with strict mode enabled (NFR41)
4. GIVEN the turbo.json pipeline configuration WHEN I run `turbo build` THEN the dependency graph executes in correct topological order (packages before apps)
5. GIVEN the pnpm-workspace.yaml WHEN a new package is added to packages/ or apps/ THEN it is automatically included in the workspace

**Key Tasks:**
- [ ] Initialize Turborepo monorepo with pnpm workspaces (AC: #1)
  - [ ] Run `npx create-turbo@latest` with pnpm package manager
  - [ ] Configure pnpm-workspace.yaml with apps/* and packages/* globs
- [ ] Create directory structure per Architecture §Monorepo Structure (AC: #2)
  - [ ] Create apps/api, apps/web, apps/mobile, apps/platform-api, apps/platform-admin
  - [ ] Create packages/db, packages/shared, packages/api-client, packages/ai-tools, packages/platform-client, packages/config
  - [ ] Add stub package.json to each workspace
- [ ] Configure shared TypeScript configuration (AC: #3)
  - [ ] Create root tsconfig.base.json with strict mode, path aliases
  - [ ] Create per-package tsconfig.json extending base
- [ ] Configure turbo.json build pipeline (AC: #4)
  - [ ] Define build, lint, test, typecheck tasks with dependency topology
  - [ ] Enable remote caching configuration (disabled by default)
- [ ] Add root-level configuration files (AC: #5)
  - [ ] .gitignore, .nvmrc (Node 22 LTS), .npmrc (shamefully-hoist=false)

**FR/NFR:** N/A (infrastructure); NFR41 (TypeScript strict), NFR42 (Claude Opus 4.6)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §Monorepo Structure (line ~229), §Technology Stack Decisions | Turborepo + pnpm, directory layout, package names |
| API Contracts | §1 Overview | Base URL pattern, versioning strategy |
| Data Models | §1 Overview | Two databases pattern (ERP + Platform) |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | N/A | N/A — no business rules in this story |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §9 Epic Build Sequence | E0 scope: Turborepo + pnpm, Docker Compose, shared configs, package stubs |

---

### Story E0.S2: CI/CD Pipeline

**User Story:** As a developer, I want automated CI/CD pipelines running on every push and pull request, so that code quality is enforced before merge and deployments are reliable.

**Acceptance Criteria:**
1. GIVEN a pull request is opened WHEN CI triggers THEN lint, typecheck, unit tests, and build steps all execute and must pass before merge is allowed
2. GIVEN a merge to main WHEN the deploy-staging workflow triggers THEN the staging environment is updated automatically
3. GIVEN branch protection rules WHEN a developer attempts to push directly to main THEN the push is rejected requiring PR review
4. GIVEN a CI run WHEN Turborepo caching is configured THEN unchanged packages are skipped, reducing CI time by at least 40%
5. GIVEN a failed CI step WHEN a developer views the GitHub Actions summary THEN the failure reason is clearly identified with the specific failing test or lint error

**Key Tasks:**
- [ ] Create .github/workflows/ci.yml (AC: #1, #4)
  - [ ] Configure pnpm install with caching
  - [ ] Run turbo lint, turbo typecheck, turbo test, turbo build
  - [ ] Enable Turborepo remote caching in CI
- [ ] Create .github/workflows/deploy-staging.yml (AC: #2)
  - [ ] Trigger on merge to main
  - [ ] Build Docker images and push to registry (stub)
- [ ] Configure branch protection rules (AC: #3)
  - [ ] Require PR reviews, require status checks, disallow force push
- [ ] Configure CI reporting and artefacts (AC: #5)
  - [ ] Upload test coverage reports
  - [ ] Configure structured failure output

**FR/NFR:** N/A (infrastructure); NFR43 (80% test coverage enforcement), NFR44 (versioned migrations)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §Project Structure (.github/workflows/), §Implementation Handoff | ci.yml, deploy-staging.yml, deploy-production.yml |
| API Contracts | N/A | N/A — no endpoints in this story |
| Data Models | N/A | N/A — no models in this story |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 Implicit Rules — IMP-017, IMP-019 | TypeScript strict mode enforcement, 80% test coverage |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 6: Claude Opus 4.6 for all coding, Rule 7: TDD |

---

### Story E0.S3: Docker Compose Dev Environment

**User Story:** As a developer, I want a single `docker compose up` command to start all local infrastructure dependencies, so that I can develop without manual service configuration.

**Acceptance Criteria:**
1. GIVEN docker-compose.yml at the repository root WHEN I run `docker compose up` THEN PostgreSQL (ERP), PostgreSQL (Platform), PgBouncer, and Redis containers all start and become healthy within 30 seconds
2. GIVEN the ERP PostgreSQL container WHEN I connect with the configured credentials THEN the nexa_erp_dev database exists and accepts connections on port 5432
3. GIVEN the Platform PostgreSQL container WHEN I connect with the configured credentials THEN the nexa_platform_dev database exists and accepts connections on port 5433
4. GIVEN PgBouncer is running WHEN the API connects via PgBouncer THEN connections are pooled in transaction mode per Architecture §2.2
5. GIVEN the Redis container WHEN I connect THEN it accepts connections on port 6379 and is ready for caching, sessions, and BullMQ job queues
6. GIVEN a `docker compose down -v` WHEN all containers stop THEN all data volumes are cleaned up for a fresh start

**Key Tasks:**
- [ ] Create docker-compose.yml at repository root (AC: #1)
  - [ ] Define erp-db service (PostgreSQL 17, port 5432)
  - [ ] Define platform-db service (PostgreSQL 17, port 5433)
  - [ ] Define pgbouncer service with transaction-mode pooling
  - [ ] Define redis service (port 6379)
  - [ ] Add healthcheck probes for all services
- [ ] Configure ERP database initialization (AC: #2)
  - [ ] Set POSTGRES_DB=nexa_erp_dev, POSTGRES_USER, POSTGRES_PASSWORD
  - [ ] Mount init script for database creation
- [ ] Configure Platform database initialization (AC: #3)
  - [ ] Set POSTGRES_DB=nexa_platform_dev on separate port
- [ ] Configure PgBouncer (AC: #4)
  - [ ] Transaction-mode pooling, pool_size=20
  - [ ] Map to ERP PostgreSQL backend
- [ ] Configure Redis (AC: #5)
  - [ ] Persistence disabled for dev (appendonly no)
- [ ] Create .env.example with all required environment variables (AC: #1-#5)
  - [ ] Document each variable with comments

**FR/NFR:** N/A (infrastructure); NFR9 (database-per-tenant isolation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.2 Database-per-Tenant, §2.7 Caching Strategy, §Monorepo Structure | PgBouncer transaction-mode, Redis for caching/sessions/jobs, docker-compose.yml |
| API Contracts | N/A | N/A — no endpoints in this story |
| Data Models | §1 Overview | Two databases: ERP (per-tenant) + Platform (central) |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-001 | Database-per-tenant isolation, no tenant_id in ERP tables |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications: ERP (per-tenant PostgreSQL) + Platform (central PostgreSQL) |

---

### Story E0.S4: Code Quality Standards

**User Story:** As a developer, I want automated code quality enforcement via ESLint, Prettier, Husky, and commitlint, so that every commit meets the project's strict TypeScript standards.

**Acceptance Criteria:**
1. GIVEN ESLint configuration WHEN I run `turbo lint` THEN all TypeScript files are checked with strict rules including no-any, no-explicit-any, no-unused-vars, and consistent-type-imports
2. GIVEN Prettier configuration WHEN I run `turbo format` THEN all source files are formatted consistently with single quotes, trailing commas, and 100-char line width
3. GIVEN Husky pre-commit hooks WHEN I attempt to commit code THEN lint-staged runs ESLint and Prettier on staged files, blocking commits with lint errors
4. GIVEN commitlint WHEN I write a commit message THEN it must follow conventional commit format (feat:, fix:, chore:, etc.) or the commit is rejected
5. GIVEN the shared eslint configuration in packages/config WHEN any app or package extends it THEN it inherits all strict TypeScript rules without local overrides

**Key Tasks:**
- [ ] Configure ESLint with strict TypeScript rules (AC: #1, #5)
  - [ ] Create packages/config/eslint-preset.js with @typescript-eslint/strict
  - [ ] Add jsx-a11y plugin for accessibility linting (GAP-1 from Architecture)
  - [ ] Extend from each app/package eslint.config.js
- [ ] Configure Prettier (AC: #2)
  - [ ] Create root .prettierrc with project conventions
  - [ ] Add .prettierignore for generated files (prisma, dist, node_modules)
- [ ] Configure Husky + lint-staged (AC: #3)
  - [ ] Install husky, configure .husky/pre-commit
  - [ ] Configure lint-staged in package.json for *.ts, *.tsx files
- [ ] Configure commitlint (AC: #4)
  - [ ] Install @commitlint/cli, @commitlint/config-conventional
  - [ ] Create commitlint.config.js
  - [ ] Add .husky/commit-msg hook
- [ ] Add npm scripts to root package.json (AC: #1, #2)
  - [ ] lint, lint:fix, format, format:check, typecheck

**FR/NFR:** N/A (infrastructure); NFR41 (TypeScript strict), NFR43 (80% test coverage), NFR45 (OpenAPI docs)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §Implementation Patterns — Enforcement Guidelines, §Anti-Patterns | 13 MUST rules, no `any`, no `console.log`, strict mode |
| API Contracts | N/A | N/A — no endpoints in this story |
| Data Models | N/A | N/A — no models in this story |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-017 | TypeScript strict mode, full-stack type safety |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 6: Claude Opus 4.6, Rule 7: TDD red-green-refactor |

---

## Epic E1: Database + Core Models

**Tier:** 0 | **Dependencies:** E0 | **Type:** Data foundation
**FRs:** FR80 (user management), FR84 (company settings), FR86 (number series), FR171-FR177 (multi-company & company RBAC), FR193-FR197 (platform tenant management)
**Models:** CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting, NumberSeries, User, RegisterSharingRule, UserCompanyRole; Platform: Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession, TenantAiUsage, TenantAiQuota
**Enums:** SharingMode, UserRole, ViewScope, TenantStatus, BillingStatus, EnforcementAction, PlatformRole
**Business Rules:** IMP-001 (DB per tenant), IMP-002 (Decimal 19,4), BR-SYS-011/012 (number series)

---

### Story E1.S1: Prisma Schema Foundation

**User Story:** As a developer, I want the ERP Prisma schema initialised with base configuration and migration tooling, so that I can define and evolve database models with versioned migrations.

**Acceptance Criteria:**
1. GIVEN packages/db/prisma/schema.prisma WHEN I run `prisma generate` THEN it produces a typed PrismaClient with no errors
2. GIVEN the Prisma schema WHEN I run `prisma migrate dev` against the ERP PostgreSQL container THEN the migration creates all tables in the nexa_erp_dev database
3. GIVEN the schema uses snake_case table mapping WHEN I inspect PostgreSQL THEN all table names use snake_case via @@map() and all column names use snake_case via @map()
4. GIVEN the schema WHEN I review the datasource THEN it connects via DATABASE_URL environment variable pointing to PgBouncer or direct PostgreSQL
5. GIVEN seed scripts WHEN I run `prisma db seed` THEN reference data (currencies, countries, default company) is populated

**Key Tasks:**
- [ ] Initialize Prisma in packages/db (AC: #1, #4)
  - [ ] Run `prisma init` with PostgreSQL provider
  - [ ] Configure datasource with DATABASE_URL
  - [ ] Set Prisma 7.x in package.json
- [ ] Create base Prisma schema with UUID and timestamp conventions (AC: #3)
  - [ ] Define id as `@id @default(uuid())`
  - [ ] Define createdAt/updatedAt with @default(now()) and @updatedAt
  - [ ] Apply @@map("snake_case") to all models, @map("snake_case") to all fields
- [ ] Configure migration tooling (AC: #2)
  - [ ] Create initial migration script
  - [ ] Document migration workflow for per-tenant migrations
- [ ] Create seed script framework (AC: #5)
  - [ ] packages/db/prisma/seed.ts with upsert pattern
  - [ ] Seed ISO 4217 currencies (GBP, EUR, USD minimum)
  - [ ] Seed UK country record
- [ ] Export PrismaClient and types from packages/db (AC: #1)
  - [ ] Create packages/db/src/index.ts exporting client and generated types

**FR/NFR:** FR84 (company settings foundation); NFR38 (fixed-point decimal), NFR44 (versioned migrations)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.1 Monetary Representation, §2.2 Database-per-Tenant, §2.3 Schema Design Principles | DECIMAL(19,4), UUID PKs, snake_case mapping, companyId on every table |
| API Contracts | §1 Data Conventions | Decimal as string, ISO dates, UUID IDs |
| Data Models | §1 Overview, §6 Common Patterns | 234 ERP models, UUID PKs, snake_case, audit fields |
| State Machines | N/A | N/A — no stateful entities in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-001, IMP-002 | Database-per-tenant, Decimal(19,4) for monetary |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId on EVERY table from Day 1 |

---

### Story E1.S2: System Module Models

**User Story:** As a developer, I want all System module Prisma models defined and migrated, so that the application has reference data entities for currencies, countries, departments, payment terms, VAT codes, and system settings.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN I review System module models THEN CompanyProfile, Currency (natural key code), ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, and SystemSetting models are all defined with correct field types and relationships
2. GIVEN all reference entities (Currency, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday) WHEN I inspect their schema THEN each has an `isActive Boolean @default(true)` field per the Active/Inactive Pattern (Architecture §2.3.1)
3. GIVEN the CompanyProfile model WHEN I inspect its fields THEN it includes name, legalName, registrationNumber, vatNumber, utrNumber, baseCurrencyCode (FK to Currency), timezone, vatScheme, address fields, contact fields, and branding fields
4. GIVEN the Currency model WHEN I inspect its primary key THEN it uses code (String, 3 chars, ISO 4217) as natural key (not UUID)
5. GIVEN all monetary fields WHEN I inspect their types THEN they use `Decimal @db.Decimal(19,4)` for amounts and `Decimal @db.Decimal(18,8)` for exchange rates
6. GIVEN seed scripts WHEN I run `prisma db seed` THEN ISO 4217 currencies (minimum GBP, EUR, USD), UK country, default VAT codes (20%, 5%, 0%, Exempt, Reverse Charge), and standard UK payment terms (Net 30, Net 60) are created

**Key Tasks:**
- [ ] Define CompanyProfile model (AC: #3)
  - [ ] Fields: name, legalName, registrationNo, vatNumber, utrNumber, baseCurrencyCode, timezone, vatScheme
  - [ ] Address and contact inline fields
  - [ ] FK to Currency via baseCurrencyCode
- [ ] Define Currency model with natural key (AC: #4)
  - [ ] PK: code String(3) — no UUID
  - [ ] Fields: name, symbol, minorUnit, roundTotal, roundVat, roundLine, isActive
- [ ] Define ExchangeRate model (AC: #5)
  - [ ] Fields: currencyCode FK, rateDate, buyRate Decimal(18,8), sellRate Decimal(18,8)
- [ ] Define remaining reference models (AC: #1, #2)
  - [ ] Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting
  - [ ] All with isActive, companyId, createdAt, updatedAt
- [ ] Create seed data (AC: #6)
  - [ ] ISO 4217 currencies, UK countries, 5 VAT codes, payment terms
- [ ] Add indexes per Architecture patterns (AC: #1)
  - [ ] Composite indexes on [companyId, isActive] for reference entities

**FR/NFR:** FR83 (system settings), FR84 (company configuration); NFR38 (fixed-point decimal)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles, §2.3.1 Active/Inactive Pattern, §2.8 Number Series | companyId on every table, isActive on reference entities, Decimal types |
| API Contracts | §2.2 System Module | CRUD for currencies, exchange-rates, countries, departments, payment-terms, vat-codes, tags, bank-holidays, system-settings |
| Data Models | §3.1 System Module (Sections 2.8-2.12) | CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting |
| State Machines | N/A | N/A — reference entities are not stateful (use isActive instead) |
| Event Catalog | §16 System Events | `settings.updated` event (consumed later in E3) |
| Business Rules | §14 IMP-002, IMP-004 | Decimal(19,4) for monetary, single base currency with FX |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId on every table, query scoping |

---

### Story E1.S3: Multi-Company Models

**User Story:** As a developer, I want RegisterSharingRule and UserCompanyRole models defined, so that the system supports per-entity register sharing between companies and per-company role overrides.

**Acceptance Criteria:**
1. GIVEN the RegisterSharingRule model WHEN I inspect it THEN it has entityType, sharingMode (SharingMode enum: NONE, ALL_COMPANIES, SELECTED), sourceCompanyId, and optional targetCompanyId fields with a unique constraint on [entityType, sourceCompanyId, targetCompanyId]
2. GIVEN the UserCompanyRole model WHEN I inspect it THEN it has userId, optional companyId (null = global role), and role (UserRole enum) with a unique constraint on [userId, companyId]
3. GIVEN the SharingMode enum WHEN I inspect it THEN it contains exactly NONE, ALL_COMPANIES, SELECTED values
4. GIVEN the UserRole enum WHEN I inspect it THEN it contains SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER in hierarchy order
5. GIVEN a helper function getVisibleCompanyIds(companyId, entityType) WHEN called THEN it returns the set of companyIds visible based on RegisterSharingRule configuration per Project Context §1

**Key Tasks:**
- [ ] Define SharingMode enum (AC: #3)
  - [ ] NONE, ALL_COMPANIES, SELECTED
- [ ] Define RegisterSharingRule model (AC: #1)
  - [ ] Fields: entityType, sharingMode, sourceCompanyId, targetCompanyId (nullable)
  - [ ] Named relations to Company: SharingSource, SharingTarget
  - [ ] Unique constraint: [entityType, sourceCompanyId, targetCompanyId]
- [ ] Define UserRole enum (AC: #4)
  - [ ] SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER
- [ ] Define UserCompanyRole model (AC: #2)
  - [ ] Fields: userId, companyId (nullable for global), role
  - [ ] Unique constraint: [userId, companyId]
  - [ ] Relations to User and Company
- [ ] Implement getVisibleCompanyIds utility (AC: #5)
  - [ ] In packages/db/src/utils/sharing.ts
  - [ ] Query RegisterSharingRule, compute visible company set
  - [ ] Unit tests for NONE, ALL_COMPANIES, SELECTED modes

**FR/NFR:** FR171-FR174 (multi-company), FR175-FR177 (company RBAC)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles | companyId on every table, RegisterSharingRule pattern |
| API Contracts | §1 RBAC Roles | SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER hierarchy |
| Data Models | §3.1 System Module, §4.1 System Module Enums | RegisterSharingRule, UserCompanyRole, SharingMode, UserRole enums |
| State Machines | N/A | N/A — these are configuration entities, not stateful |
| Event Catalog | N/A | N/A — no events emitted for config changes (audit only) |
| Business Rules | §14 IMP-007 | RBAC with 5 default roles |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture, §2 RBAC: Global Role + Per-Company Exceptions | getVisibleCompanyIds query pattern, role resolution: company-specific then global then no-access |

---

### Story E1.S4: User & Session Models

**User Story:** As a developer, I want User and Session models defined with all authentication-related fields, so that the auth system in E2 has its data foundation.

**Acceptance Criteria:**
1. GIVEN the User model WHEN I inspect it THEN it includes email (unique), passwordHash, firstName, lastName, role, mfaEnabled, mfaSecret (nullable), isActive, lastLoginAt, and standard audit fields
2. GIVEN the User model WHEN I inspect the passwordHash field THEN it is stored as String with no length constraint (Argon2id hashes vary in length)
3. GIVEN the User model WHEN I inspect its relations THEN it relates to UserCompanyRole[], Session[], and has companyId FK (the user's default company)
4. GIVEN a Session or RefreshToken model WHEN I inspect it THEN it includes userId, token (hashed), expiresAt, ipAddress, userAgent, createdAt, and revokedAt (nullable for revocation)
5. GIVEN the User model WHEN I check for enabledModules THEN it has an enabledModules Json field (string array) for per-user module gating

**Key Tasks:**
- [ ] Define User model (AC: #1, #2, #3, #5)
  - [ ] Fields: email, passwordHash, firstName, lastName, mfaEnabled, mfaSecret, isActive, lastLoginAt, enabledModules (Json)
  - [ ] companyId FK to CompanyProfile (default company)
  - [ ] Relations to UserCompanyRole[], RefreshToken[]
  - [ ] Unique constraint on email
- [ ] Define RefreshToken model (AC: #4)
  - [ ] Fields: userId, tokenHash, expiresAt, ipAddress, userAgent, createdAt, revokedAt
  - [ ] Index on tokenHash for fast lookup
  - [ ] Index on [userId, revokedAt] for active session queries
- [ ] Add seed data for initial admin user (AC: #1)
  - [ ] Default SUPER_ADMIN user with known credentials for development
- [ ] Run migration and verify (AC: #1-#5)
  - [ ] `prisma migrate dev --name add-user-session-models`
  - [ ] Verify tables created in PostgreSQL

**FR/NFR:** FR80 (user management); NFR10 (MFA support), NFR13 (Argon2 password hashing)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | Argon2id, JWT, TOTP MFA, session management, 15min access + 7d refresh |
| API Contracts | §2.1 Auth & Session, §3.1 Auth Endpoints | Login/logout/refresh/mfa/password endpoints |
| Data Models | §3.1 System Module | User model fields, relations |
| State Machines | N/A | N/A — user accounts use isActive, not state machine |
| Event Catalog | §16 System Events | `user.login` event payload includes userId, loginMethod, ipAddress |
| Business Rules | §14 IMP-007, IMP-008 | RBAC with 5 roles, MFA support |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | Role resolution: company-specific then global then no-access |

---

### Story E1.S5: Number Series Service

**User Story:** As a developer, I want a number series model and atomic generation service, so that every document type (invoices, POs, SOs, etc.) gets unique, gap-free, sequential reference numbers.

**Acceptance Criteria:**
1. GIVEN the NumberSeries model WHEN I inspect it THEN it includes companyId, entityType (unique per company), prefix, nextValue, padding, suffix (optional), isActive, and optional date-range sub-range fields
2. GIVEN the nextNumber() service function WHEN called concurrently by 10 simultaneous requests for the same entityType THEN all 10 receive unique sequential numbers with no gaps or duplicates
3. GIVEN a NumberSeries with prefix "INV-" and padding 5 WHEN nextNumber('INVOICE') is called THEN it returns "INV-00001", "INV-00002", etc.
4. GIVEN a NumberSeries with date-range sub-ranges WHEN the current date falls within a sub-range THEN the sub-range prefix and counter are used instead of the main series
5. GIVEN seed data WHEN the database is seeded THEN default number series exist for INVOICE, CREDIT_NOTE, PURCHASE_ORDER, SALES_ORDER, JOURNAL_ENTRY, DISPATCH, GOODS_RECEIPT, SUPPLIER_BILL

**Key Tasks:**
- [ ] Define NumberSeries model (AC: #1)
  - [ ] Fields: companyId, entityType, prefix, nextValue, padding, suffix, isActive
  - [ ] Unique constraint: [companyId, entityType]
  - [ ] Optional sub-range fields: validFrom, validTo, subRangePrefix
- [ ] Implement atomic nextNumber() function (AC: #2, #3)
  - [ ] Use UPDATE ... RETURNING with row-level lock for gap-free generation
  - [ ] In packages/db/src/services/number-series.service.ts
  - [ ] Accept companyId and entityType, return formatted string
- [ ] Implement date-range sub-range logic (AC: #4)
  - [ ] Check if current date falls within any sub-range
  - [ ] Use sub-range prefix/counter if applicable
- [ ] Write concurrency tests (AC: #2)
  - [ ] 10 parallel calls must produce unique sequential numbers
  - [ ] Test with Vitest using real database (integration test)
- [ ] Create seed data for default series (AC: #5)
  - [ ] INVOICE (INV-), CREDIT_NOTE (CN-), PURCHASE_ORDER (PO-), SALES_ORDER (SO-), JOURNAL_ENTRY (JE-), DISPATCH (DSP-), GOODS_RECEIPT (GRN-), SUPPLIER_BILL (BILL-)

**FR/NFR:** FR86 (number series configuration); NFR18 (zero data loss — ACID)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.8 Number Series | PostgreSQL function next_number(), gap-free via UPDATE lock, prefix + LPAD |
| API Contracts | §2.2 System Module | CRUD `/system/number-series` endpoint |
| Data Models | §6.2 Number Series Integration | NumberSeries model, entityType pattern |
| State Machines | N/A | N/A — number series is not a stateful entity |
| Event Catalog | N/A | N/A — number generation does not emit events |
| Business Rules | §12 BR-SYS-011, BR-SYS-012 | Atomic generation in DB transaction, date-range sub-ranges with overlap validation |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId scoping — number series are per-company |

---

### Story E1.S6: Platform Database Schema

**User Story:** As a developer, I want the Platform database Prisma schema defined and migrated with all platform-level models, so that tenant management, billing, AI usage tracking, and platform admin operations have their data foundation.

**Acceptance Criteria:**
1. GIVEN the Platform Prisma schema at apps/platform-api/prisma/schema.prisma WHEN I run `prisma generate` THEN it produces a separate PlatformPrismaClient with no conflicts with the ERP PrismaClient
2. GIVEN the Tenant model WHEN I inspect it THEN it includes code (unique slug), displayName, legalName, status (TenantStatus enum), planId FK, billingStatus, region, dbHost, dbName, dbPort, sandboxEnabled, lastActivityAt, and relations to Plan, TenantModuleOverride[], TenantFeatureFlag[], TenantAiQuota, TenantAiUsage[], TenantBilling, ImpersonationSession[]
3. GIVEN the Plan model WHEN I inspect it THEN it includes code (unique), displayName, maxUsers, maxCompanies, monthlyAiTokenAllowance (BigInt), aiHardLimit (Boolean), enabledModules (Json), apiRateLimit, isActive
4. GIVEN the PlatformUser model WHEN I inspect it THEN it includes email (unique), passwordHash, displayName, role (PlatformRole: PLATFORM_ADMIN, PLATFORM_VIEWER), mfaEnabled, mfaSecret, isActive
5. GIVEN the PlatformAuditLog model WHEN I inspect it THEN it is append-only by design with no updatedAt field, and includes platformUserId, action, targetType, targetId, details (Json), ipAddress, userAgent, timestamp
6. GIVEN seed scripts WHEN I run the platform seed THEN default plans (Core, Pro, Enterprise), a founding tenant record, and a default PLATFORM_ADMIN account are created

**Key Tasks:**
- [ ] Create Platform Prisma schema (AC: #1)
  - [ ] Separate schema file at apps/platform-api/prisma/schema.prisma
  - [ ] Separate datasource pointing to PLATFORM_DATABASE_URL
  - [ ] Configure separate output directory for generated client
- [ ] Define Tenant and TenantStatus enum (AC: #2)
  - [ ] TenantStatus: PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED
  - [ ] BillingStatus: CURRENT, GRACE, OVERDUE, BLOCKED
  - [ ] All fields per Architecture §2.31.2
- [ ] Define Plan model (AC: #3)
  - [ ] Natural plan codes: core, pro, enterprise, custom
  - [ ] enabledModules as JsonB (string array of module keys)
- [ ] Define supporting models (AC: #2)
  - [ ] TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling
  - [ ] EnforcementAction enum: NONE, WARNING, READ_ONLY, SUSPENDED
- [ ] Define PlatformUser and PlatformRole (AC: #4)
  - [ ] PlatformRole: PLATFORM_ADMIN, PLATFORM_VIEWER
  - [ ] MFA fields, isActive, lastLoginAt
- [ ] Define PlatformAuditLog (AC: #5)
  - [ ] Append-only: no updatedAt, indexes on [platformUserId, timestamp] and [targetType, targetId]
- [ ] Define ImpersonationSession (AC: #2)
  - [ ] Fields: platformUserId, tenantId, reason, startedAt, endedAt, expiresAt, actionsLog (Json)
- [ ] Create platform seed data (AC: #6)
  - [ ] 3 default plans with module entitlements
  - [ ] Founding tenant record for development
  - [ ] Default PLATFORM_ADMIN user
- [ ] Run migration (AC: #1-#6)
  - [ ] `prisma migrate dev` against platform-db container

**FR/NFR:** FR193-FR197 (tenant management, plans, billing, platform admin identity); NFR49 (immutable platform audit)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin — full section (2.31.1-2.31.5) | Platform DB schema, AI Gateway, Platform Client SDK, ERP integration points |
| API Contracts | §20 Platform API (Internal), §21 Platform Admin API | Entitlement endpoints, tenant CRUD, plan/billing, AI usage/quota, impersonation |
| Data Models | §5 Platform Database Models (Section 2.31) | Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession |
| State Machines | §20.1 Tenant Lifecycle, §20.2 Billing Enforcement, §20.3 AI Quota State | PROVISIONING->ACTIVE->SUSPENDED->ARCHIVED, NONE->WARNING->READ_ONLY->SUSPENDED |
| Event Catalog | §19 Platform Admin Events | tenant.created, tenant.suspended, tenant.reactivated, tenant.archived, tenant.plan_changed, billing.*, platform.impersonation.* |
| Business Rules | §14b BR-PLT-001 to BR-PLT-021 | Tenant lifecycle, billing enforcement, AI quota, impersonation safeguards, platform audit |
| UX Design Spec | §Platform Admin Portal | Separate app, dark sidebar, PLATFORM ADMIN branding, tenant detail tabs |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications, ERP never calls Platform DB directly |

---

## Epic E2: API Server + Auth + Multi-Company RBAC

**Tier:** 0 | **Dependencies:** E1 | **Type:** API foundation + authentication
**FRs:** FR80-FR83 (users, roles, MFA, sessions), FR172 (company switching), FR175-FR177 (company RBAC)
**API Endpoints:** /auth/login, /auth/refresh, /auth/logout, /auth/mfa/*, /auth/password/*, /system/users CRUD, /system/companies CRUD
**Business Rules:** IMP-007 (RBAC 5 roles), IMP-008 (MFA), IMP-009 (CRUD <500ms)

---

### Story E2.S1: Fastify API Bootstrap

**User Story:** As a developer, I want a fully configured Fastify server with request validation, error handling, structured logging, and standard middleware, so that all API routes built on top of it follow consistent patterns.

**Acceptance Criteria:**
1. GIVEN the Fastify app factory in apps/api/src/app.ts WHEN the server starts THEN it registers CORS, Helmet, rate limiting, correlation ID, request logger, and error handler plugins
2. GIVEN a request to any endpoint WHEN a correlation ID header is not present THEN the middleware generates a UUID correlation ID and attaches it to the request and response
3. GIVEN any unhandled error WHEN it is thrown in a route handler THEN the error handler returns the standardised error envelope `{ success: false, error: { code, message, details? } }` with the correct HTTP status code
4. GIVEN a Zod validation schema on a route WHEN the request body fails validation THEN a 400 ValidationError is returned with field-level error details
5. GIVEN the structured logger WHEN any request is handled THEN it logs level, message, timestamp, correlationId, tenantId, userId, module in JSON format per Architecture §Communication Patterns — Logging
6. GIVEN the health endpoint WHEN `GET /health` is called THEN it returns `{ status: "ok", version, uptime }` with 200 status

**Key Tasks:**
- [ ] Create Fastify app factory (AC: #1)
  - [ ] apps/api/src/app.ts with plugin registration
  - [ ] Register @fastify/cors, @fastify/helmet, @fastify/rate-limit
  - [ ] Register @fastify/swagger for OpenAPI docs (NFR45)
- [ ] Implement correlation ID middleware (AC: #2)
  - [ ] apps/api/src/core/middleware/correlation-id.ts
  - [ ] Generate UUID if X-Correlation-ID header missing
- [ ] Implement error handler (AC: #3, #4)
  - [ ] apps/api/src/core/errors/ — AppError, DomainError, AuthError, NotFoundError, ValidationError hierarchy
  - [ ] Fastify setErrorHandler mapping error types to status codes
  - [ ] Return standardised `{ success: false, error: {...} }` envelope
- [ ] Implement Zod validation integration (AC: #4)
  - [ ] Custom Fastify schema compiler using Zod
  - [ ] Field-level error extraction from ZodError
- [ ] Configure structured logger (AC: #5)
  - [ ] Pino logger with JSON output, correlation ID injection
  - [ ] apps/api/src/core/logger/logger.ts
- [ ] Implement health endpoint (AC: #6)
  - [ ] GET /health with status, version from package.json, uptime
- [ ] Create entry point (AC: #1)
  - [ ] apps/api/src/index.ts — start server on PORT env var

**FR/NFR:** N/A (infrastructure); NFR2 (CRUD <500ms), NFR41 (TypeScript strict), NFR45 (OpenAPI docs)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §1 Application Architecture, §4.1 API Design, §Process Patterns — Error Handling | Modular monolith, Fastify plugin system, AppError hierarchy, standardised error envelope |
| API Contracts | §1 Overview — Response Envelope, Error Codes, Pagination | `{ success, data, meta }` / `{ success, error }`, cursor-based pagination, 401/403/404/422/500 |
| Data Models | N/A | N/A — no models defined in this story |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-009 | CRUD operations complete within 500ms |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 7: TDD, every service has co-located tests |

---

### Story E2.S2: JWT Authentication

**User Story:** As a user, I want to log in with email and password and receive JWT tokens, so that I can access authenticated API endpoints with stateless authentication.

**Acceptance Criteria:**
1. GIVEN valid email and password WHEN POST /auth/login is called THEN the response contains an accessToken (15min expiry), refreshToken (7-day, httpOnly cookie), expiresIn, and user profile data (id, email, firstName, lastName, role, enabledModules, tenantId, mfaEnabled)
2. GIVEN an expired access token WHEN POST /auth/refresh is called with a valid refresh token cookie THEN a new access token is issued and the old refresh token is rotated
3. GIVEN a valid session WHEN POST /auth/logout is called THEN the refresh token is revoked in Redis/database and the httpOnly cookie is cleared
4. GIVEN an invalid email or password WHEN POST /auth/login is called THEN a 401 INVALID_CREDENTIALS error is returned with no information leaking which field was wrong
5. GIVEN 5 failed login attempts within 15 minutes WHEN a 6th attempt is made THEN the account is locked and a 423 ACCOUNT_LOCKED error is returned (NFR15)
6. GIVEN a JWT access token WHEN any authenticated endpoint is called THEN the Fastify onRequest hook verifies the token, extracts userId, tenantId, and role, and decorates the request object

**Key Tasks:**
- [ ] Implement auth service (AC: #1, #4)
  - [ ] apps/api/src/core/auth/auth.service.ts
  - [ ] Password verification using Argon2id
  - [ ] JWT generation with claims: userId, tenantId, role, enabledModules
  - [ ] Access token: 15min expiry, refresh token: 7-day expiry
- [ ] Implement login route (AC: #1, #4)
  - [ ] POST /auth/login with Zod schema validation
  - [ ] Return user profile + tokens per API Contracts §3.1
- [ ] Implement refresh flow (AC: #2)
  - [ ] POST /auth/refresh reads httpOnly cookie
  - [ ] Rotate refresh token (old one invalidated)
  - [ ] Issue new access token
- [ ] Implement logout (AC: #3)
  - [ ] POST /auth/logout revokes refresh token
  - [ ] Clear httpOnly cookie
- [ ] Implement rate limiting on login (AC: #5)
  - [ ] Track failed attempts per email in Redis
  - [ ] Lock after 5 failures within 15 minutes
  - [ ] Return 423 ACCOUNT_LOCKED
- [ ] Implement JWT verification hook (AC: #6)
  - [ ] Fastify onRequest hook for authenticated routes
  - [ ] Decorate request with userId, tenantId, role, enabledModules
- [ ] Implement tenant database resolution (AC: #6)
  - [ ] TenantDatabaseManager — resolve tenantId to PrismaClient
  - [ ] Decorate request with tenant-specific db connection

**FR/NFR:** FR80 (user auth); NFR10 (MFA foundation), NFR13 (Argon2), NFR15 (rate limiting)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | Argon2id, JWT 15min/7d, httpOnly cookie, Redis for revocation, auth flow steps 1-7, tenant resolution flow |
| API Contracts | §2.1 Auth & Session, §3.1 Auth Endpoints | POST /auth/login, /auth/refresh, /auth/logout — request/response schemas |
| Data Models | §3.1 System Module | User model with passwordHash, mfaEnabled, mfaSecret |
| State Machines | N/A | N/A — login is not a state machine transition |
| Event Catalog | §16 System Events | `user.login` event: { userId, loginMethod, ipAddress } |
| Business Rules | §14 IMP-007, IMP-008 | RBAC with 5 roles, MFA support |
| UX Design Spec | N/A | N/A — no UI in this story (API only) |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | JWT carries role, resolution happens at RBAC guard level |

---

### Story E2.S3: MFA (TOTP)

**User Story:** As a user, I want to enable Time-based One-Time Password (TOTP) multi-factor authentication on my account, so that my login is protected with a second factor.

**Acceptance Criteria:**
1. GIVEN an authenticated user WHEN POST /auth/mfa/setup is called THEN a TOTP secret is generated and returned as a QR code URI and base32-encoded secret for manual entry
2. GIVEN a user with MFA being set up WHEN they submit a valid TOTP code via POST /auth/mfa/verify THEN MFA is permanently enabled on their account
3. GIVEN a user with MFA enabled WHEN they log in with correct email and password but no MFA token THEN the response includes `requiresMfa: true` and a partial authentication state (no tokens issued)
4. GIVEN a user with MFA enabled WHEN they submit a valid TOTP token after initial login THEN full JWT tokens are issued
5. GIVEN an ADMIN or SUPER_ADMIN user WHEN MFA is not enabled THEN the system warns but does not block (mandatory MFA enforcement configurable per role)
6. GIVEN a user account WHEN an administrator resets MFA THEN the mfaSecret is cleared and mfaEnabled is set to false, requiring re-setup

**Key Tasks:**
- [ ] Implement TOTP service (AC: #1, #2)
  - [ ] apps/api/src/core/auth/mfa.service.ts
  - [ ] Generate TOTP secret using otplib/speakeasy
  - [ ] Generate QR code URI (otpauth://totp/...)
  - [ ] Verify TOTP token with time-window tolerance
- [ ] Implement MFA setup route (AC: #1)
  - [ ] POST /auth/mfa/setup — generate and return secret + QR URI
  - [ ] Store secret temporarily until verified
- [ ] Implement MFA verification route (AC: #2)
  - [ ] POST /auth/mfa/verify — verify token, persist mfaEnabled=true
- [ ] Modify login flow for MFA (AC: #3, #4)
  - [ ] If mfaEnabled and no mfaToken: return 200 with requiresMfa=true, mfaChallengeToken
  - [ ] If mfaEnabled and valid mfaToken: issue full JWT tokens
  - [ ] If mfaEnabled and invalid mfaToken: return 401 MFA_INVALID
- [ ] Implement MFA enforcement policy (AC: #5)
  - [ ] Configurable via SystemSetting: roles requiring MFA
  - [ ] Warning for ADMIN+ without MFA (not blocking for MVP)
- [ ] Implement MFA reset (AC: #6)
  - [ ] Admin endpoint to clear mfaSecret, set mfaEnabled=false
  - [ ] Audit log the reset action

**FR/NFR:** FR80 (MFA); NFR10 (MFA TOTP minimum), NFR16 (sensitive operations)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | TOTP (RFC 6238), Google Authenticator/Authy compatible, auth flow steps 2-3 |
| API Contracts | §2.1 Auth & Session | POST /auth/mfa/setup, POST /auth/mfa/verify |
| Data Models | §3.1 System Module | User.mfaEnabled, User.mfaSecret fields |
| State Machines | N/A | N/A — MFA is a configuration flag, not a lifecycle |
| Event Catalog | §16 System Events | `user.login` event (includes loginMethod which can indicate MFA) |
| Business Rules | §14 IMP-008, §14b BR-PLT-018 | MFA support for all users, mandatory for PLATFORM_ADMIN |
| UX Design Spec | N/A | N/A — no UI in this story (API only) |
| Project Context | §2 RBAC | MFA enforcement is role-configurable |

---

### Story E2.S4: Multi-Company Context Middleware

**User Story:** As a user working across multiple companies, I want to switch between companies and have all queries automatically scoped to my selected company, so that I see only the data relevant to my current company context.

**Acceptance Criteria:**
1. GIVEN an authenticated request WHEN the X-Company-ID header is present THEN the middleware sets ctx.companyId to that value and all subsequent queries scope by that companyId
2. GIVEN an authenticated request WHEN no X-Company-ID header is present THEN the middleware uses the user's default company (from User.companyId)
3. GIVEN a user without access to the requested companyId WHEN they set X-Company-ID THEN a 403 FORBIDDEN error is returned
4. GIVEN a request context WHEN any repository method is called THEN it receives companyId from the request context and includes it in every WHERE clause
5. GIVEN the RegisterSharingRule configuration WHEN a shared entity (e.g., Customer) is queried THEN the getVisibleCompanyIds() helper determines the full set of visible company IDs and the query uses `companyId IN [...]`
6. GIVEN the company switching API WHEN POST /system/companies/:id/switch is called THEN the user's session default company is updated

**Key Tasks:**
- [ ] Implement company context middleware (AC: #1, #2)
  - [ ] apps/api/src/core/middleware/company-context.ts
  - [ ] Read X-Company-ID header or fall back to user.companyId
  - [ ] Decorate request with companyId
- [ ] Implement access check (AC: #3)
  - [ ] Verify user has a role (global or company-specific) for the target company
  - [ ] Return 403 if no access
- [ ] Create request context type (AC: #4)
  - [ ] Define RequestContext interface: { userId, tenantId, companyId, role }
  - [ ] All services receive this context
- [ ] Implement sharing-aware query helper (AC: #5)
  - [ ] Utility function: buildCompanyWhereClause(ctx, entityType)
  - [ ] Uses getVisibleCompanyIds() from E1.S3
  - [ ] Returns Prisma where clause with companyId filter
- [ ] Implement company switch endpoint (AC: #6)
  - [ ] POST /system/companies/:id/switch
  - [ ] Update user's default company in database
  - [ ] Return new company context in response

**FR/NFR:** FR172 (company switching), FR174 (query scoping)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles | companyId on every table, query MUST scope by companyId |
| API Contracts | §2.2 System Module | Company profile management endpoints |
| Data Models | §3.1 System Module | CompanyProfile, RegisterSharingRule, UserCompanyRole |
| State Machines | N/A | N/A — company context is not a stateful entity |
| Event Catalog | N/A | N/A — company switching does not emit events (audit only) |
| Business Rules | §14 IMP-001 | Database-per-tenant isolation (company scoping is within-tenant) |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | Query pattern with companyId, getVisibleCompanyIds() for shared entities, RegisterSharingRule modes |

---

### Story E2.S5: RBAC Permission Guards

**User Story:** As an administrator, I want the system to enforce role-based access control on every API route, so that users can only perform actions their role permits, with per-company overrides.

**Acceptance Criteria:**
1. GIVEN a route requiring MANAGER role WHEN a STAFF user calls it THEN a 403 FORBIDDEN error is returned
2. GIVEN a user with ADMIN global role and VIEWER override for Company 3 WHEN they access Company 3 endpoints THEN the VIEWER role applies (per-company override takes precedence)
3. GIVEN a user with no global role and no company-specific role for Company 5 WHEN they access Company 5 endpoints THEN a 403 FORBIDDEN error is returned
4. GIVEN the role hierarchy SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER WHEN a route requires MANAGER THEN MANAGER, ADMIN, and SUPER_ADMIN all pass the check, while STAFF and VIEWER are denied
5. GIVEN a route with module gating WHEN a user's enabledModules does not include the target module THEN a 403 MODULE_NOT_ENABLED error is returned
6. GIVEN the RBAC guard WHEN it resolves the effective role THEN it checks company-specific role first, then global role, per Project Context §2 resolution order

**Key Tasks:**
- [ ] Implement RBAC guard as Fastify hook (AC: #1, #4)
  - [ ] apps/api/src/core/rbac/rbac.guard.ts
  - [ ] Accept minimum role parameter per route
  - [ ] Role hierarchy: SUPER_ADMIN(5) > ADMIN(4) > MANAGER(3) > STAFF(2) > VIEWER(1)
- [ ] Implement role resolution service (AC: #2, #3, #6)
  - [ ] apps/api/src/core/rbac/rbac.service.ts
  - [ ] Query UserCompanyRole for company-specific first
  - [ ] Fall back to global role (companyId IS NULL)
  - [ ] Return null if neither exists (no access)
- [ ] Implement module gating (AC: #5)
  - [ ] Check user.enabledModules against route's module
  - [ ] Return 403 MODULE_NOT_ENABLED if not included
- [ ] Create RBAC types (AC: #1-#6)
  - [ ] apps/api/src/core/rbac/rbac.types.ts
  - [ ] UserRole enum, RoleLevel map, Permission types
- [ ] Write unit tests for role resolution (AC: #2, #3, #6)
  - [ ] Test: company-specific > global > no access
  - [ ] Test: hierarchy enforcement
  - [ ] Test: module gating

**FR/NFR:** FR81 (role assignment), FR175-FR177 (company RBAC); NFR12 (all endpoints authenticated/authorised)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security, §Process Patterns — rbac.guard.ts | JWT claims, role checking, module gating at route level |
| API Contracts | §1 RBAC Roles | SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER with scope descriptions |
| Data Models | §3.1 System Module, §4.1 Enums | UserCompanyRole model, UserRole enum |
| State Machines | N/A | N/A — RBAC is not a state machine |
| Event Catalog | N/A | N/A — role checks do not emit events |
| Business Rules | §14 IMP-007 | RBAC with 5 default roles, all sensitive operations gated |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | Resolution: company-specific -> global -> no access; example: Mohammed ADMIN globally + VIEWER for Company 3 |

---

### Story E2.S6: User & Company Management API

**User Story:** As an administrator, I want CRUD endpoints for users and companies, so that I can manage user accounts, role assignments, and company profiles.

**Acceptance Criteria:**
1. GIVEN ADMIN role WHEN I call POST /system/users with valid user data THEN a new user is created with the specified role and enabled modules, and their password is hashed with Argon2id
2. GIVEN ADMIN role WHEN I call PATCH /system/users/:id/role with a new role THEN the user's global role is updated and an audit log entry is created
3. GIVEN ADMIN role WHEN I call GET /system/users with cursor pagination THEN a list of users is returned with id, email, name, role, enabledModules, isActive, lastLoginAt
4. GIVEN ADMIN role WHEN I call POST /system/company-profile with company data THEN a new company is created with name, legalName, baseCurrencyCode, vatNumber, and a default NumberSeries set is generated
5. GIVEN any authenticated user WHEN I call GET /system/company-profile THEN the current company's profile is returned based on ctx.companyId
6. GIVEN a STAFF user WHEN they attempt to call POST /system/users THEN a 403 error is returned (ADMIN minimum required)

**Key Tasks:**
- [ ] Implement User CRUD routes (AC: #1, #2, #3, #6)
  - [ ] POST /system/users — create user with Argon2id password hash
  - [ ] GET /system/users — list with cursor pagination
  - [ ] GET /system/users/:id — get by ID
  - [ ] PATCH /system/users/:id — update user
  - [ ] PATCH /system/users/:id/role — update role
  - [ ] PATCH /system/users/:id/modules — update enabled modules
  - [ ] All routes guarded with RBAC (ADMIN minimum)
- [ ] Implement User service and repository (AC: #1, #2)
  - [ ] UserService: business logic, validation
  - [ ] UserRepository: Prisma queries with companyId scoping
  - [ ] Password hashing in service layer
- [ ] Implement Company management routes (AC: #4, #5)
  - [ ] GET/POST/PATCH /system/company-profile
  - [ ] POST creates company + default number series
  - [ ] GET returns current company (ctx.companyId)
- [ ] Implement Zod validation schemas (AC: #1, #4)
  - [ ] CreateUserSchema, UpdateUserSchema, CompanyProfileSchema
  - [ ] Export from apps/api/src/modules/system/schemas/
- [ ] Write integration tests (AC: #1-#6)
  - [ ] Test CRUD operations
  - [ ] Test RBAC enforcement (ADMIN can, STAFF cannot)
  - [ ] Test pagination

**FR/NFR:** FR80 (user management), FR83 (company settings), FR84 (company management); NFR2 (CRUD <500ms)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §1 Application Architecture — Module Plugin Structure | system/ module: routes, services, repositories, schemas |
| API Contracts | §2.2 System Module | CRUD for /system/users, /system/company-profile, role/module endpoints |
| Data Models | §3.1 System Module | User, CompanyProfile models with all fields |
| State Machines | N/A | N/A — users and companies use isActive, not state machines |
| Event Catalog | §16 System Events | `settings.updated` for system setting changes |
| Business Rules | §14 IMP-007 | RBAC enforcement on all management operations |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture, §11 Development Rules | companyId on every table, repository pattern, service never calls Prisma directly |

---

## Epic E3: Event Bus + Audit Trail

**Tier:** 0 | **Dependencies:** E2 | **Type:** Cross-cutting infrastructure
**FRs:** FR85 (audit logs), FR92 (immutable audit trail)
**Models:** Event bus infrastructure (in-process), AuditLog
**Events:** All event bus infrastructure: typed events, publish/subscribe
**Business Rules:** IMP-003 (immutable audit, 6-year retention), BR-SYS-013/014 (polymorphic entity pattern)
**NFRs:** NFR9 (audit trail immutable), NFR14 (financial modifications logged), NFR39 (append-only audit)

---

### Story E3.S1: Event Bus Infrastructure

**User Story:** As a developer, I want a typed, in-process event bus for cross-module communication, so that modules can publish and subscribe to business events without direct service-to-service coupling.

**Acceptance Criteria:**
1. GIVEN the EventBus class WHEN I emit a typed event (e.g., `invoice.created`) THEN all registered subscribers for that event are invoked with the correctly typed payload
2. GIVEN the BusinessEvents interface WHEN a developer registers a handler THEN TypeScript enforces the correct payload type for each event name
3. GIVEN an event handler that throws an error WHEN the event is published THEN the error is caught and logged without affecting the emitting module or other subscribers
4. GIVEN the emit() method WHEN called with an event THEN all subscribers execute asynchronously (do not block the emitter)
5. GIVEN a subscriber registration WHEN the same handler is registered twice for the same event THEN it is only invoked once per event emission (deduplication)
6. GIVEN the BusinessEvents interface WHEN new events are added THEN they follow the naming convention `{entity}.{action}` with past tense actions (created, updated, approved, posted)

**Key Tasks:**
- [ ] Define BusinessEvents interface (AC: #2, #6)
  - [ ] apps/api/src/core/events/event-bus.types.ts
  - [ ] System events: user.login, settings.updated
  - [ ] Placeholder event signatures for future modules
  - [ ] Follow naming convention: entity.action (past tense)
- [ ] Implement EventBus class (AC: #1, #3, #4)
  - [ ] apps/api/src/core/events/event-bus.ts
  - [ ] Generic emit<K>(event: K, data: BusinessEvents[K]) method
  - [ ] Generic on<K>(event: K, handler: Handler<K>) method
  - [ ] Async handler execution with error catching
  - [ ] Structured error logging for failed handlers
- [ ] Implement handler deduplication (AC: #5)
  - [ ] Track registered handlers by reference to prevent duplicates
- [ ] Create Fastify plugin for event bus (AC: #1)
  - [ ] Register as Fastify decorator: `fastify.eventBus`
  - [ ] Available to all modules via request.server.eventBus
- [ ] Write comprehensive tests (AC: #1-#6)
  - [ ] Test typed emission and subscription
  - [ ] Test error isolation between handlers
  - [ ] Test async execution
  - [ ] Test deduplication

**FR/NFR:** N/A (infrastructure); NFR22 (graceful failure handling)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 Event Architecture | In-process typed event bus, BusinessEvents interface, EventBus class with emit/on, event flow example |
| API Contracts | N/A | N/A — event bus is internal, not an API endpoint |
| Data Models | N/A | N/A — event bus is in-memory, no models |
| State Machines | N/A | N/A — event bus itself is not stateful |
| Event Catalog | §Overview, §Event Naming Convention | entity.action naming, past tense, typed payloads with entity IDs |
| Business Rules | N/A | N/A — event bus is infrastructure |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits a typed event via event bus; Rule 7: No cross-module direct service calls (use events) |

---

### Story E3.S2: Audit Trail Service

**User Story:** As an administrator, I want an immutable audit log recording every business entity mutation, so that I can trace all changes for compliance and investigation purposes.

**Acceptance Criteria:**
1. GIVEN a business event is emitted WHEN the audit subscriber receives it THEN an append-only AuditLog record is created with entityType, entityId, action (CREATE/UPDATE/DELETE/APPROVE/POST), beforeData (JSONB), afterData (JSONB), userId, isAiAction, aiConfidence, timestamp, and correlationId
2. GIVEN the audit_log table WHEN any UPDATE or DELETE SQL is attempted THEN the database rejects it via PostgreSQL rules (no_update_audit, no_delete_audit)
3. GIVEN the audit query API WHEN GET /system/audit-log is called with filters (entityType, entityId, action, userId, dateRange) THEN matching records are returned with cursor pagination
4. GIVEN the audit query API WHEN GET /system/audit-log/:entityType/:entityId is called THEN the full change history for that specific entity is returned in chronological order
5. GIVEN an AI-initiated action WHEN it is audit logged THEN isAiAction is true and aiConfidence contains the confidence score from the AI orchestration layer
6. GIVEN the retention policy WHEN audit records are queried THEN records older than 6 years are accessible (no automatic deletion per NFR40)

**Key Tasks:**
- [ ] Define AuditLog Prisma model (AC: #1)
  - [ ] Fields: entityType, entityId, action, beforeData (Json), afterData (Json), userId, isAiAction, aiConfidence (Decimal), correlationId, timestamp
  - [ ] No updatedAt field (append-only)
  - [ ] Indexes: [entityType, entityId], [userId, timestamp], [timestamp]
- [ ] Create PostgreSQL immutability rules (AC: #2)
  - [ ] CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING
  - [ ] CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING
  - [ ] Apply via Prisma migration
- [ ] Implement AuditService (AC: #1, #5)
  - [ ] apps/api/src/core/audit/audit.service.ts
  - [ ] log(entry: AuditEntry) method — append to audit_log
  - [ ] Subscribe to all business events via EventBus
  - [ ] Extract before/after data from event payloads
- [ ] Implement audit query routes (AC: #3, #4)
  - [ ] GET /system/audit-log — filtered, paginated
  - [ ] GET /system/audit-log/:entityType/:entityId — entity history
  - [ ] ADMIN minimum role required
- [ ] Write tests (AC: #1-#5)
  - [ ] Test record creation from event
  - [ ] Test immutability (UPDATE/DELETE fail)
  - [ ] Test query filtering and pagination
  - [ ] Test AI action logging

**FR/NFR:** FR85 (audit log viewing), FR92 (immutable audit); NFR14 (financial modifications logged), NFR39 (append-only), NFR40 (6-year retention)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.6 Immutable Audit Trail | PostgreSQL rules preventing UPDATE/DELETE, audit fields: entityType, entityId, action, beforeData, afterData, userId, isAiAction, aiConfidence, correlationId |
| API Contracts | §2.2 System Module | GET /system/audit-log, GET /system/audit-log/:entityType/:entityId |
| Data Models | §6.6 Audit Trail Fields | createdAt, updatedAt, createdBy, updatedBy on transactional entities |
| State Machines | N/A | N/A — audit log is append-only, no state transitions |
| Event Catalog | §15 Cross-Cutting Events — Audit Trail | Audit service subscribes to ALL business events, creates immutable records |
| Business Rules | §14 IMP-003, §12 BR-SYS-013/BR-SYS-014 | Immutable audit trail, 6-year retention, polymorphic entityType+entityId validation |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits event, audit service subscribes to all |

---

### Story E3.S3: Event Persistence & Dead Letter

**User Story:** As a developer, I want failed event handlers to be retried with exponential backoff and persisted to a dead-letter queue, so that transient failures do not cause permanent data loss.

**Acceptance Criteria:**
1. GIVEN an event handler that fails on first attempt WHEN the retry mechanism triggers THEN the handler is retried up to 3 times with exponential backoff (1s, 2s, 4s)
2. GIVEN an event handler that fails all 3 retries WHEN the final retry fails THEN the event is persisted to a dead-letter queue (BullMQ) with the full event payload and error details
3. GIVEN the dead-letter queue WHEN an administrator queries it THEN they can see failed events with event name, payload, error message, retry count, and timestamp
4. GIVEN a dead-letter item WHEN an administrator triggers a manual re-process THEN the event is re-emitted through the event bus for all subscribers
5. GIVEN event handlers WHEN they are designed THEN they must be idempotent: processing the same event twice produces no duplicate side effects, using sourceId/correlationId for deduplication

**Key Tasks:**
- [ ] Implement retry mechanism with exponential backoff (AC: #1)
  - [ ] Wrap event handler execution in retry logic
  - [ ] Configurable maxRetries (default 3) and backoff base (default 1s)
  - [ ] Log each retry attempt with retry count
- [ ] Implement dead-letter queue (AC: #2, #3)
  - [ ] Use BullMQ queue named "event-dead-letter"
  - [ ] Persist: eventName, payload, error, retryCount, originalTimestamp
  - [ ] Query API: GET /system/dead-letter-queue (ADMIN only)
- [ ] Implement manual re-process (AC: #4)
  - [ ] POST /system/dead-letter-queue/:id/reprocess
  - [ ] Re-emit event through EventBus
  - [ ] Mark dead-letter item as reprocessed
- [ ] Document idempotency requirement (AC: #5)
  - [ ] Add correlationId to all event payloads
  - [ ] Create idempotency helper utility
- [ ] Write tests (AC: #1-#4)
  - [ ] Test retry with mock failing handler
  - [ ] Test dead-letter persistence after max retries
  - [ ] Test re-processing from dead-letter

**FR/NFR:** N/A (infrastructure); NFR22 (graceful failure handling with retry and dead-letter)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 Event Architecture | Future migration to Redis Streams/NATS; event interface stays the same |
| API Contracts | N/A | N/A — dead-letter is internal infrastructure |
| Data Models | N/A | N/A — dead-letter stored in BullMQ/Redis, not Prisma |
| State Machines | N/A | N/A — dead-letter is a queue, not a state machine |
| Event Catalog | §Implementation Notes | Handlers must be idempotent, use correlationId for dedup, handlers must not throw (catch + log + retry) |
| Business Rules | N/A | N/A — infrastructure concern |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits event; reliability requires retry + dead-letter |

---

## Epic E3b: Platform API + AI Gateway

**Tier:** 0 | **Dependencies:** E1 (Platform DB schema) | **Type:** Platform infrastructure
**FRs:** FR198-FR210 (AI Gateway, quota), FR193-FR197 (platform admin auth), FR219-FR222 (ERP runtime integration)
**Platform Models:** Tenant, Plan, TenantAiUsage, TenantAiQuota, ImpersonationSession, PlatformUser
**Business Rules:** BR-PLT-001 to BR-PLT-021 (tenant lifecycle, billing, AI quota, impersonation, audit)
**NFRs:** NFR46 (Platform API <50ms), NFR47 (AI Gateway <100ms added), NFR48 (mandatory MFA), NFR49 (immutable audit), NFR50 (durable AI records), NFR51 (webhook <30s cache invalidation)

---

### Story E3b.S1: Platform API Server

**User Story:** As a platform developer, I want a separate Fastify instance for the Platform API with its own authentication system, so that platform admin operations and ERP runtime entitlement checks are served independently from tenant ERP requests.

**Acceptance Criteria:**
1. GIVEN the Platform API server in apps/platform-api WHEN it starts THEN it connects to the Platform database (not any tenant ERP database) and serves on a separate port
2. GIVEN a PlatformUser with PLATFORM_ADMIN role and MFA enabled WHEN they POST /admin/auth/login with correct credentials and TOTP code THEN a platform-level JWT is issued with platformUserId and platformRole claims
3. GIVEN a PLATFORM_ADMIN account WHEN MFA is not enabled THEN login is blocked per BR-PLT-018 (mandatory MFA for PLATFORM_ADMIN)
4. GIVEN the Platform API WHEN GET /admin/monitoring/health is called THEN it returns platform health status including database connectivity, Redis availability, and uptime
5. GIVEN an internal service token WHEN ERP calls GET /platform/tenants/:id/entitlements THEN the request is authenticated and the endpoint responds within 50ms (NFR46)
6. GIVEN the Platform API WHEN any state-changing admin action is performed THEN a PlatformAuditLog record is created with actor, action, target, details, IP, and timestamp (BR-PLT-017)

**Key Tasks:**
- [ ] Create Platform API Fastify app (AC: #1)
  - [ ] apps/platform-api/src/app.ts — separate Fastify instance
  - [ ] Connect to Platform PrismaClient (separate schema)
  - [ ] Register CORS, Helmet, rate limiting, error handler
  - [ ] Separate port from ERP API
- [ ] Implement Platform auth (AC: #2, #3)
  - [ ] POST /admin/auth/login — PlatformUser auth with Argon2id
  - [ ] Mandatory MFA verification for PLATFORM_ADMIN (BR-PLT-018)
  - [ ] POST /admin/auth/mfa/verify, POST /admin/auth/refresh
  - [ ] Platform JWT with platformUserId, platformRole claims
- [ ] Implement internal service token auth (AC: #5)
  - [ ] Middleware for ERP-facing endpoints (/platform/*)
  - [ ] Validate internal service bearer token
  - [ ] Optimise for <50ms response time
- [ ] Implement health endpoint (AC: #4)
  - [ ] GET /admin/monitoring/health
  - [ ] Check DB connectivity, Redis ping, uptime
- [ ] Implement platform audit middleware (AC: #6)
  - [ ] Automatic PlatformAuditLog creation for all state-changing routes
  - [ ] Capture platformUserId, action, targetType, targetId, IP, userAgent
- [ ] Implement platform user management (AC: #2)
  - [ ] GET /admin/users, POST /admin/users, PATCH /admin/users/:id
  - [ ] PLATFORM_ADMIN role required for management

**FR/NFR:** FR197 (platform admin auth), FR214 (platform audit); NFR46 (Platform API <50ms), NFR48 (mandatory MFA), NFR49 (immutable audit)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.1 Architecture Overview, §2.31.2 Platform Database Schema | Platform API = separate Fastify, internal service tokens, Platform DB |
| API Contracts | §21.9 Platform Auth, §21.6 Platform Monitoring | /admin/auth/login, /admin/auth/mfa/verify, /admin/monitoring/health |
| Data Models | §5 Platform Database Models | PlatformUser, PlatformAuditLog, PlatformRole enum |
| State Machines | N/A | N/A — Platform API server startup is not a state machine |
| Event Catalog | §19 Platform Admin Events | All platform admin actions produce audit entries |
| Business Rules | §14b BR-PLT-016 to BR-PLT-018 | Immutable audit log, every state change logged, mandatory MFA for PLATFORM_ADMIN |
| UX Design Spec | §Platform Admin Portal | Separate app with dark sidebar, PLATFORM ADMIN branding |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications, Platform audit is append-only |

---

### Story E3b.S2: Tenant Management API

**User Story:** As a platform administrator, I want to manage tenant lifecycle (create, view, suspend, reactivate, archive), so that I can onboard new customers and control their access.

**Acceptance Criteria:**
1. GIVEN PLATFORM_ADMIN role WHEN POST /admin/tenants is called with valid tenant data THEN a new Tenant record is created in PROVISIONING status with the assigned plan, database connection metadata, and a PlatformAuditLog entry
2. GIVEN a tenant in PROVISIONING status WHEN provisioning completes THEN the status transitions to ACTIVE and a `tenant.created` event is emitted
3. GIVEN a tenant in ACTIVE status WHEN POST /admin/tenants/:id/suspend is called with a reason THEN the status transitions to SUSPENDED, a `tenant.suspended` webhook is pushed to the ERP, and a PlatformAuditLog entry is created
4. GIVEN a tenant in SUSPENDED status WHEN POST /admin/tenants/:id/reactivate is called THEN the status transitions to ACTIVE, a `tenant.reactivated` webhook is pushed, and a PlatformAuditLog entry is created
5. GIVEN a tenant in SUSPENDED status WHEN POST /admin/tenants/:id/archive is called THEN the status transitions to ARCHIVED (irrecoverable from UI), a `tenant.archived` webhook is pushed, and a PlatformAuditLog entry is created
6. GIVEN invalid state transitions (e.g., ACTIVE to ARCHIVED directly) WHEN attempted THEN a 422 INVALID_STATE_TRANSITION error is returned per BR-PLT-001

**Key Tasks:**
- [ ] Implement tenant CRUD routes (AC: #1)
  - [ ] POST /admin/tenants — create with plan assignment
  - [ ] GET /admin/tenants — list with filters (status, plan, search)
  - [ ] GET /admin/tenants/:id — full detail
  - [ ] PATCH /admin/tenants/:id — update settings
- [ ] Implement tenant lifecycle state machine (AC: #2-#6)
  - [ ] State transitions: PROVISIONING->ACTIVE, ACTIVE->SUSPENDED, SUSPENDED->ACTIVE, SUSPENDED->ARCHIVED
  - [ ] Invalid transitions rejected with 422
  - [ ] All transitions create PlatformAuditLog entries
- [ ] Implement suspend/reactivate/archive endpoints (AC: #3, #4, #5)
  - [ ] POST /admin/tenants/:id/suspend (requires reason)
  - [ ] POST /admin/tenants/:id/reactivate
  - [ ] POST /admin/tenants/:id/archive
- [ ] Implement webhook push for lifecycle events (AC: #3, #4, #5)
  - [ ] Push tenant.suspended, tenant.reactivated, tenant.archived to ERP webhook
  - [ ] POST to https://{tenant-slug}.nexa-erp.com/webhooks/platform
- [ ] Implement module and feature flag management (AC: #1)
  - [ ] PUT /admin/tenants/:id/modules — set module overrides
  - [ ] PUT /admin/tenants/:id/feature-flags — set feature flags
  - [ ] Push tenant.modules_changed webhook on change
- [ ] Write tests for all lifecycle transitions (AC: #2-#6)
  - [ ] Valid transitions succeed
  - [ ] Invalid transitions return 422
  - [ ] Audit log created for each action

**FR/NFR:** FR193-FR196 (tenant CRUD, lifecycle, modules, flags); NFR49 (audit), NFR51 (webhook <30s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.2 Platform Database Schema | Tenant model, TenantStatus enum, TenantModuleOverride, TenantFeatureFlag |
| API Contracts | §21.1 Tenant Management, §21.2 Tenant User Management | POST/GET/PATCH /admin/tenants, suspend, reactivate, archive, modules, flags |
| Data Models | §5 Platform Database Models — Tenant, TenantModuleOverride, TenantFeatureFlag | All fields, enums, relations |
| State Machines | §20.1 Tenant Lifecycle | PROVISIONING->ACTIVE->SUSPENDED->ARCHIVED with guards and side effects |
| Event Catalog | §19 Platform Admin Events | tenant.created, tenant.suspended, tenant.reactivated, tenant.archived, tenant.modules_changed |
| Business Rules | §14b BR-PLT-001 to BR-PLT-003 | Strict state machine, suspension within 30s, archived = irrecoverable from UI |
| UX Design Spec | §Platform Admin Portal — Navigation | Tenants section: list, detail (overview/modules/users/AI/billing/diagnostics/audit tabs), create wizard |
| Project Context | §8b Platform Layer Architecture | ERP checks entitlements via Platform Client SDK, webhook for cache invalidation |

---

### Story E3b.S3: AI Gateway Service

**User Story:** As a developer, I want a single AI Gateway service through which all LLM calls are routed, so that every AI interaction is quota-checked, proxied, and usage-recorded with zero loss.

**Acceptance Criteria:**
1. GIVEN any ERP module WHEN it needs to call an LLM THEN it must call `aiGateway.complete()` (no direct Claude API calls) per BR-PLT-007
2. GIVEN an AI call request WHEN the AI Gateway receives it THEN it first calls POST /platform/tenants/:id/ai/check with estimated tokens and feature key, and only proceeds if `allowed: true`
3. GIVEN the quota check returns `allowed: false` (hard limit reached) WHEN `plan.aiHardLimit = true` THEN the gateway returns an AI_QUOTA_EXCEEDED error without calling the LLM
4. GIVEN a successful AI call WHEN the LLM response is received THEN the gateway calls POST /platform/tenants/:id/ai/record with usage data (fire-and-forget with retry queue) and returns the response to the calling module
5. GIVEN the Platform API is unreachable WHEN the gateway performs a quota check THEN it serves from cached quota data and queues the usage record for later sync per BR-PLT-020
6. GIVEN the AI Gateway adds overhead WHEN measured end-to-end THEN the quota check + usage recording adds no more than 100ms latency per NFR47

**Key Tasks:**
- [ ] Create AI Gateway package (AC: #1)
  - [ ] packages/ai-gateway/src/index.ts
  - [ ] Export `AiGateway` class with `complete()` method
  - [ ] Accept: tenantId, userId, featureKey, messages, tools
- [ ] Implement pre-call quota check (AC: #2, #3)
  - [ ] Call POST /platform/tenants/:id/ai/check
  - [ ] Handle `allowed: false` — throw AiQuotaExceededError
  - [ ] Handle soft limit warnings — attach to response metadata
- [ ] Implement LLM proxy (AC: #4)
  - [ ] Call Claude API via Anthropic SDK
  - [ ] Stream or complete based on caller preference
  - [ ] Measure prompt/completion tokens from response
- [ ] Implement post-call usage recording (AC: #4, #5)
  - [ ] POST /platform/tenants/:id/ai/record
  - [ ] Fire-and-forget with local retry queue (BullMQ)
  - [ ] Zero-loss guarantee: queue locally if Platform unreachable
- [ ] Implement circuit breaker for Platform API (AC: #5)
  - [ ] If Platform unreachable for >10s, serve stale cached quota
  - [ ] Log degraded state
- [ ] Write performance tests (AC: #6)
  - [ ] Measure overhead of quota check + recording
  - [ ] Assert <100ms added latency

**FR/NFR:** FR205 (AI calls through gateway), FR206 (per-call usage recording); NFR47 (<100ms added latency), NFR50 (durable AI records)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.3 AI Gateway Service | Flow: ERP -> aiGateway.complete() -> quota check -> Claude API -> usage record -> return; quota enforcement behaviour |
| API Contracts | §20.2 AI Gateway | POST /platform/tenants/:id/ai/check, POST /platform/tenants/:id/ai/record, GET /platform/tenants/:id/ai/usage |
| Data Models | §5 Platform Database Models — TenantAiUsage, TenantAiQuota | Usage record fields, quota tracking fields |
| State Machines | §20.3 AI Quota State (Runtime) | NORMAL->ALERT_50->SOFT_LIMIT->HARD_LIMIT->ANOMALY thresholds |
| Event Catalog | §19 Platform Admin Events | tenant.quota_warning, tenant.quota_exceeded events |
| Business Rules | §14b BR-PLT-007 to BR-PLT-011 | All AI via gateway, quota check before every call, durable usage records, configurable thresholds, spike detection |
| UX Design Spec | §Platform Admin Portal — AI Usage | Token dashboards, quota alerts, CSV export |
| Project Context | §8b Platform Layer Architecture — AI Gateway | Mandatory routing, no direct LLM API calls from business modules |

---

### Story E3b.S4: Platform Client SDK

**User Story:** As a developer, I want a thin Platform Client SDK library that every ERP service imports, so that entitlement checks, AI quota queries, and cache invalidation are handled consistently with circuit breaker resilience.

**Acceptance Criteria:**
1. GIVEN the SDK in packages/platform-client WHEN an ERP service calls `getEntitlements(tenantId)` THEN it returns cached TenantEntitlements (status, planCode, billingStatus, enforcementAction, maxUsers, maxCompanies, enabledModules, featureFlags) with 5-minute TTL
2. GIVEN the SDK WHEN `checkModuleAccess(tenantId, moduleKey)` is called THEN it returns `{ allowed: boolean, reason?: string }` from cached entitlements without a network call
3. GIVEN the SDK WHEN `checkAiQuota(tenantId, estimatedTokens, featureKey)` is called THEN it makes a live call to the Platform API (no caching for quota — must be real-time)
4. GIVEN a webhook event `tenant.plan_changed` WHEN the ERP webhook listener receives it THEN it calls `invalidateCache(tenantId)` to bust the entitlement cache immediately
5. GIVEN the Platform API is unreachable for >10 seconds WHEN the circuit breaker triggers THEN the SDK serves stale cached entitlements with `degraded: true` flag and does not throw
6. GIVEN the webhook endpoint at POST /webhooks/platform WHEN the ERP receives a platform event THEN it validates the internal service token, parses the event, and routes to the appropriate handler

**Key Tasks:**
- [ ] Create Platform Client SDK package (AC: #1, #2)
  - [ ] packages/platform-client/src/index.ts
  - [ ] Implement PlatformClient interface per Architecture §2.31.4
  - [ ] getEntitlements(), checkModuleAccess(), checkUserQuota(), getTenantStatus()
- [ ] Implement entitlement caching (AC: #1)
  - [ ] Redis cache (production) or in-memory LRU (development)
  - [ ] 5-minute TTL on entitlements
  - [ ] Cache key: `platform:entitlements:{tenantId}`
- [ ] Implement AI quota methods (AC: #3)
  - [ ] checkAiQuota() — live call, no cache
  - [ ] recordAiUsage() — async, queued, zero-loss
- [ ] Implement cache invalidation (AC: #4)
  - [ ] invalidateCache(tenantId) — delete from Redis/LRU
  - [ ] Called by webhook handler
- [ ] Implement circuit breaker (AC: #5)
  - [ ] If Platform API unreachable for >10s, serve stale cache
  - [ ] Return `degraded: true` flag in response
  - [ ] Log circuit breaker state changes
- [ ] Implement webhook listener route (AC: #6)
  - [ ] POST /webhooks/platform on ERP API
  - [ ] Validate internal service token
  - [ ] Parse event: tenant.suspended, tenant.plan_changed, tenant.quota_warning
  - [ ] Route to appropriate handler (cache invalidation, banner display, etc.)
- [ ] Write tests (AC: #1-#6)
  - [ ] Test caching and TTL expiry
  - [ ] Test circuit breaker behaviour
  - [ ] Test webhook event processing

**FR/NFR:** FR219-FR222 (ERP runtime integration — entitlements, module access, webhook invalidation, circuit breaker); NFR51 (<30s cache invalidation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.4 Platform Client SDK, §2.31.5 ERP Integration Points | PlatformClient interface, TenantEntitlements type, caching strategy, circuit breaker, webhook listener |
| API Contracts | §20.1 Entitlements, §20.3 Webhooks | GET /platform/tenants/:id/entitlements response schema, webhook payload format |
| Data Models | §5 Platform Database Models | TenantEntitlements derived from Tenant + Plan + TenantModuleOverride + TenantFeatureFlag |
| State Machines | §20.1 Tenant Lifecycle | Tenant status determines entitlement: SUSPENDED blocks login, READ_ONLY blocks writes |
| Event Catalog | §19 Platform Admin Events, §ERP Webhook Delivery | tenant.suspended, tenant.plan_changed, tenant.quota_warning events delivered via webhook |
| Business Rules | §14b BR-PLT-019 to BR-PLT-021 | ERP must check at login, degrade gracefully if unreachable, deny module access if not in plan |
| UX Design Spec | N/A | N/A — SDK is backend infrastructure |
| Project Context | §8b Platform Layer Architecture — Platform Client SDK | 5-min TTL, webhook-invalidated, circuit breaker serves stale cache, ERP never crashes due to Platform outage |

---

### Story E3b.S5: Plan & Billing Management

**User Story:** As a platform administrator, I want to manage subscription plans and track billing status per tenant, so that I can enforce plan limits and handle payment escalation.

**Acceptance Criteria:**
1. GIVEN PLATFORM_ADMIN role WHEN I call POST /admin/plans with plan data THEN a new Plan is created with code, displayName, maxUsers, maxCompanies, monthlyAiTokenAllowance, aiHardLimit, enabledModules, apiRateLimit
2. GIVEN PLATFORM_ADMIN role WHEN I call POST /admin/tenants/:id/assign-plan with a new planId THEN the tenant's plan is changed, a `tenant.plan_changed` webhook is pushed to the ERP, and a PlatformAuditLog entry is created
3. GIVEN a tenant's billing status WHEN GET /admin/tenants/:id/billing is called THEN it returns stripeCustomerId, subscriptionStatus, currentPeriodEnd, gracePeriodDays, lastPaymentAt, dunningLevel, and current enforcementAction
4. GIVEN billing enforcement escalation WHEN a tenant's payment becomes overdue THEN the system progresses through NONE->WARNING->READ_ONLY->SUSPENDED based on configurable dunning thresholds per BR-PLT-004
5. GIVEN a tenant in READ_ONLY enforcement WHEN the ERP checks entitlements THEN write operations are blocked and a billing notice is shown (BR-PLT-005)
6. GIVEN a plan change WHEN it takes effect THEN the new module entitlements apply immediately after the webhook invalidates the ERP cache (BR-PLT-006)

**Key Tasks:**
- [ ] Implement Plan CRUD routes (AC: #1)
  - [ ] GET /admin/plans — list all plans
  - [ ] POST /admin/plans — create plan
  - [ ] PATCH /admin/plans/:id — update plan limits/modules
  - [ ] Plan code uniqueness enforcement
- [ ] Implement plan assignment (AC: #2, #6)
  - [ ] POST /admin/tenants/:id/assign-plan
  - [ ] Update tenant.planId
  - [ ] Push tenant.plan_changed webhook
  - [ ] Create PlatformAuditLog entry
- [ ] Implement billing status endpoints (AC: #3)
  - [ ] GET /admin/tenants/:id/billing
  - [ ] Return TenantBilling record with all fields
- [ ] Implement billing enforcement engine (AC: #4, #5)
  - [ ] PATCH /admin/tenants/:id/billing/enforcement
  - [ ] Enforcement state machine: NONE->WARNING->READ_ONLY->SUSPENDED
  - [ ] Push billing.enforcement_changed webhook on transitions
  - [ ] Background job for automated dunning escalation
- [ ] Implement TenantAiQuota management (AC: #1)
  - [ ] GET /admin/tenants/:id/ai/quota
  - [ ] PATCH /admin/tenants/:id/ai/quota — update allowance, soft/hard limits
- [ ] Write tests (AC: #1-#6)
  - [ ] Plan CRUD
  - [ ] Plan assignment with webhook push
  - [ ] Billing enforcement transitions
  - [ ] Audit logging for all actions

**FR/NFR:** FR201-FR204 (plan management, billing, enforcement, runtime limits); NFR46 (<50ms entitlement checks), NFR51 (webhook <30s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.2 Platform Database Schema | Plan model, TenantBilling model, EnforcementAction enum |
| API Contracts | §21.4 Plans & Billing, §21.5 AI Usage & Quotas | Plan CRUD, assign-plan, billing status, enforcement controls, quota management |
| Data Models | §5 Platform Database Models — Plan, TenantBilling, TenantAiQuota | Plan fields (maxUsers, enabledModules, aiHardLimit), billing fields (dunningLevel, enforcementAction) |
| State Machines | §20.2 Billing Enforcement Lifecycle | NONE->WARNING->READ_ONLY->SUSPENDED with triggers, guards, and ERP impact |
| Event Catalog | §19 Platform Admin Events | tenant.plan_changed, billing.payment_received, billing.payment_failed, billing.enforcement_changed |
| Business Rules | §14b BR-PLT-004 to BR-PLT-006 | Billing escalation, READ_ONLY blocks writes, plan change immediate effect |
| UX Design Spec | §Platform Admin Portal — Navigation | Plans section, Billing section (overview, enforcement controls) |
| Project Context | §8b Platform Layer Architecture | ERP checks enforcementAction from cached entitlements before every write |
# Tier 1: Core Platform

> Epics E4 through E13b. Dependencies: Tier 0 (E0-E3b) must be complete. All stories assume companyId scoping, translation keys for user-facing strings, and database-per-tenant isolation are in place from Tier 0.

---

## Epic E4: i18n Infrastructure

**Tier:** 1 | **Dependencies:** E2 (Auth + Multi-Company RBAC) | **FRs:** FR178-FR180 | **NFRs:** NFR41 (TypeScript strict)

---

### Story E4.S1: Translation Key System

**User Story:** As a developer, I want a centralised translation key system with `t()` helper and English locale files, so that all user-facing strings are internationalisation-ready from day one.

**Acceptance Criteria:**
1. GIVEN the web application is loaded WHEN any UI component renders a user-facing string THEN it uses the `t('namespace.key')` helper, never a hardcoded string
2. GIVEN an English locale file exists at `locales/en.json` WHEN a translation key is resolved THEN the English text is returned
3. GIVEN a translation key that does not exist in the current locale WHEN the `t()` helper is called THEN it falls back through the chain: user locale -> company locale -> `en`, and logs a missing-key warning in development mode
4. GIVEN the React application WHEN `t()` is called with interpolation parameters THEN variables are substituted correctly (e.g., `t('validation.required', { field: t('field.customerName') })` returns "Customer Name is required")
5. GIVEN a developer adds a new UI component WHEN they use a hardcoded English string instead of `t()` THEN the ESLint rule `no-raw-text` flags it as an error

**Key Tasks:**
- [ ] Install and configure i18next (or react-intl) with React integration in `apps/web` (AC: #1, #2)
  - [ ] Create `packages/i18n` shared package for locale types and key registry
  - [ ] Configure i18next provider wrapping the React app root
  - [ ] Set up namespace-based key organisation (e.g., `common`, `validation`, `finance`, `ar`)
- [ ] Create English base locale file structure at `packages/i18n/locales/en/` (AC: #2)
  - [ ] Create `common.json` with shared labels (Save, Cancel, Delete, Confirm, etc.)
  - [ ] Create `validation.json` with validation message templates
  - [ ] Create `navigation.json` with module and page names
- [ ] Implement fallback chain: user language -> company language -> `en` (AC: #3)
  - [ ] Read user locale preference from auth context
  - [ ] Read company default locale from company profile
  - [ ] Configure i18next fallback order
  - [ ] Add missing-key logging in development mode
- [ ] Implement interpolation support and pluralisation rules (AC: #4)
- [ ] Add ESLint rule to prevent hardcoded strings in JSX/TSX (AC: #5)
  - [ ] Configure `eslint-plugin-i18next` or custom rule
  - [ ] Add to shared ESLint config in `packages/eslint-config`

**FR/NFR:** FR178; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.1 State Management | React app structure, Vite + React 19 |
| API Contracts | §1 Overview | N/A for this story — frontend only |
| Data Models | §3.1 System Module | CompanyProfile.baseCurrencyCode, timezone |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Design System Foundation | All UI text via translation keys |
| Project Context | §3 i18n / Localization Infrastructure | `t('key')` pattern, fallback chain, English-only MVP |

---

### Story E4.S2: Backend i18n

**User Story:** As a developer, I want API error messages, validation messages, and system messages to use translation keys, so that the backend is language-agnostic and ready for future locale support.

**Acceptance Criteria:**
1. GIVEN a validation error occurs on the API WHEN the error response is returned THEN the `message` field contains a translation key (e.g., `"validation.required"`) with parameters, not a hardcoded English string
2. GIVEN the API returns a structured error WHEN the frontend receives it THEN it can resolve the translation key via the `t()` helper to display the localised message
3. GIVEN a system-generated message (e.g., audit log description, notification text) WHEN it is persisted to the database THEN it stores a translation key and parameters, not rendered text
4. GIVEN a backend service needs to format a user-facing message WHEN it calls the message formatting utility THEN it produces a structured `{ key: string, params?: Record<string, string> }` object

**Key Tasks:**
- [ ] Create `packages/i18n` backend utilities for message key construction (AC: #1, #4)
  - [ ] Define `TranslationMessage` type: `{ key: string; params?: Record<string, string> }`
  - [ ] Create helper functions: `validationMsg()`, `errorMsg()`, `systemMsg()`
- [ ] Update `AppError` and `ValidationError` classes to carry translation keys (AC: #1, #2)
  - [ ] Modify error response envelope to include `messageKey` and `messageParams`
  - [ ] Ensure `details` field-level errors also use translation keys
- [ ] Update Zod validation error transformer to emit translation keys (AC: #1)
  - [ ] Map Zod error codes to translation keys (e.g., `ZodIssueCode.too_small` -> `"validation.minLength"`)
- [ ] Create backend English locale file for server-side message rendering (AC: #3)
  - [ ] Used only for email rendering and PDF generation where server must produce final text

**FR/NFR:** FR178; NFR41, NFR45

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4 API & Communication Patterns | Error response envelope, Zod validation |
| API Contracts | §1 Overview, Common Error Codes | Error envelope `{ code, message, details }` |
| Data Models | N/A | N/A — no model changes |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | N/A | N/A — backend story |
| Project Context | §3 i18n / Localization Infrastructure | Translation key system, all strings via `t()` |

---

### Story E4.S3: Number/Date/Currency Formatting

**User Story:** As a user, I want numbers, dates, and currency values to be formatted according to my locale settings, so that financial data is displayed in a familiar format.

**Acceptance Criteria:**
1. GIVEN a user with locale `en-GB` WHEN a monetary value of 1234.56 GBP is displayed THEN it renders as "£1,234.56"
2. GIVEN a user with locale `en-GB` WHEN a date of 2026-02-17 is displayed THEN it renders as "17/02/2026" (DD/MM/YYYY)
3. GIVEN a currency with `minorUnit = 0` (e.g., JPY) WHEN an amount is displayed THEN it shows no decimal places
4. GIVEN the `Intl` API WHEN formatting numbers THEN it uses the user's locale for thousands separator and decimal point
5. GIVEN a formatting utility WHEN called from both web and mobile apps THEN it produces consistent output (shared package)

**Key Tasks:**
- [ ] Create `packages/shared/src/formatters/` with locale-aware formatters (AC: #1, #2, #4, #5)
  - [ ] `formatCurrency(amount: Decimal, currencyCode: string, locale: string): string`
  - [ ] `formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string`
  - [ ] `formatDate(date: Date | string, locale: string, format?: 'short' | 'medium' | 'long'): string`
  - [ ] `formatPercent(value: number, locale: string): string`
- [ ] Integrate `Currency.minorUnit` from data model for decimal place control (AC: #3)
  - [ ] Fetch currency metadata (minorUnit, symbol) and cache in React Query
- [ ] Create React hooks: `useFormatCurrency()`, `useFormatDate()`, `useFormatNumber()` (AC: #1, #2)
  - [ ] Hooks read current locale from i18n context
- [ ] Write unit tests for edge cases: JPY (0 decimals), BHD (3 decimals), negative amounts (AC: #3)

**FR/NFR:** FR180; NFR38 (fixed-point decimal)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.1 Monetary Value Representation | Decimal(19,4), no floating-point |
| API Contracts | §1 Data Conventions | Monetary as string Decimal(19,4), dates ISO 8601 |
| Data Models | §3.1 System Module | Currency.minorUnit, Currency.symbol |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §14 Implicit Rules | IMP-002: All monetary fields Decimal(19,4) |
| UX Design Spec | §Design System Foundation | Consistent number/date formatting across all screens |
| Project Context | §3 i18n / Localization Infrastructure | `Intl` API, locale-based formatting |

---

## Epic E5: AI Orchestration

**Tier:** 1 | **Dependencies:** E3b (Platform API + AI Gateway), E4 (i18n) | **FRs:** FR1-FR10, FR153-FR156 | **NFRs:** NFR1 (AI <3s), NFR16 (AI never auto-executes), NFR21 (AI degradation safe), NFR47 (AI Gateway <100ms)

---

### Story E5.S1: AI Service Layer

**User Story:** As a developer, I want a structured AI service layer that integrates with Claude via the AI Gateway, manages prompt templates, and parses responses, so that all ERP modules can leverage AI capabilities through a consistent interface.

**Acceptance Criteria:**
1. GIVEN an AI request from any module WHEN the service layer processes it THEN the request is routed through the AI Gateway (`packages/ai-gateway`) which performs quota check, model selection, and usage recording
2. GIVEN a registered AI prompt template WHEN the AI service resolves it THEN parameters are populated from entity data, context cache, and user input before sending to the model
3. GIVEN the AI model returns a response WHEN the service layer parses it THEN structured data (proposed records, answers, action proposals) is extracted and typed
4. GIVEN streaming is enabled for a request WHEN the model generates tokens THEN they are forwarded to the client in real-time via WebSocket or SSE
5. GIVEN the AI Gateway is unreachable or returns an error WHEN an AI request is made THEN the system degrades gracefully — traditional UI remains fully functional, and a user-friendly error message is shown
6. GIVEN an AI request completes WHEN usage is recorded THEN the AI Gateway logs `TenantAiUsage` with model, tokens, cost estimate, and feature key

**Key Tasks:**
- [ ] Implement `AiOrchestrator` service in `api/src/ai/orchestrator.ts` (AC: #1)
  - [ ] Accept AI requests with intent, context, and user message
  - [ ] Route through AI Gateway for quota check and model invocation
  - [ ] Handle model routing: Opus for complex analysis, Sonnet for standard tasks, Haiku for extraction
- [ ] Implement `PromptManager` service in `api/src/ai/prompt-manager.ts` (AC: #2)
  - [ ] Load `AiPrompt` from database with active version
  - [ ] Resolve parameters: entity lookups, query results, context cache, user input, computed values
  - [ ] Compile system prompt and user message with Handlebars-style substitution
- [ ] Implement `ResponseParser` in `api/src/ai/response-formatter.ts` (AC: #3)
  - [ ] Parse structured output (JSON mode) for record creation proposals
  - [ ] Parse natural language responses for conversational answers
  - [ ] Extract confidence scores from AI output
- [ ] Implement streaming support in orchestrator (AC: #4)
  - [ ] Use Anthropic SDK streaming mode
  - [ ] Forward chunks to WebSocket handler
- [ ] Implement graceful degradation and error handling (AC: #5)
  - [ ] Circuit breaker pattern for AI Gateway calls
  - [ ] Fallback to traditional UI notification when AI unavailable
  - [ ] Emit `ai.degraded` event for monitoring
- [ ] Implement usage recording via AI Gateway (AC: #6)

**FR/NFR:** FR1, FR2, FR4, FR5, FR10; NFR1, NFR16, NFR21, NFR47

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure & Orchestration | 7 subsystems: Model Registry, Prompt Manager, Agent Registry, Orchestrator, Context Engine, Guardrails, Tool Executor |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | WS /ai/chat, POST /ai/chat/message, POST /ai/suggestions |
| Data Models | N/A | AiModel, AiPrompt, AiPromptVersion, AiAgent (defined in Architecture §6.1-6.3) |
| State Machines | N/A | N/A — AI layer has no formal state machine |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` event |
| Business Rules | §14 Implicit Rules | IMP-005: AI never auto-executes; IMP-006: AI degradation safe |
| UX Design Spec | §AI Interaction Model | "Told, Shown, Approve, Done" paradigm |
| Project Context | §8b Platform Layer Architecture | AI Gateway mandatory routing, quota check flow |

---

### Story E5.S2: AI Chat Session Management

**User Story:** As a user, I want to have multi-turn conversations with the AI assistant via WebSocket, with persistent chat history and session management, so that I can have contextual, ongoing interactions.

**Acceptance Criteria:**
1. GIVEN a user opens the Co-Pilot drawer WHEN a WebSocket connection is established THEN the connection authenticates via JWT and associates with the user's tenant and company context
2. GIVEN a user sends a message WHEN the AI processes it THEN the response streams back token-by-token with a typing indicator until complete
3. GIVEN an active conversation WHEN the user sends a follow-up message THEN the AI has full context of the previous messages in the session (multi-turn)
4. GIVEN a user creates a new chat session WHEN they click "+ New Chat" THEN a new `AiConversation` record is created and the AI starts fresh while retaining user/tenant awareness
5. GIVEN a user returns to the application WHEN they open the Co-Pilot drawer THEN their previous conversations are listed with auto-generated titles, most recent first
6. GIVEN an HTTP fallback is needed (WebSocket unavailable) WHEN the user sends a message via POST THEN the response is returned as a complete message (non-streaming)

**Key Tasks:**
- [ ] Implement WebSocket handler in `api/src/ai/websocket.handler.ts` (AC: #1, #2)
  - [ ] Socket.io connection with JWT authentication
  - [ ] Tenant/company context injection from auth token
  - [ ] Stream chunk forwarding from AI Gateway to client
- [ ] Implement `AiConversation` and `AiMessage` persistence (AC: #3, #4, #5)
  - [ ] CRUD for conversation sessions
  - [ ] Store messages with role (user/assistant), content, metadata
  - [ ] Auto-generate conversation titles from first user message
- [ ] Implement multi-turn context assembly (AC: #3)
  - [ ] Build message history array from conversation messages
  - [ ] Apply context window limits (trim old messages when approaching token limit)
  - [ ] Include current page context in system message
- [ ] Implement HTTP fallback endpoint `POST /ai/chat/message` (AC: #6)
- [ ] Implement `GET /ai/chat/history` and `POST /ai/chat/sessions` endpoints (AC: #4, #5)

**FR/NFR:** FR1, FR4, FR7; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure, §5.4 Dual Interface Pattern | WebSocket handler, Co-Pilot Dock interaction model |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | WS /ai/chat, GET /ai/chat/history, POST /ai/chat/sessions |
| Data Models | N/A | AiConversation, AiMessage (Architecture §6) |
| State Machines | N/A | N/A — no formal state machine |
| Event Catalog | §17 AI Orchestration Events | AI Context Engine subscribes to all business events |
| Business Rules | §13 Communications Rules | BR-COM-013: AI actions require user confirmation |
| UX Design Spec | §AI Interaction Model — Co-Pilot Dock | 380px drawer, chat history selector, streaming responses |
| Project Context | §8b Platform Layer Architecture | AI Gateway routing |

---

### Story E5.S3: AI Action Framework

**User Story:** As a user, I want the AI to propose actions (create invoice, send email, update record) that I can review and confirm or reject before execution, so that I maintain control over all AI-initiated changes.

**Acceptance Criteria:**
1. GIVEN the AI determines an action is needed (e.g., "create invoice for Acme") WHEN it formulates the action THEN it sends an `action_proposal` message with type, description, entity type, preview data, and confidence score
2. GIVEN the user receives an action proposal WHEN they click "Confirm" THEN the action executes through the standard API (same path as manual creation) and a `record_created` message is sent back
3. GIVEN the user receives an action proposal WHEN they click "Reject" THEN the action is cancelled, no data is modified, and the AI acknowledges the rejection
4. GIVEN a financial action (create invoice, post journal, process payment) WHEN the AI proposes it THEN user confirmation is ALWAYS required regardless of confidence score
5. GIVEN an action is executed via AI WHEN the audit trail records it THEN it includes `isAiAction: true`, `aiConfidence`, and the conversation ID

**Key Tasks:**
- [ ] Implement `ActionPlanner` in `api/src/ai/action-planner.ts` (AC: #1)
  - [ ] Parse AI structured output to identify proposed actions
  - [ ] Create action proposal objects with preview data
  - [ ] Calculate confidence scores per field
- [ ] Implement action confirmation/rejection WebSocket messages (AC: #2, #3)
  - [ ] Handle `action_confirm` client message type
  - [ ] Handle `action_reject` client message type
  - [ ] Execute confirmed actions via standard service layer (not bypassing validation)
- [ ] Implement guardrails in `api/src/ai/guardrails.ts` (AC: #4)
  - [ ] Define financial action types that always require confirmation
  - [ ] Block auto-execution for create/modify/delete operations
  - [ ] Log all guardrail enforcement decisions
- [ ] Integrate audit trail with AI metadata (AC: #5)
  - [ ] Extend audit service to accept `isAiAction`, `aiConfidence`, `conversationId`
  - [ ] Emit `ai.action.executed` event after successful execution

**FR/NFR:** FR6, FR8, FR9; NFR16

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | Guardrails subsystem, Tool Executor |
| API Contracts | §3.6 AI Endpoints | `action_proposal`, `action_confirm`, `action_reject` message types |
| Data Models | N/A | AiAgent.guardrails JSON field |
| State Machines | N/A | N/A — actions follow entity-specific state machines |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` |
| Business Rules | §14 Implicit Rules | IMP-005: AI never auto-executes financial transactions; BR-COM-013 |
| UX Design Spec | §Core User Experience | "Told, Shown, Approve, Done" — user always approves |
| Project Context | §8b Platform Layer Architecture | AI Gateway mandatory routing |

---

### Story E5.S4: AI Predictions

**User Story:** As a finance manager, I want AI-powered cash flow forecasting, anomaly detection, and duplicate detection with confidence scores, so that I can proactively manage financial risk.

**Acceptance Criteria:**
1. GIVEN a cash flow forecast request with date range WHEN the AI processes it THEN it returns period-by-period projections including opening balance, inflows, outflows, net flow, and closing balance with source breakdowns
2. GIVEN the forecast identifies a period with negative balance WHEN the result is returned THEN an alert of type `NEGATIVE_BALANCE` is included with the affected period and suggested action
3. GIVEN an anomaly detection request WHEN the AI analyses recent transactions THEN it flags suspicious patterns (duplicate payments, unusual amounts, timing anomalies) with confidence scores
4. GIVEN a duplicate detection request for an entity type WHEN the AI processes it THEN it returns potential duplicate pairs with similarity scores and field-by-field comparison
5. GIVEN any prediction result WHEN the confidence score is returned THEN it follows the standard thresholds: >=90% green/auto-suggest, 70-89% amber/review, <70% red/manual

**Key Tasks:**
- [ ] Implement `POST /ai/predict/cash-flow` endpoint (AC: #1, #2)
  - [ ] Gather AR (outstanding invoices), AP (outstanding bills), committed POs, recurring payments
  - [ ] Send financial context to AI for pattern analysis and projection
  - [ ] Parse structured forecast response with period breakdowns and alerts
- [ ] Implement `POST /ai/detect/anomalies` endpoint (AC: #3)
  - [ ] Collect recent transaction data (configurable lookback period)
  - [ ] Define anomaly patterns: duplicate amounts, unusual timing, round-number bias
  - [ ] Return flagged items with anomaly type and confidence
- [ ] Implement `POST /ai/detect/duplicates` endpoint (AC: #4)
  - [ ] Accept entity type parameter (Customer, Supplier, Contact)
  - [ ] Use AI for fuzzy matching on name, address, VAT number, bank details
  - [ ] Return duplicate pairs with per-field similarity scores
- [ ] Implement `GET /ai/confidence/:entityType/:entityId` endpoint (AC: #5)
  - [ ] Retrieve stored confidence scores for AI-created entities
- [ ] Implement `POST /ai/explain` endpoint for explainability (AC: #5)
  - [ ] Return human-readable explanation of AI reasoning for a given decision

**FR/NFR:** FR153, FR155, FR156; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | AI agents for forecasting, anomaly detection |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | POST /ai/predict/cash-flow, POST /ai/detect/anomalies, POST /ai/detect/duplicates, GET /ai/confidence, POST /ai/explain |
| Data Models | N/A | No dedicated prediction models — results returned inline |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` for prediction requests |
| Business Rules | §14 Implicit Rules | IMP-005, IMP-006 |
| UX Design Spec | §Key Design Challenges | Confidence scoring: >=90% green, 70-89% amber, <70% red |
| Project Context | §8b Platform Layer Architecture | AI Gateway quota check before every AI call |

---

### Story E5.S5: Daily Briefing & Smart Suggestions

**User Story:** As a user, I want a personalised daily briefing based on my role and contextual smart suggestions when viewing records, so that I start each day informed and always have relevant next actions available.

**Acceptance Criteria:**
1. GIVEN a user with role "Finance Manager" WHEN they request the daily briefing THEN it includes: pending approvals, overdue invoices, cash position, upcoming payment runs, and anomaly alerts
2. GIVEN a user with role "Business Owner" WHEN they request the daily briefing THEN it includes: revenue vs prior period, overdue receivables, pending approvals across all modules, and AI-detected opportunities
3. GIVEN a briefing is generated WHEN each item is displayed THEN it includes actionable links (one-tap approve, chase, review) and period comparison data (delta/trend)
4. GIVEN a user is viewing a specific record (e.g., Customer Detail) WHEN AI suggestions are requested THEN contextual suggestions are returned (e.g., "Invoice this customer", "Show payment history", "Credit check")
5. GIVEN the briefing generation runs WHEN the scheduled job executes THEN it completes within the AI response time target and caches the result for the day

**Key Tasks:**
- [ ] Implement `GET /ai/briefing` endpoint (AC: #1, #2, #3)
  - [ ] Create `BriefingEngine` in `api/src/ai/briefing-engine.ts`
  - [ ] Define role-based briefing templates (Owner, Finance, Sales, HR, Warehouse, Admin)
  - [ ] Gather cross-module data: pending approvals, overdue items, cash position, stock alerts
  - [ ] Generate briefing via AI with structured output format
- [ ] Implement BullMQ scheduled job for daily briefing pre-generation (AC: #5)
  - [ ] Run at configurable time (default 06:00 UTC)
  - [ ] Cache briefing in Redis with 24h TTL
  - [ ] Refresh on-demand if stale
- [ ] Implement `POST /ai/suggestions` endpoint (AC: #4)
  - [ ] Accept current page context (entityType, entityId, pageRoute)
  - [ ] Return role-based and context-based suggestion chips
  - [ ] Include preset prompts from `AiAgent.triggerConfig`
- [ ] Create briefing response schema with actionable items (AC: #3)
  - [ ] Each item: title, description, metric (with delta), action buttons, entity link

**FR/NFR:** FR3, FR5; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | BriefingEngine, scheduled job, Redis cache |
| API Contracts | §2.6 AI & Chat | GET /ai/briefing, POST /ai/suggestions |
| Data Models | N/A | No dedicated briefing models — generated and cached |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §17 AI Orchestration Events | AI Context Engine subscribes to all events for briefing data |
| Business Rules | §14 Implicit Rules | IMP-006: AI degradation must not break traditional UI |
| UX Design Spec | §User Journey Flows, Journey 1 | Morning Briefing flow, role-based content, one-tap actions |
| Project Context | §8b Platform Layer Architecture | AI Gateway routing for briefing generation |

---

## Epic E6: Web Frontend Shell + Mobile Scaffold

**Tier:** 1 | **Dependencies:** E2 (Auth), E4 (i18n) | **FRs:** UX infrastructure (no specific FRs) | **NFRs:** NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

---

### Story E6.S1: React App Bootstrap

**User Story:** As a developer, I want a fully configured React application with routing, state management, styling, and auth integration, so that all subsequent frontend stories have a solid foundation.

**Acceptance Criteria:**
1. GIVEN the `apps/web` package WHEN it is built THEN it produces an optimised Vite + React 19 + TypeScript application with strict mode enabled
2. GIVEN the application loads WHEN the user is not authenticated THEN they are redirected to the login page
3. GIVEN the user authenticates WHEN the JWT is received THEN it is stored securely and used for all API requests via the shared API client
4. GIVEN the application WHEN React Query is configured THEN it provides caching, background refetch, and optimistic update capabilities for all server state
5. GIVEN Zustand stores WHEN client-side state is needed THEN stores exist for: auth state, sidebar state, active company, user preferences, and Co-Pilot drawer state

**Key Tasks:**
- [ ] Scaffold `apps/web` with Vite + React 19 + TypeScript strict (AC: #1)
  - [ ] Configure `tsconfig.json` with strict mode
  - [ ] Configure Vite with path aliases (`@/components`, `@/features`, etc.)
  - [ ] Install and configure Tailwind CSS 4 + shadcn/ui
- [ ] Configure TanStack Router for file-based routing with lazy-loaded module routes (AC: #2)
  - [ ] Set up route-level code splitting per module
  - [ ] Create `ModuleGuard` component for module access gating
  - [ ] Create `AuthGuard` component for authentication requirement
- [ ] Configure TanStack Query (React Query) for server state management (AC: #4)
  - [ ] Set default stale time, cache time, and retry configuration
  - [ ] Create query key factory pattern for consistent cache management
  - [ ] Set up API client integration from `packages/api-client`
- [ ] Create Zustand stores for client state (AC: #5)
  - [ ] `useAuthStore`: user, token, login/logout, company context
  - [ ] `useSidebarStore`: open/closed, active module, collapsed sections
  - [ ] `useCopilotStore`: drawer open/closed, active conversation, streaming state
- [ ] Integrate auth flow with JWT storage and API client (AC: #2, #3)
  - [ ] Token refresh on 401 responses
  - [ ] Secure token storage (httpOnly cookie or in-memory)
  - [ ] Redirect to login on auth failure

**FR/NFR:** N/A (infrastructure); NFR41, NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | Vite + React 19, TanStack Query + Zustand, React Hook Form + Zod |
| API Contracts | §1 Overview | JWT Bearer auth, response envelope, cursor pagination |
| Data Models | N/A | N/A — frontend infrastructure |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Design System Foundation | Tailwind CSS 4, Shadcn UI, purple theme |
| Project Context | §1 Multi-Company Architecture | Company switcher in auth state |

---

### Story E6.S2: Navigation Shell

**User Story:** As a user, I want a sidebar with module groups and company switcher, a top bar with user menu, notifications bell, and search, so that I can navigate the ERP efficiently.

**Acceptance Criteria:**
1. GIVEN the authenticated user WHEN the app shell renders THEN a sidebar displays module groups (Finance, Sales, Purchasing, etc.) filtered by the user's enabled modules
2. GIVEN the sidebar WHEN a module group is expanded THEN sub-items (entities within the module) are shown with icons and labels
3. GIVEN the sidebar WHEN the viewport is below 1024px THEN the sidebar collapses to an icon-only view with hover-to-expand behaviour
4. GIVEN the top bar WHEN it renders THEN it shows: hamburger menu (mobile), company logo/name, unified search input, chat button, notifications bell (with unread count badge), and user avatar menu
5. GIVEN a multi-company tenant WHEN the user clicks the company switcher in the sidebar THEN a dropdown lists available companies and switching updates the company context globally
6. GIVEN the user avatar menu WHEN clicked THEN it shows: user name, role, company name, "My Profile", "Preferences", "Sign Out"

**Key Tasks:**
- [ ] Build `<AppSidebar>` component in `apps/web/src/components/layout/` (AC: #1, #2)
  - [ ] Module groups with expand/collapse
  - [ ] Icons from Lucide icon set (shadcn default)
  - [ ] Active route highlighting
  - [ ] Filter modules by user's `enabledModules` from entitlements
- [ ] Build `<CompanySwitcher>` component (AC: #5)
  - [ ] Fetch user's accessible companies from API
  - [ ] Switch company context (updates Zustand store + API header)
  - [ ] Show current company name in sidebar header
- [ ] Build `<AppHeader>` component with top bar elements (AC: #4)
  - [ ] Unified search input placeholder (wired in E6.S5)
  - [ ] Chat button (wired in E6.S5)
  - [ ] Notifications bell with badge (wired in E9)
  - [ ] User avatar dropdown menu
- [ ] Implement responsive sidebar collapse (AC: #3)
  - [ ] Desktop (>=1280px): full sidebar
  - [ ] Tablet (1024-1279px): icon-only, hover to expand
  - [ ] Mobile (<1024px): off-canvas drawer with hamburger toggle
- [ ] Build user avatar dropdown menu (AC: #6)

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | `components/layout/` — App shell, sidebar, header, breadcrumbs |
| API Contracts | §2.2 System Module | Company endpoints for switcher |
| Data Models | §3.1 System Module | CompanyProfile (name, logo) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Standardised Screen Templates | Sidebar navigation, topbar layout, responsive collapse |
| Project Context | §1 Multi-Company Architecture | Company switcher, companyId context |

---

### Story E6.S3: Screen Template System

**User Story:** As a developer, I want reusable page template components for all 8 screen types (T1-T8), so that every screen in the ERP follows a consistent layout without custom page designs.

**Acceptance Criteria:**
1. GIVEN a developer building an entity list screen WHEN they use `<EntityListPage>` THEN it provides: breadcrumb, title, action buttons, saved view selector, search, filter bar, data table with selection, pagination, and batch action bar
2. GIVEN a developer building a record detail screen WHEN they use `<RecordDetailPage>` THEN it provides: breadcrumb, title with status badge, action bar, tabbed content area, and related entities section
3. GIVEN a developer building a header+lines document WHEN they use `<HeaderLinesPage>` THEN it provides: header section with tabs, editable line items table with add/remove, totals section, and event flow tracker
4. GIVEN template T4 (Briefing) WHEN it renders THEN it provides a card-based layout for briefing items with action buttons and period comparisons
5. GIVEN templates T5 (Board), T6 (Wizard), T7 (Settings), T8 (Report) WHEN they render THEN each provides the correct standardised layout per the UX Design Spec

**Key Tasks:**
- [ ] Build `<EntityListPage>` (T1) template component (AC: #1)
  - [ ] Props: title, entityType, columns config, actions config, filters config
  - [ ] Integrated data table with TanStack Table
  - [ ] Row selection with batch action bar
  - [ ] Cursor-based pagination
  - [ ] Search and filter integration points
- [ ] Build `<RecordDetailPage>` (T2) template component (AC: #2)
  - [ ] Props: title, entityType, statusConfig, tabs config, actions config
  - [ ] Status badge with semantic colours
  - [ ] Tabbed content area
  - [ ] Related entities sidebar/section
- [ ] Build `<HeaderLinesPage>` (T3) template component (AC: #3)
  - [ ] Props: headerFields, lineColumns, totalsConfig, statusConfig
  - [ ] Editable header section with tabs
  - [ ] Line items table with inline editing, add/delete rows
  - [ ] Auto-calculated totals (subtotal, VAT, total)
  - [ ] Event flow tracker component
- [ ] Build remaining templates (AC: #4, #5)
  - [ ] `<BriefingPage>` (T4): card grid, action buttons, metrics with delta
  - [ ] `<BoardPage>` (T5): Kanban columns with drag-and-drop
  - [ ] `<WizardPage>` (T6): step indicator, next/back, validation per step
  - [ ] `<SettingsPage>` (T7): grouped settings with save/reset
  - [ ] `<ReportPage>` (T8): parameter form, results table, AI summary slot

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | T1-T8 components, file locations in `components/templates/` |
| API Contracts | §1 Pagination | Cursor-based pagination on all list endpoints |
| Data Models | N/A | N/A — templates are generic, data-driven |
| State Machines | N/A | N/A — templates consume status from entities |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — templates are presentation layer |
| UX Design Spec | §Standardised Screen Templates | T1-T8 wireframes, use counts, responsive behaviour |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

### Story E6.S4: ActionBar Component

**User Story:** As a user, I want a consistent action bar on every record screen with primary actions, persistent tools (Attachments, Links), and a grouped overflow menu, so that I always know where to find actions regardless of which module I am in.

**Acceptance Criteria:**
1. GIVEN a record screen WHEN the action bar renders THEN it shows: primary action zone (max 2 buttons, status-driven), persistent tools zone (Attachments with count badge, Links with count badge), and overflow menu button
2. GIVEN the entity is in DRAFT status WHEN the action bar renders THEN the primary action is "Approve" (or "Save Draft") and the overflow Status Actions section shows valid next transitions only
3. GIVEN the entity has 3 attachments and 2 record links WHEN the action bar renders THEN the Attachments button shows "(3)" badge and Links button shows "(2)" badge
4. GIVEN the overflow menu WHEN opened THEN actions are grouped into 5 sections: Document Actions, Status Actions, Record Actions, AI Actions, History — with empty sections hidden
5. GIVEN an action that is invalid for the current status WHEN the overflow menu renders THEN the action is hidden entirely (not greyed out/disabled)
6. GIVEN a status change action WHEN clicked THEN a confirmation dialog appears for destructive actions (Void, Cancel) with entity name and consequence description

**Key Tasks:**
- [ ] Build `<ActionBar>` component in `apps/web/src/components/action-bar/ActionBar.tsx` (AC: #1)
  - [ ] Three zones: primary actions, persistent tools, overflow trigger
  - [ ] Accept `actionConfig` prop defining available actions per entity status
- [ ] Build status-driven action configuration system (AC: #2, #5)
  - [ ] Create `action-config.ts` with status-to-actions mapping per entity type
  - [ ] Actions appear/hide based on current entity status and user permissions
  - [ ] Maximum 2 primary actions enforced
- [ ] Build persistent tools buttons with count badges (AC: #3)
  - [ ] Attachments button with count from entity
  - [ ] Links button with count from entity
  - [ ] Click opens respective panel (E8 provides the panels)
- [ ] Build `<OverflowMenu>` component with grouped sections (AC: #4)
  - [ ] 5 sections with dividers: Document, Status, Record, AI, History
  - [ ] Sections auto-hide when no valid actions exist
  - [ ] Keyboard shortcut hints on menu items
- [ ] Implement confirmation dialogs for destructive actions (AC: #6)

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | ActionBar component, `action-bar/` directory, status-driven actions |
| API Contracts | N/A | N/A — ActionBar is frontend presentation |
| Data Models | N/A | N/A — consumes entity status from any model |
| State Machines | §1 Common Patterns | All entity state machines drive action visibility |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — ActionBar enforces state machine transitions visually |
| UX Design Spec | §The Action Bar System | Three zones, 5 overflow sections, action bar rules, per-template mapping |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

### Story E6.S5: Co-Pilot Dock

**User Story:** As a user, I want a Cmd+K header input for quick search/AI commands and a collapsible 380px right-side drawer for multi-turn AI conversations, so that I can interact with the AI assistant from any screen.

**Acceptance Criteria:**
1. GIVEN any screen WHEN the user presses Cmd+K (Mac) or Ctrl+K (Windows) THEN the unified search input in the header bar gains focus
2. GIVEN the user types in the header input WHEN the input matches entity patterns (INV-, PO-) THEN an autocomplete dropdown shows matching entities for direct navigation
3. GIVEN the user types a natural language command WHEN they press Enter THEN the Co-Pilot drawer opens (if closed) and the AI response streams in the drawer
4. GIVEN the Co-Pilot drawer WHEN opened THEN it is 380px wide on desktop, the main content area resizes, and it shows: chat selector, conversation area, quick prompts, and input area
5. GIVEN the drawer WHEN on mobile (<768px) THEN it renders as a full-screen overlay with a minimise button that shrinks to a floating pill
6. GIVEN the user is on a specific page WHEN quick prompts render THEN they are role-based and context-aware (e.g., on Invoice List: "Show Overdue", "Create Invoice")

**Key Tasks:**
- [ ] Build `<UnifiedSearch>` component in `apps/web/src/components/header/UnifiedSearch.tsx` (AC: #1, #2)
  - [ ] Cmd+K global keyboard shortcut to focus
  - [ ] Input type detection: entity search, page search, AI command
  - [ ] Autocomplete dropdown with entity results, page results, AI prompt suggestions
- [ ] Build `<CopilotDrawer>` container component (AC: #3, #4)
  - [ ] Slide-in from right, 200ms ease-out animation
  - [ ] 380px fixed width on desktop, 100% overlay on phone
  - [ ] Main content area resizes when drawer opens
  - [ ] Zustand store controls open/closed state
- [ ] Build `<CopilotChat>` conversation component (AC: #3)
  - [ ] AI messages (left-aligned, grey) and user messages (right-aligned, purple)
  - [ ] Streaming text display with typing indicator
  - [ ] Inline action buttons and data cards in AI messages
  - [ ] Links to records (navigate on click)
- [ ] Build `<ChatHistory>` selector component (AC: #4)
  - [ ] Dropdown listing previous conversations with titles
  - [ ] "+ New Chat" button
- [ ] Build `<QuickPrompts>` role-based preset chips (AC: #6)
  - [ ] Load presets from configuration (role + page context)
  - [ ] Tap to submit immediately
- [ ] Build `<CopilotInput>` text input area (AC: #3)
  - [ ] Multi-line support (Shift+Enter)
  - [ ] File drop zone for Document Understanding
  - [ ] Submit button and Enter key handling
- [ ] Implement responsive behaviour for mobile (AC: #5)

**FR/NFR:** FR1 (AI conversation), FR4 (context awareness); NFR27, NFR28, NFR30 (screen reader for AI chat)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.4 Dual Interface Pattern | Co-Pilot Dock, header input, drawer components |
| API Contracts | §2.6 AI & Chat | WS /ai/chat, GET /ai/chat/history, POST /ai/chat/sessions |
| Data Models | N/A | N/A — frontend components |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — WebSocket communication, not event bus |
| Business Rules | §13 Communications Rules | BR-COM-013: AI actions require user confirmation |
| UX Design Spec | §AI Interaction Model — Co-Pilot Dock | Header bar, drawer specs (380px, animation, sections), behaviour rules, interaction flow |
| Project Context | N/A | N/A — covered by Architecture and UX Design Spec |

---

### Story E6.S6: Mobile Scaffold

**User Story:** As a mobile user, I want a React Native app with authentication, navigation shell, and push notification setup, so that I can access AI chat, briefings, and approvals on my phone.

**Acceptance Criteria:**
1. GIVEN the `apps/mobile` package WHEN it is built THEN it produces an Expo (React Native) application with TypeScript
2. GIVEN the mobile app WHEN the user opens it unauthenticated THEN they see a login screen with optional biometric authentication (Face ID / fingerprint)
3. GIVEN the mobile app WHEN authenticated THEN a tab bar shows: Chat (primary), Briefing, Approvals, More
4. GIVEN the shared API client in `packages/api-client` WHEN the mobile app makes API calls THEN it uses the same typed client as the web app
5. GIVEN push notifications WHEN configured with Expo Push THEN the app can receive and display approval requests, briefing alerts, and stock alerts

**Key Tasks:**
- [ ] Scaffold `apps/mobile` with Expo + React Native + TypeScript (AC: #1)
  - [ ] Configure Expo Router for file-based routing
  - [ ] Install shared packages: `packages/api-client`, `packages/shared`, `packages/i18n`
- [ ] Implement auth flow with biometric option (AC: #2)
  - [ ] Login screen with email/password
  - [ ] MFA challenge screen
  - [ ] Biometric unlock via `expo-local-authentication`
  - [ ] Token storage via `expo-secure-store`
- [ ] Build tab bar navigation shell (AC: #3)
  - [ ] Chat tab (primary AI screen)
  - [ ] Briefing tab (daily briefing cards)
  - [ ] Approvals tab (pending approvals queue)
  - [ ] More tab (module quick-access grid)
- [ ] Integrate shared API client (AC: #4)
  - [ ] Configure base URL and auth headers
  - [ ] Use React Query for data fetching
- [ ] Set up Expo Push Notifications (AC: #5)
  - [ ] Register for push token on login
  - [ ] Store push token on server (user device)
  - [ ] Handle incoming push notifications with deep linking

**FR/NFR:** N/A (mobile infrastructure); NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | React Native + Expo, shared packages, tab navigation |
| API Contracts | §1 Overview | JWT Bearer auth, same API endpoints |
| Data Models | N/A | N/A — mobile scaffold |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — push notifications via BullMQ worker |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Responsive Design & Accessibility | Mobile breakpoints, touch targets (44x44px) |
| Project Context | §8 Mobile Strategy | Mobile as end-of-epic story, Expo, AI-first mobile |

---

## Epic E7: Saved Views / Filters / Columns

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR86 (saved views) | **NFRs:** NFR27 (WCAG 2.1 AA)

---

### Story E7.S1: Saved View CRUD

**User Story:** As a user, I want to create, update, and delete saved views for any entity list with scope controls (personal, role, global), so that I can customise how I browse data and share useful views with my team.

**Acceptance Criteria:**
1. GIVEN any entity list page (T1 template) WHEN the user clicks "Save View" THEN a dialog captures view name and scope (PERSONAL, ROLE, GLOBAL) and persists the current column, filter, and sort configuration
2. GIVEN a saved view exists WHEN the user selects it from the Saved View Selector dropdown THEN the list reconfigures to match the saved columns, filters, and sorting
3. GIVEN a PERSONAL view WHEN another user views the same entity list THEN they do not see the personal view in their selector
4. GIVEN a ROLE-scoped view WHEN a user with the matching role views the entity list THEN they see the view in their selector
5. GIVEN a GLOBAL view WHEN any user views the entity list THEN they see the global view in their selector
6. GIVEN a user sets a view as default WHEN they navigate to the entity list THEN the default view auto-applies

**Key Tasks:**
- [ ] Implement backend CRUD endpoints for SavedView (AC: #1)
  - [ ] `POST /views` — create saved view with columns, filters, sorting JSON
  - [ ] `PATCH /views/:id` — update view configuration
  - [ ] `DELETE /views/:id` — delete view (owner or ADMIN only)
  - [ ] `GET /views` — list views for current user (personal + matching role + global)
- [ ] Implement scope-based visibility logic (AC: #3, #4, #5)
  - [ ] PERSONAL: visible only to creator
  - [ ] ROLE: visible to all users with matching role
  - [ ] GLOBAL: visible to all users (ADMIN only to create)
- [ ] Implement default view management (AC: #6)
  - [ ] `POST /views/:id/set-default` — set as default for user + entity type
  - [ ] `GET /views/defaults` — get default views per entity type
  - [ ] Auto-apply default on page load
- [ ] Build `<SavedViewSelector>` frontend component (AC: #2)
  - [ ] Dropdown with grouped views (My Views, Team Views, Global Views)
  - [ ] Star/favourite toggle
  - [ ] "Save Current View" and "Save As" actions

**FR/NFR:** FR86; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | Saved View Selector in T1 Entity List template |
| API Contracts | §2.3 Views (Cross-cutting) | GET/POST/PATCH/DELETE /views, /views/favourites, /views/:id/set-default, /views/defaults |
| Data Models | §3.1 System Module | SavedView: userId, entityType, name, columns/filters/sorting (JSONB), scope (ViewScope enum) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no specific business rules |
| UX Design Spec | §Design Opportunities | Saved Views as power feature, AI can create views from NL |
| Project Context | N/A | N/A — covered by Architecture and UX Design Spec |

---

### Story E7.S2: Column Customization

**User Story:** As a user, I want to reorder, hide/show, resize, and pin columns on any entity list, so that I can focus on the data most relevant to my workflow.

**Acceptance Criteria:**
1. GIVEN an entity list WHEN the user opens "Manage Columns" THEN a dialog shows all available columns with checkboxes for visibility and drag handles for reorder
2. GIVEN a column is hidden WHEN the user returns to the list THEN the hidden column is not rendered in the table
3. GIVEN a column header border WHEN the user drags it THEN the column resizes and the new width persists across page refreshes
4. GIVEN a column WHEN the user selects "Pin Left" or "Pin Right" THEN the column stays fixed while other columns scroll horizontally

**Key Tasks:**
- [ ] Extend TanStack Table configuration with column visibility state (AC: #1, #2)
  - [ ] Integrate column visibility with SavedView.columns JSON
  - [ ] Build "Manage Columns" dialog with checkbox list and drag-and-drop reorder
- [ ] Implement column resize with persistence (AC: #3)
  - [ ] Use TanStack Table column sizing
  - [ ] Persist widths to SavedView or user preferences
- [ ] Implement column pinning (AC: #4)
  - [ ] Left/right pinning with sticky positioning
  - [ ] Shadow indicator on pinned columns during horizontal scroll

**FR/NFR:** FR86; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | T1 Entity List — column customisation |
| API Contracts | §2.3 Views (Cross-cutting) | Column state persisted in SavedView.columns JSON |
| Data Models | §3.1 System Module | SavedView.columns (JSONB) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Table & List Patterns | Column management, pinning, responsive table behaviour |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

### Story E7.S3: Filter Builder

**User Story:** As a user, I want to build compound filters with AND/OR logic, save filter presets, and use quick filters for common scenarios, so that I can find specific records efficiently.

**Acceptance Criteria:**
1. GIVEN an entity list WHEN the user opens the filter builder THEN they can add multiple filter conditions with field selection, operator (equals, contains, greater than, between, is empty, etc.), and value
2. GIVEN multiple filter conditions WHEN combined THEN the user can choose AND or OR logic between conditions
3. GIVEN an active filter WHEN applied THEN the list immediately refreshes showing only matching records with a visual indicator showing active filter count
4. GIVEN a filter configuration WHEN included in a saved view THEN the filters persist and re-apply when the view is loaded
5. GIVEN quick filters WHEN displayed below the search bar THEN common entity-specific filters are available as one-click toggles (e.g., "Overdue" for invoices, "Active Only" for customers)

**Key Tasks:**
- [ ] Build `<FilterBuilder>` component (AC: #1, #2)
  - [ ] Field selector dropdown (loaded from entity metadata)
  - [ ] Operator selector (contextual per field type: string, number, date, enum, boolean)
  - [ ] Value input (text, number, date picker, enum select)
  - [ ] AND/OR toggle between conditions
  - [ ] Add/remove condition rows
- [ ] Implement filter-to-Prisma-where converter on backend (AC: #3)
  - [ ] Use `filter-builder.ts` in `api/src/core/views/`
  - [ ] Convert JSON filter definition to Prisma `where` clause
  - [ ] Support nested AND/OR conditions
  - [ ] Validate field names against entity metadata
- [ ] Integrate filters with SavedView persistence (AC: #4)
  - [ ] Filters stored in SavedView.filters (JSONB)
  - [ ] Applied on view load
- [ ] Build quick filter chips for common entity-specific filters (AC: #5)
  - [ ] Configurable per entity type (e.g., Invoice: "Overdue", "This Month", "Draft Only")
  - [ ] One-click toggle, combinable with filter builder

**FR/NFR:** FR86; NFR2 (CRUD <500ms)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | Filter bar in T1, `filter-builder.ts` |
| API Contracts | §1 Common Query Parameters | `search`, `isActive` query params; filters via request body |
| Data Models | §3.1 System Module | SavedView.filters (JSONB), EntityMetadata types |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Standardised Screen Templates, T1 | Filter bar, saved view selector, quick filters |
| Project Context | N/A | N/A — covered by Architecture |

---

## Epic E8: Attachments + Notes + Record Links

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR85 (attachments), FR87 (record links) | **NFRs:** NFR2 (CRUD <500ms)

---

### Story E8.S1: Attachment Service

**User Story:** As a user, I want to upload files to any business record using presigned URLs with MIME type validation and size limits, so that I can attach supporting documents to invoices, POs, and other records.

**Acceptance Criteria:**
1. GIVEN a user wants to attach a file WHEN they request a presigned upload URL THEN the service validates MIME type against the allowlist and file size against the configured maximum (default 50MB) before returning the URL
2. GIVEN a presigned URL WHEN the browser uploads the file directly to S3/MinIO THEN the upload bypasses the application server entirely
3. GIVEN an upload completes WHEN the user confirms THEN an Attachment record is created with entityType, entityId, fileName, mimeType, fileSize, and storageUrl
4. GIVEN a user requests a file download WHEN they click on an attachment THEN a presigned download URL is generated with a configurable expiry (default 15 minutes)
5. GIVEN an executable file (`.exe`, `.bat`, `.sh`) WHEN upload is attempted THEN the request is rejected with a validation error
6. GIVEN an attachment is deleted WHEN the delete action completes THEN both the Attachment record and the S3 object are removed

**Key Tasks:**
- [ ] Implement `POST /attachments/presign` endpoint (AC: #1, #2)
  - [ ] Validate MIME type against allowlist (PDF, images, Office docs, CSV — no executables)
  - [ ] Validate file size against `SystemSetting` maximum (default 50MB)
  - [ ] Generate S3 presigned PUT URL with content-type constraint
  - [ ] Return presigned URL and upload metadata
- [ ] Implement `POST /attachments/confirm` endpoint (AC: #3)
  - [ ] Verify file exists at the S3 key
  - [ ] Create Attachment record with polymorphic entityType + entityId
  - [ ] Validate that the referenced entity exists (BR-SYS-009)
- [ ] Implement `GET /attachments/:id/download` endpoint (AC: #4)
  - [ ] Generate presigned GET URL with configurable expiry
- [ ] Implement `DELETE /attachments/:id` endpoint (AC: #6)
  - [ ] Delete S3 object and database record in transaction
  - [ ] MANAGER role required
- [ ] Implement `GET /attachments` list endpoint with entity filtering (AC: #3)
  - [ ] Filter by entityType + entityId query parameters
- [ ] Configure S3/MinIO client in the API (AC: #2)
  - [ ] Use MinIO for local development, S3 for production

**FR/NFR:** FR85; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.7 Caching Strategy | S3/MinIO for file storage |
| API Contracts | §2.5 Cross-cutting Infrastructure | POST /attachments/presign, POST /attachments/confirm, GET /attachments/:id/download, DELETE /attachments/:id, GET /attachments |
| Data Models | §3.9 Cross-Cutting Module | Attachment: entityType, entityId, fileName, mimeType, fileSize, storageUrl |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events for attachment CRUD |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-006 (file size limit), BR-SYS-007 (MIME allowlist), BR-SYS-008 (presigned URL), BR-SYS-009 (entity validation), BR-SYS-010 (cascade-aware deletion) |
| UX Design Spec | §The Action Bar System | Attachments as persistent tool with count badge |
| Project Context | N/A | N/A — covered by Architecture |

---

### Story E8.S2: Notes Service

**User Story:** As a user, I want to add typed notes (general, internal, customer-visible, system) to any business record, so that I can document conversations, decisions, and context alongside the data.

**Acceptance Criteria:**
1. GIVEN any business record WHEN a user creates a note THEN it is stored with polymorphic entityType + entityId, note type, content, and author
2. GIVEN note types WHEN a note is created with type INTERNAL THEN it is visible only to internal staff, not exposed in customer-facing contexts
3. GIVEN note type CUSTOMER_VISIBLE WHEN displayed on a customer statement or portal THEN the note content is included
4. GIVEN note type SYSTEM WHEN the system generates automated notes (e.g., "Status changed to POSTED by AI") THEN the note is created with type SYSTEM and cannot be edited by users
5. GIVEN a record with notes WHEN the notes list is retrieved THEN notes are returned in reverse chronological order with author name and timestamp

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/notes` (AC: #1, #5)
  - [ ] `POST /notes` — create with entityType, entityId, noteType, content
  - [ ] `GET /notes` — list by entityType + entityId, ordered by createdAt DESC
  - [ ] `PATCH /notes/:id` — update content (only own notes, SYSTEM notes read-only)
  - [ ] `DELETE /notes/:id` — soft delete (MANAGER role)
- [ ] Implement note type enforcement (AC: #2, #3, #4)
  - [ ] Validate noteType against NoteType enum: GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM
  - [ ] SYSTEM notes can only be created by service layer, not user API
  - [ ] Filter by noteType in list endpoint
- [ ] Implement `PATCH /notes/:id/pin` for pinning/unpinning notes (AC: #5)
  - [ ] Pinned notes appear at top of list regardless of date
- [ ] Validate entity existence before note creation (AC: #1)
  - [ ] Enforce BR-SYS-013 (polymorphic entity validation)

**FR/NFR:** FR85; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting note system referenced in §2.20 |
| API Contracts | §2.5 Cross-cutting Infrastructure | CRUD /notes, PATCH /notes/:id/pin |
| Data Models | §3.9 Cross-Cutting Module | Note: entityType, entityId, noteType (NoteType enum), content |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events for note CRUD |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic entity validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | §The Action Bar System | Notes accessible from record screens |
| Project Context | N/A | N/A — covered by Data Models |

---

### Story E8.S3: Record Links Service

**User Story:** As a user, I want to create and view links between any two business records with typed relationships (CREATED_FROM, FULFILLS, PAYMENT_FOR, etc.), so that I can trace the full lifecycle of business transactions.

**Acceptance Criteria:**
1. GIVEN two business records WHEN a user creates a record link THEN it stores source entity (type + id), target entity (type + id), and link type
2. GIVEN the system creates a downstream record (e.g., Invoice from Sales Order) WHEN the record is created THEN a CREATED_FROM link is automatically established
3. GIVEN a record with links WHEN the links panel is viewed THEN it shows bidirectional links — the record appears as either source or target
4. GIVEN a link type FULFILLS WHEN a Sales Order is linked to a Dispatch THEN the link communicates that the dispatch fulfills the order
5. GIVEN a record link WHEN a user deletes it THEN only manual links can be deleted; system-generated links require MANAGER role

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/record-links` (AC: #1, #3)
  - [ ] `POST /record-links` — create manual link with source/target entities and link type
  - [ ] `GET /record-links` — list links for an entity (bidirectional query: where source OR target matches)
  - [ ] `DELETE /record-links/:id` — delete link (manual: STAFF, system: MANAGER)
- [ ] Implement auto-link creation for system-generated relationships (AC: #2)
  - [ ] Event handler creates CREATED_FROM links when downstream records are produced
  - [ ] PAYMENT_FOR links when payments are allocated
  - [ ] FULFILLS links when dispatches fulfill orders
- [ ] Implement bidirectional display logic (AC: #3)
  - [ ] Query: WHERE (sourceEntityType = X AND sourceEntityId = Y) OR (targetEntityType = X AND targetEntityId = Y)
  - [ ] Return with direction indicator (outgoing/incoming)
- [ ] Validate both source and target entities exist before link creation (AC: #1)
  - [ ] Enforce BR-SYS-013 for both sides

**FR/NFR:** FR87; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting record links referenced in §2.20 |
| API Contracts | §2.5 Cross-cutting Infrastructure | GET /record-links, POST /record-links, DELETE /record-links/:id |
| Data Models | §3.9 Cross-Cutting Module | RecordLink: sourceEntityType/Id, targetEntityType/Id, linkType (RecordLinkType enum: CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §15 Cross-Cutting Events | System-generated links created by event handlers |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | §The Action Bar System | Links as persistent tool with count badge |
| Project Context | N/A | N/A — covered by Data Models |

---

### Story E8.S4: Cross-cutting UI Components

**User Story:** As a user, I want an attachment panel with drag-drop upload, a notes panel with timeline view, and a links panel showing related records, so that I can manage cross-cutting data from any record screen.

**Acceptance Criteria:**
1. GIVEN a record screen WHEN the user clicks the Attachments button in the action bar THEN a side panel opens showing the file list with name, size, date, and download/delete actions
2. GIVEN the attachment panel WHEN the user drags a file onto it THEN the upload process starts automatically: presign -> upload to S3 -> confirm -> list refreshes
3. GIVEN a record screen WHEN the user clicks a "Notes" tab or section THEN a timeline view shows notes in reverse chronological order with author, date, type badge, and content
4. GIVEN the notes panel WHEN the user clicks "Add Note" THEN a form appears with content text area and type selector (General, Internal, Customer Visible)
5. GIVEN a record screen WHEN the user clicks the Links button in the action bar THEN a panel shows all linked records grouped by link type with navigation links to each related record

**Key Tasks:**
- [ ] Build `<AttachmentPanel>` component (AC: #1, #2)
  - [ ] File list with name, size, type icon, date, actions (download, delete)
  - [ ] Drag-and-drop upload zone
  - [ ] Upload progress indicator
  - [ ] Integration with presign/confirm API flow
- [ ] Build `<NotesPanel>` component (AC: #3, #4)
  - [ ] Timeline view with note cards
  - [ ] Type badge (colour-coded: General grey, Internal blue, Customer green, System purple)
  - [ ] Add note form with rich text editor (basic) and type selector
  - [ ] Pin/unpin toggle
- [ ] Build `<LinksPanel>` component (AC: #5)
  - [ ] Grouped by link type (Created From, Fulfills, Payment For, etc.)
  - [ ] Each link shows entity type icon, display reference (e.g., "INV-0047"), and navigation link
  - [ ] "Add Link" button for manual link creation with entity search
- [ ] Integrate all panels with ActionBar persistent tools (AC: #1, #5)
  - [ ] Attachments button opens AttachmentPanel
  - [ ] Links button opens LinksPanel
  - [ ] Notes accessible via tab or section within record detail

**FR/NFR:** FR85, FR87; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | Cross-cutting UI components |
| API Contracts | §2.5 Cross-cutting Infrastructure | All attachment, note, and record-link endpoints |
| Data Models | §3.9 Cross-Cutting Module | Attachment, Note, RecordLink models and enums |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted from UI |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-006 to BR-SYS-010 (attachments), BR-SYS-013/014 (polymorphic) |
| UX Design Spec | §The Action Bar System | Persistent tools zone: Attachments (count badge), Links (count badge) |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

## Epic E9: Notifications

**Tier:** 1 | **Dependencies:** E3 (Event Bus), E6 (Frontend Shell) | **FRs:** FR184-FR186 | **NFRs:** NFR2 (CRUD <500ms)

---

### Story E9.S1: Notification Service

**User Story:** As a system, I want to create notifications from business events using templates, and orchestrate delivery across channels (in-app, email, push), so that users are informed of important events in their preferred way.

**Acceptance Criteria:**
1. GIVEN a business event fires (e.g., `approval.requested`) WHEN a NotificationTemplate exists for that event THEN a Notification record is created for each target user with rendered content
2. GIVEN a NotificationTemplate WHEN it renders THEN variable substitution populates entity-specific data (e.g., invoice number, amount, customer name)
3. GIVEN a notification is created WHEN the delivery orchestrator processes it THEN it dispatches to each enabled channel per the user's NotificationPreference
4. GIVEN a user has no explicit preference for an event type WHEN the notification is dispatched THEN it falls back to the template's default channels (BR-COM-014)
5. GIVEN the notification service WHEN processing a batch of events THEN it handles failures per channel independently (email failure does not block in-app delivery)

**Key Tasks:**
- [ ] Implement notification creation from event bus handlers (AC: #1)
  - [ ] Subscribe to business events via NotificationTemplate.eventName matching
  - [ ] Resolve target users from template rules (entity owner, role-based, specific users)
  - [ ] Create Notification records with PENDING status
- [ ] Implement template rendering engine (AC: #2)
  - [ ] Handlebars-based variable substitution in title and body
  - [ ] Support for entity data, user data, and computed values
- [ ] Implement delivery orchestrator (AC: #3, #4, #5)
  - [ ] Read user NotificationPreference for each event type and channel
  - [ ] Cascade: user preference -> template defaults (BR-COM-014)
  - [ ] Dispatch to each channel independently via BullMQ jobs
  - [ ] Update Notification.status per channel (DELIVERED, FAILED)
- [ ] Implement NotificationTemplate and NotificationPreference CRUD (AC: #1, #4)
  - [ ] Seed default templates for common events (approval.requested, invoice.approved, etc.)
  - [ ] Admin can manage templates

**FR/NFR:** FR184; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Notifications referenced in cross-cutting infrastructure |
| API Contracts | §2.25 Communications | GET /notifications, PATCH /notifications/:id/read, POST /notifications/:id/dismiss, GET/PUT /notifications/preferences |
| Data Models | §3.18 Communications Module | NotificationTemplate, NotificationPreference, Notification (channel, priority, status enums) |
| State Machines | §17 Communications State Machines | §17.2 Notification Status: PENDING -> DELIVERED -> READ -> DISMISSED / FAILED |
| Event Catalog | §14 Communications / Notifications Events | `notification.sent`, subscribes to ALL business events via template matching |
| Business Rules | §13 Communications Rules | BR-COM-014 (notification preferences cascade from template defaults) |
| UX Design Spec | §Key Design Challenges | Notifications tiered: toast vs. notification centre vs. audit-only |
| Project Context | §5 Notifications | Core infrastructure, delivery channels: in-app, push, email |

---

### Story E9.S2: In-App Notifications

**User Story:** As a user, I want real-time in-app notifications delivered via WebSocket with a notification centre (bell icon + dropdown), mark read/dismissed actions, and unread badge count, so that I am immediately aware of important events.

**Acceptance Criteria:**
1. GIVEN a notification is created for the user WHEN they are online THEN it is delivered in real-time via WebSocket and appears as a toast (for high priority) or silently in the notification centre
2. GIVEN the notification bell icon WHEN the user has unread notifications THEN a red badge shows the unread count
3. GIVEN the notification bell WHEN clicked THEN a dropdown displays recent notifications with title, body, timestamp, and entity link
4. GIVEN a notification in the dropdown WHEN clicked THEN the user navigates to the related record and the notification is marked as READ
5. GIVEN a notification WHEN the user clicks "Dismiss" THEN it is marked as DISMISSED and no longer appears in the active list

**Key Tasks:**
- [ ] Implement WebSocket notification delivery (AC: #1)
  - [ ] Push new notifications to connected users via Socket.io
  - [ ] Differentiate by priority: URGENT/HIGH = toast, NORMAL/LOW = silent badge update
- [ ] Build `<NotificationBell>` component in header (AC: #2)
  - [ ] Unread count badge (red dot with number)
  - [ ] Animate on new notification arrival
- [ ] Build `<NotificationDropdown>` component (AC: #3, #4, #5)
  - [ ] List of recent notifications with icon, title, body preview, timestamp
  - [ ] Click navigates to entity and marks as read
  - [ ] "Dismiss" action per notification
  - [ ] "Mark All Read" action
  - [ ] "View All" link to full notification centre page
- [ ] Implement `PATCH /notifications/:id/read` and `POST /notifications/:id/dismiss` endpoints (AC: #4, #5)
- [ ] Implement unread count endpoint for initial page load (AC: #2)

**FR/NFR:** FR186; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | WebSocket for real-time, Socket.io |
| API Contracts | §2.25 Communications | PATCH /notifications/:id/read, POST /notifications/:id/dismiss |
| Data Models | §3.18 Communications Module | Notification: channel (IN_APP), priority, status (PENDING/DELIVERED/READ/DISMISSED) |
| State Machines | §17.2 Notification Status | PENDING -> DELIVERED -> READ -> DISMISSED |
| Event Catalog | §14 Communications Events | `notification.sent` event |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade) |
| UX Design Spec | §Key Design Challenges | Notification centre (bell icon + dropdown), actionable notifications |
| Project Context | §5 Notifications | In-app delivery via WebSocket |

---

### Story E9.S3: Email Notification Channel

**User Story:** As a user, I want to receive notification emails for important events (approval requests, overdue alerts) using styled HTML templates, so that I stay informed even when not logged into the application.

**Acceptance Criteria:**
1. GIVEN a notification with EMAIL channel enabled WHEN the delivery orchestrator processes it THEN an email is queued for sending with the rendered template
2. GIVEN an email notification template WHEN rendered THEN it produces a styled HTML email with company branding, notification title, body, and action link
3. GIVEN the email channel WHEN sending fails THEN it retries with exponential backoff (3 attempts) and marks the notification as FAILED after exhausting retries
4. GIVEN a user has disabled EMAIL for a specific event type WHEN the event fires THEN no email is sent for that event (preference respected)

**Key Tasks:**
- [ ] Implement email notification delivery channel (AC: #1)
  - [ ] BullMQ job for email sending from notification service
  - [ ] Integrate with E10 (Email Integration) SMTP service
- [ ] Create HTML email templates for notifications (AC: #2)
  - [ ] Base template with header (logo), body, action button, footer
  - [ ] Variable substitution for notification content
  - [ ] Responsive email layout (inline CSS)
- [ ] Implement retry logic with exponential backoff (AC: #3)
  - [ ] BullMQ retry configuration: 3 attempts, backoff 30s/120s/300s
  - [ ] Mark notification channel status as FAILED after final retry
- [ ] Respect user email notification preferences (AC: #4)

**FR/NFR:** FR184; NFR31 (retry with exponential backoff)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | BullMQ workers for email sending |
| API Contracts | §2.25 Communications | Notification preferences endpoints |
| Data Models | §3.18 Communications Module | NotificationPreference, NotificationChannel.EMAIL |
| State Machines | §17.2 Notification Status | PENDING -> DELIVERED / FAILED |
| Event Catalog | §14 Communications Events | `notification.sent` after successful delivery |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade), BR-COM-015 (S3 presign for attachments) |
| UX Design Spec | N/A | N/A — email channel is backend-only |
| Project Context | §5 Notifications | Email delivery via E10 integration |

---

### Story E9.S4: Notification Preferences

**User Story:** As a user, I want to manage my notification preferences per channel and per event type, so that I receive only the notifications I care about through the channels I prefer.

**Acceptance Criteria:**
1. GIVEN the notification preferences page WHEN the user opens it THEN a matrix displays event types (rows) vs channels (columns: In-App, Email, Push) with toggle controls
2. GIVEN an event type with no user preference WHEN the default is evaluated THEN it falls back to the NotificationTemplate's defaultChannels
3. GIVEN a user toggles off EMAIL for "Invoice Approved" WHEN an invoice is approved THEN they receive in-app and push notifications but not email
4. GIVEN an ADMIN user WHEN they configure role-based defaults THEN the defaults apply to all users with that role who have not set personal preferences
5. GIVEN a new NotificationTemplate is added WHEN users view preferences THEN the new event type appears with the template's defaults pre-selected

**Key Tasks:**
- [ ] Implement `GET /notifications/preferences` endpoint (AC: #1)
  - [ ] Return user's preferences merged with role defaults and template defaults
  - [ ] Matrix format: eventName -> { inApp: boolean, email: boolean, push: boolean }
- [ ] Implement `PUT /notifications/preferences` endpoint (AC: #3)
  - [ ] Accept per-event-type, per-channel preference updates
  - [ ] Create/update NotificationPreference records
- [ ] Implement preference cascade logic in delivery orchestrator (AC: #2, #5)
  - [ ] Resolution order: user preference -> role default -> template default
  - [ ] New templates automatically visible with defaults
- [ ] Build notification preferences UI page (T7 Settings template) (AC: #1, #3)
  - [ ] Matrix grid with event type descriptions and channel toggles
  - [ ] "Reset to Defaults" action
- [ ] Implement role-based default management for ADMIN (AC: #4)

**FR/NFR:** FR185; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Notification preferences in cross-cutting infrastructure |
| API Contracts | §2.25 Communications | GET /notifications/preferences, PUT /notifications/preferences |
| Data Models | §3.18 Communications Module | NotificationPreference: userId, eventName, channel, enabled |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §14 Communications Events | Template-based event subscription system |
| Business Rules | §13 Communications Rules | BR-COM-014 (preferences cascade from template defaults) |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for preferences page |
| Project Context | §5 Notifications | Per-channel, per-event-type opt-in/out |

---

## Epic E10: Email Integration

**Tier:** 1 | **Dependencies:** E9 (Notifications) | **FRs:** FR187-FR189 | **NFRs:** NFR31 (retry with exponential backoff)

---

### Story E10.S1: SMTP Outbound Service

**User Story:** As a system, I want a reliable email queue with SMTP sending, retry logic, and delivery status tracking, so that business emails (invoices, notifications, PO confirmations) are delivered reliably.

**Acceptance Criteria:**
1. GIVEN an email is queued for sending WHEN the SMTP worker processes it THEN it sends via the configured per-company SMTP settings (host, port, auth)
2. GIVEN an email send fails WHEN the SMTP server returns an error THEN the system retries with exponential backoff (30s, 120s, 300s) up to 3 attempts
3. GIVEN all retry attempts are exhausted WHEN the email still fails THEN the EmailQueue status is set to FAILED and an alert is raised
4. GIVEN an email is sent successfully WHEN the SMTP server accepts it THEN the EmailMessage status is updated to SENT and the EmailQueue record is marked SENT with timestamp
5. GIVEN per-company SMTP configuration WHEN Company A sends an email THEN it uses Company A's SMTP settings, not a shared server

**Key Tasks:**
- [ ] Implement email queue system using BullMQ (AC: #1, #2, #3)
  - [ ] `email-send.worker.ts` in `api/src/workers/`
  - [ ] Process EmailQueue records with PENDING status
  - [ ] Retry configuration: 3 attempts, exponential backoff
- [ ] Implement SMTP sending via Nodemailer (AC: #1, #5)
  - [ ] Load per-company SMTP config from SystemSettings or CompanyProfile
  - [ ] Support TLS/STARTTLS
  - [ ] Handle auth (username/password, OAuth2 for Gmail/O365)
- [ ] Implement delivery status tracking (AC: #3, #4)
  - [ ] Update EmailMessage.status: QUEUED -> SENT / FAILED
  - [ ] Update EmailQueue.queueStatus: PENDING -> PROCESSING -> SENT / FAILED / RETRYING
  - [ ] Store error details on failure
- [ ] Implement email creation service (AC: #1)
  - [ ] Create EmailMessage and EmailRecipient records
  - [ ] Queue email via EmailQueue
  - [ ] Validate recipients (BR-COM-001)
  - [ ] Prevent duplicate recipients per message (BR-COM-002)

**FR/NFR:** FR187; NFR31

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §7 Infrastructure | BullMQ workers, SMTP adapter |
| API Contracts | §2.25 Communications | CRUD /email/messages, POST /email/messages/:id/send |
| Data Models | §3.18 Communications Module | EmailMessage (status enum), EmailRecipient (type enum), EmailQueue (queueStatus enum) |
| State Machines | §17.1 EmailMessage Status | DRAFT -> QUEUED -> SENT / FAILED / BOUNCED |
| Event Catalog | §14 Communications Events | `email.sent` event after successful send |
| Business Rules | §13 Communications Rules | BR-COM-001 (recipient validation), BR-COM-002 (no duplicates), BR-COM-003 (no un-send), BR-COM-009 (signature once) |
| UX Design Spec | N/A | N/A — backend service |
| Project Context | §6 Email Integration | SMTP outbound only for MVP, inbound (IMAP) deferred |

---

### Story E10.S2: Email Template Management

**User Story:** As an administrator, I want to create and manage email templates with variable substitution and preview capability, so that business emails have consistent, professional formatting.

**Acceptance Criteria:**
1. GIVEN an ADMIN user WHEN they create an email template THEN they can specify a name, subject template, body template (HTML), and associated document type
2. GIVEN a template body WHEN it contains Handlebars variables (e.g., `{{customer.name}}`, `{{invoice.number}}`) THEN the system validates that the variables are known for the associated document type
3. GIVEN a template WHEN preview is requested THEN the system renders it with sample data and returns the HTML for display in the template editor
4. GIVEN a document type (e.g., SALES_INVOICE) WHEN no custom template exists THEN the system falls back to a system default template (BR-COM-010)

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/email/templates` (AC: #1)
  - [ ] ADMIN role required for create/update/delete
  - [ ] Fields: name, subject, bodyHtml, documentType, isDefault
- [ ] Implement Handlebars template compilation and variable validation (AC: #2)
  - [ ] Define available variables per document type
  - [ ] Validate template syntax on save
  - [ ] Compile and render with data context at send time
- [ ] Implement template preview endpoint (AC: #3)
  - [ ] Accept template ID, return rendered HTML with sample data
  - [ ] Sample data generated per document type
- [ ] Create system default templates for each document type (AC: #4)
  - [ ] Invoice email, Statement email, PO email, Notification email
  - [ ] Professional HTML layout with company branding placeholders
  - [ ] Fallback logic: custom template -> system default

**FR/NFR:** FR189; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Email templates in communications module |
| API Contracts | §2.25 Communications | CRUD /email/templates |
| Data Models | §3.18 Communications Module | EmailTemplate |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §13 Communications Rules | BR-COM-010 (document-to-email requires valid template with fallback) |
| UX Design Spec | N/A | N/A — admin management screen |
| Project Context | §6 Email Integration | SMTP outbound, email templates with merge fields |

---

### Story E10.S3: Document-to-Email

**User Story:** As a user, I want to send invoices, purchase orders, and statements as PDF attachments via email directly from the record screen, so that I can communicate with customers and suppliers without leaving the ERP.

**Acceptance Criteria:**
1. GIVEN a posted invoice WHEN the user clicks "Email" in the action bar THEN a dialog pre-fills the recipient (customer email), subject (from template), and body (from template) with the invoice PDF attached
2. GIVEN the email dialog WHEN the user adds CC/BCC recipients THEN the email is sent to all specified recipients
3. GIVEN a document type WHEN the email template is resolved THEN it uses the document-type-specific template with Handlebars variables populated from the record data
4. GIVEN the email is sent WHEN confirmed THEN a RecordLink of type RELATES_TO is created between the EmailMessage and the source document
5. GIVEN batch statement generation WHEN the user triggers it THEN statements are generated and emailed to each customer with a balance

**Key Tasks:**
- [ ] Implement `POST /documents/email` endpoint (AC: #1, #2, #3)
  - [ ] Accept documentType, recordId, recipientOverrides, cc, bcc
  - [ ] Generate PDF via Document Template engine (E12)
  - [ ] Resolve email template for document type
  - [ ] Render template with record data
  - [ ] Attach PDF and queue for sending
- [ ] Build email composition dialog component (AC: #1, #2)
  - [ ] Pre-filled To, Subject, Body from template
  - [ ] CC/BCC fields
  - [ ] PDF attachment preview
  - [ ] Send button with confirmation
- [ ] Create RecordLink between email and source document (AC: #4)
- [ ] Implement batch email for statements (AC: #5)
  - [ ] `POST /ar/reports/statements/batch` triggers generation + email
  - [ ] BullMQ job for batch processing

**FR/NFR:** FR188; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Document-to-email flow |
| API Contracts | §2.4 Document Templates | POST /documents/email, POST /documents/generate |
| Data Models | §3.18 Communications Module | EmailMessage, EmailRecipient; §3.9 RecordLink |
| State Machines | §17.1 EmailMessage Status | DRAFT -> QUEUED -> SENT |
| Event Catalog | §14 Communications Events | `email.sent` event |
| Business Rules | §13 Communications Rules | BR-COM-001 (recipient validation), BR-COM-009 (signature once), BR-COM-010 (template required), BR-COM-015 (S3 presign for attachments) |
| UX Design Spec | §The Action Bar System | "Email" in Document Actions overflow section |
| Project Context | §6 Email Integration | SMTP outbound, send invoices/POs/statements |

---

## Epic E11: Cross-cutting Tasks

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR181-FR183 | **NFRs:** NFR2 (CRUD <500ms)

---

### Story E11.S1: Task Service

**User Story:** As a user, I want to create tasks linked to any business record, assign them to multiple users, manage status transitions, and set due dates, so that action items are tracked in the context of business operations.

**Acceptance Criteria:**
1. GIVEN any business record WHEN a user creates a task THEN it is stored with title, description, priority (LOW/NORMAL/HIGH/URGENT), status (OPEN), due date, and polymorphic entityType + entityId link
2. GIVEN a task WHEN the user assigns it to one or more users THEN TaskAssignee records are created and assignees are notified
3. GIVEN a task with status OPEN WHEN the assignee starts work THEN they can transition it to IN_PROGRESS
4. GIVEN a task with status IN_PROGRESS WHEN the assignee completes it THEN they transition it to COMPLETED and completedAt is set
5. GIVEN a task WHEN it is cancelled THEN the status transitions to CANCELLED from either OPEN or IN_PROGRESS
6. GIVEN a task with a due date WHEN the due date is approaching (within 24 hours) THEN a notification is triggered for assignees

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/tasks` (AC: #1)
  - [ ] `POST /tasks` — create with title, description, priority, dueDate, entityType, entityId
  - [ ] `GET /tasks` — list with filters (status, priority, dueDate, entityType/entityId, assigneeId)
  - [ ] `PATCH /tasks/:id` — update fields
  - [ ] `DELETE /tasks/:id` — soft delete (MANAGER role)
- [ ] Implement task assignment endpoint (AC: #2)
  - [ ] `POST /tasks/:id/assign` — add assignees (array of userIds)
  - [ ] Create TaskAssignee records with unique constraint
  - [ ] Emit notification event for each assignee
- [ ] Implement status transition endpoints (AC: #3, #4, #5)
  - [ ] `POST /tasks/:id/start` — OPEN -> IN_PROGRESS
  - [ ] `POST /tasks/:id/complete` — IN_PROGRESS -> COMPLETED (set completedAt)
  - [ ] `POST /tasks/:id/cancel` — OPEN|IN_PROGRESS -> CANCELLED
  - [ ] Validate transitions in service layer
- [ ] Implement due date notification via BullMQ scheduled job (AC: #6)
  - [ ] Check for tasks due within 24 hours
  - [ ] Emit notification event for assignees
- [ ] Validate entity existence for polymorphic link (AC: #1)
  - [ ] Enforce BR-SYS-013 pattern

**FR/NFR:** FR181, FR182; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting task system |
| API Contracts | N/A | /tasks CRUD, /tasks/:id/assign, /tasks/:id/complete (defined in Project Context) |
| Data Models | N/A | Task, TaskAssignee (defined in Project Context §4, not in data-models.md) |
| State Machines | N/A | Task status: OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED |
| Event Catalog | N/A | Task events to be defined: `task.created`, `task.assigned`, `task.completed` |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | N/A | N/A — task UI covered in E11.S2 |
| Project Context | §4 Cross-Cutting Task System | Task/TaskAssignee Prisma models, TaskPriority/TaskStatus enums |

---

### Story E11.S2: Task UI

**User Story:** As a user, I want a task panel on every record view and a centralised "My Tasks" list, so that I can create tasks from any record and manage all my tasks from one place.

**Acceptance Criteria:**
1. GIVEN any record detail screen (T2, T3) WHEN a "Tasks" section is visible THEN it shows tasks linked to this record with status, priority, assignee, and due date
2. GIVEN the tasks section on a record WHEN the user clicks "Add Task" THEN a form appears pre-linked to the current entity with fields for title, description, priority, due date, and assignee search
3. GIVEN the "My Tasks" page WHEN accessed from the sidebar THEN it uses the T1 Entity List template showing all tasks assigned to the current user with filters for status, priority, and due date
4. GIVEN a task in any list WHEN the user clicks on it THEN a detail view shows full task information, linked entity (with navigation link), assignees, and status transition actions

**Key Tasks:**
- [ ] Build `<TaskPanel>` component for record screens (AC: #1, #2)
  - [ ] Embedded in T2/T3 templates as a tab or collapsible section
  - [ ] List tasks for current entity (entityType + entityId)
  - [ ] "Add Task" form with entity pre-linked
  - [ ] Inline status transition buttons (Start, Complete, Cancel)
- [ ] Build "My Tasks" page using T1 Entity List template (AC: #3)
  - [ ] Route: `/tasks`
  - [ ] Columns: title, priority badge, status badge, due date, source entity link
  - [ ] Filters: status, priority, due date range, overdue toggle
  - [ ] Default sort: due date ascending (overdue first)
- [ ] Build task detail view (AC: #4)
  - [ ] Show linked entity with click-to-navigate
  - [ ] Assignee list with avatars
  - [ ] Status timeline
  - [ ] Action bar with status transition buttons

**FR/NFR:** FR183; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | Feature-based organisation for task components |
| API Contracts | N/A | /tasks endpoints (from Project Context) |
| Data Models | N/A | Task, TaskAssignee (from Project Context §4) |
| State Machines | N/A | Task status transitions: OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED |
| Event Catalog | N/A | N/A — UI component, no events emitted |
| Business Rules | N/A | N/A — no additional business rules for UI |
| UX Design Spec | §Standardised Screen Templates | T1 for My Tasks list, T2 tab for record-embedded tasks |
| Project Context | §4 Cross-Cutting Task System | Tasks from ANY record, multi-assignee |

---

### Story E11.S3: Task Notifications

**User Story:** As a task assignee, I want to be notified when I am assigned a task, when a due date is approaching, and when a task I created changes status, so that I stay on top of action items.

**Acceptance Criteria:**
1. GIVEN a task is assigned to a user WHEN the assignment is created THEN the assignee receives an in-app notification with task title and source entity link
2. GIVEN a task with a due date WHEN it is within 24 hours of the due date and not completed THEN assignees receive a "due soon" notification
3. GIVEN a task is overdue WHEN the due date has passed and status is not COMPLETED/CANCELLED THEN assignees receive an "overdue" notification (once)
4. GIVEN a task status changes WHEN it moves to COMPLETED or CANCELLED THEN the task creator receives a notification

**Key Tasks:**
- [ ] Create NotificationTemplates for task events (AC: #1, #4)
  - [ ] `task.assigned` — notify assignee
  - [ ] `task.completed` — notify creator
  - [ ] `task.cancelled` — notify creator
- [ ] Implement due date reminder BullMQ scheduled job (AC: #2, #3)
  - [ ] Run every hour
  - [ ] Find tasks due within 24h that have not been reminded
  - [ ] Find overdue tasks that have not been flagged
  - [ ] Emit notification events
  - [ ] Track reminder state to prevent duplicates
- [ ] Wire task service events to notification system (AC: #1, #4)
  - [ ] Emit `task.assigned`, `task.completed`, `task.cancelled` events
  - [ ] NotificationTemplate matching routes to assignees/creators

**FR/NFR:** FR182; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | BullMQ scheduled jobs for reminders |
| API Contracts | N/A | N/A — notification delivery is internal |
| Data Models | §3.18 Communications Module | NotificationTemplate for task events |
| State Machines | N/A | N/A — notifications track delivery status |
| Event Catalog | §14 Communications Events | NotificationTemplate event matching system |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade) |
| UX Design Spec | N/A | N/A — notifications display via E9 components |
| Project Context | §4 Cross-Cutting Task System | Task notification on assignment and status change |

---

## Epic E12: Document Templates & PDF

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR79 (report templates), FR85 (document generation) | **NFRs:** NFR2 (CRUD <500ms)

---

### Story E12.S1: Template Engine

**User Story:** As a system, I want to compile Handlebars HTML templates and render them to PDF via Puppeteer, with variable injection and conditional sections, so that business documents (invoices, POs, statements) are generated as professional PDFs.

**Acceptance Criteria:**
1. GIVEN a DocumentTemplate with Handlebars HTML WHEN `POST /documents/generate` is called with a record ID THEN the system fetches the record data, compiles the template, and renders a PDF
2. GIVEN the template contains variables like `{{invoice.number}}`, `{{customer.name}}`, `{{lines}}` WHEN compiled THEN all variables are populated from the record data
3. GIVEN the template contains conditional sections (e.g., `{{#if showVatNumber}}`) WHEN the condition is false THEN the section is omitted from the PDF
4. GIVEN the template has line items WHEN rendered THEN the `{{#each lines}}` block repeats for each line with correct totals
5. GIVEN Puppeteer HTML-to-PDF rendering WHEN the PDF is generated THEN it respects page size (A4), orientation, margins, and page breaks

**Key Tasks:**
- [ ] Implement Handlebars template compilation service (AC: #1, #2, #3, #4)
  - [ ] Load DocumentTemplate from database
  - [ ] Fetch record data from the appropriate module service
  - [ ] Compile Handlebars template with data context
  - [ ] Support helpers: `formatCurrency`, `formatDate`, `formatNumber`, conditionals, loops
- [ ] Implement Puppeteer HTML-to-PDF rendering (AC: #5)
  - [ ] Install Puppeteer in API service
  - [ ] Configure page size (from template: A4, Letter), orientation (portrait/landscape)
  - [ ] Set margins, headers, footers
  - [ ] Handle page breaks for long line item lists
- [ ] Implement `POST /documents/generate` endpoint (AC: #1)
  - [ ] Accept documentType, recordId
  - [ ] Return PDF as binary stream or presigned S3 URL
- [ ] Implement `POST /documents/batch-generate` for batch PDF generation (AC: #1)
  - [ ] BullMQ job for generating multiple PDFs (e.g., batch statements)

**FR/NFR:** FR85; NFR2, NFR3 (reports <5s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.7 (referenced in Project Context) | Puppeteer HTML-to-PDF, Document Templates |
| API Contracts | §2.4 Document Templates | POST /documents/generate, POST /documents/batch-generate |
| Data Models | §3.1 System Module | DocumentTemplate: documentType, htmlTemplate, pageSize, orientation, showLogo/showBankDetails/showVatNumber |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted for PDF generation |
| Business Rules | N/A | N/A — template rendering has no business rules |
| UX Design Spec | N/A | N/A — PDF output, not screen design |
| Project Context | §7 Printer Management | PDF generation via Document Templates (Puppeteer) |

---

### Story E12.S2: Template Management

**User Story:** As an administrator, I want to create, edit, and version document templates with active/draft management and preview capability, so that I can customise the look of business documents.

**Acceptance Criteria:**
1. GIVEN an ADMIN user WHEN they create a document template THEN they can specify document type, name, HTML template body, page size, orientation, and branding toggles (logo, bank details, VAT number)
2. GIVEN a template WHEN a new version is created THEN the previous version is retained and the new version can be set as active or kept as draft
3. GIVEN a template with DocumentTemplateVersion records WHEN versions have selection criteria (language, branch, number series) THEN the highest-priority matching version is selected at render time
4. GIVEN a template WHEN the admin clicks "Preview" THEN the system renders the template with sample data and displays the PDF in the browser

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/document-templates` (AC: #1)
  - [ ] ADMIN role required
  - [ ] Fields: documentType (enum), name, htmlTemplate, pageSize, orientation, branding toggles
  - [ ] Unique constraint on [documentType, name]
- [ ] Implement version management (AC: #2, #3)
  - [ ] DocumentTemplateVersion records with priority-based selection
  - [ ] Selection criteria: languageCode, branchCode, numberSeriesId, accessGroup, customerGroupId
  - [ ] Version resolution: find highest-priority matching version, fall back to base template
- [ ] Implement template preview (AC: #4)
  - [ ] Generate sample data per document type
  - [ ] Render via template engine and return PDF
- [ ] Build template management UI (T7 Settings template) (AC: #1, #2, #4)
  - [ ] Template list grouped by document type
  - [ ] HTML editor with syntax highlighting
  - [ ] Preview button
  - [ ] Version history with activate/draft controls

**FR/NFR:** FR79; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Document template versioning system |
| API Contracts | §2.4 Document Templates | CRUD /document-templates |
| Data Models | §3.1 System Module | DocumentTemplate, DocumentTemplateVersion (priority, selection criteria, email fields) |
| State Machines | N/A | N/A — no formal state machine (active/draft managed by version) |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — template management rules |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for admin management |
| Project Context | §7 Printer Management | Document Templates engine |

---

### Story E12.S3: Default Templates

**User Story:** As a system, I want built-in default templates for each DocumentType (invoice, credit note, PO, delivery note, statement, payslip, etc.), so that tenants can generate professional documents immediately without custom template creation.

**Acceptance Criteria:**
1. GIVEN a new tenant is provisioned WHEN the database is seeded THEN default DocumentTemplate records exist for all 14 DocumentType enum values
2. GIVEN a default template WHEN rendered for an invoice THEN it includes: company logo, company details, customer address, invoice number, date, due date, line items, VAT breakdown, totals, bank details, and payment terms
3. GIVEN each default template WHEN the system branding toggles (showLogo, showBankDetails, showVatNumber) are set THEN the template conditionally includes/excludes those sections
4. GIVEN the 14 DocumentTypes WHEN default templates are provided THEN they cover: SALES_INVOICE, CREDIT_NOTE, CASH_RECEIPT, PROFORMA_INVOICE, CUSTOMER_STATEMENT, SALES_ORDER, SALES_QUOTE, DELIVERY_NOTE, PURCHASE_ORDER, GOODS_RECEIPT_NOTE, SUPPLIER_REMITTANCE, PAYSLIP, P45, P60

**Key Tasks:**
- [ ] Design and create HTML/Handlebars templates for all 14 document types (AC: #1, #2, #4)
  - [ ] SALES_INVOICE: full invoice layout with line items and VAT
  - [ ] CREDIT_NOTE: similar to invoice with "Credit Note" header
  - [ ] CASH_RECEIPT: payment receipt format
  - [ ] PROFORMA_INVOICE: pro-forma layout
  - [ ] CUSTOMER_STATEMENT: aged balance with transaction list
  - [ ] SALES_ORDER / SALES_QUOTE: order/quote layouts
  - [ ] DELIVERY_NOTE: dispatch with line items (no pricing)
  - [ ] PURCHASE_ORDER: PO layout for suppliers
  - [ ] GOODS_RECEIPT_NOTE: GRN layout
  - [ ] SUPPLIER_REMITTANCE: payment remittance advice
  - [ ] PAYSLIP / P45 / P60: UK payroll document formats
- [ ] Implement conditional branding sections in all templates (AC: #3)
  - [ ] `{{#if showLogo}}` blocks
  - [ ] `{{#if showBankDetails}}` blocks
  - [ ] `{{#if showVatNumber}}` blocks
- [ ] Create database seed script for default templates (AC: #1)
  - [ ] Run on tenant provisioning
  - [ ] Idempotent (skip if templates already exist)

**FR/NFR:** FR79, FR85; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Default template seeding |
| API Contracts | §2.4 Document Templates | POST /documents/generate uses these templates |
| Data Models | §4.1 System Module Enums | DocumentType enum: 14 values (SALES_INVOICE through P60) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §13 Communications Rules | BR-COM-010 (document-to-email requires valid template, fall back to default) |
| UX Design Spec | N/A | N/A — PDF layout design, not screen design |
| Project Context | §7 Printer Management | PDF generation, all 14 document types |

---

## Epic E13: Printer Management

**Tier:** 1 | **Dependencies:** E12 (Document Templates & PDF) | **FRs:** FR190-FR192 | **NFRs:** NFR2

---

### Story E13.S1: Print Preferences

**User Story:** As a user, I want to configure my preferred print behaviour per document type (auto-download PDF, browser print dialog, or no action), so that document handling matches my workflow.

**Acceptance Criteria:**
1. GIVEN a user preferences page WHEN the user opens print settings THEN a list of document types shows with a preference selector for each (Auto-Download, Browser Print, None)
2. GIVEN a company-level default WHEN set by an ADMIN THEN it applies to all users who have not set personal preferences
3. GIVEN a user has set "Auto-Download" for SALES_INVOICE WHEN they save an invoice THEN the PDF is automatically downloaded to their browser
4. GIVEN a user has set "Browser Print" for PURCHASE_ORDER WHEN they save a PO THEN the browser's native print dialog opens with the PDF

**Key Tasks:**
- [ ] Implement print preference storage in SystemSettings / UserPreference (AC: #1, #2)
  - [ ] Company-level defaults: `SystemSetting` with key `print.{documentType}.default`
  - [ ] User-level overrides: user preference record per document type
  - [ ] Values: `AUTO_DOWNLOAD`, `BROWSER_PRINT`, `NONE`
- [ ] Build print preferences UI section (T7 Settings template) (AC: #1)
  - [ ] Table: DocumentType | Company Default | My Preference
  - [ ] Dropdown selectors per row
  - [ ] "Reset to Company Defaults" action
- [ ] Implement preference resolution logic (AC: #2, #3, #4)
  - [ ] User preference -> company default -> `NONE`

**FR/NFR:** FR190, FR192; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Print preferences pattern |
| API Contracts | N/A | User preferences via system settings endpoints |
| Data Models | §3.1 System Module | SystemSetting (key-value store for company defaults) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — preference management |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for preferences |
| Project Context | §7 Printer Management | Cloud-based, no physical drivers; PDF + browser print dialog or download |

---

### Story E13.S2: Print Actions

**User Story:** As a user, I want documents to auto-download as PDF on save or trigger the browser print dialog based on my preferences, with support for batch printing, so that printing is seamless.

**Acceptance Criteria:**
1. GIVEN a user saves a document (invoice, PO, etc.) WHEN their preference is "Auto-Download" THEN the system generates the PDF via E12 and triggers a browser file download
2. GIVEN a user saves a document WHEN their preference is "Browser Print" THEN the system generates the PDF, opens it in a hidden iframe, and calls `window.print()` to trigger the native print dialog
3. GIVEN a batch of invoices selected on a list page WHEN the user clicks "Print Selected" THEN PDFs are generated for all selected documents and either batch-downloaded as a ZIP or printed sequentially
4. GIVEN the print action WHEN the PDF is being generated THEN a loading indicator is shown and the user can continue working

**Key Tasks:**
- [ ] Implement auto-download PDF on save (AC: #1)
  - [ ] After successful save, check user print preference
  - [ ] If AUTO_DOWNLOAD: call document generate API, trigger browser download
  - [ ] Use `<a download>` technique for file download
- [ ] Implement browser print dialog trigger (AC: #2)
  - [ ] Load PDF into hidden iframe
  - [ ] Call `iframe.contentWindow.print()` or use `window.print()` with print CSS
- [ ] Implement batch print queue (AC: #3)
  - [ ] Generate PDFs for selected records (BullMQ batch job)
  - [ ] Return as ZIP download for auto-download preference
  - [ ] Sequential print dialog for browser print preference
- [ ] Implement loading state during PDF generation (AC: #4)
  - [ ] Show progress indicator on the action button
  - [ ] Non-blocking — user can navigate away

**FR/NFR:** FR191; NFR2, NFR3

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | PDF generation via Puppeteer |
| API Contracts | §2.4 Document Templates | POST /documents/generate, POST /documents/batch-generate |
| Data Models | N/A | N/A — uses DocumentTemplate from E12 |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — print is a client-side action |
| UX Design Spec | §UX Quality Contract, Action Correctness | Save actions trigger downstream effects (print) |
| Project Context | §7 Printer Management | Auto-download PDF on save, browser Print API, batch print queue |

---

## Epic E13b: Platform Admin Portal

**Tier:** 1 | **Dependencies:** E3b (Platform API + AI Gateway), E6 (Frontend Shell) | **FRs:** FR193-FR222 | **NFRs:** NFR46-NFR51

---

### Story E13b.S1: Platform Admin App Shell

**User Story:** As a platform administrator, I want a separate React application with dark sidebar navigation and platform-level authentication, so that I can manage tenants, billing, and AI usage from a dedicated control plane.

**Acceptance Criteria:**
1. GIVEN the `apps/platform-admin` package WHEN built THEN it produces a separate Vite + React + TypeScript application distinct from the tenant ERP
2. GIVEN the platform admin app WHEN the sidebar renders THEN it uses a dark theme with "PLATFORM ADMIN" branding to visually distinguish from the tenant ERP
3. GIVEN the navigation WHEN it renders THEN it shows: Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings
4. GIVEN an unauthenticated platform user WHEN they access the app THEN they are presented with a login page requiring platform credentials + MFA
5. GIVEN a PLATFORM_VIEWER user WHEN they navigate THEN write actions (suspend, impersonate, etc.) are hidden or disabled

**Key Tasks:**
- [ ] Scaffold `apps/platform-admin` as separate Vite + React app (AC: #1)
  - [ ] Share design system packages (shadcn/ui, Tailwind config)
  - [ ] Use `packages/api-client` configured for Platform Admin API base URL
  - [ ] Separate auth flow from tenant ERP
- [ ] Build dark sidebar navigation (AC: #2, #3)
  - [ ] Dark background (slate-900) with purple accent
  - [ ] "PLATFORM ADMIN" branding header
  - [ ] Navigation items: Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings
- [ ] Implement platform authentication flow (AC: #4)
  - [ ] `POST /admin/auth/login` — platform credentials
  - [ ] `POST /admin/auth/mfa/verify` — MFA challenge (mandatory for PLATFORM_ADMIN)
  - [ ] JWT storage and refresh for platform session
- [ ] Implement RBAC for PLATFORM_ADMIN vs PLATFORM_VIEWER (AC: #5)
  - [ ] PLATFORM_VIEWER: read-only access to dashboards and lists
  - [ ] PLATFORM_ADMIN: full access including write operations
  - [ ] Hide/disable actions based on role

**FR/NFR:** FR193, FR197; NFR46, NFR48

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Separate app, platform auth, PLATFORM_ADMIN/PLATFORM_VIEWER roles |
| API Contracts | §21 Platform Admin API, §21.9 Platform Auth | POST /admin/auth/login, POST /admin/auth/mfa/verify, GET /admin/users |
| Data Models | §5 Platform Database Models | PlatformUser: email, role (PlatformRole enum), mfaEnabled |
| State Machines | N/A | N/A — no state machine for app shell |
| Event Catalog | §19 Platform Admin Events | Platform events emitted by admin actions |
| Business Rules | §14b Platform Admin Rules | BR-PLT-018 (MFA mandatory for PLATFORM_ADMIN) |
| UX Design Spec | §Platform Admin Portal | Dark sidebar, separate app, PLATFORM ADMIN branding, navigation structure |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications |

---

### Story E13b.S2: Tenant Management Dashboard

**User Story:** As a platform administrator, I want to view all tenants in a list with status indicators, drill into tenant details, and perform lifecycle actions (activate, suspend, archive), so that I can manage the tenant fleet.

**Acceptance Criteria:**
1. GIVEN the Tenants page WHEN it loads THEN a T1 Entity List shows all tenants with columns: name, code, plan, status (colour-coded badge), billing status, last activity, user count
2. GIVEN a tenant row WHEN clicked THEN a T2 Record Detail page shows tabbed detail: Overview, Modules & Flags, Users, AI Usage, Billing, Diagnostics, Audit
3. GIVEN an ACTIVE tenant WHEN the admin clicks "Suspend" THEN a confirmation dialog requires a reason, and on confirm the tenant is suspended and the ERP webhook fires within 30 seconds
4. GIVEN a SUSPENDED tenant WHEN the admin clicks "Reactivate" THEN the tenant returns to ACTIVE status and the ERP entitlement cache is busted
5. GIVEN the Modules & Flags tab WHEN the admin toggles a module override or feature flag THEN the change takes effect immediately via webhook

**Key Tasks:**
- [ ] Build tenant list page using T1 Entity List template (AC: #1)
  - [ ] Columns: displayName, code, planCode, status (StatusBadge), billingStatus, lastActivityAt, userCount
  - [ ] Status colour coding: ACTIVE=green, SUSPENDED=red, READ_ONLY=amber, ARCHIVED=grey
  - [ ] Filters: status, plan, billing status
- [ ] Build tenant detail page using T2 Record Detail template (AC: #2)
  - [ ] Overview tab: status, plan, billing, creation date, region, sandbox flag
  - [ ] Modules & Flags tab: module override toggles, feature flag toggles
  - [ ] Users tab: tenant user list (read-only) with action buttons
  - [ ] AI Usage tab: usage chart, quota settings
  - [ ] Billing tab: subscription status, payment history, enforcement controls
  - [ ] Diagnostics tab: auth health, webhook status, integration status
  - [ ] Audit tab: platform actions for this tenant
- [ ] Implement lifecycle action buttons with confirmation (AC: #3, #4)
  - [ ] Suspend: requires reason text, calls `POST /admin/tenants/:id/suspend`
  - [ ] Reactivate: calls `POST /admin/tenants/:id/reactivate`
  - [ ] Archive: calls `POST /admin/tenants/:id/archive`, confirm irreversibility
- [ ] Implement module override and feature flag management (AC: #5)
  - [ ] `PUT /admin/tenants/:id/modules` — set module overrides
  - [ ] `PUT /admin/tenants/:id/feature-flags` — set feature flags

**FR/NFR:** FR193, FR194, FR195; NFR46, NFR51

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Tenant lifecycle, module overrides, feature flags |
| API Contracts | §21.1 Tenant Management | GET/POST/PATCH /admin/tenants, suspend, reactivate, archive, module/flag endpoints |
| Data Models | §5 Platform Database Models | Tenant, TenantModuleOverride, TenantFeatureFlag |
| State Machines | §20.1 Tenant Lifecycle | PROVISIONING -> ACTIVE -> SUSPENDED -> ARCHIVED |
| Event Catalog | §19 Platform Admin Events | `tenant.suspended`, `tenant.reactivated`, `tenant.archived`, `tenant.modules_changed` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-001 (strict state machine), BR-PLT-002 (30s effect), BR-PLT-003 (archive irrecoverable) |
| UX Design Spec | §Platform Admin Portal | Tenant list (T1), tenant detail (T2, tabbed), status indicators |
| Project Context | §8b Platform Layer Architecture | Webhook cache invalidation, Platform Client SDK |

---

### Story E13b.S3: Billing Dashboard

**User Story:** As a platform administrator, I want an overview of payment status across all tenants with dunning level tracking and enforcement action controls, so that I can manage billing health and take action on delinquent accounts.

**Acceptance Criteria:**
1. GIVEN the Billing page WHEN it loads THEN a dashboard shows: total active tenants, payment status breakdown (current/grace/overdue/blocked), revenue summary, and enforcement action distribution
2. GIVEN a tenant with overdue billing WHEN the admin views the tenant's billing tab THEN they see dunning level (0-3), grace period remaining, last payment date, and enforcement action
3. GIVEN billing enforcement controls WHEN the admin changes enforcement from WARNING to READ_ONLY THEN the ERP webhook fires and the tenant enters read-only mode
4. GIVEN a plan change workflow WHEN the admin assigns a new plan THEN module entitlements and limits update immediately via webhook

**Key Tasks:**
- [ ] Build billing overview dashboard using T8 Report template (AC: #1)
  - [ ] KPI cards: active tenants, current/grace/overdue/blocked counts
  - [ ] Revenue chart (monthly)
  - [ ] Enforcement action distribution pie chart
- [ ] Build per-tenant billing detail in tenant detail Billing tab (AC: #2)
  - [ ] Dunning level display with escalation timeline
  - [ ] Grace period countdown
  - [ ] Payment history list
- [ ] Implement enforcement control actions (AC: #3)
  - [ ] `PATCH /admin/tenants/:id/billing/enforcement`
  - [ ] Confirmation dialog with consequence description
- [ ] Implement plan change workflow (AC: #4)
  - [ ] `POST /admin/tenants/:id/assign-plan`
  - [ ] Plan selector with comparison view (old vs new limits)

**FR/NFR:** FR201, FR202, FR203; NFR46

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Billing enforcement, plan management |
| API Contracts | §21.4 Plans & Billing | GET /admin/plans, POST /admin/tenants/:id/assign-plan, PATCH /admin/tenants/:id/billing/enforcement |
| Data Models | §5 Platform Database Models | TenantBilling: dunningLevel, enforcementAction; Plan: maxUsers, enabledModules |
| State Machines | §20.2 Billing Enforcement Lifecycle | NONE -> WARNING -> READ_ONLY -> SUSPENDED |
| Event Catalog | §19 Platform Admin Events | `billing.enforcement_changed`, `tenant.plan_changed` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-004 (escalation), BR-PLT-005 (READ_ONLY blocks writes), BR-PLT-006 (plan change immediate) |
| UX Design Spec | §Platform Admin Portal | Billing overview section, enforcement indicators |
| Project Context | §8b Platform Layer Architecture | Webhook-based enforcement propagation |

---

### Story E13b.S4: AI Usage Dashboard

**User Story:** As a platform administrator, I want AI usage charts (daily/weekly/monthly), quota alerts, spike detection, and per-tenant usage breakdowns, so that I can monitor AI costs and identify anomalies.

**Acceptance Criteria:**
1. GIVEN the AI Usage page WHEN it loads THEN it shows cross-tenant usage summary: total tokens today, this month, cost estimate, and trend chart
2. GIVEN per-tenant AI usage WHEN the admin drills into a tenant THEN they see usage by feature (chat, document processing, forecasting), daily trend (30-day), and quota progress bar
3. GIVEN quota alerts WHEN a tenant crosses the soft limit (80%) THEN an alert appears in the alerts list with tenant name, usage percentage, and timestamp
4. GIVEN spike detection WHEN a tenant's daily usage exceeds 3x their 7-day rolling average THEN an anomaly alert is flagged for investigation
5. GIVEN the AI Usage page WHEN the admin clicks "Export CSV" THEN a CSV file downloads with per-tenant, per-day usage data

**Key Tasks:**
- [ ] Build cross-tenant AI usage dashboard (T8 Report template) (AC: #1)
  - [ ] KPI cards: total tokens today, month, cost estimate
  - [ ] Time series chart: daily usage across all tenants
  - [ ] Top consumers table
- [ ] Build per-tenant AI usage view (AC: #2)
  - [ ] Usage by feature pie/bar chart
  - [ ] Daily trend line chart (30 days)
  - [ ] Quota progress bar with soft/hard limit indicators
  - [ ] Quota settings editor
- [ ] Build alerts view (AC: #3, #4)
  - [ ] `GET /admin/ai/alerts` — list active alerts
  - [ ] Alert types: quota_warning, quota_exceeded, usage_spike
  - [ ] Acknowledge/dismiss actions
- [ ] Implement CSV export (AC: #5)
  - [ ] `GET /admin/ai/usage/export` — CSV download

**FR/NFR:** FR205-FR210; NFR46, NFR50

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | AI usage tracking, quota management |
| API Contracts | §21.5 AI Usage & Quotas | GET /admin/tenants/:id/ai/usage, /ai/usage/by-feature, /ai/quota, GET /admin/ai/alerts, /ai/usage/export |
| Data Models | §5 Platform Database Models | TenantAiUsage (append-only), TenantAiQuota (softLimitPct, hardLimitPct) |
| State Machines | §20.3 AI Quota State | Runtime states: NORMAL -> SOFT_WARNING -> HARD_LIMIT -> BLOCKED |
| Event Catalog | §19 Platform Admin Events | `tenant.quota_warning`, `tenant.quota_exceeded` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-007 (AI Gateway mandatory), BR-PLT-008 (quota check), BR-PLT-009 (durable records), BR-PLT-010 (threshold alerts), BR-PLT-011 (spike detection 3x rolling avg) |
| UX Design Spec | §Platform Admin Portal, Key UX Patterns | AI Usage dashboard wireframe, quota progress bar, feature breakdown |
| Project Context | §8b Platform Layer Architecture | AI Gateway, quota check flow, usage recording |

---

### Story E13b.S5: Impersonation & Support Console

**User Story:** As a platform administrator, I want to impersonate a tenant for support purposes with mandatory reason, time limit, non-dismissable banner, and full action audit, so that I can troubleshoot issues while maintaining security and accountability.

**Acceptance Criteria:**
1. GIVEN the admin clicks "Impersonate" on a tenant WHEN a dialog appears THEN they must provide a text reason (mandatory) and the session has a configurable time limit (default 60 minutes)
2. GIVEN an impersonation session starts WHEN the admin is redirected to the tenant's ERP THEN a permanent non-dismissable amber banner shows: admin identity, tenant name, session expiry countdown, and "End Session" button
3. GIVEN an active impersonation session WHEN the session timer expires THEN the session auto-terminates and the admin is returned to the platform admin portal
4. GIVEN every action during impersonation WHEN it executes THEN it is logged in both the platform audit log and the tenant's audit log with `impersonatedBy` metadata
5. GIVEN the Support Console WHEN the admin searches THEN they can find tenants by domain, name, email, or ID

**Key Tasks:**
- [ ] Implement impersonation start flow (AC: #1)
  - [ ] `POST /admin/tenants/:id/impersonate` — requires reason, returns session token
  - [ ] Validate reason is non-empty (BR-PLT-012)
  - [ ] Create ImpersonationSession record with expiresAt
- [ ] Implement impersonation banner in ERP frontend (AC: #2)
  - [ ] Detect impersonation token in auth context
  - [ ] Render non-dismissable `bg-amber-500` banner at top of viewport
  - [ ] Show: admin email, tenant name, countdown timer, "End Session" button
- [ ] Implement session termination (AC: #3)
  - [ ] `POST /admin/impersonation-sessions/:sessionId/end` — manual end
  - [ ] BullMQ scheduled check for expired sessions (auto-terminate)
  - [ ] Redirect to platform admin portal on end
- [ ] Implement dual audit logging during impersonation (AC: #4)
  - [ ] Platform audit: `platform.impersonation_started`, `platform.impersonation_ended`
  - [ ] Tenant audit: all actions carry `impersonatedBy` field
  - [ ] Record actionsLog in ImpersonationSession
- [ ] Build Support Console search page (AC: #5)
  - [ ] `GET /admin/support/search` — search by domain, name, email, ID
  - [ ] Results show tenant summary with quick-action buttons

**FR/NFR:** FR199, FR200, FR217, FR218; NFR46, NFR49

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Impersonation sessions, support console |
| API Contracts | §21.3 Impersonation, §21.8 Support Console | POST /admin/tenants/:id/impersonate, POST /admin/impersonation-sessions/:id/end, GET /admin/support/search |
| Data Models | §5 Platform Database Models | ImpersonationSession: reason, startedAt, endedAt, expiresAt, actionsLog |
| State Machines | N/A | Session active/ended (time-limited) |
| Event Catalog | §19 Platform Admin Events | `platform.impersonation_started`, `platform.impersonation_ended` |
| Business Rules | §14b Platform Admin Rules | BR-PLT-012 (mandatory reason), BR-PLT-013 (time-limited), BR-PLT-014 (non-dismissable banner), BR-PLT-015 (dual audit log) |
| UX Design Spec | §Platform Admin Portal, Key UX Patterns | Impersonation banner wireframe (amber, non-dismissable), Support Console layout, Runbook Actions |
| Project Context | §8b Platform Layer Architecture | Impersonation always time-limited and audited |

---

### Story E13b.S6: Platform Audit Log Viewer

**User Story:** As a platform administrator, I want to search and filter the immutable platform audit log by action, target, user, and date range, with detail view and CSV export, so that I can investigate incidents and demonstrate compliance.

**Acceptance Criteria:**
1. GIVEN the Audit Log page WHEN it loads THEN a T1 Entity List shows audit records with columns: timestamp, admin user, action, target type, target name, IP address
2. GIVEN the audit log WHEN the admin filters by action type (e.g., "tenant.suspend") THEN only matching records are shown
3. GIVEN the audit log WHEN the admin filters by date range THEN only records within that range are shown
4. GIVEN an audit log entry WHEN clicked THEN a detail view shows the full action details JSON, before/after state (if applicable), user agent, and IP address
5. GIVEN the audit log WHEN the admin clicks "Export CSV" THEN a CSV file downloads with the filtered records

**Key Tasks:**
- [ ] Build audit log list page using T1 Entity List template (AC: #1)
  - [ ] Columns: timestamp, platformUser.displayName, action, targetType, targetId, ipAddress
  - [ ] Sorted by timestamp DESC (newest first)
  - [ ] Cursor-based pagination for large datasets
- [ ] Implement filter controls (AC: #2, #3)
  - [ ] Action type filter (dropdown with known actions)
  - [ ] Target type filter (tenant, plan, platform_user)
  - [ ] Date range picker
  - [ ] Platform user filter
- [ ] Build audit log detail view (AC: #4)
  - [ ] Modal or side panel with full details
  - [ ] JSON viewer for `details` field
  - [ ] Display ipAddress and userAgent
- [ ] Implement CSV export (AC: #5)
  - [ ] Export filtered results as CSV download
  - [ ] Include all fields in export

**FR/NFR:** FR214; NFR46, NFR49

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin | Immutable platform audit log |
| API Contracts | §21.7 Audit & Compliance | GET /admin/audit-log with filtering |
| Data Models | §5 Platform Database Models | PlatformAuditLog: platformUserId, action, targetType, targetId, details (JSONB), ipAddress, userAgent, timestamp |
| State Machines | N/A | N/A — append-only log, no state transitions |
| Event Catalog | §19 Platform Admin Events | All platform events produce audit log entries |
| Business Rules | §14b Platform Admin Rules | BR-PLT-016 (immutable log), BR-PLT-017 (every state-changing action logged) |
| UX Design Spec | §Platform Admin Portal | Audit Log in navigation, T1 Entity List template |
| Project Context | §8b Platform Layer Architecture | Platform audit log append-only, no update/delete |
# Tier 2: First Business Module

---

## Epic E14: Finance / NL (General Ledger)

**Tier:** 2 — First Business Module
**Dependencies:** E3 (Event Bus + Audit), E4 (i18n), E6 (Web Frontend Shell), E8 (Attachments + Notes + Record Links)
**FRs:** FR11–FR18
**Module Path:** `api/src/modules/finance/`

---

### Story E14.S1: Chart of Accounts

**User Story:** As a finance administrator, I want to create and manage a hierarchical chart of accounts with standard UK GAAP account types, so that all financial transactions can be categorised and reported correctly.

**Acceptance Criteria:**
1. GIVEN a finance administrator is logged in WHEN they create a new GL account with code, name, accountType (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), and normalBalance (DEBIT/CREDIT) THEN the account is persisted with companyId scoping and a success toast is displayed.
2. GIVEN an existing GL account WHEN the administrator sets a parentCode referencing another account THEN the account appears as a child node in the hierarchical tree view via GET `/finance/chart-of-accounts/tree`.
3. GIVEN a GL account has JournalLine records in the current fiscal year WHEN the administrator attempts to deactivate it THEN the system rejects the request with an error message referencing BR-FIN-005.
4. GIVEN a system-seeded account (e.g., AR_CONTROL, AP_CONTROL) WHEN any user attempts to delete it THEN the system rejects the request with a protection error per BR-FIN-006.
5. GIVEN the account list endpoint WHEN a VIEWER-role user requests the tree THEN only accounts within their companyId scope are returned, with cursor-based pagination and optional isActive filter.

**Key Tasks:**
- [ ] Create Prisma model for ChartOfAccount with self-referential parent/children relation (AC: #2)
  - [ ] Add fields: id, code (unique), name, accountType enum, normalBalance enum, parentCode (nullable self-ref FK), classificationId (nullable FK), isActive, companyId, createdAt, updatedAt
  - [ ] Add @@map("chart_of_accounts") and indexes on [companyId, code], [companyId, isActive]
- [ ] Implement CRUD service layer with companyId scoping (AC: #1, #5)
  - [ ] Create validation: unique code per company, valid accountType, valid parentCode if provided
  - [ ] Deactivation guard: query JournalLine for current fiscal year references (AC: #3)
  - [ ] Deletion guard: check system account protection list (AC: #4)
- [ ] Implement GET `/finance/chart-of-accounts/tree` endpoint returning nested hierarchy (AC: #2)
- [ ] Register CRUD routes on `/finance/chart-of-accounts` with RBAC (MANAGER for CUD, VIEWER for R) (AC: #5)
- [ ] Seed default UK GAAP (FRS 102) chart of accounts template on company creation (AC: #4)
- [ ] Add translation keys for all account types, error messages, and UI labels (AC: #1)
- [ ] Write unit tests for hierarchy building, deactivation guard, and deletion guard (AC: #3, #4)

**FR/NFR:** FR11; NFR38 (Decimal precision), NFR41 (TypeScript strict), NFR43 (80% test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | ChartOfAccount model, self-referential hierarchy, system account seeding |
| API Contracts | §2.7 | CRUD `/finance/chart-of-accounts`, GET `/finance/chart-of-accounts/tree` |
| Data Models | §3.2 | ChartOfAccount fields: code, name, accountType, normalBalance, parentCode, classificationId, isActive |
| State Machines | §1 | Reference entity pattern: isActive true/false (soft-delete) |
| Event Catalog | N/A — CoA changes do not emit domain events in MVP |
| Business Rules | §2 | BR-FIN-005 (deactivation guard), BR-FIN-006 (system account protection) |
| UX Design Spec | §T1, §T7 | T1 Entity List for CoA list, T7 Settings for CoA setup |
| Project Context | §1 | companyId on every table, query scoping pattern |

---

### Story E14.S2: Account Classifications & Mappings

**User Story:** As a finance administrator, I want to configure account classifications and GL account mappings for all 28 posting types, so that sub-modules can automatically determine the correct GL accounts when creating journal entries.

**Acceptance Criteria:**
1. GIVEN the administrator creates an AccountClassification with a unique code and name WHEN saved THEN it appears in the classification list and can be assigned to ChartOfAccount records.
2. GIVEN the administrator creates an AccountMapping with mappingType AR_CONTROL and a valid accountCode WHEN a sub-module calls createGlPosting() for an AR invoice THEN the mapping is resolved and the correct account is used.
3. GIVEN an AccountMapping with a departmentId scope WHEN the GL posting service resolves a mapping for that department THEN the department-specific mapping takes priority; if none found, the generic (null department) mapping is used as fallback per BR-FIN-007.
4. GIVEN no AccountMapping exists for a required mappingType WHEN createGlPosting() is called THEN a MissingAccountMappingError is thrown.
5. GIVEN the 28 AccountMappingType enum values WHEN the administrator views the mapping configuration screen THEN all 28 types are listed with their current account assignments and department overrides.

**Key Tasks:**
- [ ] Create Prisma model for AccountClassification (id, code, name, companyId) (AC: #1)
- [ ] Create Prisma model for AccountMapping (id, mappingType enum, accountCode FK, departmentId nullable FK, companyId) (AC: #2)
  - [ ] Add AccountMappingType enum with all 28 values: AR_CONTROL, AP_CONTROL, STOCK, STOCK_COST, STOCK_VARIANCE, SALES_REVENUE, PURCHASE_EXPENSE, VAT_OUTPUT, VAT_INPUT, EXCHANGE_GAIN, EXCHANGE_LOSS, ROUNDING, BANK_CHARGES, DISCOUNT_GIVEN, DISCOUNT_RECEIVED, INTEREST_INCOME, INTEREST_EXPENSE, DEPRECIATION_EXPENSE, ACCUMULATED_DEPRECIATION, ASSET_DISPOSAL_GAIN, ASSET_DISPOSAL_LOSS, WIP, PRODUCTION_OVERHEAD, PAYROLL_EXPENSE, PAYROLL_LIABILITY, RETENTION, CASH_IN_TRANSIT, POS_CLEARING
- [ ] Implement resolveAccountMapping(mappingType, departmentId?) service with fallback chain (AC: #3, #4)
- [ ] Register CRUD routes for `/finance/account-classifications` (ADMIN) and `/finance/account-mappings` (ADMIN) (AC: #5)
- [ ] Write unit tests for mapping resolution fallback chain and MissingAccountMappingError (AC: #3, #4)

**FR/NFR:** FR11; NFR41 (TypeScript strict)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | AccountMapping model, 28 mapping types, department fallback chain |
| API Contracts | §2.7 | CRUD `/finance/account-classifications`, CRUD `/finance/account-mappings` |
| Data Models | §3.2 | AccountClassification, AccountMapping with AccountMappingType enum (28 values) |
| State Machines | N/A — reference entities use isActive pattern |
| Event Catalog | N/A — classification/mapping changes do not emit events |
| Business Rules | §2 | BR-FIN-007 (mapping required for GL posting, department→generic fallback) |
| UX Design Spec | §T7 | T7 Settings template for mapping configuration |
| Project Context | §1 | companyId scoping, §11 development rules |

---

### Story E14.S3: Financial Periods

**User Story:** As a finance administrator, I want to manage financial periods with open/closed/locked lifecycle states, so that I can control when transactions can be posted and permanently seal completed periods.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they call POST `/finance/financial-periods/generate` with a fiscal year THEN 12 monthly periods are auto-generated with sequential periodNumber, correct start/end dates, status OPEN, and unique constraint on [year, periodNumber] per BR-FIN-004.
2. GIVEN a period in OPEN status WHEN the administrator closes it THEN the status transitions to CLOSED and a warning is surfaced if any reconciliations for the period are not COMPLETED.
3. GIVEN a period in CLOSED status WHEN the administrator locks it THEN the status transitions to LOCKED, lockedAt and lockedBy are set, and a `period.locked` event is emitted.
4. GIVEN a period in CLOSED status WHEN the administrator reopens it THEN the status reverts to OPEN and posting is re-enabled.
5. GIVEN a period in LOCKED status WHEN any user attempts to post a journal entry to it THEN the system rejects with PeriodLockError per BR-FIN-003.
6. GIVEN a period in LOCKED status WHEN any user attempts to reopen it THEN the system rejects the request (LOCKED is a terminal state).

**Key Tasks:**
- [ ] Create Prisma model for FinancialPeriod (id, name, code, startDate, endDate, status PeriodStatus enum, fiscalYear, periodNumber, lockedAt, lockedBy, companyId) (AC: #1)
  - [ ] Add unique constraint on [companyId, fiscalYear, periodNumber]
- [ ] Implement period generation service for auto-creating 12 monthly periods (AC: #1)
- [ ] Implement state machine: OPEN→CLOSED, CLOSED→OPEN, CLOSED→LOCKED with guards (AC: #2, #3, #4, #6)
- [ ] Emit `period.locked` and `period.unlocked` events on transitions (AC: #3)
- [ ] Implement period lock check utility used by all GL posting operations (AC: #5)
- [ ] Register routes: CRUD `/finance/financial-periods`, POST `/:id/lock`, POST `/:id/unlock`, POST `/generate` (ADMIN role) (AC: #1–#6)
- [ ] Write unit tests for state transitions, guards, and period lock enforcement (AC: #2–#6)

**FR/NFR:** FR14; NFR37 (period locks at DB level), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | FinancialPeriod model, period lifecycle, year-end close |
| API Contracts | §2.7 | CRUD `/finance/financial-periods`, POST `/:id/lock`, POST `/:id/unlock`, POST `/generate` |
| Data Models | §3.2 | FinancialPeriod: name, code, startDate, endDate, status (PeriodStatus), fiscalYear, periodNumber |
| State Machines | §2.2 | FinancialPeriod: OPEN→CLOSED→LOCKED, CLOSED→OPEN reopen |
| Event Catalog | §1 | `period.locked`, `period.unlocked` — subscribed by all financial modules |
| Business Rules | §2 | BR-FIN-003 (no posting to locked periods), BR-FIN-004 (unique year+period) |
| UX Design Spec | §T7 | T7 Settings for period management |
| Project Context | §11 | Every state change emits a typed event |

---

### Story E14.S4: Journal Entries

**User Story:** As a finance manager, I want to create, post, and reverse manual journal entries with double-entry balance enforcement, so that all financial transactions are accurately recorded in the general ledger.

**Acceptance Criteria:**
1. GIVEN a finance manager creates a journal entry with lines WHEN the sum of debit amounts does not equal the sum of credit amounts THEN the system rejects the save with UnbalancedEntryError per BR-FIN-001.
2. GIVEN a DRAFT journal entry with balanced lines WHEN the manager posts it THEN the status transitions to POSTED, postedAt/postedBy are set, ChartOfAccount.currentBalance is updated for each line, the entry number is auto-generated from the JOURNAL NumberSeries (format JE-NNNNN per BR-FIN-012), and a `journal.posted` event is emitted.
3. GIVEN a POSTED journal entry WHEN the manager reverses it THEN a new JournalEntry is created with swapped debits/credits, status POSTED, reversalOfId set to the original, and a `journal.reversed` event is emitted.
4. GIVEN the target financial period is CLOSED or LOCKED WHEN a user attempts to post or reverse a journal entry THEN the system rejects with PeriodLockError per BR-FIN-003.
5. GIVEN a journal entry with source = MANUAL WHEN a user views its lines THEN all JournalLine records show accountCode, debitAmount, creditAmount, description, and optional departmentCode/tagCode.
6. GIVEN all monetary fields WHEN any calculation occurs THEN Decimal(19,4) precision is used per BR-FIN-002.

**Key Tasks:**
- [ ] Create Prisma models for JournalEntry and JournalLine (AC: #1, #5)
  - [ ] JournalEntry: id, entryNumber, entryDate, source (JournalSource enum with 21 values), status (JournalStatus), periodId FK, totalDebit, totalCredit, reversalOfId (self-ref), companyId, postedAt, postedBy, createdBy, updatedBy
  - [ ] JournalLine: id, journalEntryId FK (cascade), lineNumber, accountCode FK, debitAmount Decimal(19,4), creditAmount Decimal(19,4), description, departmentCode, tagCode, currencyCode, foreignAmount, exchangeRate
- [ ] Implement balanced entry validation in service layer (AC: #1, #6)
- [ ] Implement post action with period check, balance update, NumberSeries integration, and event emission (AC: #2, #4)
- [ ] Implement reversal action creating contra-entry with swapped amounts (AC: #3)
- [ ] Implement createGlPosting() shared service for sub-module use (AC: #2)
- [ ] Register routes: CRUD `/finance/journal-entries`, POST `/:id/post`, POST `/:id/reverse`, GET `/:id/lines` (AC: #2, #3, #5)
- [ ] Write unit tests for balance validation, posting, reversal, and period lock enforcement (AC: #1–#4)

**FR/NFR:** FR12; NFR36 (double-entry at DB level), NFR37 (period locks), NFR38 (Decimal 19,4), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | JournalEntry/JournalLine models, createGlPosting() pattern, auto-generated entries |
| API Contracts | §2.7, §3.2 | CRUD `/finance/journal-entries`, POST `/:id/post`, POST `/:id/reverse`; response schema for JournalEntry + JournalLine |
| Data Models | §3.2 | JournalEntry (source: 21-value JournalSource enum), JournalLine (Decimal 19,4 amounts) |
| State Machines | §2.1 | JournalEntry: DRAFT→POSTED→REVERSED; guards, side effects |
| Event Catalog | §1 | `journal.posted`, `journal.reversed` — subscribers: Finance (balance recalc), Audit, AI Context |
| Business Rules | §2 | BR-FIN-001 (balanced entries), BR-FIN-002 (Decimal 19,4), BR-FIN-003 (period lock), BR-FIN-011 (lifecycle), BR-FIN-012 (auto-numbering JE-NNNNN) |
| UX Design Spec | §T3 | T3 Header+Lines template for journal entry form |
| Project Context | §11 | Every state change emits typed event, NumberSeries integration |

---

### Story E14.S5: Multi-Currency & Exchange Rates

**User Story:** As a finance manager, I want to manage currencies and exchange rates with automatic FX gain/loss calculation, so that multi-currency transactions are accurately valued in the base currency.

**Acceptance Criteria:**
1. GIVEN the system module provides Currency and ExchangeRate CRUD WHEN the finance module processes a foreign-currency journal entry THEN the entry stores currencyCode, foreignAmount, and exchangeRate per line, converting to base currency for GL posting.
2. GIVEN an exchange rate exists for a currency on a specific date WHEN a journal line is posted with that currency THEN the system uses the most recent rate on or before the transaction date.
3. GIVEN a payment is received in a foreign currency at a different rate than the original invoice WHEN the payment is posted THEN the FX difference is posted to the EXCHANGE_GAIN or EXCHANGE_LOSS account mapping.
4. GIVEN the exchange rate endpoints WHEN a manager imports rates THEN duplicate date+currency combinations are rejected and only the latest rate per date is stored.

**Key Tasks:**
- [ ] Implement exchange rate lookup service: most recent rate on or before transaction date (AC: #2)
- [ ] Add multi-currency fields to JournalLine (currencyCode, foreignAmount Decimal(19,4), exchangeRate Decimal(18,8)) (AC: #1)
- [ ] Implement FX gain/loss calculation in GL posting service using EXCHANGE_GAIN/EXCHANGE_LOSS account mappings (AC: #3)
- [ ] Register routes for `/system/exchange-rates` CRUD with date+currency uniqueness enforcement (AC: #4)
- [ ] Write unit tests for rate lookup, FX calculation, and rounding (AC: #1–#3)

**FR/NFR:** FR15; NFR38 (Decimal precision for rates: 18,8)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | Multi-currency pattern, exchange rate lookup, FX gain/loss accounts |
| API Contracts | §2.2, §2.7 | System currency/exchange-rate endpoints; finance endpoints consuming rates |
| Data Models | §3.1, §3.2 | Currency (code PK, minorUnit, rounding rules), ExchangeRate (currencyCode, rateDate, rate Decimal(18,8)), JournalLine multi-currency fields |
| State Machines | N/A — currencies and rates are reference data |
| Event Catalog | N/A — exchange rate updates do not emit events in MVP |
| Business Rules | §2 | BR-FIN-002 (Decimal 19,4 for amounts, 18,8 for rates) |
| UX Design Spec | §T7 | T7 Settings for currency/rate management |
| Project Context | §6.7 | Multi-currency pattern: foreignAmount, exchangeRate, base-currency conversion |

---

### Story E14.S6: Bank Accounts & Transaction Import

**User Story:** As a finance manager, I want to manage bank accounts and import transactions from CSV, OFX, or QIF files, so that bank activity is recorded in the system for reconciliation.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they create a BankAccount with glAccountCode (FK to ChartOfAccount), sortCode, accountNumber, IBAN, BIC, and currencyCode THEN the bank account is persisted and linked to the GL.
2. GIVEN a bank account WHEN the manager imports a CSV/OFX/QIF bank statement THEN BankTransaction records are created with transactionDate, amount, description, importSource, and matchStatus = UNMATCHED.
3. GIVEN a previously imported transaction with the same externalId WHEN the same file is re-imported THEN the duplicate is rejected per BR-FIN-008 (no duplicate bank transactions).
4. GIVEN a successful import WHEN transactions are created THEN a `bank.transactions.imported` event is emitted with bankAccountId, importBatchId, transactionCount, and totalAmount.
5. GIVEN a bank account WHEN a user manually creates a transaction THEN the importSource is set to MANUAL.

**Key Tasks:**
- [ ] Create Prisma model for BankAccount (id, glAccountCode FK, bankName, sortCode, accountNumber, iban, bic, currencyCode, isActive, companyId) (AC: #1)
- [ ] Create Prisma model for BankTransaction (id, bankAccountId FK, transactionDate, amount Decimal(19,4), description, reference, externalId, importSource BankImportSource enum, matchStatus ReconciliationMatchStatus enum, companyId) (AC: #2)
  - [ ] Add unique constraint on [companyId, bankAccountId, externalId] for de-duplication
- [ ] Implement CSV/OFX/QIF parser services for bank statement import (AC: #2)
- [ ] Implement de-duplication via externalId check (AC: #3)
- [ ] Emit `bank.transactions.imported` event after successful import batch (AC: #4)
- [ ] Register routes: CRUD `/finance/bank-accounts`, GET `/:id/transactions`, POST `/:id/import` (AC: #1, #2, #5)
- [ ] Write unit tests for each parser format and de-duplication logic (AC: #2, #3)

**FR/NFR:** FR16; NFR33 (no duplicate bank transactions)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | BankAccount, BankTransaction models, import sources (CSV/OFX/QIF/OPEN_BANKING/MANUAL) |
| API Contracts | §2.7 | CRUD `/finance/bank-accounts`, GET `/:id/transactions`, POST `/:id/import`, POST `/:id/feed/sync` |
| Data Models | §3.2 | BankAccount (glAccountCode, sortCode, accountNumber, iban, bic), BankTransaction (externalId, matchStatus, importSource) |
| State Machines | §2.4 | BankTransaction match status: UNMATCHED→MATCHED→RECONCILED |
| Event Catalog | §1 | `bank.transactions.imported` — subscribers: AI Bank Matcher, Notifications |
| Business Rules | §2 | BR-FIN-008 (no duplicate transactions via externalId) |
| UX Design Spec | §T1, §T6 | T1 Entity List for transactions, T6 Wizard for bank import flow |
| Project Context | §1 | companyId scoping on all tables |

---

### Story E14.S7: Bank Reconciliation

**User Story:** As a finance manager, I want to reconcile bank transactions against GL entries using auto-matching with configurable confidence thresholds, so that bank balances are verified and discrepancies identified.

**Acceptance Criteria:**
1. GIVEN a bank account with imported transactions WHEN the manager creates a BankReconciliation THEN it starts in IN_PROGRESS status with the statement balance entered.
2. GIVEN a reconciliation in progress WHEN the manager triggers auto-match THEN transactions with >= 95% confidence are automatically matched, 60-94% are flagged as SUGGESTED for review, and < 60% remain UNMATCHED per BR-FIN-010.
3. GIVEN a suggested or unmatched transaction WHEN the manager manually matches it to a JournalLine THEN the matchStatus transitions to MATCHED with matchedJournalLineId set.
4. GIVEN a matched transaction WHEN the manager unmatches it (before reconciliation completion) THEN the matchStatus reverts to UNMATCHED and match fields are cleared.
5. GIVEN all items are matched and the difference (statement balance minus reconciled balance) equals zero WHEN the manager completes the reconciliation THEN status transitions to COMPLETED, completedAt/completedBy are set, matched items become RECONCILED, and `bank_reconciliation.completed` is emitted.
6. GIVEN the difference does not equal zero WHEN the manager attempts to complete THEN the system rejects with a zero-difference validation error per BR-FIN-009.

**Key Tasks:**
- [ ] Create Prisma models for BankReconciliation and BankReconciliationLine (AC: #1)
  - [ ] BankReconciliation: id, bankAccountId FK, statementDate, statementBalance, reconciledBalance, difference, status ReconciliationStatus enum, completedAt, completedBy, companyId
  - [ ] BankReconciliationLine: id, reconciliationId FK (cascade), bankTransactionId FK, matchedJournalLineId FK (nullable), matchConfidence
- [ ] Implement auto-match endpoint with configurable thresholds (AC: #2)
- [ ] Implement manual match/unmatch endpoints (AC: #3, #4)
- [ ] Implement completion with zero-difference guard (AC: #5, #6)
- [ ] Register routes: POST `/finance/bank-reconciliations`, PATCH `/:id`, POST `/:id/complete`, POST `/:id/auto-match`, POST `/finance/bank-transactions/:id/match`, POST `/:id/unmatch` (AC: #1–#6)
- [ ] Write unit tests for auto-match thresholds, manual matching, and completion guard (AC: #2, #5, #6)

**FR/NFR:** FR16, FR17, FR18; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | BankReconciliation/Line models, auto-match thresholds, zero-difference rule |
| API Contracts | §2.7, §3.2 | POST `/finance/bank-reconciliations`, POST `/:id/auto-match` (AutoMatchResult schema), POST `/:id/complete` |
| Data Models | §3.2 | BankReconciliation (statementBalance, reconciledBalance, status), BankReconciliationLine (matchedJournalLineId, matchConfidence) |
| State Machines | §2.3 | BankReconciliation: IN_PROGRESS→COMPLETED (zero-difference guard) |
| Event Catalog | §1 | `bank_reconciliation.completed` (implicit from architecture) |
| Business Rules | §2 | BR-FIN-009 (zero-difference for completion), BR-FIN-010 (auto-match thresholds: >=95% auto, 60-94% review, <60% unmatched) |
| UX Design Spec | §T3 | T3 Header+Lines template for reconciliation workspace |
| Project Context | §11 | Every state change emits typed event |

---

### Story E14.S8: Budgets

**User Story:** As a finance manager, I want to create budgets with lines allocated by account and period, approve them, and track variance against actuals, so that the business can plan and monitor financial performance.

**Acceptance Criteria:**
1. GIVEN a finance manager WHEN they create a Budget with name, budgetType (REVENUE/EXPENSE/CAPITAL/FULL), and status DRAFT THEN the budget is persisted with companyId scoping.
2. GIVEN a DRAFT budget WHEN the manager adds BudgetLines via batch upsert (account + period + amount) THEN lines are created/updated with Decimal(19,4) amounts.
3. GIVEN a DRAFT budget with at least one BudgetLine WHEN the manager approves it THEN status transitions to APPROVED, approvedAt/approvedBy are set, and a `budget.approved` event is emitted.
4. GIVEN an APPROVED budget WHEN the manager locks it THEN status transitions to LOCKED and no further modifications to budget lines are permitted.
5. GIVEN an approved budget WHEN a user views the budget-vs-actual report THEN actuals are computed from posted JournalEntry lines for each account+period combination and variance (budget minus actual) is displayed.

**Key Tasks:**
- [ ] Create Prisma models for Budget and BudgetLine (AC: #1, #2)
  - [ ] Budget: id, name, budgetType BudgetType enum, status BudgetStatus enum, fiscalYear, approvedAt, approvedBy, companyId
  - [ ] BudgetLine: id, budgetId FK (cascade), accountCode FK, periodId FK, amount Decimal(19,4)
- [ ] Implement budget approval with at-least-one-line guard (AC: #3)
- [ ] Implement budget lock preventing further line modifications (AC: #4)
- [ ] Implement budget-vs-actual variance report endpoint (AC: #5)
- [ ] Register routes: CRUD `/finance/budgets`, POST `/:id/approve`, GET `/:id/lines`, POST `/:id/lines/batch`, GET `/finance/reports/budget-vs-actual` (AC: #1–#5)
- [ ] Write unit tests for approval guard, lock enforcement, and variance calculation (AC: #3, #4, #5)

**FR/NFR:** FR13; NFR38 (Decimal precision), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | Budget/BudgetLine models, approval workflow, variance reporting |
| API Contracts | §2.7 | CRUD `/finance/budgets`, POST `/:id/approve`, GET `/:id/lines`, POST `/:id/lines/batch`, GET `/finance/reports/budget-vs-actual` |
| Data Models | §3.2 | Budget (budgetType enum: REVENUE/EXPENSE/CAPITAL/FULL, status: DRAFT/APPROVED/LOCKED), BudgetLine (accountCode, periodId, amount) |
| State Machines | §2.5 | Budget: DRAFT→APPROVED (requires >=1 line)→LOCKED |
| Event Catalog | §1 | `budget.approved` (implicit from architecture) |
| Business Rules | §2 | BR-FIN-002 (Decimal 19,4 for amounts) |
| UX Design Spec | §T3, §T8 | T3 for budget entry form, T8 for budget-vs-actual report |
| Project Context | §11 | Every state change emits typed event |

---

### Story E14.S9: Finance Screens

**User Story:** As a finance user, I want standardised list views, detail views, entry forms, and report screens for all finance entities, so that I can efficiently navigate and manage financial data using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a finance user WHEN they navigate to the Chart of Accounts section THEN a T1 Entity List displays accounts with columns for code, name, type, balance, and status, with search, filter by type/status, and saved views.
2. GIVEN a finance user WHEN they navigate to the Journals section THEN a T1 Entity List displays journal entries with columns for entry number, date, source, total, status, with filters for period, source, and status.
3. GIVEN a finance user WHEN they click a journal entry THEN a T3 Header+Lines form displays the header (date, description, period, source) and lines (account, debit, credit, description) with the ActionBar showing status-driven actions (Post for DRAFT, Reverse for POSTED).
4. GIVEN a finance user WHEN they navigate to Bank Accounts THEN a T1 list shows bank accounts with last reconciled date and balance; clicking through shows transactions.
5. GIVEN a finance user WHEN they navigate to Finance Settings THEN a T7 Settings screen shows sections for financial periods, account mappings, and bank account configuration.
6. GIVEN a finance user WHEN they run the Trial Balance report THEN a T8 Report screen shows account balances for a selected period range with debit/credit columns and totals.

**Key Tasks:**
- [ ] Build T1 Entity List for Chart of Accounts with hierarchy toggle (flat/tree view) (AC: #1)
- [ ] Build T1 Entity List for Journal Entries with period/source/status filters (AC: #2)
- [ ] Build T3 Header+Lines form for Journal Entry with balanced validation indicator (AC: #3)
  - [ ] Implement ActionBar with status-driven primary actions (Post, Reverse)
  - [ ] Implement line-item editor with account lookup, debit/credit fields
- [ ] Build T1 Entity List for Bank Accounts with balance and reconciliation status (AC: #4)
- [ ] Build T7 Settings screens for Finance module configuration (AC: #5)
- [ ] Build T8 Report screens for Trial Balance, P&L preview, Balance Sheet (AC: #6)
- [ ] Ensure all text uses translation keys via t() function (AC: #1–#6)
- [ ] Integrate Co-Pilot Dock with finance-contextual preset prompts (AC: #1–#6)

**FR/NFR:** FR11–FR18; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | All finance entities and their relationships |
| API Contracts | §2.7 | All finance endpoints consumed by frontend |
| Data Models | §3.2 | All finance models for form field mapping |
| State Machines | §2.1–§2.5 | Status-driven ActionBar visibility rules for all finance entities |
| Event Catalog | N/A — frontend subscribes via WebSocket for real-time updates |
| Business Rules | §2 | All BR-FIN rules inform validation displays and error messages |
| UX Design Spec | §T1, §T2, §T3, §T7, §T8, §Action Bar | T1 for lists, T3 for journal entry, T7 for settings, T8 for reports, ActionBar rules |
| Project Context | §3 | All strings use translation keys via t() |

---

### Story E14.S10: Mobile Adaptation

**User Story:** As a business owner on mobile, I want read-only access to key financial data including journal list, bank balances, and budget variance, so that I can monitor financial health on the go.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they open the Finance section THEN they see a summary card showing total bank balance across all accounts and current period status.
2. GIVEN a mobile user WHEN they view the journal list THEN a read-only T1 list displays recent journal entries with entry number, date, total, and status, optimised for mobile viewport (375px+).
3. GIVEN a mobile user WHEN they tap a journal entry THEN a read-only detail view shows the header and lines without edit capability.
4. GIVEN a mobile user WHEN they view bank accounts THEN each account shows current balance and last reconciled date with touch-friendly 44x44px tap targets.
5. GIVEN a mobile user WHEN they view budget variance THEN a simplified T8 report shows budget vs actual by account with colour-coded variance indicators (green = under budget, red = over budget).

**Key Tasks:**
- [ ] Design mobile finance summary card component (AC: #1)
- [ ] Implement responsive T1 list for journals with column prioritisation for mobile (AC: #2)
- [ ] Implement read-only journal detail view for mobile (AC: #3)
- [ ] Implement bank account balance cards for mobile (AC: #4)
- [ ] Implement simplified budget variance view for mobile (AC: #5)
- [ ] Ensure 44x44px minimum touch targets and WCAG 2.1 AA compliance (AC: #4)

**FR/NFR:** FR11–FR18; NFR27 (WCAG 2.1 AA accessibility), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Frontend architecture, mobile scaffold (Expo/React Native) |
| API Contracts | §2.7 | Same finance endpoints, consumed by mobile client |
| Data Models | N/A — mobile consumes API responses, no direct model access |
| State Machines | N/A — mobile displays status badges only (read-only) |
| Event Catalog | N/A — mobile receives push notifications for finance events |
| Business Rules | N/A — business rules enforced server-side; mobile is read-only |
| UX Design Spec | §Responsive, §Breakpoint Behaviour Matrix | 375px+ breakpoint, 44x44px touch targets, column prioritisation |
| Project Context | §8 | Mobile as end-of-epic story, web screens drive design, mobile adapts |

---

# Tier 3: Business Modules (Part A)

---

## Epic E15: Inventory

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL)
**FRs:** FR46–FR53
**Module Path:** `api/src/modules/inventory/`

---

### Story E15.S1: Item Management

**User Story:** As an inventory manager, I want to create and manage inventory items with support for different item types and costing methods, so that all products and services are accurately tracked in the system.

**Acceptance Criteria:**
1. GIVEN an inventory manager WHEN they create an InventoryItem with code, name, itemType (STOCK/SERVICE/NON_STOCK/KIT), and costingMethod (FIFO/WEIGHTED_AVERAGE/STANDARD/LAST_PURCHASE) THEN the item is persisted with companyId scoping and a unique code constraint.
2. GIVEN a STOCK-type item WHEN the manager sets serialNumberRequired = true THEN subsequent stock movements for that item must include valid serial numbers per BR-INV-004.
3. GIVEN a STOCK-type item WHEN the manager sets batchTrackingEnabled = true THEN subsequent stock movements must include a batch number per BR-INV-005.
4. GIVEN an item with a barcode value WHEN a user calls GET `/inventory/items/barcode/:code` THEN the item record is returned with current stock levels.
5. GIVEN an item assigned to an ItemGroup WHEN the group has default GL codes (sales, COGS, stock) and VAT codes THEN the item inherits these defaults but can override them individually per BR-INV-011.
6. GIVEN an item with existing stock movements WHEN the manager attempts to change the costingMethod THEN the system either rejects or warns depending on whether posted movements exist.

**Key Tasks:**
- [ ] Create Prisma model for InventoryItem with ~50+ fields (AC: #1)
  - [ ] Fields: id, code (unique per company), barcode, name, description, itemType enum, costingMethod enum, groupId FK, defaultWarehouseId FK, serialNumberRequired, batchTrackingEnabled, sellingPrice1/2/3, costPrice, weight, dimensions, reorderPoint, reorderQuantity, isActive, companyId, createdAt, updatedAt
  - [ ] Add indexes on [companyId, code], [companyId, barcode], [companyId, groupId]
- [ ] Implement CRUD service with companyId scoping and unique code validation (AC: #1)
- [ ] Implement barcode lookup endpoint (AC: #4)
- [ ] Implement GL code inheritance from ItemGroup with per-item override logic (AC: #5)
- [ ] Implement costing method change guard (AC: #6)
- [ ] Register routes: CRUD `/inventory/items`, POST `/batch`, POST `/import`, POST `/:id/barcode-scan`, GET `/barcode/:code` (AC: #1, #4)
- [ ] Write unit tests for item creation, barcode lookup, and GL code inheritance (AC: #1, #4, #5)
- [ ] Add translation keys for all item types, costing methods, and validation messages

**FR/NFR:** FR46; NFR38 (Decimal precision), NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | InventoryItem model (~50+ fields), item types, costing methods |
| API Contracts | §2.13, §3.7 | CRUD `/inventory/items`, POST `/batch`, POST `/import`, GET `/barcode/:code`, POST `/:id/barcode-scan` (BarcodeScanResult schema) |
| Data Models | §3.3 | InventoryItem: code, barcode, itemType (STOCK/SERVICE/NON_STOCK/KIT), costingMethod (FIFO/WA/STANDARD/LAST_PURCHASE), ~50+ typed fields |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | §2 | `item.created`, `item.updated` (implicit from stock events) |
| Business Rules | §3 | BR-INV-004 (serial validation), BR-INV-005 (batch validation), BR-INV-008 (4 costing methods), BR-INV-011 (ItemGroup GL defaults) |
| UX Design Spec | §T1, §T2 | T1 Entity List for item list, T2 Record Detail for item detail with stock tab |
| Project Context | §1 | companyId on every table, query scoping |

---

### Story E15.S2: Item Groups & Hierarchy

**User Story:** As an inventory manager, I want to organise items into hierarchical groups with default GL codes and VAT codes, so that item setup is streamlined and group-based reporting is possible.

**Acceptance Criteria:**
1. GIVEN an inventory manager WHEN they create an ItemGroup with code, name, and optional parentGroupId (self-referential) THEN the group is persisted and appears in the hierarchy.
2. GIVEN an ItemGroup with default sales account, COGS account, stock account, and VAT code WHEN a new item is assigned to this group THEN the item automatically inherits these defaults per BR-INV-011.
3. GIVEN a parent group with child groups WHEN the user views the group tree THEN groups are displayed in a nested hierarchy similar to the CoA tree.
4. GIVEN an ItemGroup with active items assigned WHEN the manager attempts to deactivate the group THEN the system warns about the affected items.

**Key Tasks:**
- [ ] Create Prisma model for ItemGroup with self-referential hierarchy (AC: #1)
  - [ ] Fields: id, code (unique per company), name, parentGroupId (self-ref FK), defaultSalesAccountCode, defaultCogsAccountCode, defaultStockAccountCode, defaultVatCodeId, isActive, companyId
- [ ] Implement CRUD service with hierarchy support (AC: #1, #3)
- [ ] Implement GL code inheritance logic for items in groups (AC: #2)
- [ ] Implement deactivation warning for groups with active items (AC: #4)
- [ ] Register routes: CRUD `/inventory/item-groups` (ADMIN) (AC: #1–#4)
- [ ] Write unit tests for hierarchy building and GL inheritance (AC: #2, #3)

**FR/NFR:** FR47; NFR41 (TypeScript strict)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | ItemGroup model, self-referential parentGroupId, GL code defaults |
| API Contracts | §2.13 | CRUD `/inventory/item-groups` |
| Data Models | §3.3 | ItemGroup: code, name, parentGroupId (self-ref), isActive |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | N/A — group changes do not emit domain events |
| Business Rules | §3 | BR-INV-011 (ItemGroup carries default GL codes; items inherit with override) |
| UX Design Spec | §T1, §T7 | T1 for group list with tree view, T7 for group settings |
| Project Context | §1 | companyId scoping, self-referential hierarchy pattern (§6.4 in Data Models) |

---

### Story E15.S3: Warehouses & Units of Measure

**User Story:** As an inventory manager, I want to manage warehouses and units of measure with conversion factors, so that stock can be tracked by location and measured in appropriate units.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they create a Warehouse with code, name, and address fields THEN the warehouse is persisted and available for stock movements.
2. GIVEN a warehouse with non-zero stock balances WHEN the administrator attempts to deactivate it THEN the system rejects with a guard error.
3. GIVEN an administrator WHEN they create a UnitOfMeasure with code, name, and optional baseUomId (self-referential) with conversionFactor THEN derived UoMs can be converted to/from the base unit.
4. GIVEN a UoM conversion chain (e.g., Box = 12 x Each) WHEN a stock movement uses a derived UoM THEN quantities are stored in the base unit for consistent stock balance tracking.

**Key Tasks:**
- [ ] Create Prisma model for Warehouse (id, code, name, addressLine1, city, postcode, isActive, companyId) (AC: #1)
- [ ] Implement warehouse deactivation guard checking StockBalance for non-zero quantities (AC: #2)
- [ ] Create Prisma model for UnitOfMeasure with self-referential conversion chain (id, code, name, baseUomId self-ref FK, conversionFactor Decimal, companyId) (AC: #3)
- [ ] Implement UoM conversion service for base unit normalisation (AC: #4)
- [ ] Register routes: CRUD `/inventory/warehouses` (ADMIN), CRUD `/inventory/units-of-measure` (ADMIN) (AC: #1–#4)
- [ ] Write unit tests for deactivation guard and UoM conversion chain (AC: #2, #4)

**FR/NFR:** FR49, FR46; NFR38 (Decimal precision for conversion factors)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | Warehouse model, UnitOfMeasure with self-referential conversion |
| API Contracts | §2.13 | CRUD `/inventory/warehouses`, CRUD `/inventory/units-of-measure` |
| Data Models | §3.3 | Warehouse (code, name, address fields), UnitOfMeasure (baseUomId self-ref, conversionFactor) |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | N/A — warehouse/UoM changes do not emit events |
| Business Rules | §3 | BR-INV-003 (warehouse must be active for movements) |
| UX Design Spec | §T7 | T7 Settings for warehouse and UoM configuration |
| Project Context | §1 | companyId scoping, §6.4 self-referential hierarchies |

---

### Story E15.S4: Stock Movements

**User Story:** As a warehouse operator, I want to record stock movements of all types with DRAFT-to-POSTED lifecycle and reversal support, so that stock levels are accurately maintained with full audit trail and GL integration.

**Acceptance Criteria:**
1. GIVEN a warehouse operator WHEN they create a StockMovement with itemId, warehouseId, movementType (one of 12 types: GOODS_RECEIPT through SCRAP), and quantity THEN the movement is created in DRAFT status.
2. GIVEN a DRAFT movement WHEN it is posted THEN the status transitions to POSTED, StockBalance is updated atomically (quantityOnHand, costValue), unitCost is calculated based on the item's costingMethod, serial number status is updated (if serial-tracked), and a `stock_movement.posted` event is emitted per BR-INV-001.
3. GIVEN a POSTED movement WHEN it is reversed THEN a new contra-movement is created with opposite quantity and same cost, linked via reversedById, all StockBalance updates are reversed, serial number status is reverted, and a `stock_movement.reversed` event is emitted per BR-INV-002.
4. GIVEN an inter-warehouse transfer WHEN posted THEN two linked movements are created atomically: TRANSFER_OUT (negative, source warehouse) and TRANSFER_IN (positive, destination warehouse).
5. GIVEN a serial-tracked item WHEN a movement is posted without a valid serial number in AVAILABLE status THEN the system rejects per BR-INV-004.
6. GIVEN a posted movement WHEN the GL posting service runs THEN a balanced JournalEntry is created using AccountMapping (STOCK, STOCK_COST, STOCK_VARIANCE accounts depending on movement type) per XM-006.

**Key Tasks:**
- [ ] Create Prisma model for StockMovement (id, itemId FK, warehouseId FK, movementType enum 12 values, status enum, sourceType enum, quantity Decimal, unitCost Decimal, totalCost Decimal, reversedById self-ref FK, companyId) (AC: #1)
- [ ] Create Prisma model for StockBalance (id, itemId FK, warehouseId FK, onHand, reserved, available Decimal, costValue, lastMovementDate, companyId) with unique [companyId, itemId, warehouseId] (AC: #2)
- [ ] Implement posting service with atomic StockBalance update within DB transaction (AC: #2)
  - [ ] Calculate unitCost based on item costingMethod (FIFO, WA, Standard, Last Purchase)
  - [ ] Update serial number status if serial-tracked
  - [ ] Emit `stock_movement.posted` event
- [ ] Implement reversal service creating contra-movement (AC: #3)
- [ ] Implement inter-warehouse transfer as atomic paired movements (AC: #4)
- [ ] Implement serial number validation guard (AC: #5)
- [ ] Integrate with Finance GL posting via createGlPosting() and AccountMapping (AC: #6)
- [ ] Register routes: CRUD `/inventory/stock-movements`, POST `/:id/post`, POST `/:id/reverse`, POST `/batch` (AC: #1–#6)
- [ ] Write unit tests for each costing method, reversal, transfer, and serial validation (AC: #2–#5)

**FR/NFR:** FR48; NFR18 (ACID / zero data loss), NFR36 (double-entry at DB level), NFR38 (Decimal precision)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | StockMovement model (12 types), StockBalance as maintained table, costing methods, GL posting |
| API Contracts | §2.13 | CRUD `/inventory/stock-movements`, POST `/:id/post`, POST `/:id/reverse`, POST `/batch` |
| Data Models | §3.3 | StockMovement (movementType 12-value enum, sourceType, reversedById self-ref), StockBalance (onHand, reserved, available, costValue) |
| State Machines | §6.1 | StockMovement: DRAFT→POSTED→REVERSED; guards, side effects (balance update, cost calc, serial update, GL journal) |
| Event Catalog | §2 | `stock.movement.posted`, `stock.movement.reversed`, `stock.balance.updated`, `stock.reorder.triggered` |
| Business Rules | §3 | BR-INV-001 (atomic ACID posting), BR-INV-002 (reversal), BR-INV-003 (item/warehouse validation), BR-INV-004 (serial validation), BR-INV-006 (StockBalance maintained table) |
| UX Design Spec | §T3 | T3 Header+Lines for stock movement form |
| Project Context | §11 | Every state change emits typed event; XM-006 unified GL posting |

---

### Story E15.S5: Serial & Batch Tracking

**User Story:** As a warehouse operator, I want to track individual serial numbers through their lifecycle and manage batch numbers on stock movements, so that product traceability is maintained for compliance and quality purposes.

**Acceptance Criteria:**
1. GIVEN a serial-tracked item WHEN a GOODS_RECEIPT movement is posted with a new serial number THEN a SerialNumber record is created with status AVAILABLE, linked to the item and warehouse.
2. GIVEN a serial number in AVAILABLE status WHEN a sales order is approved with that serial reserved THEN the status transitions to RESERVED.
3. GIVEN a serial number in RESERVED status WHEN a GOODS_ISSUE dispatch is posted THEN the status transitions to SOLD and warehouseId is cleared.
4. GIVEN a serial number in SOLD status WHEN a customer return is processed THEN the status transitions to RETURNED and can be moved to QUARANTINE for inspection.
5. GIVEN a serial number WHEN it is queried THEN the full movement history is visible, showing each status change with timestamps.
6. GIVEN a batch-tracked item WHEN a stock movement is created without a batch number THEN the system rejects per BR-INV-005.

**Key Tasks:**
- [ ] Create Prisma model for SerialNumber (id, itemId FK, serialNumber, status enum AVAILABLE/RESERVED/SOLD/RETURNED/QUARANTINE, warehouseId FK nullable, batchNumber, companyId) (AC: #1)
  - [ ] Add unique constraint on [companyId, itemId, serialNumber] per BR-INV-007
- [ ] Implement serial number lifecycle transitions driven by stock movement posting (AC: #1–#4)
- [ ] Implement serial number history query from StockMovement records (AC: #5)
- [ ] Implement batch number validation on stock movements for batch-tracked items (AC: #6)
- [ ] Register routes: CRUD `/inventory/serial-numbers` with status filter (AC: #1–#5)
- [ ] Write unit tests for each lifecycle transition and batch validation (AC: #1–#6)

**FR/NFR:** FR51; NFR18 (ACID), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | SerialNumber model, lifecycle driven by stock movements |
| API Contracts | §2.13 | CRUD `/inventory/serial-numbers` |
| Data Models | §3.3 | SerialNumber: serialNumber, status (5-value enum), warehouseId, batchNumber |
| State Machines | §6.2 | SerialNumber: AVAILABLE→RESERVED→SOLD→RETURNED→QUARANTINE; transitions driven by movements/orders |
| Event Catalog | §2 | Serial status changes are side effects of `stock.movement.posted` |
| Business Rules | §3 | BR-INV-004 (serial validation on movements), BR-INV-005 (batch validation), BR-INV-007 (serial uniqueness per item), BR-INV-009 (FIFO per serial) |
| UX Design Spec | §T2 | T2 Record Detail for serial number history view |
| Project Context | §11 | ACID transactions for all stock operations |

---

### Story E15.S6: Stock Valuation

**User Story:** As a finance manager, I want stock to be valued using the correct costing method per item with accurate cost calculations on receipts and issues, so that inventory value on the balance sheet is reliable.

**Acceptance Criteria:**
1. GIVEN a FIFO-costed item with serial tracking WHEN a GOODS_ISSUE is posted THEN cost is determined per serial number's individual purchase cost, scoped per warehouse per BR-INV-009.
2. GIVEN a weighted-average-costed item WHEN a GOODS_RECEIPT is posted THEN the item's weightedAveragePrice is recalculated using the formula: ((existingQty * existingWAC) + (receiptQty * receiptUnitCost)) / (existingQty + receiptQty) per BR-INV-010.
3. GIVEN a standard-cost item WHEN a GOODS_RECEIPT is posted at a different price THEN the variance (actual vs standard) is posted to the STOCK_VARIANCE GL account.
4. GIVEN a last-purchase-price item WHEN a GOODS_RECEIPT is posted THEN the item's lastPurchasePrice is updated to the receipt unit cost.
5. GIVEN the stock valuation report endpoint WHEN a user runs it THEN total stock value is computed per item per warehouse using the item's costing method.

**Key Tasks:**
- [ ] Implement FIFO cost layer tracking per warehouse (AC: #1)
  - [ ] For serial-tracked items, use individual serial purchase cost
  - [ ] For non-serial items, maintain cost layer queue
- [ ] Implement weighted average recalculation on receipt (AC: #2)
- [ ] Implement standard cost variance calculation and GL posting to STOCK_VARIANCE (AC: #3)
- [ ] Implement last purchase price update on receipt (AC: #4)
- [ ] Implement stock valuation report endpoint aggregating value by item and warehouse (AC: #5)
- [ ] Write unit tests for each costing method calculation with edge cases (zero stock, negative movements) (AC: #1–#4)

**FR/NFR:** FR52; NFR38 (Decimal 19,4), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | Four costing methods, cost layer tracking, WAC recalculation formula |
| API Contracts | §2.13 | GET `/inventory/reports/stock-valuation` |
| Data Models | §3.3 | InventoryItem.costingMethod, StockBalance.costValue, StockMovement.unitCost/totalCost |
| State Machines | N/A — valuation is a calculation, not a lifecycle |
| Event Catalog | §2 | `stock.valuation.changed` emitted on cost recalculation |
| Business Rules | §3 | BR-INV-008 (4 costing methods), BR-INV-009 (FIFO per serial/warehouse), BR-INV-010 (WA recalc on receipt) |
| UX Design Spec | §T8 | T8 Report template for stock valuation report |
| Project Context | §11 | Decimal(19,4) for all monetary calculations |

---

### Story E15.S7: Inventory Screens

**User Story:** As an inventory user, I want standardised list views, detail views, and movement entry forms for all inventory entities, so that I can efficiently manage items, stock, and movements using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an inventory user WHEN they navigate to Items THEN a T1 Entity List displays items with columns for code, name, type, group, stock on hand, and status, with filters for type, group, and active status.
2. GIVEN an inventory user WHEN they click an item THEN a T2 Record Detail displays the item with tabs: Primary (code, name, type, costing), Details (dimensions, weight, barcode), Stock (per-warehouse balances), Pricing (selling prices, cost), and History (recent movements).
3. GIVEN an inventory user WHEN they navigate to Stock by Warehouse THEN a T1 list shows stock balances grouped by warehouse with item, on-hand, reserved, and available columns.
4. GIVEN a warehouse operator WHEN they create a stock movement THEN a T3 Header+Lines form shows movement type, warehouse, date in the header, and item lines with quantity, serial/batch fields, and cost per line.
5. GIVEN a stock movement in DRAFT status WHEN the ActionBar is rendered THEN the primary action is "Post"; for POSTED status, the primary action is "Reverse".

**Key Tasks:**
- [ ] Build T1 Entity List for Items with type/group/status filters and barcode search (AC: #1)
- [ ] Build T2 Record Detail for Item with tabbed layout (Primary, Details, Stock, Pricing, History) (AC: #2)
- [ ] Build T1 Entity List for Stock by Warehouse with grouping (AC: #3)
- [ ] Build T3 Header+Lines form for Stock Movements with serial/batch fields (AC: #4)
  - [ ] Implement ActionBar with status-driven primary actions (Post, Reverse) (AC: #5)
- [ ] Ensure all text uses translation keys (AC: #1–#5)
- [ ] Integrate Co-Pilot Dock with inventory-contextual preset prompts

**FR/NFR:** FR46–FR53; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | All inventory entities and relationships |
| API Contracts | §2.13 | All inventory endpoints consumed by frontend |
| Data Models | §3.3 | All inventory models for form field mapping |
| State Machines | §6.1, §6.2 | StockMovement and SerialNumber status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket for real-time stock updates |
| Business Rules | §3 | All BR-INV rules inform validation displays |
| UX Design Spec | §T1, §T2, §T3, §Action Bar | T1 for item/stock lists, T2 for item detail, T3 for movement form |
| Project Context | §3 | All strings use translation keys |

---

### Story E15.S8: Mobile Adaptation

**User Story:** As a warehouse operator on a mobile device, I want to scan barcodes to look up items, check stock levels, and receive goods using the camera, so that I can perform warehouse tasks without returning to a desktop.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they activate the barcode scanner THEN the device camera opens and scans EAN/UPC/Code128 barcodes to look up items.
2. GIVEN a scanned barcode WHEN a matching item is found THEN the item detail and current stock by warehouse are displayed.
3. GIVEN a mobile user WHEN they navigate to stock lookup THEN they can search items by code, name, or barcode and see warehouse-scoped stock levels.
4. GIVEN a mobile user WHEN they start a goods receipt THEN they can scan items, enter received quantities, and post the receipt from mobile.
5. GIVEN all mobile screens WHEN rendered on a phone (375px+) THEN touch targets are minimum 44x44px and the layout is single-column optimised.

**Key Tasks:**
- [ ] Implement barcode scanner component using device camera (Expo Camera API) (AC: #1)
- [ ] Implement item lookup result display with stock levels (AC: #2)
- [ ] Implement stock search/lookup screen for mobile (AC: #3)
- [ ] Implement simplified goods receipt form for mobile (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR46, FR48; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native), camera API for barcode |
| API Contracts | §2.13, §3.7 | POST `/inventory/items/:id/barcode-scan`, BarcodeScanResult schema |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only |
| Event Catalog | N/A — mobile receives push for stock alerts |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets, camera integration |
| Project Context | §8 | Mobile as end-of-epic story; barcode scanning is a key mobile use case |

---

## Epic E16: Sales Orders

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E15 (Inventory)
**FRs:** FR33–FR40
**Module Path:** `api/src/modules/sales/`

---

### Story E16.S1: Sales Quotes

**User Story:** As a sales representative, I want to create, send, and convert sales quotes with full lifecycle tracking, so that customer proposals are formally managed and seamlessly flow into orders.

**Acceptance Criteria:**
1. GIVEN a sales rep WHEN they create a SalesQuote with customerId, quote lines (item, quantity, unit price, VAT), and validUntil date THEN the quote is persisted in DRAFT status with auto-generated quoteNumber from the NumberSeries.
2. GIVEN a DRAFT quote with at least one line WHEN the rep sends it to the customer THEN the status transitions to SENT, a `quote.sent` event is emitted, and the quote can be emailed as PDF via the communications module.
3. GIVEN a SENT quote WHEN the customer accepts THEN the status transitions to ACCEPTED and a `quote.accepted` event is emitted.
4. GIVEN an ACCEPTED quote WHEN the manager converts it to an order THEN a new SalesOrder is created in DRAFT status with all lines, pricing, and customer details copied from the quote, the quote status transitions to CONVERTED, convertedToOrderId is set, a RecordLink (CREATED_FROM) is created, and a `quote.converted` event is emitted.
5. GIVEN a SENT quote WHEN the validUntil date passes THEN a scheduled job transitions the status to EXPIRED and emits `quote.expired`.
6. GIVEN a DRAFT or SENT quote WHEN the rep cancels it THEN the status transitions to CANCELLED (not available from ACCEPTED or CONVERTED).

**Key Tasks:**
- [ ] Create Prisma models for SalesQuote and SalesQuoteLine (AC: #1)
  - [ ] SalesQuote: id, quoteNumber (unique, NumberSeries), customerId FK, status SalesQuoteStatus enum (7 values), validUntil, convertedToOrderId, subtotal, vatAmount, totalAmount, currencyCode, companyId
  - [ ] SalesQuoteLine: id, quoteId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, discountPercent, lineTotal, vatCodeId, vatAmount
- [ ] Implement SalesQuote state machine: DRAFT→SENT→ACCEPTED→CONVERTED, SENT→REJECTED/EXPIRED, DRAFT/SENT→CANCELLED (AC: #2–#6)
- [ ] Implement convert-to-order service copying lines and creating RecordLink (AC: #4)
- [ ] Implement BullMQ scheduled job for quote expiry (AC: #5)
- [ ] Emit events: `quote.sent`, `quote.accepted`, `quote.converted`, `quote.expired`, `quote.cancelled` (AC: #2–#6)
- [ ] Register routes: CRUD `/sales/quotes`, GET `/:id/lines`, POST `/:id/send`, POST `/:id/accept`, POST `/:id/reject`, POST `/:id/convert-to-order`, POST `/:id/revise` (AC: #1–#6)
- [ ] Write unit tests for each state transition and convert-to-order line copy logic (AC: #2–#4)

**FR/NFR:** FR33, FR34; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | SalesQuote/Line models, conversion to order, expiry job |
| API Contracts | §2.11, §3.5 | CRUD `/sales/quotes`, POST `/:id/send`, POST `/:id/accept`, POST `/:id/convert-to-order` (SalesOrder response schema) |
| Data Models | §3.5 | SalesQuote (quoteNumber, status 7-value enum, validUntil, convertedToOrderId), SalesQuoteLine |
| State Machines | §3.1 | SalesQuote: DRAFT→SENT→ACCEPTED→CONVERTED; SENT→REJECTED/EXPIRED; DRAFT/SENT→CANCELLED |
| Event Catalog | §4 | `quote.created`, `quote.sent`, `quote.accepted`, `quote.converted` — subscribers: CRM, Communications, Notifications |
| Business Rules | §4 | REQ-OR-001 to REQ-OR-003 (customer validation applies to quotes), BR-PRC rules apply to quote line pricing |
| UX Design Spec | §T1, §T3 | T1 for quote list, T3 for quote form with header+lines |
| Project Context | §11 | NumberSeries for auto-numbering, every state change emits event |

---

### Story E16.S2: Sales Orders

**User Story:** As a sales manager, I want to create and approve sales orders with stock availability and credit limit checks, so that orders are validated before fulfilment begins.

**Acceptance Criteria:**
1. GIVEN a sales rep WHEN they create a SalesOrder with customerId and order lines THEN the order is persisted in DRAFT status with auto-generated orderNumber.
2. GIVEN a DRAFT order WHEN the manager approves it THEN: customer is validated (exists, not blocked per REQ-OR-003), credit limit is checked (outstanding + uninvoiced orders per XM-001/BR-AR-009), stock availability is checked (ATP per XM-002), StockReservation records are created per XM-003/REQ-OR-051, planned payments are created per REQ-OR-053, a CRM activity is logged per REQ-OR-052, status transitions to APPROVED, and `order.confirmed` event is emitted.
3. GIVEN a DRAFT order with shipped lines (quantityShipped > 0) WHEN any user attempts to delete it THEN the system rejects per REQ-OR-061.
4. GIVEN an approved order WHEN dispatches are created and shipped THEN the order progresses through IN_PROGRESS→PARTIALLY_SHIPPED→FULLY_SHIPPED as line quantities are fulfilled.
5. GIVEN a fully shipped order WHEN invoices are created THEN the order progresses through PARTIALLY_INVOICED→FULLY_INVOICED→CLOSED.
6. GIVEN a DRAFT or APPROVED order with no shipments WHEN the manager cancels it THEN stock reservations are released, planned payments are deleted, and status transitions to CANCELLED.

**Key Tasks:**
- [ ] Create Prisma models for SalesOrder and SalesOrderLine (AC: #1)
  - [ ] SalesOrder: id, orderNumber, customerId FK, status SalesOrderStatus enum (9 values), quoteId (nullable), subtotal, vatAmount, totalAmount, currencyCode, companyId
  - [ ] SalesOrderLine: id, orderId FK (cascade), lineNumber, itemId, quantity, unitPrice, quantityShipped, quantityInvoiced, lineStatus SalesOrderLineStatus enum (4 values)
- [ ] Implement approval service with customer validation, credit check (XM-001), stock check (XM-002), stock reservation (XM-003) (AC: #2)
- [ ] Implement deletion guard for shipped orders (AC: #3)
- [ ] Implement order status progression from line fulfilment quantities (AC: #4, #5)
- [ ] Implement cancellation with reservation release and planned payment cleanup (AC: #6)
- [ ] Emit events: `order.confirmed`, `order.cancelled`, `order.fully_shipped`, `order.fully_invoiced`, `order.closed` (AC: #2–#6)
- [ ] Register routes: CRUD `/sales/orders`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/close`, POST `/:id/cancel`, GET `/:id/stock-check`, POST `/:id/reserve-stock` (AC: #1–#6)
- [ ] Write unit tests for approval validation chain, status progression, and cancellation cleanup (AC: #2, #4, #6)

**FR/NFR:** FR35, FR38; NFR18 (ACID), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | SalesOrder/Line models, approval flow, stock reservation, credit check |
| API Contracts | §2.11, §3.5 | CRUD `/sales/orders`, POST `/:id/approve`, GET `/:id/stock-check` (StockCheckResult schema) |
| Data Models | §3.5 | SalesOrder (status 9-value enum), SalesOrderLine (quantityShipped, quantityInvoiced, lineStatus 4-value enum) |
| State Machines | §3.2, §3.3 | SalesOrder: DRAFT→APPROVED→IN_PROGRESS→...→CLOSED; SalesOrderLine: OPEN→PARTIALLY_FULFILLED→FULFILLED |
| Event Catalog | §4 | `order.confirmed`, `dispatch.shipped`, `sales.order.invoiced` — subscribers: Inventory, AR, CRM, Notifications |
| Business Rules | §4 | REQ-OR-001–003 (customer validation), REQ-OR-005–008 (credit check), REQ-OR-013–015 (shipped row guards), REQ-OR-040 (OROK permission), REQ-OR-050–053 (approval side effects), REQ-OR-061 (delete guard) |
| UX Design Spec | §T1, §T3 | T1 for order list, T3 for order form with header+lines |
| Project Context | §15 (XM rules) | XM-001 (credit limit), XM-002 (ATP), XM-003 (stock reservation) |

---

### Story E16.S3: Dispatches

**User Story:** As a warehouse operator, I want to create dispatches from sales orders with pick/pack/ship workflow and partial dispatch support, so that goods are shipped to customers with full tracking.

**Acceptance Criteria:**
1. GIVEN an APPROVED sales order WHEN the operator creates a dispatch THEN a Dispatch is created in DRAFT status with DispatchLines linked to SalesOrderLines, and the order status transitions to IN_PROGRESS.
2. GIVEN a DRAFT dispatch WHEN items are confirmed picked THEN the status transitions to PICKED (all dispatch lines must have items available).
3. GIVEN a PICKED dispatch WHEN items are packed THEN the status transitions to PACKED.
4. GIVEN a PACKED dispatch WHEN it is shipped THEN the status transitions to SHIPPED, SalesOrderLine.quantityShipped is updated, GOODS_ISSUE stock movements are created in the Inventory module, and `dispatch.shipped` event is emitted.
5. GIVEN a SHIPPED dispatch WHEN delivery is confirmed THEN the status transitions to DELIVERED and actualDelivery date is set.
6. GIVEN a DRAFT, PICKED, or PACKED dispatch WHEN cancelled THEN the status transitions to CANCELLED and any reserved quantities are released (cancellation not available after SHIPPED).

**Key Tasks:**
- [ ] Create Prisma models for Dispatch and DispatchLine (AC: #1)
  - [ ] Dispatch: id, dispatchNumber, salesOrderId FK, status DispatchStatus enum (6 values), shippingMethodId FK, trackingNumber, actualDelivery, companyId
  - [ ] DispatchLine: id, dispatchId FK (cascade), salesOrderLineId FK, itemId, quantity, serialNumbers (JSON)
- [ ] Implement dispatch state machine: DRAFT→PICKED→PACKED→SHIPPED→DELIVERED, DRAFT/PICKED/PACKED→CANCELLED (AC: #2–#6)
- [ ] Implement SHIPPED transition with SalesOrderLine.quantityShipped update and GOODS_ISSUE stock movement creation (AC: #4)
- [ ] Emit `dispatch.shipped` event for Inventory module to create stock movements (AC: #4)
- [ ] Implement partial dispatch (not all order lines need to be dispatched at once) (AC: #1)
- [ ] Register routes: CRUD `/sales/dispatches`, GET `/:id/lines`, POST `/:id/ship`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for each status transition and stock movement integration (AC: #2–#6)

**FR/NFR:** FR36; NFR18 (ACID for stock movement creation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | Dispatch/DispatchLine models, pick/pack/ship workflow, stock movement generation |
| API Contracts | §2.11 | CRUD `/sales/dispatches`, GET `/:id/lines`, POST `/:id/ship`, POST `/:id/cancel` |
| Data Models | §3.5 | Dispatch (status 6-value enum, salesOrderId), DispatchLine (salesOrderLineId, quantity) |
| State Machines | §3.4 | Dispatch: DRAFT→PICKED→PACKED→SHIPPED→DELIVERED; DRAFT/PICKED/PACKED→CANCELLED |
| Event Catalog | §4 | `dispatch.shipped` — subscribers: Inventory (GOODS_ISSUE stock movements), Communications (shipping notification) |
| Business Rules | §4 | REQ-OR-023 (over-shipment prevention unless setting allows) |
| UX Design Spec | §T3 | T3 Header+Lines for dispatch form with pick/pack/ship actions in ActionBar |
| Project Context | §15 | XM-003 (stock reservation on approval releases on cancel) |

---

### Story E16.S4: Pricing Engine

**User Story:** As a sales manager, I want a configurable pricing engine with price lists, quantity breaks, formula pricing, and customer-specific pricing, so that correct prices are automatically resolved for each sales transaction.

**Acceptance Criteria:**
1. GIVEN a PriceList with entries and validity dates WHEN a user calls POST `/pricing/resolve` with itemId, customerId, and quantity THEN the engine resolves the price using the 5-level waterfall: Customer+Item specific → Quantity break → Generic price list → Formula-derived → Replacement chain → Last purchase → Item base price per BR-PRC-001.
2. GIVEN a PriceListEntry with noOtherPricing = true WHEN the resolver finds it THEN it returns immediately without checking further levels per BR-PRC-002.
3. GIVEN a PriceListEntry with quantity breaks WHEN the requested quantity falls within a break range THEN the break-specific price or discount applies per BR-PRC-005.
4. GIVEN a PriceListEntry with formula pricing WHEN the base source is COST_PRICE with a markup percentage THEN the resolved price equals basePrice * (1 + markupPercent/100) + additions, with rounding per BR-PRC-007.
5. GIVEN a PriceList with a replacementPriceListId WHEN no entry is found in the primary list THEN the resolver recurses into the replacement list per BR-PRC-006.
6. GIVEN price lists with start/end dates WHEN the transaction date falls outside the validity window THEN those entries are skipped per BR-PRC-003.

**Key Tasks:**
- [ ] Create Prisma models for PriceList, PriceListEntry, QuantityBreak, Rebate, RebateTier (AC: #1)
  - [ ] PriceList: id, code, name, startDate, endDate, replacementPriceListId (self-ref), noOtherPricing, isActive, companyId
  - [ ] PriceListEntry: id, priceListId FK, itemId, customerId (nullable), priceType enum, unitPrice, discountPercent, formulaBaseSource enum (7 values), markupPercent, startDate, endDate, noOtherPricing, companyId
  - [ ] QuantityBreak: id, priceListEntryId FK (cascade), fromQuantity, toQuantity, breakPrice, breakDiscountPercent
- [ ] Implement 5-level price resolution waterfall algorithm (AC: #1)
- [ ] Implement noOtherPricing short-circuit logic (AC: #2)
- [ ] Implement quantity break resolution within entries (AC: #3)
- [ ] Implement formula pricing calculation with 7 base sources (AC: #4)
- [ ] Implement replacement price list recursion with cycle detection (AC: #5)
- [ ] Implement date validity filtering on both PriceList and PriceListEntry (AC: #6)
- [ ] Register routes: CRUD `/pricing/price-lists`, CRUD entries and breaks, POST `/pricing/resolve`, CRUD `/pricing/rebates` (AC: #1–#6)
- [ ] Write unit tests for each waterfall level and edge cases (no match, expired, circular replacement) (AC: #1–#6)

**FR/NFR:** FR39; NFR38 (Decimal precision), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.19 | Pricing module design, 5-level waterfall, formula sources |
| API Contracts | §2.14 | CRUD `/pricing/price-lists`, entries, breaks, POST `/pricing/resolve`, CRUD `/pricing/rebates` |
| Data Models | §3.8 | PriceList (replacementPriceListId self-ref), PriceListEntry (priceType, formulaBaseSource 7-value enum), QuantityBreak, Rebate/RebateTier |
| State Machines | N/A — pricing is reference data, no lifecycle states |
| Event Catalog | N/A — price changes do not emit events in MVP |
| Business Rules | §13 (Pricing) | BR-PRC-001 (5-level waterfall), BR-PRC-002 (noOtherPricing), BR-PRC-003 (date validity), BR-PRC-004 (unique constraint), BR-PRC-005 (quantity breaks), BR-PRC-006 (replacement chain), BR-PRC-007 (formula pricing) |
| UX Design Spec | §T7 | T7 Settings for price list configuration |
| Project Context | §1 | companyId scoping on all pricing tables |

---

### Story E16.S5: Document Flow

**User Story:** As a sales user, I want to see the complete document chain from quote to order to dispatch to invoice with record links, so that I can trace any transaction back to its origin and understand fulfilment progress.

**Acceptance Criteria:**
1. GIVEN a quote converted to an order WHEN viewing either record THEN a RecordLink of type CREATED_FROM connects the order to the quote.
2. GIVEN a dispatch created from an order WHEN viewing the dispatch THEN a RecordLink of type FULFILLS connects the dispatch to the order.
3. GIVEN an invoice created from an order WHEN viewing the invoice THEN a RecordLink connects the invoice to the order.
4. GIVEN any document in the chain WHEN the user views it THEN the EventFlowTracker component displays: [Quote] → [Order] → [Dispatch] → [Invoice] with status indicators for each step.
5. GIVEN an order with partial fulfilment WHEN the user views it THEN the status propagation shows which lines are fulfilled and which are outstanding.

**Key Tasks:**
- [ ] Implement automatic RecordLink creation on quote-to-order conversion (type: CREATED_FROM) (AC: #1)
- [ ] Implement automatic RecordLink creation on dispatch creation from order (type: FULFILLS) (AC: #2)
- [ ] Implement automatic RecordLink creation on invoice creation from order (type: CREATED_FROM) (AC: #3)
- [ ] Build EventFlowTracker component for the Quote→Order→Dispatch→Invoice chain (AC: #4)
- [ ] Implement line-level fulfilment tracking display (AC: #5)
- [ ] Write unit tests for RecordLink creation in each flow step (AC: #1–#3)

**FR/NFR:** FR35, FR36, FR37; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16, §2.20 | RecordLink model (polymorphic), document flow chain |
| API Contracts | §2.5 | Cross-cutting RecordLink endpoints |
| Data Models | §3.9 | RecordLink: entityType, entityId, RecordLinkType enum (CREATED_FROM, FULFILLS, PAYMENT_FOR, etc.) |
| State Machines | §3.1–§3.4 | Quote→Order→Dispatch lifecycle chain |
| Event Catalog | §4 | `quote.converted`, `dispatch.shipped`, `sales.order.invoiced` — flow events |
| Business Rules | §4 | REQ-OR rules governing order lifecycle drive the document flow |
| UX Design Spec | §T3, §EventFlowTracker | EventFlowTracker component at bottom of T3 forms: [Quote] → [SO] → [DN] → [INV] |
| Project Context | §11 | XM-016 (polymorphic attachments, notes, and links across all entities) |

---

### Story E16.S6: Sales Screens

**User Story:** As a sales user, I want standardised list and form screens for quotes, orders, and dispatches with status-driven action bars, so that I can manage the full sales lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a sales user WHEN they navigate to Quotes THEN a T1 Entity List displays quotes with columns for number, customer, date, total, valid until, and status, with filters for status and date range.
2. GIVEN a sales user WHEN they open a quote THEN a T3 Header+Lines form displays customer, dates, terms in the header and item lines with quantity/price/VAT in the lines section, with ActionBar showing Send (DRAFT), Convert to Order (ACCEPTED).
3. GIVEN a sales user WHEN they navigate to Orders THEN a T1 Entity List displays orders with columns for number, customer, date, total, status, and shipment progress.
4. GIVEN a sales user WHEN they open an order THEN a T3 form displays the order with ActionBar showing Approve (DRAFT), Create Dispatch (APPROVED), Create Invoice (FULLY_SHIPPED).
5. GIVEN a sales user WHEN they navigate to Dispatches THEN a T1 list shows dispatches with order reference, status, and shipping details.
6. GIVEN a dispatch form WHEN the ActionBar renders THEN it shows status-driven actions: Pick (DRAFT), Pack (PICKED), Ship (PACKED).

**Key Tasks:**
- [ ] Build T1 Entity List for Quotes with status/date filters (AC: #1)
- [ ] Build T3 Header+Lines form for Quotes with customer lookup, line editor (AC: #2)
- [ ] Build T1 Entity List for Orders with shipment progress indicator (AC: #3)
- [ ] Build T3 Header+Lines form for Orders with stock availability inline display (AC: #4)
- [ ] Build T1 Entity List for Dispatches (AC: #5)
- [ ] Build T3 form for Dispatches with pick/pack/ship ActionBar (AC: #6)
- [ ] Implement status-driven ActionBar for all three entity types (AC: #2, #4, #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR33–FR40; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | All sales entities and relationships |
| API Contracts | §2.11 | All sales endpoints consumed by frontend |
| Data Models | §3.5 | All sales models for form field mapping |
| State Machines | §3.1–§3.4 | Quote, Order, OrderLine, Dispatch status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §4 | REQ-OR rules inform validation displays and ActionBar visibility |
| UX Design Spec | §T1, §T3, §Action Bar, §EventFlowTracker | T1 for lists, T3 for forms, ActionBar rules, EventFlowTracker for document chain |
| Project Context | §3 | All strings use translation keys |

---

### Story E16.S7: Mobile Adaptation

**User Story:** As a sales representative on mobile, I want to check order status and create quick quotes from my phone, so that I can respond to customer enquiries while in the field.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they navigate to Sales THEN they see a summary showing open quotes count, pending orders count, and today's dispatches.
2. GIVEN a mobile user WHEN they view the order list THEN a read-only T1 list displays orders with number, customer, total, and status, optimised for mobile.
3. GIVEN a mobile user WHEN they tap an order THEN a read-only detail view shows the header, line summary, and current fulfilment status.
4. GIVEN a mobile user WHEN they create a quick quote THEN a simplified form allows selecting customer, adding items (with barcode scan), and saving as DRAFT.
5. GIVEN all mobile sales screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column.

**Key Tasks:**
- [ ] Design mobile sales summary card component (AC: #1)
- [ ] Implement responsive T1 list for orders on mobile (AC: #2)
- [ ] Implement read-only order detail view for mobile (AC: #3)
- [ ] Implement simplified quick-quote creation form with barcode scan (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR33, FR35; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.11 | Sales endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status badges only |
| Event Catalog | N/A — mobile receives push notifications |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story, web drives design |

---

## Epic E17: Sales Ledger / Accounts Receivable (AR)

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL)
**FRs:** FR19–FR25
**Module Path:** `api/src/modules/ar/`

---

### Story E17.S1: Customer Management

**User Story:** As an AR clerk, I want to create and manage customer records with multiple addresses, contacts, and bill-to consolidation, so that all customer data is centralised for invoicing and credit management.

**Acceptance Criteria:**
1. GIVEN an AR clerk WHEN they create a Customer with name, customerType (COMPANY/INDIVIDUAL), and required fields THEN the customer is persisted with auto-generated customerNumber from NumberSeries and companyId scoping.
2. GIVEN a customer record WHEN the clerk adds addresses with type BILLING/SHIPPING/REGISTERED/OTHER THEN multiple CustomerAddress records are linked to the customer.
3. GIVEN a customer record WHEN the clerk adds contacts THEN CustomerContact records with name, email, phone, and role are linked to the customer.
4. GIVEN a customer with invoiceToCustomerId set (self-referential bill-to) WHEN invoices are generated THEN they are directed to the bill-to parent customer for consolidated billing.
5. GIVEN a customer WHEN credit terms (creditLimit, paymentTermsId, creditDays) are configured THEN these are used as defaults on new invoices and orders.
6. GIVEN a customer with isActive = false WHEN any user attempts to create an invoice or order for them THEN the system rejects per BR-AR-007 (blocked customers reject all transactions).

**Key Tasks:**
- [ ] Create Prisma model for Customer (~80+ fields) (AC: #1)
  - [ ] Fields: id, customerNumber (unique, NumberSeries), name, legalName, customerType enum, invoiceToCustomerId (self-ref FK), creditLimit Decimal(19,4), paymentTermsId FK, blocked Boolean, onHold Boolean, isActive, vatNumber, companyId, createdBy, updatedBy, createdAt, updatedAt
- [ ] Create Prisma models for CustomerAddress and CustomerContact (AC: #2, #3)
  - [ ] CustomerAddress: id, customerId FK, addressType enum (4 values), line1/line2/city/county/postcode/countryCode
  - [ ] CustomerContact: id, customerId FK, firstName, lastName, email, phone, jobTitle, isPrimary
- [ ] Implement CRUD service with companyId scoping and NumberSeries integration (AC: #1)
- [ ] Implement bill-to consolidation via invoiceToCustomerId self-referential relation (AC: #4)
- [ ] Implement blocked/on-hold guards per BR-AR-007 and BR-AR-008 (AC: #6)
- [ ] Register routes: CRUD `/ar/customers`, GET/POST `/:id/addresses`, PATCH `/:id/addresses/:addrId`, GET/POST `/:id/contacts`, GET `/:id/balance`, GET `/:id/credit-check`, GET `/:id/statement`, GET `/:id/transaction-history` (AC: #1–#6)
- [ ] Write unit tests for customer creation, blocked guard, and bill-to resolution (AC: #1, #4, #6)

**FR/NFR:** FR19, FR25; NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | Customer model (~80+ fields), self-ref bill-to, address/contact sub-entities |
| API Contracts | §2.9 | CRUD `/ar/customers`, addresses, contacts, balance, credit-check, statement, transaction-history |
| Data Models | §3.4 | Customer (customerNumber, customerType, invoiceToCustomerId self-ref, creditLimit), CustomerAddress (addressType 4-value enum), CustomerContact |
| State Machines | §1 | Reference entity: isActive soft-delete pattern |
| Event Catalog | N/A — customer CRUD does not emit events (lead.converted creates customer via CRM) |
| Business Rules | §4 | BR-AR-007 (blocked customers reject transactions), BR-AR-008 (on-hold warning), BR-AR-009 (credit limit calculation) |
| UX Design Spec | §T1, §T2 | T1 for customer list, T2 for customer detail with tabs (Primary, Addresses, Contacts, Financial, History) |
| Project Context | §1 | companyId scoping, RegisterSharingRule for shared customers |

---

### Story E17.S2: Customer Invoices

**User Story:** As a finance manager, I want to create, approve, post, and void customer invoices with GL journal entry generation, so that revenue is accurately recorded and the AR control account is maintained.

**Acceptance Criteria:**
1. GIVEN an AR clerk WHEN they create a CustomerInvoice with customerId, invoiceType (STANDARD/CASH/CREDIT_NOTE/DEBIT_NOTE/PROFORMA), and at least one line THEN the invoice is persisted in DRAFT status with auto-generated invoiceNumber.
2. GIVEN a DRAFT invoice with at least one line WHEN approved (or auto-approved if totalAmount < invoiceAutoApproveThreshold per BR-AR-005) THEN the status transitions to APPROVED, totals are recalculated, dueDate is set from payment terms, and `invoice.approved` event is emitted per BR-AR-004.
3. GIVEN an APPROVED invoice WHEN posted THEN the status transitions to POSTED, a balanced JournalEntry is created (DR AR_CONTROL for totalAmount, CR SALES_REVENUE per line, CR VAT_OUTPUT per VAT code), outstandingAmount is set to totalAmount, journalEntryId is set, and `invoice.posted` event is emitted per BR-AR-002.
4. GIVEN a POSTED invoice WHEN voided THEN the status transitions to VOID, a reversal JournalEntry is created with swapped debits/credits, outstandingAmount is set to zero, and `invoice.voided` event is emitted per BR-AR-003.
5. GIVEN an invoice of type CREDIT_NOTE WHEN processed THEN it follows the same lifecycle as a standard invoice per BR-AR-006.
6. GIVEN a DRAFT or APPROVED invoice WHEN cancelled THEN the status transitions to CANCELLED with no GL impact per BR-AR-001.

**Key Tasks:**
- [ ] Create Prisma models for CustomerInvoice and CustomerInvoiceLine (AC: #1)
  - [ ] CustomerInvoice: id, invoiceNumber (unique, NumberSeries), customerId FK, invoiceType InvoiceType enum (5 values), status InvoiceStatus enum (5 values), invoiceDate, dueDate, subtotal, vatAmount, totalAmount, outstandingAmount, paidAmount, currencyCode, exchangeRate, journalEntryId, companyId
  - [ ] CustomerInvoiceLine: id, invoiceId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, discountPercent, lineTotal, vatCodeId, vatAmount, accountCode
- [ ] Implement invoice state machine: DRAFT→APPROVED→POSTED, DRAFT/APPROVED→CANCELLED, POSTED→VOID (AC: #2–#6)
- [ ] Implement auto-approve threshold check from SystemSetting (AC: #2)
- [ ] Implement GL posting via createGlPosting() with AccountMapping (AR_CONTROL, SALES_REVENUE, VAT_OUTPUT) (AC: #3)
- [ ] Implement voiding with reversal JE creation (AC: #4)
- [ ] Emit events: `invoice.created`, `invoice.approved`, `invoice.posted`, `invoice.voided`, `invoice.cancelled` (AC: #2–#6)
- [ ] Register routes: CRUD `/ar/invoices`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void`, POST `/:id/credit`, POST `/:id/email` (AC: #1–#6)
- [ ] Write unit tests for each state transition, GL posting, and void reversal (AC: #2–#4)

**FR/NFR:** FR20, FR23; NFR36 (double-entry), NFR37 (period locks), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CustomerInvoice/Line models, GL posting pattern (DR AR_CONTROL, CR Revenue + VAT) |
| API Contracts | §2.9, §3.3 | CRUD `/ar/invoices`, POST `/:id/post` (CustomerInvoice response schema), POST `/:id/void` |
| Data Models | §3.4 | CustomerInvoice (invoiceType 5-value enum, status 5-value enum, outstandingAmount, paidAmount, journalEntryId), CustomerInvoiceLine |
| State Machines | §5.1 | CustomerInvoice: DRAFT→APPROVED→POSTED; POSTED→VOID; DRAFT/APPROVED→CANCELLED; GL posting pattern |
| Event Catalog | §3 | `invoice.created`, `invoice.approved`, `invoice.posted`, `invoice.voided` — subscribers: Finance (GL), Audit, CRM, Communications |
| Business Rules | §4 | BR-AR-001 (status transitions), BR-AR-002 (posting creates balanced JE), BR-AR-003 (voiding creates reversal JE), BR-AR-004 (min 1 line), BR-AR-005 (auto-approve threshold), BR-AR-006 (credit notes as invoices) |
| UX Design Spec | §T1, §T3 | T1 for invoice list, T3 for invoice form with header+lines, ActionBar with Approve/Post/Void |
| Project Context | §15 | XM-006 (unified GL posting via createGlPosting()) |

---

### Story E17.S3: Customer Payments

**User Story:** As a finance clerk, I want to record customer payments, allocate them against invoices, and handle on-account payments, so that AR balances are accurately tracked and customer accounts are up to date.

**Acceptance Criteria:**
1. GIVEN a finance clerk WHEN they create a CustomerPayment with customerId, amount, paymentMethod (BANK_TRANSFER/CARD/CASH/CHEQUE/DIRECT_DEBIT), and bankAccountId THEN the payment is persisted in DRAFT status.
2. GIVEN a DRAFT payment WHEN posted THEN the status transitions to POSTED, a JournalEntry is created (DR Bank, CR AR_CONTROL), and `payment.posted` event is emitted.
3. GIVEN a POSTED payment WHEN allocated against one or more invoices THEN PaymentAllocation records are created, each invoice's paidAmount increases and outstandingAmount decreases accordingly.
4. GIVEN a payment amount exceeding the allocated total WHEN allocation is saved THEN the unallocated portion remains as an on-account credit balance on the customer per BR-AR-011.
5. GIVEN a POSTED payment WHEN cancelled/reversed THEN a mirror JournalEntry is created (swapped DR/CR), all linked invoice outstandingAmount and paidAmount values are restored, and allocation records are soft-deleted per BR-AR-012.
6. GIVEN a multi-currency payment WHEN posted at a different exchange rate than the invoice THEN FX differences are posted to EXCHANGE_GAIN or EXCHANGE_LOSS accounts.

**Key Tasks:**
- [ ] Create Prisma models for CustomerPayment and PaymentAllocation (AC: #1, #3)
  - [ ] CustomerPayment: id, paymentNumber (NumberSeries), customerId FK, paymentMethod PaymentMethod enum, status PaymentStatus enum, amount Decimal(19,4), bankAccountId FK, currencyCode, exchangeRate, companyId
  - [ ] PaymentAllocation: id, paymentId FK, invoiceId FK, amount Decimal(19,4), discountAmount, isActive (soft-delete)
- [ ] Implement payment state machine: DRAFT→POSTED→CANCELLED (AC: #2, #5)
- [ ] Implement GL posting via createGlPosting() (DR Bank, CR AR_CONTROL) (AC: #2)
- [ ] Implement allocation service: create PaymentAllocation records, update invoice paidAmount/outstandingAmount (AC: #3)
- [ ] Implement on-account handling for unallocated portions (AC: #4)
- [ ] Implement payment reversal with mirror JE and invoice restoration (AC: #5)
- [ ] Implement FX difference calculation on multi-currency payments (AC: #6)
- [ ] Register routes: CRUD `/ar/payments`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for allocation, on-account, reversal, and FX handling (AC: #3–#6)

**FR/NFR:** FR21; NFR36 (double-entry), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CustomerPayment model, PaymentAllocation, GL posting (DR Bank, CR AR_CONTROL) |
| API Contracts | §2.9, §3.3 | CRUD `/ar/payments`, POST `/:id/post`, POST `/:id/allocate` (PaymentAllocationRequest/Result schemas), POST `/:id/void` |
| Data Models | §3.4 | CustomerPayment (paymentMethod 5-value enum, status 3-value enum), PaymentAllocation (paymentId, invoiceId, amount) |
| State Machines | §5.2 | CustomerPayment: DRAFT→POSTED→CANCELLED; side effects for GL posting and allocation restoration |
| Event Catalog | §3 | `payment.posted` — subscribers: Finance (GL: DR Bank, CR AR_CONTROL), Audit, CRM (PAYMENT_RECEIVED auto-activity) |
| Business Rules | §4 | BR-AR-011 (on-account payments permitted), BR-AR-012 (reversal creates mirror JE, restores invoice balances) |
| UX Design Spec | §T3 | T3 form for payment entry with allocation grid |
| Project Context | §15 | XM-006 (unified GL posting) |

---

### Story E17.S4: Credit Management

**User Story:** As a finance manager, I want to set credit limits per customer and have the system check exposure at invoice approval and order confirmation, so that credit risk is controlled with configurable warn/block behaviour.

**Acceptance Criteria:**
1. GIVEN a customer with creditLimit set WHEN the CreditCheckService calculates exposure THEN exposure = outstanding posted invoices + uninvoiced approved orders per BR-AR-009/XM-001.
2. GIVEN exposure exceeds creditLimit WHEN the system setting ar.creditLimitAction = WARN THEN a warning is surfaced but the transaction may proceed per BR-AR-009.
3. GIVEN exposure exceeds creditLimit WHEN the system setting ar.creditLimitAction = BLOCK THEN the transaction is rejected per BR-AR-009.
4. GIVEN credit checks run at invoice approval WHEN the approval endpoint is called THEN the CreditCheckService is invoked per BR-AR-010.
5. GIVEN credit checks run at sales order confirmation WHEN the order approval endpoint is called THEN the same CreditCheckService is invoked per BR-AR-010.
6. GIVEN a customer with blocked = true WHEN any transaction is attempted THEN it is rejected regardless of credit limit per BR-AR-007.

**Key Tasks:**
- [ ] Implement CreditCheckService as shared service in AR module consumed by both AR and Sales (AC: #1, #4, #5)
  - [ ] Calculate exposure: sum outstanding invoices + sum uninvoiced order totals
  - [ ] Compare against customer.creditLimit
  - [ ] Return warning or error based on ar.creditLimitAction setting
- [ ] Integrate CreditCheckService into invoice approval flow (AC: #4)
- [ ] Integrate CreditCheckService into sales order approval flow (AC: #5)
- [ ] Implement blocked customer guard at service layer (AC: #6)
- [ ] Add SystemSetting `ar.creditLimitAction` with values WARN/BLOCK (default: WARN) (AC: #2, #3)
- [ ] Register route: GET `/ar/customers/:id/credit-check` for manual credit exposure check (AC: #1)
- [ ] Write unit tests for exposure calculation, warn vs block modes, and blocked guard (AC: #1–#6)

**FR/NFR:** FR19; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CreditCheckService shared service, credit limit on Customer model |
| API Contracts | §2.9 | GET `/ar/customers/:id/credit-check` |
| Data Models | §3.4 | Customer.creditLimit, Customer.blocked, Customer.onHold |
| State Machines | N/A — credit check is a validation, not a lifecycle |
| Event Catalog | N/A — credit checks do not emit events |
| Business Rules | §4 | BR-AR-007 (blocked rejects all), BR-AR-008 (on-hold warns), BR-AR-009 (credit limit calculation, configurable action), BR-AR-010 (checks at invoice approval + order confirmation) |
| UX Design Spec | §T2 | T2 Record Detail for customer with credit exposure display |
| Project Context | §15 | XM-001 (credit limit checks cross AR and Sales) |

---

### Story E17.S5: Statements & Aged Debtors

**User Story:** As a finance manager, I want to generate customer statements and aged debtors reports, so that I can chase overdue payments and monitor overall AR health.

**Acceptance Criteria:**
1. GIVEN a customer with posted invoices and payments WHEN the user requests a statement via GET `/ar/customers/:id/statement` THEN a customer statement is generated showing all transactions in date order with running balance.
2. GIVEN the statement data WHEN the user generates PDF THEN the Document Templates system creates a formatted PDF statement per the customer statement template.
3. GIVEN the aged debtors report endpoint WHEN a user runs it THEN outstanding invoices are categorised into aging buckets: Current, 30 days, 60 days, 90+ days, with totals per customer and grand totals.
4. GIVEN multiple customers with outstanding balances WHEN the user runs batch statement generation THEN statements are generated for all qualifying customers.
5. GIVEN an overdue invoice WHEN the scheduled job runs THEN an `invoice.overdue` event is emitted for notification and AI briefing integration.

**Key Tasks:**
- [ ] Implement customer statement generation service (AC: #1)
- [ ] Integrate with Document Templates for PDF statement generation (AC: #2)
- [ ] Implement aged debtors report with configurable aging buckets (current/30/60/90+) (AC: #3)
- [ ] Implement batch statement generation endpoint (AC: #4)
- [ ] Implement BullMQ scheduled job for overdue invoice detection and event emission (AC: #5)
- [ ] Register routes: GET `/ar/customers/:id/statement`, GET `/ar/reports/aging`, GET `/ar/reports/overdue`, POST `/ar/reports/statements/batch` (AC: #1–#5)
- [ ] Write unit tests for aging bucket calculation and statement balance accuracy (AC: #1, #3)

**FR/NFR:** FR22, FR24; NFR3 (reports < 5s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | Statement generation, aging report, overdue detection |
| API Contracts | §2.9 | GET `/ar/customers/:id/statement`, GET `/ar/reports/aging`, GET `/ar/reports/overdue`, POST `/ar/reports/statements/batch`, GET `/ar/reports/cash-receipts`, GET `/ar/reports/sales-by-customer` |
| Data Models | §3.4 | CustomerInvoice (outstandingAmount, dueDate for aging), CustomerPayment (for statement) |
| State Machines | N/A — reports are read-only aggregations |
| Event Catalog | §3 | `invoice.overdue` — subscribers: AI Daily Briefing, Notifications, CRM (follow-up activity) |
| Business Rules | §4 | BR-AR-009 (credit limit informs aged debtors context) |
| UX Design Spec | §T8 | T8 Report template for aged debtors report |
| Project Context | §7 | Printer Management for PDF statement generation |

---

### Story E17.S6: AR Screens

**User Story:** As an AR user, I want standardised list views, detail views, and form screens for customers, invoices, and payments, so that I can manage the full AR lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an AR user WHEN they navigate to Customers THEN a T1 Entity List displays customers with columns for number, name, type, balance, credit limit, and status, with search and filters.
2. GIVEN an AR user WHEN they click a customer THEN a T2 Record Detail displays with tabs: Primary (name, type, terms), Addresses, Contacts, Financial (balance, credit exposure), Invoices, Payments, and Activity History.
3. GIVEN an AR user WHEN they navigate to Invoices THEN a T1 list shows invoices with number, customer, date, total, outstanding, and status, with filters for status, type, and date range.
4. GIVEN an AR user WHEN they open an invoice THEN a T3 Header+Lines form displays with ActionBar showing Approve (DRAFT), Post (APPROVED), Void (POSTED), Email (POSTED).
5. GIVEN an AR user WHEN they navigate to Payments THEN a T1 list shows payments with number, customer, amount, method, and status.
6. GIVEN an AR user WHEN they view the aged debtors report THEN a T8 Report screen shows the aging analysis with drill-down to individual invoices.

**Key Tasks:**
- [ ] Build T1 Entity List for Customers with balance and credit indicators (AC: #1)
- [ ] Build T2 Record Detail for Customer with tabbed layout (AC: #2)
- [ ] Build T1 Entity List for Invoices with status/type/date filters (AC: #3)
- [ ] Build T3 Header+Lines form for Invoice with status-driven ActionBar (AC: #4)
- [ ] Build T1 Entity List for Payments (AC: #5)
- [ ] Build T8 Report for Aged Debtors with drill-down (AC: #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR19–FR25; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | All AR entities and relationships |
| API Contracts | §2.9 | All AR endpoints consumed by frontend |
| Data Models | §3.4 | All AR models for form field mapping |
| State Machines | §5.1, §5.2 | CustomerInvoice and CustomerPayment status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §4 | All BR-AR rules inform validation displays |
| UX Design Spec | §T1, §T2, §T3, §T8, §Action Bar | T1 for lists, T2 for customer detail, T3 for invoice form, T8 for aged debtors |
| Project Context | §3 | All strings use translation keys |

---

### Story E17.S7: Mobile Adaptation

**User Story:** As a business owner on mobile, I want to look up customer details, view outstanding balances, and record payment receipts, so that I can manage AR on the go.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they search for a customer THEN they can find customers by name, number, or contact details with results showing balance and status.
2. GIVEN a mobile user WHEN they view a customer THEN they see a summary card with name, outstanding balance, credit limit usage, and recent invoices.
3. GIVEN a mobile user WHEN they view outstanding balances THEN a simplified aged debtors view shows top customers by amount overdue.
4. GIVEN a mobile user WHEN they record a payment receipt THEN a simplified form captures customer, amount, payment method, and saves as DRAFT for desktop posting.
5. GIVEN all mobile AR screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Implement mobile customer search with balance display (AC: #1)
- [ ] Build mobile customer summary card component (AC: #2)
- [ ] Build simplified mobile aged debtors view (AC: #3)
- [ ] Build simplified mobile payment receipt form (AC: #4)
- [ ] Ensure 44x44px touch targets and responsive layout (AC: #5)

**FR/NFR:** FR19, FR21, FR24; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.9 | AR endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only |
| Event Catalog | N/A — mobile receives push notifications for payment events |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story |

---

## Epic E18: Purchase Orders

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E15 (Inventory)
**FRs:** FR41–FR45
**Module Path:** `api/src/modules/purchasing/` (PO and GRN sub-modules)

---

### Story E18.S1: Purchase Orders

**User Story:** As a purchasing officer, I want to create multi-line purchase orders with an approval workflow and the ability to send them to suppliers, so that procurement is formally controlled and auditable.

**Acceptance Criteria:**
1. GIVEN a purchasing officer WHEN they create a PurchaseOrder with supplierId, order lines (item, quantity, unit price), and delivery date THEN the PO is persisted in DRAFT status with auto-generated orderNumber from NumberSeries.
2. GIVEN a DRAFT PO WHEN the manager approves it THEN the supplier is validated (exists, not BLOCKED/TERMINATED), at least one line exists, amounts are valid, status transitions to APPROVED, approvedBy/approvedAt are set, and `purchase.order.approved` event is emitted.
3. GIVEN an APPROVED PO WHEN the officer sends it to the supplier THEN the status transitions to SENT, the PO is emailed as PDF via communications, and `purchase.order.sent` event is emitted.
4. GIVEN a DRAFT or APPROVED PO with no GRNs received WHEN the manager cancels it THEN the status transitions to CANCELLED.
5. GIVEN a PO with GRNs partially received WHEN any user attempts to cancel THEN the system rejects (cannot cancel after receipts).
6. GIVEN a PO WHEN multiple order lines are added THEN each line supports items and services with quantity, unit price, VAT code, and delivery date per line.

**Key Tasks:**
- [ ] Create Prisma models for PurchaseOrder and PurchaseOrderLine (AC: #1, #6)
  - [ ] PurchaseOrder: id, orderNumber (unique, NumberSeries), supplierId FK, status PurchaseOrderStatus enum (9 values), deliveryDate, subtotal, vatAmount, totalAmount, currencyCode, approvedBy, approvedAt, companyId
  - [ ] PurchaseOrderLine: id, orderId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, vatCodeId, lineTotal, quantityReceived, quantityInvoiced, lineStatus PurchaseOrderLineStatus enum (4 values)
- [ ] Implement PO approval with supplier validation and line existence check (AC: #2)
- [ ] Implement PO send with PDF generation and email via communications module (AC: #3)
- [ ] Implement cancellation guard (no GRNs received) (AC: #4, #5)
- [ ] Emit events: `purchase.order.approved`, `purchase.order.sent` (AC: #2, #3)
- [ ] Register routes: CRUD `/ap/purchase-orders`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/send`, POST `/:id/close`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for approval validation, cancellation guard, and event emission (AC: #2, #4, #5)

**FR/NFR:** FR41, FR42, FR45; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | PurchaseOrder/Line models, approval workflow, send to supplier |
| API Contracts | §2.10, §2.12 | CRUD `/ap/purchase-orders`, POST `/:id/approve`, POST `/:id/send`, POST `/:id/close`, POST `/:id/cancel` |
| Data Models | §3.6 | PurchaseOrder (status 9-value enum), PurchaseOrderLine (quantityReceived, quantityInvoiced, lineStatus 4-value enum) |
| State Machines | §4.1, §4.2 | PurchaseOrder: DRAFT→APPROVED→SENT→...→CLOSED/CANCELLED; PurchaseOrderLine: OPEN→PARTIALLY_RECEIVED→RECEIVED |
| Event Catalog | §5 | `purchase.order.approved`, `purchase.order.sent` — subscribers: Notifications, Communications, Audit |
| Business Rules | §5 | BR-PUR-001 (PO→multiple GRNs), BR-PUR-002 (GRN→one PO) |
| UX Design Spec | §T1, §T3 | T1 for PO list, T3 for PO form with header+lines |
| Project Context | §11 | NumberSeries integration, email send via communications module |

---

### Story E18.S2: Goods Receipt Notes

**User Story:** As a warehouse operator, I want to create goods receipt notes from purchase orders with partial and full receipt support, so that received goods are accurately recorded in stock and the PO is tracked to completion.

**Acceptance Criteria:**
1. GIVEN an APPROVED or SENT purchase order WHEN the operator creates a GoodsReceipt THEN a GRN is created in DRAFT status with GoodsReceiptLines pre-populated from PO lines showing ordered quantity and received-to-date.
2. GIVEN a DRAFT GRN WHEN lines are received (partial or full quantities) and the operator posts it THEN the status transitions to POSTED, GOODS_RECEIPT stock movements are created per line, PurchaseOrderLine.quantityReceived is incremented, StockBalance is updated, GL journal entry is created (DR Stock, CR GRN Accrual), and `goods.receipt.posted` event is emitted.
3. GIVEN over-receipt is disabled (ap.allowOverReceipt = false) WHEN the received quantity exceeds the ordered quantity THEN the system rejects per BR-PUR-003.
4. GIVEN over-receipt is enabled WHEN the received quantity exceeds the ordered quantity THEN the system allows with a warning.
5. GIVEN a POSTED GRN WHEN cancelled THEN reversal stock movements are created, PurchaseOrderLine.quantityReceived is decremented, StockBalance is reversed, reversal GL journal entry is created, and `grn.cancelled` event is emitted.
6. GIVEN a PO with all lines fully received WHEN the last GRN is posted THEN the PO status transitions to FULLY_RECEIVED.

**Key Tasks:**
- [ ] Create Prisma models for GoodsReceipt and GoodsReceiptLine (AC: #1)
  - [ ] GoodsReceipt: id, receiptNumber (NumberSeries), purchaseOrderId FK (nullable), supplierId FK, status GoodsReceiptStatus enum (3 values), receiptDate, companyId
  - [ ] GoodsReceiptLine: id, goodsReceiptId FK (cascade), purchaseOrderLineId FK (nullable), itemId, quantity Decimal, unitCost Decimal, warehouseId FK
- [ ] Implement GRN pre-population from PO lines (AC: #1)
- [ ] Implement GRN posting with atomic stock movement creation, PO line update, StockBalance update, and GL posting (AC: #2)
- [ ] Implement over-receipt configurable guard (AC: #3, #4)
- [ ] Implement GRN cancellation with full reversal chain (AC: #5)
- [ ] Implement PO status progression to FULLY_RECEIVED when all lines complete (AC: #6)
- [ ] Emit events: `goods.receipt.posted`, `grn.cancelled` (AC: #2, #5)
- [ ] Register routes: CRUD `/ap/goods-receipts`, GET `/:id/lines`, POST `/:id/post`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for partial receipt, over-receipt guard, and full reversal (AC: #2–#5)

**FR/NFR:** FR43; NFR18 (ACID for stock + GL), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | GoodsReceipt/Line models, stock movement creation, GL posting (DR Stock, CR GRN Accrual) |
| API Contracts | §2.10 | CRUD `/ap/goods-receipts`, GET `/:id/lines`, POST `/:id/post`, POST `/:id/cancel` |
| Data Models | §3.6 | GoodsReceipt (purchaseOrderId, status 3-value enum), GoodsReceiptLine (purchaseOrderLineId, quantity, unitCost, warehouseId) |
| State Machines | §4.3 | GoodsReceipt: DRAFT→POSTED→CANCELLED; side effects (stock movements, GL journal, PO line update) |
| Event Catalog | §5 | `goods.receipt.posted` — subscribers: Inventory (stock movements), Finance (GL), Purchasing (PO update) |
| Business Rules | §5 | BR-PUR-001 (PO→multiple GRNs), BR-PUR-002 (GRN→one PO), BR-PUR-003 (over-receipt configurable) |
| UX Design Spec | §T3 | T3 Header+Lines for GRN form with PO reference and line quantities |
| Project Context | §15 | XM-004 (3-way matching PO→GRN→Bill) |

---

### Story E18.S3: PO Lifecycle & Status

**User Story:** As a purchasing manager, I want to track purchase orders through their full lifecycle from draft to close with partial receipt and invoice tracking, so that procurement status is always visible.

**Acceptance Criteria:**
1. GIVEN a PO in SENT/APPROVED status WHEN a GRN is posted against it THEN the PO transitions to PARTIALLY_RECEIVED if some lines are partially received.
2. GIVEN a PO with all lines having quantityReceived >= quantity WHEN the last GRN posts THEN the PO transitions to FULLY_RECEIVED.
3. GIVEN a received PO WHEN supplier bills are posted against it THEN the PO transitions through PARTIALLY_INVOICED to FULLY_INVOICED as line quantities are invoiced.
4. GIVEN a FULLY_INVOICED PO WHEN the manager closes it THEN the PO transitions to CLOSED (terminal, immutable).
5. GIVEN any PO WHEN viewing its detail THEN the line-level status shows OPEN/PARTIALLY_RECEIVED/RECEIVED/CANCELLED per line.

**Key Tasks:**
- [ ] Implement automatic PO status progression based on line-level receipt quantities (AC: #1, #2)
- [ ] Implement automatic PO status progression based on line-level invoice quantities (AC: #3)
- [ ] Implement manual close action for FULLY_INVOICED POs (AC: #4)
- [ ] Implement PurchaseOrderLine computed status based on quantityReceived vs quantity (AC: #5)
- [ ] Write unit tests for each status transition trigger (AC: #1–#4)

**FR/NFR:** FR45; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | PO lifecycle, automatic status progression from GRN and bill events |
| API Contracts | §2.10 | POST `/ap/purchase-orders/:id/close` |
| Data Models | §3.6 | PurchaseOrder.status (9-value enum), PurchaseOrderLine.quantityReceived/quantityInvoiced/lineStatus |
| State Machines | §4.1, §4.2 | PurchaseOrder full lifecycle: DRAFT→...→CLOSED/CANCELLED; PurchaseOrderLine: OPEN→PARTIALLY_RECEIVED→RECEIVED |
| Event Catalog | §5 | Subscribes to `goods.receipt.posted` and `bill.posted` for status progression |
| Business Rules | §5 | BR-PUR-001 (multiple GRNs per PO drive partial receipt tracking) |
| UX Design Spec | §T2 | T2 Record Detail for PO with receipt/invoice progress indicators |
| Project Context | §11 | Status changes emit typed events |

---

### Story E18.S4: PO Screens

**User Story:** As a purchasing user, I want standardised list and form screens for purchase orders and goods receipts with status-driven action bars, so that I can manage procurement using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a purchasing user WHEN they navigate to Purchase Orders THEN a T1 Entity List displays POs with columns for number, supplier, date, total, status, and receipt progress, with filters for status and supplier.
2. GIVEN a purchasing user WHEN they open a PO THEN a T3 Header+Lines form displays supplier, dates, delivery info in the header and item lines with quantity/price/received in the lines, with ActionBar showing Approve (DRAFT), Send (APPROVED), Receive (SENT).
3. GIVEN a purchasing user WHEN they navigate to Goods Receipts THEN a T1 list shows GRNs with PO reference, supplier, date, and status.
4. GIVEN a purchasing user WHEN they open a GRN THEN a T3 form shows the receipt with line quantities and ActionBar showing Post (DRAFT).
5. GIVEN the ActionBar on PO forms WHEN the PO is in various states THEN only valid transitions are offered: Approve (DRAFT), Send (APPROVED), Close (FULLY_INVOICED), Cancel (DRAFT/APPROVED).

**Key Tasks:**
- [ ] Build T1 Entity List for Purchase Orders with receipt progress column (AC: #1)
- [ ] Build T3 Header+Lines form for PO with supplier lookup and line editor (AC: #2)
- [ ] Build T1 Entity List for Goods Receipts (AC: #3)
- [ ] Build T3 Header+Lines form for GRN with PO pre-population (AC: #4)
- [ ] Implement status-driven ActionBar for PO and GRN forms (AC: #5)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#5)

**FR/NFR:** FR41–FR45; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | All purchasing entities and relationships |
| API Contracts | §2.10 | All PO and GRN endpoints consumed by frontend |
| Data Models | §3.6 | All purchasing models for form field mapping |
| State Machines | §4.1–§4.3 | PO and GRN status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §5 | BR-PUR rules inform validation displays and ActionBar visibility |
| UX Design Spec | §T1, §T3, §Action Bar | T1 for lists, T3 for forms, ActionBar with Approve/Send/Receive/Post actions |
| Project Context | §3 | All strings use translation keys |

---

### Story E18.S5: Mobile Adaptation

**User Story:** As a warehouse operator on mobile, I want to receive goods by scanning items and checking PO status from my device, so that goods receipt can happen on the warehouse floor.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they scan a barcode on received goods THEN the system looks up the item and shows pending PO lines for that item.
2. GIVEN a mobile user WHEN they view the PO list THEN a simplified list shows open POs with supplier, date, total, and receipt status.
3. GIVEN a mobile user WHEN they tap a PO THEN they see a read-only detail with line items and received quantities.
4. GIVEN a mobile user WHEN they start a goods receipt from a PO THEN they can enter received quantities per line (with barcode scan) and save as DRAFT for desktop posting.
5. GIVEN all mobile purchasing screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Implement barcode scan integration for item lookup on received goods (AC: #1)
- [ ] Build mobile PO list with receipt progress indicators (AC: #2)
- [ ] Build mobile PO detail view (read-only) (AC: #3)
- [ ] Build simplified mobile goods receipt form with barcode scanning (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR43, FR46; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native), camera for barcode |
| API Contracts | §2.10, §2.13 | PO and inventory endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only; GRN saved as DRAFT for desktop posting |
| Event Catalog | N/A — mobile receives push for PO events |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets, barcode scanning |
| Project Context | §8 | Mobile as end-of-epic story; goods receipt scanning is key mobile use case |

---

## Epic E19: Purchase Ledger / Accounts Payable (AP)

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E18 (Purchase Orders)
**FRs:** FR26–FR32
**Module Path:** `api/src/modules/purchasing/` (Supplier, Bill, Payment, BACS sub-modules)

---

### Story E19.S1: Supplier Management

**User Story:** As an AP clerk, I want to create and manage supplier records with bank details and payment terms, so that supplier data is centralised for billing, payment processing, and BACS runs.

**Acceptance Criteria:**
1. GIVEN an AP clerk WHEN they create a Supplier with name, supplierType (COMPANY/INDIVIDUAL), and status (ACTIVE) THEN the supplier is persisted with auto-generated supplierNumber from NumberSeries and companyId scoping.
2. GIVEN a supplier WHEN bank details (sortCode, accountNumber, IBAN, BIC) are entered THEN they are stored and validated for BACS payment eligibility per BR-PUR-012.
3. GIVEN a supplier without valid UK bank details (sortCode + accountNumber) WHEN included in a BACS run THEN the system rejects per BR-PUR-012 (bank details required for payment).
4. GIVEN a supplier with status BLOCKED or TERMINATED WHEN a user attempts to create a PO or bill for them THEN the system rejects.
5. GIVEN a supplier with status ON_HOLD WHEN a user creates a PO THEN a warning is surfaced but the transaction may proceed.
6. GIVEN a supplier WHEN payment terms, default currency, and preferred payment method are set THEN these serve as defaults on new bills and payments.

**Key Tasks:**
- [ ] Create Prisma model for Supplier (AC: #1)
  - [ ] Fields: id, supplierNumber (unique, NumberSeries), name, legalName, supplierType SupplierType enum, status SupplierStatus enum (4 values: ACTIVE/ON_HOLD/BLOCKED/TERMINATED), sortCode, accountNumber, iban, bic, bankName, paymentTermsId FK, defaultCurrencyCode, preferredPaymentMethod, vatNumber, isActive, companyId
- [ ] Implement CRUD service with NumberSeries, companyId scoping, and status guards (AC: #1, #4, #5)
- [ ] Implement bank detail validation for BACS eligibility (AC: #2, #3)
- [ ] Register routes: CRUD `/ap/suppliers`, GET `/:id/purchase-history`, GET `/:id/balance` (AC: #1–#6)
- [ ] Write unit tests for status guards and bank detail validation (AC: #3–#5)

**FR/NFR:** FR26; NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Supplier model, bank details, status lifecycle |
| API Contracts | §2.10 | CRUD `/ap/suppliers`, GET `/:id/purchase-history`, GET `/:id/balance` |
| Data Models | §3.6 | Supplier (supplierType enum, status 4-value enum: ACTIVE/ON_HOLD/BLOCKED/TERMINATED, bank detail fields) |
| State Machines | §1 | Reference entity pattern with SupplierStatus enum (not isActive soft-delete — uses explicit status) |
| Event Catalog | N/A — supplier CRUD does not emit events in MVP |
| Business Rules | §5 | BR-PUR-012 (valid UK bank details required for BACS) |
| UX Design Spec | §T1, §T2 | T1 for supplier list, T2 for supplier detail with tabs |
| Project Context | §1 | companyId scoping on all tables |

---

### Story E19.S2: Supplier Bills

**User Story:** As an AP clerk, I want to create, approve, and post supplier bills with GL journal entry generation and PO reference linking, so that expenses are accurately recorded and the AP control account is maintained.

**Acceptance Criteria:**
1. GIVEN an AP clerk WHEN they create a SupplierBill with supplierId, optional purchaseOrderId, and bill lines THEN the bill is persisted in DRAFT status with auto-generated billNumber.
2. GIVEN a DRAFT bill with at least one line WHEN approved THEN 3-way match validation runs (if PO linked), status transitions to APPROVED, and `bill.approved` event is emitted.
3. GIVEN an APPROVED bill WHEN posted THEN a JournalEntry is created (DR PURCHASE_EXPENSE + VAT_INPUT per line, CR AP_CONTROL for total), status transitions to POSTED, PurchaseOrderLine.quantityInvoiced is updated, and `bill.posted` event is emitted per BR-PUR-004 (period lock check).
4. GIVEN a bill of type credit note (negative amounts) WHEN processed THEN it follows the same lifecycle reducing the supplier balance.
5. GIVEN a DRAFT or APPROVED bill WHEN cancelled THEN status transitions to CANCELLED with no GL impact.
6. GIVEN a non-PO bill (direct expense) WHEN created THEN purchaseOrderId is null and no matching validation is required per BR-PUR-005.

**Key Tasks:**
- [ ] Create Prisma models for SupplierBill and SupplierBillLine (AC: #1)
  - [ ] SupplierBill: id, billNumber (NumberSeries), supplierId FK, purchaseOrderId FK (nullable), status SupplierBillStatus enum (6 values), matchStatus MatchStatus enum (3 values), billDate, dueDate, subtotal, vatAmount, totalAmount, outstandingAmount, paidAmount, currencyCode, exchangeRate, journalEntryId, companyId
  - [ ] SupplierBillLine: id, billId FK (cascade), purchaseOrderLineId FK (nullable), itemId, description, quantity, unitPrice, vatCodeId, lineTotal, accountCode
- [ ] Implement bill state machine: DRAFT→APPROVED→POSTED→PARTIALLY_PAID→PAID, DRAFT/APPROVED→CANCELLED (AC: #2–#5)
- [ ] Implement GL posting via createGlPosting() (DR PURCHASE_EXPENSE + VAT_INPUT, CR AP_CONTROL) (AC: #3)
- [ ] Implement period lock check before posting (AC: #3)
- [ ] Integrate 3-way match on approval (placeholder for E19.S3) (AC: #2)
- [ ] Emit events: `bill.approved`, `bill.posted`, `bill.cancelled` (AC: #2, #3, #5)
- [ ] Register routes: CRUD `/ap/supplier-bills`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for each state transition and GL posting (AC: #2–#5)

**FR/NFR:** FR27; NFR36 (double-entry), NFR37 (period locks), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | SupplierBill/Line models, GL posting (DR Expense + VAT, CR AP_CONTROL), PO linking |
| API Contracts | §2.10 | CRUD `/ap/supplier-bills`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void`, GET `/:id/matching` |
| Data Models | §3.6 | SupplierBill (status 6-value enum, matchStatus 3-value enum, purchaseOrderId nullable), SupplierBillLine |
| State Machines | §4.4 | SupplierBill: DRAFT→APPROVED→POSTED→PARTIALLY_PAID→PAID; match status parallel state |
| Event Catalog | §5 | `bill.posted` — subscribers: Finance (GL journal), Audit; `bill.voided` for reversal |
| Business Rules | §5 | BR-PUR-004 (locked period check), BR-PUR-005 (non-PO bills allowed) |
| UX Design Spec | §T3 | T3 Header+Lines for bill form with PO reference and match status indicator |
| Project Context | §15 | XM-006 (unified GL posting), XM-004 (3-way matching) |

---

### Story E19.S3: Three-Way Matching

**User Story:** As an AP manager, I want the system to automatically validate supplier bills against purchase orders and goods receipts on four dimensions, so that pricing and quantity discrepancies are caught before payment.

**Acceptance Criteria:**
1. GIVEN a bill linked to a PO WHEN matching runs THEN the engine validates on four dimensions: quantity ordered vs received vs invoiced, unit price consistency between PO and bill, item identity matching, and line-level cross-reference per BR-PUR-008.
2. GIVEN all dimensions match within tolerance WHEN the match result is classified THEN matchStatus is set to FULLY_MATCHED per BR-PUR-009.
3. GIVEN a price discrepancy beyond tolerance WHEN classified THEN matchStatus is set to PRICE_VARIANCE per BR-PUR-009.
4. GIVEN a quantity discrepancy WHEN classified THEN matchStatus is set to QUANTITY_VARIANCE per BR-PUR-009.
5. GIVEN a user with `ap.approve_mismatch` permission WHEN a bill fails matching THEN they can approve the bill with an override reason recorded in the audit trail per BR-PUR-010.
6. GIVEN `ap.requireMatchBeforePosting = true` (default) WHEN an unmatched/mismatched bill is submitted for posting THEN the system rejects unless a mismatch override has been applied per BR-PUR-011.

**Key Tasks:**
- [ ] Implement 3-way match engine comparing PO lines → GRN lines → Bill lines on 4 dimensions (AC: #1)
- [ ] Implement match status classification: FULLY_MATCHED, PARTIALLY_MATCHED, PRICE_VARIANCE, QUANTITY_VARIANCE, MISMATCHED (AC: #2–#4)
- [ ] Implement mismatch override with permission check and audit logging (AC: #5)
- [ ] Implement `ap.requireMatchBeforePosting` system setting check on bill posting (AC: #6)
- [ ] Register route: GET `/ap/supplier-bills/:id/matching` returning match details per dimension (AC: #1–#4)
- [ ] Write unit tests for each match status scenario and override flow (AC: #1–#6)

**FR/NFR:** FR31; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Three-way matching engine, 4-dimension validation, match status classification |
| API Contracts | §2.10 | GET `/ap/supplier-bills/:id/matching` |
| Data Models | §3.6 | SupplierBill.matchStatus (MatchStatus enum: UNMATCHED/PARTIALLY_MATCHED/FULLY_MATCHED), cross-references to PO and GRN lines |
| State Machines | §4.4 | MatchStatus as parallel state on SupplierBill |
| Event Catalog | N/A — matching is synchronous validation, not event-driven |
| Business Rules | §5 | BR-PUR-008 (4-dimension validation), BR-PUR-009 (status classification), BR-PUR-010 (mismatch override with permission), BR-PUR-011 (requireMatchBeforePosting setting) |
| UX Design Spec | §T3 | Match result display within bill form showing per-dimension status |
| Project Context | §15 | XM-004 (3-way matching PO→GRN→Bill) |

---

### Story E19.S4: Supplier Payments

**User Story:** As a finance clerk, I want to create supplier payments with allocation against bills and support for multiple payment methods, so that AP balances are accurately tracked and suppliers are paid correctly.

**Acceptance Criteria:**
1. GIVEN a finance clerk WHEN they create a SupplierPayment with supplierId, amount, paymentMethod (BACS/BANK_TRANSFER/CHEQUE/DIRECT_DEBIT/CARD), and bankAccountId THEN the payment is persisted in DRAFT status.
2. GIVEN a DRAFT payment WHEN approved THEN the bank account is validated, amount > 0, at least one allocation exists, and status transitions to APPROVED.
3. GIVEN an APPROVED payment WHEN sent/submitted THEN status transitions to SENT with the payment transmitted to the bank.
4. GIVEN a SENT payment WHEN bank confirms processing THEN status transitions to COMPLETED, a JournalEntry is created (DR AP_CONTROL, CR Bank), supplier bill paidAmount/outstandingAmount are updated for all allocations, and `supplier.payment.posted` event is emitted.
5. GIVEN a single payment allocated across multiple bills WHEN posted THEN each SupplierPaymentAllocation updates its respective bill per BR-PUR-006.
6. GIVEN a multi-currency payment WHEN posted at a different rate than the bill THEN FX differences are posted to EXCHANGE_GAIN/EXCHANGE_LOSS accounts per BR-PUR-015.

**Key Tasks:**
- [ ] Create Prisma models for SupplierPayment and SupplierPaymentAllocation (AC: #1, #5)
  - [ ] SupplierPayment: id, paymentNumber (NumberSeries), supplierId FK, bacsRunId FK (nullable), status SupplierPaymentStatus enum (5 values), paymentMethod PaymentMethod(AP) enum, amount Decimal(19,4), bankAccountId FK, currencyCode, exchangeRate, companyId
  - [ ] SupplierPaymentAllocation: id, paymentId FK, billId FK, amount Decimal(19,4)
- [ ] Implement payment state machine: DRAFT→APPROVED→SENT→COMPLETED, DRAFT/APPROVED→CANCELLED (AC: #2–#4)
- [ ] Implement GL posting on completion (DR AP_CONTROL, CR Bank +/- FX) (AC: #4)
- [ ] Implement multi-bill allocation with bill balance updates (AC: #5)
- [ ] Implement FX difference handling (AC: #6)
- [ ] Emit `supplier.payment.posted` event on completion (AC: #4)
- [ ] Register routes: CRUD `/ap/supplier-payments`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for allocation, FX handling, and bill balance updates (AC: #4–#6)

**FR/NFR:** FR28; NFR36 (double-entry), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | SupplierPayment model, allocation pattern, GL posting (DR AP_CONTROL, CR Bank) |
| API Contracts | §2.10 | CRUD `/ap/supplier-payments`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` |
| Data Models | §3.6 | SupplierPayment (status 5-value enum, paymentMethod BACS/BANK_TRANSFER/CHEQUE/DIRECT_DEBIT/CARD, bacsRunId), SupplierPaymentAllocation |
| State Machines | §4.5 | SupplierPayment: DRAFT→APPROVED→SENT→COMPLETED; side effects for GL posting and bill updates |
| Event Catalog | §5 | `supplier.payment.posted` — subscribers: Finance (GL: DR AP_CONTROL, CR Bank), Audit |
| Business Rules | §5 | BR-PUR-006 (single payment across multiple bills), BR-PUR-007 (single bill paid by multiple payments), BR-PUR-015 (FX differences) |
| UX Design Spec | §T3 | T3 form for payment entry with bill allocation grid |
| Project Context | §15 | XM-006 (unified GL posting) |

---

### Story E19.S5: BACS Payment Run

**User Story:** As a finance manager, I want to create BACS payment runs that batch multiple supplier payments into a single file for bank submission, so that bulk payments are processed efficiently with proper approval controls.

**Acceptance Criteria:**
1. GIVEN a finance manager WHEN they create a BacsRun and select outstanding bills for payment THEN SupplierPayment records are created for each supplier/bill combination and linked to the BacsRun in DRAFT status.
2. GIVEN a DRAFT BACS run WHEN approved THEN all suppliers are validated for UK bank details (sortCode + accountNumber), amounts are within bank limits, and status transitions to APPROVED per BR-PUR-012/BR-PUR-014.
3. GIVEN an APPROVED BACS run WHEN the file is generated THEN a BACS-formatted file is created with all payment details, a download URL is provided, fileReference and submittedAt are set, and `bacs.run.submitted` event is emitted.
4. GIVEN a SUBMITTED BACS run WHEN bank confirms processing (T+2 typical) THEN status transitions to COMPLETED, all SupplierPayments in the run move to COMPLETED, GL journal entries are posted for each payment.
5. GIVEN a SUBMITTED BACS run WHEN the bank rejects the file THEN status transitions to FAILED and payments remain unprocessed for manual resolution.
6. GIVEN the BACS file WHEN generated THEN the maximum of 999,999 items per file is enforced per BR-PUR-013.

**Key Tasks:**
- [ ] Create Prisma model for BacsRun (id, status BacsRunStatus enum 5 values, fileReference, submittedAt, totalAmount, paymentCount, companyId) (AC: #1)
- [ ] Implement BacsRun creation with bill selection and SupplierPayment auto-creation (AC: #1)
- [ ] Implement approval with bank detail validation and amount limit checks (AC: #2)
- [ ] Implement BACS file generation service (AC: #3)
- [ ] Implement completion flow cascading to all SupplierPayments (AC: #4)
- [ ] Implement failure handling with manual resolution path (AC: #5)
- [ ] Implement 999,999 item limit validation (AC: #6)
- [ ] Emit `bacs.run.submitted` event (AC: #3)
- [ ] Register routes: CRUD `/ap/bacs-runs`, POST `/:id/approve`, POST `/:id/generate-file`, POST `/:id/submit`, POST `/:id/complete` (AC: #1–#6)
- [ ] Write unit tests for bank detail validation, file generation, and completion cascade (AC: #2–#4)

**FR/NFR:** FR29; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | BacsRun model, BACS file generation, payment cascade on completion |
| API Contracts | §2.10, §3.4 | CRUD `/ap/bacs-runs`, POST `/:id/approve`, POST `/:id/generate-file` (BacsFileResult schema), POST `/:id/submit`, POST `/:id/complete` |
| Data Models | §3.6 | BacsRun (status 5-value enum: DRAFT/APPROVED/SUBMITTED/COMPLETED/FAILED, fileReference, paymentCount, totalAmount) |
| State Machines | §4.6 | BacsRun: DRAFT→APPROVED→SUBMITTED→COMPLETED/FAILED; side effects cascading to SupplierPayments |
| Event Catalog | §5 | `bacs.run.submitted` — subscribers: Notifications (confirm to finance), Audit |
| Business Rules | §5 | BR-PUR-012 (UK bank details required), BR-PUR-013 (999,999 max items), BR-PUR-014 (per-transaction amount limit) |
| UX Design Spec | §T6 | T6 Wizard template for BACS run creation flow |
| Project Context | §11 | BACS is UK-specific payment processing |

---

### Story E19.S6: Aged Creditors

**User Story:** As a finance manager, I want to view aged creditors reports and payment forecasts, so that I can plan cash outflows and identify overdue supplier payments.

**Acceptance Criteria:**
1. GIVEN the aged creditors report endpoint WHEN a user runs it THEN outstanding bills are categorised into aging buckets: Current, 30 days, 60 days, 90+ days, with totals per supplier and grand totals.
2. GIVEN the payment forecast endpoint WHEN a user runs it THEN upcoming payment obligations are projected based on bill due dates and approved POs.
3. GIVEN the aged creditors report WHEN a user drills down on a supplier THEN individual outstanding bills for that supplier are listed with amounts and due dates.
4. GIVEN both reports WHEN generated THEN all amounts use Decimal(19,4) precision and are formatted in the user's locale currency format.

**Key Tasks:**
- [ ] Implement aged creditors report with configurable aging buckets (current/30/60/90+) (AC: #1)
- [ ] Implement payment forecast report from bill due dates and approved PO commitments (AC: #2)
- [ ] Implement drill-down to supplier-level bill detail (AC: #3)
- [ ] Ensure Decimal precision and locale-based formatting (AC: #4)
- [ ] Register routes: GET `/ap/reports/aging`, GET `/ap/reports/overdue`, GET `/ap/reports/payment-forecast` (AC: #1–#4)
- [ ] Write unit tests for aging bucket calculation accuracy (AC: #1)

**FR/NFR:** FR30; NFR3 (reports < 5s), NFR38 (Decimal precision)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Aged creditors reporting, payment forecast |
| API Contracts | §2.10 | GET `/ap/reports/aging`, GET `/ap/reports/overdue`, GET `/ap/reports/payment-forecast`, GET `/ap/reports/purchase-journal` |
| Data Models | §3.6 | SupplierBill (outstandingAmount, dueDate for aging), SupplierPayment |
| State Machines | N/A — reports are read-only aggregations |
| Event Catalog | N/A — reports do not emit events |
| Business Rules | §5 | BR-PUR-004 (period context for reporting) |
| UX Design Spec | §T8 | T8 Report template for aged creditors with drill-down |
| Project Context | §3 | Locale-based formatting via Intl API |

---

### Story E19.S7: AP Screens

**User Story:** As an AP user, I want standardised list views, detail views, and form screens for suppliers, bills, payments, and BACS runs, so that I can manage the full AP lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an AP user WHEN they navigate to Suppliers THEN a T1 Entity List displays suppliers with columns for number, name, type, status, and balance, with filters for status.
2. GIVEN an AP user WHEN they click a supplier THEN a T2 Record Detail displays with tabs: Primary (name, type, bank details), Financial (balance, payment terms), Bills, Payments, Purchase History, and Activity.
3. GIVEN an AP user WHEN they navigate to Bills THEN a T1 list shows bills with number, supplier, date, total, outstanding, status, and match status.
4. GIVEN an AP user WHEN they open a bill THEN a T3 Header+Lines form displays with match status indicator, PO reference, and ActionBar showing Approve (DRAFT), Post (APPROVED).
5. GIVEN an AP user WHEN they navigate to Payments THEN a T1 list shows payments with number, supplier, amount, method, and status.
6. GIVEN an AP user WHEN they view the aged creditors report THEN a T8 Report screen shows the aging analysis with drill-down.

**Key Tasks:**
- [ ] Build T1 Entity List for Suppliers with status/balance indicators (AC: #1)
- [ ] Build T2 Record Detail for Supplier with tabbed layout including bank details (AC: #2)
- [ ] Build T1 Entity List for Bills with match status column (AC: #3)
- [ ] Build T3 Header+Lines form for Bill with 3-way match display and ActionBar (AC: #4)
- [ ] Build T1 Entity List for Payments (AC: #5)
- [ ] Build T8 Report for Aged Creditors with drill-down (AC: #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR26–FR32; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | All AP entities and relationships |
| API Contracts | §2.10 | All AP endpoints consumed by frontend |
| Data Models | §3.6 | All AP models for form field mapping |
| State Machines | §4.4–§4.6 | SupplierBill, SupplierPayment, BacsRun status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §5 | All BR-PUR rules inform validation displays and match status indicators |
| UX Design Spec | §T1, §T2, §T3, §T8, §Action Bar | T1 for lists, T2 for supplier detail, T3 for bill/payment forms, T8 for aged creditors |
| Project Context | §3 | All strings use translation keys |

---

### Story E19.S8: Mobile Adaptation

**User Story:** As a finance manager on mobile, I want to approve supplier bills and check payment status from my phone, so that AP workflows are not blocked when I am away from my desk.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they view pending approvals THEN bills awaiting approval are listed with supplier, amount, due date, and match status.
2. GIVEN a mobile user WHEN they tap a bill for approval THEN they see a summary (supplier, amount, PO reference, match result) with Approve/Reject buttons.
3. GIVEN a mobile user WHEN they approve a bill THEN the bill status transitions to APPROVED and they receive confirmation.
4. GIVEN a mobile user WHEN they check payment status THEN they see recent BACS runs and individual payments with current status.
5. GIVEN all mobile AP screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Build mobile bill approval list with match status indicators (AC: #1)
- [ ] Build mobile bill approval detail with Approve/Reject actions (AC: #2, #3)
- [ ] Build mobile payment/BACS status view (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR27, FR29; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.10 | AP endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | §4.4 | SupplierBill approval transition from DRAFT→APPROVED on mobile |
| Event Catalog | N/A — mobile receives push for approval requests |
| Business Rules | N/A — validation enforced server-side; match display is read-only |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story; bill approval is key mobile AP use case |

# Tier 3: Business Modules (Part B) — Advanced Business Modules + Phase 2+

> Epics E20–E27+ covering Document Understanding, CRM, Fixed Assets, HR/Payroll, Manufacturing/MRP, Reporting Engine, and all Phase 2 expansion modules. Each story follows the 8-Document Rule and includes BDD acceptance criteria, key tasks, and full reference traceability.

**Convention notes:**
- Every story includes a **Reference Documents** table citing all 8 planning artifacts
- BDD scenarios use `Given / When / Then` format
- FR/NFR numbers are from the PRD (`prd.md`)
- Architecture section references use `§` notation
- Business rules use `BR-xxx-nnn` codes from the Business Rules Compendium
- State machine references use `SM:EntityName` notation
- Event references use `domain.entity.action` notation

---

## Epic E20: Document Understanding

> **AI-powered ingestion, extraction, matching, and approval of financial documents (purchase invoices, receipts, credit notes).** Leverages the AI Gateway (E3b) and AI Orchestration (E5) to extract structured data from uploaded/emailed/photographed documents, match to existing records, and create draft transactions following the "Told, Shown, Approve, Done" paradigm.

**Architecture:** §6.10 Document Understanding Pipeline
**Models:** `DocumentIngestion`, `SupplierExtractionProfile`
**State Machine:** SM:DocumentIngestion — `PENDING → PROCESSING → EXTRACTED → MATCHED → REVIEW → APPROVED | REJECTED | FAILED`
**Events:** `document.processing.started`, `document.extraction.completed`, `document.extraction.failed`, `document.matching.completed`, `document.review.required`, `document.approved`, `document.rejected`
**API:** §2.27 — 11 endpoints under `/documents/*`
**Business Rules:** Confidence <70% → REVIEW; new supplier → REVIEW; PO variance >5% → REVIEW
**FRs:** FR164–FR170
**UX Templates:** T2 (Record Detail), T6 (Wizard), T1 (List)

**Dependencies:** E3b (AI Gateway), E5 (AI Orchestration), E19 (Purchase Ledger/AP), E1 (Database + Core Models)

---

### Story E20.S1: Document Upload & Ingestion Pipeline

**User Story:** As a finance user, I want to upload financial documents (PDF, JPEG, PNG, TIFF) via web upload so that the system can begin AI-powered data extraction.

**Acceptance Criteria:**

```gherkin
Scenario: Successful document upload via web
  Given I am logged in as a user with STAFF or higher role
  And I navigate to the Document Understanding module
  When I upload a PDF file under 10MB
  Then the system creates a DocumentIngestion record with status PENDING
  And emits a "document.processing.started" event
  And the document appears in my ingestion queue

Scenario: File format validation
  Given I attempt to upload a .docx file
  When the upload is submitted
  Then the system rejects the upload with translation key "document.error.unsupported_format"
  And no DocumentIngestion record is created

Scenario: File size validation
  Given I attempt to upload a 25MB image file
  When the upload is submitted
  Then the system rejects the upload with translation key "document.error.file_too_large"
  And displays the maximum allowed size

Scenario: Automatic orientation correction
  Given I upload a JPEG image that is rotated 90 degrees
  When the system processes the upload
  Then the image is auto-corrected to proper orientation before extraction
  And the original file is preserved as an attachment

Scenario: Quality validation rejects unreadable documents
  Given I upload a heavily blurred or corrupted image
  When the system attempts quality validation
  Then the DocumentIngestion status transitions to FAILED
  And the user sees translation key "document.error.unreadable_reupload"
```

**Key Tasks:**
1. **Create DocumentIngestion Prisma model** — UUID PK, companyId FK, status enum, fileUrl, mimeType, originalFilename, fileSizeBytes, uploadedById, extractedData (JSON), matchResult (JSON), confidence (Decimal), timestamps
   - Add database indexes on [companyId, status] and [uploadedById]
   - Add @@map("document_ingestions") with snake_case column mapping
2. **Implement file upload endpoint** — `POST /api/v1/documents/upload` with multipart form data
   - Validate file type (PDF, JPEG, PNG, TIFF), file size (<10MB configurable)
   - Store file to configured storage (local/S3) and create DocumentIngestion record
   - Scope by ctx.companyId
3. **Implement file preprocessing service** — orientation correction (sharp/jimp), quality validation (resolution check, blur detection)
   - Emit `document.processing.started` event on successful preprocessing
   - Transition to FAILED on quality check failure
4. **Create ingestion queue list UI** — T1 (Entity List) template showing all documents for current company
   - Columns: filename, status badge, uploaded by, upload date, confidence score
   - Filter by status, date range; sort by date
5. **Write unit tests** — file validation (type, size), model creation, event emission, quality check edge cases
6. **Write integration tests** — full upload flow, storage verification, status transitions

**FR/NFR References:** FR164, FR168, NFR2, NFR8, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR164-FR170) | Functional requirements for document ingestion |
| Architecture | §6.10 Document Understanding Pipeline | Pipeline stages, model definitions, extraction flow |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | List and detail view templates |
| API Contracts | §2.27 Document Understanding | POST /documents/upload endpoint spec |
| Data Models | §18 Document Understanding | DocumentIngestion, SupplierExtractionProfile models |
| State Machine Reference | §19 Document Understanding | SM:DocumentIngestion states and transitions |
| Event Catalog | §18 Document Understanding | document.processing.started event definition |
| Business Rules Compendium | §13.6 Document Understanding | Quality validation and confidence threshold rules |

---

### Story E20.S2: AI Data Extraction Engine

**User Story:** As a finance user, I want the system to automatically extract structured fields (supplier name, invoice number, date, line items, amounts, VAT, payment terms) from uploaded documents so that I can review AI-generated data instead of manually entering it.

**Acceptance Criteria:**

```gherkin
Scenario: Successful extraction from standard UK invoice PDF
  Given a DocumentIngestion record exists with status PROCESSING
  When the AI extraction engine processes the document
  Then structured fields are extracted including supplier name, invoice number, date, line items, amounts, VAT, and payment terms
  And each field has a confidence score between 0.0 and 1.0
  And the extractedData JSON is saved to the DocumentIngestion record
  And the status transitions to EXTRACTED
  And a "document.extraction.completed" event is emitted

Scenario: Extraction with low confidence triggers review
  Given the AI extraction produces overall confidence below 0.70
  When the extraction completes
  Then the status transitions to REVIEW instead of EXTRACTED
  And a "document.review.required" event is emitted

Scenario: Extraction failure handling
  Given the AI extraction engine cannot parse the document
  When the extraction attempt fails after retry
  Then the status transitions to FAILED
  And a "document.extraction.failed" event is emitted with error details
  And the user is notified via the notification system

Scenario: Supplier extraction profile improves accuracy
  Given a SupplierExtractionProfile exists for supplier "ABC Ltd"
  When a new document from "ABC Ltd" is processed
  Then the extraction uses the profile's field mappings and layout hints
  And achieves higher confidence than first-time extraction
```

**Key Tasks:**
1. **Implement AI extraction service** — Call AI Gateway (`aiGateway.complete()`) with document content and extraction prompt
   - Parse response into structured field schema (supplier, invoiceNo, date, lineItems[], amounts, VAT, paymentTerms)
   - Calculate per-field and overall confidence scores
   - All AI calls through AI Gateway — never call Claude API directly
2. **Create SupplierExtractionProfile model** — stores learned field positions and patterns per supplier per company
   - Fields: companyId, supplierId, fieldMappings (JSON), layoutHints (JSON), extractionCount, avgConfidence
3. **Implement confidence threshold logic** — configurable threshold (default 0.70)
   - Below threshold → status REVIEW; above → status EXTRACTED
   - New supplier (no profile) → always REVIEW for first N documents
4. **Implement extraction job processor** — BullMQ job triggered by `document.processing.started` event
   - Retry logic with exponential backoff (max 3 retries per NFR31)
   - Timeout handling for large documents
5. **Write unit tests** — extraction parsing, confidence calculation, threshold routing, profile lookup
6. **Write integration tests** — end-to-end extraction flow with mocked AI Gateway responses

**FR/NFR References:** FR165, FR167, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR165, FR167) | Extraction accuracy requirements (>85%), field-level confidence |
| Architecture | §6.10 Document Understanding Pipeline | Extraction engine design, AI Gateway integration |
| UX Design Specification | T2 (Record Detail) | Detail view for extraction results |
| API Contracts | §2.27 Document Understanding | Extraction-related endpoints |
| Data Models | §18 Document Understanding | SupplierExtractionProfile schema |
| State Machine Reference | §19 Document Understanding | PROCESSING → EXTRACTED / REVIEW / FAILED transitions |
| Event Catalog | §18 Document Understanding | document.extraction.completed, document.extraction.failed events |
| Business Rules Compendium | §13.6 Document Understanding | Confidence thresholds, new supplier rules |

---

### Story E20.S3: Automatic Record Matching

**User Story:** As a finance user, I want the system to automatically match extracted document data to existing supplier records, purchase orders, and GL accounts so that draft transactions are pre-populated with correct references.

**Acceptance Criteria:**

```gherkin
Scenario: Supplier name matches existing supplier record
  Given extraction produced supplier name "ABC Trading Ltd"
  And a supplier record "ABC Trading Limited" exists for the current company
  When the matching engine runs
  Then the extracted document is linked to the matching supplier record
  And the match confidence is recorded

Scenario: PO matching by reference number
  Given extraction produced PO reference "PO-2026-0042"
  And an open purchase order PO-2026-0042 exists
  When the matching engine runs
  Then the document is matched to the purchase order
  And line items are compared for variance checking

Scenario: PO variance exceeds 5% threshold
  Given the extracted invoice total is GBP 1,100
  And the matched PO total is GBP 1,000 (variance = 10%)
  When the variance check runs
  Then the status transitions to REVIEW
  And a "document.review.required" event is emitted with variance details

Scenario: GL account suggestion based on supplier history
  Given supplier "ABC Trading Ltd" has 10 previous invoices all coded to GL account 5100
  When GL account matching runs
  Then GL account 5100 is suggested with high confidence
  And the suggestion appears in the extractedData matchResult

Scenario: No supplier match found
  Given extraction produced supplier name "New Company XYZ"
  And no matching supplier exists
  When the matching engine runs
  Then the status transitions to REVIEW
  And the system suggests creating a new supplier record
```

**Key Tasks:**
1. **Implement supplier matching service** — fuzzy name matching against existing supplier records scoped by companyId
   - Consider aliases, trading names, VAT registration numbers
   - Use RegisterSharingRule for shared supplier visibility
2. **Implement PO matching service** — match by PO reference, supplier + amount combination
   - Calculate line-item variance; flag if >5% (configurable)
   - 3-way matching: PO → goods receipt → invoice
3. **Implement GL account suggestion** — based on supplier history, item categories, and previous coding patterns
4. **Update DocumentIngestion with match results** — populate matchResult JSON with supplier match, PO match, GL suggestions, and per-match confidence scores
   - Transition status to MATCHED (all good) or REVIEW (any issues)
5. **Emit matching events** — `document.matching.completed` with match summary
6. **Write unit tests** — fuzzy matching accuracy, variance calculation, GL suggestion logic
7. **Write integration tests** — full matching pipeline with seeded supplier/PO data

**FR/NFR References:** FR166, FR31, FR32, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR166) | Auto-matching requirements, "told, shown, approve, done" |
| Architecture | §6.10 Document Understanding Pipeline | Matching engine design, supplier fuzzy matching |
| UX Design Specification | T2 (Record Detail) | Match results display layout |
| API Contracts | §2.27 Document Understanding | Match-related endpoints |
| Data Models | §18 Document Understanding, §7 Purchasing | DocumentIngestion.matchResult, PurchaseOrder model |
| State Machine Reference | §19 Document Understanding | EXTRACTED → MATCHED / REVIEW transitions |
| Event Catalog | §18 Document Understanding | document.matching.completed event |
| Business Rules Compendium | §13.6 Document Understanding | PO variance >5% rule, new supplier review rule |

---

### Story E20.S4: Human Review & Correction Interface

**User Story:** As a finance user, I want to review, correct, and approve AI-extracted document records before they are posted so that I can ensure accuracy and provide feedback that improves future extractions.

**Acceptance Criteria:**

```gherkin
Scenario: Review extracted fields with confidence indicators
  Given a DocumentIngestion record is in REVIEW status
  When I open the review interface
  Then I see all extracted fields with colour-coded confidence indicators (green >0.85, amber 0.70-0.85, red <0.70)
  And the original document is displayed side-by-side for comparison
  And low-confidence fields are highlighted for attention

Scenario: Correct extracted field and approve
  Given I am reviewing an extracted document
  And the supplier name field shows "ABC Trding" with confidence 0.62
  When I correct the supplier name to "ABC Trading Ltd" and click Approve
  Then the DocumentIngestion status transitions to APPROVED
  And a "document.approved" event is emitted
  And the correction is fed back to update the SupplierExtractionProfile

Scenario: Reject document
  Given I am reviewing an extracted document
  When I click Reject with reason "Duplicate invoice"
  Then the DocumentIngestion status transitions to REJECTED
  And a "document.rejected" event is emitted with the rejection reason

Scenario: Correction feedback improves future accuracy
  Given I have corrected 5 documents from supplier "ABC Trading Ltd"
  When the system updates the SupplierExtractionProfile
  Then the profile's avgConfidence increases
  And the extractionCount is incremented
  And field mappings are updated with learned corrections
```

**Key Tasks:**
1. **Build review UI** — T2 (Record Detail) with split-pane: original document viewer (left) + extracted fields form (right)
   - Confidence colour coding per field (green/amber/red thresholds)
   - Editable fields with change tracking
   - Match results panel showing suggested supplier, PO, GL mappings
2. **Implement approve endpoint** — `POST /api/v1/documents/:id/approve`
   - Validate all required fields are filled
   - Transition status to APPROVED; emit `document.approved` event
   - Record corrections as feedback
3. **Implement reject endpoint** — `POST /api/v1/documents/:id/reject`
   - Require rejection reason; transition to REJECTED; emit `document.rejected`
4. **Implement feedback loop** — on approval, compare original extraction to corrected values
   - Update SupplierExtractionProfile with corrections
   - Increment extraction count, recalculate average confidence
5. **Write unit tests** — approval validation, rejection with reason, feedback calculation
6. **Write integration tests** — full review-approve cycle, review-reject cycle, profile update verification

**FR/NFR References:** FR167, FR6, FR10, NFR16, NFR27

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR167) | Review and correction requirements, feedback loop |
| Architecture | §6.10 Document Understanding Pipeline | Review stage, feedback mechanism |
| UX Design Specification | T2 (Record Detail) | Split-pane review layout, confidence indicators |
| API Contracts | §2.27 Document Understanding | POST /documents/:id/approve, POST /documents/:id/reject |
| Data Models | §18 Document Understanding | DocumentIngestion.extractedData, SupplierExtractionProfile |
| State Machine Reference | §19 Document Understanding | REVIEW → APPROVED / REJECTED transitions |
| Event Catalog | §18 Document Understanding | document.approved, document.rejected events |
| Business Rules Compendium | §13.6 Document Understanding | Approval guards, rejection reason requirement |

---

### Story E20.S5: Draft Transaction Creation

**User Story:** As a finance user, I want approved document extractions to automatically create draft purchase invoices or expense records so that I can post them through the standard AP workflow.

**Acceptance Criteria:**

```gherkin
Scenario: Approved document creates draft purchase invoice
  Given a DocumentIngestion record transitions to APPROVED
  And the document type is "purchase_invoice"
  When the draft creation handler processes the event
  Then a draft SupplierInvoice is created with extracted header fields
  And line items are populated from extracted line data
  And the original document is attached as an Attachment (cross-cutting)
  And the SupplierInvoice references the DocumentIngestion record

Scenario: VAT calculation on created draft
  Given the extracted data includes line items with VAT amounts
  When the draft purchase invoice is created
  Then VAT is calculated per line item using the matched VAT code
  And the invoice total matches the extracted total (within rounding tolerance)

Scenario: Multi-line item document
  Given an invoice with 15 line items is extracted and approved
  When the draft is created
  Then all 15 line items appear on the draft purchase invoice
  And each line has item, description, quantity, unit price, VAT code, and amount

Scenario: Draft links back to source document
  Given a draft purchase invoice was created from document ingestion
  When I view the purchase invoice
  Then I see a link to the source DocumentIngestion record
  And the source document is viewable as an attachment
```

**Key Tasks:**
1. **Implement draft creation event handler** — subscribe to `document.approved` event
   - Map extracted fields to SupplierInvoice model (header + lines)
   - Apply VAT calculation using matched VAT codes
   - Create attachment linking original document
   - Set SupplierInvoice status to DRAFT
2. **Handle different document types** — purchase invoices, credit notes, expense claims
   - Route to appropriate draft creation logic based on extracted document type
3. **Implement rounding tolerance** — allow small rounding differences between extracted totals and calculated totals (configurable, default 0.01)
4. **Create RecordLink** — link DocumentIngestion to created SupplierInvoice (polymorphic cross-cutting entity)
5. **Write unit tests** — field mapping, VAT calculation, multi-line creation, rounding tolerance
6. **Write integration tests** — full extraction-to-draft pipeline

**FR/NFR References:** FR166, FR27, FR31, FR89, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR166) | Auto-creation of draft records |
| Architecture | §6.10 Document Understanding Pipeline, §2.13 AP | Draft creation from extraction, SupplierInvoice model |
| UX Design Specification | T3 (Header+Lines Document) | Purchase invoice layout for created draft |
| API Contracts | §2.27 Document Understanding, §2.10 AP | Draft creation endpoints |
| Data Models | §18 Document Understanding, §7 Purchasing | DocumentIngestion → SupplierInvoice mapping |
| State Machine Reference | §19 Document Understanding, §4 AP | APPROVED side effect → create draft |
| Event Catalog | §18 Document Understanding | document.approved event subscription |
| Business Rules Compendium | §13.6 Document Understanding, §4 AP | Rounding tolerance, VAT calculation rules |

---

### Story E20.S6: Document Knowledge Base (RAG)

**User Story:** As an administrator, I want to upload company documents (handbooks, policy manuals, contracts) for AI indexing so that users can ask natural language questions and receive accurate answers with source citations.

**Acceptance Criteria:**

```gherkin
Scenario: Upload company document for indexing
  Given I am logged in as ADMIN
  When I upload a company handbook PDF to the Knowledge Base
  Then the document is chunked, embedded, and stored in the vector database
  And the document appears in the Knowledge Base document list
  And the indexing status shows "Indexed" when complete

Scenario: Natural language question with source citation
  Given the employee handbook has been indexed
  When a user asks "What is the annual leave policy?"
  Then the system retrieves relevant document chunks via RAG
  And returns an answer with source document name and page/section reference
  And the answer is generated through the AI Gateway

Scenario: Access control on knowledge base queries
  Given confidential documents are uploaded with restricted access
  When a STAFF user queries the knowledge base
  Then only documents the user has access to are included in the search
  And confidential documents are excluded from results

Scenario: Document re-indexing on update
  Given a company handbook was previously indexed
  When the admin uploads a new version of the handbook
  Then the old index entries are replaced with new ones
  And queries return answers based on the updated content
```

**Key Tasks:**
1. **Implement document upload for Knowledge Base** — `POST /api/v1/documents/knowledge-base/upload`
   - Accept PDF, DOCX formats; validate and store
   - Trigger async indexing job via BullMQ
2. **Implement document chunking and embedding** — split documents into overlapping chunks
   - Generate embeddings via AI Gateway
   - Store chunks + embeddings in vector store (pgvector extension)
3. **Implement RAG query endpoint** — `POST /api/v1/documents/knowledge-base/query`
   - Vector similarity search for relevant chunks
   - Pass chunks as context to AI Gateway for answer generation
   - Return answer with source citations (document name, page, section)
4. **Implement access control** — scope knowledge base documents by companyId and optional access roles
5. **Build Knowledge Base management UI** — T1 (Entity List) for document listing; upload dialog; indexing status
6. **Write unit tests** — chunking logic, access control filtering, citation formatting
7. **Write integration tests** — upload-index-query cycle with mocked AI Gateway

**FR/NFR References:** FR169, FR170, FR1, FR4, NFR1, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR169, FR170) | Knowledge base and RAG query requirements |
| Architecture | §6.10 Document Understanding Pipeline | RAG architecture, vector store design |
| UX Design Specification | T1 (Entity List), T7 (Settings) | Knowledge base document list, admin config |
| API Contracts | §2.27 Document Understanding | Knowledge base upload and query endpoints |
| Data Models | §18 Document Understanding | Document chunk and embedding models |
| State Machine Reference | §19 Document Understanding | Document indexing lifecycle |
| Event Catalog | §18 Document Understanding | document.indexing.completed event |
| Business Rules Compendium | §13.6 Document Understanding | Access control rules for knowledge base |

---

### Story E20.S7: Mobile Adaptation — Document Understanding

**User Story:** As a mobile user, I want to photograph receipts and invoices using my phone camera and submit them for AI extraction so that I can capture expenses on the go.

**Acceptance Criteria:**

```gherkin
Scenario: Camera capture and upload from mobile
  Given I am on the mobile app (Expo)
  When I tap "Capture Document" and take a photo of a receipt
  Then the image is uploaded to the document ingestion pipeline
  And I see the upload status in my mobile document queue

Scenario: View extraction results on mobile
  Given a document I uploaded has been extracted
  When I view the document in the mobile app
  Then I see a simplified view of extracted fields
  And I can approve or request desktop review

Scenario: Push notification on extraction completion
  Given I uploaded a document from my mobile
  When the extraction completes
  Then I receive a push notification with the extraction summary
  And tapping the notification opens the document review

Scenario: Offline camera capture with sync
  Given my mobile device is offline
  When I photograph a receipt
  Then the image is queued locally
  And when connectivity restores the image is uploaded automatically
```

**Key Tasks:**
1. **Implement mobile camera capture** — Expo Camera integration with image quality validation
   - Auto-crop, perspective correction hints
   - Offline queue with background upload on connectivity restore
2. **Create mobile document list** — simplified T1 view showing upload status, extraction status
3. **Create mobile review summary** — read-only extraction results with approve/defer actions
4. **Implement push notifications** — trigger on `document.extraction.completed` for mobile-uploaded documents
5. **Write unit tests** — offline queue logic, camera capture validation
6. **Write integration tests** — mobile upload → extraction → notification flow

**FR/NFR References:** FR164, FR168, NFR6, NFR21

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR164, FR168) | Mobile camera capture, format support |
| Architecture | §6.10 Document Understanding Pipeline | Mobile upload integration points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns, Expo scaffold |
| API Contracts | §2.27 Document Understanding | Same upload endpoints used by mobile |
| Data Models | §18 Document Understanding | DocumentIngestion model (same as web) |
| State Machine Reference | §19 Document Understanding | Same state machine for mobile-originated documents |
| Event Catalog | §18 Document Understanding | document.extraction.completed for push notification trigger |
| Business Rules Compendium | §13.6 Document Understanding | Same validation and confidence rules apply |

---

## Epic E21: CRM (Customer Relationship Management)

> **Full CRM module with leads, opportunities, campaigns, activities, and pipeline management.** Integrates with Sales (E16), AR (E17), and the AI layer for intelligent lead scoring and activity recommendations.

**Architecture:** §2.21 CRM
**Models:** 16 models — `CrmLead`, `CrmLeadStatusChange`, `CrmOpportunity`, `CrmOpportunityStageChange`, `CrmCampaign`, `CrmCampaignRecipient`, `CrmCampaignResponse`, `CrmActivity`, `CrmActivityType`, `CrmActivityTypeGroup`, `CrmPipelineStage`, `CrmTerritory`, `CrmAutoRule`, `CrmAutoRuleCondition`, `CrmAutoRuleAction`, plus Customer (from AR)
**State Machines:** SM:CrmLead, SM:CrmCampaign, SM:CrmOpportunity
**Events:** `lead.created`, `lead.converted`, `opportunity.won`, `opportunity.lost`, `campaign.activated`, `activity.created`
**API:** §2.15 — ~39 endpoints under `/crm/*`
**Business Rules:** BR-CRM-001 to BR-CRM-020
**FRs:** FR54–FR58, FR95–FR100
**UX Templates:** T1 (Entity List), T2 (Record Detail), T4 (Briefing), T5 (Board/Kanban), T7 (Settings)

**Dependencies:** E17 (Sales Ledger/AR for customer records), E16 (Sales Orders for quote/order linking), E5 (AI Orchestration), E9 (Notifications), E11 (Tasks)

---

### Story E21.S1: Lead Management

**User Story:** As a sales user, I want to create and manage leads with status tracking so that I can qualify prospects and convert them to customers and opportunities.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new lead
  Given I am logged in as STAFF or higher
  When I create a lead with company name, contact name, email, source, and rating
  Then a CrmLead record is created with status NEW scoped to my companyId
  And a "lead.created" event is emitted
  And the lead appears in the leads list

Scenario: Assign lead rating
  Given a lead exists with no rating
  When I set the lead rating to "Hot"
  Then the rating is updated to HOT
  And a CrmLeadStatusChange record is created tracking the change

Scenario: Progress lead through qualification stages
  Given a lead has status NEW
  When I change the status to CONTACTED, then QUALIFIED
  Then each status change is recorded in CrmLeadStatusChange with timestamp and userId
  And the lead's status field reflects the latest state

Scenario: Convert lead to customer and opportunity
  Given a lead has status QUALIFIED
  When I trigger lead conversion
  Then a new Customer record is created from the lead data
  And a new CrmOpportunity record is created linked to the customer
  And the lead status changes to CONVERTED
  And a "lead.converted" event is emitted

Scenario: Lead conversion prevents re-conversion
  Given a lead has status CONVERTED
  When I attempt to convert it again
  Then the system rejects the action with "lead.error.already_converted"

Scenario: Duplicate lead detection
  Given a lead exists with email "john@example.com"
  When I create a new lead with the same email
  Then the system warns about the potential duplicate
  And allows the user to proceed or merge
```

**Key Tasks:**
1. **Create CrmLead model and migration** — all fields per Architecture §2.21 (companyId, name, contactName, email, phone, source, rating enum, status enum, assignedToId, convertedCustomerId, convertedOpportunityId, etc.)
   - CrmLeadStatusChange for audit trail of status changes
2. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/leads` with companyId scoping
   - List with cursor-based pagination, filter by status/rating/assigned
3. **Implement lead conversion service** — create Customer + CrmOpportunity from lead data
   - Validate QUALIFIED status guard (BR-CRM-003)
   - Emit `lead.converted` event with customerId and opportunityId
4. **Implement duplicate detection** — match by email, phone, company name with fuzzy matching
5. **Build leads list UI** — T1 template with status badges, rating indicators, assigned user
6. **Build lead detail UI** — T2 template with all fields, status change history, conversion button
7. **Write unit tests** — CRUD validation, conversion guards, duplicate detection
8. **Write integration tests** — full lead lifecycle from creation to conversion

**FR/NFR References:** FR54, FR56, FR99, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54, FR56, FR99) | Lead management, status tracking, conversion |
| Architecture | §2.21 CRM | CrmLead model, conversion flow, duplicate detection |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Lead list and detail layouts |
| API Contracts | §2.15 CRM | Lead CRUD endpoints, conversion endpoint |
| Data Models | §11 CRM | CrmLead, CrmLeadStatusChange models |
| State Machine Reference | §8 CRM | SM:CrmLead — NEW → CONTACTED → QUALIFIED → CONVERTED / CLOSED |
| Event Catalog | §7 CRM | lead.created, lead.converted events |
| Business Rules Compendium | §6 CRM | BR-CRM-001 to BR-CRM-005 (lead rules) |

---

### Story E21.S2: Opportunity & Pipeline Management

**User Story:** As a sales user, I want to manage sales opportunities with pipeline stages, probability weighting, and expected revenue so that I can track and forecast my sales pipeline.

**Acceptance Criteria:**

```gherkin
Scenario: Create opportunity from lead conversion
  Given a lead is converted
  When the opportunity is created
  Then it has the linked customer, initial pipeline stage, and estimated value
  And the opportunity appears in the pipeline board

Scenario: Move opportunity through pipeline stages
  Given an opportunity is at stage "Qualification"
  When I drag it to "Proposal" on the Kanban board
  Then the stage is updated and a CrmOpportunityStageChange record is created
  And the probability percentage updates per the stage default (BR-CRM-008)
  And the weighted value recalculates automatically

Scenario: Won opportunity
  Given an opportunity is at stage "Negotiation"
  When I mark the opportunity as WON with actual revenue
  Then the status changes to WON
  And an "opportunity.won" event is emitted
  And the close date is recorded

Scenario: Lost opportunity with reason
  Given an opportunity exists at any stage
  When I mark it as LOST with reason "Price too high"
  Then the status changes to LOST
  And the loss reason is recorded
  And an "opportunity.lost" event is emitted

Scenario: Pipeline weighted value calculation
  Given 3 opportunities: GBP 10,000 at 25%, GBP 20,000 at 50%, GBP 5,000 at 75%
  When I view the pipeline summary
  Then the total weighted value shows GBP 16,250
  And the total unweighted value shows GBP 35,000
```

**Key Tasks:**
1. **Create CrmOpportunity model and migration** — companyId, customerId, title, description, stageId, probability, estimatedValue, weightedValue, expectedCloseDate, status, actualRevenue, lossReason, etc.
   - CrmOpportunityStageChange for stage change audit trail
2. **Create CrmPipelineStage model** — companyId, name, sortOrder, defaultProbability, isWon, isLost
   - Seed default pipeline stages (Lead, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)
3. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/opportunities`
   - Stage change endpoint with automatic probability update
   - Win/Lose endpoints with side effects
4. **Build pipeline Kanban board** — T5 (Board/Kanban) template
   - Drag-and-drop between stages; visual cards with customer, value, expected close date
   - Summary row with totals per stage (count, weighted value)
5. **Build opportunity detail** — T2 template with full fields, stage change history, linked activities
6. **Implement weighted value calculation** — estimatedValue * (probability / 100)
7. **Write unit tests** — stage transition validation, weighted value calculation, win/lose guards
8. **Write integration tests** — full opportunity lifecycle, pipeline board data retrieval

**FR/NFR References:** FR57, FR96, FR97, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR57, FR96, FR97) | Pipeline management, weighted values, Kanban board |
| Architecture | §2.21 CRM | CrmOpportunity model, pipeline stage configuration |
| UX Design Specification | T5 (Board/Kanban), T2 (Record Detail) | Pipeline Kanban layout, opportunity detail |
| API Contracts | §2.15 CRM | Opportunity CRUD, stage change, win/lose endpoints |
| Data Models | §11 CRM | CrmOpportunity, CrmPipelineStage, CrmOpportunityStageChange |
| State Machine Reference | §8 CRM | SM:CrmOpportunity — stage transitions, WON/LOST terminal states |
| Event Catalog | §7 CRM | opportunity.won, opportunity.lost events |
| Business Rules Compendium | §6 CRM | BR-CRM-006 to BR-CRM-010 (opportunity rules) |

---

### Story E21.S3: Campaign Management

**User Story:** As a marketing user, I want to create and manage marketing campaigns with recipient lists, status tracking, and response analysis so that I can measure campaign effectiveness and generate leads.

**Acceptance Criteria:**

```gherkin
Scenario: Create a marketing campaign
  Given I am logged in with STAFF or higher role
  When I create a campaign with name, type (Email/Direct Mail/Event/Telemarketing), start/end dates, and budget
  Then a CrmCampaign record is created with status DRAFT
  And the campaign appears in the campaign list

Scenario: Add recipients to campaign
  Given a campaign exists in DRAFT status
  When I add recipients from the customer/lead database (filtered by segment)
  Then CrmCampaignRecipient records are created for each recipient
  And the recipient count is updated on the campaign

Scenario: Activate campaign
  Given a campaign is in DRAFT status with at least one recipient
  When I activate the campaign
  Then the status changes to ACTIVE
  And a "campaign.activated" event is emitted

Scenario: Record campaign responses
  Given a campaign is ACTIVE
  When I record a response for a recipient (Interested, Not Interested, Subscribed, Bounced)
  Then a CrmCampaignResponse record is created
  And the response statistics are updated (response rate, conversion rate)

Scenario: Campaign analytics
  Given a campaign has 100 recipients with 25 responses (15 interested, 10 not interested)
  When I view the campaign analytics
  Then I see response rate (25%), interest rate (15%), ROI calculation if revenue is tracked
```

**Key Tasks:**
1. **Create CrmCampaign model and migration** — companyId, name, type enum, status enum, startDate, endDate, budget, actualCost, description
   - CrmCampaignRecipient: campaignId, entityType (Lead/Customer), entityId, sentDate
   - CrmCampaignResponse: recipientId, responseType enum, responseDate, notes
2. **Implement campaign CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/campaigns`
   - Recipients management: add/remove/bulk-add
   - Response recording: `POST /api/v1/crm/campaigns/:id/responses`
3. **Implement campaign activation** — validate has recipients; transition DRAFT → ACTIVE; emit event
4. **Build campaign list UI** — T1 template with status, type, date range, recipient count, response rate
5. **Build campaign detail** — T2 template with recipients tab, responses tab, analytics summary
6. **Implement campaign analytics** — calculate response rate, conversion rate, cost per lead, ROI
7. **Write unit tests** — activation guards, analytics calculations, response recording
8. **Write integration tests** — full campaign lifecycle

**FR/NFR References:** FR95, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR95) | Campaign management, recipient lists, response analysis |
| Architecture | §2.21 CRM | CrmCampaign model, campaign types, analytics |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Campaign list and detail layouts |
| API Contracts | §2.15 CRM | Campaign CRUD, recipients, responses endpoints |
| Data Models | §11 CRM | CrmCampaign, CrmCampaignRecipient, CrmCampaignResponse |
| State Machine Reference | §8 CRM | SM:CrmCampaign — DRAFT → ACTIVE → COMPLETED / CANCELLED |
| Event Catalog | §7 CRM | campaign.activated event |
| Business Rules Compendium | §6 CRM | BR-CRM-011 to BR-CRM-015 (campaign rules) |

---

### Story E21.S4: Activity Tracking & Auto-Rules

**User Story:** As a sales user, I want to log and track activities (calls, meetings, emails, notes) against CRM records, and as an administrator, I want to configure auto-rules that automatically create activities on key CRM events.

**Acceptance Criteria:**

```gherkin
Scenario: Log an activity against a lead
  Given a lead "John Smith" exists
  When I log a phone call activity with date, duration, summary, and next action
  Then a CrmActivity record is created linked to the lead
  And an "activity.created" event is emitted
  And the lead's lastActivityDate is updated

Scenario: View activity timeline
  Given a customer has 15 activities (calls, meetings, emails)
  When I view the customer's activity tab
  Then activities are displayed in reverse chronological order
  And each shows type icon, date, summary, and who logged it

Scenario: Configure activity auto-rule
  Given I am an ADMIN user
  When I create an auto-rule: "When lead status changes to CONTACTED, create Call activity assigned to lead owner"
  Then a CrmAutoRule record is created with conditions and actions
  And the rule appears in the auto-rules configuration list

Scenario: Auto-rule triggers activity creation
  Given an auto-rule exists for "lead status changed to CONTACTED"
  When a lead's status changes to CONTACTED
  Then a CrmActivity is automatically created per the rule's action
  And the activity is assigned to the lead owner
  And an "activity.created" event is emitted

Scenario: Configure activity types and groups
  Given I am an ADMIN user
  When I create an activity type "Site Visit" in group "Field Sales"
  Then the activity type is available for logging activities
  And it appears grouped under "Field Sales" in activity type selectors
```

**Key Tasks:**
1. **Create CrmActivity model and migration** — companyId, activityTypeId, entityType, entityId (polymorphic), subject, description, activityDate, durationMinutes, assignedToId, completedAt
   - CrmActivityType: companyId, name, groupId, isActive
   - CrmActivityTypeGroup: companyId, name, sortOrder
2. **Create CrmAutoRule model** — companyId, name, triggerEvent, isActive
   - CrmAutoRuleCondition: ruleId, field, operator, value
   - CrmAutoRuleAction: ruleId, actionType, config (JSON)
3. **Implement activity CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/activities`
   - Filter by entity, type, date range, assigned user
4. **Implement auto-rule engine** — subscribe to CRM events; evaluate conditions; execute actions
   - Actions: create activity, send notification, update field
5. **Build activity timeline component** — reusable component for any entity's activity tab
6. **Build auto-rules admin UI** — T7 (Settings) template for rule configuration
7. **Write unit tests** — activity validation, auto-rule evaluation, condition matching
8. **Write integration tests** — auto-rule trigger → activity creation flow

**FR/NFR References:** FR55, FR58, FR98, FR100, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR55, FR98, FR100) | Activity logging, auto-rules, activity types |
| Architecture | §2.21 CRM | CrmActivity model, auto-rule engine design |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Activity timeline component, auto-rules settings |
| API Contracts | §2.15 CRM | Activity CRUD, auto-rule configuration endpoints |
| Data Models | §11 CRM | CrmActivity, CrmAutoRule, CrmAutoRuleCondition, CrmAutoRuleAction |
| State Machine Reference | §8 CRM | Activity auto-creation as side effect of lead/opportunity transitions |
| Event Catalog | §7 CRM | activity.created event, auto-rule subscription events |
| Business Rules Compendium | §6 CRM | BR-CRM-016 to BR-CRM-020 (activity and auto-rule rules) |

---

### Story E21.S5: Territory Management

**User Story:** As a sales manager, I want to define sales territories and assign leads/customers to territories so that I can manage coverage and assign ownership across geographic or segment-based regions.

**Acceptance Criteria:**

```gherkin
Scenario: Create a sales territory
  Given I am a MANAGER or higher
  When I create a territory "London South" with description and assigned user
  Then a CrmTerritory record is created scoped to my companyId

Scenario: Assign lead to territory
  Given a territory "London South" exists
  When I assign a lead to this territory
  Then the lead's territoryId is updated
  And filtering leads by territory shows the lead

Scenario: Territory hierarchy
  Given territories "UK" → "London" → "London South" exist
  When I view the territory tree
  Then territories display in a hierarchical structure
  And selecting "London" shows leads from "London" and its children

Scenario: Territory performance report
  Given territory "London South" has 10 leads and 5 opportunities
  When I view the territory summary
  Then I see lead count, opportunity count, pipeline value, and conversion rate for the territory
```

**Key Tasks:**
1. **Create CrmTerritory model** — companyId, name, description, parentTerritoryId (self-referential), assignedToId, isActive
2. **Implement territory CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/territories`
   - Include hierarchy endpoints: GET with tree structure
3. **Add territoryId to CrmLead and Customer** — FK relationship
4. **Build territory management UI** — T1 list with tree view option
5. **Implement territory-based filtering** — leads and opportunities filterable by territory (including children)
6. **Write unit tests** — hierarchy queries, territory assignment
7. **Write integration tests** — territory CRUD and lead assignment

**FR/NFR References:** FR54, FR56, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54) | Contact and account management, territory concept |
| Architecture | §2.21 CRM | CrmTerritory model, hierarchy |
| UX Design Specification | T1 (Entity List) | Territory list with tree view |
| API Contracts | §2.15 CRM | Territory CRUD endpoints |
| Data Models | §11 CRM | CrmTerritory with self-referential parent |
| State Machine Reference | §8 CRM | N/A — territories are reference data |
| Event Catalog | §7 CRM | Territory assignment events |
| Business Rules Compendium | §6 CRM | Territory assignment rules |

---

### Story E21.S6: Pipeline Reporting & Dashboards

**User Story:** As a sales manager, I want to view pipeline reports with stage analysis, conversion rates, and forecasting so that I can make data-driven sales decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Pipeline summary by stage
  Given multiple opportunities exist across pipeline stages
  When I view the pipeline report
  Then I see a summary per stage: count, total value, weighted value, average days in stage

Scenario: Conversion funnel analysis
  Given opportunities have moved through stages over the last quarter
  When I view the conversion funnel
  Then I see the conversion rate between each adjacent stage pair
  And the overall lead-to-win conversion rate

Scenario: Sales forecast by month
  Given opportunities have expected close dates in the next 3 months
  When I view the sales forecast
  Then I see projected revenue per month (weighted and unweighted)
  And can compare to target if targets are configured

Scenario: Filter reports by date range, owner, territory
  Given pipeline reports are displayed
  When I filter by owner "Jane Smith" and date range "last 90 days"
  Then only Jane's opportunities within the date range are included
```

**Key Tasks:**
1. **Implement pipeline report endpoint** — `GET /api/v1/crm/reports/pipeline`
   - Aggregate by stage: count, total, weighted, avg duration
   - Filter by owner, territory, date range, customer
2. **Implement funnel report** — `GET /api/v1/crm/reports/funnel`
   - Calculate conversion rates between stages
3. **Implement forecast endpoint** — `GET /api/v1/crm/reports/forecast`
   - Group by expected close month, sum weighted/unweighted values
4. **Build pipeline dashboard** — T4 (Briefing) template with charts and KPIs
   - Bar chart for pipeline by stage, funnel visualization, forecast line chart
5. **Write unit tests** — aggregation calculations, conversion rate math
6. **Write integration tests** — report endpoints with seeded opportunity data

**FR/NFR References:** FR57, FR96, FR97, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR57, FR96, FR97) | Pipeline reporting, weighted values, Kanban |
| Architecture | §2.21 CRM | Reporting queries, pipeline analytics |
| UX Design Specification | T4 (Briefing), T5 (Board/Kanban) | Dashboard and Kanban layouts |
| API Contracts | §2.15 CRM | Report endpoints: pipeline, funnel, forecast |
| Data Models | §11 CRM | CrmOpportunity, CrmPipelineStage for aggregation |
| State Machine Reference | §8 CRM | Opportunity state data for funnel analysis |
| Event Catalog | §7 CRM | Events used for real-time dashboard updates |
| Business Rules Compendium | §6 CRM | Weighted value calculation rules |

---

### Story E21.S7: CRM-Sales Integration

**User Story:** As a sales user, I want CRM records linked to sales transactions (quotes, orders, invoices) so that I can track the full customer journey from lead to revenue.

**Acceptance Criteria:**

```gherkin
Scenario: Link opportunity to sales quote
  Given an opportunity exists for customer "ABC Ltd"
  When I create a sales quote from the opportunity
  Then the quote is created with customer and estimated value pre-filled
  And a RecordLink is created between the opportunity and the quote

Scenario: Opportunity updates on quote acceptance
  Given a quote linked to an opportunity is accepted by the customer
  When the quote converts to a sales order
  Then the opportunity's linked records are updated
  And actual revenue data flows back to the opportunity

Scenario: View complete customer journey
  Given a customer went through Lead → Opportunity → Quote → Order → Invoice
  When I view the customer's CRM record
  Then I see a timeline showing each stage of the journey with dates and values
  And each record is clickable to navigate to the detail view

Scenario: CRM activity feed includes sales events
  Given a sales invoice is posted for a CRM customer
  When I view the customer's activity feed in CRM
  Then the invoice posting appears as an activity entry
```

**Key Tasks:**
1. **Implement opportunity-to-quote conversion** — `POST /api/v1/crm/opportunities/:id/create-quote`
   - Pre-fill quote from opportunity data (customer, estimated value, description)
   - Create RecordLink between opportunity and quote
2. **Implement sales event subscription** — subscribe to `salesOrder.confirmed`, `invoice.posted` events
   - Create CrmActivity records for sales events on CRM-linked customers
3. **Build customer journey view** — timeline component on customer/opportunity detail showing linked records
4. **Implement bidirectional RecordLinks** — CRM ↔ Sales module cross-references
5. **Write unit tests** — conversion logic, event handling, RecordLink creation
6. **Write integration tests** — full journey from opportunity to invoice with CRM visibility

**FR/NFR References:** FR58, FR34, FR37, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR58) | Link CRM records to sales transactions |
| Architecture | §2.21 CRM, §2.15 Sales | Cross-module integration points |
| UX Design Specification | T2 (Record Detail) | Customer journey timeline component |
| API Contracts | §2.15 CRM, §2.8 Sales | Conversion and linking endpoints |
| Data Models | §11 CRM, §5 Sales, §10 Cross-Cutting | RecordLink polymorphic model |
| State Machine Reference | §8 CRM, §3 Sales | Opportunity stage → sales order lifecycle |
| Event Catalog | §7 CRM, §3 Sales | Cross-module event subscriptions |
| Business Rules Compendium | §6 CRM | CRM-Sales linking rules |

---

### Story E21.S8: AI-Powered CRM Features

**User Story:** As a sales user, I want AI-powered lead scoring, activity recommendations, and next-best-action suggestions so that I can prioritise my time on the highest-value opportunities.

**Acceptance Criteria:**

```gherkin
Scenario: AI lead scoring
  Given a lead has activity history, company size, industry, and engagement data
  When the AI scoring engine evaluates the lead
  Then a lead score (0-100) is calculated and displayed
  And the score factors are explainable (shown on hover)

Scenario: Activity recommendation
  Given an opportunity has had no activity for 14 days
  When I view the opportunity
  Then the AI suggests a next activity (e.g., "Schedule a follow-up call — last contact was 14 days ago")
  And I can accept the suggestion with one tap

Scenario: Next-best-action on daily briefing
  Given I have 5 open opportunities
  When I view my CRM daily briefing
  Then the AI prioritises actions by expected impact
  And shows top 3 recommended actions with reasoning

Scenario: AI respects approval pattern
  Given the AI recommends creating a follow-up task
  When I approve the recommendation
  Then the task is created (not before approval)
  And the action is logged in the audit trail
```

**Key Tasks:**
1. **Implement AI lead scoring service** — call AI Gateway with lead data, activity history, and company profile
   - Calculate composite score; store on lead record
   - Provide score factor breakdown for explainability
2. **Implement activity recommendation engine** — analyse activity gaps, opportunity stage duration, historical patterns
   - Generate recommendations via AI Gateway
   - Follow "Told, Shown, Approve, Done" pattern (FR5, FR6)
3. **Build CRM briefing** — T4 (Briefing) template showing AI-prioritised actions, stale opportunities, hot leads
4. **Implement next-best-action suggestions** — context-aware recommendations on opportunity and lead detail pages
5. **Write unit tests** — scoring calculation, recommendation logic, approval guard
6. **Write integration tests** — AI gateway integration with mocked responses

**FR/NFR References:** FR1, FR2, FR3, FR5, FR6, FR10, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.1 AI/NLP Core (FR1-FR6, FR10) | AI interaction paradigm, confidence scoring |
| Architecture | §2.21 CRM, §2.7 AI Orchestration | AI scoring, recommendation engine design |
| UX Design Specification | T4 (Briefing) | AI briefing dashboard layout, Co-Pilot Dock |
| API Contracts | §2.15 CRM | AI scoring and recommendation endpoints |
| Data Models | §11 CRM | Lead score fields, AI recommendation storage |
| State Machine Reference | §8 CRM | AI recommendations as side effects |
| Event Catalog | §7 CRM | AI recommendation events |
| Business Rules Compendium | §6 CRM | AI scoring factor weights, recommendation triggers |

---

### Story E21.S9: Mobile Adaptation — CRM

**User Story:** As a mobile sales user, I want to access my leads, opportunities, and log activities from my phone so that I can manage my pipeline on the go.

**Acceptance Criteria:**

```gherkin
Scenario: View leads list on mobile
  Given I am on the mobile app
  When I navigate to CRM Leads
  Then I see a mobile-optimised list with lead name, rating, and status
  And I can tap to view lead details

Scenario: Log activity from mobile
  Given I am viewing a lead or customer on mobile
  When I tap "Log Activity" and select "Phone Call"
  Then I can enter call summary, duration, and next steps
  And the activity is synced to the server

Scenario: View pipeline on mobile
  Given I have open opportunities
  When I view the pipeline on mobile
  Then I see a simplified pipeline view (list grouped by stage, not full Kanban)
  And opportunity cards show customer, value, and expected close date

Scenario: Push notifications for CRM events
  Given auto-rules are configured for my leads
  When a lead I own is updated or an activity is due
  Then I receive a push notification on my mobile device
```

**Key Tasks:**
1. **Create mobile leads screen** — simplified T1 list optimised for mobile
2. **Create mobile opportunity list** — grouped by pipeline stage
3. **Create mobile activity logging** — streamlined form with quick-entry fields
4. **Implement CRM push notifications** — activity reminders, lead updates
5. **Write unit tests** — mobile data transformations
6. **Write integration tests** — mobile API calls and push notification delivery

**FR/NFR References:** FR54, FR55, FR56, FR57, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54-FR58) | CRM functional requirements applicable to mobile |
| Architecture | §2.21 CRM | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns, Expo scaffold |
| API Contracts | §2.15 CRM | Same API endpoints used by mobile |
| Data Models | §11 CRM | Same models (mobile uses API, not direct DB) |
| State Machine Reference | §8 CRM | Same state machines apply |
| Event Catalog | §7 CRM | Events triggering push notifications |
| Business Rules Compendium | §6 CRM | Same business rules apply on mobile |

---

## Epic E22: Fixed Assets

> **Fixed asset register with acquisition, depreciation, disposal, revaluation, and transfer management.** Supports UK GAAP (FRS 102 Section 17) depreciation methods and automatic GL posting of depreciation entries.

**Architecture:** §2.18 Fixed Assets
**Models:** 8 models — `FixedAsset`, `AssetCategory`, `AssetDepreciationEntry`, `AssetDisposal`, `AssetRevaluation`, `AssetTransfer`, `DepreciationRun`, `AssetMaintenanceLog`
**State Machines:** SM:FixedAsset, SM:DepreciationEntry, SM:AssetDisposal, SM:AssetTransfer
**Events:** `asset.acquired`, `depreciation.run.completed`, `depreciation.entry.posted`, `asset.disposed`
**API:** §2.19 — ~13 endpoints under `/assets/*`
**Business Rules:** BR-FA-001 to BR-FA-012
**FRs:** FR158–FR163
**UX Templates:** T1 (Entity List), T2 (Record Detail), T6 (Wizard)

**Dependencies:** E14 (Finance/GL for journal posting), E1 (Database + Core Models), E3 (Event Bus + Audit Trail)

---

### Story E22.S1: Asset Register & Categories

**User Story:** As a finance user, I want to create and manage fixed asset records with acquisition details, categories, and locations so that I maintain a complete fixed asset register.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new fixed asset
  Given I am logged in as STAFF or higher
  When I create an asset with name, category, acquisition date, cost, useful life, residual value, location, and responsible person
  Then a FixedAsset record is created with status ACTIVE scoped to my companyId
  And an "asset.acquired" event is emitted
  And the asset appears in the asset register list

Scenario: Configure asset categories with GL mappings
  Given I am an ADMIN user
  When I create an asset category "Office Equipment" with GL accounts for cost, depreciation, accumulated depreciation, and disposal gain/loss
  Then the AssetCategory record is created
  And new assets in this category inherit the GL account mappings

Scenario: Asset category enforces depreciation method
  Given asset category "Vehicles" has depreciation method REDUCING_BALANCE
  When I create an asset in category "Vehicles"
  Then the depreciation method defaults to REDUCING_BALANCE
  And can be overridden at the asset level if permitted (BR-FA-002)

Scenario: View asset register with net book value
  Given the asset register contains 50 assets
  When I view the asset register list
  Then each asset shows: name, category, acquisition date, cost, accumulated depreciation, net book value
  And I can filter by category, status, location

Scenario: Asset has mandatory fields
  Given I attempt to create an asset without acquisition date or cost
  When I submit the form
  Then validation errors are shown for required fields
  And the asset is not created
```

**Key Tasks:**
1. **Create FixedAsset model and migration** — companyId, name, assetNumber (NumberSeries), categoryId FK, acquisitionDate, acquisitionCost (Decimal 19,4), residualValue, usefulLifeMonths, depreciationMethod enum (STRAIGHT_LINE, REDUCING_BALANCE, SUM_OF_DIGITS), status enum, locationId, responsiblePersonId, netBookValue (computed)
   - Add AssetCategory: companyId, name, depreciationMethod default, costAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId, disposalGainLossAccountId
2. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/assets` and `/api/v1/assets/categories`
   - Scope all queries by companyId; cursor-based pagination
   - Asset number auto-generation via NumberSeries
3. **Implement net book value calculation** — cost - accumulated depreciation + revaluations
4. **Build asset register list** — T1 template with computed NBV column, category filter, status badges
5. **Build asset detail** — T2 template with all fields, depreciation schedule tab, history tab
6. **Build category management** — T7 (Settings) for ADMIN users
7. **Write unit tests** — NBV calculation, required field validation, category inheritance
8. **Write integration tests** — CRUD lifecycle, category GL mapping inheritance

**FR/NFR References:** FR158, FR163, NFR2, NFR14, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR158, FR163) | Asset register, categories, mandatory fields |
| Architecture | §2.18 Fixed Assets | FixedAsset model, AssetCategory, GL mappings |
| UX Design Specification | T1 (Entity List), T2 (Record Detail), T7 (Settings) | Register list, detail, category settings |
| API Contracts | §2.19 Fixed Assets | Asset and category CRUD endpoints |
| Data Models | §8 Fixed Assets | FixedAsset, AssetCategory schemas |
| State Machine Reference | §7 Fixed Assets | SM:FixedAsset — ACTIVE / DISPOSED / WRITTEN_OFF |
| Event Catalog | §6 Fixed Assets | asset.acquired event |
| Business Rules Compendium | §13 Additional (BR-FA-001 to BR-FA-012) | Category rules, NBV calculation, mandatory fields |

---

### Story E22.S2: Depreciation Calculation Engine

**User Story:** As a finance user, I want the system to calculate depreciation using straight-line, reducing balance, and sum-of-digits methods per UK GAAP (FRS 102) so that asset values are correctly reduced over their useful life.

**Acceptance Criteria:**

```gherkin
Scenario: Straight-line depreciation calculation
  Given an asset with cost GBP 12,000, residual value GBP 2,000, useful life 60 months
  When monthly depreciation is calculated
  Then the monthly charge is GBP 166.67 ((12000-2000)/60)
  And the calculation uses Decimal(19,4) precision

Scenario: Reducing balance depreciation calculation
  Given an asset with cost GBP 10,000, reducing balance rate 25%, net book value GBP 7,500
  When annual depreciation is calculated
  Then the annual charge is GBP 1,875 (7500 * 25%)
  And depreciation stops when NBV reaches residual value (BR-FA-005)

Scenario: Sum-of-digits depreciation calculation
  Given an asset with cost GBP 20,000, residual value GBP 2,000, useful life 5 years
  When Year 1 depreciation is calculated
  Then the charge is GBP 6,000 (18000 * 5/15)
  And Year 2 is GBP 4,800 (18000 * 4/15)

Scenario: Depreciation respects residual value floor
  Given an asset with NBV GBP 2,100 and residual value GBP 2,000
  And the calculated monthly depreciation would be GBP 166.67
  When depreciation is calculated
  Then the charge is limited to GBP 100 (bringing NBV to residual value)
  And no further depreciation is calculated in subsequent periods

Scenario: Pro-rata depreciation for mid-month acquisition
  Given an asset acquired on 15 March with monthly depreciation GBP 100
  When March depreciation is calculated
  Then the charge is GBP 51.61 (17/31 * 100) — pro-rated by days
```

**Key Tasks:**
1. **Implement depreciation calculation service** — support three methods per FRS 102 Section 17
   - Straight-line: (cost - residual) / useful life months
   - Reducing balance: NBV * rate% (annual, divided by 12 for monthly)
   - Sum-of-digits: (cost - residual) * (remaining years / sum of digits)
2. **Implement residual value floor** — never depreciate below residual value (BR-FA-005)
3. **Implement pro-rata calculation** — daily pro-rating for partial first/last months
4. **Use Decimal(19,4) for all monetary calculations** — per NFR38
5. **Create depreciation schedule preview** — show projected depreciation over remaining useful life
6. **Write unit tests** — each method with known expected values, edge cases (zero residual, 1-month life, mid-month acquisition)
7. **Write integration tests** — calculation service with real asset data

**FR/NFR References:** FR159, NFR38, NFR36

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR159) | Depreciation methods per UK GAAP |
| Architecture | §2.18 Fixed Assets | Depreciation calculation algorithms, formulas |
| UX Design Specification | T2 (Record Detail) | Depreciation schedule display on asset detail |
| API Contracts | §2.19 Fixed Assets | Depreciation preview endpoint |
| Data Models | §8 Fixed Assets | FixedAsset depreciation fields, Decimal(19,4) types |
| State Machine Reference | §7 Fixed Assets | SM:DepreciationEntry lifecycle |
| Event Catalog | §6 Fixed Assets | depreciation.entry.calculated event |
| Business Rules Compendium | §13 Additional (BR-FA-003 to BR-FA-006) | Calculation rules, residual floor, pro-rata |

---

### Story E22.S3: Depreciation Run & GL Posting

**User Story:** As a finance user, I want to run monthly depreciation and have it automatically post journal entries to the general ledger so that the accounts reflect accurate asset values.

**Acceptance Criteria:**

```gherkin
Scenario: Execute monthly depreciation run
  Given 20 active assets exist for the current company
  When I trigger the monthly depreciation run for March 2026
  Then an AssetDepreciationEntry is created for each asset with a calculated charge
  And a DepreciationRun record is created with status COMPLETED
  And a "depreciation.run.completed" event is emitted

Scenario: GL journal entries are posted
  Given a depreciation run has completed
  When GL posting is triggered
  Then a journal entry is created per asset (or batch journal)
  Debiting the depreciation expense account (from asset category)
  Crediting the accumulated depreciation account (from asset category)
  And each journal entry references the depreciation entry
  And "depreciation.entry.posted" events are emitted

Scenario: Prevent duplicate depreciation run
  Given depreciation has already been run for March 2026
  When I attempt to run depreciation for March 2026 again
  Then the system rejects the run with "depreciation.error.already_run_for_period"

Scenario: Depreciation run respects period locks
  Given the financial period for February 2026 is locked
  When I attempt to run depreciation for February 2026
  Then the system rejects the run with "depreciation.error.period_locked"

Scenario: Depreciation run with progress indication
  Given 500 assets need depreciation calculation
  When the run executes
  Then progress is reported (e.g., 200/500 processed)
  And the run completes within 60 seconds (NFR5)
```

**Key Tasks:**
1. **Create DepreciationRun model** — companyId, periodMonth, periodYear, status, runDate, processedCount, totalCount, journalBatchId
   - AssetDepreciationEntry: assetId, depreciationRunId, amount, postDate, journalEntryId, status
2. **Implement depreciation run service** — `POST /api/v1/assets/depreciation-runs`
   - Iterate all ACTIVE assets; call calculation engine per asset
   - Create AssetDepreciationEntry records; update asset accumulated depreciation and NBV
   - Validate no duplicate run for same period (BR-FA-007)
   - Check period lock status (BR-FA-008)
3. **Implement GL posting** — create journal entries per asset or batched
   - Debit: category.depreciationExpenseAccountId; Credit: category.accumulatedDepreciationAccountId
   - Use journal entry API from E14 (Finance)
4. **Build depreciation run UI** — T6 (Wizard) with period selection, preview, execute, and results summary
5. **Implement progress tracking** — WebSocket updates during long-running depreciation runs
6. **Write unit tests** — duplicate run prevention, period lock check, GL posting logic
7. **Write integration tests** — full run cycle with GL verification

**FR/NFR References:** FR160, FR12, NFR5, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR160) | Automatic depreciation journal posting |
| Architecture | §2.18 Fixed Assets | DepreciationRun, batch GL posting design |
| UX Design Specification | T6 (Wizard) | Depreciation run wizard flow |
| API Contracts | §2.19 Fixed Assets | Depreciation run endpoints, GL posting |
| Data Models | §8 Fixed Assets | DepreciationRun, AssetDepreciationEntry models |
| State Machine Reference | §7 Fixed Assets | SM:DepreciationEntry — CALCULATED → POSTED |
| Event Catalog | §6 Fixed Assets | depreciation.run.completed, depreciation.entry.posted events |
| Business Rules Compendium | §13 Additional (BR-FA-007, BR-FA-008) | Duplicate prevention, period lock rules |

---

### Story E22.S4: Asset Disposal & Gain/Loss

**User Story:** As a finance user, I want to record asset disposals with automatic gain/loss calculation and GL posting so that disposed assets are removed from the register with correct accounting entries.

**Acceptance Criteria:**

```gherkin
Scenario: Dispose of an asset with gain
  Given an asset has NBV of GBP 3,000 (cost 10,000, accumulated dep 7,000)
  When I record disposal with proceeds of GBP 4,000
  Then the disposal gain is calculated as GBP 1,000
  And an AssetDisposal record is created
  And the asset status changes to DISPOSED
  And an "asset.disposed" event is emitted

Scenario: Dispose of an asset with loss
  Given an asset has NBV of GBP 5,000
  When I record disposal with proceeds of GBP 3,000
  Then the disposal loss is calculated as GBP 2,000

Scenario: GL entries for disposal
  Given an asset is disposed with gain GBP 1,000
  When GL posting is triggered
  Then journal entries are created:
    Debit: Bank/Cash (proceeds) GBP 4,000
    Debit: Accumulated Depreciation GBP 7,000
    Credit: Asset Cost Account GBP 10,000
    Credit: Disposal Gain/Loss Account GBP 1,000

Scenario: Disposal requires approval
  Given an asset disposal is created
  When submitted for approval
  Then the disposal follows the standard approval workflow
  And GL posting only occurs after approval (BR-FA-010)

Scenario: Disposal date must be after last depreciation date
  Given the last depreciation entry for the asset was 31 March 2026
  When I attempt to record disposal with date 15 March 2026
  Then the system rejects with "asset.error.disposal_before_last_depreciation"
```

**Key Tasks:**
1. **Create AssetDisposal model** — assetId, disposalDate, disposalMethod (SALE, SCRAP, WRITE_OFF), proceedsAmount, nbvAtDisposal, gainLoss (computed), journalEntryId, status, approvedById
2. **Implement disposal endpoint** — `POST /api/v1/assets/:id/dispose`
   - Calculate gain/loss: proceeds - NBV at disposal date
   - Run catch-up depreciation if disposal date is mid-period
   - Create AssetDisposal record; update asset status to DISPOSED
3. **Implement GL disposal posting** — multi-line journal entry (debit bank + accumulated dep, credit cost + gain/loss)
4. **Implement disposal approval workflow** — integrate with ApprovalRequest (cross-cutting)
5. **Build disposal UI** — T6 (Wizard) with disposal type selection, proceeds entry, GL preview
6. **Write unit tests** — gain/loss calculation, GL entry construction, date validation
7. **Write integration tests** — full disposal cycle with GL verification

**FR/NFR References:** FR161, FR12, NFR36, NFR38, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR161) | Disposal with gain/loss calculation |
| Architecture | §2.18 Fixed Assets | AssetDisposal model, GL posting logic |
| UX Design Specification | T6 (Wizard) | Disposal wizard flow |
| API Contracts | §2.19 Fixed Assets | Disposal endpoint |
| Data Models | §8 Fixed Assets | AssetDisposal model |
| State Machine Reference | §7 Fixed Assets | SM:AssetDisposal — PENDING → APPROVED → POSTED |
| Event Catalog | §6 Fixed Assets | asset.disposed event |
| Business Rules Compendium | §13 Additional (BR-FA-009 to BR-FA-011) | Disposal rules, date validation, gain/loss |

---

### Story E22.S5: Asset Revaluation & Transfer

**User Story:** As a finance user, I want to perform asset revaluations (per FRS 102) and record asset transfers between locations or departments so that the register reflects current values and accurate asset tracking.

**Acceptance Criteria:**

```gherkin
Scenario: Revalue an asset upward
  Given an asset has NBV of GBP 8,000
  When I record a revaluation to GBP 12,000
  Then an AssetRevaluation record is created with surplus of GBP 4,000
  And a GL journal entry credits the Revaluation Reserve for GBP 4,000
  And the asset's cost is adjusted to reflect the revalued amount

Scenario: Revalue an asset downward
  Given an asset has NBV of GBP 8,000 with no previous revaluation surplus
  When I record a revaluation to GBP 6,000
  Then the deficit of GBP 2,000 is posted to P&L (expense)
  And the asset's cost and accumulated depreciation are adjusted

Scenario: Transfer asset between locations
  Given an asset is at location "Head Office"
  When I transfer it to location "Branch Manchester"
  Then an AssetTransfer record is created with from/to locations and transfer date
  And the asset's locationId is updated
  And the transfer is recorded in the asset audit trail

Scenario: Transfer asset between departments with cost centre change
  Given an asset is assigned to department "IT"
  When I transfer it to department "Marketing"
  Then the responsible department is updated
  And future depreciation posts to the new department's cost centre

Scenario: Revaluation requires FRS 102 compliance
  Given a revaluation is recorded
  When the revaluation is processed
  Then the system follows FRS 102 Section 17 rules for revaluation accounting
  And the revaluation reserve is correctly maintained
```

**Key Tasks:**
1. **Create AssetRevaluation model** — assetId, revaluationDate, previousNbv, newValue, surplusDeficit, journalEntryId, approvedById
2. **Create AssetTransfer model** — assetId, transferDate, fromLocationId, toLocationId, fromDepartmentId, toDepartmentId, reason, transferredById
3. **Implement revaluation endpoint** — `POST /api/v1/assets/:id/revalue`
   - Calculate surplus/deficit; post to Revaluation Reserve or P&L per FRS 102
   - Adjust cost basis and recalculate future depreciation
4. **Implement transfer endpoint** — `POST /api/v1/assets/:id/transfer`
   - Update location/department; create audit record
5. **Build revaluation UI** — T6 (Wizard) with current value display, new value entry, GL preview
6. **Build transfer UI** — form with location/department dropdowns, reason field
7. **Write unit tests** — revaluation accounting (surplus vs deficit), transfer validation
8. **Write integration tests** — revaluation GL posting, transfer audit trail

**FR/NFR References:** FR162, NFR36, NFR38, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR162) | Revaluation with revaluation reserve per FRS 102 |
| Architecture | §2.18 Fixed Assets | AssetRevaluation, AssetTransfer models, FRS 102 rules |
| UX Design Specification | T6 (Wizard) | Revaluation and transfer wizard flows |
| API Contracts | §2.19 Fixed Assets | Revalue and transfer endpoints |
| Data Models | §8 Fixed Assets | AssetRevaluation, AssetTransfer models |
| State Machine Reference | §7 Fixed Assets | SM:AssetTransfer — PENDING → COMPLETED |
| Event Catalog | §6 Fixed Assets | asset.revalued, asset.transferred events |
| Business Rules Compendium | §13 Additional (BR-FA-011, BR-FA-012) | FRS 102 revaluation rules |

---

### Story E22.S6: Mobile Adaptation — Fixed Assets

**User Story:** As a mobile user, I want to view the asset register, scan asset barcodes for identification, and record asset location changes from my phone.

**Acceptance Criteria:**

```gherkin
Scenario: View asset register on mobile
  Given I am on the mobile app
  When I navigate to Fixed Assets
  Then I see a mobile-optimised list with asset name, category, location, and NBV

Scenario: Scan asset barcode
  Given I am on the mobile asset view
  When I scan an asset barcode using the phone camera
  Then the asset record is retrieved and displayed
  And I can view its details or initiate a transfer

Scenario: Record asset location change from mobile
  Given I am viewing an asset on mobile
  When I change the location to "Branch Manchester"
  Then an AssetTransfer record is created
  And the change syncs to the server

Scenario: Asset stock take from mobile
  Given I am conducting a physical asset verification
  When I scan assets and confirm their locations
  Then verified assets are marked as confirmed
  And discrepancies are flagged for review
```

**Key Tasks:**
1. **Create mobile asset register** — simplified T1 list with barcode scan button
2. **Implement barcode scanning** — Expo Camera/BarCode scanner integration
3. **Create mobile transfer form** — streamlined location change with confirmation
4. **Implement mobile stock take** — scan and confirm assets, report discrepancies
5. **Write unit tests** — barcode lookup, transfer validation
6. **Write integration tests** — mobile scan → asset retrieval → transfer flow

**FR/NFR References:** FR158, FR163, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.12 Fixed Assets (FR158, FR163) | Asset register, fixed asset report |
| Architecture | §2.18 Fixed Assets | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns |
| API Contracts | §2.19 Fixed Assets | Same endpoints used by mobile |
| Data Models | §8 Fixed Assets | Same models |
| State Machine Reference | §7 Fixed Assets | Same state machines |
| Event Catalog | §6 Fixed Assets | Same events |
| Business Rules Compendium | §13 Additional (BR-FA) | Same business rules |

---

## Epic E23: HR / Payroll

> **Comprehensive HR and payroll management covering employee records, contracts, leave, appraisals, skills, training, payroll processing, and HMRC RTI submissions.** UK employment law compliant with PAYE, NI, auto-enrolment pension, and statutory payments.

**Architecture:** §2.22 HR/Payroll
**Models:** 36 models — `Employee`, `EmploymentContract`, `ContractChange`, `Department`, `JobPosition`, `PayrollRun`, `PayrollRunLine`, `PayComponent`, `PayrollCalendar`, `LeaveType`, `LeaveEntitlement`, `LeaveRequest`, `AppraisalTemplate`, `AppraisalFactor`, `Appraisal`, `AppraisalFactorRating`, `Skill`, `SkillCategory`, `EmployeeSkill`, `TrainingPlan`, `TrainingSession`, `TrainingAttendance`, `CheckpointTemplate`, `Checkpoint`, `CheckpointItem`, `CheckpointItemCompletion`, `Benefit`, `EmployeeBenefit`, `HMRCSubmission`, `ShiftSchedule`, `ShiftAssignment`, plus reference data models
**State Machines:** SM:Employee, SM:EmploymentContract, SM:PayrollRun, SM:LeaveRequest, SM:HMRCSubmission
**Events:** `employee.hired`, `employee.terminated`, `contract.activated`, `payroll.run.completed`, `leave.approved`, `leave.rejected`, `rti.submitted`
**API:** §2.16 — ~62 endpoints under `/hr/*`
**Business Rules:** BR-EMP-001-004, BR-CTR-001-010, BR-APR-001-004, BR-SKL-001-003, BR-CHK-001-004, BR-TRN-001-005, BR-LEV-001-009, BR-PAY-001-018, BR-JP-001-002
**FRs:** FR59–FR67, FR101–FR108
**UX Templates:** T1 (Entity List), T2 (Record Detail), T3 (Header+Lines), T6 (Wizard), T7 (Settings)

**Dependencies:** E14 (Finance/GL for payroll journal posting), E9 (Notifications for leave/appraisal workflows), E11 (Tasks), E10 (Email for payslips)

---

### Story E23.S1: Employee Records & Department Structure

**User Story:** As an HR administrator, I want to create and manage employee records with all fields required by UK employment law and organise employees within a department hierarchy so that we maintain compliant and structured employee data.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new employee record
  Given I am an HR ADMIN or MANAGER
  When I create an employee with name, NI number, tax code, employment type, start date, department, job title, and pay details
  Then an Employee record is created with status ACTIVE scoped to companyId
  And an "employee.hired" event is emitted
  And the employee appears in the employee list

Scenario: UK employment law mandatory fields
  Given I am creating a new employee
  When I omit the NI number or tax code
  Then validation errors are shown for UK-required fields (BR-EMP-001)
  And the record is not created

Scenario: Department hierarchy
  Given departments "Operations" → "Warehouse" → "Warehouse Team A" exist
  When I view the department structure
  Then departments display in a hierarchical tree
  And each department shows the employee count

Scenario: Job position management
  Given I create a job position "Senior Developer" in department "IT"
  When I assign an employee to this position
  Then the employee's jobPositionId is updated
  And the position's headcount is tracked

Scenario: Employee search and filtering
  Given the company has 150 employees
  When I search for employees by name, department, or status
  Then matching employees are returned with cursor-based pagination
  And I can filter by status (ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED)
```

**Key Tasks:**
1. **Create Employee model and migration** — companyId, employeeNumber (NumberSeries), firstName, lastName, email, niNumber (encrypted), taxCode, employmentType enum, startDate, endDate, departmentId, jobPositionId, managerId (self-ref), status enum, all timestamps
   - Department model: companyId, name, parentDepartmentId, managerId, costCentreCode
   - JobPosition model: companyId, title, departmentId, grade, headcount, isActive
2. **Implement employee CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/employees`
   - Search with cursor-based pagination; filter by department, status, employment type
   - Encrypt NI number at rest (NFR8)
3. **Implement department endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/departments`
   - Hierarchy endpoints with tree structure
4. **Implement job position endpoints** — `GET/POST/PUT/DELETE /api/v1/hr/positions`
5. **Build employee list UI** — T1 template with photo thumbnail, department, status badge
6. **Build employee detail UI** — T2 template with tabs: personal, employment, contracts, leave, payroll
7. **Build department tree UI** — hierarchical view with drag-and-drop reordering
8. **Write unit tests** — UK field validation (BR-EMP-001), NI number encryption, department hierarchy queries
9. **Write integration tests** — employee CRUD, department tree, position assignment

**FR/NFR References:** FR59, FR106, NFR2, NFR8, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR59, FR106) | Employee records, UK law fields, departments |
| Architecture | §2.22 HR/Payroll | Employee model, Department hierarchy, NI encryption |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Employee list and detail layouts |
| API Contracts | §2.16 HR/Payroll | Employee, department, position CRUD endpoints |
| Data Models | §12 HR/Payroll | Employee, Department, JobPosition schemas |
| State Machine Reference | §9 HR/Payroll | SM:Employee — ACTIVE / ON_LEAVE / SUSPENDED / TERMINATED |
| Event Catalog | §8 HR/Payroll | employee.hired event |
| Business Rules Compendium | §7 HR/Payroll | BR-EMP-001 to BR-EMP-004 (employee rules) |

---

### Story E23.S2: Employment Contracts & Change History

**User Story:** As an HR administrator, I want to manage employment contracts through a full lifecycle with immutable change history so that contract changes (salary, title, department) are tracked with effective dates and audit trail.

**Acceptance Criteria:**

```gherkin
Scenario: Create employment contract
  Given an employee exists with status ACTIVE
  When I create a contract with job title, salary, contract type, start date, probation period, and notice period
  Then an EmploymentContract record is created with status DRAFT
  And the contract is linked to the employee

Scenario: Approve and activate contract
  Given a contract is in DRAFT status
  When a MANAGER approves the contract
  Then the contract status changes to ACTIVE
  And a "contract.activated" event is emitted
  And the employee's current contract reference is updated

Scenario: Record contract change with effective date
  Given an active contract exists
  When I record a salary change from GBP 45,000 to GBP 50,000 effective 1 April 2026
  Then a ContractChange record is created with old value, new value, effective date, and changed by
  And the change is immutable once saved (BR-CTR-005)

Scenario: View contract change history
  Given an employee has had 5 contract changes over 2 years
  When I view the contract history
  Then all changes are displayed chronologically with effective dates
  And each shows: field changed, old value, new value, changed by, change date

Scenario: Terminate contract
  Given an active contract exists
  When I terminate the contract with end date and reason
  Then the contract status changes to TERMINATED
  And the employee status updates accordingly
  And an "employee.terminated" event is emitted
```

**Key Tasks:**
1. **Create EmploymentContract model** — employeeId, companyId, contractType enum, jobTitle, annualSalary, hourlyRate, hoursPerWeek, startDate, endDate, probationEndDate, noticePeriodWeeks, status enum
   - ContractChange: contractId, fieldName, oldValue, newValue, effectiveDate, changedById, changeReason
2. **Implement contract CRUD endpoints** — `GET/POST/PUT /api/v1/hr/employees/:id/contracts`
   - Approval endpoint: `POST /api/v1/hr/contracts/:id/approve`
   - Terminate endpoint: `POST /api/v1/hr/contracts/:id/terminate`
3. **Implement change tracking** — detect field differences on update; create ContractChange records automatically
   - Changes are immutable after save (BR-CTR-005)
4. **Build contract detail UI** — T2 template with contract terms, change history tab
5. **Build contract wizard** — T6 for creating new contracts with all required fields
6. **Write unit tests** — lifecycle transitions, change detection, immutability enforcement
7. **Write integration tests** — full contract lifecycle from draft to termination

**FR/NFR References:** FR101, FR102, NFR14, NFR39

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR101, FR102) | Contract lifecycle, change tracking |
| Architecture | §2.22 HR/Payroll | EmploymentContract model, ContractChange design |
| UX Design Specification | T2 (Record Detail), T6 (Wizard) | Contract detail and creation wizard |
| API Contracts | §2.16 HR/Payroll | Contract CRUD, approve, terminate endpoints |
| Data Models | §12 HR/Payroll | EmploymentContract, ContractChange schemas |
| State Machine Reference | §9 HR/Payroll | SM:EmploymentContract — DRAFT → ACTIVE → TERMINATED |
| Event Catalog | §8 HR/Payroll | contract.activated, employee.terminated events |
| Business Rules Compendium | §7 HR/Payroll | BR-CTR-001 to BR-CTR-010 (contract rules) |

---

### Story E23.S3: Leave Management

**User Story:** As an employee, I want to request leave and as a manager, I want to approve or reject leave requests with entitlement tracking so that leave is managed within company policy and legal requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Submit a leave request
  Given I am an employee with annual leave entitlement of 25 days
  And I have used 10 days
  When I request 3 days annual leave from 10-12 March 2026
  Then a LeaveRequest record is created with status PENDING
  And my manager receives a notification

Scenario: Approve leave request
  Given a leave request is PENDING for my team member
  When I approve the request
  Then the status changes to APPROVED
  And a "leave.approved" event is emitted
  And the employee's used entitlement is incremented by 3 days
  And the employee receives an approval notification

Scenario: Reject leave request with reason
  Given a leave request is PENDING
  When I reject it with reason "Team capacity insufficient"
  Then the status changes to REJECTED
  And a "leave.rejected" event is emitted
  And the entitlement is not decremented

Scenario: Prevent exceeding entitlement
  Given I have 2 days remaining annual leave
  When I request 5 days annual leave
  Then the system warns "Request exceeds remaining entitlement by 3 days"
  And allows submission with manager override flag (BR-LEV-004)

Scenario: Leave type configuration
  Given I am an ADMIN
  When I configure leave types (Annual, Sick, Maternity, Paternity, Unpaid, TOIL)
  Then each type has: name, default entitlement days, paid/unpaid flag, carry-over limit, requires medical cert flag

Scenario: Leave entitlement based on start date
  Given an employee starts on 1 July 2026 (mid-year)
  And annual entitlement is 25 days
  When the system calculates their entitlement
  Then the pro-rated entitlement is 12.5 days (25 * 6/12) (BR-LEV-001)
```

**Key Tasks:**
1. **Create leave models** — LeaveType: companyId, name, defaultEntitlementDays, isPaid, carryOverLimit, requiresMedicalCert
   - LeaveEntitlement: employeeId, leaveTypeId, year, entitlementDays, usedDays, carryOverDays
   - LeaveRequest: employeeId, companyId, leaveTypeId, startDate, endDate, workingDays, status enum, reason, approvedById, rejectedById, rejectionReason
2. **Implement leave request endpoints** — `POST /api/v1/hr/leave/requests`, approve/reject
   - Validate against entitlement balance
   - Calculate working days (exclude weekends, public holidays)
   - Notify manager on submission; notify employee on approval/rejection
3. **Implement entitlement calculation** — annual reset, pro-rata for mid-year starters, carry-over processing
4. **Build leave request form** — calendar date picker, type selector, remaining balance display
5. **Build manager approval queue** — T1 list of pending requests with bulk approve/reject
6. **Build leave calendar view** — team leave calendar showing who is off when
7. **Write unit tests** — working days calculation, pro-rata entitlement, balance validation, carry-over
8. **Write integration tests** — full request-approve cycle, entitlement decrement

**FR/NFR References:** FR61, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR61) | Leave request, approval, entitlement tracking |
| Architecture | §2.22 HR/Payroll | Leave models, entitlement calculation, calendar |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Leave request list, calendar view |
| API Contracts | §2.16 HR/Payroll | Leave request, approve, reject endpoints |
| Data Models | §12 HR/Payroll | LeaveType, LeaveEntitlement, LeaveRequest schemas |
| State Machine Reference | §9 HR/Payroll | SM:LeaveRequest — PENDING → APPROVED / REJECTED / CANCELLED |
| Event Catalog | §8 HR/Payroll | leave.approved, leave.rejected events |
| Business Rules Compendium | §7 HR/Payroll | BR-LEV-001 to BR-LEV-009 (leave rules) |

---

### Story E23.S4: Payroll Processing Engine

**User Story:** As a payroll administrator, I want to prepare and run monthly payroll with PAYE, NI, student loan, and pension calculations so that employees are paid correctly and statutory deductions are applied per HMRC rules.

**Acceptance Criteria:**

```gherkin
Scenario: Prepare payroll run
  Given it is the end of March 2026
  When I initiate a payroll run for March 2026
  Then a PayrollRun record is created with status DRAFT
  And PayrollRunLine records are generated for each active employee
  And each line pre-calculates gross pay from contract salary

Scenario: Calculate PAYE income tax
  Given an employee has annual salary GBP 45,000 and tax code 1257L
  When payroll calculations run
  Then the monthly PAYE deduction is calculated per HMRC tax tables
  And the calculation uses cumulative basis (BR-PAY-003)

Scenario: Calculate National Insurance contributions
  Given an employee earns GBP 3,750/month (above NI primary threshold)
  When NI is calculated
  Then employee NI and employer NI are calculated per HMRC rates
  And both amounts appear on the PayrollRunLine

Scenario: Calculate auto-enrolment pension
  Given an employee is pension-eligible (BR-PAY-010)
  And the pension scheme is 5% employee + 3% employer
  When pension is calculated
  Then employee pension deduction is GBP 187.50
  And employer pension contribution is GBP 112.50

Scenario: Calculate student loan deduction
  Given an employee has student loan Plan 2
  When earnings exceed the Plan 2 threshold
  Then 9% of earnings above threshold is deducted (BR-PAY-008)

Scenario: Approve and finalise payroll run
  Given a payroll run is in DRAFT status with all lines calculated
  When I approve the payroll run
  Then the status changes to APPROVED
  And pay amounts are locked
  And a "payroll.run.completed" event is emitted
```

**Key Tasks:**
1. **Create payroll models** — PayrollRun: companyId, periodMonth, periodYear, status enum, runDate, totalGross, totalNet, totalDeductions, totalEmployerCosts
   - PayrollRunLine: payrollRunId, employeeId, grossPay, basicPay, overtime, allowances, paye, employeeNi, employerNi, studentLoan, employeePension, employerPension, otherDeductions, netPay
   - PayComponent: companyId, name, type enum (EARNING, DEDUCTION, EMPLOYER_COST), calculationType, rate, isStatutory
   - PayrollCalendar: companyId, year, payFrequency, payDates
2. **Implement PAYE calculation engine** — cumulative and week1/month1 basis
   - Tax code parsing (standard, K codes, NT, BR, D0, D1)
   - Use HMRC tax bands and thresholds (configurable per tax year)
3. **Implement NI calculation** — employee and employer NI per HMRC tables
   - Category letters (A, B, C, H, M, Z)
   - Upper and lower earnings limits
4. **Implement pension auto-enrolment** — eligibility check (age, earnings threshold)
   - Calculate employee and employer contributions
   - Track opt-in/opt-out status per employee
5. **Implement student loan deduction** — Plans 1, 2, 4, 5, and PG
   - Apply threshold and percentage per plan type
6. **Implement payroll run workflow** — DRAFT → calculated → APPROVED → POSTED
7. **Build payroll run UI** — T3 (Header+Lines) with run header and employee lines
8. **Write unit tests** — each calculation component with HMRC test scenarios
9. **Write integration tests** — full payroll run cycle

**FR/NFR References:** FR62, FR65, NFR5, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR62, FR65) | Payroll processing, PAYE/NI/pension |
| Architecture | §2.22 HR/Payroll | Payroll calculation engine, HMRC compliance |
| UX Design Specification | T3 (Header+Lines) | Payroll run header + employee lines |
| API Contracts | §2.16 HR/Payroll | Payroll run CRUD, calculate, approve endpoints |
| Data Models | §12 HR/Payroll | PayrollRun, PayrollRunLine, PayComponent schemas |
| State Machine Reference | §9 HR/Payroll | SM:PayrollRun — DRAFT → CALCULATED → APPROVED → POSTED |
| Event Catalog | §8 HR/Payroll | payroll.run.completed event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY-001 to BR-PAY-018 (payroll rules) |

---

### Story E23.S5: Payroll GL Posting & BACS

**User Story:** As a payroll administrator, I want approved payroll to automatically post journal entries to the GL and generate BACS payment files so that payroll accounting and payments are processed efficiently.

**Acceptance Criteria:**

```gherkin
Scenario: Post payroll to GL
  Given a payroll run is APPROVED
  When I trigger GL posting
  Then journal entries are created:
    Debit: Salary Expense (gross pay)
    Credit: PAYE Liability (tax deducted)
    Credit: NI Liability (employee + employer NI)
    Credit: Pension Liability (employee + employer pension)
    Credit: Student Loan Liability (student loan deductions)
    Credit: Net Pay (bank/payroll clearing)
  And the payroll run status changes to POSTED

Scenario: Generate BACS payment file
  Given a payroll run is POSTED
  When I generate the BACS file
  Then a Standard 18 BACS file is created with all employee payment details
  And the file includes: sort code, account number, amount, employee reference
  And the file is downloadable

Scenario: Prevent duplicate posting
  Given payroll for March 2026 has already been posted
  When I attempt to post it again
  Then the system rejects with "payroll.error.already_posted"

Scenario: GL posting respects period locks
  Given the March 2026 financial period is locked
  When I attempt to post payroll for March 2026
  Then the system rejects with "payroll.error.period_locked"
```

**Key Tasks:**
1. **Implement payroll GL posting service** — create multi-line journal entry from payroll run totals
   - Map each payroll component to configured GL accounts
   - Support departmental cost centre posting
2. **Implement BACS file generation** — Standard 18 format for UK bank payments
   - Include header, detail, and contra records
   - Validate sort codes and account numbers
3. **Build GL posting UI** — preview journal entries before posting; confirm button
4. **Build BACS download UI** — generate and download button with file details
5. **Write unit tests** — GL journal construction, BACS file format validation
6. **Write integration tests** — payroll → GL → BACS complete flow

**FR/NFR References:** FR62, FR64, FR12, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR62, FR64) | GL posting, BACS file generation |
| Architecture | §2.22 HR/Payroll | Payroll GL mapping, BACS Standard 18 format |
| UX Design Specification | T3 (Header+Lines) | GL preview on payroll run |
| API Contracts | §2.16 HR/Payroll | GL posting and BACS generation endpoints |
| Data Models | §12 HR/Payroll | PayrollRun GL fields, BACS config |
| State Machine Reference | §9 HR/Payroll | SM:PayrollRun — APPROVED → POSTED |
| Event Catalog | §8 HR/Payroll | payroll.run.posted event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY-015 to BR-PAY-018 (posting and BACS rules) |

---

### Story E23.S6: HMRC RTI Submissions

**User Story:** As a payroll administrator, I want to submit Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC via the RTI system so that we comply with real-time information reporting requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Generate FPS from payroll run
  Given a payroll run is POSTED
  When I generate the FPS
  Then an HMRCSubmission record is created with type FPS and status PENDING
  And the FPS XML payload is constructed per HMRC RTI schema
  And each employee's payment details are included

Scenario: Submit FPS to HMRC
  Given an FPS submission is PENDING
  When I submit to HMRC
  Then the submission is sent to the HMRC RTI API
  And the status changes to SUBMITTED
  And a "rti.submitted" event is emitted

Scenario: HMRC acknowledges submission
  Given an FPS was submitted
  When HMRC responds with acceptance
  Then the status changes to ACCEPTED
  And the HMRC correlation ID and response details are stored

Scenario: HMRC rejects submission
  Given an FPS was submitted
  When HMRC responds with errors
  Then the status changes to REJECTED
  And error details are displayed for correction

Scenario: Generate EPS for period
  Given it is the end of the tax month
  When I generate the EPS
  Then employer-level data (SMP recovered, NIC holiday, apprenticeship levy) is included
  And the EPS is ready for submission

Scenario: Generate P45 for leaving employee
  Given an employee is terminated
  When I generate their P45
  Then the P45 document is created per HMRC specification
  And the leaving FPS is generated for submission

Scenario: Generate P60 at year end
  Given it is the end of tax year 2025/26
  When I generate P60s for all employees
  Then each employee receives a P60 showing total pay and tax for the year
```

**Key Tasks:**
1. **Create HMRCSubmission model** — companyId, type enum (FPS, EPS, P45, P60), payrollRunId, status enum, payload (XML/JSON), responsePayload, correlationId, submittedAt, respondedAt
2. **Implement FPS XML generation** — per HMRC RTI technical specification
   - Employee details, pay details, NI details, student loan details
3. **Implement EPS XML generation** — employer-level data per HMRC spec
4. **Implement HMRC API integration** — authenticate with HMRC credentials, submit XML, handle async response
   - Retry logic per NFR31; timeout handling per NFR32
5. **Implement P45/P60 generation** — per HMRC document specifications
6. **Build RTI submission UI** — T2 detail with submission status, payload preview, error display
7. **Write unit tests** — XML generation, field validation, HMRC response parsing
8. **Write integration tests** — submission flow with mocked HMRC API

**FR/NFR References:** FR63, FR66, NFR31, NFR32, NFR34

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR63, FR66) | RTI submissions, P45/P60 generation |
| Architecture | §2.22 HR/Payroll | HMRC RTI integration, XML schema, API auth |
| UX Design Specification | T2 (Record Detail) | RTI submission detail view |
| API Contracts | §2.16 HR/Payroll | RTI submission endpoints |
| Data Models | §12 HR/Payroll | HMRCSubmission model |
| State Machine Reference | §9 HR/Payroll | SM:HMRCSubmission — PENDING → SUBMITTED → ACCEPTED / REJECTED |
| Event Catalog | §8 HR/Payroll | rti.submitted event |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY related HMRC compliance rules |

---

### Story E23.S7: Statutory Payments (SSP, SMP, SPP, ShPP, SAP)

**User Story:** As a payroll administrator, I want to calculate and process statutory payments (Statutory Sick Pay, Maternity Pay, Paternity Pay, Shared Parental Pay, Adoption Pay) so that employees receive their legal entitlements.

**Acceptance Criteria:**

```gherkin
Scenario: Calculate SSP for qualifying absence
  Given an employee has been absent for 5 consecutive days (including 3 waiting days)
  And their average weekly earnings exceed the lower earnings limit
  When SSP is calculated
  Then 2 qualifying days at the current SSP rate are calculated
  And the SSP amount appears on their payroll run line

Scenario: Calculate SMP
  Given a female employee qualifies for SMP (26 weeks continuous service, earnings above LEL)
  When SMP is calculated for weeks 1-6
  Then SMP is 90% of average weekly earnings
  And for weeks 7-39, SMP is the lesser of 90% AWE or the statutory flat rate

Scenario: Statutory payment reduces employer NI liability
  Given SSP of GBP 200 was paid in the period
  When the EPS is generated
  Then the SSP amount is included for recovery/offset against NI liability

Scenario: Statutory payment replaces regular pay
  Given an employee receiving SMP
  When the payroll run processes their line
  Then SMP replaces their normal salary for the SMP period
  And any company-enhanced maternity pay is calculated on top if configured
```

**Key Tasks:**
1. **Implement SSP calculation** — qualifying days, waiting days, earnings threshold, daily rate
2. **Implement SMP calculation** — 90% AWE for 6 weeks + flat rate/90% for 33 weeks
3. **Implement SPP, ShPP, SAP calculations** — per HMRC current year rates
4. **Integrate statutory payments into payroll run** — replace or supplement regular pay
5. **Include in EPS for HMRC recovery** — track amounts for employer NI offset
6. **Build statutory payment configuration UI** — T7 (Settings) for rates and thresholds
7. **Write unit tests** — each statutory calculation with HMRC test scenarios
8. **Write integration tests** — statutory payment through payroll cycle

**FR/NFR References:** FR67, FR62, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR67) | Statutory payments (SSP, SMP, SPP, ShPP, SAP) |
| Architecture | §2.22 HR/Payroll | Statutory payment calculation engine |
| UX Design Specification | T7 (Settings) | Statutory payment configuration |
| API Contracts | §2.16 HR/Payroll | Statutory payment endpoints |
| Data Models | §12 HR/Payroll | Statutory payment models within PayrollRunLine |
| State Machine Reference | §9 HR/Payroll | Part of PayrollRun lifecycle |
| Event Catalog | §8 HR/Payroll | Statutory payment events (part of payroll events) |
| Business Rules Compendium | §7 HR/Payroll | BR-PAY related statutory payment rules |

---

### Story E23.S8: Performance Appraisals

**User Story:** As a manager, I want to conduct performance appraisals using configurable factor and rating matrices with multi-level approval workflows so that employee performance is assessed consistently and fairly.

**Acceptance Criteria:**

```gherkin
Scenario: Configure appraisal template
  Given I am an HR ADMIN
  When I create an appraisal template with factors (Communication, Teamwork, Technical Skills) and rating scale (1-5)
  Then an AppraisalTemplate is created with AppraisalFactor records
  And the template is available for creating appraisals

Scenario: Initiate employee appraisal
  Given an appraisal template exists
  When I create an appraisal for employee "Jane Smith" using the template
  Then an Appraisal record is created with status DRAFT
  And factor rating fields are pre-populated from the template

Scenario: Rate employee on factors
  Given an appraisal is in DRAFT status
  When I rate the employee: Communication=4, Teamwork=5, Technical Skills=3
  Then AppraisalFactorRating records are created for each factor
  And the overall score is calculated as weighted average (BR-APR-002)

Scenario: Multi-level approval
  Given an appraisal is completed by the line manager
  When submitted for approval
  Then it goes to the next level approver (e.g., department head)
  And the employee receives it for acknowledgement after final approval

Scenario: Employee self-assessment
  Given an appraisal cycle includes self-assessment
  When the employee completes their self-assessment ratings
  Then self-ratings are stored alongside manager ratings for comparison
```

**Key Tasks:**
1. **Create appraisal models** — AppraisalTemplate: companyId, name, isActive
   - AppraisalFactor: templateId, name, description, weight, sortOrder
   - Appraisal: employeeId, companyId, templateId, reviewerId, periodStart, periodEnd, status, overallScore, comments
   - AppraisalFactorRating: appraisalId, factorId, managerRating, selfRating, comments
2. **Implement appraisal CRUD endpoints** — `GET/POST/PUT /api/v1/hr/appraisals`
   - Template management: `GET/POST/PUT /api/v1/hr/appraisal-templates`
   - Submit for approval, acknowledge
3. **Implement scoring calculation** — weighted average of factor ratings (BR-APR-002)
4. **Implement multi-level approval** — integrate with ApprovalRequest (cross-cutting)
5. **Build appraisal form UI** — T2 with factor rating grid, comments, score summary
6. **Build template management** — T7 (Settings) for ADMIN
7. **Write unit tests** — score calculation, approval workflow, validation
8. **Write integration tests** — full appraisal cycle

**FR/NFR References:** FR103, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR103) | Performance appraisals, factor matrices |
| Architecture | §2.22 HR/Payroll | Appraisal models, scoring algorithm |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Appraisal form, template config |
| API Contracts | §2.16 HR/Payroll | Appraisal and template endpoints |
| Data Models | §12 HR/Payroll | AppraisalTemplate, Appraisal, AppraisalFactorRating |
| State Machine Reference | §9 HR/Payroll | Appraisal approval workflow |
| Event Catalog | §8 HR/Payroll | appraisal.completed event |
| Business Rules Compendium | §7 HR/Payroll | BR-APR-001 to BR-APR-004 (appraisal rules) |

---

### Story E23.S9: Skills, Training & Checkpoints

**User Story:** As an HR administrator, I want to manage employee skills and competencies, create training plans with scheduling, and track onboarding/offboarding checklists so that workforce development and HR processes are structured and tracked.

**Acceptance Criteria:**

```gherkin
Scenario: Record employee skill with rating
  Given skill categories and skills are configured (e.g., "Programming" → "TypeScript", "Python")
  When I rate an employee's TypeScript skill as 4/5
  Then an EmployeeSkill record is created with the rating and evaluation date
  And the skill appears on the employee's competency profile

Scenario: Create training plan
  Given a training need is identified
  When I create a training plan with title, description, trainer, and sessions
  Then a TrainingPlan is created with TrainingSession records for each scheduled session
  And double-booking detection warns if a session conflicts with another (BR-TRN-003)

Scenario: Track training attendance
  Given a training session is scheduled
  When I record attendance for enrolled employees
  Then TrainingAttendance records are created (attended/absent/excused)
  And the training plan auto-closes when all sessions are complete (BR-TRN-005)

Scenario: Onboarding checklist
  Given a checkpoint template "New Employee Onboarding" has 15 items
  When a new employee is hired
  Then a Checkpoint is created from the template with 15 CheckpointItems
  And each item can be assigned to different people (IT setup, HR, manager)
  And progress is tracked as items are completed

Scenario: Offboarding checklist
  Given an employee is terminated
  When the offboarding process starts
  Then an "Employee Offboarding" checkpoint is created
  And includes items like: return equipment, disable accounts, exit interview
```

**Key Tasks:**
1. **Create skill models** — SkillCategory, Skill, EmployeeSkill (with rating, evaluationDate, evaluatorId)
2. **Create training models** — TrainingPlan, TrainingSession, TrainingAttendance
3. **Create checkpoint models** — CheckpointTemplate, CheckpointItem template, Checkpoint, CheckpointItem, CheckpointItemCompletion
4. **Implement skill management endpoints** — CRUD for categories, skills, employee skill ratings
5. **Implement training plan endpoints** — CRUD with session management, attendance recording
   - Double-booking detection (BR-TRN-003)
   - Auto-close on completion (BR-TRN-005)
6. **Implement checkpoint endpoints** — template CRUD, checkpoint creation from template, item completion
7. **Build skill profile UI** — radar chart or matrix view on employee detail
8. **Build training management UI** — T1 list, T2 detail with sessions and attendance
9. **Build checkpoint UI** — checklist with progress bar, assignee indicators
10. **Write unit tests** — double-booking detection, auto-close, completion tracking
11. **Write integration tests** — full training lifecycle, checkpoint lifecycle

**FR/NFR References:** FR104, FR105, FR60, FR108, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR104, FR105, FR60, FR108) | Skills, training, onboarding checkpoints |
| Architecture | §2.22 HR/Payroll | Skill, Training, Checkpoint models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Training list, skill profile |
| API Contracts | §2.16 HR/Payroll | Skill, training, checkpoint endpoints |
| Data Models | §12 HR/Payroll | All skill, training, and checkpoint schemas |
| State Machine Reference | §9 HR/Payroll | Training plan lifecycle |
| Event Catalog | §8 HR/Payroll | training.completed, checkpoint.completed events |
| Business Rules Compendium | §7 HR/Payroll | BR-SKL-001-003, BR-TRN-001-005, BR-CHK-001-004 |

---

### Story E23.S10: Employee Benefits

**User Story:** As an HR administrator, I want to manage employee benefits on contracts with configurable benefit types, amounts, and payment frequencies so that total compensation packages are accurately recorded and calculated.

**Acceptance Criteria:**

```gherkin
Scenario: Configure benefit types
  Given I am an HR ADMIN
  When I create a benefit type "Company Car" with default monthly value and GL account
  Then the Benefit record is available for assignment to employees

Scenario: Assign benefit to employee
  Given benefit type "Private Health Insurance" exists
  When I add this benefit to an employee's contract with value GBP 150/month
  Then an EmployeeBenefit record is created linked to the contract
  And the benefit appears in the employee's total compensation view

Scenario: Benefit included in payroll
  Given an employee has benefits totalling GBP 500/month
  When the payroll run processes their line
  Then taxable benefits are included in PAYE calculation
  And non-taxable benefits are reported separately

Scenario: P11D reporting
  Given employees have benefits in kind
  When the P11D report is generated at year end
  Then each employee's benefits are listed with correct values
```

**Key Tasks:**
1. **Create benefit models** — Benefit: companyId, name, type, defaultValue, frequency, isTaxable, glAccountId
   - EmployeeBenefit: employeeId, contractId, benefitId, value, frequency, startDate, endDate
2. **Implement benefit endpoints** — CRUD for types and employee assignments
3. **Integrate with payroll** — include taxable benefits in PAYE calculation
4. **Implement P11D report generation**
5. **Build benefits management UI** — T7 (Settings) for types, T2 tab on employee detail
6. **Write unit tests** — benefit valuation, PAYE inclusion
7. **Write integration tests** — benefit through payroll cycle

**FR/NFR References:** FR107, FR62, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR107) | Employee benefits, amounts, frequencies |
| Architecture | §2.22 HR/Payroll | Benefit models, payroll integration |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Benefits on employee detail, type config |
| API Contracts | §2.16 HR/Payroll | Benefit type and assignment endpoints |
| Data Models | §12 HR/Payroll | Benefit, EmployeeBenefit schemas |
| State Machine Reference | §9 HR/Payroll | Part of contract lifecycle |
| Event Catalog | §8 HR/Payroll | benefit.assigned event |
| Business Rules Compendium | §7 HR/Payroll | Benefit calculation and tax treatment rules |

---

### Story E23.S11: HR Reports & Analytics

**User Story:** As an HR manager, I want to generate HR reports (employee list, headcount, leave summary, payroll summary, turnover analysis) so that I can make informed workforce decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Employee list report
  Given the company has 100 employees
  When I generate the employee list report
  Then I see all employees with name, department, position, start date, status
  And I can export to PDF or CSV

Scenario: Payslip generation
  Given a payroll run is POSTED
  When I generate payslips
  Then each employee receives a payslip showing gross pay, deductions, net pay
  And payslips can be emailed to employees or downloaded as PDF

Scenario: Leave summary report
  Given leave requests exist for Q1 2026
  When I generate the leave summary
  Then I see per-employee: entitlement, used, remaining, by leave type
  And department-level aggregations

Scenario: Headcount and turnover analysis
  Given employee records span 2 years
  When I generate the turnover report
  Then I see monthly headcount, joiners, leavers, and turnover rate
  And trends are displayed as line charts
```

**Key Tasks:**
1. **Implement employee list report** — filterable, sortable, exportable
2. **Implement payslip generation** — PDF per employee from payroll run data
   - Email distribution via Email Integration (E10)
3. **Implement leave summary report** — per employee and department aggregation
4. **Implement headcount/turnover report** — monthly tracking with trend analysis
5. **Build reports dashboard** — T8 (Report) template with filter controls and chart/table display
6. **Write unit tests** — report calculation logic, aggregations
7. **Write integration tests** — report generation with seeded data

**FR/NFR References:** FR66, FR76, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR66, FR76) | Payslips, P45/P60, HR reports |
| Architecture | §2.22 HR/Payroll | Report definitions, PDF generation |
| UX Design Specification | T8 (Report) | Report template with filters and export |
| API Contracts | §2.16 HR/Payroll | Report generation endpoints |
| Data Models | §12 HR/Payroll | All HR models for report queries |
| State Machine Reference | §9 HR/Payroll | N/A for reports |
| Event Catalog | §8 HR/Payroll | N/A for reports |
| Business Rules Compendium | §7 HR/Payroll | Report calculation rules |

---

### Story E23.S12: Mobile Adaptation — HR/Payroll

**User Story:** As a mobile user, I want to submit leave requests, view my payslips, and check my team's availability from my phone so that I can manage essential HR tasks on the go.

**Acceptance Criteria:**

```gherkin
Scenario: Submit leave request from mobile
  Given I am on the mobile app
  When I submit a leave request with dates and type
  Then the request is created and my manager is notified

Scenario: View payslip on mobile
  Given my latest payslip is available
  When I view it on mobile
  Then I see a mobile-optimised payslip summary
  And I can download the full PDF

Scenario: Manager views team leave calendar
  Given I am a manager on mobile
  When I view my team's availability
  Then I see a simplified calendar showing who is off
  And I can approve/reject pending leave requests

Scenario: Push notification for leave approval
  Given I submitted a leave request
  When my manager approves it
  Then I receive a push notification confirming the approval
```

**Key Tasks:**
1. **Create mobile leave request form** — simplified date picker and type selector
2. **Create mobile payslip viewer** — summary view with PDF download option
3. **Create mobile team calendar** — simplified availability view
4. **Create mobile approval queue** — leave requests pending my approval
5. **Implement push notifications** — leave approved/rejected, payslip available
6. **Write unit tests** — mobile data transformations
7. **Write integration tests** — mobile leave flow, payslip access

**FR/NFR References:** FR61, FR66, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.7 HR/Payroll (FR61, FR66) | Leave requests, payslips |
| Architecture | §2.22 HR/Payroll | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.16 HR/Payroll | Same endpoints for mobile |
| Data Models | §12 HR/Payroll | Same models |
| State Machine Reference | §9 HR/Payroll | Same state machines |
| Event Catalog | §8 HR/Payroll | Push notification triggers |
| Business Rules Compendium | §7 HR/Payroll | Same rules apply |

---

## Epic E24: Manufacturing / MRP

> **Manufacturing module with Bills of Materials (BOM), production orders, operations, shift management, MRP planning, and quality inspection.** Supports multi-level BOMs, work-in-progress accounting, and capacity planning with machine/work centre management.

**Architecture:** §2.23 Manufacturing/MRP
**Models:** 23 models — `BillOfMaterial`, `BomLine`, `ProductionOrder`, `Production`, `ProductionOperation`, `ProductionOperationWorker`, `ProductionMaterialConsumption`, `ProductionFinishedGood`, `ProductionPlan`, `MrpSuggestion`, `RoutingTemplate`, `RoutingStep`, `WorkCentre`, `Machine`, `MachineAvailability`, `ShiftSchedule`, `ShiftAssignment`, `QualityInspection`, `QualityDefect`, `ProductionCostEntry`, plus reference models
**State Machines:** SM:ProductionOrder, SM:Production, SM:ProductionOperation, SM:ProductionPlan
**Events:** `production.order.created`, `production.started`, `production.finished`, `production.discarded`, `mrp.suggestions.generated`
**API:** §2.17 — ~41 endpoints under `/production/*`
**Business Rules:** BR-PRD-001 to BR-PRD-015
**FRs:** FR68–FR73, FR109–FR115
**UX Templates:** T1 (Entity List), T2 (Record Detail), T3 (Header+Lines), T5 (Board/Kanban), T6 (Wizard)

**Dependencies:** E15 (Inventory for stock levels and material consumption), E14 (Finance/GL for WIP accounting), E16 (Sales Orders for demand-driven production)

---

### Story E24.S1: Bills of Materials (BOM)

**User Story:** As a production manager, I want to create and manage Bills of Materials with multi-level component structures so that I can define how products are manufactured from raw materials and sub-assemblies.

**Acceptance Criteria:**

```gherkin
Scenario: Create a single-level BOM
  Given item "Widget A" exists in inventory
  When I create a BOM for "Widget A" with 3 component lines (raw materials)
  Then a BillOfMaterial record is created with 3 BomLine records
  And each line specifies component item, quantity, unit of measure, and scrap percentage

Scenario: Create a multi-level BOM
  Given "Sub-Assembly B" has its own BOM with 2 components
  When I create a BOM for "Widget A" that includes "Sub-Assembly B" as a component
  Then the BOM hierarchy shows Widget A → Sub-Assembly B → raw materials
  And the indented BOM report shows all levels

Scenario: BOM explosion
  Given a BOM for "Widget A" includes "Sub-Assembly B" (qty 2) which includes "Part C" (qty 3 each)
  When I view the exploded BOM
  Then "Part C" shows total quantity of 6 (2 sub-assemblies * 3 parts each)

Scenario: BOM with scrap factor
  Given a BOM line for "Part C" has quantity 10 and scrap factor 5%
  When material requirements are calculated
  Then the required quantity is 10.5 (10 * 1.05)

Scenario: BOM version control
  Given a BOM version 1 exists for "Widget A"
  When I create version 2 with modified quantities
  Then both versions are retained
  And production orders reference the specific BOM version used

Scenario: Recipe/BOM explosion on sales documents
  Given a sales quote includes a BOM item "Widget A"
  When the user triggers recipe explosion
  Then component line items are generated on the quote (FR109)
```

**Key Tasks:**
1. **Create BOM models** — BillOfMaterial: companyId, itemId, version, description, quantity (batch size), isActive
   - BomLine: bomId, lineNumber, componentItemId, quantity, unitOfMeasure, scrapPercentage, isCritical
2. **Implement BOM CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/production/boms`
   - Nested line management; version creation
   - BOM explosion endpoint: `GET /api/v1/production/boms/:id/explode`
3. **Implement multi-level BOM explosion** — recursive traversal with quantity multiplication and scrap factor
   - Detect circular references (BR-PRD-001)
4. **Implement recipe explosion for sales docs** — explode BOM on quote/SO/invoice line items (FR109)
5. **Build BOM detail UI** — T3 (Header+Lines) with indented component tree view
6. **Build BOM list UI** — T1 with item name, version, component count
7. **Write unit tests** — explosion calculation, scrap factor, circular reference detection
8. **Write integration tests** — BOM creation, multi-level explosion, recipe explosion on sales doc

**FR/NFR References:** FR68, FR109, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR68, FR109) | BOM management, multi-level structures, recipe explosion |
| Architecture | §2.23 Manufacturing/MRP | BillOfMaterial, BomLine models, explosion algorithm |
| UX Design Specification | T3 (Header+Lines), T1 (Entity List) | BOM detail with tree view, BOM list |
| API Contracts | §2.17 Manufacturing | BOM CRUD, explosion endpoints |
| Data Models | §13 Production | BillOfMaterial, BomLine schemas |
| State Machine Reference | §10 Manufacturing | N/A — BOMs are reference data |
| Event Catalog | §9 Manufacturing | bom.created, bom.updated events |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-001 (circular reference), BR-PRD-002 (scrap) |

---

### Story E24.S2: Production Orders & Operations

**User Story:** As a production manager, I want to create production orders (work orders) with material requirements and routing operations so that I can plan and track manufacturing activities.

**Acceptance Criteria:**

```gherkin
Scenario: Create production order from BOM
  Given a BOM exists for "Widget A"
  When I create a production order for 100 units of "Widget A"
  Then a ProductionOrder record is created with status PLANNED
  And material requirements are calculated from the BOM (quantity * 100 + scrap)
  And a "production.order.created" event is emitted

Scenario: Production order from sales order
  Given a confirmed sales order includes 50 units of "Widget A"
  When I create a production order from the sales order line
  Then the production order is linked to the sales order
  And the quantity is set to 50

Scenario: Define routing operations
  Given a production order exists
  When I add routing operations (Cut, Assemble, Paint, QC) with estimated hours and work centres
  Then ProductionOperation records are created in sequence
  And each operation has estimated setup time and run time

Scenario: Material availability check
  Given a production order requires 100 units of "Part C"
  And only 60 units are in stock
  When I check material availability
  Then a shortage of 40 units is flagged (FR73)
  And the shortage is displayed with suggested resolution (order from supplier)

Scenario: Confirm production order
  Given a production order is PLANNED and materials are available
  When I confirm the order
  Then the status changes to CONFIRMED
  And materials are reserved in inventory
```

**Key Tasks:**
1. **Create production order models** — ProductionOrder: companyId, orderNumber (NumberSeries), bomId, itemId, quantity, status enum, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, salesOrderLineId (optional), priority
   - ProductionOperation: productionOrderId, operationNumber, workCentreId, machineId, setupTimeMinutes, runTimeMinutes, status, actualStart, actualEnd
2. **Implement production order endpoints** — `GET/POST/PUT/DELETE /api/v1/production/orders`
   - Create from BOM with material calculation
   - Create from sales order line
   - Confirm endpoint with material reservation
3. **Implement material availability check** — compare BOM requirements against current stock levels
   - Report shortages with resolution suggestions
4. **Implement routing template application** — apply RoutingTemplate to production order creating operations
5. **Build production order UI** — T3 (Header+Lines) with operations and materials tabs
6. **Build production order list** — T1 with status, item, quantity, planned dates
7. **Write unit tests** — material calculation, availability check, shortage reporting
8. **Write integration tests** — full production order creation and confirmation

**FR/NFR References:** FR69, FR70, FR73, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR69, FR70, FR73) | Work orders, material requirements, availability check |
| Architecture | §2.23 Manufacturing/MRP | ProductionOrder, ProductionOperation models |
| UX Design Specification | T3 (Header+Lines), T1 (Entity List) | Production order layout |
| API Contracts | §2.17 Manufacturing | Production order CRUD, confirm, availability endpoints |
| Data Models | §13 Production | ProductionOrder, ProductionOperation schemas |
| State Machine Reference | §10 Manufacturing | SM:ProductionOrder — PLANNED → CONFIRMED → IN_PROGRESS → COMPLETED |
| Event Catalog | §9 Manufacturing | production.order.created event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-003 to BR-PRD-006 (production order rules) |

---

### Story E24.S3: Production Execution & Material Consumption

**User Story:** As a production worker/supervisor, I want to record production start/finish, material consumption, and finished goods receipt so that actual production progress is tracked against plans.

**Acceptance Criteria:**

```gherkin
Scenario: Start production
  Given a production order is CONFIRMED
  When I start production
  Then the status changes to IN_PROGRESS
  And a "production.started" event is emitted
  And the actual start date is recorded

Scenario: Record material consumption
  Given production is in progress
  When I record consumption of 95 units of "Part C" (planned 100)
  Then a ProductionMaterialConsumption record is created
  And inventory stock level is decremented by 95 (FR71)

Scenario: Record finished goods
  Given production is in progress for 100 units
  When I record 98 finished goods received into warehouse
  Then a ProductionFinishedGood record is created
  And inventory stock level is incremented by 98 (FR72)
  And the yield is calculated as 98%

Scenario: Complete production
  Given all operations are finished and goods are received
  When I complete the production order
  Then the status changes to COMPLETED
  And a "production.finished" event is emitted
  And variance analysis is available (planned vs actual materials, time)

Scenario: Discard production order
  Given a production order encounters issues
  When I discard it with reason
  Then the status changes to DISCARDED
  And a "production.discarded" event is emitted
  And any reserved materials are released
```

**Key Tasks:**
1. **Create execution models** — ProductionMaterialConsumption: productionOrderId, itemId, quantity, warehouseLocationId, consumedDate, consumedById
   - ProductionFinishedGood: productionOrderId, itemId, quantity, warehouseLocationId, receivedDate, receivedById
2. **Implement execution endpoints** — `POST /api/v1/production/orders/:id/start`, `/complete`, `/discard`
   - Material consumption: `POST /api/v1/production/orders/:id/consume`
   - Finished goods: `POST /api/v1/production/orders/:id/receive`
3. **Implement inventory integration** — decrement stock on consumption, increment on receipt
   - Create StockMovement records for audit trail
4. **Implement variance analysis** — compare planned vs actual for materials, time, and output
5. **Build production execution UI** — T2 with status controls, consumption form, receipt form
6. **Build production board** — T5 (Board/Kanban) showing orders by status
7. **Write unit tests** — stock movements, variance calculation, status transitions
8. **Write integration tests** — full production execution cycle with inventory changes

**FR/NFR References:** FR71, FR72, FR48, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR71, FR72) | Material consumption, finished goods receipt |
| Architecture | §2.23 Manufacturing/MRP | Execution models, inventory integration |
| UX Design Specification | T2 (Record Detail), T5 (Board/Kanban) | Execution controls, production board |
| API Contracts | §2.17 Manufacturing | Start, complete, consume, receive endpoints |
| Data Models | §13 Production | ProductionMaterialConsumption, ProductionFinishedGood |
| State Machine Reference | §10 Manufacturing | SM:Production — IN_PROGRESS → COMPLETED / DISCARDED |
| Event Catalog | §9 Manufacturing | production.started, production.finished, production.discarded |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-007 to BR-PRD-009 (execution rules) |

---

### Story E24.S4: Shift Management & Time Registration

**User Story:** As a production manager, I want to define shift schedules, assign workers to shifts, and register time worked per production operation so that labour costs and productivity are tracked accurately.

**Acceptance Criteria:**

```gherkin
Scenario: Define shift schedule
  Given I am a production MANAGER
  When I create a shift schedule "Morning" (06:00-14:00) and "Afternoon" (14:00-22:00)
  Then ShiftSchedule records are created for the company

Scenario: Assign workers to shifts
  Given shift schedules exist
  When I assign employee "John" to "Morning" shift for the week of 10 March
  Then a ShiftAssignment record is created
  And John's schedule shows the assignment

Scenario: Register time on production operation
  Given a production operation is in progress
  When worker "John" registers 4 hours worked on operation "Assembly"
  Then a ProductionOperationWorker record is created with start/stop times
  And the operation's actual time is updated (FR111)

Scenario: Multiple workers on one operation
  Given operation "Assembly" requires 3 workers
  When John registers 4h, Jane registers 3.5h, and Bob registers 4h
  Then all three time entries are recorded
  And total labour hours for the operation is 11.5 hours

Scenario: Time registration posts labour cost
  Given worker time is registered at GBP 15/hour
  When the operation completes
  Then labour cost of GBP 172.50 (11.5h * 15) is calculated
  And a ProductionCostEntry is created for GL posting (FR112)
```

**Key Tasks:**
1. **Create shift models** — ShiftSchedule: companyId, name, startTime, endTime, breakMinutes
   - ShiftAssignment: shiftScheduleId, employeeId, date, status
2. **Create time registration model** — ProductionOperationWorker: operationId, employeeId, startTime, endTime, durationMinutes
3. **Implement shift management endpoints** — CRUD for schedules and assignments
4. **Implement time registration endpoints** — `POST /api/v1/production/operations/:id/time`
   - Start/stop tracking or manual entry
5. **Implement labour cost calculation** — hours * rate per worker; aggregate per operation and order
6. **Build shift management UI** — T7 (Settings) for schedule config, calendar view for assignments
7. **Build time registration UI** — clock-in/clock-out buttons or manual time entry form
8. **Write unit tests** — labour cost calculation, shift overlap detection
9. **Write integration tests** — time registration → cost calculation → GL posting flow

**FR/NFR References:** FR110, FR111, FR112, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR110, FR111, FR112) | Shifts, time registration, cost posting |
| Architecture | §2.23 Manufacturing/MRP | ShiftSchedule, time registration, cost models |
| UX Design Specification | T7 (Settings), T2 (Record Detail) | Shift config, time registration UI |
| API Contracts | §2.17 Manufacturing | Shift, assignment, time registration endpoints |
| Data Models | §13 Production | ShiftSchedule, ShiftAssignment, ProductionOperationWorker |
| State Machine Reference | §10 Manufacturing | ProductionOperation lifecycle with time tracking |
| Event Catalog | §9 Manufacturing | production.time.registered event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-010 (shift rules), BR-PRD-011 (cost posting) |

---

### Story E24.S5: MRP (Material Requirements Planning)

**User Story:** As a production planner, I want the system to run MRP calculations based on demand, stock levels, lead times, and open orders so that I receive suggestions for purchase orders and production orders to meet demand.

**Acceptance Criteria:**

```gherkin
Scenario: Run MRP calculation
  Given sales orders, stock levels, open POs, and open production orders exist
  When I trigger an MRP run
  Then the system calculates net requirements per item
  And generates MrpSuggestion records for items with shortages
  And a "mrp.suggestions.generated" event is emitted

Scenario: MRP suggests purchase order
  Given item "Part C" has demand of 500, stock of 200, open PO for 100
  When MRP runs
  Then a suggestion is generated: "Purchase 200 units of Part C" with suggested order date based on lead time

Scenario: MRP suggests production order
  Given finished good "Widget A" has demand of 100, stock of 20, no open production orders
  When MRP runs
  Then a suggestion is generated: "Produce 80 units of Widget A"
  And sub-component requirements are calculated from BOM explosion

Scenario: Convert MRP suggestion to order
  Given an MRP suggestion exists for purchasing "Part C"
  When I approve and convert the suggestion
  Then a draft Purchase Order is created with the suggested item and quantity
  And the suggestion is marked as CONVERTED

Scenario: MRP respects safety stock
  Given item "Part C" has safety stock of 50 units
  When MRP calculates requirements
  Then the safety stock buffer is included in the net requirement calculation

Scenario: MRP considers lead times
  Given "Part C" has a supplier lead time of 10 working days
  And the demand date is 20 March 2026
  When MRP calculates the order date
  Then the suggested order date is 6 March 2026 (20 March minus 10 working days)
```

**Key Tasks:**
1. **Create MRP models** — MrpSuggestion: companyId, itemId, suggestionType (PURCHASE, PRODUCE), quantity, demandDate, suggestedOrderDate, sourceEntityType, sourceEntityId, status (PENDING, CONVERTED, IGNORED)
   - ProductionPlan: companyId, planDate, status, generatedSuggestionCount
2. **Implement MRP calculation engine** — `POST /api/v1/production/mrp/run`
   - Gather demand (sales orders, production orders)
   - Gather supply (stock, open POs, open production orders)
   - Calculate net requirements per item (demand - supply - stock + safety stock)
   - Explode BOMs for production items to get sub-component requirements
   - Apply lead times to calculate suggested order dates
3. **Implement suggestion management endpoints** — list, convert, ignore
   - Convert to PO: create draft Purchase Order
   - Convert to production order: create draft Production Order
4. **Build MRP run wizard** — T6 with parameter selection (date range, items/categories), progress, results
5. **Build suggestion list** — T1 with action buttons (convert, ignore)
6. **Implement capacity consideration** — check work centre availability when suggesting production
7. **Write unit tests** — net requirement calculation, lead time calculation, BOM explosion for MRP
8. **Write integration tests** — full MRP cycle from demand to suggestion to order conversion

**FR/NFR References:** FR113, FR44, FR73, NFR5

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR113) | MRP calculations, demand/supply analysis |
| Architecture | §2.23 Manufacturing/MRP | MRP engine design, suggestion model |
| UX Design Specification | T6 (Wizard), T1 (Entity List) | MRP run wizard, suggestion list |
| API Contracts | §2.17 Manufacturing | MRP run, suggestion management endpoints |
| Data Models | §13 Production | MrpSuggestion, ProductionPlan schemas |
| State Machine Reference | §10 Manufacturing | SM:ProductionPlan — RUNNING → COMPLETED |
| Event Catalog | §9 Manufacturing | mrp.suggestions.generated event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-012 to BR-PRD-014 (MRP rules) |

---

### Story E24.S6: Work Centre & Machine Capacity

**User Story:** As a production manager, I want to manage machine and work centre capacity with availability calendars and utilisation tracking so that I can plan production within capacity constraints.

**Acceptance Criteria:**

```gherkin
Scenario: Define work centre
  Given I am a production MANAGER
  When I create a work centre "Assembly Line 1" with hourly rate and capacity (8 hours/day)
  Then a WorkCentre record is created with capacity configuration

Scenario: Define machine within work centre
  Given work centre "Assembly Line 1" exists
  When I add machine "Drill Press A" with availability schedule
  Then a Machine record is created linked to the work centre
  And MachineAvailability records define operating hours

Scenario: View capacity utilisation
  Given machines have production operations scheduled
  When I view the capacity dashboard
  Then I see utilisation percentage per work centre and machine
  And overloaded time slots are highlighted in red

Scenario: Capacity check during scheduling
  Given "Assembly Line 1" is at 90% utilisation for the week
  When I schedule a new operation requiring 8 hours
  Then the system warns about capacity overload
  And suggests alternative dates or work centres

Scenario: Machine maintenance window
  Given machine "Drill Press A" has scheduled maintenance on 15 March
  When production scheduling checks availability
  Then the maintenance window is excluded from available capacity
```

**Key Tasks:**
1. **Create capacity models** — WorkCentre: companyId, name, hourlyRate, dailyCapacityHours, overheadRate
   - Machine: workCentreId, name, type, status
   - MachineAvailability: machineId, dayOfWeek, startTime, endTime, isAvailable
2. **Implement capacity endpoints** — CRUD for work centres, machines, availability
   - Utilisation report: `GET /api/v1/production/capacity/utilisation`
3. **Implement capacity check** — compare scheduled operations against available capacity
4. **Build capacity dashboard** — Gantt-style or calendar view showing utilisation
5. **Build work centre/machine management** — T7 (Settings) with availability calendar
6. **Write unit tests** — utilisation calculation, capacity check, maintenance window exclusion
7. **Write integration tests** — scheduling with capacity constraints

**FR/NFR References:** FR114, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR114) | Machine/work centre capacity, utilisation |
| Architecture | §2.23 Manufacturing/MRP | WorkCentre, Machine, capacity models |
| UX Design Specification | T7 (Settings) | Capacity configuration, utilisation dashboard |
| API Contracts | §2.17 Manufacturing | Capacity management and utilisation endpoints |
| Data Models | §13 Production | WorkCentre, Machine, MachineAvailability schemas |
| State Machine Reference | §10 Manufacturing | N/A — capacity is reference data |
| Event Catalog | §9 Manufacturing | capacity.overload.warning event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-015 (capacity rules) |

---

### Story E24.S7: Quality Inspection

**User Story:** As a quality controller, I want to perform quality inspections at the production operation level with pass/fail recording and defect tracking so that product quality is monitored and defects are documented.

**Acceptance Criteria:**

```gherkin
Scenario: Record quality inspection pass
  Given a production operation "Assembly" is in progress
  When I perform a quality inspection and record PASS with inspection notes
  Then a QualityInspection record is created with result PASS
  And the operation can proceed to the next step

Scenario: Record quality inspection fail
  Given a production operation is in progress
  When I record a quality inspection FAIL with defect description
  Then a QualityInspection and QualityDefect record are created
  And the operation is flagged for rework or scrap decision

Scenario: Defect tracking with categorisation
  Given a quality inspection found defects
  When I record defect type "Surface scratch", quantity 5, severity "Minor"
  Then a QualityDefect record captures the details
  And defect statistics are available for trend analysis

Scenario: Inspection required gate
  Given an operation is configured to require quality inspection
  When I attempt to complete the operation without inspection
  Then the system prevents completion with "quality.error.inspection_required"
```

**Key Tasks:**
1. **Create quality models** — QualityInspection: operationId, inspectedById, inspectionDate, result (PASS/FAIL/CONDITIONAL), notes
   - QualityDefect: inspectionId, defectType, description, quantity, severity (MINOR/MAJOR/CRITICAL), resolution
2. **Implement quality endpoints** — `POST /api/v1/production/operations/:id/inspect`
   - Defect recording: `POST /api/v1/production/inspections/:id/defects`
3. **Implement inspection gate** — configurable per operation; prevent completion without inspection
4. **Build inspection UI** — form on operation detail with pass/fail, defect list
5. **Implement defect analytics** — defect rates by type, severity, work centre
6. **Write unit tests** — inspection gate, defect categorisation
7. **Write integration tests** — inspection flow within production execution

**FR/NFR References:** FR115, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR115) | Quality inspections, pass/fail, defect tracking |
| Architecture | §2.23 Manufacturing/MRP | QualityInspection, QualityDefect models |
| UX Design Specification | T2 (Record Detail) | Inspection form within operation detail |
| API Contracts | §2.17 Manufacturing | Inspection and defect endpoints |
| Data Models | §13 Production | QualityInspection, QualityDefect schemas |
| State Machine Reference | §10 Manufacturing | Inspection as gate in operation lifecycle |
| Event Catalog | §9 Manufacturing | quality.inspection.completed event |
| Business Rules Compendium | §8 Manufacturing | Quality inspection rules |

---

### Story E24.S8: WIP Accounting & Production Costing

**User Story:** As a finance user, I want production costs (materials, labour, overhead) posted to GL with work-in-progress accounting so that manufacturing costs are accurately reflected in financial statements.

**Acceptance Criteria:**

```gherkin
Scenario: Material cost posting
  Given materials worth GBP 5,000 are consumed in production
  When cost posting runs
  Then GL journal: Debit WIP account GBP 5,000, Credit Raw Materials account GBP 5,000

Scenario: Labour cost posting
  Given 100 labour hours at GBP 15/hour are recorded
  When cost posting runs
  Then GL journal: Debit WIP account GBP 1,500, Credit Payroll Clearing GBP 1,500

Scenario: Overhead allocation
  Given work centre "Assembly Line 1" has overhead rate GBP 5/hour
  And 100 hours were used in production
  When overhead is allocated
  Then GL journal: Debit WIP account GBP 500, Credit Overhead Applied GBP 500

Scenario: Finished goods receipt clears WIP
  Given WIP balance is GBP 7,000 for the production order
  When finished goods are received
  Then GL journal: Debit Finished Goods Inventory GBP 7,000, Credit WIP GBP 7,000

Scenario: Production variance posting
  Given standard cost is GBP 70/unit and actual cost is GBP 72/unit for 100 units
  When variances are calculated
  Then material, labour, and overhead variances are posted to variance accounts
```

**Key Tasks:**
1. **Create cost models** — ProductionCostEntry: productionOrderId, costType (MATERIAL, LABOUR, OVERHEAD), amount, glAccountId, journalEntryId
2. **Implement material cost posting** — triggered on material consumption events
3. **Implement labour cost posting** — triggered on time registration
4. **Implement overhead allocation** — based on work centre rates and actual hours
5. **Implement WIP clearance** — on finished goods receipt, move costs from WIP to inventory
6. **Implement variance analysis** — standard vs actual cost comparison
7. **Build cost summary UI** — cost breakdown on production order detail
8. **Write unit tests** — each cost posting type, variance calculation
9. **Write integration tests** — full production costing cycle with GL verification

**FR/NFR References:** FR112, FR12, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR112) | Operation-level cost posting, WIP accounting |
| Architecture | §2.23 Manufacturing/MRP | Production costing model, GL integration |
| UX Design Specification | T2 (Record Detail) | Cost breakdown on production order |
| API Contracts | §2.17 Manufacturing | Cost posting and variance endpoints |
| Data Models | §13 Production | ProductionCostEntry schema |
| State Machine Reference | §10 Manufacturing | Cost posting as side effect of execution |
| Event Catalog | §9 Manufacturing | production.cost.posted event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-011 (cost posting rules) |

---

### Story E24.S9: Mobile Adaptation — Manufacturing

**User Story:** As a production floor worker, I want to use my phone or tablet to scan materials, register time, record output, and log quality inspections so that production data is captured in real time on the shop floor.

**Acceptance Criteria:**

```gherkin
Scenario: Scan material barcode for consumption
  Given a production order is in progress
  When I scan a material item barcode on mobile
  Then the item is identified and I can enter the consumed quantity
  And the consumption is recorded immediately

Scenario: Clock in/out on production operation
  Given an operation is assigned to me
  When I tap "Start" on my mobile device
  Then my time registration begins
  And when I tap "Stop", the elapsed time is recorded

Scenario: Record output quantity from mobile
  Given I am on the production floor
  When I enter the quantity of finished goods produced
  Then the finished goods receipt is recorded and inventory updated

Scenario: Quick quality inspection from mobile
  Given an operation requires inspection
  When I perform inspection and record PASS/FAIL on mobile
  Then the inspection result is recorded with timestamp
```

**Key Tasks:**
1. **Create mobile production dashboard** — list of assigned operations with status
2. **Implement barcode scanning for materials** — scan and consume workflow
3. **Implement mobile time clock** — start/stop buttons per operation
4. **Implement mobile output recording** — quantity entry with confirmation
5. **Implement mobile quality inspection** — simple pass/fail with notes
6. **Write unit tests** — mobile data entry validation
7. **Write integration tests** — mobile production capture flow

**FR/NFR References:** FR71, FR72, FR111, FR115, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR71, FR72, FR111, FR115) | Production execution features |
| Architecture | §2.23 Manufacturing/MRP | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns for production |
| API Contracts | §2.17 Manufacturing | Same endpoints for mobile |
| Data Models | §13 Production | Same models |
| State Machine Reference | §10 Manufacturing | Same state machines |
| Event Catalog | §9 Manufacturing | Same events |
| Business Rules Compendium | §8 Manufacturing | Same rules |

---

## Epic E25: Reporting Engine

> **Comprehensive reporting engine providing standard financial reports, operational reports, HR reports, custom report builder, and AI-powered ad-hoc natural language queries.** Includes VAT return generation for HMRC MTD submission and cash flow forecasting.

**Architecture:** §2.25 Reporting Engine (referenced in PRD)
**API:** §2.18 — ~14 endpoints under `/reports/*`
**FRs:** FR74–FR79, FR91, FR153
**UX Templates:** T8 (Report), T4 (Briefing)

**Dependencies:** E14 (Finance/GL for financial reports), E17/E19 (AR/AP for aging), E23 (HR for payroll/HR reports), E15 (Inventory for stock valuation), E5 (AI for natural language queries)

---

### Story E25.S1: Financial Reports (P&L, Balance Sheet, Trial Balance)

**User Story:** As a finance user, I want to generate standard financial reports (Profit & Loss, Balance Sheet, Trial Balance, Cash Flow Statement) for any date range so that I can review the company's financial position.

**Acceptance Criteria:**

```gherkin
Scenario: Generate Profit & Loss report
  Given journal entries exist for Q1 2026
  When I generate a P&L report for 1 Jan to 31 Mar 2026
  Then the report shows income, cost of sales, gross profit, expenses, and net profit
  And each line maps to chart of account categories
  And the report totals balance (income - expenses = net profit)

Scenario: Generate Balance Sheet
  Given the GL has posted entries
  When I generate a Balance Sheet as at 31 March 2026
  Then the report shows assets, liabilities, and equity
  And assets = liabilities + equity (double-entry verification)

Scenario: Generate Trial Balance
  Given GL accounts have balances
  When I generate a Trial Balance for March 2026
  Then all accounts with non-zero balances are listed
  And total debits equal total credits

Scenario: Comparative period reporting
  Given I want to compare Q1 2026 to Q1 2025
  When I generate a comparative P&L
  Then both periods are shown side by side with variance (amount and percentage)

Scenario: Export report to PDF and CSV
  Given a financial report is generated
  When I click Export PDF
  Then a formatted PDF is downloaded
  When I click Export CSV
  Then a CSV file with report data is downloaded (FR78)
```

**Key Tasks:**
1. **Implement P&L report query** — aggregate journal entries by account category for date range
   - Income, COGS, operating expenses, other income/expenses
   - Support department/cost centre filtering
2. **Implement Balance Sheet query** — cumulative balances as at date
   - Fixed assets (net of depreciation), current assets, liabilities, equity
3. **Implement Trial Balance query** — all accounts with period debits, credits, and closing balance
4. **Implement comparative reporting** — dual-period with variance calculation
5. **Implement PDF export** — formatted report via Document Templates (E12)
6. **Implement CSV export** — tabular data export
7. **Build report UI** — T8 (Report) template with period selector, filters, table, and export buttons
8. **Write unit tests** — aggregation logic, balance verification (A=L+E, DR=CR)
9. **Write integration tests** — report generation with seeded GL data

**FR/NFR References:** FR74, FR78, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR74, FR78) | Standard financial reports, export |
| Architecture | §2.25 Reporting Engine | Report query design, aggregation patterns |
| UX Design Specification | T8 (Report) | Report template with filters and export |
| API Contracts | §2.18 Reporting | Financial report endpoints |
| Data Models | §3 Finance | GL Account, JournalEntry for report queries |
| State Machine Reference | N/A | N/A for reports |
| Event Catalog | N/A | N/A for reports |
| Business Rules Compendium | §12 Cross-Cutting | Report calculation rules |

---

### Story E25.S2: Operational Reports (AR/AP Aging, Stock Valuation)

**User Story:** As a finance/operations user, I want to generate operational reports (AR/AP aging, stock valuation, bank reconciliation) so that I can manage working capital and operational performance.

**Acceptance Criteria:**

```gherkin
Scenario: Generate AR aging report
  Given open customer invoices exist with various due dates
  When I generate the AR aging report as at 31 March 2026
  Then invoices are grouped by customer and aging bands (Current, 30, 60, 90, 120+ days)
  And each band shows the outstanding amount
  And the total matches the debtor balance in the GL

Scenario: Generate AP aging report
  Given open supplier invoices exist
  When I generate the AP aging report
  Then invoices are grouped by supplier and aging bands
  And payment priority is indicated for overdue items

Scenario: Generate stock valuation report
  Given inventory items have stock and cost prices
  When I generate the stock valuation report
  Then each item shows quantity on hand, unit cost, and total value
  And the total valuation matches the inventory GL account balance

Scenario: Bank reconciliation report
  Given bank reconciliation has been performed
  When I generate the bank reconciliation report
  Then it shows: bank statement balance, unreconciled items, adjusted book balance
  And the reconciliation matches (statement balance - unreconciled = book balance)
```

**Key Tasks:**
1. **Implement AR aging report** — group open invoices by customer and aging bands
2. **Implement AP aging report** — group open supplier invoices by supplier and aging bands
3. **Implement stock valuation report** — current stock * cost price per item
4. **Implement bank reconciliation report** — reconciled vs unreconciled items
5. **Build report UIs** — T8 (Report) template for each report type
6. **Write unit tests** — aging band calculation, valuation, reconciliation math
7. **Write integration tests** — report accuracy with seeded transaction data

**FR/NFR References:** FR75, FR24, FR30, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR75) | Operational reports (aging, stock, bank rec) |
| Architecture | §2.25 Reporting Engine | Operational report queries |
| UX Design Specification | T8 (Report) | Report template |
| API Contracts | §2.18 Reporting | Operational report endpoints |
| Data Models | §5 AR, §7 AP, §4 Inventory | Models for report queries |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Aging calculation rules |

---

### Story E25.S3: VAT Return & HMRC MTD Submission

**User Story:** As a finance user, I want to generate VAT returns and submit them to HMRC via the Making Tax Digital (MTD) API so that we comply with UK VAT reporting requirements.

**Acceptance Criteria:**

```gherkin
Scenario: Generate VAT return
  Given transactions exist for the VAT quarter (Jan-Mar 2026)
  When I generate the VAT return
  Then the 9 VAT return boxes are calculated from GL data:
    Box 1: VAT due on sales, Box 2: VAT due on acquisitions,
    Box 3: Total VAT due, Box 4: VAT reclaimed on purchases,
    Box 5: Net VAT (Box 3 - Box 4), Boxes 6-9: Sales/purchases totals

Scenario: VAT scheme configuration
  Given the company uses Flat Rate VAT Scheme
  When the VAT return is calculated
  Then the flat rate percentage is applied instead of standard input/output VAT (FR90)

Scenario: Submit VAT return to HMRC MTD
  Given a VAT return has been generated and reviewed
  When I submit to HMRC
  Then the return is sent via the HMRC MTD API
  And the response (acceptance/rejection) is recorded
  And the submission is logged in the audit trail

Scenario: Fraud prevention headers
  Given HMRC requires fraud prevention headers
  When the VAT return is submitted
  Then all required fraud prevention headers are included per HMRC specification
```

**Key Tasks:**
1. **Implement VAT return calculation** — aggregate transactions by VAT code and rate for the period
   - Support Standard, Flat Rate, and Cash Accounting schemes (FR90)
   - Calculate all 9 boxes per HMRC specification
2. **Implement HMRC MTD API integration** — authenticate via OAuth2, submit VAT return
   - Include fraud prevention headers
   - Handle async response and polling
3. **Build VAT return wizard** — T6 with period selection, preview of 9 boxes, submit button
4. **Implement audit logging** — log all submission attempts and responses
5. **Write unit tests** — box calculation for each VAT scheme, fraud header generation
6. **Write integration tests** — submission flow with mocked HMRC MTD API

**FR/NFR References:** FR77, FR89, FR90, FR91, NFR31, NFR32

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR77), §3.1.10 Compliance (FR89-FR91) | VAT return, MTD submission |
| Architecture | §2.25 Reporting Engine | HMRC MTD integration design |
| UX Design Specification | T6 (Wizard) | VAT return wizard |
| API Contracts | §2.18 Reporting | VAT return generation and submission endpoints |
| Data Models | §3 Finance | VAT-related GL accounts and transaction data |
| State Machine Reference | N/A | VAT return submission lifecycle |
| Event Catalog | N/A | vat.return.submitted event |
| Business Rules Compendium | §12 Cross-Cutting | VAT calculation rules, scheme handling |

---

### Story E25.S4: AI-Powered Ad-Hoc Queries

**User Story:** As a business user, I want to ask ad-hoc reporting questions in natural language and receive data-backed tabular or chart answers so that I can get instant insights without building custom reports.

**Acceptance Criteria:**

```gherkin
Scenario: Natural language query returns table
  Given financial data exists
  When I ask "What are our top 10 customers by revenue this year?"
  Then the AI interprets the query and generates a SQL query
  And returns a table showing customer name and total revenue, sorted by revenue descending
  And the query completes within 3 seconds (NFR1)

Scenario: Natural language query returns chart
  Given sales data exists for the past 12 months
  When I ask "Show me monthly sales trend for the last year"
  Then the AI generates a line chart showing monthly sales totals
  And the data is accurate per the GL

Scenario: Query with filters
  Given I ask "What is the average invoice value for customer ABC Ltd in Q1?"
  When the AI processes the query
  Then it applies customer and date filters correctly
  And returns the calculated average

Scenario: Confidence and accuracy
  Given a supported query type (aggregation, comparison, trend, filtered listing)
  When the AI generates the answer
  Then accuracy is >95% for supported patterns (FR79)
  And a confidence indicator is shown
  And the user can view the generated SQL for verification

Scenario: Unsupported query type
  Given I ask a question outside supported patterns
  When the AI processes it
  Then it responds with "I'm not able to answer that type of question yet" with suggestions for supported query types
```

**Key Tasks:**
1. **Implement natural language query endpoint** — `POST /api/v1/reports/ai-query`
   - Send query to AI Gateway for SQL generation
   - Execute generated SQL against read-only replica
   - Format results as table or chart based on query type
2. **Implement query type classification** — aggregation, comparison, trend, filtered listing
   - Return appropriate visualisation (table, bar chart, line chart, pie chart)
3. **Implement safety layer** — prevent destructive SQL; read-only queries only; scope by companyId
4. **Implement confidence scoring** — based on query pattern match and result verification
5. **Build ad-hoc query UI** — chat-like interface or query bar with results panel
   - Toggle between table and chart views
   - Show generated SQL for transparency
6. **Implement query caching** — cache results for identical queries within TTL
7. **Write unit tests** — SQL generation safety, companyId scoping, confidence scoring
8. **Write integration tests** — end-to-end query flow with AI Gateway mock

**FR/NFR References:** FR79, FR4, FR1, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR79), §3.1.1 AI (FR4) | Natural language queries, accuracy requirements |
| Architecture | §2.25 Reporting Engine, §2.7 AI Orchestration | AI query pipeline, SQL generation |
| UX Design Specification | T8 (Report), T4 (Briefing) | Query interface, results display |
| API Contracts | §2.18 Reporting | AI query endpoint |
| Data Models | All modules | All models queryable via AI |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Query safety rules, companyId scoping |

---

### Story E25.S5: Cash Flow Forecasting

**User Story:** As a finance director, I want AI-driven cash flow forecasts for 8-52 week projection periods with scenario analysis so that I can plan for liquidity needs and make informed financial decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Generate expected case forecast
  Given AR aging, AP aging, recurring invoices, and historical payment patterns exist
  When I generate a cash flow forecast for the next 12 weeks
  Then the system projects weekly inflows and outflows
  And shows opening balance, inflows, outflows, and closing balance per week

Scenario: Three scenario analysis
  Given a forecast is generated
  When I view scenario analysis
  Then I see Best Case, Expected, and Worst Case projections
  And each scenario uses different assumptions (e.g., payment timing, collection rates)

Scenario: Forecast includes known commitments
  Given payroll runs GBP 100K/month, rent is GBP 5K/month, and VAT payment of GBP 20K is due
  When these are included in the forecast
  Then they appear as committed outflows on their due dates

Scenario: Forecast warns of cash shortfall
  Given the Expected case shows a negative balance in week 8
  When I view the forecast
  Then the shortfall period is highlighted in red
  And the AI suggests actions (e.g., "Chase overdue AR invoices totalling GBP 15,000")
```

**Key Tasks:**
1. **Implement cash flow forecast engine** — `POST /api/v1/reports/cash-flow-forecast`
   - Gather: AR aging (expected collections), AP aging (expected payments), recurring items, committed costs
   - Apply historical payment patterns for collection timing
   - Generate weekly projections for specified period
2. **Implement scenario modelling** — best (fast collection, delayed payments), expected (average), worst (slow collection, early payments)
3. **Implement known commitments** — payroll, rent, tax payments, loan repayments
4. **Implement AI suggestions** — action recommendations for shortfall periods via AI Gateway
5. **Build forecast dashboard** — T4 (Briefing) with line chart showing 3 scenarios, weekly table
6. **Write unit tests** — projection calculation, scenario parameters, shortfall detection
7. **Write integration tests** — forecast with seeded AR/AP/commitment data

**FR/NFR References:** FR153, FR4, NFR1, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR153) | Cash flow forecasting, scenario analysis |
| Architecture | §2.25 Reporting Engine | Forecast engine design, AI integration |
| UX Design Specification | T4 (Briefing) | Forecast dashboard with charts |
| API Contracts | §2.18 Reporting | Cash flow forecast endpoint |
| Data Models | §5 AR, §7 AP, §3 Finance | Data sources for forecasting |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | N/A |
| Business Rules Compendium | §12 Cross-Cutting | Forecast calculation assumptions |

---

### Story E25.S6: Custom Report Builder

**User Story:** As a power user, I want to build custom reports by selecting entities, fields, filters, groupings, and calculations so that I can create reports specific to my business needs without developer assistance.

**Acceptance Criteria:**

```gherkin
Scenario: Build a custom report
  Given I want a report showing "Invoice amount by customer by month"
  When I select entity "CustomerInvoice", fields "customer.name, invoiceDate, totalAmount"
  And add grouping by "customer.name" and "month(invoiceDate)"
  And add aggregation "SUM(totalAmount)"
  Then the report is generated with the specified structure

Scenario: Save report definition
  Given I built a custom report
  When I save it with name "Monthly Revenue by Customer"
  Then the report definition is saved and appears in my saved reports

Scenario: Schedule report
  Given a saved custom report exists
  When I schedule it to run weekly on Monday and email to finance@company.com
  Then the report runs automatically on schedule and is emailed as PDF

Scenario: Share report with team
  Given a saved custom report exists
  When I share it with the "Finance" role
  Then users with Finance access can view and run the report
```

**Key Tasks:**
1. **Design report definition schema** — entity, fields, joins, filters, groupings, aggregations, sort order
2. **Implement report builder endpoint** — `POST /api/v1/reports/custom/run`
   - Translate definition to SQL query; execute; return results
3. **Implement report definition CRUD** — save, update, delete, list saved reports
4. **Implement report scheduling** — BullMQ scheduled jobs for automatic execution and email delivery
5. **Build report builder UI** — drag-and-drop field selector, filter builder, preview pane
6. **Implement report sharing** — role-based access to saved report definitions
7. **Write unit tests** — definition-to-SQL translation, filter logic
8. **Write integration tests** — build-save-run-schedule cycle

**FR/NFR References:** FR79, FR78, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR79, FR78) | Custom reporting, export capabilities |
| Architecture | §2.25 Reporting Engine | Custom report builder design |
| UX Design Specification | T8 (Report) | Report builder interface |
| API Contracts | §2.18 Reporting | Custom report endpoints |
| Data Models | All modules | All models available for custom reports |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | Report generation events |
| Business Rules Compendium | §12 Cross-Cutting | Report security, companyId scoping |

---

### Story E25.S7: Fraud Detection Reports

**User Story:** As a finance administrator, I want fraud detection reports showing duplicate payment attempts, suspicious transactions, and anomaly patterns so that I can identify and investigate potential financial fraud.

**Acceptance Criteria:**

```gherkin
Scenario: Duplicate payment detection
  Given two supplier invoices have the same supplier, amount, and similar reference
  When the duplicate detection report runs
  Then the potential duplicates are flagged with match details (FR155)

Scenario: Suspicious transaction alerting
  Given a transaction matches configurable rules (unusual amount, new supplier large payment)
  When the fraud risk analysis runs
  Then the transaction is flagged with the triggered rule and risk score (FR156)

Scenario: Fraud risk summary report
  Given flagged transactions exist
  When I view the fraud risk summary
  Then I see: duplicate payment attempts, suspicious transactions, anomaly patterns
  And each item has investigation status (Open, Investigating, Cleared, Confirmed) (FR157)

Scenario: Configurable fraud rules
  Given I am an ADMIN
  When I configure a fraud rule "Flag payments over GBP 10,000 to suppliers created in last 30 days"
  Then the rule is active and flags matching transactions
```

**Key Tasks:**
1. **Implement duplicate payment detection** — match supplier + amount + reference + date proximity
2. **Implement configurable fraud rules engine** — rule definition with conditions and thresholds
3. **Implement anomaly detection** — statistical analysis for out-of-pattern transactions
4. **Build fraud risk dashboard** — T4 (Briefing) with risk summary, flagged items, investigation tracking
5. **Build rule configuration UI** — T7 (Settings) for ADMIN users
6. **Write unit tests** — duplicate matching, rule evaluation, anomaly scoring
7. **Write integration tests** — fraud detection pipeline with test transactions

**FR/NFR References:** FR155, FR156, FR157, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.10 Compliance (FR155, FR156, FR157) | Fraud detection rules, duplicate payments |
| Architecture | §2.25 Reporting Engine | Fraud detection engine design |
| UX Design Specification | T4 (Briefing), T7 (Settings) | Fraud dashboard, rule configuration |
| API Contracts | §2.18 Reporting | Fraud detection and rule endpoints |
| Data Models | §7 AP, §3 Finance | Transaction data for fraud analysis |
| State Machine Reference | N/A | Investigation status lifecycle |
| Event Catalog | N/A | fraud.alert.created event |
| Business Rules Compendium | §12 Cross-Cutting | BR-SYS-013 (duplicate detection), BR-SYS-014 (fraud rules) |

---

### Story E25.S8: Mobile Adaptation — Reporting

**User Story:** As a mobile user, I want to view key financial dashboards and saved reports on my phone so that I can monitor business performance on the go.

**Acceptance Criteria:**

```gherkin
Scenario: View financial dashboard on mobile
  Given financial reports are available
  When I open the reporting section on mobile
  Then I see KPI cards (revenue, profit, cash balance, AR/AP totals)
  And can tap to see trend charts

Scenario: View saved report on mobile
  Given a saved report "Monthly Revenue by Customer" exists
  When I open it on mobile
  Then the report renders in a mobile-friendly format (scrollable table or chart)

Scenario: Push notification for scheduled reports
  Given a scheduled report completed
  When I receive the notification
  Then I can view the report summary or download the PDF

Scenario: Cash flow forecast on mobile
  Given a cash flow forecast exists
  When I view it on mobile
  Then I see a simplified chart with the expected case
  And shortfall warnings are highlighted
```

**Key Tasks:**
1. **Create mobile financial dashboard** — KPI cards with sparkline charts
2. **Create mobile report viewer** — adaptive rendering for tables and charts
3. **Implement push notifications** — for scheduled report completion
4. **Create mobile forecast viewer** — simplified chart view
5. **Write unit tests** — mobile data transformations
6. **Write integration tests** — mobile report access

**FR/NFR References:** FR74, FR75, FR78, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.9 Reporting (FR74, FR75, FR78) | Reports applicable to mobile |
| Architecture | §2.25 Reporting Engine | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.18 Reporting | Same endpoints for mobile |
| Data Models | All modules | Same data sources |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | Push notification triggers |
| Business Rules Compendium | §12 Cross-Cutting | Same rules |

---

---

# Phase 2+: Expansion Modules

> Phase 2 epics extend the platform with warehouse management, point of sale, projects, contracts, service orders, intercompany transactions, and advanced communications. Each epic follows the same 8-Document Rule. Stories are slightly condensed compared to Tier 3 MVP epics but retain full traceability.

---

## Epic E26a: Warehouse Management System (WMS)

> **Advanced warehouse management with bin-level tracking, pick lists, goods receipt positioning, internal transfers, cycle counting, and packing/dispatch operations.**

**Architecture:** §2.27 Warehouse Management
**Models:** 9 models — `WarehousePosition`, `PickList`, `PickListLine`, `ReceivingOrder`, `InternalTransferOrder`, `CycleCount`, `CycleCountLine`, `PackingOrder`, `ShipmentTracking`
**State Machines:** SM:PickList, SM:InternalTransferOrder, SM:CycleCount
**Events:** `picklist.generated`, `picklist.completed`, `goods.received`, `transfer.completed`, `cyclecount.completed`, `dispatch.shipped`
**API:** §2.23 — ~17 endpoints under `/warehouse/*`
**Business Rules:** BR-WMS-001 to BR-WMS-012
**FRs:** FR135–FR140

**Dependencies:** E15 (Inventory), E16 (Sales Orders for pick list generation), E18 (Purchase Orders for goods receipt)

---

### Story E26a.S1: Warehouse Position Management

**User Story:** As a warehouse manager, I want to define warehouse positions and bin locations with capacity and zone classification so that stock can be tracked at bin level.

**Acceptance Criteria:**

```gherkin
Scenario: Create warehouse position
  Given I am a warehouse MANAGER
  When I create a position "A-01-03" (Aisle A, Rack 01, Shelf 03) in zone "Picking"
  Then a WarehousePosition record is created with zone, type, and capacity fields

Scenario: Position hierarchy
  Given positions are structured as Zone → Aisle → Rack → Shelf → Bin
  When I view the warehouse layout
  Then positions display in a hierarchical tree view

Scenario: Capacity tracking
  Given position "A-01-03" has max capacity of 100 units
  And currently holds 85 units
  When I attempt to receive 20 more units
  Then the system warns about capacity overflow
```

**Key Tasks:**
1. **Create WarehousePosition model** — companyId, code, name, warehouseId, zone, aisle, rack, shelf, bin, type, maxCapacity, currentOccupancy
2. **Implement position CRUD endpoints** — with hierarchy navigation
3. **Build position management UI** — T1 list with tree view, capacity indicators
4. **Write tests** — hierarchy queries, capacity validation

**FR/NFR References:** FR135, FR49, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR135) | Position and bin location management |
| Architecture | §2.27 Warehouse Management | WarehousePosition model |
| UX Design Specification | T1 (Entity List) | Position list with tree view |
| API Contracts | §2.23 Warehouse | Position CRUD endpoints |
| Data Models | §17 Warehouse | WarehousePosition schema |
| State Machine Reference | §14 Warehouse | N/A for positions |
| Event Catalog | §13 Warehouse | position.created event |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-001 to BR-WMS-003 (position rules) |

---

### Story E26a.S2: Pick List Generation & Processing

**User Story:** As a warehouse picker, I want pick lists generated from sales orders with optimised pick routes so that I can efficiently pick items for shipment.

**Acceptance Criteria:**

```gherkin
Scenario: Generate pick list from sales order
  Given a confirmed sales order has 5 line items with stock available
  When I generate a pick list
  Then a PickList record is created with PickListLines for each item
  And each line shows the source position and quantity to pick

Scenario: Complete picking
  Given a pick list is assigned to me
  When I pick all items and confirm quantities
  Then the pick list status changes to COMPLETED
  And stock is decremented from the source positions
```

**Key Tasks:**
1. **Create PickList model** — companyId, salesOrderId, status, assignedToId, generatedAt, completedAt
   - PickListLine: pickListId, itemId, sourcePositionId, requestedQty, pickedQty
2. **Implement pick list generation** — allocate stock from positions using FIFO/FEFO strategy
3. **Implement pick completion** — validate quantities, update stock levels
4. **Build pick list UI** — mobile-optimised list with scan-to-confirm
5. **Write tests** — allocation strategy, completion validation

**FR/NFR References:** FR136, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR136) | Pick list generation and management |
| Architecture | §2.27 Warehouse Management | PickList model, allocation strategy |
| UX Design Specification | T1 (Entity List) | Pick list interface |
| API Contracts | §2.23 Warehouse | Pick list endpoints |
| Data Models | §17 Warehouse | PickList, PickListLine schemas |
| State Machine Reference | §14 Warehouse | SM:PickList — GENERATED → ASSIGNED → IN_PROGRESS → COMPLETED |
| Event Catalog | §13 Warehouse | picklist.generated, picklist.completed events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-004 to BR-WMS-006 (pick rules) |

---

### Story E26a.S3: Goods Receipt & Internal Transfers

**User Story:** As a warehouse worker, I want to receive goods into specific warehouse positions and create internal transfer orders to move stock between positions so that inventory location tracking is accurate.

**Acceptance Criteria:**

```gherkin
Scenario: Receive goods into position
  Given a purchase order delivery arrives
  When I receive items and assign them to position "B-02-01"
  Then stock is incremented at the specified position (FR137)
  And a goods receipt record is created with position reference

Scenario: Create internal transfer
  Given item "Widget A" has 50 units at position "A-01-03"
  When I create a transfer order to move 20 units to "C-03-02"
  Then an InternalTransferOrder is created with status PENDING
  And on completion, stock moves between positions (FR138)
```

**Key Tasks:**
1. **Implement goods receipt with positioning** — assign received items to warehouse positions
2. **Create InternalTransferOrder model** — from/to positions, item, quantity, status
3. **Implement transfer completion** — validate stock at source, move to destination
4. **Build receipt and transfer UIs** — forms with position selection, barcode scanning
5. **Write tests** — stock movement accuracy, position validation

**FR/NFR References:** FR137, FR138, FR43, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR137, FR138) | Goods receipt positioning, internal transfers |
| Architecture | §2.27 Warehouse Management | Receipt and transfer models |
| UX Design Specification | T2 (Record Detail) | Receipt and transfer forms |
| API Contracts | §2.23 Warehouse | Receipt and transfer endpoints |
| Data Models | §17 Warehouse | ReceivingOrder, InternalTransferOrder |
| State Machine Reference | §14 Warehouse | SM:InternalTransferOrder lifecycle |
| Event Catalog | §13 Warehouse | goods.received, transfer.completed events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-007 to BR-WMS-009 |

---

### Story E26a.S4: Cycle Counting & Packing/Dispatch

**User Story:** As a warehouse manager, I want to perform cycle counts by position with variance reporting and manage packing/dispatch operations with shipment tracking so that inventory accuracy and order fulfilment are maintained.

**Acceptance Criteria:**

```gherkin
Scenario: Cycle count by position
  Given positions in Zone "Picking" are selected for counting
  When I record actual quantities per position
  Then variances between system and actual counts are calculated (FR139)
  And adjustments are posted with audit trail

Scenario: Packing and dispatch
  Given a pick list is completed
  When I pack items and record carrier/tracking details
  Then a PackingOrder is created with shipment tracking number (FR140)
  And the sales order status is updated to SHIPPED
```

**Key Tasks:**
1. **Create CycleCount model** — positions, expected vs actual quantities, variance, adjustment posting
2. **Create PackingOrder model** — pick list reference, carrier, tracking number, dispatch date
3. **Implement cycle count workflow** — count, variance, adjustment, GL posting
4. **Implement packing/dispatch** — pack, assign carrier, track shipment
5. **Build cycle count and dispatch UIs**
6. **Write tests** — variance calculation, adjustment posting

**FR/NFR References:** FR139, FR140, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR139, FR140) | Cycle counting, packing, dispatch |
| Architecture | §2.27 Warehouse Management | CycleCount, PackingOrder models |
| UX Design Specification | T6 (Wizard) | Cycle count wizard, dispatch workflow |
| API Contracts | §2.23 Warehouse | Cycle count and dispatch endpoints |
| Data Models | §17 Warehouse | CycleCount, PackingOrder schemas |
| State Machine Reference | §14 Warehouse | SM:CycleCount lifecycle |
| Event Catalog | §13 Warehouse | cyclecount.completed, dispatch.shipped events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-010 to BR-WMS-012 |

---

### Story E26a.S5: Mobile Adaptation — Warehouse

**User Story:** As a warehouse worker, I want to perform all warehouse operations (pick, receive, count, pack) from a mobile device with barcode scanning so that I can work efficiently on the warehouse floor.

**Acceptance Criteria:**

```gherkin
Scenario: Mobile picking with barcode scan
  Given I have a pick list assigned on mobile
  When I scan item barcodes and position barcodes
  Then picked quantities are confirmed and stock updated in real-time

Scenario: Mobile goods receipt
  Given a delivery arrives
  When I scan items and assign to positions on mobile
  Then receipt is recorded with position-level accuracy

Scenario: Mobile cycle counting
  Given a count list is assigned to me
  When I scan positions and enter counts on mobile
  Then variances are calculated and displayed immediately
```

**Key Tasks:**
1. **Create mobile picking interface** — scan-to-pick workflow
2. **Create mobile receipt interface** — scan and assign positions
3. **Create mobile counting interface** — position scan and count entry
4. **Implement offline capability** — queue operations for sync
5. **Write tests** — mobile workflow validation

**FR/NFR References:** FR136, FR137, FR139, FR154, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR136-FR140, FR154) | Warehouse operations, barcode scanning |
| Architecture | §2.27 Warehouse Management | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile warehouse patterns |
| API Contracts | §2.23 Warehouse | Same endpoints for mobile |
| Data Models | §17 Warehouse | Same models |
| State Machine Reference | §14 Warehouse | Same state machines |
| Event Catalog | §13 Warehouse | Same events |
| Business Rules Compendium | §13 Additional (BR-WMS) | Same rules |

---

## Epic E26b: Point of Sale (POS)

> **POS terminal operations with session management, product lookup, multi-payment processing, receipt generation, offline mode, and cash drawer management.**

**Architecture:** §2.24 POS
**Models:** 14 models
**State Machines:** SM:PosSession, SM:PosTransaction, SM:CashDrawer
**Business Rules:** POS-001 to POS-020
**FRs:** FR116–FR122
**API:** §2.20 — ~29 endpoints under `/pos/*`

**Dependencies:** E15 (Inventory), E17 (AR for customer invoicing), E14 (Finance/GL)

---

### Story E26b.S1: POS Session Management

**User Story:** As a cashier, I want to open and close POS sessions with cash float entry and Z-report generation so that cash handling is tracked and reconciled daily.

**Acceptance Criteria:**

```gherkin
Scenario: Open POS session
  Given I am a POS operator
  When I open a session with cash float of GBP 100
  Then a PosSession is created with status OPEN and opening float recorded

Scenario: Close session with Z-report
  Given a session has processed 50 transactions
  When I close the session with cash counted as GBP 850
  Then a Z-report is generated showing total sales by payment method
  And cash variance (expected vs counted) is calculated (FR116)
```

**Key Tasks:**
1. **Create POS session models** — PosSession, PosTransaction, PosTransactionLine, PosPayment, CashDrawerOperation
2. **Implement session open/close endpoints** — float entry, Z-report generation, variance calculation
3. **Build POS session UI** — dedicated POS terminal interface
4. **Write tests** — session lifecycle, Z-report calculation, variance

**FR/NFR References:** FR116, FR122, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR116, FR122) | Session management, Z-reports, cash reconciliation |
| Architecture | §2.24 POS | POS session models and workflow |
| UX Design Specification | Custom POS layout | POS terminal interface |
| API Contracts | §2.20 POS | Session management endpoints |
| Data Models | §14 POS | PosSession, CashDrawerOperation schemas |
| State Machine Reference | §11 POS | SM:PosSession — OPEN → CLOSED |
| Event Catalog | §10 POS | pos.session.opened, pos.session.closed events |
| Business Rules Compendium | §9 POS | POS-001 to POS-005 (session rules) |

---

### Story E26b.S2: Product Lookup & Transaction Processing

**User Story:** As a cashier, I want to look up products by name, code, or barcode and process transactions with line items, discounts, and VAT so that sales are recorded accurately.

**Acceptance Criteria:**

```gherkin
Scenario: Look up product by barcode scan
  Given I scan barcode "5012345678901"
  When the lookup completes
  Then the item name, price, and available stock are displayed (FR117)

Scenario: Process a sale transaction
  Given I add 3 items to the transaction
  When I total the sale
  Then the transaction shows line items, subtotal, VAT, and grand total
  And POS-specific pricing rules and discounts are applied (FR120)
```

**Key Tasks:**
1. **Implement product lookup** — by name search, item code, barcode scan
2. **Implement transaction processing** — add/remove lines, apply discounts, calculate VAT
3. **Implement POS pricing rules** — POS-specific promotions and discounts
4. **Build POS product lookup and transaction UI**
5. **Write tests** — lookup, pricing, VAT calculation

**FR/NFR References:** FR117, FR120, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR117, FR120) | Product lookup, pricing rules |
| Architecture | §2.24 POS | Transaction processing, pricing engine |
| UX Design Specification | Custom POS layout | Product lookup and transaction UI |
| API Contracts | §2.20 POS | Product lookup, transaction endpoints |
| Data Models | §14 POS | PosTransaction, PosTransactionLine schemas |
| State Machine Reference | §11 POS | SM:PosTransaction lifecycle |
| Event Catalog | §10 POS | pos.transaction.completed event |
| Business Rules Compendium | §9 POS | POS-006 to POS-012 (transaction rules) |

---

### Story E26b.S3: Multi-Payment & Receipts

**User Story:** As a cashier, I want to process multiple payment methods per transaction and print or email receipts so that customers can pay flexibly and receive proof of purchase.

**Acceptance Criteria:**

```gherkin
Scenario: Split payment (cash + card)
  Given a transaction total is GBP 50
  When the customer pays GBP 20 cash and GBP 30 card
  Then both payment records are created and the transaction is completed (FR118)

Scenario: Print receipt
  Given a transaction is completed
  When I print the receipt
  Then a formatted receipt is generated with items, payments, and VAT breakdown (FR119)

Scenario: Email receipt
  Given the customer provides their email
  When I send an email receipt
  Then the receipt PDF is emailed to the customer
```

**Key Tasks:**
1. **Implement multi-payment processing** — cash, card, voucher, split payments
2. **Implement receipt generation** — print and email with full transaction details
3. **Build payment UI** — payment method selector, amount entry, change calculation
4. **Write tests** — split payment scenarios, receipt formatting

**FR/NFR References:** FR118, FR119, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR118, FR119) | Multi-payment, receipts |
| Architecture | §2.24 POS | Payment processing, receipt generation |
| UX Design Specification | Custom POS layout | Payment and receipt UI |
| API Contracts | §2.20 POS | Payment and receipt endpoints |
| Data Models | §14 POS | PosPayment schema |
| State Machine Reference | §11 POS | Transaction completion with payment |
| Event Catalog | §10 POS | pos.payment.processed event |
| Business Rules Compendium | §9 POS | POS-013 to POS-016 (payment rules) |

---

### Story E26b.S4: Offline Mode & Sync

**User Story:** As a POS operator, I want the terminal to continue operating when the network is down and automatically sync transactions when connectivity restores so that sales are never lost.

**Acceptance Criteria:**

```gherkin
Scenario: Process sale offline
  Given the network connection is lost
  When I process a cash sale
  Then the transaction is stored locally on the device (FR121)

Scenario: Automatic sync on reconnection
  Given 10 offline transactions are queued
  When the network connection restores
  Then all transactions are synced to the server automatically
  And inventory levels and GL are updated
```

**Key Tasks:**
1. **Implement offline transaction storage** — IndexedDB/SQLite local storage
2. **Implement sync engine** — queue-based sync with conflict resolution
3. **Implement connectivity detection** — auto-switch between online/offline modes
4. **Write tests** — offline processing, sync ordering, conflict resolution

**FR/NFR References:** FR121, NFR21, NFR22

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR121) | Offline mode and sync |
| Architecture | §2.24 POS | Offline architecture, sync engine |
| UX Design Specification | Custom POS layout | Offline indicator |
| API Contracts | §2.20 POS | Sync endpoints |
| Data Models | §14 POS | Local storage schema |
| State Machine Reference | §11 POS | Offline transaction lifecycle |
| Event Catalog | §10 POS | pos.sync.completed event |
| Business Rules Compendium | §9 POS | POS-017 to POS-018 (offline rules) |

---

### Story E26b.S5: Cash Drawer & Till Reconciliation

**User Story:** As a supervisor, I want to manage cash drawer operations with till reconciliation and variance reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Till reconciliation
  Given a POS session is being closed
  When the cashier counts denominations
  Then the expected vs actual cash is calculated
  And variance is recorded and reported (FR122)
```

**Key Tasks:**
1. **Implement cash drawer operations** — open/close, denomination counting
2. **Implement till reconciliation** — expected vs actual, variance calculation
3. **Build reconciliation UI**
4. **Write tests** — denomination counting, variance calculation

**FR/NFR References:** FR122, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR122) | Cash drawer, till reconciliation |
| Architecture | §2.24 POS | Cash management models |
| UX Design Specification | Custom POS layout | Reconciliation interface |
| API Contracts | §2.20 POS | Cash drawer endpoints |
| Data Models | §14 POS | CashDrawerOperation schema |
| State Machine Reference | §11 POS | SM:CashDrawer lifecycle |
| Event Catalog | §10 POS | pos.drawer events |
| Business Rules Compendium | §9 POS | POS-019 to POS-020 (cash rules) |

---

### Story E26b.S6: POS GL Integration & Reporting

**User Story:** As a finance user, I want POS transactions to post to the GL and I want daily POS reports so that retail operations are reflected in financial statements.

**Key Tasks:**
1. Implement POS-to-GL posting (sales revenue, VAT, payment method accounts)
2. Implement daily POS summary report
3. Write tests

**FR/NFR References:** FR116, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS | GL integration |
| Architecture | §2.24 POS | GL posting design |
| UX Design Specification | T8 (Report) | POS reports |
| API Contracts | §2.20 POS | Reporting endpoints |
| Data Models | §14 POS, §3 Finance | POS-to-GL mapping |
| State Machine Reference | §11 POS | Post-completion GL posting |
| Event Catalog | §10 POS | pos.gl.posted event |
| Business Rules Compendium | §9 POS | GL posting rules |

---

### Story E26b.S7: Mobile Adaptation — POS

**User Story:** As a POS operator, I want a tablet-optimised POS interface with barcode scanning for use on mobile devices.

**Key Tasks:**
1. Create tablet-optimised POS layout (Expo)
2. Implement barcode scanning via camera
3. Implement offline mode on mobile
4. Write tests

**FR/NFR References:** FR117, FR121, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS | Mobile POS |
| Architecture | §2.24 POS | Mobile POS design |
| UX Design Specification | Mobile strategy section | Tablet POS patterns |
| API Contracts | §2.20 POS | Same endpoints |
| Data Models | §14 POS | Same models |
| State Machine Reference | §11 POS | Same state machines |
| Event Catalog | §10 POS | Same events |
| Business Rules Compendium | §9 POS | Same rules |

---

## Epic E26c: Projects & Job Costing

> **Project management with budgets, phases, milestones, time entries, expenses, billing rate resolution, and WIP/revenue recognition.**

**Architecture:** §2.25 Projects
**Models:** 11 models — `Project`, `ProjectPhase`, `ProjectMilestone`, `TimeEntry`, `ProjectExpense`, `BillingRate`, `ProjectBudget`, `ProjectBudgetLine`, `ProjectCostEntry`, `WipCalculation`, `ProjectInvoice`
**State Machines:** SM:Project, SM:TimeEntry, SM:ProjectExpense
**Business Rules:** PRJ/TS/EXP/INV rules
**FRs:** FR123–FR129
**API:** §2.21 — ~23 endpoints under `/projects/*`

**Dependencies:** E14 (Finance/GL), E23 (HR for employees/billing rates)

---

### Story E26c.S1: Project Setup & Budgeting

**User Story:** As a project manager, I want to create projects with budgets, phases, and milestones so that I can plan and track project costs and timelines.

**Acceptance Criteria:**

```gherkin
Scenario: Create project with budget
  Given I am a MANAGER or higher
  When I create a project with name, customer, budget, phases, and milestones
  Then a Project record is created with budget lines per cost category (FR123)

Scenario: Phase and milestone tracking
  Given a project has 3 phases with milestones
  When I update milestone status to COMPLETED
  Then progress percentage is recalculated
```

**Key Tasks:**
1. Create Project, ProjectPhase, ProjectMilestone, ProjectBudget, ProjectBudgetLine models
2. Implement project CRUD with budget management
3. Build project detail UI — T2 with Gantt/timeline view
4. Write tests

**FR/NFR References:** FR123, FR126, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR123, FR126) | Project setup, budgets, milestones |
| Architecture | §2.25 Projects | Project models, budget design |
| UX Design Specification | T2 (Record Detail) | Project detail with timeline |
| API Contracts | §2.21 Projects | Project CRUD endpoints |
| Data Models | §15 Projects | Project, Budget schemas |
| State Machine Reference | §12 Projects | SM:Project lifecycle |
| Event Catalog | §11 Projects | project.created event |
| Business Rules Compendium | §10 Projects | PRJ budget rules |

---

### Story E26c.S2: Time Entries & Expense Tracking

**User Story:** As a team member, I want to record time entries and expenses against projects so that labour and costs are tracked for billing and reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Record time entry
  Given I am assigned to project "Website Redesign"
  When I log 4 hours of billable time with description
  Then a TimeEntry record is created linked to the project and phase (FR124)

Scenario: Submit expense with receipt
  Given I incurred a GBP 50 travel expense for a project
  When I submit the expense with receipt attachment
  Then a ProjectExpense record is created pending approval (FR125)
```

**Key Tasks:**
1. Create TimeEntry and ProjectExpense models
2. Implement time and expense CRUD with approval workflows
3. Build timesheet and expense UIs
4. Write tests

**FR/NFR References:** FR124, FR125, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR124, FR125) | Time entries, expenses, approval |
| Architecture | §2.25 Projects | TimeEntry, ProjectExpense models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Timesheet, expense form |
| API Contracts | §2.21 Projects | Time and expense endpoints |
| Data Models | §15 Projects | TimeEntry, ProjectExpense schemas |
| State Machine Reference | §12 Projects | SM:TimeEntry, SM:ProjectExpense lifecycles |
| Event Catalog | §11 Projects | time.entered, expense.submitted events |
| Business Rules Compendium | §10 Projects | TS/EXP rules |

---

### Story E26c.S3: Billing Rate Resolution & Project Invoicing

**User Story:** As a finance user, I want billing rates resolved using a priority hierarchy (project > customer > employee > default) and the ability to generate project invoices.

**Acceptance Criteria:**

```gherkin
Scenario: Billing rate resolution
  Given employee "Jane" has project rate GBP 150/hr and default rate GBP 100/hr
  When billing for project "Website Redesign"
  Then the project rate GBP 150/hr is used (FR127)

Scenario: Generate project invoice
  Given unbilled time and expenses exist
  When I generate an invoice for the project
  Then a draft invoice is created with time and expense line items
```

**Key Tasks:**
1. Create BillingRate model with priority hierarchy
2. Implement rate resolution service
3. Implement project invoicing — generate draft invoices from unbilled entries
4. Write tests

**FR/NFR References:** FR127, FR128, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR127, FR128) | Billing rate hierarchy, job cost posting |
| Architecture | §2.25 Projects | BillingRate model, invoicing design |
| UX Design Specification | T3 (Header+Lines) | Project invoice layout |
| API Contracts | §2.21 Projects | Billing rate and invoicing endpoints |
| Data Models | §15 Projects | BillingRate, ProjectInvoice schemas |
| State Machine Reference | §12 Projects | Invoice generation workflow |
| Event Catalog | §11 Projects | project.invoice.generated event |
| Business Rules Compendium | §10 Projects | INV billing rules |

---

### Story E26c.S4: WIP & Revenue Recognition

**User Story:** As a finance user, I want WIP calculations and revenue recognition for long-running projects so that revenue is correctly matched to the period in which work is performed.

**Acceptance Criteria:**

```gherkin
Scenario: Calculate WIP value
  Given project costs of GBP 50,000 and billed amount of GBP 30,000
  When WIP is calculated
  Then WIP value is GBP 20,000 (costs incurred less billed) (FR129)
```

**Key Tasks:**
1. Implement WIP calculation service — percentage of completion method
2. Implement revenue recognition posting
3. Build WIP report
4. Write tests

**FR/NFR References:** FR129, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR129) | WIP, revenue recognition |
| Architecture | §2.25 Projects | WIP calculation, revenue recognition |
| UX Design Specification | T8 (Report) | WIP report |
| API Contracts | §2.21 Projects | WIP and recognition endpoints |
| Data Models | §15 Projects | WipCalculation schema |
| State Machine Reference | §12 Projects | N/A |
| Event Catalog | §11 Projects | wip.calculated event |
| Business Rules Compendium | §10 Projects | PRJ WIP rules |

---

### Story E26c.S5: Budget vs Actual Reports

**User Story:** As a project manager, I want budget vs actual reports with variance analysis by phase and cost category.

**Key Tasks:**
1. Implement budget vs actual comparison endpoint
2. Build report with phase-level and category-level breakdown
3. Write tests

**FR/NFR References:** FR126, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR126) | Budget vs actual |
| Architecture | §2.25 Projects | Report design |
| UX Design Specification | T8 (Report) | Budget report layout |
| API Contracts | §2.21 Projects | Report endpoints |
| Data Models | §15 Projects | Budget and cost models |
| State Machine Reference | §12 Projects | N/A |
| Event Catalog | §11 Projects | N/A |
| Business Rules Compendium | §10 Projects | Budget rules |

---

### Story E26c.S6: Mobile Adaptation — Projects

**User Story:** As a mobile user, I want to log time entries and submit expenses from my phone.

**Key Tasks:**
1. Create mobile timesheet entry form
2. Create mobile expense submission with camera for receipts
3. Write tests

**FR/NFR References:** FR124, FR125, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects | Time and expense on mobile |
| Architecture | §2.25 Projects | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.21 Projects | Same endpoints |
| Data Models | §15 Projects | Same models |
| State Machine Reference | §12 Projects | Same state machines |
| Event Catalog | §11 Projects | Same events |
| Business Rules Compendium | §10 Projects | Same rules |

---

## Epic E26d: Contracts (Rental, Lease, Service)

> **Contract management for rental, lease, and service agreements with recurring invoice generation, renewal/termination workflows, and loan repayment schedules.**

**Architecture:** §2.26 Contracts
**Models:** 13 models
**State Machines:** SM:Contract, SM:ContractRenewal, SM:LoanAgreement
**Business Rules:** BR-CON-001 to BR-CON-022
**FRs:** FR130–FR134
**API:** §2.22 — ~25 endpoints under `/contracts/*`

---

### Story E26d.S1: Contract Lifecycle Management

**User Story:** As a contracts administrator, I want to create and manage contracts with terms, conditions, and lifecycle workflows (draft, active, renewal, termination) so that agreements are tracked through their full duration.

**Acceptance Criteria:**

```gherkin
Scenario: Create a rental contract
  Given a customer wants a 12-month equipment rental
  When I create a contract with start date, end date, terms, and billing schedule
  Then a Contract record is created with status DRAFT (FR130)

Scenario: Activate contract
  Given a contract is approved
  When I activate it
  Then the status changes to ACTIVE and billing schedule becomes effective

Scenario: Contract renewal workflow
  Given a contract is 30 days from expiry
  When the renewal notification triggers
  Then the contract manager is notified to initiate renewal (FR132)
```

**Key Tasks:**
1. Create Contract, ContractLine, ContractTerm, BillingSchedule models
2. Implement contract lifecycle endpoints
3. Build contract detail UI — T2 with timeline
4. Write tests

**FR/NFR References:** FR130, FR132, FR134, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR130, FR132, FR134) | Contract lifecycle, renewal, pricing |
| Architecture | §2.26 Contracts | Contract models, lifecycle |
| UX Design Specification | T2 (Record Detail) | Contract detail layout |
| API Contracts | §2.22 Contracts | Contract CRUD endpoints |
| Data Models | §16 Contracts | Contract schemas |
| State Machine Reference | §13 Contracts | SM:Contract — DRAFT → ACTIVE → RENEWED / TERMINATED |
| Event Catalog | §12 Contracts | contract.activated, contract.expiring events |
| Business Rules Compendium | §11 Contracts | BR-CON-001 to BR-CON-010 |

---

### Story E26d.S2: Recurring Invoice Generation

**User Story:** As a billing administrator, I want the system to automatically generate recurring invoices from active contracts based on billing schedules.

**Acceptance Criteria:**

```gherkin
Scenario: Generate monthly recurring invoice
  Given a contract has monthly billing of GBP 500
  When the billing run executes for March 2026
  Then a draft invoice for GBP 500 is created linked to the contract (FR131)
```

**Key Tasks:**
1. Implement billing schedule engine — generate invoices per schedule
2. Implement billing run job (BullMQ)
3. Write tests

**FR/NFR References:** FR131, NFR5

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR131) | Recurring invoice generation |
| Architecture | §2.26 Contracts | Billing engine design |
| UX Design Specification | T6 (Wizard) | Billing run wizard |
| API Contracts | §2.22 Contracts | Billing run endpoints |
| Data Models | §16 Contracts | BillingSchedule, invoice link |
| State Machine Reference | §13 Contracts | Billing as side effect of active contracts |
| Event Catalog | §12 Contracts | contract.invoice.generated event |
| Business Rules Compendium | §11 Contracts | BR-CON-011 to BR-CON-015 (billing rules) |

---

### Story E26d.S3: Loan Agreements & Repayment Schedules

**User Story:** As a finance user, I want to manage loan agreements with repayment schedule calculations supporting annuity, linear, and bullet methods.

**Acceptance Criteria:**

```gherkin
Scenario: Create loan with annuity repayment
  Given a loan of GBP 100,000 at 5% for 5 years
  When I create the loan agreement
  Then the system calculates the annuity repayment schedule with monthly amounts (FR133)
```

**Key Tasks:**
1. Create LoanAgreement and RepaymentSchedule models
2. Implement repayment calculation — annuity, linear, bullet methods
3. Build loan management UI
4. Write tests

**FR/NFR References:** FR133, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR133) | Loan agreements, repayment methods |
| Architecture | §2.26 Contracts | Loan calculation engine |
| UX Design Specification | T2 (Record Detail) | Loan detail with schedule |
| API Contracts | §2.22 Contracts | Loan management endpoints |
| Data Models | §16 Contracts | LoanAgreement, RepaymentSchedule |
| State Machine Reference | §13 Contracts | SM:LoanAgreement lifecycle |
| Event Catalog | §12 Contracts | loan.repayment.due event |
| Business Rules Compendium | §11 Contracts | BR-CON-016 to BR-CON-022 (loan rules) |

---

### Story E26d.S4: Mobile Adaptation — Contracts

**User Story:** As a mobile user, I want to view my contracts, their status, and upcoming renewals from my phone.

**Key Tasks:**
1. Create mobile contract list and detail views
2. Implement renewal notification push
3. Write tests

**FR/NFR References:** FR130, FR132, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts | Mobile contract access |
| Architecture | §2.26 Contracts | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.22 Contracts | Same endpoints |
| Data Models | §16 Contracts | Same models |
| State Machine Reference | §13 Contracts | Same state machines |
| Event Catalog | §12 Contracts | Push notification triggers |
| Business Rules Compendium | §11 Contracts | Same rules |

---

## Epic E26e: Service Orders

> **Service order management for field service with technician assignment, scheduling, service item tracking, and invoice generation from completed service work.**

**Architecture:** §2.30 Service Orders
**Models:** 11 models
**State Machines:** SM:ServiceOrder, SM:ServiceVisit, SM:ServiceItem
**Business Rules:** BR-SVO/BR-TK rules
**FRs:** FR149–FR152
**API:** §2.26 — ~21 endpoints under `/service/*`

---

### Story E26e.S1: Service Order Management

**User Story:** As a service coordinator, I want to create and manage service orders with assignment to service personnel and status tracking.

**Acceptance Criteria:**

```gherkin
Scenario: Create service order
  Given a customer reports equipment issue
  When I create a service order with description, priority, and assigned technician
  Then a ServiceOrder record is created with status OPEN (FR149)

Scenario: Complete service order
  Given a technician has completed the work
  When I mark the service order as completed with work details
  Then the status changes to COMPLETED with completion notes
```

**Key Tasks:**
1. Create ServiceOrder, ServiceOrderLine, ServiceAssignment models
2. Implement service order CRUD with assignment
3. Build service order UI — T1 list, T2 detail
4. Write tests

**FR/NFR References:** FR149, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR149) | Service order lifecycle |
| Architecture | §2.30 Service Orders | ServiceOrder models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Service order layouts |
| API Contracts | §2.26 Service Orders | Service order CRUD endpoints |
| Data Models | §19 Service Orders | ServiceOrder schemas |
| State Machine Reference | §18 Service Orders | SM:ServiceOrder — OPEN → ASSIGNED → IN_PROGRESS → COMPLETED |
| Event Catalog | §17 Service Orders | service.order.created, service.order.completed events |
| Business Rules Compendium | §13 Additional (BR-SVO) | Service order rules |

---

### Story E26e.S2: Service Item Tracking & History

**User Story:** As a service manager, I want to track service items (equipment) with service history and warranty information.

**Acceptance Criteria:**

```gherkin
Scenario: Register service item
  Given a customer has equipment under service contract
  When I register the item with serial number, warranty dates, and contract reference
  Then a ServiceItem record tracks the equipment (FR150)

Scenario: View service history
  Given a service item has had 5 service visits
  When I view the item's history
  Then all visits are listed with dates, issues, and resolutions
```

**Key Tasks:**
1. Create ServiceItem model with warranty tracking
2. Implement service item CRUD with history view
3. Write tests

**FR/NFR References:** FR150, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR150) | Service item tracking, warranty |
| Architecture | §2.30 Service Orders | ServiceItem model |
| UX Design Specification | T2 (Record Detail) | Service item detail with history |
| API Contracts | §2.26 Service Orders | Service item endpoints |
| Data Models | §19 Service Orders | ServiceItem schema |
| State Machine Reference | §18 Service Orders | SM:ServiceItem lifecycle |
| Event Catalog | §17 Service Orders | service.item.registered event |
| Business Rules Compendium | §13 Additional (BR-TK) | Service item rules |

---

### Story E26e.S3: Field Service Scheduling

**User Story:** As a dispatcher, I want to schedule field service visits with calendar integration and technician availability checking.

**Acceptance Criteria:**

```gherkin
Scenario: Schedule service visit
  Given a service order requires on-site visit
  When I schedule a visit checking technician availability
  Then a ServiceVisit record is created with date, time, and technician (FR151)
```

**Key Tasks:**
1. Create ServiceVisit model with scheduling
2. Implement availability checking against technician calendars
3. Build scheduling calendar UI
4. Write tests

**FR/NFR References:** FR151, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR151) | Field service scheduling |
| Architecture | §2.30 Service Orders | Scheduling design |
| UX Design Specification | T5 (Board/Kanban) | Scheduling board/calendar |
| API Contracts | §2.26 Service Orders | Scheduling endpoints |
| Data Models | §19 Service Orders | ServiceVisit schema |
| State Machine Reference | §18 Service Orders | SM:ServiceVisit lifecycle |
| Event Catalog | §17 Service Orders | service.visit.scheduled event |
| Business Rules Compendium | §13 Additional (BR-SVO) | Scheduling rules |

---

### Story E26e.S4: Service Order to Invoice Conversion

**User Story:** As a service administrator, I want to convert completed service orders to invoices with automatic line item generation from service activities and parts used.

**Acceptance Criteria:**

```gherkin
Scenario: Generate invoice from service order
  Given a service order is completed with labour (3 hours) and parts (2 items)
  When I generate an invoice
  Then a draft invoice is created with labour and parts line items (FR152)
```

**Key Tasks:**
1. Implement service-to-invoice conversion
2. Generate line items from service activities and parts
3. Write tests

**FR/NFR References:** FR152, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR152) | Service to invoice conversion |
| Architecture | §2.30 Service Orders | Invoice generation from service |
| UX Design Specification | T3 (Header+Lines) | Generated invoice layout |
| API Contracts | §2.26 Service Orders | Invoice conversion endpoint |
| Data Models | §19 Service Orders, §5 AR | Service-to-invoice mapping |
| State Machine Reference | §18 Service Orders | Conversion as side effect of completion |
| Event Catalog | §17 Service Orders | service.invoice.generated event |
| Business Rules Compendium | §13 Additional (BR-SVO) | Conversion rules |

---

### Story E26e.S5: Mobile Adaptation — Service Orders

**User Story:** As a field technician, I want to view assigned service orders, update status, log work details, and capture signatures from my mobile device.

**Key Tasks:**
1. Create mobile service order list (assigned to me)
2. Implement mobile work logging and status updates
3. Implement signature capture
4. Write tests

**FR/NFR References:** FR149, FR151, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders | Mobile field service |
| Architecture | §2.30 Service Orders | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.26 Service Orders | Same endpoints |
| Data Models | §19 Service Orders | Same models |
| State Machine Reference | §18 Service Orders | Same state machines |
| Event Catalog | §17 Service Orders | Same events |
| Business Rules Compendium | §13 Additional | Same rules |

---

## Epic E26f: Intercompany Transactions

> **Automatic intercompany transaction routing (PO in one company creates SO in counterpart), elimination journals, consolidated reporting, and currency translation for foreign subsidiaries.**

**Architecture:** §2.28 Intercompany
**Models:** 11 models
**State Machines:** SM:IntercompanyTransaction
**Business Rules:** BR-1 to BR-15 (intercompany)
**FRs:** FR141–FR144

---

### Story E26f.S1: Intercompany Transaction Routing

**User Story:** As a multi-company user, I want a purchase order in one company to automatically create a corresponding sales order in the counterpart company so that intercompany transactions are seamlessly linked.

**Acceptance Criteria:**

```gherkin
Scenario: PO creates counterpart SO
  Given Company A has an intercompany relationship with Company B
  When Company A creates a PO to Company B
  Then a corresponding draft SO is automatically created in Company B (FR141)
  And both documents are linked via IntercompanyTransaction record
```

**Key Tasks:**
1. Create IntercompanyRelationship and IntercompanyTransaction models
2. Implement automatic SO creation on intercompany PO
3. Build intercompany configuration UI
4. Write tests

**FR/NFR References:** FR141, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR141) | Automatic transaction routing |
| Architecture | §2.28 Intercompany | Routing design, IntercompanyTransaction model |
| UX Design Specification | T7 (Settings) | Intercompany relationship configuration |
| API Contracts | §2.25 Intercompany | Transaction routing endpoints |
| Data Models | §18 Intercompany | IntercompanyRelationship, IntercompanyTransaction |
| State Machine Reference | §16 Intercompany | SM:IntercompanyTransaction lifecycle |
| Event Catalog | §15 Intercompany | intercompany.transaction.created event |
| Business Rules Compendium | §13 Additional (BR-1 to BR-5) | Routing rules |

---

### Story E26f.S2: Elimination Journals

**User Story:** As a finance user, I want the system to generate intercompany elimination journal entries for consolidated financial reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Generate elimination entries
  Given Company A sold GBP 10,000 to Company B in the period
  When elimination journals are generated
  Then matching revenue and cost entries are eliminated (FR142)
```

**Key Tasks:**
1. Implement elimination journal generation engine
2. Build elimination run wizard — T6
3. Write tests

**FR/NFR References:** FR142, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR142) | Elimination journals |
| Architecture | §2.28 Intercompany | Elimination engine design |
| UX Design Specification | T6 (Wizard) | Elimination run wizard |
| API Contracts | §2.25 Intercompany | Elimination endpoints |
| Data Models | §18 Intercompany | EliminationJournal model |
| State Machine Reference | §16 Intercompany | N/A |
| Event Catalog | §15 Intercompany | elimination.completed event |
| Business Rules Compendium | §13 Additional (BR-6 to BR-10) | Elimination rules |

---

### Story E26f.S3: Consolidated Reporting & Currency Translation

**User Story:** As a group finance director, I want consolidated financial reports across multiple companies with currency translation for foreign subsidiaries.

**Acceptance Criteria:**

```gherkin
Scenario: Consolidated P&L
  Given Company A (GBP) and Company B (EUR) have financial data
  When I generate consolidated P&L
  Then both companies' results are translated and combined (FR143, FR144)
  And intercompany transactions are eliminated
```

**Key Tasks:**
1. Implement consolidated report queries — combine across companies
2. Implement currency translation — closing rate and average rate methods (FR144)
3. Build consolidated report UI — T8 (Report)
4. Write tests

**FR/NFR References:** FR143, FR144, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR143, FR144) | Consolidated reports, currency translation |
| Architecture | §2.28 Intercompany | Consolidation engine, FX translation |
| UX Design Specification | T8 (Report) | Consolidated report layout |
| API Contracts | §2.25 Intercompany | Consolidation endpoints |
| Data Models | §18 Intercompany | Consolidation models |
| State Machine Reference | §16 Intercompany | N/A |
| Event Catalog | §15 Intercompany | consolidation.completed event |
| Business Rules Compendium | §13 Additional (BR-11 to BR-15) | Translation rules |

---

### Story E26f.S4: Mobile Adaptation — Intercompany

**User Story:** As a mobile user, I want to view intercompany transaction status and consolidated KPIs on my phone.

**Key Tasks:**
1. Create mobile intercompany transaction list
2. Create mobile consolidated KPI cards
3. Write tests

**FR/NFR References:** FR141, FR143, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany | Mobile access |
| Architecture | §2.28 Intercompany | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.25 Intercompany | Same endpoints |
| Data Models | §18 Intercompany | Same models |
| State Machine Reference | §16 Intercompany | Same state machines |
| Event Catalog | §15 Intercompany | Same events |
| Business Rules Compendium | §13 Additional | Same rules |

---

## Epic E26g: Communications

> **Internal messaging, email integration (inbound IMAP), entity activity feeds, and document attachment management with version tracking.**

**Architecture:** §2.29 Communications
**Models:** 15 models
**State Machines:** SM:EmailThread, SM:InternalMessage
**Business Rules:** BR-COM-001 to BR-COM-017
**FRs:** FR145–FR148

**Dependencies:** E10 (Email Integration for SMTP outbound), E8 (Attachments for document management)

---

### Story E26g.S1: Internal Messaging

**User Story:** As a user, I want to send and receive internal messages and notifications within the ERP so that team communication is centralised alongside business data.

**Acceptance Criteria:**

```gherkin
Scenario: Send internal message
  Given I want to message a colleague about an invoice
  When I compose a message with subject, body, and linked invoice record
  Then the message is sent and the recipient is notified (FR145)
```

**Key Tasks:**
1. Create InternalMessage, MessageThread, MessageRecipient models
2. Implement messaging endpoints — send, read, reply, mark read
3. Build messaging UI — inbox, compose, thread view
4. Write tests

**FR/NFR References:** FR145, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR145) | Internal messaging |
| Architecture | §2.29 Communications | Messaging models |
| UX Design Specification | T1 (Entity List) | Message inbox layout |
| API Contracts | §2.24 Communications | Messaging endpoints |
| Data Models | §19 Communications | InternalMessage schemas |
| State Machine Reference | §17 Communications | SM:InternalMessage lifecycle |
| Event Catalog | §16 Communications | message.sent event |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-001 to BR-COM-005 |

---

### Story E26g.S2: Email Integration (Inbound IMAP)

**User Story:** As a user, I want to send and receive emails from within the ERP with automatic linking to relevant business entities.

**Acceptance Criteria:**

```gherkin
Scenario: Receive and link email
  Given IMAP is configured for the company
  When an email arrives from a known customer
  Then the email is automatically linked to the customer record (FR146)
  And appears in the customer's activity feed
```

**Key Tasks:**
1. Implement IMAP email fetch service (BullMQ job)
2. Implement automatic entity linking — match sender to customer/supplier
3. Build email viewing and composing within ERP
4. Write tests

**FR/NFR References:** FR146, NFR22, NFR34

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR146) | Email integration, entity linking |
| Architecture | §2.29 Communications | IMAP integration, email threading |
| UX Design Specification | T2 (Record Detail) | Email on entity detail view |
| API Contracts | §2.24 Communications | Email endpoints |
| Data Models | §19 Communications | EmailThread, EmailMessage schemas |
| State Machine Reference | §17 Communications | SM:EmailThread lifecycle |
| Event Catalog | §16 Communications | email.received, email.linked events |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-006 to BR-COM-012 |

---

### Story E26g.S3: Entity Activity Feeds

**User Story:** As a user, I want a chronological activity feed per entity showing all related interactions (calls, emails, notes, tasks, transactions) so that I have a complete history.

**Acceptance Criteria:**

```gherkin
Scenario: View customer activity feed
  Given a customer has emails, calls, invoices, and notes
  When I view the customer's activity feed
  Then all interactions are displayed chronologically (FR147)
  And each entry links to the source record
```

**Key Tasks:**
1. Implement activity feed aggregation service — gather activities from multiple sources
2. Build activity feed component — reusable across all entity types
3. Write tests

**FR/NFR References:** FR147, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR147) | Entity activity feeds |
| Architecture | §2.29 Communications | Activity feed aggregation |
| UX Design Specification | T2 (Record Detail) | Activity feed component |
| API Contracts | §2.24 Communications | Activity feed endpoint |
| Data Models | §19 Communications | ActivityFeedEntry (virtual/aggregated) |
| State Machine Reference | §17 Communications | N/A |
| Event Catalog | §16 Communications | All entity events feed into activity |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-013 to BR-COM-017 |

---

### Story E26g.S4: Document Attachment Versioning

**User Story:** As a user, I want to attach documents to any business record with version tracking and access control so that important documents are managed centrally.

**Acceptance Criteria:**

```gherkin
Scenario: Upload document with version tracking
  Given I am viewing a purchase order
  When I upload a contract PDF as attachment
  Then the document is stored with version 1 (FR148)
  And when I upload a new version, it becomes version 2 with the original preserved
```

**Key Tasks:**
1. Extend Attachment model with version tracking (version number, previousVersionId)
2. Implement version upload and history endpoints
3. Build version history UI on attachment detail
4. Write tests

**FR/NFR References:** FR148, NFR8

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR148) | Document attachment versioning |
| Architecture | §2.29 Communications, §2.8 Cross-Cutting | Attachment versioning |
| UX Design Specification | T2 (Record Detail) | Attachment panel with versions |
| API Contracts | §2.24 Communications | Attachment version endpoints |
| Data Models | §10 Cross-Cutting | Attachment model with version fields |
| State Machine Reference | §17 Communications | N/A |
| Event Catalog | §16 Communications | attachment.uploaded event |
| Business Rules Compendium | §13 Additional (BR-COM) | Version retention rules |

---

## Epic E27+: Platform Admin Phase 2

> **Advanced platform administration including auto-provisioning, Stripe billing integration, advanced monitoring, GDPR tooling, and operational automation.** This extends the Platform Admin Portal (E13b) with production-grade operational features.

**Architecture:** §2.31 Platform Layer
**FRs:** FR193–FR222 (extends E13b coverage)
**NFRs:** NFR46–NFR50

**Dependencies:** E13b (Platform Admin Portal Phase 1), E3b (Platform API + AI Gateway)

---

### Story E27.S1: Auto-Provisioning & Tenant Lifecycle Automation

**User Story:** As a platform administrator, I want tenant provisioning to be fully automated (database creation, schema migration, initial data seeding, DNS configuration) so that new tenants are onboarded in under 60 seconds.

**Acceptance Criteria:**

```gherkin
Scenario: Automated tenant provisioning
  Given a new tenant signs up via the self-service portal
  When the provisioning pipeline runs
  Then a new database is created, schema is migrated, initial data seeded, and the tenant is active (NFR26)
  And the entire process completes within 60 seconds

Scenario: Self-service tenant creation
  Given a prospect completes the signup form
  When they confirm their email
  Then their tenant is automatically provisioned without platform admin intervention
```

**Key Tasks:**
1. Implement automated provisioning pipeline — database creation, Prisma migration, seed data
2. Implement self-service signup flow with email verification
3. Implement provisioning status tracking and rollback on failure
4. Write tests — provisioning under 60s, rollback on failure

**FR/NFR References:** FR193, NFR26

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR193) | Tenant provisioning, lifecycle |
| Architecture | §2.31 Platform Layer | Auto-provisioning pipeline |
| UX Design Specification | N/A | Self-service signup UX |
| API Contracts | §2.28 Platform Admin | Provisioning endpoints |
| Data Models | §20 Platform | Tenant, ProvisioningJob models |
| State Machine Reference | N/A | Provisioning pipeline states |
| Event Catalog | N/A | tenant.provisioned event |
| Business Rules Compendium | N/A | Provisioning rules |

---

### Story E27.S2: Stripe Billing Integration

**User Story:** As a platform operator, I want billing automated via Stripe (subscription management, invoice generation, payment processing, dunning) so that tenant payments are handled without manual intervention.

**Acceptance Criteria:**

```gherkin
Scenario: Stripe subscription created on tenant signup
  Given a new tenant selects the "Pro" plan
  When provisioning completes
  Then a Stripe subscription is created and the first invoice is generated

Scenario: Automated dunning on payment failure
  Given a tenant's payment fails
  When the grace period expires
  Then the tenant is moved to read-only mode per enforcement controls (FR203)
```

**Key Tasks:**
1. Implement Stripe integration — subscriptions, invoices, webhooks
2. Implement plan-to-Stripe-price mapping
3. Implement dunning workflow — grace period, read-only, suspension
4. Write tests

**FR/NFR References:** FR201, FR202, FR203, FR204

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR201-FR204) | Billing, dunning, enforcement |
| Architecture | §2.31 Platform Layer | Stripe integration design |
| UX Design Specification | N/A | Billing dashboard UI |
| API Contracts | §2.28 Platform Admin | Billing endpoints |
| Data Models | §20 Platform | BillingProfile, Subscription models |
| State Machine Reference | N/A | Billing lifecycle |
| Event Catalog | N/A | billing.payment.failed, tenant.suspended events |
| Business Rules Compendium | N/A | Billing enforcement rules |

---

### Story E27.S3: Advanced Monitoring & Alerting

**User Story:** As a platform operator, I want advanced monitoring dashboards with error rate tracking, latency metrics, and automated alerting so that platform issues are detected and resolved before tenants are impacted.

**Acceptance Criteria:**

```gherkin
Scenario: Platform health dashboard
  Given the platform is serving 100 tenants
  When I view the health dashboard
  Then I see error rates, latency percentiles, queue depths, and uptime status (FR211)

Scenario: Automated alert on error spike
  Given error rate exceeds threshold for 5 minutes
  When the alert fires
  Then platform admins receive email/Slack notification
```

**Key Tasks:**
1. Implement monitoring data collection — error rates, latency, queue metrics
2. Build health dashboard — FR211
3. Implement alerting rules engine — configurable thresholds, notification channels
4. Implement background jobs dashboard — FR212
5. Write tests

**FR/NFR References:** FR211, FR212, FR213, NFR17

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR211-FR213) | Monitoring, background jobs, emergency controls |
| Architecture | §2.31 Platform Layer | Monitoring infrastructure |
| UX Design Specification | T4 (Briefing) | Health dashboard |
| API Contracts | §2.28 Platform Admin | Monitoring endpoints |
| Data Models | §20 Platform | Metrics, AlertRule models |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | alert.fired event |
| Business Rules Compendium | N/A | Alerting threshold rules |

---

### Story E27.S4: GDPR Tooling & Data Compliance

**User Story:** As a platform administrator, I want GDPR compliance tools (data subject access requests, data deletion/anonymisation, data retention policy configuration) so that we meet regulatory obligations.

**Acceptance Criteria:**

```gherkin
Scenario: Process DSAR (Data Subject Access Request)
  Given a tenant requests data export
  When I trigger the DSAR process
  Then all tenant data is exported in a portable format (FR215)
  And the export is logged in the audit trail

Scenario: Data deletion/anonymisation
  Given a tenant requests data deletion
  When I execute the deletion process
  Then personal data is anonymised where deletion is not possible
  And financial records are retained for 6 years per HMRC (NFR40)
```

**Key Tasks:**
1. Implement DSAR export — gather all tenant data, package in standard format
2. Implement data deletion/anonymisation — selective anonymisation preserving financial integrity
3. Implement retention policy configuration per tenant
4. Build GDPR tools in platform admin portal
5. Write tests

**FR/NFR References:** FR215, FR216, FR93, NFR40

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR215, FR216) | GDPR operations, data access logs |
| Architecture | §2.31 Platform Layer | GDPR tooling design |
| UX Design Specification | T7 (Settings) | GDPR tools interface |
| API Contracts | §2.28 Platform Admin | GDPR endpoints |
| Data Models | §20 Platform | DsarRequest, DataRetentionPolicy models |
| State Machine Reference | N/A | DSAR processing lifecycle |
| Event Catalog | N/A | gdpr.dsar.completed event |
| Business Rules Compendium | N/A | Data retention rules, HMRC 6-year rule |

---

### Story E27.S5: Support Console & Runbook Operations

**User Story:** As a support engineer, I want a support console to search for tenants, view diagnostics, and execute safe runbook operations so that tenant issues can be resolved quickly.

**Acceptance Criteria:**

```gherkin
Scenario: Search and diagnose tenant
  Given a tenant reports an issue
  When I search by domain or company name
  Then I see tenant diagnostics: auth status, webhook health, email deliverability, integrations (FR217)

Scenario: Execute runbook operation
  Given a background job failed for a tenant
  When I execute the "re-run failed job" runbook from the console
  Then the job is re-queued and the operation is logged (FR218)
```

**Key Tasks:**
1. Implement tenant search and diagnostics endpoint
2. Implement safe runbook operations — re-run jobs, rebuild indexes, rotate tokens, re-sync
3. Build support console UI — search, diagnostics view, runbook execution
4. Implement audit logging for all support actions
5. Write tests

**FR/NFR References:** FR217, FR218, FR214, NFR49

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR217, FR218, FR214) | Support console, runbooks, audit |
| Architecture | §2.31 Platform Layer | Support console design |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Tenant search, diagnostics view |
| API Contracts | §2.28 Platform Admin | Support console endpoints |
| Data Models | §20 Platform | SupportAction, RunbookExecution models |
| State Machine Reference | N/A | Runbook execution lifecycle |
| Event Catalog | N/A | support.runbook.executed event |
| Business Rules Compendium | N/A | Runbook safety rules |

---

# Appendix: Epic Summary Table

| Epic | Name | Stories | MVP/Phase 2 | Primary FRs |
|------|------|---------|-------------|-------------|
| E20 | Document Understanding | 7 | MVP Tier 3 | FR164-FR170 |
| E21 | CRM | 9 | MVP Tier 3 | FR54-FR58, FR95-FR100 |
| E22 | Fixed Assets | 6 | MVP Tier 3 | FR158-FR163 |
| E23 | HR/Payroll | 12 | MVP Tier 3 | FR59-FR67, FR101-FR108 |
| E24 | Manufacturing/MRP | 9 | MVP Tier 3 | FR68-FR73, FR109-FR115 |
| E25 | Reporting Engine | 8 | MVP Tier 3 | FR74-FR79, FR91, FR153, FR155-FR157 |
| E26a | Warehouse (WMS) | 5 | Phase 2 | FR135-FR140 |
| E26b | POS | 7 | Phase 2 | FR116-FR122 |
| E26c | Projects | 6 | Phase 2 | FR123-FR129 |
| E26d | Contracts | 4 | Phase 2 | FR130-FR134 |
| E26e | Service Orders | 5 | Phase 2 | FR149-FR152 |
| E26f | Intercompany | 4 | Phase 2 | FR141-FR144 |
| E26g | Communications | 4 | Phase 2 | FR145-FR148 |
| E27+ | Platform Admin Phase 2 | 5 | Phase 2+ | FR193-FR222 (extended) |
| **Total** | | **91** | | |

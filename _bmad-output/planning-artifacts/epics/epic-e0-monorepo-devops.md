# Epic E0: Monorepo + DevOps

**Tier:** 0 | **Dependencies:** None | **Type:** Infrastructure only (no FRs)
**NFRs:** NFR1 (API <500ms), NFR2 (AI <3s), NFR40-NFR45 (security & maintainability)

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E0.1 | Initialize Monorepo Structure | Pending |
| E0.2 | CI/CD Pipeline | Pending |
| E0.3 | Docker Compose Dev Environment | Pending |
| E0.4 | Code Quality Standards | Pending |

---

## Story E0.S1: Initialize Monorepo Structure

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

## Story E0.S2: CI/CD Pipeline

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

## Story E0.S3: Docker Compose Dev Environment

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

## Story E0.S4: Code Quality Standards

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

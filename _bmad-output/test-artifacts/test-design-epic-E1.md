---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-18'
---

# Test Design: Epic E1 - Database + Core Models

**Date:** 2026-02-18
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E1 — Database + Core Models

**Risk Summary:**

- Total risks identified: 11
- High-priority risks (>=6): 3
- Critical categories: DATA (4), TECH (3), SEC (2), OPS (1), PERF (1)

**Coverage Summary:**

- P0 scenarios: 12 (~12-20 hours)
- P1 scenarios: 18 (~10-18 hours)
- P2 scenarios: 14 (~4-8 hours)
- P3 scenarios: 4 (~1-2 hours)
- **Total effort**: ~27-48 hours (~3.5-6 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **API endpoints** | E1 is data-layer only; REST/GraphQL endpoints are E2+ | Models tested via Prisma Client directly; API integration tested when E2 is built |
| **Authentication logic** | Auth service (JWT, Argon2, MFA flow) is E2 | User model structure tested here; auth behaviour tested in E2 |
| **UI / frontend** | No UI in E1 | N/A — pure backend epic |
| **Event emission** | Event bus is E3 | Schema supports events; emission tested when E3 is built |
| **Multi-tenant connection routing** | Tenant routing middleware is E2 | Platform schema and ERP schema tested independently; routing logic tested in E2 |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | DATA | Number series concurrent access produces gaps or duplicates under load — atomic UPDATE...RETURNING with row-level lock is the only protection against race conditions | 3 | 3 | 9 | Integration test with 10+ parallel calls against real PostgreSQL; verify gap-free sequence; test under transaction contention | Dev | Sprint E1 |
| R-002 | DATA | Decimal precision loss — monetary fields stored as FLOAT or wrong scale would silently corrupt financial calculations downstream | 2 | 3 | 6 | Schema-level test asserting DECIMAL(19,4) column type; round-trip test writing 4-decimal values and reading them back unchanged | Dev | Sprint E1 |
| R-003 | SEC | Platform audit log mutability — if UPDATE/DELETE operations are not blocked on PlatformAuditLog, compliance (NFR49) is violated | 2 | 3 | 6 | Test that Prisma schema has no update/delete methods exposed; integration test attempting UPDATE/DELETE and asserting failure | Dev | Sprint E1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-004 | TECH | Dual Prisma client conflict — ERP PrismaClient and PlatformPrismaClient may collide in generated output or import paths | 2 | 2 | 4 | Test both `prisma generate` commands succeed independently; verify no naming collision in node_modules | Dev |
| R-005 | DATA | companyId missing on tables — if any model omits companyId, cross-company data leakage occurs | 2 | 2 | 4 | Schema introspection test verifying every ERP table (except Currency) has company_id column | Dev |
| R-006 | TECH | snake_case mapping inconsistency — Prisma model names vs PostgreSQL table names mismatch breaks raw SQL queries | 2 | 2 | 4 | Schema introspection test checking all table names are snake_case; all column names are snake_case | Dev |
| R-007 | DATA | Seed data idempotency — `prisma db seed` fails or produces duplicates on re-run | 2 | 2 | 4 | Seed uses upsert pattern; test running seed twice produces identical state | Dev |
| R-008 | TECH | UserCompanyRole constraint violation — unique constraint [userId, companyId] with nullable companyId may not behave as expected across databases | 2 | 2 | 4 | Integration test: create two global roles (companyId=null) for same user → expect constraint violation | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-009 | OPS | Migration ordering — migrations must apply cleanly in sequence against empty database | 1 | 2 | 2 | Test `prisma migrate deploy` from scratch succeeds |
| R-010 | PERF | Exchange rate query performance with large date ranges | 1 | 2 | 2 | Monitor; add index on [currencyCode, rateDate] |
| R-011 | TECH | Currency natural key (3-char code) — FK references from other models use String instead of UUID | 1 | 1 | 1 | Document; verify FK constraints work correctly |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E0 complete (monorepo, Docker Compose, CI/CD)
- [ ] PostgreSQL container running (nexa_erp_dev database)
- [ ] Platform PostgreSQL container running (nexa_platform_dev database)
- [ ] Prisma CLI available in packages/db
- [ ] DATABASE_URL and PLATFORM_DATABASE_URL configured in .env

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%)
- [ ] No open high-severity bugs against E1 models
- [ ] `prisma migrate deploy` runs cleanly from empty database
- [ ] Seed data populates correctly (currencies, countries, VAT codes, payment terms, number series, plans)
- [ ] Both Prisma clients generate without conflicts

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority based on risk and business impact, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E1.5-INT-001 | Number series: 10 concurrent calls produce unique sequential numbers, no gaps | Integration | R-001 | Real PG, parallel Vitest workers |
| E1.5-INT-002 | Number series: format output matches prefix + LPAD (e.g., INV-00001) | Integration | R-001 | Verify padding, prefix, suffix |
| E1.5-INT-003 | Number series: deactivated series rejects generation | Integration | R-001 | isActive=false → error |
| E1.2-INT-001 | Monetary fields use DECIMAL(19,4) — write 1234.5678, read back unchanged | Integration | R-002 | CompanyProfile.baseCurrency, ExchangeRate amounts |
| E1.2-INT-002 | Exchange rate fields use DECIMAL(18,8) — write 8-decimal value, read back unchanged | Integration | R-002 | ExchangeRate.buyRate, sellRate |
| E1.6-INT-001 | PlatformAuditLog: INSERT succeeds | Integration | R-003 | Append-only verified |
| E1.6-INT-002 | PlatformAuditLog: UPDATE/DELETE rejected at application layer | Integration | R-003 | No updatedAt field; Prisma update/delete should fail or be blocked |
| E1.6-INT-003 | PlatformAuditLog: has no updatedAt column in PostgreSQL | Integration | R-003 | Schema introspection |
| E1.1-INT-001 | `prisma generate` succeeds for ERP schema (PrismaClient) | Integration | R-004 | No errors, typed client produced |
| E1.6-INT-004 | `prisma generate` succeeds for Platform schema (PlatformPrismaClient) | Integration | R-004 | Separate output, no conflicts |
| E1.1-INT-002 | `prisma migrate dev` creates all tables in nexa_erp_dev | Integration | — | Full migration from empty DB |
| E1.6-INT-005 | `prisma migrate dev` creates all tables in nexa_platform_dev | Integration | — | Full migration from empty DB |

**Total P0**: 12 tests, ~12-20 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E1.2-UNIT-001 | Every ERP model (except Currency) has companyId field | Unit | R-005 | Schema introspection or Prisma DMMF parsing |
| E1.2-UNIT-002 | All table names are snake_case (@@map verification) | Unit | R-006 | Parse schema.prisma or introspect PG information_schema |
| E1.2-UNIT-003 | All column names are snake_case (@map verification) | Unit | R-006 | Same approach |
| E1.2-UNIT-004 | All reference entities have isActive Boolean field | Unit | R-005 | Currency, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday |
| E1.2-INT-003 | CompanyProfile model: all required fields present and correct types | Integration | — | name, legalName, registrationNo, vatNumber, baseCurrencyCode FK |
| E1.2-INT-004 | Currency model: natural key (code String 3 chars), no UUID PK | Integration | R-011 | Verify PK is `code`, not `id` |
| E1.3-INT-001 | RegisterSharingRule unique constraint [entityType, sourceCompanyId, targetCompanyId] enforced | Integration | R-008 | Duplicate insert → constraint violation |
| E1.3-INT-002 | UserCompanyRole unique constraint [userId, companyId] enforced | Integration | R-008 | Duplicate insert → constraint violation |
| E1.3-INT-003 | SharingMode enum contains exactly NONE, ALL_COMPANIES, SELECTED | Integration | — | Enum value verification |
| E1.3-INT-004 | UserRole enum contains SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER | Integration | — | Enum value verification |
| E1.3-UNIT-001 | getVisibleCompanyIds: NONE mode returns only source company | Unit | — | Pure function test |
| E1.3-UNIT-002 | getVisibleCompanyIds: ALL_COMPANIES returns all companies | Unit | — | Pure function test |
| E1.3-UNIT-003 | getVisibleCompanyIds: SELECTED returns configured targets only | Unit | — | Pure function test |
| E1.4-INT-001 | User model: email unique constraint enforced | Integration | — | Duplicate email → violation |
| E1.4-INT-002 | User model: passwordHash accepts Argon2id output (variable length) | Integration | — | Store 97+ char hash, read back unchanged |
| E1.4-INT-003 | RefreshToken: tokenHash indexed, [userId, revokedAt] indexed | Integration | — | Index exists in PG |
| E1.1-INT-003 | Seed script: `prisma db seed` populates currencies (GBP, EUR, USD), UK country, VAT codes, payment terms | Integration | R-007 | Verify data exists after seed |
| E1.6-INT-006 | Platform seed: 3 plans (Core, Pro, Enterprise), founding tenant, PLATFORM_ADMIN user | Integration | R-007 | Verify data exists after seed |

**Total P1**: 18 tests, ~10-18 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E1.1-INT-004 | Seed idempotency: running `prisma db seed` twice produces same state | Integration | R-007 | Upsert pattern verification |
| E1.5-INT-004 | Number series: date-range sub-range uses sub-range prefix when date matches | Integration | R-001 | Sub-range logic |
| E1.5-INT-005 | Number series: unique constraint [companyId, entityType] prevents duplicates | Integration | — | Constraint verification |
| E1.5-INT-006 | Number series seed: all 8 default series created (INV, CN, PO, SO, JE, DSP, GRN, BILL) | Integration | — | Verify seed data |
| E1.2-INT-005 | ExchangeRate: composite index on [currencyCode, rateDate] exists | Integration | R-010 | Index introspection |
| E1.2-INT-006 | Reference entities: composite index on [companyId, isActive] exists | Integration | — | All LOV tables indexed |
| E1.4-INT-004 | User.enabledModules accepts JSON array and reads back correctly | Integration | — | Json field round-trip |
| E1.4-INT-005 | User.mfaEnabled defaults to false, mfaSecret defaults to null | Integration | — | Default value verification |
| E1.6-INT-007 | Tenant model: all status enum values (PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED) | Integration | — | Enum completeness |
| E1.6-INT-008 | Plan model: enabledModules as Json, monthlyAiTokenAllowance as BigInt | Integration | — | Field type verification |
| E1.6-INT-009 | TenantBilling: BillingStatus enum (CURRENT, GRACE, OVERDUE, BLOCKED) | Integration | — | Enum completeness |
| E1.6-INT-010 | ImpersonationSession: all required fields present | Integration | — | platformUserId, tenantId, reason, startedAt, expiresAt |
| E1.2-INT-007 | SystemSetting model: CRUD operations work correctly | Integration | — | Basic create/read/update |
| E1.1-INT-005 | DATABASE_URL configuration: schema connects via env variable | Integration | — | Datasource verification |

**Total P2**: 14 tests, ~4-8 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
| ------- | ----------- | ---------- | ----- |
| E1.5-PERF-001 | Number series: 100 concurrent calls complete within 2 seconds | Integration | Stress test benchmark |
| E1.2-INT-008 | Tag model: CRUD with companyId scoping | Integration | Simple reference entity |
| E1.2-INT-009 | BankHoliday model: CRUD with date fields | Integration | Simple reference entity |
| E1.6-INT-011 | PlatformUser: MFA fields default correctly | Integration | mfaEnabled=false, mfaSecret=null |

**Total P3**: 4 tests, ~1-2 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min; defer only if expensive or long-running.

| Trigger | What Runs | Expected Duration |
| ------- | --------- | ----------------- |
| **Every PR** | All unit + integration tests (P0, P1, P2, P3) | ~5-10 min (Vitest parallel, no browser) |
| **Nightly** | Performance benchmark (E1.5-PERF-001) | ~2-5 min |

Since E1 has no E2E/browser tests and all tests are unit or integration (Vitest + real PG), everything fits comfortably in PR runs. The only deferral is the stress benchmark.

---

## Resource Estimates

| Priority | Count | Effort Range | Notes |
| -------- | ----- | ------------ | ----- |
| P0 | 12 | ~12-20 hours | Concurrency tests, schema introspection, dual-client verification |
| P1 | 18 | ~10-18 hours | Model field verification, constraint testing, seed validation |
| P2 | 14 | ~4-8 hours | Index verification, edge cases, default values |
| P3 | 4 | ~1-2 hours | Benchmark, simple CRUD |
| **Total** | **48** | **~27-48 hours** | **~3.5-6 days** |

### Prerequisites

**Test Data:**
- Company factory (companyId, name, baseCurrencyCode)
- User factory (email, passwordHash, role, companyId)
- Seed data verification fixtures (currencies, countries, VAT codes, payment terms, number series, plans)

**Tooling:**
- Vitest for unit + integration tests
- Docker Compose for PostgreSQL containers (ERP + Platform)
- Prisma DMMF (Data Model Meta Format) for schema introspection tests

**Environment:**
- PostgreSQL 16 container (nexa_erp_dev) via Docker Compose
- PostgreSQL 16 container (nexa_platform_dev) via Docker Compose
- Node.js 20+ with Prisma 7.x

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Number series concurrency test proves gap-free (R-001)
- [ ] Decimal precision verified at database column level (R-002)
- [ ] Platform audit log immutability proven (R-003)

---

## Mitigation Plans

### R-001: Number Series Concurrent Access (Score: 9)

**Mitigation Strategy:**
1. Implement `nextNumber()` using `UPDATE ... RETURNING` with implicit row-level lock
2. Write integration test spawning 10 parallel calls using Promise.all
3. Assert all 10 results are unique, sequential, gap-free
4. Run test in CI with real PostgreSQL (not mocked)

**Owner:** Dev
**Timeline:** Sprint E1
**Status:** Planned
**Verification:** E1.5-INT-001 passes consistently across 5 consecutive runs

### R-002: Decimal Precision Loss (Score: 6)

**Mitigation Strategy:**
1. Define all monetary fields as `Decimal @db.Decimal(19,4)` in Prisma schema
2. Define exchange rate fields as `Decimal @db.Decimal(18,8)`
3. Write round-trip test: write `1234.5678` → read back → assert exact match
4. Introspect PostgreSQL column type to confirm DECIMAL(19,4)

**Owner:** Dev
**Timeline:** Sprint E1
**Status:** Planned
**Verification:** E1.2-INT-001 and E1.2-INT-002 pass

### R-003: Platform Audit Log Mutability (Score: 6)

**Mitigation Strategy:**
1. Ensure PlatformAuditLog model has no `updatedAt` field
2. Application layer should not expose update/delete methods for this model
3. Test attempting Prisma `update()` or `delete()` on audit log records
4. Verify at schema level that no mutation endpoints exist

**Owner:** Dev
**Timeline:** Sprint E1
**Status:** Planned
**Verification:** E1.6-INT-001, E1.6-INT-002, E1.6-INT-003 pass

---

## Assumptions and Dependencies

### Assumptions

1. E0 is complete — monorepo structure, Docker Compose, and CI pipeline are functional
2. PostgreSQL 16 is available via Docker Compose with two separate databases
3. Prisma 7.x supports separate schema files with separate client outputs
4. Vitest is the test runner (configured in E0)
5. All tests run against real PostgreSQL containers (no mocked database)

### Dependencies

1. Docker Compose running with both PostgreSQL containers — Required before any test execution
2. Prisma CLI installed in packages/db — Required for migration and generation
3. E0.S4 code quality tools (ESLint, Prettier) — Required for test code linting

### Risks to Plan

- **Risk**: PostgreSQL container startup delay in CI
  - **Impact**: Flaky test failures on cold start
  - **Contingency**: Add health-check wait step in CI before running tests

- **Risk**: Prisma 7.x breaking changes in migration tooling
  - **Impact**: Migration tests fail unexpectedly
  - **Contingency**: Pin exact Prisma version; test migrations locally before CI

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **E0 Docker Compose** | PostgreSQL containers must be running | Docker Compose up succeeds, health checks pass |
| **E0 CI Pipeline** | Tests must integrate into existing CI | CI workflow triggers on PR, test step succeeds |
| **E2 Auth (future)** | User/Session models used by E2 auth service | E1 schema changes must not break E2 expectations |
| **E3 Event Bus (future)** | Models may emit events in E3 | E1 models must support event payload extraction |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/planning-artifacts/epics/epic-e1-database-core-models.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`
- Data Models: `_bmad-output/planning-artifacts/data-models.md`
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md`

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)

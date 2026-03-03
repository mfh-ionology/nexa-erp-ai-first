---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-18'
---

# Test Design: Epic E0 - Monorepo + DevOps

**Date:** 2026-02-18
**Author:** Mohammed (TEA: Murat)
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E0 — infrastructure-only epic establishing the Turborepo monorepo, CI/CD pipeline, Docker Compose dev environment, and code quality tooling.

**Risk Summary:**

- Total risks identified: 10
- High-priority risks (>=6): 2
- Critical categories: OPS, TECH

**Coverage Summary:**

- P0 scenarios: 8 (~8-14 hours)
- P1 scenarios: 12 (~6-12 hours)
- P2 scenarios: 8 (~2-4 hours)
- P3 scenarios: 3 (~1-2 hours)
- **Total effort**: ~17-32 hours (~2-4 days)

> **Note:** P0/P1/P2/P3 = priority classification based on risk, NOT execution timing. Execution strategy is defined separately below.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Application code testing** | E0 is infrastructure-only; no business logic exists yet | Covered by E1+ epics when code is written |
| **Production deployment pipelines** | Only staging deploy is in scope (E0.S2 AC#2); production deploy is future work | Staging pipeline validates the pattern; production pipeline added later |
| **Kubernetes orchestration** | Architecture specifies Docker Compose for local/MVP; K8s is post-MVP | Docker Compose validates container definitions that will port to K8s |
| **Remote Turborepo caching** | E0.S1 AC#4 configures it but defaults to disabled; no Vercel account needed yet | Local caching still validates topology; remote caching enabled when needed |
| **Mobile app (Expo) build pipeline** | apps/mobile exists as stub only; no buildable app yet | Directory structure and package.json stub validated; build pipeline comes with E6 |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | OPS | Docker Compose health checks flaky or slow — dev environment unreliable if containers don't stabilize within 30s (E0.S3 AC#1) | 2 | 3 | 6 | Use pg_isready and redis-cli ping in healthchecks with retries; set start_period=5s, interval=2s, retries=10; document troubleshooting for slow machines | Dev | Sprint 0 |
| R-002 | TECH | Turborepo topological build order misconfigured — packages build before their dependencies are ready (E0.S1 AC#4) | 2 | 3 | 6 | Define explicit dependsOn in turbo.json; verify with turbo run build --dry-run; CI catches build failures before merge | Dev | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-003 | TECH | pnpm workspace resolution fails with phantom dependencies due to strict hoisting (shamefully-hoist=false) | 2 | 2 | 4 | Test clean install from scratch; .npmrc enforces strict; CI installs fresh every run | Dev |
| R-004 | OPS | PgBouncer transaction-mode pooling misconfigured — Prisma prepared statements fail silently | 2 | 2 | 4 | Validate PgBouncer config against Prisma requirements; integration test with actual query through PgBouncer | Dev |
| R-005 | OPS | CI pipeline exceeds 10-minute target due to uncached builds or slow npm install | 2 | 2 | 4 | pnpm cache in CI; Turborepo cache; only run affected packages on PR; monitor CI times | Dev |
| R-006 | TECH | TypeScript strict mode breaks third-party type definitions — compilation errors on clean install | 1 | 3 | 3 | Pin known-good versions of @types/* packages; skipLibCheck as last resort; verify in CI | Dev |
| R-007 | SEC | .env.example accidentally contains real credentials or CI secrets leak into logs | 1 | 3 | 3 | .env.example uses placeholder values only; CI masks secrets; .gitignore includes .env | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-008 | OPS | Branch protection rules not enforced — direct pushes to main possible | 1 | 2 | 2 | Monitor; verify via GitHub API after setup |
| R-009 | TECH | ESLint/Prettier config conflicts between packages | 1 | 1 | 1 | Monitor; shared config in packages/config resolves most conflicts |
| R-010 | OPS | Husky hooks don't install on CI or fresh clone | 1 | 2 | 2 | Monitor; pnpm prepare script runs husky install |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] Epic E0 stories defined with acceptance criteria
- [x] Architecture document available with monorepo structure, tech stack, and infrastructure decisions
- [ ] Node.js 22 LTS, pnpm, Docker, and Docker Compose available on dev machines
- [ ] GitHub repository created with branch protection configurable
- [ ] GitHub Actions enabled on the repository

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or failures triaged (>=95%)
- [ ] No open high-priority bugs related to E0
- [ ] `pnpm install && turbo build` succeeds from clean clone
- [ ] `docker compose up` reaches healthy state within 30 seconds
- [ ] CI pipeline passes on a fresh PR

---

## Test Coverage Plan

### P0 (Critical)

**Criteria:** Blocks all downstream epics + High risk + No workaround if broken

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| E0.S1 AC#1: pnpm install resolves all workspaces | Integration | R-003 | 1 | Dev | Clean install from fresh clone; zero peer-dep warnings for internal packages |
| E0.S1 AC#4: turbo build executes in topological order | Integration | R-002 | 2 | Dev | Verify packages/ build before apps/; turbo --dry-run validates DAG |
| E0.S3 AC#1: docker compose up — all services healthy in 30s | Integration | R-001 | 2 | Dev | Verify postgres, pgbouncer, redis healthchecks; timeout assertion |
| E0.S3 AC#2: ERP PostgreSQL accepts connections on port 5432 | Integration | R-004 | 1 | Dev | Connect, run simple query, verify nexa_erp_dev database exists |
| E0.S3 AC#5: Redis accepts connections on port 6379 | Integration | — | 1 | Dev | Connect, SET/GET test key |
| E0.S2 AC#1: CI pipeline lint+typecheck+test+build all pass | Integration | R-005 | 1 | Dev | Trigger CI on test PR; all steps must complete successfully |

**Total P0:** 8 tests, ~8-14 hours

### P1 (High)

**Criteria:** Important for developer experience + Medium risk + Common daily workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| E0.S1 AC#2: All workspace directories exist with valid package.json | Unit | — | 1 | Dev | Script to verify directory structure matches architecture |
| E0.S1 AC#3: tsconfig.base.json strict mode, per-package inheritance | Unit | R-006 | 2 | Dev | Verify strict:true; verify per-package extends base |
| E0.S1 AC#5: pnpm-workspace.yaml auto-includes new packages | Integration | — | 1 | Dev | Add temporary package, verify workspace picks it up |
| E0.S3 AC#3: Platform PostgreSQL on port 5433 | Integration | — | 1 | Dev | Connect, verify nexa_platform_dev database exists |
| E0.S3 AC#4: PgBouncer transaction-mode pooling works with Prisma | Integration | R-004 | 1 | Dev | Connect through PgBouncer, execute query, verify pooling mode |
| E0.S3 AC#6: docker compose down -v cleans all volumes | Integration | — | 1 | Dev | Verify no leftover volumes after teardown |
| E0.S2 AC#4: Turborepo caching reduces CI time for unchanged packages | Integration | R-005 | 1 | Dev | Two consecutive CI runs; second should skip unchanged packages |
| E0.S2 AC#5: Failed CI step clearly shows failure reason | Unit | — | 1 | Dev | Introduce intentional lint error; verify error message in CI output |
| E0.S4 AC#1: ESLint catches strict TypeScript violations | Unit | — | 1 | Dev | Create file with `any` type; verify lint failure |
| E0.S4 AC#2: Prettier formats consistently | Unit | — | 1 | Dev | Run format:check on known-unformatted file; verify failure then fix |
| E0.S4 AC#5: Shared eslint config inherited by all packages | Unit | R-009 | 1 | Dev | Verify each app/package .eslintrc extends shared config |

**Total P1:** 12 tests, ~6-12 hours

### P2 (Medium)

**Criteria:** Secondary workflows + Low risk + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| E0.S4 AC#3: Husky pre-commit hooks block bad commits | Integration | R-010 | 2 | Dev | Commit lint-failing file; verify blocked. Commit clean file; verify passes |
| E0.S4 AC#4: Commitlint rejects non-conventional commits | Integration | — | 2 | Dev | Commit with "bad message"; verify rejected. Commit with "feat: good"; verify accepted |
| E0.S2 AC#2: deploy-staging triggers on merge to main | Integration | — | 1 | Dev | Verify workflow file syntax; stub deployment step runs |
| E0.S2 AC#3: Branch protection rejects direct push to main | Integration | R-008 | 1 | Dev | Verify via GitHub API or attempt direct push |
| E0.S3: .env.example has all required variables documented | Unit | R-007 | 1 | Dev | Parse .env.example; verify no real secrets; all vars have comments |
| E0.S1: .nvmrc specifies Node 22 LTS | Unit | — | 1 | Dev | Verify .nvmrc content matches expected Node version |

**Total P2:** 8 tests, ~2-4 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
|-------------|-----------|------------|-------|-------|
| Turborepo remote caching configuration valid (disabled by default) | Unit | 1 | Dev | Verify turbo.json has remote cache config structure |
| .gitignore covers all generated files (dist, node_modules, .env, prisma) | Unit | 1 | Dev | Verify key patterns present |
| CI test coverage report upload works | Integration | 1 | Dev | Verify coverage artifact uploaded after CI run |

**Total P3:** 3 tests, ~1-2 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if total execution <15 minutes. Only defer if expensive or long-running.

| Trigger | What Runs | Target Duration |
|---------|-----------|-----------------|
| **Every PR** | All P0 + P1 + P2 tests (unit + integration) | <10 min |
| **Nightly** | P3 exploratory tests; full clean-install validation | <15 min |

E0 has no E2E browser tests, no performance benchmarks, and no chaos testing — all tests are unit or integration level. The entire suite should run in under 10 minutes on CI with Turborepo caching.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|-----------|-------------|-------|
| P0 | 8 | ~1.5 | ~8-14 | Docker/CI setup complexity; healthcheck tuning |
| P1 | 12 | ~0.75 | ~6-12 | Standard config verification; some integration setup |
| P2 | 8 | ~0.5 | ~2-4 | Git hook and protection rule verification |
| P3 | 3 | ~0.5 | ~1-2 | Simple config checks |
| **Total** | **31** | **—** | **~17-32** | **~2-4 days** |

### Prerequisites

**Test Data:**
- No business data needed (infrastructure-only epic)
- Docker images: postgres:17, redis:7-alpine, edoburu/pgbouncer:latest

**Tooling:**
- Vitest for unit tests (config validation, file structure checks)
- Docker Compose for integration tests (container health, connectivity)
- GitHub Actions for CI pipeline validation
- pnpm + Turborepo for build system tests

**Environment:**
- Docker Desktop or compatible container runtime
- GitHub repository with Actions enabled
- Node.js 22 LTS

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions — blocks all downstream epics)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete (R-001, R-002) or approved waivers

### Coverage Targets

- **Infrastructure configuration**: 100% of acceptance criteria covered
- **Container health**: All 4 services (postgres-erp, postgres-platform, pgbouncer, redis) verified
- **CI pipeline**: Full pipeline execution validated on real PR
- **Code quality gates**: ESLint strict, Prettier, Husky, commitlint all verified

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] `pnpm install && turbo build` succeeds from clean clone
- [ ] `docker compose up` reaches healthy state within 30 seconds
- [ ] CI pipeline completes successfully on fresh PR

---

## Mitigation Plans

### R-001: Docker Compose Health Checks Flaky or Slow (Score: 6)

**Mitigation Strategy:**
1. Use `pg_isready` for PostgreSQL healthchecks (not TCP-only)
2. Use `redis-cli ping` for Redis healthcheck
3. Configure healthcheck parameters: `start_period=5s`, `interval=2s`, `retries=10`, `timeout=3s`
4. Add `depends_on` with `condition: service_healthy` for PgBouncer → PostgreSQL dependency
5. Document minimum Docker resource allocation (2GB RAM, 2 CPUs) for dev machines

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Run `docker compose up` 5 times consecutively; all must reach healthy within 30s

### R-002: Turborepo Topological Build Order Misconfigured (Score: 6)

**Mitigation Strategy:**
1. Define explicit `dependsOn` in turbo.json for build task (e.g., build: { dependsOn: ["^build"] })
2. Verify with `turbo run build --dry-run` that packages/db, packages/shared, packages/config build before apps/*
3. Add CI step that runs `turbo run build --dry-run` and verifies expected order
4. Document build dependency graph in CONTRIBUTING.md

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** `turbo run build --dry-run` output shows packages before apps; full build succeeds

---

## Assumptions and Dependencies

### Assumptions

1. Docker Desktop (or equivalent) is available on all developer machines with minimum 2GB RAM allocation
2. GitHub Actions is available and has sufficient minutes for CI runs
3. PostgreSQL 17 Docker image supports the required extensions (if any needed in future)
4. pnpm and Turborepo are stable at their latest versions for Node.js 22 LTS
5. No custom DNS or proxy configuration required for Docker networking in local dev

### Dependencies

1. GitHub repository must be created and accessible — Required before E0.S2
2. Docker Hub access for pulling official images — Required before E0.S3
3. GitHub organization settings must allow branch protection rules — Required before E0.S2 AC#3

### Risks to Plan

- **Risk**: Docker Desktop licensing changes or availability on developer machines
  - **Impact**: Cannot run local dev environment (E0.S3 blocked)
  - **Contingency**: Document alternative container runtimes (Podman, Colima for macOS)

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **E1 (Database + Core Models)** | E1 depends on E0 monorepo structure, packages/db directory, and Docker Compose PostgreSQL | E0 P0 tests must pass before E1 begins |
| **E2 (API Server + Auth)** | E2 depends on apps/api directory, CI pipeline, and Docker Compose services | E0 P0 + P1 tests form regression baseline |
| **E6 (Frontend Shell)** | E6 depends on apps/web directory, packages/config shared configs | E0.S1 directory structure tests must pass |
| **All future epics** | All depend on CI pipeline (E0.S2) and code quality gates (E0.S4) | E0 full suite is the regression baseline for the entire project |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (TECH/SEC/PERF/DATA/BUS/OPS)
- `probability-impact.md` — Risk scoring methodology (1-3 × 1-3 = 1-9)
- `test-levels-framework.md` — Test level selection (unit vs integration vs E2E)
- `test-priorities-matrix.md` — P0-P3 prioritization criteria

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/planning-artifacts/epics/epic-e0-monorepo-devops.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/`
- Project Context: `_bmad-output/planning-artifacts/project-context.md`

---

**Generated by**: BMad TEA Agent — Murat (Master Test Architect)
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)

---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-27'
---

# Test Design: Epic E7 - Saved Views / Filters / Columns

**Date:** 2026-02-27
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E7

**Risk Summary:**

- Total risks identified: 11
- High-priority risks (>=6): 3
- Critical categories: DATA, SEC, PERF

**Coverage Summary:**

- P0 scenarios: 8 (~12-20 hours)
- P1 scenarios: 14 (~15-25 hours)
- P2 scenarios: 10 (~5-10 hours)
- P3 scenarios: 4 (~2-4 hours)
- **Total effort**: ~34-59 hours (~1-1.5 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **AI integration tools** (open_entity_list, search_views, apply_filter, etc.) | E7 builds the data infrastructure and UI; AI tool registration and fuzzy matching will be tested in the AI epic (E5 integration) | AI tools depend on E7 APIs; API contract tests in E7 ensure compatibility |
| **Module-specific data_view seeding** (e.g., INVOICES, CUSTOMERS, JOURNAL_ENTRIES) | E7 seeds only USERS and a sample data_view; module-specific seeds ship with their respective epics (E8+) | E7 tests use the sample USERS data_view; real entity seeding is deferred |
| **Mobile-specific filter UI** (bottom sheet, simplified columns) | React Native mobile scaffold exists from E6 but views UI is web-first | Mobile adaptation uses the same API; mobile UI tests deferred to mobile epic |
| **Cross-browser visual regression** | P3 exploratory only; no systematic cross-browser matrix | Concept D design system provides consistent rendering; manual spot-checks |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | DATA | Filter-to-Prisma converter produces incorrect WHERE clauses for complex AND/OR + group bracketing combinations, showing wrong data to users | 2 | 3 | 6 | Comprehensive unit tests for every FilterOperator value; parameterised test matrix covering all type/operator combinations; integration tests with real Prisma queries | Dev | Sprint 1 |
| R-002 | SEC | Scope-based view visibility bypass — PERSONAL views exposed to other users, or non-ADMIN users creating GLOBAL views | 2 | 3 | 6 | Integration tests for every scope+role combination; middleware-level auth checks verified; negative tests for GLOBAL creation by STAFF | Dev | Sprint 1 |
| R-003 | PERF | Bundled init endpoint exceeds 100ms target under load — blocks page load for every T1 Entity List page in the system | 2 | 3 | 6 | Redis caching verified with TTL; benchmark test with realistic payload sizes; test cache-miss vs cache-hit paths | Dev | Sprint 1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-004 | TECH | LOV batch endpoint returns stale/incorrect data for dependent LOVs and server-side search (3-tier LOV strategy) | 2 | 2 | 4 | Integration tests for all LOV types (STATIC, GLOBAL, VIEW_SPECIFIC); dependent LOV parent-child tests; server-side search threshold tests | Dev |
| R-005 | DATA | Column width/order persistence race conditions — rapid drag-resize creates concurrent PATCH requests that overwrite each other | 2 | 2 | 4 | Test debounce behaviour; verify last-write-wins semantics; test concurrent requests | Dev |
| R-006 | TECH | Advanced filter group bracketing produces incorrect Prisma query — nested AND/OR groups with multiple conditions | 2 | 2 | 4 | Unit tests for nested group scenarios; integration tests verifying Prisma output matches expected WHERE clause | Dev |
| R-007 | BUS | Default view resolution order incorrect — personal -> role -> global -> system fallback chain returns wrong view | 2 | 2 | 4 | Integration tests for each fallback level; test when multiple defaults exist at different levels | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-008 | TECH | Date preset resolver produces wrong date ranges for timezone/boundary edge cases (e.g., "This Week" across DST boundary) | 1 | 3 | 3 | Monitor |
| R-009 | BUS | Favourites dropdown shows stale data after creating/deleting views — TanStack Query cache not invalidated | 1 | 2 | 2 | Monitor |
| R-010 | TECH | TanStack Table column resize state not persisting across page navigations | 1 | 2 | 2 | Monitor |
| R-011 | OPS | Redis cache invalidation fails — metadata shows stale data_view_fields after admin changes until 1hr TTL expires | 1 | 2 | 2 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E6 (Frontend Shell) completed and merged — T1 Entity List template available
- [ ] PostgreSQL test database provisioned with E1-E6 migrations applied
- [ ] Redis available for metadata caching tests
- [ ] Prisma schema updated with E7 models (6 new tables)
- [ ] Seed data: 20 date_range_presets + sample USERS data_view + fields

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] Filter-to-Prisma converter tested with all 14 FilterOperator values
- [ ] Scope-based visibility verified for PERSONAL, ROLE, GLOBAL
- [ ] Bundled init endpoint verified <100ms (cache-hit path)

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate risk-based priority, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (>=6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Filter-to-Prisma: EQUALS, NOT_EQUALS operators (string, number, enum) | Unit | R-001 | 3 | Dev | Pure function, all field types |
| Filter-to-Prisma: CONTAINS, STARTS_WITH, ENDS_WITH (string) | Unit | R-001 | 2 | Dev | String-only operators |
| Filter-to-Prisma: GT, GTE, LT, LTE, BETWEEN (number, date) | Unit | R-001 | 3 | Dev | Range operators with type coercion |
| Filter-to-Prisma: IN, NOT_IN (multi-value) | Unit | R-001 | 2 | Dev | Array value handling |
| Filter-to-Prisma: IS_EMPTY, IS_NOT_EMPTY (nullable fields) | Unit | R-001 | 2 | Dev | Null/empty semantics |
| Filter-to-Prisma: AND/OR with group bracketing (nested groups) | Integration | R-001, R-006 | 3 | Dev | Verify Prisma WHERE output matches expected SQL |
| Scope-based visibility: PERSONAL only visible to creator | Integration | R-002 | 2 | Dev | Multi-user scenario |
| Scope-based visibility: ROLE visible to matching role only | Integration | R-002 | 2 | Dev | Cross-role negative tests |
| Scope-based visibility: GLOBAL restricted to ADMIN creation | Integration | R-002 | 2 | Dev | 403 for STAFF creating GLOBAL |
| Bundled init endpoint: returns complete data, cache-hit <100ms | Integration | R-003 | 3 | Dev | Benchmark with realistic payload |

**Total P0**: ~24 tests, ~12-20 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Saved view CRUD: create with all scope types + read + update + delete | Integration | - | 5 | Dev | Happy path + validation errors |
| LOV batch endpoint: multi-field request, 3-tier strategy (STATIC, GLOBAL, VIEW_SPECIFIC) | Integration | R-004 | 4 | Dev | Including server-side search for >50 items |
| LOV dependent fields: parent-child constraint filtering | Integration | R-004 | 2 | Dev | lovDependsOn field behaviour |
| Column width persistence: PATCH drag-resize with debounce | Integration | R-005 | 2 | Dev | Verify persistence + concurrent request handling |
| Default view resolution: personal -> role -> global -> system fallback | Integration | R-007 | 4 | Dev | Test all 4 fallback levels |
| Toggle favourite + set-default endpoints | Integration | - | 2 | Dev | Ensure mutual exclusivity of defaults per entity |
| Date preset resolution: all 20 presets produce correct date ranges | Unit | R-008 | 3 | Dev | Boundary cases: MTD, YTD, Last/Next week |
| Views & Columns modal: tabs, grouped sections, star toggle, set default | E2E | - | 3 | QA | Concept D styled, keyboard accessible |
| Filter & Sort modal: Simple mode with searchable multi-select | E2E | - | 3 | QA | Filterable fields from metadata |
| Column pinning: sticky left/right with shadow indicator on scroll | E2E | - | 2 | QA | Horizontal scroll behaviour |
| Saved View Selector: dropdown with scope grouping, loads view config | E2E | - | 2 | QA | Load and apply view |
| Column reorder: drag-handle in Columns tab | E2E | - | 2 | QA | dnd-kit integration |
| Bulk column upsert: PUT /views/columns/:viewKey | Integration | - | 2 | Dev | Upsert with multiple columns |

**Total P1**: ~36 tests, ~15-25 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Advanced filter mode: AND/OR toggle, condition rows, group bracketing UI | E2E | R-006 | 3 | QA | Complex UI interaction |
| Favourites dropdown: header icon, grouped by groupName, navigate on click | E2E | R-009 | 2 | QA | Cross-entity navigation |
| Sort configuration: priority-numbered rules, drag reorder, direction toggle | E2E | - | 2 | QA | Sort tab in Filter & Sort modal |
| Save as New View: name/group/scope form, 409 duplicate name handling | E2E | - | 2 | QA | Including error state |
| Save Current View: overwrite in-place (only visible when named view loaded) | E2E | - | 1 | QA | Conditional button visibility |
| Active filter count badge on [Filter & Sort] button | E2E | - | 1 | QA | Badge updates on filter apply/clear |
| Date filter component: preset dropdown + custom date picker fallback | E2E | - | 2 | QA | "Custom" preset opens from/to pickers |
| Seed data validation: 20 date_range_presets + sample data_view + fields | Integration | - | 2 | Dev | Migration + seed script correctness |
| Redis cache: metadata cached, user data always fresh | Integration | R-011 | 2 | Dev | Cache-miss vs cache-hit paths |
| Column width/order persists to saved view vs user_column_preferences | Integration | - | 2 | Dev | Two persistence targets |

**Total P2**: ~19 tests, ~5-10 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| Column width persistence performance: <50ms per PATCH | Benchmark | 1 | Dev | Performance target from AC |
| Redis cache TTL expiry and re-population | Integration | 1 | Dev | Verify 1hr TTL behaviour |
| WCAG AA: keyboard navigation for modals, filter inputs, column reorder | E2E | 2 | QA | NFR27, NFR28 |
| Exploratory: cross-browser column resize + drag-drop | E2E | 1 | QA | Manual spot-check |

**Total P3**: ~5 tests, ~2-4 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if total execution <15 minutes; defer only expensive/long-running suites.

| Trigger | What Runs | Expected Duration |
| --- | --- | --- |
| **Every PR** | All unit tests (filter-builder, date presets) + integration tests (API endpoints, scope visibility, CRUD) + E2E tests (modals, views, filters) | ~8-12 min with Playwright parallelisation |
| **Nightly** | Benchmark tests (init endpoint <100ms, column width <50ms) + Redis TTL expiry tests | ~5-10 min |
| **On demand** | Cross-browser exploratory, WCAG AA audit | Manual |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | ~24 | 0.5-1.0 | ~12-20 | Filter-builder has high permutation count but tests are formulaic |
| P1 | ~36 | 0.5-0.75 | ~15-25 | Mix of integration (fast) and E2E (moderate setup) |
| P2 | ~19 | 0.25-0.5 | ~5-10 | Simpler scenarios, some UI-only |
| P3 | ~5 | 0.5 | ~2-4 | Benchmarks + exploratory |
| **Total** | **~84** | **-** | **~34-59** | **~1-1.5 weeks** |

### Prerequisites

**Test Data:**

- `dateRangePresetFactory` — seeds all 20 presets with company scoping
- `dataViewFactory` — creates data_view + data_view_fields for testing
- `savedViewFactory` — creates views with conditions, column config, sort config
- `userWithRoleFactory` — creates users with specific roles for scope tests

**Tooling:**

- Vitest for unit tests (filter-builder, date presets)
- Playwright for E2E tests (modals, views, filters)
- Supertest or Fastify inject for API integration tests
- Redis test instance for caching tests

**Environment:**

- PostgreSQL with E1-E7 migrations applied
- Redis for metadata caching
- Dev server running (Vite + Fastify)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (filter-builder)**: >=90% — all 14 FilterOperator values tested
- **Security scenarios (scope visibility)**: 100% — every scope+role combination
- **Business logic (default resolution)**: >=80% — all 4 fallback levels
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category — R-002 scope visibility) pass 100%
- [ ] Performance targets met (PERF category — R-003 init endpoint <100ms)

---

## Mitigation Plans

### R-001: Filter-to-Prisma converter incorrect WHERE clauses (Score: 6)

**Mitigation Strategy:**
1. Create parameterised unit test matrix: 14 operators x 6 field types = 84 combinations
2. Integration tests with real Prisma queries verifying actual SQL output
3. Specific tests for nested AND/OR group bracketing (3+ groups deep)
4. Edge cases: empty valueList for IN, null value for IS_EMPTY, BETWEEN with equal bounds

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** All 84 operator/type combinations pass; integration tests return correct filtered data

### R-002: Scope-based view visibility bypass (Score: 6)

**Mitigation Strategy:**
1. Integration tests: create PERSONAL view as User A, verify User B cannot read/list it
2. Integration tests: create ROLE view, verify only users with matching role see it
3. Negative tests: STAFF user attempts POST with scope=GLOBAL, expect 403
4. Test cascade: deleting a view removes it from all users' favourites/defaults

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** All scope+role matrix tests pass; no cross-user data leakage

### R-003: Bundled init endpoint exceeds 100ms target (Score: 6)

**Mitigation Strategy:**
1. Benchmark test: measure init endpoint with Redis cache-hit (target <50ms)
2. Benchmark test: measure init endpoint with Redis cache-miss (target <100ms)
3. Test with realistic payload: 50+ fields, 10+ saved views, 20 date presets
4. Verify Redis caching: second call should be significantly faster

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** p95 response time <100ms with cold cache, <50ms with warm cache

---

## Assumptions and Dependencies

### Assumptions

1. E6 Frontend Shell is complete and T1 Entity List template is available for E2E testing
2. TanStack Table v8+ with column sizing, pinning, and sorting APIs is the table library
3. dnd-kit is available for drag-and-drop (column reorder, sort rule reorder)
4. Redis is available in the test environment for caching tests
5. Filter-to-Prisma converter is a pure function that can be unit-tested without database

### Dependencies

1. E6 complete (T1 Entity List template, sidebar, app header) — Required before E7 frontend stories
2. Prisma schema with E7 models (6 tables) — Required before any E7 testing
3. Redis instance — Required for init endpoint caching tests

### Risks to Plan

- **Risk**: E6 delays push E7 backend work ahead of frontend
  - **Impact**: API tests can proceed but E2E tests blocked
  - **Contingency**: Start with E7.1 (backend-only), defer E7.2/E7.3 E2E tests

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **T1 Entity List Template (E6)** | E7 extends T1 with views toolbar, column customisation, filter panel | E6 template rendering tests must pass |
| **Auth/RBAC (E2/E2b)** | Scope-based visibility depends on user role resolution | E2b permission resolution tests must pass |
| **App Header (E6)** | Favourites dropdown added to header | E6 header rendering tests must pass |
| **Redis (E3)** | Metadata caching uses Redis | E3 Redis connection tests must pass |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: Mohammed Date: ________
- [ ] Tech Lead: ________ Date: ________
- [ ] QA Lead: ________ Date: ________

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/` (FR86, NFR2, NFR27, NFR28)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E7.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/` (§2.9 Saved Views, §5.2.1 T1 Template)
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/` (§3.13 Views Endpoints)
- Data Models: `_bmad-output/planning-artifacts/data-models/` (§3.1 System Module — 6 tables)
- UX Design Spec: `_bmad-output/planning-artifacts/ux-design-specification/` (T1 Entity List)
- Project Context: `_bmad-output/planning-artifacts/project-context.md` (§12, §13)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

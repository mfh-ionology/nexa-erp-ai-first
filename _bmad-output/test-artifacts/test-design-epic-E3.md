---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-21'
---

# Test Design: Epic E3 - Event Bus + Audit Trail

**Date:** 2026-02-21
**Author:** Mohammed
**Status:** Draft
**Mode:** Epic-Level (Phase 4)

---

## Executive Summary

**Scope:** Full test design for Epic E3 — Event Bus + Audit Trail

Epic E3 delivers three foundational infrastructure components: (1) a typed, in-process event bus for cross-module communication, (2) an immutable audit trail service for compliance, and (3) event persistence with retry and dead-letter queue for reliability. These are cross-cutting concerns that underpin every future business module.

**Risk Summary:**

- Total risks identified: 10
- High-priority risks (score >= 6): 4
- Critical categories: DATA (3), TECH (4)

**Coverage Summary:**

- P0 scenarios: 5 (~10-15 hours)
- P1 scenarios: 8 (~15-25 hours)
- P2 scenarios: 7 (~5-10 hours)
- P3 scenarios: 3 (~2-4 hours)
- **Total effort**: ~32-54 hours (~1-1.5 weeks)

> **Note:** P0/P1/P2/P3 = priority classification based on risk and criticality, NOT execution timing. See Execution Strategy for when tests run.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **UI testing** | E3 has no frontend components — all stories are backend infrastructure | UI tests will be added in epics that consume the event bus |
| **External message broker** | MVP uses in-process EventBus; Redis Streams/NATS is future scope | Event interface is designed for future swap; integration tests will cover broker when migrated |
| **BullMQ admin dashboard** | Dead-letter queue is queried via API, no UI for queue management | API endpoint tests cover query functionality |
| **Cross-tenant audit isolation** | Database-per-tenant architecture handles isolation at infrastructure level | Covered by E0/E1 tenant isolation tests (NFR9) |
| **Performance under production load** | E3 is infrastructure; load testing deferred to first business module (E7+) | Nightly performance benchmarks will be added when event volume increases |

---

## Risk Assessment

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | TECH | Event handler error isolation failure — error in one subscriber propagates to emitter or crashes other handlers | 2 | 3 | 6 | Wrap each handler in try/catch with structured error logging; test with intentionally throwing handlers | Dev | Sprint E3.1 |
| R-003 | DATA | Audit data completeness — missing or incorrect before/after JSONB snapshots, wrong entityType/entityId references | 2 | 3 | 6 | Validate audit entry structure in service layer; test with diverse event payloads including edge cases | Dev | Sprint E3.2 |
| R-004 | TECH | Dead-letter queue data loss — failed events not persisted to BullMQ due to connection or serialization issues | 2 | 3 | 6 | Implement fallback logging when BullMQ unavailable; test BullMQ connection failure scenarios | Dev | Sprint E3.3 |
| R-009 | DATA | Idempotency violation during dead-letter re-processing — duplicate financial transactions or audit entries | 2 | 3 | 6 | Enforce correlationId-based deduplication in handlers; test re-processing same event twice produces no duplicates | Dev | Sprint E3.3 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-005 | TECH | Handler deduplication failure — same handler registered twice, processing events multiple times | 2 | 2 | 4 | Track handlers by reference; test double-registration scenario | Dev |
| R-006 | PERF | Async handler blocking — handlers that block event loop during DB writes (especially audit) | 2 | 2 | 4 | Ensure all handlers use async/await; test concurrent handler execution timing | Dev |
| R-008 | TECH | Retry mechanism timing — exponential backoff not working correctly (wrong intervals, infinite loops) | 2 | 2 | 4 | Test exact retry intervals and max retry count boundary | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-002 | DATA | Audit immutability bypass — PostgreSQL rules bypassed via raw SQL or ORM operations | 1 | 3 | 3 | Test UPDATE/DELETE rejection at DB level |
| R-007 | SEC | Audit log access control — unauthorized users accessing sensitive audit data | 1 | 3 | 3 | RBAC already enforced; test role-based access on audit endpoints |
| R-010 | OPS | Redis unavailable during event failure — can't persist to dead-letter queue | 1 | 2 | 2 | Monitor; fallback to structured logging |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E2 (RBAC & Permissions) complete — event emitter singleton exists
- [ ] PostgreSQL test database provisioned with Prisma migrations
- [ ] BullMQ/Redis available in test environment (for E3.3)
- [ ] Vitest test framework configured (already done)
- [ ] Prisma schema updated with AuditLog model and migration applied

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] PostgreSQL immutability rules verified at DB level
- [ ] Event bus error isolation confirmed under concurrent handler execution
- [ ] Dead-letter queue persistence confirmed after max retries

---

## Test Coverage Plan

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (>= 6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E3.1-UNIT-001 | Event emission invokes all typed subscribers with correct payload | Unit | R-001 | Core event bus contract |
| E3.1-UNIT-002 | Error in one handler does not affect emitter or other subscribers | Unit | R-001 | Error isolation — critical for system stability |
| E3.2-INT-001 | Business event creates complete AuditLog record (all fields populated correctly) | Integration | R-003 | Verify entityType, entityId, action, beforeData, afterData, userId, timestamp, correlationId |
| E3.2-INT-002 | UPDATE and DELETE on audit_log table rejected by PostgreSQL rules | Integration | R-002 | DB-level immutability enforcement (NFR39) |
| E3.3-INT-001 | Event persisted to dead-letter queue after 3 failed retries | Integration | R-004 | Verify payload, error details, retry count in BullMQ |

**Total P0**: 5 tests, ~10-15 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E3.1-UNIT-003 | Handlers execute asynchronously (do not block emitter) | Unit | R-006 | Verify emit() returns before handlers complete |
| E3.1-UNIT-004 | Same handler registered twice is only invoked once per event | Unit | R-005 | Deduplication by reference |
| E3.2-INT-003 | GET /system/audit-log returns filtered, cursor-paginated results | Integration | R-007 | Test entityType, entityId, action, userId, dateRange filters |
| E3.2-INT-004 | GET /system/audit-log/:entityType/:entityId returns chronological entity history | Integration | R-007 | Verify ordering and completeness |
| E3.2-INT-005 | AI-initiated actions logged with isAiAction=true and aiConfidence score | Integration | R-003 | Verify AI-specific audit fields |
| E3.3-UNIT-001 | Retry with exponential backoff: intervals are 1s, 2s, 4s | Unit | R-008 | Test exact timing and max retry boundary |
| E3.3-INT-002 | Dead-letter item re-processed via POST /system/dead-letter-queue/:id/reprocess | Integration | R-009 | Verify event re-emitted through EventBus |
| E3.3-INT-003 | Re-processing same event twice produces no duplicate side effects | Integration | R-009 | Idempotency via correlationId |

**Total P1**: 8 tests, ~15-25 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E3.1-UNIT-005 | Event names follow {entity}.{action} naming convention with past tense | Unit | - | Convention enforcement |
| E3.1-INT-001 | EventBus registered as Fastify decorator (fastify.eventBus accessible) | Integration | - | Plugin integration |
| E3.2-INT-006 | Audit log ADMIN role restriction enforced (non-admin gets 403) | Integration | R-007 | RBAC enforcement |
| E3.2-INT-007 | Audit query cursor pagination with limit and afterCursor | Integration | - | Pagination edge cases |
| E3.2-INT-008 | Date range filtering returns only records within range | Integration | - | Boundary condition testing |
| E3.3-INT-004 | GET /system/dead-letter-queue returns failed events with metadata | Integration | - | Query API correctness |
| E3.3-UNIT-002 | Correlation ID propagated from event to audit log to dead-letter | Unit | - | End-to-end tracing |

**Total P2**: 7 tests, ~5-10 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| E3.1-UNIT-006 | Multiple subscribers execute in registration order | Unit | Ordering guarantee |
| E3.2-PERF-001 | Audit log creation performance under concurrent event burst (100 events) | Integration | Benchmark, not gate criteria |
| E3.1-UNIT-007 | Edge cases: empty payloads, very large JSONB data in events | Unit | Robustness testing |

**Total P3**: 3 tests, ~2-4 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive/long-running. With Vitest, the full E3 test suite should execute in <2 minutes.

| Cadence | What Runs | Estimated Duration |
|---------|-----------|-------------------|
| **Every PR** | All unit tests (E3.1-UNIT-*, E3.3-UNIT-*) + all integration tests (E3.2-INT-*, E3.3-INT-*) | ~1-2 min |
| **Nightly** | Performance benchmark (E3.2-PERF-001) | ~5 min |

No complex tier structure needed — the full suite is fast enough to run on every PR.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | 5 | ~10-15 hours | Complex setup: DB rules, BullMQ, error injection |
| P1 | 8 | ~15-25 hours | Moderate: API tests, timing verification, idempotency |
| P2 | 7 | ~5-10 hours | Standard: filters, pagination, role checks |
| P3 | 3 | ~2-4 hours | Simple: edge cases, benchmarks |
| **Total** | **23** | **~32-54 hours** | **~1-1.5 weeks** |

### Prerequisites

**Test Data:**

- Event payload factory functions (typed per BusinessEvents interface)
- AuditLog record factory (for query tests)
- User factory with ADMIN role (for audit endpoint tests)

**Tooling:**

- Vitest (already configured)
- Prisma test database with AuditLog migration
- BullMQ test connection (Redis) for E3.3
- `vi.useFakeTimers()` for exponential backoff timing tests

**Environment:**

- PostgreSQL with audit_log table and immutability rules applied
- Redis instance for BullMQ dead-letter queue
- Fastify test app with EventBus plugin registered

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Event bus core** (emit, subscribe, error isolation): 100%
- **Audit trail immutability**: 100% (compliance requirement)
- **Dead-letter persistence**: >= 80%
- **API endpoints**: >= 80%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>= 6) items unmitigated
- [ ] Audit immutability verified at PostgreSQL level (NFR39)
- [ ] Error isolation confirmed — handler failure does not crash emitter

---

## Mitigation Plans

### R-001: Event Handler Error Isolation Failure (Score: 6)

**Mitigation Strategy:**
1. Wrap each handler invocation in individual try/catch blocks within EventBus.emit()
2. Log errors with structured format (handler name, event name, error stack)
3. Verify through tests: emit event with 3 handlers where handler 2 throws — handlers 1 and 3 must still execute

**Owner:** Dev
**Timeline:** Sprint E3.1
**Status:** Planned
**Verification:** E3.1-UNIT-002 passes — error in handler does not propagate

### R-003: Audit Data Completeness (Score: 6)

**Mitigation Strategy:**
1. Validate all required fields (entityType, entityId, action, userId, timestamp) in AuditService.log()
2. Test with diverse event types: CREATE, UPDATE, DELETE, APPROVE, POST
3. Verify beforeData/afterData JSONB serialization handles nested objects, arrays, null values

**Owner:** Dev
**Timeline:** Sprint E3.2
**Status:** Planned
**Verification:** E3.2-INT-001 passes — all audit fields correctly populated

### R-004: Dead-Letter Queue Data Loss (Score: 6)

**Mitigation Strategy:**
1. Implement structured error logging as fallback when BullMQ connection fails
2. Test BullMQ disconnection scenario — verify event details logged to stderr
3. Verify dead-letter entry contains: eventName, full payload, error message, retry count, original timestamp

**Owner:** Dev
**Timeline:** Sprint E3.3
**Status:** Planned
**Verification:** E3.3-INT-001 passes — dead-letter entry created with complete data

### R-009: Idempotency Violation During Re-Processing (Score: 6)

**Mitigation Strategy:**
1. Implement correlationId-based deduplication in event handlers
2. Create idempotency helper utility that checks if correlationId already processed
3. Test: re-process same dead-letter event twice — verify only one audit record created

**Owner:** Dev
**Timeline:** Sprint E3.3
**Status:** Planned
**Verification:** E3.3-INT-003 passes — no duplicate side effects on re-processing

---

## Assumptions and Dependencies

### Assumptions

1. PostgreSQL `CREATE RULE` syntax is supported and enforced in the test database
2. BullMQ/Redis is available in the test environment (local Docker or CI service)
3. The existing `event-emitter.ts` singleton will be refactored/replaced by E3.1's EventBus class
4. Fastify decorator pattern for event bus follows established patterns from E0/E1

### Dependencies

1. E2 (RBAC & Permissions) complete — required for audit endpoint role checks
2. Prisma AuditLog migration — required before E3.2 tests can run
3. Redis/BullMQ — required for E3.3 dead-letter queue tests
4. `apps/api/src/core/events/event-emitter.ts` — existing file to be refactored

### Risks to Plan

- **Risk**: BullMQ not available in CI environment
  - **Impact**: E3.3 tests cannot run in CI
  - **Contingency**: Use Redis service in CI (GitHub Actions supports `services:` block), or mock BullMQ for unit tests

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **Event Emitter (E2)** | E3.1 refactors existing event-emitter.ts into full EventBus | Run E2 permission-cache-listeners tests to verify backward compatibility |
| **RBAC Guards (E2)** | Audit endpoints use ADMIN role restriction | Run RBAC integration tests to verify guard behavior unchanged |
| **Prisma Client (E0)** | AuditLog model added to schema | Run existing Prisma-dependent tests to verify no schema drift |
| **Fastify App (E1)** | EventBus registered as Fastify decorator | Run app startup tests to verify plugin registration order |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (score >= 6 demands mitigation)
- `probability-impact.md` — Probability (1-3) x Impact (1-3) scoring methodology
- `test-levels-framework.md` — Unit/Integration/E2E selection criteria
- `test-priorities-matrix.md` — P0-P3 prioritization rules

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/` (FR85, FR92, NFR14, NFR22, NFR39, NFR40)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E3.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md` (sections 2.6, 4.2)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md`
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (IMP-003, BR-SYS-013, BR-SYS-014)
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md` (audit-log endpoints)

### Test Framework

- **Framework**: Vitest v4.0.18
- **Config**: `apps/api/vitest.config.ts`
- **Patterns**: Colocated tests (`*.test.ts`), integration tests (`*.integration.test.ts`), vi.hoisted mocks, factory functions
- **Existing event test example**: `apps/api/src/core/rbac/permission-cache-listeners.test.ts`

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)

---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-04'
---

# Test Design: Epic E11 - Cross-cutting Tasks

**Date:** 2026-03-04
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E11 — Cross-cutting Tasks (3 stories: E11.1 Task Service Backend, E11.2 Task UI Frontend, E11.3 Task Notifications)

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (>=6): 3 (cross-company leakage, terminal state bypass, RBAC visibility gap)
- Critical categories: SEC (2), DATA (3), TECH (4)

**Coverage Summary:**

- P0 scenarios: 10 (~15-25 hours)
- P1 scenarios: 14 (~15-25 hours)
- P2/P3 scenarios: 12 (~7-14 hours)
- **Total effort**: ~37-64 hours (~1-1.5 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Activity model integration** | Activity (CRM) and Task are separate entities; no E11 requirement to unify them | If overlap needed in future, a separate epic can merge Activity TODO and Task |
| **Mobile push notifications** | E9 only covers in-app (WebSocket) and email; push channel is post-MVP | In-app + email channels cover core notification needs for E11 |
| **AI-generated task suggestions** | E5b Co-Pilot may suggest tasks in future, but no E11 requirement | Tasks can be created manually; AI integration deferred to future epic |
| **External calendar sync** | No FR for syncing task due dates with external calendars | Users can manually track due dates; calendar integration deferred |

---

## Risk Assessment

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | Cross-company task leakage — missing companyId filter on task queries exposes tasks from other tenants | 2 | 3 | 6 | Enforce companyId in all task service queries; integration test with multi-tenant fixture | Dev | E11.1 |
| R-002 | DATA | Terminal state bypass — COMPLETED/CANCELLED status allows further transitions; data integrity violation | 2 | 3 | 6 | Guard function in task.service.ts rejects transitions from terminal states; unit + API tests | Dev | E11.1 |
| R-003 | SEC | RBAC visibility gap — VIEWER role can access tasks they are not assigned to; /tasks/my endpoint returns other users' tasks | 2 | 3 | 6 | Enforce assignee-based filtering in /tasks/my; role-based query scoping in list endpoint | Dev | E11.1 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-004 | TECH | Polymorphic entity validation — invalid entityType/entityId combinations accepted without validation | 2 | 2 | 4 | Validate entityType against known model types; log warning for unresolvable entityId | Dev |
| R-005 | TECH | Notification integration failure — E9 event handler not triggered on task events | 2 | 2 | 4 | Integration test verifying event emission → notification dispatch pipeline | Dev |
| R-006 | DATA | Overdue detection deduplication — BullMQ cron re-notifies same task daily without dedup logic | 2 | 2 | 4 | Track lastOverdueNotifiedAt on Task; skip if already notified within 24h | Dev |
| R-007 | TECH | Status cycle UI desync — optimistic cycleStatus update rejected by server; UI shows incorrect state | 2 | 2 | 4 | Invalidate query cache on mutation error; show toast with corrected state | Dev |
| R-008 | BUS | Batch action partial failure — "Complete All" fails midway; some tasks completed, others not | 2 | 2 | 4 | Use Promise.allSettled; report partial results; allow retry of failed items | Dev |
| R-009 | PERF | Task list query performance — multi-filter /tasks endpoint exceeds NFR2 500ms p95 target | 2 | 2 | 4 | Add composite index on (companyId, status, priority, dueDate); benchmark with 1000+ tasks | Dev |
| R-012 | BUS | Notification preference override — task notifications sent despite user disabling task category | 2 | 2 | 4 | Check NotificationPreference before dispatch; integration test with disabled prefs | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-010 | DATA | Orphaned tasks on entity deletion — linked tasks show broken entity reference | 1 | 2 | 2 | Monitor |
| R-011 | TECH | Task Panel duplicate API calls — multiple panels on one page fire independent queries | 1 | 1 | 1 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E9 (Notifications) epic completed — notification dispatch service available
- [ ] E3 (Event Bus + Audit Trail) — event emission infrastructure ready
- [ ] E7 (Saved Views) — T1 EntityListPage infrastructure available for My Tasks page
- [ ] E8 (Attachments/Notes/Record Links) — polymorphic entity linking pattern established
- [ ] Task + TaskAssignee Prisma models migrated and seed data available
- [ ] Test environment provisioned with multi-company fixtures (at least 2 companies)
- [ ] v0 reference components committed to `v0-nexa-design/components/tasks/`

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%)
- [ ] No open high-priority / high-severity bugs
- [ ] R-001, R-002, R-003 mitigations verified by tests
- [ ] Task CRUD < 500ms p95 (NFR2) confirmed by benchmark
- [ ] Concept D visual fidelity verified for My Tasks page and Task Panel

---

## Test Coverage Plan

**Note:** P0/P1/P2/P3 indicate risk-based priority, NOT execution timing. See Execution Strategy for timing.

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (>=6) + No workaround

| # | Requirement | Test Level | Risk Link | Story | Notes |
|---|-------------|-----------|-----------|-------|-------|
| 1 | Task queries enforce companyId scoping — no cross-tenant leakage | API | R-001 | E11.1 | Create tasks in Company A + B; query from B must not see A's tasks |
| 2 | Terminal states (COMPLETED, CANCELLED) reject further status changes | API | R-002 | E11.1 | PATCH /tasks/:id/status from COMPLETED → OPEN returns 400 |
| 3 | `/tasks/my` returns only current user's assigned tasks | API | R-003 | E11.1 | User A assigned to task X; user B must not see task X via /my |
| 4 | Task CRUD happy path: create, read, update, status transition, delete | API | - | E11.1 | Full lifecycle with valid data |
| 5 | Valid status transitions enforced: OPEN→IN_PROGRESS→COMPLETED, OPEN→COMPLETED, any→CANCELLED | API | R-002 | E11.1 | Matrix of all valid/invalid transitions |
| 6 | Task creation emits `task.assigned` event for each assignee | API | R-005 | E11.1 | Verify event bus receives event with correct payload |
| 7 | Status change to COMPLETED sets `completedAt` and emits `task.status_changed` | API | R-002 | E11.1 | Verify timestamp and event emission |
| 8 | Entity-scoped query: `/tasks?entityType=X&entityId=Y` returns only linked tasks | API | R-004 | E11.1 | Filter by specific entity; unlinked tasks excluded |
| 9 | Notification dispatched on `task.assigned` event (respecting user preferences) | API | R-005, R-012 | E11.3 | Verify E9 dispatch triggered; verify disabled pref skips channel |
| 10 | Overdue detection cron: tasks with dueDate < now() and non-terminal status flagged | API | R-006 | E11.3 | Seed overdue tasks; verify cron identifies them; verify dedup |

**Total P0**: 10 tests (~15-25 hours)

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| # | Requirement | Test Level | Risk Link | Story | Notes |
|---|-------------|-----------|-----------|-------|-------|
| 1 | Multi-assignee: add/remove assignees, unique constraint on [taskId, userId] | API | - | E11.1 | Duplicate assignee returns 409 |
| 2 | Task list filtering: status, priority, overdue, search text | API | R-009 | E11.1 | Each filter individually + combined |
| 3 | Delete task: STAFF+ if creator, MANAGER+ otherwise | API | R-003 | E11.1 | Role-based deletion guard |
| 4 | Zod request validation: reject invalid payloads with structured error | API | - | E11.1 | Missing title, invalid enum, etc. |
| 5 | Audit trail logging for task CRUD and status transitions | API | - | E11.1 | Verify AuditLog records created |
| 6 | My Tasks page loads with T1 template, status tabs, search, filters | E2E | - | E11.2 | Page structure and interactive elements |
| 7 | Create Task Dialog: title required, priority/due/assignees/entity fields | E2E | - | E11.2 | Form validation and successful creation |
| 8 | Task Detail Sheet: slide-in with full info, inline edit, status actions | E2E | - | E11.2 | Sheet opens, displays data, allows edits |
| 9 | Task Panel embedded in record detail page with entity-scoped tasks | E2E | - | E11.2 | Panel renders with correct filtered tasks |
| 10 | Status cycling via TaskStatusIcon click (Open→In Progress→Completed) | E2E | R-007 | E11.2 | Optimistic update; verify server sync |
| 11 | Tasks Today dashboard card shows due + overdue tasks from API | E2E | - | E11.2 | Dashboard integration with real data |
| 12 | Notification on COMPLETED status: creator + all assignees notified | API | R-005 | E11.3 | Multi-target notification dispatch |
| 13 | Overdue notification deduplication: don't re-notify same task within 24h | API | R-006 | E11.3 | Run cron twice; second run skips already-notified |
| 14 | Notification preference respect: disabled task category skips channel | API | R-012 | E11.3 | User with task notifications disabled gets no notification |

**Total P1**: 14 tests (~15-25 hours)

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| # | Requirement | Test Level | Risk Link | Story | Notes |
|---|-------------|-----------|-----------|-------|-------|
| 1 | Invalid entityType/entityId combination logged as warning | Unit | R-004 | E11.1 | Validation utility |
| 2 | Batch actions: Complete All, Reassign, Cancel with partial failure | E2E | R-008 | E11.2 | One task fails; others succeed; toast shows result |
| 3 | Responsive: desktop table, tablet hides Assignees, phone card layout | E2E | - | E11.2 | Three viewport widths |
| 4 | Create Task with entity pre-filled from record detail page | E2E | - | E11.2 | Entity chip read-only |
| 5 | Orphaned entity link: task shows graceful fallback when source deleted | E2E | R-010 | E11.2 | Broken link renders safely |
| 6 | Task Panel "+ Add Task" with entityType/entityId pre-filled | E2E | - | E11.2 | Embedded creation flow |
| 7 | i18n: all strings use t() calls under tasks.* namespace | Unit | - | E11.2 | No hardcoded English strings |
| 8 | Overdue task visual styling: red indicator + warning icon | E2E | - | E11.2 | Visual fidelity check |

**Total P2**: 8 tests (~5-10 hours)

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| # | Requirement | Test Level | Risk Link | Story | Notes |
|---|-------------|-----------|-----------|-------|-------|
| 1 | Task list query performance: 1000+ tasks < 500ms p95 | API | R-009 | E11.1 | NFR2 benchmark |
| 2 | Concept D visual fidelity: card radius, purple theme, typography | E2E | - | E11.2 | Visual regression |
| 3 | Keyboard navigation: tab through task list, enter to open detail | E2E | - | E11.2 | WCAG 2.1 AA |
| 4 | Multi-tab sync: status change in tab A reflected in tab B via WebSocket | E2E | - | E11.2 | Real-time consistency |

**Total P3**: 4 tests (~2-4 hours)

---

## Execution Strategy

- **Every PR** (<15 min): All P0 + P1 functional tests (API + E2E) with Playwright parallelization
- **Nightly**: P2 tests (responsive, edge cases, i18n validation)
- **Weekly/On-demand**: P3 benchmarks and exploratory tests

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | 10 | ~15-25 hours | API tests with multi-tenant fixtures |
| P1 | 14 | ~15-25 hours | Mix of API and E2E; some leverage E9 fixtures |
| P2 | 8 | ~5-10 hours | Mostly E2E visual/responsive checks |
| P3 | 4 | ~2-4 hours | Benchmarks and exploratory |
| **Total** | **36** | **~37-64 hours** | **~1-1.5 weeks** |

### Prerequisites

**Test Data:**

- Multi-company fixture with at least 2 companies and 3+ users per company
- Task factory with configurable: status, priority, dueDate, entityType/entityId, assignees
- Notification preference fixture with task category enabled/disabled variants

**Tooling:**

- Vitest for unit/API integration tests
- Playwright for E2E tests with Concept D visual assertions
- BullMQ test helper for cron job assertions

**Environment:**

- PostgreSQL with Task + TaskAssignee tables migrated
- E9 notification service running (or mocked for isolated backend tests)
- v0 reference components committed for frontend visual comparison

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: R-001, R-002, R-003 must have passing tests

### Coverage Targets

- **Critical paths** (CRUD, status transitions, scoping): >=80%
- **Security scenarios** (multi-tenant, RBAC): 100%
- **Business logic** (status machine, overdue, notifications): >=70%
- **Edge cases** (orphaned links, batch failures): >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] SEC category tests (R-001, R-003) pass 100%
- [ ] Task CRUD performance meets NFR2 (<500ms p95)

---

## Mitigation Plans

### R-001: Cross-Company Task Leakage (Score: 6)

**Mitigation Strategy:**
1. Enforce companyId WHERE clause in all task.service.ts query methods
2. Add companyId extraction from request context (matching existing pattern from E2)
3. Integration test: create tasks in Company A, query from Company B context, assert zero results

**Owner:** Dev
**Timeline:** E11.1 Story
**Status:** Planned
**Verification:** P0 test #1 passes with multi-tenant fixture

### R-002: Terminal State Bypass (Score: 6)

**Mitigation Strategy:**
1. Add guard function `assertTransitionAllowed(currentStatus, newStatus)` in task.service.ts
2. Define TERMINAL_STATES = ['COMPLETED', 'CANCELLED'] constant
3. Return 400 with structured error if transition from terminal state attempted
4. Unit test for guard function + API test for endpoint rejection

**Owner:** Dev
**Timeline:** E11.1 Story
**Status:** Planned
**Verification:** P0 tests #2 and #5 pass with full transition matrix

### R-003: RBAC Visibility Gap (Score: 6)

**Mitigation Strategy:**
1. `/tasks/my` endpoint: filter by TaskAssignee join where userId = currentUser
2. `/tasks` list endpoint: VIEWER sees only assigned; STAFF sees assigned + created; MANAGER/ADMIN sees all company tasks
3. Delete endpoint: check creator === currentUser for STAFF; MANAGER+ can delete any

**Owner:** Dev
**Timeline:** E11.1 Story
**Status:** Planned
**Verification:** P0 test #3 and P1 test #3 pass with multi-role fixtures

---

## Assumptions and Dependencies

### Assumptions

1. E9 notification dispatch service is operational and tested before E11.3 begins
2. Task + TaskAssignee Prisma models follow the same polymorphic pattern as Attachment/Note/RecordLink from E8
3. BullMQ infrastructure from E3 is available for overdue detection cron job
4. v0 reference components will be committed before E11.2 frontend implementation starts

### Dependencies

1. E9 Notifications — notification dispatch, preference system — Required before E11.3
2. E3 Event Bus — event emission infrastructure — Required before E11.1 event tests
3. E7 Saved Views — T1 EntityListPage template — Required before E11.2 My Tasks page
4. E8 Polymorphic pattern — entity linking reference implementation — Required before E11.1

### Risks to Plan

- **Risk**: E9 notification infrastructure incomplete when E11.3 starts
  - **Impact**: Cannot test notification dispatch end-to-end
  - **Contingency**: Mock notification service; defer integration tests to post-E9 completion

- **Risk**: v0 reference components not committed when E11.2 starts
  - **Impact**: Frontend visual fidelity targets unclear
  - **Contingency**: Use epic page inventory wireframes as interim reference

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|-----------------|
| **E9 Notification Service** | Task events trigger notification dispatch | Existing notification delivery tests must pass; new task event handlers added |
| **E3 Event Bus** | Task events emitted via event bus | Event emission tests from E3 must continue passing |
| **E7 Saved Views** | My Tasks page uses T1 EntityListPage with saved views | Existing saved view tests must pass; new Task data view registered |
| **E8 Record Links** | Polymorphic entity linking pattern shared | Existing record link tests must pass; Task follows same pattern |
| **Dashboard (E6)** | Tasks Today card wired to real API | Existing dashboard render tests must pass; card now shows live data |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: FR181-FR183 (Task requirements)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E11.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/`
- Pre-Epic Design: `_bmad-output/implementation-artifacts/pre-epic-designs/epic-E11-page-inventory.md`
- v0 Reference: `v0-nexa-design/components/tasks/` (5 files)

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

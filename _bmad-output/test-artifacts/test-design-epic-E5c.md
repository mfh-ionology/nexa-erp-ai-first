---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-03-03'
---

# Test Design: Epic E5c - AI Administration & Autonomous Workflows

**Date:** 2026-03-03
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E5c (6 stories: automation engine, prompt variables, admin UI x4)

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (score 6+): 4
- Critical categories: TECH (automation engine complexity), SEC (arbitrary code execution in expressions), DATA (cascading automation failures), PERF (long-running agent execution)

**Coverage Summary:**

- P0 scenarios: ~18 (~25-40 hours)
- P1 scenarios: ~22 (~20-35 hours)
- P2 scenarios: ~15 (~10-20 hours)
- P3 scenarios: ~8 (~2-5 hours)
- **Total effort**: ~55-100 hours (~1.5-3 weeks)

> **Note:** P0/P1/P2/P3 designations indicate priority/risk level, NOT execution timing. See Execution Strategy for timing.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **LLM provider integration testing** | Actual calls to Claude/OpenAI APIs are external dependencies; E5 already tested the AI Gateway integration | Mock AI responses at the gateway boundary; integration tests use deterministic stubs |
| **E5b dynamic context assembler internals** | Already tested in E5b; E5c consumes it via documented AUTONOMOUS mode interface | Verify correct mode flag is passed; trust E5b's existing test coverage |
| **Mobile-specific UI layouts** | E5c admin screens are desktop-primary; mobile adaptation deferred per UX spec | Admin UI is responsive but not a separate mobile app; basic responsive checks in P2 |
| **Multi-tenant isolation for automation runs** | companyId scoping is a cross-cutting concern tested in E0/E1 | Verify companyId is passed to all automation queries; rely on E0/E1 isolation tests |
| **Email/push notification delivery** | Notification infrastructure is a separate concern (E6/platform) | Verify notification config is stored and passed to notification service; mock delivery |

---

## Risk Assessment

### High-Priority Risks (Score 6+)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | TECH | Circular chain detection may miss edge cases (deeply nested chains, concurrent modifications) leading to infinite automation loops | 2 | 3 | 6 | Graph traversal with depth-first search and visited-set tracking; max depth 10 hardcoded; concurrent modification guard via DB-level unique constraint on chain relationships | Dev | Sprint 0 |
| R-002 | SEC | Expression evaluator (`{{today - 30 days}}`) could be exploited for arbitrary code execution if not sandboxed | 2 | 3 | 6 | Whitelist-only expression language (date arithmetic, string ops, basic math); no eval()/Function(); reject unknown operators; fuzz test expression parser | Dev + Security | Sprint 0 |
| R-003 | DATA | Cascading automation failures: automation A fails, chains to B which uses A's output, causing data corruption or silent data loss | 2 | 3 | 6 | Chain execution halts on failure by default; failed step output is null/empty (never propagated as valid data); circuit breaker pauses after 3 consecutive failures | Dev | Story E5c.1 |
| R-004 | PERF | Long-running autonomous agent steps exceed maxTurns/maxDuration but consume tokens before being cancelled, exhausting token budget | 2 | 3 | 6 | Token budget check before each agent turn; hard timeout at maxDurationMs; step-level token tracking with early termination; circuit breaker for repeated budget overruns | Dev | Story E5c.1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-005 | TECH | Cron schedule timezone handling produces incorrect nextRunAt calculations across DST transitions | 2 | 2 | 4 | Use well-tested cron library (cron-parser/croner) with IANA timezone support; test DST transitions explicitly | Dev |
| R-006 | DATA | Prompt variable resolution with DB_QUERY source could return stale data if caching is applied | 1 | 3 | 3 | Variables are resolved fresh on each execution (no caching for DB sources); document this behaviour | Dev |
| R-007 | BUS | Admin disables a model that is actively assigned to running automations, causing mid-execution failures | 2 | 2 | 4 | Soft-disable check: warn admin if model is in use by active automations; prevent hard-delete of in-use models | Dev |
| R-008 | OPS | Scheduler service restart loses track of in-flight automation runs, leaving them in RUNNING state permanently | 2 | 2 | 4 | Startup recovery job: find RUNNING automations older than maxDurationMs and mark as FAILED with error "interrupted by restart" | Dev |
| R-009 | TECH | Nested required parameter validation for deeply nested JSON schemas (3+ levels) may not traverse correctly | 2 | 2 | 4 | Recursive schema walker with depth limit; comprehensive unit tests for nested schemas (arrays of objects with required fields) | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-010 | BUS | Prompt version restore creates unexpected behaviour if the restored version references variables that no longer exist | 1 | 2 | 2 | Monitor |
| R-011 | OPS | Automation run history grows unbounded, degrading query performance over time | 1 | 2 | 2 | Monitor; add pagination and date-range indexes (already in schema) |
| R-012 | TECH | Drag-reorder in automation step builder loses step order on rapid interactions | 1 | 1 | 1 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E5 (AI Orchestration) tables and services deployed and tested
- [x] E5b (AI Co-Pilot Intelligence) dynamic context assembler available
- [x] E6 (Frontend Shell) sidebar, routing, and layout components available
- [x] 6 new Prisma models created and migration applied successfully
- [x] API endpoints for automation CRUD operational
- [x] Test database seeded with AI models, prompts, agents, and skills from E5/E5b

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] Circular chain detection validated with graph cycle tests
- [ ] Parameter validation tested for nested schemas
- [ ] Circuit breaker logic tested (3 consecutive failures)
- [ ] Expression evaluator fuzz-tested for injection
- [ ] All admin UI pages match Concept D visual design

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical) - Blocks core functionality + High risk + No workaround

**Criteria**: Core automation engine correctness, security boundaries, data integrity

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E5c.1-UNIT-001 | Circular chain detection rejects A→B→C→A cycles | Unit | R-001 | Graph traversal validation; test max depth 10 |
| E5c.1-UNIT-002 | Circular chain detection rejects self-referencing (A→A) | Unit | R-001 | Direct self-reference edge case |
| E5c.1-UNIT-003 | Circular chain detection allows valid linear chains (A→B→C) | Unit | R-001 | Valid case must not be blocked |
| E5c.1-UNIT-004 | Required parameter validation blocks execution when required params missing | Unit | R-009 | Top-level required fields from inputSchema |
| E5c.1-UNIT-005 | Nested required parameter validation blocks for missing array item fields | Unit | R-009 | `lines[].quantity`, `conditions[].operator` |
| E5c.1-UNIT-006 | Batch parameter gathering collects ALL missing params in one prompt | Unit | R-009 | Not one-at-a-time |
| E5c.1-UNIT-007 | AUTONOMOUS mode fails step with UNRESOLVABLE_REQUIRED_PARAM error | Unit | R-003 | Step must never proceed with partial data |
| E5c.1-INT-001 | Sequential step execution pipes output from step N to step N+1 | API | R-003 | End-to-end step chaining |
| E5c.1-INT-002 | Failed step halts chain — no downstream steps execute | API | R-003 | Cascading failure prevention |
| E5c.1-INT-003 | Automation run creates immutable records (run + step runs) | API | R-003 | Append-only, no updates/deletes |
| E5c.1-INT-004 | Circuit breaker auto-pauses after 3 consecutive failures | API | R-003 | Verify isActive=false + notification |
| E5c.1-INT-005 | Token budget enforcement cancels remaining steps when exceeded | API | R-004 | Budget check before each turn |
| E5c.2-UNIT-001 | Expression evaluator rejects code injection attempts | Unit | R-002 | Fuzz with `eval()`, `require()`, `process.exit()`, backticks |
| E5c.2-UNIT-002 | Expression evaluator handles date arithmetic correctly | Unit | R-002 | `today - 30 days`, `today + 1 week` |
| E5c.2-UNIT-003 | DB_FIELD variable resolution with companyId scoping | Unit | R-006 | Must scope by company, not return cross-tenant data |
| E5c.2-UNIT-004 | Unresolvable variable produces safe fallback `[unknown: varName]` | Unit | R-006 | No crash, log warning |
| E5c.1-INT-006 | Chain next automation triggers on completion with correct output | API | R-001 | Chaining I/O validation |
| E5c.1-INT-007 | Automation CRUD API validates and rejects circular chains (422) | API | R-001 | Save-time validation |

**Total P0**: ~18 tests, ~25-40 hours

### P1 (High) - Important features + Medium risk + Common workflows

**Criteria**: Scheduler correctness, admin UI CRUD operations, prompt management

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E5c.1-INT-008 | Scheduled automation executes at correct time in configured timezone | API | R-005 | Cron + timezone validation |
| E5c.1-INT-009 | Event-triggered automation fires on matching event with payload | API | - | Event bus integration |
| E5c.1-INT-010 | Manual "Run Now" executes immediately and returns run ID | API | - | Manual trigger path |
| E5c.1-INT-011 | Automation CRUD (create, read, update, delete) with proper validation | API | - | Standard REST operations |
| E5c.1-INT-012 | Automation run query with pagination, date/status filters returns <500ms | API | R-011 | NFR2 compliance |
| E5c.2-UNIT-005 | DB_QUERY variable resolution executes parameterised query safely | Unit | R-006 | No SQL injection |
| E5c.2-UNIT-006 | PAGE_FIELD variable resolution from frontend state | Unit | - | Chat-context prompts |
| E5c.2-UNIT-007 | SYSTEM variable resolution (today, currentUser, company) | Unit | - | Built-in variables |
| E5c.2-UNIT-008 | PREVIOUS_STEP variable resolution from automation output | Unit | - | Step chaining variables |
| E5c.3-E2E-001 | AI Dashboard renders cards with correct metrics | E2E | - | Model count, agent count, token usage |
| E5c.3-E2E-002 | Model Registry CRUD: add, edit, toggle active/default | E2E | R-007 | Verify warning on disable in-use model |
| E5c.3-E2E-003 | Prompt editor: edit system prompt, save creates new version | E2E | - | Version append-only |
| E5c.3-E2E-004 | Prompt version history: view diff, restore previous version | E2E | R-010 | Restore creates new version |
| E5c.4-E2E-001 | Agent configuration: assign model, prompt, tools; save | E2E | - | Full agent CRUD |
| E5c.4-E2E-002 | Skill Pack Manager: view grouped by module, toggle activation | E2E | - | Accordion layout |
| E5c.4-E2E-003 | Test Trigger panel: type phrase, see matched skill + confidence | E2E | - | L0→L1→L2 routing simulation |
| E5c.5-E2E-001 | Automation Builder: create with schedule, add steps, save | E2E | - | Full create workflow |
| E5c.5-E2E-002 | Step builder: add, reorder (drag), configure agent/goal/I-O | E2E | R-012 | dnd-kit interaction |
| E5c.6-E2E-001 | Automation Runs list: status badges, filters, pagination | E2E | - | <500ms load |
| E5c.6-E2E-002 | Run detail: step timeline, expandable details, error info | E2E | - | Drill-down view |
| E5c.6-E2E-003 | Retry from failed step creates new run linked to original | E2E | - | Retry flow |
| E5c.1-UNIT-008 | Cron expression parser handles DST transitions correctly | Unit | R-005 | Spring-forward / fall-back |

**Total P1**: ~22 tests, ~20-35 hours

### P2 (Medium) - Secondary features + Low risk + Edge cases

**Criteria**: UI polish, variable autocomplete, notification config, edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E5c.3-E2E-005 | Variable autocomplete triggers on `{{` in prompt editor | E2E | - | Dropdown shows variables grouped by source |
| E5c.3-E2E-006 | Test Prompt preview renders with sample variables | E2E | - | Live preview |
| E5c.3-E2E-007 | Model Registry: fallback model selection dropdown | E2E | - | Fallback chain config |
| E5c.3-E2E-008 | Model Registry: routing tags multi-select | E2E | - | Tag management |
| E5c.4-E2E-004 | Agent guardrails JSON editor with schema validation | E2E | - | JSON editor |
| E5c.4-E2E-005 | Skill negative trigger editor (tag input) | E2E | - | Red tag input |
| E5c.5-E2E-003 | Cron builder with human-readable preview | E2E | - | Schedule configuration |
| E5c.5-E2E-004 | Variable binding panel autocomplete in step goal | E2E | - | `{{step1.output.x}}` |
| E5c.5-E2E-005 | Chain configuration: select next automation | E2E | - | Chain dropdown |
| E5c.5-E2E-006 | Notification config: select recipients and channels | E2E | - | Notification panel |
| E5c.6-E2E-004 | Dashboard Automation Health section: pie chart, alerts, timeline | E2E | - | Dashboard widget |
| E5c.6-E2E-005 | Circuit breaker warning badge on dashboard | E2E | - | Visual indicator |
| E5c.1-UNIT-009 | Scheduler recovery: stale RUNNING runs marked as FAILED on startup | Unit | R-008 | Recovery job |
| E5c.2-UNIT-009 | CONSTANT variable resolution returns static value | Unit | - | Simple case |
| E5c.2-UNIT-010 | Relation traversal for DB_FIELD (e.g., `customer.primaryContact.email`) | Unit | - | Nested relation resolution |

**Total P2**: ~15 tests, ~10-20 hours

### P3 (Low) - Nice-to-have + Exploratory + Benchmarks

**Criteria**: Cosmetic, exploratory, performance benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| E5c.3-E2E-009 | Prompt editor syntax highlighting renders correctly | E2E | Visual verification |
| E5c.5-E2E-007 | Run Now with real-time step progress via WebSocket | E2E | WebSocket live updates |
| E5c.6-E2E-006 | Run history with 1000+ records loads within 500ms | E2E | Performance benchmark |
| E5c.1-PERF-001 | Automation with 10 steps completes within maxDurationMs | API | Stress test |
| E5c.1-PERF-002 | Concurrent automation runs (5 simultaneous) do not interfere | API | Isolation test |
| E5c.3-A11Y-001 | AI Dashboard WCAG 2.1 AA compliance | E2E | Accessibility audit |
| E5c.5-A11Y-001 | Automation Builder WCAG 2.1 AA compliance | E2E | Accessibility audit |
| E5c.ALL-VIS-001 | All admin pages match Concept D visual design | E2E | Visual regression |

**Total P3**: ~8 tests, ~2-5 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. Playwright parallelization handles 100s of tests in 10-15 minutes.

| Cadence | Test Suite | Tool | Duration |
|---------|-----------|------|----------|
| **Every PR** | All unit tests (circular chain, param validation, expression eval, variable resolution, cron) | Vitest | ~1-2 min |
| **Every PR** | All API integration tests (automation CRUD, step execution, chaining, circuit breaker) | Vitest + test DB | ~3-5 min |
| **Every PR** | All E2E/UI tests (admin pages, CRUD flows, prompt editor, automation builder) | Playwright | ~8-12 min |
| **Nightly** | Performance benchmarks (concurrent runs, large run history, step completion time) | Playwright + k6 | ~15-30 min |
| **Weekly** | Full accessibility audit (WCAG 2.1 AA for all admin pages) | Playwright + axe | ~10 min |
| **Weekly** | Visual regression against Concept D prototype | Playwright screenshots | ~5 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | ~18 | ~25-40 hours | Complex setup: circular chain graphs, expression fuzzing, schema traversal |
| P1 | ~22 | ~20-35 hours | Standard CRUD, scheduler, UI flows |
| P2 | ~15 | ~10-20 hours | Simpler scenarios: autocomplete, config panels, edge cases |
| P3 | ~8 | ~2-5 hours | Exploratory, performance benchmarks, visual checks |
| **Total** | **~63** | **~55-100 hours** | **~1.5-3 weeks** |

### Prerequisites

**Test Data:**

- Automation factory (generates automation + steps + schedule with faker)
- AI model/prompt/agent seed data (from E5 seeds, extended for E5c)
- Prompt variable factory (each source type: DB_FIELD, DB_QUERY, SYSTEM, EXPRESSION, CONSTANT)

**Tooling:**

- Vitest for unit/integration tests (already configured in packages/db, packages/ai-gateway, apps/api)
- Playwright for E2E tests (already configured in _bmad-output/test-artifacts/playwright/)
- Test DB with automation tables migrated

**Environment:**

- API running on port 5100 with test database
- Web running on port 5110 with mock AI gateway responses
- BullMQ test instance for scheduler testing

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: 95% or higher (waivers required for failures)
- **P2/P3 pass rate**: 90% or higher (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (automation engine, chain detection, param validation): 90% or higher
- **Security scenarios** (expression injection, companyId scoping): 100%
- **Business logic** (variable resolution, scheduling, circuit breaker): 80% or higher
- **Edge cases** (DST, recovery, concurrent runs): 50% or higher

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (score 6+) items unmitigated
- [ ] Security tests (SEC category — R-002) pass 100%
- [ ] Expression evaluator fuzz tests pass with no injection vectors
- [ ] Circular chain detection covers direct, indirect, and max-depth cases

---

## Mitigation Plans

### R-001: Circular Chain Detection Edge Cases (Score: 6)

**Mitigation Strategy:**
1. Implement depth-first graph traversal with visited-set tracking
2. Enforce max chain depth of 10 at API validation layer (not just DB constraint)
3. Add concurrent modification guard: DB-level unique constraint on `chainNextId`
4. Unit test with 5+ graph topologies: self-reference, 2-node cycle, deep cycle at depth 10, valid linear chain, branching chains

**Owner:** Dev
**Timeline:** Story E5c.1 (Sprint 0)
**Status:** Planned
**Verification:** E5c.1-UNIT-001, E5c.1-UNIT-002, E5c.1-UNIT-003, E5c.1-INT-007

### R-002: Expression Evaluator Code Injection (Score: 6)

**Mitigation Strategy:**
1. Implement whitelist-only expression language: date arithmetic (+/- days/weeks/months), string concatenation, basic math
2. Reject any expression containing `eval`, `Function`, `require`, `import`, `process`, backticks, or semicolons
3. Fuzz test with 50+ injection payloads (OWASP patterns adapted for expression context)
4. No `eval()` or `new Function()` in implementation — use AST-based parser

**Owner:** Dev + Security review
**Timeline:** Story E5c.2 (Sprint 0)
**Status:** Planned
**Verification:** E5c.2-UNIT-001, E5c.2-UNIT-002

### R-003: Cascading Automation Failures (Score: 6)

**Mitigation Strategy:**
1. Failed step produces null output — downstream steps receive null input, not corrupted data
2. Chain execution halts on step failure by default (configurable per-automation)
3. Circuit breaker: 3 consecutive failures auto-pause automation + admin notification
4. Integration tests verify: failed step halts chain, null output propagation, circuit breaker trigger

**Owner:** Dev
**Timeline:** Story E5c.1
**Status:** Planned
**Verification:** E5c.1-INT-002, E5c.1-INT-004, E5c.1-UNIT-007

### R-004: Token Budget Exhaustion During Long-Running Steps (Score: 6)

**Mitigation Strategy:**
1. Token budget check before each agent turn (not just at step start)
2. Hard timeout at `maxDurationMs` (default 5 min) with graceful cancellation
3. Step-level token tracking with cumulative budget enforcement
4. If budget exceeded: cancel remaining steps, mark run as FAILED with budget error

**Owner:** Dev
**Timeline:** Story E5c.1
**Status:** Planned
**Verification:** E5c.1-INT-005, E5c.1-PERF-001

---

## Assumptions and Dependencies

### Assumptions

1. E5 AI infrastructure tables (AiModel, AiPrompt, AiAgent, AiSkill, etc.) are deployed and seeded with test data
2. E5b dynamic context assembler supports AUTONOMOUS mode flag and returns module knowledge without user memories
3. BullMQ is available for scheduled job processing in the test environment
4. Frontend shell from E6 provides sidebar navigation and layout components for admin pages
5. Mock AI gateway responses are deterministic for integration tests (no actual LLM calls)

### Dependencies

1. E5 AI tables + seeds — Required before E5c.1 migration
2. E5b context assembler AUTONOMOUS mode — Required for E5c.1 step execution
3. E6 frontend shell — Required for E5c.3-E5c.6 UI stories
4. Event bus (from E0/E1) — Required for event-triggered automations (E5c.1)
5. WebSocket infrastructure (from E6) — Required for "Run Now" real-time progress (E5c.5)

### Risks to Plan

- **Risk**: E5b AUTONOMOUS mode interface not finalised when E5c.1 starts
  - **Impact**: Step execution tests blocked
  - **Contingency**: Mock the context assembler interface; define contract tests for integration boundary

- **Risk**: BullMQ scheduler not available in CI environment
  - **Impact**: Scheduled automation tests cannot run in CI
  - **Contingency**: Use fake timers for cron trigger tests; test scheduler service logic with time-travel utilities

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|-----------------|
| **E5 AI Gateway** | Automation steps call AI Gateway for agent execution | E5 gateway integration tests must pass |
| **E5b Context Assembler** | AUTONOMOUS mode context assembly for automation steps | E5b context tests must pass |
| **E0/E1 Event Bus** | Event-triggered automations subscribe to business events | E0/E1 event emission tests must pass |
| **E6 Frontend Shell** | Admin UI pages use shell layout, sidebar, routing | E6 shell rendering tests must pass |
| **Prisma/DB** | 6 new tables with FKs to existing AI tables | E5 migration tests, FK constraint tests must pass |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E5c.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/` (Section 6: AI Infrastructure)
- Data Models: `_bmad-output/planning-artifacts/data-models/`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/` (Section 2.6)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md`
- State Machines: `_bmad-output/planning-artifacts/state-machine-reference.md`
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md`
- Project Context: `_bmad-output/planning-artifacts/project-context.md` (Sections 12, 14, 19)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

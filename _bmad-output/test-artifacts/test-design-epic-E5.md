---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-22'
---

# Test Design: Epic E5 - AI Orchestration

**Date:** 2026-02-22
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E5 — AI Orchestration

**Risk Summary:**

- Total risks identified: 9
- High-priority risks (score >=6): 5
- Critical categories: SEC (2), TECH (1), PERF (1), DATA (1)

**Coverage Summary:**

- P0 scenarios: 4 (~8-12 hours)
- P1 scenarios: 14 (~25-40 hours)
- P2 scenarios: 7 (~8-15 hours)
- P3 scenarios: 3 (~2-4 hours)
- **Total effort**: ~43-71 hours (~1-2 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Frontend Co-Pilot UI** | E5 covers backend AI services only; frontend implementation is a separate epic | API contract tests validate all response shapes the frontend will consume |
| **AI model quality/accuracy tuning** | Prompt engineering and model fine-tuning are ongoing operational concerns, not test infrastructure | Confidence score thresholds tested; model outputs mocked in automated tests |
| **Platform Admin AI quota management** | Admin endpoints (GET/PATCH `/admin/tenants/:id/ai/quota`) belong to Platform API, not Tenant API | Platform API has its own test design |
| **Load/stress testing at scale** | Performance benchmarking deferred to NFR assessment workflow | NFR1 and NFR47 latency thresholds verified in functional API tests |
| **Third-party AI provider integration** | AI Gateway abstracts provider-specific APIs (already tested in E3b) | Tests mock AI Gateway responses; Gateway integration tested in E3b |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | AI guardrails bypass allows financial transactions to execute without user confirmation, violating NFR16 and IMP-005 | 3 | 3 | 9 | Mandatory approval-gate integration tests; zero-bypass audit log validation; guardrail enforcement tests for every write operation type | Dev + QA | Sprint 0 |
| R-002 | TECH | AI Gateway integration failure causes cascading AI outage — circuit breaker misconfiguration, quota check errors, or model routing failures | 2 | 3 | 6 | Circuit breaker pattern tests; fallback validation; graceful degradation tests ensuring traditional UI remains functional (IMP-006) | Dev | Sprint 0 |
| R-003 | PERF | AI response time exceeds 3s SLA (NFR1) or AI Gateway adds >100ms overhead (NFR47) due to context assembly, streaming, or model latency | 2 | 3 | 6 | Response time assertions in API tests; context window size limits; streaming chunk latency monitoring | Dev | Sprint 1 |
| R-004 | DATA | Multi-turn conversation context assembly loses or corrupts context when trimming old messages at token limit boundary; race conditions in concurrent sessions | 3 | 2 | 6 | Context assembly unit tests with boundary conditions; concurrent session API tests; message ordering validation | Dev | Sprint 1 |
| R-005 | SEC | WebSocket JWT authentication bypass or tenant isolation failure exposes cross-tenant conversation data | 2 | 3 | 6 | WS connection auth tests (valid/expired/missing JWT); tenant isolation tests (User A cannot access User B conversations); company context injection validation | Dev + QA | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-006 | TECH | ResponseParser fails on unexpected model output formats — malformed JSON, missing confidence scores, partial structured data | 2 | 2 | 4 | Parser unit tests with edge-case model outputs (empty, malformed, partial) | Dev |
| R-007 | BUS | AI predictions (cash flow, anomaly, duplicate detection) produce misleading results, causing incorrect financial decisions | 2 | 2 | 4 | Confidence score threshold tests; result schema validation; predictions are advisory only (no auto-execution) | Dev |
| R-009 | TECH | Streaming WebSocket chunk delivery fails under back-pressure, network interruption, or reconnection — tokens lost or duplicated | 2 | 2 | 4 | Streaming integration tests; HTTP fallback validation (E5.2 AC#6) | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-008 | OPS | BullMQ daily briefing scheduled job fails, causing on-demand generation latency spike on first request | 1 | 2 | 2 | Monitor — on-demand fallback exists |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E3b (Platform API + AI Gateway) stories complete and tests passing
- [ ] E4 (i18n) stories complete and tests passing
- [ ] AI Gateway mock/test double available for tenant API tests
- [ ] Prisma schema updated with AiConversation, AiMessage, AiModel, AiPrompt, AiAgent models
- [ ] WebSocket (Socket.io) dependency added to API project
- [ ] BullMQ + Redis available in test environment
- [ ] Test data factories for User, Company, and JWT generation available from prior epics

## Exit Criteria

- [ ] All P0 tests passing (100% pass rate)
- [ ] All P1 tests passing (>=95% pass rate, failures triaged)
- [ ] No open high-priority bugs (score >=6 risks mitigated)
- [ ] AI guardrail zero-bypass validation confirmed
- [ ] Graceful degradation verified (all CRUD works without AI)
- [ ] Test coverage agreed as sufficient by team review

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate priority and risk classification, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| Guardrails enforce mandatory user confirmation for ALL financial write actions (create invoice, post journal, process payment) — no bypass path exists | Unit + API | R-001 | 5 | QA | IMP-005, NFR16: test every financial entity type; verify `requiresApproval: true` cannot be overridden |
| WebSocket connection authenticates via JWT; expired/missing/invalid tokens rejected; tenant isolation enforced | API | R-005 | 4 | QA | Test valid auth, expired JWT, missing JWT, cross-tenant rejection |
| Graceful degradation — when AI Gateway unreachable, all traditional CRUD operations continue; user sees friendly error; `ai.degraded` event emitted | API | R-002 | 3 | QA | IMP-006, NFR21: circuit breaker opens, UI fallback works, event emitted |
| AI Gateway quota check + usage recording adds <100ms; usage logged to TenantAiUsage | API | R-003 | 2 | QA | NFR47: latency assertion on quota check path |

**Total P0**: ~14 tests, ~8-12 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| AiOrchestrator routes AI requests through AI Gateway with intent, context, and model routing tags | API | R-002 | 3 | QA | E5.1 AC#1: test routing for 'reasoning', 'standard', 'cheap' tags |
| PromptManager loads AiPrompt from DB, resolves parameters (entity lookups, user input, context cache), compiles system+user messages | Unit | - | 4 | Dev | E5.1 AC#2: template resolution, missing param handling, active version selection |
| ResponseParser extracts structured JSON output, natural language responses, and confidence scores from AI model output | Unit | R-006 | 4 | Dev | E5.1 AC#3: valid JSON, NL response, partial output, empty response |
| Streaming support forwards AI Gateway chunks to WebSocket handler token-by-token | API | R-009 | 3 | QA | E5.1 AC#4: chunk delivery, connection drop mid-stream, typing indicator |
| WebSocket message exchange — user sends message, AI response streams back with typing indicator | API | R-004 | 3 | QA | E5.2 AC#1,#2: full message lifecycle |
| Multi-turn context assembly builds message history array, applies token limit trimming, includes page context | Unit + API | R-004 | 4 | Dev + QA | E5.2 AC#3: context continuity, boundary trimming, page context injection |
| AiConversation and AiMessage CRUD — create session, list sessions (most recent first), store messages with role/content/metadata | API | - | 4 | QA | E5.2 AC#4,#5: CRUD + ordering + metadata |
| HTTP fallback endpoint POST /ai/chat/message returns complete response when WebSocket unavailable | API | - | 2 | QA | E5.2 AC#6: non-streaming response |
| ActionPlanner parses AI output to create action proposals with type, description, entity type, preview data, confidence score | Unit | - | 3 | Dev | E5.3 AC#1: proposal creation, confidence calculation |
| Action confirm/reject WebSocket messages — confirmed actions execute via standard service layer; rejected actions leave no trace | API | R-001 | 3 | QA | E5.3 AC#2,#3: confirm creates record, reject does nothing |
| Audit trail records AI-originated actions with isAiAction, aiConfidence, conversationId; ai.action.executed event emitted | API | R-001 | 2 | QA | E5.3 AC#5: audit metadata, event emission |
| Cash flow forecast returns period-by-period projections with alerts for negative balance periods | API | R-007 | 3 | QA | E5.4 AC#1,#2: forecast structure, NEGATIVE_BALANCE alert |
| Anomaly detection flags suspicious transactions with anomaly type and confidence | API | R-007 | 3 | QA | E5.4 AC#3: duplicate payments, unusual amounts, timing anomalies |
| Daily briefing endpoint returns role-based content; BullMQ job pre-generates and caches in Redis; stale cache refreshes on-demand | API | R-008 | 4 | QA | E5.5 AC#1,#2,#5: role variants, cache TTL, on-demand fallback |

**Total P1**: ~45 tests, ~25-40 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| Duplicate detection returns potential duplicate pairs with per-field similarity scores for Customer, Supplier, Contact | API | - | 3 | QA | E5.4 AC#4: entity type param, similarity score schema |
| Confidence score retrieval endpoint GET /ai/confidence/:entityType/:entityId returns stored scores | API | - | 2 | QA | E5.4 AC#5: valid entity, not-found entity |
| AI explain endpoint returns human-readable explanation of AI reasoning | API | - | 2 | QA | E5.4: explanation structure validation |
| Context-based suggestions endpoint returns role+page-specific suggestion chips | API | - | 3 | QA | E5.5 AC#4: different page contexts, different roles |
| Role-based briefing content variations — Finance Manager sees different items than Business Owner | Unit | - | 3 | Dev | E5.5 AC#1,#2: template selection by role |
| Conversation title auto-generation from first user message | Unit | - | 2 | Dev | E5.2 AC#5: title extraction logic |
| ResponseParser error handling for completely malformed AI output (non-JSON when JSON expected, empty string, timeout) | Unit | R-006 | 3 | Dev | Graceful error handling, no unhandled exceptions |

**Total P2**: ~18 tests, ~8-15 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
|-------------|-----------|------------|-------|-------|
| Action proposal preview data generation for complex entity types | Unit | 2 | Dev | Preview data schema completeness |
| BullMQ job scheduling configuration and Redis cache TTL expiry behaviour | API | 2 | Dev | Scheduled job registration, TTL verification |
| Context window token limit management edge cases (exactly at limit, one message over) | Unit | 2 | Dev | Token counting accuracy |

**Total P3**: ~6 tests, ~2-4 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 minutes; defer only if expensive or long-running.

| When | What | Duration |
|------|------|----------|
| **Every PR** | All unit tests (PromptManager, ResponseParser, ActionPlanner, context assembly, role-based templates) + All API tests (endpoints, WebSocket, guardrails, degradation) | ~10-15 min with Playwright parallelization |
| **Nightly** | Performance benchmark tests (response time SLA validation, streaming latency) if added | ~15-30 min |

All E5 tests are functional API/unit tests — no browser-based E2E, no k6 load tests. The entire suite should run comfortably within a PR pipeline.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | ~14 | ~8-12 hours | Security-critical, require careful setup and multiple assertion paths |
| P1 | ~45 | ~25-40 hours | Core AI functionality, standard API test patterns |
| P2 | ~18 | ~8-15 hours | Secondary features, straightforward happy-path + error tests |
| P3 | ~6 | ~2-4 hours | Exploratory edge cases |
| **Total** | **~83** | **~43-71 hours** | **~1-2 weeks** |

### Prerequisites

**Test Data:**

- User + Company factories (available from E0/E1)
- JWT token factory for WebSocket auth testing (available from E1)
- AiConversation + AiMessage factories (new for E5)
- AI Gateway mock/test double returning predictable responses (new for E5)

**Tooling:**

- Vitest for unit tests (already configured)
- Fastify injection for API route tests (already configured)
- Socket.io client for WebSocket tests (new dependency for test suite)
- BullMQ test utilities for scheduled job tests

**Environment:**

- Redis available for session/cache tests
- Prisma test database with AI-related models migrated

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (guardrails, auth, degradation)**: >=90%
- **Security scenarios**: 100%
- **Business logic (orchestrator, parser, planner)**: >=80%
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category — R-001, R-005) pass 100%
- [ ] AI guardrail zero-bypass confirmed via audit log validation
- [ ] Graceful degradation verified (NFR21, IMP-006)

---

## Mitigation Plans

### R-001: AI Guardrails Bypass (Score: 9)

**Mitigation Strategy:**
1. Unit tests verify guardrail configuration blocks all financial entity types (Invoice, JournalEntry, Payment, CreditNote, DebitNote)
2. API tests confirm `action_confirm` WebSocket message is mandatory before any write operation executes
3. Integration test validates audit log always contains `isAiAction: true` + `conversationId` for AI-originated records
4. Negative test: attempt to execute action without confirmation and verify rejection

**Owner:** Dev + QA
**Timeline:** Sprint 0 (before any E5 implementation)
**Status:** Planned
**Verification:** Zero rows in audit log where `isAiAction=true` AND no corresponding `action_confirm` message exists

### R-002: AI Gateway Integration Failure (Score: 6)

**Mitigation Strategy:**
1. Circuit breaker pattern test: verify breaker opens after N consecutive failures
2. Graceful degradation test: with AI Gateway mocked as unreachable, verify all CRUD endpoints still return 2xx
3. `ai.degraded` event emission test: verify event bus fires when circuit breaker opens
4. Recovery test: verify circuit breaker closes after AI Gateway becomes available again

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Traditional CRUD operations return 2xx with AI Gateway unreachable

### R-003: AI Response Time SLA Breach (Score: 6)

**Mitigation Strategy:**
1. API tests include timeout assertions (response within 3s threshold)
2. Context window management tests verify trimming keeps payload size bounded
3. Streaming tests verify first chunk arrives within reasonable time

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** 95th percentile response times in test suite logs

### R-004: Conversation Context Data Integrity (Score: 6)

**Mitigation Strategy:**
1. Unit tests for context assembly with boundary conditions (empty history, exactly at token limit, one message over limit)
2. API tests for concurrent session creation and message ordering
3. Verify trimmed messages are oldest-first removal, most recent messages always preserved

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Context array correctly ordered and within token budget in all test scenarios

### R-005: WebSocket Authentication Bypass (Score: 6)

**Mitigation Strategy:**
1. Test WS connection with valid JWT → succeeds
2. Test WS connection with expired JWT → rejected
3. Test WS connection with no JWT → rejected
4. Test WS connection with valid JWT for Tenant A trying to access Tenant B conversations → rejected
5. Test company context correctly injected from JWT claims

**Owner:** Dev + QA
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** All unauthorized WS connection attempts return appropriate error codes

---

## Assumptions and Dependencies

### Assumptions

1. AI Gateway (from E3b) provides a stable mock/test double interface for quota check, model invocation, and usage recording
2. Prisma schema for AI models (AiModel, AiPrompt, AiAgent, AiConversation, AiMessage) is defined in the epic's first story and available for test data factories
3. Socket.io is the WebSocket library choice (as specified in Architecture §6)
4. AI model responses can be reliably mocked with deterministic JSON/text outputs for testing purposes
5. BullMQ and Redis are available in the CI/test environment (already used by event bus from E3)

### Dependencies

1. **E3b (Platform API + AI Gateway)** — Must be complete with passing tests before E5 starts
2. **E4 (i18n)** — Must be complete; translation keys for AI error messages and briefing content
3. **AI Gateway test double** — Required by Sprint 0; mock interface for quota check and model invocation

### Risks to Plan

- **Risk**: AI Gateway mock fidelity — if mock doesn't accurately represent real AI Gateway behaviour, integration bugs may slip through
  - **Impact**: False confidence in test suite; bugs found in staging
  - **Contingency**: Define AI Gateway contract tests in E3b; validate mock against contract

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **Auth System (E1)** | JWT tokens used for WebSocket auth and tenant context injection | Auth route tests, JWT verify hook tests must still pass |
| **RBAC (E4b)** | AI actions must respect user permissions; guardrails check canRead/canWrite against RBAC | RBAC guard tests, permission service tests must still pass |
| **Event Bus (E3)** | AI events (`ai.action.executed`, `ai.degraded`) emitted through event bus | Event bus tests, dead letter handling tests must still pass |
| **Audit Service (E3)** | AI actions extend audit trail with AI-specific metadata | Audit service tests must still pass; verify backward compatibility of audit log schema |
| **Platform Client (E3b)** | AI Gateway called via platform client for quota checks | Platform client tests, circuit breaker tests must still pass |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: Mohammed Date: ____
- [ ] Tech Lead: ____ Date: ____
- [ ] QA Lead: ____ Date: ____

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/functional-requirements.md` (FR1-FR10, FR153-FR156)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E5.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md` (Section 6)
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (IMP-005, IMP-006)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md` (Section 17)
- NFRs: `_bmad-output/planning-artifacts/prd/non-functional-requirements.md` (NFR1, NFR16, NFR21, NFR47)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

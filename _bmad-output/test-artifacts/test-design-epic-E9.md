---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-03'
---

# Test Design: Epic E9 - Notifications

**Date:** 2026-03-03
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E9 — Notifications (4 stories: E9.1 Notification Service, E9.2 In-App Notifications, E9.3 Email Channel, E9.4 Notification Preferences)

**Risk Summary:**

- Total risks identified: 10
- High-priority risks (≥6): 3
- Critical categories: TECH (WebSocket reliability, event bus integration), DATA (notification delivery guarantees), OPS (BullMQ failure handling)

**Coverage Summary:**

- P0 scenarios: 8 (~16–24 hours)
- P1 scenarios: 12 (~12–20 hours)
- P2 scenarios: 8 (~4–8 hours)
- P3 scenarios: 4 (~1–2 hours)
- **Total effort**: ~33–54 hours (~1–1.5 weeks)

> Note: P0/P1/P2/P3 = priority classification based on risk, NOT execution timing. See Execution Strategy for timing.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Push notifications (mobile)** | E9 scope references push channel but no mobile app exists yet; channel infrastructure only | Push channel delivery tested as a stub; actual mobile delivery deferred to mobile app epic |
| **Email SMTP integration (E10)** | E9.3 depends on E10 for actual SMTP sending; E9 tests the queue/dispatch side | Mock SMTP service in tests; E10 provides real SMTP integration tests |
| **Mass mail campaigns** | Separate Communications module feature, not part of E9 notification stories | Covered by future Communications epic |
| **Chat/Conference features** | Section 2.29 includes chat/conferences but E9 is notifications-only | Separate epic for chat/conference functionality |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | TECH | WebSocket connection reliability — real-time notification delivery depends on Socket.io connection stability; reconnection, disconnection, and multi-tab scenarios can cause missed or duplicate notifications | 3 | 3 | 9 | Implement heartbeat/ping-pong, reconnection with message replay buffer, deduplication by notificationId on client | Dev | Sprint 0 |
| R-002 | DATA | Notification delivery guarantees — if BullMQ job fails mid-processing, notifications may be partially delivered (e.g., in-app succeeds but email fails) without clear status tracking per channel | 2 | 3 | 6 | Track delivery status per channel independently on Notification record; implement per-channel retry; expose partial delivery status in UI | Dev | E9.1 |
| R-003 | TECH | Event bus template matching — notification service subscribes to ALL business events via template eventName matching; incorrect matching or missing templates silently drops notifications | 2 | 3 | 6 | Seed comprehensive default templates; add warning log for unmatched events; validate template eventNames against event catalog at startup | Dev | E9.1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-004 | TECH | Handlebars template rendering errors — invalid variable references in notification templates produce broken output or throw runtime errors | 2 | 2 | 4 | Validate templates on save; use safe Handlebars helpers with fallback values; test all seeded templates | Dev |
| R-005 | SEC | Notification content leakage — notifications may expose sensitive data (amounts, customer names) to users without proper authorization if template target user resolution is incorrect | 2 | 2 | 4 | Enforce companyId scoping on all notification queries; validate target user permissions against entity access | Dev |
| R-006 | PERF | High-volume notification fan-out — a single business event (e.g., bulk import) could generate hundreds of notifications simultaneously, overwhelming BullMQ and WebSocket connections | 2 | 2 | 4 | Implement batch notification creation; rate-limit WebSocket pushes; use BullMQ concurrency limits | Dev |
| R-007 | BUS | Preference cascade logic complexity — three-tier cascade (user → role default → template default) may produce unexpected opt-in/out behaviour if any tier is misconfigured | 2 | 2 | 4 | Unit test all cascade combinations exhaustively; document cascade precedence clearly in UI | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-008 | OPS | Email retry exhaustion — after 3 retries with exponential backoff, email notification marked FAILED with no recovery path | 1 | 2 | 2 | Monitor; manual re-send capability in admin UI (future) |
| R-009 | BUS | Notification fatigue — too many notifications overwhelm users, leading to dismissal of important ones | 1 | 1 | 1 | Monitor; notification grouping/batching as future enhancement |
| R-010 | OPS | WebSocket scaling — single-server Socket.io may not scale for multi-instance deployments | 1 | 2 | 2 | Monitor; Redis adapter for Socket.io when horizontal scaling needed |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E3 (Event Bus) implemented and event emission verified
- [ ] E6 (Frontend Shell) deployed with header component accepting NotificationBell slot
- [ ] BullMQ infrastructure configured and Redis available
- [ ] Socket.io server setup complete (or available from E6)
- [ ] Prisma schema includes NotificationTemplate, NotificationPreference, Notification models
- [ ] Test data factories available for User, Company entities (from prior epics)
- [ ] Test environment accessible on port 5100 (API) and 5110 (Web)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or failures triaged (≥95%)
- [ ] No open high-priority / high-severity bugs
- [ ] WebSocket notification delivery verified in real-time
- [ ] Notification status lifecycle (PENDING → DELIVERED → READ → DISMISSED) tested end-to-end
- [ ] Preference cascade logic (user → role → template) verified with all combinations
- [ ] Email channel retry logic tested (3 attempts, exponential backoff)

---

## Test Coverage Plan

> Note: P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy section for when tests run.

### P0 (Critical) - Blocks core journey + High risk + No workaround

**Criteria:** Core notification creation, delivery lifecycle, and WebSocket reliability

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E9.1-API-001 | Event bus handler creates Notification records from matching NotificationTemplate | API | R-003 | Core notification creation flow; verify template eventName matching |
| E9.1-API-002 | Delivery orchestrator dispatches to each enabled channel per user NotificationPreference | API | R-002 | Multi-channel dispatch; verify per-channel independent failure handling |
| E9.1-API-003 | Template rendering engine substitutes variables correctly (entity data, user data) | Unit | R-004 | Handlebars rendering with various payload types |
| E9.2-API-004 | WebSocket delivers notification in real-time to connected user | API | R-001 | Socket.io push; verify message receipt and format |
| E9.2-E2E-005 | Notification bell shows unread count and dropdown with recent notifications | E2E | R-001 | Full UI flow: bell → dropdown → click → navigate to entity |
| E9.2-API-006 | PATCH /notifications/:id/read marks notification as READ | API | - | State transition DELIVERED → READ |
| E9.3-API-007 | Email notification queued with rendered HTML template via BullMQ | API | R-002 | Verify email job created with correct payload |
| E9.4-API-008 | Preference cascade resolves correctly: user → role default → template default | API | R-007 | All 3 tiers with various combinations |

**Total P0**: 8 tests, ~16–24 hours

### P1 (High) - Important features + Medium risk + Common workflows

**Criteria:** Secondary notification flows, preference management, error handling

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E9.1-API-009 | Notification created for each target user resolved from template rules | API | R-003 | Target resolution: entity owner, role-based, specific users |
| E9.1-API-010 | Missing user preference falls back to template defaultChannels (BR-COM-014) | API | R-007 | Verify cascade fallback |
| E9.2-API-011 | WebSocket reconnection delivers missed notifications | API | R-001 | Reconnection replay buffer |
| E9.2-E2E-012 | "Mark All Read" action clears all unread notifications | E2E | - | Bulk operation |
| E9.2-E2E-013 | POST /notifications/:id/dismiss marks notification as DISMISSED | API | - | State transition: DELIVERED/READ → DISMISSED |
| E9.3-API-014 | Email retry with exponential backoff (3 attempts: 30s/120s/300s) | API | R-008 | BullMQ retry config verification |
| E9.3-API-015 | Email not sent when user has disabled EMAIL for event type | API | R-007 | Preference respected per channel |
| E9.4-E2E-016 | Preferences page displays matrix of event types vs channels with toggles | E2E | - | UI rendering with correct defaults |
| E9.4-API-017 | PUT /notifications/preferences updates per-event, per-channel preferences | API | - | CRUD for NotificationPreference |
| E9.4-API-018 | New NotificationTemplate auto-appears in preferences with defaults | API | R-007 | Dynamic template discovery |
| E9.1-UNIT-019 | Notification status lifecycle enforces valid transitions (PENDING→DELIVERED→READ→DISMISSED, PENDING→FAILED) | Unit | - | State machine guards |
| E9.2-API-020 | High-priority notification triggers toast; normal/low updates badge silently | API | R-001 | Priority-based UI behaviour |

**Total P1**: 12 tests, ~12–20 hours

### P2 (Medium) - Secondary features + Low risk + Edge cases

**Criteria:** Edge cases, admin features, error scenarios

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E9.1-API-021 | companyId scoping — user only receives notifications for their company | API | R-005 | Multi-tenant isolation |
| E9.1-API-022 | Invalid template variable gracefully renders fallback (no crash) | Unit | R-004 | Handlebars error handling |
| E9.3-API-023 | Email marked FAILED after exhausting 3 retries | API | R-008 | Terminal failure state |
| E9.3-API-024 | Email HTML template renders with company branding, action link, responsive layout | Unit | - | Template output validation |
| E9.4-API-025 | Admin sets role-based notification defaults | API | - | Admin-only functionality |
| E9.4-E2E-026 | "Reset to Defaults" restores template default preferences | E2E | - | UI action |
| E9.2-API-027 | GET /notifications returns paginated list for notification centre | API | - | Pagination, filtering |
| E9.1-API-028 | Batch event (e.g., bulk import) creates notifications without overwhelming the system | API | R-006 | Rate limiting / batching |

**Total P2**: 8 tests, ~4–8 hours

### P3 (Low) - Nice-to-have + Exploratory + Benchmarks

**Criteria:** Performance, scalability, edge-edge cases

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| E9.1-PERF-029 | Notification creation throughput under load (100 concurrent events) | API | Performance benchmark |
| E9.2-PERF-030 | WebSocket delivery latency under load (50 concurrent users) | API | Latency benchmark |
| E9.2-API-031 | Multi-tab WebSocket — notification appears in all open tabs | API | Browser multi-tab scenario |
| E9.4-API-032 | Preference matrix with 50+ event types renders within 500ms | API | Performance for large template sets |

**Total P3**: 4 tests, ~1–2 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min. Playwright parallelisation handles 30+ tests in 10–15 min easily.

| Timing | What Runs | Tool | Duration |
| --- | --- | --- | --- |
| **Every PR** | All P0 + P1 + P2 functional tests (API + E2E) | Playwright (Vitest for unit) | ~10–15 min |
| **Nightly** | P3 performance benchmarks (load tests) | k6 / custom scripts | ~30–60 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| P0 | 8 | ~16–24 hours | Complex setup: WebSocket, BullMQ, event bus |
| P1 | 12 | ~12–20 hours | Standard API/E2E with fixture reuse |
| P2 | 8 | ~4–8 hours | Simpler scenarios, unit-heavy |
| P3 | 4 | ~1–2 hours | Exploratory / benchmark scripts |
| **Total** | **32** | **~33–54 hours** | **~1–1.5 weeks** |

### Prerequisites

**Test Data:**

- NotificationTemplate factory (seed default templates for common events)
- NotificationPreference factory (user/role/event combinations)
- Notification factory (various status states)
- User factory with WebSocket connection simulation

**Tooling:**

- Vitest for unit tests (template rendering, state machine, preference cascade)
- Playwright for API tests (notification CRUD, WebSocket verification)
- Playwright for E2E tests (bell/dropdown UI, preferences page)
- BullMQ test utilities (job inspection, retry verification)
- Socket.io test client (WebSocket message verification)

**Environment:**

- Redis running for BullMQ queues and Socket.io adapter
- PostgreSQL with notification tables migrated
- API server on port 5100 with WebSocket endpoint
- Web app on port 5110 with notification UI components

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (notification creation → delivery → read/dismiss): ≥80%
- **Security scenarios** (companyId scoping, content leakage): 100%
- **Business logic** (preference cascade, template matching): ≥70%
- **Edge cases** (reconnection, retry exhaustion, batch): ≥50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (SEC category — R-005) pass 100%
- [ ] WebSocket real-time delivery verified (R-001 mitigation)
- [ ] NFR2 met: notification CRUD operations <500ms

---

## Mitigation Plans

### R-001: WebSocket Connection Reliability (Score: 9)

**Mitigation Strategy:**
1. Implement Socket.io heartbeat with 25s ping interval
2. Client-side reconnection with exponential backoff (1s, 2s, 4s, max 30s)
3. Server-side message replay buffer — on reconnect, replay missed notifications since last ack
4. Client-side deduplication by notificationId to prevent duplicates on reconnect
5. Multi-tab coordination via BroadcastChannel API

**Owner:** Dev
**Timeline:** Sprint 0 / E9.2
**Status:** Planned
**Verification:** API test simulating disconnect/reconnect with message replay; E2E test verifying no missed notifications after reconnection

### R-002: Notification Delivery Guarantees (Score: 6)

**Mitigation Strategy:**
1. Track delivery status per channel on Notification record (e.g., inAppStatus, emailStatus)
2. Each channel dispatched as independent BullMQ job — failure in one does not block others
3. Notification.status reflects worst-case across channels (DELIVERED only when all succeeded, PARTIAL_DELIVERED if mixed)
4. Expose per-channel delivery status in admin notification detail view

**Owner:** Dev
**Timeline:** E9.1
**Status:** Planned
**Verification:** API test: fire event, fail email channel, verify in-app still DELIVERED and email shows FAILED independently

### R-003: Event Bus Template Matching (Score: 6)

**Mitigation Strategy:**
1. Validate NotificationTemplate.eventName against known event catalog entries at application startup
2. Log warning for unmatched events (event fires but no template found)
3. Seed comprehensive default templates for all events listed in event catalog §14
4. Admin template management UI includes event name autocomplete from catalog

**Owner:** Dev
**Timeline:** E9.1
**Status:** Planned
**Verification:** API test: fire event with matching template → notification created; fire event with no template → warning logged, no error; fire event with invalid template → graceful handling

---

## Assumptions and Dependencies

### Assumptions

1. E3 Event Bus is fully functional and emits typed events for all business state changes
2. E6 Frontend Shell header component supports dynamic widget slots (for NotificationBell)
3. BullMQ and Redis are available in all environments (dev, test, staging)
4. Socket.io is configured on the API server (port 5100) as part of E6 or E9.2 implementation
5. Prisma schema will include NotificationTemplate, NotificationPreference, and Notification models as defined in data model §3.18

### Dependencies

1. E3 (Event Bus) — must be complete before E9.1 can function (event subscription)
2. E6 (Frontend Shell) — must be complete before E9.2 UI components (header integration)
3. E10 (Email Integration) — E9.3 email sending depends on SMTP service from E10; can be mocked for E9 testing
4. Redis — required for BullMQ queues and Socket.io adapter

### Risks to Plan

- **Risk**: E10 (Email Integration) not ready when E9.3 starts
  - **Impact**: Cannot test real email delivery
  - **Contingency**: Mock SMTP service for all E9.3 tests; verify email content and queue behaviour only

- **Risk**: WebSocket infrastructure not established in E6
  - **Impact**: E9.2 real-time delivery cannot be implemented
  - **Contingency**: Socket.io setup can be done as part of E9.2 if not in E6

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **Event Bus (E3)** | Notifications subscribe to ALL business events | Verify event emission still works after notification handlers registered |
| **Frontend Shell (E6)** | NotificationBell added to header | Verify header layout, responsive behaviour, existing navigation not broken |
| **RBAC (E2)** | Admin notification template management, role-based preference defaults | Verify existing RBAC permissions not affected by notification permission additions |
| **User management (E4)** | Notification preferences linked to user records | Verify user CRUD not affected by notification preference relations |
| **BullMQ workers (E3)** | Email notifications use shared BullMQ infrastructure | Verify existing queue workers (if any) not affected by notification queue addition |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (TECH/SEC/PERF/DATA/BUS/OPS)
- `probability-impact.md` — Risk scoring methodology (1-3 × 1-3 = 1-9)
- `test-levels-framework.md` — Test level selection (Unit/Integration/API/E2E)
- `test-priorities-matrix.md` — P0-P3 prioritization criteria

### Related Documents

- PRD: FR184 (multi-channel notifications), FR185 (notification preferences), FR186 (notification centre)
- NFRs: NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR31 (retry with exponential backoff)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E9.md`
- Data Models: §3.18 Communications Module (NotificationTemplate, NotificationPreference, Notification)
- State Machines: §17.2 Notification Status (PENDING → DELIVERED → READ → DISMISSED / FAILED)
- Event Catalog: §14 Communications / Notifications Events (`notification.sent`, template-based subscription)
- Business Rules: BR-COM-014 (preference cascade from template defaults), BR-COM-015 (S3 presign for attachments)
- API Contracts: §2.25 Communications (GET/PATCH/POST /notifications endpoints)

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

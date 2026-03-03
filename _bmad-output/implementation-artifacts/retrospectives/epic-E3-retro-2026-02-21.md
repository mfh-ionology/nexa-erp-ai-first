# Epic E3 Retrospective — Event Bus + Audit Trail

**Date:** 2026-02-21
**Epic:** E3 — Event Bus + Audit Trail
**Status:** Complete (3/3 stories done)
**Agent:** Claude Opus 4.6 (all stories)
**Type:** Full Retrospective

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 3/3 (100%) |
| Total Tasks | 35 (8 + 11 + 16) |
| Code Reviews Performed | 3 (E3-1, E3-2, E3-3) |
| CR Issues Found | 41 total (11 HIGH, 17 MEDIUM, 13 LOW) |
| New Files Created | ~28 |
| Modified Files | ~20 |
| New Dependencies | bullmq, ioredis |
| New DB Migrations | 1 (add_audit_log) |
| New API Endpoints | 4 (audit-log list, audit-log entity history, dead-letter-queue list, dead-letter-queue reprocess) |
| API Tests at Completion | 568/568 passing (E3-2) → grew further in E3-3 |
| New Infrastructure | EventBus, AuditService, RetryableHandlerExecutor, DeadLetterService, IdempotencyGuard |

### Story Breakdown

| Story | Title | Tasks | CR Issues (H/M/L) | Key Output |
|-------|-------|-------|-------------------|------------|
| E3-1 | Event Bus Infrastructure | 8 | 3/5/3 | EventBus class, BusinessEvents interface (~87 events), Fastify plugin, migration from appEvents |
| E3-2 | Audit Trail Service | 11 | 3/5/4 | AuditLog Prisma model, PostgreSQL immutability rules, AuditService, audit query routes |
| E3-3 | Event Persistence & Dead Letter | 16 | 5/7/6 | RetryableHandlerExecutor, DeadLetterService (BullMQ), Redis connection factory, IdempotencyGuard, DLQ admin routes |

---

## E2b Retro Follow-Through

The E2b retrospective identified 21 action items. Here's how E3 addressed them:

### CRITICAL Items (E2b Items #1-5)

| # | E2b Action Item | Status in E3 | Evidence |
|---|---|---|---|
| 1 | Fix all 42 test failures | :white_check_mark: **Done** | E3-2 completion notes: "568/568 API tests passing" — test suite restored as quality gate |
| 2 | Implement E2b-6 OR explicitly descope FR230 | :x: Not Addressed | E2b-6 still at `ready-for-dev` in sprint-status; neither implemented nor descoped |
| 3 | Fix privilege escalation: ADMIN can create SUPER_ADMIN | :x: Not Addressed | Not in E3 scope — security debt remains |
| 4 | Validate JWT claims after signature verification | :x: Not Addressed | Not in E3 scope — security debt remains |
| 5 | Fix payload.sub non-null assertion | :x: Not Addressed | Not in E3 scope — security debt remains |

### HIGH Items (E2b Items #6-13)

| # | E2b Action Item | Status in E3 | Evidence |
|---|---|---|---|
| 6 | Fix duplicate listener bug in registerPermissionCacheListeners | :x: Not Addressed | E3-1 migrated to EventBus but did not fix the duplicate registration |
| 7 | Fix JSON.parse('null') crash in field-filter hook | :x: Not Addressed | Not in E3 scope |
| 8 | Add field filtering to PATCH/POST responses | :x: Not Addressed | Not in E3 scope |
| 9 | Fix VIEWER behavioral regression on company switch | :x: Not Addressed | Not in E3 scope |
| 10 | Prevent self-deactivation (E2 #4) | :x: Not Addressed | Not in E3 scope |
| 11 | Fix company-ID enumeration (E2 #5) | :x: Not Addressed | Not in E3 scope |
| 12 | Make baseCurrencyCode immutable (E2 #6) | :x: Not Addressed | Not in E3 scope |
| 13 | Add setNotFoundHandler (E2 #8) | :x: Not Addressed | Not in E3 scope |

### Process Improvements (E2b Items #14-18)

| # | E2b Action Item | Status in E3 | Evidence |
|---|---|---|---|
| 14 | Investigate orchestrator bug that skipped E2b-6 | :x: Not Addressed | No investigation documented |
| 15 | Add mandatory "zero test failures" gate before story completion | :white_check_mark: **Effectively Done** | E3 stories were developed with all tests passing — 568/568 in E3-2, clean in E3-3 |
| 16 | Add post-epic manual completion verification step | :x: Not Addressed | No formal verification process added |
| 17 | Fix fragile enum mock pattern | :x: Not Addressed | E3 test files added new mocks but didn't centralize |
| 18 | Resolve ACTION_FLAG_MAP duplication | :x: Not Addressed | Not in E3 scope |

### E1 Carry-Forward (E2b Items #19-21)

| # | E2b Action Item | Status in E3 | Evidence |
|---|---|---|---|
| 19 | Verify ON DELETE SET NULL → RESTRICT on UCR | :x: Not Verified | 4 epics old now |
| 20 | Verify ViewScope enum alignment | :x: Not Verified | 4 epics old now |
| 21 | Verify nextNumber() transaction parameter | :x: Not Verified | 4 epics old now |

**Result:** 2/21 addressed (test failures fixed, zero-failures gate effectively enforced). 19 items remain unresolved. The 3 CRITICAL security fixes from E2 are now **3 epics overdue**. The E1 carry-forward items are **4 epics old**.

---

## What Went Well

### 1. Clean Epic Completion — 100% Story Delivery

All 3 stories delivered successfully with 35 total tasks completed. Unlike E2b (83% completion with E2b-6 skipped), E3 achieved full delivery. The sequencing was well-designed: E3-1 established infrastructure, E3-2 built the first subscriber (audit), E3-3 added resilience (retry + DLQ).

### 2. Test Suite Restored as Quality Gate

The most significant win: the 42 pre-existing test failures from E2b were resolved. E3-2 completion notes confirm 568/568 API tests passing. This was a CRITICAL prerequisite from the E2b retro, and it was achieved. The team can now trust test results as a genuine quality signal.

### 3. Strong Architectural Foundation

E3 delivered three foundational infrastructure layers that the entire ERP system depends on:
- **EventBus**: Typed, async, error-isolated event system replacing the synchronous placeholder — the backbone for cross-module decoupling (Architecture §4.2)
- **AuditService**: Immutable, event-driven audit trail with PostgreSQL RULE enforcement — critical for UK SME compliance (FR85, FR92, NFR39, IMP-003)
- **Retry + DLQ**: Production-grade resilience with exponential backoff and BullMQ persistence — prevents transient failures from causing permanent data loss (NFR22)

### 4. Dependency Injection Pattern Established

E3-1 introduced a clean DI pattern for services: `service(prisma, eventBus, ...)`. This replaced the module-level singleton import pattern (`import { appEvents }`) with testable, injectable dependencies. All future services should follow this pattern.

### 5. Backward Compatibility Discipline

The `appEvents` / `TypedEventEmitter` was deprecated but not deleted. The EventBus retry/DLQ is opt-in via `setRetryExecutor()` / `setDeadLetterService()`. Existing tests pass without modification. This disciplined approach to migration prevented breaking changes.

### 6. Comprehensive Event Catalog Coverage

The BusinessEvents interface covers ~87 event types from the Event Catalog, providing type-safe placeholders for all future modules. When E14+ (Finance, Sales, etc.) are implemented, they just add handlers — the event types are already defined.

### 7. Code Review Process Maintained

Every story received a full code review with 3 iterations. Issues were categorized by severity and documented thoroughly. While the issues themselves are concerning (see Challenges), the process discipline is commendable.

---

## Challenges

### 1. Code Review Issues Continue to Accumulate

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E3-1 | 3 | 5 | 3 | 11 |
| E3-2 | 3 | 5 | 4 | 12 |
| E3-3 | 5 | 7 | 6 | 18 |
| **Total** | **11** | **17** | **13** | **41** |

E3 accumulated 41 code review issues — exactly matching E2b's 41 issues. The pattern is clear: the 3-iteration CR limit, combined with the dev agent's tendency to not prioritize HIGH over LOW issues, creates structural debt accumulation. E3-3 alone had 5 HIGH issues.

**Most Concerning HIGH Issues:**
- E3-1 #1: `drain()` infinite loop on cascading event cycles — affects graceful shutdown
- E3-1 #3: Event payloads passed by reference — mutation risk across concurrent handlers
- E3-2 #2: No sensitive data stripping from audit JSONB — passwords/tokens could be persisted in immutable audit log
- E3-3 #2: Fastify onClose hook ordering — DLQ connection closes before drain() completes
- E3-3 #3: Reprocess route silently swallows markReprocessed failure

### 2. Security-Sensitive Issues in Audit Service

E3-2 HIGH #2 is particularly concerning: the AuditService persists `beforeData`/`afterData` as JSONB without stripping sensitive fields. When future modules emit entity snapshots containing passwordHash, mfaSecret, or API tokens, these will be written to the immutable audit log — and **cannot be removed** due to PostgreSQL DELETE rules. This is a compliance risk that must be addressed before business modules start emitting entity snapshots.

### 3. Increasing Complexity Per Story

E3-3 had 16 tasks compared to E3-1's 8 and E3-2's 11. The CR issue count also escalated: 11 → 12 → 18. This suggests either:
- E3-3's scope was too large for a single story (should have been split)
- Integration complexity grows as layers stack (EventBus → AuditService → RetryHandler → DeadLetterService)
- The dev agent produces more issues when dealing with multi-layer integration

### 4. Out-of-Scope Feature Addition

E3-1 CR #7 flagged that `once()` was added to the EventBus without story authorization. It's not in the AC, not in the task list, and it introduced a bug (once() handlers can't be cancelled via `off()`). Feature creep in infrastructure code is risky — unauthorized additions bypass the review pipeline.

### 5. Naming Inconsistency with Event Catalog

E3-1 CR #8 identified that `approval.autoEscalated` uses camelCase but the Event Catalog defines `approval.auto_escalated` with underscores. While currently a placeholder, this sets a precedent for future naming drift between spec and implementation.

### 6. Graceful Shutdown Fragility

Multiple issues across E3-1 and E3-3 relate to `drain()` and shutdown ordering:
- E3-1 #1: drain() infinite loop on cascading events
- E3-1 #2: Permission cache listeners fire-and-forget invisible to drain()
- E3-3 #2: DLQ Redis connection closes before drain() completes
- E3-1 #6: No handler execution timeout — hung handler blocks shutdown indefinitely

These collectively mean graceful shutdown is fragile. In production, a SIGTERM could result in lost events, incomplete retries, or dangling Redis connections.

### 7. DLQ Not Company-Scoped

E3-3 dev notes explicitly state: "DLQ entries are NOT company-scoped. Events from all companies flow through the same event bus and DLQ." This is an intentional design decision (infrastructure-level), but it means multi-tenant isolation doesn't extend to the DLQ admin view. An admin from one company could potentially see event payloads from another company's events.

---

## Technical Debt

### Inherited from E2b (STILL UNRESOLVED — 19 items, originally 21, 2 resolved)

| # | Issue | Severity | Source | Status |
|---|-------|----------|--------|--------|
| 1 | ~~42 test failures~~ | ~~CRITICAL~~ | ~~E2b #1~~ | :white_check_mark: Resolved in E3 |
| 2 | E2b-6 never implemented — FR230 undelivered | CRITICAL | E2b #2 | Still unresolved |
| 3 | Privilege escalation: ADMIN can create SUPER_ADMIN | CRITICAL | E2 #1 | Still unresolved (3 epics) |
| 4 | JWT claims not validated after signature | CRITICAL | E2 #2 | Still unresolved (3 epics) |
| 5 | Non-null assertion on payload.sub | CRITICAL | E2 #3 | Still unresolved (3 epics) |
| 6 | Duplicate listener accumulation | HIGH | E2b #6 | Still unresolved |
| 7 | JSON.parse('null') crash in field-filter | HIGH | E2b #7 | Still unresolved |
| 8 | Field filtering only on GET | HIGH | E2b #8 | Still unresolved |
| 9 | VIEWER regression on company switch | MEDIUM | E2b #9 | Still unresolved |
| 10 | Self-deactivation not prevented | HIGH | E2 #4 | Still unresolved (3 epics) |
| 11 | Company-ID enumeration | HIGH | E2 #5 | Still unresolved (3 epics) |
| 12 | baseCurrencyCode mutable | HIGH | E2 #6 | Still unresolved (3 epics) |
| 13 | setNotFoundHandler missing | HIGH | E2 #8 | Still unresolved (3 epics) |
| 14 | Orchestrator bug (skipped E2b-6) | HIGH | E2b #14 | Still uninvestigated |
| 15 | ~~Zero-failures gate~~ | ~~HIGH~~ | ~~E2b #15~~ | :white_check_mark: Effectively enforced |
| 16 | Fragile enum mock pattern | MEDIUM | E2b #17 | Still unresolved |
| 17 | ACTION_FLAG_MAP duplication | MEDIUM | E2b #18 | Still unresolved |
| 18-20 | E1 carry-forward (3 items) | HIGH | E1 Retro | Still unverified (4 epics) |

### New from E3 (11 HIGH items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 21 | `drain()` infinite loop on cascading event cycles | HIGH | E3-1 CR #1 |
| 22 | Permission cache listeners fire-and-forget — invisible to drain() | HIGH | E3-1 CR #2 |
| 23 | Event payloads passed by reference — mutation risk | HIGH | E3-1 CR #3 |
| 24 | `accessGroup.updated` audit has no beforeData/afterData — compliance gap | HIGH | E3-2 CR #1 |
| 25 | No sensitive data stripping from audit JSONB payloads | HIGH | E3-2 CR #2 |
| 26 | `aiConfidence` allows values outside 0-1 range | HIGH | E3-2 CR #3 |
| 27 | `once()` handler `fired` flag reset enables double-execution | HIGH | E3-3 CR #1 |
| 28 | Fastify onClose hook ordering — DLQ connection closes before drain() | HIGH | E3-3 CR #2 |
| 29 | Reprocess route silently swallows markReprocessed failure | HIGH | E3-3 CR #3 |
| 30 | DLQ reprocess endpoint doesn't validate eventName | HIGH | E3-3 CR #4 |
| 31 | Missing GET /dead-letter-queue/:id route — API contract gap | HIGH | E3-3 CR #5 |

### Selected MEDIUM Items from E3

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 32 | Missing `user.accessGroups.revoked` handler in permission cache | MEDIUM | E3-1 CR #4 |
| 33 | `once()` handlers cannot be cancelled via `off()` | MEDIUM | E3-1 CR #5 |
| 34 | No handler execution timeout — hung handler blocks shutdown | MEDIUM | E3-1 CR #6 |
| 35 | `approval.autoEscalated` naming mismatch with Event Catalog | MEDIUM | E3-1 CR #8 |
| 36 | Migration drops/recreates partial unique indexes — brief integrity gap | MEDIUM | E3-2 CR #4 |
| 37 | COUNT(*) on every paginated audit query — O(N) at scale | MEDIUM | E3-2 CR #5 |
| 38 | `settings.updated` event payload missing companyId | MEDIUM | E3-2 CR #8 |
| 39 | No input validation on DLQ reprocess `id` parameter | MEDIUM | E3-3 CR #6 |
| 40 | DLQ `list()` returns empty array on Redis failure — indistinguishable from empty DLQ | MEDIUM | E3-3 CR #7 |
| 41 | IdempotencyGuard singleton created at import time with no lifecycle cleanup | MEDIUM | E3-3 CR #10 |
| 42 | Cursor pagination unreliable with concurrent DLQ additions | MEDIUM | E3-3 CR #11 |

**Total Active Debt Inventory: 42 items (4 CRITICAL, 19 HIGH, 14 MEDIUM, 5 LOW)**

---

## E3b Preview

**Epic E3b:** Platform API + AI Gateway
- 5 stories: Platform API Server, Tenant Management API, AI Gateway (Service Provider Adapters), Platform Client SDK, Plan & Billing Management
- **Status:** backlog — no epic file exists yet
- **Dependencies on E3:** EventBus infrastructure, audit trail (platform-level operations should be audited), retry/DLQ (tenant provisioning should be resilient)
- **New tech likely:** Separate Fastify server instance for platform API, AI provider SDKs (Anthropic, OpenAI), Stripe or payment integration
- **Key risk:** E3b introduces a second API server (`apps/platform-api/`), which means EventBus, audit, and DLQ may need to be shared or replicated across servers
- **Epic file not yet created:** Sprint planning and story creation have not been run for E3b

**E3 Dependencies that E3b relies on:**
- EventBus + BusinessEvents interface (platform events should use the same typed system)
- AuditService pattern (platform operations need audit trail)
- RetryHandler + DLQ (tenant provisioning, AI gateway calls need resilience)
- Redis infrastructure (already set up for BullMQ — AI gateway may use same Redis)

**Preparation concerns:**
- E3b epic file needs to be created via the BMAD workflow
- Platform API server (`apps/platform-api/`) was scaffolded in E1 but may need updates
- AI Gateway requires provider API keys and configuration
- 4 CRITICAL + 19 HIGH debt items should be triaged before starting E3b

---

## Significant Discoveries

### Discovery 1: Technical Debt Growth Rate is Unsustainable

**Finding:** Across E0-E3 (6 epics including E2b), the project has accumulated 42 tracked technical debt items (4 CRITICAL, 19 HIGH). E3 added 11 new HIGH issues while resolving only 2 items from the E2b backlog. The debt is growing at roughly 10+ HIGH items per epic with near-zero resolution rate.

**Impact on E3b:** Building Platform API and AI Gateway on top of 42 unresolved issues — including 3 CRITICAL security vulnerabilities that are now 3 epics overdue — increases compounding risk. Security issues in auth will affect platform-level operations. Shutdown fragility will affect multi-server deployment.

**Recommendation:** A dedicated stability sprint addressing at minimum the 4 CRITICAL and top 10 HIGH items is strongly recommended before E3b. Alternatively, a "tech debt budget" of 2-3 fix tasks per story should be mandated.

### Discovery 2: Audit Trail Has a Sensitive Data Leak Path

**Finding:** E3-2 CR #2 identified that `beforeData`/`afterData` JSONB columns will persist raw entity snapshots without stripping sensitive fields. Since the audit log is immutable (PostgreSQL RULE prevents DELETE), any sensitive data written there is permanent. Currently, only non-sensitive data is audited (login events, access group changes), but when business modules (E14+) start emitting entity snapshots, fields like `passwordHash`, `mfaSecret`, `bankAccountNumber`, and `apiTokens` will be exposed.

**Impact:** This must be fixed BEFORE any module emits entity snapshots. A field stripping/allowlist mechanism in `audit.mappings.ts` would prevent sensitive data from reaching the immutable log.

**Recommendation:** Add sensitive data stripping to the audit mapping registry. Each mapping should define which fields to include/exclude from beforeData/afterData. This is a HIGH priority fix for E3b or a dedicated debt sprint.

### Discovery 3: Graceful Shutdown is Not Production-Ready

**Finding:** Four separate CR issues across E3-1 and E3-3 identify shutdown fragility: infinite loop risk in drain(), fire-and-forget handlers invisible to drain(), DLQ connection closing before drain() completes, and no handler execution timeout. Together, these mean that a SIGTERM in production could result in lost events, incomplete audit writes, or process hangs.

**Impact on E3b:** E3b introduces a second API server. Both servers need graceful shutdown. The current fragility will be duplicated unless fixed.

**Recommendation:** A shutdown hardening task should be part of E3b preparation: add timeout to drain(), fix onClose ordering, add cycle detection.

---

## Action Items

### CRITICAL — Before E3b

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Implement E2b-6 OR explicitly descope FR230 from MVP | PM | CRITICAL |
| 2 | Fix privilege escalation: ADMIN can create SUPER_ADMIN (E2 #1, 3 epics overdue) | Dev | CRITICAL |
| 3 | Validate JWT claims after signature verification (E2 #2, 3 epics overdue) | Dev | CRITICAL |
| 4 | Fix payload.sub non-null assertion (E2 #3, 3 epics overdue) | Dev | CRITICAL |

### HIGH — Before E3b

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 5 | Add sensitive data stripping to audit JSONB payloads (E3-2 CR #2) | Dev | HIGH |
| 6 | Fix drain() infinite loop — add cycle detection or max iterations (E3-1 CR #1) | Dev | HIGH |
| 7 | Fix Fastify onClose hook ordering — drain() before Redis disconnect (E3-3 CR #2) | Dev | HIGH |
| 8 | Fix event payload reference sharing — shallow copy in emit() (E3-1 CR #3) | Dev | HIGH |
| 9 | Add aiConfidence CHECK constraint (0.0-1.0) (E3-2 CR #3) | Dev | HIGH |
| 10 | Fix reprocess route error handling — don't swallow markReprocessed failure (E3-3 CR #3) | Dev | HIGH |
| 11 | Add eventName validation to DLQ reprocess endpoint (E3-3 CR #4) | Dev | HIGH |
| 12 | Implement GET /dead-letter-queue/:id route (E3-3 CR #5) | Dev | HIGH |
| 13 | Fix once() double-execution bug (E3-3 CR #1) | Dev | HIGH |
| 14 | Fix duplicate listener accumulation in permission cache (E2b #6) | Dev | HIGH |

### Process Improvements

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 15 | Introduce "tech debt budget" — 2-3 fix tasks per story from debt backlog | SM | HIGH |
| 16 | Increase CR iteration limit to 5 for HIGH-issue stories | SM | HIGH |
| 17 | Add shutdown integration test to CI pipeline | Dev | MEDIUM |
| 18 | Investigate orchestrator bug that skipped E2b-6 (E2b #14) | SM | MEDIUM |
| 19 | Create E3b epic file via BMAD workflow | SM | HIGH |

### E1 Carry-Forward (4 epics overdue)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 20 | Verify ON DELETE SET NULL → RESTRICT on UserCompanyRole | Dev | HIGH |
| 21 | Verify ViewScope enum alignment with spec | Dev | MEDIUM |
| 22 | Verify nextNumber() requires transaction parameter | Dev | MEDIUM |

---

## E3b Preparation Tasks

**CRITICAL (Must complete before E3b starts):**
- [ ] Decide on E2b-6 — implement or descope FR230 (#1)
- [ ] Complete 3 CRITICAL security fixes #2-4 (E2 items, 3 epics overdue)
- [ ] Create E3b epic file via BMAD workflow (#19)

**HIGH (Should complete before E3b):**
- [ ] Add sensitive data stripping to audit service (#5)
- [ ] Fix shutdown ordering and drain() issues (#6, #7)
- [ ] Fix event payload reference sharing (#8)
- [ ] Fix DLQ route issues (#10, #11, #12)
- [ ] Fix once() double-execution (#13)
- [ ] Fix permission cache duplicate listeners (#14)

**MEDIUM (Can parallel with early E3b):**
- [ ] Add aiConfidence CHECK constraint (#9)
- [ ] Introduce tech debt budget process (#15)
- [ ] Increase CR iteration limit (#16)
- [ ] Add shutdown integration test (#17)
- [ ] Verify E1 carry-forward items (#20-22)

---

## Readiness Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Epic Completion | GREEN | 3/3 stories done (100%) |
| Test Suite Health | GREEN | All API tests passing (restored from E2b's 42 failures) |
| Security Posture | RED | 3 CRITICAL issues from E2 still open — now 3 epics overdue |
| Technical Debt | HIGH | 42 tracked items (4 CRITICAL, 19 HIGH) — grew by 9 net in E3 |
| E3b Dependencies | YELLOW | EventBus/Audit/DLQ infrastructure works, but shutdown fragility and audit data leak risk exist |
| E3b Epic Definition | RED | No epic file exists — sprint planning not yet run |
| Deployment | N/A | Backend API, no production deployment yet |

**Verdict:** Epic E3 delivered strong cross-cutting infrastructure — EventBus, AuditService, and Retry+DLQ — achieving 100% story completion and restoring the test suite. However, technical debt continues to grow (42 items), security vulnerabilities from E2 are 3 epics overdue, and the audit service has a sensitive data leak path that must be addressed before business modules go live. **A stability sprint or tech debt budget per story is recommended before E3b.**

---

## Key Takeaways

1. **Event infrastructure is architecturally sound** — EventBus, AuditService, and Retry+DLQ provide the typed, async, resilient event backbone that all 11 MVP modules need. The dependency injection pattern and backward-compatible migration approach were well-executed.
2. **Test suite restoration is the biggest win** — Fixing 42 test failures from E2b and maintaining clean test runs throughout E3 restored confidence in the quality gate. This must be protected going forward.
3. **Technical debt is growing unsustainably** — 42 active items (4 CRITICAL, 19 HIGH), growing at ~10 HIGH/epic with near-zero resolution. The 3 CRITICAL security fixes from E2 are now 3 epics overdue. A structural change is needed — either a dedicated fix sprint or a mandatory debt budget per story.
4. **Audit service needs sensitive data protection before business modules** — The immutable audit log will permanently store any data written to it. A stripping/allowlist mechanism must be added before E14+ start emitting entity snapshots.
5. **Graceful shutdown is fragile** — Four independent issues affect shutdown reliability. Production deployment requires these to be fixed.
6. **Code review process is thorough but structurally unable to resolve all issues** — The 3-iteration CR limit creates a pattern where debt accumulates. Increasing to 5 iterations or adding a "fix top 3 HIGH issues" post-CR step would help.
7. **100% story delivery is achievable** — E3 proved that well-scoped epics (3 stories, clear dependencies) can be fully delivered, unlike E2b's 83%.

---

## Next Steps

1. **Stability Sprint or Tech Debt Budget** — Address top 4 CRITICAL + top 10 HIGH items before E3b
2. **Decide on E2b-6** — Implement export/import defaults or formally descope FR230
3. **Create E3b Epic File** — Run BMAD sprint planning and story creation for E3b
4. **Then E3b** — Platform API + AI Gateway, building on stable infrastructure

---

## Team Participants

- Bob (Scrum Master) — Facilitator
- Alice (Product Owner) — Business perspective
- Charlie (Senior Dev) — Technical analysis
- Dana (QA Engineer) — Quality assessment
- Elena (Junior Dev) — Growth perspective
- Mohammed (Project Lead) — Strategic direction

---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-21'
---

# Test Design: Epic E3b - Platform API + AI Gateway

**Date:** 2026-02-21
**Author:** Mohammed
**Status:** Draft
**Mode:** Epic-Level (Phase 4)

---

## Executive Summary

**Scope:** Full test design for Epic E3b — Platform API + AI Gateway

Epic E3b delivers the platform infrastructure layer: a separate Platform API (Fastify) with its own database, authentication system (mandatory MFA for admins), tenant lifecycle management, AI Gateway service routing all LLM calls through quota enforcement, a Platform Client SDK for ERP runtime integration, and plan/billing management. This is the most security-critical and architecturally complex foundation epic — it governs access, billing, and AI usage for every tenant.

**Risk Summary:**

- Total risks identified: 14
- High-priority risks (score >= 6): 6
- Critical categories: SEC (2), DATA (1), TECH (2), PERF (1)

**Coverage Summary:**

- P0 scenarios: 6 (~25-40 hours)
- P1 scenarios: 7 (~20-35 hours)
- P2 scenarios: 8 (~10-20 hours)
- P3 scenarios: 4 (~5-10 hours)
- **Total effort**: ~60-105 hours (~1.5-3 weeks)

> **Note:** P0/P1/P2/P3 = priority classification based on risk and criticality, NOT execution timing. See Execution Strategy for when tests run.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Platform Admin UI** | E3b is backend infrastructure only; Platform Admin Portal frontend is a later epic (E13b) | Backend API tests validate all admin workflows; UI tests added when portal is built |
| **Stripe payment integration** | Billing model tracks status but actual payment processing via Stripe is deferred | Billing enforcement tested via direct API state management; Stripe webhook integration tested in billing epic |
| **Tenant database provisioning** | PROVISIONING→ACTIVE transition requires actual DB creation; E3b tests use pre-seeded dev-tenant | Transition logic tested with status updates; actual provisioning covered in dedicated infrastructure epic |
| **Multi-region deployment** | Platform API runs single-region in MVP | Region-specific testing added when multi-region architecture is implemented |
| **Anomaly detection algorithm** | BR-PLT-011 (3x rolling 7-day average spike detection) is informational only | Alert thresholds tested; sophisticated anomaly ML deferred to post-MVP |

---

## Risk Assessment

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | MFA bypass for PLATFORM_ADMIN — login succeeds without TOTP verification, granting full control of all tenants (BR-PLT-018, NFR48) | 3 | 3 | 9 | Enforce MFA check in auth middleware before JWT issuance; test login blocked without MFA; test MFA-disabled PLATFORM_ADMIN cannot login | Dev | Sprint E3b.1 |
| R-002 | SEC | Internal service token auth bypass — ERP-facing `/platform/*` endpoints accessible without valid service token, exposing tenant entitlements and AI quota data | 2 | 3 | 6 | Validate service token on every `/platform/*` request; reject regular platform JWTs on these routes; test with invalid/missing/wrong-type tokens | Dev | Sprint E3b.1 |
| R-003 | DATA | AI usage records lost — fire-and-forget recording fails without retry, violating zero-loss guarantee (NFR50). Incorrect billing, broken quota enforcement | 2 | 3 | 6 | Implement local retry queue (BullMQ) for usage records; test Platform API unreachable scenario; verify records delivered after recovery | Dev | Sprint E3b.3 |
| R-004 | TECH | Tenant state machine bypass — invalid transitions (e.g., ACTIVE→ARCHIVED) succeed, corrupting tenant lifecycle and breaking BR-PLT-001 | 2 | 3 | 6 | Guard every transition with valid-from-state check; return 422 for invalid transitions; test all 7 valid and ~5 invalid transitions exhaustively | Dev | Sprint E3b.2 |
| R-005 | PERF | Platform API entitlement check exceeds 50ms p95 (NFR46) — every ERP login and request checks entitlements; latency compounds across all tenants | 2 | 3 | 6 | Optimise queries with indexes on tenantId; cache entitlements in SDK (5-min TTL); benchmark under load | Dev | Sprint E3b.1 |
| R-009 | TECH | TenantProviderCredential model missing from Prisma schema — BYOK credential resolver (E3b.3) cannot function without this table; FR224 blocked | 3 | 2 | 6 | Add migration for TenantProviderCredential before E3b.3 implementation; unique constraint on [tenantId, providerId]; AES-256 encrypted storage | Dev | Pre-E3b.3 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-006 | DATA | Audit log immutability violation — PlatformAuditLog records modified or deleted via API, breaking NFR49 | 1 | 3 | 3 | Schema has no updatedAt; verify no update/delete endpoints exist; existing test validates schema | Dev |
| R-007 | TECH | Circuit breaker serves stale entitlements too long — SDK fails to detect Platform API recovery, serving degraded data beyond 10s window | 2 | 2 | 4 | Implement health-check probing during circuit-open state; verify degraded flag is set; test recovery timing | Dev |
| R-008 | TECH | AI Gateway fallback chain fails silently — fallback model lookup fails or fallbackUsed not recorded, masking provider failures | 2 | 2 | 4 | Test fallback resolution with mock provider errors; verify fallbackUsed and fallbackFrom fields in usage record | Dev |
| R-010 | OPS | Webhook delivery failures not detected — Platform pushes events but ERP webhook endpoint fails silently, causing stale entitlement caches | 2 | 2 | 4 | Log webhook delivery status; test ERP webhook handler with valid/invalid tokens; verify cache invalidation after webhook | Dev |
| R-011 | PERF | AI Gateway overhead exceeds 100ms (NFR47) — quota check + usage recording adds excessive latency to LLM calls | 2 | 2 | 4 | Quota check should be fast (cached/indexed); usage recording is fire-and-forget; benchmark end-to-end overhead | Dev |
| R-012 | BUS | Billing enforcement escalation miscalculated — wrong dunning progression affects tenant access; revenue loss or unwarranted suspension | 2 | 2 | 4 | Test all billing enforcement transitions (NONE→WARNING→READ_ONLY→SUSPENDED); verify webhook on each transition | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-013 | OPS | Health endpoint misrepresents system state — false positive/negative on DB or Redis connectivity | 1 | 2 | 2 | Monitor |
| R-014 | BUS | Plan change webhook not delivered within 30s (NFR51) — cache invalidation delayed | 1 | 2 | 2 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Platform database schema migrated and seeded (Plans, dev-tenant, PlatformUser)
- [ ] Platform API Fastify app running on separate port from ERP API
- [ ] TenantProviderCredential migration applied (required for E3b.3 BYOK tests)
- [ ] Redis available for entitlement caching (or in-memory LRU for dev)
- [ ] Internal service token configured in environment
- [ ] Test factories and fixtures for PlatformUser, Tenant, Plan, TenantAiQuota, TenantBilling created
- [ ] Existing platform-models.test.ts passing (seed data baseline)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] All 7 valid tenant lifecycle transitions tested
- [ ] All invalid tenant transitions confirmed to return 422
- [ ] MFA enforcement verified for PLATFORM_ADMIN
- [ ] AI Gateway quota enforcement verified (hard limit blocks, soft limit warns)
- [ ] Platform Client SDK circuit breaker and cache invalidation verified
- [ ] Performance benchmarks run for NFR46, NFR47, NFR51

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority classification based on risk and business criticality. Execution timing is covered separately in the Execution Strategy section.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (score >= 6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| Platform Admin Auth — MFA enforcement: login with MFA succeeds, login without MFA blocked for PLATFORM_ADMIN, invalid credentials rejected, TOTP verification flow (E3b.1 AC#2, AC#3, BR-PLT-018, NFR48) | API | R-001 | 5 | QA | Score=9 CRITICAL — platform compromise if bypassed |
| Internal Service Token Auth — valid token accepted on /platform/*, invalid/expired/missing token rejected, regular JWT rejected on service routes (E3b.1 AC#5) | API | R-002 | 4 | QA | Two auth systems must be completely isolated |
| Tenant Lifecycle State Machine — all 7 valid transitions succeed with correct status/event/audit, all ~5 invalid transitions return 422 (E3b.2 AC#1-#6, BR-PLT-001) | API | R-004 | 12 | QA | State machine is the backbone of tenant management |
| AI Gateway Quota Enforcement — check before every call, hard limit blocks when aiHardLimit=true, hard limit allows overage when aiHardLimit=false, usage recorded with retry (E3b.3 AC#2-#5, BR-PLT-008, NFR50) | API + Unit | R-003 | 6 | QA | Zero-loss guarantee requires retry queue testing |
| Platform Audit Immutability — no update/delete endpoints exposed, all state-changing admin actions auto-logged with actor/action/target/IP (E3b.1 AC#6, BR-PLT-016, BR-PLT-017, NFR49) | API | R-001 | 4 | QA | Compliance requirement — append-only by design |
| Entitlement Endpoint Performance — response time <50ms p95 under concurrent load (NFR46, E3b.1 AC#5) | API | R-005 | 2 | QA | Performance boundary — affects every ERP request |

**Total P0**: ~33 tests, ~25-40 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-5) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| Tenant CRUD — create with plan assignment, list with filters (status, plan, search), get detail with all relations, update settings (E3b.2 AC#1) | API | - | 6 | QA | Foundation for all tenant management |
| Webhook Delivery & Cache Invalidation — tenant.suspended/reactivated/archived/plan_changed webhooks push to ERP, ERP webhook handler validates service token, cache invalidated on receipt (E3b.2 AC#3-#5, E3b.4 AC#4, AC#6) | API | R-010 | 8 | QA | Cross-story integration: E3b.2 → E3b.4 |
| Platform Client SDK Caching — getEntitlements cached with 5-min TTL, checkModuleAccess from cache (no network), checkAiQuota always live (no cache), cache key structure correct (E3b.4 AC#1-#3) | Unit + API | R-007 | 6 | QA | Caching is the primary performance strategy |
| Circuit Breaker — Platform unreachable >10s triggers circuit-open, stale cache served with degraded:true, recovery on Platform reconnection (E3b.4 AC#5, BR-PLT-020) | Unit | R-007 | 4 | QA | Graceful degradation critical for ERP availability |
| AI Gateway Provider Adapters — Anthropic adapter normalisation, OpenAI adapter normalisation, vendor credential resolution, unified LLMResponse format (E3b.3 AC#7) | Unit | R-008 | 6 | QA | Multi-provider abstraction must be provider-agnostic |
| Plan CRUD & Assignment — create plan with limits and modules, plan code uniqueness, assign plan to tenant with webhook push, plan change immediate effect (E3b.5 AC#1-#2, AC#6, BR-PLT-006) | API | - | 5 | QA | Plan changes affect all entitlement checks |
| Billing Enforcement State Machine — valid enforcement transitions (NONE→WARNING→READ_ONLY→SUSPENDED), invalid transitions rejected, webhook on each change (E3b.5 AC#4-#5, BR-PLT-004, BR-PLT-005) | API | R-012 | 6 | QA | Revenue and access control implications |

**Total P1**: ~41 tests, ~20-35 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|------------|-------|-------|
| Suspend/Reactivate/Archive Operations — suspend requires reason, archive is irrecoverable from UI, reactivate restores ACTIVE status (E3b.2 AC#3-#5, BR-PLT-002, BR-PLT-003) | API | - | 4 | QA | Edge cases of state machine transitions |
| Module & Feature Flag Management — PUT /admin/tenants/:id/modules, PUT /admin/tenants/:id/feature-flags, tenant.modules_changed webhook on change (E3b.2) | API | - | 4 | QA | Secondary tenant configuration |
| Impersonation Sessions — start with mandatory reason (BR-PLT-012), time-limited session (BR-PLT-013, default 60 min), all actions audit-logged (BR-PLT-015), end session (E3b.2) | API | - | 5 | QA | Security-sensitive but lower frequency |
| Billing Status Endpoint — return all fields (stripeCustomerId, subscriptionStatus, dunningLevel, enforcementAction, etc.), dunning level tracking (E3b.5 AC#3) | API | - | 3 | QA | Read-only endpoint, lower risk |
| AI Quota Threshold Alerts — soft limit warning at 80%, alert notification at 50%, hard limit at 100%, threshold behaviour differs by plan (E3b.3 AC#2-#3, BR-PLT-010) | Unit + API | - | 4 | QA | Quota threshold progression |
| BYOK Credential Resolution — tenant key from TenantProviderCredential if exists, vendor platform key fallback, AES-256 decryption at call time (E3b.3 AC#7, FR224) | Unit | R-009 | 3 | QA | Blocked until schema migration applied |
| AI Gateway Fallback Chain — primary model failure (rate limit, 5xx, timeout >10s) triggers fallback, record fallbackUsed and fallbackFrom in usage data (E3b.3 AC#8) | Unit | R-008 | 3 | QA | Resilience feature for AI calls |
| Health Endpoint — DB connectivity check, Redis availability, uptime (E3b.1 AC#4) | API | R-013 | 3 | QA | Monitoring infrastructure |

**Total P2**: ~29 tests, ~10-20 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
|-------------|-----------|------------|-------|-------|
| Performance: AI Gateway overhead <100ms p95 (NFR47) — measure quota check + recording latency vs direct LLM call | API | 3 | QA | Nightly benchmark |
| Performance: Cache invalidation <30s end-to-end (NFR51) — time from admin suspend to ERP blocking requests | API | 2 | QA | Nightly benchmark |
| AI Usage CSV Export — GET /admin/tenants/:id/ai/usage with CSV format, date range filtering (E3b.5) | API | 2 | QA | Admin reporting feature |
| Platform User Management — GET/POST/PATCH /admin/users, PLATFORM_ADMIN role required for management (E3b.1) | API | 4 | QA | Admin user CRUD |

**Total P3**: ~11 tests, ~5-10 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min; defer only if expensive or long-running.

| Execution Tier | What Runs | When | Target Duration |
|----------------|-----------|------|-----------------|
| **Every PR** | All P0, P1, P2 functional API and unit tests | On PR creation/update | <10-15 min (Playwright parallelisation) |
| **Nightly** | Performance benchmarks (NFR46, NFR47, NFR51), circuit breaker timing tests, stress tests | Scheduled nightly | ~30-60 min |
| **Weekly** | Full regression including P3 tests, AI provider integration tests with real endpoints | Scheduled weekly | ~1-2 hours |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | ~33 | ~25-40 hours | Complex auth, state machine, quota enforcement setup |
| P1 | ~41 | ~20-35 hours | Standard API tests with webhook/cache integration |
| P2 | ~29 | ~10-20 hours | Secondary features, edge cases |
| P3 | ~11 | ~5-10 hours | Performance benchmarks, admin CRUD |
| **Total** | **~114** | **~60-105 hours** | **~1.5-3 weeks** |

### Prerequisites

**Test Data:**

- PlatformUser factory (with/without MFA, different roles)
- Tenant factory (with Plan, Billing, AiQuota relations)
- Plan factory (core/pro/enterprise variants)
- TenantAiUsage factory (for quota threshold testing)
- TenantProviderCredential factory (for BYOK testing — requires schema migration)

**Tooling:**

- Vitest for unit tests (AI Gateway, Platform Client SDK)
- Playwright API testing for Platform API integration tests
- Mock LLM provider for AI Gateway adapter tests (no real API calls in CI)
- Redis test instance (or in-memory mock) for entitlement caching tests

**Environment:**

- Separate Platform database with migrations applied
- Platform API running on dedicated port
- Internal service token configured via environment variable
- Redis instance available for caching tests

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (auth, state machine, quota): >= 80%
- **Security scenarios** (MFA, service token, audit): 100%
- **Business logic** (billing enforcement, plan management): >= 70%
- **Edge cases** (circuit breaker, fallback chain): >= 50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>= 6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Performance targets met (NFR46 <50ms, NFR47 <100ms)
- [ ] MFA enforcement confirmed for PLATFORM_ADMIN (R-001)
- [ ] Zero-loss AI usage recording confirmed (R-003)

---

## Mitigation Plans

### R-001: MFA Bypass for PLATFORM_ADMIN (Score: 9)

**Mitigation Strategy:**
1. Auth middleware enforces MFA verification BEFORE JWT issuance — no code path allows skipping
2. Separate middleware for PLATFORM_ADMIN vs PLATFORM_VIEWER roles
3. Login endpoint returns 403 with `MFA_REQUIRED` error if `mfaEnabled=false` for PLATFORM_ADMIN
4. Test: Login with valid credentials but no MFA → must fail
5. Test: Login with valid credentials + invalid TOTP → must fail
6. Test: Login with valid credentials + valid TOTP → succeeds, JWT issued

**Owner:** Dev
**Timeline:** Sprint E3b.1
**Status:** Planned
**Verification:** P0 test suite for auth must pass 100%

### R-002: Internal Service Token Auth Bypass (Score: 6)

**Mitigation Strategy:**
1. `/platform/*` routes use dedicated middleware that only accepts service bearer tokens
2. Regular platform JWTs (from admin login) rejected on `/platform/*` routes
3. Service tokens validated against environment-configured secret
4. Test: Regular JWT on /platform/tenants/:id/entitlements → 401
5. Test: No token → 401; Invalid token → 401; Valid service token → 200

**Owner:** Dev
**Timeline:** Sprint E3b.1
**Status:** Planned
**Verification:** Service token auth tests pass; no JWT leakage to service routes

### R-003: AI Usage Records Lost (Score: 6)

**Mitigation Strategy:**
1. Usage recording is fire-and-forget with local BullMQ retry queue
2. If Platform API is unreachable, record queued locally with exponential backoff
3. On Platform API recovery, queued records flushed in order
4. TenantAiUsage has unique `requestId` for idempotency — duplicates rejected safely
5. Test: Record with Platform API down → queued; Platform recovers → record delivered

**Owner:** Dev
**Timeline:** Sprint E3b.3
**Status:** Planned
**Verification:** Usage records verified in database after simulated outage+recovery

### R-004: Tenant State Machine Bypass (Score: 6)

**Mitigation Strategy:**
1. State transition guard function validates from-state before applying transition
2. Invalid transitions return 422 with `INVALID_STATE_TRANSITION` error code
3. All 7 valid transitions tested: PROVISIONING→ACTIVE, ACTIVE→SUSPENDED, ACTIVE→READ_ONLY, READ_ONLY→ACTIVE, READ_ONLY→SUSPENDED, SUSPENDED→ACTIVE, SUSPENDED→ARCHIVED
4. Invalid transitions tested: ACTIVE→ARCHIVED, PROVISIONING→SUSPENDED, ARCHIVED→any, SUSPENDED→READ_ONLY

**Owner:** Dev
**Timeline:** Sprint E3b.2
**Status:** Planned
**Verification:** State machine test suite covers all transitions exhaustively

### R-005: Entitlement Check Exceeds 50ms p95 (Score: 6)

**Mitigation Strategy:**
1. Optimise query with indexes on tenantId (already indexed in schema)
2. Include Plan, ModuleOverrides, FeatureFlags in single query with Prisma includes
3. SDK caches result with 5-min TTL (most checks served from cache)
4. Benchmark under concurrent load in nightly performance suite

**Owner:** Dev
**Timeline:** Sprint E3b.1 + E3b.4
**Status:** Planned
**Verification:** Nightly p95 latency benchmark stays below 50ms threshold

### R-009: TenantProviderCredential Model Missing (Score: 6)

**Mitigation Strategy:**
1. Create Prisma migration adding TenantProviderCredential model before E3b.3 implementation
2. Fields: id, tenantId, providerId, encryptedApiKey, keyHint, isActive, createdAt, updatedAt
3. Unique constraint on [tenantId, providerId]
4. Integration test: credential resolver finds tenant BYOK key → uses it; no BYOK → falls back to vendor key

**Owner:** Dev
**Timeline:** Pre-E3b.3
**Status:** Planned
**Verification:** Migration applies cleanly; credential resolver unit tests pass

---

## Assumptions and Dependencies

### Assumptions

1. Platform database schema (from E1) is migrated and seeded with 3 plans, dev-tenant, and platform admin user
2. Redis is available for entitlement caching in test environment (or in-memory LRU for local dev)
3. Internal service token is pre-configured as environment variable (not dynamically generated)
4. AI provider APIs (Anthropic, OpenAI) are mocked in CI — no real API calls during automated testing
5. BullMQ is available for retry queue testing (usage record zero-loss)

### Dependencies

1. **E1 Platform DB Schema** — Must be migrated before any E3b tests (already complete)
2. **TenantProviderCredential migration** — Required before E3b.3 BYOK tests (must be created)
3. **Redis** — Required for entitlement caching tests (Sprint E3b.4)
4. **BullMQ** — Required for AI usage retry queue tests (Sprint E3b.3)

### Risks to Plan

- **Risk**: TenantProviderCredential schema gap delays E3b.3
  - **Impact**: BYOK credential resolver tests blocked
  - **Contingency**: Create migration as first task of E3b.3; BYOK tests can be deferred if migration delayed

- **Risk**: AI provider mock complexity underestimated
  - **Impact**: Provider adapter tests take longer than estimated
  - **Contingency**: Use simple request/response mocks first; add streaming/error mocks incrementally

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **ERP API (apps/api)** | Webhook handler receives platform events; auth middleware checks entitlements via SDK | E2/E2b auth tests must pass; webhook endpoint tests added in E3b.4 |
| **Platform DB (apps/platform-api/prisma)** | All E3b stories read/write Platform DB | platform-models.test.ts (existing) must remain green |
| **packages/platform-client** | New SDK consumed by ERP services for entitlement checks | Currently empty stub; E3b.4 creates full implementation |
| **packages/ai-gateway** | New package consumed by all business modules for LLM calls | Currently does not exist; E3b.3 creates it |
| **E3 Event Bus** | Platform events may eventually flow through ERP event bus | E3 event bus tests must pass; no direct coupling in E3b |
| **E2/E2b RBAC** | Entitlement checks complement RBAC permission checks | E2/E2b RBAC integration tests must pass |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (probability x impact scoring, gate decisions)
- `probability-impact.md` — Risk scoring methodology (1-3 scales, action thresholds)
- `test-levels-framework.md` — Test level selection (unit/integration/E2E decision matrix)
- `test-priorities-matrix.md` — P0-P3 prioritization (criteria, coverage targets, execution order)

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/` (FR193-FR225, NFR46-NFR51)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E3b.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/` (Section 2.31)
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/20-platform-api-internal-erp-facing-endpoints.md`, `21-platform-admin-api-admin-facing-endpoints.md`
- Data Models: `_bmad-output/planning-artifacts/data-models/5-platform-database-models-section-231.md`
- State Machines: `_bmad-output/planning-artifacts/state-machine-reference.md` (Sections 20.1-20.3)
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (Section 14b: BR-PLT-001 to BR-PLT-021)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md` (Section 19: Platform Events)

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (Step-File Architecture)

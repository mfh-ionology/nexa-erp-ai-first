---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-11'
---

# Test Design: Epic E13b - Platform Admin Portal

**Date:** 2026-03-11
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E13b — Platform Admin Portal (frontend)

**Epic Overview:** E13b builds a separate `apps/platform-admin` React application providing a control plane for managing tenants, billing, AI usage, impersonation, and compliance auditing. This is a **frontend-only** epic; the backend Platform API (E3b) is already implemented with 8 test files covering API routes and services.

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (>=6): 5
- Critical (score 9): 1 (Impersonation session security bypass)
- Critical categories: SEC (3), DATA (1), BUS (1)

**Coverage Summary:**

- P0 scenarios: 20 (~20-30 hours)
- P1 scenarios: 30 (~25-40 hours)
- P2 scenarios: 16 (~8-16 hours)
- P3 scenarios: 8 (~3-6 hours)
- **Total effort**: ~56-92 hours (~1.5-2.5 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Platform API backend logic** | Already implemented and tested in E3b (8 test files) | E3b tests cover all API routes, state machines, and business rules |
| **AI Gateway quota enforcement** | Backend service tested in E3b.3 | E3b tests cover quota checks, usage recording, provider adapters |
| **Webhook delivery infrastructure** | Platform Client SDK tested in E3b.4 | E3b tests cover webhook delivery, cache invalidation, circuit breaker |
| **ERP tenant application changes** | Impersonation banner in ERP is a cross-cutting concern for E13b.5 only | E2E test verifies banner rendering; full ERP integration is out of scope |
| **Mobile responsiveness** | Platform Admin is desktop-first (admin tool) | P3 exploratory test covers basic viewport adaptations |
| **Monitoring dashboard (FR211-FR213)** | Not included in E13b stories | Deferred to future epic; health/jobs/maintenance endpoints exist in backend |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | **Impersonation session security bypass** — Frontend fails to enforce mandatory reason validation, time limits, or non-dismissable banner. Admin could impersonate without accountability (BR-PLT-012/013/014) | 3 | 3 | 9 | E2E tests for reason validation, banner DOM immutability, session expiry countdown, dual audit verification | QA | Sprint 1 |
| R-002 | SEC | **PLATFORM_VIEWER write action exposure** — RBAC UI gating incomplete; VIEWER sees enabled suspend/archive/enforcement buttons. Backend rejects but UX exposes dangerous actions (FR197 AC#5) | 2 | 3 | 6 | E2E tests with VIEWER role verifying all write actions hidden/disabled across every page | QA | Sprint 1 |
| R-003 | SEC | **Platform MFA bypass through frontend flow** — Auth flow allows skipping MFA verification or doesn't enforce mandatory MFA for PLATFORM_ADMIN (BR-PLT-018, NFR48) | 2 | 3 | 6 | E2E auth tests: MFA challenge required, skip blocked, PLATFORM_ADMIN cannot proceed without MFA | QA | Sprint 1 |
| R-004 | DATA | **Irreversible archive without sufficient safeguards** — Archive is permanent (BR-PLT-003); confirmation dialog bypassable, dismissible, or doesn't communicate irreversibility | 2 | 3 | 6 | E2E test: archive requires explicit confirmation with irreversibility warning; "Cancel" returns to tenant detail | QA | Sprint 1 |
| R-005 | BUS | **Billing enforcement propagation failure hidden from admin** — UI shows enforcement change as successful but webhook fails silently; admin believes tenant is restricted while it continues operating (BR-PLT-002, NFR51) | 2 | 3 | 6 | API integration test: enforcement PATCH response includes webhook delivery status; UI displays warning if webhook delivery is pending/failed | QA/Dev | Sprint 1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-006 | TECH | **Platform admin app routing isolation** — Separate Vite app must have independent routing, auth context, and API client. Misconfigured base URL or shared state with tenant ERP causes silent failures | 2 | 2 | 4 | Integration test: app boots independently, routes to login, API client targets Platform Admin API base URL | Dev |
| R-007 | PERF | **AI usage dashboard rendering performance** — 30-day trend charts, per-tenant breakdown, quota progress bars with hundreds of tenants may cause slow page loads exceeding NFR46 (<2s) | 2 | 2 | 4 | Smoke test with mock data for 500 tenants; verify page load <2s | QA |
| R-008 | DATA | **Audit log cursor-based pagination accuracy** — High-volume append-only logs may skip/duplicate entries during page traversal if new records inserted concurrently | 2 | 2 | 4 | API test: paginate through 1000 records, verify no gaps or duplicates; test with concurrent inserts | QA |
| R-009 | TECH | **Tenant status colour-coding inconsistency** — Status badges must match specific colours (ACTIVE=green, SUSPENDED=red, READ_ONLY=amber, ARCHIVED=grey) combined with billing enforcement indicators | 2 | 2 | 4 | Component test: StatusBadge renders correct colour and label for all TenantStatus x BillingStatus combinations | Dev |
| R-010 | BUS | **Plan change comparison inaccuracy** — Comparison view (old vs new limits) must accurately show module entitlements, user limits, AI token changes. Inaccurate comparison leads to wrong plan assignments | 1 | 3 | 3 | E2E test: assign plan, verify comparison view shows correct delta for modules, users, AI tokens | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-011 | OPS | CSV export completeness — AI usage and audit log CSV exports may be incomplete if filter state isn't serialized to export request | 1 | 2 | 2 | Monitor |
| R-012 | TECH | Dark sidebar theme consistency — "PLATFORM ADMIN" branding and dark theme must be visually distinct from tenant ERP | 1 | 2 | 2 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E3b (Platform API + AI Gateway) fully implemented and tests passing
- [ ] E6 (Frontend Shell) implemented with shared design system packages
- [ ] Platform Admin API deployed to test environment and accessible
- [ ] Platform database seeded with test tenants (ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED)
- [ ] Test platform admin accounts created (PLATFORM_ADMIN with MFA, PLATFORM_VIEWER)
- [ ] Shared packages (`packages/api-client`, `packages/design-system`) available
- [ ] `apps/platform-admin` Vite project scaffolded and buildable

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%, failures triaged)
- [ ] No open high-priority / high-severity bugs
- [ ] All 5 high-priority risks (R-001 through R-005) mitigated with passing tests
- [ ] Security tests (SEC category: R-001, R-002, R-003) passing 100%
- [ ] RBAC enforcement verified for both PLATFORM_ADMIN and PLATFORM_VIEWER roles

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority classification based on risk and business impact, NOT execution timing. See Execution Strategy section for when tests run.

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13b.1-E2E-001 | Platform login with valid credentials | E2E | R-003 | POST /admin/auth/login, verify redirect to dashboard |
| E13b.1-E2E-002 | MFA challenge mandatory for PLATFORM_ADMIN | E2E | R-003 | After login, MFA step required; cannot skip |
| E13b.1-E2E-003 | MFA skip blocked — no bypass route | E2E | R-003 | Direct navigation to dashboard without MFA redirects to MFA page |
| E13b.1-E2E-004 | Invalid credentials rejected | API | R-003 | Wrong password returns 401; no information leakage |
| E13b.1-E2E-005 | JWT refresh maintains session | API | R-003 | Expired token auto-refreshes; expired refresh token forces re-login |
| E13b.1-E2E-006 | PLATFORM_VIEWER cannot see write actions | E2E | R-002 | Suspend, archive, enforcement buttons hidden/disabled across all pages |
| E13b.1-E2E-007 | PLATFORM_VIEWER read-only dashboard access | E2E | R-002 | VIEWER can browse tenants, AI usage, audit log; cannot modify |
| E13b.5-E2E-001 | Impersonation requires mandatory reason text | E2E | R-001 | Empty reason rejected; dialog cannot submit without text |
| E13b.5-E2E-002 | Impersonation session time limit enforced | E2E | R-001 | Countdown timer shown; session auto-terminates on expiry |
| E13b.5-E2E-003 | Impersonation banner non-dismissable | E2E | R-001 | Amber banner cannot be closed via UI; no X button; fixed position |
| E13b.5-E2E-004 | Impersonation "End Session" redirects to portal | E2E | R-001 | Click "End Session" → admin returned to platform admin app |
| E13b.5-E2E-005 | Impersonation dual audit logging | API | R-001 | Platform audit: `platform.impersonation_started`; tenant audit: `impersonatedBy` metadata |
| E13b.2-E2E-001 | Tenant suspend with mandatory reason | E2E | R-004 | Confirmation dialog with reason input; reason required; state changes to SUSPENDED |
| E13b.2-E2E-002 | Tenant reactivate from SUSPENDED | E2E | R-004 | Reactivate button visible; state returns to ACTIVE |
| E13b.2-E2E-003 | Tenant archive irreversibility confirmation | E2E | R-004 | Dialog explicitly warns "irreversible"; requires typed confirmation; state changes to ARCHIVED |
| E13b.2-E2E-004 | Archived tenant actions disabled | E2E | R-004 | No suspend/reactivate/archive buttons on ARCHIVED tenant |
| E13b.3-E2E-001 | Billing enforcement escalation (WARNING -> READ_ONLY) | E2E | R-005 | Admin selects enforcement; confirmation shows consequences; API called |
| E13b.3-E2E-002 | Billing enforcement escalation (READ_ONLY -> SUSPENDED) | E2E | R-005 | Further escalation with confirmation; webhook delivery status shown |
| E13b.3-E2E-003 | Enforcement change shows webhook status | API | R-005 | Response includes webhook delivery status; UI warns if pending/failed |
| E13b.2-API-001 | Tenant state machine enforced in UI | API | R-004 | PROVISIONING tenant cannot be archived; only valid transitions shown |

**Total P0**: ~20 tests, ~20-30 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13b.1-E2E-008 | Sidebar navigation renders all items | E2E | R-006 | Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings |
| E13b.1-E2E-009 | Dark sidebar with "PLATFORM ADMIN" branding | E2E | R-006 | slate-900 background, purple accent, distinct from tenant ERP |
| E13b.1-E2E-010 | Route transitions between all sections | E2E | R-006 | Click each nav item; verify correct page loads |
| E13b.2-E2E-005 | Tenant list with status colour-coded badges | E2E | R-009 | ACTIVE=green, SUSPENDED=red, READ_ONLY=amber, ARCHIVED=grey |
| E13b.2-E2E-006 | Tenant list filtering by status | E2E | R-009 | Filter dropdown; verify list updates correctly |
| E13b.2-E2E-007 | Tenant list filtering by plan and billing status | E2E | - | Multiple filter combinations work correctly |
| E13b.2-E2E-008 | Tenant detail — Overview tab | E2E | - | Status, plan, billing, creation date, region, sandbox flag displayed |
| E13b.2-E2E-009 | Tenant detail — Modules & Flags tab | E2E | - | Module override toggles, feature flag toggles functional |
| E13b.2-E2E-010 | Module override toggle fires webhook | API | - | PUT /admin/tenants/:id/modules; verify webhook delivery |
| E13b.2-E2E-011 | Feature flag toggle fires webhook | API | - | PUT /admin/tenants/:id/feature-flags; verify webhook delivery |
| E13b.2-E2E-012 | Tenant detail — Users tab (read-only) | E2E | - | Tenant user list displayed; no edit actions for platform admin |
| E13b.2-E2E-013 | Tenant detail — Audit tab | E2E | - | Platform actions for this tenant displayed |
| E13b.4-E2E-001 | AI usage cross-tenant summary KPIs | E2E | R-007 | Total tokens today, month, cost estimate cards rendered |
| E13b.4-E2E-002 | AI usage per-tenant breakdown | E2E | R-007 | Usage by feature, by provider, daily trend (30-day), quota progress bar |
| E13b.4-E2E-003 | AI quota alerts list | E2E | - | Alerts displayed with tenant name, usage %, timestamp |
| E13b.4-E2E-004 | AI spike detection alert display | E2E | - | Anomaly alert flagged when daily > 3x rolling avg |
| E13b.4-E2E-005 | AI quota alert acknowledge/dismiss | E2E | - | Acknowledge and dismiss actions functional |
| E13b.6-E2E-001 | Audit log list rendering | E2E | R-008 | Columns: timestamp, admin, action, target type, target name, IP |
| E13b.6-E2E-002 | Audit log filter by action type | E2E | R-008 | Dropdown filter; verify list updates |
| E13b.6-E2E-003 | Audit log filter by date range | E2E | R-008 | Date range picker; verify records within range |
| E13b.6-E2E-004 | Audit log detail view | E2E | R-008 | Click entry; full JSON details, before/after state, userAgent, IP |
| E13b.6-E2E-005 | Audit log cursor-based pagination | API | R-008 | Navigate pages; verify no gaps or duplicates |
| E13b.3-E2E-004 | Plan assignment with comparison view | E2E | R-010 | Plan selector; old vs new limits comparison; confirm assignment |
| E13b.3-E2E-005 | Billing dashboard KPI cards | E2E | - | Active tenants, payment status breakdown, revenue summary |
| E13b.5-E2E-006 | Support Console search by domain/name/email/ID | E2E | - | Search returns matching tenants; quick-action buttons visible |
| E13b.5-E2E-007 | Support Console search results with actions | E2E | - | Results show tenant summary; drill-down and impersonate buttons |
| E13b.2-E2E-014 | Tenant detail — Diagnostics tab | E2E | - | Auth health, webhook status, integration status |
| E13b.2-E2E-015 | Tenant detail — AI Usage tab | E2E | - | Usage chart, quota settings editor |
| E13b.2-E2E-016 | Tenant detail — Billing tab | E2E | - | Subscription status, payment history, enforcement controls |
| E13b.1-COMP-001 | StatusBadge renders correct colour per status | Component | R-009 | All TenantStatus x BillingStatus combinations |

**Total P1**: ~30 tests, ~25-40 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13b.4-API-001 | AI usage CSV export with filters | API | R-011 | GET /admin/ai/usage/export; verify file download with correct data |
| E13b.6-API-001 | Audit log CSV export with filters | API | R-011 | Export filtered records; verify all fields included |
| E13b.3-E2E-006 | Billing overview enforcement distribution chart | E2E | - | Pie chart renders with correct enforcement action counts |
| E13b.3-E2E-007 | Per-tenant dunning level and grace period | E2E | - | Dunning level 0-3 display; grace period countdown timer |
| E13b.3-E2E-008 | Payment history list in billing tab | E2E | - | Payment records with date, amount, status |
| E13b.4-E2E-006 | Provider management — vendor API keys | E2E | - | Masked key display, active/inactive toggles per provider |
| E13b.4-E2E-007 | Provider management — BYOK for Enterprise | E2E | - | BYOK key list (masked), add/remove/activate/deactivate |
| E13b.4-E2E-008 | BYOK vs vendor usage split chart | E2E | - | Usage breakdown chart for Enterprise tenants |
| E13b.2-E2E-017 | Tenant list drill-down navigation | E2E | - | Click row navigates to tenant detail page |
| E13b.5-E2E-008 | Impersonation session list (audit) | E2E | - | GET /admin/impersonation-sessions; list with session details |
| E13b.3-E2E-009 | Plan comparison delta for modules/users/AI | E2E | R-010 | Verify comparison shows correct changes before confirm |
| E13b.6-E2E-006 | Audit log filter by platform user | E2E | - | Filter dropdown; verify records by specific admin |
| E13b.2-COMP-001 | Module override toggle confirmation | Component | - | Toggle shows confirmation before applying |
| E13b.1-API-001 | Platform auth — session expiry handling | API | - | Expired session redirects to login; no stale data shown |
| E13b.4-COMP-001 | Quota progress bar soft/hard limit indicators | Component | - | Visual indicators at 80% and 100% thresholds |
| E13b.3-COMP-001 | Enforcement confirmation dialog with consequences | Component | - | Dialog text describes READ_ONLY/SUSPENDED impact |

**Total P2**: ~16 tests, ~8-16 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| E13b.1-E2E-011 | Responsive layout — sidebar collapse | E2E | Viewport <1024px sidebar behaviour |
| E13b.1-E2E-012 | Keyboard navigation through sidebar | E2E | Tab order, Enter to select, WCAG 2.1 AA |
| E13b.4-PERF-001 | AI usage dashboard load with 500 tenants | E2E | Page renders <2s with large mock dataset (NFR46) |
| E13b.6-PERF-001 | Audit log load with 10k records | E2E | Initial page renders <2s; pagination responsive |
| E13b.2-E2E-018 | Tenant list empty state | E2E | No tenants: helpful empty state message |
| E13b.1-E2E-013 | Error state handling — API failures | E2E | API error shows user-friendly message, not stack trace |
| E13b.1-VIS-001 | Dark sidebar visual fidelity | Visual | Match Concept D prototype; slate-900 + purple accent |
| E13b.2-VIS-001 | Status badge visual fidelity | Visual | Colour accuracy for all status combinations |

**Total P3**: ~8 tests, ~3-6 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. Playwright parallelization handles 100+ tests in 10-15 min.

| Trigger | What Runs | Duration |
|---------|-----------|----------|
| **Every PR** | All P0 + P1 + P2 functional tests (Playwright) | ~10-15 min |
| **Nightly** | P3 performance benchmarks (NFR46 load tests) | ~5-10 min |
| **Weekly** | Visual regression, cross-browser exploratory | ~30 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|--------------|-------|
| P0 | ~20 | ~20-30 hours | Complex auth/security flows, multi-step impersonation |
| P1 | ~30 | ~25-40 hours | Many views, data rendering, filtering, tab navigation |
| P2 | ~16 | ~8-16 hours | Exports, secondary features, edge cases |
| P3 | ~8 | ~3-6 hours | Visual, accessibility, performance benchmarks |
| **Total** | **~74** | **~56-92 hours** | **~1.5-2.5 weeks** |

### Prerequisites

**Test Data:**

- Platform admin user factories (PLATFORM_ADMIN with MFA, PLATFORM_VIEWER)
- Tenant factories (all TenantStatus states: PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED)
- Plan factories (Core, Pro, Enterprise, Custom with different limits)
- AI usage data factories (per-tenant, per-feature, per-provider usage records)
- Billing data factories (dunning levels 0-3, enforcement actions)
- Audit log entry factories (various action types and target types)
- Impersonation session factories (active, expired, ended)

**Tooling:**

- Playwright for E2E and component tests
- Vitest for unit tests (if any pure utility functions)
- MSW (Mock Service Worker) for API mocking in component tests
- Chart testing utilities for verifying rendered chart data

**Environment:**

- Platform Admin API running at Platform API port (5101)
- Platform Admin web app running at dedicated port (within 5100-5200 range)
- Platform database seeded with test data
- Separate auth tokens for PLATFORM_ADMIN and PLATFORM_VIEWER test users

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: >=80% (auth, impersonation, lifecycle actions, RBAC)
- **Security scenarios**: 100% (R-001, R-002, R-003 — all SEC risks)
- **Business logic**: >=70% (billing enforcement, plan assignment, quota alerts)
- **Edge cases**: >=50% (empty states, error handling, pagination boundaries)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] PLATFORM_VIEWER cannot perform any write actions (verified across all pages)
- [ ] Impersonation safeguards verified (reason, time limit, banner, dual audit)

---

## Mitigation Plans

### R-001: Impersonation Session Security Bypass (Score: 9 CRITICAL)

**Mitigation Strategy:**
1. E2E test verifies mandatory reason text validation (empty string rejected)
2. E2E test verifies countdown timer and auto-expiry on timeout
3. E2E test verifies banner cannot be dismissed via DOM manipulation (position:fixed, no close button)
4. API test verifies dual audit logging (`platform.impersonation_started`, tenant `impersonatedBy` metadata)
5. E2E test verifies "End Session" terminates session and redirects to platform admin

**Owner:** QA
**Timeline:** Sprint 1 (first implementation cycle)
**Status:** Planned
**Verification:** All 5 E2E/API tests in E13b.5-E2E-001 through E13b.5-E2E-005 passing

### R-002: PLATFORM_VIEWER Write Action Exposure (Score: 6)

**Mitigation Strategy:**
1. E2E test logs in as PLATFORM_VIEWER and visits every page
2. Verify: suspend, archive, reactivate buttons are hidden or disabled
3. Verify: billing enforcement controls are hidden or disabled
4. Verify: module/feature flag toggles are read-only
5. Verify: impersonation button is hidden

**Owner:** QA
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** E13b.1-E2E-006 and E13b.1-E2E-007 passing across all pages

### R-003: Platform MFA Bypass Through Frontend Flow (Score: 6)

**Mitigation Strategy:**
1. E2E test: PLATFORM_ADMIN login requires MFA step after credentials
2. E2E test: Direct navigation to dashboard without MFA redirects to MFA page
3. E2E test: Invalid TOTP code rejected; retry allowed
4. API test: JWT issued only after successful MFA verification

**Owner:** QA
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** E13b.1-E2E-001 through E13b.1-E2E-003 passing

### R-004: Irreversible Archive Without Sufficient Safeguards (Score: 6)

**Mitigation Strategy:**
1. E2E test: Archive button triggers confirmation dialog with explicit "irreversible" warning
2. E2E test: Dialog requires typed confirmation (e.g., tenant name or "ARCHIVE")
3. E2E test: Cancel returns to tenant detail without state change
4. E2E test: After archive, tenant shows ARCHIVED status with all actions disabled

**Owner:** QA
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** E13b.2-E2E-003 and E13b.2-E2E-004 passing

### R-005: Billing Enforcement Propagation Failure Hidden from Admin (Score: 6)

**Mitigation Strategy:**
1. API test: Enforcement PATCH response includes webhook delivery status
2. E2E test: UI shows confirmation after enforcement change with webhook status
3. E2E test: If webhook delivery fails/pending, warning indicator shown

**Owner:** QA/Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** E13b.3-E2E-001, E13b.3-E2E-002, E13b.3-E2E-003 passing

---

## Assumptions and Dependencies

### Assumptions

1. E3b (Platform API + AI Gateway) is fully implemented and all 8 test files pass before E13b testing begins
2. E6 (Frontend Shell) provides shared design system packages (shadcn/ui, Tailwind config) compatible with platform admin app
3. Platform API returns webhook delivery status in enforcement change responses
4. Test environment has platform database seeded with representative data (multiple tenants in various states)
5. MFA verification flow uses TOTP (Time-based One-Time Password) as specified in data models

### Dependencies

1. **E3b Platform API** — All 45 endpoints must be implemented and accessible — Required before E13b testing
2. **E6 Shared Packages** — `packages/api-client`, `packages/design-system` — Required for app scaffolding
3. **Test Platform Admin Accounts** — PLATFORM_ADMIN (with MFA configured) and PLATFORM_VIEWER — Required for auth tests
4. **Seeded Platform Database** — Tenants in all states, plans, billing records, AI usage data, audit entries — Required for all stories

### Risks to Plan

- **Risk:** E3b endpoints incomplete or API contract changes during E13b development
  - **Impact:** Test scenarios may need updating; API mock layer provides partial mitigation
  - **Contingency:** Use MSW mocks for frontend tests; update tests when API stabilizes

- **Risk:** Impersonation flow requires cross-app navigation (platform admin -> tenant ERP)
  - **Impact:** E2E testing of full impersonation flow may require both apps running
  - **Contingency:** Test impersonation start/end in platform admin app; banner rendering tested separately

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **Platform API (E3b)** | All E13b pages consume Platform API endpoints | E3b route tests (8 files) must pass |
| **Frontend Shell (E6)** | Shared design system, routing patterns, auth context patterns | E6 E2E tests for shell components must pass |
| **AI Gateway (E3b.3)** | AI usage data consumed by E13b.4 dashboard | AI Gateway quota and usage recording tests must pass |
| **Platform Client SDK (E3b.4)** | Webhook delivery for lifecycle/enforcement changes | SDK cache invalidation and circuit breaker tests must pass |
| **Tenant ERP App** | Impersonation banner renders in tenant ERP during impersonation | Cross-app integration test (P2 scope) |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: Mohammed Date: ___
- [ ] Tech Lead: ___ Date: ___
- [ ] QA Lead: ___ Date: ___

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/` (FR193-FR222, FR223-FR226)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E13b.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/` (Section 2.31 Platform Admin)
- E3b Test Design: `_bmad-output/test-artifacts/test-design-epic-E3b.md`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/` (Section 21 Platform Admin API)
- Data Models: `_bmad-output/planning-artifacts/data-models/` (Section 5 Platform Database)
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (Section 14b, BR-PLT-001 to BR-PLT-021)
- State Machines: `_bmad-output/planning-artifacts/state-machine-reference.md` (Section 20)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md` (Section 19)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

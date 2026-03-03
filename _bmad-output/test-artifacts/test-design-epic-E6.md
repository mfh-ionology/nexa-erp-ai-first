---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-23'
---

# Test Design: Epic E6 - Web Frontend Shell + Mobile Scaffold

**Date:** 2026-02-23
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E6 — 12 stories covering React app bootstrap, navigation shell, 8 screen templates (T1-T8), ActionBar component, Co-Pilot Dock, mobile scaffold, and 6 RBAC admin frontend pages.

> Note: P0/P1/P2/P3 = priority classification based on risk and business impact, NOT execution timing. See Execution Strategy for timing.

**Risk Summary:**

- Total risks identified: 14
- High-priority risks (score >= 6): 4
- Critical categories: SEC, TECH, BUS

**Coverage Summary:**

- P0 scenarios: ~18 (~25-40 hours)
- P1 scenarios: ~32 (~30-50 hours)
- P2 scenarios: ~24 (~12-24 hours)
- P3 scenarios: ~8 (~2-5 hours)
- **Total effort**: ~70-120 hours (~2-3 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Backend RBAC API logic** | Covered by E2b backend tests (Prisma services, guards, permission resolver) | Existing unit/integration tests in `packages/db` and `apps/api` |
| **AI Orchestration backend** | Covered by E5 backend tests (AI gateway, tool execution, streaming) | Existing tests in `packages/ai-gateway` |
| **Push notification delivery** | Server-side BullMQ worker tested separately; E6.6 only registers token | Platform-level monitoring |
| **Third-party library internals** | Shadcn UI, TanStack Query, Zustand, Expo — maintained upstream | Upstream test suites; our tests verify integration, not library behaviour |
| **Visual regression testing** | No visual regression baseline exists yet; defer to post-E6 | Manual visual QA during story review; visual regression can be added later |
| **Performance/load testing** | E6 is UI shell; no backend bottlenecks introduced | NFR6 (page load <2s) validated via Lighthouse in P2 tests |

---

## Risk Assessment

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | Permission bypass: frontend route guards are client-side only — a determined user could bypass `ModuleGuard` via direct API calls if backend guards are misconfigured | 2 | 3 | 6 | E6.11 guards are defense-in-depth only; E2b backend guards are the authoritative check. Test that backend rejects unauthorized API calls independently. E6 tests verify UI hides/shows correctly. | Dev + QA | Sprint 0 |
| R-002 | TECH | State desynchronisation between `useAuthStore` (Zustand), TanStack Query cache, and `GET /system/my-permissions` — stale permissions after access group changes could show/hide wrong UI elements | 2 | 3 | 6 | Test permission cache invalidation flow: modify access group → verify WebSocket event → verify re-fetch → verify UI updates. Test company switcher clears and re-fetches all permission state. | QA | E6.11 story |
| R-003 | BUS | ActionBar misconfiguration: wrong actions shown for a given entity status could let users trigger invalid state transitions (e.g., showing "Approve" on an already-approved invoice) | 2 | 3 | 6 | Test every documented state machine transition against `action-config.ts`. Verify overflow sections auto-hide when no valid actions exist. Test SUPER_ADMIN sees all valid transitions. | QA | E6.4 story |
| R-004 | TECH | Co-Pilot Dock streaming and WebSocket reliability: dropped connections, partial streaming responses, or race conditions between drawer open/close and message arrival | 3 | 2 | 6 | Test WebSocket reconnection. Test drawer state during streaming. Test concurrent messages. Test offline/reconnect scenarios. Mock WebSocket for deterministic tests. | QA | E6.5 story |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-005 | TECH | Responsive layout breakage at breakpoint boundaries (1024px sidebar collapse, 768px mobile overlay) — CSS transitions and layout shifts causing visual glitches | 2 | 2 | 4 | Test at exact breakpoints (375, 768, 1024, 1280) using Playwright viewport resizing. Test sidebar collapse/expand animation completion. | QA |
| R-006 | TECH | TanStack Router lazy loading: code splitting could fail silently or produce flash-of-loading-state on slow connections | 2 | 2 | 4 | Test route transitions with Playwright. Verify Suspense fallback renders. Test direct URL navigation to lazy-loaded routes. | QA |
| R-007 | BUS | Permission matrix checkbox grid (E6.8): saving permissions with replace-all semantics could accidentally wipe permissions if the UI sends an incomplete payload | 2 | 2 | 4 | Test round-trip: load permissions → modify one checkbox → save → reload → verify unchanged permissions are preserved. Test with large permission sets. | QA |
| R-008 | SEC | JWT token handling: token refresh race condition on concurrent 401 responses could cause multiple simultaneous refresh calls or infinite redirect loops | 2 | 2 | 4 | Test concurrent 401 handling. Verify single refresh call queued. Test expired refresh token → redirect to login. | QA |
| R-009 | TECH | i18n integration: hardcoded strings leaking into UI instead of translation keys (FR178 violation) | 2 | 2 | 4 | Grep-based audit for hardcoded English strings in component files. Spot-check key screens for missing translations. | Dev |
| R-010 | DATA | Access group deactivation (soft-delete) not properly hiding group from default list view, or allowing reactivation of groups still referenced by users | 1 | 3 | 3 | Test deactivated groups hidden from list. Test users with deactivated groups still function (graceful degradation). | QA |
| R-011 | BUS | Company switcher: switching company mid-session could leave stale data from previous company visible if TanStack Query cache isn't properly invalidated | 2 | 2 | 4 | Test company switch invalidates all query caches. Verify no data leakage between companies. | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-012 | OPS | Expo build configuration: React Native + TypeScript + shared packages may have bundler resolution issues | 1 | 2 | 2 | Monitor during E6.6 implementation; fix if encountered |
| R-013 | BUS | Quick Prompts context-awareness (E6.5): prompts may not correctly detect page context on all routes | 1 | 1 | 1 | Monitor; low impact — users can always type commands manually |
| R-014 | TECH | Keyboard shortcut conflicts: Cmd+K may conflict with browser or OS shortcuts on certain platforms | 1 | 1 | 1 | Monitor; test on Mac + Windows browsers |

### Risk Category Legend

- **TECH**: Technical/Architecture (integration, state management, framework issues)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, invalid state transitions)
- **OPS**: Operations (deployment, config, build issues)

---

## Entry Criteria

- [x] E2 (Auth) backend complete: JWT auth, login/logout endpoints
- [x] E2b (Granular RBAC) backend complete: Resource, AccessGroup, permissions, `GET /system/my-permissions`, permission guards
- [x] E4 (i18n) backend complete: translation key infrastructure, `packages/i18n`
- [x] E5 (AI Orchestration) backend complete: `/ai/chat` WebSocket, conversation storage
- [ ] API endpoints for RBAC admin (E2b) deployed and testable
- [ ] Test environment provisioned with seeded company, users, and access groups
- [ ] `packages/api-client` typed client available for API calls
- [ ] Playwright test framework initialised for `apps/web/`

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>= 95% or failures triaged with waivers)
- [ ] No open high-severity bugs in permission enforcement (E6.11)
- [ ] Responsive layout validated at 375px, 768px, 1024px, 1280px breakpoints
- [ ] Accessibility audit: all interactive elements keyboard-navigable (NFR28)
- [ ] Co-Pilot Dock functional with streaming AI responses
- [ ] Mobile scaffold builds and runs on iOS simulator

---

## Test Coverage Plan

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>= 6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E6.1-INT-001 | Auth redirect: unauthenticated user → login page | API + E2E | R-008 | Test JWT flow end-to-end |
| E6.1-INT-002 | Token refresh on 401: single refresh, retry original request | API | R-008 | Mock 401 → verify refresh → retry |
| E6.1-INT-003 | Expired refresh token → redirect to login (no loop) | API + E2E | R-008 | Critical auth failure path |
| E6.2-E2E-001 | Company switcher: switch company → all API calls scoped to new company | E2E | R-011 | Verify cache invalidation |
| E6.2-E2E-002 | Sidebar shows only modules with canAccess=true (non-SUPER_ADMIN) | E2E | R-002 | Permission-driven navigation |
| E6.4-UNIT-001 | ActionBar: status-driven action visibility — DRAFT shows Approve, APPROVED hides Approve | Unit | R-003 | Test action-config.ts mapping |
| E6.4-UNIT-002 | ActionBar: max 2 primary actions enforced | Unit | R-003 | Config validation |
| E6.4-E2E-001 | ActionBar: overflow sections auto-hide when no valid actions for current status | E2E | R-003 | Render with various statuses |
| E6.4-E2E-002 | ActionBar: destructive action (Void/Cancel) shows confirmation dialog | E2E | R-003 | User safety check |
| E6.5-E2E-001 | Co-Pilot: Cmd+K focuses header input from any screen | E2E | R-004 | Keyboard shortcut test |
| E6.5-E2E-002 | Co-Pilot: AI command opens drawer and streams response | E2E | R-004 | WebSocket mock + streaming |
| E6.5-E2E-003 | Co-Pilot: AI actions never auto-execute (BR-COM-013) — user confirmation required | E2E | R-004 | Security-critical AI guardrail |
| E6.8-E2E-001 | Permission matrix: save → reload → verify unchanged permissions preserved (round-trip) | E2E | R-007 | Replace-all semantics safety |
| E6.11-E2E-001 | Route guard: direct URL to unauthorized page → 403 access denied page | E2E | R-001 | Frontend enforcement |
| E6.11-E2E-002 | Sidebar hides items where canAccess=false | E2E | R-002 | Permission-driven sidebar |
| E6.11-E2E-003 | SUPER_ADMIN bypass: all sidebar items visible, all routes accessible | E2E | R-001 | RBAC bypass verification |
| E6.11-E2E-004 | Field visibility: HIDDEN fields not rendered, READ_ONLY fields disabled | E2E | R-002 | _fieldMeta integration |
| E6.11-E2E-005 | Permission change via WebSocket event triggers re-fetch of my-permissions | E2E | R-002 | Cache invalidation flow |

**Total P0**: ~18 tests, ~25-40 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E6.1-UNIT-001 | Zustand stores initialise correctly (auth, sidebar, copilot) | Unit | - | Foundation check |
| E6.1-UNIT-002 | TanStack Query default config: stale time, retry, cache time | Unit | - | Config validation |
| E6.2-E2E-003 | Sidebar responsive: icon-only at 1024-1279px, full at >= 1280px | E2E | R-005 | Viewport resize test |
| E6.2-E2E-004 | Mobile: off-canvas drawer with hamburger toggle at < 1024px | E2E | R-005 | Mobile breakpoint |
| E6.2-E2E-005 | User avatar menu: shows name, role, company; Sign Out works | E2E | - | Core UX |
| E6.3-COMP-001 | EntityListPage (T1): renders breadcrumb, title, [+ New], data table, pagination | Component | - | Template structure |
| E6.3-COMP-002 | RecordDetailPage (T2): renders status badge, tabs, action bar slot | Component | - | Template structure |
| E6.3-COMP-003 | HeaderLinesPage (T3): editable line items, add/remove rows, auto-totals | Component | - | Complex template |
| E6.3-COMP-004 | T1 responsive: card layout on phone, table on desktop | Component | R-005 | Breakpoint behaviour |
| E6.4-COMP-001 | Persistent tools (Attachments, Links) always visible with count badges | Component | - | ActionBar zone 2 |
| E6.4-COMP-002 | Keyboard navigation: Tab through all ActionBar zones + Enter to activate | Component | - | NFR28 compliance |
| E6.5-E2E-004 | Entity search: type "INV-" → autocomplete dropdown shows matching invoices | E2E | - | Input type detection |
| E6.5-E2E-005 | Drawer 380px width on desktop; main content resizes | E2E | - | Layout spec |
| E6.5-E2E-006 | Mobile: drawer renders as full-screen overlay; minimise → floating pill | E2E | R-005 | Mobile UX |
| E6.5-COMP-001 | Chat messages: AI left-aligned grey, user right-aligned purple | Component | - | Visual spec |
| E6.5-COMP-002 | Quick prompts: context-aware chips change based on current page | Component | - | Context detection |
| E6.7-E2E-001 | Resource Registry: list page with module/type filters and search | E2E | - | RBAC admin page |
| E6.7-E2E-002 | Resource Registry: read-only (no create/edit/delete controls) | E2E | - | Scope enforcement |
| E6.8-E2E-002 | Access Group create: unique code validation, 409 duplicate handling | E2E | - | Business rule |
| E6.8-E2E-003 | System group: code read-only, Deactivate option disabled, banner shown | E2E | R-010 | BR-RBAC-003 |
| E6.8-E2E-004 | Custom group deactivation: confirmation dialog → soft-delete → hidden from list | E2E | R-010 | Soft-delete flow |
| E6.9-E2E-001 | User list → click row → user detail with access groups panel | E2E | - | Navigation flow |
| E6.9-E2E-002 | Assign groups via multi-select combobox → save → verify persistence | E2E | - | Assignment flow |
| E6.9-E2E-003 | Zero-group assignment prevention: 422 error handled | E2E | - | Business rule |
| E6.10-E2E-001 | Field overrides: set HIDDEN on a field → save → reload → verify | E2E | - | Round-trip |
| E6.10-E2E-002 | Field overrides: default VISIBLE when no override exists | E2E | - | BR-RBAC-005 |
| E6.11-E2E-006 | [+ New] button hidden when canNew=false | E2E | - | Button visibility |
| E6.11-E2E-007 | Edit/Delete options hidden per permission flags | E2E | - | Button visibility |
| E6.11-E2E-008 | My Permissions panel shows resolved permissions, role, groups | E2E | - | User transparency |
| E6.12-E2E-001 | Export Config: calls API, produces downloadable JSON | E2E | - | Export flow |
| E6.12-E2E-002 | Import Config: dry-run shows preview counts without persisting | E2E | - | Dry-run mode |
| E6.12-E2E-003 | Import Config: actual import shows APPLIED results | E2E | - | Import flow |

**Total P1**: ~32 tests, ~30-50 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E6.3-COMP-005 | BriefingPage (T4): card grid with action buttons and metrics | Component | - | Template coverage |
| E6.3-COMP-006 | BoardPage (T5): Kanban columns with drag-and-drop | Component | - | Template coverage |
| E6.3-COMP-007 | WizardPage (T6): step indicator, next/back, per-step validation | Component | - | Template coverage |
| E6.3-COMP-008 | SettingsPage (T7): grouped settings with save/reset | Component | - | Template coverage |
| E6.3-COMP-009 | ReportPage (T8): parameter form, results table, AI summary slot | Component | - | Template coverage |
| E6.3-COMP-010 | T2 responsive: stacked fields on phone, tabs→accordion | Component | R-005 | Responsive check |
| E6.3-COMP-011 | T3 responsive: EventFlowTracker vertical on phone, horizontal on desktop | Component | R-005 | Responsive check |
| E6.4-COMP-003 | ActionBar keyboard shortcut hints in overflow menu items | Component | - | NFR28 detail |
| E6.5-COMP-003 | Chat history selector: list conversations + New Chat button | Component | - | Drawer section |
| E6.5-COMP-004 | CopilotInput: multi-line (Shift+Enter), file drop zone | Component | - | Input features |
| E6.5-E2E-007 | Drawer state persists across page navigation | E2E | - | Session persistence |
| E6.6-E2E-001 | Mobile app builds with Expo + React Native + TypeScript | E2E | R-012 | Build verification |
| E6.6-E2E-002 | Mobile login screen + biometric option (Face ID / fingerprint) | E2E | - | Auth flow |
| E6.6-E2E-003 | Mobile tab bar: Chat, Briefing, Approvals, More | E2E | - | Navigation |
| E6.6-INT-001 | Mobile shared API client: same typed client as web | API | - | Package sharing |
| E6.7-E2E-003 | Resource Registry blocked for non-ADMIN (403 redirect) | E2E | - | Access control |
| E6.8-E2E-005 | Permission matrix: large set with many resources/permissions renders correctly | E2E | R-007 | Performance edge case |
| E6.9-E2E-004 | Group removal confirmation dialog shown | E2E | - | UX safety |
| E6.11-A11Y-001 | WCAG 2.1 AA: colour contrast 4.5:1 normal text, 3:1 large text (NFR29) | Component | - | Accessibility audit |
| E6.11-A11Y-002 | Screen reader: StatusBadge has ARIA label (e.g., "Invoice status: Draft") | Component | - | NFR30 |
| E6.11-A11Y-003 | Screen reader: AI streaming uses aria-live regions | Component | - | NFR30 |
| E6.1-PERF-001 | Page load time < 2 seconds (Lighthouse audit) | E2E | - | NFR6 |
| E6.12-E2E-004 | Import Config: malformed JSON error handling | E2E | - | Error path |
| E6.2-E2E-006 | Notification bell renders with unread count badge (shell only; wired in E9) | E2E | - | Placeholder verification |

**Total P2**: ~24 tests, ~12-24 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E6.5-EXP-001 | Explore: Cmd+K on various browser/OS combos (Mac Chrome, Mac Safari, Windows Chrome) | Manual | R-014 | Cross-platform |
| E6.5-EXP-002 | Explore: rapid drawer open/close during streaming | Manual | R-004 | Race condition hunting |
| E6.6-E2E-004 | Push notification token registration on mobile login | E2E | R-012 | Expo push setup |
| E6.6-E2E-005 | Mobile deep linking from push notification | E2E | R-012 | Mobile navigation |
| E6.2-EXP-001 | Explore: sidebar animation smoothness at breakpoint boundaries | Manual | R-005 | Visual polish |
| E6.3-EXP-001 | Explore: T5 BoardPage drag-and-drop on touch devices | Manual | - | Mobile touch |
| E6.8-EXP-001 | Explore: permission matrix with 100+ resources performance | Manual | R-007 | Stress test |
| E6.12-EXP-001 | Explore: import large JSON config file (>1MB) | Manual | - | Edge case |

**Total P3**: ~8 tests, ~2-5 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. Playwright parallelisation handles 100+ tests in 10-15 minutes.

| Trigger | What Runs | Expected Duration |
|---------|-----------|-------------------|
| **Every PR** | All P0 + P1 + P2 unit, component, and E2E tests via Playwright | ~10-15 min |
| **Nightly** | Full suite including P3 exploratory automation + Lighthouse perf audit | ~20-30 min |
| **Weekly** | Mobile build verification + cross-browser checks | ~30-60 min |

No complex tier structure needed. All functional tests run on every PR. Only defer mobile builds and cross-browser checks to nightly/weekly.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | ~18 | ~25-40 hours | Complex setup: auth flows, WebSocket mocks, permission scenarios |
| P1 | ~32 | ~30-50 hours | Standard coverage: component rendering, CRUD flows, responsive |
| P2 | ~24 | ~12-24 hours | Simpler: template variants, accessibility checks, mobile build |
| P3 | ~8 | ~2-5 hours | Exploratory: manual + light automation |
| **Total** | **~82** | **~70-120 hours** | **~2-3 weeks** |

### Prerequisites

**Test Data:**

- User factory: create users with specific roles and access group assignments
- Company factory: create company with seeded resources and access groups
- Access Group factory: create groups with specific permission matrices
- Entity factory: create entities (invoices, orders) in specific statuses for ActionBar testing

**Tooling:**

- Vitest + React Testing Library for unit/component tests in `apps/web/`
- Playwright for E2E tests (existing infrastructure from E2b-E5)
- WebSocket mock utility for Co-Pilot Dock tests
- Viewport resize helpers for responsive tests

**Environment:**

- Test database with seeded RBAC data (resources, access groups, field overrides)
- WebSocket server (or mock) for AI chat
- Test user accounts: SUPER_ADMIN, ADMIN, STAFF, VIEWER (one per role)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (auth, permissions, ActionBar): >= 80%
- **Security scenarios** (RBAC enforcement, AI guardrails): 100%
- **Business logic** (state-driven actions, permission resolution): >= 70%
- **Edge cases** (responsive, mobile, error handling): >= 50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>= 6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] BR-COM-013 (AI user confirmation) verified
- [ ] NFR28 (keyboard navigation) validated on all interactive elements

---

## Mitigation Plans

### R-001: Permission Bypass via Client-Side Guards (Score: 6)

**Mitigation Strategy:**
1. E6.11 route guards are defense-in-depth only; backend `createPermissionGuard()` is authoritative
2. Write API-level tests confirming backend rejects unauthorized requests regardless of frontend state
3. E6 E2E tests verify UI correctly hides/shows elements per permissions

**Owner:** Dev + QA
**Timeline:** E6.11 story implementation
**Status:** Planned
**Verification:** API test: call protected endpoint without permission → 403. E2E test: navigate to unauthorized URL → 403 page.

### R-002: Stale Permission State After Access Group Changes (Score: 6)

**Mitigation Strategy:**
1. Test WebSocket event `accessGroup.updated` triggers `GET /system/my-permissions` re-fetch
2. Test company switcher invalidates permission cache in Zustand
3. Test that UI updates (sidebar items, button visibility) reflect new permissions without page reload

**Owner:** QA
**Timeline:** E6.11 story
**Status:** Planned
**Verification:** E2E flow: admin changes user's group → verify user's UI updates within 60s (Redis TTL).

### R-003: ActionBar Misconfiguration — Wrong Actions for Status (Score: 6)

**Mitigation Strategy:**
1. Unit test `action-config.ts` against every documented state machine transition
2. E2E test ActionBar rendering for each common status: DRAFT, APPROVED, POSTED, CLOSED
3. Test that SUPER_ADMIN sees all valid transitions but not invalid ones

**Owner:** QA
**Timeline:** E6.4 story
**Status:** Planned
**Verification:** Unit: pass entity type + status → verify returned actions match state machine. E2E: render screen with mock entity in each status → verify buttons.

### R-004: Co-Pilot WebSocket Reliability (Score: 6)

**Mitigation Strategy:**
1. Mock WebSocket in Playwright tests for deterministic streaming behaviour
2. Test drawer open during active stream → verify no data loss
3. Test WebSocket disconnect → reconnect → resume conversation
4. Test rapid open/close drawer during streaming

**Owner:** QA
**Timeline:** E6.5 story
**Status:** Planned
**Verification:** E2E: mock WebSocket with controlled message sequences → verify chat displays correctly. Test disconnect/reconnect using network interception.

---

## Assumptions and Dependencies

### Assumptions

1. E2b backend RBAC endpoints (`GET /system/resources`, `GET /system/access-groups`, `GET /system/my-permissions`, etc.) are deployed and stable before E6 testing begins
2. WebSocket endpoint `/ai/chat` (from E5) is available for Co-Pilot Dock integration testing
3. `packages/api-client` provides typed HTTP client for all RBAC endpoints
4. Shared `packages/i18n` provides React hook for translation keys
5. Test environment has at least one seeded company with resources, access groups, and test users

### Dependencies

1. **E2b RBAC backend** — Required before E6.7-E6.12 testing
2. **E5 AI Orchestration** — Required before E6.5 Co-Pilot Dock testing
3. **Playwright setup for `apps/web/`** — Required before any E2E tests run
4. **Vitest + Testing Library setup for `apps/web/`** — Required before unit/component tests

### Risks to Plan

- **Risk**: E2b backend endpoints not ready when E6 frontend stories start
  - **Impact**: E6.7-E6.12 stories blocked; E6.11 tests cannot verify real permission enforcement
  - **Contingency**: Mock API responses for frontend development; defer integration tests until backend available

- **Risk**: WebSocket mock complexity for Co-Pilot Dock tests may require significant setup
  - **Impact**: P0 tests E6.5-E2E-002 and E6.5-E2E-003 delayed
  - **Contingency**: Start with HTTP fallback endpoint testing; add WebSocket tests incrementally

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **E2 Auth (JWT)** | E6.1 consumes auth flow; token refresh logic | Auth login/logout E2E tests must pass |
| **E2b RBAC Backend** | E6.7-E6.12 consume all RBAC API endpoints | RBAC permission resolution API tests must pass |
| **E4 i18n** | All E6 components use translation keys | i18n provider unit tests must pass |
| **E5 AI Orchestration** | E6.5 Co-Pilot Dock consumes AI chat WebSocket | AI gateway integration tests must pass |
| **packages/api-client** | All E6 API calls use shared typed client | API client unit tests must pass |
| **packages/shared** | Formatters (currency, date) used in templates | Formatter tests must pass |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (TECH/SEC/PERF/DATA/BUS/OPS)
- `probability-impact.md` — Risk scoring methodology (1-3 scale, thresholds at 6 and 9)
- `test-levels-framework.md` — Test level selection (unit > integration > E2E preference)
- `test-priorities-matrix.md` — P0-P3 prioritization criteria

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E6.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/`
- UX Design Spec: `_bmad-output/planning-artifacts/ux-design-specification/`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/`
- Data Models: `_bmad-output/planning-artifacts/data-models/`
- State Machine Reference: `_bmad-output/planning-artifacts/state-machine-reference.md`
- Business Rules Compendium: `_bmad-output/planning-artifacts/business-rules-compendium.md`

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

# Epic E13b Retrospective: Platform Admin Portal

**Date:** 2026-03-11
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Complete (6/6 stories done)

---

## Epic Summary

Epic E13b delivered the **Platform Admin Portal** — a complete, separate React SPA (`apps/platform-admin/`) for vendor super-administrators to manage the multi-tenant Nexa ERP platform. It covers the full platform operations lifecycle: tenant fleet management, billing enforcement, AI usage monitoring, impersonation for support, and immutable audit logging.

| Story | Title | Status | Scope |
|-------|-------|--------|-------|
| E13b.1 | Platform Admin App Shell | done | Frontend (Platform Admin) |
| E13b.2 | Tenant Management Dashboard | done | Frontend (Platform Admin) |
| E13b.3 | Billing Dashboard & Plan Management | done | Frontend (Platform Admin) |
| E13b.4 | AI Usage Dashboard | done | Backend + Frontend (Platform API + Platform Admin) |
| E13b.5 | Impersonation & Support Console | done | Cross-app (Platform API + Platform Admin + ERP Web + ERP API) |
| E13b.6 | Platform Audit Log Viewer | done | Backend + Frontend (Platform API + Platform Admin) |

**FRs Delivered:** FR193–FR222, FR224 (BYOK), FR226 (provider management)
**NFRs Targeted:** NFR46 (platform security), NFR48 (MFA), NFR49 (audit/compliance), NFR50 (AI data privacy), NFR51 (webhook propagation)
**Dependencies Used:** E3b (Platform API + AI Gateway), E6 (Frontend Shell), E5d (Platform Admin app shell foundation)

---

## Delivery Metrics

- **Stories Completed:** 6/6 (100%)
- **Tier:** 1 (Core Platform)
- **New Infrastructure Created:**
  - **Platform DB:** 2 new tables (`platform_ai_alerts`, `vendor_provider_credentials`) + new migration
  - **Backend Services:** ImpersonationService, ImpersonationExpiryService, QuotaAlertService, SpikeDetectionService, AES-256 encryption utility
  - **API Endpoints:** ~25 new endpoints across admin routes (`/admin/ai/*`, `/admin/impersonation-sessions/*`, `/admin/support/*`, `/admin/audit-log/*`) and enhanced tenant routes
  - **Frontend (platform-admin):** Complete SPA with 9 navigation sections, 7 feature areas (tenants, billing, plans, AI usage, support, audit, settings), tenant detail with 7 tabs, 3 feature modules (`tenants/`, `billing/`, `ai-usage/`)
  - **Frontend (web):** Impersonation banner component + impersonation session hook
  - **Backend (api):** Impersonation context middleware for dual audit logging
  - **Shared Components:** StatusBadge, ConfirmationDialog, PlaceholderPage, QuotaProgressBar, EnforcementTimeline

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E13b-1 Platform Admin App Shell | 3 | 7 | 4 | 14 |
| E13b-2 Tenant Management Dashboard | 3 | 6 | 6 | 15 |
| E13b-3 Billing Dashboard & Plans | 2 | 4 | 4 | 10 |
| E13b-4 AI Usage Dashboard | 3 | 5 | 4 | 12 |
| E13b-5 Impersonation & Support Console | 4 | 6 | 2 | 12 |
| E13b-6 Platform Audit Log Viewer | 1 | 6 | 3 | 10 |
| **TOTAL** | **16** | **34** | **23** | **73** |

**Note:** Issue volume (73 total, 16 HIGH) is consistent with E5d (58 total, 15 HIGH) and E5c (60 total). The CR4 fix pass that produced zero HIGH issues in E5d-6 was NOT applied to any E13b story. All 6 stories were marked "done" with unresolved HIGH issues.

---

## Successes

### 1. Complete Platform Admin Portal Delivered
E13b delivers a fully functional, separate SPA for platform operations. Every navigation section — Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings — has a working page (or placeholder for future work). The portal is operationally complete for day-one vendor administration.

### 2. Cross-Application Implementation Successful
E13b-5 (Impersonation & Support Console) is notable for spanning **four applications** in a single story:
- `apps/platform-api/` — impersonation service, expiry background job, support search
- `apps/platform-admin/` — impersonation dialog, support console search page
- `apps/web/` — non-dismissable amber impersonation banner with countdown timer
- `apps/api/` — impersonation-aware auth middleware for dual audit logging

This is the most architecturally complex story in the project to date and it was delivered complete.

### 3. Strong RBAC Enforcement Throughout
Every page correctly implements PLATFORM_ADMIN vs PLATFORM_VIEWER role-based access:
- PLATFORM_VIEWER: read-only dashboards, no write actions visible
- PLATFORM_ADMIN: full CRUD, lifecycle actions, enforcement controls, impersonation
- All enforced via `canPerformAction()` helper and `RequirePlatformRole` guard component

### 4. Business Rule State Machines Correctly Implemented
Two complex state machines are faithfully enforced in the frontend:
- **Tenant Lifecycle** (BR-PLT-001): PROVISIONING → ACTIVE → SUSPENDED → ARCHIVED with action bar buttons reflecting valid transitions
- **Billing Enforcement** (BR-PLT-004): NONE → WARNING → READ_ONLY → SUSPENDED with the enforcement dialog only showing valid transitions per current state

### 5. Built Successfully on E5d-6 Foundation
E13b-1 correctly identified that E5d-6 had already built the platform admin app shell (auth, routing, sidebar, API client) and built on top of it rather than creating a parallel implementation. The E5d retrospective's concern about E13b/E5d overlap was handled well.

### 6. Comprehensive Test Coverage
Every story includes unit tests, component tests, and integration tests. Test files were created for:
- All React Query hooks (mock fetch, cache invalidation)
- All page components (rendering, RBAC filtering, user interactions)
- All backend routes (RBAC enforcement, request validation, response shapes)
- Shared components (StatusBadge, ConfirmationDialog, QuotaProgressBar)

---

## Challenges

### 1. Code Review Issue Volume Persists — CR4 Fix Pass STILL Not Applied
This is now the **third consecutive retrospective** (E5c → E5d → E13b) documenting the same problem: stories are marked "done" with unresolved HIGH issues.

| Epic | HIGH Issues | CR4 Applied? |
|------|------------|--------------|
| E5c | 12 | No |
| E5d | 15 (but E5d-6: 0) | Yes (E5d-6 only) |
| E13b | 16 | No |

E5d-6 proved the CR4 fix pass works (reducing HIGH issues from multiple to zero). Yet E13b reverted to the old pattern of marking stories "done" with HIGH issues. The team agreement has been repeatedly stated but not enforced.

### 2. Protected File Violations
Multiple stories modified files explicitly listed as "DO NOT modify" in their own Dev Notes:

- **E13b-3 Issue #1 [HIGH]:** `platform-sidebar.tsx` was substantially rewritten despite being listed as protected
- **E13b-3 Issue #2 [HIGH]:** `stores/auth-store.ts` `setAccessToken` behavior changed despite being a protected file
- **E13b-4 Issue #2 [HIGH]:** `features/intelligence/` directory modified (E5d feature — protected)
- **E13b-4 Issue #3 [HIGH]:** `routes/platform/ai.routes.ts` modified (E3b route — protected)

Protected file violations create cross-story regressions that are difficult to trace.

### 3. Security Concerns in Impersonation (E13b-5)
The impersonation implementation has security issues that need urgent attention:
- **E13b-5 Issue #3 [HIGH]:** Impersonation assigns `SUPER_ADMIN` role with NO action restrictions — the impersonating admin has unrestricted access to the tenant
- **E13b-5 Issue #4 [HIGH]:** Dynamic `import('@nexa/db')` runs on EVERY impersonation request (performance + potential import failure)
- **E13b-5 Issue #7 [MEDIUM]:** Empty `companyId` fallback creates broken company-scoped queries

Given that impersonation is a security-critical feature (BR-PLT-012 through BR-PLT-015), these issues are higher priority than typical code review findings.

### 4. Test Quality Issues
Recurring pattern of tests that don't test what they claim:
- **E13b-1 Issue #2 [HIGH]:** Dashboard test duplicates the component by hand instead of testing the actual component — if the real component diverges, the test still passes
- **E13b-4 Issue #1 [HIGH]:** Tests mock the wrong Prisma raw query function — mocks never match actual calls
- **E13b-5 Issue #8 [MEDIUM]:** Massive mock duplication across integration test files
- **E13b-6 Issue #7 [MEDIUM]:** Backend tests require 230 lines of mock setup for the entire app instead of testing routes in isolation

### 5. Architectural Shortcuts in Data Aggregation
Multiple dashboards use client-side aggregation instead of proper backend endpoints:
- **E13b-3:** Billing overview fetches ALL tenants and computes aggregates client-side. If tenant count exceeds 100, performance degrades
- **E13b-3 Issue #4 [MEDIUM]:** Enforcement distribution hardcodes 1:1 mapping from billing status, which doesn't reflect manual overrides
- **E13b-3 Issue #3 [MEDIUM]:** "Last Payment" column always renders a hardcoded dash because the data isn't available on the list endpoint

### 6. Epic Story Status Not Updated in Epic File
The epic file (`epic-E13b.md`) still shows stories E13b.2 through E13b.6 as "backlog" in the Status Summary table, despite all being completed. The sprint-status.yaml correctly shows them as "done". This disconnect between the epic file and sprint status creates confusion.

---

## Key Insights

### 1. E5d Retrospective Action Items: Mostly Not Applied

| # | E5d Commitment | Status in E13b | Evidence |
|---|---------------|----------------|----------|
| 1 | CR4 fix pass mandatory before "done" | NOT APPLIED | 16 HIGH issues remain across all 6 stories |
| 2 | UI stories ≤8 tasks | MOSTLY APPLIED | 5/6 stories within limit; E13b-4 has 9 tasks |
| 3 | Transaction wrapping checklist | NOT APPLICABLE | E13b is mostly frontend; backend stories are query-only |
| 4 | Test assertions match implementation | NOT APPLIED | E13b-1 #2 tests a copy, E13b-4 #1 mocks wrong function |

**Assessment:** 1 of 4 action items meaningfully applied. The most impactful commitment (CR4 fix pass) was again ignored despite being agreed upon for the third consecutive retrospective.

### 2. E5d Team Agreements Follow-Through

| Agreement | Honoured? |
|-----------|-----------|
| CR4 fix pass mandatory | No — not applied to any E13b story |
| Transaction wrapping for multi-step DB ops | Not applicable — limited backend scope |
| Tests must assert actual behaviour | No — multiple test quality issues found |
| Anonymisation sanitise keys AND values | Not applicable — E13b scope |
| UI stories ≤8 tasks | Mostly yes (5/6) |

### 3. Frontend-Heavy Epics Have Different Risk Profiles
E13b is primarily a frontend epic (4 of 6 stories are frontend-only). The challenge patterns differ from backend-heavy epics:
- **Frontend risks:** RBAC inconsistencies, test mocking complexity, client-side data aggregation shortcuts
- **Backend risks:** Transaction safety, protected file violations, security implementation gaps
- E13b-5 is the exception — spanning 4 apps, it combines both risk profiles

### 4. Impersonation Is the Highest-Risk Feature Delivered
The cross-application impersonation flow (E13b-5) is architecturally impressive but carries the most security risk:
- Unrestricted SUPER_ADMIN role assignment
- Banner height inconsistency (story says 64px, code uses 48px)
- Empty companyId fallback could corrupt company-scoped queries
- payload variable not in scope in onSuccess callback (runtime error)

This feature needs a dedicated security review before production use.

### 5. Code Review Process Has Diminishing Returns Without Enforcement
Three retrospectives have identified the same pattern: code review catches issues (73 this epic), but without a mandatory fix pass, the issues accumulate as documented debt. The review process is working (issues are found); the resolution process is broken (issues are not fixed).

### 6. Platform Admin App Is a Solid Operational Foundation
Despite the code review issues, E13b delivers a functional platform admin portal that covers:
- Tenant lifecycle management (create, suspend, reactivate, archive)
- Billing enforcement with state machine validation
- AI usage monitoring with alerts and spike detection
- Impersonation with time limits and dual audit logging
- Immutable audit log with filtering and CSV export
- Plan management with CRUD and assignment
- Support console search

---

## Technical Debt Register

### HIGH (16 issues across 6 stories)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | `tryBootstrapAuth()` can set `isAuthenticated: true` without user — bypasses RBAC | E13b-1 #1 | Security: RBAC bypass |
| 2 | Dashboard test tests a COPY of the component, not the real one | E13b-1 #2 | Unreliable test |
| 3 | `VALID_PLATFORM_ROLES` duplicated in two files (DRY violation) | E13b-1 #3 | Maintenance risk |
| 4 | Archive dialog incorrectly requires a reason (contradicts spec) | E13b-2 #1 | Spec violation |
| 5 | Missing files specified in story's "Files to Create" list | E13b-2 #2 | Incomplete delivery |
| 6 | ConfirmationDialog `onCancel` fires on successful confirmation | E13b-2 #3 | Bug |
| 7 | `platform-sidebar.tsx` modified despite being protected | E13b-3 #1 | Protected file violation |
| 8 | `auth-store.ts` setAccessToken behavior changed (protected file) | E13b-3 #2 | Protected file violation |
| 9 | Tests mock wrong Prisma raw query function | E13b-4 #1 | Unreliable tests |
| 10 | `features/intelligence/` modified (E5d protected file) | E13b-4 #2 | Protected file violation |
| 11 | `routes/platform/ai.routes.ts` modified (E3b protected file) | E13b-4 #3 | Protected file violation |
| 12 | `payload` variable not in scope in `onSuccess` — runtime error | E13b-5 #1 | Runtime crash |
| 13 | `searchGeneral` calls `findUnique` with arbitrary non-UUID input | E13b-5 #2 | Potential crash/data leak |
| 14 | Impersonation assigns `SUPER_ADMIN` with no action restrictions | E13b-5 #3 | Security: unrestricted access |
| 15 | Dynamic `import('@nexa/db')` on every impersonation request | E13b-5 #4 | Performance + reliability |
| 16 | Cursor pagination lacks secondary sort key — duplicate/skip entries | E13b-6 #1 | Data pagination bug |

### MEDIUM (34 issues tracked in story files)

Key themes:
- **RBAC gaps:** PLATFORM_SUPPORT role accepted but not in Prisma enum (E13b-1 #6), Dashboard doesn't show read-only for PLATFORM_SUPPORT (E13b-1 #7)
- **Test mocking issues:** Mock duplication across test files (E13b-5 #8), tests set null data and rely on fallbacks (E13b-3 #6), module-level mocks (E13b-3 #7)
- **Data accuracy:** Enforcement counts derived from billing status 1:1 mapping (E13b-3 #4), billing detail "Last Payment" always blank (E13b-3 #3), batch distribution counts all versions (E13b-4 #5)
- **Security:** Empty companyId fallback in impersonation (E13b-5 #7), email search doesn't actually search PlatformUser.email (E13b-5 #5)
- **UX/Accessibility:** CSV export bypasses api-client middleware (E13b-6 #4), JSON detail panel not keyboard-focusable (E13b-6 #6)

### LOW (23 issues tracked in story files)

Key themes:
- Redundant state management (E13b-1 #11 `setIsSubmitting`)
- Misleading placeholder text (E13b-1 #12)
- Story status not updated (E13b-1 #13)
- Port 5112 not documented in CLAUDE.md (E13b-1 #14)
- ConfirmationDialog doesn't reset reason state (E13b-2 #11)
- Archive button inline instead of overflow menu (E13b-2 #12)
- Gradient ID collision in SVG charts (E13b-4 #9)
- `URL.revokeObjectURL` called too early (E13b-6 #9)

---

## Previous Retrospective Follow-Through

### E5d Action Items Assessment

| # | E5d Commitment | Status | Evidence in E13b |
|---|---------------|--------|------------------|
| 1 | CR4 fix pass mandatory — zero done stories with HIGH issues | NOT APPLIED | All 6 stories have HIGH issues (16 total) |
| 2 | Decompose UI stories to ≤8 tasks | MOSTLY APPLIED | 5/6 stories ≤8 tasks; E13b-4 has 9 |
| 3 | Transaction wrapping checklist in code review | NOT APPLICABLE | E13b is mostly frontend |
| 4 | Test assertions match actual implementation | NOT APPLIED | E13b-1 #2 (copy test), E13b-4 #1 (wrong mock) |

### E5d Tech Debt Assessment

| # | E5d Debt Item | Status | Impact on E13b |
|---|--------------|--------|----------------|
| 1 | Fix KnowledgeRagService VectorSearchService bypass | NOT RESOLVED | No impact — separate subsystem |
| 2 | Wrap chunkAndEmbed in transaction | NOT RESOLVED | No impact — separate subsystem |
| 3 | Fix correction upsert idempotency | NOT RESOLVED | No impact — separate subsystem |
| 4 | Fix createArticleIfNotExists transaction | NOT RESOLVED | No impact — separate subsystem |
| 5-14 | Remaining E5d HIGH issues | NOT RESOLVED | No direct E13b impact |

**Assessment:** E5d tech debt didn't impact E13b because the subsystems are independent (E5d = AI knowledge pipeline, E13b = platform admin portal). However, accumulated debt across E5c + E5d + E13b now totals ~40 HIGH issues, which represents a growing systemic risk.

### Pattern Across Three Retrospectives

| Metric | E5c | E5d | E13b | Trend |
|--------|-----|-----|------|-------|
| Total Issues | 60 | 58 | 73 | Increasing |
| HIGH Issues | 12 | 15 | 16 | Increasing |
| CR4 Fix Pass Applied | No | 1/6 stories | 0/6 stories | Worsening |
| Previous Retro Items Applied | 1/4 | 2/5 | 1/4 | Flat |

---

## Next Epic Preview

### E14: Finance / NL (General Ledger) — First Business Module

E14 is the **first business module** in Tier 2. It transitions from platform infrastructure to actual business functionality:

| Aspect | E13b (Platform Admin) | E14 (Finance/GL) |
|--------|----------------------|-------------------|
| Tier | 1 (Core Platform) | 2 (First Business Module) |
| Database | Platform DB only | Tenant DB with companyId scoping |
| Users | Platform admins (vendor operators) | Finance administrators (tenant employees) |
| i18n | English-only | Full i18n with translation keys |
| Complexity | CRUD + dashboards | State machines, double-entry accounting, fiscal periods |

**Dependencies on E13b:** None directly. E14 depends on E3 (Event Bus), E4 (i18n), E6 (Frontend Shell), E8 (Attachments), not on E13b.

**Key Risks for E14:**
1. First time implementing double-entry accounting — ChartOfAccounts, JournalEntries, multi-currency, bank reconciliation
2. First time using companyId scoping in business logic (all E13b work is platform-scoped with no companyId)
3. FR11–FR18 coverage requires financial precision (NFR38: decimal precision)
4. 10 stories planned — largest story count of any epic so far
5. UK GAAP (FRS 102) compliance requirements add domain complexity

**Preparation Needed:**
1. No E13b prerequisites block E14 — they are independent subsystems
2. Review `arch-sections/` for Finance module architecture detail
3. Ensure Prisma migration tooling is stable (E13b-4 added a migration to platform DB; E14 will add many tenant DB migrations)
4. Address the accumulated HIGH debt backlog (40+ items) to prevent systemic quality degradation

---

## Action Items

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|-----------------|
| 1 | **ENFORCE CR4 FIX PASS** — This is the fourth time documenting this. Add it as a mandatory orchestrator step, not a team agreement. The fix pass must run BEFORE story is marked "done" | Bob (SM) / Mohammed (Project Lead) | Zero "done" stories with unresolved HIGH issues in E14 |
| 2 | Add "protected file audit" to code review checklist — reviewer must verify no protected files were modified outside scope | Murat (TEA) | Zero protected file violations in E14 |
| 3 | Security review for impersonation feature before production | Winston (Architect) | E13b-5 HIGH issues (#3, #4) resolved + security sign-off |
| 4 | Test quality gate: no test may duplicate/copy a component — must import the real one | Amelia (Dev) | No copy-paste tests in E14 |

### Technical Debt Resolution (Priority Order)

| # | Action | Priority | Scope |
|---|--------|----------|-------|
| 1 | Fix impersonation SUPER_ADMIN unrestricted access | CRITICAL | E13b-5 #3 — security |
| 2 | Fix `payload` not in scope runtime error | CRITICAL | E13b-5 #1 — crash |
| 3 | Fix `tryBootstrapAuth` RBAC bypass (authenticated without user) | HIGH | E13b-1 #1 — security |
| 4 | Fix `searchGeneral` non-UUID findUnique call | HIGH | E13b-5 #2 — crash |
| 5 | Fix cursor pagination secondary sort key | HIGH | E13b-6 #1 — data correctness |
| 6 | Revert protected file modifications or properly scope changes | HIGH | E13b-3 #1/#2, E13b-4 #2/#3 |
| 7 | Fix ConfirmationDialog onCancel firing on confirm | HIGH | E13b-2 #3 — bug |
| 8 | Fix archive dialog reason requirement (spec violation) | HIGH | E13b-2 #1 — spec |
| 9 | Fix tests that mock wrong functions or test copies | HIGH | E13b-1 #2, E13b-4 #1 |
| 10 | Address remaining 34 MEDIUM + 23 LOW issues | MEDIUM | Tracked in story files |
| 11 | Carry forward E5d HIGH debt (14 items) | MEDIUM | E5d retro items 1–14 |
| 12 | Carry forward E5c CRITICAL debt (automation engine) | LOW | E5c items 1–4 |

### Documentation

| # | Action | Owner |
|---|--------|-------|
| 1 | Add port 5112 (platform-admin) to CLAUDE.md port table | Bob (SM) |
| 2 | Update epic-E13b.md story status table to reflect actual completion | Bob (SM) |

### Team Agreements

- **CR4 fix pass is mandatory** — not a suggestion, not "when possible." MANDATORY. (Fourth time stating this.)
- **Protected files require explicit approval** to modify outside the creating story's scope
- **Tests must import real components** — no hand-duplicated test copies
- **Security-critical features** (auth, impersonation, RBAC) get a dedicated security review pass
- **Client-side aggregation** is acceptable for MVP but must be documented as known limitation with performance threshold

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 16 HIGH issues unresolved; tests exist but some are unreliable |
| Deployment | Dev environment only — platform-admin at port 5112, platform-api at port 5101 |
| Technical Health | Good — Platform Admin app is functional and complete; architecture is sound |
| Codebase Stability | Moderate concern — protected file modifications may have introduced cross-story regressions |
| Security | Needs review — impersonation feature has unrestricted SUPER_ADMIN access |
| Unresolved Blockers | 2 CRITICAL (impersonation security, runtime error), 14 HIGH issues |

---

## Next Steps

1. **Address 2 CRITICAL items** immediately: impersonation SUPER_ADMIN restriction (E13b-5 #3) and payload runtime error (E13b-5 #1)
2. **Security review** of impersonation feature end-to-end before any production deployment
3. **Begin E14 (Finance / General Ledger)** — no E13b prerequisites block it
4. **Institutionalise CR4 fix pass in the orchestrator script** — team agreements alone have not been effective
5. **Triage accumulated HIGH debt** (40+ items across E5c/E5d/E13b) — prioritise by production risk
6. **Update CLAUDE.md** with port 5112 assignment

---

*Retrospective facilitated by Bob (Scrum Master). All 6 stories reviewed. 73 code review issues catalogued (16 HIGH, 34 MEDIUM, 23 LOW). E5d retrospective action items mostly not applied (1 of 4). CR4 fix pass NOT applied to any E13b story despite being mandated for the third consecutive time. E13b-5 (Impersonation) identified as highest-risk feature requiring dedicated security review. 4 process improvement actions, 12 debt resolution items, and 5 team agreements established.*

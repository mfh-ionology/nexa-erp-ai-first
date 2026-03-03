# Epic E9 Retrospective: Notifications

**Date:** 2026-03-03
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Complete (4/4 stories done)

---

## Epic Summary

Epic E9 delivered the full notification infrastructure for the AI-First ERP — from backend event-driven notification creation through real-time WebSocket delivery, email channel integration, and a user-facing preferences management UI.

| Story | Title | Status |
|-------|-------|--------|
| E9.1 | Notification Service (event-driven creation, template rendering, BullMQ dispatch, preference cascade) | done |
| E9.2 | In-App Notifications (WebSocket delivery, bell/dropdown/toast, Zustand store, React Query hooks) | done |
| E9.3 | Email Notification Channel (Nodemailer SMTP, HTML email templates, retry logic) | done |
| E9.4 | Notification Preferences (preferences matrix UI, role-based defaults, 3-level cascade) | done |

**FRs Delivered:** FR184 (notification service), FR185 (notification preferences), FR186 (notification centre)
**NFRs Targeted:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR31 (retry with exponential backoff)

---

## Delivery Metrics

- **Stories Completed:** 4/4 (100%)
- **Tier:** 1 (Core Platform)
- **Dependencies Used:** E3 (Event Bus), E6 (Frontend Shell), E5 (AI Orchestration — event types)
- **New Infrastructure Created:**
  - `apps/api/src/modules/communications/notifications/` — Full notification service (template renderer, target resolver, dispatch worker, event subscribers, WebSocket handler, preference cascade)
  - `apps/api/src/modules/communications/email/` — Email sender, config, HTML email template renderer
  - `apps/web/src/features/notifications/` — Complete frontend (bell, dropdown, toast, provider, preferences page, API hooks, Zustand store)
  - `packages/i18n/locales/en/notifications.json` — i18n namespace for notification UI
  - 1 Prisma migration (notification models + enums)
  - 11 seed notification templates

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E9.1 Notification Service | 3 | 7 | 5 | 15 |
| E9.2 In-App Notifications | 4 | 6 | 2 | 12 |
| E9.3 Email Notification Channel | 3 | 5 | 3 | 11 |
| E9.4 Notification Preferences | 3 | 4 | 3 | 10 |
| **TOTAL** | **13** | **22** | **13** | **48** |

All issues documented in story files under "Code Review Notes" sections. Issues surfaced after 3 CR iterations per story but NOT fixed before stories were marked "done."

---

## Successes

### 1. Complete Notification Infrastructure End-to-End
E9 delivered a fully functional notification pipeline: business event fires → template matched → content rendered → channels resolved per user preferences → dispatched via BullMQ → delivered (in-app via WebSocket, email via SMTP). This is a substantial piece of infrastructure touching backend services, queues, WebSockets, and frontend state management.

### 2. Clean Event-Driven Architecture
The notification service integrates cleanly with the E3 event bus. Template-based subscription (match `NotificationTemplate.eventName` to fired events) means new notification types can be added by inserting a database row — no code changes required. 11 default templates were seeded covering approvals, invoices, orders, stock alerts, access changes, and automation events.

### 3. Robust Delivery Orchestration
BullMQ-based dispatch with per-channel independent delivery is architecturally sound:
- Channel failures are isolated (email failure does not block in-app delivery)
- 3-attempt exponential backoff (30s/120s/300s) with automatic FAILED status after exhaustion
- Graceful degradation: email sender is nullable — SMTP not configured = no-op with warning log
- WebSocket push is best-effort — failure does not revert DELIVERED status

### 4. 3-Tier Notification UX
The frontend implements the UX spec's 3-tier notification system cleanly:
- URGENT/HIGH: toast notification + notification centre + badge
- NORMAL/LOW: badge update + notification centre only
- Real-time delivery via Socket.io with Zustand store for optimistic updates
- React Query for data fetching with cache invalidation on mutations

### 5. Preference Cascade System
The 3-level preference cascade (user → role default → template default) per BR-COM-014 was fully implemented with:
- User preferences: per-template, per-channel toggle
- Role-based defaults: admin-configurable per role
- Template defaults: seed-data driven
- Visual indicators in UI showing preference source ("default" vs user-set)

### 6. Improved Issue Count vs E8/E5c
48 total issues across 4 stories is a reduction from E8 (63 across 4 stories) and E5c (60 across 6 stories). While still significant, this represents a downward trend in issue density (12.0 per story in E9 vs 15.8 in E8 vs 10.0 in E5c).

---

## Challenges

### 1. HIGH Issues Still Not Blocking Story Completion
Despite E8 and E5c retrospectives both establishing that HIGH code review issues must be fixed before marking stories "done," E9 continued the pattern: 13 HIGH issues across 4 stories, all stories marked "done" with issues unresolved. This is now the **third consecutive retrospective** flagging this team agreement violation.

### 2. E9.4 AC #4 is Functionally Broken (Role Defaults Not Wired to Dispatch)
The role-based defaults from E9.4 are only used in the `getPreferences()` display endpoint. The actual notification dispatch in `createNotificationsFromEvent()` uses a 2-level cascade (user preference → template default), completely bypassing role defaults. Admin-configured role defaults are **silently ignored** during notification delivery — the most critical acceptance criterion (AC #4) doesn't work at the routing level.

### 3. Test Quality Issues (E9.1)
Multiple test/implementation mismatches in E9.1:
- Tests mock `findUnique` but service calls `findMany` (Issue #1)
- Tests don't mock `$transaction`, making `createNotificationsFromEvent` tests unreachable (Issue #2)
- Event test asserts wrong argument count (Issue #3)

These suggest tests may have been written against an earlier design and not updated when the implementation evolved — or tests were never actually run to completion.

### 4. Race Conditions and State Management (E9.2)
- Unread count race condition causes permanent off-by-1 errors (Issue #4)
- NotificationErrorBoundary re-renders broken component in loop (Issue #1)
- Dismissed notifications reappear after query refetch (Issue #2)
- URGENT toast auto-dismisses after 8s contradicting "no auto-dismiss until action" spec (Issue #3)

### 5. Email Security Gaps (E9.3)
- Duplicate email sends possible on crash recovery with no idempotency (Issue #2)
- `email.sent` event silently dropped when email was actually sent (Issue #3)
- Potential email header injection via `fromName` env var (Issue #7)
- Plugin shutdown order may lose queued emails (Issue #11)

### 6. Task Count Still Exceeds Guidelines
- E9.1: 9 tasks (exceeds ≤5 guideline)
- E9.2: 12 tasks (exceeds ≤5 guideline — the highest in E9)
- E9.3: 6 tasks (borderline)
- E9.4: 6 tasks (borderline)

The ≤5 task guideline from E8 and E5c retrospectives was again not applied.

---

## Key Insights

### 1. Previous Retrospective Action Items: Still Not Applied (Third Consecutive Epic)

**E8 Retrospective Action Items (4 items):**

| # | E8 Commitment | Status in E9 | Evidence |
|---|--------------|-------------|----------|
| 1 | HIGH issues block story completion | NOT APPLIED | 13 HIGH issues, all stories "done" |
| 2 | Transaction wrapping as coding standard | PARTIALLY APPLIED | E9.1 uses `$transaction` for notification creation, but inconsistently |
| 3 | Break UI stories into ≤5 tasks | NOT APPLIED | E9.1=9 tasks, E9.2=12 tasks, E9.3=6, E9.4=6 |
| 4 | Update Architecture docs for schema extensions | NOT VERIFIED | |

**E5c Retrospective Action Items (5 items):**

| # | E5c Commitment | Status in E9 | Evidence |
|---|---------------|-------------|----------|
| 1 | ENFORCE HIGH issues as hard gate | NOT APPLIED | Same pattern continues |
| 2 | Decompose UI stories to ≤5 tasks | NOT APPLIED | E9.2 had 12 tasks |
| 3 | Eliminate "frontend-only"/"backend-only" labels | APPLIED | E9 stories accurately describe scope |
| 4 | Add automated WCAG testing | NOT VERIFIED | No evidence of axe-core integration |
| 5 | Extract shared VariableAutocompleteTextarea | NOT APPLICABLE | Not relevant to E9 |

**Assessment:** Of 9 unique action items from E8+E5c, only 1 was clearly applied (accurate story scoping). The core issues — HIGH issues as a gate, task count limits — remain unenforced through 3 consecutive epics.

### 2. Backend Stories Continue to Produce Cleaner Code
- E9.1 (backend, 9 tasks): 15 issues (1.7/task) — but 3 HIGH were test mismatch issues
- E9.2 (full-stack, 12 tasks): 12 issues (1.0/task) — but 4 HIGH including race conditions
- E9.3 (backend, 6 tasks): 11 issues (1.8/task) — 3 HIGH including security gaps
- E9.4 (full-stack, 6 tasks): 10 issues (1.7/task) — 3 HIGH including broken AC

Issue density per task is more uniform in E9 than in previous epics, suggesting the quality gap between backend and frontend stories has narrowed.

### 3. Preference Cascade Architecture Gap
The 3-level cascade was implemented in the display layer (`getPreferences()`) but not in the execution layer (`resolveChannels()`). This is a common trap: the UI shows the correct data but the runtime doesn't use it. Integration tests covering "admin sets role default → new user receives notification on that channel" would have caught this.

### 4. Notification Infrastructure is Solid Despite Issues
Despite 48 code review issues, the notification infrastructure is architecturally sound. The event-driven design, template-based subscriptions, BullMQ dispatch, and WebSocket delivery form a robust pipeline. Most issues are at the edges (error handling, race conditions, test quality) rather than in the core design.

### 5. Graceful Degradation Pattern is Exemplary
E9.3's approach to SMTP configuration — nullable email sender, no-op on missing config, warning log, app still starts — is an excellent pattern. The system works for in-app notifications even if email is not configured. This should be documented as a reference pattern for future optional integrations.

---

## Technical Debt Register

### CRITICAL (Functional Correctness)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | Role defaults not wired into notification dispatch (`resolveChannels()` skips role defaults) | E9.4 #2 | AC #4 broken — admin role defaults silently ignored |
| 2 | `createNotificationsFromEvent` tests unreachable (no `$transaction` mock) | E9.1 #2 | Core notification creation logic untested |
| 3 | Duplicate email sends on crash recovery with no idempotency mitigation | E9.3 #2 | Users may receive duplicate notification emails |

### HIGH (Functional Bugs and UX Issues)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 4 | NotificationErrorBoundary re-renders broken component in loop | E9.2 #1 | Potential page crash |
| 5 | Dismissed notifications reappear after query refetch | E9.2 #2 | Poor UX — user action appears to be ignored |
| 6 | URGENT toast auto-dismisses after 8s, contradicting spec | E9.2 #3 | URGENT notifications dismissed before user can act |
| 7 | Unread count race condition (permanent off-by-1) | E9.2 #4 | Badge count permanently incorrect |
| 8 | Tests mock `findUnique` but service calls `findMany` | E9.1 #1 | Preference tests don't match implementation |
| 9 | Event test asserts wrong argument count (3 vs 4) | E9.1 #3 | Test may pass vacuously |
| 10 | `email.sent` event silently dropped when email was actually sent | E9.3 #3 | Audit trail gap for email notifications |
| 11 | Post-save dirty state never clears in preferences page | E9.4 #1 | User sees "unsaved changes" after saving |
| 12 | Test assertion uses wrong i18n key (`saveError` vs `resetError`) | E9.4 #3 | Test either fails or doesn't test what it claims |
| 13 | `emailSender` null behaviour contradicts story spec | E9.3 #1 | Implementation/spec mismatch |

### MEDIUM (22 issues tracked in story files)

Key themes:
- JWT accepted via query parameter on WebSocket server side (E9.2 #5 — security)
- Clicking READ notification fires useless 422 PATCH (E9.2 #6)
- No validation of incoming WebSocket payloads on client (E9.2 #7)
- `auth` block always sent even when SMTP credentials are empty (E9.3 #4)
- No unit tests for `email-config.ts` (E9.3 #5)
- Duplicate `escapeHtml`/`escapeAttr` functions (E9.3 #6)
- Potential email header injection via `fromName` (E9.3 #7)
- `sanitize-html` dependency undocumented (E9.3 #8)
- RoleDefaultsSection dirty state disconnected from page-level navigation blocker (E9.4 #4)
- Role names displayed as raw enum values (E9.4 #5)
- Hook test data missing `source` field (E9.4 #6)
- No test for role-switch-with-unsaved-changes dialog (E9.4 #7)
- `defaultChannels.includes()` uses string literals instead of enum values (E9.1 #7)
- `ApprovalRequest` missing from target resolver `modelMap` (E9.1 #8)
- Dedup query over-deduplicates when `entityType`/`entityId` null (E9.1 #9)
- Route plugins not wrapped with `fp()` (E9.1 #6)
- Redundant Zustand store updates from select-created references (E9.2 #8)
- `useNotifications` fetches all statuses but Zustand caps at 50 (E9.2 #9)
- PENDING notifications visible in dropdown but not actionable (E9.2 #10)

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|-----------------|
| 1 | **ENFORCE (3rd time):** HIGH code review issues must be fixed before story marked "done" — implement as an automated check in the BMAD orchestrator script | Bob (SM) | Before E10 | Orchestrator script rejects story completion when HIGH issues exist |
| 2 | **ENFORCE (3rd time):** Break stories into ≤5 tasks — implement max task count validation in story creation workflow | Bob (SM) | Before E10 | Story creation rejects stories with >5 tasks or splits them |
| 3 | Add integration tests that verify end-to-end flows across service boundaries (e.g., "event fires → notification dispatched with correct channels based on role defaults") | Amelia (Dev) | Before E10 | At least 1 integration test per critical AC in each story |
| 4 | Review and fix all test/implementation mismatches — verify every test actually runs and tests what it claims | Amelia (Dev) | Before E10 | All tests pass with correct assertions |

### Technical Debt Resolution (Priority Order)

| # | Action | Priority | Scope |
|---|--------|----------|-------|
| 1 | Wire role defaults into `resolveChannels()` in `notification.service.ts` | CRITICAL | E9.4 #2 — AC #4 broken |
| 2 | Add `$transaction` mocking to E9.1 core notification tests | CRITICAL | E9.1 #2 — untested creation logic |
| 3 | Add idempotency key to email dispatch (prevent duplicate sends on crash recovery) | CRITICAL | E9.3 #2 |
| 4 | Fix error boundary re-render loop | HIGH | E9.2 #1 |
| 5 | Fix dismissed notifications reappearing after refetch | HIGH | E9.2 #2 |
| 6 | Fix URGENT toast auto-dismiss (should persist until action) | HIGH | E9.2 #3 |
| 7 | Fix unread count race condition | HIGH | E9.2 #4 |
| 8 | Fix post-save dirty state in preferences page | HIGH | E9.4 #1 |
| 9 | Wire up `email.sent` event emission correctly | HIGH | E9.3 #3 |
| 10 | Fix all test/mock mismatches (E9.1 #1, #3; E9.4 #3) | HIGH | Multiple stories |
| 11 | Address remaining 22 MEDIUM issues | MEDIUM | Tracked in story files |

### Team Agreements

- HIGH code review issues MUST be fixed before story marked "done" (REITERATED — 3rd time. If not enforced by E10, this agreement should be embedded in tooling, not relied on as a manual practice.)
- Transaction wrapping is mandatory for multi-operation service functions (REITERATED from E8)
- Stories target ≤5 tasks (REITERATED from E8, E5c — 3rd time)
- Integration tests must verify end-to-end flows for critical acceptance criteria
- Graceful degradation pattern (nullable optional dependencies) should be the standard for optional integrations

---

## Next Epic Preview: E10 (Email Integration)

E10 is defined in sprint-status as **backlog** with 3 planned stories:
- E10.1: SMTP Outbound Service
- E10.2: Email Template Management
- E10.3: Document-to-Email

**Note:** E10 does not yet have an epic definition file in `_bmad-output/implementation-artifacts/epics/`.

**Dependencies on E9:**
- E10 builds on E9.3's email sender (`createEmailSender`, Nodemailer transport)
- E10's EmailTemplate model extends E9.1's NotificationTemplate pattern
- E10 will replace E9.3's per-notification email with a full EmailMessage/EmailQueue system
- E10's per-company SMTP settings will extend E9.3's global SMTP config

**Preparation Needed:**
1. **Fix E9.4 role defaults cascade** — this is a functional correctness issue that should be resolved before building more notification-dependent features
2. **Fix E9.3 email idempotency** — duplicate email prevention is essential before E10 scales up email volume
3. **Define E10 epic file** with detailed story specifications
4. **Run pre-epic frontend design gate** if E10 has UI stories (E10.2 likely has template management UI)
5. **Decide:** Address E9 CRITICAL/HIGH debt first, or carry forward alongside E10?

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 13 HIGH issues unresolved, test/mock mismatches in E9.1, AC #4 broken in E9.4 |
| Deployment | Dev environment — not yet deployed to staging/production |
| Technical Health | Good overall — architecture is sound, pipeline works end-to-end for in-app and email channels |
| Codebase Stability | Good — no regressions in existing modules detected |
| Unresolved Blockers | 3 CRITICAL items (role defaults cascade, test coverage, email idempotency) |

---

## Trend Analysis (E8 → E5c → E9)

| Metric | E8 (4 stories) | E5c (6 stories) | E9 (4 stories) | Trend |
|--------|----------------|-----------------|----------------|-------|
| Total issues | 63 | 60 | 48 | Improving |
| HIGH issues | 18 | 16 | 13 | Improving |
| Issues per story | 15.8 | 10.0 | 12.0 | Stable |
| HIGH issues per story | 4.5 | 2.7 | 3.3 | Stable |
| Retro action items applied | N/A (first) | 1 of 4 (25%) | 1 of 9 (11%) | Declining |
| Stories exceeding ≤5 tasks | Not measured | 2 of 6 | 2 of 4 | Same pattern |

**Key observation:** Issue counts are improving, but process discipline (applying retro learnings) is not. The team agreements are established but not enforced. The most impactful improvement would be embedding these checks in tooling rather than relying on manual compliance.

---

## Next Steps

1. **Fix 3 CRITICAL technical debt items** — role defaults cascade, test coverage, email idempotency
2. **Fix 10 HIGH technical debt items** — error boundary, race conditions, toast behaviour, test mismatches
3. **Embed retro action items in tooling** — add task count validation and HIGH issue gating to BMAD orchestrator
4. **Define E10 epic file** — full story specifications
5. **Run frontend design gate for E10** if it includes UI stories
6. **Begin E10 planning** when critical path items are resolved

---

*Retrospective facilitated by Bob (Scrum Master). All 4 stories reviewed. 48 code review issues catalogued (13 HIGH, 22 MEDIUM, 13 LOW). 4 process improvement actions, 11 debt resolution items, and 5 team agreements established. Previous retrospective action items assessed — 1 of 9 applied (11%). Trend analysis shows improving issue counts but declining process discipline.*

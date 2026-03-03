# Epic E8 Retrospective: Attachments + Notes + Record Links

**Date:** 2026-03-03
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Complete (4/4 stories done)

---

## Epic Summary

Epic E8 delivered cross-cutting infrastructure for attachments, notes, and record links — three polymorphic data services that any future business module can use. The epic covered:

| Story | Title | Status |
|-------|-------|--------|
| E8.1 | Attachment Service (presigned URL upload, S3/MinIO, MIME validation) | done |
| E8.2 | Notes Service (typed notes: General, Internal, Customer Visible, System) | done |
| E8.3 | Record Links Service (bidirectional linking with typed relationships) | done |
| E8.4 | Cross-Cutting UI Components (AttachmentPanel, NotesPanel, LinksPanel) | done |

**FRs Delivered:** FR85 (Attachments), FR87 (Record Links)
**NFRs Targeted:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR28 (Keyboard navigation)

---

## Delivery Metrics

- **Stories Completed:** 4/4 (100%)
- **Tier:** 1 (Core Platform)
- **Dependencies Used:** E6 (Frontend Shell), E3 (Event Bus), E0/E1 (Foundation)
- **New Infrastructure Created:**
  - `apps/api/src/core/storage/` — S3/MinIO client (reusable)
  - `apps/api/src/core/entity-registry/` — Entity type validation (reusable)
  - `apps/api/src/modules/cross-cutting/` — Cross-cutting module (extensible)
  - `apps/web/src/features/cross-cutting/` — UI feature module
  - MinIO service added to `docker-compose.yml`
  - 3 Prisma migrations applied

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E8.1 Attachment Service | 2 | 6 | 4 | 12 |
| E8.2 Notes Service | 3 | 6 | 3 | 12 |
| E8.3 Record Links Service | 2 | 6 | 4 | 12 |
| E8.4 Cross-Cutting UI | 11 | 12 | 4 | 27 |
| **TOTAL** | **18** | **30** | **15** | **63** |

All issues documented in story files under "Code Review Notes" sections. Issues were surfaced after 3 CR iterations per story but NOT fixed before stories were marked "done."

---

## Successes

### 1. Consistent Polymorphic Pattern
The entityType + entityId pattern without companyId was implemented consistently across all 3 backend services. Company scoping is enforced through parent entity validation — the service layer always validates that the referenced entity belongs to the caller's companyId. This is a clean, well-documented architectural decision that avoids FK enforcement problems with polymorphic models.

### 2. Strong Infrastructure Reuse
The entity registry created in E8.1 was cleanly reused by E8.2 and E8.3 with zero modifications. The cross-cutting module barrel was extended incrementally (attachment routes → note routes → record-link routes) without breaking previous work. Protected files from E0/E1 were preserved per CLAUDE.md rules.

### 3. Comprehensive Story Documentation
Each story had thorough Dev Notes explaining:
- Why `companyId` is omitted from cross-cutting models (intentional Architecture §2.20 decision)
- Presigned URL 3-step upload pattern (presign → S3 PUT → confirm)
- Schema extensions beyond Architecture spec (deletedAt for soft delete, isSystemGenerated flag)
- Entity registry reuse instructions for subsequent stories

### 4. Framework Utilities for Future Modules
`createSystemLink()` and `createSystemNote()` are internal-only functions ready for future modules:
- Sales → Invoice: CREATED_FROM link
- Payment → Invoice: PAYMENT_FOR link
- State transitions: SYSTEM notes (e.g., "Status changed to POSTED by AI")

### 5. Complete Cross-Cutting UI Feature Set
End-to-end feature delivery: API client functions, React Query hooks, AttachmentPanel (drag-drop upload, progress tracking), NotesPanel (timeline view, type badges, pin/unpin), LinksPanel (grouped by type, bidirectional), ActionBar badge integration, entity display utilities.

---

## Challenges

### 1. Code Review Issue Volume (18 HIGH Issues)
63 total issues across 4 stories is significant. The 18 HIGH issues include:
- **Functional breakage:** Collapsible double-toggle breaking LinksPanel, popup blocker blocking downloads, drag-drop flicker
- **Security gaps:** XSS bypass, tabnapping vulnerability, incomplete executable blocklist
- **Race conditions:** TOCTOU on storageKey, no transaction wrapping for multi-operation service functions
- **Missing test coverage:** AC4 (AddNoteForm) and AC6 (AddLinkForm) had zero test coverage

### 2. E8.4 Quality Gap
11 HIGH issues in a single story — the highest in the project. The UI story had 8 tasks covering API hooks, 3 panel components, ActionBar integration, utilities, tests, and visual design. This scope was too large for a single story.

### 3. Race Conditions as Recurring Theme
TOCTOU vulnerabilities appeared in 3 out of 4 stories:
- E8.1: `storageKey` duplicate check (findFirst) vulnerable to concurrent requests
- E8.2: `createNote` entity validation and creation without transaction
- E8.3: RELATES_TO reverse duplicate check has concurrent race window

### 4. Document Synchronisation Rule Violation
Architecture docs were NOT updated after extending the schema with `deletedAt` (Note) and `isSystemGenerated` (RecordLink). This violates the MANDATORY Document Synchronisation Rule in CLAUDE.md.

### 5. Test Coverage Gaps in E8.4
- AddNoteForm: ZERO test coverage (AC4 entirely untested)
- AddLinkForm: Mocked to `null` in tests (AC6 entirely untested)
- Phone breakpoint + keyboard navigation: Entirely untested (AC7)
- Upload abort/cleanup: Untested (memory leak path)

---

## Key Insights

### 1. Code Reviews Find Issues But Don't Fix Them
The CR process surfaces problems effectively (3 iterations each), but documented issues accumulate as unresolved technical debt. **Decision needed:** Should HIGH issues block story completion, or are they tracked debt?

### 2. UI Stories Need Decomposition
E8.4 demonstrates that large UI stories (8 tasks, 3 panel components, hooks, utilities) produce disproportionately more quality issues. Breaking into one story per panel (AttachmentPanel, NotesPanel, LinksPanel) would improve quality and enable focused review.

### 3. Transaction Wrapping Should Be Standard
Every service function performing 2+ DB operations should use `prisma.$transaction()`. This pattern was inconsistently applied — Note service partially uses it, Attachment and RecordLink services do not. Should be a documented coding standard.

### 4. Accessibility Testing Needs Automation
Multiple WCAG violations slipped through: missing `role="alert"`, missing `aria-label`, no keyboard navigation tests, no phone breakpoint tests. Consider adding axe-core or Playwright accessibility assertions to the test pipeline.

---

## Technical Debt Register

### CRITICAL (Fix before E9)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | Collapsible double-toggle breaks LinksPanel entirely | E8.4 #1 | Users cannot use links panel |
| 2 | `window.open` after await blocked by popup blockers | E8.4 #2 | Attachment downloads silently fail |
| 3 | `window.open` without `noopener` — tabnapping vulnerability | E8.4 #11 | Security: opened page can manipulate ERP |
| 4 | Drag-drop flicker (missing `onDragEnter` handler) | E8.4 #3 | Poor UX during file upload |
| 5 | `pinNote` allows modifying SYSTEM notes | E8.2 #1 | Violates AC — SYSTEM notes should be read-only |
| 6 | Incomplete executable blocklist (.jar, .hta, .scr missing) | E8.4 #10 | Security: malicious files can be uploaded |
| 7 | No unmount cleanup for upload (leaked requests) | E8.4 #4 | Memory leak, zombie state updates |
| 8 | XHR abort listener never removed (memory leak) | E8.4 #5 | Memory leak per upload |

### HIGH (Fix soon)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 9 | No unique constraint on `storageKey` | E8.1 #1 | TOCTOU race on concurrent uploads |
| 10 | No presign-to-confirm binding | E8.1 #2 | Any STAFF can confirm any upload |
| 11 | XSS bypass via `javascript:` URIs | E8.2 #2 | Security vulnerability |
| 12 | createRecordLink no transaction wrapping | E8.3 #2 | Race condition on entity validation |
| 13 | TOCTOU on RELATES_TO reverse duplicate | E8.3 #1 | Logical duplicate links possible |
| 14 | Pin/Unpin available to ALL users on ANY note | E8.4 #6 | No RBAC gate on pin action |
| 15 | AddNoteForm zero test coverage | E8.4 #7 | AC4 untested |
| 16 | AddLinkForm zero test coverage | E8.4 #8 | AC6 untested |
| 17 | `displayRef` shows raw UUID prefix | E8.4 #9 | Unusable for ERP users |

### MEDIUM (Tracked)

30 MEDIUM issues documented across story files. Key themes:
- Missing transaction wrapping (E8.2, E8.3)
- Entity registry includes non-existent entity types (E8.1)
- WCAG violations (E8.4: missing role="alert", aria-label)
- Test mock gaps (E8.4: count invalidation untested)
- `font-serif` violates Concept D design system (E8.4)
- i18n locale not passed to date formatting (E8.4)

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|-----------------|
| 1 | HIGH code review issues must be fixed before story marked "done" | Bob (SM) | Before E9 | No story marked "done" with unresolved HIGH issues |
| 2 | Add transaction wrapping as coding standard | Winston (Architect) | Before E9 | Standard in project-context.md |
| 3 | Break UI-heavy stories into ≤5 tasks | Bob (SM) | Ongoing | UI panels get individual stories |
| 4 | Update Architecture docs for schema extensions | Dev Agent | Before E9 | deletedAt (Note), isSystemGenerated (RecordLink) documented |

### Technical Debt Resolution

| # | Action | Priority | Estimated Effort |
|---|--------|----------|-----------------|
| 1 | Fix 8 CRITICAL issues (functional breakage + security) | CRITICAL | Medium |
| 2 | Fix 9 HIGH issues (race conditions + test gaps) | HIGH | Medium |
| 3 | Address WCAG violations in cross-cutting UI | MEDIUM | Low-Medium |
| 4 | Implement `displayRef` resolution (backend API enhancement) | MEDIUM | Medium |

### Team Agreements

- Transaction wrapping is mandatory for multi-operation service functions
- HIGH code review issues block story completion
- UI stories should target ≤5 tasks per story
- WCAG compliance must be verified with automated tools before story completion

---

## Next Epic Preview: E9 (Notifications)

E9 is defined in sprint-status as backlog with 4 planned stories:
- E9.1: Notification Service
- E9.2: In-App Notifications
- E9.3: Email Notification Channel
- E9.4: Notification Preferences

**Dependencies on E8:**
- Notification service may use `createSystemNote()` from E8.2 for audit trail
- E8.2's `pinNote` SYSTEM note bug should be fixed before E9 integration
- Event bus (E3) is the primary dependency, not E8

**No significant discoveries invalidate E9's direction.** The plan is sound, but the CRITICAL and HIGH technical debt from E8 should be addressed before starting E9 to prevent compounding quality issues.

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 18 HIGH issues unresolved, test coverage gaps in E8.4 |
| Deployment | Dev environment — not yet deployed to staging/production |
| Technical Health | Mixed — backend services are solid, UI has functional breakage |
| Unresolved Blockers | 8 CRITICAL issues should be fixed before E9 |

---

## Next Steps

1. **Fix CRITICAL technical debt** (8 items) — functional breakage and security issues
2. **Fix HIGH technical debt** (9 items) — race conditions and test coverage
3. **Update Architecture docs** — schema extensions from E8.2 and E8.3
4. **Add transaction wrapping standard** to project-context.md
5. **Begin E9 planning** when critical path items are resolved

---

*Retrospective facilitated by Bob (Scrum Master). All 4 stories reviewed. 63 code review issues catalogued. 4 action items, 4 debt resolution items, and 4 team agreements established.*

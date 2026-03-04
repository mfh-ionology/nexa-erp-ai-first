# Epic E5d Retrospective: AI Knowledge Evolution & Cross-Tenant Intelligence

**Date:** 2026-03-04
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Partial (5/6 stories done — E5d-4 in backlog)

---

## Epic Summary

Epic E5d closes the **learning loop** for Nexa's AI system, operating at two levels:

1. **Per-Tenant Knowledge Evolution** — Knowledge articles with RAG pipeline, correction capture with auto-learning, training examples for few-shot injection, and a tenant admin Knowledge Management UI
2. **Cross-Tenant Intelligence** — Anonymised aggregation pipeline, skill effectiveness tracking, weekly insights generation, and a Platform Intelligence Dashboard for vendor product decisions

| Story | Title | Status |
|-------|-------|--------|
| E5d.1 | Knowledge Base Schema & RAG Pipeline | done |
| E5d.2 | Correction Loop & Training Examples | done |
| E5d.3 | Cross-Tenant Intelligence Pipeline (Platform) | done |
| E5d.4 | Platform Knowledge Distribution | **backlog** |
| E5d.5 | Knowledge Management UI (Tenant) | done |
| E5d.6 | Platform Intelligence Dashboard (Vendor) | done |

**FRs Delivered:** FR4 (contextual AI), FR6 (AI-powered analytics)
**NFRs Targeted:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR50 (data privacy)

---

## Delivery Metrics

- **Stories Completed:** 5/6 (83%)
- **Incomplete:** E5d-4 (Platform Knowledge Distribution) — tasks 1-4 done, tasks 5-9 incomplete
- **Tier:** 1 (Core Platform)
- **Dependencies Used:** E5 (AI Orchestration), E5b (AI Co-Pilot Intelligence), E5c (Admin & Automations), E3b (Platform API)
- **New Infrastructure Created:**
  - `apps/api/src/ai/` — Knowledge article service, chunking service, RAG service, correction capture, training examples, learning signals
  - `apps/platform-api/src/services/` — Anonymisation, cross-tenant aggregation, insights generation, knowledge distribution, tenant DB connector
  - `apps/platform-api/src/routes/admin/` — Intelligence and knowledge admin routes
  - `apps/web/src/features/ai-admin/knowledge/` — Complete Knowledge Management UI (5 tabs)
  - `apps/platform-admin/` — Full Vite + React + TanStack Router app (port 5112) with AI Intelligence dashboard
  - 5 new tenant Prisma tables (ai_knowledge_articles, ai_knowledge_chunks, ai_training_examples, ai_correction_log, ai_learning_signals)
  - 5 new platform Prisma tables (tenant_ai_patterns, tenant_ai_corrections, platform_knowledge_base, ai_skill_effectiveness, platform_ai_insights)
  - 2 Prisma migrations applied (tenant + platform)

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total | Rounds |
|-------|------|--------|-----|-------|--------|
| E5d.1 Knowledge Base Schema & RAG Pipeline | 8 | 16 | 4 | 28 | 2 rounds |
| E5d.2 Correction Loop & Training Examples | 3 | 5 | 3 | 11 | 1 round |
| E5d.3 Cross-Tenant Intelligence Pipeline | 3 | 6 | 3 | 12 | 1 round |
| E5d.4 Platform Knowledge Distribution | — | — | — | — | Not reviewed (backlog) |
| E5d.5 Knowledge Management UI (Tenant) | 1 | 4 | 2 | 7 | 1 round |
| E5d.6 Platform Intelligence Dashboard | 3 | 4 | 3 | 10 | 1 round |
| **TOTAL** | **18** | **35** | **15** | **68** | |

All issues documented in story files under "Code Review Notes" sections. Issues surfaced during review but NOT fixed before stories were marked "done."

---

## Successes

### 1. Two-Database Architecture Executed Successfully
E5d delivered a complete cross-boundary system: tenant knowledge → anonymised aggregation → platform intelligence → vendor insights. The platform DB uses `tenantId` (not `companyId`), raw `pg` connections for dynamic tenant reads, and proper data isolation. This is architecturally sound and privacy-respecting.

### 2. Anonymisation Service as Pure Function
The anonymisation service (`apps/platform-api/src/services/anonymisation.service.ts`) was designed as a pure function with no DB or side effects — fully unit-testable. PII verification tests create realistic data with names/emails/amounts, then validate the sanitised output. This is a strong pattern for compliance-critical code.

### 3. Confidence-Weighted RAG Re-Ranking
The knowledge RAG pipeline implements a clean design: source-based confidence weights (admin=1.0, vendor-accepted=0.9, AI-confirmed=0.8, AI-unconfirmed=0.5), vector similarity search, and token-budgeted injection (~1000 tokens). This ensures the most trustworthy knowledge gets priority in AI context.

### 4. Correction-to-Knowledge Feedback Loop
The correction loop is a well-designed learning flywheel: user corrects AI → log correction → detect patterns (threshold: 3) → auto-generate draft knowledge article → admin confirms → RAG retrieves on next similar query → AI gets smarter. This is the core differentiator for an AI-first ERP.

### 5. Platform Admin App Bootstrap
E5d-6 successfully converted the `apps/platform-admin/` stub into a fully working Vite + React + TanStack Router application with a comprehensive AI Intelligence dashboard (KPI panel, feature gaps, workflow opportunities, skill effectiveness, industry breakdown, correction patterns, and publish knowledge workflow).

### 6. Consistent AI Admin UI Patterns
E5d-5 followed the established patterns from E5c (types → hooks → tabbed page → barrel exports), reusing the same AI admin architecture. The Knowledge Management page has 5 well-structured tabs matching the established frontend conventions.

---

## Challenges

### 1. Code Review Issue Volume Continues to Grow (18 HIGH Issues)
68 total issues across 5 reviewed stories is the highest in any epic so far. E5d-1 alone had 28 issues across 2 review rounds. Despite the E5c retrospective explicitly reiterating the E8 action item "HIGH issues block story completion," all stories were marked "done" with unresolved HIGH issues. **This team agreement has been violated across three consecutive epics (E8 → E5c → E5d).**

### 2. Test-Implementation Mismatches (Most Recurring HIGH Pattern)
The most pervasive issue across E5d: tests assert behaviour that doesn't exist in the implementation.
- **E5d-1:** Tests assert VectorSearchService methods are called but they never are (KnowledgeRagService bypasses VectorSearchService with raw SQL)
- **E5d-3:** Route test cursor pagination assertion doesn't match implementation
- **E5d-6:** Accessibility tests assert non-existent pagination UI and `aria-live` page counter

This pattern indicates tests are being written from the spec/AC rather than from the actual implementation, creating a false sense of coverage.

### 3. Non-Transactional Operations Causing Data Integrity Risks
Multiple stories have critical operations without transaction wrapping:
- **E5d-1:** `chunkAndEmbed` delete-then-create is NOT transactional — risk of permanent chunk data loss on interruption
- **E5d-1:** `createArticle` makes both chunking AND embedding fire-and-forget, violating the AC guarantee
- **E5d-3:** Correction upsert is NOT idempotent — re-running aggregation for the same date corrupts `tenantCount` and `occurrenceCount`

This repeats the exact same pattern flagged in E8 and E5c retrospectives. Transaction wrapping remains inconsistently applied.

### 4. E5d-4 Left Incomplete (Half-Implemented Story)
E5d-4 (Platform Knowledge Distribution) has tasks 1-4 done (platform CRUD, migration, distribution service, internal API) but tasks 5-9 incomplete (PlatformClient extension, tenant-side endpoints, versioning tests, skill update distribution, comprehensive tests). This creates:
- Orphaned platform-side code with no tenant consumer
- E5d-5's "Suggested" tab scaffolded but non-functional
- End-to-end distribution pipeline broken (knowledge can be published but never reaches tenants)

### 5. VectorSearchService Bypass (Architectural Violation)
E5d-1's `KnowledgeRagService` uses raw SQL (`$queryRawUnsafe`) for vector similarity search instead of reusing E5b's shared `VectorSearchService.similaritySearch()`. This directly violates the epic's own AC-3 ("Reuses `VectorSearchService.similaritySearch()` from E5b.S4 — do NOT create a separate vector search implementation") and means two different vector search code paths now exist in the codebase.

### 6. PII Leak Risk Through Dictionary Keys
E5d-3's anonymisation service strips PII from values but PII can leak through JSON dictionary KEYS in anonymised output. For example, if a skill key contains a customer name, it passes through the anonymiser unchecked. This is a GDPR compliance gap.

### 7. Dead Code and Unused Hooks
Multiple instances of dead code that passed review:
- E5d-5: `useCreateArticleFromCorrection` hook is dead code — the form calls the regular create endpoint instead
- E5d-2: Training example category matching uses wrong taxonomy — tier 2 priority never activates
- E5d-3: `TenantAiCorrection.industry` column is never populated (dead schema)

---

## Key Insights

### 1. E5c Retrospective Action Items: 0 of 5 Applied

| # | E5c Commitment | Status | Evidence in E5d |
|---|---------------|--------|-----------------|
| 1 | ENFORCE: HIGH issues block story completion | **NOT APPLIED** | 18 HIGH issues across E5d, all stories marked "done" |
| 2 | Decompose UI stories to ≤5 tasks | **NOT APPLIED** | E5d-5: 11 tasks, E5d-6: 11 tasks |
| 3 | Eliminate "frontend/backend-only" labels | **PARTIALLY** | E5d stories didn't use misleading labels |
| 4 | Add automated WCAG testing to pipeline | **NOT APPLIED** | No axe-core or automated WCAG in CI |
| 5 | Extract shared VariableAutocompleteTextarea | **NOT APPLIED** | No shared component created |

**Assessment:** Zero of five E5c action items were fully applied. This is the third consecutive retrospective where the same commitments are made and ignored. The team agreement process has lost credibility.

### 2. Backend Stories Produce Significantly More Issues Than Expected
Unlike E5c where backend stories (E5c-1, E5c-2) were cleaner than frontend stories, E5d-1 (backend) was the most problematic story with 28 issues across 2 review rounds. The difference: E5d-1 was X-Large complexity with tight cross-service integration (reusing E5b services, DynamicContextService integration, vector search). **Complexity, not frontend/backend distinction, drives issue count.**

### 3. Fire-and-Forget Patterns Masking Failures
Several places use fire-and-forget (no `await`, no error handling) where the ACs require completion guarantees:
- E5d-1: Article creation returns before chunking/embedding completes
- E5d-2: Correction event subscriber fires async without tracking completion
This makes the system appear faster but creates silent failure paths that are hard to diagnose.

### 4. Two-Database Architecture Creates Fragility
Raw `pg` client connections for cross-tenant reads (instead of Prisma) are inherently more fragile. Connection management, error handling, and SQL injection protection must all be handled manually. This is a necessary architectural trade-off but should be wrapped in robust abstractions.

### 5. Aspirational Tests Create False Confidence
E5d-6's accessibility tests assert against UI elements (pagination controls, `aria-live` regions) that were never implemented. These tests will fail immediately when run. Writing tests for unbuilt features creates a false impression of coverage and delays failure discovery.

---

## Technical Debt Register

### CRITICAL (Data integrity and architectural violations)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | `chunkAndEmbed` delete-then-create is NOT transactional — chunk data loss risk | E5d-1 R2 #1 | Interrupted operations leave articles without chunks |
| 2 | `createArticle` chunking+embedding are fire-and-forget — violates AC | E5d-1 R2 #2 | API returns success before processing completes |
| 3 | Correction upsert is NOT idempotent — re-runs corrupt aggregate counts | E5d-3 #1 | Running daily aggregation twice corrupts platform data |
| 4 | KnowledgeRagService bypasses VectorSearchService with raw SQL | E5d-1 R1 #1 | Two vector search paths, one unmanaged |
| 5 | E5d-4 half-implemented — distribution pipeline broken end-to-end | E5d-4 | Knowledge can be published but never reaches tenants |

### HIGH (Functional bugs and security gaps)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 6 | PII leaks through dictionary KEYS in anonymised output | E5d-3 #3 | GDPR compliance gap |
| 7 | Training example category matching uses wrong taxonomy | E5d-2 #1 | Skill-specific examples never prioritised |
| 8 | `POST /corrections/:id/create-article` doesn't set `wasAutoResolved` | E5d-2 #2 | Stats under-report resolved corrections |
| 9 | Learning signals `totalQueries` inflation | E5d-2 #3 | Misleading skill performance metrics |
| 10 | `$queryRawUnsafe` used instead of `Prisma.sql` tagged templates | E5d-1 R1 #4 | SQL injection risk |
| 11 | Cursor-based pagination broken with multi-column sort | E5d-1 R1 #2 | Pagination returns wrong results |
| 12 | `updateArticle` returns stale `chunkCount` after content changes | E5d-1 R2 #3 | API returns incorrect data |
| 13 | Route test cursor pagination assertion doesn't match implementation | E5d-3 #2 | False test coverage |
| 14 | Accessibility tests assert non-existent UI elements | E5d-6 #1, #2 | Tests will fail immediately |
| 15 | Industry breakdown renders empty state + populated panel simultaneously | E5d-6 #3 | Visual bug |
| 16 | "Create Article From Correction" uses wrong endpoint (dead hook) | E5d-5 #1 | Corrections not linked to generated articles |
| 17 | Settings localStorage key not scoped to tenant/company | E5d-5 M2 | Settings bleed between tenants |
| 18 | `formatDate()` timezone sensitivity shifts query dates ±1 day | E5d-3 M1 | Wrong data selected for aggregation |

### MEDIUM (35 issues tracked in story files)

Key themes:
- Race condition in `chunkAndEmbed` during content update (E5d-1 R1 #3)
- Token budget ignores formatting overhead (E5d-1 M)
- Dead code paths (unused hooks, unreachable branches) across multiple stories
- No error states rendered in any Knowledge Management tab component (E5d-5 M3)
- Missing unit tests for 4 major dashboard sections (E5d-6 M3)
- Hardcoded hex colours instead of CSS variables (E5d-6 L1)
- Correction routes bypass service layer (E5d-2 M)
- Person name PII detection bypassed by SAFE_WORDS (E5d-3 M2)
- No concurrency protection on aggregation endpoints (E5d-3 M4)

---

## Previous Retrospective Follow-Through

### E5c Retrospective Action Items Assessment

| # | E5c Commitment | Status | Evidence in E5d |
|---|---------------|--------|-----------------|
| 1 | HIGH issues block story completion (REITERATED from E8) | **NOT APPLIED** | 18 HIGH issues, all stories "done" |
| 2 | UI stories ≤5 tasks (REITERATED from E8) | **NOT APPLIED** | E5d-5: 11 tasks, E5d-6: 11 tasks |
| 3 | Eliminate misleading scope labels | **PARTIALLY** | No false labels used in E5d |
| 4 | Add automated WCAG testing | **NOT APPLIED** | No automated WCAG in CI |
| 5 | Extract VariableAutocompleteTextarea | **NOT APPLIED** | Component not extracted |

### E5c Team Agreements Status

| Agreement | Honoured? |
|-----------|-----------|
| HIGH issues MUST be fixed before story "done" (hard gate) | No — third consecutive violation |
| Transaction wrapping mandatory for multi-op functions | No — E5d-1 chunk replacement and E5d-3 upsert both lack transactions |
| UI stories target ≤5 tasks | No — both UI stories exceeded this by 2x |
| No file-level `eslint-disable` | No — E5d-5 uses file-level `/* eslint-disable i18next/no-literal-string */` |
| Automation engine wiring must be verified before dependencies | Not verified in E5d context |

**Assessment:** The team agreement process has failed across three consecutive epics. The same commitments are made, documented, and then completely ignored. This retrospective MUST address why agreements aren't being honoured rather than simply reiterating them.

---

## Significant Discovery Alert

### 1. E5d-4 Incomplete — Distribution Pipeline Broken

E5d-4 (Platform Knowledge Distribution) is only half-implemented. Tasks 1-4 are done (platform CRUD, migration, distribution service, internal API) but tasks 5-9 are incomplete (PlatformClient extension, tenant-side endpoints, versioning, skill updates, tests). This means:

- Knowledge articles can be published on the platform but never reach tenants
- E5d-5's "Suggested" tab is scaffolded but non-functional
- The full E5d vision (platform → tenant knowledge flow) is incomplete

**Impact:** Medium-High — The tenant-side knowledge evolution (E5d-1, E5d-2, E5d-5) works independently. The cross-tenant intelligence pipeline (E5d-3) works for data collection. But the feedback loop (platform insights → improved tenant AI) is broken until E5d-4 is completed.

**Recommendation:** E5d-4 tasks 5-9 should be completed before or during E10, as the distribution pipeline is needed for the full AI learning loop to close.

### 2. Three-Epic Pattern of Ignored Agreements

The same commitments (HIGH issues block completion, UI task limits, transaction wrapping) have been made in E8, E5c, and now E5d retrospectives without being honoured. This is not a knowledge problem — the team knows what to do. It's a structural enforcement problem. The BMAD orchestrator workflow needs a hard gate that prevents `done` status when HIGH code review issues exist.

---

## Next Epic Context: E10 (Email Integration)

E10 is already **in-progress** with 3 stories:
- E10-1: SMTP Outbound Service (done)
- E10-2: Email Template Management (done)
- E10-3: Document to Email (backlog)

**Dependencies on E5d:**
- E10 does NOT directly depend on E5d features
- E10 is a parallel workstream focused on communications infrastructure
- E5d's knowledge system could eventually learn email patterns, but this is not a blocking dependency

**Preparation for E10-3:**
- E10-3 (Document to Email) is the remaining backlog item
- It requires completed email templates (E10-2: done) and SMTP service (E10-1: done)
- It introduces document-to-email workflow connecting documents to email templates

---

## Action Items

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|-----------------|
| 1 | **STRUCTURAL ENFORCEMENT:** Add hard gate to orchestrator preventing `done` status when HIGH CR issues exist | Bob (SM) + Dev | Orchestrator script rejects `done` transition when HIGH issues are unresolved |
| 2 | **MANDATORY:** Split X-Large UI stories into ≤5 tasks per sub-story | Bob (SM) | No story exceeds 5 tasks — enforce at story creation |
| 3 | Stop reiterating ignored agreements — implement automated enforcement instead | Bob (SM) | Replace verbal commitments with tooling gates |
| 4 | Require test authors to run tests against implementation before marking story done | Amelia (Dev) | Zero test-implementation mismatches in next epic |
| 5 | Add transaction wrapping linter/review checklist item for multi-op service functions | Bob (SM) | Automated detection of unprotected multi-op sequences |

### Technical Debt Resolution (Priority Order)

| # | Action | Priority | Story Ref |
|---|--------|----------|-----------|
| 1 | Wrap `chunkAndEmbed` in `$transaction` | CRITICAL | E5d-1 R2 #1 |
| 2 | Make `createArticle` await chunking+embedding (not fire-and-forget) | CRITICAL | E5d-1 R2 #2 |
| 3 | Make correction upsert idempotent (use date+type composite key) | CRITICAL | E5d-3 #1 |
| 4 | Refactor KnowledgeRagService to use VectorSearchService | CRITICAL | E5d-1 R1 #1 |
| 5 | Complete E5d-4 tasks 5-9 (tenant-side distribution endpoints) | CRITICAL | E5d-4 |
| 6 | Fix PII leak through dictionary keys in anonymiser | HIGH | E5d-3 #3 |
| 7 | Replace `$queryRawUnsafe` with `Prisma.sql` tagged templates | HIGH | E5d-1 R1 #4 |
| 8 | Fix training example category matching taxonomy | HIGH | E5d-2 #1 |
| 9 | Fix `wasAutoResolved` not being set on manual article creation | HIGH | E5d-2 #2 |
| 10 | Fix accessibility tests to match actual implementation | HIGH | E5d-6 #1, #2 |
| 11 | Fix dead `useCreateArticleFromCorrection` hook | HIGH | E5d-5 #1 |
| 12 | Scope localStorage settings key to tenant/company | HIGH | E5d-5 M2 |
| 13 | Fix `formatDate()` timezone sensitivity | HIGH | E5d-3 M1 |
| 14 | Address remaining 35 MEDIUM issues | MEDIUM | Tracked in story files |
| 15 | Add i18n translation keys to Knowledge Management UI | LOW | E5d-5 |

### Team Agreements (ENFORCEMENT-BACKED)

- **HARD GATE:** HIGH code review issues MUST be fixed before story transitions to "done" — enforced by orchestrator script, not verbal commitment
- **HARD GATE:** No story may have more than 5 tasks — enforced at story creation time
- **REVIEW CHECKLIST:** Transaction wrapping verified for all multi-operation service functions
- **REVIEW CHECKLIST:** Tests must be run against actual implementation (not just spec) before story sign-off
- **REVIEW CHECKLIST:** All async operations that are awaited in ACs must be awaited in code (no fire-and-forget)

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 18 HIGH issues unresolved, multiple test-implementation mismatches |
| Deployment | Dev environment only — not staged or deployed to production |
| Technical Health | Mixed — architecture is sound (RAG, correction loop, anonymisation), but data integrity risks (non-transactional ops, non-idempotent upserts) |
| Codebase Stability | Good — no regressions in existing modules detected |
| Unresolved Blockers | 5 CRITICAL items, 13 HIGH items |
| E5d-4 Completion | Incomplete — 5 of 9 tasks remaining, distribution pipeline broken |
| Cross-Epic Agreement Compliance | Failed — 0/5 E5c commitments honoured |

---

## Next Steps

1. **Complete E5d-4 tasks 5-9** — Close the knowledge distribution pipeline (PlatformClient extension, tenant-side endpoints, versioning, tests)
2. **Fix 5 CRITICAL technical debt items** — Transaction wrapping, idempotent upserts, VectorSearchService reuse
3. **Fix 13 HIGH technical debt items** — PII leaks, dead code, test-implementation mismatches
4. **Implement structural enforcement gates** — Modify orchestrator to block `done` with unresolved HIGH issues
5. **Continue E10-3** — Document to Email (not blocked by E5d debt)
6. **Update sprint-status** — Mark E5d epic as done once E5d-4 is completed OR decision made to defer

---

*Retrospective facilitated by Bob (Scrum Master). 5 of 6 stories reviewed (E5d-4 in backlog). 68 code review issues catalogued (18 HIGH, 35 MEDIUM, 15 LOW). 5 process improvement actions, 15 debt resolution items, and 5 enforcement-backed team agreements established. E5c retrospective action items assessed — 0 of 5 fully applied (third consecutive failure). Key recommendation: replace verbal commitments with automated enforcement gates.*

# Epic E5d Retrospective: AI Knowledge Evolution & Cross-Tenant Intelligence

**Date:** 2026-03-11
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Complete (6/6 stories done)

---

## Epic Summary

Epic E5d closed the **learning loop** that makes Nexa's AI genuinely intelligent over time. It operates at two distinct levels:

1. **Per-Tenant Knowledge Evolution** (Tenant DB) — Knowledge articles, RAG pipeline, correction loop, training examples, and learning signals enable each tenant's AI to learn from corrections and curated knowledge
2. **Cross-Tenant Intelligence** (Platform DB) — Anonymised aggregate patterns, skill effectiveness metrics, feature gap detection, and platform-to-tenant knowledge distribution enable the vendor to improve the base AI for all tenants

| Story | Title | Status | Complexity |
|-------|-------|--------|------------|
| E5d.1 | Knowledge Base Schema & RAG Pipeline | done | X-Large (10 tasks) |
| E5d.2 | Correction Loop & Training Examples | done | X-Large (8 tasks) |
| E5d.3 | Cross-Tenant Intelligence Pipeline (Platform) | done | X-Large (9 tasks) |
| E5d.4 | Platform Knowledge Distribution | done | X-Large (9 tasks) |
| E5d.5 | Knowledge Management UI (Tenant) | done | X-Large (11 tasks) |
| E5d.6 | Platform Intelligence Dashboard (Vendor) | done | X-Large (11 tasks) |

**FRs Delivered:** FR4 (contextual AI), FR6 (AI-powered analytics)
**NFRs Targeted:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR50 (data privacy)

---

## Delivery Metrics

- **Stories Completed:** 6/6 (100%)
- **Tier:** 1 (Core Platform)
- **Dependencies Used:** E5 (AI Orchestration), E5b (Memory & Skills), E5c (Admin & Automations), E3b (Platform API), E6 (Frontend Shell)
- **New Infrastructure Created:**
  - **Tenant DB:** 5 new tables (`ai_knowledge_articles`, `ai_knowledge_chunks`, `ai_training_examples`, `ai_correction_log`, `ai_learning_signals`) + pgvector HNSW indexes + tsvector GIN indexes
  - **Platform DB:** 6 new tables (`tenant_ai_patterns`, `tenant_ai_corrections`, `platform_knowledge_base`, `ai_skill_effectiveness`, `platform_ai_insights`, `platform_knowledge_responses`)
  - **Backend Services:** ChunkingService, KnowledgeArticleService, KnowledgeRagService, CorrectionCaptureService, CorrectionPatternService, TrainingExampleService, TrainingExampleInjectionService, LearningSignalsService, TenantDbConnector, AnonymisationService, CrossTenantAggregationService, InsightsGenerationService, KnowledgeDistributionService
  - **API Endpoints:** ~30 new endpoints across tenant API (`/ai/knowledge-articles/*`, `/ai/training-examples/*`, `/ai/corrections/*`) and platform API (`/admin/intelligence/*`, `/platform/tenants/:tenantId/knowledge/*`)
  - **Frontend:** Full Knowledge Management page (5 tabs) in tenant web app + Platform Intelligence Dashboard (8 sections) as new Platform Admin app at port 5112
  - **Platform Client:** 3 new methods for knowledge distribution (`getSuggestedKnowledge`, `getPlatformArticle`, `respondToKnowledge`)

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E5d-1 Knowledge Base Schema & RAG Pipeline | 4 | 7 | 2 | 13 |
| E5d-2 Correction Loop & Training Examples | 3 | 5 | 3 | 11 |
| E5d-3 Cross-Tenant Intelligence Pipeline | 3 | 6 | 3 | 12 |
| E5d-4 Platform Knowledge Distribution | 3 | 4 | 3 | 10 |
| E5d-5 Knowledge Management UI | 2 | 3 | 3 | 8 |
| E5d-6 Platform Intelligence Dashboard | 0 | 0 | 4 | 4 |
| **TOTAL** | **15** | **25** | **18** | **58** |

**Note:** E5d-6 is the standout story — a CR4 pass fixed all HIGH and MEDIUM issues, leaving only 4 LOW. This demonstrates that the "fix issues before done" process CAN work when applied.

---

## Successes

### 1. Two-Database Architecture Proven
E5d is the first epic to implement a complete bi-directional data flow between tenant databases and the platform database. The architecture holds up:
- Tenant → Platform: anonymised aggregation via raw `pg` client connections
- Platform → Tenant: knowledge distribution via PlatformClient service token calls
- Privacy isolation verified: PII detection tests, opt-out mechanism, GDPR-compliant anonymisation

### 2. RAG Pipeline Reuses E5b Infrastructure Successfully
E5d-1 successfully reused `EmbeddingService`, `VectorSearchService`, and `DynamicContextService` from E5b without creating duplicate implementations. The confidence-weighted re-ranking on top of E5b's similarity search adds tenant-specific intelligence without duplicating vector search code.

### 3. Correction Loop Creates Genuine AI Learning
The E5d-1/E5d-2 combination creates a real feedback loop: user corrections → pattern detection → auto-generated knowledge articles → RAG retrieval → improved AI responses. This is the defining feature of an "AI-first" ERP — the AI gets measurably smarter per tenant.

### 4. E5d-6 Sets New Quality Bar
E5d-6 (Platform Intelligence Dashboard) is the first story to undergo a CR4 fix pass. All 5 HIGH issues were resolved, all MEDIUM issues were resolved, and only 4 LOW issues remain. This proves the process works and should be the standard going forward. Key fixes included:
- Rewrote accessibility tests to match actual pagination implementation
- Fixed RBAC guard logic for PLATFORM_VIEWER vs PLATFORM_ADMIN
- Added `useMemo` wrapping for computed arrays (allInsights, moduleGapCounts)
- Added missing "AI Intelligence" nav item to sidebar

### 5. Platform Admin App Shell Established
E5d-6 transformed the `apps/platform-admin/` stub into a working Vite + React application with:
- TanStack Router file-based routing
- TanStack React Query for data fetching
- Platform JWT authentication
- Sidebar navigation matching Concept D design
- This provides the foundation for E13b (Platform Admin Portal) stories

### 6. Comprehensive Cross-Cutting Intelligence
The weekly insights generation service produces four categories of actionable intelligence:
- **Feature Gaps** — queries that fail across tenants (roadmap input)
- **Workflow Opportunities** — repeated manual patterns (automation candidates)
- **Default Candidates** — configurations >60% of tenants create manually
- **Skill Improvements** — skills with high correction rates

---

## Challenges

### 1. Code Review Issue Volume Persists (15 HIGH Issues)
58 total issues across 6 stories continues the pattern from E5c (60 issues across 6 stories) and E8 (63 issues across 4 stories). 15 HIGH issues remain in "done" stories. The E5c retrospective's Action Item #1 ("HIGH issues must be fixed before story marked done") was again NOT applied to stories E5d-1 through E5d-5.

**Bright spot:** E5d-6 broke this pattern by applying CR4 fixes. The delta is stark:
- E5d-1 through E5d-5: 15 HIGH issues remain
- E5d-6: 0 HIGH issues remain

### 2. RAG Service Bypasses VectorSearchService (E5d-1 Issue #1)
The most architecturally significant finding: `KnowledgeRagService` uses raw SQL for vector search instead of E5b's `VectorSearchService.similaritySearch()` as mandated by the story's acceptance criteria. The RAG service tests assert that `VectorSearchService` methods are called — but they never are (E5d-1 Issue #5). This means:
- The story's dependency contract with E5b is violated
- The tests are misleading (they pass but test the wrong thing)
- If `VectorSearchService` behaviour changes, the RAG service won't benefit

### 3. Transaction Safety Gaps in Critical Paths
Multiple stories have non-transactional multi-step operations:
- E5d-1: `chunkAndEmbed` delete-then-create is NOT transactional (Issue #1 in Round 2) — risk of permanent chunk data loss during content updates
- E5d-4: `createArticleIfNotExists` serializable transaction is broken — INSERT happens outside the transaction (Issue #1)
- E5d-1: `createArticle` makes BOTH chunking AND embedding fire-and-forget, violating AC#2 (Issue #2 in Round 2)

### 4. PII Leak Risk in Cross-Tenant Pipeline (E5d-3 Issue #3)
PII can leak through dictionary KEYS in anonymised output. The anonymisation service strips PII from values but doesn't sanitise dictionary keys (e.g., a skill key named after a customer). While skill keys are developer-defined and unlikely to contain PII in practice, the gap in the anonymisation pipeline is a design flaw that should be addressed.

### 5. UI Story Task Decomposition Not Improved
Despite E5c retrospective Action Item #2 ("Decompose UI stories to ≤5 tasks"), both UI stories exceeded the target:
- E5d-5: 11 tasks
- E5d-6: 11 tasks

### 6. Correction Upsert is Not Idempotent (E5d-3 Issue #1)
The daily aggregation service's correction upsert corrupts `tenantCount` and `occurrenceCount` on re-runs. This means running the aggregation twice for the same date produces incorrect data. Since this is triggered manually (not cron for MVP), the risk is manageable but needs fixing before automated scheduling.

---

## Key Insights

### 1. E5c Retrospective Action Items: Partial Improvement

| E5c Action Item | Status in E5d | Evidence |
|----------------|--------------|----------|
| HIGH issues block story completion | PARTIALLY APPLIED | E5d-6 fixed all HIGH issues (CR4 pass). E5d-1 through E5d-5 did not |
| Decompose UI stories to ≤5 tasks | NOT APPLIED | E5d-5: 11 tasks, E5d-6: 11 tasks |
| Eliminate "frontend/backend" labels | APPLIED | Stories accurately describe scope (E5d-1–3 backend, E5d-4 full-stack, E5d-5–6 frontend-heavy) |
| Add automated WCAG testing | PARTIALLY APPLIED | E5d-6 has accessibility tests (axe-core), E5d-5 does not |
| Extract shared VariableAutocompleteTextarea | NOT APPLICABLE | Not relevant to E5d scope |

**Assessment:** Improvement from E5c (which applied 1 of 4 E8 items). E5d applied ~2 of 5 E5c items, with E5d-6 showing what "good" looks like.

### 2. CR4 Fix Pass Is the Missing Quality Gate
E5d-6's success demonstrates that a dedicated "fix code review issues" pass should be a standard workflow step, not an exception. The cost is modest (a focused session) and the quality improvement is dramatic (from multiple HIGH issues to zero).

### 3. Backend Stories Continue to Be Cleaner
- E5d-1 (backend): 13 issues (but 2 review rounds)
- E5d-2 (backend): 11 issues
- E5d-3 (backend): 12 issues
- E5d-4 (full-stack): 10 issues
- E5d-5 (frontend): 8 issues (lowest raw count but fewer review rounds)
- E5d-6 (frontend, with CR4): 4 issues (best after fixes)

The pattern from E5c persists: backend stories have more total issues but the issues are more contained. Frontend stories have fewer issues per round but critical UX/accessibility gaps.

### 4. Two-Database Architecture Adds Complexity but Works
E5d-3 and E5d-4 proved the two-database architecture (tenant DB + platform DB) is viable for cross-tenant intelligence. Key design decisions validated:
- Raw `pg` client for tenant DB reads (not Prisma — correct for dynamic multi-tenant connections)
- Service token auth for platform-to-ERP calls
- `TenantFeatureFlag` for opt-out (clean, granular control)
- Anonymisation as a pure function (fully unit-testable)

### 5. Platform Admin App Shell Is a Reusable Asset
E5d-6 built the Platform Admin app shell as a by-product of the Intelligence Dashboard. This shell (auth, routing, sidebar, API client) is now the foundation for E13b stories. The investment in E5d-6 pays forward directly.

### 6. All Stories Were X-Large — Epic May Need Restructuring
Every E5d story is rated X-Large. This indicates the epic covers a very large scope. For future epics of this scale, consider splitting into two smaller epics:
- E5d-a: Per-Tenant Knowledge (E5d-1, E5d-2, E5d-5)
- E5d-b: Cross-Tenant Intelligence (E5d-3, E5d-4, E5d-6)

---

## Technical Debt Register

### HIGH (Functional bugs and data integrity risks)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | KnowledgeRagService bypasses VectorSearchService — uses raw SQL instead of mandated E5b reuse | E5d-1 #1 | Architecture violation, tests misleading |
| 2 | `chunkAndEmbed` delete-then-create is NOT transactional — chunk data loss risk | E5d-1 (R2) #1 | Data loss during content updates |
| 3 | `createArticle` makes chunking AND embedding fire-and-forget | E5d-1 (R2) #2 | AC#2 violation — articles may exist without chunks/embeddings |
| 4 | Cursor-based pagination broken with multi-column sort order | E5d-1 #2 | List endpoint returns incorrect pages |
| 5 | Training example category matching uses wrong taxonomy | E5d-2 #1 | Tier 2 priority never activates |
| 6 | POST /corrections/:correctionId/create-article doesn't mark wasAutoResolved | E5d-2 #2 | Correction not tracked as resolved |
| 7 | Learning signals weighted query distribution inflates totalQueries | E5d-2 #3 | Inaccurate skill metrics |
| 8 | Correction upsert is NOT idempotent — re-runs corrupt counts | E5d-3 #1 | Data corruption on re-aggregation |
| 9 | PII leaks through dictionary KEYS in anonymised output | E5d-3 #3 | Privacy violation risk |
| 10 | `createArticleIfNotExists` transaction broken — INSERT outside TX | E5d-4 #1 | Race condition on concurrent accepts |
| 11 | Batch distribution summary counts ALL versions, not current | E5d-4 #2 | Incorrect distribution stats |
| 12 | `KnowledgeArticleStatusError` unhandled in respond endpoint | E5d-4 #3 | 500 errors on edge cases |
| 13 | Create Article From Correction bypasses dialog (AC-6 violation) | E5d-5 (R2) #1 | UX flow broken |
| 14 | Corrections API response shape mismatch — probable empty list | E5d-5 (R2) #2 | Corrections tab shows no data |

### MEDIUM (25 issues tracked in story files)

Key themes:
- Token budget doesn't account for formatting overhead (E5d-1 #8)
- Stats endpoint trend ignores date range filter (E5d-2 #4)
- Extra DB round-trip per correction event for pattern detection (E5d-2 #5)
- `formatDate()` timezone sensitivity shifts query dates (E5d-3 #4)
- Person name PII detection bypassed by SAFE_WORDS (E5d-3 #5)
- `TenantAiCorrection.industry` column never populated (E5d-3 #6)
- No concurrency protection on aggregation endpoints (E5d-3 #7)
- TOCTOU race condition on version bump (E5d-4 #4)
- Array mutation in batch distribution key computation (E5d-4 #5)
- Suggested Tab shows "all caught up" on API errors (E5d-5 (R2) #3)
- Upload dialog advertises PDF but rejects PDFs (E5d-5 (R2) #4)
- Inconsistent "Delete" vs "Deactivate" terminology (E5d-5 (R2) #5)

### LOW (18 issues tracked in story files)

Key themes:
- Missing `IF NOT EXISTS` on index creation (E5d-1)
- Unsubscribed event handlers (E5d-1)
- Pattern detection findMany cap at 100 (E5d-2)
- UK phone regex false positives (E5d-3)
- `deriveModule()` order-dependent mapping (E5d-3)
- Insight duplicate detection directional (E5d-3)
- Stale `useCorrectionStats` cache (E5d-5)
- `CollapsibleSection` className ignored on desktop (E5d-6)
- Global error handler duck typing (E5d-6)

---

## Previous Retrospective Follow-Through

### E5c Retrospective Action Items Assessment

| # | E5c Commitment | Status | Evidence in E5d |
|---|---------------|--------|-----------------|
| 1 | HIGH issues block story completion | PARTIAL | Applied in E5d-6 only; E5d-1 through E5d-5 marked done with 15 HIGH issues |
| 2 | Decompose UI stories to ≤5 tasks | NOT APPLIED | E5d-5: 11 tasks, E5d-6: 11 tasks |
| 3 | Eliminate frontend/backend labels | APPLIED | Stories scope by actual deliverables |
| 4 | Automated WCAG testing | PARTIAL | E5d-6 has accessibility tests; E5d-5 does not |
| 5 | Extract shared VariableAutocompleteTextarea | NOT APPLICABLE | Not relevant to E5d scope |

### E5c Tech Debt Items Assessment

| # | E5c Debt Item | Status | Impact on E5d |
|---|--------------|--------|---------------|
| 1 | Wire up automation engine (CRITICAL) | NOT RESOLVED | E5d did not depend on automation engine — knowledge pipelines use manual triggers |
| 2 | Fix guardrails type mismatch (CRITICAL) | NOT RESOLVED | No impact on E5d — separate subsystem |
| 3 | Fix executor tests (CRITICAL) | NOT RESOLVED | No impact on E5d |
| 4 | Fix resume action (CRITICAL) | NOT RESOLVED | No impact on E5d |
| 5-16 | HIGH + MEDIUM E5c issues | NOT RESOLVED | Accumulated tech debt, no direct E5d impact |

**Assessment:** E5c's 4 CRITICAL debt items remain unresolved. They did not block E5d because E5d's knowledge pipeline uses manual admin triggers (not the automation engine) for aggregation and insights generation. However, once automated scheduling is needed (e.g., daily cron for aggregation), the automation engine must be wired up.

### E5c Team Agreements

| Agreement | Honoured in E5d? |
|-----------|-----------------|
| HIGH issues block story completion | Partially (E5d-6 only) |
| Transaction wrapping mandatory for multi-op functions | No — E5d-1 and E5d-4 have non-transactional multi-step ops |
| UI stories ≤5 tasks | No — E5d-5 and E5d-6 both have 11 tasks |
| No file-level eslint-disable | Not verified for E5d |
| Automation engine wiring verified as prerequisite | Not applicable — E5d uses manual triggers |

---

## Next Epic Preview

### E13b: Platform Admin Portal (In-Progress)

E13b is the next active epic, already in-progress with 2/6 stories done:

| Story | Title | Status |
|-------|-------|--------|
| E13b.1 | Platform Admin App Shell | done |
| E13b.2 | Tenant Management Dashboard | done |
| E13b.3 | Billing Dashboard | backlog |
| E13b.4 | AI Usage Dashboard | backlog |
| E13b.5 | Impersonation & Support Console | backlog |
| E13b.6 | Platform Audit Log Viewer | backlog |

**Dependencies on E5d:**
- E13b.1 (done) overlaps significantly with E5d-6's platform admin app shell — E5d-6 likely implemented much of what E13b.1 specified
- E13b.4 (AI Usage Dashboard) builds on E5d-3's `ai_skill_effectiveness` and `tenant_ai_patterns` data
- The Platform Admin app shell, auth, routing, and sidebar from E5d-6 are the foundation for all E13b stories

**Preparation Needed:**
1. Reconcile E13b.1 with E5d-6 — the platform admin app shell is already built by E5d-6; E13b.1 may be partially or fully superseded
2. Verify E13b.2 (Tenant Management Dashboard) integrates with the sidebar and routing established by E5d-6
3. Address E5d HIGH issues before E13b.4 (AI Usage Dashboard) since it depends on the same intelligence data

---

## Significant Discovery: E5d-6 Supersedes E13b.1

E5d-6 built the Platform Admin app shell (authentication, routing, sidebar navigation, API client) as part of the Intelligence Dashboard. E13b.1's epic spec says "Scaffold `apps/platform-admin` as separate Vite + React app" — but this is already done by E5d-6.

**Impact on E13b:**
- E13b.1 may need to be updated to reflect that the app shell already exists
- E13b.2 may need story revision to ensure it uses E5d-6's established patterns (TanStack Router, React Query hooks, sidebar nav)
- Sprint status shows both E13b.1 and E13b.2 as "done" — suggesting they were implemented on top of E5d-6's foundation

**Recommended Action:** Review E13b story files to verify they built on E5d-6's platform admin shell rather than creating a parallel implementation.

---

## Action Items

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|-----------------|
| 1 | ENFORCE: CR4 fix pass mandatory before any story marked "done" — follow E5d-6's example | Bob (SM) | Zero "done" stories with unresolved HIGH issues |
| 2 | Decompose UI stories to ≤8 tasks (relaxed from ≤5, acknowledging X-Large reality) | Bob (SM) | No UI story exceeds 8 tasks |
| 3 | Add transaction wrapping checklist to code review criteria | Amelia (Dev) | Multi-step DB operations wrapped in transactions |
| 4 | Mandate test assertions match actual implementation (not aspirational) | Bob (SM) | No tests asserting methods that aren't called |

### Technical Debt Resolution (Priority Order)

| # | Action | Priority | Scope |
|---|--------|----------|-------|
| 1 | Fix KnowledgeRagService to use VectorSearchService (not raw SQL) | HIGH | E5d-1 #1, #5 |
| 2 | Wrap `chunkAndEmbed` in a transaction | HIGH | E5d-1 (R2) #1 |
| 3 | Fix correction upsert to be idempotent | HIGH | E5d-3 #1 |
| 4 | Fix `createArticleIfNotExists` transaction | HIGH | E5d-4 #1 |
| 5 | Sanitise dictionary keys in anonymisation service | HIGH | E5d-3 #3 |
| 6 | Fix Corrections API response shape for tenant UI | HIGH | E5d-5 (R2) #2 |
| 7 | Fix Create Article From Correction flow | HIGH | E5d-5 (R2) #1 |
| 8 | Fix batch distribution summary version filtering | HIGH | E5d-4 #2 |
| 9 | Address remaining 7 HIGH + 25 MEDIUM issues | MEDIUM | Tracked in story files |
| 10 | Carry forward E5c CRITICAL debt (automation engine wiring) | MEDIUM | E5c items 1–4 |

### Team Agreements

- CR4 fix pass is mandatory before any story is marked "done" (E5d-6 proved this works)
- Transaction wrapping is mandatory for multi-step DB operations (REITERATED — third time)
- Tests must assert actual implementation behaviour, not aspirational API usage
- Anonymisation service must sanitise both keys AND values
- UI stories target ≤8 tasks (revised upward from ≤5 to acknowledge X-Large scope)

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 15 HIGH issues across E5d-1 through E5d-5; E5d-6 is clean |
| Deployment | Dev environment only — not deployed to staging/production |
| Technical Health | Solid architecture — two-database pattern works; RAG pipeline functional; anonymisation service exists |
| Codebase Stability | Good — no regressions in existing modules detected; platform admin app shell is a reusable asset |
| Unresolved Blockers | 14 HIGH issues need resolution; E5c CRITICAL debt (automation engine) remains |

---

## Next Steps

1. **Address 14 HIGH debt items** from E5d (priority: RAG service VectorSearchService reuse, transaction wrapping, anonymisation keys, corrections API shape)
2. **Continue E13b** — stories 3–6 build on E5d-6's platform admin foundation
3. **Reconcile E13b with E5d-6** — verify E13b stories reference E5d-6's existing app shell
4. **Carry forward E5c CRITICAL debt** — automation engine wiring becomes important once automated scheduling is needed
5. **Institutionalise CR4 fix pass** — E5d-6's success should be the default, not the exception

---

*Retrospective facilitated by Bob (Scrum Master). All 6 stories reviewed. 58 code review issues catalogued (15 HIGH, 25 MEDIUM, 18 LOW). E5d-6 demonstrates that a CR4 fix pass produces dramatically better results (0 HIGH, 0 MEDIUM). E5c retrospective items partially applied (2 of 5). 4 process improvement actions, 10 debt resolution items, and 5 team agreements established.*

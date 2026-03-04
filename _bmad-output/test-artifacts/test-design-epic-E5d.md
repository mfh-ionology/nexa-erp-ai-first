---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-04'
---

# Test Design: Epic E5d - AI Knowledge Evolution & Cross-Tenant Intelligence

**Date:** 2026-03-04
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E5d

**Risk Summary:**

- Total risks identified: 15
- High-priority risks (≥6): 7
- Critical categories: SEC (2), DATA (4), TECH (1)

**Coverage Summary:**

- P0 scenarios: 13 (~28-45 hours)
- P1 scenarios: 15 (~25-45 hours)
- P2 scenarios: 11 (~8-16 hours)
- P3 scenarios: 5 (~3-6 hours)
- **Total effort**: ~64-112 hours (~1.5-3 weeks)

> **Note:** P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy for when tests run.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **LLM model fine-tuning** | Knowledge is injected via RAG at runtime, never used to fine-tune base model (per epic design) | N/A — architectural decision |
| **Real LLM integration tests** | AI Gateway and LLM providers are tested in E5/E5b/E3b; E5d tests mock the AI Gateway | E5/E3b test suites cover AI Gateway adapters, circuit breaker, quota |
| **PDF parsing library internals** | Third-party PDF extraction (e.g., pdf-parse) is not our code to test | Test document chunking output quality, not parsing internals |
| **Platform Admin Portal auth** | E3b covers platform admin authentication/MFA | E3b test suite maintains coverage |
| **pgvector extension installation** | Covered by E5b.S4 infrastructure setup and tests | E5b tests verify pgvector is operational |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | PII leakage in cross-tenant anonymisation — company names, customer names, amounts, emails, or user names cross tenant boundaries in platform aggregation. **Code review finding:** PII also leaks through JSON dictionary KEYS (not just values) in anonymised output | 3 | 3 | 9 | Automated PII detection regex suite; integration tests with synthetic PII data injected into every field AND as dictionary keys; verify zero PII in output | Dev + Security | Sprint 0 |
| R-002 | SEC | Tenant knowledge isolation failure — RAG vector search via raw SQL `$queryRawUnsafe` returns another tenant's knowledge chunks | 2 | 3 | 6 | Cross-tenant isolation tests: create knowledge for tenant A, verify tenant B's RAG query returns zero results; verify companyId in all vector search queries | Dev | Sprint 0 |
| R-003 | DATA | RAG retrieval returns irrelevant or stale knowledge — confidence-weighted re-ranking fails to surface correct articles | 2 | 3 | 6 | Precision/recall benchmarks on curated test corpus; verify top-K chunks match expected articles; test confidence weighting with known scores | Dev | Sprint 1 |
| R-004 | DATA | Correction loop auto-generates incorrect knowledge — pattern detection threshold (N=3) too low, or correction categorisation misclassifies, polluting future AI responses | 2 | 3 | 6 | Test threshold boundaries (2 corrections = no article, 3 = draft article); verify auto-generated articles have confidence 0.5; admin review gate before activation | Dev | Sprint 1 |
| R-005 | DATA | Anonymisation strips too much or too little — over-stripping makes patterns useless, under-stripping exposes PII | 2 | 3 | 6 | Bidirectional tests: verify PII stripped AND verify useful aggregate patterns preserved; test with edge cases (names that look like common words, amounts in free text) | Dev | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-006 | TECH | Document chunking produces poor boundaries — recursive text splitter cuts mid-sentence for certain document types (PDF tables, lists) | 2 | 2 | 4 | Test with various document formats (plain text, markdown headers, PDF with tables); verify token counts within 450-550 range | Dev |
| R-007 | PERF | Knowledge processing exceeds 5-second SLA — chunking + embedding + indexing for 10-page documents takes too long | 2 | 2 | 4 | Performance benchmark tests; verify <5s for standard documents; async processing for large documents | Dev |
| R-008 | TECH | Platform knowledge distribution creates stale copies — tenant accepted version 1, vendor publishes version 2, tenant still uses version 1 | 2 | 2 | 4 | Version tracking tests; verify re-suggestion on updates; test version divergence after edit-and-accept | Dev |
| R-009 | DATA | Learning signals aggregation produces incorrect metrics — daily cron with complex aggregation queries yields wrong success/correction rates | 2 | 2 | 4 | Unit test aggregation logic with known data; integration test with seeded corrections and expected metrics | Dev |

### Additional High-Priority Risks (Code Review Findings)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-013 | DATA | Correction upsert NOT idempotent — re-running daily aggregation corrupts `tenantCount` and `occurrenceCount` in `TenantAiCorrection` table because upsert logic adds instead of replacing | 3 | 2 | 6 | Test idempotency: run aggregation twice with same data, verify counts unchanged; fix upsert to use date-based replace semantics | Dev | Sprint 0 |
| R-014 | TECH | Race condition in `chunkAndEmbed` — content update deletes all chunks then creates new ones non-transactionally; concurrent reads during update return empty chunks | 2 | 3 | 6 | Wrap chunk delete+create in Prisma transaction; test concurrent read during content update returns stale-but-valid data | Dev | Sprint 1 |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-010 | BUS | Opt-out mechanism fails to exclude tenant data — boolean check on `shareAnonymisedPatterns` is bypassed | 1 | 3 | 3 | Test |
| R-011 | TECH | Platform insights generation produces low-value insights — threshold logic is too aggressive or too lenient | 1 | 2 | 2 | Monitor |
| R-012 | OPS | Cron job scheduling conflicts between daily aggregation and weekly insights jobs | 1 | 2 | 2 | Monitor |
| R-015 | OPS | No concurrency protection on aggregation endpoint — multiple simultaneous calls corrupt platform data; timezone sensitivity in `formatDate()` shifts data ±1 day | 2 | 2 | 4 | Test concurrent aggregation calls; test date boundary with UTC±12 offsets | Dev |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E5b complete (EmbeddingService, VectorSearchService, DynamicContextService operational)
- [ ] E3b complete (Platform API, AI Gateway operational)
- [ ] pgvector extension installed and tested (E5b.S4)
- [ ] Prisma migrations for E5d tenant and platform tables applied
- [ ] Seed data: default knowledge categories, test company with AI enabled
- [ ] MinIO/S3 operational for document storage (if PDF upload required)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] PII verification tests pass with zero leakage
- [ ] Cross-tenant isolation tests pass
- [ ] Test coverage agreed as sufficient

---

## Test Coverage Plan

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (≥6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| 5d.3-INT-001 | PII verification: all PII types stripped from anonymised output (names, emails, amounts, user names) | API | R-001 | Inject synthetic PII into every field, verify zero in output |
| 5d.3-INT-002 | Opt-out exclusion: tenant with `shareAnonymisedPatterns=false` produces zero platform rows | API | R-001, R-010 | Edge: toggle opt-out mid-aggregation |
| 5d.3-UNIT-001 | Anonymisation regex suite: automated PII detection passes on all anonymised output | Unit | R-001, R-005 | Test regex against known PII patterns and edge cases |
| 5d.1-INT-001 | Tenant knowledge isolation: vector search returns ONLY current tenant's chunks | API | R-002 | Create knowledge for tenant A, query as tenant B → zero results |
| 5d.1-INT-002 | RAG retrieval precision: top-K chunks relevant with confidence-weighted re-ranking | API | R-003 | Curated test corpus with known relevant/irrelevant articles |
| 5d.1-INT-003 | Knowledge CRUD respects companyId scoping on all operations | API | R-002 | Cross-tenant CRUD attempts must fail |
| 5d.2-INT-001 | Correction loop: N=3 corrections on same topic → auto-generates draft knowledge article | API | R-004 | Test boundary: 2 corrections = no article, 3 = article with confidence 0.5 |
| 5d.2-INT-002 | Auto-generated article requires admin confirmation; unconfirmed has confidence 0.5 | API | R-004 | Verify admin confirm → 0.8, reject → deleted |
| 5d.1-UNIT-001 | Document chunking produces valid chunks (~500 tokens, 50 overlap, no mid-word splits) | Unit | R-006 | Test with text, markdown, PDF content |
| 5d.1-INT-004 | RAG injection stays within ~1000 token budget during context assembly | API | R-003 | Integration with DynamicContextService from E5b |
| 5d.3-INT-007 | Aggregation idempotency: running daily aggregation twice with same data produces identical `tenantCount` and `occurrenceCount` | API | R-013 | Test re-run does not double-count; upsert replaces on conflict |
| 5d.1-INT-009 | Content update atomicity: concurrent RAG read during `chunkAndEmbed` returns valid (stale or new) chunks, never empty | API | R-014 | Simulate concurrent read during chunk replacement |
| 5d.3-UNIT-002 | PII detection covers dictionary KEYS not just values in anonymised JSON output | Unit | R-001 | Inject PII as JSON keys (e.g., `{"John Smith": 5}`) and verify stripped |

**Total P0**: 13 tests, ~28-45 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| 5d.1-INT-005 | Knowledge article CRUD: create/read/update/delete with all 4 source types | API | - | Verify source, confidence, isConfirmed per source |
| 5d.1-INT-006 | Document upload pipeline: text/markdown/PDF → chunk → embed → index within 5s | API | R-007 | Reuse EmbeddingService from E5b; <10 pages |
| 5d.1-INT-007 | usageCount and lastUsedAt updated on RAG retrieval | API | - | Verify after knowledge article used in AI response |
| 5d.2-INT-003 | Correction capture from chat, feedback, and edit actions | API | - | Verify immutable ai_correction_log record |
| 5d.2-UNIT-001 | Correction categorisation: TERMINOLOGY, PROCESS, DATA, PREFERENCE, OTHER | Unit | - | Test auto-classification logic |
| 5d.2-INT-004 | Training example CRUD and few-shot injection into context | API | - | Verify training examples appear in AI context |
| 5d.2-INT-005 | Learning signals daily aggregation: per-skill success rate, correction rate, avg confidence | API | R-009 | Seed known data, verify computed metrics |
| 5d.2-INT-006 | High correction rate (>30%) flags skill for review | API | - | Boundary: 29% = no flag, 31% = flag |
| 5d.3-INT-003 | Daily aggregation job extracts correct anonymised patterns per tenant | API | R-005 | Verify query categories, skill usage, view patterns |
| 5d.3-INT-004 | Skill effectiveness cross-tenant aggregation: avg success rate, correction rate, trend | API | - | Test IMPROVING/STABLE/DECLINING trend calc |
| 5d.4-INT-001 | Platform knowledge publish → available to tenants with industry/tier filtering | API | R-008 | Test targeting: all, specific industry, specific tier |
| 5d.4-INT-002 | Accept/Reject/Edit-and-accept creates tenant copy with correct source (PLATFORM_SUGGESTED) and confidence (0.9) | API | - | Verify reject hides article, edit diverges |
| 5d.4-INT-003 | Updated platform article re-suggests to tenants who accepted previous version | API | R-008 | Version increment triggers re-suggestion |
| 5d.5-E2E-001 | Knowledge Management page renders all tabs: Articles, Training, Corrections, Suggested, Settings | E2E | - | Verify tab navigation and content rendering |
| 5d.5-E2E-002 | Document upload flow: drag-drop, progress indicator, article created with source ADMIN_UPLOADED | E2E | - | Verify processing status feedback |

**Total P1**: 15 tests, ~25-45 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| 5d.1-UNIT-002 | Confidence score weighting: admin=1.0, vendor-accepted=0.9, AI-confirmed=0.8, AI-unconfirmed=0.5 | Unit | - | Test re-ranking with mixed scores |
| 5d.1-INT-008 | Knowledge categories filter correctly (5 categories) | API | - | Verify filter by category and combination |
| 5d.2-INT-007 | GET /ai/corrections returns grouped by category and skill with frequency counts | API | - | Verify grouping logic |
| 5d.3-INT-005 | Weekly insights generation: feature gaps, workflow opportunities, default optimisation | API | R-011 | Test threshold: >60% tenants = default candidate |
| 5d.3-INT-006 | Pattern query API filters by industry, plan tier, tenant size | API | - | Verify filter combinations |
| 5d.4-INT-004 | Skill update distribution: vendor improves skill → push suggestion | API | - | Verify skill <50% success rate triggers update |
| 5d.4-INT-005 | Default config suggestions for new tenant onboarding by industry | API | - | Test construction vs retail defaults |
| 5d.5-E2E-003 | Corrections tab: grouped view + "Create Article" action pre-fills from correction | E2E | - | Verify article pre-fill content |
| 5d.5-E2E-004 | Training Examples tab: input/output editor + "Test" button | E2E | - | Verify test execution shows match result |
| 5d.5-E2E-005 | Settings tab: toggle AI knowledge, cross-tenant sharing, retention period | E2E | - | Verify settings persist |
| 5d.6-E2E-001 | Platform Intelligence Dashboard: Feature Gaps, Skill Effectiveness, Correction Patterns | E2E | - | Verify sections render with data |

**Total P2**: 11 tests, ~8-16 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| 5d.1-PERF-001 | RAG retrieval latency: <200ms for top-5 chunks from 1000+ article corpus | API | Benchmark test |
| 5d.3-PERF-001 | Anonymisation job throughput: 100 tenants in <5 min | API | Benchmark test |
| 5d.5-E2E-006 | Stats panel: total articles, retrieval rate, correction trend charts | E2E | Verify chart rendering |
| 5d.6-E2E-002 | "Publish Knowledge" workflow with targeting options | E2E | End-to-end publish flow |
| 5d.6-E2E-003 | Industry Breakdown section with industry selector | E2E | Verify filter interaction |

**Total P3**: 5 tests, ~3-6 hours

---

## Execution Strategy

**Philosophy**: Run everything in PRs if <15 min; defer only if expensive/long-running.

| Cadence | What Runs | Estimated Time |
| --- | --- | --- |
| **Every PR** | All unit tests + API integration tests + E2E tests (Playwright parallelised) | ~10-15 min |
| **Nightly** | Performance benchmarks (5d.1-PERF-001, 5d.3-PERF-001) | ~5-10 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| P0 | 13 | ~28-45 hours | PII verification (incl. dictionary keys), isolation, RAG precision, correction loop, idempotency, atomicity |
| P1 | 15 | ~25-45 hours | CRUD, pipeline, aggregation, platform distribution, E2E pages |
| P2 | 11 | ~8-16 hours | Edge cases, filters, secondary UI flows |
| P3 | 5 | ~3-6 hours | Benchmarks, exploratory UI |
| **Total** | **44** | **~64-112 hours** | **~1.5-3 weeks** |

### Prerequisites

**Test Data:**

- Knowledge article factory (categories, sources, confidence scores, embeddings)
- Correction log factory (multiple correction types, skills, frequencies)
- Training example factory (input/output pairs with skill keys)
- Platform tenant factory (with industry, plan tier, opt-in/opt-out)
- Multi-tenant setup (minimum 2 tenants for isolation tests)

**Tooling:**

- Vitest for unit and API integration tests (existing)
- Playwright for E2E tests (existing, with playwright-utils)
- pgvector for vector similarity queries (existing from E5b)
- EmbeddingService mock for deterministic vector tests

**Environment:**

- PostgreSQL with pgvector extension enabled
- MinIO/S3 for document storage (if PDF upload tested)
- Platform API running for cross-tenant tests (E3b)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (PII, isolation, RAG)**: ≥90%
- **Security scenarios (SEC category)**: 100%
- **Business logic (correction loop, aggregation)**: ≥80%
- **Edge cases**: ≥50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (SEC category — R-001, R-002) pass 100%
- [ ] PII verification tests pass with zero leakage
- [ ] Cross-tenant isolation verified

---

## Mitigation Plans

### R-001: PII Leakage in Cross-Tenant Anonymisation (Score: 9)

**Mitigation Strategy:**
1. Build comprehensive PII regex detection suite covering: company names, customer/supplier names, invoice amounts, user names, email addresses, phone numbers, addresses
2. Inject synthetic PII into every field of test tenant data
3. Run anonymisation and verify zero PII matches in output
4. Add negative tests: verify useful aggregate patterns (counts, percentages, category labels) ARE preserved
5. Run PII detection as part of CI pipeline on every PR

**Owner:** Dev + Security
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** PII detection test suite passes with zero matches on anonymised output

### R-002: Tenant Knowledge Isolation Failure (Score: 6)

**Mitigation Strategy:**
1. Create knowledge articles for tenant A with unique content
2. Perform RAG vector search as tenant B — verify zero results
3. Verify all `$queryRawUnsafe` calls in VectorSearchService include companyId/tenantId filter
4. Test knowledge CRUD endpoints with cross-tenant access attempts — verify 403/404

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Cross-tenant isolation tests pass; code review confirms companyId in all queries

### R-003: RAG Retrieval Returns Irrelevant Knowledge (Score: 6)

**Mitigation Strategy:**
1. Create curated test corpus with known-relevant and known-irrelevant articles
2. Run RAG queries and verify top-K results match expected articles
3. Test confidence-weighted re-ranking: higher-confidence articles rank above lower-confidence
4. Verify token budget (~1000 tokens) respected in context assembly

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Precision/recall metrics meet threshold on test corpus

### R-004: Correction Loop Generates Incorrect Knowledge (Score: 6)

**Mitigation Strategy:**
1. Test threshold boundary: 2 corrections on same topic → no article, 3 → draft article
2. Verify auto-generated article has confidence 0.5 and isConfirmed=false
3. Test admin confirm flow: confirm → 0.8, edit+confirm → 0.8, reject → deleted
4. Test categorisation accuracy with known correction types

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Pattern detection and admin review tests pass

### R-005: Anonymisation Strips Too Much or Too Little (Score: 6)

**Mitigation Strategy:**
1. Bidirectional tests: verify PII stripped AND verify useful patterns preserved
2. Test edge cases: names that look like common words, amounts embedded in free text
3. Verify output contains only: statistical counts, percentages, category labels
4. Test with multi-language content (tenant data may contain non-English text)

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Bidirectional PII/pattern verification tests pass

### R-013: Aggregation Upsert Not Idempotent (Score: 6)

**Mitigation Strategy:**
1. Test idempotency: run daily aggregation with same input data twice
2. Verify `tenantCount` and `occurrenceCount` in `TenantAiCorrection` are identical after both runs
3. Fix upsert to use date-based replace semantics (upsert on `patternDate` + `correctionType` + `skillKey`)
4. Add guard: check if aggregation already ran for current date before proceeding

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Re-running aggregation produces identical platform rows

### R-014: ChunkAndEmbed Race Condition (Score: 6)

**Mitigation Strategy:**
1. Wrap chunk delete + create in Prisma `$transaction` to ensure atomicity
2. Test concurrent read during content update: RAG query returns either old or new chunks, never empty
3. Consider soft-delete pattern: mark old chunks inactive, create new, then delete old

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Concurrent read test never returns zero chunks for active article

---

## Assumptions and Dependencies

### Assumptions

1. E5b's EmbeddingService and VectorSearchService are stable and fully tested — E5d reuses them without creating separate implementations
2. pgvector extension is operational in test environment (verified by E5b.S4 tests)
3. `ai_knowledge_chunks` table is already whitelisted in VectorSearchService's `ALLOWED_TABLE_SQL` (confirmed in E5b codebase)
4. Platform API (E3b) is running and accessible for cross-tenant intelligence tests
5. AI Gateway mocks are available for deterministic testing (no real LLM calls in tests)

### Dependencies

1. E5b complete (EmbeddingService, VectorSearchService, DynamicContextService) — Required before E5d.1
2. E3b complete (Platform API, Platform Prisma schema) — Required before E5d.3
3. E5 complete (AI Service Layer, Chat Session Management) — Required before E5d.2 correction capture
4. Prisma migration for E5d tables — Required before any E5d testing

### Risks to Plan

- **Risk**: E5b services have breaking API changes before E5d starts
  - **Impact**: E5d.1 RAG pipeline and embedding integration fail
  - **Contingency**: Pin E5b service interfaces; version internal APIs

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **EmbeddingService (E5b)** | E5d.1 reuses for chunk embedding | E5b embedding tests must pass |
| **VectorSearchService (E5b)** | E5d.1 reuses for RAG retrieval | E5b vector search tests must pass |
| **DynamicContextService (E5b)** | E5d.1 injects knowledge into context budget | E5b context assembly tests must pass |
| **PatternDetectionService (E5b)** | E5d.2 mirrors threshold-based pattern detection | E5b pattern detection tests must pass |
| **Platform API (E3b)** | E5d.3/E5d.4 write to platform DB | E3b platform API tests must pass |
| **AI Gateway (E3b)** | E5d.1 embedding calls go through AI Gateway | E3b AI Gateway tests must pass |
| **Event Bus (E3)** | E5d.2 correction events, E5d.3 aggregation triggers | E3 event bus tests must pass |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: FR4 (contextual AI), FR6 (AI-powered analytics)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E5d.md`
- Architecture: §6 AI Infrastructure & Orchestration
- Dependencies: E5 (AI Orchestration), E5b (Memory & Skills), E5c (Admin & Automations), E3b (Platform API)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

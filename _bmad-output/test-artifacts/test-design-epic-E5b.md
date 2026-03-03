---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-01'
---

# Test Design: Epic E5b - AI Co-Pilot Intelligence — Memory, Skills & Dynamic Context

**Date:** 2026-03-01
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E5b — AI Co-Pilot Intelligence

E5b transforms the Nexa AI Co-Pilot from a stateless chat interface into an intelligent, context-aware assistant with five pillars: Memory System, Skills Registry (progressive disclosure), Tool Framework, Inline Entity Mentions, and Dynamic Context Assembly. This test design builds on the E5 (AI Orchestration) foundation and inherits its high-priority risk mitigations while adding new risks specific to vector search, memory persistence, skill routing, and entity autocomplete.

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (score >=6): 5
- Critical categories: SEC (1), DATA (2), TECH (1), PERF (1)

**Coverage Summary:**

- P0 scenarios: 18 (~25-40 hours)
- P1 scenarios: 28 (~30-50 hours)
- P2 scenarios: 15 (~10-20 hours)
- P3 scenarios: 6 (~3-6 hours)
- **Total effort**: ~68-116 hours (~2-3 weeks)

> **Note**: P0/P1/P2/P3 represent priority/risk classification, NOT execution timing. See Execution Strategy for timing.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **AI model accuracy tuning** | Prompt engineering and model quality are ongoing operational concerns | Skill routing correctness tested via mock LLM responses; confidence thresholds validated |
| **E5c Autonomous Workflows** | Scheduled agents and goal-oriented chaining are a separate epic | AUTONOMOUS context mode is tested (token budget), but no agent scheduling |
| **E5d Knowledge Evolution** | Tenant RAG, knowledge chunks, and learning loops are a separate epic | pgvector shared infrastructure is tested in E5b.4; knowledge chunks deferred |
| **Load/stress testing** | Performance benchmarking deferred to NFR assessment workflow | NFR1 (<3s) and NFR2 (<500ms) latency thresholds verified in functional API tests |
| **Mobile-specific UI testing** | Mobile bottom sheet for entity mentions is a rendering concern | API-level entity search contract tested; mobile rendering covered by E2E when mobile shell ships |
| **Third-party embedding provider failures** | AI Gateway handles provider failover (tested in E3b) | Embedding service tests mock the gateway; fallback chains validated in E3b |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | DATA | Hybrid search returns irrelevant or stale memories due to incorrect RRF weighting, broken temporal decay, or HNSW index drift — causes the AI to act on outdated user preferences or wrong context | 3 | 3 | 9 | Unit tests for RRF fusion algorithm with known inputs/outputs; temporal decay scoring tests at boundary conditions (halfLife=30 days); hybrid search integration tests comparing BM25-only, vector-only, and fused results; memory retrieval tests with 10K+ memories | Dev | Sprint 0 |
| R-002 | SEC | Memory isolation failure — User A's memories leak to User B or cross-tenant memory access via crafted queries. companyId + userId scoping bypass in memory CRUD or search endpoints | 2 | 3 | 6 | Tenant isolation tests for all memory endpoints (CRUD + search + forget-all); cross-user rejection tests within same tenant; SQL injection tests on search parameters; pgvector query scoping validation | Dev + QA | Sprint 0 |
| R-003 | TECH | L0→L1→L2 skill routing chain fails — wrong module selected, wrong skill activated, or negative triggers ignored. Causes the AI to execute incorrect operations (e.g., "create an invoice" activates Saved Views skill) | 2 | 3 | 6 | Routing chain integration tests with representative trigger phrases; negative trigger rejection tests; ambiguous intent tests (multi-module matches); skill pack seeding validation; tenant override tests (disabled skills excluded) | Dev | Sprint 0 |
| R-004 | DATA | Pre-compaction memory flush loses novel information — facts, decisions, or user instructions extracted from conversation are lost when context window is trimmed. Semantic deduplication merges distinct memories at cosine >0.85 | 2 | 3 | 6 | Pre-compaction flush unit tests with synthetic conversations containing extractable facts; deduplication threshold tests (0.84 = distinct, 0.86 = merge); importance score preservation tests; memory count validation before/after compaction | Dev | Sprint 1 |
| R-005 | PERF | Dynamic context assembly exceeds token budget (5000 tokens INTERACTIVE, 3000 tokens AUTONOMOUS) — causes truncation of critical context or latency spike >3s. Memory retrieval + skill loading + module knowledge must fit within budget | 2 | 3 | 6 | Token budget enforcement unit tests for both modes; assembly latency tests (<500ms target); budget overflow handling tests (graceful truncation priority: P3 context first); context assembly with maximum-size inputs | Dev | Sprint 1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-006 | TECH | QueryExecutor/ActionExecutor tool registration fails at module startup — tools not available when skill activates, causing "tool not found" errors at runtime | 2 | 2 | 4 | Tool registration integration tests at startup; missing tool handler error tests; tool RBAC enforcement tests | Dev |
| R-007 | DATA | Memory importance scoring algorithm produces unexpected results — temporal decay causes important memories to fade too quickly, or importance inflation makes all memories high-priority | 2 | 2 | 4 | Scoring algorithm unit tests with time-series data; decay curve validation at key intervals (1d, 15d, 30d, 60d, 90d); explicit vs implicit weight tests | Dev |
| R-008 | BUS | Entity mention autocomplete returns wrong entities or leaks cross-tenant data — scopeBy filter fails, or stale trigger cache serves wrong entity types | 2 | 2 | 4 | Entity search API tests with scope filters; cache invalidation tests; cross-tenant entity isolation; debounce and result limit tests | Dev |
| R-009 | TECH | Skill override mechanism breaks default skill behaviour — tenant disabling a skill still allows activation, or custom trigger phrases conflict with other skills | 2 | 2 | 4 | Override integration tests: disable skill → verify excluded from routing; custom triggers → verify routing; priority override → verify ordering | Dev |
| R-010 | TECH | pgvector extension migration fails in CI or staging — `CREATE EXTENSION IF NOT EXISTS vector` requires superuser or extension is not available | 1 | 3 | 3 | Migration test in CI pipeline; fallback to keyword-only search if pgvector unavailable; migration rollback plan | DevOps |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-011 | OPS | Memory settings UI toggle desync — user disables memories but backend still injects stale cached memories into context | 1 | 2 | 2 | Monitor — settings propagation tested via API; UI state validated in E2E |
| R-012 | BUS | AI Skills browser displays incorrect skill status for non-admin users — active/inactive toggle visible when it should be read-only | 1 | 1 | 1 | Monitor — RBAC role check in component render tests |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E5 (AI Orchestration) all stories complete and tests passing
- [ ] E6 (Frontend Shell) complete for E5b.5 and E5b.7 frontend stories
- [ ] Prisma schema updated with all E5b models (ai_memories, ai_conversation_summaries, ai_memory_settings, ai_module_knowledge, ai_skill_overrides, ai_skill_contexts, ai_entity_triggers)
- [ ] pgvector extension migration available and applied
- [ ] AI Gateway test double available (inherited from E5)
- [ ] VectorSearchService and EmbeddingService interfaces defined
- [ ] Socket.io client available for WebSocket tests (inherited from E5)
- [ ] BullMQ + Redis available in test environment (inherited from E5)
- [ ] Test data factories for User, Company, JWT generation available (inherited from prior epics)

## Exit Criteria

- [ ] All P0 tests passing (100% pass rate)
- [ ] All P1 tests passing (>=95% pass rate, failures triaged)
- [ ] No open high-priority bugs (score >=6 risks mitigated)
- [ ] Memory isolation verified — zero cross-tenant/cross-user leaks
- [ ] Hybrid search accuracy validated against known test corpus
- [ ] L0→L1→L2 skill routing chain validated end-to-end
- [ ] Dynamic context assembly stays within token budgets

---

## Test Coverage Plan

> **Note**: P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy section for when tests run.

### P0 (Critical)

**Criteria**: Blocks core AI intelligence + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|------------|------------|-----------|-------|
| E5b.1-INT-001 | Memory CRUD — create, read, update, delete memory with companyId+userId scoping | API | R-002 | Happy path + auth validation |
| E5b.1-INT-002 | Memory forget-all — hard delete all user memories for current company | API | R-002 | Verify complete deletion, no orphans |
| E5b.1-INT-003 | Memory tenant isolation — User A cannot read/modify User B's memories | API | R-002 | Cross-user + cross-tenant rejection |
| E5b.4-UNIT-001 | Hybrid search — BM25 + pgvector + RRF fusion correctness with known test corpus | Unit | R-001 | Verify ranking order against expected results |
| E5b.4-UNIT-002 | Temporal decay scoring — importance decay at boundary intervals (1d, 15d, 30d, 60d, 90d) | Unit | R-001 | Verify decay curve matches `0.5^(days/30)` |
| E5b.4-UNIT-003 | MMR re-ranking for diversity — lambda=0.7 produces diverse yet relevant results | Unit | R-001 | Compare MMR output vs pure similarity ordering |
| E5b.4-INT-001 | Hybrid search integration — end-to-end memory retrieval with 100+ seeded memories | API | R-001 | Verify relevance, scoping, and performance |
| E5b.2-INT-001 | L0→L1→L2 skill routing — correct module and skill selected for representative triggers | API | R-003 | Test 10+ trigger phrases across 3+ modules |
| E5b.2-INT-002 | Negative trigger rejection — "create an invoice" must NOT activate views skill pack | API | R-003 | Test negative triggers for all E7 skills |
| E5b.2-INT-003 | Skill pack seeding validation — E7 skill pack registers correctly with all fields | API | R-003 | Verify module key, triggers, tools, patterns |
| E5b.3-UNIT-001 | Pre-compaction memory flush — extracts facts from conversation before context trim | Unit | R-004 | Synthetic conversations with extractable facts |
| E5b.3-UNIT-002 | Semantic deduplication — cosine 0.84 keeps distinct, 0.86 merges | Unit | R-004 | Boundary threshold tests |
| E5b.3-UNIT-003 | Explicit memory parsing — "Remember I prefer FIFO" creates INSTRUCTION memory | Unit | R-004 | Pattern matching for explicit instructions |
| E5b.2-UNIT-001 | Dynamic context assembly — INTERACTIVE mode stays within 5000 token budget | Unit | R-005 | Maximum-size inputs across all context sources |
| E5b.2-UNIT-002 | Dynamic context assembly — AUTONOMOUS mode stays within 3000 token budget | Unit | R-005 | No user memories, no screen context |
| E5b.2-INT-004 | QueryExecutor RBAC enforcement — tool executes only if user has module access | API | R-003 | RBAC check + companyId scoping + result size limits |
| E5b.2-INT-005 | ActionExecutor guardrail chain — all writes staged for approval (NFR16 inherited) | API | R-003 | Zero auto-execute for financial writes |
| E5b.7-INT-001 | Entity search API — companyId-scoped, scopeBy filter, max 8 results | API | R-008 | Cross-tenant isolation + scope filter accuracy |

**Total P0**: 18 tests, ~25-40 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|------------|------------|-----------|-------|
| E5b.1-INT-004 | Memory CRUD validation — missing fields, invalid category, empty content | API | - | Schema validation tests |
| E5b.1-INT-005 | Memory list with pagination and ordering (importance + recency) | API | - | Verify ordering algorithm |
| E5b.1-INT-006 | Memory settings CRUD — enable/disable, category toggles, retention period | API | - | Per-user preferences |
| E5b.1-UNIT-001 | Memory importance scoring — explicit > implicit weighting | Unit | R-007 | Weight calculation correctness |
| E5b.1-UNIT-002 | Memory token budget — max ~2000 tokens for memory injection | Unit | R-005 | Truncation priority logic |
| E5b.2-INT-006 | Module knowledge CRUD — OVERVIEW, ENTITIES, WORKFLOWS types | API | - | System-wide (no companyId) |
| E5b.2-INT-007 | Skill override — tenant disables skill, verify excluded from routing | API | R-009 | Override integration |
| E5b.2-INT-008 | Skill override — tenant custom trigger phrases, verify routing updated | API | R-009 | Custom triggers applied |
| E5b.2-INT-009 | Skill override — priority override changes skill selection order | API | R-009 | Priority ordering |
| E5b.2-INT-010 | Tool registration at module startup — handlers available when skill activates | API | R-006 | Registration lifecycle |
| E5b.2-INT-011 | Missing tool handler — graceful error when skill references unregistered tool | API | R-006 | Error handling |
| E5b.2-UNIT-003 | Context assembly — memory injection with temporal decay applied | Unit | - | Memory selection algorithm |
| E5b.2-UNIT-004 | Context assembly — skill chain token calculation (L0+L1+L2 ~1000 tokens) | Unit | R-005 | Per-level token accounting |
| E5b.3-INT-001 | Implicit memory learning — 3+ occurrences of same action creates IMPLICIT memory | API | - | Pattern threshold detection |
| E5b.3-INT-002 | Memory conflict resolution — explicit > implicit, newer > older | API | - | Replacement logic |
| E5b.3-INT-003 | Correction handler — "No, actually I prefer FIFO now" updates existing memory | API | - | Memory update semantics |
| E5b.4-INT-002 | pgvector HNSW index — cosine similarity search returns correct nearest neighbours | API | R-001 | Index accuracy validation |
| E5b.4-INT-003 | Embedding generation via AI Gateway — batch-capable, with caching | API | - | Embedding service integration |
| E5b.4-INT-004 | Memory retrieval performance — <100ms on 10K memories per user | API | R-001 | Performance assertion |
| E5b.6-INT-001 | E7 skill pack validation — `open_entity_list` trigger "show me all invoices" | API | R-003 | End-to-end skill routing proof |
| E5b.6-INT-002 | E7 skill pack validation — `create_saved_view` with parameters | API | R-003 | Parameterised skill execution |
| E5b.6-INT-003 | E7 negative trigger — "create an invoice" does NOT route to views module | API | R-003 | Cross-module negative trigger |
| E5b.7-INT-002 | Entity trigger CRUD — system-wide, no companyId, unique [moduleKey, triggerWord] | API | - | Trigger management |
| E5b.7-INT-003 | Entity search with scopeBy — contacts scoped to specific customer | API | R-008 | Scope filter integration |
| E5b.7-INT-004 | Entity trigger cache — GET /ai/entity-triggers returns cached triggers (1hr TTL) | API | R-008 | Cache behaviour |
| E5b.5-E2E-001 | Memory Management UI — list, edit, delete memories by category | E2E | - | Concept D visual parity |
| E5b.5-E2E-002 | "Forget Everything" flow — confirmation dialog, hard delete, empty state | E2E | R-002 | User-facing security feature |
| E5b.5-E2E-003 | AI Skills browser — grouped by module, trigger phrases visible, admin toggle | E2E | - | Role-based display |

**Total P1**: 28 tests, ~30-50 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|------------|------------|-----------|-------|
| E5b.1-UNIT-003 | Memory category validation — only valid categories accepted | Unit | - | Enum constraint |
| E5b.1-INT-007 | Conversation summary creation — compressed summary of past session | API | - | Summary generation |
| E5b.1-INT-008 | Memory settings propagation — disabled memories excluded from context injection | API | R-011 | Settings integration |
| E5b.2-UNIT-005 | Skill content format — skill_content, parameters, examples all validate | Unit | - | Schema validation |
| E5b.2-INT-012 | Module knowledge filtering — ?type=ENTITIES returns only that type | API | - | Query parameter filtering |
| E5b.3-UNIT-004 | Importance score inflation guard — scores capped at configured max | Unit | R-007 | Score boundary tests |
| E5b.3-INT-004 | Memory per-user limit enforcement — oldest low-importance memories pruned | API | - | Limit enforcement |
| E5b.4-UNIT-004 | BM25 tsvector/tsquery — keyword search correctness | Unit | - | Isolated keyword search |
| E5b.4-UNIT-005 | RRF weight configuration — keyword 0.3, semantic 0.7 applied correctly | Unit | R-001 | Weight parameterisation |
| E5b.5-E2E-004 | Memory Management — memory settings panel (retention period, category toggles) | E2E | - | Settings UI |
| E5b.5-E2E-005 | Memory Management — accessibility (keyboard nav, screen reader, WCAG 2.1 AA) | E2E | - | NFR27 compliance |
| E5b.5-E2E-006 | AI Skills browser — read-only for STAFF role | E2E | R-012 | RBAC enforcement |
| E5b.7-UNIT-001 | Entity trigger word matching — client-side trigger detection logic | Unit | - | Matching algorithm |
| E5b.7-E2E-001 | Entity mention autocomplete — type "contact jo..." shows matching contacts | E2E | R-008 | Full UI interaction |
| E5b.7-E2E-002 | Entity mention chip rendering — selected entity becomes styled chip | E2E | - | Visual parity |

**Total P2**: 15 tests, ~10-20 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|------------|------------|-------|
| E5b.2-UNIT-006 | Orchestration pattern classification — SEQUENTIAL, PARALLEL, ITERATIVE, CONTEXT_AWARE, DOMAIN_INTELLIGENCE | Unit | Pattern enum coverage |
| E5b.4-UNIT-006 | MMR lambda sensitivity — compare lambda=0.5 vs 0.7 vs 0.9 output differences | Unit | Parameter sensitivity |
| E5b.7-UNIT-002 | Debounce timing — 300ms debounce on entity search API calls | Unit | Timing precision |
| E5b.3-UNIT-005 | Conversation summary quality — summary captures key decisions and instructions | Unit | Summary extraction heuristics |
| E5b.5-E2E-007 | Memory Management — responsive layout on tablet viewport | E2E | Responsive design |
| E5b.7-E2E-003 | Entity mention — keyboard navigation in autocomplete dropdown (arrow keys, enter, escape) | E2E | Keyboard UX |

**Total P3**: 6 tests, ~3-6 hours

---

## Execution Strategy

**Philosophy**: Run everything in PRs unless expensive/long-running. With Playwright parallelisation, 100s of tests complete in 10-15 minutes.

| Tier | Content | Estimated Time | Trigger |
|------|---------|---------------|---------|
| **Every PR** | All unit tests (Vitest) + all API integration tests (Vitest) + all E2E tests (Playwright) | ~10-15 min | PR to main |
| **Nightly** | Performance benchmark tests (memory retrieval <100ms on 10K memories, context assembly <500ms) | ~5-10 min | Scheduled |
| **Weekly** | Full hybrid search accuracy validation with large corpus (1K+ memories) | ~15-30 min | Scheduled |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | 18 | ~25-40 hours | Complex setup: pgvector, hybrid search fixtures, skill chain mocks |
| P1 | 28 | ~30-50 hours | Standard CRUD + routing integration tests |
| P2 | 15 | ~10-20 hours | Edge cases, UI accessibility |
| P3 | 6 | ~3-6 hours | Exploratory, benchmarks |
| **Total** | **67** | **~68-116 hours** | **~2-3 weeks** |

### Prerequisites

**Test Data:**

- Memory factory (faker-based, per-user+company, with embedding vectors)
- Skill factory (system-wide, with trigger phrases, module key, pack key)
- Module knowledge factory (OVERVIEW, ENTITIES, WORKFLOWS types)
- Entity trigger factory (per-module, with scope configuration)
- Conversation factory (multi-turn, with extractable facts for compaction tests)
- Inherited from E5: User, Company, JWT, AiConversation, AiMessage factories

**Tooling:**

- Vitest for unit and API integration tests
- Playwright for E2E tests
- pgvector extension available in test database
- Redis for context caching and session management
- BullMQ for background job tests

**Environment:**

- PostgreSQL with pgvector extension
- Redis instance for caching
- AI Gateway mock (inherited from E5)
- Embedding service mock (returns deterministic vectors for test corpus)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (memory CRUD, skill routing, context assembly)**: >=80%
- **Security scenarios (isolation, RBAC)**: 100%
- **Business logic (scoring, search, dedup)**: >=70%
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Memory tenant isolation tests pass 100% (SEC category)
- [ ] NFR16 guardrail enforcement passes 100% (inherited from E5)
- [ ] Hybrid search returns relevant results for test corpus
- [ ] Skill routing chain produces correct module/skill selection

---

## Mitigation Plans

### R-001: Hybrid Search Returns Irrelevant/Stale Memories (Score: 9)

**Mitigation Strategy:**
1. Build a known test corpus of 100+ memories with pre-computed expected relevance rankings
2. Unit test RRF fusion algorithm with deterministic BM25 and vector scores
3. Temporal decay tests at exact boundary intervals with time-mocked environment
4. Integration test comparing fused results vs individual search modalities
5. Performance benchmark: <100ms retrieval on 10K memories

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Test corpus pass rate >=95% for top-5 relevance accuracy

### R-002: Memory Isolation Failure — Cross-Tenant/Cross-User Leak (Score: 6)

**Mitigation Strategy:**
1. Mandatory companyId + userId WHERE clause in every memory query (ORM-level enforcement)
2. Integration tests: create memories for User A, attempt access as User B — expect 404/403
3. Cross-tenant tests: Company 1 user cannot see Company 2 memories
4. SQL injection tests on search parameters (hybrid search query, category filters)
5. "Forget all" endpoint validated to only delete requesting user's memories

**Owner:** Dev + QA
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Zero cross-user/cross-tenant memory access in test results

### R-003: L0→L1→L2 Skill Routing Chain Failure (Score: 6)

**Mitigation Strategy:**
1. Integration tests with 10+ trigger phrases spanning 3+ modules
2. Negative trigger tests: phrases that should NOT activate a skill
3. Ambiguous intent tests: multi-module matches return disambiguation prompt
4. Tenant override tests: disabled skills excluded, custom triggers routed correctly
5. E7 skill pack as proof-of-concept — full chain validated end-to-end

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** 100% correct routing for test trigger set; zero false activations for negative triggers

### R-004: Pre-Compaction Memory Flush Loses Information (Score: 6)

**Mitigation Strategy:**
1. Synthetic conversations with known extractable facts (preferences, decisions, instructions)
2. Verify memory count increases after flush (novel information preserved)
3. Deduplication threshold boundary tests: 0.84 cosine = keep both, 0.86 = merge
4. Importance score preservation: referenced memories retain or increase importance
5. Conflict resolution: newer explicit instruction overrides older implicit memory

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** 100% of extractable facts from test conversations captured as memories

### R-005: Dynamic Context Assembly Exceeds Token Budget (Score: 6)

**Mitigation Strategy:**
1. Unit tests with maximum-size inputs across all context sources (memories, skills, knowledge, permissions, screen context)
2. INTERACTIVE mode: verify total <=5000 tokens with graceful truncation
3. AUTONOMOUS mode: verify total <=3000 tokens, no user session context
4. Truncation priority validation: P3 context dropped first, critical context preserved
5. Assembly latency assertion: <500ms for context assembly

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** No test exceeds declared token budget; assembly latency <500ms

---

## Assumptions and Dependencies

### Assumptions

1. pgvector extension is available in PostgreSQL 16+ and can be installed in CI environments
2. Embedding vectors from the AI Gateway are deterministic for the same input text (or can be mocked deterministically)
3. E5 AI Orchestration foundation is stable — orchestrator, context engine, guardrails, and chat session are working correctly
4. The E7 (Saved Views) skill pack is the validation target for skill routing chain proof-of-concept
5. Memory retrieval performance target of <100ms on 10K memories is achievable with HNSW indexing

### Dependencies

1. E5 (AI Orchestration) — all stories complete and tests passing — Required before E5b starts
2. E6 (Frontend Shell) — complete for E5b.5 and E5b.7 frontend stories — Required before E2E tests
3. pgvector extension migration — Required before E5b.4 hybrid search tests
4. Embedding service mock — Required for deterministic vector generation in tests
5. E7 skill pack seed data — Required for E5b.6 validation tests

### Risks to Plan

- **Risk**: pgvector extension not available in CI environment
  - **Impact**: Hybrid search tests cannot run in CI
  - **Contingency**: Use Docker image with pgvector pre-installed; fallback to keyword-only search tests in CI, vector tests in staging

- **Risk**: E5 foundation has regression that breaks E5b tests
  - **Impact**: E5b test failures caused by upstream instability
  - **Contingency**: E5 regression test suite runs as prerequisite gate; E5b tests isolated from E5 implementation changes via mocks where possible

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|------------------|--------|-----------------|
| **AI Gateway (E3b)** | E5b's EmbeddingService calls the AI Gateway for vector generation | E3b AI Gateway tests must pass; mock gateway used in E5b unit/API tests |
| **AI Orchestrator (E5)** | E5b extends orchestrator with memory injection, skill routing, and context assembly | E5 orchestrator tests must pass; context assembly integration tests validate the new injection points |
| **Chat Session (E5)** | E5b adds memory-aware chat and entity mention support | E5 chat session tests must pass; E5b tests validate memory injection into existing chat flow |
| **RBAC/Auth (E2, E2b)** | Memory CRUD and skill management require RBAC enforcement | E2/E2b auth tests must pass; E5b validates role-based access for memory and skill endpoints |
| **Frontend Shell (E6)** | E5b.5 and E5b.7 add new pages to the frontend shell | E6 layout and navigation tests must pass; E5b E2E tests validate new pages within existing shell |
| **Prisma Migrations** | New tables (ai_memories, ai_module_knowledge, etc.) and pgvector extension | Migration rollback tested; no breaking changes to existing E5 tables |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/` (FR4, FR7, FR1-FR10, FR205-FR226)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E5b.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/` (§5.4, §6.1-6.10)
- Data Models: `_bmad-output/planning-artifacts/data-models/3-module-by-module-models.md` (§3.20)
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/` (§3.6)
- Prior Test Design: `_bmad-output/test-artifacts/test-design-epic-E5.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (Step-File Architecture)

---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-11'
lastEpic: 'E13'
---

# Test Design Progress — Epic E1

## Step 1: Mode Detection & Prerequisites

## Mode: Epic-Level
**Reason:** User explicitly requested E1 (Epic E1: Database + Core Models). This is a data-foundation epic with 6 stories and clear acceptance criteria.

## Prerequisites Check
- **Epic requirements:** Present (epic-e1-database-core-models.md with 6 stories, 30 ACs total)
- **Architecture context:** Available (_bmad-output/planning-artifacts/architecture/)
- **PRD:** Available for FR/NFR cross-reference

## Epic E1 Summary
- **Tier:** 0 (Foundation)
- **Type:** Data foundation
- **FRs:** FR80, FR84, FR86, FR171-FR177, FR193-FR197
- **NFRs:** NFR10, NFR13, NFR18, NFR38, NFR44, NFR49
- **Stories:** E1.S1 (Prisma Foundation), E1.S2 (System Module Models), E1.S3 (Multi-Company Models), E1.S4 (User & Session Models), E1.S5 (Number Series Service), E1.S6 (Platform Database Schema)

# Step 2: Context Loading

## Configuration
- tea_use_playwright_utils: true
- tea_browser_automation: auto
- test_artifacts: _bmad-output/test-artifacts

## Loaded Artifacts
- Epic E1: epic-e1-database-core-models.md (6 stories, 30 ACs)
- Architecture: core-architectural-decisions.md (§§2.1-2.8, §3)
- Project Context: project-context.md (§§1, 2, 8b)
- PRD FRs: FR80, FR84, FR86, FR171-FR177, FR193-FR197
- PRD NFRs: NFR10, NFR13, NFR18, NFR38, NFR44, NFR49
- Data Models, Business Rules, State Machines consulted

## Existing Test Coverage
- No existing tests found (greenfield project)

## Knowledge Fragments Loaded
- risk-governance.md
- probability-impact.md
- test-levels-framework.md
- test-priorities-matrix.md

# Step 3: Risk Assessment

## Summary
- Total risks: 11
- High-priority (>=6): 3 (R-001 Number series concurrency, R-002 Decimal precision, R-003 Audit log immutability)
- Medium (3-4): 5 (R-004 through R-008)
- Low (1-2): 3 (R-009 through R-011)
- Categories: DATA (4), TECH (3), SEC (1), OPS (1), PERF (1), BUS (0)

# Step 4: Coverage Plan

## Summary
- P0: 12 tests (~12-20 hours) — data integrity and foundation blockers
- P1: 18 tests (~10-18 hours) — model correctness and constraints
- P2: 14 tests (~4-8 hours) — edge cases and defaults
- P3: 4 tests (~1-2 hours) — benchmarks and simple CRUD
- Total: 48 tests, ~27-48 hours (~3.5-6 days)

## Test Levels
- Unit: 7 tests (schema introspection, pure function tests)
- Integration: 41 tests (Prisma + real PostgreSQL)
- E2E: 0 tests (no browser UI in E1)

# Step 5: Output Generation

## Output File
- `_bmad-output/test-artifacts/test-design-epic-E1.md`

## Validation
- All checklist criteria verified
- No CLI sessions to clean up (no browser exploration for E1)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-18

---

# Test Design Progress — Epic E2

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E2 epic-level test design
- **Prerequisites**: E2 epic documentation available with 6 stories and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E2 (6 stories: E2.S1-E2.S6)
  - Architecture: core-architectural-decisions.md, implementation-patterns-consistency-rules.md, project-structure-boundaries.md
  - PRD: functional-requirements.md (FR80-84, FR172, FR174-177), non-functional-requirements.md (NFR2, NFR10-16, NFR45)
  - API Contracts: overview, endpoint summary, detailed specifications
  - Business Rules: IMP-007, IMP-008, IMP-009, BR-PLT-018 through BR-PLT-021
  - Event Catalog: user.login, settings.updated events
  - Project Context: Multi-company architecture, RBAC resolution
  - Existing code: resolveUserRole (packages/db/src/utils/rbac.ts), getVisibleCompanyIds (packages/db/src/utils/sharing.ts)
  - Prisma schema: User, UserCompanyRole, CompanyProfile, RefreshToken models
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: No project-level test files found; E1 test design available as reference

## Step 3: Risk Assessment
- 12 risks identified
- 5 high-priority (>=6): JWT bypass, RBAC flaw, refresh token replay, MFA bypass, company context missing
- 3 medium (3-4): account lockout bypass, Argon2 performance, Zod schema mismatch
- 4 low (1-2): tenant routing, info leakage, CORS, health endpoint

## Step 4: Coverage Plan
- 46 total test scenarios
- P0: 16 (auth flows, RBAC boundaries, company isolation)
- P1: 16 (standard CRUD, middleware, utilities)
- P2: 10 (edge cases, logging, config)
- P3: 4 (benchmarks, OpenAPI)

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E2.md`
- Validated against checklist
- No CLI sessions to clean up (no browser exploration for E2)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-18

---

# Test Design Progress — Epic E2b

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E2b epic-level test design
- **Prerequisites**: E2b epic documentation available in epic-overview.md (E2b section) and epic-e2 (follow-on section)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E2b scope (6 stories: E2b.1-E2b.6)
  - Architecture: core-architectural-decisions.md
  - PRD: FR81, FR175-FR177, FR227-FR233
  - API Contracts: 13 E2b endpoints
  - Business Rules: BR-RBAC-001 through BR-RBAC-008, IMP-007
  - Event Catalog: 6 new events (access_group.*, user_access_group.*)
  - Data Models: Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup
  - Prior E2 test design: 46 tests as baseline
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- 12 risks identified
- 5 high-priority (>=6): Permission guard bypass, most-permissive-wins logic, cache stale data, field visibility leak, cross-company leakage
- 5 medium (3-4): SUPER_ADMIN bypass failure, default data seeding, non-ADMIN management, export/import corruption, module derivation
- 2 low (1-2): System group deletion, permission resolution latency

## Step 4: Coverage Plan
- 36 total test scenarios
- P0: 12, P1: 12, P2: 8, P3: 4

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E2b.md`
- Validated against checklist

## Completion
- Workflow complete: 2026-02-20

---

# Test Design Progress — Epic E3

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E3 epic-level test design
- **Prerequisites**: E3 epic documentation available with 3 stories (E3.1, E3.2, E3.3) and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E3 (3 stories: E3.1 Event Bus Infrastructure, E3.2 Audit Trail Service, E3.3 Event Persistence & Dead Letter)
  - Architecture: core-architectural-decisions.md (sections 2.6 Immutable Audit Trail, 4.2 Event Architecture)
  - PRD: FR85 (audit log viewing), FR92 (immutable audit), NFR9, NFR14, NFR22, NFR39, NFR40
  - API Contracts: GET /system/audit-log, GET /system/audit-log/:entityType/:entityId
  - Business Rules: IMP-003 (immutable audit, 6-year retention), BR-SYS-013/014 (polymorphic entity pattern)
  - Event Catalog: 113+ events, naming conventions, cross-module rules
  - Data Models: AuditLog model fields
  - Existing code: event-emitter.ts (singleton placeholder for E3 event bus)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: 37 test files found; permission-cache-listeners.test.ts shows event emission patterns; Vitest v4.0.18 configured

## Step 3: Risk Assessment
- 10 risks identified
- 4 high-priority (>=6): Error isolation (R-001), audit data completeness (R-003), dead-letter data loss (R-004), idempotency violation (R-009)
- 3 medium (3-4): Handler deduplication (R-005), async blocking (R-006), retry timing (R-008)
- 3 low (1-2): Immutability bypass (R-002), audit access control (R-007), Redis unavailable (R-010)

## Step 4: Coverage Plan
- 23 total test scenarios
- P0: 5 (~10-15 hours) — event emission, error isolation, audit creation, immutability, dead-letter persistence
- P1: 8 (~15-25 hours) — async execution, deduplication, audit queries, retry, re-processing, idempotency
- P2: 7 (~5-10 hours) — naming conventions, Fastify plugin, role restrictions, pagination, correlation ID
- P3: 3 (~2-4 hours) — subscriber ordering, performance benchmark, edge cases

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E3.md`
- Validated against checklist
- No CLI sessions to clean up (no browser exploration for E3)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-21

---

# Test Design Progress — Epic E4

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E4 epic-level test design
- **Prerequisites**: E4 epic documentation available with 3 stories (E4.1, E4.2, E4.3) and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E4 (3 stories: E4.1 Translation Key System, E4.2 Backend i18n, E4.3 Number/Date/Currency Formatting)
  - Architecture: core-architectural-decisions.md (State Management, API patterns, error handling)
  - PRD: FR178-FR180, NFR38, NFR41, NFR45
  - API Contracts: Error response envelope, validation error structure, data conventions
  - Data Models: Currency (minorUnit, symbol, code), CompanyProfile (defaultLanguage, baseCurrencyCode, timezone)
  - Business Rules: IMP-002 (Decimal(19,4) for monetary fields)
  - Project Context: Section 3 (i18n / Localisation Infrastructure)
  - Existing code: Error class hierarchy (AppError, ValidationError), Vitest configured, no existing i18n code (greenfield)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- 8 risks identified
- 2 high-priority (>=6): Decimal precision loss (R-001), Fallback chain incorrect (R-002)
- 4 medium (3-4): Zod mapping incomplete (R-003), ESLint false positives (R-004), minorUnit unavailable (R-005), namespace loading perf (R-006)
- 2 low (1-2): Key naming inconsistency (R-007), interpolation injection (R-008)

## Step 4: Coverage Plan
- 34 total test scenarios
- P0: 8 (~8-14 hours) — decimal precision, fallback chain, error envelope
- P1: 12 (~10-18 hours) — interpolation, Zod mapping, date/number formatting
- P2: 10 (~4-8 hours) — ESLint rules, namespace loading, backend locale, edge cases
- P3: 4 (~1-3 hours) — performance benchmark, exhaustive currency test, escaping

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E4.md`
- Validated against checklist
- No CLI sessions to clean up (no browser exploration for E4)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-22

---

# Test Design Progress — Epic E3b

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E3b epic-level test design
- **Prerequisites**: E3b epic documentation available with 5 stories (E3b.1-E3b.5) and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E3b (5 stories: E3b.1 Platform API Server, E3b.2 Tenant Management API, E3b.3 AI Gateway + Provider Adapters, E3b.4 Platform Client SDK, E3b.5 Plan & Billing Management)
  - Architecture: Section 2.31 (Platform layer, AI Gateway, SDK, ERP integration)
  - PRD: FR193-FR210, FR219-FR225; NFR46-NFR51
  - API Contracts: Section 20 (internal ERP-facing), Section 21 (admin-facing)
  - Data Models: Section 5 (Platform database — Tenant, Plan, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession)
  - Business Rules: Section 14b (BR-PLT-001 to BR-PLT-021)
  - Event Catalog: Section 19 (13 platform events)
  - State Machines: Section 20 (Tenant lifecycle, Billing enforcement, AI Quota runtime)
  - Existing tests: platform-models.test.ts (schema validation, seed data verification)
  - Schema gap identified: TenantProviderCredential model missing from Prisma schema
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- 14 risks identified
- 6 high-priority (>=6): MFA bypass (R-001 score=9 CRITICAL), service token bypass (R-002), AI usage loss (R-003), state machine bypass (R-004), entitlement latency (R-005), missing schema model (R-009)
- 6 medium (3-5): Audit immutability (R-006), circuit breaker staleness (R-007), fallback chain failure (R-008), webhook failure detection (R-010), AI Gateway overhead (R-011), billing escalation (R-012)
- 2 low (1-2): Health endpoint accuracy (R-013), webhook delivery timing (R-014)

## Step 4: Coverage Plan
- 114 total test scenarios
- P0: ~33 tests (~25-40 hours) — auth, state machine, quota enforcement, audit, performance
- P1: ~41 tests (~20-35 hours) — CRUD, webhooks, caching, SDK, provider adapters, plans, billing
- P2: ~29 tests (~10-20 hours) — edge cases, impersonation, BYOK, fallback chain, health
- P3: ~11 tests (~5-10 hours) — performance benchmarks, CSV export, user management

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E3b.md`
- Validated against checklist
- No CLI sessions to clean up (no browser exploration for E3b)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-21

---

# Test Design Progress — Epic E5

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E5 epic-level test design
- **Prerequisites**: E5 epic documentation available with 5 stories (E5.1-E5.5) and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E5 (5 stories: E5.1 AI Service Layer, E5.2 AI Chat Session Management, E5.3 AI Action Framework, E5.4 AI Predictions, E5.5 Daily Briefing & Smart Suggestions)
  - Architecture: core-architectural-decisions.md (Section 6 — AI Infrastructure & Orchestration, 7 subsystems)
  - PRD: FR1-FR10, FR153-FR156; NFR1, NFR16, NFR21, NFR47
  - API Contracts: WS /ai/chat, POST /ai/chat/message, GET /ai/chat/history, POST /ai/chat/sessions, POST /ai/predict/cash-flow, POST /ai/detect/anomalies, POST /ai/detect/duplicates, GET /ai/confidence, POST /ai/explain, GET /ai/briefing, POST /ai/suggestions
  - Business Rules: IMP-005 (AI never auto-executes), IMP-006 (AI degradation safe), BR-COM-013
  - Event Catalog: Section 17 (ai.action.executed, ai.degraded events)
  - Data Models: AiModel, AiPrompt, AiPromptVersion, AiAgent, AiConversation, AiMessage (defined in Architecture §6)
  - Dependencies: E3b (Platform API + AI Gateway), E4 (i18n)
  - Existing code: No AI code exists yet (apps/api/src/ai/ directory not created)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- 9 risks identified
- 1 critical (score 9): R-001 — AI guardrails bypass for financial transactions (SEC)
- 4 high (score 6): R-002 (TECH — AI Gateway integration failure), R-003 (PERF — response time SLA), R-004 (DATA — conversation context integrity), R-005 (SEC — WebSocket auth bypass)
- 3 medium (score 4): R-006 (TECH — response parser), R-007 (BUS — prediction accuracy), R-009 (TECH — streaming delivery)
- 1 low (score 2): R-008 (OPS — briefing job reliability)

## Step 4: Coverage Plan
- P0: 4 scenarios (~14 tests, ~8-12 hours) — guardrails, WS auth, degradation, quota
- P1: 14 scenarios (~45 tests, ~25-40 hours) — core AI service layer, chat management, action framework, predictions, briefing
- P2: 7 scenarios (~18 tests, ~8-15 hours) — duplicate detection, confidence retrieval, explain, suggestions, role variations
- P3: 3 scenarios (~6 tests, ~2-4 hours) — preview data, BullMQ scheduling, token limit edge cases
- Total: ~83 tests, ~43-71 hours (~1-2 weeks)

## Step 5: Output Generated
- Output file: `_bmad-output/test-artifacts/test-design-epic-E5.md`
- Validated against checklist
- No CLI sessions to clean up (no browser exploration for E5)
- All artifacts stored in test-artifacts/

## Completion
- Workflow complete: 2026-02-22

---

# Test Design Progress — Epic E6

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User specified Epic E6 with 12 stories and acceptance criteria
- **Epic**: E6 — Web Frontend Shell + Mobile Scaffold

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**: PRD (FRs: FR81, FR175-FR177, FR227-FR233; NFRs: NFR27-30, NFR41), Architecture (Section 5 Frontend), UX Design Spec (T1-T8 Templates, ActionBar System, Co-Pilot Dock, Responsive Design), API Contracts (System Module RBAC endpoints), Data Models (Resource, AccessGroup, Permissions), State Machine Reference (common patterns), Event Catalog (permission cache events), Business Rules Compendium (BR-RBAC-001 through BR-RBAC-008, BR-COM-013)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing test coverage**: Solid backend tests (40+ across packages/db, ai-gateway, platform-api); Playwright E2E for epics E2b-E5; No existing frontend web or mobile tests

## Step 3: Risk Assessment
- **Total risks**: 14
- **High-priority (>=6)**: 4 — R-001 (SEC: permission bypass), R-002 (TECH: stale permissions), R-003 (BUS: ActionBar misconfiguration), R-004 (TECH: WebSocket reliability)
- **Medium (3-4)**: 7
- **Low (1-2)**: 3
- **Critical findings**: Permission enforcement is defense-in-depth (client-side guards + backend guards); ActionBar action-config.ts is central to correct state-driven UX; Co-Pilot WebSocket streaming needs deterministic mocking

## Step 4: Coverage Plan
- **P0**: ~18 tests (~25-40 hours) — auth, permissions, ActionBar, Co-Pilot guardrails
- **P1**: ~32 tests (~30-50 hours) — component templates, RBAC admin pages, responsive
- **P2**: ~24 tests (~12-24 hours) — remaining templates, accessibility, mobile
- **P3**: ~8 tests (~2-5 hours) — exploratory, cross-browser, stress
- **Execution**: All functional tests on every PR (<15 min); mobile/perf on nightly/weekly
- **Quality gates**: P0=100%, P1>=95%, SEC tests 100%

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E6.md`
- **Validated against checklist**: All criteria passed

## Completion
- Workflow complete: 2026-02-23

---

# Test Design Progress — Epic E7

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E7 epic-level test design
- **Epic**: E7 — Saved Views / Filters / Columns
- **Prerequisites**: E7 epic documentation available with 3 stories (E7.1, E7.2, E7.3) and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E7 (3 stories: E7.1 Database Schema & API Foundation, E7.2 Column Customization & Views UI, E7.3 Filter Builder & Favourites)
  - Architecture: §2.9 Saved Views/Filters/Columns (SavedView model, filter-to-Prisma converter, entity metadata, API endpoints, frontend component structure)
  - PRD: FR86 (saved views); NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)
  - API Contracts: §3.13 (GET /views/init, POST /views/saved, POST /views/lov/batch, PATCH /views/columns/:viewKey/:fieldId/width, PUT /views/columns/:viewKey, POST /views/saved/:id/toggle-favourite, POST /views/saved/:id/set-default)
  - Data Models: §3.1 System Module (6 tables: DataView, DataViewField, DateRangePreset, UserColumnPreference, SavedView, SavedViewCondition)
  - UX Design Spec: T1 Entity List Template (Views & Columns button, Filter & Sort button, column drag-resize, saved view selector, header favourites)
  - Project Context: §12 AI-First Integration (5 AI tools), §13 Metadata-Driven DataTable (3-tier LOV strategy, bundled init)
  - Event Catalog: No view-related events
  - Business Rules: No view-specific business rules
  - State Machine Reference: No state machines for views
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: 40+ backend test files (E1-E6); Playwright E2E tests for E2b-E6; no E7-specific tests yet

## Step 3: Risk Assessment
- **Total risks**: 11
- **High-priority (>=6)**: 3 — R-001 (DATA: filter-to-Prisma incorrect WHERE), R-002 (SEC: scope visibility bypass), R-003 (PERF: init endpoint >100ms)
- **Medium (3-4)**: 4 — R-004 (TECH: LOV batch stale data), R-005 (DATA: column width race conditions), R-006 (TECH: group bracketing incorrect), R-007 (BUS: default view resolution order)
- **Low (1-2)**: 4 — R-008 (TECH: date preset timezone), R-009 (BUS: favourites stale cache), R-010 (TECH: column resize persistence), R-011 (OPS: Redis TTL invalidation)

## Step 4: Coverage Plan
- **P0**: ~24 tests (~12-20 hours) — filter-to-Prisma all operators, scope visibility, init endpoint performance
- **P1**: ~36 tests (~15-25 hours) — saved view CRUD, LOV batch, column persistence, default resolution, modals, pinning
- **P2**: ~19 tests (~5-10 hours) — advanced filter UI, favourites dropdown, sort config, save-as-new, date filter, seed validation
- **P3**: ~5 tests (~2-4 hours) — performance benchmarks, Redis TTL, WCAG AA, cross-browser exploratory
- **Total**: ~84 tests, ~34-59 hours (~1-1.5 weeks)
- **Test levels**: Unit (filter-builder, date presets), Integration (API endpoints, scope, CRUD), E2E (modals, views, filters)

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E7.md`
- **Validated against checklist**: All criteria passed
- **No CLI sessions to clean up** (no browser exploration for E7)
- **All artifacts stored in test-artifacts/**

## Completion
- Workflow complete: 2026-02-27

---

# Test Design Progress — Epic E5b

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E5b epic-level test design; sprint-status.yaml exists
- **Epic**: E5b — AI Co-Pilot Intelligence — Memory, Skills & Dynamic Context

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**:
  - Epic E5b (7 stories, 5 pillars: Memory System, Skills Registry, Tool Framework, Inline Entity Mentions, Dynamic Context Assembly)
  - Architecture: §5.4 (Dual Interface), §6.1-6.10 (AI Infrastructure — Model Registry, Prompt Manager, Agent Registry, Skill Registry, Context Engine, Guardrails)
  - PRD FRs: FR1-FR10, FR153-156, FR205-226
  - PRD NFRs: NFR1, NFR2, NFR16, NFR21, NFR27, NFR28, NFR30, NFR47
  - Data Models: §3.20 (AI Infrastructure — 7 new tables + 1 enhanced)
  - API Contracts: §3.6 (12 existing + 14 new E5b endpoints)
  - Prior test design: test-design-epic-E5.md (9 risks, 28 scenarios)
  - Project Context: §12 (AI-First Integration), §14-15 (Progressive Disclosure)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: 191 unit/integration files, 109 E2E specs, 21 AI-specific test files from E5

## Step 3: Risk Assessment
- **Total risks**: 12
- **High-priority (>=6)**: 5 — R-001 (DATA: hybrid search returns irrelevant memories, score=9), R-002 (SEC: memory isolation failure, score=6), R-003 (TECH: L0→L1→L2 routing failure, score=6), R-004 (DATA: pre-compaction flush loses info, score=6), R-005 (PERF: context assembly exceeds token budget, score=6)
- **Medium (3-4)**: 5 — R-006 (TECH: tool registration), R-007 (DATA: importance scoring), R-008 (BUS: entity mention), R-009 (TECH: skill override), R-010 (TECH: pgvector migration)
- **Low (1-2)**: 2 — R-011 (OPS: memory settings desync), R-012 (BUS: skills browser RBAC)

## Step 4: Coverage Plan
- **P0**: 18 tests (~25-40 hours) — memory isolation, hybrid search, skill routing, pre-compaction flush, context budget, entity search
- **P1**: 28 tests (~30-50 hours) — CRUD validation, overrides, implicit learning, E7 skill pack validation, UI pages
- **P2**: 15 tests (~10-20 hours) — edge cases, accessibility, settings, UI polish
- **P3**: 6 tests (~3-6 hours) — exploratory, benchmarks, sensitivity tests
- **Total**: 67 tests, ~68-116 hours (~2-3 weeks)
- **Execution**: All tests on every PR (<15 min); performance benchmarks nightly; large corpus weekly

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E5b.md`
- **Validated against checklist**: All criteria passed
- **No CLI sessions to clean up** (no browser exploration for E5b)
- **All artifacts stored in test-artifacts/**

## Completion
- Workflow complete: 2026-03-01

---

# Test Design Progress — Epic E8

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E8 epic-level test design; sprint-status.yaml exists
- **Epic**: E8 — Attachments + Notes + Record Links

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**:
  - Epic E8 (4 stories: E8.1 Attachment Service, E8.2 Notes Service, E8.3 Record Links Service, E8.4 Cross-cutting UI Components)
  - Architecture: §2.7 (S3/MinIO for file storage), §2.20 (cross-cutting note/link systems)
  - PRD FRs: FR85 (attachments), FR87 (record links)
  - PRD NFRs: NFR2 (CRUD <500ms), NFR27, NFR28
  - API Contracts: §2.5 (Cross-cutting Infrastructure — presign, confirm, download, delete, notes CRUD, record-links CRUD)
  - Data Models: §3.9 (Attachment, Note, RecordLink, NoteType enum, RecordLinkType enum)
  - Business Rules: BR-SYS-006 to BR-SYS-010 (attachments), BR-SYS-013/BR-SYS-014 (polymorphic entity validation)
  - Event Catalog: §15 (system-generated links via event handlers)
  - UX Design Spec: ActionBar system (attachments/links as persistent tools with count badges)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: No E8-specific tests; 191+ unit/integration, 109+ E2E specs from prior epics

## Step 3: Risk Assessment
- **Total risks**: 9
- **High-priority (>=6)**: 3 — R-001 (SEC: presigned URL leakage, score=6), R-002 (SEC: executable file bypass, score=6), R-003 (DATA: orphaned S3 objects, score=6)
- **Medium (3-4)**: 4 — R-004 (DATA: polymorphic validation gap), R-005 (TECH: bidirectional link query perf), R-006 (BUS: SYSTEM note type enforcement), R-007 (TECH: presigned URL expiry race)
- **Low (1-2)**: 2 — R-008 (OPS: MinIO/S3 config mismatch), R-009 (BUS: link type extensibility)

## Step 4: Coverage Plan
- **P0**: 12 tests (~15-25 hours) — presigned URL security, MIME validation, entity validation, data integrity
- **P1**: 18 tests (~15-25 hours) — CRUD operations, multi-tenant scoping, E2E panel interactions
- **P2**: 10 tests (~5-10 hours) — edge cases, validation boundaries
- **P3**: 4 tests (~1-3 hours) — performance benchmarks
- **Total**: 44 tests, ~36-63 hours (~1-2 weeks)
- **Test levels**: Unit (MIME validation, direction logic), API (CRUD, security, entity validation), E2E (panels, drag-drop, ActionBar)
- **Execution**: All tests on every PR (<12 min); performance benchmarks nightly

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E8.md`
- **Validated against checklist**: All criteria passed
- **No CLI sessions to clean up** (no browser exploration for E8)
- **All artifacts stored in test-artifacts/**

## Completion
- Workflow complete: 2026-03-03

---

# Test Design Progress — Epic E5d

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E5d epic-level test design; sprint-status.yaml exists
- **Epic**: E5d — AI Knowledge Evolution & Cross-Tenant Intelligence (6 stories: E5d.1-E5d.6)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**: Epic E5d (6 stories), Architecture §6, PRD FR4/FR6/NFR2/NFR27/NFR50, Dependencies E5/E5b/E5c/E3b, 5 tenant + 5 platform tables, 60+ AI test files from prior epics, 985 total test files
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- **Total risks**: 15
- **High-priority (>=6)**: 7 — R-001 (SEC: PII leakage incl. dictionary keys, score=9 CRITICAL), R-002 (SEC: isolation, score=6), R-003 (DATA: RAG irrelevance, score=6), R-004 (DATA: correction loop, score=6), R-005 (DATA: anonymisation balance, score=6), R-013 (DATA: aggregation upsert not idempotent, score=6), R-014 (TECH: chunkAndEmbed race condition, score=6)
- **Medium (3-5)**: 5 (R-006 through R-009, R-015), **Low (1-3)**: 3 (R-010 through R-012)
- **Code review findings incorporated**: PII leaks through JSON keys, non-idempotent upserts, race condition in chunk replacement, timezone sensitivity, no concurrency protection

## Step 4: Coverage Plan
- **P0**: 13 tests (~28-45 hours), **P1**: 15 tests (~25-45 hours), **P2**: 11 tests (~8-16 hours), **P3**: 5 tests (~3-6 hours)
- **Total**: 44 tests, ~64-112 hours (~1.5-3 weeks)
- **New P0 tests added**: Aggregation idempotency (R-013), content update atomicity (R-014), PII in dictionary keys (R-001)

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E5d.md`
- **Validated against checklist**: All criteria passed
- **Updated with code review findings**: 3 new risks, 3 new P0 test scenarios

## Completion
- Workflow complete: 2026-03-04 (updated with code review findings)

---

# Test Design Progress — Epic E9

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E9 epic-level test design; sprint-status.yaml exists
- **Epic**: E9 — Notifications (4 stories: E9.1-E9.4)
- **Prerequisites**: E9 epic documentation available with 4 stories and detailed acceptance criteria

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**:
  - Epic E9 (4 stories: E9.1 Notification Service, E9.2 In-App Notifications, E9.3 Email Channel, E9.4 Notification Preferences)
  - PRD: FR184 (multi-channel delivery), FR185 (per-channel preferences), FR186 (notification centre)
  - PRD NFRs: NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR31 (retry with exponential backoff)
  - Data Models: §3.18 Communications Module — NotificationTemplate, NotificationPreference, Notification (channel, priority, status enums)
  - State Machines: §17.2 Notification Status (PENDING → DELIVERED → READ → DISMISSED / FAILED)
  - Event Catalog: §14 — notification.sent, template-based subscription to ALL business events
  - Business Rules: BR-COM-014 (preference cascade from template defaults), BR-COM-015 (S3 presign for attachments)
  - API Contracts: §2.25 Communications (GET /notifications, PATCH /notifications/:id/read, POST /notifications/:id/dismiss, GET/PUT /notifications/preferences)
  - Dependencies: E3 (Event Bus), E6 (Frontend Shell), E10 (Email Integration — can be mocked)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: No E9-specific tests; Vitest configured, Playwright E2E for E2b-E8; 191+ unit/integration, 109+ E2E specs from prior epics

## Step 3: Risk Assessment
- **Total risks**: 10
- **High-priority (>=6)**: 3 — R-001 (TECH: WebSocket reliability, score=9 CRITICAL), R-002 (DATA: delivery guarantees per-channel, score=6), R-003 (TECH: event bus template matching, score=6)
- **Medium (3-4)**: 4 — R-004 (TECH: Handlebars rendering errors), R-005 (SEC: notification content leakage), R-006 (PERF: high-volume fan-out), R-007 (BUS: preference cascade complexity)
- **Low (1-2)**: 3 — R-008 (OPS: email retry exhaustion), R-009 (BUS: notification fatigue), R-010 (OPS: WebSocket scaling)

## Step 4: Coverage Plan
- **P0**: 8 tests (~16-24 hours) — notification creation from events, multi-channel dispatch, WebSocket delivery, preference cascade, email queue, state lifecycle
- **P1**: 12 tests (~12-20 hours) — target user resolution, cascade fallback, reconnection replay, mark all read, dismiss, email retry, preferences UI, CRUD endpoints
- **P2**: 8 tests (~4-8 hours) — companyId scoping, template error handling, email FAILED state, HTML template rendering, admin role defaults, pagination, batch events
- **P3**: 4 tests (~1-2 hours) — throughput benchmark, WebSocket latency, multi-tab, preference matrix performance
- **Total**: 32 tests, ~33-54 hours (~1-1.5 weeks)
- **Test levels**: Unit (template rendering, state machine, preference cascade), API (notification CRUD, delivery, WebSocket, email queue), E2E (bell/dropdown, preferences page)
- **Execution**: All functional tests on every PR (<15 min); performance benchmarks nightly

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E9.md`
- **Validated against checklist**: All criteria passed
- **No CLI sessions to clean up** (no browser exploration for E9)
- **All artifacts stored in test-artifacts/**

## Completion
- Workflow complete: 2026-03-03

---

# Test Design Progress — Epic E10

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E10 epic-level test design; sprint-status.yaml exists
- **Epic**: E10 — Email Integration (3 stories: E10.1-E10.3)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**:
  - Epic E10 (3 stories: E10.1 SMTP Outbound Service, E10.2 Email Template Management, E10.3 Document-to-Email)
  - PRD: FR187 (email sending), FR188 (document-to-email), FR189 (email templates); NFR31 (retry backoff)
  - Data Models: §3.18 Communications Module — EmailMessage, EmailRecipient, EmailQueue, EmailTemplate, EmailAlias, EmailSignature
  - State Machines: §17.1 EmailMessage Status (DRAFT → QUEUED → SENT / FAILED / BOUNCED)
  - Event Catalog: §14 — email.sent event
  - API Contracts: §2.25 Communications endpoints
  - Business Rules: BR-COM-001, 002, 003, 009, 010, 015
  - Architecture: §7 Infrastructure (BullMQ, SMTP, Nodemailer)
  - Dependencies: E3, E8, E9, E12
  - Existing code: email-sender.service.ts (8 tests), notification-email-template.ts (7 tests)
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- **Total risks**: 11
- **High-priority (>=6)**: 4 — R-001 (SEC: SMTP credential leakage), R-002 (SEC: Handlebars injection), R-003 (TECH: worker crash), R-004 (DATA: orphaned S3 objects)
- **Medium (3-4)**: 4, **Low (1-2)**: 3

## Step 4: Coverage Plan
- **P0**: 10 tests (~15-25 hours), **P1**: 16 tests (~15-25 hours), **P2**: 10 tests (~5-10 hours), **P3**: 4 tests (~1-3 hours)
- **Total**: 40 tests, ~36-63 hours (~1-2 weeks)

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E10.md`
- **Validated against checklist**: All criteria passed

## Completion (E10)
- Workflow complete: 2026-03-04

---

# Test Design Progress — Epic E11

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E11 epic-level test design; sprint-status.yaml exists
- **Epic**: E11 — Cross-cutting Tasks (3 stories: E11.1-E11.3)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Artifacts loaded**:
  - Epic E11 (3 stories: E11.1 Task Service Backend, E11.2 Task UI Frontend, E11.3 Task Notifications)
  - PRD: FR181 (task creation from records), FR182 (task assignment + notifications), FR183 (centralised task list)
  - PRD NFRs: NFR2 (CRUD <500ms p95), NFR41 (TypeScript strict)
  - Data Models: Task, TaskAssignee (polymorphic entityType/entityId pattern from project-context.md §4)
  - API Contracts: Task endpoints (gap identified — not yet in §2.5)
  - Business Rules: BR-TASK-001 to BR-TASK-009 (gap identified — to be defined)
  - Event Catalog: task.assigned, task.status_changed, task.overdue (gap identified — to be defined)
  - State Machines: TaskStatus OPEN→IN_PROGRESS→COMPLETED/CANCELLED (gap identified — not in state-machine-reference.md)
  - UX Design Spec: T1 Entity List (My Tasks), T2/T3 Detail (Task Panel), Dashboard (Tasks Today card)
  - Pre-Epic Designs: Page inventory approved, v0 prompt generated, 12 new components identified
  - Dependencies: E9 (Notifications), E3 (Event Bus), E7 (Saved Views), E8 (Record Links)
  - v0 Reference: 5 files in v0-nexa-design/components/tasks/
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing tests**: 441 total test files (231 unit, 210 E2E); no task-specific tests; 10 notification test files from E9

## Step 3: Risk Assessment
- **Total risks**: 12
- **High-priority (>=6)**: 3 — R-001 (SEC: cross-company task leakage, score=6), R-002 (DATA: terminal state bypass, score=6), R-003 (SEC: RBAC visibility gap, score=6)
- **Medium (3-5)**: 7 — R-004 through R-009, R-012
- **Low (1-2)**: 2 — R-010, R-011

## Step 4: Coverage Plan
- **P0**: 10 tests (~15-25 hours) — companyId scoping, terminal states, RBAC, CRUD, events, notifications, overdue
- **P1**: 14 tests (~15-25 hours) — multi-assignee, filtering, deletion RBAC, E2E pages, status cycling, notification dispatch
- **P2**: 8 tests (~5-10 hours) — batch actions, responsive, entity pre-fill, i18n, visual styling
- **P3**: 4 tests (~2-4 hours) — performance benchmark, visual fidelity, keyboard nav, multi-tab sync
- **Total**: 36 tests, ~37-64 hours (~1-1.5 weeks)

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E11.md`
- **Validated against checklist**: All criteria passed

## Completion (E11)
- Workflow complete: 2026-03-04

---

# Test Design Progress — Epic E13b

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E13b epic-level test design; sprint-status.yaml exists
- **Epic**: E13b — Platform Admin Portal (6 stories: E13b.1-E13b.6)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E13b (6 stories), Architecture §2.31, PRD FR193-FR226, API Contracts §21 (~45 endpoints)
  - Data Models §5 (11 tables), Business Rules §14b (21 rules), Event Catalog §19 (13 events)
  - State Machines §20 (3 state machines), UX Design Spec (Platform Admin Portal)
  - E3b test design (14 risks, 114 scenarios), 8 existing test files from E3b
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk Assessment
- **Total risks**: 12
- **High-priority (>=6)**: 5 — R-001 (SEC: impersonation bypass, score=9), R-002 (SEC: VIEWER write exposure, score=6), R-003 (SEC: MFA bypass, score=6), R-004 (DATA: archive irreversibility, score=6), R-005 (BUS: enforcement propagation hidden, score=6)
- **Medium (3-4)**: 5, **Low (1-2)**: 2

## Step 4: Coverage Plan
- **P0**: ~20 tests (~20-30 hours), **P1**: ~30 tests (~25-40 hours), **P2**: ~16 tests (~8-16 hours), **P3**: ~8 tests (~3-6 hours)
- **Total**: ~74 tests, ~56-92 hours (~1.5-2.5 weeks)

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E13b.md`
- **Validated against checklist**: All criteria passed

## Completion (E13b)
- Workflow complete: 2026-03-11

---

# Test Design Progress — Epic E12

## Step 1: Mode Detection
- **Mode**: Epic-Level (Phase 4)
- **Reason**: User explicitly requested E12 epic-level test design; sprint-status.yaml exists
- **Epic**: E12 — Document Templates & PDF (3 stories: E12.1-E12.3)

## Step 2: Context Loading
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto, test_framework=playwright
- **Documents loaded**:
  - Epic E12 (3 stories: E12.1 Template Engine, E12.2 Template Management, E12.3 Default Templates)
  - Architecture: §2.12 (Document Templates & PDF Generation — Handlebars + Puppeteer pipeline, version selection algorithm)
  - PRD: FR79 (ad-hoc reporting), FR85 (audit log viewing); NFR2 (CRUD <500ms), NFR3 (reports <5s), NFR41 (TypeScript strict)
  - API Contracts: §2.4 (CRUD /document-templates, POST /documents/generate, POST /documents/email, POST /documents/batch-generate)
  - Data Models: §3.1 (DocumentTemplate: 25+ fields incl. branding toggles, margins, page config; DocumentTemplateVersion: selection criteria, email fields, priority)
  - Business Rules: BR-COM-010 (document-to-email requires valid template, fallback to default)
  - Project Context: §7 (Printer Management — cloud PDF generation, no physical drivers)
  - Event Catalog: No E12-specific events; document.* events are for E13 Document Understanding
  - State Machines: N/A for E12
- **Knowledge fragments**: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
- **Existing code**: Handlebars engine from E10 (email-template-engine.service.ts with 25+ tests), template-renderer.ts (25+ tests), no Puppeteer yet, v0 design reference available
- **Existing tests**: 365 total test files; no E12-specific tests; 37 email/notification template test files from E10 provide patterns

## Step 3: Risk Assessment
- **Total risks**: 12
- **High-priority (>=6)**: 3 — R-001 (SEC: template injection via Puppeteer, score=6), R-002 (DATA: version selection algorithm incorrect, score=6), R-003 (PERF: Puppeteer resource exhaustion, score=6)
- **Medium (3-4)**: 5 — R-004 (DATA: formatting inconsistency), R-005 (TECH: page break handling), R-006 (BUS: default template completeness), R-007 (SEC: cross-tenant document access), R-008 (TECH: batch job partial failure)
- **Low (1-2)**: 4 — R-009 (DATA: conditional section logic), R-010 (OPS: Chrome binary mismatch), R-011 (DATA: seed idempotency), R-012 (BUS: UK payroll compliance)

## Step 4: Coverage Plan
- **P0**: ~18 tests (~15-25 hours) — template injection prevention, version selection correctness, Puppeteer resource management, document generation, batch reliability
- **P1**: ~26 tests (~20-35 hours) — template CRUD, version management, Handlebars helpers, conditional sections, line items, page config, preview, email integration
- **P2**: ~14 tests (~5-10 hours) — default seeding, HTML validation, fallback, branding, management UI, companyId scoping
- **P3**: ~6 tests (~2-4 hours) — performance benchmark, visual regression, header/footer, CSS override
- **Total**: ~64 tests, ~42-74 hours (~1-2 weeks)
- **Test levels**: Unit (scoring algorithm, Handlebars helpers, conditional logic), API (CRUD, generation, batch, security), E2E (template management UI)
- **Execution**: All functional tests on every PR (<15 min); benchmarks nightly; stress tests weekly

## Step 5: Output Generation
- **Output file**: `_bmad-output/test-artifacts/test-design-epic-E12.md`
- **Validated against checklist**: All criteria passed
- **No CLI sessions to clean up** (no browser exploration for E12)
- **All artifacts stored in test-artifacts/**

## Completion (E12)
- Workflow complete: 2026-03-11

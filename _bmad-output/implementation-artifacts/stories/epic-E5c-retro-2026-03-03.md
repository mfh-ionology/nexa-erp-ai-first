# Epic E5c Retrospective: AI Administration & Autonomous Workflows

**Date:** 2026-03-03
**Facilitator:** Bob (Scrum Master)
**Epic Status:** Complete (6/6 stories done)

---

## Epic Summary

Epic E5c added two critical layers to the AI-First ERP:

1. **Administration UI** — Full admin screens for configuring AI infrastructure (models, prompts, agents, skills, automations, variables)
2. **Autonomous Workflows** — Goal-oriented automation engine with scheduled/event/chain/manual triggers, multi-step agent execution, and monitoring

| Story | Title | Status |
|-------|-------|--------|
| E5c.1 | Automation Engine & Schema | done |
| E5c.2 | Prompt Variable Binding System | done |
| E5c.3 | AI Model & Prompt Admin UI | done |
| E5c.4 | Agent & Skill Admin UI | done |
| E5c.5 | Automation Builder UI | done |
| E5c.6 | Automation Monitoring & Run History | done |

**FRs Delivered:** FR4 (contextual AI), FR5 (autonomous AI actions)
**NFRs Targeted:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR44 (AI response <3s)

---

## Delivery Metrics

- **Stories Completed:** 6/6 (100%)
- **Tier:** 1 (Core Platform)
- **Dependencies Used:** E5 (AI Orchestration), E5b (AI Co-Pilot Intelligence), E6 (Frontend Shell)
- **New Infrastructure Created:**
  - `apps/api/src/ai/automation/` — Full automation engine (executor, scheduler, event listener, circuit breaker, variable resolver, param validator)
  - `apps/api/src/ai/admin/` — Admin CRUD services (models, prompts, agents, skills, dashboard)
  - `apps/api/src/ai/prompt-renderer.ts` — Prompt rendering pipeline
  - `apps/web/src/features/ai-admin/` — Complete AI admin frontend feature (dashboard, models, prompts, agents, skills, automations, runs)
  - 6 new Prisma tables (ai_automations, ai_automation_steps, ai_automation_runs, ai_automation_step_runs, ai_prompt_variables, ai_automation_schedules)
  - 1 Prisma migration applied

---

## Code Review Issue Summary

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E5c.1 Automation Engine & Schema | 4 | 6 | 2 | 12 |
| E5c.2 Prompt Variable Binding | 0 | 0 | 0 | 0 |
| E5c.3 AI Model & Prompt Admin UI | 3 | 5 | 3 | 11 |
| E5c.4 Agent & Skill Admin UI | 4 | 5 | 4 | 13 |
| E5c.5 Automation Builder UI | 3 | 5 | 4 | 12 |
| E5c.6 Automation Monitoring & Run History | 2 | 6 | 4 | 12 |
| **TOTAL** | **16** | **27** | **17** | **60** |

All issues documented in story files under "Code Review Notes" sections. Issues were surfaced after 3 CR iterations per story but NOT fixed before stories were marked "done."

---

## Successes

### 1. Comprehensive AI Admin Surface
E5c delivered a complete admin interface covering every AI infrastructure entity: models (3 seeded), prompts (6 seeded), agents, skills, automations, variables, and runs. Before E5c, all AI configuration required direct database access. Now admins have a self-service UI with CRUD, version management, testing tools, and monitoring dashboards.

### 2. Strong Backend Foundation (E5c-1 + E5c-2)
The automation engine is architecturally sound:
- Multi-trigger system (SCHEDULED, EVENT, CHAIN, MANUAL)
- Sequential step execution with I/O piping between steps
- Token and duration budget enforcement
- Circular chain detection with graph traversal
- Circuit breaker (3 consecutive failures → auto-pause)
- Comprehensive variable resolution system (DB_FIELD, DB_QUERY, PAGE_FIELD, SYSTEM, PREVIOUS_STEP, CONSTANT, EXPRESSION)
- Mandatory parameter validation with nested schema traversal

### 3. E5c-2 Clean Extension Pattern
E5c-2 extended the E5c-1 variable resolver without breaking changes. Added PageFieldHandler, fixed SystemHandler gaps, added DB_FIELD model allowlist for security, and wrapped everything in a higher-level PromptRenderer service. This "extend, don't rewrite" approach produced the cleanest story in the epic (zero code review issues).

### 4. Consistent Frontend Patterns
Stories E5c-3 through E5c-6 established a repeatable AI admin frontend pattern: types → hooks → list page (T1 Entity List) → detail/form page → route files → barrel exports. Each subsequent story could reference previous stories' patterns, accelerating delivery.

### 5. Rich Monitoring Infrastructure
E5c-6 delivered a step timeline UI, JSON viewer with copy-to-clipboard, automation health dashboard section with donut charts and trend charts, and circuit breaker warning banners. This gives admins full observability over autonomous AI workflows.

---

## Challenges

### 1. Code Review Issue Volume Continues (16 HIGH Issues)
60 total issues across 6 stories is comparable to E8's 63 issues across 4 stories. Despite the E8 retrospective's action item #1 ("HIGH issues must be fixed before story marked done"), E5c continued the pattern of marking stories "done" with unresolved HIGH issues. This team agreement from E8 was NOT honoured.

### 2. Automation Engine Non-Functional (E5c-1 Issue #1)
The most critical finding: the automation executor, scheduler, event listener, and circuit breaker are **never wired up** to the running application. `AutomationService` is created with `scheduler: null`, `eventListener: null`, `executor: null` in `apps/api/src/ai/index.ts`. This means:
- AC-2 (scheduled execution) is dead code
- AC-3 (event triggers) is dead code
- AC-19 (circuit breaker) is dead code
- "Run Now" returns 503

The entire automation engine backend from E5c-1 exists but cannot execute. This is functionally equivalent to the feature not being implemented.

### 3. Scope Creep in E5c-5
E5c-5 was designated as a "frontend-only" story (all backend endpoints already existed from E5c-1/E5c-2). However, the implementation included 3 new backend services, routes, and schemas — duplicating or overlapping with E5c-1's existing automation service layer. This scope creep was flagged as HIGH Issue #1 in code review.

### 4. Type Safety Erosion
Multiple stories have `as any` type assertions and weak Zod validation:
- E5c-4 #1: `where: any` in Prisma queries (agent + skill services)
- E5c-4 #4: Frontend/backend regex validation mismatch for agent names
- E5c-6 #10: `apiGet` type assertion bypasses TypeScript safety
- E5c-4 #3: Hardcoded enum values in Zod schemas don't match flexible Prisma String columns

### 5. i18n Suppression Across Entire AI Admin Module
Every frontend page in E5c-3, E5c-4, E5c-5, and E5c-6 uses file-level `/* eslint-disable i18next/no-literal-string */`. The entire AI admin section is hardcoded English, contradicting the project's i18n convention from E4. This is tracked as LOW across multiple stories but represents a systematic pattern that affects the entire feature module.

### 6. Guardrails Type Mismatch (E5c-1 Issue #4)
Seed data uses `{ rules: [{ type, description }] }` but runtime code expects `{ canWrite, blockedOperations, requiresApproval }`. Any seeded agent hitting guardrails will crash. This is a data contract inconsistency between the seed script and the autonomous agent executor.

---

## Key Insights

### 1. E8 Retrospective Action Items: 1 of 4 Applied
Checking E8's retrospective commitments against E5c execution:

| E8 Action Item | Status | Evidence |
|----------------|--------|----------|
| HIGH issues block story completion | NOT APPLIED | 16 HIGH issues across E5c stories, all marked "done" |
| Transaction wrapping as coding standard | PARTIALLY APPLIED | E5c-2 uses transactions in prompt rendering, but E5c-4 Issue #9 shows agent list/count without transaction |
| Break UI stories into ≤5 tasks | NOT APPLIED | E5c-5 had 9 tasks, E5c-6 had 10 tasks |
| Update Architecture docs for schema extensions | UNKNOWN | Not verified in this retrospective |

### 2. Backend Stories Produce Cleaner Code Than Full-Stack Stories
- E5c-1 (backend): 12 issues, well-structured architecture
- E5c-2 (backend): 0 issues, cleanest story in the epic
- E5c-3–E5c-6 (full-stack/frontend): 11-13 issues each

Backend-only stories consistently have better code quality, likely because the scope is more bounded and the testing surface is more controllable.

### 3. "Frontend-Only" Designation Misleads Scope
E5c-5 and E5c-6 were designated "frontend-only" but both introduced backend code. This designation creates false expectations about scope and review effort. Stories should be scoped by actual deliverables, not assumptions about where changes will land.

### 4. Variable Autocomplete Pattern Needs Consolidation
The `{{` variable autocomplete was implemented in E5c-3 (prompt editor), E5c-5 (automation step goals), and referenced from E5c-4. Each implementation is slightly different. A single reusable `VariableAutocompleteTextarea` component should be extracted.

### 5. Circuit Breaker Detection is Frontend Heuristic
E5c-6 detects circuit-breaker-paused automations by checking `isActive=false && schedule.isPaused=true` — a heuristic. The backend doesn't expose a `circuitBreakerTriggered` flag. This could produce false positives (manually paused automations shown as circuit-breaker warnings).

---

## Technical Debt Register

### CRITICAL (Blocks autonomous workflow functionality)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 1 | Automation engine never wired up (executor/scheduler/event listener/circuit breaker are null) | E5c-1 #1 | Entire automation feature is non-functional |
| 2 | Executor tests lack `$transaction` mock — all executor tests crash | E5c-1 #2 | No test coverage on execution engine |
| 3 | Guardrails type shape mismatch between seed data and runtime | E5c-1 #4 | Seeded agents crash on guardrail check |
| 4 | Resume action doesn't unpause the schedule | E5c-6 #2 | Admin cannot recover from circuit breaker |

### HIGH (Functional bugs and security gaps)

| # | Issue | Story | Impact |
|---|-------|-------|--------|
| 5 | Default model can be deleted, leaving system without default | E5c-3 #1 | AI routing breaks |
| 6 | `{{...}}` variable highlighting not implemented | E5c-3 #2 | AC-5 requirement gap |
| 7 | Column sorting declared but backend doesn't support sort params | E5c-3 #3 | Non-functional sorting |
| 8 | `where: any` bypasses TypeScript in agent/skill services | E5c-4 #1 | Silent bugs on field renames |
| 9 | Operator precedence bug discards null parameters in skill create | E5c-4 #2 | Data loss on skill creation |
| 10 | Hardcoded category/outputType enums reject existing skills | E5c-4 #3 | Skills uneditable via admin UI |
| 11 | Frontend/backend name regex mismatch for agents | E5c-4 #4 | Cryptic 422 errors |
| 12 | `form.setValue()` during render phase (infinite re-render risk) | E5c-5 #2 | Potential page crash |
| 13 | Route search schema missing filter params | E5c-6 #1 | Pre-filtered navigation drops filters |
| 14 | Executor test asserts wrong run creation status | E5c-1 #3 | Stale test vs implementation |
| 15 | Floating-point cost calculation for Decimal(10,4) column | E5c-1 #6 | Rounding errors in financial calculations |
| 16 | DbFieldHandler allows unrestricted Prisma model access (partially fixed in E5c-2) | E5c-1 #7 | Security: access to sensitive tables |

### MEDIUM (27 issues tracked in story files)

Key themes:
- Autocomplete positioning issues (E5c-3 #4, #6)
- JSON validation gaps in forms (E5c-3 #7)
- Inconsistent null handling in notification config (E5c-5 #6)
- Dashboard count calculation errors (E5c-5 #7, E5c-6 #5)
- Duration column doesn't update for running runs (E5c-6 #3)
- Multi-status filter is client-side only (E5c-6 #4)
- Date filter format mismatch with backend (E5c-6 #6)
- Duplicate scoring logic in trigger test service (E5c-4 #5)
- Missing `_latestVersionCreatedAt` in prompt list (E5c-3 #8)
- No graceful shutdown for automation services (E5c-1 #8)

---

## Previous Retrospective Follow-Through

### E8 Retrospective Action Items Assessment

| # | E8 Commitment | Status | Evidence in E5c |
|---|--------------|--------|-----------------|
| 1 | HIGH issues block story completion | NOT APPLIED | 16 HIGH issues, all stories marked "done" |
| 2 | Transaction wrapping as coding standard | PARTIAL | Some transactions used, but E5c-4 #9 shows inconsistency |
| 3 | Break UI stories into ≤5 tasks | NOT APPLIED | E5c-5: 9 tasks, E5c-6: 10 tasks |
| 4 | Update Architecture docs for schema extensions | NOT VERIFIED | No evidence checked |

### E8 Team Agreements Status

| Agreement | Honoured? |
|-----------|-----------|
| Transaction wrapping mandatory for multi-op functions | Partially |
| HIGH issues block story completion | No |
| UI stories ≤5 tasks | No |
| WCAG compliance verified with automated tools | No evidence of automated WCAG testing |

**Assessment:** The team has not yet internalised the E8 retrospective learnings. The same patterns (HIGH issues accumulating, large UI stories, inconsistent practices) continued through E5c.

---

## Next Epic Preview: E5d (AI Knowledge Evolution & Cross-Tenant Intelligence)

E5d is defined in sprint-status as **backlog** with 6 planned stories:
- E5d.1: Knowledge Base Schema & RAG Pipeline
- E5d.2: Correction Loop & Training Examples
- E5d.3: Cross-Tenant Intelligence Pipeline
- E5d.4: Platform Knowledge Distribution
- E5d.5: Knowledge Management UI
- E5d.6: Platform Intelligence Dashboard

**Note:** E5d does not yet have an epic definition file. E9 (Notifications) is currently in-progress.

**Dependencies on E5c:**
- E5d's knowledge management UI will follow the admin patterns established in E5c-3/4/5/6
- E5d's RAG pipeline will use the automation engine for scheduled knowledge indexing
- **CRITICAL:** The automation engine must actually be wired up (E5c-1 Issue #1) before E5d can use scheduled automations for knowledge pipelines
- E5d's knowledge base will extend the prompt variable system (new `KNOWLEDGE` source type)

**Preparation Needed:**
1. Wire up the automation engine (executor, scheduler, event listener, circuit breaker) — BLOCKS E5d automation features
2. Fix guardrails type mismatch — BLOCKS reliable agent execution
3. Define E5d epic file with detailed story specs
4. Decide: Fix E5c HIGH issues first, or carry forward as debt?

---

## Significant Discovery Alert

The automation engine from E5c-1 is **architecturally complete but not operational** (Issue #1). This means:
- No scheduled automations can run
- No event-triggered automations can fire
- No circuit breaker protection is active
- "Run Now" returns 503

This does NOT invalidate E5d's direction, but it means **E5d cannot use the automation engine until it's wired up**. A focused remediation sprint to connect the executor, scheduler, event listener, and circuit breaker to the application startup is required.

**Impact:** Medium — the automation engine design is sound, it just needs to be connected. The wiring work is estimated at 1-2 focused sessions.

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|-----------------|
| 1 | ENFORCE: HIGH code review issues must be fixed before story marked "done" | Bob (SM) | Immediately | Zero "done" stories with unresolved HIGH issues going forward |
| 2 | Decompose UI stories to ≤5 tasks per story | Bob (SM) | Before E5d | No story exceeds 5 tasks |
| 3 | Eliminate "frontend-only" / "backend-only" labels — scope by actual deliverables | Bob (SM) | Before E5d | Stories accurately describe all changes |
| 4 | Add automated WCAG testing to test pipeline (axe-core or similar) | Amelia (Dev) | Before E5d UI stories | WCAG violations caught in CI |
| 5 | Extract shared VariableAutocompleteTextarea component | Amelia (Dev) | Before E5d | Single component used by prompt editor + automation builder |

### Technical Debt Resolution (Priority Order)

| # | Action | Priority | Scope |
|---|--------|----------|-------|
| 1 | Wire up automation engine (executor, scheduler, event listener, circuit breaker) to app startup | CRITICAL | E5c-1 #1 |
| 2 | Fix guardrails type shape mismatch between seed and runtime | CRITICAL | E5c-1 #4 |
| 3 | Fix executor tests ($transaction mock + status assertion) | CRITICAL | E5c-1 #2, #3 |
| 4 | Fix resume action to unpause schedule | CRITICAL | E5c-6 #2 |
| 5 | Fix default model delete guard | HIGH | E5c-3 #1 |
| 6 | Fix hardcoded category/outputType enums | HIGH | E5c-4 #3 |
| 7 | Fix form.setValue() render-phase side effect | HIGH | E5c-5 #2 |
| 8 | Fix frontend/backend name regex mismatch | HIGH | E5c-4 #4 |
| 9 | Address remaining 12 HIGH + 27 MEDIUM issues | MEDIUM | Tracked in story files |
| 10 | Add i18n translation keys to AI admin module | LOW | Replace eslint-disable with proper keys |

### Team Agreements

- HIGH code review issues MUST be fixed before story marked "done" (REITERATED from E8 — this is now a hard gate)
- Transaction wrapping is mandatory for multi-operation service functions (REITERATED from E8)
- UI stories target ≤5 tasks per story (REITERATED from E8)
- No file-level `eslint-disable` — fix violations or create targeted per-line suppressions
- Automation engine wiring must be verified as a prerequisite before any story depends on automated execution

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | Needs work — 16 HIGH issues unresolved, executor tests crash |
| Deployment | Dev environment — not yet deployed to staging/production |
| Technical Health | Mixed — architecture is sound, but automation engine is not wired up |
| Codebase Stability | Good — no regressions in existing modules detected |
| Unresolved Blockers | 4 CRITICAL items must be resolved before E5d automation features |

---

## Next Steps

1. **Fix 4 CRITICAL technical debt items** — automation engine wiring, guardrails mismatch, executor tests, resume action
2. **Fix 12 HIGH technical debt items** — functional bugs and security gaps listed above
3. **Define E5d epic file** — full story specifications with acceptance criteria
4. **Extract shared components** — VariableAutocompleteTextarea for reuse
5. **Begin E5d planning** when critical path items are resolved
6. **Continue E9** (Notifications) — in-progress, not blocked by E5c debt

---

*Retrospective facilitated by Bob (Scrum Master). All 6 stories reviewed. 60 code review issues catalogued (16 HIGH, 27 MEDIUM, 17 LOW). 5 process improvement actions, 10 debt resolution items, and 5 team agreements established. E8 retrospective action items assessed — 1 of 4 partially applied, 3 not applied.*

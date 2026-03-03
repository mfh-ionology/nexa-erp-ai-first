# Epic E5 Retrospective — AI Orchestration

**Date:** 2026-02-23
**Facilitator:** Bob (Scrum Master)
**Epic:** E5 — AI Orchestration
**Status:** Complete (5/5 stories done)

---

## Epic Summary & Metrics

| Metric | Value |
|--------|-------|
| Total Stories | 5 |
| Completed | 5 (100%) |
| Agent Model | Claude Opus 4.6 (all stories) |
| Code Reviews | 3 iterations per story (15 total CR cycles) |
| Remaining CR Issues | 82 total (21 HIGH, 42 MEDIUM, 19 LOW) |
| Production Incidents | 0 |
| FRs Delivered | FR1-FR10, FR153-FR156 |
| NFRs Addressed | NFR1 (AI <3s), NFR16 (AI never auto-executes), NFR21 (AI degradation safe), NFR47 (AI Gateway <100ms) |

### Stories Delivered

| Story | Title | Tasks | CR Issues | Key Deliverables |
|-------|-------|-------|-----------|------------------|
| E5.1 | AI Service Layer | 9 | 33 (9H, 17M, 7L) | AiOrchestrator, PromptManager, ResponseParser, ContextEngine, 10 AI Prisma models, streaming support (Anthropic + OpenAI), Fastify plugin, AI seed data |
| E5.2 | AI Chat Session Management | 9 | 15 (3H, 9M, 3L) | Socket.io WebSocket handler with JWT auth, ChatSessionService with cursor pagination, session CRUD REST endpoints, auto-session creation, AiConversation title migration |
| E5.3 | AI Action Framework | 10 | 13 (5H, 6M, 2L) | ActionPlanner, GuardrailsService with hardcoded financial safety chain, ActionExecutor with registry pattern, audit mapping for ai.action.executed, WebSocket action confirm/reject |
| E5.4 | AI Predictions | 11 | 10 (3H, 4M, 3L) | PredictionService (cash flow forecast, anomaly detection, duplicate detection, confidence scoring, explainability), 5 HTTP endpoints, ai.predictions resource registration |
| E5.5 | Daily Briefing & Smart Suggestions | 7 | 11 (1H, 5M, 5L) | BriefingEngine with role-based templates, SuggestionsService with context/role/time-based chips, Redis caching (24h TTL), BullMQ scheduled pre-generation |

---

## Team Participants

- Bob (Scrum Master) — Facilitator
- Alice (Product Owner)
- Charlie (Senior Dev)
- Dana (QA Engineer)
- Elena (Junior Dev)
- Mohammed (Project Lead)

---

## Successes & Strengths

1. **Complete AI infrastructure delivered — all 5 stories at 100%** — E5 is the most complex epic to date (46 tasks across 5 stories), and every story was completed with all acceptance criteria met. The full AI orchestration stack is functional: from Prisma schema to WebSocket streaming to prediction endpoints.

2. **Excellent story-to-story intelligence transfer** — Each subsequent story explicitly documented what prior stories built and followed established patterns:
   - E5.2 documented exactly which E5.1 components to reuse (orchestrator, types, routes, errors)
   - E5.3 documented E5.1/E5.2 components and addressed specific CR issues from prior reviews
   - E5.4 followed PredictionService patterns from E5.3's graceful degradation approach
   - E5.5 reused PredictionService patterns (`safeModelQuery`, `processDirect`, permission guards)
   This cross-story learning significantly improved velocity in later stories.

3. **NFR16 compliance — financial safety enforced correctly** — The hardcoded `FINANCIAL_ACTION_TYPES` array in GuardrailsService ensures financial actions (create invoice, post journal, process payment, etc.) ALWAYS require user approval regardless of confidence score. This is the most critical safety guardrail in the entire AI system, and it's implemented as non-configurable, non-bypassable.

4. **Graceful degradation pattern is consistent and robust** — Every AI service (orchestrator, WebSocket handler, prediction service, briefing engine, suggestions service) follows the same degradation pattern: if AI Gateway fails, return error response, never crash, never block traditional UI. The `null` decoration pattern in Fastify (set service to null, check null in routes) provides clean degradation.

5. **Action handler registry pattern is forward-looking** — E5.3's `ActionExecutor.registerHandler()` pattern allows future business modules (E14: Finance, E17: AR, etc.) to plug in their action handlers without modifying the AI framework. Currently returns `ACTION_TYPE_NOT_IMPLEMENTED` for all types — correctly deferred until business modules exist.

6. **Dual-protocol AI access** — WebSocket (streaming, real-time chat) + HTTP fallback (non-streaming predictions, briefings) ensures AI is accessible regardless of client capabilities. The HTTP fallback from E5.1 and the Socket.io handler from E5.2 coexist cleanly.

7. **10 new Prisma models added cleanly** — AiModel, AiPrompt, AiPromptVersion, AiAgent, AiSkill, AiConversation, AiMessage, AiFeedback, AiUsage, AiEval — all with proper @@map, companyId scoping, and index naming conventions.

---

## Challenges & Growth Areas

1. **Code review issue accumulation is now systemic — 82 issues in E5** — This is a dramatic escalation from E4 (35 issues) and E3b (62 issues). The 3-iteration CR cap consistently leaves significant issues unresolved. E5's 21 HIGH issues represent real security and correctness risks:
   - **Security:** Dynamic model access without allowlist (E5.1 #1, #2), cross-company confirmation possible (E5.3 #1), TOCTOU race conditions (E5.2 #1)
   - **Correctness:** Dead code never called (E5.3 #3), streaming protocol violations (E5.3 #2, E5.1 #4), empty results masking errors (E5.4 #1, #2)
   - **Data integrity:** Missing onDelete cascades (E5.1 #16), no FK referential integrity on AiMessage.promptVersionId (E5.1 #17)

2. **Cumulative HIGH issues across E3b-E5 now total 56** — 14 from E3b + 7 from E4 + 21 from E5 + 14 carried from E3b retro = 56 unresolved HIGH issues in the codebase. This technical debt is growing faster than it's being addressed.

3. **Security-sensitive patterns in the AI layer** — Multiple security issues identified across E5 stories:
   - E5.1 #1: Dynamic `this.db[source.entityType]` allows prototype pollution (constructor, __proto__)
   - E5.1 #2: Prisma query injection via DB JSON spread (can override companyId scoping)
   - E5.2 #5: JWT token exposed in query parameters (proxy log leakage)
   - E5.2 #8: Degraded mode skips session ownership verification entirely
   - E5.3 #1: companyId not stored in ActionProposalResult (cross-company action confirmation)
   - E5.3 #5: In-memory proposal storage breaks in multi-process deployments

4. **processDirect bypass pattern creates audit gaps** — E5.4 and E5.5 use `processDirect()` which bypasses conversation and message persistence. This means prediction requests and briefing generations have no audit trail in the AiMessage table. E5.4 ISSUE #3 explicitly identifies this as violating NFR22 (full AI audit trail).

5. **Integration test false confidence** — E5.4 ISSUE #2 reveals that integration tests mock `processDirect` to throw errors that the real implementation never throws. Tests provide false confidence about quota enforcement that cannot happen in production. This pattern of mocking behaviour that doesn't match reality undermines test value.

6. **Inconsistent error handling patterns across stories:**
   - E5.1: Hard-coded English error messages (ISSUE #11) instead of i18n translation keys
   - E5.2: Routes return 200 success even when session doesn't exist (ISSUE #2)
   - E5.4: Silently swallows AI errors, returns empty results instead of 429/503 (ISSUE #1)
   - E5.5: Role resolution uses string pattern matching instead of access-group-based resolution (ISSUE #1)

7. **Schema deviations from Architecture spec not documented** — Multiple schema differences between implementation and Architecture specification were found but not synced back to the spec:
   - AiFeedback.rating is Int but Architecture says String ('positive'/'negative'/'neutral') (E5.1 #7)
   - AiConversation.companyId absent from Architecture spec (E5.1 #15)
   - AiPrompt.description is optional but Architecture requires String (E5.1 #32)
   - Seed capabilities use array format but Architecture defines object (E5.1 #31)
   These violate the CLAUDE.md Document Synchronisation Rule.

---

## Key Insights & Learnings

1. **AI infrastructure is the most complex single epic in the project** — E5 delivered 46 tasks across 5 stories, touching `apps/api/src/ai/` (22+ new files), `packages/ai-gateway/` (streaming extensions), `packages/db/` (10 new models + migration), and `packages/db/default-data/` (resource registration). The cross-cutting nature of AI — it touches auth, events, audit, RBAC, WebSocket, HTTP, Prisma, Redis, and BullMQ — makes it fundamentally more complex than prior epics.

2. **The 3-iteration CR cap needs rethinking** — With 82 issues from E5 alone, the cumulative HIGH issue count is now 56. The CR process produces excellent findings but the cap means the most complex stories (which produce the most issues) are the least likely to have them resolved. A different approach is needed — perhaps a dedicated "stabilisation sprint" between major epics.

3. **In-memory storage doesn't survive multi-instance deployments** — E5.3's ActionPlanner stores proposals in an in-memory `Map`. This works in single-instance dev but breaks in production with multiple API instances behind a load balancer. Proposals need Redis-backed storage or sticky sessions. This is a deployment architecture concern that should be addressed before going live.

4. **Business module models not yet existing creates a "future-proof" implementation pattern** — E5.4 and E5.5 use `safeModelQuery()` to gracefully handle missing Prisma models (Customer, Supplier, Invoice tables won't exist until E14+). This pattern works but means predictions and briefings will be empty/limited until business modules are built. The system is technically functional but practically limited.

5. **WebSocket + Fastify coexistence requires careful architecture** — Socket.io attaches to the raw Node.js HTTP server, not Fastify's request pipeline. This means Socket.io auth middleware is completely separate from Fastify's JWT hooks. Permission checks in WebSocket must use `PermissionService` directly, not route guards. This dual-auth surface area increases security risk.

---

## Previous Retro Follow-Through (E4)

### E4 Retro Action Items Assessment:

| # | Action Item | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Triage E3b + E4 HIGH CR issues (21 total) — categorise as "fix now", "fix before E5", etc. | ❌ Not Addressed | No evidence of triage in E5 story files. E5 was built on top of unresolved E3b/E4 HIGH issues. |
| 2 | Fix E3b HIGH issues blocking E5 (memory leaks, invalidateCache, zodSerializerCompiler) | ❌ Not Addressed | E5 stories reference `packages/ai-gateway` and `packages/platform-client` without noting any prerequisite fixes. |
| 3 | Fix E4 HIGH issues blocking E5 (systemMsg namespace, Fastify 4xx translation) | ❌ Not Addressed | E5.1 Dev Notes show hardcoded English error messages (ISSUE #11), confirming the i18n fixes weren't applied. |
| 4 | Create E5 epic definition file via BMAD workflow | ✅ Completed | `epic-E5.md` exists with detailed stories, ACs, reference documents, and FR/NFR mapping. |

### E4 Team Agreements Assessment:

| Agreement | Applied in E5? | Evidence |
|-----------|---------------|----------|
| All translation keys must be reproducible | ❌ Not Applied | E5.1 uses hardcoded English error messages throughout (ISSUE #11) |
| Formatter utilities must use unified caching strategy | N/A | E5 doesn't use formatter utilities |
| Story status updates are mandatory | ✅ Applied | All E5 stories correctly show `Status: done` |
| E3b HIGH issue remediation must complete before E5 | ❌ Not Applied | 14 E3b HIGH issues remain unresolved; E5 built on top of them |
| Backend message utilities follow namespace conventions | ❌ Not Applied | AI error messages use hardcoded English, not `tServer()` |

**Critical Observation:** 3 out of 4 action items from the E4 retro were not completed. The E3b HIGH issue remediation has now been committed to in TWO consecutive retros without being done. E5 was built on top of unresolved foundations, adding 21 more HIGH issues to the pile. This is a systemic accountability gap.

---

## Recurring Code Review Patterns (E3b + E4 + E5 Combined)

| Pattern | E3b | E4 | E5 | Trend | Impact |
|---------|-----|-----|-----|-------|--------|
| HIGH issues per epic | 14 | 7 | 21 | Increasing | Security + correctness risks accumulating |
| Dynamic/unsafe code access | 2 | 0 | 4 | Increasing | Prototype pollution, query injection |
| Missing companyId scoping | 1 | 0 | 3 | Consistent | Multi-tenant data isolation risk |
| Inconsistent patterns across files | 3 | 3 | 5 | Worsening | Maintenance burden, bug surface |
| Test-production behaviour mismatch | 0 | 0 | 2 | New in E5 | False confidence from tests |
| Dead/unused code | 3 | 2 | 1 | Improving | Less dead code in E5 |
| Missing test coverage for paths | 2 | 2 | 3 | Consistent | Regressions possible |
| Schema spec drift | 0 | 0 | 5 | New in E5 | Document sync rule violations |

---

## Next Epic Preview

**Epic E6: Web Frontend Shell + Mobile Scaffold** — backlog

### Planned Stories (from sprint-status.yaml):

| Story | Title | Status |
|-------|-------|--------|
| E6.1 | React App Bootstrap | backlog |
| E6.2 | Navigation Shell | backlog |
| E6.3 | Screen Template System | backlog |
| E6.4 | ActionBar Component | backlog |
| E6.5 | Co-Pilot Dock | backlog |
| E6.6 | Mobile Scaffold | backlog |

### Dependencies on E5 Work:

- **Direct:** E6.5 (Co-Pilot Dock) directly consumes the WebSocket handler from E5.2, the chat session API from E5.2, and action confirm/reject from E5.3
- **Direct:** E6.5 will use streaming chunk events (`stream_chunk`, `stream_end`) to render AI responses token-by-token
- **Direct:** E6.5 suggestion chips consume the `POST /ai/suggestions` endpoint from E5.5
- **Direct:** E6.1 will use `@nexa/i18n` I18nProvider and React format hooks from E4
- **Indirect:** E6.5 will need to handle `action_proposal` server messages and render approval UI
- **Critical:** E5.2 ISSUE #5 (JWT in query params) affects WebSocket security for Co-Pilot

### Preparation Needed:

1. **CRITICAL: Address E5 security HIGH issues before Co-Pilot Dock** — E5.1 #1/#2 (dynamic model access + query injection), E5.2 #5 (JWT query param), E5.2 #8 (degraded mode ownership bypass), E5.3 #1 (cross-company confirmation)
2. **CRITICAL: Stabilise the in-memory proposal storage** — E5.3 #5 must be resolved before multi-instance deployment. Redis-backed proposal storage or sticky sessions needed.
3. **Fix processDirect audit gap** — E5.4 #3 and E5.5 usage of `processDirect()` bypass audit logging. NFR22 compliance needs addressing.
4. **Create E6 epic definition file** — No `epic-E6.md` exists yet.
5. **Complete Epic Page Approval Gate** — Per CLAUDE.md, page designs must be approved by Mohammed before E6 starts. E6 will create the first actual UI screens.
6. **Fix E4.1 #1 (isDev for Vite)** — E6 bootstraps Vite React app; this issue was flagged as "fix before E6" in E4 retro.
7. **Sync Architecture spec with schema deviations** — E5.1 #7, #15, #31, #32 represent undocumented changes violating the Document Sync Rule.

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|------------------|
| 1 | Conduct HIGH issue remediation sprint — address all 56 accumulated HIGH issues (14 E3b + 7 E4 + 21 E5 + 14 carried) with "fix now", "fix before E6", or "accept with documented justification" | Charlie + Mohammed | Before E6 sprint planning | All 56 HIGH issues triaged with documented disposition; critical security issues fixed |
| 2 | Implement a "stabilisation sprint" pattern — after each complex epic (5+ stories), dedicate a sprint to fixing HIGH CR issues before starting the next epic | Bob | Before E6 | Process documented in BMAD workflow; stabilisation sprint scheduled after E5 |
| 3 | Sync Architecture specification with E5 schema deviations (AiFeedback.rating, AiConversation.companyId, AiPrompt.description, seed capabilities format) | Paige (Tech Writer) | Before E6 | Architecture §6 matches actual Prisma schema; Document Sync Rule satisfied |
| 4 | Create E6 epic definition file with detailed stories via BMAD workflow | Bob + John | Before E6 sprint planning | `epic-E6.md` exists with story details, ACs, and reference documents |
| 5 | Complete Epic Page Approval Gate for E6 — present all 6 screens (app shell, nav, templates, action bar, co-pilot dock, mobile) to Mohammed | Sally (UX) + Mohammed | Before E6 starts | All E6 page designs approved by Mohammed |

### Technical Debt (Security-Critical)

| # | Item | Source | Priority | Impact |
|---|------|--------|----------|--------|
| 1 | Add entity type allowlist to PromptManager dynamic model access | E5.1 #1 | **CRITICAL** | Prototype pollution risk |
| 2 | Sanitise QueryParamSource.where before Prisma query spread | E5.1 #2 | **CRITICAL** | Cross-tenant data access via Prisma operator injection |
| 3 | Store companyId in ActionProposalResult for cross-company validation | E5.3 #1 | **CRITICAL** | Cross-company action confirmation |
| 4 | Move proposal storage from in-memory Map to Redis | E5.3 #5 | **HIGH** | Multi-instance deployment failure |
| 5 | Add session ownership check in WebSocket degraded mode | E5.2 #8 | **HIGH** | Cross-user message processing |
| 6 | Deprecate JWT in query params, enforce auth object only | E5.2 #5 | **HIGH** | Token exposure in proxy logs |
| 7 | Fix endSession TOCTOU race — use updateMany with full scoping | E5.2 #1 | **HIGH** | Data integrity race condition |

### Technical Debt (Correctness)

| # | Item | Source | Priority | Impact |
|---|------|--------|----------|--------|
| 8 | Fix PredictionService to check aiResponse.type before JSON.parse | E5.4 #1 | HIGH | Silent empty results instead of proper 429/503 |
| 9 | Fix integration tests to match real processDirect behaviour | E5.4 #2 | HIGH | False test confidence |
| 10 | Add audit trail for processDirect prediction/briefing requests | E5.4 #3 | HIGH | NFR22 violation — no AI audit for predictions |
| 11 | Remove dead code: extractActionProposal never called | E5.3 #3 | MEDIUM | Dead code in production |
| 12 | Fix streaming protocol: action_proposal after done chunk | E5.3 #2 | MEDIUM | Protocol violation |
| 13 | Add onDelete CASCADE to AiMessage → AiConversation | E5.1 #16 | MEDIUM | Conversation cleanup impossible |
| 14 | Add FK relation for AiMessage.promptVersionId | E5.1 #17 | MEDIUM | No referential integrity |
| 15 | Add @default(0) to AiUsage aggregate fields | E5.1 #8 | MEDIUM | NOT NULL violations on upsert |
| 16 | Fix ContextEngine shallow merge losing sibling fields | E5.1 #9 | MEDIUM | Preferences data loss |
| 17 | Fix BriefingEngine role resolution to use access-group-based approach | E5.5 #1 | HIGH | Incorrect role determination |
| 18 | Add streaming resource cleanup (try/finally) for unclosed AsyncIterators | E5.1 #6 | HIGH | HTTP connection leaks |

### Team Agreements

- **Security HIGH issues are blockers for next epic** — No epic starts while CRITICAL security issues exist in consumed packages. E5.1 #1, #2, E5.2 #5, #8, and E5.3 #1 must be fixed before E6 touches the AI layer.
- **Action items from retros must be tracked in sprint-status.yaml** — Three consecutive retros have committed to fixing E3b HIGH issues. Add a `remediation-sprint` entry to sprint-status to make this visible.
- **processDirect must log to audit** — Any `processDirect()` call that bypasses conversation persistence must still emit a lightweight audit event. NFR22 requires full AI audit trail.
- **Schema changes must be synced back to Architecture spec** — Any Prisma schema deviation from Architecture must be reflected in the spec within the same story. Not "later".
- **Integration tests must match real production behaviour** — Mocks must simulate what the code actually does, not what we wish it did. If `processDirect` never throws, tests must not mock it to throw.
- **E4 retro action items carry forward with elevated priority** — Items 1-3 from E4 retro (HIGH issue triage, E3b fixes, E4 fixes) are now on their 3rd retro commitment. These are now pre-requisites for E6.

---

## Significant Discoveries

### DISCOVERY 1: Cumulative HIGH Issue Count is Unsustainable

The project has accumulated **56 unresolved HIGH code review issues** across E3b, E4, and E5. Of these, at least 7 are security-critical (prototype pollution, query injection, cross-tenant data access, token exposure). Building E6 (the first user-facing frontend) on top of these unresolved issues creates significant risk.

**Impact on E6:** E6.5 (Co-Pilot Dock) directly consumes E5.2 WebSocket handler and E5.3 action framework. If the security HIGH issues in these components are not fixed, the Co-Pilot Dock will inherit those vulnerabilities in a user-facing context.

**Recommended Action:** Dedicate a stabilisation sprint between E5 and E6 to address critical HIGH issues. This is not optional — it's a prerequisite for responsible frontend development.

### DISCOVERY 2: In-Memory Proposal Storage is a Deployment Architecture Issue

E5.3's ActionPlanner uses an in-memory `Map` for staging action proposals. This works in single-instance development but fails in any production scenario with multiple API instances. When a user confirms an action, the confirmation may hit a different instance than the one that created the proposal.

**Impact on E6:** The Co-Pilot Dock will be the primary consumer of action proposals. Users will see action cards and click "Confirm" — if the proposal is on a different instance, they get `ACTION_NOT_FOUND`.

**Recommended Action:** Migrate proposal storage to Redis before E6.5 (Co-Pilot Dock) is implemented.

---

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | ⚠️ Tests pass but false confidence exists (E5.4 #2) | Integration tests don't match production behaviour |
| Deployment | N/A | No deployment yet — still in development |
| Stakeholder Acceptance | Pending | Mohammed to review E5 deliverables |
| Technical Health | ⚠️ 21 HIGH issues | Security-critical issues need attention before E6 |
| Unresolved Blockers | 7 CRITICAL/HIGH security items | Must resolve before E6 touches AI layer |

---

## Commitments Summary

- Action Items: 5 (process improvements)
- Security-Critical Debt Items: 7
- Correctness Debt Items: 11
- Team Agreements: 6
- Critical Path Items: 3 (HIGH issue remediation, Architecture sync, E6 page approval gate)

---

## Next Steps

1. **Conduct stabilisation sprint** — Fix CRITICAL security issues (#1-3) and HIGH deployment issues (#4-6)
2. **Triage remaining HIGH issues** — Document "fix now" vs "accept with justification" for all 56 accumulated HIGHs
3. **Sync Architecture spec** — Update §6 AI Infrastructure to match actual E5 implementation
4. **Create E6 epic definition** via BMAD workflow (SM + PM agents)
5. **Complete E6 Epic Page Approval Gate** — UX designs for all 6 screens must be approved by Mohammed
6. **Begin E6 sprint planning** when stabilisation complete and page designs approved

---

Bob (Scrum Master): "Great session today, Mohammed. E5 was our most ambitious epic — 46 tasks, 5 stories, the complete AI orchestration stack. 100% delivery."

Alice (Product Owner): "The AI infrastructure is impressive — from chat streaming to predictions to daily briefings. But those 21 HIGH issues concern me."

Charlie (Senior Dev): "We need that stabilisation sprint. Building the frontend on top of security issues in the AI layer is not something I'm comfortable with."

Dana (QA Engineer): "The test-production mismatch in E5.4 really bothers me. We need to fix that pattern — tests should catch bugs, not hide them."

Elena (Junior Dev): "The story intelligence transfer was incredible this epic. Each story building on the last made later stories much smoother."

Bob (Scrum Master): "Agreed on all points. The stabilisation sprint is non-negotiable — we've committed to HIGH issue remediation in three consecutive retros. It's time to actually do it. See you all at the stabilisation sprint planning!"

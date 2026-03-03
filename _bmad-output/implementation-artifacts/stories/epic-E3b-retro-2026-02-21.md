# Epic E3b Retrospective — Platform API + AI Gateway

**Date:** 2026-02-21
**Facilitator:** Bob (Scrum Master)
**Epic:** E3b — Platform API + AI Gateway
**Status:** Complete (5/5 stories done)

---

## Epic Summary & Metrics

| Metric | Value |
|--------|-------|
| Total Stories | 5 |
| Completed | 5 (100%) |
| Agent Model | Claude Opus 4.6 (all stories) |
| Code Reviews | 3 iterations per story |
| Remaining CR Issues | 62 (14 HIGH, 37 MEDIUM, 11 LOW) |
| Production Incidents | 0 |

### Stories Delivered

| Story | Title | Tasks | CR Issues |
|-------|-------|-------|-----------|
| E3b.1 | Platform API Server | 7 | 12 (2H, 7M, 3L) |
| E3b.2 | Tenant Management API | 7 | 11 (2H, 6M, 3L) |
| E3b.3 | AI Gateway Service + Provider Adapters | 10 | 13 (3H, 7M, 3L) |
| E3b.4 | Platform Client SDK | 7 | 14 (4H, 10M, 0L) |
| E3b.5 | Plan & Billing Management | 6 | 12 (3H, 7M, 2L) |

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

1. **Clean architectural separation** — Platform API (port 3001, separate DB, separate auth) vs ERP API (port 3000). Design decision in E3b.1 set the entire epic up for success.

2. **AI Gateway provider adapter interface** — `LLMProvider` interface is a stable contract. Adding new providers (Google, Mistral) is a single-file operation. Well-designed extensibility.

3. **Consistent test patterns** — `fastify.inject()` pattern established in E3b.1 was reused consistently across all 5 stories. Strong test coverage throughout.

4. **Circuit breaker + fail-open design** — Resilient architecture ensures ERP never crashes due to Platform API outages (BR-PLT-020).

5. **Webhook-driven cache invalidation** — Clean async communication between Platform (E3b.2 sends) and ERP (E3b.4 receives). Separation of concerns.

6. **Pattern reuse** — Circuit breaker deliberately copied from E3b.3 to E3b.4 with documented rationale. Accelerated later story development.

7. **100% story completion** — All 5 stories delivered with all acceptance criteria met.

---

## Challenges & Growth Areas

1. **Code review issue accumulation** — 62 issues remain after 3 CR iterations per story. 14 are HIGH severity. The 3-iteration cap is insufficient for complex infrastructure stories.

2. **Memory leak patterns** (3 stories affected):
   - E3b.3: Unbounded adapter client cache (`Map<string, SDK>`)
   - E3b.4: Unbounded `pendingInvalidationPromises` array
   - Pattern: No max-size or eviction policies on data structures

3. **Race conditions** (2 stories affected):
   - E3b.2: PATCH uses `findUnique` without `FOR UPDATE`
   - E3b.5: Plan PATCH has TOCTOU race, GET quota not in transaction

4. **Type safety gaps** (3 stories affected):
   - E3b.1: Role guard accepts `string[]` instead of Prisma enum
   - E3b.3: Dead cache key variable
   - E3b.5: Unsafe `as string[]` cast, inconsistent string/enum usage

5. **Inconsistent audit logging** — Three different patterns across stories:
   - E3b.1: Login audit NOT in try/catch (violation)
   - E3b.2: Double-wrapped try/catch (dead code)
   - E3b.5: Consistent pattern (correct)

6. **Test scaffolding duplication** — 80-120 lines of identical mock setup duplicated across 4 Platform API test files.

7. **Dead code** — `normalizeToolCalls` in E3b.3, `halfOpenProbeInFlight` guard in E3b.4, dead cache key in E3b.3.

---

## Key Insights & Learnings

1. **3-iteration CR cap insufficient** — Complex infrastructure stories generate more issues than 3 iterations can resolve. Need remediation sprints or higher iteration counts.

2. **Memory management needs proactive design** — Unbounded data structures appeared in 3 stories. Every cache/queue/map should have documented max-size, TTL, and eviction policy from inception.

3. **Concurrent mutation checklist needed** — TOCTOU and missing transaction patterns are recurring. A pre-commit checklist for all PATCH/PUT routes would prevent these.

4. **Pattern reuse accelerates velocity** — E3b.4 and E3b.5 benefited significantly from patterns established in E3b.1-E3b.3.

5. **Static MVP shortcuts need tracking** — Static JSON model registry (E3b.3), hardcoded $0 cost estimation — these need explicit tickets to avoid becoming permanent.

---

## Previous Retro Follow-Through

This is the first formal retrospective for the project. No previous action items to track.

---

## Recurring Code Review Patterns

| Pattern | Frequency | Prevention |
|---------|-----------|------------|
| Memory leaks (unbounded structures) | 3/5 stories | Require max-size + eviction on all caches/queues |
| Audit try/catch inconsistency | 3/5 stories | Single documented pattern, linting rule |
| Race conditions (TOCTOU) | 2/5 stories | Concurrent mutation checklist for PATCH/PUT |
| Type safety gaps (string vs enum) | 3/5 stories | Use Prisma enum types, never raw strings |
| Dead code | 3/5 stories | Post-implementation cleanup pass |
| Missing tests | 2/5 stories | Test plan review before story closure |

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|------------------|
| 1 | Create HIGH issue remediation task — triage and fix/accept all 14 HIGH CR issues | Charlie | Before E4 | All 14 HIGH issues resolved or accepted-with-justification |
| 2 | Document memory management guidelines for shared packages | Winston | Before E5 | Max-size and TTL requirements for all caches/queues documented |
| 3 | Extract shared Platform API test helpers | Elena | Before next Platform API work | `__tests__/helpers/` with shared mocks, JWT helper, Prisma proxy |
| 4 | Create concurrent mutation checklist for PATCH/PUT routes | Bob | Before E4 | Checklist integrated into story creation workflow |

### Technical Debt

| # | Item | Owner | Priority | Effort |
|---|------|-------|----------|--------|
| 1 | Fix memory leaks: AI Gateway adapter cache + Platform Client pending promises | Charlie | HIGH | Medium |
| 2 | Fix `invalidateCache` stale fallback bug (E3b.4 ISSUE #1) | Charlie | HIGH | Small |
| 3 | Add model-registry tests to AI Gateway (E3b.3 ISSUE #3) | Dana | HIGH | Small |
| 4 | Fix zodSerializerCompiler fail-open security issue (E3b.1 ISSUE #1) | Charlie | HIGH | Small |
| 5 | Implement real cost estimation in AI Gateway (E3b.3 ISSUE #5) | Amelia | MEDIUM | Medium |
| 6 | Consolidate duplicated circuit breaker into shared package | Charlie | LOW | Medium |
| 7 | Fix event emission — use typed events instead of log strings (E3b.3 ISSUE #1) | Charlie | MEDIUM | Medium |

### Team Agreements

- Every PATCH/PUT route with concurrent mutation risk MUST use `$transaction` with `SELECT FOR UPDATE`
- All audit logging follows E3b.5 pattern: wrap `platformAudit.log()` in try/catch, log error, never throw
- Role guards and enforcement actions use Prisma enum types, never raw strings
- Unbounded collections (Maps, arrays, queues) MUST have max size + eviction policy
- All static MVP shortcuts get tracked as explicit technical debt items

---

## Next Epic Preview

**Epic E4: i18n Infrastructure** — backlog, no epic definition file exists yet. 3 stories planned:
- e4-1-translation-key-system
- e4-2-backend-i18n
- e4-3-number-date-currency-formatting

E4 is independent of E3b's technical debt — i18n is a separate concern that doesn't depend on Platform API or AI Gateway infrastructure. However, the HIGH issues from E3b should be remediated before E5 (AI Orchestration), which directly consumes `packages/ai-gateway`.

---

## Significant Discoveries

No architectural assumptions were proven wrong. No scope changes needed for upcoming epics. The Platform API + AI Gateway infrastructure is solid and ready for downstream consumption.

**Recommendation:** Remediate the 14 HIGH code review issues before starting E5 (AI Orchestration), since E5 directly depends on `packages/ai-gateway`. E4 (i18n) can proceed independently.

---

## Commitments Summary

- Action Items: 4
- Technical Debt Items: 7
- Team Agreements: 5
- Critical Path Items: 1 (HIGH issue remediation before E5)

---

**Next Steps:**

1. Review this retrospective summary
2. Triage and address 14 HIGH code review issues (remediation sprint)
3. Extract shared test helpers for Platform API tests
4. Begin Epic E4 planning when ready (independent of remediation)
5. Complete remediation before starting E5

---

Bob (Scrum Master): "Great session today, Mohammed. The team did excellent work on E3b."
Alice (Product Owner): "See you at epic planning!"
Charlie (Senior Dev): "Time to knock out those HIGH issues."

# Epic E4 Retrospective — i18n Infrastructure

**Date:** 2026-02-22
**Facilitator:** Bob (Scrum Master)
**Epic:** E4 — i18n Infrastructure
**Status:** Complete (3/3 stories done)

---

## Epic Summary & Metrics

| Metric | Value |
|--------|-------|
| Total Stories | 3 |
| Completed | 3 (100%) |
| Agent Model | Claude Opus 4.6 (all stories) |
| Code Reviews | 3 iterations per story |
| Remaining CR Issues | 35 (7 HIGH, 17 MEDIUM, 11 LOW) |
| Production Incidents | 0 |
| FRs Delivered | FR178 (Translation Keys), FR179 (User Locale), FR180 (Number/Date/Currency Formatting) |
| NFRs Addressed | NFR38 (Decimal precision), NFR41 (TypeScript strict), NFR45 (API docs) |

### Stories Delivered

| Story | Title | Tasks | CR Issues | Key Deliverables |
|-------|-------|-------|-----------|-----------------|
| E4.1 | Translation Key System | 7 | 12 (3H, 5M, 4L) | `@nexa/i18n` package, i18next config, I18nProvider, English locale files, ESLint no-raw-text rule, User.locale migration |
| E4.2 | Backend i18n | 9 | 11 (2H, 6M, 3L) | TranslationMessage type, server-side i18n singleton, AppError i18n fields, error envelope messageKey, Zod error mapping, route error i18n |
| E4.3 | Number/Date/Currency Formatting | 9 | 12 (2H, 6M, 4L) | formatCurrency/Number/Date/Percent utilities in `@nexa/shared`, React format hooks in `@nexa/i18n`, Intl API-based formatting |

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

1. **Clean architectural layering** — Three-layer i18n architecture is well-designed:
   - `@nexa/i18n` (React-facing): I18nProvider, hooks, format hooks
   - `@nexa/i18n/server` (backend-facing): tServer(), resolveMessage(), message utilities
   - `@nexa/shared` (pure utilities): formatCurrency/Number/Date/Percent with no framework dependencies
   This separation ensures mobile, web, and backend code can all use the appropriate layer without pulling in unwanted dependencies.

2. **Dual message approach (message + messageKey)** — E4.2's design to include both resolved English text AND the translation key in API error responses is elegant. Backward-compatible for existing consumers while enabling future localisation. Frontend can resolve keys via `t()` while API consumers without i18n see readable English.

3. **Story intelligence transfer** — Each story explicitly documented patterns from previous stories and addressed code review findings:
   - E4.2 addressed E4.1 ISSUE #5 (server singleton) and ISSUE #10 (type mismatch)
   - E4.3 referenced patterns from both E4.1 and E4.2
   This cross-story learning is excellent and should continue.

4. **Pure Intl API usage — zero external dependencies** — All formatting uses the built-in JavaScript `Intl` API. No date-fns, no luxon, no numeral.js. Keeps the bundle lean and aligned with the Architecture specification.

5. **Comprehensive test coverage** — All three stories have thorough test suites covering happy paths, edge cases (JPY 0 decimals, BHD 3 decimals, NaN inputs, negative amounts), and integration scenarios.

6. **Forward-compatible design** — English-only MVP but designed for zero-code-change expansion. Adding a new language requires only adding locale files — no code changes. The namespace-per-module approach (`common`, `validation`, `errors`) scales cleanly for business modules.

7. **100% story completion** — All 3 stories delivered with all acceptance criteria met.

---

## Challenges & Growth Areas

1. **Code review issue accumulation continues** — 35 issues remain after 3 CR iterations per story (7 HIGH, 17 MEDIUM, 11 LOW). This mirrors E3b's pattern of 62 issues. The 3-iteration CR cap is consistently insufficient.

2. **HIGH issue pattern: Functional correctness gaps** — 7 HIGH issues reveal gaps in core functionality:
   - E4.1 #1: `isDev` detection broken for Vite (missing key warnings disabled in the exact environment where developers need them)
   - E4.1 #2: No type-safe translation key registry (typos compile silently)
   - E4.1 #3: AC #4 example cannot be reproduced (missing `field` namespace)
   - E4.2 #1: `systemMsg()` uses wrong namespace prefix (`system:` instead of `common:`)
   - E4.2 #2: Fastify 4xx errors use raw message instead of translated
   - E4.3 #1: `formatNumber` cache key incomplete (cache collisions)
   - E4.3 #2: `formatDateTime` medium preset untested

3. **Inconsistency patterns across stories:**
   - Cache strategies: 4 different caching approaches across formatter files (JSON.stringify vs manual concatenation) — E4.3 ISSUE #8
   - Error handling: `Infinity` returns `''` in some formatters, English string "Infinity" in others — E4.3 ISSUE #5
   - Key conventions: SCREAMING_SNAKE_CASE in errors.json, camelCase elsewhere — E4.1 ISSUE #12
   - Namespace confusion: `system:` vs `common:` prefix in systemMsg() — E4.2 ISSUE #1

4. **Dead code shipped on day one:**
   - `FallbackConfig` type exported but never consumed (E4.1 ISSUE #6)
   - Empty `system.json` namespace file (E4.2 ISSUE #8)
   - Backend message utilities not exported from index.ts despite story requirement (E4.2 ISSUE #3)

5. **Story file hygiene:**
   - E4.3 story file still shows `Status: backlog` despite being complete (E4.3 ISSUE #3)
   - Story status summary table in epic file still shows all stories as "backlog"

6. **Missing test coverage for specific paths:**
   - MFA route tests completely absent from auth.routes.test.ts (E4.2 ISSUE #4)
   - formatDateTime medium preset untested (E4.3 ISSUE #2)
   - formatPercent NaN test missing (E4.3 ISSUE #7)
   - sendError() with messageKey untested (E4.2 ISSUE #10)

---

## Key Insights & Learnings

1. **i18n is infrastructure that touches everything** — E4.2 modified 23 files across the entire API codebase to replace hardcoded strings. This cross-cutting nature means any mistake in the i18n pattern propagates widely. The dual message approach was the right call — it allowed incremental adoption without breaking existing tests.

2. **Caching in pure utility functions needs a unified strategy** — E4.3's four formatter files each implemented their own cache with different strategies, leading to ISSUE #1 (buggy cache key) and ISSUE #8 (inconsistent approaches). A shared `createFormatterCache()` utility should be extracted.

3. **Code review 3-iteration cap is a systemic issue** — Both E3b (62 issues) and E4 (35 issues) leave significant numbers of issues unresolved. The process produces valuable findings but lacks a mechanism to action them. Need a different approach.

4. **Dev environment detection is platform-specific** — E4.1's `isDev` check using `process.env.NODE_ENV` doesn't work in Vite browser environments (which use `import.meta.env.DEV`). This is a fundamental platform awareness gap that will recur in E6 (Web Frontend Shell).

5. **Story file status updates should be automated** — Multiple stories have stale status fields. The BMAD workflow should automatically update story status when the dev agent completes work.

---

## Previous Retro Follow-Through (E3b)

**E3b Retro Action Items Assessment:**

| # | Action Item | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Create HIGH issue remediation task — triage and fix/accept all 14 HIGH CR issues from E3b | ❌ Not Addressed | No evidence of remediation in E4 stories. 14 HIGH issues from E3b remain open. |
| 2 | Document memory management guidelines for shared packages | ⏳ In Progress | Not formally documented, but E4.3's formatter caching shows awareness of the pattern. Max-size of 50 with eviction implemented (though eviction is destructive clear, not LRU). |
| 3 | Extract shared Platform API test helpers | ❌ Not Addressed | E4 didn't touch Platform API, so this wasn't applicable. Remains pending for future Platform API work. |
| 4 | Create concurrent mutation checklist for PATCH/PUT routes | ❌ Not Addressed | E4 didn't introduce PATCH/PUT mutations, so wasn't exercised. Remains pending. |

**E3b Team Agreements Assessment:**

| Agreement | Applied in E4? | Evidence |
|-----------|---------------|----------|
| PATCH/PUT with concurrent mutation → `$transaction` + `SELECT FOR UPDATE` | N/A | E4 didn't introduce PATCH/PUT mutations |
| Audit logging follows E3b.5 pattern | N/A | E4 doesn't emit audit events |
| Role guards use Prisma enum types | N/A | E4 didn't modify RBAC |
| Unbounded collections MUST have max size + eviction | ✅ Partially | Formatter caches have max size (50), but eviction is destructive `Map.clear()` instead of LRU |
| Static MVP shortcuts tracked as tech debt | ✅ Yes | E4.1 ISSUE #2 (no type-safe key registry) explicitly noted as deferred improvement |

**Key Observation:** The E3b HIGH issue remediation (action item #1) was not completed before E4. While E4 was correctly identified as independent of E3b's technical debt (i18n doesn't depend on Platform API/AI Gateway), the 14 HIGH issues from E3b remain unresolved. These MUST be addressed before E5 (AI Orchestration), which directly depends on `packages/ai-gateway`.

---

## Recurring Code Review Patterns (E3b + E4 Combined)

| Pattern | E3b Frequency | E4 Frequency | Trend | Prevention |
|---------|--------------|-------------|-------|------------|
| Functional correctness gaps (HIGH) | 14 HIGH across 5 stories | 7 HIGH across 3 stories | Consistent | Pre-implementation spike for edge cases; AC examples must be reproducible |
| Inconsistent patterns across files | 3/5 stories | 3/3 stories | Worsening | Establish patterns in first story, enforce in subsequent |
| Dead/unused code | 3/5 stories | 2/3 stories | Consistent | Post-implementation cleanup pass |
| Missing test paths | 2/5 stories | 2/3 stories | Consistent | Test plan review against all ACs before closure |
| Story file status drift | N/A | 1/3 stories | New | Automate status updates in BMAD workflow |

---

## Next Epic Preview

**Epic E5: AI Orchestration** — backlog, no epic definition file exists yet.

### Planned Stories (from sprint-status.yaml):

| Story | Title | Status |
|-------|-------|--------|
| E5.1 | AI Service Layer | backlog |
| E5.2 | AI Chat Session Management | backlog |
| E5.3 | AI Action Framework | backlog |
| E5.4 | AI Predictions | backlog |
| E5.5 | Daily Briefing + Smart Suggestions | backlog |

### Dependencies on E4 Work:

- **Direct:** E5 will use `@nexa/i18n` translation keys for AI-generated messages and error responses
- **Indirect:** E5 depends on `packages/ai-gateway` from E3b — the 14 HIGH CR issues from E3b affect E5's foundation
- **Critical:** E5.1 (AI Service Layer) will integrate with the Platform Client SDK from E3b.4, which has unresolved memory leak issues

### Preparation Needed:

1. **CRITICAL: Remediate E3b HIGH issues** — E5 directly consumes `packages/ai-gateway` and `packages/platform-client`. The 14 HIGH issues from E3b (memory leaks, `invalidateCache` bug, `zodSerializerCompiler` fail-open) must be fixed before building on top of them.
2. **Create E5 epic definition file** — No `epic-E5.md` exists yet. Story details need to be created via BMAD workflow.
3. **E4 HIGH issue triage** — Decide which of the 7 HIGH issues from E4 need immediate fixes vs. can be deferred:
   - E4.1 #1 (`isDev` for Vite) — defer to E6 (when Vite app is actually created)
   - E4.1 #2 (type-safe keys) — defer until key count warrants it
   - E4.1 #3 (field namespace) — fix before E6 (when React components start using `t()`)
   - E4.2 #1 (systemMsg namespace) — fix before E5 (AI messages may use systemMsg)
   - E4.2 #2 (Fastify 4xx translation) — fix before E5
   - E4.3 #1 (formatNumber cache) — fix before E6 (when formatters are used in UI)
   - E4.3 #2 (formatDateTime test) — fix before E6

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|------------------|
| 1 | Triage E3b + E4 HIGH CR issues (21 total: 14 from E3b, 7 from E4) — categorise as "fix now", "fix before E5", "fix before E6", or "accept with justification" | Charlie + Mohammed | Before E5 sprint planning | All 21 HIGH issues have documented disposition |
| 2 | Fix E3b HIGH issues blocking E5 (memory leaks, invalidateCache, zodSerializerCompiler) | Charlie | Before E5 starts | E3b HIGH issues resolved, tests passing |
| 3 | Fix E4 HIGH issues blocking E5 (systemMsg namespace, Fastify 4xx translation) | Amelia | Before E5 starts | systemMsg() uses `common:` prefix, Fastify errors use tServer() |
| 4 | Create E5 epic definition file with detailed stories via BMAD workflow | Bob + John | Before E5 sprint planning | `epic-E5.md` exists with story details, ACs, and reference documents |

### Technical Debt

| # | Item | Source | Owner | Priority | Effort |
|---|------|--------|-------|----------|--------|
| 1 | Fix `isDev` detection for Vite browser environments (E4.1 #1) | E4.1 | Amelia | MEDIUM (defer to E6) | Small |
| 2 | Add type-safe translation key registry (E4.1 #2) | E4.1 | Amelia | LOW (defer until key count warrants) | Medium |
| 3 | Add `field` namespace with field label keys (E4.1 #3) | E4.1 | Amelia | MEDIUM (before E6) | Small |
| 4 | Fix `systemMsg()` namespace prefix from `system:` to `common:` (E4.2 #1) | E4.2 | Amelia | HIGH (before E5) | Small |
| 5 | Fix Fastify 4xx errors to use tServer() (E4.2 #2) | E4.2 | Amelia | HIGH (before E5) | Small |
| 6 | Fix `formatNumber` cache key to include all Intl options (E4.3 #1) | E4.3 | Amelia | MEDIUM (before E6) | Small |
| 7 | Add `formatDateTime` medium preset tests (E4.3 #2) | E4.3 | Dana | MEDIUM (before E6) | Small |
| 8 | Unify formatter cache strategy (extract shared utility) | E4.3 #8 | Charlie | LOW | Medium |
| 9 | Add `I18nProvider` Suspense boundary or consumer warning (E4.1 #4) | E4.1 | Amelia | MEDIUM (before E6) | Small |
| 10 | Export backend message utilities from index.ts (E4.2 #3) | E4.2 | Amelia | LOW | Trivial |
| 11 | Clean up dead code: FallbackConfig type, empty system.json (E4.1 #6, E4.2 #8) | E4.1/E4.2 | Amelia | LOW | Trivial |

### Team Agreements

- **All translation keys must be reproducible** — Every AC example using `t()` must have a corresponding key in the locale files. If an AC demonstrates `t('field.customerName')`, the `field` namespace and key must exist.
- **Formatter utilities must use a unified caching strategy** — New formatters must use the same cache key approach (prefer `JSON.stringify` for full coverage).
- **Story status updates are mandatory** — Story file `Status:` field must be updated to `done` when the dev agent completes work. The BMAD workflow should enforce this.
- **E3b HIGH issue remediation must complete before E5** — This was committed in E3b retro and not fulfilled. It is now doubly critical since E5 directly depends on E3b deliverables.
- **Backend message utilities follow namespace conventions** — `validationMsg()` → `validation:`, `errorMsg()` → `errors:`, `systemMsg()` → `common:` (not `system:`). Document this in `@nexa/i18n` README.

---

## Significant Discoveries

No architectural assumptions were proven wrong during E4. The i18n infrastructure was cleanly independent of other subsystems, validating the build sequence decision to place it in Tier 1 before business modules.

**Key Observation:** The Vite `isDev` detection issue (E4.1 #1) reveals a broader platform awareness gap. E6 (Web Frontend Shell) will bootstrap the React app with Vite, and any code that uses `process.env` for environment detection will fail silently. This should be addressed as a cross-cutting concern before E6, not per-story.

**No epic update required for E5** — E4's findings don't change E5's planned scope or approach. E5 (AI Orchestration) is independent of i18n implementation details — it will consume `@nexa/i18n` for message translation but doesn't depend on any specific i18n design decision.

---

## Commitments Summary

- Action Items: 4
- Technical Debt Items: 11
- Team Agreements: 5
- Critical Path Items: 2 (E3b HIGH remediation + E4 HIGH fixes before E5)

---

## Next Steps

1. **Review this retrospective summary**
2. **Triage all 21 HIGH CR issues** (14 from E3b + 7 from E4) — categorise by deadline
3. **Fix E3b + E4 HIGH issues blocking E5** (remediation sprint)
4. **Create E5 epic definition** via BMAD workflow (SM + PM agents)
5. **Begin E5 sprint planning** when remediation complete and epic definition approved

---

Bob (Scrum Master): "Great session today, Mohammed. E4 was a clean infrastructure epic — 100% delivery, solid architecture. The i18n foundation is ready for business modules."

Alice (Product Owner): "The dual message approach for API errors is going to pay dividends when we add multi-language support."

Charlie (Senior Dev): "We need to knock out those HIGH issues from E3b and E4 before E5. I'll lead the triage."

Dana (QA Engineer): "And let's not forget the missing test paths — those formatDateTime medium tests need to happen."

Elena (Junior Dev): "The story intelligence transfer was really helpful. E4.3 was much smoother because E4.1 and E4.2 documented their patterns clearly."

Bob (Scrum Master): "That's exactly the kind of continuous improvement we want to see. See you all at E5 planning!"

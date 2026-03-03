---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-22'
---

# Test Design: Epic E4 - i18n Infrastructure

**Date:** 2026-02-22
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E4 (i18n Infrastructure) covering 3 stories: Translation Key System (E4.1), Backend i18n (E4.2), Number/Date/Currency Formatting (E4.3).

> **Note:** P0/P1/P2/P3 designations below reflect **priority and risk**, NOT execution timing. See the Execution Strategy section for when tests run.

**Risk Summary:**

- Total risks identified: 8
- High-priority risks (score >=6): 2
- Critical categories: DATA (decimal precision), TECH (fallback chain correctness)

**Coverage Summary:**

- P0 scenarios: 8 (~8-14 hours)
- P1 scenarios: 12 (~10-18 hours)
- P2 scenarios: 10 (~4-8 hours)
- P3 scenarios: 4 (~1-3 hours)
- **Total effort**: ~25-45 hours (~1-1.5 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Multi-language locale files** | MVP is English-only; no additional locales delivered in E4 | Fallback chain logic tested with stub locales; actual locale files deferred to post-MVP |
| **React UI component rendering** | No `apps/web` exists yet (E6) | E4 tests validate i18n package, formatters, and backend i18n in isolation; UI integration tested in E6 |
| **PDF/email rendering** | Backend locale file created but rendering pipeline not built until E9/E10 | Backend locale file structure tested; rendering integration deferred |
| **Mobile app formatting** | Mobile not yet in scope | Shared formatters in `packages/shared` are platform-agnostic; verified via unit tests |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | DATA | Decimal precision loss in currency formatting: `Intl.NumberFormat` may round Decimal(19,4) values if passed as JavaScript `number` instead of string-based conversion | 2 | 3 | 6 | Unit tests with edge-case currencies (JPY/0, BHD/3); formatter must accept string input and preserve precision via `Intl.NumberFormat` with explicit `minimumFractionDigits`/`maximumFractionDigits` from `Currency.minorUnit` | Dev | Sprint E4 |
| R-002 | TECH | Fallback chain resolution incorrect: user -> company -> en chain may short-circuit or skip levels if i18next configuration is wrong, causing missing translations to appear as raw keys in production | 2 | 3 | 6 | Integration tests covering all fallback paths (user has locale, user missing -> company fallback, both missing -> en fallback); explicit test for missing key logging in dev mode | Dev | Sprint E4 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-003 | TECH | Zod error code mapping incomplete: some Zod issue codes may not have translation key mappings, causing raw Zod error messages to leak to the frontend | 2 | 2 | 4 | Comprehensive unit tests covering all Zod issue codes used in the API; fallback to generic `validation.invalid` key for unmapped codes | Dev |
| R-004 | BUS | ESLint rule false positives: `no-raw-text` rule may flag legitimate non-translatable strings (CSS class names, HTML attributes, technical identifiers) | 2 | 2 | 4 | Configure rule with ignore patterns for non-UI strings; verify rule against existing codebase patterns before enabling | Dev |
| R-005 | DATA | Currency.minorUnit not available during formatting: if currency metadata not loaded or cached, formatters may default to 2 decimal places for all currencies | 1 | 3 | 3 | Formatters require `minorUnit` parameter (no silent default); test with explicit 0 and 3 decimal currencies | Dev |
| R-006 | TECH | i18next namespace loading performance: lazy-loading locale files may cause flash of untranslated content (FOUC) on first render | 1 | 2 | 2 | Preload critical namespaces (common, validation); test loading sequence | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-007 | OPS | Translation key naming inconsistency: different developers may use different key naming conventions (camelCase vs dot-notation) | 1 | 2 | 2 | Establish naming convention in key registry types; ESLint rule or type system enforcement |
| R-008 | TECH | Interpolation injection: translation keys with user-supplied params could produce unexpected output if params contain HTML or special characters | 1 | 1 | 1 | i18next escapes by default; verify escaping in tests |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E2 (Auth + Multi-Company RBAC) implemented: User and CompanyProfile models available
- [x] E1 (Database): Currency model with `minorUnit` field seeded
- [ ] `packages/i18n` package scaffolded in monorepo
- [ ] `packages/shared/src/formatters/` directory created
- [ ] Test environment with Vitest configured for new packages

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged)
- [ ] No open high-priority / high-severity bugs
- [ ] Decimal precision verified for all supported currency types (0, 2, 3, 4 decimals)
- [ ] Fallback chain verified for all three levels (user -> company -> en)
- [ ] Error envelope includes `messageKey` and `messageParams` in all error responses

---

## Test Coverage Plan

### P0 (Critical) - Blocks core functionality + High risk + No workaround

**Criteria:** Revenue/data-integrity impact, no workaround, risk score >= 6

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E4.3-UNIT-001 | formatCurrency preserves Decimal(19,4) precision for GBP (2 decimals) | Unit | R-001 | Input as string "1234.5600", locale en-GB, expect "£1,234.56" |
| E4.3-UNIT-002 | formatCurrency handles JPY with minorUnit=0 (no decimals) | Unit | R-001, R-005 | Input "1000", expect "¥1,000" |
| E4.3-UNIT-003 | formatCurrency handles BHD with minorUnit=3 (3 decimals) | Unit | R-001, R-005 | Input "1.234", expect correct 3-decimal output |
| E4.3-UNIT-004 | formatCurrency handles negative amounts correctly | Unit | R-001 | Input "-1234.56", GBP, en-GB |
| E4.1-UNIT-001 | t() resolves key from user locale (happy path) | Unit | R-002 | User locale "en", key "common.save" -> "Save" |
| E4.1-UNIT-002 | t() falls back user -> company -> en when user locale missing | Unit | R-002 | User locale null, company locale null, key resolves from en |
| E4.1-UNIT-003 | t() logs missing key warning in development mode | Unit | R-002 | Non-existent key, NODE_ENV=development, expect console warning |
| E4.2-INT-001 | Validation error response includes messageKey and messageParams | Integration | R-003 | POST with invalid payload, verify error envelope structure |

**Total P0**: 8 tests, ~8-14 hours

### P1 (High) - Important features + Medium risk + Common workflows

**Criteria:** Core functionality, medium risk (score 3-4), frequently exercised paths

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E4.1-UNIT-004 | t() interpolation with params: `t('validation.required', { field: 'Customer Name' })` | Unit | - | Verify "Customer Name is required" |
| E4.1-UNIT-005 | t() returns key itself when key not found (graceful degradation) | Unit | R-002 | Production mode: missing key returns key string |
| E4.2-UNIT-001 | TranslationMessage type: `validationMsg('validation.required', { field: 'name' })` produces correct structure | Unit | R-003 | Verify `{ key, params }` shape |
| E4.2-UNIT-002 | Zod too_small -> "validation.minLength" mapping | Unit | R-003 | Zod issue code mapping correctness |
| E4.2-UNIT-003 | Zod invalid_type -> "validation.invalidType" mapping | Unit | R-003 | Zod issue code mapping correctness |
| E4.2-UNIT-004 | Zod unmapped error code -> "validation.invalid" fallback | Unit | R-003 | Unknown Zod codes don't leak raw messages |
| E4.2-INT-002 | Field-level validation errors carry per-field messageKey | Integration | R-003 | POST with multiple invalid fields, verify details structure |
| E4.3-UNIT-005 | formatDate("2026-02-17", "en-GB") -> "17/02/2026" | Unit | - | DD/MM/YYYY for en-GB |
| E4.3-UNIT-006 | formatDate("2026-02-17", "en-US") -> "02/17/2026" | Unit | - | MM/DD/YYYY for en-US |
| E4.3-UNIT-007 | formatNumber(1234567.89, "en-GB") -> "1,234,567.89" | Unit | - | Thousands separator and decimal |
| E4.3-UNIT-008 | formatNumber(1234567.89, "de-DE") -> "1.234.567,89" | Unit | - | German locale formatting |
| E4.3-UNIT-009 | formatPercent(0.156, "en-GB") -> "15.6%" | Unit | - | Percentage formatting |

**Total P1**: 12 tests, ~10-18 hours

### P2 (Medium) - Secondary features + Low risk + Edge cases

**Criteria:** Secondary flows, low risk (score 1-2), edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E4.1-UNIT-006 | i18next namespace loading: common, validation, navigation namespaces resolve independently | Unit | R-006 | Namespace isolation |
| E4.1-UNIT-007 | ESLint no-raw-text rule flags hardcoded string in JSX | Unit | R-004 | ESLint rule validation |
| E4.1-UNIT-008 | ESLint no-raw-text rule ignores non-UI strings (className, data-testid) | Unit | R-004 | Rule does not false-positive on attributes |
| E4.2-UNIT-005 | errorMsg() produces correct TranslationMessage for domain errors | Unit | - | `errorMsg('error.periodLocked', { period: 'Q1' })` |
| E4.2-UNIT-006 | systemMsg() produces correct TranslationMessage for audit entries | Unit | - | `systemMsg('audit.userCreated', { email: 'test@test.com' })` |
| E4.2-UNIT-007 | Backend English locale file loads and resolves server-side keys | Unit | - | Used for email/PDF rendering path |
| E4.3-UNIT-010 | formatCurrency with zero amount: "0.00" formatted correctly | Unit | - | Edge case: zero amount |
| E4.3-UNIT-011 | formatCurrency with very large amount (>1 billion) formatted correctly | Unit | - | Edge case: large numbers |
| E4.3-UNIT-012 | formatDate with ISO 8601 input including time component | Unit | - | Ensure date-only extraction |
| E4.1-UNIT-009 | Translation key type safety: TypeScript prevents invalid key usage at compile time | Unit | R-007 | Type registry enforcement |

**Total P2**: 10 tests, ~4-8 hours

### P3 (Low) - Nice-to-have + Exploratory

**Criteria:** Rarely exercised, cosmetic, benchmarks

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| E4.1-UNIT-010 | i18next performance: 1000 key lookups complete in <100ms | Unit | R-006 | Performance benchmark |
| E4.3-UNIT-013 | formatCurrency consistency across all 180 ISO 4217 currencies | Unit | - | Exhaustive currency test (parameterised) |
| E4.1-UNIT-011 | Interpolation with HTML-like params is escaped by default | Unit | R-008 | Security: `<script>` in params |
| E4.2-UNIT-008 | All Zod issue codes have translation key mappings (completeness audit) | Unit | R-003 | Full Zod enum coverage |

**Total P3**: 4 tests, ~1-3 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. With Playwright parallelisation, 100+ tests complete in 10-15 minutes.

| Trigger | What Runs | Time |
| --- | --- | --- |
| **Every PR** | All unit tests (E4.3-UNIT-*, E4.1-UNIT-*, E4.2-UNIT-*), all integration tests (E4.2-INT-*), ESLint check | ~2-5 min |
| **Nightly** | Full parameterised currency suite (E4.3-UNIT-013, all 180 currencies) | ~5-10 min |
| **On demand** | Performance benchmarks (E4.1-UNIT-010) | ~1 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| P0 | 8 | ~8-14 hours | Complex setup for formatter edge cases, i18next config |
| P1 | 12 | ~10-18 hours | Standard unit and integration coverage |
| P2 | 10 | ~4-8 hours | Simple scenarios, ESLint rule validation |
| P3 | 4 | ~1-3 hours | Benchmarks and exhaustive parameterised tests |
| **Total** | **34** | **~25-45 hours** | **~1-1.5 weeks** |

### Prerequisites

**Test Data:**

- English locale fixture files with known keys for test assertions
- Currency metadata fixtures: GBP (minorUnit=2), JPY (minorUnit=0), BHD (minorUnit=3), USD (minorUnit=2)
- CompanyProfile fixture with `defaultLanguage: 'en'`, `baseCurrencyCode: 'GBP'`

**Tooling:**

- Vitest (already configured in monorepo)
- ESLint with `eslint-plugin-i18next` or custom `no-raw-text` rule

**Environment:**

- Node.js with `Intl` API support (full ICU data)
- No database required for unit tests; Fastify inject for integration tests

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (formatting, fallback chain): >=90%
- **Business logic** (Zod mapping, TranslationMessage): >=80%
- **Edge cases** (currency edge cases, large numbers): >=60%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Decimal precision preserved for all tested currency types
- [ ] Fallback chain covers all three levels with evidence

---

## Mitigation Plans

### R-001: Decimal Precision Loss in Currency Formatting (Score: 6)

**Mitigation Strategy:**
1. Formatters accept `string | Decimal` input, never raw JavaScript `number`
2. Use `Currency.minorUnit` to set explicit `minimumFractionDigits` and `maximumFractionDigits` on `Intl.NumberFormat`
3. Test matrix covering minorUnit values: 0 (JPY), 2 (GBP/USD), 3 (BHD), 4 (CLF)
4. Verify round-trip: format then parse produces same value

**Owner:** Dev
**Timeline:** Sprint E4
**Status:** Planned
**Verification:** P0 tests E4.3-UNIT-001 through E4.3-UNIT-004 all pass with exact expected output

### R-002: Fallback Chain Resolution Incorrect (Score: 6)

**Mitigation Strategy:**
1. Configure i18next with explicit `fallbackLng` array: `[userLocale, companyLocale, 'en']`
2. Test three distinct fallback scenarios: user locale hit, company fallback, en fallback
3. Verify missing key logging captures key name and attempted locales
4. Integration test with mock locale files confirming chain order

**Owner:** Dev
**Timeline:** Sprint E4
**Status:** Planned
**Verification:** P0 tests E4.1-UNIT-001 through E4.1-UNIT-003 all pass; fallback paths exercised with assertions on which locale was used

---

## Assumptions and Dependencies

### Assumptions

1. Node.js runtime includes full ICU data for `Intl` API (not `small-icu` build)
2. i18next (or equivalent) is the chosen i18n library for React integration
3. Currency model from E1 is seeded with correct `minorUnit` values for all supported currencies
4. `packages/shared` and `packages/i18n` will be new packages created during E4

### Dependencies

1. E2 (Auth + Multi-Company) completed - User profile and CompanyProfile available - Required before E4 start
2. E1 (Database) completed - Currency model with `minorUnit` seeded - Required before E4 start
3. `packages/config/eslint/base.js` - Must accept new `no-raw-text` rule configuration - Required for E4.1

### Risks to Plan

- **Risk**: i18next vs react-intl library choice not yet finalised
  - **Impact**: Test setup and configuration differ between libraries
  - **Contingency**: Tests written against abstract `t()` interface; library-specific config isolated to setup files

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **apps/api error handling** | E4.2 modifies error classes to add `messageKey` and `messageParams` | Existing error handler tests must still pass; error envelope backward compatibility verified |
| **packages/db (Currency model)** | E4.3 reads `Currency.minorUnit` for formatting | Currency model tests unaffected; new formatter tests consume Currency data |
| **packages/config/eslint** | E4.1 adds `no-raw-text` ESLint rule | Existing ESLint config tests unaffected; new rule added additively |
| **apps/api validation (Zod)** | E4.2 modifies Zod error transformer | Existing validation tests must still pass with updated error format |

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
- `test-priorities-matrix.md` - P0-P3 prioritisation

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/functional-requirements.md` (FR178-FR180)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E4.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/1-overview.md`
- Data Models: `_bmad-output/planning-artifacts/data-models/3-module-by-module-models.md`
- Project Context: `_bmad-output/planning-artifacts/project-context.md` (Section 3: i18n)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

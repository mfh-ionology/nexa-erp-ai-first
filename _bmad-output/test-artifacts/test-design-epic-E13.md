---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-11'
---

# Test Design: Epic E13 - Printer Management

**Date:** 2026-03-11
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E13 — Printer Management

**Risk Summary:**

- Total risks identified: 8
- High-priority risks (score >=6): 2
- Critical categories: TECH (browser APIs, PDF generation dependency), BUS (batch print reliability)

**Coverage Summary:**

- P0 scenarios: 6 (~8-14 hours)
- P1 scenarios: 8 (~6-12 hours)
- P2 scenarios: 5 (~3-6 hours)
- P3 scenarios: 3 (~1-3 hours)
- **Total effort**: ~18-35 hours (~0.5-1 week)

> **Note:** P0/P1/P2/P3 = priority classification based on risk, NOT execution timing. Execution strategy is in a separate section.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Physical printer driver management** | Cloud SaaS — no OS-level printer drivers; print = PDF + browser dialog | Users use native OS print dialog which handles printer selection |
| **E12 Document Template engine internals** | PDF generation tested in E12's own test suite | E13 tests treat `POST /documents/generate` as a dependency; mock or verify response only |
| **Email-based document delivery** | Covered by E10 (Email Integration) | E13 focuses on download and browser print paths only |
| **Mobile print** | Mobile scaffold (E6) does not support browser Print API; deferred to future mobile-specific story | Document download works on mobile browsers; print dialog is desktop-only |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | TECH | Browser Print API (`iframe.contentWindow.print()`) behaves inconsistently across browsers (Chrome, Firefox, Safari) — may fail silently or block UI thread | 2 | 3 | 6 | Test across Chrome and Firefox in CI; document Safari known issues; implement fallback to PDF download if print dialog fails to open within timeout | Dev | Sprint 0 |
| R-002 | TECH | Batch PDF generation for large selections (50+ documents) may timeout or exhaust memory on BullMQ worker, leaving users with partial ZIP or no output | 2 | 3 | 6 | Implement chunked batch processing with progress tracking; set configurable batch size limits; add timeout handling with partial-result delivery | Dev | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-003 | TECH | PDF generation via E12 Puppeteer may be slow (>500ms NFR2 target) for complex templates, degrading perceived save performance | 2 | 2 | 4 | Non-blocking async generation with loading indicator; measure generation time in tests | Dev |
| R-004 | DATA | Print preference resolution logic (user -> company -> NONE fallback) may return incorrect preference when user has partial overrides | 2 | 2 | 4 | Unit test all fallback combinations; integration test with actual SystemSetting + UserPreference records | Dev |
| R-005 | BUS | "Reset to Company Defaults" action may inadvertently delete user preferences for document types not displayed on current page | 1 | 3 | 3 | Scope reset to visible document types only; confirm with user before bulk reset | Dev |
| R-006 | OPS | ZIP file generation for batch download may produce corrupted archives if concurrent batch jobs write to same temp directory | 2 | 2 | 4 | Use unique temp directories per batch job; validate ZIP integrity in tests | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-007 | BUS | Sequential browser print for batch "Browser Print" preference may confuse users with rapid dialog succession | 1 | 2 | 2 | Monitor; consider UX guidance or max sequential count |
| R-008 | OPS | Loading indicator during PDF generation may not dismiss if user navigates away and returns | 1 | 1 | 1 | Monitor; standard React cleanup on unmount |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E12 (Document Templates & PDF) stories completed and merged
- [ ] `POST /documents/generate` and `POST /documents/batch-generate` API endpoints functional
- [ ] SystemSetting and UserPreference models available (E1 foundation)
- [ ] Test environment provisioned with sample document templates
- [ ] Test data factories for companies, users, documents, and templates ready

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] Print preference resolution logic verified for all fallback paths
- [ ] Batch print with 10+ documents verified
- [ ] Browser print tested on Chrome (CI) and Firefox (manual)

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 below represent priority/risk classification, NOT execution timing. See Execution Strategy section for when tests run.

### P0 (Critical)

**Criteria**: Blocks core print workflow + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13.1-API-001 | Print preference CRUD — company defaults via SystemSetting | API | R-004 | Create, read, update company-level print defaults |
| E13.1-API-002 | Print preference CRUD — user overrides per document type | API | R-004 | User preference takes precedence over company default |
| E13.1-API-003 | Preference resolution fallback chain: user -> company -> NONE | API | R-004 | Test all 3 fallback paths with various combinations |
| E13.2-API-004 | Auto-download PDF on save triggers document generation API | API | R-003 | Verify `POST /documents/generate` called, file download initiated |
| E13.2-E2E-001 | Browser print dialog triggers via hidden iframe for "Browser Print" preference | E2E | R-001 | Verify `window.print()` or iframe print called |
| E13.2-API-005 | Batch generate PDFs returns ZIP download for multiple documents | API | R-002, R-006 | Verify ZIP contains correct PDFs, handles 10+ docs |

**Total P0**: 6 tests, ~8-14 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13.1-E2E-002 | Print preferences UI renders document type list with dropdowns | E2E | - | T7 Settings template, table with selectors |
| E13.1-E2E-003 | Admin sets company-level default, reflected for new users | E2E | R-004 | Company default propagation |
| E13.1-API-006 | "Reset to Company Defaults" clears user overrides | API | R-005 | Scoped to visible document types |
| E13.2-E2E-004 | Loading indicator shown during PDF generation | E2E | R-003 | Non-blocking, user can navigate |
| E13.2-E2E-005 | Auto-download triggers browser file download after save | E2E | - | Verify file download in Playwright |
| E13.2-API-007 | Batch generate with BullMQ job returns progress updates | API | R-002 | Poll job status until complete |
| E13.1-UNIT-001 | Preference resolution pure logic — all fallback permutations | Unit | R-004 | Unit test the resolution function directly |
| E13.2-UNIT-002 | ZIP file assembly logic — correct filenames, no duplicates | Unit | R-006 | Test ZIP builder function |

**Total P1**: 8 tests, ~6-12 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13.1-API-008 | Preference for unknown document type returns NONE default | API | - | Edge case: new document type added after preferences set |
| E13.2-E2E-006 | Sequential browser print for batch "Browser Print" preference | E2E | R-007 | Multiple print dialogs in sequence |
| E13.2-API-009 | Batch generate with 0 selected documents returns 400 error | API | - | Validation edge case |
| E13.1-E2E-007 | RBAC: non-admin cannot set company-level defaults | E2E | - | Permission enforcement |
| E13.2-API-010 | PDF generation timeout handling — returns error gracefully | API | R-003 | Simulated slow template rendering |

**Total P2**: 5 tests, ~3-6 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E13.2-PERF-001 | Batch generate 50 documents — measure total time and memory | API | R-002 | Performance benchmark, NFR2 |
| E13.1-E2E-008 | Print preferences survive page refresh (state persistence) | E2E | - | Exploratory |
| E13.2-E2E-009 | Loading indicator dismisses on navigate-away and return | E2E | R-008 | Edge case UX |

**Total P3**: 3 tests, ~1-3 hours

---

## Execution Strategy

**Philosophy**: Run everything in PRs unless expensive or long-running. With Playwright parallelization, the full E13 suite should complete in <5 minutes.

| Timing | What Runs | Tool | Duration |
|--------|-----------|------|----------|
| Every PR | All P0-P2 functional tests (API + E2E + Unit) | Playwright | ~3-5 min |
| Nightly | P3 performance benchmark (50-doc batch) | Playwright + custom | ~5-10 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|--------------|-------|
| P0 | 6 | ~8-14 hours | Complex setup (PDF mocking, preference combinations) |
| P1 | 8 | ~6-12 hours | Standard API + E2E coverage |
| P2 | 5 | ~3-6 hours | Edge cases, straightforward |
| P3 | 3 | ~1-3 hours | Benchmarks, exploratory |
| **Total** | **22** | **~18-35 hours** | **~0.5-1 week** |

### Prerequisites

**Test Data:**

- Company factory with SystemSetting records for print defaults
- User factory with UserPreference records per document type
- Document template fixtures (at least SALES_INVOICE, PURCHASE_ORDER types from E12)
- Sample business records (invoice, PO) to trigger document generation

**Tooling:**

- Playwright for E2E browser testing (print dialog interception)
- Playwright API request fixture for API-level tests
- Vitest for unit tests (preference resolution logic)

**Environment:**

- E12 document generation service running (or mocked at API boundary)
- BullMQ worker running for batch generation tests
- Test database with seeded company and user records

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (preference CRUD + print actions): >=80%
- **Business logic** (preference resolution): 100% via unit tests
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Browser print tested on Chrome (CI-verified)
- [ ] Batch download ZIP verified as valid archive

---

## Mitigation Plans

### R-001: Browser Print API Inconsistency (Score: 6)

**Mitigation Strategy:**
1. Test `iframe.contentWindow.print()` on Chrome in CI (primary browser)
2. Add timeout detection — if print dialog doesn't open within 3s, fall back to PDF download
3. Document Safari/Firefox known behaviors in release notes

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** E2E test E13.2-E2E-001 passes on Chrome; fallback path tested separately

### R-002: Batch PDF Generation Timeout/Memory (Score: 6)

**Mitigation Strategy:**
1. Implement configurable batch size limit (default: 50 documents)
2. Chunk large batches into sub-jobs on BullMQ worker
3. Add progress tracking via job events
4. Return partial results if timeout occurs (with notification)

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** E13.2-API-005 tests 10+ doc batch; E13.2-PERF-001 benchmarks 50-doc batch

---

## Assumptions and Dependencies

### Assumptions

1. E12 `POST /documents/generate` endpoint returns a PDF binary or URL within NFR2 (500ms) for single documents
2. BullMQ is available and configured for batch job processing (from E11 or infrastructure)
3. SystemSetting key-value store supports the `print.{documentType}.default` naming convention (from E1)
4. Browser Print API (`window.print()`) works reliably on Chrome — the primary supported browser

### Dependencies

1. E12 (Document Templates & PDF) — must be complete and merged before E13 can be implemented
2. SystemSetting + UserPreference models (from E1) — must support the key patterns needed
3. BullMQ batch job infrastructure — required for E13.S2 batch printing

### Risks to Plan

- **Risk**: E12 PDF generation is slower than expected
  - **Impact**: Auto-download on save feels sluggish; P0 tests may timeout
  - **Contingency**: Implement async generation with WebSocket notification when PDF ready; adjust test timeouts

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|-----------------|
| **E12 Document Templates** | E13 calls `POST /documents/generate` and `POST /documents/batch-generate` | E12 API tests must continue passing; no breaking changes to PDF output format |
| **SystemSetting (E1)** | E13.S1 stores print preferences as SystemSetting records | E1 CRUD tests for SystemSetting must pass; no key naming conflicts |
| **UserPreference (E1)** | E13.S1 stores user-level overrides | Existing user preference tests unaffected |
| **BullMQ (Infrastructure)** | E13.S2 uses batch job queue for multi-document generation | Existing queue consumers (email, etc.) must not conflict |
| **DataTable / List Pages (E7)** | "Print Selected" batch action on list views | E7 bulk action mechanism must support custom actions |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: Mohammed Date: ___
- [ ] Tech Lead: ___ Date: ___
- [ ] QA Lead: ___ Date: ___

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/functional-requirements.md` (FR190-FR192)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E13.md`
- Epic (planning): `_bmad-output/planning-artifacts/epics/epic-e13-printer-management.md`
- Architecture: `_bmad-output/planning-artifacts/project-context.md` (Section 7: Printer Management)
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md` (Section 2.4)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

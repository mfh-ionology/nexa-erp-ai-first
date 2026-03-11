---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-11'
---

# Test Design: Epic E12 - Document Templates & PDF

**Date:** 2026-03-11
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E12 — Document Templates & PDF Generation

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (≥6): 3
- Critical categories: SEC (template injection), DATA (version selection), PERF (resource exhaustion)

**Coverage Summary:**

- P0 scenarios: 5 (~15-25 hours)
- P1 scenarios: 8 (~20-35 hours)
- P2 scenarios: 6 (~5-10 hours)
- P3 scenarios: 4 (~2-4 hours)
- **Total effort**: ~42-74 hours (~1-2 weeks)

> **Note:** P0/P1/P2/P3 = priority classification based on risk and business impact, NOT execution timing. Execution strategy is defined separately below.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Email sending/SMTP delivery** | Covered by E10 (Email Integration) | Mock email channel; test only the document-to-email handoff |
| **S3/MinIO storage service** | Covered by E8 (Attachments) | Mock presigned URL generation; E8 tests cover upload/download |
| **Notification dispatch** | Covered by E9 (Notifications) | Not triggered by E12 |
| **HMRC payroll form validation** | Compliance audit scope, not functional testing | Visual review of P45/P60/Payslip templates against HMRC guidance |
| **Browser print dialog** | OS-level functionality | Test PDF download only; browser Print API is pass-through |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | **Template injection via Puppeteer**: ADMIN-supplied Handlebars HTML could contain `<script>` or `<iframe>` that executes server-side during PDF rendering, enabling SSRF or file system access | 2 | 3 | 6 | Sanitize HTML before Puppeteer rendering; disable JavaScript execution in page context (`page.setJavaScriptEnabled(false)`); use Handlebars `SafeString` only for trusted content | Dev | Sprint 0 |
| R-002 | DATA | **Version selection algorithm incorrect**: Multi-criteria scoring (language, branch, numberSeries, accessGroup, customerGroup) returns wrong template version, causing financial documents to render with wrong branding/layout | 2 | 3 | 6 | Comprehensive unit tests for scoring algorithm with all criteria combinations; integration test with real DB records; test fallback to base template | Dev/QA | Sprint 1 |
| R-003 | PERF | **Puppeteer resource exhaustion**: Each PDF generation spawns headless Chrome; batch generation of 100+ documents could exhaust memory/CPU, causing OOM crashes or request timeouts beyond NFR3 (5s) | 2 | 3 | 6 | Pool Puppeteer browser instances (reuse pages, not browsers); set concurrency limit on BullMQ batch worker; add memory monitoring; test with 50+ concurrent generations | Dev | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-004 | DATA | Currency/number formatting inconsistency between Handlebars helpers and app formatters | 2 | 2 | 4 | Share formatting functions between frontend and template engine; test with multi-currency/locale scenarios | Dev |
| R-005 | TECH | Page break handling splits table rows or totals across pages incorrectly | 2 | 2 | 4 | Use CSS `break-inside: avoid` on table rows; test with 50+ line item documents | Dev |
| R-006 | BUS | Missing or malformed default template for any of 14 DocumentTypes blocks tenant from generating documents | 2 | 2 | 4 | Seed validation test: render every default template with sample data and verify PDF output | QA |
| R-007 | SEC | Cross-tenant document access if generated PDFs stored in S3 without proper companyId scoping | 1 | 3 | 3 | Reuse E8 attachment scoping patterns; companyId in S3 key path; integration test for cross-tenant denial | Dev |
| R-008 | TECH | BullMQ batch job fails mid-batch leaving partial results without tracking | 1 | 3 | 3 | Implement per-item success/failure tracking in batch job; test partial failure scenarios | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-009 | DATA | Conditional section logic errors when multiple branding toggles interact | 1 | 2 | 2 | Test all toggle combinations for representative document type |
| R-010 | OPS | Puppeteer Chrome binary version mismatch in deployment environment | 1 | 2 | 2 | Pin Puppeteer version; Docker image includes matching Chrome |
| R-011 | DATA | Seed script overwrites customized templates on re-run | 1 | 2 | 2 | Idempotent seed: skip if template with same documentType+name exists |
| R-012 | BUS | UK payroll templates (P45/P60/Payslip) non-compliant with HMRC formatting | 1 | 2 | 2 | Manual review against HMRC guidance; snapshot tests for layout stability |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Handlebars installed and configured in apps/api (already done — E10)
- [ ] Puppeteer installed in apps/api with headless Chrome binary
- [ ] DocumentTemplate and DocumentTemplateVersion Prisma models migrated
- [ ] DocumentType enum with all 14 values in Prisma schema
- [ ] CompanyProfile data available (logo, address, bank details) for sample data
- [ ] BullMQ infrastructure available (already done — E3/E10)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] All 14 default templates render valid PDFs with sample data
- [ ] Version selection algorithm tested with all criteria combinations
- [ ] Batch generation tested with 50+ documents without resource exhaustion

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority based on risk and criticality, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (≥6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Template injection prevention: `<script>`, `<iframe>`, event handlers stripped/disabled before Puppeteer renders | API | R-001 | 4 | QA | Test XSS vectors, JS disabled in page context, SafeString enforcement |
| Version selection algorithm: scoring produces correct winner for language, branch, numberSeries, accessGroup, customerGroup combinations | Unit + API | R-002 | 5 | QA | All criteria present, partial match, no match (fallback), priority tiebreak |
| Puppeteer concurrency/memory: concurrent PDF generation stays within resource limits | API | R-003 | 3 | QA | Single generation, 10 concurrent, 50+ batch with memory monitoring |
| POST /documents/generate: returns valid PDF for representative document types (invoice, statement, PO) | API | R-001, R-002 | 3 | QA | End-to-end: template selection → data fetch → Handlebars render → Puppeteer PDF |
| Batch generation: POST /documents/batch-generate handles partial failures, tracks per-item status | API | R-003, R-008 | 3 | QA | Happy path, partial failure, full failure, timeout handling |

**Total P0**: ~18 tests, ~15-25 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Template CRUD: create, read, update, delete with [documentType, name] unique constraint | API | - | 4 | QA | Unique violation, ADMIN role check, list with filters |
| Version management: create/update/delete versions; priority ordering; isActive toggle | API | R-002 | 4 | QA | Version CRUD, priority resolution, deactivation |
| Handlebars helpers: formatCurrency, formatDate, formatNumber produce correct output across locales | Unit | R-004 | 4 | QA | GBP, EUR, USD; UK date format; negative amounts; zero |
| Conditional sections: showLogo, showBankDetails, showVatNumber, showCompanyReg toggles render/omit correctly | Unit + API | R-009 | 3 | QA | Each toggle on/off; all-off edge case |
| Line item rendering: {{#each lines}} with correct subtotals, VAT breakdown, grand total | API | - | 3 | QA | 1 line, 10 lines, 50+ lines (page break trigger) |
| Page configuration: A4/Letter page size, portrait/landscape orientation, custom margins | API | R-005 | 3 | QA | Verify PDF metadata matches requested config |
| Template preview: POST /document-templates/:id/preview returns PDF with sample data | API | - | 2 | QA | Happy path, template with errors |
| Document-to-email: generate PDF and queue email with attachment via BullMQ | API | R-008 | 3 | QA | Mock SMTP; verify PDF attached to email job; BR-COM-010 fallback |

**Total P1**: ~26 tests, ~20-35 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Default template seeding: all 14 DocumentTypes seeded; idempotent on re-run | Integration | R-006, R-011 | 3 | QA | Verify count=14, re-seed doesn't duplicate, each renders valid PDF |
| Template HTML validation: reject malformed Handlebars syntax | Unit | - | 2 | QA | Missing closing tags, undefined helpers, syntax errors |
| Version selection fallback: base template returned when no version criteria match | Unit + API | R-002 | 2 | QA | No versions exist, all versions inactive, no criteria match |
| Company branding injection: logo URL, company address, bank details populated from CompanyProfile | API | - | 2 | QA | All branding fields present; partial CompanyProfile (some fields null) |
| Template management UI: CRUD operations, version list, preview button, HTML editor | E2E | - | 3 | QA | Create template, add version, preview, T7 Settings template compliance |
| companyId scoping: templates and generated PDFs scoped to correct tenant | API | R-007 | 2 | QA | Cross-tenant access denied for CRUD and generate endpoints |

**Total P2**: ~14 tests, ~5-10 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| PDF rendering performance: single generation <5s (NFR3) with 100-line item document | API | 2 | QA | Benchmark under load |
| UK payroll template visual check: Payslip/P45/P60 snapshot tests | API | 2 | QA | Visual regression via PDF-to-image comparison |
| Header/footer rendering: optional header/footer HTML applied correctly | API | 1 | QA | Custom header with page numbers |
| CSS override: per-version CSS applied on top of base template styles | Unit | 1 | QA | Verify CSS merge order |

**Total P3**: ~6 tests, ~2-4 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min; defer only if expensive/long-running.

| Trigger | What Runs | Time Budget |
| --- | --- | --- |
| **Every PR** | All P0 + P1 + P2 functional tests (unit, API, E2E) | ~10-15 min with Playwright parallelization |
| **Nightly** | P3 performance benchmarks, visual regression snapshots | ~15-30 min |
| **Weekly** | Batch stress test (50+ concurrent PDFs), full 14-type rendering sweep | ~30-60 min |

No complex tier structure needed — E12's test suite is small enough to run entirely on PRs.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours Range | Notes |
| --- | --- | --- | --- |
| P0 | ~18 | ~15-25 hours | Puppeteer setup, security vectors, batch reliability |
| P1 | ~26 | ~20-35 hours | Standard CRUD, helpers, conditional logic |
| P2 | ~14 | ~5-10 hours | Seeding, fallback, UI tests |
| P3 | ~6 | ~2-4 hours | Benchmarks, visual checks |
| **Total** | **~64** | **~42-74 hours** | **~1-2 weeks** |

### Prerequisites

**Test Data:**

- DocumentTemplate factory (faker-based, all 14 DocumentTypes)
- DocumentTemplateVersion factory (with selection criteria variants)
- Sample record data generators per document type (invoice, PO, statement, etc.)

**Tooling:**

- Puppeteer installed in apps/api (new dependency for E12)
- pdf-parse or similar library for PDF content assertions in tests
- Existing Handlebars setup from E10 (reusable)

**Environment:**

- Headless Chrome binary available in CI environment
- BullMQ + Redis for batch job testing (already available)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: ≥80% (template selection + PDF generation + batch)
- **Security scenarios**: 100% (template injection, cross-tenant)
- **Business logic**: ≥70% (version selection, helpers, conditional rendering)
- **Edge cases**: ≥50% (toggle combinations, formatting locales)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Performance target met: single PDF <5s (NFR3)

---

## Mitigation Plans

### R-001: Template Injection via Puppeteer (Score: 6)

**Mitigation Strategy:**
1. Disable JavaScript execution: `page.setJavaScriptEnabled(false)` before rendering
2. Sanitize HTML: strip `<script>`, `<iframe>`, `on*` event attributes before passing to Puppeteer
3. Run Puppeteer with `--no-sandbox` only in Docker; use `--disable-gpu` and restrict network access
4. Template validation on save: reject templates containing script tags or event handlers

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** P0 test suite includes XSS vector tests (script injection, event handler injection, iframe injection)

### R-002: Version Selection Algorithm Incorrect (Score: 6)

**Mitigation Strategy:**
1. Unit test the scoring function exhaustively: each criterion alone, combinations, edge cases
2. Integration test: create DB records with overlapping criteria, verify correct version selected
3. Test fallback: when no version matches, base template is used
4. Test priority tiebreaker: when two versions score equally, higher priority wins

**Owner:** Dev/QA
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Unit + API tests cover all criteria combinations and edge cases

### R-003: Puppeteer Resource Exhaustion (Score: 6)

**Mitigation Strategy:**
1. Pool browser instances: reuse pages within a browser, limit concurrent browsers
2. Set BullMQ concurrency limit on batch worker (e.g., 5 concurrent PDF jobs)
3. Add per-request timeout (e.g., 30s) to PDF generation
4. Monitor memory usage in production; alert on >80% memory utilization

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** P0 stress test: 50+ concurrent PDF requests; verify no OOM, all complete within timeout

---

## Assumptions and Dependencies

### Assumptions

1. Puppeteer can be installed in the apps/api Docker image with headless Chrome
2. Existing Handlebars helpers from E10 (formatCurrency, formatDate) can be reused for document templates
3. CompanyProfile data (logo, bank details, VAT number) is populated by the time E12 templates are used
4. BullMQ infrastructure from E3/E10 handles batch job queuing without modification

### Dependencies

1. **Puppeteer npm package** — Must be installed before E12.1 development begins
2. **DocumentTemplate + DocumentTemplateVersion Prisma models** — Must be migrated before API development
3. **CompanyProfile with branding fields** — Required for template rendering with company data
4. **E10 email infrastructure** — Required for document-to-email feature (E12 depends on E10)

### Risks to Plan

- **Risk**: Puppeteer Chrome binary too large for CI Docker image
  - **Impact**: CI pipeline fails or is very slow
  - **Contingency**: Use `puppeteer-core` with externally managed Chrome or switch to lightweight alternative (e.g., `pdf-lib` for simple templates)

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **E10 Email Integration** | Document-to-email uses E10's SMTP service to send PDFs | E10 email-send tests must pass; mock SMTP in E12 tests |
| **E8 Attachments (S3)** | Generated PDFs may be stored via E8's presigned URL pattern | E8 attachment scoping tests; verify companyId in S3 key |
| **E4 i18n** | formatCurrency/formatDate helpers must match E4 formatting | E4 formatting unit tests; E12 helper tests use same test data |
| **CompanyProfile (E1/E2)** | Template rendering pulls company branding from CompanyProfile | E1 model tests; verify CompanyProfile fields populated |
| **BullMQ (E3)** | Batch generation uses BullMQ job queuing | E3 event bus tests; E10 email queue tests |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: FR79, FR85; NFR2, NFR3, NFR41
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E12.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md` §2.12
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md` §2.4
- Data Models: `_bmad-output/planning-artifacts/data-models/3-module-by-module-models.md` §3.1

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

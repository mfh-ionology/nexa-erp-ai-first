---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-03-03'
---

# Test Design: Epic E8 - Attachments + Notes + Record Links

**Date:** 2026-03-03
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E8 — cross-cutting infrastructure services (Attachments, Notes, Record Links) and their UI components.

**Risk Summary:**

- Total risks identified: 9
- High-priority risks (score >= 6): 3
- Critical categories: SEC, DATA, TECH

**Coverage Summary:**

- P0 scenarios: 12 (~15-25 hours)
- P1 scenarios: 18 (~15-25 hours)
- P2 scenarios: 10 (~5-10 hours)
- P3 scenarios: 4 (~1-3 hours)
- **Total effort**: ~36-63 hours (~1-2 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **S3/MinIO infrastructure provisioning** | Infrastructure setup is DevOps responsibility, not application testing | Assume MinIO is running for local dev; S3 for staging/prod |
| **Email notification on attachment upload** | No email events defined in E8 event catalog | Covered when notification epic is implemented |
| **Customer-facing portal for notes** | CUSTOMER_VISIBLE note type is stored but portal is a separate epic | Type filtering is tested; portal rendering deferred |
| **Auto-link creation via event handlers** | E8.3 defines the model; event-driven link creation depends on business module events (Sales, Purchasing) not yet built | Manual link CRUD is fully tested; auto-links tested when business modules ship |

---

## Risk Assessment

> **Note:** P0/P1/P2/P3 below refer to priority classification, NOT execution timing. See Execution Strategy for when tests run.

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | Presigned URL leakage — URLs may be guessable, intercepted, or reused beyond intended scope | 2 | 3 | 6 | Enforce short TTL (15 min), single-use constraint, validate content-type on S3 PUT policy | Dev | Sprint 0 |
| R-002 | SEC | Executable file bypass — MIME type spoofing could allow .exe/.bat upload despite allowlist | 2 | 3 | 6 | Validate both Content-Type header and file extension; consider magic-byte check on confirm | Dev | Sprint 0 |
| R-003 | DATA | Orphaned S3 objects — if confirm fails or delete partially succeeds, S3 objects remain without DB records | 2 | 3 | 6 | Wrap delete in transaction; add S3 cleanup job for unconfirmed uploads older than 24h | Dev | Sprint 1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-004 | DATA | Polymorphic entity validation gap — entityType/entityId has no DB FK, relying on application-layer check (BR-SYS-013) | 2 | 2 | 4 | Service layer validates entity existence before creating attachment/note/link; comprehensive API tests for invalid entity refs |
| R-005 | TECH | Bidirectional link query performance — OR-based query (sourceEntity OR targetEntity) may not use indexes efficiently | 2 | 2 | 4 | Add composite indexes on (sourceEntityType, sourceEntityId) and (targetEntityType, targetEntityId); test with 1000+ links per entity |
| R-006 | BUS | Note type enforcement — SYSTEM notes created by user API bypasses intended restriction | 2 | 2 | 4 | API layer rejects noteType=SYSTEM from user requests; service-only method for system notes |
| R-007 | TECH | Presigned URL expiry race condition — user starts upload just before URL expires, upload fails mid-transfer | 1 | 2 | 2 | Set generous TTL for PUT URLs (30 min vs 15 min for GET); frontend retry with fresh URL |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-008 | OPS | MinIO/S3 configuration mismatch between dev and prod | 1 | 2 | 2 | Document config; integration test with MinIO in CI |
| R-009 | BUS | Link type enum extensibility — adding new link types requires code change | 1 | 1 | 1 | Monitor; future: make configurable via SystemSetting |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] E6 (Frontend Shell) completed and merged
- [ ] Prisma schema includes Attachment, Note, RecordLink models
- [ ] S3/MinIO client configured in API service
- [ ] Test environment has MinIO running (docker-compose)
- [ ] Test data factories for Company, User, and at least one business entity (e.g., Invoice stub) available

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or failures triaged (>= 95%)
- [ ] No open high-severity bugs related to file upload security or data integrity
- [ ] Presigned URL security tests pass (R-001, R-002)
- [ ] Orphan cleanup mechanism verified (R-003)

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core functionality + High risk (>= 6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E8.1-API-001 | Presigned URL generation with MIME validation (AC #1) | API | R-001, R-002 | Validate allowlist enforcement, reject executables |
| E8.1-API-002 | Reject executable file types (.exe, .bat, .sh) (AC #5) | API | R-002 | MIME spoofing: send valid MIME header with executable extension |
| E8.1-API-003 | File size limit enforcement via SystemSetting (AC #1) | API | R-001 | Test at boundary: exactly 50MB, 50MB+1 |
| E8.1-API-004 | Attachment confirm with entity validation (AC #3) | API | R-004 | Confirm requires S3 object exists + entity exists (BR-SYS-009) |
| E8.1-API-005 | Attachment delete removes S3 object + DB record (AC #6) | API | R-003 | Verify both artifacts removed; check for orphans |
| E8.1-API-006 | Presigned download URL with expiry (AC #4) | API | R-001 | Verify URL expires after configured TTL |
| E8.2-API-001 | SYSTEM note type rejected from user API (AC #4) | API | R-006 | User cannot create SYSTEM notes via API |
| E8.2-API-002 | Note CRUD with polymorphic entity validation (AC #1) | API | R-004 | Invalid entityType/entityId rejected (BR-SYS-013) |
| E8.3-API-001 | Record link creation with dual entity validation (AC #1) | API | R-004 | Both source and target entities validated |
| E8.3-API-002 | Bidirectional link retrieval (AC #3) | API | R-005 | Record appears as both source and target |
| E8.3-API-003 | System-generated link delete requires MANAGER role (AC #5) | API | R-006 | STAFF cannot delete system links, MANAGER can |
| E8.1-UNIT-001 | MIME type allowlist validation logic | Unit | R-002 | Pure function: isAllowedMimeType() |

**Total P0**: 12 tests, ~15-25 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E8.1-API-007 | List attachments filtered by entityType + entityId (AC #3) | API | - | Standard list filtering |
| E8.1-API-008 | companyId scoping — cannot access other company's attachments | API | R-001 | Multi-tenant isolation |
| E8.2-API-003 | Notes returned in reverse chronological order (AC #5) | API | - | Verify ordering |
| E8.2-API-004 | Pinned notes appear at top regardless of date (AC #5) | API | - | Pin/unpin toggle |
| E8.2-API-005 | Update own note content (non-SYSTEM only) | API | R-006 | SYSTEM notes immutable |
| E8.2-API-006 | Soft delete note — MANAGER role required | API | - | RBAC enforcement |
| E8.2-API-007 | Filter notes by noteType (GENERAL, INTERNAL, CUSTOMER_VISIBLE) | API | - | Enum filtering |
| E8.2-API-008 | companyId scoping — cannot access other company's notes | API | - | Multi-tenant isolation |
| E8.3-API-004 | Manual link deletion by STAFF role | API | - | STAFF can delete manual links |
| E8.3-API-005 | companyId scoping — cannot access other company's links | API | - | Multi-tenant isolation |
| E8.3-API-006 | Link type validation against RecordLinkType enum | API | - | Invalid type rejected |
| E8.4-E2E-001 | Attachment panel: drag-drop upload flow (AC #1, #2) | E2E | R-001 | Presign -> upload -> confirm -> list refresh |
| E8.4-E2E-002 | Notes panel: add note with type selector (AC #3, #4) | E2E | - | Timeline view, type badge colours |
| E8.4-E2E-003 | Links panel: view grouped by link type (AC #5) | E2E | - | Navigation links to related records |
| E8.4-E2E-004 | Attachment download via presigned URL (AC #1) | E2E | R-001 | Click download, verify file received |
| E8.4-E2E-005 | Attachment delete from panel (MANAGER only) | E2E | - | Delete action, RBAC check |
| E8.4-E2E-006 | ActionBar integration — Attachments button opens panel | E2E | - | Persistent tool zone |
| E8.4-E2E-007 | ActionBar integration — Links button opens panel | E2E | - | Persistent tool zone |

**Total P1**: 18 tests, ~15-25 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| E8.1-API-009 | Upload with content-type mismatch (header vs actual file) | API | R-002 | Edge case: correct extension but wrong content |
| E8.1-API-010 | Confirm with non-existent S3 object | API | R-003 | Verify rejection when file not at expected key |
| E8.2-API-009 | Create note on non-existent entity (BR-SYS-013) | API | R-004 | Graceful 404 error |
| E8.2-API-010 | Empty content note creation | API | - | Validation: content required |
| E8.3-API-007 | Self-referencing link (source = target) | API | - | Should be rejected or allowed per business rules |
| E8.3-API-008 | Duplicate link prevention (same source, target, type) | API | - | Unique constraint or idempotent create |
| E8.4-E2E-008 | Upload progress indicator visible during transfer | E2E | - | UX verification |
| E8.4-E2E-009 | Manual link creation via entity search dialog | E2E | - | "Add Link" button flow |
| E8.1-UNIT-002 | File extension extraction and validation | Unit | R-002 | Edge cases: no extension, double extension |
| E8.3-UNIT-001 | Direction indicator logic (outgoing/incoming) | Unit | R-005 | Pure function |

**Total P2**: 10 tests, ~5-10 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| E8.3-PERF-001 | Bidirectional link query with 1000+ links per entity | API | Performance benchmark for R-005 |
| E8.1-PERF-001 | Concurrent presigned URL generation (10+ requests) | API | Throughput check |
| E8.4-E2E-010 | Notes timeline view with 50+ notes (scroll/pagination) | E2E | UX performance |
| E8.4-E2E-011 | Attachment panel with 20+ files (list rendering) | E2E | UX performance |

**Total P3**: 4 tests, ~1-3 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. With Playwright parallelization, 44 tests should complete in under 10 minutes.

| Execution Tier | What Runs | Estimated Time |
|---------------|-----------|----------------|
| **Every PR** | All P0 + P1 + P2 tests (API + E2E + Unit) | ~8-12 min |
| **Nightly** | P3 performance benchmarks | ~5-10 min |

No separate smoke/P0/P1 tiers needed — the full suite is fast enough for PR execution.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | 12 | ~15-25 hours | Security + data integrity focus, S3 mock setup |
| P1 | 18 | ~15-25 hours | Standard CRUD + E2E panels |
| P2 | 10 | ~5-10 hours | Edge cases, validation |
| P3 | 4 | ~1-3 hours | Performance benchmarks |
| **Total** | **44** | **~36-63 hours** | **~1-2 weeks** |

### Prerequisites

**Test Data:**

- Company + User factory (exists from E0/E1)
- Attachment factory (fileName, mimeType, fileSize overrides)
- Note factory (entityType, entityId, noteType overrides)
- RecordLink factory (source/target entity overrides, linkType)
- Stub business entity (e.g., Invoice or SalesOrder ID) for polymorphic references

**Tooling:**

- MinIO container in docker-compose for S3 emulation
- S3 test helper: `createTestBucket()`, `assertObjectExists()`, `cleanupBucket()`
- Presigned URL assertion helper (validate URL structure, expiry)

**Environment:**

- MinIO running on localhost for local dev and CI
- Test database seeded with at least one company + user + stub entity

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths** (upload/download/delete): >= 80%
- **Security scenarios** (presigned URL, MIME validation): 100%
- **Business logic** (polymorphic validation, note types, link types): >= 70%
- **Edge cases**: >= 50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>= 6) items unmitigated
- [ ] Security tests (SEC category: R-001, R-002) pass 100%
- [ ] Data integrity tests (DATA category: R-003, R-004) pass 100%

---

## Mitigation Plans

### R-001: Presigned URL Leakage (Score: 6)

**Mitigation Strategy:**
1. Set presigned GET URL TTL to 15 minutes (configurable)
2. Set presigned PUT URL TTL to 30 minutes
3. Enforce content-type constraint in S3 PUT policy
4. Presigned URLs use unique S3 keys with UUID prefix

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** API tests validate URL expiry; E2E test confirms download fails after TTL

### R-002: Executable File Bypass via MIME Spoofing (Score: 6)

**Mitigation Strategy:**
1. Validate both MIME type and file extension against allowlist (BR-SYS-007)
2. Reject files with executable extensions regardless of Content-Type header
3. Allowlist: PDF, images (png/jpg/gif/webp/svg), Office docs (docx/xlsx/pptx), CSV, TXT

**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** API tests with spoofed headers; unit tests for validation logic

### R-003: Orphaned S3 Objects (Score: 6)

**Mitigation Strategy:**
1. Wrap attachment delete in DB transaction — rollback if S3 delete fails
2. On confirm, verify S3 object exists before creating DB record
3. Background job: clean up unconfirmed S3 objects older than 24 hours

**Owner:** Dev
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** API test: simulate S3 delete failure, verify DB record retained; verify cleanup job logic

---

## Assumptions and Dependencies

### Assumptions

1. MinIO is API-compatible with S3 for presigned URL operations
2. Polymorphic entity validation (BR-SYS-013) can be implemented with a registry of valid entityType strings (BR-SYS-014)
3. Existing RBAC middleware from E3/E4 handles role-based access (STAFF, MANAGER) for all E8 endpoints
4. UI components (AttachmentPanel, NotesPanel, LinksPanel) integrate with existing ActionBar from E7

### Dependencies

1. **E6 Frontend Shell** — must be complete (provides ActionBar, record detail pages)
2. **Prisma schema** — Attachment, Note, RecordLink models must be migrated
3. **MinIO Docker container** — must be added to docker-compose for dev/CI
4. **Stub business entity** — at least one entity type (e.g., Invoice) must exist for polymorphic reference testing

### Risks to Plan

- **Risk**: MinIO configuration drifts from S3 behaviour in edge cases (multipart upload, CORS)
  - **Impact**: Tests pass locally but fail in staging/production
  - **Contingency**: Run a subset of S3-specific tests against real S3 in staging pipeline

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **RBAC Middleware (E3/E4)** | E8 endpoints use role checks (STAFF, MANAGER) | Existing RBAC tests must still pass |
| **ActionBar (E7)** | Attachment/Links buttons added to persistent tools zone | E7 toolbar tests must verify new buttons don't break layout |
| **Prisma Client (E0)** | New models added to schema | Migration must not break existing models; existing queries unaffected |
| **Event Bus (E1)** | CASCADE_DELETE events for cross-cutting cleanup (BR-SYS-010) | Event bus tests remain green |
| **S3/MinIO Client** | New integration — no prior tests | Covered by E8 test suite |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E8.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/` (Section 2.5: Cross-cutting Infrastructure)
- Data Models: `_bmad-output/planning-artifacts/data-models/` (Section 3.9: Cross-Cutting Module)
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (BR-SYS-006 to BR-SYS-014)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

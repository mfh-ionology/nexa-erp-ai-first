---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-04'
---

# Test Design: Epic E10 — Email Integration

**Date:** 2026-03-04
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E10 — Email Integration

E10 implements outbound email integration for Nexa ERP, enabling reliable delivery of transactional emails (invoices, statements, POs, notifications) via configurable per-company SMTP settings. The epic consists of 3 stories: SMTP Outbound Service (E10.1), Email Template Management (E10.2), and Document-to-Email (E10.3). Key concerns include SMTP retry reliability, multi-tenant SMTP isolation, Handlebars template security, and PDF attachment integrity via S3 presign flow.

**Risk Summary:**

- Total risks identified: 11
- High-priority risks (≥6): 4
- Critical categories: SEC (2), TECH (1), DATA (1)

**Coverage Summary:**

- P0 scenarios: 10 (~15–25 hours)
- P1 scenarios: 16 (~15–25 hours)
- P2 scenarios: 10 (~5–10 hours)
- P3 scenarios: 4 (~1–3 hours)
- **Total effort**: ~36–63 hours (~1–2 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Inbound email (IMAP)** | Deferred to Phase 2 per project-context.md §6 | Not needed for MVP; no risk to outbound testing |
| **Email campaigns / mass mail (BR-COM-011)** | Not part of E10 stories; marketing module deferred | Campaign state machine tested when implemented |
| **Conference rooms / chat (BR-COM-006–008, 012)** | Separate communications subsystem, not in E10 | Own epic with separate test design |
| **Push notification channel** | Stub only in E9 dispatch worker; not in E10 | Covered by E9 test design |
| **PDF generation engine (E12)** | E10.3 depends on E12 for PDF; E12 tested separately | Mock PDF generation in E10 tests; integration tested post-E12 |
| **Auto-reply loop prevention (BR-COM-004, 005)** | Not triggered by outbound-only MVP scope | Monitor; test when inbound email implemented |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | SEC | Per-company SMTP credentials leaked cross-tenant — wrong company's SMTP config loaded due to companyId scoping bug | 2 | 3 | 6 | Strict companyId filtering on SystemSettings query; integration test: Company A send uses Company A SMTP only; credential encryption at rest | Dev | Sprint E10.1 |
| R-002 | SEC | Handlebars template injection — malicious template content executes arbitrary code via prototype pollution or helper abuse | 2 | 3 | 6 | Use Handlebars strict mode; whitelist known helpers only; sanitize rendered HTML output; unit test with XSS payloads | Dev | Sprint E10.2 |
| R-003 | TECH | Email worker crashes between status update and event emission — email marked SENT but email.sent event never fires, breaking CRM activity creation and audit | 2 | 3 | 6 | Emit event before updating status (event-first); BullMQ job ack only after both complete; idempotent event handlers | Dev | Sprint E10.1 |
| R-004 | DATA | Orphaned S3 objects from failed document-to-email — PDF uploaded to S3 but email send fails, leaving unreferenced S3 objects | 2 | 3 | 6 | Cleanup job for unconfirmed presign uploads (>24h); track attachment state; integration test: failed email → S3 object cleaned up | Dev | Sprint E10.3 |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-005 | TECH | BullMQ retry timing drift — exponential backoff (30s, 120s, 300s) not precise due to Redis delay or worker restart | 2 | 2 | 4 | Tolerance-based assertions (±5s); BullMQ built-in backoff config | Dev |
| R-006 | DATA | Email signature double-append on retry (BR-COM-009) — signature appended again when worker retries a failed send | 2 | 2 | 4 | Track signature-appended flag on EmailMessage; check before append | Dev |
| R-007 | BUS | Template variable resolution fails silently — unknown variable renders as empty string instead of error | 1 | 3 | 3 | Handlebars strict mode throws on unknown vars; validate variables against document type schema at save time | Dev |
| R-008 | TECH | Batch statement job overwhelms queue — 1000+ customers triggers queue overload | 1 | 3 | 3 | Paginate batch processing (100 at a time); queue depth monitoring; rate limiting | Dev |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-009 | OPS | SMTP config missing or invalid for company — no SMTP settings configured, emails fail immediately | 1 | 2 | 2 | Graceful error message; admin alert; test: missing config → descriptive error |
| R-010 | BUS | Email delivery tracking gap — SMTP accepts email but downstream delivery bounces (no webhook) | 1 | 2 | 2 | Monitor; bounce handling deferred to Phase 2 |
| R-011 | TECH | Nodemailer TLS certificate rejection in dev — self-signed cert on dev SMTP server causes connection failure | 1 | 1 | 1 | Dev env: rejectUnauthorized=false; prod: true; config flag |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Communications module Prisma models migrated (EmailMessage, EmailRecipient, EmailQueue, EmailTemplate)
- [ ] BullMQ + Redis operational (dev: Docker; CI: service container)
- [ ] Mock SMTP server available (Mailpit or Ethereal for dev/CI)
- [ ] S3/MinIO operational with presign endpoints functional (from E8)
- [ ] Event bus operational with email.sent event registered (from E3)
- [ ] NumberSeries seeded for EmailMessage (EM-xxxxx)
- [ ] E9 notification dispatch infrastructure available (BullMQ patterns, email sender service)
- [ ] At least one test company with SMTP settings seeded in SystemSettings

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (≥95% or failures triaged)
- [ ] No open high-priority / high-severity bugs
- [ ] Business rules BR-COM-001, 002, 003, 009, 010, 015 verified
- [ ] State machine transitions (DRAFT → QUEUED → SENT/FAILED) validated
- [ ] Multi-tenant SMTP isolation confirmed (Company A ≠ Company B)
- [ ] email.sent event emission verified end-to-end

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority classification based on risk and business impact, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core email delivery + High risk (≥6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E10.1-API-001 | SMTP send happy path: DRAFT → QUEUED → SENT with correct state transitions | API | R-003 | Verify EmailMessage + EmailQueue status updates, sentAt timestamp, email.sent event emitted |
| E10.1-API-002 | Retry with exponential backoff: transient SMTP error triggers 3 retries (30s, 120s, 300s) then FAILED | API | R-005 | BullMQ retry config; verify attempts increment, nextRetryAt calculated, final FAILED state |
| E10.1-API-003 | Per-company SMTP isolation: Company A uses Company A's SMTP settings, not Company B's | API | R-001 | Multi-tenant SMTP config loading; critical security boundary |
| E10.1-API-004 | Permanent SMTP failure (550): immediate FAILED, no retry | API | R-003 | Hard bounce → EmailQueue.status = FAILED; lastError populated |
| E10.1-UNIT-001 | Recipient validation (BR-COM-001): valid/invalid RFC 5322 addresses; internal userId lookup | Unit | — | Edge cases: consecutive dots, missing domain, unicode, max-length |
| E10.1-API-005 | Duplicate recipient rejection (BR-COM-002): same (emailAddress, recipientType) per message blocked | API | — | DB unique constraint + service-layer validation |
| E10.1-API-006 | Cannot un-send (BR-COM-003): QUEUED/SENT → DRAFT transition rejected | API | — | State machine guard; 400 response |
| E10.2-API-001 | Handlebars template injection prevention (R-002): XSS payloads in template body sanitized | API | R-002 | Strict mode; test: `{{constructor.prototype}}`, `<script>`, `{{#with __proto__}}` |
| E10.3-API-001 | Document-to-email: POST /documents/email creates EmailMessage, attaches PDF via S3 presign, queues for send | API | R-004 | Full pipeline: template resolution → PDF attachment → queue → send |
| E10.3-API-002 | RecordLink created between EmailMessage and source document on email send | API | — | Verify RecordLink { type: RELATES_TO } persisted |

**Total P0**: 10 tests, ~15–25 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3–4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E10.1-API-007 | Email creation service: create EmailMessage + EmailRecipient records, queue via EmailQueue | API | — | CRUD correctness; verify all fields populated |
| E10.1-API-008 | Signature appended once on retry (BR-COM-009): signature not double-appended when worker retries | API | R-006 | Flag tracking; verify body unchanged on 2nd attempt |
| E10.1-API-009 | Email inbox endpoint: GET /email/inbox with pagination, status filter, search | API | — | Standard CRUD; companyId scoping |
| E10.1-API-010 | Mark as read / archive: PATCH /email/messages/:id/read, DELETE soft/hard | API | — | Per-recipient status update |
| E10.2-API-002 | Template CRUD: create, read, update, delete with ADMIN role enforcement | API | — | Role guard; field validation |
| E10.2-API-003 | Template variable validation: known variables for documentType accepted, unknown rejected | API | R-007 | Handlebars strict mode; per-document-type variable whitelist |
| E10.2-API-004 | Template preview: POST /email/templates/:id/preview renders with sample data | API | — | Rendered subject + bodyHtml returned |
| E10.2-UNIT-001 | Handlebars compilation: valid syntax compiles, invalid syntax (unclosed `{{`) returns descriptive error | Unit | — | Compile-time validation on save |
| E10.2-API-005 | Fallback to system default template (BR-COM-010): no custom template → system default used | API | — | Fallback chain: custom → system default → error |
| E10.3-API-003 | CC/BCC recipients: email dialog adds CC/BCC, EmailRecipient rows created with correct types | API | — | Multiple recipient types per message |
| E10.3-API-004 | Template merging with record data: Handlebars variables resolved from source document fields | API | — | {{customer.name}}, {{invoice.number}} etc. |
| E10.3-API-005 | Batch statement emailing: POST /ar/reports/statements/batch creates BullMQ job, processes customers | API | R-008 | Job creation + status tracking |
| E10.3-API-006 | Recipient override: recipientOverrides in POST /documents/email replaces default recipient | API | — | Override TO, keep CC/BCC |
| E10.3-API-007 | Invalid document type: POST /documents/email with unknown type → 400 | API | — | Validation; descriptive error |
| E10.3-API-008 | Missing source document: POST /documents/email with non-existent recordId → 404 | API | — | Entity existence check |
| E10.1-API-011 | Event emission: email.sent event fired with correct payload after successful SMTP delivery | API | R-003 | Event bus integration; payload schema validation |

**Total P1**: 16 tests, ~15–25 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1–2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E10.1-UNIT-002 | SMTP config missing: company without SMTP settings → descriptive error, not crash | Unit | R-009 | Graceful degradation |
| E10.1-API-012 | CompanyId scoping: EmailMessage filtered by user's visibleCompanyIds | API | — | Multi-company isolation |
| E10.2-API-006 | Template per language: resolve template by (documentType, languageCode) with fallback to "en" | API | — | Language resolution chain |
| E10.2-API-007 | Template autoSend flag: autoSend=true → skip DRAFT, go directly to QUEUED | API | — | Template behaviour toggle |
| E10.2-API-008 | Template attachPdf flag: attachPdf=false → no PDF generated/attached | API | — | Template behaviour toggle |
| E10.3-API-009 | S3 presign attachment flow (BR-COM-015): PDF uploaded via presign, not inline base64 | API | R-004 | Architecture constraint; no inline storage |
| E10.1-API-013 | Email alias CRUD: create, read, update, delete aliases with ADMIN role | API | — | Basic CRUD |
| E10.1-API-014 | Email signature CRUD: GET/PUT per-user signature | API | — | One signature per user |
| E10.2-UNIT-002 | System default templates seeded: all 7 document types have system defaults | Unit | — | Seed data verification |
| E10.3-E2E-001 | Document detail → "Email" action → composition dialog → send confirmation | E2E | — | Frontend integration; pre-filled fields |

**Total P2**: 10 tests, ~5–10 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Test ID | Requirement | Test Level | Notes |
| ------- | ----------- | ---------- | ----- |
| E10.1-PERF-001 | BullMQ throughput: process 100 emails in <30 seconds | API | Performance benchmark |
| E10.1-PERF-002 | Queue isolation: one failed email doesn't block others | API | Worker concurrency |
| E10.3-PERF-001 | Batch email: 50 statements generated and queued in <60 seconds | API | Batch performance |
| E10.3-E2E-002 | Multi-company email flow: switch company → send email → verify correct SMTP used | E2E | Exploratory cross-tenant |

**Total P3**: 4 tests, ~1–3 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running.

| Timing | What Runs | Duration |
| ------ | --------- | -------- |
| **Every PR** | All P0 + P1 + P2 functional tests (Playwright API + Unit via Vitest) | ~10–15 min |
| **Nightly** | P3 performance benchmarks (BullMQ throughput, batch processing) | ~5–10 min |

Playwright parallelization handles 40 tests in under 15 minutes. No complex tier structure needed.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Effort Range | Notes |
| -------- | ----- | ------------ | ----- |
| P0 | 10 | ~15–25 hours | SMTP retry, security, state machine — complex setup |
| P1 | 16 | ~15–25 hours | Standard CRUD, template management, composition |
| P2 | 10 | ~5–10 hours | Edge cases, config, E2E dialog |
| P3 | 4 | ~1–3 hours | Performance benchmarks |
| **Total** | **40** | **~36–63 hours** | **~1–2 weeks** |

### Prerequisites

**Test Data:**
- Email message factory (faker-based: subject, body, recipients)
- SMTP config factory (per-company settings)
- Email template factory (Handlebars templates per document type)
- Document factory (CustomerInvoice, SalesOrder mock records for document-to-email)

**Tooling:**
- Mailpit or Ethereal for SMTP mocking in dev/CI
- BullMQ test utilities (job completion listeners)
- MinIO for S3 presign testing (from E8 infrastructure)

**Environment:**
- Redis running for BullMQ queues
- PostgreSQL with Communications module migrations applied
- MinIO/S3 with presign endpoints
- Mock SMTP server accessible from worker

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: ≥80% (SMTP send, retry, template resolution, document-to-email)
- **Security scenarios**: 100% (SMTP isolation, template injection, credential protection)
- **Business rules**: 100% (BR-COM-001, 002, 003, 009, 010, 015)
- **State machine transitions**: 100% (all DRAFT → QUEUED → SENT/FAILED paths)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (R-001, R-002) pass 100%
- [ ] State machine lifecycle validated (DRAFT → QUEUED → SENT, DRAFT → QUEUED → FAILED)
- [ ] Per-company SMTP isolation verified

---

## Mitigation Plans

### R-001: Per-Company SMTP Credential Leakage (Score: 6)

**Mitigation Strategy:**
1. SystemSettings query always filters by authenticated user's companyId
2. SMTP credentials encrypted at rest (AES-256)
3. No plaintext credentials in logs (mask in logger middleware)
4. Integration test: seed 2 companies with different SMTP configs; send from each; assert different SMTP hosts used

**Owner:** Dev
**Timeline:** Sprint E10.1
**Status:** Planned
**Verification:** E10.1-API-003 passes; code review confirms companyId filter on config query

### R-002: Handlebars Template Injection (Score: 6)

**Mitigation Strategy:**
1. Enable Handlebars `strict` mode (throws on unknown variables)
2. Whitelist only registered helpers (no custom helper registration by users)
3. Sanitize rendered HTML output via `sanitize-html` before storing
4. Unit tests with XSS payloads: `<script>alert(1)</script>`, `{{constructor.prototype}}`, `{{#with __proto__}}`

**Owner:** Dev
**Timeline:** Sprint E10.2
**Status:** Planned
**Verification:** E10.2-API-001 passes; security review of template rendering pipeline

### R-003: Worker Crash Between Status Update and Event Emission (Score: 6)

**Mitigation Strategy:**
1. Use event-first pattern: emit email.sent before updating EmailMessage.status to SENT
2. BullMQ job ack only after both event emission and status update complete
3. Idempotent event handlers (CRM activity creation checks for existing activity)
4. Integration test: simulate crash after event emit but before status update; verify recovery

**Owner:** Dev
**Timeline:** Sprint E10.1
**Status:** Planned
**Verification:** E10.1-API-001 and E10.1-API-011 pass; audit log shows event for every SENT email

### R-004: Orphaned S3 Objects from Failed Document-to-Email (Score: 6)

**Mitigation Strategy:**
1. Track attachment confirmation state (PENDING → CONFIRMED)
2. Scheduled cleanup job: delete unconfirmed attachments older than 24 hours
3. On email send failure, mark attachment for cleanup
4. Integration test: failed email → verify S3 object eventually cleaned up

**Owner:** Dev
**Timeline:** Sprint E10.3
**Status:** Planned
**Verification:** E10.3-API-001 passes; cleanup job test verifies orphan removal

---

## Assumptions and Dependencies

### Assumptions

1. BullMQ + Redis infrastructure is stable and available in all environments (dev, CI, staging)
2. Nodemailer handles SMTP protocol correctly (library-level testing not our concern)
3. PDF generation (E12) will be available or mockable by the time E10.3 is implemented
4. Per-company SMTP configuration will be stored in SystemSettings with companyId scoping
5. Existing email sender service from E9 (Nodemailer wrapper) can be reused for E10

### Dependencies

1. **E3 (Event Bus)** — email.sent event registration and emission — Required before E10.1
2. **E8 (Attachments)** — S3 presign flow for PDF attachments — Required before E10.3
3. **E9 (Notifications)** — BullMQ patterns, email sender service reuse — Required before E10.1
4. **E12 (Document Templates)** — PDF generation for document-to-email — Required before E10.3 (can mock)
5. **NumberSeries** — EM-xxxxx series for EmailMessage.messageNumber — Required before E10.1

### Risks to Plan

- **Risk**: E12 (Document Templates) not complete when E10.3 starts
  - **Impact**: Cannot test real PDF generation in document-to-email flow
  - **Contingency**: Mock PDF generation service; test integration post-E12

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **Event Bus (E3)** | email.sent event emission | Existing event bus tests must pass; new event registered |
| **Attachments (E8)** | S3 presign flow for PDF attachments | E8 presign/confirm tests must pass |
| **Notifications (E9)** | Reuses email sender service and BullMQ patterns | E9 dispatch worker tests must pass |
| **NumberSeries (E1)** | EM-xxxxx series generation | E1 number series concurrency tests must pass |
| **RBAC (E2b)** | ADMIN role guard on template endpoints | E2b permission guard tests must pass |
| **CRM (future)** | email.sent triggers Activity creation | Activity creation handler tested separately |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0-P3 prioritization

### Related Documents

- PRD: FR187 (email sending), FR188 (document-to-email), FR189 (email templates); NFR31 (retry backoff)
- Epic: `_bmad-output/implementation-artifacts/epics/epic-E10.md`
- Architecture: §7 Infrastructure (BullMQ workers, SMTP adapter)
- API Contracts: §2.25 Communications (email endpoints)
- Data Models: §3.18 Communications Module (EmailMessage, EmailRecipient, EmailQueue, EmailTemplate)
- State Machine: §17.1 EmailMessage Status (DRAFT → QUEUED → SENT/FAILED/BOUNCED)
- Event Catalog: §14 Communications Events (email.sent)
- Business Rules: §13 (BR-COM-001 through BR-COM-015)

### Existing Infrastructure (Reusable from E9)

- `apps/api/src/modules/communications/email/email-sender.service.ts` — Nodemailer wrapper (8 tests)
- `apps/api/src/modules/communications/email/notification-email-template.ts` — HTML rendering (7 tests)
- `apps/api/src/modules/communications/notifications/notification-dispatch.queue.ts` — BullMQ queue patterns
- `apps/api/src/modules/communications/notifications/notification-dispatch.worker.ts` — Worker patterns

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)

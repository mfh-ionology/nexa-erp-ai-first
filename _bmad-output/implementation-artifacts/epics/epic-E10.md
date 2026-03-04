# Epic E10: Email Integration

**Tier:** 1 | **Dependencies:** E9 (Notifications) | **FRs:** FR187-FR189 | **NFRs:** NFR31 (retry with exponential backoff)

---

## Story E10.1: SMTP Outbound Service

**User Story:** As a system, I want a reliable email queue with SMTP sending, retry logic, and delivery status tracking, so that business emails (invoices, notifications, PO confirmations) are delivered reliably.

**Acceptance Criteria:**
1. GIVEN an email is queued for sending WHEN the SMTP worker processes it THEN it sends via the configured per-company SMTP settings (host, port, auth)
2. GIVEN an email send fails WHEN the SMTP server returns an error THEN the system retries with exponential backoff (30s, 120s, 300s) up to 3 attempts
3. GIVEN all retry attempts are exhausted WHEN the email still fails THEN the EmailQueue status is set to FAILED and an alert is raised
4. GIVEN an email is sent successfully WHEN the SMTP server accepts it THEN the EmailMessage status is updated to SENT and the EmailQueue record is marked SENT with timestamp
5. GIVEN per-company SMTP configuration WHEN Company A sends an email THEN it uses Company A's SMTP settings, not a shared server

**Key Tasks:**
- [ ] Implement email queue system using BullMQ (AC: #1, #2, #3)
  - [ ] `email-send.worker.ts` in `api/src/workers/`
  - [ ] Process EmailQueue records with PENDING status
  - [ ] Retry configuration: 3 attempts, exponential backoff
- [ ] Implement SMTP sending via Nodemailer (AC: #1, #5)
  - [ ] Load per-company SMTP config from SystemSettings or CompanyProfile
  - [ ] Support TLS/STARTTLS
  - [ ] Handle auth (username/password, OAuth2 for Gmail/O365)
- [ ] Implement delivery status tracking (AC: #3, #4)
  - [ ] Update EmailMessage.status: QUEUED -> SENT / FAILED
  - [ ] Update EmailQueue.queueStatus: PENDING -> PROCESSING -> SENT / FAILED / RETRYING
  - [ ] Store error details on failure
- [ ] Implement email creation service (AC: #1)
  - [ ] Create EmailMessage and EmailRecipient records
  - [ ] Queue email via EmailQueue
  - [ ] Validate recipients (BR-COM-001)
  - [ ] Prevent duplicate recipients per message (BR-COM-002)

**FR/NFR:** FR187; NFR31

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §7 Infrastructure | BullMQ workers, SMTP adapter |
| API Contracts | §2.25 Communications | CRUD /email/messages, POST /email/messages/:id/send |
| Data Models | §3.18 Communications Module | EmailMessage (status enum), EmailRecipient (type enum), EmailQueue (queueStatus enum) |
| State Machines | §17.1 EmailMessage Status | DRAFT -> QUEUED -> SENT / FAILED / BOUNCED |
| Event Catalog | §14 Communications Events | `email.sent` event after successful send |
| Business Rules | §13 Communications Rules | BR-COM-001 (recipient validation), BR-COM-002 (no duplicates), BR-COM-003 (no un-send), BR-COM-009 (signature once) |
| UX Design Spec | N/A | N/A — backend service |
| Project Context | §6 Email Integration | SMTP outbound only for MVP, inbound (IMAP) deferred |

---

## Story E10.2: Email Template Management

**User Story:** As an administrator, I want to create and manage email templates with variable substitution and preview capability, so that business emails have consistent, professional formatting.

**Acceptance Criteria:**
1. GIVEN an ADMIN user WHEN they create an email template THEN they can specify a name, subject template, body template (HTML), and associated document type
2. GIVEN a template body WHEN it contains Handlebars variables (e.g., `{{customer.name}}`, `{{invoice.number}}`) THEN the system validates that the variables are known for the associated document type
3. GIVEN a template WHEN preview is requested THEN the system renders it with sample data and returns the HTML for display in the template editor
4. GIVEN a document type (e.g., SALES_INVOICE) WHEN no custom template exists THEN the system falls back to a system default template (BR-COM-010)

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/email/templates` (AC: #1)
  - [ ] ADMIN role required for create/update/delete
  - [ ] Fields: name, subject, bodyHtml, documentType, isDefault
- [ ] Implement Handlebars template compilation and variable validation (AC: #2)
  - [ ] Define available variables per document type
  - [ ] Validate template syntax on save
  - [ ] Compile and render with data context at send time
- [ ] Implement template preview endpoint (AC: #3)
  - [ ] Accept template ID, return rendered HTML with sample data
  - [ ] Sample data generated per document type
- [ ] Create system default templates for each document type (AC: #4)
  - [ ] Invoice email, Statement email, PO email, Notification email
  - [ ] Professional HTML layout with company branding placeholders
  - [ ] Fallback logic: custom template -> system default

**FR/NFR:** FR189; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Email templates in communications module |
| API Contracts | §2.25 Communications | CRUD /email/templates |
| Data Models | §3.18 Communications Module | EmailTemplate |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §13 Communications Rules | BR-COM-010 (document-to-email requires valid template with fallback) |
| UX Design Spec | N/A | N/A — admin management screen |
| Project Context | §6 Email Integration | SMTP outbound, email templates with merge fields |

---

## Story E10.3: Document-to-Email

**User Story:** As a user, I want to send invoices, purchase orders, and statements as PDF attachments via email directly from the record screen, so that I can communicate with customers and suppliers without leaving the ERP.

**Acceptance Criteria:**
1. GIVEN a posted invoice WHEN the user clicks "Email" in the action bar THEN a dialog pre-fills the recipient (customer email), subject (from template), and body (from template) with the invoice PDF attached
2. GIVEN the email dialog WHEN the user adds CC/BCC recipients THEN the email is sent to all specified recipients
3. GIVEN a document type WHEN the email template is resolved THEN it uses the document-type-specific template with Handlebars variables populated from the record data
4. GIVEN the email is sent WHEN confirmed THEN a RecordLink of type RELATES_TO is created between the EmailMessage and the source document
5. GIVEN batch statement generation WHEN the user triggers it THEN statements are generated and emailed to each customer with a balance

**Key Tasks:**
- [ ] Implement `POST /documents/email` endpoint (AC: #1, #2, #3)
  - [ ] Accept documentType, recordId, recipientOverrides, cc, bcc
  - [ ] Generate PDF via Document Template engine (E12)
  - [ ] Resolve email template for document type
  - [ ] Render template with record data
  - [ ] Attach PDF and queue for sending
- [ ] Build email composition dialog component (AC: #1, #2)
  - [ ] Pre-filled To, Subject, Body from template
  - [ ] CC/BCC fields
  - [ ] PDF attachment preview
  - [ ] Send button with confirmation
- [ ] Create RecordLink between email and source document (AC: #4)
- [ ] Implement batch email for statements (AC: #5)
  - [ ] `POST /ar/reports/statements/batch` triggers generation + email
  - [ ] BullMQ job for batch processing

**FR/NFR:** FR188; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Document-to-email flow |
| API Contracts | §2.4 Document Templates | POST /documents/email, POST /documents/generate |
| Data Models | §3.18 Communications Module | EmailMessage, EmailRecipient; §3.9 RecordLink |
| State Machines | §17.1 EmailMessage Status | DRAFT -> QUEUED -> SENT |
| Event Catalog | §14 Communications Events | `email.sent` event |
| Business Rules | §13 Communications Rules | BR-COM-001 (recipient validation), BR-COM-009 (signature once), BR-COM-010 (template required), BR-COM-015 (S3 presign for attachments) |
| UX Design Spec | §The Action Bar System | "Email" in Document Actions overflow section |
| Project Context | §6 Email Integration | SMTP outbound, send invoices/POs/statements |

---

---

## Story E10.4: Email Template Management Frontend

**User Story:** As an administrator, I want a frontend page to browse, create, edit, and preview email templates with live Handlebars rendering, so that I can configure professional email formatting per document type without developer assistance.

**Acceptance Criteria:**
1. GIVEN an ADMIN user navigates to `/system/email-templates` WHEN the page loads THEN a table displays all templates with Code, Name, Document Type, Language, Status, Last Updated columns with search and filter support
2. GIVEN the user opens a template WHEN the editor loads THEN a split-pane layout shows a form (left) and live preview (right) with debounced 500ms re-rendering
3. GIVEN the user selects a Document Type WHEN the variable reference panel updates THEN it shows all valid Handlebars variables for that type with copy and click-to-insert
4. GIVEN the user saves the form WHEN the API call succeeds THEN a success toast appears, dirty state resets, and template is persisted via POST/PATCH
5. GIVEN Handlebars syntax errors WHEN preview renders THEN the error is shown in the preview pane (not a crash)
6. GIVEN any viewport WHEN the page renders THEN desktop shows split-pane, tablet stacks, mobile shows form-only with Preview button

**Key Tasks:**
- [ ] Create feature directory, API hooks, list page route, detail/create routes (AC: #1)
- [ ] Build split-pane editor form with React Hook Form + Zod validation (AC: #2, #4)
- [ ] Create preview pane and variable reference panel with debounced rendering (AC: #3, #5)
- [ ] Implement responsive layout and Concept D visual polish (AC: #6)

**FR/NFR:** FR189; NFR41 (TypeScript strict), NFR2 (CRUD < 500ms p95)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| PRD | FR189 | Email templates with merge fields per document type |
| Architecture | §2.29 Communications (COM-4) | EmailTemplate model, Handlebars engine, 7 document types |
| UX Design Spec | §T7 Settings (split-pane variant) | Form left, preview right, responsive breakpoints |
| API Contracts | §2.25 Communications | 6 REST endpoints for /email/templates CRUD + preview |
| Data Models | §3.18 Communications | EmailTemplate: code, documentType, subjectTemplate, bodyHtmlTemplate |
| Business Rules | §13 BR-COM-010 | Template fallback hierarchy |

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E10.1 | SMTP Outbound Service | done |
| E10.2 | Email Template Management | done |
| E10.3 | Document-to-Email | done |
| E10.4 | Email Template Management Frontend | ready-for-dev |

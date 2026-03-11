# Epic E12: Document Templates & PDF

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR79 (report templates), FR85 (document generation) | **NFRs:** NFR2 (CRUD <500ms)

---

## Story E12.1: Template Engine

**User Story:** As a system, I want to compile Handlebars HTML templates and render them to PDF via Puppeteer, with variable injection and conditional sections, so that business documents (invoices, POs, statements) are generated as professional PDFs.

**Acceptance Criteria:**
1. GIVEN a DocumentTemplate with Handlebars HTML WHEN `POST /documents/generate` is called with a record ID THEN the system fetches the record data, compiles the template, and renders a PDF
2. GIVEN the template contains variables like `{{invoice.number}}`, `{{customer.name}}`, `{{lines}}` WHEN compiled THEN all variables are populated from the record data
3. GIVEN the template contains conditional sections (e.g., `{{#if showVatNumber}}`) WHEN the condition is false THEN the section is omitted from the PDF
4. GIVEN the template has line items WHEN rendered THEN the `{{#each lines}}` block repeats for each line with correct totals
5. GIVEN Puppeteer HTML-to-PDF rendering WHEN the PDF is generated THEN it respects page size (A4), orientation, margins, and page breaks

**Key Tasks:**
- [ ] Implement Handlebars template compilation service (AC: #1, #2, #3, #4)
  - [ ] Load DocumentTemplate from database
  - [ ] Fetch record data from the appropriate module service
  - [ ] Compile Handlebars template with data context
  - [ ] Support helpers: `formatCurrency`, `formatDate`, `formatNumber`, conditionals, loops
- [ ] Implement Puppeteer HTML-to-PDF rendering (AC: #5)
  - [ ] Install Puppeteer in API service
  - [ ] Configure page size (from template: A4, Letter), orientation (portrait/landscape)
  - [ ] Set margins, headers, footers
  - [ ] Handle page breaks for long line item lists
- [ ] Implement `POST /documents/generate` endpoint (AC: #1)
  - [ ] Accept documentType, recordId
  - [ ] Return PDF as binary stream or presigned S3 URL
- [ ] Implement `POST /documents/batch-generate` for batch PDF generation (AC: #1)
  - [ ] BullMQ job for generating multiple PDFs (e.g., batch statements)

**FR/NFR:** FR85; NFR2, NFR3 (reports <5s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.7 (referenced in Project Context) | Puppeteer HTML-to-PDF, Document Templates |
| API Contracts | §2.4 Document Templates | POST /documents/generate, POST /documents/batch-generate |
| Data Models | §3.1 System Module | DocumentTemplate: documentType, htmlTemplate, pageSize, orientation, showLogo/showBankDetails/showVatNumber |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted for PDF generation |
| Business Rules | N/A | N/A — template rendering has no business rules |
| UX Design Spec | N/A | N/A — PDF output, not screen design |
| Project Context | §7 Printer Management | PDF generation via Document Templates (Puppeteer) |

---

## Story E12.2: Template Management

**User Story:** As an administrator, I want to create, edit, and version document templates with active/draft management and preview capability, so that I can customise the look of business documents.

**Acceptance Criteria:**
1. GIVEN an ADMIN user WHEN they create a document template THEN they can specify document type, name, HTML template body, page size, orientation, and branding toggles (logo, bank details, VAT number)
2. GIVEN a template WHEN a new version is created THEN the previous version is retained and the new version can be set as active or kept as draft
3. GIVEN a template with DocumentTemplateVersion records WHEN versions have selection criteria (language, branch, number series) THEN the highest-priority matching version is selected at render time
4. GIVEN a template WHEN the admin clicks "Preview" THEN the system renders the template with sample data and displays the PDF in the browser

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/document-templates` (AC: #1)
  - [ ] ADMIN role required
  - [ ] Fields: documentType (enum), name, htmlTemplate, pageSize, orientation, branding toggles
  - [ ] Unique constraint on [documentType, name]
- [ ] Implement version management (AC: #2, #3)
  - [ ] DocumentTemplateVersion records with priority-based selection
  - [ ] Selection criteria: languageCode, branchCode, numberSeriesId, accessGroup, customerGroupId
  - [ ] Version resolution: find highest-priority matching version, fall back to base template
- [ ] Implement template preview (AC: #4)
  - [ ] Generate sample data per document type
  - [ ] Render via template engine and return PDF
- [ ] Build template management UI (T7 Settings template) (AC: #1, #2, #4)
  - [ ] Template list grouped by document type
  - [ ] HTML editor with syntax highlighting
  - [ ] Preview button
  - [ ] Version history with activate/draft controls

**FR/NFR:** FR79; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Document template versioning system |
| API Contracts | §2.4 Document Templates | CRUD /document-templates |
| Data Models | §3.1 System Module | DocumentTemplate, DocumentTemplateVersion (priority, selection criteria, email fields) |
| State Machines | N/A | N/A — no formal state machine (active/draft managed by version) |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — template management rules |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for admin management |
| Project Context | §7 Printer Management | Document Templates engine |

---

## Story E12.3: Default Templates

**User Story:** As a system, I want built-in default templates for each DocumentType (invoice, credit note, PO, delivery note, statement, payslip, etc.), so that tenants can generate professional documents immediately without custom template creation.

**Acceptance Criteria:**
1. GIVEN a new tenant is provisioned WHEN the database is seeded THEN default DocumentTemplate records exist for all 14 DocumentType enum values
2. GIVEN a default template WHEN rendered for an invoice THEN it includes: company logo, company details, customer address, invoice number, date, due date, line items, VAT breakdown, totals, bank details, and payment terms
3. GIVEN each default template WHEN the system branding toggles (showLogo, showBankDetails, showVatNumber) are set THEN the template conditionally includes/excludes those sections
4. GIVEN the 14 DocumentTypes WHEN default templates are provided THEN they cover: SALES_INVOICE, CREDIT_NOTE, CASH_RECEIPT, PROFORMA_INVOICE, CUSTOMER_STATEMENT, SALES_ORDER, SALES_QUOTE, DELIVERY_NOTE, PURCHASE_ORDER, GOODS_RECEIPT_NOTE, SUPPLIER_REMITTANCE, PAYSLIP, P45, P60

**Key Tasks:**
- [ ] Design and create HTML/Handlebars templates for all 14 document types (AC: #1, #2, #4)
  - [ ] SALES_INVOICE: full invoice layout with line items and VAT
  - [ ] CREDIT_NOTE: similar to invoice with "Credit Note" header
  - [ ] CASH_RECEIPT: payment receipt format
  - [ ] PROFORMA_INVOICE: pro-forma layout
  - [ ] CUSTOMER_STATEMENT: aged balance with transaction list
  - [ ] SALES_ORDER / SALES_QUOTE: order/quote layouts
  - [ ] DELIVERY_NOTE: dispatch with line items (no pricing)
  - [ ] PURCHASE_ORDER: PO layout for suppliers
  - [ ] GOODS_RECEIPT_NOTE: GRN layout
  - [ ] SUPPLIER_REMITTANCE: payment remittance advice
  - [ ] PAYSLIP / P45 / P60: UK payroll document formats
- [ ] Implement conditional branding sections in all templates (AC: #3)
  - [ ] `{{#if showLogo}}` blocks
  - [ ] `{{#if showBankDetails}}` blocks
  - [ ] `{{#if showVatNumber}}` blocks
- [ ] Create database seed script for default templates (AC: #1)
  - [ ] Run on tenant provisioning
  - [ ] Idempotent (skip if templates already exist)

**FR/NFR:** FR79, FR85; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Default template seeding |
| API Contracts | §2.4 Document Templates | POST /documents/generate uses these templates |
| Data Models | §4.1 System Module Enums | DocumentType enum: 14 values (SALES_INVOICE through P60) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §13 Communications Rules | BR-COM-010 (document-to-email requires valid template, fall back to default) |
| UX Design Spec | N/A | N/A — PDF layout design, not screen design |
| Project Context | §7 Printer Management | PDF generation, all 14 document types |

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E12.1 | Template Engine | backlog |
| E12.2 | Template Management | done |
| E12.3 | Default Templates | backlog |

# Epic E13: Printer Management

**Tier:** 1 | **Dependencies:** E12 (Document Templates & PDF) | **FRs:** FR190-FR192 | **NFRs:** NFR2

---

## Story E13.S1: Print Preferences

**User Story:** As a user, I want to configure my preferred print behaviour per document type (auto-download PDF, browser print dialog, or no action), so that document handling matches my workflow.

**Acceptance Criteria:**
1. GIVEN a user preferences page WHEN the user opens print settings THEN a list of document types shows with a preference selector for each (Auto-Download, Browser Print, None)
2. GIVEN a company-level default WHEN set by an ADMIN THEN it applies to all users who have not set personal preferences
3. GIVEN a user has set "Auto-Download" for SALES_INVOICE WHEN they save an invoice THEN the PDF is automatically downloaded to their browser
4. GIVEN a user has set "Browser Print" for PURCHASE_ORDER WHEN they save a PO THEN the browser's native print dialog opens with the PDF

**Key Tasks:**
- [ ] Implement print preference storage in SystemSettings / UserPreference (AC: #1, #2)
  - [ ] Company-level defaults: `SystemSetting` with key `print.{documentType}.default`
  - [ ] User-level overrides: user preference record per document type
  - [ ] Values: `AUTO_DOWNLOAD`, `BROWSER_PRINT`, `NONE`
- [ ] Build print preferences UI section (T7 Settings template) (AC: #1)
  - [ ] Table: DocumentType | Company Default | My Preference
  - [ ] Dropdown selectors per row
  - [ ] "Reset to Company Defaults" action
- [ ] Implement preference resolution logic (AC: #2, #3, #4)
  - [ ] User preference -> company default -> `NONE`

**FR/NFR:** FR190, FR192; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Print preferences pattern |
| API Contracts | N/A | User preferences via system settings endpoints |
| Data Models | §3.1 System Module | SystemSetting (key-value store for company defaults) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — preference management |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for preferences |
| Project Context | §7 Printer Management | Cloud-based, no physical drivers; PDF + browser print dialog or download |

---

## Story E13.S2: Print Actions

**User Story:** As a user, I want documents to auto-download as PDF on save or trigger the browser print dialog based on my preferences, with support for batch printing, so that printing is seamless.

**Acceptance Criteria:**
1. GIVEN a user saves a document (invoice, PO, etc.) WHEN their preference is "Auto-Download" THEN the system generates the PDF via E12 and triggers a browser file download
2. GIVEN a user saves a document WHEN their preference is "Browser Print" THEN the system generates the PDF, opens it in a hidden iframe, and calls `window.print()` to trigger the native print dialog
3. GIVEN a batch of invoices selected on a list page WHEN the user clicks "Print Selected" THEN PDFs are generated for all selected documents and either batch-downloaded as a ZIP or printed sequentially
4. GIVEN the print action WHEN the PDF is being generated THEN a loading indicator is shown and the user can continue working

**Key Tasks:**
- [ ] Implement auto-download PDF on save (AC: #1)
  - [ ] After successful save, check user print preference
  - [ ] If AUTO_DOWNLOAD: call document generate API, trigger browser download
  - [ ] Use `<a download>` technique for file download
- [ ] Implement browser print dialog trigger (AC: #2)
  - [ ] Load PDF into hidden iframe
  - [ ] Call `iframe.contentWindow.print()` or use `window.print()` with print CSS
- [ ] Implement batch print queue (AC: #3)
  - [ ] Generate PDFs for selected records (BullMQ batch job)
  - [ ] Return as ZIP download for auto-download preference
  - [ ] Sequential print dialog for browser print preference
- [ ] Implement loading state during PDF generation (AC: #4)
  - [ ] Show progress indicator on the action button
  - [ ] Non-blocking — user can navigate away

**FR/NFR:** FR191; NFR2, NFR3

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | PDF generation via Puppeteer |
| API Contracts | §2.4 Document Templates | POST /documents/generate, POST /documents/batch-generate |
| Data Models | N/A | N/A — uses DocumentTemplate from E12 |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — print is a client-side action |
| UX Design Spec | §UX Quality Contract, Action Correctness | Save actions trigger downstream effects (print) |
| Project Context | §7 Printer Management | Auto-download PDF on save, browser Print API, batch print queue |

---

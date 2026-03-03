# Epic E20: Document Understanding

> **AI-powered ingestion, extraction, matching, and approval of financial documents (purchase invoices, receipts, credit notes).** Leverages the AI Gateway (E3b) and AI Orchestration (E5) to extract structured data from uploaded/emailed/photographed documents, match to existing records, and create draft transactions following the "Told, Shown, Approve, Done" paradigm.

**Architecture:** §6.10 Document Understanding Pipeline
**Models:** `DocumentIngestion`, `SupplierExtractionProfile`
**State Machine:** SM:DocumentIngestion — `PENDING → PROCESSING → EXTRACTED → MATCHED → REVIEW → APPROVED | REJECTED | FAILED`
**Events:** `document.processing.started`, `document.extraction.completed`, `document.extraction.failed`, `document.matching.completed`, `document.review.required`, `document.approved`, `document.rejected`
**API:** §2.27 — 11 endpoints under `/documents/*`
**Business Rules:** Confidence <70% → REVIEW; new supplier → REVIEW; PO variance >5% → REVIEW
**FRs:** FR164–FR170
**UX Templates:** T2 (Record Detail), T6 (Wizard), T1 (List)

**Dependencies:** E3b (AI Gateway), E5 (AI Orchestration), E19 (Purchase Ledger/AP), E1 (Database + Core Models)

---

## Story E20.S1: Document Upload & Ingestion Pipeline

**User Story:** As a finance user, I want to upload financial documents (PDF, JPEG, PNG, TIFF) via web upload so that the system can begin AI-powered data extraction.

**Acceptance Criteria:**

```gherkin
Scenario: Successful document upload via web
  Given I am logged in as a user with STAFF or higher role
  And I navigate to the Document Understanding module
  When I upload a PDF file under 10MB
  Then the system creates a DocumentIngestion record with status PENDING
  And emits a "document.processing.started" event
  And the document appears in my ingestion queue

Scenario: File format validation
  Given I attempt to upload a .docx file
  When the upload is submitted
  Then the system rejects the upload with translation key "document.error.unsupported_format"
  And no DocumentIngestion record is created

Scenario: File size validation
  Given I attempt to upload a 25MB image file
  When the upload is submitted
  Then the system rejects the upload with translation key "document.error.file_too_large"
  And displays the maximum allowed size

Scenario: Automatic orientation correction
  Given I upload a JPEG image that is rotated 90 degrees
  When the system processes the upload
  Then the image is auto-corrected to proper orientation before extraction
  And the original file is preserved as an attachment

Scenario: Quality validation rejects unreadable documents
  Given I upload a heavily blurred or corrupted image
  When the system attempts quality validation
  Then the DocumentIngestion status transitions to FAILED
  And the user sees translation key "document.error.unreadable_reupload"
```

**Key Tasks:**
1. **Create DocumentIngestion Prisma model** — UUID PK, companyId FK, status enum, fileUrl, mimeType, originalFilename, fileSizeBytes, uploadedById, extractedData (JSON), matchResult (JSON), confidence (Decimal), timestamps
   - Add database indexes on [companyId, status] and [uploadedById]
   - Add @@map("document_ingestions") with snake_case column mapping
2. **Implement file upload endpoint** — `POST /api/v1/documents/upload` with multipart form data
   - Validate file type (PDF, JPEG, PNG, TIFF), file size (<10MB configurable)
   - Store file to configured storage (local/S3) and create DocumentIngestion record
   - Scope by ctx.companyId
3. **Implement file preprocessing service** — orientation correction (sharp/jimp), quality validation (resolution check, blur detection)
   - Emit `document.processing.started` event on successful preprocessing
   - Transition to FAILED on quality check failure
4. **Create ingestion queue list UI** — T1 (Entity List) template showing all documents for current company
   - Columns: filename, status badge, uploaded by, upload date, confidence score
   - Filter by status, date range; sort by date
5. **Write unit tests** — file validation (type, size), model creation, event emission, quality check edge cases
6. **Write integration tests** — full upload flow, storage verification, status transitions

**FR/NFR References:** FR164, FR168, NFR2, NFR8, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR164-FR170) | Functional requirements for document ingestion |
| Architecture | §6.10 Document Understanding Pipeline | Pipeline stages, model definitions, extraction flow |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | List and detail view templates |
| API Contracts | §2.27 Document Understanding | POST /documents/upload endpoint spec |
| Data Models | §18 Document Understanding | DocumentIngestion, SupplierExtractionProfile models |
| State Machine Reference | §19 Document Understanding | SM:DocumentIngestion states and transitions |
| Event Catalog | §18 Document Understanding | document.processing.started event definition |
| Business Rules Compendium | §13.6 Document Understanding | Quality validation and confidence threshold rules |

---

## Story E20.S2: AI Data Extraction Engine

**User Story:** As a finance user, I want the system to automatically extract structured fields (supplier name, invoice number, date, line items, amounts, VAT, payment terms) from uploaded documents so that I can review AI-generated data instead of manually entering it.

**Acceptance Criteria:**

```gherkin
Scenario: Successful extraction from standard UK invoice PDF
  Given a DocumentIngestion record exists with status PROCESSING
  When the AI extraction engine processes the document
  Then structured fields are extracted including supplier name, invoice number, date, line items, amounts, VAT, and payment terms
  And each field has a confidence score between 0.0 and 1.0
  And the extractedData JSON is saved to the DocumentIngestion record
  And the status transitions to EXTRACTED
  And a "document.extraction.completed" event is emitted

Scenario: Extraction with low confidence triggers review
  Given the AI extraction produces overall confidence below 0.70
  When the extraction completes
  Then the status transitions to REVIEW instead of EXTRACTED
  And a "document.review.required" event is emitted

Scenario: Extraction failure handling
  Given the AI extraction engine cannot parse the document
  When the extraction attempt fails after retry
  Then the status transitions to FAILED
  And a "document.extraction.failed" event is emitted with error details
  And the user is notified via the notification system

Scenario: Supplier extraction profile improves accuracy
  Given a SupplierExtractionProfile exists for supplier "ABC Ltd"
  When a new document from "ABC Ltd" is processed
  Then the extraction uses the profile's field mappings and layout hints
  And achieves higher confidence than first-time extraction
```

**Key Tasks:**
1. **Implement AI extraction service** — Call AI Gateway (`aiGateway.complete()`) with document content and extraction prompt
   - Parse response into structured field schema (supplier, invoiceNo, date, lineItems[], amounts, VAT, paymentTerms)
   - Calculate per-field and overall confidence scores
   - All AI calls through AI Gateway — never call Claude API directly
2. **Create SupplierExtractionProfile model** — stores learned field positions and patterns per supplier per company
   - Fields: companyId, supplierId, fieldMappings (JSON), layoutHints (JSON), extractionCount, avgConfidence
3. **Implement confidence threshold logic** — configurable threshold (default 0.70)
   - Below threshold → status REVIEW; above → status EXTRACTED
   - New supplier (no profile) → always REVIEW for first N documents
4. **Implement extraction job processor** — BullMQ job triggered by `document.processing.started` event
   - Retry logic with exponential backoff (max 3 retries per NFR31)
   - Timeout handling for large documents
5. **Write unit tests** — extraction parsing, confidence calculation, threshold routing, profile lookup
6. **Write integration tests** — end-to-end extraction flow with mocked AI Gateway responses

**FR/NFR References:** FR165, FR167, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR165, FR167) | Extraction accuracy requirements (>85%), field-level confidence |
| Architecture | §6.10 Document Understanding Pipeline | Extraction engine design, AI Gateway integration |
| UX Design Specification | T2 (Record Detail) | Detail view for extraction results |
| API Contracts | §2.27 Document Understanding | Extraction-related endpoints |
| Data Models | §18 Document Understanding | SupplierExtractionProfile schema |
| State Machine Reference | §19 Document Understanding | PROCESSING → EXTRACTED / REVIEW / FAILED transitions |
| Event Catalog | §18 Document Understanding | document.extraction.completed, document.extraction.failed events |
| Business Rules Compendium | §13.6 Document Understanding | Confidence thresholds, new supplier rules |

---

## Story E20.S3: Automatic Record Matching

**User Story:** As a finance user, I want the system to automatically match extracted document data to existing supplier records, purchase orders, and GL accounts so that draft transactions are pre-populated with correct references.

**Acceptance Criteria:**

```gherkin
Scenario: Supplier name matches existing supplier record
  Given extraction produced supplier name "ABC Trading Ltd"
  And a supplier record "ABC Trading Limited" exists for the current company
  When the matching engine runs
  Then the extracted document is linked to the matching supplier record
  And the match confidence is recorded

Scenario: PO matching by reference number
  Given extraction produced PO reference "PO-2026-0042"
  And an open purchase order PO-2026-0042 exists
  When the matching engine runs
  Then the document is matched to the purchase order
  And line items are compared for variance checking

Scenario: PO variance exceeds 5% threshold
  Given the extracted invoice total is GBP 1,100
  And the matched PO total is GBP 1,000 (variance = 10%)
  When the variance check runs
  Then the status transitions to REVIEW
  And a "document.review.required" event is emitted with variance details

Scenario: GL account suggestion based on supplier history
  Given supplier "ABC Trading Ltd" has 10 previous invoices all coded to GL account 5100
  When GL account matching runs
  Then GL account 5100 is suggested with high confidence
  And the suggestion appears in the extractedData matchResult

Scenario: No supplier match found
  Given extraction produced supplier name "New Company XYZ"
  And no matching supplier exists
  When the matching engine runs
  Then the status transitions to REVIEW
  And the system suggests creating a new supplier record
```

**Key Tasks:**
1. **Implement supplier matching service** — fuzzy name matching against existing supplier records scoped by companyId
   - Consider aliases, trading names, VAT registration numbers
   - Use RegisterSharingRule for shared supplier visibility
2. **Implement PO matching service** — match by PO reference, supplier + amount combination
   - Calculate line-item variance; flag if >5% (configurable)
   - 3-way matching: PO → goods receipt → invoice
3. **Implement GL account suggestion** — based on supplier history, item categories, and previous coding patterns
4. **Update DocumentIngestion with match results** — populate matchResult JSON with supplier match, PO match, GL suggestions, and per-match confidence scores
   - Transition status to MATCHED (all good) or REVIEW (any issues)
5. **Emit matching events** — `document.matching.completed` with match summary
6. **Write unit tests** — fuzzy matching accuracy, variance calculation, GL suggestion logic
7. **Write integration tests** — full matching pipeline with seeded supplier/PO data

**FR/NFR References:** FR166, FR31, FR32, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR166) | Auto-matching requirements, "told, shown, approve, done" |
| Architecture | §6.10 Document Understanding Pipeline | Matching engine design, supplier fuzzy matching |
| UX Design Specification | T2 (Record Detail) | Match results display layout |
| API Contracts | §2.27 Document Understanding | Match-related endpoints |
| Data Models | §18 Document Understanding, §7 Purchasing | DocumentIngestion.matchResult, PurchaseOrder model |
| State Machine Reference | §19 Document Understanding | EXTRACTED → MATCHED / REVIEW transitions |
| Event Catalog | §18 Document Understanding | document.matching.completed event |
| Business Rules Compendium | §13.6 Document Understanding | PO variance >5% rule, new supplier review rule |

---

## Story E20.S4: Human Review & Correction Interface

**User Story:** As a finance user, I want to review, correct, and approve AI-extracted document records before they are posted so that I can ensure accuracy and provide feedback that improves future extractions.

**Acceptance Criteria:**

```gherkin
Scenario: Review extracted fields with confidence indicators
  Given a DocumentIngestion record is in REVIEW status
  When I open the review interface
  Then I see all extracted fields with colour-coded confidence indicators (green >0.85, amber 0.70-0.85, red <0.70)
  And the original document is displayed side-by-side for comparison
  And low-confidence fields are highlighted for attention

Scenario: Correct extracted field and approve
  Given I am reviewing an extracted document
  And the supplier name field shows "ABC Trding" with confidence 0.62
  When I correct the supplier name to "ABC Trading Ltd" and click Approve
  Then the DocumentIngestion status transitions to APPROVED
  And a "document.approved" event is emitted
  And the correction is fed back to update the SupplierExtractionProfile

Scenario: Reject document
  Given I am reviewing an extracted document
  When I click Reject with reason "Duplicate invoice"
  Then the DocumentIngestion status transitions to REJECTED
  And a "document.rejected" event is emitted with the rejection reason

Scenario: Correction feedback improves future accuracy
  Given I have corrected 5 documents from supplier "ABC Trading Ltd"
  When the system updates the SupplierExtractionProfile
  Then the profile's avgConfidence increases
  And the extractionCount is incremented
  And field mappings are updated with learned corrections
```

**Key Tasks:**
1. **Build review UI** — T2 (Record Detail) with split-pane: original document viewer (left) + extracted fields form (right)
   - Confidence colour coding per field (green/amber/red thresholds)
   - Editable fields with change tracking
   - Match results panel showing suggested supplier, PO, GL mappings
2. **Implement approve endpoint** — `POST /api/v1/documents/:id/approve`
   - Validate all required fields are filled
   - Transition status to APPROVED; emit `document.approved` event
   - Record corrections as feedback
3. **Implement reject endpoint** — `POST /api/v1/documents/:id/reject`
   - Require rejection reason; transition to REJECTED; emit `document.rejected`
4. **Implement feedback loop** — on approval, compare original extraction to corrected values
   - Update SupplierExtractionProfile with corrections
   - Increment extraction count, recalculate average confidence
5. **Write unit tests** — approval validation, rejection with reason, feedback calculation
6. **Write integration tests** — full review-approve cycle, review-reject cycle, profile update verification

**FR/NFR References:** FR167, FR6, FR10, NFR16, NFR27

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR167) | Review and correction requirements, feedback loop |
| Architecture | §6.10 Document Understanding Pipeline | Review stage, feedback mechanism |
| UX Design Specification | T2 (Record Detail) | Split-pane review layout, confidence indicators |
| API Contracts | §2.27 Document Understanding | POST /documents/:id/approve, POST /documents/:id/reject |
| Data Models | §18 Document Understanding | DocumentIngestion.extractedData, SupplierExtractionProfile |
| State Machine Reference | §19 Document Understanding | REVIEW → APPROVED / REJECTED transitions |
| Event Catalog | §18 Document Understanding | document.approved, document.rejected events |
| Business Rules Compendium | §13.6 Document Understanding | Approval guards, rejection reason requirement |

---

## Story E20.S5: Draft Transaction Creation

**User Story:** As a finance user, I want approved document extractions to automatically create draft purchase invoices or expense records so that I can post them through the standard AP workflow.

**Acceptance Criteria:**

```gherkin
Scenario: Approved document creates draft purchase invoice
  Given a DocumentIngestion record transitions to APPROVED
  And the document type is "purchase_invoice"
  When the draft creation handler processes the event
  Then a draft SupplierInvoice is created with extracted header fields
  And line items are populated from extracted line data
  And the original document is attached as an Attachment (cross-cutting)
  And the SupplierInvoice references the DocumentIngestion record

Scenario: VAT calculation on created draft
  Given the extracted data includes line items with VAT amounts
  When the draft purchase invoice is created
  Then VAT is calculated per line item using the matched VAT code
  And the invoice total matches the extracted total (within rounding tolerance)

Scenario: Multi-line item document
  Given an invoice with 15 line items is extracted and approved
  When the draft is created
  Then all 15 line items appear on the draft purchase invoice
  And each line has item, description, quantity, unit price, VAT code, and amount

Scenario: Draft links back to source document
  Given a draft purchase invoice was created from document ingestion
  When I view the purchase invoice
  Then I see a link to the source DocumentIngestion record
  And the source document is viewable as an attachment
```

**Key Tasks:**
1. **Implement draft creation event handler** — subscribe to `document.approved` event
   - Map extracted fields to SupplierInvoice model (header + lines)
   - Apply VAT calculation using matched VAT codes
   - Create attachment linking original document
   - Set SupplierInvoice status to DRAFT
2. **Handle different document types** — purchase invoices, credit notes, expense claims
   - Route to appropriate draft creation logic based on extracted document type
3. **Implement rounding tolerance** — allow small rounding differences between extracted totals and calculated totals (configurable, default 0.01)
4. **Create RecordLink** — link DocumentIngestion to created SupplierInvoice (polymorphic cross-cutting entity)
5. **Write unit tests** — field mapping, VAT calculation, multi-line creation, rounding tolerance
6. **Write integration tests** — full extraction-to-draft pipeline

**FR/NFR References:** FR166, FR27, FR31, FR89, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR166) | Auto-creation of draft records |
| Architecture | §6.10 Document Understanding Pipeline, §2.13 AP | Draft creation from extraction, SupplierInvoice model |
| UX Design Specification | T3 (Header+Lines Document) | Purchase invoice layout for created draft |
| API Contracts | §2.27 Document Understanding, §2.10 AP | Draft creation endpoints |
| Data Models | §18 Document Understanding, §7 Purchasing | DocumentIngestion → SupplierInvoice mapping |
| State Machine Reference | §19 Document Understanding, §4 AP | APPROVED side effect → create draft |
| Event Catalog | §18 Document Understanding | document.approved event subscription |
| Business Rules Compendium | §13.6 Document Understanding, §4 AP | Rounding tolerance, VAT calculation rules |

---

## Story E20.S6: Document Knowledge Base (RAG)

**User Story:** As an administrator, I want to upload company documents (handbooks, policy manuals, contracts) for AI indexing so that users can ask natural language questions and receive accurate answers with source citations.

**Acceptance Criteria:**

```gherkin
Scenario: Upload company document for indexing
  Given I am logged in as ADMIN
  When I upload a company handbook PDF to the Knowledge Base
  Then the document is chunked, embedded, and stored in the vector database
  And the document appears in the Knowledge Base document list
  And the indexing status shows "Indexed" when complete

Scenario: Natural language question with source citation
  Given the employee handbook has been indexed
  When a user asks "What is the annual leave policy?"
  Then the system retrieves relevant document chunks via RAG
  And returns an answer with source document name and page/section reference
  And the answer is generated through the AI Gateway

Scenario: Access control on knowledge base queries
  Given confidential documents are uploaded with restricted access
  When a STAFF user queries the knowledge base
  Then only documents the user has access to are included in the search
  And confidential documents are excluded from results

Scenario: Document re-indexing on update
  Given a company handbook was previously indexed
  When the admin uploads a new version of the handbook
  Then the old index entries are replaced with new ones
  And queries return answers based on the updated content
```

**Key Tasks:**
1. **Implement document upload for Knowledge Base** — `POST /api/v1/documents/knowledge-base/upload`
   - Accept PDF, DOCX formats; validate and store
   - Trigger async indexing job via BullMQ
2. **Implement document chunking and embedding** — split documents into overlapping chunks
   - Generate embeddings via AI Gateway
   - Store chunks + embeddings in vector store (pgvector extension)
3. **Implement RAG query endpoint** — `POST /api/v1/documents/knowledge-base/query`
   - Vector similarity search for relevant chunks
   - Pass chunks as context to AI Gateway for answer generation
   - Return answer with source citations (document name, page, section)
4. **Implement access control** — scope knowledge base documents by companyId and optional access roles
5. **Build Knowledge Base management UI** — T1 (Entity List) for document listing; upload dialog; indexing status
6. **Write unit tests** — chunking logic, access control filtering, citation formatting
7. **Write integration tests** — upload-index-query cycle with mocked AI Gateway

**FR/NFR References:** FR169, FR170, FR1, FR4, NFR1, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR169, FR170) | Knowledge base and RAG query requirements |
| Architecture | §6.10 Document Understanding Pipeline | RAG architecture, vector store design |
| UX Design Specification | T1 (Entity List), T7 (Settings) | Knowledge base document list, admin config |
| API Contracts | §2.27 Document Understanding | Knowledge base upload and query endpoints |
| Data Models | §18 Document Understanding | Document chunk and embedding models |
| State Machine Reference | §19 Document Understanding | Document indexing lifecycle |
| Event Catalog | §18 Document Understanding | document.indexing.completed event |
| Business Rules Compendium | §13.6 Document Understanding | Access control rules for knowledge base |

---

## Story E20.S7: Mobile Adaptation — Document Understanding

**User Story:** As a mobile user, I want to photograph receipts and invoices using my phone camera and submit them for AI extraction so that I can capture expenses on the go.

**Acceptance Criteria:**

```gherkin
Scenario: Camera capture and upload from mobile
  Given I am on the mobile app (Expo)
  When I tap "Capture Document" and take a photo of a receipt
  Then the image is uploaded to the document ingestion pipeline
  And I see the upload status in my mobile document queue

Scenario: View extraction results on mobile
  Given a document I uploaded has been extracted
  When I view the document in the mobile app
  Then I see a simplified view of extracted fields
  And I can approve or request desktop review

Scenario: Push notification on extraction completion
  Given I uploaded a document from my mobile
  When the extraction completes
  Then I receive a push notification with the extraction summary
  And tapping the notification opens the document review

Scenario: Offline camera capture with sync
  Given my mobile device is offline
  When I photograph a receipt
  Then the image is queued locally
  And when connectivity restores the image is uploaded automatically
```

**Key Tasks:**
1. **Implement mobile camera capture** — Expo Camera integration with image quality validation
   - Auto-crop, perspective correction hints
   - Offline queue with background upload on connectivity restore
2. **Create mobile document list** — simplified T1 view showing upload status, extraction status
3. **Create mobile review summary** — read-only extraction results with approve/defer actions
4. **Implement push notifications** — trigger on `document.extraction.completed` for mobile-uploaded documents
5. **Write unit tests** — offline queue logic, camera capture validation
6. **Write integration tests** — mobile upload → extraction → notification flow

**FR/NFR References:** FR164, FR168, NFR6, NFR21

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.11 Document Understanding (FR164, FR168) | Mobile camera capture, format support |
| Architecture | §6.10 Document Understanding Pipeline | Mobile upload integration points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns, Expo scaffold |
| API Contracts | §2.27 Document Understanding | Same upload endpoints used by mobile |
| Data Models | §18 Document Understanding | DocumentIngestion model (same as web) |
| State Machine Reference | §19 Document Understanding | Same state machine for mobile-originated documents |
| Event Catalog | §18 Document Understanding | document.extraction.completed for push notification trigger |
| Business Rules Compendium | §13.6 Document Understanding | Same validation and confidence rules apply |

---

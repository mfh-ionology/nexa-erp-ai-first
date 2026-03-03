# Epic E8: Attachments + Notes + Record Links

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR85 (attachments), FR87 (record links) | **NFRs:** NFR2 (CRUD <500ms)

---

## Story E8.1: Attachment Service

**User Story:** As a user, I want to upload files to any business record using presigned URLs with MIME type validation and size limits, so that I can attach supporting documents to invoices, POs, and other records.

**Acceptance Criteria:**
1. GIVEN a user wants to attach a file WHEN they request a presigned upload URL THEN the service validates MIME type against the allowlist and file size against the configured maximum (default 50MB) before returning the URL
2. GIVEN a presigned URL WHEN the browser uploads the file directly to S3/MinIO THEN the upload bypasses the application server entirely
3. GIVEN an upload completes WHEN the user confirms THEN an Attachment record is created with entityType, entityId, fileName, mimeType, fileSize, and storageUrl
4. GIVEN a user requests a file download WHEN they click on an attachment THEN a presigned download URL is generated with a configurable expiry (default 15 minutes)
5. GIVEN an executable file (`.exe`, `.bat`, `.sh`) WHEN upload is attempted THEN the request is rejected with a validation error
6. GIVEN an attachment is deleted WHEN the delete action completes THEN both the Attachment record and the S3 object are removed

**Key Tasks:**
- [ ] Implement `POST /attachments/presign` endpoint (AC: #1, #2)
  - [ ] Validate MIME type against allowlist (PDF, images, Office docs, CSV — no executables)
  - [ ] Validate file size against `SystemSetting` maximum (default 50MB)
  - [ ] Generate S3 presigned PUT URL with content-type constraint
  - [ ] Return presigned URL and upload metadata
- [ ] Implement `POST /attachments/confirm` endpoint (AC: #3)
  - [ ] Verify file exists at the S3 key
  - [ ] Create Attachment record with polymorphic entityType + entityId
  - [ ] Validate that the referenced entity exists (BR-SYS-009)
- [ ] Implement `GET /attachments/:id/download` endpoint (AC: #4)
  - [ ] Generate presigned GET URL with configurable expiry
- [ ] Implement `DELETE /attachments/:id` endpoint (AC: #6)
  - [ ] Delete S3 object and database record in transaction
  - [ ] MANAGER role required
- [ ] Implement `GET /attachments` list endpoint with entity filtering (AC: #3)
  - [ ] Filter by entityType + entityId query parameters
- [ ] Configure S3/MinIO client in the API (AC: #2)
  - [ ] Use MinIO for local development, S3 for production

**FR/NFR:** FR85; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.7 Caching Strategy | S3/MinIO for file storage |
| API Contracts | §2.5 Cross-cutting Infrastructure | POST /attachments/presign, POST /attachments/confirm, GET /attachments/:id/download, DELETE /attachments/:id, GET /attachments |
| Data Models | §3.9 Cross-Cutting Module | Attachment: entityType, entityId, fileName, mimeType, fileSize, storageUrl |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events for attachment CRUD |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-006 (file size limit), BR-SYS-007 (MIME allowlist), BR-SYS-008 (presigned URL), BR-SYS-009 (entity validation), BR-SYS-010 (cascade-aware deletion) |
| UX Design Spec | §The Action Bar System | Attachments as persistent tool with count badge |
| Project Context | N/A | N/A — covered by Architecture |

---

## Story E8.2: Notes Service

**User Story:** As a user, I want to add typed notes (general, internal, customer-visible, system) to any business record, so that I can document conversations, decisions, and context alongside the data.

**Acceptance Criteria:**
1. GIVEN any business record WHEN a user creates a note THEN it is stored with polymorphic entityType + entityId, note type, content, and author
2. GIVEN note types WHEN a note is created with type INTERNAL THEN it is visible only to internal staff, not exposed in customer-facing contexts
3. GIVEN note type CUSTOMER_VISIBLE WHEN displayed on a customer statement or portal THEN the note content is included
4. GIVEN note type SYSTEM WHEN the system generates automated notes (e.g., "Status changed to POSTED by AI") THEN the note is created with type SYSTEM and cannot be edited by users
5. GIVEN a record with notes WHEN the notes list is retrieved THEN notes are returned in reverse chronological order with author name and timestamp

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/notes` (AC: #1, #5)
  - [ ] `POST /notes` — create with entityType, entityId, noteType, content
  - [ ] `GET /notes` — list by entityType + entityId, ordered by createdAt DESC
  - [ ] `PATCH /notes/:id` — update content (only own notes, SYSTEM notes read-only)
  - [ ] `DELETE /notes/:id` — soft delete (MANAGER role)
- [ ] Implement note type enforcement (AC: #2, #3, #4)
  - [ ] Validate noteType against NoteType enum: GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM
  - [ ] SYSTEM notes can only be created by service layer, not user API
  - [ ] Filter by noteType in list endpoint
- [ ] Implement `PATCH /notes/:id/pin` for pinning/unpinning notes (AC: #5)
  - [ ] Pinned notes appear at top of list regardless of date
- [ ] Validate entity existence before note creation (AC: #1)
  - [ ] Enforce BR-SYS-013 (polymorphic entity validation)

**FR/NFR:** FR85; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting note system referenced in §2.20 |
| API Contracts | §2.5 Cross-cutting Infrastructure | CRUD /notes, PATCH /notes/:id/pin |
| Data Models | §3.9 Cross-Cutting Module | Note: entityType, entityId, noteType (NoteType enum), content |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events for note CRUD |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic entity validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | §The Action Bar System | Notes accessible from record screens |
| Project Context | N/A | N/A — covered by Data Models |

---

## Story E8.3: Record Links Service

**User Story:** As a user, I want to create and view links between any two business records with typed relationships (CREATED_FROM, FULFILLS, PAYMENT_FOR, etc.), so that I can trace the full lifecycle of business transactions.

**Acceptance Criteria:**
1. GIVEN two business records WHEN a user creates a record link THEN it stores source entity (type + id), target entity (type + id), and link type
2. GIVEN the system creates a downstream record (e.g., Invoice from Sales Order) WHEN the record is created THEN a CREATED_FROM link is automatically established
3. GIVEN a record with links WHEN the links panel is viewed THEN it shows bidirectional links — the record appears as either source or target
4. GIVEN a link type FULFILLS WHEN a Sales Order is linked to a Dispatch THEN the link communicates that the dispatch fulfills the order
5. GIVEN a record link WHEN a user deletes it THEN only manual links can be deleted; system-generated links require MANAGER role

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/record-links` (AC: #1, #3)
  - [ ] `POST /record-links` — create manual link with source/target entities and link type
  - [ ] `GET /record-links` — list links for an entity (bidirectional query: where source OR target matches)
  - [ ] `DELETE /record-links/:id` — delete link (manual: STAFF, system: MANAGER)
- [ ] Implement auto-link creation for system-generated relationships (AC: #2)
  - [ ] Event handler creates CREATED_FROM links when downstream records are produced
  - [ ] PAYMENT_FOR links when payments are allocated
  - [ ] FULFILLS links when dispatches fulfill orders
- [ ] Implement bidirectional display logic (AC: #3)
  - [ ] Query: WHERE (sourceEntityType = X AND sourceEntityId = Y) OR (targetEntityType = X AND targetEntityId = Y)
  - [ ] Return with direction indicator (outgoing/incoming)
- [ ] Validate both source and target entities exist before link creation (AC: #1)
  - [ ] Enforce BR-SYS-013 for both sides

**FR/NFR:** FR87; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting record links referenced in §2.20 |
| API Contracts | §2.5 Cross-cutting Infrastructure | GET /record-links, POST /record-links, DELETE /record-links/:id |
| Data Models | §3.9 Cross-Cutting Module | RecordLink: sourceEntityType/Id, targetEntityType/Id, linkType (RecordLinkType enum: CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §15 Cross-Cutting Events | System-generated links created by event handlers |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | §The Action Bar System | Links as persistent tool with count badge |
| Project Context | N/A | N/A — covered by Data Models |

---

## Story E8.4: Cross-cutting UI Components

**User Story:** As a user, I want an attachment panel with drag-drop upload, a notes panel with timeline view, and a links panel showing related records, so that I can manage cross-cutting data from any record screen.

**Acceptance Criteria:**
1. GIVEN a record screen WHEN the user clicks the Attachments button in the action bar THEN a side panel opens showing the file list with name, size, date, and download/delete actions
2. GIVEN the attachment panel WHEN the user drags a file onto it THEN the upload process starts automatically: presign -> upload to S3 -> confirm -> list refreshes
3. GIVEN a record screen WHEN the user clicks a "Notes" tab or section THEN a timeline view shows notes in reverse chronological order with author, date, type badge, and content
4. GIVEN the notes panel WHEN the user clicks "Add Note" THEN a form appears with content text area and type selector (General, Internal, Customer Visible)
5. GIVEN a record screen WHEN the user clicks the Links button in the action bar THEN a panel shows all linked records grouped by link type with navigation links to each related record

**Key Tasks:**
- [ ] Build `<AttachmentPanel>` component (AC: #1, #2)
  - [ ] File list with name, size, type icon, date, actions (download, delete)
  - [ ] Drag-and-drop upload zone
  - [ ] Upload progress indicator
  - [ ] Integration with presign/confirm API flow
- [ ] Build `<NotesPanel>` component (AC: #3, #4)
  - [ ] Timeline view with note cards
  - [ ] Type badge (colour-coded: General grey, Internal blue, Customer green, System purple)
  - [ ] Add note form with rich text editor (basic) and type selector
  - [ ] Pin/unpin toggle
- [ ] Build `<LinksPanel>` component (AC: #5)
  - [ ] Grouped by link type (Created From, Fulfills, Payment For, etc.)
  - [ ] Each link shows entity type icon, display reference (e.g., "INV-0047"), and navigation link
  - [ ] "Add Link" button for manual link creation with entity search
- [ ] Integrate all panels with ActionBar persistent tools (AC: #1, #5)
  - [ ] Attachments button opens AttachmentPanel
  - [ ] Links button opens LinksPanel
  - [ ] Notes accessible via tab or section within record detail

**FR/NFR:** FR85, FR87; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | Cross-cutting UI components |
| API Contracts | §2.5 Cross-cutting Infrastructure | All attachment, note, and record-link endpoints |
| Data Models | §3.9 Cross-Cutting Module | Attachment, Note, RecordLink models and enums |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted from UI |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-006 to BR-SYS-010 (attachments), BR-SYS-013/014 (polymorphic) |
| UX Design Spec | §The Action Bar System | Persistent tools zone: Attachments (count badge), Links (count badge) |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E8.1 | Attachment Service | done |
| E8.2 | Notes Service | done |
| E8.3 | Record Links Service | done |
| E8.4 | Cross-cutting UI Components | done |

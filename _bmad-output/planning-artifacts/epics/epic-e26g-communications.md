# Epic E26g: Communications

> **Internal messaging, email integration (inbound IMAP), entity activity feeds, and document attachment management with version tracking.**

**Architecture:** §2.29 Communications
**Models:** 15 models
**State Machines:** SM:EmailThread, SM:InternalMessage
**Business Rules:** BR-COM-001 to BR-COM-017
**FRs:** FR145–FR148

**Dependencies:** E10 (Email Integration for SMTP outbound), E8 (Attachments for document management)

---

## Story E26g.S1: Internal Messaging

**User Story:** As a user, I want to send and receive internal messages and notifications within the ERP so that team communication is centralised alongside business data.

**Acceptance Criteria:**

```gherkin
Scenario: Send internal message
  Given I want to message a colleague about an invoice
  When I compose a message with subject, body, and linked invoice record
  Then the message is sent and the recipient is notified (FR145)
```

**Key Tasks:**
1. Create InternalMessage, MessageThread, MessageRecipient models
2. Implement messaging endpoints — send, read, reply, mark read
3. Build messaging UI — inbox, compose, thread view
4. Write tests

**FR/NFR References:** FR145, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR145) | Internal messaging |
| Architecture | §2.29 Communications | Messaging models |
| UX Design Specification | T1 (Entity List) | Message inbox layout |
| API Contracts | §2.24 Communications | Messaging endpoints |
| Data Models | §19 Communications | InternalMessage schemas |
| State Machine Reference | §17 Communications | SM:InternalMessage lifecycle |
| Event Catalog | §16 Communications | message.sent event |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-001 to BR-COM-005 |

---

## Story E26g.S2: Email Integration (Inbound IMAP)

**User Story:** As a user, I want to send and receive emails from within the ERP with automatic linking to relevant business entities.

**Acceptance Criteria:**

```gherkin
Scenario: Receive and link email
  Given IMAP is configured for the company
  When an email arrives from a known customer
  Then the email is automatically linked to the customer record (FR146)
  And appears in the customer's activity feed
```

**Key Tasks:**
1. Implement IMAP email fetch service (BullMQ job)
2. Implement automatic entity linking — match sender to customer/supplier
3. Build email viewing and composing within ERP
4. Write tests

**FR/NFR References:** FR146, NFR22, NFR34

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR146) | Email integration, entity linking |
| Architecture | §2.29 Communications | IMAP integration, email threading |
| UX Design Specification | T2 (Record Detail) | Email on entity detail view |
| API Contracts | §2.24 Communications | Email endpoints |
| Data Models | §19 Communications | EmailThread, EmailMessage schemas |
| State Machine Reference | §17 Communications | SM:EmailThread lifecycle |
| Event Catalog | §16 Communications | email.received, email.linked events |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-006 to BR-COM-012 |

---

## Story E26g.S3: Entity Activity Feeds

**User Story:** As a user, I want a chronological activity feed per entity showing all related interactions (calls, emails, notes, tasks, transactions) so that I have a complete history.

**Acceptance Criteria:**

```gherkin
Scenario: View customer activity feed
  Given a customer has emails, calls, invoices, and notes
  When I view the customer's activity feed
  Then all interactions are displayed chronologically (FR147)
  And each entry links to the source record
```

**Key Tasks:**
1. Implement activity feed aggregation service — gather activities from multiple sources
2. Build activity feed component — reusable across all entity types
3. Write tests

**FR/NFR References:** FR147, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR147) | Entity activity feeds |
| Architecture | §2.29 Communications | Activity feed aggregation |
| UX Design Specification | T2 (Record Detail) | Activity feed component |
| API Contracts | §2.24 Communications | Activity feed endpoint |
| Data Models | §19 Communications | ActivityFeedEntry (virtual/aggregated) |
| State Machine Reference | §17 Communications | N/A |
| Event Catalog | §16 Communications | All entity events feed into activity |
| Business Rules Compendium | §13 Additional (BR-COM) | BR-COM-013 to BR-COM-017 |

---

## Story E26g.S4: Document Attachment Versioning

**User Story:** As a user, I want to attach documents to any business record with version tracking and access control so that important documents are managed centrally.

**Acceptance Criteria:**

```gherkin
Scenario: Upload document with version tracking
  Given I am viewing a purchase order
  When I upload a contract PDF as attachment
  Then the document is stored with version 1 (FR148)
  And when I upload a new version, it becomes version 2 with the original preserved
```

**Key Tasks:**
1. Extend Attachment model with version tracking (version number, previousVersionId)
2. Implement version upload and history endpoints
3. Build version history UI on attachment detail
4. Write tests

**FR/NFR References:** FR148, NFR8

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.19 Communications (FR148) | Document attachment versioning |
| Architecture | §2.29 Communications, §2.8 Cross-Cutting | Attachment versioning |
| UX Design Specification | T2 (Record Detail) | Attachment panel with versions |
| API Contracts | §2.24 Communications | Attachment version endpoints |
| Data Models | §10 Cross-Cutting | Attachment model with version fields |
| State Machine Reference | §17 Communications | N/A |
| Event Catalog | §16 Communications | attachment.uploaded event |
| Business Rules Compendium | §13 Additional (BR-COM) | Version retention rules |

---

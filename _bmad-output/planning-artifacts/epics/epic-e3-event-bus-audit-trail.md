# Epic E3: Event Bus + Audit Trail

**Tier:** 0 | **Dependencies:** E2 | **Type:** Cross-cutting infrastructure
**FRs:** FR85 (audit logs), FR92 (immutable audit trail)
**Models:** Event bus infrastructure (in-process), AuditLog
**Events:** All event bus infrastructure: typed events, publish/subscribe
**Business Rules:** IMP-003 (immutable audit, 6-year retention), BR-SYS-013/014 (polymorphic entity pattern)
**NFRs:** NFR9 (audit trail immutable), NFR14 (financial modifications logged), NFR39 (append-only audit)

---

## Story E3.S1: Event Bus Infrastructure

**User Story:** As a developer, I want a typed, in-process event bus for cross-module communication, so that modules can publish and subscribe to business events without direct service-to-service coupling.

**Acceptance Criteria:**
1. GIVEN the EventBus class WHEN I emit a typed event (e.g., `invoice.created`) THEN all registered subscribers for that event are invoked with the correctly typed payload
2. GIVEN the BusinessEvents interface WHEN a developer registers a handler THEN TypeScript enforces the correct payload type for each event name
3. GIVEN an event handler that throws an error WHEN the event is published THEN the error is caught and logged without affecting the emitting module or other subscribers
4. GIVEN the emit() method WHEN called with an event THEN all subscribers execute asynchronously (do not block the emitter)
5. GIVEN a subscriber registration WHEN the same handler is registered twice for the same event THEN it is only invoked once per event emission (deduplication)
6. GIVEN the BusinessEvents interface WHEN new events are added THEN they follow the naming convention `{entity}.{action}` with past tense actions (created, updated, approved, posted)

**Key Tasks:**
- [ ] Define BusinessEvents interface (AC: #2, #6)
  - [ ] apps/api/src/core/events/event-bus.types.ts
  - [ ] System events: user.login, settings.updated
  - [ ] Placeholder event signatures for future modules
  - [ ] Follow naming convention: entity.action (past tense)
- [ ] Implement EventBus class (AC: #1, #3, #4)
  - [ ] apps/api/src/core/events/event-bus.ts
  - [ ] Generic emit<K>(event: K, data: BusinessEvents[K]) method
  - [ ] Generic on<K>(event: K, handler: Handler<K>) method
  - [ ] Async handler execution with error catching
  - [ ] Structured error logging for failed handlers
- [ ] Implement handler deduplication (AC: #5)
  - [ ] Track registered handlers by reference to prevent duplicates
- [ ] Create Fastify plugin for event bus (AC: #1)
  - [ ] Register as Fastify decorator: `fastify.eventBus`
  - [ ] Available to all modules via request.server.eventBus
- [ ] Write comprehensive tests (AC: #1-#6)
  - [ ] Test typed emission and subscription
  - [ ] Test error isolation between handlers
  - [ ] Test async execution
  - [ ] Test deduplication

**FR/NFR:** N/A (infrastructure); NFR22 (graceful failure handling)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 Event Architecture | In-process typed event bus, BusinessEvents interface, EventBus class with emit/on, event flow example |
| API Contracts | N/A | N/A — event bus is internal, not an API endpoint |
| Data Models | N/A | N/A — event bus is in-memory, no models |
| State Machines | N/A | N/A — event bus itself is not stateful |
| Event Catalog | §Overview, §Event Naming Convention | entity.action naming, past tense, typed payloads with entity IDs |
| Business Rules | N/A | N/A — event bus is infrastructure |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits a typed event via event bus; Rule 7: No cross-module direct service calls (use events) |

---

## Story E3.S2: Audit Trail Service

**User Story:** As an administrator, I want an immutable audit log recording every business entity mutation, so that I can trace all changes for compliance and investigation purposes.

**Acceptance Criteria:**
1. GIVEN a business event is emitted WHEN the audit subscriber receives it THEN an append-only AuditLog record is created with entityType, entityId, action (CREATE/UPDATE/DELETE/APPROVE/POST), beforeData (JSONB), afterData (JSONB), userId, isAiAction, aiConfidence, timestamp, and correlationId
2. GIVEN the audit_log table WHEN any UPDATE or DELETE SQL is attempted THEN the database rejects it via PostgreSQL rules (no_update_audit, no_delete_audit)
3. GIVEN the audit query API WHEN GET /system/audit-log is called with filters (entityType, entityId, action, userId, dateRange) THEN matching records are returned with cursor pagination
4. GIVEN the audit query API WHEN GET /system/audit-log/:entityType/:entityId is called THEN the full change history for that specific entity is returned in chronological order
5. GIVEN an AI-initiated action WHEN it is audit logged THEN isAiAction is true and aiConfidence contains the confidence score from the AI orchestration layer
6. GIVEN the retention policy WHEN audit records are queried THEN records older than 6 years are accessible (no automatic deletion per NFR40)

**Key Tasks:**
- [ ] Define AuditLog Prisma model (AC: #1)
  - [ ] Fields: entityType, entityId, action, beforeData (Json), afterData (Json), userId, isAiAction, aiConfidence (Decimal), correlationId, timestamp
  - [ ] No updatedAt field (append-only)
  - [ ] Indexes: [entityType, entityId], [userId, timestamp], [timestamp]
- [ ] Create PostgreSQL immutability rules (AC: #2)
  - [ ] CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING
  - [ ] CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING
  - [ ] Apply via Prisma migration
- [ ] Implement AuditService (AC: #1, #5)
  - [ ] apps/api/src/core/audit/audit.service.ts
  - [ ] log(entry: AuditEntry) method — append to audit_log
  - [ ] Subscribe to all business events via EventBus
  - [ ] Extract before/after data from event payloads
- [ ] Implement audit query routes (AC: #3, #4)
  - [ ] GET /system/audit-log — filtered, paginated
  - [ ] GET /system/audit-log/:entityType/:entityId — entity history
  - [ ] ADMIN minimum role required
- [ ] Write tests (AC: #1-#5)
  - [ ] Test record creation from event
  - [ ] Test immutability (UPDATE/DELETE fail)
  - [ ] Test query filtering and pagination
  - [ ] Test AI action logging

**FR/NFR:** FR85 (audit log viewing), FR92 (immutable audit); NFR14 (financial modifications logged), NFR39 (append-only), NFR40 (6-year retention)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.6 Immutable Audit Trail | PostgreSQL rules preventing UPDATE/DELETE, audit fields: entityType, entityId, action, beforeData, afterData, userId, isAiAction, aiConfidence, correlationId |
| API Contracts | §2.2 System Module | GET /system/audit-log, GET /system/audit-log/:entityType/:entityId |
| Data Models | §6.6 Audit Trail Fields | createdAt, updatedAt, createdBy, updatedBy on transactional entities |
| State Machines | N/A | N/A — audit log is append-only, no state transitions |
| Event Catalog | §15 Cross-Cutting Events — Audit Trail | Audit service subscribes to ALL business events, creates immutable records |
| Business Rules | §14 IMP-003, §12 BR-SYS-013/BR-SYS-014 | Immutable audit trail, 6-year retention, polymorphic entityType+entityId validation |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits event, audit service subscribes to all |

---

## Story E3.S3: Event Persistence & Dead Letter

**User Story:** As a developer, I want failed event handlers to be retried with exponential backoff and persisted to a dead-letter queue, so that transient failures do not cause permanent data loss.

**Acceptance Criteria:**
1. GIVEN an event handler that fails on first attempt WHEN the retry mechanism triggers THEN the handler is retried up to 3 times with exponential backoff (1s, 2s, 4s)
2. GIVEN an event handler that fails all 3 retries WHEN the final retry fails THEN the event is persisted to a dead-letter queue (BullMQ) with the full event payload and error details
3. GIVEN the dead-letter queue WHEN an administrator queries it THEN they can see failed events with event name, payload, error message, retry count, and timestamp
4. GIVEN a dead-letter item WHEN an administrator triggers a manual re-process THEN the event is re-emitted through the event bus for all subscribers
5. GIVEN event handlers WHEN they are designed THEN they must be idempotent: processing the same event twice produces no duplicate side effects, using sourceId/correlationId for deduplication

**Key Tasks:**
- [ ] Implement retry mechanism with exponential backoff (AC: #1)
  - [ ] Wrap event handler execution in retry logic
  - [ ] Configurable maxRetries (default 3) and backoff base (default 1s)
  - [ ] Log each retry attempt with retry count
- [ ] Implement dead-letter queue (AC: #2, #3)
  - [ ] Use BullMQ queue named "event-dead-letter"
  - [ ] Persist: eventName, payload, error, retryCount, originalTimestamp
  - [ ] Query API: GET /system/dead-letter-queue (ADMIN only)
- [ ] Implement manual re-process (AC: #4)
  - [ ] POST /system/dead-letter-queue/:id/reprocess
  - [ ] Re-emit event through EventBus
  - [ ] Mark dead-letter item as reprocessed
- [ ] Document idempotency requirement (AC: #5)
  - [ ] Add correlationId to all event payloads
  - [ ] Create idempotency helper utility
- [ ] Write tests (AC: #1-#4)
  - [ ] Test retry with mock failing handler
  - [ ] Test dead-letter persistence after max retries
  - [ ] Test re-processing from dead-letter

**FR/NFR:** N/A (infrastructure); NFR22 (graceful failure handling with retry and dead-letter)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 Event Architecture | Future migration to Redis Streams/NATS; event interface stays the same |
| API Contracts | N/A | N/A — dead-letter is internal infrastructure |
| Data Models | N/A | N/A — dead-letter stored in BullMQ/Redis, not Prisma |
| State Machines | N/A | N/A — dead-letter is a queue, not a state machine |
| Event Catalog | §Implementation Notes | Handlers must be idempotent, use correlationId for dedup, handlers must not throw (catch + log + retry) |
| Business Rules | N/A | N/A — infrastructure concern |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 4: Every state change emits event; reliability requires retry + dead-letter |

---

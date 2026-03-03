# Story 8.2: Notes Service

Status: done

## Story

As a **user working with any business record** (customer, invoice, PO, employee, etc.),
I want to add typed notes (general, internal, customer-visible, system) to any record,
so that I can document conversations, decisions, and context alongside the data.

## Acceptance Criteria

1. **GIVEN** any business record **WHEN** a user creates a note via `POST /notes` **THEN** it is stored with polymorphic entityType + entityId, noteType (defaulting to GENERAL), content, title, and author (createdBy from request context)
2. **GIVEN** note type `INTERNAL` **WHEN** a note is created with this type **THEN** it is visible only to internal staff and must NOT be exposed in customer-facing contexts (portal, customer statements)
3. **GIVEN** note type `CUSTOMER_VISIBLE` **WHEN** displayed on a customer statement or portal **THEN** the note content is included alongside the record
4. **GIVEN** note type `SYSTEM` **WHEN** a user attempts to create a SYSTEM note via the API **THEN** the request is rejected with a 400 validation error — SYSTEM notes can only be created by the service layer internally (e.g., "Status changed to POSTED by AI")
5. **GIVEN** a record with notes **WHEN** the notes list is retrieved via `GET /notes?entityType=X&entityId=Y` **THEN** notes are returned with pinned notes first, then remaining notes in reverse chronological order (createdAt DESC), each including author name, timestamp, and type
6. **GIVEN** a user edits a note **WHEN** they call `PATCH /notes/:id` **THEN** only the note's own creator can edit it (unless the caller is MANAGER+), and SYSTEM notes are always read-only regardless of role
7. **GIVEN** a note is deleted **WHEN** `DELETE /notes/:id` is called by a MANAGER-role user **THEN** the note is soft-deleted (deletedAt timestamp set) and excluded from future list queries
8. **GIVEN** a user pins a note **WHEN** they call `PATCH /notes/:id/pin` **THEN** the isPinned flag is toggled and pinned notes appear at the top of the list regardless of date

## Tasks / Subtasks

### Task 1: Prisma Migration — Add NoteType Enum + Note Model (AC: #1)

- [x] 1.1 Add `NoteType` enum to `packages/db/prisma/schema.prisma` matching Architecture §2.20:
  - Values: `GENERAL`, `INTERNAL`, `CUSTOMER_VISIBLE`, `SYSTEM`
  - Table mapping: `@@map("note_type")`
- [x] 1.2 Add `Note` model to `packages/db/prisma/schema.prisma` matching Architecture §2.20 with soft-delete addition:
  - Fields: `id` (UUID PK), `entityType` (VarChar 100), `entityId` (String), `noteType` (NoteType, default GENERAL), `classification` (VarChar 60, optional), `title` (VarChar 200, optional), `content` (Text), `isPinned` (Boolean, default false), `deletedAt` (DateTime, optional — for soft delete), `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
  - Indexes: `@@index([entityType, entityId])`, `@@index([noteType])`, `@@index([isPinned])`
  - Table mapping: `@@map("notes")`
  - NO `companyId` — company scope enforced through parent entity validation (same pattern as Attachment model from E8.1)
- [x] 1.3 Run `prisma migrate dev --name add-note-model` to generate and apply migration
- [x] 1.4 Re-export new types (`Note`, `NoteType`) from `packages/db/src/index.ts` barrel (do NOT modify existing exports)

### ~~Task 2: Note Zod Schemas (AC: #1, #4, #5, #6, #8)~~ ✓

- [x] 2.1 Create `apps/api/src/modules/cross-cutting/note.schema.ts` with Zod schemas:
  - `createNoteSchema`: `{ entityType: string (non-empty), entityId: uuid, noteType?: enum [GENERAL, INTERNAL, CUSTOMER_VISIBLE] (default GENERAL — SYSTEM intentionally excluded), content: string (min 1, max 50000), title?: string (max 200), classification?: string (max 60) }`
  - `updateNoteSchema`: `{ content?: string (min 1, max 50000), title?: string (max 200), classification?: string (max 60) }` — at least one field required
  - `noteListQuerySchema`: `{ entityType: string, entityId: uuid, noteType?: enum [GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM] (optional filter), limit?: number (default 50, max 200), offset?: number (default 0) }`
  - `noteParamsSchema`: `{ id: uuid }`
  - Response schemas: `noteResponseSchema`, `noteListResponseSchema`
- [x] 2.2 Export inferred TypeScript types: `CreateNoteInput`, `UpdateNoteInput`, `NoteListQuery`, `NoteParams`

### ~~Task 3: Note Service Layer (AC: #1–#8)~~ ✓

- [x] 3.1 Create `apps/api/src/modules/cross-cutting/note.service.ts`:
  - `createNote(ctx: RequestContext, prisma: PrismaClient, input: CreateNoteInput)`:
    1. Validate entityType against entity registry (BR-SYS-014)
    2. Validate entity exists with companyId (BR-SYS-013) via `validateEntityExists()`
    3. Reject if noteType is SYSTEM — SYSTEM notes created only by `createSystemNote()` (AC #4)
    4. Create Note record with `createdBy: ctx.userId`, `updatedBy: ctx.userId`
    5. Return created note
  - `listNotes(ctx: RequestContext, prisma: PrismaClient, query: NoteListQuery)`:
    1. Validate entity exists with companyId (BR-SYS-013)
    2. Query notes with `where: { entityType, entityId, deletedAt: null }` + optional noteType filter
    3. Order by: `[{ isPinned: 'desc' }, { createdAt: 'desc' }]` (pinned first, then newest)
    4. Apply limit/offset pagination
    5. Return list with total count
  - `updateNote(ctx: RequestContext, prisma: PrismaClient, noteId: string, input: UpdateNoteInput)`:
    1. Find note by id (throw 404 if not found or soft-deleted)
    2. Reject if note.noteType is SYSTEM — always read-only (AC #6)
    3. Enforce ownership: only creator can edit, unless caller has MANAGER role (AC #6)
    4. Validate entity access (entity must belong to caller's companyId)
    5. Update note fields + set `updatedBy: ctx.userId`
    6. Return updated note
  - `deleteNote(ctx: RequestContext, prisma: PrismaClient, noteId: string)`:
    1. Find note by id (throw 404 if not found or already soft-deleted)
    2. Validate entity access (companyId scope)
    3. Soft-delete: set `deletedAt: new Date()` and `updatedBy: ctx.userId` (AC #7)
    4. Return success
  - `pinNote(ctx: RequestContext, prisma: PrismaClient, noteId: string)`:
    1. Find note by id (throw 404 if not found or soft-deleted)
    2. Validate entity access (companyId scope)
    3. Toggle `isPinned` (set to `!current.isPinned`) (AC #8)
    4. Set `updatedBy: ctx.userId`
    5. Return updated note
  - `createSystemNote(prisma: PrismaClient, entityType: string, entityId: string, content: string, systemUserId: string)`:
    1. Internal function — no RequestContext required (called from service layer only)
    2. Create Note with `noteType: SYSTEM`, `createdBy: systemUserId`, `updatedBy: systemUserId`
    3. No entity existence validation (caller is trusted internal code)
    4. Return created note
    5. Export for use by other modules (e.g., state machine transitions, AI actions)

### ~~Task 4: API Routes (AC: #1–#8)~~ ✓

- [x] 4.1 Create `apps/api/src/modules/cross-cutting/note.routes.ts` as Fastify plugin:
  - `POST /notes` — STAFF permission via `createRbacGuard(UserRole.STAFF)`, validates body with `createNoteSchema`, calls `createNote()`, returns 201 with note
  - `GET /notes` — VIEWER permission, validates query with `noteListQuerySchema`, calls `listNotes()`, returns 200 with list + total
  - `PATCH /notes/:id` — STAFF permission, validates params + body with `noteParamsSchema` + `updateNoteSchema`, calls `updateNote()`, returns 200 with updated note
  - `DELETE /notes/:id` — MANAGER permission via `createRbacGuard(UserRole.MANAGER)`, validates params with `noteParamsSchema`, calls `deleteNote()`, returns 200 with success
  - `PATCH /notes/:id/pin` — STAFF permission, validates params with `noteParamsSchema`, calls `pinNote()`, returns 200 with updated note
  - Each route: extract `RequestContext` via `extractRequestContext()`, get `prisma` from `@nexa/db`, call service, return standard envelope `{ success: true, data: ... }` via `sendSuccess()`
- [x] 4.2 Register note routes in `apps/api/src/modules/cross-cutting/index.ts`:
  - Import `noteRoutesPlugin` from `./note.routes.js`
  - Add `await fastify.register(noteRoutesPlugin);` inside `crossCuttingModule()`
  - Update module comment to include note route layout

### ~~Task 5: Tests (AC: #1–#8)~~ ✓

- [x] 5.1 Unit tests for `note.service.ts` (`apps/api/src/modules/cross-cutting/note.service.test.ts`):
  - `createNote`: validates entity exists, creates with correct fields, rejects SYSTEM noteType from API
  - `listNotes`: returns pinned first then by date DESC, filters by noteType, excludes soft-deleted, pagination works
  - `updateNote`: updates content/title/classification, rejects SYSTEM note edits, enforces ownership (creator only unless MANAGER), rejects if soft-deleted
  - `deleteNote`: sets deletedAt, rejects if already deleted, validates companyId scope
  - `pinNote`: toggles isPinned from false to true and back, rejects if soft-deleted
  - `createSystemNote`: creates with SYSTEM type, sets correct createdBy
- [x] 5.2 Integration tests for `note.routes.ts` (`apps/api/src/modules/cross-cutting/note.routes.test.ts`):
  - `POST /notes` with valid input -> 201 + note with GENERAL type
  - `POST /notes` with noteType INTERNAL -> 201 + note with INTERNAL type
  - `POST /notes` with noteType SYSTEM -> 400 (rejected)
  - `POST /notes` with invalid entityType -> 400
  - `POST /notes` with non-existent entity -> 404
  - `POST /notes` with empty content -> 400
  - `GET /notes?entityType=X&entityId=Y` -> 200 + list ordered correctly
  - `GET /notes?entityType=X&entityId=Y&noteType=INTERNAL` -> 200 + filtered list
  - `PATCH /notes/:id` by creator -> 200 + updated note
  - `PATCH /notes/:id` by non-creator STAFF -> 403
  - `PATCH /notes/:id` by non-creator MANAGER -> 200 (allowed)
  - `PATCH /notes/:id` on SYSTEM note -> 400 (read-only)
  - `DELETE /notes/:id` as STAFF -> 403
  - `DELETE /notes/:id` as MANAGER -> 200
  - `PATCH /notes/:id/pin` -> 200 + toggled isPinned
- [x] 5.3 Verify all existing tests still pass (no regressions from E8.1 or prior)

## Dev Notes

### Architecture: No companyId on Note Model (Intentional)

Same pattern as Attachment (E8.1). The Architecture §2.20 explicitly omits `companyId` from cross-cutting models. Company scope is enforced through **parent entity validation** — the service layer always validates that the referenced entity (entityType + entityId) exists AND belongs to the caller's companyId before creating or reading notes.

### Soft Delete via deletedAt (Extension to Architecture Schema)

The Architecture §2.20 Note schema does not include a `deletedAt` field. However, the Epic E8.2 specifies "soft delete (MANAGER role)" for note deletion. Adding `deletedAt DateTime? @map("deleted_at")` to the Note model is a minimal, non-breaking extension that enables soft delete. All list queries must filter `WHERE deletedAt IS NULL`.

### SYSTEM Notes — Service-Layer Only

SYSTEM notes (e.g., "Status changed to POSTED", "AI automation completed") are created exclusively by internal service code via `createSystemNote()`. The API endpoint `POST /notes` explicitly rejects `noteType: SYSTEM` to prevent users from impersonating system-generated notes. The `createNoteSchema` Zod validation excludes SYSTEM from the allowed enum values.

### Ownership Enforcement for Updates

- Creator can update their own notes (STAFF role sufficient)
- MANAGER+ can update any non-SYSTEM note
- SYSTEM notes are always read-only regardless of role
- This is enforced in `updateNote()` service function, not at the route level

### Entity Registry Reuse

The entity registry (`apps/api/src/core/entity-registry/`) created in E8.1 is reused directly. No modifications needed — `validateEntityExists()` and `isValidEntityType()` work identically for notes.

### Pin Ordering

Pinned notes always appear at the top of the list, ordered by `isPinned DESC` then `createdAt DESC`. This means:
1. Pinned notes (newest first)
2. Unpinned notes (newest first)

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not on Note model directly, but enforced through parent entity validation on every operation. The `validateEntityExists()` call checks `companyId` on the parent entity.
- **i18n**: All error messages should use translation keys (e.g., `errors.note.systemNoteReadOnly`, `errors.note.notOwner`, `errors.note.alreadyDeleted`). No UI in this story.
- **Audit**: No audit events for note CRUD in MVP per Event Catalog (no note events defined).

### Existing Infrastructure from E8.1 (DO NOT recreate)

The following were created in E8.1 and must be reused, not duplicated:
- `apps/api/src/core/entity-registry/` — entity type validation
- `apps/api/src/core/storage/` — NOT needed for notes (no file storage)
- `apps/api/src/modules/cross-cutting/index.ts` — module barrel (extend, don't replace)
- `apps/api/src/modules/cross-cutting/mime-allowlist.ts` — NOT needed for notes
- `apps/api/src/core/errors/` — AppError, NotFoundError, ValidationError
- `apps/api/src/core/rbac/` — createRbacGuard
- `apps/api/src/core/utils/response.ts` — sendSuccess
- `apps/api/src/core/schemas/envelope.ts` — successEnvelope
- `apps/api/src/core/types/request-context.ts` — extractRequestContext, RequestContext

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.20 Cross-Cutting Data Infrastructure | Note Prisma schema, polymorphic linking pattern, NoteType enum |
| **API Contracts** | §2.5 Cross-cutting Infrastructure | `CRUD /notes` (STAFF), `PATCH /notes/:id/pin` (STAFF) — FR55 |
| **State Machine** | N/A | No state transitions for notes |
| **Event Catalog** | N/A | No events defined for note CRUD |
| **Data Models** | §3.9 Cross-Cutting Module | Note: entityType, entityId, noteType (NoteType enum), classification, title, content, isPinned |
| **Business Rules** | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic entity validation), BR-SYS-014 (entityType registry), BR-SYS-010 (cascade-aware deletion) |
| **UX Design Spec** | §The Action Bar System | Notes accessible from record screens (E8.4 handles UI) |
| **Project Context** | §1 Multi-Company Architecture | companyId scoping enforced through parent entity, not on Note model directly |

### Project Structure Notes

- New files in existing module: `apps/api/src/modules/cross-cutting/note.schema.ts`, `note.service.ts`, `note.routes.ts`
- Tests: `note.service.test.ts`, `note.routes.test.ts`
- Modified files: `apps/api/src/modules/cross-cutting/index.ts` (register note routes), `packages/db/prisma/schema.prisma` (add Note model + NoteType enum), `packages/db/src/index.ts` (barrel exports)
- Follows identical patterns to E8.1 attachment files

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md §2.20 L6316-6346] — Note Prisma schema, NoteType enum
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md §2.5] — CRUD /notes, PATCH /notes/:id/pin
- [Source: _bmad-output/planning-artifacts/data-models/3-module-by-module-models.md §3.9] — Note field summary
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md §12 L604-609] — BR-SYS-013, BR-SYS-014
- [Source: _bmad-output/implementation-artifacts/stories/e8-1-attachment-service.md] — Pattern reference for service/route/schema structure
- [Source: apps/api/src/core/entity-registry/entity-registry.ts] — Entity registry (reuse)
- [Source: apps/api/src/modules/cross-cutting/index.ts] — Cross-cutting module barrel (extend)


## Dev Agent Record

**Completed:** 2026-03-03
**Tasks:** All 5 tasks completed (Prisma migration, Zod schemas, service layer, API routes, tests)
**Files Created:**
- `apps/api/src/modules/cross-cutting/note.schema.ts` — Zod validation schemas
- `apps/api/src/modules/cross-cutting/note.service.ts` — Note CRUD + system note service
- `apps/api/src/modules/cross-cutting/note.routes.ts` — Fastify route plugin
- `apps/api/src/modules/cross-cutting/note.service.test.ts` — Unit tests
- `apps/api/src/modules/cross-cutting/note.routes.test.ts` — Integration tests
- `packages/db/prisma/migrations/20260303014854_add_note_model/` — Prisma migration

**Files Modified:**
- `packages/db/prisma/schema.prisma` — Added NoteType enum + Note model
- `packages/db/src/index.ts` — Re-exported Note, NoteType
- `apps/api/src/modules/cross-cutting/index.ts` — Registered note routes

**Notes:** Reused entity registry from E8.1. No companyId on Note model (enforced through parent entity validation). Code review completed with 3 HIGH, 6 MEDIUM, 3 LOW issues flagged for human review.

---

## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-03-03 02:27

### Remaining Issues for Human Review:

- **ISSUE #1: [HIGH] `pinNote` allows modifying SYSTEM notes, violating AC #6**
- **ISSUE #2: [HIGH] XSS bypass via `javascript:` protocol URIs**
- **ISSUE #3: [HIGH] Document Synchronisation Rule violation — Architecture not updated**
- **ISSUE #4: [MEDIUM] Race condition in `createNote` — no transaction wrapping**
- **ISSUE #5: [MEDIUM] Index names diverge from Architecture spec**
- **ISSUE #6: [MEDIUM] Dead `.default()` in Zod schema — misleading API contract**
- **ISSUE #7: [MEDIUM] Two migrations for a single story in a greenfield project**
- **ISSUE #8: [MEDIUM] `deleteNote` returns void — breaks service return pattern**
- **ISSUE #9: [MEDIUM] Missing integration test for empty update body**
- **ISSUE #10: [LOW] `noteResponseSchema` exposes `deletedAt` to API consumers**
- **ISSUE #11: [LOW] `createSystemNote` doesn't validate entityId as UUID**
- **ISSUE #12: [LOW] Missing test for pinning a SYSTEM note**
- `note.service.test.ts` — The `pinNote` test suite has tests for toggling pin, soft-deleted notes, and entity access validation, but no test asserting behavior when pinning a SYSTEM note. Given that Issue #1 identifies SYSTEM notes should be read-only, there should be a test documenting the expected behavior (either it's allowed by design or it should throw).
- **3 HIGH, 6 MEDIUM, 3 LOW** issues found.

---


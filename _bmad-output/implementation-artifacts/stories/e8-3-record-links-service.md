# Story 8.3: Record Links Service

Status: done

## Story

As a **user working with any business record** (invoice, sales order, purchase order, etc.),
I want to create and view links between any two business records with typed relationships (CREATED_FROM, FULFILLS, PAYMENT_FOR, etc.),
so that I can trace the full lifecycle of business transactions and navigate between related records.

## Acceptance Criteria

1. **GIVEN** two business records **WHEN** a user creates a record link via `POST /record-links` **THEN** it stores source entity (type + id), target entity (type + id), link type, and marks it as a manual link (`isSystemGenerated: false`)
2. **GIVEN** an internal service creates a downstream record (e.g., Invoice from Sales Order) **WHEN** the service calls `createSystemLink()` **THEN** a record link is created with `isSystemGenerated: true` — this is a service-layer-only function (not exposed via API), to be called by future module event handlers
3. **GIVEN** a record with links **WHEN** the links list is retrieved via `GET /record-links?entityType=X&entityId=Y` **THEN** it shows bidirectional links — the record appears as either source or target, with a `direction` indicator (`outgoing` or `incoming`) on each result
4. **GIVEN** a link type filter **WHEN** `GET /record-links?entityType=X&entityId=Y&linkType=FULFILLS` is called **THEN** only links of that type are returned
5. **GIVEN** a manual link (isSystemGenerated = false) **WHEN** a STAFF-role user calls `DELETE /record-links/:id` **THEN** the link is deleted
6. **GIVEN** a system-generated link (isSystemGenerated = true) **WHEN** a STAFF-role user calls `DELETE /record-links/:id` **THEN** the request is rejected with 403 — only MANAGER+ can delete system-generated links
7. **GIVEN** a duplicate link (same sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, and linkType) **WHEN** creation is attempted **THEN** the request is rejected with 409 Conflict
8. **GIVEN** an invalid entityType or non-existent entity **WHEN** link creation is attempted **THEN** the request is rejected — both source and target entities must pass `validateEntityExists()` (BR-SYS-013, BR-SYS-014)

## Tasks / Subtasks

### Task 1: Prisma Migration — Add RecordLinkType Enum + RecordLink Model (AC: #1, #2) ✅

- [x] 1.1 Add `RecordLinkType` enum to `packages/db/prisma/schema.prisma` matching Architecture §2.20:
  - Values: `CREATED_FROM`, `FULFILLS`, `PAYMENT_FOR`, `CREDIT_FOR`, `RELATES_TO`, `PARENT_CHILD`
  - Table mapping: `@@map("record_link_type")`
- [x] 1.2 Add `RecordLink` model to `packages/db/prisma/schema.prisma` matching Architecture §2.20:
  - Fields: `id` (UUID PK), `sourceEntityType` (VarChar 100), `sourceEntityId` (String), `targetEntityType` (VarChar 100), `targetEntityId` (String), `linkType` (RecordLinkType), `isSystemGenerated` (Boolean, default false), `description` (VarChar 500, optional — human-readable link description), `createdAt`, `updatedAt`, `createdBy` (String — user or system actor ID)
  - Indexes: `@@index([sourceEntityType, sourceEntityId])`, `@@index([targetEntityType, targetEntityId])`, `@@index([linkType])`
  - Unique constraint: `@@unique([sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, linkType])` — prevents duplicate links (AC #7)
  - Table mapping: `@@map("record_links")`
  - NO `companyId` — company scope enforced through parent entity validation (same pattern as Attachment and Note models from E8.1/E8.2)
- [x] 1.3 Run `prisma migrate dev --name add_record_link_model` to generate and apply migration
- [x] 1.4 Re-export new types (`RecordLink`, `RecordLinkType`) from `packages/db/src/index.ts` barrel (do NOT modify existing exports)

### Task 2: RecordLink Zod Schemas (AC: #1, #3, #4, #7, #8) ✅

- [x] 2.1 Create `apps/api/src/modules/cross-cutting/record-link.schema.ts` with Zod schemas:
  - `createRecordLinkSchema`: `{ sourceEntityType: string (non-empty, max 100), sourceEntityId: uuid, targetEntityType: string (non-empty, max 100), targetEntityId: uuid, linkType: enum [CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD], description?: string (max 500) }`
  - `recordLinkListQuerySchema`: `{ entityType: string (non-empty), entityId: uuid, linkType?: RecordLinkType (optional filter), direction?: enum [outgoing, incoming, all] (default all), limit?: number (default 50, max 200), offset?: number (default 0) }`
  - `recordLinkParamsSchema`: `{ id: uuid }`
  - Response schemas: `recordLinkResponseSchema` (includes `direction` field for list responses), `recordLinkListResponseSchema`
- [x] 2.2 Export inferred TypeScript types: `CreateRecordLinkInput`, `RecordLinkListQuery`, `RecordLinkParams`

### Task 3: RecordLink Service Layer (AC: #1–#8) ✅

- [x] 3.1 Create `apps/api/src/modules/cross-cutting/record-link.service.ts`:
  - `createRecordLink(ctx: RequestContext, prisma: PrismaClient, input: CreateRecordLinkInput)`:
    1. Validate sourceEntityType against entity registry (BR-SYS-014) via `isValidEntityType()`
    2. Validate targetEntityType against entity registry (BR-SYS-014) via `isValidEntityType()`
    3. Validate source entity exists with companyId (BR-SYS-013) via `validateEntityExists()`
    4. Validate target entity exists with companyId (BR-SYS-013) via `validateEntityExists()`
    5. Check for duplicate link — query by source + target + linkType; throw 409 if exists (AC #7)
    6. Create RecordLink record with `isSystemGenerated: false`, `createdBy: ctx.userId`
    7. Return created link
  - `listRecordLinks(ctx: RequestContext, prisma: PrismaClient, query: RecordLinkListQuery)`:
    1. Validate entityType against entity registry (BR-SYS-014)
    2. Validate entity exists with companyId (BR-SYS-013) via `validateEntityExists()`
    3. Build bidirectional query (AC #3):
       - If direction = `outgoing`: WHERE sourceEntityType = X AND sourceEntityId = Y
       - If direction = `incoming`: WHERE targetEntityType = X AND targetEntityId = Y
       - If direction = `all` (default): WHERE (source matches) OR (target matches)
    4. Optional linkType filter (AC #4)
    5. Order by `createdAt DESC`
    6. Apply limit/offset pagination
    7. Map each result to include `direction: 'outgoing' | 'incoming'` based on which side matched the query entity
    8. Return list with total count
  - `deleteRecordLink(ctx: RequestContext, prisma: PrismaClient, linkId: string)`:
    1. Find link by id (throw 404 if not found)
    2. Validate that caller can access both linked entities (validate at least one side belongs to caller's companyId)
    3. If `isSystemGenerated: true` AND caller role < MANAGER → throw 403 (AC #6)
    4. If `isSystemGenerated: false` → STAFF role sufficient (AC #5)
    5. Hard-delete the RecordLink record
    6. Return success
  - `createSystemLink(prisma: PrismaClient, input: { sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, linkType, description? }, actorId: string)`:
    1. Internal function — no RequestContext required (called from service layer / event handlers only) (AC #2)
    2. Create RecordLink with `isSystemGenerated: true`, `createdBy: actorId`
    3. Skip duplicate check — upsert-like behavior (if already exists, return existing)
    4. Return created or existing link
    5. Export for use by future modules (Sales → Invoice, PO → GRN, Payment → Invoice, etc.)

### Task 4: API Routes (AC: #1, #3–#8) ✅

- [x] 4.1 Create `apps/api/src/modules/cross-cutting/record-link.routes.ts` as Fastify plugin:
  - `POST /record-links` — STAFF permission via `createRbacGuard(UserRole.STAFF)`, validates body with `createRecordLinkSchema`, calls `createRecordLink()`, returns 201 with link
  - `GET /record-links` — VIEWER permission via `createRbacGuard(UserRole.VIEWER)`, validates query with `recordLinkListQuerySchema`, calls `listRecordLinks()`, returns 200 with list + total
  - `DELETE /record-links/:id` — STAFF permission via `createRbacGuard(UserRole.STAFF)` (service layer enforces MANAGER for system links), validates params with `recordLinkParamsSchema`, calls `deleteRecordLink()`, returns 204 No Content
  - Each route: extract `RequestContext` via `extractRequestContext()`, get `prisma` from `@nexa/db`, call service, return standard envelope via `sendSuccess()`
- [x] 4.2 Register record-link routes in `apps/api/src/modules/cross-cutting/index.ts`:
  - Import `recordLinkRoutesPlugin` from `./record-link.routes.js`
  - Add `await fastify.register(recordLinkRoutesPlugin);` inside `crossCuttingModule()`
  - Update module comment to include record-link route layout
  - **DO NOT modify or remove** existing attachment or note route registrations

### Task 5: Tests (AC: #1–#8) ✅

- [x] 5.1 Unit tests for `record-link.service.ts` (`apps/api/src/modules/cross-cutting/record-link.service.test.ts`):
  - `createRecordLink`: validates both source and target entities exist (BR-SYS-013), rejects invalid entityType (BR-SYS-014), creates with correct fields and `isSystemGenerated: false`, rejects duplicate link (409)
  - `listRecordLinks`: returns bidirectional links with correct `direction` indicator, filters by linkType, filters by direction (outgoing/incoming/all), pagination works, validates entity access
  - `deleteRecordLink`: deletes manual link as STAFF, rejects system link deletion by STAFF (403), allows system link deletion by MANAGER, rejects if link not found (404), validates entity access
  - `createSystemLink`: creates with `isSystemGenerated: true`, upserts (returns existing on duplicate), sets correct createdBy
- [x] 5.2 Integration tests for `record-link.routes.ts` (`apps/api/src/modules/cross-cutting/record-link.routes.test.ts`):
  - `POST /record-links` with valid input → 201 + link with RELATES_TO type
  - `POST /record-links` with all linkType values → 201 each (CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD)
  - `POST /record-links` with invalid sourceEntityType → 400
  - `POST /record-links` with invalid targetEntityType → 400
  - `POST /record-links` with non-existent source entity → 404
  - `POST /record-links` with non-existent target entity → 404
  - `POST /record-links` duplicate link → 409 Conflict
  - `GET /record-links?entityType=X&entityId=Y` → 200 + bidirectional list with direction indicators
  - `GET /record-links?entityType=X&entityId=Y&linkType=FULFILLS` → 200 + filtered list
  - `GET /record-links?entityType=X&entityId=Y&direction=outgoing` → 200 + outgoing only
  - `GET /record-links?entityType=X&entityId=Y&direction=incoming` → 200 + incoming only
  - `DELETE /record-links/:id` manual link as STAFF → 204
  - `DELETE /record-links/:id` system link as STAFF → 403
  - `DELETE /record-links/:id` system link as MANAGER → 204
  - `DELETE /record-links/:id` non-existent → 404
- [x] 5.3 Verify all existing tests still pass (no regressions from E8.1, E8.2, or prior)

## Dev Notes

### Architecture: No companyId on RecordLink Model (Intentional)

Same pattern as Attachment (E8.1) and Note (E8.2). The Architecture §2.20 explicitly omits `companyId` from cross-cutting models. Company scope is enforced through **parent entity validation** — the service layer always validates that both the source and target entities exist AND belong to the caller's companyId before creating or querying links.

### isSystemGenerated Flag (Extension to Architecture Schema)

The Architecture §2.20 RecordLink schema does not include an `isSystemGenerated` field. However, Epic E8.3 AC #5 requires distinguishing between manual and system-generated links for deletion permissions. Adding `isSystemGenerated Boolean @default(false)` is a minimal, non-breaking extension. This flag controls:
- **Manual links** (`isSystemGenerated: false`): Created via `POST /record-links` API, deletable by STAFF
- **System links** (`isSystemGenerated: true`): Created by `createSystemLink()` service function, deletable only by MANAGER+

### Bidirectional Query Pattern

Record links are stored unidirectionally (source → target) but queried bidirectionally. When listing links for entity X, the query is:
```sql
WHERE (sourceEntityType = 'X' AND sourceEntityId = 'id')
   OR (targetEntityType = 'X' AND targetEntityId = 'id')
```
Each result includes a computed `direction` field:
- `outgoing`: The queried entity is the source (it links TO the target)
- `incoming`: The queried entity is the target (it is linked FROM the source)

### Auto-Link Creation (Future Modules)

The `createSystemLink()` function is a **framework utility** for future modules to use when creating downstream documents. It is NOT wired to any event handlers in this story because no downstream modules (Sales, Purchasing, Finance) exist yet. When those modules are implemented, they will:
1. Import `createSystemLink` from `@nexa/api/modules/cross-cutting`
2. Call it when creating derived documents (e.g., Invoice from Sales Order → CREATED_FROM link)
3. Call it when allocating payments (e.g., Payment → Invoice → PAYMENT_FOR link)

### Duplicate Link Prevention

A unique constraint `@@unique([sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, linkType])` prevents duplicate links at the database level. The service layer also pre-checks before creation to provide a friendly 409 error message. The `createSystemLink()` function uses upsert-like behavior (return existing if duplicate) to handle idempotent event handlers.

### Entity Registry Reuse

The entity registry (`apps/api/src/core/entity-registry/`) created in E8.1 is reused directly. No modifications needed — `validateEntityExists()` and `isValidEntityType()` work identically for record links. Both source AND target entities must pass validation.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not on RecordLink model directly, but enforced through parent entity validation on BOTH linked entities. The `validateEntityExists()` call checks `companyId` on each entity.
- **i18n**: All error messages should use translation keys (e.g., `errors.recordLink.duplicateLink`, `errors.recordLink.systemLinkDeleteForbidden`, `errors.recordLink.entityNotFound`). No UI in this story.
- **Audit**: No audit events for record link CRUD in MVP per Event Catalog (no record-link events defined).

### Existing Infrastructure from E8.1/E8.2 (DO NOT recreate)

The following were created in E8.1/E8.2 and must be reused, not duplicated:
- `apps/api/src/core/entity-registry/` — entity type validation
- `apps/api/src/modules/cross-cutting/index.ts` — module barrel (extend, don't replace)
- `apps/api/src/core/errors/` — AppError, NotFoundError, ValidationError
- `apps/api/src/core/rbac/` — createRbacGuard
- `apps/api/src/core/utils/response.ts` — sendSuccess
- `apps/api/src/core/schemas/envelope.ts` — successEnvelope
- `apps/api/src/core/types/request-context.ts` — extractRequestContext, RequestContext

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.20 Cross-Cutting Data Infrastructure | RecordLink Prisma schema, polymorphic linking pattern, RecordLinkType enum |
| **API Contracts** | §2.5 Cross-cutting Infrastructure | `GET /record-links` (VIEWER), `POST /record-links` (STAFF), `DELETE /record-links/:id` (STAFF/MANAGER) — FR87 |
| **State Machine** | N/A | No state transitions for record links |
| **Event Catalog** | §15 Cross-Cutting Events | System-generated link creation by event handlers (future modules) |
| **Data Models** | §3.9 Cross-Cutting Module | RecordLink: sourceEntityType/Id, targetEntityType/Id, linkType (RecordLinkType enum) |
| **Business Rules** | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic entity validation on both sides), BR-SYS-014 (entityType registry), BR-SYS-010 (cascade-aware deletion) |
| **UX Design Spec** | §The Action Bar System | Links as persistent tool with count badge (E8.4 handles UI) |
| **Project Context** | §1 Multi-Company Architecture | companyId scoping enforced through parent entity, not on RecordLink model directly |

### Project Structure Notes

- New files in existing module: `apps/api/src/modules/cross-cutting/record-link.schema.ts`, `record-link.service.ts`, `record-link.routes.ts`
- Tests: `record-link.service.test.ts`, `record-link.routes.test.ts`
- Modified files: `apps/api/src/modules/cross-cutting/index.ts` (register record-link routes), `packages/db/prisma/schema.prisma` (add RecordLink model + RecordLinkType enum), `packages/db/src/index.ts` (barrel exports)
- Follows identical patterns to E8.1 attachment and E8.2 note files

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md §2.20 L6157-6737] — RecordLink Prisma schema, RecordLinkType enum
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md §2.5] — GET/POST/DELETE /record-links
- [Source: _bmad-output/planning-artifacts/data-models/3-module-by-module-models.md §3.9 L925-932] — RecordLink field summary
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md §12 L604-609] — BR-SYS-013, BR-SYS-014, BR-SYS-010
- [Source: _bmad-output/planning-artifacts/event-catalog.md §15] — Cross-cutting events
- [Source: _bmad-output/implementation-artifacts/stories/e8-2-notes-service.md] — Pattern reference for service/route/schema structure
- [Source: apps/api/src/core/entity-registry/entity-registry.ts] — Entity registry (reuse)
- [Source: apps/api/src/modules/cross-cutting/index.ts] — Cross-cutting module barrel (extend)


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-03-03 03:26

### Remaining Issues for Human Review:

- ISSUE #1: [HIGH] TOCTOU race condition in RELATES_TO reverse duplicate check — `record-link.service.ts:76-98`. Two concurrent requests creating A→B and B→A RELATES_TO will both pass the forward findUnique (line 52) and reverse findUnique (line 77), then both succeed at create (line 101). The unique constraint only prevents same-direction duplicates, not logical reverse-direction duplicates. The P2002 catch on line 118 won't fire because A→B and B→A are different rows to the unique index. Result: both links exist — a logical duplicate the code was explicitly trying to prevent.
- ISSUE #2: [HIGH] `createRecordLink` entity validation and creation are not wrapped in a transaction — `record-link.service.ts:27-129`. Four+ separate DB operations (2x validateEntityExists, 1-2x findUnique, 1x create) without a transaction. Between entity validation (lines 45-48) and creation (line 101), entities could be deleted by a concurrent operation, creating a link referencing non-existent entities and violating AC #8 / BR-SYS-013. The sibling note service uses `prisma.$transaction()` for its mutation operations.
- ISSUE #3: [MEDIUM] `createSystemLink` does not validate entity existence, only entity type — `record-link.service.ts:337-351`. Calls `isValidEntityType()` but never `validateEntityExists()`. Internal callers can create links to non-existent entity IDs (typos, stale refs, deleted entities). BR-SYS-013 ("polymorphic entity validation on both sides") makes no exception for internal callers. Results in orphaned links pointing to nothing.
- ISSUE #4: [MEDIUM] Spec/code mismatch on `deleteRecordLink` access validation — `record-link.service.ts:217-267`. Story task 3.1 step 2 says "validate at least one side belongs to caller's companyId" but code enforces "every checkable side must pass AND at least one must be checkable" (lines 255-259). These are contradictory requirements. If the intent is "at least one side," the code is too strict and will reject legitimate deletes.
- ISSUE #5: [MEDIUM] `sourceEntityId`/`targetEntityId` enforced as UUID but architecture says String — `record-link.schema.ts:19,21`. Both use `z.uuid()`, but Prisma schema defines these as plain `String` and Architecture §2.20 says "String." If any future entity uses non-UUID identifiers (CUIDs, numeric), the record links API will reject valid links. This locks the entire cross-cutting link system to UUID-only entities.
- ISSUE #6: [MEDIUM] `recordLinkListQuerySchema` has no `.max()` on entityType — `record-link.schema.ts:27`. List query defines `entityType: z.string().min(1)` with no max length, while create schema constrains source/target entity types to `.max(100)`. Inconsistent input validation; list endpoint accepts arbitrarily long strings.
- ISSUE #7: [MEDIUM] No test coverage for the RELATES_TO concurrent race condition — `record-link.service.test.ts`. Tests cover sequential reverse duplicate rejection (line 301) and P2002 forward race (line 242), but no test documents or verifies the concurrent reverse-direction race from Issue #1. The known limitation is completely invisible to future developers.
- ISSUE #8: [MEDIUM] `listRecordLinks` returns linked entity IDs without validating their company scope — `record-link.service.ts:135-193`. Only validates the queried entity's company (line 142), then returns all matching links exposing the other side's entityType and entityId. If a link was created through `createSystemLink` (which skips company validation) or data corruption, response leaks cross-company entity references.
- ISSUE #9: [LOW] `PARENT_CHILD` link type may need reverse duplicate protection like RELATES_TO — `record-link.service.ts:76`. Only RELATES_TO gets the reverse check. If A→B PARENT_CHILD and B→A PARENT_CHILD are both created, you get contradictory parent-child relationships with no guard. Architecture doesn't clarify which link types are directional vs symmetric.
- ISSUE #10: [LOW] Route integration tests create a new Fastify instance per test — `record-link.routes.test.ts:76-105`. Every test calls `buildTestApp()`, `app.register()`, `await app.ready()`, `await app.close()`. ~20 instances created and destroyed. A shared `beforeAll/afterAll` instance per describe block would be significantly faster since the service layer is fully mocked.
- ISSUE #11: [LOW] `createSystemLink` has redundant runtime type guards — `record-link.service.ts:318-335`. Checks like `typeof input.sourceEntityType !== 'string'` are redundant because TypeScript's type system already constrains the parameter. Adds 18 lines of boilerplate cargo-culted from sibling `createSystemNote`.
- ISSUE #12: [LOW] DELETE route has no response schema declaration — `record-link.routes.ts:83-85`. POST and GET routes declare response schemas in Fastify's schema object, but DELETE only declares `params`. While correct for 204 No Content, the inconsistency means Fastify applies no serialization/validation to the DELETE response at all, unlike its siblings.
- Summary: 2 HIGH, 6 MEDIUM, 4 LOW issues found

---


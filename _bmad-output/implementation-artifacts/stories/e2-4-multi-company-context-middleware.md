# Story E2.S4: Multi-Company Context Middleware

Status: done

## Story

As a user working across multiple companies,
I want to switch between companies and have all queries automatically scoped to my selected company,
so that I see only the data relevant to my current company context.

## Acceptance Criteria

1. GIVEN an authenticated request WHEN the `X-Company-ID` header is present THEN the middleware sets `ctx.companyId` to that value and all subsequent queries scope by that companyId
2. GIVEN an authenticated request WHEN no `X-Company-ID` header is present THEN the middleware uses the user's default company (from `User.companyId`)
3. GIVEN a user without access to the requested companyId WHEN they set `X-Company-ID` THEN a 403 FORBIDDEN error is returned with code `COMPANY_ACCESS_DENIED`
4. GIVEN a request context WHEN any repository method is called THEN it receives companyId from the request context and includes it in every WHERE clause
5. GIVEN the RegisterSharingRule configuration WHEN a shared entity (e.g., Customer) is queried THEN the `getVisibleCompanyIds()` helper determines the full set of visible company IDs and the query uses `companyId IN [...]`
6. GIVEN the company switching API WHEN `POST /system/companies/:id/switch` is called THEN the user's session default company is updated and the new company context is returned

## Tasks / Subtasks

- [x] Task 1: Extend Fastify request type augmentation with companyId (AC: #1, #2, #4)
  - [x] 1.1 In `apps/api/src/core/auth/jwt-verify.hook.ts`, add `companyId: string` to the `FastifyRequest` interface augmentation (line ~13)
  - [x] 1.2 Add `fastify.decorateRequest('companyId', '')` in the plugin function (after line 53)

- [x] Task 2: Define RequestContext interface (AC: #4)
  - [x] 2.1 Create `apps/api/src/core/types/request-context.ts`
  - [x] 2.2 Define `RequestContext` interface: `{ userId: string; tenantId: string; companyId: string; role: string; enabledModules: string[] }`
  - [x] 2.3 Add helper `extractRequestContext(request: FastifyRequest): RequestContext` that reads decorated properties from the Fastify request
  - [x] 2.4 Export from a barrel: `apps/api/src/core/types/index.ts`

- [x] Task 3: Implement company context middleware (AC: #1, #2, #3)
  - [x] 3.1 Create `apps/api/src/core/middleware/company-context.ts`
  - [x] 3.2 Implement as a Fastify plugin using `fastify-plugin` (same pattern as `jwt-verify.hook.ts`)
  - [x] 3.3 Add `onRequest` hook that runs AFTER jwt-verify (register after jwt-verify in app.ts)
  - [x] 3.4 Skip for public routes — reuse the same `isPublicRoute()` check from jwt-verify or check if `request.userId` is empty
  - [x] 3.5 Read `X-Company-ID` header from `request.headers['x-company-id']`
  - [x] 3.6 If header present: validate UUID format, set `request.companyId` to header value
  - [x] 3.7 If header absent: query `User.companyId` from database using `request.userId` and `request.tenantId`, set `request.companyId` to user's default company
  - [x] 3.8 Verify user has access: call `resolveUserRole(prisma, request.userId, request.companyId)` from `@nexa/db`
  - [x] 3.9 If `resolveUserRole` returns `null`: throw `AuthError('COMPANY_ACCESS_DENIED', 'You do not have access to this company', 403)`
  - [x] 3.10 If access confirmed: the role returned is the effective role for this company context — update `request.userRole` with the resolved role (this may differ from the JWT role if a per-company override exists)
  - [x] 3.11 Verify the target company exists and is active: query `CompanyProfile` by id where `isActive = true`

- [x] Task 4: Write company context middleware tests (AC: #1, #2, #3)
  - [x] 4.1 Create `apps/api/src/core/middleware/company-context.test.ts`
  - [x] 4.2 Test: X-Company-ID header present + user has access → companyId set correctly
  - [x] 4.3 Test: X-Company-ID header absent → falls back to user's default company
  - [x] 4.4 Test: X-Company-ID for company user has NO access to → 403 COMPANY_ACCESS_DENIED
  - [x] 4.5 Test: X-Company-ID with invalid UUID → 400 validation error
  - [x] 4.6 Test: X-Company-ID for inactive/non-existent company → 404 or 403
  - [x] 4.7 Test: Public routes skip company context middleware
  - [x] 4.8 Test: Per-company role override takes effect (e.g., ADMIN globally but VIEWER for specific company)
  - [x] 4.9 Use the same Vitest + Fastify test pattern as existing tests (`buildApp()` → `inject()`)

- [x] Task 5: Implement sharing-aware query helper (AC: #5)
  - [x] 5.1 Create `apps/api/src/core/utils/company-query.ts`
  - [x] 5.2 Implement `buildCompanyFilter(prisma: PrismaClient, companyId: string, entityType?: string): Promise<{ companyId: string } | { companyId: { in: string[] } }>`
  - [x] 5.3 If `entityType` is provided: call `getVisibleCompanyIds(prisma, companyId, entityType)` from `@nexa/db`
  - [x] 5.4 If result has more than 1 company: return `{ companyId: { in: visibleIds } }`
  - [x] 5.5 If result has exactly 1 company (or no entityType): return `{ companyId: companyId }`
  - [x] 5.6 Export from `apps/api/src/core/utils/index.ts` barrel (create if not exists)

- [x] Task 6: Write sharing-aware query helper tests (AC: #5)
  - [x] 6.1 Create `apps/api/src/core/utils/company-query.test.ts`
  - [x] 6.2 Test: No sharing rules → returns `{ companyId: 'xxx' }` (single company)
  - [x] 6.3 Test: SELECTED sharing → returns `{ companyId: { in: [...] } }` with visible companies
  - [x] 6.4 Test: ALL_COMPANIES sharing → returns `{ companyId: { in: [...] } }` with all company IDs
  - [x] 6.5 Test: No entityType provided → returns simple `{ companyId: 'xxx' }`
  - [x] 6.6 Mock `getVisibleCompanyIds` from `@nexa/db` (do not hit real DB)

- [x] Task 7: Implement company switch endpoint (AC: #6)
  - [x] 7.1 Create `apps/api/src/modules/system/company.routes.ts`
  - [x] 7.2 Implement `POST /system/companies/:id/switch` route
  - [x] 7.3 Validate `:id` param is a valid UUID
  - [x] 7.4 Verify user has access to target company via `resolveUserRole(prisma, userId, targetCompanyId)`
  - [x] 7.5 If no access: return 403 COMPANY_ACCESS_DENIED
  - [x] 7.6 Update `User.companyId` in database to the new company ID
  - [x] 7.7 Return success response: `{ success: true, data: { companyId, companyName, role } }` using `sendSuccess` helper
  - [x] 7.8 Create Zod request/response schemas in `apps/api/src/modules/system/company.schema.ts`

- [x] Task 8: Write company switch endpoint tests (AC: #6)
  - [x] 8.1 Create `apps/api/src/modules/system/company.routes.test.ts`
  - [x] 8.2 Test: Valid switch to accessible company → 200 with new company context
  - [x] 8.3 Test: Switch to company without access → 403 COMPANY_ACCESS_DENIED
  - [x] 8.4 Test: Switch to non-existent company → 404 COMPANY_NOT_FOUND
  - [x] 8.5 Test: Switch updates User.companyId in database
  - [x] 8.6 Test: Unauthenticated request → 401

- [x] Task 9: Register middleware and routes in app.ts (AC: #1-#6)
  - [x] 9.1 Import `companyContextPlugin` in `apps/api/src/app.ts`
  - [x] 9.2 Register AFTER `jwtVerifyPlugin` (company context depends on userId being set)
  - [x] 9.3 Import `systemRoutesPlugin` (or company routes)
  - [x] 9.4 Register system routes with prefix `/system`
  - [x] 9.5 Update the plugin registration order comment in app.ts

- [x] Task 10: Verify all tests pass and no regressions
  - [x] 10.1 Run existing E2 tests: `pnpm --filter api test`
  - [x] 10.2 Verify auth tests still pass (jwt-verify changes must not break existing tests)
  - [x] 10.3 Verify new middleware tests pass
  - [x] 10.4 Verify company switch endpoint tests pass

## Dev Notes

### Key Architecture Patterns

- **Middleware ordering is CRITICAL**: company-context must register AFTER jwt-verify because it depends on `request.userId` and `request.tenantId` being set. Register it AFTER the JWT plugin but BEFORE routes.
- **Database access**: The middleware needs a PrismaClient instance to look up user's default company and verify access. Accept it via plugin options or resolve from Fastify context. Follow the same dependency injection pattern used in auth routes.
- **Role re-resolution**: The JWT carries the user's global role, but a per-company override may exist. The middleware MUST call `resolveUserRole()` for the target company and update `request.userRole` accordingly. This is critical — downstream RBAC guards (E2-5) depend on `request.userRole` being the effective role for the current company.

### Existing Code to Reuse (DO NOT Reinvent)

| Existing Code | Location | Use For |
|---------------|----------|---------|
| `resolveUserRole()` | `packages/db/src/utils/rbac.ts` (exported from `@nexa/db`) | Verify user access to company + get effective role |
| `getVisibleCompanyIds()` | `packages/db/src/utils/sharing.ts` (exported from `@nexa/db`) | Build sharing-aware query filters |
| `AuthError` | `apps/api/src/core/errors/auth-error.ts` | 401/403 error responses |
| `sendSuccess()` | `apps/api/src/core/utils/response.ts` | Standard response envelope |
| `successEnvelope()` | `apps/api/src/core/auth/auth.schema.ts` | Zod schema for response validation |
| `isPublicRoute()` | `apps/api/src/core/auth/jwt-verify.hook.ts` | Skip middleware for public routes |
| `fastify-plugin` pattern | `apps/api/src/core/auth/jwt-verify.hook.ts` | Plugin registration pattern |
| `PrismaClient` singleton | `packages/db/src/client.ts` | Database access |

### Fastify Request Type Augmentation (Current State)

The JWT verify hook (`jwt-verify.hook.ts:11-18`) already augments `FastifyRequest` with:
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    tenantId: string;
    userRole: string;
    enabledModules: string[];
  }
}
```

Add `companyId: string` to this same augmentation. Do NOT create a separate augmentation — Fastify merges interface declarations but having them in one place is clearer.

### Database Models (Prisma Schema — Already Created in E1)

**User** (`packages/db/prisma/schema.prisma:444-473`):
- `companyId: String` — user's default company (FK to CompanyProfile)
- This is the fallback when no X-Company-ID header is provided

**UserCompanyRole** (`packages/db/prisma/schema.prisma:420-438`):
- `userId: String`, `companyId: String?` (null = global role), `role: UserRole`
- Queried by `resolveUserRole()` to check company access

**CompanyProfile** (`packages/db/prisma/schema.prisma:251-319`):
- `isActive: Boolean` — must check this when validating company exists
- `name: String` — return in company switch response

**RegisterSharingRule** (`packages/db/prisma/schema.prisma:378-399`):
- Queried by `getVisibleCompanyIds()` — already implemented in `@nexa/db`

### Error Codes

| Error Code | HTTP Status | When |
|------------|-------------|------|
| `COMPANY_ACCESS_DENIED` | 403 | User has no role for the target company |
| `COMPANY_NOT_FOUND` | 404 | Company does not exist or is inactive |
| `UNAUTHORIZED` | 401 | No authentication token |

Use `AuthError` for 403 errors (it already supports 403 status code). Use `NotFoundError` for 404 errors.

### API Endpoint: Company Switch

```
POST /system/companies/:id/switch
Authorization: Bearer <accessToken>

Response 200:
{
  "success": true,
  "data": {
    "companyId": "uuid",
    "companyName": "Acme Ltd",
    "role": "ADMIN"
  }
}

Response 403:
{
  "success": false,
  "error": {
    "code": "COMPANY_ACCESS_DENIED",
    "message": "You do not have access to this company"
  }
}
```

### Testing Pattern (Follow Existing Conventions)

Existing E2 tests use this pattern:
```typescript
import { buildApp } from '../../app.js';

describe('feature', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should do X', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/some-route',
      headers: {
        authorization: 'Bearer <token>',
        'x-company-id': 'some-uuid',
      },
    });
    expect(response.statusCode).toBe(200);
  });
});
```

For middleware tests that need to mock database calls, either:
1. Use `vi.mock('@nexa/db')` to mock the module
2. Or create test users/companies in the database before tests (integration test approach)

The middleware needs `resolveUserRole` and database lookups. Mock at the module boundary for unit tests. E2E tests should use real data.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: This story IS the companyId enforcement mechanism. The middleware sets `ctx.companyId` for every authenticated request. ALL downstream services and repositories will receive this context.
- **i18n**: N/A — no UI in this story. Error messages are internal API codes, not user-facing labels.
- **Audit**: Company switching should be audit-logged. However, E3 (Event Bus + Audit Trail) is not yet built. Add a `// TODO: E3 — emit company.switched event` comment at the switch endpoint for now.
- **Attachments/Notes/Tasks**: N/A — infrastructure story, not a business entity.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.3 Schema Design Principles, §3 Authentication & Security | companyId on every table, query MUST scope by companyId, tenant resolution flow, auth flow steps |
| **API Contracts** | §2.2 System Module | Company profile management endpoints, company switching |
| **State Machine** | N/A | Company context is not a stateful entity — no lifecycle |
| **Event Catalog** | N/A | Company switching does not emit events yet (deferred to E3) |
| **Data Models** | §3.1 System Module | CompanyProfile, RegisterSharingRule, UserCompanyRole, User models |
| **Business Rules** | §14 IMP-001, IMP-007 | Database-per-tenant isolation; company scoping is within-tenant; RBAC enforcement |
| **Project Context** | §1 Multi-Company Architecture, §2 RBAC | getVisibleCompanyIds pattern, resolveUserRole resolution order, companyId query pattern |

### Project Structure Notes

New files:
- `apps/api/src/core/middleware/company-context.ts` — company context Fastify plugin
- `apps/api/src/core/middleware/company-context.test.ts` — middleware tests
- `apps/api/src/core/types/request-context.ts` — RequestContext interface + helper
- `apps/api/src/core/types/index.ts` — types barrel export
- `apps/api/src/core/utils/company-query.ts` — sharing-aware Prisma filter builder
- `apps/api/src/core/utils/company-query.test.ts` — query helper tests
- `apps/api/src/modules/system/company.routes.ts` — company switch endpoint
- `apps/api/src/modules/system/company.schema.ts` — Zod schemas
- `apps/api/src/modules/system/company.routes.test.ts` — endpoint tests

Modified files:
- `apps/api/src/core/auth/jwt-verify.hook.ts` — add `companyId` to type augmentation + decorator
- `apps/api/src/app.ts` — register company context plugin + system routes

Protected files (DO NOT modify beyond what's specified):
- `packages/db/src/client.ts` — PrismaClient singleton
- `packages/db/src/index.ts` — barrel exports
- `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds (already complete)
- `packages/db/src/utils/rbac.ts` — resolveUserRole (already complete)

### Previous Story Intelligence

**E2.S1 (Fastify API Bootstrap)**: Established plugin registration order, error handler, Zod compiler, health routes. Follow the same plugin pattern with `fastify-plugin` and `fp()`.

**E2.S2 (JWT Authentication)**: Created `jwt-verify.hook.ts` with request decoration pattern. The `companyId` decoration must use the same pattern (string default, not reference type). E2.S2 also established that `request.tenantId` identifies the database tenant — company context is within-tenant scoping.

**E2.S3 (MFA TOTP)**: No direct impact on this story, but MFA routes are registered and must continue to work.

**E1.S3 (Multi-Company Models)**: Created `getVisibleCompanyIds()` and `resolveUserRole()` utilities. These are the foundational functions this middleware depends on. Code review noted the `getVisibleCompanyIds` query slightly deviates from spec by adding `sharingMode: { not: 'NONE' }` filter — the actual implementation at `packages/db/src/utils/sharing.ts` does NOT have this filter (it follows the spec exactly). Use the function as-is, no modifications needed.

### Key Dependency: PrismaClient Access in Middleware

The company-context middleware needs database access. Options:
1. **Plugin option**: Pass PrismaClient as a plugin option when registering
2. **Fastify decorator**: Decorate fastify with prisma and access via `fastify.prisma`
3. **Direct import**: Import `prisma` singleton from `@nexa/db`

**Recommended**: Option 3 (direct import) for simplicity, consistent with how `auth.service.ts` imports from `@nexa/db`. For testing, mock the module.

### Source References

- [Source: _bmad-output/planning-artifacts/project-context.md#1 Multi-Company Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#2 RBAC: Global Role + Per-Company Exceptions]
- [Source: _bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md#Story E2.S4]
- [Source: _bmad-output/planning-artifacts/architecture.md — §2.3 Schema Design Principles]
- [Source: _bmad-output/planning-artifacts/data-models.md — §3.1 System Module]
- [Source: _bmad-output/planning-artifacts/api-contracts.md — §2.2 System Module]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md — §14 IMP-001, IMP-007]
- [Source: apps/api/src/core/auth/jwt-verify.hook.ts — request augmentation pattern]
- [Source: packages/db/src/utils/sharing.ts — getVisibleCompanyIds implementation]
- [Source: packages/db/src/utils/rbac.ts — resolveUserRole implementation]
- [Source: apps/api/src/app.ts — plugin registration order]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 10 tasks completed: request type augmentation, RequestContext interface, company context middleware, middleware tests, sharing-aware query helper, query helper tests, company switch endpoint, switch endpoint tests, app.ts registration, full test verification
- Code review completed (2026-02-19) with 3 HIGH, 7 MEDIUM, 2 LOW issues documented for human review
- Key implementation: Fastify plugin pattern for company context middleware, `buildCompanyFilter` for sharing-aware queries, `POST /system/companies/:id/switch` endpoint
- Existing `@nexa/db` utilities reused: `resolveUserRole()`, `getVisibleCompanyIds()`
- All existing E2 tests continue to pass (no regressions)

### File List

**New files created:**
- `apps/api/src/core/middleware/company-context.ts`
- `apps/api/src/core/middleware/company-context.test.ts`
- `apps/api/src/core/types/request-context.ts`
- `apps/api/src/core/types/index.ts`
- `apps/api/src/core/utils/company-query.ts`
- `apps/api/src/core/utils/company-query.test.ts`
- `apps/api/src/modules/system/company.routes.ts`
- `apps/api/src/modules/system/company.schema.ts`
- `apps/api/src/modules/system/company.routes.test.ts`

**Modified files:**
- `apps/api/src/core/auth/jwt-verify.hook.ts` — added `companyId` to type augmentation + decorator
- `apps/api/src/app.ts` — registered company context plugin + system routes


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-19 05:17

### Remaining Issues for Human Review:

- ISSUE #1: [HIGH] Company-ID enumeration via inconsistent 404-vs-403 between middleware and switch endpoint. The middleware (`company-context.ts:83-88`) deliberately returns uniform 403 for non-existent/inactive companies to prevent enumeration (code comment says so explicitly). But the switch endpoint (`company.routes.ts:35-47`) returns 404 COMPANY_NOT_FOUND for the same scenario. An attacker can enumerate valid company UUIDs by calling `POST /system/companies/:id/switch` and distinguishing 404 from 403.
- ISSUE #2: [HIGH] `getVisibleCompanyIds()` does not filter out NONE sharing rules — spec divergence. The data-models spec mandates `sharingMode: { not: 'NONE' }` in the WHERE clause (`packages/db/src/utils/sharing.ts:13-21`), but the implementation omits this filter. A `RegisterSharingRule` with `sharingMode: NONE` will be matched and its companies added to the visible set. This story's `buildCompanyFilter` (`company-query.ts:24`) delegates to this function and inherits the bug — entities that should be company-private may leak across companies.
- ISSUE #3: [HIGH] Zod role enum in `company.schema.ts:18` is hardcoded independently from the Prisma `UserRole` enum. If a role is added or removed in `packages/db/prisma/schema.prisma:402-410`, the Zod schema will silently strip or reject it at the serialization boundary, causing runtime 500 errors with no compile-time warning.
- ISSUE #4: [MEDIUM] Switch endpoint tests don't assert `user.update` was NOT called on failure paths. `company.routes.test.ts:199-218` (no-access 403) and `company.routes.test.ts:224-260` (not-found 404) verify error responses but never assert `expect(mockPrisma.user.update).not.toHaveBeenCalled()`. A bug that updates the user's default company before throwing would pass these tests silently.
- ISSUE #5: [MEDIUM] Middleware test for deactivated user doesn't verify short-circuit behavior. `company-context.test.ts:232-246` checks for 401 status but doesn't assert `mockPrisma.companyProfile.findUnique` and `mockResolveUserRole` were NOT called. The test doesn't prove the middleware actually short-circuited — it could be running all 3 DB queries before throwing.
- ISSUE #6: [MEDIUM] 2-5 database queries per authenticated request with no caching strategy. Every authenticated request triggers: (1) `user.findUnique`, (2) `companyProfile.findUnique`, (3) `resolveUserRole` (1-2 queries internally). The switch endpoint adds 2 more. The TODO at `company-context.ts:16-19` acknowledges this but proposes no concrete solution or timeline.
- ISSUE #7: [MEDIUM] `RequestContext.role` vs `FastifyRequest.userRole` naming inconsistency. `request-context.ts:7` defines the field as `role` but the Fastify request augmentation at `jwt-verify.hook.ts:16` uses `userRole`. The silent mapping in `extractRequestContext` will confuse developers working across middleware and service layers.
- ISSUE #8: [MEDIUM] No test for empty string `X-Company-ID` header. `company-context.test.ts` tests invalid UUID and absent header but not `X-Company-ID: ""`. Empty string is falsy in JS, so it silently falls through to the default-company path. This edge case behavior should be documented and tested.
- ISSUE #9: [MEDIUM] `buildCompanyFilter` doesn't handle empty `visibleIds` array. `company-query.ts:26-30` checks `visibleIds.length > 1` and falls through to `return { companyId }` for length 0 or 1. An empty array (if `getVisibleCompanyIds` changes behavior) would incorrectly scope to the requesting company instead of denying access.
- ISSUE #10: [MEDIUM] `getVisibleCompanyIds` re-queries all companies for each ALL_COMPANIES rule match without deduplication guard. `sharing.ts:26-29` triggers a full `companyProfile.findMany()` for every ALL_COMPANIES rule. The data-models spec shows a `fetchedAllCompanies` flag to avoid this — the implementation is missing it.
- ISSUE #11: [LOW] `makeTestJwt()` helper is duplicated identically in `company-context.test.ts:48-60` and `company.routes.test.ts:54-66`. Should be extracted to a shared test utility to prevent drift.
- ISSUE #12: [LOW] No concurrent company switch race condition test. `company.routes.ts:62` calls `prisma.user.update` without optimistic locking. Two simultaneous switch requests produce unpredictable final state. The "last write wins" design decision is neither documented nor tested.
- Summary: 3 HIGH, 7 MEDIUM, 2 LOW issues found

---


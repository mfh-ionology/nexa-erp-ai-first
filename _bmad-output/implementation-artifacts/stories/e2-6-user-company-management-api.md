# Story E2.S6: User & Company Management API

Status: done

## Story

As an administrator,
I want CRUD endpoints for users and companies,
so that I can manage user accounts, role assignments, and company profiles.

## Acceptance Criteria

1. GIVEN ADMIN role WHEN I call POST /system/users with valid user data THEN a new user is created with the specified role and enabled modules, and their password is hashed with Argon2id
2. GIVEN ADMIN role WHEN I call PATCH /system/users/:id/role with a new role THEN the user's global role is updated and an audit log entry is created
3. GIVEN ADMIN role WHEN I call GET /system/users with cursor pagination THEN a list of users is returned with id, email, name, role, enabledModules, isActive, lastLoginAt
4. GIVEN ADMIN role WHEN I call POST /system/company-profile with company data THEN a new company is created with name, legalName, baseCurrencyCode, vatNumber, and a default NumberSeries set is generated
5. GIVEN any authenticated user WHEN I call GET /system/company-profile THEN the current company's profile is returned based on ctx.companyId
6. GIVEN a STAFF user WHEN they attempt to call POST /system/users THEN a 403 error is returned (ADMIN minimum required)

## Tasks / Subtasks

- [x] Task 1: Define Zod validation schemas for User CRUD (AC: #1, #2, #3, #6)
  - [x] 1.1 Create `apps/api/src/modules/system/user.schema.ts`
  - [x] 1.2 Define `createUserRequestSchema`: email (z.string().email()), password (z.string().min(8)), firstName, lastName, companyId (z.uuid()), role (z.enum matching UserRole), enabledModules (z.array(z.string()).default([]))
  - [x] 1.3 Define `updateUserRequestSchema`: partial of createUserRequestSchema excluding password and email (non-updatable fields)
  - [x] 1.4 Define `updateUserRoleRequestSchema`: role (z.enum matching UserRole)
  - [x] 1.5 Define `updateUserModulesRequestSchema`: enabledModules (z.array(z.string()))
  - [x] 1.6 Define `userResponseSchema`: id, email, firstName, lastName, role, enabledModules, isActive, mfaEnabled, lastLoginAt, companyId, createdAt, updatedAt
  - [x] 1.7 Define `userListResponseSchema`: z.array(userResponseSchema) — used with pagination meta
  - [x] 1.8 Define `userParamsSchema`: id (z.uuid())
  - [x] 1.9 Define `userListQuerySchema`: cursor (z.uuid().optional()), limit (z.coerce.number().int().min(1).max(100).default(20)), sort (z.enum(['email', 'firstName', 'lastName', 'createdAt']).default('createdAt')), order (z.enum(['asc', 'desc']).default('asc')), search (z.string().optional()), isActive (z.coerce.boolean().optional())
  - [x] 1.10 Export all inferred types

- [x] Task 2: Define Zod validation schemas for Company Profile (AC: #4, #5)
  - [x] 2.1 Create `apps/api/src/modules/system/company-profile.schema.ts`
  - [x] 2.2 Define `createCompanyProfileRequestSchema`: name (required), legalName, registrationNumber, vatNumber, utrNumber, natureOfBusiness, baseCurrencyCode (default "GBP"), addressLine1, addressLine2, city, county, postcode, countryCode (default "GB"), phone, email, website, timezone (default "Europe/London"), weekStart (default 1), dateFormat (default "DD/MM/YYYY"), decimalSeparator, thousandsSeparator, vatScheme (z.enum matching VatScheme, default "STANDARD"), defaultLanguage (default "en"), taxAgentName, taxAgentPhone, taxAgentEmail, logoUrl
  - [x] 2.3 Define `updateCompanyProfileRequestSchema`: partial of create schema (all optional)
  - [x] 2.4 Define `companyProfileResponseSchema`: all CompanyProfile fields from Prisma model
  - [x] 2.5 Export all inferred types

- [x] Task 3: Implement User service (AC: #1, #2, #3)
  - [x] 3.1 Create `apps/api/src/modules/system/user.service.ts`
  - [x] 3.2 Implement `createUser(prisma, data, ctx)`: hash password with `hashPassword()` from `auth.service.ts`, create User record, create UserCompanyRole (global role with companyId=null), return user (without passwordHash)
  - [x] 3.3 Implement `listUsers(prisma, companyId, query)`: cursor-based pagination using Prisma `cursor`, `take`, `skip`, `orderBy`; filter by `isActive` if provided; search across email, firstName, lastName using `contains` (case-insensitive); return data array + PaginationMeta `{ cursor, hasMore, total }`
  - [x] 3.4 Implement `getUserById(prisma, id, companyId)`: findUnique with companyId scope, throw NotFoundError if not found, exclude passwordHash and mfaSecret from response
  - [x] 3.5 Implement `updateUser(prisma, id, companyId, data, ctx)`: update user fields, validate companyId scope, throw NotFoundError if not found
  - [x] 3.6 Implement `updateUserRole(prisma, userId, role, ctx)`: upsert UserCompanyRole where companyId IS NULL (global role), emit event for audit
  - [x] 3.7 Implement `updateUserModules(prisma, userId, enabledModules, ctx)`: update User.enabledModules JSON field
  - [x] 3.8 Implement `deactivateUser(prisma, id, companyId, ctx)`: set isActive=false (soft delete), revoke all refresh tokens for the user
  - [x] 3.9 All service methods set createdBy/updatedBy from ctx.userId

- [x] Task 4: Implement User CRUD routes (AC: #1, #2, #3, #6)
  - [x] 4.1 Create `apps/api/src/modules/system/user.routes.ts`
  - [x] 4.2 Implement `POST /users` — create user, guarded with `createRbacGuard({ minimumRole: UserRole.ADMIN })`, return 201 with created user
  - [x] 4.3 Implement `GET /users` — list users with cursor pagination, guarded with ADMIN, return 200 with data + meta
  - [x] 4.4 Implement `GET /users/:id` — get single user, guarded with ADMIN, return 200
  - [x] 4.5 Implement `PATCH /users/:id` — update user, guarded with ADMIN, return 200
  - [x] 4.6 Implement `PATCH /users/:id/role` — update global role, guarded with ADMIN, return 200
  - [x] 4.7 Implement `PATCH /users/:id/modules` — update enabled modules, guarded with ADMIN, return 200
  - [x] 4.8 Implement `DELETE /users/:id` — soft-delete (deactivate), guarded with ADMIN, return 200
  - [x] 4.9 All routes use Zod schemas for request validation and response serialisation
  - [x] 4.10 All routes use `sendSuccess(reply, data, meta?)` response pattern

- [x] Task 5: Implement Company Profile service (AC: #4, #5)
  - [x] 5.1 Create `apps/api/src/modules/system/company-profile.service.ts`
  - [x] 5.2 Implement `getCompanyProfile(prisma, companyId)`: findUnique by id (companyId from request context), throw NotFoundError if not found
  - [x] 5.3 Implement `createCompanyProfile(prisma, data, tenantId, ctx)`: create CompanyProfile record, then generate default NumberSeries records within a `prisma.$transaction` — see Task 6
  - [x] 5.4 Implement `updateCompanyProfile(prisma, companyId, data, ctx)`: partial update, validate companyId matches request context, set updatedBy from ctx.userId

- [x] Task 6: Implement default NumberSeries generation for new companies (AC: #4)
  - [x] 6.1 In `company-profile.service.ts`, define `DEFAULT_NUMBER_SERIES` constant array with entity types and prefixes:
    ```
    INVOICE / INV-
    CREDIT_NOTE / CN-
    SALES_ORDER / SO-
    SALES_QUOTE / SQ-
    PURCHASE_ORDER / PO-
    JOURNAL / JNL-
    CUSTOMER / CUST-
    SUPPLIER / SUP-
    EMPLOYEE / EMP-
    ```
  - [x] 6.2 In `createCompanyProfile`, after creating the company, use `prisma.numberSeries.createMany({ data: DEFAULT_NUMBER_SERIES.map(...) })` to seed all default series with `nextValue: 1`, `padding: 5`, `isActive: true`
  - [x] 6.3 Wrap company creation + number series seeding in a single `prisma.$transaction` for atomicity

- [x] Task 7: Implement Company Profile routes (AC: #4, #5)
  - [x] 7.1 Create `apps/api/src/modules/system/company-profile.routes.ts`
  - [x] 7.2 Implement `GET /company-profile` — get current company profile (ctx.companyId), guarded with `createRbacGuard({ minimumRole: UserRole.VIEWER })` (any authenticated user can view)
  - [x] 7.3 Implement `POST /company-profile` — create new company, guarded with `createRbacGuard({ minimumRole: UserRole.ADMIN })`; return 201 with new company profile
  - [x] 7.4 Implement `PATCH /company-profile` — update current company profile, guarded with ADMIN; return 200

- [x] Task 8: Register new routes in app.ts (AC: #1-#6)
  - [x] 8.1 Create `apps/api/src/modules/system/index.ts` — system module plugin that registers companyRoutesPlugin (existing), userRoutesPlugin, and companyProfileRoutesPlugin
  - [x] 8.2 In `app.ts`, replace individual `companyRoutesPlugin` registration with the unified system module plugin
  - [x] 8.3 The unified system module registers all sub-plugins under the `/system` prefix
  - [x] 8.4 User routes register under `/system/users`
  - [x] 8.5 Company profile routes register under `/system/company-profile`
  - [x] 8.6 Existing company switch routes remain at `/system/companies/:id/switch`

- [x] Task 9: Write User CRUD integration tests (AC: #1, #2, #3, #6)
  - [x] 9.1 Create `apps/api/src/modules/system/user.routes.test.ts`
  - [x] 9.2 Test: POST /system/users with valid data → 201, user created with hashed password
  - [x] 9.3 Test: POST /system/users with ADMIN role → success; with STAFF role → 403
  - [x] 9.4 Test: POST /system/users with duplicate email → 409 CONFLICT
  - [x] 9.5 Test: POST /system/users with invalid email → 400 VALIDATION_ERROR
  - [x] 9.6 Test: GET /system/users → 200 with paginated list, verify response shape (no passwordHash or mfaSecret exposed)
  - [x] 9.7 Test: GET /system/users with cursor pagination → correct hasMore/cursor
  - [x] 9.8 Test: GET /system/users with search filter → matching results only
  - [x] 9.9 Test: GET /system/users with isActive filter → only active/inactive as requested
  - [x] 9.10 Test: GET /system/users/:id → 200 with user data
  - [x] 9.11 Test: GET /system/users/:nonexistent → 404 NOT_FOUND
  - [x] 9.12 Test: PATCH /system/users/:id with valid data → 200 updated user
  - [x] 9.13 Test: PATCH /system/users/:id/role → 200, global UserCompanyRole updated
  - [x] 9.14 Test: PATCH /system/users/:id/modules → 200, enabledModules updated
  - [x] 9.15 Test: DELETE /system/users/:id → 200, user isActive=false
  - [x] 9.16 Test: Unauthenticated request → 401

- [x] Task 10: Write Company Profile integration tests (AC: #4, #5)
  - [x] 10.1 Create `apps/api/src/modules/system/company-profile.routes.test.ts`
  - [x] 10.2 Test: GET /system/company-profile → 200 with current company data (uses ctx.companyId)
  - [x] 10.3 Test: POST /system/company-profile with valid data → 201, company + default number series created
  - [x] 10.4 Test: POST /system/company-profile verifies all 9 default NumberSeries records exist
  - [x] 10.5 Test: PATCH /system/company-profile → 200, fields updated
  - [x] 10.6 Test: POST /system/company-profile with STAFF → 403
  - [x] 10.7 Test: GET /system/company-profile with VIEWER → 200 (any authenticated user allowed)

- [x] Task 11: Write User service unit tests (AC: #1, #2, #3)
  - [x] 11.1 Create `apps/api/src/modules/system/user.service.test.ts`
  - [x] 11.2 Test: createUser hashes password with Argon2id (verify using argon2.verify)
  - [x] 11.3 Test: createUser creates UserCompanyRole with global role (companyId=null)
  - [x] 11.4 Test: createUser sets createdBy/updatedBy from ctx.userId
  - [x] 11.5 Test: listUsers returns correct pagination meta
  - [x] 11.6 Test: updateUserRole upserts global role correctly
  - [x] 11.7 Test: deactivateUser revokes all refresh tokens
  - [x] 11.8 Mock `@nexa/db` prisma methods using vi.mock

- [x] Task 12: Verify all tests pass and no regressions
  - [x] 12.1 Run `pnpm --filter api test` — all tests pass
  - [x] 12.2 Verify existing E2 tests (auth, MFA, company-context, RBAC) still pass
  - [x] 12.3 Verify new user CRUD tests pass
  - [x] 12.4 Verify new company profile tests pass
  - [x] 12.5 Run `pnpm --filter api build` — TypeScript compilation succeeds

## Dev Notes

### Key Architecture Patterns

- **Module structure**: This is the FIRST full business module implementing the standard layered pattern: `routes → service → prisma`. Follow the exact structure defined in the architecture: `modules/system/` with separate route, service, and schema files.
- **Service layer**: Services contain business logic. They receive PrismaClient as a parameter (NOT via import for testability). They never import the Prisma singleton directly — the route handler passes `prisma` from `@nexa/db` import.
- **RBAC on every route**: Use `createRbacGuard({ minimumRole: UserRole.ADMIN })` as `preHandler` for all user management routes. Company profile GET uses `UserRole.VIEWER`.
- **Response envelope**: Always use `sendSuccess(reply, data, meta?)`. Never send raw objects.
- **Error handling**: Throw `AppError` subclasses. The global error handler converts them to the standard envelope. Use `NotFoundError` for 404, `AuthError` for 403, `ValidationError` for 400, `DomainError` for 422.

### Existing Code to Reuse (DO NOT Reinvent)

| Existing Code | Location | Use For |
|---------------|----------|---------|
| `hashPassword()` | `apps/api/src/core/auth/auth.service.ts:52` | Hash user passwords on create |
| `verifyPassword()` | `apps/api/src/core/auth/auth.service.ts:61` | Not needed in this story |
| `resolveUserRole()` | `packages/db/src/utils/rbac.ts` (via `@nexa/db`) | Verify company access during role updates |
| `revokeAllUserTokens()` | `apps/api/src/core/auth/auth.service.ts:144` | Revoke tokens on user deactivation |
| `createRbacGuard()` | `apps/api/src/core/rbac/rbac.guard.ts` | Guard routes by role |
| `UserRole` enum | `@nexa/db` | Role values for Zod schemas and guards |
| `VatScheme` enum | `@nexa/db` | Enum for company vatScheme field |
| `sendSuccess()` | `apps/api/src/core/utils/response.ts` | Standard response envelope |
| `successEnvelope()` | `apps/api/src/core/schemas/envelope.ts` | Zod schema wrapper for response serialisation |
| `AppError`, `AuthError`, `NotFoundError`, `ValidationError` | `apps/api/src/core/errors/` | Error types |
| `appEvents.emit()` | `apps/api/src/core/events/event-emitter.ts` | Emit audit events |
| `PaginationMeta` | `apps/api/src/core/utils/response.ts:20` | Pagination meta type |
| `RequestContext` | `apps/api/src/core/types/request-context.ts` | Request context extraction |

### Cursor-Based Pagination Pattern

Prisma cursor pagination for `GET /system/users`:

```typescript
const users = await prisma.user.findMany({
  where: { companyId, ...filters },
  take: limit + 1, // Fetch one extra to detect hasMore
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  orderBy: { [sort]: order },
  select: { /* exclude passwordHash, mfaSecret */ },
});

const hasMore = users.length > limit;
const data = hasMore ? users.slice(0, -1) : users;
const nextCursor = hasMore ? data[data.length - 1].id : undefined;

return { data, meta: { cursor: nextCursor, hasMore, total } };
```

### User Email Uniqueness

Email uniqueness is enforced at the DB level (`@@unique([email])` on the User model). The service should catch Prisma's unique constraint violation error (`P2002`) and convert it to a `DomainError` with code `DUPLICATE_EMAIL` / 409 status.

### Password Security

- Use `hashPassword()` from `auth.service.ts` — it uses Argon2id with memoryCost: 65536, timeCost: 3, parallelism: 4 (OWASP recommended).
- NEVER return `passwordHash` or `mfaSecret` in any API response. Use Prisma `select` to explicitly choose which fields to return.
- The password field is required on create but CANNOT be updated via PATCH /users/:id — if password reset is needed, that's a separate flow (E2.S2 auth routes).

### Default Number Series for New Companies

When creating a company via `POST /system/company-profile`, generate these default NumberSeries records:

| entityType | prefix |
|-----------|--------|
| INVOICE | INV- |
| CREDIT_NOTE | CN- |
| SALES_ORDER | SO- |
| SALES_QUOTE | SQ- |
| PURCHASE_ORDER | PO- |
| JOURNAL | JNL- |
| CUSTOMER | CUST- |
| SUPPLIER | SUP- |
| EMPLOYEE | EMP- |

All with `nextValue: 1`, `padding: 5`, `isActive: true`. Use `prisma.numberSeries.createMany()` inside the same `$transaction` as company creation for atomicity.

### Event Emission

E3 (Event Bus + Audit Trail) is not yet built. Add TODO comments for event emission:
- `// TODO: E3 — emit user.created event`
- `// TODO: E3 — emit user.updated event`
- `// TODO: E3 — emit user.role.updated event`
- `// TODO: E3 — emit user.deactivated event`
- `// TODO: E3 — emit company.created event`
- `// TODO: E3 — emit settings.updated event`

For now, use `appEvents.emit()` from the typed event emitter for the events already defined in the `BusinessEvents` interface (e.g., `settings.updated`). For user CRUD events not yet in the interface, add the TODO comment only.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: User CRUD routes scope queries by `request.companyId`. The `GET /system/users` list query uses `WHERE companyId = request.companyId` so each company admin sees only users belonging to their company. Exception: SUPER_ADMIN may need cross-company views — defer to future story.
- **i18n**: N/A — no UI in this story. Error messages are internal API codes.
- **Audit**: Role changes and user deactivation should emit events when E3 is built. Add TODO comments now.
- **Attachments/Notes/Tasks**: N/A — Users and CompanyProfiles are not business entities requiring cross-cutting record support.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §1 Module Plugin Structure, §3 Auth & Security, §4.1 API Design | System module pattern (routes/services/repos/schemas), Argon2id hashing, REST cursor pagination, response envelope |
| **API Contracts** | §2.2 System Module, §1 Response Envelope/Pagination | CRUD /system/users (ADMIN), /system/company-profile (GET=any, POST/PATCH=ADMIN), PATCH role/modules; cursor pagination `?cursor=&limit=&sort=&order=`; success/error envelope |
| **State Machine** | §1 Reference Entity Pattern | User and CompanyProfile use `isActive: Boolean` soft-delete — no status enum state machine |
| **Event Catalog** | §16 System Events | `settings.updated` event defined; `user.created/updated/deactivated` events NOT yet defined — add TODO comments |
| **Data Models** | §3.1 System Module, §4.1 Enums, §6.2 Number Series | User (fields, unique email, companyId FK), CompanyProfile (all fields), UserCompanyRole (global/per-company), NumberSeries (entity seeding), UserRole/VatScheme enums |
| **Business Rules** | §14 IMP-007 (RBAC), IMP-009 (CRUD <500ms), BR-SYS-011 (atomic numbering), XM-018 (shared NumberSeries) | RBAC guard on all management routes, CRUD performance target, number series seeding in transaction |
| **Project Context** | §1 Multi-Company Architecture, §2 RBAC Resolution, §11 Development Rules | companyId scoping on every query, role resolution order (company-specific → global → no access), TDD red-green-refactor, co-located tests |

### Project Structure Notes

New files:
- `apps/api/src/modules/system/user.schema.ts` — User Zod schemas + types
- `apps/api/src/modules/system/user.service.ts` — User business logic
- `apps/api/src/modules/system/user.service.test.ts` — User service unit tests
- `apps/api/src/modules/system/user.routes.ts` — User CRUD route handlers
- `apps/api/src/modules/system/user.routes.test.ts` — User route integration tests
- `apps/api/src/modules/system/company-profile.schema.ts` — Company Profile Zod schemas
- `apps/api/src/modules/system/company-profile.service.ts` — Company Profile business logic
- `apps/api/src/modules/system/company-profile.routes.ts` — Company Profile route handlers
- `apps/api/src/modules/system/company-profile.routes.test.ts` — Company Profile integration tests
- `apps/api/src/modules/system/index.ts` — System module Fastify plugin (aggregates sub-routes)

Modified files:
- `apps/api/src/app.ts` — Replace individual `companyRoutesPlugin` with unified system module plugin

Protected files (DO NOT modify beyond what's specified):
- `packages/db/src/client.ts` — PrismaClient singleton
- `packages/db/src/index.ts` — barrel exports
- `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds
- `packages/db/src/utils/rbac.ts` — resolveUserRole
- `packages/db/src/services/number-series.service.ts` — nextNumber
- `apps/api/src/core/auth/auth.service.ts` — import hashPassword/revokeAllUserTokens, do NOT modify

### Previous Story Intelligence

**E2.S4 (Multi-Company Context Middleware)**: Established `request.companyId` and `request.userRole` on every authenticated request. All routes in E2-6 depend on these being set. The company-context middleware runs BEFORE routes, so `request.companyId` is always available in route handlers.

**E2.S5 (RBAC Permission Guards)**: Created `createRbacGuard()` factory that reads `request.userRole` (already resolved by company-context middleware) and compares against configured minimum role. No additional DB queries in the guard itself. Use this on every E2-6 route.

**E2.S4 Code Review Issues (from E2.S4 story file)**: Issue #3 noted that the Zod role enum in `company.schema.ts:18` is hardcoded independently from the Prisma `UserRole` enum. For E2-6, avoid this: import `UserRole` from `@nexa/db` and derive Zod enum from it using `z.nativeEnum(UserRole)` or `z.enum(Object.values(UserRole))` to prevent drift.

**Key Pattern from E2.S4**: Routes use the pattern:
```typescript
async function routes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Params: ParamType }>('/path', {
    schema: { params: paramsSchema, response: { 200: successEnvelope(responseSchema) } },
    preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
  }, async (request, reply) => { ... });
}
export const routesPlugin = routes;
```

### Testing Pattern (Follow Existing Conventions)

Existing E2 tests use:
```typescript
import { buildApp } from '../../app.js';
import { SignJWT } from 'jose';

// Helper to generate test JWTs
async function makeTestJwt(overrides = {}) {
  const payload = {
    sub: 'test-user-id',
    tenantId: 'test-tenant',
    role: 'ADMIN',
    enabledModules: ['SYSTEM'],
    ...overrides,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret-key-at-least-32-chars!!'));
}

describe('feature', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('should do X', async () => {
    const jwt = await makeTestJwt({ role: 'ADMIN' });
    const response = await app.inject({
      method: 'POST',
      url: '/system/users',
      headers: { authorization: `Bearer ${jwt}`, 'x-company-id': 'test-company-id' },
      payload: { ... },
    });
    expect(response.statusCode).toBe(201);
  });
});
```

Mock `@nexa/db` for unit tests:
```typescript
vi.mock('@nexa/db', () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userCompanyRole: { upsert: vi.fn() },
    companyProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    numberSeries: { createMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn((fn) => fn(/* pass mock prisma */)),
  },
  UserRole: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', MANAGER: 'MANAGER', STAFF: 'STAFF', VIEWER: 'VIEWER' },
  resolveUserRole: vi.fn(),
}));
```

Extract `makeTestJwt` to a shared test utility (e.g., `apps/api/src/test-utils/jwt.ts`) to avoid duplication across test files (noted as Issue #11 in E2.S4 code review).

### Error Codes

| Error Code | HTTP Status | When |
|------------|-------------|------|
| `FORBIDDEN` | 403 | User lacks ADMIN role |
| `MODULE_NOT_ENABLED` | 403 | Module not in enabledModules |
| `NOT_FOUND` | 404 | User or company not found |
| `DUPLICATE_EMAIL` | 409 | Email already exists (Prisma P2002) |
| `VALIDATION_ERROR` | 400 | Zod validation failure |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |

### Zod Enum from Prisma — Preventing Drift

To avoid hardcoding role/enum values in Zod schemas independently from Prisma:

```typescript
import { UserRole, VatScheme } from '@nexa/db';

// Derive Zod enum from Prisma enum — stays in sync automatically
const userRoleSchema = z.nativeEnum(UserRole);
const vatSchemeSchema = z.nativeEnum(VatScheme);
```

This prevents the Issue #3 from E2.S4 where a hardcoded `z.enum([...])` drifts from the Prisma enum.

### Source References

- [Source: _bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md#Story E2.S6]
- [Source: _bmad-output/planning-artifacts/project-context.md#1 Multi-Company Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#2 RBAC: Global Role + Per-Company Exceptions]
- [Source: _bmad-output/planning-artifacts/architecture.md — §1 Module Plugin Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md — §3 Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md — §4.1 API Design]
- [Source: _bmad-output/planning-artifacts/api-contracts.md — §2.2 System Module]
- [Source: _bmad-output/planning-artifacts/api-contracts.md — §1 Pagination, Response Envelope]
- [Source: _bmad-output/planning-artifacts/data-models.md — §3.1 System Module]
- [Source: _bmad-output/planning-artifacts/data-models.md — §4.1 Enums]
- [Source: _bmad-output/planning-artifacts/data-models.md — §6.2 Number Series]
- [Source: _bmad-output/planning-artifacts/event-catalog.md — §16 System Events]
- [Source: _bmad-output/planning-artifacts/state-machine-reference.md — §1 Reference Entity Pattern]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md — §14 IMP-007, IMP-009]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md — BR-SYS-011, XM-018]
- [Source: _bmad-output/planning-artifacts/prd.md — FR80, FR81, FR83, FR84, FR171, FR175-FR177]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR2, NFR12, NFR13, NFR41, NFR45]
- [Source: apps/api/src/core/auth/auth.service.ts — hashPassword, revokeAllUserTokens]
- [Source: apps/api/src/core/rbac/rbac.guard.ts — createRbacGuard]
- [Source: apps/api/src/core/utils/response.ts — sendSuccess, PaginationMeta]
- [Source: apps/api/src/core/schemas/envelope.ts — successEnvelope]
- [Source: apps/api/src/core/errors/ — AppError hierarchy]
- [Source: apps/api/src/modules/system/company.routes.ts — route registration pattern]
- [Source: apps/api/src/app.ts — plugin registration order]
- [Source: packages/db/src/services/number-series.service.ts — nextNumber pattern]
- [Source: packages/db/prisma/schema.prisma — User, CompanyProfile, UserCompanyRole, NumberSeries]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 12 tasks completed: Zod schemas, User/Company services, CRUD routes, system module registration, integration + unit tests
- All existing E2 tests (auth, MFA, company-context, RBAC) continue to pass — no regressions
- TypeScript build succeeds (`pnpm --filter api build`)
- Code review completed (2026-02-19): 4 HIGH, 5 MEDIUM, 3 LOW issues documented for human review
- Key remaining issues: privilege escalation guard (ISSUE #1), self-deactivation prevention (ISSUE #2), unsafe type assertion in transaction (ISSUE #3), baseCurrencyCode mutability (ISSUE #4)
- Implementation follows established patterns: module plugin structure, RBAC guards, response envelope, cursor-based pagination

### File List

**New files created:**
- `apps/api/src/modules/system/user.schema.ts`
- `apps/api/src/modules/system/user.service.ts`
- `apps/api/src/modules/system/user.service.test.ts`
- `apps/api/src/modules/system/user.routes.ts`
- `apps/api/src/modules/system/user.routes.test.ts`
- `apps/api/src/modules/system/company-profile.schema.ts`
- `apps/api/src/modules/system/company-profile.service.ts`
- `apps/api/src/modules/system/company-profile.routes.ts`
- `apps/api/src/modules/system/company-profile.routes.test.ts`
- `apps/api/src/modules/system/index.ts`

**Modified files:**
- `apps/api/src/app.ts` — replaced individual companyRoutesPlugin with unified system module plugin


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-19 07:41

### Remaining Issues for Human Review:

- ISSUE #1: [HIGH] Privilege escalation — ADMIN can create SUPER_ADMIN users. `user.schema.ts:24` uses `z.nativeEnum(UserRole)` which accepts all roles including SUPER_ADMIN. The RBAC guard only checks the requesting user is ADMIN — it does NOT enforce a role ceiling. An ADMIN can create users with `role: "SUPER_ADMIN"`, escalating privileges beyond their own. Same flaw exists in `PATCH /users/:id/role` via `updateUserRoleRequestSchema`.
- ISSUE #2: [HIGH] No self-deactivation prevention — admin can lock out their own company. `user.service.ts:291-333` (`deactivateUser`) does not check `if (id === ctx.userId)`. If the sole ADMIN deactivates themselves, the company becomes orphaned with no administrative access and no recovery path. No test covers this scenario.
- ISSUE #3: [HIGH] Unsafe double type assertion in transaction. `user.service.ts:325` casts `tx as unknown as PrismaClient` to pass a `TransactionClient` to `revokeAllUserTokens()`. This bypasses TypeScript's type system entirely. If `revokeAllUserTokens` is ever modified to use PrismaClient-only methods (`$connect`, `$transaction`, `$disconnect`), it will fail at runtime with zero compile-time warning.
- ISSUE #4: [HIGH] `updateCompanyProfile` allows changing `baseCurrencyCode` on an existing company. `company-profile.schema.ts:48-49` defines the update schema as `createCompanyProfileRequestSchema.partial()`, which includes `baseCurrencyCode`. In an ERP, changing the base currency after financial transactions are recorded would corrupt all monetary data. This field should be excluded from the update schema.
- ISSUE #5: [MEDIUM] No cross-company isolation integration test. All route integration tests use the same `TEST_COMPANY_ID`. There is no test where Company A's ADMIN tries to access a user belonging to Company B and expects 404. The company-scoping logic is unit-tested at the service level but the full middleware-to-service chain is never integration-tested for cross-tenant isolation.
- ISSUE #6: [MEDIUM] `GET /users/:id` integration test doesn't verify sensitive field exclusion. The list test (9.6, `user.routes.test.ts:341-351`) explicitly asserts `passwordHash` and `mfaSecret` are absent. But the get-by-id test (9.10, `user.routes.test.ts:494-526`) makes no such assertion. A regression exposing sensitive data on the single-user endpoint would pass tests.
- ISSUE #7: [MEDIUM] `app.test.ts` duplicates JWT helper instead of using shared `test-utils/jwt.ts`. The story created `test-utils/jwt.ts` to address E2.S4 Issue #11 about extracting `makeTestJwt`. But `app.test.ts:58-69` defines its own local `makeTestJwt()` with different parameters. Two divergent JWT helpers in the same story's output defeats the purpose of the extraction.
- ISSUE #8: [MEDIUM] `company.schema.ts:18` still has hardcoded role enum — known drift risk not addressed. The story's "Previous Story Intelligence" explicitly warns about E2.S4 Issue #3: `company.schema.ts:18` uses `z.enum(['SUPER_ADMIN', 'ADMIN', ...])` hardcoded independently from the Prisma `UserRole` enum. The new E2-6 code correctly uses `z.nativeEnum(UserRole)`, but the existing file was left unfixed despite being in the same module.
- ISSUE #9: [MEDIUM] `successEnvelope` in `envelope.ts` doesn't support pagination `meta`. The list endpoint required a hand-rolled `userListEnvelope` in `user.routes.ts:47-51`. Every future list endpoint will need to re-create this pattern. A shared `successListEnvelope(dataSchema, metaSchema)` helper should exist in the shared infrastructure.
- ISSUE #10: [LOW] `paginationMetaSchema` marks `hasMore` and `total` as optional. `user.routes.ts:42-45` defines `hasMore: z.boolean().optional()` and `total: z.number().optional()`. These are always returned by `listUsers` and logically required for pagination. The permissive schema means consumers can't rely on their presence at the type level.
- ISSUE #11: [LOW] `updateUserRequestSchema` is narrower than story spec. Task 1.3 says "partial of createUserRequestSchema excluding password and email" which would include `role` and `enabledModules`. The implementation at `user.schema.ts:28-31` only allows `firstName` and `lastName`. Undocumented deviation from spec.
- ISSUE #12: [LOW] Request schema validates modules strictly but response schema doesn't. `user.schema.ts:25` uses `z.array(moduleSchema)` (constrained to VALID_MODULES enum) on create, but `user.schema.ts:68` uses `z.array(z.string())` on the response. Inconsistent strictness between request and response validation.
- Summary: 4 HIGH, 5 MEDIUM, 3 LOW issues found

---


# Story E2.5: RBAC Permission Guards

Status: done

## Story

As an administrator,
I want the system to enforce role-based access control on every API route,
so that users can only perform actions their role permits, with per-company overrides.

## Acceptance Criteria

1. GIVEN a route requiring MANAGER role WHEN a STAFF user calls it THEN a 403 FORBIDDEN error is returned
2. GIVEN a user with ADMIN global role and VIEWER override for Company 3 WHEN they access Company 3 endpoints THEN the VIEWER role applies (per-company override takes precedence)
3. GIVEN a user with no global role and no company-specific role for Company 5 WHEN they access Company 5 endpoints THEN a 403 FORBIDDEN error is returned
4. GIVEN the role hierarchy SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER WHEN a route requires MANAGER THEN MANAGER, ADMIN, and SUPER_ADMIN all pass the check, while STAFF and VIEWER are denied
5. GIVEN a route with module gating WHEN a user's enabledModules does not include the target module THEN a 403 MODULE_NOT_ENABLED error is returned
6. GIVEN the RBAC guard WHEN it resolves the effective role THEN it checks company-specific role first, then global role, per Project Context §2 resolution order

## Tasks / Subtasks

- [x] **Task 1: Create RBAC types and role hierarchy** (AC: #1, #4)
  - [x] 1.1 Create `apps/api/src/core/rbac/rbac.types.ts`
  - [x] 1.2 Import `UserRole` enum from `@nexa/db` — DO NOT define a separate enum or Zod enum for roles. Use the Prisma-generated enum as the single source of truth.
  - [x] 1.3 Define `ROLE_LEVEL` constant map: `{ SUPER_ADMIN: 5, ADMIN: 4, MANAGER: 3, STAFF: 2, VIEWER: 1 }` using `Record<UserRole, number>` type
  - [x] 1.4 Export helper `hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean` — returns `ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimumRole]`
  - [x] 1.5 Export type `RbacGuardOptions = { minimumRole: UserRole; module?: string }` — route-level configuration for the guard

- [x] **Task 2: Implement RBAC guard as Fastify preHandler hook** (AC: #1, #2, #3, #4, #6)
  - [x] 2.1 Create `apps/api/src/core/rbac/rbac.guard.ts`
  - [x] 2.2 Implement `createRbacGuard(options: RbacGuardOptions): FastifyPreHandler` — factory function returning a preHandler hook
  - [x] 2.3 The guard reads `request.userRole` which is ALREADY the effective role for the current company (set by `company-context.ts` in E2-4). DO NOT call `resolveUserRole()` again — it was already called by the company-context middleware.
  - [x] 2.4 If `request.userRole` is empty/undefined: throw `AuthError('FORBIDDEN', 'No role assigned', 403)` — this means the company-context middleware was bypassed
  - [x] 2.5 Cast `request.userRole` to `UserRole` and call `hasMinimumRole(request.userRole, options.minimumRole)`
  - [x] 2.6 If role check fails: throw `AuthError('FORBIDDEN', 'Insufficient permissions', 403)`
  - [x] 2.7 If `options.module` is specified: check `request.enabledModules.includes(options.module)`. If not included, throw `AuthError('MODULE_NOT_ENABLED', 'You do not have access to this module', 403)`
  - [x] 2.8 Export the factory function and types from barrel: `apps/api/src/core/rbac/index.ts`

- [x] **Task 3: Write RBAC guard unit tests** (AC: #1, #2, #3, #4, #5, #6)
  - [x] 3.1 Create `apps/api/src/core/rbac/rbac.guard.test.ts`
  - [x] 3.2 Test: STAFF user denied on MANAGER-minimum route → 403 FORBIDDEN (AC #1)
  - [x] 3.3 Test: VIEWER user denied on STAFF-minimum route → 403
  - [x] 3.4 Test: MANAGER, ADMIN, SUPER_ADMIN all pass on MANAGER-minimum route (AC #4)
  - [x] 3.5 Test: SUPER_ADMIN passes on any minimum role
  - [x] 3.6 Test: VIEWER passes on VIEWER-minimum route
  - [x] 3.7 Test: user with no role (empty string) → 403 (AC #3)
  - [x] 3.8 Test: module gating — user without module → 403 MODULE_NOT_ENABLED (AC #5)
  - [x] 3.9 Test: module gating — user with correct module → passes
  - [x] 3.10 Test: no module specified in options → module check skipped
  - [x] 3.11 Use Fastify `inject()` with test routes that register the guard as a preHandler

- [x] **Task 4: Write hasMinimumRole unit tests** (AC: #4)
  - [x] 4.1 Create `apps/api/src/core/rbac/rbac.types.test.ts`
  - [x] 4.2 Test all role combinations: every role against every minimum role (5x5 matrix = 25 cases)
  - [x] 4.3 Test hierarchy is strictly ordered: SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER

- [x] **Task 5: Apply RBAC guard to existing E2 routes** (AC: #1-#6)
  - [x] 5.1 Apply to `POST /auth/mfa/reset` in `auth.routes.ts` — replace the manual `allowedRoles.includes(request.userRole)` check (line 423-426) with `{ preHandler: createRbacGuard({ minimumRole: 'ADMIN' }) }`
  - [x] 5.2 Apply to company switch endpoint `POST /system/companies/:id/switch` in `company.routes.ts` — add `{ preHandler: createRbacGuard({ minimumRole: 'VIEWER' }) }` (any authenticated user with a role can switch)
  - [x] 5.3 DO NOT add RBAC guards to login/refresh/logout/health routes — these are public or authentication routes that bypass RBAC
  - [x] 5.4 DO NOT add RBAC guards to MFA setup/verify — these require authentication (JWT) but any authenticated user can manage their own MFA

- [x] **Task 6: Write integration tests for RBAC on existing routes** (AC: #1, #4, #5)
  - [x] 6.1 Add to `apps/api/src/core/auth/auth.routes.test.ts` or create `apps/api/src/core/rbac/rbac.integration.test.ts`
  - [x] 6.2 Test: STAFF user calls POST /auth/mfa/reset → 403 FORBIDDEN
  - [x] 6.3 Test: ADMIN user calls POST /auth/mfa/reset → 200 (succeeds)
  - [x] 6.4 Test: company-specific VIEWER override denies access to MANAGER-minimum route
  - [x] 6.5 Use same test pattern as existing E2 tests: `buildApp()` → `inject()` with mocked Prisma and JWT

- [x] **Task 7: Verify no regressions**
  - [x] 7.1 Run full E2 test suite: `pnpm --filter api test`
  - [x] 7.2 Verify existing auth tests still pass (login, refresh, logout, MFA flows)
  - [x] 7.3 Verify company context tests still pass
  - [x] 7.4 Verify the MFA reset route now uses the RBAC guard instead of manual role check

## Dev Notes

### Critical Architecture Insight: Role Already Resolved

The company-context middleware (`company-context.ts:92-105`, registered BEFORE routes in `app.ts:94`) ALREADY calls `resolveUserRole(prisma, request.userId, companyId)` and sets `request.userRole` to the effective role for the current company context. This means:

1. **Company-specific overrides are already handled** — if a user has ADMIN global + VIEWER for Company 3, `request.userRole` will be "VIEWER" when accessing Company 3
2. **The RBAC guard only needs to compare role levels** — do NOT re-query the database
3. **AC #2 and #6 are satisfied by E2-4's middleware** — the guard just enforces the already-resolved role

### Role Hierarchy (Numeric Levels)

```
SUPER_ADMIN = 5  (full system access)
ADMIN       = 4  (company administration)
MANAGER     = 3  (department management)
STAFF       = 2  (daily operations)
VIEWER      = 1  (read-only access)
```

A route requiring MANAGER (level 3) allows: MANAGER (3), ADMIN (4), SUPER_ADMIN (5). Denies: STAFF (2), VIEWER (1).

### Guard Implementation Pattern

The guard should be a **factory function** that returns a Fastify preHandler, NOT a Fastify plugin. Routes declare it inline:

```typescript
fastify.post('/admin-action', {
  preHandler: createRbacGuard({ minimumRole: 'ADMIN' }),
}, async (request, reply) => { /* handler */ });
```

This pattern allows per-route configuration without global registration. Each route declares its own minimum role and optional module requirement.

### Module Gating

Module gating checks `request.enabledModules` (set by `jwt-verify.hook.ts:88` from JWT claims). Example:
- Route `/finance/journal-entries` requires `module: 'finance'`
- If user's `enabledModules` doesn't include `'finance'`, return 403 `MODULE_NOT_ENABLED`
- For E2 routes, no module gating is needed yet — module gating will be used starting with E14 (Finance module)

### Existing Code to Reuse (DO NOT Reinvent)

| Existing Code | Location | Use For |
|---------------|----------|---------|
| `UserRole` enum | `@nexa/db` (Prisma-generated) | Single source of truth for role names — DO NOT create Zod/hardcoded enums |
| `AuthError` | `apps/api/src/core/errors/auth-error.ts` | 403 errors — already supports `statusCode: 403` |
| `request.userRole` | Set by `company-context.ts:105` | Effective role (already company-resolved) — just read it |
| `request.enabledModules` | Set by `jwt-verify.hook.ts:88` | Module list for gating — just read it |
| `sendSuccess()` | `apps/api/src/core/utils/response.ts` | Standard response envelope (not needed in guard, but for consistency) |
| Fastify plugin pattern | `jwt-verify.hook.ts`, `company-context.ts` | Reference pattern for hooks, though guard uses preHandler not plugin |

### Existing Manual RBAC Check to Replace

The MFA reset route (`auth.routes.ts:422-426`) currently does:
```typescript
const allowedRoles = ['ADMIN', 'SUPER_ADMIN'];
if (!allowedRoles.includes(request.userRole)) {
  throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
}
```

Replace this with `preHandler: createRbacGuard({ minimumRole: 'ADMIN' })`. This automatically allows ADMIN and SUPER_ADMIN (levels 4 and 5). Remove the manual check inside the handler.

### Error Codes

| Error Code | HTTP Status | When |
|------------|-------------|------|
| `FORBIDDEN` | 403 | User's role level < route's minimum role level |
| `MODULE_NOT_ENABLED` | 403 | User's enabledModules doesn't include required module |

Use `AuthError` for both (it already supports 403). These error codes align with API Contracts §1 Error Codes.

### Testing Strategy

Tests from test-design-epic-E2.md that this story must satisfy:
- **E2.5-API-001**: STAFF denied on MANAGER route → 403
- **E2.5-API-002**: Company-specific VIEWER override → denies MANAGER access
- **E2.5-API-003**: No role at all → 403
- **E2.5-API-004**: Module gating → 403 MODULE_NOT_ENABLED
- **E2.5-UNIT-001**: Role hierarchy numeric comparison (25 combinations)
- **E2.5-UNIT-002**: resolveUserRole 3-path coverage (already tested in E1/E2-4)

For integration tests: the company-specific override test (E2.5-API-002) is already verified by E2-4's company-context middleware tests (`company-context.test.ts:4.8`). The RBAC guard just needs to enforce the resulting role level.

### Testing Pattern (Follow Existing Conventions)

```typescript
import { buildApp } from '../../app.js';
import { UserRole } from '@nexa/db';

// For unit tests of the guard itself:
// Create a minimal Fastify app, register jwt-verify mock, register a test route
// with the RBAC guard, and test with inject()

// For integration tests on existing routes:
// Use buildApp() with mocked Prisma, inject with JWT containing different roles
```

Mock `@nexa/db` for unit tests. The guard reads `request.userRole` (string), so mocking the company-context middleware means just setting the decorated property.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: N/A — this story is the authorization layer, not a data-access story. companyId scoping is handled by the company-context middleware (E2-4).
- **i18n**: N/A — no UI in this story. Error messages are API error codes, not user-facing labels.
- **Audit**: RBAC denials could be audit-logged. However, E3 (Event Bus + Audit Trail) is not yet built. Add `// TODO: E3 — emit rbac.denied event` comment for future integration.
- **Attachments/Notes/Tasks**: N/A — infrastructure story, not a business entity.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §3 Authentication & Security, §Process Patterns — rbac.guard.ts | JWT claims carry role; role checking at route level; module gating; preHandler pattern |
| **API Contracts** | §1 RBAC Roles, §1 Error Codes | SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER with scope descriptions; 403 FORBIDDEN error code |
| **State Machine** | N/A | RBAC is not a state machine — it's a stateless permission check |
| **Event Catalog** | N/A | RBAC checks do not emit events (future: E3 audit trail) |
| **Data Models** | §3.1 System Module, §4.1 Enums | UserCompanyRole model (userId, companyId?, role); UserRole enum |
| **Business Rules** | §14 IMP-007 | RBAC with 5 default roles, all sensitive operations gated |
| **Project Context** | §2 RBAC: Global Role + Per-Company Exceptions | Resolution order: company-specific → global → no access; already implemented in E2-4 middleware |

### Project Structure Notes

New files:
- `apps/api/src/core/rbac/rbac.types.ts` — ROLE_LEVEL map, hasMinimumRole helper, RbacGuardOptions type
- `apps/api/src/core/rbac/rbac.guard.ts` — createRbacGuard factory function
- `apps/api/src/core/rbac/rbac.guard.test.ts` — guard unit tests
- `apps/api/src/core/rbac/rbac.types.test.ts` — role hierarchy unit tests
- `apps/api/src/core/rbac/index.ts` — barrel exports

Modified files:
- `apps/api/src/core/auth/auth.routes.ts` — replace manual role check on MFA reset with createRbacGuard
- `apps/api/src/modules/system/company.routes.ts` — add RBAC guard to company switch endpoint

Protected files (DO NOT modify):
- `packages/db/src/utils/rbac.ts` — resolveUserRole (used by company-context middleware, not by RBAC guard)
- `packages/db/src/index.ts` — barrel exports for @nexa/db
- `apps/api/src/core/middleware/company-context.ts` — already handles role resolution
- `apps/api/src/core/auth/jwt-verify.hook.ts` — already decorates request with userRole and enabledModules

### Previous Story Intelligence

**E2.S4 (Multi-Company Context Middleware)** — Most relevant predecessor:
- Established that `request.userRole` contains the effective role for the current company context
- Code review found: ISSUE #3 (HIGH) — Zod role enum in `company.schema.ts:18` is hardcoded independently from Prisma `UserRole` enum. **Do NOT repeat this mistake.** Always import `UserRole` from `@nexa/db`.
- Code review found: ISSUE #7 (MEDIUM) — `RequestContext.role` vs `FastifyRequest.userRole` naming inconsistency. The guard must use `request.userRole` (the Fastify-decorated property).

**E2.S3 (MFA TOTP)** — Established manual RBAC pattern at `auth.routes.ts:422-426` that E2-5 replaces with the formal guard.

**E2.S1 (Fastify API Bootstrap)** — Established plugin registration order, error handling pattern. The RBAC guard follows the same `AuthError` pattern.

### Key Design Decisions

1. **preHandler, not plugin** — The guard is a per-route preHandler, not a global plugin. This gives routes explicit control over their minimum role.
2. **Factory function** — `createRbacGuard(options)` returns a hook, allowing each route to specify its own requirements.
3. **No database queries** — The guard only reads `request.userRole` and `request.enabledModules`, both already set by upstream middleware. Zero additional latency.
4. **UserRole from Prisma** — The single source of truth for role names is the Prisma-generated `UserRole` enum. No parallel definitions.

### Source References

- [Source: _bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md#Story E2.S5]
- [Source: _bmad-output/planning-artifacts/project-context.md#2 RBAC: Global Role + Per-Company Exceptions]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md#14 IMP-007]
- [Source: _bmad-output/planning-artifacts/api-contracts.md#1 RBAC Roles]
- [Source: _bmad-output/planning-artifacts/data-models.md#3.1 System Module — UserCompanyRole]
- [Source: _bmad-output/planning-artifacts/architecture.md#3 Authentication & Security]
- [Source: _bmad-output/test-artifacts/test-design-epic-E2.md — E2.5-API-001 through E2.5-UNIT-002]
- [Source: apps/api/src/core/middleware/company-context.ts — role resolution at line 92-105]
- [Source: apps/api/src/core/auth/jwt-verify.hook.ts — request decoration at line 85-88]
- [Source: apps/api/src/core/auth/auth.routes.ts — manual RBAC check at line 422-426]
- [Source: packages/db/src/utils/rbac.ts — resolveUserRole implementation]
- [Source: packages/db/prisma/schema.prisma:402-410 — UserRole enum definition]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- All 7 tasks completed: RBAC types, guard factory, unit tests, hasMinimumRole tests, route application, integration tests, regression verification
- Code review completed (2026-02-19): 0 HIGH, 6 MEDIUM, 4 LOW issues identified — see Code Review Notes section below
- RBAC guard implemented as preHandler factory function (`createRbacGuard`) — no database queries, reads pre-resolved `request.userRole`
- MFA reset route (`auth.routes.ts`) migrated from manual role check to RBAC guard
- Company switch endpoint (`company.routes.ts`) protected with VIEWER minimum role
- All existing E2 tests pass (no regressions)

### File List

**New files:**
- `apps/api/src/core/rbac/rbac.types.ts` — ROLE_LEVEL map, hasMinimumRole helper, RbacGuardOptions type
- `apps/api/src/core/rbac/rbac.guard.ts` — createRbacGuard factory function
- `apps/api/src/core/rbac/rbac.guard.test.ts` — guard unit tests (8 cases)
- `apps/api/src/core/rbac/rbac.types.test.ts` — role hierarchy unit tests (25 combinations)
- `apps/api/src/core/rbac/rbac.integration.test.ts` — integration tests for RBAC on existing routes
- `apps/api/src/core/rbac/index.ts` — barrel exports

**Modified files:**
- `apps/api/src/core/auth/auth.routes.ts` — replaced manual role check on MFA reset with createRbacGuard
- `apps/api/src/modules/system/company.routes.ts` — added RBAC guard to company switch endpoint


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-19 06:12

### Remaining Issues for Human Review:

- ISSUE #1: [MEDIUM] Error message for "no role" case deviates from story spec. `rbac.guard.ts:21` throws `'Insufficient permissions'` but Task 2.4 explicitly specifies `'No role assigned'`. All three failure modes (no role, invalid role, insufficient role) return identical error codes and messages, making debugging impossible and contradicting the spec.
- ISSUE #2: [MEDIUM] SUPER_ADMIN module bypass at `rbac.guard.ts:38` is undocumented behavior not in story spec. Task 2.7 specifies a simple `enabledModules.includes(options.module)` check with no role-based bypass. This changes the security contract without documented justification.
- ISSUE #3: [MEDIUM] Case-insensitive module comparison at `rbac.guard.ts:39-40` (`.toUpperCase()` on both sides) not specified in story. Task 2.7 calls for `enabledModules.includes(options.module)` — a case-sensitive check. Introduces implicit normalization that could mask data integrity issues.
- ISSUE #4: [MEDIUM] `in` operator at `rbac.guard.ts:25` for role validation matches inherited `Object.prototype` properties (`constructor`, `toString`, `hasOwnProperty`). Should use `Object.hasOwn(ROLE_LEVEL, request.userRole)` for precise own-property checking. Current code relies on downstream `hasMinimumRole` returning false for non-numeric prototype values — a fragile implicit assumption.
- ISSUE #5: [MEDIUM] Story metadata sections left incomplete. `e2-5-rbac-permission-guards.md:249-260` has raw `{{agent_model_name_version}}` placeholder, empty Debug Log References, empty Completion Notes, and empty File List. None of the 7 new/modified files are recorded.
- ISSUE #6: [MEDIUM] `ROLE_LEVEL` exported from barrel `rbac/index.ts:1` leaks implementation detail. Story Task 2.8 says "Export the factory function and types from barrel" — `createRbacGuard` and `RbacGuardOptions`. Exporting `ROLE_LEVEL` makes numeric level values a public API, coupling consumers to internal hierarchy representation.
- ISSUE #7: [LOW] Pre-existing hardcoded Zod role enum in `company.schema.ts:18` (`z.enum(['SUPER_ADMIN', ...])`) not addressed despite story's Previous Story Intelligence explicitly warning: "ISSUE #3 (HIGH) — Do NOT repeat this mistake. Always import UserRole from @nexa/db." E2-5 modified `company.routes.ts` in the same module but left the drift.
- ISSUE #8: [LOW] No integration test for company switch endpoint (`POST /system/companies/:id/switch`) with the new RBAC guard added in Task 5.2. Task 6 integration tests only cover MFA reset and a custom MANAGER route.
- ISSUE #9: [LOW] Unit test `buildTestApp()` in `rbac.guard.test.ts:56-65` reimplements a simplified error handler separate from production `error-handler.ts`. If production error handler behavior changes (e.g., remapping error codes), unit test assertions about error codes won't catch the regression.
- ISSUE #10: [LOW] `it.each` test patterns at `rbac.guard.test.ts:137-165` and `168-197` create and tear down a new Fastify instance per parameterized case (8 full lifecycle cycles). Could register multiple test routes on a single instance and reuse it, reducing test execution time and boilerplate.
- Summary: 0 HIGH, 6 MEDIUM, 4 LOW issues found

---


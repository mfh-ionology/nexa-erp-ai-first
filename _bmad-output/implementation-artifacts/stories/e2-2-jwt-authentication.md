# Story 2.2: JWT Authentication

Status: done

## Story

As a user,
I want to log in with email and password and receive JWT tokens,
so that I can access authenticated API endpoints with stateless authentication.

## Acceptance Criteria

1. GIVEN valid email and password WHEN `POST /auth/login` is called THEN the response contains an accessToken (15min expiry), refreshToken (7-day, httpOnly cookie), expiresIn, and user profile data (id, email, firstName, lastName, role, enabledModules, tenantId, mfaEnabled)
2. GIVEN an expired access token WHEN `POST /auth/refresh` is called with a valid refresh token cookie THEN a new access token is issued and the old refresh token is rotated
3. GIVEN a valid session WHEN `POST /auth/logout` is called THEN the refresh token is revoked in the database and the httpOnly cookie is cleared
4. GIVEN an invalid email or password WHEN `POST /auth/login` is called THEN a 401 `INVALID_CREDENTIALS` error is returned with no information leaking which field was wrong
5. GIVEN 5 failed login attempts within 15 minutes WHEN a 6th attempt is made THEN the account is locked and a 423 `ACCOUNT_LOCKED` error is returned (NFR15)
6. GIVEN a JWT access token WHEN any authenticated endpoint is called THEN the Fastify `onRequest` hook verifies the token, extracts userId, tenantId, and role, and decorates the request object

## Tasks / Subtasks

- [x] **Task 1: Install auth dependencies** (AC: #1, #2, #6)
  - [x] 1.1 Add runtime deps to `apps/api/package.json`: `argon2`, `jose` (replaces `jsonwebtoken` per Dev Notes — ESM-native, no `@types` needed), `@fastify/cookie`
  - [x] 1.2 ~~Add dev deps: `@types/jsonwebtoken`~~ Not needed — `jose` ships with TypeScript types
  - [x] 1.3 Run `pnpm install` from monorepo root
  - [x] 1.4 Verify `@nexa/db` is already a dependency (provides User, RefreshToken, UserCompanyRole models)

- [x] **Task 2: Create Zod validation schemas** (AC: #1, #2, #3, #4)
  - [x] 2.1 `apps/api/src/core/auth/auth.schema.ts` -- Define Zod schemas:
    - `loginRequestSchema`: `{ email: z.string().email(), password: z.string().min(1) }`
    - `loginResponseSchema`: `{ accessToken, refreshToken, expiresIn, user: { id, email, firstName, lastName, role, enabledModules, tenantId, tenantName, mfaEnabled }, requiresMfa? }`
    - `refreshResponseSchema`: `{ accessToken, expiresIn }`
    - `logoutResponseSchema`: `{ message: string }`
  - [x] 2.2 Export all schemas + inferred TypeScript types (`LoginRequest`, `LoginResponse`, etc.)

- [x] **Task 3: Implement auth service** (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 `apps/api/src/core/auth/auth.service.ts`:
    - `verifyPassword(hash, password)` -- Argon2id verify
    - `hashPassword(password)` -- Argon2id hash (for tests/seed use)
    - `generateAccessToken(payload)` -- JWT sign with 15min expiry, claims: `{ sub: userId, tenantId, role, enabledModules }`
    - `verifyAccessToken(token)` -- JWT verify, return decoded payload
    - `generateRefreshToken()` -- Crypto random bytes -> hex string
    - `hashRefreshToken(token)` -- SHA-256 hash for DB storage
    - `createRefreshTokenRecord(prisma, userId, tokenHash, ipAddress?, userAgent?)` -- Insert into RefreshToken table
    - `revokeRefreshToken(prisma, tokenHash)` -- Set `revokedAt` on RefreshToken record
    - `revokeAllUserTokens(prisma, userId)` -- Revoke all refresh tokens for a user
    - `findValidRefreshToken(prisma, tokenHash)` -- Find token where not revoked and not expired
    - `resolveUserRole(prisma, userId, companyId)` -- Use `@nexa/db` `resolveUserRole` utility
  - [x] 3.2 JWT secret from `JWT_SECRET` env var (throw on missing)
  - [x] 3.3 Write unit tests: `apps/api/src/core/auth/auth.service.test.ts`
    - Test password hash/verify roundtrip
    - Test JWT sign/verify roundtrip with correct claims
    - Test JWT verify rejects expired tokens
    - Test JWT verify rejects malformed tokens
    - Test refresh token hash is deterministic (same input = same hash)

- [x] **Task 4: Implement login rate limiter** (AC: #5)
  - [x] 4.1 `apps/api/src/core/auth/login-rate-limiter.ts`:
    - In-memory Map (upgrade to Redis in E3) tracking `{ email -> { count, firstAttemptAt } }`
    - `recordFailedAttempt(email)` -- Increment counter, set firstAttemptAt if first
    - `isLocked(email)` -- Return true if count >= 5 within 15-minute window
    - `resetAttempts(email)` -- Clear on successful login
    - Auto-expire entries older than 15 minutes
  - [x] 4.2 Write unit test: `apps/api/src/core/auth/login-rate-limiter.test.ts`
    - Test 5 failures lock the account
    - Test successful login resets counter
    - Test window expires after 15 minutes

- [x] **Task 5: Implement auth routes** (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 `apps/api/src/core/auth/auth.routes.ts` -- Fastify plugin with prefix `/auth`:
    - `POST /auth/login`:
      1. Validate request body against `loginRequestSchema`
      2. Check rate limiter -- if locked, return 423 `ACCOUNT_LOCKED`
      3. Find user by email (include `isActive` check)
      4. If user not found or not active, return 401 `INVALID_CREDENTIALS` (same message for both)
      5. Verify password with Argon2id
      6. If wrong password, record failed attempt, return 401 `INVALID_CREDENTIALS`
      7. If MFA enabled and no `mfaToken`, return 200 with `requiresMfa: true` (NO tokens issued)
      8. Reset rate limiter on success
      9. Resolve role via `resolveUserRole(prisma, user.id, user.companyId)`
      10. Generate access token with claims `{ sub: userId, tenantId, role, enabledModules }`
      11. Generate refresh token, hash it, store in RefreshToken table
      12. Update `user.lastLoginAt`
      13. Set httpOnly cookie with refresh token
      14. Return `LoginResponse` with accessToken, expiresIn, user profile
    - `POST /auth/refresh`:
      1. Read refresh token from httpOnly cookie
      2. If missing, return 401 `UNAUTHORIZED`
      3. Hash the cookie value, look up in RefreshToken table
      4. If not found, expired, or revoked -- return 401 `UNAUTHORIZED`
      5. Revoke old refresh token (set `revokedAt`)
      6. Generate new refresh token, hash, store in DB
      7. Generate new access token
      8. Set new httpOnly cookie
      9. Return `{ accessToken, expiresIn }`
    - `POST /auth/logout`:
      1. Read refresh token from httpOnly cookie
      2. If present, hash it and revoke in DB
      3. Clear httpOnly cookie
      4. Return `{ message: "Logged out" }`
  - [x] 5.2 Configure httpOnly cookie options:
    - `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'strict'`
    - `path: '/auth'` (only sent to auth endpoints)
    - `maxAge: 7 * 24 * 60 * 60` (7 days in seconds)
    - Cookie name: `nexa_refresh_token`
  - [x] 5.3 Write integration tests: `apps/api/src/core/auth/auth.routes.test.ts`
    - Test successful login returns correct response shape
    - Test login sets httpOnly cookie
    - Test login with wrong email returns 401
    - Test login with wrong password returns 401 (same error message)
    - Test login with inactive user returns 401
    - Test refresh with valid cookie rotates token
    - Test refresh with old/revoked token fails
    - Test refresh without cookie returns 401
    - Test logout clears cookie and revokes token
    - Test account lockout after 5 failed attempts
    - Test lockout returns 423

- [x] **Task 6: Implement JWT verification hook** (AC: #6)
  - [x] 6.1 `apps/api/src/core/auth/jwt-verify.hook.ts` -- Fastify plugin:
    - Register `onRequest` hook
    - Skip verification for public routes: `/auth/login`, `/auth/password/reset-request`, `/auth/password/reset`, `/health`, `/documentation`
    - Extract `Authorization: Bearer <token>` header
    - If missing or malformed, throw `AuthError('UNAUTHORIZED', 'Authentication required', 401)`
    - Verify JWT, extract claims
    - Decorate `request` with: `request.userId`, `request.tenantId`, `request.userRole`, `request.enabledModules`
  - [x] 6.2 Add Fastify type declarations for decorated properties:
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
  - [x] 6.3 Write unit tests: `apps/api/src/core/auth/jwt-verify.hook.test.ts`
    - Test valid token decorates request correctly
    - Test missing Authorization header returns 401
    - Test malformed header (no "Bearer") returns 401
    - Test expired token returns 401
    - Test invalid signature returns 401
    - Test public routes bypass verification

- [x] **Task 7: Register auth plugins in app factory** (AC: #1-#6)
  - [x] 7.1 Update `apps/api/src/app.ts`:
    - Register `@fastify/cookie` plugin
    - Register `jwtVerifyPlugin` (after cookie, before routes)
    - Register `authRoutesPlugin` (under `/auth` prefix)
  - [x] 7.2 Update integration tests in `apps/api/src/app.test.ts`:
    - Verify auth routes are accessible
    - Verify JWT hook is active on non-public routes

- [x] **Task 8: Emit user.login event** (AC: #1)
  - [x] 8.1 In login route success path, emit `user.login` event with payload `{ userId, loginMethod: 'password', ipAddress: request.ip }`
  - [x] 8.2 Use a simple typed EventEmitter for now (placeholder until E3 event bus); file: `apps/api/src/core/events/event-emitter.ts`
  - [x] 8.3 Write test verifying event is emitted on successful login

- [x] **Task 9: End-to-end auth flow test** (AC: #1-#6)
  - [x] 9.1 Full lifecycle test: login -> access protected route -> token expires -> refresh -> access again -> logout -> refresh fails
  - [x] 9.2 Verify the response envelope format: `{ success: true, data: { accessToken, ... } }`

## Dev Notes

### Architecture Constraints (MUST FOLLOW)

**JWT Token Structure:**
```typescript
// Access token payload (15min TTL)
{
  sub: string;          // userId (UUID)
  tenantId: string;     // Tenant identifier (for MVP: configured env var or derived from DB)
  role: UserRole;       // Resolved role for user's default company
  enabledModules: string[]; // Modules this user can access
  iat: number;          // Issued at
  exp: number;          // Expiry
}
```

**Auth Flow (Architecture Section 3):**
1. User submits credentials -> API validates against Argon2id hash
2. If MFA enabled -> return `requiresMfa: true` (no tokens issued) -- MFA verification deferred to E2-3
3. User submits TOTP code -> API verifies (E2-3)
4. API issues: access JWT (15min, in response body) + refresh token (7d, httpOnly cookie)
5. Frontend stores access JWT in memory (not localStorage)
6. On 401 -> frontend calls `/auth/refresh` with cookie -> new access JWT
7. On logout -> refresh token revoked in DB

**Response Envelope (from E2-1):**
```typescript
// Success -- use sendSuccess() from core/utils/response.ts
{ success: true, data: { accessToken, refreshToken, expiresIn, user: {...} } }

// Error -- use AppError/AuthError classes; error handler converts to envelope
{ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }
```

**URL Pattern:** Auth routes at `/auth/login`, `/auth/refresh`, `/auth/logout` -- NOT under `/api/v1/` (auth is infrastructure, not a versioned module API).

**Error Codes for Auth (Architecture):**
- `INVALID_CREDENTIALS` (401) -- wrong email or password (never reveal which)
- `UNAUTHORIZED` (401) -- missing or invalid JWT
- `FORBIDDEN` (403) -- insufficient role/permissions (used by RBAC in E2-5)
- `ACCOUNT_LOCKED` (423) -- too many failed login attempts
- `MFA_REQUIRED` (401) -- valid credentials but MFA needed (E2-3)

### Technology Stack

| Technology | Version | Notes |
|-----------|---------|-------|
| argon2 | Latest | Node.js Argon2id binding. Use `argon2.verify()` and `argon2.hash()` |
| jsonwebtoken | Latest | JWT sign/verify. Alternative: `jose` (ESM-native) -- prefer `jose` if import issues |
| @fastify/cookie | Latest | Cookie parsing and setting for httpOnly refresh tokens |
| crypto (Node built-in) | N/A | `crypto.randomBytes(32).toString('hex')` for refresh token generation |
| crypto (Node built-in) | N/A | `crypto.createHash('sha256')` for refresh token hashing |

**CRITICAL: Argon2id Configuration:**
```typescript
import argon2 from 'argon2';

// Hash with Argon2id (OWASP recommended settings)
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 4,      // 4 threads
});

// Verify
const isValid = await argon2.verify(hash, password);
```

**CRITICAL: JWT Library Choice:**
The project uses ESM (`"type": "module"`). `jsonwebtoken` has known ESM issues. Prefer `jose` (pure ESM, no native deps):
```typescript
import { SignJWT, jwtVerify } from 'jose';

// Sign
const token = await new SignJWT({ sub: userId, tenantId, role, enabledModules })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('15m')
  .setIssuedAt()
  .sign(new TextEncoder().encode(secret));

// Verify
const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
```

**ENV Variables Required:**
- `JWT_SECRET` -- HMAC secret for JWT signing (min 32 chars). MUST be set; throw on startup if missing.
- `JWT_ACCESS_EXPIRY` -- Optional, default `'15m'`
- `JWT_REFRESH_EXPIRY_DAYS` -- Optional, default `7`
- `TENANT_ID` -- For MVP single-tenant, the tenant identifier to include in JWT claims

### Existing Code to REUSE (DO NOT RECREATE)

| Utility | Package | Import |
|---------|---------|--------|
| PrismaClient singleton | `@nexa/db` | `import { prisma } from '@nexa/db'` |
| User type | `@nexa/db` | `import type { User } from '@nexa/db'` |
| RefreshToken type | `@nexa/db` | `import type { RefreshToken } from '@nexa/db'` |
| UserRole enum | `@nexa/db` | `import { UserRole } from '@nexa/db'` |
| resolveUserRole | `@nexa/db` | `import { resolveUserRole } from '@nexa/db'` |
| AppError base | `../errors/index.js` | `import { AppError } from '../errors/index.js'` |
| AuthError | `../errors/index.js` | `import { AuthError } from '../errors/index.js'` |
| sendSuccess | `../utils/response.js` | `import { sendSuccess } from '../utils/response.js'` |

**CRITICAL: Do NOT create a separate PrismaClient.** Import `prisma` from `@nexa/db`. The singleton is already configured.

**CRITICAL: Do NOT recreate error classes.** AuthError already exists at `apps/api/src/core/errors/auth-error.ts` with `code`, `message`, `statusCode` (401|403).

**CRITICAL: Role is NOT on User model.** Roles are resolved via `UserCompanyRole` join table using `resolveUserRole(prisma, userId, companyId)` from `@nexa/db`. For login, resolve using `user.companyId` (the user's default company).

### File Structure (EXACT paths)

```
apps/api/src/
├── app.ts                                    # UPDATE: register cookie + auth plugins
├── core/
│   ├── auth/
│   │   ├── auth.schema.ts                    # Zod schemas + TypeScript types
│   │   ├── auth.service.ts                   # JWT, password, refresh token logic
│   │   ├── auth.service.test.ts              # Unit tests
│   │   ├── auth.routes.ts                    # POST /auth/login, /refresh, /logout
│   │   ├── auth.routes.test.ts               # Integration tests
│   │   ├── jwt-verify.hook.ts                # onRequest JWT verification plugin
│   │   ├── jwt-verify.hook.test.ts           # Hook tests
│   │   ├── login-rate-limiter.ts             # In-memory rate limiter
│   │   └── login-rate-limiter.test.ts        # Rate limiter tests
│   ├── events/
│   │   └── event-emitter.ts                  # Simple typed EventEmitter (placeholder for E3)
│   ├── errors/                               # EXISTING -- do NOT modify
│   ├── logger/                               # EXISTING -- do NOT modify
│   ├── middleware/                            # EXISTING -- do NOT modify
│   ├── routes/                               # EXISTING -- do NOT modify
│   ├── utils/                                # EXISTING -- do NOT modify
│   └── validation/                           # EXISTING -- do NOT modify
```

### Naming Conventions (MUST FOLLOW)

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case with suffix | `auth.service.ts`, `jwt-verify.hook.ts` |
| Route files | `{domain}.routes.ts` | `auth.routes.ts` |
| Schema files | `{domain}.schema.ts` | `auth.schema.ts` |
| Test files | Co-located, `.test.ts` | `auth.service.test.ts` |
| Functions | camelCase | `verifyPassword()`, `generateAccessToken()` |
| Constants | UPPER_SNAKE_CASE | `JWT_ACCESS_EXPIRY`, `MAX_LOGIN_ATTEMPTS` |
| Zod schemas | camelCase + `Schema` suffix | `loginRequestSchema`, `loginResponseSchema` |
| Error codes | UPPER_SNAKE_CASE | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` |
| Cookie name | snake_case | `nexa_refresh_token` |

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not directly used for data queries in this story, but the login flow resolves the user's role via their default `companyId`. The JWT will carry `tenantId` for future per-tenant DB routing.
- **i18n**: Error messages in this story use English strings directly. Error `code` fields are translation-key-ready (UPPER_SNAKE_CASE). When i18n is introduced (E4), error messages will be mapped to translation keys.
- **Audit**: Emit `user.login` event on successful login. Full audit trail logging deferred to E3 event bus.
- **Attachments/Notes/Tasks**: Not applicable to auth infrastructure.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | S3 Authentication & Security | Argon2id, JWT 15min/7d, httpOnly cookie, auth flow steps 1-7, tenant resolution flow; Error codes: `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_MFA_REQUIRED` |
| **API Contracts** | S2.1 Auth & Session, S3.1 Auth Endpoints | `POST /auth/login` request/response schemas, error codes (401 INVALID_CREDENTIALS, 401 MFA_REQUIRED, 423 ACCOUNT_LOCKED) |
| **State Machine** | N/A | No auth state machine; login is not a lifecycle transition |
| **Event Catalog** | S16 System Events | `user.login` event: `{ userId: string, loginMethod: string, ipAddress?: string }` |
| **Data Models** | S3.1 System Module | User (passwordHash, mfaEnabled, mfaSecret, companyId, enabledModules), RefreshToken (tokenHash, expiresAt, revokedAt), UserCompanyRole (userId, companyId?, role) |
| **Business Rules** | S14 IMP-007, IMP-008; NFR13, NFR15 | RBAC with 5 roles (HARD enforcement); MFA support (HARD); Argon2id password hashing; 5 failed attempts / 15min lockout |
| **Project Context** | S2 RBAC Resolution, S8b Platform Layer | Role resolution: company-specific -> global -> no access; MVP single-tenant uses configured tenantId |
| **UX Design Spec** | N/A | No UI in this story (API only). Login UI deferred to E6. |

### Project Structure Notes

- `apps/api/package.json` already has `@nexa/db` and `@nexa/shared` as dependencies. Add auth deps alongside.
- The `apps/api/src/app.ts` registers plugins in a specific order. Auth plugins must be registered AFTER error handler and BEFORE routes.
- Monorepo uses `pnpm` workspaces and `Turborepo`. Install deps with `pnpm add <pkg> --filter @nexa/api`.
- `packages/db/prisma/seed.ts` creates a seeded admin user: email `admin@nexa-erp.dev`, password `NexaDev2026!` (Argon2id hashed), UUID `00000000-0000-4000-a000-000000000002`, global SUPER_ADMIN role.

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md -- S3 Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md -- Error Code Convention, Process Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md -- core/auth/ structure]
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md -- S2.1 Auth & Session]
- [Source: _bmad-output/planning-artifacts/api-contracts/3-detailed-endpoint-specifications.md -- S3.1 Auth Endpoints]
- [Source: _bmad-output/planning-artifacts/event-catalog.md -- S16 System Events]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md -- S14 IMP-007, IMP-008]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md -- NFR10, NFR11, NFR13, NFR15]
- [Source: _bmad-output/planning-artifacts/project-context.md -- S2 RBAC, S8b Platform Layer]
- [Source: _bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md -- Story E2.S2]

### Previous Story Intelligence (E2-1)

**E2-1 code review identified 3 HIGH issues the developer must be aware of:**
1. **Swagger/OpenAPI endpoint returns 500** -- 3 tests failing. Do NOT fix in E2-2, but be aware when adding auth routes to OpenAPI.
2. **No `setNotFoundHandler`** -- Fastify's default 404 breaks the standardised envelope. Consider adding this in E2-2 if it blocks auth route testing.
3. **Missing `zod-to-json-schema`** -- Not installed in package.json. May affect schema-to-OpenAPI generation.

**E2-1 patterns to follow:**
- ESM modules (`"type": "module"` in package.json, `.js` extensions in imports)
- Fastify plugin pattern: export as `fp()` wrapped function for proper encapsulation
- `fastify.inject()` for all API tests (no real HTTP server)
- Barrel exports from `index.ts` files
- Co-located tests with `.test.ts` suffix
- Vitest as test runner

**E2-1 existing infrastructure:**
- Error handler: Maps `AppError` subtypes to HTTP status codes, returns `{ success, error }` envelope
- Zod validation: `setValidatorCompiler` / `setSerializerCompiler` configured
- Correlation ID: Generated per request, available on `request.id`
- Rate limit: Global 100 req/min per IP via `@fastify/rate-limit`
- Structured logger: Pino with JSON output, `correlationId/tenantId/userId/module` fields

### Git Intelligence

```
f437b73 docs: update all spec documents for multi-LLM provider abstraction
39b7950 feat(e1): add core data models, auth, number series, and platform DB
8f09c84 fix(e0): apply E0 retrospective fixes
75df378 feat(e0-4): add ESLint, Prettier, Husky, and commitlint
```

**Commit convention:** `feat(e2): <description>` for new features. Conventional commits enforced via Husky + commitlint.

### Test Design Reference

From `_bmad-output/test-artifacts/test-design-epic-E2.md`:

| Test ID | Description | Priority | Risk |
|---------|-------------|----------|------|
| E2.2-API-001 | Login with valid credentials returns accessToken (15min), refreshToken (httpOnly cookie), user profile with role + enabledModules | P0 | R-001 |
| E2.2-API-002 | Login with invalid credentials returns 401 INVALID_CREDENTIALS -- same message for wrong email and wrong password (no info leakage) | P0 | R-010 |
| E2.2-API-003 | Refresh with valid refresh token cookie issues new access token and rotates refresh token | P0 | R-003 |
| E2.2-API-004 | Old refresh token rejected after rotation (replay prevention) | P0 | R-003 |
| E2.2-API-005 | Logout revokes refresh token; subsequent refresh attempt fails | P0 | R-003 |
| E2.2-API-006 | JWT onRequest hook rejects missing, expired, and malformed tokens with 401 | P0 | R-001 |
| E2.2-API-007 | Account locked after 5 failed logins in 15 minutes; 6th returns 423 ACCOUNT_LOCKED | P0 | R-006 |
| E2.2-API-008 | JWT claims contain correct userId, tenantId, role, enabledModules | P2 | R-001 |
| E2.2-API-009 | Request decorated with userId, tenantId, userRole, enabledModules after JWT verification | P2 | R-001 |
| E2.2-PERF-001 | Login endpoint responds within 500ms under normal load | P3 | NFR2 |

**Testing approach:** Use Fastify `inject()` for all API tests. Create test user with Argon2id-hashed password in test setup. Use `jose` or equivalent to generate test JWTs.

**Test prerequisites:**
- Seeded user in test DB (use `admin@nexa-erp.dev` from E1 seed, or create test fixtures)
- Prisma test client connected to test database
- No Redis needed for MVP -- rate limiter is in-memory

### E1 Retro Intelligence (Previous Epic Learnings)

1. **NEVER use `prisma db push`** -- always `prisma migrate dev`. This caused two story failures in E1.
2. **Protected files from E1** -- DO NOT modify or delete:
   - `packages/db/src/client.ts` (PrismaClient singleton)
   - `packages/db/src/index.ts` (barrel exports for @nexa/db)
   - `packages/db/src/utils/sharing.ts` (getVisibleCompanyIds)
   - `packages/db/src/utils/rbac.ts` (resolveUserRole)
   - `packages/db/src/services/number-series.service.ts` (nextNumber)
   - `packages/db/package.json`
3. **`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes`** must be in `.env`
4. **Node.js v22** -- Required for Prisma 7.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- All 9 tasks completed with all subtasks marked done
- Code review completed (2026-02-19) with 3 HIGH, 5 MEDIUM, 4 LOW issues documented for human review
- Implementation covers: JWT auth with jose (ESM-native), Argon2id password hashing, httpOnly cookie refresh tokens, login rate limiting, JWT verification hook, event emission
- Dependencies added: argon2, jose, @fastify/cookie
- Tests: unit tests (auth.service, login-rate-limiter, jwt-verify.hook) + integration tests (auth.routes) + e2e auth flow test

### File List

- `apps/api/src/core/auth/auth.schema.ts` — Zod validation schemas
- `apps/api/src/core/auth/auth.service.ts` — JWT, password, refresh token logic
- `apps/api/src/core/auth/auth.service.test.ts` — Unit tests
- `apps/api/src/core/auth/auth.routes.ts` — POST /auth/login, /refresh, /logout
- `apps/api/src/core/auth/auth.routes.test.ts` — Integration tests
- `apps/api/src/core/auth/jwt-verify.hook.ts` — onRequest JWT verification plugin
- `apps/api/src/core/auth/jwt-verify.hook.test.ts` — Hook tests
- `apps/api/src/core/auth/login-rate-limiter.ts` — In-memory rate limiter
- `apps/api/src/core/auth/login-rate-limiter.test.ts` — Rate limiter tests
- `apps/api/src/core/events/event-emitter.ts` — Typed EventEmitter placeholder
- `apps/api/src/app.ts` — Updated: registered cookie + auth plugins
- `apps/api/src/app.test.ts` — Updated: auth route integration tests


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-19 02:53

### Remaining Issues for Human Review:

- **ISSUE #1: [HIGH] JWT payload claims are NOT validated after signature verification — security risk**
- **ISSUE #2: [HIGH] `payload.sub!` non-null assertion silently passes `undefined` as `userId`**
- **ISSUE #3: [MEDIUM] `getJwtSecret()` re-encodes the secret into a `Uint8Array` on every single call**
- **ISSUE #4: [MEDIUM] `revokeAllUserTokens` is exported but never imported or called anywhere**
- **ISSUE #5: [MEDIUM] MFA check returns a response that violates the `loginResponseSchema`**
- **ISSUE #6: [MEDIUM] Rate limiter eviction under capacity uses Map insertion order, not actual timestamp**
- **ISSUE #7: [MEDIUM] Package.json adds 8 runtime dependencies beyond the E2-2 story scope**
- **ISSUE #8: [MEDIUM] No `setNotFoundHandler` — Fastify default 404 breaks the standardized error envelope**
- **ISSUE #9: [LOW] `enabledModules` claim in JWT is not validated as `string[]` anywhere**
- **ISSUE #10: [LOW] Brittle `as unknown as` getter/setter pattern for `enabledModules` request decoration**
- **ISSUE #11: [LOW] `auth.routes.test.ts` uses a fake Argon2id hash constant that could never be verified**
- **ISSUE #12: [LOW] Module-level singleton `appEvents` emitter has no cleanup between tests**
- **3 HIGH, 5 MEDIUM, 4 LOW issues found**

---


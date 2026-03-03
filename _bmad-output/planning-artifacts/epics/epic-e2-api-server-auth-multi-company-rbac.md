# Epic E2: API Server + Auth + Multi-Company RBAC

**Tier:** 0 | **Dependencies:** E1 | **Type:** API foundation + authentication
**FRs:** FR80-FR83 (users, roles, MFA, sessions), FR172 (company switching), FR175-FR177 (company RBAC)
**API Endpoints:** /auth/login, /auth/refresh, /auth/logout, /auth/mfa/*, /auth/password/*, /system/users CRUD, /system/companies CRUD
**Business Rules:** IMP-007 (RBAC 5 roles), IMP-008 (MFA), IMP-009 (CRUD <500ms)

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E2.1 | Fastify API Bootstrap | Pending |
| E2.2 | JWT Authentication | Pending |
| E2.3 | MFA (TOTP) | Pending |
| E2.4 | Multi-Company Context Middleware | Pending |
| E2.5 | RBAC Permission Guards | Pending |
| E2.6 | User & Company Management API | Pending |

---

## Story E2.S1: Fastify API Bootstrap

**User Story:** As a developer, I want a fully configured Fastify server with request validation, error handling, structured logging, and standard middleware, so that all API routes built on top of it follow consistent patterns.

**Acceptance Criteria:**
1. GIVEN the Fastify app factory in apps/api/src/app.ts WHEN the server starts THEN it registers CORS, Helmet, rate limiting, correlation ID, request logger, and error handler plugins
2. GIVEN a request to any endpoint WHEN a correlation ID header is not present THEN the middleware generates a UUID correlation ID and attaches it to the request and response
3. GIVEN any unhandled error WHEN it is thrown in a route handler THEN the error handler returns the standardised error envelope `{ success: false, error: { code, message, details? } }` with the correct HTTP status code
4. GIVEN a Zod validation schema on a route WHEN the request body fails validation THEN a 400 ValidationError is returned with field-level error details
5. GIVEN the structured logger WHEN any request is handled THEN it logs level, message, timestamp, correlationId, tenantId, userId, module in JSON format per Architecture §Communication Patterns — Logging
6. GIVEN the health endpoint WHEN `GET /health` is called THEN it returns `{ status: "ok", version, uptime }` with 200 status

**Key Tasks:**
- [ ] Create Fastify app factory (AC: #1)
  - [ ] apps/api/src/app.ts with plugin registration
  - [ ] Register @fastify/cors, @fastify/helmet, @fastify/rate-limit
  - [ ] Register @fastify/swagger for OpenAPI docs (NFR45)
- [ ] Implement correlation ID middleware (AC: #2)
  - [ ] apps/api/src/core/middleware/correlation-id.ts
  - [ ] Generate UUID if X-Correlation-ID header missing
- [ ] Implement error handler (AC: #3, #4)
  - [ ] apps/api/src/core/errors/ — AppError, DomainError, AuthError, NotFoundError, ValidationError hierarchy
  - [ ] Fastify setErrorHandler mapping error types to status codes
  - [ ] Return standardised `{ success: false, error: {...} }` envelope
- [ ] Implement Zod validation integration (AC: #4)
  - [ ] Custom Fastify schema compiler using Zod
  - [ ] Field-level error extraction from ZodError
- [ ] Configure structured logger (AC: #5)
  - [ ] Pino logger with JSON output, correlation ID injection
  - [ ] apps/api/src/core/logger/logger.ts
- [ ] Implement health endpoint (AC: #6)
  - [ ] GET /health with status, version from package.json, uptime
- [ ] Create entry point (AC: #1)
  - [ ] apps/api/src/index.ts — start server on PORT env var

**FR/NFR:** N/A (infrastructure); NFR2 (CRUD <500ms), NFR41 (TypeScript strict), NFR45 (OpenAPI docs)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §1 Application Architecture, §4.1 API Design, §Process Patterns — Error Handling | Modular monolith, Fastify plugin system, AppError hierarchy, standardised error envelope |
| API Contracts | §1 Overview — Response Envelope, Error Codes, Pagination | `{ success, data, meta }` / `{ success, error }`, cursor-based pagination, 401/403/404/422/500 |
| Data Models | N/A | N/A — no models defined in this story |
| State Machines | N/A | N/A — no state machines in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-009 | CRUD operations complete within 500ms |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §11 Development Rules | Rule 7: TDD, every service has co-located tests |

---

## Story E2.S2: JWT Authentication

**User Story:** As a user, I want to log in with email and password and receive JWT tokens, so that I can access authenticated API endpoints with stateless authentication.

**Acceptance Criteria:**
1. GIVEN valid email and password WHEN POST /auth/login is called THEN the response contains an accessToken (15min expiry), refreshToken (7-day, httpOnly cookie), expiresIn, and user profile data (id, email, firstName, lastName, role, enabledModules, tenantId, mfaEnabled)
2. GIVEN an expired access token WHEN POST /auth/refresh is called with a valid refresh token cookie THEN a new access token is issued and the old refresh token is rotated
3. GIVEN a valid session WHEN POST /auth/logout is called THEN the refresh token is revoked in Redis/database and the httpOnly cookie is cleared
4. GIVEN an invalid email or password WHEN POST /auth/login is called THEN a 401 INVALID_CREDENTIALS error is returned with no information leaking which field was wrong
5. GIVEN 5 failed login attempts within 15 minutes WHEN a 6th attempt is made THEN the account is locked and a 423 ACCOUNT_LOCKED error is returned (NFR15)
6. GIVEN a JWT access token WHEN any authenticated endpoint is called THEN the Fastify onRequest hook verifies the token, extracts userId, tenantId, and role, and decorates the request object

**Key Tasks:**
- [ ] Implement auth service (AC: #1, #4)
  - [ ] apps/api/src/core/auth/auth.service.ts
  - [ ] Password verification using Argon2id
  - [ ] JWT generation with claims: userId, tenantId, role, enabledModules
  - [ ] Access token: 15min expiry, refresh token: 7-day expiry
- [ ] Implement login route (AC: #1, #4)
  - [ ] POST /auth/login with Zod schema validation
  - [ ] Return user profile + tokens per API Contracts §3.1
- [ ] Implement refresh flow (AC: #2)
  - [ ] POST /auth/refresh reads httpOnly cookie
  - [ ] Rotate refresh token (old one invalidated)
  - [ ] Issue new access token
- [ ] Implement logout (AC: #3)
  - [ ] POST /auth/logout revokes refresh token
  - [ ] Clear httpOnly cookie
- [ ] Implement rate limiting on login (AC: #5)
  - [ ] Track failed attempts per email in Redis
  - [ ] Lock after 5 failures within 15 minutes
  - [ ] Return 423 ACCOUNT_LOCKED
- [ ] Implement JWT verification hook (AC: #6)
  - [ ] Fastify onRequest hook for authenticated routes
  - [ ] Decorate request with userId, tenantId, role, enabledModules
- [ ] Implement tenant database resolution (AC: #6)
  - [ ] TenantDatabaseManager — resolve tenantId to PrismaClient
  - [ ] Decorate request with tenant-specific db connection

**FR/NFR:** FR80 (user auth); NFR10 (MFA foundation), NFR13 (Argon2), NFR15 (rate limiting)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | Argon2id, JWT 15min/7d, httpOnly cookie, Redis for revocation, auth flow steps 1-7, tenant resolution flow |
| API Contracts | §2.1 Auth & Session, §3.1 Auth Endpoints | POST /auth/login, /auth/refresh, /auth/logout — request/response schemas |
| Data Models | §3.1 System Module | User model with passwordHash, mfaEnabled, mfaSecret |
| State Machines | N/A | N/A — login is not a state machine transition |
| Event Catalog | §16 System Events | `user.login` event: { userId, loginMethod, ipAddress } |
| Business Rules | §14 IMP-007, IMP-008 | RBAC with 5 roles, MFA support |
| UX Design Spec | N/A | N/A — no UI in this story (API only) |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | JWT carries role, resolution happens at RBAC guard level |

---

## Story E2.S3: MFA (TOTP)

**User Story:** As a user, I want to enable Time-based One-Time Password (TOTP) multi-factor authentication on my account, so that my login is protected with a second factor.

**Acceptance Criteria:**
1. GIVEN an authenticated user WHEN POST /auth/mfa/setup is called THEN a TOTP secret is generated and returned as a QR code URI and base32-encoded secret for manual entry
2. GIVEN a user with MFA being set up WHEN they submit a valid TOTP code via POST /auth/mfa/verify THEN MFA is permanently enabled on their account
3. GIVEN a user with MFA enabled WHEN they log in with correct email and password but no MFA token THEN the response includes `requiresMfa: true` and a partial authentication state (no tokens issued)
4. GIVEN a user with MFA enabled WHEN they submit a valid TOTP token after initial login THEN full JWT tokens are issued
5. GIVEN an ADMIN or SUPER_ADMIN user WHEN MFA is not enabled THEN the system warns but does not block (mandatory MFA enforcement configurable per role)
6. GIVEN a user account WHEN an administrator resets MFA THEN the mfaSecret is cleared and mfaEnabled is set to false, requiring re-setup

**Key Tasks:**
- [ ] Implement TOTP service (AC: #1, #2)
  - [ ] apps/api/src/core/auth/mfa.service.ts
  - [ ] Generate TOTP secret using otplib/speakeasy
  - [ ] Generate QR code URI (otpauth://totp/...)
  - [ ] Verify TOTP token with time-window tolerance
- [ ] Implement MFA setup route (AC: #1)
  - [ ] POST /auth/mfa/setup — generate and return secret + QR URI
  - [ ] Store secret temporarily until verified
- [ ] Implement MFA verification route (AC: #2)
  - [ ] POST /auth/mfa/verify — verify token, persist mfaEnabled=true
- [ ] Modify login flow for MFA (AC: #3, #4)
  - [ ] If mfaEnabled and no mfaToken: return 200 with requiresMfa=true, mfaChallengeToken
  - [ ] If mfaEnabled and valid mfaToken: issue full JWT tokens
  - [ ] If mfaEnabled and invalid mfaToken: return 401 MFA_INVALID
- [ ] Implement MFA enforcement policy (AC: #5)
  - [ ] Configurable via SystemSetting: roles requiring MFA
  - [ ] Warning for ADMIN+ without MFA (not blocking for MVP)
- [ ] Implement MFA reset (AC: #6)
  - [ ] Admin endpoint to clear mfaSecret, set mfaEnabled=false
  - [ ] Audit log the reset action

**FR/NFR:** FR80 (MFA); NFR10 (MFA TOTP minimum), NFR16 (sensitive operations)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | TOTP (RFC 6238), Google Authenticator/Authy compatible, auth flow steps 2-3 |
| API Contracts | §2.1 Auth & Session | POST /auth/mfa/setup, POST /auth/mfa/verify |
| Data Models | §3.1 System Module | User.mfaEnabled, User.mfaSecret fields |
| State Machines | N/A | N/A — MFA is a configuration flag, not a lifecycle |
| Event Catalog | §16 System Events | `user.login` event (includes loginMethod which can indicate MFA) |
| Business Rules | §14 IMP-008, §14b BR-PLT-018 | MFA support for all users, mandatory for PLATFORM_ADMIN |
| UX Design Spec | N/A | N/A — no UI in this story (API only) |
| Project Context | §2 RBAC | MFA enforcement is role-configurable |

---

## Story E2.S4: Multi-Company Context Middleware

**User Story:** As a user working across multiple companies, I want to switch between companies and have all queries automatically scoped to my selected company, so that I see only the data relevant to my current company context.

**Acceptance Criteria:**
1. GIVEN an authenticated request WHEN the X-Company-ID header is present THEN the middleware sets ctx.companyId to that value and all subsequent queries scope by that companyId
2. GIVEN an authenticated request WHEN no X-Company-ID header is present THEN the middleware uses the user's default company (from User.companyId)
3. GIVEN a user without access to the requested companyId WHEN they set X-Company-ID THEN a 403 FORBIDDEN error is returned
4. GIVEN a request context WHEN any repository method is called THEN it receives companyId from the request context and includes it in every WHERE clause
5. GIVEN the RegisterSharingRule configuration WHEN a shared entity (e.g., Customer) is queried THEN the getVisibleCompanyIds() helper determines the full set of visible company IDs and the query uses `companyId IN [...]`
6. GIVEN the company switching API WHEN POST /system/companies/:id/switch is called THEN the user's session default company is updated

**Key Tasks:**
- [ ] Implement company context middleware (AC: #1, #2)
  - [ ] apps/api/src/core/middleware/company-context.ts
  - [ ] Read X-Company-ID header or fall back to user.companyId
  - [ ] Decorate request with companyId
- [ ] Implement access check (AC: #3)
  - [ ] Verify user has a role (global or company-specific) for the target company
  - [ ] Return 403 if no access
- [ ] Create request context type (AC: #4)
  - [ ] Define RequestContext interface: { userId, tenantId, companyId, role }
  - [ ] All services receive this context
- [ ] Implement sharing-aware query helper (AC: #5)
  - [ ] Utility function: buildCompanyWhereClause(ctx, entityType)
  - [ ] Uses getVisibleCompanyIds() from E1.S3
  - [ ] Returns Prisma where clause with companyId filter
- [ ] Implement company switch endpoint (AC: #6)
  - [ ] POST /system/companies/:id/switch
  - [ ] Update user's default company in database
  - [ ] Return new company context in response

**FR/NFR:** FR172 (company switching), FR174 (query scoping)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles | companyId on every table, query MUST scope by companyId |
| API Contracts | §2.2 System Module | Company profile management endpoints |
| Data Models | §3.1 System Module | CompanyProfile, RegisterSharingRule, UserCompanyRole |
| State Machines | N/A | N/A — company context is not a stateful entity |
| Event Catalog | N/A | N/A — company switching does not emit events (audit only) |
| Business Rules | §14 IMP-001 | Database-per-tenant isolation (company scoping is within-tenant) |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | Query pattern with companyId, getVisibleCompanyIds() for shared entities, RegisterSharingRule modes |

---

## Story E2.S5: RBAC Permission Guards

**User Story:** As an administrator, I want the system to enforce role-based access control on every API route, so that users can only perform actions their role permits, with per-company overrides.

**Acceptance Criteria:**
1. GIVEN a route requiring MANAGER role WHEN a STAFF user calls it THEN a 403 FORBIDDEN error is returned
2. GIVEN a user with ADMIN global role and VIEWER override for Company 3 WHEN they access Company 3 endpoints THEN the VIEWER role applies (per-company override takes precedence)
3. GIVEN a user with no global role and no company-specific role for Company 5 WHEN they access Company 5 endpoints THEN a 403 FORBIDDEN error is returned
4. GIVEN the role hierarchy SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER WHEN a route requires MANAGER THEN MANAGER, ADMIN, and SUPER_ADMIN all pass the check, while STAFF and VIEWER are denied
5. GIVEN a route with module gating WHEN a user's enabledModules does not include the target module THEN a 403 MODULE_NOT_ENABLED error is returned
6. GIVEN the RBAC guard WHEN it resolves the effective role THEN it checks company-specific role first, then global role, per Project Context §2 resolution order

**Key Tasks:**
- [ ] Implement RBAC guard as Fastify hook (AC: #1, #4)
  - [ ] apps/api/src/core/rbac/rbac.guard.ts
  - [ ] Accept minimum role parameter per route
  - [ ] Role hierarchy: SUPER_ADMIN(5) > ADMIN(4) > MANAGER(3) > STAFF(2) > VIEWER(1)
- [ ] Implement role resolution service (AC: #2, #3, #6)
  - [ ] apps/api/src/core/rbac/rbac.service.ts
  - [ ] Query UserCompanyRole for company-specific first
  - [ ] Fall back to global role (companyId IS NULL)
  - [ ] Return null if neither exists (no access)
- [ ] Implement module gating (AC: #5)
  - [ ] Check user.enabledModules against route's module
  - [ ] Return 403 MODULE_NOT_ENABLED if not included
- [ ] Create RBAC types (AC: #1-#6)
  - [ ] apps/api/src/core/rbac/rbac.types.ts
  - [ ] UserRole enum, RoleLevel map, Permission types
- [ ] Write unit tests for role resolution (AC: #2, #3, #6)
  - [ ] Test: company-specific > global > no access
  - [ ] Test: hierarchy enforcement
  - [ ] Test: module gating

**FR/NFR:** FR81 (role assignment), FR175-FR177 (company RBAC); NFR12 (all endpoints authenticated/authorised)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security, §Process Patterns — rbac.guard.ts | JWT claims, role checking, module gating at route level |
| API Contracts | §1 RBAC Roles | SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER with scope descriptions |
| Data Models | §3.1 System Module, §4.1 Enums | UserCompanyRole model, UserRole enum |
| State Machines | N/A | N/A — RBAC is not a state machine |
| Event Catalog | N/A | N/A — role checks do not emit events |
| Business Rules | §14 IMP-007 | RBAC with 5 default roles, all sensitive operations gated |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | Resolution: company-specific -> global -> no access; example: Mohammed ADMIN globally + VIEWER for Company 3 |

---

## Story E2.S6: User & Company Management API

**User Story:** As an administrator, I want CRUD endpoints for users and companies, so that I can manage user accounts, role assignments, and company profiles.

**Acceptance Criteria:**
1. GIVEN ADMIN role WHEN I call POST /system/users with valid user data THEN a new user is created with the specified role and enabled modules, and their password is hashed with Argon2id
2. GIVEN ADMIN role WHEN I call PATCH /system/users/:id/role with a new role THEN the user's global role is updated and an audit log entry is created
3. GIVEN ADMIN role WHEN I call GET /system/users with cursor pagination THEN a list of users is returned with id, email, name, role, enabledModules, isActive, lastLoginAt
4. GIVEN ADMIN role WHEN I call POST /system/company-profile with company data THEN a new company is created with name, legalName, baseCurrencyCode, vatNumber, and a default NumberSeries set is generated
5. GIVEN any authenticated user WHEN I call GET /system/company-profile THEN the current company's profile is returned based on ctx.companyId
6. GIVEN a STAFF user WHEN they attempt to call POST /system/users THEN a 403 error is returned (ADMIN minimum required)

**Key Tasks:**
- [ ] Implement User CRUD routes (AC: #1, #2, #3, #6)
  - [ ] POST /system/users — create user with Argon2id password hash
  - [ ] GET /system/users — list with cursor pagination
  - [ ] GET /system/users/:id — get by ID
  - [ ] PATCH /system/users/:id — update user
  - [ ] PATCH /system/users/:id/role — update role
  - [ ] PATCH /system/users/:id/modules — update enabled modules
  - [ ] All routes guarded with RBAC (ADMIN minimum)
- [ ] Implement User service and repository (AC: #1, #2)
  - [ ] UserService: business logic, validation
  - [ ] UserRepository: Prisma queries with companyId scoping
  - [ ] Password hashing in service layer
- [ ] Implement Company management routes (AC: #4, #5)
  - [ ] GET/POST/PATCH /system/company-profile
  - [ ] POST creates company + default number series
  - [ ] GET returns current company (ctx.companyId)
- [ ] Implement Zod validation schemas (AC: #1, #4)
  - [ ] CreateUserSchema, UpdateUserSchema, CompanyProfileSchema
  - [ ] Export from apps/api/src/modules/system/schemas/
- [ ] Write integration tests (AC: #1-#6)
  - [ ] Test CRUD operations
  - [ ] Test RBAC enforcement (ADMIN can, STAFF cannot)
  - [ ] Test pagination

**FR/NFR:** FR80 (user management), FR83 (company settings), FR84 (company management); NFR2 (CRUD <500ms)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §1 Application Architecture — Module Plugin Structure | system/ module: routes, services, repositories, schemas |
| API Contracts | §2.2 System Module | CRUD for /system/users, /system/company-profile, role/module endpoints |
| Data Models | §3.1 System Module | User, CompanyProfile models with all fields |
| State Machines | N/A | N/A — users and companies use isActive, not state machines |
| Event Catalog | §16 System Events | `settings.updated` for system setting changes |
| Business Rules | §14 IMP-007 | RBAC enforcement on all management operations |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture, §11 Development Rules | companyId on every table, repository pattern, service never calls Prisma directly |

---

## Follow-up: Epic E2b — Granular RBAC & Access Groups

Epic E2b extends this epic's RBAC system with **granular access groups**, replacing the fixed 5-role hierarchy for page-level, action-level, and field-level permissions. Specifically:

- **E2.S5 (RBAC Permission Guards)** established `createRbacGuard()` with the `SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER` hierarchy. E2b replaces this with `createPermissionGuard(resourceCode, action)` which checks the user's **Access Groups** and their `AccessGroupPermission` matrix instead of a single role level.
- **E2.S6 (User & Company Management API)** created user management with `enabledModules` and single-role assignment. E2b removes `enabledModules` (module access is now derived from group permissions) and adds `UserAccessGroup` assignment (many-to-many: users can belong to multiple access groups per company).
- **`SUPER_ADMIN` bypass** is preserved — users with this role skip the permission matrix entirely.
- **`UserRole` enum** is retained but its meaning narrows to admin privilege level (`SUPER_ADMIN` = platform bypass, `ADMIN` = can manage users/groups/settings). The other values (`MANAGER`, `STAFF`, `VIEWER`) no longer drive page/action permissions.

See: `docs/plans/2026-02-19-granular-rbac-access-groups-design.md` and `_bmad-output/planning-artifacts/epics/epic-overview.md` (E2b entry).

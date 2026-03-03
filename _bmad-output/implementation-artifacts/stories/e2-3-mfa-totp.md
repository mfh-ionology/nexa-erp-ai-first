# Story 2.3: MFA (TOTP)

Status: done

## Story

As a user,
I want to enable Time-based One-Time Password (TOTP) multi-factor authentication on my account,
so that my login is protected with a second factor.

## Acceptance Criteria

1. GIVEN an authenticated user WHEN `POST /auth/mfa/setup` is called THEN a TOTP secret is generated and returned as a QR code URI and base32-encoded secret for manual entry
2. GIVEN a user with MFA being set up WHEN they submit a valid TOTP code via `POST /auth/mfa/verify` THEN MFA is permanently enabled on their account (`mfaEnabled=true`, `mfaSecret` persisted)
3. GIVEN a user with MFA enabled WHEN they log in with correct email and password but no `mfaToken` THEN the response includes `requiresMfa: true` and a partial authentication state (no tokens issued)
4. GIVEN a user with MFA enabled WHEN they submit a valid TOTP token via `mfaToken` field in the login request THEN full JWT tokens are issued
5. GIVEN an ADMIN or SUPER_ADMIN user WHEN MFA is not enabled THEN the system warns but does not block (mandatory MFA enforcement configurable per role)
6. GIVEN a user account WHEN an administrator resets MFA via admin endpoint THEN the `mfaSecret` is cleared and `mfaEnabled` is set to false, requiring re-setup

## Tasks / Subtasks

- [x] **Task 1: Install TOTP dependency** (AC: #1, #2)
  - [x] 1.1 `pnpm add otpauth --filter @nexa/api` — ESM-native TOTP library, TypeScript types included
  - [x] 1.2 Verify import works: `import * as OTPAuth from 'otpauth'`

- [x] **Task 2: Create MFA service** (AC: #1, #2, #4)
  - [x] 2.1 `apps/api/src/core/auth/mfa.service.ts`:
    - `generateTotpSecret(issuer: string, label: string)` — Create TOTP instance with new `OTPAuth.Secret({ size: 20 })`, return `{ secret: base32, uri: otpauth://... }`
    - `verifyTotpToken(secret: string, token: string)` — Validate token with `window: 1` for clock drift tolerance. Return boolean.
  - [x] 2.2 Use `OTPAuth.TOTP` constructor with: `issuer: 'Nexa ERP'`, `algorithm: 'SHA1'`, `digits: 6`, `period: 30`
  - [x] 2.3 Write unit tests: `apps/api/src/core/auth/mfa.service.test.ts`
    - Test secret generation returns valid base32 + otpauth URI
    - Test valid token verification succeeds (generate token from same secret, then verify)
    - Test invalid token returns false
    - Test expired token (outside window) returns false

- [x] **Task 3: Create MFA Zod schemas** (AC: #1, #2, #3, #4)
  - [x] 3.1 Add to `apps/api/src/core/auth/auth.schema.ts`:
    - `mfaSetupResponseSchema`: `{ secret: string, uri: string }`
    - `mfaVerifyRequestSchema`: `{ token: z.string().length(6).regex(/^\d{6}$/) }`
    - `mfaVerifyResponseSchema`: `{ message: string }`
  - [x] 3.2 Add `mfaToken` to `loginRequestSchema`: `mfaToken: z.string().length(6).regex(/^\d{6}$/).optional()`
  - [x] 3.3 Export new types: `MfaSetupResponse`, `MfaVerifyRequest`, `MfaVerifyResponse`

- [x] **Task 4: Implement MFA setup route** (AC: #1)
  - [x] 4.1 Add to `apps/api/src/core/auth/auth.routes.ts`:
    - `POST /auth/mfa/setup` (requires authentication — NOT in PUBLIC_ROUTES)
    - Read `request.userId` from JWT (decorated by jwt-verify hook)
    - Load user from DB, verify user exists and is active
    - If `user.mfaEnabled === true`, return 409 `MFA_ALREADY_ENABLED`
    - Call `generateTotpSecret('Nexa ERP', user.email)`
    - Store secret temporarily on user record: `prisma.user.update({ mfaSecret: secret, mfaEnabled: false })`
    - Return `{ secret, uri }` via `sendSuccess(reply, mfaSetupResponse)`

- [x] **Task 5: Implement MFA verify route** (AC: #2)
  - [x] 5.1 Add to `apps/api/src/core/auth/auth.routes.ts`:
    - `POST /auth/mfa/verify` (requires authentication)
    - Read `request.userId` from JWT
    - Load user, verify `user.mfaSecret` exists (setup was called)
    - Validate TOTP token using `verifyTotpToken(user.mfaSecret, token)`
    - If invalid, return 401 `MFA_INVALID`
    - If valid, set `prisma.user.update({ mfaEnabled: true })` (keep mfaSecret)
    - Return `{ message: 'MFA enabled successfully' }`

- [x] **Task 6: Modify login flow for MFA** (AC: #3, #4)
  - [x] 6.1 Update login route in `auth.routes.ts`:
    - CURRENT (line ~96): `if (user.mfaEnabled) { return sendSuccess(reply, { requiresMfa: true }); }`
    - NEW: If `user.mfaEnabled && !mfaToken` → return `sendSuccess(reply, { requiresMfa: true })` (unchanged behaviour)
    - NEW: If `user.mfaEnabled && mfaToken` → verify TOTP token via `verifyTotpToken(user.mfaSecret!, mfaToken)`. If invalid → throw `AuthError('MFA_INVALID', 'Invalid MFA token', 401)`. If valid → continue with token issuance (reset rate limiter, resolve role, generate JWT, etc.)
  - [x] 6.2 The `mfaToken` is already extracted from request body via updated `loginRequestSchema`

- [x] **Task 7: Implement MFA admin reset** (AC: #6)
  - [x] 7.1 Add to `auth.routes.ts`:
    - `POST /auth/mfa/reset` (requires authentication + ADMIN role minimum)
    - Accept request body: `{ userId: string }`
    - Verify requesting user has ADMIN or SUPER_ADMIN role (check `request.userRole`)
    - Clear target user's MFA: `prisma.user.update({ mfaEnabled: false, mfaSecret: null })`
    - Return `{ message: 'MFA reset successfully' }`
  - [x] 7.2 Note: Full RBAC guard middleware is E2-5. For now, check `request.userRole` manually (ADMIN or SUPER_ADMIN). The RBAC guard will wrap this in E2-5.

- [x] **Task 8: Update JWT verify hook public routes** (AC: #1, #2, #3)
  - [x] 8.1 In `jwt-verify.hook.ts`: MFA setup and verify endpoints require authentication, so they are NOT added to `PUBLIC_ROUTES`. The MFA reset endpoint also requires auth. No changes needed to `PUBLIC_ROUTES`.

- [x] **Task 9: Write integration tests** (AC: #1-#6)
  - [x] 9.1 `apps/api/src/core/auth/mfa.routes.test.ts` (or add to existing `auth.routes.test.ts`):
    - Test MFA setup returns secret + URI for authenticated user
    - Test MFA setup returns 401 for unauthenticated user
    - Test MFA setup returns 409 if already enabled
    - Test MFA verify with valid token enables MFA
    - Test MFA verify with invalid token returns 401
    - Test MFA verify without prior setup returns error
    - Test login with MFA enabled but no token returns `requiresMfa: true`
    - Test login with MFA enabled + valid token issues JWT tokens
    - Test login with MFA enabled + invalid token returns 401 `MFA_INVALID`
    - Test MFA reset by admin clears MFA
    - Test MFA reset by non-admin returns 403

## Dev Notes

### Architecture Constraints (MUST FOLLOW)

**MFA Flow (Architecture §3 Authentication & Security):**
1. User enables MFA → calls `POST /auth/mfa/setup` → receives QR code URI + base32 secret
2. User scans QR in authenticator app → enters 6-digit code → calls `POST /auth/mfa/verify` → MFA enabled
3. On subsequent login: credentials valid → API returns `requiresMfa: true` (no tokens)
4. User enters TOTP code → API validates → issues full JWT tokens

**Error Codes (Architecture Implementation Patterns):**
- `MFA_REQUIRED` (401) — valid credentials but MFA token needed (already handled in E2-2)
- `MFA_INVALID` (401) — invalid TOTP token
- `MFA_ALREADY_ENABLED` (409) — MFA already set up on this account

**TOTP Standards:** RFC 6238 (TOTP), RFC 4226 (HOTP base). Google Authenticator / Authy compatible. SHA1 algorithm, 6 digits, 30-second period.

### Technology Stack

| Technology | Version | Notes |
|-----------|---------|-------|
| otpauth | Latest | ESM-native TOTP/HOTP library. `import * as OTPAuth from 'otpauth'`. TypeScript types included. |
| Existing: jose | Already installed | JWT operations (from E2-2) |
| Existing: argon2 | Already installed | Password hashing (from E2-2) |
| Existing: @fastify/cookie | Already installed | Cookie handling (from E2-2) |

**CRITICAL: Library Choice — `otpauth` NOT `otplib` or `speakeasy`:**
- `otpauth` is pure ESM, TypeScript-native, actively maintained, RFC 6238 compliant
- `otplib` has CJS/ESM import issues (project uses `"type": "module"`)
- `speakeasy` is unmaintained (last update 2017)

**`otpauth` Usage Pattern:**
```typescript
import * as OTPAuth from 'otpauth';

// Generate secret
const secret = new OTPAuth.Secret({ size: 20 });

// Create TOTP instance
const totp = new OTPAuth.TOTP({
  issuer: 'Nexa ERP',
  label: userEmail,
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: secret,
});

// Get QR URI: otpauth://totp/Nexa%20ERP:user@example.com?issuer=Nexa%20ERP&secret=...
const uri = totp.toString();
const base32Secret = secret.base32;

// Verify token (window: 1 for clock drift tolerance)
const delta = totp.validate({ token: userToken, window: 1 });
const isValid = delta !== null;

// Reconstruct from stored secret for verification
const storedTotp = new OTPAuth.TOTP({
  issuer: 'Nexa ERP',
  label: userEmail,
  secret: OTPAuth.Secret.fromBase32(storedBase32Secret),
});
```

### Existing Code to REUSE (DO NOT RECREATE)

| Utility | Package | Import |
|---------|---------|--------|
| PrismaClient singleton | `@nexa/db` | `import { prisma } from '@nexa/db'` |
| User type | `@nexa/db` | `import type { User } from '@nexa/db'` |
| UserRole enum | `@nexa/db` | `import { UserRole } from '@nexa/db'` |
| AppError base | `../errors/index.js` | `import { AppError } from '../errors/index.js'` |
| AuthError | `../errors/index.js` | `import { AuthError } from '../errors/index.js'` |
| sendSuccess | `../utils/response.js` | `import { sendSuccess } from '../utils/response.js'` |
| Auth service functions | `./auth.service.js` | All JWT/password/refresh token functions |
| Login rate limiter | `./login-rate-limiter.js` | `isLocked`, `recordFailedAttempt`, `resetAttempts` |
| Typed event emitter | `../events/event-emitter.js` | `appEvents` singleton |

**CRITICAL: Do NOT create a separate PrismaClient.** Import `prisma` from `@nexa/db`.
**CRITICAL: Do NOT modify error classes.** Use existing `AuthError` and `AppError`.
**CRITICAL: User model already has `mfaEnabled` and `mfaSecret` fields** (Prisma schema). No migration needed.

### File Structure (EXACT paths)

```
apps/api/src/core/auth/
├── auth.routes.ts                   # UPDATE: add MFA setup/verify/reset routes, modify login MFA flow
├── auth.routes.test.ts              # UPDATE: add MFA integration tests
├── auth.schema.ts                   # UPDATE: add mfaToken to login, add MFA schemas
├── auth.service.ts                  # EXISTING — do NOT modify
├── auth.service.test.ts             # EXISTING — do NOT modify
├── auth.e2e.test.ts                 # EXISTING — do NOT modify
├── jwt-verify.hook.ts               # NO CHANGES — MFA routes require auth
├── jwt-verify.hook.test.ts          # EXISTING — do NOT modify
├── login-rate-limiter.ts            # EXISTING — do NOT modify
├── login-rate-limiter.test.ts       # EXISTING — do NOT modify
├── mfa.service.ts                   # NEW: TOTP secret generation + verification
└── mfa.service.test.ts              # NEW: MFA service unit tests
```

### Naming Conventions (MUST FOLLOW)

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case with suffix | `mfa.service.ts` |
| Test files | Co-located, `.test.ts` | `mfa.service.test.ts` |
| Functions | camelCase | `generateTotpSecret()`, `verifyTotpToken()` |
| Zod schemas | camelCase + `Schema` suffix | `mfaSetupResponseSchema`, `mfaVerifyRequestSchema` |
| Error codes | UPPER_SNAKE_CASE | `MFA_INVALID`, `MFA_ALREADY_ENABLED` |

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not directly used in MFA — MFA is a per-user feature, not per-company. No companyId scoping needed.
- **i18n**: Error messages use English strings directly. Error `code` fields are translation-key-ready (UPPER_SNAKE_CASE).
- **Audit**: MFA enable/disable should be logged. For now, rely on the placeholder `appEvents` emitter. Full audit trail in E3.
- **Attachments/Notes/Tasks**: Not applicable to auth infrastructure.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §3 Authentication & Security; Implementation Patterns (Error Codes); Project Structure (core/auth/mfa.service.ts) | TOTP (RFC 6238), Google Authenticator compatible, auth flow steps 2-3 for MFA; Error code `AUTH_MFA_REQUIRED`; `mfa.service.ts` at `core/auth/` |
| **API Contracts** | §2.1 Auth & Session (endpoint summary); §3.1 Auth Endpoints (login request/response) | `POST /auth/mfa/setup`, `POST /auth/mfa/verify`; `LoginRequest.mfaToken?`; Error codes: `401 MFA_REQUIRED`, `401 MFA_INVALID` |
| **State Machine** | N/A | MFA is a configuration flag, not a lifecycle |
| **Event Catalog** | N/A | No MFA-specific events defined; `user.login` event `loginMethod` can indicate MFA completion |
| **Data Models** | §3.1 System Module | `User.mfaEnabled` (Boolean, default false), `User.mfaSecret` (String?, TOTP secret) — already in Prisma schema |
| **Business Rules** | §14 IMP-008; §14b BR-PLT-018 | IMP-008: MFA support for all users (HARD enforcement); BR-PLT-018: PLATFORM_ADMIN MFA mandatory (platform level, not this story) |
| **Project Context** | §2 RBAC | MFA enforcement is role-configurable; MVP: warning only for ADMIN+ without MFA |
| **UX Design Spec** | N/A | No UI in this story (API only) |

### Project Structure Notes

- `apps/api/package.json` already has `@nexa/db`, `@fastify/cookie`, `jose`, `argon2`. Add `otpauth` alongside.
- `apps/api/src/app.ts` — auth routes already registered under `/auth` prefix. New MFA routes (setup/verify/reset) will be under `/auth/mfa/` automatically.
- The `loginRequestSchema` in `auth.schema.ts` must be updated to include optional `mfaToken` — this is a non-breaking change.
- No Prisma migration needed — `mfaEnabled` and `mfaSecret` columns already exist from E1.

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — §3 Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Error Code Convention]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — core/auth/mfa.service.ts]
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md — §2.1 Auth & Session]
- [Source: _bmad-output/planning-artifacts/api-contracts/3-detailed-endpoint-specifications.md — §3.1 Auth Endpoints]
- [Source: _bmad-output/planning-artifacts/data-models/3-module-by-module-models.md — User.mfaEnabled, User.mfaSecret]
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md — §14 IMP-008, §14b BR-PLT-018]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md — NFR10, NFR16]
- [Source: _bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md — Story E2.S3]
- [Source: packages/db/prisma/schema.prisma — User model lines 448-455]

### Previous Story Intelligence (E2-2)

**E2-2 code patterns established:**
- Auth routes registered as Fastify plugin exported via `authRoutesPlugin` — add MFA routes to same plugin
- Login route at line ~96 already has MFA placeholder: `if (user.mfaEnabled) { return sendSuccess(reply, { requiresMfa: true }); }`
- Modify this conditional to also check for `mfaToken` from request body
- Login uses `prisma` directly (imported from `@nexa/db`), not a repository pattern
- Uses `sendSuccess(reply, data)` for all success responses
- Uses `AuthError('CODE', 'message', statusCode)` for auth failures
- Tests use `fastify.inject()` — no real HTTP server

**E2-2 code review issues relevant to E2-3:**
- ISSUE #5: `MFA check returns a response that violates the loginResponseSchema` — the current `{ requiresMfa: true }` response doesn't match `loginResponseSchema`. This story should ensure the MFA partial response is correctly typed (it's a different shape from the full login response — consider using a separate response type or making fields optional).
- ISSUE #1: JWT payload claims not validated after signature verification — be aware but don't fix in this story.
- ISSUE #8: No `setNotFoundHandler` — 404s still break envelope. Not this story's concern.

**E2-2 existing auth flow to modify:**
1. `POST /auth/login` receives `{ email, password }` (will now also accept `mfaToken`)
2. Rate limiter check → user lookup → password verify → MFA check → JWT issuance
3. The MFA check (step 4) currently blocks all MFA-enabled users — E2-3 adds the TOTP verification path

### Git Intelligence

```
f437b73 docs: update all spec documents for multi-LLM provider abstraction
39b7950 feat(e1): add core data models, auth, number series, and platform DB
8f09c84 fix(e0): apply E0 retrospective fixes
```

**Commit convention:** `feat(e2): <description>` for new features. Conventional commits enforced via Husky + commitlint.

### Security Considerations

- **mfaSecret storage**: Store base32-encoded TOTP secret directly in `User.mfaSecret`. Database-level encryption at rest (NFR8) handles protection. No application-level encryption needed for MVP.
- **TOTP rate limiting**: Failed TOTP attempts during login go through the existing login rate limiter (same `POST /auth/login` endpoint with email). No separate rate limiter needed — 5 failed attempts within 15 minutes locks the account regardless of failure reason (wrong password or wrong TOTP code).
- **MFA setup flow**: Store the secret in DB immediately during `/auth/mfa/setup` with `mfaEnabled=false`. The `/auth/mfa/verify` endpoint then flips `mfaEnabled=true`. If the user abandons setup, the secret is harmless (MFA not enforced until `mfaEnabled=true`).
- **No challengeToken**: The login flow uses a simple pattern — user re-sends `email + password + mfaToken` on the second request. No temporary challenge tokens needed for MVP. This is simpler and the password is already hashed in transit (TLS).

### E1 Retro Intelligence (Previous Epic Learnings)

1. **NEVER use `prisma db push`** — always `prisma migrate dev`. No migration needed for E2-3 since fields already exist.
2. **Protected files from E1** — DO NOT modify:
   - `packages/db/src/client.ts`, `packages/db/src/index.ts`, `packages/db/src/utils/sharing.ts`, `packages/db/src/utils/rbac.ts`, `packages/db/src/services/number-series.service.ts`, `packages/db/package.json`
3. **Node.js v22** required for Prisma 7.

### Test Design Reference

| Test ID | Description | Priority |
|---------|-------------|----------|
| E2.3-MFA-001 | MFA setup returns base32 secret + otpauth URI for authenticated user | P0 |
| E2.3-MFA-002 | MFA verify with valid TOTP code enables MFA on user account | P0 |
| E2.3-MFA-003 | Login with MFA enabled + valid TOTP token issues full JWT tokens | P0 |
| E2.3-MFA-004 | Login with MFA enabled + no token returns `requiresMfa: true` (no tokens) | P0 |
| E2.3-MFA-005 | Login with MFA enabled + invalid TOTP token returns 401 `MFA_INVALID` | P0 |
| E2.3-MFA-006 | MFA setup returns 409 if MFA already enabled | P1 |
| E2.3-MFA-007 | MFA verify with invalid token returns 401 `MFA_INVALID` | P1 |
| E2.3-MFA-008 | Admin can reset user's MFA (clears mfaSecret, sets mfaEnabled=false) | P1 |
| E2.3-MFA-009 | Non-admin MFA reset attempt returns 403 | P1 |
| E2.3-MFA-010 | MFA setup/verify require authentication (return 401 without token) | P2 |

**Testing approach:** Use Fastify `inject()` with JWTs generated via `jose` (same pattern as E2-2 tests). For TOTP verification tests, generate tokens using `otpauth` library within the test to create valid codes from the same secret.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- All 9 tasks completed: TOTP dependency installed, MFA service created, Zod schemas added, MFA setup/verify/reset routes implemented, login flow modified for MFA, JWT verify hook verified, integration tests written
- All 10 acceptance criteria test cases (E2.3-MFA-001 through E2.3-MFA-010) covered
- Used `otpauth` library (ESM-native, RFC 6238 compliant)
- No Prisma migration needed — `mfaEnabled` and `mfaSecret` fields already existed from E1
- Protected files from E0/E1 preserved — no modifications to `@nexa/db` internals

### File List

- `apps/api/src/core/auth/mfa.service.ts` — NEW: TOTP secret generation + verification
- `apps/api/src/core/auth/mfa.service.test.ts` — NEW: MFA service unit tests
- `apps/api/src/core/auth/auth.routes.ts` — UPDATED: MFA setup/verify/reset routes, modified login MFA flow
- `apps/api/src/core/auth/auth.routes.test.ts` — UPDATED: MFA integration tests
- `apps/api/src/core/auth/auth.schema.ts` — UPDATED: mfaToken in login schema, MFA schemas added

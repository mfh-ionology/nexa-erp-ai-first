import type { FastifyInstance } from 'fastify';
import type {} from '@fastify/cookie';
import { prisma, UserRole } from '@nexa/db';
import { tServer } from '@nexa/i18n/server';

import {
  loginRequestSchema,
  loginRouteResponseSchema,
  mfaVerifyRequestSchema,
  mfaResetRequestSchema,
  mfaSetupResponseSchema,
  mfaVerifyResponseSchema,
  mfaResetResponseSchema,
  successEnvelope,
} from './auth.schema.js';
import type {
  LoginRequest,
  LoginResponse,
  MfaChallengeResponse,
  RefreshResponse,
  LogoutResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  MfaResetRequest,
  MfaResetResponse,
} from './auth.schema.js';
import { generateTotpSecret, verifyTotpToken } from './mfa.service.js';
import {
  verifyPassword,
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  createRefreshTokenRecord,
  revokeRefreshToken,
  revokeAllUserTokens,
  findValidRefreshToken,
  resolveUserRole,
  getAccessTokenExpirySeconds,
} from './auth.service.js';
import { isLocked, recordFailedAttempt, resetAttempts } from './login-rate-limiter.js';
import { AppError, AuthError, NotFoundError } from '../errors/index.js';
import { sendSuccess } from '../utils/response.js';
import { createPermissionGuard } from '../rbac/index.js';

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'nexa_refresh_token';
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Pre-computed Argon2id hash of a random string, used to equalise timing when
// the user does not exist (prevents email enumeration via response latency).
let dummyHash: string | undefined;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword('__dummy_timing_equaliser__');
  }
  return dummyHash;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Auth routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /auth/login
  // -------------------------------------------------------------------------
  fastify.post(
    '/login',
    {
      schema: {
        body: loginRequestSchema,
        response: { 200: successEnvelope(loginRouteResponseSchema) },
      },
    },
    async (request, reply) => {
      const { email, password, mfaToken } = request.body as LoginRequest;

      // 1. Check rate limiter
      if (isLocked(email)) {
        throw new AppError(
          'ACCOUNT_LOCKED',
          tServer('errors:ACCOUNT_LOCKED'),
          423,
          undefined,
          'errors:ACCOUNT_LOCKED',
        );
      }

      // 2. Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      // 3. User not found or inactive — run dummy hash to equalise timing
      //    (prevents email enumeration via Argon2id latency difference)
      if (!user || !user.isActive) {
        await verifyPassword(await getDummyHash(), password);
        recordFailedAttempt(email);
        throw new AuthError('INVALID_CREDENTIALS', tServer('errors:AUTH_INVALID_CREDENTIALS'), 401, 'errors:AUTH_INVALID_CREDENTIALS');
      }

      // 4. Verify password
      const passwordValid = await verifyPassword(user.passwordHash, password);
      if (!passwordValid) {
        recordFailedAttempt(email);
        throw new AuthError('INVALID_CREDENTIALS', tServer('errors:AUTH_INVALID_CREDENTIALS'), 401, 'errors:AUTH_INVALID_CREDENTIALS');
      }

      // 5. MFA check
      let mfaVerified = false;
      if (user.mfaEnabled) {
        if (!mfaToken) {
          // No TOTP code provided — prompt the client to supply one
          const mfaChallengeResponse: MfaChallengeResponse = { requiresMfa: true };
          return sendSuccess(reply, mfaChallengeResponse);
        }

        // Guard against data integrity issue: mfaEnabled=true but mfaSecret is null
        if (!user.mfaSecret) {
          throw new AppError(
            'MFA_SETUP_REQUIRED',
            tServer('errors:MFA_SETUP_REQUIRED'),
            400,
            undefined,
            'errors:MFA_SETUP_REQUIRED',
          );
        }

        // Verify the TOTP token
        const mfaValid = verifyTotpToken(user.mfaSecret, mfaToken);
        if (!mfaValid) {
          recordFailedAttempt(email);
          throw new AuthError('MFA_INVALID', tServer('errors:MFA_INVALID'), 401, 'errors:MFA_INVALID');
        }
        mfaVerified = true;
      }

      // 6. Reset rate limiter on success
      resetAttempts(email);

      // 7. Resolve role
      const role = await resolveUserRole(prisma, user.id, user.companyId);
      if (!role) {
        throw new AuthError('FORBIDDEN', tServer('errors:FORBIDDEN'), 403, 'errors:FORBIDDEN');
      }

      // 8. Parse enabledModules (Prisma Json type — validate elements are strings)
      const enabledModules = Array.isArray(user.enabledModules)
        ? (user.enabledModules as unknown[]).filter((m): m is string => typeof m === 'string')
        : [];

      // 9. Generate access token
      const tenantId = process.env.TENANT_ID ?? user.companyId;
      const accessToken = await generateAccessToken({
        sub: user.id,
        tenantId,
        role,
        enabledModules,
      });

      // 10. Generate refresh token, hash, store in DB
      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await createRefreshTokenRecord(
        prisma,
        user.id,
        refreshTokenHash,
        request.ip,
        request.headers['user-agent'],
      );

      // 11. Update lastLoginAt
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // 12. Emit user.login event (EventBus handles error isolation internally)
      request.server.eventBus.emit('user.login', {
        userId: user.id,
        companyId: user.companyId,
        loginMethod: mfaVerified ? 'password+mfa' : 'password',
        ipAddress: request.ip,
      });

      // 13. Set httpOnly cookie
      void reply.setCookie(COOKIE_NAME, refreshToken, getCookieOptions());

      // 14. Return login response (refresh token is cookie-only, NOT in body)
      const loginResponse: LoginResponse = {
        accessToken,
        expiresIn: getAccessTokenExpirySeconds(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role,
          enabledModules,
          locale: user.locale,
          tenantId,
          tenantName: user.company.name,
          mfaEnabled: user.mfaEnabled,
        },
      };

      return sendSuccess(reply, loginResponse);
    },
  );

  // -------------------------------------------------------------------------
  // POST /auth/refresh
  // -------------------------------------------------------------------------
  fastify.post('/refresh', async (request, reply) => {
    // 1. Read refresh token from httpOnly cookie
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      throw new AuthError('UNAUTHORIZED', tServer('errors:UNAUTHORIZED'), 401, 'errors:UNAUTHORIZED');
    }

    // 2. Hash and look up in DB
    const tokenHash = hashRefreshToken(rawToken);
    const existing = await findValidRefreshToken(prisma, tokenHash);

    // 3. Not found, expired, or revoked
    if (!existing) {
      throw new AuthError('UNAUTHORIZED', tServer('errors:UNAUTHORIZED'), 401, 'errors:UNAUTHORIZED');
    }

    // 4. Revoke old refresh token
    await revokeRefreshToken(prisma, tokenHash);

    // 5. Load user for new access token claims
    const user = await prisma.user.findUnique({
      where: { id: existing.userId },
    });
    if (!user || !user.isActive) {
      throw new AuthError('UNAUTHORIZED', tServer('errors:UNAUTHORIZED'), 401, 'errors:UNAUTHORIZED');
    }

    // 6. Resolve role for new token
    const role = await resolveUserRole(prisma, user.id, user.companyId);
    if (!role) {
      throw new AuthError('FORBIDDEN', tServer('errors:FORBIDDEN'), 403, 'errors:FORBIDDEN');
    }

    const enabledModules = Array.isArray(user.enabledModules)
      ? (user.enabledModules as unknown[]).filter((m): m is string => typeof m === 'string')
      : [];
    const tenantId = process.env.TENANT_ID ?? user.companyId;

    // 7. Generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    await createRefreshTokenRecord(
      prisma,
      user.id,
      newRefreshTokenHash,
      request.ip,
      request.headers['user-agent'],
    );

    const accessToken = await generateAccessToken({
      sub: user.id,
      tenantId,
      role,
      enabledModules,
    });

    // 8. Set new httpOnly cookie
    void reply.setCookie(COOKIE_NAME, newRefreshToken, getCookieOptions());

    // 9. Return response
    const refreshResponse: RefreshResponse = {
      accessToken,
      expiresIn: getAccessTokenExpirySeconds(),
    };

    return sendSuccess(reply, refreshResponse);
  });

  // -------------------------------------------------------------------------
  // POST /auth/logout
  // -------------------------------------------------------------------------
  fastify.post('/logout', async (request, reply) => {
    // 1. Read refresh token from httpOnly cookie
    const rawToken = request.cookies[COOKIE_NAME];

    // 2. If present, revoke in DB
    if (rawToken) {
      const tokenHash = hashRefreshToken(rawToken);
      await revokeRefreshToken(prisma, tokenHash);
    }

    // 3. Clear httpOnly cookie
    void reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/auth',
    });

    // 4. Return response
    const logoutResponse: LogoutResponse = { message: tServer('common:loggedOut') };
    return sendSuccess(reply, logoutResponse);
  });

  // -------------------------------------------------------------------------
  // POST /auth/mfa/setup
  // -------------------------------------------------------------------------
  fastify.post(
    '/mfa/setup',
    {
      schema: { response: { 200: successEnvelope(mfaSetupResponseSchema) } },
    },
    async (request, reply) => {
      // 1. Read userId from JWT (decorated by jwt-verify hook)
      const userId = request.userId;

      // 2. Load user from DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new AuthError('UNAUTHORIZED', tServer('errors:UNAUTHORIZED'), 401, 'errors:UNAUTHORIZED');
      }

      // 3. Check if MFA is already enabled
      if (user.mfaEnabled) {
        throw new AppError('MFA_ALREADY_ENABLED', tServer('errors:MFA_ALREADY_ENABLED'), 409, undefined, 'errors:MFA_ALREADY_ENABLED');
      }

      // 4. Generate TOTP secret (overwrites any pending unverified secret)
      const { secret, uri } = generateTotpSecret('Nexa ERP', user.email);

      // 6. Store secret on user record (mfaEnabled stays false until verified)
      await prisma.user.update({
        where: { id: userId },
        data: { mfaSecret: secret, mfaEnabled: false },
      });

      // 7. Emit MFA setup event (EventBus handles error isolation internally)
      request.server.eventBus.emit('user.mfa.setup', { userId, companyId: request.companyId });

      // 8. Return secret and URI
      const mfaSetupResponse: MfaSetupResponse = { secret, uri };
      return sendSuccess(reply, mfaSetupResponse);
    },
  );

  // -------------------------------------------------------------------------
  // POST /auth/mfa/verify
  // -------------------------------------------------------------------------
  fastify.post(
    '/mfa/verify',
    {
      schema: {
        body: mfaVerifyRequestSchema,
        response: { 200: successEnvelope(mfaVerifyResponseSchema) },
      },
    },
    async (request, reply) => {
      // 1. Read userId from JWT (decorated by jwt-verify hook)
      const userId = request.userId;

      // 2. Rate limit MFA verify attempts per user
      const rateLimitKey = `mfa-verify:${userId}`;
      if (isLocked(rateLimitKey)) {
        throw new AppError('ACCOUNT_LOCKED', tServer('errors:ACCOUNT_LOCKED'), 423, undefined, 'errors:ACCOUNT_LOCKED');
      }

      // 3. Load user from DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new AuthError('UNAUTHORIZED', tServer('errors:UNAUTHORIZED'), 401, 'errors:UNAUTHORIZED');
      }

      // 4. Verify MFA setup was initiated (mfaSecret exists)
      if (!user.mfaSecret) {
        throw new AppError(
          'MFA_SETUP_REQUIRED',
          tServer('errors:MFA_SETUP_REQUIRED'),
          400,
          undefined,
          'errors:MFA_SETUP_REQUIRED',
        );
      }

      // 5. Validate TOTP token
      const { token } = request.body as MfaVerifyRequest;
      const isValid = verifyTotpToken(user.mfaSecret, token);
      if (!isValid) {
        recordFailedAttempt(rateLimitKey);
        throw new AuthError('MFA_INVALID', tServer('errors:MFA_INVALID'), 401, 'errors:MFA_INVALID');
      }

      // 6. Reset rate limiter on success
      resetAttempts(rateLimitKey);

      // 7. Enable MFA on the account (keep mfaSecret)
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });

      // 8. Emit MFA enabled event (EventBus handles error isolation internally)
      request.server.eventBus.emit('user.mfa.enabled', { userId, companyId: request.companyId });

      // 9. Return success
      const mfaVerifyResponse: MfaVerifyResponse = { message: tServer('common:mfaEnabled') };
      return sendSuccess(reply, mfaVerifyResponse);
    },
  );

  // -------------------------------------------------------------------------
  // POST /auth/mfa/reset (ADMIN or SUPER_ADMIN only)
  // -------------------------------------------------------------------------
  fastify.post(
    '/mfa/reset',
    {
      schema: {
        body: mfaResetRequestSchema,
        response: { 200: successEnvelope(mfaResetResponseSchema) },
      },
      preHandler: createPermissionGuard('system.users.detail', 'edit'),
    },
    async (request, reply) => {
      // 1. Extract target userId from request body
      const { userId } = request.body as MfaResetRequest;

      // 3. Block self-reset — admins must not disable their own MFA
      if (userId === request.userId) {
        throw new AuthError('FORBIDDEN', tServer('errors:MFA_CANNOT_RESET_SELF'), 403, 'errors:MFA_CANNOT_RESET_SELF');
      }

      // 4. Verify target user exists
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        throw new NotFoundError('USER_NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
      }

      // 5. Tenant scoping — company-scoped ADMINs can only reset users in their own company.
      //    SUPER_ADMIN (cross-company role) can reset any user.
      if (request.userRole !== UserRole.SUPER_ADMIN && targetUser.companyId !== request.tenantId) {
        throw new AuthError('FORBIDDEN', tServer('errors:MFA_CROSS_COMPANY'), 403, 'errors:MFA_CROSS_COMPANY');
      }

      // 6. Clear MFA on target user
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null },
      });

      // 7. Revoke all existing sessions for the target user (force re-authentication)
      await revokeAllUserTokens(prisma, userId);

      // 8. Emit MFA reset event (EventBus handles error isolation internally)
      request.server.eventBus.emit('user.mfa.reset', {
        targetUserId: userId,
        resetByUserId: request.userId,
        companyId: request.companyId,
      });

      // 9. Return success
      const mfaResetResponse: MfaResetResponse = { message: tServer('common:mfaReset') };
      return sendSuccess(reply, mfaResetResponse);
    },
  );
}

export const authRoutesPlugin = authRoutes;

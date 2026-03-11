import type { FastifyInstance } from 'fastify';
import type {} from '@fastify/cookie';

import { getPlatformPrisma } from '../../client.js';
import {
  loginRequestSchema,
  loginResponseSchema,
  mfaChallengeResponseSchema,
  mfaVerifyRequestSchema,
  mfaVerifyResponseSchema,
  successEnvelope,
} from './platform-auth.schema.js';
import type {
  LoginRequest,
  LoginResponse,
  MfaChallengeResponse,
  RefreshResponse,
  LogoutResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
} from './platform-auth.schema.js';
import {
  verifyPassword,
  getDummyHash,
  generatePlatformJwt,
  verifyPlatformJwt,
  verifyTotp,
  generateRefreshToken,
  hashRefreshToken,
  createRefreshTokenRecord,
  revokeRefreshToken,
  revokeAllUserTokens,
  findValidRefreshToken,
  findRevokedRefreshToken,
  getAccessTokenExpirySeconds,
  getRefreshExpirySeconds,
} from './platform-auth.service.js';
import { isLocked, recordFailedAttempt, resetAttempts } from './login-rate-limiter.js';
import { AppError, AuthError } from '../errors/app-error.js';
import { sendSuccess } from '../utils/response.js';

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'nexa_platform_refresh_token';

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict' as const,
    path: '/admin/auth',
    maxAge: getRefreshExpirySeconds(),
  };
}

// ---------------------------------------------------------------------------
// Auth routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function platformAuthRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();

  // -------------------------------------------------------------------------
  // POST /admin/auth/login
  // -------------------------------------------------------------------------
  fastify.post(
    '/login',
    {
      schema: {
        body: loginRequestSchema,
        response: {
          200: successEnvelope(loginResponseSchema),
          202: successEnvelope(mfaChallengeResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { email, password, mfaCode } = request.body as LoginRequest;

      // 1. Check rate limiter
      if (isLocked(email)) {
        throw new AuthError(
          'ACCOUNT_LOCKED',
          'Account temporarily locked due to too many failed login attempts',
          429,
        );
      }

      // 2. Find PlatformUser by email
      const user = await prisma.platformUser.findUnique({
        where: { email },
      });

      // 3. User not found or inactive — run dummy hash to equalise timing
      if (!user || !user.isActive) {
        await verifyPassword(await getDummyHash(), password);
        recordFailedAttempt(email);
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // 4. Verify password
      const passwordValid = await verifyPassword(user.passwordHash, password);
      if (!passwordValid) {
        recordFailedAttempt(email);
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // 5. BR-PLT-018: PLATFORM_ADMIN must have MFA enabled
      if (user.role === 'PLATFORM_ADMIN' && !user.mfaEnabled) {
        throw new AuthError(
          'MFA_REQUIRED',
          'MFA required for PLATFORM_ADMIN accounts. Please set up MFA before logging in.',
          403,
        );
      }

      // 6. MFA check
      if (user.mfaEnabled) {
        if (!mfaCode) {
          // No TOTP code provided — return 202 to prompt the client to supply one.
          // 202 distinguishes MFA challenges from successful 200 logins.
          const mfaChallengeResponse: MfaChallengeResponse = { requiresMfa: true };
          return sendSuccess(reply, mfaChallengeResponse, undefined, 202);
        }

        // Guard against data integrity issue: mfaEnabled=true but mfaSecret is null
        if (!user.mfaSecret) {
          throw new AppError(
            'MFA_SETUP_REQUIRED',
            'MFA configuration is incomplete, please contact an administrator',
            400,
          );
        }

        // Verify the TOTP code
        const mfaValid = verifyTotp(user.mfaSecret, mfaCode);
        if (!mfaValid) {
          recordFailedAttempt(email);
          throw new AuthError('MFA_INVALID', 'Invalid MFA code', 401);
        }
      }

      // 7. Reset rate limiter on success
      resetAttempts(email);

      // 8. Generate access token
      const accessToken = await generatePlatformJwt(user.id, user.role);

      // 9. Generate refresh token, hash, store in DB
      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await createRefreshTokenRecord(
        user.id,
        refreshTokenHash,
        request.ip,
        request.headers['user-agent'],
      );

      // 10. Update lastLoginAt
      await prisma.platformUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // 11. Create PlatformAuditLog entry for login
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: user.id,
          action: 'auth.login',
          targetType: 'platform_user',
          targetId: user.id,
          details: { loginMethod: user.mfaEnabled ? 'password+mfa' : 'password' },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      // 12. Set httpOnly refresh cookie
      void reply.setCookie(COOKIE_NAME, refreshToken, getCookieOptions());

      // 13. Return login response
      const loginResponse: LoginResponse = {
        accessToken,
        expiresIn: getAccessTokenExpirySeconds(),
        platformUser: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      };

      return sendSuccess(reply, loginResponse);
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/auth/mfa/verify — verify TOTP for MFA setup completion
  // Requires JWT authentication — user must be logged in to complete MFA setup
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
      const { mfaCode } = request.body as MfaVerifyRequest;
      const platformUserId = request.platformUserId;

      // 1. Rate limit MFA verify attempts per user
      const rateLimitKey = `mfa-verify:${platformUserId}`;
      if (isLocked(rateLimitKey)) {
        throw new AuthError('ACCOUNT_LOCKED', 'Too many failed MFA verification attempts', 429);
      }

      // 2. Find user by authenticated platformUserId
      const user = await prisma.platformUser.findUnique({ where: { id: platformUserId } });
      if (!user || !user.isActive) {
        throw new AuthError('UNAUTHORIZED', 'User not found or inactive', 401);
      }

      // 3. Check that MFA setup was initiated (mfaSecret exists)
      if (!user.mfaSecret) {
        throw new AppError(
          'MFA_SETUP_REQUIRED',
          'MFA setup must be initiated before verification',
          400,
        );
      }

      // 4. If MFA is already enabled, this is a no-op
      if (user.mfaEnabled) {
        const response: MfaVerifyResponse = { message: 'MFA is already enabled' };
        return sendSuccess(reply, response);
      }

      // 5. Verify the TOTP code
      const isValid = verifyTotp(user.mfaSecret, mfaCode);
      if (!isValid) {
        recordFailedAttempt(rateLimitKey);
        throw new AuthError('MFA_INVALID', 'Invalid MFA code', 401);
      }

      // 6. Reset rate limiter
      resetAttempts(rateLimitKey);

      // 7. Enable MFA
      await prisma.platformUser.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });

      // 8. Audit log
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: user.id,
          action: 'auth.mfa.enabled',
          targetType: 'platform_user',
          targetId: user.id,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      const response: MfaVerifyResponse = { message: 'MFA enabled successfully' };
      return sendSuccess(reply, response);
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/auth/refresh
  // -------------------------------------------------------------------------
  fastify.post('/refresh', async (request, reply) => {
    // 1. Read refresh token from httpOnly cookie
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // 2. Hash and look up in DB
    const tokenHash = hashRefreshToken(rawToken);
    const existing = await findValidRefreshToken(tokenHash);

    // 3. Not found, expired, or revoked
    if (!existing) {
      // Token reuse detection: check if this token was already revoked.
      // If so, an attacker may have stolen and used the token — revoke ALL
      // tokens for the affected user as a protective measure.
      const revoked = await findRevokedRefreshToken(tokenHash);
      if (revoked) {
        await revokeAllUserTokens(revoked.platformUserId);
        request.log.warn(
          { platformUserId: revoked.platformUserId },
          'Refresh token reuse detected — all tokens revoked for user',
        );
      }
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // 4. Revoke old refresh token
    await revokeRefreshToken(tokenHash);

    // 5. Load user for new access token claims
    const user = await prisma.platformUser.findUnique({
      where: { id: existing.platformUserId },
    });
    if (!user || !user.isActive) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // 6. Generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    await createRefreshTokenRecord(
      user.id,
      newRefreshTokenHash,
      request.ip,
      request.headers['user-agent'],
    );

    const accessToken = await generatePlatformJwt(user.id, user.role);

    // 7. Audit log for token refresh (BR-PLT-017)
    try {
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: user.id,
          action: 'auth.refresh',
          targetType: 'platform_user',
          targetId: user.id,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'] ?? null,
        },
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

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
  // POST /admin/auth/logout
  // -------------------------------------------------------------------------
  fastify.post('/logout', async (request, reply) => {
    // 1. Read refresh token from httpOnly cookie
    const rawToken = request.cookies[COOKIE_NAME];

    // 2. If present, revoke in DB
    if (rawToken) {
      const tokenHash = hashRefreshToken(rawToken);
      await revokeRefreshToken(tokenHash);
    }

    // 3. Clear httpOnly cookie
    void reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict' as const,
      path: '/admin/auth',
    });

    // 4. Audit log (BR-PLT-017) — log if we can identify the user
    //    Logout is a public route (JWT hook skips it), so we optionally parse
    //    the Authorization header here to identify the actor.
    let actorId = request.platformUserId;
    if (!actorId) {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const payload = await verifyPlatformJwt(authHeader.slice(7));
          if (typeof payload.sub === 'string' && payload.sub.length > 0) {
            actorId = payload.sub;
          }
        } catch {
          // Token invalid or expired — proceed without actor ID
        }
      }
    }
    if (actorId) {
      try {
        await prisma.platformAuditLog.create({
          data: {
            platformUserId: actorId,
            action: 'auth.logout',
            targetType: 'platform_user',
            targetId: actorId,
            ipAddress: request.ip ?? 'unknown',
            userAgent: request.headers['user-agent'] ?? null,
          },
        });
      } catch {
        // Audit failures must not break operations (BR-PLT-017)
      }
    }

    // 5. Return response
    const logoutResponse: LogoutResponse = { message: 'Logged out' };
    return sendSuccess(reply, logoutResponse);
  });
}

export const platformAuthRoutesPlugin = platformAuthRoutes;

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { AuthError } from '../errors/app-error.js';

/**
 * HMAC-hash a token to produce a fixed-length digest.
 * This normalises variable-length tokens to the same length so that
 * timingSafeEqual does not leak the expected token's length.
 */
function hmacHash(value: string): Buffer {
  const key = process.env.PLATFORM_JWT_SECRET ?? 'nexa-service-token-compare';
  return createHmac('sha256', key).update(value).digest();
}

/**
 * Pre-handler hook that validates internal service tokens on `/platform/*` routes.
 *
 * ERP runtime calls authenticate via `Authorization: Bearer {PLATFORM_SERVICE_TOKEN}`.
 * Uses HMAC + timing-safe comparison to prevent timing attacks (including length leak).
 * Does NOT set `platformUserId` — service tokens are system-level, not user-scoped.
 */
export async function serviceTokenGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const expectedToken = process.env.PLATFORM_SERVICE_TOKEN;
  if (!expectedToken) {
    request.log.error('PLATFORM_SERVICE_TOKEN environment variable is not set');
    throw new AuthError('UNAUTHORIZED', 'Service authentication unavailable', 401);
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('UNAUTHORIZED', 'Service token required', 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Service token required', 401);
  }

  // HMAC both tokens to produce fixed-length digests, then compare timing-safely.
  // This prevents leaking the expected token's length via early return.
  const tokenHash = hmacHash(token);
  const expectedHash = hmacHash(expectedToken);

  if (!timingSafeEqual(tokenHash, expectedHash)) {
    throw new AuthError('UNAUTHORIZED', 'Invalid service token', 401);
  }
}

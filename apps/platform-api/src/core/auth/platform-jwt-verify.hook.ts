import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { verifyPlatformJwt } from './platform-auth.service.js';
import { AuthError } from '../errors/app-error.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    platformUserId: string;
    platformRole: string;
  }
}

// ---------------------------------------------------------------------------
// Public routes that bypass JWT verification
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES = new Set([
  '/admin/auth/login',
  '/admin/auth/refresh',
  '/admin/auth/logout',
  '/admin/monitoring/health',
]);

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  if (PUBLIC_ROUTES.has(path)) return true;
  // /platform/* routes use service-token auth, not JWT
  if (path.startsWith('/platform/')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// JWT verification hook plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const platformJwtVerifyPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // Decorate request with default values (required by Fastify for type-safe decorators)
  fastify.decorateRequest('platformUserId', '');
  fastify.decorateRequest('platformRole', '');

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    if (isPublicRoute(request.url)) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const token = authHeader.slice(7);
    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    try {
      const payload = await verifyPlatformJwt(token);

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('Missing or invalid sub claim');
      }
      if (typeof payload.role !== 'string' || payload.role.length === 0) {
        throw new Error('Missing or invalid role claim');
      }

      request.platformUserId = payload.sub;
      request.platformRole = payload.role;
    } catch {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }
  });
};

export const platformJwtVerifyPlugin = fp(platformJwtVerifyPluginFn, {
  name: 'platform-jwt-verify',
});

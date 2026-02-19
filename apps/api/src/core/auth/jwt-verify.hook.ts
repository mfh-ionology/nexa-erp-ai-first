import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { verifyAccessToken } from './auth.service.js';
import { AuthError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation (Task 6.2)
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    tenantId: string;
    companyId: string;
    userRole: string;
    enabledModules: string[];
  }
}

// ---------------------------------------------------------------------------
// Public routes that bypass JWT verification
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/password/reset-request',
  '/auth/password/reset',
  '/health',
]);

// Prefixes that legitimately serve sub-paths (e.g. /documentation/json)
const PUBLIC_ROUTE_PREFIXES = ['/documentation'];

function isPublicRoute(url: string): boolean {
  // Strip query string for matching
  const path = url.split('?')[0]!;
  if (PUBLIC_ROUTES.has(path)) return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

// ---------------------------------------------------------------------------
// JWT verification hook plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const jwtVerifyPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // Decorate request with default values (required by Fastify for type-safe decorators)
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('tenantId', '');
  fastify.decorateRequest('companyId', '');
  fastify.decorateRequest('userRole', '');
  // Fastify 5 disallows reference-type defaults (shared across requests).
  // Use getter/setter so each request gets its own empty array.
  fastify.decorateRequest('enabledModules', {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
    getter() {
      return (this as unknown as { _enabledModules?: string[] })._enabledModules ?? [];
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
    setter(value: string[]) {
      (this as unknown as { _enabledModules?: string[] })._enabledModules = value;
    },
  });

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Skip JWT verification for public routes
    if (isPublicRoute(request.url)) {
      return;
    }

    // Extract Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Verify JWT and extract claims
    try {
      const payload = await verifyAccessToken(token);

      request.userId = payload.sub!;
      request.tenantId = payload.tenantId;
      request.userRole = payload.role;
      request.enabledModules = payload.enabledModules;
    } catch {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }
  });
};

export const jwtVerifyPlugin = fp(jwtVerifyPluginFn, {
  name: 'jwt-verify',
});

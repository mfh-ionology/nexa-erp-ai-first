import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { verifyAccessToken, verifyImpersonationToken } from './auth.service.js';
import { runWithImpersonation } from './impersonation-context.js';
import { AuthError } from '../errors/index.js';
import type { EffectivePermissions } from '../rbac/permission.types.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation (Task 6.2 + E2b-4 Task 5.11 + E13b.5 Task 6.4)
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    tenantId: string;
    companyId: string;
    userRole: string;
    enabledModules: string[];
    permissions: EffectivePermissions | null;
    /** Set when the request is made via platform admin impersonation (BR-PLT-015) */
    impersonatedBy: { platformUserId: string; sessionId: string } | null;
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
  '/webhooks/platform',
]);

// Prefixes that legitimately serve sub-paths (e.g. /documentation/json)
const PUBLIC_ROUTE_PREFIXES = ['/documentation'];

function isPublicRoute(url: string): boolean {
  // Strip query string for matching
  const path = url.split('?')[0] ?? url;
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
    getter() {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      return (this as unknown as { _enabledModules?: string[] })._enabledModules ?? [];
    },
    setter(value: string[]) {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      (this as unknown as { _enabledModules?: string[] })._enabledModules = value;
    },
  });

  // E2b-4: permissions decorator — set by createPermissionGuard, null by default
  fastify.decorateRequest('permissions', {
    getter() {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      return (
        (this as unknown as { _permissions?: EffectivePermissions | null })._permissions ?? null
      );
    },
    setter(value: EffectivePermissions | null) {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      (this as unknown as { _permissions?: EffectivePermissions | null })._permissions = value;
    },
  });

  // E13b.5: impersonation context decorator (BR-PLT-015 dual audit)
  fastify.decorateRequest('impersonatedBy', {
    getter() {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      return (
        (
          this as unknown as {
            _impersonatedBy?: { platformUserId: string; sessionId: string } | null;
          }
        )._impersonatedBy ?? null
      );
    },
    setter(value: { platformUserId: string; sessionId: string } | null) {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Fastify internal storage property
      (
        this as unknown as {
          _impersonatedBy?: { platformUserId: string; sessionId: string } | null;
        }
      )._impersonatedBy = value;
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

    // Try standard JWT verification first
    try {
      const payload = await verifyAccessToken(token);

      // Validate required JWT claims are present and correctly typed
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('Missing or invalid sub claim');
      }
      if (typeof payload.tenantId !== 'string' || payload.tenantId.length === 0) {
        throw new Error('Missing or invalid tenantId claim');
      }
      if (typeof payload.role !== 'string' || payload.role.length === 0) {
        throw new Error('Missing or invalid role claim');
      }
      if (!Array.isArray(payload.enabledModules)) {
        throw new Error('Missing or invalid enabledModules claim');
      }

      request.userId = payload.sub;
      request.tenantId = payload.tenantId;
      request.userRole = payload.role;
      request.enabledModules = payload.enabledModules;
      return;
    } catch {
      // Standard verification failed — try impersonation token (E13b.5 Task 6.4)
    }

    // Try impersonation JWT (signed with PLATFORM_JWT_SECRET, BR-PLT-015)
    const impersonation = await verifyImpersonationToken(token);
    if (impersonation) {
      // E13b.5 Fix: userId is the platformUserId — the actual actor performing
      // actions. This won't match any tenant User record, but impersonatedBy
      // metadata captures the full identity for audit purposes.
      request.userId = impersonation.sub;
      request.tenantId = impersonation.tenantId;
      request.userRole = 'SUPER_ADMIN'; // Impersonation acts as super-user
      request.enabledModules = ['*']; // Sentinel: all modules accessible

      // E13b.5 Fix: Resolve the default company for this tenant so companyId-scoped
      // queries return data. Without this, every WHERE clause filtering by companyId
      // would match nothing and the impersonating admin would see an empty ERP.
      try {
        const { prisma } = await import('@nexa/db');
        const defaultCompany = await prisma.companyProfile.findFirst({
          where: { isDefault: true },
          select: { id: true },
        });
        request.companyId = defaultCompany?.id ?? '';
      } catch {
        request.companyId = '';
      }

      request.impersonatedBy = {
        platformUserId: impersonation.sub,
        sessionId: impersonation.sessionId,
      };
      return;
    }

    throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
  });

  // E13b.5: Wrap route handlers with AsyncLocalStorage impersonation context
  // so audit service can read impersonation metadata during event handling (BR-PLT-015).
  // onRoute fires at registration time; the wrapper runs at request time.
  fastify.addHook('onRoute', (routeOptions) => {
    const originalHandler = routeOptions.handler;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wrapping generic handler signature
    routeOptions.handler = function wrappedHandler(this: any, request: any, reply: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (request.impersonatedBy) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        return runWithImpersonation(request.impersonatedBy, () =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          originalHandler.call(this, request, reply),
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return originalHandler.call(this, request, reply);
    };
  });
};

export const jwtVerifyPlugin = fp(jwtVerifyPluginFn, {
  name: 'jwt-verify',
});

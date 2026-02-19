import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { prisma, resolveUserRole } from '@nexa/db';
import { AuthError, ValidationError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// UUID v4 format validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Company context middleware plugin
// TODO: PERF — this middleware runs 2–3 DB queries per authenticated request
// (user lookup, companyProfile check, resolveUserRole). Consider caching the
// resolved company+role in a short-lived per-request or session cache once
// traffic patterns are established.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/require-await -- Fastify plugin signature requires async */
const companyContextPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // 3.4 — Skip for public routes: if jwt-verify didn't set userId, this is
    // a public route (or unauthenticated). Nothing to resolve.
    if (!request.userId) {
      return;
    }

    // Verify the user is still active (JWT may outlive user deactivation).
    // This also fetches the default companyId for the no-header fallback path.
    // Database-per-tenant: prisma is already connected to the correct tenant DB,
    // so tenantId scoping is implicit — no tenantId column on User model.
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { companyId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // 3.5 — Read X-Company-ID header (may be string[] if sent multiple times)
    const rawHeader = request.headers['x-company-id'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    let companyId: string;

    if (headerValue) {
      // 3.6 — Validate UUID format
      if (!UUID_RE.test(headerValue)) {
        throw new ValidationError('X-Company-ID header must be a valid UUID');
      }
      companyId = headerValue;
    } else {
      // 3.7 — No header: use user's default company
      if (!user.companyId) {
        throw new AuthError(
          'COMPANY_ACCESS_DENIED',
          'No default company assigned to this user',
          403,
        );
      }

      companyId = user.companyId;
    }

    // 3.11 — Verify target company exists and is active
    // Security: use a uniform 403 for both "not found" and "no access" to
    // prevent company-ID enumeration via 404-vs-403 distinction.
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { isActive: true },
    });

    if (!company || !company.isActive) {
      throw new AuthError('COMPANY_ACCESS_DENIED', 'You do not have access to this company', 403);
    }

    // 3.8 — Verify user has access to the target company
    const role = await resolveUserRole(prisma, request.userId, companyId);

    // 3.9 — If no access, deny
    if (!role) {
      throw new AuthError('COMPANY_ACCESS_DENIED', 'You do not have access to this company', 403);
    }

    // 3.6 / 3.10 — Set request context
    request.companyId = companyId;
    request.userRole = role;
  });
};
/* eslint-enable @typescript-eslint/require-await */

export const companyContextPlugin = fp(companyContextPluginFn, {
  name: 'company-context',
  dependencies: ['jwt-verify'],
});

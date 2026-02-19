import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import { resolvePermissions } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// My Permissions route plugin — returns the caller's resolved permissions
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function myPermissionsRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /my-permissions — any authenticated user
  // -------------------------------------------------------------------------
  fastify.get('/my-permissions', async (request, reply) => {
    // SUPER_ADMIN gets a special response — all permissions granted
    if (request.userRole === UserRole.SUPER_ADMIN) {
      return sendSuccess(reply, {
        role: request.userRole,
        isSuperAdmin: true,
        permissions: {},
        fieldOverrides: {},
        enabledModules: request.enabledModules,
      });
    }

    if (!request.companyId) {
      return sendSuccess(reply, {
        role: request.userRole,
        isSuperAdmin: false,
        permissions: {},
        fieldOverrides: {},
        enabledModules: [],
      });
    }

    const resolved = await resolvePermissions(prisma, request.userId, request.companyId);

    return sendSuccess(reply, {
      role: request.userRole,
      isSuperAdmin: false,
      ...resolved,
    });
  });
}

export const myPermissionsRoutesPlugin = myPermissionsRoutes;

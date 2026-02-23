import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { myPermissionsResponseSchema } from './my-permissions.schema.js';
import { permissionService } from '../../core/rbac/permission.service.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';

// ---------------------------------------------------------------------------
// My-permissions route plugin (AC5, AC11)
// No permission guard — accessible to any authenticated user (like /auth/me)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function myPermissionsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /my-permissions — return resolved permissions for the current user
  fastify.get(
    '/my-permissions',
    {
      schema: {
        response: { 200: successEnvelope(myPermissionsResponseSchema) },
      },
    },
    async (request, reply) => {
      const effective = await permissionService.getEffectivePermissions(
        prisma,
        request.userId,
        request.companyId,
        request.userRole,
      );

      return sendSuccess(reply, effective);
    },
  );
}

export const myPermissionsRoutesPlugin = myPermissionsRoutes;

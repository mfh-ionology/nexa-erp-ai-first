import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import { AuthError } from '../errors/index.js';
import { permissionService, ACTION_FLAG_MAP } from './permission.service.js';
import type { PermissionAction } from './permission.types.js';

// ---------------------------------------------------------------------------
// createPermissionGuard — Fastify preHandler factory for granular RBAC
// ---------------------------------------------------------------------------

/**
 * Factory that returns a Fastify preHandler enforcing granular permission checks.
 *
 * Replaces the flat role-hierarchy guard (`createRbacGuard`) with per-resource,
 * per-action permission checks from the AccessGroup permission matrix.
 *
 * @param resourceCode - The resource code to check (e.g., 'system.users.list')
 * @param action - Optional action flag ('access' | 'new' | 'view' | 'edit' | 'delete')
 */
export function createPermissionGuard(
  resourceCode: string,
  action?: PermissionAction,
): preHandlerHookHandler {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Fastify preHandler accepts async functions
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // SUPER_ADMIN bypass — resolve permissions for module list and downstream hooks (AC2/BR-RBAC-002)
    if (request.userRole === UserRole.SUPER_ADMIN) {
      const effective = await permissionService.getEffectivePermissions(
        prisma,
        request.userId,
        request.companyId,
        request.userRole,
      );
      request.permissions = effective;
      return;
    }

    // Resolve permissions — single call, result is cached
    const effective = await permissionService.getEffectivePermissions(
      prisma,
      request.userId,
      request.companyId,
      request.userRole,
    );

    // Attach resolved permissions to request for downstream use
    request.permissions = effective;

    const resource = effective.permissions[resourceCode];

    // No permission entry for this resource → deny (AC3)
    if (!resource || !resource.canAccess) {
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // canAccess check only (no specific action)
    if (!action || action === 'access') {
      return;
    }

    // Action-level check (AC4)
    const flag = ACTION_FLAG_MAP[action];
    if (flag && !resource[flag]) {
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }
  };
}

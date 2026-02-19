import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { prisma, UserRole } from '@nexa/db';

import { AuthError } from '../errors/index.js';
import { resolvePermissions } from './permission.service.js';

export type PermissionAction = 'new' | 'view' | 'edit' | 'delete';

/**
 * Factory that returns a Fastify preHandler enforcing granular RBAC.
 *
 * Replaces createRbacGuard for per-resource, per-action permission checks.
 * SUPER_ADMIN bypasses all permission checks.
 */
export function createPermissionGuard(
  resourceCode: string,
  action?: PermissionAction,
): preHandlerHookHandler {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Fastify preHandler accepts async functions
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // SUPER_ADMIN bypass
    if (request.userRole === UserRole.SUPER_ADMIN) {
      return;
    }

    // No company context = no permissions to check
    if (!request.companyId) {
      throw new AuthError('FORBIDDEN', 'No company context', 403);
    }

    if (!request.userId) {
      throw new AuthError('FORBIDDEN', 'Not authenticated', 403);
    }

    const resolved = await resolvePermissions(prisma, request.userId, request.companyId);
    const perm = resolved.permissions[resourceCode];

    if (!perm || !perm.canAccess) {
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    if (action) {
      const actionMap: Record<PermissionAction, keyof typeof perm> = {
        new: 'canNew',
        view: 'canView',
        edit: 'canEdit',
        delete: 'canDelete',
      };

      if (!perm[actionMap[action]]) {
        throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
      }
    }
  };
}

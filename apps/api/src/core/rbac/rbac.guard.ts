import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { UserRole } from '@nexa/db';

import { AuthError } from '../errors/index.js';
import { hasMinimumRole, ROLE_LEVEL, type RbacGuardOptions } from './rbac.types.js';

/**
 * Factory that returns a Fastify preHandler enforcing role-based access control.
 *
 * The guard reads `request.userRole` (already resolved by company-context middleware)
 * and compares it against the configured minimum role. No additional DB queries.
 */
export function createRbacGuard(options: RbacGuardOptions): preHandlerHookHandler {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Fastify preHandler accepts async functions
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // 2.4 — No role means company-context middleware was bypassed
    if (!request.userRole) {
      // TODO: E3 — emit rbac.denied event
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // 2.5 — Validate role is a known UserRole before comparing
    if (!(request.userRole in ROLE_LEVEL)) {
      // TODO: E3 — emit rbac.denied event
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // 2.6 — Check role hierarchy
    const userRole = request.userRole as UserRole;
    if (!hasMinimumRole(userRole, options.minimumRole)) {
      // TODO: E3 — emit rbac.denied event
      throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // 2.7 — Module gating (optional) — SUPER_ADMIN bypasses module checks
    if (options.module && userRole !== UserRole.SUPER_ADMIN) {
      const requiredModule = options.module.toUpperCase();
      const userModules = request.enabledModules.map((m) => m.toUpperCase());
      if (!userModules.includes(requiredModule)) {
        // TODO: E3 — emit rbac.denied event
        throw new AuthError('MODULE_NOT_ENABLED', 'You do not have access to this module', 403);
      }
    }
  };
}

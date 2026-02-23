import type { FastifyRequest, FastifyReply } from 'fastify';

import { AuthError } from '../errors/app-error.js';

/**
 * Factory that returns a Fastify preHandler hook to check `request.platformRole`
 * against a list of allowed roles. Returns 403 FORBIDDEN if the role is insufficient.
 *
 * Usage:
 * ```ts
 * fastify.get('/admin/users', {
 *   preHandler: [requirePlatformRole('PLATFORM_ADMIN')],
 * }, handler);
 * ```
 */
export function requirePlatformRole(
  ...roles: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const allowedRoles = new Set(roles);

  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const userRole = request.platformRole;

    if (!userRole || !allowedRoles.has(userRole)) {
      throw new AuthError(
        'FORBIDDEN',
        'Insufficient permissions',
        403,
      );
    }
  };
}

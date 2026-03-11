// ---------------------------------------------------------------------------
// Audit onResponse Hook — Automatic audit logging for state-changing routes
// Source: BR-PLT-017 (every state-changing action logged)
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Route audit config — routes opt-in to automatic audit logging by
 * including this in their route `config`:
 *
 * ```ts
 * { config: { audit: { action: 'tenant.create', targetType: 'tenant' } } }
 * ```
 */
export interface RouteAuditConfig {
  action: string;
  targetType?: string;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    audit?: RouteAuditConfig;
  }
}

// HTTP methods that represent state-changing operations
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const auditOnResponsePluginFn: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only log for state-changing methods
    if (!STATE_CHANGING_METHODS.has(request.method)) {
      return;
    }

    // Only log successful responses (2xx)
    if (reply.statusCode < 200 || reply.statusCode >= 300) {
      return;
    }

    // Only log routes that opted-in with audit config
    const auditConfig = request.routeOptions.config?.audit;
    if (!auditConfig) {
      return;
    }

    // platformUserId may not be set for public/service-token routes
    const platformUserId = request.platformUserId;
    if (!platformUserId) {
      return;
    }

    // Extract targetId from route params (common patterns: :id, :tenantId, :providerId)
    const params = request.params as Record<string, string> | undefined;
    const targetId = params?.id ?? params?.tenantId ?? params?.providerId ?? undefined;

    try {
      await fastify.platformAudit.log({
        platformUserId,
        action: auditConfig.action,
        targetType: auditConfig.targetType,
        targetId,
        ipAddress: request.ip ?? 'unknown',
        userAgent: request.headers['user-agent'],
      });
    } catch {
      // Already handled inside platformAudit.log — this catch is a safety net
      // Audit failures must never break operations (BR-PLT-017)
    }
  });
};

export const auditOnResponsePlugin = fp(auditOnResponsePluginFn, {
  name: 'audit-on-response',
  dependencies: ['platform-audit'],
});

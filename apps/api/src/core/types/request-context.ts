import type { FastifyRequest } from 'fastify';

export interface RequestContext {
  userId: string;
  tenantId: string;
  companyId: string;
  role: string;
  /** @deprecated Module access is now derived from granular RBAC permissions. Kept for backward compatibility. */
  enabledModules: string[];
}

export function extractRequestContext(request: FastifyRequest): RequestContext {
  return {
    userId: request.userId,
    tenantId: request.tenantId,
    companyId: request.companyId,
    role: request.userRole,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- backward compat: enabledModules kept until full RBAC migration
    enabledModules: request.enabledModules,
  };
}

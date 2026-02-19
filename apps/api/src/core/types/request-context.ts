import type { FastifyRequest } from 'fastify';

export interface RequestContext {
  userId: string;
  tenantId: string;
  companyId: string;
  role: string;
  enabledModules: string[];
}

export function extractRequestContext(request: FastifyRequest): RequestContext {
  return {
    userId: request.userId,
    tenantId: request.tenantId,
    companyId: request.companyId,
    role: request.userRole,
    enabledModules: request.enabledModules,
  };
}

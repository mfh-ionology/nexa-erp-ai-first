// ---------------------------------------------------------------------------
// Impersonation Routes — Start, end, list, detail impersonation sessions
// Source: API Contracts §21.3, FR199-FR200, BR-PLT-012, BR-PLT-013, BR-PLT-017
// Story: E13b.5 Task 1.3
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getPlatformPrisma } from '../../client.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import {
  startImpersonation,
  endImpersonation,
  getActiveSession,
  listSessions,
} from '../../services/impersonation.service.js';

import {
  tenantIdParamsSchema,
  sessionIdParamsSchema,
  startImpersonationRequestSchema,
  startImpersonationResponseSchema,
  endImpersonationResponseSchema,
  listSessionsQuerySchema,
  sessionDetailSchema,
  sessionListResponseSchema,
  type TenantIdParams,
  type SessionIdParams,
  type StartImpersonationRequest,
  type ListSessionsQuery,
} from './impersonation.schema.js';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function impersonationRoutesFn(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // POST /admin/tenants/:id/impersonate — Start impersonation session
  // -----------------------------------------------------------------------
  fastify.post<{ Params: TenantIdParams; Body: StartImpersonationRequest }>(
    '/admin/tenants/:id/impersonate',
    {
      schema: {
        params: tenantIdParamsSchema,
        body: startImpersonationRequestSchema,
        response: { 201: successEnvelope(startImpersonationResponseSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN')],
      config: {
        audit: {
          action: 'platform.impersonation_started',
          targetType: 'tenant',
        },
      },
    },
    async (request, reply) => {
      const result = await startImpersonation({
        platformUserId: request.platformUserId,
        tenantId: request.params.id,
        reason: request.body.reason,
        durationMinutes: request.body.durationMinutes,
      });
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // POST /admin/impersonation-sessions/:sessionId/end — End session
  // -----------------------------------------------------------------------
  fastify.post<{ Params: SessionIdParams }>(
    '/admin/impersonation-sessions/:sessionId/end',
    {
      schema: {
        params: sessionIdParamsSchema,
        response: { 200: successEnvelope(endImpersonationResponseSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN')],
      config: {
        audit: {
          action: 'platform.impersonation_ended',
          targetType: 'impersonation_session',
        },
      },
    },
    async (request, reply) => {
      const result = await endImpersonation(request.params.sessionId, request.platformUserId);
      return sendSuccess(reply, result);
    },
  );

  // -----------------------------------------------------------------------
  // GET /admin/impersonation-sessions — List all sessions
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: ListSessionsQuery }>(
    '/admin/impersonation-sessions',
    {
      schema: {
        querystring: listSessionsQuerySchema,
        response: { 200: successEnvelope(sessionListResponseSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
    },
    async (request, reply) => {
      const result = await listSessions(request.query);
      return sendSuccess(reply, result, {
        total: result.total,
        hasMore: result.hasMore,
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /admin/impersonation-sessions/:sessionId — Session detail
  // -----------------------------------------------------------------------
  fastify.get<{ Params: SessionIdParams }>(
    '/admin/impersonation-sessions/:sessionId',
    {
      schema: {
        params: sessionIdParamsSchema,
        response: { 200: successEnvelope(sessionDetailSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
    },
    async (request, reply) => {
      const prisma = getPlatformPrisma();
      const session = await prisma.impersonationSession.findUnique({
        where: { id: request.params.sessionId },
        include: {
          platformUser: { select: { id: true, email: true, displayName: true } },
          tenant: { select: { id: true, code: true, displayName: true } },
        },
      });

      if (!session) {
        throw new NotFoundError('SESSION_NOT_FOUND', 'Impersonation session not found');
      }

      const actionsLog = session.actionsLog;
      const actionsCount = Array.isArray(actionsLog) ? actionsLog.length : 0;

      return sendSuccess(reply, {
        id: session.id,
        platformUser: session.platformUser,
        tenant: session.tenant,
        reason: session.reason,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        expiresAt: session.expiresAt.toISOString(),
        actionsCount,
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /admin/impersonation-sessions/active — Get caller's active session
  // -----------------------------------------------------------------------
  fastify.get(
    '/admin/impersonation-sessions/active',
    {
      schema: {
        response: { 200: successEnvelope(sessionDetailSchema.nullable()) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN')],
    },
    async (request, reply) => {
      const session = await getActiveSession(request.platformUserId);
      return sendSuccess(reply, session);
    },
  );
}

export const impersonationRoutesPlugin = fp(impersonationRoutesFn, {
  name: 'impersonation-routes',
});

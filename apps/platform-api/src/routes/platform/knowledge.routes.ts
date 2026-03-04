import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { getPlatformPrisma } from '../../client.js';
import { serviceTokenGuard } from '../../core/auth/service-token.guard.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import { KnowledgeDistributionService } from '../../services/knowledge-distribution.service.js';
import {
  tenantIdParamsSchema,
  articleIdParamsSchema,
  suggestedKnowledgeQuerySchema,
  knowledgeRespondBodySchema,
  suggestedKnowledgeListResponseSchema,
} from './knowledge.schema.js';

// ---------------------------------------------------------------------------
// Route plugin — Internal ERP-facing knowledge distribution endpoints
// ---------------------------------------------------------------------------

async function knowledgePlatformRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const service = new KnowledgeDistributionService(prisma, fastify.log);

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/knowledge/suggested (AC #3)
  // Returns PUBLISHED platform articles eligible for this tenant
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof tenantIdParamsSchema>;
    Querystring: z.infer<typeof suggestedKnowledgeQuerySchema>;
  }>(
    '/platform/tenants/:tenantId/knowledge/suggested',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParamsSchema,
        querystring: suggestedKnowledgeQuerySchema,
        response: { 200: successEnvelope(suggestedKnowledgeListResponseSchema) },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { cursor, limit } = request.query;

      const result = await service.getSuggestedForTenant(tenantId, { cursor, limit });

      return sendSuccess(reply, result, {
        hasMore: result.hasMore,
        cursor: result.nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /platform/tenants/:tenantId/knowledge/:articleId/respond (AC #3)
  // Records a tenant's acceptance or rejection of a platform knowledge article
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof articleIdParamsSchema>;
    Body: z.infer<typeof knowledgeRespondBodySchema>;
  }>(
    '/platform/tenants/:tenantId/knowledge/:articleId/respond',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: articleIdParamsSchema,
        body: knowledgeRespondBodySchema,
        response: { 204: { type: 'null' as const, description: 'Response recorded' } },
      },
    },
    async (request, reply) => {
      const { tenantId, articleId } = request.params;
      const body = request.body;

      try {
        await service.recordTenantResponse(tenantId, articleId, body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('not found')) {
          throw new NotFoundError('ARTICLE_NOT_FOUND', message);
        }
        throw err;
      }

      return reply.status(204).send();
    },
  );
}

export const knowledgePlatformRoutesPlugin = fp(knowledgePlatformRoutes, {
  name: 'platform-knowledge-routes',
});

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { getPlatformPrisma } from '../../client.js';
import { serviceTokenGuard } from '../../core/auth/service-token.guard.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import {
  KnowledgeDistributionService,
  KnowledgeArticleNotFoundError,
} from '../../services/knowledge-distribution.service.js';
import {
  tenantIdParamsSchema,
  articleIdParamsSchema,
  suggestedKnowledgeQuerySchema,
  knowledgeRespondBodySchema,
  suggestedArticleArraySchema,
  suggestedArticleResponseSchema,
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
        response: { 200: successEnvelope(suggestedArticleArraySchema) },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { cursor, limit } = request.query;

      const result = await service.getSuggestedForTenant(tenantId, { cursor, limit });

      return sendSuccess(reply, result.data, {
        hasMore: result.hasMore,
        cursor: result.nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/knowledge/:articleId (ISSUE #2 fix)
  // Direct lookup of a single platform article for a tenant (avoids O(n) pagination)
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof articleIdParamsSchema>;
  }>(
    '/platform/tenants/:tenantId/knowledge/:articleId',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: articleIdParamsSchema,
        response: { 200: successEnvelope(suggestedArticleResponseSchema) },
      },
    },
    async (request, reply) => {
      const { tenantId, articleId } = request.params;

      const article = await service.getArticleForTenant(tenantId, articleId);

      if (!article) {
        throw new NotFoundError(
          'ARTICLE_NOT_FOUND',
          'Platform knowledge article not found or not eligible for this tenant',
        );
      }

      return sendSuccess(reply, article);
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
        if (err instanceof KnowledgeArticleNotFoundError) {
          throw new NotFoundError('ARTICLE_NOT_FOUND', err.message);
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

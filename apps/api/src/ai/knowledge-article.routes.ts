// ---------------------------------------------------------------------------
// Knowledge Article CRUD REST endpoints (tenant knowledge)
// E5d-1 Task 7.2 — distinct from knowledge.routes.ts (E5b module knowledge)
// Path prefix: /knowledge-articles (registered under /ai in index.ts)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createPermissionGuard, createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { DomainError } from '../core/errors/domain-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { KnowledgeArticleService } from './knowledge-article.service.js';
import { VALID_CATEGORIES } from './knowledge-article.service.js';
import type { SuggestedKnowledgeArticle } from '@nexa/platform-client';
import {
  listArticlesQuerySchema,
  articleIdParamsSchema,
  createArticleBodySchema,
  updateArticleBodySchema,
  articleResponseSchema,
  articleListResponseSchema,
  platformArticleIdParamsSchema,
  acceptEditedBodySchema,
  suggestedListResponseSchema,
} from './knowledge-article.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function knowledgeArticleRoutes(fastify: FastifyInstance): Promise<void> {
  function assertKnowledgeArticleService(
    svc: KnowledgeArticleService | null | undefined,
  ): asserts svc is KnowledgeArticleService {
    if (!svc) {
      throw new AiDegradedError('AI knowledge article service is not available');
    }
  }

  const adminGuard = createRbacGuard({ minimumRole: UserRole.ADMIN });

  // -----------------------------------------------------------------------
  // GET /knowledge-articles — List articles with optional filters (AC: #7)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listArticlesQuerySchema> }>(
    '/knowledge-articles',
    {
      schema: {
        querystring: listArticlesQuerySchema,
        response: { 200: successEnvelope(articleListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const result = await fastify.aiKnowledgeArticleService.listArticles(request.companyId, {
        category: request.query.category,
        source: request.query.source,
        isActive: request.query.isActive,
        cursor: request.query.cursor,
        limit: request.query.limit,
      });

      return sendSuccess(reply, result.data, {
        cursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
        total: result.total,
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /knowledge-articles — Create article + chunk + embed (ADMIN) (AC: #7)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createArticleBodySchema> }>(
    '/knowledge-articles',
    {
      schema: {
        body: createArticleBodySchema,
        response: { 201: successEnvelope(articleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const article = await fastify.aiKnowledgeArticleService.createArticle(
        request.companyId,
        request.userId,
        request.body,
      );

      return sendSuccess(reply, article, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Suggested Knowledge endpoints (E5d-4 Task 6.2, AC: #5)
  // -----------------------------------------------------------------------

  /** Fetch a single platform article by ID via direct lookup (O(1) instead of paginated O(n)). */
  async function fetchPlatformArticle(
    tenantId: string,
    articleId: string,
  ): Promise<SuggestedKnowledgeArticle | null> {
    if (!fastify.platformClient) return null;
    return fastify.platformClient.getPlatformArticle(tenantId, articleId);
  }

  /** Validate that a platform article's category is known before storing in tenant DB. */
  function validatePlatformCategory(category: string): string {
    if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
      throw new DomainError(
        'INVALID_PLATFORM_CATEGORY',
        `Platform article has unrecognised category "${category}". Cannot accept until tenant schema supports it.`,
        undefined,
        'ai.error.invalidPlatformCategory',
      );
    }
    return category;
  }

  // GET /knowledge-articles/suggested — List suggested from platform (ADMIN)
  fastify.get(
    '/knowledge-articles/suggested',
    {
      schema: {
        response: { 200: successEnvelope(suggestedListResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      // 6.3: Graceful degradation — return empty if platformClient not configured
      if (!fastify.platformClient) {
        return sendSuccess(reply, []);
      }

      try {
        // 6.4: Resolve tenantId from JWT request context
        const result = await fastify.platformClient.getSuggestedKnowledge(request.tenantId);
        return sendSuccess(reply, result.data, {
          cursor: result.nextCursor,
          hasMore: result.hasMore,
        });
      } catch (err) {
        fastify.log.warn(
          { err, tenantId: request.tenantId },
          'Failed to fetch suggested knowledge from platform',
        );
        // 6.3: Graceful degradation — return empty on platform error
        return sendSuccess(reply, []);
      }
    },
  );

  // POST /knowledge-articles/suggested/:platformArticleId/accept — Accept and copy (ADMIN)
  fastify.post<{ Params: z.infer<typeof platformArticleIdParamsSchema> }>(
    '/knowledge-articles/suggested/:platformArticleId/accept',
    {
      schema: {
        params: platformArticleIdParamsSchema,
        response: { 201: successEnvelope(articleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      if (!fastify.platformClient) {
        throw new AiDegradedError(
          'Platform client is not configured',
          'ai.error.platformUnavailable',
        );
      }
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const { platformArticleId } = request.params;

      // Fetch the platform article to get its content
      const platformArticle = await fetchPlatformArticle(request.tenantId, platformArticleId);

      if (!platformArticle) {
        throw new NotFoundError(
          'PLATFORM_ARTICLE_NOT_FOUND',
          'Platform knowledge article not found or no longer suggested',
          'ai.error.platformArticleNotFound',
        );
      }

      // Validate category before storing in tenant DB
      const category = validatePlatformCategory(platformArticle.category);

      // Idempotent create: check + insert inside a serializable transaction
      // to prevent duplicate articles from concurrent accept requests
      const { article: tenantArticle, created } =
        await fastify.aiKnowledgeArticleService.createArticleIfNotExists(
          request.companyId,
          request.userId,
          {
            title: platformArticle.title,
            content: platformArticle.content,
            category,
            source: 'PLATFORM_SUGGESTED',
            sourceRef: platformArticleId,
            confidenceScore: 0.9,
            isConfirmed: true,
          },
        );

      // Record acceptance on platform side (best-effort — only on first create)
      if (created) {
        try {
          await fastify.platformClient.respondToKnowledge(request.tenantId, platformArticleId, {
            status: 'ACCEPTED',
            tenantArticleId: tenantArticle.id,
          });
        } catch (err) {
          fastify.log.warn(
            { err, platformArticleId, tenantArticleId: tenantArticle.id },
            'Failed to record acceptance on platform — tenant article saved',
          );
        }
      }

      return sendSuccess(reply, tenantArticle, undefined, 201);
    },
  );

  // POST /knowledge-articles/suggested/:platformArticleId/reject — Reject (ADMIN)
  fastify.post<{ Params: z.infer<typeof platformArticleIdParamsSchema> }>(
    '/knowledge-articles/suggested/:platformArticleId/reject',
    {
      schema: {
        params: platformArticleIdParamsSchema,
        response: { 204: { type: 'null' as const, description: 'Rejection recorded' } },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      if (!fastify.platformClient) {
        throw new AiDegradedError(
          'Platform client is not configured',
          'ai.error.platformUnavailable',
        );
      }

      const { platformArticleId } = request.params;

      try {
        await fastify.platformClient.respondToKnowledge(request.tenantId, platformArticleId, {
          status: 'REJECTED',
        });
      } catch (err) {
        // Translate platform 404 to tenant-facing 404
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 404
        ) {
          throw new NotFoundError(
            'PLATFORM_ARTICLE_NOT_FOUND',
            'Platform knowledge article not found or no longer suggested',
            'ai.error.platformArticleNotFound',
          );
        }
        throw err;
      }

      return reply.status(204).send();
    },
  );

  // POST /knowledge-articles/suggested/:platformArticleId/accept-edited — Accept with edits (ADMIN)
  fastify.post<{
    Params: z.infer<typeof platformArticleIdParamsSchema>;
    Body: z.infer<typeof acceptEditedBodySchema>;
  }>(
    '/knowledge-articles/suggested/:platformArticleId/accept-edited',
    {
      schema: {
        params: platformArticleIdParamsSchema,
        body: acceptEditedBodySchema,
        response: { 201: successEnvelope(articleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      if (!fastify.platformClient) {
        throw new AiDegradedError(
          'Platform client is not configured',
          'ai.error.platformUnavailable',
        );
      }
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const { platformArticleId } = request.params;

      // Fetch the platform article to get its content
      const platformArticle = await fetchPlatformArticle(request.tenantId, platformArticleId);

      if (!platformArticle) {
        throw new NotFoundError(
          'PLATFORM_ARTICLE_NOT_FOUND',
          'Platform knowledge article not found or no longer suggested',
          'ai.error.platformArticleNotFound',
        );
      }

      // Validate category (body override already validated by schema; platform fallback needs check)
      const category = request.body.category ?? validatePlatformCategory(platformArticle.category);

      // Idempotent create with body overrides, inside a serializable transaction
      const { article: tenantArticle, created } =
        await fastify.aiKnowledgeArticleService.createArticleIfNotExists(
          request.companyId,
          request.userId,
          {
            title: request.body.title ?? platformArticle.title,
            content: request.body.content ?? platformArticle.content,
            category,
            source: 'PLATFORM_SUGGESTED',
            sourceRef: platformArticleId,
            confidenceScore: 0.9,
            isConfirmed: true,
          },
        );

      // Record acceptance on platform side (best-effort — only on first create)
      if (created) {
        try {
          await fastify.platformClient.respondToKnowledge(request.tenantId, platformArticleId, {
            status: 'ACCEPTED',
            tenantArticleId: tenantArticle.id,
          });
        } catch (err) {
          fastify.log.warn(
            { err, platformArticleId, tenantArticleId: tenantArticle.id },
            'Failed to record acceptance on platform — tenant article saved',
          );
        }
      }

      return sendSuccess(reply, tenantArticle, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /knowledge-articles/:id — Get single article (AC: #7)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof articleIdParamsSchema> }>(
    '/knowledge-articles/:id',
    {
      schema: {
        params: articleIdParamsSchema,
        response: { 200: successEnvelope(articleResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const article = await fastify.aiKnowledgeArticleService.getArticle(
        request.params.id,
        request.companyId,
      );

      if (!article) {
        throw new NotFoundError(
          'KNOWLEDGE_ARTICLE_NOT_FOUND',
          'Knowledge article not found',
          'ai.error.knowledgeArticleNotFound',
        );
      }

      return sendSuccess(reply, article);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /knowledge-articles/:id — Update article (ADMIN) (AC: #7, #9)
  // Source is immutable — not allowed in update body
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof articleIdParamsSchema>;
    Body: z.infer<typeof updateArticleBodySchema>;
  }>(
    '/knowledge-articles/:id',
    {
      schema: {
        params: articleIdParamsSchema,
        body: updateArticleBodySchema,
        response: { 200: successEnvelope(articleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      // Defense-in-depth: reject 'source' if it somehow bypasses .strict() validation.
      // Normally .strict() on updateArticleBodySchema rejects unknown keys (including source)
      // with a 400 before the handler runs.
      if ('source' in (request.body as Record<string, unknown>)) {
        throw new DomainError(
          'SOURCE_IMMUTABLE',
          'The source field cannot be changed after creation',
          undefined,
          'ai.error.sourceImmutable',
        );
      }

      const article = await fastify.aiKnowledgeArticleService.updateArticle(
        request.params.id,
        request.companyId,
        request.body,
      );

      if (!article) {
        throw new NotFoundError(
          'KNOWLEDGE_ARTICLE_NOT_FOUND',
          'Knowledge article not found',
          'ai.error.knowledgeArticleNotFound',
        );
      }

      return sendSuccess(reply, article);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /knowledge-articles/:id — Soft-delete article (ADMIN) (AC: #7)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof articleIdParamsSchema> }>(
    '/knowledge-articles/:id',
    {
      schema: {
        params: articleIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const deleted = await fastify.aiKnowledgeArticleService.deleteArticle(
        request.params.id,
        request.companyId,
      );

      if (!deleted) {
        throw new NotFoundError(
          'KNOWLEDGE_ARTICLE_NOT_FOUND',
          'Knowledge article not found',
          'ai.error.knowledgeArticleNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const knowledgeArticleRoutesPlugin = knowledgeArticleRoutes;

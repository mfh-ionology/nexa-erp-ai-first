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
import {
  listArticlesQuerySchema,
  articleIdParamsSchema,
  createArticleBodySchema,
  updateArticleBodySchema,
  articleResponseSchema,
  articleListResponseSchema,
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

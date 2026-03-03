// ---------------------------------------------------------------------------
// Module Knowledge CRUD REST endpoints
// E5b-2 Task 11.2, 11.3
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createPermissionGuard, createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { KnowledgeService } from './knowledge.service.js';
import {
  listKnowledgeQuerySchema,
  knowledgeIdParamsSchema,
  createKnowledgeBodySchema,
  updateKnowledgeBodySchema,
  knowledgeResponseSchema,
  knowledgeListResponseSchema,
} from './knowledge.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  function assertKnowledgeService(
    svc: KnowledgeService | null | undefined,
  ): asserts svc is KnowledgeService {
    if (!svc) {
      throw new AiDegradedError('AI knowledge service is not available');
    }
  }

  // -----------------------------------------------------------------------
  // GET /knowledge — List knowledge with optional moduleKey and type filters (AC: #17)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listKnowledgeQuerySchema> }>(
    '/knowledge',
    {
      schema: {
        querystring: listKnowledgeQuerySchema,
        response: { 200: successEnvelope(knowledgeListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertKnowledgeService(fastify.aiKnowledgeService);

      const entries = await fastify.aiKnowledgeService.listKnowledge({
        moduleKey: request.query.moduleKey,
        type: request.query.type,
        isActive: request.query.isActive,
      });

      return sendSuccess(reply, entries);
    },
  );

  // -----------------------------------------------------------------------
  // POST /knowledge — Create knowledge entry (ADMIN only) (AC: #17)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createKnowledgeBodySchema> }>(
    '/knowledge',
    {
      schema: {
        body: createKnowledgeBodySchema,
        response: { 201: successEnvelope(knowledgeResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertKnowledgeService(fastify.aiKnowledgeService);

      const entry = await fastify.aiKnowledgeService.createKnowledge(request.body);

      return sendSuccess(reply, entry, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /knowledge/:id — Get single knowledge entry (AC: #17)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof knowledgeIdParamsSchema> }>(
    '/knowledge/:id',
    {
      schema: {
        params: knowledgeIdParamsSchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertKnowledgeService(fastify.aiKnowledgeService);

      const entry = await fastify.aiKnowledgeService.getKnowledge(request.params.id);

      if (!entry) {
        throw new NotFoundError(
          'KNOWLEDGE_NOT_FOUND',
          'Knowledge entry not found',
          'ai.error.knowledgeNotFound',
        );
      }

      return sendSuccess(reply, entry);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /knowledge/:id — Update knowledge entry (ADMIN only) (AC: #17)
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof knowledgeIdParamsSchema>;
    Body: z.infer<typeof updateKnowledgeBodySchema>;
  }>(
    '/knowledge/:id',
    {
      schema: {
        params: knowledgeIdParamsSchema,
        body: updateKnowledgeBodySchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertKnowledgeService(fastify.aiKnowledgeService);

      const entry = await fastify.aiKnowledgeService.updateKnowledge(
        request.params.id,
        request.body,
      );

      if (!entry) {
        throw new NotFoundError(
          'KNOWLEDGE_NOT_FOUND',
          'Knowledge entry not found',
          'ai.error.knowledgeNotFound',
        );
      }

      return sendSuccess(reply, entry);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /knowledge/:id — Delete knowledge entry (ADMIN only) (AC: #17)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof knowledgeIdParamsSchema> }>(
    '/knowledge/:id',
    {
      schema: {
        params: knowledgeIdParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertKnowledgeService(fastify.aiKnowledgeService);

      const deleted = await fastify.aiKnowledgeService.deleteKnowledge(request.params.id);

      if (!deleted) {
        throw new NotFoundError(
          'KNOWLEDGE_NOT_FOUND',
          'Knowledge entry not found',
          'ai.error.knowledgeNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const knowledgeRoutesPlugin = knowledgeRoutes;

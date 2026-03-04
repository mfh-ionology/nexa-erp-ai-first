// ---------------------------------------------------------------------------
// Training Example CRUD REST endpoints
// E5d-2 Task 4.3 (AC #4)
// Path prefix: /training-examples (registered under /ai in index.ts)
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
import type { TrainingExampleService } from './training-example.service.js';
import {
  listExamplesQuerySchema,
  exampleIdParamsSchema,
  createExampleBodySchema,
  updateExampleBodySchema,
  exampleResponseSchema,
  exampleListResponseSchema,
} from './training-example.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function trainingExampleRoutes(fastify: FastifyInstance): Promise<void> {
  function assertTrainingExampleService(
    svc: TrainingExampleService | null | undefined,
  ): asserts svc is TrainingExampleService {
    if (!svc) {
      throw new AiDegradedError('AI training example service is not available');
    }
  }

  const adminGuard = createRbacGuard({ minimumRole: UserRole.ADMIN });

  // -----------------------------------------------------------------------
  // GET /training-examples — List examples with optional filters (AC: #4)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listExamplesQuerySchema> }>(
    '/training-examples',
    {
      schema: {
        querystring: listExamplesQuerySchema,
        response: { 200: successEnvelope(exampleListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertTrainingExampleService(fastify.aiTrainingExampleService);

      const result = await fastify.aiTrainingExampleService.listExamples(request.companyId, {
        category: request.query.category,
        skillKey: request.query.skillKey,
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
  // POST /training-examples — Create example (ADMIN) (AC: #4)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createExampleBodySchema> }>(
    '/training-examples',
    {
      schema: {
        body: createExampleBodySchema,
        response: { 201: successEnvelope(exampleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertTrainingExampleService(fastify.aiTrainingExampleService);

      const example = await fastify.aiTrainingExampleService.createExample(
        request.companyId,
        request.userId,
        request.body,
      );

      return sendSuccess(reply, example, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /training-examples/:id — Get single example (AC: #4)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof exampleIdParamsSchema> }>(
    '/training-examples/:id',
    {
      schema: {
        params: exampleIdParamsSchema,
        response: { 200: successEnvelope(exampleResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertTrainingExampleService(fastify.aiTrainingExampleService);

      const example = await fastify.aiTrainingExampleService.getExample(
        request.params.id,
        request.companyId,
      );

      if (!example) {
        throw new NotFoundError(
          'TRAINING_EXAMPLE_NOT_FOUND',
          'Training example not found',
          'ai.error.trainingExampleNotFound',
        );
      }

      return sendSuccess(reply, example);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /training-examples/:id — Update example (ADMIN) (AC: #4)
  // Source is immutable — not allowed in update body
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof exampleIdParamsSchema>;
    Body: z.infer<typeof updateExampleBodySchema>;
  }>(
    '/training-examples/:id',
    {
      schema: {
        params: exampleIdParamsSchema,
        body: updateExampleBodySchema,
        response: { 200: successEnvelope(exampleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertTrainingExampleService(fastify.aiTrainingExampleService);

      // Reject if body contains 'source' (immutable field)
      if ('source' in (request.body as Record<string, unknown>)) {
        throw new DomainError(
          'SOURCE_IMMUTABLE',
          'The source field cannot be changed after creation',
          undefined,
          'ai.error.sourceImmutable',
        );
      }

      const { skillKey: rawSkillKey, ...restBody } = request.body;
      const updateInput = {
        ...restBody,
        ...(rawSkillKey !== undefined ? { skillKey: rawSkillKey ?? undefined } : {}),
      };

      const example = await fastify.aiTrainingExampleService.updateExample(
        request.params.id,
        request.companyId,
        updateInput,
      );

      if (!example) {
        throw new NotFoundError(
          'TRAINING_EXAMPLE_NOT_FOUND',
          'Training example not found',
          'ai.error.trainingExampleNotFound',
        );
      }

      return sendSuccess(reply, example);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /training-examples/:id — Soft-delete example (ADMIN) (AC: #4)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof exampleIdParamsSchema> }>(
    '/training-examples/:id',
    {
      schema: {
        params: exampleIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertTrainingExampleService(fastify.aiTrainingExampleService);

      const deleted = await fastify.aiTrainingExampleService.deleteExample(
        request.params.id,
        request.companyId,
      );

      if (!deleted) {
        throw new NotFoundError(
          'TRAINING_EXAMPLE_NOT_FOUND',
          'Training example not found',
          'ai.error.trainingExampleNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const trainingExampleRoutesPlugin = trainingExampleRoutes;

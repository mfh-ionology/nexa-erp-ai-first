// ---------------------------------------------------------------------------
// Entity Trigger CRUD REST endpoints
// E5b-2 Task 11.5, 11.6
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createPermissionGuard, createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { EntityTriggerService } from './entity-triggers.service.js';
import {
  listEntityTriggersQuerySchema,
  entityTriggerIdParamsSchema,
  createEntityTriggerBodySchema,
  updateEntityTriggerBodySchema,
  entityTriggerResponseSchema,
  entityTriggerListResponseSchema,
} from './entity-triggers.schema.js';
import { entitySearchQuerySchema, entitySearchResponseSchema } from './entity-search.schema.js';
import type { EntitySearchService } from './entity-search.service.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function entityTriggersRoutes(fastify: FastifyInstance): Promise<void> {
  function assertEntityTriggerService(
    svc: EntityTriggerService | null | undefined,
  ): asserts svc is EntityTriggerService {
    if (!svc) {
      throw new AiDegradedError('AI entity trigger service is not available');
    }
  }

  function assertEntitySearchService(
    svc: EntitySearchService | null | undefined,
  ): asserts svc is EntitySearchService {
    if (!svc) {
      throw new AiDegradedError('AI entity search service is not available');
    }
  }

  // -----------------------------------------------------------------------
  // GET /entity-triggers — List triggers with optional moduleKey filter (AC: #18)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listEntityTriggersQuerySchema> }>(
    '/entity-triggers',
    {
      schema: {
        querystring: listEntityTriggersQuerySchema,
        response: { 200: successEnvelope(entityTriggerListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertEntityTriggerService(fastify.aiEntityTriggerService);

      const triggers = await fastify.aiEntityTriggerService.listTriggers({
        moduleKey: request.query.moduleKey,
        isActive: request.query.isActive,
      });

      return sendSuccess(reply, triggers);
    },
  );

  // -----------------------------------------------------------------------
  // GET /entity-search — Search entities by type (E5b-7 Task 1.3, AC: #10, #6)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof entitySearchQuerySchema> }>(
    '/entity-search',
    {
      schema: {
        querystring: entitySearchQuerySchema,
        response: { 200: successEnvelope(entitySearchResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertEntitySearchService(fastify.aiEntitySearchService);

      const results = await fastify.aiEntitySearchService.search({
        type: request.query.type,
        q: request.query.q,
        companyId: request.companyId,
        userId: request.userId,
        scopeBy: request.query.scopeBy,
        scopeValue: request.query.scopeValue,
      });

      return sendSuccess(reply, results);
    },
  );

  // -----------------------------------------------------------------------
  // POST /entity-triggers — Create entity trigger (ADMIN only) (AC: #18)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createEntityTriggerBodySchema> }>(
    '/entity-triggers',
    {
      schema: {
        body: createEntityTriggerBodySchema,
        response: { 201: successEnvelope(entityTriggerResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertEntityTriggerService(fastify.aiEntityTriggerService);

      const trigger = await fastify.aiEntityTriggerService.createTrigger(request.body);

      return sendSuccess(reply, trigger, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /entity-triggers/:id — Get single entity trigger (AC: #18)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof entityTriggerIdParamsSchema> }>(
    '/entity-triggers/:id',
    {
      schema: {
        params: entityTriggerIdParamsSchema,
        response: { 200: successEnvelope(entityTriggerResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertEntityTriggerService(fastify.aiEntityTriggerService);

      const trigger = await fastify.aiEntityTriggerService.getTrigger(request.params.id);

      if (!trigger) {
        throw new NotFoundError(
          'ENTITY_TRIGGER_NOT_FOUND',
          'Entity trigger not found',
          'ai.error.entityTriggerNotFound',
        );
      }

      return sendSuccess(reply, trigger);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /entity-triggers/:id — Update entity trigger (ADMIN only) (AC: #18)
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof entityTriggerIdParamsSchema>;
    Body: z.infer<typeof updateEntityTriggerBodySchema>;
  }>(
    '/entity-triggers/:id',
    {
      schema: {
        params: entityTriggerIdParamsSchema,
        body: updateEntityTriggerBodySchema,
        response: { 200: successEnvelope(entityTriggerResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertEntityTriggerService(fastify.aiEntityTriggerService);

      const trigger = await fastify.aiEntityTriggerService.updateTrigger(
        request.params.id,
        request.body,
      );

      if (!trigger) {
        throw new NotFoundError(
          'ENTITY_TRIGGER_NOT_FOUND',
          'Entity trigger not found',
          'ai.error.entityTriggerNotFound',
        );
      }

      return sendSuccess(reply, trigger);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /entity-triggers/:id — Delete entity trigger (ADMIN only) (AC: #18)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof entityTriggerIdParamsSchema> }>(
    '/entity-triggers/:id',
    {
      schema: {
        params: entityTriggerIdParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertEntityTriggerService(fastify.aiEntityTriggerService);

      const deleted = await fastify.aiEntityTriggerService.deleteTrigger(request.params.id);

      if (!deleted) {
        throw new NotFoundError(
          'ENTITY_TRIGGER_NOT_FOUND',
          'Entity trigger not found',
          'ai.error.entityTriggerNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const entityTriggersRoutesPlugin = entityTriggersRoutes;

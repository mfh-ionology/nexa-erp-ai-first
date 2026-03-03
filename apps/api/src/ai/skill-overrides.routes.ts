// ---------------------------------------------------------------------------
// Skill Override CRUD REST endpoints
// E5b-2 Task 12.2
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { SkillOverrideService } from './skill-overrides.service.js';
import {
  skillOverrideParamsSchema,
  upsertOverrideBodySchema,
  skillOverrideResponseSchema,
  skillOverrideListResponseSchema,
} from './skill-overrides.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function skillOverridesRoutes(fastify: FastifyInstance): Promise<void> {
  function assertOverrideService(
    svc: SkillOverrideService | null | undefined,
  ): asserts svc is SkillOverrideService {
    if (!svc) {
      throw new AiDegradedError('AI skill override service is not available');
    }
  }

  // -----------------------------------------------------------------------
  // GET /skill-overrides — List overrides for tenant (ADMIN only) (AC: #7)
  // -----------------------------------------------------------------------
  fastify.get(
    '/skill-overrides',
    {
      schema: {
        response: { 200: successEnvelope(skillOverrideListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertOverrideService(fastify.aiSkillOverrideService);

      const overrides = await fastify.aiSkillOverrideService.listOverrides(request.companyId);

      return sendSuccess(reply, overrides);
    },
  );

  // -----------------------------------------------------------------------
  // PUT /skill-overrides/:skillId — Upsert override for tenant (ADMIN only) (AC: #7)
  // -----------------------------------------------------------------------
  fastify.put<{
    Params: z.infer<typeof skillOverrideParamsSchema>;
    Body: z.infer<typeof upsertOverrideBodySchema>;
  }>(
    '/skill-overrides/:skillId',
    {
      schema: {
        params: skillOverrideParamsSchema,
        body: upsertOverrideBodySchema,
        response: { 200: successEnvelope(skillOverrideResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertOverrideService(fastify.aiSkillOverrideService);

      // upsertOverride throws NotFoundError if skill doesn't exist
      const override = await fastify.aiSkillOverrideService.upsertOverride(
        request.params.skillId,
        request.companyId,
        request.body,
      );

      return sendSuccess(reply, override);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /skill-overrides/:skillId — Delete override (ADMIN only) (AC: #7)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof skillOverrideParamsSchema> }>(
    '/skill-overrides/:skillId',
    {
      schema: {
        params: skillOverrideParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertOverrideService(fastify.aiSkillOverrideService);

      const deleted = await fastify.aiSkillOverrideService.deleteOverride(
        request.params.skillId,
        request.companyId,
      );

      if (!deleted) {
        throw new NotFoundError(
          'SKILL_OVERRIDE_NOT_FOUND',
          'Skill override not found',
          'ai.error.skillOverrideNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const skillOverridesRoutesPlugin = skillOverridesRoutes;

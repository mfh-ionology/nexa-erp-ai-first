// ---------------------------------------------------------------------------
// Skills CRUD REST endpoints
// E5b-2 Task 10.3
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createPermissionGuard, createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { SkillsService } from './skills.service.js';
import {
  listSkillsQuerySchema,
  skillIdParamsSchema,
  createSkillBodySchema,
  updateSkillBodySchema,
  skillResponseSchema,
  skillListResponseSchema,
} from './skills.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function skillsRoutes(fastify: FastifyInstance): Promise<void> {
  // Helper: assert skills service is available
  function assertSkillsService(
    svc: SkillsService | null | undefined,
  ): asserts svc is SkillsService {
    if (!svc) {
      throw new AiDegradedError('AI skills service is not available');
    }
  }

  // -----------------------------------------------------------------------
  // GET /skills — List skills with optional moduleKey filter (AC: #16)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listSkillsQuerySchema> }>(
    '/skills',
    {
      schema: {
        querystring: listSkillsQuerySchema,
        response: { 200: successEnvelope(skillListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertSkillsService(fastify.aiSkillsService);

      const skills = await fastify.aiSkillsService.listSkills(request.companyId, {
        moduleKey: request.query.moduleKey,
      });

      return sendSuccess(reply, skills);
    },
  );

  // -----------------------------------------------------------------------
  // POST /skills — Create skill (ADMIN only) (AC: #16)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createSkillBodySchema> }>(
    '/skills',
    {
      schema: {
        body: createSkillBodySchema,
        response: { 201: successEnvelope(skillResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.SUPER_ADMIN }),
    },
    async (request, reply) => {
      assertSkillsService(fastify.aiSkillsService);

      const skill = await fastify.aiSkillsService.createSkill(request.body);

      return sendSuccess(reply, skill, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /skills/:id — Get single skill (AC: #16)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof skillIdParamsSchema> }>(
    '/skills/:id',
    {
      schema: {
        params: skillIdParamsSchema,
        response: { 200: successEnvelope(skillResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertSkillsService(fastify.aiSkillsService);

      const skill = await fastify.aiSkillsService.getSkill(request.params.id, request.companyId);

      if (!skill) {
        throw new NotFoundError('SKILL_NOT_FOUND', 'Skill not found', 'ai.error.skillNotFound');
      }

      return sendSuccess(reply, skill);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /skills/:id — Update skill (ADMIN only) (AC: #16)
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof skillIdParamsSchema>;
    Body: z.infer<typeof updateSkillBodySchema>;
  }>(
    '/skills/:id',
    {
      schema: {
        params: skillIdParamsSchema,
        body: updateSkillBodySchema,
        response: { 200: successEnvelope(skillResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertSkillsService(fastify.aiSkillsService);

      const skill = await fastify.aiSkillsService.updateSkill(request.params.id, request.body);

      if (!skill) {
        throw new NotFoundError('SKILL_NOT_FOUND', 'Skill not found', 'ai.error.skillNotFound');
      }

      return sendSuccess(reply, skill);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /skills/:id — Delete skill (ADMIN only) (AC: #16)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof skillIdParamsSchema> }>(
    '/skills/:id',
    {
      schema: {
        params: skillIdParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      assertSkillsService(fastify.aiSkillsService);

      const deleted = await fastify.aiSkillsService.deleteSkill(request.params.id);

      if (!deleted) {
        throw new NotFoundError('SKILL_NOT_FOUND', 'Skill not found', 'ai.error.skillNotFound');
      }

      return reply.status(204).send();
    },
  );
}

export const skillsRoutesPlugin = skillsRoutes;

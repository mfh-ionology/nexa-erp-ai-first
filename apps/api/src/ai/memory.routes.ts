// ---------------------------------------------------------------------------
// Memory REST endpoints — CRUD for AI memories + memory settings
// E5b-1 Task 5
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, type PrismaClient } from '@nexa/db';

import { createPermissionGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { DomainError } from '../core/errors/domain-error.js';
import { AiDegradedError } from './ai.errors.js';
import type { MemoryService, MemoryCategory, MemorySource } from './memory.service.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const memoryCategoryEnum = z.enum([
  'PREFERENCE',
  'WORKFLOW',
  'ENTITY_CONTEXT',
  'DECISION',
  'INSTRUCTION',
]);

const memorySourceEnum = z.enum(['EXPLICIT', 'IMPLICIT']);

// -- Request schemas --

const createMemoryBodySchema = z.object({
  content: z.string().min(1).max(10_000),
  category: memoryCategoryEnum,
  source: memorySourceEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listMemoriesQuerySchema = z.object({
  category: memoryCategoryEnum.optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const updateMemoryBodySchema = z.object({
  content: z.string().min(1).max(10_000).optional(),
  category: memoryCategoryEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const memoryIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateSettingsBodySchema = z.object({
  isEnabled: z.boolean().optional(),
  enabledCategories: z.array(memoryCategoryEnum).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  maxMemories: z.number().int().min(10).max(10_000).optional(),
});

// -- Response schemas --

const memoryResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyId: z.string(),
  category: z.string(),
  content: z.string(),
  source: z.string(),
  importance: z.number(),
  lastAccessedAt: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const memoryListResponseSchema = z.array(memoryResponseSchema);

const forgetAllResponseSchema = z.object({
  deletedCount: z.number(),
});

const memorySettingsResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyId: z.string(),
  isEnabled: z.boolean(),
  enabledCategories: z.array(z.string()),
  retentionDays: z.number(),
  maxMemories: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Default settings for lazy upsert (Task 7 — lazy creation pattern)
// ---------------------------------------------------------------------------

const DEFAULT_ENABLED_CATEGORIES = [
  'PREFERENCE',
  'WORKFLOW',
  'ENTITY_CONTEXT',
  'DECISION',
  'INSTRUCTION',
];

// ---------------------------------------------------------------------------
// Lazy upsert helper — ensures AiMemorySettings row exists for user+company
// ---------------------------------------------------------------------------

/**
 * Get or create default memory settings for a user+company pair.
 * This is the lazy upsert pattern from Task 7: settings are created on first
 * memory endpoint access, rather than during user/company creation.
 */
async function getOrCreateSettings(db: PrismaClient, userId: string, companyId: string) {
  return db.aiMemorySettings.upsert({
    where: {
      userId_companyId: { userId, companyId },
    },
    create: {
      userId,
      companyId,
      isEnabled: true,
      enabledCategories: DEFAULT_ENABLED_CATEGORIES,
      retentionDays: 365,
      maxMemories: 500,
    },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Memory routes plugin
// ---------------------------------------------------------------------------

async function memoryRoutes(fastify: FastifyInstance): Promise<void> {
  // Helper: assert memory service is available
  function assertMemoryService(
    svc: MemoryService | null | undefined,
  ): asserts svc is MemoryService {
    if (!svc) {
      throw new AiDegradedError('AI memory service is not available');
    }
  }

  // -----------------------------------------------------------------------
  // POST /memories — Create a memory (AC: #2)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createMemoryBodySchema> }>(
    '/memories',
    {
      schema: {
        body: createMemoryBodySchema,
        response: { 201: successEnvelope(memoryResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertMemoryService(fastify.aiMemoryService);

      // Lazy upsert: ensure settings exist; respect isEnabled + enabledCategories (AC-9)
      const settings = await getOrCreateSettings(prisma, request.userId, request.companyId);
      if (!settings.isEnabled) {
        throw new DomainError(
          'MEMORY_DISABLED',
          'AI memory is disabled for this user',
          undefined,
          'ai.error.memoryDisabled',
        );
      }

      // Reject categories the user has disabled
      if (!settings.enabledCategories.includes(request.body.category)) {
        throw new DomainError(
          'MEMORY_CATEGORY_DISABLED',
          `Memory category "${request.body.category}" is disabled`,
          undefined,
          'ai.error.memoryCategoryDisabled',
        );
      }

      const memory = await fastify.aiMemoryService.createMemory(request.userId, request.companyId, {
        content: request.body.content,
        category: request.body.category as MemoryCategory,
        source: request.body.source as MemorySource | undefined,
        metadata: request.body.metadata,
      });

      return sendSuccess(reply, memory, undefined, 201);
    },
  );

  // -----------------------------------------------------------------------
  // GET /memories — List memories with optional filters (AC: #3)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listMemoriesQuerySchema> }>(
    '/memories',
    {
      schema: {
        querystring: listMemoriesQuerySchema,
        response: { 200: successEnvelope(memoryListResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertMemoryService(fastify.aiMemoryService);

      const result = await fastify.aiMemoryService.listMemories(request.userId, request.companyId, {
        category: request.query.category as MemoryCategory | undefined,
        search: request.query.search,
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
  // Static sub-paths MUST be registered BEFORE parametric /memories/:id
  // to avoid Fastify matching "forget-all" or "settings" as :id param.
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // POST /memories/forget-all — Delete all memories for current company (AC: #6)
  // -----------------------------------------------------------------------
  fastify.post(
    '/memories/forget-all',
    {
      schema: {
        response: { 200: successEnvelope(forgetAllResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertMemoryService(fastify.aiMemoryService);

      const deletedCount = await fastify.aiMemoryService.forgetAll(
        request.userId,
        request.companyId,
      );

      return sendSuccess(reply, { deletedCount });
    },
  );

  // -----------------------------------------------------------------------
  // GET /memories/settings — Get memory settings (AC: #9)
  // -----------------------------------------------------------------------
  fastify.get(
    '/memories/settings',
    {
      schema: {
        response: { 200: successEnvelope(memorySettingsResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const settings = await getOrCreateSettings(prisma, request.userId, request.companyId);
      return sendSuccess(reply, settings);
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /memories/settings — Update memory settings (AC: #9)
  // -----------------------------------------------------------------------
  fastify.patch<{ Body: z.infer<typeof updateSettingsBodySchema> }>(
    '/memories/settings',
    {
      schema: {
        body: updateSettingsBodySchema,
        response: { 200: successEnvelope(memorySettingsResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic update data
      const data: any = {};
      if (request.body.isEnabled !== undefined) data.isEnabled = request.body.isEnabled;
      if (request.body.enabledCategories !== undefined)
        data.enabledCategories = request.body.enabledCategories;
      if (request.body.retentionDays !== undefined) data.retentionDays = request.body.retentionDays;
      if (request.body.maxMemories !== undefined) data.maxMemories = request.body.maxMemories;

      // Ensure defaults exist, then apply the update
      await getOrCreateSettings(prisma, request.userId, request.companyId);
      const settings = await prisma.aiMemorySettings.update({
        where: {
          userId_companyId: {
            userId: request.userId,
            companyId: request.companyId,
          },
        },
        data,
      });

      return sendSuccess(reply, settings);
    },
  );

  // -----------------------------------------------------------------------
  // Parametric routes — AFTER static sub-paths
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // PATCH /memories/:id — Update a memory (AC: #4)
  // -----------------------------------------------------------------------
  fastify.patch<{
    Params: z.infer<typeof memoryIdParamsSchema>;
    Body: z.infer<typeof updateMemoryBodySchema>;
  }>(
    '/memories/:id',
    {
      schema: {
        params: memoryIdParamsSchema,
        body: updateMemoryBodySchema,
        response: { 200: successEnvelope(memoryResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertMemoryService(fastify.aiMemoryService);

      const memory = await fastify.aiMemoryService.updateMemory(
        request.params.id,
        request.userId,
        request.companyId,
        {
          content: request.body.content,
          category: request.body.category as MemoryCategory | undefined,
          metadata: request.body.metadata,
        },
      );

      if (!memory) {
        throw new NotFoundError(
          'MEMORY_NOT_FOUND',
          'Memory not found or you do not have permission to modify it',
          'ai.error.memoryNotFound',
        );
      }

      return sendSuccess(reply, memory);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /memories/:id — Delete a memory (AC: #5)
  // -----------------------------------------------------------------------
  fastify.delete<{ Params: z.infer<typeof memoryIdParamsSchema> }>(
    '/memories/:id',
    {
      schema: {
        params: memoryIdParamsSchema,
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      assertMemoryService(fastify.aiMemoryService);

      const deleted = await fastify.aiMemoryService.deleteMemory(
        request.params.id,
        request.userId,
        request.companyId,
      );

      if (!deleted) {
        throw new NotFoundError(
          'MEMORY_NOT_FOUND',
          'Memory not found or you do not have permission to delete it',
          'ai.error.memoryNotFound',
        );
      }

      return reply.status(204).send();
    },
  );
}

export const memoryRoutesPlugin = memoryRoutes;

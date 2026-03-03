// ---------------------------------------------------------------------------
// Admin API routes for AI Model & Prompt management
// E5c-3 Task 5: AC #1–#7
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import type { AdminModelService } from './admin-model.service.js';
import type { AdminPromptService } from './admin-prompt.service.js';
import type { AdminDashboardService } from './admin-dashboard.service.js';
import {
  modelIdParamsSchema,
  promptIdParamsSchema,
  versionParamsSchema,
  createModelSchema,
  updateModelSchema,
  listModelsQuerySchema,
  createPromptSchema,
  updatePromptSchema,
  listPromptsQuerySchema,
  testPromptSchema,
  dashboardQuerySchema,
  modelListItemSchema,
  modelDetailSchema,
  promptListItemSchema,
  promptDetailSchema,
  promptVersionItemSchema,
  promptVersionDetailSchema,
  testRenderResultSchema,
  dashboardSummarySchema,
  type CreateModelInput,
  type UpdateModelInput,
  type ListModelsQuery,
  type CreatePromptInput,
  type UpdatePromptInput,
  type ListPromptsQuery,
  type TestPromptInput,
  type DashboardQuery,
} from './admin.schemas.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Helper: assert a service is available (503 if AI module is degraded)
  function assertModelService(
    svc: AdminModelService | null | undefined,
  ): asserts svc is AdminModelService {
    if (!svc) {
      throw Object.assign(new Error('AI admin model service is not available'), {
        statusCode: 503,
      });
    }
  }

  function assertPromptService(
    svc: AdminPromptService | null | undefined,
  ): asserts svc is AdminPromptService {
    if (!svc) {
      throw Object.assign(new Error('AI admin prompt service is not available'), {
        statusCode: 503,
      });
    }
  }

  function assertDashboardService(
    svc: AdminDashboardService | null | undefined,
  ): asserts svc is AdminDashboardService {
    if (!svc) {
      throw Object.assign(new Error('AI admin dashboard service is not available'), {
        statusCode: 503,
      });
    }
  }

  const adminGuard = createRbacGuard({ minimumRole: UserRole.ADMIN });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dashboard
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /dashboard — Dashboard summary ─────────────────────────────────
  fastify.get<{ Querystring: DashboardQuery }>(
    '/dashboard',
    {
      schema: {
        querystring: dashboardQuerySchema,
        response: { 200: successEnvelope(dashboardSummarySchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertDashboardService(fastify.aiAdminDashboardService);

      const summary = await fastify.aiAdminDashboardService.getDashboardSummary(
        request.companyId,
        request.query.days,
      );

      return sendSuccess(reply, summary);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Model endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /models — List models ──────────────────────────────────────────
  fastify.get<{ Querystring: ListModelsQuery }>(
    '/models',
    {
      schema: {
        querystring: listModelsQuerySchema,
        response: { 200: successEnvelope(z.array(modelListItemSchema)) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertModelService(fastify.aiAdminModelService);

      const { data, meta } = await fastify.aiAdminModelService.listModels(request.query);

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── POST /models — Create model ───────────────────────────────────────
  fastify.post<{ Body: CreateModelInput }>(
    '/models',
    {
      schema: {
        body: createModelSchema,
        response: { 201: successEnvelope(modelDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertModelService(fastify.aiAdminModelService);

      const result = await fastify.aiAdminModelService.createModel(request.body);

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── GET /models/:id — Get model detail ────────────────────────────────
  fastify.get<{ Params: z.infer<typeof modelIdParamsSchema> }>(
    '/models/:id',
    {
      schema: {
        params: modelIdParamsSchema,
        response: { 200: successEnvelope(modelDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertModelService(fastify.aiAdminModelService);

      const model = await fastify.aiAdminModelService.getModel(request.params.id);

      return sendSuccess(reply, model);
    },
  );

  // ─── PATCH /models/:id — Update model ──────────────────────────────────
  fastify.patch<{
    Params: z.infer<typeof modelIdParamsSchema>;
    Body: UpdateModelInput;
  }>(
    '/models/:id',
    {
      schema: {
        params: modelIdParamsSchema,
        body: updateModelSchema,
        response: { 200: successEnvelope(modelDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertModelService(fastify.aiAdminModelService);

      const model = await fastify.aiAdminModelService.updateModel(request.params.id, request.body);

      return sendSuccess(reply, model);
    },
  );

  // ─── DELETE /models/:id — Delete model ─────────────────────────────────
  fastify.delete<{ Params: z.infer<typeof modelIdParamsSchema> }>(
    '/models/:id',
    {
      schema: {
        params: modelIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertModelService(fastify.aiAdminModelService);

      await fastify.aiAdminModelService.deleteModel(request.params.id);

      return reply.status(204).send();
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Prompt endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /prompts — List prompts ────────────────────────────────────────
  fastify.get<{ Querystring: ListPromptsQuery }>(
    '/prompts',
    {
      schema: {
        querystring: listPromptsQuerySchema,
        response: { 200: successEnvelope(z.array(promptListItemSchema)) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const { data, meta } = await fastify.aiAdminPromptService.listPrompts(request.query);

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── POST /prompts — Create prompt ─────────────────────────────────────
  fastify.post<{ Body: CreatePromptInput }>(
    '/prompts',
    {
      schema: {
        body: createPromptSchema,
        response: { 201: successEnvelope(promptDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const result = await fastify.aiAdminPromptService.createPrompt(request.userId, request.body);

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── GET /prompts/:id — Get prompt detail ──────────────────────────────
  fastify.get<{ Params: z.infer<typeof promptIdParamsSchema> }>(
    '/prompts/:id',
    {
      schema: {
        params: promptIdParamsSchema,
        response: { 200: successEnvelope(promptDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const prompt = await fastify.aiAdminPromptService.getPrompt(request.params.id);

      return sendSuccess(reply, prompt);
    },
  );

  // ─── PATCH /prompts/:id — Update prompt + create version ───────────────
  fastify.patch<{
    Params: z.infer<typeof promptIdParamsSchema>;
    Body: UpdatePromptInput;
  }>(
    '/prompts/:id',
    {
      schema: {
        params: promptIdParamsSchema,
        body: updatePromptSchema,
        response: { 200: successEnvelope(promptDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const prompt = await fastify.aiAdminPromptService.updatePrompt(
        request.params.id,
        request.userId,
        request.body,
      );

      return sendSuccess(reply, prompt);
    },
  );

  // ─── DELETE /prompts/:id — Delete prompt ───────────────────────────────
  fastify.delete<{ Params: z.infer<typeof promptIdParamsSchema> }>(
    '/prompts/:id',
    {
      schema: {
        params: promptIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      await fastify.aiAdminPromptService.deletePrompt(request.params.id);

      return reply.status(204).send();
    },
  );

  // ─── GET /prompts/:id/versions — List versions ─────────────────────────
  fastify.get<{ Params: z.infer<typeof promptIdParamsSchema> }>(
    '/prompts/:id/versions',
    {
      schema: {
        params: promptIdParamsSchema,
        response: { 200: successEnvelope(z.array(promptVersionItemSchema)) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const versions = await fastify.aiAdminPromptService.listVersions(request.params.id);

      return sendSuccess(reply, versions);
    },
  );

  // ─── GET /prompts/:id/versions/:version — Get version detail ──────────
  fastify.get<{ Params: z.infer<typeof versionParamsSchema> }>(
    '/prompts/:id/versions/:version',
    {
      schema: {
        params: versionParamsSchema,
        response: { 200: successEnvelope(promptVersionDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const version = await fastify.aiAdminPromptService.getVersion(
        request.params.id,
        request.params.version,
      );

      return sendSuccess(reply, version);
    },
  );

  // ─── POST /prompts/:id/versions/:version/restore — Restore version ────
  fastify.post<{ Params: z.infer<typeof versionParamsSchema> }>(
    '/prompts/:id/versions/:version/restore',
    {
      schema: {
        params: versionParamsSchema,
        response: { 200: successEnvelope(promptVersionDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const restored = await fastify.aiAdminPromptService.restoreVersion(
        request.params.id,
        request.params.version,
        request.userId,
      );

      return sendSuccess(reply, restored);
    },
  );

  // ─── POST /prompts/:id/test — Test render prompt ──────────────────────
  fastify.post<{
    Params: z.infer<typeof promptIdParamsSchema>;
    Body: TestPromptInput;
  }>(
    '/prompts/:id/test',
    {
      schema: {
        params: promptIdParamsSchema,
        body: testPromptSchema,
        response: { 200: successEnvelope(testRenderResultSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertPromptService(fastify.aiAdminPromptService);

      const result = await fastify.aiAdminPromptService.testRender(
        request.params.id,
        request.body,
        request.companyId,
        request.userId,
      );

      return sendSuccess(reply, result);
    },
  );
}

export const adminRoutesPlugin = adminRoutes;

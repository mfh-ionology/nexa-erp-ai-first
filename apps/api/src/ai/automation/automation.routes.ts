// ---------------------------------------------------------------------------
// Automation CRUD & Run REST endpoints
// E5c-1 Task 10.2: AC #21, #22
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import type { AutomationService } from './automation.service.js';
import {
  automationIdParamsSchema,
  runIdParamsSchema,
  variableIdParamsSchema,
  createAutomationSchema,
  updateAutomationSchema,
  runAutomationSchema,
  createVariableSchema,
  updateVariableSchema,
  testResolveSchema,
  listAutomationsQuerySchema,
  listRunsQuerySchema,
  listVariablesQuerySchema,
  automationDetailSchema,
  automationListResponseSchema,
  runDetailSchema,
  runListResponseSchema,
  retryResponseSchema,
  variableRegistryGroupedResponseSchema,
  variableDetailSchema,
  testResolveResponseSchema,
  type CreateAutomationInput,
  type UpdateAutomationInput,
  type RunAutomationInput,
  type CreateVariableInput,
  type UpdateVariableInput,
  type TestResolveInput,
  type ListAutomationsQuery,
  type ListRunsQuery,
  type ListVariablesQuery,
} from './automation.schemas.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function automationRoutes(fastify: FastifyInstance): Promise<void> {
  // Helper: assert automation service is available
  function assertService(
    svc: AutomationService | null | undefined,
  ): asserts svc is AutomationService {
    if (!svc) {
      throw Object.assign(new Error('Automation service is not available'), { statusCode: 503 });
    }
  }

  const adminGuard = createRbacGuard({ minimumRole: UserRole.ADMIN });

  // ─── POST /automations — Create automation ────────────────────────────
  fastify.post<{ Body: CreateAutomationInput }>(
    '/automations',
    {
      schema: {
        body: createAutomationSchema,
        response: { 201: successEnvelope(automationDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.createAutomation(
        request.companyId,
        request.userId,
        request.body,
      );

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── GET /automations — List automations ──────────────────────────────
  fastify.get<{ Querystring: ListAutomationsQuery }>(
    '/automations',
    {
      schema: {
        querystring: listAutomationsQuerySchema,
        response: { 200: successEnvelope(automationListResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const { data, meta } = await fastify.aiAutomationService.listAutomations(
        request.companyId,
        request.query,
      );

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── GET /automations/runs — List all runs across automations ─────────
  // IMPORTANT: This static route MUST be defined BEFORE the parametric /:id routes
  fastify.get<{ Querystring: ListRunsQuery }>(
    '/automations/runs',
    {
      schema: {
        querystring: listRunsQuerySchema,
        response: { 200: successEnvelope(runListResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const { data, meta } = await fastify.aiAutomationService.listRuns(
        request.companyId,
        undefined,
        request.query,
      );

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── GET /automations/runs/:runId — Single run detail ─────────────────
  fastify.get<{ Params: z.infer<typeof runIdParamsSchema> }>(
    '/automations/runs/:runId',
    {
      schema: {
        params: runIdParamsSchema,
        response: { 200: successEnvelope(runDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const run = await fastify.aiAutomationService.getRun(request.companyId, request.params.runId);

      return sendSuccess(reply, run);
    },
  );

  // ─── POST /automations/runs/:runId/retry — Retry from failed step ─────
  fastify.post<{ Params: z.infer<typeof runIdParamsSchema> }>(
    '/automations/runs/:runId/retry',
    {
      schema: {
        params: runIdParamsSchema,
        response: { 202: successEnvelope(retryResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.retryFromFailedStep(
        request.companyId,
        request.params.runId,
      );

      return sendSuccess(reply, result, undefined, 202);
    },
  );

  // ─── GET /variables — List all available prompt variables (grouped) ────
  fastify.get<{ Querystring: ListVariablesQuery }>(
    '/variables',
    {
      schema: {
        querystring: listVariablesQuerySchema,
        response: { 200: successEnvelope(variableRegistryGroupedResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const variables = await fastify.aiAutomationService.listVariables(
        request.companyId,
        request.query,
      );

      return sendSuccess(reply, variables);
    },
  );

  // ─── POST /variables — Create a prompt variable ─────────────────────
  fastify.post<{ Body: CreateVariableInput }>(
    '/variables',
    {
      schema: {
        body: createVariableSchema,
        response: { 201: successEnvelope(variableDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.createVariable(request.body);

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── PATCH /variables/:id — Update a prompt variable ────────────────
  fastify.patch<{
    Params: z.infer<typeof variableIdParamsSchema>;
    Body: UpdateVariableInput;
  }>(
    '/variables/:id',
    {
      schema: {
        params: variableIdParamsSchema,
        body: updateVariableSchema,
        response: { 200: successEnvelope(variableDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.updateVariable(
        request.params.id,
        request.body,
      );

      return sendSuccess(reply, result);
    },
  );

  // ─── DELETE /variables/:id — Delete a prompt variable ───────────────
  fastify.delete<{ Params: z.infer<typeof variableIdParamsSchema> }>(
    '/variables/:id',
    {
      schema: {
        params: variableIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      await fastify.aiAutomationService.deleteVariable(request.params.id);

      return reply.status(204).send();
    },
  );

  // ─── POST /variables/:id/test — Test resolve a variable ────────────
  fastify.post<{
    Params: z.infer<typeof variableIdParamsSchema>;
    Body: TestResolveInput;
  }>(
    '/variables/:id/test',
    {
      schema: {
        params: variableIdParamsSchema,
        body: testResolveSchema,
        response: { 200: successEnvelope(testResolveResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.testResolveVariable(
        request.params.id,
        request.companyId,
        request.body,
      );

      return sendSuccess(reply, result);
    },
  );

  // ─── Parametric routes — AFTER static paths ───────────────────────────

  // ─── GET /automations/:id — Get automation detail ─────────────────────
  fastify.get<{ Params: z.infer<typeof automationIdParamsSchema> }>(
    '/automations/:id',
    {
      schema: {
        params: automationIdParamsSchema,
        response: { 200: successEnvelope(automationDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const automation = await fastify.aiAutomationService.getAutomation(
        request.companyId,
        request.params.id,
      );

      return sendSuccess(reply, automation);
    },
  );

  // ─── PATCH /automations/:id — Update automation ───────────────────────
  fastify.patch<{
    Params: z.infer<typeof automationIdParamsSchema>;
    Body: UpdateAutomationInput;
  }>(
    '/automations/:id',
    {
      schema: {
        params: automationIdParamsSchema,
        body: updateAutomationSchema,
        response: { 200: successEnvelope(automationDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const automation = await fastify.aiAutomationService.updateAutomation(
        request.companyId,
        request.params.id,
        request.body,
      );

      return sendSuccess(reply, automation);
    },
  );

  // ─── DELETE /automations/:id — Soft-delete automation ─────────────────
  fastify.delete<{ Params: z.infer<typeof automationIdParamsSchema> }>(
    '/automations/:id',
    {
      schema: {
        params: automationIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      await fastify.aiAutomationService.deleteAutomation(request.companyId, request.params.id);

      return reply.status(204).send();
    },
  );

  // ─── POST /automations/:id/run — Manual trigger ("Run Now") ──────────
  fastify.post<{
    Params: z.infer<typeof automationIdParamsSchema>;
    Body: RunAutomationInput;
  }>(
    '/automations/:id/run',
    {
      schema: {
        params: automationIdParamsSchema,
        body: runAutomationSchema,
        response: {
          202: successEnvelope(
            z.object({
              message: z.string(),
              automationId: z.string(),
              runId: z.string(),
            }),
          ),
        },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const result = await fastify.aiAutomationService.runAutomation(
        request.companyId,
        request.params.id,
        request.userId,
        request.body.input,
      );

      return sendSuccess(reply, result, undefined, 202);
    },
  );

  // ─── GET /automations/:id/runs — List runs for specific automation ────
  fastify.get<{
    Params: z.infer<typeof automationIdParamsSchema>;
    Querystring: ListRunsQuery;
  }>(
    '/automations/:id/runs',
    {
      schema: {
        params: automationIdParamsSchema,
        querystring: listRunsQuerySchema,
        response: { 200: successEnvelope(runListResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertService(fastify.aiAutomationService);

      const { data, meta } = await fastify.aiAutomationService.listRuns(
        request.companyId,
        request.params.id,
        request.query,
      );

      return sendSuccess(reply, data, meta);
    },
  );
}

export const automationRoutesPlugin = automationRoutes;

// ---------------------------------------------------------------------------
// Admin API routes for AI Model & Prompt management
// E5c-3 Task 5: AC #1–#7
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@nexa/db';
import { encryptApiKey } from '@nexa/ai-gateway';

import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import type { AdminModelService } from './admin-model.service.js';
import type { AdminPromptService } from './admin-prompt.service.js';
import type { AdminDashboardService } from './admin-dashboard.service.js';
import type { AdminAgentService } from './admin-agent.service.js';
import type { AdminSkillService } from './admin-skill.service.js';
import type { AdminTriggerTestService } from './admin-trigger-test.service.js';
import type { AdminAnalyticsService } from './analytics.service.js';
import type { LearningSignalsService } from '../learning-signals.service.js';
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
  agentIdParamsSchema,
  createAgentSchema,
  updateAgentSchema,
  listAgentsQuerySchema,
  agentListItemSchema,
  agentDetailSchema,
  skillIdParamsSchema,
  skillListItemSchema,
  createSkillSchema,
  updateSkillSchema,
  listSkillsQuerySchema,
  testTriggerSchema,
  skillDetailSchema,
  skillsGroupedResponseSchema,
  testTriggerResultSchema,
  type CreateAgentInput,
  type UpdateAgentInput,
  type ListAgentsQuery,
  type CreateSkillInput,
  type UpdateSkillInput,
  type ListSkillsQuery,
  type TestTriggerInput,
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

  function assertAgentService(
    svc: AdminAgentService | null | undefined,
  ): asserts svc is AdminAgentService {
    if (!svc) {
      throw Object.assign(new Error('AI admin agent service is not available'), {
        statusCode: 503,
      });
    }
  }

  function assertSkillService(
    svc: AdminSkillService | null | undefined,
  ): asserts svc is AdminSkillService {
    if (!svc) {
      throw Object.assign(new Error('AI admin skill service is not available'), {
        statusCode: 503,
      });
    }
  }

  function assertTriggerTestService(
    svc: AdminTriggerTestService | null | undefined,
  ): asserts svc is AdminTriggerTestService {
    if (!svc) {
      throw Object.assign(new Error('AI admin trigger test service is not available'), {
        statusCode: 503,
      });
    }
  }

  function assertAnalyticsService(
    svc: AdminAnalyticsService | null | undefined,
  ): asserts svc is AdminAnalyticsService {
    if (!svc) {
      throw Object.assign(new Error('AI admin analytics service is not available'), {
        statusCode: 503,
      });
    }
  }

  const adminGuard = createPermissionGuard('ai.admin.access', 'edit');

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
  // ═══════════════════════════════════════════════════════════════════════════
  // Agent endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /agents — List agents ────────────────────────────────────────
  fastify.get<{ Querystring: ListAgentsQuery }>(
    '/agents',
    {
      schema: {
        querystring: listAgentsQuerySchema,
        response: { 200: successEnvelope(z.array(agentListItemSchema)) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertAgentService(fastify.aiAdminAgentService);

      const { data, meta } = await fastify.aiAdminAgentService.listAgents(request.query);

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── POST /agents — Create agent ─────────────────────────────────────
  fastify.post<{ Body: CreateAgentInput }>(
    '/agents',
    {
      schema: {
        body: createAgentSchema,
        response: { 201: successEnvelope(agentDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertAgentService(fastify.aiAdminAgentService);

      const result = await fastify.aiAdminAgentService.createAgent(request.body);

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── GET /agents/:id — Get agent detail ──────────────────────────────
  fastify.get<{ Params: z.infer<typeof agentIdParamsSchema> }>(
    '/agents/:id',
    {
      schema: {
        params: agentIdParamsSchema,
        response: { 200: successEnvelope(agentDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertAgentService(fastify.aiAdminAgentService);

      const agent = await fastify.aiAdminAgentService.getAgent(request.params.id);

      return sendSuccess(reply, agent);
    },
  );

  // ─── PATCH /agents/:id — Update agent ────────────────────────────────
  fastify.patch<{
    Params: z.infer<typeof agentIdParamsSchema>;
    Body: UpdateAgentInput;
  }>(
    '/agents/:id',
    {
      schema: {
        params: agentIdParamsSchema,
        body: updateAgentSchema,
        response: { 200: successEnvelope(agentDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertAgentService(fastify.aiAdminAgentService);

      const agent = await fastify.aiAdminAgentService.updateAgent(request.params.id, request.body);

      return sendSuccess(reply, agent);
    },
  );

  // ─── DELETE /agents/:id — Delete agent ───────────────────────────────
  fastify.delete<{ Params: z.infer<typeof agentIdParamsSchema> }>(
    '/agents/:id',
    {
      schema: {
        params: agentIdParamsSchema,
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertAgentService(fastify.aiAdminAgentService);

      await fastify.aiAdminAgentService.deleteAgent(request.params.id);

      return reply.status(204).send();
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Skill endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /skills — List skills (flat or grouped) ──────────────────────
  fastify.get<{ Querystring: ListSkillsQuery }>(
    '/skills',
    {
      schema: {
        querystring: listSkillsQuerySchema,
        response: {
          200: successEnvelope(
            z.union([z.array(skillListItemSchema), skillsGroupedResponseSchema]),
          ),
        },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertSkillService(fastify.aiAdminSkillService);

      if (request.query.grouped) {
        const result = await fastify.aiAdminSkillService.listSkillsGrouped(request.query);
        return sendSuccess(reply, result);
      }

      const { data, meta } = await fastify.aiAdminSkillService.listSkills(request.query);

      return sendSuccess(reply, data, meta);
    },
  );

  // ─── POST /skills — Create skill ─────────────────────────────────────
  fastify.post<{ Body: CreateSkillInput }>(
    '/skills',
    {
      schema: {
        body: createSkillSchema,
        response: { 201: successEnvelope(skillDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertSkillService(fastify.aiAdminSkillService);

      const result = await fastify.aiAdminSkillService.createSkill(request.body);

      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // ─── POST /skills/test-trigger — Test trigger simulation ─────────────
  fastify.post<{ Body: TestTriggerInput }>(
    '/skills/test-trigger',
    {
      schema: {
        body: testTriggerSchema,
        response: { 200: successEnvelope(testTriggerResultSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertTriggerTestService(fastify.aiAdminTriggerTestService);

      const result = await fastify.aiAdminTriggerTestService.testTrigger(request.body.phrase);

      return sendSuccess(reply, result);
    },
  );

  // ─── GET /skills/:id — Get skill detail ──────────────────────────────
  fastify.get<{ Params: z.infer<typeof skillIdParamsSchema> }>(
    '/skills/:id',
    {
      schema: {
        params: skillIdParamsSchema,
        response: { 200: successEnvelope(skillDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertSkillService(fastify.aiAdminSkillService);

      const skill = await fastify.aiAdminSkillService.getSkill(request.params.id);

      return sendSuccess(reply, skill);
    },
  );

  // ─── PATCH /skills/:id — Update skill ────────────────────────────────
  fastify.patch<{
    Params: z.infer<typeof skillIdParamsSchema>;
    Body: UpdateSkillInput;
  }>(
    '/skills/:id',
    {
      schema: {
        params: skillIdParamsSchema,
        body: updateSkillSchema,
        response: { 200: successEnvelope(skillDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertSkillService(fastify.aiAdminSkillService);

      const skill = await fastify.aiAdminSkillService.updateSkill(request.params.id, request.body);

      return sendSuccess(reply, skill);
    },
  );

  // ─── PATCH /skills/:id/deactivate — Soft-delete (deactivate) skill ──
  fastify.patch<{ Params: z.infer<typeof skillIdParamsSchema> }>(
    '/skills/:id/deactivate',
    {
      schema: {
        params: skillIdParamsSchema,
        response: { 200: successEnvelope(skillDetailSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertSkillService(fastify.aiAdminSkillService);

      const skill = await fastify.aiAdminSkillService.deleteSkill(request.params.id);

      return sendSuccess(reply, skill);
    },
  );

  // -----------------------------------------------------------------------
  // POST /learning-signals/aggregate — Manually trigger aggregation (E5d-2 AC #6)
  // Aggregates the previous day's data for all companies.
  // -----------------------------------------------------------------------
  function assertLearningSignalsService(
    svc: LearningSignalsService | null | undefined,
  ): asserts svc is LearningSignalsService {
    if (!svc) {
      throw Object.assign(new Error('AI learning signals service is not available'), {
        statusCode: 503,
      });
    }
  }

  const aggregateResultSchema = z.object({
    processedCompanies: z.number(),
    signalsCreated: z.number(),
  });

  fastify.post(
    '/learning-signals/aggregate',
    {
      schema: {
        response: { 200: successEnvelope(aggregateResultSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertLearningSignalsService(fastify.aiLearningSignalsService);

      // ISSUE #9 FIX: Scope aggregation to the requester's company only.
      // Previously aggregated ALL companies, allowing a company-level ADMIN
      // to trigger processing for sister companies in the same tenant.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const signalsCreated = await fastify.aiLearningSignalsService.aggregateForCompany(
        request.companyId,
        yesterday,
      );

      return sendSuccess(reply, { processedCompanies: 1, signalsCreated });
    },
  );

  // -----------------------------------------------------------------------
  // GET /setup-status — AI Setup Wizard checklist status (used by frontend wizard)
  // -----------------------------------------------------------------------

  const setupStatusSchema = z.object({
    modelsConnected: z.boolean(),
    agentsConfigured: z.boolean(),
    skillsActivated: z.boolean(),
    automationCreated: z.boolean(),
    copilotTested: z.boolean(),
    wizardCompleted: z.boolean(),
    checklistDismissed: z.boolean(),
  });

  fastify.get(
    '/setup-status',
    {
      schema: {
        response: { 200: successEnvelope(setupStatusSchema) },
      },
      preHandler: [createPermissionGuard('system.settings.detail', 'view')],
    },
    async (request, reply) => {
      const companyId = request.companyId;

      const [modelCount, agentCount, skillOverrideCount, automationCount, profile] =
        await Promise.all([
          prisma.aiModel.count({ where: { isActive: true } }),
          prisma.aiAgent.count({ where: { isActive: true } }),
          prisma.aiSkillOverride.count({ where: { companyId, isActive: true } }),
          prisma.aiAutomation.count({ where: { companyId } }),
          prisma.companyProfile.findUnique({
            where: { id: companyId },
            select: { settings: true },
          }),
        ]);

      const settings = (profile?.settings as Record<string, unknown>) ?? {};

      return sendSuccess(reply, {
        modelsConnected: modelCount > 0,
        agentsConfigured: agentCount > 0,
        skillsActivated: skillOverrideCount > 0,
        automationCreated: automationCount > 0,
        copilotTested: settings.aiCopilotTested === true,
        wizardCompleted: settings.aiSetupWizardCompleted === true,
        checklistDismissed: settings.aiSetupChecklistDismissed === true,
      });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Analytics endpoints (E10 Task 11)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /analytics/summary — Usage summary with trends ───────────────
  fastify.get(
    '/analytics/summary',
    {
      preHandler: [createPermissionGuard('system.settings.detail', 'view')],
    },
    async (request, reply) => {
      assertAnalyticsService(fastify.aiAdminAnalyticsService);

      const { startDate, endDate } = request.query as {
        startDate: string;
        endDate: string;
      };
      const result = await fastify.aiAdminAnalyticsService.getSummary(
        request.companyId,
        new Date(startDate),
        new Date(endDate),
      );
      return sendSuccess(reply, result);
    },
  );

  // ─── GET /analytics/breakdown — Grouped usage breakdown ───────────────
  fastify.get(
    '/analytics/breakdown',
    {
      preHandler: [createPermissionGuard('system.settings.detail', 'view')],
    },
    async (request, reply) => {
      assertAnalyticsService(fastify.aiAdminAnalyticsService);

      const { startDate, endDate, groupBy } = request.query as {
        startDate: string;
        endDate: string;
        groupBy: string;
      };
      const result = await fastify.aiAdminAnalyticsService.getBreakdown(
        request.companyId,
        new Date(startDate),
        new Date(endDate),
        groupBy as 'model' | 'agent' | 'module' | 'user' | 'day',
      );
      return sendSuccess(reply, result);
    },
  );

  // ─── GET /analytics/alerts — Budget thresholds & anomalies ────────────
  fastify.get(
    '/analytics/alerts',
    {
      preHandler: [createPermissionGuard('system.settings.detail', 'view')],
    },
    async (request, reply) => {
      assertAnalyticsService(fastify.aiAdminAnalyticsService);

      const result = await fastify.aiAdminAnalyticsService.getAlerts(request.companyId);
      return sendSuccess(reply, result);
    },
  );

  // ─── GET /analytics/export — CSV data export ──────────────────────────
  fastify.get(
    '/analytics/export',
    {
      preHandler: [createPermissionGuard('system.settings.detail', 'view')],
    },
    async (request, reply) => {
      assertAnalyticsService(fastify.aiAdminAnalyticsService);

      const { startDate, endDate } = request.query as {
        startDate: string;
        endDate: string;
      };
      const csv = await fastify.aiAdminAnalyticsService.exportCsv(
        request.companyId,
        new Date(startDate),
        new Date(endDate),
      );
      return reply
        .header('Content-Type', 'text/csv')
        .header(
          'Content-Disposition',
          `attachment; filename="nexa-ai-usage-${startDate}-to-${endDate}.csv"`,
        )
        .send(csv);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider API Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  const KNOWN_PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic', description: 'Claude models (Opus, Sonnet, Haiku)' },
    { id: 'openai', name: 'OpenAI', description: 'GPT-4o and GPT-4o Mini models' },
    { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek Chat (V3) and Reasoner (R1)' },
    { id: 'google', name: 'Google', description: 'Gemini models' },
  ];

  /** GET /ai/admin/providers — list providers with key status */
  fastify.get('/providers', { preHandler: [adminGuard] }, async (request, reply) => {
    const providers = await Promise.all(
      KNOWN_PROVIDERS.map(async (provider) => {
        const setting = await prisma.systemSetting.findFirst({
          where: {
            companyId: request.companyId,
            key: `ai_provider_key_${provider.id}`,
          },
        });
        const hasKey = !!setting?.value;
        return {
          ...provider,
          hasKey,
          maskedKey: hasKey ? '****' + (setting!.value.slice(-4) || '****') : null,
          updatedAt: setting?.updatedAt ?? null,
        };
      }),
    );
    return sendSuccess(reply, providers);
  });

  const providerKeyBodySchema = z.object({
    apiKey: z.string().min(1, 'API key is required'),
  });

  /** PUT /ai/admin/providers/:providerId/key — store encrypted API key */
  fastify.put<{ Params: { providerId: string }; Body: { apiKey: string } }>(
    '/providers/:providerId/key',
    { preHandler: [adminGuard] },
    async (request, reply) => {
      const { providerId } = request.params;
      const body = providerKeyBodySchema.parse(request.body);

      // Validate known provider
      if (!KNOWN_PROVIDERS.some((p) => p.id === providerId)) {
        return reply.status(400).send({
          success: false,
          error: { message: `Unknown provider: ${providerId}` },
        });
      }

      // Encrypt the API key using the derived hex key from aiEncryptionKey
      const masterKeyHex = fastify.aiEncryptionKey;
      if (!masterKeyHex || masterKeyHex.length !== 64) {
        return reply.status(500).send({
          success: false,
          error: { message: 'AI encryption key is not configured' },
        });
      }

      const encryptedKey = encryptApiKey(body.apiKey, masterKeyHex);

      // Upsert into SystemSetting
      const settingKey = `ai_provider_key_${providerId}`;
      const existing = await prisma.systemSetting.findFirst({
        where: { companyId: request.companyId, key: settingKey },
      });

      if (existing) {
        await prisma.systemSetting.update({
          where: { id: existing.id },
          data: { value: encryptedKey },
        });
      } else {
        await prisma.systemSetting.create({
          data: {
            companyId: request.companyId,
            key: settingKey,
            value: encryptedKey,
            valueType: 'STRING',
            category: 'GENERAL',
          },
        });
      }

      return sendSuccess(reply, { providerId, status: 'configured' });
    },
  );

  /** DELETE /ai/admin/providers/:providerId/key — remove API key */
  fastify.delete<{ Params: { providerId: string } }>(
    '/providers/:providerId/key',
    { preHandler: [adminGuard] },
    async (request, reply) => {
      const { providerId } = request.params;
      const settingKey = `ai_provider_key_${providerId}`;

      await prisma.systemSetting.deleteMany({
        where: { companyId: request.companyId, key: settingKey },
      });

      return sendSuccess(reply, { providerId, status: 'removed' });
    },
  );
}

export const adminRoutesPlugin = adminRoutes;

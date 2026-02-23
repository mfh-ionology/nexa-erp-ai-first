import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { createPermissionGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import type { BriefingEngine } from './briefing-engine.js';
import type { SuggestionsService } from './suggestions.service.js';
import { AiDegradedError } from './ai.errors.js';
import {
  briefingQuerySchema, briefingResponseSchema,
  suggestionsBodySchema, suggestionsResponseSchema,
} from './briefing.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBriefingEngine(engine: BriefingEngine | null): asserts engine is BriefingEngine {
  if (!engine) {
    throw new AiDegradedError('AI briefing service is not available');
  }
}

function assertSuggestionsService(service: SuggestionsService | null): asserts service is SuggestionsService {
  if (!service) {
    throw new AiDegradedError('AI suggestions service is not available');
  }
}

// ---------------------------------------------------------------------------
// Briefing & suggestion routes plugin
// ---------------------------------------------------------------------------

async function briefingRoutes(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /briefing — Daily briefing (FR3)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof briefingQuerySchema> }>(
    '/briefing',
    {
      schema: {
        querystring: briefingQuerySchema,
        response: { 200: successEnvelope(briefingResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.briefing', 'view'),
    },
    async (request, reply) => {
      const briefingEngine = fastify.aiBriefingEngine as BriefingEngine | null;
      assertBriefingEngine(briefingEngine);

      const briefing = await briefingEngine.generateBriefing(
        request.userId,
        request.companyId,
        request.tenantId,
        request.query.forceRefresh,
      );

      return sendSuccess(reply, briefing);
    },
  );

  // -----------------------------------------------------------------------
  // POST /suggestions — Contextual smart suggestions (FR5)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof suggestionsBodySchema> }>(
    '/suggestions',
    {
      schema: {
        body: suggestionsBodySchema,
        response: { 200: successEnvelope(suggestionsResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.suggestions', 'view'),
    },
    async (request, reply) => {
      const suggestionsService = fastify.aiSuggestionsService as SuggestionsService | null;
      assertSuggestionsService(suggestionsService);

      const suggestions = await suggestionsService.getSuggestions({
        userId: request.userId,
        companyId: request.companyId,
        tenantId: request.tenantId,
        entityType: request.body.entityType,
        entityId: request.body.entityId,
        pageRoute: request.body.pageRoute,
      });

      return sendSuccess(reply, suggestions);
    },
  );
}

export const briefingRoutesPlugin = briefingRoutes;

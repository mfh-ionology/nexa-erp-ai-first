import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { createPermissionGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import type { PredictionService } from './prediction.service.js';
import type { AiRequestContext } from './ai.types.js';
import { AiDegradedError } from './ai.errors.js';
import {
  cashFlowRequestSchema, cashFlowResponseSchema,
  anomalyRequestSchema, anomalyResponseSchema,
  duplicateRequestSchema, duplicateResponseSchema,
  confidenceParamsSchema, confidenceResponseSchema,
  explainRequestSchema, explainResponseSchema,
} from './prediction.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(request: any): AiRequestContext {
  return {
    userId: request.userId,
    companyId: request.companyId,
    tenantId: request.tenantId,
    locale: request.headers['accept-language']?.split(',')[0]?.trim() || 'en-GB',
  };
}

function assertPredictionService(service: PredictionService | null): asserts service is PredictionService {
  if (!service) {
    throw new AiDegradedError('AI prediction service is not available');
  }
}

// ---------------------------------------------------------------------------
// Prediction routes plugin
// ---------------------------------------------------------------------------

async function predictionRoutes(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // POST /predict/cash-flow - Cash flow forecast (FR153)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof cashFlowRequestSchema> }>(
    '/predict/cash-flow',
    {
      schema: {
        body: cashFlowRequestSchema,
        response: { 200: successEnvelope(cashFlowResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.predictions', 'view'),
    },
    async (request, reply) => {
      const predictionService = fastify.aiPredictionService as PredictionService | null;
      assertPredictionService(predictionService);

      const context = buildContext(request);

      const forecast = await predictionService.forecastCashFlow({
        startDate: request.body.startDate,
        endDate: request.body.endDate,
        bankAccountIds: request.body.bankAccountIds,
        includeCommittedPOs: request.body.includeCommittedPOs,
        includeRecurring: request.body.includeRecurring,
        context,
      });

      return sendSuccess(reply, forecast);
    },
  );

  // -----------------------------------------------------------------------
  // POST /detect/anomalies - Anomaly detection (FR156)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof anomalyRequestSchema> }>(
    '/detect/anomalies',
    {
      schema: {
        body: anomalyRequestSchema,
        response: { 200: successEnvelope(anomalyResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.predictions', 'view'),
    },
    async (request, reply) => {
      const predictionService = fastify.aiPredictionService as PredictionService | null;
      assertPredictionService(predictionService);

      const context = buildContext(request);

      const result = await predictionService.detectAnomalies({
        lookbackDays: request.body.lookbackDays,
        entityTypes: request.body.entityTypes,
        minConfidence: request.body.minConfidence,
        context,
      });

      return sendSuccess(reply, result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /detect/duplicates - Duplicate detection (FR155)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof duplicateRequestSchema> }>(
    '/detect/duplicates',
    {
      schema: {
        body: duplicateRequestSchema,
        response: { 200: successEnvelope(duplicateResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.predictions', 'view'),
    },
    async (request, reply) => {
      const predictionService = fastify.aiPredictionService as PredictionService | null;
      assertPredictionService(predictionService);

      const context = buildContext(request);

      const result = await predictionService.detectDuplicates({
        entityType: request.body.entityType,
        minSimilarity: request.body.minSimilarity,
        limit: request.body.limit,
        context,
      });

      return sendSuccess(reply, result);
    },
  );

  // -----------------------------------------------------------------------
  // GET /confidence/:entityType/:entityId - Confidence scores (FR10)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof confidenceParamsSchema> }>(
    '/confidence/:entityType/:entityId',
    {
      schema: {
        params: confidenceParamsSchema,
        response: { 200: successEnvelope(confidenceResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.predictions', 'view'),
    },
    async (request, reply) => {
      const predictionService = fastify.aiPredictionService as PredictionService | null;
      assertPredictionService(predictionService);

      const context = buildContext(request);

      const result = await predictionService.getConfidence({
        entityType: request.params.entityType,
        entityId: request.params.entityId,
        context,
      });

      if (!result) {
        throw new NotFoundError(
          'NOT_FOUND',
          'No AI confidence data found for this entity',
          'ai.error.confidenceNotFound',
        );
      }

      return sendSuccess(reply, result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /explain - Explainability (FR10)
  // -----------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof explainRequestSchema> }>(
    '/explain',
    {
      schema: {
        body: explainRequestSchema,
        response: { 200: successEnvelope(explainResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.predictions', 'view'),
    },
    async (request, reply) => {
      const predictionService = fastify.aiPredictionService as PredictionService | null;
      assertPredictionService(predictionService);

      const context = buildContext(request);

      const result = await predictionService.explain({
        entityType: request.body.entityType,
        entityId: request.body.entityId,
        decisionType: request.body.decisionType,
        context,
      });

      return sendSuccess(reply, result);
    },
  );
}

export const predictionRoutesPlugin = predictionRoutes;

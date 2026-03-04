// ---------------------------------------------------------------------------
// Intelligence Pipeline Routes — Cross-tenant intelligence admin endpoints
// Source: API Contracts §21, Story E5d-3 Task 8 (AC#8)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getPlatformPrisma } from '../../client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { AppError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import { CrossTenantAggregationService } from '../../services/cross-tenant-aggregation.service.js';
import { InsightsGenerationService } from '../../services/insights-generation.service.js';
import { TenantDbConnector } from '../../services/tenant-db-connector.js';

import {
  listPatternsQuerySchema,
  listCorrectionsQuerySchema,
  listSkillEffectivenessQuerySchema,
  listInsightsQuerySchema,
  updateInsightBodySchema,
  insightIdParamsSchema,
  aggregateBodySchema,
  patternListResponseSchema,
  correctionListResponseSchema,
  skillEffectivenessListResponseSchema,
  insightListResponseSchema,
  insightResponseSchema,
  summaryResponseSchema,
  aggregationResultResponseSchema,
  insightsResultResponseSchema,
  type ListPatternsQuery,
  type ListCorrectionsQuery,
  type ListSkillEffectivenessQuery,
  type ListInsightsQuery,
  type UpdateInsightBody,
  type InsightIdParams,
  type AggregateBody,
} from './intelligence.schema.js';

// ---------------------------------------------------------------------------
// Helpers — format DB records for API responses
// ---------------------------------------------------------------------------

function formatPattern(record: {
  id: string;
  tenantId: string;
  patternDate: Date;
  industry: string | null;
  planTier: string | null;
  queryCategories: unknown;
  skillUsage: unknown;
  viewPatterns: unknown;
  automationUsage: unknown;
  createdAt: Date;
}) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    patternDate: record.patternDate.toISOString().split('T')[0],
    industry: record.industry,
    planTier: record.planTier,
    queryCategories: record.queryCategories,
    skillUsage: record.skillUsage,
    viewPatterns: record.viewPatterns,
    automationUsage: record.automationUsage,
    createdAt: record.createdAt.toISOString(),
  };
}

function formatCorrection(record: {
  id: string;
  patternDate: Date;
  industry: string | null;
  correctionType: string;
  skillKey: string | null;
  occurrenceCount: number;
  tenantCount: number;
  commonCorrection: string | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    patternDate: record.patternDate.toISOString().split('T')[0],
    industry: record.industry,
    correctionType: record.correctionType,
    skillKey: record.skillKey,
    occurrenceCount: record.occurrenceCount,
    tenantCount: record.tenantCount,
    commonCorrection: record.commonCorrection,
    createdAt: record.createdAt.toISOString(),
  };
}

function formatSkillEffectiveness(record: {
  id: string;
  skillKey: string;
  measureDate: Date;
  tenantCount: number;
  totalQueries: number;
  avgSuccessRate: { toString(): string };
  avgCorrectionRate: { toString(): string };
  avgConfidence: { toString(): string };
  trend: string | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    skillKey: record.skillKey,
    measureDate: record.measureDate.toISOString().split('T')[0],
    tenantCount: record.tenantCount,
    totalQueries: record.totalQueries,
    avgSuccessRate: record.avgSuccessRate.toString(),
    avgCorrectionRate: record.avgCorrectionRate.toString(),
    avgConfidence: record.avgConfidence.toString(),
    trend: record.trend,
    createdAt: record.createdAt.toISOString(),
  };
}

function formatInsight(record: {
  id: string;
  insightType: string;
  title: string;
  description: string;
  evidence: unknown;
  severity: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    insightType: record.insightType,
    title: record.title,
    description: record.description,
    evidence: record.evidence,
    severity: record.severity,
    status: record.status,
    reviewedById: record.reviewedById,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// Severity sort order for topInsightsBySeverity
const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function intelligenceRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');

  // Instantiate services
  const dbConnector = new TenantDbConnector(fastify.log);
  const aggregationService = new CrossTenantAggregationService(prisma, fastify.log, dbConnector);
  const insightsService = new InsightsGenerationService(prisma, fastify.log);

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/patterns — list aggregated patterns
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/patterns',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listPatternsQuerySchema,
        response: { 200: successEnvelope(patternListResponseSchema) },
      },
    },
    async (request, reply) => {
      const { cursor, limit, industry, planTier, dateFrom, dateTo, tenantId } =
        request.query as ListPatternsQuery;

      const where: Record<string, unknown> = {};
      if (industry) where.industry = industry;
      if (planTier) where.planTier = planTier;
      if (tenantId) where.tenantId = tenantId;
      if (dateFrom || dateTo) {
        where.patternDate = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };
      }
      const items = await prisma.tenantAiPattern.findMany({
        where,
        orderBy: [{ patternDate: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page.at(-1)!.id : null;

      return sendSuccess(reply, page.map(formatPattern), {
        hasMore,
        cursor: nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/corrections — list aggregated corrections
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/corrections',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listCorrectionsQuerySchema,
        response: { 200: successEnvelope(correctionListResponseSchema) },
      },
    },
    async (request, reply) => {
      const { cursor, limit, correctionType, skillKey, dateFrom, dateTo } =
        request.query as ListCorrectionsQuery;

      const where: Record<string, unknown> = {};
      if (correctionType) where.correctionType = correctionType;
      if (skillKey) where.skillKey = skillKey;
      if (dateFrom || dateTo) {
        where.patternDate = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };
      }
      const items = await prisma.tenantAiCorrection.findMany({
        where,
        orderBy: [{ patternDate: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page.at(-1)!.id : null;

      return sendSuccess(reply, page.map(formatCorrection), {
        hasMore,
        cursor: nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/skill-effectiveness — list skill metrics
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/skill-effectiveness',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listSkillEffectivenessQuerySchema,
        response: {
          200: successEnvelope(skillEffectivenessListResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { cursor, limit, skillKey, dateFrom, dateTo, trend } =
        request.query as ListSkillEffectivenessQuery;

      const where: Record<string, unknown> = {};
      if (skillKey) where.skillKey = skillKey;
      if (trend) where.trend = trend;
      if (dateFrom || dateTo) {
        where.measureDate = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };
      }
      const items = await prisma.aiSkillEffectiveness.findMany({
        where,
        orderBy: [{ measureDate: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page.at(-1)!.id : null;

      return sendSuccess(reply, page.map(formatSkillEffectiveness), {
        hasMore,
        cursor: nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/insights — list insights
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/insights',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listInsightsQuerySchema,
        response: { 200: successEnvelope(insightListResponseSchema) },
      },
    },
    async (request, reply) => {
      const { cursor, limit, insightType, severity, status } = request.query as ListInsightsQuery;

      const where: Record<string, unknown> = {};
      if (insightType) where.insightType = insightType;
      if (severity) where.severity = severity;
      if (status) where.status = status;
      const items = await prisma.platformAiInsight.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page.at(-1)!.id : null;

      return sendSuccess(reply, page.map(formatInsight), {
        hasMore,
        cursor: nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/intelligence/insights/:id — update insight status
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: InsightIdParams }>(
    '/admin/intelligence/insights/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: insightIdParamsSchema,
        body: updateInsightBodySchema,
        response: { 200: successEnvelope(insightResponseSchema) },
      },
      config: {
        audit: {
          action: 'intelligence.insight.updated',
          targetType: 'platform_ai_insight',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdateInsightBody;

      const existing = await prisma.platformAiInsight.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('INSIGHT_NOT_FOUND', 'Insight not found');
      }

      const insight = await prisma.platformAiInsight.update({
        where: { id },
        data: {
          status: body.status,
          reviewedById: body.reviewedById ?? request.platformUserId,
          reviewedAt: new Date(),
        },
      });

      return sendSuccess(reply, formatInsight(insight));
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/summary — dashboard summary (AC#8, Task 8.3)
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/summary',
    {
      preHandler: [adminOnly],
      schema: {
        response: { 200: successEnvelope(summaryResponseSchema) },
      },
    },
    async (_request, reply) => {
      // Total contributing tenants — distinct tenants in tenant_ai_patterns
      const tenantAgg = await prisma.tenantAiPattern.findMany({
        select: { tenantId: true },
        distinct: ['tenantId'],
      });
      const totalContributingTenants = tenantAgg.length;

      // Total patterns
      const totalPatterns = await prisma.tenantAiPattern.count();

      // Total corrections — sum of occurrenceCount
      const correctionAgg = await prisma.tenantAiCorrection.aggregate({
        _sum: { occurrenceCount: true },
      });
      const totalCorrections = correctionAgg._sum.occurrenceCount ?? 0;

      // Overall AI success rate — weighted average from latest skill effectiveness
      // Get the most recent measureDate
      const latestEffectiveness = await prisma.aiSkillEffectiveness.findFirst({
        orderBy: { measureDate: 'desc' },
        select: { measureDate: true },
      });

      let overallAiSuccessRate: number | null = null;
      if (latestEffectiveness) {
        const latestSkills = await prisma.aiSkillEffectiveness.findMany({
          where: { measureDate: latestEffectiveness.measureDate },
        });
        if (latestSkills.length > 0) {
          let totalWeightedSuccess = 0;
          let totalQueries = 0;
          for (const skill of latestSkills) {
            const queries = skill.totalQueries;
            totalWeightedSuccess += Number(skill.avgSuccessRate) * queries;
            totalQueries += queries;
          }
          overallAiSuccessRate =
            totalQueries > 0 ? Math.round((totalWeightedSuccess / totalQueries) * 100) / 100 : null;
        }
      }

      // Top 5 skills by usage — from latest effectiveness records
      const topSkillsByUsage = latestEffectiveness
        ? (
            await prisma.aiSkillEffectiveness.findMany({
              where: { measureDate: latestEffectiveness.measureDate },
              orderBy: { totalQueries: 'desc' },
              take: 5,
            })
          ).map((s) => ({
            skillKey: s.skillKey,
            totalQueries: s.totalQueries,
            avgSuccessRate: s.avgSuccessRate.toString(),
            trend: s.trend,
          }))
        : [];

      // Top 5 NEW insights by severity
      const topInsightsRaw = await prisma.platformAiInsight.findMany({
        where: { status: 'NEW' },
        orderBy: [{ createdAt: 'desc' }],
        take: 20, // Fetch more so we can sort by severity in-app
      });

      // Sort by severity (HIGH first), then createdAt desc
      topInsightsRaw.sort((a, b) => {
        const sevDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (sevDiff !== 0) return sevDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const topInsightsBySeverity = topInsightsRaw.slice(0, 5).map(formatInsight);

      return sendSuccess(reply, {
        totalContributingTenants,
        totalPatterns,
        totalCorrections,
        overallAiSuccessRate,
        topSkillsByUsage,
        topInsightsBySeverity,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/aggregate — trigger daily aggregation
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/intelligence/aggregate',
    {
      preHandler: [adminOnly],
      schema: {
        body: aggregateBodySchema,
        response: { 200: successEnvelope(aggregationResultResponseSchema) },
      },
      config: {
        audit: {
          action: 'intelligence.aggregation.triggered',
          targetType: 'intelligence',
        },
      },
    },
    async (request, reply) => {
      if (!dbConnector.isConfigured()) {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          'Tenant DB service credentials not configured — aggregation unavailable',
          503,
        );
      }

      const body = request.body as AggregateBody;
      // Default to yesterday (T-1)
      const targetDate = body.date ? new Date(body.date) : new Date(Date.now() - 86_400_000);

      const result = await aggregationService.aggregateForDate(targetDate);

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/generate-insights — trigger weekly insights
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/intelligence/generate-insights',
    {
      preHandler: [adminOnly],
      schema: {
        response: { 200: successEnvelope(insightsResultResponseSchema) },
      },
      config: {
        audit: {
          action: 'intelligence.insights.generated',
          targetType: 'intelligence',
        },
      },
    },
    async (_request, reply) => {
      const result = await insightsService.generateInsights();

      return sendSuccess(reply, result);
    },
  );
}

export const intelligenceRoutesPlugin = fp(intelligenceRoutes, {
  name: 'intelligence-routes',
  dependencies: ['platform-jwt-verify', 'platform-audit'],
});

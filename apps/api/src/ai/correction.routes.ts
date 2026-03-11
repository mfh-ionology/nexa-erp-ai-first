// ---------------------------------------------------------------------------
// Correction Review REST endpoints
// E5d-2 Task 7.2 (AC #8)
// Path prefix: /corrections (registered under /ai in index.ts)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@nexa/db';

import { createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { NotFoundError } from '../core/errors/not-found-error.js';
import { AiDegradedError } from './ai.errors.js';
import { CORRECTION_TO_CATEGORY } from './correction-pattern.service.js';
import type { KnowledgeArticleService } from './knowledge-article.service.js';
import {
  listCorrectionsQuerySchema,
  correctionStatsQuerySchema,
  createArticleFromCorrectionParamsSchema,
  correctionListResponseSchema,
  correctionStatsResponseSchema,
} from './correction.schema.js';
import { articleResponseSchema } from './knowledge-article.schema.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function correctionRoutes(fastify: FastifyInstance): Promise<void> {
  function assertKnowledgeArticleService(
    svc: KnowledgeArticleService | null | undefined,
  ): asserts svc is KnowledgeArticleService {
    if (!svc) {
      throw new AiDegradedError('AI knowledge article service is not available');
    }
  }

  const adminGuard = createRbacGuard({ minimumRole: UserRole.ADMIN });

  // -----------------------------------------------------------------------
  // GET /corrections — List corrections with filters + inline stats (AC: #8)
  // Cursor-based pagination, ordered by createdAt DESC
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listCorrectionsQuerySchema> }>(
    '/corrections',
    {
      schema: {
        querystring: listCorrectionsQuerySchema,
        response: { 200: successEnvelope(correctionListResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      const { companyId } = request;
      const {
        correctionType,
        skillKey,
        wasAutoResolved,
        from,
        to,
        cursor,
        limit: rawLimit,
      } = request.query;
      const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
      const where: any = { companyId };

      if (correctionType) {
        where.correctionType = correctionType;
      }
      if (skillKey) {
        where.skillKey = skillKey;
      }
      if (wasAutoResolved !== undefined) {
        where.wasAutoResolved = wasAutoResolved;
      }

      // Date range filter
      // Use `lt` with next-day boundary for `to` so that a date-only string like
      // "2026-03-04" includes the entire day (up to 23:59:59.999).
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          // If the date string has no time component (midnight exactly), advance to next day
          const nextDay = new Date(toDate);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          nextDay.setUTCHours(0, 0, 0, 0);
          where.createdAt.lt = nextDay;
        }
      }

      // Cursor-based pagination — use Prisma's native cursor which respects orderBy
      const findManyArgs: Parameters<typeof fastify.aiDb.aiCorrectionLog.findMany>[0] = {
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      };
      if (cursor) {
        findManyArgs.cursor = { id: cursor };
        findManyArgs.skip = 1;
      }

      const [corrections, total, byTypeRaw, bySkillRaw] = await Promise.all([
        fastify.aiDb.aiCorrectionLog.findMany(findManyArgs),
        fastify.aiDb.aiCorrectionLog.count({ where }),
        fastify.aiDb.aiCorrectionLog.groupBy({
          by: ['correctionType'],
          _count: true,
          where,
        }),
        fastify.aiDb.aiCorrectionLog.groupBy({
          by: ['skillKey'],
          _count: true,
          where: { ...where, skillKey: { not: null } },
        }),
      ]);

      // Determine next cursor
      let nextCursor: string | null = null;
      if (corrections.length > limit) {
        const lastItem = corrections.pop()!;
        nextCursor = lastItem.id;
      }

      // Build stats maps
      const byType: Record<string, number> = {};
      for (const row of byTypeRaw) {
        byType[row.correctionType] = row._count;
      }

      const bySkill: Record<string, number> = {};
      for (const row of bySkillRaw) {
        if (row.skillKey) {
          bySkill[row.skillKey] = row._count;
        }
      }

      // Format items
      const items = corrections.map((c) => ({
        id: c.id,
        companyId: c.companyId,
        userId: c.userId,
        conversationId: c.conversationId,
        messageId: c.messageId,
        skillKey: c.skillKey,
        originalResponse: c.originalResponse,
        correctedResponse: c.correctedResponse,
        correctionType: c.correctionType,
        wasAutoResolved: c.wasAutoResolved,
        createdAt: c.createdAt.toISOString(),
      }));

      return sendSuccess(
        reply,
        { items, stats: { total, byType, bySkill } },
        { cursor: nextCursor, hasMore: nextCursor !== null, total },
      );
    },
  );

  // -----------------------------------------------------------------------
  // GET /corrections/stats — Aggregated correction stats (AC: #8)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof correctionStatsQuerySchema> }>(
    '/corrections/stats',
    {
      schema: {
        querystring: correctionStatsQuerySchema,
        response: { 200: successEnvelope(correctionStatsResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      const { companyId } = request;
      const { from, to } = request.query;

      // Base where for optional date range
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
      const baseWhere: any = { companyId };
      if (from || to) {
        baseWhere.createdAt = {};
        if (from) baseWhere.createdAt.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          const nextDay = new Date(toDate);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          nextDay.setUTCHours(0, 0, 0, 0);
          baseWhere.createdAt.lt = nextDay;
        }
      }

      // Last 30 days boundary
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [total, totalLast30Days, byTypeRaw, bySkillRaw, autoResolvedCount, trendRaw] =
        await Promise.all([
          // Total all time (with optional date filter)
          fastify.aiDb.aiCorrectionLog.count({ where: baseWhere }),

          // Total last 30 days
          fastify.aiDb.aiCorrectionLog.count({
            where: { companyId, createdAt: { gte: thirtyDaysAgo } },
          }),

          // Group by correction type
          fastify.aiDb.aiCorrectionLog.groupBy({
            by: ['correctionType'],
            _count: true,
            where: baseWhere,
          }),

          // Group by skill key (exclude nulls)
          fastify.aiDb.aiCorrectionLog.groupBy({
            by: ['skillKey'],
            _count: true,
            where: { ...baseWhere, skillKey: { not: null } },
          }),

          // Auto-resolved count
          fastify.aiDb.aiCorrectionLog.count({
            where: { ...baseWhere, wasAutoResolved: true },
          }),

          // ISSUE #4 FIX: Trend respects from/to filters when provided,
          // falls back to last 30 days when no date range is specified.
          (() => {
            const trendStart = from ? new Date(from) : thirtyDaysAgo;
            const trendEndDate = to
              ? (() => {
                  const d = new Date(to);
                  d.setUTCDate(d.getUTCDate() + 1);
                  d.setUTCHours(0, 0, 0, 0);
                  return d;
                })()
              : new Date();
            return fastify.aiDb.$queryRaw<Array<{ day: string; count: bigint }>>`
              SELECT DATE(created_at) AS day, COUNT(*)::bigint AS count
              FROM ai_correction_log
              WHERE company_id = ${companyId}
                AND created_at >= ${trendStart}
                AND created_at < ${trendEndDate}
              GROUP BY DATE(created_at)
              ORDER BY day ASC
            `;
          })(),
        ]);

      // Build stats maps
      const byType: Record<string, number> = {};
      for (const row of byTypeRaw) {
        byType[row.correctionType] = row._count;
      }

      const bySkill: Record<string, number> = {};
      for (const row of bySkillRaw) {
        if (row.skillKey) {
          bySkill[row.skillKey] = row._count;
        }
      }

      // Format trend
      const trend = trendRaw.map((row) => ({
        date: String(row.day),
        count: Number(row.count),
      }));

      return sendSuccess(reply, {
        total,
        last30Days: totalLast30Days,
        byType,
        bySkill,
        autoResolvedCount,
        trend,
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /corrections/:correctionId/create-article — Create knowledge
  // article from a correction (AC: #8)
  // -----------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof createArticleFromCorrectionParamsSchema>;
  }>(
    '/corrections/:correctionId/create-article',
    {
      schema: {
        params: createArticleFromCorrectionParamsSchema,
        response: { 201: successEnvelope(articleResponseSchema) },
      },
      preHandler: adminGuard,
    },
    async (request, reply) => {
      assertKnowledgeArticleService(fastify.aiKnowledgeArticleService);

      const { correctionId } = request.params;
      const { companyId, userId } = request;

      // Look up correction by ID + companyId (404 for wrong company — no info leak)
      const correction = await fastify.aiDb.aiCorrectionLog.findFirst({
        where: { id: correctionId, companyId },
      });

      if (!correction) {
        throw new NotFoundError(
          'CORRECTION_NOT_FOUND',
          'Correction not found',
          'ai.error.correctionNotFound',
        );
      }

      // Pre-fill article from correction
      const title = `From correction: ${correction.correctedResponse.slice(0, 80)}`;
      const content = correction.correctedResponse;

      const article = await fastify.aiKnowledgeArticleService.createArticle(companyId, userId, {
        title,
        content,
        category: CORRECTION_TO_CATEGORY[correction.correctionType] ?? 'BUSINESS_PROCESS',
        source: 'CORRECTION_DERIVED',
        sourceRef: correctionId,
      });

      // ISSUE #2 FIX: Mark correction as resolved so the pattern detector
      // doesn't later auto-generate a duplicate article from the same correction.
      await fastify.aiDb.aiCorrectionLog.update({
        where: { id: correctionId },
        data: { wasAutoResolved: true },
      });

      return sendSuccess(reply, article, undefined, 201);
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export const correctionRoutesPlugin = correctionRoutes;

// ---------------------------------------------------------------------------
// Platform Knowledge Article CRUD Routes — Admin endpoints for knowledge management
// Source: API Contracts §21, Story E5d-4 Task 2 (AC#1, AC#9)
//
// VENDOR WORKFLOWS (AC#7, AC#8):
//
// Skill Update Distribution:
//   1. Vendor reviews a SKILL_IMPROVEMENT insight in the Intelligence Dashboard
//      (e.g. ai_skill_effectiveness shows avgSuccessRate < 50% for a skill)
//   2. Vendor creates a new article: POST /admin/intelligence/knowledge
//      { category: "SKILL_UPDATE", title: "Skill Update: {skillKey} — improved guidance", ... }
//   3. Vendor publishes: POST /admin/intelligence/knowledge/:id/publish
//   4. Article appears in matching tenants' GET /ai/knowledge-articles/suggested
//   5. No automated plumbing — manual curation by vendor.
//      Optionally store the PlatformAiInsight ID in the article content for traceability.
//
// Default Config for New Tenants:
//   1. Vendor pre-creates articles: POST /admin/intelligence/knowledge
//      { category: "DEFAULT_CONFIG", targetIndustries: ["construction"], ... }
//   2. Vendor publishes: POST /admin/intelligence/knowledge/:id/publish
//   3. When a new tenant is provisioned with a matching industry, they see
//      DEFAULT_CONFIG articles in GET /ai/knowledge-articles/suggested automatically
//   4. No special onboarding code — industry filtering handles targeting naturally.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getPlatformPrisma } from '../../client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { DomainError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';

import {
  listKnowledgeQuerySchema,
  knowledgeIdParamsSchema,
  createKnowledgeBodySchema,
  updateKnowledgeBodySchema,
  knowledgeResponseSchema,
  knowledgeListResponseSchema,
  type ListKnowledgeQuery,
  type KnowledgeIdParams,
  type CreateKnowledgeBody,
  type UpdateKnowledgeBody,
} from './knowledge.schema.js';

// ---------------------------------------------------------------------------
// Helpers — format DB records for API responses
// ---------------------------------------------------------------------------

interface KnowledgeArticleRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  targetIndustries: string[];
  targetPlanTiers: string[];
  version: number;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

interface DistributionSummary {
  accepted: number;
  rejected: number;
  pending: number;
}

interface DistributionStats extends DistributionSummary {
  totalEligibleTenants: number;
}

function formatKnowledgeArticle(
  record: KnowledgeArticleRecord,
  stats?: DistributionStats | DistributionSummary,
  statsKey?: 'distributionStats' | 'distributionSummary',
) {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    category: record.category,
    targetIndustries: record.targetIndustries,
    targetPlanTiers: record.targetPlanTiers,
    version: record.version,
    status: record.status,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdById: record.createdById,
    ...(stats && statsKey ? { [statsKey]: stats } : {}),
  };
}

// ---------------------------------------------------------------------------
// Distribution stats helpers (AC#9)
// ---------------------------------------------------------------------------

type PrismaPlatformClient = ReturnType<typeof getPlatformPrisma>;

/** Count accepted/rejected responses for an article at a given version. */
async function countResponses(
  prisma: PrismaPlatformClient,
  articleId: string,
  articleVersion: number,
): Promise<{ accepted: number; rejected: number }> {
  const responses = await prisma.platformKnowledgeResponse.groupBy({
    by: ['status'],
    where: { articleId, articleVersion },
    _count: { status: true },
  });

  let accepted = 0;
  let rejected = 0;
  for (const r of responses) {
    if (r.status === 'ACCEPTED') accepted = r._count.status;
    else if (r.status === 'REJECTED') rejected = r._count.status;
  }

  return { accepted, rejected };
}

/** Count eligible tenants matching an article's industry + plan tier targeting. */
async function countEligibleTenants(
  prisma: PrismaPlatformClient,
  targetIndustries: string[],
  targetPlanTiers: string[],
): Promise<number> {
  const eligibleWhere: Record<string, unknown> = { status: 'ACTIVE' };

  if (targetIndustries.length > 0) {
    eligibleWhere.industry = { in: targetIndustries };
  }
  if (targetPlanTiers.length > 0) {
    eligibleWhere.plan = { code: { in: targetPlanTiers } };
  }

  return prisma.tenant.count({ where: eligibleWhere });
}

async function getDistributionStats(
  prisma: PrismaPlatformClient,
  article: KnowledgeArticleRecord,
): Promise<DistributionStats> {
  const [{ accepted, rejected }, totalEligibleTenants] = await Promise.all([
    countResponses(prisma, article.id, article.version),
    countEligibleTenants(prisma, article.targetIndustries, article.targetPlanTiers),
  ]);

  const pending = Math.max(0, totalEligibleTenants - accepted - rejected);

  return { totalEligibleTenants, accepted, rejected, pending };
}

/**
 * Batch-compute distribution summaries for a page of articles (2 queries total
 * instead of 2*N). Uses a single groupBy across all article IDs + a
 * deduplicated set of tenant-count queries keyed by filter combination.
 */
async function getDistributionSummariesBatch(
  prisma: PrismaPlatformClient,
  articles: KnowledgeArticleRecord[],
): Promise<Map<string, DistributionSummary>> {
  if (articles.length === 0) return new Map();

  // 1. Single groupBy across all article IDs, including articleVersion in the
  //    groupBy so we can filter to only the current version per article.
  const versionByArticleId = new Map(articles.map((a) => [a.id, a.version]));
  const allArticleIds = articles.map((a) => a.id);

  const responseCounts = await prisma.platformKnowledgeResponse.groupBy({
    by: ['articleId', 'articleVersion', 'status'],
    where: { articleId: { in: allArticleIds } },
    _count: { status: true },
  });

  // Build a map: articleId → { accepted, rejected } only for the current version
  const responseMap = new Map<string, { accepted: number; rejected: number }>();
  for (const r of responseCounts) {
    const currentVersion = versionByArticleId.get(r.articleId);
    // Only count responses matching the article's current version
    if (currentVersion === undefined || r.articleVersion !== currentVersion) continue;

    const entry = responseMap.get(r.articleId) ?? { accepted: 0, rejected: 0 };
    if (r.status === 'ACCEPTED') entry.accepted = r._count.status;
    else if (r.status === 'REJECTED') entry.rejected = r._count.status;
    responseMap.set(r.articleId, entry);
  }

  // 2. Deduplicate tenant-count queries by filter key
  //    Use slice() to avoid mutating the original arrays via sort()
  const filterKeyMap = new Map<string, { targetIndustries: string[]; targetPlanTiers: string[] }>();
  const articleFilterKeys = new Map<string, string>();

  for (const article of articles) {
    const key = `${[...article.targetIndustries].sort().join(',')}|${[...article.targetPlanTiers].sort().join(',')}`;
    filterKeyMap.set(key, {
      targetIndustries: article.targetIndustries,
      targetPlanTiers: article.targetPlanTiers,
    });
    articleFilterKeys.set(article.id, key);
  }

  const eligibleCounts = new Map<string, number>();
  await Promise.all(
    [...filterKeyMap.entries()].map(async ([key, filters]) => {
      const count = await countEligibleTenants(
        prisma,
        filters.targetIndustries,
        filters.targetPlanTiers,
      );
      eligibleCounts.set(key, count);
    }),
  );

  // 3. Assemble per-article summaries
  const result = new Map<string, DistributionSummary>();
  for (const article of articles) {
    const { accepted, rejected } = responseMap.get(article.id) ?? { accepted: 0, rejected: 0 };
    const filterKey = articleFilterKeys.get(article.id)!;
    const totalEligible = eligibleCounts.get(filterKey) ?? 0;
    const pending = Math.max(0, totalEligible - accepted - rejected);
    result.set(article.id, { accepted, rejected, pending });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Version bump logic (exported for unit testing — AC#6)
// ---------------------------------------------------------------------------

/**
 * Determines whether a knowledge article's version should be auto-incremented.
 * Version bumps only when content changes on a PUBLISHED article.
 * Title-only or metadata-only changes do NOT trigger a version bump.
 */
export function shouldAutoIncrementVersion(
  existingStatus: string,
  existingContent: string,
  updateContent?: string,
): boolean {
  const contentChanged = updateContent !== undefined && updateContent !== existingContent;
  return existingStatus === 'PUBLISHED' && contentChanged;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/knowledge — list with filters + pagination + distributionSummary
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/intelligence/knowledge',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listKnowledgeQuerySchema,
        response: { 200: successEnvelope(knowledgeListResponseSchema) },
      },
    },
    async (request, reply) => {
      const { cursor, limit, status, category } = request.query as ListKnowledgeQuery;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (category) where.category = category;

      const items = await prisma.platformKnowledgeArticle.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page.at(-1)!.id : null;

      // Compute distribution summaries in batch (2 queries instead of 2*N)
      const summaryMap = await getDistributionSummariesBatch(prisma, page);
      const formatted = page.map((item) => {
        const summary = summaryMap.get(item.id) ?? { accepted: 0, rejected: 0, pending: 0 };
        return formatKnowledgeArticle(item, summary, 'distributionSummary');
      });

      return sendSuccess(reply, formatted, {
        hasMore,
        cursor: nextCursor,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/knowledge/:id — get single with distributionStats
  // -------------------------------------------------------------------------
  fastify.get<{ Params: KnowledgeIdParams }>(
    '/admin/intelligence/knowledge/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: knowledgeIdParamsSchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const article = await prisma.platformKnowledgeArticle.findUnique({
        where: { id },
      });

      if (!article) {
        throw new NotFoundError('ARTICLE_NOT_FOUND', 'Knowledge article not found');
      }

      const stats = await getDistributionStats(prisma, article);
      const formatted = formatKnowledgeArticle(article, stats, 'distributionStats');

      return sendSuccess(reply, formatted);
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge — create in DRAFT status
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/intelligence/knowledge',
    {
      preHandler: [adminOnly],
      schema: {
        body: createKnowledgeBodySchema,
        response: { 201: successEnvelope(knowledgeResponseSchema) },
      },
      config: {
        audit: {
          action: 'knowledge.article.created',
          targetType: 'platform_knowledge_article',
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateKnowledgeBody;

      const article = await prisma.platformKnowledgeArticle.create({
        data: {
          title: body.title,
          content: body.content,
          category: body.category,
          targetIndustries: body.targetIndustries,
          targetPlanTiers: body.targetPlanTiers,
          status: 'DRAFT',
          createdById: request.platformUserId,
        },
      });

      return sendSuccess(reply, formatKnowledgeArticle(article), undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/intelligence/knowledge/:id — update; auto-version on content change
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: KnowledgeIdParams }>(
    '/admin/intelligence/knowledge/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: knowledgeIdParamsSchema,
        body: updateKnowledgeBodySchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
      config: {
        audit: {
          action: 'knowledge.article.updated',
          targetType: 'platform_knowledge_article',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdateKnowledgeBody;

      const existing = await prisma.platformKnowledgeArticle.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('ARTICLE_NOT_FOUND', 'Knowledge article not found');
      }

      // Auto-increment version if content changes on PUBLISHED article (AC#6)
      const shouldBumpVersion = shouldAutoIncrementVersion(
        existing.status,
        existing.content,
        body.content,
      );

      const data: Record<string, unknown> = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.content !== undefined) data.content = body.content;
      if (body.category !== undefined) data.category = body.category;
      if (body.targetIndustries !== undefined) data.targetIndustries = body.targetIndustries;
      if (body.targetPlanTiers !== undefined) data.targetPlanTiers = body.targetPlanTiers;
      if (shouldBumpVersion) data.version = existing.version + 1;

      const updated = await prisma.platformKnowledgeArticle.update({
        where: { id },
        data,
      });

      return sendSuccess(reply, formatKnowledgeArticle(updated));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge/:id/publish — DRAFT → PUBLISHED
  // -------------------------------------------------------------------------
  fastify.post<{ Params: KnowledgeIdParams }>(
    '/admin/intelligence/knowledge/:id/publish',
    {
      preHandler: [adminOnly],
      schema: {
        params: knowledgeIdParamsSchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
      config: {
        audit: {
          action: 'knowledge.article.published',
          targetType: 'platform_knowledge_article',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.platformKnowledgeArticle.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('ARTICLE_NOT_FOUND', 'Knowledge article not found');
      }

      if (existing.status !== 'DRAFT') {
        throw new DomainError('INVALID_STATUS_TRANSITION', 'Only DRAFT articles can be published');
      }

      const updated = await prisma.platformKnowledgeArticle.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      return sendSuccess(reply, formatKnowledgeArticle(updated));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge/:id/archive — PUBLISHED → ARCHIVED
  // -------------------------------------------------------------------------
  fastify.post<{ Params: KnowledgeIdParams }>(
    '/admin/intelligence/knowledge/:id/archive',
    {
      preHandler: [adminOnly],
      schema: {
        params: knowledgeIdParamsSchema,
        response: { 200: successEnvelope(knowledgeResponseSchema) },
      },
      config: {
        audit: {
          action: 'knowledge.article.archived',
          targetType: 'platform_knowledge_article',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.platformKnowledgeArticle.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('ARTICLE_NOT_FOUND', 'Knowledge article not found');
      }

      if (existing.status !== 'PUBLISHED') {
        throw new DomainError(
          'INVALID_STATUS_TRANSITION',
          'Only PUBLISHED articles can be archived',
        );
      }

      const updated = await prisma.platformKnowledgeArticle.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });

      return sendSuccess(reply, formatKnowledgeArticle(updated));
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /admin/intelligence/knowledge/:id — hard-delete DRAFT only
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: KnowledgeIdParams }>(
    '/admin/intelligence/knowledge/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: knowledgeIdParamsSchema,
      },
      config: {
        audit: {
          action: 'knowledge.article.deleted',
          targetType: 'platform_knowledge_article',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.platformKnowledgeArticle.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('ARTICLE_NOT_FOUND', 'Knowledge article not found');
      }

      if (existing.status !== 'DRAFT') {
        throw new DomainError(
          'CANNOT_DELETE_NON_DRAFT',
          'Only DRAFT articles can be deleted; archive published articles instead',
        );
      }

      await prisma.platformKnowledgeArticle.delete({
        where: { id },
      });

      return reply.status(204).send();
    },
  );
}

export const knowledgeRoutesPlugin = fp(knowledgeRoutes, {
  name: 'knowledge-routes',
  dependencies: ['platform-jwt-verify', 'platform-audit'],
});

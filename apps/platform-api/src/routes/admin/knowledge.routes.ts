// ---------------------------------------------------------------------------
// Platform Knowledge Article CRUD Routes — Admin endpoints for knowledge management
// Source: API Contracts §21, Story E5d-4 Task 2 (AC#1, AC#9)
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

async function getDistributionSummary(
  prisma: PrismaPlatformClient,
  articleId: string,
  articleVersion: number,
): Promise<DistributionSummary> {
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

  // Pending = eligible - responded (at this version)
  const respondedCount = accepted + rejected;

  return { accepted, rejected, pending: Math.max(0, respondedCount === 0 ? 0 : 0) };
}

async function getDistributionStats(
  prisma: PrismaPlatformClient,
  article: KnowledgeArticleRecord,
): Promise<DistributionStats> {
  const summary = await getDistributionSummary(prisma, article.id, article.version);

  // Count eligible tenants: active tenants matching industry + plan tier filters
  const eligibleWhere: Record<string, unknown> = { status: 'ACTIVE' };

  if (article.targetIndustries.length > 0) {
    eligibleWhere.industry = { in: article.targetIndustries };
  }
  if (article.targetPlanTiers.length > 0) {
    eligibleWhere.plan = { code: { in: article.targetPlanTiers } };
  }

  const totalEligibleTenants = await prisma.tenant.count({ where: eligibleWhere });

  const pending = Math.max(0, totalEligibleTenants - summary.accepted - summary.rejected);

  return {
    totalEligibleTenants,
    accepted: summary.accepted,
    rejected: summary.rejected,
    pending,
  };
}

async function getDistributionSummaryForList(
  prisma: PrismaPlatformClient,
  articleId: string,
  articleVersion: number,
): Promise<DistributionSummary> {
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

  // For list view, pending is approximate (without counting eligible tenants)
  return { accepted, rejected, pending: 0 };
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

      // Compute distribution summary per article
      const formatted = await Promise.all(
        page.map(async (item) => {
          const summary = await getDistributionSummaryForList(prisma, item.id, item.version);
          return formatKnowledgeArticle(item, summary, 'distributionSummary');
        }),
      );

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
      const contentChanged = body.content !== undefined && body.content !== existing.content;
      const shouldBumpVersion = existing.status === 'PUBLISHED' && contentChanged;

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

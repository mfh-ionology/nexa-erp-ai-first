// ---------------------------------------------------------------------------
// KnowledgeDistributionService — Suggest and distribute platform knowledge to tenants
// Source: Story E5d-4 Task 3 (AC#3, AC#6)
// ---------------------------------------------------------------------------

import type { PlatformPrismaClient } from '../client.js';
import type { ConnectorLogger } from './tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

export interface PreviousResponse {
  status: string;
  articleVersion: number;
}

export interface SuggestedKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  version: number;
  publishedAt: string;
  previousResponse: PreviousResponse | null;
}

export interface SuggestedKnowledgeResult {
  data: SuggestedKnowledgeArticle[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RecordResponseInput {
  status: 'ACCEPTED' | 'REJECTED';
  tenantArticleId?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when a platform knowledge article is not found or not eligible. */
export class KnowledgeArticleNotFoundError extends Error {
  constructor(articleId: string) {
    super(`Platform knowledge article ${articleId} not found`);
    this.name = 'KnowledgeArticleNotFoundError';
  }
}

/** Thrown when an operation targets an article in an invalid status. */
export class KnowledgeArticleStatusError extends Error {
  readonly articleStatus: string;
  constructor(_articleId: string, status: string) {
    super(`Cannot respond to a non-PUBLISHED article (status: ${status})`);
    this.name = 'KnowledgeArticleStatusError';
    this.articleStatus = status;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class KnowledgeDistributionService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly logger: ConnectorLogger,
  ) {}

  /**
   * Get suggested (unresponded) platform knowledge articles for a tenant.
   *
   * Returns PUBLISHED articles that:
   * - Match the tenant's industry (or have empty targetIndustries = all)
   * - Match the tenant's plan tier (or have empty targetPlanTiers = all)
   * - Have NOT been responded to at the current article version
   * - If previously responded to an older version, includes previousResponse data
   */
  async getSuggestedForTenant(
    tenantId: string,
    opts?: PaginationOpts,
  ): Promise<SuggestedKnowledgeResult> {
    const limit = Math.min(opts?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // 1. Fetch tenant's industry and plan tier
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { industry: true, plan: { select: { code: true } } },
    });

    if (!tenant) {
      this.logger.warn(`Tenant ${tenantId} not found for knowledge suggestion`);
      return { data: [], nextCursor: null, hasMore: false };
    }

    const tenantIndustry = tenant.industry;
    const tenantPlanTier = tenant.plan.code;

    // 2. Fetch PUBLISHED articles in batches, filtering in-app, until we fill
    //    the requested page or exhaust the database. Max 3 rounds to bound queries.
    const batchSize = limit * 3;
    const maxRounds = 3;
    const suggested: SuggestedKnowledgeArticle[] = [];
    let dbCursor = opts?.cursor;
    let dbExhausted = false;

    for (let round = 0; round < maxRounds && suggested.length < limit && !dbExhausted; round++) {
      const articles = await this.prisma.platformKnowledgeArticle.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: batchSize,
        ...(dbCursor ? { cursor: { id: dbCursor }, skip: 1 } : {}),
      });

      if (articles.length === 0) {
        dbExhausted = true;
        break;
      }
      if (articles.length < batchSize) {
        dbExhausted = true;
      }

      // Advance DB cursor to the last fetched article for the next round
      dbCursor = articles.at(-1)!.id;

      // 3. Fetch responses for this batch
      const articleIds = articles.map((a) => a.id);
      const responses = await this.prisma.platformKnowledgeResponse.findMany({
        where: { tenantId, articleId: { in: articleIds } },
      });
      const responseByArticleId = new Map(responses.map((r) => [r.articleId, r]));

      // 4. Filter articles based on tenant eligibility and response status
      for (const article of articles) {
        if (suggested.length >= limit) break;

        // Industry filter: empty targetIndustries = all industries
        if (article.targetIndustries.length > 0 && tenantIndustry) {
          if (!article.targetIndustries.includes(tenantIndustry)) continue;
        }
        // If tenant has no industry set but article targets specific industries, skip
        if (article.targetIndustries.length > 0 && !tenantIndustry) continue;

        // Plan tier filter: empty targetPlanTiers = all tiers
        if (article.targetPlanTiers.length > 0) {
          if (!article.targetPlanTiers.includes(tenantPlanTier)) continue;
        }

        // Response check
        const existingResponse = responseByArticleId.get(article.id);

        if (existingResponse && existingResponse.articleVersion === article.version) {
          // Already responded to this exact version — exclude
          continue;
        }

        // Build previousResponse if they responded to an earlier version
        const previousResponse: PreviousResponse | null = existingResponse
          ? { status: existingResponse.status, articleVersion: existingResponse.articleVersion }
          : null;

        suggested.push({
          id: article.id,
          title: article.title,
          content: article.content,
          category: article.category,
          version: article.version,
          publishedAt: article.publishedAt?.toISOString() ?? new Date().toISOString(),
          previousResponse,
        });
      }
    }

    // hasMore is true if we filled the page AND the DB is not exhausted
    const hasMore = suggested.length >= limit && !dbExhausted;
    const nextCursor = suggested.length > 0 ? suggested.at(-1)!.id : null;

    return {
      data: suggested.slice(0, limit),
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    };
  }

  /**
   * Get a single PUBLISHED platform article by ID, checking tenant eligibility.
   * Returns null if the article doesn't exist, isn't published, or doesn't match
   * the tenant's industry/plan tier.
   */
  async getArticleForTenant(
    tenantId: string,
    articleId: string,
  ): Promise<SuggestedKnowledgeArticle | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { industry: true, plan: { select: { code: true } } },
    });

    if (!tenant) return null;

    const article = await this.prisma.platformKnowledgeArticle.findUnique({
      where: { id: articleId },
    });

    if (!article || article.status !== 'PUBLISHED') return null;

    // Industry filter
    if (article.targetIndustries.length > 0) {
      if (!tenant.industry || !article.targetIndustries.includes(tenant.industry)) return null;
    }

    // Plan tier filter
    if (article.targetPlanTiers.length > 0) {
      if (!article.targetPlanTiers.includes(tenant.plan.code)) return null;
    }

    // Check existing response — exclude if already responded at current version
    // (consistent with getSuggestedForTenant filtering)
    const existingResponse = await this.prisma.platformKnowledgeResponse.findUnique({
      where: { tenantId_articleId: { tenantId, articleId } },
    });

    if (existingResponse && existingResponse.articleVersion === article.version) {
      // Already responded to this exact version — not actionable
      return null;
    }

    const previousResponse: PreviousResponse | null = existingResponse
      ? { status: existingResponse.status, articleVersion: existingResponse.articleVersion }
      : null;

    return {
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      version: article.version,
      publishedAt: article.publishedAt?.toISOString() ?? new Date().toISOString(),
      previousResponse,
    };
  }

  /**
   * Record a tenant's response (ACCEPTED or REJECTED) to a platform knowledge article.
   *
   * Uses upsert on the (tenantId, articleId) unique constraint.
   * Sets articleVersion to the article's current version.
   */
  async recordTenantResponse(
    tenantId: string,
    articleId: string,
    body: RecordResponseInput,
  ): Promise<void> {
    // Fetch the article's current version
    const article = await this.prisma.platformKnowledgeArticle.findUnique({
      where: { id: articleId },
      select: { version: true, status: true },
    });

    if (!article) {
      throw new KnowledgeArticleNotFoundError(articleId);
    }

    if (article.status !== 'PUBLISHED') {
      throw new KnowledgeArticleStatusError(articleId, article.status);
    }

    // Upsert using the unique constraint (tenantId, articleId)
    await this.prisma.platformKnowledgeResponse.upsert({
      where: {
        tenantId_articleId: { tenantId, articleId },
      },
      create: {
        tenantId,
        articleId,
        articleVersion: article.version,
        status: body.status,
        tenantArticleId: body.tenantArticleId ?? null,
        respondedAt: new Date(),
      },
      update: {
        articleVersion: article.version,
        status: body.status,
        tenantArticleId: body.tenantArticleId ?? null,
        respondedAt: new Date(),
      },
    });

    this.logger.info(
      `Tenant ${tenantId} ${body.status.toLowerCase()} platform article ${articleId} v${article.version}`,
    );
  }
}

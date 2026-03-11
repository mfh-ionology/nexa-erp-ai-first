// ---------------------------------------------------------------------------
// KnowledgeDistributionService Tests — E5d-4 Task 3.4
// Source: AC#3 (Knowledge Distribution), AC#6 (Versioning & Re-Suggestion)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeDistributionService } from '../services/knowledge-distribution.service.js';
import { shouldAutoIncrementVersion } from '../routes/admin/knowledge.routes.js';
import type { ConnectorLogger } from '../services/tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

function createMockLogger(): ConnectorLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    tenant: {
      findUnique: vi.fn(),
    },
    platformKnowledgeArticle: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    platformKnowledgeResponse: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: 'response-1' }),
    },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const ARTICLE_ID_1 = 'article-001';
const ARTICLE_ID_2 = 'article-002';
const ARTICLE_ID_3 = 'article-003';

const PUBLISHED_DATE = new Date('2026-03-01T10:00:00Z');

function makeTenant(
  overrides: Partial<{
    industry: string | null;
    planCode: string;
  }> = {},
) {
  return {
    industry: 'industry' in overrides ? overrides.industry : 'construction',
    plan: { code: overrides.planCode ?? 'professional' },
  };
}

function makeArticle(
  overrides: Partial<{
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
  }> = {},
) {
  return {
    id: overrides.id ?? ARTICLE_ID_1,
    title: overrides.title ?? 'Best Practice: VAT Handling',
    content: overrides.content ?? 'Always use standard VAT codes...',
    category: overrides.category ?? 'BEST_PRACTICE',
    targetIndustries: overrides.targetIndustries ?? [],
    targetPlanTiers: overrides.targetPlanTiers ?? [],
    version: overrides.version ?? 1,
    status: overrides.status ?? 'PUBLISHED',
    publishedAt: overrides.publishedAt ?? PUBLISHED_DATE,
    createdAt: overrides.createdAt ?? PUBLISHED_DATE,
    updatedAt: overrides.updatedAt ?? PUBLISHED_DATE,
    createdById: overrides.createdById ?? 'admin-001',
  };
}

function makeResponse(
  overrides: Partial<{
    id: string;
    tenantId: string;
    articleId: string;
    articleVersion: number;
    status: string;
    tenantArticleId: string | null;
    respondedAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'response-001',
    tenantId: overrides.tenantId ?? TENANT_ID,
    articleId: overrides.articleId ?? ARTICLE_ID_1,
    articleVersion: overrides.articleVersion ?? 1,
    status: overrides.status ?? 'ACCEPTED',
    tenantArticleId: overrides.tenantArticleId ?? 'tenant-article-001',
    respondedAt: overrides.respondedAt ?? new Date('2026-03-02T10:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KnowledgeDistributionService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let logger: ConnectorLogger;
  let service: KnowledgeDistributionService;

  beforeEach(() => {
    prisma = createMockPrisma();
    logger = createMockLogger();
    service = new KnowledgeDistributionService(
      prisma as unknown as Parameters<
        (typeof KnowledgeDistributionService)['prototype']['getSuggestedForTenant']
      > extends never
        ? never
        : any,
      logger,
    );
  });

  // -------------------------------------------------------------------------
  // getSuggestedForTenant
  // -------------------------------------------------------------------------

  describe('getSuggestedForTenant', () => {
    it('returns empty result when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result).toEqual({ data: [], nextCursor: null, hasMore: false });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('returns empty result when no published articles exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns articles with empty targetIndustries (matches all industries)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ industry: 'retail' }));
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, targetIndustries: [] }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
    });

    it('returns articles matching the tenant industry', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ industry: 'construction' }));
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, targetIndustries: ['construction', 'manufacturing'] }),
        makeArticle({ id: ARTICLE_ID_2, targetIndustries: ['retail'] }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
    });

    it('excludes articles with specific industries when tenant has no industry', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ industry: null }));
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, targetIndustries: ['construction'] }),
        makeArticle({ id: ARTICLE_ID_2, targetIndustries: [] }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_2);
    });

    it('returns articles with empty targetPlanTiers (matches all tiers)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ planCode: 'starter' }));
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, targetPlanTiers: [] }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
    });

    it('returns articles matching the tenant plan tier', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ planCode: 'professional' }));
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, targetPlanTiers: ['professional', 'enterprise'] }),
        makeArticle({ id: ARTICLE_ID_2, targetPlanTiers: ['starter'] }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
    });

    it('excludes articles already responded to at the current version', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, version: 1 }),
        makeArticle({ id: ARTICLE_ID_2, version: 1 }),
      ]);
      prisma.platformKnowledgeResponse.findMany.mockResolvedValue([
        makeResponse({ articleId: ARTICLE_ID_1, articleVersion: 1, status: 'ACCEPTED' }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_2);
    });

    it('re-suggests articles when version is newer than response version (AC#6)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, version: 2 }),
      ]);
      prisma.platformKnowledgeResponse.findMany.mockResolvedValue([
        makeResponse({ articleId: ARTICLE_ID_1, articleVersion: 1, status: 'ACCEPTED' }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
      expect(result.data[0].previousResponse).toEqual({
        status: 'ACCEPTED',
        articleVersion: 1,
      });
    });

    it('re-suggests articles previously rejected when new version is available', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, version: 2 }),
      ]);
      prisma.platformKnowledgeResponse.findMany.mockResolvedValue([
        makeResponse({ articleId: ARTICLE_ID_1, articleVersion: 1, status: 'REJECTED' }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].previousResponse).toEqual({
        status: 'REJECTED',
        articleVersion: 1,
      });
    });

    it('returns null previousResponse for new suggestions', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1, version: 1 }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].previousResponse).toBeNull();
    });

    it('applies both industry AND plan tier filters simultaneously', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ industry: 'construction', planCode: 'professional' }),
      );
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({
          id: ARTICLE_ID_1,
          targetIndustries: ['construction'],
          targetPlanTiers: ['professional'],
        }),
        makeArticle({
          id: ARTICLE_ID_2,
          targetIndustries: ['construction'],
          targetPlanTiers: ['enterprise'],
        }),
        makeArticle({
          id: ARTICLE_ID_3,
          targetIndustries: ['retail'],
          targetPlanTiers: ['professional'],
        }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
    });

    it('respects limit parameter', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([
        makeArticle({ id: ARTICLE_ID_1 }),
        makeArticle({ id: ARTICLE_ID_2 }),
        makeArticle({ id: ARTICLE_ID_3 }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID, { limit: 2 });

      expect(result.data).toHaveLength(2);
    });

    it('includes correct article fields in response', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      const article = makeArticle({
        id: ARTICLE_ID_1,
        title: 'Test Title',
        content: 'Test Content',
        category: 'SKILL_UPDATE',
        version: 3,
        publishedAt: new Date('2026-03-01T12:00:00Z'),
      });
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([article]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data[0]).toEqual({
        id: ARTICLE_ID_1,
        title: 'Test Title',
        content: 'Test Content',
        category: 'SKILL_UPDATE',
        version: 3,
        publishedAt: '2026-03-01T12:00:00.000Z',
        previousResponse: null,
      });
    });
  });

  // -------------------------------------------------------------------------
  // recordTenantResponse
  // -------------------------------------------------------------------------

  describe('recordTenantResponse', () => {
    it('upserts an ACCEPTED response with the article current version', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue({
        version: 2,
        status: 'PUBLISHED',
      });

      await service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, {
        status: 'ACCEPTED',
        tenantArticleId: 'tenant-article-xyz',
      });

      expect(prisma.platformKnowledgeResponse.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_articleId: { tenantId: TENANT_ID, articleId: ARTICLE_ID_1 },
        },
        create: {
          tenantId: TENANT_ID,
          articleId: ARTICLE_ID_1,
          articleVersion: 2,
          status: 'ACCEPTED',
          tenantArticleId: 'tenant-article-xyz',
          respondedAt: expect.any(Date),
        },
        update: {
          articleVersion: 2,
          status: 'ACCEPTED',
          tenantArticleId: 'tenant-article-xyz',
          respondedAt: expect.any(Date),
        },
      });
    });

    it('upserts a REJECTED response without tenantArticleId', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue({
        version: 1,
        status: 'PUBLISHED',
      });

      await service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, {
        status: 'REJECTED',
      });

      expect(prisma.platformKnowledgeResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'REJECTED',
            tenantArticleId: null,
          }),
          update: expect.objectContaining({
            status: 'REJECTED',
            tenantArticleId: null,
          }),
        }),
      );
    });

    it('throws when article is not found', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue(null);

      await expect(
        service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, { status: 'ACCEPTED' }),
      ).rejects.toThrow(/not found/i);
    });

    it('throws when article is not PUBLISHED', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue({
        version: 1,
        status: 'DRAFT',
      });

      await expect(
        service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, { status: 'ACCEPTED' }),
      ).rejects.toThrow(/non-PUBLISHED/i);
    });

    it('logs the response action', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue({
        version: 1,
        status: 'PUBLISHED',
      });

      await service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, {
        status: 'ACCEPTED',
        tenantArticleId: 'ta-1',
      });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('accepted'));
    });

    it('overwrites previous response on upsert (version upgrade)', async () => {
      prisma.platformKnowledgeArticle.findUnique.mockResolvedValue({
        version: 3,
        status: 'PUBLISHED',
      });

      await service.recordTenantResponse(TENANT_ID, ARTICLE_ID_1, {
        status: 'ACCEPTED',
        tenantArticleId: 'ta-new',
      });

      // Verify upsert was called with the new version
      const call = prisma.platformKnowledgeResponse.upsert.mock.calls[0][0];
      expect(call.create.articleVersion).toBe(3);
      expect(call.update.articleVersion).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Article Versioning — shouldAutoIncrementVersion (AC#6, Task 7.3)
  // -------------------------------------------------------------------------

  describe('Article Versioning (AC#6)', () => {
    it('increments version when content changes on a PUBLISHED article', () => {
      expect(shouldAutoIncrementVersion('PUBLISHED', 'old content', 'new content')).toBe(true);
    });

    it('does NOT increment version for title-only changes (content undefined)', () => {
      expect(shouldAutoIncrementVersion('PUBLISHED', 'original content', undefined)).toBe(false);
    });

    it('does NOT increment version when content is the same value', () => {
      expect(shouldAutoIncrementVersion('PUBLISHED', 'same content', 'same content')).toBe(false);
    });

    it('does NOT increment version for DRAFT articles even if content changes', () => {
      expect(shouldAutoIncrementVersion('DRAFT', 'old content', 'new content')).toBe(false);
    });

    it('does NOT increment version for ARCHIVED articles even if content changes', () => {
      expect(shouldAutoIncrementVersion('ARCHIVED', 'old content', 'new content')).toBe(false);
    });

    it('full versioning flow: v1 publish → accept → content update → v2 re-suggested', async () => {
      // Simulate: article at v1, tenant accepted v1, then article content updated → v2
      const articleV2 = makeArticle({ id: ARTICLE_ID_1, version: 2 });

      // Step 1: Verify content change on PUBLISHED article triggers version bump
      expect(
        shouldAutoIncrementVersion('PUBLISHED', 'original guidance', 'improved guidance'),
      ).toBe(true);

      // Step 2: Verify the re-suggestion logic sees v2 as a new suggestion
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.platformKnowledgeArticle.findMany.mockResolvedValue([articleV2]);
      prisma.platformKnowledgeResponse.findMany.mockResolvedValue([
        makeResponse({
          articleId: ARTICLE_ID_1,
          articleVersion: 1,
          status: 'ACCEPTED',
          tenantArticleId: 'tenant-copy-001',
        }),
      ]);

      const result = await service.getSuggestedForTenant(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ARTICLE_ID_1);
      expect(result.data[0].version).toBe(2);
      expect(result.data[0].previousResponse).toEqual({
        status: 'ACCEPTED',
        articleVersion: 1,
      });
    });
  });
});

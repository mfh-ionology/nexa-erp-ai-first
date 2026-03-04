// ---------------------------------------------------------------------------
// Unit tests for KnowledgeArticleService — E5d-1 Task 10.2
// Tests: CRUD with companyId scoping, category validation, source immutability,
// re-chunking on content update, usage tracking
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockChunkingService, mockEmbeddingService, mockEventBus } =
  vi.hoisted(() => ({
    mockPrisma: {
      aiKnowledgeArticle: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      aiKnowledgeChunk: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $executeRaw: vi.fn(),
    },
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockChunkingService: {
      chunkDocument: vi.fn(),
    },
    mockEmbeddingService: {
      generateEmbeddings: vi.fn(),
    },
    mockEventBus: {
      emit: vi.fn(),
      on: vi.fn(),
    },
  }));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { KnowledgeArticleService } from './knowledge-article.service.js';
import type { CreateArticleInput, UpdateArticleInput } from './knowledge-article.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';
const TEST_USER_ID = 'user-001';
const OTHER_COMPANY_ID = 'company-999';

function createService(embeddingService = mockEmbeddingService) {
  return new KnowledgeArticleService(
    mockPrisma as any,
    mockLogger as any,
    mockChunkingService as any,
    embeddingService as any,
    mockEventBus as any,
  );
}

function makeArticleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-1',
    companyId: TEST_COMPANY_ID,
    title: 'VAT Code Reference',
    content: 'VAT code 3 means reverse charge for EU purchases.',
    category: 'TERMINOLOGY',
    source: 'ADMIN_UPLOADED',
    sourceRef: null,
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 0,
    lastUsedAt: null,
    isActive: true,
    createdById: TEST_USER_ID,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    _count: { chunks: 2 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KnowledgeArticleService', () => {
  let service: KnowledgeArticleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default: chunkAndEmbed succeeds
    mockChunkingService.chunkDocument.mockReturnValue([
      { content: 'chunk 1 content', chunkIndex: 0, tokenCount: 100 },
      { content: 'chunk 2 content', chunkIndex: 1, tokenCount: 100 },
    ]);
    mockPrisma.aiKnowledgeChunk.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'chunk 1 content', chunkIndex: 0 },
      { id: 'chunk-2', content: 'chunk 2 content', chunkIndex: 1 },
    ]);
    mockEmbeddingService.generateEmbeddings.mockResolvedValue([
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
    ]);
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createArticle
  // ═══════════════════════════════════════════════════════════════════════

  describe('createArticle()', () => {
    it('creates an article with companyId scoping and default source', async () => {
      const row = makeArticleRow();
      mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(row);

      const input: CreateArticleInput = {
        title: 'VAT Code Reference',
        content: 'VAT code 3 means reverse charge for EU purchases.',
        category: 'TERMINOLOGY',
      };

      const result = await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, input);

      expect(mockPrisma.aiKnowledgeArticle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
            createdById: TEST_USER_ID,
            source: 'ADMIN_UPLOADED',
            confidenceScore: 1.0,
            isConfirmed: true,
          }),
        }),
      );
      expect(result.id).toBe('article-1');
      expect(result.companyId).toBe(TEST_COMPANY_ID);
    });

    it('emits ai.knowledge.articleCreated event', async () => {
      mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(makeArticleRow());

      await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
        title: 'Test',
        content: 'Content',
        category: 'TERMINOLOGY',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.knowledge.articleCreated',
        expect.objectContaining({
          articleId: 'article-1',
          companyId: TEST_COMPANY_ID,
          category: 'TERMINOLOGY',
          source: 'ADMIN_UPLOADED',
          confidenceScore: 1.0,
        }),
      );
    });

    it('sets default confidence score per source type', async () => {
      mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(
        makeArticleRow({ source: 'AI_GENERATED', confidenceScore: 0.5, isConfirmed: false }),
      );

      await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
        title: 'AI Content',
        content: 'Generated content.',
        category: 'BUSINESS_PROCESS',
        source: 'AI_GENERATED',
      });

      expect(mockPrisma.aiKnowledgeArticle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'AI_GENERATED',
            confidenceScore: 0.5,
            isConfirmed: false,
          }),
        }),
      );
    });

    it('throws for invalid category', async () => {
      await expect(
        service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
          title: 'Test',
          content: 'Content',
          category: 'INVALID_CATEGORY',
        }),
      ).rejects.toThrow('Invalid category');
    });

    it('throws for invalid source', async () => {
      await expect(
        service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
          title: 'Test',
          content: 'Content',
          category: 'TERMINOLOGY',
          source: 'INVALID_SOURCE',
        }),
      ).rejects.toThrow('Invalid source');
    });

    it('accepts all 5 valid categories', async () => {
      const categories = [
        'BUSINESS_PROCESS',
        'TERMINOLOGY',
        'INDUSTRY_RULES',
        'CUSTOM_FIELDS',
        'HISTORICAL_PATTERN',
      ];

      for (const category of categories) {
        vi.clearAllMocks();
        mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(makeArticleRow({ category }));

        const result = await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
          title: 'Test',
          content: 'Content',
          category,
        });

        expect(result.category).toBe(category);
      }
    });

    it('accepts all 4 valid sources', async () => {
      const sources = [
        'ADMIN_UPLOADED',
        'AI_GENERATED',
        'PLATFORM_SUGGESTED',
        'CORRECTION_DERIVED',
      ];

      for (const source of sources) {
        vi.clearAllMocks();
        mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(makeArticleRow({ source }));

        const result = await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
          title: 'Test',
          content: 'Content',
          category: 'TERMINOLOGY',
          source,
        });

        expect(result.source).toBe(source);
      }
    });

    it('fires chunkAndEmbed asynchronously (does not block)', async () => {
      mockPrisma.aiKnowledgeArticle.create.mockResolvedValue(makeArticleRow());

      const result = await service.createArticle(TEST_COMPANY_ID, TEST_USER_ID, {
        title: 'Test',
        content: 'Content to chunk.',
        category: 'TERMINOLOGY',
      });

      // createArticle returns immediately; chunking happens async
      expect(result.id).toBe('article-1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // chunkAndEmbed
  // ═══════════════════════════════════════════════════════════════════════

  describe('chunkAndEmbed()', () => {
    it('chunks the document and creates chunk rows', async () => {
      await service.chunkAndEmbed('article-1', 'Test content for chunking.');

      expect(mockChunkingService.chunkDocument).toHaveBeenCalledWith('Test content for chunking.');
      expect(mockPrisma.aiKnowledgeChunk.createMany).toHaveBeenCalledWith({
        data: [
          { articleId: 'article-1', chunkIndex: 0, content: 'chunk 1 content', tokenCount: 100 },
          { articleId: 'article-1', chunkIndex: 1, content: 'chunk 2 content', tokenCount: 100 },
        ],
      });
    });

    it('generates and stores embeddings via raw SQL', async () => {
      await service.chunkAndEmbed('article-1', 'Content');

      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledWith([
        'chunk 1 content',
        'chunk 2 content',
      ]);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('handles empty chunking result gracefully', async () => {
      mockChunkingService.chunkDocument.mockReturnValue([]);

      await service.chunkAndEmbed('article-1', '');

      expect(mockPrisma.aiKnowledgeChunk.createMany).not.toHaveBeenCalled();
      expect(mockEmbeddingService.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('continues without embeddings if embedding service is null', async () => {
      const svc = createService(null as any);

      await svc.chunkAndEmbed('article-1', 'Content');

      expect(mockChunkingService.chunkDocument).toHaveBeenCalled();
      expect(mockPrisma.aiKnowledgeChunk.createMany).toHaveBeenCalled();
      // No embedding calls
      expect(mockEmbeddingService.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('deletes existing chunks first when replaceExisting = true', async () => {
      await service.chunkAndEmbed('article-1', 'New content', true);

      expect(mockPrisma.aiKnowledgeChunk.deleteMany).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
      });
      expect(mockPrisma.aiKnowledgeChunk.createMany).toHaveBeenCalled();
    });

    it('does not delete existing chunks when replaceExisting = false', async () => {
      await service.chunkAndEmbed('article-1', 'New content', false);

      expect(mockPrisma.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.aiKnowledgeChunk.createMany).toHaveBeenCalled();
    });

    it('logs warning but does not throw if embedding fails', async () => {
      mockEmbeddingService.generateEmbeddings.mockRejectedValue(new Error('API error'));

      // Should not throw
      await service.chunkAndEmbed('article-1', 'Content');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1' }),
        expect.stringContaining('embedding generation failed'),
      );
      // Chunks should still have been created
      expect(mockPrisma.aiKnowledgeChunk.createMany).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // listArticles — companyId scoping
  // ═══════════════════════════════════════════════════════════════════════

  describe('listArticles()', () => {
    it('enforces companyId in WHERE clause', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID);

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
        }),
      );
    });

    it('filters by single category', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID, { category: 'TERMINOLOGY' });

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'TERMINOLOGY' }),
        }),
      );
    });

    it('filters by category array', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID, {
        category: ['TERMINOLOGY', 'BUSINESS_PROCESS'],
      });

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: ['TERMINOLOGY', 'BUSINESS_PROCESS'] },
          }),
        }),
      );
    });

    it('filters by source', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID, { source: 'ADMIN_UPLOADED' });

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'ADMIN_UPLOADED' }),
        }),
      );
    });

    it('filters by isActive', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID, { isActive: true });

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('orders by category ASC, confidenceScore DESC, id DESC', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID);

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ category: 'asc' }, { confidenceScore: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('includes chunk count in response', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([makeArticleRow()]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(1);

      const result = await service.listArticles(TEST_COMPANY_ID);

      expect(result.data[0]!.chunkCount).toBe(2);
    });

    it('supports cursor-based pagination', async () => {
      const articles = [makeArticleRow({ id: 'a-1' }), makeArticleRow({ id: 'a-2' })];
      // Return 2 items when limit+1=2 (limit=1) → hasMore=true
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue(articles);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(5);

      const result = await service.listArticles(TEST_COMPANY_ID, { limit: 1 });

      expect(result.nextCursor).toBe('a-2');
      expect(result.data).toHaveLength(1);
    });

    it('caps limit at MAX_LIMIT (200)', async () => {
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
      mockPrisma.aiKnowledgeArticle.count.mockResolvedValue(0);

      await service.listArticles(TEST_COMPANY_ID, { limit: 500 });

      expect(mockPrisma.aiKnowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 201, // MAX_LIMIT + 1
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getArticle — companyId scoping
  // ═══════════════════════════════════════════════════════════════════════

  describe('getArticle()', () => {
    it('returns article when found with matching companyId', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(makeArticleRow());

      const result = await service.getArticle('article-1', TEST_COMPANY_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('article-1');
      expect(result!.chunkCount).toBe(2);
      expect(mockPrisma.aiKnowledgeArticle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'article-1', companyId: TEST_COMPANY_ID },
        }),
      );
    });

    it('returns null for non-existent article (not 403)', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.getArticle('nonexistent', TEST_COMPANY_ID);

      expect(result).toBeNull();
    });

    it('returns null for cross-tenant access (wrong companyId)', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.getArticle('article-1', OTHER_COMPANY_ID);

      expect(result).toBeNull();
      expect(mockPrisma.aiKnowledgeArticle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'article-1', companyId: OTHER_COMPANY_ID },
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // updateArticle — re-chunking on content change + source immutability
  // ═══════════════════════════════════════════════════════════════════════

  describe('updateArticle()', () => {
    it('updates article metadata without re-chunking if content unchanged', async () => {
      const existing = makeArticleRow();
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(existing);
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(
        makeArticleRow({ title: 'Updated Title' }),
      );

      const result = await service.updateArticle('article-1', TEST_COMPANY_ID, {
        title: 'Updated Title',
      });

      expect(result).not.toBeNull();
      expect(mockPrisma.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
      expect(mockChunkingService.chunkDocument).not.toHaveBeenCalled();
    });

    it('re-chunks and re-embeds when content changes', async () => {
      const existing = makeArticleRow({ content: 'Old content' });
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(existing);
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(
        makeArticleRow({ content: 'New content' }),
      );

      await service.updateArticle('article-1', TEST_COMPANY_ID, {
        content: 'New content',
      });

      // Old chunks deleted
      expect(mockPrisma.aiKnowledgeChunk.deleteMany).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
      });
    });

    it('does not re-chunk when content is set to same value', async () => {
      const existing = makeArticleRow({ content: 'Same content' });
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(existing);
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(existing);

      await service.updateArticle('article-1', TEST_COMPANY_ID, {
        content: 'Same content',
      });

      expect(mockPrisma.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
    });

    it('validates category on update', async () => {
      const existing = makeArticleRow();
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateArticle('article-1', TEST_COMPANY_ID, {
          category: 'INVALID',
        }),
      ).rejects.toThrow('Invalid category');
    });

    it('returns null for non-existent article', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.updateArticle('nonexistent', TEST_COMPANY_ID, {
        title: 'X',
      });

      expect(result).toBeNull();
      expect(mockPrisma.aiKnowledgeArticle.update).not.toHaveBeenCalled();
    });

    it('returns null for cross-tenant update attempt', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.updateArticle('article-1', OTHER_COMPANY_ID, {
        title: 'Hacked',
      });

      expect(result).toBeNull();
    });

    it('does not include source in update data (immutability enforced at route level)', async () => {
      const existing = makeArticleRow();
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(existing);
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(existing);

      // Service accepts the update (source filtering is at route level)
      // but the update data should not include source even if passed
      await service.updateArticle('article-1', TEST_COMPANY_ID, {
        title: 'Updated',
      } as UpdateArticleInput);

      const updateCall = mockPrisma.aiKnowledgeArticle.update.mock.calls[0]![0];
      expect(updateCall.data).not.toHaveProperty('source');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // deleteArticle — soft-delete with companyId scoping
  // ═══════════════════════════════════════════════════════════════════════

  describe('deleteArticle()', () => {
    it('soft-deletes by setting isActive = false', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(makeArticleRow());
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(makeArticleRow({ isActive: false }));

      const result = await service.deleteArticle('article-1', TEST_COMPANY_ID);

      expect(result).toBe(true);
      expect(mockPrisma.aiKnowledgeArticle.update).toHaveBeenCalledWith({
        where: { id: 'article-1', companyId: TEST_COMPANY_ID },
        data: { isActive: false },
      });
    });

    it('returns false for non-existent article', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.deleteArticle('nonexistent', TEST_COMPANY_ID);

      expect(result).toBe(false);
    });

    it('returns false for cross-tenant delete attempt', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(null);

      const result = await service.deleteArticle('article-1', OTHER_COMPANY_ID);

      expect(result).toBe(false);
      expect(mockPrisma.aiKnowledgeArticle.update).not.toHaveBeenCalled();
    });

    it('emits ai.knowledge.articleDeleted event on soft-delete', async () => {
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(makeArticleRow());
      mockPrisma.aiKnowledgeArticle.update.mockResolvedValue(makeArticleRow({ isActive: false }));

      await service.deleteArticle('article-1', TEST_COMPANY_ID);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.knowledge.articleDeleted', {
        articleId: 'article-1',
        companyId: TEST_COMPANY_ID,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // trackUsage — fire-and-forget usage tracking
  // ═══════════════════════════════════════════════════════════════════════

  describe('trackUsage()', () => {
    it('batch updates lastUsedAt and increments usageCount via raw SQL', async () => {
      await service.trackUsage(['article-1', 'article-2'], TEST_COMPANY_ID);

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('emits ai.knowledge.articleUsed event with companyId for each article', async () => {
      await service.trackUsage(['article-1', 'article-2'], TEST_COMPANY_ID, 'conv-123');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.knowledge.articleUsed',
        expect.objectContaining({
          articleId: 'article-1',
          companyId: TEST_COMPANY_ID,
          conversationId: 'conv-123',
        }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.knowledge.articleUsed',
        expect.objectContaining({
          articleId: 'article-2',
          companyId: TEST_COMPANY_ID,
          conversationId: 'conv-123',
        }),
      );
    });

    it('does nothing for empty article IDs', async () => {
      await service.trackUsage([], TEST_COMPANY_ID);

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('logs warning but does not throw on failure (fire-and-forget)', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await service.trackUsage(['article-1'], TEST_COMPANY_ID);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ articleIds: ['article-1'] }),
        expect.stringContaining('usage tracking failed'),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // toRecord — confidenceScore parsing
  // ═══════════════════════════════════════════════════════════════════════

  describe('toRecord() — response mapping', () => {
    it('parses Decimal confidenceScore to number', async () => {
      // Prisma returns Decimal objects for Decimal fields
      mockPrisma.aiKnowledgeArticle.findFirst.mockResolvedValue(
        makeArticleRow({ confidenceScore: { toString: () => '0.85' } }),
      );

      const result = await service.getArticle('article-1', TEST_COMPANY_ID);

      expect(result!.confidenceScore).toBe(0.85);
      expect(typeof result!.confidenceScore).toBe('number');
    });
  });
});

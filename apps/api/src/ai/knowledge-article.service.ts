// ---------------------------------------------------------------------------
// KnowledgeArticleService — CRUD + chunking/embedding pipeline for tenant
// knowledge articles (E5d AiKnowledgeArticle, distinct from E5b AiModuleKnowledge)
// E5d-1 Task 4
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { ChunkingService, ChunkResult } from './chunking.service.js';
import type { EmbeddingService } from './embedding.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Valid knowledge article categories */
export const VALID_CATEGORIES = [
  'BUSINESS_PROCESS',
  'TERMINOLOGY',
  'INDUSTRY_RULES',
  'CUSTOM_FIELDS',
  'HISTORICAL_PATTERN',
] as const;

export type ArticleCategory = (typeof VALID_CATEGORIES)[number];

/** Valid knowledge article sources */
export const VALID_SOURCES = [
  'ADMIN_UPLOADED',
  'AI_GENERATED',
  'PLATFORM_SUGGESTED',
  'CORRECTION_DERIVED',
] as const;

export type ArticleSource = (typeof VALID_SOURCES)[number];

/** Default confidence scores by source (AC#9: CORRECTION_DERIVED = 0.8) */
const DEFAULT_CONFIDENCE: Record<string, number> = {
  ADMIN_UPLOADED: 1.0,
  AI_GENERATED: 0.5,
  PLATFORM_SUGGESTED: 0.9,
  CORRECTION_DERIVED: 0.8,
};

/** Default pagination */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateArticleInput {
  title: string;
  content: string;
  category: string;
  source?: string;
  sourceRef?: string;
  confidenceScore?: number;
  isConfirmed?: boolean;
}

export interface UpdateArticleInput {
  title?: string;
  content?: string;
  category?: string;
  isActive?: boolean;
  confidenceScore?: number;
  isConfirmed?: boolean;
  /** source is NOT allowed — immutable after creation */
}

export interface ListArticlesFilters {
  category?: string | string[];
  source?: string;
  isActive?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ArticleRecord {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: string;
  source: string;
  sourceRef: string | null;
  confidenceScore: number;
  isConfirmed: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  chunkCount: number;
}

export interface PaginatedArticles {
  data: ArticleRecord[];
  nextCursor: string | null;
  total: number;
}

// ─── KnowledgeArticleService ──────────────────────────────────────────────────

export class KnowledgeArticleService {
  private embeddingService: EmbeddingService | null;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly chunkingService: ChunkingService,
    embeddingService: EmbeddingService | null,
    private readonly eventBus: EventBus,
  ) {
    this.embeddingService = embeddingService;
  }

  /** Setter for optional EmbeddingService (injected after AI gateway availability check) */
  setEmbeddingService(svc: EmbeddingService): void {
    this.embeddingService = svc;
  }

  // ─── Create (AC: #2, #8, #9) ─────────────────────────────────────────────

  async createArticle(
    companyId: string,
    userId: string,
    input: CreateArticleInput,
  ): Promise<ArticleRecord> {
    // Validate category
    if (!VALID_CATEGORIES.includes(input.category as ArticleCategory)) {
      throw new Error(
        `Invalid category "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      );
    }

    const source = input.source ?? 'ADMIN_UPLOADED';
    if (!VALID_SOURCES.includes(source as ArticleSource)) {
      throw new Error(`Invalid source "${source}". Must be one of: ${VALID_SOURCES.join(', ')}`);
    }

    const confidenceScore = input.confidenceScore ?? DEFAULT_CONFIDENCE[source] ?? 0.5;
    const isConfirmed = input.isConfirmed ?? source === 'ADMIN_UPLOADED';

    const article = await this.db.aiKnowledgeArticle.create({
      data: {
        companyId,
        title: input.title,
        content: input.content,
        category: input.category,
        source,
        sourceRef: input.sourceRef ?? null,
        confidenceScore,
        isConfirmed,
        createdById: userId,
      },
      include: { _count: { select: { chunks: true } } },
    });

    this.logger.info(
      { articleId: article.id, companyId, category: input.category, source },
      'Knowledge article created',
    );

    // Emit event
    this.eventBus.emit('ai.knowledge.articleCreated', {
      articleId: article.id,
      companyId,
      category: input.category,
      source,
      confidenceScore,
    });

    // Chunk and embed asynchronously. The create response will return chunkCount: 0
    // since chunking hasn't completed yet. Clients that need the chunk count should
    // re-fetch via GET after a short delay, or listen for the articleCreated event.
    // This is intentional: chunking + embedding can be slow and shouldn't block the
    // 201 response (IMP-006 graceful degradation).
    this.chunkAndEmbed(article.id, input.content).catch((err) =>
      this.logger.warn(
        { err, articleId: article.id },
        'KnowledgeArticleService: chunkAndEmbed failed',
      ),
    );

    return this.toRecord(article);
  }

  // ─── Chunk & Embed (AC: #2, #3) ──────────────────────────────────────────

  async chunkAndEmbed(articleId: string, content: string, replaceExisting = false): Promise<void> {
    // 1. Delete existing chunks if replacing (update path)
    if (replaceExisting) {
      await this.db.aiKnowledgeChunk.deleteMany({ where: { articleId } });
    }

    // 2. Chunk the document
    const chunks: ChunkResult[] = this.chunkingService.chunkDocument(content);

    if (chunks.length === 0) {
      this.logger.debug({ articleId }, 'No chunks produced for article');
      return;
    }

    // 3. Create chunk rows in DB
    await this.db.aiKnowledgeChunk.createMany({
      data: chunks.map((chunk) => ({
        articleId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
      })),
    });

    // 4. Get chunk IDs in order (createMany doesn't return IDs)
    const createdChunks = await this.db.aiKnowledgeChunk.findMany({
      where: { articleId },
      orderBy: { chunkIndex: 'asc' },
      select: { id: true, content: true, chunkIndex: true },
    });

    // 5. Generate embeddings (fire-and-forget pattern — if embedding fails, chunks still usable for BM25)
    if (this.embeddingService) {
      try {
        const chunkTexts = createdChunks.map((c) => c.content);
        const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

        // Store embeddings via raw SQL (Prisma doesn't support vector type)
        for (let i = 0; i < createdChunks.length; i++) {
          const embedding = embeddings[i];
          if (!embedding) continue;

          const vectorLiteral = `[${embedding.join(',')}]`;
          const chunkId = createdChunks[i]!.id;
          await this.db.$executeRaw`
            UPDATE ai_knowledge_chunks SET embedding = ${vectorLiteral}::vector WHERE id = ${chunkId}
          `;
        }

        this.logger.debug(
          { articleId, chunkCount: createdChunks.length },
          'Embeddings stored for knowledge chunks',
        );
      } catch (err) {
        this.logger.warn(
          { err, articleId },
          'KnowledgeArticleService: embedding generation failed — chunks stored without embeddings',
        );
      }
    }
  }

  // ─── List (AC: #7, #8) ───────────────────────────────────────────────────

  async listArticles(
    companyId: string,
    filters: ListArticlesFilters = {},
  ): Promise<PaginatedArticles> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = { companyId };

    // Category filter (single or array)
    if (filters.category) {
      if (Array.isArray(filters.category)) {
        where.category = { in: filters.category };
      } else {
        where.category = filters.category;
      }
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Cursor-based pagination using Prisma's native cursor + skip pattern.
    // With multi-column sort (category, confidence, id), Prisma's cursor correctly
    // resumes from the cursor item's position in the sorted result set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query args
    const queryArgs: any = {
      where,
      orderBy: [{ category: 'asc' }, { confidenceScore: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { _count: { select: { chunks: true } } },
    };

    if (filters.cursor) {
      queryArgs.cursor = { id: filters.cursor };
      queryArgs.skip = 1; // Skip the cursor item itself
    }

    const [articles, total] = await Promise.all([
      this.db.aiKnowledgeArticle.findMany(queryArgs),
      this.db.aiKnowledgeArticle.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (articles.length > limit) {
      const lastItem = articles.pop()!;
      nextCursor = lastItem.id;
    }

    return {
      data: articles.map((a) => this.toRecord(a)),
      nextCursor,
      total,
    };
  }

  // ─── Get (AC: #7) ────────────────────────────────────────────────────────

  async getArticle(id: string, companyId: string): Promise<ArticleRecord | null> {
    const article = await this.db.aiKnowledgeArticle.findFirst({
      where: { id, companyId },
      include: { _count: { select: { chunks: true } } },
    });

    if (!article) return null;

    return this.toRecord(article);
  }

  // ─── Update (AC: #7, #9) ─────────────────────────────────────────────────

  async updateArticle(
    id: string,
    companyId: string,
    input: UpdateArticleInput,
  ): Promise<ArticleRecord | null> {
    // Check existence + companyId scoping
    const existing = await this.db.aiKnowledgeArticle.findFirst({
      where: { id, companyId },
    });

    if (!existing) return null;

    // Validate category if provided
    if (input.category && !VALID_CATEGORIES.includes(input.category as ArticleCategory)) {
      throw new Error(
        `Invalid category "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      );
    }

    // Build update data (source is immutable — NOT included)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic data object
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.category !== undefined) data.category = input.category;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.confidenceScore !== undefined) data.confidenceScore = input.confidenceScore;
    if (input.isConfirmed !== undefined) data.isConfirmed = input.isConfirmed;

    // AC9 (E5d-2): Auto-upgrade confidence when confirming an unconfirmed article.
    // If isConfirmed transitions false→true and caller didn't explicitly set confidenceScore,
    // automatically set it to 0.8.
    if (
      input.isConfirmed === true &&
      !existing.isConfirmed &&
      input.confidenceScore === undefined
    ) {
      data.confidenceScore = 0.8;
    }

    const article = await this.db.aiKnowledgeArticle.update({
      where: { id, companyId },
      data,
      include: { _count: { select: { chunks: true } } },
    });

    this.logger.info({ articleId: id, companyId }, 'Knowledge article updated');

    // If content changed, re-chunk and re-embed synchronously to prevent race conditions
    // when multiple content updates arrive for the same article. Unlike createArticle (where
    // fire-and-forget is safe because no existing chunks exist), updates must serialize
    // the delete-old + create-new chunking operation.
    if (input.content !== undefined && input.content !== existing.content) {
      try {
        await this.chunkAndEmbed(id, input.content, true);
      } catch (err) {
        this.logger.warn(
          { err, articleId: id },
          'KnowledgeArticleService: re-chunkAndEmbed failed on update',
        );
      }
    }

    return this.toRecord(article);
  }

  // ─── Delete (AC: #7) ─────────────────────────────────────────────────────

  async deleteArticle(id: string, companyId: string): Promise<boolean> {
    // Check existence + companyId scoping
    const existing = await this.db.aiKnowledgeArticle.findFirst({
      where: { id, companyId },
    });

    if (!existing) return false;

    // Soft-delete: set isActive = false
    await this.db.aiKnowledgeArticle.update({
      where: { id, companyId },
      data: { isActive: false },
    });

    this.logger.info({ articleId: id, companyId }, 'Knowledge article soft-deleted');

    this.eventBus.emit('ai.knowledge.articleDeleted', {
      articleId: id,
      companyId,
    });

    return true;
  }

  // ─── Track Usage (AC: #5) ────────────────────────────────────────────────

  async trackUsage(
    articleIds: string[],
    companyId: string,
    conversationId?: string,
  ): Promise<void> {
    if (articleIds.length === 0) return;

    try {
      const now = new Date();

      // Batch update lastUsedAt and increment usageCount (R-002: company-scoped)
      await this.db.$executeRaw`
        UPDATE ai_knowledge_articles
        SET last_used_at = ${now},
            usage_count = usage_count + 1,
            updated_at = ${now}
        WHERE id = ANY(${articleIds}::uuid[])
          AND company_id = ${companyId}
      `;

      // Emit events (one per article — fire-and-forget)
      for (const articleId of articleIds) {
        this.eventBus.emit('ai.knowledge.articleUsed', {
          articleId,
          companyId,
          conversationId: conversationId ?? '',
        });
      }
    } catch (err) {
      // Fire-and-forget — never blocks the AI response
      this.logger.warn({ err, articleIds }, 'KnowledgeArticleService: usage tracking failed');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private toRecord(article: any): ArticleRecord {
    return {
      id: article.id,
      companyId: article.companyId,
      title: article.title,
      content: article.content,
      category: article.category,
      source: article.source,
      sourceRef: article.sourceRef,
      confidenceScore:
        typeof article.confidenceScore === 'number'
          ? article.confidenceScore
          : parseFloat(String(article.confidenceScore)),
      isConfirmed: article.isConfirmed,
      usageCount: article.usageCount,
      lastUsedAt: article.lastUsedAt,
      isActive: article.isActive,
      createdById: article.createdById,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      chunkCount: article._count?.chunks ?? 0,
    };
  }
}

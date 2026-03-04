// ---------------------------------------------------------------------------
// KnowledgeRagService — RAG retrieval for tenant knowledge articles
// E5d-1 Task 5 (AC: #4)
// Uses E5b's shared VectorSearchService for vector/keyword search on
// ai_knowledge_chunks, then post-filters by company and enriches with
// article metadata for confidence-weighted re-ranking.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { VectorSearchService } from './vector-search.service.js';
import type { EmbeddingService } from './embedding.service.js';
import type { KnowledgeArticleService } from './knowledge-article.service.js';
import { estimateTokens } from './dynamic-context.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RagOptions {
  topK?: number;
  tokenBudget?: number;
  minSimilarity?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  articleId: string;
  content: string;
  category: string;
  title: string;
  similarity: number;
  confidenceWeight: number;
  finalScore: number;
  tokenCount: number;
}

export interface RagResult {
  chunks: RetrievedChunk[];
  totalTokens: number;
  articleIds: string[];
  formattedContext: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_TOP_K = 5;
const DEFAULT_TOKEN_BUDGET = 1000;
const DEFAULT_MIN_SIMILARITY = 0.5;

/**
 * Multiplier for initial candidate fetch. We fetch topK * CANDIDATE_MULTIPLIER
 * candidates from the vector/keyword search, then post-filter by company.
 * Needs to be large enough to find the tenant's chunks when other tenants
 * have many more chunks in the shared ai_knowledge_chunks table.
 */
const CANDIDATE_MULTIPLIER = 10;

/**
 * Minimum normalized BM25 score for keyword fallback results.
 * Applied after rank normalization (0–1 range) to filter weak keyword matches.
 */
const MIN_BM25_SCORE = 0.3;

/** Estimated token overhead for formatting wrapper (header + footer + per-line prefix) */
const FORMATTING_OVERHEAD_TOKENS = 20;
const PER_CHUNK_OVERHEAD_TOKENS = 8; // "- [CATEGORY] Title: " prefix

// ─── Confidence Weights ───────────────────────────────────────────────────

/**
 * Map article source + confirmation status to a confidence weight.
 * Used for re-ranking: finalScore = similarity * confidenceWeight.
 *
 * AC #4: PLATFORM_SUGGESTED gets 0.9 only when accepted (isConfirmed=true).
 */
export function getConfidenceWeight(source: string, isConfirmed: boolean): number {
  switch (source) {
    case 'ADMIN_UPLOADED':
      return 1.0;
    case 'PLATFORM_SUGGESTED':
      return isConfirmed ? 0.9 : 0.6;
    case 'AI_GENERATED':
      return isConfirmed ? 0.8 : 0.5;
    case 'CORRECTION_DERIVED':
      return 0.8;
    default:
      return 0.5;
  }
}

// ─── KnowledgeRagService ──────────────────────────────────────────────────

export class KnowledgeRagService {
  private vectorSearchService: VectorSearchService | null = null;
  private embeddingService: EmbeddingService | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly knowledgeArticleService: KnowledgeArticleService,
  ) {}

  /** Setter for optional VectorSearchService (injected after pgvector availability check) */
  setVectorSearchService(svc: VectorSearchService): void {
    this.vectorSearchService = svc;
  }

  /** Setter for optional EmbeddingService (injected after AI gateway check) */
  setEmbeddingService(svc: EmbeddingService): void {
    this.embeddingService = svc;
  }

  /**
   * Retrieve relevant knowledge chunks for a user query, scoped to a company.
   *
   * Algorithm:
   *   1. Generate query embedding via EmbeddingService
   *   2. Vector similarity search via VectorSearchService (E5b shared service)
   *   3. Post-filter by company + enrich with article metadata via Prisma
   *   4. Apply confidence-weighted re-ranking: finalScore = similarity * confidenceWeight
   *   5. Select top-K within token budget (accounting for formatting overhead)
   *   6. Format as <tenant_knowledge> XML block
   *   7. Fire-and-forget usage tracking
   *
   * Never throws — returns empty result on any failure (IMP-006 graceful degradation).
   */
  async retrieveRelevantKnowledge(
    query: string,
    companyId: string,
    opts?: RagOptions,
  ): Promise<RagResult> {
    const topK = opts?.topK ?? DEFAULT_TOP_K;
    const tokenBudget = opts?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
    const minSimilarity = opts?.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

    const emptyResult: RagResult = {
      chunks: [],
      totalTokens: 0,
      articleIds: [],
      formattedContext: '',
    };

    try {
      // Step 1: Generate query embedding
      let queryEmbedding: number[] | null = null;
      if (this.embeddingService) {
        queryEmbedding = await this.embeddingService.generateEmbedding(query);
      }

      // Step 2: Search for candidate chunks via shared VectorSearchService (AC #4)
      let candidateChunkIds: Map<string, number>; // chunkId → similarity/rank score

      if (queryEmbedding && this.vectorSearchService) {
        // Vector similarity search via E5b shared VectorSearchService.
        // ai_knowledge_chunks has no company_id column, so tenant isolation (R-002)
        // is enforced in step 3 via Prisma post-filter on article.companyId.
        // Fetch topK * CANDIDATE_MULTIPLIER to account for cross-tenant chunks filtered in step 3.
        const results = await this.vectorSearchService.similaritySearch(
          queryEmbedding,
          'ai_knowledge_chunks',
          {}, // No company_id filter on chunks table — enforced via article relation in step 3
          topK * CANDIDATE_MULTIPLIER,
          minSimilarity,
        );
        candidateChunkIds = new Map(results.map((r) => [r.id, r.similarity]));
      } else if (this.vectorSearchService) {
        // Fallback: BM25 keyword search via E5b shared VectorSearchService.
        this.logger.warn(
          { query },
          'KnowledgeRag: embedding unavailable, falling back to keyword search',
        );
        const results = await this.vectorSearchService.keywordSearch(
          query,
          'ai_knowledge_chunks',
          {},
          topK * CANDIDATE_MULTIPLIER,
        );
        // Normalize BM25 ranks relative to the max rank in results, then filter
        // by MIN_BM25_SCORE to discard weak keyword matches that would inject
        // irrelevant content (the vector path uses minSimilarity for this purpose).
        const maxRank = results.length > 0 ? Math.max(...results.map((r) => r.rank)) : 1;
        candidateChunkIds = new Map(
          results
            .map((r) => [r.id, maxRank > 0 ? r.rank / maxRank : 0] as const)
            .filter(([, score]) => score >= MIN_BM25_SCORE),
        );
      } else {
        // No search service available — return empty
        this.logger.warn('KnowledgeRag: VectorSearchService unavailable, returning empty');
        return emptyResult;
      }

      if (candidateChunkIds.size === 0) {
        return emptyResult;
      }

      // Step 3: Post-filter by company + enrich with article metadata via Prisma
      // R-002: tenant isolation enforced here — only chunks from active articles
      // belonging to the requesting company are returned.
      const chunkIdsArray = Array.from(candidateChunkIds.keys());
      const enrichedChunks = await this.db.aiKnowledgeChunk.findMany({
        where: {
          id: { in: chunkIdsArray },
          article: {
            companyId, // R-002: tenant isolation
            isActive: true,
          },
        },
        select: {
          id: true,
          articleId: true,
          content: true,
          tokenCount: true,
          article: {
            select: {
              title: true,
              category: true,
              source: true,
              isConfirmed: true,
            },
          },
        },
      });

      if (enrichedChunks.length === 0) {
        return emptyResult;
      }

      // Step 4: Build scored results with confidence-weighted re-ranking
      const scoredChunks: RetrievedChunk[] = enrichedChunks.map((chunk) => {
        const similarity = candidateChunkIds.get(chunk.id) ?? 0;
        const confidenceWeight = getConfidenceWeight(
          chunk.article.source,
          chunk.article.isConfirmed,
        );

        return {
          chunkId: chunk.id,
          articleId: chunk.articleId,
          content: chunk.content,
          category: chunk.article.category,
          title: chunk.article.title,
          similarity,
          confidenceWeight,
          finalScore: similarity * confidenceWeight,
          tokenCount: chunk.tokenCount || estimateTokens(chunk.content),
        };
      });

      // Sort by finalScore descending
      scoredChunks.sort((a, b) => b.finalScore - a.finalScore);

      // Step 5: Select top-K within token budget, accounting for formatting overhead
      const effectiveBudget = tokenBudget - FORMATTING_OVERHEAD_TOKENS;
      const selectedChunks: RetrievedChunk[] = [];
      let contentTokens = 0;
      const usedArticleIds = new Set<string>();

      for (const chunk of scoredChunks) {
        if (selectedChunks.length >= topK) break;
        const chunkCost = chunk.tokenCount + PER_CHUNK_OVERHEAD_TOKENS;
        if (contentTokens + chunkCost > effectiveBudget) continue;

        selectedChunks.push(chunk);
        contentTokens += chunkCost;
        usedArticleIds.add(chunk.articleId);
      }

      if (selectedChunks.length === 0) {
        return emptyResult;
      }

      // Step 6: Format context
      const formattedContext = this.formatContext(selectedChunks);
      const totalTokens = estimateTokens(formattedContext);

      // Step 7: Fire-and-forget usage tracking
      const articleIds = Array.from(usedArticleIds);
      this.knowledgeArticleService.trackUsage(articleIds, companyId).catch(() => {
        // trackUsage handles its own error logging
      });

      return { chunks: selectedChunks, totalTokens, articleIds, formattedContext };
    } catch (error) {
      this.logger.error(
        { err: error, companyId },
        'KnowledgeRag: retrieval failed, returning empty',
      );
      return emptyResult;
    }
  }

  // ─── Private: Context Formatting ────────────────────────────────────────

  /**
   * Format retrieved chunks as an XML-tagged knowledge block for injection
   * into the AI system prompt.
   */
  private formatContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return '';

    const lines = chunks.map((chunk) => {
      const label = chunk.category.replace(/_/g, ' ');
      return `- [${label}] ${chunk.title}: ${chunk.content}`;
    });

    return [
      '<tenant_knowledge>',
      '## Relevant Knowledge for This Query',
      ...lines,
      '</tenant_knowledge>',
    ].join('\n');
  }
}
